<?php

namespace App\Support\Auth;

use Illuminate\Validation\Rules\Password;

class PasswordRule
{
    /**
     * Outside production the framework's default applies. The breach check
     * calls an outside service: an instance without outbound access turns
     * it off rather than waiting on every password change.
     */
    public static function defaults(bool $production, bool $breachCheck): ?Password
    {
        if (! $production) {
            return null;
        }

        $rule = Password::min(12)->mixedCase()->letters()->numbers()->symbols();

        if (! $breachCheck) {
            return $rule;
        }

        return $rule->uncompromised();
    }
}
