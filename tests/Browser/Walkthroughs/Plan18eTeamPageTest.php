<?php

use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Support\RetroTemplates\TemplateCatalogue;

const P18eTeamNav = '[data-sidebar="content"] a[data-sidebar="menu-button"]';

function p18eTeamUser(Team $team, string $name, WorkspaceRole $role = WorkspaceRole::Member): User
{
    $user = User::factory()->create(['name' => $name, 'locale' => 'en']);
    $team->workspace->members()->attach($user, ['role' => $role->value]);
    $team->members()->attach($user);

    return $user;
}

function p18eTeamPagePath(Team $team): string
{
    return route('teams.show', [$team->workspace, $team], false);
}

/**
 * @param  list<array<string, int>>  $healthScoresByVoter
 * @param  list<int>  $rotiScores
 */
function p18eCompletedRetro(Team $team, string $title, int $daysAgo, array $healthScoresByVoter, array $rotiScores): Retro
{
    $retro = Retro::factory()->for($team)->withHealthCheck()->inPhase(RetroPhase::Completed)->create([
        'title' => $title,
        'completed_at' => now()->subDays($daysAgo),
    ]);

    resolve(FreezeHealthStatements::class)->handle($retro);

    foreach ($healthScoresByVoter as $scores) {
        $participant = Participant::factory()->create(['retro_id' => $retro->id]);

        foreach ($scores as $statement => $score) {
            HealthCheckAnswer::factory()->create([
                'retro_id' => $retro->id,
                'participant_id' => $participant->id,
                'statement' => $statement,
                'score' => $score,
            ]);
        }
    }

    foreach ($rotiScores as $score) {
        RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => $score]);
    }

    return $retro;
}

it('[P18e-04-01] lands on the sessions, the mood and the members of the team from the sidebar, and marks the entry in use', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $alice = p18eTeamUser($team, 'Alice Martin');
    $current = P18eTeamNav.'[aria-current="page"]';
    $entry = fn (string $label): string => P18eTeamNav."[aria-label=\"{$label}\"]";

    $page = $this->signIn($alice, p18eTeamPagePath($team));

    $page->assertSeeIn('[data-slot="team-header"] h1', 'Atlas')
        ->assertSeeIn('nav[aria-label="Breadcrumb"]', 'Teams')
        ->assertCount($current, 1)
        ->assertSeeIn($current, 'Dashboard')
        ->assertPresent('#sessions')
        ->assertPresent('#mood')
        ->assertPresent('#members');

    foreach (['Sessions' => 'sessions', 'Mood & ROTI' => 'mood', 'Members' => 'members'] as $label => $anchor) {
        $page->click($entry($label))
            ->assertScript('window.location.hash', "#{$anchor}")
            ->assertPathIs(p18eTeamPagePath($team))
            ->assertCount($current, 1)
            ->assertSeeIn($current, $label)
            ->assertScript("(() => { const top = document.getElementById('{$anchor}').getBoundingClientRect().top; return top >= 0 && top < window.innerHeight; })()", true);
    }

    $page->click($entry('Dashboard'))
        ->assertScript('window.location.hash', '')
        ->assertSeeIn($current, 'Dashboard');
});

it('[P18e-04-03] shows the phase, the template and the facilitator of a retro, its ROTI once closed, and opens it', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $alice = p18eTeamUser($team, 'Alice Martin');
    $camille = p18eTeamUser($team, 'Camille Roux');

    $this->travelTo(now()->subDays(3));
    $closed = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create([
        'title' => 'Sprint 41 retrospective',
        'template' => 'start_stop_continue',
        'completed_at' => now(),
    ]);
    $this->travelBack();
    $open = Retro::factory()->for($team)->inPhase(RetroPhase::Writing)->create([
        'title' => 'Sprint 42 retrospective',
        'template' => 'mad_sad_glad',
    ]);
    $open->update(['facilitator_participant_id' => Participant::factory()->create(['retro_id' => $open->id, 'user_id' => $camille->id])->id]);

    foreach ([4, 5, 4] as $score) {
        RotiVote::factory()->create(['retro_id' => $closed->id, 'score' => $score]);
    }

    $openCard = "a[href=\"/retros/{$open->id}\"]";
    $closedCard = "a[href=\"/retros/{$closed->id}\"]";

    $page = $this->signIn($alice, p18eTeamPagePath($team));

    $page->assertSeeIn("{$openCard} [data-slot=\"session-card-status\"]", 'Writing')
        ->assertAttribute("{$openCard} [data-slot=\"session-card-status\"]", 'data-tone', 'info')
        ->assertSeeIn($openCard, TemplateCatalogue::find('mad_sad_glad')->name())
        ->assertSeeIn($openCard, 'Facilitated by Camille Roux')
        ->assertSeeIn($openCard, 'Join')
        ->assertDontSeeIn($openCard, 'Resume')
        ->assertNotPresent("{$openCard} [data-slot=\"retro-roti\"]")
        ->assertSeeIn("{$closedCard} [data-slot=\"session-card-status\"]", 'Completed')
        ->assertSeeIn($closedCard, TemplateCatalogue::find('start_stop_continue')->name())
        ->assertSeeIn("{$closedCard} [data-slot=\"retro-roti\"]", 'ROTI 4.3 / 5')
        ->assertSeeIn($closedCard, 'Summary')
        ->assertDontSee('New retrospective')
        ->click($openCard)
        ->assertPathIs("/retros/{$open->id}");
});

it('[P18e-04-04] lists active and ended games, says how many players are in the room, and turns a row into a card on a phone', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $game = PokerGame::factory()->for($team)->create(['title' => 'Sprint 43 refinement']);
    PokerGame::factory()->for($team)->ended()->create(['title' => 'Mobile app spikes']);
    PokerTask::factory()->count(2)->create(['poker_game_id' => $game->id]);
    PokerTask::factory()->estimated('5')->create(['poker_game_id' => $game->id]);
    [$ada] = pokerFacilitator($game);
    [$bob] = pokerMember($game);
    $ada->forceFill(['name' => 'Ada Facilitator', 'locale' => 'en'])->save();
    $bob->forceFill(['name' => 'Bob Member', 'locale' => 'en'])->save();
    $cy = p18eTeamUser($team, 'Cy Watcher');
    $row = fn (string $title): string => "[data-slot=\"team-poker-game\"]:has-text(\"{$title}\")";
    $display = fn (string $title): string => "getComputedStyle(Array.from(document.querySelectorAll('[data-slot=\"team-poker-game\"]')).find((row) => row.textContent.includes('{$title}'))).display";

    $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    $page = $this->signIn($cy, p18eTeamPagePath($team));

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
});

it('[P18e-04-03b] reads "Resume" on the open retro the viewer has joined and "Join" on the others', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $alice = p18eTeamUser($team, 'Alice Martin');
    $camille = p18eTeamUser($team, 'Camille Roux');
    $joined = Retro::factory()->for($team)->inPhase(RetroPhase::Voting)->create(['title' => 'Sprint 42 retrospective']);
    $other = Retro::factory()->for($team)->inPhase(RetroPhase::Writing)->create(['title' => 'Q3 release post-mortem']);
    Participant::factory()->create(['retro_id' => $joined->id, 'user_id' => $alice->id]);
    Participant::factory()->create(['retro_id' => $other->id, 'user_id' => $camille->id]);

    $joinedCard = "a[href=\"/retros/{$joined->id}\"]";
    $otherCard = "a[href=\"/retros/{$other->id}\"]";

    $page = $this->signIn($alice, p18eTeamPagePath($team));

    $page->assertSeeIn($joinedCard, 'Resume')
        ->assertDontSeeIn($joinedCard, 'Join')
        ->assertSeeIn($otherCard, 'Join')
        ->assertDontSeeIn($otherCard, 'Resume');
});

it('[P18e-04-05] lets a manager rename the team and gives a member no control over it', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $admin = p18eTeamUser($team, 'Camille Roux', WorkspaceRole::Admin);
    $member = p18eTeamUser($team, 'Alice Martin');
    $settings = '[data-slot="team-settings"]';
    $gear = '[data-slot="team-header"] a[aria-label="Team settings"]';

    $page = $this->signIn($admin, p18eTeamPagePath($team));

    $page->assertPresent($gear)
        ->assertDontSeeIn('[data-slot="team-header"]', 'Integrations')
        ->assertValue("{$settings} input[name=\"name\"]", 'Atlas')
        ->fill("{$settings} input[name=\"name\"]", 'Borealis')
        ->click("{$settings} button:has-text(\"Rename\")")
        ->assertSeeIn('[data-slot="team-header"] h1', 'Borealis')
        ->assertSeeIn('nav[aria-label="Breadcrumb"]', 'Borealis');

    expect($team->refresh()->name)->toBe('Borealis');

    $memberPage = $this->signIn($member, p18eTeamPagePath($team));

    $memberPage->assertSeeIn('[data-slot="team-header"] h1', 'Borealis')
        ->assertNotPresent($settings)
        ->assertNotPresent($gear)
        ->assertNotPresent('main input[name="name"]')
        ->assertDontSee('Delete team')
        ->assertNotPresent('#members button[aria-label^="Remove"]')
        ->assertNotPresent('#members [role="combobox"]');
});

it('[P18e-04-06] adds a member, asks before removing one, and deletes the team after a confirmation', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $admin = p18eTeamUser($team, 'Camille Roux', WorkspaceRole::Admin);
    $bob = p18eTeamUser($team, 'Bob Member');
    $olga = User::factory()->create(['name' => 'Olga Nowak', 'locale' => 'en']);
    $workspace->members()->attach($olga, ['role' => WorkspaceRole::Member->value]);
    $members = '#members [data-slot="team-members"]';

    $page = $this->signIn($admin, p18eTeamPagePath($team));

    $page->assertSeeIn($members, 'Bob Member')
        ->assertDontSeeIn($members, 'Olga Nowak')
        ->click('#members [role="combobox"]')
        ->click('[role="option"]:has-text("Olga Nowak")')
        ->click('#members button[type="submit"]')
        ->assertSeeIn($members, 'Olga Nowak')
        ->assertNotPresent('#members [role="combobox"]');

    expect($team->hasMember($olga))->toBeTrue();

    $page->click('#members button[aria-label="Remove Bob Member"]')
        ->assertSeeIn('[role="alertdialog"]', 'Remove Bob Member from Atlas?')
        ->assertSeeIn('[role="alertdialog"]', 'Remove from team')
        ->click('[role="alertdialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertSeeIn($members, 'Bob Member');

    expect($team->hasMember($bob))->toBeTrue();

    $page->click('#members button[aria-label="Remove Bob Member"]')
        ->click('[role="alertdialog"] button:has-text("Remove")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertDontSeeIn($members, 'Bob Member')
        ->assertSeeIn($members, 'Olga Nowak');

    expect($team->hasMember($bob))->toBeFalse();

    $page->click('[data-slot="team-settings"] button:has-text("Delete team")')
        ->assertSeeIn('[role="alertdialog"]', 'Delete this team?')
        ->click('[role="alertdialog"] button:has-text("Delete team")')
        ->assertPathIs("/w/{$workspace->slug}");

    expect(Team::query()->whereKey($team->id)->exists())->toBeFalse();
});

it('[P18e-04-07] sends a member of a workspace without a team to the workspace page, with its sidebar', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $alice = User::factory()->create(['name' => 'Alice Martin', 'locale' => 'en']);
    $workspace->members()->attach($alice, ['role' => WorkspaceRole::Member->value]);

    $page = $this->signIn($alice, '/dashboard');

    $page->assertPathIs("/w/{$workspace->slug}")
        ->assertSee('Nordlys')
        ->assertPresent('[data-sidebar="content"]')
        ->assertPresent('[data-sidebar="content"] a[data-sidebar="menu-button"]');
});

it('[P18e-04-08] opens the "…" menu of a section with the keyboard, on its entry', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $alice = p18eTeamUser($team, 'Alice Martin');
    $focused = 'document.activeElement?.textContent.trim()';

    $page = $this->signIn($alice, p18eTeamPagePath($team));

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
});

it('[P18e-04-09] draws the mood and the ROTI of the last retros, as a chart and as a table, after a skeleton, and says when a team has none', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $empty = Team::factory()->for($team->workspace)->create(['name' => 'Borealis']);
    $alice = p18eTeamUser($team, 'Alice Martin');
    $empty->members()->attach($alice);
    $older = p18eCompletedRetro($team, 'Sprint 41 retrospective', 10, [['vision' => 6, 'motivation' => 8], ['vision' => 8, 'motivation' => 8]], [4, 4, 3]);
    $newer = p18eCompletedRetro($team, 'Sprint 42 retrospective', 3, [['vision' => 8, 'motivation' => 9]], [4, 5, 5, 4]);
    $card = '#mood [data-slot="team-mood"]';
    $tab = fn (string $name): string => "{$card} [role=\"tab\"]:has-text(\"{$name}\")";
    $rows = "Array.from(document.querySelectorAll('#mood [data-slot=\"mood-trend-table\"] tbody tr')).map((row) => Array.from(row.children).map((cell) => cell.textContent.trim()).join(' | ')).join(' / ')";

    $page = $this->signIn($alice, "/w/{$team->workspace->slug}");

    $page->script(<<<'JS'
        (() => {
            window.__sawMoodSkeleton = false;
            new MutationObserver(() => {
                if (document.querySelector('#mood [data-slot="team-mood-loading"]')) {
                    window.__sawMoodSkeleton = true;
                }
            }).observe(document.body, { childList: true, subtree: true });
        })()
    JS);

    $page->click('main a[href="'.p18eTeamPagePath($team).'"]')
        ->assertPathIs(p18eTeamPagePath($team))
        ->assertSeeIn("{$card} h2", 'Mood trend')
        ->assertNotPresent('#mood [data-slot="team-mood-loading"]')
        ->assertScript('window.__sawMoodSkeleton', true)
        ->assertScript('document.querySelector(\'#mood\').firstElementChild.dataset.slot', 'team-mood')
        ->assertAttribute($tab('Mood'), 'aria-selected', 'true')
        ->assertCount("{$card} [data-slot=\"mood-trend-point\"]", 2)
        ->assertSeeIn("{$card} [data-slot=\"mood-trend-kpi\"]", '8.5/10')
        ->assertSeeIn("{$card} [data-slot=\"mood-trend-delta\"]", '+1.0 since the previous retro')
        ->assertSeeIn($card, 'Not enough data for a trend yet. It appears from 3 retros.')
        ->assertPresent("{$card} a[data-slot=\"mood-trend-link\"][href$=\"/retros/{$newer->id}\"]")
        ->click($tab('ROTI'))
        ->assertAttribute($tab('ROTI'), 'aria-selected', 'true')
        ->assertCount("{$card} [data-slot=\"mood-trend-point\"]", 2)
        ->assertSeeIn("{$card} [data-slot=\"mood-trend-kpi\"]", '4.5')
        ->assertDontSeeIn("{$card} [data-slot=\"mood-trend-kpi\"]", '/10')
        ->assertSeeIn("{$card} [data-slot=\"mood-trend-delta\"]", '+0.8 since the previous retro')
        ->click("{$card} button:has-text(\"View as table\")")
        ->assertScript($rows, 'Sprint 41 retrospective | 3.7 | 3 / Sprint 42 retrospective | 4.5 | 4')
        ->click($tab('Mood'))
        ->assertScript($rows, 'Sprint 41 retrospective | 7.5/10 | 2 / Sprint 42 retrospective | 8.5/10 | 1')
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true)
        ->click("{$card} [data-slot=\"mood-trend-table\"] a:text-is(\"Sprint 41 retrospective\")")
        ->assertPathIs("/retros/{$older->id}");

    $page->navigate(p18eTeamPagePath($empty))
        ->assertSeeIn("{$card} h2", 'Mood trend')
        ->assertNotPresent("{$card} [data-slot=\"mood-trend-point\"]")
        ->assertNotPresent("{$card} [data-slot=\"mood-trend-kpi\"]")
        ->assertSeeIn("{$card} [data-slot=\"mood-trend-empty\"]", 'No health check results yet.')
        ->click($tab('ROTI'))
        ->assertSeeIn("{$card} [data-slot=\"mood-trend-empty\"]", 'No ROTI results yet.');
});
