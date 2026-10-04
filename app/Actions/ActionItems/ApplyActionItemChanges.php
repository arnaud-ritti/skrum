<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemStatus;
use App\Models\ActionItem;

/**
 * One PATCH from the board or the workspace: field changes need edit
 * rights, a status change needs completion rights.
 */
class ApplyActionItemChanges
{
    public function __construct(
        private ResolveActionItemAssignee $resolveActionItemAssignee,
        private UpdateActionItem $updateActionItem,
        private SetActionItemStatus $setActionItemStatus,
        private ActionItemPermissions $permissions,
    ) {}

    /**
     * @param  array<string, mixed>  $validated  the output of ActionItemRules::update()
     */
    public function handle(ActionItem $locked, ActionItemActor $actor, array $validated): ActionItem
    {
        if ($this->touchesFields($locked, $validated)) {
            $this->permissions->authorizeEdit($locked, $actor);
        }

        $changes = [
            ...ActionItemRules::attributes($validated),
            ...($this->resolveActionItemAssignee->handle($locked->team, $locked->retro, $validated, $locked) ?? []),
        ];

        $status = array_key_exists('status', $validated) ? ActionItemStatus::from((string) $validated['status']) : null;

        if ($changes !== []) {
            $locked = $this->updateActionItem->handle($locked, $actor, $changes, announces: $status === null || $status === $locked->currentStatus());
        }

        if ($status !== null) {
            return $this->setActionItemStatus->handle($locked, $actor, $status);
        }

        return $locked->loadForPresentation();
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function touchesFields(ActionItem $item, array $validated): bool
    {
        $probe = clone $item;
        $probe->fill(ActionItemRules::attributes($validated));

        if ($probe->isDirty()) {
            return true;
        }

        if (array_key_exists('assignee_user_id', $validated) && ($validated['assignee_user_id'] ?? null) !== $item->assignee_user_id) {
            return true;
        }

        return array_key_exists('assignee_participant_id', $validated) && ($validated['assignee_participant_id'] ?? null) !== $item->assignee_participant_id;
    }
}
