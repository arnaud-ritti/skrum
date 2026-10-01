<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use InvalidArgumentException;

class OAuthConnectors
{
    public function for(IntegrationProvider $provider): OAuthConnector
    {
        return match ($provider) {
            IntegrationProvider::Slack => resolve(ConnectSlack::class),
            IntegrationProvider::Jira => resolve(ConnectJira::class),
            IntegrationProvider::Linear => resolve(ConnectLinear::class),
            IntegrationProvider::JiraDataCenter => resolve(ConnectJiraDataCenter::class),
            IntegrationProvider::GitHub => resolve(ConnectGitHub::class),
            default => throw new InvalidArgumentException("{$provider->label()} does not connect through OAuth."),
        };
    }
}
