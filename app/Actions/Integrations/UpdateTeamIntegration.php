<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use Illuminate\Validation\Rule;

class UpdateTeamIntegration
{
    public function __construct(
        private SaveTeamIntegration $saveTeamIntegration,
        private DetectJiraStoryPointFields $detectStoryPointFields,
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

        return $integration->refresh();
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
