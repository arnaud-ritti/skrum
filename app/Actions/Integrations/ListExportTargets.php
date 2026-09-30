<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\JiraClient;
use App\Support\Integrations\Linear\LinearClient;
use Illuminate\Support\Str;

class ListExportTargets
{
    private const ProjectLimit = 50;

    private const TeamLimit = 100;

    private const PreferredIssueType = 'task';

    public function __construct(private JiraClient $jira, private LinearClient $linear) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(TeamIntegration $integration, ?string $projectId = null, ?string $query = null): array
    {
        if ($integration->provider === IntegrationProvider::Linear) {
            return $this->linearTargets($integration);
        }

        return $this->jiraTargets($integration, $projectId, $query);
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
        $response = $this->jira->get($integration, 'rest/api/3/project/search', array_filter([
            'maxResults' => self::ProjectLimit,
            'orderBy' => 'name',
            'action' => 'create',
            'query' => $query,
        ], fn (mixed $value): bool => $value !== null));

        $projects = [];

        foreach ((array) ($response['values'] ?? []) as $project) {
            if (! is_array($project) || ! is_string($project['id'] ?? null)) {
                continue;
            }

            $projects[] = ['id' => $project['id'], 'key' => (string) ($project['key'] ?? ''), 'name' => (string) ($project['name'] ?? '')];
        }

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

        foreach ($this->jira->get($integration, 'rest/api/3/issuetype/project', ['projectId' => $projectId]) as $type) {
            if (! is_array($type) || ! is_string($type['id'] ?? null) || ($type['subtask'] ?? false) === true) {
                continue;
            }

            $types[] = ['id' => $type['id'], 'name' => (string) ($type['name'] ?? '')];
        }

        return $types;
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
