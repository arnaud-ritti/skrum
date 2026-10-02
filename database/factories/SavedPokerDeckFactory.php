<?php

namespace Database\Factories;

use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SavedPokerDeck>
 */
class SavedPokerDeckFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'name' => fake()->unique()->words(2, true),
            'cards' => ['1', '2', '3', '?'],
            'created_by_user_id' => User::factory(),
        ];
    }

    public function forWorkspace(Workspace $workspace): static
    {
        return $this->state(fn (): array => [
            'team_id' => null,
            'workspace_id' => $workspace->id,
        ]);
    }
}
