<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Models\WorkspaceInvitation;
use App\Support\Alphabetical;

class PresentTeamInvitations
{
    /**
     * @return array<int, array{
     *     id: string,
     *     email: string,
     *     teamRole: ?string,
     *     status: 'pending'|'expired'|'declined',
     *     invitedAt: string
     * }>
     */
    public function handle(Team $team): array
    {
        $invitations = $team->invitations()->whereNull('accepted_at')->orderBy('id')->get();

        return Alphabetical::sort($invitations, fn (WorkspaceInvitation $invitation): string => $invitation->email)
            ->map(fn (WorkspaceInvitation $invitation): array => [
                'id' => $invitation->id,
                'email' => $invitation->email,
                'teamRole' => $invitation->team_role?->value,
                'status' => $invitation->status(),
                'invitedAt' => $invitation->created_at->toIso8601String(),
            ])
            ->values()
            ->all();
    }
}
