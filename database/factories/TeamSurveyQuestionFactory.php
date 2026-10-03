<?php

namespace Database\Factories;

use App\Enums\TeamSurveyQuestionKind;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyQuestion;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TeamSurveyQuestion>
 */
class TeamSurveyQuestionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_survey_id' => TeamSurvey::factory(),
            'kind' => TeamSurveyQuestionKind::Scale,
            'label' => fake()->sentence(6),
            'position' => 0,
            'scale_max' => TeamSurveyQuestion::BuilderScaleMax,
        ];
    }

    public function kind(TeamSurveyQuestionKind $kind): static
    {
        return $this->state(fn (array $attributes) => [
            'kind' => $kind,
            'scale_max' => $kind === TeamSurveyQuestionKind::Scale ? ($attributes['scale_max'] ?? TeamSurveyQuestion::BuilderScaleMax) : null,
        ]);
    }

    public function required(): static
    {
        return $this->state(fn () => ['is_required' => true]);
    }
}
