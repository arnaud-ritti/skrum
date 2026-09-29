<?php

namespace App\Events\Retros;

class PhaseChanged extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public string $phase)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'phase.changed';
    }

    public function broadcastWith(): array
    {
        return ['phase' => $this->phase];
    }
}
