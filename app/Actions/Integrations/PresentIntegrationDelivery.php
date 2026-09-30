<?php

namespace App\Actions\Integrations;

use App\Models\IntegrationDelivery;

/**
 * @phpstan-type Delivery array{
 *     id: string,
 *     channel: string,
 *     kind: string,
 *     status: string,
 *     error: ?string,
 *     sentAt: ?string,
 *     createdAt: ?string,
 *     requestedBy: ?string,
 *     recipientCount: ?int
 * }
 */
class PresentIntegrationDelivery
{
    /**
     * @return Delivery
     */
    public function handle(IntegrationDelivery $delivery): array
    {
        return [
            'id' => $delivery->id,
            'channel' => $delivery->channel->value,
            'kind' => $delivery->kind->value,
            'status' => $delivery->status->value,
            'error' => $delivery->error,
            'sentAt' => $delivery->sent_at?->toIso8601String(),
            'createdAt' => $delivery->created_at?->toIso8601String(),
            'requestedBy' => $delivery->requestedBy?->name,
            'recipientCount' => $delivery->recipient_count,
        ];
    }
}
