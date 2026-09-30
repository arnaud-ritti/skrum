<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\IntegrationTokens;
use App\Support\Integrations\Jira\JiraClient;
use App\Support\Integrations\Linear\LinearClient;
use App\Support\Integrations\Slack\SlackClient;
use App\Support\Integrations\Telegram\TelegramClient;

class CheckIntegration
{
    public function __construct(
        private SlackClient $slack,
        private TelegramClient $telegram,
        private JiraClient $jira,
        private LinearClient $linear,
        private IntegrationTokens $tokens,
    ) {}

    public function handle(TeamIntegration $integration): void
    {
        $check = match ($integration->provider) {
            IntegrationProvider::Slack => fn () => $this->slack->authTest($integration),
            IntegrationProvider::Telegram => fn () => $this->telegram->getChat($integration),
            IntegrationProvider::Jira => fn () => $this->checkJiraSite($integration),
            IntegrationProvider::Linear => fn () => $this->linear->query($integration, 'query { viewer { id } }'),
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
