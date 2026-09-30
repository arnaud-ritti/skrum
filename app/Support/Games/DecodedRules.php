<?php

namespace App\Support\Games;

use App\Enums\GameKind;
use App\Models\GameRound;

class DecodedRules extends WordGuessRules
{
    public function kind(): GameKind
    {
        return GameKind::Decoded;
    }

    protected function drawableOnly(): bool
    {
        return false;
    }

    protected function board(GameRound $round): array
    {
        return ['clue' => $round->clue];
    }
}
