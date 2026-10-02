<?php

namespace App\Http\Requests\Auth;

use App\Support\Auth\SignInPolicy;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Http\Requests\TwoFactorLoginRequest;

/**
 * Fortify decrypts the authenticator secret and the recovery codes without
 * checking that they exist. A user whose only factor is the e-mail code has
 * neither: both answers are "no", not a decryption error.
 */
class TwoFactorChallengeRequest extends TwoFactorLoginRequest
{
    /**
     * A challenge that a password started ends only for someone who may
     * still use a password: the role is read again here.
     */
    public function challengedUser()
    {
        $user = parent::challengedUser();

        if ($this->session()->get('login.local') === true && ! resolve(SignInPolicy::class)->allowsPassword($user)) {
            $this->session()->forget(['login.id', 'login.remember', 'login.local']);

            throw ValidationException::withMessages(['email' => [trans('auth.failed')]])->redirectTo(route('login'));
        }

        return $user;
    }

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
