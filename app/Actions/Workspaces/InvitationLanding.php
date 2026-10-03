<?php

namespace App\Actions\Workspaces;

use App\Models\User;
use App\Models\WorkspaceInvitation;

class InvitationLanding
{
    public function url(WorkspaceInvitation $invitation, User $user): string
    {
        $team = $invitation->team;

        if ($team !== null && $user->can('view', $team)) {
            return route('teams.show', [$invitation->workspace, $team]);
        }

        return route('workspaces.show', $invitation->workspace);
    }
}
