<?php

namespace Tests\Browser\Support;

use InvalidArgumentException;

class BrowserShard
{
    public const string Variable = 'BROWSER_SHARD';

    /**
     * The number `bin/test-browser` gives to each of the processes it runs side by side; null for a run on its own.
     */
    public static function current(): ?int
    {
        $shard = getenv(self::Variable);

        if ($shard === false || $shard === '') {
            return null;
        }

        $variable = self::Variable;

        throw_unless(ctype_digit($shard) && (int) $shard >= 1, InvalidArgumentException::class, "{$variable} must be a positive integer, got `{$shard}`.");

        return (int) $shard;
    }

    public static function token(int $shard): string
    {
        return "browser_{$shard}";
    }

    public static function diskRoot(int $shard): string
    {
        return storage_path("framework/testing/disks/browser_shard_{$shard}");
    }
}
