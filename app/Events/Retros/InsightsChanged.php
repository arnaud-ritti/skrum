<?php

namespace App\Events\Retros;

class InsightsChanged extends RetroBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'insights.changed';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
