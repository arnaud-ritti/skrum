<?php

use App\Actions\Retros\BuildBoardSnapshot;
use App\Enums\RetroPhase;
use App\Events\Retros\RotiChanged;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function rotiRetro(RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create($attributes);
    [$user, $participant] = retroMember($retro);

    return [$retro, $user, $participant];
}

it('rates, changes and withdraws the own rating', function () {
    [$retro, $user, $participant] = rotiRetro();

    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => 4])
        ->assertOk()
        ->assertExactJson(['myScore' => 4, 'respondents' => 1]);
    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => 2])
        ->assertOk()
        ->assertExactJson(['myScore' => 2, 'respondents' => 1]);

    expect(RotiVote::sole()->only(['participant_id', 'score']))->toBe(['participant_id' => $participant->id, 'score' => 2]);

    $this->actingAs($user)->deleteJson(route('retros.roti.destroy', $retro))
        ->assertOk()
        ->assertExactJson(['myScore' => null, 'respondents' => 0]);

    expect(RotiVote::count())->toBe(0);
});

it('broadcasts the respondent count and never a score', function () {
    [$retro, $user] = rotiRetro();
    RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 1]);

    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => 5])->assertOk();

    Event::assertDispatched(RotiChanged::class, fn (RotiChanged $event) => $event->broadcastAs() === 'roti.changed'
        && $event->broadcastWith() === ['respondents' => 2]);
});

it('accepts ratings in discussing and completed even when locked', function (RetroPhase $phase) {
    [$retro, $user] = rotiRetro($phase, ['is_locked' => true]);

    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => 3])->assertOk();
    $this->actingAs($user)->deleteJson(route('retros.roti.destroy', $retro))->assertOk();
})->with([RetroPhase::Discussing, RetroPhase::Completed]);

it('refuses ratings in the other phases', function (RetroPhase $phase) {
    [$retro, $user] = rotiRetro($phase);

    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => 3])->assertForbidden();
    $this->actingAs($user)->deleteJson(route('retros.roti.destroy', $retro))->assertForbidden();
})->with([RetroPhase::HealthCheck, RetroPhase::Icebreaker, RetroPhase::Writing, RetroPhase::Grouping, RetroPhase::Voting]);

it('validates the score', function (mixed $score) {
    [$retro, $user] = rotiRetro();

    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => $score])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('score');
})->with([0, 6, 'great', null]);

it('accepts ratings from guests', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCredentials()->withCookies(retroGuestCookie($guest))
        ->putJson(route('retros.roti.update', $retro), ['score' => 5])
        ->assertOk();

    expect(RotiVote::sole()->participant_id)->toBe($guest->id);
});

it('shows only the own score and the respondent count in the snapshot', function () {
    [$retro, , $voter] = rotiRetro();
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $voter->id, 'score' => 4]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 1]);
    $nonVoter = Participant::factory()->create(['retro_id' => $retro->id]);

    $voterSnapshot = app(BuildBoardSnapshot::class)->handle($retro->fresh(), $voter);
    $nonVoterSnapshot = app(BuildBoardSnapshot::class)->handle($retro->fresh(), $nonVoter);

    expect($voterSnapshot['roti'])->toBe(['myScore' => 4, 'respondents' => 2])
        ->and($nonVoterSnapshot['roti'])->toBe(['myScore' => null, 'respondents' => 2]);
});
