<?php

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;

it('leads to the team of the current workspace first', function () {
    $user = User::factory()->create();
    $mine = Team::factory()->for(Workspace::factory()->create(['name' => 'Aurora']))->create(['name' => 'Atlas']);
    $current = Team::factory()->for(Workspace::factory()->create(['name' => 'Zephyr']))->create(['name' => 'Atlas']);
    foreach ([$mine, $current] as $team) {
        $team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
        $team->members()->attach($user, ['role' => TeamRole::Member->value]);
    }
    $user->forceFill(['current_workspace_id' => $current->workspace_id])->save();

    $this->actingAs($user)->get('/t/atlas')->assertRedirect(route('teams.show', [$current->workspace, $current]));
});

it('looks in the other workspaces of the account when the current one has no such team', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $member = teamMember($team);
    $member->forceFill(['current_workspace_id' => Workspace::factory()->withMember($member)->create()->id])->save();

    $this->actingAs($member)->get('/t/atlas')->assertRedirect(route('teams.show', [$team->workspace, $team]));
});

it('answers 404 alike for no team, a team of another workspace and a team the account may not view', function () {
    $foreign = Team::factory()->create(['name' => 'Atlas']);
    $hidden = Team::factory()->create(['name' => 'Borealis']);
    $outsider = User::factory()->create();
    $hidden->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)->get('/t/nothing')->assertNotFound();
    $this->actingAs($outsider)->get("/t/{$foreign->slug}")->assertNotFound();
    $this->actingAs($outsider)->get("/t/{$hidden->slug}")->assertNotFound();
});

it('sends a signed-out visitor to sign in and back', function () {
    $this->get('/t/atlas')->assertRedirect(route('login'));

    expect(session('url.intended'))->toBe(url('/t/atlas'));
});
