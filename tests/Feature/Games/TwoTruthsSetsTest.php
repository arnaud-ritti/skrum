<?php

use App\Enums\GameKind;
use App\Events\Games\GameStatementsChanged;
use App\Models\GameRoom;
use App\Models\GameStatementSet;
use Illuminate\Support\Facades\Event;

beforeEach(fn () => Event::fake());

it('lets every player, guests included, write and replace their own set, and tells the others only that it is ready', function () {
    $room = GameRoom::factory()->game(GameKind::TwoTruths)->linkAccess()->create();
    gameRoomHost($room);
    [$aUser, $a] = gameRoomMember($room);
    $guest = gameRoomGuest($room);
    $uri = route('games.statements.update', $room);
    $body = ['statements' => ['I ski', 'I sing', 'I fly'], 'lie_index' => 2];

    $this->actingAs($aUser)->putJson($uri, ['statements' => ['I ski', 'i SKI', 'I fly'], 'lie_index' => 2])->assertUnprocessable();
    $this->actingAs($aUser)->putJson($uri, ['statements' => ['I ski', 'I sing'], 'lie_index' => 1])->assertUnprocessable();
    $this->actingAs($aUser)->putJson($uri, [...$body, 'lie_index' => 3])->assertUnprocessable();
    $this->actingAs($aUser)->putJson($uri, ['statements' => ['I ski', 'I sing', str_repeat('a', 121)], 'lie_index' => 0])->assertUnprocessable();
    $this->actingAs($aUser)->putJson($uri, $body)
        ->assertOk()
        ->assertExactJson(['mine' => ['statements' => $body['statements'], 'lieIndex' => 2, 'played' => false]]);
    $this->actingAs($aUser)->putJson($uri, [...$body, 'lie_index' => 0])->assertOk();
    resolve('auth')->forgetGuards();
    $this->withCookies(gameGuestCookie($guest))->withCredentials()->putJson($uri, $body)->assertOk();

    expect(GameStatementSet::query()->where('player_id', $a->id)->sole()->lie_index)->toBe(0)
        ->and(GameStatementSet::query()->count())->toBe(2);

    Event::assertDispatchedTimes(GameStatementsChanged::class, 2);
    Event::assertDispatched(GameStatementsChanged::class, fn (GameStatementsChanged $event) => $event->broadcastWith() === ['playerId' => $a->id, 'ready' => true]);
});

it('removes a ready set, refuses to remove a played one, and makes a played set ready again when rewritten', function () {
    $room = GameRoom::factory()->game(GameKind::TwoTruths)->create();
    gameRoomHost($room);
    [$aUser, $a] = gameRoomMember($room);
    GameStatementSet::factory()->played()->create(['game_room_id' => $room->id, 'player_id' => $a->id]);

    $this->actingAs($aUser)->deleteJson(route('games.statements.destroy', $room))->assertConflict();
    $this->actingAs($aUser)->putJson(route('games.statements.update', $room), ['statements' => ['A', 'B', 'C'], 'lie_index' => 1])
        ->assertOk()
        ->assertJsonPath('mine.played', false);
    $this->actingAs($aUser)->deleteJson(route('games.statements.destroy', $room))->assertNoContent();

    expect(GameStatementSet::query()->count())->toBe(0);
    Event::assertDispatched(GameStatementsChanged::class, fn (GameStatementsChanged $event) => $event->ready === false);
});

it('refuses a set while the room plays another game', function () {
    $room = GameRoom::factory()->game(GameKind::Hangman)->create();
    [$user] = gameRoomHost($room);

    $this->actingAs($user)->putJson(route('games.statements.update', $room), ['statements' => ['A', 'B', 'C'], 'lie_index' => 1])->assertUnprocessable();
});

it('gives each viewer the ready players and their own set only, and nothing in another game', function () {
    $room = GameRoom::factory()->game(GameKind::TwoTruths)->create();
    [, $host] = gameRoomHost($room);
    [, $a] = gameRoomMember($room);
    [, $b] = gameRoomMember($room);
    GameStatementSet::factory()->create(['game_room_id' => $room->id, 'player_id' => $a->id, 'statements' => ['I ski', 'I sing', 'I fly'], 'lie_index' => 2]);
    GameStatementSet::factory()->played()->create(['game_room_id' => $room->id, 'player_id' => $b->id]);

    expect(gameSnapshotFor($room, $a)['truthSets'])->toBe(['ready' => [$a->id], 'mine' => ['statements' => ['I ski', 'I sing', 'I fly'], 'lieIndex' => 2, 'played' => false]])
        ->and(gameSnapshotFor($room, $b)['truthSets']['mine']['played'])->toBeTrue()
        ->and(gameSnapshotFor($room, $host)['truthSets'])->toBe(['ready' => [$a->id], 'mine' => null])
        ->and(gamePayloadExposesWord(gameSnapshotFor($room, $host), 'I sing'))->toBeFalse();

    $room->forceFill(['game' => GameKind::Hangman])->save();

    expect(gameSnapshotFor($room->fresh(), $a)['truthSets'])->toBeNull();
});
