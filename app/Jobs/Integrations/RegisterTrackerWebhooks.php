<?php

namespace App\Jobs\Integrations;

use App\Enums\IntegrationWebhookStatus;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\IntegrationErrors;
use App\Support\Integrations\StatusSync;
use App\Support\Integrations\TrackerWebhooks;
use DateTimeInterface;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Registers the connection's webhooks when its projects changed (or none
 * exist yet) and refreshes Jira Cloud ones close to expiry (spec 8 §5.3).
 * An expired or failing webhook is registered anew, and an admin's
 * request always registers. A rejection (4xx) is final for a day or until
 * the projects change; three other failures mark the webhook failing;
 * rate limits and overlapping runs release the job without counting.
 */
class RegisterTrackerWebhooks implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public const RetryMinutes = 30;

    public int $maxExceptions = 3;

    /** Longer than the retry window, so a released run keeps its lock. */
    public int $uniqueFor = 2100;

    /** @var array<int, int> */
    public array $backoff = [30, 120];

    public function __construct(public string $integrationId, public bool $force = false) {}

    /**
     * An admin's forced registration is never swallowed by a pending
     * automatic one.
     */
    public function uniqueId(): string
    {
        return $this->force ? "{$this->integrationId}:force" : $this->integrationId;
    }

    /** @return array<int, object> */
    public function middleware(): array
    {
        return [(new WithoutOverlapping("tracker-webhooks:{$this->integrationId}"))->releaseAfter(30)->expireAfter(120)];
    }

    public function retryUntil(): DateTimeInterface
    {
        return now()->addMinutes(self::RetryMinutes);
    }

    public function handle(TrackerWebhooks $webhooks): void
    {
        $integration = TeamIntegration::query()->find($this->integrationId);

        if ($integration === null || ! $webhooks->canRegister($integration)) {
            return;
        }

        try {
            $this->registerOrRefresh($integration, $webhooks);
        } catch (RateLimited $exception) {
            $this->release($exception->retryAfter);
        } catch (ReconnectRequired) {
            return;
        } catch (ProviderRejected $exception) {
            $this->rejected($integration, $webhooks, $exception);
        }
    }

    public function failed(?Throwable $exception): void
    {
        $integration = TeamIntegration::query()->find($this->integrationId);

        if ($integration === null || ! StatusSync::isOn($integration)) {
            return;
        }

        resolve(TrackerWebhooks::class)->recordRejection($integration);
        $integration->forceFill(['webhook_status' => IntegrationWebhookStatus::Failing])->save();
    }

    private function registerOrRefresh(TeamIntegration $integration, TrackerWebhooks $webhooks): void
    {
        if ($this->force) {
            $webhooks->register($integration);

            return;
        }

        if (! $webhooks->isCurrent($integration)) {
            if (! $webhooks->isBackedOff($integration)) {
                $webhooks->register($integration);
            }

            return;
        }

        if (! $webhooks->expiresSoon($integration)) {
            return;
        }

        try {
            $webhooks->refresh($integration);
        } catch (ProviderRejected) {
            $webhooks->register($integration);
        }
    }

    private function rejected(TeamIntegration $integration, TrackerWebhooks $webhooks, ProviderRejected $exception): void
    {
        Log::warning('Registering tracker webhooks was rejected.', [
            'integration' => $integration->id,
            'provider' => $integration->provider->value,
            'status' => $exception->httpStatus,
            'detail' => IntegrationErrors::sanitize($exception->detail() ?? class_basename($exception)),
        ]);

        $webhooks->recordRejection($integration);
        $integration->forceFill(['webhook_status' => IntegrationWebhookStatus::Failing])->save();
    }
}
