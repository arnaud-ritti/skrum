<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationCapability;
use App\Enums\IntegrationProvider;
use App\Jobs\Integrations\ReadTrackedIssues;
use App\Models\TeamIntegration;
use App\Support\Integrations\StatusSync;
use Illuminate\Support\Facades\DB;

/**
 * Spec 8 §5.1, §5.2: the sync switch, "Treat canceled as done" (Linear,
 * GitHub) and one project's or team's mapping per request, with the start
 * target (spec 24 §6.7). Changing how states map re-reads every tracked issue.
 */
class UpdateStatusSyncSettings
{
    private const string JiraStatusIdRule = 'regex:/^\d{1,20}\z/';

    private const string LinearStateIdRule = 'regex:/^[A-Za-z0-9-]{1,64}\z/';

    public function __construct(private ToggleStatusSync $toggleStatusSync) {}

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(TeamIntegration $integration): array
    {
        $provider = $integration->provider;

        if (! $provider->can(IntegrationCapability::StatusSync)) {
            return [];
        }

        $rules = ['status_sync' => ['sometimes', 'boolean']];
        $container = ['required_with:status_mapping', 'string', 'regex:'.TrackedIssues::ContainerKeyPattern];

        if (in_array($provider, [IntegrationProvider::Linear, IntegrationProvider::GitHub], true)) {
            $rules['treat_canceled_as_done'] = ['sometimes', 'boolean'];
        }

        if (in_array($provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter], true)) {
            return [
                ...$rules,
                'status_mapping' => ['sometimes', 'array:container,done_status_ids,start_status_id,complete_status_id,reopen_status_id', 'required_array_keys:container'],
                'status_mapping.container' => $container,
                'status_mapping.done_status_ids' => ['nullable', 'array', 'max:50'],
                'status_mapping.done_status_ids.*' => ['string', self::JiraStatusIdRule],
                'status_mapping.start_status_id' => ['nullable', 'string', self::JiraStatusIdRule],
                'status_mapping.complete_status_id' => ['nullable', 'string', self::JiraStatusIdRule],
                'status_mapping.reopen_status_id' => ['nullable', 'string', self::JiraStatusIdRule],
            ];
        }

        if ($provider === IntegrationProvider::Linear) {
            return [
                ...$rules,
                'status_mapping' => ['sometimes', 'array:container,start_state_id,complete_state_id,reopen_state_id', 'required_array_keys:container'],
                'status_mapping.container' => $container,
                'status_mapping.start_state_id' => ['nullable', 'string', self::LinearStateIdRule],
                'status_mapping.complete_state_id' => ['nullable', 'string', self::LinearStateIdRule],
                'status_mapping.reopen_state_id' => ['nullable', 'string', self::LinearStateIdRule],
            ];
        }

        return $rules;
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function handle(TeamIntegration $integration, array $validated): TeamIntegration
    {
        $wasOn = StatusSync::isOn($integration);
        $toggles = array_key_exists('status_sync', $validated) && (bool) $validated['status_sync'] !== $wasOn;
        $remapped = false;

        if ($toggles && ! $wasOn) {
            $integration->ensureActive();
        }

        if (array_key_exists('treat_canceled_as_done', $validated)) {
            $integration->mergeSettings(['treatCanceledAsDone' => (bool) $validated['treat_canceled_as_done']]);
            $remapped = true;
        }

        if (is_array($validated['status_mapping'] ?? null)) {
            $this->saveMapping($integration, $validated['status_mapping']);
            $remapped = true;
        }

        if ($toggles) {
            return $this->toggleStatusSync->handle($integration, ! $wasOn);
        }

        if ($remapped && $wasOn) {
            dispatch(new ReadTrackedIssues($integration->id, full: true, remapped: true));
        }

        return $integration;
    }

    /**
     * An omitted value is the default rule; a container without any value
     * is removed.
     *
     * @param  array<array-key, mixed>  $mapping
     */
    private function saveMapping(TeamIntegration $integration, array $mapping): void
    {
        $isJira = in_array($integration->provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter], true);
        $group = $isJira ? 'projects' : 'teams';
        $container = (string) $mapping['container'];
        $doneIds = is_array($mapping['done_status_ids'] ?? null) ? array_values(array_unique(array_map(strval(...), $mapping['done_status_ids']))) : [];

        $entry = $isJira ? [
            'doneStatusIds' => $doneIds === [] ? null : $doneIds,
            'startStatusId' => $mapping['start_status_id'] ?? null,
            'completeStatusId' => $mapping['complete_status_id'] ?? null,
            'reopenStatusId' => $mapping['reopen_status_id'] ?? null,
        ] : [
            'startStateId' => $mapping['start_state_id'] ?? null,
            'completeStateId' => $mapping['complete_state_id'] ?? null,
            'reopenStateId' => $mapping['reopen_state_id'] ?? null,
        ];

        DB::transaction(function () use ($integration, $group, $container, $entry): void {
            $locked = TeamIntegration::query()->whereKey($integration->id)->lockForUpdate()->firstOrFail();
            $current = (array) $locked->setting('statusMapping', []);
            $containers = (array) ($current[$group] ?? []);

            if (array_filter($entry, fn (mixed $value): bool => $value !== null) === []) {
                unset($containers[$container]);
            } else {
                $containers[$container] = $entry;
            }

            $locked->forceFill(['settings' => [...$locked->settings, 'statusMapping' => [...$current, $group => $containers]]])->save();
            $integration->setRawAttributes($locked->getAttributes(), true);
        });
    }
}
