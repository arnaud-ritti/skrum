<?php

use App\Actions\Poker\PokerResult;
use App\Enums\PokerRevealReason;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @param  array<int, string>  $values
 * @return array{round: PokerRound, players: array<int, PokerPlayer>}
 */
function revealedPokerRound(array $values, bool $anonymous = false): array
{
    $table = pokerRevealTable();
    $round = $table['round'];
    $players = [];

    foreach ($values as $value) {
        $player = pokerGuest($table['game'], fake()->uuid());
        pokerVote($round, $player, $value);
        $players[] = $player;
    }

    $round->update([
        'anonymous' => $anonymous,
        'revealed_at' => now(),
        'reveal_reason' => PokerRevealReason::Manual,
    ]);

    return ['round' => $round->fresh(), 'players' => $players];
}

it('gives median, spread, agreement and the two outliers of a revealed round', function () {
    $table = revealedPokerRound(['3', '5', '5', '8']);

    $result = PokerResult::for($table['round'], $table['round']->task->game);

    expect($result['median'])->toBe(5.0)
        ->and($result['spread'])->toBe(['min' => 3.0, 'max' => 8.0])
        ->and($result['agreement'])->toBe(0.5)
        ->and($result['outliers'])->toBe([
            'low' => [$table['players'][0]->id],
            'high' => [$table['players'][3]->id],
        ]);
});

it('finds no outlier when everyone agrees', function () {
    $table = revealedPokerRound(['5', '5', '5']);

    $result = PokerResult::for($table['round'], $table['round']->task->game);

    expect($result['agreement'])->toBe(1.0)
        ->and($result['median'])->toBe(5.0)
        ->and($result['outliers'])->toBe(['low' => [], 'high' => []]);
});

it('takes the mean of the two middle values for an even number of votes', function () {
    $table = revealedPokerRound(['3', '5', '8', '13']);

    $result = PokerResult::for($table['round'], $table['round']->task->game);

    expect($result['median'])->toBe(6.5);
});

it('rounds the agreement to two decimals', function () {
    $table = revealedPokerRound(['5', '3', '8']);

    $result = PokerResult::for($table['round'], $table['round']->task->game);

    expect($result['agreement'])->toBe(0.33);
});

it('ignores the question mark and the coffee card', function () {
    $table = revealedPokerRound(['?', '☕', '3', '5', '5']);

    $result = PokerResult::for($table['round'], $table['round']->task->game);

    expect($result['median'])->toBe(5.0)
        ->and($result['spread'])->toBe(['min' => 3.0, 'max' => 5.0])
        ->and($result['agreement'])->toBe(0.67)
        ->and($result['outliers']['low'])->toBe([$table['players'][2]->id])
        ->and($result['outliers']['high'])->toBe([]);
});

it('gives nothing when only special cards were played', function () {
    $table = revealedPokerRound(['?', '☕']);

    $result = PokerResult::for($table['round'], $table['round']->task->game);

    expect($result['median'])->toBeNull()
        ->and($result['spread'])->toBeNull()
        ->and($result['agreement'])->toBeNull()
        ->and($result['outliers'])->toBe(['low' => [], 'high' => []]);
});

it('keeps the figures of an anonymous round but names nobody', function () {
    $table = revealedPokerRound(['3', '5', '5', '8'], anonymous: true);

    $result = PokerResult::for($table['round'], $table['round']->task->game);

    expect($result['median'])->toBe(5.0)
        ->and($result['spread'])->toBe(['min' => 3.0, 'max' => 8.0])
        ->and($result['agreement'])->toBe(0.5)
        ->and($result['outliers'])->toBe(['low' => [], 'high' => []]);
});

it('sends nothing before the reveal', function () {
    $table = pokerRevealTable();
    pokerVote($table['round'], $table['memberPlayer'], '5');

    $this->actingAs($table['member'])
        ->getJson(route('poker.tasks.rounds.index', [$table['game'], $table['round']->task]))
        ->assertOk()
        ->assertJsonPath('0.result', null);
});

it('carries the figures of each past round in the round history', function () {
    $table = pokerRevealTable();
    $guest = pokerGuest($table['game']);
    pokerVote($table['round'], $table['facilitatorPlayer'], '3');
    pokerVote($table['round'], $table['memberPlayer'], '5');
    pokerVote($table['round'], $guest, '5');
    $table['round']->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual]);

    $this->actingAs($table['member'])
        ->getJson(route('poker.tasks.rounds.index', [$table['game'], $table['round']->task]))
        ->assertOk()
        ->assertJsonPath('0.result.median', 5)
        ->assertJsonPath('0.result.spread', ['min' => 3, 'max' => 5])
        ->assertJsonPath('0.result.agreement', 0.67)
        ->assertJsonPath('0.result.outliers.low', [$table['facilitatorPlayer']->id])
        ->assertJsonPath('0.result.outliers.high', []);
});
