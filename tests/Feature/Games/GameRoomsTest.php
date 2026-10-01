<?php

use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Enums\RetroPhase;
use App\Events\Games\GameRoomChanged;
use App\Events\Games\GameRoomDeleted;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\FakeGameRules;

beforeEach(function () {
    Event::fake();
    bindGameRules(new FakeGameRules(kind: GameKind::Hangman));
});

/**
 * @return array<string, string>
 */
function teamGamesParams(Team $team): array
{
    return ['workspace' => $team->workspace->slug, 'team' => $team->id];
}

it('lists the standalone rooms of the team', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $room = GameRoom::factory()->create(['team_id' => $team->id, 'name' => 'Lunch']);
    GamePlayer::factory()->count(2)->create(['game_room_id' => $room->id]);
    GameRound::factory()->ended()->create(['game_room_id' => $room->id]);
    activeGameRound($room);
    GameRoom::factory()->icebreaker(Retro::factory()->inPhase(RetroPhase::Icebreaker)->create(['team_id' => $team->id]))->create();
    GameRoom::factory()->create();

    $this->actingAs($user)
        ->get(route('teams.games.index', teamGamesParams($team)))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('team.id', $team->id)
            ->has('rooms', 1)
            ->where('rooms.0', [
                'id' => $room->id,
                'name' => 'Lunch',
                'game' => 'hangman',
                'gameLabel' => __('Hangman'),
                'access' => 'team',
                'playersCount' => 2,
                'roundsCount' => 1,
                'updatedAt' => $room->fresh()->updated_at?->toIso8601String(),
            ])
            ->where('canCreate', true)
            ->where('roomLimit', 10)
            ->where('gameOptions.2', ['value' => 'hangman', 'label' => __('Hangman'), 'available' => true]));
});

it('keeps the games page to team viewers', function () {
    $team = Team::factory()->create();
    $outsider = User::factory()->create();
    $team->workspace->members()->attach($outsider, ['role' => 'member']);

    $this->actingAs($outsider)->get(route('teams.games.index', teamGamesParams($team)))->assertForbidden();
    $this->actingAs(workspaceManager($team->workspace))->get(route('teams.games.index', teamGamesParams($team)))->assertOk();
});

it('creates a room hosted by its creator in the creator locale', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $user->forceFill(['locale' => 'fr'])->save();

    $this->actingAs($user)
        ->post(route('teams.games.store', teamGamesParams($team)), ['name' => 'Coffee break', 'game' => 'hangman', 'access' => 'link'])
        ->assertRedirect();

    $room = GameRoom::query()->sole();
    $host = $room->players()->sole();

    expect($room->name)->toBe('Coffee break')
        ->and($room->game)->toBe(GameKind::Hangman)
        ->and($room->access)->toBe(GameRoomAccess::Link)
        ->and($room->locale)->toBe('fr')
        ->and($room->created_by_user_id)->toBe($user->id)
        ->and($room->host_player_id)->toBe($host->id)
        ->and($host->user_id)->toBe($user->id)
        ->and(strlen($room->guest_token))->toBe(40);
});

it('caps a team at ten standalone rooms', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    GameRoom::factory()->count(10)->create(['team_id' => $team->id]);
    GameRoom::factory()->icebreaker(Retro::factory()->create(['team_id' => $team->id]))->create();

    $this->actingAs($user)
        ->post(route('teams.games.store', teamGamesParams($team)), ['name' => 'Eleventh', 'game' => 'hangman', 'access' => 'team'])
        ->assertSessionHasErrors(['name' => __('This team already has 10 game rooms.')]);

    $this->actingAs($user)
        ->get(route('teams.games.index', teamGamesParams($team)))
        ->assertInertia(fn (Assert $page) => $page->where('canCreate', false));
});

it('does not count icebreaker rooms against the cap', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    GameRoom::factory()->count(9)->create(['team_id' => $team->id]);
    GameRoom::factory()->icebreaker(Retro::factory()->create(['team_id' => $team->id]))->create();

    $this->actingAs($user)
        ->post(route('teams.games.store', teamGamesParams($team)), ['name' => 'Tenth', 'game' => 'hangman', 'access' => 'team'])
        ->assertSessionHasNoErrors();
});

it('validates new rooms', function (array $input, string $field) {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $this->actingAs($user)
        ->post(route('teams.games.store', teamGamesParams($team)), [...['name' => 'Room', 'game' => 'hangman', 'access' => 'team'], ...$input])
        ->assertSessionHasErrors($field);

    expect(GameRoom::query()->count())->toBe(0);
})->with([
    'missing name' => [['name' => ''], 'name'],
    'long name' => [['name' => str_repeat('a', 61)], 'name'],
    'unknown game' => [['game' => 'chess'], 'game'],
    'unavailable game' => [['game' => 'gif'], 'game'],
    'unknown access' => [['access' => 'public'], 'access'],
]);

it('lets the host rename a room and change its access and locale', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);

    $this->actingAs($user)
        ->patchJson(route('games.update', $room), ['name' => 'Renamed', 'access' => 'link', 'locale' => 'de'])
        ->assertNoContent();

    expect($room->fresh())
        ->name->toBe('Renamed')
        ->access->toBe(GameRoomAccess::Link)
        ->locale->toBe('de');

    Event::assertDispatched(fn (GameRoomChanged $event) => $event->roomId === $room->id);
});

it('keeps room settings to managers', function () {
    $room = GameRoom::factory()->create();
    gameRoomHost($room);
    [$member] = gameRoomMember($room);

    $this->actingAs($member)->patchJson(route('games.update', $room), ['name' => 'Mine'])->assertForbidden();
    $this->actingAs(workspaceManager($room->team->workspace))->patchJson(route('games.update', $room), ['name' => 'Admin'])->assertNoContent();
});

it('validates room settings', function (array $input) {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);

    $this->actingAs($user)->patchJson(route('games.update', $room), $input)->assertUnprocessable();
})->with([
    [['name' => '']],
    [['name' => str_repeat('a', 61)]],
    [['access' => 'public']],
    [['locale' => 'it']],
]);

it('only changes the locale of an icebreaker room', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    [$user, $facilitator] = retroFacilitator($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create();

    $this->actingAs($user)->patchJson(route('games.update', $room), ['name' => 'Nope'])->assertUnprocessable();
    $this->actingAs($user)->patchJson(route('games.update', $room), ['locale' => 'es'])->assertNoContent();

    expect($room->fresh()->locale)->toBe('es');
});

it('lets the creator or an admin delete a room', function (string $who) {
    $room = GameRoom::factory()->create();
    [$creator, $creatorPlayer] = gameRoomHost($room);
    $room->forceFill(['created_by_user_id' => $creator->id])->save();
    activeGameRound($room);
    $actor = $who === 'creator' ? $creator : workspaceManager($room->team->workspace);

    $this->actingAs($actor)->deleteJson(route('games.destroy', $room))->assertNoContent();

    expect(GameRoom::query()->count())->toBe(0)
        ->and(GamePlayer::query()->count())->toBe(0)
        ->and(GameRound::query()->count())->toBe(0);

    Event::assertDispatched(fn (GameRoomDeleted $event) => $event->roomId === $room->id);
})->with(['creator', 'admin']);

it('refuses deletion to hosts who did not create the room and to members', function () {
    $room = GameRoom::factory()->create(['created_by_user_id' => User::factory()]);
    [$host] = gameRoomHost($room);
    [$member] = gameRoomMember($room);

    $this->actingAs($host)->deleteJson(route('games.destroy', $room))->assertForbidden();
    $this->actingAs($member)->deleteJson(route('games.destroy', $room))->assertForbidden();
});

it('never deletes an icebreaker room on its own', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    $room = GameRoom::factory()->icebreaker($retro)->create();

    $this->actingAs(workspaceManager($retro->team->workspace))->deleteJson(route('games.destroy', $room))->assertNotFound();
});

it('regenerates the guest link and revokes existing guests', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    [$user] = gameRoomHost($room);
    $guest = gameRoomGuest($room);
    $oldToken = $room->guest_token;

    $response = $this->actingAs($user)->postJson(route('games.guest-token.store', $room))->assertOk();

    $room->refresh();

    expect($room->guest_token)->not->toBe($oldToken)
        ->and($response->json('guestUrl'))->toBe(route('games.join.show', $room->guest_token))
        ->and($guest->fresh()->guest_secret_hash)->toBeNull();

    resolve('auth')->forgetGuards();

    $this->withCredentials()->withCookies(gameGuestCookie($guest))->getJson(route('games.snapshot.show', $room))->assertForbidden();
});

it('keeps the guest link to managers', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    gameRoomHost($room);
    [$member] = gameRoomMember($room);

    $this->actingAs($member)->postJson(route('games.guest-token.store', $room))->assertForbidden();
});

it('hands hosting to another member', function () {
    $room = GameRoom::factory()->create();
    [$hostUser] = gameRoomHost($room);
    [, $member] = gameRoomMember($room);

    $this->actingAs($hostUser)->putJson(route('games.host.update', $room), ['player_id' => $member->id])->assertNoContent();

    expect($room->fresh()->host_player_id)->toBe($member->id);
    Event::assertDispatched(GameRoomChanged::class);
});

it('never hands hosting to a guest or a player of another room', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    [$hostUser] = gameRoomHost($room);
    $guest = gameRoomGuest($room);
    $stranger = GamePlayer::factory()->create();

    $this->actingAs($hostUser)->putJson(route('games.host.update', $room), ['player_id' => $guest->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['player_id' => __('Only a team member can host.')]);
    $this->actingAs($hostUser)->putJson(route('games.host.update', $room), ['player_id' => $stranger->id])->assertUnprocessable();
});

it('lets the creator and admins become host, but not other members', function () {
    $room = GameRoom::factory()->create();
    gameRoomHost($room);
    [$creator, $creatorPlayer] = gameRoomMember($room);
    $room->forceFill(['created_by_user_id' => $creator->id])->save();
    [$member, $memberPlayer] = gameRoomMember($room);
    $admin = workspaceManager($room->team->workspace);
    $adminPlayer = GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $admin->id]);

    $this->actingAs($member)->putJson(route('games.host.update', $room), ['player_id' => $memberPlayer->id])
        ->assertForbidden()
        ->assertJsonPath('message', __('Only the room creator or a workspace admin can take hosting.'));

    $this->actingAs($creator)->putJson(route('games.host.update', $room), ['player_id' => $creatorPlayer->id])->assertNoContent();
    expect($room->fresh()->host_player_id)->toBe($creatorPlayer->id);

    $this->actingAs($admin)->putJson(route('games.host.update', $room), ['player_id' => $adminPlayer->id])->assertNoContent();
    expect($room->fresh()->host_player_id)->toBe($adminPlayer->id);
});

it('refuses host changes to non-hosts and in icebreaker rooms', function () {
    $room = GameRoom::factory()->create();
    [, $host] = gameRoomHost($room);
    [$member] = gameRoomMember($room);
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    [$facilitator] = retroFacilitator($retro);
    $icebreaker = GameRoom::factory()->icebreaker($retro)->create();

    $this->actingAs($member)->putJson(route('games.host.update', $room), ['player_id' => $host->id])->assertForbidden();
    $this->actingAs($facilitator)->putJson(route('games.host.update', $icebreaker), ['player_id' => fake()->uuid()])->assertNotFound();
});
