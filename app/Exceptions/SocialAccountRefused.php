<?php

namespace App\Exceptions;

use App\Enums\SsoProvider;
use Exception;

class SocialAccountRefused extends Exception
{
    public static function linkedElsewhere(SsoProvider $provider): self
    {
        return new self(__('This :provider account is already linked to another account.', ['provider' => $provider->label()]));
    }

    public static function alreadyLinked(SsoProvider $provider): self
    {
        return new self(__('Your account is already linked to :provider. Unlink it first.', ['provider' => $provider->label()]));
    }

    public static function lastWayIn(): self
    {
        return new self(__("You can't unlink your last sign-in method: set a password or link another account first."));
    }

    public static function managed(): self
    {
        return new self(__('This account is managed by your admin.'));
    }
}
