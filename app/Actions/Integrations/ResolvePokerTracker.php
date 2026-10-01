<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\NotConnected;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ResolvePokerTracker
{
    public function handle(Team $team, string $source): TeamIntegration
    {
        $provider = IntegrationProvider::tryFrom($source);

        throw_if($provider === null || ! $provider->isTracker() || ! $provider->isEnabled(), NotFoundHttpException::class);

        $integration = $team->integration($provider);

        throw_if($integration === null, NotConnected::class, $provider);

        $integration->ensureActive();

        return $integration;
    }

    public function teamHasTracker(Team $team): bool
    {
        $providers = array_map(
            fn (IntegrationProvider $provider): string => $provider->value,
            array_values(array_filter(IntegrationProvider::enabled(), fn (IntegrationProvider $provider): bool => $provider->isTracker())),
        );

        if ($providers === []) {
            return false;
        }

        return $team->integrations()
            ->whereIn('provider', $providers)
            ->where('status', IntegrationStatus::Active->value)
            ->exists();
    }
}
