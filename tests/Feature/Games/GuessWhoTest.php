<?php

use App\Actions\Games\EnsureIcebreakerRoom;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Events\Games\GameAnswerChanged;
use App\Events\Games\GameRoundRevealed;
use App\Events\Games\GameVoteChanged;
use App\Events\Games\GameVotesCounted;
use App\Models\GameChoice;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\GameTextAnswer;
use App\Models\Retro;
use App\Support\Games\GameWordBook;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    app()->instance(GameWordBook::class, new GameWordBook(prompts: ['en' => ['What was your first job?', 'Which app could you not live without?']]));
});

/**
 * @return array{room: GameRoom, round: GameRound, hostUser: mixed, host: mixed, aUser: mixed, a: mixed, bUser: mixed, b: mixed}
 */
function guessWhoTable(array $roundAttributes = []): array
{
    $room = GameRoom::factory()->game(GameKind::GuessWho)->linkAccess()->create();
    [$hostUser, $host] = gameRoomHost($room);
    [$aUser, $a] = gameRoomMember($room);
    [$bUser, $b] = gameRoomMember($room);
    $round = activeGameRound($room, ['word' => null, 'question' => 'What was your first job?', ...$roundAttributes]);

    return ['room' => $room, 'round' => $round, 'hostUser' => $hostUser, 'host' => $host, 'aUser' => $aUser, 'a' => $a, 'bUser' => $bUser, 'b' => $b];
}

function guessWhoAnswer(GameRound $round, mixed $player, string $text, bool $drawn = false): GameTextAnswer
{
    $answer = GameTextAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $player->id, 'text' => $text]);
    $answer->forceFill(['is_drawn' => $drawn])->save();

    return $answer;
}

it('starts with a prompt the host can change until the first answer', function () {
    $room = GameRoom::factory()->game(GameKind::GuessWho)->create();
    [$user] = gameRoomHost($room);

    $round = $this->actingAs($user)->postJson(route('games.rounds.store', $room))->assertCreated()->json('round');

    expect($round['question'])->toBeIn(['What was your first job?', 'Which app could you not live without?']);

    $this->actingAs($user)->putJson(route('games.rounds.question.update', [$room, $round['id']]), ['text' => 'Your first concert?'])->assertOk();
    $this->actingAs($user)->putJson(route('games.rounds.textAnswer.update', [$room, $round['id']]), ['text' => 'Daft Punk'])->assertOk();
    $this->actingAs($user)->putJson(route('games.rounds.question.update', [$room, $round['id']]), [])->assertConflict();
});

it('takes one answer per player, changeable or removable until the draw', function () {
    ['room' => $room, 'round' => $round, 'aUser' => $aUser] = guessWhoTable();
    $uri = route('games.rounds.textAnswer.update', [$room, $round]);

    $this->actingAs($aUser)->putJson($uri, ['text' => str_repeat('a', 121)])->assertUnprocessable();
    $this->actingAs($aUser)->putJson($uri, ['text' => 'Lifeguard'])->assertOk()->assertJsonPath('myAnswer.text', 'Lifeguard');
    $this->actingAs($aUser)->putJson($uri, ['text' => 'Paperboy'])->assertOk();
    $this->actingAs($aUser)->deleteJson(route('games.rounds.textAnswer.destroy', [$room, $round]))->assertNoContent();

    expect(GameTextAnswer::query()->count())->toBe(0);
    Event::assertDispatchedTimes(GameAnswerChanged::class, 2);

    $round->forceFill(['revealed_at' => now()])->save();

    $this->actingAs($aUser)->putJson($uri, ['text' => 'Late'])->assertConflict();
});

it('counts refused answers against the rate limit', function () {
    ['room' => $room, 'round' => $round, 'aUser' => $aUser] = guessWhoTable();
    $uri = route('games.rounds.textAnswer.update', [$room, $round]);

    foreach (range(1, 5) as $attempt) {
        $this->actingAs($aUser)->putJson($uri, ['text' => str_repeat('a', 121)])->assertUnprocessable();
    }

    $this->actingAs($aUser)->putJson($uri, ['text' => 'Lifeguard'])
        ->assertTooManyRequests()
        ->assertJsonPath('message', __('Slow down a little.'));
});

it('draws one answer among at least two, for the host only, and shows it without its author', function () {
    ['room' => $room, 'round' => $round, 'hostUser' => $hostUser, 'aUser' => $aUser, 'a' => $a, 'b' => $b] = guessWhoTable();
    guessWhoAnswer($round, $a, 'Lifeguard');
    $reveal = route('games.rounds.reveal.store', [$room, $round]);

    $this->actingAs($hostUser)->postJson($reveal)->assertConflict();

    guessWhoAnswer($round, $b, 'Paperboy');

    $this->actingAs($aUser)->postJson($reveal)->assertForbidden();

    $drawn = $this->actingAs($hostUser)->postJson($reveal)
        ->assertOk()
        ->assertJsonPath('candidates', collect([$a->id, $b->id])->sort()->values()->all())
        ->json('drawn');

    $stored = $round->fresh()->drawnAnswer();

    expect($drawn)->toBe(['id' => $stored->id, 'text' => $stored->text])
        ->and(GameTextAnswer::query()->where('is_drawn', true)->count())->toBe(1);

    Event::assertDispatched(fn (GameRoundRevealed $event) => count($event->payload['answers']) === 1
        && array_keys($event->payload['answers'][0]) === ['id', 'text']
        && $event->payload['answers'][0]['id'] === $stored->id);

    $this->actingAs($hostUser)->postJson($reveal)->assertConflict();
});

it('takes one vote for a candidate from everyone but the author, and announces only a count', function () {
    ['room' => $room, 'round' => $round, 'hostUser' => $hostUser, 'host' => $host, 'aUser' => $aUser, 'a' => $a, 'bUser' => $bUser, 'b' => $b] = guessWhoTable(['revealed_at' => now()]);
    guessWhoAnswer($round, $a, 'Lifeguard', drawn: true);
    guessWhoAnswer($round, $b, 'Paperboy');
    $uri = route('games.rounds.choice.update', [$room, $round]);

    $this->actingAs($aUser)->putJson($uri, ['choice' => $b->id])->assertForbidden();
    $this->actingAs($bUser)->putJson($uri, ['choice' => $b->id])->assertUnprocessable();
    $this->actingAs($bUser)->putJson($uri, ['choice' => $host->id])->assertUnprocessable();
    $this->actingAs($bUser)->putJson($uri, ['choice' => $a->id])->assertNoContent();
    $this->actingAs($hostUser)->putJson($uri, ['choice' => $b->id])->assertNoContent();
    $this->actingAs($hostUser)->putJson($uri, ['choice' => $a->id])->assertNoContent();

    Event::assertDispatchedTimes(GameVotesCounted::class, 2);
    Event::assertDispatched(fn (GameVotesCounted $event) => $event->broadcastWith() === ['roundId' => $round->id, 'voted' => 2]);
    Event::assertNotDispatched(GameVoteChanged::class);

    $this->actingAs($hostUser)->deleteJson(route('games.rounds.choice.destroy', [$room, $round]))->assertNoContent();

    expect(GameChoice::query()->count())->toBe(1);
    Event::assertDispatched(fn (GameVotesCounted $event) => $event->voted === 1);
});

it('refuses a vote before the draw', function () {
    ['room' => $room, 'round' => $round, 'aUser' => $aUser, 'b' => $b] = guessWhoTable();
    guessWhoAnswer($round, $b, 'Paperboy');

    $this->actingAs($aUser)->putJson(route('games.rounds.choice.update', [$room, $round]), ['choice' => $b->id])->assertConflict();
});

it('closes for the host, names the author, and scores the finders and the author', function () {
    ['room' => $room, 'round' => $round, 'hostUser' => $hostUser, 'host' => $host, 'aUser' => $aUser, 'a' => $a, 'bUser' => $bUser, 'b' => $b] = guessWhoTable(['revealed_at' => now()]);
    $drawn = guessWhoAnswer($round, $a, 'Lifeguard', drawn: true);
    guessWhoAnswer($round, $b, 'Paperboy');
    $choice = route('games.rounds.choice.update', [$room, $round]);
    $this->actingAs($bUser)->putJson($choice, ['choice' => $a->id]);
    $this->actingAs($hostUser)->putJson($choice, ['choice' => $b->id]);

    $this->actingAs($aUser)->postJson(route('games.rounds.close.store', [$room, $round]))->assertForbidden();

    $this->actingAs($hostUser)->postJson(route('games.rounds.close.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('ended.outcome', GameRoundOutcome::Revealed->value)
        ->assertJsonPath('ended.drawn', ['id' => $drawn->id, 'text' => 'Lifeguard', 'playerId' => $a->id])
        ->assertJsonPath('ended.nominations', collect([
            ['playerId' => $a->id, 'voterIds' => [$b->id]],
            ['playerId' => $b->id, 'voterIds' => [$host->id]],
        ])->sortBy('playerId')->values()->all());

    $points = GamePoint::query()->get()->mapWithKeys(fn (GamePoint $point): array => [$point->player_id => [$point->points, $point->is_win]])->all();

    expect($points)->toEqual([$b->id => [5, true], $host->id => [0, false], $a->id => [2, false]]);
});

it('draws when the room timer runs out with two answers, then closes at the next one', function () {
    ['room' => $room, 'round' => $round, 'aUser' => $aUser, 'a' => $a, 'b' => $b] = guessWhoTable();
    guessWhoAnswer($round, $a, 'Lifeguard');
    guessWhoAnswer($round, $b, 'Paperboy');
    $room->update(['timer_ends_at' => now()->addSeconds(10)->startOfSecond()]);

    $this->travel(11)->seconds();
    $this->actingAs($aUser)->getJson(route('games.snapshot.show', $room))->assertJsonPath('round.drawn.id', $round->fresh()->drawnAnswer()?->id);

    $room->update(['timer_ends_at' => now()->addSeconds(10)->startOfSecond()]);
    $this->travel(11)->seconds();
    $this->actingAs($aUser)->getJson(route('games.snapshot.show', $room))->assertJsonPath('round', null);

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Revealed);
});

it('times out without a draw when the room timer runs out under two answers', function () {
    ['room' => $room, 'round' => $round, 'aUser' => $aUser, 'a' => $a] = guessWhoTable();
    guessWhoAnswer($round, $a, 'Lifeguard');
    $room->update(['timer_ends_at' => now()->addSeconds(10)->startOfSecond()]);

    $this->travel(11)->seconds();
    $this->actingAs($aUser)->getJson(route('games.snapshot.show', $room))->assertJsonPath('round', null);

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::TimedOut)
        ->and(GamePoint::query()->where('game_round_id', $round->id)->count())->toBe(0);
});

it('is not offered in the icebreaker of an anonymous retro', function () {
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->anonymous()->create(['icebreaker_game' => GameKind::GuessWho]);
    [$facilitatorUser] = retroFacilitator($retro);
    $room = resolve(EnsureIcebreakerRoom::class)->handle($retro->fresh());

    $this->actingAs($facilitatorUser)->postJson(route('games.rounds.store', $room))->assertUnprocessable();
});
