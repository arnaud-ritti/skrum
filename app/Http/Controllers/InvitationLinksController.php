<?php

namespace App\Http\Controllers;

use App\Actions\Auth\SignupGate;
use App\Enums\SsoProvider;
use App\Models\WorkspaceInvitation;
use App\Support\Auth\SignInPolicy;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class InvitationLinksController extends Controller
{
    public function show(Request $request, string $token, SignupGate $signupGate, SignInPolicy $signInPolicy): Response|SymfonyResponse
    {
        $invitation = WorkspaceInvitation::findByToken($token);

        if ($invitation === null) {
            return Inertia::render('invitations/show', ['isInvalid' => true])
                ->toResponse($request)
                ->setStatusCode(404);
        }

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
            'isInvalid' => false,
            'workspaceName' => $invitation->workspace->name,
            'email' => $invitation->email,
            'isExpired' => ! $invitation->isPending(),
            'isLoggedIn' => $user !== null,
            'emailMatches' => $user !== null && $invitation->matchesEmail($user->email),
            'canRegister' => $signInPolicy->allowsLocalCredentials() && $signupGate->canShowRegistration($invitation),
            'ssoRequired' => $signInPolicy->ssoRequired(),
            'ssoProviders' => $user === null && $invitation->isPending() ? SsoProvider::options() : [],
        ]);
    }
}
