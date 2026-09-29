<?php

namespace App\Enums;

enum SignupMode: string
{
    case Open = 'open';
    case Invite = 'invite';
    case Domain = 'domain';

    public static function fromConfig(): self
    {
        return self::tryFrom((string) config('skrum.signup_mode')) ?? self::Invite;
    }
}
