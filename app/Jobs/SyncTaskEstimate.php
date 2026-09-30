<?php

namespace App\Jobs;

use App\Actions\Integrations\PokerTaskSync;
use App\Actions\Poker\PresentPokerTask;
use App\Events\Poker\PokerTaskSaved;
use App\Models\PokerTask;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\IntegrationErrors;
use App\Support\Integrations\Trackers\EstimateRejected;
use App\Support\Integrations\Trackers\Trackers;
use DateTimeInterface;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Throwable;

/**
 * Writes the current skrum estimate of an imported task to its source
 * (spec 6 §6.5). Unique until it starts, so quick changes coalesce, while a
 * change made during a write still queues the next one. Writes of one task
 * never overlap, so an older estimate cannot reach the source last.
 *
 * Waiting for a running write or for a rate limit releases the job, which
 * uses up an attempt: the five tries of the spec are counted as exceptions,
 * within a time bound instead of an attempt count.
 */
class SyncTaskEstimate implements ShouldBeUniqueUntilProcessing, ShouldQueue
{
    use Queueable;

    public int $maxExceptions = 5;

    public int $uniqueFor = 300;

    /** @var array<int, int> */
    public array $backoff = [10, 30, 120, 600];

    public function __construct(public string $taskId) {}

    public function uniqueId(): string
    {
        return $this->taskId;
    }

    /** @return array<int, object> */
    public function middleware(): array
    {
        return [(new WithoutOverlapping($this->taskId))->releaseAfter(5)->expireAfter(60)];
    }

    public function retryUntil(): DateTimeInterface
    {
        return now()->addHour();
    }

    public function handle(Trackers $trackers): void
    {
        $task = PokerTask::query()->with('game.team.integrations')->find($this->taskId);

        if ($task === null || ! $task->needs_sync || $task->external_source === null || $task->external_id === null) {
            return;
        }

        $sync = PokerTaskSync::for($task->game);
        $reason = $sync->unsupportedReason($task);
        $integration = $sync->integration($task->external_source);

        if ($reason !== null) {
            $this->markUnsupported($task);

            return;
        }

        if ($integration === null) {
            $this->recordFailure($task, __('This task can no longer be synced.'));

            return;
        }

        $estimate = $task->estimate;

        try {
            $trackers->for($integration->provider)->writeEstimate($integration, $task->external_id, $estimate);
        } catch (RateLimited $exception) {
            $this->release($exception->retryAfter);

            return;
        } catch (EstimateRejected $exception) {
            $this->recordFailure($task, $exception->getMessage());

            return;
        } catch (ProviderUnavailable $exception) {
            throw $exception;
        } catch (IntegrationException $exception) {
            $this->recordFailure($task, $exception->userMessage());

            return;
        }

        $this->markSynced($task, $estimate);
    }

    public function failed(?Throwable $exception): void
    {
        $task = PokerTask::query()->find($this->taskId);

        if ($task === null || ! $task->needs_sync) {
            return;
        }

        $this->recordFailure($task, $exception instanceof IntegrationException
            ? $exception->userMessage()
            : __('The estimate could not be written. Try again.'));
    }

    private function markSynced(PokerTask $task, ?string $written): void
    {
        $updated = PokerTask::query()
            ->whereKey($task->id)
            ->when(
                $written === null,
                fn ($query) => $query->whereNull('estimate'),
                fn ($query) => $query->where('estimate', $written),
            )
            ->update(['needs_sync' => false, 'sync_error' => null, 'synced_at' => now()]);

        if ($updated === 0) {
            return;
        }

        $this->broadcast($task->fresh() ?? $task);
    }

    /**
     * The task shows why it cannot be synced (syncState `unsupported`), so
     * it no longer waits for a write that can never succeed.
     */
    private function markUnsupported(PokerTask $task): void
    {
        $task->forceFill(['needs_sync' => false, 'sync_error' => null])->save();

        $this->broadcast($task);
    }

    private function recordFailure(PokerTask $task, string $error): void
    {
        $task->forceFill(['needs_sync' => true, 'sync_error' => IntegrationErrors::sanitize($error)])->save();

        $this->broadcast($task);
    }

    private function broadcast(PokerTask $task): void
    {
        $task->loadCount('rounds');

        $payload = app(PresentPokerTask::class)->handle($task);

        rescue(fn () => broadcast(new PokerTaskSaved($task->poker_game_id, $payload)));
    }
}
