<?php

namespace App\Listeners;

use App\Support\InstanceConfiguration\InstanceConfiguration;
use Illuminate\Console\Events\CommandStarting;
use Illuminate\Queue\Events\JobProcessing;

class ApplyInstanceConfigurationListener
{
    public function __construct(private InstanceConfiguration $instanceConfiguration) {}

    public function handle(JobProcessing|CommandStarting $event): void
    {
        rescue(fn () => $this->instanceConfiguration->apply(), report: false);
    }
}
