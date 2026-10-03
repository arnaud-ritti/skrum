<?php

namespace Database\Factories;

use App\Enums\TeamActivityKind;
use App\Models\Team;
use App\Models\TeamActivity;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TeamActivity>
 */
class TeamActivityFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'kind' => TeamActivityKind::MemberJoined,
            'actor_user_id' => null,
            'actor_name' => null,
            'subject_id' => null,
            'subject_title' => null,
        ];
    }
}
