<?php

use App\Actions\Games\BuildGameSnapshot;
use App\Actions\Games\EndGameRound;
use App\Actions\Games\ExpireGameRound;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Events\Games\GameRoundEnded;
use App\Events\Games\GameRoundRevealed;
use App\Jobs\CloseExpiredGameRound;
use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;
use App\Support\Games\GameWordBook;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    fakeGameGifs('party', 'coffee', 'rocket');
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
    app()->instance(GameWordBook::class, new GameWordBook(questions: ['en' => ['How did the last deploy feel?']]));
});

function gifAnswer(GameRound $round, GamePlayer $player, string $gifId): GameGifAnswer
{
    return GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $player->id, 'gif_id' => $gifId]);
}

function gifVote(GameRound $round, GamePlayer $voter, GameGifAnswer $answer): GameGifVote
{
    return GameGifVote::factory()->create(['game_round_id' => $round->id, 'voter_player_id' => $voter->id, 'answer_id' => $answer->id]);
}

it('is offered only with a GIF provider', function () {
    [$room, $user] = sprintGifRoom();

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('games.1', ['value' => 'gif', 'label' => __('Sprint in one GIF'), 'available' => true]);

    config(['services.gifs.provider' => null]);

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))->assertJsonPath('games.1.available', false);
    $this->actingAs($user)->postJson(route('games.rounds.store', $room))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['game' => __('This game is not available.')]);
});

it('is unavailable in an icebreaker whose retro turned GIFs off', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create(['gifs_enabled' => false]);
    [$user, $facilitator] = retroFacilitator($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create();
    GamePlayer::factory()->forParticipant($facilitator)->create(['game_room_id' => $room->id]);

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))->assertJsonPath('games.1.available', false);
    $this->actingAs($user)->putJson(route('games.game.update', $room), ['game' => 'gif'])->assertUnprocessable();

    $retro->update(['gifs_enabled' => true]);

    $this->actingAs($user)->putJson(route('games.game.update', $room), ['game' => 'gif'])->assertNoContent();
});

it('starts a round with a question and no word', function () {
    [$room, $user] = sprintGifRoom();

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))
        ->assertCreated()
        ->assertJsonPath('round.game', 'gif')
        ->assertJsonPath('round.question', 'How did the last deploy feel?')
        ->assertJsonPath('round.gifProvider', 'giphy')
        ->assertJsonPath('round.answers', [])
        ->assertJsonPath('round.myAnswer', null)
        ->assertJsonPath('round.voters', [])
        ->assertJsonPath('round.myVote', null)
        ->assertJsonPath('round.revealedAt', null);

    expect(GameRound::query()->sole())
        ->word->toBeNull()
        ->question->toBe('How did the last deploy feel?');
});

it('shows who answered but not what before the reveal', function () {
    [$room, $user] = sprintGifRoom();
    [$memberUser, $member] = gameRoomMember($room);
    $round = activeGifRound($room);
    $answer = gifAnswer($round, $member, 'party');

    $hostView = $this->actingAs($user)->getJson(route('games.snapshot.show', $room))->assertOk()->json('round');
    $memberView = $this->actingAs($memberUser)->getJson(route('games.snapshot.show', $room))->assertOk()->json('round');

    expect($hostView['answers'])->toBe([['playerId' => $member->id, 'answered' => true]])
        ->and($hostView['myAnswer'])->toBeNull()
        ->and(gamePayloadJson($hostView))->not->toContain('party')
        ->and($memberView['myAnswer'])->toBe(['id' => $answer->id, 'gif' => gameGifPayload('party')]);
});

it('shows the GIFs with their authors, the voters and my vote after the reveal, without counts', function () {
    [$room, $user, $host] = sprintGifRoom();
    [, $member] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $mine = gifAnswer($round, $host, 'party');
    $theirs = gifAnswer($round, $member, 'coffee');
    gifVote($round, $host, $theirs);

    $view = $this->actingAs($user)->getJson(route('games.snapshot.show', $room))->assertOk()->json('round');

    $expected = collect([$mine, $theirs])->sortBy('id')->map(fn (GameGifAnswer $answer): array => [
        'id' => $answer->id,
        'gif' => gameGifPayload($answer->gif_id),
        'playerId' => $answer->player_id,
    ])->values()->all();

    expect($view['answers'])->toBe($expected)
        ->and($view['voters'])->toBe([$host->id])
        ->and($view['myVote'])->toBe($theirs->id)
        ->and($view['myAnswer']['id'])->toBe($mine->id)
        ->and(gamePayloadJson($view))->not->toContain('"votes"');
});

it('hides GIF authors in the icebreaker of an anonymous retro', function () {
    [$room, $hostUser, , , $member] = anonymousGifIcebreaker();
    $round = activeGifRound($room, ['revealed_at' => now()]);
    gifAnswer($round, $member, 'party');

    $view = $this->actingAs($hostUser)->getJson(route('games.snapshot.show', $room))->assertOk()->json('round');

    expect($view['answers'][0]['playerId'])->toBeNull()
        ->and(gamePayloadJson($view['answers']))->not->toContain($member->id);
});

it('gives authors 2 points per favourite vote at close and 0 to the others who took part', function () {
    [$room, , $host] = sprintGifRoom();
    [, $author] = gameRoomMember($room);
    [, $voter] = gameRoomMember($room);
    [, $watcher] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $popular = gifAnswer($round, $author, 'party');
    $unloved = gifAnswer($round, $host, 'coffee');
    gifVote($round, $host, $popular);
    gifVote($round, $voter, $popular);

    $payload = app(EndGameRound::class)->handle($room, $round, GameRoundOutcome::Revealed);

    expect($payload['points'])->toEqualCanonicalizing([
        ['playerId' => $author->id, 'points' => 4, 'isWin' => false],
        ['playerId' => $host->id, 'points' => 0, 'isWin' => false],
        ['playerId' => $voter->id, 'points' => 0, 'isWin' => false],
    ])
        ->and(array_keys($payload))->toBe(['roundId', 'outcome', 'word', 'winnerPlayerId', 'leaderPlayerId', 'question', 'answers', 'points'])
        ->and($payload['word'])->toBeNull()
        ->and($payload['question'])->toBe('How did the sprint feel?')
        ->and(collect($payload['answers'])->firstWhere('id', $popular->id))->toBe([
            'id' => $popular->id,
            'gif' => gameGifPayload('party'),
            'playerId' => $author->id,
            'votes' => 2,
        ])
        ->and(collect($payload['answers'])->firstWhere('id', $unloved->id)['votes'])->toBe(0)
        ->and(GamePoint::query()->where('player_id', $watcher->id)->exists())->toBeFalse()
        ->and(GamePoint::query()->where('is_win', true)->exists())->toBeFalse()
        ->and(GamePoint::query()->where('player_id', $author->id)->sole()->game)->toBe(GameKind::SprintGif);
});

it('awards no GIF points in the icebreaker of an anonymous retro but still counts the votes', function () {
    [$room, , $host, , $member] = anonymousGifIcebreaker();
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $answer = gifAnswer($round, $member, 'party');
    gifVote($round, $host, $answer);

    $payload = app(EndGameRound::class)->handle($room, $round, GameRoundOutcome::Revealed);

    expect($payload['points'])->toEqualCanonicalizing([
        ['playerId' => $member->id, 'points' => 0, 'isWin' => false],
        ['playerId' => $host->id, 'points' => 0, 'isWin' => false],
    ])
        ->and($payload['answers'][0]['votes'])->toBe(1)
        ->and($payload['answers'][0]['playerId'])->toBeNull()
        ->and(GamePoint::query()->sum('points'))->toBe(0);
});

it('scores nothing and discards the votes of a round abandoned during voting', function () {
    [$room, , $host] = sprintGifRoom();
    [, $member] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $answer = gifAnswer($round, $member, 'party');
    gifVote($round, $host, $answer);

    $payload = app(EndGameRound::class)->handle($room, $round, GameRoundOutcome::Abandoned);

    expect($payload['points'])->toBe([])
        ->and($payload['answers'][0]['votes'])->toBeNull()
        ->and(GamePoint::query()->count())->toBe(0);
});

it('skips a voting round the host passes: no points and no vote counts', function () {
    [$room, $user, $host] = sprintGifRoom();
    [, $member] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $answer = gifAnswer($round, $member, 'rocket');
    gifVote($round, $host, $answer);

    $this->actingAs($user)->postJson(route('games.rounds.pass.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('ended.outcome', 'passed')
        ->assertJsonPath('ended.points', [])
        ->assertJsonPath('ended.answers.0.votes', null);

    expect(GamePoint::query()->count())->toBe(0);
});

it('closes the voting when the host starts the next round, but not before the reveal', function () {
    [$room, $user] = sprintGifRoom();
    [, $member] = gameRoomMember($room);
    $answering = activeGifRound($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))->assertConflict();

    $answering->forceFill(['revealed_at' => now()])->save();
    gifAnswer($answering, $member, 'coffee');

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))->assertCreated();

    expect($answering->fresh()->outcome)->toBe(GameRoundOutcome::Revealed)
        ->and(GamePoint::query()->where('player_id', $member->id)->sole()->points)->toBe(0);
});

it('shows the closed answers in the round detail', function () {
    [$room, $user, $host] = sprintGifRoom();
    [, $member] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $answer = gifAnswer($round, $member, 'party');
    gifVote($round, $host, $answer);
    app(EndGameRound::class)->handle($room, $round, GameRoundOutcome::Revealed);

    $this->actingAs($user)->getJson(route('games.rounds.show', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('question', 'How did the sprint feel?')
        ->assertJsonPath('outcome', 'revealed')
        ->assertJsonPath('answers', [['id' => $answer->id, 'gif' => gameGifPayload('party'), 'playerId' => $member->id, 'votes' => 1]]);
});

it('reveals instead of closing when the timer runs out before the reveal', function () {
    [$room, $user] = sprintGifRoom();
    $room->update(['timer_ends_at' => now()->addMinute()]);
    $round = activeGifRound($room);

    $this->travel(65)->seconds();

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('round.id', $round->id)
        ->assertJsonPath('round.revealedAt', '2026-10-06T10:01:05+00:00');

    Event::assertDispatched(GameRoundRevealed::class, fn (GameRoundRevealed $event) => $event->payload['roundId'] === $round->id);
    Event::assertNotDispatched(GameRoundEnded::class);
});

it('ignores the old timer once the answers are revealed', function () {
    [$room] = sprintGifRoom();
    $room->update(['timer_ends_at' => now()->addMinute()]);
    $round = activeGifRound($room);

    $this->travel(65)->seconds();
    app(ExpireGameRound::class)->handle($room->fresh());
    (new CloseExpiredGameRound($round->id, '2026-10-06T10:01:00+00:00'))->handle(app(ExpireGameRound::class));

    expect($round->fresh()->isActive())->toBeTrue()
        ->and($round->fresh()->revealed_at?->toIso8601String())->toBe('2026-10-06T10:01:05+00:00');

    Event::assertDispatchedTimes(GameRoundRevealed::class, 1);
});

it('closes the voting round when the timer runs out during voting', function () {
    [$room, $user, $host] = sprintGifRoom();
    [, $member] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $answer = gifAnswer($round, $member, 'party');
    gifVote($round, $host, $answer);
    $room->update(['timer_ends_at' => now()->addMinute()]);

    $this->travel(61)->seconds();

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('round', null)
        ->assertJsonPath('history.0.outcome', 'revealed');

    expect(GamePoint::query()->where('player_id', $member->id)->sole()->points)->toBe(2);
    Event::assertDispatched(GameRoundEnded::class, fn (GameRoundEnded $event) => $event->payload['answers'][0]['votes'] === 1);
});

it('presents a GIF round with a constant number of queries', function () {
    $count = function (int $players): int {
        [$room, , $host] = sprintGifRoom();
        $round = activeGifRound($room, ['revealed_at' => now()]);
        $hostAnswer = gifAnswer($round, $host, 'party');

        foreach (range(1, $players) as $index) {
            [, $player] = gameRoomMember($room);
            gifAnswer($round, $player, 'coffee');
            gifVote($round, $player, $hostAnswer);
        }

        $fresh = $room->fresh();
        $viewer = $host->fresh();

        DB::flushQueryLog();
        DB::enableQueryLog();
        app(BuildGameSnapshot::class)->handle($fresh, $viewer);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    expect($count(6))->toBe($count(2));
});
