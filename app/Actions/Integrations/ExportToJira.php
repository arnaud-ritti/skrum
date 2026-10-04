<?php

namespace App\Actions\Integrations;

use App\Enums\ExportWarningCode;
use App\Enums\IntegrationProvider;
use App\Exceptions\Integrations\IssueCreationUncertain;
use App\Exceptions\Integrations\ProviderRejected;
use App\Exceptions\Integrations\ProviderUnavailable;
use App\Models\ActionItem;
use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\JiraApis;
use App\Support\Integrations\Jira\JiraCreateMeta;
use App\Support\Integrations\JiraDataCenter\MarkdownToWikiMarkup;

class ExportToJira
{
    private const string IssueKeyPattern = '/^[A-Z][A-Z0-9_]*-\d+\z/';

    public function __construct(
        private JiraApis $jiraApis,
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

        $isDataCenter = $integration->provider === IntegrationProvider::JiraDataCenter;

        $payload = array_filter([
            'project' => ['id' => $target['project_id']],
            'issuetype' => ['id' => $target['issue_type_id']],
            'summary' => $draft->title,
            'description' => $isDataCenter ? MarkdownToWikiMarkup::draft($draft) : $draft->adf(),
            'duedate' => $fields->hasDueDate ? $draft->dueOn : null,
            'priority' => $priority->value === null ? null : ['id' => (string) $priority->value],
            'assignee' => $assignee->accountId === null ? null : [$isDataCenter ? 'name' : 'accountId' => $assignee->accountId],
        ], fn (mixed $value): bool => $value !== null);

        try {
            $created = $this->send($integration, $payload);
        } catch (ProviderRejected $exception) {
            throw_if(! isset($payload['assignee']) || ! array_key_exists('assignee', $exception->errors), $exception);

            unset($payload['assignee']);
            $assignee = $assignee->withoutAccount(ExportWarningCode::AssigneeRejected);
            $created = $this->send($integration, $payload);
        }

        $id = $created['id'] ?? null;
        $key = $created['key'] ?? null;

        if (! is_string($id) || $id === '' || ! is_string($key) || preg_match(self::IssueKeyPattern, $key) !== 1) {
            throw new IssueCreationUncertain($integration->provider, 'invalid_issue_response');
        }

        return new ExportOutcome(new CreatedIssue($id, $key, $this->jiraApis->for($integration)->browseUrl($integration, $key)), $assignee, $priority);
    }

    /**
     * @param  array<string, mixed>  $fields
     * @return array<array-key, mixed>
     */
    private function send(TeamIntegration $integration, array $fields): array
    {
        $api = $this->jiraApis->for($integration);

        try {
            return $api->post($integration, $api->apiPath('issue'), ['fields' => $fields]);
        } catch (ProviderUnavailable $exception) {
            if ($exception->timedOut) {
                throw new IssueCreationUncertain($integration->provider, $exception->detail());
            }

            throw $exception;
        }
    }
}
