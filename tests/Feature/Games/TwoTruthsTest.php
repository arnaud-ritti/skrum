<?php

use App\Actions\Games\EnsureIcebreakerRoom;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Events\Games\GameRoundStarted;
use App\Events\Games\GameVoteChanged;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\GameStatementSet;
use App\Models\Retro;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Event::fake();
    Queue::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-27 10:00:00'));
});

/**
 * @return array{room: GameRoom, round: GameRound, hostUser: mixed, tellerUser: mixed, teller: mixed, aUser: mixed, a: mixed, bUser: mixed, b: mixed}
 */
function twoTruthsTable(array $roundAttributes = []): array
{
    $room = GameRoom::factory()->game(GameKind::TwoTruths)->create();
    [$hostUser] = gameRoomHost($room);
    [$tellerUser, $teller] = gameRoomMember($room);
    [$aUser, $a] = gameRoomMember($room);
    [$bUser, $b] = gameRoomMember($room);
    $round = activeGameRound($room, [
        'word' => null,
        'leader_player_id' => $teller->id,
        'statements' => ['I ski', 'I sing', 'I fly'],
        'lie_index' => 2,
        ...$roundAttributes,
    ]);

    return compact('room', 'round', 'hostUser', 'tellerUser', 'teller', 'aUser', 'a', 'bUser', 'b');
}

it('starts with a teller whose set is ready, copies the set onto the round and plays it once', function () {
    $room = GameRoom::factory()->game(GameKind::TwoTruths)->create();
    [$user] = gameRoomHost($room);
    [, $teller] = gameRoomMember($room);
    [, $unready] = gameRoomMember($room);
    $set = GameStatementSet::factory()->create(['game_room_id' => $room->id, 'player_id' => $teller->id, 'statements' => ['I ski', 'I sing', 'I fly'], 'lie_index' => 2]);
    $start = route('games.rounds.store', $room);

    $this->actingAs($user)->postJson($start)->assertUnprocessable()->assertJsonValidationErrors('leader_player_id');
    $this->actingAs($user)->postJson($start, ['leader_player_id' => $unready->id])->assertUnprocessable()->assertJsonValidationErrors('leader_player_id');

    $round = $this->actingAs($user)->postJson($start, ['leader_player_id' => $teller->id])
        ->assertCreated()
        ->assertJsonPath('round.statements', ['I ski', 'I sing', 'I fly'])
        ->assertJsonPath('round.leaderPlayerId', $teller->id)
        ->assertJsonMissingPath('round.lieIndex')
        ->json('round');

    expect(GameRound::query()->find($round['id'])->lie_index)->toBe(2)
        ->and($set->fresh()->isReady())->toBeFalse();

    $this->actingAs($user)->postJson(route('games.rounds.pass.store', [$room, $round['id']]))->assertOk();
    $this->actingAs($user)->postJson($start, ['leader_player_id' => $teller->id])->assertUnprocessable()->assertJsonValidationErrors('leader_player_id');
});

it('takes one vote per player but the teller, from the start of the round', function () {
    ['room' => $room, 'round' => $round, 'tellerUser' => $tellerUser, 'aUser' => $aUser] = twoTruthsTable();
    $uri = route('games.rounds.choice.update', [$room, $round]);

    $this->actingAs($tellerUser)->putJson($uri, ['choice' => '0'])->assertForbidden();
    $this->actingAs($aUser)->putJson($uri, ['choice' => '3'])->assertUnprocessable();
    $this->actingAs($aUser)->putJson($uri, ['choice' => '0'])->assertNoContent();
    $this->actingAs($aUser)->putJson($uri, ['choice' => '2'])->assertNoContent();

    Event::assertDispatchedTimes(GameVoteChanged::class, 1);
});

it('reveals the lie for the teller or the host, and scores the finders and the teller', function () {
    ['room' => $room, 'round' => $round, 'tellerUser' => $tellerUser, 'teller' => $teller, 'aUser' => $aUser, 'a' => $a, 'bUser' => $bUser, 'b' => $b] = twoTruthsTable();
    $choice = route('games.rounds.choice.update', [$room, $round]);
    $this->actingAs($aUser)->putJson($choice, ['choice' => '2']);
    $this->actingAs($bUser)->putJson($choice, ['choice' => '0']);

    $this->actingAs($aUser)->postJson(route('games.rounds.reveal.store', [$room, $round]))->assertForbidden();

    $this->actingAs($tellerUser)->postJson(route('games.rounds.reveal.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('ended.outcome', GameRoundOutcome::Revealed->value)
        ->assertJsonPath('ended.lieIndex', 2)
        ->assertJsonPath('ended.votes', [
            ['index' => 0, 'playerIds' => [$b->id]],
            ['index' => 1, 'playerIds' => []],
            ['index' => 2, 'playerIds' => [$a->id]],
        ]);

    expect(GamePoint::query()->get()->mapWithKeys(fn (GamePoint $point): array => [$point->player_id => [$point->points, $point->is_win]])->all())
        ->toEqual([$a->id => [5, true], $b->id => [0, false], $teller->id => [2, false]]);
});

it('reveals the lie when the time to vote runs out', function () {
    ['room' => $room, 'round' => $round, 'aUser' => $aUser] = twoTruthsTable(['turn_seconds' => 60, 'turn_ends_at' => now()->addSeconds(60)]);

    $this->travel(61)->seconds();
    $this->actingAs($aUser)->getJson(route('games.snapshot.show', $room))->assertOk();

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Revealed);
});

it('pays nobody when the host passes the round', function () {
    ['room' => $room, 'round' => $round, 'hostUser' => $hostUser, 'aUser' => $aUser] = twoTruthsTable();
    $this->actingAs($aUser)->putJson(route('games.rounds.choice.update', [$room, $round]), ['choice' => '2']);

    $this->actingAs($hostUser)->postJson(route('games.rounds.pass.store', [$room, $round]))->assertOk();

    expect(GamePoint::query()->where('game_round_id', $round->id)->sum('points'))->toBe(0);
});

it('plays in a retro\'s icebreaker, on the retro\'s channel', function () {
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->create(['icebreaker_game' => GameKind::TwoTruths]);
    [$facilitatorUser] = retroFacilitator($retro);
    $room = resolve(EnsureIcebreakerRoom::class)->handle($retro->fresh());
    $host = $room->players()->sole();

    $this->actingAs($facilitatorUser)->putJson(route('games.statements.update', $room), ['statements' => ['A', 'B', 'C'], 'lie_index' => 1])->assertOk();
    $this->actingAs($facilitatorUser)->postJson(route('games.rounds.store', $room), ['leader_player_id' => $host->id])->assertCreated();

    Event::assertDispatched(GameRoundStarted::class, fn (GameRoundStarted $event) => $event->channelName === "retro.{$retro->id}");
});
