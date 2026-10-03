<?php

namespace App\Http\Controllers;

use App\Actions\Workspaces\DeclineWorkspaceInvitation;
use App\Exceptions\InvitationUnavailable;
use App\Models\WorkspaceInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class InvitationDeclinesController extends Controller
{
    public function store(Request $request, string $token, DeclineWorkspaceInvitation $decline): RedirectResponse
    {
        $invitation = WorkspaceInvitation::findByToken($token);

        abort_if($invitation === null, 404);

        try {
            $decline->handle($invitation);
        } catch (InvitationUnavailable) {
            abort(410);
        }

        $request->session()->forget('invitation_token');

        return to_route('invitations.show', $token);
    }
}
