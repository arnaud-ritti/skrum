<?php

namespace App\Actions\Retros;

use App\Actions\ActionItems\CreateActionItem;
use App\Enums\RetroPhase;
use App\Enums\SuggestedActionStatus;
use App\Events\Retros\ActionItemSaved;
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
        private PresentActionItem $presentActionItem,
    ) {}

    /**
     * Allowed in Completed too: this is the one way an action item is
     * added to a completed retro.
     */
    public function handle(Retro $locked, SuggestedAction $suggestion, Participant $actor): ActionItem
    {
        $this->suggestionGuard->authorize($locked, $actor);
        $this->suggestionGuard->pending($suggestion);

        $actionItem = $this->createActionItem->handle($locked, $actor, $suggestion->content, null, $suggestion->theme);

        $suggestion->update([
            'status' => SuggestedActionStatus::Promoted,
            'action_item_id' => $actionItem->id,
            'handled_by_participant_id' => $actor->id,
            'handled_at' => now(),
        ]);

        if ($locked->phase !== RetroPhase::Completed) {
            (new ActionItemSaved($locked->id, $this->presentActionItem->handle($actionItem)))->sendToOthers();
        }

        (new InsightsChanged($locked->id))->sendToOthers();

        return $actionItem;
    }
}
