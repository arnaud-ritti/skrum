<?php

use App\Enums\RetroPhase;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Workspace;

const CvtForbidden = '[data-slot="error-page"][data-status="403"]';

const CvtNotFound = '[data-slot="error-page"][data-status="404"]';

/**
 * Nordlys and its team Atlas: Camille the team owner, Théo a facilitator, Malik a member, Noa an observer,
 * Arnaud an admin of the workspace outside the team, Nadia a member of the workspace outside the team,
 * and Olga, who belongs to another workspace, Kestrel.
 *
 * @return array{
 *     workspace: Workspace,
 *     team: Team,
 *     owner: User,
 *     facilitator: User,
 *     member: User,
 *     observer: User,
 *     admin: User,
 *     outsider: User,
 *     stranger: User,
 *     kestrel: Workspace
 * }
 */
function cvtAtlas(): array
{
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas', 'sprint_length_weeks' => 2]);
    $people = [];

    foreach ([
        'owner' => ['Camille Roux', TeamRole::Owner],
        'facilitator' => ['Théo Martin', TeamRole::Facilitator],
        'member' => ['Malik Kone', TeamRole::Member],
        'observer' => ['Noa Kim', TeamRole::Observer],
    ] as $key => [$name, $role]) {
        $user = teamMember($team, $role);
        $user->update(['name' => $name, 'locale' => 'en']);
        $people[$key] = $user;
    }

    $admin = workspaceManager($workspace);
    $admin->update(['name' => 'Arnaud Ritti', 'locale' => 'en']);

    $outsider = teamMember(Team::factory()->for($workspace)->create(['name' => 'Borealis']));
    $outsider->update(['name' => 'Nadia Haddad', 'locale' => 'en']);

    $kestrel = Workspace::factory()->create(['name' => 'Kestrel']);
    $stranger = teamMember(Team::factory()->for($kestrel)->create(['name' => 'Falcon']));
    $stranger->update(['name' => 'Olga Outsider', 'locale' => 'en']);

    return [
        'workspace' => $workspace,
        'team' => $team,
        ...$people,
        'admin' => $admin,
        'outsider' => $outsider,
        'stranger' => $stranger,
        'kestrel' => $kestrel,
    ];
}

function cvtTeamPath(Team $team, string $name = 'teams.show'): string
{
    return route($name, [$team->workspace, $team], false);
}

it('sends a visitor of the dashboard to the log in page and a member to their team page', function () {
    ['team' => $team, 'member' => $member] = cvtAtlas();
    $member->forceFill(['current_workspace_id' => $team->workspace_id])->save();

    visit('/dashboard')->assertPathIs('/login');

    $this->signIn($member, '/dashboard')
        ->assertPathIs(cvtTeamPath($team))
        ->assertSeeIn('[data-slot="team-header"] h1', 'Atlas')
        ->assertNoJavaScriptErrors();
});

it('shows the team page to an observer and a workspace admin outside the team, refuses another team with the team block and another workspace with a plain 403, and sends a visitor to the login', function () {
    ['team' => $team, 'observer' => $observer, 'admin' => $admin, 'outsider' => $outsider, 'stranger' => $stranger] = cvtAtlas();
    $path = cvtTeamPath($team);

    foreach ([$observer, $admin] as $viewer) {
        $this->signIn($viewer, $path)
            ->assertSeeIn('[data-slot="team-header"] h1', 'Atlas')
            ->assertPresent('[data-slot="team-page"]');
    }

    $this->signIn($outsider, $path)
        ->assertPresent(CvtForbidden.' [data-slot="access-request"]')
        ->assertNotPresent('[data-slot="team-page"]');

    $this->signIn($stranger, $path)
        ->assertPresent(CvtForbidden)
        ->assertNotPresent('[data-slot="access-request"]')
        ->assertDontSee('Atlas');

    visit($path)->assertPathIs('/login');
});

it('answers 404 to a team opened under the address of another workspace of the viewer', function () {
    ['team' => $team, 'member' => $member] = cvtAtlas();
    $kestrel = Workspace::factory()->create(['name' => 'Kestrel']);
    $kestrel->members()->attach($member, ['role' => WorkspaceRole::Member->value]);

    $this->signIn($member, route('teams.show', [$kestrel, $team], false))
        ->assertPresent(CvtNotFound)
        ->assertNotPresent('[data-slot="team-page"]');
});

it('opens the General tab to a team owner and a workspace admin, refuses it to a facilitator and an observer, and sends a visitor to the login', function () {
    ['team' => $team, 'owner' => $owner, 'admin' => $admin, 'facilitator' => $facilitator, 'observer' => $observer] = cvtAtlas();
    $path = cvtTeamPath($team, 'teams.settings.show');

    foreach ([$owner, $admin] as $viewer) {
        $this->signIn($viewer, $path)
            ->assertPresent('[data-slot="team-settings-shell"]')
            ->assertValue('#team-name', 'Atlas');
    }

    foreach ([$facilitator, $observer] as $viewer) {
        $this->signIn($viewer, $path)
            ->assertPresent(CvtForbidden)
            ->assertNotPresent('[data-slot="team-settings-shell"]');
    }

    visit($path)->assertPathIs('/login');
});

it('leads a facilitator from the Settings entry of the sidebar to Sprints, with the three sections they are shown', function () {
    ['team' => $team, 'facilitator' => $facilitator] = cvtAtlas();
    $sections = 'nav[aria-label="Team settings"] a';

    $page = $this->signIn($facilitator, cvtTeamPath($team));

    $page->click('[data-sidebar="content"] a[data-sidebar="menu-button"][aria-label="Settings"]')
        ->assertPathIs(cvtTeamPath($team, 'teams.sprints.index'))
        ->assertCount($sections, 3)
        ->assertSeeIn("{$sections}[aria-current=\"page\"]", 'Sprints')
        ->assertPresent('#sprints')
        ->assertNotPresent('#facilitators')
        ->click("{$sections}:has-text(\"Retrospectives\")")
        ->assertPathIs(cvtTeamPath($team, 'teams.retroSettings.show'))
        ->assertPresent('#facilitators')
        ->assertPresent('#retro-templates')
        ->assertNotPresent('#sprints')
        ->click("{$sections}:has-text(\"Health check\")")
        ->assertPathIs(cvtTeamPath($team, 'teams.healthStatements.index'))
        ->assertPresent('[data-slot="health-statements"]')
        ->assertNotPresent('[aria-label="Statement"]')
        ->assertNotPresent('#facilitators')
        ->assertNoJavaScriptErrors();
});

it('refuses Sprints to an observer and to another team, and sends a visitor to the login', function () {
    ['team' => $team, 'observer' => $observer, 'outsider' => $outsider] = cvtAtlas();
    $path = cvtTeamPath($team, 'teams.sprints.index');

    foreach ([$observer, $outsider] as $viewer) {
        $this->signIn($viewer, $path)
            ->assertPresent(CvtForbidden)
            ->assertNotPresent('#sprints');
    }

    visit($path)->assertPathIs('/login');
});

it('lets a team owner who is not a workspace manager remove a member after a confirmation', function () {
    ['team' => $team, 'owner' => $owner, 'member' => $member] = cvtAtlas();
    $row = "[data-test=\"team-members\"] tr:has-text(\"{$member->email}\")";

    $this->signIn($owner, cvtTeamPath($team, 'teams.members.index'))
        ->click("{$row} [aria-label=\"Member actions\"]")
        ->click('[role="menuitem"]:has-text("Remove from team")')
        ->assertSeeIn('[role="alertdialog"]', 'Remove Malik Kone from Atlas?')
        ->click('[role="alertdialog"] button:has-text("Remove from team")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertNotPresent($row)
        ->assertNoJavaScriptErrors();

    expect($team->members()->whereKey($member->id)->exists())->toBeFalse();
});

it('opens Data & export to a team owner with the closed poll and the estimates link, refuses it to a facilitator and a member, and sends a visitor to the login', function () {
    ['team' => $team, 'owner' => $owner, 'facilitator' => $facilitator, 'member' => $member] = cvtAtlas();
    TeamSurvey::factory()->for($team)->closed()->withoutThreshold()->create(['title' => 'September pulse', 'created_by_user_id' => $owner->id]);
    $path = cvtTeamPath($team, 'teams.data.show');

    $this->signIn($owner, $path)
        ->assertPresent('[data-slot="team-settings-shell"]')
        ->assertPresent('[data-test="survey-export"]:has-text("September pulse")')
        ->click('a:has-text("Estimation history")')
        ->assertPathIs(cvtTeamPath($team, 'teams.estimates.index'));

    foreach ([$facilitator, $member] as $viewer) {
        $this->signIn($viewer, $path)
            ->assertPresent(CvtForbidden)
            ->assertDontSee('September pulse');
    }

    visit($path)->assertPathIs('/login');
});

it('lists the games of the team to a member and an observer, refuses them to another team, and sends a visitor to the login', function () {
    ['team' => $team, 'member' => $member, 'observer' => $observer, 'outsider' => $outsider] = cvtAtlas();
    $path = cvtTeamPath($team, 'teams.games.index');

    foreach ([$member, $observer] as $viewer) {
        $this->signIn($viewer, $path)->assertPresent('[data-slot="team-games"]');
    }

    $this->signIn($outsider, $path)
        ->assertPresent(CvtForbidden.' [data-slot="access-request"]')
        ->assertNotPresent('[data-slot="team-games"]');

    visit($path)->assertPathIs('/login');
});

it('shows the workspace page to a member with their own teams only, refuses it to someone of another workspace, and sends a visitor to the login', function () {
    ['workspace' => $workspace, 'outsider' => $outsider, 'stranger' => $stranger] = cvtAtlas();
    $path = route('workspaces.show', $workspace, false);

    $this->signIn($outsider, $path)
        ->assertSeeIn('[data-slot="workspace-header"] h1', 'Nordlys')
        ->assertSeeIn('[data-slot="workspace-teams"]', 'Borealis')
        ->assertDontSeeIn('[data-slot="workspace-teams"]', 'Atlas');

    $this->signIn($stranger, $path)
        ->assertPresent(CvtForbidden)
        ->assertNotPresent('[data-slot="workspace-overview"]')
        ->assertDontSee('Nordlys');

    visit($path)->assertPathIs('/login');
});

it('opens the workspace members page to an admin, refuses it to a team owner who is a plain member of the workspace, and sends a visitor to the login', function () {
    ['workspace' => $workspace, 'admin' => $admin, 'owner' => $owner] = cvtAtlas();
    $path = route('workspaces.members.index', $workspace, false);

    $this->signIn($admin, $path)
        ->assertPresent('[data-slot="workspace-members-page"]')
        ->assertSee('Camille Roux');

    $this->signIn($owner, $path)
        ->assertPresent(CvtForbidden)
        ->assertNotPresent('[data-slot="workspace-members-page"]');

    visit($path)->assertPathIs('/login');
});

it('opens the templates page to an observer, refuses it to someone of another workspace, and sends a visitor to the login', function () {
    ['workspace' => $workspace, 'observer' => $observer, 'stranger' => $stranger] = cvtAtlas();
    $path = route('workspaces.templates.index', $workspace, false);

    $this->signIn($observer, $path)->assertPresent('[data-slot="workspace-templates-page"]');

    $this->signIn($stranger, $path)
        ->assertPresent(CvtForbidden)
        ->assertNotPresent('[data-slot="workspace-templates-page"]');

    visit($path)->assertPathIs('/login');
});

it('opens the workspace form to a member who already has a workspace, and sends a visitor to the login', function () {
    ['member' => $member] = cvtAtlas();

    $this->signIn($member, '/workspaces/create')
        ->assertPresent('[data-slot="create-workspace"]')
        ->assertNoJavaScriptErrors();

    visit('/workspaces/create')->assertPathIs('/login');
});

it('opens the command palette with the keyboard, lists the recent session, starts a retro from it and goes to a page of the sidebar', function () {
    ['team' => $team, 'member' => $member] = cvtAtlas();
    $member->forceFill(['current_workspace_id' => $team->workspace_id])->save();
    $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Writing)->create(['title' => 'Sprint 42 retro']);
    $item = fn (string $label): string => "[data-slot=\"command-item\"]:has-text(\"{$label}\")";

    $page = $this->signIn($member, cvtTeamPath($team));

    $page->keys('[data-slot="team-header"] h1', 'ControlOrMeta+k')
        ->assertPresent('[data-slot="command-input"]')
        ->assertNotPresent('[data-slot="command-loading"]')
        ->assertPresent($item('Sprint 42 retro'))
        ->click($item('New retrospective'))
        ->assertPresent('[role="dialog"] [role="radiogroup"][aria-label="Session type"]')
        ->assertScript('new URLSearchParams(location.search).has("new")', false)
        ->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]');

    $page->keys('[data-slot="team-header"] h1', 'ControlOrMeta+k')
        ->fill('[data-slot="command-input"]', 'Templates')
        ->click($item('Templates'))
        ->assertPathIs(route('workspaces.templates.index', $team->workspace, false));

    $page->keys('[data-slot="workspace-templates-page"] h1', 'ControlOrMeta+k')
        ->click($item('Sprint 42 retro'))
        ->assertPathIs("/retros/{$retro->id}");
});

it('opens the keyboard shortcuts with "?" without typing it in their search, closes them with Escape, and types "?" in a field', function () {
    ['team' => $team, 'member' => $member] = cvtAtlas();

    $page = $this->signIn($member, route('workspaces.templates.index', $team->workspace, false));

    $page->keys('html > body', '?')
        ->assertPresent('[data-slot="keyboard-shortcuts"] [data-slot="keyboard-shortcuts-row"]')
        ->assertValue('[data-slot="keyboard-shortcuts"] input[type="search"]', '')
        ->fill('[data-slot="keyboard-shortcuts"] input', 'zzzzqq')
        ->assertPresent('[data-slot="keyboard-shortcuts-empty"]')
        ->keys('[data-slot="keyboard-shortcuts"] input', 'Escape')
        ->assertNotPresent('[data-slot="keyboard-shortcuts"]');

    $page->click('[data-slot="workspace-templates-page"] header button')
        ->assertPresent('#template-name')
        ->keys('#template-name', '?')
        ->assertValue('#template-name', '?')
        ->assertNotPresent('[data-slot="keyboard-shortcuts"]');
});

it('labels the ROTI points by sprint, heads a retro of a sprint with it and tells the phase and the people of the open retros of the team', function () {
    ['team' => $team, 'member' => $member, 'facilitator' => $facilitator] = cvtAtlas();
    teamSprint($team, 41, teamSprintStart(41)->toDateString(), teamSprintStart(41)->addDays(13)->toDateString());
    teamSprint($team, 42, teamSprintStart(42)->toDateString(), teamSprintStart(42)->addDays(13)->toDateString());

    $closedOn = [41 => teamSprintStart(41)->addDays(2)->setTime(10, 0), 42 => teamSprintStart(42)->addDays(2)->setTime(10, 0)];

    foreach ([41 => [4, 4, 3], 42 => [5, 5, 4]] as $sprint => $scores) {
        $this->travelTo($closedOn[$sprint]);
        $closed = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => "Sprint {$sprint} retrospective", 'completed_at' => now()]);

        foreach ($scores as $score) {
            RotiVote::factory()->create(['retro_id' => $closed->id, 'score' => $score]);
        }
    }

    $this->travelBack();

    $writing = Retro::factory()->for($team)->inPhase(RetroPhase::Writing)->started()->create(['title' => 'Refunds retro']);
    $grouped = Retro::factory()->for($team)->inPhase(RetroPhase::Voting)->started()->create(['title' => 'Checkout retro']);

    foreach ([$member, $facilitator] as $person) {
        $participant = Participant::factory()->create(['retro_id' => $writing->id, 'user_id' => $person->id]);
        Card::factory()->for($writing)->create(['participant_id' => $participant->id]);
    }

    $parent = Card::factory()->for($grouped)->create();
    Card::factory()->for($grouped)->create(['parent_card_id' => $parent->id, 'column_id' => $parent->column_id]);

    $page = $this->signIn($member, cvtTeamPath($team, 'teams.insights.show'));

    $page->assertPresent('[data-slot="team-roti"] [data-slot="roti-trend-label"]:text-is("S41")')
        ->assertPresent('[data-slot="team-roti"] [data-slot="roti-trend-label"]:text-is("S42")')
        ->assertSeeIn('[data-slot="team-roti"] [data-slot="roti-trend-delta"]', 'since S41')
        ->navigate(cvtTeamPath($team, 'teams.sessions.index'))
        ->assertSeeIn('a[data-kind="retro"]:has-text("Refunds retro")', 'Retro · Writing · 2 people')
        ->assertSeeIn('a[data-kind="retro"]:has-text("Checkout retro")', 'Retro · Voting');

    $this->awaitRealtime($page->navigate("/retros/{$writing->id}"))
        ->assertSee('Atlas · Sprint 42');
});

it('sends a guest of a retro who opens the team page or its Sessions page to the login', function () {
    ['team' => $team] = cvtAtlas();
    $retro = Retro::factory()->for($team)->withGuestAccess()->inPhase(RetroPhase::Writing)->create(['title' => 'Sprint 42 retro']);

    $page = $this->joinAsGuest("/join/{$retro->guest_token}", 'Gus Guest');

    $page->navigate(cvtTeamPath($team, 'teams.sessions.index'))
        ->assertPathIs('/login');

    $page->navigate(cvtTeamPath($team))
        ->assertPathIs('/login');
});
