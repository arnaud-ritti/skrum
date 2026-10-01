<?php

namespace App\Jobs\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Mattermost\MattermostClient;

class DeliverToMattermost extends DeliverToChannel
{
    public function __construct(string $deliveryId, public string $text, string $locale)
    {
        parent::__construct($deliveryId, $locale);
    }

    protected function provider(): IntegrationProvider
    {
        return IntegrationProvider::Mattermost;
    }

    protected function send(TeamIntegration $integration): void
    {
        resolve(MattermostClient::class)->postMessage($integration, $this->text);
    }
}
