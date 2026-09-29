<?php

namespace App\Http\Controllers;

use App\Actions\Workspaces\AcceptWorkspaceInvitation;
use App\Models\WorkspaceInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class InvitationAcceptancesController extends Controller
{
    public function store(Request $request, string $token, AcceptWorkspaceInvitation $acceptInvitation): RedirectResponse
    {
        $invitation = WorkspaceInvitation::findByToken($token);

        abort_if($invitation === null, 404);
        abort_unless($invitation->isPending(), 410);
        abort_unless($invitation->matchesEmail($request->user()->email), 403);

        $acceptInvitation->handle($invitation, $request->user());

        $request->session()->forget('invitation_token');

        return to_route('workspaces.show', $invitation->workspace);
    }
}
