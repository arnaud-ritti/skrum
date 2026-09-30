<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameDrawingUndone extends GameBroadcastEvent
{
    public function __construct(GameRoom $room, public string $roundId, public int $count)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.drawing.undone';
    }

    public function broadcastWith(): array
    {
        return ['roundId' => $this->roundId, 'count' => $this->count];
    }
}
