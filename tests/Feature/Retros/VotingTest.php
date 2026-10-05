<?php

use App\Enums\RetroPhase;
use App\Events\Retros\VoteCast;
use App\Events\Retros\VoteRetracted;
use App\Models\Card;
use App\Models\Retro;
use App\Models\Vote;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function votingRetro(int $votes = 3): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => $votes]);
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    return [$retro, $user, $participant, $card];
}

it('casts votes and broadcasts only the overall count when vote counts are hidden', function () {
    [$retro, $user, $participant, $card] = votingRetro();
    $retro->update(['hide_vote_counts' => true]);

    $this->actingAs($user)
        ->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertCreated()
        ->assertJson(['cardId' => $card->id, 'myVotes' => 1, 'remainingVotes' => 2, 'total' => null]);

    Event::assertDispatched(fn (VoteCast $event) => $event->votesCast === 1
        && array_keys($event->broadcastWith()) === ['votesCast', 'votesVersion']);
});

it('broadcasts the card total while voting when vote counts are visible', function () {
    [$retro, $user, $participant, $card] = votingRetro();
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $this->actingAs($user)
        ->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertCreated()
        ->assertJsonPath('total', 2);

    Event::assertDispatched(fn (VoteCast $event) => $event->broadcastWith() === [
        'votesCast' => 2,
        'votesVersion' => 1,
        'cardId' => $card->id,
        'total' => 2,
    ]);

    $this->actingAs($user)
        ->deleteJson(route('retros.cards.votes.destroy', [$retro, $card]))
        ->assertOk()
        ->assertJsonPath('total', 1);

    Event::assertDispatched(fn (VoteRetracted $event) => $event->broadcastWith()['total'] === 1
        && ! str_contains(json_encode($event->broadcastWith()), $participant->id));
});

it('allows several votes on one card up to the limit', function () {
    [$retro, $user, , $card] = votingRetro(2);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertCreated();
    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertCreated();

    $this->actingAs($user)
        ->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['votes' => 'You have no votes left.']);
});

it('counts votes across the whole retro', function () {
    [$retro, $user, $participant, $card] = votingRetro(2);
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertUnprocessable();
});

it('refuses votes after the limit was lowered', function () {
    [$retro, $user, $participant, $card] = votingRetro(5);
    Vote::factory()->count(3)->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);
    $retro->update(['votes_per_participant' => 2]);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertUnprocessable();
});

it('refuses votes on grouped cards and outside voting', function () {
    [$retro, $user, , $card] = votingRetro();
    $child = Card::factory()->create(['retro_id' => $retro->id, 'parent_card_id' => $card->id]);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $child]))->assertUnprocessable();

    $retro->update(['phase' => RetroPhase::Discussing]);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertForbidden();
});

it('retracts one of the participant votes on a card', function () {
    [$retro, $user, $participant, $card] = votingRetro();
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $participant->id]);
    $othersVote = Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $this->actingAs($user)
        ->deleteJson(route('retros.cards.votes.destroy', [$retro, $card]))
        ->assertOk()
        ->assertJson(['myVotes' => 1, 'remainingVotes' => 2]);

    expect(Vote::find($othersVote->id))->not->toBeNull();
    Event::assertDispatched(fn (VoteRetracted $event) => $event->votesCast === 2);
});

it('refuses to retract a vote the participant never cast', function () {
    [$retro, $user, , $card] = votingRetro();
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $this->actingAs($user)->deleteJson(route('retros.cards.votes.destroy', [$retro, $card]))->assertUnprocessable();
});

it('refuses to retract a vote outside voting', function () {
    [$retro, $user, $participant, $card] = votingRetro();
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $participant->id]);
    $retro->update(['phase' => RetroPhase::Discussing]);

    $this->actingAs($user)->deleteJson(route('retros.cards.votes.destroy', [$retro, $card]))->assertForbidden();
});

it('refuses to retract a vote on a grouped card without votes', function () {
    [$retro, $user, , $card] = votingRetro();
    $child = Card::factory()->create(['retro_id' => $retro->id, 'parent_card_id' => $card->id]);

    $this->actingAs($user)->deleteJson(route('retros.cards.votes.destroy', [$retro, $child]))->assertUnprocessable();
});

it('returns the retro vote total with every tally', function () {
    [$retro, $user, , $card] = votingRetro();
    [$other] = retroMember($retro);

    $this->actingAs($other)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertCreated();

    $this->actingAs($user)
        ->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertCreated()
        ->assertJsonPath('votesCast', 2);

    $this->actingAs($user)
        ->deleteJson(route('retros.cards.votes.destroy', [$retro, $card]))
        ->assertOk()
        ->assertJsonPath('votesCast', 1);
});

it('orders vote totals by a version that grows with every cast and retraction', function () {
    [$retro, $user, , $card] = votingRetro();

    $cast = $this->actingAs($user)
        ->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertCreated()
        ->json('votesVersion');

    $retracted = $this->actingAs($user)
        ->deleteJson(route('retros.cards.votes.destroy', [$retro, $card]))
        ->assertOk()
        ->json('votesVersion');

    expect($retracted)->toBeGreaterThan($cast);

    Event::assertDispatched(fn (VoteCast $event) => $event->votesVersion === $cast);
    Event::assertDispatched(fn (VoteRetracted $event) => $event->votesVersion === $retracted);
    expect($retro->fresh()->votes_version)->toBe($retracted);
});

it('answers a retraction with the same total and version it broadcasts', function () {
    [$retro, $user, , $card] = votingRetro();

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertCreated();

    $response = $this->actingAs($user)
        ->deleteJson(route('retros.cards.votes.destroy', [$retro, $card]))
        ->assertOk();

    Event::assertDispatched(fn (VoteRetracted $event) => $event->votesCast === $response->json('votesCast')
        && $event->votesVersion === $response->json('votesVersion'));
});

it('derives the automatic limit from the top-level cards', function (int $cards, int $expected) {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => null]);
    Card::factory()->count($cards)->create(['retro_id' => $retro->id]);

    expect($retro->fresh()->voteLimit())->toBe($expected);
})->with([
    'no cards' => [0, 3],
    'four cards' => [4, 7],
    'seven cards' => [7, 10],
    'twenty cards' => [20, 10],
]);

it('counts a group once in the automatic limit', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => null]);
    $lead = Card::factory()->create(['retro_id' => $retro->id]);
    Card::factory()->count(3)->create(['retro_id' => $retro->id, 'parent_card_id' => $lead->id]);

    expect($retro->fresh()->voteLimit())->toBe(4);
});

it('keeps a fixed limit unchanged', function () {
    $retro = Retro::factory()->create(['votes_per_participant' => 7]);
    Card::factory()->count(20)->create(['retro_id' => $retro->id]);

    expect($retro->fresh()->voteLimit())->toBe(7);
});

it('refuses votes beyond the automatic limit', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => null]);
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    Vote::factory()->count(3)->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $participant->id]);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertCreated()->assertJsonPath('remainingVotes', 0);
    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertUnprocessable();
});

it('keeps votes already cast when the automatic limit drops', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => null]);
    [$user, $participant] = retroMember($retro);
    $cards = Card::factory()->count(4)->create(['retro_id' => $retro->id]);
    Vote::factory()->count(6)->create(['retro_id' => $retro->id, 'card_id' => $cards[0]->id, 'participant_id' => $participant->id]);
    $cards[1]->update(['parent_card_id' => $cards[0]->id]);
    $cards[2]->update(['parent_card_id' => $cards[0]->id]);

    expect($retro->fresh()->voteLimit())->toBe(5)
        ->and(Vote::query()->where('participant_id', $participant->id)->count())->toBe(6)
        ->and(boardSnapshot($retro, $participant)['viewer']['remainingVotes'])->toBe(0);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $cards[0]]))->assertUnprocessable();
});
