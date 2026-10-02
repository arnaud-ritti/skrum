<?php

use Illuminate\Database\DeadlockException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Route;

function failingRoute(Throwable $exception): string
{
    Route::middleware('web')->post('/portability-probe/busy', fn () => throw $exception);

    return '/portability-probe/busy';
}

it('answers 503 with a retry delay when the database is busy or deadlocked', function (string $message) {
    $uri = failingRoute(new QueryException('testing', 'update retros set votes_version = ?', [1], new PDOException($message)));

    $this->postJson($uri)
        ->assertServiceUnavailable()
        ->assertHeader('Retry-After', '1')
        ->assertJsonPath('message', 'The database is busy. Try again.');
})->with([
    'mysql and mariadb deadlock' => 'SQLSTATE[40001]: Serialization failure: 1213 Deadlock found when trying to get lock; try restarting transaction',
    'mysql and mariadb lock wait' => 'SQLSTATE[HY000]: General error: 1205 Lock wait timeout exceeded; try restarting transaction',
    'postgresql deadlock' => 'SQLSTATE[40P01]: Deadlock detected: 7 ERROR:  deadlock detected',
    'sqlite busy' => 'SQLSTATE[HY000]: General error: 5 database is locked',
]);

it('answers 503 when a deadlock is rethrown from a nested transaction', function () {
    $this->postJson(failingRoute(new DeadlockException('Deadlock found when trying to get lock')))
        ->assertServiceUnavailable()
        ->assertHeader('Retry-After', '1');
});

it('still answers 500 for any other database error', function () {
    $uri = failingRoute(new QueryException('testing', 'select * from nowhere', [], new PDOException('SQLSTATE[42P01]: Undefined table')));

    $this->postJson($uri)->assertInternalServerError();
});

it('answers the busy page to a browser', function () {
    $uri = failingRoute(new QueryException('testing', 'update x', [], new PDOException('database is locked')));

    $this->post($uri)->assertServiceUnavailable()->assertHeader('Retry-After', '1');
});
