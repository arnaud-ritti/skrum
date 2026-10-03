<?php

namespace App\Actions\Teams;

use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Collection;

class AccessRequestRecipients
{
    /**
     * The people who can add members to a team today. Team roles (plan 23) change this one place.
     *
     * @return Collection<int, User>
     */
    public function for(Team $team): Collection
    {
        return $team->workspace->members()
            ->wherePivotIn('role', [WorkspaceRole::Owner->value, WorkspaceRole::Admin->value])
            ->orderBy('users.id')
            ->get();
    }
}
