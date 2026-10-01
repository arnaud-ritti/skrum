<?php

use App\Events\Whiteboards\WhiteboardBroadcastEvent;
use App\Events\Whiteboards\WhiteboardChanged;
use App\Events\Whiteboards\WhiteboardDeleted;
use App\Events\Whiteboards\WhiteboardElementsChanged;
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
        ->and($event->broadcastWith())->toBe([]);
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
