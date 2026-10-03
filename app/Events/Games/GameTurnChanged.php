<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameTurnChanged extends GameBroadcastEvent
{
    /**
     * @param  array{roundId: string, turnPlayerId: ?string, turnEndsAt: ?string}  $payload
     */
    public function __construct(GameRoom $room, public array $payload)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.turn.changed';
    }

    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
