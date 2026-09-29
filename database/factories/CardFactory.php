<?php

namespace Database\Factories;

use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Card>
 */
class CardFactory extends Factory
{
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'column_id' => fn (array $attributes) => Column::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'participant_id' => fn (array $attributes) => Participant::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'content' => fake()->sentence(),
            'position' => 0,
        ];
    }
}
