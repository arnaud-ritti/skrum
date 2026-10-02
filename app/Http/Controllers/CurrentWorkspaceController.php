<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class CurrentWorkspaceController extends Controller
{
    public function show(Request $request): RedirectResponse
    {
        $user = $request->user();

        $workspace = $user->workspaces()->whereKey($user->current_workspace_id)->first()
            ?? $user->workspaces()->orderBy('name')->orderBy('workspaces.id')->first();

        if ($workspace === null) {
            return to_route('workspaces.create');
        }

        $teams = $workspace->teamsVisibleTo($user);
        $team = $teams->firstWhere('id', $request->session()->get('current_team_id')) ?? $teams->first();

        if ($team === null) {
            return to_route('workspaces.show', $workspace);
        }

        return to_route('teams.show', [$workspace, $team]);
    }
}
