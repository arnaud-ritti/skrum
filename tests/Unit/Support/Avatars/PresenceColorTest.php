<?php

use App\Support\Avatars\PresenceColor;

it('keeps the colour mail has always derived from an avatar seed', function (string $seed) {
    $before = (hexdec(substr(hash('sha256', $seed), 0, 7)) % 12) + 1;

    expect(PresenceColor::forSeed($seed))->toBe($before);
})->with(['0123456789abcdef0123456789abcdef', 'ffffffffffffffffffffffffffffffff', 'a']);

it('always gives one of the twelve colours', function () {
    $colours = collect(range(1, 300))->map(fn (int $index): int => PresenceColor::forSeed("seed-{$index}"))->unique()->sort()->values()->all();

    expect($colours)->toBe(range(1, 12));
});
