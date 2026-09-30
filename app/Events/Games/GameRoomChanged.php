<?php

namespace App\Events\Games;

class GameRoomChanged extends GameBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'game.room.changed';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
