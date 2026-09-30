<?php

use App\Enums\RetroPhase;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Retro;
use Illuminate\Support\Facades\Http;

it('searches GIFs for players through the server', function () {
    fakeGameGifs('party', 'coffee');
    [$room, $user] = sprintGifRoom();

    $response = $this->actingAs($user)
        ->getJson(route('games.gifs.index', ['room' => $room, 'q' => 'party']))
        ->assertOk()
        ->assertJsonPath('gifs.0.id', 'party')
        ->assertJsonPath('gifs.0.previewUrl', route('gifs.show', ['gif' => 'party', 'size' => 'preview'], false))
        ->assertJsonPath('gifs.0.width', 200);

    expect($response->getContent())->not->toContain('game-gif-key')->not->toContain('giphy.com');
});

it('returns trending GIFs for an empty query and serves guests', function () {
    fakeGameGifs('party', 'coffee');
    [$room] = sprintGifRoom();
    $guest = gameRoomGuest($room);

    $this->withCookies(gameGuestCookie($guest))->withCredentials()
        ->getJson(route('games.gifs.index', $room))
        ->assertOk()
        ->assertJsonPath('gifs.1.id', 'coffee');

    Http::assertSent(fn ($request) => str_contains($request->url(), '/trending'));
});

it('is missing without a provider', function () {
    fakeGameGifs('party', 'coffee');
    [$room, $user] = sprintGifRoom();
    config(['services.gifs.provider' => null]);

    $this->actingAs($user)->getJson(route('games.gifs.index', $room))->assertNotFound();
});

it('is refused when the retro turned GIFs off', function () {
    fakeGameGifs('party', 'coffee');
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create(['gifs_enabled' => false]);
    [$user, $facilitator] = retroFacilitator($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create();
    GamePlayer::factory()->forParticipant($facilitator)->create(['game_room_id' => $room->id]);

    $this->actingAs($user)->getJson(route('games.gifs.index', $room))
        ->assertForbidden()
        ->assertJsonPath('message', __('GIFs are turned off for this board.'));
});

it('limits searches per player', function () {
    fakeGameGifs('party', 'coffee');
    [$room, $user] = sprintGifRoom();
    [$otherUser] = gameRoomMember($room);

    foreach (range(1, 20) as $attempt) {
        $this->actingAs($user)->getJson(route('games.gifs.index', ['room' => $room, 'q' => "q{$attempt}"]))->assertOk();
    }

    $this->actingAs($user)->getJson(route('games.gifs.index', ['room' => $room, 'q' => 'q21']))
        ->assertTooManyRequests()
        ->assertJsonPath('message', __('Too many searches, wait a moment.'));

    $this->actingAs($otherUser)->getJson(route('games.gifs.index', ['room' => $room, 'q' => 'q21']))->assertOk();
});

it('answers 502 when the provider fails', function () {
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'game-gif-key', 'rating' => 'pg']]);
    Http::fake(['api.giphy.com/*' => Http::response([], 500)]);
    [$room, $user] = sprintGifRoom();

    $this->actingAs($user)->getJson(route('games.gifs.index', ['room' => $room, 'q' => 'x']))
        ->assertStatus(502)
        ->assertJsonPath('message', __('GIF search is unavailable.'));
});
