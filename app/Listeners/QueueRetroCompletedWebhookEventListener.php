<?php

namespace App\Listeners;

use App\Actions\Integrations\BuildWebhookEventData;
use App\Actions\Integrations\QueueWebhookEvent;
use App\Enums\WebhookEvent;
use App\Events\RetroCompleted;

class QueueRetroCompletedWebhookEventListener
{
    public function __construct(
        private QueueWebhookEvent $queueWebhookEvent,
        private BuildWebhookEventData $buildWebhookEventData,
    ) {}

    public function handle(RetroCompleted $event): void
    {
        $retro = $event->retro;

        $this->queueWebhookEvent->handle($retro->team, WebhookEvent::RetroCompleted, $retro, fn (): array => $this->buildWebhookEventData->retroCompleted($retro));
    }
}
