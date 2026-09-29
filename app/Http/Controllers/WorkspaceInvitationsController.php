<?php

namespace App\Http\Controllers;

use App\Actions\Workspaces\CreateWorkspaceInvitation;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Notifications\WorkspaceInvitationNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class WorkspaceInvitationsController extends Controller
{
    public function store(Request $request, Workspace $workspace, CreateWorkspaceInvitation $createInvitation): RedirectResponse
    {
        Gate::authorize('manageMembers', $workspace);

        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'role' => ['required', Rule::in([WorkspaceRole::Admin->value, WorkspaceRole::Member->value])],
        ]);

        $isAlreadyMember = $workspace->members()
            ->whereRaw('lower(users.email) = ?', [Str::lower($validated['email'])])
            ->exists();

        if ($isAlreadyMember) {
            throw ValidationException::withMessages(['email' => __('This person is already a member of the workspace.')]);
        }

        $inviter = $request->user();
        $issued = $createInvitation->handle($workspace, $inviter, $validated['email'], WorkspaceRole::from($validated['role']));
        $url = route('invitations.show', $issued->token);

        $recipientLocale = User::query()
            ->whereRaw('lower(email) = ?', [Str::lower($validated['email'])])
            ->value('locale');

        Notification::route('mail', $validated['email'])->notify(
            (new WorkspaceInvitationNotification($workspace->name, $inviter->name, $url, $issued->invitation->expires_at))
                ->locale($recipientLocale ?? app()->getLocale()),
        );

        if (config('mail.default') === 'log') {
            Inertia::flash('invitationUrl', $url);
        }

        return back();
    }

    public function destroy(Workspace $workspace, WorkspaceInvitation $invitation): RedirectResponse
    {
        Gate::authorize('manageMembers', $workspace);

        $invitation->delete();

        return back();
    }
}
