<?php

use App\Enums\GameKind;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    fakeGameGifs('party');
});

dataset('game json reads', ['snapshot', 'round history', 'ended round', 'gif search']);

/**
 * @return array{0: GameRoom, 1: string}
 */
function gameJsonRead(string $read): array
{
    $room = GameRoom::factory()->game(GameKind::SprintGif)->linkAccess()->create();

    $url = match ($read) {
        'snapshot' => route('games.snapshot.show', $room),
        'round history' => route('games.rounds.index', $room),
        'ended round' => route('games.rounds.show', [$room, GameRound::factory()->ended()->create(['game_room_id' => $room->id])]),
        'gif search' => route('games.gifs.index', $room),
    };

    return [$room, $url];
}

it('answers the json reads of a room to its members, its guests and its observers', function (string $read) {
    [$room, $url] = gameJsonRead($read);
    [$member] = gameRoomMember($room);
    $guest = gameRoomGuest($room);
    $observer = teamMember($room->team, TeamRole::Observer);

    $this->actingAs($member)->getJson($url)->assertOk();
    $this->actingAs($observer)->getJson($url)->assertOk();

    resolve('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))->withCredentials()->getJson($url)->assertOk();
})->with('game json reads');

it('refuses the json reads of a room to a workspace member outside its team and to another workspace', function (string $read) {
    [$room, $url] = gameJsonRead($read);
    $outsider = User::factory()->create();
    $room->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);
    $stranger = User::factory()->create();
    Workspace::factory()->withMember($stranger, WorkspaceRole::Owner)->create();

    $this->actingAs($outsider)->getJson($url)
        ->assertForbidden()
        ->assertJsonPath('message', 'You no longer have access to this room.');

    $this->actingAs($stranger)->getJson($url)
        ->assertForbidden()
        ->assertJsonPath('message', 'You no longer have access to this room.');
})->with('game json reads');

it('answers the json reads of a room with 401 to a visitor without a session', function (string $read) {
    [, $url] = gameJsonRead($read);

    $this->getJson($url)
        ->assertUnauthorized()
        ->assertJsonPath('message', 'Your session has expired.');
})->with('game json reads');

it('answers 404 for a round of another room', function () {
    $room = GameRoom::factory()->create();
    [$member] = gameRoomMember($room);
    $foreignRound = GameRound::factory()->ended()->create();

    $this->actingAs($member)
        ->getJson(route('games.rounds.show', [$room, $foreignRound]))
        ->assertNotFound();
});

it('refuses the secret word to outsiders, to observers and to a visitor without a session', function () {
    $table = wordGuessTable();
    $url = route('games.rounds.secret.show', [$table['room'], $table['round']]);
    $observer = teamMember($table['room']->team, TeamRole::Observer);
    $stranger = User::factory()->create();
    Workspace::factory()->withMember($stranger, WorkspaceRole::Owner)->create();

    $this->actingAs($observer)->getJson($url)->assertForbidden();
    $this->actingAs($stranger)->getJson($url)->assertForbidden();

    resolve('auth')->forgetGuards();

    $this->getJson($url)->assertUnauthorized();
});
