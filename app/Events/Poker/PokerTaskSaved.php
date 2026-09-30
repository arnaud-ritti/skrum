<?php

namespace App\Events\Poker;

class PokerTaskSaved extends PokerBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $task
     */
    public function __construct(string $gameId, public array $task)
    {
        parent::__construct($gameId);
    }

    public function broadcastAs(): string
    {
        return 'task.saved';
    }

    public function broadcastWith(): array
    {
        return ['task' => $this->task];
    }
}
