<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\WebhookEvent;
use App\Jobs\Integrations\DeliverWebhookEvent;
use App\Models\IntegrationDelivery;
use App\Models\Team;
use App\Models\TeamIntegration;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Queues an automatic event for the team's generic webhook when that
 * webhook subscribed to it. A failure is reported, never thrown into the
 * request that raised the event.
 */
class QueueWebhookEvent
{
    public function __construct(private StoreWebhookPayload $storeWebhookPayload) {}

    /**
     * @param  Closure(): array<string, mixed>  $buildData
     */
    public function handle(Team $team, WebhookEvent $event, Model $subject, Closure $buildData): void
    {
        $integration = $this->subscribedWebhook($team, $event);

        if ($integration === null) {
            return;
        }

        $delivery = null;

        try {
            $data = $buildData();

            $occurredAt = now()->toIso8601ZuluString();

            $delivery = DB::transaction(function () use ($team, $integration, $event, $subject, $occurredAt, $data): IntegrationDelivery {
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

                $this->storeWebhookPayload->keepIfPossible($delivery, [
                    'id' => $delivery->id,
                    'event' => $event->value,
                    'occurredAt' => $occurredAt,
                    'data' => $data,
                ]);

                return $delivery;
            });

            dispatch(new DeliverWebhookEvent($delivery->id, $event->value, $occurredAt, $data, app()->getLocale()))->afterCommit();
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
