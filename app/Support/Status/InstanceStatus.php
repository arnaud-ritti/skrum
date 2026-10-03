<?php

namespace App\Support\Status;

use App\Enums\StatusComponentState as State;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class InstanceStatus
{
    public const string QueueHeartbeat = 'skrum.heartbeat.queue';

    public const string SchedulerHeartbeat = 'skrum.heartbeat.scheduler';

    private const string CacheProbe = 'skrum.status.probe';

    private const int HealthyMinutes = 3;

    public const int LateMinutes = 15;

    private const float SocketTimeoutSeconds = 1.0;

    /** @return array<int, array{key: string, state: State}> */
    public function check(): array
    {
        $cacheAnswers = $this->cacheAnswers();

        return [
            ['key' => 'application', 'state' => app()->isDownForMaintenance() ? State::Maintenance : State::Operational],
            ['key' => 'database', 'state' => $this->databaseAnswers() ? State::Operational : State::Down],
            ['key' => 'cache', 'state' => $cacheAnswers ? State::Operational : State::Down],
            ['key' => 'queue', 'state' => $cacheAnswers ? $this->heartbeat(self::QueueHeartbeat) : State::Down],
            ['key' => 'scheduler', 'state' => $cacheAnswers ? $this->heartbeat(self::SchedulerHeartbeat) : State::Down],
            ['key' => 'realtime', 'state' => $this->realtime()],
            ['key' => 'mail', 'state' => $this->mail()],
        ];
    }

    /** @param array<int, array{key: string, state: State}> $components */
    public function overall(array $components): string
    {
        $states = array_column($components, 'state');

        if (in_array(State::Maintenance, $states, true)) {
            return 'maintenance';
        }

        if (in_array(State::Down, $states, true)) {
            return 'degraded';
        }

        if (in_array(State::Degraded, $states, true)) {
            return 'degraded';
        }

        return 'operational';
    }

    private function databaseAnswers(): bool
    {
        return rescue(function (): bool {
            User::query()->exists();

            return true;
        }, false, report: false);
    }

    private function cacheAnswers(): bool
    {
        return rescue(function (): bool {
            $probe = Str::random(16);

            Cache::put(self::CacheProbe, $probe, 60);

            return Cache::get(self::CacheProbe) === $probe;
        }, false, report: false);
    }

    private function heartbeat(string $key): State
    {
        $beat = rescue(fn (): mixed => Cache::get($key), null, report: false);

        if (! is_string($beat)) {
            return State::Down;
        }

        $minutesSinceBeat = CarbonImmutable::parse($beat)->diffInMinutes(now(), absolute: true);

        if ($minutesSinceBeat < self::HealthyMinutes) {
            return State::Operational;
        }

        return $minutesSinceBeat < self::LateMinutes ? State::Degraded : State::Down;
    }

    private function realtime(): State
    {
        if (config('broadcasting.default') !== 'reverb') {
            return State::NotConfigured;
        }

        $host = (string) config('broadcasting.connections.reverb.options.host');
        $port = (int) config('broadcasting.connections.reverb.options.port');

        $socket = @stream_socket_client("tcp://{$host}:{$port}", $errorCode, $errorMessage, self::SocketTimeoutSeconds);

        if ($socket === false) {
            return State::Down;
        }

        fclose($socket);

        return State::Operational;
    }

    private function mail(): State
    {
        if (in_array(config('mail.default'), ['log', 'array'], true)) {
            return State::NotConfigured;
        }

        return State::Operational;
    }
}
