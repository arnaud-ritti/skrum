<?php

use App\Events\Games\GameAnswerChanged;
use App\Events\Games\GameRoundRevealed;
use App\Models\GameGifAnswer;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Event::fake();
    fakeGameGifs('gifA', 'gifB');
});

it('sends a caption with the GIF and changes it until the reveal', function () {
    [$room, $user, $host] = sprintGifRoom();
    $round = activeGifRound($room);

    $this->actingAs($user)->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => 'gifA', 'caption' => '  CI on Friday at 6 pm  '])
        ->assertOk()
        ->assertJsonPath('myAnswer.caption', 'CI on Friday at 6 pm');

    $this->actingAs($user)->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => 'gifA', 'caption' => ''])
        ->assertOk()
        ->assertJsonPath('myAnswer.caption', null);

    $this->actingAs($user)->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => 'gifA', 'caption' => str_repeat('a', 61)])
        ->assertUnprocessable();

    expect(GameGifAnswer::query()->sole()->caption)->toBeNull();
});

it('keeps the caption when only the GIF changes, and asks the provider only for a new GIF', function () {
    [$room, $user] = sprintGifRoom();
    $round = activeGifRound($room);

    $this->actingAs($user)->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => 'gifA', 'caption' => 'Friday deploys'])->assertOk();

    $this->actingAs($user)->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => 'gifB'])
        ->assertOk()
        ->assertJsonPath('myAnswer.gif.id', 'gifB')
        ->assertJsonPath('myAnswer.caption', 'Friday deploys');

    Http::assertSentCount(2);

    $this->actingAs($user)->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => 'gifB', 'caption' => 'Friday rollbacks'])
        ->assertOk()
        ->assertJsonPath('myAnswer.caption', 'Friday rollbacks');

    Http::assertSentCount(2);
});

it('keeps a caption from the other players until the reveal, then shows it to everyone', function () {
    [$room, $user, $host] = sprintGifRoom();
    [$memberUser, $member] = gameRoomMember($room);
    $round = activeGifRound($room);

    $this->actingAs($memberUser)->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => 'gifB', 'caption' => 'Three days of refinement'])->assertOk();

    expect(gamePayloadExposesWord(gameSnapshotFor($room, $host), 'Three days of refinement'))->toBeFalse();
    Event::assertDispatched(GameAnswerChanged::class, fn (GameAnswerChanged $event) => ! gamePayloadExposesWord($event->broadcastWith(), 'Three days of refinement'));

    $this->actingAs($user)->postJson(route('games.rounds.reveal.store', [$room, $round]))->assertOk();

    Event::assertDispatched(GameRoundRevealed::class, fn (GameRoundRevealed $event) => $event->payload['answers'][0]['caption'] === 'Three days of refinement');

    $this->actingAs($user)->postJson(route('games.rounds.close.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('ended.answers.0.caption', 'Three days of refinement');
});
