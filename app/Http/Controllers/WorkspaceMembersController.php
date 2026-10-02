<?php

namespace App\Http\Controllers;

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Models\WorkspaceMembership;
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
            'members' => $workspace->members()->orderBy('name')->get()->map(fn (User $member): array => [
                ...$member->only(['id', 'name', 'email']),
                'avatarUrl' => $member->avatarUrl(),
                'role' => $this->membershipOf($member)->role->value,
            ]),
            'invitations' => $workspace->invitations()->whereNull('accepted_at')->latest()->get()
                ->map(fn (WorkspaceInvitation $invitation): array => [
                    'id' => $invitation->id,
                    'email' => $invitation->email,
                    'role' => $invitation->role->value,
                    'isExpired' => ! $invitation->isPending(),
                    'invitedAt' => $invitation->created_at->toIso8601String(),
                ]),
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
        $currentRole = $member->roleIn($workspace);
        $actorIsOwner = $request->user()->roleIn($workspace) === WorkspaceRole::Owner;

        abort_if($newRole === WorkspaceRole::Owner && ! $actorIsOwner, 403);

        abort_if($currentRole === WorkspaceRole::Owner && ! $actorIsOwner, 403);

        DB::transaction(function () use ($workspace, $member, $newRole, $currentRole): void {
            $this->lockWorkspace($workspace);

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
        $memberRole = $member->roleIn($workspace);

        if (! $isLeaving) {
            Gate::authorize('manageMembers', $workspace);
        }

        abort_if(! $isLeaving && $memberRole === WorkspaceRole::Owner && $actor->roleIn($workspace) !== WorkspaceRole::Owner, 403);

        DB::transaction(function () use ($workspace, $member, $memberRole): void {
            $this->lockWorkspace($workspace);

            if ($memberRole === WorkspaceRole::Owner && $this->isLastOwner($workspace)) {
                throw ValidationException::withMessages(['member' => __('A workspace needs at least one owner.')]);
            }

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
