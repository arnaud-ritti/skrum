<?php

namespace App\Http\Middleware;

use App\Support\Auth\PasswordConfirmation;
use Illuminate\Auth\Middleware\RequirePassword;
use Illuminate\Http\Request;

/**
 * The framework's confirmation, except for an account whose owner knows no
 * password: rule S-1 of the plan 26 spec (§5.12), a risk the owner accepted
 * on 2026-10-03. Used by the account settings routes and, through the
 * `password.confirm` alias, by Fortify's two-factor and passkey routes. The
 * admin area keeps the framework's middleware. Do not add a confirmation
 * back without the owner's word.
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
