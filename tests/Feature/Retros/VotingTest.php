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

it('casts votes and broadcasts only the overall count', function () {
    [$retro, $user, $participant, $card] = votingRetro();

    $this->actingAs($user)
        ->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertCreated()
        ->assertJson(['cardId' => $card->id, 'myVotes' => 1, 'remainingVotes' => 2]);

    Event::assertDispatched(VoteCast::class, fn (VoteCast $event) => $event->votesCast === 1
        && array_keys($event->broadcastWith()) === ['votesCast', 'votesVersion']);
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
    Event::assertDispatched(VoteRetracted::class, fn (VoteRetracted $event) => $event->votesCast === 2);
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

    Event::assertDispatched(VoteCast::class, fn (VoteCast $event) => $event->votesVersion === $cast);
    Event::assertDispatched(VoteRetracted::class, fn (VoteRetracted $event) => $event->votesVersion === $retracted);
    expect($retro->fresh()->votes_version)->toBe($retracted);
});

it('answers a retraction with the same total and version it broadcasts', function () {
    [$retro, $user, , $card] = votingRetro();

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertCreated();

    $response = $this->actingAs($user)
        ->deleteJson(route('retros.cards.votes.destroy', [$retro, $card]))
        ->assertOk();

    Event::assertDispatched(VoteRetracted::class, fn (VoteRetracted $event) => $event->votesCast === $response->json('votesCast')
        && $event->votesVersion === $response->json('votesVersion'));
});
