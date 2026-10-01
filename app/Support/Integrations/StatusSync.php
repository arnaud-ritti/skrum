<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationCapability;
use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\IssueStatus;
use Carbon\CarbonImmutable;

/**
 * The opt-in of spec 8 §5.1, read the same way everywhere.
 */
class StatusSync
{
    public static function isOn(TeamIntegration $integration): bool
    {
        return $integration->provider->can(IntegrationCapability::StatusSync)
            && $integration->setting('statusSync') === true;
    }

    /**
     * Since when webhooks should have been arriving: their registration,
     * else the moment sync was turned on.
     */
    public static function webhookWatchedSince(TeamIntegration $integration): ?CarbonImmutable
    {
        return IssueStatus::time($integration->setting('webhookRegisteredAt'))
            ?? IssueStatus::time($integration->setting('statusSyncSince'));
    }
}
