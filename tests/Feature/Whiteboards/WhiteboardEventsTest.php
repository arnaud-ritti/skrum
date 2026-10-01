<?php

use App\Events\Whiteboards\WhiteboardBroadcastEvent;
use App\Events\Whiteboards\WhiteboardChanged;
use App\Events\Whiteboards\WhiteboardDeleted;
use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Events\Whiteboards\WhiteboardTimerChanged;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;

it('broadcasts on the whiteboard presence channel', function () {
    $event = new WhiteboardChanged('board-id');

    expect($event)->toBeInstanceOf(ShouldBroadcastNow::class)
        ->and($event)->toBeInstanceOf(ShouldDispatchAfterCommit::class)
        ->and($event->broadcastOn())->toBeInstanceOf(PresenceChannel::class)
        ->and($event->broadcastOn()->name)->toBe('presence-whiteboard.board-id');
});

it('names its events and keeps their payloads empty', function (WhiteboardBroadcastEvent $event, string $name) {
    expect($event->broadcastAs())->toBe($name)
        ->and($event->broadcastWith())->toBeEmpty();
})->with([
    'board changed' => [fn () => new WhiteboardChanged('b'), 'board.changed'],
    'board deleted' => [fn () => new WhiteboardDeleted('b'), 'board.deleted'],
]);

it('carries elements in the change event only when it has them', function () {
    $with = new WhiteboardElementsChanged('b', 4, 3, [['id' => 'x']]);
    $without = new WhiteboardElementsChanged('b', 4, 3, null);

    expect($with->broadcastAs())->toBe('elements.changed')
        ->and($with->broadcastWith())->toBe(['seq' => 4, 'fromSeq' => 3, 'elements' => [['id' => 'x']]])
        ->and($without->broadcastWith())->toBe(['seq' => 4, 'fromSeq' => 3]);
});

it('carries the end time in the timer event', function () {
    $running = new WhiteboardTimerChanged('b', '2026-10-11T10:00:30+00:00');
    $stopped = new WhiteboardTimerChanged('b', null);

    expect($running->broadcastAs())->toBe('timer.changed')
        ->and($running->broadcastOn()->name)->toBe('presence-whiteboard.b')
        ->and($running->broadcastWith())->toBe(['timerEndsAt' => '2026-10-11T10:00:30+00:00'])
        ->and($stopped->broadcastWith())->toBe(['timerEndsAt' => null]);
});
