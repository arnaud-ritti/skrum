<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Exceptions\Integrations\AssigneeMappingUnavailable;
use App\Models\TeamIntegration;

class IntegrationMappingGuard
{
    public const JiraAccountScope = 'read:jira-user';

    public static function hasAccountScope(TeamIntegration $integration): bool
    {
        if ($integration->provider !== IntegrationProvider::Jira) {
            return true;
        }

        return $integration->hasScope(self::JiraAccountScope);
    }

    public static function canMap(TeamIntegration $integration): bool
    {
        if (! $integration->provider->isTracker()) {
            return false;
        }

        if (! $integration->provider->isEnabled()) {
            return false;
        }

        if (! $integration->canWrite()) {
            return false;
        }

        return self::hasAccountScope($integration);
    }

    /**
     * Chat channels have no accounts (404); trackers answer with the
     * connection's state (409).
     */
    public static function ensureMappable(TeamIntegration $integration): void
    {
        self::ensureTracker($integration);

        if (! self::hasAccountScope($integration)) {
            throw new AssigneeMappingUnavailable($integration->provider);
        }
    }

    public static function ensureTracker(TeamIntegration $integration): void
    {
        abort_unless($integration->provider->isTracker(), 404);

        $integration->ensureWritable();
    }
}
