<?php

namespace App\Support\Integrations;

use App\Support\RateLimit;

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
        RateLimit::hit("tracker-browse:{$actorId}", self::MaxAttempts);
    }
}
