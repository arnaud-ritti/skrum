<?php

namespace App\Http\Controllers;

use App\Actions\Auth\SignupGate;
use App\Enums\SsoProvider;
use App\Models\User;
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

        if (! $invitation->isPending()) {
            return Inertia::render('invitations/show', [
                'isInvalid' => false,
                'isExpired' => true,
                'workspaceName' => $invitation->workspace->name,
                'inviter' => $this->person($invitation->invitedBy),
                'expiresAt' => $invitation->expires_at->toIso8601String(),
            ]);
        }

        return Inertia::render('invitations/show', [
            'token' => $token,
            'isInvalid' => false,
            'workspaceName' => $invitation->workspace->name,
            'email' => $invitation->email,
            'isExpired' => false,
            'isLoggedIn' => $user !== null,
            'emailMatches' => $user !== null && $invitation->matchesEmail($user->email),
            'canRegister' => $signInPolicy->allowsLocalCredentials() && $signupGate->canShowRegistration($invitation),
            'ssoRequired' => $signInPolicy->ssoRequired(),
            'ssoProviders' => $user === null ? SsoProvider::options() : [],
            'inviter' => $this->person($invitation->invitedBy),
            'expiresAt' => $invitation->expires_at->toIso8601String(),
            ...$this->pendingDetails($invitation),
        ]);
    }

    /**
     * @return array{
     *     role: string,
     *     membersCount: int,
     *     members: array<int, array{name: string, avatarUrl: string}>
     * }
     */
    private function pendingDetails(WorkspaceInvitation $invitation): array
    {
        $members = $invitation->workspace->members();

        return [
            'role' => $invitation->role->value,
            'membersCount' => $members->count(),
            'members' => $members
                ->orderBy('users.name')
                ->limit(5)
                ->get()
                ->map(fn (User $member): array => $this->person($member))
                ->all(),
        ];
    }

    /**
     * @return array{name: string, avatarUrl: string}|null
     */
    private function person(?User $user): ?array
    {
        if ($user === null) {
            return null;
        }

        return [
            'name' => $user->name,
            'avatarUrl' => $user->avatarUrl(),
        ];
    }
}
