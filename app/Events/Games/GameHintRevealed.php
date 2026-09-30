<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameHintRevealed extends GameBroadcastEvent
{
    /**
     * @param  array<int, ?string>  $mask
     */
    public function __construct(GameRoom $room, public string $roundId, public array $mask)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.hint.revealed';
    }

    public function broadcastWith(): array
    {
        return ['roundId' => $this->roundId, 'mask' => $this->mask];
    }
}
