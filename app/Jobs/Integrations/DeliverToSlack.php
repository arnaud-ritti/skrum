<?php

namespace App\Jobs\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Slack\SlackClient;

class DeliverToSlack extends DeliverToChannel
{
    /**
     * @param  array<string, mixed>  $message
     */
    public function __construct(string $deliveryId, public array $message, string $locale)
    {
        parent::__construct($deliveryId, $locale);
    }

    protected function provider(): IntegrationProvider
    {
        return IntegrationProvider::Slack;
    }

    protected function send(TeamIntegration $integration): void
    {
        app(SlackClient::class)->postMessage($integration, $this->message);
    }
}
