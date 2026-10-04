<?php

namespace App\Actions\Workspaces;

use App\Actions\Notifications\ForgetInvitationNotifications;
use App\Enums\TeamRole;
use App\Exceptions\InvitationUnavailable;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Support\Database\Transactions;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AcceptWorkspaceInvitation
{
    public function __construct(private ForgetInvitationNotifications $forgetNotifications) {}

    /**
     * Joins the workspace and, for a team invitation, the team, each with the
     * invitation's role unless the account is already in it: an existing role
     * is never changed.
     *
     * @throws InvitationUnavailable when the invitation stopped being pending
     */
    public function handle(WorkspaceInvitation $invitation, User $user): void
    {
        throw_unless($invitation->matchesEmail($user->email), InvalidArgumentException::class, 'The invitation was sent to another email address.');

        DB::transaction(function () use ($invitation, $user): void {
            $locked = WorkspaceInvitation::query()->lockForUpdate()->find($invitation->id);

            if ($locked === null || ! $locked->isPending()) {
                throw new InvitationUnavailable('The invitation is no longer pending.');
            }

            $workspace = $locked->workspace;

            if (! $user->belongsToWorkspace($workspace)) {
                $workspace->members()->attach($user, ['role' => $locked->role->value]);
            }

            $team = $locked->team;

            if ($team !== null && ! $team->hasMember($user)) {
                $team->members()->attach($user, ['role' => ($locked->team_role ?? TeamRole::Member)->value]);
            }

            $locked->update(['accepted_at' => now()]);
            $this->forgetNotifications->handle([$locked->id]);

            $user->forceFill(['current_workspace_id' => $workspace->id])->save();
        }, Transactions::Attempts);
    }
}
