<?php

use App\Enums\RetroPhase;
use App\Events\Retros\TimerChanged;
use App\Models\Retro;
use App\Models\Team;
use App\Support\Retros\PhaseDurations;
use Illuminate\Support\Facades\Event;

it('stores the standard durations chosen at creation', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->post(route('teams.retros.store', [$team->workspace, $team]), [
            'title' => 'Sprint 43 retro',
            'template' => 'start_stop_continue',
            'phase_durations' => PhaseDurations::Standard,
        ])
        ->assertSessionHasNoErrors();

    expect(Retro::query()->sole()->phase_durations)->toBeIgnoringKeyOrder(PhaseDurations::Standard);
});

it('stores no durations when the creation sends none', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->post(route('teams.retros.store', [$team->workspace, $team]), [
            'title' => 'Sprint 43 retro',
            'template' => 'start_stop_continue',
        ])
        ->assertSessionHasNoErrors();

    expect(Retro::query()->sole()->phase_durations)->toBeNull();
});

it('refuses a duration out of range or an untimed phase', function (array $durations, string $invalidField) {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->post(route('teams.retros.store', [$team->workspace, $team]), [
            'title' => 'R', 'template' => 'start_stop_continue', 'phase_durations' => $durations,
        ])
        ->assertSessionHasErrors($invalidField);

    expect(Retro::query()->count())->toBe(0);
})->with([
    'zero' => [['writing' => 0], 'phase_durations.writing'],
    'too long' => [['writing' => 61], 'phase_durations.writing'],
    'roti' => [['roti' => 5], 'phase_durations'],
    'not a number' => [['writing' => 'seven'], 'phase_durations.writing'],
]);

it('stores phase durations as an object of minutes, null by default', function () {
    $retro = Retro::factory()->create();

    expect($retro->fresh()->phase_durations)->toBeNull();

    $retro->update(['phase_durations' => ['writing' => 7, 'voting' => 3]]);

    expect($retro->fresh()->phase_durations)->toBeIgnoringKeyOrder(['writing' => 7, 'voting' => 3]);
});

it('starts no timer when the retro enters a phase that has a duration', function () {
    Event::fake([TimerChanged::class]);
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['phase_durations' => ['grouping' => 5]]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)
        ->putJson(route('retros.phase.update', $retro), ['phase' => RetroPhase::Grouping->value])
        ->assertSuccessful();

    expect($retro->fresh()->timer_ends_at)->toBeNull();

    Event::assertNotDispatched(TimerChanged::class);
});

it('leaves a running timer alone across a phase change', function () {
    $this->freezeSecond();
    $endsAt = now()->addMinutes(2);
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['phase_durations' => PhaseDurations::Standard, 'timer_ends_at' => $endsAt]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)
        ->putJson(route('retros.phase.update', $retro), ['phase' => RetroPhase::Grouping->value])
        ->assertSuccessful();

    expect($retro->fresh()->timer_ends_at?->equalTo($endsAt))->toBeTrue();
});

it('leaves a paused timer paused across a phase change', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['phase_durations' => PhaseDurations::Standard, 'timer_paused_seconds' => 90]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)
        ->putJson(route('retros.phase.update', $retro), ['phase' => RetroPhase::Grouping->value])
        ->assertSuccessful();

    expect($retro->fresh()->timer_paused_seconds)->toBe(90)
        ->and($retro->fresh()->timer_ends_at)->toBeNull();
});

it('lets the facilitator change the durations, and nobody else', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create();
    [$facilitator] = retroFacilitator($retro);
    [$member] = retroMember($retro);

    $this->actingAs($member)
        ->patchJson(route('retros.settings.update', $retro), ['phase_durations' => ['voting' => 3]])
        ->assertForbidden();

    $this->actingAs($facilitator)
        ->patchJson(route('retros.settings.update', $retro), ['phase_durations' => ['voting' => 3]])
        ->assertSuccessful();

    expect($retro->fresh()->phase_durations)->toBe(['voting' => 3]);

    $this->actingAs($facilitator)
        ->patchJson(route('retros.settings.update', $retro), ['phase_durations' => null])
        ->assertSuccessful();

    expect($retro->fresh()->phase_durations)->toBeNull();
});

it('refuses an untimed phase in the settings', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['phase_durations' => ['voting' => 3]]);
    [$facilitator] = retroFacilitator($retro);

    $this->actingAs($facilitator)
        ->patchJson(route('retros.settings.update', $retro), ['phase_durations' => ['roti' => 5]])
        ->assertJsonValidationErrors('phase_durations');

    expect($retro->fresh()->phase_durations)->toBe(['voting' => 3]);
});

it('sends the durations in the board snapshot', function () {
    $retro = Retro::factory()->create(['phase_durations' => ['writing' => 7]]);
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertOk()
        ->assertJsonPath('retro.phaseDurations.writing', 7);
});

it('starts the offered duration through the existing timer endpoint', function () {
    $this->freezeSecond();
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['phase_durations' => ['writing' => 7]]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)
        ->putJson(route('retros.timer.update', $retro), ['seconds' => 7 * 60])
        ->assertOk();

    expect($retro->fresh()->timer_ends_at?->equalTo(now()->addMinutes(7)))->toBeTrue();
});
