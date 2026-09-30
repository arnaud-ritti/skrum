<?php

namespace App\Events\Poker;

class PokerRoundChanged extends PokerBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'round.changed';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
