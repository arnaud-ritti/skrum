<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Whiteboard;

beforeEach(function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);
});

function whiteboardChannelRequest(string $channelName): array
{
    return ['socket_id' => '1234.5678', 'channel_name' => $channelName];
}

it('signs presence data for a team member', function () {
    $board = Whiteboard::factory()->create();
    [$user, $member] = whiteboardMember($board);

    $response = $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), whiteboardChannelRequest("presence-whiteboard.{$board->id}"))
        ->assertOk();

    $channelData = json_decode($response->json('channel_data'), true);

    expect($response->json('auth'))->toStartWith('test-key:')
        ->and($channelData['user_id'])->toBe($member->id)
        ->and($channelData['user_info'])->toBe([
            'id' => $member->id,
            'name' => $user->name,
            'avatarUrl' => $member->avatarUrl(),
            'isGuest' => false,
            'presence' => $user->presenceColor(),
        ]);
});

it('signs presence data for a guest', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    $guest = whiteboardGuest($board);

    $response = $this->withCookies(whiteboardGuestCookie($guest))
        ->withCredentials()
        ->postJson(route('broadcasting.auth'), whiteboardChannelRequest("presence-whiteboard.{$board->id}"))
        ->assertOk();

    expect(json_decode($response->json('channel_data'), true)['user_info']['isGuest'])->toBeTrue();
});

it('refuses an outsider, an unknown board and a malformed name', function (Closure $channel) {
    $board = Whiteboard::factory()->create();
    $outsider = User::factory()->create();
    $board->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)
        ->postJson(route('broadcasting.auth'), whiteboardChannelRequest($channel()($board)))
        ->assertForbidden();
})->with([
    'outsider' => [fn () => fn (Whiteboard $board) => "presence-whiteboard.{$board->id}"],
    'unknown board' => [fn () => fn () => 'presence-whiteboard.'.fake()->uuid()],
    'not a uuid' => [fn () => fn () => 'presence-whiteboard.nope'],
]);

it('refuses a channel that names no board even to a workspace admin', function (string $channelName) {
    $board = Whiteboard::factory()->create();

    $this->actingAs(workspaceManager($board->team->workspace))
        ->postJson(route('broadcasting.auth'), whiteboardChannelRequest("presence-whiteboard.{$board->id}"))
        ->assertOk();

    $this->actingAs(workspaceManager($board->team->workspace))
        ->postJson(route('broadcasting.auth'), whiteboardChannelRequest($channelName))
        ->assertForbidden();
})->with([
    'unknown board' => [fn () => 'presence-whiteboard.'.fake()->uuid()],
    'not a uuid' => ['presence-whiteboard.nope'],
]);

it('refuses a guest once guest access is off or with the wrong secret', function (bool $guestAccess, string $secret) {
    $board = Whiteboard::factory()->create(['guest_access_enabled' => $guestAccess]);
    $guest = whiteboardGuest($board);

    $this->withCookies(whiteboardGuestCookie($guest, $secret))
        ->withCredentials()
        ->postJson(route('broadcasting.auth'), whiteboardChannelRequest("presence-whiteboard.{$board->id}"))
        ->assertForbidden();
})->with([
    'guest access off' => [false, 'secret'],
    'wrong secret' => [true, 'not-the-secret'],
]);
