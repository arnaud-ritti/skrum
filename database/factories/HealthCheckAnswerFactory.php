<?php

namespace Database\Factories;

use App\Enums\HealthStatement;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<HealthCheckAnswer>
 */
class HealthCheckAnswerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'participant_id' => fn (array $attributes) => Participant::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'statement' => HealthStatement::Interaction->value,
            'score' => 5,
        ];
    }
}
