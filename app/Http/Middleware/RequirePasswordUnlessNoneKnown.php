<?php

namespace App\Http\Middleware;

use App\Support\Auth\PasswordConfirmation;
use Illuminate\Auth\Middleware\RequirePassword;
use Illuminate\Http\Request;

/**
 * The framework's confirmation. An account whose owner knows no password
 * confirms with a code sent by e-mail on the same page; when no code can
 * reach it, nothing is asked: rule S-1 of the plan 26 spec (§5.12), a risk
 * the owner accepted on 2026-10-03. Used by the account settings routes and,
 * through the `password.confirm` alias, by Fortify's two-factor and passkey
 * routes. The admin area keeps the framework's middleware.
 */
class RequirePasswordUnlessNoneKnown extends RequirePassword
{
    /**
     * @param  Request  $request
     * @param  int|null  $passwordTimeoutSeconds
     */
    protected function shouldConfirmPassword($request, $passwordTimeoutSeconds = null): bool
    {
        if (resolve(PasswordConfirmation::class)->isNotNeeded($request->user())) {
            return false;
        }

        return (bool) parent::shouldConfirmPassword($request, $passwordTimeoutSeconds);
    }
}
