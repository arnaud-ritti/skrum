<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemRules;
use App\Actions\ActionItems\ApplyActionItemChanges;
use App\Actions\ActionItems\WorkspaceActionItemGuard;
use App\Actions\Retros\RetroGuard;
use App\Enums\ActionItemPriority;
use App\Enums\ActionItemRecurrence;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Mcp\McpContext;
use App\Mcp\McpGrant;
use App\Mcp\Presenters\McpActionItem;
use App\Mcp\Tools\SkrumTool;
use App\Models\ActionItem;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsOpenWorld(false)]
class UpdateAction extends SkrumTool
{
    protected string $name = 'retro.actions.update';

    protected string $description = 'Update an action item: content, priority, due date, recurrence or assignee. Only its author, the retrospective\'s facilitator or a workspace admin can change it. Guests can be assigned only while the item\'s board is in the Discussing phase. Sub-tasks cannot be changed here.';

    public function __construct(
        private McpContext $context,
        private ApplyActionItemChanges $applyActionItemChanges,
        private McpActionItem $presentActionItem,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'action_id' => $schema->string()->format('uuid')->required(),
            'content' => $schema->string()->min(1)->max(500),
            'priority' => $schema->string()->enum(array_column(ActionItemPriority::cases(), 'value')),
            'due_on' => $schema->string()->format('date')->nullable()->description('YYYY-MM-DD, or null to clear.'),
            'recurrence' => $schema->string()->enum(array_column(ActionItemRecurrence::cases(), 'value'))->nullable()->description('Repeat after completion; needs a due date. Null stops repeating.'),
            'assignee_user_id' => $schema->string()->format('uuid')->nullable()->description('A team member, or null to unassign.'),
            'assignee_participant_id' => $schema->string()->format('uuid')->description('A guest of the item\'s board (board in Discussing only).'),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = Arr::except($request->validate([
            'action_id' => ['required', 'uuid'],
            ...ActionItemRules::update(allowsGuests: true),
        ], ActionItemRules::messages()), ['action_id', 'status']);

        $item = $this->context->actionItem((string) $request->get('action_id'));
        $actor = new ActionItemActor(McpGrant::current()->user, $item->retro === null ? null : $this->context->participant($item->retro));

        $updated = DB::transaction(function () use ($item, $actor, $validated): ActionItem {
            $locked = WorkspaceActionItemGuard::lockWritable($item->id);

            if (($validated['assignee_participant_id'] ?? null) !== null) {
                $this->ensureGuestAssignable($locked);
            }

            return $this->applyActionItemChanges->handle($locked, $actor, $validated);
        });

        return Response::structured($this->presentActionItem->handle($updated, McpGrant::current()->user));
    }

    /**
     * The UI offers guest assignees only on the board during Discussing.
     */
    private function ensureGuestAssignable(ActionItem $locked): void
    {
        $retro = $locked->retro;

        if ($retro === null) {
            throw ValidationException::withMessages(['assignee_participant_id' => __('Guests can only be assigned from their own retrospective.')]);
        }

        RetroGuard::phase($retro, RetroPhase::Discussing);
        RetroGuard::unlocked($retro);
    }
}
