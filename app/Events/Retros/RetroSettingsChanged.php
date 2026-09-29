<?php

namespace App\Events\Retros;

class RetroSettingsChanged extends RetroBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'settings.changed';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
