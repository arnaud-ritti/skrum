<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameRoundEnded extends GameBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(GameRoom $room, public array $payload)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.round.ended';
    }

    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
