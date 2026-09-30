<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameTimerChanged extends GameBroadcastEvent
{
    public function __construct(GameRoom $room, public ?string $timerEndsAt)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.timer.changed';
    }

    public function broadcastWith(): array
    {
        return ['timerEndsAt' => $this->timerEndsAt];
    }
}
