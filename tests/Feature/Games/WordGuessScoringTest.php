<?php

use App\Actions\Games\EndGameRound;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GameGuess;
use App\Models\GamePoint;
use Illuminate\Support\Facades\Event;

beforeEach(fn () => Event::fake());

dataset('word guess games', [GameKind::DrawAndGuess, GameKind::Decoded]);

it('scores a guessed round by the hints revealed', function (GameKind $game, int $hints, int $expected) {
    $table = wordGuessTable($game, 'retrospective', ['revealed_positions' => $hints === 0 ? [] : range(0, $hints - 1)]);
    [, $other] = gameRoomMember($table['room']);
    gameRoomMember($table['room']);
    GameGuess::factory()->create(['game_round_id' => $table['round']->id, 'player_id' => $other->id, 'text' => 'retro']);
    GameGuess::factory()->create(['game_round_id' => $table['round']->id, 'player_id' => $table['guesser']->id, 'text' => 'retrospective', 'is_correct' => true]);

    $ended = app(EndGameRound::class)->handle($table['room'], $table['round'], GameRoundOutcome::Guessed, $table['guesser']);

    expect($ended['points'])->toEqualCanonicalizing([
        ['playerId' => $table['leader']->id, 'points' => 5, 'isWin' => false],
        ['playerId' => $table['guesser']->id, 'points' => $expected, 'isWin' => true],
        ['playerId' => $other->id, 'points' => 0, 'isWin' => false],
    ])
        ->and(GamePoint::query()->count())->toBe(3)
        ->and(GamePoint::query()->where('player_id', $table['host']->id)->exists())->toBeFalse();
})->with('word guess games')->with([
    'no hint' => [0, 10],
    'one hint' => [1, 8],
    'three hints' => [3, 4],
    'five hints' => [5, 4],
]);

it('gives every actor a zero-point row when nobody guessed', function (GameKind $game, GameRoundOutcome $outcome) {
    $table = wordGuessTable($game);
    GameGuess::factory()->create(['game_round_id' => $table['round']->id, 'player_id' => $table['guesser']->id, 'text' => 'planet']);

    $ended = app(EndGameRound::class)->handle($table['room'], $table['round'], $outcome);

    expect($ended['points'])->toEqualCanonicalizing([
        ['playerId' => $table['leader']->id, 'points' => 0, 'isWin' => false],
        ['playerId' => $table['guesser']->id, 'points' => 0, 'isWin' => false],
    ]);
})->with('word guess games')->with([GameRoundOutcome::TimedOut, GameRoundOutcome::Passed]);

it('counts a guesser once however many guesses they made', function () {
    $table = wordGuessTable();
    GameGuess::factory()->count(3)->create(['game_round_id' => $table['round']->id, 'player_id' => $table['guesser']->id]);

    $ended = app(EndGameRound::class)->handle($table['room'], $table['round'], GameRoundOutcome::Passed);

    expect(collect($ended['points'])->where('playerId', $table['guesser']->id))->toHaveCount(1);
});
