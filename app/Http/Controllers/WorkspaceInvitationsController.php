<?php

namespace App\Http\Controllers;

use App\Actions\Notifications\ForgetInvitationNotifications;
use App\Actions\Workspaces\CreateWorkspaceInvitation;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Notifications\WorkspaceInvitationNotification;
use App\Notifications\WorkspaceInvitationReceivedNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use SensitiveParameter;

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
            ->whereAddress($validated['email'])
            ->exists();

        if ($isAlreadyMember) {
            throw ValidationException::withMessages(['email' => __('This person is already a member of the workspace.')]);
        }

        $inviter = $request->user();
        $issued = $createInvitation->handle($workspace, $inviter, $validated['email'], WorkspaceRole::from($validated['role']));
        $url = route('invitations.show', $issued->token);

        $recipientLocale = User::query()
            ->whereAddress($validated['email'])
            ->value('locale');

        Notification::route('mail', $validated['email'])->notify(
            (new WorkspaceInvitationNotification($workspace->name, $inviter->name, $url, $issued->invitation->expires_at, $issued->invitation->id))
                ->locale($recipientLocale ?? app()->getLocale()),
        );

        $this->notifyExistingAccount($validated['email'], $issued->invitation, $issued->token);

        if (config('mail.default') === 'log') {
            Inertia::flash('invitationUrl', $url);
        }

        return back();
    }

    /**
     * The bell of the one verified account that owns the invited address
     * is told of the invitation. The inviter's answer is the same whether
     * or not such an account exists.
     */
    private function notifyExistingAccount(string $email, WorkspaceInvitation $invitation, #[SensitiveParameter] string $token): void
    {
        $accounts = User::query()
            ->whereAddress($email)
            ->whereNotNull('email_verified_at')
            ->limit(2)
            ->get();

        if ($accounts->count() !== 1) {
            return;
        }

        $accounts->sole()->notify(new WorkspaceInvitationReceivedNotification($invitation->id, $token));
    }

    public function destroy(Workspace $workspace, WorkspaceInvitation $invitation, ForgetInvitationNotifications $forgetNotifications): RedirectResponse
    {
        Gate::authorize('manageMembers', $workspace);

        $invitation->delete();
        $forgetNotifications->handle([$invitation->id]);

        return back();
    }
}
