<?php

use App\Rules\ClueEmoji;
use Illuminate\Support\Facades\Validator;

function clueEmojiPasses(mixed $value): bool
{
    return Validator::make(['emoji' => $value], ['emoji' => [new ClueEmoji]])->passes();
}

it('accepts pictures', function (string $emoji) {
    expect(clueEmojiPasses($emoji))->toBeTrue();
})->with(['🚀', '🐛', '🔥', '👨‍💻', '👍🏽', '❤️', '🏳️‍🌈', '🔣']);

it('refuses letters, digits and letter-like emoji', function (mixed $value) {
    expect(clueEmojiPasses($value))->toBeFalse();
})->with([
    'keycap one' => '1️⃣',
    'keycap hash' => '#️⃣',
    'flag' => '🇫🇷',
    'regional indicator' => '🇦',
    'blood type A' => '🅰️',
    'blood type B' => '🅱',
    'O button' => '🅾️',
    'P button' => '🅿️',
    'AB button' => '🆎',
    'CL button' => '🆑',
    'OK button' => '🆗',
    'VS button' => '🆚',
    'information' => 'ℹ️',
    'circled M' => 'Ⓜ️',
    'latin capitals' => '🔠',
    'latin small' => '🔡',
    'numbers' => '🔢',
    'latin letters' => '🔤',
    'keycap ten' => '🔟',
    'trade mark' => '™️',
    'letter' => 'a',
    'word' => 'ok',
    'two emoji' => '🚀🚀',
    'not a string' => 7,
]);

it('explains the refusal', function () {
    $validator = Validator::make(['emoji' => '1️⃣'], ['emoji' => [new ClueEmoji]]);

    expect($validator->errors()->first('emoji'))->toBe(__('Use emoji only, without letters or digits.'));
});
