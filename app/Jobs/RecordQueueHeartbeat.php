<?php

namespace App\Jobs;

use App\Support\Status\InstanceStatus;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

/**
 * Unique so that a stopped worker finds one heartbeat waiting, not one per minute of the outage.
 */
class RecordQueueHeartbeat implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $uniqueFor = InstanceStatus::LateMinutes * 60;

    public function handle(): void
    {
        Cache::forever(InstanceStatus::QueueHeartbeat, now()->toIso8601String());
    }
}
