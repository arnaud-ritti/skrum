<?php

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

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
            'presence' => $user->presenceColor(),
            'isObserver' => false,
        ]);
});

it('flags an observer of the team, who cannot vote, in the presence data', function () {
    $retro = Retro::factory()->create();
    $observer = teamMember($retro->team, TeamRole::Observer);

    $response = $this->actingAs($observer)->postJson(route('broadcasting.auth'), authorizeChannel($retro))->assertOk();

    expect(json_decode($response->json('channel_data'), true)['user_info']['isObserver'])->toBeTrue();
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

it('refuses the retro channels to people outside the team', function (string $channelPrefix, Closure $outsiderOf) {
    $retro = Retro::factory()->create();

    $this->actingAs($outsiderOf($retro))
        ->postJson(route('broadcasting.auth'), ['socket_id' => '1234.5678', 'channel_name' => "{$channelPrefix}.{$retro->id}"])
        ->assertForbidden();
})->with([
    'presence' => 'presence-retro',
    'members' => 'private-retro-members',
])->with([
    'workspace member outside the team' => fn (Retro $retro): User => workspaceManager($retro->team->workspace, WorkspaceRole::Member),
    'owner of another workspace' => fn (Retro $retro): User => workspaceManager(Team::factory()->create()->workspace, WorkspaceRole::Owner),
]);

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

function authorizeParticipantChannel(string $participantId): array
{
    return [
        'socket_id' => '1234.5678',
        'channel_name' => "private-participant.{$participantId}",
    ];
}

it('lets a member subscribe to their own participant channel', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);

    $response = $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), authorizeParticipantChannel($participant->id))
        ->assertOk();

    expect($response->json('auth'))->toStartWith('test-key:');
});

it('lets a guest subscribe to their own participant channel', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))
        ->withCredentials()
        ->postJson(route('broadcasting.auth'), authorizeParticipantChannel($guest->id))
        ->assertOk();
});

it('refuses another participant channel of the same retro', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    [, $other] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), authorizeParticipantChannel($other->id))
        ->assertForbidden();
});

it('refuses unknown or malformed participant channels', function (string $participantId) {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), authorizeParticipantChannel($participantId))
        ->assertForbidden();
})->with([
    'unknown uuid' => fn () => (string) Str::uuid7(),
    'not a uuid' => 'abc',
]);

it('refuses participant channels to anyone but their owner', function (Closure $requestChannel) {
    $requestChannel($this)->assertForbidden();
})->with([
    'guest asking for a member channel' => function (TestCase $test): TestResponse {
        $retro = Retro::factory()->withGuestAccess()->create();
        [, $member] = retroMember($retro);
        $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

        return $test->withCookies(retroGuestCookie($guest))
            ->withCredentials()
            ->postJson(route('broadcasting.auth'), authorizeParticipantChannel($member->id));
    },
    'member asking for a guest channel' => function (TestCase $test): TestResponse {
        $retro = Retro::factory()->withGuestAccess()->create();
        [$user] = retroMember($retro);
        $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

        return $test->actingAs($user)
            ->postJson(route('broadcasting.auth'), authorizeParticipantChannel($guest->id));
    },
    'guest after guest access is disabled' => function (TestCase $test): TestResponse {
        $retro = Retro::factory()->create();
        $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

        return $test->withCookies(retroGuestCookie($guest))
            ->withCredentials()
            ->postJson(route('broadcasting.auth'), authorizeParticipantChannel($guest->id));
    },
    'guest revoked by a link regeneration' => function (TestCase $test): TestResponse {
        $retro = Retro::factory()->withGuestAccess()->create();
        $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
        $guest->update(['guest_secret_hash' => null]);

        return $test->withCookies(retroGuestCookie($guest))
            ->withCredentials()
            ->postJson(route('broadcasting.auth'), authorizeParticipantChannel($guest->id));
    },
    'unauthenticated request without a cookie' => function (TestCase $test): TestResponse {
        $retro = Retro::factory()->withGuestAccess()->create();
        $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

        return $test->postJson(route('broadcasting.auth'), authorizeParticipantChannel($guest->id));
    },
    'uppercase alias of the own id' => function (TestCase $test): TestResponse {
        $retro = Retro::factory()->create();
        [$user, $participant] = retroMember($retro);

        return $test->actingAs($user)
            ->postJson(route('broadcasting.auth'), authorizeParticipantChannel(strtoupper($participant->id)));
    },
]);

function privateChannelRequest(string $channel): array
{
    return ['socket_id' => '1234.5678', 'channel_name' => $channel];
}

it('lets members join the carried action items channel', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $response = $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), privateChannelRequest("private-retro-members.{$retro->id}"))
        ->assertOk();

    expect($response->json('auth'))->toStartWith('test-key:');
});

it('keeps guests and outsiders out of the carried action items channel', function (bool $asGuest) {
    $retro = Retro::factory()->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $request = $asGuest
        ? $this->withCookies(retroGuestCookie($guest))->withCredentials()
        : $this->actingAs(User::factory()->create());

    $request->postJson(route('broadcasting.auth'), privateChannelRequest("private-retro-members.{$retro->id}"))
        ->assertForbidden();
})->with(['guest' => true, 'outsider' => false]);

it('lets team members and workspace admins join the team action items channel', function (bool $asAdmin) {
    $team = Team::factory()->create();
    $user = $asAdmin ? workspaceManager($team->workspace) : teamMember($team);

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), privateChannelRequest("private-team-action-items.{$team->id}"))
        ->assertOk();
})->with(['member' => false, 'admin' => true]);

it('keeps other teams, guests and visitors out of the team action items channel', function (string $who) {
    $retro = Retro::factory()->withGuestAccess()->create();
    $team = $retro->team;
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $request = match ($who) {
        'other team' => $this->actingAs(teamMember(Team::factory()->create(['workspace_id' => $team->workspace_id]))),
        'guest' => $this->withCookies(retroGuestCookie($guest))->withCredentials(),
        'visitor' => $this,
    };

    $request->postJson(route('broadcasting.auth'), privateChannelRequest("private-team-action-items.{$team->id}"))
        ->assertForbidden();
})->with(['other team', 'guest', 'visitor']);
