<?php

namespace App\Enums;

enum SignInEntry: string
{
    case Password = 'password';
    case MagicLink = 'magic_link';
    case Sso = 'sso';
}
