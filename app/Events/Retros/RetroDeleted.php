<?php

namespace App\Events\Retros;

class RetroDeleted extends RetroBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'retro.deleted';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
