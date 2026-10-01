<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\GitHub\GitHubClient;
use App\Support\Integrations\IntegrationTokens;
use App\Support\Integrations\Jira\JiraClient;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterClient;
use App\Support\Integrations\Linear\LinearClient;
use App\Support\Integrations\Mattermost\MattermostClient;
use App\Support\Integrations\MicrosoftTeams\MicrosoftTeamsClient;
use App\Support\Integrations\Slack\SlackClient;
use App\Support\Integrations\Telegram\TelegramClient;
use App\Support\Integrations\Webhook\WebhookClient;

class CheckIntegration
{
    public function __construct(
        private SlackClient $slack,
        private TelegramClient $telegram,
        private JiraClient $jira,
        private JiraDataCenterClient $jiraDataCenter,
        private LinearClient $linear,
        private GitHubClient $gitHub,
        private MicrosoftTeamsClient $teams,
        private MattermostClient $mattermost,
        private WebhookClient $webhooks,
        private IntegrationTokens $tokens,
    ) {}

    public function handle(TeamIntegration $integration): void
    {
        $check = match ($integration->provider) {
            IntegrationProvider::Slack => fn () => $this->slack->authTest($integration),
            IntegrationProvider::Telegram => fn () => $this->telegram->getChat($integration),
            IntegrationProvider::Jira => fn () => $this->checkJiraSite($integration),
            IntegrationProvider::Linear => fn () => $this->linear->query($integration, 'query { viewer { id } }'),
            IntegrationProvider::MicrosoftTeams => fn () => $this->teams->ensureUsableUrl($integration),
            IntegrationProvider::Mattermost => fn () => $this->mattermost->ensureUsableUrl($integration),
            IntegrationProvider::JiraDataCenter => fn () => $this->jiraDataCenter->get($integration, 'rest/api/2/myself'),
            IntegrationProvider::GitHub => fn () => $this->gitHub->installation($integration),
            IntegrationProvider::Webhook => fn () => $this->webhooks->ensureUsableUrl($integration),
        };

        $check();

        $integration->markChecked();
    }

    private function checkJiraSite(TeamIntegration $integration): void
    {
        $integration->withReconnectHandling(function () use ($integration): void {
            $sites = $this->jira->accessibleResources($this->tokens->accessToken($integration));

            if (! in_array($integration->setting('cloudId'), array_column($sites, 'cloudId'), true)) {
                throw new ReconnectRequired(IntegrationProvider::Jira, __('This Jira site is no longer accessible.'));
            }
        });
    }
}
