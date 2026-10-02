<?php

namespace App\Actions\Workspaces;

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Support\Auth\LoginAddress;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateWorkspaceInvitation
{
    public const ValidForDays = 7;

    public function handle(Workspace $workspace, User $inviter, string $email, WorkspaceRole $role): IssuedInvitation
    {
        $token = Str::random(40);

        $invitation = DB::transaction(function () use ($workspace, $inviter, $email, $role, $token): WorkspaceInvitation {
            $workspace->invitations()
                ->whereRaw('lower(email) = ?', [LoginAddress::normalise($email)])
                ->whereNull('accepted_at')
                ->delete();

            return $workspace->invitations()->create([
                'email' => $email,
                'role' => $role,
                'token_hash' => WorkspaceInvitation::hashToken($token),
                'invited_by_id' => $inviter->id,
                'expires_at' => now()->addDays(self::ValidForDays),
            ]);
        });

        return new IssuedInvitation($invitation, $token);
    }
}
