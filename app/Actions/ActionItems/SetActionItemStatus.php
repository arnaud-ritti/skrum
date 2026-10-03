<?php

namespace App\Actions\ActionItems;

use App\Actions\Teams\RecordTeamActivity;
use App\Enums\ActionItemEventOrigin;
use App\Enums\ActionItemStatus;
use App\Enums\IntegrationProvider;
use App\Enums\TeamActivityKind;
use App\Events\ActionItems\ActionItemCompleted;
use App\Events\ActionItems\ActionItemProgressChanged;
use App\Events\ActionItems\ActionItemReopened;
use App\Models\ActionItem;

class SetActionItemStatus
{
    public function __construct(
        private ActionItemPermissions $permissions,
        private CreateNextOccurrence $createNextOccurrence,
        private MarkActionItemRemindersRead $markActionItemRemindersRead,
        private BroadcastActionItemChange $broadcastActionItemChange,
        private RecordTeamActivity $recordTeamActivity,
    ) {}

    /**
     * Setting the current status again changes and announces nothing. Completion and
     * reopening keep their events; starting and stopping fire ActionItemProgressChanged.
     */
    public function handle(ActionItem $locked, ActionItemActor|ExternalSyncActor $actor, ActionItemStatus $status): ActionItem
    {
        if ($actor instanceof ActionItemActor) {
            $this->permissions->authorizeComplete($locked, $actor);
        }

        if ($locked->currentStatus() === $status) {
            return $locked->loadForPresentation();
        }

        $wasCompleted = $locked->isCompleted();
        $completing = $status === ActionItemStatus::Completed;

        $locked->forceFill([
            'completed_at' => $completing ? now() : null,
            'completed_via_source' => $completing && $actor instanceof ExternalSyncActor ? $actor->source : null,
            'started_at' => match ($status) {
                ActionItemStatus::Open => null,
                ActionItemStatus::Doing => $locked->started_at ?? now(),
                ActionItemStatus::Completed => $locked->started_at,
            },
        ])->save();

        if ($completing) {
            $this->createNextOccurrence->handle($locked);
            $this->markActionItemRemindersRead->handle($locked);
            $this->recordCompletion($locked, $actor);
        }

        $origin = $actor instanceof ExternalSyncActor ? ActionItemEventOrigin::External : ActionItemEventOrigin::Skrum;

        if ($completing) {
            event(new ActionItemCompleted($locked, $origin, $actor));
        }

        if ($wasCompleted && ! $completing) {
            event(new ActionItemReopened($locked, $origin, $actor));
        }

        if (! $wasCompleted && ! $completing) {
            event(new ActionItemProgressChanged($locked, $origin, $actor));
        }

        $this->broadcastActionItemChange->saved($locked);

        return $locked;
    }

    private function recordCompletion(ActionItem $item, ActionItemActor|ExternalSyncActor $actor): void
    {
        if ($actor instanceof ExternalSyncActor) {
            $this->recordTeamActivity->handle($item->team_id, TeamActivityKind::ActionItemCompleted, null, IntegrationProvider::tryFrom($actor->source)?->label() ?? $actor->source, $item->id, $item->content);

            return;
        }

        $guestName = $actor->user === null ? $actor->participant?->displayName() : null;

        $this->recordTeamActivity->handle($item->team_id, TeamActivityKind::ActionItemCompleted, $actor->user, $guestName, $item->id, $item->content);
    }
}
