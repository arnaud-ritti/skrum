<?php

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Retro;
use App\Models\Vote;
use Tests\Concurrency\Support\Race;

it('never puts more votes of one participant on one card than the cap', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => 8, 'max_votes_per_card' => 2]);
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $userId = $user->id;
    $uri = route('retros.cards.votes.store', [$retro, $card], false);

    $outcomes = Race::run(array_fill(0, 6, static fn (): int => Race::request($userId, 'POST', $uri)));

    $statuses = array_count_values(array_column($outcomes, 'value'));

    // Protection: the cap is checked under the retro's row lock (CardVotesController@store).
    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and(Vote::query()->where('participant_id', $participant->id)->where('card_id', $card->id)->count())->toBe(2)
        ->and($statuses[201] ?? 0)->toBe(2)
        ->and($statuses[422] ?? 0)->toBe(4);
});
