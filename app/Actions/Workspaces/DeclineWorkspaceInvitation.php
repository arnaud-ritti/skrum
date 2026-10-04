<?php

namespace App\Actions\Workspaces;

use App\Actions\Notifications\ForgetInvitationNotifications;
use App\Exceptions\InvitationUnavailable;
use App\Models\WorkspaceInvitation;
use App\Notifications\InvitationDeclinedNotification;
use Illuminate\Support\Facades\DB;

class DeclineWorkspaceInvitation
{
    public function __construct(private ForgetInvitationNotifications $forgetNotifications) {}

    /**
     * Anyone holding the link may decline: the link is what was sent to
     * the invited address. The inviter is told in the bell while still a
     * member of the workspace.
     *
     * @throws InvitationUnavailable when the invitation stopped being pending
     */
    public function handle(WorkspaceInvitation $invitation): WorkspaceInvitation
    {
        $declined = DB::transaction(function () use ($invitation): WorkspaceInvitation {
            $locked = WorkspaceInvitation::query()->lockForUpdate()->find($invitation->id);

            throw_if($locked === null || ! $locked->isPending(), InvitationUnavailable::class, 'The invitation is no longer pending.');

            $locked->update(['declined_at' => now()]);
            $this->forgetNotifications->handle([$locked->id]);

            return $locked;
        });

        $this->tellInviter($declined);

        return $declined;
    }

    private function tellInviter(WorkspaceInvitation $invitation): void
    {
        $inviter = $invitation->invitedBy;

        if ($inviter === null) {
            return;
        }

        if (! $inviter->belongsToWorkspace($invitation->workspace)) {
            return;
        }

        $inviter->notify(new InvitationDeclinedNotification($invitation->id, $invitation->email, $invitation->workspace_id, $invitation->team_id));
    }
}
