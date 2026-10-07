<?php

use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\Workspace;

const SessionsIndexNav = '[data-sidebar="content"] a[data-sidebar="menu-button"]';

const SessionsIndexChips = '[data-slot="sessions-page"] nav';

const SessionsIndexLiveRows = '[data-slot="sessions-page"] > section [data-slot="session-row"]';

const SessionsIndexOtherRows = '[data-slot="sessions-page"] [data-slot="load-more-feed"] [data-slot="session-row"]';

const SessionsIndexRows = '[data-slot="sessions-page"] [data-slot="session-row"]';

const SessionsIndexTypes = '[role="dialog"] [role="radiogroup"][aria-label="Session type"]';

/**
 * Atlas of Nordlys, with Camille Roux, its workspace admin, and Malik Kone, a member.
 *
 * @return array{
 *     workspace: Workspace,
 *     team: Team,
 *     admin: User,
 *     member: User
 * }
 */
function sessionsIndexAtlas(): array
{
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $admin = User::factory()->create(['name' => 'Camille Roux', 'locale' => 'en']);
    $workspace->members()->attach($admin, ['role' => WorkspaceRole::Admin->value]);
    $team->members()->attach($admin);
    $member = teamMember($team);
    $member->update(['name' => 'Malik Kone', 'locale' => 'en']);

    return ['workspace' => $workspace, 'team' => $team, 'admin' => $admin, 'member' => $member];
}

function sessionsIndexPath(Team $team, string $query = ''): string
{
    return route('teams.sessions.index', [$team->workspace, $team], false).$query;
}

function sessionsIndexRow(string $kind, string $id): string
{
    return SessionsIndexRows."[data-kind=\"{$kind}\"][href*=\"/{$id}\"]";
}

/**
 * One session of each kind in each state of the sessions list, each a minute older than the one before,
 * plus a draft poll facilitated by another member of the team and the icebreaker and the poll of a retro, which are never listed.
 *
 * @return array<string, Retro|PokerGame|Whiteboard|GameRoom|TeamSurvey>
 */
function sessionsIndexOneOfEach(Team $team): array
{
    $sessions = [];
    $minutesAgo = 60;
    $now = now();
    $at = function () use (&$minutesAgo, $now): void {
        test()->travelTo($now->copy()->subMinutes($minutesAgo--));
    };

    $at();
    $sessions['upcomingRetro'] = Retro::factory()->for($team)->create(['title' => 'Planned retro']);
    $at();
    $sessions['upcomingPoker'] = PokerGame::factory()->for($team)->create(['title' => 'Planned refinement']);
    $at();
    $sessions['upcomingBoard'] = Whiteboard::factory()->for($team)->create(['title' => 'Empty board']);
    $at();
    $sessions['upcomingRoom'] = GameRoom::factory()->for($team)->create(['name' => 'Friday room']);
    $at();
    $sessions['draftPoll'] = TeamSurvey::factory()->for($team)->draft()->create(['title' => 'Draft pulse']);
    surveyFacilitator($sessions['draftPoll']->setRelation('team', $team));
    $at();
    $sessions['liveRetro'] = Retro::factory()->for($team)->started()->create(['title' => 'Sprint 42 retro']);
    Participant::factory()->count(3)->create(['retro_id' => $sessions['liveRetro']->id]);
    $at();
    $sessions['livePoker'] = PokerGame::factory()->for($team)->create(['title' => 'Sprint 43 refinement']);
    $tasks = PokerTask::factory()->count(4)->create(['poker_game_id' => $sessions['livePoker']->id]);
    openPokerRound($sessions['livePoker'], $tasks->first());
    $at();
    $sessions['livePoll'] = TeamSurvey::factory()->for($team)->open()->create(['title' => 'Team pulse']);
    $at();
    $sessions['finishedRetro'] = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 41 retro', 'completed_at' => now()]);
    $at();
    $sessions['finishedPoker'] = PokerGame::factory()->for($team)->ended()->create(['title' => 'Billing sizing']);
    $at();
    $sessions['finishedPoll'] = TeamSurvey::factory()->for($team)->closed()->create(['title' => 'September pulse']);
    $at();
    $sessions['finishedBoard'] = Whiteboard::factory()->for($team)->create(['title' => 'Old map']);
    WhiteboardElement::factory()->create(['whiteboard_id' => $sessions['finishedBoard']->id]);

    $sessions['retroIcebreaker'] = GameRoom::factory()->for($team)->icebreaker($sessions['liveRetro'])->create(['name' => 'Retro icebreaker']);
    $sessions['retroPoll'] = TeamSurvey::factory()->attachedTo($sessions['liveRetro'])->open()->create();

    test()->travelTo($now);

    $sessions['liveBoard'] = Whiteboard::factory()->for($team)->create(['title' => 'Q4 architecture']);
    WhiteboardElement::factory()->create(['whiteboard_id' => $sessions['liveBoard']->id]);

    test()->travelBack();

    return $sessions;
}

it('opens the Sessions page from the sidebar and lists the live sessions first, then the others, newest first, with the kind and its meta line', function () {
    ['team' => $team, 'admin' => $admin] = sessionsIndexAtlas();
    $sessions = sessionsIndexOneOfEach($team);
    $current = SessionsIndexNav.'[aria-current="page"]';
    $kinds = fn (string $rows): string => '[...document.querySelectorAll(\''.$rows.'\')].map((row) => row.dataset.kind).join(",")';

    $page = $this->signIn($admin, route('teams.show', [$team->workspace, $team], false));

    $page->click(SessionsIndexNav.'[aria-label^="Sessions"]')
        ->assertPathIs(sessionsIndexPath($team))
        ->assertSeeIn($current, 'Sessions')
        ->assertSeeIn('[data-slot="sessions-page"] h1', 'Sessions')
        ->assertSee('Retros, poker, whiteboards, polls and icebreakers of Atlas')
        ->assertAttribute(SessionsIndexChips.' a:has-text("All")', 'aria-current', 'page')
        ->assertSeeIn('[data-slot="sessions-page"] > section h2', 'Live now')
        ->assertCount(SessionsIndexLiveRows, 4)
        ->assertScript($kinds(SessionsIndexLiveRows), 'whiteboard,survey,poker,retro')
        ->assertSeeIn(sessionsIndexRow('retro', $sessions['liveRetro']->id), 'Retro · Writing · 3 people')
        ->assertSeeIn(sessionsIndexRow('poker', $sessions['livePoker']->id), 'Planning poker · 4 tasks')
        ->assertSeeIn(sessionsIndexRow('survey', $sessions['livePoll']->id), 'Poll')
        ->assertSeeIn(sessionsIndexRow('survey', $sessions['livePoll']->id).' [data-slot="session-row-outcome"]', '0 answers')
        ->assertNotPresent("[href*=\"/{$sessions['retroIcebreaker']->id}\"]")
        ->assertNotPresent("[href*=\"/{$sessions['retroPoll']->id}\"]");

    $page->assertCount(SessionsIndexOtherRows, 9)
        ->assertScript($kinds(SessionsIndexOtherRows), 'whiteboard,survey,poker,retro,survey,icebreaker,whiteboard,poker,retro')
        ->assertSeeIn(sessionsIndexRow('survey', $sessions['draftPoll']->id).' [data-slot="badge"]', 'Draft')
        ->assertSeeIn(sessionsIndexRow('retro', $sessions['upcomingRetro']->id).' [data-slot="badge"]', 'Not started')
        ->click(sessionsIndexRow('retro', $sessions['finishedRetro']->id))
        ->assertPathIs("/retros/{$sessions['finishedRetro']->id}");
});

it('shows a draft poll to its facilitator and to no other member', function () {
    ['team' => $team] = sessionsIndexAtlas();
    $draft = TeamSurvey::factory()->for($team)->draft()->create(['title' => 'Draft pulse']);
    [$editor] = surveyFacilitator($draft);
    $editor->update(['locale' => 'en']);
    $other = teamMember($team);
    $other->update(['locale' => 'en']);

    $this->signIn($editor, sessionsIndexPath($team))
        ->assertCount(SessionsIndexRows, 1)
        ->assertSeeIn(sessionsIndexRow('survey', $draft->id).' [data-slot="badge"]', 'Draft');

    $this->signIn($other, sessionsIndexPath($team))
        ->assertNotPresent(SessionsIndexRows)
        ->assertSee('No session yet');
});

it('loads 45 finished sessions twenty at a time, with no duplicate and no gap, and ends with the count', function () {
    ['team' => $team, 'admin' => $admin] = sessionsIndexAtlas();
    $expected = [];

    foreach (range(1, 45) as $index) {
        $this->travelTo(now()->subMinutes(100 - $index));

        $session = match ($index % 3) {
            0 => Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => "Retro {$index}", 'completed_at' => now()]),
            1 => PokerGame::factory()->for($team)->ended()->create(['title' => "Poker {$index}"]),
            2 => TeamSurvey::factory()->for($team)->closed()->create(['title' => "Poll {$index}"]),
        };

        $this->travelBack();

        array_unshift($expected, $session->id);
    }

    $ids = '[...document.querySelectorAll(\''.SessionsIndexRows.'\')].map((row) => row.getAttribute("href").match(/[0-9a-f-]{36}/)[0]).join(",")';

    $page = $this->signIn($admin, sessionsIndexPath($team));

    $page->assertCount(SessionsIndexRows, 20)
        ->assertSeeIn('[data-slot="load-more"]', '25 more')
        ->click('[data-slot="load-more"] button')
        ->assertCount(SessionsIndexRows, 40)
        ->assertScript('document.activeElement?.closest("article")?.getAttribute("aria-posinset")', '21')
        ->assertSeeIn('[data-slot="load-more"]', '5 more')
        ->click('[data-slot="load-more"] button')
        ->assertCount(SessionsIndexRows, 45)
        ->assertSeeIn('[data-slot="load-more-end"]', "You're all caught up · 45 sessions")
        ->assertScript($ids, implode(',', $expected))
        ->assertQueryStringMissing('before');
});

it('offers "New session" from the header and from an empty list, the same dialog as the team page, and opens it on poker from the address', function () {
    ['team' => $team, 'member' => $member] = sessionsIndexAtlas();

    $page = $this->signIn($member, sessionsIndexPath($team));

    $page->assertSee('No session yet')
        ->click('[data-slot="empty-state"] button:has-text("New session")')
        ->assertSeeIn('[role="dialog"]', 'Team Atlas')
        ->assertCount(SessionsIndexTypes.' [role="radio"]', 5)
        ->assertAttribute(SessionsIndexTypes.' [role="radio"][data-type="retro"]', 'aria-checked', 'true')
        ->click('Cancel')
        ->assertNotPresent('[role="dialog"]');

    $page->navigate(sessionsIndexPath($team, '?new=poker'))
        ->assertAttribute(SessionsIndexTypes.' [role="radio"][data-type="poker"]', 'aria-checked', 'true')
        ->assertVisible('#new-poker-title')
        ->fill('#new-poker-title', 'Sizing from Sessions')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/poker/');

    expect(PokerGame::query()->sole()->title)->toBe('Sizing from Sessions');
});

it('refuses the Sessions page to a member of another team and sends a visitor to the login', function () {
    ['workspace' => $workspace, 'team' => $team] = sessionsIndexAtlas();
    $borealis = Team::factory()->for($workspace)->create(['name' => 'Borealis']);
    $outsider = teamMember($borealis);
    $outsider->update(['locale' => 'en']);

    $this->signIn($outsider, sessionsIndexPath($team))
        ->assertPresent('[data-slot="error-page"][data-status="403"]')
        ->assertNotPresent('[data-slot="sessions-page"]');

    browserVisit(sessionsIndexPath($team))->assertPathIs('/login');
});

it('creates a retro with the standard timer per phase, offers its Writing time to the facilitator only, and counts it down for a member', function () {
    ['team' => $team, 'admin' => $admin, 'member' => $member] = sessionsIndexAtlas();

    $adminPage = $this->signIn($admin, sessionsIndexPath($team));

    $adminPage->click('[data-slot="sessions-page"] header button:has-text("New session")')
        ->fill('#new-retro-title', 'Timed retro')
        ->assertSeeIn('[role="dialog"]', 'Offered to the facilitator, never started by itself')
        ->click('#new-retro-phase-timers')
        ->click('[role="listbox"] [role="option"]:has-text("Standard")')
        ->assertSeeIn('[role="dialog"]', 'Writing 7')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/');

    $retro = Retro::query()->where('title', 'Timed retro')->sole();

    expect($retro->phase_durations)->toBeIgnoringKeyOrder(['writing' => 7, 'grouping' => 5, 'voting' => 3, 'discussing' => 15, 'actions' => 5])
        ->and($retro->timer_ends_at)->toBeNull();

    Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $member->id]);

    $this->awaitRealtime($adminPage);
    $memberPage = $this->awaitRealtime($this->signIn($member, "/retros/{$retro->id}"));

    $memberPage->assertNotPresent('[data-slot="timer-suggestion"]')
        ->assertNotPresent('[role="timer"]');

    $adminPage->assertAttribute('[data-slot="timer-suggestion"]', 'aria-label', 'Start the Writing timer, 7 minutes')
        ->assertSeeIn('[data-slot="timer-suggestion"]', '7 min')
        ->click('[aria-label="Timer"]')
        ->assertSeeIn('[role="menu"] [role="menuitem"]:first-child', 'Writing · 7 min')
        ->keys('[role="menu"]', 'Escape')
        ->click('[data-slot="timer-suggestion"]')
        ->assertPresent('[role="timer"]')
        ->assertNotPresent('[data-slot="timer-suggestion"]');

    $memberPage->assertPresent('[role="timer"]')
        ->assertNotPresent('[data-slot="timer-suggestion"]');

    $retro->refresh();

    expect($retro->timer_ends_at)->not->toBeNull()
        ->and((int) round($retro->timer_ends_at->diffInSeconds(now(), true) / 60))->toBe(7);
});

it('lets the facilitator turn the timer per phase off from the settings, and the offer goes', function () {
    ['team' => $team, 'admin' => $admin] = sessionsIndexAtlas();
    $retro = Retro::factory()->for($team)->create(['title' => 'Custom retro', 'phase_durations' => ['writing' => 4]]);
    $retro->forceFill(['facilitator_participant_id' => Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $admin->id])->id])->save();

    $page = $this->awaitRealtime($this->signIn($admin, "/retros/{$retro->id}"));

    $page->assertSeeIn('[data-slot="timer-suggestion"]', '4 min')
        ->click('[aria-label="Facilitator menu"]')
        ->click('Settings…')
        ->click('#retro-phase-timers')
        ->click('[role="listbox"] [role="option"]:has-text("No timer")')
        ->click('button:has-text("Apply")')
        ->assertNotPresent('[data-slot="timer-suggestion"]');

    expect($retro->fresh()->phase_durations)->toBeNull();
});

it('fits the Sessions page on a phone: full-width rows, scrolling chips, "New session" in the header, no horizontal scroll', function () {
    ['team' => $team, 'admin' => $admin] = sessionsIndexAtlas();
    sessionsIndexOneOfEach($team);

    $page = $this->signIn($admin, sessionsIndexPath($team))->resize(390, 844);

    $page->assertCount(SessionsIndexRows, 13)
        ->assertVisible('[data-slot="sessions-page"] header button[aria-label="New session"]')
        ->assertScript('getComputedStyle(document.querySelector(\''.SessionsIndexChips.'\')).overflowX', 'auto')
        ->assertScript('Math.round(document.querySelector(\''.SessionsIndexRows.'\').parentElement.getBoundingClientRect().width) >= 390 - 2 * 24', true);

    expect($this->overflowingElements($page))->toBe([]);
});

it('draws the Sessions page in the dark theme', function () {
    ['team' => $team, 'admin' => $admin] = sessionsIndexAtlas();
    sessionsIndexOneOfEach($team);

    $page = $this->signIn($admin, sessionsIndexPath($team), ['colorScheme' => 'dark']);

    $page->assertCount(SessionsIndexRows, 13)
        ->assertScript('document.documentElement.classList.contains("dark")', true)
        ->assertScript('getComputedStyle(document.body).backgroundColor !== "rgb(255, 255, 255)"', true)
        ->assertScript('getComputedStyle(document.querySelector(\''.SessionsIndexRows.'\')).backgroundColor !== "rgb(255, 255, 255)"', true);
});

it('speaks the language of the viewer on the Sessions page', function (string $locale, string $heading, string $liveNow, string $meta) {
    ['team' => $team, 'admin' => $admin] = sessionsIndexAtlas();
    $sessions = sessionsIndexOneOfEach($team);
    $admin->update(['locale' => $locale]);

    $page = $this->signIn($admin, sessionsIndexPath($team));

    $page->assertSeeIn('[data-slot="sessions-page"] h1', $heading)
        ->assertSeeIn('[data-slot="sessions-page"] > section h2', $liveNow)
        ->assertSeeIn(sessionsIndexRow('poker', $sessions['livePoker']->id), $meta)
        ->assertScript('document.documentElement.lang', $locale);
})->with([
    'English' => ['en', 'Sessions', 'Live now', 'Planning poker · 4 tasks'],
    'French' => ['fr', 'Sessions', 'En direct maintenant', 'Planning poker · 4 tâches'],
    'Spanish' => ['es', 'Sesiones', 'En vivo ahora', 'Planning poker · 4 tareas'],
    'German' => ['de', 'Sitzungen', 'Jetzt live', 'Planning Poker · 4 Aufgaben'],
]);

it('searches the sessions from the topbar field, keeps the search across the chips and clears it from an empty result', function () {
    ['team' => $team, 'member' => $member] = sessionsIndexAtlas();
    Retro::factory()->for($team)->started()->create(['title' => 'Sprint 42 retro']);
    Retro::factory()->for($team)->started()->create(['title' => 'Release review']);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 41 retro']);
    $search = 'header input[type="search"][aria-label="Search sessions"]';

    $page = $this->signIn($member, sessionsIndexPath($team));

    $page->assertCount(SessionsIndexRows, 3)
        ->typeSlowly($search, 'sprint')
        ->assertQueryStringHas('q', 'sprint')
        ->assertCount(SessionsIndexRows, 2)
        ->assertSeeIn(SessionsIndexLiveRows, 'Sprint 42 retro')
        ->click(SessionsIndexChips.' a:has-text("Retro")')
        ->assertQueryStringHas('kind', 'retro')
        ->assertQueryStringHas('q', 'sprint')
        ->assertSeeIn(SessionsIndexOtherRows, 'Sprint 41 retro');

    $page->navigate(sessionsIndexPath($team, '?q=zebra'))
        ->assertSee('No session matches “zebra”.')
        ->click('[data-slot="empty-state"] a:has-text("Clear the search")')
        ->assertQueryStringMissing('q')
        ->assertCount(SessionsIndexRows, 3);
});
