<?php

use App\Events\Retros\RetroBroadcastEvent;
use Illuminate\Broadcasting\Broadcasters\Broadcaster;
use Illuminate\Broadcasting\BroadcastException;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Exceptions;

function testRetroEvent(): RetroBroadcastEvent
{
    return new class('retro-id') extends RetroBroadcastEvent
    {
        public function broadcastAs(): string
        {
            return 'test.event';
        }

        public function broadcastWith(): array
        {
            return [];
        }
    };
}

it('broadcasts retro events on the retro presence channel after commit', function () {
    $event = testRetroEvent();

    expect($event)->toBeInstanceOf(ShouldBroadcastNow::class)
        ->and($event)->toBeInstanceOf(ShouldDispatchAfterCommit::class)
        ->and($event->broadcastOn())->toBeInstanceOf(PresenceChannel::class)
        ->and($event->broadcastOn()->name)->toBe('presence-retro.retro-id');
});

it('dispatches to others after commit using the request socket id', function () {
    Event::fake();
    request()->headers->set('X-Socket-ID', '1.2');
    $event = testRetroEvent();

    DB::transaction(function () use ($event): void {
        $event->sendToOthers();

        Event::assertNotDispatched($event::class);
    });

    Event::assertDispatched($event::class, fn ($dispatched) => $dispatched->socket === '1.2');
});

it('swallows and reports broadcaster failures after commit', function () {
    Broadcast::extend('failing', fn () => new class extends Broadcaster
    {
        public function auth($request) {}

        public function validAuthenticationResponse($request, $result) {}

        public function broadcast(array $channels, $event, array $payload = [])
        {
            throw new BroadcastException('down');
        }
    });
    config([
        'broadcasting.default' => 'failing',
        'broadcasting.connections.failing' => ['driver' => 'failing'],
    ]);
    Exceptions::fake();
    $event = testRetroEvent();

    DB::transaction(fn () => $event->sendToOthers());

    Exceptions::assertReported(BroadcastException::class);
});
