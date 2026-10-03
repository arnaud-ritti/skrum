<?php

use App\Models\PokerVote;
use Tests\Concurrency\Support\Race;

it('never changes a card after the estimate is saved', function () {
    $table = pokerRevealTable();
    $table['game']->update(['revote_after_reveal' => true]);
    pokerVote($table['round'], $table['memberPlayer'], '3');
    pokerVote($table['round'], $table['facilitatorPlayer'], '5');
    $table['round']->update(['revealed_at' => now()]);

    $memberId = $table['member']->id;
    $facilitatorId = $table['facilitator']->id;
    $voteUri = route('poker.rounds.vote.update', [$table['game'], $table['round']], false);
    $estimateUri = route('poker.tasks.estimate.update', [$table['game'], $table['round']->poker_task_id], false);
    $votePlayer = $table['memberPlayer']->id;

    $outcomes = Race::run([
        'change' => static fn (): int => Race::request($memberId, 'PUT', $voteUri, ['value' => '8']),
        'save' => static fn (): int => Race::request($facilitatorId, 'PUT', $estimateUri, ['value' => '5']),
    ]);

    $vote = PokerVote::query()->where('poker_player_id', $votePlayer)->sole();
    $changeStatus = $outcomes['change']['value'];
    $changeEnded = $outcomes['change']['endedAt'];
    $saveEnded = $outcomes['save']['endedAt'];

    // Protection: PlayPokerCard reads the task's estimate through PokerGuard::acceptsCard under the game's row lock,
    // which the estimate save takes first too: a change lands before the save or is refused after it.
    expect($outcomes['save']['value'])->toBe(200)
        ->and($changeStatus)->toBeIn([200, 422])
        ->and($vote->value)->toBe($changeStatus === 200 ? '8' : '3');

    if ($changeStatus === 200) {
        expect($changeEnded <= $saveEnded)->toBeTrue();
    }
});
