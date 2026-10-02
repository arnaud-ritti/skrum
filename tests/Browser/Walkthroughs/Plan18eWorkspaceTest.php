<?php

use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;

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

function p18eMembersPath(Workspace $workspace): string
{
    return route('workspaces.members.index', $workspace, false);
}

function p18eMemberRow(User $member): string
{
    return '[data-slot="member-row"][data-member-id="'.$member->id.'"]';
}

function p18eInvitationRow(string $email): string
{
    return '[data-slot="invitation-row"][data-invitation-email="'.$email.'"]';
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

it('[P18e-09-04] lets an owner change a role and remove a member after a confirmation, and keeps the last owner', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $arnaud = p18eWorkspaceUser($workspace, 'Arnaud Ritti', WorkspaceRole::Owner);
    $camille = p18eWorkspaceUser($workspace, 'Camille Roux', WorkspaceRole::Admin);
    $theo = p18eWorkspaceUser($workspace, 'Théo Martin');
    $atlas = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $atlas->members()->attach($theo);

    $page = $this->signIn($arnaud, p18eMembersPath($workspace));

    $page->assertSeeIn('h1', 'Members')
        ->assertSeeIn('nav[aria-label="Breadcrumb"]', 'Nordlys')
        ->assertSeeIn('[data-slot="members-summary"]', '3 members')
        ->assertCount('[data-slot="member-row"]', 3)
        ->assertSeeIn(p18eMemberRow($arnaud), 'Arnaud Ritti (you)')
        ->assertSeeIn(p18eMemberRow($camille), $camille->email)
        ->assertCount('[data-slot="member-row"] [role="combobox"]', 3)
        ->click(p18eMemberRow($theo).' [role="combobox"]')
        ->click('[role="option"]:has-text("Admin")')
        ->assertSeeIn(p18eMemberRow($theo).' [role="combobox"]', 'Admin')
        ->assertNotPresent('[data-slot="member-role-error"]');

    expect($theo->fresh()->roleIn($workspace))->toBe(WorkspaceRole::Admin);

    $page->click(p18eMemberRow($arnaud).' [role="combobox"]')
        ->click('[role="option"]:has-text("Member")')
        ->assertSeeIn(p18eMemberRow($arnaud).' [data-slot="member-role-error"]', 'A workspace needs at least one owner.')
        ->assertSeeIn(p18eMemberRow($arnaud).' [role="combobox"]', 'Owner');

    expect($arnaud->fresh()->roleIn($workspace))->toBe(WorkspaceRole::Owner);

    $page->click(p18eMemberRow($theo).' [data-member-menu]')
        ->click('[role="menuitem"]:has-text("Remove from workspace")')
        ->assertSeeIn('[role="alertdialog"]', 'Remove Théo Martin from this workspace?')
        ->assertSeeIn('[role="alertdialog"]', 'They will lose access to the workspace and be removed from all of its teams.')
        ->click('[role="alertdialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertPresent(p18eMemberRow($theo));

    expect($theo->fresh()->belongsToWorkspace($workspace))->toBeTrue();

    $page->click(p18eMemberRow($theo).' [data-member-menu]')
        ->click('[role="menuitem"]:has-text("Remove from workspace")')
        ->click('[role="alertdialog"] button:has-text("Remove from workspace")')
        ->assertNotPresent(p18eMemberRow($theo))
        ->assertNotPresent('[role="alertdialog"]')
        ->assertSeeIn('[data-slot="members-summary"]', '2 members')
        ->assertPathIs(p18eMembersPath($workspace))
        ->assertNoJavaScriptErrors();

    expect($theo->fresh()->belongsToWorkspace($workspace))->toBeFalse()
        ->and($atlas->hasMember($theo))->toBeFalse();
});

it('[P18e-09-04b] shows an admin the owner without a role select, a menu or the deletion of the workspace', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $arnaud = p18eWorkspaceUser($workspace, 'Arnaud Ritti', WorkspaceRole::Owner);
    $camille = p18eWorkspaceUser($workspace, 'Camille Roux', WorkspaceRole::Admin);
    $theo = p18eWorkspaceUser($workspace, 'Théo Martin');

    $page = $this->signIn($camille, p18eMembersPath($workspace));

    $page->assertSeeIn(p18eMemberRow($arnaud), 'Owner')
        ->assertNotPresent(p18eMemberRow($arnaud).' [role="combobox"]')
        ->assertNotPresent(p18eMemberRow($arnaud).' button')
        ->assertPresent(p18eMemberRow($camille).' [role="combobox"]')
        ->assertPresent(p18eMemberRow($theo).' [data-member-menu]')
        ->click(p18eMemberRow($theo).' [role="combobox"]')
        ->assertCount('[role="option"]', 2)
        ->assertNotPresent('[role="option"]:has-text("Owner")')
        ->keys('[role="listbox"]', 'Escape')
        ->assertNotPresent('@delete-workspace-button')
        ->click(p18eMemberRow($camille).' [data-member-menu]')
        ->assertNotPresent('[role="menuitem"]:has-text("Remove from workspace")')
        ->click('[role="menuitem"]:has-text("Leave")')
        ->assertSeeIn('[role="dialog"]', 'Leave Nordlys?')
        ->assertSeeIn('[role="dialog"]', "You're one of 2 admins — Arnaud Ritti stays admin.")
        ->assertDisabled('@leave-workspace-confirm')
        ->click('[role="dialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="dialog"]')
        ->assertNoJavaScriptErrors();

    expect($camille->fresh()->belongsToWorkspace($workspace))->toBeTrue();
});

it('[P18e-09-05] invites someone, shows the link when no mail leaves the instance, sends it again and revokes it after a confirmation', function () {
    config(['mail.default' => 'log']);

    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $camille = p18eWorkspaceUser($workspace, 'Camille Roux', WorkspaceRole::Admin);
    WorkspaceInvitation::factory()->for($workspace)->expired()->create(['email' => 'late@example.com']);

    $lucas = p18eInvitationRow('lucas@example.com');

    $page = $this->signIn($camille, p18eMembersPath($workspace));

    $page->assertSeeIn('[data-slot="members-summary"]', '1 member')
        ->assertDontSeeIn('[data-slot="members-summary"]', 'pending')
        ->assertSeeIn(p18eInvitationRow('late@example.com'), 'Expired')
        ->assertDontSeeIn(p18eInvitationRow('late@example.com'), 'Invitation pending')
        ->assertNotPresent('[data-slot="invitation-link"]')
        ->click('[data-slot="members-header"] button:has-text("Invite")')
        ->assertSeeIn('[role="dialog"]', 'Invite people')
        ->fill('[role="dialog"] input[name="email"]', 'lucas@example.com')
        ->click('@send-invitation')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($lucas, 'Invitation pending')
        ->assertSeeIn($lucas.' [data-slot="invitation-details"]', 'Member · Invited on')
        ->assertSeeIn('[data-slot="members-summary"]', '1 member · 1 pending invitation')
        ->assertSeeIn('[data-slot="invitation-link"]', 'Email is not configured on this instance. Share this link with the invited person:')
        ->assertPresent('[data-slot="invitation-link"] input[readonly]')
        ->assertSeeIn('[data-slot="invitation-link"]', 'Copy link');

    $first = $workspace->invitations()->where('email', 'lucas@example.com')->sole();

    expect($first->role)->toBe(WorkspaceRole::Member);

    $page->click($lucas.' button:has-text("Resend")')
        ->assertNotPresent('[data-invitation-id="'.$first->id.'"]')
        ->assertSeeIn($lucas, 'Invitation pending')
        ->assertPresent('[data-slot="invitation-link"] input[readonly]');

    $second = $workspace->invitations()->where('email', 'lucas@example.com')->sole();

    expect($second->id)->not->toBe($first->id)
        ->and($second->token_hash)->not->toBe($first->token_hash);

    $page->click($lucas.' button:has-text("Revoke")')
        ->assertSeeIn('[role="alertdialog"]', 'Revoke the invitation of lucas@example.com?')
        ->click('[role="alertdialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertPresent($lucas);

    expect($workspace->invitations()->whereKey($second->id)->exists())->toBeTrue();

    $page->click($lucas.' button:has-text("Revoke")')
        ->click('[role="alertdialog"] button:has-text("Revoke")')
        ->assertNotPresent($lucas)
        ->assertPresent(p18eInvitationRow('late@example.com'))
        ->assertNoJavaScriptErrors();

    expect($workspace->invitations()->where('email', 'lucas@example.com')->exists())->toBeFalse()
        ->and($workspace->invitations()->count())->toBe(1);
});

it('[P18e-09-05b] refuses to invite someone who is already a member, in the dialog', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $camille = p18eWorkspaceUser($workspace, 'Camille Roux', WorkspaceRole::Admin);
    $theo = p18eWorkspaceUser($workspace, 'Théo Martin');

    $page = $this->signIn($camille, p18eMembersPath($workspace));

    $page->click('[data-slot="members-header"] button:has-text("Invite")')
        ->fill('[role="dialog"] input[name="email"]', $theo->email)
        ->click('@send-invitation')
        ->assertSeeIn('[role="dialog"] [role="alert"]', 'This person is already a member of the workspace.')
        ->assertNotPresent('[data-slot="invitation-row"]')
        ->assertNoJavaScriptErrors();

    expect($workspace->invitations()->count())->toBe(0);
});

it('[P18e-09-06] lets the owner delete the workspace once its name is typed', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $arnaud = p18eWorkspaceUser($workspace, 'Arnaud Ritti', WorkspaceRole::Owner);
    Team::factory()->for($workspace)->create(['name' => 'Atlas']);

    $page = $this->signIn($arnaud, p18eMembersPath($workspace));

    $page->assertSeeIn('[data-slot="settings-card"][data-tone="destructive"]', 'This permanently deletes the workspace, its teams and their retrospectives.')
        ->click('@delete-workspace-button')
        ->assertSeeIn('[role="dialog"]', 'Delete this workspace?')
        ->assertDisabled('@delete-workspace-confirm')
        ->fill('[role="dialog"] input[name="confirmation"]', 'nordlys')
        ->assertDisabled('@delete-workspace-confirm')
        ->click('[role="dialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="dialog"]');

    expect(Workspace::query()->whereKey($workspace->id)->exists())->toBeTrue();

    $page->click('@delete-workspace-button')
        ->assertValue('[role="dialog"] input[name="confirmation"]', '')
        ->fill('[role="dialog"] input[name="confirmation"]', 'Nordlys')
        ->assertEnabled('@delete-workspace-confirm')
        ->click('@delete-workspace-confirm')
        ->assertPathIs('/workspaces/create')
        ->assertNoJavaScriptErrors();

    expect(Workspace::query()->whereKey($workspace->id)->exists())->toBeFalse()
        ->and(Team::query()->where('workspace_id', $workspace->id)->exists())->toBeFalse();
});
