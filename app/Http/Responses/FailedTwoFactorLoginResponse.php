<?php

namespace App\Http\Responses;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\FailedTwoFactorLoginResponse as FailedTwoFactorLoginResponseContract;
use Symfony\Component\HttpFoundation\Response;

/**
 * Fortify's refusal of a second-factor code, with the attempts the
 * `two-factor` limiter still allows this challenge.
 */
class FailedTwoFactorLoginResponse implements FailedTwoFactorLoginResponseContract
{
    /**
     * @param  Request  $request
     */
    public function toResponse($request): Response
    {
        [$key, $message] = $request->filled('recovery_code')
            ? ['recovery_code', __('The provided two factor recovery code was invalid.')]
            : ['code', __('The provided two factor authentication code was invalid.')];

        $message = "{$message} {$this->attemptsLeft($request)}";

        if ($request->wantsJson()) {
            throw ValidationException::withMessages([$key => [$message]]);
        }

        return to_route('two-factor.login')->withErrors([$key => $message]);
    }

    /**
     * The throttle middleware counted this attempt already, under the key it
     * builds from the limiter's name and key: an MD5 of both, the framework's
     * default (ThrottleRequests::handleRequestUsingNamedLimiter), a cache key
     * and no secret.
     */
    private function attemptsLeft(Request $request): string
    {
        $limit = RateLimiter::limiter('two-factor')($request);
        $remaining = RateLimiter::remaining(hash('md5', "two-factor{$limit->key}"), $limit->maxAttempts);

        if ($remaining === 0) {
            return __('Wait a minute before trying again.');
        }

        return trans_choice(':count attempt left.|:count attempts left.', $remaining);
    }
}
