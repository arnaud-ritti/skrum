<?php

namespace App\Jobs\Integrations;

use App\Enums\IntegrationWebhookStatus;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\StatusSync;
use App\Support\Integrations\TrackerWebhooks;
use DateTimeInterface;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Throwable;

/**
 * Registers the connection's webhooks when its projects changed (or none
 * exist yet) and refreshes Jira Cloud ones close to expiry (spec 8 §5.3).
 * Three failures mark the webhook failing; rate limits and overlapping
 * runs release the job without counting as one.
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

    public function __construct(public string $integrationId) {}

    public function uniqueId(): string
    {
        return $this->integrationId;
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
            if (! $webhooks->isCurrent($integration)) {
                $webhooks->register($integration);

                return;
            }

            if ($webhooks->expiresSoon($integration)) {
                $webhooks->refresh($integration);
            }
        } catch (RateLimited $exception) {
            $this->release($exception->retryAfter);
        } catch (ReconnectRequired) {
            return;
        }
    }

    public function failed(?Throwable $exception): void
    {
        $integration = TeamIntegration::query()->find($this->integrationId);

        if ($integration === null || ! StatusSync::isOn($integration)) {
            return;
        }

        $integration->forceFill(['webhook_status' => IntegrationWebhookStatus::Failing])->save();
    }
}
