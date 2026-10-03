<?php

namespace App\Actions\Games;

use App\Models\GameRoom;
use App\Models\GameRound;

/**
 * Spec §6.4: a round continues the game of the previous one when it is the
 * same game, numbered, and that game is not over by the previous round's
 * total or by the room's current one.
 */
class NumberGameRound
{
    /**
     * @return array{number: int, total: ?int}
     */
    public function handle(GameRoom $lockedRoom): array
    {
        $total = $lockedRoom->rounds_per_game;

        $previous = GameRound::query()
            ->where('game_room_id', $lockedRoom->id)
            ->latest('started_at')
            ->orderByDesc('id')
            ->first();

        if ($previous === null || $previous->game !== $lockedRoom->game || $previous->number === null) {
            return ['number' => 1, 'total' => $total];
        }

        if ($previous->rounds_total !== null && $previous->number >= $previous->rounds_total) {
            return ['number' => 1, 'total' => $total];
        }

        if ($total !== null && $previous->number >= $total) {
            return ['number' => 1, 'total' => $total];
        }

        return ['number' => $previous->number + 1, 'total' => $total];
    }
}
