<?php

namespace App\Events\ActionItems;

class TeamActionItemSaved extends TeamActionItemsBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $actionItem
     */
    public function __construct(string $teamId, public array $actionItem)
    {
        parent::__construct($teamId);
    }

    public function broadcastAs(): string
    {
        return 'team-action-item.saved';
    }

    public function broadcastWith(): array
    {
        return ['actionItem' => $this->actionItem];
    }
}
