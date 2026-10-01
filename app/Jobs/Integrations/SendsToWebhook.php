<?php

namespace App\Jobs\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\IntegrationDelivery;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\Exceptions\WebhookContentMissing;
use App\Support\Integrations\Exceptions\WebhookDisabled;
use App\Support\Integrations\Webhook\WebhookClient;
use App\Support\Integrations\Webhook\WebhookHealth;
use App\Support\Integrations\Webhook\WebhookMessage;
use Throwable;

/**
 * Posts one message to the team's generic webhook; the URL and secret are
 * read from the database at run time. A delivery that ends failed while
 * the webhook is active counts toward the automatic disabling (spec 8 §4.7).
 */
trait SendsToWebhook
{
    abstract protected function message(): WebhookMessage;

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
        $message = $this->message();
        $delivery = IntegrationDelivery::query()->with('payload')->findOrFail($this->deliveryId);

        app(WebhookClient::class)->send($integration, $message, $delivery);
    }

    protected function afterFailure(IntegrationDelivery $delivery, ?Throwable $exception): void
    {
        if ($exception instanceof NotConnected || $exception instanceof WebhookDisabled || $exception instanceof WebhookContentMissing) {
            return;
        }

        $integration = $delivery->team->integration(IntegrationProvider::Webhook);

        if ($integration === null) {
            return;
        }

        app(WebhookHealth::class)->failed($integration);
    }
}
