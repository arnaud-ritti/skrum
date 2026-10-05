<?php

use App\Support\Database\DatabaseRequirements;
use Illuminate\Support\Facades\DB;

function problemsOfConnection(string $name, array $overrides, ?string $from = null): string
{
    $from ??= config('database.default');

    config(["database.connections.{$name}" => [...config("database.connections.{$from}"), ...$overrides]]);

    try {
        return implode("\n", DatabaseRequirements::problems(DB::connection($name)));
    } finally {
        DB::purge($name);
    }
}

it('finds nothing wrong with the database the suite runs on', function () {
    expect(DatabaseRequirements::problems(DB::connection()))->toBeEmpty();

    $this->artisan('skrum:check-database')
        ->expectsOutputToContain('The database is ready.')
        ->assertSuccessful();
});

it('refuses a connection configured to ignore case or to read repeatable snapshots', function () {
    $problems = problemsOfConnection('loose', [
        'collation' => 'utf8mb4_unicode_ci',
        'isolation_level' => 'REPEATABLE READ',
    ]);

    expect($problems)->toContain('utf8mb4_unicode_ci')
        ->toContain('READ COMMITTED');
})->skip(fn () => ! array_key_exists('isolation_level', config('database.connections.'.config('database.default'))), 'Applies to connections that have an isolation level option.');

it('refuses a sqlite file that is not in write-ahead mode or does not take the write lock at begin', function () {
    $path = tempnam(sys_get_temp_dir(), 'skrum-check-');

    $problems = problemsOfConnection('plain_file', [
        'database' => $path,
        'journal_mode' => 'delete',
        'transaction_mode' => 'DEFERRED',
        'foreign_key_constraints' => false,
    ], 'sqlite');

    array_map(unlink(...), glob("{$path}*"));

    expect($problems)->toContain('journal_mode')
        ->toContain('IMMEDIATE')
        ->toContain('DB_FOREIGN_KEYS');
});

it('accepts a sqlite file opened with the settings of the application', function () {
    $path = tempnam(sys_get_temp_dir(), 'skrum-check-');

    $problems = problemsOfConnection('wal_file', ['database' => $path], 'sqlite');

    array_map(unlink(...), glob("{$path}*"));

    expect($problems)->toBeEmpty();
});

it('accepts an isolation level written in lower case', function () {
    $problems = problemsOfConnection('lower_case', ['isolation_level' => 'read committed']);

    expect($problems)->not->toContain('READ COMMITTED');
})->skip(fn () => ! array_key_exists('isolation_level', config('database.connections.'.config('database.default'))), 'Applies to connections that have an isolation level option.');

it('reads the foreign key option the way the sqlite connector does', function (mixed $value, bool $isReported) {
    $path = tempnam(sys_get_temp_dir(), 'skrum-check-');

    $problems = problemsOfConnection('foreign_keys', [
        'database' => $path,
        'foreign_key_constraints' => $value,
    ], 'sqlite');

    array_map(unlink(...), glob("{$path}*"));

    expect(str_contains($problems, 'DB_FOREIGN_KEYS'))->toBe($isReported);
})->with([
    'true' => [true, false],
    'a non-empty string, which the connector turns on' => ['off', false],
    'false' => [false, true],
    'not set, which leaves the default of SQLite, off' => [null, true],
]);

it('names the tables whose collation is not binary', function () {
    $tables = [
        ['name' => 'cards', 'collation' => 'utf8mb4_bin'],
        ['name' => 'teams', 'collation' => 'utf8mb4_unicode_ci'],
        ['name' => 'retros', 'collation' => null],
        ['name' => 'votes'],
        ['name' => 'users', 'collation' => 'utf8mb4_uca1400_ai_ci'],
    ];

    expect(DatabaseRequirements::tablesWithoutBinaryCollation($tables))->toBe(['teams', 'users']);
});

it('refuses a server older than the minimum of its connection', function () {
    $problems = problemsOfConnection('too_old', ['minimum_version' => '999.0.0']);

    expect($problems)->toContain('older than the minimum, 999.0.0');
});

it('refuses a connection that declares no minimum version', function () {
    $problems = problemsOfConnection('undeclared', ['minimum_version' => null]);

    expect($problems)->toContain('minimum_version');
});

it('fails the command and names the problem', function () {
    $path = tempnam(sys_get_temp_dir(), 'skrum-check-');

    config(['database.connections.plain_file' => [
        ...config('database.connections.sqlite'),
        'database' => $path,
        'journal_mode' => 'delete',
    ]]);

    try {
        $this->artisan('skrum:check-database', ['--database' => 'plain_file'])
            ->expectsOutputToContain('journal_mode')
            ->assertFailed();
    } finally {
        DB::purge('plain_file');
        array_map(unlink(...), glob("{$path}*"));
    }
});
