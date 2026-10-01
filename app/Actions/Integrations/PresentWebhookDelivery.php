<?php

namespace App\Actions\Integrations;

use App\Models\IntegrationDelivery;
use LogicException;

class PresentWebhookDelivery
{
    /**
     * `redeliverable` follows the delivery's own rules of
     * RequestWebhookRedelivery (content kept, not still being sent); the
     * state of the webhook is left to the caller.
     *
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
     *     redeliverable: bool,
     *     redeliveryOf: string|null
     * }
     */
    public function handle(IntegrationDelivery $delivery): array
    {
        $hasContent = $this->hasContent($delivery);

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
            'hasContent' => $hasContent,
            'redeliverable' => $hasContent && ! $delivery->isStillBeingSent(),
            'redeliveryOf' => $delivery->redelivery_of_id,
        ];
    }

    private function hasContent(IntegrationDelivery $delivery): bool
    {
        $exists = $delivery->getAttribute('payload_exists');

        if ($exists === null) {
            throw new LogicException('Load the delivery with withExists(\'payload\') or loadExists(\'payload\') before presenting it.');
        }

        return (bool) $exists;
    }
}
