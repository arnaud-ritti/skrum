<?php

namespace App\Listeners;

use App\Actions\Integrations\BuildWebhookEventData;
use App\Actions\Integrations\QueueWebhookEvent;
use App\Enums\WebhookEvent;
use App\Events\ActionItems\ActionItemCreated;

class QueueActionItemCreatedWebhookEventListener
{
    public function __construct(
        private QueueWebhookEvent $queueWebhookEvent,
        private BuildWebhookEventData $buildWebhookEventData,
    ) {}

    public function handle(ActionItemCreated $event): void
    {
        $item = $event->actionItem;

        $this->queueWebhookEvent->handle($item->team, WebhookEvent::ActionItemCreated, $item, fn (): array => $this->buildWebhookEventData->actionItemCreated($item));
    }
}
