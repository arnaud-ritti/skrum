<?php

namespace App\Actions\Integrations;

use App\Models\IntegrationDelivery;

class PresentWebhookDelivery
{
    /**
     * @return array{
     *     id: string,
     *     event: string|null,
     *     kind: string,
     *     status: string,
     *     attempts: int,
     *     responseStatus: int|null,
     *     error: string|null,
     *     createdAt: string|null,
     *     lastAttemptAt: string|null,
     *     hasContent: bool,
     *     redeliveryOf: string|null
     * }
     */
    public function handle(IntegrationDelivery $delivery): array
    {
        return [
            'id' => $delivery->id,
            'event' => $delivery->event,
            'kind' => $delivery->kind->value,
            'status' => $delivery->status->value,
            'attempts' => $delivery->attempts,
            'responseStatus' => $delivery->response_status,
            'error' => $delivery->error,
            'createdAt' => $delivery->created_at?->toIso8601String(),
            'lastAttemptAt' => $delivery->last_attempt_at?->toIso8601String(),
            'hasContent' => $this->hasContent($delivery),
            'redeliveryOf' => $delivery->redelivery_of_id,
        ];
    }

    private function hasContent(IntegrationDelivery $delivery): bool
    {
        $exists = $delivery->getAttribute('payload_exists');

        if ($exists === null) {
            return $delivery->payload()->exists();
        }

        return (bool) $exists;
    }
}
