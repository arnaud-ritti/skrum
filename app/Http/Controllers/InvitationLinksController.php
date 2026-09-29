<?php

namespace App\Http\Controllers;

use App\Actions\Auth\SignupGate;
use App\Models\WorkspaceInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InvitationLinksController extends Controller
{
    public function show(Request $request, string $token, SignupGate $signupGate): Response|RedirectResponse
    {
        $invitation = WorkspaceInvitation::findByToken($token);

        abort_if($invitation === null, 404);

        $user = $request->user();

        if ($user?->belongsToWorkspace($invitation->workspace)) {
            return to_route('workspaces.show', $invitation->workspace);
        }

        $request->session()->put('invitation_token', $token);

        if ($user === null) {
            redirect()->setIntendedUrl($request->fullUrl());
        }

        return Inertia::render('invitations/show', [
            'token' => $token,
            'workspaceName' => $invitation->workspace->name,
            'email' => $invitation->email,
            'isExpired' => ! $invitation->isPending(),
            'isLoggedIn' => $user !== null,
            'emailMatches' => $user !== null && $invitation->matchesEmail($user->email),
            'canRegister' => $signupGate->canShowRegistration($invitation),
        ]);
    }
}
