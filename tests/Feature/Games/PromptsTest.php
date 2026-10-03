<?php

use App\Support\Games\GameWordBook;
use Illuminate\Support\Str;

it('has at least 60 distinct prompts of at most 200 characters in every locale', function (string $locale) {
    $prompts = (new GameWordBook)->prompts($locale);

    expect(count($prompts))->toBeGreaterThanOrEqual(60)
        ->and(array_unique($prompts))->toHaveCount(count($prompts))
        ->and(collect($prompts)->every(fn (string $prompt): bool => Str::length($prompt) <= 200 && Str::length($prompt) >= 10))->toBeTrue();
})->with(['en', 'fr', 'es', 'de']);

it('has as many prompts in every locale', function () {
    $counts = collect(['en', 'fr', 'es', 'de'])->map(fn (string $locale): int => count((new GameWordBook)->prompts($locale)))->unique();

    expect($counts)->toHaveCount(1);
});
