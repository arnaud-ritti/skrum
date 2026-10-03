<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameWordChanged extends GameBroadcastEvent
{
    /**
     * @param  array{roundId: string, mask: array<int, ?string>, maxHints: int}  $payload
     */
    public function __construct(GameRoom $room, public array $payload)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.word.changed';
    }

    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
