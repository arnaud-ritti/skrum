<?php

namespace Database\Factories;

use App\Models\Participant;
use App\Models\Survey;
use App\Models\SurveyTextAnswer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SurveyTextAnswer>
 */
class SurveyTextAnswerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'survey_id' => Survey::factory()->text(),
            'participant_id' => fn (array $attributes) => Participant::factory()->create([
                'retro_id' => Survey::query()->whereKey($attributes['survey_id'])->firstOrFail()->retro_id,
            ])->id,
            'content' => fake()->sentence(),
        ];
    }
}
