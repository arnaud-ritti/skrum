<?php

namespace App\Enums;

enum IntegrationKind: string
{
    case Channel = 'channel';
    case Tracker = 'tracker';
}
