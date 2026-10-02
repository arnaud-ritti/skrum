<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Support\Auth\SecondFactors;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * The end of every sign-in that does not go through Fortify's pipeline.
 * The destination is the intended URL kept by the server, never request input.
 */
class CompleteLogin
{
    public function __construct(
        private SecondFactors $secondFactors,
        private StartSecondFactorChallenge $startChallenge,
    ) {}

    public function handle(Request $request, User $user): RedirectResponse
    {
        if ($this->secondFactors->requiredFor($user)) {
            $this->startChallenge->handle($request, $user, remember: false, local: false);

            return to_route('two-factor.login');
        }

        Auth::login($user);

        $request->session()->regenerate();

        return redirect()->intended(route('dashboard'));
    }
}
