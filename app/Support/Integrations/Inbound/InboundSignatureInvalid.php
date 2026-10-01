<?php

namespace App\Support\Integrations\Inbound;

use App\Models\TeamIntegration;
use RuntimeException;

class InboundSignatureInvalid extends RuntimeException
{
    public function __construct(public ?TeamIntegration $integration = null)
    {
        parent::__construct('The webhook signature or token did not match.');
    }
}
