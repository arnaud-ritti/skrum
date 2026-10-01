<?php

use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;

it('shares the avatar URL of the signed-in user and keeps the user attributes', function () {
    $workspace = Workspace::factory()->create();
    $user = workspaceManager($workspace, WorkspaceRole::Member);

    $this->actingAs($user)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('auth.user.avatarUrl', $user->avatarUrl())
            ->where('auth.user.email', $user->email)
            ->missing('auth.user.password'));
});

it('shares no user and no team for a visitor', function () {
    $this->get(route('login'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('auth.user', null)
            ->where('currentTeam', null)
            ->where('teams', []));
});

it('shares no current team when the user has none in the workspace', function () {
    $workspace = Workspace::factory()->create();
    Team::factory()->for($workspace)->create();
    $user = workspaceManager($workspace, WorkspaceRole::Member);

    $this->actingAs($user)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('currentTeam', null)
            ->where('teams', []));
});

it('shares the team of the route, with its member count', function () {
    $workspace = Workspace::factory()->create();
    $user = workspaceManager($workspace, WorkspaceRole::Member);
    $alpha = Team::factory()->for($workspace)->create(['name' => 'Alpha']);
    $beta = Team::factory()->for($workspace)->create(['name' => 'Beta']);
    $alpha->members()->attach($user);
    $beta->members()->attach($user);
    $beta->members()->attach(User::factory()->count(2)->create());

    $this->actingAs($user)
        ->get(route('teams.show', [$workspace, $beta]))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('currentTeam.id', $beta->id)
            ->where('currentTeam.name', 'Beta')
            ->where('currentTeam.membersCount', 3)
            ->has('teams', 2));
});

it('remembers the last visited team on pages without a team', function () {
    $workspace = Workspace::factory()->create();
    $user = workspaceManager($workspace, WorkspaceRole::Member);
    $alpha = Team::factory()->for($workspace)->create(['name' => 'Alpha']);
    $beta = Team::factory()->for($workspace)->create(['name' => 'Beta']);
    $alpha->members()->attach($user);
    $beta->members()->attach($user);

    $this->actingAs($user)->get(route('teams.show', [$workspace, $beta]));

    $this->actingAs($user)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('currentTeam.id', $beta->id));
});

it('falls back to the first team by name', function () {
    $workspace = Workspace::factory()->create();
    $user = workspaceManager($workspace, WorkspaceRole::Member);
    $beta = Team::factory()->for($workspace)->create(['name' => 'Beta']);
    $alpha = Team::factory()->for($workspace)->create(['name' => 'Alpha']);
    $alpha->members()->attach($user);
    $beta->members()->attach($user);

    $this->actingAs($user)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('currentTeam.id', $alpha->id));
});

it('ignores a remembered team that is no longer visible', function () {
    $workspace = Workspace::factory()->create();
    $user = workspaceManager($workspace, WorkspaceRole::Member);
    $alpha = Team::factory()->for($workspace)->create(['name' => 'Alpha']);
    $gone = Team::factory()->for($workspace)->create(['name' => 'Gone']);
    $alpha->members()->attach($user);

    $this->actingAs($user)
        ->withSession(['current_team_id' => $gone->id])
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('currentTeam.id', $alpha->id));
});

it('shows every team of the workspace to a manager who belongs to none', function () {
    $workspace = Workspace::factory()->create();
    $manager = workspaceManager($workspace);
    Team::factory()->for($workspace)->count(2)->create();

    $this->actingAs($manager)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('teams', 2)
            ->whereNot('currentTeam', null));
});

it('ignores a remembered team that belongs to another workspace', function () {
    $workspace = Workspace::factory()->create();
    $user = workspaceManager($workspace, WorkspaceRole::Member);
    $alpha = Team::factory()->for($workspace)->create(['name' => 'Alpha']);
    $alpha->members()->attach($user);
    $foreign = Team::factory()->create(['name' => 'Aardvark']);

    $this->actingAs($user)
        ->withSession(['current_team_id' => $foreign->id])
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('currentTeam.id', $alpha->id));
});

it('does not resolve a team of another workspace through the route', function () {
    $workspace = Workspace::factory()->create();
    $user = workspaceManager($workspace, WorkspaceRole::Member);
    $foreign = Team::factory()->create();

    $this->actingAs($user)
        ->get(route('teams.show', [$workspace, $foreign]))
        ->assertNotFound();
});

it('queries the visible teams once for both shared props', function () {
    $workspace = Workspace::factory()->create();
    $user = workspaceManager($workspace, WorkspaceRole::Member);
    $user->forceFill(['current_workspace_id' => $workspace->id])->save();
    $team = Team::factory()->for($workspace)->create();
    $team->members()->attach($user);

    DB::enableQueryLog();
    $this->actingAs($user)->get(route('profile.edit'));
    $teamQueries = collect(DB::getQueryLog())
        ->filter(fn (array $query) => str_starts_with($query['query'], 'select * from "teams"'))
        ->count();
    DB::disableQueryLog();

    expect($teamQueries)->toBe(1);
});
