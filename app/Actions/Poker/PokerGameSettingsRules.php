<?php

namespace App\Actions\Poker;

use App\Enums\IntegrationProvider;
use App\Models\PokerGame;
use App\Models\Team;
use App\Models\TeamIntegration;
use Illuminate\Validation\Rule;

class PokerGameSettingsRules
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public static function rules(Team $team): array
    {
        return [
            'revote_after_reveal' => ['sometimes', 'boolean'],
            'task_timer_seconds' => ['sometimes', 'nullable', 'integer', Rule::in(PokerGame::TaskTimerChoices)],
            'writes_estimates' => ['sometimes', 'boolean'],
            'estimate_field_id' => ['sometimes', 'nullable', 'string', 'max:100', Rule::in(self::estimateFieldIds($team))],
        ];
    }

    /**
     * @return array<int, string>
     */
    public static function estimateFieldIds(Team $team): array
    {
        $team->loadMissing('integrations');

        return $team->integrations
            ->filter(fn (TeamIntegration $integration): bool => in_array($integration->provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter], true))
            ->flatMap(fn (TeamIntegration $integration): array => array_column((array) $integration->setting('numberFields', []), 'id'))
            ->filter(fn (mixed $id): bool => is_string($id))
            ->values()
            ->all();
    }
}
