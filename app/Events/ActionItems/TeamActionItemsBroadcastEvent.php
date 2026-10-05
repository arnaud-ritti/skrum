<?php

namespace App\Events\ActionItems;

use App\Events\BroadcastEvent;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;

abstract class TeamActionItemsBroadcastEvent extends BroadcastEvent
{
    public function __construct(public string $teamId) {}

    public function broadcastOn(): Channel
    {
        return new PrivateChannel("team-action-items.{$this->teamId}");
    }
}
