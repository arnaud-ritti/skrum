<?php

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Vote;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{0: Retro, 1: User, 2: Card}
 */
function cappedRetro(int $cap, int $votes = 5): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => $votes, 'max_votes_per_card' => $cap]);
    [$user] = retroMember($retro);

    return [$retro, $user, topicCard($retro)];
}

it('refuses a vote beyond the cap on one card and accepts it on another', function () {
    [$retro, $user, $card] = cappedRetro(2);
    $other = topicCard($retro);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertCreated();
    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertCreated();
    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['votes' => 'You can put at most 2 votes on one card.']);
    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $other]))->assertCreated();

    expect(Vote::query()->where('card_id', $card->id)->count())->toBe(2);
});

it('says one vote per card in the singular', function () {
    [$retro, $user, $card] = cappedRetro(1);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertCreated();
    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['votes' => 'You can put only one vote on a card.']);
});

it('counts the cap per participant', function () {
    [$retro, $user, $card] = cappedRetro(1);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertCreated();
});

it('lets an automatic vote limit below the cap win', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => null, 'max_votes_per_card' => 9]);
    [$user] = retroMember($retro);
    $card = topicCard($retro);

    foreach (range(1, 4) as $vote) {
        $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertCreated();
    }

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['votes' => 'You have no votes left.']);
});

it('creates a retro with a cap per card', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $this->actingAs($user)
        ->post(route('teams.retros.store', [$team->workspace, $team]), [
            'title' => 'Sprint 43 retro',
            'template' => 'start_stop_continue',
            'votes_per_participant' => 5,
            'max_votes_per_card' => 2,
        ])
        ->assertRedirect();

    expect(Retro::query()->sole()->max_votes_per_card)->toBe(2);
});

it('changes the cap until Grouping and refuses it from Voting on', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['max_votes_per_card' => 3])->assertNoContent();

    expect($retro->fresh()->max_votes_per_card)->toBe(3);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['max_votes_per_card' => null])->assertNoContent();

    expect($retro->fresh()->max_votes_per_card)->toBeNull();

    $retro->update(['phase' => RetroPhase::Voting]);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['max_votes_per_card' => 2])->assertForbidden();
});

it('validates the cap', function (mixed $value) {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['max_votes_per_card' => $value])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('max_votes_per_card');
})->with([0, 21, 'two']);
