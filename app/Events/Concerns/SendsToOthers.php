<?php

namespace App\Events\Concerns;

use Illuminate\Support\Facades\DB;

trait SendsToOthers
{
    public function sendToOthers(): void
    {
        DB::afterCommit(function (): void {
            rescue(function (): void {
                broadcast($this)->toOthers();
            });
        });
    }
}
