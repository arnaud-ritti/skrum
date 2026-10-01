<?php

namespace App\Jobs\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\IntegrationDelivery;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\Exceptions\WebhookDisabled;
use App\Support\Integrations\Webhook\WebhookClient;
use App\Support\Integrations\Webhook\WebhookHealth;
use App\Support\Integrations\Webhook\WebhookMessage;
use Throwable;

/**
 * Posts one pre-built webhook body; the URL and secret are read from the
 * database at run time. A delivery that ends failed while the webhook is
 * active counts toward the automatic disabling (spec 8 §4.7).
 */
class DeliverToWebhook extends DeliverToChannel
{
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

    protected function provider(): IntegrationProvider
    {
        return IntegrationProvider::Webhook;
    }

    protected function integration(IntegrationDelivery $delivery): TeamIntegration
    {
        $integration = IntegrationProvider::Webhook->isEnabled() ? $delivery->team->integration(IntegrationProvider::Webhook) : null;

        if ($integration === null) {
            throw new NotConnected(IntegrationProvider::Webhook);
        }

        if (! $integration->isActive()) {
            throw new WebhookDisabled;
        }

        return $integration;
    }

    protected function send(TeamIntegration $integration): void
    {
        app(WebhookClient::class)->send(
            $integration,
            new WebhookMessage($this->deliveryId, $this->event, $this->occurredAt, $this->data),
            IntegrationDelivery::query()->findOrFail($this->deliveryId),
        );
    }

    protected function afterFailure(IntegrationDelivery $delivery, ?Throwable $exception): void
    {
        if ($exception instanceof NotConnected || $exception instanceof WebhookDisabled) {
            return;
        }

        $integration = $delivery->team->integration(IntegrationProvider::Webhook);

        if ($integration === null) {
            return;
        }

        app(WebhookHealth::class)->failed($integration);
    }
}
