<?php

use App\Enums\StatusComponentState as State;
use App\Jobs\RecordQueueHeartbeat;
use App\Support\Status\InstanceStatus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;

function stateOf(string $key): State
{
    return collect(resolve(InstanceStatus::class)->check())->firstWhere('key', $key)['state'];
}

it('lists the seven components in a fixed order', function () {
    expect(array_column(resolve(InstanceStatus::class)->check(), 'key'))
        ->toBe(['application', 'database', 'cache', 'queue', 'scheduler', 'realtime', 'mail']);
});

it('rates a heartbeat by its age', function (?int $minutesAgo, State $state) {
    $this->travelTo(now()->setDateTime(2026, 10, 3, 12, 0, 0));

    if ($minutesAgo !== null) {
        Cache::forever(InstanceStatus::QueueHeartbeat, now()->subMinutes($minutesAgo)->toIso8601String());
    }

    expect(stateOf('queue'))->toBe($state);
})->with([
    [1, State::Operational],
    [5, State::Degraded],
    [20, State::Down],
    [null, State::Down],
]);

it('calls the queue down when its heartbeat cannot be read as a time', function () {
    Cache::forever(InstanceStatus::QueueHeartbeat, 'not a time');

    expect(stateOf('queue'))->toBe(State::Down);
});

it('writes both heartbeats from the scheduler command, the queue one through a job', function () {
    config(['queue.default' => 'sync']);

    $this->artisan('skrum:heartbeat')->assertSuccessful();

    expect(Cache::get(InstanceStatus::SchedulerHeartbeat))->not->toBeNull()
        ->and(Cache::get(InstanceStatus::QueueHeartbeat))->not->toBeNull();
});

it('calls real time and mail not configured on the defaults', function () {
    config(['broadcasting.default' => 'null', 'mail.default' => 'log']);

    expect(stateOf('realtime'))->toBe(State::NotConfigured)
        ->and(stateOf('mail'))->toBe(State::NotConfigured);
});

it('calls real time down when nothing listens on its port', function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.options.host' => '127.0.0.1',
        'broadcasting.connections.reverb.options.port' => 1,
    ]);

    expect(stateOf('realtime'))->toBe(State::Down);
});

it('calls the database down when it cannot be reached', function () {
    withUnreachableDatabase(fn () => expect(stateOf('database'))->toBe(State::Down));
});

it('keeps at most one queue heartbeat waiting while the worker is down', function () {
    Queue::fake();

    $this->artisan('skrum:heartbeat')->assertSuccessful();
    $this->artisan('skrum:heartbeat')->assertSuccessful();

    Queue::assertPushed(RecordQueueHeartbeat::class, 1);
});
