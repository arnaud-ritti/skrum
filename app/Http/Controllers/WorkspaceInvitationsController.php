<?php

namespace App\Http\Controllers;

use App\Actions\Notifications\ForgetInvitationNotifications;
use App\Actions\Workspaces\InvitationTerms;
use App\Actions\Workspaces\SendInvitation;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class WorkspaceInvitationsController extends Controller
{
    public function store(Request $request, Workspace $workspace, SendInvitation $sendInvitation): RedirectResponse
    {
        Gate::authorize('manageMembers', $workspace);

        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'role' => ['required', Rule::in([WorkspaceRole::Admin->value, WorkspaceRole::Member->value])],
            'team_id' => ['nullable', 'uuid', Rule::exists('teams', 'id')->where('workspace_id', $workspace->id)],
            'team_role' => ['nullable', 'required_with:team_id', Rule::in(array_map(fn (TeamRole $role): string => $role->value, TeamRole::invitable()))],
            'message' => ['nullable', 'string', 'max:500'],
        ]);

        $team = $request->filled('team_id')
            ? $workspace->teams()->findOrFail($request->string('team_id')->value())
            : null;

        $this->ensureNotAlreadyIn($workspace, $team, $validated['email']);

        $issued = $sendInvitation->handle($workspace, $request->user(), new InvitationTerms(
            $validated['email'],
            WorkspaceRole::from($validated['role']),
            $team,
            $team === null ? null : TeamRole::from($validated['team_role']),
            $validated['message'] ?? null,
        ));

        if (config('mail.default') === 'log') {
            Inertia::flash('invitationUrl', $issued->url());
        }

        return back();
    }

    private function ensureNotAlreadyIn(Workspace $workspace, ?Team $team, string $email): void
    {
        $isAlreadyIn = $team === null
            ? $workspace->members()->whereAddress($email)->exists()
            : $team->members()->whereAddress($email)->exists();

        if (! $isAlreadyIn) {
            return;
        }

        throw ValidationException::withMessages(['email' => $team === null
            ? __('This person is already a member of the workspace.')
            : __('This person is already in :team.', ['team' => $team->name])]);
    }

    public function destroy(Workspace $workspace, WorkspaceInvitation $invitation, ForgetInvitationNotifications $forgetNotifications): RedirectResponse
    {
        Gate::authorize('manageMembers', $workspace);

        $invitation->delete();
        $forgetNotifications->handle([$invitation->id]);

        return back();
    }
}
