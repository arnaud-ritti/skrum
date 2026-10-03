<?php

namespace App\Events\Games;

use App\Models\GameRoom;

/**
 * Only how many have voted, never who: in Guess who? the one player who
 * may not vote is the author of the drawn answer.
 */
class GameVotesCounted extends GameBroadcastEvent
{
    public function __construct(GameRoom $room, public string $roundId, public int $voted)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.votes.counted';
    }

    public function broadcastWith(): array
    {
        return ['roundId' => $this->roundId, 'voted' => $this->voted];
    }
}
