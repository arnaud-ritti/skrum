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
        return $user->managesTeam($team);
    }

    public function delete(User $user, Team $team): bool
    {
        return $user->canManage($team->workspace);
    }

    public function manageMembers(User $user, Team $team): bool
    {
        return $user->managesTeam($team);
    }

    public function manageRituals(User $user, Team $team): bool
    {
        return $user->managesRitualsOf($team);
    }

    /**
     * Make oneself the facilitator of an open session of the team (owner's decision 2 B).
     */
    public function takeControl(User $user, Team $team): bool
    {
        return $user->managesRitualsOf($team);
    }

    public function createRetro(User $user, Team $team): bool
    {
        return $this->takesPart($user, $team);
    }

    public function createPokerGame(User $user, Team $team): bool
    {
        return $this->takesPart($user, $team);
    }

    public function createWhiteboard(User $user, Team $team): bool
    {
        return $this->takesPart($user, $team);
    }

    public function createGameRoom(User $user, Team $team): bool
    {
        return $this->takesPart($user, $team);
    }

    public function createSurvey(User $user, Team $team): bool
    {
        return $this->takesPart($user, $team);
    }

    public function manageIntegrations(User $user, Team $team): bool
    {
        return $user->managesTeam($team);
    }

    private function takesPart(User $user, Team $team): bool
    {
        if (! $this->view($user, $team)) {
            return false;
        }

        return ! $user->isObserverOf($team);
    }
}
