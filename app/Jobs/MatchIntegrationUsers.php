<?php

namespace App\Jobs;

use App\Actions\Integrations\MatchIntegrationUserAccounts;
use App\Exceptions\Integrations\IntegrationException;
use App\Exceptions\Integrations\ProviderUnavailable;
use App\Exceptions\Integrations\RateLimited;
use App\Models\TeamIntegration;
use DateTimeInterface;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

class MatchIntegrationUsers implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    private const int RunningSeconds = 900;

    /**
     * Rate-limit waits release the job without counting: only real failures use up the three attempts.
     */
    public int $maxExceptions = 3;

    public int $timeout = 300;

    public int $uniqueFor = self::RunningSeconds;

    public function __construct(public string $integrationId) {}

    public static function start(TeamIntegration $integration): void
    {
        Cache::put(self::runningKey($integration->id), true, self::RunningSeconds);

        dispatch(new self($integration->id));
    }

    public static function isRunning(TeamIntegration $integration): bool
    {
        return Cache::has(self::runningKey($integration->id));
    }

    public function retryUntil(): DateTimeInterface
    {
        return now()->addSeconds(self::RunningSeconds);
    }

    public function uniqueId(): string
    {
        return $this->integrationId;
    }

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [30, 120];
    }

    public function handle(MatchIntegrationUserAccounts $matchAccounts): void
    {
        $integration = TeamIntegration::query()->find($this->integrationId);

        try {
            if ($integration !== null) {
                $matchAccounts->handle($integration);
            }
        } catch (RateLimited $exception) {
            Cache::put(self::runningKey($this->integrationId), true, $exception->retryAfter + self::RunningSeconds);
            $this->release($exception->retryAfter);

            return;
        } catch (ProviderUnavailable $exception) {
            throw $exception;
        } catch (IntegrationException) {
            // A lost access is already recorded on the integration.
        }

        Cache::forget(self::runningKey($this->integrationId));
    }

    public function failed(): void
    {
        Cache::forget(self::runningKey($this->integrationId));
    }

    private static function runningKey(string $integrationId): string
    {
        return "integration-user-matching:{$integrationId}";
    }
}
