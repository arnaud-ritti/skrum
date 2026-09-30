<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\SuggestedAction;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\ValidationException;

class SuggestionGuard
{
    /**
     * While discussing, whoever may create action items; once completed,
     * only the facilitator and workspace Owners/Admins.
     */
    public function allows(Retro $retro, Participant $participant): bool
    {
        if ($retro->phase === RetroPhase::Discussing) {
            return ! $retro->is_locked;
        }

        if ($retro->phase !== RetroPhase::Completed) {
            return false;
        }

        if ($retro->isFacilitator($participant)) {
            return true;
        }

        return $participant->user?->canManage($retro->team->workspace) ?? false;
    }

    public function authorize(Retro $retro, Participant $participant): void
    {
        RetroGuard::phase($retro, RetroPhase::Discussing, RetroPhase::Completed);

        if ($retro->phase === RetroPhase::Discussing) {
            RetroGuard::unlocked($retro);
        }

        if (! $this->allows($retro, $participant)) {
            throw new AuthorizationException(__('Only the facilitator can do this.'));
        }
    }

    public function pending(SuggestedAction $suggestion): void
    {
        if ($suggestion->isPending()) {
            return;
        }

        throw ValidationException::withMessages(['suggestion' => __('This suggestion was already handled.')]);
    }
}
