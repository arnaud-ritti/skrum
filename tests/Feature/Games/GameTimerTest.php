<?php

use App\Actions\Games\ExpireGameRound;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Events\Games\GameRoundEnded;
use App\Events\Games\GameTimerChanged;
use App\Jobs\CloseExpiredGameRound;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Queue;
use Tests\Support\FakeGameRules;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
    $this->rules = new FakeGameRules;
    bindGameRules($this->rules);
});

function runGameExpiryJob(GameRound $round, string $timerEndsAt): void
{
    new CloseExpiredGameRound($round->id, $timerEndsAt)->handle(resolve(ExpireGameRound::class));
}

it('sets and clears the room timer as host', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);

    $this->actingAs($user)
        ->putJson(route('games.timer.update', $room), ['seconds' => 90])
        ->assertOk()
        ->assertExactJson(['timerEndsAt' => '2026-10-06T10:01:30+00:00']);

    expect($room->fresh()->timer_ends_at?->toIso8601String())->toBe('2026-10-06T10:01:30+00:00');
    Event::assertDispatched(fn (GameTimerChanged $event) => $event->timerEndsAt === '2026-10-06T10:01:30+00:00');

    $this->actingAs($user)
        ->putJson(route('games.timer.update', $room), ['seconds' => null])
        ->assertOk()
        ->assertExactJson(['timerEndsAt' => null]);

    expect($room->fresh()->timer_ends_at)->toBeNull();
});

it('validates the timer and keeps it to the host of standalone rooms', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);
    [$member] = gameRoomMember($room);
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    [$facilitator] = retroFacilitator($retro);
    $icebreaker = GameRoom::factory()->icebreaker($retro)->create();

    $this->actingAs($user)->putJson(route('games.timer.update', $room), ['seconds' => 5])->assertUnprocessable();
    $this->actingAs($user)->putJson(route('games.timer.update', $room), ['seconds' => 7201])->assertUnprocessable();
    $this->actingAs($user)->putJson(route('games.timer.update', $room), [])->assertUnprocessable();
    $this->actingAs($member)->putJson(route('games.timer.update', $room), ['seconds' => 60])->assertForbidden();
    $this->actingAs($facilitator)->putJson(route('games.timer.update', $icebreaker), ['seconds' => 60])->assertNotFound();
});

it('never sets a timer when a round starts', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))->assertCreated();

    expect($room->fresh()->timer_ends_at)->toBeNull();
});

it('schedules the expiry when a timer is set during a round', function () {
    Queue::fake();
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);
    $round = activeGameRound($room);

    $this->actingAs($user)->putJson(route('games.timer.update', $room), ['seconds' => 60])->assertOk();

    Queue::assertPushed(CloseExpiredGameRound::class, fn (CloseExpiredGameRound $job) => $job->roundId === $round->id
        && $job->timerEndsAt === '2026-10-06T10:01:00+00:00'
        && $job->delay instanceof DateTimeInterface
        && CarbonImmutable::instance($job->delay)->equalTo(CarbonImmutable::parse('2026-10-06 10:01:00')));
});

it('schedules nothing without an active round', function () {
    Queue::fake();
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);

    $this->actingAs($user)->putJson(route('games.timer.update', $room), ['seconds' => 60])->assertOk();

    Queue::assertNotPushed(CloseExpiredGameRound::class);
});

it('schedules the expiry when a round starts under a running timer', function () {
    Queue::fake();
    $room = GameRoom::factory()->create(['timer_ends_at' => now()->addMinutes(2)]);
    [$user] = gameRoomHost($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))->assertCreated();

    Queue::assertPushed(CloseExpiredGameRound::class, fn (CloseExpiredGameRound $job) => $job->timerEndsAt === '2026-10-06T10:02:00+00:00');
});

it('ends the round as timed out when the job runs after the timer', function () {
    $room = GameRoom::factory()->create(['timer_ends_at' => now()->addMinute()]);
    [, $host] = gameRoomHost($room);
    $round = activeGameRound($room);
    $this->rules->points = [$host->id => ['points' => 0, 'isWin' => false]];

    $this->travel(61)->seconds();
    runGameExpiryJob($round, '2026-10-06T10:01:00+00:00');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::TimedOut);
    Event::assertDispatched(fn (GameRoundEnded $event) => $event->payload['outcome'] === 'timed_out');
});

it('ignores stale, early and cleared timers', function (string $case) {
    Queue::fake();
    $room = GameRoom::factory()->create(['timer_ends_at' => now()->addMinute()]);
    gameRoomHost($room);
    $round = activeGameRound($room);

    match ($case) {
        'changed' => $room->update(['timer_ends_at' => now()->addMinutes(5)]),
        'cleared' => $room->update(['timer_ends_at' => null]),
        'early' => null,
    };

    if ($case !== 'early') {
        $this->travel(61)->seconds();
    }

    runGameExpiryJob($round, '2026-10-06T10:01:00+00:00');

    expect($round->fresh()->isActive())->toBeTrue()
        ->and(Queue::pushed(CloseExpiredGameRound::class, fn (CloseExpiredGameRound $job): bool => $job->earlyRuns === 1))->toHaveCount($case === 'early' ? 1 : 0);
})->with(['changed', 'cleared', 'early']);

it('expires the round lazily on the next request', function () {
    $room = GameRoom::factory()->create(['timer_ends_at' => now()->addMinute()]);
    [$user] = gameRoomHost($room);
    $round = activeGameRound($room);

    $this->travel(2)->minutes();

    $this->actingAs($user)
        ->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('round', null)
        ->assertJsonPath('history.0.outcome', 'timed_out');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::TimedOut);
});

it('reports a failing expiry and still serves the room request', function () {
    Exceptions::fake();
    $this->rules->expiryThrows = true;
    $room = GameRoom::factory()->create(['timer_ends_at' => now()->addMinute()]);
    [$user] = gameRoomHost($room);
    $round = activeGameRound($room);

    $this->travel(2)->minutes();

    $this->actingAs($user)
        ->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('round.id', $round->id);

    Exceptions::assertReported(RuntimeException::class);
});

it('does not end a round started after the timer ran out', function () {
    $room = GameRoom::factory()->create(['timer_ends_at' => now()->subMinute()]);
    [$user] = gameRoomHost($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))->assertCreated();

    $this->travel(1)->minutes();

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('round.game', 'hangman');
});

it('leaves the round active when the rules handle the expiry themselves', function () {
    $this->rules->expiryOutcome = null;
    $room = GameRoom::factory()->create(['timer_ends_at' => now()->addMinute()]);
    gameRoomHost($room);
    $round = activeGameRound($room);

    $this->travel(2)->minutes();
    resolve(ExpireGameRound::class)->handle($room->fresh());

    expect($round->fresh()->isActive())->toBeTrue();
});

it('uses the retro board timer in icebreaker rooms', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create(['timer_ends_at' => now()->addMinute()]);
    [$user, $participant] = retroMember($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create();
    GamePlayer::factory()->forParticipant($participant)->create(['game_room_id' => $room->id]);
    $round = activeGameRound($room);

    $this->travel(2)->minutes();

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))->assertOk()->assertJsonPath('round', null);

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::TimedOut);
});

it('runs again when the job fires before the timer and ends the round on the later run', function () {
    Queue::fake();
    $room = GameRoom::factory()->create(['timer_ends_at' => now()->addMinute()]);
    gameRoomHost($room);
    $round = activeGameRound($room);

    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:59.500'));
    runGameExpiryJob($round, '2026-10-06T10:01:00+00:00');

    expect($round->fresh()->isActive())->toBeTrue();
    Queue::assertPushed(CloseExpiredGameRound::class, fn (CloseExpiredGameRound $job) => $job->earlyRuns === 1);

    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:01:00.500'));
    runGameExpiryJob($round, '2026-10-06T10:01:00+00:00');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::TimedOut);
});

it('matches a timer stored with sub-second precision', function () {
    $room = GameRoom::factory()->create(['timer_ends_at' => CarbonImmutable::parse('2026-10-06 10:01:00.400')]);
    [, $host] = gameRoomHost($room);
    $round = activeGameRound($room);
    $this->rules->points = [$host->id => ['points' => 0, 'isWin' => false]];

    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:02:00'));
    runGameExpiryJob($round, '2026-10-06T10:01:00+00:00');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::TimedOut);
});
