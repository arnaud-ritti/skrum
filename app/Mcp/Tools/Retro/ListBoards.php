<?php

namespace App\Mcp\Tools\Retro;

use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Mcp\McpContext;
use App\Mcp\Presenters\McpBoard;
use App\Mcp\Tools\SkrumTool;
use App\Models\Retro;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class ListBoards extends SkrumTool
{
    protected string $name = 'retro.boards.list';

    protected string $description = 'List the retrospective boards of a team, newest first, optionally between two dates or only finished ones.';

    public function __construct(
        private McpContext $context,
        private McpBoard $presentBoard,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'team_id' => $schema->string()->description('The team id (UUID).')->required(),
            'since' => $schema->string()->format('date')->description('Only boards created on or after this date (YYYY-MM-DD).'),
            'until' => $schema->string()->format('date')->description('Only boards created on or before this date (YYYY-MM-DD).'),
            'finished_only' => $schema->boolean()->description('Only finished (completed) boards.')->default(false),
            'limit' => $schema->integer()->min(1)->max(50)->default(self::DefaultLimit),
            'page' => $schema->integer()->min(1)->default(1),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'team_id' => ['required', 'uuid'],
            'since' => ['nullable', 'date_format:Y-m-d'],
            'until' => ['nullable', 'date_format:Y-m-d'],
            'finished_only' => ['nullable', 'boolean'],
            ...$this->paginationRules(),
        ]);

        $team = $this->context->team($validated['team_id']);

        $query = McpBoard::withCounts(Retro::query())
            ->where('team_id', $team->id)
            ->when($validated['since'] ?? null, fn ($query, string $since) => $query->whereDate('created_at', '>=', $since))
            ->when($validated['until'] ?? null, fn ($query, string $until) => $query->whereDate('created_at', '<=', $until))
            ->when($validated['finished_only'] ?? false, fn ($query) => $query->where('phase', RetroPhase::Completed))
            ->latest()
            ->orderByDesc('id');

        [$page, $limit] = $this->pagination($validated);

        return Response::structured($this->paginate(
            $query,
            $page,
            $limit,
            fn (Retro $retro) => $this->presentBoard->handle($retro),
        ));
    }
}
