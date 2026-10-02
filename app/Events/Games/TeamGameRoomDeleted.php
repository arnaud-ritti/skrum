<?php

namespace App\Events\Games;

class TeamGameRoomDeleted extends TeamGamesBroadcastEvent
{
    public function __construct(string $teamId, public string $roomId)
    {
        parent::__construct($teamId);
    }

    public function broadcastAs(): string
    {
        return 'team.game-room.deleted';
    }

    public function broadcastWith(): array
    {
        return ['roomId' => $this->roomId];
    }
}
