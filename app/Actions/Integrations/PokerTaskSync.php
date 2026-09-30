<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\JiraTracker;

/**
 * The single place that decides whether the estimate of an imported task
 * can be written back, and which write-back state it shows (spec 6 §6.5,
 * §6.6). Built once per game so presenting many tasks costs one query.
 */
class PokerTaskSync
{
    public const Synced = 'synced';

    public const Pending = 'pending';

    public const Failed = 'failed';

    public const Unsupported = 'unsupported';

    /**
     * @param  array<string, ?TeamIntegration>  $integrations  keyed by tracker provider value
     */
    private function __construct(private PokerGame $game, private array $integrations) {}

    public static function for(PokerGame $game): self
    {
        $game->loadMissing('team.integrations');

        $integrations = [];

        foreach (self::trackerProviders() as $provider) {
            $integrations[$provider->value] = $provider->isEnabled()
                ? $game->team->integrations->first(fn (TeamIntegration $integration): bool => $integration->provider === $provider)
                : null;
        }

        return new self($game, $integrations);
    }

    /**
     * @return array<int, IntegrationProvider>
     */
    public static function trackerProviders(): array
    {
        return array_values(array_filter(
            IntegrationProvider::cases(),
            fn (IntegrationProvider $provider): bool => $provider->isTracker(),
        ));
    }

    public function integration(string $source): ?TeamIntegration
    {
        return $this->integrations[$source] ?? null;
    }

    /**
     * @return array<string, array{connected: bool, canWrite: bool}|null>
     */
    public function summary(): array
    {
        $summary = [];

        foreach (self::trackerProviders() as $provider) {
            $integration = $this->integrations[$provider->value] ?? null;

            $summary[$provider->value] = $provider->isEnabled() ? [
                'connected' => $integration?->isActive() ?? false,
                'canWrite' => $integration?->canWrite() ?? false,
            ] : null;
        }

        return $summary;
    }

    public function unsupportedReason(PokerTask $task): ?string
    {
        $provider = IntegrationProvider::tryFrom((string) $task->external_source);

        if ($provider === null || ! $provider->isTracker()) {
            return __('This task can no longer be synced.');
        }

        $label = ['provider' => $provider->label()];
        $integration = $this->integrations[$provider->value] ?? null;

        if ($integration === null) {
            return __('Connect :provider in the team settings.', $label);
        }

        if ($integration->status === IntegrationStatus::ReconnectRequired) {
            return __('Reconnect :provider in the team settings.', $label);
        }

        if (! $integration->isActive()) {
            return __('Connect :provider in the team settings.', $label);
        }

        if ($integration->site() !== $task->external_site) {
            return __('This task comes from another :provider site.', $label);
        }

        if ($integration->access !== IntegrationAccess::Write) {
            return __('This :provider connection is read-only.', $label);
        }

        if (! $this->game->isNumeric()) {
            return __("T-shirt estimates can't be written to :source.", ['source' => $provider->label()]);
        }

        if ($provider === IntegrationProvider::Jira && JiraTracker::storyPointFieldIds($integration) === []) {
            return __('No story points field found.');
        }

        return null;
    }

    public function state(PokerTask $task): ?string
    {
        if ($task->external_source === null) {
            return null;
        }

        if ($this->unsupportedReason($task) !== null) {
            return self::Unsupported;
        }

        if ($task->needs_sync && $task->sync_error !== null) {
            return self::Failed;
        }

        if ($task->needs_sync) {
            return self::Pending;
        }

        return $task->synced_at !== null ? self::Synced : null;
    }
}
