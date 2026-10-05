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

const P18ePokerOval = '[data-slot="poker-oval"]';

const P18ePokerOvalInView = <<<'JS'
(() => {
    const oval = document.querySelector('[data-slot="poker-oval"]').getBoundingClientRect();
    const stage = document.querySelector('[data-slot="poker-stage"]').parentElement.getBoundingClientRect();
    const dock = document.querySelector('[data-slot="poker-dock"]').getBoundingClientRect();

    return oval.height > 0 && oval.top >= stage.top && oval.bottom <= stage.bottom && oval.bottom <= dock.top;
})()
JS;

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

it('[P18e-03-04] keeps the reaction bar above the deck panel, which holds the result once revealed, without overlap, on a page with one realtime root', function () {
    $table = p18ePokerTable();
    pokerVote($table['round'], $table['bobPlayer'], '3');
    $table['round']->forceFill(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual])->save();
    $gap = '(() => { const bar = document.querySelector(\'[role="toolbar"][aria-label="Reactions"]\').getBoundingClientRect(); const deck = document.querySelector(\'[data-slot="poker-deckbar"]\').getBoundingClientRect(); return Math.round(deck.top - bar.bottom); })()';
    $overlaps = '(() => { const bar = document.querySelector(\'[role="toolbar"][aria-label="Reactions"]\').getBoundingClientRect(); return [\'[data-slot="poker-deckbar"]\', \'[data-slot="poker-actions"]\', \'[data-test="poker-validate"]\'].filter((selector) => document.querySelector(selector) !== null).filter((selector) => { const box = document.querySelector(selector).getBoundingClientRect(); return !(box.top >= bar.bottom || box.bottom <= bar.top || box.left >= bar.right || box.right <= bar.left); }).join(); })()';

    $page = $this->awaitRealtime($this->signIn($table['ada'], "/poker/{$table['game']->id}"));

    $page->assertCount('[data-realtime]', 1)
        ->assertVisible('[role="toolbar"][aria-label="Reactions"]')
        ->assertVisible('[data-slot="poker-deckbar"] [aria-labelledby="poker-result"]')
        ->assertVisible('[data-slot="poker-deckbar"] [data-test="poker-validate"]')
        ->assertNotPresent('[role="group"][aria-label="Your cards"]')
        ->assertScript($gap, 12)
        ->assertScript($overlaps, '')
        ->resize(390, 844)
        ->assertVisible('[role="toolbar"][aria-label="Reactions"]')
        ->assertNotPresent('[role="group"][aria-label="Your cards"]')
        ->assertVisible('[data-slot="poker-deckbar"] [data-test="poker-validate"]')
        ->assertNotPresent('[data-slot="poker-dock"] [aria-labelledby="poker-result"]')
        ->assertPresent('[data-slot="poker-stage"] [aria-labelledby="poker-result"][data-layout="card"]')
        ->assertScript($gap, 12)
        ->assertScript($overlaps, '')
        ->assertCount('[data-realtime]', 1);
});

it('[P18e-03-05] shows the ticket key, the deck, the voters and the rounds of each row of the estimation history, the number of games in the summary, and a count for an anonymous round', function () {
    $table = p18ePokerTable();
    $game = $table['game'];
    $voted = PokerTask::factory()->imported()->estimated('5')->create(['poker_game_id' => $game->id, 'title' => 'Export invoices']);
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
        ->assertSee('across 2 games')
        ->assertCount('[data-slot="estimate-row"]', 2)
        ->assertSeeIn($row('Export invoices').' [data-slot="estimate-ticket"]', $voted->external_key)
        ->assertNotPresent($row('Billing proration').' [data-slot="estimate-ticket"]')
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
        ->assertSeeIn($row('Export invoices').' [data-slot="estimate-ticket"]', $voted->external_key)
        ->click($row('Export invoices').' [aria-label="Show rounds"]')
        ->assertSee('Median: 5');
});

it('[P18e-03-06] shows the average, the median and the spread of a reveal in the oval, and the average, the median, the agreement, the distribution and the two extremes in the dock', function () {
    $table = p18ePokerTable();
    p18ePokerReveal($table);

    $page = $this->awaitRealtime($this->signIn($table['ada'], "/poker/{$table['game']->id}"));

    $page->assertSeeIn(P18ePokerOval, 'Average')
        ->assertSeeIn(P18ePokerOval, '5.3')
        ->assertSeeIn(P18ePokerOval, 'Median')
        ->assertSeeIn(P18ePokerOval, 'Spread 3 → 8')
        ->assertNotPresent('[data-slot="poker-table"] [data-slot="poker-result"]')
        ->assertVisible('[data-slot="poker-dock"] '.P18ePokerResult)
        ->assertSeeIn(P18ePokerResult, 'Result · 4 votes')
        ->assertScript('Array.from(document.querySelectorAll(\''.P18ePokerResult.' dl > div\')).map((stat) => stat.querySelector("dt").textContent + "=" + stat.querySelector("dd").textContent).join(" / ")', 'Average=5.3 / Median=5 / Agreement=50 % on 5')
        ->assertScript('Array.from(document.querySelectorAll(\''.P18ePokerResult.' li\')).map((row) => row.querySelectorAll("span")[0].textContent + " x" + row.querySelectorAll("span")[2].textContent).join(" / ")', '3 x1 / 5 x2 / 8 x1')
        ->assertSeeIn(P18ePokerResult, 'Bob (3) and Dan (8) open the discussion.')
        ->assertCount('[data-slot="poker-seat-card"][data-outlier]', 2)
        ->assertScript('document.querySelector(\''.P18ePokerResult.'\').getBoundingClientRect().bottom <= window.innerHeight', true)
        ->assertVisible(P18ePokerResult.' button:has-text("Re-vote")')
        ->assertAttribute('[aria-label="Final estimate"] [aria-checked="true"]', 'aria-label', '5')
        ->assertSeeIn('@poker-validate', 'Validate 5')
        ->assertNotPresent('button:has-text("Save estimate")')
        ->assertNotPresent('[data-slot="poker-dock"] button:has-text("Next task")');
});

it('[P18e-03-06d] keeps the oval and its figures in view above the reactions at 1440 × 900 after a reveal', function (bool $facilitatorWatches) {
    $table = p18ePokerTable();
    p18ePokerReveal($table);

    if ($facilitatorWatches) {
        $table['adaPlayer']->forceFill(['is_spectator' => true])->save();
        $second = openPokerRound($table['game'], $table['round']->task);

        foreach (['bobPlayer' => '3', 'cleoPlayer' => '5', 'danPlayer' => '8'] as $player => $value) {
            pokerVote($second, $table[$player], $value);
        }

        $second->forceFill(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual])->save();
    }

    $page = $this->awaitRealtime($this->signIn($table['ada'], "/poker/{$table['game']->id}"));

    $page->resize(1440, 900)
        ->assertSeeIn(P18ePokerOval, 'Average')
        ->assertSeeIn(P18ePokerOval, 'Median')
        ->assertCount('[data-slot="poker-watching"]', $facilitatorWatches ? 1 : 0)
        ->assertCount('[data-slot="story-rounds"] [data-slot="poker-round"]', $facilitatorWatches ? 2 : 1)
        ->assertScript(P18ePokerOvalInView, true);
})->with([
    'a facilitator who votes' => [false],
    'a facilitator who watches, on a second round' => [true],
]);

it('[P18e-03-06b] names nobody on an anonymous round', function () {
    $table = p18ePokerTable(['anonymous_votes' => true]);
    p18ePokerReveal($table);

    $page = $this->awaitRealtime($this->signIn($table['ada'], "/poker/{$table['game']->id}"));

    $page->assertSeeIn(P18ePokerOval, '3 → 8')
        ->assertSeeIn(P18ePokerResult, '50 % on 5')
        ->assertSeeIn(P18ePokerResult, 'The lowest and the highest estimates open the discussion.')
        ->assertDontSee('Bob (3)')
        ->assertDontSee('Dan (8)')
        ->assertNotPresent('[data-slot="poker-seat-card"][data-outlier]')
        ->assertPresent('section[aria-label="Anonymous votes"]');
});

it('[P18e-03-06c] moves focus to the dock on a reveal, then validates the chosen final estimate and opens the next story with one button, for everyone', function () {
    $table = p18ePokerTable();
    $game = $table['game'];
    $next = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Password reset']);

    foreach (['adaPlayer' => '5', 'bobPlayer' => '3', 'cleoPlayer' => '5', 'danPlayer' => '8'] as $player => $value) {
        pokerVote($table['round'], $table[$player], $value);
    }

    $facilitator = $this->awaitRealtime($this->signIn($table['ada'], "/poker/{$game->id}"));
    $member = $this->awaitRealtime($this->signIn($table['bob'], "/poker/{$game->id}"));

    $facilitator->click('Reveal cards')
        ->assertVisible(P18ePokerResult)
        ->assertScript('document.activeElement.getAttribute("data-slot")', 'poker-result')
        ->assertAttribute('[aria-label="Final estimate"] [aria-checked="true"]', 'aria-label', '5')
        ->assertSeeIn('@poker-validate', 'Validate 5 · Next story')
        ->click('[aria-label="Final estimate"] [aria-label="8"]')
        ->assertAttribute('[aria-label="Final estimate"] [aria-checked="true"]', 'aria-label', '8')
        ->assertSeeIn('@poker-validate', 'Validate 8 · Next story');

    $member->assertVisible(P18ePokerResult)
        ->assertSeeIn(P18ePokerResult, 'Your card · 3')
        ->assertNotPresent('[aria-label="Final estimate"]')
        ->assertNotPresent('@poker-validate');

    $facilitator->click('@poker-validate');

    foreach ([$facilitator, $member] as $page) {
        $page->assertSeeIn('[data-slot="story-card"]', 'Password reset')
            ->assertNotPresent(P18ePokerResult)
            ->assertVisible('[role="group"][aria-label="Your cards"]')
            ->assertSeeIn('[data-test="poker-task-row"]:has-text("Login page")', '8');
    }

    expect($game->tasks()->where('title', 'Login page')->value('estimate'))->toBe('8')
        ->and($game->refresh()->current_task_id)->toBe($next->id);
});

it('[P18e-03-06d] lists the past rounds open, each vote as "name: value", and folded on a phone', function () {
    $table = p18ePokerTable();
    $game = $table['game'];
    p18ePokerReveal($table);
    $second = PokerRound::factory()->create(['poker_task_id' => $table['round']->poker_task_id]);
    pokerVote($second, $table['bobPlayer'], '5');

    $page = $this->awaitRealtime($this->signIn($table['ada'], "/poker/{$game->id}"));

    $page->assertAttribute('[data-slot="story-rounds"] button:has-text("Rounds (2)")', 'aria-expanded', 'true')
        ->assertSeeIn('[data-slot="story-rounds"]', 'Round 1')
        ->assertSeeIn('[data-slot="story-rounds"]', 'Bob: 3')
        ->assertSeeIn('[data-slot="story-rounds"]', 'Dan: 8')
        ->assertSeeIn('[data-slot="story-rounds"]', 'Not revealed · 1 votes')
        ->assertDontSeeIn('[data-slot="story-rounds"] [data-slot="poker-round"][data-revealed="false"]', 'Bob')
        ->click('[data-slot="story-rounds"] button:has-text("Rounds (2)")')
        ->assertAttribute('[data-slot="story-rounds"] button:has-text("Rounds (2)")', 'aria-expanded', 'false')
        ->assertDontSeeIn('[data-slot="story-rounds"]', 'Bob: 3');

    $phone = $this->awaitRealtime($this->signIn($table['bob'], "/poker/{$game->id}"));

    $phone->resize(390, 844)
        ->assertAttribute('[data-slot="story-rounds"] button:has-text("Rounds (2)")', 'aria-expanded', 'false')
        ->click('[data-slot="story-rounds"] button:has-text("Rounds (2)")')
        ->assertSeeIn('[data-slot="story-rounds"]', 'Bob: 3');
});

it('[P18e-03-06e] seats the players under their first name, and in one row that scrolls on a phone', function () {
    $table = p18ePokerTable();
    $game = $table['game'];
    p18ePokerNamed($table['bob'], 'Bob van der Berg');

    foreach (['Eve Adams', 'Finn Baker', 'Gus Clark', 'Hal Davis', 'Ida Evans', 'Jo Ford'] as $name) {
        [$user, $player] = pokerMember($game);
        p18ePokerNamed($user, $name);
        pokerVote($table['round'], $player, '5');
    }

    $ada = $this->awaitRealtime($this->signIn($table['ada'], "/poker/{$game->id}"));
    $this->awaitRealtime($this->signIn($table['bob'], "/poker/{$game->id}"));

    $bobName = '[data-slot="poker-seat-name"][title="Bob van der Berg"]';
    $row = 'document.querySelector(\'[data-slot="poker-seats-row"]\')';

    $ada->assertVisible('[aria-label="Bob van der Berg: Not voted yet"]')
        ->assertAttribute('section[aria-label="Players"]', 'data-layout', 'oval')
        ->assertScript("document.querySelector('{$bobName} [aria-hidden]').textContent", 'Bob')
        ->assertScript("document.querySelector('{$bobName} .sr-only').textContent", 'Bob van der Berg')
        ->assertNotPresent('[data-slot="poker-seats-row"]')
        ->resize(390, 844)
        ->assertAttribute('section[aria-label="Players"]', 'data-layout', 'row')
        ->assertCount('[data-slot="poker-seats-row"] [data-slot="poker-seat"]', 8)
        ->assertVisible('[data-slot="poker-seats-row"] [aria-label="Bob van der Berg: Not voted yet"]')
        ->assertScript("document.querySelector('{$bobName} [aria-hidden]').textContent", 'Bob')
        ->assertScript("{$row}.scrollWidth > {$row}.clientWidth", true)
        ->assertScript("getComputedStyle({$row}).overflowX", 'auto')
        ->assertScript("{$row}.tabIndex", 0)
        ->assertPresent('[data-slot="poker-bar"] [data-slot="poker-table-center"]')
        ->assertScript('document.documentElement.scrollWidth <= document.documentElement.clientWidth', true);
});

it('[P18e-03-06f] shows "Votes: n" on every row of the queue, and a line where a dragged task lands', function () {
    $table = p18ePokerTable();
    $game = $table['game'];
    PokerTask::query()->whereKey($table['round']->poker_task_id)->update(['position' => 1]);
    pokerVote($table['round'], $table['bobPlayer'], '8');
    $done = PokerTask::factory()->estimated('3')->create(['poker_game_id' => $game->id, 'title' => 'Password reset', 'position' => 2]);
    $played = PokerRound::factory()->revealed()->create(['poker_task_id' => $done->id]);
    pokerVote($played, $table['adaPlayer'], '3');
    pokerVote($played, $table['bobPlayer'], '3');
    pokerVote($played, $table['cleoPlayer'], '5');
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Export invoices', 'position' => 3]);

    $facilitator = $this->awaitRealtime($this->signIn($table['ada'], "/poker/{$game->id}"));
    $member = $this->awaitRealtime($this->signIn($table['bob'], "/poker/{$game->id}"));

    $rowOf = fn (string $title): string => "[data-test=\"poker-task-row\"]:has-text(\"{$title}\")";
    $order = "[...document.querySelectorAll('[data-test=\"poker-task-row\"]')].map((row) => row.querySelector('span span').textContent).join(' / ')";

    foreach ([$facilitator, $member] as $page) {
        $page->assertSeeIn($rowOf('Login page'), 'Votes: 1')
            ->assertSeeIn($rowOf('Password reset'), 'Votes: 3')
            ->assertSeeIn($rowOf('Export invoices'), 'Votes: 0')
            ->assertDontSeeIn('#poker-tasks ol', 'pts')
            ->assertCount('#poker-tasks ol > li', 3);
    }

    $member->assertDontSeeIn($rowOf('Login page'), '8');

    $handle = '[aria-label="Drag to reorder Login page"]';

    $settle = '() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))';

    $facilitator->assertNotPresent('[data-slot="task-drop-line"]')
        ->keys($handle, 'Space')
        ->assertAttribute($handle, 'aria-pressed', 'true');
    $facilitator->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 0))');
    $facilitator->keys($handle, 'ArrowDown');
    $facilitator->script($settle);
    $facilitator->assertPresent($rowOf('Password reset').' > [data-slot="task-drop-line"][data-position="after"]')
        ->assertCount('[data-slot="task-drop-line"]', 1)
        ->assertCount('#poker-tasks ol > li', 3)
        ->keys($handle, 'ArrowDown');
    $facilitator->script($settle);
    $facilitator->assertPresent($rowOf('Export invoices').' > [data-slot="task-drop-line"][data-position="after"]')
        ->assertCount('[data-slot="task-drop-line"]', 1)
        ->keys($handle, 'Escape')
        ->assertNotPresent('[data-slot="task-drop-line"]')
        ->assertScript($order, 'Login page / Password reset / Export invoices');

    $this->dragWithKeyboard($facilitator, $handle, ['Space', 'ArrowDown', 'Space']);

    foreach ([$facilitator, $member] as $page) {
        $page->assertScript($order, 'Password reset / Login page / Export invoices')
            ->assertNotPresent('[data-slot="task-drop-line"]');
    }
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

it('[P18e-03-19] writes "team · Planning poker" above the title, shows "Synced" and the viewer at the end of the header, and keeps the title on a phone', function () {
    $table = p18ePokerTable(['guest_access_enabled' => true]);
    $table['game']->team->update(['name' => 'Atlas']);
    $hidden = fn (string $selector): string => "getComputedStyle(document.querySelector('{$selector}')).display";
    $titleKeepsItsRoom = "(({ scrollWidth, clientWidth }) => clientWidth > 0 && (scrollWidth <= clientWidth || clientWidth / parseFloat(getComputedStyle(document.documentElement).fontSize) >= 6))(document.querySelector('header h1'))";

    $bob = $this->awaitRealtime($this->signIn($table['bob'], "/poker/{$table['game']->id}"))->resize(1440, 900);

    $bob->assertSeeIn('header [data-slot="session-overline"]', 'Atlas · Planning poker')
        ->assertSeeIn('header span > h1', 'Sprint 43 refinement')
        ->assertSeeIn('header [data-slot="session-synced"]', 'Synced')
        ->assertVisible('header > [data-slot="session-self"]:last-child [aria-label="Bob"]')
        ->assertCount('[data-realtime]', 1);

    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$table['game']->guest_token}", 'Visitor'))->resize(1440, 900);

    $guest->assertSeeIn('header [data-slot="session-overline"]', 'Planning poker')
        ->assertDontSeeIn('header', 'Atlas')
        ->assertVisible('header [data-slot="session-self"] [aria-label="Visitor (Guest)"]')
        ->resize(390, 844)
        ->assertScript($hidden('header [data-slot="session-overline"]'), 'none')
        ->assertScript($hidden('header [data-slot="session-synced"]'), 'none')
        ->assertScript($hidden('header [data-slot="session-self"]'), 'none')
        ->assertScript($titleKeepsItsRoom, true)
        ->assertCount('[data-realtime]', 1);
});

it('[P18e-03-20] opens the game settings in a popover under its header button, asks before dropping a change, and shows them as text to a player who does not facilitate', function () {
    $table = p18ePokerTable();
    $game = $table['game'];
    $autoReveal = $game->fresh()->auto_reveal;
    $underItsButton = "(() => { const button = document.querySelector('header button[aria-label=\"Game settings\"]').getBoundingClientRect(); const panel = document.querySelector('[role=\"dialog\"]').getBoundingClientRect(); return panel.top >= button.bottom - 1 && panel.right <= window.innerWidth && panel.left >= 0; })()";

    $ada = $this->awaitRealtime($this->signIn($table['ada'], "/poker/{$game->id}"))->resize(1440, 900);

    $ada->click('[aria-label="Facilitator menu"]')
        ->assertSee('Hand over facilitation…')
        ->assertDontSee('Settings…')
        ->keys('[role="menu"]', 'Escape')
        ->assertNotPresent('[role="menu"]')
        ->click('header button[aria-label="Game settings"]')
        ->assertSeeIn('[role="dialog"]', 'Game settings')
        ->assertScript($underItsButton, true)
        ->assertPresent('[role="dialog"] #poker-title')
        ->assertAttribute('[role="dialog"] a:has-text("Manage decks")', 'href', route('teams.pokerDecks.index', [$game->team->workspace, $game->team], false))
        ->click('#poker-auto-reveal')
        ->assertSee('1 unapplied change')
        ->keys('[role="dialog"]', 'Escape')
        ->assertSee('Discard 1 changes?')
        ->click('[role="dialog"] button:has-text("Discard")')
        ->assertPresent('header button[aria-label="Game settings"][aria-expanded="false"]');

    expect($game->fresh()->auto_reveal)->toBe($autoReveal);

    $bob = $this->awaitRealtime($this->signIn($table['bob'], "/poker/{$game->id}"))->resize(1440, 900);

    $bob->assertNotPresent('[aria-label="Facilitator menu"]')
        ->click('header button[aria-label="Game settings"]')
        ->assertSeeIn('[role="dialog"]', 'Only the facilitator, Ada, can change these settings.')
        ->assertNotPresent('[role="dialog"] [role="switch"]')
        ->assertNotPresent('[role="dialog"] button:has-text("Apply")')
        ->resize(390, 844)
        ->assertNotPresent('header button[aria-label="Game settings"]')
        ->assertVisible('[data-slot="poker-subbar"] button[aria-label="Game settings"]');
});
