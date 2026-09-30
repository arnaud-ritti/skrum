<?php

use App\Actions\Games\EnsureIcebreakerRoom;
use App\Actions\Games\RoomLeaderboard;
use App\Enums\GameKind;
use App\Enums\RetroPhase;
use App\Events\Games\GameRoomChanged;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\Retro;
use App\Models\User;
use Illuminate\Support\Facades\Event;

/**
 * @return array{0: User, 1: GamePlayer}
 */
function namedGameRoomMember(GameRoom $room, string $name): array
{
    [$user, $player] = gameRoomMember($room);
    $user->forceFill(['name' => $name])->save();

    return [$user, $player];
}

it('ranks a room by points, wins and name, guests included', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    [, $alice] = namedGameRoomMember($room, 'Alice');
    [, $bob] = namedGameRoomMember($room, 'Bob');
    $guest = gameRoomGuest($room);
    $guest->forceFill(['guest_name' => 'Zed Zebra'])->save();
    awardGamePoints($room, $bob, 10, true);
    awardGamePoints($room, $alice, 10, true);
    awardGamePoints($room, $alice, 0);
    awardGamePoints($room, $guest, 12);
    awardGamePoints(GameRoom::factory()->create(['team_id' => $room->team_id]), $bob, 50);

    expect(app(RoomLeaderboard::class)->handle($room->fresh()))->toBe([
        ['playerId' => $guest->id, 'points' => 12, 'wins' => 0, 'roundsPlayed' => 1],
        ['playerId' => $alice->id, 'points' => 10, 'wins' => 1, 'roundsPlayed' => 2],
        ['playerId' => $bob->id, 'points' => 10, 'wins' => 1, 'roundsPlayed' => 1],
    ]);
});

it('sends the room leaderboard to every player', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    [$user, $player] = gameRoomMember($room);
    $guest = gameRoomGuest($room);
    awardGamePoints($room, $player, 4, true);

    $this->actingAs($user)
        ->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('leaderboard', [['playerId' => $player->id, 'points' => 4, 'wins' => 1, 'roundsPlayed' => 1]])
        ->assertJsonPath('scoresResetAt', null);

    app('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))->withCredentials()
        ->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('leaderboard.0.playerId', $player->id);
});

it('resets the scores of a standalone room for its managers', function () {
    Event::fake([GameRoomChanged::class]);
    $room = GameRoom::factory()->create();
    [$hostUser, $host] = gameRoomHost($room);
    awardGamePoints($room, $host, 7, true);

    $this->actingAs($hostUser)
        ->deleteJson(route('games.scores.destroy', $room))
        ->assertNoContent();

    expect($room->fresh()->scores_reset_at)->not->toBeNull()
        ->and(app(RoomLeaderboard::class)->handle($room->fresh()))->toBe([])
        ->and((int) GamePoint::query()->sum('points'))->toBe(7);
    Event::assertDispatched(GameRoomChanged::class, fn (GameRoomChanged $event) => $event->roomId === $room->id);

    $this->travel(1)->seconds();
    awardGamePoints($room, $host, 3);

    $this->actingAs($hostUser)
        ->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('leaderboard.0.points', 3)
        ->assertJsonPath('scoresResetAt', $room->fresh()->scores_reset_at->toIso8601String());
});

it('lets the creator and workspace admins reset the scores', function () {
    $room = GameRoom::factory()->create();
    gameRoomHost($room);
    [$creator] = gameRoomMember($room);
    $room->forceFill(['created_by_user_id' => $creator->id])->save();
    $admin = workspaceManager($room->team->workspace);
    GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $admin->id]);

    $this->actingAs($creator)->deleteJson(route('games.scores.destroy', $room))->assertNoContent();
    $this->actingAs($admin)->deleteJson(route('games.scores.destroy', $room))->assertNoContent();
});

it('refuses resets to other players and guests', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    gameRoomHost($room);
    [$member] = gameRoomMember($room);
    $guest = gameRoomGuest($room);

    $this->actingAs($member)
        ->deleteJson(route('games.scores.destroy', $room))
        ->assertForbidden();

    app('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))->withCredentials()
        ->deleteJson(route('games.scores.destroy', $room))
        ->assertForbidden();

    expect($room->fresh()->scores_reset_at)->toBeNull();
});

it('keeps every point of an icebreaker room and cannot reset it', function () {
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->create(['icebreaker_game' => GameKind::Hangman]);
    [$facilitator] = retroFacilitator($retro);
    $room = app(EnsureIcebreakerRoom::class)->handle($retro->fresh());
    $room->forceFill(['scores_reset_at' => now()->addMinute()])->save();
    $host = $room->players()->sole();
    awardGamePoints($room, $host, 6, true);

    $this->actingAs($facilitator)
        ->deleteJson(route('games.scores.destroy', $room))
        ->assertNotFound();
    $this->actingAs($facilitator)
        ->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('leaderboard.0.points', 6)
        ->assertJsonPath('scoresResetAt', null);
});
