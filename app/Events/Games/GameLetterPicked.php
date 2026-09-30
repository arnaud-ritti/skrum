<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameLetterPicked extends GameBroadcastEvent
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
        return 'game.letter.picked';
    }

    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
