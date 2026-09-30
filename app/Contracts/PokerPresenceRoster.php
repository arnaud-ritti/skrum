<?php

namespace App\Contracts;

use App\Models\PokerGame;

interface PokerPresenceRoster
{
    /**
     * The player ids present on the game's presence channel, or null when
     * they cannot be read.
     *
     * @return array<int, string>|null
     */
    public function playerIds(PokerGame $game): ?array;
}
