<?php

namespace App\Support\Integrations\Exceptions;

use App\Enums\IntegrationProvider;

class ProviderUnavailable extends IntegrationException
{
    public function __construct(IntegrationProvider $provider, ?string $detail = null, public bool $timedOut = false)
    {
        parent::__construct($provider, $detail);
    }

    public function status(): int
    {
        return 502;
    }

    public function userMessage(): string
    {
        return __(':provider did not respond. Try again later.', ['provider' => $this->provider->label()]);
    }
}
