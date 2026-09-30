<?php

namespace App\Actions\Retros;

use App\Enums\SuggestedActionStatus;
use App\Events\Retros\InsightsChanged;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\SuggestedAction;

class RejectSuggestedAction
{
    public function __construct(private SuggestionGuard $suggestionGuard) {}

    public function handle(Retro $locked, SuggestedAction $suggestion, Participant $actor): void
    {
        $this->suggestionGuard->authorize($locked, $actor);
        $this->suggestionGuard->pending($suggestion);

        $suggestion->update([
            'status' => SuggestedActionStatus::Rejected,
            'handled_by_participant_id' => $actor->id,
            'handled_at' => now(),
        ]);

        (new InsightsChanged($locked->id))->sendToOthers();
    }
}
