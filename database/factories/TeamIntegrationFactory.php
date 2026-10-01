<?php

namespace Database\Factories;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\JiraClient;
use App\Support\Integrations\Linear\LinearClient;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TeamIntegration>
 */
class TeamIntegrationFactory extends Factory
{
    public const MicrosoftTeamsUrl = 'https://prod-12.westeurope.logic.azure.com:443/workflows/abc123/triggers/manual/paths/invoke?api-version=2016-06-01&sig=teams-signature';

    public const MattermostUrl = 'https://chat.example.com/hooks/abcdefghijklmnopqrstuvwxyz';

    public const WebhookUrl = 'https://hooks.example.com/skrum/incoming';

    public const WebhookSecret = '0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0';

    public function microsoftTeams(): static
    {
        return $this->state(fn () => [
            'provider' => IntegrationProvider::MicrosoftTeams,
            'status' => IntegrationStatus::Active,
            'access' => IntegrationAccess::Write,
            'credentials' => ['url' => self::MicrosoftTeamsUrl],
            'settings' => ['host' => 'prod-12.westeurope.logic.azure.com', 'channelLabel' => '#retros'],
            'scopes' => [],
        ]);
    }

    public function mattermost(): static
    {
        return $this->state(fn () => [
            'provider' => IntegrationProvider::Mattermost,
            'status' => IntegrationStatus::Active,
            'access' => IntegrationAccess::Write,
            'credentials' => ['url' => self::MattermostUrl],
            'settings' => ['host' => 'chat.example.com', 'channelLabel' => 'town-square'],
            'scopes' => [],
        ]);
    }

    /**
     * @param  array<int, string>  $events
     */
    public function webhook(array $events = []): static
    {
        return $this->state(fn () => [
            'provider' => IntegrationProvider::Webhook,
            'status' => IntegrationStatus::Active,
            'access' => IntegrationAccess::Write,
            'credentials' => ['url' => self::WebhookUrl, 'webhookSecret' => self::WebhookSecret],
            'settings' => [
                'host' => 'hooks.example.com',
                'channelLabel' => null,
                'secretCreatedAt' => '2026-10-01T09:00:00Z',
                'events' => $events,
            ],
            'scopes' => [],
        ]);
    }

    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            ...$this->slackAttributes(),
        ];
    }

    public function slack(): static
    {
        return $this->state(fn () => $this->slackAttributes());
    }

    public function telegram(): static
    {
        return $this->state(fn () => [
            'provider' => IntegrationProvider::Telegram,
            'status' => IntegrationStatus::Active,
            'access' => IntegrationAccess::Write,
            'credentials' => [],
            'settings' => ['chatId' => '-100123', 'chatTitle' => 'Team chat', 'chatType' => 'supergroup'],
            'scopes' => [],
        ]);
    }

    public function jira(IntegrationAccess $access = IntegrationAccess::Write): static
    {
        return $this->state(fn () => [
            'provider' => IntegrationProvider::Jira,
            'status' => IntegrationStatus::Active,
            'access' => $access,
            'credentials' => ['access_token' => 'jira-access', 'refresh_token' => 'jira-refresh', 'expires_at' => now()->addHour()->getTimestamp()],
            'settings' => [
                'cloudId' => 'cloud-1',
                'siteUrl' => 'https://acme.atlassian.net',
                'siteName' => 'Acme',
                'storyPointFields' => [['id' => 'customfield_10016', 'name' => 'Story point estimate']],
                'numberFields' => [['id' => 'customfield_10016', 'name' => 'Story point estimate']],
            ],
            'scopes' => JiraClient::scopesFor($access),
        ]);
    }

    public function linear(IntegrationAccess $access = IntegrationAccess::Write): static
    {
        return $this->state(fn () => [
            'provider' => IntegrationProvider::Linear,
            'status' => IntegrationStatus::Active,
            'access' => $access,
            'credentials' => ['access_token' => 'linear-access', 'refresh_token' => null, 'expires_at' => null],
            'settings' => ['organizationId' => 'org-1', 'organizationName' => 'Acme', 'urlKey' => 'acme'],
            'scopes' => LinearClient::scopesFor($access),
        ]);
    }

    public function setupRequired(): static
    {
        return $this->jira()->state(fn () => [
            'status' => IntegrationStatus::SetupRequired,
            'settings' => ['sites' => [
                ['cloudId' => 'cloud-1', 'url' => 'https://acme.atlassian.net', 'name' => 'Acme'],
                ['cloudId' => 'cloud-2', 'url' => 'https://beta.atlassian.net', 'name' => 'Beta'],
            ]],
        ]);
    }

    public function reconnectRequired(string $error = 'token_revoked'): static
    {
        return $this->state(fn () => ['status' => IntegrationStatus::ReconnectRequired, 'last_error' => $error]);
    }

    public function expiring(): static
    {
        return $this->state(fn (array $attributes) => [
            'credentials' => [...$attributes['credentials'], 'expires_at' => now()->addSeconds(30)->getTimestamp()],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function slackAttributes(): array
    {
        return [
            'provider' => IntegrationProvider::Slack,
            'status' => IntegrationStatus::Active,
            'access' => IntegrationAccess::Write,
            'credentials' => ['webhook_url' => 'https://hooks.slack.com/services/T000/B000/XXXX', 'access_token' => 'xoxp-test-token'],
            'settings' => [
                'teamId' => 'T000',
                'teamName' => 'Acme',
                'channelId' => 'C000',
                'channelName' => '#retros',
                'configurationUrl' => 'https://acme.slack.com/services/B000',
            ],
            'scopes' => ['incoming-webhook'],
        ];
    }
}
