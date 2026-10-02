<?php

it('gives each server engine a lock connection that is its twin', function (string $connection) {
    expect(config("database.connections.{$connection}_locks"))
        ->toBe(config("database.connections.{$connection}"));
})->with(['pgsql', 'mysql', 'mariadb']);

it('compares bytes, reads committed rows and speaks UTC on mysql and mariadb', function (string $connection, string $collation) {
    expect(config("database.connections.{$connection}.collation"))->toBe($collation)
        ->and(config("database.connections.{$connection}.isolation_level"))->toBe('READ COMMITTED')
        ->and(config("database.connections.{$connection}.timezone"))->toBe('+00:00');
})->with([
    'mysql' => ['mysql', 'utf8mb4_0900_bin'],
    'mariadb' => ['mariadb', 'utf8mb4_nopad_bin'],
]);

it('makes sqlite take the write lock when a transaction begins and wait for it', function () {
    expect(config('database.connections.sqlite.transaction_mode'))->toBe('IMMEDIATE')
        ->and(config('database.connections.sqlite.journal_mode'))->toBe('wal')
        ->and(config('database.connections.sqlite.busy_timeout'))->toBe(5000)
        ->and(config('database.connections.sqlite.synchronous'))->toBe('normal');
});

it('takes cache locks on the twin connection of a server engine and on the same connection for sqlite', function () {
    $default = config('database.default');
    $expected = array_key_exists("{$default}_locks", config('database.connections')) ? "{$default}_locks" : null;

    expect(config('cache.stores.database.lock_connection'))->toBe($expected);
});
