<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameRoundRevealed extends GameBroadcastEvent
{
    /**
     * @param  array{roundId: string, revealedAt: string, answers: array<int, array<string, mixed>>, candidates?: array<int, string>}  $payload
     */
    public function __construct(GameRoom $room, public array $payload)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.round.revealed';
    }

    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
