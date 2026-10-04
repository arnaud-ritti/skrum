<?php

namespace App\Actions\Auth;

use App\Enums\SignInEntry;
use App\Models\User;
use App\Support\Auth\SecondFactors;
use App\Support\Auth\SignInPolicy;
use Laravel\Fortify\Actions\RedirectIfTwoFactorAuthenticatable;
use Laravel\Fortify\Events\TwoFactorAuthenticationChallenged;

class RedirectIfSecondFactorRequired extends RedirectIfTwoFactorAuthenticatable
{
    public function handle($request, $next)
    {
        $user = $this->validateCredentials($request);

        if (! $user instanceof User) {
            return $next($request);
        }

        if (! resolve(SignInPolicy::class)->allowsPassword($user)) {
            $this->fireFailedEvent($request, $user);
            $this->throwFailedAuthenticationException($request);
        }

        if (! resolve(SecondFactors::class)->requiredFor($user)) {
            return $next($request);
        }

        return $this->twoFactorChallengeResponse($request, $user);
    }

    protected function twoFactorChallengeResponse($request, $user)
    {
        resolve(StartSecondFactorChallenge::class)->handle($request, $user, $request->boolean('remember'), SignInEntry::Password);

        event(new TwoFactorAuthenticationChallenged($user));

        return $request->wantsJson()
            ? response()->json(['two_factor' => true])
            : to_route('two-factor.login');
    }
}
