<?php

namespace Database\Factories;

use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\TeamInviteLink;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<TeamInviteLink>
 */
class TeamInviteLinkFactory extends Factory
{
    public function definition(): array
    {
        $token = Str::random(40);

        return [
            'team_id' => Team::factory(),
            'token' => $token,
            'token_hash' => TeamInviteLink::hashToken($token),
            'team_role' => TeamRole::Member,
            'expires_at' => now()->addDays(TeamInviteLink::ValidForDays),
            'uses_count' => 0,
            'revoked_at' => null,
        ];
    }

    public function withToken(string $token): static
    {
        return $this->state(fn () => [
            'token' => $token,
            'token_hash' => TeamInviteLink::hashToken($token),
        ]);
    }

    public function expired(): static
    {
        return $this->state(fn () => ['expires_at' => now()->subMinute()]);
    }

    public function revoked(): static
    {
        return $this->state(fn () => ['revoked_at' => now()]);
    }

    public function joinedBy(int $count): static
    {
        return $this->state(fn () => ['uses_count' => $count]);
    }
}
