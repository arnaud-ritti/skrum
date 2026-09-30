<?php

namespace App\Events\Poker;

class PokerTimerChanged extends PokerBroadcastEvent
{
    public function __construct(string $gameId, public string $roundId, public ?string $timerEndsAt)
    {
        parent::__construct($gameId);
    }

    public function broadcastAs(): string
    {
        return 'timer.changed';
    }

    public function broadcastWith(): array
    {
        return ['roundId' => $this->roundId, 'timerEndsAt' => $this->timerEndsAt];
    }
}
