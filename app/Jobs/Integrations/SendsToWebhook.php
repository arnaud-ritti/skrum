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
    abstract protected function message(IntegrationDelivery $delivery): WebhookMessage;

    protected function provider(): IntegrationProvider
    {
        return IntegrationProvider::Webhook;
    }

    protected function integration(IntegrationDelivery $delivery): TeamIntegration
    {
        $integration = IntegrationProvider::Webhook->isEnabled() ? $delivery->team->integration(IntegrationProvider::Webhook) : null;

        throw_if($integration === null, NotConnected::class, IntegrationProvider::Webhook);

        throw_unless($integration->isActive(), WebhookDisabled::class);

        return $integration;
    }

    protected function send(TeamIntegration $integration): void
    {
        $delivery = IntegrationDelivery::query()->with('payload')->findOrFail($this->deliveryId);

        resolve(WebhookClient::class)->send($integration, $this->message($delivery), $delivery);
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

        resolve(WebhookHealth::class)->failed($integration);
    }
}
