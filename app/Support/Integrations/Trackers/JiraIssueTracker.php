<?php

namespace App\Support\Integrations\Trackers;

use App\Enums\PokerDeck;
use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\JiraApi;

/**
 * Jira Cloud and Jira Server/Data Center share boards, sprints, JQL and
 * story points; they differ in the search endpoint, the description format
 * and the REST version, which the subclasses provide.
 */
abstract class JiraIssueTracker implements IssueTracker
{
    private const BaseFields = ['summary', 'description', 'assignee', 'status'];

    private const IssueIdPattern = '/^[A-Za-z0-9_-]+$/';

    abstract protected function api(): JiraApi;

    abstract protected function description(mixed $value): ?string;

    abstract protected function searchJql(TeamIntegration $integration, string $jql): TrackerIssueList;

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

        $response = $this->api()->get($integration, 'rest/agile/1.0/board', $parameters);
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

        $response = $this->api()->get($integration, "rest/agile/1.0/board/{$containerId}/sprint", [
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

    public function search(TeamIntegration $integration, string $query, ?string $containerId = null): TrackerIssueList
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
        $source = $integration->provider->label();
        $value = $estimate === null ? null : PokerDeck::numericValue($estimate);

        if ($estimate !== null && $value === null) {
            throw new EstimateRejected(__("T-shirt estimates can't be written to :source.", ['source' => $source]));
        }

        if (preg_match(self::IssueIdPattern, $externalId) !== 1) {
            throw new EstimateRejected(__('This issue was not found in :source.', ['source' => $source]));
        }

        $issuePath = $this->api()->apiPath('issue/'.rawurlencode($externalId));
        $editable = (array) ($this->api()->get($integration, "{$issuePath}/editmeta")['fields'] ?? []);
        $fieldId = collect(self::storyPointFieldIds($integration))
            ->first(fn (string $id): bool => array_key_exists($id, $editable));

        if ($fieldId === null) {
            throw new EstimateRejected(__('This issue has no story points field on its edit screen.'));
        }

        $this->api()->put($integration, $issuePath, ['fields' => [$fieldId => $value]]);
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

    /**
     * @return array<int, string>
     */
    protected function requestedFields(TeamIntegration $integration): array
    {
        return [...self::BaseFields, ...self::storyPointFieldIds($integration)];
    }

    /**
     * @param  array<array-key, mixed>  $rawIssues
     */
    protected function issueList(TeamIntegration $integration, array $rawIssues, bool $truncated): TrackerIssueList
    {
        $issues = [];

        foreach ($rawIssues as $raw) {
            if (is_array($raw) && ($issue = $this->issue($integration, $raw)) !== null) {
                $issues[] = $issue;
            }
        }

        return new TrackerIssueList($issues, $truncated);
    }

    /**
     * @param  array<array-key, mixed>  $raw
     */
    protected function issue(TeamIntegration $integration, array $raw): ?TrackerIssue
    {
        $id = $raw['id'] ?? null;
        $key = $raw['key'] ?? null;

        if ((! is_string($id) && ! is_int($id)) || ! is_string($key)) {
            return null;
        }

        $fields = is_array($raw['fields'] ?? null) ? $raw['fields'] : [];

        return new TrackerIssue(
            externalId: (string) $id,
            key: $key,
            title: TrackerIssue::title($fields['summary'] ?? null, $key),
            description: $this->description($fields['description'] ?? null),
            url: $this->api()->browseUrl($integration, rawurlencode($key)),
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
