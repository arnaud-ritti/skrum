<?php

use App\Enums\GameKind;
use App\Events\Games\GameAnswerChanged;
use App\Events\Games\GameRoundEnded;
use App\Events\Games\GameRoundRevealed;
use App\Models\GameChoice;
use App\Models\GameRoom;
use App\Models\GameTextAnswer;
use Illuminate\Support\Facades\Event;

beforeEach(fn () => Event::fake());

it('never shows an answer that was not drawn, the drawn author before the close, or who voted', function () {
    $room = GameRoom::factory()->game(GameKind::GuessWho)->create();
    [$hostUser, $host] = gameRoomHost($room);
    [$aUser, $a] = gameRoomMember($room);
    [, $b] = gameRoomMember($room);
    $round = activeGameRound($room, ['word' => null, 'question' => 'First job?']);

    $this->actingAs($aUser)->putJson(route('games.rounds.textAnswer.update', [$room, $round]), ['text' => 'Lifeguard'])->assertOk();
    GameTextAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $b->id, 'text' => 'Paperboy']);

    expect(gamePayloadExposesWord(gameSnapshotFor($room, $b), 'Lifeguard'))->toBeFalse()
        ->and(gamePayloadExposesWord(gameSnapshotFor($room, $host), 'Lifeguard'))->toBeFalse()
        ->and(gameSnapshotFor($room, $a)['round']['myAnswer']['text'])->toBe('Lifeguard');

    Event::assertDispatched(fn (GameAnswerChanged $event) => ! gamePayloadExposesWord($event->broadcastWith(), 'Lifeguard'));

    $this->actingAs($hostUser)->postJson(route('games.rounds.reveal.store', [$room, $round]))->assertOk();

    $drawn = $round->fresh()->drawnAnswer();
    $hidden = GameTextAnswer::query()->where('game_round_id', $round->id)->where('is_drawn', false)->sole();
    $voter = $drawn->player_id === $a->id ? $b : $a;
    GameChoice::factory()->create(['game_round_id' => $round->id, 'player_id' => $voter->id, 'choice' => $drawn->player_id]);

    foreach ([$host, $a, $b] as $viewer) {
        $present = gameSnapshotFor($room, $viewer)['round'];
        $isHiddenAuthor = $viewer->id === $hidden->player_id;

        expect($present['drawn'])->toBe(['id' => $drawn->id, 'text' => $drawn->text])
            ->and($present)->not->toHaveKey('voters')
            ->and($present['votedCount'])->toBe(1)
            ->and($present['myChoice'])->toBe($viewer->is($voter) ? $drawn->player_id : null)
            ->and(gamePayloadExposesWord($present, $hidden->text))->toBe($isHiddenAuthor);
    }

    Event::assertDispatched(fn (GameRoundRevealed $event) => ! gamePayloadExposesWord($event->payload, $hidden->text)
        && ! array_key_exists('playerId', $event->payload['answers'][0]));

    $this->actingAs($hostUser)->postJson(route('games.rounds.close.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('ended.drawn.playerId', $drawn->player_id);

    Event::assertDispatched(fn (GameRoundEnded $event) => ! gamePayloadExposesWord($event->broadcastWith(), $hidden->text));

    $this->actingAs($aUser)->getJson(route('games.rounds.show', [$room, $round]))->assertJsonMissingPath('answers');
    expect(gamePayloadExposesWord($this->actingAs($aUser)->getJson(route('games.rounds.show', [$room, $round]))->json(), $hidden->text))->toBeFalse();
});
