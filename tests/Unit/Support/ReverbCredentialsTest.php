<?php

use App\Support\ReverbCredentials;

it('keeps a credential that is set', function () {
    expect(ReverbCredentials::resolve('my-own-key', 'key', 'base64:app-key'))->toBe('my-own-key');
});

it('derives a credential that is missing or empty', function (mixed $explicit) {
    $derived = ReverbCredentials::resolve($explicit, 'key', 'base64:app-key');

    expect($derived)->toBeString()->toHaveLength(32)
        ->and($derived)->toBe(ReverbCredentials::resolve(null, 'key', 'base64:app-key'))
        ->and($derived)->not->toContain('app-key');
})->with([null, '']);

it('derives a different value for each purpose and for each app key', function () {
    $derived = array_map(
        fn (string $purpose): ?string => ReverbCredentials::resolve(null, $purpose, 'base64:app-key'),
        ['id', 'key', 'secret'],
    );

    expect(array_unique($derived))->toHaveCount(3)
        ->and(ReverbCredentials::resolve(null, 'key', 'base64:other-key'))->not->toBe($derived[1]);
});

it('derives nothing without an app key', function (?string $appKey) {
    expect(ReverbCredentials::resolve(null, 'key', $appKey))->toBeNull();
})->with([null, '']);
