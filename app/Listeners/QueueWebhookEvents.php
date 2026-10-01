<?php

namespace App\Listeners;

use App\Actions\Integrations\BuildWebhookEventData;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\WebhookEvent;
use App\Events\ActionItems\ActionItemCompleted;
use App\Events\ActionItems\ActionItemCreated;
use App\Events\ActionItems\ActionItemReopened;
use App\Events\Poker\PokerTaskEstimated;
use App\Events\RetroCompleted;
use App\Jobs\Integrations\DeliverWebhookEvent;
use App\Models\IntegrationDelivery;
use App\Models\Team;
use App\Models\TeamIntegration;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Throwable;

/**
 * Queues the automatic events a team's generic webhook subscribed to.
 * Methods are named `on…` so event discovery leaves them to the explicit
 * registration in AppServiceProvider.
 */
class QueueWebhookEvents
{
    public function __construct(private BuildWebhookEventData $buildWebhookEventData) {}

    public function onRetroCompleted(RetroCompleted $event): void
    {
        $retro = $event->retro;

        $this->queue($retro->team, WebhookEvent::RetroCompleted, $retro, fn (): array => $this->buildWebhookEventData->retroCompleted($retro));
    }

    public function onActionItemCreated(ActionItemCreated $event): void
    {
        $item = $event->actionItem;

        $this->queue($item->team, WebhookEvent::ActionItemCreated, $item, fn (): array => $this->buildWebhookEventData->actionItemCreated($item));
    }

    public function onActionItemCompleted(ActionItemCompleted $event): void
    {
        $item = $event->actionItem;

        $this->queue($item->team, WebhookEvent::ActionItemCompleted, $item, fn (): array => $this->buildWebhookEventData->actionItemStatusChanged($item, $event->origin, $event->actor));
    }

    public function onActionItemReopened(ActionItemReopened $event): void
    {
        $item = $event->actionItem;

        $this->queue($item->team, WebhookEvent::ActionItemReopened, $item, fn (): array => $this->buildWebhookEventData->actionItemStatusChanged($item, $event->origin, $event->actor));
    }

    public function onPokerTaskEstimated(PokerTaskEstimated $event): void
    {
        $task = $event->task;

        $this->queue($task->game->team, WebhookEvent::PokerTaskEstimated, $task, fn (): array => $this->buildWebhookEventData->pokerTaskEstimated($task));
    }

    /**
     * @param  Closure(): array<string, mixed>  $buildData
     */
    private function queue(Team $team, WebhookEvent $event, Model $subject, Closure $buildData): void
    {
        $integration = $this->subscribedWebhook($team, $event);

        if ($integration === null) {
            return;
        }

        $delivery = null;

        try {
            $data = $buildData();

            $delivery = IntegrationDelivery::query()->create([
                'team_id' => $team->id,
                'channel' => IntegrationDeliveryChannel::Webhook,
                'kind' => IntegrationDeliveryKind::Event,
                'team_integration_id' => $integration->id,
                'event' => $event->value,
                'subject_type' => $subject->getMorphClass(),
                'subject_id' => $subject->getKey(),
                'requested_by_user_id' => null,
                'status' => IntegrationDeliveryStatus::Queued,
            ]);

            dispatch(new DeliverWebhookEvent($delivery->id, $event->value, now()->toIso8601ZuluString(), $data, app()->getLocale()))->afterCommit();
        } catch (Throwable $exception) {
            report($exception);

            $delivery?->markFailed(__('The message could not be delivered.'));
        }
    }

    private function subscribedWebhook(Team $team, WebhookEvent $event): ?TeamIntegration
    {
        if (! IntegrationProvider::Webhook->isEnabled()) {
            return null;
        }

        $integration = $team->integration(IntegrationProvider::Webhook);

        if ($integration === null) {
            return null;
        }

        if (! $integration->isActive()) {
            return null;
        }

        $events = (array) $integration->setting('events', []);

        return in_array($event->value, $events, true) ? $integration : null;
    }
}
