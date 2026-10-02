<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\SuggestedAction;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\ValidationException;

class SuggestionGuard
{
    /**
     * While the board takes action items, whoever may create them; once completed,
     * only the facilitator and workspace Owners/Admins.
     */
    public function allows(Retro $retro, Participant $participant): bool
    {
        return $this->allowsUser($retro, $participant->user, $participant);
    }

    public function authorize(Retro $retro, Participant $participant): void
    {
        $this->authorizeUser($retro, $participant->user, $participant);
    }

    /**
     * For callers that create the participant only after the check passed:
     * a user who has not joined yet is never the facilitator.
     */
    public function authorizeUser(Retro $retro, ?User $user, ?Participant $existing): void
    {
        RetroGuard::phase($retro, RetroPhase::Discussing, RetroPhase::Actions, RetroPhase::Roti, RetroPhase::Completed);

        if ($retro->phase->takesActionItems()) {
            RetroGuard::unlocked($retro);
        }

        if (! $this->allowsUser($retro, $user, $existing)) {
            throw new AuthorizationException(__('Only the facilitator can do this.'));
        }
    }

    private function allowsUser(Retro $retro, ?User $user, ?Participant $participant): bool
    {
        if ($retro->phase->takesActionItems()) {
            return ! $retro->is_locked;
        }

        if ($retro->phase !== RetroPhase::Completed) {
            return false;
        }

        if ($participant !== null && $retro->isFacilitator($participant)) {
            return true;
        }

        return $user?->canManage($retro->team->workspace) ?? false;
    }

    public function pending(SuggestedAction $suggestion): void
    {
        if ($suggestion->isPending()) {
            return;
        }

        throw ValidationException::withMessages(['suggestion' => __('This suggestion was already handled.')]);
    }
}
