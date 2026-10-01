<?php

namespace App\Exceptions\Integrations;

use App\Enums\IntegrationProvider;

class RateLimited extends IntegrationException
{
    public function __construct(IntegrationProvider $provider, public int $retryAfter, ?string $detail = null)
    {
        parent::__construct($provider, $detail);
    }

    public function status(): int
    {
        return 429;
    }

    public function userMessage(): string
    {
        return __('Too many requests to :provider, wait a moment.', ['provider' => $this->provider->label()]);
    }
}
