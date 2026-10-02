<?php

namespace App\Exceptions;

use App\Enums\SsoProvider;
use App\Support\Auth\SignInPolicy;
use Exception;

class SsoLoginRefused extends Exception
{
    public static function providerFailed(SsoProvider $provider): self
    {
        return new self(__('Sign-in with :provider failed. Please try again.', ['provider' => $provider->label()]));
    }

    public static function signupsRestricted(): self
    {
        return new self(__('Signups are restricted on this instance.'));
    }

    public static function emailAlreadyUsed(): self
    {
        if (resolve(SignInPolicy::class)->ssoRequired()) {
            return new self(__('An account already uses this email address and could not be matched to your single sign-on identity. Ask an administrator of this instance.'));
        }

        return new self(__('An account already uses this email address. Log in with your password instead.'));
    }

    public static function emailMissing(SsoProvider $provider): self
    {
        return new self(__(':provider did not share an email address with us.', ['provider' => $provider->label()]));
    }

    public static function emailNotVerified(SsoProvider $provider): self
    {
        return new self(__(':provider did not confirm your email address.', ['provider' => $provider->label()]));
    }
}
