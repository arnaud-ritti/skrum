<?php

namespace App\Enums;

enum IntegrationAccess: string
{
    case Read = 'read';
    case Write = 'write';
}
