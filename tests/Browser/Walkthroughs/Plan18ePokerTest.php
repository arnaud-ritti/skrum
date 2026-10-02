<?php

use App\Enums\PokerDeck;
use App\Enums\PokerRevealReason;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\PokerVote;
use App\Models\User;

function p18ePokerNamed(User $user, string $name): User
{
    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return $user;
}

/**
 * A game of four players, Ada facilitating, with one task open on its first round.
 *
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     game: PokerGame,
 *     round: PokerRound,
 *     ada: User,
 *     adaPlayer: PokerPlayer,
 *     bob: User,
 *     bobPlayer: PokerPlayer,
 *     cleoPlayer: PokerPlayer,
 *     danPlayer: PokerPlayer
 * }
 */
function p18ePokerTable(array $attributes = []): array
{
    $game = PokerGame::factory()->create(['title' => 'Sprint 43 refinement', ...$attributes]);
    [$ada, $adaPlayer] = pokerFacilitator($game);
    [$bob, $bobPlayer] = pokerMember($game);
    [$cleo, $cleoPlayer] = pokerMember($game);
    [$dan, $danPlayer] = pokerMember($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);

    p18ePokerNamed($cleo, 'Cleo');
    p18ePokerNamed($dan, 'Dan');

    return [
        'game' => $game,
        'round' => openPokerRound($game, $task),
        'ada' => p18ePokerNamed($ada, 'Ada'),
        'adaPlayer' => $adaPlayer,
        'bob' => p18ePokerNamed($bob, 'Bob'),
        'bobPlayer' => $bobPlayer,
        'cleoPlayer' => $cleoPlayer,
        'danPlayer' => $danPlayer,
    ];
}

/**
 * Votes 3, 5, 5 and 8, then the reveal: Bob holds the lowest card and Dan the highest.
 *
 * @param  array{round: PokerRound, adaPlayer: PokerPlayer, bobPlayer: PokerPlayer, cleoPlayer: PokerPlayer, danPlayer: PokerPlayer}  $table
 */
function p18ePokerReveal(array $table): void
{
    pokerVote($table['round'], $table['adaPlayer'], '5');
    pokerVote($table['round'], $table['bobPlayer'], '3');
    pokerVote($table['round'], $table['cleoPlayer'], '5');
    pokerVote($table['round'], $table['danPlayer'], '8');

    $table['round']->forceFill(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual])->save();
}

const P18ePokerResult = '[aria-labelledby="poker-result"]';

it('[P18e-03-01] opens the queue in a drawer and votes through the vote drawer on a phone', function () {
    $table = p18ePokerTable(['guest_access_enabled' => true]);
    PokerTask::factory()->create(['poker_game_id' => $table['game']->id, 'title' => 'Password reset']);

    $page = $this->awaitRealtime($this->signIn($table['bob'], "/poker/{$table['game']->id}"));

    $page->resize(390, 844)
        ->assertVisible('[data-slot="poker-subbar"] [aria-label="Copy guest link"]')
        ->assertCount('[aria-label="Copy guest link"]', 1)
        ->assertNotPresent('#poker-tasks')
        ->assertNotPresent('button:has-text("Hide tasks")')
        ->click('Tasks')
        ->assertVisible('[role="dialog"]#poker-tasks')
        ->assertCount('#poker-tasks [data-test="poker-task-row"]', 2)
        ->assertSeeIn('#poker-tasks', 'Password reset')
        ->keys('#poker-tasks', 'Escape')
        ->assertNotPresent('#poker-tasks');

    $page->assertVisible('[role="group"][aria-label="Your cards"]')
        ->click('All deck')
        ->assertSeeIn('[role="dialog"]', 'Choose your card')
        ->click('[role="dialog"] [role="radio"][aria-label="5 points"]')
        ->click('Validate 5 points')
        ->assertNotPresent('[role="dialog"]')
        ->assertAttribute('[aria-label="Play 5"]', 'aria-pressed', 'true')
        ->assertScript('document.documentElement.scrollWidth <= document.documentElement.clientWidth', true);

    expect(PokerVote::query()->where('poker_player_id', $table['bobPlayer']->id)->pluck('value')->all())->toBe(['5']);
});

it('[P18e-03-02] gives a watcher the deck back with "Join the vote"', function () {
    $table = p18ePokerTable();

    $page = $this->awaitRealtime($this->signIn($table['bob'], "/poker/{$table['game']->id}"));

    $page->assertAttribute('#poker-watch-only', 'aria-checked', 'false')
        ->assertNotPresent('[data-slot="poker-watching-banner"]')
        ->click('Watch only')
        ->assertAttribute('#poker-watch-only', 'aria-checked', 'true')
        ->assertSeeIn('[data-slot="poker-watching-banner"]', "You're watching — switch to Play to vote")
        ->assertSee('Watch only')
        ->assertSee('Deck disabled while you watch only')
        ->assertNotPresent('[role="group"][aria-label="Your cards"]')
        ->assertSeeIn('section[aria-label="Watching"]', 'You');

    expect($table['bobPlayer']->fresh()->is_spectator)->toBeTrue();

    $page->click('Join the vote')
        ->assertNotPresent('[data-slot="poker-watching-banner"]')
        ->assertAttribute('#poker-watch-only', 'aria-checked', 'false')
        ->assertVisible('[role="group"][aria-label="Your cards"]')
        ->assertEnabled('[aria-label="Play 5"]')
        ->assertNotPresent('section[aria-label="Watching"]');

    expect($table['bobPlayer']->fresh()->is_spectator)->toBeFalse();
});

it('[P18e-03-03] collapses the task queue with "Hide tasks" and brings it back', function () {
    $table = p18ePokerTable();

    $page = $this->awaitRealtime($this->signIn($table['ada'], "/poker/{$table['game']->id}"));

    $page->assertVisible('aside#poker-tasks')
        ->assertAttribute('button:has-text("Hide tasks")', 'aria-expanded', 'true')
        ->assertAttribute('button:has-text("Hide tasks")', 'aria-controls', 'poker-tasks')
        ->click('Hide tasks')
        ->assertNotPresent('#poker-tasks')
        ->assertAttribute('button:has-text("Show tasks")', 'aria-expanded', 'false')
        ->assertAttributeMissing('button:has-text("Show tasks")', 'aria-controls')
        ->assertVisible('section[aria-label="Players"]')
        ->click('Show tasks')
        ->assertVisible('aside#poker-tasks')
        ->assertCount('@poker-task-row', 1);
});

it('[P18e-03-04] keeps the reaction bar above the deck without overlap, on a page with one realtime root', function () {
    $table = p18ePokerTable();
    pokerVote($table['round'], $table['bobPlayer'], '3');
    $table['round']->forceFill(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual])->save();
    $gap = '(() => { const bar = document.querySelector(\'[role="toolbar"][aria-label="Reactions"]\').getBoundingClientRect(); const deck = document.querySelector(\'[data-slot="poker-deckbar"]\').getBoundingClientRect(); return Math.round(deck.top - bar.bottom); })()';
    $overlaps = '(() => { const bar = document.querySelector(\'[role="toolbar"][aria-label="Reactions"]\').getBoundingClientRect(); return [\'[data-slot="poker-deckbar"]\', \'[data-slot="facilitator-bar"]\', \'[role="group"][aria-label="Your cards"]\'].filter((selector) => document.querySelector(selector) !== null).filter((selector) => { const box = document.querySelector(selector).getBoundingClientRect(); return !(box.top >= bar.bottom || box.bottom <= bar.top || box.left >= bar.right || box.right <= bar.left); }).join(); })()';

    $page = $this->awaitRealtime($this->signIn($table['ada'], "/poker/{$table['game']->id}"));

    $page->assertCount('[data-realtime]', 1)
        ->assertVisible('[role="toolbar"][aria-label="Reactions"]')
        ->assertVisible('[data-slot="poker-deckbar"] [data-slot="facilitator-bar"]')
        ->assertVisible('[role="group"][aria-label="Your cards"]')
        ->assertScript($gap, 12)
        ->assertScript($overlaps, '')
        ->resize(390, 844)
        ->assertVisible('[role="toolbar"][aria-label="Reactions"]')
        ->assertNotPresent('[role="group"][aria-label="Your cards"]')
        ->assertVisible('[data-slot="poker-deckbar"] [data-slot="facilitator-bar"]')
        ->assertScript($gap, 12)
        ->assertScript($overlaps, '')
        ->assertCount('[data-realtime]', 1);
});

it('[P18e-03-05] shows the deck, the voters and the rounds of each row of the estimation history, and a count for an anonymous round', function () {
    $table = p18ePokerTable();
    $game = $table['game'];
    $voted = PokerTask::factory()->estimated('5')->create(['poker_game_id' => $game->id, 'title' => 'Export invoices']);
    $first = PokerRound::factory()->revealed()->create(['poker_task_id' => $voted->id]);
    pokerVote($first, $table['adaPlayer'], '3');
    pokerVote($first, $table['bobPlayer'], '8');
    $second = PokerRound::factory()->revealed()->create(['poker_task_id' => $voted->id]);

    foreach (['adaPlayer' => '3', 'bobPlayer' => '5', 'cleoPlayer' => '5', 'danPlayer' => '8'] as $player => $value) {
        pokerVote($second, $table[$player], $value);
    }

    $sizing = PokerGame::factory()->deck(PokerDeck::Tshirt)->create(['team_id' => $game->team_id, 'title' => 'Sizing workshop']);
    $secret = PokerTask::factory()->estimated('L')->create(['poker_game_id' => $sizing->id, 'title' => 'Billing proration', 'estimated_at' => now()->subDay()]);
    $hidden = PokerRound::factory()->revealed()->create(['poker_task_id' => $secret->id, 'anonymous' => true]);

    foreach (['Eve', 'Finn'] as $name) {
        [$user, $player] = pokerMember($sizing);
        p18ePokerNamed($user, $name);
        pokerVote($hidden, $player, 'L');
    }

    $row = fn (string $title): string => '[data-slot="estimate-row"]:has-text("'.$title.'")';

    $page = $this->signIn($table['ada'], route('teams.estimates.index', [$game->team->workspace, $game->team], false));

    $page->assertSee('2 tasks estimated by')
        ->assertCount('[data-slot="estimate-row"]', 2)
        ->assertSeeIn($row('Export invoices'), 'Fibonacci')
        ->assertSeeIn($row('Export invoices'), 'Sprint 43 refinement')
        ->assertSeeIn($row('Export invoices').' [data-slot="estimate-value"]', '5')
        ->assertCount($row('Export invoices').' [data-slot="estimate-voters"] [data-slot="person-avatar"]', 3)
        ->assertSeeIn($row('Export invoices').' [data-slot="estimate-voters"]', '4 voters')
        ->assertAttribute($row('Export invoices').' [data-slot="estimate-rounds"]', 'data-revoted', 'true')
        ->assertSeeIn($row('Export invoices').' [data-slot="estimate-rounds"]', '2')
        ->assertSeeIn($row('Billing proration'), 'T-shirt sizes')
        ->assertCount($row('Billing proration').' [data-slot="estimate-voters"] [data-slot="person-avatar"]', 0)
        ->assertSeeIn($row('Billing proration').' [data-slot="estimate-voters"]', '2 voters')
        ->assertNotPresent($row('Billing proration').' [data-slot="estimate-rounds"][data-revoted]')
        ->assertSee('1–2 of 2')
        ->assertNotPresent('[aria-label="Pagination"]');

    $page->click($row('Export invoices').' [aria-label="Show rounds"]')
        ->assertSee('Round 2')
        ->assertSee('3 × 1')
        ->assertSee('5 × 2')
        ->assertSee('Median: 5')
        ->assertSee('Agreement: 50 % on 5')
        ->click($row('Billing proration').' [aria-label="Show rounds"]')
        ->assertDontSee('Round 2')
        ->assertSee('Anonymous votes')
        ->assertSee('L × 2')
        ->assertDontSee('Eve')
        ->assertNoJavaScriptErrors();

    $page->resize(390, 844)
        ->assertNotPresent('table')
        ->assertCount('[data-slot="estimate-row"]', 2)
        ->assertCount($row('Export invoices').' [data-slot="estimate-voters"] [data-slot="person-avatar"]', 3)
        ->click($row('Export invoices').' [aria-label="Show rounds"]')
        ->assertSee('Median: 5');
});

it('[P18e-03-06] shows the median, the spread and the agreement of a reveal and names the two extremes', function () {
    $table = p18ePokerTable();
    p18ePokerReveal($table);

    $page = $this->awaitRealtime($this->signIn($table['ada'], "/poker/{$table['game']->id}"));

    $page->assertSeeIn(P18ePokerResult, 'Result · 4 votes')
        ->assertSeeIn(P18ePokerResult, 'Median')
        ->assertScript('Array.from(document.querySelectorAll(\''.P18ePokerResult.' dl > div\')).map((stat) => stat.querySelector("dt").textContent + "=" + stat.querySelector("dd").textContent).join(" / ")', 'Average=5.3 / Median=5 / Most played=5 / Agreement=50 % on 5')
        ->assertSeeIn(P18ePokerResult, '3 → 8')
        ->assertSeeIn(P18ePokerResult, '50 % on 5')
        ->assertSeeIn(P18ePokerResult, 'Bob (3) and Dan (8) open the discussion.')
        ->assertCount('[data-slot="poker-seat-card"][data-outlier]', 2)
        ->assertNotPresent(P18ePokerResult.' button:has-text("Re-vote")')
        ->assertVisible('[data-slot="facilitator-bar"] button:has-text("Re-vote")')
        ->assertVisible('[data-slot="facilitator-bar"] [aria-label="Estimate"]')
        ->assertVisible('[data-slot="facilitator-bar"] button:has-text("Save estimate")')
        ->assertVisible('[data-slot="facilitator-bar"] button:has-text("Next task")');
});

it('[P18e-03-06b] names nobody on an anonymous round', function () {
    $table = p18ePokerTable(['anonymous_votes' => true]);
    p18ePokerReveal($table);

    $page = $this->awaitRealtime($this->signIn($table['ada'], "/poker/{$table['game']->id}"));

    $page->assertSeeIn(P18ePokerResult, '3 → 8')
        ->assertSeeIn(P18ePokerResult, '50 % on 5')
        ->assertSeeIn(P18ePokerResult, 'The lowest and the highest estimates open the discussion.')
        ->assertDontSee('Bob (3)')
        ->assertDontSee('Dan (8)')
        ->assertNotPresent('[data-slot="poker-seat-card"][data-outlier]')
        ->assertPresent('section[aria-label="Anonymous votes"]');
});

it('[P18e-03-07] offers one, three, five and ten minutes or a custom duration, and "+2 min" moves the countdown for everyone', function () {
    $table = p18ePokerTable();
    $round = $table['round'];

    $a = $this->awaitRealtime($this->signIn($table['ada'], "/poker/{$table['game']->id}"));
    $b = $this->awaitRealtime($this->signIn($table['bob'], "/poker/{$table['game']->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertNotPresent('[role="timer"]');
    }

    $b->assertNotPresent('[aria-label="Timer"]');

    $a->click('[aria-label="Timer"]')
        ->assertScript('Array.from(document.querySelectorAll(\'[role="menu"] [role="menuitem"]\')).map((item) => item.textContent).join(" / ")', '1 min / 3 min / 5 min / 10 min / Custom… / Stop timer')
        ->assertDontSee('30 s')
        ->click('1 min');

    foreach ([$a, $b] as $page) {
        $page->assertSeeIn('[role="timer"]', '0:');
    }

    $firstEnd = $round->fresh()->timer_ends_at;

    $b->assertDontSee('+2 min');

    $a->assertSee('+2 min')
        ->click('button:has-text("+2 min")');

    foreach ([$a, $b] as $page) {
        $page->assertSeeIn('[role="timer"]', '2:');
    }

    expect((int) $firstEnd->diffInSeconds($round->fresh()->timer_ends_at))->toBe(120);

    $a->click('[aria-label="Timer"]')
        ->click('Custom…')
        ->assertVisible('#poker-timer-minutes')
        ->fill('#poker-timer-minutes', '7')
        ->click('Start timer');

    foreach ([$a, $b] as $page) {
        $page->assertSeeIn('[role="timer"]', '6:');
    }
});
