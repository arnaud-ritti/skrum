<?php

namespace App\Support\Integrations\Webhook;

/**
 * A webhook URL whose every resolved address passed the safety check; the
 * request is pinned to `address` so DNS cannot change between check and send.
 */
class WebhookTarget
{
    public function __construct(
        public string $url,
        public string $host,
        public int $port,
        public string $address,
        public ?string $urlHost = null,
    ) {}

    public function pinnedResolve(): ?string
    {
        if (filter_var($this->host, FILTER_VALIDATE_IP) !== false) {
            return null;
        }

        $address = str_contains($this->address, ':') ? "[{$this->address}]" : $this->address;

        $pinnedHost = $this->urlHost ?? $this->host;

        return "{$pinnedHost}:{$this->port}:{$address}";
    }
}
