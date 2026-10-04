<?php

namespace App\Actions\Retros;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\CreateActionItem;
use App\Enums\SuggestedActionStatus;
use App\Events\Retros\InsightsChanged;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\SuggestedAction;

class PromoteSuggestedAction
{
    public function __construct(
        private SuggestionGuard $suggestionGuard,
        private CreateActionItem $createActionItem,
    ) {}

    /**
     * Allowed in Completed too: this is the one way an action item is
     * added to a completed retro.
     */
    public function handle(Retro $locked, SuggestedAction $suggestion, Participant $actor): ActionItem
    {
        $this->suggestionGuard->authorize($locked, $actor);
        $this->suggestionGuard->pending($suggestion);

        $actionItem = $this->createActionItem->handle(
            $locked->team,
            $locked,
            ActionItemActor::forParticipant($actor),
            ['content' => $suggestion->content],
            $suggestion->theme,
        );

        $suggestion->update([
            'status' => SuggestedActionStatus::Promoted,
            'action_item_id' => $actionItem->id,
            'handled_by_participant_id' => $actor->id,
            'handled_at' => now(),
        ]);

        new InsightsChanged($locked->id)->sendToOthers();

        return $actionItem;
    }
}
