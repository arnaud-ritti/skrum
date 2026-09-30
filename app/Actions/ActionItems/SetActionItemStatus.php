<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemEventOrigin;
use App\Enums\ActionItemStatus;
use App\Events\ActionItems\ActionItemCompleted;
use App\Events\ActionItems\ActionItemReopened;
use App\Models\ActionItem;

class SetActionItemStatus
{
    public function __construct(
        private ActionItemPermissions $permissions,
        private CreateNextOccurrence $createNextOccurrence,
        private BroadcastActionItemChange $broadcastActionItemChange,
    ) {}

    /**
     * Setting the current status again changes and announces nothing.
     */
    public function handle(ActionItem $locked, ActionItemActor|ExternalSyncActor $actor, ActionItemStatus $status): ActionItem
    {
        if ($actor instanceof ActionItemActor) {
            $this->permissions->authorizeComplete($locked, $actor);
        }

        $completing = $status === ActionItemStatus::Completed;

        if ($locked->isCompleted() === $completing) {
            return $locked->loadForPresentation();
        }

        $locked->update(['completed_at' => $completing ? now() : null]);

        if ($completing) {
            $this->createNextOccurrence->handle($locked);
        }

        $origin = $actor instanceof ExternalSyncActor ? ActionItemEventOrigin::External : ActionItemEventOrigin::Skrum;

        if ($completing) {
            ActionItemCompleted::dispatch($locked, $origin);
        }

        if (! $completing) {
            ActionItemReopened::dispatch($locked, $origin);
        }

        $this->broadcastActionItemChange->saved($locked);

        return $locked;
    }
}
