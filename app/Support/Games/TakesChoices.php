<?php

namespace App\Support\Games;

use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;

interface TakesChoices
{
    /**
     * @return array<int, string> the choices this player may make now; throws 403 / 409 when they may not
     */
    public function choicesFor(GameRound $lockedRound, GamePlayer $player): array;

    /**
     * Called after a choice was made or withdrawn (not after a replacement).
     */
    public function choiceChanged(GameRoom $lockedRoom, GameRound $lockedRound, GamePlayer $player, bool $chose): void;
}
