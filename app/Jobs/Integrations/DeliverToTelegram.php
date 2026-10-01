<?php

namespace App\Jobs\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Telegram\TelegramClient;

class DeliverToTelegram extends DeliverToChannel
{
    public function __construct(string $deliveryId, public string $html, string $locale)
    {
        parent::__construct($deliveryId, $locale);
    }

    protected function provider(): IntegrationProvider
    {
        return IntegrationProvider::Telegram;
    }

    protected function send(TeamIntegration $integration): void
    {
        resolve(TelegramClient::class)->sendMessageTo($integration, $this->html);
    }
}
