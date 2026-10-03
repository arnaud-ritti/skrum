<?php

use App\Support\Surveys\HealthScale;

it('leaves a mean on five as it is and halves a mean on ten', function () {
    expect(HealthScale::normalise(3.8, 5))->toBe(3.8)
        ->and(HealthScale::normalise(7.0, 10))->toBe(3.5)
        ->and(HealthScale::normalise(1.0, 10))->toBe(0.5)
        ->and(HealthScale::average(7.25, 10))->toBe(3.6)
        ->and(HealthScale::average(22 / 3, 10))->toBe(3.7);
});

it('puts each answer in one of five buckets, two values of ten per bucket', function () {
    expect(array_map(fn (int $value): int => HealthScale::bucket($value, 10), range(1, 10)))->toBe([1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        ->and(array_map(fn (int $value): int => HealthScale::bucket($value, 5), range(1, 5)))->toBe([1, 2, 3, 4, 5])
        ->and(HealthScale::distribution([8, 6, 7], 10))->toBe([0, 0, 1, 2, 0])
        ->and(HealthScale::distribution([], 5))->toBe([0, 0, 0, 0, 0]);
});

it('measures the spread on the scale of the answers', function () {
    expect(HealthScale::maximumSpread(10))->toBe(4.5)
        ->and(HealthScale::maximumSpread(5))->toBe(2.0);
});

it('reads the bands on five', function (float $score, string $band) {
    expect(HealthScale::band($score))->toBe($band);
})->with([[4.0, 'excellent'], [3.9, 'good'], [3.0, 'good'], [2.9, 'needs_attention'], [2.0, 'needs_attention'], [1.9, 'critical'], [0.5, 'critical']]);
