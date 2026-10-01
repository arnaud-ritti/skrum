<?php

namespace App\Exceptions\Integrations;

use App\Enums\IntegrationProvider;

class WebhookContentMissing extends IntegrationException
{
    public function __construct()
    {
        parent::__construct(IntegrationProvider::Webhook);
    }

    public function status(): int
    {
        return 409;
    }

    public function userMessage(): string
    {
        return __('This delivery\'s content is no longer kept.');
    }
}
