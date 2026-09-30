<?php

namespace App\Events\Retros;

class CarriedActionItemCommentsChanged extends RetroMembersBroadcastEvent
{
    public function __construct(string $retroId, public string $actionItemId, public int $commentCount)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'carried-action-item.comments.changed';
    }

    public function broadcastWith(): array
    {
        return ['actionItemId' => $this->actionItemId, 'commentCount' => $this->commentCount];
    }
}
