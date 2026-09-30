<?php

namespace App\Actions\Games;

use App\Enums\GameRoundOutcome;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;

/**
 * Leaving the Icebreaker phase ends the active round without points
 * (spec §6). Runs inside the phase change transaction, retro locked; the
 * room and round are locked after it, never before.
 */
class AbandonIcebreakerRound
{
    public function __construct(private EndGameRound $endGameRound) {}

    public function handle(Retro $lockedRetro): void
    {
        $room = GameRoom::query()->where('retro_id', $lockedRetro->id)->lockForUpdate()->first();

        if ($room === null || $room->current_round_id === null) {
            return;
        }

        $round = GameRound::query()->whereKey($room->current_round_id)->lockForUpdate()->first();

        if ($round === null || ! $round->isActive()) {
            return;
        }

        $room->setRelation('retro', $lockedRetro);

        $this->endGameRound->handle($room, $round, GameRoundOutcome::Abandoned);
    }
}
