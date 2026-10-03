<?php

namespace App\Support\Auth;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;

/**
 * Whether the session holds a password confirmation the `password.confirm`
 * middleware would still accept: same session key, same timeout.
 */
class PasswordConfirmation
{
    public function isFresh(Request $request): bool
    {
        $confirmedAt = (int) $request->session()->get('auth.password_confirmed_at', 0);

        return Date::now()->unix() - $confirmedAt <= (int) config('auth.password_timeout', 10800);
    }
}
