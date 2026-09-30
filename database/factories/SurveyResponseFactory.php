<?php

namespace Database\Factories;

use App\Models\Participant;
use App\Models\Survey;
use App\Models\SurveyOption;
use App\Models\SurveyResponse;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SurveyResponse>
 */
class SurveyResponseFactory extends Factory
{
    public function definition(): array
    {
        return [
            'survey_id' => Survey::factory(),
            'survey_option_id' => fn (array $attributes) => SurveyOption::factory()->create(['survey_id' => $attributes['survey_id']])->id,
            'participant_id' => fn (array $attributes) => Participant::factory()->create([
                'retro_id' => Survey::query()->whereKey($attributes['survey_id'])->firstOrFail()->retro_id,
            ])->id,
        ];
    }
}
