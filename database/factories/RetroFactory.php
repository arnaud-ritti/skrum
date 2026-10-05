<?php

namespace Database\Factories;

use App\Actions\HealthCheck\AttachHealthCheck;
use App\Enums\RetroPhase;
use App\Models\Retro;
use App\Models\Team;
use Carbon\CarbonInterface;
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
            'template' => 'start_stop_continue',
            'phase' => RetroPhase::Writing,
            'votes_per_participant' => 5,
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

    public function withHealthCheck(): static
    {
        return $this->afterCreating(function (Retro $retro): void {
            resolve(AttachHealthCheck::class)->handle($retro);
        });
    }

    public function started(?CarbonInterface $at = null): static
    {
        return $this->state(fn () => ['started_at' => $at ?? now()]);
    }

    public function withIcebreaker(): static
    {
        return $this->state(fn () => ['icebreaker_enabled' => true]);
    }
}
