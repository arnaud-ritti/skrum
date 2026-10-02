<?php

namespace App\Rules;

use App\Models\User;
use App\Support\Auth\LoginAddress;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class UniqueEmailAddress implements ValidationRule
{
    public function __construct(private ?User $owner = null) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            return;
        }

        if ($this->owner !== null && LoginAddress::normalise($this->owner->email) === LoginAddress::normalise($value)) {
            return;
        }

        $isTaken = User::query()
            ->whereAddress($value)
            ->when($this->owner !== null, fn ($query) => $query->whereKeyNot($this->owner->getKey()))
            ->exists();

        if ($isTaken) {
            $fail('validation.unique')->translate();
        }
    }
}
