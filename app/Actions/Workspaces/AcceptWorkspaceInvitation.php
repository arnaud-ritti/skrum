<?php

namespace App\Actions\Workspaces;

use App\Models\User;
use App\Models\WorkspaceInvitation;
use Illuminate\Support\Facades\DB;

class AcceptWorkspaceInvitation
{
    public function handle(WorkspaceInvitation $invitation, User $user): void
    {
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
