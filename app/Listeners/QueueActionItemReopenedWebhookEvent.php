<?php

namespace App\Listeners;

use App\Actions\Integrations\BuildWebhookEventData;
use App\Actions\Integrations\QueueWebhookEvent;
use App\Enums\WebhookEvent;
use App\Events\ActionItems\ActionItemReopened;

class QueueActionItemReopenedWebhookEvent
{
    public function __construct(
        private QueueWebhookEvent $queueWebhookEvent,
        private BuildWebhookEventData $buildWebhookEventData,
    ) {}

    public function handle(ActionItemReopened $event): void
    {
        $item = $event->actionItem;

        $this->queueWebhookEvent->handle($item->team, WebhookEvent::ActionItemReopened, $item, fn (): array => $this->buildWebhookEventData->actionItemStatusChanged($item, $event->origin, $event->actor));
    }
}
