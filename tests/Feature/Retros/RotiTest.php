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
        ->assertExactJson(['myScore' => 4, 'respondents' => 1, 'voterIds' => [$participant->id]]);
    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => 2])
        ->assertOk()
        ->assertExactJson(['myScore' => 2, 'respondents' => 1, 'voterIds' => [$participant->id]]);

    expect(RotiVote::sole()->only(['participant_id', 'score']))->toBe(['participant_id' => $participant->id, 'score' => 2]);

    $this->actingAs($user)->deleteJson(route('retros.roti.destroy', $retro))
        ->assertOk()
        ->assertExactJson(['myScore' => null, 'respondents' => 0, 'voterIds' => []]);

    expect(RotiVote::count())->toBe(0);
});

it('broadcasts the respondent count and never a score', function () {
    [$retro, $user] = rotiRetro();
    RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 1]);

    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => 5])->assertOk();

    Event::assertDispatched(fn (RotiChanged $event) => $event->broadcastAs() === 'roti.changed'
        && $event->broadcastWith() === ['respondents' => 2, 'voterIds' => $event->voterIds]
        && count($event->voterIds) === 2
        && ! array_key_exists('score', $event->broadcastWith()));
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

    $voterSnapshot = resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $voter);
    $nonVoterSnapshot = resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $nonVoter);

    expect($voterSnapshot['roti'])->toMatchArray(['myScore' => 4, 'respondents' => 2])
        ->and($nonVoterSnapshot['roti'])->toMatchArray(['myScore' => null, 'respondents' => 2])
        ->and($voterSnapshot['roti']['voterIds'])->toHaveCount(2);
});

it('only carries the roti distribution in the completed snapshot', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [, $viewer] = retroMember($retro);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 4]);

    expect(resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['results'])->toBeNull();

    $retro->update(['phase' => RetroPhase::Completed]);

    expect(resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['results']['roti'])->toBe([
        'distribution' => [
            ['score' => 1, 'count' => 0],
            ['score' => 2, 'count' => 0],
            ['score' => 3, 'count' => 0],
            ['score' => 4, 'count' => 1],
            ['score' => 5, 'count' => 0],
        ],
        'average' => 4.0,
        'respondents' => 1,
    ]);
});

it('lists the voters in the event and the snapshot, and drops a voter who retracts', function () {
    [$retro, $user, $participant] = rotiRetro();
    $other = Participant::factory()->create(['retro_id' => $retro->id]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $other->id, 'score' => 1]);

    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => 5])->assertOk();

    Event::assertDispatched(fn (RotiChanged $event) => collect($event->broadcastWith()['voterIds'])->sort()->values()->all()
        === collect([$participant->id, $other->id])->sort()->values()->all());

    $roti = resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $participant)['roti'];

    expect(array_keys($roti))->toBe(['myScore', 'respondents', 'voterIds'])
        ->and($roti['voterIds'])->toContain($participant->id, $other->id);

    $this->actingAs($user)->deleteJson(route('retros.roti.destroy', $retro))->assertOk();

    Event::assertDispatched(fn (RotiChanged $event) => $event->broadcastWith()['voterIds'] === [$other->id]);

    expect(resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $participant)['roti']['voterIds'])->toBe([$other->id]);
});

it('sends the voters to a guest snapshot', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $other = Participant::factory()->create(['retro_id' => $retro->id]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $other->id, 'score' => 2]);

    $roti = resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $guest)['roti'];

    expect($roti['voterIds'])->toBe([$other->id])->and($roti['myScore'])->toBeNull();
});
