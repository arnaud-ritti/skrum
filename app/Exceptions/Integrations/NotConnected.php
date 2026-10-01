<?php

namespace App\Support\Integrations\Exceptions;

class NotConnected extends IntegrationException
{
    public function status(): int
    {
        return 409;
    }

    public function userMessage(): string
    {
        return __('Connect :provider in the team settings.', ['provider' => $this->provider->label()]);
    }
}
