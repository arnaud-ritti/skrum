<?php

namespace Database\Factories;

use App\Enums\RetroPhase;
use App\Enums\RetroTemplate;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Retro>
 */
class RetroFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'title' => fake()->sentence(3),
            'template' => RetroTemplate::StartStopContinue,
            'phase' => RetroPhase::Writing,
            'guest_token' => Str::random(40),
        ];
    }

    public function inPhase(RetroPhase $phase): static
    {
        return $this->state(fn () => ['phase' => $phase]);
    }

    public function anonymous(): static
    {
        return $this->state(fn () => ['is_anonymous' => true]);
    }

    public function withGuestAccess(): static
    {
        return $this->state(fn () => ['guest_access_enabled' => true]);
    }
}
