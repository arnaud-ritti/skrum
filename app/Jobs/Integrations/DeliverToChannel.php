<?php

namespace App\Jobs\Integrations;

use App\Contracts\DeliverySubject;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Models\IntegrationDelivery;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Traits\Localizable;
use Throwable;

/**
 * Posts one pre-built message. The connection's secrets are read from the
 * database at run time, so neither the payload nor a failed-job record
 * ever holds them.
 */
abstract class DeliverToChannel implements ShouldBeEncrypted, ShouldQueue
{
    use Localizable;
    use Queueable;

    public int $tries = 4;

    public function __construct(public string $deliveryId, public string $locale) {}

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [10, 60, 300];
    }

    abstract protected function provider(): IntegrationProvider;

    abstract protected function send(TeamIntegration $integration): void;

    public function handle(): void
    {
        $delivery = $this->pendingDelivery();

        if ($delivery === null) {
            return;
        }

        try {
            $integration = $this->integration($delivery);
            $this->send($integration);
        } catch (RateLimited $exception) {
            $this->release($exception->retryAfter);

            return;
        } catch (ProviderUnavailable $exception) {
            throw $exception;
        } catch (IntegrationException $exception) {
            $this->finishFailed($delivery, $exception);
            $this->fail($exception);

            return;
        }

        $integration->markChecked();
        $delivery->markSent();
        $this->announce($delivery);
    }

    public function failed(?Throwable $exception): void
    {
        $delivery = $this->pendingDelivery();

        if ($delivery === null) {
            return;
        }

        $this->finishFailed($delivery, $exception);
    }

    private function pendingDelivery(): ?IntegrationDelivery
    {
        $delivery = IntegrationDelivery::query()->with('team')->find($this->deliveryId);

        if ($delivery === null || $delivery->status !== IntegrationDeliveryStatus::Queued) {
            return null;
        }

        return $delivery;
    }

    private function integration(IntegrationDelivery $delivery): TeamIntegration
    {
        $provider = $this->provider();
        $integration = $provider->isEnabled() ? $delivery->team->integration($provider) : null;

        if ($integration === null) {
            throw new NotConnected($provider);
        }

        $integration->ensureActive();

        return $integration;
    }

    private function finishFailed(IntegrationDelivery $delivery, ?Throwable $exception): void
    {
        $message = $this->withLocale($this->locale, fn (): string => $exception instanceof IntegrationException
            ? $exception->userMessage()
            : __('The message could not be delivered.'));

        $delivery->markFailed($message);
        $this->announce($delivery);
    }

    private function announce(IntegrationDelivery $delivery): void
    {
        $subject = $delivery->subject;

        if ($subject instanceof DeliverySubject) {
            $subject->announceDeliveryChange();
        }
    }
}
