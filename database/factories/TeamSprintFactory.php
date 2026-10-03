<?php

namespace Database\Factories;

use App\Models\Team;
use App\Models\TeamSprint;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TeamSprint>
 */
class TeamSprintFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'number' => fake()->unique()->numberBetween(1, 9999),
            'starts_on' => '2026-09-21',
            'ends_on' => '2026-10-04',
        ];
    }
}
