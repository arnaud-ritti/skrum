<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameLetterPicked;
use App\Events\Games\GameRoundEnded;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\User;
use App\Support\Games\GameWordBook;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
});

/**
 * @return array{0: GameRoom, 1: User, 2: GamePlayer, 3: GameRound}
 */
function hangmanTable(string $word): array
{
    $room = GameRoom::factory()->game(GameKind::Hangman)->linkAccess()->create();
    [$user, $player] = gameRoomHost($room);

    return [$room, $user, $player, activeGameRound($room, ['word' => $word])];
}

function pickLetter(GameRoom $room, GameRound $round, string $letter): TestResponse
{
    return test()->postJson(route('games.rounds.letters.store', [$room, $round]), ['letter' => $letter]);
}

it('starts with a word from the full pool and a blank mask', function () {
    app()->instance(GameWordBook::class, new GameWordBook(words: ['en' => [['word' => 'quasar', 'drawable' => false]]]));
    $room = GameRoom::factory()->game(GameKind::Hangman)->create();
    [$user] = gameRoomHost($room);

    $response = $this->actingAs($user)
        ->postJson(route('games.rounds.store', $room))
        ->assertCreated()
        ->assertJsonPath('round.mask', [null, null, null, null, null, null])
        ->assertJsonPath('round.misses', 0)
        ->assertJsonPath('round.maxMisses', 6)
        ->assertJsonPath('round.pickedLetters', []);

    expect(GameRound::query()->sole()->word)->toBe('quasar')
        ->and(gamePayloadExposesWord($response->getContent(), 'quasar'))->toBeFalse();
});

it('reveals every position of a hit and broadcasts the pick', function () {
    [$room, $user, $player, $round] = hangmanTable('zanzibar');

    $this->actingAs($user);

    pickLetter($room, $round, 'A')
        ->assertOk()
        ->assertJson([
            'roundId' => $round->id,
            'playerId' => $player->id,
            'letter' => 'a',
            'hit' => true,
            'mask' => [null, 'a', null, null, null, null, 'a', null],
            'misses' => 0,
            'ended' => null,
        ]);

    expect($round->fresh())
        ->revealed_positions->toBe([1, 6])
        ->picked_letters->toBe(['a'])
        ->picked_by->toBe([$player->id]);

    Event::assertDispatched(fn (GameLetterPicked $event) => $event->payload['hit'] === true
        && ! gamePayloadExposesWord($event->payload, 'zanzibar'));
});

it('reveals accented letters with their plain letter', function () {
    [$room, $user, , $round] = hangmanTable('Éléphant');

    $this->actingAs($user);

    pickLetter($room, $round, 'e')->assertOk()->assertJsonPath('mask', ['É', null, 'é', null, null, null, null, null]);
});

it('counts misses', function () {
    [$room, $user, , $round] = hangmanTable('kite');

    $this->actingAs($user);

    pickLetter($room, $round, 'z')->assertOk()->assertJsonPath('hit', false)->assertJsonPath('misses', 1);
});

it('refuses a letter picked twice and anything but one letter', function () {
    [$room, $user, , $round] = hangmanTable('kite');

    $this->actingAs($user);

    pickLetter($room, $round, 'k')->assertOk();
    $this->travel(2)->seconds();
    pickLetter($room, $round, 'K')->assertConflict()->assertJsonPath('message', __('This letter was already picked.'));

    foreach (['ab', '1', 'é', ''] as $letter) {
        $this->travel(2)->seconds();
        pickLetter($room, $round, $letter)->assertUnprocessable();
    }
});

it('solves the word and credits the last picker', function () {
    [$room, $user, $host, $round] = hangmanTable('kiki');
    $guest = gameRoomGuest($room);

    $this->actingAs($user);
    pickLetter($room, $round, 'k')->assertOk();

    resolve('auth')->forgetGuards();
    $response = $this->withCookies(gameGuestCookie($guest))
        ->withCredentials()
        ->postJson(route('games.rounds.letters.store', [$room, $round]), ['letter' => 'i'])
        ->assertOk()
        ->assertJsonPath('ended.outcome', 'solved')
        ->assertJsonPath('ended.word', 'kiki')
        ->assertJsonPath('ended.winnerPlayerId', $guest->id);

    expect($response->json('ended.points'))->toEqualCanonicalizing([
        ['playerId' => $host->id, 'points' => 2, 'isWin' => false],
        ['playerId' => $guest->id, 'points' => 7, 'isWin' => true],
    ])
        ->and($round->fresh()->outcome)->toBe(GameRoundOutcome::Solved);

    Event::assertDispatched(fn (GameRoundEnded $event) => $event->payload['word'] === 'kiki');
});

it('loses after six misses and keeps the hit points', function () {
    [$room, $user, $host, $round] = hangmanTable('kite');
    [, $member] = gameRoomMember($room);
    $round->forceFill([
        'picked_letters' => ['k', 'a', 'b', 'c', 'd', 'f'],
        'picked_by' => [$member->id, $host->id, $host->id, $host->id, $host->id, $host->id],
        'revealed_positions' => [0],
        'misses' => 5,
    ])->save();

    $this->actingAs($user);

    pickLetter($room, $round, 'g')->assertOk()->assertJsonPath('ended.outcome', 'lost');

    expect(GamePoint::query()->where('player_id', $member->id)->sole()->points)->toBe(1)
        ->and(GamePoint::query()->where('player_id', $host->id)->sole()->points)->toBe(0)
        ->and(GamePoint::query()->where('is_win', true)->count())->toBe(0);
});

it('scores hit points when the host gives up and nothing for watchers', function () {
    [$room, $user, $host, $round] = hangmanTable('kite');
    gameRoomMember($room);
    $round->forceFill(['picked_letters' => ['t'], 'picked_by' => [$host->id], 'revealed_positions' => [2]])->save();

    $this->actingAs($user)->postJson(route('games.rounds.pass.store', [$room, $round]))->assertOk();

    expect(GamePoint::query()->count())->toBe(1)
        ->and(GamePoint::query()->sole()->points)->toBe(1);
});

it('refuses a pick after the round ended', function () {
    [$room, $user, , $round] = hangmanTable('kite');
    $round->forceFill(['ended_at' => now(), 'outcome' => GameRoundOutcome::Solved])->save();

    $this->actingAs($user);

    pickLetter($room, $round, 'k')->assertConflict()->assertJsonPath('message', __('This round is over.'));

    expect(GamePoint::query()->count())->toBe(0);
});

it('refuses letters in other games', function () {
    $room = GameRoom::factory()->game(GameKind::DrawAndGuess)->create();
    [$user] = gameRoomHost($room);
    $round = activeGameRound($room, ['game' => GameKind::DrawAndGuess]);

    $this->actingAs($user);

    pickLetter($room, $round, 'a')->assertUnprocessable();
});

it('slows down a player picking too fast', function () {
    [$room, $user, , $round] = hangmanTable('abcdefghij');

    $this->actingAs($user);

    pickLetter($room, $round, 'a')->assertOk();
    pickLetter($room, $round, 'b')->assertOk();
    pickLetter($room, $round, 'c')->assertOk();
    pickLetter($room, $round, 'd')->assertTooManyRequests()->assertJsonPath('message', __('Slow down a little.'));

    $this->travel(1)->seconds();

    pickLetter($room, $round, 'd')->assertOk();
    pickLetter($room, $round, 'e')->assertTooManyRequests();
});

it('shows the full word and picks once the round ended', function () {
    [$room, $user, $host, $round] = hangmanTable('kite');
    $round->forceFill(['picked_letters' => ['k', 'z'], 'picked_by' => [$host->id, $host->id], 'revealed_positions' => [0], 'misses' => 1])->save();

    $this->actingAs($user)->postJson(route('games.rounds.pass.store', [$room, $round]))->assertOk();

    $this->actingAs($user)
        ->getJson(route('games.rounds.show', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('word', 'kite')
        ->assertJsonPath('mask', ['k', 'i', 't', 'e'])
        ->assertJsonPath('pickedLetters', ['k', 'z'])
        ->assertJsonPath('misses', 1)
        ->assertJsonMissingPath('pickedBy');
});

it('times out with the host timer', function () {
    [$room, $user, $host, $round] = hangmanTable('kite');
    $room->update(['timer_ends_at' => now()->addMinute()]);

    $this->travel(2)->minutes();

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))->assertOk()->assertJsonPath('history.0.outcome', 'timed_out');
});
