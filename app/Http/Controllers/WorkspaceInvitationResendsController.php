<?php

namespace App\Http\Controllers;

use App\Actions\Workspaces\InvitationTerms;
use App\Actions\Workspaces\SendInvitation;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class WorkspaceInvitationResendsController extends Controller
{
    public function store(Request $request, Workspace $workspace, WorkspaceInvitation $invitation, SendInvitation $sendInvitation): RedirectResponse
    {
        Gate::authorize('manage', $invitation);

        abort_if($invitation->accepted_at !== null, 410);

        $this->ensureNotAlreadyIn($workspace, $invitation);

        $issued = $sendInvitation->handle($workspace, $request->user(), new InvitationTerms(
            $invitation->email,
            $invitation->role,
            $invitation->team,
            $invitation->team_role,
            $invitation->message,
        ));

        if (config('mail.default') === 'log') {
            Inertia::flash('invitationUrl', $issued->url());
        }

        return back();
    }

    private function ensureNotAlreadyIn(Workspace $workspace, WorkspaceInvitation $invitation): void
    {
        $team = $invitation->team;

        $isAlreadyIn = $team === null
            ? $workspace->members()->whereAddress($invitation->email)->exists()
            : $team->members()->whereAddress($invitation->email)->exists();

        if (! $isAlreadyIn) {
            return;
        }

        throw ValidationException::withMessages(['email' => $team === null
            ? __('This person is already a member of the workspace.')
            : __('This person is already in :team.', ['team' => $team->name])]);
    }
}
