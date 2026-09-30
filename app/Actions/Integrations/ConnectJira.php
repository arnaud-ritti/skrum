<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\ConnectionRefused;
use App\Support\Integrations\Jira\JiraClient;
use App\Support\Integrations\OAuthTokens;
use Illuminate\Support\Arr;

class ConnectJira implements OAuthConnector
{
    public function __construct(
        private JiraClient $jira,
        private SaveTeamIntegration $saveTeamIntegration,
        private DetectJiraStoryPointFields $detectStoryPointFields,
    ) {}

    /**
     * Settings for a chosen site: everything is kept on the same site
     * (export target, priority map, story points choice), nothing on
     * another one.
     *
     * @param  array<string, mixed>  $current
     * @param  array{cloudId: string, url: string, name: string}  $site
     * @return array<string, mixed>
     */
    public static function siteSettings(array $current, array $site): array
    {
        $kept = ($current['cloudId'] ?? null) === $site['cloudId'] ? Arr::except($current, ['sites']) : [];

        return [...$kept, 'cloudId' => $site['cloudId'], 'siteUrl' => $site['url'], 'siteName' => $site['name']];
    }

    public function authorizationUrl(string $state, IntegrationAccess $access): string
    {
        return $this->jira->authorizationUrl($state, $access);
    }

    public function connect(Team $team, User $user, IntegrationAccess $access, string $code): TeamIntegration
    {
        $tokens = $this->jira->exchangeCode($code);
        $sites = $this->jira->accessibleResources($tokens['access_token']);

        if ($sites === []) {
            throw new ConnectionRefused(__('This Atlassian account has no Jira site.'));
        }

        $current = $team->integration(IntegrationProvider::Jira)->settings ?? [];
        $site = count($sites) === 1
            ? $sites[0]
            : collect($sites)->first(fn (array $candidate): bool => $candidate['cloudId'] === ($current['cloudId'] ?? null));

        $integration = $this->saveTeamIntegration->handle($team, IntegrationProvider::Jira, $user, [
            'status' => $site === null ? IntegrationStatus::SetupRequired : IntegrationStatus::Active,
            'access' => $access,
            'credentials' => OAuthTokens::credentials($tokens),
            'settings' => $site === null ? [...$current, 'sites' => $sites] : self::siteSettings($current, $site),
            'scopes' => $tokens['scopes'],
        ]);

        if ($integration->isActive()) {
            $this->detectStoryPointFields->handleQuietly($integration);
        }

        return $integration;
    }
}
