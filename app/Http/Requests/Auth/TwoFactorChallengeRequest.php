<?php

namespace App\Http\Requests\Auth;

use Laravel\Fortify\Http\Requests\TwoFactorLoginRequest;

/**
 * Fortify decrypts the authenticator secret and the recovery codes without
 * checking that they exist. A user whose only factor is the e-mail code has
 * neither: both answers are "no", not a decryption error.
 */
class TwoFactorChallengeRequest extends TwoFactorLoginRequest
{
    public function hasValidCode(): bool
    {
        if ($this->challengedUser()->two_factor_secret === null) {
            return false;
        }

        return (bool) parent::hasValidCode();
    }

    public function validRecoveryCode(): ?string
    {
        if ($this->challengedUser()->two_factor_recovery_codes === null) {
            return null;
        }

        return parent::validRecoveryCode();
    }
}
