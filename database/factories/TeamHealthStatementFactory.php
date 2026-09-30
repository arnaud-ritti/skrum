<?php

namespace Database\Factories;

use App\Enums\HealthStatement;
use App\Models\Team;
use App\Models\TeamHealthStatement;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TeamHealthStatement>
 */
class TeamHealthStatementFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'builtin' => null,
            'text' => fake()->sentence(5),
            'label' => fake()->word(),
            'position' => 0,
        ];
    }

    public function builtin(HealthStatement $statement): static
    {
        return $this->state(fn () => ['builtin' => $statement, 'text' => null, 'label' => null]);
    }

    public function archived(): static
    {
        return $this->state(fn () => ['archived_at' => now()]);
    }
}
