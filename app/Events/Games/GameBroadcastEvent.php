<?php

namespace App\Events\Games;

use App\Events\BroadcastEvent;
use App\Models\GameRoom;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PresenceChannel;

/**
 * Secret words never travel before a round ends; icebreaker rooms speak on
 * their retro's channel, standalone rooms on their own.
 */
abstract class GameBroadcastEvent extends BroadcastEvent
{
    public string $roomId;

    public string $channelName;

    public function __construct(GameRoom $room)
    {
        $this->roomId = $room->id;
        $this->channelName = $room->broadcastChannel();
    }

    public function broadcastOn(): Channel
    {
        return new PresenceChannel($this->channelName);
    }
}
