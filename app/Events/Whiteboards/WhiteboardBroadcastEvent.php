<?php

namespace App\Events\Whiteboards;

use App\Events\Concerns\SendsToOthers;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Support\Facades\DB;

abstract class WhiteboardBroadcastEvent implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable;
    use InteractsWithSockets;
    use SendsToOthers;

    public function __construct(public string $boardId) {}

    public function broadcastOn(): Channel
    {
        return new PresenceChannel("whiteboard.{$this->boardId}");
    }

    /**
     * To everyone on the channel, the sender included: for a change the
     * sender's own response does not describe.
     */
    public function sendToAll(): void
    {
        DB::afterCommit(function (): void {
            rescue(function (): void {
                broadcast($this);
            });
        });
    }

    abstract public function broadcastAs(): string;

    /**
     * @return array<string, mixed>
     */
    abstract public function broadcastWith(): array;
}
