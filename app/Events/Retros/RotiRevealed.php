<?php

namespace App\Events\Retros;

class RotiRevealed extends RetroBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'roti.revealed';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
