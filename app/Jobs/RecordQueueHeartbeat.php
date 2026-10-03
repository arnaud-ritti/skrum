<?php

namespace App\Jobs;

use App\Support\Status\InstanceStatus;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

class RecordQueueHeartbeat implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        Cache::forever(InstanceStatus::QueueHeartbeat, now()->toIso8601String());
    }
}
