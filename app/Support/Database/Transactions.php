<?php

namespace App\Support\Database;

use Illuminate\Database\ConcurrencyErrorDetector;
use Illuminate\Database\QueryException;
use Throwable;

class Transactions
{
    /**
     * For `DB::transaction($callback, Transactions::Attempts)`, only where the callback touches
     * nothing but the database: a retried callback runs again from its first line.
     */
    public const int Attempts = 3;

    /**
     * Carried by the 503 of a busy database, with the message URL-encoded: the front end shows it
     * as a toast instead of reloading the page as it does for maintenance mode.
     */
    public const string BusyHeader = 'X-Database-Busy';

    /**
     * A deadlock, a lock wait that timed out, or a busy SQLite file: the request did nothing wrong
     * and would succeed if repeated. The message of a `QueryException` holds the statement and
     * the text bound to it, so the error of the driver is the one read.
     */
    public static function isConcurrencyError(Throwable $exception): bool
    {
        $driverError = $exception instanceof QueryException
            ? $exception->getPrevious() ?? $exception
            : $exception;

        return (new ConcurrencyErrorDetector)->causedByConcurrencyError($driverError);
    }

    public static function busyMessage(): string
    {
        return __('The database is busy. Try again.');
    }
}
