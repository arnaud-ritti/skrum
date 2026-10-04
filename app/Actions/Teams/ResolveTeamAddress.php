<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Models\User;
use App\Support\Alphabetical;

class ResolveTeamAddress
{
    /** Rule S-1: the current workspace first, then the account's other workspaces by name; never a workspace the account is not in. */
    public function handle(User $user, string $slug): ?Team
    {
        $workspaceIds = $user->workspaces()->pluck('workspaces.id')->all();

        $teams = Team::query()
            ->where('slug', $slug)
            ->whereIn('workspace_id', $workspaceIds)
            ->with('workspace')
            ->get();

        $current = $teams->where('workspace_id', $user->current_workspace_id);
        $others = Alphabetical::sort(
            $teams->where('workspace_id', '!=', $user->current_workspace_id)->sortBy('workspace_id'),
            fn (Team $team): string => $team->workspace->name,
        );

        return $current->concat($others)->first(fn (Team $team): bool => $user->can('view', $team));
    }
}
