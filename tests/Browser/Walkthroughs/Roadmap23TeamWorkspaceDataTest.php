<?php

use App\Enums\RetroPhase;
use App\Enums\TeamActivityKind;
use App\Enums\TeamRole;
use App\Enums\TemplateVisibility;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamActivity;
use App\Models\TeamSprint;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use App\Models\WorkspaceTemplateColumn;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

const R23Members = '[data-test="team-members"]';

/**
 * The browser's clock is not the test's: sprints are dated from today, sprint 42 holding it.
 */
function r23SprintStart(int $number): CarbonImmutable
{
    return CarbonImmutable::today()->startOfWeek(CarbonInterface::MONDAY)->subWeek()->addWeeks(($number - 42) * 2);
}

function r23Sprint(Team $team, int $number): TeamSprint
{
    $startsOn = r23SprintStart($number);

    return teamSprint($team, $number, $startsOn->toDateString(), $startsOn->addDays(13)->toDateString());
}

/**
 * Nordlys and its team Atlas: Camille the team owner, Théo a facilitator, Malik a member, Noa an observer,
 * and Arnaud, an admin of the workspace who sits in the team as a member.
 *
 * @return array{
 *     workspace: Workspace,
 *     team: Team,
 *     owner: User,
 *     facilitator: User,
 *     member: User,
 *     observer: User,
 *     admin: User
 * }
 */
function r23Atlas(): array
{
    $workspace = Workspace::factory()->create(['name' => 'Nordlys', 'description' => 'Product teams of Nordlys.']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas', 'sprint_length_weeks' => 2]);
    $people = [];

    foreach ([
        'owner' => ['Camille Roux', TeamRole::Owner, WorkspaceRole::Member],
        'facilitator' => ['Théo Martin', TeamRole::Facilitator, WorkspaceRole::Member],
        'member' => ['Malik Kone', TeamRole::Member, WorkspaceRole::Member],
        'observer' => ['Noa Kim', TeamRole::Observer, WorkspaceRole::Member],
        'admin' => ['Arnaud Ritti', TeamRole::Member, WorkspaceRole::Admin],
    ] as $key => [$name, $teamRole, $workspaceRole]) {
        $user = User::factory()->create(['name' => $name, 'locale' => 'en']);
        $workspace->members()->attach($user, ['role' => $workspaceRole->value]);
        $team->members()->attach($user, ['role' => $teamRole->value]);
        $people[$key] = $user;
    }

    return ['workspace' => $workspace, 'team' => $team, ...$people];
}

/**
 * @param  array<int, User>  $participants
 */
function r23Retro(Team $team, string $title, RetroPhase $phase, User $facilitator, array $participants = []): Retro
{
    $retro = Retro::factory()->for($team)->inPhase($phase)->started()->create([
        'title' => $title,
        'completed_at' => $phase === RetroPhase::Completed ? now() : null,
    ]);

    $joined = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $facilitator->id]);
    $retro->forceFill(['facilitator_participant_id' => $joined->id])->save();

    foreach ($participants as $participant) {
        Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $participant->id]);
    }

    return $retro;
}

function r23TeamPath(Team $team): string
{
    return route('teams.show', [$team->workspace, $team], false);
}

function r23MembersPath(Team $team): string
{
    return route('teams.members.index', [$team->workspace, $team], false);
}

function r23MemberRow(User $user): string
{
    return R23Members." tr:has-text(\"{$user->email}\")";
}

it('[R23-01] shows the sprint, the recent sessions, the open actions and the activity on the team page, and leads to all sessions', function () {
    ['team' => $team, 'owner' => $owner, 'facilitator' => $facilitator, 'member' => $member] = r23Atlas();
    r23Sprint($team, 42);
    $live = r23Retro($team, 'Sprint 42 retro', RetroPhase::Writing, $facilitator, [$member]);
    $finished = r23Retro($team, 'Sprint 41 retro', RetroPhase::Completed, $owner, [$member, $facilitator]);
    ActionItem::factory()->withoutRetro($team, $owner)->overdue()->create(['content' => 'Write the retry runbook']);
    ActionItem::factory()->withoutRetro($team, $owner)->create(['content' => 'Split the refunds epic']);
    TeamActivity::factory()->for($team)->create([
        'kind' => TeamActivityKind::RetroStarted,
        'actor_user_id' => $facilitator->id,
        'subject_title' => 'Sprint 42 retro',
        'created_at' => now()->subMinutes(5),
    ]);

    $page = $this->signIn($member, r23TeamPath($team));

    $page->assertSeeIn('[data-slot="team-header"] [data-slot="team-schedule"]', 'Sprint 42')
        ->assertCount('#recent-sessions [data-test="recent-session"]', 2)
        ->assertPresent("#recent-sessions [data-test=\"recent-session\"]:first-child a[href$=\"/retros/{$live->id}\"]:text-is(\"Sprint 42 retro\")")
        ->assertSeeIn('#recent-sessions [data-test="recent-session"]:first-child [data-slot="badge"]', 'Live')
        ->assertPresent('#recent-sessions [data-test="recent-session"]:first-child a:has-text("Join")')
        ->assertPresent("#recent-sessions [data-test=\"recent-session\"]:nth-child(2) a[href$=\"/retros/{$finished->id}\"]")
        ->assertSeeIn('#open-actions', 'Open action items')
        ->assertSeeIn('#open-actions [data-slot="open-actions-overdue"]', '1 overdue')
        ->assertCount('#open-actions [data-test="open-action"]', 2)
        ->assertSeeIn('#open-actions [data-test="open-action"]:first-child', 'Write the retry runbook')
        ->assertCount('#activity [data-test="activity-line"]', 1)
        ->assertSeeIn('#activity [data-test="activity-line"]', 'Théo Martin')
        ->click('#recent-sessions a:has-text("All sessions")')
        ->assertPathIs(route('teams.sessions.index', [$team->workspace, $team], false))
        ->assertPresent("[data-slot=\"session-row\"][href*=\"/{$live->id}\"]");
});

it('[R23-02] offers a team owner the first sprint, then shows the next retro of the sprint started from Members & rituals', function () {
    ['team' => $team, 'owner' => $owner] = r23Atlas();
    $team->update(['retro_weekday' => CarbonImmutable::today()->addDays(3)->dayOfWeekIso, 'retro_time' => '14:00']);

    $page = $this->signIn($owner, r23TeamPath($team));

    $page->assertSeeIn('[data-slot="team-schedule"]', 'Start the first sprint')
        ->click('[data-slot="team-schedule"]')
        ->assertPathIs(r23MembersPath($team))
        ->assertSeeIn('#sprints [data-test="current-sprint"]', 'No sprint in progress.')
        ->assertSeeIn('#sprints', 'Sprint 1 · from today to')
        ->click('#sprints button:has-text("Start the next sprint")')
        ->assertSeeIn('#sprints [data-test="current-sprint"]', 'Sprint 1')
        ->assertSeeIn('#sprints', 'Sprint 1 already starts today.')
        ->assertAttribute('#sprints button:has-text("Start the next sprint")', 'disabled', '');

    $page->navigate(r23TeamPath($team))
        ->assertSeeIn('[data-slot="team-schedule"]', 'Sprint 1')
        ->assertSeeIn('[data-slot="team-schedule"]', 'Next retro');

    expect($team->sprints()->sole())
        ->number->toBe(1)
        ->starts_on->toDateString()->toBe(today()->toDateString());
});

it('[R23-03] ends the current sprint yesterday when the next one starts today, and refuses a second start', function () {
    ['team' => $team, 'facilitator' => $facilitator] = r23Atlas();
    r23Sprint($team, 41);
    $current = r23Sprint($team, 42);

    $page = $this->signIn($facilitator, r23MembersPath($team));

    $page->assertSeeIn('#sprints [data-test="current-sprint"]', 'Sprint 42')
        ->assertSeeIn('#sprints', 'Sprint 43 · from today to')
        ->click('#sprints button:has-text("Start the next sprint")')
        ->assertSeeIn('#sprints [data-test="current-sprint"]', 'Sprint 43')
        ->assertSeeIn('#sprints', 'Sprint 43 already starts today.')
        ->assertCount('#sprints [data-sprint-id]', 3);

    expect($current->fresh()->ends_on->toDateString())->toBe(today()->subDay()->toDateString())
        ->and($team->sprints()->where('number', 43)->sole()->starts_on->toDateString())->toBe(today()->toDateString());
});

it('[R23-04] lets a team owner change a role on Members & rituals, shows a facilitator the members read-only, and refuses a member', function () {
    ['team' => $team, 'owner' => $owner, 'facilitator' => $facilitator, 'member' => $member] = r23Atlas();

    $page = $this->signIn($owner, r23MembersPath($team));

    $page->assertSeeIn('#members', '5 members')
        ->assertSeeIn(r23MemberRow($owner), '(you)')
        ->click("[aria-label=\"Role of {$member->name}\"]")
        ->click('[role="listbox"] [role="option"]:has-text("Facilitator")')
        ->assertSeeIn("[aria-label=\"Role of {$member->name}\"]", 'Facilitator')
        ->navigate(r23MembersPath($team))
        ->assertSeeIn("[aria-label=\"Role of {$member->name}\"]", 'Facilitator');

    expect($team->members()->whereKey($member->id)->sole()->teamMembership->role)->toBe(TeamRole::Facilitator);

    $this->signIn($facilitator, r23MembersPath($team))
        ->assertSeeIn(r23MemberRow($member), 'Facilitator')
        ->assertNotPresent('[aria-label^="Role of"]')
        ->assertNotPresent('[aria-label="Member actions"]')
        ->assertPresent('#sprints');

    $other = teamMember($team);
    $other->update(['locale' => 'en']);

    $this->signIn($other, r23MembersPath($team))
        ->assertPresent('[data-slot="error-page"][data-status="403"]');
});

it('[R23-05] marks a member "Online" in the table while they have a page of the workspace open, and their last activity once they leave', function () {
    ['team' => $team, 'owner' => $owner, 'member' => $member] = r23Atlas();
    $onlineCell = r23MemberRow($member).' [data-test="member-last-activity"]';

    $ownerPage = $this->signIn($owner, r23MembersPath($team));

    $ownerPage->assertAttribute(r23MemberRow($owner).' [data-test="member-last-activity"]', 'data-online', 'true')
        ->assertAttributeMissing($onlineCell, 'data-online')
        ->assertSeeIn($onlineCell, 'Never');

    $memberPage = $this->signIn($member, r23TeamPath($team));

    $ownerPage->assertAttribute($onlineCell, 'data-online', 'true')
        ->assertSeeIn($onlineCell, 'Online');

    $memberPage->navigate(route('teams.sessions.index', [$team->workspace, $team], false));

    $ownerPage->assertAttribute($onlineCell, 'data-online', 'true');

    $memberPage->script('() => { setTimeout(() => window.location.assign("about:blank"), 0); return true; }');

    $ownerPage->assertAttributeMissing($onlineCell, 'data-online')
        ->assertDontSeeIn($onlineCell, 'Online');
});

it('[R23-06] suggests the next facilitator of the rotation in the "New session" dialog, prefills the sprint retro name and moves the rotation on', function () {
    ['team' => $team, 'owner' => $owner, 'facilitator' => $facilitator] = r23Atlas();
    r23Sprint($team, 42);
    $ines = teamMember($team, TeamRole::Facilitator);
    $ines->update(['name' => 'Inès Benali']);

    $page = $this->signIn($owner, r23MembersPath($team));

    $page->assertSeeIn('#facilitators', 'Add a facilitator first.')
        ->click('#facilitators button:has-text("Add")')
        ->click('[role="menuitem"]:has-text("Théo Martin")')
        ->assertSeeIn('#facilitators [data-slot="facilitator-chip"]', 'Théo')
        ->assertSeeIn('#facilitators', 'Suggested next: Théo Martin')
        ->assertNotPresent('[role="menu"]')
        ->click('#facilitators button:has-text("Add")')
        ->assertPresent('[role="menu"]')
        ->click('[role="menuitem"]:has-text("Inès Benali")')
        ->assertCount('#facilitators [data-slot="facilitator-chip"]', 2)
        ->click('#facilitators [role="switch"]')
        ->assertAttribute('#facilitators [role="switch"]', 'aria-checked', 'true')
        ->assertSeeIn('#facilitators', 'Suggested next: Théo Martin');

    $page->navigate(r23TeamPath($team))
        ->click('[data-slot="team-header"] button:has-text("New session")')
        ->assertValue('#new-retro-title', 'Sprint 42 retro')
        ->assertSeeIn('#new-retro-facilitator', 'Théo Martin (suggested)')
        ->assertSeeIn('[role="dialog"]', 'Suggested by the rotation.')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/');

    $retro = Retro::query()->where('title', 'Sprint 42 retro')->sole();

    expect($retro->facilitator->user_id)->toBe($facilitator->id)
        ->and($retro->participants()->where('user_id', $owner->id)->exists())->toBeTrue();

    $page->navigate(r23TeamPath($team))
        ->click('[data-slot="team-header"] button:has-text("New session")')
        ->assertSeeIn('#new-retro-facilitator', 'Inès Benali (suggested)');
});

it('[R23-07] preselects the default retro template of the team in the "New session" dialog', function () {
    ['workspace' => $workspace, 'team' => $team, 'facilitator' => $facilitator] = r23Atlas();
    $template = WorkspaceTemplate::factory()->for($workspace)->create([
        'name' => 'Atlas 4L',
        'visibility' => TemplateVisibility::Team,
        'team_id' => $team->id,
        'created_by_user_id' => $facilitator->id,
    ]);
    WorkspaceTemplateColumn::factory()->create(['workspace_template_id' => $template->id, 'title' => 'Liked', 'position' => 0]);
    WorkspaceTemplateColumn::factory()->create(['workspace_template_id' => $template->id, 'title' => 'Lacked', 'position' => 1]);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['template' => 'workspace', 'workspace_template_id' => $template->id]);
    $templateRow = '#retro-templates label:has-text("Atlas 4L")';

    $page = $this->signIn($facilitator, r23MembersPath($team));

    $page->assertSeeIn($templateRow, 'Used 1×')
        ->click("{$templateRow} [role=\"radio\"]")
        ->assertAttribute("{$templateRow} [role=\"radio\"]", 'aria-checked', 'true')
        ->assertSeeIn("{$templateRow} [data-slot=\"badge\"]", 'Default');

    expect($team->fresh()->default_retro_template)->toBe($template->catalogueKey());

    $page->navigate(r23TeamPath($team))
        ->click('[data-slot="team-header"] button:has-text("New session")')
        ->assertSeeIn('[role="dialog"] [role="radiogroup"][aria-label="Retrospective template"] [role="radio"][aria-checked="true"]', 'Atlas 4L');
});

it('[R23-08] lets a team owner describe the team on the General tab, shows it on the workspace tile, and lists the closed polls on Data & export', function () {
    ['workspace' => $workspace, 'team' => $team, 'owner' => $owner] = r23Atlas();
    TeamSurvey::factory()->for($team)->closed()->create(['title' => 'September pulse', 'created_by_user_id' => $owner->id]);

    $page = $this->signIn($owner, route('teams.settings.show', [$workspace, $team], false));

    $page->assertPresent('[data-slot="team-settings-shell"]')
        ->assertNotPresent('button:has-text("Delete team")')
        ->fill('#team-description', 'Checkout and payments squad')
        ->click('[data-slot="team-settings-shell"] button:has-text("Save")')
        ->assertSee('Checkout and payments squad')
        ->navigate(route('workspaces.show', $workspace, false))
        ->assertSeeIn('a[data-slot="team-tile"] [data-slot="team-description"]', 'Checkout and payments squad')
        ->navigate(route('teams.data.show', [$workspace, $team], false))
        ->assertCount('[data-test="survey-export"]', 1)
        ->assertPresent('[data-test="survey-export"]:has-text("September pulse")')
        ->click('[data-test="action-items-link"]')
        ->assertPathIs(route('workspaces.actionItems.index', $workspace, false))
        ->assertQueryStringHas('team', $team->id);

    expect($team->fresh()->description)->toBe('Checkout and payments squad');
});

it('[R23-09] lets a workspace admin rename and describe the workspace in one dialog, keeping its address, and gives a member no button', function () {
    ['workspace' => $workspace, 'admin' => $admin, 'member' => $member] = r23Atlas();
    $path = route('workspaces.show', $workspace, false);
    $edit = 'button[aria-label="Edit the workspace name and description"]';

    $page = $this->signIn($admin, $path);

    $page->assertSeeIn('[data-slot="workspace-description"]', 'Product teams of Nordlys.')
        ->click($edit)
        ->assertSeeIn('[role="dialog"]', 'The workspace address does not change.')
        ->assertAttribute('#workspace-name', 'required', '')
        ->fill('#workspace-name', '   ')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPresent('#workspace-name[aria-invalid="true"]')
        ->fill('#workspace-name', 'Nordlys Labs')
        ->fill('#workspace-description', 'Labs of Nordlys.')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn('[data-slot="workspace-header"] h1', 'Nordlys Labs')
        ->assertSeeIn('[data-slot="workspace-description"]', 'Labs of Nordlys.')
        ->assertSeeIn('[data-sidebar="header"]', 'Nordlys Labs')
        ->assertPathIs($path);

    expect($workspace->fresh())
        ->name->toBe('Nordlys Labs')
        ->slug->toBe($workspace->slug);

    $this->signIn($member, $path)
        ->assertNotPresent($edit);
});

it('[R23-10] lets a member create a personal template only, badged "Personal", and shows the team and workspace badges', function () {
    ['workspace' => $workspace, 'team' => $team, 'owner' => $owner, 'member' => $member] = r23Atlas();
    WorkspaceTemplate::factory()->for($workspace)->create(['name' => 'Atlas 4L', 'visibility' => TemplateVisibility::Team, 'team_id' => $team->id, 'created_by_user_id' => $owner->id]);
    WorkspaceTemplate::factory()->for($workspace)->create(['name' => 'Company retro', 'visibility' => TemplateVisibility::Workspace, 'created_by_user_id' => $owner->id]);
    $card = fn (string $name): string => "[data-slot=\"template-card\"]:has-text(\"{$name}\")";

    $page = $this->signIn($member, route('workspaces.templates.index', $workspace, false));

    $page->assertSeeIn($card('Atlas 4L').' [data-test="template-visibility"]', 'Team · Atlas')
        ->assertSeeIn($card('Company retro').' [data-test="template-visibility"]', 'Workspace')
        ->click('[data-slot="workspace-templates-page"] header button')
        ->assertPresent('[role="dialog"] [data-slot="template-editor"]')
        ->assertAttribute('[role="dialog"] [role="radiogroup"] [role="radio"]:has-text("Workspace")', 'disabled', '')
        ->assertAttribute('[role="dialog"] [role="radiogroup"] [role="radio"]:has-text("Team")', 'disabled', '')
        ->assertSeeIn('[role="dialog"]', 'Only workspace admins can share templates with the whole workspace.')
        ->fill('#template-name', 'My sailboat')
        ->fill('[role="dialog"] [aria-label="Column 1 title"]', 'Wind')
        ->keys('#template-name', 'Enter')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($card('My sailboat').' [data-test="template-visibility"]', 'Personal');

    expect(WorkspaceTemplate::query()->where('name', 'My sailboat')->sole())
        ->visibility->toBe(TemplateVisibility::Personal)
        ->created_by_user_id->toBe($member->id);

    $this->signIn($owner, route('workspaces.templates.index', $workspace, false))
        ->assertNotPresent($card('My sailboat'));
});

it('[R23-11] keeps an observer from starting a session and shows them a retro read-only, "You are observing this session."', function () {
    ['team' => $team, 'facilitator' => $facilitator, 'observer' => $observer] = r23Atlas();
    $retro = r23Retro($team, 'Sprint 42 retro', RetroPhase::Writing, $facilitator, [$observer]);

    $page = $this->signIn($observer, r23TeamPath($team));

    $page->assertAttribute('[data-slot="team-header"] button:has-text("New session")', 'disabled', '')
        ->assertSee('Observers cannot start sessions.');

    $this->awaitRealtime($page->navigate("/retros/{$retro->id}"))
        ->assertSeeIn('[data-slot="observer-notice"]', 'You are observing this session.')
        ->assertNotPresent('[data-slot="facilitator-bar"]')
        ->assertNotPresent('textarea');
});

it('[R23-12] lets a team facilitator take control of an open retro, live for the facilitator who loses it', function () {
    ['team' => $team, 'owner' => $owner, 'facilitator' => $facilitator] = r23Atlas();
    $retro = r23Retro($team, 'Sprint 42 retro', RetroPhase::Writing, $owner, [$facilitator]);

    $ownerPage = $this->awaitRealtime($this->signIn($owner, "/retros/{$retro->id}"));
    $facilitatorPage = $this->awaitRealtime($this->signIn($facilitator, "/retros/{$retro->id}"));

    $ownerPage->assertPresent('[data-slot="facilitator-bar"]');

    $facilitatorPage->assertNotPresent('[data-slot="facilitator-bar"]')
        ->click('header button[aria-label="Menu"]')
        ->click('[role="menuitem"]:has-text("Take control")')
        ->assertPresent('[data-slot="facilitator-bar"]');

    $ownerPage->assertNotPresent('[data-slot="facilitator-bar"]');

    expect($retro->fresh()->facilitator->user_id)->toBe($facilitator->id);
});

it('[R23-13] names the team role and the workspace role on the sidebar user card', function () {
    ['team' => $team, 'workspace' => $workspace, 'facilitator' => $facilitator] = r23Atlas();
    $workspace->members()->updateExistingPivot($facilitator->id, ['role' => WorkspaceRole::Admin->value]);

    $this->signIn($facilitator, r23TeamPath($team))
        ->assertSeeIn('[data-sidebar="footer"]', 'Facilitator · Admin');
});

it('[R23-14] fits the team page and Members & rituals on a phone without horizontal scroll', function () {
    ['team' => $team, 'owner' => $owner, 'facilitator' => $facilitator, 'member' => $member] = r23Atlas();
    r23Sprint($team, 42);
    r23Retro($team, 'Sprint 42 retro', RetroPhase::Writing, $facilitator, [$member]);
    ActionItem::factory()->withoutRetro($team, $owner)->overdue()->create(['content' => 'Write the retry runbook']);

    $page = $this->signIn($owner, r23TeamPath($team))->resize(390, 844);

    $page->assertVisible('#recent-sessions')
        ->assertVisible('#open-actions');

    expect($this->overflowingElements($page))->toBe([]);

    $page->navigate(r23MembersPath($team))
        ->assertVisible('#members')
        ->assertVisible('#sprints');

    expect($this->overflowingElements($page))->toBe([]);
});

it('[R23-15] draws the team page and Members & rituals in the dark theme', function () {
    ['team' => $team, 'owner' => $owner, 'facilitator' => $facilitator] = r23Atlas();
    r23Sprint($team, 42);
    r23Retro($team, 'Sprint 42 retro', RetroPhase::Writing, $facilitator);

    $page = $this->signIn($owner, r23TeamPath($team), ['colorScheme' => 'dark']);

    $page->assertScript('document.documentElement.classList.contains("dark")', true)
        ->assertScript('getComputedStyle(document.querySelector("#recent-sessions")).backgroundColor !== "rgb(255, 255, 255)"', true)
        ->navigate(r23MembersPath($team))
        ->assertScript('document.documentElement.classList.contains("dark")', true)
        ->assertScript('getComputedStyle(document.querySelector("#members")).backgroundColor !== "rgb(255, 255, 255)"', true);
});

it('[R23-16] speaks the language of the viewer on the team page and Members & rituals', function (string $locale, string $recent, string $addSprint, string $start) {
    ['team' => $team, 'owner' => $owner, 'facilitator' => $facilitator] = r23Atlas();
    r23Sprint($team, 42);
    r23Retro($team, 'Sprint 42 retro', RetroPhase::Writing, $facilitator);
    $owner->update(['locale' => $locale]);

    $this->signIn($owner, r23TeamPath($team))
        ->assertScript('document.documentElement.lang', $locale)
        ->assertSeeIn('#recent-sessions', $recent)
        ->navigate(r23MembersPath($team))
        ->assertSeeIn('#sprints button:has-text("'.$addSprint.'")', $addSprint)
        ->assertSeeIn('#sprints button:has-text("'.$start.'")', $start);
})->with([
    'English' => ['en', 'Recent sessions', 'Add a sprint', 'Start the next sprint'],
    'French' => ['fr', 'Sessions récentes', 'Ajouter un sprint', 'Lancer le sprint suivant'],
    'Spanish' => ['es', 'Sesiones recientes', 'Añadir un sprint', 'Iniciar el siguiente sprint'],
    'German' => ['de', 'Letzte Sitzungen', 'Sprint hinzufügen', 'Nächsten Sprint starten'],
]);
