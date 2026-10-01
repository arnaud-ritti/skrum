<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Linear\LinearPriority;
use Closure;
use Illuminate\Validation\Rule;

class UpdateTeamIntegration
{
    public const DefaultPriority = 'default';

    /** @var array<int, array{id: string|int, name: string}>|null */
    private ?array $jiraPriorities = null;

    public function __construct(
        private SaveTeamIntegration $saveTeamIntegration,
        private DetectJiraStoryPointFields $detectStoryPointFields,
        private ListProviderPriorities $listPriorities,
        private ConnectUrlChannel $connectUrlChannel,
        private ConnectOutgoingWebhook $connectOutgoingWebhook,
        private UpdateStatusSyncSettings $updateStatusSyncSettings,
    ) {}

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(TeamIntegration $integration): array
    {
        $rules = match ($integration->provider) {
            IntegrationProvider::Jira => [
                'cloud_id' => ['sometimes', 'required', 'string', Rule::in($this->ids($integration->setting('sites', []), 'cloudId'))],
                'story_point_field_id' => ['sometimes', 'required', 'string', Rule::in($this->ids($integration->setting('numberFields', []), 'id'))],
                'priority_map' => ['sometimes', 'array:high,medium,low'],
                'priority_map.*' => ['nullable', 'string', 'max:50', $this->jiraPriorityRule($integration)],
            ],
            IntegrationProvider::JiraDataCenter => [
                'story_point_field_id' => ['sometimes', 'required', 'string', Rule::in($this->ids($integration->setting('numberFields', []), 'id'))],
                'priority_map' => ['sometimes', 'array:high,medium,low'],
                'priority_map.*' => ['nullable', 'string', 'max:50', $this->jiraPriorityRule($integration)],
            ],
            IntegrationProvider::Linear => [
                'priority_map' => ['sometimes', 'array:high,medium,low'],
                'priority_map.*' => ['required', Rule::in([...array_map(strval(...), LinearPriority::Scale), self::DefaultPriority])],
            ],
            IntegrationProvider::GitHub => [
                'priority_labels' => ['sometimes', 'array:high,medium,low'],
                'priority_labels.*' => ['nullable', 'string', 'max:50', 'not_regex:/^\s*\.{1,2}\s*\z/'],
            ],
            IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost => $this->connectUrlChannel->rules($integration->provider, isUpdate: true),
            IntegrationProvider::Webhook => $this->connectOutgoingWebhook->rules(isUpdate: true),
            default => [],
        };

        return [...$rules, ...$this->updateStatusSyncSettings->rules($integration)];
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function handle(TeamIntegration $integration, User $user, array $validated): TeamIntegration
    {
        if (in_array($integration->provider, [IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost], true)) {
            return $this->connectUrlChannel->update($integration, $user, $validated)->refresh();
        }

        if ($integration->provider === IntegrationProvider::Webhook) {
            return $this->connectOutgoingWebhook->update($integration, $validated)->refresh();
        }

        if (is_string($validated['cloud_id'] ?? null)) {
            $integration = $this->chooseJiraSite($integration, $user, $validated['cloud_id']);
        }

        if (is_string($validated['story_point_field_id'] ?? null)) {
            $integration->mergeSettings(['storyPointFieldOverride' => $validated['story_point_field_id']]);

            $integration = $this->detectStoryPointFields->applyOverride($integration);
        }

        if (is_array($validated['priority_map'] ?? null)) {
            $integration->ensureWritable();

            $integration = $this->savePriorityMap($integration, $validated['priority_map']);
        }

        if (is_array($validated['priority_labels'] ?? null)) {
            $integration->ensureWritable();

            $labels = (array) $integration->setting('priorityLabels', []);

            foreach ($validated['priority_labels'] as $level => $label) {
                $labels[$level] = is_string($label) && trim($label) !== '' ? trim($label) : null;
            }

            $integration->mergeSettings(['priorityLabels' => $labels]);
        }

        $integration = $this->updateStatusSyncSettings->handle($integration, $validated);

        return $integration->refresh();
    }

    /**
     * @param  array<string, mixed>  $changes
     */
    private function savePriorityMap(TeamIntegration $integration, array $changes): TeamIntegration
    {
        $map = (array) $integration->setting('priorityMap', []);

        foreach ($changes as $level => $value) {
            if ($value === self::DefaultPriority) {
                unset($map[$level]);

                continue;
            }

            $map[$level] = in_array($integration->provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter], true)
                ? $this->jiraPriority($integration, $value)
                : (int) $value;
        }

        return $integration->mergeSettings(['priorityMap' => $map]);
    }

    /**
     * @return array{id: string, name: string}|null
     */
    private function jiraPriority(TeamIntegration $integration, mixed $id): ?array
    {
        if (! is_string($id)) {
            return null;
        }

        foreach ($this->jiraPriorities($integration) as $priority) {
            if ($priority['id'] === $id) {
                return ['id' => $id, 'name' => $priority['name']];
            }
        }

        return null;
    }

    private function jiraPriorityRule(TeamIntegration $integration): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($integration): void {
            if ($value === null || $value === self::DefaultPriority) {
                return;
            }

            $ids = array_map(fn (array $priority): string => (string) $priority['id'], $this->jiraPriorities($integration));

            if (! in_array($value, $ids, true)) {
                $fail(__('Choose one of the priorities of this Jira site.'));
            }
        };
    }

    /**
     * @return array<int, array{id: string|int, name: string}>
     */
    private function jiraPriorities(TeamIntegration $integration): array
    {
        return $this->jiraPriorities ??= $this->listPriorities->handle($integration);
    }

    private function chooseJiraSite(TeamIntegration $integration, User $user, string $cloudId): TeamIntegration
    {
        $site = collect((array) $integration->setting('sites', []))
            ->first(fn (mixed $candidate): bool => is_array($candidate) && ($candidate['cloudId'] ?? null) === $cloudId);
        $credentials = $integration->readableCredentials();

        if ($credentials === null) {
            throw new ReconnectRequired(IntegrationProvider::Jira, $integration->last_error);
        }

        $saved = $this->saveTeamIntegration->handle($integration->team, IntegrationProvider::Jira, $user, [
            'status' => IntegrationStatus::Active,
            'access' => $integration->access,
            'credentials' => $credentials,
            'settings' => ConnectJira::siteSettings($integration->settings, [
                'cloudId' => $cloudId,
                'url' => (string) data_get($site, 'url', ''),
                'name' => (string) data_get($site, 'name', ''),
            ]),
            'scopes' => $integration->scopes,
        ]);

        $this->detectStoryPointFields->handleQuietly($saved);

        return $saved;
    }

    /**
     * @return array<int, string>
     */
    private function ids(mixed $list, string $key): array
    {
        return collect(is_array($list) ? $list : [])
            ->map(fn (mixed $item): mixed => is_array($item) ? ($item[$key] ?? null) : null)
            ->filter(fn (mixed $id): bool => is_string($id))
            ->values()
            ->all();
    }
}
