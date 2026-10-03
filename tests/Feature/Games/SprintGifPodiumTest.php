<?php

use App\Enums\GameRoundOutcome;
use App\Events\Games\GameRoundRevealed;
use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    fakeGameGifs('gifA', 'gifB', 'gifC');
});

it('hides the authors of revealed GIFs until the close when the round says so', function () {
    [$room, $user] = sprintGifRoom();
    [, $author] = gameRoomMember($room);
    $round = activeGifRound($room, ['authors_hidden' => true]);
    GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $author->id, 'gif_id' => 'gifA']);

    $this->actingAs($user)->postJson(route('games.rounds.reveal.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('answers.0.playerId', null);

    Event::assertDispatched(GameRoundRevealed::class, fn (GameRoundRevealed $event) => $event->payload['answers'][0]['playerId'] === null);

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('round.answers.0.playerId', null);

    $this->actingAs($user)->postJson(route('games.rounds.close.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('ended.answers.0.playerId', $author->id);
});

it('tells whether the authors of revealed GIFs come at the close, never in an anonymous retro\'s icebreaker', function () {
    [$room, $user] = sprintGifRoom();
    $round = activeGifRound($room, ['authors_hidden' => true]);
    GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => GamePlayer::factory()->create(['game_room_id' => $room->id])->id, 'gif_id' => 'gifA']);

    $this->actingAs($user)->postJson(route('games.rounds.reveal.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('authorsHidden', true);

    Event::assertDispatched(GameRoundRevealed::class, fn (GameRoundRevealed $event) => $event->payload['authorsHidden'] === true);

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('round.authorsHidden', true);

    [$shownRoom, $shownUser] = sprintGifRoom();
    activeGifRound($shownRoom, ['revealed_at' => now()]);

    $this->actingAs($shownUser)->getJson(route('games.snapshot.show', $shownRoom))
        ->assertJsonPath('round.authorsHidden', false);

    [$anonymousRoom, $facilitatorUser] = anonymousGifIcebreaker();
    activeGifRound($anonymousRoom, ['revealed_at' => now(), 'authors_hidden' => true]);

    $this->actingAs($facilitatorUser)->getJson(route('games.snapshot.show', $anonymousRoom))
        ->assertJsonPath('round.authorsHidden', false);
});

it('ranks the closed GIFs with ties, and the top authors win', function () {
    [$room, $user] = sprintGifRoom();
    $round = activeGifRound($room, ['revealed_at' => now(), 'votes_allowed' => 2]);
    $authors = collect(range(1, 3))->map(fn () => GamePlayer::factory()->create(['game_room_id' => $room->id]));
    $answers = $authors->map(fn (GamePlayer $author, int $index) => GameGifAnswer::factory()->create([
        'game_round_id' => $round->id, 'player_id' => $author->id, 'gif_id' => ['gifA', 'gifB', 'gifC'][$index],
    ]));
    $voters = collect(range(1, 2))->map(fn () => GamePlayer::factory()->create(['game_room_id' => $room->id]));
    foreach ([[0, 0], [0, 1], [1, 0], [1, 1]] as [$voter, $answer]) {
        GameGifVote::factory()->create(['game_round_id' => $round->id, 'voter_player_id' => $voters[$voter]->id, 'answer_id' => $answers[$answer]->id]);
    }

    $ended = $this->actingAs($user)->postJson(route('games.rounds.close.store', [$room, $round]))->assertOk()->json('ended');
    $rankByAuthor = collect($ended['answers'])->mapWithKeys(fn (array $answer): array => [$answer['playerId'] => $answer['rank']]);

    expect($rankByAuthor[$authors[0]->id])->toBe(1)
        ->and($rankByAuthor[$authors[1]->id])->toBe(1)
        ->and($rankByAuthor[$authors[2]->id])->toBe(3)
        ->and(GamePoint::query()->where('is_win', true)->pluck('player_id')->sort()->values()->all())
        ->toBe($authors->take(2)->pluck('id')->sort()->values()->all());
});

it('names no winner when no GIF got a vote, nor in an anonymous retro\'s icebreaker', function () {
    [$room, $user] = sprintGifRoom();
    $round = activeGifRound($room, ['revealed_at' => now()]);
    GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => GamePlayer::factory()->create(['game_room_id' => $room->id])->id, 'gif_id' => 'gifA']);

    $this->actingAs($user)->postJson(route('games.rounds.close.store', [$room, $round]))->assertOk();

    [$anonymousRoom, $facilitatorUser, , , $member] = anonymousGifIcebreaker();
    $anonymousRound = activeGifRound($anonymousRoom, ['revealed_at' => now()]);
    $answer = GameGifAnswer::factory()->create(['game_round_id' => $anonymousRound->id, 'player_id' => $member->id, 'gif_id' => 'gifB']);
    GameGifVote::factory()->create(['game_round_id' => $anonymousRound->id, 'voter_player_id' => GamePlayer::factory()->create(['game_room_id' => $anonymousRoom->id])->id, 'answer_id' => $answer->id]);

    $this->actingAs($facilitatorUser)->postJson(route('games.rounds.close.store', [$anonymousRoom, $anonymousRound]))->assertOk();

    expect(GamePoint::query()->where('is_win', true)->count())->toBe(0);
});

it('gives no rank to the GIFs of a passed round', function () {
    [$room, $user] = sprintGifRoom();
    $round = activeGifRound($room, ['revealed_at' => now()]);
    GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => GamePlayer::factory()->create(['game_room_id' => $room->id])->id, 'gif_id' => 'gifA']);

    $this->actingAs($user)->postJson(route('games.rounds.pass.store', [$room, $round]))->assertOk();

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Passed);
    $this->actingAs($user)->getJson(route('games.rounds.show', [$room, $round]))->assertJsonPath('answers.0.rank', null);
});
