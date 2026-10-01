<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;

interface OAuthConnector
{
    public function authorizationUrl(string $state, IntegrationAccess $access, string $codeChallenge): string;

    public function connect(Team $team, User $user, IntegrationAccess $access, OAuthCallback $callback): TeamIntegration;
}
