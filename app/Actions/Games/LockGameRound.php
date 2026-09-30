<?php

namespace App\Actions\Games;

use App\Models\GameRoom;
use App\Models\GameRound;

class LockGameRound
{
    /**
     * Room first, then round: the order every round mutation uses, so two
     * requests never wait on each other's rows crosswise.
     *
     * @return array{0: GameRoom, 1: GameRound}
     */
    public static function handle(GameRoom $room, GameRound $round): array
    {
        $lockedRoom = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();
        $lockedRound = GameRound::query()->whereKey($round->id)->lockForUpdate()->firstOrFail();

        return [$lockedRoom, $lockedRound];
    }
}
