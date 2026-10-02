<?php

use App\Models\Team;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\Support\DatabaseFailure;
use Tests\Support\MissingTables;
use Tests\Support\SqlProbe;
use Tests\Support\UnreachableDatabase;

it('records the tables whose rows a transaction locked, in order, with the transaction level', function () {
    $user = User::factory()->create();
    $team = Team::factory()->create();
    $outside = DB::transactionLevel();

    $locks = SqlProbe::locks(function () use ($user, $team): void {
        DB::transaction(function () use ($user, $team): void {
            User::query()->whereKey($user->id)->lockForUpdate()->first();
            Team::query()->whereKey($team->id)->lockForUpdate()->first();
            User::query()->whereKey($user->id)->first();
        });
    });

    expect($locks)->toBe([
        ['table' => 'users', 'level' => $outside + 1],
        ['table' => 'teams', 'level' => $outside + 1],
    ]);
})->skip(fn () => ! SqlProbe::rowLocksExist(), 'This engine has no row lock: its write transactions are serialised instead.');

it('records nothing once its closure has returned', function () {
    $user = User::factory()->create();

    $locks = SqlProbe::locks(fn () => null);
    DB::transaction(fn () => User::query()->whereKey($user->id)->lockForUpdate()->first());

    expect($locks)->toBe([]);
});

it('provokes a failure the database itself raises', function () {
    expect(fn () => DB::transaction(fn () => DatabaseFailure::provoke()))->toThrow(QueryException::class);
});

it('describes a connection that cannot be opened', function () {
    config(['database.connections.unreachable' => UnreachableDatabase::config()]);

    expect(fn () => DB::connection('unreachable')->getPdo())->toThrow(Exception::class);

    DB::purge('unreachable');
});

it('hides every table while a closure runs and gives them back', function () {
    User::factory()->create();

    expect(fn () => MissingTables::during(fn () => User::query()->count()))->toThrow(QueryException::class)
        ->and(User::query()->count())->toBe(1);
});

it('hides the table of one model while a closure runs and leaves the others', function () {
    User::factory()->create();
    Team::factory()->create();

    $teams = MissingTables::ofModel(User::class, function (): int {
        $teams = Team::query()->count();

        expect(fn () => User::query()->count())->toThrow(QueryException::class);

        return $teams;
    });

    expect($teams)->toBe(1)
        ->and(User::query()->count())->toBeGreaterThanOrEqual(1);
});
