<?php

namespace App\Listeners;

use App\Actions\Integrations\BuildWebhookEventData;
use App\Actions\Integrations\QueueWebhookEvent;
use App\Enums\WebhookEvent;
use App\Events\ActionItems\ActionItemCompleted;

class QueueActionItemCompletedWebhookEventListener
{
    public function __construct(
        private QueueWebhookEvent $queueWebhookEvent,
        private BuildWebhookEventData $buildWebhookEventData,
    ) {}

    public function handle(ActionItemCompleted $event): void
    {
        $item = $event->actionItem;

        $this->queueWebhookEvent->handle($item->team, WebhookEvent::ActionItemCompleted, $item, fn (): array => $this->buildWebhookEventData->actionItemStatusChanged($item, $event->origin, $event->actor));
    }
}
