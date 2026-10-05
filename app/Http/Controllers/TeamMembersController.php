<?php

namespace App\Http\Controllers;

use App\Actions\Teams\MemberLastActivity;
use App\Actions\Teams\PresentTeamInvitations;
use App\Actions\Teams\RecordTeamActivity;
use App\Enums\TeamActivityKind;
use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Support\Alphabetical;
use App\Support\Teams\TeamMark;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TeamMembersController extends Controller
{
    public function index(
        Request $request,
        Workspace $workspace,
        Team $team,
        MemberLastActivity $memberLastActivity,
        PresentTeamInvitations $presentTeamInvitations,
    ): Response {
        Gate::authorize('view', $team);

        $user = $request->user();
        $canManageMembers = $user->can('manageMembers', $team);
        $canInvite = $user->can('invite', $team);
        $lastActivity = $memberLastActivity->handle($team);

        return Inertia::render('teams/members', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => [
                ...$team->only(['id', 'name', 'description', 'slug']),
                'color' => TeamMark::colorFor($team)->value,
            ],
            'canInvite' => $canInvite,
            'inviteRoles' => array_map(fn (TeamRole $role): string => $role->value, TeamRole::invitable()),
            'inviteLink' => Inertia::optional(fn (): ?array => $canInvite ? $presentTeamInvitations->link($team) : null),
            'pendingInvitations' => $canInvite ? $presentTeamInvitations->handle($team) : [],
            'members' => Alphabetical::sort($team->members()->orderBy('users.id')->get(), fn (User $member): string => $member->name)
                ->map(fn (User $member): array => [
                    ...$member->only(['id', 'name', 'email']),
                    'avatarUrl' => $member->avatarUrl(),
                    'role' => $member->teamMembership->role->value,
                    'lastActiveAt' => $lastActivity[$member->id] ?? null,
                    'isViewer' => $member->id === $user->id,
                ])
                ->values(),
            'canManageMembers' => $canManageMembers,
            'roleOptions' => $canManageMembers ? TeamRole::options() : [],
        ]);
    }

    public function store(Request $request, Workspace $workspace, Team $team, RecordTeamActivity $recordTeamActivity): RedirectResponse
    {
        Gate::authorize('manageMembers', $team);

        $validated = $request->validate([
            'user_id' => [
                'required',
                'uuid',
                Rule::exists('workspace_user', 'user_id')->where('workspace_id', $workspace->id),
            ],
            'role' => ['nullable', Rule::enum(TeamRole::class)],
        ]);

        DB::transaction(function () use ($team, $validated, $recordTeamActivity): void {
            Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

            if ($team->members()->whereKey($validated['user_id'])->exists()) {
                return;
            }

            $team->members()->attach($validated['user_id'], ['role' => $validated['role'] ?? TeamRole::Member->value]);

            $recordTeamActivity->handle($team->id, TeamActivityKind::MemberJoined, User::query()->whereKey($validated['user_id'])->firstOrFail());
        });

        return back();
    }

    public function destroy(Workspace $workspace, Team $team, User $member): RedirectResponse
    {
        Gate::authorize('manageMembers', $team);

        DB::transaction(function () use ($team, $member): void {
            $locked = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

            if ($locked->defaultFacilitators()->detach($member->id) > 0) {
                $locked->update(['rotation_position' => 0]);
            }

            $locked->members()->detach($member->id);
        });

        return back();
    }
}
