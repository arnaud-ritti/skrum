<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationWebhookStatus;
use App\Jobs\Integrations\ReadTrackedIssues;
use App\Jobs\Integrations\RegisterTrackerWebhooks;
use App\Jobs\Integrations\RemoveTrackerWebhooks;
use App\Models\TeamIntegration;
use App\Support\Integrations\InboundModes;
use App\Support\Integrations\StatusSync;
use App\Support\Integrations\TrackerWebhooks;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Spec 8 §5.1: turning sync on reads every tracked issue (the source wins
 * that first read; nothing is pushed) and sets up webhooks where possible;
 * turning it off stops everything and removes the webhooks skrum made.
 */
class ToggleStatusSync
{
    public function __construct(
        private InboundModes $inboundModes,
        private TrackerWebhooks $trackerWebhooks,
    ) {}

    public function handle(TeamIntegration $integration, bool $on): TeamIntegration
    {
        if ($on === StatusSync::isOn($integration)) {
            return $integration;
        }

        return $on ? $this->turnOn($integration) : $this->turnOff($integration);
    }

    private function turnOn(TeamIntegration $integration): TeamIntegration
    {
        $integration->ensureActive();

        $integration->mergeSettings([
            'statusSync' => true,
            'statusSyncSince' => now()->toIso8601String(),
            StatusSync::InitialReadPending => Str::random(40),
        ]);

        $mode = $this->inboundModes->for($integration);
        $pendingWithoutRegistration = $mode === IntegrationInboundMode::Webhook
            && in_array($integration->provider, [IntegrationProvider::Linear, IntegrationProvider::GitHub], true);

        $integration->forceFill([
            'inbound_mode' => $mode,
            'webhook_status' => $pendingWithoutRegistration ? IntegrationWebhookStatus::Pending : null,
            'last_polled_at' => now(),
            'poll_cursor' => now(),
        ])->save();

        if ($this->trackerWebhooks->canRegister($integration)) {
            RegisterTrackerWebhooks::dispatch($integration->id);
        }

        ReadTrackedIssues::dispatch($integration->id, true, true);

        return $integration;
    }

    /**
     * The webhook ids are read and cleared under the row lock, so one a
     * concurrent registration just stored is removed too.
     */
    private function turnOff(TeamIntegration $integration): TeamIntegration
    {
        $webhookIds = DB::transaction(function () use ($integration): array {
            $locked = TeamIntegration::query()->whereKey($integration->id)->lockForUpdate()->firstOrFail();
            $webhookIds = TrackerWebhooks::ids($locked);

            $locked->forceFill([
                'settings' => [...$locked->settings, 'statusSync' => false, 'webhookIds' => [], 'webhookProjects' => [], StatusSync::InitialReadPending => null],
                'inbound_mode' => IntegrationInboundMode::Off,
                'webhook_status' => null,
                'webhook_expires_at' => null,
            ])->save();

            $integration->setRawAttributes($locked->getAttributes(), true);

            return $webhookIds;
        });

        if ($webhookIds !== []) {
            RemoveTrackerWebhooks::dispatch($integration->id, $webhookIds);
        }

        return $integration;
    }
}
