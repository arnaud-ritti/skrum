<?php

namespace App\Events\Whiteboards;

class WhiteboardTimerChanged extends WhiteboardBroadcastEvent
{
    public function __construct(string $boardId, public ?string $timerEndsAt)
    {
        parent::__construct($boardId);
    }

    public function broadcastAs(): string
    {
        return 'timer.changed';
    }

    public function broadcastWith(): array
    {
        return ['timerEndsAt' => $this->timerEndsAt];
    }
}
