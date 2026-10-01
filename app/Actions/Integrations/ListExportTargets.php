<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\GitHub\GitHubClient;
use App\Support\Integrations\Jira\JiraApis;
use App\Support\Integrations\Linear\LinearClient;
use Illuminate\Support\Str;

class ListExportTargets
{
    private const ProjectLimit = 50;

    private const TeamLimit = 100;

    private const PreferredIssueType = 'task';

    public function __construct(private JiraApis $jiraApis, private LinearClient $linear, private GitHubClient $gitHub) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(TeamIntegration $integration, ?string $projectId = null, ?string $query = null): array
    {
        return match ($integration->provider) {
            IntegrationProvider::Linear => $this->linearTargets($integration),
            IntegrationProvider::GitHub => $this->gitHubTargets($integration, $query),
            default => $this->jiraTargets($integration, $projectId, $query),
        };
    }

    /**
     * @return array{
     *     projects: array<int, array{id: string, key: string, name: string}>,
     *     issueTypes: array<int, array{id: string, name: string}>,
     *     defaults: array{projectId: ?string, issueTypeId: ?string}
     * }
     */
    private function jiraTargets(TeamIntegration $integration, ?string $projectId, ?string $query): array
    {
        $projects = $this->jiraProjects($integration, $query);

        $selected = $projectId ?? $this->listed($projects, $integration->setting('exportProjectId')) ?? ($projects[0]['id'] ?? null);
        $issueTypes = $selected === null ? [] : $this->issueTypes($integration, $selected);

        return [
            'projects' => $projects,
            'issueTypes' => $issueTypes,
            'defaults' => ['projectId' => $selected, 'issueTypeId' => $this->defaultIssueType($integration, $issueTypes)],
        ];
    }

    /**
     * @return array<int, array{id: string, name: string}>
     */
    private function issueTypes(TeamIntegration $integration, string $projectId): array
    {
        $types = [];

        $api = $this->jiraApis->for($integration);

        $listed = $integration->provider === IntegrationProvider::JiraDataCenter
            ? (array) ($api->get($integration, $api->apiPath('issue/createmeta/'.rawurlencode($projectId).'/issuetypes'))['values'] ?? [])
            : $api->get($integration, $api->apiPath('issuetype/project'), ['projectId' => $projectId]);

        foreach ($listed as $type) {
            if (! is_array($type) || ! is_string($type['id'] ?? null) || ($type['subtask'] ?? false) === true) {
                continue;
            }

            $types[] = ['id' => $type['id'], 'name' => (string) ($type['name'] ?? '')];
        }

        return $types;
    }

    /**
     * Data Center 8.x has no project search: all projects the person can
     * see are filtered and sorted here.
     *
     * @return array<int, array{id: string, key: string, name: string}>
     */
    private function jiraProjects(TeamIntegration $integration, ?string $query): array
    {
        $api = $this->jiraApis->for($integration);

        if ($integration->provider === IntegrationProvider::JiraDataCenter) {
            $needle = Str::lower(trim((string) $query));
            $listed = array_filter(
                $api->get($integration, $api->apiPath('project')),
                fn (mixed $project): bool => is_array($project)
                    && ($needle === '' || str_contains(Str::lower(($project['name'] ?? '').' '.($project['key'] ?? '')), $needle)),
            );
            usort($listed, fn (array $first, array $second): int => strcasecmp((string) ($first['name'] ?? ''), (string) ($second['name'] ?? '')));
            $listed = array_slice($listed, 0, self::ProjectLimit);
        } else {
            $listed = (array) ($api->get($integration, $api->apiPath('project/search'), array_filter([
                'maxResults' => self::ProjectLimit,
                'orderBy' => 'name',
                'action' => 'create',
                'query' => $query,
            ], fn (mixed $value): bool => $value !== null))['values'] ?? []);
        }

        $projects = [];

        foreach ($listed as $project) {
            if (! is_array($project) || ! is_string($project['id'] ?? null)) {
                continue;
            }

            $projects[] = ['id' => $project['id'], 'key' => (string) ($project['key'] ?? ''), 'name' => (string) ($project['name'] ?? '')];
        }

        return $projects;
    }

    /**
     * @param  array<int, array{id: string, name: string}>  $issueTypes
     */
    private function defaultIssueType(TeamIntegration $integration, array $issueTypes): ?string
    {
        $saved = $this->listed($issueTypes, $integration->setting('exportIssueTypeId'));

        if ($saved !== null) {
            return $saved;
        }

        foreach ($issueTypes as $type) {
            if (Str::lower($type['name']) === self::PreferredIssueType) {
                return $type['id'];
            }
        }

        return $issueTypes[0]['id'] ?? null;
    }

    /**
     * @return array{teams: array<int, array{id: string, key: string, name: string}>, defaults: array{teamId: ?string}}
     */
    private function linearTargets(TeamIntegration $integration): array
    {
        $data = $this->linear->query($integration, 'query Teams($first: Int!) { teams(first: $first) { nodes { id key name } } }', ['first' => self::TeamLimit]);

        $teams = [];

        foreach ((array) data_get($data, 'teams.nodes', []) as $team) {
            if (! is_array($team) || ! is_string($team['id'] ?? null)) {
                continue;
            }

            $teams[] = ['id' => $team['id'], 'key' => (string) ($team['key'] ?? ''), 'name' => (string) ($team['name'] ?? '')];
        }

        return [
            'teams' => $teams,
            'defaults' => ['teamId' => $this->listed($teams, $integration->setting('exportTeamId')) ?? ($teams[0]['id'] ?? null)],
        ];
    }

    /**
     * @return array{repositories: array<int, array{id: string, name: string}>, defaults: array{repositoryId: ?string}}
     */
    private function gitHubTargets(TeamIntegration $integration, ?string $query): array
    {
        $needle = Str::lower(trim((string) $query));
        $all = $this->gitHub->cachedRepositories($integration);
        $listed = array_slice(array_values(array_filter(
            $all,
            fn (array $repository): bool => $needle === '' || str_contains(Str::lower($repository['name']), $needle),
        )), 0, self::ProjectLimit);
        $saved = collect($all)->first(fn (array $repository): bool => $repository['id'] === $integration->setting('exportRepositoryId'));

        if ($saved !== null && $needle === '' && $this->listed($listed, $saved['id']) === null) {
            array_unshift($listed, $saved);
        }

        return [
            'repositories' => $listed,
            'defaults' => ['repositoryId' => $this->listed($listed, $integration->setting('exportRepositoryId')) ?? ($listed[0]['id'] ?? null)],
        ];
    }

    /**
     * @param  array<int, array{id: string}>  $items
     */
    private function listed(array $items, mixed $id): ?string
    {
        foreach ($items as $item) {
            if ($item['id'] === $id) {
                return $item['id'];
            }
        }

        return null;
    }
}
