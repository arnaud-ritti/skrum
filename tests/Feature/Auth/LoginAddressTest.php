<?php

use App\Support\Auth\LoginAddress;

it('normalises case and surrounding spaces only', function () {
    expect(LoginAddress::normalise('  Ada.Lovelace@Example.TEST '))->toBe('ada.lovelace@example.test')
        ->and(LoginAddress::normalise('rené@example.test'))->toBe('rené@example.test')
        ->and(LoginAddress::normalise('ada+tag@example.test'))->toBe('ada+tag@example.test');
});

it('gives spellings of one address the same throttle key', function () {
    expect(LoginAddress::throttleKey(' Ada@Example.test'))->toBe(LoginAddress::throttleKey('ada@example.test'))
        ->and(LoginAddress::throttleKey('ada@example.test'))->not->toBe(LoginAddress::throttleKey('ada+1@example.test'))
        ->and(LoginAddress::throttleKey('ada@example.test'))->toMatch('/^[a-f0-9]{64}$/');
});

it('never gives two different throttle keys to addresses that normalise to the same account', function (string $first, string $second) {
    expect(LoginAddress::normalise($first))->toBe(LoginAddress::normalise($second))
        ->and(LoginAddress::throttleKey($first))->toBe(LoginAddress::throttleKey($second));
})->with([
    ['A@x.test', 'a@x.test'],
    ["a@x.test\t", ' a@x.test'],
    ['ÉMILE@x.test', 'émile@x.test'],
]);

it('masks an address', function () {
    expect(LoginAddress::mask('ada.lovelace@example.test'))->toBe('a…@example.test')
        ->and(LoginAddress::mask('broken'))->toBe('b…@');
});
