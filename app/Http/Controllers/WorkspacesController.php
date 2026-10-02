<?php

namespace App\Http\Controllers;

use App\Actions\Workspaces\CreateWorkspace;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class WorkspacesController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('workspaces/create');
    }

    public function store(Request $request, CreateWorkspace $createWorkspace): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ]);

        $workspace = $createWorkspace->handle($request->user(), $validated['name']);

        return to_route('workspaces.show', $workspace);
    }

    public function show(Request $request, Workspace $workspace): Response
    {
        $user = $request->user();

        $teams = $workspace->teamsVisibleTo($user)
            ->loadCount('members')
            ->load(['members' => fn ($members) => $members->orderBy('users.name')->limit(5)]);

        return Inertia::render('workspaces/show', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'membersCount' => $workspace->members()->count(),
            'adminsCount' => $workspace->members()
                ->wherePivotIn('role', collect(WorkspaceRole::cases())
                    ->filter(fn (WorkspaceRole $role): bool => $role->canManageWorkspace())
                    ->map(fn (WorkspaceRole $role): string => $role->value)
                    ->all())
                ->count(),
            'teams' => $teams->map(fn (Team $team): array => [
                ...$team->only(['id', 'name']),
                'membersCount' => $team->members_count,
                'members' => $team->members->map(fn (User $member): array => [
                    'name' => $member->name,
                    'avatarUrl' => $member->avatarUrl(),
                ])->all(),
            ])->values(),
            'canManage' => $user->canManage($workspace),
        ]);
    }

    public function destroy(Workspace $workspace): RedirectResponse
    {
        Gate::authorize('delete', $workspace);

        $workspace->delete();

        return to_route('dashboard');
    }
}
