<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Models\User;
use App\Support\Alphabetical;
use Illuminate\Contracts\Database\Query\Builder;

/**
 * Who a facilitator may hand a session of the team to: its taking-part members and the managers
 * of its workspace, the facilitator aside, sorted by name.
 */
class FacilitatorCandidates
{
    /**
     * @return array<int, array{userId: string, name: string}>
     */
    public function handle(Team $team, ?string $facilitatorUserId): array
    {
        $managerIds = $team->workspace->managers()->pluck('users.id');

        $candidates = User::query()
            ->where(fn (Builder $query) => $query
                ->whereIn('id', $team->participatingMembers()->select('users.id'))
                ->orWhereIn('id', $managerIds))
            ->when($facilitatorUserId !== null, fn ($query) => $query->whereKeyNot($facilitatorUserId))
            ->orderBy('id')
            ->get(['id', 'name']);

        return Alphabetical::sort($candidates, fn (User $user): string => $user->name)
            ->map(fn (User $user): array => ['userId' => $user->id, 'name' => $user->name])
            ->all();
    }
}
