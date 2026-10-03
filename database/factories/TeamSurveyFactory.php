<?php

namespace Database\Factories;

use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<TeamSurvey>
 */
class TeamSurveyFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'title' => fake()->sentence(3),
            'guest_token' => Str::random(40),
        ];
    }

    public function draft(): static
    {
        return $this->state(fn () => ['status' => TeamSurveyStatus::Draft]);
    }

    public function open(): static
    {
        return $this->state(fn () => ['status' => TeamSurveyStatus::Open, 'opened_at' => now()]);
    }

    public function closed(): static
    {
        return $this->state(fn () => ['status' => TeamSurveyStatus::Closed, 'opened_at' => now()->subHour(), 'closed_at' => now()]);
    }

    public function withGuestAccess(): static
    {
        return $this->state(fn () => ['guest_access_enabled' => true]);
    }

    public function withoutThreshold(): static
    {
        return $this->state(fn () => ['results_threshold' => 0]);
    }

    public function healthCheck(): static
    {
        return $this->state(fn () => ['template' => TeamSurveyTemplate::HealthCheck]);
    }

    public function attachedTo(Retro $retro): static
    {
        return $this->healthCheck()->state(fn () => [
            'team_id' => $retro->team_id,
            'retro_id' => $retro->id,
            'title' => $retro->title,
            'results_threshold' => 0,
            'one_question_at_a_time' => false,
            'show_results_after_answer' => false,
        ]);
    }
}
