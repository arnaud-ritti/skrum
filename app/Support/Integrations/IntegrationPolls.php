<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationWebhookStatus;
use App\Models\TeamIntegration;
use Illuminate\Support\Facades\Cache;

/**
 * Spec 8 §5.4: webhook connections are reconciled hourly while their
 * webhook is pending or active; everything else is read every
 * INTEGRATIONS_POLL_MINUTES. A 429 pauses the connection until its
 * Retry-After.
 */
class IntegrationPolls
{
    public const ReconciliationMinutes = 60;

    public const CursorOverlapMinutes = 2;

    public static function intervalMinutes(TeamIntegration $integration): int
    {
        $healthyWebhook = $integration->inbound_mode === IntegrationInboundMode::Webhook
            && in_array($integration->webhook_status, [IntegrationWebhookStatus::Pending, IntegrationWebhookStatus::Active], true);

        return $healthyWebhook ? self::ReconciliationMinutes : InboundReachability::pollIntervalMinutes();
    }

    public static function isDue(TeamIntegration $integration): bool
    {
        if (Cache::has(self::pauseKey($integration->id))) {
            return false;
        }

        return $integration->last_polled_at === null
            || $integration->last_polled_at->lte(now()->subMinutes(self::intervalMinutes($integration)));
    }

    public static function pause(string $integrationId, int $seconds): void
    {
        Cache::put(self::pauseKey($integrationId), true, now()->addSeconds($seconds));
    }

    private static function pauseKey(string $integrationId): string
    {
        return "integration-poll-paused:{$integrationId}";
    }
}
