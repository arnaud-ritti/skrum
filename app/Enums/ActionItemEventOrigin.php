<?php

namespace App\Enums;

enum ActionItemEventOrigin: string
{
    case Skrum = 'skrum';
    case External = 'external';
}
