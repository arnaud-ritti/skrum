<?php

namespace App\Events\Poker;

class PokerGameChanged extends PokerBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'game.changed';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
