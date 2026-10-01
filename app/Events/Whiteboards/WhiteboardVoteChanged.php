<?php

namespace App\Events\Whiteboards;

class WhiteboardVoteChanged extends WhiteboardBroadcastEvent
{
    public function __construct(string $boardId, public string $sessionId, public int $finishedCount)
    {
        parent::__construct($boardId);
    }

    public function broadcastAs(): string
    {
        return 'vote.changed';
    }

    public function broadcastWith(): array
    {
        return ['sessionId' => $this->sessionId, 'finishedCount' => $this->finishedCount];
    }
}
