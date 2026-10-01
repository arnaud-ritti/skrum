<?php

namespace App\Support\Integrations\Jira;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterClient;
use InvalidArgumentException;

class JiraApis
{
    public function for(TeamIntegration $integration): JiraApi
    {
        return match ($integration->provider) {
            IntegrationProvider::Jira => app(JiraClient::class),
            IntegrationProvider::JiraDataCenter => app(JiraDataCenterClient::class),
            default => throw new InvalidArgumentException("{$integration->provider->value} is not a Jira connection."),
        };
    }
}
