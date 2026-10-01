<?php

namespace App\Listeners;

use App\Actions\Integrations\BuildWebhookEventData;
use App\Actions\Integrations\QueueWebhookEvent;
use App\Enums\WebhookEvent;
use App\Events\Poker\PokerTaskEstimated;

class QueuePokerTaskEstimatedWebhookEventListener
{
    public function __construct(
        private QueueWebhookEvent $queueWebhookEvent,
        private BuildWebhookEventData $buildWebhookEventData,
    ) {}

    public function handle(PokerTaskEstimated $event): void
    {
        $task = $event->task;

        $this->queueWebhookEvent->handle($task->game->team, WebhookEvent::PokerTaskEstimated, $task, fn (): array => $this->buildWebhookEventData->pokerTaskEstimated($task));
    }
}
