<?php

use App\Actions\Poker\PokerResult;
use App\Enums\PokerDeck;

it('averages a Fibonacci round and picks the nearest card', function () {
    $result = PokerResult::compute(PokerDeck::Fibonacci->cards(), ['3', '5', '8', '5']);

    expect($result['average'])->toBe(5.3)
        ->and($result['nearestCard'])->toBe('5')
        ->and($result['mode'])->toBe(['5'])
        ->and($result['consensus'])->toBeFalse();
});

it('counts ½ in Modified Fibonacci', function () {
    $result = PokerResult::compute(PokerDeck::ModifiedFibonacci->cards(), ['½', '1']);

    expect($result['average'])->toBe(0.8)
        ->and($result['nearestCard'])->toBe('1');
});

it('averages powers of two', function () {
    $result = PokerResult::compute(PokerDeck::PowersOfTwo->cards(), ['2', '4', '8']);

    expect($result['average'])->toBe(4.7)
        ->and($result['nearestCard'])->toBe('4');
});

it('leaves ? and ☕ out of the numbers but in the distribution', function () {
    $result = PokerResult::compute(PokerDeck::Fibonacci->cards(), ['☕', '8', '?', '8']);

    expect($result['average'])->toBe(8.0)
        ->and($result['consensus'])->toBeTrue()
        ->and($result['mode'])->toBe(['8'])
        ->and($result['distribution'])->toBe([
            ['value' => '8', 'count' => 2],
            ['value' => '?', 'count' => 1],
            ['value' => '☕', 'count' => 1],
        ]);
});

it('rounds the average half up to one decimal', function () {
    expect(PokerResult::compute(PokerDeck::Fibonacci->cards(), ['1', '2', '2'])['average'])->toBe(1.7)
        ->and(PokerResult::compute(PokerDeck::Fibonacci->cards(), ['1', '2', '2', '2'])['average'])->toBe(1.8);
});

it('breaks a nearest-card tie towards the higher card', function () {
    $result = PokerResult::compute(PokerDeck::Fibonacci->cards(), ['1', '2']);

    expect($result['average'])->toBe(1.5)
        ->and($result['nearestCard'])->toBe('2')
        ->and($result['mode'])->toBe(['1', '2']);
});

it('gives the mode and no average for T-shirt decks', function () {
    $result = PokerResult::compute(PokerDeck::Tshirt->cards(), ['M', 'S', 'M', 'S', 'L']);

    expect($result['average'])->toBeNull()
        ->and($result['nearestCard'])->toBeNull()
        ->and($result['mode'])->toBe(['S', 'M'])
        ->and($result['consensus'])->toBeFalse();
});

it('reports consensus when every countable vote agrees', function () {
    $result = PokerResult::compute(PokerDeck::Tshirt->cards(), ['L', 'L', '?']);

    expect($result['consensus'])->toBeTrue()
        ->and($result['mode'])->toBe(['L']);
});

it('has no result numbers when every vote is special', function () {
    $result = PokerResult::compute(PokerDeck::Fibonacci->cards(), ['?', '☕']);

    expect($result)->toBe([
        'average' => null,
        'distribution' => [
            ['value' => '?', 'count' => 1],
            ['value' => '☕', 'count' => 1],
        ],
        'mode' => [],
        'consensus' => false,
        'nearestCard' => null,
    ]);
});

it('treats custom decks as numeric only when every card is a number', function () {
    $numeric = PokerResult::compute(['1', '3', '5', '?'], ['1', '5']);
    $words = PokerResult::compute(['small', 'big', '?'], ['big', 'small', 'big']);

    expect($numeric['average'])->toBe(3.0)
        ->and($numeric['nearestCard'])->toBe('3')
        ->and($words['average'])->toBeNull()
        ->and($words['mode'])->toBe(['big']);
});

it('orders the distribution like the deck', function () {
    $result = PokerResult::compute(PokerDeck::Fibonacci->cards(), ['13', '1', '5', '1']);

    expect(array_column($result['distribution'], 'value'))->toBe(['1', '5', '13'])
        ->and(array_column($result['distribution'], 'count'))->toBe([2, 1, 1]);
});
