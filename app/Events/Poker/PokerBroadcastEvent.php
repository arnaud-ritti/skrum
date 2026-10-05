<?php

namespace App\Events\Poker;

use App\Events\BroadcastEvent;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PresenceChannel;

/**
 * Card values never travel in a broadcast: reveals and selections are
 * announced as changes, and each client refetches its own snapshot.
 */
abstract class PokerBroadcastEvent extends BroadcastEvent
{
    public function __construct(public string $gameId) {}

    public function broadcastOn(): Channel
    {
        return new PresenceChannel("poker.{$this->gameId}");
    }
}
