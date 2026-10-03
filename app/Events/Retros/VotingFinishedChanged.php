<?php

namespace App\Events\Retros;

class VotingFinishedChanged extends RetroBroadcastEvent
{
    /**
     * @param  array<int, string>  $finishedIds
     */
    public function __construct(string $retroId, public array $finishedIds)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'voting.finished';
    }

    public function broadcastWith(): array
    {
        return ['finishedIds' => $this->finishedIds];
    }
}
