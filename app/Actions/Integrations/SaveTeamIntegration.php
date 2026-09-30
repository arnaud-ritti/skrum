<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Events\Integrations\IntegrationActivated;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Creates or replaces a team's connection to a provider. Account mappings
 * are site-specific, so moving to another Jira site or Linear organization
 * deletes them.
 */
class SaveTeamIntegration
{
    /**
     * @param  array{
     *     status: IntegrationStatus,
     *     access: IntegrationAccess,
     *     credentials: array<string, mixed>,
     *     settings: array<string, mixed>,
     *     scopes: array<int, string>
     * }  $attributes
     */
    public function handle(Team $team, IntegrationProvider $provider, User $user, array $attributes): TeamIntegration
    {
        return DB::transaction(function () use ($team, $provider, $user, $attributes): TeamIntegration {
            $existing = TeamIntegration::query()
                ->where('team_id', $team->id)
                ->where('provider', $provider->value)
                ->lockForUpdate()
                ->first();

            $wasActiveWriter = $existing !== null && $existing->canWrite();
            $previousSite = $existing?->site();

            $integration = $existing ?? new TeamIntegration;

            $integration->forceFill([
                'team_id' => $team->id,
                'provider' => $provider,
                ...$attributes,
                'connected_by_user_id' => $user->id,
                'last_error' => null,
                'last_checked_at' => now(),
            ])->save();

            $site = $integration->site();
            $siteChanged = $previousSite !== null && $site !== null && $site !== $previousSite;

            if ($siteChanged) {
                $integration->userMappings()->delete();
            }

            if ($provider->isTracker() && $integration->canWrite() && ($siteChanged || ! $wasActiveWriter)) {
                IntegrationActivated::dispatch($integration, $siteChanged);
            }

            return $integration;
        });
    }
}
