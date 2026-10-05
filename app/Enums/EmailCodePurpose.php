<?php

namespace App\Enums;

enum EmailCodePurpose: string
{
    case Login = 'login';
    case Enable = 'enable';
    case Confirm = 'confirm';
}
