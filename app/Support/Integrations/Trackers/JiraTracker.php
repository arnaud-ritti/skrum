<?php

namespace App\Support\Integrations\Trackers;

use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\AdfToMarkdown;
use App\Support\Integrations\Jira\JiraClient;
use LogicException;

class JiraTracker implements IssueTracker
{
    private const BaseFields = ['summary', 'description', 'assignee', 'status'];

    public function __construct(
        private JiraClient $client,
        private AdfToMarkdown $adfToMarkdown,
    ) {}

    public function containers(TeamIntegration $integration, ?string $query, int $page): array
    {
        $parameters = [
            'type' => 'scrum',
            'startAt' => (max($page, 1) - 1) * self::ContainerPageSize,
            'maxResults' => self::ContainerPageSize,
        ];

        if ($query !== null && trim($query) !== '') {
            $parameters['name'] = trim($query);
        }

        $response = $this->client->get($integration, 'rest/agile/1.0/board', $parameters);
        $containers = [];

        foreach ((array) ($response['values'] ?? []) as $board) {
            if (! is_array($board) || ! isset($board['id'])) {
                continue;
            }

            $containers[] = [
                'id' => (string) $board['id'],
                'name' => is_string($board['name'] ?? null) ? $board['name'] : (string) $board['id'],
            ];
        }

        return ['containers' => $containers, 'hasMore' => ($response['isLast'] ?? true) === false];
    }

    public function iterations(TeamIntegration $integration, string $containerId): array
    {
        if (! ctype_digit($containerId)) {
            return [];
        }

        $response = $this->client->get($integration, "rest/agile/1.0/board/{$containerId}/sprint", [
            'state' => 'active,future',
            'maxResults' => self::ContainerPageSize,
        ]);
        $iterations = [];

        foreach ((array) ($response['values'] ?? []) as $sprint) {
            if (! is_array($sprint) || ! isset($sprint['id'])) {
                continue;
            }

            $iterations[] = [
                'id' => (string) $sprint['id'],
                'name' => is_string($sprint['name'] ?? null) ? $sprint['name'] : (string) $sprint['id'],
                'state' => ($sprint['state'] ?? null) === 'active' ? 'active' : 'upcoming',
                'startsOn' => $this->day($sprint['startDate'] ?? null),
                'endsOn' => $this->day($sprint['endDate'] ?? null),
            ];
        }

        return $iterations;
    }

    public function iterationIssues(TeamIntegration $integration, string $iterationId): TrackerIssueList
    {
        return $this->searchJql($integration, 'sprint = '.(int) $iterationId.' ORDER BY Rank ASC');
    }

    public function search(TeamIntegration $integration, string $query): TrackerIssueList
    {
        return $this->searchJql($integration, $query);
    }

    public function issues(TeamIntegration $integration, array $externalIds): array
    {
        $ids = array_values(array_unique(array_filter($externalIds, fn (string $id): bool => ctype_digit($id))));
        $issues = [];

        foreach (array_chunk($ids, self::PreviewLimit) as $chunk) {
            foreach ($this->searchJql($integration, 'id in ('.implode(',', $chunk).')')->issues as $issue) {
                $issues[$issue->externalId] = $issue;
            }
        }

        return $issues;
    }

    public function writeEstimate(TeamIntegration $integration, string $externalId, ?string $estimate): void
    {
        throw new LogicException('Implemented by Plan 12c Task 6.');
    }

    /**
     * @return array<int, string>
     */
    public static function storyPointFieldIds(TeamIntegration $integration): array
    {
        $ids = [];

        foreach ((array) $integration->setting('storyPointFields', []) as $field) {
            if (is_array($field) && is_string($field['id'] ?? null)) {
                $ids[] = $field['id'];
            }
        }

        return $ids;
    }

    private function searchJql(TeamIntegration $integration, string $jql): TrackerIssueList
    {
        $response = $this->client->post($integration, 'rest/api/3/search/jql', [
            'jql' => $jql,
            'fields' => [...self::BaseFields, ...self::storyPointFieldIds($integration)],
            'maxResults' => self::PreviewLimit,
        ]);
        $issues = [];

        foreach ((array) ($response['issues'] ?? []) as $raw) {
            if (is_array($raw) && ($issue = $this->issue($integration, $raw)) !== null) {
                $issues[] = $issue;
            }
        }

        $nextPageToken = $response['nextPageToken'] ?? null;
        $truncated = (is_string($nextPageToken) && $nextPageToken !== '') || ($response['isLast'] ?? true) === false;

        return new TrackerIssueList($issues, $truncated);
    }

    /**
     * @param  array<array-key, mixed>  $raw
     */
    private function issue(TeamIntegration $integration, array $raw): ?TrackerIssue
    {
        $id = $raw['id'] ?? null;
        $key = $raw['key'] ?? null;

        if ((! is_string($id) && ! is_int($id)) || ! is_string($key)) {
            return null;
        }

        $fields = is_array($raw['fields'] ?? null) ? $raw['fields'] : [];
        $description = $fields['description'] ?? null;
        $siteUrl = rtrim((string) $integration->setting('siteUrl', ''), '/');

        return new TrackerIssue(
            externalId: (string) $id,
            key: $key,
            title: TrackerIssue::title($fields['summary'] ?? null, $key),
            description: $this->adfToMarkdown->convert(is_array($description) ? $description : null),
            url: "{$siteUrl}/browse/{$key}",
            assignee: TrackerIssue::shorten(data_get($fields, 'assignee.displayName'), TrackerIssue::AssigneeLength),
            estimate: $this->estimate($integration, $fields),
            status: TrackerIssue::shorten(data_get($fields, 'status.name'), TrackerIssue::AssigneeLength),
        );
    }

    /**
     * @param  array<array-key, mixed>  $fields
     */
    private function estimate(TeamIntegration $integration, array $fields): ?string
    {
        foreach (self::storyPointFieldIds($integration) as $fieldId) {
            $estimate = TrackerIssue::formatEstimate($fields[$fieldId] ?? null);

            if ($estimate !== null) {
                return $estimate;
            }
        }

        return null;
    }

    private function day(mixed $value): ?string
    {
        return is_string($value) && strlen($value) >= 10 ? substr($value, 0, 10) : null;
    }
}
