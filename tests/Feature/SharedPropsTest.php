<?php

use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Inertia\Testing\AssertableInertia;
use Tests\Support\SqlProbe;

it('shares the avatar URL of the signed-in user and keeps the user attributes', function () {
    $workspace = Workspace::factory()->create();
    $user = workspaceManager($workspace, WorkspaceRole::Member);

    $this->actingAs($user)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('auth.user.avatarUrl', $user->avatarUrl())
            ->where('auth.user.email', $user->email)
            ->missing('auth.user.password')
            ->missing('auth.user.email_key'));
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

    $teamReads = SqlProbe::readsFrom('teams', fn () => $this->actingAs($user)->get(route('settings.edit')));

    expect($teamReads)->toHaveCount(1);
});

it('shares the role of the user and the visible team count of each workspace', function () {
    $user = User::factory()->create();
    $managed = Workspace::factory()->create(['name' => 'Managed']);
    $managed->members()->attach($user, ['role' => WorkspaceRole::Admin->value]);
    Team::factory()->count(2)->for($managed)->create();
    $joined = Workspace::factory()->create(['name' => 'Joined']);
    $joined->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $visibleTeam = Team::factory()->for($joined)->create();
    Team::factory()->for($joined)->create();
    $visibleTeam->members()->attach($user);

    $this->actingAs($user)
        ->get(route('workspaces.show', $managed))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('workspaces.0.name', 'Joined')
            ->where('workspaces.0.role', 'member')
            ->where('workspaces.0.teamsCount', 1)
            ->where('workspaces.1.name', 'Managed')
            ->where('workspaces.1.role', 'admin')
            ->where('workspaces.1.teamsCount', 2));
});

it('adds a constant number of queries to the shared workspaces whatever their number', function () {
    $user = User::factory()->create();
    $countQueries = fn (): int => count(SqlProbe::statementsOn(
        'workspace_user',
        fn () => $this->actingAs($user)->get(route('workspaces.create'))->assertOk(),
    ));
    $first = Workspace::factory()->create();
    $first->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $withOne = $countQueries();

    foreach (Workspace::factory()->count(4)->create() as $workspace) {
        $workspace->members()->attach($user, ['role' => WorkspaceRole::Admin->value]);
        Team::factory()->for($workspace)->create();
    }

    expect($countQueries())->toBe($withOne);
});

it('shares no workspaces for a guest', function () {
    $this->get(route('login'))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('workspaces', []));
});
