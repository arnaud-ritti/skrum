<?php

namespace App\Http\Controllers;

use App\Actions\Auth\CompleteLogin;
use App\Actions\Auth\ResolveSsoUser;
use App\Enums\SignInEntry;
use App\Enums\SsoProvider;
use App\Exceptions\SsoLoginRefused;
use App\Models\WorkspaceInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Laravel\Socialite\AbstractUser;
use Throwable;

class SsoCallbacksController extends Controller
{
    public function show(Request $request, SsoProvider $provider, ResolveSsoUser $resolveSsoUser, CompleteLogin $completeLogin): RedirectResponse
    {
        abort_unless($provider->isEnabled(), 404);

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

        try {
            $user = $resolveSsoUser->handle($provider, $ssoUser, $invitation);
        } catch (SsoLoginRefused $exception) {
            return $this->backToLogin($exception->getMessage());
        }

        if ($invitation !== null && $invitation->fresh()?->accepted_at !== null) {
            $request->session()->forget(['invitation_token', 'url.intended']);
        }

        return $completeLogin->handle($request, $user, SignInEntry::Sso);
    }

    private function backToLogin(string $message): RedirectResponse
    {
        return to_route('login')->withErrors(['email' => $message]);
    }
}
