<?php

namespace App\Actions\Games;

use App\Jobs\CloseExpiredGameRound;
use App\Models\GameRoom;
use App\Models\GameRound;

class ScheduleRoundExpiry
{
    public function handle(GameRoom $room, GameRound $round): void
    {
        $endsAt = $room->effectiveTimerEndsAt();

        if ($endsAt === null || ! $endsAt->isFuture() || ! $round->isActive()) {
            return;
        }

        CloseExpiredGameRound::dispatch($round->id, $endsAt->toIso8601String())
            ->delay($endsAt)
            ->afterCommit();
    }
}
