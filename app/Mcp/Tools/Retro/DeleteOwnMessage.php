<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\Retros\DeleteCard;
use App\Enums\McpScope;
use App\Mcp\Concerns\FindsOwnMessage;
use App\Mcp\McpContext;
use App\Mcp\Tools\SkrumTool;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;

#[IsDestructive]
#[IsOpenWorld(false)]
class DeleteOwnMessage extends SkrumTool
{
    use FindsOwnMessage;

    protected string $name = 'retro.board.messages.delete_own';

    protected string $description = 'Delete one of your own messages (cards) while the board still allows editing (Writing or Grouping phase, not locked). Cards grouped under it are ungrouped. This cannot be undone.';

    public function __construct(
        private McpContext $context,
        private DeleteCard $deleteCard,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'message_id' => $schema->string()->format('uuid')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Delete;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate(['message_id' => ['required', 'uuid']]);

        [$card, $retro, $participant] = $this->ownMessage($this->context, (string) $validated['message_id']);

        $this->deleteCard->handle($retro, $card, $participant);

        return Response::structured(['deleted' => true]);
    }
}
