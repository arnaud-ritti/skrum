<?php

namespace App\Support\Integrations;

class IntegrationAvailability
{
    private const NonDeliveringMailers = ['log', 'array'];

    public function emailEnabled(): bool
    {
        return ! in_array(config('mail.default'), self::NonDeliveringMailers, true);
    }
}
