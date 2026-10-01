<?php

namespace App\Jobs\Integrations;

use App\Actions\Integrations\ApplyIssueChanges;
use App\Actions\Integrations\TrackedIssues;
use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationWebhookStatus;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\IntegrationErrors;
use App\Support\Integrations\IntegrationPolls;
use App\Support\Integrations\StatusSync;
use App\Support\Integrations\Trackers\Trackers;
use App\Support\Integrations\TrackerWebhooks;
use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Log;

/**
 * Spec 8 §5.4: an incremental poll (issues updated since the cursor minus
 * two minutes), or a full read of every tracked issue that also detects
 * deletions — daily, and when sync is turned on (the source then wins).
 * Reads of one connection never overlap. A failed incremental poll waits
 * for the next interval with its cursor kept; a failed full read is
 * released and retried; a source-wins read that still fails is queued
 * again by the poll until it completes, so it is never lost.
 */
class ReadTrackedIssues implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public const SilentWebhookHours = 24;

    public const RetryMinutes = 15;

    public const RetryAfterErrorSeconds = 60;

    public int $maxExceptions = 1;

    /** Longer than the retry window, so a released read keeps its lock. */
    public int $uniqueFor = 1200;

    public int $timeout = 300;

    public function __construct(public string $integrationId, public bool $full = false, public bool $initial = false) {}

    /**
     * The first read after sync is turned on lets the source win, so a
     * pending daily full read must never swallow it.
     */
    public function uniqueId(): string
    {
        $kind = match (true) {
            $this->initial => 'initial',
            $this->full => 'full',
            default => 'changes',
        };

        return "{$this->integrationId}:{$kind}";
    }

    /** @return array<int, object> */
    public function middleware(): array
    {
        return [(new WithoutOverlapping("tracked-issues:{$this->integrationId}"))->releaseAfter(30)->expireAfter(600)];
    }

    public function retryUntil(): DateTimeInterface
    {
        return now()->addMinutes(self::RetryMinutes);
    }

    public function handle(Trackers $trackers, TrackedIssues $trackedIssues, ApplyIssueChanges $applyIssueChanges, TrackerWebhooks $trackerWebhooks): void
    {
        $integration = TeamIntegration::query()->find($this->integrationId);

        if ($integration === null || ! $integration->provider->isEnabled() || ! $integration->isActive() || ! StatusSync::isOn($integration)) {
            return;
        }

        $startedAt = now();
        $pendingSince = $this->initial ? $integration->setting(StatusSync::InitialReadPending) : null;
        $ids = $trackedIssues->ids($integration);

        try {
            if ($ids !== []) {
                $this->read($integration, $ids, $trackers, $applyIssueChanges);
            }
        } catch (RateLimited $exception) {
            $this->postpone($integration, $exception->retryAfter);

            return;
        } catch (ReconnectRequired) {
            return;
        } catch (IntegrationException $exception) {
            Log::warning('Reading tracked issues failed.', [
                'integration' => $integration->id,
                'provider' => $integration->provider->value,
                'full' => $this->full,
                'detail' => IntegrationErrors::sanitize($exception->detail() ?? class_basename($exception)),
            ]);

            $this->postpone($integration, $this->full ? self::RetryAfterErrorSeconds : IntegrationPolls::intervalMinutes($integration) * 60);

            return;
        }

        $integration->forceFill(['last_polled_at' => now(), 'poll_cursor' => $startedAt])->save();

        StatusSync::finishInitialRead($integration, $pendingSince);

        $trackerWebhooks->registerIfNeeded($integration);
    }

    /**
     * Full reads are retried; polls wait, as the next one reads the same
     * changes from the kept cursor.
     */
    private function postpone(TeamIntegration $integration, int $seconds): void
    {
        if ($this->full) {
            $this->release($seconds);

            return;
        }

        IntegrationPolls::pause($integration->id, $seconds);
    }

    /**
     * @param  array<int, string>  $ids
     */
    private function read(TeamIntegration $integration, array $ids, Trackers $trackers, ApplyIssueChanges $applyIssueChanges): void
    {
        if ($this->full) {
            $issues = $trackers->for($integration->provider)->issues($integration, $ids);
            $applyIssueChanges->handle($integration, $ids, $issues, complete: true, sourceWins: $this->initial);

            return;
        }

        $cursor = $integration->poll_cursor ?? now()->subMinutes(IntegrationPolls::intervalMinutes($integration));
        $since = CarbonImmutable::instance($cursor)->subMinutes(IntegrationPolls::CursorOverlapMinutes);
        $issues = $trackers->syncing($integration->provider)->changedIssues($integration, $ids, $since);

        $applyIssueChanges->handle($integration, array_map('strval', array_keys($issues)), $issues, complete: false);

        $this->watchWebhooks($integration, $issues !== []);
    }

    /**
     * Spec 8 §5.3: source changes while nothing arrived for a day mean the
     * webhook does not reach skrum; the connection then polls at the
     * polling interval until an event arrives again.
     */
    private function watchWebhooks(TeamIntegration $integration, bool $foundChanges): void
    {
        $watched = $integration->inbound_mode === IntegrationInboundMode::Webhook
            && in_array($integration->webhook_status, [IntegrationWebhookStatus::Pending, IntegrationWebhookStatus::Active], true);

        if (! $foundChanges || ! $watched) {
            return;
        }

        $quietSince = $integration->last_inbound_at ?? StatusSync::webhookWatchedSince($integration);

        if ($quietSince !== null && $quietSince->gt(now()->subHours(self::SilentWebhookHours))) {
            return;
        }

        TeamIntegration::query()
            ->whereKey($integration->id)
            ->whereIn('webhook_status', [IntegrationWebhookStatus::Pending->value, IntegrationWebhookStatus::Active->value])
            ->where(fn ($quiet) => $quiet
                ->whereNull('last_inbound_at')
                ->orWhere('last_inbound_at', '<=', now()->subHours(self::SilentWebhookHours)))
            ->update(['webhook_status' => IntegrationWebhookStatus::Failing->value]);
    }
}
