<?php

namespace App\Actions\Workspaces;

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class SendTeamInvitations
{
    public function __construct(private SendInvitation $sendInvitation) {}

    /**
     * Every address is checked before any is invited, so that one refused
     * address sends nothing.
     *
     * @param  array<int, string>  $emails  normalised and distinct
     * @return array<int, IssuedInvitation>
     */
    public function handle(Team $team, User $inviter, array $emails, TeamRole $role, ?string $message): array
    {
        $errors = [];

        foreach ($emails as $index => $email) {
            if ($team->members()->whereAddress($email)->exists()) {
                $errors["emails.{$index}"] = __(':email is already in :team.', ['email' => $email, 'team' => $team->name]);
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
}
