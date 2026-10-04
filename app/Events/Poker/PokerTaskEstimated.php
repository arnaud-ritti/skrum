<?php

namespace App\Events\Poker;

use App\Models\PokerTask;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Domain event for integrations: QueuePokerTaskEstimatedWebhookEventListener
 * turns it into an outgoing webhook.
 */
class PokerTaskEstimated implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(public PokerTask $task) {}
}
