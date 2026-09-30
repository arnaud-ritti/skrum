<?php

namespace App\Events\Retros;

class RotiChanged extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public int $respondents)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'roti.changed';
    }

    public function broadcastWith(): array
    {
        return ['respondents' => $this->respondents];
    }
}
