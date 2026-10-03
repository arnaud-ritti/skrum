<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameGuessMade;
use App\Events\Games\GameRoundEnded;
use App\Events\Games\GameWordFound;
use App\Models\GameGuess;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\DrawAndGuessRules;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-27 10:00:00'));
});

/**
 * A Draw & Guess round on "rocket" with a drawer and three guessers, started with them.
 *
 * @param  array<string, mixed>  $roundAttributes
 * @return array<string, mixed>
 */
function findersTable(array $roundAttributes = []): array
{
    $table = wordGuessTable(GameKind::DrawAndGuess, 'rocket', ['guessers_total' => 3, ...$roundAttributes]);
    [$secondUser, $second] = gameRoomMember($table['room']);
    [$thirdUser, $third] = gameRoomMember($table['room']);

    return [...$table, 'secondUser' => $secondUser, 'second' => $second, 'thirdUser' => $thirdUser, 'third' => $third];
}

it('counts the guessers the host sends, without the drawer', function () {
    $room = GameRoom::factory()->game(GameKind::DrawAndGuess)->create();
    [$hostUser, $host] = gameRoomHost($room);
    [, $drawer] = gameRoomMember($room);
    [, $guesser] = gameRoomMember($room);

    $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room), [
        'leader_player_id' => $drawer->id,
        'guesser_player_ids' => [$host->id, $drawer->id, $guesser->id],
    ])->assertCreated()->assertJsonPath('round.guessersTotal', 2)->assertJsonPath('round.finders', []);

    $stranger = gameRoomMember(GameRoom::factory()->create())[1];

    $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room), [
        'leader_player_id' => $drawer->id,
        'guesser_player_ids' => [$stranger->id],
    ])->assertUnprocessable()->assertJsonValidationErrors('guesser_player_ids.0');
});

it('keeps the round going after a first finder, and tells the others who found without the word', function () {
    $table = findersTable();

    $this->travel(18)->seconds();

    $response = $this->actingAs($table['guesserUser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'Rocket'])
        ->assertOk()
        ->assertJsonPath('result', 'correct')
        ->assertJsonPath('ended', null)
        ->assertJsonPath('found', ['playerId' => $table['guesser']->id, 'seconds' => 18, 'points' => 10])
        ->assertJsonPath('word', 'rocket');

    expect($table['round']->fresh()->isActive())->toBeTrue()
        ->and(GameGuess::query()->where('is_correct', true)->sole()->hints)->toBe(0);

    Event::assertDispatched(fn (GameWordFound $event) => $event->payload === [
        'roundId' => $table['round']->id,
        'playerId' => $table['guesser']->id,
        'seconds' => 18,
        'points' => 10,
    ] && ! gamePayloadExposesWord($event->broadcastWith(), 'rocket'));
    Event::assertNotDispatched(GameGuessMade::class);
    Event::assertNotDispatched(GameRoundEnded::class);
    expect(gamePayloadExposesWord($response->json('found'), 'rocket'))->toBeFalse();
});

it('gives the word to the drawer and the finders only, and every viewer the finders', function () {
    $table = findersTable();

    $this->actingAs($table['guesserUser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'rocket'])
        ->assertOk();

    $room = $table['room']->fresh();

    expect(gameSnapshotFor($room, $table['guesser'])['round']['word'])->toBe('rocket')
        ->and(gameSnapshotFor($room, $table['leader'])['round']['word'])->toBe('rocket')
        ->and(gameSnapshotFor($room, $table['leader'])['round']['wordChangesLeft'])->toBe(1)
        ->and(gamePayloadExposesWord(gameSnapshotFor($room, $table['second']), 'rocket'))->toBeFalse()
        ->and(gamePayloadExposesWord(gameSnapshotFor($room, $table['host']), 'rocket'))->toBeFalse()
        ->and(gameSnapshotFor($room, $table['second'])['round']['finders'])->toBe([['playerId' => $table['guesser']->id, 'seconds' => 0, 'points' => 10]])
        ->and(gameSnapshotFor($room, $table['second'])['round']['guessersTotal'])->toBe(3)
        ->and(gameSnapshotFor($room, $table['second'])['round']['pointsPerFinder'])->toBe(5)
        ->and(gameSnapshotFor($room, $table['second'])['round'])->not->toHaveKey('wordChangesLeft');
});

it('refuses a second guess from a finder', function () {
    $table = findersTable();
    $uri = route('games.rounds.guesses.store', [$table['room'], $table['round']]);

    $this->actingAs($table['guesserUser'])->postJson($uri, ['text' => 'rocket'])->assertOk();
    $this->travel(2)->seconds();
    $this->actingAs($table['guesserUser'])->postJson($uri, ['text' => 'planet'])
        ->assertConflict()
        ->assertJsonPath('message', __('You have already found the word.'));

    expect(GameGuess::query()->count())->toBe(1);
});

it('ends the round when every guesser has found, with the points of each finder and five per finder for the drawer', function () {
    $table = findersTable();
    $uri = route('games.rounds.guesses.store', [$table['room'], $table['round']]);

    $this->actingAs($table['guesserUser'])->postJson($uri, ['text' => 'rocket'])->assertJsonPath('ended', null);

    $table['round']->forceFill(['revealed_positions' => [0]])->save();
    $this->travel(31)->seconds();
    $this->actingAs($table['secondUser'])->postJson($uri, ['text' => 'rocket'])->assertJsonPath('ended', null);

    $table['round']->forceFill(['revealed_positions' => [0, 2]])->save();
    $this->travel(10)->seconds();

    $this->actingAs($table['thirdUser'])->postJson($uri, ['text' => 'rocket'])
        ->assertOk()
        ->assertJsonPath('ended.outcome', 'guessed')
        ->assertJsonPath('ended.winnerPlayerId', $table['guesser']->id)
        ->assertJsonPath('ended.finders.1', ['playerId' => $table['second']->id, 'seconds' => 31, 'points' => 8])
        ->assertJsonPath('ended.finders.2', ['playerId' => $table['third']->id, 'seconds' => 41, 'points' => 6]);

    $points = GamePoint::query()->get()->keyBy('player_id');

    expect($table['round']->fresh()->outcome)->toBe(GameRoundOutcome::Guessed)
        ->and($points[$table['guesser']->id]->points)->toBe(10)
        ->and($points[$table['guesser']->id]->is_win)->toBeTrue()
        ->and($points[$table['second']->id]->points)->toBe(8)
        ->and($points[$table['third']->id]->points)->toBe(6)
        ->and($points[$table['third']->id]->is_win)->toBeTrue()
        ->and($points[$table['leader']->id]->points)->toBe(15)
        ->and($points[$table['leader']->id]->is_win)->toBeFalse();
});

it('keeps the finders\' points when time runs out, the host passes or starts the next round', function (string $how) {
    $table = findersTable();
    [, $fourth] = gameRoomMember($table['room']);

    $this->actingAs($table['guesserUser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'rocket'])
        ->assertOk();
    $this->actingAs($table['secondUser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'planet'])
        ->assertOk();

    match ($how) {
        'timer' => (function () use ($table) {
            $this->travel(5)->seconds();
            $table['room']->forceFill(['timer_ends_at' => now()->subSecond()])->save();
            $this->actingAs($table['hostUser'])->getJson(route('games.snapshot.show', $table['room']))->assertOk();
        })(),
        'pass' => $this->actingAs($table['hostUser'])->postJson(route('games.rounds.pass.store', [$table['room'], $table['round']]))->assertOk(),
        'next' => $this->actingAs($table['hostUser'])->postJson(route('games.rounds.store', $table['room']), ['leader_player_id' => $fourth->id])->assertCreated(),
    };

    $points = GamePoint::query()->get()->keyBy('player_id');

    expect($table['round']->fresh()->outcome)->toBe(GameRoundOutcome::Guessed)
        ->and($points[$table['guesser']->id]->points)->toBe(10)
        ->and($points[$table['second']->id]->points)->toBe(0)
        ->and($points[$table['leader']->id]->points)->toBe(5);
})->with(['timer', 'pass', 'next']);

it('passes as before when nobody found', function () {
    $table = findersTable();

    $this->actingAs($table['hostUser'])
        ->postJson(route('games.rounds.pass.store', [$table['room'], $table['round']]))
        ->assertOk()
        ->assertJsonPath('ended.outcome', 'passed');
});

it('ends a round started without guessers at the first correct guess, as before', function (GameKind $game) {
    $table = wordGuessTable($game);

    $this->actingAs($table['guesserUser'])
        ->postJson(route('games.rounds.guesses.store', [$table['room'], $table['round']]), ['text' => 'rocket'])
        ->assertOk()
        ->assertJsonPath('ended.outcome', 'guessed')
        ->assertJsonMissingPath('found');

    expect(GamePoint::query()->where('player_id', $table['leader']->id)->sole()->points)->toBe(5);
})->with([GameKind::DrawAndGuess, GameKind::Decoded]);

it('scores a legacy correct guess without hints from the round\'s revealed letters', function () {
    $table = findersTable(['revealed_positions' => [0, 1]]);
    GameGuess::factory()->create(['game_round_id' => $table['round']->id, 'player_id' => $table['guesser']->id, 'text' => 'rocket', 'is_correct' => true, 'hints' => null]);

    expect(DrawAndGuessRules::finders($table['round']->fresh())[0]['points'])->toBe(6);
});

it('puts the clue of a Decoded round in the history, and none for another game', function () {
    $room = GameRoom::factory()->game(GameKind::Decoded)->create();
    [$hostUser] = gameRoomHost($room);
    GameRound::factory()->for($room, 'room')->create(['game' => GameKind::Decoded, 'word' => 'rocket', 'clue' => ['🚀', '🌙'], 'number' => 1, 'ended_at' => now(), 'outcome' => GameRoundOutcome::Guessed]);
    GameRound::factory()->for($room, 'room')->create(['game' => GameKind::DrawAndGuess, 'word' => 'tree', 'ended_at' => now()->subMinute(), 'outcome' => GameRoundOutcome::TimedOut]);

    $history = $this->actingAs($hostUser)->getJson(route('games.rounds.index', $room))->assertOk()->json();

    expect($history[0]['clue'])->toBe(['🚀', '🌙'])
        ->and($history[1]['clue'])->toBeNull();
});
