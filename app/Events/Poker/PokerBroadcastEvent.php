<?php

namespace App\Events\Poker;

use App\Events\Concerns\SendsToOthers;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Card values never travel in a broadcast: reveals and selections are
 * announced as changes, and each client refetches its own snapshot.
 */
abstract class PokerBroadcastEvent implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable;
    use InteractsWithSockets;
    use SendsToOthers;

    public function __construct(public string $gameId) {}

    public function broadcastOn(): Channel
    {
        return new PresenceChannel("poker.{$this->gameId}");
    }

    abstract public function broadcastAs(): string;

    /**
     * @return array<string, mixed>
     */
    abstract public function broadcastWith(): array;
}
