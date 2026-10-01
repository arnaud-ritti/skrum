<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationCapability;
use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\IssueStatus;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * The opt-in of spec 8 §5.1, read the same way everywhere.
 */
class StatusSync
{
    /**
     * Set when sync is turned on, cleared once the first (source-wins)
     * read completes, so a first read that keeps failing is queued again.
     */
    public const InitialReadPending = 'initialReadPendingSince';

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

    public static function initialReadPending(TeamIntegration $integration): bool
    {
        return self::isOn($integration) && is_string($integration->setting(self::InitialReadPending));
    }

    /**
     * Clears the marker only if sync was not turned off and on again while
     * this read ran: that newer first read is still owed.
     */
    public static function finishInitialRead(TeamIntegration $integration, mixed $pendingSince): void
    {
        if (! is_string($pendingSince)) {
            return;
        }

        DB::transaction(function () use ($integration, $pendingSince): void {
            $locked = TeamIntegration::query()->whereKey($integration->id)->lockForUpdate()->firstOrFail();

            if ($locked->setting(self::InitialReadPending) !== $pendingSince) {
                return;
            }

            $locked->forceFill(['settings' => [...$locked->settings, self::InitialReadPending => null]])->save();
            $integration->setRawAttributes($locked->getAttributes(), true);
        });
    }
}
