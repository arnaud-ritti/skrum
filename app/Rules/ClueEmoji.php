<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\Validator;

/**
 * A Decoded clue item: one emoji (spec 1's SingleEmoji) that does not spell
 * the answer — no keycaps, flags or letter and digit buttons (spec §4.4).
 */
class ClueEmoji implements ValidationRule
{
    private const string LetterLike = '/\p{Regional_Indicator}|\x{20E3}|[\x{1F170}\x{1F171}\x{1F17E}\x{1F17F}\x{1F18E}\x{1F191}-\x{1F19A}\x{2139}\x{24C2}\x{1F520}-\x{1F522}\x{1F524}\x{1F51F}\x{2122}]/u';

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            $fail(__('Use emoji only, without letters or digits.'));

            return;
        }

        $isSingleEmoji = Validator::make(['emoji' => $value], ['emoji' => [new SingleEmoji]])->passes();

        if (! $isSingleEmoji || preg_match(self::LetterLike, $value) === 1) {
            $fail(__('Use emoji only, without letters or digits.'));
        }
    }
}
