<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameWordFound extends GameBroadcastEvent
{
    /**
     * @param  array{roundId: string, playerId: string, seconds: int, points: int}  $payload
     */
    public function __construct(GameRoom $room, public array $payload)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.word.found';
    }

    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
