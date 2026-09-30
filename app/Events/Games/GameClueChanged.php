<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameClueChanged extends GameBroadcastEvent
{
    /**
     * @param  array<int, string>  $clue
     */
    public function __construct(GameRoom $room, public string $roundId, public array $clue)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.clue.changed';
    }

    public function broadcastWith(): array
    {
        return ['roundId' => $this->roundId, 'clue' => $this->clue];
    }
}
