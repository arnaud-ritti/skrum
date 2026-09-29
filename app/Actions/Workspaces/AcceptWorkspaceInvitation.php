<?php

namespace App\Actions\Workspaces;

use App\Models\User;
use App\Models\WorkspaceInvitation;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AcceptWorkspaceInvitation
{
    public function handle(WorkspaceInvitation $invitation, User $user): void
    {
        if (! $invitation->isPending()) {
            throw new InvalidArgumentException('The invitation is no longer pending.');
        }

        if (! $invitation->matchesEmail($user->email)) {
            throw new InvalidArgumentException('The invitation was sent to another email address.');
        }

        DB::transaction(function () use ($invitation, $user): void {
            $workspace = $invitation->workspace;

            if (! $user->belongsToWorkspace($workspace)) {
                $workspace->members()->attach($user, ['role' => $invitation->role->value]);
            }

            $invitation->update(['accepted_at' => now()]);

            $user->forceFill(['current_workspace_id' => $workspace->id])->save();
        });
    }
}
