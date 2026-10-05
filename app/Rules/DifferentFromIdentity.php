<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Str;

/**
 * A password that is the e-mail, its local part or the name of the account,
 * whatever the case, is the first one an attacker tries.
 */
class DifferentFromIdentity implements ValidationRule
{
    /**
     * @param  array<int, mixed>  $identity  the e-mail and the name of the account
     */
    public function __construct(private array $identity) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            return;
        }

        if (! in_array(mb_strtolower(trim($value)), $this->forbidden(), true)) {
            return;
        }

        $fail(__('Choose a password different from your email and name.'));
    }

    /** @return array<int, string> */
    private function forbidden(): array
    {
        return collect($this->identity)
            ->filter(fn (mixed $part): bool => is_string($part))
            ->map(fn (string $part): string => mb_strtolower(trim($part)))
            ->flatMap(fn (string $part): array => str_contains($part, '@') ? [$part, Str::before($part, '@')] : [$part])
            ->reject(fn (string $part): bool => $part === '')
            ->values()
            ->all();
    }
}
