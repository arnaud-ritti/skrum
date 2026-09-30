<?php

use App\Models\PokerGame;
use App\Models\User;

beforeEach(function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);
});

function pokerChannelRequest(string $channelName): array
{
    return [
        'socket_id' => '1234.5678',
        'channel_name' => $channelName,
    ];
}

it('signs presence data for a team member', function () {
    $game = PokerGame::factory()->create();
    [$user, $player] = pokerMember($game);

    $response = $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), pokerChannelRequest("presence-poker.{$game->id}"))
        ->assertOk();

    $channelData = json_decode($response->json('channel_data'), true);

    expect($response->json('auth'))->toStartWith('test-key:')
        ->and($channelData['user_id'])->toBe($player->id)
        ->and($channelData['user_info'])->toBe([
            'id' => $player->id,
            'name' => $user->name,
            'avatarUrl' => $player->avatarUrl(),
            'isGuest' => false,
        ]);
});

it('signs presence data for a guest with a valid cookie', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    $guest = pokerGuest($game);

    $response = $this->withCookies(pokerGuestCookie($guest))
        ->withCredentials()
        ->postJson(route('broadcasting.auth'), pokerChannelRequest("presence-poker.{$game->id}"))
        ->assertOk();

    $channelData = json_decode($response->json('channel_data'), true);

    expect($channelData['user_id'])->toBe($guest->id)
        ->and($channelData['user_info']['isGuest'])->toBeTrue();
});

it('refuses guests once guest access is disabled', function () {
    $game = PokerGame::factory()->create();
    $guest = pokerGuest($game);

    $this->withCookies(pokerGuestCookie($guest))
        ->withCredentials()
        ->postJson(route('broadcasting.auth'), pokerChannelRequest("presence-poker.{$game->id}"))
        ->assertForbidden();
});

it('refuses outsiders', function () {
    $game = PokerGame::factory()->create();

    $this->actingAs(User::factory()->create())
        ->postJson(route('broadcasting.auth'), pokerChannelRequest("presence-poker.{$game->id}"))
        ->assertForbidden();
});

it('refuses malformed and unknown poker channels', function (string $channel) {
    $game = PokerGame::factory()->create();
    [$user] = pokerMember($game);

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), pokerChannelRequest(str_replace('{game}', strtoupper($game->id), $channel)))
        ->assertForbidden();
})->with([
    'not a uuid' => 'presence-poker.nope',
    'unknown game' => 'presence-poker.00000000-0000-4000-8000-000000000000',
    'uppercase uuid alias' => 'presence-poker.{game}',
]);
