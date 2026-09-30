<?php

namespace App\Actions\Integrations;

use App\Enums\ExportWarningCode;
use App\Enums\IntegrationProvider;
use App\Models\ActionItem;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IssueCreationUncertain;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Linear\LinearClient;
use Illuminate\Support\Str;

class ExportToLinear
{
    private const CreateMutation = 'mutation IssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }';

    public function __construct(private LinearClient $linear, private ResolveExportPriority $resolvePriority) {}

    /**
     * @param  array{team_id: string}  $target
     */
    public function create(TeamIntegration $integration, ActionItem $item, IssueDraft $draft, ExportAssignee $assignee, array $target): ExportOutcome
    {
        $priority = $this->resolvePriority->handle($item, $integration);

        $input = array_filter([
            'teamId' => $target['team_id'],
            'title' => $draft->title,
            'description' => $draft->markdown(),
            'dueDate' => $draft->dueOn,
            'priority' => $priority->value,
            'assigneeId' => $assignee->accountId,
        ], fn (mixed $value): bool => $value !== null);

        try {
            $issue = $this->send($integration, $input);
        } catch (ProviderRejected $exception) {
            if (! isset($input['assigneeId']) || ! $this->mentionsAssignee($exception)) {
                throw $exception;
            }

            unset($input['assigneeId']);
            $assignee = $assignee->withoutAccount(ExportWarningCode::AssigneeRejected);
            $issue = $this->send($integration, $input);
        }

        return new ExportOutcome(
            new CreatedIssue((string) $issue['id'], (string) ($issue['identifier'] ?? ''), (string) ($issue['url'] ?? '')),
            $assignee,
            $priority,
        );
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<array-key, mixed>
     */
    private function send(TeamIntegration $integration, array $input): array
    {
        try {
            $data = $this->linear->query($integration, self::CreateMutation, ['input' => $input]);
        } catch (ProviderUnavailable $exception) {
            if ($exception->timedOut) {
                throw new IssueCreationUncertain(IntegrationProvider::Linear, $exception->detail());
            }

            throw $exception;
        }

        $issue = data_get($data, 'issueCreate.issue');

        if (data_get($data, 'issueCreate.success') !== true || ! is_array($issue) || ! is_string($issue['id'] ?? null)) {
            throw new ProviderRejected(IntegrationProvider::Linear, 'issue_not_created');
        }

        return $issue;
    }

    private function mentionsAssignee(ProviderRejected $exception): bool
    {
        return Str::contains(Str::lower($exception->getMessage().' '.json_encode($exception->errors)), 'assignee');
    }
}
