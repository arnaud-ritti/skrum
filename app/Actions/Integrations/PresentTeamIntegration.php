<?php

namespace App\Actions\Integrations;

use App\Models\TeamIntegration;
use Illuminate\Support\Arr;

class PresentTeamIntegration
{
    /**
     * Non-secret settings the integrations page may show, per provider.
     *
     * @var array<string, array<int, string>>
     */
    public const SettingKeys = [
        'slack' => ['teamName', 'channelName', 'configurationUrl'],
        'telegram' => ['chatId', 'chatTitle', 'chatType'],
        'jira' => ['cloudId', 'siteName', 'siteUrl', 'sites', 'storyPointFields', 'numberFields'],
        'linear' => ['organizationName', 'urlKey'],
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
     *     lastError: string|null
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
            'settings' => Arr::only($integration->settings, self::SettingKeys[$integration->provider->value]),
            'connectedBy' => $integration->connectedBy?->name,
            'connectedAt' => $integration->created_at?->toIso8601String(),
            'lastCheckedAt' => $integration->last_checked_at?->toIso8601String(),
            'lastError' => $integration->last_error,
        ];
    }
}
