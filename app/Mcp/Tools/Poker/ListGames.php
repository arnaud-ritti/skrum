<?php

namespace App\Mcp\Tools\Poker;

use App\Actions\Poker\PresentPokerGameSummary;
use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\Presenters\McpPokerGame;
use App\Mcp\Tools\SkrumTool;
use App\Models\PokerGame;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class ListGames extends SkrumTool
{
    protected string $name = 'poker.games.list';

    protected string $description = 'List a team\'s planning poker games, newest first, with their task, estimate and point counts.';

    public function __construct(
        private McpContext $context,
        private McpPokerGame $presentGame,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'team_id' => $schema->string()->format('uuid')->required(),
            'status' => $schema->string()->enum(['active', 'ended', 'all'])->default('active'),
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
            'status' => ['sometimes', 'in:active,ended,all'],
            ...$this->paginationRules(),
        ]);

        $team = $this->context->team((string) $validated['team_id']);
        $status = $validated['status'] ?? 'active';
        [$page, $limit] = $this->pagination($validated);

        $query = PresentPokerGameSummary::withCounts(PokerGame::query()->where('team_id', $team->id))
            ->when($status === 'active', fn ($query) => $query->whereNull('ended_at'))
            ->when($status === 'ended', fn ($query) => $query->whereNotNull('ended_at'))
            ->latest('created_at')
            ->latest('id');

        return Response::structured($this->paginate(
            $query,
            $page,
            $limit,
            fn (PokerGame $game): array => $this->presentGame->summary($game),
        ));
    }
}
