<?php

namespace Database\Factories;

use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Team>
 */
class TeamFactory extends Factory
{
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'name' => fake()->words(2, true),
        ];
    }

    public function withMember(User $user): static
    {
        return $this->hasAttached($user, [], 'members');
    }
}
