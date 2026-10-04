<?php

namespace App\Listeners;

use App\Actions\Integrations\QueueActionItemStatusPushes;
use App\Events\ActionItems\ActionItemProgressChanged;

class QueueProgressedActionItemStatusPushesListener
{
    public function __construct(private QueueActionItemStatusPushes $queueActionItemStatusPushes) {}

    public function handle(ActionItemProgressChanged $event): void
    {
        $this->queueActionItemStatusPushes->handle($event->actionItem, $event->origin);
    }
}
