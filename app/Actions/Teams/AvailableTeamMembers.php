<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Models\User;
use App\Support\Alphabetical;

class AvailableTeamMembers
{
    /**
     * Members of the workspace who are not in the team, by name.
     *
     * @return array<int, array{id: string, name: string, email: string, avatarUrl: string}>
     */
    public function handle(Team $team): array
    {
        $members = $team->workspace->members()
            ->whereNotIn('users.id', $team->members()->select('users.id'))
            ->orderBy('users.id')
            ->get();

        return Alphabetical::sort($members, fn (User $member): string => $member->name)
            ->map(fn (User $member): array => [
                'id' => $member->id,
                'name' => $member->name,
                'email' => $member->email,
                'avatarUrl' => $member->avatarUrl(),
            ])
            ->values()
            ->all();
    }
}
