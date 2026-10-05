<?php

namespace App\Actions\Admin;

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\TeamIntegration;
use App\Support\InstanceConfiguration\ConfigurationCatalogue;
use App\Support\InstanceConfiguration\InstanceConfiguration;
use Illuminate\Support\Collection;

class PresentIntegrationSettings
{
    public function __construct(
        private ConfigurationCatalogue $catalogue,
        private InstanceConfiguration $configuration,
    ) {}

    /**
     * Every integration provider with its instance-level state, never a secret's value (rule S5).
     *
     * @return array<int, array{
     *     key: string,
     *     label: string,
     *     configured: bool,
     *     enabled: bool,
     *     connectedTeams: int,
     *     fields: array<string, array<string, mixed>>,
     *     callbackUrl: ?string,
     *     webhookUrl: ?string,
     *     updateUrl: string
     * }>
     */
    public function handle(): array
    {
        $connectedTeams = $this->connectedTeams();

        return array_map(fn (IntegrationProvider $provider): array => [
            'key' => $provider->value,
            'label' => $provider->label(),
            'configured' => $provider->isConfigured(),
            'enabled' => $provider->isEnabled(),
            'connectedTeams' => $connectedTeams[$provider->value] ?? 0,
            'fields' => $this->configuration->describe($this->catalogue->section($provider)),
            'callbackUrl' => $this->callbackUrl($provider),
            'webhookUrl' => $this->webhookUrl($provider),
            'updateUrl' => route('admin.integrationApps.update', $provider->value),
        ], IntegrationProvider::cases());
    }

    /**
     * The number of teams with an active integration, per provider value.
     *
     * @return array<string, int>
     */
    private function connectedTeams(): array
    {
        return TeamIntegration::query()
            ->where('status', IntegrationStatus::Active)
            ->toBase()
            ->get(['provider', 'team_id'])
            ->groupBy('provider')
            ->map(fn (Collection $rows): int => $rows->unique('team_id')->count())
            ->all();
    }

    private function callbackUrl(IntegrationProvider $provider): ?string
    {
        $configKey = match ($provider) {
            IntegrationProvider::Slack => 'services.slack.redirect',
            IntegrationProvider::Jira => 'services.jira.redirect',
            IntegrationProvider::Linear => 'services.linear.redirect',
            IntegrationProvider::JiraDataCenter => 'services.jira_dc.redirect',
            IntegrationProvider::GitHub => 'services.github_app.redirect',
            default => null,
        };

        if ($configKey === null) {
            return null;
        }

        return (string) config($configKey);
    }

    private function webhookUrl(IntegrationProvider $provider): ?string
    {
        if (! in_array($provider, [IntegrationProvider::Linear, IntegrationProvider::GitHub], true)) {
            return null;
        }

        return route('integrations.webhooks.store', $provider->value);
    }
}
