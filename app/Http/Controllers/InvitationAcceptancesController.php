<?php

namespace App\Http\Controllers;

use App\Actions\Workspaces\AcceptWorkspaceInvitation;
use App\Actions\Workspaces\InvitationLanding;
use App\Exceptions\InvitationUnavailable;
use App\Models\WorkspaceInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class InvitationAcceptancesController extends Controller
{
    public function store(Request $request, string $token, AcceptWorkspaceInvitation $acceptInvitation, InvitationLanding $landing): RedirectResponse
    {
        $invitation = WorkspaceInvitation::findByToken($token);

        abort_if($invitation === null, 404);
        abort_unless($invitation->isPending(), 410);
        abort_unless($invitation->matchesEmail($request->user()->email), 403);

        if ($request->user()->email_verified_at === null) {
            $request->user()->forceFill(['email_verified_at' => now()])->save();
        }

        try {
            $acceptInvitation->handle($invitation, $request->user());
        } catch (InvitationUnavailable) {
            abort(410);
        }

        $request->session()->forget('invitation_token');

        return redirect($landing->url($invitation, $request->user()));
    }
}
