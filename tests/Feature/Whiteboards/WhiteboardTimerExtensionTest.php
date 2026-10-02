<?php

use App\Events\Whiteboards\WhiteboardTimerChanged;
use App\Models\Whiteboard;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Event::fake([WhiteboardTimerChanged::class]);
    $this->travelTo(CarbonImmutable::parse('2026-10-11 10:00:00'));
});

it('moves the end of a running timer by two minutes and broadcasts it', function () {
    Queue::fake();

    $board = Whiteboard::factory()->create(['timer_ends_at' => now()->addSeconds(60)]);
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)
        ->postJson(route('whiteboards.timer.extension.store', $board))
        ->assertOk()
        ->assertExactJson(['timerEndsAt' => '2026-10-11T10:03:00+00:00']);

    expect($board->fresh()->timer_ends_at->toIso8601String())->toBe('2026-10-11T10:03:00+00:00');

    Event::assertDispatched(fn (WhiteboardTimerChanged $event) => $event->boardId === $board->id
        && $event->broadcastWith() === ['timerEndsAt' => '2026-10-11T10:03:00+00:00']);

    Queue::assertNothingPushed();
});

it('refuses to extend when no timer runs', function (?int $secondsLeft) {
    $board = Whiteboard::factory()->create([
        'timer_ends_at' => $secondsLeft === null ? null : now()->addSeconds($secondsLeft),
    ]);
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)
        ->postJson(route('whiteboards.timer.extension.store', $board))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('timer');

    Event::assertNotDispatched(WhiteboardTimerChanged::class);
})->with([
    'none set' => [null],
    'already ended' => [-30],
]);

it('refuses an extension that would run beyond one hour', function () {
    $board = Whiteboard::factory()->create(['timer_ends_at' => now()->addSeconds(3500)]);
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)
        ->postJson(route('whiteboards.timer.extension.store', $board))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('timer');

    expect($board->fresh()->timer_ends_at->toIso8601String())->toBe('2026-10-11T10:58:20+00:00');

    Event::assertNotDispatched(WhiteboardTimerChanged::class);
});

it('lets only the facilitator extend the timer', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create(['timer_ends_at' => now()->addSeconds(60)]);
    whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);
    $guest = whiteboardGuest($board);

    $this->actingAs($user)
        ->postJson(route('whiteboards.timer.extension.store', $board))
        ->assertForbidden();

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->postJson(route('whiteboards.timer.extension.store', $board))
        ->assertForbidden();

    expect($board->fresh()->timer_ends_at->toIso8601String())->toBe('2026-10-11T10:01:00+00:00');

    Event::assertNotDispatched(WhiteboardTimerChanged::class);
});
