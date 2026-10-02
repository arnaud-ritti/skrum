<?php

namespace App\Support\Auth;

use App\Enums\SecondFactorMethod;
use App\Models\User;

class SecondFactors
{
    /**
     * @return array<int, SecondFactorMethod>
     */
    public function methodsFor(User $user): array
    {
        return array_values(array_filter([
            $this->hasTotp($user) ? SecondFactorMethod::Totp : null,
        ]));
    }

    public function requiredFor(User $user): bool
    {
        return $this->methodsFor($user) !== [];
    }

    public function hasTotp(User $user): bool
    {
        return $user->hasEnabledTwoFactorAuthentication();
    }
}
