<?php

namespace App\Events\Whiteboards;

use App\Events\BroadcastEvent;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PresenceChannel;

abstract class WhiteboardBroadcastEvent extends BroadcastEvent
{
    public function __construct(public string $boardId) {}

    public function broadcastOn(): Channel
    {
        return new PresenceChannel("whiteboard.{$this->boardId}");
    }
}
