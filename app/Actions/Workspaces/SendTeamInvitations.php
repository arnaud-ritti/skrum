<?php

namespace App\Actions\Workspaces;

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Support\Auth\LoginAddress;
use Illuminate\Validation\ValidationException;

class SendTeamInvitations
{
    public function __construct(private SendInvitation $sendInvitation) {}

    /**
     * Every address is checked before any is invited, so that one refused
     * address sends nothing. A pending invitation of the address that the
     * inviter may not manage is never replaced.
     *
     * @param  array<int, string>  $emails  normalised and distinct, keyed by the index of the submitted chip
     * @return array<int, IssuedInvitation>
     */
    public function handle(Team $team, User $inviter, array $emails, TeamRole $role, ?string $message): array
    {
        $errors = [];

        foreach ($emails as $index => $email) {
            if ($team->members()->whereAddress($email)->exists()) {
                $errors["emails.{$index}"] = __(':email is already in :team.', ['email' => $email, 'team' => $team->name]);

                continue;
            }

            if ($this->hasPendingInvitationBeyond($inviter, $team, $email)) {
                $errors["emails.{$index}"] = __(':email already has a pending invitation in :workspace.', ['email' => $email, 'workspace' => $team->workspace->name]);
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        $issued = [];

        foreach ($emails as $email) {
            $issued[] = $this->sendInvitation->handle(
                $team->workspace,
                $inviter,
                new InvitationTerms($email, WorkspaceRole::Member, $team, $role, $message),
            );
        }

        return $issued;
    }

    private function hasPendingInvitationBeyond(User $inviter, Team $team, string $email): bool
    {
        return $team->workspace->invitations()
            ->where('email', LoginAddress::normalise($email))
            ->whereNull('accepted_at')
            ->get()
            ->contains(fn (WorkspaceInvitation $invitation): bool => $invitation->isPending() && $inviter->cannot('manage', $invitation));
    }
}
