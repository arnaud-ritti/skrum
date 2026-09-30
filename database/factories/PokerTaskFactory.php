<?php

namespace Database\Factories;

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
}
