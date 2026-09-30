<?php

namespace App\Events\ActionItems;

class TeamActionItemDeleted extends TeamActionItemsBroadcastEvent
{
    public function __construct(string $teamId, public string $actionItemId)
    {
        parent::__construct($teamId);
    }

    public function broadcastAs(): string
    {
        return 'team-action-item.deleted';
    }

    public function broadcastWith(): array
    {
        return ['actionItemId' => $this->actionItemId];
    }
}
