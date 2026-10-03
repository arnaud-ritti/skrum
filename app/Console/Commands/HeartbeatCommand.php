<?php

namespace App\Console\Commands;

use App\Jobs\RecordQueueHeartbeat;
use App\Support\Status\InstanceStatus;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

#[Description('Record the scheduler heartbeat and queue a job that records the queue heartbeat')]
#[Signature('skrum:heartbeat')]
class HeartbeatCommand extends Command
{
    public function handle(): int
    {
        Cache::forever(InstanceStatus::SchedulerHeartbeat, now()->toIso8601String());

        RecordQueueHeartbeat::dispatch();

        $this->comment('Heartbeat recorded.');

        return self::SUCCESS;
    }
}
