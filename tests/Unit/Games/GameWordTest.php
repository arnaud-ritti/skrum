<?php

use App\Support\Games\GameWord;

it('masks letters and gives separators', function () {
    expect(GameWord::mask("l'équipe-a b", []))->toBe([null, "'", null, null, null, null, null, null, '-', null, ' ', null])
        ->and(GameWord::mask('Sprint', [0, 5]))->toBe(['S', null, null, null, null, 't']);
});

it('lists letter positions without separators', function () {
    expect(GameWord::letterPositions('U-Boot'))->toBe([0, 2, 3, 4, 5])
        ->and(GameWord::letterPositions('pull request'))->toHaveCount(11);
});

it('finds positions of a letter across case and accents', function () {
    expect(GameWord::positionsOf('Éléphant', 'e'))->toBe([0, 2])
        ->and(GameWord::positionsOf('Brücke', 'U'))->toBe([2])
        ->and(GameWord::positionsOf('piña', 'n'))->toBe([2])
        ->and(GameWord::positionsOf('sprint', 'z'))->toBe([]);
});

it('knows when every letter is revealed', function () {
    expect(GameWord::isFullyRevealed('a-b', [0, 2]))->toBeTrue()
        ->and(GameWord::isFullyRevealed('a-b', [0]))->toBeFalse();
});

it('normalizes guesses', function (string $text, string $expected) {
    expect(GameWord::normalize($text))->toBe($expected);
})->with([
    ['  Pull   Request ', 'pull request'],
    ['Arc-en-Ciel', 'arcenciel'],
    ["esprit d'Équipe", 'esprit dequipe'],
    ['ÉLÉPHANT', 'elephant'],
]);

it('folds single characters', function () {
    expect(GameWord::fold('É'))->toBe('e')
        ->and(GameWord::isSeparator(' '))->toBeTrue()
        ->and(GameWord::isSeparator('a'))->toBeFalse();
});
