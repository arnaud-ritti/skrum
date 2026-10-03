<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameGuessMade;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;

beforeEach(fn () => Event::fake());

function guessWord(GameRoom $room, GameRound $round, string $text): TestResponse
{
    return test()->postJson(route('games.rounds.wordGuesses.store', [$room, $round]), ['text' => $text]);
}

it('solves the word for its guesser, with the solve bonus and the win, without broadcasting the guess', function () {
    $room = GameRoom::factory()->game(GameKind::Hangman)->linkAccess()->create();
    [$user, $player] = gameRoomHost($room);
    $round = activeGameRound($room, ['word' => 'déploiement', 'picked_letters' => ['e'], 'picked_by' => [$player->id], 'revealed_positions' => [1, 6, 8]]);

    $this->actingAs($user);

    guessWord($room, $round, 'DEPLOIEMENT')
        ->assertOk()
        ->assertJsonPath('result', 'correct')
        ->assertJsonPath('ended.outcome', GameRoundOutcome::Solved->value)
        ->assertJsonPath('ended.winnerPlayerId', $player->id);

    expect(GamePoint::query()->where('player_id', $player->id)->sole())
        ->points->toBe(3 + 5)
        ->is_win->toBeTrue();

    Event::assertNotDispatched(GameGuessMade::class);
});

it('costs a life for a wrong word, shows it in the round, and loses the round at six misses', function () {
    $room = GameRoom::factory()->game(GameKind::Hangman)->create();
    [$user, $player] = gameRoomHost($room);
    $round = activeGameRound($room, ['word' => 'rocket', 'misses' => 4]);

    $this->actingAs($user);

    guessWord($room, $round, 'pocket')->assertOk()->assertJsonPath('result', 'wrong')->assertJsonPath('misses', 5)->assertJsonPath('ended', null);

    Event::assertDispatched(GameGuessMade::class, fn (GameGuessMade $event) => $event->payload['text'] === 'pocket' && $event->payload['misses'] === 5);

    $this->getJson(route('games.snapshot.show', $room))->assertJsonPath('round.wordGuesses', [['playerId' => $player->id, 'text' => 'pocket']]);

    guessWord($room, $round, 'socket')->assertOk()->assertJsonPath('ended.outcome', GameRoundOutcome::Lost->value);

    expect(GamePoint::query()->where('player_id', $player->id)->sole()->points)->toBe(0);
});

it('takes the turn of its guesser and refuses one out of turn', function () {
    $room = GameRoom::factory()->game(GameKind::Hangman)->create(['takes_turns' => true]);
    gameRoomHost($room);
    [$aUser, $a] = gameRoomMember($room);
    [$bUser, $b] = gameRoomMember($room);
    $round = activeGameRound($room, ['word' => 'rocket', 'turn_order' => [$a->id, $b->id], 'turn_player_id' => $a->id]);

    $this->actingAs($bUser);
    guessWord($room, $round, 'pocket')->assertForbidden();

    $this->actingAs($aUser);
    guessWord($room, $round, 'pocket')->assertOk();

    expect($round->fresh()->turn_player_id)->toBe($b->id);
});

it('refuses a word guess in another game and an empty or long text', function () {
    $table = wordGuessTable(GameKind::DrawAndGuess);

    $this->actingAs($table['guesserUser']);
    guessWord($table['room'], $table['round'], 'rocket')->assertUnprocessable();

    $room = GameRoom::factory()->game(GameKind::Hangman)->create();
    [$user] = gameRoomHost($room);
    $round = activeGameRound($room, ['word' => 'rocket']);

    $this->actingAs($user);
    guessWord($room, $round, '')->assertUnprocessable();
    guessWord($room, $round, str_repeat('a', 51))->assertUnprocessable();
});
