<?php

namespace App\Actions\Auth;

use App\Enums\SignInEntry;
use App\Models\User;
use App\Support\Auth\SecondFactors;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * The end of every sign-in that does not go through Fortify's pipeline.
 * The destination is the intended URL kept by the server, never request input. A deactivated
 * account is refused here, before a second-factor challenge mails it a code.
 */
class CompleteLogin
{
    public function __construct(
        private SecondFactors $secondFactors,
        private StartSecondFactorChallenge $startChallenge,
    ) {}

    public function handle(Request $request, User $user, SignInEntry $entry): RedirectResponse
    {
        if ($user->isDeactivated()) {
            return to_route('login')->withErrors(['email' => __('This account is deactivated. Ask an admin of the instance.')]);
        }

        if ($this->secondFactors->requiredFor($user)) {
            $this->startChallenge->handle($request, $user, remember: false, entry: $entry);

            return to_route('two-factor.login');
        }

        Auth::login($user);

        $request->session()->regenerate();

        return redirect()->intended(route('dashboard'));
    }
}
