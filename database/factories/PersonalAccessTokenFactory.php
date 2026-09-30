<?php

namespace Database\Factories;

use App\Enums\McpScope;
use App\Models\PersonalAccessToken;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<PersonalAccessToken>
 */
class PersonalAccessTokenFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tokenable_type' => (new User)->getMorphClass(),
            'tokenable_id' => User::factory(),
            'name' => fake()->unique()->words(2, true),
            'token' => hash('sha256', 'skrum_'.Str::random(40)),
            'abilities' => [McpScope::Read->value],
            'token_hint' => '0000',
            'expires_at' => now()->addDays(90),
        ];
    }

    public function forUser(User $user): static
    {
        return $this->state(fn () => [
            'tokenable_type' => $user->getMorphClass(),
            'tokenable_id' => $user->id,
        ]);
    }

    public function withScopes(McpScope ...$scopes): static
    {
        $abilities = collect([McpScope::Read, ...$scopes])
            ->map(fn (McpScope $scope): string => $scope->value)
            ->unique()
            ->values()
            ->all();

        return $this->state(fn () => ['abilities' => $abilities]);
    }

    public function boundTo(Team $team): static
    {
        return $this->state(fn () => ['team_id' => $team->id]);
    }

    public function expired(): static
    {
        return $this->state(fn () => ['expires_at' => now()->subDay()]);
    }
}
