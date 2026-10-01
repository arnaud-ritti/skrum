<?php

namespace App\Enums;

enum IntegrationWebhookStatus: string
{
    case Pending = 'pending';
    case Active = 'active';
    case Failing = 'failing';
}
