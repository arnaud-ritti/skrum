<?php

namespace App\Jobs\Integrations;

use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\TrackerWebhooks;
use DateTimeInterface;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;

/**
 * Deletes webhooks after sync was turned off (spec 8 §5.3), best effort:
 * a leftover webhook only delivers events skrum ignores. Runs even with
 * sync off — that is when it is needed — but never next to a registration
 * of the same connection.
 */
class RemoveTrackerWebhooks implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public const RetryMinutes = 30;

    public int $maxExceptions = 3;

    /** Longer than the retry window, so a released run keeps its lock. */
    public int $uniqueFor = 2100;

    /** @var array<int, int> */
    public array $backoff = [30, 120];

    /**
     * @param  array<int, string>  $webhookIds
     */
    public function __construct(public string $integrationId, public array $webhookIds) {}

    public function uniqueId(): string
    {
        $ids = $this->webhookIds;
        sort($ids);
        $joinedIds = implode(',', $ids);

        return "{$this->integrationId}:{$joinedIds}";
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

        if ($integration === null || ! $integration->provider->isEnabled() || ! $integration->isActive()) {
            return;
        }

        try {
            $webhooks->remove($integration, $this->webhookIds);
        } catch (RateLimited $exception) {
            $this->release($exception->retryAfter);
        } catch (ReconnectRequired) {
            return;
        }
    }
}
