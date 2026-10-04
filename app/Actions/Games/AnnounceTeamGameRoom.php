<?php

namespace App\Actions\Games;

use App\Events\Games\TeamGameRoomChanged;
use App\Events\Games\TeamGameRoomDeleted;
use App\Models\GameRoom;

class AnnounceTeamGameRoom
{
    public function __construct(private PresentGameRoomSummary $presentGameRoomSummary) {}

    /**
     * Reloads the room's summary and sends it to the team's games channel. Does nothing for an icebreaker room.
     */
    public function changed(GameRoom $room): void
    {
        if ($room->isIcebreaker()) {
            return;
        }

        $summarized = PresentGameRoomSummary::query($room->team)->whereKey($room->id)->first();

        if ($summarized === null) {
            return;
        }

        new TeamGameRoomChanged($room->team_id, $this->presentGameRoomSummary->handle($summarized))->sendToOthers();
    }

    public function deleted(GameRoom $room): void
    {
        if ($room->isIcebreaker()) {
            return;
        }

        new TeamGameRoomDeleted($room->team_id, $room->id)->sendToOthers();
    }
}
