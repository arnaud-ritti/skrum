<?php

namespace App\Events\Retros;

class CarriedActionItemRemoved extends RetroMembersBroadcastEvent
{
    public function __construct(string $retroId, public string $actionItemId)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'carried-action-item.removed';
    }

    public function broadcastWith(): array
    {
        return ['actionItemId' => $this->actionItemId];
    }
}
