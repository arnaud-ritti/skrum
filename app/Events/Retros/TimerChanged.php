<?php

namespace App\Events\Retros;

class TimerChanged extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public ?string $timerEndsAt)
    {
        parent::__construct($retroId);
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
