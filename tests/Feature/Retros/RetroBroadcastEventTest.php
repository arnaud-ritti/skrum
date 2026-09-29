<?php

use App\Events\Retros\RetroBroadcastEvent;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;

it('broadcasts retro events on the retro presence channel after commit', function () {
    $event = new class('retro-id') extends RetroBroadcastEvent
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

    expect($event)->toBeInstanceOf(ShouldBroadcastNow::class)
        ->and($event)->toBeInstanceOf(ShouldDispatchAfterCommit::class)
        ->and($event->broadcastOn())->toBeInstanceOf(PresenceChannel::class)
        ->and($event->broadcastOn()->name)->toBe('presence-retro.retro-id');
});
