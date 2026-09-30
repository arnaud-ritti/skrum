<?php

namespace App\Events\Poker;

class PokerGameDeleted extends PokerBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'game.deleted';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
