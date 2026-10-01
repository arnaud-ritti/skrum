<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\ConnectionRefused;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterClient;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterServer;
use App\Support\Integrations\OAuthTokens;
use Illuminate\Support\Arr;

/**
 * OAuth 2.0 application link (spec 8 §4.1). Connecting with OAuth replaces
 * a stored personal access token: the credentials are rewritten whole.
 */
class ConnectJiraDataCenter implements OAuthConnector
{
    private const array TokenSettings = ['tokenOwner', 'tokenSavedAt'];

    public function __construct(
        private JiraDataCenterClient $client,
        private SaveTeamIntegration $saveTeamIntegration,
        private DetectJiraStoryPointFields $detectStoryPointFields,
    ) {}

    /**
     * On the same server everything the admin chose is kept (story points
     * field, export target, priority map, status sync settings).
     *
     * @param  array<string, mixed>  $current
     * @return array<string, mixed>
     */
    public static function keptSettings(array $current): array
    {
        return ($current['serverKey'] ?? null) === JiraDataCenterServer::key()
            ? Arr::except($current, self::TokenSettings)
            : [];
    }

    /**
     * @param  array<array-key, mixed>  $serverInfo
     * @return array{serverKey: string, baseUrl: string, serverTitle: string, version: string}
     */
    public static function serverSettings(array $serverInfo): array
    {
        $title = $serverInfo['serverTitle'] ?? null;

        return [
            'serverKey' => JiraDataCenterServer::key(),
            'baseUrl' => JiraDataCenterServer::baseUrl(),
            'serverTitle' => is_string($title) && trim($title) !== '' ? mb_substr(trim($title), 0, 100) : 'Jira',
            'version' => is_string($serverInfo['version'] ?? null) ? mb_substr($serverInfo['version'], 0, 30) : '',
        ];
    }

    public function authorizationUrl(string $state, IntegrationAccess $access, string $codeChallenge): string
    {
        return $this->client->authorizationUrl($state, $access, $codeChallenge);
    }

    public function connect(Team $team, User $user, IntegrationAccess $access, OAuthCallback $callback): TeamIntegration
    {
        if ($callback->codeVerifier === null) {
            throw new ConnectionRefused(__('Could not connect :provider. Try again.', ['provider' => IntegrationProvider::JiraDataCenter->label()]));
        }

        $tokens = $this->client->exchangeCode($callback->code, $callback->codeVerifier);
        $serverInfo = $this->client->probe($tokens['access_token'], 'rest/api/2/serverInfo');
        $current = $team->integration(IntegrationProvider::JiraDataCenter)->settings ?? [];

        $integration = $this->saveTeamIntegration->handle($team, IntegrationProvider::JiraDataCenter, $user, [
            'status' => IntegrationStatus::Active,
            'access' => $access,
            'credentials' => OAuthTokens::credentials($tokens),
            'settings' => [
                ...self::keptSettings($current),
                ...self::serverSettings($serverInfo),
                'authMethod' => JiraDataCenterClient::AuthMethodOAuth,
            ],
            'scopes' => $tokens['scopes'],
        ]);

        $this->detectStoryPointFields->handleQuietly($integration);

        return $integration;
    }
}
