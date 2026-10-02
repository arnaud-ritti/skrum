<?php

use App\Support\Database\Transactions;
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

it('answers 503 when the driver fails outside a statement, at the start or the commit of a transaction', function (PDOException $exception) {
    $this->postJson(failingRoute($exception))
        ->assertServiceUnavailable()
        ->assertHeader('Retry-After', '1')
        ->assertJsonPath('message', 'The database is busy. Try again.');
})->with([
    'sqlite busy at begin' => fn () => new PDOException('SQLSTATE[HY000]: General error: 5 database is locked'),
    'serialization failure at commit' => fn () => new PDOException('SQLSTATE[40001]: Serialization failure: 7 ERROR:  could not serialize access', 40001),
]);

it('still answers 500 for a driver error that is not a concurrency error', function () {
    $this->postJson(failingRoute(new PDOException('SQLSTATE[08006]: connection refused')))->assertInternalServerError();
});

it('answers 500 when only the text bound to a failing statement reads like a concurrency error', function () {
    $uri = failingRoute(new QueryException(
        'testing',
        'insert into cards (body) values (?)',
        ['the database is locked, deadlock detected'],
        new PDOException('SQLSTATE[42P01]: Undefined table'),
    ));

    $this->postJson($uri)->assertInternalServerError();
});

it('still answers 500 for any other database error', function () {
    $uri = failingRoute(new QueryException('testing', 'select * from nowhere', [], new PDOException('SQLSTATE[42P01]: Undefined table')));

    $this->postJson($uri)->assertInternalServerError();
});

it('answers the busy page to a browser, with the busy message and without the maintenance wording', function () {
    $uri = failingRoute(new QueryException('testing', 'update x', [], new PDOException('database is locked')));

    $this->post($uri, [], ['Accept-Language' => 'fr'])
        ->assertServiceUnavailable()
        ->assertHeader('Retry-After', '1')
        ->assertSee('data-slot="maintenance-page"', false)
        ->assertSee('La base de données est occupée. Réessayez.')
        ->assertDontSee('Maintenance')
        ->assertDontSee('<script', false);
});

it('marks the busy answer to an Inertia request, which shows the message instead of reloading the page', function () {
    $uri = failingRoute(new QueryException('testing', 'update x', [], new PDOException('database is locked')));

    $this->post($uri, [], ['X-Inertia' => 'true', 'Accept-Language' => 'fr'])
        ->assertServiceUnavailable()
        ->assertHeader('Retry-After', '1')
        ->assertHeader(Transactions::BusyHeader, rawurlencode('La base de données est occupée. Réessayez.'));
});

it('does not mark a 503 that is not a busy database', function () {
    Route::middleware('web')->post('/portability-probe/down', fn () => abort(503));

    $this->post('/portability-probe/down', [], ['X-Inertia' => 'true'])
        ->assertServiceUnavailable()
        ->assertHeaderMissing(Transactions::BusyHeader);
});
