<?php

namespace App\Exceptions\Integrations;

class ReconnectRequired extends IntegrationException
{
    public function status(): int
    {
        return 409;
    }

    public function reason(): string
    {
        return 'reconnect_required';
    }

    public function userMessage(): string
    {
        return __('Reconnect :provider in the team settings.', ['provider' => $this->provider->label()]);
    }
}
