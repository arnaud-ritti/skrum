<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;
use App\Models\ActionItemSubtask;

class DeleteActionItemSubtask
{
    public function __construct(
        private ActionItemPermissions $permissions,
        private RenumberActionItemSubtasks $renumberActionItemSubtasks,
        private BroadcastActionItemChange $broadcastActionItemChange,
    ) {}

    public function handle(ActionItem $locked, ActionItemSubtask $subtask, ActionItemActor $actor): ActionItem
    {
        $this->permissions->authorizeEdit($locked, $actor);

        $subtask->delete();

        $this->renumberActionItemSubtasks->compact($locked->id);

        $locked->touch();

        $this->broadcastActionItemChange->saved($locked);

        return $locked;
    }
}
