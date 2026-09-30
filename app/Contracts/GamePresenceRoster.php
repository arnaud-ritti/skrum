<?php

namespace App\Contracts;

use App\Models\GameRoom;

interface GamePresenceRoster
{
    /**
     * The presence ids on the room's channel, or null when they cannot be read.
     *
     * @return array<int, string>|null
     */
    public function presenceIds(GameRoom $room): ?array;
}
