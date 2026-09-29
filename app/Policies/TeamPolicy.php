<?php

namespace App\Policies;

use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;

class TeamPolicy
{
    public function view(User $user, Team $team): bool
    {
        if ($user->canManage($team->workspace)) {
            return true;
        }

        return $team->hasMember($user);
    }

    public function create(User $user, Workspace $workspace): bool
    {
        return $user->canManage($workspace);
    }

    public function update(User $user, Team $team): bool
    {
        return $user->canManage($team->workspace);
    }

    public function delete(User $user, Team $team): bool
    {
        return $user->canManage($team->workspace);
    }

    public function manageMembers(User $user, Team $team): bool
    {
        return $user->canManage($team->workspace);
    }

    public function createRetro(User $user, Team $team): bool
    {
        return $this->view($user, $team);
    }
}
