<?php

namespace App\Support\Integrations\Webhook;

class WebhookRequest
{
    /**
     * @param  array<string, string>  $headers
     */
    public function __construct(
        public array $headers,
        public string $body,
    ) {}
}
