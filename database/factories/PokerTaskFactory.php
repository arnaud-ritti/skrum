<?php

namespace Database\Factories;

use App\Enums\IntegrationProvider;
use App\Enums\PokerDeck;
use App\Models\PokerGame;
use App\Models\PokerTask;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PokerTask>
 */
class PokerTaskFactory extends Factory
{
    public function definition(): array
    {
        return [
            'poker_game_id' => PokerGame::factory(),
            'title' => fake()->sentence(4),
            'position' => fn (array $attributes) => (int) PokerTask::query()
                ->where('poker_game_id', $attributes['poker_game_id'])
                ->max('position') + 1,
        ];
    }

    public function estimated(string $value = '5'): static
    {
        return $this->state(fn () => [
            'estimate' => $value,
            'estimate_numeric' => PokerDeck::numericValue($value),
            'estimated_at' => now(),
        ]);
    }

    public function imported(IntegrationProvider $source = IntegrationProvider::Jira, string $site = 'cloud-1'): static
    {
        return $this->state(function () use ($source, $site) {
            $number = fake()->unique()->numberBetween(1, 99999);

            [$id, $key, $url] = match ($source) {
                IntegrationProvider::Linear => [fake()->uuid(), "ENG-{$number}", "https://linear.app/acme/issue/ENG-{$number}"],
                IntegrationProvider::JiraDataCenter => [(string) (10000 + $number), "PROJ-{$number}", "https://jira.example.com/browse/PROJ-{$number}"],
                IntegrationProvider::GitHub => ["9001/{$number}", "acme/api#{$number}", "https://github.com/acme/api/issues/{$number}"],
                default => [(string) (10000 + $number), "PROJ-{$number}", "https://acme.atlassian.net/browse/PROJ-{$number}"],
            };

            return [
                'external_source' => $source->value,
                'external_id' => $id,
                'external_url' => $url,
                'external_site' => $site,
                'external_key' => $key,
                'external_refreshed_at' => now(),
            ];
        });
    }
}
