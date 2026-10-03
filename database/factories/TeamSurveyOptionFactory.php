<?php

namespace Database\Factories;

use App\Models\TeamSurveyOption;
use App\Models\TeamSurveyQuestion;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TeamSurveyOption>
 */
class TeamSurveyOptionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_survey_question_id' => TeamSurveyQuestion::factory(),
            'label' => fake()->word(),
            'position' => 0,
        ];
    }
}
