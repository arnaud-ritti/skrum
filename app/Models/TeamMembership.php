<?php

namespace App\Models;

use App\Enums\TeamRole;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * @property string $team_id
 * @property string $user_id
 * @property TeamRole $role
 */
#[Table(name: 'team_user')]
class TeamMembership extends Pivot
{
    protected function casts(): array
    {
        return [
            'role' => TeamRole::class,
        ];
    }
}
