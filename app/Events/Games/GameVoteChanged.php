<?php

namespace App\Events\Games;

use App\Models\GameRoom;

/**
 * Only whether a player voted: whom they voted for stays secret until the close.
 */
class GameVoteChanged extends GameBroadcastEvent
{
    public function __construct(GameRoom $room, public string $roundId, public string $playerId, public bool $voted)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.vote.changed';
    }

    public function broadcastWith(): array
    {
        return ['roundId' => $this->roundId, 'playerId' => $this->playerId, 'voted' => $this->voted];
    }
}
