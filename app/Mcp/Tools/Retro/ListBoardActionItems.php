<?php

namespace App\Mcp\Tools\Retro;

use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\McpGrant;
use App\Mcp\Presenters\McpActionItem;
use App\Mcp\Tools\SkrumTool;
use App\Models\ActionItem;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class ListBoardActionItems extends SkrumTool
{
    protected string $name = 'retro.board.actions.list';

    protected string $description = 'List the action items (agreements) decided on one board, in the order they were added, with status, priority and assignee. Action items are always named, also on anonymous boards.';

    public function __construct(
        private McpContext $context,
        private McpActionItem $presentActionItem,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'board_id' => $schema->string()->description('The board id (UUID).')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate(['board_id' => ['required', 'uuid']]);
        $retro = $this->context->retro($validated['board_id']);
        $viewer = McpGrant::current()->user;

        $items = $retro->actionItems()
            ->with(McpActionItem::relations())
            ->withCount('comments')->oldest()
            ->orderBy('id')
            ->get();

        return Response::structured([
            'items' => $items->map(fn (ActionItem $item): array => $this->presentActionItem->handle($item, $viewer))->values()->all(),
        ]);
    }
}
