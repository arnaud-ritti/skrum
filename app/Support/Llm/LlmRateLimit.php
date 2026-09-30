<?php

namespace App\Support\Llm;

use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Support\Facades\RateLimiter;

class LlmRateLimit
{
    /**
     * Throttled in the controller rather than by route middleware, which runs
     * before the participant is resolved and would fall back to one limit per IP.
     */
    public static function hit(string $key, int $maxAttempts): void
    {
        if (RateLimiter::tooManyAttempts($key, $maxAttempts)) {
            throw new ThrottleRequestsException(__('Too many requests, wait a moment.'), null, ['Retry-After' => RateLimiter::availableIn($key)]);
        }

        RateLimiter::hit($key);
    }
}
