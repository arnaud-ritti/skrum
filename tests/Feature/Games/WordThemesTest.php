<?php

use App\Actions\Games\DrawGameWord;
use App\Enums\GameWordTheme;
use App\Models\GameRoom;
use App\Models\GameUsedWord;
use App\Support\Games\GameWordBook;
use Illuminate\Validation\ValidationException;

function themedBook(): GameWordBook
{
    return new GameWordBook(words: ['en' => [
        ['word' => 'pizza', 'drawable' => true, 'theme' => 'food'],
        ['word' => 'taco', 'drawable' => true, 'theme' => 'food'],
        ['word' => 'laptop', 'drawable' => true, 'theme' => 'work'],
        ['word' => 'backlog', 'drawable' => false, 'theme' => 'work'],
    ]]);
}

it('draws only words of the room\'s themes', function () {
    app()->instance(GameWordBook::class, themedBook());
    $room = GameRoom::factory()->create(['word_themes' => ['food']]);

    $words = collect(range(1, 2))->map(fn () => resolve(DrawGameWord::class)->handle($room, drawableOnly: false))->sort()->values()->all();

    expect($words)->toBe(['pizza', 'taco']);
});

it('draws from every word when the room has no theme', function () {
    expect(themedBook()->words('en', drawableOnly: false))->toBe(['pizza', 'taco', 'laptop', 'backlog'])
        ->and(themedBook()->words('en', drawableOnly: true, themes: [GameWordTheme::Work]))->toBe(['laptop']);
});

it('forgets the used words of the themed pool only when it is used up', function () {
    app()->instance(GameWordBook::class, themedBook());
    $room = GameRoom::factory()->create(['word_themes' => ['food']]);
    GameUsedWord::query()->create(['team_id' => $room->team_id, 'locale' => 'en', 'word' => 'laptop']);
    GameUsedWord::query()->create(['team_id' => $room->team_id, 'locale' => 'en', 'word' => 'pizza']);
    GameUsedWord::query()->create(['team_id' => $room->team_id, 'locale' => 'en', 'word' => 'taco']);

    $word = resolve(DrawGameWord::class)->handle($room, drawableOnly: false);

    expect($word)->toBeIn(['pizza', 'taco'])
        ->and(GameUsedWord::query()->where('team_id', $room->team_id)->pluck('word')->sort()->values()->all())
        ->toBe(['laptop', $word]);
});

it('refuses themes that leave no word', function () {
    app()->instance(GameWordBook::class, themedBook());
    $room = GameRoom::factory()->create(['word_themes' => ['nature']]);

    resolve(DrawGameWord::class)->handle($room, drawableOnly: true);
})->throws(ValidationException::class, 'No word fits these themes.');

it('gives every word of every locale a theme, the same partition in each locale', function (string $locale) {
    $counts = collect((new GameWordBook)->entries($locale))
        ->groupBy(fn (array $entry): string => $entry['theme'].($entry['drawable'] ? ':drawable' : ':abstract'))
        ->map->count()
        ->sortKeys()
        ->all();

    expect($counts)->toBe([
        'food:drawable' => 18,
        'nature:drawable' => 37,
        'objects:drawable' => 82,
        'work:abstract' => 90,
        'work:drawable' => 43,
    ]);
})->with(['en', 'fr', 'es', 'de']);
