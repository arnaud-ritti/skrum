<?php

namespace App\Events\Whiteboards;

class WhiteboardChanged extends WhiteboardBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'board.changed';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
