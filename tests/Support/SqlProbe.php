<?php

namespace Tests\Support;

use Closure;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Tells which tables a piece of code locked for update, and in which order. It knows no SQL of
 * its own: the lock clause and the quoting of a table come from the grammar of the connection.
 */
class SqlProbe
{
    /**
     * @return array<int, array{table: string, level: int}>
     */
    public static function locks(Closure $during): array
    {
        $clause = self::lockClause();
        $grammar = DB::connection()->getQueryGrammar();
        $tables = array_column(Schema::getTables(), 'name');
        $recorded = [];
        $active = $clause !== '';

        DB::listen(function (QueryExecuted $query) use ($clause, $grammar, $tables, &$recorded, &$active): void {
            if (! $active || ! str_ends_with($query->sql, $clause)) {
                return;
            }

            foreach ($tables as $table) {
                if (str_contains($query->sql, 'from '.$grammar->wrapTable($table).' ')) {
                    $recorded[] = ['table' => $table, 'level' => DB::transactionLevel()];

                    return;
                }
            }
        });

        try {
            $during();
        } finally {
            $active = false;
        }

        return $recorded;
    }

    /**
     * @return array<int, string>
     */
    public static function lockedTables(Closure $during): array
    {
        return array_column(self::locks($during), 'table');
    }

    /**
     * False on an engine whose grammar compiles no lock clause.
     */
    public static function rowLocksExist(): bool
    {
        return self::lockClause() !== '';
    }

    private static function lockClause(): string
    {
        $plain = DB::table('users')->toSql();

        return trim(substr(DB::table('users')->lockForUpdate()->toSql(), strlen($plain)));
    }
}
