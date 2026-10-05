<?php

namespace App\Http\Controllers;

use App\Actions\Teams\JoinTeamByLink;
use App\Exceptions\InvitationUnavailable;
use App\Models\TeamInviteLink;
use App\Support\Invitations\InviteLinkSession;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class InviteLinkMembershipsController extends Controller
{
    public function store(Request $request, string $token, JoinTeamByLink $join): RedirectResponse
    {
        $link = TeamInviteLink::findByToken($token);

        abort_if($link === null, 404);

        try {
            $team = $join->handle($link, $request->user());
        } catch (InvitationUnavailable) {
            abort(410);
        }

        $request->session()->forget(InviteLinkSession::Key);

        return to_route('teams.show', [$team->workspace, $team]);
    }
}
