<?php

use App\Actions\Retros\ChangeRetroPhase;
use App\Enums\RetroPhase;
use App\Events\Retros\RotiChanged;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function rotiRetro(RetroPhase $phase = RetroPhase::Roti, array $attributes = []): array
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

it('accepts ratings in the ROTI phase even when locked', function () {
    [$retro, $user] = rotiRetro(RetroPhase::Roti, ['is_locked' => true]);

    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => 3])->assertOk();
    $this->actingAs($user)->deleteJson(route('retros.roti.destroy', $retro))->assertOk();
});

it('refuses ratings in the other phases', function (RetroPhase $phase) {
    [$retro, $user] = rotiRetro($phase);

    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => 3])->assertForbidden();
    $this->actingAs($user)->deleteJson(route('retros.roti.destroy', $retro))->assertForbidden();
})->with([RetroPhase::Icebreaker, RetroPhase::Writing, RetroPhase::Grouping, RetroPhase::Voting, RetroPhase::Discussing, RetroPhase::Actions]);

it('refuses ratings once completed', function () {
    [$retro, $user] = rotiRetro(RetroPhase::Completed);

    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => 3])->assertForbidden();
    $this->actingAs($user)->deleteJson(route('retros.roti.destroy', $retro))->assertForbidden();

    expect(RotiVote::count())->toBe(0);
});

it('keeps ratings stored before the ROTI phase, refuses new ones until then and lets the voter change them in ROTI', function () {
    [$retro, $user, $participant] = rotiRetro(RetroPhase::Discussing);
    retroFacilitator($retro);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'score' => 2]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 5]);

    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => 4])->assertForbidden();

    resolve(ChangeRetroPhase::class)->handle($retro, RetroPhase::Actions);

    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => 4])->assertForbidden();

    expect(RotiVote::query()->where('retro_id', $retro->id)->count())->toBe(2);

    resolve(ChangeRetroPhase::class)->handle($retro->fresh(), RetroPhase::Roti);

    expect(boardSnapshot($retro, $participant)['roti'])
        ->toMatchArray(['myScore' => 2, 'respondents' => 2, 'canVote' => true]);

    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => 4])
        ->assertOk()
        ->assertJson(['myScore' => 4, 'respondents' => 2]);

    expect(RotiVote::query()->where('participant_id', $participant->id)->sole()->score)->toBe(4);
});

it('says in the snapshot whether the viewer may rate', function (RetroPhase $phase, bool $canVote) {
    $retro = Retro::factory()->inPhase($phase)->create();
    [, $viewer] = retroMember($retro);

    expect(boardSnapshot($retro, $viewer)['roti']['canVote'])->toBe($canVote);
})->with([
    'discussing' => [RetroPhase::Discussing, false],
    'actions' => [RetroPhase::Actions, false],
    'roti' => [RetroPhase::Roti, true],
    'completed' => [RetroPhase::Completed, false],
]);

it('validates the score', function (mixed $score) {
    [$retro, $user] = rotiRetro();

    $this->actingAs($user)->putJson(route('retros.roti.update', $retro), ['score' => $score])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('score');
})->with([0, 6, 'great', null]);

it('accepts ratings from guests', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->withGuestAccess()->create();
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

    $voterSnapshot = boardSnapshot($retro, $voter);
    $nonVoterSnapshot = boardSnapshot($retro, $nonVoter);

    expect($voterSnapshot['roti'])->toMatchArray(['myScore' => 4, 'respondents' => 2])
        ->and($nonVoterSnapshot['roti'])->toMatchArray(['myScore' => null, 'respondents' => 2])
        ->and($voterSnapshot['roti']['voterIds'])->toHaveCount(2);
});

it('only carries the roti distribution in the completed snapshot', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [, $viewer] = retroMember($retro);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 4]);

    expect(boardSnapshot($retro, $viewer)['results'])->toBeNull();

    $retro->update(['phase' => RetroPhase::Completed]);

    expect(boardSnapshot($retro, $viewer)['results']['roti'])->toBe([
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

    $roti = boardSnapshot($retro, $participant)['roti'];

    expect(array_keys($roti))->toBe(['myScore', 'respondents', 'voterIds', 'canVote', 'revealed', 'results'])
        ->and($roti['voterIds'])->toContain($participant->id, $other->id);

    $this->actingAs($user)->deleteJson(route('retros.roti.destroy', $retro))->assertOk();

    Event::assertDispatched(fn (RotiChanged $event) => $event->broadcastWith()['voterIds'] === [$other->id]);

    expect(boardSnapshot($retro, $participant)['roti']['voterIds'])->toBe([$other->id]);
});

it('sends the voters to a guest snapshot', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $other = Participant::factory()->create(['retro_id' => $retro->id]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $other->id, 'score' => 2]);

    $roti = boardSnapshot($retro, $guest)['roti'];

    expect($roti['voterIds'])->toBe([$other->id])->and($roti['myScore'])->toBeNull();
});
