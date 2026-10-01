<?php

namespace App\Actions\Integrations;

use App\Models\IntegrationDelivery;
use InvalidArgumentException;

class PresentWebhookDeliveryPayload
{
    /**
     * @return array{
     *     id: string,
     *     event: string|null,
     *     status: string,
     *     attempts: int,
     *     redeliveryOf: string|null,
     *     request: array{headers: array<string, string>, body: string|null},
     *     response: array{status: int|null, excerpt: string|null}
     * }
     */
    public function handle(IntegrationDelivery $delivery): array
    {
        $payload = $delivery->payload ?? throw new InvalidArgumentException('The delivery has no stored content.');
        $excerpt = $payload->response_excerpt;

        return [
            'id' => $delivery->id,
            'event' => $delivery->event,
            'status' => $delivery->status->value,
            'attempts' => $delivery->attempts,
            'redeliveryOf' => $delivery->redelivery_of_id,
            'request' => [
                'headers' => $payload->request_headers ?? [],
                'body' => $payload->request_body,
            ],
            'response' => [
                'status' => $payload->response_status,
                'excerpt' => $excerpt === null ? null : mb_scrub($excerpt, 'UTF-8'),
            ],
        ];
    }
}
