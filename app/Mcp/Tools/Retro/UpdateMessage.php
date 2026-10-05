<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\Retros\UpdateCard;
use App\Enums\McpScope;
use App\Mcp\Concerns\FindsOwnMessage;
use App\Mcp\McpContext;
use App\Mcp\Presenters\McpMessage;
use App\Mcp\Tools\SkrumTool;
use App\Models\Card;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsOpenWorld(false)]
class UpdateMessage extends SkrumTool
{
    use FindsOwnMessage;

    protected string $name = 'retro.board.messages.update';

    protected string $description = 'Change the text of one of your own messages (cards), while the board still allows editing (Writing or Grouping phase, not locked). Its GIF is kept.';

    public function __construct(
        private McpContext $context,
        private UpdateCard $updateCard,
        private McpMessage $presentMessage,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'message_id' => $schema->string()->format('uuid')->required(),
            'content' => $schema->string()->min(1)->max(Card::MaxContentLength)->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'message_id' => ['required', 'uuid'],
            'content' => ['required', 'string', 'max:'.Card::MaxContentLength],
        ]);

        [$card, $retro, $participant] = $this->ownMessage($this->context, (string) $validated['message_id']);

        $this->refuseObserver($retro->team);

        $updated = $this->updateCard->handle($retro, $card, $participant, ['content' => $validated['content']]);

        return Response::structured($this->presentMessage->presentFresh($updated, $retro, $participant));
    }
}
