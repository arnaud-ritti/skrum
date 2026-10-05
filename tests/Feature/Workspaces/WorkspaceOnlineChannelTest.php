<?php

use App\Enums\TeamRole;
use App\Models\Team;

beforeEach(function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);
});

it('signs the user id alone for a member of the workspace', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);

    $response = $this->actingAs($member)
        ->postJson(route('broadcasting.auth'), channelAuthRequest("presence-workspace-online.{$team->workspace_id}"))
        ->assertOk();

    $channelData = json_decode($response->json('channel_data'), true);

    expect($response->json('auth'))->toStartWith('test-key:')
        ->and($channelData['user_id'])->toBe($member->id)
        ->and($channelData['user_info'])->toBe(['id' => $member->id]);
});

it('lets an observer and a workspace admin outside every team in', function () {
    $team = Team::factory()->create();
    $channel = channelAuthRequest("presence-workspace-online.{$team->workspace_id}");

    $this->actingAs(teamMember($team, TeamRole::Observer))->postJson(route('broadcasting.auth'), $channel)->assertOk();
    $this->actingAs(workspaceManager($team->workspace))->postJson(route('broadcasting.auth'), $channel)->assertOk();
});

it('keeps members of other workspaces and visitors out', function (string $who) {
    $team = Team::factory()->create();
    $request = match ($who) {
        'other workspace' => $this->actingAs(teamMember(Team::factory()->create())),
        'visitor' => $this,
    };

    $request->postJson(route('broadcasting.auth'), channelAuthRequest("presence-workspace-online.{$team->workspace_id}"))
        ->assertForbidden();
})->with(['other workspace', 'visitor']);

it('refuses a channel that names no workspace', function (string $channel) {
    $member = teamMember(Team::factory()->create());

    $this->actingAs($member)->postJson(route('broadcasting.auth'), channelAuthRequest($channel))->assertForbidden();
})->with([
    'not a uuid' => 'presence-workspace-online.nope',
    'unknown workspace' => 'presence-workspace-online.00000000-0000-4000-8000-000000000000',
    'placeholder' => 'presence-workspace-online.{workspace}',
]);
