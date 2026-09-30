<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Linear\LinearClient;
use App\Support\Integrations\OAuthTokens;

class ConnectLinear implements OAuthConnector
{
    public function __construct(private LinearClient $linear, private SaveTeamIntegration $saveTeamIntegration) {}

    public function authorizationUrl(string $state, IntegrationAccess $access): string
    {
        return $this->linear->authorizationUrl($state, $access);
    }

    public function connect(Team $team, User $user, IntegrationAccess $access, string $code): TeamIntegration
    {
        $tokens = $this->linear->exchangeCode($code);
        $organization = $this->linear->organization($tokens['access_token']);

        $current = $team->integration(IntegrationProvider::Linear)->settings ?? [];
        $kept = ($current['organizationId'] ?? null) === $organization['id'] ? $current : [];

        return $this->saveTeamIntegration->handle($team, IntegrationProvider::Linear, $user, [
            'status' => IntegrationStatus::Active,
            'access' => $access,
            'credentials' => OAuthTokens::credentials($tokens),
            'settings' => [
                ...$kept,
                'organizationId' => $organization['id'],
                'organizationName' => $organization['name'],
                'urlKey' => $organization['urlKey'],
            ],
            'scopes' => $tokens['scopes'],
        ]);
    }
}
