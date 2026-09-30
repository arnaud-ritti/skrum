<?php

namespace App\Events\Games;

class GameRoomDeleted extends GameBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'game.room.deleted';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
