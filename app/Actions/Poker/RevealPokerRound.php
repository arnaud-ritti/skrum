<?php

namespace App\Actions\Poker;

use App\Enums\PokerRevealReason;
use App\Events\Poker\PokerRoundChanged;
use App\Models\PokerGame;
use App\Models\PokerRound;
use Illuminate\Validation\ValidationException;

class RevealPokerRound
{
    public function handle(PokerGame $locked, PokerRound $lockedRound, PokerRevealReason $reason): void
    {
        PokerGuard::openRound($locked, $lockedRound);

        if (! $lockedRound->votes()->exists()) {
            throw ValidationException::withMessages(['round' => __('Nobody has voted yet.')]);
        }

        $lockedRound->update([
            'revealed_at' => now(),
            'reveal_reason' => $reason,
        ]);

        new PokerRoundChanged($locked->id)->sendToOthers();
    }
}
