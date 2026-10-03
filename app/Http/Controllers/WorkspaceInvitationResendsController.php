<?php

namespace App\Http\Controllers;

use App\Actions\Workspaces\InvitationTerms;
use App\Actions\Workspaces\SendInvitation;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class WorkspaceInvitationResendsController extends Controller
{
    public function store(Request $request, Workspace $workspace, WorkspaceInvitation $invitation, SendInvitation $sendInvitation): RedirectResponse
    {
        Gate::authorize('manage', $invitation);

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
}
