<?php

namespace App\Actions\Integrations;

use App\Enums\ExportWarningCode;
use App\Enums\IntegrationProvider;
use App\Models\ActionItem;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IssueCreationUncertain;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Jira\JiraClient;
use App\Support\Integrations\Jira\JiraCreateMeta;

class ExportToJira
{
    private const IssueKeyPattern = '/^[A-Z][A-Z0-9_]*-\d+\z/';

    public function __construct(
        private JiraClient $jira,
        private JiraCreateMeta $createMeta,
        private ResolveExportPriority $resolvePriority,
    ) {}

    /**
     * @param  array{project_id: string, issue_type_id: string}  $target
     */
    public function create(TeamIntegration $integration, ActionItem $item, IssueDraft $draft, ExportAssignee $assignee, array $target): ExportOutcome
    {
        $fields = $this->createMeta->fields($integration, $target['project_id'], $target['issue_type_id']);
        $priority = $this->resolvePriority->handle($item, $integration, $fields);

        if ($assignee->accountId !== null && ! $fields->hasAssignee) {
            $assignee = $assignee->withoutAccount(ExportWarningCode::AssigneeUnavailable);
        }

        $payload = array_filter([
            'project' => ['id' => $target['project_id']],
            'issuetype' => ['id' => $target['issue_type_id']],
            'summary' => $draft->title,
            'description' => $draft->adf(),
            'duedate' => $draft->dueOn,
            'priority' => $priority->value === null ? null : ['id' => (string) $priority->value],
            'assignee' => $assignee->accountId === null ? null : ['accountId' => $assignee->accountId],
        ], fn (mixed $value): bool => $value !== null);

        try {
            $created = $this->send($integration, $payload);
        } catch (ProviderRejected $exception) {
            if (! isset($payload['assignee']) || ! array_key_exists('assignee', $exception->errors)) {
                throw $exception;
            }

            unset($payload['assignee']);
            $assignee = $assignee->withoutAccount(ExportWarningCode::AssigneeRejected);
            $created = $this->send($integration, $payload);
        }

        $id = $created['id'] ?? null;
        $key = $created['key'] ?? null;

        if (! is_string($id) || $id === '' || ! is_string($key) || preg_match(self::IssueKeyPattern, $key) !== 1) {
            throw new IssueCreationUncertain(IntegrationProvider::Jira, 'invalid_issue_response');
        }

        $siteUrl = rtrim((string) $integration->setting('siteUrl'), '/');

        return new ExportOutcome(new CreatedIssue($id, $key, "{$siteUrl}/browse/{$key}"), $assignee, $priority);
    }

    /**
     * @param  array<string, mixed>  $fields
     * @return array<array-key, mixed>
     */
    private function send(TeamIntegration $integration, array $fields): array
    {
        try {
            return $this->jira->post($integration, 'rest/api/3/issue', ['fields' => $fields]);
        } catch (ProviderUnavailable $exception) {
            if ($exception->timedOut) {
                throw new IssueCreationUncertain(IntegrationProvider::Jira, $exception->detail());
            }

            throw $exception;
        }
    }
}
