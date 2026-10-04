<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GameChoice;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\GameStatementSet;
use App\Models\GameTextAnswer;
use App\Support\Games\GameWordBook;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Event::fake();
    app()->instance(GameWordBook::class, new GameWordBook(prompts: ['en' => ['What was your first job?']]));
});

/**
 * @param  array<string, mixed>  $body
 */
function asGameGuest(GamePlayer $guest, string $method, string $uri, array $body = []): TestResponse
{
    resolve('auth')->forgetGuards();

    return test()->withCredentials()->withCookies(gameGuestCookie($guest))->{$method}($uri, $body);
}

/**
 * @return array<string, array{0: int, 1: bool}>
 */
function gamePointsByPlayer(GameRound $round): array
{
    return GamePoint::query()->where('game_round_id', $round->id)->get()
        ->mapWithKeys(fn (GamePoint $point): array => [$point->player_id => [$point->points, $point->is_win]])
        ->all();
}

it('lets a guest pick a weather, counts them among the pickers and gives them a round played', function () {
    $room = GameRoom::factory()->game(GameKind::MoodWeather)->linkAccess()->create();
    [$hostUser, $host] = gameRoomHost($room);
    [$aUser, $a] = gameRoomMember($room);
    $guest = gameRoomGuest($room);
    $round = activeGameRound($room, ['word' => null]);
    $choice = route('games.rounds.choice.update', [$room, $round]);
    $this->actingAs($hostUser)->putJson($choice, ['choice' => 'sunny'])->assertNoContent();
    $this->actingAs($aUser)->putJson($choice, ['choice' => 'rainy'])->assertNoContent();

    asGameGuest($guest, 'putJson', $choice, ['choice' => 'sunny'])->assertNoContent();

    $this->actingAs($hostUser)->postJson(route('games.rounds.reveal.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('ended.answered', 3);

    expect(GameChoice::query()->where('player_id', $guest->id)->sole()->choice)->toBe('sunny')
        ->and(gamePointsByPlayer($round))->toEqual([$host->id => [0, false], $a->id => [0, false], $guest->id => [0, false]]);
});

it('refuses a weather once the weather is shown', function () {
    $room = GameRoom::factory()->game(GameKind::MoodWeather)->linkAccess()->create();
    [$hostUser] = gameRoomHost($room);
    $guest = gameRoomGuest($room);
    $round = activeGameRound($room, ['word' => null]);
    $this->actingAs($hostUser)->postJson(route('games.rounds.reveal.store', [$room, $round]))->assertOk();

    asGameGuest($guest, 'putJson', route('games.rounds.choice.update', [$room, $round]), ['choice' => 'cloudy'])
        ->assertConflict()
        ->assertJsonPath('message', __('This round is over.'));

    expect(GameChoice::query()->count())->toBe(0);
});

it('lets a guest tell their own set in Two truths and scores them for each player fooled', function () {
    $room = GameRoom::factory()->game(GameKind::TwoTruths)->linkAccess()->create();
    [$hostUser, $host] = gameRoomHost($room);
    [$aUser, $a] = gameRoomMember($room);
    $guest = gameRoomGuest($room);
    asGameGuest($guest, 'putJson', route('games.statements.update', $room), ['statements' => ['I ski', 'I sing', 'I fly'], 'lie_index' => 1])->assertOk();

    $round = $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room), ['leader_player_id' => $guest->id])
        ->assertCreated()
        ->assertJsonPath('round.leaderPlayerId', $guest->id)
        ->json('round');
    $choice = route('games.rounds.choice.update', [$room, $round['id']]);
    $this->actingAs($hostUser)->putJson($choice, ['choice' => '0'])->assertNoContent();
    $this->actingAs($aUser)->putJson($choice, ['choice' => '2'])->assertNoContent();

    asGameGuest($guest, 'putJson', $choice, ['choice' => '1'])->assertForbidden();
    asGameGuest($guest, 'postJson', route('games.rounds.reveal.store', [$room, $round['id']]))
        ->assertOk()
        ->assertJsonPath('ended.lieIndex', 1);

    expect(gamePointsByPlayer(GameRound::query()->findOrFail($round['id'])))
        ->toEqual([$host->id => [0, false], $a->id => [0, false], $guest->id => [4, false]]);
});

it('lets a guest find the lie in Two truths and win the round', function () {
    $room = GameRoom::factory()->game(GameKind::TwoTruths)->linkAccess()->create();
    [$hostUser] = gameRoomHost($room);
    [, $teller] = gameRoomMember($room);
    $guest = gameRoomGuest($room);
    GameStatementSet::factory()->create(['game_room_id' => $room->id, 'player_id' => $teller->id, 'statements' => ['I ski', 'I sing', 'I fly'], 'lie_index' => 2]);
    $round = $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room), ['leader_player_id' => $teller->id])->json('round');

    asGameGuest($guest, 'putJson', route('games.rounds.choice.update', [$room, $round['id']]), ['choice' => '2'])->assertNoContent();

    $this->actingAs($hostUser)->postJson(route('games.rounds.reveal.store', [$room, $round['id']]))->assertOk();

    expect(gamePointsByPlayer(GameRound::query()->findOrFail($round['id']))[$guest->id])->toBe([5, true]);
});

it('lets a guest answer Guess who? and, when another answer is drawn, name its author and win', function () {
    $room = GameRoom::factory()->game(GameKind::GuessWho)->linkAccess()->create();
    [$hostUser] = gameRoomHost($room);
    [, $a] = gameRoomMember($room);
    $guest = gameRoomGuest($room);
    $round = activeGameRound($room, ['word' => null, 'question' => 'What was your first job?']);

    asGameGuest($guest, 'putJson', route('games.rounds.textAnswer.update', [$room, $round]), ['text' => 'Paperboy'])->assertOk();

    $drawn = GameTextAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $a->id, 'text' => 'Lifeguard']);
    $drawn->forceFill(['is_drawn' => true])->save();
    $round->forceFill(['revealed_at' => now()])->save();

    asGameGuest($guest, 'putJson', route('games.rounds.choice.update', [$room, $round]), ['choice' => $a->id])->assertNoContent();

    $this->actingAs($hostUser)->postJson(route('games.rounds.close.store', [$room, $round]))->assertOk();

    expect(GameTextAnswer::query()->where('player_id', $guest->id)->sole()->text)->toBe('Paperboy')
        ->and(gamePointsByPlayer($round))->toMatchArray([$guest->id => [5, true], $a->id => [0, false]]);
});

it('lets a guest end their own speaking turn in Quick question and counts their turn as played', function () {
    $room = GameRoom::factory()->game(GameKind::QuickQuestion)->linkAccess()->create();
    [$hostUser, $host] = gameRoomHost($room);
    $guest = gameRoomGuest($room);
    $round = $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room), ['turn_order' => [$guest->id, $host->id]])
        ->assertCreated()
        ->assertJsonPath('round.turnPlayerId', $guest->id)
        ->json('round');
    $turn = route('games.rounds.turn.store', [$room, $round['id']]);

    asGameGuest($guest, 'postJson', $turn, ['expected_player_id' => $guest->id])
        ->assertOk()
        ->assertJsonPath('turn.turnPlayerId', $host->id);
    asGameGuest($guest, 'postJson', $turn, ['expected_player_id' => $host->id])->assertForbidden();

    $this->actingAs($hostUser)->postJson($turn, ['expected_player_id' => $host->id])->assertOk();

    $ended = GameRound::query()->findOrFail($round['id']);

    expect($ended->outcome)->toBe(GameRoundOutcome::Finished)
        ->and(gamePointsByPlayer($ended))->toEqual([$guest->id => [0, false], $host->id => [0, false]]);
});

it('lets a guest guess the whole word in their hangman turn and win the round', function () {
    $room = GameRoom::factory()->game(GameKind::Hangman)->linkAccess()->create(['takes_turns' => true]);
    [, $host] = gameRoomHost($room);
    $guest = gameRoomGuest($room);
    $round = activeGameRound($room, ['word' => 'quartz', 'turn_order' => [$guest->id, $host->id], 'turn_player_id' => $guest->id]);

    asGameGuest($guest, 'postJson', route('games.rounds.wordGuesses.store', [$room, $round]), ['text' => 'QUARTZ'])->assertOk();

    expect($round->fresh())
        ->outcome->toBe(GameRoundOutcome::Solved)
        ->winner_player_id->toBe($guest->id)
        ->and(gamePointsByPlayer($round)[$guest->id])->toBe([5, true]);
});

it('counts a whole-word guess against the bucket of the letters', function () {
    $room = GameRoom::factory()->game(GameKind::Hangman)->linkAccess()->create();
    gameRoomHost($room);
    $guest = gameRoomGuest($room);
    $round = activeGameRound($room, ['word' => 'quartz']);

    foreach (['x', 'y', 'w'] as $letter) {
        asGameGuest($guest, 'postJson', route('games.rounds.letters.store', [$room, $round]), ['letter' => $letter])->assertOk();
    }

    asGameGuest($guest, 'postJson', route('games.rounds.wordGuesses.store', [$room, $round]), ['text' => 'quartz'])
        ->assertTooManyRequests();

    expect($round->fresh()->ended_at)->toBeNull();
});
