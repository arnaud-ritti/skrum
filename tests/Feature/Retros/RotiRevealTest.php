<?php

use App\Enums\RetroPhase;
use App\Events\Retros\RotiRevealed;
use App\Models\Retro;
use App\Models\RotiVote;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('reveals the ROTI to everyone and closes the vote', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create();
    [$facilitator, $own] = retroFacilitator($retro);
    [$member, $participant] = retroMember($retro);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $own->id, 'score' => 3]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'score' => 5]);

    $this->actingAs($facilitator)->putJson(route('retros.roti.reveal.update', $retro))
        ->assertOk()
        ->assertJsonPath('results.average', 4)
        ->assertJsonPath('results.respondents', 2);

    expect($retro->fresh()->roti_revealed_at)->not->toBeNull();
    Event::assertDispatched(RotiRevealed::class);

    $this->actingAs($member)->putJson(route('retros.roti.update', $retro), ['score' => 1])->assertForbidden();
    $this->actingAs($member)->deleteJson(route('retros.roti.destroy', $retro))->assertForbidden();

    expect(RotiVote::query()->where('participant_id', $participant->id)->value('score'))->toBe(5);
});

it('refuses a second reveal, a reveal by a participant and a reveal outside the ROTI phase', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create(['roti_revealed_at' => now()]);
    [$facilitator] = retroFacilitator($retro);
    [$member] = retroMember($retro);

    $this->actingAs($facilitator)->putJson(route('retros.roti.reveal.update', $retro))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['roti' => 'The ROTI is already revealed.']);
    $this->actingAs($member)->putJson(route('retros.roti.reveal.update', $retro))->assertForbidden();

    $retro->update(['phase' => RetroPhase::Actions, 'roti_revealed_at' => null]);

    $this->actingAs($facilitator)->putJson(route('retros.roti.reveal.update', $retro))->assertForbidden();
});

it('still takes ratings on a retro completed before the ROTI phase existed', function () {
    $retro = Retro::factory()->legacyRoti()->inPhase(RetroPhase::Completed)->create();
    [$member] = retroMember($retro);

    $this->actingAs($member)->putJson(route('retros.roti.update', $retro), ['score' => 4])->assertOk();
});
