<?php

namespace Database\Factories;

use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TeamSurveyRespondent>
 */
class TeamSurveyRespondentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_survey_id' => TeamSurvey::factory(),
            'user_id' => User::factory(),
        ];
    }

    public function guest(string $secret = 'secret'): static
    {
        return $this->state(fn () => [
            'user_id' => null,
            'guest_name' => fake()->firstName(),
            'guest_secret_hash' => hash('sha256', $secret),
        ]);
    }
}
