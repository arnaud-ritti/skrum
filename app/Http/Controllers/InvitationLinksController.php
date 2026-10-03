<?php

namespace App\Http\Controllers;

use App\Actions\Auth\SignupGate;
use App\Enums\SsoProvider;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Support\Alphabetical;
use App\Support\Auth\SignInPolicy;
use App\Support\Teams\TeamMark;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Fortify\Features;
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

        $team = $invitation->team;

        if ($team === null && $user?->belongsToWorkspace($invitation->workspace)) {
            return to_route('workspaces.show', $invitation->workspace);
        }

        if ($team !== null && $user !== null && $team->hasMember($user)) {
            return to_route('teams.show', [$invitation->workspace, $team]);
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
                'inviter' => $invitation->invitedBy === null ? null : ['name' => $invitation->invitedBy->name],
                'isDeclined' => $invitation->isDeclined(),
            ]);
        }

        $canRegister = Features::enabled(Features::registration())
            && $signInPolicy->allowsLocalCredentials()
            && $signupGate->canShowRegistration($invitation);

        return Inertia::render('invitations/show', [
            'token' => $token,
            'isInvalid' => false,
            'workspaceName' => $invitation->workspace->name,
            'email' => $invitation->email,
            'isExpired' => false,
            'isLoggedIn' => $user !== null,
            'emailMatches' => $user !== null && $invitation->matchesEmail($user->email),
            'canRegister' => $canRegister,
            'passwordRules' => $user === null && $canRegister ? Password::defaults()->toPasswordRulesString() : null,
            'ssoRequired' => $signInPolicy->ssoRequired(),
            'ssoProviders' => $user === null ? SsoProvider::options() : [],
            'inviter' => $this->person($invitation->invitedBy),
            'expiresAt' => $invitation->expires_at->toIso8601String(),
            'team' => $team === null ? null : [
                'name' => $team->name,
                'initial' => mb_strtoupper(mb_substr(trim($team->name), 0, 1)),
                'color' => TeamMark::colorFor($team)->value,
            ],
            'teamRole' => $invitation->team_role?->value,
            'message' => $invitation->message,
            'isDeclined' => false,
            'declineUrl' => route('invitations.decline.store', $token),
            ...$this->pendingDetails($invitation),
        ]);
    }

    /**
     * The members of the team for a team invitation, of the workspace otherwise.
     *
     * @return array{
     *     role: string,
     *     membersCount: int,
     *     members: array<int, array{name: string, avatarUrl: string}>
     * }
     */
    private function pendingDetails(WorkspaceInvitation $invitation): array
    {
        $members = $invitation->team === null ? $invitation->workspace->members() : $invitation->team->members();

        return [
            'role' => $invitation->role->value,
            'membersCount' => $members->count(),
            'members' => Alphabetical::sort($members->orderBy('users.name')->orderBy('users.id')->limit(5)->get(), fn (User $member): string => $member->name)
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
