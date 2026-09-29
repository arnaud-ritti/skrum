<?php

namespace App\Http\Controllers;

use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamsController extends Controller
{
    public function store(Request $request, Workspace $workspace): RedirectResponse
    {
        Gate::authorize('create', [Team::class, $workspace]);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ]);

        $team = $workspace->teams()->create($validated);

        return to_route('teams.show', [$workspace, $team]);
    }

    public function show(Request $request, Workspace $workspace, Team $team): Response
    {
        Gate::authorize('view', $team);

        $canManage = $request->user()->can('manageMembers', $team);

        return Inertia::render('teams/show', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name']),
            'members' => $team->members()->orderBy('name')->get()
                ->map(fn (User $member) => $member->only(['id', 'name', 'email'])),
            'availableMembers' => $canManage
                ? $workspace->members()->whereNotIn('users.id', $team->members()->select('users.id'))->orderBy('name')->get()
                    ->map(fn (User $member) => $member->only(['id', 'name', 'email']))
                : [],
            'canManage' => $canManage,
        ]);
    }

    public function update(Request $request, Workspace $workspace, Team $team): RedirectResponse
    {
        Gate::authorize('update', $team);

        $team->update($request->validate([
            'name' => ['required', 'string', 'max:100'],
        ]));

        return back();
    }

    public function destroy(Workspace $workspace, Team $team): RedirectResponse
    {
        Gate::authorize('delete', $team);

        $team->delete();

        return to_route('workspaces.show', $workspace);
    }
}
