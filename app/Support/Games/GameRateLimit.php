<?php

namespace App\Support\Games;

use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Support\Facades\Cache;

/**
 * A token bucket: a player may burst up to $burst actions, then one more
 * every $secondsPerToken. Keyed by player rather than by route middleware,
 * which runs before the player is resolved and would fall back to one limit
 * per IP.
 */
class GameRateLimit
{
    public static function hit(string $key, int $burst, int $secondsPerToken): void
    {
        Cache::lock("{$key}:lock", 5)->block(2, function () use ($key, $burst, $secondsPerToken): void {
            $now = now()->getPreciseTimestamp(6) / 1_000_000;
            $state = Cache::get($key);

            $tokens = is_array($state) ?
                min($burst, $state['tokens'] + ($now - $state['at']) / $secondsPerToken) :
                (float) $burst;

            if ($tokens < 1) {
                $retryAfter = (int) ceil((1 - $tokens) * $secondsPerToken);

                throw new ThrottleRequestsException(__('Slow down a little.'), null, ['Retry-After' => $retryAfter]);
            }

            Cache::put($key, ['tokens' => $tokens - 1, 'at' => $now], $burst * $secondsPerToken + 1);
        });
    }
}
