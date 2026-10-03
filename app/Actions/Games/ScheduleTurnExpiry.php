<?php

namespace App\Actions\Games;

use App\Jobs\CloseExpiredGameTurn;
use App\Models\GameRound;

class ScheduleTurnExpiry
{
    public function handle(GameRound $round): void
    {
        $endsAt = $round->turn_ends_at;

        if ($endsAt === null || ! $endsAt->isFuture() || ! $round->isActive()) {
            return;
        }

        dispatch(new CloseExpiredGameTurn($round->id, $endsAt->toIso8601String()))
            ->delay($endsAt)
            ->afterCommit();
    }
}
