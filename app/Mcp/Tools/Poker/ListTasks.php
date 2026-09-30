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
class ListTasks extends SkrumTool
{
    protected string $name = 'poker.game.tasks.list';

    protected string $description = 'List the tasks of a planning poker game in order, with their estimate and latest round. Before a round is revealed only who voted is shown (and your own card); in anonymous rounds values appear only in the result distribution.';

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

        return Response::structured(['items' => $this->presentGame->tasks($game, $this->context->pokerPlayer($game))]);
    }
}
