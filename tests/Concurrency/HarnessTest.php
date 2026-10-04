<?php

use App\Models\User;
use Illuminate\Support\Sleep;
use Tests\Concurrency\Support\Race;

it('runs its contenders at the same time, each in its own process', function () {
    $outcomes = Race::run(array_fill(0, 4, static function (): int {
        Sleep::usleep(300_000);

        return (int) getmypid();
    }));

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and(array_unique(array_column($outcomes, 'value')))->toHaveCount(4)
        ->and(max(array_column($outcomes, 'startedAt')))->toBeLessThan(min(array_column($outcomes, 'endedAt')));
});

it('gives a contender the database of the test', function () {
    $userId = User::factory()->create()->id;

    $outcomes = Race::run([static fn (): bool => User::query()->whereKey($userId)->exists()]);

    expect($outcomes[0])->toMatchArray(['ok' => true, 'value' => true]);
});

it('reports an exception of a contender instead of failing the run', function () {
    $outcomes = Race::run([static fn () => throw new RuntimeException('boom')]);

    expect($outcomes[0])->toMatchArray(['ok' => false, 'error' => RuntimeException::class, 'message' => 'boom']);
});
