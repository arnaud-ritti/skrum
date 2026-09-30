<?php

namespace App\Actions\Integrations;

use App\Actions\ActionItems\BroadcastActionItemChange;
use App\Actions\ActionItems\WorkspaceActionItemGuard;
use App\Enums\IntegrationProvider;
use App\Models\ActionItem;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\IntegrationTokens;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Spec §7: one synchronous, one-shot export per item and provider. The
 * link row is written first under the item lock, so a double submit waits
 * and then finds it; any provider failure rolls the whole export back.
 * The retro row is not locked, so a slow provider never stalls the board.
 */
class ExportActionItem
{
    public function __construct(
        private IntegrationTokens $tokens,
        private BuildIssueDraft $buildIssueDraft,
        private ResolveExportAssignee $resolveAssignee,
        private ExportToJira $exportToJira,
        private ExportToLinear $exportToLinear,
        private BroadcastActionItemChange $broadcast,
    ) {}

    /**
     * @param  array<string, mixed>  $target
     * @return array{actionItem: ActionItem, warnings: array<int, array{code: string, message: ?string}>}
     */
    public function handle(ActionItem $item, User $user, TeamIntegration $integration, array $target): array
    {
        $this->ensureNotExported($item, $integration);

        WorkspaceActionItemGuard::writable($item);

        $this->tokens->accessToken($integration);

        try {
            /** @var array{0: ActionItem, 1: ExportOutcome} $result */
            $result = DB::transaction(fn (): array => $this->export($item, $user, $integration, $target));
        } catch (ReconnectRequired $exception) {
            TeamIntegration::query()->find($integration->id)?->markReconnectRequired($exception->detail() ?? $exception->userMessage());

            throw $exception;
        }

        [$exported, $outcome] = $result;

        $this->broadcast->saved($exported);
        $this->broadcast->externalLinksChanged($exported);

        return ['actionItem' => $exported, 'warnings' => $this->warnings($integration->provider, $outcome)];
    }

    /**
     * @param  array<string, mixed>  $target
     * @return array{0: ActionItem, 1: ExportOutcome}
     */
    private function export(ActionItem $item, User $user, TeamIntegration $integration, array $target): array
    {
        $locked = WorkspaceActionItemGuard::lockWritable($item->id);

        $this->ensureNotExported($locked, $integration);

        $link = $locked->externalLinks()->create([
            'source' => $integration->provider,
            'external_site' => (string) $integration->site(),
            'external_id' => '',
            'external_key' => '',
            'external_url' => '',
            'created_by_user_id' => $user->id,
        ]);

        $draft = $this->buildIssueDraft->handle($locked);
        $assignee = $this->resolveAssignee->handle($locked, $integration);

        $outcome = $integration->provider === IntegrationProvider::Jira
            ? $this->exportToJira->create($integration, $locked, $draft, $assignee, [
                'project_id' => $this->targetId($target, 'project_id'),
                'issue_type_id' => $this->targetId($target, 'issue_type_id'),
            ])
            : $this->exportToLinear->create($integration, $locked, $draft, $assignee, ['team_id' => $this->targetId($target, 'team_id')]);

        $link->update([
            'external_id' => $outcome->issue->id,
            'external_key' => $outcome->issue->key,
            'external_url' => $outcome->issue->url,
        ]);

        $this->rememberTarget($integration, $target);

        return [$locked->loadForPresentation(), $outcome];
    }

    private function ensureNotExported(ActionItem $item, TeamIntegration $integration): void
    {
        $existing = $item->externalLinks()->where('source', $integration->provider->value)->first();

        if ($existing === null) {
            return;
        }

        abort(409, __('Already exported as :key.', ['key' => $existing->external_key]));
    }

    /**
     * @param  array<string, mixed>  $target
     */
    private function targetId(array $target, string $key): string
    {
        $value = $target[$key] ?? null;

        if (! is_string($value)) {
            throw new InvalidArgumentException("The export target has no {$key}.");
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $target
     */
    private function rememberTarget(TeamIntegration $integration, array $target): void
    {
        $saved = $integration->provider === IntegrationProvider::Jira
            ? ['exportProjectId' => $target['project_id'], 'exportIssueTypeId' => $target['issue_type_id']]
            : ['exportTeamId' => $target['team_id']];

        $current = TeamIntegration::query()->whereKey($integration->id)->lockForUpdate()->firstOrFail();

        $current->forceFill(['settings' => [...$current->settings, ...$saved]])->save();
    }

    /**
     * @return array<int, array{code: string, message: ?string}>
     */
    private function warnings(IntegrationProvider $provider, ExportOutcome $outcome): array
    {
        $warnings = [];

        if ($outcome->assignee->warning !== null) {
            $warnings[] = [
                'code' => $outcome->assignee->warning->value,
                'message' => $outcome->assignee->warning->message($provider, name: $outcome->assignee->name),
            ];
        }

        if ($outcome->priority->warning !== null) {
            $warnings[] = [
                'code' => $outcome->priority->warning->value,
                'message' => $outcome->priority->warning->message($provider, priority: $outcome->priority->name),
            ];
        }

        return $warnings;
    }
}
