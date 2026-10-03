<?php

namespace App\Support\Games;

use App\Models\GameRoom;
use App\Models\GameRound;

interface AsksQuestions
{
    /**
     * @return array<int, string> the questions of the room's locale
     */
    public function questions(GameRoom $room): array;

    public function questionLocked(GameRound $round): bool;
}
