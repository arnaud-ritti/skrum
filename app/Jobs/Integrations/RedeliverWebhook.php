<?php

namespace App\Jobs\Integrations;

use App\Models\IntegrationDelivery;
use App\Models\IntegrationDeliveryPayload;
use App\Support\Integrations\Exceptions\WebhookContentMissing;
use App\Support\Integrations\Webhook\WebhookMessage;
use Illuminate\Contracts\Encryption\DecryptException;

/**
 * Sends a stored webhook message again (webhook redelivery spec §4.2).
 * Only the delivery id travels through the queue; the message is read
 * from the delivery's encrypted payload when the job runs.
 *
 * Not ShouldBeUnique: each redelivery row gets exactly one job, queued
 * under the row lock of RequestWebhookRedelivery, and a duplicate run
 * stops at the Queued check of DeliverToChannel.
 */
class RedeliverWebhook extends DeliverToChannel
{
    use SendsToWebhook;

    /**
     * Content that cannot be decrypted any more (the key changed) is
     * content that is no longer kept.
     */
    protected function message(IntegrationDelivery $delivery): WebhookMessage
    {
        $payload = $delivery->payload;

        if ($payload === null) {
            throw new WebhookContentMissing;
        }

        try {
            return $this->storedMessage($payload);
        } catch (DecryptException) {
            throw new WebhookContentMissing;
        }
    }

    private function storedMessage(IntegrationDeliveryPayload $payload): WebhookMessage
    {
        $message = $payload->message;

        return new WebhookMessage($message['id'], $message['event'], $message['occurredAt'], $message['data'], redelivery: true);
    }

    protected function announce(IntegrationDelivery $delivery): void {}
}
