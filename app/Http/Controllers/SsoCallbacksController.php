<?php

namespace App\Http\Controllers;

use App\Actions\Auth\ResolveSsoUser;
use App\Enums\SsoProvider;
use App\Exceptions\SsoLoginRefused;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;
use Throwable;

class SsoCallbacksController extends Controller
{
    public function show(Request $request, SsoProvider $provider, ResolveSsoUser $resolveSsoUser): RedirectResponse
    {
        abort_unless($provider->isEnabled(), 404);

        try {
            $ssoUser = Socialite::driver($provider->driver())->user();
        } catch (Throwable $exception) {
            report($exception);

            return $this->backToLogin(__('Sign-in with :provider failed. Please try again.', ['provider' => $provider->label()]));
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

        if ($this->hasConfirmedTwoFactor($user)) {
            $request->session()->put([
                'login.id' => $user->getKey(),
                'login.remember' => false,
            ]);

            return to_route('two-factor.login');
        }

        Auth::login($user);

        $request->session()->regenerate();

        return redirect()->intended(route('dashboard'));
    }

    private function hasConfirmedTwoFactor(User $user): bool
    {
        if ($user->two_factor_secret === null) {
            return false;
        }

        return $user->two_factor_confirmed_at !== null;
    }

    private function backToLogin(string $message): RedirectResponse
    {
        return to_route('login')->withErrors(['email' => $message]);
    }
}
