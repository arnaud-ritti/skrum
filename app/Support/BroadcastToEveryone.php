<?php

namespace App\Support;

use Illuminate\Support\Facades\Context;

/**
 * Work no client asked for (an expired turn or round moved on during
 * someone's request) is told to every socket, the requester's included:
 * events sent to others inside the scope skip no one.
 */
class BroadcastToEveryone
{
    private const string ContextKey = 'broadcastsToEveryone';

    /**
     * @template TResult
     *
     * @param  callable(): TResult  $callback
     * @return TResult
     */
    public static function during(callable $callback): mixed
    {
        return Context::scope($callback, hidden: [self::ContextKey => true]);
    }

    public static function isActive(): bool
    {
        return Context::getHidden(self::ContextKey) === true;
    }
}
