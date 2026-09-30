<?php

namespace App\Events\Games;

use App\Events\Concerns\SendsToOthers;
use App\Models\GameRoom;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Secret words never travel before a round ends; icebreaker rooms speak on
 * their retro's channel, standalone rooms on their own.
 */
abstract class GameBroadcastEvent implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable;
    use InteractsWithSockets;
    use SendsToOthers;

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

    abstract public function broadcastAs(): string;

    /**
     * @return array<string, mixed>
     */
    abstract public function broadcastWith(): array;
}
