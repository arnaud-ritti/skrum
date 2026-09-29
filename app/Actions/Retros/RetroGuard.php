<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Auth\Access\AuthorizationException;

class RetroGuard
{
    public static function phase(Retro $retro, RetroPhase ...$allowed): void
    {
        if (in_array($retro->phase, $allowed, true)) {
            return;
        }

        throw new AuthorizationException(__('This action is not available in the current phase.'));
    }

    public static function facilitator(Retro $retro, Participant $participant): void
    {
        if ($retro->isFacilitator($participant)) {
            return;
        }

        throw new AuthorizationException(__('Only the facilitator can do this.'));
    }

    public static function author(Card $card, Participant $participant): void
    {
        if ($card->participant_id === $participant->id) {
            return;
        }

        throw new AuthorizationException(__('You can only change your own cards.'));
    }
}
