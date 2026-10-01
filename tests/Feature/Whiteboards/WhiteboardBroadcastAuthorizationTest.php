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

it('refuses outsiders, unknown boards and malformed names', function (Closure $channel) {
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
