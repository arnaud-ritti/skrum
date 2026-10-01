<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\ConnectionRefused;
use App\Support\Integrations\Slack\SlackClient;

class ConnectSlack implements OAuthConnector
{
    public function __construct(private SlackClient $slack, private SaveTeamIntegration $saveTeamIntegration) {}

    public function authorizationUrl(string $state, IntegrationAccess $access, string $codeChallenge): string
    {
        return $this->slack->authorizationUrl($state);
    }

    public function connect(Team $team, User $user, IntegrationAccess $access, OAuthCallback $callback): TeamIntegration
    {
        $payload = $this->slack->exchangeCode($callback->code);
        $webhook = data_get($payload, 'incoming_webhook.url');

        if (! is_string($webhook) || ! SlackClient::isWebhookUrl($webhook)) {
            throw new ConnectionRefused(__('Slack did not return a valid channel webhook. Try again.'));
        }

        return $this->saveTeamIntegration->handle($team, IntegrationProvider::Slack, $user, [
            'status' => IntegrationStatus::Active,
            'access' => IntegrationAccess::Write,
            'credentials' => [
                'webhook_url' => $webhook,
                'access_token' => (string) data_get($payload, 'access_token', ''),
            ],
            'settings' => [
                'teamId' => (string) data_get($payload, 'team.id', ''),
                'teamName' => (string) data_get($payload, 'team.name', ''),
                'channelId' => (string) data_get($payload, 'incoming_webhook.channel_id', ''),
                'channelName' => (string) data_get($payload, 'incoming_webhook.channel', ''),
                'configurationUrl' => (string) data_get($payload, 'incoming_webhook.configuration_url', ''),
            ],
            'scopes' => array_values(array_filter(explode(',', (string) data_get($payload, 'scope', '')))),
        ]);
    }
}
