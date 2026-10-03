<?php

use App\Events\Games\GameVoteChanged;
use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\User;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    fakeGameGifs('gifA', 'gifB', 'gifC');
});

/**
 * @return array{0: GameRoom, 1: GameRound, 2: User, 3: array<int, GameGifAnswer>}
 */
function gifBudgetTable(int $votesAllowed): array
{
    [$room] = sprintGifRoom();
    $round = activeGifRound($room, ['revealed_at' => now(), 'votes_allowed' => $votesAllowed]);
    $answers = collect(['gifA', 'gifB', 'gifC'])->map(fn (string $gif): GameGifAnswer => GameGifAnswer::factory()->create([
        'game_round_id' => $round->id,
        'player_id' => GamePlayer::factory()->create(['game_room_id' => $room->id])->id,
        'gif_id' => $gif,
    ]))->all();
    [$voterUser] = gameRoomMember($room);

    return [$room, $round, $voterUser, $answers];
}

it('spends a budget of votes, one per GIF, and refuses a vote beyond it', function () {
    [$room, $round, $voterUser, $answers] = gifBudgetTable(2);
    $uri = route('games.rounds.vote.update', [$room, $round]);

    $this->actingAs($voterUser)->putJson($uri, ['answer_id' => $answers[0]->id])->assertNoContent();
    $this->actingAs($voterUser)->putJson($uri, ['answer_id' => $answers[0]->id])->assertNoContent();
    $this->actingAs($voterUser)->putJson($uri, ['answer_id' => $answers[1]->id])->assertNoContent();
    $this->travel(1)->seconds();
    $this->actingAs($voterUser)->putJson($uri, ['answer_id' => $answers[2]->id])->assertConflict();

    expect(GameGifVote::query()->count())->toBe(2);

    $this->actingAs($voterUser)->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('round.votesAllowed', 2)
        ->assertJsonPath('round.myVotes', collect([$answers[0]->id, $answers[1]->id])->sort()->values()->all());

    Event::assertDispatchedTimes(GameVoteChanged::class, 1);
});

it('withdraws one vote, or every vote, and says so when none is left', function () {
    [$room, $round, $voterUser, $answers] = gifBudgetTable(2);
    $uri = route('games.rounds.vote.update', [$room, $round]);
    $this->actingAs($voterUser)->putJson($uri, ['answer_id' => $answers[0]->id]);
    $this->actingAs($voterUser)->putJson($uri, ['answer_id' => $answers[1]->id]);

    $this->actingAs($voterUser)->deleteJson(route('games.rounds.vote.destroy', [$room, $round]), ['answer_id' => $answers[0]->id])->assertNoContent();

    expect(GameGifVote::query()->sole()->answer_id)->toBe($answers[1]->id);
    Event::assertNotDispatched(GameVoteChanged::class, fn (GameVoteChanged $event) => $event->voted === false);

    $this->travel(1)->seconds();
    $this->actingAs($voterUser)->deleteJson(route('games.rounds.vote.destroy', [$room, $round]))->assertNoContent();

    expect(GameGifVote::query()->count())->toBe(0);
    Event::assertDispatched(GameVoteChanged::class, fn (GameVoteChanged $event) => $event->voted === false);
});

it('replaces the vote with a budget of one, as before', function () {
    [$room, $round, $voterUser, $answers] = gifBudgetTable(1);
    $uri = route('games.rounds.vote.update', [$room, $round]);

    $this->actingAs($voterUser)->putJson($uri, ['answer_id' => $answers[0]->id])->assertNoContent();
    $this->actingAs($voterUser)->putJson($uri, ['answer_id' => $answers[1]->id])->assertNoContent();

    expect(GameGifVote::query()->sole()->answer_id)->toBe($answers[1]->id);
});

it('starts a GIF round with the room\'s budget and hidden authors', function () {
    [$room, $user] = sprintGifRoom();
    $room->update(['gif_votes' => 3, 'gif_authors_hidden' => true]);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))
        ->assertCreated()
        ->assertJsonPath('round.votesAllowed', 3);

    expect($room->fresh()->currentRound)->votes_allowed->toBe(3)->authors_hidden->toBeTrue();
});
