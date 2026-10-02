<?php

namespace App\Support;

use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class CurrentTeamResolver
{
    /** @var ?Collection<int, Team> */
    private ?Collection $visibleTeams = null;

    public function __construct(private Request $request) {}

    /**
     * @return Collection<int, Team>
     */
    public function visibleTeams(): Collection
    {
        return $this->visibleTeams ??= $this->loadVisibleTeams();
    }

    public function currentTeam(): ?Team
    {
        $teams = $this->visibleTeams();
        $routeTeam = $this->request->route('team');

        if ($routeTeam instanceof Team && $this->request->hasSession() && $teams->contains('id', $routeTeam->id)) {
            $this->request->session()->put('current_team_id', $routeTeam->id);
        }

        $rememberedId = $this->request->hasSession() ? $this->request->session()->get('current_team_id') : null;

        return $teams->firstWhere('id', $rememberedId) ?? $teams->first();
    }

    /**
     * @return Collection<int, Team>
     */
    private function loadVisibleTeams(): Collection
    {
        $user = $this->request->user();

        if ($user === null) {
            return collect();
        }

        $workspace = $this->workspaceInScope($user);

        if ($workspace === null) {
            return collect();
        }

        return $workspace->teamsVisibleTo($user)->sortBy('name')->values();
    }

    private function workspaceInScope(User $user): ?Workspace
    {
        $workspace = $this->request->route('workspace');

        if (! $workspace instanceof Workspace) {
            $workspace = $user->currentWorkspace;
        }

        if ($workspace === null || ! $user->belongsToWorkspace($workspace)) {
            return null;
        }

        return $workspace;
    }
}
