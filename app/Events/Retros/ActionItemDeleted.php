<?php

namespace App\Events\Retros;

class ActionItemDeleted extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public string $actionItemId)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'action-item.deleted';
    }

    public function broadcastWith(): array
    {
        return ['actionItemId' => $this->actionItemId];
    }
}
