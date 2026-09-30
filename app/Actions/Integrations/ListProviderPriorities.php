<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\JiraClient;
use App\Support\Integrations\Linear\LinearPriority;

class ListProviderPriorities
{
    private const JiraLimit = 100;

    public function __construct(private JiraClient $jira) {}

    /**
     * @return array<int, array{id: string|int, name: string}>
     */
    public function handle(TeamIntegration $integration): array
    {
        if ($integration->provider === IntegrationProvider::Linear) {
            return LinearPriority::options();
        }

        $response = $this->jira->get($integration, 'rest/api/3/priority/search', ['maxResults' => self::JiraLimit]);

        $priorities = [];

        foreach ((array) ($response['values'] ?? []) as $priority) {
            if (! is_array($priority) || ! is_string($priority['id'] ?? null) || ! is_string($priority['name'] ?? null)) {
                continue;
            }

            $priorities[] = ['id' => $priority['id'], 'name' => $priority['name']];
        }

        return $priorities;
    }
}
