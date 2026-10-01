<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\TrackedIssues;
use App\Enums\InboundEventStatus;
use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\IntegrationWebhookStatus;
use App\Http\Controllers\Controller;
use App\Jobs\Integrations\ApplyInboundIssueChanges;
use App\Models\IntegrationInboundEvent;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\GitHub\GitHubClient;
use App\Support\Integrations\Inbound\InboundEvent;
use App\Support\Integrations\Inbound\InboundSignatureInvalid;
use App\Support\Integrations\Inbound\ReadInboundEvent;
use App\Support\Integrations\StatusSync;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Spec 8 §5.3: webhooks are hints, the API is the truth. A verified
 * delivery is recorded once by key (no payload) and only queues a re-read
 * of the issues the connections track.
 */
class InboundWebhooksController extends Controller
{
    private const int MaxBodyBytes = 1_048_576;

    public function __construct(
        private ReadInboundEvent $readInboundEvent,
        private TrackedIssues $trackedIssues,
        private GitHubClient $gitHub,
    ) {}

    public function store(Request $request, string $source, ?string $integration = null, ?string $token = null): JsonResponse
    {
        abort_if((int) $request->header('Content-Length', '0') > self::MaxBodyBytes || strlen($request->getContent()) > self::MaxBodyBytes, 413);

        $provider = ReadInboundEvent::provider($source);

        try {
            $event = $this->readInboundEvent->handle($provider, $request, $integration, $token);
        } catch (InboundSignatureInvalid $exception) {
            $this->reject($provider, $request, $exception->integration);

            return response()->json(['message' => __('Invalid signature.')], 401);
        }

        $row = IntegrationInboundEvent::query()->createOrFirst(
            ['provider' => $provider, 'event_key' => $event->key],
            [
                'team_integration_id' => $event->integrations->first()?->id,
                'event_type' => $event->type,
                'status' => InboundEventStatus::Ignored,
                'received_at' => now(),
            ],
        );

        if (! $row->wasRecentlyCreated) {
            return response()->json(['status' => 'duplicate']);
        }

        $this->markHeard($event);

        if ($event->installationRemoved !== null) {
            try {
                $removal = $this->confirmedRemoval($event);
            } catch (IntegrationException $exception) {
                report($exception);
                $row->delete();

                return response()->json(['message' => $exception->userMessage()], 503);
            }

            if ($removal !== null) {
                $this->removeInstallation($event, $removal);
                $row->update(['status' => InboundEventStatus::Applied]);
            }

            return response()->json(['status' => 'accepted'], 202);
        }

        $batches = $this->batches($event);

        try {
            foreach ($batches as $integrationId => $externalIds) {
                dispatch(new ApplyInboundIssueChanges((string) $integrationId, $externalIds, $row->id));
            }
        } catch (Throwable $exception) {
            $row->delete();

            throw $exception;
        }

        if ($batches !== []) {
            $row->update(['status' => InboundEventStatus::Applied]);
        }

        return response()->json(['status' => 'accepted'], 202);
    }

    /**
     * @return array<string, array<int, string>> tracked ids per synced connection
     */
    private function batches(InboundEvent $event): array
    {
        $batches = [];

        foreach ($event->integrations as $integration) {
            if (! $integration->isActive() || ! StatusSync::isOn($integration)) {
                continue;
            }

            $ids = $event->removedRepositoryIds !== []
                ? $this->trackedIssues->inRepositories($integration, $event->removedRepositoryIds)
                : $this->trackedIssues->among($integration, $event->externalIds);

            if ($ids !== []) {
                $batches[$integration->id] = $ids;
            }
        }

        return $batches;
    }

    private function markHeard(InboundEvent $event): void
    {
        foreach ($event->integrations as $integration) {
            $integration->forceFill([
                'last_inbound_at' => now(),
                'webhook_status' => $integration->webhook_status === null && $integration->inbound_mode !== IntegrationInboundMode::Webhook
                    ? null
                    : IntegrationWebhookStatus::Active,
            ])->save();
        }
    }

    /**
     * Installation events are hints too: only what GitHub reports now counts,
     * so a replayed or stale removal changes nothing. When GitHub cannot be
     * asked, the event is forgotten so its redelivery is processed.
     *
     * @return 'deleted'|'suspend'|null
     *
     * @throws IntegrationException
     */
    private function confirmedRemoval(InboundEvent $event): ?string
    {
        if ($event->installationId === null || $event->integrations->isEmpty()) {
            return null;
        }

        return $this->gitHub->installationRemoval($event->installationId);
    }

    /**
     * @param  'deleted'|'suspend'  $removal
     */
    private function removeInstallation(InboundEvent $event, string $removal): void
    {
        foreach ($event->integrations as $integration) {
            if ($integration->status === IntegrationStatus::ReconnectRequired) {
                continue;
            }

            $integration->markReconnectRequired($removal === 'suspend'
                ? $this->gitHub->suspendedMessage($integration)
                : $this->gitHub->uninstalledMessage($integration));
        }

        if ($event->installationId !== null) {
            $this->gitHub->forgetInstallationToken($event->installationId);
        }
    }

    /**
     * Rejected rows use their own key space, so a forged request can never
     * occupy the delivery id of a genuine one.
     */
    private function reject(IntegrationProvider $provider, Request $request, ?TeamIntegration $integration): void
    {
        IntegrationInboundEvent::query()->createOrFirst(
            ['provider' => $provider, 'event_key' => 'rejected:'.hash('sha256', $request->getContent())],
            [
                'team_integration_id' => $integration?->id,
                'event_type' => 'rejected',
                'status' => InboundEventStatus::Rejected,
                'detail' => 'signature_mismatch',
                'received_at' => now(),
            ],
        );

        if (Cache::add("inbound-webhook-rejected:{$provider->value}", true, now()->addHour())) {
            Log::warning("Rejected an inbound {$provider->label()} webhook: its signature or token did not match.");
        }
    }
}
