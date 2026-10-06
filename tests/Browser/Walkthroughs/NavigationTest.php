<?php

use App\Enums\RetroPhase;
use App\Enums\TeamActivityKind;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamActivity;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Workspace;

const NavigationEntries = '[data-sidebar="content"] a[data-sidebar="menu-button"]';

const NavigationRows = '[data-slot="sessions-page"] [data-slot="session-row"]';

const NavigationLiveRows = '[data-slot="sessions-page"] > section [data-slot="session-row"]';

const NavigationChips = '[data-slot="sessions-page"] nav[aria-label="Kinds"]';

const NavigationBanner = '[data-slot="team-page"] [data-slot="live-session-banner"]';

/**
 * Atlas of Nordlys: Camille an admin of the workspace who sits in the team, Théo a facilitator, Malik a member.
 *
 * @return array{
 *     team: Team,
 *     admin: User,
 *     facilitator: User,
 *     member: User
 * }
 */
function navigationAtlas(): array
{
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $people = [];

    foreach ([
        'admin' => ['Camille Roux', TeamRole::Member, WorkspaceRole::Admin],
        'facilitator' => ['Théo Martin', TeamRole::Facilitator, WorkspaceRole::Member],
        'member' => ['Malik Kone', TeamRole::Member, WorkspaceRole::Member],
    ] as $key => [$name, $teamRole, $workspaceRole]) {
        $user = User::factory()->create(['name' => $name, 'locale' => 'en']);
        $workspace->members()->attach($user, ['role' => $workspaceRole->value]);
        $team->members()->attach($user, ['role' => $teamRole->value]);
        $people[$key] = $user;
    }

    return ['team' => $team, ...$people];
}

function navigationLiveRetro(Team $team, User $facilitator, string $title = 'Sprint 42 retro'): Retro
{
    $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Writing)->started()->create(['title' => $title]);
    $joined = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $facilitator->id]);
    $retro->forceFill(['facilitator_participant_id' => $joined->id])->save();

    return $retro;
}

it('opens a page of its own from each of the nine entries of the sidebar, in their order', function () {
    ['team' => $team, 'admin' => $admin] = navigationAtlas();
    $workspace = $team->workspace;
    $current = NavigationEntries.'[aria-current="page"]';

    $page = $this->signIn($admin, route('workspaces.templates.index', $workspace, false));

    $page->assertScript('[...document.querySelectorAll(\''.NavigationEntries.'\')].map((entry) => entry.getAttribute("aria-label")).join(",")', 'Home,Sessions,Actions,Insights,Members,Activity,Settings,Templates,All teams')
        ->assertNotPresent(NavigationEntries.'[href*="#"]');

    foreach ([
        'Home' => [teamPath('teams.show', $team), '[data-slot="team-page"]'],
        'Sessions' => [teamPath('teams.sessions.index', $team), '[data-slot="sessions-page"]'],
        'Actions' => [workspaceActionItemsPath($team), '[data-slot="action-items-page"]'],
        'Insights' => [teamPath('teams.insights.show', $team), '[data-slot="insights-tabs"]'],
        'Members' => [teamPath('teams.members.index', $team), '[data-slot="members-page"]'],
        'Activity' => [teamPath('teams.activity.index', $team), '[data-slot="activity-page"]'],
        'Settings' => [teamPath('teams.settings.show', $team), '[data-slot="team-settings-shell"]'],
        'Templates' => [route('workspaces.templates.index', $workspace, false), '[data-slot="workspace-templates-page"]'],
        'All teams' => [route('workspaces.show', $workspace, false), '[data-slot="workspace-header"]'],
    ] as $label => [$path, $mark]) {
        $page->click(NavigationEntries."[aria-label=\"{$label}\"]")
            ->assertPathIs($path)
            ->assertPresent($mark)
            ->assertCount($current, 1)
            ->assertSeeIn($current, $label)
            ->assertScript('window.location.hash', '');
    }

    $page->click(NavigationEntries.'[aria-label="Actions"]')
        ->assertQueryStringHas('team', $team->id);
});

it('filters the Sessions page by chip, shows the links of a kind under its chip only, and joins a live session', function () {
    ['team' => $team, 'facilitator' => $facilitator, 'member' => $member] = navigationAtlas();
    $retro = navigationLiveRetro($team, $facilitator);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 41 retro', 'completed_at' => now()]);
    $game = PokerGame::factory()->for($team)->ended()->create(['title' => 'Billing sizing']);
    $chip = fn (string $label): string => NavigationChips." a:has-text(\"{$label}\")";

    $page = $this->signIn($member, teamPath('teams.show', $team));

    $page->click(NavigationEntries.'[aria-label="Sessions, 1 live"]')
        ->assertPathIs(teamPath('teams.sessions.index', $team))
        ->assertAttribute($chip('All'), 'aria-current', 'page')
        ->assertSeeIn($chip('All'), '3')
        ->assertSeeIn($chip('Retro'), '2')
        ->assertSeeIn($chip('Planning poker'), '1')
        ->assertSeeIn($chip('Whiteboard'), '0')
        ->assertCount(NavigationRows, 3)
        ->assertCount(NavigationLiveRows, 1)
        ->assertNotPresent('[data-slot="session-kind-links"]');

    $page->click($chip('Planning poker'))
        ->assertQueryStringHas('kind', 'poker')
        ->assertAttribute($chip('Planning poker'), 'aria-current', 'page')
        ->assertCount(NavigationRows, 1)
        ->assertPresent(NavigationRows."[data-kind=\"poker\"][href$=\"/poker/{$game->id}\"]")
        ->assertNotPresent(NavigationLiveRows)
        ->assertSeeIn('[data-slot="session-kind-links"]', 'Estimation history')
        ->assertSeeIn('[data-slot="session-kind-links"]', 'Saved decks');

    $page->click($chip('Retro'))
        ->assertQueryStringHas('kind', 'retro')
        ->assertCount(NavigationRows, 2)
        ->assertCount(NavigationLiveRows, 1)
        ->assertSeeIn(NavigationLiveRows, 'Sprint 42 retro')
        ->assertNotPresent('[data-slot="session-kind-links"]')
        ->click('[data-slot="sessions-page"] > section a:text-is("Join")')
        ->assertPathIs("/retros/{$retro->id}");
});

it('shows the live session in a banner on Home, only while one is live, and joins it', function () {
    ['team' => $team, 'facilitator' => $facilitator, 'member' => $member] = navigationAtlas();
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 41 retro', 'completed_at' => now()]);

    $page = $this->signIn($member, teamPath('teams.show', $team));

    $page->assertPresent('#recent-sessions')
        ->assertNotPresent(NavigationBanner)
        ->assertPresent(NavigationEntries.'[aria-label="Sessions"]');

    $retro = navigationLiveRetro($team, $facilitator);

    $page->navigate(teamPath('teams.show', $team))
        ->assertSeeIn(NavigationBanner, 'A session is in progress: Sprint 42 retro')
        ->assertPresent(NavigationEntries.'[aria-label="Sessions, 1 live"]')
        ->click(NavigationBanner.' a:text-is("Join")')
        ->assertPathIs("/retros/{$retro->id}");
});

it('asks a facilitator who leaves a live retro, and stays, leaves it running or ends it by the button they choose', function () {
    ['team' => $team, 'facilitator' => $facilitator] = navigationAtlas();
    $retro = navigationLiveRetro($team, $facilitator);
    $back = 'header button[aria-label="Back to the team"]';
    $dialog = '[role="dialog"]';
    $leave = "{$dialog} button:has-text(\"Leave, the session continues\")";
    $end = "{$dialog} button:has-text(\"End the session\")";

    $page = $this->awaitRealtime($this->signIn($facilitator, "/retros/{$retro->id}"));

    $page->assertNotPresent('[data-sidebar="sidebar"]')
        ->click($back)
        ->assertSeeIn($dialog, 'Leave Sprint 42 retro?')
        ->assertSeeIn($leave, 'It keeps running. You can come back.')
        ->assertSeeIn($end, 'It closes for everyone. The remaining phases are skipped.')
        ->assertCount("{$dialog} [data-slot=\"dialog-footer\"] button", 1)
        ->assertScript("document.activeElement.closest('[data-slot=\"dialog-footer\"]') !== null && document.activeElement.textContent === 'Stay'", true)
        ->assertScript("(() => { const [leave, end] = ['Leave, the session continues', 'End the session'].map((name) => [...document.querySelectorAll('[role=\"dialog\"] button')].find((button) => button.textContent.includes(name)).getBoundingClientRect()); return leave.bottom <= end.top && leave.left === end.left && leave.width === end.width; })()", true)
        ->click("{$dialog} button:text-is(\"Stay\")")
        ->assertNotPresent($dialog)
        ->assertPathIs("/retros/{$retro->id}");

    $page->click($back)
        ->click($leave)
        ->assertPathIs(teamPath('teams.show', $team))
        ->assertSeeIn(NavigationBanner, 'Sprint 42 retro');

    expect($retro->fresh()->phase)->toBe(RetroPhase::Writing);

    $this->awaitRealtime($page->click(NavigationBanner.' a:text-is("Join")'))
        ->assertPathIs("/retros/{$retro->id}")
        ->click($back)
        ->click($end)
        ->assertPathIs(teamPath('teams.show', $team))
        ->assertNotPresent(NavigationBanner)
        ->assertPresent(NavigationEntries.'[aria-label="Sessions"]');

    expect($retro->fresh()->phase)->toBe(RetroPhase::Completed);
});

it('gives the room of a retro\'s top bar away in order, never scrolls, keeps the phases at the middle and moves the phase from the compact control', function () {
    ['team' => $team, 'facilitator' => $facilitator] = navigationAtlas();
    $retro = navigationLiveRetro($team, $facilitator);
    $finished = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->started()->create(['title' => 'Sprint 41 retro']);
    $finished->forceFill([
        'facilitator_participant_id' => Participant::factory()->create(['retro_id' => $finished->id, 'user_id' => $facilitator->id])->id,
    ])->save();
    $header = '[data-slot="session-frame"] header';
    $count = "{$header} [data-slot=\"phase-count\"]";
    $current = "{$header} [data-slot=\"phase-step\"][data-state=\"current\"]";
    $nothingScrolls = "(() => { const header = document.querySelector('{$header}'); const stepper = header.querySelector('[data-slot=\"phase-stepper\"]'); return [header, stepper].every((element) => element.scrollWidth <= element.clientWidth) && [...header.querySelectorAll('*')].every((element) => ! ['auto', 'scroll'].includes(getComputedStyle(element).overflowX)) && header.lastElementChild.getBoundingClientRect().right <= innerWidth && document.documentElement.scrollWidth <= innerWidth; })()";
    $nameShows = "(() => { const name = document.querySelector('{$header} h1'); const box = name.getBoundingClientRect(); return box.width >= 4 * parseFloat(getComputedStyle(document.documentElement).fontSize) && box.left >= 0 && box.right <= innerWidth; })()";
    $offCentre = "(() => { const header = document.querySelector('{$header}').getBoundingClientRect(); const phases = document.querySelector('{$header} [data-slot=\"phase-stepper\"]').getBoundingClientRect(); return Math.abs(phases.left + phases.width / 2 - (header.left + header.width / 2)) <= 2; })()";

    $page = $this->awaitRealtime($this->signIn($facilitator, "/retros/{$retro->id}"))->resize(1920, 1080);

    $page->assertScript($nothingScrolls, true)
        ->assertScript($offCentre, true)
        ->assertSeeIn("{$header} [data-slot=\"session-overline\"]", 'Atlas')
        ->assertVisible("{$header} button[aria-label=\"Settings\"]")
        ->resize(1700, 900)
        ->assertScript($nothingScrolls, true)
        ->assertScript($nameShows, true)
        ->assertSeeIn($current, 'Writing')
        ->assertCount("{$header} [data-slot=\"phase-step\"]:visible", 6)
        ->assertMissing($count)
        ->assertVisible("{$header} button[aria-label=\"Settings\"]");

    $page->resize(940, 900)
        ->assertScript($nothingScrolls, true)
        ->assertScript($nameShows, true)
        ->assertMissing("{$header} [data-slot=\"session-overline\"]")
        ->assertNotPresent("{$header} button[aria-label=\"Settings\"]")
        ->assertCount("{$header} [data-slot=\"phase-step\"]:visible", 1)
        ->assertSeeIn($count, '1/6')
        ->assertSeeIn($current, 'Writing')
        ->click("{$header} [data-slot=\"phase-forward\"]")
        ->assertSeeIn($count, '2/6')
        ->assertSeeIn($current, 'Grouping')
        ->click("{$header} button[aria-label=\"Facilitator menu\"]")
        ->assertPresent('[role="menuitem"]:has-text("Settings…")')
        ->assertPresent('[role="menuitem"]:has-text("Keyboard shortcuts")')
        ->keys('[role="menu"]', 'Escape');

    foreach ([[640, '3/6', 'Voting'], [360, '4/6', 'Discussing']] as [$width, $place, $phase]) {
        $page->resize($width, 800)
            ->assertScript($nothingScrolls, true)
            ->assertScript($nameShows, true)
            ->assertMissing("{$header} [data-slot=\"phase-forward\"]")
            ->click($count)
            ->click("[role=\"menuitemradio\"]:has-text(\"{$phase}\")")
            ->assertSeeIn($count, $place)
            ->assertNotPresent('[role="menu"]');
    }

    expect($retro->fresh()->phase)->toBe(RetroPhase::Discussing);

    $this->awaitRealtime($page->resize(1920, 1080)->navigate("/retros/{$finished->id}"))
        ->assertSeeIn("{$header} [data-slot=\"phase-ended\"]", 'Completed')
        ->assertVisible("{$header} [data-slot=\"phase-forward\"]")
        ->assertScript($nothingScrolls, true)
        ->assertScript($offCentre, true);
});

it('keeps a whiteboard\'s top bar from scrolling and the facilitator\'s pill in the top right corner of the board, named at 1700 and as icons at 940', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $header = '[data-slot="session-frame"] header';
    $pill = '.whiteboard-canvas [data-slot="board-facilitation"]';
    $nothingScrolls = "(() => { const header = document.querySelector('{$header}'); return header.scrollWidth <= header.clientWidth && [...header.querySelectorAll('*')].every((element) => ! ['auto', 'scroll'].includes(getComputedStyle(element).overflowX)) && header.lastElementChild.getBoundingClientRect().right <= innerWidth && document.documentElement.scrollWidth <= innerWidth; })()";
    $pillInCorner = "(() => { const canvas = document.querySelector('.whiteboard-canvas').getBoundingClientRect(); const pill = document.querySelector('{$pill}').getBoundingClientRect(); return pill.width > 0 && pill.left >= canvas.left + canvas.width / 2 && pill.right <= canvas.right && pill.top >= canvas.top && pill.bottom <= canvas.top + canvas.height / 4; })()";
    $pillWords = "[...document.querySelectorAll('{$pill} [data-slot=\"facilitator-action\"]')].map((action) => action.innerText.trim()).join('|')";

    $page = $this->awaitRealtime($this->signIn($fran, route('whiteboards.show', $board, false)))->resize(1700, 900);

    $page->assertScript($nothingScrolls, true)
        ->assertScript($pillInCorner, true)
        ->assertScript($pillWords, 'Lock the board|Bring everyone to me')
        ->assertNotPresent("{$header} [role=\"toolbar\"]")
        ->assertVisible("{$header} button[aria-label=\"Export\"]")
        ->resize(940, 900)
        ->assertScript($nothingScrolls, true)
        ->assertScript($pillInCorner, true)
        ->assertScript($pillWords, '|')
        ->assertPresent("{$pill} [aria-label=\"Lock the board\"]")
        ->assertNotPresent("{$header} button[aria-label=\"Export\"]")
        ->assertVisible("{$header} button[aria-label=\"Share\"]")
        ->click("{$header} button[aria-label=\"Board menu\"]")
        ->assertPresent('[role="menuitem"]:has-text("Export")')
        ->assertPresent('[role="menuitem"]:has-text("Keyboard shortcuts")');
});

it('lets a facilitator rename a retro from the pencil of its top bar, keeps the name on Escape, refuses an empty one, and shows the new name to a participant who has no pencil', function () {
    ['team' => $team, 'facilitator' => $facilitator, 'member' => $member] = navigationAtlas();
    $retro = navigationLiveRetro($team, $facilitator);
    $name = '[data-slot="session-frame"] header h1';
    $pencil = '[data-slot="session-frame"] header button[aria-label="Rename"]';
    $field = '[data-slot="session-frame"] header input[aria-label="Session name"]';

    $facilitatorPage = $this->awaitRealtime($this->signIn($facilitator, "/retros/{$retro->id}"));
    $memberPage = $this->awaitRealtime($this->signIn($member, "/retros/{$retro->id}"));

    $memberPage->assertSeeIn($name, 'Sprint 42 retro')
        ->assertNotPresent($pencil)
        ->assertNotPresent("{$name} button");

    $facilitatorPage->assertVisible($pencil)
        ->click($pencil)
        ->assertValue($field, 'Sprint 42 retro')
        ->fill($field, 'Not this name')
        ->keys($field, 'Escape')
        ->assertNotPresent($field)
        ->assertSeeIn($name, 'Sprint 42 retro')
        ->click($pencil)
        ->fill($field, '')
        ->keys($field, 'Enter')
        ->assertScript("document.querySelector('{$field}').validationMessage", 'The name is required.')
        ->fill($field, 'Sprint 42 retrospective')
        ->keys($field, 'Enter')
        ->assertNotPresent($field)
        ->assertSeeIn($name, 'Sprint 42 retrospective')
        ->resize(1440, 900)
        ->assertMissing($pencil)
        ->assertPresent("{$name} button");

    $memberPage->assertSeeIn($name, 'Sprint 42 retrospective');

    expect($retro->fresh()->title)->toBe('Sprint 42 retrospective');
});

it('lists the members to a plain member with no Invite, no invitation link and no row action, and offers Invite to a facilitator', function () {
    ['team' => $team, 'facilitator' => $facilitator, 'member' => $member] = navigationAtlas();
    $table = '[data-slot="members-page"] [data-test="team-members"]';

    $page = $this->signIn($member, teamPath('teams.show', $team));

    $page->click(NavigationEntries.'[aria-label="Members"]')
        ->assertPathIs(teamPath('teams.members.index', $team))
        ->assertSeeIn('[data-slot="members-page"] h1', 'Members · 3')
        ->assertCount("{$table} [data-member-id]", 3)
        ->assertSeeIn("{$table} [data-member-id=\"{$facilitator->id}\"]", 'Facilitator')
        ->assertPresent("{$table} [data-member-id=\"{$member->id}\"] [data-test=\"member-last-activity\"]")
        ->assertNotPresent('[data-slot="members-page"] button:has-text("Invite")')
        ->assertNotPresent('[data-slot="members-page"] button:has-text("Invitation link")')
        ->assertNotPresent('[aria-label="Member actions"]')
        ->assertNotPresent('[aria-label^="Role of"]')
        ->assertNotPresent('[data-slot="members-page"] button:has-text("Add a member")');

    $this->signIn($facilitator, teamPath('teams.members.index', $team))
        ->assertPresent('[data-slot="members-page"] button:has-text("Invitation link")')
        ->assertPresent('[data-slot="members-page"] button:has(span:text-is("Invite"))')
        ->assertNotPresent('[aria-label="Member actions"]');
});

it('opens Activity from the sidebar and keeps the lines of the Actions chip, then of one day', function () {
    ['team' => $team, 'facilitator' => $facilitator, 'member' => $member] = navigationAtlas();
    $yesterday = now((string) config('app.timezone'))->subDay();
    $lines = '[data-slot="activity-page"] [data-test="activity-line"]';
    $days = '[data-slot="activity-page"] [data-slot="load-more-feed"] h2';
    $chip = fn (string $label): string => "[data-slot=\"activity-page\"] nav[aria-label=\"Kinds\"] a:text-is(\"{$label}\")";

    foreach ([
        [TeamActivityKind::ActionItemCompleted, $member, 'Fix CI', now()],
        [TeamActivityKind::MemberJoined, $member, null, now()],
        [TeamActivityKind::ActionItemCompleted, $facilitator, 'Write the runbook', $yesterday],
    ] as [$kind, $actor, $subject, $at]) {
        TeamActivity::factory()->for($team)->create([
            'kind' => $kind,
            'actor_user_id' => $actor->id,
            'subject_title' => $subject,
            'created_at' => $at,
        ]);
    }

    $page = $this->signIn($member, teamPath('teams.show', $team));

    $page->assertSeeIn('#activity h2', 'Recent activity')
        ->click(NavigationEntries.'[aria-label="Activity"]')
        ->assertPathIs(teamPath('teams.activity.index', $team))
        ->assertSeeIn('[data-slot="activity-page"] h1', 'Activity')
        ->assertAttribute($chip('All'), 'aria-current', 'page')
        ->assertCount($lines, 3)
        ->assertScript('[...document.querySelectorAll(\''.$days.'\')].map((day) => day.textContent).join(",")', 'Today,Yesterday')
        ->assertSeeIn('[data-slot="load-more-end"]', "You're all caught up · 3 events");

    $page->click($chip('Actions'))
        ->assertQueryStringHas('group', 'actions')
        ->assertAttribute($chip('Actions'), 'aria-current', 'page')
        ->assertCount($lines, 2)
        ->assertDontSeeIn('[data-slot="activity-page"]', 'joined the team');

    $page->click('[data-slot="activity-page"] [data-slot="date-picker-trigger"]')
        ->click('[data-slot="date-picker-shortcuts"] button:has-text("Yesterday")')
        ->assertQueryStringHas('group', 'actions')
        ->assertQueryStringHas('day', $yesterday->toDateString())
        ->assertCount($lines, 1)
        ->assertSeeIn($lines, 'Théo Martin completed Write the runbook')
        ->assertDontSeeIn('[data-slot="activity-page"]', 'Fix CI');
});

it('starts an eNPS survey from the Insights tab, and shows the score there once three people have answered and the survey is closed', function () {
    ['team' => $team, 'admin' => $admin, 'facilitator' => $facilitator, 'member' => $member] = navigationAtlas();
    $enpsPath = teamPath('teams.enps.show', $team);
    $pick = fn (int $score): string => "[data-test=\"survey-step\"] label:has(input[value=\"{$score}\"])";

    $page = $this->signIn($facilitator, teamPath('teams.insights.show', $team));

    $page->click('nav[aria-label="Insights"] a:text-is("eNPS")')
        ->assertPathIs($enpsPath)
        ->assertAttribute('nav[aria-label="Insights"] a:text-is("eNPS")', 'aria-current', 'page')
        ->assertAttribute(NavigationEntries.'[aria-label="Insights"]', 'aria-current', 'page')
        ->assertSeeIn('[data-slot="empty-state-title"]', 'No eNPS survey has closed yet.')
        ->click('a:has-text("Start an eNPS survey")')
        ->assertPresent('[role="dialog"] #new-survey-title')
        ->assertAriaAttribute('[data-slot="survey-start-choice"][data-choice="enps"]', 'checked', 'true')
        ->assertSeeIn('[data-slot="survey-start-choice"][data-choice="enps"]', '3 questions')
        ->fill('#new-survey-title', 'eNPS October')
        ->click('[role="dialog"] button:has-text("Create & open")')
        ->assertPathEndsWith('/edit')
        ->assertCount('[data-slot="survey-builder"] [data-test="survey-question"]', 3)
        ->click('[data-slot="survey-builder-topbar"] button[aria-label="Publish"]')
        ->assertPresent('[data-slot="survey-builder-topbar"] a[aria-label="View results"]');

    $survey = TeamSurvey::query()->where('title', 'eNPS October')->sole();

    foreach ([[$admin, 10, 9], [$member, 9, 6], [$facilitator, 3, 8]] as [$person, $teamScore, $companyScore]) {
        $this->signIn($person, route('surveys.show', $survey, false))
            ->assertSee('Question 1 of 3')
            ->assertSeeIn('[data-test="survey-step"]', 'How likely are you to recommend working in this team to a friend or colleague?')
            ->click($pick($teamScore))
            ->click('Next')
            ->assertSee('Question 2 of 3')
            ->click($pick($companyScore))
            ->click('Next')
            ->assertSee('Question 3 of 3')
            ->click('Finish')
            ->assertSee('Thank you — your answers are saved.');
    }

    $page->navigate(route('surveys.results.show', $survey, false))
        ->click('[data-slot="survey-results-header"] button:has-text("Close the survey")')
        ->click('[role="alertdialog"] button:has-text("Close the survey")')
        ->assertPresent('[data-slot="survey-results-header"] a:has-text("Export CSV")');

    $page->navigate($enpsPath)
        ->assertSeeIn('[data-slot="enps-score"]', '+33')
        ->assertNotPresent('[data-slot="enps-change"]')
        ->assertSeeIn('[data-slot="enps-latest-survey"]', 'eNPS October')
        ->assertSeeIn('[data-slot="enps-latest-survey"]', '3 answers')
        ->assertAriaAttribute('[data-slot="team-enps"] section:first-of-type [data-slot="survey-nps-segments"]', 'label', '1 detractors, 0 passives, 2 promoters')
        ->assertCount('[data-slot="enps-line"]', 1)
        ->assertSeeIn('[data-slot="enps-line"]', '+33')
        ->click('[data-slot="enps-line"]')
        ->assertPathIs(route('surveys.results.show', $survey, false));

    $page->navigate(teamPath('teams.show', $team))
        ->assertSeeIn('[data-slot="team-pulse-enps"]', '+33')
        ->click('[data-slot="pulse-figure"]:has([data-slot="team-pulse-enps"])')
        ->assertPathIs($enpsPath)
        ->resize(320, 720)
        ->assertSeeIn('[data-slot="enps-score"]', '+33')
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true);
});
