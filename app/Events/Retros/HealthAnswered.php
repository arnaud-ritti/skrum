<?php

namespace App\Events\Retros;

class HealthAnswered extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public int $respondents, public int $participants)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'health.answered';
    }

    /**
     * @return array{respondents: int, participants: int}
     */
    public function broadcastWith(): array
    {
        return ['respondents' => $this->respondents, 'participants' => $this->participants];
    }
}
