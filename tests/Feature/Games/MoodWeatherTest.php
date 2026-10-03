<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameAnswerChanged;
use App\Models\GameChoice;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Facades\Event;

beforeEach(fn () => Event::fake());

/**
 * @return array{room: GameRoom, round: GameRound, hostUser: mixed, host: GamePlayer, aUser: mixed, a: GamePlayer, bUser: mixed, b: GamePlayer}
 */
function moodTable(): array
{
    $room = GameRoom::factory()->game(GameKind::MoodWeather)->linkAccess()->create();
    [$hostUser, $host] = gameRoomHost($room);
    [$aUser, $a] = gameRoomMember($room);
    [$bUser, $b] = gameRoomMember($room);
    $round = activeGameRound($room, ['word' => null]);

    return compact('room', 'round', 'hostUser', 'host', 'aUser', 'a', 'bUser', 'b');
}

it('takes one weather per player, host included, changeable until the reveal', function () {
    ['room' => $room, 'round' => $round, 'hostUser' => $hostUser, 'aUser' => $aUser, 'a' => $a] = moodTable();
    $uri = route('games.rounds.choice.update', [$room, $round]);

    $this->actingAs($aUser)->putJson($uri, ['choice' => 'hail'])->assertUnprocessable();
    $this->actingAs($aUser)->putJson($uri, ['choice' => 'rainy'])->assertNoContent();
    $this->actingAs($aUser)->putJson($uri, ['choice' => 'sunny'])->assertNoContent();
    $this->actingAs($hostUser)->putJson($uri, ['choice' => 'stormy'])->assertNoContent();

    expect(GameChoice::query()->where('player_id', $a->id)->sole()->choice)->toBe('sunny');
    Event::assertDispatchedTimes(GameAnswerChanged::class, 2);
});

it('tells everyone who has answered, and each player their own weather only', function () {
    ['room' => $room, 'round' => $round, 'host' => $host, 'aUser' => $aUser, 'a' => $a, 'b' => $b] = moodTable();
    $this->actingAs($aUser)->putJson(route('games.rounds.choice.update', [$room, $round]), ['choice' => 'cloudy']);

    expect(gameSnapshotFor($room, $a)['round'])->toMatchArray(['answers' => [['playerId' => $a->id, 'answered' => true]], 'myChoice' => 'cloudy', 'threshold' => 3])
        ->and(gameSnapshotFor($room, $b)['round'])->toMatchArray(['answers' => [['playerId' => $a->id, 'answered' => true]], 'myChoice' => null])
        ->and(gameSnapshotFor($room, $host)['round']['myChoice'])->toBeNull();
});

it('shows the weather at the reveal from three answers, without any author', function () {
    ['room' => $room, 'round' => $round, 'hostUser' => $hostUser, 'aUser' => $aUser, 'bUser' => $bUser] = moodTable();
    $uri = route('games.rounds.choice.update', [$room, $round]);
    $this->actingAs($aUser)->putJson($uri, ['choice' => 'sunny']);
    $this->actingAs($bUser)->putJson($uri, ['choice' => 'sunny']);
    $this->actingAs($hostUser)->putJson($uri, ['choice' => 'rainy']);

    $this->actingAs($aUser)->postJson(route('games.rounds.reveal.store', [$room, $round]))->assertForbidden();

    $ended = $this->actingAs($hostUser)->postJson(route('games.rounds.reveal.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('ended.outcome', GameRoundOutcome::Revealed->value)
        ->assertJsonPath('ended.answered', 3)
        ->assertJsonPath('ended.weather', [
            ['weather' => 'sunny', 'count' => 2],
            ['weather' => 'partly_cloudy', 'count' => 0],
            ['weather' => 'cloudy', 'count' => 0],
            ['weather' => 'rainy', 'count' => 1],
            ['weather' => 'stormy', 'count' => 0],
        ])
        ->json('ended');

    expect(collect($ended['points'])->pluck('points')->unique()->all())->toBe([0])
        ->and(GamePoint::query()->where('is_win', true)->count())->toBe(0);

    $this->actingAs($aUser)->getJson(route('games.rounds.show', [$room, $round]))
        ->assertJsonPath('weather.0.count', 2)
        ->assertJsonMissingPath('answers');
});

it('keeps the weather back under three answers', function () {
    ['room' => $room, 'round' => $round, 'hostUser' => $hostUser, 'aUser' => $aUser] = moodTable();
    $this->actingAs($aUser)->putJson(route('games.rounds.choice.update', [$room, $round]), ['choice' => 'sunny']);

    $this->actingAs($hostUser)->postJson(route('games.rounds.reveal.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('ended.answered', 1)
        ->assertJsonPath('ended.weather', null);
});

it('reveals when the room timer runs out', function () {
    ['room' => $room, 'round' => $round, 'aUser' => $aUser] = moodTable();
    $room->update(['timer_ends_at' => now()->addSeconds(10)->startOfSecond()]);

    $this->travel(11)->seconds();
    $this->actingAs($aUser)->getJson(route('games.snapshot.show', $room))->assertJsonPath('round', null);

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Revealed);
});
