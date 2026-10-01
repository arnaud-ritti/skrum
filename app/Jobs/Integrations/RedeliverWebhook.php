<?php

namespace App\Jobs\Integrations;

use App\Models\IntegrationDelivery;
use App\Models\IntegrationDeliveryPayload;
use App\Support\Integrations\Exceptions\WebhookContentMissing;
use App\Support\Integrations\Webhook\WebhookMessage;

/**
 * Sends a stored webhook message again (webhook redelivery spec §4.2).
 * Only the delivery id travels through the queue; the message is read
 * from the delivery's encrypted payload when the job runs.
 */
class RedeliverWebhook extends DeliverToChannel
{
    use SendsToWebhook;

    protected function message(): WebhookMessage
    {
        $payload = IntegrationDeliveryPayload::query()->where('integration_delivery_id', $this->deliveryId)->first();

        if ($payload === null) {
            throw new WebhookContentMissing;
        }

        $message = $payload->message;

        return new WebhookMessage($message['id'], $message['event'], $message['occurredAt'], $message['data'], redelivery: true);
    }

    protected function announce(IntegrationDelivery $delivery): void {}
}
