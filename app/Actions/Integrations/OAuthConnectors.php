<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use InvalidArgumentException;

class OAuthConnectors
{
    public function for(IntegrationProvider $provider): OAuthConnector
    {
        return match ($provider) {
            IntegrationProvider::Slack => app(ConnectSlack::class),
            IntegrationProvider::Jira => app(ConnectJira::class),
            IntegrationProvider::Linear => app(ConnectLinear::class),
            default => throw new InvalidArgumentException("{$provider->label()} does not connect through OAuth."),
        };
    }
}
