<?php

namespace Database\Factories;

use App\Models\ActionItem;
use App\Models\ActionItemSubtask;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ActionItemSubtask>
 */
class ActionItemSubtaskFactory extends Factory
{
    public function definition(): array
    {
        return [
            'action_item_id' => ActionItem::factory(),
            'content' => fake()->words(3, true),
            'position' => 0,
        ];
    }

    public function completed(): static
    {
        return $this->state(fn () => ['completed_at' => now()]);
    }
}
