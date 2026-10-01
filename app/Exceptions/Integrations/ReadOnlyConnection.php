<?php

namespace App\Support\Integrations\Exceptions;

class ReadOnlyConnection extends IntegrationException
{
    public function status(): int
    {
        return 409;
    }

    public function userMessage(): string
    {
        return __('This :provider connection is read-only.', ['provider' => $this->provider->label()]);
    }
}
