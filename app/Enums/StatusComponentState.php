<?php

namespace App\Enums;

enum StatusComponentState: string
{
    case Operational = 'operational';
    case Degraded = 'degraded';
    case Down = 'down';
    case NotConfigured = 'not_configured';
    case Maintenance = 'maintenance';
}
