<?php

namespace Database\Factories;

use App\Enums\TeamAccessRequestStatus;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\TeamAccessRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TeamAccessRequest>
 */
class TeamAccessRequestFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'user_id' => User::factory(),
            'message' => fake()->sentence(),
            'status' => TeamAccessRequestStatus::Pending,
        ];
    }

    /**
     * The requester is a member of the team's workspace, as the app requires to ask for access.
     */
    public function configure(): static
    {
        return $this->afterCreating(function (TeamAccessRequest $request): void {
            $request->team->workspace->members()->syncWithoutDetaching([
                $request->user_id => ['role' => WorkspaceRole::Member->value],
            ]);
        });
    }

    /**
     * A request still waiting for an answer, from a member of the team's workspace who is not in the team.
     */
    public function pending(): static
    {
        return $this->state(['status' => TeamAccessRequestStatus::Pending]);
    }
}
