<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\SetActionItemStatus;
use App\Actions\ActionItems\WorkspaceActionItemGuard;
use App\Enums\ActionItemStatus;
use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\McpGrant;
use App\Mcp\Presenters\McpActionItem;
use App\Mcp\Tools\SkrumTool;
use App\Models\ActionItem;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsIdempotent]
#[IsOpenWorld(false)]
class CompleteAction extends SkrumTool
{
    protected string $name = 'retro.actions.complete';

    protected string $description = 'Mark an action item as done (completed: true, the default) or reopen it (completed: false). Allowed for its assignee, its author, the facilitator and workspace admins. Completing a recurring item creates its next occurrence.';

    public function __construct(
        private McpContext $context,
        private SetActionItemStatus $setActionItemStatus,
        private McpActionItem $presentActionItem,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'action_id' => $schema->string()->format('uuid')->required(),
            'completed' => $schema->boolean()->default(true),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'action_id' => ['required', 'uuid'],
            'completed' => ['sometimes', 'boolean'],
        ]);

        $item = $this->context->actionItem((string) $validated['action_id']);

        $this->refuseObserver($item->team);

        $actor = new ActionItemActor(McpGrant::current()->user, $item->retro === null ? null : $this->context->participant($item->retro));
        $completing = (bool) ($validated['completed'] ?? true);

        $updated = DB::transaction(function () use ($item, $actor, $completing): ActionItem {
            $locked = WorkspaceActionItemGuard::lockWritable($item->id);

            return $this->setActionItemStatus->handle($locked, $actor, $this->targetStatus($locked, $completing));
        });

        return Response::structured($this->presentActionItem->handle($updated, McpGrant::current()->user));
    }

    /**
     * Reopening only applies to a completed item: an item in progress stays
     * in progress, as before the third status existed.
     */
    private function targetStatus(ActionItem $locked, bool $completing): ActionItemStatus
    {
        if ($completing) {
            return ActionItemStatus::Completed;
        }

        return $locked->isCompleted() ? ActionItemStatus::Open : $locked->currentStatus();
    }
}
