<?php

namespace App\Events\Poker;

class PokerTaskDeleted extends PokerBroadcastEvent
{
    public function __construct(string $gameId, public string $taskId)
    {
        parent::__construct($gameId);
    }

    public function broadcastAs(): string
    {
        return 'task.deleted';
    }

    public function broadcastWith(): array
    {
        return ['taskId' => $this->taskId];
    }
}
