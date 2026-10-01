<?php

use App\Actions\Games\BuildGameSnapshot;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameRoundStarted;
use App\Models\GameGuess;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameWordBook;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
    app()->instance(GameWordBook::class, new GameWordBook(words: ['en' => [['word' => 'rocket', 'drawable' => true]]]));
});

it('offers both games in the picker', function () {
    $room = GameRoom::factory()->create();
    [, $host] = gameRoomHost($room);

    $games = collect(resolve(BuildGameSnapshot::class)->handle($room, $host)['games'])->pluck('available', 'value');

    expect($games['draw'])->toBeTrue()
        ->and($games['decoded'])->toBeTrue();
});

it('requires a leader to start', function (GameKind $game) {
    $room = GameRoom::factory()->game($game)->create();
    [$user] = gameRoomHost($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['leader_player_id' => __('Choose who leads this round.')]);

    expect(GameRound::query()->count())->toBe(0);
})->with([GameKind::DrawAndGuess, GameKind::Decoded]);

it('draws Draw & Guess words from the drawable pool', function () {
    app()->instance(GameWordBook::class, new GameWordBook(words: ['en' => [
        ['word' => 'meeting', 'drawable' => false],
        ['word' => 'rocket', 'drawable' => true],
    ]]));
    $room = GameRoom::factory()->game(GameKind::DrawAndGuess)->create();
    [$user] = gameRoomHost($room);
    [, $leader] = gameRoomMember($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room), ['leader_player_id' => $leader->id])
        ->assertCreated()
        ->assertJsonPath('round.leaderPlayerId', $leader->id);

    expect(GameRound::query()->sole()->word)->toBe('rocket');
});

it('draws Decoded words from every word', function () {
    app()->instance(GameWordBook::class, new GameWordBook(words: ['en' => [['word' => 'meeting', 'drawable' => false]]]));
    $room = GameRoom::factory()->game(GameKind::Decoded)->create();
    [$user] = gameRoomHost($room);
    [, $leader] = gameRoomMember($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room), ['leader_player_id' => $leader->id])->assertCreated();

    expect(GameRound::query()->sole()->word)->toBe('meeting');
});

it('shows the word to the leader only', function (GameKind $game) {
    $room = GameRoom::factory()->game($game)->linkAccess()->create();
    [$hostUser] = gameRoomHost($room);
    [$leaderUser, $leader] = gameRoomMember($room);
    $guest = gameRoomGuest($room);

    $start = $this->actingAs($hostUser)
        ->postJson(route('games.rounds.store', $room), ['leader_player_id' => $leader->id])
        ->assertCreated();

    expect($start->json('round'))->not->toHaveKey('word')
        ->and($start->json('round.mask'))->toBe([null, null, null, null, null, null])
        ->and($start->json('round.maxHints'))->toBe(3)
        ->and($start->json('round.guesses'))->toBe([])
        ->and(gamePayloadExposesWord($start->json(), 'rocket'))->toBeFalse();

    $this->actingAs($leaderUser)->getJson(route('games.snapshot.show', $room))->assertJsonPath('round.word', 'rocket');
    $this->actingAs($hostUser)->getJson(route('games.snapshot.show', $room))->assertJsonMissingPath('round.word');

    resolve('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))->getJson(route('games.snapshot.show', $room))->assertJsonMissingPath('round.word');

    Event::assertDispatched(fn (GameRoundStarted $event) => ! array_key_exists('word', $event->round)
        && ! gamePayloadExposesWord($event->round, 'rocket'));
})->with([GameKind::DrawAndGuess, GameKind::Decoded]);

it('gives the word to a host who leads the round', function () {
    $room = GameRoom::factory()->game(GameKind::DrawAndGuess)->create();
    [$hostUser, $host] = gameRoomHost($room);
    gameRoomMember($room);

    $this->actingAs($hostUser)
        ->postJson(route('games.rounds.store', $room), ['leader_player_id' => $host->id])
        ->assertCreated()
        ->assertJsonPath('round.word', 'rocket');
});

it("presents wrong and near guesses and flags only the viewer's near misses", function () {
    $table = wordGuessTable();
    [$otherUser, $other] = gameRoomMember($table['room']);
    $wrong = GameGuess::factory()->create(['game_round_id' => $table['round']->id, 'player_id' => $other->id, 'text' => 'planet', 'created_at' => now()->subSeconds(3)]);
    $near = GameGuess::factory()->create(['game_round_id' => $table['round']->id, 'player_id' => $table['guesser']->id, 'text' => 'rockt', 'is_near_miss' => true, 'created_at' => now()->subSeconds(2)]);
    GameGuess::factory()->create(['game_round_id' => $table['round']->id, 'player_id' => $other->id, 'text' => 'RoCkEt', 'is_correct' => true, 'created_at' => now()->subSecond()]);

    $guesserView = $this->actingAs($table['guesserUser'])->getJson(route('games.snapshot.show', $table['room']))->json('round.guesses');
    $otherView = $this->actingAs($otherUser)->getJson(route('games.snapshot.show', $table['room']))->json('round.guesses');

    expect($guesserView)->toBe([
        ['id' => $wrong->id, 'playerId' => $other->id, 'text' => 'planet'],
        ['id' => $near->id, 'playerId' => $table['guesser']->id, 'text' => 'rockt', 'veryClose' => true],
    ])
        ->and($otherView)->toBe([
            ['id' => $wrong->id, 'playerId' => $other->id, 'text' => 'planet'],
            ['id' => $near->id, 'playerId' => $table['guesser']->id, 'text' => 'rockt'],
        ])
        ->and(gamePayloadJson($guesserView))->not->toContain('RoCkEt');
});

it('keeps the fifty latest guesses, oldest first', function () {
    $table = wordGuessTable();

    foreach (range(1, 55) as $index) {
        GameGuess::factory()->create([
            'game_round_id' => $table['round']->id,
            'player_id' => $table['guesser']->id,
            'text' => "guess {$index}",
            'created_at' => now()->subSeconds(100 - $index),
        ]);
    }

    $guesses = $this->actingAs($table['hostUser'])->getJson(route('games.snapshot.show', $table['room']))->json('round.guesses');

    expect($guesses)->toHaveCount(50)
        ->and($guesses[0]['text'])->toBe('guess 6')
        ->and($guesses[49]['text'])->toBe('guess 55');
});

it('shows the drawing while active and in the ended round', function () {
    $fill = ['type' => 'fill', 'color' => 'red', 'x' => 1, 'y' => 1];
    $table = wordGuessTable(GameKind::DrawAndGuess, 'kite', ['drawing' => [$fill]]);

    $this->actingAs($table['guesserUser'])
        ->getJson(route('games.snapshot.show', $table['room']))
        ->assertJson(['round' => ['drawing' => [$fill]]]);

    $table['round']->forceFill(['ended_at' => now(), 'outcome' => GameRoundOutcome::Passed])->save();

    $this->actingAs($table['guesserUser'])
        ->getJson(route('games.rounds.show', [$table['room'], $table['round']]))
        ->assertOk()
        ->assertJsonPath('word', 'kite')
        ->assertJsonPath('mask', ['k', 'i', 't', 'e'])
        ->assertJson(['drawing' => [$fill]])
        ->assertJsonMissingPath('guesses');
});

it('shows the clue while active and in the ended round', function () {
    $table = wordGuessTable(GameKind::Decoded, 'kite', ['clue' => ['🪁', '🌬️']]);

    $this->actingAs($table['guesserUser'])
        ->getJson(route('games.snapshot.show', $table['room']))
        ->assertJsonPath('round.clue', ['🪁', '🌬️'])
        ->assertJsonMissingPath('round.drawing');

    $table['round']->forceFill(['ended_at' => now(), 'outcome' => GameRoundOutcome::Passed])->save();

    $this->actingAs($table['guesserUser'])
        ->getJson(route('games.rounds.show', [$table['room'], $table['round']]))
        ->assertOk()
        ->assertJsonPath('clue', ['🪁', '🌬️'])
        ->assertJsonMissingPath('drawing');
});

it('times out when the host timer runs out', function (GameKind $game) {
    $table = wordGuessTable($game);
    $table['room']->update(['timer_ends_at' => now()->addMinute()]);

    $this->travel(2)->minutes();

    $this->actingAs($table['hostUser'])
        ->getJson(route('games.snapshot.show', $table['room']))
        ->assertJsonPath('round', null)
        ->assertJsonPath('history.0.outcome', 'timed_out')
        ->assertJsonPath('history.0.word', 'rocket');
})->with([GameKind::DrawAndGuess, GameKind::Decoded]);

it('builds the snapshot of a word-guess round with a constant number of queries', function () {
    $count = function (int $guesses): int {
        $table = wordGuessTable();

        foreach (range(1, $guesses) as $index) {
            GameGuess::factory()->create(['game_round_id' => $table['round']->id, 'player_id' => $table['guesser']->id]);
        }

        $room = $table['room']->fresh();
        $viewer = $table['guesser']->fresh();

        DB::flushQueryLog();
        DB::enableQueryLog();
        resolve(BuildGameSnapshot::class)->handle($room, $viewer);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    expect($count(30))->toBe($count(2));
});
