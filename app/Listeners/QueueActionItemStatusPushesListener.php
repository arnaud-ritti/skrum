<?php

namespace App\Listeners;

use App\Actions\Integrations\QueueActionItemStatusPushes;
use App\Events\ActionItems\ActionItemCompleted;
use App\Events\ActionItems\ActionItemProgressChanged;
use App\Events\ActionItems\ActionItemReopened;

class QueueActionItemStatusPushesListener
{
    public function __construct(private QueueActionItemStatusPushes $queueActionItemStatusPushes) {}

    public function handle(ActionItemCompleted|ActionItemProgressChanged|ActionItemReopened $event): void
    {
        $this->queueActionItemStatusPushes->handle($event->actionItem, $event->origin);
    }
}
