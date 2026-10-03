<?php

namespace App\Events\Concerns;

use App\Support\BroadcastToEveryone;
use Illuminate\Support\Facades\DB;

trait SendsToOthers
{
    public function sendToOthers(): void
    {
        $toEveryone = BroadcastToEveryone::isActive();

        DB::afterCommit(function () use ($toEveryone): void {
            rescue(function () use ($toEveryone): void {
                $toEveryone ? broadcast($this) : broadcast($this)->toOthers();
            });
        });
    }
}
