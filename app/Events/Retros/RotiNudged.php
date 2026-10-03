<?php

namespace App\Events\Retros;

class RotiNudged extends RetroBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'roti.nudged';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
