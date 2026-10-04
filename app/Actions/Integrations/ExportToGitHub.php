<?php

namespace App\Actions\Integrations;

use App\Enums\ExportWarningCode;
use App\Enums\IntegrationProvider;
use App\Exceptions\Integrations\IntegrationException;
use App\Exceptions\Integrations\IssueCreationUncertain;
use App\Exceptions\Integrations\ProviderRejected;
use App\Exceptions\Integrations\ProviderUnavailable;
use App\Models\ActionItem;
use App\Models\TeamIntegration;
use App\Support\Integrations\GitHub\GitHubClient;
use App\Support\Integrations\GitHub\GitHubMarkdown;
use App\Support\Integrations\IntegrationUserAccounts;
use Illuminate\Support\Str;

/**
 * Spec 8 §4.2 export: a Markdown body as Linear's plus the due date, the
 * mapped account's current login, and the priority's label when the
 * repository has it. GitHub silently drops assignees without access, so the
 * response is compared. The item and the retro title are escaped with
 * GitHubMarkdown, so they cannot mention anyone, reference issues or add
 * Markdown links, images or HTML (bare URLs are still autolinked).
 */
class ExportToGitHub
{
    private const array UnsafeLabels = ['.', '..'];

    public function __construct(
        private GitHubClient $client,
        private IntegrationUserAccounts $accounts,
        private ResolveExportPriority $resolvePriority,
    ) {}

    /**
     * @param  array{repository_id: string}  $target
     */
    public function create(TeamIntegration $integration, ActionItem $item, IssueDraft $draft, ExportAssignee $assignee, array $target): ExportOutcome
    {
        $fullName = $this->repositoryName($integration, $target['repository_id']);
        $priority = $this->priority($integration, $item, $fullName);
        $login = $assignee->accountId === null ? null : $this->login($integration, $assignee->accountId);

        if ($assignee->accountId !== null && $login === null) {
            $assignee = $assignee->withoutAccount(ExportWarningCode::AssigneeRejected);
        }

        $payload = array_filter([
            'title' => $draft->title,
            'body' => $this->body($draft),
            'assignees' => $login === null ? null : [$login],
            'labels' => $priority->value === null ? null : [(string) $priority->value],
        ], fn (mixed $value): bool => $value !== null);

        try {
            $issue = $this->send($integration, $fullName, $payload);
        } catch (ProviderRejected $exception) {
            throw_if(! isset($payload['assignees']) || $exception->httpStatus !== 422, $exception);

            unset($payload['assignees']);
            $assignee = $assignee->withoutAccount(ExportWarningCode::AssigneeRejected);
            $issue = $this->send($integration, $fullName, $payload);
        }

        $number = $issue['number'] ?? null;
        $url = $issue['html_url'] ?? null;

        throw_if(! is_int($number) || ! is_string($url) || ! str_starts_with($url, "https://github.com/{$fullName}/issues/"), IssueCreationUncertain::class, IntegrationProvider::GitHub, 'invalid_issue_response');

        if (isset($payload['assignees']) && ! $this->isAssigned($issue, (string) $login)) {
            $assignee = $assignee->withoutAccount(ExportWarningCode::AssigneeRejected);
        }

        return new ExportOutcome(
            new CreatedIssue("{$target['repository_id']}/{$number}", "{$fullName}#{$number}", $url),
            $assignee,
            $priority,
        );
    }

    /**
     * Only a repository of the installation is written to; a public
     * repository GitHub would also return by id is refused. The listing is
     * cached briefly, so calling this before the export transaction keeps
     * the slow read outside the item lock.
     */
    public function repositoryName(TeamIntegration $integration, string $repositoryId): string
    {
        foreach ($this->client->cachedRepositories($integration) as $repository) {
            if ($repository['id'] === $repositoryId) {
                return $repository['name'];
            }
        }

        throw new ProviderRejected(IntegrationProvider::GitHub, GitHubClient::unavailableRepositoryMessage(), 404);
    }

    private function body(IssueDraft $draft): string
    {
        $lines = array_map(GitHubMarkdown::escape(...), $draft->lines);
        $body = implode("\n\n", $lines)."\n\n".GitHubMarkdown::escape($draft->origin)." {$draft->link}";

        return $draft->dueOn === null ? $body : $body."\n\n".__('Due: :date', ['date' => $draft->dueOn]);
    }

    private function priority(TeamIntegration $integration, ActionItem $item, string $fullName): ExportPriority
    {
        $label = $this->resolvePriority->gitHubLabel($item, $integration);

        if ($label === null) {
            return new ExportPriority(null);
        }

        if (in_array($label, self::UnsafeLabels, true)) {
            return new ExportPriority(null, ExportWarningCode::PriorityUnavailable, $label);
        }

        try {
            $this->client->get($integration, "repos/{$fullName}/labels/".rawurlencode($label));
        } catch (ProviderRejected $exception) {
            throw_if($exception->httpStatus !== 404, $exception);

            return new ExportPriority(null, ExportWarningCode::PriorityUnavailable, $label);
        }

        return new ExportPriority($label, null, $label);
    }

    /**
     * The mapping keeps the numeric id; the login is read now, so renamed
     * accounts are still assigned.
     */
    private function login(TeamIntegration $integration, string $accountId): ?string
    {
        try {
            return $this->accounts->find($integration, $accountId)?->displayName;
        } catch (IntegrationException) {
            return null;
        }
    }

    /**
     * @param  array<array-key, mixed>  $issue
     */
    private function isAssigned(array $issue, string $login): bool
    {
        return array_any((array) ($issue['assignees'] ?? []), fn($assigned): bool => Str::lower((string) data_get($assigned, 'login')) === Str::lower($login));
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<array-key, mixed>
     */
    private function send(TeamIntegration $integration, string $fullName, array $payload): array
    {
        try {
            return $this->client->post($integration, "repos/{$fullName}/issues", $payload);
        } catch (ProviderUnavailable $exception) {
            if ($exception->timedOut) {
                throw new IssueCreationUncertain(IntegrationProvider::GitHub, $exception->detail());
            }

            throw $exception;
        }
    }
}
