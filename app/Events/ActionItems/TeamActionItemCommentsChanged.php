<?php

namespace App\Events\ActionItems;

class TeamActionItemCommentsChanged extends TeamActionItemsBroadcastEvent
{
    public function __construct(string $teamId, public string $actionItemId, public int $commentCount)
    {
        parent::__construct($teamId);
    }

    public function broadcastAs(): string
    {
        return 'team-action-item.comments.changed';
    }

    public function broadcastWith(): array
    {
        return ['actionItemId' => $this->actionItemId, 'commentCount' => $this->commentCount];
    }
}
