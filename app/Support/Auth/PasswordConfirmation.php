<?php

namespace App\Support\Auth;

use App\Models\User;
use App\Support\Integrations\IntegrationAvailability;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;

/**
 * Whether the session holds a password confirmation the `password.confirm`
 * middleware would still accept: same session key, same timeout unless a shorter window is asked for.
 */
class PasswordConfirmation
{
    public function __construct(private IntegrationAvailability $availability) {}

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

    /**
     * How the account confirms it is its owner: its password, or, for an
     * account whose owner knows none (created by single sign-on), a code
     * sent to its address. Null when no code can reach it either: rule S-1,
     * the risk the owner accepted on 2026-10-03,
     * then asks no confirmation in the account settings.
     */
    public function method(?User $user): ?string
    {
        if ($user === null) {
            return null;
        }

        if ($user->password_set_at !== null) {
            return 'password';
        }

        if (! $this->availability->emailEnabled()) {
            return null;
        }

        if (! $user->hasVerifiedEmail()) {
            return null;
        }

        return 'code';
    }

    public function isNotNeeded(?User $user): bool
    {
        return $user !== null && $this->method($user) === null;
    }

    public function confirmsWithCode(?User $user): bool
    {
        return $this->method($user) === 'code';
    }

    public function isSatisfied(Request $request): bool
    {
        if ($this->isNotNeeded($request->user())) {
            return true;
        }

        return $this->isFresh($request);
    }
}
