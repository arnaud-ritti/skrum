<?php

namespace App\Http\Controllers;

use App\Actions\Teams\IssueTeamInviteLink;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TeamInviteLinksController extends Controller
{
    public function store(Request $request, Workspace $workspace, Team $team, IssueTeamInviteLink $issueTeamInviteLink): RedirectResponse
    {
        Gate::authorize('invite', $team);

        $issueTeamInviteLink->handle($team, $request->user());

        return back();
    }

    public function destroy(Workspace $workspace, Team $team): RedirectResponse
    {
        Gate::authorize('invite', $team);

        $team->inviteLinks()->whereNull('revoked_at')->update(['revoked_at' => now()]);

        return back();
    }
}
