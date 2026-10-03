<?php

namespace App\Jobs;

use App\Actions\Games\LockGameRound;
use App\Actions\Games\RevealHintLetter;
use App\Models\GameRound;
use App\Support\Games\WordGuessRules;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

class RevealAutoHint implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $roundId, public int $hint) {}

    /**
     * The job stands for the n-th letter of one round: the leader's button
     * may have shown it already, and an ended round takes no more letters.
     */
    public function handle(RevealHintLetter $revealHintLetter): void
    {
        $round = GameRound::query()->with('room')->find($this->roundId);

        if ($round === null || ! $round->isActive() || $round->hint_seconds === null) {
            return;
        }

        DB::transaction(function () use ($round, $revealHintLetter): void {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($round->room, $round);

            if ($lockedRoom->current_round_id !== $lockedRound->id || ! $lockedRound->isActive()) {
                return;
            }

            $shown = count($lockedRound->revealed_positions);

            if ($shown >= $this->hint || $shown >= WordGuessRules::maxHints((string) $lockedRound->word)) {
                return;
            }

            $revealHintLetter->handle($lockedRoom, $lockedRound);
        });
    }
}
