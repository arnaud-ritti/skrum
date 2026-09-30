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
    ) {}

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(TeamIntegration $integration): array
    {
        return match ($integration->provider) {
            IntegrationProvider::Jira => [
                'cloud_id' => ['sometimes', 'required', 'string', Rule::in($this->ids($integration->setting('sites', []), 'cloudId'))],
                'story_point_field_id' => ['sometimes', 'required', 'string', Rule::in($this->ids($integration->setting('numberFields', []), 'id'))],
                'priority_map' => ['sometimes', 'array:high,medium,low'],
                'priority_map.*' => ['nullable', 'string', 'max:50', $this->jiraPriorityRule($integration)],
            ],
            IntegrationProvider::Linear => [
                'priority_map' => ['sometimes', 'array:high,medium,low'],
                'priority_map.*' => ['required', Rule::in([...array_map('strval', LinearPriority::Scale), self::DefaultPriority])],
            ],
            default => [],
        };
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function handle(TeamIntegration $integration, User $user, array $validated): TeamIntegration
    {
        if (is_string($validated['cloud_id'] ?? null)) {
            $integration = $this->chooseJiraSite($integration, $user, $validated['cloud_id']);
        }

        if (is_string($validated['story_point_field_id'] ?? null)) {
            $integration->forceFill(['settings' => [
                ...$integration->settings,
                'storyPointFieldOverride' => $validated['story_point_field_id'],
            ]])->save();

            $integration = $this->detectStoryPointFields->applyOverride($integration);
        }

        if (is_array($validated['priority_map'] ?? null)) {
            $integration->ensureWritable();

            $integration = $this->savePriorityMap($integration, $validated['priority_map']);
        }

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

            $map[$level] = $integration->provider === IntegrationProvider::Jira
                ? $this->jiraPriority($integration, $value)
                : (int) $value;
        }

        $integration->forceFill(['settings' => [...$integration->settings, 'priorityMap' => $map]])->save();

        return $integration;
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
