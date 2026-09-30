<?php

use App\Enums\GuessResult;
use App\Support\Games\GuessMatch;

it('matches guesses whatever their case, accents, hyphens and spacing', function (string $word, string $guess) {
    expect(GuessMatch::check($word, $guess))->toBe(GuessResult::Correct);
})->with([
    ['chatbot', 'ChatBot'],
    ['chatbot', '  chatbôt '],
    ['chat-bot', 'chatbot'],
    ['to-do list', 'todo   list'],
    ["l'été", 'LETE'],
    ['Éléphant', 'elephant'],
]);

it('flags a guess one letter away from a short word as very close', function (string $guess, GuessResult $result) {
    expect(GuessMatch::check('kite', $guess))->toBe($result);
})->with([
    ['kit', GuessResult::Near],
    ['bite', GuessResult::Near],
    ['kites', GuessResult::Near],
    ['ki', GuessResult::Wrong],
    ['bike', GuessResult::Wrong],
]);

it('flags a guess one or two letters away from a longer word as very close', function (string $guess, GuessResult $result) {
    expect(GuessMatch::check('sprint', $guess))->toBe($result);
})->with([
    ['print', GuessResult::Near],
    ['sprnt', GuessResult::Near],
    ['spirnt', GuessResult::Near],
    ['spr', GuessResult::Wrong],
    ['planning', GuessResult::Wrong],
]);

it('treats a guess without letters as wrong', function () {
    expect(GuessMatch::check('kite', "--'"))->toBe(GuessResult::Wrong);
});
