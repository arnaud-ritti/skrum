<?php

use App\Enums\GameRoundOutcome;
use App\Events\Games\GameRoundEnded;
use App\Events\Games\GameRoundRevealed;
use App\Events\Games\GameVoteChanged;
use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRound;
use App\Support\Games\GameWordBook;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    fakeGameGifs('party', 'coffee');
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
    app()->instance(GameWordBook::class, new GameWordBook(questions: ['en' => ['What next?']]));
});

function votingAnswer(GameRound $round, GamePlayer $player, string $gifId = 'party'): GameGifAnswer
{
    return GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $player->id, 'gif_id' => $gifId]);
}

it('reveals the GIFs for the host and opens voting without ending the round', function () {
    [$room, $user, $host] = sprintGifRoom();
    [, $member] = gameRoomMember($room);
    $round = activeGifRound($room);
    $answer = votingAnswer($round, $member);

    $this->actingAs($user)
        ->postJson(route('games.rounds.reveal.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('id', $round->id)
        ->assertJsonPath('revealedAt', '2026-10-06T10:00:00+00:00')
        ->assertJsonPath('answers', [['id' => $answer->id, 'gif' => gameGifPayload('party'), 'playerId' => $member->id]])
        ->assertJsonPath('voters', []);

    expect($round->fresh()->isActive())->toBeTrue()
        ->and(GamePoint::query()->count())->toBe(0);

    Event::assertDispatched(fn (GameRoundRevealed $event) => $event->payload['answers'][0] === [
        'id' => $answer->id,
        'gif' => gameGifPayload('party'),
        'playerId' => $member->id,
    ]);
    Event::assertNotDispatched(GameRoundEnded::class);
});

it('refuses a second reveal and reveals by other players', function () {
    [$room, $user] = sprintGifRoom();
    [$memberUser] = gameRoomMember($room);
    $round = activeGifRound($room);

    $this->actingAs($memberUser)->postJson(route('games.rounds.reveal.store', [$room, $round]))->assertForbidden();
    $this->actingAs($user)->postJson(route('games.rounds.reveal.store', [$room, $round]))->assertOk();
    $this->actingAs($user)->postJson(route('games.rounds.reveal.store', [$room, $round]))
        ->assertConflict()
        ->assertJsonPath('message', __('The GIFs are already revealed.'));
});

it('lets players vote for one favourite and change their mind', function () {
    [$room, , $host] = sprintGifRoom();
    [$voterUser, $voter] = gameRoomMember($room);
    [, $other] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $first = votingAnswer($round, $host, 'party');
    $second = votingAnswer($round, $other, 'coffee');

    $this->actingAs($voterUser)->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $first->id])->assertNoContent();
    $this->travel(2)->seconds();
    $this->actingAs($voterUser)->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $second->id])->assertNoContent();

    expect(GameGifVote::query()->sole())
        ->voter_player_id->toBe($voter->id)
        ->answer_id->toBe($second->id);

    Event::assertDispatchedTimes(GameVoteChanged::class, 1);
    Event::assertDispatched(fn (GameVoteChanged $event) => $event->broadcastWith() === [
        'roundId' => $round->id,
        'playerId' => $voter->id,
        'voted' => true,
    ]);
});

it('retracts a vote', function () {
    [$room, , $host] = sprintGifRoom();
    [$voterUser, $voter] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $answer = votingAnswer($round, $host);
    GameGifVote::factory()->create(['game_round_id' => $round->id, 'voter_player_id' => $voter->id, 'answer_id' => $answer->id]);

    $this->actingAs($voterUser)->deleteJson(route('games.rounds.vote.destroy', [$room, $round]))->assertNoContent();

    expect(GameGifVote::query()->count())->toBe(0);
    Event::assertDispatched(fn (GameVoteChanged $event) => $event->voted === false);
});

it('refuses a vote for your own GIF', function () {
    [$room, $user, $host] = sprintGifRoom();
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $own = votingAnswer($round, $host);

    $this->actingAs($user)
        ->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $own->id])
        ->assertForbidden()
        ->assertJsonPath('message', __('You cannot vote for your own GIF.'));

    expect(GameGifVote::query()->count())->toBe(0);
});

it('refuses votes before the reveal and after the close', function () {
    [$room, , $host] = sprintGifRoom();
    [$voterUser] = gameRoomMember($room);
    $round = activeGifRound($room);
    $answer = votingAnswer($round, $host);

    $this->actingAs($voterUser)
        ->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $answer->id])
        ->assertConflict()
        ->assertJsonPath('message', __('Voting has not started.'));

    $round->forceFill(['revealed_at' => now(), 'ended_at' => now(), 'outcome' => GameRoundOutcome::Revealed])->save();
    $this->travel(2)->seconds();

    $this->actingAs($voterUser)
        ->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $answer->id])
        ->assertConflict()
        ->assertJsonPath('message', __('This round is over.'));
});

it('refuses an answer of another round and malformed ids', function () {
    [$room] = sprintGifRoom();
    [$voterUser] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $foreign = GameGifAnswer::factory()->create();

    $this->actingAs($voterUser)
        ->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $foreign->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['answer_id' => __('This GIF is not part of this round.')]);

    $this->travel(2)->seconds();

    $this->actingAs($voterUser)
        ->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => 'not-a-uuid'])
        ->assertUnprocessable();
});

it('lets players without an answer and guests vote', function () {
    [$room, , $host] = sprintGifRoom();
    [$memberUser] = gameRoomMember($room);
    $guest = gameRoomGuest($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $answer = votingAnswer($round, $host);

    $this->actingAs($memberUser)->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $answer->id])->assertNoContent();

    resolve('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))
        ->withCredentials()
        ->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $answer->id])
        ->assertNoContent();

    expect(GameGifVote::query()->count())->toBe(2);
});

it('closes the round for the host with the votes and the points', function () {
    [$room, $user, $host] = sprintGifRoom();
    [, $author] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $answer = votingAnswer($round, $author);
    GameGifVote::factory()->create(['game_round_id' => $round->id, 'voter_player_id' => $host->id, 'answer_id' => $answer->id]);

    $response = $this->actingAs($user)
        ->postJson(route('games.rounds.close.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('ended.outcome', 'revealed')
        ->assertJsonPath('ended.answers.0.votes', 1)
        ->assertJsonPath('ended.answers.0.playerId', $author->id);

    expect($response->json('ended.points'))->toEqualCanonicalizing([
        ['playerId' => $author->id, 'points' => 2, 'isWin' => false],
        ['playerId' => $host->id, 'points' => 0, 'isWin' => false],
    ])
        ->and($round->fresh()->outcome)->toBe(GameRoundOutcome::Revealed);
});

it('refuses a close before the reveal and by other players', function () {
    [$room, $user] = sprintGifRoom();
    [$memberUser] = gameRoomMember($room);
    $round = activeGifRound($room);

    $this->actingAs($user)
        ->postJson(route('games.rounds.close.store', [$room, $round]))
        ->assertConflict()
        ->assertJsonPath('message', __('Voting has not started.'));

    $round->forceFill(['revealed_at' => now()])->save();

    $this->actingAs($memberUser)->postJson(route('games.rounds.close.store', [$room, $round]))->assertForbidden();
});

it('closes the voting round when the host starts the next one', function () {
    [$room, $user, $host] = sprintGifRoom();
    [, $author] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $answer = votingAnswer($round, $author);
    GameGifVote::factory()->create(['game_round_id' => $round->id, 'voter_player_id' => $host->id, 'answer_id' => $answer->id]);

    $this->actingAs($user)
        ->postJson(route('games.rounds.store', $room))
        ->assertCreated()
        ->assertJsonPath('ended.roundId', $round->id)
        ->assertJsonPath('ended.outcome', 'revealed')
        ->assertJsonPath('ended.answers.0.votes', 1)
        ->assertJsonPath('round.question', 'What next?');

    expect(GamePoint::query()->where('player_id', $author->id)->sole()->points)->toBe(2);
});

it('refuses to start the next round before the reveal', function () {
    [$room, $user] = sprintGifRoom();
    activeGifRound($room);

    $this->actingAs($user)
        ->postJson(route('games.rounds.store', $room))
        ->assertConflict()
        ->assertJsonPath('message', __('A round is already in progress.'));
});

it('slows down a player voting too fast', function () {
    [$room, , $host] = sprintGifRoom();
    [$voterUser] = gameRoomMember($room);
    [, $other] = gameRoomMember($room);
    $round = activeGifRound($room, ['revealed_at' => now()]);
    $first = votingAnswer($round, $host, 'party');
    $second = votingAnswer($round, $other, 'coffee');

    foreach ([$first, $second, $first] as $answer) {
        $this->actingAs($voterUser)->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $answer->id])->assertNoContent();
    }

    $this->actingAs($voterUser)
        ->putJson(route('games.rounds.vote.update', [$room, $round]), ['answer_id' => $second->id])
        ->assertTooManyRequests()
        ->assertJsonPath('message', __('Slow down a little.'));
});
