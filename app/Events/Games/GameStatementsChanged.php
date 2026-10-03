<?php

namespace App\Events\Games;

use App\Models\GameRoom;

/**
 * Only whether a player has a set ready: the statements and the lie stay
 * with their author until the set's round.
 */
class GameStatementsChanged extends GameBroadcastEvent
{
    public function __construct(GameRoom $room, public string $playerId, public bool $ready)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.statements.changed';
    }

    public function broadcastWith(): array
    {
        return ['playerId' => $this->playerId, 'ready' => $this->ready];
    }
}
