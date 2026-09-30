<?php

namespace App\Enums;

enum IntegrationStatus: string
{
    case Active = 'active';
    case SetupRequired = 'setup_required';
    case ReconnectRequired = 'reconnect_required';

    public function label(): string
    {
        return match ($this) {
            self::Active => __('Connected'),
            self::SetupRequired => __('Setup required'),
            self::ReconnectRequired => __('Reconnect required'),
        };
    }
}
