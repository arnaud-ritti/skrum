<?php

namespace App\Events\Poker;

class PokerTasksReordered extends PokerBroadcastEvent
{
    /**
     * @param  array<int, string>  $taskIds
     */
    public function __construct(string $gameId, public array $taskIds)
    {
        parent::__construct($gameId);
    }

    public function broadcastAs(): string
    {
        return 'tasks.reordered';
    }

    public function broadcastWith(): array
    {
        return ['taskIds' => $this->taskIds];
    }
}
