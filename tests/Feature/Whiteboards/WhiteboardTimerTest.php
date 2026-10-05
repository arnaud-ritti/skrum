<?php

use App\Enums\WorkspaceRole;
use App\Events\Whiteboards\WhiteboardTimerChanged;
use App\Models\User;
use App\Models\Whiteboard;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Event::fake([WhiteboardTimerChanged::class]);
    $this->travelTo(CarbonImmutable::parse('2026-10-11 10:00:00'));
});

it('starts and clears the countdown for the facilitator', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)
        ->putJson(route('whiteboards.timer.update', $board), ['seconds' => 90])
        ->assertOk()
        ->assertExactJson(['timerEndsAt' => '2026-10-11T10:01:30+00:00']);

    expect($board->fresh()->timer_ends_at->toIso8601String())->toBe('2026-10-11T10:01:30+00:00');

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('board.timerEndsAt', '2026-10-11T10:01:30+00:00');

    $this->actingAs($user)
        ->putJson(route('whiteboards.timer.update', $board), ['seconds' => null])
        ->assertOk()
        ->assertExactJson(['timerEndsAt' => null]);

    expect($board->fresh()->timer_ends_at)->toBeNull();
});

it('lets only the facilitator set the timer', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);
    $guest = whiteboardGuest($board);

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->putJson(route('whiteboards.timer.update', $board), ['seconds' => 60])
        ->assertForbidden();

    $this->actingAs($user)
        ->putJson(route('whiteboards.timer.update', $board), ['seconds' => 60])
        ->assertForbidden();

    expect($board->fresh()->timer_ends_at)->toBeNull();

    Event::assertNotDispatched(WhiteboardTimerChanged::class);
});

it('refuses people outside the team', function () {
    $board = Whiteboard::factory()->create();
    $outsider = User::factory()->create();
    $board->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)->putJson(route('whiteboards.timer.update', $board), ['seconds' => 60])->assertForbidden();

    expect($board->fresh()->timer_ends_at)->toBeNull();

    Event::assertNotDispatched(WhiteboardTimerChanged::class);
});

it('accepts 10 seconds to one hour', function (int $seconds) {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)->putJson(route('whiteboards.timer.update', $board), ['seconds' => $seconds])->assertOk();

    expect($board->fresh()->timer_ends_at)->not->toBeNull();
})->with(['shortest' => [10], 'longest' => [3600]]);

it('refuses a duration outside 10 seconds to one hour', function (mixed $seconds) {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)
        ->putJson(route('whiteboards.timer.update', $board), ['seconds' => $seconds])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('seconds');

    expect($board->fresh()->timer_ends_at)->toBeNull();
})->with([
    'too short' => [9],
    'too long' => [3601],
    'not a number' => ['soon'],
    'a fraction' => [12.5],
]);

it('refuses a request that does not say how long', function () {
    $board = Whiteboard::factory()->create(['timer_ends_at' => now()->addMinute()]);
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)
        ->putJson(route('whiteboards.timer.update', $board), [])
        ->assertJsonValidationErrors('seconds');

    expect($board->fresh()->timer_ends_at)->not->toBeNull();
});

it('stops showing a countdown five minutes after it ended', function () {
    $board = Whiteboard::factory()->create(['timer_ends_at' => now()->addMinute()]);
    [$user] = whiteboardMember($board);

    $this->travel(5)->minutes();

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('board.timerEndsAt', '2026-10-11T10:01:00+00:00');

    $this->travel(61)->seconds();

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('board.timerEndsAt', null);

    expect($board->fresh()->timer_ends_at)->not->toBeNull();
});

it('broadcasts the end time and starts nothing else', function () {
    Queue::fake();

    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)->putJson(route('whiteboards.timer.update', $board), ['seconds' => 30])->assertOk();

    Event::assertDispatched(fn (WhiteboardTimerChanged $event) => $event->boardId === $board->id
        && $event->broadcastAs() === 'timer.changed'
        && $event->broadcastWith() === ['timerEndsAt' => '2026-10-11T10:00:30+00:00']);

    $this->actingAs($user)->putJson(route('whiteboards.timer.update', $board), ['seconds' => null])->assertOk();

    Event::assertDispatched(fn (WhiteboardTimerChanged $event) => $event->broadcastWith() === ['timerEndsAt' => null]);

    Queue::assertNothingPushed();
});
