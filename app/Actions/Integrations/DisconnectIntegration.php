<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Linear\LinearClient;
use App\Support\Integrations\Slack\SlackClient;
use App\Support\Integrations\Telegram\TelegramClient;

/**
 * Atlassian offers no revocation endpoint: the admin removes the app under
 * "Connected apps" in their Atlassian account (the dialog says so).
 */
class DisconnectIntegration
{
    public function __construct(
        private SlackClient $slack,
        private TelegramClient $telegram,
        private LinearClient $linear,
    ) {}

    public function handle(TeamIntegration $integration): void
    {
        $revoke = match ($integration->provider) {
            IntegrationProvider::Slack => fn () => $this->slack->revoke($integration),
            IntegrationProvider::Telegram => fn () => $this->leaveChatUnlessShared($integration),
            IntegrationProvider::Linear => fn () => $this->linear->revoke($integration),
            IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter, IntegrationProvider::GitHub, IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost, IntegrationProvider::Webhook => fn () => null,
        };

        $revoke();

        $integration->delete();
    }

    /**
     * Several teams may share one chat; leaving it would cut them all off.
     */
    private function leaveChatUnlessShared(TeamIntegration $integration): void
    {
        $chatIsShared = TeamIntegration::query()
            ->where('provider', IntegrationProvider::Telegram->value)
            ->where('settings->chatId', (string) $integration->setting('chatId'))
            ->whereKeyNot($integration->id)
            ->exists();

        if ($chatIsShared) {
            return;
        }

        $this->telegram->leaveChat($integration);
    }
}
