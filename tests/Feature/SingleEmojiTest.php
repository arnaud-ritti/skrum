<?php

use App\Rules\SingleEmoji;
use Illuminate\Support\Facades\Validator;

it('accepts exactly one emoji', function (string $value) {
    expect(Validator::make(['emoji' => $value], ['emoji' => [new SingleEmoji]])->passes())->toBeTrue();
})->with([
    'simple' => '👍',
    'with variation selector' => '❤️',
    'skin tone and zwj' => '👩🏽‍💻',
    'flag' => '🇫🇷',
    'keycap' => '1️⃣',
    'family' => '👨‍👩‍👧‍👦',
]);

it('rejects anything that is not exactly one emoji', function (string $value) {
    $validator = Validator::make(['emoji' => $value], ['emoji' => [new SingleEmoji]]);

    expect($validator->fails())->toBeTrue()
        ->and($validator->errors()->first('emoji'))->toBe('Choose a single emoji.');
})->with([
    'text' => 'ok',
    'two emoji' => '👍👍',
    'emoji and text' => '👍a',
    'trailing newline' => "👍\n",
    'oversized' => str_repeat("\u{200D}", 70),
]);
