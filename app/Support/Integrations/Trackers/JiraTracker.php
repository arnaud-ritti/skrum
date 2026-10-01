<?php

namespace App\Support\Integrations\Trackers;

use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\AdfToMarkdown;
use App\Support\Integrations\Jira\JiraApi;
use App\Support\Integrations\Jira\JiraClient;

class JiraTracker extends JiraIssueTracker
{
    public function __construct(private JiraClient $client, private AdfToMarkdown $adfToMarkdown) {}

    protected function api(): JiraApi
    {
        return $this->client;
    }

    protected function description(mixed $value): ?string
    {
        return $this->adfToMarkdown->convert(is_array($value) ? $value : null);
    }

    protected function searchJql(TeamIntegration $integration, string $jql): TrackerIssueList
    {
        $response = $this->client->post($integration, 'rest/api/3/search/jql', [
            'jql' => $jql,
            'fields' => $this->requestedFields($integration),
            'maxResults' => self::PreviewLimit,
        ]);

        $nextPageToken = $response['nextPageToken'] ?? null;
        $truncated = (is_string($nextPageToken) && $nextPageToken !== '') || ($response['isLast'] ?? true) === false;

        return $this->issueList($integration, (array) ($response['issues'] ?? []), $truncated);
    }
}
