<?php

namespace App\Actions\Poker;

use App\Jobs\RevealPokerRoundOnTimer;
use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerTask;

class StartPokerRound
{
    /**
     * Runs inside the caller's transaction, on a game row locked for update.
     * A game with a task timer starts the round's timer at once, in whole
     * seconds, and its expiry behaves as the facilitator's timer does.
     */
    public function handle(PokerGame $locked, PokerTask $task): PokerRound
    {
        $timerEndsAt = $locked->task_timer_seconds === null
            ? null
            : now()->addSeconds($locked->task_timer_seconds)->startOfSecond();

        $round = $task->rounds()->create([
            'number' => (int) $task->rounds()->max('number') + 1,
            'anonymous' => $locked->anonymous_votes,
            'timer_ends_at' => $timerEndsAt,
        ]);

        if ($timerEndsAt !== null) {
            dispatch(new RevealPokerRoundOnTimer($round->id, $timerEndsAt->toIso8601String()))
                ->delay($timerEndsAt)
                ->afterCommit();
        }

        return $round;
    }
}
