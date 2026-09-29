<?php

namespace App\Events\Retros;

class VoteCast extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public int $votesCast, public int $votesVersion)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'vote.cast';
    }

    public function broadcastWith(): array
    {
        return [
            'votesCast' => $this->votesCast,
            'votesVersion' => $this->votesVersion,
        ];
    }
}
