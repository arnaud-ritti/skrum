<?php

namespace App\Events\Retros;

class ActionItemCommentsChanged extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public string $actionItemId, public int $commentCount)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'action-item.comments.changed';
    }

    public function broadcastWith(): array
    {
        return ['actionItemId' => $this->actionItemId, 'commentCount' => $this->commentCount];
    }
}
