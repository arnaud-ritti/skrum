<?php

namespace App\Support\Games;

use App\Enums\GameKind;
use App\Models\GameRound;

class DrawAndGuessRules extends WordGuessRules
{
    public function kind(): GameKind
    {
        return GameKind::DrawAndGuess;
    }

    protected function drawableOnly(): bool
    {
        return true;
    }

    protected function board(GameRound $round): array
    {
        return ['drawing' => $round->drawing];
    }
}
