<?php

namespace App\Actions\Integrations;

use App\Exceptions\Integrations\IntegrationException;
use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\JiraApis;
use Illuminate\Support\Str;

class DetectJiraStoryPointFields
{
    private const string StoryPointsSchema = 'com.pyxis.greenhopper.jira:jsw-story-points';

    /**
     * @var array<string, int>
     */
    private const array NameRanks = ['story points' => 1, 'story point estimate' => 2];

    public function __construct(private JiraApis $jiraApis) {}

    public function handle(TeamIntegration $integration): TeamIntegration
    {
        $numberFields = [];
        $ranked = [];

        $api = $this->jiraApis->for($integration);

        foreach ($api->get($integration, $api->apiPath('field')) as $field) {
            if (! is_array($field) || ($field['custom'] ?? false) !== true || data_get($field, 'schema.type') !== 'number') {
                continue;
            }

            $entry = ['id' => (string) ($field['id'] ?? ''), 'name' => (string) ($field['name'] ?? '')];
            $numberFields[] = $entry;
            $rank = $this->rank($field);

            if ($rank !== null) {
                $ranked[] = ['rank' => $rank, 'field' => $entry];
            }
        }

        usort($ranked, fn (array $first, array $second): int => $first['rank'] <=> $second['rank']);

        $integration->mergeSettings([
            'numberFields' => $numberFields,
            'storyPointFields' => array_column($ranked, 'field'),
        ]);

        return $this->applyOverride($integration);
    }

    public function handleQuietly(TeamIntegration $integration): void
    {
        try {
            $this->handle($integration);
        } catch (IntegrationException) {
            // The connection itself succeeded; "Detect again" retries the detection.
        }
    }

    /**
     * Puts the admin's chosen field first, when it still exists on the site.
     */
    public function applyOverride(TeamIntegration $integration): TeamIntegration
    {
        $override = collect((array) $integration->setting('numberFields', []))
            ->first(fn (mixed $field): bool => is_array($field) && ($field['id'] ?? null) === $integration->setting('storyPointFieldOverride'));

        if (! is_array($override)) {
            return $integration;
        }

        $others = array_values(array_filter(
            (array) $integration->setting('storyPointFields', []),
            fn (mixed $field): bool => is_array($field) && ($field['id'] ?? null) !== $override['id'],
        ));

        return $integration->mergeSettings(['storyPointFields' => [$override, ...$others]]);
    }

    /**
     * @param  array<array-key, mixed>  $field
     */
    private function rank(array $field): ?int
    {
        if (data_get($field, 'schema.custom') === self::StoryPointsSchema) {
            return 0;
        }

        return self::NameRanks[Str::lower(trim((string) ($field['name'] ?? '')))] ?? null;
    }
}
