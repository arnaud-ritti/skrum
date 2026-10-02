<?php

use App\Actions\Games\ExpireGameRound;
use App\Enums\RetroPhase;
use App\Events\Games\GameTimerChanged;
use App\Jobs\CloseExpiredGameRound;
use App\Models\GameRoom;
use App\Models\Retro;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Tests\Support\FakeGameRules;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
    bindGameRules(new FakeGameRules);
});

/**
 * @return array{0: GameRoom, 1: User}
 */
function extendableRoom(?int $secondsLeft = 60): array
{
    $room = GameRoom::factory()->create([
        'timer_ends_at' => $secondsLeft === null ? null : now()->addSeconds($secondsLeft),
    ]);
    [$user] = gameRoomHost($room);

    return [$room, $user];
}

it('moves the end of a running timer by two minutes and broadcasts it', function () {
    [$room, $user] = extendableRoom(60);

    $this->actingAs($user)
        ->postJson(route('games.timer.extension.store', $room))
        ->assertOk()
        ->assertExactJson(['timerEndsAt' => '2026-10-06T10:03:00+00:00']);

    expect($room->fresh()->timer_ends_at->toIso8601String())->toBe('2026-10-06T10:03:00+00:00');
    Event::assertDispatched(fn (GameTimerChanged $event) => $event->timerEndsAt === '2026-10-06T10:03:00+00:00');
});

it('closes the round with the job of the new end and not with the job of the old one', function () {
    Queue::fake();
    [$room, $user] = extendableRoom(60);
    $round = activeGameRound($room);

    $this->actingAs($user)->postJson(route('games.timer.extension.store', $room))->assertOk();

    Queue::assertPushed(CloseExpiredGameRound::class, fn (CloseExpiredGameRound $job) => $job->roundId === $round->id
        && $job->timerEndsAt === '2026-10-06T10:03:00+00:00'
        && CarbonImmutable::instance($job->delay)->equalTo(CarbonImmutable::parse('2026-10-06 10:03:00')));
    Queue::assertNotPushed(CloseExpiredGameRound::class, fn (CloseExpiredGameRound $job) => $job->timerEndsAt === '2026-10-06T10:01:00+00:00');

    $this->travel(61)->seconds();
    (new CloseExpiredGameRound($round->id, '2026-10-06T10:01:00+00:00'))->handle(resolve(ExpireGameRound::class));

    expect($round->fresh()->isActive())->toBeTrue();
});

it('schedules nothing without an active round', function () {
    Queue::fake();
    [$room, $user] = extendableRoom(60);

    $this->actingAs($user)->postJson(route('games.timer.extension.store', $room))->assertOk();

    Queue::assertNotPushed(CloseExpiredGameRound::class);
});

it('refuses without a running timer', function (?int $secondsLeft) {
    [$room, $user] = extendableRoom($secondsLeft);

    $this->actingAs($user)
        ->postJson(route('games.timer.extension.store', $room))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('timer');

    Event::assertNotDispatched(GameTimerChanged::class);
})->with([[null], [-5]]);

it('refuses an end beyond two hours', function () {
    [$room, $user] = extendableRoom(7200 - 119);

    $this->actingAs($user)
        ->postJson(route('games.timer.extension.store', $room))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('timer');

    expect($room->fresh()->timer_ends_at->toIso8601String())->toBe('2026-10-06T11:58:01+00:00');
});

it('accepts an end exactly at two hours', function () {
    [$room, $user] = extendableRoom(7200 - 120);

    $this->actingAs($user)->postJson(route('games.timer.extension.store', $room))->assertOk();
});

it('keeps the extension to the host', function () {
    [$room] = extendableRoom(60);
    [$member] = gameRoomMember($room);
    $guest = gameRoomGuest($room);

    $this->actingAs($member)->postJson(route('games.timer.extension.store', $room))->assertForbidden();
    $this->withCredentials()->withCookies(gameGuestCookie($guest))
        ->postJson(route('games.timer.extension.store', $room))
        ->assertForbidden();

    expect($room->fresh()->timer_ends_at->toIso8601String())->toBe('2026-10-06T10:01:00+00:00');
});

it('is refused on an icebreaker room', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create(['timer_ends_at' => now()->addMinute()]);
    [$facilitator] = retroFacilitator($retro);
    $icebreaker = GameRoom::factory()->icebreaker($retro)->create();

    $this->actingAs($facilitator)
        ->postJson(route('games.timer.extension.store', $icebreaker))
        ->assertNotFound();
});
