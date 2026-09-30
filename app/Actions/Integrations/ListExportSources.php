<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\Team;
use App\Models\TeamIntegration;
use Illuminate\Database\Eloquent\Collection;

/**
 * The trackers an action item of a team can be exported to right now;
 * the item card shows one entry per source.
 */
class ListExportSources
{
    /**
     * @return array<int, array{source: string, label: string, integrationId: string}>
     */
    public function forTeam(Team $team): array
    {
        if (! IntegrationProvider::anyEnabled()) {
            return [];
        }

        return $team->integrations
            ->filter(fn (TeamIntegration $integration): bool => $integration->provider->isTracker()
                && $integration->provider->isEnabled()
                && $integration->canWrite())
            ->sortBy(fn (TeamIntegration $integration): string => $integration->provider->value)
            ->map(fn (TeamIntegration $integration): array => [
                'source' => $integration->provider->value,
                'label' => $integration->provider->label(),
                'integrationId' => $integration->id,
            ])
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, Team>  $teams
     * @return array<string, array<int, array{source: string, label: string, integrationId: string}>>
     */
    public function forTeams(Collection $teams): array
    {
        if (! IntegrationProvider::anyEnabled()) {
            return [];
        }

        $teams->loadMissing('integrations');

        return $teams->mapWithKeys(fn (Team $team): array => [$team->id => $this->forTeam($team)])->all();
    }
}
