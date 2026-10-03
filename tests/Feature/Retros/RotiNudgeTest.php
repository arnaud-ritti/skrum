<?php

use App\Enums\RetroPhase;
use App\Events\Retros\RotiNudged;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('nudges once per half minute', function () {
    $this->freezeTime();
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create();
    [$facilitator] = retroFacilitator($retro);

    $this->actingAs($facilitator)->postJson(route('retros.roti.nudges.store', $retro))->assertNoContent();
    $this->actingAs($facilitator)->postJson(route('retros.roti.nudges.store', $retro))
        ->assertStatus(429)
        ->assertJsonPath('message', 'You can nudge again in a moment.');

    $this->travel(Retro::NudgeIntervalSeconds + 1)->seconds();

    $this->actingAs($facilitator)->postJson(route('retros.roti.nudges.store', $retro))->assertNoContent();

    Event::assertDispatchedTimes(RotiNudged::class, 2);
});

it('refuses the nudge to a participant, outside the ROTI phase and after the reveal', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create();
    [$facilitator] = retroFacilitator($retro);
    [$member] = retroMember($retro);

    $this->actingAs($member)->postJson(route('retros.roti.nudges.store', $retro))->assertForbidden();

    $retro->update(['roti_revealed_at' => now()]);
    $this->actingAs($facilitator)->postJson(route('retros.roti.nudges.store', $retro))->assertForbidden();

    $retro->update(['roti_revealed_at' => null, 'phase' => RetroPhase::Actions]);
    $this->actingAs($facilitator)->postJson(route('retros.roti.nudges.store', $retro))->assertForbidden();

    Event::assertNotDispatched(RotiNudged::class);
});
