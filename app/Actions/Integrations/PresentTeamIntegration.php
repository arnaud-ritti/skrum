<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\GitHub\GitHubClient;
use App\Support\Integrations\InboundModes;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterClient;
use App\Support\Integrations\StatusSync;
use Illuminate\Support\Arr;

class PresentTeamIntegration
{
    public function __construct(
        private GitHubClient $gitHub,
        private InboundModes $inboundModes,
    ) {}

    /**
     * Non-secret settings the integrations page may show, per provider.
     *
     * @var array<string, array<int, string>>
     */
    public const SettingKeys = [
        'slack' => ['teamName', 'channelName', 'configurationUrl'],
        'telegram' => ['chatId', 'chatTitle', 'chatType'],
        'jira' => ['cloudId', 'siteName', 'siteUrl', 'sites', 'storyPointFields', 'numberFields', 'priorityMap', 'treatCanceledAsDone', 'statusMapping'],
        'linear' => ['organizationName', 'urlKey', 'priorityMap', 'treatCanceledAsDone', 'statusMapping'],
        'jira_dc' => ['serverTitle', 'version', 'baseUrl', 'authMethod', 'storyPointFields', 'numberFields', 'priorityMap', 'treatCanceledAsDone', 'statusMapping'],
        'github' => ['installationId', 'accountLogin', 'accountType', 'exportRepositoryId', 'priorityLabels', 'treatCanceledAsDone'],
        'msteams' => ['host', 'channelLabel'],
        'mattermost' => ['host', 'channelLabel'],
        'webhook' => ['host', 'channelLabel', 'secretCreatedAt', 'events', 'disabledReason'],
    ];

    /** @var array<string, string> */
    private const array StartTargetKeys = [
        'projects' => 'startStatusId',
        'teams' => 'startStateId',
    ];

    /**
     * @return array{
     *     id: string,
     *     provider: string,
     *     status: string,
     *     statusLabel: string,
     *     access: string,
     *     settings: array<string, mixed>,
     *     connectedBy: string|null,
     *     connectedAt: string|null,
     *     lastCheckedAt: string|null,
     *     lastError: string|null,
     *     webhook: array{consecutiveFailures: int, lastDeliverySucceededAt: string|null}|null,
     *     statusSync: bool,
     *     inboundMode: string,
     *     webhookStatus: ?string,
     *     lastInboundAt: ?string,
     *     lastPolledAt: ?string,
     *     inboundHint: ?string
     * }
     */
    public function handle(TeamIntegration $integration): array
    {
        return [
            'id' => $integration->id,
            'provider' => $integration->provider->value,
            'status' => $integration->status->value,
            'statusLabel' => $integration->status->label(),
            'access' => $integration->access->value,
            'settings' => $this->settings($integration),
            'connectedBy' => $integration->connectedBy?->name,
            'connectedAt' => $integration->created_at?->toIso8601String(),
            'lastCheckedAt' => $integration->last_checked_at?->toIso8601String(),
            'lastError' => $integration->last_error,
            'webhook' => $this->webhookHealth($integration),
            'statusSync' => StatusSync::isOn($integration),
            'inboundMode' => $integration->inbound_mode->value,
            'webhookStatus' => $integration->webhook_status?->value,
            'lastInboundAt' => $integration->last_inbound_at?->toIso8601String(),
            'lastPolledAt' => $integration->last_polled_at?->toIso8601String(),
            'inboundHint' => $this->inboundModes->hint($integration),
        ];
    }

    /**
     * @return array{consecutiveFailures: int, lastDeliverySucceededAt: string|null}|null
     */
    private function webhookHealth(TeamIntegration $integration): ?array
    {
        if ($integration->provider !== IntegrationProvider::Webhook) {
            return null;
        }

        return [
            'consecutiveFailures' => $integration->consecutive_failures,
            'lastDeliverySucceededAt' => $integration->last_delivery_succeeded_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function settings(TeamIntegration $integration): array
    {
        $settings = Arr::only($integration->settings, self::SettingKeys[$integration->provider->value]);

        if (is_array($settings['statusMapping'] ?? null)) {
            $settings['statusMapping'] = $this->statusMapping($settings['statusMapping']);
        }

        if ($integration->provider === IntegrationProvider::JiraDataCenter && $integration->setting('authMethod') === JiraDataCenterClient::AuthMethodToken) {
            $settings['tokenOwner'] = $integration->setting('tokenOwner.displayName');
            $settings['tokenSavedAt'] = $integration->setting('tokenSavedAt');
        }

        if ($integration->provider === IntegrationProvider::GitHub) {
            $settings['exportRepositoryName'] = $this->exportRepositoryName($integration);
        }

        return $settings;
    }

    /**
     * Spec 24 §6.4: a mapping saved before the start target existed reads it as null.
     *
     * @param  array<array-key, mixed>  $mapping
     * @return array<array-key, mixed>
     */
    private function statusMapping(array $mapping): array
    {
        foreach (self::StartTargetKeys as $group => $startKey) {
            if (! is_array($mapping[$group] ?? null)) {
                continue;
            }

            $mapping[$group] = array_map(
                fn (mixed $entry): mixed => is_array($entry) ? [$startKey => null, ...$entry] : $entry,
                $mapping[$group],
            );
        }

        return $mapping;
    }

    private function exportRepositoryName(TeamIntegration $integration): ?string
    {
        $installationId = $integration->setting('installationId');
        $repositoryId = $integration->setting('exportRepositoryId');

        if (! is_string($installationId) || ! is_string($repositoryId)) {
            return null;
        }

        $savedName = $integration->setting('exportRepositoryName');

        return $this->gitHub->knownRepositoryName($installationId, $repositoryId) ?? (is_string($savedName) ? $savedName : null);
    }
}
