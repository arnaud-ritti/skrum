<?php

namespace App\Support\Integrations\Trackers;

use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\JiraApi;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterClient;
use App\Support\Integrations\JiraDataCenter\WikiMarkupToMarkdown;

class JiraDataCenterTracker extends JiraIssueTracker
{
    public function __construct(private JiraDataCenterClient $client, private WikiMarkupToMarkdown $wikiMarkupToMarkdown) {}

    protected function api(): JiraApi
    {
        return $this->client;
    }

    protected function description(mixed $value): ?string
    {
        return $this->wikiMarkupToMarkdown->convert(is_string($value) ? $value : null);
    }

    protected function searchJql(TeamIntegration $integration, string $jql, ?string $cursor = null, int $limit = self::PreviewLimit): TrackerIssueList
    {
        $response = $this->client->post($integration, 'rest/api/2/search', [
            'jql' => $jql,
            'startAt' => max(0, (int) $cursor),
            'maxResults' => $limit,
            'fields' => $this->requestedFields($integration),
        ]);

        $issues = (array) ($response['issues'] ?? []);

        $next = max(0, (int) $cursor) + count($issues);
        $list = $this->issueList($integration, $issues, (int) ($response['total'] ?? 0) > $next);
        $list->nextCursor = $list->truncated && count($issues) > 0 ? (string) $next : null;

        return $list;
    }
}
