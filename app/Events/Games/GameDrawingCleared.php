<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameDrawingCleared extends GameBroadcastEvent
{
    public function __construct(GameRoom $room, public string $roundId)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.drawing.cleared';
    }

    public function broadcastWith(): array
    {
        return ['roundId' => $this->roundId, 'count' => 0];
    }
}
