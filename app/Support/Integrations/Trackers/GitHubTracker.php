<?php

namespace App\Support\Integrations\Trackers;

use App\Enums\ExternalIssueState;
use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\GitHub\EstimateBlock;
use App\Support\Integrations\GitHub\GitHubClient;
use App\Support\Integrations\Jira\AdfToMarkdown;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * GitHub Issues (spec 8 §4.2): repositories are containers, open
 * milestones iterations (`{repositoryId}/{milestone}`), issues are
 * `{repositoryId}/{number}` so renames do not break them, and the estimate
 * lives in the managed block of the body.
 */
class GitHubTracker implements IssueTracker, SyncsIssueStatus
{
    private const Source = 'GitHub';

    private const WriteAttempts = 3;

    private const IssueBatch = 100;

    private const ChangedPages = 10;

    private const IssueFields = 'fragment IssueFields on Issue { number title body url state stateReason updatedAt assignees(first: 1) { nodes { login } } }';

    private const ReferencePattern = '~^(\d{1,20})/([1-9]\d{0,9})\z~';

    /**
     * Issue numbers are written into the GraphQL query as `Int` literals,
     * which are 32-bit.
     */
    private const MaxIssueNumber = 2147483647;

    private const StatusLength = 100;

    private const RepositoryIdPattern = '/^\d{1,20}\z/';

    private const ApiRepositoryPrefix = 'https://api.github.com/repos/';

    private const WebPrefix = 'https://github.com/';

    /**
     * Anywhere in the query, also after `(` or other punctuation: the
     * repository scope and the issue type are skrum's.
     */
    private const ScopeQualifiers = '/(?<![\w-])-?(?:(?:repo|org|user|owner):[^\s()]+|(?:is|type):(?:pr|pull-?request|issue)(?![\w-]))/i';

    private const EmptyGroups = '/\(\s*\)/';

    private const UnavailableStatuses = [301, 404, 410];

    public function __construct(private GitHubClient $client) {}

    public function containers(TeamIntegration $integration, ?string $query, int $page): array
    {
        $needle = Str::lower(trim((string) $query));
        $repositories = array_values(array_filter(
            $this->client->cachedRepositories($integration),
            fn (array $repository): bool => $needle === '' || str_contains(Str::lower($repository['name']), $needle),
        ));
        $offset = (max($page, 1) - 1) * self::ContainerPageSize;

        return [
            'containers' => array_slice($repositories, $offset, self::ContainerPageSize),
            'hasMore' => count($repositories) > $offset + self::ContainerPageSize,
        ];
    }

    /**
     * The open milestone with the earliest due date from today is active.
     */
    public function iterations(TeamIntegration $integration, string $containerId): array
    {
        if (preg_match(self::RepositoryIdPattern, $containerId) !== 1) {
            return [];
        }

        $fullName = $this->client->repositoryName($integration, $containerId);
        $milestones = array_values(array_filter(
            $this->client->get($integration, "repos/{$fullName}/milestones", ['state' => 'open', 'sort' => 'due_on', 'direction' => 'asc', 'per_page' => self::PreviewLimit]),
            fn (mixed $milestone): bool => is_array($milestone) && is_int($milestone['number'] ?? null),
        ));
        $today = now()->toDateString();
        $active = collect($milestones)
            ->filter(fn (array $milestone): bool => ($this->day($milestone['due_on'] ?? null) ?? '') >= $today)
            ->sortBy(fn (array $milestone): string => (string) $this->day($milestone['due_on'] ?? null))
            ->first();

        return array_map(fn (array $milestone): array => [
            'id' => "{$containerId}/{$milestone['number']}",
            'name' => is_string($milestone['title'] ?? null) && $milestone['title'] !== ''
                ? $milestone['title']
                : __('Milestone :number', ['number' => (string) $milestone['number']]),
            'state' => $active !== null && $active['number'] === $milestone['number'] ? 'active' : 'upcoming',
            'startsOn' => null,
            'endsOn' => $this->day($milestone['due_on'] ?? null),
        ], $milestones);
    }

    public function iterationIssues(TeamIntegration $integration, string $iterationId): TrackerIssueList
    {
        $reference = self::issueReference($iterationId);

        if ($reference === null) {
            return new TrackerIssueList([], false);
        }

        [$repositoryId, $milestone] = $reference;
        $fullName = $this->client->repositoryName($integration, $repositoryId);
        $response = $this->client->response($integration, 'GET', "repos/{$fullName}/issues", [
            'milestone' => $milestone,
            'state' => 'open',
            'per_page' => self::PreviewLimit,
        ]);

        return $this->list($repositoryId, $fullName, (array) $response->json(), GitHubClient::hasNextPage($response));
    }

    public function search(TeamIntegration $integration, string $query, ?string $containerId = null): TrackerIssueList
    {
        if ($containerId === null || preg_match(self::RepositoryIdPattern, $containerId) !== 1) {
            throw ValidationException::withMessages(['container' => __('Choose a repository to search in.')]);
        }

        $fullName = $this->client->repositoryName($integration, $containerId);
        $text = (string) preg_replace(self::EmptyGroups, ' ', (string) preg_replace(self::ScopeQualifiers, ' ', $query));
        $text = trim((string) preg_replace('/\s+/', ' ', $text));
        $response = $this->client->get($integration, 'search/issues', [
            'q' => trim("{$text} repo:{$fullName} is:issue"),
            'per_page' => self::PreviewLimit,
        ]);
        $items = (array) ($response['items'] ?? []);

        return $this->list($containerId, $fullName, $items, (int) ($response['total_count'] ?? 0) > count($items) || ($response['incomplete_results'] ?? false) === true);
    }

    /**
     * Refreshes and polls read many issues: one GraphQL request per
     * repository and 100 issues instead of one REST call per issue.
     */
    public function issues(TeamIntegration $integration, array $externalIds): array
    {
        $numbersByRepository = [];

        foreach (array_unique($externalIds) as $externalId) {
            $reference = self::issueReference($externalId);

            if ($reference !== null) {
                $numbersByRepository[$reference[0]][] = $reference[1];
            }
        }

        $issues = [];

        foreach ($numbersByRepository as $repositoryId => $numbers) {
            foreach (array_chunk($numbers, self::IssueBatch) as $batch) {
                foreach ($this->fetchMany($integration, (string) $repositoryId, $batch) as $raw) {
                    $issue = $this->issue((string) $repositoryId, $raw);

                    if ($issue !== null) {
                        $issues[$issue->externalId] = $issue;
                    }
                }
            }
        }

        return $issues;
    }

    /**
     * Read-modify-write on the freshest body; the written body must come
     * back with exactly the new block and the text that was read around it,
     * otherwise an edit landed in between and the write starts over.
     */
    public function writeEstimate(TeamIntegration $integration, string $externalId, ?string $estimate): void
    {
        $reference = self::issueReference($externalId);

        if ($reference === null) {
            throw new EstimateRejected(__('This issue was not found in :source.', ['source' => self::Source]));
        }

        $integration->ensureWritable();

        for ($attempt = 1; $attempt <= self::WriteAttempts; $attempt++) {
            $issue = $this->fetch($integration, $reference[0], $reference[1]);
            $fullName = $issue === null ? null : self::fullName($issue);

            if ($issue === null || $fullName === null) {
                throw new EstimateRejected(__('This issue was not found in :source.', ['source' => self::Source]));
            }

            $body = is_string($issue['body'] ?? null) ? $issue['body'] : '';

            try {
                $written = EstimateBlock::apply($body, $estimate);
            } catch (InvalidArgumentException) {
                throw new EstimateRejected(__('This card is not an estimate.'));
            }

            if ($written === $body) {
                return;
            }

            if (mb_strlen($written) > EstimateBlock::MaxBodyLength) {
                throw new EstimateRejected(__('The issue description is too long to add the estimate.'));
            }

            $updated = $this->client->patch($integration, "repos/{$fullName}/issues/{$reference[1]}", ['body' => $written]);

            if (self::landed($updated['body'] ?? null, $written, $estimate)) {
                return;
            }
        }

        throw new EstimateRejected(__('The issue description kept changing. Try again.'));
    }

    /**
     * One listing per repository with tracked issues, matched in memory:
     * GitHub cannot filter issues by number and update time together.
     */
    public function changedIssues(TeamIntegration $integration, array $externalIds, CarbonImmutable $since): array
    {
        $numbersByRepository = [];

        foreach (array_unique($externalIds) as $externalId) {
            $reference = self::issueReference($externalId);

            if ($reference !== null) {
                $numbersByRepository[$reference[0]][$reference[1]] = true;
            }
        }

        $issues = [];

        foreach ($numbersByRepository as $repositoryId => $numbers) {
            foreach ($this->changedInRepository($integration, (string) $repositoryId, $since) as $raw) {
                if (! isset($numbers[(string) $raw['number']])) {
                    continue;
                }

                $issue = $this->issue((string) $repositoryId, $raw);

                if ($issue !== null) {
                    $issues[$issue->externalId] = $issue;
                }
            }
        }

        return $issues;
    }

    public function statuses(TeamIntegration $integration, string $container): array
    {
        return [];
    }

    public function transition(TeamIntegration $integration, string $externalId, ExternalIssueState $target): ?TrackerIssue
    {
        $reference = self::issueReference($externalId);

        if ($reference === null) {
            return null;
        }

        $raw = $this->fetch($integration, $reference[0], $reference[1]);
        $fullName = $raw === null ? null : self::fullName($raw);
        $issue = $raw === null ? null : $this->issue($reference[0], $raw);

        if ($fullName === null || $issue === null || $issue->issueStatus === null) {
            return null;
        }

        if (DoneMapping::state($integration, $issue->issueStatus) === $target) {
            return $issue;
        }

        $updated = $this->client->patch($integration, "repos/{$fullName}/issues/{$reference[1]}", $target === ExternalIssueState::Done
            ? ['state' => 'closed', 'state_reason' => 'completed']
            : ['state' => 'open']);

        return $this->issue($reference[0], $updated) ?? $issue;
    }

    /**
     * @return array{0: string, 1: string}|null
     */
    public static function issueReference(string $externalId): ?array
    {
        if (preg_match(self::ReferencePattern, $externalId, $match) !== 1 || (int) $match[2] > self::MaxIssueNumber) {
            return null;
        }

        return [$match[1], $match[2]];
    }

    /**
     * @param  array<array-key, mixed>  $issue
     */
    public static function fullName(array $issue): ?string
    {
        $url = $issue['repository_url'] ?? null;

        if (! is_string($url) || ! str_starts_with($url, self::ApiRepositoryPrefix)) {
            return null;
        }

        return GitHubClient::safeFullName(substr($url, strlen(self::ApiRepositoryPrefix)));
    }

    /**
     * @param  array<array-key, mixed>  $raw
     */
    protected function issue(string $repositoryId, array $raw): ?TrackerIssue
    {
        $number = $raw['number'] ?? null;
        $fullName = self::fullName($raw);
        $url = $raw['html_url'] ?? null;

        if (! is_int($number) || $fullName === null || ! is_string($url) || ! str_starts_with($url, self::WebPrefix."{$fullName}/issues/")) {
            return null;
        }

        $key = "{$fullName}#{$number}";
        $body = is_string($raw['body'] ?? null) ? $raw['body'] : '';
        $description = trim(EstimateBlock::strip($body));
        $estimate = EstimateBlock::value($body);

        return new TrackerIssue(
            externalId: "{$repositoryId}/{$number}",
            key: $key,
            title: TrackerIssue::title($raw['title'] ?? null, $key),
            description: $description === '' ? null : AdfToMarkdown::truncate($description),
            url: $url,
            assignee: TrackerIssue::shorten(data_get($raw, 'assignees.0.login'), TrackerIssue::AssigneeLength),
            estimate: $estimate === null ? null : mb_substr($estimate, 0, TrackerIssue::EstimateLength),
            status: TrackerIssue::shorten($raw['state'] ?? null, self::StatusLength),
            issueStatus: $this->issueStatus($repositoryId, $raw),
        );
    }

    /**
     * @return array<array-key, mixed>|null
     */
    private function fetch(TeamIntegration $integration, string $repositoryId, string $number): ?array
    {
        try {
            $issue = $this->client->get($integration, "repositories/{$repositoryId}/issues/{$number}");
        } catch (ProviderRejected $exception) {
            if (in_array($exception->httpStatus, self::UnavailableStatuses, true)) {
                return null;
            }

            throw $exception;
        }

        return isset($issue['pull_request']) ? null : $issue;
    }

    /**
     * Up to 100 issues of one repository in one GraphQL request, reshaped
     * like the REST issue so `issue()` reads both. Deleted issues and pull
     * requests come back null with a NOT_FOUND error and are left out, as is
     * a repository the installation no longer sees.
     *
     * @param  array<int, string>  $numbers  digits only (`ReferencePattern`)
     * @return array<int, array<string, mixed>>
     */
    private function fetchMany(TeamIntegration $integration, string $repositoryId, array $numbers): array
    {
        try {
            $fullName = $this->client->repositoryName($integration, $repositoryId);
        } catch (ProviderRejected $exception) {
            if (in_array($exception->httpStatus, self::UnavailableStatuses, true)) {
                return [];
            }

            throw $exception;
        }

        [$owner, $name] = explode('/', $fullName, 2);
        $aliases = implode(' ', array_map(fn (string $number): string => "i{$number}: issue(number: {$number}) { ...IssueFields }", $numbers));
        $response = $this->client->post($integration, 'graphql', [
            'query' => "query(\$owner: String!, \$name: String!) { repository(owner: \$owner, name: \$name) { {$aliases} } } ".self::IssueFields,
            'variables' => ['owner' => $owner, 'name' => $name],
        ]);
        $errors = array_filter((array) ($response['errors'] ?? []), fn (mixed $error): bool => data_get($error, 'type') !== 'NOT_FOUND');

        if ($errors !== []) {
            throw new ProviderRejected(IntegrationProvider::GitHub, 'graphql_error', 502, array_values($errors));
        }

        $issues = [];

        foreach ((array) data_get($response, 'data.repository', []) as $node) {
            if (! is_array($node)) {
                continue;
            }

            $issues[] = [
                'number' => $node['number'] ?? null,
                'title' => $node['title'] ?? null,
                'body' => $node['body'] ?? null,
                'html_url' => $node['url'] ?? null,
                'repository_url' => self::ApiRepositoryPrefix.$fullName,
                'state' => strtolower((string) ($node['state'] ?? '')),
                'state_reason' => is_string($node['stateReason'] ?? null) ? strtolower($node['stateReason']) : null,
                'updated_at' => $node['updatedAt'] ?? null,
                'assignees' => array_map(fn (mixed $assignee): array => ['login' => data_get($assignee, 'login')], (array) data_get($node, 'assignees.nodes', [])),
            ];
        }

        return $issues;
    }

    /**
     * Issues (never pull requests) of the repository updated since `$since`,
     * newest first and at most `ChangedPages` pages; items of any other
     * repository are dropped.
     *
     * @return array<int, array<array-key, mixed>>
     */
    private function changedInRepository(TeamIntegration $integration, string $repositoryId, CarbonImmutable $since): array
    {
        try {
            $fullName = $this->client->repositoryName($integration, $repositoryId);
        } catch (ProviderRejected $exception) {
            if (in_array($exception->httpStatus, self::UnavailableStatuses, true)) {
                return [];
            }

            throw $exception;
        }

        $changed = [];

        for ($page = 1; $page <= self::ChangedPages; $page++) {
            $response = $this->client->response($integration, 'GET', "repos/{$fullName}/issues", [
                'since' => $since->utc()->toIso8601ZuluString(),
                'state' => 'all',
                'sort' => 'updated',
                'direction' => 'desc',
                'per_page' => self::PreviewLimit,
                'page' => $page,
            ]);

            foreach ((array) $response->json() as $raw) {
                if (! is_array($raw) || isset($raw['pull_request']) || ! is_int($raw['number'] ?? null)) {
                    continue;
                }

                if (strcasecmp((string) self::fullName($raw), $fullName) === 0) {
                    $changed[] = $raw;
                }
            }

            if (! GitHubClient::hasNextPage($response)) {
                break;
            }
        }

        return $changed;
    }

    /**
     * Accepts the REST shape (`state_reason`, `updated_at`) and the GraphQL
     * one (`stateReason`, `updatedAt`, upper case).
     *
     * @param  array<array-key, mixed>  $raw
     */
    private function issueStatus(string $repositoryId, array $raw): ?IssueStatus
    {
        $state = strtolower((string) ($raw['state'] ?? ''));

        if (! in_array($state, ['open', 'closed'], true)) {
            return null;
        }

        $reason = strtolower((string) ($raw['state_reason'] ?? $raw['stateReason'] ?? ''));

        $kind = match (true) {
            $state === 'open' => IssueStatus::GitHubOpen,
            $reason === 'not_planned' => IssueStatus::GitHubNotPlanned,
            default => IssueStatus::GitHubCompleted,
        };

        return new IssueStatus(
            id: $state,
            name: $state,
            kind: $kind,
            container: $repositoryId,
            updatedAt: IssueStatus::time($raw['updated_at'] ?? $raw['updatedAt'] ?? null),
        );
    }

    /**
     * Line endings are compared normalised: GitHub may store the body it
     * was sent with CRLF turned into LF.
     */
    private static function landed(mixed $body, string $written, ?string $estimate): bool
    {
        $body = is_string($body) ? $body : '';

        return EstimateBlock::count($body) === ($estimate === null ? 0 : 1)
            && EstimateBlock::value($body) === $estimate
            && self::withLineFeeds(EstimateBlock::strip($body)) === self::withLineFeeds(EstimateBlock::strip($written));
    }

    private static function withLineFeeds(string $text): string
    {
        return str_replace("\r\n", "\n", $text);
    }

    /**
     * Items of any other repository are dropped: GitHub ORs `repo:`
     * qualifiers, and every item is labelled with `$repositoryId`.
     *
     * @param  array<array-key, mixed>  $items
     */
    private function list(string $repositoryId, string $fullName, array $items, bool $truncated): TrackerIssueList
    {
        $issues = [];

        foreach ($items as $raw) {
            if (! is_array($raw) || isset($raw['pull_request']) || strcasecmp((string) self::fullName($raw), $fullName) !== 0) {
                continue;
            }

            $issue = $this->issue($repositoryId, $raw);

            if ($issue !== null) {
                $issues[] = $issue;
            }
        }

        return new TrackerIssueList($issues, $truncated);
    }

    private function day(mixed $value): ?string
    {
        return is_string($value) && strlen($value) >= 10 ? substr($value, 0, 10) : null;
    }
}
