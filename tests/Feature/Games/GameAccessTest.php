<?php

use App\Actions\Retros\GuestCookie;
use App\Enums\GameRoomAccess;
use App\Enums\RetroPhase;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

it('creates the player of a team member on first visit', function () {
    $room = GameRoom::factory()->create();
    $user = teamMember($room->team);

    $this->actingAs($user)
        ->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('me.userId', $user->id);

    expect($room->players()->where('user_id', $user->id)->count())->toBe(1);

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))->assertOk();

    expect($room->players()->count())->toBe(1);
});

it('lets workspace admins in and keeps other users out', function () {
    $room = GameRoom::factory()->create();
    $admin = workspaceManager($room->team->workspace);

    $this->actingAs($admin)->getJson(route('games.snapshot.show', $room))->assertOk();
    $this->actingAs(User::factory()->create())
        ->getJson(route('games.snapshot.show', $room))
        ->assertForbidden()
        ->assertJsonPath('message', __('You no longer have access to this room.'));
});

it('renders the room page with the snapshot', function () {
    $room = GameRoom::factory()->create(['name' => 'Lunch break']);
    [$user] = gameRoomHost($room);

    $this->actingAs($user)
        ->get(route('games.show', $room))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('snapshot.room.name', 'Lunch break'));
});

it('sends signed-out visitors to the login page or the session-ended page', function () {
    $teamRoom = GameRoom::factory()->create();
    $linkRoom = GameRoom::factory()->linkAccess()->create();

    $this->get(route('games.show', $teamRoom))->assertRedirect(route('login'));
    $this->get(route('games.show', $linkRoom))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('retros/session-ended'));
    $this->getJson(route('games.snapshot.show', $teamRoom))
        ->assertUnauthorized()
        ->assertJsonPath('message', __('Your session has expired.'));
});

it('resumes guests of link rooms with their cookie', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    $guest = gameRoomGuest($room);

    $this->withCookies(gameGuestCookie($guest))
        ->withCredentials()
        ->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('me.playerId', $guest->id)
        ->assertJsonPath('me.isGuest', true)
        ->assertJsonPath('links.team', null);
});

it('revokes guests when the link is regenerated or access becomes team-only', function (string $change) {
    $room = GameRoom::factory()->linkAccess()->create();
    $guest = gameRoomGuest($room);

    if ($change === 'regenerated') {
        $guest->forceFill(['guest_secret_hash' => null])->save();
    } else {
        $room->update(['access' => GameRoomAccess::Team]);
    }

    $this->withCookies(gameGuestCookie($guest))
        ->withCredentials()
        ->getJson(route('games.snapshot.show', $room))
        ->assertForbidden();
})->with(['regenerated', 'team-only']);

it('refuses a wrong secret', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    $guest = gameRoomGuest($room, 'right');

    $this->withCookies(gameGuestCookie($guest, 'wrong'))
        ->withCredentials()
        ->getJson(route('games.snapshot.show', $room))
        ->assertForbidden();
});

it('revokes removed members', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomMember($room);

    $room->team->members()->detach($user);

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))->assertForbidden();
});

it('refuses a game cookie that names a retro participant', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    $retroGuest = Participant::factory()->guest()->create();

    $this->withCookies([GuestCookie::name(GuestCookie::GameScope, $room->id) => "{$retroGuest->id}|secret"])
        ->withCredentials()
        ->getJson(route('games.snapshot.show', $room))
        ->assertForbidden();
});

it('ignores poker guest cookies', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    $retroGuest = Participant::factory()->guest()->create();

    $this->withCookies([GuestCookie::name(GuestCookie::PokerScope, $room->id) => "{$retroGuest->id}|secret"])
        ->withCredentials()
        ->getJson(route('games.snapshot.show', $room))
        ->assertUnauthorized();
});

it('never lets a guest of one room into another room', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    $other = GameRoom::factory()->linkAccess()->create();
    $guest = gameRoomGuest($room);

    $this->withCookies([GuestCookie::name(GuestCookie::GameScope, $other->id) => "{$guest->id}|secret"])
        ->withCredentials()
        ->getJson(route('games.snapshot.show', $other))
        ->assertForbidden();
});

it('resolves icebreaker players from retro participants', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->withGuestAccess()->create();
    [$user, $participant] = retroMember($retro);
    $retroGuest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $room = GameRoom::factory()->icebreaker($retro)->create();

    $this->withCookies(retroGuestCookie($retroGuest))
        ->withCredentials()
        ->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('me.isGuest', true);

    $this->actingAs($user)
        ->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('me.isGuest', false)
        ->assertJsonFragment(['presenceId' => $participant->id]);

    expect(GamePlayer::query()->where('game_room_id', $room->id)->pluck('participant_id')->sort()->values()->all())
        ->toBe(collect([$participant->id, $retroGuest->id])->sort()->values()->all());
});

it('sends the icebreaker room page to its retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    [$user] = retroMember($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create();

    $this->actingAs($user)->get(route('games.show', $room))->assertRedirect(route('retros.show', $retro));
});

it('answers 404 for unknown rooms', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->getJson('/games/'.fake()->uuid().'/snapshot')->assertNotFound();
});

it('survives a concurrent first visit of the same member', function () {
    $room = GameRoom::factory()->create();
    $user = teamMember($room->team);
    $raced = false;
    $attemptedInserts = 0;

    GamePlayer::creating(function () use (&$attemptedInserts): void {
        $attemptedInserts++;
    });

    DB::connection()->beforeStartingTransaction(function () use (&$raced, $room, $user): void {
        if ($raced) {
            return;
        }

        $raced = true;

        DB::table('game_players')->insert([
            'id' => (string) Str::uuid(),
            'game_room_id' => $room->id,
            'user_id' => $user->id,
            'created_at' => now(),
        ]);
    });

    $this->actingAs($user)
        ->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('me.userId', $user->id);

    expect($raced)->toBeTrue()
        ->and($attemptedInserts)->toBe(1)
        ->and($room->players()->where('user_id', $user->id)->count())->toBe(1);
});
