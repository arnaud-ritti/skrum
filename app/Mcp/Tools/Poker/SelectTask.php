<?php

namespace App\Mcp\Tools\Poker;

use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\SelectPokerTask;
use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\Presenters\McpPokerGame;
use App\Mcp\Tools\SkrumTool;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsOpenWorld(false)]
class SelectTask extends SkrumTool
{
    protected string $name = 'poker.game.task.select';

    protected string $description = 'Put a task on the table so players can vote on it (facilitator only), or pass task_id null to clear the table. Selecting a task that was never voted on starts its first round.';

    public function __construct(
        private McpContext $context,
        private SelectPokerTask $selectPokerTask,
        private McpPokerGame $presentGame,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'game_id' => $schema->string()->format('uuid')->required(),
            'task_id' => $schema->string()->format('uuid')->nullable()->required(),
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
            'task_id' => ['present', 'nullable', 'uuid'],
        ]);

        $game = $this->context->pokerGame((string) $validated['game_id']);

        $this->refuseObserver($game->team);

        $player = DB::transaction(function () use ($game, $validated): PokerPlayer {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();
            $player = $this->context->pokerPlayerForWrite($locked);

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            $task = $validated['task_id'] === null ? null : $locked->tasks()->whereKey($validated['task_id'])->firstOrFail();

            $this->selectPokerTask->handle($locked, $task);

            return $player;
        });

        $presented = $this->presentGame->game(PokerGame::query()->findOrFail($game->id), $player);

        return Response::structured(['currentTask' => $presented['currentTask']]);
    }
}
