<?php

namespace App\Mcp;

use App\Enums\WorkspaceRole;
use App\Models\Team;
use Illuminate\Contracts\Database\Query\Builder;

class VisibleTeams
{
    /**
     * @var array<string, array<int, string>>
     */
    private array $idsByToken = [];

    /**
     * @return array<int, string>
     */
    public function ids(McpGrant $grant): array
    {
        return $this->idsByToken[$grant->tokenId] ??= $this->resolve($grant);
    }

    /**
     * @return array<int, string>
     */
    private function resolve(McpGrant $grant): array
    {
        $user = $grant->user;

        $managedWorkspaceIds = $user->workspaces()
            ->wherePivotIn('role', [WorkspaceRole::Owner->value, WorkspaceRole::Admin->value])
            ->pluck('workspaces.id');

        return Team::query()
            ->where(fn (Builder $query) => $query
                ->whereIn('workspace_id', $managedWorkspaceIds)
                ->orWhereHas('members', fn (Builder $members) => $members->whereKey($user->id)))
            ->when($grant->teamId !== null, fn ($query) => $query->whereKey($grant->teamId))
            ->pluck('id')
            ->all();
    }
}
