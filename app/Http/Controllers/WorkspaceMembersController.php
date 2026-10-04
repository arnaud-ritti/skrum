<?php

namespace App\Http\Controllers;

use App\Actions\Workspaces\CreateWorkspaceInvitation;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Models\WorkspaceMembership;
use App\Support\Alphabetical;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class WorkspaceMembersController extends Controller
{
    public function index(Request $request, Workspace $workspace): Response
    {
        Gate::authorize('manageMembers', $workspace);

        return Inertia::render('workspaces/members', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'members' => Alphabetical::sort($workspace->members()->orderBy('users.id')->get(), fn (User $member): string => $member->name)->map(fn (User $member): array => [
                ...$member->only(['id', 'name', 'email']),
                'avatarUrl' => $member->avatarUrl(),
                'role' => $this->membershipOf($member)->role->value,
            ]),
            'invitations' => $workspace->invitations()->with('team')->whereNull('accepted_at')->latest()->orderBy('id')->get()
                ->map(fn (WorkspaceInvitation $invitation): array => [
                    'id' => $invitation->id,
                    'email' => $invitation->email,
                    'role' => $invitation->role->value,
                    'team' => $invitation->team?->only(['id', 'name']),
                    'teamRole' => $invitation->team_role?->value,
                    'status' => $invitation->status(),
                    'isExpired' => ! $invitation->isPending(),
                    'invitedAt' => $invitation->created_at->toIso8601String(),
                ]),
            'teams' => $workspace->teamsVisibleTo($request->user())
                ->map(fn (Team $team): array => $team->only(['id', 'name']))
                ->values(),
            'viewerTeams' => Alphabetical::sort(
                $request->user()->teams()->where('teams.workspace_id', $workspace->id)->get(),
                fn (Team $team): string => $team->name,
            )->map(fn (Team $team): string => $team->name)->values(),
            'teamRoles' => array_map(fn (TeamRole $role): string => $role->value, TeamRole::invitable()),
            'invitationValidForDays' => CreateWorkspaceInvitation::ValidForDays,
            'canManage' => true,
            'isOwner' => $request->user()->roleIn($workspace) === WorkspaceRole::Owner,
        ]);
    }

    public function update(Request $request, Workspace $workspace, User $member): RedirectResponse
    {
        Gate::authorize('manageMembers', $workspace);

        $validated = $request->validate([
            'role' => ['required', Rule::enum(WorkspaceRole::class)],
        ]);

        $newRole = WorkspaceRole::from($validated['role']);
        $actor = $request->user();

        DB::transaction(function () use ($workspace, $member, $actor, $newRole): void {
            $this->lockWorkspace($workspace);

            $currentRole = $member->roleIn($workspace);
            $actorIsOwner = $actor->roleIn($workspace) === WorkspaceRole::Owner;

            abort_if($newRole === WorkspaceRole::Owner && ! $actorIsOwner, 403);

            abort_if($currentRole === WorkspaceRole::Owner && ! $actorIsOwner, 403);

            $isDemotingOwner = $currentRole === WorkspaceRole::Owner && $newRole !== WorkspaceRole::Owner;

            if ($isDemotingOwner && $this->isLastOwner($workspace)) {
                throw ValidationException::withMessages(['role' => __('A workspace needs at least one owner.')]);
            }

            $workspace->members()->updateExistingPivot($member->id, ['role' => $newRole->value]);
        });

        return back();
    }

    public function destroy(Request $request, Workspace $workspace, User $member): RedirectResponse
    {
        $actor = $request->user();
        $isLeaving = $actor->is($member);

        if (! $isLeaving) {
            Gate::authorize('manageMembers', $workspace);
        }

        DB::transaction(function () use ($workspace, $member, $actor, $isLeaving): void {
            $this->lockWorkspace($workspace);

            $memberRole = $member->roleIn($workspace);

            abort_if(! $isLeaving && $memberRole === WorkspaceRole::Owner && $actor->roleIn($workspace) !== WorkspaceRole::Owner, 403);

            if ($memberRole === WorkspaceRole::Owner && $this->isLastOwner($workspace)) {
                throw ValidationException::withMessages(['member' => __('A workspace needs at least one owner.')]);
            }

            $this->leaveFacilitatorLists($workspace, $member);
            $member->teams()->detach($workspace->teams()->pluck('id'));
            $workspace->members()->detach($member);

            if ($member->current_workspace_id === $workspace->id) {
                $member->forceFill(['current_workspace_id' => null])->save();
            }
        });

        if ($isLeaving) {
            return to_route('dashboard');
        }

        return back();
    }

    /**
     * A list that changes starts its rotation over, as a role change does.
     */
    private function leaveFacilitatorLists(Workspace $workspace, User $member): void
    {
        $teamIds = $member->defaultFacilitatorOf()->where('teams.workspace_id', $workspace->id)->pluck('teams.id');

        if ($teamIds->isEmpty()) {
            return;
        }

        Team::query()->whereKey($teamIds)->orderBy('id')->lockForUpdate()->get(['id']);

        $member->defaultFacilitatorOf()->detach($teamIds);

        Team::query()->whereKey($teamIds)->update(['rotation_position' => 0]);
    }

    private function lockWorkspace(Workspace $workspace): void
    {
        Workspace::query()->whereKey($workspace->id)->lockForUpdate()->first();
    }

    private function isLastOwner(Workspace $workspace): bool
    {
        return $workspace->owners()->count() === 1;
    }

    private function membershipOf(User $member): WorkspaceMembership
    {
        return $member->getRelation('membership');
    }
}
