<?php

namespace App\Jobs\Integrations;

use App\Actions\ActionItems\BroadcastActionItemChange;
use App\Actions\Integrations\LinkStatusSync;
use App\Enums\ExternalIssueState;
use App\Enums\IntegrationStatus;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReadOnlyConnection;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Exceptions\StatusPushRejected;
use App\Support\Integrations\IntegrationErrors;
use App\Support\Integrations\Trackers\DoneMapping;
use App\Support\Integrations\Trackers\TrackerIssue;
use App\Support\Integrations\Trackers\Trackers;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use DateTimeInterface;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Writes the item's current open/done state to its linked issue (spec 8
 * §5.6). It reads the item when it runs, so quick toggles coalesce and the
 * last state wins; pushes of one link never overlap. Waiting for another
 * push or a rate limit releases the job: the five tries are counted as
 * exceptions within an hour, as for estimate write-backs. Write failures
 * other than the §5.2 reasons read as a failed write plus the provider's
 * detail (§11).
 */
class PushActionItemState implements ShouldBeUniqueUntilProcessing, ShouldQueue
{
    use Queueable;

    public int $maxExceptions = 5;

    public int $uniqueFor = 300;

    /** @var array<int, int> */
    public array $backoff = [10, 30, 120, 600];

    public string $requestedAt;

    public function __construct(public string $linkId)
    {
        $this->requestedAt = now()->toIso8601String();
    }

    public function uniqueId(): string
    {
        return $this->linkId;
    }

    /** @return array<int, object> */
    public function middleware(): array
    {
        return [(new WithoutOverlapping("action-item-link:{$this->linkId}"))->releaseAfter(10)->expireAfter(120)];
    }

    public function retryUntil(): DateTimeInterface
    {
        return now()->addHour();
    }

    public function handle(Trackers $trackers, BroadcastActionItemChange $broadcast): void
    {
        $pushedAt = now();
        $link = ActionItemExternalLink::query()->with('actionItem.team')->find($this->linkId);

        if ($link === null || $link->external_id === '') {
            return;
        }

        $item = $link->actionItem;
        $integration = LinkStatusSync::integration($link, $item->team);

        if ($integration === null) {
            return;
        }

        if ($integration->status === IntegrationStatus::ReconnectRequired) {
            $this->recordFailure((new ReconnectRequired($integration->provider))->userMessage());
            $this->announce($broadcast, $item);

            return;
        }

        if (! $integration->isActive()) {
            return;
        }

        if (! $integration->canWrite()) {
            $this->recordFailure((new ReadOnlyConnection($integration->provider))->userMessage());
            $this->announce($broadcast, $item);

            return;
        }

        $target = $item->isCompleted() ? ExternalIssueState::Done : ExternalIssueState::Open;

        try {
            $issue = $trackers->syncing($integration->provider)->transition($integration, $link->external_id, $target);
        } catch (RateLimited $exception) {
            $this->release($exception->retryAfter);

            return;
        } catch (ProviderUnavailable $exception) {
            throw $exception;
        } catch (IntegrationException $exception) {
            $this->recordFailure(self::failureMessage($exception));
            $this->announce($broadcast, $item);

            return;
        }

        $this->recordOutcome($integration, $target, $issue, $pushedAt);
        $this->announce($broadcast, $item);
    }

    /**
     * A job that fails after a newer push of the same link succeeded is
     * stale: its error would hide that success.
     */
    public function failed(?Throwable $exception): void
    {
        $lastPushedAt = ActionItemExternalLink::query()->whereKey($this->linkId)->value('last_pushed_at');

        if ($lastPushedAt !== null && CarbonImmutable::parse($lastPushedAt)->isAfter(CarbonImmutable::parse($this->requestedAt))) {
            return;
        }

        $this->recordFailure($exception instanceof IntegrationException
            ? self::failureMessage($exception)
            : __('The status could not be written. Try again.'));

        $item = ActionItemExternalLink::query()->find($this->linkId)?->actionItem;

        if ($item !== null) {
            $this->announce(app(BroadcastActionItemChange::class), $item);
        }
    }

    /**
     * The push time is when the item was read, so a change made while the
     * provider was called still counts as unpushed. An issue whose status
     * cannot be read is found, but nothing was written to it.
     */
    private function recordOutcome(TeamIntegration $integration, ExternalIssueState $target, ?TrackerIssue $issue, CarbonInterface $pushedAt): void
    {
        DB::transaction(function () use ($integration, $target, $issue, $pushedAt): void {
            $link = ActionItemExternalLink::query()->whereKey($this->linkId)->lockForUpdate()->first();

            if ($link === null) {
                return;
            }

            if ($issue === null) {
                $link->forceFill(['missing_at' => $link->missing_at ?? now(), 'sync_error' => null])->save();

                return;
            }

            if ($issue->issueStatus === null) {
                $link->forceFill(['missing_at' => null])->save();

                return;
            }

            $link->forceFill([
                'last_pushed_state' => $target,
                'last_pushed_at' => $pushedAt,
                'external_state' => DoneMapping::state($integration, $issue->issueStatus),
                'external_status_name' => $issue->status,
                'external_updated_at' => $issue->issueStatus->updatedAt,
                'last_synced_at' => now(),
                'sync_error' => null,
                'missing_at' => null,
            ])->save();
        });
    }

    private static function failureMessage(IntegrationException $exception): string
    {
        if ($exception instanceof StatusPushRejected || $exception instanceof ReconnectRequired || $exception instanceof ReadOnlyConnection) {
            return $exception->userMessage();
        }

        $message = __('The status could not be written. Try again.');
        $detail = $exception->detail();

        return $detail === null ? $message : "{$message} ({$detail})";
    }

    private function recordFailure(string $message): void
    {
        ActionItemExternalLink::query()->whereKey($this->linkId)->update(['sync_error' => IntegrationErrors::sanitize($message)]);
    }

    private function announce(BroadcastActionItemChange $broadcast, ActionItem $item): void
    {
        rescue(function () use ($broadcast, $item): void {
            $fresh = $item->fresh() ?? $item;

            $broadcast->saved($fresh);
            $broadcast->externalLinksChanged($fresh);
        });
    }
}
