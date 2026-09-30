<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\Team;
use App\Models\TeamIntegration;

/**
 * Spec 6 §9.1 / spec 5 §6.2: status and capabilities of the team's tracker
 * connections, never credentials, settings or provider errors.
 */
class ListPokerSources
{
    /**
     * @return array<int, array{
     *     source: string,
     *     siteName: ?string,
     *     status: string,
     *     access: string,
     *     canImport: bool,
     *     canWriteBack: bool,
     *     writeBackUnavailableReason: ?string
     * }>
     */
    public function handle(Team $team): array
    {
        $team->loadMissing('integrations');

        $sources = [];

        foreach (IntegrationProvider::enabled() as $provider) {
            if (! $provider->isTracker()) {
                continue;
            }

            $integration = $team->integrations->first(fn (TeamIntegration $integration): bool => $integration->provider === $provider);

            if ($integration === null) {
                continue;
            }

            $reason = PokerTaskSync::writeBackUnavailableReason($provider, $integration);

            $sources[] = [
                'source' => $provider->value,
                'siteName' => $this->siteName($integration),
                'status' => $integration->status->value,
                'access' => $integration->access->value,
                'canImport' => $integration->isActive(),
                'canWriteBack' => $reason === null,
                'writeBackUnavailableReason' => $reason,
            ];
        }

        return $sources;
    }

    private function siteName(TeamIntegration $integration): ?string
    {
        $name = match ($integration->provider) {
            IntegrationProvider::Jira => $integration->setting('siteName'),
            IntegrationProvider::Linear => $integration->setting('organizationName'),
            default => null,
        };

        return is_string($name) ? $name : null;
    }
}
