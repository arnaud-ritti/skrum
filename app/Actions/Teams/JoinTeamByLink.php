<?php

namespace App\Actions\Teams;

use App\Enums\WorkspaceRole;
use App\Exceptions\InvitationUnavailable;
use App\Models\Team;
use App\Models\TeamInviteLink;
use App\Models\User;
use App\Support\Database\Transactions;
use Illuminate\Support\Facades\DB;

class JoinTeamByLink
{
    /**
     * Joins the link's team, and its workspace as a member when needed,
     * counting the use once per account. The link row is locked so that
     * joins at the same moment are counted one by one.
     *
     * @throws InvitationUnavailable when the link was turned off or expired
     */
    public function handle(TeamInviteLink $link, User $user): Team
    {
        return DB::transaction(function () use ($link, $user): Team {
            $locked = TeamInviteLink::query()->lockForUpdate()->find($link->id);

            if ($locked === null) {
                throw new InvitationUnavailable('The link no longer exists.');
            }

            $team = $locked->team;

            if ($team->hasMember($user)) {
                return $team;
            }

            if (! $locked->isUsable()) {
                throw new InvitationUnavailable('The link no longer works.');
            }

            $workspace = $team->workspace;

            if (! $user->belongsToWorkspace($workspace)) {
                $workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
            }

            $team->members()->attach($user, ['role' => $locked->team_role->value]);
            $locked->increment('uses_count');

            $user->forceFill(['current_workspace_id' => $workspace->id])->save();

            return $team;
        }, Transactions::Attempts);
    }
}
