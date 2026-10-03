<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WorkspaceInvitation;

class WorkspaceInvitationPolicy
{
    /**
     * Resend or revoke: the workspace's managers, and for a team invitation
     * whoever may invite to that team.
     */
    public function manage(User $user, WorkspaceInvitation $invitation): bool
    {
        if ($user->canManage($invitation->workspace)) {
            return true;
        }

        if ($invitation->team === null) {
            return false;
        }

        return $user->can('invite', $invitation->team);
    }
}
