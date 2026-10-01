<?php

namespace App\Events\Whiteboards;

class WhiteboardDeleted extends WhiteboardBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'board.deleted';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
