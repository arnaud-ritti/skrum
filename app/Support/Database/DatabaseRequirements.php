<?php

namespace App\Support\Database;

use Illuminate\Database\Connection;

/**
 * What Skrum needs from its database. It asks the server nothing engine-specific: the connectors
 * apply the options of config/database.php at every connect, so the options are what the session
 * runs with; the version and the tables are read through the framework.
 */
class DatabaseRequirements
{
    /** @return array<int, string> */
    public static function problems(Connection $connection): array
    {
        $config = $connection->getConfig();
        $minimum = $config['minimum_version'] ?? null;

        if ($minimum === null) {
            return ["The connection {$connection->getName()} declares no minimum_version: it is not one of the engines Skrum supports (PostgreSQL, MariaDB, MySQL, SQLite)."];
        }

        $problems = [];
        $version = $connection->getServerVersion();

        if (version_compare($version, $minimum, '<')) {
            $problems[] = "The server version {$version} is older than the minimum, {$minimum}.";
        }

        $collation = $config['collation'] ?? null;

        if ($collation !== null && ! str_ends_with((string) $collation, '_bin')) {
            $problems[] = "The connection collation is {$collation}. Skrum needs a binary collation (DB_COLLATION): with this one, different emoji and words that differ by case or accent are treated as equal.";
        }

        if (array_key_exists('isolation_level', $config) && strtoupper((string) $config['isolation_level']) !== 'READ COMMITTED') {
            $problems[] = 'The isolation_level of the connection must be READ COMMITTED: limits and uniqueness checks can otherwise be passed by two requests at once.';
        }

        if (array_key_exists('transaction_mode', $config) && $config['transaction_mode'] !== 'IMMEDIATE') {
            $problems[] = 'The transaction_mode of the connection must be IMMEDIATE: transactions otherwise take the write lock too late and concurrent writes fail.';
        }

        if (array_key_exists('journal_mode', $config) && $config['database'] !== ':memory:' && strtolower((string) $config['journal_mode']) !== 'wal') {
            $problems[] = "The journal_mode is {$config['journal_mode']}. Skrum needs wal: readers would otherwise block the writer.";
        }

        if (array_key_exists('foreign_key_constraints', $config) && ! $config['foreign_key_constraints']) {
            $problems[] = 'Foreign keys are off (DB_FOREIGN_KEYS): deleting a team or a retro would leave its rows behind.';
        }

        $looseTables = collect(static::tablesWithoutBinaryCollation($connection->getSchemaBuilder()->getTables()));

        if ($looseTables->isNotEmpty()) {
            $problems[] = "{$looseTables->count()} tables were created with a collation that is not binary ({$looseTables->take(5)->implode(', ')}): they were created before the collation was set, and compare without regard to case.";
        }

        return $problems;
    }

    /**
     * @param  array<int, array<string, mixed>>  $tables
     * @return array<int, string>
     */
    public static function tablesWithoutBinaryCollation(array $tables): array
    {
        return collect($tables)
            ->filter(fn (array $table): bool => ($table['collation'] ?? null) !== null && ! str_ends_with($table['collation'], '_bin'))
            ->pluck('name')
            ->values()
            ->all();
    }
}
