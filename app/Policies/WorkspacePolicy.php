<?php

namespace App\Policies;

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;

class WorkspacePolicy
{
    public function view(User $user, Workspace $workspace): bool
    {
        return $user->belongsToWorkspace($workspace);
    }

    public function update(User $user, Workspace $workspace): bool
    {
        return $user->canManage($workspace);
    }

    public function manageMembers(User $user, Workspace $workspace): bool
    {
        return $user->canManage($workspace);
    }

    public function manageTemplates(User $user, Workspace $workspace): bool
    {
        return $user->canManage($workspace);
    }

    public function delete(User $user, Workspace $workspace): bool
    {
        return $user->roleIn($workspace) === WorkspaceRole::Owner;
    }
}
