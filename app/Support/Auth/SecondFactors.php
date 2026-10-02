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
            $this->hasEmailCode($user) ? SecondFactorMethod::EmailCode : null,
        ]));
    }

    public function hasEmailCode(User $user): bool
    {
        return $user->two_factor_email_enabled_at !== null;
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
