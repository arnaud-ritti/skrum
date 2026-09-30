<?php

namespace App\Actions\Games;

use App\Enums\RetroPhase;
use App\Models\GameRoom;
use App\Models\Retro;

/**
 * The board timer is the icebreaker's game timer (spec §5): a new end time
 * schedules the expiry job of the active round, as the room timer does.
 */
class ScheduleIcebreakerExpiry
{
    public function __construct(private ScheduleRoundExpiry $scheduleRoundExpiry) {}

    public function handle(Retro $lockedRetro): void
    {
        if ($lockedRetro->phase !== RetroPhase::Icebreaker) {
            return;
        }

        $room = GameRoom::query()->where('retro_id', $lockedRetro->id)->first();

        if ($room === null) {
            return;
        }

        $room->setRelation('retro', $lockedRetro);

        $round = $room->activeRound();

        if ($round === null) {
            return;
        }

        $this->scheduleRoundExpiry->handle($room, $round);
    }
}
