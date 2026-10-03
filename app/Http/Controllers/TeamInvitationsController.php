<?php

namespace App\Http\Controllers;

use App\Actions\Workspaces\IssuedInvitation;
use App\Actions\Workspaces\SendTeamInvitations;
use App\Http\Requests\Invitations\TeamInvitationRequest;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class TeamInvitationsController extends Controller
{
    public function store(TeamInvitationRequest $request, Workspace $workspace, Team $team, SendTeamInvitations $sendInvitations): RedirectResponse
    {
        $issued = $sendInvitations->handle($team, $request->user(), $request->emails(), $request->teamRole(), $request->message());

        if (config('mail.default') === 'log') {
            Inertia::flash('invitationUrls', array_map(fn (IssuedInvitation $invitation): string => $invitation->url(), $issued));
        }

        Inertia::flash('invitationsSent', count($issued));

        return back();
    }
}
