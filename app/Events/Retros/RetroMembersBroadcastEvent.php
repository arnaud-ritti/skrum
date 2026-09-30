<?php

namespace App\Events\Retros;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;

/**
 * Carried action items of earlier retros are for members only, so they
 * travel on a private channel guests cannot join.
 */
abstract class RetroMembersBroadcastEvent extends RetroBroadcastEvent
{
    public function broadcastOn(): Channel
    {
        return new PrivateChannel("retro-members.{$this->retroId}");
    }
}
