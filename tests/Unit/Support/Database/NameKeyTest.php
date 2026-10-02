<?php

use App\Support\Database\NameKey;

it('folds case and drops surrounding white space', function (string $name, string $key) {
    expect(NameKey::of($name))->toBe($key);
})->with([
    'capitals' => ['Sprint Map', 'sprint map'],
    'surrounding spaces' => ['  sprint MAP ', 'sprint map'],
    'accented capitals' => ['ÉTÉ Élan', 'été élan'],
    'inner spaces are kept' => ['Sprint  Map', 'sprint  map'],
    'accents are kept' => ['Été', 'été'],
]);

it('keeps two names apart when only an accent differs', function () {
    expect(NameKey::of('peche'))->not->toBe(NameKey::of('pêche'));
});
