<?php

namespace App\Support\Integrations\Trackers;

use App\Enums\ExternalIssueState;
use App\Enums\PokerDeck;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\StatusPushRejected;
use App\Support\Integrations\Jira\AdfToMarkdown;
use App\Support\Integrations\Linear\LinearClient;
use Carbon\CarbonImmutable;

class LinearTracker implements IssueTracker, SyncsIssueStatus
{
    private const IssueFields = 'id identifier title description url estimate updatedAt assignee { displayName } state { id name type } team { key }';

    public const TeamKeyPattern = '/^[A-Z][A-Z0-9_]{0,49}\z/';

    private const MaxTeams = 250;

    private const MaxEstimate = 64;

    public function __construct(private LinearClient $client) {}

    public function containers(TeamIntegration $integration, ?string $query, int $page): array
    {
        $filter = $query !== null && trim($query) !== '' ? ['name' => ['containsIgnoreCase' => trim($query)]] : null;

        $data = $this->client->query(
            $integration,
            'query($filter: TeamFilter) { teams(first: '.self::MaxTeams.', filter: $filter) { nodes { id name } } }',
            ['filter' => $filter],
        );

        $teams = [];

        foreach ((array) data_get($data, 'teams.nodes', []) as $team) {
            if (is_array($team) && is_string($team['id'] ?? null)) {
                $teams[] = ['id' => $team['id'], 'name' => is_string($team['name'] ?? null) ? $team['name'] : $team['id']];
            }
        }

        $offset = (max($page, 1) - 1) * self::ContainerPageSize;

        return [
            'containers' => array_slice($teams, $offset, self::ContainerPageSize),
            'hasMore' => count($teams) > $offset + self::ContainerPageSize,
        ];
    }

    public function iterations(TeamIntegration $integration, string $containerId): array
    {
        $data = $this->client->query(
            $integration,
            'query($id: String!) { team(id: $id) { cycles(first: 50, filter: {or: [{isActive: {eq: true}}, {isFuture: {eq: true}}]}) { nodes { id name number startsAt endsAt isActive } } } }',
            ['id' => $containerId],
        );

        $cycles = array_values(array_filter(
            (array) data_get($data, 'team.cycles.nodes', []),
            fn (mixed $cycle): bool => is_array($cycle) && is_string($cycle['id'] ?? null),
        ));

        usort($cycles, fn (array $first, array $second): int => strcmp((string) ($first['startsAt'] ?? ''), (string) ($second['startsAt'] ?? '')));

        return array_map(fn (array $cycle): array => [
            'id' => $cycle['id'],
            'name' => is_string($cycle['name'] ?? null) && $cycle['name'] !== ''
                ? $cycle['name']
                : __('Cycle :number', ['number' => (string) ($cycle['number'] ?? '')]),
            'state' => ($cycle['isActive'] ?? false) === true ? 'active' : 'upcoming',
            'startsOn' => $this->day($cycle['startsAt'] ?? null),
            'endsOn' => $this->day($cycle['endsAt'] ?? null),
        ], $cycles);
    }

    public function iterationIssues(TeamIntegration $integration, string $iterationId): TrackerIssueList
    {
        $data = $this->client->query(
            $integration,
            'query($id: String!) { cycle(id: $id) { issues(first: '.self::PreviewLimit.') { nodes { '.self::IssueFields.' } pageInfo { hasNextPage } } } }',
            ['id' => $iterationId],
        );

        return $this->list((array) data_get($data, 'cycle.issues', []));
    }

    public function search(TeamIntegration $integration, string $query, ?string $containerId = null): TrackerIssueList
    {
        $data = $this->client->query(
            $integration,
            'query($term: String!) { searchIssues(term: $term, first: '.self::PreviewLimit.') { nodes { '.self::IssueFields.' } pageInfo { hasNextPage } } }',
            ['term' => $query],
        );

        return $this->list((array) data_get($data, 'searchIssues', []));
    }

    public function issues(TeamIntegration $integration, array $externalIds): array
    {
        $issues = [];

        foreach (array_chunk(array_values(array_unique($externalIds)), self::PreviewLimit) as $chunk) {
            $data = $this->client->query(
                $integration,
                'query($ids: [ID!]) { issues(first: '.self::PreviewLimit.', filter: {id: {in: $ids}}) { nodes { '.self::IssueFields.' } } }',
                ['ids' => $chunk],
            );

            foreach ($this->list((array) data_get($data, 'issues', []))->issues as $issue) {
                $issues[$issue->externalId] = $issue;
            }
        }

        return $issues;
    }

    public function writeEstimate(TeamIntegration $integration, string $externalId, ?string $estimate): void
    {
        $data = $this->client->query(
            $integration,
            'query($id: String!) { issue(id: $id) { team { issueEstimationType issueEstimationAllowZero } } }',
            ['id' => $externalId],
        );
        $team = data_get($data, 'issue.team');

        if (! is_array($team)) {
            throw new EstimateRejected(__('This issue was not found in :source.', ['source' => 'Linear']));
        }

        if (($team['issueEstimationType'] ?? 'notUsed') === 'notUsed') {
            throw new EstimateRejected(__('Estimates are turned off for this Linear team.'));
        }

        $value = $this->linearEstimate($estimate, ($team['issueEstimationAllowZero'] ?? false) === true);

        try {
            $result = $this->client->query(
                $integration,
                'mutation($id: String!, $estimate: Int) { issueUpdate(id: $id, input: {estimate: $estimate}) { success } }',
                ['id' => $externalId, 'estimate' => $value],
            );
        } catch (ProviderRejected $exception) {
            throw new EstimateRejected(__('Linear rejected this estimate: :message', ['message' => $exception->userMessage()]));
        }

        if (data_get($result, 'issueUpdate.success') !== true) {
            throw new EstimateRejected(__('Linear did not accept this estimate.'));
        }
    }

    public function changedIssues(TeamIntegration $integration, array $externalIds, CarbonImmutable $since): array
    {
        $issues = [];

        foreach (array_chunk(array_values(array_unique($externalIds)), self::PreviewLimit) as $chunk) {
            $data = $this->client->query(
                $integration,
                'query($ids: [ID!], $since: DateTimeOrDuration) { issues(first: '.self::PreviewLimit.', filter: {id: {in: $ids}, updatedAt: {gte: $since}}) { nodes { '.self::IssueFields.' } } }',
                ['ids' => $chunk, 'since' => $since->utc()->toIso8601ZuluString()],
            );

            foreach ($this->list((array) data_get($data, 'issues', []))->issues as $issue) {
                $issues[$issue->externalId] = $issue;
            }
        }

        return $issues;
    }

    public function statuses(TeamIntegration $integration, string $container): array
    {
        if (preg_match(self::TeamKeyPattern, $container) !== 1) {
            return [];
        }

        $data = $this->client->query(
            $integration,
            'query($key: String!) { teams(first: 1, filter: {key: {eq: $key}}) { nodes { states(first: 100) { nodes { id name type position } } } } }',
            ['key' => $container],
        );

        return array_map(fn (array $state): array => [
            'id' => $state['id'],
            'name' => $state['name'],
            'category' => DoneMapping::category($integration->provider, $state['type'])->value,
        ], self::states((array) data_get($data, 'teams.nodes.0.states.nodes', [])));
    }

    public function transition(TeamIntegration $integration, string $externalId, ExternalIssueState $target): ?TrackerIssue
    {
        $issue = $this->issueById($integration, $externalId);

        if ($issue === null || $issue->issueStatus === null) {
            return null;
        }

        if (DoneMapping::state($integration, $issue->issueStatus) === $target) {
            return $issue;
        }

        $data = $this->client->query(
            $integration,
            'query($id: String!) { issue(id: $id) { team { states(first: 100) { nodes { id name type position } } } } }',
            ['id' => $externalId],
        );
        $stateId = $this->targetState($integration, $issue->issueStatus->container, self::states((array) data_get($data, 'issue.team.states.nodes', [])), $target)
            ?? throw StatusPushRejected::unavailable($integration->provider, $issue->key, $target);

        $result = $this->client->query(
            $integration,
            'mutation($id: String!, $stateId: String!) { issueUpdate(id: $id, input: {stateId: $stateId}) { success } }',
            ['id' => $externalId, 'stateId' => $stateId],
        );

        if (data_get($result, 'issueUpdate.success') !== true) {
            throw new StatusPushRejected($integration->provider, __('Linear did not accept this status change.'));
        }

        return $this->issueById($integration, $externalId) ?? $issue;
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
     * The configured state when the team still has it, else the first
     * `completed` state, or for a reopen the first `unstarted`, then
     * `backlog` state, in workflow order.
     *
     * @param  array<int, array{id: string, name: string, type: string, position: float}>  $states
     */
    private function targetState(TeamIntegration $integration, ?string $team, array $states, ExternalIssueState $target): ?string
    {
        $configured = DoneMapping::configured($integration, $team, $target === ExternalIssueState::Done ? 'completeStateId' : 'reopenStateId');

        if ($configured !== null && in_array($configured, array_column($states, 'id'), true)) {
            return $configured;
        }

        foreach ($target === ExternalIssueState::Done ? ['completed'] : ['unstarted', 'backlog'] as $type) {
            foreach ($states as $state) {
                if ($state['type'] === $type) {
                    return $state['id'];
                }
            }
        }

        return null;
    }

    /**
     * Workflow states ordered by their position in the team's workflow.
     *
     * @param  array<array-key, mixed>  $nodes
     * @return array<int, array{id: string, name: string, type: string, position: float}>
     */
    private static function states(array $nodes): array
    {
        $states = [];

        foreach ($nodes as $state) {
            if (is_array($state) && is_string($state['id'] ?? null) && is_string($state['type'] ?? null)) {
                $states[] = [
                    'id' => $state['id'],
                    'name' => is_string($state['name'] ?? null) ? $state['name'] : $state['id'],
                    'type' => $state['type'],
                    'position' => is_numeric($state['position'] ?? null) ? (float) $state['position'] : 0.0,
                ];
            }
        }

        usort($states, fn (array $first, array $second): int => $first['position'] <=> $second['position']);

        return $states;
    }

    /**
     * @param  array<array-key, mixed>  $node
     */
    private function issueStatus(array $node): ?IssueStatus
    {
        $id = data_get($node, 'state.id');

        if (! is_string($id)) {
            return null;
        }

        $type = data_get($node, 'state.type');
        $team = data_get($node, 'team.key');

        return new IssueStatus(
            id: $id,
            name: TrackerIssue::shorten(data_get($node, 'state.name'), TrackerIssue::AssigneeLength),
            kind: is_string($type) ? $type : 'unstarted',
            container: is_string($team) ? $team : null,
            updatedAt: IssueStatus::time($node['updatedAt'] ?? null),
        );
    }

    private function linearEstimate(?string $estimate, bool $allowsZero): ?int
    {
        if ($estimate === null) {
            return null;
        }

        $number = PokerDeck::numericValue($estimate);

        if ($number === null) {
            throw new EstimateRejected(__("T-shirt estimates can't be written to :source.", ['source' => 'Linear']));
        }

        if (floor($number) !== $number) {
            throw new EstimateRejected(__('Linear only accepts whole-number estimates.'));
        }

        if ($number < 0 || $number > self::MaxEstimate) {
            throw new EstimateRejected(__('Linear accepts estimates from 0 to 64.'));
        }

        if ($number === 0.0 && ! $allowsZero) {
            return null;
        }

        return (int) $number;
    }

    /**
     * @param  array<array-key, mixed>  $connection
     */
    private function list(array $connection): TrackerIssueList
    {
        $issues = [];

        foreach ((array) ($connection['nodes'] ?? []) as $node) {
            if (is_array($node) && ($issue = $this->issue($node)) !== null) {
                $issues[] = $issue;
            }
        }

        return new TrackerIssueList($issues, data_get($connection, 'pageInfo.hasNextPage') === true);
    }

    /**
     * @param  array<array-key, mixed>  $node
     */
    private function issue(array $node): ?TrackerIssue
    {
        $id = $node['id'] ?? null;
        $key = $node['identifier'] ?? null;
        $url = $node['url'] ?? null;

        if (! is_string($id) || ! is_string($key) || ! is_string($url)) {
            return null;
        }

        $description = is_string($node['description'] ?? null) && trim($node['description']) !== ''
            ? AdfToMarkdown::truncate(trim($node['description']))
            : null;

        return new TrackerIssue(
            externalId: $id,
            key: $key,
            title: TrackerIssue::title($node['title'] ?? null, $key),
            description: $description,
            url: $url,
            assignee: TrackerIssue::shorten(data_get($node, 'assignee.displayName'), TrackerIssue::AssigneeLength),
            estimate: TrackerIssue::formatEstimate($node['estimate'] ?? null),
            status: TrackerIssue::shorten(data_get($node, 'state.name'), TrackerIssue::AssigneeLength),
            issueStatus: $this->issueStatus($node),
        );
    }

    private function day(mixed $value): ?string
    {
        return is_string($value) && strlen($value) >= 10 ? substr($value, 0, 10) : null;
    }
}
