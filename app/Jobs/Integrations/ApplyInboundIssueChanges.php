<?php

namespace App\Jobs\Integrations;

use App\Actions\Integrations\ApplyIssueChanges;
use App\Actions\Integrations\TrackedIssues;
use App\Enums\InboundEventStatus;
use App\Exceptions\Integrations\IntegrationException;
use App\Exceptions\Integrations\RateLimited;
use App\Exceptions\Integrations\ReconnectRequired;
use App\Models\IntegrationInboundEvent;
use App\Models\TeamIntegration;
use App\Support\Integrations\IntegrationErrors;
use App\Support\Integrations\StatusSync;
use App\Support\Integrations\Trackers\Trackers;
use DateTimeInterface;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Throwable;

/**
 * Re-reads the issues a webhook named with the connection's own
 * credentials and applies what the source says (spec 8 §5.3, §5.5).
 */
class ApplyInboundIssueChanges implements ShouldBeUniqueUntilProcessing, ShouldQueue
{
    use Queueable;

    public int $maxExceptions = 3;

    public int $uniqueFor = 300;

    /** @var array<int, int> */
    public array $backoff = [10, 60];

    /**
     * @param  array<int, string>  $externalIds
     */
    public function __construct(public string $integrationId, public array $externalIds, public ?string $eventId = null) {}

    public function uniqueId(): string
    {
        $ids = $this->externalIds;
        sort($ids);

        return $this->integrationId.':'.hash('xxh128', implode(',', $ids));
    }

    /** @return array<int, object> */
    public function middleware(): array
    {
        return [new WithoutOverlapping("inbound-issues:{$this->integrationId}")->releaseAfter(5)->expireAfter(120)];
    }

    public function retryUntil(): DateTimeInterface
    {
        return now()->addMinutes(15);
    }

    public function handle(Trackers $trackers, TrackedIssues $trackedIssues, ApplyIssueChanges $applyIssueChanges): void
    {
        $integration = TeamIntegration::query()->find($this->integrationId);

        if ($integration === null || ! $integration->provider->isEnabled() || ! $integration->isActive() || ! StatusSync::isOn($integration)) {
            $this->mark(InboundEventStatus::Ignored);

            return;
        }

        $ids = $trackedIssues->among($integration, $this->externalIds);

        if ($ids === []) {
            $this->mark(InboundEventStatus::Ignored);

            return;
        }

        try {
            $issues = $trackers->for($integration->provider)->issues($integration, $ids);
        } catch (RateLimited $exception) {
            $this->release($exception->retryAfter);

            return;
        } catch (ReconnectRequired $exception) {
            $this->mark(InboundEventStatus::Failed, $exception->userMessage());

            return;
        }

        $applyIssueChanges->handle($integration, $ids, $issues, complete: true);

        $this->mark(InboundEventStatus::Applied);
    }

    public function failed(?Throwable $exception): void
    {
        $this->mark(InboundEventStatus::Failed, $exception instanceof IntegrationException ? $exception->userMessage() : null);
    }

    private function mark(InboundEventStatus $status, ?string $detail = null): void
    {
        if ($this->eventId === null) {
            return;
        }

        IntegrationInboundEvent::query()->whereKey($this->eventId)->update([
            'status' => $status->value,
            'detail' => $detail === null ? null : IntegrationErrors::sanitize($detail),
        ]);
    }
}
