<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\JiraApis;
use App\Support\Integrations\Linear\LinearPriority;

class ListProviderPriorities
{
    private const JiraLimit = 100;

    public function __construct(private JiraApis $jiraApis) {}

    /**
     * @return array<int, array{id: string|int, name: string}>
     */
    public function handle(TeamIntegration $integration): array
    {
        if ($integration->provider === IntegrationProvider::Linear) {
            return LinearPriority::options();
        }

        $api = $this->jiraApis->for($integration);

        $listed = $integration->provider === IntegrationProvider::JiraDataCenter
            ? $api->get($integration, $api->apiPath('priority'))
            : (array) ($api->get($integration, $api->apiPath('priority/search'), ['maxResults' => self::JiraLimit])['values'] ?? []);

        $priorities = [];

        foreach ($listed as $priority) {
            if (! is_array($priority) || ! is_string($priority['id'] ?? null) || ! is_string($priority['name'] ?? null)) {
                continue;
            }

            $priorities[] = ['id' => $priority['id'], 'name' => $priority['name']];
        }

        return $priorities;
    }
}
