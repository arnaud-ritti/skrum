<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Exceptions\Integrations\ConnectionRefused;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\GitHub\GitHubClient;

/**
 * Spec 8 §4.2. The installation id comes from the browser, so it is
 * accepted only when the person's own token lists it; that token is then
 * dropped. Access follows the installation's `issues` permission.
 */
class ConnectGitHub implements OAuthConnector
{
    private const string InstallationIdPattern = '/^\d{1,20}\z/';

    public function __construct(private GitHubClient $client, private SaveTeamIntegration $saveTeamIntegration) {}

    public function authorizationUrl(string $state, IntegrationAccess $access, string $codeChallenge): string
    {
        return $this->client->installationUrl($state);
    }

    public function connect(Team $team, User $user, IntegrationAccess $access, OAuthCallback $callback): TeamIntegration
    {
        $installationId = $callback->installationId;

        if ($installationId === null || preg_match(self::InstallationIdPattern, $installationId) !== 1) {
            throw new ConnectionRefused(__("This GitHub installation isn't available to your account."));
        }

        $installation = collect($this->client->userInstallations($this->client->exchangeCode($callback->code)))
            ->first(fn (array $candidate): bool => $candidate['id'] === $installationId);

        if ($installation === null) {
            throw new ConnectionRefused(__("This GitHub installation isn't available to your account."));
        }

        $current = $team->integration(IntegrationProvider::GitHub)->settings ?? [];
        $kept = ($current['installationId'] ?? null) === $installationId ? $current : [];

        $integration = $this->saveTeamIntegration->handle($team, IntegrationProvider::GitHub, $user, [
            'status' => IntegrationStatus::Active,
            'access' => $installation['canWriteIssues'] ? IntegrationAccess::Write : IntegrationAccess::Read,
            'credentials' => [],
            'settings' => [
                ...$kept,
                'installationId' => $installationId,
                'accountLogin' => $installation['accountLogin'],
                'accountType' => $installation['accountType'],
            ],
            'scopes' => [],
        ]);

        $this->client->forgetInstallationToken($installationId);
        $this->client->forgetRepositories($installationId);

        return $integration;
    }
}
