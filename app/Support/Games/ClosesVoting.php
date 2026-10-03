<?php

namespace App\Support\Games;

use App\Enums\GameRoundOutcome;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;

interface ClosesVoting
{
    /**
     * Ends a voting stage: the outcome to end the round with. Throws 403 / 409 itself.
     */
    public function close(GameRoom $lockedRoom, GameRound $lockedRound, GamePlayer $actor): GameRoundOutcome;
}
