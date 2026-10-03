<?php

namespace App\Events\Games;

use App\Models\GameRoom;

/**
 * Wrong and near-miss guesses only, without the near-miss flag: a correct
 * guess ends the round instead and its text never travels. A hangman
 * whole-word guess also carries the round's misses.
 */
class GameGuessMade extends GameBroadcastEvent
{
    /**
     * @param  array{roundId: string, guessId: string, playerId: string, text: string, misses?: int}  $payload
     */
    public function __construct(GameRoom $room, public array $payload)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.guess.made';
    }

    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
