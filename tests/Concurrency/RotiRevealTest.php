<?php

use App\Enums\RetroPhase;
use App\Models\Retro;
use App\Models\RotiVote;
use Tests\Concurrency\Support\Race;

it('counts a ROTI vote only if it arrived before the reveal', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create();
    [$facilitator] = retroFacilitator($retro);
    [$member, $participant] = retroMember($retro);
    $facilitatorId = $facilitator->id;
    $memberId = $member->id;
    $revealUri = route('retros.roti.reveal.update', $retro, false);
    $voteUri = route('retros.roti.update', $retro, false);

    $outcomes = Race::run([
        'reveal' => static fn (): int => Race::request($facilitatorId, 'PUT', $revealUri),
        'vote' => static fn (): int => Race::request($memberId, 'PUT', $voteUri, ['score' => 2]),
    ]);

    $vote = RotiVote::query()->where('participant_id', $participant->id)->first();

    // Protection: the vote and the reveal both lock the retro row; the vote re-checks takesRotiVotes() under it.
    expect($outcomes['reveal']['value'])->toBe(200)
        ->and($outcomes['vote']['value'])->toBeIn([200, 403])
        ->and($vote === null)->toBe($outcomes['vote']['value'] === 403);
});

it('refuses a ROTI vote that arrives while the reveal holds the retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create();
    [$facilitator] = retroFacilitator($retro);
    [$member, $participant] = retroMember($retro);
    $facilitatorId = $facilitator->id;
    $memberId = $member->id;
    $revealUri = route('retros.roti.reveal.update', $retro, false);
    $voteUri = route('retros.roti.update', $retro, false);
    $revealing = Race::signal();

    try {
        $outcomes = Race::run([
            'reveal' => static function () use ($facilitatorId, $revealUri, $revealing): int {
                Race::holdFirstTransaction($revealing);

                return Race::request($facilitatorId, 'PUT', $revealUri);
            },
            'vote' => static function () use ($memberId, $voteUri, $revealing): int {
                Race::awaitHeldTransaction($revealing);

                return Race::request($memberId, 'PUT', $voteUri, ['score' => 2]);
            },
        ], Race::NoPause);
    } finally {
        @unlink($revealing);
    }

    expect($outcomes['reveal']['value'])->toBe(200)
        ->and($outcomes['vote']['value'])->toBe(403)
        ->and(RotiVote::query()->where('participant_id', $participant->id)->exists())->toBeFalse();
});
