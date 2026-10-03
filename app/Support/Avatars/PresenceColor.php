<?php

namespace App\Support\Avatars;

/**
 * The twelve presence colours of the theme (`--skrum-presence-1` to `-12`).
 * Without a choice, a person's colour is derived from the seed of their
 * avatar, which mail has always done: no colour changes for anyone.
 */
class PresenceColor
{
    public const int Count = 12;

    public static function forSeed(string $seed): int
    {
        return (hexdec(substr(hash('sha256', $seed), 0, 7)) % self::Count) + 1;
    }
}
