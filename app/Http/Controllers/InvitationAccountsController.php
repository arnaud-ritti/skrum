<?php

namespace App\Http\Controllers;

use App\Actions\Fortify\CreateNewUser;
use App\Actions\Workspaces\InvitationLanding;
use App\Http\Requests\Auth\InvitationAccountRequest;
use App\Models\WorkspaceInvitation;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Laravel\Fortify\Features;

class InvitationAccountsController extends Controller
{
    /**
     * Creates the account of the invited address from the invitation card,
     * signs it in and joins the workspace, and the team of a team invitation (S35).
     */
    public function store(InvitationAccountRequest $request, string $token, CreateNewUser $createNewUser, InvitationLanding $landing): RedirectResponse
    {
        $invitation = WorkspaceInvitation::findByToken($token);

        abort_if($invitation === null, 404);
        abort_unless($invitation->isPending(), 410);
        abort_unless(Features::enabled(Features::registration()), 403);

        $user = $createNewUser->createForInvitation($invitation, $request->validated());

        event(new Registered($user));

        Auth::login($user);

        $request->session()->regenerate();

        return redirect($landing->url($invitation, $user));
    }
}
