<?php

use App\Enums\PokerDeck;

it('lists the cards of each built-in deck', function () {
    expect(PokerDeck::Fibonacci->cards())->toBe(['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?', '☕'])
        ->and(PokerDeck::ModifiedFibonacci->cards())->toBe(['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'])
        ->and(PokerDeck::Tshirt->cards())->toBe(['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'])
        ->and(PokerDeck::PowersOfTwo->cards())->toBe(['0', '1', '2', '4', '8', '16', '32', '64', '?', '☕'])
        ->and(PokerDeck::Custom->cards())->toBeEmpty();
});

it('parses numeric card values', function (string $card, ?float $value) {
    expect(PokerDeck::numericValue($card))->toBe($value);
})->with([
    ['½', 0.5],
    ['13', 13.0],
    ['0.5', 0.5],
    ['0', 0.0],
    ['XS', null],
    ['?', null],
    ['☕', null],
    ['-1', null],
    ['1.', null],
]);

it('recognises special cards', function () {
    expect(PokerDeck::isSpecial('?'))->toBeTrue()
        ->and(PokerDeck::isSpecial('☕'))->toBeTrue()
        ->and(PokerDeck::isSpecial('3'))->toBeFalse()
        ->and(PokerDeck::UnknownCard)->toBe('?')
        ->and(PokerDeck::CoffeeCard)->toBe('☕');
});

it('tells numeric decks apart', function () {
    expect(PokerDeck::isNumericDeck(PokerDeck::Fibonacci->cards()))->toBeTrue()
        ->and(PokerDeck::isNumericDeck(PokerDeck::ModifiedFibonacci->cards()))->toBeTrue()
        ->and(PokerDeck::isNumericDeck(PokerDeck::PowersOfTwo->cards()))->toBeTrue()
        ->and(PokerDeck::isNumericDeck(PokerDeck::Tshirt->cards()))->toBeFalse()
        ->and(PokerDeck::isNumericDeck(['1', '2.5', '4', '?']))->toBeTrue()
        ->and(PokerDeck::isNumericDeck(['1', 'big', '?']))->toBeFalse();
});
