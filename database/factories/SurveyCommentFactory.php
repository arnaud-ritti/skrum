<?php

namespace Database\Factories;

use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyComment;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SurveyComment>
 */
class SurveyCommentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'survey_id' => fn (array $attributes) => Survey::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'participant_id' => fn (array $attributes) => Participant::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'content' => fake()->sentence(),
        ];
    }
}
