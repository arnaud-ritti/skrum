<?php

namespace App\Jobs\Integrations;

use App\Models\IntegrationDelivery;
use DateTimeInterface;

/**
 * One automatic event (spec 8 §4.7): 7 tries over about 3.5 hours; the
 * subject's viewers are not told, since events are not shares.
 */
class DeliverWebhookEvent extends DeliverToWebhook
{
    public int $maxExceptions = 7;

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [30, 120, 600, 1800, 3600, 7200];
    }

    public function retryUntil(): DateTimeInterface
    {
        return now()->addHours(4);
    }

    protected function announce(IntegrationDelivery $delivery): void {}
}
