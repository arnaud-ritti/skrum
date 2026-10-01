<?php

namespace App\Support\Integrations\Jira;

use App\Models\TeamIntegration;
use Illuminate\Support\Facades\Cache;

/**
 * The fields of a project's create screen for one issue type (spec §7.1:
 * cached 10 minutes per integration, project and issue type).
 */
class JiraCreateMeta
{
    private const TtlSeconds = 600;

    private const FieldLimit = 200;

    public function __construct(private JiraApis $jiraApis) {}

    public function fields(TeamIntegration $integration, string $projectId, string $issueTypeId): JiraCreateFields
    {
        /** @var array{assignee: bool, priority: bool, priorities: array<int, array{id: string, name: string}>} $cached */
        $cached = Cache::remember(
            "jira-createmeta:{$integration->id}:{$projectId}:{$issueTypeId}",
            self::TtlSeconds,
            fn (): array => $this->fetch($integration, $projectId, $issueTypeId),
        );

        return new JiraCreateFields($cached['assignee'], $cached['priority'], $cached['priorities']);
    }

    /**
     * @return array{assignee: bool, priority: bool, priorities: array<int, array{id: string, name: string}>}
     */
    private function fetch(TeamIntegration $integration, string $projectId, string $issueTypeId): array
    {
        $project = rawurlencode($projectId);
        $issueType = rawurlencode($issueTypeId);

        $api = $this->jiraApis->for($integration);

        $response = $api->get(
            $integration,
            $api->apiPath("issue/createmeta/{$project}/issuetypes/{$issueType}"),
            ['maxResults' => self::FieldLimit],
        );

        $fields = [];

        foreach ((array) ($response['fields'] ?? $response['values'] ?? []) as $field) {
            if (is_array($field) && is_string($field['fieldId'] ?? null)) {
                $fields[$field['fieldId']] = $field;
            }
        }

        $priorities = [];

        foreach ((array) ($fields['priority']['allowedValues'] ?? []) as $value) {
            if (is_array($value) && is_string($value['id'] ?? null)) {
                $priorities[] = ['id' => $value['id'], 'name' => (string) ($value['name'] ?? '')];
            }
        }

        return [
            'assignee' => array_key_exists('assignee', $fields),
            'priority' => array_key_exists('priority', $fields),
            'priorities' => $priorities,
        ];
    }
}
