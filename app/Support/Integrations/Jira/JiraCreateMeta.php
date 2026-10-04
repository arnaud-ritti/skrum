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
    private const int TtlSeconds = 600;

    private const int FieldLimit = 200;

    private const int MaxPages = 10;

    public function __construct(private JiraApis $jiraApis) {}

    public function fields(TeamIntegration $integration, string $projectId, string $issueTypeId): JiraCreateFields
    {
        /** @var array{assignee: bool, priority: bool, priorities: array<int, array{id: string, name: string}>, dueDate: bool} $cached */
        $cached = Cache::remember(
            "jira-createmeta:v2:{$integration->id}:{$projectId}:{$issueTypeId}",
            self::TtlSeconds,
            fn (): array => $this->fetch($integration, $projectId, $issueTypeId),
        );

        return new JiraCreateFields($cached['assignee'], $cached['priority'], $cached['priorities'], $cached['dueDate']);
    }

    /**
     * @return array{assignee: bool, priority: bool, priorities: array<int, array{id: string, name: string}>, dueDate: bool}
     */
    private function fetch(TeamIntegration $integration, string $projectId, string $issueTypeId): array
    {
        $project = rawurlencode($projectId);
        $issueType = rawurlencode($issueTypeId);

        $api = $this->jiraApis->for($integration);

        $fields = [];
        $startAt = 0;

        for ($page = 1; $page <= self::MaxPages; $page++) {
            $response = $api->get(
                $integration,
                $api->apiPath("issue/createmeta/{$project}/issuetypes/{$issueType}"),
                ['startAt' => $startAt, 'maxResults' => self::FieldLimit],
            );
            $pageFields = (array) ($response['fields'] ?? $response['values'] ?? []);

            foreach ($pageFields as $field) {
                if (is_array($field) && is_string($field['fieldId'] ?? null)) {
                    $fields[$field['fieldId']] = $field;
                }
            }

            $startAt += count($pageFields);

            if ($pageFields === [] || ($response['isLast'] ?? false) === true || $startAt >= (int) ($response['total'] ?? 0)) {
                break;
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
            'dueDate' => array_key_exists('duedate', $fields),
        ];
    }
}
