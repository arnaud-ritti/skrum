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

    protected function searchJql(TeamIntegration $integration, string $jql): TrackerIssueList
    {
        $response = $this->client->post($integration, 'rest/api/2/search', [
            'jql' => $jql,
            'startAt' => 0,
            'maxResults' => self::PreviewLimit,
            'fields' => $this->requestedFields($integration),
        ]);

        $issues = (array) ($response['issues'] ?? []);

        return $this->issueList($integration, $issues, (int) ($response['total'] ?? 0) > count($issues));
    }
}
