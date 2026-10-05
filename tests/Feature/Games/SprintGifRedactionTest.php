<?php

use App\Events\Games\GameAnswerChanged;
use App\Events\Games\GameBroadcastEvent;
use App\Events\Games\GameQuestionChanged;
use App\Events\Games\GameRoomChanged;
use App\Events\Games\GameRoundEnded;
use App\Events\Games\GameRoundRevealed;
use App\Events\Games\GameRoundStarted;
use App\Events\Games\GameTimerChanged;
use App\Events\Games\GameVoteChanged;
use App\Models\GameGifAnswer;
use App\Models\GameRound;
use App\Support\Games\GameWordBook;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Event;

const HiddenGif = 'hiddengif42';

beforeEach(function () {
    Event::fake();
    fakeGameGifs(HiddenGif, 'othergif7');
    app()->instance(GameWordBook::class, new GameWordBook(questions: ['en' => ['Which GIF sums up the sprint?']]));
});

/**
 * @param  array<int, class-string<GameBroadcastEvent>>  $classes
 * @return Collection<int, GameBroadcastEvent>
 */
function gifBroadcasts(array $classes): Collection
{
    return collect($classes)
        ->flatMap(fn (string $class) => Event::dispatched($class))
        ->map(fn (array $arguments): GameBroadcastEvent => $arguments[0]);
}

it('keeps other players GIFs out of every payload before the reveal', function () {
    [$room, $hostUser] = sprintGifRoom();
    [$memberUser] = gameRoomMember($room);
    $guest = gameRoomGuest($room);

    $start = $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room))->assertCreated()->json();
    $round = GameRound::query()->sole();

    $this->actingAs($memberUser)->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => HiddenGif])->assertOk();

    $hostSnapshot = $this->actingAs($hostUser)->getJson(route('games.snapshot.show', $room))->assertOk()->json();

    resolve('auth')->forgetGuards();

    $guestSnapshot = $this->withCookies(gameGuestCookie($guest))->withCredentials()->getJson(route('games.snapshot.show', $room))->assertOk()->json();

    foreach ([$start, $hostSnapshot, $guestSnapshot] as $payload) {
        expect(payloadJson($payload))->not->toContain(HiddenGif);
    }

    expect(gifBroadcasts([GameRoundStarted::class, GameAnswerChanged::class, GameQuestionChanged::class, GameTimerChanged::class, GameRoomChanged::class])
        ->contains(fn (GameBroadcastEvent $event) => str_contains(payloadJson($event->broadcastWith()), HiddenGif)))->toBeFalse();

    $this->actingAs($hostUser)->getJson(route('games.rounds.index', $room))->assertOk()->assertExactJson([]);
    $this->actingAs($hostUser)->getJson(route('games.rounds.show', [$room, $round]))->assertNotFound();
});

it('keeps vote counts and who voted for what secret until the close', function () {
    [$room, $hostUser, $host] = sprintGifRoom();
    [$memberUser, $member] = gameRoomMember($room);
    [$voterUser] = gameRoomMember($room);
    $round = activeGifRound($room);
    $hostAnswer = GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $host->id, 'gif_id' => 'othergif7']);
    GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $member->id, 'gif_id' => HiddenGif]);

    $this->actingAs($hostUser)->postJson(route('games.rounds.reveal.store', [$room, $round]))->assertOk();
    $this->actingAs($memberUser)->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $hostAnswer->id])->assertNoContent();
    $this->actingAs($voterUser)->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $hostAnswer->id])->assertNoContent();

    foreach ([$hostUser, $memberUser, $voterUser] as $user) {
        $view = $this->actingAs($user)->getJson(route('games.snapshot.show', $room))->assertOk()->json('round');

        expect(payloadJson($view))->not->toContain('"votes"')
            ->and(array_map(array_keys(...), $view['answers']))->each->toBe(['id', 'gif', 'caption', 'playerId'])
            ->and($view['voters'])->toHaveCount(2)
            ->and(payloadJson($view))->not->toContain('"points"');
    }

    expect($this->actingAs($hostUser)->getJson(route('games.snapshot.show', $room))->json('round.myVote'))->toBeNull()
        ->and(gifBroadcasts([GameVoteChanged::class])->every(fn (GameBroadcastEvent $event) => array_keys($event->broadcastWith()) === ['roundId', 'playerId', 'voted']))->toBeTrue()
        ->and(gifBroadcasts([GameRoundRevealed::class])->every(fn (GameBroadcastEvent $event) => ! str_contains(payloadJson($event->broadcastWith()), '"votes"')))->toBeTrue();

    $this->actingAs($hostUser)->postJson(route('games.rounds.close.store', [$room, $round]))->assertOk();

    Event::assertDispatched(fn (GameRoundEnded $event) => collect($event->payload['answers'])->firstWhere('id', $hostAnswer->id)['votes'] === 2);
});

it('never names the author of a GIF on an anonymous retro, even after the close', function () {
    [$room, $hostUser, , $memberUser] = anonymousGifIcebreaker();

    $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room))->assertCreated();
    $round = GameRound::query()->sole();

    $this->actingAs($memberUser)->putJson(route('games.rounds.answer.update', [$room, $round]), ['gif_id' => HiddenGif])->assertOk();
    $answer = GameGifAnswer::query()->sole();

    $this->actingAs($hostUser)->postJson(route('games.rounds.reveal.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('answers.0.playerId', null);
    $this->actingAs($hostUser)->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $answer->id])->assertNoContent();

    $memberView = $this->actingAs($memberUser)->getJson(route('games.snapshot.show', $room))->assertOk()->json('round');

    expect($memberView['answers'][0]['playerId'])->toBeNull()
        ->and($memberView['myAnswer']['id'])->toBe($answer->id);

    $this->actingAs($hostUser)->postJson(route('games.rounds.close.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('ended.answers.0.playerId', null)
        ->assertJsonPath('ended.answers.0.votes', 1);

    $this->actingAs($memberUser)->getJson(route('games.rounds.show', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('answers.0.playerId', null);

    $authoredPayloads = gifBroadcasts([GameRoundRevealed::class, GameRoundEnded::class])
        ->map(fn (GameBroadcastEvent $event) => $event->broadcastWith()['answers']);

    expect($authoredPayloads)->not->toBeEmpty()
        ->and($authoredPayloads->flatten(1)->pluck('playerId')->filter()->all())->toBeEmpty();
});
