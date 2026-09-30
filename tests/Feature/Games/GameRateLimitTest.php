<?php

use App\Support\Games\GameRateLimit;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Support\Facades\Cache;

it('answers too many requests when the player lock cannot be acquired', function () {
    $heldLock = Cache::lock('game-play:contended:lock', 10);
    $heldLock->get();

    try {
        GameRateLimit::hit('game-play:contended', 3, 1);
    } finally {
        $heldLock->release();
    }
})->throws(ThrottleRequestsException::class, 'Slow down a little.');

it('refills one token per interval after the burst is spent', function () {
    GameRateLimit::hit('game-play:refill', 1, 1.0);

    expect(fn () => GameRateLimit::hit('game-play:refill', 1, 1.0))->toThrow(ThrottleRequestsException::class);

    $this->travel(2)->seconds();

    expect(fn () => GameRateLimit::hit('game-play:refill', 1, 1.0))->not->toThrow(ThrottleRequestsException::class);
});
