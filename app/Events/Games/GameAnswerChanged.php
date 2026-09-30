<?php

namespace App\Events\Games;

use App\Models\GameRoom;

/**
 * Only whether a player answered: the GIF itself stays secret until the reveal.
 */
class GameAnswerChanged extends GameBroadcastEvent
{
    public function __construct(GameRoom $room, public string $roundId, public string $playerId, public bool $answered)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.answer.changed';
    }

    public function broadcastWith(): array
    {
        return ['roundId' => $this->roundId, 'playerId' => $this->playerId, 'answered' => $this->answered];
    }
}
