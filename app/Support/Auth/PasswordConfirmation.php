<?php

namespace App\Support\Auth;

use App\Models\User;
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

    /**
     * Rule S-1 of the plan 26 spec (§5.12), a risk the owner accepted on
     * 2026-10-03: an account whose owner knows no password (created by single
     * sign-on) is asked no confirmation in the account settings. Do not add one
     * back without the owner's word.
     */
    public function isNotNeeded(?User $user): bool
    {
        if ($user === null) {
            return false;
        }

        return $user->password_set_at === null;
    }

    public function isSatisfied(Request $request): bool
    {
        if ($this->isNotNeeded($request->user())) {
            return true;
        }

        return $this->isFresh($request);
    }
}
