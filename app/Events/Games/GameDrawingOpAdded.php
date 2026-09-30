<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameDrawingOpAdded extends GameBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $op
     */
    public function __construct(GameRoom $room, public string $roundId, public array $op, public string $clientOpId, public int $count)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.drawing.op-added';
    }

    public function broadcastWith(): array
    {
        return ['roundId' => $this->roundId, 'op' => $this->op, 'clientOpId' => $this->clientOpId, 'count' => $this->count];
    }
}
