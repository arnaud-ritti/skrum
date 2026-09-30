<?php

namespace App\Events\Retros;

class ResultsChanged extends RetroBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'results.changed';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
