<?php

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use Inertia\Testing\AssertableInertia as Assert;

it('lets a team owner who is not a workspace admin change a role', function () {
    $team = Team::factory()->create();
    $owner = teamMember($team, TeamRole::Owner);
    $member = teamMember($team);

    $this->actingAs($owner)
        ->put(route('teams.members.role.update', [$team->workspace, $team, $member]), ['role' => 'facilitator'])
        ->assertRedirect();

    expect($team->roleOf($member))->toBe(TeamRole::Facilitator);
});

it('lets a workspace admin change a role', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);

    $this->actingAs(workspaceManager($team->workspace))
        ->put(route('teams.members.role.update', [$team->workspace, $team, $member]), ['role' => 'observer'])
        ->assertRedirect();

    expect($team->roleOf($member))->toBe(TeamRole::Observer);
});

it('refuses a role change to whoever does not manage the team', function (TeamRole $role) {
    $team = Team::factory()->create();
    $member = teamMember($team);

    $this->actingAs(teamMember($team, $role))
        ->put(route('teams.members.role.update', [$team->workspace, $team, $member]), ['role' => 'owner'])
        ->assertForbidden();

    expect($team->roleOf($member))->toBe(TeamRole::Member);
})->with([TeamRole::Facilitator, TeamRole::Member, TeamRole::Observer]);

it('answers 404 for someone outside the team and 422 for an unknown role', function () {
    $team = Team::factory()->create();
    $owner = teamMember($team, TeamRole::Owner);
    $outsider = teamMember(Team::factory()->for($team->workspace)->create());

    $this->actingAs($owner)
        ->put(route('teams.members.role.update', [$team->workspace, $team, $outsider]), ['role' => 'member'])
        ->assertNotFound();

    $this->actingAs($owner)
        ->put(route('teams.members.role.update', [$team->workspace, $team, teamMember($team)]), ['role' => 'captain'])
        ->assertSessionHasErrors('role');
});

it('adds a member with a role, member by default, and leaves an existing member as they are', function () {
    $team = Team::factory()->create();
    $owner = teamMember($team, TeamRole::Owner);
    $newcomer = workspaceManager($team->workspace, WorkspaceRole::Member);
    $observer = workspaceManager($team->workspace, WorkspaceRole::Member);
    $facilitator = teamMember($team, TeamRole::Facilitator);
    $route = route('teams.members.store', [$team->workspace, $team]);

    $this->actingAs($owner)->post($route, ['user_id' => $newcomer->id])->assertRedirect();
    $this->actingAs($owner)->post($route, ['user_id' => $observer->id, 'role' => 'observer'])->assertRedirect();
    $this->actingAs($owner)->post($route, ['user_id' => $facilitator->id, 'role' => 'observer'])->assertRedirect();

    expect($team->roleOf($newcomer))->toBe(TeamRole::Member)
        ->and($team->roleOf($observer))->toBe(TeamRole::Observer)
        ->and($team->roleOf($facilitator))->toBe(TeamRole::Facilitator);
});

it('sends each member with their role, and the role options to who manages members only', function () {
    $team = Team::factory()->create();
    $owner = teamMember($team, TeamRole::Owner);
    $observer = teamMember($team, TeamRole::Observer);

    $this->actingAs($owner)->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('viewerRole', 'owner')
            ->where('canManage', true)
            ->has('roleOptions', 4)
            ->where('members', fn ($members) => collect($members)->firstWhere('id', $observer->id)['role'] === 'observer'));

    $this->actingAs($observer)->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('viewerRole', 'observer')
            ->where('canManage', false)
            ->where('roleOptions', [])
            ->where('availableMembers', []));
});

it('lets a team owner rename the team and refuses them its deletion', function () {
    $team = Team::factory()->create();
    $owner = teamMember($team, TeamRole::Owner);

    $this->actingAs($owner)->patch(route('teams.update', [$team->workspace, $team]), ['name' => 'Renamed'])->assertRedirect();
    $this->actingAs($owner)->delete(route('teams.destroy', [$team->workspace, $team]))->assertForbidden();

    expect($team->fresh()->name)->toBe('Renamed');
});
