<?php

namespace Tests\Support;

use Closure;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Tells which tables a piece of code locked for update, and in which order. It knows no SQL of
 * its own: the lock clause and the quoting of a table come from the grammar of the connection.
 * It also tells which statements named a table, and which columns an update was conditional on.
 * The locked table is the first one the query reads from; it only sees the default connection.
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

            $firstRead = collect($tables)
                ->mapWithKeys(fn (string $table): array => [$table => strpos($query->sql, "from {$grammar->wrapTable($table)} ")])
                ->reject(fn (int|false $position): bool => $position === false)
                ->sort()
                ->keys()
                ->first();

            if ($firstRead !== null) {
                $recorded[] = ['table' => $firstRead, 'level' => DB::transactionLevel()];
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
     * The statements that name a table, as the grammar of the connection writes it.
     *
     * @return array<int, string>
     */
    public static function statementsOn(string $table, Closure $during): array
    {
        $name = DB::connection()->getQueryGrammar()->wrapTable($table);
        $recorded = [];
        $active = true;

        DB::listen(function (QueryExecuted $query) use ($name, &$recorded, &$active): void {
            if ($active && str_contains($query->sql, $name)) {
                $recorded[] = $query->sql;
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
     * The updates of a table, each with the columns its condition names.
     *
     * @return array<int, array<int, string>>
     */
    public static function updateConditions(string $table, Closure $during): array
    {
        $grammar = DB::connection()->getQueryGrammar();
        $columns = Schema::getColumnListing($table);
        $start = "update {$grammar->wrapTable($table)} ";

        return collect(self::statementsOn($table, $during))
            ->filter(fn (string $sql): bool => str_starts_with($sql, $start))
            ->map(fn (string $sql): array => array_values(array_filter(
                $columns,
                fn (string $column): bool => str_contains(Str::after($sql, ' where '), $grammar->wrap($column)),
            )))
            ->values()
            ->all();
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
