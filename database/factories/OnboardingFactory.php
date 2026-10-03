<?php

namespace Database\Factories;

use App\Enums\OnboardingStep;
use App\Models\Onboarding;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Onboarding>
 */
class OnboardingFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'step' => OnboardingStep::Workspace,
            'workspace_id' => null,
            'team_id' => null,
            'team_name' => null,
            'completed_at' => null,
        ];
    }

    public function atStep(OnboardingStep $step): static
    {
        return $this->state(fn () => ['step' => $step]);
    }

    public function completed(): static
    {
        return $this->state(fn () => ['completed_at' => now()]);
    }
}
