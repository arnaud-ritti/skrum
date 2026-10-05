<?php

namespace App\Events\Retros;

use App\Events\BroadcastEvent;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PresenceChannel;

abstract class RetroBroadcastEvent extends BroadcastEvent
{
    public function __construct(public string $retroId) {}

    public function broadcastOn(): Channel
    {
        return new PresenceChannel("retro.{$this->retroId}");
    }
}
