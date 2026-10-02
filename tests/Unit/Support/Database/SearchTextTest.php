<?php

use App\Support\Database\SearchText;

it('folds case and keeps accents', function () {
    expect(SearchText::fold('ÉTÉ à Paris'))->toBe('été à paris')
        ->and(SearchText::fold(null))->toBeNull();
});

it('folds a letter the same way wherever it stands in a word', function () {
    expect(SearchText::fold('ΦΟΣ'))->toBe('φοσ')
        ->and(SearchText::fold('ΦΟΣΑ'))->toBe('φοσα')
        ->and(SearchText::pattern('ΦΟΣ'))->toBe('%φοσ%')
        ->and(SearchText::contains('ΦΟΣΑ', 'ΦΟΣ'))->toBeTrue();
});

it('builds a pattern in which a wildcard character stands for any one character', function (string $term, string $pattern) {
    expect(SearchText::pattern($term))->toBe($pattern);
})->with([
    'plain' => ['Été', '%été%'],
    'percent' => ['100%', '%100_%'],
    'underscore' => ['a_b', '%a_b%'],
    'backslash' => ['a\\b', '%a_b%'],
    'glob characters' => ['a*b?c[d]', '%a_b_c_d_%'],
]);

it('checks a text exactly, whatever the case', function (string $text, string $term, bool $expected) {
    expect(SearchText::contains($text, $term))->toBe($expected);
})->with([
    ['We shipped 100% of it', '100%', true],
    ['We shipped 1000 of it', '100%', false],
    ['Été indien', 'ÉTÉ', true],
    ['ete', 'été', false],
    ['a_b', 'A_B', true],
    ['axb', 'a_b', false],
]);

it('finds nothing in a missing text', function () {
    expect(SearchText::contains(null, 'a'))->toBeFalse();
});
