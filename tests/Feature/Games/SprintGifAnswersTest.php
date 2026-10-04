<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameAnswerChanged;
use App\Models\GameGifAnswer;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    fakeGameGifs('party', 'coffee');
});

it('sets an answer and tells the others only that the player answered', function () {
    [$room] = sprintGifRoom();
    [$user, $member] = gameRoomMember($room);
    $round = activeGifRound($room);

    $response = $this->actingAs($user)
        ->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => 'party'])
        ->assertOk();

    $answer = GameGifAnswer::query()->sole();

    expect($response->json())->toBe(['myAnswer' => ['id' => $answer->id, 'gif' => gameGifPayload('party'), 'caption' => null]])
        ->and($answer->player_id)->toBe($member->id);

    Event::assertDispatched(fn (GameAnswerChanged $event) => $event->broadcastWith() === [
        'roundId' => $round->id,
        'playerId' => $member->id,
        'answered' => true,
    ] && ! str_contains(gamePayloadJson($event->broadcastWith()), 'party'));
});

it('replaces the answer without telling the others again', function () {
    [$room] = sprintGifRoom();
    [$user] = gameRoomMember($room);
    $round = activeGifRound($room);

    $this->actingAs($user)->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => 'party'])->assertOk();
    $this->actingAs($user)->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => 'coffee'])->assertOk();

    expect(GameGifAnswer::query()->sole()->gif_id)->toBe('coffee');
    Event::assertDispatchedTimes(GameAnswerChanged::class, 1);
});

it('rate limits the answers of a player before the provider is asked', function () {
    [$room] = sprintGifRoom();
    [$user] = gameRoomMember($room);
    $round = activeGifRound($room);
    $uri = route('games.rounds.answer.update', [$room, $round]);

    foreach (range(1, 3) as $attempt) {
        $this->actingAs($user)->putJson($uri, ['gif_id' => "unknown{$attempt}"])->assertUnprocessable();
    }

    $this->actingAs($user)->putJson($uri, ['gif_id' => 'party'])
        ->assertTooManyRequests()
        ->assertJsonPath('message', __('Slow down a little.'));
});

it('removes the answer', function () {
    [$room] = sprintGifRoom();
    [$user, $member] = gameRoomMember($room);
    $round = activeGifRound($room);
    GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $member->id, 'gif_id' => 'party']);

    $this->actingAs($user)->deleteJson(route('games.rounds.answer.destroy', [$room, $round]))->assertNoContent();

    expect(GameGifAnswer::query()->count())->toBe(0);
    Event::assertDispatched(fn (GameAnswerChanged $event) => $event->answered === false);
});

it('lets the host and guests answer', function () {
    [$room, $hostUser] = sprintGifRoom();
    $guest = gameRoomGuest($room);
    $round = activeGifRound($room);

    $this->actingAs($hostUser)->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => 'party'])->assertOk();

    resolve('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))
        ->withCredentials()
        ->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => 'coffee'])
        ->assertOk();

    expect(GameGifAnswer::query()->count())->toBe(2);
});

it('refuses GIFs the provider does not know and malformed ids', function (string $gifId) {
    [$room, $user] = sprintGifRoom();
    $round = activeGifRound($room);

    $this->actingAs($user)
        ->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => $gifId])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('gif_id');

    expect(GameGifAnswer::query()->count())->toBe(0);
})->with(['unknown' => ['nope'], 'malformed' => ['bad id!'], 'too long' => [str_repeat('a', 65)]]);

it('refuses answers once the GIFs are revealed', function () {
    [$room, $user, $host] = sprintGifRoom();
    $round = activeGifRound($room, ['revealed_at' => now()]);
    GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $host->id, 'gif_id' => 'party']);

    $this->actingAs($user)
        ->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => 'coffee'])
        ->assertConflict()
        ->assertJsonPath('message', __('The GIFs are already revealed.'));

    $this->actingAs($user)->deleteJson(route('games.rounds.answer.destroy', [$room, $round]))->assertConflict();

    expect(GameGifAnswer::query()->sole()->gif_id)->toBe('party');
});

it('refuses answers on ended rounds and in other games', function () {
    [$room, $user] = sprintGifRoom();
    $ended = activeGifRound($room, ['ended_at' => now(), 'outcome' => GameRoundOutcome::Revealed]);

    $this->actingAs($user)
        ->putJson(route('games.rounds.answer.update', [$room, $ended]), ['gif_id' => 'party'])
        ->assertConflict()
        ->assertJsonPath('message', __('This round is over.'));

    $hangman = activeGameRound($room, ['game' => GameKind::Hangman]);

    $this->actingAs($user)
        ->putJson(route('games.rounds.answer.update', [$room, $hangman]), ['gif_id' => 'party'])
        ->assertUnprocessable();
});
