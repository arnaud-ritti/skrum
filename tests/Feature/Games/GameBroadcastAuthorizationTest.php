<?php

use App\Enums\RetroPhase;
use App\Models\GameRoom;
use App\Models\Retro;
use App\Models\User;

beforeEach(function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);
    fakeGameRoster([]);
});

function gameChannelRequest(string $channelName): array
{
    return [
        'socket_id' => '1234.5678',
        'channel_name' => $channelName,
    ];
}

it('signs presence data for a team member', function () {
    $room = GameRoom::factory()->create();
    [$user, $player] = gameRoomMember($room);

    $response = $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), gameChannelRequest("presence-game.{$room->id}"))
        ->assertOk();

    $channelData = json_decode($response->json('channel_data'), true);

    expect($response->json('auth'))->toStartWith('test-key:')
        ->and($channelData['user_id'])->toBe($player->id)
        ->and($channelData['user_info'])->toBe([
            'id' => $player->id,
            'name' => $user->name,
            'avatarUrl' => $player->avatarUrl(),
            'isGuest' => false,
            'presence' => $user->presenceColor(),
        ]);
});

it('signs presence data for a guest of a link room', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    $guest = gameRoomGuest($room);

    $response = $this->withCookies(gameGuestCookie($guest))
        ->withCredentials()
        ->postJson(route('broadcasting.auth'), gameChannelRequest("presence-game.{$room->id}"))
        ->assertOk();

    expect(json_decode($response->json('channel_data'), true)['user_info']['isGuest'])->toBeTrue();
});

it('refuses outsiders, unknown rooms and malformed ids', function (string $channel) {
    $room = GameRoom::factory()->create();
    $channel = str_replace('{room}', $room->id, $channel);

    $this->actingAs(User::factory()->create())
        ->postJson(route('broadcasting.auth'), gameChannelRequest($channel))
        ->assertForbidden();
})->with([
    'outsider' => ['presence-game.{room}'],
    'unknown room' => ['presence-game.'.'0199a0a0-0000-7000-8000-000000000000'],
    'malformed id' => ['presence-game.not-a-uuid'],
]);

it('refuses the game channel of an icebreaker room', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    [$user] = retroMember($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create();

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), gameChannelRequest("presence-game.{$room->id}"))
        ->assertForbidden();
});

it('refuses a thirteenth player while twelve are online', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomMember($room);
    fakeGameRoster(array_map(fn (int $index): string => "online-{$index}", range(1, 12)));

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), gameChannelRequest("presence-game.{$room->id}"))
        ->assertConflict()
        ->assertJsonPath('message', __('This room is full.'));
});

it('lets an online player reconnect when the room is full', function () {
    $room = GameRoom::factory()->create();
    [$user, $player] = gameRoomMember($room);
    fakeGameRoster([$player->id, ...array_map(fn (int $index): string => "online-{$index}", range(1, 11))]);

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), gameChannelRequest("presence-game.{$room->id}"))
        ->assertOk();
});

it('admits eleven others plus the requester', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomMember($room);
    fakeGameRoster(array_map(fn (int $index): string => "online-{$index}", range(1, 11)));

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), gameChannelRequest("presence-game.{$room->id}"))
        ->assertOk();
});

it('fails open when Reverb cannot be reached', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomMember($room);
    fakeGameRoster(null);

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), gameChannelRequest("presence-game.{$room->id}"))
        ->assertOk();
});
