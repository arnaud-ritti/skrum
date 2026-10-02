<?php

namespace App\Listeners;

use Laravel\Fortify\Events\ValidTwoFactorAuthenticationCodeProvided;

class ForgetSecondFactorChallengeListener
{
    /**
     * Fortify's own challenge clears the user and the "remember" choice,
     * and knows nothing of what StartSecondFactorChallenge added.
     */
    public function handle(ValidTwoFactorAuthenticationCodeProvided $event): void
    {
        if (! request()->hasSession()) {
            return;
        }

        request()->session()->forget('login.entry');
    }
}
