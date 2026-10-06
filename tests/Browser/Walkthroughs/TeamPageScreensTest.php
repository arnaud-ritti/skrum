<?php

use App\Enums\RetroPhase;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;

const TeamPageScreensNav = '[data-sidebar="content"] a[data-sidebar="menu-button"]';

function teamPageScreensTeamUser(Team $team, string $name, WorkspaceRole $role = WorkspaceRole::Member): User
{
    $user = User::factory()->create(['name' => $name, 'locale' => 'en']);
    $team->workspace->members()->attach($user, ['role' => $role->value]);
    $team->members()->attach($user);

    return $user;
}

/**
 * @param  list<array<string, int>>  $healthScoresByVoter
 * @param  list<int>  $rotiScores
 */
function teamPageScreensCompletedRetro(Team $team, string $title, int $daysAgo, array $healthScoresByVoter, array $rotiScores): Retro
{
    $retro = Retro::factory()->for($team)->withHealthCheck()->inPhase(RetroPhase::Completed)->create([
        'title' => $title,
        'completed_at' => now()->subDays($daysAgo),
    ]);

    foreach ($healthScoresByVoter as $scores) {
        answerHealthCheck($retro, Participant::factory()->create(['retro_id' => $retro->id]), $scores);
    }

    closeHealthCheck($retro);

    foreach ($rotiScores as $score) {
        RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => $score]);
    }

    return $retro;
}

it('lands on the sessions, the mood and the members of the team from the sidebar, opens the Sessions page from its entry, and marks the entry in use', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $alice = teamPageScreensTeamUser($team, 'Alice Martin');
    $current = TeamPageScreensNav.'[aria-current="page"]';
    $entry = fn (string $label): string => TeamPageScreensNav."[aria-label=\"{$label}\"]";

    $page = $this->signIn($alice, teamPath('teams.show', $team));

    $page->assertSeeIn('[data-slot="team-header"] h1', 'Atlas')
        ->assertSeeIn('nav[aria-label="Breadcrumb"]', 'Teams')
        ->assertCount($current, 1)
        ->assertSeeIn($current, 'Dashboard')
        ->assertPresent('#sessions')
        ->assertPresent('#mood')
        ->assertPresent('#members');

    foreach (['Mood & ROTI' => 'mood', 'Members' => 'members'] as $label => $anchor) {
        $page->click($entry($label))
            ->assertScript('window.location.hash', "#{$anchor}")
            ->assertPathIs(teamPath('teams.show', $team))
            ->assertCount($current, 1)
            ->assertSeeIn($current, $label)
            ->assertScript("(() => { const top = document.getElementById('{$anchor}').getBoundingClientRect().top; return top >= 0 && top < window.innerHeight; })()", true);
    }

    $page->click($entry('Dashboard'))
        ->assertScript('window.location.hash', '')
        ->assertSeeIn($current, 'Dashboard');

    $page->click($entry('Sessions'))
        ->assertPathIs(route('teams.sessions.index', [$team->workspace, $team], false))
        ->assertCount($current, 1)
        ->assertSeeIn($current, 'Sessions')
        ->assertSeeIn('[data-slot="sessions-page"] h1', 'Sessions');
})->skip('navigation redesign: awaiting the owner');

it('shows the phase of a retro, its ROTI once closed, and opens it', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $alice = teamPageScreensTeamUser($team, 'Alice Martin');
    $camille = teamPageScreensTeamUser($team, 'Camille Roux');

    $this->travelTo(now()->subDays(3));
    $closed = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create([
        'title' => 'Sprint 41 retrospective',
        'template' => 'start_stop_continue',
        'completed_at' => now(),
    ]);
    $this->travelBack();
    $open = Retro::factory()->for($team)->inPhase(RetroPhase::Writing)->started()->create([
        'title' => 'Sprint 42 retrospective',
        'template' => 'mad_sad_glad',
    ]);
    $open->update(['facilitator_participant_id' => Participant::factory()->create(['retro_id' => $open->id, 'user_id' => $camille->id])->id]);

    foreach ([4, 5, 4] as $score) {
        RotiVote::factory()->create(['retro_id' => $closed->id, 'score' => $score]);
    }

    $openRow = "[data-slot=\"session-row\"][href$=\"/retros/{$open->id}\"]";
    $closedRow = "[data-slot=\"session-row\"][href$=\"/retros/{$closed->id}\"]";

    $page = $this->signIn($alice, route('teams.sessions.index', [$team->workspace, $team, 'kind' => 'retro'], false));

    $page->assertSeeIn($openRow, 'Retro · Writing · 1 person')
        ->assertSeeIn($openRow, 'Live')
        ->assertPresent("[data-slot=\"card\"]:has({$openRow}) a:text-is(\"Join\")")
        ->assertNotPresent("{$openRow} [data-slot=\"session-row-outcome\"]:has-text(\"ROTI\")")
        ->assertSeeIn($closedRow, 'Completed')
        ->assertSeeIn("{$closedRow} [data-slot=\"session-row-outcome\"]", 'ROTI 4.3')
        ->assertNotPresent("[data-slot=\"card\"]:has({$closedRow}) a:text-is(\"Join\")")
        ->assertNotPresent('button:has-text("New retrospective")')
        ->click($openRow)
        ->assertPathIs("/retros/{$open->id}");
});

it('lists active and ended games, says how many players are in the room, and turns a row into a card on a phone', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $game = PokerGame::factory()->for($team)->create(['title' => 'Sprint 43 refinement']);
    PokerGame::factory()->for($team)->ended()->create(['title' => 'Mobile app spikes']);
    PokerTask::factory()->count(2)->create(['poker_game_id' => $game->id]);
    PokerTask::factory()->estimated('5')->create(['poker_game_id' => $game->id]);
    [$ada] = pokerFacilitator($game);
    [$bob] = pokerMember($game);
    $ada->forceFill(['name' => 'Ada Facilitator', 'locale' => 'en'])->save();
    $bob->forceFill(['name' => 'Bob Member', 'locale' => 'en'])->save();
    $cy = teamPageScreensTeamUser($team, 'Cy Watcher');
    $row = fn (string $title): string => "[data-slot=\"team-poker-game\"]:has-text(\"{$title}\")";
    $display = fn (string $title): string => "getComputedStyle(Array.from(document.querySelectorAll('[data-slot=\"team-poker-game\"]')).find((row) => row.textContent.includes('{$title}'))).display";

    $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    $page = $this->signIn($cy, teamPath('teams.show', $team));

    $page->assertSee('Active games · 1')
        ->assertSee('Ended games · 1')
        ->assertSeeIn($row('Sprint 43 refinement'), '3 tasks · 1 estimated · 5 points')
        ->assertSeeIn($row('Sprint 43 refinement'), '2 in the room')
        ->assertSeeIn($row('Sprint 43 refinement').' a[data-slot="button"]', 'Join')
        ->assertDontSeeIn($row('Mobile app spikes'), 'in the room')
        ->assertSeeIn($row('Mobile app spikes').' a[data-slot="button"]', 'Open the game')
        ->assertNotPresent('[data-slot="poker-presence-loading"]')
        ->assertScript($display('Sprint 43 refinement'), 'table-row')
        ->resize(390, 844)
        ->assertScript($display('Sprint 43 refinement'), 'grid')
        ->assertSeeIn($row('Sprint 43 refinement'), '2 in the room')
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true)
        ->click($row('Sprint 43 refinement').' a[data-slot="button"]')
        ->assertPathIs("/poker/{$game->id}");
})->skip('navigation redesign: awaiting the owner');

it('reads "Resume" on the open retro the viewer has joined and "Join" on the others', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $alice = teamPageScreensTeamUser($team, 'Alice Martin');
    $camille = teamPageScreensTeamUser($team, 'Camille Roux');
    $joined = Retro::factory()->for($team)->inPhase(RetroPhase::Voting)->create(['title' => 'Sprint 42 retrospective']);
    $other = Retro::factory()->for($team)->inPhase(RetroPhase::Writing)->create(['title' => 'Q3 release post-mortem']);
    Participant::factory()->create(['retro_id' => $joined->id, 'user_id' => $alice->id]);
    Participant::factory()->create(['retro_id' => $other->id, 'user_id' => $camille->id]);

    $joinedCard = "[data-slot=\"team-retros\"] a[href=\"/retros/{$joined->id}\"]";
    $otherCard = "[data-slot=\"team-retros\"] a[href=\"/retros/{$other->id}\"]";

    $page = $this->signIn($alice, teamPath('teams.show', $team));

    $page->assertPresent("{$joinedCard} span:text-is(\"Resume\")")
        ->assertNotPresent("{$joinedCard} span:text-is(\"Join\")")
        ->assertPresent("{$otherCard} span:text-is(\"Join\")")
        ->assertNotPresent("{$otherCard} span:text-is(\"Resume\")");
})->skip('navigation redesign: awaiting the owner');

it('lets a manager rename the team from the General tab the Settings entry leads to, and gives a member no control over it', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $admin = teamPageScreensTeamUser($team, 'Camille Roux', WorkspaceRole::Admin);
    $member = teamPageScreensTeamUser($team, 'Alice Martin');
    $settings = TeamPageScreensNav.'[aria-label="Settings"]';
    $settingsPath = route('teams.settings.show', [$team->workspace, $team], false);

    $page = $this->signIn($admin, teamPath('teams.show', $team));

    $page->assertPresent($settings)
        ->assertNotPresent('[data-slot="team-settings"]')
        ->assertNotPresent('main input[name="name"]')
        ->assertDontSeeIn('[data-slot="team-header"]', 'Integrations')
        ->click($settings)
        ->assertPathIs($settingsPath)
        ->assertSeeIn('[data-slot="team-settings-shell"] h1', 'Atlas')
        ->assertValue('#team-name', 'Atlas')
        ->fill('#team-name', 'Borealis')
        ->click('[data-slot="team-settings-shell"] button[type="submit"]:has-text("Save")')
        ->assertSeeIn('[data-slot="team-settings-shell"] h1', 'Borealis')
        ->assertSeeIn('[data-sidebar="header"]', 'Borealis');

    expect($team->refresh()->name)->toBe('Borealis');

    $memberPage = $this->signIn($member, teamPath('teams.show', $team));

    $memberPage->assertSeeIn('[data-slot="team-header"] h1', 'Borealis')
        ->assertNotPresent($settings)
        ->assertNotPresent('[data-slot="team-settings"]')
        ->assertNotPresent('main input[name="name"]')
        ->assertDontSee('Delete team')
        ->navigate($settingsPath)
        ->assertPresent('[data-slot="error-page"][data-status="403"]')
        ->assertNotPresent('[data-slot="team-settings-shell"]');
});

it('adds a member with a role on the Members page, and deletes the team from its General tab after a confirmation', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $admin = teamPageScreensTeamUser($team, 'Camille Roux', WorkspaceRole::Admin);
    $bob = teamPageScreensTeamUser($team, 'Bob Member');
    $olga = User::factory()->create(['name' => 'Olga Nowak', 'locale' => 'en']);
    $workspace->members()->attach($olga, ['role' => WorkspaceRole::Member->value]);
    $members = '#members [data-test="team-members"]';
    $addMember = '#add-member [role="combobox"][aria-label="Add a member"]';

    $page = $this->signIn($admin, teamPath('teams.show', $team));

    $page->click(TeamPageScreensNav.'[aria-label="Members"]')
        ->assertPathIs(teamPath('teams.members.index', $team))
        ->assertSeeIn($members, 'Bob Member')
        ->assertDontSeeIn($members, 'Olga Nowak')
        ->click($addMember)
        ->click('[role="option"]:has-text("Olga Nowak")')
        ->click('#add-member [role="combobox"][aria-label="Add as"]')
        ->click('[role="option"]:has-text("Facilitator")')
        ->click('#add-member button[type="submit"]')
        ->assertSeeIn("{$members} [aria-label=\"Role of Olga Nowak\"]", 'Facilitator')
        ->assertNotPresent($addMember);

    expect($team->roleOf($olga))->toBe(TeamRole::Facilitator);

    $page->click(TeamPageScreensNav.'[aria-label="Settings"]')
        ->click('[data-slot="team-settings"] button:has-text("Delete team")')
        ->assertSeeIn('[role="alertdialog"]', 'Delete this team?')
        ->click('[role="alertdialog"] button:has-text("Delete team")')
        ->assertPathIs("/w/{$workspace->slug}");

    expect(Team::query()->whereKey($team->id)->exists())->toBeFalse();
});

it('sends a member of a workspace without a team to the workspace page, with its sidebar', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $alice = User::factory()->create(['name' => 'Alice Martin', 'locale' => 'en']);
    $workspace->members()->attach($alice, ['role' => WorkspaceRole::Member->value]);

    $page = $this->signIn($alice, '/dashboard');

    $page->assertPathIs("/w/{$workspace->slug}")
        ->assertSee('Nordlys')
        ->assertPresent('[data-sidebar="content"]')
        ->assertPresent('[data-sidebar="content"] a[data-sidebar="menu-button"]');
});

it('opens the "…" menu of a section with the keyboard, on its entry', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $alice = teamPageScreensTeamUser($team, 'Alice Martin');
    $focused = 'document.activeElement?.textContent.trim()';

    $page = $this->signIn($alice, teamPath('teams.show', $team));

    $page->assertDontSee('Saved decks')
        ->assertSee('Estimation history')
        ->keys('[aria-label="Planning poker actions"]', 'Enter')
        ->assertCount('[role="menu"] [role="menuitem"]', 1)
        ->assertScript($focused, 'Saved decks')
        ->keys('[role="menuitem"]', 'Escape')
        ->assertNotPresent('[role="menu"]')
        ->assertScript('document.activeElement?.getAttribute("aria-label")', 'Planning poker actions')
        ->assertDontSee('Whiteboard templates')
        ->keys('[aria-label="Whiteboards actions"]', 'Enter')
        ->assertCount('[role="menu"] [role="menuitem"]', 1)
        ->assertScript($focused, 'Whiteboard templates')
        ->keys('[role="menuitem"]', 'Enter')
        ->assertSeeIn('[role="dialog"]', 'No whiteboard templates yet.')
        ->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]')
        ->assertScript('document.activeElement?.getAttribute("aria-label")', 'Whiteboards actions');

    $page->keys('[aria-label="Planning poker actions"]', 'Enter')
        ->keys('[role="menuitem"]', 'Enter')
        ->assertPathEndsWith('/poker-decks');
})->skip('navigation redesign: awaiting the owner');

it('draws the ROTI of the last retros on Insights after a skeleton on Home, the mood as a chart and as a table on the health check tab, and says when a team has none', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $empty = Team::factory()->for($team->workspace)->create(['name' => 'Borealis']);
    $alice = teamPageScreensTeamUser($team, 'Alice Martin');
    $empty->members()->attach($alice);
    $older = teamPageScreensCompletedRetro($team, 'Sprint 41 retrospective', 10, [['vision' => 3, 'motivation' => 4], ['vision' => 4, 'motivation' => 4]], [4, 4, 3]);
    $newer = teamPageScreensCompletedRetro($team, 'Sprint 42 retrospective', 3, [['vision' => 4, 'motivation' => 5]], [4, 5, 5, 4]);
    $pulse = '[data-slot="team-page"] [data-slot="team-pulse"]';
    $roti = '[data-slot="team-roti"]';
    $mood = '[data-slot="team-health-check"] [data-slot="team-mood"]';
    $tabs = '[data-slot="insights-tabs"] nav';
    $insightsPath = fn (Team $of): string => route('teams.insights.show', [$of->workspace, $of], false);
    $healthCheckPath = fn (Team $of): string => route('teams.healthCheck.show', [$of->workspace, $of], false);
    $rows = "Array.from(document.querySelectorAll('[data-slot=\"mood-trend-table\"] tbody tr')).map((row) => Array.from(row.children).map((cell) => cell.textContent.trim()).join(' | ')).join(' / ')";

    $page = $this->signIn($alice, "/w/{$team->workspace->slug}");

    $page->script(<<<'JS'
        (() => {
            window.__sawMoodSkeleton = false;
            new MutationObserver(() => {
                if (document.querySelector('[data-slot="team-page"] [data-slot="team-trend-loading"]')) {
                    window.__sawMoodSkeleton = true;
                }
            }).observe(document.body, { childList: true, subtree: true });
        })()
    JS);

    $page->click('main a[href="'.teamPath('teams.show', $team).'"]')
        ->assertPathIs(teamPath('teams.show', $team))
        ->assertSeeIn("{$pulse} h2", 'Team pulse')
        ->assertNotPresent('[data-slot="team-page"] [data-slot="team-trend-loading"]')
        ->assertScript('window.__sawMoodSkeleton', true)
        ->assertSeeIn("{$pulse} [data-slot=\"team-pulse-roti\"]", '4.5')
        ->assertSeeIn("{$pulse} [data-slot=\"team-pulse-delta\"]", '+0.8 since')
        ->assertNotPresent('[data-slot="team-page"] [role="tab"]')
        ->assertNotPresent('[data-slot="team-page"] [data-slot="mood-trend-chart"]')
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true);

    $page->click("{$pulse} a:has-text(\"Insights\")")
        ->assertPathIs($insightsPath($team))
        ->assertAttribute("{$tabs} a:has-text(\"Mood & ROTI\")", 'aria-current', 'page')
        ->assertSeeIn("{$roti} h2", 'Mood trend')
        ->assertSeeIn($roti, 'Average ROTI at the end of the retro, out of 5')
        ->assertCount("{$roti} [data-slot=\"roti-trend-point\"]", 2)
        ->assertPresent("{$roti} [data-slot=\"roti-trend-area\"]")
        ->assertSeeIn("{$roti} [data-slot=\"roti-trend-bubble\"]", '4.5 / 5')
        ->assertSeeIn("{$roti} [data-slot=\"roti-trend-delta\"]", '+0.8 since')
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true);

    $page->click("{$tabs} a:has-text(\"Health check\")")
        ->assertPathIs($healthCheckPath($team))
        ->assertSeeIn('[data-slot="team-health-check"] h2', 'Health check')
        ->assertSeeIn("{$mood} h2", 'Mood trend')
        ->assertNotPresent("{$mood} [role=\"tab\"]:has-text(\"ROTI\")")
        ->assertCount("{$mood} [data-slot=\"mood-trend-point\"]", 2)
        ->assertSeeIn("{$mood} [data-slot=\"mood-trend-kpi\"]", '4.5/5')
        ->assertSeeIn("{$mood} [data-slot=\"mood-trend-delta\"]", '+0.7 since the previous retro')
        ->assertSeeIn($mood, 'Not enough data for a trend yet. It appears from 3 retros.')
        ->assertPresent("{$mood} a[data-slot=\"mood-trend-link\"][href$=\"/retros/{$newer->id}\"]")
        ->click("{$mood} button:has-text(\"View as table\")")
        ->assertScript($rows, 'Sprint 41 retrospective | Retro | 3.8/5 | 3.6 – 3.9 | 2 / Sprint 42 retrospective | Retro | 4.5/5 | 4.5 – 4.5 | 1')
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true)
        ->click("{$mood} [data-slot=\"mood-trend-table\"] a:text-is(\"Sprint 41 retrospective\")")
        ->assertPathIs("/retros/{$older->id}");

    $page->navigate($insightsPath($empty))
        ->assertSeeIn('[data-slot="roti-trend"] h2', 'Mood trend')
        ->assertNotPresent('[data-slot="roti-trend-point"]')
        ->assertSeeIn('[data-slot="roti-trend-empty"]', 'No ROTI results yet.');

    $page->navigate($healthCheckPath($empty))
        ->assertSeeIn("{$mood} h2", 'Mood trend')
        ->assertNotPresent("{$mood} [data-slot=\"mood-trend-point\"]")
        ->assertNotPresent("{$mood} [data-slot=\"mood-trend-kpi\"]")
        ->assertSeeIn("{$mood} [data-slot=\"mood-trend-empty\"]", 'No health check results yet.');
});

it('opens the New session dialog on its type from a creation tile', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $admin = teamPageScreensTeamUser($team, 'Camille Roux', WorkspaceRole::Admin);
    $types = '[role="dialog"] [role="radiogroup"][aria-label="Session type"]';

    $page = $this->signIn($admin, teamPath('teams.show', $team));

    $page->assertCount('[data-slot="team-create-tiles"] a', 4)
        ->click('[data-slot="team-create-tiles"] a:has-text("New whiteboard")')
        ->assertAttribute("{$types} [role=\"radio\"][data-type=\"whiteboard\"]", 'aria-checked', 'true')
        ->click('[role="dialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="dialog"]')
        ->click('[data-slot="team-create-tiles"] a:has-text("New poker game")')
        ->assertAttribute("{$types} [role=\"radio\"][data-type=\"poker\"]", 'aria-checked', 'true');
});
