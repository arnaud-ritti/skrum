<?php

namespace App\Mcp;

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\TeamIntegration;

/**
 * Spec 5 §2.4: the tracker tools exist for a token only when a tracker
 * provider is enabled and a team it can see has an active connection.
 */
class McpTrackers
{
    /**
     * @var array<string, bool>
     */
    private array $availableByToken = [];

    public function __construct(private VisibleTeams $visibleTeams) {}

    public function available(): bool
    {
        if (! McpGrant::bound()) {
            return false;
        }

        $grant = McpGrant::current();

        return $this->availableByToken[$grant->tokenId] ??= $this->resolve($grant);
    }

    private function resolve(McpGrant $grant): bool
    {
        $providers = array_map(
            fn (IntegrationProvider $provider): string => $provider->value,
            array_values(array_filter(IntegrationProvider::enabled(), fn (IntegrationProvider $provider): bool => $provider->isTracker())),
        );

        if ($providers === []) {
            return false;
        }

        return TeamIntegration::query()
            ->whereIn('team_id', $this->visibleTeams->ids($grant))
            ->whereIn('provider', $providers)
            ->where('status', IntegrationStatus::Active->value)
            ->exists();
    }
}
