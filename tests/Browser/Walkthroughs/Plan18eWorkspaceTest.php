<?php

use App\Enums\ColumnColor;
use App\Enums\RetroPhase;
use App\Enums\TemplateCategory;
use App\Enums\WorkspaceRole;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\User;
use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Models\WorkspaceTemplate;
use App\Models\WorkspaceTemplateColumn;

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

function p18eTemplatesPath(Workspace $workspace): string
{
    return route('workspaces.templates.index', $workspace, false);
}

function p18eTemplateCard(string $name): string
{
    return '[data-slot="template-card"]:has(h3:text-is("'.$name.'"))';
}

function p18eWorkspaceTemplate(Workspace $workspace, User $author, string $name = 'Team pulse'): WorkspaceTemplate
{
    $template = WorkspaceTemplate::factory()->create([
        'workspace_id' => $workspace->id,
        'name' => $name,
        'category' => TemplateCategory::TeamMood,
        'created_by_user_id' => $author->id,
    ]);

    foreach ([['Energy', ColumnColor::Moss], ['Blockers', ColumnColor::Coral]] as $position => [$title, $color]) {
        WorkspaceTemplateColumn::factory()->create([
            'workspace_template_id' => $template->id,
            'title' => $title,
            'description' => null,
            'color' => $color,
            'position' => $position,
        ]);
    }

    return $template->fresh();
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
        ->assertSeeIn('[role="dialog"] h2', 'New team')
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
        ->assertSeeIn('[role="dialog"] h2', 'New team')
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
        ->assertPathIs('/onboarding')
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
        ->assertSeeIn(P18eLeavePanel.' [data-slot="leave-consequences"]', 'A workspace needs at least one owner.')
        ->assertDontSeeIn(P18eLeavePanel, 'stays admin')
        ->fill(P18eLeavePanel.' input[name="confirmation"]', 'Nordlys')
        ->assertDisabled('@leave-workspace-confirm')
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

it('[P18e-09-03] sends a user with no workspace to the onboarding, and lets them create one from the workspace form, under a sidebar that renders without a team', function () {
    $user = User::factory()->create(['name' => 'Mona Lindqvist', 'locale' => 'en']);

    $page = $this->signIn($user);

    $page->assertPathIs('/onboarding')
        ->navigate('/workspaces/create')
        ->assertPathIs('/workspaces/create')
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

    $page->assertSeeIn('main h1:visible', 'Members')
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

    $page->assertSeeIn('[data-slot="settings-card"][data-tone="destructive"]', 'This permanently deletes the workspace and everything in it: its teams and their sessions, boards and action items, the templates and the invitations.')
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
        ->assertPathIs('/onboarding')
        ->assertNoJavaScriptErrors();

    expect(Workspace::query()->whereKey($workspace->id)->exists())->toBeFalse()
        ->and(Team::query()->where('workspace_id', $workspace->id)->exists())->toBeFalse();
});

it('[P18e-09-07] lets a manager duplicate, edit and delete a workspace template from the menu of its card', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $camille = p18eWorkspaceUser($workspace, 'Camille Roux', WorkspaceRole::Admin);
    Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $template = p18eWorkspaceTemplate($workspace, $camille);
    $original = p18eTemplateCard('Team pulse');
    $copy = p18eTemplateCard('Copy of Team pulse');
    $renamed = p18eTemplateCard('Pulse, second take');

    $page = $this->signIn($camille, p18eTemplatesPath($workspace));

    $page->assertSeeIn('main h1:visible', 'Templates')
        ->assertSeeIn('nav[aria-label="Breadcrumb"]', 'Nordlys')
        ->assertSeeIn('[role="tablist"]', 'Retro · 1')
        ->assertSeeIn($original, 'By Camille Roux')
        ->click("{$original} [data-slot=\"template-card-menu\"]")
        ->click('[role="menuitem"]:has-text("Duplicate")')
        ->assertValue('#template-name', 'Copy of Team pulse')
        ->assertValue('[role="dialog"] [aria-label="Column 2 title"]', 'Blockers')
        ->assertNotPresent('[role="dialog"] button:has-text("Delete template")')
        ->keys('#template-name', 'Enter')
        ->assertSee('Template saved.')
        ->assertNotPresent('[role="dialog"]')
        ->assertCount('[data-slot="retro-template-cards"] [data-slot="template-card"]', 2)
        ->assertSeeIn('[role="tablist"]', 'Retro · 2')
        ->assertSeeIn($copy, 'Energy');

    $page->click("{$copy} [data-slot=\"template-card-menu\"]")
        ->click('[role="menuitem"]:has-text("Edit")')
        ->assertValue('#template-name', 'Copy of Team pulse')
        ->fill('#template-name', 'Pulse, second take')
        ->fill('[role="dialog"] [aria-label="Column 1 title"]', 'Mood')
        ->keys('#template-name', 'Enter')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($renamed, 'Mood')
        ->assertDontSeeIn($renamed, 'Energy')
        ->assertNotPresent($copy);

    $page->click("{$renamed} [data-slot=\"template-card-menu\"]")
        ->click('[role="menuitem"]:has-text("Delete")')
        ->assertSeeIn('[role="alertdialog"]', 'Delete this template?')
        ->assertSeeIn('[role="alertdialog"]', 'Retros already created from it are not affected.')
        ->click('[role="alertdialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertPresent($renamed)
        ->click("{$renamed} [data-slot=\"template-card-menu\"]")
        ->click('[role="menuitem"]:has-text("Delete")')
        ->click('[role="alertdialog"] button:has-text("Delete template")')
        ->assertNotPresent($renamed)
        ->assertNotPresent('[role="alertdialog"]')
        ->assertCount('[data-slot="retro-template-cards"] [data-slot="template-card"]', 1)
        ->assertPathIs(p18eTemplatesPath($workspace))
        ->assertNoJavaScriptErrors();

    expect($workspace->templates()->pluck('name')->all())->toBe(['Team pulse'])
        ->and($template->fresh()->columns->pluck('title')->all())->toBe(['Energy', 'Blockers']);
});

it('[P18e-09-09] offers "Use" and "Duplicate" on a built-in template, no Edit or Delete, and opens the session dialog of the team on it', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $camille = p18eWorkspaceUser($workspace, 'Camille Roux', WorkspaceRole::Admin);
    $atlas = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $atlas->members()->attach($camille);
    p18eWorkspaceTemplate($workspace, $camille);
    $picker = '[data-slot="retro-template-picker"]';
    $preview = 'section[aria-label="Template preview"]';
    $builtIn = "{$picker} [role=\"radio\"]:has-text(\"Start, Stop, Continue\")";
    $own = "{$picker} [role=\"radio\"]:has-text(\"Team pulse\")";

    $page = $this->signIn($camille, p18eTemplatesPath($workspace));

    $page->click('[role="tab"]:has-text("Retro")')
        ->assertPresent($picker)
        ->click($builtIn)
        ->assertAttribute($builtIn, 'aria-checked', 'true')
        ->assertPresent("{$preview} button:has-text(\"Use this template\")")
        ->assertPresent("{$preview} button:has-text(\"Duplicate and edit\")")
        ->assertNotPresent("{$preview} >> role=button[name=\"Edit\" s]")
        ->assertNotPresent('button:has-text("Delete template")')
        ->click("{$preview} button:has-text(\"Duplicate and edit\")")
        ->assertValue('#template-name', 'Copy of Start, Stop, Continue')
        ->assertValue('[role="dialog"] [aria-label="Column 3 title"]', 'Continue')
        ->click('[role="dialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="dialog"]');

    $page->click("{$picker} [role=\"tab\"]:has-text(\"My workspace\")")
        ->click($own)
        ->assertSeeIn($preview, 'By Camille Roux')
        ->assertPresent("{$preview} >> role=button[name=\"Edit\" s]")
        ->click("{$picker} [role=\"tab\"]:has-text(\"Built-in\")")
        ->click($builtIn)
        ->click("{$preview} button:has-text(\"Use this template\")")
        ->assertPathIs(teamPath('teams.show', $atlas))
        ->assertVisible('#new-retro-title')
        ->assertSeeIn('[role="dialog"] [role="radiogroup"][aria-label="Retrospective template"] [role="radio"][aria-checked="true"]', 'Start, Stop, Continue')
        ->assertScript('window.location.search', '')
        ->assertNoJavaScriptErrors();

    expect($workspace->templates()->count())->toBe(1);
});

it('[P18e-09-09b] opens the session dialog of the team on a workspace template from "Use" on its card', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $theo = p18eWorkspaceUser($workspace, 'Théo Martin');
    $atlas = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $atlas->members()->attach($theo);
    $template = p18eWorkspaceTemplate($workspace, $theo);
    $card = '[data-test="workspace-template-'.$template->id.'"]';

    $page = $this->signIn($theo, p18eTemplatesPath($workspace));

    $page->assertNotPresent("{$card} [data-slot=\"template-card-menu\"]")
        ->click("{$card} a:has-text(\"Use\")")
        ->assertPathIs(teamPath('teams.show', $atlas))
        ->assertVisible('#new-retro-title')
        ->assertSeeIn('[role="dialog"] [role="radiogroup"][aria-label="Retrospective template"] [role="radio"][aria-checked="true"]', 'Team pulse')
        ->assertScript('window.location.search', '')
        ->fill('#new-retro-title', 'From the templates page')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/');

    expect(Retro::query()->where('title', 'From the templates page')->sole()->workspace_template_id)->toBe($template->id);
});

it('[P18e-09-10] lists the decks of the workspace in the Poker tab, lets a manager create, edit and delete one, and opens the game form on a deck', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $camille = p18eWorkspaceUser($workspace, 'Camille Roux', WorkspaceRole::Admin);
    $theo = p18eWorkspaceUser($workspace, 'Théo Martin');
    $atlas = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $atlas->members()->attach([$camille->id, $theo->id]);
    $shared = SavedPokerDeck::factory()->forWorkspace($workspace)->create([
        'name' => 'Nordlys scale',
        'cards' => ['1', '2', '3', '?'],
        'created_by_user_id' => $camille->id,
    ]);
    SavedPokerDeck::factory()->create(['team_id' => $atlas->id, 'name' => 'Atlas only', 'created_by_user_id' => $theo->id]);
    PokerGame::factory()->create(['team_id' => $atlas->id])->forceFill(['saved_deck_id' => $shared->id])->save();
    $sharedCard = '[data-test="workspace-deck-'.$shared->id.'"]';
    $halves = p18eTemplateCard('Halves');
    $quarters = p18eTemplateCard('Quarters');

    $memberPage = $this->signIn($theo, p18eTemplatesPath($workspace));

    $memberPage->click('[role="tab"]:has-text("Poker")')
        ->assertSeeIn('[role="tablist"]', 'Poker · 1')
        ->assertCount('[data-slot="poker-deck-cards"] [data-slot="template-card"]', 1)
        ->assertSeeIn($sharedCard, 'Nordlys scale')
        ->assertSeeIn($sharedCard, '1 game')
        ->assertSeeIn($sharedCard, 'By Camille Roux')
        ->assertDontSee('Atlas only')
        ->assertNotPresent("{$sharedCard} button")
        ->assertNotPresent('button:has-text("Create a deck")')
        ->click("{$sharedCard} a:has-text(\"Use\")")
        ->assertPathIs(teamPath('teams.show', $atlas))
        ->assertVisible('#new-poker-title')
        ->assertSeeIn('[role="dialog"] [role="radiogroup"][aria-label="Deck"] [role="radio"][aria-checked="true"]', 'Nordlys scale')
        ->assertScript('window.location.search', '');

    $page = $this->signIn($camille, p18eTemplatesPath($workspace));

    $page->click('[role="tab"]:has-text("Poker")')
        ->click('button:has-text("Create a deck")')
        ->assertSeeIn('[role="dialog"]', 'Create a deck')
        ->fill('#deck-new-name', 'Halves')
        ->fill('#deck-new-cards', '1, 2, 3')
        ->click('[role="dialog"] button:has-text("Save")')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($halves, '0 games')
        ->assertSeeIn($halves, 'By Camille Roux')
        ->assertSeeIn('[role="tablist"]', 'Poker · 2');

    $created = SavedPokerDeck::query()->where('name', 'Halves')->sole();

    expect($created->workspace_id)->toBe($workspace->id)
        ->and($created->team_id)->toBeNull()
        ->and($created->cards)->toBe(['1', '2', '3', '?', '☕']);

    $page->click("{$halves} [data-slot=\"template-card-menu\"]")
        ->click('[role="menuitem"]:has-text("Edit")')
        ->assertSeeIn('[role="dialog"]', 'Edit Halves')
        ->fill("#deck-{$created->id}-name", 'Quarters')
        ->click('[role="dialog"] button:has-text("Save")')
        ->assertNotPresent('[role="dialog"]')
        ->assertPresent($quarters)
        ->assertNotPresent($halves)
        ->click("{$quarters} [data-slot=\"template-card-menu\"]")
        ->click('[role="menuitem"]:has-text("Delete")')
        ->assertSeeIn('[role="alertdialog"]', 'Delete this deck?')
        ->assertSeeIn('[role="alertdialog"]', 'Games that use it keep their cards.')
        ->click('[role="alertdialog"] button:has-text("Delete deck")')
        ->assertNotPresent($quarters)
        ->assertNotPresent('[role="alertdialog"]')
        ->assertSeeIn('[role="tablist"]', 'Poker · 1')
        ->assertNoJavaScriptErrors();

    expect(SavedPokerDeck::query()->whereKey($created->id)->exists())->toBeFalse()
        ->and(SavedPokerDeck::query()->whereKey($shared->id)->exists())->toBeTrue();
});

it('[P18e-09-11] shows the whiteboard templates with their preview, opens the board form on one, renames and deletes it after a confirmation, then the empty state', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $camille = p18eWorkspaceUser($workspace, 'Camille Roux', WorkspaceRole::Admin);
    $atlas = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $atlas->members()->attach($camille);
    $template = WhiteboardTemplate::factory()->create([
        'workspace_id' => $workspace->id,
        'name' => 'Kick-off map',
        'description' => 'Goals, risks and owners',
        'created_by_user_id' => $camille->id,
    ]);
    $card = '[data-test="workspace-whiteboard-template-'.$template->id.'"]';
    $empty = '[data-slot="whiteboard-templates-empty"]';

    $page = $this->signIn($camille, p18eTemplatesPath($workspace));

    $page->click('[role="tab"]:has-text("Whiteboard")')
        ->assertSeeIn('[role="tablist"]', 'Whiteboard · 1')
        ->assertSeeIn($card, 'Kick-off map')
        ->assertSeeIn($card, 'Goals, risks and owners')
        ->assertPresent("{$card} [data-slot=\"whiteboard-template-preview\"] svg")
        ->click("{$card} a:has-text(\"Use\")")
        ->assertPathIs(teamPath('teams.show', $atlas))
        ->assertVisible('#whiteboard-title')
        ->assertSeeIn('[role="dialog"] [data-slot="whiteboard-template-gallery"] [role="radio"][aria-checked="true"]', 'Kick-off map')
        ->assertScript('window.location.search', '');

    $page->navigate(p18eTemplatesPath($workspace))
        ->click('[role="tab"]:has-text("Whiteboard")')
        ->click("{$card} [data-slot=\"template-card-menu\"]")
        ->click('[role="menuitem"]:has-text("Rename")')
        ->assertValue('[role="dialog"] input[name="name"]', 'Kick-off map')
        ->fill('[role="dialog"] input[name="name"]', 'Project kick-off')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($card, 'Project kick-off')
        ->assertSeeIn($card, 'Goals, risks and owners');

    expect($template->fresh()->name)->toBe('Project kick-off');

    $page->click("{$card} [data-slot=\"template-card-menu\"]")
        ->click('[role="menuitem"]:has-text("Delete")')
        ->assertSeeIn('[role="alertdialog"]', 'Delete this template?')
        ->assertSeeIn('[role="alertdialog"]', 'Boards already created from it are not changed.')
        ->click('[role="alertdialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertPresent($card);

    expect(WhiteboardTemplate::query()->whereKey($template->id)->exists())->toBeTrue();

    $page->click("{$card} [data-slot=\"template-card-menu\"]")
        ->click('[role="menuitem"]:has-text("Delete")')
        ->click('[role="alertdialog"] button:has-text("Delete")')
        ->assertNotPresent($card)
        ->assertSeeIn('[role="tablist"]', 'Whiteboard · 0')
        ->assertSeeIn($empty, 'No whiteboard templates yet.')
        ->assertSeeIn($empty, 'Save any whiteboard as a template from its menu — every team of Nordlys will be able to start from it.')
        ->assertNotPresent("{$empty} button")
        ->assertNoJavaScriptErrors();

    expect(WhiteboardTemplate::query()->whereKey($template->id)->exists())->toBeFalse();
});

it('[P18e-09-12] keeps "Use" in place, disabled with its hint, for a member of no team', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $camille = p18eWorkspaceUser($workspace, 'Camille Roux', WorkspaceRole::Admin);
    $lea = p18eWorkspaceUser($workspace, 'Lea Garnier');
    Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $template = p18eWorkspaceTemplate($workspace, $camille);
    $card = '[data-test="workspace-template-'.$template->id.'"]';
    $use = "{$card} button:has-text(\"Use\")";
    $inertUse = "{$card} button[aria-disabled=\"true\"]";
    $pickerUse = 'section[aria-label="Template preview"] button:has-text("Use this template")';

    $page = $this->signIn($lea, p18eTemplatesPath($workspace));

    $page->assertSeeIn($card, 'Team pulse')
        ->assertNotPresent("{$card} a")
        ->assertAttribute($use, 'aria-disabled', 'true')
        ->assertScript("document.getElementById(document.querySelector('".addslashes($inertUse)."').getAttribute('aria-describedby')).textContent", 'Pick a team first');

    $page->script("() => { document.querySelector('".addslashes($inertUse)."').click(); return true; }");

    $page->assertPathIs(p18eTemplatesPath($workspace))
        ->assertNotPresent('[role="dialog"]')
        ->click('[role="tab"]:has-text("Retro")')
        ->assertAttribute($pickerUse, 'aria-disabled', 'true')
        ->assertSeeIn('section[aria-label="Template preview"]', 'Pick a team first')
        ->assertPathIs(p18eTemplatesPath($workspace))
        ->assertNotPresent('[role="dialog"]')
        ->assertNoJavaScriptErrors();
});
