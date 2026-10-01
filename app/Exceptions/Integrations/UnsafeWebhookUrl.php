<?php

namespace App\Support\Integrations\Exceptions;

use App\Enums\IntegrationProvider;

class UnsafeWebhookUrl extends IntegrationException
{
    public function __construct()
    {
        parent::__construct(IntegrationProvider::Webhook);
    }

    public function status(): int
    {
        return 422;
    }

    public function userMessage(): string
    {
        return __('This webhook URL points to a private or invalid address.');
    }
}
