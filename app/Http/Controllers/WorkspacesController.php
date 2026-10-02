<?php

namespace App\Http\Controllers;

use App\Actions\Workspaces\CreateWorkspace;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
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
        $canManage = $user->canManage($workspace);
        $today = ActionItem::today()->toDateString();

        $teams = $workspace->teamsVisibleTo($user)
            ->loadCount([
                'members',
                'pokerGames as open_poker_games_count' => fn (Builder $games) => $games->whereNull('ended_at'),
                'actionItems as open_action_items_count' => fn (Builder $items) => $items->whereNull('completed_at'),
                'actionItems as overdue_action_items_count' => fn (Builder $items) => $items
                    ->whereNull('completed_at')
                    ->where('due_on', '<', $today),
            ])
            ->loadMax(
                ['retros as last_retro_at' => fn (Builder $retros) => $retros->where('phase', RetroPhase::Completed->value)],
                'completed_at',
            )
            ->load(['members' => fn ($members) => $members->orderBy('users.name')->limit(5)]);

        $openRetroTitles = Retro::query()
            ->whereIn('team_id', $teams->modelKeys())
            ->where('phase', '!=', RetroPhase::Completed->value)
            ->latest()
            ->orderByDesc('id')
            ->get(['id', 'team_id', 'title'])
            ->unique('team_id')
            ->pluck('title', 'team_id');

        $joinedTeamIds = $user->teams()
            ->whereIn('teams.id', $teams->modelKeys())
            ->pluck('teams.id');

        $managerRoles = collect(WorkspaceRole::cases())
            ->filter(fn (WorkspaceRole $role): bool => $role->canManageWorkspace())
            ->map(fn (WorkspaceRole $role): string => $role->value)
            ->all();

        return Inertia::render('workspaces/show', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'membersCount' => $workspace->members()->count(),
            'adminsCount' => $workspace->members()->wherePivotIn('role', $managerRoles)->count(),
            'otherAdminName' => $canManage
                ? $workspace->members()
                    ->wherePivotIn('role', $managerRoles)
                    ->whereKeyNot($user->id)
                    ->orderBy('users.name')
                    ->first()
                    ?->name
                : null,
            'teams' => $teams->map(fn (Team $team): array => [
                ...$team->only(['id', 'name']),
                'membersCount' => $team->members_count,
                'members' => $team->members->map(fn (User $member): array => [
                    'name' => $member->name,
                    'avatarUrl' => $member->avatarUrl(),
                ])->all(),
                'isMember' => $joinedTeamIds->contains($team->id),
                'activity' => [
                    'openRetroTitle' => $openRetroTitles->get($team->id),
                    'lastRetroAt' => $team->last_retro_at === null
                        ? null
                        : Carbon::parse($team->last_retro_at)->toIso8601String(),
                    'openPokerGames' => $team->open_poker_games_count,
                    'openActionItems' => $team->open_action_items_count,
                    'overdueActionItems' => $team->overdue_action_items_count,
                ],
            ])->values(),
            'canManage' => $canManage,
        ]);
    }

    public function destroy(Workspace $workspace): RedirectResponse
    {
        Gate::authorize('delete', $workspace);

        $workspace->delete();

        return to_route('dashboard');
    }
}
