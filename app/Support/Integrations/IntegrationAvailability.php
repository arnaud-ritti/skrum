<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\Team;
use App\Models\TeamIntegration;

class IntegrationAvailability
{
    private const NonDeliveringMailers = ['log', 'array'];

    public function emailEnabled(): bool
    {
        return ! in_array(config('mail.default'), self::NonDeliveringMailers, true);
    }

    public function activeIntegration(Team $team, IntegrationProvider $provider): ?TeamIntegration
    {
        if (! $provider->isEnabled()) {
            return null;
        }

        $integration = $team->integration($provider);

        return $integration !== null && $integration->isActive() ? $integration : null;
    }
}
