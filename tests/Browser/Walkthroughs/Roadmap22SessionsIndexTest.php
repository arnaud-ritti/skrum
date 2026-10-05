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

const R22sNav = '[data-sidebar="content"] a[data-sidebar="menu-button"]';

const R22sTabs = '[data-slot="sessions-page"] nav';

const R22sRows = '[data-slot="sessions-page"] [data-slot="session-row"]';

const R22sTypes = '[role="dialog"] [role="radiogroup"][aria-label="Session type"]';

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
function r22sAtlas(): array
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

function r22sPath(Team $team, string $query = ''): string
{
    return route('teams.sessions.index', [$team->workspace, $team], false).$query;
}

function r22sRow(string $kind, string $id): string
{
    return R22sRows."[data-kind=\"{$kind}\"][href*=\"/{$id}\"]";
}

/**
 * One session of each kind in each state of spec plan 22 §6.1, each a minute older than the one before,
 * plus a draft poll facilitated by another member of the team and the icebreaker and the poll of a retro, which are never listed.
 *
 * @return array<string, Retro|PokerGame|Whiteboard|GameRoom|TeamSurvey>
 */
function r22sOneOfEach(Team $team): array
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

it('[R22S-01] opens the Live tab from the sidebar and lists each state in its tab, newest first, with the kind and its meta line', function () {
    ['team' => $team, 'admin' => $admin] = r22sAtlas();
    $sessions = r22sOneOfEach($team);
    $current = R22sNav.'[aria-current="page"]';

    $page = $this->signIn($admin, route('teams.show', [$team->workspace, $team], false));

    $page->click(R22sNav.'[aria-label="Sessions"]')
        ->assertPathIs(r22sPath($team))
        ->assertSeeIn($current, 'Sessions')
        ->assertSeeIn('[data-slot="sessions-page"] h1', 'Sessions')
        ->assertSee('Retros, poker, whiteboards, polls and icebreakers of Atlas')
        ->assertAttribute(R22sTabs.' a:text-is("Live")', 'aria-current', 'page')
        ->assertCount(R22sRows, 4)
        ->assertScript('[...document.querySelectorAll(\''.R22sRows.'\')].map((row) => row.dataset.kind).join(",")', 'whiteboard,survey,poker,retro')
        ->assertSeeIn(r22sRow('retro', $sessions['liveRetro']->id), 'Retro · Writing · 3 people')
        ->assertSeeIn(r22sRow('poker', $sessions['livePoker']->id), 'Planning poker · 4 tasks')
        ->assertSeeIn(r22sRow('survey', $sessions['livePoll']->id), 'Poll · 0 answers')
        ->assertNotPresent("[href*=\"/{$sessions['retroIcebreaker']->id}\"]")
        ->assertNotPresent("[href*=\"/{$sessions['retroPoll']->id}\"]");

    $page->click(R22sTabs.' a:text-is("Upcoming")')
        ->assertQueryStringHas('tab', 'upcoming')
        ->assertAttribute(R22sTabs.' a:text-is("Upcoming")', 'aria-current', 'page')
        ->assertCount(R22sRows, 5)
        ->assertScript('[...document.querySelectorAll(\''.R22sRows.'\')].map((row) => row.dataset.kind).join(",")', 'survey,icebreaker,whiteboard,poker,retro')
        ->assertSeeIn(r22sRow('survey', $sessions['draftPoll']->id).' [data-slot="badge"]', 'Draft');

    $page->click(R22sTabs.' a:text-is("Finished")')
        ->assertQueryStringHas('tab', 'finished')
        ->assertCount(R22sRows, 4)
        ->assertScript('[...document.querySelectorAll(\''.R22sRows.'\')].map((row) => row.dataset.kind).join(",")', 'whiteboard,survey,poker,retro')
        ->click(r22sRow('retro', $sessions['finishedRetro']->id))
        ->assertPathIs("/retros/{$sessions['finishedRetro']->id}");
});

it('[R22S-02] shows a draft poll in Upcoming to its facilitator and to no other member', function () {
    ['team' => $team] = r22sAtlas();
    $draft = TeamSurvey::factory()->for($team)->draft()->create(['title' => 'Draft pulse']);
    [$editor] = surveyFacilitator($draft);
    $editor->update(['locale' => 'en']);
    $other = teamMember($team);
    $other->update(['locale' => 'en']);

    $this->signIn($editor, r22sPath($team, '?tab=upcoming'))
        ->assertCount(R22sRows, 1)
        ->assertSeeIn(r22sRow('survey', $draft->id).' [data-slot="badge"]', 'Draft');

    $this->signIn($other, r22sPath($team, '?tab=upcoming'))
        ->assertNotPresent(R22sRows)
        ->assertSee('No upcoming session');
});

it('[R22S-03] loads 45 finished sessions twenty at a time, with no duplicate and no gap, and ends with the count', function () {
    ['team' => $team, 'admin' => $admin] = r22sAtlas();
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

    $ids = '[...document.querySelectorAll(\''.R22sRows.'\')].map((row) => row.getAttribute("href").match(/[0-9a-f-]{36}/)[0]).join(",")';

    $page = $this->signIn($admin, r22sPath($team, '?tab=finished'));

    $page->assertCount(R22sRows, 20)
        ->assertSeeIn('[data-slot="load-more"]', '25 more')
        ->click('[data-slot="load-more"] button')
        ->assertCount(R22sRows, 40)
        ->assertScript('document.activeElement?.closest("article")?.getAttribute("aria-posinset")', '21')
        ->assertSeeIn('[data-slot="load-more"]', '5 more')
        ->click('[data-slot="load-more"] button')
        ->assertCount(R22sRows, 45)
        ->assertSeeIn('[data-slot="load-more-end"]', "You're all caught up · 45 sessions")
        ->assertScript($ids, implode(',', $expected))
        ->assertQueryStringHas('tab', 'finished')
        ->assertQueryStringMissing('before');
});

it('[R22S-04] offers "New session" from the header and from an empty tab, the same dialog as the team page, and opens it on poker from the address', function () {
    ['team' => $team, 'member' => $member] = r22sAtlas();

    $page = $this->signIn($member, r22sPath($team, '?tab=upcoming'));

    $page->assertSee('No upcoming session')
        ->click('[data-slot="empty-state"] button:has-text("New session")')
        ->assertSeeIn('[role="dialog"]', 'Team Atlas')
        ->assertCount(R22sTypes.' [role="radio"]', 5)
        ->assertAttribute(R22sTypes.' [role="radio"][data-type="retro"]', 'aria-checked', 'true')
        ->click('Cancel')
        ->assertNotPresent('[role="dialog"]');

    $page->navigate(r22sPath($team, '?new=poker'))
        ->assertAttribute(R22sTypes.' [role="radio"][data-type="poker"]', 'aria-checked', 'true')
        ->assertVisible('#new-poker-title')
        ->fill('#new-poker-title', 'Sizing from Sessions')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/poker/');

    expect(PokerGame::query()->sole()->title)->toBe('Sizing from Sessions');
});

it('[R22S-05] refuses the Sessions page to a member of another team and sends a visitor to the login', function () {
    ['workspace' => $workspace, 'team' => $team] = r22sAtlas();
    $borealis = Team::factory()->for($workspace)->create(['name' => 'Borealis']);
    $outsider = teamMember($borealis);
    $outsider->update(['locale' => 'en']);

    $this->signIn($outsider, r22sPath($team))
        ->assertPresent('[data-slot="error-page"][data-status="403"]')
        ->assertNotPresent('[data-slot="sessions-page"]');

    visit(r22sPath($team))->assertPathIs('/login');
});

it('[R22S-06] creates a retro with the standard timer per phase, offers its Writing time to the facilitator only, and counts it down for a member', function () {
    ['team' => $team, 'admin' => $admin, 'member' => $member] = r22sAtlas();

    $adminPage = $this->signIn($admin, r22sPath($team));

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

it('[R22S-07] lets the facilitator turn the timer per phase off from the settings, and the offer goes', function () {
    ['team' => $team, 'admin' => $admin] = r22sAtlas();
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

it('[R22S-08] fits the Sessions page on a phone: full-width rows, scrolling tabs, "New session" in the header, no horizontal scroll', function () {
    ['team' => $team, 'admin' => $admin] = r22sAtlas();
    r22sOneOfEach($team);

    $page = $this->signIn($admin, r22sPath($team))->resize(390, 844);

    $page->assertCount(R22sRows, 4)
        ->assertVisible('[data-slot="sessions-page"] header button[aria-label="New session"]')
        ->assertScript('getComputedStyle(document.querySelector(\''.R22sTabs.'\')).overflowX', 'auto')
        ->assertScript('Math.round(document.querySelector(\''.R22sRows.'\').getBoundingClientRect().width) >= 390 - 2 * 24', true);

    expect($this->overflowingElements($page))->toBe([]);
});

it('[R22S-09] draws the Sessions page in the dark theme', function () {
    ['team' => $team, 'admin' => $admin] = r22sAtlas();
    r22sOneOfEach($team);

    $page = $this->signIn($admin, r22sPath($team), ['colorScheme' => 'dark']);

    $page->assertCount(R22sRows, 4)
        ->assertScript('document.documentElement.classList.contains("dark")', true)
        ->assertScript('getComputedStyle(document.body).backgroundColor !== "rgb(255, 255, 255)"', true)
        ->assertScript('getComputedStyle(document.querySelector(\''.R22sRows.'\')).backgroundColor !== "rgb(255, 255, 255)"', true);
});

it('[R22S-10] speaks the language of the viewer on the Sessions page', function (string $locale, string $heading, string $liveTab, string $meta) {
    ['team' => $team, 'admin' => $admin] = r22sAtlas();
    $sessions = r22sOneOfEach($team);
    $admin->update(['locale' => $locale]);

    $page = $this->signIn($admin, r22sPath($team));

    $page->assertSeeIn('[data-slot="sessions-page"] h1', $heading)
        ->assertSeeIn(R22sTabs.' a[aria-current="page"]', $liveTab)
        ->assertSeeIn(r22sRow('poker', $sessions['livePoker']->id), $meta)
        ->assertScript('document.documentElement.lang', $locale);
})->with([
    'English' => ['en', 'Sessions', 'Live', 'Planning poker · 4 tasks'],
    'French' => ['fr', 'Sessions', 'En cours', 'Planning poker · 4 tâches'],
    'Spanish' => ['es', 'Sesiones', 'En curso', 'Planning poker · 4 tareas'],
    'German' => ['de', 'Sitzungen', 'Laufend', 'Planning Poker · 4 Aufgaben'],
]);
