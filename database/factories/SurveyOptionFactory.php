<?php

namespace Database\Factories;

use App\Models\Survey;
use App\Models\SurveyOption;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SurveyOption>
 */
class SurveyOptionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'survey_id' => Survey::factory(),
            'label' => fake()->word(),
            'position' => 0,
        ];
    }
}
