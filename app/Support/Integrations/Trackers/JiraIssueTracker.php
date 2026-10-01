<?php

namespace App\Support\Integrations\Trackers;

use App\Enums\PokerDeck;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Jira\JiraApi;
use Carbon\CarbonImmutable;

/**
 * Jira Cloud and Jira Server/Data Center share boards, sprints, JQL and
 * story points; they differ in the search endpoint, the description format
 * and the REST version, which the subclasses provide.
 */
abstract class JiraIssueTracker implements IssueTracker, SyncsIssueStatus
{
    private const BaseFields = ['summary', 'description', 'assignee', 'status', 'updated', 'project'];

    public const ProjectKeyPattern = '/^[A-Z][A-Z0-9_]{0,49}\z/';

    private const IssueIdPattern = '/^[A-Za-z0-9_-]+$/';

    /**
     * Boards, sprints and the numeric issue ids of JQL.
     */
    private const IdPattern = '/^\d{1,20}\z/';

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
        if (preg_match(self::IdPattern, $containerId) !== 1) {
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
        return $this->issuesMatching($integration, $externalIds, null);
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

    public function changedIssues(TeamIntegration $integration, array $externalIds, CarbonImmutable $since): array
    {
        return $this->issuesMatching($integration, $externalIds, $since);
    }

    public function statuses(TeamIntegration $integration, string $container): array
    {
        if (preg_match(self::ProjectKeyPattern, $container) !== 1) {
            return [];
        }

        $statuses = [];

        foreach ($this->api()->get($integration, $this->api()->apiPath("project/{$container}/statuses")) as $issueType) {
            foreach ((array) (is_array($issueType) ? ($issueType['statuses'] ?? []) : []) as $status) {
                $id = is_array($status) ? ($status['id'] ?? null) : null;

                if (! is_string($id) && ! is_int($id)) {
                    continue;
                }

                $statuses[(string) $id] = [
                    'id' => (string) $id,
                    'name' => is_string($status['name'] ?? null) ? $status['name'] : (string) $id,
                    'category' => DoneMapping::category($integration->provider, (string) data_get($status, 'statusCategory.key', 'new'))->value,
                ];
            }
        }

        return array_values($statuses);
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
            url: $this->api()->browseUrl($integration, $key),
            assignee: TrackerIssue::shorten(data_get($fields, 'assignee.displayName'), TrackerIssue::AssigneeLength),
            estimate: $this->estimate($integration, $fields),
            status: TrackerIssue::shorten(data_get($fields, 'status.name'), TrackerIssue::AssigneeLength),
            issueStatus: $this->issueStatus($fields),
        );
    }

    /**
     * Jira refuses a whole `id in (…)` query when one of the ids no longer
     * exists; that chunk is then read issue by issue, so deleted or hidden
     * issues are simply absent.
     *
     * @param  array<int, string>  $externalIds
     * @return array<string, TrackerIssue>
     */
    private function issuesMatching(TeamIntegration $integration, array $externalIds, ?CarbonImmutable $updatedSince): array
    {
        $ids = array_values(array_unique(array_filter($externalIds, fn (string $id): bool => preg_match(self::IdPattern, $id) === 1)));
        $updated = $updatedSince === null ? '' : ' AND updated >= "-'.self::minutesSince($updatedSince).'m"';
        $issues = [];

        foreach (array_chunk($ids, self::PreviewLimit) as $chunk) {
            try {
                $found = $this->searchJql($integration, 'id in ('.implode(',', $chunk).')'.$updated)->issues;
            } catch (ProviderRejected $exception) {
                if ($exception->httpStatus !== 400) {
                    throw $exception;
                }

                $found = $this->readOneByOne($integration, $chunk, $updatedSince);
            }

            foreach ($found as $issue) {
                $issues[$issue->externalId] = $issue;
            }
        }

        return $issues;
    }

    /**
     * @param  array<int, string>  $ids  digits only
     * @return array<int, TrackerIssue>
     */
    private function readOneByOne(TeamIntegration $integration, array $ids, ?CarbonImmutable $updatedSince): array
    {
        $issues = [];

        foreach ($ids as $id) {
            try {
                $raw = $this->api()->get($integration, $this->api()->apiPath("issue/{$id}"), [
                    'fields' => implode(',', $this->requestedFields($integration)),
                ]);
            } catch (ProviderRejected $exception) {
                if (in_array($exception->httpStatus, [403, 404], true)) {
                    continue;
                }

                throw $exception;
            }

            $issue = $this->issue($integration, $raw);
            $updatedAt = $issue?->issueStatus?->updatedAt;

            if ($issue === null || ($updatedSince !== null && ($updatedAt === null || $updatedAt->lt($updatedSince)))) {
                continue;
            }

            $issues[] = $issue;
        }

        return $issues;
    }

    /**
     * Relative minutes keep the query independent of the Jira user's time
     * zone; rounding up overlaps the previous read rather than missing one.
     */
    private static function minutesSince(CarbonImmutable $since): int
    {
        return max(1, (int) ceil($since->diffInSeconds(now()) / 60));
    }

    /**
     * @param  array<array-key, mixed>  $fields
     */
    private function issueStatus(array $fields): ?IssueStatus
    {
        $id = data_get($fields, 'status.id');

        if (! is_string($id) && ! is_int($id)) {
            return null;
        }

        $kind = data_get($fields, 'status.statusCategory.key');
        $project = data_get($fields, 'project.key');

        return new IssueStatus(
            id: (string) $id,
            name: TrackerIssue::shorten(data_get($fields, 'status.name'), TrackerIssue::AssigneeLength),
            kind: is_string($kind) ? $kind : 'undefined',
            container: is_string($project) ? $project : null,
            updatedAt: IssueStatus::time($fields['updated'] ?? null),
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
