<?php

namespace App\Events\Retros;

class VoteRetracted extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public int $votesCast)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'vote.retracted';
    }

    public function broadcastWith(): array
    {
        return ['votesCast' => $this->votesCast];
    }
}
