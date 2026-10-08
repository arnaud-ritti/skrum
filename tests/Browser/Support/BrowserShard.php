<?php

namespace Tests\Browser\Support;

use InvalidArgumentException;

class BrowserShard
{
    public const string Variable = 'BROWSER_SHARD';

    public const string WorkerVariable = 'TEST_TOKEN';

    /**
     * The number of a manual browser shard or a Pest parallel worker; null for a run on its own.
     */
    public static function current(): ?int
    {
        $variable = self::Variable;
        $shard = getenv($variable);

        if ($shard === false || $shard === '') {
            $variable = self::WorkerVariable;
            $shard = getenv($variable);
        }

        if ($shard === false || $shard === '') {
            return null;
        }

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
