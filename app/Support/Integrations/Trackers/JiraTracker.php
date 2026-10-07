<?php

namespace App\Support\Integrations\Trackers;

use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\AdfToMarkdown;
use App\Support\Integrations\Jira\JiraApi;
use App\Support\Integrations\Jira\JiraClient;

class JiraTracker extends JiraIssueTracker
{
    public function __construct(private JiraClient $client, private AdfToMarkdown $adfToMarkdown) {}

    public function projects(TeamIntegration $integration, ?string $query, int $page): array
    {
        $response = $this->client->get($integration, 'rest/api/3/project/search', [
            'startAt' => (max(1, $page) - 1) * self::ContainerPageSize,
            'maxResults' => self::ContainerPageSize,
            ...(filled($query) ? ['query' => trim($query)] : []),
        ]);
        $projects = array_values(array_filter((array) ($response['values'] ?? []), fn (mixed $project): bool => is_array($project) && isset($project['id']) && is_string($project['name'] ?? null)));

        return [
            'containers' => array_map(fn (array $project): array => ['id' => (string) $project['id'], 'name' => $project['name']], $projects),
            'hasMore' => ($response['isLast'] ?? true) === false,
        ];
    }

    protected function api(): JiraApi
    {
        return $this->client;
    }

    protected function description(mixed $value): ?string
    {
        return $this->adfToMarkdown->convert(is_array($value) ? $value : null);
    }

    protected function searchJql(TeamIntegration $integration, string $jql, ?string $cursor = null, int $limit = self::PreviewLimit): TrackerIssueList
    {
        $response = $this->client->post($integration, 'rest/api/3/search/jql', [
            'jql' => $jql,
            'fields' => $this->requestedFields($integration),
            'maxResults' => $limit,
            ...($cursor !== null ? ['nextPageToken' => $cursor] : []),
        ]);

        $nextPageToken = $response['nextPageToken'] ?? null;
        $truncated = (is_string($nextPageToken) && $nextPageToken !== '') || ($response['isLast'] ?? true) === false;

        $list = $this->issueList($integration, (array) ($response['issues'] ?? []), $truncated);
        $list->nextCursor = $truncated && is_string($nextPageToken) ? $nextPageToken : null;

        return $list;
    }
}
