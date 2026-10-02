<?php

namespace App\Events\Games;

class TeamGameRoomChanged extends TeamGamesBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $room  the summary of the room
     */
    public function __construct(string $teamId, public array $room)
    {
        parent::__construct($teamId);
    }

    public function broadcastAs(): string
    {
        return 'team.game-room.changed';
    }

    public function broadcastWith(): array
    {
        return ['room' => $this->room];
    }
}
