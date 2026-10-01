<?php

namespace App\Jobs\Integrations;

use App\Support\Integrations\Webhook\WebhookMessage;

/**
 * Posts one pre-built webhook body (spec 8 §4.5). The job is encrypted on
 * the queue, so its message never reaches a failed-job record in clear.
 */
class DeliverToWebhook extends DeliverToChannel
{
    use SendsToWebhook;

    /**
     * @param  array<string, mixed>  $data
     */
    public function __construct(
        string $deliveryId,
        public string $event,
        public string $occurredAt,
        public array $data,
        string $locale,
    ) {
        parent::__construct($deliveryId, $locale);
    }

    protected function message(): WebhookMessage
    {
        return new WebhookMessage($this->deliveryId, $this->event, $this->occurredAt, $this->data);
    }
}
