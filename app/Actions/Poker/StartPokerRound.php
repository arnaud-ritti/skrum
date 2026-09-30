<?php

namespace App\Actions\Poker;

use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerTask;

class StartPokerRound
{
    public function handle(PokerGame $locked, PokerTask $task): PokerRound
    {
        return $task->rounds()->create([
            'number' => (int) $task->rounds()->max('number') + 1,
            'anonymous' => $locked->anonymous_votes,
        ]);
    }
}
