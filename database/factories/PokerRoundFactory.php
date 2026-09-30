<?php

namespace Database\Factories;

use App\Enums\PokerRevealReason;
use App\Models\PokerRound;
use App\Models\PokerTask;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PokerRound>
 */
class PokerRoundFactory extends Factory
{
    public function definition(): array
    {
        return [
            'poker_task_id' => PokerTask::factory(),
            'number' => fn (array $attributes) => (int) PokerRound::query()
                ->where('poker_task_id', $attributes['poker_task_id'])
                ->max('number') + 1,
        ];
    }

    public function revealed(): static
    {
        return $this->state(fn () => [
            'revealed_at' => now(),
            'reveal_reason' => PokerRevealReason::Manual,
        ]);
    }
}
