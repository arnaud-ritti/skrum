<?php

namespace App\Support\Games;

use App\Enums\GameRoundOutcome;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;

interface RevealsInStages
{
    /**
     * The host's (or the rules' chosen actor's) reveal: null moves the round
     * to its next stage, an outcome ends it. Throws 403 / 409 itself.
     */
    public function reveal(GameRoom $lockedRoom, GameRound $lockedRound, GamePlayer $actor): ?GameRoundOutcome;
}
