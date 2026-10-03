<?php

use App\Enums\RetroPhase;
use App\Events\Retros\VotingFinishedChanged;
use App\Models\Retro;
use App\Models\Vote;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('lets a participant finish voting and take it back', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$user, $participant] = retroMember($retro);

    $this->actingAs($user)->putJson(route('retros.votingCompletion.update', $retro))
        ->assertOk()
        ->assertExactJson(['finishedIds' => [$participant->id]]);

    expect($participant->fresh()->hasFinishedVoting())->toBeTrue();
    Event::assertDispatched(fn (VotingFinishedChanged $event) => $event->broadcastWith() === ['finishedIds' => [$participant->id]]);

    $this->actingAs($user)->deleteJson(route('retros.votingCompletion.destroy', $retro))
        ->assertOk()
        ->assertExactJson(['finishedIds' => []]);

    expect($participant->fresh()->hasFinishedVoting())->toBeFalse();
});

it('lets a guest finish voting, also on a locked board', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['is_locked' => true]);
    $guest = retroGuest($retro);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->putJson(route('retros.votingCompletion.update', $retro))
        ->assertOk()
        ->assertExactJson(['finishedIds' => [$guest->id]]);
});

it('refuses to finish outside the Voting phase', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)->putJson(route('retros.votingCompletion.update', $retro))->assertForbidden();
});

it('takes finished back when a finished participant casts a vote', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => 3]);
    [$user, $participant] = retroMember($retro);
    [, $other] = retroMember($retro);
    $card = topicCard($retro);
    $participant->update(['voting_finished_at' => now()]);
    $other->update(['voting_finished_at' => now()]);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertCreated()
        ->assertJsonPath('myVotes', 1)
        ->assertJsonPath('finishedIds', [$other->id]);

    expect($participant->fresh()->hasFinishedVoting())->toBeFalse()
        ->and($other->fresh()->hasFinishedVoting())->toBeTrue();
    Event::assertDispatched(fn (VotingFinishedChanged $event) => $event->broadcastWith() === ['finishedIds' => [$other->id]]);
});

it('takes finished back when a finished participant retracts a vote', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => 3]);
    [$user, $participant] = retroMember($retro);
    $card = topicCard($retro);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $participant->id]);
    $participant->update(['voting_finished_at' => now()]);

    $this->actingAs($user)->deleteJson(route('retros.cards.votes.destroy', [$retro, $card]))
        ->assertOk()
        ->assertJsonPath('myVotes', 0)
        ->assertJsonPath('finishedIds', []);

    expect($participant->fresh()->hasFinishedVoting())->toBeFalse();
});

it('answers a null finishedIds and sends nothing when the voter had not finished', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => 3]);
    [$user] = retroMember($retro);
    $card = topicCard($retro);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertCreated()
        ->assertJsonPath('finishedIds', null);

    Event::assertNotDispatched(VotingFinishedChanged::class);
});

it('keeps finished when the vote is refused', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => 1]);
    [$user, $participant] = retroMember($retro);
    $card = topicCard($retro);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $participant->id]);
    $participant->update(['voting_finished_at' => now()]);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['votes' => 'You have no votes left.']);

    expect($participant->fresh()->hasFinishedVoting())->toBeTrue();
    Event::assertNotDispatched(VotingFinishedChanged::class);
});

it('lists who has finished in the order of their ids', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$first, $one] = retroMember($retro);
    [$second, $two] = retroMember($retro);

    $this->actingAs($second)->putJson(route('retros.votingCompletion.update', $retro))->assertOk();
    $this->actingAs($first)->putJson(route('retros.votingCompletion.update', $retro))
        ->assertOk()
        ->assertExactJson(['finishedIds' => collect([$one->id, $two->id])->sort()->values()->all()]);
});
