<?php

namespace App\Support\Integrations;

use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Spec 6 §9: browsing a tracker is limited per person, whether through the
 * game page or MCP. Throttled in code because the route middleware runs
 * before the player is resolved.
 */
class TrackerBrowseLimit
{
    public const MaxAttempts = 30;

    public static function hit(string $actorId): void
    {
        $key = "tracker-browse:{$actorId}";

        if (RateLimiter::tooManyAttempts($key, self::MaxAttempts)) {
            throw new ThrottleRequestsException(__('Too many requests, wait a moment.'), null, ['Retry-After' => RateLimiter::availableIn($key)]);
        }

        RateLimiter::hit($key);
    }
}
