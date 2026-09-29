<?php

use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;

beforeEach(function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);
});

function authorizeChannel(Retro $retro): array
{
    return [
        'socket_id' => '1234.5678',
        'channel_name' => "presence-retro.{$retro->id}",
    ];
}

it('signs presence data for a team member', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);

    $response = $this->actingAs($user)->postJson(route('broadcasting.auth'), authorizeChannel($retro))->assertOk();

    $channelData = json_decode($response->json('channel_data'), true);

    expect($response->json('auth'))->toStartWith('test-key:')
        ->and($channelData['user_id'])->toBe($participant->id)
        ->and($channelData['user_info'])->toBe([
            'id' => $participant->id,
            'name' => $user->name,
            'avatarUrl' => $participant->avatarUrl(),
            'isGuest' => false,
        ]);
});

it('signs presence data for a guest with a valid cookie', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $response = $this->withCookies(retroGuestCookie($guest))
        ->withCredentials()
        ->postJson(route('broadcasting.auth'), authorizeChannel($retro))
        ->assertOk();

    expect(json_decode($response->json('channel_data'), true)['user_id'])->toBe($guest->id);
});

it('refuses guests once guest access is disabled', function () {
    $retro = Retro::factory()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))
        ->withCredentials()
        ->postJson(route('broadcasting.auth'), authorizeChannel($retro))
        ->assertForbidden();
});

it('refuses outsiders', function () {
    $retro = Retro::factory()->create();

    $this->actingAs(User::factory()->create())
        ->postJson(route('broadcasting.auth'), authorizeChannel($retro))
        ->assertForbidden();
});

it('refuses other channels and malformed names', function (string $channel) {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), [
            'socket_id' => '1234.5678',
            'channel_name' => str_replace('{retro}', strtoupper($retro->id), $channel),
        ])
        ->assertForbidden();
})->with([
    'private channel' => 'private-App.Models.User.1',
    'not a uuid' => 'presence-retro.nope',
    'unknown retro' => 'presence-retro.00000000-0000-4000-8000-000000000000',
    'uppercase uuid alias' => 'presence-retro.{retro}',
]);

it('validates the socket id', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), ['socket_id' => 'evil', 'channel_name' => "presence-retro.{$retro->id}"])
        ->assertUnprocessable();
});
