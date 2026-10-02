<?php

use App\Actions\Games\EnsureIcebreakerRoom;
use App\Enums\GameKind;
use App\Enums\RetroPhase;
use App\Events\Retros\TimerChanged;
use App\Jobs\CloseExpiredGameRound;
use App\Models\Participant;
use App\Models\Retro;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Event::fake();
});

it('moves the end of a running timer by two minutes', function () {
    $this->freezeTime();
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_ends_at' => now()->addSeconds(60)]);
    [$user] = retroFacilitator($retro);
    $expectedEnd = now()->addSeconds(180);

    $this->actingAs($user)
        ->postJson(route('retros.timer.extension.store', $retro))
        ->assertOk()
        ->assertJsonPath('timerEndsAt', $expectedEnd->toIso8601String());

    expect($retro->fresh()->timer_ends_at->timestamp === $expectedEnd->timestamp)->toBeTrue();
    Event::assertDispatched(fn (TimerChanged $event) => $event->timerEndsAt === $expectedEnd->toIso8601String());
});

it('refuses when no timer is running', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_ends_at' => null]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)
        ->postJson(route('retros.timer.extension.store', $retro))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('timer');
});

it('refuses when the timer has ended', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_ends_at' => now()->subSecond()]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)
        ->postJson(route('retros.timer.extension.store', $retro))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('timer');

    Event::assertNotDispatched(TimerChanged::class);
});

it('refuses an extension that would leave more than two hours', function () {
    $this->freezeTime();
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_ends_at' => now()->addSeconds(7081)]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)
        ->postJson(route('retros.timer.extension.store', $retro))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('timer');

    expect($retro->fresh()->timer_ends_at->timestamp === now()->addSeconds(7081)->timestamp)->toBeTrue();
});

it('accepts an extension that leaves exactly two hours', function () {
    $this->freezeTime();
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_ends_at' => now()->addSeconds(7080)]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->postJson(route('retros.timer.extension.store', $retro))->assertOk();
});

it('reserves the extension to the facilitator', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_ends_at' => now()->addMinute()]);
    retroFacilitator($retro);
    [$member] = retroMember($retro);

    $this->actingAs($member)->postJson(route('retros.timer.extension.store', $retro))->assertForbidden();
});

it('refuses the extension to a guest', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_ends_at' => now()->addMinute()]);
    retroFacilitator($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->postJson(route('retros.timer.extension.store', $retro))
        ->assertForbidden();
});

it('refuses the extension once the retro is completed', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create(['timer_ends_at' => now()->addMinute()]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->postJson(route('retros.timer.extension.store', $retro))->assertForbidden();
});

it('schedules the icebreaker round expiry for the new end', function () {
    Queue::fake();
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->create([
        'icebreaker_game' => GameKind::Hangman,
        'timer_ends_at' => now()->addMinute()->startOfSecond(),
    ]);
    [$user] = retroFacilitator($retro);
    $room = resolve(EnsureIcebreakerRoom::class)->handle($retro->fresh());
    $round = activeGameRound($room);

    $this->actingAs($user)->postJson(route('retros.timer.extension.store', $retro))->assertOk();

    $endsAt = $retro->fresh()->timer_ends_at;

    Queue::assertPushed(CloseExpiredGameRound::class, fn (CloseExpiredGameRound $job) => $job->roundId === $round->id
        && CarbonImmutable::parse($job->timerEndsAt)->equalTo($endsAt));
});
