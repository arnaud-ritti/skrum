<?php

use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;

const P18eWorkspaceSwitcher = '[data-sidebar="header"] button[data-sidebar="menu-button"]';
const P18eLeavePanel = '[role="alertdialog"][data-slot="leave-workspace-panel"]';

function p18eWorkspaceUser(Workspace $workspace, string $name, WorkspaceRole $role = WorkspaceRole::Member): User
{
    $user = User::factory()->create(['name' => $name, 'locale' => 'en']);
    $workspace->members()->attach($user, ['role' => $role->value]);

    return $user;
}

function p18eWorkspacePath(Workspace $workspace): string
{
    return route('workspaces.show', $workspace, false);
}

it('[P18e-09-08] shows the counts of the workspace, the members of a team and the workspaces of the switcher as the database holds them', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $camille = p18eWorkspaceUser($workspace, 'Camille Roux', WorkspaceRole::Admin);
    $atlas = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $borealis = Team::factory()->for($workspace)->create(['name' => 'Borealis']);
    $atlas->members()->attach($camille);

    foreach (['Arnaud Ritti', 'Théo Martin', 'Inès Benali'] as $name) {
        $atlas->members()->attach(p18eWorkspaceUser($workspace, $name));
    }

    foreach (['Malik Kone', 'Sofia Lindqvist'] as $name) {
        $borealis->members()->attach(p18eWorkspaceUser($workspace, $name));
    }

    Retro::factory()->for($atlas)->inPhase(RetroPhase::Writing)->create(['title' => 'Sprint 42']);

    $kestrel = Workspace::factory()->create(['name' => 'Kestrel Labs']);
    $kestrel->members()->attach($camille, ['role' => WorkspaceRole::Member->value]);
    Team::factory()->for($kestrel)->create(['name' => 'Joined'])->members()->attach($camille);
    Team::factory()->for($kestrel)->create(['name' => 'Not joined']);

    $atlasTile = 'a[data-slot="team-tile"][href$="/teams/'.$atlas->id.'"]';
    $borealisTile = 'a[data-slot="team-tile"][href$="/teams/'.$borealis->id.'"]';

    $page = $this->signIn($camille, p18eWorkspacePath($workspace));

    $page->assertSeeIn('[data-slot="workspace-header"] h1', 'Nordlys')
        ->assertSeeIn('[data-slot="workspace-subline"]', "2 teams · 6 members · you're an admin")
        ->assertSeeIn('nav[aria-label="Breadcrumb"]', 'Workspace')
        ->assertCount('a[data-slot="team-tile"]', 2)
        ->assertSeeIn("{$atlasTile} [data-slot=\"team-members\"]", '4 members')
        ->assertCount("{$atlasTile} [data-slot=\"person-avatar\"]", 3)
        ->assertSeeIn("{$atlasTile} [data-slot=\"avatar-stack-more\"]", '+1')
        ->assertSeeIn("{$atlasTile} [data-slot=\"team-retro\"]", 'Retro in progress · Sprint 42')
        ->assertSeeIn("{$atlasTile} [data-slot=\"team-poker\"]", 'No active game')
        ->assertSeeIn("{$atlasTile} [data-slot=\"team-actions\"]", 'No open action items')
        ->assertSeeIn("{$borealisTile} [data-slot=\"team-members\"]", '2 members')
        ->assertNotPresent("{$borealisTile} [data-slot=\"avatar-stack-more\"]")
        ->assertSeeIn("{$borealisTile} [data-slot=\"team-retro\"]", 'No retro yet')
        ->assertNoJavaScriptErrors();

    $page->click(P18eWorkspaceSwitcher)
        ->assertSeeIn('[role="menuitem"][aria-current="true"]', 'Nordlys')
        ->assertSeeIn('[role="menuitem"][aria-current="true"] [data-slot="workspace-details"]', '2 teams · Admin')
        ->assertSeeIn('[role="menuitem"]:has-text("Kestrel Labs") [data-slot="workspace-details"]', '1 team · Member')
        ->assertNoJavaScriptErrors();
});

it('[P18e-09-01] lets a manager create a team from the dialog and reach the members page through "Invite people"', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $camille = p18eWorkspaceUser($workspace, 'Camille Roux', WorkspaceRole::Admin);

    $page = $this->signIn($camille, p18eWorkspacePath($workspace));

    $page->assertSeeIn('[data-slot="workspace-teams-empty"]', 'No teams yet. Create the first one.')
        ->click('[data-slot="workspace-header"] button:has-text("New team")')
        ->assertSeeIn('[role="dialog"]', 'New team')
        ->fill('[role="dialog"] input[name="name"]', 'Comet')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertSeeIn('[data-slot="team-header"] h1', 'Comet');

    $team = $workspace->teams()->sole();

    expect($team->name)->toBe('Comet');

    $page->assertPathIs(route('teams.show', [$workspace, $team], false))
        ->navigate(p18eWorkspacePath($workspace))
        ->assertCount('a[data-slot="team-tile"]', 1)
        ->assertSeeIn('a[data-slot="team-tile"][href$="/teams/'.$team->id.'"]', 'Comet')
        ->assertNotPresent('[data-slot="workspace-teams-empty"]')
        ->click('[data-slot="new-team-tile"]')
        ->assertSeeIn('[role="dialog"]', 'New team')
        ->click('[role="dialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="dialog"]')
        ->click('[data-slot="workspace-header"] a:has-text("Invite people")')
        ->assertPathIs(route('workspaces.members.index', $workspace, false))
        ->assertNoJavaScriptErrors();
});

it('[P18e-09-01b] offers a plain member neither a new team nor the invitations', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $theo = p18eWorkspaceUser($workspace, 'Théo Martin');
    $atlas = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    Team::factory()->for($workspace)->create(['name' => 'Hidden']);
    $atlas->members()->attach($theo);

    $page = $this->signIn($theo, p18eWorkspacePath($workspace));

    $page->assertSeeIn('[data-slot="workspace-subline"]', "1 team · 1 member · you're a member")
        ->assertCount('a[data-slot="team-tile"]', 1)
        ->assertNotPresent('[data-slot="new-team-tile"]')
        ->assertNotPresent('[data-slot="workspace-header"] button')
        ->assertNotPresent('[data-slot="workspace-header"] a')
        ->assertSee('View templates')
        ->assertNoJavaScriptErrors();
});

it('[P18e-09-02] asks for the name of the workspace before a member leaves it', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    p18eWorkspaceUser($workspace, 'Camille Roux', WorkspaceRole::Owner);
    $theo = p18eWorkspaceUser($workspace, 'Théo Martin');
    $atlas = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $atlas->members()->attach($theo);

    $page = $this->signIn($theo, p18eWorkspacePath($workspace));

    $page->assertNotPresent(P18eLeavePanel)
        ->click('[data-slot="workspace-leave"] button:has-text("Leave workspace")')
        ->assertSeeIn(P18eLeavePanel, 'Leave Nordlys?')
        ->assertSeeIn(P18eLeavePanel, 'You leave Atlas.')
        ->assertSeeIn(P18eLeavePanel, 'An admin can invite you again later.')
        ->assertDontSeeIn(P18eLeavePanel, 'admins')
        ->assertDisabled('@leave-workspace-confirm')
        ->fill(P18eLeavePanel.' input[name="confirmation"]', 'Nordly')
        ->assertDisabled('@leave-workspace-confirm')
        ->click(P18eLeavePanel.' button:has-text("Cancel")')
        ->assertNotPresent(P18eLeavePanel);

    expect($theo->fresh()->belongsToWorkspace($workspace))->toBeTrue();

    $page->click('[data-slot="workspace-leave"] button:has-text("Leave workspace")')
        ->assertValue(P18eLeavePanel.' input[name="confirmation"]', '')
        ->fill(P18eLeavePanel.' input[name="confirmation"]', 'Nordlys')
        ->assertEnabled('@leave-workspace-confirm')
        ->click('@leave-workspace-confirm')
        ->assertPathIs('/workspaces/create')
        ->assertNoJavaScriptErrors();

    expect($theo->fresh()->belongsToWorkspace($workspace))->toBeFalse()
        ->and($atlas->hasMember($theo))->toBeFalse();
});

it('[P18e-09-02b] tells the last owner that a workspace needs at least one owner, and keeps them in', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $camille = p18eWorkspaceUser($workspace, 'Camille Roux', WorkspaceRole::Owner);
    p18eWorkspaceUser($workspace, 'Arnaud Ritti', WorkspaceRole::Admin);

    $page = $this->signIn($camille, p18eWorkspacePath($workspace));

    $page->click('[data-slot="workspace-leave"] button:has-text("Leave workspace")')
        ->assertSeeIn(P18eLeavePanel, "You're one of 2 admins — Arnaud Ritti stays admin.")
        ->fill(P18eLeavePanel.' input[name="confirmation"]', 'Nordlys')
        ->click('@leave-workspace-confirm')
        ->assertSeeIn(P18eLeavePanel.' [role="alert"]', 'A workspace needs at least one owner.')
        ->assertPathIs(p18eWorkspacePath($workspace))
        ->assertNoJavaScriptErrors();

    expect($camille->fresh()->belongsToWorkspace($workspace))->toBeTrue();
});

it('[P18e-09-02c] asks the same question in a dialog on a phone', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    p18eWorkspaceUser($workspace, 'Camille Roux', WorkspaceRole::Owner);
    $theo = p18eWorkspaceUser($workspace, 'Théo Martin');

    $page = $this->signIn($theo, p18eWorkspacePath($workspace));

    $page->resize(390, 844)
        ->click('[data-slot="workspace-leave"] button:has-text("Leave workspace")')
        ->assertNotPresent(P18eLeavePanel)
        ->assertSeeIn('[role="dialog"]', 'Leave Nordlys?')
        ->assertDisabled('@leave-workspace-confirm')
        ->fill('[role="dialog"] input[name="confirmation"]', 'Nordlys')
        ->assertEnabled('@leave-workspace-confirm')
        ->click('[role="dialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="dialog"]')
        ->assertNoJavaScriptErrors();

    expect($theo->fresh()->belongsToWorkspace($workspace))->toBeTrue();
});

it('[P18e-09-03] lets a user with no workspace create one, under a sidebar that renders without a team', function () {
    $user = User::factory()->create(['name' => 'Mona Lindqvist', 'locale' => 'en']);

    $page = $this->signIn($user);

    $page->assertPathIs('/workspaces/create')
        ->assertSeeIn('[data-slot="create-workspace"] h1', 'Name your workspace')
        ->assertSeeIn('[data-slot="create-workspace"]', 'The workspace groups your teams, templates and members.')
        ->assertSeeIn(P18eWorkspaceSwitcher, 'Select a workspace')
        ->assertNotPresent('[data-sidebar="content"] a[data-sidebar="menu-button"]')
        ->assertCount('[data-slot="create-workspace"] input', 1)
        ->click('Create workspace')
        ->assertPathIs('/workspaces/create');

    expect($user->workspaces()->count())->toBe(0);

    $page->click(P18eWorkspaceSwitcher)
        ->assertSeeIn('[role="menu"]', 'New workspace')
        ->keys('[role="menu"]', 'Escape')
        ->fill('#name', 'Acme')
        ->click('Create workspace')
        ->assertSeeIn('[data-slot="workspace-header"] h1', 'Acme');

    $workspace = $user->workspaces()->sole();

    $page->assertPathIs(p18eWorkspacePath($workspace))
        ->assertSeeIn('[data-slot="workspace-subline"]', "0 teams · 1 member · you're the owner")
        ->assertSeeIn('[data-slot="workspace-teams-empty"]', 'No teams yet. Create the first one.')
        ->assertSeeIn('[data-sidebar="content"] a[data-sidebar="menu-button"][aria-current="page"]', 'All teams')
        ->assertSeeIn(P18eWorkspaceSwitcher, 'Acme')
        ->assertNoJavaScriptErrors();
});
