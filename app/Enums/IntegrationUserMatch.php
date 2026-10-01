<?php

namespace App\Enums;

enum IntegrationUserMatch: string
{
    case Email = 'email';
    case Manual = 'manual';
    case Sso = 'sso';
}
