<?php

use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;

it('sends a guest to the login page', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

it('sends a user without a workspace to the workspace creation', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('onboarding.show'));
});

it('sends the user to the remembered team', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Admin)->create();
    Team::factory()->for($workspace)->create(['name' => 'Alpha']);
    $remembered = Team::factory()->for($workspace)->create(['name' => 'Bravo']);

    $this->actingAs($user)
        ->withSession(['current_team_id' => $remembered->id])
        ->get(route('dashboard'))
        ->assertRedirect(route('teams.show', [$workspace, $remembered]));
});

it('sends the user without a remembered team to the first visible team by name', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Admin)->create();
    Team::factory()->for($workspace)->create(['name' => 'Bravo']);
    $first = Team::factory()->for($workspace)->create(['name' => 'Alpha']);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertRedirect(route('teams.show', [$workspace, $first]));
});

it('ignores a remembered team of another workspace', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Admin)->create();
    $first = Team::factory()->for($workspace)->create(['name' => 'Alpha']);
    $foreign = Team::factory()->create(['name' => 'Aardvark']);

    $this->actingAs($user)
        ->withSession(['current_team_id' => $foreign->id])
        ->get(route('dashboard'))
        ->assertRedirect(route('teams.show', [$workspace, $first]));
});

it('ignores a remembered team the member can no longer see', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user)->create();
    $visible = Team::factory()->for($workspace)->withMember($user)->create(['name' => 'Bravo']);
    $hidden = Team::factory()->for($workspace)->create(['name' => 'Alpha']);

    $this->actingAs($user)
        ->withSession(['current_team_id' => $hidden->id])
        ->get(route('dashboard'))
        ->assertRedirect(route('teams.show', [$workspace, $visible]));
});

it('lands a workspace without a visible team on the workspace page without a loop', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user)->create();
    Team::factory()->for($workspace)->create();

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertRedirect(route('workspaces.show', $workspace));

    $this->actingAs($user)
        ->followingRedirects()
        ->get(route('dashboard'))
        ->assertOk();
});

it('lands a user without a workspace on the creation without a loop', function () {
    $this->actingAs(User::factory()->create())
        ->followingRedirects()
        ->get(route('dashboard'))
        ->assertOk();
});

it('opens the team page reached through the dashboard', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Admin)->create();
    Team::factory()->for($workspace)->create();

    $this->actingAs($user)
        ->followingRedirects()
        ->get(route('dashboard'))
        ->assertOk();
});
