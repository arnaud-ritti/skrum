<?php

namespace App\Events\Poker;

use App\Models\PokerTask;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Domain event for integrations (spec 6 write-back, spec 8 webhooks); no
 * listener in this spec.
 */
class PokerTaskEstimated implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(public PokerTask $task) {}
}
