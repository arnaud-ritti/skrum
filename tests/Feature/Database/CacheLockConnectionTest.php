<?php

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

it('holds a cache lock outside the transaction of the caller', function () {
    $lock = Cache::store('database')->lock('portability-probe', 30);

    DB::beginTransaction();
    $taken = $lock->get();
    DB::rollBack();

    $stillHeld = ! Cache::store('database')->lock('portability-probe', 30)->get();
    $lock->release();

    expect($taken)->toBeTrue()
        ->and($stillHeld)->toBeTrue();
})->skip(fn () => config('cache.stores.database.lock_connection') === null, 'This engine has one writer: the lock lives on the connection of the caller, by design.');
