<?php

namespace App\Mcp\Tools\Poker;

use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\Presenters\McpPokerGame;
use App\Mcp\Tools\SkrumTool;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class GetGame extends SkrumTool
{
    protected string $name = 'poker.game.get';

    protected string $description = 'Get a planning poker game: deck, players, the task on the table and its current round. Card values of other players are only shown once the round is revealed, and never with names in an anonymous round.';

    public function __construct(
        private McpContext $context,
        private McpPokerGame $presentGame,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'game_id' => $schema->string()->format('uuid')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate(['game_id' => ['required', 'uuid']]);

        $game = $this->context->pokerGame((string) $validated['game_id']);

        return Response::structured($this->presentGame->game($game, $this->context->pokerPlayer($game)));
    }
}
