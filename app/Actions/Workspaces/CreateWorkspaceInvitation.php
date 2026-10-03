<?php

namespace App\Actions\Workspaces;

use App\Actions\Notifications\ForgetInvitationNotifications;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Support\Auth\LoginAddress;
use App\Support\Database\Transactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateWorkspaceInvitation
{
    public const ValidForDays = 7;

    public function __construct(private ForgetInvitationNotifications $forgetNotifications) {}

    /**
     * The workspace row is locked first, so that one address invited twice at
     * the same instant leaves one pending invitation.
     */
    public function handle(Workspace $workspace, User $inviter, InvitationTerms $terms): IssuedInvitation
    {
        $token = Str::random(40);

        $invitation = DB::transaction(function () use ($workspace, $inviter, $terms, $token): WorkspaceInvitation {
            Workspace::query()->whereKey($workspace->id)->lockForUpdate()->first();

            /** @var array<int, string> $replacedIds */
            $replacedIds = $workspace->invitations()
                ->where('email', LoginAddress::normalise($terms->email))
                ->whereNull('accepted_at')
                ->pluck('id')
                ->all();

            $workspace->invitations()->whereKey($replacedIds)->delete();
            $this->forgetNotifications->handle($replacedIds);

            return $workspace->invitations()->create([
                'email' => $terms->email,
                'role' => $terms->role,
                'team_id' => $terms->team?->id,
                'team_role' => $terms->team === null ? null : $terms->teamRole,
                'message' => $terms->cleanMessage(),
                'token_hash' => WorkspaceInvitation::hashToken($token),
                'invited_by_id' => $inviter->id,
                'expires_at' => now()->addDays(self::ValidForDays),
            ]);
        }, Transactions::Attempts);

        return new IssuedInvitation($invitation, $token);
    }
}
