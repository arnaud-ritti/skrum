<?php

namespace App\Http\Controllers;

use App\Actions\Auth\CompleteLogin;
use App\Actions\Auth\LinkSocialAccount;
use App\Actions\Auth\ResolveSsoUser;
use App\Actions\Workspaces\InvitationLanding;
use App\Enums\SignInEntry;
use App\Enums\SsoProvider;
use App\Exceptions\InvitationUnavailable;
use App\Exceptions\SocialAccountRefused;
use App\Exceptions\SsoLoginRefused;
use App\Http\Controllers\Concerns\FlashesLiveSession;
use App\Models\TeamInviteLink;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Support\Auth\SsoIntent;
use App\Support\Invitations\InviteLinkSession;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Laravel\Socialite\AbstractUser;
use Throwable;

class SsoCallbacksController extends Controller
{
    use FlashesLiveSession;

    public function show(Request $request, SsoProvider $provider, ResolveSsoUser $resolveSsoUser, CompleteLogin $completeLogin, LinkSocialAccount $linkSocialAccount, InvitationLanding $landing): RedirectResponse
    {
        abort_unless($provider->isEnabled(), 404);

        $signedInUser = $request->user();

        if ($signedInUser instanceof User) {
            return $this->forSignedInUser($request, $signedInUser, $provider, $linkSocialAccount);
        }

        $request->session()->forget(SsoIntent::Key);

        try {
            $ssoUser = $provider->socialiteDriver()->user();
        } catch (Throwable $exception) {
            report($exception);

            return $this->backToLogin(SsoLoginRefused::providerFailed($provider)->getMessage());
        }

        if (! $ssoUser instanceof AbstractUser) {
            return $this->backToLogin(SsoLoginRefused::providerFailed($provider)->getMessage());
        }

        $invitation = WorkspaceInvitation::findByToken($request->session()->get('invitation_token'));
        $link = TeamInviteLink::findByToken($request->session()->get(InviteLinkSession::Key));

        try {
            $user = $resolveSsoUser->handle($provider, $ssoUser, $invitation, $link);
        } catch (SsoLoginRefused $exception) {
            return $this->backToLogin($exception->getMessage());
        } catch (InvitationUnavailable) {
            return $this->backToLogin(__('This invitation link is no longer valid.'));
        }

        $acceptedInvitation = $invitation?->fresh();

        if ($acceptedInvitation?->accepted_at !== null) {
            $request->session()->forget(['invitation_token', 'url.intended']);
        }

        if ($acceptedInvitation?->accepted_at !== null && $acceptedInvitation->team_id !== null) {
            redirect()->setIntendedUrl($landing->url($acceptedInvitation, $user));

            $this->flashLiveSession($acceptedInvitation->team, $user);
        }

        return $completeLogin->handle($request, $user, SignInEntry::Sso);
    }

    private function forSignedInUser(Request $request, User $user, SsoProvider $provider, LinkSocialAccount $linkSocialAccount): RedirectResponse
    {
        $intent = SsoIntent::pull($request);

        if ($intent === null) {
            return to_route('dashboard');
        }

        if ($intent['type'] !== SsoIntent::Link || $intent['user'] !== $user->id || $intent['provider'] !== $provider->value) {
            return to_route('dashboard');
        }

        try {
            $ssoUser = $provider->socialiteDriver()->user();
        } catch (Throwable $exception) {
            report($exception);

            return $this->backToSecurity(SsoLoginRefused::providerFailed($provider)->getMessage());
        }

        $providerUserId = $ssoUser instanceof AbstractUser ? (string) $ssoUser->getId() : '';

        try {
            $linkSocialAccount->handle($user, $provider, $providerUserId);
        } catch (SocialAccountRefused $exception) {
            return $this->backToSecurity($exception->getMessage());
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __(':provider is linked.', ['provider' => $provider->label()])]);

        return redirect(route('settings.edit').'#security');
    }

    private function backToSecurity(string $message): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'error', 'message' => $message]);

        return redirect(route('settings.edit').'#security');
    }

    private function backToLogin(string $message): RedirectResponse
    {
        return to_route('login')->withErrors(['email' => $message]);
    }
}
