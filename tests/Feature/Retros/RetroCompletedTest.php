<?php

use App\Enums\RetroPhase;
use App\Events\RetroCompleted;
use App\Events\Retros\ResultsChanged;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('dispatches RetroCompleted once per transition into completed', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroFacilitator($retro);
    $phaseRoute = route('retros.phase.update', $retro);

    $this->actingAs($user)->putJson($phaseRoute, ['phase' => 'completed'])->assertOk();

    Event::assertDispatchedTimes(RetroCompleted::class, 1);
    Event::assertDispatched(fn (RetroCompleted $event) => $event->retro->is($retro));

    $this->actingAs($user)->putJson($phaseRoute, ['phase' => 'discussing'])->assertOk();
    $this->actingAs($user)->putJson($phaseRoute, ['phase' => 'completed'])->assertOk();

    Event::assertDispatchedTimes(RetroCompleted::class, 2);
});

it('does not dispatch RetroCompleted on other phase changes', function () {
    $retro = Retro::factory()->create();
    [$user] = retroFacilitator($retro);
    $phaseRoute = route('retros.phase.update', $retro);

    foreach (['grouping', 'voting', 'discussing', 'voting'] as $phase) {
        $this->actingAs($user)->putJson($phaseRoute, ['phase' => $phase])->assertOk();
    }

    Event::assertNotDispatched(RetroCompleted::class);
});

it('broadcasts an empty results refresh', function () {
    $event = new ResultsChanged('retro-id');

    expect($event->broadcastAs())->toBe('results.changed')
        ->and($event->broadcastWith())->toBeEmpty()
        ->and($event->broadcastOn()->name)->toBe('presence-retro.retro-id');
});
