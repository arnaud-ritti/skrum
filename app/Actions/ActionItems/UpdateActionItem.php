<?php

namespace App\Actions\ActionItems;

use App\Events\ActionItems\ActionItemAssigned;
use App\Models\ActionItem;
use Illuminate\Validation\ValidationException;

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
        $locked->fill($changes);

        if (! $locked->isDirty()) {
            return $locked->loadForPresentation();
        }

        $this->permissions->authorizeEdit($locked, $actor);

        if ($locked->recurrence !== null && $locked->due_on === null) {
            throw ValidationException::withMessages([
                array_key_exists('due_on', $changes) ? 'due_on' : 'recurrence' => __('A recurring action item needs a due date.'),
            ]);
        }

        $assigneeChanged = $locked->isDirty(['assignee_user_id', 'assignee_participant_id']);

        $locked->save();

        if ($assigneeChanged && ($locked->assignee_user_id !== null || $locked->assignee_participant_id !== null)) {
            event(new ActionItemAssigned($locked));
        }

        $this->broadcastActionItemChange->saved($locked);

        return $locked;
    }
}
