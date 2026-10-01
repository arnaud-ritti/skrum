<?php

namespace App\Support\Integrations\Trackers;

use App\Enums\ExternalIssueState;
use App\Enums\PokerDeck;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\StatusPushRejected;
use App\Support\Integrations\Jira\JiraApi;
use App\Support\Integrations\Jira\JiraTransitions;
use Carbon\CarbonImmutable;

/**
 * Jira Cloud and Jira Server/Data Center share boards, sprints, JQL and
 * story points; they differ in the search endpoint, the description format
 * and the REST version, which the subclasses provide.
 */
abstract class JiraIssueTracker implements IssueTracker, SyncsIssueStatus
{
    private const BaseFields = ['summary', 'description', 'assignee', 'status', 'updated', 'project'];

    public const ProjectKeyPattern = IssueStatus::ContainerKeyPattern;

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

    public function transition(TeamIntegration $integration, string $externalId, ExternalIssueState $target): ?TrackerIssue
    {
        $issue = ctype_digit($externalId) ? $this->issueById($integration, $externalId) : null;

        if ($issue === null || $issue->issueStatus === null) {
            return null;
        }

        if (DoneMapping::state($integration, $issue->issueStatus) === $target) {
            return $issue;
        }

        $path = $this->api()->apiPath('issue/'.rawurlencode($externalId).'/transitions');
        $transitions = (array) ($this->api()->get($integration, $path, ['expand' => 'transitions.fields'])['transitions'] ?? []);
        $transition = JiraTransitions::choose($integration, $issue->issueStatus->container, $transitions, $target)
            ?? throw StatusPushRejected::unavailable($integration->provider, $issue->key, $target);

        $body = ['transition' => ['id' => (string) $transition['id']]];
        $fields = JiraTransitions::requiredFields($integration->provider, $transition, $issue->key, $target);

        if ($fields !== []) {
            $body['fields'] = $fields;
        }

        $this->api()->post($integration, $path, $body);

        return $this->readBack($integration, $externalId) ?? $issue->withStatus(new IssueStatus(
            id: (string) data_get($transition, 'to.id'),
            name: TrackerIssue::shorten(data_get($transition, 'to.name'), TrackerIssue::AssigneeLength),
            kind: (string) data_get($transition, 'to.statusCategory.key', 'undefined'),
            container: $issue->issueStatus->container,
            updatedAt: null,
        ), TrackerIssue::shorten(data_get($transition, 'to.name'), TrackerIssue::AssigneeLength));
    }

    /**
     * Reads the issue from the source on every call.
     *
     * @phpstan-impure
     */
    private function issueById(TeamIntegration $integration, string $externalId): ?TrackerIssue
    {
        return $this->issues($integration, [$externalId])[$externalId] ?? null;
    }

    /**
     * The issue right after a write, read by id: the JQL search lags behind
     * writes on Jira Cloud, a single issue read does not.
     *
     * @param  string  $externalId  digits only
     */
    private function readBack(TeamIntegration $integration, string $externalId): ?TrackerIssue
    {
        try {
            $raw = $this->api()->get($integration, $this->api()->apiPath("issue/{$externalId}"), [
                'fields' => implode(',', $this->requestedFields($integration)),
            ]);
        } catch (ProviderRejected $exception) {
            if (in_array($exception->httpStatus, [403, 404], true)) {
                return null;
            }

            throw $exception;
        }

        $issue = $this->issue($integration, $raw);

        return $issue?->issueStatus === null ? null : $issue;
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
     * Any other refusal, a rate limit included, ends the whole read: the
     * pollers keep their cursor and read every chunk again next time.
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
            foreach ($this->searchIds($integration, $chunk, $updated, true) as $issue) {
                $issues[$issue->externalId] = $issue;
            }
        }

        return $issues;
    }

    /**
     * Jira refuses a whole `id in (…)` query (400) when one of the ids was
     * deleted or is hidden. The search is retried once without the ids the
     * refusal names; when it names none, or the retry is refused too, the
     * ids are searched in halves. Refused single ids are absent. Every
     * retry halves the ids or is followed by a halving, so a chunk of 100
     * costs a few searches per bad id, never one call per issue.
     *
     * @param  array<int, string>  $ids  digits only
     * @return array<int, TrackerIssue>
     */
    private function searchIds(TeamIntegration $integration, array $ids, string $updated, bool $mayDropNamed): array
    {
        try {
            return $this->searchJql($integration, 'id in ('.implode(',', $ids).')'.$updated)->issues;
        } catch (ProviderRejected $exception) {
            if ($exception->httpStatus !== 400) {
                throw $exception;
            }
        }

        if (count($ids) === 1) {
            return [];
        }

        $named = array_values(array_intersect($ids, self::namedIds((string) $exception->detail())));

        if ($mayDropNamed && $named !== []) {
            $rest = array_values(array_diff($ids, $named));

            return $rest === [] ? [] : $this->searchIds($integration, $rest, $updated, false);
        }

        $half = intdiv(count($ids), 2);

        return [
            ...$this->searchIds($integration, array_slice($ids, 0, $half), $updated, true),
            ...$this->searchIds($integration, array_slice($ids, $half), $updated, true),
        ];
    }

    /**
     * Ids a refusal names: quoted (`'10009'`) or right after "id", "key" or
     * "issue", so an unrelated number in the message drops nothing.
     *
     * @return array<int, string>
     */
    private static function namedIds(string $detail): array
    {
        preg_match_all('/[\'"](\d{1,20})[\'"]|\b(?:id|key|issue)\s*[:=#]?\s*(\d{1,20})\b/i', $detail, $matches);

        return array_values(array_filter([...$matches[1], ...$matches[2]], fn (string $id): bool => $id !== ''));
    }

    /**
     * Relative minutes keep the query independent of the Jira user's time
     * zone; rounding up plus one minute covers the time until Jira runs the
     * query, so reads overlap rather than miss a change.
     */
    private static function minutesSince(CarbonImmutable $since): int
    {
        return max(1, (int) ceil($since->diffInSeconds(now()) / 60) + 1);
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
