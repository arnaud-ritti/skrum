<?php

use App\Support\Games\GameWordBook;
use App\Support\Games\GuestNames;
use Illuminate\Support\Str;

dataset('game locales', ['en', 'fr', 'es', 'de']);

function dictionaryFold(string $character): string
{
    return Str::lower(Str::ascii($character));
}

it('ships at least 250 valid words with 150 drawable ones', function (string $locale) {
    $book = new GameWordBook;
    $entries = $book->entries($locale);
    $words = array_column($entries, 'word');

    expect(count($entries))->toBeGreaterThanOrEqual(250)
        ->and(count($book->words($locale, drawableOnly: true)))->toBeGreaterThanOrEqual(150)
        ->and(count($book->words($locale, drawableOnly: false)))->toBe(count($entries));

    foreach ($words as $word) {
        expect(mb_strlen($word))->toBeGreaterThanOrEqual(3, "Too short: [{$word}]")
            ->and(mb_strlen($word))->toBeLessThanOrEqual(24, "Too long: [{$word}]")
            ->and(preg_match("/^\\p{L}+(?:[ '\\-]\\p{L}+)*$/u", $word))->toBe(1, "Invalid characters: [{$word}]");

        foreach (mb_str_split($word) as $character) {
            if (in_array($character, [' ', '-', "'"], true)) {
                continue;
            }

            expect(dictionaryFold($character))->toMatch('/^[a-z]$/', "Letter [{$character}] of [{$word}] does not fold to a-z");
        }
    }

    $normalized = array_map(fn (string $word): string => preg_replace('/[\s\'-]+/', '', dictionaryFold($word)) ?? $word, $words);

    expect(array_unique($normalized))->toHaveCount(count($words));
})->with('game locales');

it('ships at least 60 GIF questions', function (string $locale) {
    $questions = (new GameWordBook)->questions($locale);

    expect(count($questions))->toBeGreaterThanOrEqual(60)
        ->and(array_unique($questions))->toHaveCount(count($questions));

    foreach ($questions as $question) {
        expect(trim($question))->not->toBe('')
            ->and(mb_strlen($question))->toBeLessThanOrEqual(200);
    }
})->with('game locales');

it('builds guest names for every animal and adjective', function (string $locale) {
    $data = require resource_path("games/guest-names/{$locale}.php");

    foreach ($data['animals'] as $animal) {
        foreach ($data['adjectives'] as $adjective) {
            expect($adjective)->toHaveKey($animal['gender']);
        }
    }

    foreach (range(1, 30) as $attempt) {
        $name = GuestNames::random($locale);

        expect($name)->not->toContain(':')
            ->and(mb_strlen($name))->toBeGreaterThan(2)
            ->and(mb_strlen($name))->toBeLessThanOrEqual(50);
    }
})->with('game locales');

it('lets tests replace the word book', function () {
    $book = new GameWordBook(
        words: ['en' => [['word' => 'kite', 'drawable' => true], ['word' => 'scope', 'drawable' => false]]],
        questions: ['en' => ['Why?']],
    );

    expect($book->words('en', drawableOnly: true))->toBe(['kite'])
        ->and($book->words('en', drawableOnly: false))->toBe(['kite', 'scope'])
        ->and($book->questions('en'))->toBe(['Why?']);
});

it('falls back to English for unknown locales', function () {
    expect((new GameWordBook)->words('xx', drawableOnly: false))->toBe((new GameWordBook)->words('en', drawableOnly: false))
        ->and(GuestNames::random('xx'))->not->toBe('');
});
