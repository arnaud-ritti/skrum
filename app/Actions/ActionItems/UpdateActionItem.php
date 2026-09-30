<?php

namespace App\Actions\ActionItems;

use App\Events\ActionItems\ActionItemAssigned;
use App\Models\ActionItem;

class UpdateActionItem
{
    public function __construct(
        private ActionItemPermissions $permissions,
        private BroadcastActionItemChange $broadcastActionItemChange,
    ) {}

    /**
     * @param  array<string, mixed>  $changes  validated content, priority, due_on and a resolved assignee
     */
    public function handle(ActionItem $locked, ActionItemActor $actor, array $changes): ActionItem
    {
        $this->permissions->authorizeEdit($locked, $actor);

        $locked->fill($changes);

        if (! $locked->isDirty()) {
            return $locked->loadForPresentation();
        }

        $assigneeChanged = $locked->isDirty(['assignee_user_id', 'assignee_participant_id']);

        $locked->save();

        if ($assigneeChanged && ($locked->assignee_user_id !== null || $locked->assignee_participant_id !== null)) {
            ActionItemAssigned::dispatch($locked);
        }

        $this->broadcastActionItemChange->saved($locked);

        return $locked;
    }
}
