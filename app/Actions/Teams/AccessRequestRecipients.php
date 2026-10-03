<?php

namespace App\Actions\Teams;

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Collection;

class AccessRequestRecipients
{
    /**
     * The people who may approve the request: who manages the team's members.
     *
     * @return Collection<int, User>
     */
    public function for(Team $team): Collection
    {
        $managers = $team->workspace->members()
            ->wherePivotIn('role', [WorkspaceRole::Owner->value, WorkspaceRole::Admin->value])
            ->orderBy('users.id')
            ->get();
        $owners = $team->members()
            ->wherePivot('role', TeamRole::Owner->value)
            ->orderBy('users.id')
            ->get();

        return $managers->concat($owners)->unique('id')->sortBy('id')->values();
    }
}
