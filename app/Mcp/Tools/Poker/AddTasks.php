<?php

namespace App\Mcp\Tools\Poker;

use App\Actions\Poker\AddPokerTask;
use App\Actions\Poker\PokerGuard;
use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\Tools\SkrumTool;
use App\Models\PokerGame;
use App\Models\PokerTask;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsOpenWorld(false)]
class AddTasks extends SkrumTool
{
    protected string $name = 'poker.game.tasks.add';

    protected string $description = 'Add 1 to 50 tasks (title and optional Markdown description) to the end of a planning poker game, in the given order. A game holds at most 200 tasks: if the batch does not fit, nothing is added.';

    public function __construct(
        private McpContext $context,
        private AddPokerTask $addPokerTask,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'game_id' => $schema->string()->format('uuid')->required(),
            'tasks' => $schema->array()->min(1)->max(50)->items($schema->object([
                'title' => $schema->string()->min(1)->max(200)->required(),
                'description' => $schema->string()->max(10000)->description('Markdown.'),
            ]))->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'game_id' => ['required', 'uuid'],
            'tasks' => ['required', 'array', 'min:1', 'max:50'],
            'tasks.*.title' => ['required', 'string', 'max:200'],
            'tasks.*.description' => ['nullable', 'string', 'max:10000'],
        ]);

        $game = $this->context->pokerGame((string) $validated['game_id']);

        $tasks = DB::transaction(function () use ($game, $validated): array {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();
            $player = $this->context->pokerPlayerForWrite($locked);

            PokerGuard::notEnded($locked);
            PokerGuard::canEditTasks($player);

            if ($locked->tasks()->count() + count($validated['tasks']) > AddPokerTask::MaxTasks) {
                throw ValidationException::withMessages(['tasks' => __('A game can hold at most 200 tasks.')]);
            }

            return array_map(
                fn (array $task): PokerTask => $this->addPokerTask->handle($locked, $task['title'], $task['description'] ?? null),
                array_values($validated['tasks']),
            );
        });

        return Response::structured([
            'added' => count($tasks),
            'tasks' => collect($tasks)->map(fn (PokerTask $task): array => [
                'id' => $task->id,
                'title' => $task->title,
                'position' => $task->position,
            ])->all(),
        ]);
    }
}
