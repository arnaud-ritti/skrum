<?php

namespace App\Actions\Integrations;

use App\Models\IntegrationDelivery;

class StoreWebhookPayload
{
    public const MaxBytes = 524288;

    private const EnvelopeBytes = 4096;

    /**
     * Keeps the message of a generic webhook delivery for viewing and
     * redelivery (webhook redelivery spec §3). The body sent later repeats
     * the message, so a message that would not fit twice, with its
     * envelope, in 512 KB is not kept at all.
     *
     * @param  array{id: string, event: string, occurredAt: string, data: array<string, mixed>}  $message
     */
    public function handle(IntegrationDelivery $delivery, array $message): void
    {
        $size = strlen(json_encode($message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));

        if ($size * 2 + self::EnvelopeBytes > self::MaxBytes) {
            return;
        }

        $delivery->payload()->create(['message' => $message]);
    }
}
