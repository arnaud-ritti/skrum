<?php

use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Enums\WorkspaceRole;
use App\Models\GameRoom;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Support\Games\GameRulesRegistry;
use Inertia\Testing\AssertableInertia as Assert;

function workspaceWith(User $user, WorkspaceRole $role): Workspace
{
    return Workspace::factory()->withMember($user, $role)->create();
}

it('lets managers create teams', function (WorkspaceRole $role) {
    $user = User::factory()->create();
    $workspace = workspaceWith($user, $role);

    $this->actingAs($user)
        ->post(route('teams.store', $workspace), ['name' => 'Backend'])
        ->assertRedirect();

    expect($workspace->teams()->sole()->name)->toBe('Backend');
})->with([WorkspaceRole::Owner, WorkspaceRole::Admin]);

it('forbids members from creating teams', function () {
    $user = User::factory()->create();
    $workspace = workspaceWith($user, WorkspaceRole::Member);

    $this->actingAs($user)
        ->post(route('teams.store', $workspace), ['name' => 'Backend'])
        ->assertForbidden();
});

it('shows managers every team and members only their own', function () {
    $admin = User::factory()->create();
    $member = User::factory()->create();
    $workspace = Workspace::factory()
        ->withMember($admin, WorkspaceRole::Admin)
        ->withMember($member, WorkspaceRole::Member)
        ->create();
    Team::factory()->for($workspace)->withMember($member)->create(['name' => 'Mine']);
    Team::factory()->for($workspace)->create(['name' => 'Other']);

    $this->actingAs($admin)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (Assert $page) => $page->has('teams', 2)->where('canManage', true));

    $this->actingAs($member)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->has('teams', 1)
            ->where('teams.0.name', 'Mine')
            ->where('canManage', false));
});

it('forbids members from opening teams they do not belong to', function () {
    $member = User::factory()->create();
    $workspace = workspaceWith($member, WorkspaceRole::Member);
    $team = Team::factory()->for($workspace)->create();

    $this->actingAs($member)->get(route('teams.show', [$workspace, $team]))->assertForbidden();
});

it('returns not found for a team of another workspace', function () {
    $admin = User::factory()->create();
    $workspace = workspaceWith($admin, WorkspaceRole::Admin);
    $foreignTeam = Team::factory()->create();

    $this->actingAs($admin)->get(route('teams.show', [$workspace, $foreignTeam]))->assertNotFound();
});

it('lets team members view their team', function () {
    $member = User::factory()->create();
    $workspace = workspaceWith($member, WorkspaceRole::Member);
    $team = Team::factory()->for($workspace)->withMember($member)->create();

    $this->actingAs($member)
        ->get(route('teams.show', [$workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/show')
            ->has('members', 1)
            ->where('canManage', false));
});

it('lets managers rename and delete teams', function () {
    $admin = User::factory()->create();
    $workspace = workspaceWith($admin, WorkspaceRole::Admin);
    $team = Team::factory()->for($workspace)->create();

    $this->actingAs($admin)->patch(route('teams.update', [$workspace, $team]), ['name' => 'Renamed']);
    expect($team->fresh()->name)->toBe('Renamed');

    $this->actingAs($admin)->delete(route('teams.destroy', [$workspace, $team]))
        ->assertRedirect(route('workspaces.show', $workspace));
    expect(Team::query()->whereKey($team->id)->exists())->toBeFalse();
});

it('lets managers add and remove workspace members from a team', function () {
    $admin = User::factory()->create();
    $colleague = User::factory()->create();
    $workspace = Workspace::factory()
        ->withMember($admin, WorkspaceRole::Admin)
        ->withMember($colleague, WorkspaceRole::Member)
        ->create();
    $team = Team::factory()->for($workspace)->create();

    $this->actingAs($admin)->post(route('teams.members.store', [$workspace, $team]), ['user_id' => $colleague->id]);
    expect($team->members()->whereKey($colleague->id)->exists())->toBeTrue();

    $this->actingAs($admin)->delete(route('teams.members.destroy', [$workspace, $team, $colleague]));
    expect($team->members()->whereKey($colleague->id)->exists())->toBeFalse();
});

it('refuses to add someone outside the workspace to a team', function () {
    $admin = User::factory()->create();
    $workspace = workspaceWith($admin, WorkspaceRole::Admin);
    $team = Team::factory()->for($workspace)->create();

    $this->actingAs($admin)
        ->post(route('teams.members.store', [$workspace, $team]), ['user_id' => User::factory()->create()->id])
        ->assertSessionHasErrors('user_id');
});

it('forbids members from managing team membership', function () {
    $member = User::factory()->create();
    $workspace = workspaceWith($member, WorkspaceRole::Member);
    $team = Team::factory()->for($workspace)->withMember($member)->create();

    $this->actingAs($member)
        ->post(route('teams.members.store', [$workspace, $team]), ['user_id' => $member->id])
        ->assertForbidden();
});

it('shows the team health check statements to every team member', function () {
    $member = User::factory()->create();
    $workspace = workspaceWith($member, WorkspaceRole::Member);
    $team = Team::factory()->for($workspace)->withMember($member)->create();

    $this->actingAs($member)
        ->get(route('teams.show', [$workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->has('healthStatements', 6)
            ->where('healthStatements.0', [
                'id' => 'interaction',
                'key' => 'interaction',
                'label' => 'Interaction',
                'text' => 'Interaction with colleagues was productive',
                'isBuiltin' => true,
                'isArchived' => false,
            ])
            ->where('canManageHealthStatements', false));
});

it('lists archived statements with their row ids for managers', function () {
    $admin = User::factory()->create();
    $workspace = workspaceWith($admin, WorkspaceRole::Admin);
    $team = Team::factory()->for($workspace)->create();
    resolve(ManageTeamHealthStatements::class)->archive($team, 'vision');
    $vision = $team->healthStatements()->where('builtin', 'vision')->sole();

    $this->actingAs($admin)
        ->get(route('teams.show', [$workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('healthStatements.3.id', $vision->id)
            ->where('healthStatements.3.isArchived', true)
            ->where('canManageHealthStatements', true));
});

it('presents built-in statements translated and custom statements as stored', function () {
    $admin = User::factory()->create(['locale' => 'fr']);
    $workspace = workspaceWith($admin, WorkspaceRole::Admin);
    $team = Team::factory()->for($workspace)->create();
    $custom = resolve(ManageTeamHealthStatements::class)->add($team, 'We ship calmly', 'Calm');

    $this->actingAs($admin)
        ->get(route('teams.show', [$workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('healthStatements.0.text', 'Les échanges avec mes collègues ont été productifs')
            ->where('healthStatements.6', [
                'id' => $custom->id,
                'key' => $custom->id,
                'label' => 'Calm',
                'text' => 'We ship calmly',
                'isBuiltin' => false,
                'isArchived' => false,
            ]));
});

it('carries the game options of the games page on the team page', function () {
    $member = User::factory()->create();
    $workspace = workspaceWith($member, WorkspaceRole::Member);
    $team = Team::factory()->for($workspace)->withMember($member)->create();

    $this->actingAs($member)
        ->get(route('teams.show', [$workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('gameOptions', app(GameRulesRegistry::class)->options(new GameRoom(['team_id' => $team->id])))
            ->where('gameOptions.2', ['value' => 'hangman', 'label' => __('Hangman'), 'available' => true])
            ->where('canCreateGameRoom', true)
            ->where('roomLimit', GameRoom::MaxRoomsPerTeam));
});

it('disables game room creation at the room limit', function () {
    $member = User::factory()->create();
    $workspace = workspaceWith($member, WorkspaceRole::Member);
    $team = Team::factory()->for($workspace)->withMember($member)->create();
    GameRoom::factory()->count(GameRoom::MaxRoomsPerTeam)->create(['team_id' => $team->id]);

    $this->actingAs($member)
        ->get(route('teams.show', [$workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('canCreateGameRoom', false)
            ->where('roomLimit', GameRoom::MaxRoomsPerTeam));
});

it('does not count icebreaker rooms of retros against the room limit', function () {
    $member = User::factory()->create();
    $workspace = workspaceWith($member, WorkspaceRole::Member);
    $team = Team::factory()->for($workspace)->withMember($member)->create();
    GameRoom::factory()->count(GameRoom::MaxRoomsPerTeam - 1)->create(['team_id' => $team->id]);
    GameRoom::factory()->icebreaker(Retro::factory()->create(['team_id' => $team->id]))->create();

    $this->actingAs($member)
        ->get(route('teams.show', [$workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->where('canCreateGameRoom', true));
});

it('gives each team member and each available member an avatar url', function () {
    $admin = User::factory()->create();
    $colleague = User::factory()->create();
    $workspace = Workspace::factory()
        ->withMember($admin, WorkspaceRole::Admin)
        ->withMember($colleague, WorkspaceRole::Member)
        ->create();
    $team = Team::factory()->for($workspace)->withMember($admin)->create();
    $avatarRoute = '/avatars/';

    $this->actingAs($admin)
        ->get(route('teams.show', [$workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->has('members', 1, fn (Assert $member) => $member
                ->where('avatarUrl', fn (string $url) => str_starts_with($url, $avatarRoute))
                ->etc())
            ->has('availableMembers', 1, fn (Assert $member) => $member
                ->where('avatarUrl', fn (string $url) => str_starts_with($url, $avatarRoute))
                ->etc()));
});

it('keeps the available members empty for a user who cannot manage members', function () {
    $member = User::factory()->create();
    $colleague = User::factory()->create();
    $workspace = Workspace::factory()
        ->withMember($member, WorkspaceRole::Member)
        ->withMember($colleague, WorkspaceRole::Member)
        ->create();
    $team = Team::factory()->for($workspace)->withMember($member)->create();

    $this->actingAs($member)
        ->get(route('teams.show', [$workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->has('availableMembers', 0));
});
