<?php

namespace App\Support\Auth;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;

/**
 * Whether the session holds a password confirmation the `password.confirm`
 * middleware would still accept: same session key, same timeout unless a shorter window is asked for.
 */
class PasswordConfirmation
{
    public function isFresh(Request $request, ?int $seconds = null): bool
    {
        $confirmedAt = (int) $request->session()->get('auth.password_confirmed_at', 0);

        return Date::now()->unix() - $confirmedAt <= ($seconds ?? (int) config('auth.password_timeout', 10800));
    }

    /** When a confirmation window of these seconds runs out, as an ISO time; null once it has. */
    public function freshUntil(Request $request, int $seconds): ?string
    {
        if (! $this->isFresh($request, $seconds)) {
            return null;
        }

        $confirmedAt = (int) $request->session()->get('auth.password_confirmed_at', 0);

        return Date::createFromTimestamp($confirmedAt + $seconds)->toIso8601String();
    }
}
