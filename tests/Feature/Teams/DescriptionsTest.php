<?php

use App\Enums\TeamRole;
use App\Models\Team;
use Inertia\Testing\AssertableInertia as Assert;

it('lets a team owner describe the team, and clears an empty description', function () {
    $team = Team::factory()->create();
    $owner = teamMember($team, TeamRole::Owner);
    $route = route('teams.update', [$team->workspace, $team]);

    $this->actingAs($owner)->patch($route, ['name' => $team->name, 'description' => '  Product squad · retro app  '])->assertRedirect();
    expect($team->fresh()->description)->toBe('Product squad · retro app');

    $this->actingAs($owner)->patch($route, ['name' => $team->name, 'description' => ''])->assertRedirect();
    expect($team->fresh()->description)->toBeNull();
});

it('confirms a saved team with a toast', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team, TeamRole::Owner))
        ->patch(route('teams.update', [$team->workspace, $team]), ['name' => 'Borealis', 'description' => 'Product squad'])
        ->assertRedirect()
        ->assertInertiaFlash('toast.type', 'success')
        ->assertInertiaFlash('toast.message', 'Team saved.');
});

it('keeps the description when only the name is sent, and refuses more than 200 characters', function () {
    $team = Team::factory()->create(['description' => 'Kept']);
    $owner = teamMember($team, TeamRole::Owner);
    $route = route('teams.update', [$team->workspace, $team]);

    $this->actingAs($owner)->patch($route, ['name' => 'Renamed'])->assertRedirect();
    $this->actingAs($owner)->patch($route, ['name' => 'Renamed', 'description' => str_repeat('a', 201)])->assertSessionHasErrors('description');

    expect($team->fresh()->description)->toBe('Kept');
});

it('lets a workspace admin rename and describe the workspace, keeping its address, and refuses a member', function () {
    $team = Team::factory()->create();
    $workspace = $team->workspace;
    $slug = $workspace->slug;
    $route = route('workspaces.details.update', $workspace);

    $this->actingAs(teamMember($team))->put($route, ['name' => 'Ours', 'description' => 'Ours'])->assertForbidden();
    $this->actingAs(workspaceManager($workspace))->put($route, ['name' => 'Nordlys', 'description' => 'Nordic product teams'])->assertRedirect();

    $workspace->refresh();

    expect($workspace->name)->toBe('Nordlys')
        ->and($workspace->description)->toBe('Nordic product teams')
        ->and($workspace->slug)->toBe($slug);

    $this->actingAs(teamMember($team))->get(route('workspaces.show', $slug))->assertOk();
});

it('refuses an empty or too long workspace name', function (string $name) {
    $team = Team::factory()->create();
    $before = $team->workspace->name;

    $this->actingAs(workspaceManager($team->workspace))
        ->put(route('workspaces.details.update', $team->workspace), ['name' => $name, 'description' => null])
        ->assertSessionHasErrors('name');

    expect($team->workspace->fresh()->name)->toBe($before);
})->with(['empty' => [''], 'too long' => [str_repeat('a', 101)]]);

it('shows both descriptions on the workspace page', function () {
    $team = Team::factory()->create(['description' => 'Product squad']);
    $team->workspace->update(['description' => 'Nordic product teams']);

    $this->actingAs(teamMember($team))->get(route('workspaces.show', $team->workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->where('workspace.description', 'Nordic product teams')
            ->where('teams.0.description', 'Product squad'));
});
