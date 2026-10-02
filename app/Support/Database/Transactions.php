<?php

namespace App\Support\Database;

use Illuminate\Database\ConcurrencyErrorDetector;
use Throwable;

class Transactions
{
    /**
     * For `DB::transaction($callback, Transactions::Attempts)`, only where the callback touches
     * nothing but the database: a retried callback runs again from its first line.
     */
    public const int Attempts = 3;

    /**
     * A deadlock, a lock wait that timed out, or a busy SQLite file: the request did nothing wrong
     * and would succeed if repeated.
     */
    public static function isConcurrencyError(Throwable $exception): bool
    {
        return (new ConcurrencyErrorDetector)->causedByConcurrencyError($exception);
    }

    public static function busyMessage(): string
    {
        return __('The database is busy. Try again.');
    }
}
