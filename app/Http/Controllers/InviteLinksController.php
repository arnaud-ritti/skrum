<?php

namespace App\Http\Controllers;

use App\Actions\Auth\SignupGate;
use App\Enums\SsoProvider;
use App\Models\TeamInviteLink;
use App\Models\User;
use App\Support\Alphabetical;
use App\Support\Auth\SignInPolicy;
use App\Support\Invitations\InviteLinkSession;
use App\Support\Teams\TeamMark;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Fortify\Features;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class InviteLinksController extends Controller
{
    public function show(Request $request, string $token, SignupGate $signupGate, SignInPolicy $signInPolicy): Response|RedirectResponse|SymfonyResponse
    {
        $link = TeamInviteLink::findByToken($token);

        if ($link === null) {
            return Inertia::render('invite-links/show', ['isInvalid' => true])
                ->toResponse($request)
                ->setStatusCode(404);
        }

        $user = $request->user();
        $team = $link->team;

        if ($user !== null && $team->hasMember($user)) {
            $request->session()->forget(InviteLinkSession::Key);

            return to_route('teams.show', [$team->workspace, $team]);
        }

        if ($user === null) {
            redirect()->setIntendedUrl($request->fullUrl());
        }

        $request->session()->put(InviteLinkSession::Key, $token);

        $canRegister = Features::enabled(Features::registration())
            && $signInPolicy->allowsLocalCredentials()
            && $signupGate->canShowRegistration(null, $link);

        if (! $link->isUsable()) {
            return Inertia::render('invite-links/show', [
                'isInvalid' => false,
                'isUsable' => false,
                'teamName' => $team->name,
                'workspaceName' => $team->workspace->name,
                'inviter' => $this->person($link->createdBy),
            ]);
        }

        $members = $team->members();

        return Inertia::render('invite-links/show', [
            'isInvalid' => false,
            'isUsable' => true,
            'token' => $token,
            'teamName' => $team->name,
            'team' => [
                'name' => $team->name,
                'initial' => mb_strtoupper(mb_substr(trim($team->name), 0, 1)),
                'color' => TeamMark::colorFor($team)->value,
            ],
            'workspaceName' => $team->workspace->name,
            'inviter' => $this->person($link->createdBy),
            'teamRole' => $link->team_role->value,
            'membersCount' => $members->count(),
            'members' => Alphabetical::sort($team->members()->orderBy('users.name')->orderBy('users.id')->limit(5)->get(), fn (User $member): string => $member->name)
                ->map(fn (User $member): array => $this->person($member))
                ->all(),
            'isLoggedIn' => $user !== null,
            'isVerified' => $user?->hasVerifiedEmail() ?? false,
            'canRegister' => $user === null && $canRegister,
            'ssoRequired' => $signInPolicy->ssoRequired(),
            'ssoProviders' => $user === null ? SsoProvider::options() : [],
        ]);
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
