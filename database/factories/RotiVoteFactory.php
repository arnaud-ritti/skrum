<?php

namespace Database\Factories;

use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RotiVote>
 */
class RotiVoteFactory extends Factory
{
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'participant_id' => fn (array $attributes) => Participant::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'score' => fake()->numberBetween(1, 5),
        ];
    }
}
