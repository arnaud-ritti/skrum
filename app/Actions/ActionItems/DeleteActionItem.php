<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;

class DeleteActionItem
{
    public function __construct(
        private ActionItemPermissions $permissions,
        private BroadcastActionItemChange $broadcastActionItemChange,
    ) {}

    public function handle(ActionItem $locked, ActionItemActor $actor): void
    {
        $this->permissions->authorizeDelete($locked, $actor);

        $locked->loadMissing('retro');
        $locked->delete();

        $this->broadcastActionItemChange->deleted($locked);
    }
}
