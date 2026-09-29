<?php

namespace Database\Factories;

use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ActionItem>
 */
class ActionItemFactory extends Factory
{
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'content' => fake()->sentence(),
            'created_by_participant_id' => fn (array $attributes) => Participant::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'is_done' => false,
        ];
    }
}
