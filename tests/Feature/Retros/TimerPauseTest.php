<?php

use App\Actions\Games\EnsureIcebreakerRoom;
use App\Enums\GameKind;
use App\Enums\RetroPhase;
use App\Events\Retros\TimerChanged;
use App\Jobs\CloseExpiredGameRound;
use App\Models\Retro;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Event::fake();
});

it('pauses a running timer and resumes it for the seconds that were left', function () {
    $this->freezeTime();
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_ends_at' => now()->addSeconds(272)]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)
        ->putJson(route('retros.timer.pause.update', $retro))
        ->assertOk()
        ->assertExactJson(['timerEndsAt' => null, 'timerPausedSeconds' => 272, 'topicSeconds' => null]);

    expect($retro->fresh()->timer_ends_at)->toBeNull()
        ->and($retro->fresh()->timer_paused_seconds)->toBe(272);
    Event::assertDispatched(fn (TimerChanged $event) => $event->broadcastWith() === ['timerEndsAt' => null, 'timerPausedSeconds' => 272, 'topicSeconds' => null]);

    $this->travel(10)->minutes();
    $expectedEnd = now()->addSeconds(272)->startOfSecond();

    $this->actingAs($user)
        ->deleteJson(route('retros.timer.pause.destroy', $retro))
        ->assertOk()
        ->assertJsonPath('timerEndsAt', $expectedEnd->toIso8601String())
        ->assertJsonPath('timerPausedSeconds', null);

    expect($retro->fresh()->timer_ends_at->timestamp)->toBe($expectedEnd->timestamp)
        ->and($retro->fresh()->timer_paused_seconds)->toBeNull();
});

it('rounds the paused seconds up and never pauses at zero', function () {
    $this->travelTo(now()->startOfSecond()->addMilliseconds(600));
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_ends_at' => now()->startOfSecond()->addSecond()]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.timer.pause.update', $retro))->assertOk()->assertJsonPath('timerPausedSeconds', 1);
});

it('refuses to pause when no timer runs', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_ends_at' => now()->subSecond()]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.timer.pause.update', $retro))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['timer' => 'No timer is running.']);
});

it('refuses to pause the icebreaker timer', function () {
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->create(['timer_ends_at' => now()->addMinute()]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.timer.pause.update', $retro))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['timer' => "The icebreaker's timer cannot be paused."]);
});

it('refuses to resume a timer that is not paused', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->deleteJson(route('retros.timer.pause.destroy', $retro))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['timer' => 'The timer is not paused.']);
});

it('keeps pause and resume for the facilitator of an open retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_ends_at' => now()->addMinute()]);
    retroFacilitator($retro);
    [$member] = retroMember($retro);
    $guest = retroGuest($retro);

    $this->actingAs($member)->putJson(route('retros.timer.pause.update', $retro))->assertForbidden();
    $this->withCookies(retroGuestCookie($guest))->withCredentials()->putJson(route('retros.timer.pause.update', $retro))->assertForbidden();

    $completed = Retro::factory()->inPhase(RetroPhase::Completed)->create(['timer_paused_seconds' => 30]);
    [$facilitator] = retroFacilitator($completed);

    $this->actingAs($facilitator)->deleteJson(route('retros.timer.pause.destroy', $completed))->assertForbidden();
});

it('adds two minutes to a paused timer', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_paused_seconds' => 30]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->postJson(route('retros.timer.extension.store', $retro))
        ->assertOk()
        ->assertJsonPath('timerPausedSeconds', 150)
        ->assertJsonPath('timerEndsAt', null);

    expect($retro->fresh()->timer_paused_seconds)->toBe(150);
});

it('refuses to extend a paused timer past two hours', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_paused_seconds' => 7081]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->postJson(route('retros.timer.extension.store', $retro))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('timer');
});

it('clears a pause when a new timer starts or the timer stops', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_paused_seconds' => 30]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => 300])
        ->assertOk()
        ->assertJsonPath('timerPausedSeconds', null);

    expect($retro->fresh()->timer_paused_seconds)->toBeNull();

    $retro->update(['timer_ends_at' => null, 'timer_paused_seconds' => 30]);

    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => null])->assertOk();

    expect($retro->fresh()->only(['timer_ends_at', 'timer_paused_seconds']))->toBe(['timer_ends_at' => null, 'timer_paused_seconds' => null]);
});

it('schedules the icebreaker round when a timer paused elsewhere is resumed in the icebreaker', function () {
    Queue::fake();
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->create([
        'icebreaker_game' => GameKind::Hangman,
        'timer_paused_seconds' => 90,
    ]);
    [$user] = retroFacilitator($retro);
    $room = resolve(EnsureIcebreakerRoom::class)->handle($retro->fresh());
    $round = activeGameRound($room);

    $this->actingAs($user)->deleteJson(route('retros.timer.pause.destroy', $retro))->assertOk();

    $endsAt = $retro->fresh()->timer_ends_at;

    Queue::assertPushed(CloseExpiredGameRound::class, fn (CloseExpiredGameRound $job) => $job->roundId === $round->id
        && CarbonImmutable::parse($job->timerEndsAt)->equalTo($endsAt));
});
