<?php

use App\Enums\GameKind;
use App\Models\GameGuess;
use Tests\Concurrency\Support\Race;

it('makes one finder when a correct guess is sent twice at once', function () {
    $table = wordGuessTable(GameKind::DrawAndGuess, 'rocket', ['guessers_total' => 2]);
    $uri = route('games.rounds.guesses.store', [$table['room'], $table['round']], false);
    $userId = $table['guesserUser']->id;

    $outcomes = Race::run([
        static fn (): int => Race::request($userId, 'POST', $uri, ['text' => 'rocket']),
        static fn (): int => Race::request($userId, 'POST', $uri, ['text' => 'rocket']),
    ]);

    expect(collect($outcomes)->pluck('value')->sort()->values()->all())->toBe([200, 409])
        ->and(GameGuess::query()->where('is_correct', true)->count())->toBe(1);
});
