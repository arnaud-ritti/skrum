<?php

namespace Database\Factories;

use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TeamSurveyAnswer>
 */
class TeamSurveyAnswerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_survey_question_id' => TeamSurveyQuestion::factory(),
            'team_survey_respondent_id' => fn (array $attributes) => TeamSurveyRespondent::factory()->state([
                'team_survey_id' => TeamSurveyQuestion::query()->whereKey($attributes['team_survey_question_id'])->value('team_survey_id'),
            ]),
            'value' => 3,
        ];
    }
}
