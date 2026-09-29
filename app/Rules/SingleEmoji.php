<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class SingleEmoji implements ValidationRule
{
    public const MaxBytes = 64;

    private const Pattern = '/^(?:\p{Regional_Indicator}{2}|[0-9#*]\x{FE0F}?\x{20E3}|\p{Extended_Pictographic}[\x{FE0F}\x{1F3FB}-\x{1F3FF}\x{E0020}-\x{E007F}]*(?:\x{200D}\p{Extended_Pictographic}[\x{FE0F}\x{1F3FB}-\x{1F3FF}]*)*)\z/u';

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            $fail(__('Choose a single emoji.'));

            return;
        }

        if (strlen($value) > self::MaxBytes) {
            $fail(__('Choose a single emoji.'));

            return;
        }

        if (preg_match(self::Pattern, $value) !== 1) {
            $fail(__('Choose a single emoji.'));
        }
    }
}
