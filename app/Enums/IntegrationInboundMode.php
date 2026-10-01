<?php

namespace App\Enums;

enum IntegrationInboundMode: string
{
    case Webhook = 'webhook';
    case Polling = 'polling';
    case Off = 'off';
}
