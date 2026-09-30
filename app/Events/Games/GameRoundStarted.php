<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameRoundStarted extends GameBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $round  the public view of the round, never the word
     */
    public function __construct(GameRoom $room, public array $round)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.round.started';
    }

    public function broadcastWith(): array
    {
        return ['round' => $this->round];
    }
}
