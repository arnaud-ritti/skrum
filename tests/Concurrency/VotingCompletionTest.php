<?php

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Retro;
use App\Models\Vote;
use Tests\Concurrency\Support\Race;

it('leaves the participant finished only if the finish came after the vote', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => 3]);
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $userId = $user->id;
    $voteUri = route('retros.cards.votes.store', [$retro, $card], false);
    $finishUri = route('retros.votingCompletion.update', $retro, false);

    $outcomes = Race::run([
        'vote' => static fn (): int => Race::request($userId, 'POST', $voteUri),
        'finish' => static fn (): int => Race::request($userId, 'PUT', $finishUri),
    ]);

    $finishedAt = $participant->fresh()->voting_finished_at;
    $vote = Vote::query()->where('participant_id', $participant->id)->sole();

    // Protection: both lock the retro row first, then the participant; a vote that commits after the finish clears it.
    expect($outcomes['finish']['value'])->toBe(200)
        ->and($outcomes['vote']['value'])->toBe(201);

    if ($finishedAt !== null) {
        expect($vote->created_at->lte($finishedAt))->toBeTrue();
    }
});

it('never leaves a finished participant whose vote committed last', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => 8]);
    [$user, $participant] = retroMember($retro);
    $participant->update(['voting_finished_at' => now()]);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $userId = $user->id;
    $voteUri = route('retros.cards.votes.store', [$retro, $card], false);

    $outcomes = Race::run(array_fill(0, 4, static fn (): int => Race::request($userId, 'POST', $voteUri)));

    // Protection: each vote clears the flag under the participant's row lock; no vote can re-set it.
    expect(array_column($outcomes, 'value'))->each->toBe(201)
        ->and($participant->fresh()->voting_finished_at)->toBeNull()
        ->and(Vote::query()->where('participant_id', $participant->id)->count())->toBe(4);
});
