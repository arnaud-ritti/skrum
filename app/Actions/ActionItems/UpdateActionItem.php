<?php

namespace App\Actions\ActionItems;

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
     * @param  bool  $announces  false when a status change that announces the item follows
     */
    public function handle(ActionItem $locked, ActionItemActor $actor, array $changes, bool $announces = true): ActionItem
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

        $locked->save();

        if ($announces) {
            $this->broadcastActionItemChange->saved($locked);
        }

        return $locked;
    }
}
