<?php

namespace App\Enums;

enum SecondFactorMethod: string
{
    case Totp = 'totp';
    case EmailCode = 'email';
}
