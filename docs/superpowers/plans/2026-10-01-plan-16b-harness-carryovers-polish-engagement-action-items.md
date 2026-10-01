# Plan 16b — Harness carry-overs and the polish, engagement and action-item walkthroughs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry the harness improvements deferred from plan 16a (a queue helper that cures the `toOthers()` artefact, a drag option, a stricter source scan, precise hooks) and automate the walkthroughs of plan 6 (polish pass), plan 7 (board engagement), plan 9a and plan 9b (action items v2) as browser tests.

**Architecture:** Browser tests live in `tests/Browser/Walkthroughs`, one file per walkthrough, bound to `Tests\BrowserTestCase` (built assets, a Reverb server started by the suite, authentication reset after every request so several browser contexts act as different users). Each walkthrough step maps to a test whose title starts with the step's identifier; the mapping is recorded in `docs/superpowers/walkthroughs/coverage.md`, and what cannot be automated in `residual-manual-checklist.md`. Tests sign in and join through the real interface, wait on `data-realtime` instead of sleeping, and arrange their own state with factories.

**Tech Stack:** PHP 8.4, Laravel 13, Pest 5 with `pestphp/pest-plugin-browser` 5.x (Playwright, Chromium), Laravel Reverb, Inertia v3 with React 19, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-10-01-browser-e2e-and-arch-tests-design.md` (this plan is one of its "later slices", §1). Read it, and read `docs/superpowers/walkthroughs/harness-findings.md`: it holds the facts proven by running the browser plugin against this application, and it overrides this plan's text where they differ.

**Depends on:** Plan 16a merged (browser harness, Arch suite, coverage table).

## Global Constraints

- No new dependency and no new base folder.
- Browser tests never call `actingAs()`, `withCookie()`, `withCookies()` or `Event::fake()` without arguments (the Arch source scan fails the build). Members sign in with `$this->signIn(...)`; guests join with `$this->joinAsGuest(...)`. `Http::fake([...])`, `Mail::fake()`, `Notification::fake()`, `Queue::fake()` and `Event::fake([Specific::class])` are allowed and apply to browser requests.
- No fixed sleep for realtime: `$this->awaitRealtime($page)` after opening a live page, act on one page, assert on the other. Assert that an element is visible before acting on it or reading from it. Send one key per `keys()` call where order matters.
- Selectors: English text and aria-labels first, locale English. A string containing `( ) : , = [ ] > + ~ * | ^ #` is CSS and must match exactly one element (except in `assertCount()`, `assertPresent()`, `assertNotPresent()`, `assertDontSeeIn()`); a bare tag name is NOT CSS. After choosing a Radix menu item, assert the menu is gone before reopening it.
- Product code gains only `data-test` attributes and the `data-realtime` attribute (spec criterion 10). Anything else found wrong in the product follows the Defect rule.
- Each test arranges its own state; no test depends on another. No comments in test code. Do not redeclare the global helper functions of other walkthrough files.
- PHP style as in the project guidelines. After editing PHP: `vendor/bin/pint --dirty --format agent`, PHPStan, and `composer rector:check` (if Rector wants to rewrite code the task wrote, apply `composer rector`, re-run Pint and the tests, and say so).
- After editing a `.tsx` or `.ts` file: `npm run types:check`, `npm run check`, `npm run build` (the browser suite serves `public/build`).
- `composer test` must stay free of browser tests; `composer test:arch` and `composer test:browser` must stay green.
- Task 1 changes the harness contract: `workQueue()` and the fourth parameter of `dragWithKeyboard()` exist only after it. Plans 16c, 16d and 16e depend on this task.
- Third parties in this plan: GIPHY or Tenor and the emoji data upstream, faked with `Http::fake()`; mail and notifications with `Mail::fake()` / `Notification::fake()`.

## Environment

- With Sail in the primary checkout: prefix `composer`, `artisan`, `pest` and `npm` with `vendor/bin/sail`.
- In a worktree on host PHP: `export DB_HOST=127.0.0.1 DB_DATABASE=<a test database of its own>` and run Pest as `php -d memory_limit=2G vendor/bin/pest …`.
- The browser suite needs built assets (`npm run build`), no `public/hot`, and port 8097 free (it starts its own Reverb server; an orphan from a killed run must be stopped first: `lsof -i :8097`).
- Run one test: `vendor/bin/pest tests/Browser/Walkthroughs/<File> --filter='<id>'`. Watch it: `--headed`. Pause on failure: `--debug`. Screenshots of failed assertions: `tests/Browser/Screenshots`.

## Defect rule

None of the code in this plan was executed while it was written: it was derived from reading the components, controllers and factories. When a test fails:

1. If the interface text or structure differs from the selector and the behaviour is right, fix the selector (smallest change) and note it in the task report.
2. If the behaviour is wrong against the feature's spec: stop the task, write a failing feature test where the behaviour is server-side, fix the defect in its own commit (`fix(<area>): …`), then return. Record it under "Defects found" in `docs/superpowers/walkthroughs/coverage.md`.
3. If the walkthrough's text and the feature's spec disagree, the feature's spec wins; record the difference in the coverage table's Notes.
4. If a harness assumption is wrong, follow `docs/superpowers/walkthroughs/harness-findings.md`, or stop and report when it has no answer.
5. Coverage statuses in this plan are provisional until the tests run: a row is `auto` or `auto-substituted` only when its test passes.

Run each finished test file twice in a row before committing it.

## Tasks

| # | Task |
|---|---|
| 1 | Harness helpers carried over from plan 16a (`workQueue()`, `dragWithKeyboard(..., handleRemains: false)`) |
| 1b | Stricter source scan and two retro `data-test` hooks |
| 2 | Plan 6 (polish pass) walkthrough |
| 3 | Board engagement walkthrough, part 1 (card reactions, comment threads, facilitator toggles, lock, presentation, vote totals) |
| 4 | Board engagement walkthrough, part 2 (live cursors, flying reactions, GIFs and emoji data through skrum) |
| 5 | Plan 9a walkthrough: action items on the board (priorities, assignees, comments, lock, anonymity, delete warning) |
| 6 | Plan 9b walkthrough, part 1: carry-over panel, workspace page, items outside a retro, sub-tasks and recurrence |
| 7 | Plan 9b walkthrough, part 2: reminders, the notification bell and the notification settings |
| 8 | Coverage table and residual checklist |
| 9 | Final verification |

## Review Focus

Conditions the spec implies that a happy-path reading could miss, each pinned by a test.

1. A job run inside a browser test must reach every open page, including the one that made the last request. Expected: both pages update. Pinned by the smoke test Task 1 adds for `workQueue()`.
2. The source scan must catch calls written with spaces or across lines and the other ways of signing in without the interface. Expected: the Arch suite fails on each. Pinned by the red and green demonstration of Task 1 (or 1b).
3. A second tab of the same member is a second browser context signed in as the same user. Expected: it sees its own card during Writing while others do not. Pinned by the plan 6 tests of Task 2.
4. A reminder must be sent at most once per item and due date. Expected: running the command twice sends nothing new. Pinned by the reminder tests of Task 7.
5. The browser must never call the GIF provider or the emoji CDN itself. Expected: every media URL on the page is same-origin. Pinned by the GIF tests of Task 4.

---

### Task 1: Harness helpers carried over from plan 16a (`workQueue()`, `dragWithKeyboard(..., handleRemains: false)`)

Plan 16a left two workarounds inside walkthrough files. This task moves both into the harness, because every later walkthrough needs them.

1. **Queued jobs that broadcast.** A browser request is handled by the test's own application instance, and Laravel keeps the last handled request bound in the container. `App\Events\Concerns\SendsToOthers` calls `broadcast($this)->toOthers()`, which reads `X-Socket-ID` from that bound request (`Illuminate\Broadcasting\BroadcastManager::socket()`), so a job run by the test body skips the page that made the last browser request. `p10bWorkQueueOutsideAnyRequest()` in `tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php` cures it by binding a fresh request before `queue:work --once`. The cure moves to `workQueue()` only, not to `BrowserTestCase::isolateRequests()`: that listener runs on `RequestHandled`, inside the kernel and before the plugin calls `$kernel->terminate()`, so replacing the bound request there would change what every terminating middleware of every browser request resolves from the container, for the benefit of the one moment where the test body runs server-side code outside a request.
2. **A keyboard drag whose drop removes the handle.** `dragWithKeyboard()` ends with `assertAttributeMissing($handle, 'aria-pressed')`, which cannot pass when the dropped card is re-rendered without its handle (grouping a retro card). `[P04-03]` inlines the recipe. The helper gains `$handleRemains`, and refuses fewer than two keys instead of calling `keys()` with `null`.

**Files:**
- Modify: `tests/Browser/Support/InteractsWithBrowser.php` (adds `workQueue()`, extends `dragWithKeyboard()`)
- Create: `tests/Browser/Smoke/QueuedBroadcastTest.php`
- Modify: `tests/Browser/Smoke/KeyboardDragTest.php` (adds the guard test)
- Modify: `tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php` (uses `$this->workQueue()`, drops the local helper and two imports)
- Modify: `tests/Browser/Walkthroughs/Plan04RetroCoreTest.php` (`[P04-03]` uses the helper)
- Modify: `docs/superpowers/walkthroughs/harness-findings.md`
- Modify: `docs/superpowers/specs/2026-10-01-browser-e2e-and-arch-tests-design.md` (§3.5 and §3.6, the helper table and the timer row)
- Test: `tests/Browser/Smoke/QueuedBroadcastTest.php`, `tests/Browser/Smoke/KeyboardDragTest.php`

**Interfaces:**
- Consumes: `Tests\BrowserTestCase` with `signIn()`, `awaitRealtime()`, `dragWithKeyboard()` (plan 16a, Tasks 2 to 4); `pokerFacilitator()`, `pokerMember()`, `openPokerRound()` from `tests/Pest.php`.
- Produces, in `Tests\Browser\Support\InteractsWithBrowser`:

```php
/** Runs $jobs queued jobs, each outside any browser request, so a broadcast made by the job reaches every open page. */
protected function workQueue(int $jobs = 1): void;

/** $handleRemains = false: the drop removes the handle (e.g. grouping a card), so the helper ends by asserting the handle is gone instead of asserting aria-pressed is cleared. */
protected function dragWithKeyboard(mixed $page, string $handleSelector, array $keys, bool $handleRemains = true): mixed;
```

  `workQueue()` runs `queue:work --once` once per job. The test must have set `config(['queue.default' => 'database'])` before the action that queued the job, and must pass the exact number of jobs waiting: `queue:work --once` on an empty queue sleeps three seconds before it returns. `dragWithKeyboard()` throws `InvalidArgumentException` when `$keys` has fewer than two entries.

Both walkthrough files are being edited by the plan 16a fix wave while this plan is written. Before each edit below, find the lines by their content, not by a line number.

- [ ] **Step 1: Write the failing smoke test for a queued broadcast**

Create `tests/Browser/Smoke/QueuedBroadcastTest.php` by hand (`php artisan make:test` cannot create files under `tests/Browser`):

```php
<?php

use App\Models\PokerGame;
use Illuminate\Support\Facades\DB;

it('delivers a broadcast made by a queued job to every open page', function () {
    config(['queue.default' => 'database']);

    $game = PokerGame::factory()->create(['auto_reveal' => true]);
    [$facilitator] = pokerFacilitator($game);
    [$member] = pokerMember($game);
    $facilitator->update(['name' => 'Ada', 'locale' => 'en']);
    $member->update(['name' => 'Bob', 'locale' => 'en']);
    openPokerRound($game);

    $facilitatorPage = $this->awaitRealtime($this->signIn($facilitator, "/poker/{$game->id}"));
    $memberPage = $this->awaitRealtime($this->signIn($member, "/poker/{$game->id}"));

    foreach ([$facilitatorPage, $memberPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]');
    }

    $facilitatorPage->click('[aria-label="Timer"]')
        ->assertSee('30 s')
        ->click('30 s');

    foreach ([$facilitatorPage, $memberPage] as $page) {
        $page->assertSeeIn('[role="timer"]', '0:');
    }

    $memberPage->click('button[aria-label="Play 8"]');
    $facilitatorPage->assertPresent('[role="img"][aria-label="Bob: Voted"]');

    expect(DB::table('jobs')->count())->toBe(1);

    $this->travel(31)->seconds();
    $this->workQueue();

    foreach ([$facilitatorPage, $memberPage] as $page) {
        $page->assertSee("Revealed automatically — time's up");
    }

    expect(DB::table('jobs')->count())->toBe(0);
});
```

This is the smallest part of `[P10b-08a]` that shows the artefact: the member votes last, so the member's request is the one left bound in the container when the job runs.

- [ ] **Step 2: Run it and see it fail on the missing helper**

Run: `vendor/bin/pest tests/Browser/Smoke/QueuedBroadcastTest.php`
Expected: FAIL with "Call to undefined method" for `workQueue`.

- [ ] **Step 3: Add `workQueue()` without the fresh request**

In `tests/Browser/Support/InteractsWithBrowser.php`, add this method after `awaitRealtime()`:

```php
    protected function workQueue(int $jobs = 1): void
    {
        for ($job = 0; $job < $jobs; $job++) {
            $this->artisan('queue:work', ['--once' => true])->assertSuccessful();
        }
    }
```

This version is deliberately incomplete. It exists for one run, to see the artefact that the next step cures.

- [ ] **Step 4: Run it and see the artefact**

Run: `vendor/bin/pest tests/Browser/Smoke/QueuedBroadcastTest.php`
Expected: FAIL after about 20 seconds on `assertSee("Revealed automatically — time's up")`. The failure screenshot in `tests/Browser/Screenshots` shows the page whose request was handled last (the member's, who voted last) still on the open round, while the other page shows the reveal. If the test passes here, the artefact is not reproduced: stop and report it, because the cure of Step 5 would then be unproven.

- [ ] **Step 5: Bind a fresh request before each job**

In `tests/Browser/Support/InteractsWithBrowser.php`, add `use Illuminate\Http\Request;` below `use App\Models\User;` and replace the method of Step 3 with:

```php
    /** Runs $jobs queued jobs, each outside any browser request, so a broadcast made by the job reaches every open page. */
    protected function workQueue(int $jobs = 1): void
    {
        for ($job = 0; $job < $jobs; $job++) {
            $this->app->instance('request', Request::create('/'));

            $this->artisan('queue:work', ['--once' => true])->assertSuccessful();
        }
    }
```

The request is bound again before every job, not once: a browser page may send a request between two jobs (a refetch caused by the first job's broadcast), which would bind its own request again.

- [ ] **Step 6: Run it and see it pass**

Run: `vendor/bin/pest tests/Browser/Smoke/QueuedBroadcastTest.php`
Expected: PASS, 1 test.

- [ ] **Step 7: Use `workQueue()` in the poker additions walkthrough**

In `tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php`:

Delete these two imports (nothing else in the file uses them; confirm with `grep -n 'Request\|TestCase' tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php` after the edit, which must print nothing):

```php
use Illuminate\Http\Request;
```

```php
use Tests\TestCase;
```

Delete the local helper:

```php
function p10bWorkQueueOutsideAnyRequest(TestCase $test): void
{
    app()->instance('request', Request::create('/'));

    $test->artisan('queue:work', ['--once' => true])->assertSuccessful();
}
```

Replace each of the three calls (in `[P10b-08a]`, `[P10b-08b]` and `[P10b-09]`):

```php
    p10bWorkQueueOutsideAnyRequest($this);
```

with:

```php
    $this->workQueue();
```

Run `grep -rn 'p10bWorkQueueOutsideAnyRequest' tests/`. Expected: no output.

- [ ] **Step 8: Run the three timer tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php --filter='P10b-08|P10b-09'`
Expected: PASS, 3 tests. A failure here means the helper differs from the local one it replaces: compare the two bodies.

- [ ] **Step 9: Write the failing guard test for `dragWithKeyboard()`**

Append to `tests/Browser/Smoke/KeyboardDragTest.php`:

```php

it('refuses a keyboard drag with fewer than two keys', function () {
    expect(fn () => $this->dragWithKeyboard(null, '#handle', ['Space']))
        ->toThrow(InvalidArgumentException::class, 'dragWithKeyboard() needs at least two keys: the first picks the item up and the last drops it.');
});
```

The test opens no page: the guard must throw before the helper touches `$page`.

- [ ] **Step 10: Run it and see it fail**

Run: `vendor/bin/pest tests/Browser/Smoke/KeyboardDragTest.php --filter='fewer than two keys'`
Expected: FAIL. The helper throws `Error: Call to a member function keys() on null` instead of `InvalidArgumentException`.

- [ ] **Step 11: Replace the inlined drag recipe in `[P04-03]`**

In `tests/Browser/Walkthroughs/Plan04RetroCoreTest.php`, in the test `[P04-03] groups, ungroups and moves a card during Grouping`, replace:

```php
    $bobPage->keys($handle, 'Space')
        ->assertAttribute($handle, 'aria-pressed', 'true');
    $bobPage->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 0))');
    $bobPage->keys($handle, 'ArrowDown');
    $bobPage->script('() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
    $bobPage->keys($handle, 'Space')
        ->assertNotPresent($handle);
```

with:

```php
    $this->dragWithKeyboard($bobPage, $handle, ['Space', 'ArrowDown', 'Space'], handleRemains: false);
```

Leave the rest of the test as it is. Its second drag, `$this->dragWithKeyboard($bobPage, $handle, ['Space', 'ArrowRight', 'Space']);`, keeps the default and so covers `handleRemains: true` in the same test.

- [ ] **Step 12: Run `[P04-03]` and see it fail**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan04RetroCoreTest.php --filter='P04-03'`
Expected: FAIL with "Unknown named parameter $handleRemains".

- [ ] **Step 13: Extend `dragWithKeyboard()`**

`tests/Browser/Support/InteractsWithBrowser.php` becomes, in full:

```php
<?php

namespace Tests\Browser\Support;

use App\Models\User;
use Illuminate\Http\Request;
use InvalidArgumentException;

trait InteractsWithBrowser
{
    protected function signIn(User $user, string $to = '/dashboard'): mixed
    {
        $page = visit('/login');

        $page->fill('#email', $user->email)
            ->fill('#password', 'password')
            ->click('@login-button')
            ->assertPathIsNot('/login');

        $page->navigate($to);

        return $page;
    }

    protected function joinAsGuest(string $joinUrl, string $name): mixed
    {
        $joinPath = (string) parse_url($joinUrl, PHP_URL_PATH);
        $page = visit($joinUrl);

        $page->fill('#name', $name)
            ->click('Join')
            ->assertPathIsNot($joinPath);

        return $page;
    }

    protected function awaitRealtime(mixed $page): mixed
    {
        $page->assertAttribute('[data-realtime]', 'data-realtime', 'connected');

        return $page;
    }

    /** Runs $jobs queued jobs, each outside any browser request, so a broadcast made by the job reaches every open page. */
    protected function workQueue(int $jobs = 1): void
    {
        for ($job = 0; $job < $jobs; $job++) {
            $this->app->instance('request', Request::create('/'));

            $this->artisan('queue:work', ['--once' => true])->assertSuccessful();
        }
    }

    /**
     * dnd-kit's keyboard sensor starts listening one timer turn after the pick-up and reads
     * the drop target only once React has rendered the move, so each key waits for the page.
     *
     * $handleRemains = false: the drop removes the handle (e.g. grouping a card), so the helper
     * ends by asserting the handle is gone instead of asserting aria-pressed is cleared.
     *
     * @param  array<int, string>  $keys
     */
    protected function dragWithKeyboard(mixed $page, string $handleSelector, array $keys, bool $handleRemains = true): mixed
    {
        throw_if(count($keys) < 2, InvalidArgumentException::class, 'dragWithKeyboard() needs at least two keys: the first picks the item up and the last drops it.');

        $pickUp = array_shift($keys);
        $drop = array_pop($keys);

        $page->keys($handleSelector, $pickUp);
        $page->assertAttribute($handleSelector, 'aria-pressed', 'true');
        $page->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 0))');

        foreach ($keys as $key) {
            $page->keys($handleSelector, $key);
            $page->script('() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
        }

        $page->keys($handleSelector, $drop);

        if (! $handleRemains) {
            $page->assertNotPresent($handleSelector);

            return $page;
        }

        $page->assertAttributeMissing($handleSelector, 'aria-pressed');

        return $page;
    }
}
```

The guard is written with `throw_if()` because the project's Rector configuration rewrites an `if` that only throws into that form (`tests/Browser/Support/ReverbServer.php` already carries one).

- [ ] **Step 14: Run the drag tests and see them pass**

Run: `vendor/bin/pest tests/Browser/Smoke/KeyboardDragTest.php`
Expected: PASS, 2 tests.

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan04RetroCoreTest.php --filter='P04-03|P04-14c'`
Expected: PASS, 2 tests. `[P04-03]` exercises both values of `$handleRemains`; `[P04-14c]` the default on a sortable card.

- [ ] **Step 15: Record the change in the harness findings**

Open `docs/superpowers/walkthroughs/harness-findings.md` and read the section "Findings from plan 16a" as it stands at that time (the plan 16a fix wave wrote it; do not repeat its facts). Make two adjustments inside it and one addition after it.

Adjustment 1. Under "Broadcasts fired from test code (`toOthers()`)", replace the bullet that starts with "Workaround:" (it names `p10bWorkQueueOutsideAnyRequest()`, which no longer exists) with:

```markdown
- Cure: `$this->workQueue()` (plan 16b, Task 1) binds a fresh `Request::create('/')` and then runs `queue:work --once`, once per job. Code that broadcasts from the test body without a queued job (an action or a model event called directly) binds the fresh request itself first: `app()->instance('request', Request::create('/'))`.
```

Adjustment 2. Under "Keyboard drag", replace the bullet that says the helper cannot be used when the drop removes the handle with:

```markdown
- `dragWithKeyboard()` ends with `assertAttributeMissing($handle, 'aria-pressed')` by default, which cannot pass when the drop removes the handle (dropping a card onto another to group them). Pass `handleRemains: false` for such a drop; `[P04-03]` does.
```

Addition. Append at the end of the file:

```markdown

## Findings from plan 16b, Task 1

### `workQueue()`

- `$this->workQueue(int $jobs = 1)` lives in `tests/Browser/Support/InteractsWithBrowser.php`. Before each job it binds a fresh request in the container and runs `queue:work --once`, so `toOthers()` finds no `X-Socket-ID` and the job's broadcast reaches every open page. `tests/Browser/Smoke/QueuedBroadcastTest.php` pins it: without the fresh request the page that voted last never sees the timer reveal.
- The cure is in `workQueue()` only, not in `BrowserTestCase::isolateRequests()`: that listener runs inside the kernel, before the plugin terminates the request, and changing the bound request there would affect the terminating middleware of every browser request.
- The test sets `config(['queue.default' => 'database'])` before the action that queues the job. Pass the exact number of waiting jobs: `queue:work --once` on an empty queue sleeps three seconds before it returns.
- The request is bound again before every job, because a page may send a request (a refetch) between two jobs.

### `dragWithKeyboard()`

- `handleRemains: false` ends the helper with `assertNotPresent($handle)` instead of `assertAttributeMissing($handle, 'aria-pressed')`. Use it when the dropped item is rendered again without its handle (a retro card dropped onto another card in Grouping).
- Fewer than two keys throws `InvalidArgumentException` ("dragWithKeyboard() needs at least two keys: the first picks the item up and the last drops it."). Before, the helper called `keys()` with `null` and failed after the 20 s timeout with a Playwright message.
```

- [ ] **Step 16: Align the spec's helper table**

In `docs/superpowers/specs/2026-10-01-browser-e2e-and-arch-tests-design.md`, §3.5, replace the table row:

```markdown
| `dragWithKeyboard($page, $handle, array $keys)` | Moves a sortable item with the keyboard (focus, Space, arrows, Space). |
```

with:

```markdown
| `dragWithKeyboard($page, $handle, array $keys, bool $handleRemains = true)` | Moves a sortable item with the keyboard (focus, Space, arrows, Space). `handleRemains: false` when the drop removes the handle. |
| `workQueue(int $jobs = 1)` | Runs that many queued jobs, each outside any browser request, so a broadcast made by a job reaches every open page. |
```

In §3.6, in the row "A timer reaching zero", replace "then runs one queued job" with "then runs the queued job with `workQueue()`". If the fix wave has reworded either line, apply the same change to the line as it reads then.

- [ ] **Step 17: Run the smoke folder and the two walkthrough files**

Run: `vendor/bin/pest tests/Browser/Smoke`
Expected: PASS, 9 tests (the 7 of plan 16a, the queued broadcast test and the guard test).

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php tests/Browser/Walkthroughs/Plan04RetroCoreTest.php`
Expected: PASS, every test of both files. A failure in a test this task did not touch is not caused by this task: report it.

- [ ] **Step 18: Run the static checks**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining style issue.

Run: `composer test:arch`
Expected: PASS. The source scan still finds no forbidden call under `tests/Browser`.

Run: `vendor/bin/phpstan analyse`
Expected: no error (the `tests/` folder is not analysed; this confirms nothing else moved).

Run: `composer rector:check`
Expected: no change proposed. If Rector proposes a change to a file of this task, run `composer rector`, then the tests of Step 17 again.

- [ ] **Step 19: Commit**

```bash
git add tests/Browser/Support/InteractsWithBrowser.php tests/Browser/Smoke/QueuedBroadcastTest.php tests/Browser/Smoke/KeyboardDragTest.php tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php tests/Browser/Walkthroughs/Plan04RetroCoreTest.php docs/superpowers/walkthroughs/harness-findings.md docs/superpowers/specs/2026-10-01-browser-e2e-and-arch-tests-design.md
git commit -m "test(browser): move the queued-job and handle-removing drag workarounds into the harness"
```

### Task 1b: Stricter source scan and two retro `data-test` hooks

Two findings of the plan 16a final review.

1. `tests/Arch/BrowserTestRulesTest.php` looks for four literal substrings, one line at a time. It misses `actingAs (` (a space), a call split over two lines, and the other ways to sign a user in or to inject a cookie without the interface: `be()`, `Auth::login()`, `loginUsingId()`, `withUnencryptedCookie()`. The scan moves to regular expressions over the whole file.
2. Two selectors of `Plan04RetroCoreTest.php` depend on the page's structure rather than on what the element is: `aside:not([aria-label])` for the action-items panel (it works only because the suggestions panel happens to carry an `aria-label`), and the selector of the "Sort by votes" toggle (`button[aria-pressed="true"]` in plan 16a as committed; the fix wave may have changed it to the button's English text). Both get a `data-test` hook, which spec §3.7 allows where text or labels are ambiguous. Later walkthroughs (plans 6, 8 and 9) address the same panel.

**Files:**
- Modify: `tests/Arch/BrowserTestRulesTest.php`
- Modify: `resources/js/components/retro/action-items-panel.tsx` (adds `data-test="retro-action-items-panel"`)
- Modify: `resources/js/components/retro/retro-column.tsx` (adds `data-test="retro-sort-by-votes"`)
- Modify: `tests/Browser/Walkthroughs/Plan04RetroCoreTest.php`
- Test: `tests/Arch/BrowserTestRulesTest.php`, `tests/Browser/Walkthroughs/Plan04RetroCoreTest.php`

**Interfaces:**
- Consumes: the `Arch` suite of plan 16a, Task 5.
- Produces:
  - `forbiddenBrowserTestCalls(string $directory): array` reports, for every `.php` file under `$directory`, `"{path}:{line} calls {name}"` where `{name}` is one of `actingAs()`, `be()`, `login()`, `loginUsingId()`, `withCookie()`, `withUnencryptedCookie()`, `Event::fake() without arguments`.
  - `[data-test="retro-action-items-panel"]`: the `<aside>` of the retro action-items panel (Discussing phase).
  - `[data-test="retro-sort-by-votes"]`: the "Sort by votes" toggle of a retro column (one per column; address one with `[data-test="retro-column-{id}"] [data-test="retro-sort-by-votes"]`).

The `Arch` suite is bound to no Laravel test case (`tests/Pest.php` binds only `Feature` and `Browser`), so its tests use plain PHP functions, not facades.

- [ ] **Step 1: Write the failing tests for the forms the scan must catch**

Append to `tests/Arch/BrowserTestRulesTest.php`:

```php

dataset('forbiddenBrowserTestForms', [
    'actingAs' => ['$this->actingAs($user);', 'actingAs()'],
    'actingAs followed by a space' => ['$this->actingAs ($user);', 'actingAs()'],
    'actingAs split over two lines' => ["\$this->actingAs\n    (\$user);", 'actingAs()'],
    'be' => ['$this->be($user);', 'be()'],
    'Auth::login' => ['Auth::login($user);', 'login()'],
    'auth()->login' => ['auth()->login($user);', 'login()'],
    'loginUsingId' => ['Auth::loginUsingId(1);', 'loginUsingId()'],
    'withCookie' => ['$this->withCookie("guest", "1|secret");', 'withCookie()'],
    'withCookies' => ['$this->withCookies(["guest" => "1|secret"]);', 'withCookie()'],
    'withUnencryptedCookie' => ['$this->withUnencryptedCookie("guest", "1|secret");', 'withUnencryptedCookie()'],
    'withUnencryptedCookies' => ['$this->withUnencryptedCookies(["guest" => "1|secret"]);', 'withUnencryptedCookie()'],
    'Event::fake' => ['Event::fake();', 'Event::fake() without arguments'],
    'Event::fake split over two lines' => ["Event::fake(\n);", 'Event::fake() without arguments'],
]);

it('reports a forbidden call in a browser test', function (string $code, string $call) {
    $directory = sys_get_temp_dir().'/skrum-browser-rules-'.bin2hex(random_bytes(4));
    mkdir($directory);
    file_put_contents("{$directory}/CheatTest.php", "<?php\n\n{$code}\n");

    try {
        expect(forbiddenBrowserTestCalls($directory))->toBe(["{$directory}/CheatTest.php:3 calls {$call}"]);
    } finally {
        unlink("{$directory}/CheatTest.php");
        rmdir($directory);
    }
})->with('forbiddenBrowserTestForms');

it('allows a fake of named events and the calls that only look like a forbidden one', function () {
    $directory = sys_get_temp_dir().'/skrum-browser-rules-'.bin2hex(random_bytes(4));
    mkdir($directory);
    file_put_contents("{$directory}/HonestTest.php", "<?php\n\nEvent::fake([CardCreated::class]);\nexpect(\$count)->toBe(1);\n\$page = \$this->signIn(\$user);\n\$url = route('login');\n");

    try {
        expect(forbiddenBrowserTestCalls($directory))->toBe([]);
    } finally {
        unlink("{$directory}/HonestTest.php");
        rmdir($directory);
    }
});
```

The fixture files are written to the system's temporary folder, never under `tests/Browser`, so a failing or interrupted run leaves nothing for the real scan to find.

- [ ] **Step 2: Run them and see them fail**

Run: `vendor/bin/pest tests/Arch/BrowserTestRulesTest.php`
Expected: FAIL for all 13 datasets of "reports a forbidden call in a browser test", PASS for the two other tests. Nine datasets fail because the substring scan returns `[]` (it misses the form: the space, the two line breaks, `be`, the two `login` forms, `loginUsingId`, the two `withUnencryptedCookie` forms); the other four fail only on the wording of the offence (`calls actingAs(` instead of `calls actingAs()`), which Step 3 changes.

- [ ] **Step 3: Rewrite the scan with regular expressions**

In `tests/Arch/BrowserTestRulesTest.php`, replace the whole function `forbiddenBrowserTestCalls()` with:

```php
/**
 * @return array<int, string>
 */
function forbiddenBrowserTestCalls(string $directory): array
{
    if (! is_dir($directory)) {
        return [];
    }

    $forbiddenCalls = [
        'actingAs()' => '/\bactingAs\s*\(/i',
        'be()' => '/(?:->|::)\s*be\s*\(/i',
        'login()' => '/(?:->|::)\s*login\s*\(/i',
        'loginUsingId()' => '/\bloginUsingId\s*\(/i',
        'withCookie()' => '/\bwithCookies?\s*\(/i',
        'withUnencryptedCookie()' => '/\bwithUnencryptedCookies?\s*\(/i',
        'Event::fake() without arguments' => '/\bEvent\s*::\s*fake\s*\(\s*\)/i',
    ];
    $offences = [];
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS));

    foreach ($files as $file) {
        if ($file->getExtension() !== 'php') {
            continue;
        }

        $source = (string) file_get_contents($file->getPathname());

        foreach ($forbiddenCalls as $name => $pattern) {
            preg_match_all($pattern, $source, $matches, PREG_OFFSET_CAPTURE);

            foreach ($matches[0] as [, $offset]) {
                $lineNumber = substr_count($source, "\n", 0, $offset) + 1;
                $offences[] = "{$file->getPathname()}:{$lineNumber} calls {$name}";
            }
        }
    }

    sort($offences);

    return $offences;
}
```

Leave the existing test `keeps browser tests free of actingAs, injected cookies and a blanket event fake` as it is. Why each pattern is safe: `be` and `login` are matched only as a method call (`->` or `::` directly before the name), so `->toBe(`, `route('login')` and `visit('/login')` do not match; `\s*` between a name and its parenthesis covers a space and a line break; PHP method names are case-insensitive, hence the `i` flag; the reported line is the line where the call's name starts.

- [ ] **Step 4: Run them and see them pass**

Run: `vendor/bin/pest tests/Arch/BrowserTestRulesTest.php`
Expected: PASS, 15 tests (the scan of `tests/Browser`, the 13 datasets and the allowed forms). If the scan of `tests/Browser` now fails, it names a real forbidden call the old scan missed: remove that call from the browser test (sign in through `$this->signIn()`), do not weaken the pattern.

- [ ] **Step 5: Add the two `data-test` hooks**

In `resources/js/components/retro/action-items-panel.tsx`, replace:

```tsx
        <aside className="w-full shrink-0 space-y-3 p-4 lg:sticky lg:top-4 lg:max-h-dvh lg:w-80 lg:self-start lg:overflow-y-auto">
```

with:

```tsx
        <aside
            data-test="retro-action-items-panel"
            className="w-full shrink-0 space-y-3 p-4 lg:sticky lg:top-4 lg:max-h-dvh lg:w-80 lg:self-start lg:overflow-y-auto"
        >
```

In `resources/js/components/retro/retro-column.tsx`, replace:

```tsx
                    <Button
                        size="sm"
                        variant={isSortedByVotes ? 'secondary' : 'ghost'}
                        className="self-start"
                        aria-pressed={isSortedByVotes}
```

with:

```tsx
                    <Button
                        size="sm"
                        variant={isSortedByVotes ? 'secondary' : 'ghost'}
                        className="self-start"
                        data-test="retro-sort-by-votes"
                        aria-pressed={isSortedByVotes}
```

`Button` (`resources/js/components/ui/button.tsx`) spreads its remaining props onto the element, so the attribute reaches the DOM.

- [ ] **Step 6: Check and build the frontend**

Run: `npm run types:check`
Expected: no error.

Run: `npm run check`
Expected: no new finding in the two edited files (the known formatting findings in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md` are unrelated).

Run: `npm run build`
Expected: the build succeeds. The browser suite serves `public/build`, so the hooks do not exist for the tests until this has run.

- [ ] **Step 7: Use the hooks in the plan 4 walkthrough**

In `tests/Browser/Walkthroughs/Plan04RetroCoreTest.php`:

Replace every occurrence of the string `aside:not([aria-label])` with `[data-test="retro-action-items-panel"]`. At the time of writing there are seven: five in `[P04-05c]`, one in `[P04-13]`, and the `$panel` variable of `[P04-15a]`, whose value is also inserted into `document.querySelector('…')` (the attribute selector uses double quotes, so it fits inside those single quotes unchanged). Run `grep -n 'aside:not' tests/Browser/Walkthroughs/Plan04RetroCoreTest.php` afterwards. Expected: no output.

In `[P04-05a]`, address the sort toggle by its hook. If the test reads (plan 16a as committed):

```php
    $start = plan04Column($columns[0]);
```

```php
        ->click("{$start} button[aria-pressed=\"true\"]")
        ->assertPresent("{$start} button[aria-pressed=\"false\"]")
```

replace those lines with:

```php
    $sort = plan04Column($columns[0]).' [data-test="retro-sort-by-votes"]';
```

```php
        ->assertAriaAttribute($sort, 'pressed', 'true')
        ->click($sort)
        ->assertAriaAttribute($sort, 'pressed', 'false')
```

If the fix wave already introduced the `$sort` variable with the three calls above and the value `plan04Column($columns[0]).' button:has-text("Sort by votes")'`, change only that value to `plan04Column($columns[0]).' [data-test="retro-sort-by-votes"]'`.

- [ ] **Step 8: Run the tests that use the hooks**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan04RetroCoreTest.php --filter='P04-05a|P04-05c|P04-13|P04-15a'`
Expected: PASS, 5 tests (`[P04-13]` runs for two locales). A failure with "element not found" for a `data-test` selector means the build of Step 6 is stale: run `npm run build` again.

- [ ] **Step 9: Run the whole file and the static checks**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan04RetroCoreTest.php`
Expected: PASS, every test.

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining style issue.

Run: `composer test:arch`
Expected: PASS.

Run: `composer rector:check`
Expected: no change proposed. If Rector proposes a change to `tests/Arch/BrowserTestRulesTest.php`, run `composer rector`, then Step 4 again.

- [ ] **Step 10: Commit**

```bash
git add tests/Arch/BrowserTestRulesTest.php resources/js/components/retro/action-items-panel.tsx resources/js/components/retro/retro-column.tsx tests/Browser/Walkthroughs/Plan04RetroCoreTest.php
git commit -m "test: scan browser tests with regular expressions and add hooks for the retro action-items panel and sort toggle"
```

### Task 2: Plan 6 (polish pass) walkthrough

This task automates the walkthrough of the polish pass: `docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md`, Task 6, Steps 2 to 5 (lines 717 to 720). Feature spec: `docs/superpowers/specs/2026-09-29-polish-pass-design.md`, acceptance criteria PA1 to PA5, PB1 to PB6, PD1 and PE3. Step 1 (the full checks) and Step 6 (the report) are not walkthrough steps and have no row.

What the tests do where the walkthrough asked for something a browser test cannot do directly:

- **"Vote during a refetch" (PA1) and "the assignee select is disabled while saving" (PB6)** need a request to be in flight at a chosen moment. The application server answers in a few milliseconds, so the test holds the response inside the page. `plan06RecordRequests()` wraps `XMLHttpRequest.prototype.open` and `send` in the page (Inertia's HTTP client, which `resources/js/lib/retro/api.ts` uses, sets `xhr.onload` and then calls `xhr.send()`; see `node_modules/@inertiajs/core/dist/index.js`, `doRequest`). The wrapper records every request as `"METHOD /path"` in `window.plan06Requests.sent`, and delivers the response to the application either at once or, for a request named with `plan06Hold()`, only when the test calls `plan06Release()`. The server has already answered a held request: the snapshot that the board receives late was built before the vote, which is exactly the situation PA1 describes. This is test code injected into the page, not product code.
- **"Double-click vote" (PB2):** the plugin has no double-click. `plan06DoubleClick()` calls `click()` twice on the element in one script, with no rendering in between, and the test asserts that exactly one request was sent.
- **"Sign out in another tab of the same session" (PA5):** `visit()` always opens a new browser context, so a second tab that shares the first tab's cookies cannot be opened. `plan06SignOutElsewhere()` sends `POST /logout` from the board page itself with `fetch()`, which ends the same session through the same cookies and leaves the board on screen, as the other tab would.
- **"`docker pause` the app container" (PA4):** the server runs inside the test process, so the test stalls one request instead: a `RouteMatched` listener sleeps 15.5 seconds on the first `retros.cards.votes.store` request, longer than the 15-second timeout of `resources/js/lib/retro/api.ts`. The sleep blocks the whole test process, as a paused container would; it is the simulated outage, not a wait for realtime. The toast stays four seconds, of which about 3.5 remain when the process wakes up.
- **"Drag a card near the right edge: preview visible" (PB1):** pointer drags are unreliable with the board's 6-pixel activation distance (spec §3.5), and "visible, not clipped" is a visual judgement. The test picks the card up with the keyboard and asserts the two structural facts of PB1: the preview is rendered outside the scrolling `<main>` in a fixed-position layer, and it is as wide as the card. The pointer drag stays residual.
- **Keyboard-only grouping and moving (PD1)** is already covered by `[P04-03]`, which Task 1 of this plan rewrote onto `dragWithKeyboard(..., handleRemains: false)`. It is not duplicated here; the coverage row points at it.
- **The amd64 image (PE3)** is packaging: residual.

Facts about the interface that the selectors rely on (read from the current code):

- A card is `<article id="card-{id}">`; a column is `[data-test="retro-column-{id}"]`; a card's drag handle is `[data-test="retro-card-handle-{id}"]` (plan 16a). The drag preview is the only `<article>` without an `id` (`CardPreview` in `resources/js/components/retro/retro-card.tsx`).
- Vote buttons are `aria-label="Add a vote"` and `"Remove a vote"`; the header shows "Votes left: N" and "N of M vote(s) cast" (`vote-controls.tsx`, `vote-progress.tsx`). During Voting a card shows its total in a badge labelled "N vote(s)" unless "Hide vote counts" is on.
- The card editor's textarea and the edit button share the label "Edit card", so the tests address them as `#card-{id} textarea` and `#card-{id} button[aria-label="Edit card"]`.
- The column menu trigger is `aria-label="Column menu"`; its confirmation dialog reads "Delete the column {title}?" and has the buttons "Cancel" and "Delete" (`column-header.tsx`). The server refuses with "This column still has cards." (`app/Http/Controllers/Retros/ColumnsController.php`).
- The add-column form is the only `<form>` that contains a `role="radiogroup"` (`add-column.tsx`); its colour radios are labelled "Green", "Red", "Blue", "Amber", "Purple", "Slate".
- The session-expired banner is `<div role="alert">` with "Your session has expired." and a "Reload" button; while it shows, the rest of the board is inside a `<div inert>` that is a direct child of the `[data-realtime]` root (`board.tsx`, `session-expired-banner.tsx`).
- A retro without guest access redirects a signed-out visitor to `/login`; a guest-enabled retro shows the page "Your session has ended." (`app/Http/Middleware/ResolveRetroParticipant.php`, `resources/js/pages/retros/session-ended.tsx`).
- Toasts are sonner toasts: every toast element carries `data-sonner-toast`.

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan06PolishPassTest.php`
- Test: `tests/Browser/Walkthroughs/Plan06PolishPassTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` with `$this->signIn(User $user, string $to): mixed` and `$this->awaitRealtime(mixed $page): mixed`.
  - `[data-test="retro-action-items-panel"]` (Task 1b of this plan), `[data-test="retro-column-{id}"]` and `[data-test="retro-card-handle-{id}"]` (plan 16a).
  - `[P04-03]` in `tests/Browser/Walkthroughs/Plan04RetroCoreTest.php` as rewritten by Task 1 (coverage only; nothing is called).
  - Helpers of `tests/Pest.php`: `retroFacilitator(Retro $retro): array{0: User, 1: Participant}`, `retroMember(Retro $retro): array{0: User, 1: Participant}`.
- Produces: twelve tests `[P06-02]` to `[P06-11]`; the file-level helpers `plan06Board()`, `plan06Card()`, `plan06Column()`, `plan06RecordRequests()`, `plan06Hold()`, `plan06Release()`, `plan06Held()`, `plan06Count()`, `plan06DoubleClick()`, `plan06SignOutElsewhere()`. No product code changes.

Pint removes unused imports, so each step below adds the imports that its own code uses.

- [ ] **Step 1: Create the file with its helpers and the two realtime-consistency tests**

Create `tests/Browser/Walkthroughs/Plan06PolishPassTest.php` by hand:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: array<int, Column>,
 *     2: User,
 *     3: User,
 *     4: Participant,
 *     5: Participant
 * }
 */
function plan06Board(RetroPhase $phase = RetroPhase::Writing, array $attributes = []): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
        ->create(['title' => 'Sprint 14', ...$attributes]);

    $columns = [];

    foreach (['Start', 'Stop', 'Continue'] as $position => $title) {
        $columns[] = Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => $title,
            'position' => $position,
        ]);
    }

    [$alice, $aliceParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);

    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    return [$retro->fresh(), $columns, $alice, $bob, $aliceParticipant, $bobParticipant];
}

function plan06Card(Retro $retro, Column $column, Participant $author, string $content, int $position = 0): Card
{
    return Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $author->id,
        'content' => $content,
        'position' => $position,
    ]);
}

function plan06Column(Column $column): string
{
    return "[data-test=\"retro-column-{$column->id}\"]";
}

function plan06RecordRequests(mixed $page): void
{
    $page->script(<<<'JS'
        () => {
            const state = { sent: [], loaded: [], held: [], hold: [] };
            const open = XMLHttpRequest.prototype.open;
            const send = XMLHttpRequest.prototype.send;

            XMLHttpRequest.prototype.open = function (method, url, ...rest) {
                this.plan06Request = `${String(method).toUpperCase()} ${new URL(String(url), window.location.href).pathname}`;

                return open.call(this, method, url, ...rest);
            };

            XMLHttpRequest.prototype.send = function (body) {
                const request = this.plan06Request;
                const deliver = this.onload;

                state.sent.push(request);

                this.onload = (event) => {
                    const finish = () => {
                        state.loaded.push(request);
                        deliver?.call(this, event);
                    };

                    if (state.hold.includes(request)) {
                        state.held.push(finish);

                        return;
                    }

                    finish();
                };

                return send.call(this, body);
            };

            window.plan06Requests = state;

            return true;
        }
        JS);
}

function plan06Hold(mixed $page, string $request): void
{
    $page->script("() => { window.plan06Requests.hold.push('{$request}'); return true; }");
}

function plan06Release(mixed $page): void
{
    $page->script('() => { window.plan06Requests.hold = []; window.plan06Requests.held.splice(0).forEach((finish) => finish()); return true; }');
}

function plan06Held(): string
{
    return 'window.plan06Requests.held.length';
}

function plan06Count(string $list, string $request): string
{
    return "window.plan06Requests.{$list}.filter((request) => request === '{$request}').length";
}

it('[P06-02] keeps a vote cast while a snapshot refetch is in flight', function () {
    [$retro, $columns, $alice, $bob, $aliceParticipant] = plan06Board(RetroPhase::Voting, [
        'votes_per_participant' => 2,
    ]);
    $card = plan06Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $snapshot = "GET /retros/{$retro->id}/snapshot";
    $vote = "POST /retros/{$retro->id}/cards/{$card->id}/votes";
    $addVote = "#card-{$card->id} [aria-label=\"Add a vote\"]";
    $showsTotal = "[...document.querySelectorAll('#card-{$card->id} [aria-label]')].some((element) => /^\\d+ votes?$/.test(element.getAttribute('aria-label')))";

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $bobPage->assertSee('Votes left: 2')
        ->assertScript($showsTotal, true);

    plan06RecordRequests($bobPage);
    plan06Hold($bobPage, $snapshot);

    $alicePage->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertVisible('#retro-hide-vote-counts')
        ->click('#retro-hide-vote-counts')
        ->assertAriaAttribute('#retro-hide-vote-counts', 'checked', 'true')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertNotPresent('[role="dialog"]');

    $bobPage->assertScript(plan06Held(), 1)
        ->click($addVote)
        ->assertScript(plan06Count('loaded', $vote), 1)
        ->assertSee('Votes left: 1')
        ->assertScript($showsTotal, true)
        ->assertScript(plan06Held(), 1);

    plan06Release($bobPage);

    $bobPage->assertScript($showsTotal, false)
        ->assertSee('Votes left: 1')
        ->assertSee('1 of 4 vote cast')
        ->assertScript("document.querySelector('#card-{$card->id} [aria-label=\"Remove a vote\"]').disabled", false);

    $alicePage->assertSee('1 of 4 vote cast');

    expect($retro->votes()->count())->toBe(1)
        ->and($retro->fresh()->hide_vote_counts)->toBeTrue();
});

it('[P06-03] shows a member their own card in a second tab during Writing and keeps it hidden from others', function () {
    [$retro, $columns, $alice, $bob] = plan06Board();
    $start = plan06Column($columns[0]);
    $composer = "{$start} textarea";
    $add = "{$start} form button:not([type=\"button\"])";

    $firstTab = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $secondTab = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $firstTab->fill($composer, 'Ship smaller pull requests')
        ->click($add)
        ->assertSeeIn('article[id^="card-"]', 'Ship smaller pull requests');

    $card = Card::query()->where('content', 'Ship smaller pull requests')->firstOrFail();

    $secondTab->assertSeeIn("#card-{$card->id}", 'Ship smaller pull requests')
        ->assertSeeIn("#card-{$card->id}", 'You')
        ->assertDontSee('Hidden until writing ends');

    $alicePage->assertSeeIn("#card-{$card->id}", 'Hidden until writing ends')
        ->assertDontSee('Ship smaller pull requests')
        ->assertScript('document.documentElement.outerHTML.includes("Ship smaller pull requests")', false);

    $firstTab->click("#card-{$card->id} button[aria-label=\"Edit card\"]")
        ->assertVisible("#card-{$card->id} textarea")
        ->fill("#card-{$card->id} textarea", 'Ship much smaller pull requests')
        ->click("#card-{$card->id} button:has-text(\"Save\")")
        ->assertSeeIn("#card-{$card->id}", 'Ship much smaller pull requests');

    $secondTab->assertSeeIn("#card-{$card->id}", 'Ship much smaller pull requests');

    $alicePage->assertSeeIn("#card-{$card->id}", 'Hidden until writing ends')
        ->assertScript('document.documentElement.outerHTML.includes("Ship much smaller pull requests")', false);

    expect($card->fresh()->content)->toBe('Ship much smaller pull requests');
});
```

How `[P06-02]` proves PA1. Bob opens the board first and Alice second, so the snapshot that Bob's page fetches right after its channels are subscribed has long arrived when the recorder is installed. Alice then turns "Hide vote counts" on; the server broadcasts `settings.changed`, Bob's page refetches, and the response (a snapshot without any vote, with the totals now hidden) is held: `held.length` is 1. Bob votes; the vote's response arrives (`loaded` counts it) while the refetch is still pending, and the per-card total is still shown because the held snapshot has not been applied. After `plan06Release()` the old snapshot replaces the board, the total disappears (which proves the snapshot was applied), and the vote must still be there: "Votes left: 1" and "1 of 4 vote cast". Without the buffering of PA1 the snapshot would reset them to 2 and 0. If this fails, see the harness findings.

`[P06-03]` signs the same user in twice. Each `signIn()` is its own browser context with its own session, and both resolve to the same participant, which is what two tabs of one member are for the server (PA2). The second tab's content arrives on the private channel `participant.{id}`.

- [ ] **Step 2: Run the two tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan06PolishPassTest.php --filter='P06-02|P06-03'`
Expected: PASS (2 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 3: Add the in-flight guards, the editor, the column dialog, the add-column form and the assignee select**

In `tests/Browser/Walkthroughs/Plan06PolishPassTest.php`, add these imports in alphabetical position among the existing ones:

```php
use App\Enums\ColumnColor;
use App\Models\ActionItem;
```

Add this helper after `plan06Count()`:

```php
function plan06DoubleClick(mixed $page, string $selector): void
{
    $target = json_encode($selector, JSON_THROW_ON_ERROR);

    $page->script("() => { const button = document.querySelector({$target}); button.click(); button.click(); return true; }");
}
```

Append these tests to the end of the file:

```php

it('[P06-04a] sends one request when the vote button is double-clicked', function () {
    [$retro, $columns, , $bob, $aliceParticipant] = plan06Board(RetroPhase::Voting);
    $card = plan06Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $vote = "POST /retros/{$retro->id}/cards/{$card->id}/votes";
    $addVote = "#card-{$card->id} [aria-label=\"Add a vote\"]";

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertSee('Votes left: 5')
        ->assertPresent($addVote);

    plan06RecordRequests($page);
    plan06DoubleClick($page, $addVote);

    $page->assertScript(plan06Count('loaded', $vote), 1)
        ->assertSee('Votes left: 4')
        ->assertScript(plan06Count('sent', $vote), 1);

    expect($retro->votes()->count())->toBe(1);
});

it('[P06-04b] sends one request when the delete button of a card is double-clicked', function () {
    [$retro, $columns, $alice, $bob, , $bobParticipant] = plan06Board();
    $card = plan06Card($retro, $columns[0], $bobParticipant, 'Flaky tests');
    $delete = "DELETE /retros/{$retro->id}/cards/{$card->id}";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertPresent("#card-{$card->id} [aria-label=\"Delete card\"]");

    plan06RecordRequests($bobPage);
    plan06DoubleClick($bobPage, "#card-{$card->id} [aria-label=\"Delete card\"]");

    $bobPage->assertNotPresent("#card-{$card->id}")
        ->assertScript(plan06Count('sent', $delete), 1)
        ->assertNotPresent('[data-sonner-toast]');

    $alicePage->assertNotPresent("#card-{$card->id}");

    expect(Card::query()->whereKey($card->id)->exists())->toBeFalse();
});

it('[P06-05] closes the card editor with a toast when the facilitator moves to Voting', function () {
    [$retro, $columns, $alice, $bob, , $bobParticipant] = plan06Board(RetroPhase::Grouping);
    $card = plan06Card($retro, $columns[0], $bobParticipant, 'Flaky tests');

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->click("#card-{$card->id} button[aria-label=\"Edit card\"]")
        ->assertVisible("#card-{$card->id} textarea")
        ->fill("#card-{$card->id} textarea", 'Flaky tests on the CI runner');

    $alicePage->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Voting');

    $bobPage->assertSee('The phase changed before your edit was saved.')
        ->assertSeeIn('[aria-current="step"]', 'Voting')
        ->assertNotPresent("#card-{$card->id} textarea")
        ->assertSeeIn("#card-{$card->id}", 'Flaky tests')
        ->assertDontSee('Flaky tests on the CI runner');

    expect($card->fresh()->content)->toBe('Flaky tests');
});

it('[P06-06] keeps the delete-column dialog open when the server refuses the deletion', function () {
    [$retro, $columns, $alice, $bob] = plan06Board();
    $continue = plan06Column($columns[2]);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->click("{$continue} [aria-label=\"Column menu\"]")
        ->assertPresent('[role="menu"]')
        ->click('[role="menuitem"]:has-text("Delete column")')
        ->assertSeeIn('[role="dialog"]', 'Delete the column Continue?');

    $bobPage->fill("{$continue} textarea", 'Keep the demo on Fridays')
        ->click("{$continue} form button:not([type=\"button\"])")
        ->assertSee('Keep the demo on Fridays');

    $alicePage->assertCount('article[id^="card-"]', 1)
        ->click('[role="dialog"] button:has-text("Delete")')
        ->assertSee('This column still has cards.')
        ->assertSeeIn('[role="dialog"]', 'Delete the column Continue?')
        ->assertCount('[data-test^="retro-column-"]', 3);

    expect(Column::query()->whereKey($columns[2]->id)->exists())->toBeTrue();
});

it('[P06-07a] resets the title and the colour of the add-column form after a column is added', function () {
    [$retro, , $alice, $bob] = plan06Board();
    $form = 'form:has([role="radiogroup"])';
    $blue = "{$form} [role=\"radio\"][aria-label=\"Blue\"]";
    $green = "{$form} [role=\"radio\"][aria-label=\"Green\"]";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->assertAriaAttribute($green, 'checked', 'true')
        ->fill("{$form} input", 'Kudos')
        ->click($blue)
        ->assertAriaAttribute($blue, 'checked', 'true')
        ->click("{$form} button[type=\"submit\"]")
        ->assertCount('[data-test^="retro-column-"]', 4)
        ->assertValue("{$form} input", '')
        ->assertAriaAttribute($green, 'checked', 'true')
        ->assertAriaAttribute($blue, 'checked', 'false');

    $bobPage->assertCount('[data-test^="retro-column-"]', 4)
        ->assertSee('Kudos');

    expect($retro->columns()->where('title', 'Kudos')->sole()->color)->toBe(ColumnColor::Blue);
});

it('[P06-07b] disables the assignee select of the action-item form while the item is being saved', function () {
    [$retro, , , $bob] = plan06Board(RetroPhase::Discussing);
    $panel = '[data-test="retro-action-items-panel"]';
    $input = '[aria-label="Add an action item…"]';
    $store = "POST /retros/{$retro->id}/action-items";
    $assigneeIsDisabled = "document.querySelector('{$panel} form [aria-label=\"Assignee\"]').disabled";

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertPresent($input)
        ->assertScript($assigneeIsDisabled, false);

    plan06RecordRequests($page);
    plan06Hold($page, $store);

    $page->fill($input, 'Automate the release notes')
        ->keys($input, 'Enter')
        ->assertScript(plan06Held(), 1)
        ->assertScript($assigneeIsDisabled, true);

    expect(ActionItem::query()->where('content', 'Automate the release notes')->count())->toBe(1);

    plan06Release($page);

    $page->assertSeeIn($panel, 'Automate the release notes')
        ->assertScript($assigneeIsDisabled, false)
        ->assertValue($input, '');
});
```

Notes on these tests:

- `[P06-04a]` and `[P06-04b]`: the two `click()` calls run in one script, before React renders again, so the second click meets either the in-flight guard or the already disabled button. Either way exactly one request may be sent (PB2); `sent` counts requests at the moment `xhr.send()` is called, so a second request would be counted even if the server refused it. The walkthrough names only the vote; PB2 also names the card deletion, so it has its own test.
- `[P06-05]`: the card is edited during Grouping, because a card stays editable from Writing to Grouping and stops being editable in Voting (`canChange` in `retro-card.tsx`). `fill()` sets the textarea's value without key events, so the draggable card around it never sees a Space.
- `[P06-06]`: the column is empty when Alice opens the menu (the item is disabled otherwise), Bob adds a card, and Alice confirms afterwards. Alice's page has received the card (`assertCount(…, 1)`) before she confirms, which makes the test deterministic; the dialog does not close on that event, and the server is what refuses.
- `[P06-07b]`: the server has stored the item while the response is held (`count()` is 1), and the select is still disabled: "while saving" (PB6). The selector depends on the hook of Task 1b.

- [ ] **Step 4: Run the six tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan06PolishPassTest.php --filter='P06-04|P06-05|P06-06|P06-07'`
Expected: PASS (6 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 5: Add the drag preview, the expired session and the timeout**

In `tests/Browser/Walkthroughs/Plan06PolishPassTest.php`, add these imports in alphabetical position among the existing ones:

```php
use Illuminate\Routing\Events\RouteMatched;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Sleep;
```

Add this helper after `plan06DoubleClick()`:

```php
function plan06SignOutElsewhere(mixed $page): void
{
    $status = $page->script(<<<'JS'
        () => {
            const token = document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN=')).slice('XSRF-TOKEN='.length);

            return fetch('/logout', {
                method: 'POST',
                headers: { Accept: 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(token) },
            }).then((response) => response.status);
        }
        JS);

    expect($status)->toBe(204);
}
```

Append these tests to the end of the file:

```php

it('[P06-08a] shows the drag preview outside the scrolling board and as wide as the card', function () {
    [$retro, $columns, , $bob, , $bobParticipant] = plan06Board();
    $card = plan06Card($retro, $columns[2], $bobParticipant, 'Keep the demo on Fridays');
    $handle = "@retro-card-handle-{$card->id}";
    $preview = "document.querySelector('article:not([id])')";

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertPresent($handle)
        ->assertScript("{$preview} === null", true);

    $page->keys($handle, 'Space')
        ->assertAttribute($handle, 'aria-pressed', 'true')
        ->assertScript("{$preview} !== null", true)
        ->assertScript("{$preview}.innerText.includes('Keep the demo on Fridays')", true)
        ->assertScript("{$preview}.closest('main') === null", true)
        ->assertScript("getComputedStyle({$preview}.parentElement).position", 'fixed')
        ->assertScript("Math.abs({$preview}.getBoundingClientRect().width - document.getElementById('card-{$card->id}').getBoundingClientRect().width) < 1", true)
        ->assertScript("(() => { const box = {$preview}.getBoundingClientRect(); return box.left >= 0 && box.right <= window.innerWidth && box.top >= 0; })()", true);

    $page->keys($handle, 'Escape')
        ->assertAttributeMissing($handle, 'aria-pressed')
        ->assertScript("{$preview} === null", true);

    expect($card->fresh()->column_id)->toBe($columns[2]->id);
});

it('[P06-10a] shows one session-expired banner, freezes the board and sends Reload to the login page', function () {
    [$retro, $columns, $alice, $bob] = plan06Board();
    $start = plan06Column($columns[0]);
    $banner = '[role="alert"]:has-text("Your session has expired.")';
    $snapshot = "GET /retros/{$retro->id}/snapshot";

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $bobPage->assertNotPresent('[role="alert"]');

    plan06RecordRequests($bobPage);
    plan06SignOutElsewhere($bobPage);

    $bobPage->fill("{$start} textarea", 'Written after signing out')
        ->click("{$start} form button:not([type=\"button\"])")
        ->assertCount($banner, 1)
        ->assertScript("document.querySelector('[data-realtime] > div[inert]') !== null", true)
        ->assertNotPresent('[data-sonner-toast]');

    $alicePage->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Grouping');

    $bobPage->assertScript(plan06Count('loaded', $snapshot).' >= 1', true)
        ->assertCount($banner, 1)
        ->assertNotPresent('[data-sonner-toast]')
        ->assertSeeIn('[aria-current="step"]', 'Writing');

    expect($retro->cards()->count())->toBe(0);

    $bobPage->click('Reload')
        ->assertPathIs('/login');
});

it('[P06-10b] sends Reload to the session-ended page when the retro accepts guests', function () {
    [$retro, $columns, , $bob] = plan06Board(RetroPhase::Writing, ['guest_access_enabled' => true]);
    $start = plan06Column($columns[0]);

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    plan06SignOutElsewhere($page);

    $page->fill("{$start} textarea", 'Written after signing out')
        ->click("{$start} form button:not([type=\"button\"])")
        ->assertCount('[role="alert"]:has-text("Your session has expired.")', 1)
        ->click('Reload')
        ->assertSee('Your session has ended.')
        ->assertSee('Guests: ask the facilitator for the guest link.')
        ->assertSee('Log in')
        ->assertPathIs("/retros/{$retro->id}");

    expect($retro->cards()->count())->toBe(0);
});

it('[P06-11] shows the translated timeout message when the server stalls and lets the board recover', function () {
    [$retro, $columns, , $bob, $aliceParticipant] = plan06Board(RetroPhase::Voting);
    $bob->update(['locale' => 'fr']);
    $card = plan06Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $addVote = "#card-{$card->id} [aria-label=\"Ajouter un vote\"]";
    $stalled = false;

    Event::listen(RouteMatched::class, function (RouteMatched $event) use (&$stalled): void {
        if ($stalled) {
            return;
        }

        if ($event->route->getName() !== 'retros.cards.votes.store') {
            return;
        }

        $stalled = true;

        Sleep::usleep(15_500_000);
    });

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertSee('Votes restants : 5')
        ->click($addVote)
        ->assertSee("Le serveur n'a pas répondu à temps. Veuillez réessayer.")
        ->assertSee('Votes restants : 4');

    expect($stalled)->toBeTrue()
        ->and($retro->votes()->count())->toBe(1);

    $page->click($addVote)
        ->assertSee('Votes restants : 3')
        ->assertNotPresent('[role="alert"]');
});
```

Notes on these tests:

- `[P06-08a]`: the card sits in the last column, as in the walkthrough. Space picks it up with the keyboard sensor; dnd-kit then renders `CardPreview` inside its `DragOverlay`, a `position: fixed` layer that is a sibling of `<main>`, not a descendant of it, so the board's `overflow-x-auto` cannot clip it (PB1). Escape cancels the drag; the card stays where it was.
- `[P06-10a]`: the retro has no guest access (the default of `plan06Board()`), so a signed-out request is answered 401 and a reload leads to `/login`. After the banner appears the board is inert, so Bob cannot act a second time; the second 401 comes from the refetch that Alice's phase change triggers on Bob's page. It must not add a second banner or a toast (PA5), and Bob's stepper stays on Writing because the refetch was refused. Bob opens the board before Alice, so the snapshot counted in `loaded` is the refused one, not the one his page fetches when it subscribes.
- `[P06-10b]` covers the other branch of the same reload (acceptance criterion PA5b of the polish pass spec), which the walkthrough does not mention: a guest-enabled retro cannot tell a signed-out member from an expired guest and shows the session-ended page instead of the login page.
- `[P06-11]`: Bob's locale is French, so the toast proves the translation (PA4: "in the active locale"); the English text is the translation key itself. The vote of the stalled request is stored once the process wakes up, before the refetch that follows the toast is answered, so the board shows four votes left and one vote exists; the second click proves that the board works again. The test takes about 20 seconds. If this fails, see the harness findings.

- [ ] **Step 6: Run the four tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan06PolishPassTest.php --filter='P06-08a|P06-10|P06-11'`
Expected: PASS (4 tests). A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 7: Confirm the test that covers the keyboard-only grouping and moving**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan04RetroCoreTest.php --filter='P04-03'`
Expected: PASS (1 test). This is the coverage of walkthrough Step 4's second half (PD1): Space, ArrowDown, Space groups a card under another; Space, ArrowRight, Space moves a card to the next column. Nothing is added to the plan 6 file for it.

- [ ] **Step 8: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls and the heredocs' indentation; keep its result.

Run: `composer rector:check`
Expected: no change proposed. If Rector proposes a change to the new file, run `composer rector`, then Step 9.

- [ ] **Step 9: Run the whole file twice**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan06PolishPassTest.php && vendor/bin/pest tests/Browser/Walkthroughs/Plan06PolishPassTest.php`
Expected: PASS twice (12 tests each time, about 50 seconds each).

Run: `composer test:arch`
Expected: PASS. The source scan accepts `Event::listen()`; it forbids only `Event::fake()` without arguments.

- [ ] **Step 10: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan06PolishPassTest.php
git commit -m "test(browser): cover the polish pass walkthrough: refetch, second tab, guards, expired session, timeout"
```

### Task 3: Board engagement walkthrough, part 1 (card reactions, comment threads, facilitator toggles, lock, presentation, vote totals)

This task automates the items of the plan 7 walkthrough that need no third party and no pointer tracking (`docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md`, lines 4869, 4870, 4872 to 4876: steps 3, 4, 6, 7, 8, 9 and 10). Steps 1, 2, 5 and 11 and the picker part of step 3 are Task 4.

Facts about the interface that the selectors rely on (all read from the current code):

- A card is `<article id="card-{id}">` (`resources/js/components/retro/retro-card.tsx`). In Writing and Grouping it is wrapped in `<div data-test="retro-card-handle-{id}">`, which carries dnd-kit's `aria-disabled` (`resources/js/components/retro/dnd.tsx`). These hooks exist since plan 16a; this task adds none.
- A reaction chip is `<button aria-label="👍, 1 reaction" aria-pressed="false">` (plural: `"👍, 2 reactions"`); `aria-pressed` says whether the viewer reacted (`reaction-chips.tsx`). The names tooltip is Radix content with `data-slot="tooltip-content"` (`resources/js/components/ui/tooltip.tsx`), rendered only when the summary has names. Radix opens a tooltip on the first pointer move over its trigger and not again until the pointer has left, so a test moves the pointer to the page title before it hovers a chip it has just clicked.
- The reaction picker trigger is `<button aria-label="Add a reaction">`; it opens a Radix menu whose first six items are the quick emoji (`emoji-picker.tsx`).
- The comment toggle of a card is `<button aria-label="Comments (2)">`; the count is every comment and reply that is not deleted (`countComments` in `resources/js/lib/retro/board-reducer.ts`). The unread dot is `<span role="img" aria-label="Unread comments">` inside it (`card-comments.tsx`).
- In a thread (`comment-thread.tsx`): the composer is `<textarea aria-label="Write a comment…">`, the reply box `<textarea aria-label="Write a reply…">`, the edit box `<textarea aria-label="Edit comment">`; Enter submits. The pencil is `<button aria-label="Edit comment">` (own comments only), the bin `<button aria-label="Delete comment">` (own comments, and every comment for the facilitator). Replies are collapsed behind a `1 reply` button. A soft-deleted parent renders `Comment deleted`. The author line shows the name, or `Anonymous` when the payload has no author.
- A comment notification is a toast titled `New comment on your card` or `New reply in a thread you follow`, with the description `{author}: {excerpt}`, or the excerpt alone on an anonymous retro (`resources/js/hooks/use-retro-board.ts`). Read marks live in `localStorage` under `skrum.readComments.{retroId}` (`use-comment-notifications.ts`).
- The settings dialog (`settings-dialog.tsx`) is opened from `[aria-label="Facilitator menu"]` and `Settings…`; its title is `Retrospective settings`. The switches are Radix checkboxes (`role="checkbox"`, `aria-checked`): `#retro-reactions` (Show reactions), `#retro-cursors` (Show live cursors), `#retro-gifs` (Allow GIFs, rendered only when a GIF provider is configured), `#retro-hide-vote-counts` (Hide vote counts), `#retro-locked` (Close for editing), `#retro-presentation` (Presentation mode). The submit button is `[role="dialog"] button[type="submit"]`.
- The lock badge is the text `Board closed for editing` in the header (`lock-badge.tsx`). While locked the interface removes or disables its editing controls (`isEditable` in `board.tsx`), so the server's 423 is only reachable from a page that has not yet heard about the lock; `[P07-08b]` arranges that by setting `is_locked` in the database, which broadcasts nothing.
- The presentation overlay is a Radix dialog (`presentation-overlay.tsx`); only one `[role="dialog"]` exists at a time. The facilitator's copy has a `Stop presenting` button, and closing it as the facilitator clears the highlight for everyone; another participant's Escape only hides it locally until the highlight changes.
- The vote total of a card is a badge with `aria-label="1 vote"` or `"2 votes"`; during Voting it is rendered only when the snapshot carries a total (`retro-card.tsx`).
- A bare tag name is treated as text by the plugin, so the header is never addressed as `header`; the page title is `header > h1`.

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php`
- Test: `tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` bound to `tests/Browser`, with `$this->signIn(User $user, string $to = '/dashboard'): mixed` and `$this->awaitRealtime(mixed $page): mixed` (`tests/Browser/Support/InteractsWithBrowser.php`).
  - `data-realtime` on the root of `retros/show`; `data-test="retro-card-handle-{id}"` and `data-test="retro-column-{id}"` (plan 16a).
  - Existing helpers in `tests/Pest.php`: `retroFacilitator(Retro $retro): array{0: User, 1: Participant}`, `retroMember(Retro $retro): array{0: User, 1: Participant}`.
  - Factories: `RetroFactory::inPhase(RetroPhase $phase)`, `ColumnFactory`, `CardFactory`, `CardReactionFactory`, `CardCommentFactory`, `VoteFactory`.
  - This task uses neither `$this->workQueue()` nor `$this->dragWithKeyboard()`; it has no dependency on plan 16b Task 1.
- Produces:
  - No product change and no new `data-test` hook.
  - File-level helpers in `tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php` (global functions; later files may call them but must not redeclare them): `plan07Board(RetroPhase $phase = RetroPhase::Grouping, array $attributes = []): array`, `plan07Card(Retro $retro, Column $column, Participant $author, ?string $content, int $position = 0, ?string $gifId = null): Card`, `plan07Reaction(Card $card, Participant $participant, string $emoji): CardReaction`, `plan07Comment(Card $card, Participant $participant, string $content): CardComment`, `plan07Chip(Card $card, string $emoji, int $count): string`, `plan07OpenSettings(mixed $page): mixed`, `plan07SaveSettings(mixed $page): mixed`, `plan07ShowsVoteTotal(Card $card): string`.

- [ ] **Step 1: Create the test file with its helpers, the card reaction test and the reactions and cursors toggles (steps 3 and 7)**

`php artisan make:test` cannot create files under `tests/Browser`, so create `tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php` directly with this content:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\CardReaction;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     retro: Retro,
 *     columns: array<int, Column>,
 *     alice: User,
 *     bob: User,
 *     carol: User,
 *     aliceParticipant: Participant,
 *     bobParticipant: Participant,
 *     carolParticipant: Participant
 * }
 */
function plan07Board(RetroPhase $phase = RetroPhase::Grouping, array $attributes = []): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
        ->create(['title' => 'Sprint 12', ...$attributes]);

    $columns = [];

    foreach (['Start', 'Stop', 'Continue'] as $position => $title) {
        $columns[] = Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => $title,
            'position' => $position,
        ]);
    }

    [$alice, $aliceParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);
    [$carol, $carolParticipant] = retroMember($retro);

    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);
    $carol->update(['name' => 'Carol Reyes', 'locale' => 'en']);

    return [
        'retro' => $retro->fresh(),
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'carol' => $carol,
        'aliceParticipant' => $aliceParticipant,
        'bobParticipant' => $bobParticipant,
        'carolParticipant' => $carolParticipant,
    ];
}

function plan07Card(Retro $retro, Column $column, Participant $author, ?string $content, int $position = 0, ?string $gifId = null): Card
{
    return Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $author->id,
        'content' => $content,
        'gif_id' => $gifId,
        'position' => $position,
    ]);
}

function plan07Reaction(Card $card, Participant $participant, string $emoji): CardReaction
{
    return CardReaction::factory()->create([
        'retro_id' => $card->retro_id,
        'card_id' => $card->id,
        'participant_id' => $participant->id,
        'emoji' => $emoji,
    ]);
}

function plan07Chip(Card $card, string $emoji, int $count): string
{
    $noun = $count === 1 ? 'reaction' : 'reactions';

    return "#card-{$card->id} button[aria-label=\"{$emoji}, {$count} {$noun}\"]";
}

function plan07OpenSettings(mixed $page): mixed
{
    return $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertSee('Retrospective settings');
}

function plan07SaveSettings(mixed $page): mixed
{
    return $page->click('[role="dialog"] button[type="submit"]')
        ->assertNotPresent('[role="dialog"]')
        ->assertNotPresent('[role="menu"]');
}

it('[P07-03a] toggles card reactions with any emoji, counts them live and names the reactors in the tooltip', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'aliceParticipant' => $aliceParticipant,
        'bobParticipant' => $bobParticipant,
        'carolParticipant' => $carolParticipant,
    ] = plan07Board();
    $card = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    plan07Reaction($card, $aliceParticipant, '👍');
    plan07Reaction($card, $carolParticipant, '🦄');
    $tooltip = '[data-slot="tooltip-content"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->assertAriaAttribute(plan07Chip($card, '👍', 1), 'pressed', 'true');

    $bobPage->assertAriaAttribute(plan07Chip($card, '👍', 1), 'pressed', 'false')
        ->assertAriaAttribute(plan07Chip($card, '🦄', 1), 'pressed', 'false')
        ->click(plan07Chip($card, '👍', 1))
        ->assertAriaAttribute(plan07Chip($card, '👍', 2), 'pressed', 'true');

    $alicePage->assertAriaAttribute(plan07Chip($card, '👍', 2), 'pressed', 'true');

    $bobPage->hover('header > h1')
        ->hover(plan07Chip($card, '👍', 2))
        ->assertSeeIn($tooltip, 'Alice Martin')
        ->assertSeeIn($tooltip, 'Bob Stone');

    $bobPage->hover('header > h1')
        ->click("#card-{$card->id} [aria-label=\"Add a reaction\"]")
        ->assertVisible('[role="menuitem"]:has-text("🎉")')
        ->click('[role="menuitem"]:has-text("🎉")')
        ->assertNotPresent('[role="menu"]')
        ->assertAriaAttribute(plan07Chip($card, '🎉', 1), 'pressed', 'true');

    $alicePage->assertAriaAttribute(plan07Chip($card, '🎉', 1), 'pressed', 'false');

    $bobPage->click(plan07Chip($card, '🦄', 1))
        ->assertAriaAttribute(plan07Chip($card, '🦄', 2), 'pressed', 'true');

    $alicePage->assertPresent(plan07Chip($card, '🦄', 2));

    $bobPage->click(plan07Chip($card, '🦄', 2))
        ->assertAriaAttribute(plan07Chip($card, '🦄', 1), 'pressed', 'false')
        ->click(plan07Chip($card, '🎉', 1))
        ->assertNotPresent("#card-{$card->id} button[aria-label^=\"🎉\"]");

    $alicePage->assertPresent(plan07Chip($card, '🦄', 1))
        ->assertNotPresent("#card-{$card->id} button[aria-label^=\"🎉\"]")
        ->assertPresent(plan07Chip($card, '👍', 2));

    expect(CardReaction::query()->where('card_id', $card->id)->count())->toBe(3)
        ->and(CardReaction::query()->where('participant_id', $bobParticipant->id)->pluck('emoji')->all())->toBe(['👍']);
});

it('[P07-07a] turns reactions and live cursors off and on for everyone from the settings', function () {
    config(['services.gifs' => ['provider' => null, 'key' => null, 'rating' => 'pg']]);

    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'aliceParticipant' => $aliceParticipant,
        'carolParticipant' => $carolParticipant,
    ] = plan07Board();
    $card = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    plan07Reaction($card, $carolParticipant, '👍');

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('.lc-overlay')
            ->assertPresent('[aria-label="Hide my cursor"]')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertPresent(plan07Chip($card, '👍', 1));
    }

    $bobPage->assertNotPresent('[aria-label="Facilitator menu"]');

    plan07OpenSettings($alicePage)
        ->assertSee('Show reactions')
        ->assertSee('Show live cursors')
        ->assertSee('Hide vote counts')
        ->assertSee('Close for editing')
        ->assertSee('Presentation mode')
        ->assertNotPresent('#retro-gifs')
        ->assertAriaAttribute('#retro-reactions', 'checked', 'true')
        ->assertAriaAttribute('#retro-cursors', 'checked', 'true')
        ->click('#retro-reactions')
        ->click('#retro-cursors')
        ->assertAriaAttribute('#retro-reactions', 'checked', 'false')
        ->assertAriaAttribute('#retro-cursors', 'checked', 'false');
    plan07SaveSettings($alicePage);

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertNotPresent('.lc-overlay')
            ->assertNotPresent('[aria-label="Hide my cursor"]')
            ->assertNotPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertNotPresent(plan07Chip($card, '👍', 1))
            ->assertNotPresent("#card-{$card->id} [aria-label=\"Add a reaction\"]");
    }

    expect($retro->fresh()->reactions_enabled)->toBeFalse()
        ->and($retro->fresh()->cursors_enabled)->toBeFalse()
        ->and(CardReaction::query()->where('card_id', $card->id)->count())->toBe(1);

    plan07OpenSettings($alicePage)
        ->assertAriaAttribute('#retro-reactions', 'checked', 'false')
        ->click('#retro-reactions')
        ->click('#retro-cursors');
    plan07SaveSettings($alicePage);

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertPresent('.lc-overlay')
            ->assertPresent('[aria-label="Hide my cursor"]')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertPresent(plan07Chip($card, '👍', 1));
    }
});
```

- [ ] **Step 2: Run the two tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php --filter='P07-0(3a|7a)'`
Expected: PASS (2 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If the tooltip assertion of `[P07-03a]` fails while the chips are right, see the harness findings: hovering has only been proven on text and on the board's `main` element so far.

- [ ] **Step 3: Add the comment thread, notification and anonymity tests (steps 4 and 6)**

In `tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php`, add this import after `use App\Models\Card;`:

```php
use App\Models\CardComment;
```

Add this helper after `plan07Reaction()`:

```php
function plan07Comment(Card $card, Participant $participant, string $content): CardComment
{
    return CardComment::factory()->create([
        'retro_id' => $card->retro_id,
        'card_id' => $card->id,
        'participant_id' => $participant->id,
        'content' => $content,
    ]);
}
```

Append these tests at the end of the file:

```php
it('[P07-04a] writes, answers, edits and deletes comments in a thread that every participant sees live', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'carol' => $carol,
        'bobParticipant' => $bobParticipant,
    ] = plan07Board();
    $card = plan07Card($retro, $columns[0], $bobParticipant, 'Slow CI');
    $thread = "#card-{$card->id}";
    $toggle = "{$thread} button[aria-label^=\"Comments (\"]";
    $composer = "{$thread} textarea[aria-label=\"Write a comment…\"]";
    $replyBox = "{$thread} textarea[aria-label=\"Write a reply…\"]";
    $editBox = "{$thread} textarea[aria-label=\"Edit comment\"]";
    $edit = "{$thread} button[aria-label=\"Edit comment\"]";
    $delete = "{$thread} button[aria-label=\"Delete comment\"]";
    $replies = "{$thread} button:has-text(\"1 reply\")";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    $carolPage->click("{$thread} button[aria-label=\"Comments (0)\"]")
        ->assertVisible($composer)
        ->fill($composer, 'Which pipeline is slow?')
        ->keys($composer, 'Enter')
        ->assertSeeIn($thread, 'Which pipeline is slow?')
        ->assertPresent("{$thread} button[aria-label=\"Comments (1)\"]");

    $bobPage->click("{$thread} button[aria-label=\"Comments (1)\"]")
        ->assertSeeIn($thread, 'Which pipeline is slow?')
        ->assertSeeIn($thread, 'Carol Reyes')
        ->assertNotPresent($edit)
        ->assertNotPresent($delete)
        ->click("{$thread} button:has-text(\"Reply\")")
        ->assertVisible($replyBox)
        ->fill($replyBox, 'The deploy one.')
        ->keys($replyBox, 'Enter')
        ->assertSeeIn($thread, 'The deploy one.')
        ->assertPresent("{$thread} button[aria-label=\"Comments (2)\"]");

    $carolPage->assertPresent("{$thread} button[aria-label=\"Comments (2)\"]")
        ->assertDontSeeIn($thread, 'The deploy one.')
        ->click($replies)
        ->assertSeeIn($thread, 'The deploy one.')
        ->assertSeeIn($thread, 'Bob Stone')
        ->assertCount($edit, 1)
        ->click($edit)
        ->assertValue($editBox, 'Which pipeline is slow?')
        ->fill($editBox, 'Which pipeline is the slow one?')
        ->keys($editBox, 'Enter')
        ->assertSeeIn($thread, 'Which pipeline is the slow one?');

    $bobPage->assertSeeIn($thread, 'Which pipeline is the slow one?')
        ->assertCount($edit, 1)
        ->assertCount($delete, 1);

    $parent = CardComment::query()->whereNull('parent_comment_id')->sole();

    expect($parent->content)->toBe('Which pipeline is the slow one?')
        ->and($parent->replies()->count())->toBe(1);

    $carolPage->click($delete)
        ->assertSeeIn($thread, 'Comment deleted')
        ->assertSeeIn($thread, 'The deploy one.')
        ->assertPresent("{$thread} button[aria-label=\"Comments (1)\"]");

    $bobPage->assertSeeIn($thread, 'Comment deleted')
        ->assertSeeIn($thread, 'The deploy one.')
        ->assertDontSeeIn($thread, 'Which pipeline is the slow one?');

    expect($parent->fresh()->deleted_at)->not->toBeNull();

    $alicePage->click($toggle)
        ->assertSeeIn($thread, 'Comment deleted')
        ->click($replies)
        ->assertSeeIn($thread, 'The deploy one.')
        ->assertNotPresent($edit)
        ->assertCount($delete, 1)
        ->click($delete);

    foreach ([$alicePage, $bobPage, $carolPage] as $page) {
        $page->assertPresent("{$thread} button[aria-label=\"Comments (0)\"]")
            ->assertDontSeeIn($thread, 'Comment deleted')
            ->assertDontSeeIn($thread, 'The deploy one.');
    }

    expect(CardComment::query()->count())->toBe(0);
});

it('[P07-04b] notifies only the card author and the thread, and keeps the unread dot across a reload until the thread is read', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'carol' => $carol,
        'bobParticipant' => $bobParticipant,
    ] = plan07Board();
    $card = plan07Card($retro, $columns[0], $bobParticipant, 'Slow CI');
    $thread = "#card-{$card->id}";
    $composer = "{$thread} textarea[aria-label=\"Write a comment…\"]";
    $replyBox = "{$thread} textarea[aria-label=\"Write a reply…\"]";
    $dot = "{$thread} [aria-label=\"Unread comments\"]";
    $isMarkedRead = "Object.keys(JSON.parse(localStorage.getItem('skrum.readComments.{$retro->id}') ?? '{}')).includes('{$card->id}')";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    $bobPage->assertNotPresent($dot);

    $carolPage->click("{$thread} button[aria-label=\"Comments (0)\"]")
        ->assertVisible($composer)
        ->fill($composer, 'Which pipeline is slow?')
        ->keys($composer, 'Enter')
        ->assertSeeIn($thread, 'Which pipeline is slow?');

    $bobPage->assertSee('New comment on your card')
        ->assertSee('Carol Reyes: Which pipeline is slow?')
        ->assertPresent("{$thread} button[aria-label=\"Comments (1)\"]")
        ->assertPresent($dot);

    $alicePage->assertPresent("{$thread} button[aria-label=\"Comments (1)\"]")
        ->assertDontSee('New comment on your card')
        ->assertNotPresent($dot);

    $carolPage->assertDontSee('New comment on your card')
        ->assertNotPresent($dot);

    $this->awaitRealtime($bobPage->navigate("/retros/{$retro->id}"));

    $bobPage->assertPresent($dot)
        ->assertDontSee('New comment on your card')
        ->assertScript($isMarkedRead, false)
        ->click("{$thread} button[aria-label=\"Comments (1)\"]")
        ->assertSeeIn($thread, 'Which pipeline is slow?')
        ->assertNotPresent($dot)
        ->assertScript($isMarkedRead, true);

    $this->awaitRealtime($bobPage->navigate("/retros/{$retro->id}"));

    $bobPage->assertPresent("{$thread} button[aria-label=\"Comments (1)\"]")
        ->assertNotPresent($dot)
        ->click("{$thread} button[aria-label=\"Comments (1)\"]")
        ->click("{$thread} button:has-text(\"Reply\")")
        ->assertVisible($replyBox)
        ->fill($replyBox, 'The deploy one.')
        ->keys($replyBox, 'Enter')
        ->assertSeeIn($thread, 'The deploy one.');

    $carolPage->assertSee('New reply in a thread you follow')
        ->assertSee('Bob Stone: The deploy one.')
        ->assertPresent("{$thread} button[aria-label=\"Comments (2)\"]");

    $alicePage->assertPresent("{$thread} button[aria-label=\"Comments (2)\"]")
        ->assertDontSee('New reply in a thread you follow')
        ->assertNotPresent($dot);
});

it('[P07-06a] shows no name on reaction chips, comments or notification toasts on an anonymous retro', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'bob' => $bob,
        'carol' => $carol,
        'aliceParticipant' => $aliceParticipant,
        'bobParticipant' => $bobParticipant,
    ] = plan07Board(RetroPhase::Grouping, ['is_anonymous' => true]);
    $card = plan07Card($retro, $columns[0], $bobParticipant, 'Too many meetings');
    plan07Reaction($card, $aliceParticipant, '👍');
    $thread = "#card-{$card->id}";
    $composer = "{$thread} textarea[aria-label=\"Write a comment…\"]";
    $tooltip = '[data-slot="tooltip-content"]';

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    $carolPage->assertSeeIn($thread, 'Too many meetings')
        ->assertDontSeeIn($thread, 'Bob Stone')
        ->hover(plan07Chip($card, '👍', 1))
        ->assertNotPresent($tooltip)
        ->click(plan07Chip($card, '👍', 1))
        ->assertAriaAttribute(plan07Chip($card, '👍', 2), 'pressed', 'true')
        ->hover('header > h1')
        ->hover(plan07Chip($card, '👍', 2))
        ->assertNotPresent($tooltip);

    $bobPage->assertPresent(plan07Chip($card, '👍', 2))
        ->hover(plan07Chip($card, '👍', 2))
        ->assertNotPresent($tooltip);

    $carolPage->click("{$thread} button[aria-label=\"Comments (0)\"]")
        ->assertVisible($composer)
        ->fill($composer, 'Is this still true?')
        ->keys($composer, 'Enter')
        ->assertSeeIn($thread, 'Is this still true?')
        ->assertSeeIn($thread, 'Carol Reyes');

    $bobPage->assertSee('New comment on your card')
        ->assertSee('Is this still true?')
        ->assertDontSee('Carol Reyes: Is this still true?')
        ->click("{$thread} button[aria-label=\"Comments (1)\"]")
        ->assertSeeIn($thread, 'Is this still true?')
        ->assertSeeIn($thread, 'Anonymous')
        ->assertDontSeeIn($thread, 'Carol Reyes');
});
```

- [ ] **Step 4: Run the three tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php --filter='P07-0(4a|4b|6a)'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 5: Add the vote totals, lock and presentation tests (steps 8, 9 and 10)**

In `tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php`, add this import after `use App\Models\User;`:

```php
use App\Models\Vote;
```

Add this helper after `plan07SaveSettings()`:

```php
function plan07ShowsVoteTotal(Card $card): string
{
    return "[...document.querySelectorAll('#card-{$card->id} [aria-label]')].some((element) => /^\\d+ votes?$/.test(element.getAttribute('aria-label')))";
}
```

Append these tests at the end of the file:

```php
it('[P07-10] shows vote totals live during Voting, hides them with "Hide vote counts" and shows them again in Discussing', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'aliceParticipant' => $aliceParticipant,
        'carolParticipant' => $carolParticipant,
    ] = plan07Board(RetroPhase::Voting);
    $card = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $carolParticipant->id]);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertPresent("#card-{$card->id} [aria-label=\"1 vote\"]");
    }

    $bobPage->click("#card-{$card->id} [aria-label=\"Add a vote\"]")
        ->assertPresent("#card-{$card->id} [aria-label=\"2 votes\"]")
        ->assertDontSeeIn("#card-{$card->id}", 'Carol Reyes');

    $alicePage->assertPresent("#card-{$card->id} [aria-label=\"2 votes\"]")
        ->assertDontSeeIn("#card-{$card->id}", 'Bob Stone');

    plan07OpenSettings($alicePage)
        ->click('#retro-hide-vote-counts')
        ->assertAriaAttribute('#retro-hide-vote-counts', 'checked', 'true');
    plan07SaveSettings($alicePage);

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertScript(plan07ShowsVoteTotal($card), false);
    }

    $bobPage->assertSee('Votes left: 4')
        ->click("#card-{$card->id} [aria-label=\"Remove a vote\"]")
        ->assertSee('Votes left: 5')
        ->assertScript(plan07ShowsVoteTotal($card), false);

    $alicePage->assertSee('1 of 15 vote cast')
        ->assertScript(plan07ShowsVoteTotal($card), false)
        ->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Discussing');

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Discussing')
            ->assertPresent("#card-{$card->id} [aria-label=\"1 vote\"]");
    }

    expect($retro->fresh()->hide_vote_counts)->toBeTrue()
        ->and($retro->votes()->count())->toBe(1);
});

it('[P07-08a] closes the board for editing in every phase while the facilitator still moves the phase and the timer', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'aliceParticipant' => $aliceParticipant,
        'bobParticipant' => $bobParticipant,
        'carolParticipant' => $carolParticipant,
    ] = plan07Board(RetroPhase::Writing);
    $mine = plan07Card($retro, $columns[0], $bobParticipant, 'Pairing works well', 0);
    $slow = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI', 1);
    plan07Reaction($slow, $carolParticipant, '👍');
    plan07Comment($slow, $carolParticipant, 'Which pipeline is slow?');
    $current = '[aria-current="step"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertCount('[aria-label="Add a card…"]', 3)
        ->assertPresent("#card-{$mine->id} [aria-label=\"Edit card\"]")
        ->assertAttribute("@retro-card-handle-{$mine->id}", 'aria-disabled', 'false')
        ->assertDontSee('Board closed for editing');

    plan07OpenSettings($alicePage)
        ->click('#retro-locked')
        ->assertAriaAttribute('#retro-locked', 'checked', 'true');
    plan07SaveSettings($alicePage);

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertSee('Board closed for editing');
    }

    $bobPage->assertNotPresent('[aria-label="Add a card…"]')
        ->assertNotPresent("#card-{$mine->id} [aria-label=\"Edit card\"]")
        ->assertNotPresent("#card-{$mine->id} [aria-label=\"Delete card\"]")
        ->assertAttribute("@retro-card-handle-{$mine->id}", 'aria-disabled', 'true');

    $alicePage->press('Next')->assertSeeIn($current, 'Grouping');

    $bobPage->assertSeeIn($current, 'Grouping')
        ->assertSee('Board closed for editing')
        ->assertAttribute("@retro-card-handle-{$slow->id}", 'aria-disabled', 'true')
        ->assertDisabled(plan07Chip($slow, '👍', 1))
        ->assertNotPresent("#card-{$slow->id} [aria-label=\"Add a reaction\"]")
        ->click("#card-{$slow->id} button[aria-label=\"Comments (1)\"]")
        ->assertSeeIn("#card-{$slow->id}", 'Which pipeline is slow?')
        ->assertNotPresent("#card-{$slow->id} textarea")
        ->assertNotPresent("#card-{$slow->id} button[aria-label=\"Delete comment\"]");

    $alicePage->press('Next')->assertSeeIn($current, 'Voting');

    $bobPage->assertSeeIn($current, 'Voting')
        ->assertDisabled("#card-{$slow->id} [aria-label=\"Add a vote\"]")
        ->assertDisabled("#card-{$mine->id} [aria-label=\"Add a vote\"]");

    $alicePage->press('Next')->assertSeeIn($current, 'Discussing');

    $bobPage->assertSeeIn($current, 'Discussing')
        ->assertDisabled('[aria-label="Add an action item…"]')
        ->assertNotPresent('[role="timer"]');

    $alicePage->click('[aria-label="Timer"]')
        ->assertSee('1 min')
        ->click('1 min')
        ->assertNotPresent('[role="menu"]');

    $bobPage->assertPresent('[role="timer"]');

    expect($retro->fresh()->is_locked)->toBeTrue()
        ->and($retro->fresh()->phase)->toBe(RetroPhase::Discussing)
        ->and($retro->fresh()->timer_ends_at)->not->toBeNull()
        ->and($retro->cards()->count())->toBe(2)
        ->and($retro->votes()->count())->toBe(0)
        ->and(CardReaction::query()->where('card_id', $slow->id)->count())->toBe(1)
        ->and(CardComment::query()->where('card_id', $slow->id)->count())->toBe(1);

    plan07OpenSettings($alicePage)
        ->assertAriaAttribute('#retro-locked', 'checked', 'true')
        ->click('#retro-locked');
    plan07SaveSettings($alicePage);

    $bobPage->assertDontSee('Board closed for editing')
        ->assertEnabled('[aria-label="Add an action item…"]')
        ->assertEnabled(plan07Chip($slow, '👍', 1));

    expect($retro->fresh()->is_locked)->toBeFalse();
});

it('[P07-08b] answers an edit from a page that missed the lock with the "closed for editing" toast and resyncs the board', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'bob' => $bob,
        'aliceParticipant' => $aliceParticipant,
        'carolParticipant' => $carolParticipant,
    ] = plan07Board();
    $card = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    plan07Reaction($card, $carolParticipant, '👍');

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertEnabled(plan07Chip($card, '👍', 1))
        ->assertDontSee('Board closed for editing');

    $retro->forceFill(['is_locked' => true])->save();

    $page->click(plan07Chip($card, '👍', 1))
        ->assertSee('The board is closed for editing.')
        ->assertSee('Board closed for editing')
        ->assertDisabled(plan07Chip($card, '👍', 1))
        ->assertNotPresent("#card-{$card->id} [aria-label=\"Add a reaction\"]");

    expect(CardReaction::query()->where('card_id', $card->id)->count())->toBe(1);
});

it('[P07-09] presents the highlighted card to everyone, lets a participant close it and reopens it on the next highlight', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'bobParticipant' => $bobParticipant,
        'carolParticipant' => $carolParticipant,
    ] = plan07Board(RetroPhase::Discussing);
    $slow = plan07Card($retro, $columns[0], $bobParticipant, 'Slow CI', 0);
    $flaky = plan07Card($retro, $columns[0], $bobParticipant, 'Flaky tests', 1);
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $slow->id, 'participant_id' => $carolParticipant->id]);
    plan07Reaction($slow, $carolParticipant, '👍');
    plan07Comment($slow, $carolParticipant, 'Which pipeline is slow?');
    $overlay = '[role="dialog"]';
    $discuss = fn (Card $card): string => "#card-{$card->id} button:has-text(\"Discuss\")";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    plan07OpenSettings($alicePage)
        ->click('#retro-presentation')
        ->assertAriaAttribute('#retro-presentation', 'checked', 'true');
    plan07SaveSettings($alicePage);

    $bobPage->assertNotPresent($overlay);

    $alicePage->click($discuss($slow));

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertSeeIn($overlay, 'Slow CI')
            ->assertSeeIn($overlay, 'Bob Stone')
            ->assertSeeIn($overlay, '2 votes')
            ->assertPresent("{$overlay} button[aria-label=\"👍, 1 reaction\"]")
            ->assertPresent("{$overlay} button[aria-label=\"Comments (1)\"]");
    }

    $alicePage->assertSeeIn($overlay, 'Stop presenting');

    $bobPage->assertDontSeeIn($overlay, 'Stop presenting')
        ->keys($overlay, 'Escape')
        ->assertNotPresent($overlay);

    $alicePage->assertSeeIn($overlay, 'Slow CI');

    expect($retro->fresh()->highlighted_card_id)->toBe($slow->id);

    $alicePage->press('Stop presenting')
        ->assertNotPresent($overlay)
        ->assertPresent("#card-{$slow->id} button[aria-pressed=\"false\"]");

    expect($retro->fresh()->highlighted_card_id)->toBeNull();

    $alicePage->click($discuss($flaky));

    $bobPage->assertSeeIn($overlay, 'Flaky tests');

    $alicePage->assertSeeIn($overlay, 'Flaky tests')
        ->keys($overlay, 'Escape')
        ->assertNotPresent($overlay);

    $bobPage->assertNotPresent($overlay);

    expect($retro->fresh()->highlighted_card_id)->toBeNull()
        ->and($retro->fresh()->presentation_mode)->toBeTrue();
});
```

- [ ] **Step 6: Run the four tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php --filter='P07-(10|08a|08b|09)'`
Expected: PASS (4 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. In `[P07-10]` the progress text `1 of 15 vote cast` is three participants times the default five votes; if the retro's vote limit differs, read the figure from `resources/js/components/retro/vote-progress.tsx` and correct the text, not the product.

- [ ] **Step 7: Format and check**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining style issue; Pint may reorder the imports.

Run: `composer rector:check`
Expected: no proposed change. If Rector proposes a rewrite of the new file, apply it with `composer rector`, then run Pint again.

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php`
Expected: PASS (9 tests).

- [ ] **Step 8: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php
git commit -m "test(browser): cover the board engagement walkthrough: card reactions, comment threads, toggles, lock and presentation"
```

---

### Task 4: Board engagement walkthrough, part 2 (live cursors, flying reactions, GIFs and emoji data through skrum)

This task automates steps 1, 2 and 5 of the plan 7 walkthrough, the picker emoji of step 3, the cursor and flying-reaction half of step 6 and the GIF switch of step 7 (`docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md`, lines 4867, 4868, 4869, 4871, 4872, 4873). Touch cursors (step 1), a real GIF provider (step 5) and the forged whisper (step 11, line 4877) are residual.

Substitutions used here:

- **GIF provider and emoji CDN.** `Http::fake()` answers GIPHY's API (`api.giphy.com/v1/gifs/trending`, `/search`, `/{id}`), GIPHY's media host (`media.giphy.com`) and jsDelivr (`cdn.jsdelivr.net/npm/emojibase-data@17.0.0/en/data.json` and `messages.json`). The provider is enabled with `config(['services.gifs' => ['provider' => 'giphy', 'key' => 'plan07-gif-key', 'rating' => 'pg']])` (`App\Support\Gifs\GifCatalog::provider()`), and `Storage::fake()` keeps the proxy's files out of `storage/app`. Every fake is a closure: `GifsController` and `EmojiDataController` read the upstream body as a stream without rewinding it, so a response object reused for a second request would be read as empty. A last `'*'` entry answers 500 so no test can reach the network.
- **"The network panel shows no request to giphy.com, tenor.com or jsdelivr.net".** The plugin has no network API. The tests read the page's own record instead: `performance.getEntriesByType('resource')` lists every URL the page fetched (images, `fetch`, scripts), and every `img` and `source` on the page must have the page's origin. Both are evaluated with `assertScript()`. This is a substitution; it does not see websocket frames, which are not involved.
- **Window blur.** A headless page cannot lose focus on demand; the test dispatches the `blur` event that `live-cursors` listens for (`node_modules/live-cursors/dist/cursors-BF2FQeHR.mjs`, `window.addEventListener("blur", …)`).

Facts the tests rely on (read from the code and from `Plan10bPokerAdditionsTest.php`, tests `[P10b-04]`, `[P10b-05]`, `[P10b-15a]` to `[P10b-15c]`, which already pass on the same layers):

- The cursor layer is `.lc-overlay` inside the board's `main`; each remote cursor is `.lc-cursor` (absolutely positioned at 0,0 and moved with a transform, so its bounding box starts at the pointed position) with the name in `.lc-label`. A remote cursor is dropped after 3 seconds without movement, so a test that must prove a cursor left for another reason either measures how fast it left or proves, with a later reaction, that the sender was still active.
- Positions are normalised to the board's scroll size (`elementSpace` in `live-cursors`), so two pages agree on a position only when their boards have the same scroll size. `[P07-01a]` therefore uses two non-facilitator members (the facilitator's board has one more element, "Add column", in some phases), cards written by a third person (own cards have two more buttons), and the same viewport on both pages.
- The flying layer is `.lr-overlay`; a reaction is `.lr-reaction` with `data-state` (`flying` or `gathering`) and `data-count`; the sender's name is `.lr-label`. Two different senders using the same emoji within 700 ms make one `gathering` bubble (`clusterMs` in `node_modules/live-reactions/dist/reactions-ABmEzAT6.mjs`). The bubble lives for less than a second, so the test records it with a `MutationObserver` installed before the clicks.
- The reactions bar is `[role="toolbar"][aria-label="Reactions"]`; a quick emoji is `[aria-label="Send a reaction 🎉"]`; the picker trigger is exactly `[aria-label="Send a reaction"]`. Its menu ends with `More emoji…`, which opens a dialog titled like the trigger and containing the frimousse picker; each emoji is `<button role="gridcell" aria-label="Rocket">` (frimousse capitalises Emojibase's label).
- frimousse fetches `{baseUrl}/{locale}/data.json` and `messages.json` with `fetch`; the board gives it `baseUrl = /emoji-data/17.0.0` and the locale `en` (`BuildBoardSnapshot`, `App\Support\EmojibaseLocale`).
- The GIF button of a composer is the `GIF` button inside the column's form; the search dialog is titled `Choose a GIF`, its field is `[aria-label="Search GIFs…"]`, each result is `<button aria-label="Choose this GIF">` with an `img` whose `src` is `/gifs/{id}/preview`; the footer says `Powered by GIPHY` (`resources/js/components/gifs/gif-search-dialog.tsx`). A card's GIF is `<button aria-label="GIF">` with the preview image; clicking it opens a dialog with `/gifs/{id}/full` (`card-gif.tsx`).

**Files:**
- Modify: `tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php`
- Test: `tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php`

**Interfaces:**
- Consumes:
  - Everything Task 3 produced: `plan07Board()`, `plan07Card()`, `plan07Reaction()`, `plan07Chip()`, `plan07OpenSettings()`, `plan07SaveSettings()`.
  - `$this->signIn()`, `$this->awaitRealtime()` from `InteractsWithBrowser`. This task uses neither `$this->workQueue()` nor `$this->dragWithKeyboard()`.
  - `Http::fake([...])` and `Storage::fake()`, which apply to browser requests because the application runs in the test process.
  - Routes `gifs.show` (`/gifs/{gif}/{size}`), `retros.gifs.index`, `emoji-data.show` (`/emoji-data/{version}/{locale}/{file}`).
- Produces:
  - No product change and no new `data-test` hook.
  - File-level helpers: `plan07GiphyItem(string $id): array`, `plan07FakeUpstreams(): void`, `plan07EnableGifs(): void`, `plan07CursorIsOver(Card $card): string`, `plan07ImageLoaded(string $selector): string`, `plan07Requested(string $path): string`, `plan07ThirdPartyRequests(): string`, `plan07ForeignImages(): string`.

- [ ] **Step 1: Add the cursor tests (step 1)**

In `tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php`, add this helper after `plan07ShowsVoteTotal()`:

```php
function plan07CursorIsOver(Card $card): string
{
    return sprintf(
        '(() => { const cursor = document.querySelector(".lc-cursor"); const card = document.getElementById(%s); if (cursor === null || card === null) { return false; } const tip = cursor.getBoundingClientRect(); const box = card.getBoundingClientRect(); return tip.left >= box.left && tip.left <= box.right && tip.top >= box.top && tip.top <= box.bottom; })()',
        json_encode("card-{$card->id}"),
    );
}
```

Append these tests at the end of the file:

```php
it('[P07-01a] shows a named cursor over the same card on another page and keeps it there when that page scrolls the board', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'bob' => $bob,
        'carol' => $carol,
        'aliceParticipant' => $aliceParticipant,
    ] = plan07Board();
    $first = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $third = plan07Card($retro, $columns[2], $aliceParticipant, 'Keep the demo on Fridays');
    $board = 'document.querySelector("main:has([data-test^=\"retro-column-\"])")';

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->resize(800, 700)
            ->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('.lc-overlay')
            ->assertScript("{$board}.scrollWidth > {$board}.clientWidth", true);
    }

    $carolPage->assertNotPresent('.lc-cursor')
        ->assertScript("{$board}.scrollLeft", 0);

    $bobPage->hover("#card-{$first->id}")->hover("#card-{$third->id}");

    $carolPage->assertSeeIn('.lc-overlay', 'Bob Stone')
        ->assertScript(plan07CursorIsOver($third), true);

    $bobPage->assertNotPresent('.lc-cursor');

    $carolPage->script("() => { const board = {$board}; board.scrollLeft = board.scrollWidth; return board.scrollLeft; }");
    $carolPage->assertScript("{$board}.scrollLeft > 0", true);

    $bobPage->hover("#card-{$first->id}")->hover("#card-{$third->id}");

    $carolPage->assertSeeIn('.lc-overlay', 'Bob Stone')
        ->assertScript(plan07CursorIsOver($third), true);

    $carolPage->hover("#card-{$third->id}")->hover("#card-{$first->id}");

    $bobPage->assertSeeIn('.lc-overlay', 'Carol Reyes')
        ->assertScript(plan07CursorIsOver($first), true);
});

it('[P07-01b] removes a cursor when its window loses focus and when its owner chooses "Hide my cursor"', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'bob' => $bob,
        'carol' => $carol,
        'aliceParticipant' => $aliceParticipant,
    ] = plan07Board();
    $first = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $second = plan07Card($retro, $columns[1], $aliceParticipant, 'Flaky tests');
    $watchRemoval = '() => { const started = performance.now(); const overlay = document.querySelector(".lc-overlay"); const observer = new MutationObserver(() => { if (overlay.querySelector(".lc-cursor") === null) { window.plan07CursorGoneAfter = performance.now() - started; observer.disconnect(); } }); observer.observe(overlay, { childList: true }); return true; }';

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('.lc-overlay');
    }

    $bobPage->hover("#card-{$first->id}")->hover("#card-{$second->id}");
    $carolPage->assertSeeIn('.lc-overlay', 'Bob Stone');

    $carolPage->script($watchRemoval);
    $bobPage->script('() => { window.dispatchEvent(new Event("blur")); return true; }');

    $carolPage->assertNotPresent('.lc-cursor')
        ->assertScript('window.plan07CursorGoneAfter < 1500', true);

    $bobPage->hover("#card-{$first->id}")->hover("#card-{$second->id}");
    $carolPage->assertSeeIn('.lc-overlay', 'Bob Stone');

    $bobPage->click('[aria-label="Hide my cursor"]')
        ->assertAriaAttribute('[aria-label="Show my cursor"]', 'pressed', 'true')
        ->assertScript('localStorage.getItem("skrum.hideMyCursor")', 'true');
    $carolPage->assertNotPresent('.lc-cursor');

    $bobPage->hover("#card-{$first->id}")
        ->hover("#card-{$second->id}")
        ->click('[aria-label="Send a reaction 🎉"]');
    $carolPage->assertSeeIn('.lr-overlay', 'Bob Stone')
        ->assertNotPresent('.lc-cursor');

    $carolPage->hover("#card-{$second->id}")->hover("#card-{$first->id}");
    $bobPage->assertSeeIn('.lc-overlay', 'Carol Reyes');

    $this->awaitRealtime($bobPage->navigate("/retros/{$retro->id}"));

    $bobPage->assertAriaAttribute('[aria-label="Show my cursor"]', 'pressed', 'true')
        ->click('[aria-label="Show my cursor"]')
        ->assertAriaAttribute('[aria-label="Hide my cursor"]', 'pressed', 'false')
        ->hover("#card-{$first->id}")
        ->hover("#card-{$second->id}");
    $carolPage->assertSeeIn('.lc-overlay', 'Bob Stone');
});
```

- [ ] **Step 2: Run the two tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php --filter='P07-01[ab]'`
Expected: PASS (2 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If `[P07-01a]` fails only on `plan07CursorIsOver()` while the name is shown, see the harness findings and the first item of this fragment's "Notes for the lead": the two boards must have the same scroll size for the positions to agree.

- [ ] **Step 3: Add the flying reaction tests (steps 2 and 6)**

In `tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php`, add these imports after `use App\Models\Vote;`:

```php
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
```

Add these helpers after `plan07CursorIsOver()`:

```php
/**
 * @return array{
 *     id: string,
 *     images: array<string, array<string, string>>
 * }
 */
function plan07GiphyItem(string $id): array
{
    return [
        'id' => $id,
        'images' => [
            'fixed_width' => ['url' => "https://media.giphy.com/{$id}/200w.gif", 'webp' => "https://media.giphy.com/{$id}/200w.webp", 'width' => '200', 'height' => '150'],
            'original' => ['url' => "https://media.giphy.com/{$id}/giphy.gif", 'webp' => "https://media.giphy.com/{$id}/giphy.webp", 'width' => '480', 'height' => '360'],
        ],
    ];
}

function plan07FakeUpstreams(): void
{
    Storage::fake();
    config(['services.emoji_data.version' => '17.0.0']);

    $pixel = (string) base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    $json = ['Content-Type' => 'application/json; charset=utf-8'];
    $emojis = (string) json_encode([
        ['emoji' => '🚀', 'hexcode' => '1F680', 'group' => 0, 'subgroup' => 0, 'order' => 1, 'version' => 1, 'label' => 'rocket', 'tags' => ['launch', 'space']],
        ['emoji' => '🦄', 'hexcode' => '1F984', 'group' => 0, 'subgroup' => 0, 'order' => 2, 'version' => 1, 'label' => 'unicorn', 'tags' => ['face']],
    ], JSON_UNESCAPED_UNICODE);
    $messages = (string) json_encode([
        'groups' => [['key' => 'smileys-emotion', 'message' => 'smileys & emotion', 'order' => 0]],
        'subgroups' => [['key' => 'face-smiling', 'message' => 'face smiling', 'order' => 0]],
        'skinTones' => [
            ['key' => 'light', 'message' => 'light skin tone'],
            ['key' => 'medium-light', 'message' => 'medium-light skin tone'],
            ['key' => 'medium', 'message' => 'medium skin tone'],
            ['key' => 'medium-dark', 'message' => 'medium-dark skin tone'],
            ['key' => 'dark', 'message' => 'dark skin tone'],
        ],
    ]);

    Http::fake([
        'api.giphy.com/v1/gifs/trending*' => fn () => Http::response(['data' => [plan07GiphyItem('hot1'), plan07GiphyItem('hot2')]]),
        'api.giphy.com/v1/gifs/search*' => fn () => Http::response(['data' => [plan07GiphyItem('party1')]]),
        'api.giphy.com/v1/gifs/party1*' => fn () => Http::response(['data' => plan07GiphyItem('party1')]),
        'media.giphy.com/*' => fn () => Http::response($pixel, 200, ['Content-Type' => 'image/gif']),
        'cdn.jsdelivr.net/npm/emojibase-data@17.0.0/en/data.json' => fn () => Http::response($emojis, 200, $json),
        'cdn.jsdelivr.net/npm/emojibase-data@17.0.0/en/messages.json' => fn () => Http::response($messages, 200, $json),
        '*' => fn () => Http::response('Unexpected request', 500),
    ]);
}
```

Append these tests at the end of the file:

```php
it('[P07-02a] flies quick reactions with the sender\'s name and gathers the same emoji from two people into one bubble', function () {
    ['retro' => $retro, 'alice' => $alice, 'bob' => $bob] = plan07Board();
    $watchGathering = '() => { window.plan07Gathered = 0; new MutationObserver(() => { for (const bubble of document.querySelectorAll(".lr-reaction[data-state=\"gathering\"]")) { window.plan07Gathered = Math.max(window.plan07Gathered, Number(bubble.dataset.count)); } }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state", "data-count"] }); return true; }';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertCount('[role="toolbar"][aria-label="Reactions"] [aria-label^="Send a reaction "]', 6);
    }

    $alicePage->click('[aria-label="Send a reaction 👏"]');
    $bobPage->assertSeeIn('.lr-overlay', '👏')
        ->assertSeeIn('.lr-overlay', 'Alice Martin');

    $bobPage->click('[aria-label="Send a reaction 👍"]');
    $alicePage->assertSeeIn('.lr-overlay', '👍')
        ->assertSeeIn('.lr-overlay', 'Bob Stone');

    $alicePage->script($watchGathering);
    $bobPage->script($watchGathering);

    $alicePage->click('[aria-label="Send a reaction 🎉"]');
    $bobPage->click('[aria-label="Send a reaction 🎉"]');

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertScript('window.plan07Gathered >= 2', true);
    }
});

it('[P07-02b] flies a reaction chosen in the full emoji picker', function () {
    plan07FakeUpstreams();

    ['retro' => $retro, 'alice' => $alice, 'bob' => $bob] = plan07Board();

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]');
    }

    $alicePage->click('[role="toolbar"][aria-label="Reactions"] [aria-label="Send a reaction"]')
        ->assertSee('More emoji…')
        ->click('More emoji…')
        ->assertSeeIn('[role="dialog"]', 'Send a reaction')
        ->assertVisible('[role="dialog"] [role="gridcell"][aria-label="Rocket"]')
        ->click('[role="dialog"] [role="gridcell"][aria-label="Rocket"]')
        ->assertNotPresent('[role="dialog"]');

    $bobPage->assertSeeIn('.lr-overlay', '🚀')
        ->assertSeeIn('.lr-overlay', 'Alice Martin');
});

it('[P07-06b] labels cursors "Participant" and sends unnamed reactions on an anonymous retro', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'bob' => $bob,
        'carol' => $carol,
        'aliceParticipant' => $aliceParticipant,
    ] = plan07Board(RetroPhase::Grouping, ['is_anonymous' => true]);
    $first = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $second = plan07Card($retro, $columns[1], $aliceParticipant, 'Flaky tests');

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('.lc-overlay');
    }

    $bobPage->hover("#card-{$first->id}")->hover("#card-{$second->id}");

    $carolPage->assertSeeIn('.lc-overlay', 'Participant')
        ->assertDontSeeIn('.lc-overlay', 'Bob Stone');

    $bobPage->click('[aria-label="Send a reaction 🎉"]');

    $carolPage->assertPresent('.lr-reaction')
        ->assertNotPresent('.lr-label');
});
```

- [ ] **Step 4: Run the three tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php --filter='P07-0(2a|2b|6b)'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If `[P07-02b]` never shows the `Rocket` cell, open the page with `--headed`: when the dialog says `Emoji list unavailable`, the fake's JSON shape is refused by `EmojiDataController` or by frimousse; see the harness findings.

- [ ] **Step 5: Add the GIF and emoji data tests (steps 3, 5 and 7)**

In `tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php`, add this import after `use App\Models\Vote;`:

```php
use Illuminate\Http\Client\Request;
```

Add these helpers after `plan07FakeUpstreams()`:

```php
function plan07EnableGifs(): void
{
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'plan07-gif-key', 'rating' => 'pg']]);
}

function plan07ImageLoaded(string $selector): string
{
    return sprintf(
        '(() => { const image = document.querySelector(%s); return image !== null && image.complete && image.naturalWidth > 0; })()',
        json_encode($selector),
    );
}

function plan07Requested(string $path): string
{
    return sprintf(
        'performance.getEntriesByType("resource").some((entry) => new URL(entry.name).origin === location.origin && new URL(entry.name).pathname === %s)',
        json_encode($path),
    );
}

function plan07ThirdPartyRequests(): string
{
    return '[...performance.getEntriesByType("resource").map((entry) => entry.name), ...[...document.querySelectorAll("img, source")].map((element) => element.currentSrc || element.src)].filter((url) => /giphy\.com|tenor\.com|tenor\.googleapis\.com|jsdelivr\.net/.test(url)).length';
}

function plan07ForeignImages(): string
{
    return '[...document.querySelectorAll("img, source")].filter((element) => new URL(element.currentSrc || element.src, location.href).origin !== location.origin).length';
}
```

Append these tests at the end of the file:

```php
it('[P07-05a] searches GIFs and shows them on cards through skrum, without any request from the browser to the provider', function () {
    plan07FakeUpstreams();
    plan07EnableGifs();

    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'carol' => $carol,
    ] = plan07Board(RetroPhase::Writing);
    $start = "[data-test=\"retro-column-{$columns[0]->id}\"]";
    $result = '[role="dialog"] button[aria-label="Choose this GIF"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    $bobPage->assertVisible("{$start} form button:has-text(\"GIF\")")
        ->click("{$start} form button:has-text(\"GIF\")")
        ->assertSeeIn('[role="dialog"]', 'Choose a GIF')
        ->assertSeeIn('[role="dialog"]', 'Powered by GIPHY')
        ->assertCount($result, 2)
        ->fill('[aria-label="Search GIFs…"]', 'party')
        ->assertCount($result, 1)
        ->assertAttribute("{$result} img", 'src', '/gifs/party1/preview')
        ->assertScript(plan07ImageLoaded("{$result} img"), true)
        ->click($result)
        ->assertNotPresent('[role="dialog"]')
        ->assertAttribute("{$start} form img", 'src', '/gifs/party1/preview')
        ->assertPresent("{$start} form [aria-label=\"Remove GIF\"]")
        ->click("{$start} form button:not([type=\"button\"])")
        ->assertPresent('article[id^="card-"] button[aria-label="GIF"]');

    $card = Card::query()->where('gif_id', 'party1')->sole();

    expect($card->content)->toBeNull();

    $bobPage->assertAttribute("#card-{$card->id} button[aria-label=\"GIF\"] img", 'src', '/gifs/party1/preview')
        ->assertScript(plan07ImageLoaded("#card-{$card->id} button[aria-label=\"GIF\"] img"), true);

    $carolPage->assertSeeIn("#card-{$card->id}", 'Hidden until writing ends')
        ->assertNotPresent("#card-{$card->id} img");

    $alicePage->press('Next')->assertSeeIn('[aria-current="step"]', 'Grouping');

    $carolPage->assertSeeIn('[aria-current="step"]', 'Grouping')
        ->assertAttribute("#card-{$card->id} button[aria-label=\"GIF\"] img", 'src', '/gifs/party1/preview')
        ->assertScript(plan07ImageLoaded("#card-{$card->id} button[aria-label=\"GIF\"] img"), true)
        ->click("#card-{$card->id} button[aria-label=\"GIF\"]")
        ->assertAttribute('[role="dialog"] img', 'src', '/gifs/party1/full')
        ->assertScript(plan07ImageLoaded('[role="dialog"] img'), true);

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertScript(plan07Requested('/gifs/party1/preview'), true)
            ->assertScript(plan07ThirdPartyRequests(), 0)
            ->assertScript(plan07ForeignImages(), 0)
            ->assertScript('document.documentElement.outerHTML.includes("plan07-gif-key")', false)
            ->assertScript('document.documentElement.outerHTML.includes("giphy.com")', false);
    }

    Http::assertSent(fn (Request $request): bool => str_starts_with($request->url(), 'https://api.giphy.com/v1/gifs/trending')
        && str_contains($request->url(), 'api_key=plan07-gif-key')
        && str_contains($request->url(), 'rating=pg'));
    Http::assertSent(fn (Request $request): bool => str_starts_with($request->url(), 'https://api.giphy.com/v1/gifs/search')
        && str_contains($request->url(), 'q=party')
        && str_contains($request->url(), 'api_key=plan07-gif-key'));
    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://media.giphy.com/party1/200w.webp');
    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://media.giphy.com/party1/giphy.webp');
    Http::assertNotSent(fn (Request $request): bool => str_contains($request->url(), 'tenor'));
    Storage::assertExists('gifs/giphy/party1-preview');
    Storage::assertExists('gifs/giphy/party1-full');
});

it('[P07-05b] serves the emoji picker data itself, fetching it once from the CDN on the server', function () {
    plan07FakeUpstreams();

    [
        'retro' => $retro,
        'columns' => $columns,
        'bob' => $bob,
        'carol' => $carol,
        'aliceParticipant' => $aliceParticipant,
    ] = plan07Board();
    $card = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $rocket = '[role="dialog"] [role="gridcell"][aria-label="Rocket"]';

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->click("#card-{$card->id} [aria-label=\"Add a reaction\"]")
            ->assertSee('More emoji…')
            ->click('More emoji…')
            ->assertSeeIn('[role="dialog"]', 'Add a reaction')
            ->assertPresent('[role="dialog"] [aria-label="Search emoji…"]')
            ->assertVisible($rocket)
            ->assertPresent('[role="dialog"] [role="gridcell"][aria-label="Unicorn"]')
            ->assertDontSee('Emoji list unavailable')
            ->assertScript(plan07Requested('/emoji-data/17.0.0/en/data.json'), true)
            ->assertScript(plan07Requested('/emoji-data/17.0.0/en/messages.json'), true)
            ->assertScript(plan07ThirdPartyRequests(), 0);
    }

    Http::assertSentCount(2);
    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://cdn.jsdelivr.net/npm/emojibase-data@17.0.0/en/data.json');
    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://cdn.jsdelivr.net/npm/emojibase-data@17.0.0/en/messages.json');
    Storage::assertExists('emoji-data/17.0.0/en/data.json');
    Storage::assertExists('emoji-data/17.0.0/en/messages.json');
});

it('[P07-03b] adds a card reaction chosen in the full emoji picker', function () {
    plan07FakeUpstreams();

    [
        'retro' => $retro,
        'columns' => $columns,
        'bob' => $bob,
        'carol' => $carol,
        'aliceParticipant' => $aliceParticipant,
        'bobParticipant' => $bobParticipant,
    ] = plan07Board();
    $card = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    $bobPage->click("#card-{$card->id} [aria-label=\"Add a reaction\"]")
        ->assertSee('More emoji…')
        ->click('More emoji…')
        ->assertVisible('[role="dialog"] [role="gridcell"][aria-label="Rocket"]')
        ->click('[role="dialog"] [role="gridcell"][aria-label="Rocket"]')
        ->assertNotPresent('[role="dialog"]')
        ->assertAriaAttribute(plan07Chip($card, '🚀', 1), 'pressed', 'true');

    $carolPage->assertAriaAttribute(plan07Chip($card, '🚀', 1), 'pressed', 'false')
        ->click(plan07Chip($card, '🚀', 1))
        ->assertAriaAttribute(plan07Chip($card, '🚀', 2), 'pressed', 'true');

    $bobPage->assertAriaAttribute(plan07Chip($card, '🚀', 2), 'pressed', 'true');

    expect(CardReaction::query()->where('card_id', $card->id)->where('emoji', '🚀')->count())->toBe(2)
        ->and(CardReaction::query()->where('participant_id', $bobParticipant->id)->sole()->emoji)->toBe('🚀');
});

it('[P07-07b] offers the "Allow GIFs" switch when a provider is configured and stops new GIFs while keeping the existing ones', function () {
    plan07FakeUpstreams();
    plan07EnableGifs();

    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'bobParticipant' => $bobParticipant,
    ] = plan07Board(RetroPhase::Writing);
    $card = plan07Card($retro, $columns[0], $bobParticipant, null, 0, 'party1');
    $gifButtons = '[data-test^="retro-column-"] form button:has-text("GIF")';
    $image = "#card-{$card->id} button[aria-label=\"GIF\"] img";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertCount($gifButtons, 3)
        ->assertAttribute($image, 'src', '/gifs/party1/preview')
        ->assertScript(plan07ImageLoaded($image), true);

    plan07OpenSettings($alicePage)
        ->assertSee('Allow GIFs')
        ->assertAriaAttribute('#retro-gifs', 'checked', 'true')
        ->assertPresent('#retro-reactions')
        ->assertPresent('#retro-cursors')
        ->assertPresent('#retro-hide-vote-counts')
        ->assertPresent('#retro-locked')
        ->assertPresent('#retro-presentation')
        ->click('#retro-gifs')
        ->assertAriaAttribute('#retro-gifs', 'checked', 'false');
    plan07SaveSettings($alicePage);

    $bobPage->assertCount($gifButtons, 0)
        ->assertCount('[aria-label="Add a card…"]', 3)
        ->assertScript(plan07ImageLoaded($image), true)
        ->assertScript(plan07ThirdPartyRequests(), 0);

    expect($retro->fresh()->gifs_enabled)->toBeFalse()
        ->and($card->fresh()->gif_id)->toBe('party1');

    Http::assertSent(fn (Request $request): bool => str_starts_with($request->url(), 'https://api.giphy.com/v1/gifs/party1')
        && str_contains($request->url(), 'api_key=plan07-gif-key'));
});
```

- [ ] **Step 6: Run the four tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php --filter='P07-0(5a|5b|3b|7b)'`
Expected: PASS (4 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If an image never loads (`plan07ImageLoaded()` stays false), request `/gifs/party1/preview` in the headed browser: a 502 means the fake media response was refused by `GifsController::download()` (content type or size); see the harness findings.

- [ ] **Step 7: Format and check**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining style issue; Pint may reorder the imports.

Run: `composer rector:check`
Expected: no proposed change. If Rector proposes a rewrite of the new code (for example a return type on the arrow functions of `plan07FakeUpstreams()`), apply it with `composer rector`, then run Pint again.

- [ ] **Step 8: Run the whole file twice**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php`
Expected: PASS (18 tests).

Run the same command a second time.
Expected: PASS (18 tests) again. `[P07-01b]` and `[P07-02a]` depend on two events arriving close together; if either passes once and fails once, do not add a sleep: report it under "Defects found" in `docs/superpowers/walkthroughs/coverage.md` with the failing assertion, and follow the fallback given for it in this plan's notes.

- [ ] **Step 9: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php
git commit -m "test(browser): cover the board engagement walkthrough: live cursors, flying reactions, GIFs and emoji data through skrum"
```

### Task 5: Plan 9a walkthrough: action items on the board (priorities, assignees, comments, lock, anonymity, delete warning)

This task automates the five steps of the plan 9a walkthrough (`docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md`, lines 7684 to 7688). The feature spec is `docs/superpowers/specs/2026-09-29-action-items-v2-design.md`. No product file changes in this task, so no frontend build is needed.

Facts about the interface that the selectors rely on (all read from the current code):

- The board's action item panel is `<aside>` without an `aria-label` (`resources/js/components/retro/action-items-panel.tsx`), rendered only in `Discussing`. Its create form is the only `<form>` that contains `[aria-label="Add an action item…"]`; the form also holds the selects `[aria-label="Priority"]`, `[aria-label="Repeat"]`, `[aria-label="Assignee"]`, the date input `[aria-label="Due date"]` and one `button[type="submit"]` ("Add").
- An item card is `<li id="action-item-{id}">` (`resources/js/components/action-items/action-item-card.tsx`). It holds the complete toggle `[aria-label="Mark as done"]` or `[aria-label="Reopen"]` (a Radix checkbox: a `<button role="checkbox">` that carries `disabled` when the viewer may not complete), the buttons `button[aria-label="Edit action item"]` and `[aria-label="Delete action item"]` (rendered only for managers on an editable board), the same three selects and date input as the form, and the comment toggle `button[aria-controls="action-item-{id}-comments"]` whose text is `0 comments`, `1 comment`, `2 comments`.
- The thread is `<div id="action-item-{id}-comments">` (`action-item-comments.tsx`): a `<ul>` of comments, each with the author's name and, where allowed, `[aria-label="Delete comment"]`; then a form with `[aria-label="Write a comment…"]` and a `button[type="submit"]` ("Comment").
- The due date chip is a badge (`[data-slot="badge"]`): `Due Oct 4` when not overdue, and the destructive variant (class `bg-destructive`) reading `Overdue · Oct 1` when overdue (`due-date-chip.tsx`). The date is formatted by `Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' })`, so English shows `Oct 4`, not the walkthrough's `4 Oct`. PHP's `format('M j')` gives the same text.
- The assignee select groups its options in `[role="group"]` elements labelled "In this retro" (team members who joined, then guests suffixed `(guest)`) and "Team" (members who have not joined) (`assignee-select.tsx`).
- A Radix select is driven by clicking its trigger, waiting for `[role="listbox"]`, clicking `[role="option"]:has-text("…")`, and waiting for the listbox to go away. `:has-text()` is a case-insensitive substring match, so option texts and user names in this file are chosen so that no option's text contains another's.
- `assertSeeIn()` resolves the text with `getByText()` inside the selector and is strict: the text must match one element there. Where a card can show the same text twice (for example a name both as creator and as assignee), the tests read the card's `innerText` with `assertScript()` instead.
- A board closed for editing (`retro.isLocked`) disables the form and every card control and hides edit and delete (`ctx.isEditable`, `resources/js/components/retro/board.tsx` line 129), and shows the badge "Board closed for editing" (`lock-badge.tsx`). A click can therefore reach the server on a locked board only when the page has not learned about the lock yet; `[P09a-03b]` locks the retro in the database after the page has loaded to see the 423 toast "The board is closed for editing." and the resync.
- The lock is the checkbox `#retro-locked` ("Close for editing") in the dialog opened by "Settings…" of the facilitator menu (`settings-dialog.tsx`).
- In `Completed`, the Results view lists the items as `<li id="action-item-{id}">` too (`results/action-items-results.tsx`): priority icon (`svg.text-red-600` high, `svg.text-slate-500` low), a `[aria-label="Done"]` check when completed, content, due chip, `Theme: {name}`, assignee label, and the link "View the team's action items" for members only (`links.actionItems` is `null` for guests).
- The delete dialog shows "This also deletes 1 open action item." or "This also deletes N open action items." (`delete-retro-dialog.tsx`).

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php`
- Test: `tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` bound to `tests/Browser` (plan 16a), with `$this->signIn(User $user, string $to = '/dashboard'): mixed`, `$this->joinAsGuest(string $joinUrl, string $name): mixed`, `$this->awaitRealtime(mixed $page): mixed`.
  - `data-realtime` on the root of `retros/show` (plan 16a Task 3).
  - Existing helpers in `tests/Pest.php`: `retroFacilitator(Retro $retro): array{0: User, 1: Participant}`, `retroMember(Retro $retro): array{0: User, 1: Participant}`, `teamMember(Team $team): User`.
  - Factories: `RetroFactory::inPhase()`, `RetroFactory::withGuestAccess()`, `ActionItemFactory` (attributes `retro_id`, `created_by_participant_id`, `content`, `priority`, `due_on`, `assignee_user_id`, `assignee_participant_id`, `completed_at`, `theme_name`).
  - `App\Models\ActionItem::today(): CarbonImmutable` (today in the instance time zone).
- Produces:
  - File-level helpers in `tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php` (global functions; later files must not redeclare them): `p09aBoard(RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array`, `p09aItem(Retro $retro, Participant $author, string $content, array $attributes = []): ActionItem`, `p09aGuest(Retro $retro): Participant`, `p09aCard(ActionItem $item): string`, `p09aCardShows(ActionItem $item, string $text): string`, `p09aDueLabel(CarbonImmutable $date): string`, `p09aForm(): string`, `p09aChoose(mixed $page, string $trigger, string $option): void`.
  - No `data-test` hook: every target is addressed by an existing id, aria-label or role.

- [ ] **Step 1: Create the test file with its helpers and the tests of walkthrough step 1**

`php artisan make:test` only writes under `tests/Feature` or `tests/Unit`, so create `tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php` directly with this content:

```php
<?php

use App\Enums\ActionItemPriority;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: User,
 *     2: User,
 *     3: Participant,
 *     4: Participant
 * }
 */
function p09aBoard(RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
        ->withGuestAccess()
        ->create(['title' => 'Sprint 12', ...$attributes]);

    [$alice, $aliceParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);

    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    return [$retro->fresh(), $alice, $bob, $aliceParticipant, $bobParticipant];
}

/**
 * @param  array<string, mixed>  $attributes
 */
function p09aItem(Retro $retro, Participant $author, string $content, array $attributes = []): ActionItem
{
    return ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $author->id,
        'content' => $content,
        ...$attributes,
    ]);
}

function p09aGuest(Retro $retro): Participant
{
    return Participant::query()
        ->where('retro_id', $retro->id)
        ->whereNotNull('guest_name')
        ->sole();
}

function p09aCard(ActionItem $item): string
{
    return "#action-item-{$item->id}";
}

function p09aCardShows(ActionItem $item, string $text): string
{
    $needle = json_encode($text, JSON_THROW_ON_ERROR);

    return "document.getElementById('action-item-{$item->id}').innerText.includes({$needle})";
}

function p09aDueLabel(CarbonImmutable $date): string
{
    return $date->format('M j');
}

function p09aForm(): string
{
    return 'aside:not([aria-label]) form:has([aria-label="Add an action item…"])';
}

function p09aChoose(mixed $page, string $trigger, string $option): void
{
    $page->click($trigger)
        ->assertPresent('[role="listbox"]')
        ->click("[role=\"option\"]:has-text(\"{$option}\")")
        ->assertNotPresent('[role="listbox"]');
}

it('[P09a-01a] creates action items with each priority, a due date chip and an overdue badge', function () {
    [$retro, $alice, $bob] = p09aBoard();
    $form = p09aForm();
    $input = "{$form} [aria-label=\"Add an action item…\"]";
    $priority = "{$form} [aria-label=\"Priority\"]";
    $dueDate = "{$form} [aria-label=\"Due date\"]";
    $submit = "{$form} button[type=\"submit\"]";
    $dueSoon = ActionItem::today()->addDays(3);
    $pastDue = ActionItem::today()->subDays(2);
    $dueSoonLabel = p09aDueLabel($dueSoon);
    $pastDueLabel = p09aDueLabel($pastDue);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->assertVisible($input)
        ->assertDontSee('Action items are not anonymous: your name is shown.')
        ->fill($input, 'Rotate the on-call');
    p09aChoose($alicePage, $priority, 'High');
    $alicePage->fill($dueDate, $dueSoon->toDateString())
        ->click($submit)
        ->assertSee('Rotate the on-call')
        ->assertValue($input, '');

    $alicePage->fill($input, 'Archive the old runbooks');
    p09aChoose($alicePage, $priority, 'Low');
    $alicePage->fill($dueDate, $pastDue->toDateString())
        ->click($submit)
        ->assertSee('Archive the old runbooks')
        ->assertValue($input, '');

    $alicePage->fill($input, 'Tidy the backlog')
        ->keys($input, 'Enter')
        ->assertSee('Tidy the backlog');

    $high = ActionItem::query()->where('content', 'Rotate the on-call')->sole();
    $low = ActionItem::query()->where('content', 'Archive the old runbooks')->sole();
    $medium = ActionItem::query()->where('content', 'Tidy the backlog')->sole();
    $highCard = p09aCard($high);
    $lowCard = p09aCard($low);
    $mediumCard = p09aCard($medium);

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertSeeIn("{$highCard} [aria-label=\"Priority\"]", 'High')
            ->assertScript(p09aCardShows($high, "Due {$dueSoonLabel}"), true)
            ->assertNotPresent("{$highCard} [data-slot=\"badge\"].bg-destructive")
            ->assertSeeIn("{$lowCard} [aria-label=\"Priority\"]", 'Low')
            ->assertScript(p09aCardShows($low, "Overdue · {$pastDueLabel}"), true)
            ->assertPresent("{$lowCard} [data-slot=\"badge\"].bg-destructive")
            ->assertSeeIn("{$mediumCard} [aria-label=\"Priority\"]", 'Medium')
            ->assertScript(p09aCardShows($medium, 'Alice Martin'), true);
    }

    expect($high->priority)->toBe(ActionItemPriority::High)
        ->and($high->due_on?->toDateString())->toBe($dueSoon->toDateString())
        ->and($low->priority)->toBe(ActionItemPriority::Low)
        ->and($low->due_on?->toDateString())->toBe($pastDue->toDateString())
        ->and($medium->priority)->toBe(ActionItemPriority::Medium)
        ->and($medium->due_on)->toBeNull();
});

it('[P09a-01b] assigns items to a team member outside the retro, a joined member and a guest', function () {
    [$retro, $alice, $bob, $aliceParticipant] = p09aBoard();
    $dan = teamMember($retro->team);
    $dan->update(['name' => 'Dan Rivers', 'locale' => 'en']);
    $forDan = p09aItem($retro, $aliceParticipant, 'Rotate the on-call');
    $forBob = p09aItem($retro, $aliceParticipant, 'Automate the release notes');
    $forCarol = p09aItem($retro, $aliceParticipant, 'Tidy the backlog');
    $assignee = fn (ActionItem $item): string => "#action-item-{$item->id} [aria-label=\"Assignee\"]";
    $joined = '[role="listbox"] [role="group"]:has-text("In this retro")';
    $others = '[role="listbox"] [role="group"]:has-text("Team")';

    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));
    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $alicePage->assertSeeIn($assignee($forDan), 'Unassigned')
        ->click($assignee($forDan))
        ->assertSeeIn($joined, 'Bob Stone')
        ->assertSeeIn($joined, 'Carol Guest (guest)')
        ->assertSeeIn($others, 'Dan Rivers')
        ->assertDontSeeIn($joined, 'Dan Rivers')
        ->click('[role="option"]:has-text("Dan Rivers")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn($assignee($forDan), 'Dan Rivers');

    p09aChoose($alicePage, $assignee($forBob), 'Bob Stone');
    $alicePage->assertSeeIn($assignee($forBob), 'Bob Stone');

    p09aChoose($alicePage, $assignee($forCarol), 'Carol Guest (guest)');
    $alicePage->assertSeeIn($assignee($forCarol), 'Carol Guest (guest)');

    $carolPage->assertSeeIn($assignee($forDan), 'Dan Rivers')
        ->assertSeeIn($assignee($forBob), 'Bob Stone')
        ->assertSeeIn($assignee($forCarol), 'Carol Guest (guest)');

    expect($forDan->fresh()->assignee_user_id)->toBe($dan->id)
        ->and($forBob->fresh()->assignee_user_id)->toBe($bob->id)
        ->and($forCarol->fresh()->assignee_user_id)->toBeNull()
        ->and($forCarol->fresh()->assignee_participant_id)->toBe(p09aGuest($retro)->id);
});

it('[P09a-01c] lets the guest tick only their own item and shows edit and delete to managers only', function () {
    [$retro, $alice, $bob, $aliceParticipant] = p09aBoard();
    $edit = 'button[aria-label="Edit action item"]';
    $delete = '[aria-label="Delete action item"]';

    $carolPage = $this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest');
    $carolPage->assertSeeIn('header > h1', 'Sprint 12');

    $hers = p09aItem($retro, $aliceParticipant, 'Tidy the backlog', ['assignee_participant_id' => p09aGuest($retro)->id]);
    $his = p09aItem($retro, $aliceParticipant, 'Automate the release notes', ['assignee_user_id' => $bob->id]);
    $hersCard = p09aCard($hers);
    $hisCard = p09aCard($his);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage->navigate("/retros/{$retro->id}");
    $this->awaitRealtime($carolPage);

    $carolPage->assertEnabled("{$hersCard} [aria-label=\"Mark as done\"]")
        ->assertDisabled("{$hisCard} [aria-label=\"Mark as done\"]")
        ->assertDisabled("{$hersCard} [aria-label=\"Priority\"]")
        ->assertCount($edit, 0)
        ->assertCount($delete, 0)
        ->click("{$hersCard} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$hersCard} [aria-label=\"Reopen\"]");

    $alicePage->assertPresent("{$hersCard} [aria-label=\"Reopen\"]")
        ->assertEnabled("{$hisCard} [aria-label=\"Mark as done\"]")
        ->assertCount($edit, 2)
        ->assertCount($delete, 2);

    $bobPage->assertPresent("{$hersCard} [aria-label=\"Reopen\"]")
        ->assertDisabled("{$hersCard} [aria-label=\"Reopen\"]")
        ->assertEnabled("{$hisCard} [aria-label=\"Mark as done\"]")
        ->assertCount($edit, 0)
        ->assertCount($delete, 0);

    expect($hers->fresh()->completed_at)->not->toBeNull()
        ->and($his->fresh()->completed_at)->toBeNull();
});
```

`[P09a-01c]` lets the guest join before the items exist because an item can only be assigned to a guest whose participant row exists; the guest's page is then reloaded with `navigate()` so that it shows the two items.

- [ ] **Step 2: Run the tests of walkthrough step 1**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php --filter='P09a-01'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. `[P09a-01a]` fills a native `<input type="date">` with an ISO date. If this fails, see the harness findings.

- [ ] **Step 3: Add the comment test (walkthrough step 2)**

In `tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php`, add this import after `use App\Models\ActionItem;`:

```php
use App\Models\ActionItemComment;
```

Append this test at the end of the file:

```php
it('[P09a-02] updates comment counts and open threads live and lets the facilitator delete a guest comment', function () {
    [$retro, $alice, $bob, $aliceParticipant] = p09aBoard();
    $item = p09aItem($retro, $aliceParticipant, 'Rotate the on-call');
    $card = p09aCard($item);
    $toggle = "{$card} button[aria-controls=\"action-item-{$item->id}-comments\"]";
    $thread = "#action-item-{$item->id}-comments";
    $comments = "{$thread} ul";
    $box = "{$thread} [aria-label=\"Write a comment…\"]";
    $send = "{$thread} form:has([aria-label=\"Write a comment…\"]) button[type=\"submit\"]";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->assertSeeIn($toggle, '0 comments')
        ->click($toggle)
        ->assertSeeIn($thread, 'No comments yet.');

    $carolPage->click($toggle)
        ->assertSeeIn($thread, 'No comments yet.')
        ->fill($box, 'Who owns this?')
        ->click($send)
        ->assertSeeIn($comments, 'Who owns this?')
        ->assertSeeIn($toggle, '1 comment');

    $bobPage->assertSeeIn($toggle, '1 comment')
        ->assertNotPresent($thread);

    $alicePage->assertSeeIn($toggle, '1 comment')
        ->assertSeeIn($comments, 'Who owns this?')
        ->assertSeeIn($comments, 'Carol Guest')
        ->fill($box, 'I do.')
        ->click($send)
        ->assertSeeIn($comments, 'I do.');

    $carolPage->assertSeeIn($toggle, '2 comments')
        ->assertSeeIn($comments, 'I do.')
        ->assertSeeIn($comments, 'Alice Martin')
        ->assertCount("{$thread} [aria-label=\"Delete comment\"]", 1);

    $bobPage->assertSeeIn($toggle, '2 comments');

    $alicePage->assertCount("{$thread} [aria-label=\"Delete comment\"]", 2)
        ->click("{$thread} li:has-text(\"Who owns this?\") [aria-label=\"Delete comment\"]")
        ->assertSeeIn($toggle, '1 comment')
        ->assertDontSeeIn($thread, 'Who owns this?');

    $carolPage->assertSeeIn($toggle, '1 comment')
        ->assertSeeIn($comments, 'I do.')
        ->assertDontSeeIn($thread, 'Who owns this?');

    $bobPage->assertSeeIn($toggle, '1 comment');

    expect(ActionItemComment::query()->where('action_item_id', $item->id)->pluck('content')->all())->toBe(['I do.']);
});
```

Bob never opens the thread: his page proves that a closed card only updates its count, while Alice's and Carol's open threads refetch.

- [ ] **Step 4: Run the comment test**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php --filter='P09a-02'`
Expected: PASS (1 test); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 5: Add the lock and Results tests (walkthrough step 3)**

Append these tests at the end of `tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php` (no new import):

```php
it('[P09a-03a] disables the action item controls for everyone when the facilitator closes the board for editing', function () {
    [$retro, $alice, $bob, , $bobParticipant] = p09aBoard();
    $item = p09aItem($retro, $bobParticipant, 'Rotate the on-call');
    $card = p09aCard($item);
    $form = p09aForm();
    $input = "{$form} [aria-label=\"Add an action item…\"]";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertEnabled($input)
        ->assertEnabled("{$card} [aria-label=\"Mark as done\"]")
        ->assertCount('[aria-label="Delete action item"]', 1);

    $alicePage->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertVisible('#retro-locked')
        ->click('#retro-locked')
        ->assertAttribute('#retro-locked', 'aria-checked', 'true')
        ->press('Save')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Board closed for editing')
        ->assertDisabled($input);

    $bobPage->assertSee('Board closed for editing')
        ->assertDisabled($input)
        ->assertDisabled("{$card} [aria-label=\"Mark as done\"]")
        ->assertCount('button[aria-label="Edit action item"]', 0)
        ->assertCount('[aria-label="Delete action item"]', 0);

    expect($retro->fresh()->is_locked)->toBeTrue();
});

it('[P09a-03b] shows a toast and resyncs when an edit reaches a board that was closed for editing', function () {
    [$retro, , $bob, , $bobParticipant] = p09aBoard();
    $item = p09aItem($retro, $bobParticipant, 'Rotate the on-call');
    $card = p09aCard($item);

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertEnabled("{$card} [aria-label=\"Mark as done\"]");

    $retro->forceFill(['is_locked' => true])->save();

    $page->click("{$card} [aria-label=\"Mark as done\"]")
        ->assertSee('The board is closed for editing.')
        ->assertSee('Board closed for editing')
        ->assertDisabled("{$card} [aria-label=\"Mark as done\"]");

    expect($item->fresh()->completed_at)->toBeNull();
});

it('[P09a-03c] lists priority, due date, overdue badge, assignee, status and theme in the Results view', function () {
    [$retro, , $bob, $aliceParticipant] = p09aBoard();
    $pastDue = ActionItem::today()->subDays(2);
    $dueSoon = ActionItem::today()->addDays(3);
    $pastDueLabel = p09aDueLabel($pastDue);
    $dueSoonLabel = p09aDueLabel($dueSoon);

    $carolPage = $this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest');
    $carolPage->assertSeeIn('header > h1', 'Sprint 12');

    $open = p09aItem($retro, $aliceParticipant, 'Rotate the on-call', [
        'priority' => ActionItemPriority::High,
        'due_on' => $pastDue->toDateString(),
        'assignee_user_id' => $bob->id,
        'theme_name' => 'Delivery',
    ]);
    $done = p09aItem($retro, $aliceParticipant, 'Tidy the backlog', [
        'priority' => ActionItemPriority::Low,
        'due_on' => $dueSoon->toDateString(),
        'assignee_participant_id' => p09aGuest($retro)->id,
        'completed_at' => now(),
    ]);
    $openCard = p09aCard($open);
    $doneCard = p09aCard($done);

    $retro->forceFill(['phase' => RetroPhase::Completed, 'completed_at' => now()])->save();

    $bobPage = $this->signIn($bob, "/retros/{$retro->id}");

    $bobPage->assertSee('Retrospective completed on')
        ->assertPresent("{$openCard} svg.text-red-600")
        ->assertScript(p09aCardShows($open, "Overdue · {$pastDueLabel}"), true)
        ->assertPresent("{$openCard} [data-slot=\"badge\"].bg-destructive")
        ->assertScript(p09aCardShows($open, 'Bob Stone'), true)
        ->assertScript(p09aCardShows($open, 'Theme: Delivery'), true)
        ->assertNotPresent("{$openCard} [aria-label=\"Done\"]")
        ->assertPresent("{$doneCard} svg.text-slate-500")
        ->assertScript(p09aCardShows($done, "Due {$dueSoonLabel}"), true)
        ->assertScript(p09aCardShows($done, 'Carol Guest (guest)'), true)
        ->assertPresent("{$doneCard} [aria-label=\"Done\"]")
        ->assertNotPresent('[aria-label="Mark as done"]')
        ->assertNotPresent('[aria-label="Add an action item…"]')
        ->assertSee("View the team's action items")
        ->assertPresent("a[href*=\"/action-items?team={$retro->team_id}\"]");

    $carolPage->navigate("/retros/{$retro->id}");

    $carolPage->assertSee('Retrospective completed on')
        ->assertScript(p09aCardShows($open, 'Rotate the on-call'), true)
        ->assertDontSee("View the team's action items")
        ->assertNotPresent('a[href*="/action-items"]');
});
```

- [ ] **Step 6: Run the lock and Results tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php --filter='P09a-03'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. `[P09a-03c]` reloads a guest's page after the retro was completed in the database. If this fails, see the harness findings.

- [ ] **Step 7: Add the anonymous-retro and delete-warning tests (walkthrough steps 4 and 5)**

Append these tests at the end of `tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php` (no new import):

```php
it('[P09a-04] warns that action items are not anonymous and names creators and comment authors on an anonymous retro', function () {
    [$retro, $alice] = p09aBoard(RetroPhase::Discussing, ['is_anonymous' => true]);
    $form = p09aForm();
    $input = "{$form} [aria-label=\"Add an action item…\"]";
    $notice = 'Action items are not anonymous: your name is shown.';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->assertSeeIn($form, $notice);

    $carolPage->assertSeeIn($form, $notice)
        ->fill($input, 'Automate the release notes')
        ->keys($input, 'Enter')
        ->assertSee('Automate the release notes');

    $item = ActionItem::query()->where('content', 'Automate the release notes')->sole();
    $card = p09aCard($item);
    $toggle = "{$card} button[aria-controls=\"action-item-{$item->id}-comments\"]";
    $thread = "#action-item-{$item->id}-comments";
    $comments = "{$thread} ul";

    $carolPage->assertScript(p09aCardShows($item, 'Carol Guest'), true);

    $alicePage->assertScript(p09aCardShows($item, 'Carol Guest'), true)
        ->click($toggle)
        ->assertSeeIn($thread, $notice)
        ->fill("{$thread} [aria-label=\"Write a comment…\"]", 'I can pair on this')
        ->click("{$thread} form:has([aria-label=\"Write a comment…\"]) button[type=\"submit\"]")
        ->assertSeeIn($comments, 'I can pair on this')
        ->assertSeeIn($comments, 'Alice Martin');

    $carolPage->assertSeeIn($toggle, '1 comment')
        ->click($toggle)
        ->assertSeeIn($thread, $notice)
        ->assertSeeIn($comments, 'I can pair on this')
        ->assertSeeIn($comments, 'Alice Martin');

    expect($item->created_by_participant_id)->toBe(p09aGuest($retro)->id);
});

it('[P09a-05] warns how many open action items are deleted with the retro', function (int $open, string $warning) {
    [$retro, $alice, , $aliceParticipant] = p09aBoard();
    $teamPath = route('teams.show', [$retro->team->workspace, $retro->team], false);

    foreach (range(1, $open) as $number) {
        p09aItem($retro, $aliceParticipant, "Follow-up {$number}");
    }

    p09aItem($retro, $aliceParticipant, 'Archive the old runbooks', ['completed_at' => now()]);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Delete retrospective…')
        ->click('Delete retrospective…')
        ->assertSeeIn('[role="dialog"]', $warning)
        ->press('Delete')
        ->assertPathIs($teamPath);

    expect(Retro::query()->whereKey($retro->id)->exists())->toBeFalse()
        ->and(ActionItem::query()->count())->toBe(0);
})->with([
    'one open item' => [1, 'This also deletes 1 open action item.'],
    'two open items' => [2, 'This also deletes 2 open action items.'],
]);
```

The named retro of `[P09a-01a]` asserts that the notice is absent, so the notice is tied to `is_anonymous`.

- [ ] **Step 8: Run the anonymous-retro and delete-warning tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php --filter='P09a-04|P09a-05'`
Expected: PASS (3 tests: one for step 4, two data sets for step 5); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 9: Format and check**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector`, then Pint again.

- [ ] **Step 10: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php`
Expected: PASS (10 tests).

- [ ] **Step 11: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php
git commit -m "test(browser): cover the action items core walkthrough"
```

### Task 6: Plan 9b walkthrough, part 1: carry-over panel, workspace page, items outside a retro, sub-tasks and recurrence

This task automates steps 1 to 5 of the plan 9b walkthrough (`docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md`, lines 5229 to 5233). Steps 3 and 4 need two members on the workspace "Action items" page with a live channel, and that page has no `data-realtime` attribute yet, so the task first adds it.

Facts about the interface that the selectors rely on (all read from the current code):

- The carry-over panel (`resources/js/components/retro/carried-action-items-panel.tsx`) renders a header button "Previous action items (n)" (n = open carried items) and a Radix sheet (`[role="dialog"]`) titled "Previous action items". It is rendered only for a non-guest viewer, outside `Completed`, when at least one item is carried. The sheet opens by itself only when the board is first loaded in `Writing` and `localStorage['skrum.carriedSeen.{retroId}']` is not set; it then stores `'true'` there. The sheet groups items under the source retro's title, or under "Added outside a retro", and its footer links to "Open the action items page".
- A retro carries the open items of the team's retros whose `created_at` is earlier than its own, and the retro-less items created before it (`app/Actions/ActionItems/CarriedActionItems.php`). The tests therefore date the earlier retro one week back.
- The header button's text contains parentheses, so it is addressed as `button:has-text("Previous action items (1)")`.
- The workspace page (`resources/js/pages/action-items/index.tsx`) has three filter selects whose triggers are direct children of the filter grid: `div.grid > [aria-label="Status"]`, `div.grid > [aria-label="Assignee"]`, `div.grid > [aria-label="Team"]`. The cards reuse `<li id="action-item-{id}">` and their own `[aria-label="Assignee"]` trigger is not a child of a `div.grid`. Filters are written to the query string (`status` unless `open`, `assignee`, `team`) and to `localStorage['skrum.actionItemFilters.{workspaceId}']`; opening the page without a query string applies the stored filters.
- "New action item" opens a dialog (`[role="dialog"]`) with a `[aria-label="Team"]` select, the same form as the board (`[aria-label="Add an action item…"]`) and one `button[type="submit"]` ("Create").
- A deep link `?item={id}` to an item the filters hide renders a `<section>` headed "Linked action item" above the list, with the card expanded (its comment toggle has `aria-expanded="true"`).
- Sub-tasks (`subtask-checklist.tsx`): `<ul aria-label="Sub-tasks">` whose rows hold a checkbox labelled with the sub-task's text, and for managers `[aria-label="Move up"]`, `[aria-label="Move down"]`, `[aria-label="Edit sub-task"]`, `[aria-label="Delete sub-task"]`; managers also get the input `[aria-label="Add a sub-task"]`. The card shows the progress in `<span aria-label="1 of 3 sub-tasks done">1/3</span>`.
- Recurrence (`recurrence-select.tsx`): the `[aria-label="Repeat"]` select is disabled until the item has a due date; a recurring item shows "Repeats weekly" and, on a generated occurrence, "Follows up the item completed on {date}". The card's due date input saves on blur.
- The sidebar entries are `a[data-sidebar="menu-button"]` inside `[data-sidebar="content"]` (`app-sidebar.tsx`, `nav-main.tsx`); the team page links to the page with "Open action items (n)" (`resources/js/pages/teams/show.tsx`).
- The page subscribes to `private-team-action-items.{teamId}` for each id of `realtimeTeamIds`; a `team-action-item.saved` event replaces the row and schedules a reload of the list one second later, which is how a new item appears on the other member's page.

**Files:**
- Modify: `resources/js/pages/action-items/index.tsx` (adds `data-realtime` to the page's root element)
- Create: `tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php`
- Test: `tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` (plan 16a) with `$this->signIn()`, `$this->joinAsGuest()`, `$this->awaitRealtime()`.
  - `realtimeState(connected: boolean, online: readonly unknown[]): 'connecting' | 'connected'` from `resources/js/lib/realtime/realtime-state.ts` and `useSafeConnectionStatus(): ConnectionStatus` from `resources/js/hooks/use-retro-channel.ts` (both exist).
  - Existing helper in `tests/Pest.php`: `teamMember(Team $team): User`.
  - Factories: `RetroFactory::inPhase()`, `RetroFactory::withGuestAccess()`, `ParticipantFactory::guest()`, `ActionItemFactory::withoutRetro(Team $team, User $author)`, `ActionItemFactory::assignedToGuest(Participant $guest)`, `ActionItemSubtaskFactory::completed()`.
- Produces:
  - `data-realtime="connecting"` or `"connected"` on the root `<div>` of the workspace "Action items" page: `connected` once the socket is up and every channel of `realtimeTeamIds` has confirmed its subscription. `$this->awaitRealtime($page)` therefore works on `/w/{workspace}/action-items`. A viewer with no visible team stays `connecting`.
  - File-level helpers in `tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php` (global functions): `p09bMember(Team $team, string $name): User`, `p09bTeam(): array`, `p09bJoin(Retro $retro, User $user, bool $facilitates = false): Participant`, `p09bCarryOver(RetroPhase $phase = RetroPhase::Writing): array`, `p09bFollowUp(Team $team, User $author, string $content, array $attributes = []): ActionItem`, `p09bPagePath(Team $team): string`, `p09bCard(ActionItem $item): string`, `p09bCardShows(ActionItem $item, string $text): string`, `p09bDueLabel(CarbonImmutable $date): string`, `p09bFilter(string $label): string`, `p09bChoose(mixed $page, string $trigger, string $option): void`.

- [ ] **Step 1: Add `data-realtime` to the workspace action items page**

The page tracks no subscription state today, so the attribute needs the socket status (the hook the boards already use) and the list of channels that confirmed their subscription. All four edits are in `resources/js/pages/action-items/index.tsx`.

Edit 1, the imports. These lines:

```tsx
import { useTrans } from '@/hooks/use-trans';
import { workspaceActionItemEndpoints } from '@/lib/action-items/endpoints';
import { formatShortDate } from '@/lib/action-items/format';
import type { ActionItemViewer } from '@/lib/action-items/permissions';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
```

become:

```tsx
import { useSafeConnectionStatus } from '@/hooks/use-retro-channel';
import { useTrans } from '@/hooks/use-trans';
import { workspaceActionItemEndpoints } from '@/lib/action-items/endpoints';
import { formatShortDate } from '@/lib/action-items/format';
import type { ActionItemViewer } from '@/lib/action-items/permissions';
import { realtimeState } from '@/lib/realtime/realtime-state';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
```

Edit 2, the state, inside `ActionItemsIndex`. These lines:

```tsx
    const [creating, setCreating] = useState(false);
    const pendingReload = useRef<ReturnType<typeof setTimeout> | null>(null);
```

become:

```tsx
    const [creating, setCreating] = useState(false);
    const [subscribedChannels, setSubscribedChannels] = useState<string[]>([]);
    const connectionStatus = useSafeConnectionStatus();
    const pendingReload = useRef<ReturnType<typeof setTimeout> | null>(null);
```

Edit 3, the subscription effect. These lines:

```tsx
        for (const name of names) {
            echo<'reverb'>()
                .private(name)
                .listen(
                    '.team-action-item.saved',
```

become:

```tsx
        for (const name of names) {
            echo<'reverb'>()
                .private(name)
                .subscribed(() =>
                    setSubscribedChannels((current) =>
                        current.includes(name) ? current : [...current, name],
                    ),
                )
                .listen(
                    '.team-action-item.saved',
```

and, at the end of the same effect, these lines:

```tsx
        return () => {
            for (const name of names) {
                echo().leave(name);
            }
        };
    }, [channelKey]);
```

become:

```tsx
        return () => {
            for (const name of names) {
                echo().leave(name);
            }

            setSubscribedChannels([]);
        };
    }, [channelKey]);
```

Edit 4, the root element of the returned markup. This line:

```tsx
            <div className="max-w-4xl space-y-6 p-4">
```

becomes:

```tsx
            <div
                className="max-w-4xl space-y-6 p-4"
                data-realtime={realtimeState(
                    connectionStatus === 'connected',
                    subscribedChannels.length === realtimeTeamIds.length
                        ? subscribedChannels
                        : [],
                )}
            >
```

`.subscribed()` is the callback `use-retro-channel.ts` already attaches to its private channels. The new state feeds only the attribute: no request, event handler or rendered text changes.

- [ ] **Step 2: Check and rebuild the frontend**

Run: `npm run types:check`
Expected: no error.

Run: `npm run check`
Expected: only the known pre-existing findings in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`; nothing in `resources/js`.

Run: `npm run build`
Expected: the build succeeds. The browser suite serves `public/build`, so the attribute is invisible to the tests until this build has run.

- [ ] **Step 3: Create the test file with its helpers and the carry-over tests (walkthrough step 1)**

Create `tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php` directly with this content:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;

function p09bMember(Team $team, string $name): User
{
    $user = teamMember($team);

    $user->update(['name' => $name, 'locale' => 'en']);

    return $user;
}

/**
 * @return array{
 *     0: Team,
 *     1: User,
 *     2: User
 * }
 */
function p09bTeam(): array
{
    $team = Team::factory()->create(['name' => 'Platform']);

    return [$team, p09bMember($team, 'Alice Martin'), p09bMember($team, 'Bob Stone')];
}

function p09bJoin(Retro $retro, User $user, bool $facilitates = false): Participant
{
    $participant = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $user->id]);

    if ($facilitates) {
        $retro->forceFill(['facilitator_participant_id' => $participant->id])->save();
    }

    return $participant;
}

/**
 * @return array{
 *     0: Retro,
 *     1: ActionItem,
 *     2: User,
 *     3: User,
 *     4: Team
 * }
 */
function p09bCarryOver(RetroPhase $phase = RetroPhase::Writing): array
{
    [$team, $alice, $bob] = p09bTeam();

    $earlier = Retro::factory()->inPhase(RetroPhase::Completed)->create([
        'team_id' => $team->id,
        'title' => 'Sprint 11',
        'created_at' => now()->subWeek(),
        'completed_at' => now()->subWeek(),
    ]);
    $carried = ActionItem::factory()->create(['retro_id' => $earlier->id, 'content' => 'Buy a faster runner']);

    $retro = Retro::factory()
        ->inPhase($phase)
        ->withGuestAccess()
        ->create(['team_id' => $team->id, 'title' => 'Sprint 12']);

    p09bJoin($retro, $alice, facilitates: true);
    p09bJoin($retro, $bob);

    return [$retro->fresh(), $carried, $alice, $bob, $team];
}

/**
 * @param  array<string, mixed>  $attributes
 */
function p09bFollowUp(Team $team, User $author, string $content, array $attributes = []): ActionItem
{
    return ActionItem::factory()
        ->withoutRetro($team, $author)
        ->create(['content' => $content, ...$attributes]);
}

function p09bPagePath(Team $team): string
{
    return route('workspaces.actionItems.index', ['workspace' => $team->workspace], false);
}

function p09bCard(ActionItem $item): string
{
    return "#action-item-{$item->id}";
}

function p09bCardShows(ActionItem $item, string $text): string
{
    $needle = json_encode($text, JSON_THROW_ON_ERROR);

    return "document.getElementById('action-item-{$item->id}').innerText.includes({$needle})";
}

function p09bDueLabel(CarbonImmutable $date): string
{
    return $date->format('M j');
}

function p09bFilter(string $label): string
{
    return "div.grid > [aria-label=\"{$label}\"]";
}

function p09bChoose(mixed $page, string $trigger, string $option): void
{
    $page->click($trigger)
        ->assertPresent('[role="listbox"]')
        ->click("[role=\"option\"]:has-text(\"{$option}\")")
        ->assertNotPresent('[role="listbox"]');
}

it('[P09b-01a] opens the previous action items once in Writing and updates the other member live', function () {
    [$retro, $carried, $alice, $bob] = p09bCarryOver();
    $sheet = '[role="dialog"]';
    $card = "{$sheet} #action-item-{$carried->id}";
    $seen = "localStorage.getItem('skrum.carriedSeen.{$retro->id}')";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertSeeIn($sheet, 'Previous action items')
            ->assertSeeIn($sheet, 'Sprint 11')
            ->assertSeeIn($sheet, 'Buy a faster runner')
            ->assertPresent('button:has-text("Previous action items (1)")')
            ->assertScript($seen, 'true');
    }

    $bobPage->assertDisabled("{$card} [aria-label=\"Mark as done\"]");

    $alicePage->click("{$card} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$card} [aria-label=\"Reopen\"]")
        ->assertPresent('button:has-text("Previous action items (0)")');

    $bobPage->assertPresent("{$card} [aria-label=\"Reopen\"]")
        ->assertPresent('button:has-text("Previous action items (0)")');

    expect($carried->fresh()->completed_at)->not->toBeNull();

    $alicePage->navigate("/retros/{$retro->id}");

    $this->awaitRealtime($alicePage)
        ->assertPresent('button:has-text("Previous action items (0)")')
        ->assertNotPresent($sheet)
        ->click('button:has-text("Previous action items (0)")')
        ->assertSeeIn($sheet, 'Buy a faster runner');
});

it('[P09b-01b] never shows the previous action items to a guest', function () {
    [$retro, $carried, $alice] = p09bCarryOver();
    $sheet = '[role="dialog"]';
    $card = "{$sheet} #action-item-{$carried->id}";

    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));
    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $carolPage->assertSeeIn('header > h1', 'Sprint 12');

    $alicePage->click("{$card} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$card} [aria-label=\"Reopen\"]")
        ->keys($sheet, 'Escape')
        ->assertNotPresent($sheet)
        ->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Grouping');

    $carolPage->assertSeeIn('[aria-current="step"]', 'Grouping')
        ->assertNotPresent($sheet)
        ->assertDontSee('Previous action items')
        ->assertScript('document.documentElement.outerHTML.includes("Buy a faster runner")', false)
        ->assertScript("localStorage.getItem('skrum.carriedSeen.{$retro->id}') === null", true);
});

it('[P09b-01c] leaves the previous action items closed when the board is first opened after Writing', function () {
    [$retro, , , $bob, $team] = p09bCarryOver(RetroPhase::Discussing);
    $sheet = '[role="dialog"]';

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertPresent('button:has-text("Previous action items (1)")')
        ->assertNotPresent($sheet)
        ->assertScript("localStorage.getItem('skrum.carriedSeen.{$retro->id}') === null", true)
        ->click('button:has-text("Previous action items (1)")')
        ->assertSeeIn($sheet, 'Buy a faster runner')
        ->assertSeeIn($sheet, 'Open the action items page')
        ->assertPresent("{$sheet} a[href*=\"/action-items?team={$team->id}\"]");
});
```

In `[P09b-01b]` the facilitator completes the carried item and then moves the retro to `Grouping`: the guest's page showing `Grouping` proves that the guest received what was broadcast after the completion, so the absence of the carried item is not a matter of timing.

- [ ] **Step 4: Run the carry-over tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php --filter='P09b-01'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 5: Add the workspace page tests (walkthrough step 2)**

Append these tests at the end of `tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php` (no new import):

```php
it('[P09b-02a] reaches the page from the sidebar and the team page, writes the filters to the URL and restores them', function () {
    [$team, $alice] = p09bTeam();
    $workspace = $team->workspace;
    $mobile = Team::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Mobile']);
    $mobile->members()->attach($alice);
    p09bFollowUp($team, $alice, 'Rotate the keys', ['assignee_user_id' => $alice->id]);
    p09bFollowUp($mobile, $alice, 'Book the room');
    p09bFollowUp($team, $alice, 'Archive the old board', ['completed_at' => now()]);
    $path = p09bPagePath($team);
    $sidebarEntries = 'Array.from(document.querySelectorAll(\'[data-sidebar="content"] a[data-sidebar="menu-button"]\')).map((link) => link.textContent.trim()).join(" / ")';
    $sidebarTeams = "a[data-sidebar=\"menu-button\"][href$=\"/w/{$workspace->slug}\"]";
    $sidebarActionItems = 'a[data-sidebar="menu-button"][href$="/action-items"]';

    $page = $this->signIn($alice, route('teams.show', [$workspace, $team], false));

    $page->assertScript($sidebarEntries, 'Teams / Action items / Templates')
        ->click('a:has-text("Open action items (1)")')
        ->assertPathIs($path)
        ->assertQueryStringHas('team', $team->id)
        ->assertSee('Rotate the keys')
        ->assertDontSee('Book the room');

    p09bChoose($page, p09bFilter('Team'), 'All teams');
    $page->assertQueryStringMissing('team')
        ->assertSee('Book the room');

    p09bChoose($page, p09bFilter('Status'), 'Completed');
    $page->assertQueryStringHas('status', 'completed')
        ->assertSeeIn(p09bFilter('Status'), 'Completed')
        ->assertSee('Archive the old board')
        ->assertDontSee('Rotate the keys');

    p09bChoose($page, p09bFilter('Status'), 'All');
    $page->assertQueryStringHas('status', 'all')
        ->assertSee('Rotate the keys');

    p09bChoose($page, p09bFilter('Assignee'), 'Me');
    $page->assertQueryStringHas('assignee', 'me')
        ->assertSeeIn(p09bFilter('Assignee'), 'Me')
        ->assertSee('Rotate the keys')
        ->assertDontSee('Book the room')
        ->assertDontSee('Archive the old board');

    p09bChoose($page, p09bFilter('Team'), 'Mobile');
    $page->assertQueryStringHas('team', $mobile->id)
        ->assertSee('Nothing matches these filters.');

    p09bChoose($page, p09bFilter('Assignee'), 'Anyone');
    $page->assertQueryStringMissing('assignee')
        ->assertSee('Book the room')
        ->assertScript("JSON.parse(localStorage.getItem('skrum.actionItemFilters.{$workspace->id}')).team", $mobile->id);

    $page->click($sidebarTeams)
        ->assertPathIs("/w/{$workspace->slug}")
        ->click($sidebarActionItems)
        ->assertPathIs($path)
        ->assertQueryStringHas('status', 'all')
        ->assertQueryStringHas('team', $mobile->id)
        ->assertSee('Book the room')
        ->assertDontSee('Rotate the keys');
});

it('[P09b-02b] pins a deep-linked item that the filters hide as the linked action item, expanded', function () {
    [$team, $alice] = p09bTeam();
    p09bFollowUp($team, $alice, 'Rotate the keys');
    $done = p09bFollowUp($team, $alice, 'Archive the old board', ['completed_at' => now()]);
    $path = p09bPagePath($team);
    $pinned = "section:has-text(\"Linked action item\") #action-item-{$done->id}";

    $page = $this->signIn($alice, "{$path}?item={$done->id}");

    $page->assertSee('Linked action item')
        ->assertPresent($pinned)
        ->assertPresent("{$pinned} [aria-label=\"Reopen\"]")
        ->assertPresent("{$pinned} button[aria-expanded=\"true\"]")
        ->assertSeeIn("#action-item-{$done->id}-comments", 'No comments yet.')
        ->assertSeeIn(p09bFilter('Status'), 'Open')
        ->assertSee('Rotate the keys')
        ->assertCount('li[id^="action-item-"]', 2);
});

it('[P09b-02c] reassigns a guest item to a team member from the page', function () {
    [$team, $alice, $bob] = p09bTeam();
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create([
        'team_id' => $team->id,
        'title' => 'Sprint 11',
        'completed_at' => now(),
    ]);
    p09bJoin($retro, $alice, facilitates: true);
    $carol = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Carol Guest']);
    $item = ActionItem::factory()->assignedToGuest($carol)->create(['content' => 'Automate the release notes']);
    $assignee = "#action-item-{$item->id} [aria-label=\"Assignee\"]";

    $page = $this->signIn($alice, p09bPagePath($team));

    $page->assertSeeIn($assignee, 'Carol Guest (guest)')
        ->assertScript(p09bCardShows($item, 'Sprint 11'), true)
        ->click($assignee)
        ->assertPresent('[role="option"][aria-disabled="true"]:has-text("Carol Guest (guest)")')
        ->assertCount('[role="option"]:has-text("(guest)")', 1)
        ->click('[role="option"]:has-text("Bob Stone")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn($assignee, 'Bob Stone');

    expect($item->fresh()->assignee_user_id)->toBe($bob->id)
        ->and($item->fresh()->assignee_participant_id)->toBeNull();
});
```

In `[P09b-02a]` every filter change is followed by an assertion on the URL before the next change, because the page builds the next query from the filters of the last server response. The assignee option "Me" is matched by substring, which is safe only while no member's name contains "me"; the names used here are "Alice Martin" and "Bob Stone".

- [ ] **Step 6: Run the workspace page tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php --filter='P09b-02'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 7: Add the tests for items outside a retro, sub-tasks and recurrence (walkthrough steps 3 to 5)**

In `tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php`, add this import after `use App\Models\ActionItem;`:

```php
use App\Models\ActionItemSubtask;
```

Append these tests at the end of the file:

```php
it('[P09b-03] shows an item created outside a retro to the other member live and carries it into the next retro', function () {
    [$team, $alice, $bob] = p09bTeam();
    $path = p09bPagePath($team);
    $dialog = '[role="dialog"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, $path));
    $bobPage = $this->awaitRealtime($this->signIn($bob, $path));

    $bobPage->assertSee('No open action items.');

    $alicePage->click('New action item')
        ->assertSeeIn("{$dialog} [aria-label=\"Team\"]", 'Platform')
        ->fill("{$dialog} [aria-label=\"Add an action item…\"]", 'Renew the TLS certificate')
        ->click("{$dialog} button[type=\"submit\"]")
        ->assertNotPresent($dialog)
        ->assertSee('Renew the TLS certificate');

    $bobPage->assertSee('Renew the TLS certificate');

    $item = ActionItem::query()->where('content', 'Renew the TLS certificate')->sole();

    $bobPage->assertScript(p09bCardShows($item, 'Added outside a retro'), true)
        ->assertScript(p09bCardShows($item, 'Alice Martin'), true)
        ->assertDontSee('No open action items.');

    expect($item->retro_id)->toBeNull()
        ->and($item->team_id)->toBe($team->id)
        ->and($item->created_by_user_id)->toBe($alice->id);

    $retro = Retro::factory()->create([
        'team_id' => $team->id,
        'title' => 'Sprint 13',
        'created_at' => now()->addMinute(),
    ]);
    p09bJoin($retro, $alice, facilitates: true);

    $alicePage->navigate("/retros/{$retro->id}");

    $this->awaitRealtime($alicePage)
        ->assertSeeIn($dialog, 'Previous action items')
        ->assertSeeIn($dialog, 'Added outside a retro')
        ->assertSeeIn($dialog, 'Renew the TLS certificate');
});

it('[P09b-04] adds, reorders and ticks sub-tasks live and limits the assignee to ticking', function () {
    [$team, $alice, $bob] = p09bTeam();
    $item = p09bFollowUp($team, $alice, 'Prepare the release', ['assignee_user_id' => $bob->id]);
    $path = p09bPagePath($team);
    $card = p09bCard($item);
    $add = "{$card} [aria-label=\"Add a sub-task\"]";
    $list = "{$card} ul[aria-label=\"Sub-tasks\"]";
    $subtask = fn (string $content): string => "{$list} [role=\"checkbox\"][aria-label=\"{$content}\"]";
    $order = "Array.from(document.querySelectorAll('#action-item-{$item->id} ul[aria-label=\"Sub-tasks\"] [role=\"checkbox\"]')).map((box) => box.getAttribute('aria-label')).join(' / ')";
    $reordered = 'Draft the notes / Publish the runbook / Tag the build';

    $alicePage = $this->awaitRealtime($this->signIn($alice, $path));
    $bobPage = $this->awaitRealtime($this->signIn($bob, $path));

    foreach (['Draft the notes', 'Tag the build', 'Publish the runbook'] as $content) {
        $alicePage->fill($add, $content)
            ->keys($add, 'Enter')
            ->assertPresent($subtask($content))
            ->assertValue($add, '');
    }

    $alicePage->click("{$list} > li:has([aria-label=\"Publish the runbook\"]) [aria-label=\"Move up\"]")
        ->assertScript($order, $reordered)
        ->click($subtask('Draft the notes'))
        ->assertAttribute($subtask('Draft the notes'), 'aria-checked', 'true')
        ->assertSeeIn("{$card} [aria-label=\"1 of 3 sub-tasks done\"]", '1/3');

    $bobPage->assertScript($order, $reordered)
        ->assertSeeIn("{$card} [aria-label=\"1 of 3 sub-tasks done\"]", '1/3')
        ->assertAttribute($subtask('Draft the notes'), 'aria-checked', 'true')
        ->assertNotPresent($add)
        ->assertNotPresent("{$card} [aria-label=\"Move up\"]")
        ->assertNotPresent("{$card} [aria-label=\"Edit sub-task\"]")
        ->assertNotPresent("{$card} [aria-label=\"Delete sub-task\"]")
        ->assertNotPresent("{$card} button[aria-label=\"Edit action item\"]")
        ->click($subtask('Tag the build'))
        ->assertAttribute($subtask('Tag the build'), 'aria-checked', 'true');

    $alicePage->assertSeeIn("{$card} [aria-label=\"2 of 3 sub-tasks done\"]", '2/3')
        ->assertAttribute($subtask('Tag the build'), 'aria-checked', 'true');

    expect($item->subtasks()->pluck('content')->all())->toBe(['Draft the notes', 'Publish the runbook', 'Tag the build'])
        ->and($item->subtasks()->whereNotNull('completed_at')->count())->toBe(2)
        ->and($item->fresh()->completed_at)->toBeNull();
});

it('[P09b-05] creates exactly one next occurrence when a weekly item is completed', function () {
    [$team, $alice] = p09bTeam();
    $first = p09bFollowUp($team, $alice, 'Review the dashboards');
    ActionItemSubtask::factory()->completed()->create(['action_item_id' => $first->id, 'content' => 'Check the alerts', 'position' => 0]);
    ActionItemSubtask::factory()->create(['action_item_id' => $first->id, 'content' => 'Check the latency', 'position' => 1]);
    $dueOn = ActionItem::today()->addDay();
    $dueLabel = p09bDueLabel($dueOn);
    $nextDueLabel = p09bDueLabel($dueOn->addWeek());
    $firstCard = p09bCard($first);
    $dueDate = "{$firstCard} [aria-label=\"Due date\"]";

    $page = $this->signIn($alice, p09bPagePath($team));

    $page->assertDisabled("{$firstCard} [aria-label=\"Repeat\"]")
        ->fill($dueDate, $dueOn->toDateString())
        ->keys($dueDate, 'Tab')
        ->assertScript(p09bCardShows($first, "Due {$dueLabel}"), true);

    p09bChoose($page, "{$firstCard} [aria-label=\"Repeat\"]", 'Weekly');

    $page->assertScript(p09bCardShows($first, 'Repeats weekly'), true)
        ->click("{$firstCard} [aria-label=\"Mark as done\"]")
        ->assertSee('Follows up the item completed on');

    $next = ActionItem::query()->where('previous_occurrence_id', $first->id)->sole();
    $nextCard = p09bCard($next);

    $page->assertScript(p09bCardShows($next, 'Added outside a retro'), true)
        ->assertScript(p09bCardShows($next, 'Repeats weekly'), true)
        ->assertScript(p09bCardShows($next, "Due {$nextDueLabel}"), true)
        ->assertSeeIn("{$nextCard} [aria-label=\"0 of 2 sub-tasks done\"]", '0/2')
        ->assertAttribute("{$nextCard} [role=\"checkbox\"][aria-label=\"Check the alerts\"]", 'aria-checked', 'false')
        ->assertPresent("{$nextCard} [aria-label=\"Mark as done\"]")
        ->assertNotPresent($firstCard);

    expect($next->due_on?->toDateString())->toBe($dueOn->addWeek()->toDateString())
        ->and($next->retro_id)->toBeNull()
        ->and($next->completed_at)->toBeNull()
        ->and($first->fresh()->completed_at)->not->toBeNull();

    p09bChoose($page, p09bFilter('Status'), 'All');

    $page->assertQueryStringHas('status', 'all')
        ->click("{$firstCard} [aria-label=\"Reopen\"]")
        ->assertPresent("{$firstCard} [aria-label=\"Mark as done\"]")
        ->click("{$firstCard} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$firstCard} [aria-label=\"Reopen\"]");

    expect(ActionItem::query()->where('previous_occurrence_id', $first->id)->count())->toBe(1)
        ->and(ActionItem::query()->count())->toBe(2);

    p09bChoose($page, "{$nextCard} [aria-label=\"Repeat\"]", 'Does not repeat');

    $page->assertScript(p09bCardShows($next, 'Repeats weekly'), false)
        ->click("{$nextCard} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$nextCard} [aria-label=\"Reopen\"]");

    expect($next->fresh()->recurrence)->toBeNull()
        ->and($next->fresh()->completed_at)->not->toBeNull()
        ->and(ActionItem::query()->count())->toBe(2);
});
```

`[P09b-03]` dates the next retro one minute ahead because a retro only carries the retro-less items created before it. `[P09b-05]` saves the due date by leaving the field with the Tab key, since the card saves on blur. If this fails, see the harness findings.

- [ ] **Step 8: Run the tests of walkthrough steps 3 to 5**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php --filter='P09b-03|P09b-04|P09b-05'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If `awaitRealtime()` times out on the workspace page, the attribute of Step 1 is missing from `public/build`: run `npm run build` again.

- [ ] **Step 9: Format and check**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector`, then Pint again.

- [ ] **Step 10: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php`
Expected: PASS (9 tests).

- [ ] **Step 11: Commit**

```bash
git add resources/js/pages/action-items/index.tsx tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php
git commit -m "test(browser): cover the action items carry-over, workspace page, sub-tasks and recurrence walkthrough"
```

### Task 7: Plan 9b walkthrough, part 2: reminders, the notification bell and the notification settings

This task automates steps 6 to 8 of the plan 9b walkthrough (lines 5234 to 5236 of the plan 9b file) in the file of Task 6. The walkthrough read the digest e-mail in the mail log; the tests substitute fakes for it (spec §3.6). No product file changes in this task.

Facts the tests rely on (all read from the current code):

- `action-items:send-reminders` (`app/Console/Commands/SendActionItemRemindersCommand.php`) prints "Reminding user `{id}` about N items…" per user and "Sent N reminders to M users.". `App\Actions\ActionItems\SendActionItemReminders` selects the open items due between seven days ago and tomorrow whose member assignee is still in the team, logs one `action_item_reminders` row per item, assignee, kind (`due_soon` or `overdue`) and due date, and skips an item whose row exists. It then sends one `ActionItemReminderDigestNotification` (`mail`, queued) when the user's `action_item_reminders_by_email` is on, and one `ActionItemReminderNotification` (`database`) per item when `action_item_reminders_in_app` is on.
- `phpunit.xml` sets the `sync` queue and the `array` mailer, so the queued digest is sent inside the command and nothing leaves the process.
- `Notification::fake()` replaces both channels, so a test that fakes notifications has no bell entry to show. The task therefore splits step 6: `[P09b-06a]` fakes notifications and asserts the recipient, the locale, the content order and the once-only rule without a browser; `[P09b-06b]` and `[P09b-08]` run the command for real, with `Mail::fake()` as a guard on the mail transport, and drive the bell in the browser. `[P09b-07]` runs the command for real and fakes only the `Illuminate\Notifications\Events\NotificationSent` event, which the framework dispatches once per channel that sent, to prove that the `database` channel sent and the `mail` channel did not.
- The bell (`resources/js/components/notification-bell.tsx`) has no timer and no realtime channel: its count comes from the shared Inertia prop `notifications.unreadCount`, refreshed on every navigation, on window focus (lines 47 to 72) and by the workspace page's list reload. After the command has run in the test process, a test refreshes an open page with `$page->navigate($path)` to the same URL; no sleep is needed.
- The bell's trigger is a button whose `aria-label` is "Notifications", "1 unread notification" or "N unread notifications". Its menu (`[role="menu"]`) lists `[role="menuitem"]` rows "Overdue: {content}", "Due today: {content}" or "Due tomorrow: {content}"; an unread row's text has the class `font-semibold`. Selecting a row marks it read and visits `/w/{workspace}/action-items?item={id}`.
- The sidebar badge is `[data-sidebar="menu-badge"]` with `aria-label="N overdue"` (`nav-main.tsx`); it counts the viewer's open overdue items and does not depend on reminders.
- `/settings/notifications` (`resources/js/pages/settings/notifications.tsx`) has the checkboxes `#action-item-reminders-by-email` and `#action-item-reminders-in-app`, the sentence "Reminders are sent at 08:00 for action items assigned to you." and a "Save" button; saving shows the toast "Notification settings saved.".
- Completing an item marks its unread reminder notifications read (`MarkActionItemRemindersRead`), and the workspace page reloads the `notifications` prop about one second after a change.
- No test travels in time while a user is signed in. `[P09b-06a]`, which has no browser, travels two days to show that an item reminded as "due soon" is reminded once more as "overdue".

**Files:**
- Modify: `tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php`
- Test: `tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php`

**Interfaces:**
- Consumes:
  - From Task 6: the helpers `p09bTeam()`, `p09bFollowUp()`, `p09bPagePath()`, `p09bCardShows()`, `p09bDueLabel()`.
  - `Tests\BrowserTestCase` (plan 16a) with `$this->signIn()`.
  - `App\Models\ActionItemReminder` (fillable `action_item_id`, `user_id`, `kind`, `due_on`, `sent_at`), `App\Enums\ActionItemReminderKind`, `App\Notifications\ActionItemReminderDigestNotification` (public `array $reminders`), `App\Notifications\ActionItemReminderNotification`.
  - Configuration keys `skrum.action_item_reminders.enabled` and `skrum.action_item_reminders.time`.
- Produces:
  - Four tests, `[P09b-06a]`, `[P09b-06b]`, `[P09b-07]`, `[P09b-08]`. No helper and no hook.
  - The idiom for a count that only refreshes on navigation: run the command, then `$page->navigate($samePath)`.

- [ ] **Step 1: Add the reminder command test (walkthrough step 6, the command and the e-mail)**

In `tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php`, replace the import block at the top of the file with:

```php
use App\Enums\ActionItemReminderKind;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\ActionItemReminder;
use App\Models\ActionItemSubtask;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Notifications\ActionItemReminderDigestNotification;
use App\Notifications\ActionItemReminderNotification;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
```

Append this test at the end of the file:

```php
it('[P09b-06a] sends one digest in the assignee language and one bell entry per item, once per item, kind and due date', function () {
    Notification::fake();
    config(['skrum.action_item_reminders.enabled' => true]);
    [$team, $alice, $bob] = p09bTeam();
    $bob->update(['locale' => 'fr']);
    $today = ActionItem::today();
    $dueToday = p09bFollowUp($team, $alice, 'Book the room', [
        'assignee_user_id' => $bob->id,
        'due_on' => $today->toDateString(),
    ]);
    $overdue = p09bFollowUp($team, $alice, 'Rotate the keys', [
        'assignee_user_id' => $bob->id,
        'due_on' => $today->subDays(3)->toDateString(),
    ]);

    $this->artisan('action-items:send-reminders')
        ->expectsOutput("Reminding user `{$bob->id}` about 2 items…")
        ->expectsOutput('Sent 2 reminders to 1 users.')
        ->assertSuccessful();

    Notification::assertSentTo(
        $bob,
        ActionItemReminderDigestNotification::class,
        function (ActionItemReminderDigestNotification $notification, array $channels, object $notifiable, ?string $locale) use ($overdue, $dueToday): bool {
            $html = (string) $notification->toMail($notifiable)->render();

            return $channels === ['mail']
                && $locale === 'fr'
                && $notification->reminders === [
                    ['actionItemId' => $overdue->id, 'kind' => ActionItemReminderKind::Overdue->value],
                    ['actionItemId' => $dueToday->id, 'kind' => ActionItemReminderKind::DueSoon->value],
                ]
                && strpos($html, 'Rotate the keys') < strpos($html, 'Book the room');
        },
    );
    Notification::assertSentToTimes($bob, ActionItemReminderDigestNotification::class, 1);
    Notification::assertSentToTimes($bob, ActionItemReminderNotification::class, 2);
    Notification::assertNothingSentTo($alice);

    $this->artisan('action-items:send-reminders')
        ->expectsOutput('Sent 0 reminders to 0 users.')
        ->assertSuccessful();

    Notification::assertSentToTimes($bob, ActionItemReminderDigestNotification::class, 1);
    Notification::assertSentToTimes($bob, ActionItemReminderNotification::class, 2);

    $this->travel(2)->days();

    $this->artisan('action-items:send-reminders')
        ->expectsOutput("Reminding user `{$bob->id}` about 1 items…")
        ->expectsOutput('Sent 1 reminders to 1 users.')
        ->assertSuccessful();

    Notification::assertSentToTimes($bob, ActionItemReminderDigestNotification::class, 2);
    Notification::assertSentToTimes($bob, ActionItemReminderNotification::class, 3);

    expect(ActionItemReminder::query()->where('action_item_id', $dueToday->id)->count())->toBe(2)
        ->and(ActionItemReminder::query()->where('action_item_id', $overdue->id)->count())->toBe(1);
});
```

This test opens no browser page: it lives in the walkthrough file because it is the automated form of "the output lists you and the summary; the log shows one digest e-mail in your language with Overdue before Due soon; run the command again: nothing is sent". After the two-day travel the item that was due today is two days overdue, a new kind for the same due date, so it is reminded once more; the item that was already overdue is not.

- [ ] **Step 2: Run the reminder command test**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php --filter='P09b-06a'`
Expected: PASS (1 test); a failure means a wrong assertion or a product defect: follow the plan header's Defect rule.

- [ ] **Step 3: Add the bell, settings and completion tests (walkthrough steps 6 to 8)**

In `tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php`, add these imports, keeping the block sorted: after `use Carbon\CarbonImmutable;`

```php
use Illuminate\Notifications\Events\NotificationSent;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
```

Append these tests at the end of the file:

```php
it('[P09b-06b] shows the reminders in the bell and the overdue count in the sidebar, and opens the item from a bell entry', function () {
    Mail::fake();
    config(['skrum.action_item_reminders.enabled' => true]);
    [$team, $alice, $bob] = p09bTeam();
    $today = ActionItem::today();
    p09bFollowUp($team, $alice, 'Book the room', [
        'assignee_user_id' => $bob->id,
        'due_on' => $today->toDateString(),
    ]);
    $overdue = p09bFollowUp($team, $alice, 'Rotate the keys', [
        'assignee_user_id' => $bob->id,
        'due_on' => $today->subDays(3)->toDateString(),
    ]);
    $path = p09bPagePath($team);
    $badge = '[data-sidebar="menu-badge"]';

    $page = $this->signIn($bob, $path);

    $page->assertSee('Rotate the keys')
        ->assertPresent('[aria-label="Notifications"]')
        ->assertSeeIn($badge, '1')
        ->assertAttribute($badge, 'aria-label', '1 overdue');

    $this->artisan('action-items:send-reminders')
        ->expectsOutput('Sent 2 reminders to 1 users.')
        ->assertSuccessful();

    $page->navigate($path)
        ->assertSeeIn('[aria-label="2 unread notifications"]', '2')
        ->assertSeeIn($badge, '1')
        ->click('[aria-label="2 unread notifications"]')
        ->assertSeeIn('[role="menu"]', 'Overdue: Rotate the keys')
        ->assertSeeIn('[role="menu"]', 'Due today: Book the room')
        ->click('[role="menuitem"]:has-text("Overdue: Rotate the keys")')
        ->assertQueryStringHas('item', $overdue->id)
        ->assertPathIs($path)
        ->assertPresent("#action-item-{$overdue->id} button[aria-expanded=\"true\"]")
        ->assertPresent('[aria-label="1 unread notification"]');

    expect($bob->notifications()->count())->toBe(2)
        ->and($bob->unreadNotifications()->count())->toBe(1);

    $this->artisan('action-items:send-reminders')
        ->expectsOutput('Sent 0 reminders to 0 users.')
        ->assertSuccessful();

    $page->navigate($path)
        ->assertSee('Rotate the keys')
        ->assertPresent('[aria-label="1 unread notification"]');

    expect($bob->notifications()->count())->toBe(2);
});

it('[P09b-07] stops the e-mail digest after opting out in the notification settings and keeps the bell entry', function () {
    config([
        'skrum.action_item_reminders.enabled' => true,
        'skrum.action_item_reminders.time' => '08:00',
    ]);
    [$team, , $bob] = p09bTeam();
    $today = ActionItem::today();
    $tomorrow = $today->addDay();
    $tomorrowLabel = p09bDueLabel($tomorrow);
    $item = p09bFollowUp($team, $bob, 'Book the room', [
        'assignee_user_id' => $bob->id,
        'due_on' => $today->toDateString(),
    ]);
    ActionItemReminder::query()->create([
        'action_item_id' => $item->id,
        'user_id' => $bob->id,
        'kind' => ActionItemReminderKind::DueSoon,
        'due_on' => $today->toDateString(),
        'sent_at' => now(),
    ]);
    $path = p09bPagePath($team);
    $byEmail = '#action-item-reminders-by-email';
    $dueDate = "#action-item-{$item->id} [aria-label=\"Due date\"]";

    $page = $this->signIn($bob, '/settings/notifications');

    $page->assertSee('Reminders are sent at 08:00 for action items assigned to you.')
        ->assertAttribute($byEmail, 'aria-checked', 'true')
        ->assertAttribute('#action-item-reminders-in-app', 'aria-checked', 'true')
        ->click($byEmail)
        ->assertAttribute($byEmail, 'aria-checked', 'false')
        ->press('Save')
        ->assertSee('Notification settings saved.');

    expect($bob->fresh()->action_item_reminders_by_email)->toBeFalse()
        ->and($bob->fresh()->action_item_reminders_in_app)->toBeTrue();

    $page->navigate($path)
        ->assertPresent('[aria-label="Notifications"]')
        ->fill($dueDate, $tomorrow->toDateString())
        ->keys($dueDate, 'Tab')
        ->assertScript(p09bCardShows($item, "Due {$tomorrowLabel}"), true);

    expect($item->fresh()->due_on?->toDateString())->toBe($tomorrow->toDateString());

    Event::fake([NotificationSent::class]);

    $this->artisan('action-items:send-reminders')
        ->expectsOutput('Sent 1 reminders to 1 users.')
        ->assertSuccessful();

    Event::assertDispatched(
        NotificationSent::class,
        fn (NotificationSent $event): bool => $event->channel === 'database' && $event->notifiable->is($bob),
    );
    Event::assertNotDispatched(
        NotificationSent::class,
        fn (NotificationSent $event): bool => $event->channel === 'mail',
    );

    $page->navigate($path)
        ->click('[aria-label="1 unread notification"]')
        ->assertSeeIn('[role="menu"]', 'Due tomorrow: Book the room');

    expect($bob->notifications()->count())->toBe(1);
});

it('[P09b-08] marks the bell entry of a reminded item as read when the item is completed', function () {
    Mail::fake();
    config(['skrum.action_item_reminders.enabled' => true]);
    [$team, , $bob] = p09bTeam();
    $item = p09bFollowUp($team, $bob, 'Book the room', [
        'assignee_user_id' => $bob->id,
        'due_on' => ActionItem::today()->toDateString(),
    ]);

    $this->artisan('action-items:send-reminders')
        ->expectsOutput('Sent 1 reminders to 1 users.')
        ->assertSuccessful();

    $page = $this->signIn($bob, p09bPagePath($team));

    $page->assertPresent('[aria-label="1 unread notification"]')
        ->click("#action-item-{$item->id} [aria-label=\"Mark as done\"]")
        ->assertPresent('[aria-label="Notifications"]')
        ->assertNotPresent('[aria-label="1 unread notification"]')
        ->click('[aria-label="Notifications"]')
        ->assertSeeIn('[role="menu"]', 'Due today: Book the room')
        ->assertNotPresent('[role="menuitem"] span.font-semibold');

    expect($bob->unreadNotifications()->count())->toBe(0)
        ->and($bob->notifications()->count())->toBe(1)
        ->and($item->fresh()->completed_at)->not->toBeNull();
});
```

`[P09b-07]` arranges the reminder that the walkthrough's step 6 had already sent as an `action_item_reminders` row for today's due date, so that moving the due date to tomorrow through the card is what makes the item eligible again. It calls `Event::fake([NotificationSent::class])` only after the browser steps and with a named event, which the browser rules allow. If this fails, see the harness findings.

- [ ] **Step 4: Run the bell, settings and completion tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php --filter='P09b-06b|P09b-07|P09b-08'`
Expected: PASS (3 tests); a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 5: Format and check**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls and the closure of `[P09b-06a]`; keep its result.

Run: `composer rector:check`
Expected: no change proposed. If Rector wants to rewrite code this task wrote, run `composer rector`, then Pint again.

- [ ] **Step 6: Run the whole file twice**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php`
Expected: PASS (13 tests). Run it a second time; expected: PASS again.

- [ ] **Step 7: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php
git commit -m "test(browser): cover the action item reminders, notification bell and notification settings walkthrough"
```

### Task 8: Coverage table and residual checklist

**Files:**
- Modify: `docs/superpowers/walkthroughs/coverage.md` (summary rows, one section per walkthrough of this plan, notes)
- Modify: `docs/superpowers/walkthroughs/residual-manual-checklist.md` (one section per walkthrough of this plan that has residual steps)

**Interfaces:**
- Consumes: the test identifiers of the walkthrough tasks of this plan, as implemented.
- Produces: the rows acceptance criterion 5 of the spec asks for, for this plan's walkthroughs.

The rows below were written with the plan, before any test ran. Before writing them, read the walkthrough test files as implemented and the task reports: where a test was renamed, split, dropped, or changed status, change its row to match the code. A row is `auto` or `auto-substituted` only if its test exists and passes.

- [ ] **Step 1: Add the summary rows**

In `docs/superpowers/walkthroughs/coverage.md`, in the Summary table, add these rows before the `**Total**` row, and recompute the total row from all rows of the table (this plan adds 58 rows: 39 `auto`, 14 `auto-substituted`, 5 `residual`, as planned):

```markdown
| Plan 6: polish pass | 15 | 7 | 6 | 2 |
| Plan 7: board engagement | 21 | 12 | 6 | 3 |
| Plan 9a: action items core | 9 | 9 | 0 | 0 |
| Plan 9b: action items scope additions | 13 | 11 | 2 | 0 |
```

- [ ] **Step 2: Add one section per walkthrough**

In the same file, insert these sections before the `## Notes` section:

````markdown
## Plan 6: polish pass

Walkthrough: `docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md, final verification task`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P06-01 | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:717 | (none) | residual |
| P06-02 | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:718 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto-substituted |
| P06-03 | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:718 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto |
| P06-04a | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:718 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto |
| P06-04b | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:718 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto |
| P06-05 | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:718 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto |
| P06-06 | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:718 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto |
| P06-07a | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:718 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto |
| P06-07b | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:718 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto-substituted |
| P06-08a | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:719 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto-substituted |
| P06-08b | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:719 | (none) | residual |
| P06-09 (test P04-03) | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:719 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P06-10a | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:720 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto-substituted |
| P06-10b | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:720 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto-substituted |
| P06-11 | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:720 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto-substituted |

## Plan 7: board engagement

Walkthrough: `docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P07-01a | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4867 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto |
| P07-01b | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4867 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto-substituted |
| P07-01t | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4867 | (none) | residual |
| P07-02a | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4868 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto |
| P07-02b | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4868 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto-substituted |
| P07-03a | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4869 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto |
| P07-03b | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4869 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto-substituted |
| P07-04a | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4870 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto |
| P07-04b | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4870 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto |
| P07-05a | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4871 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto-substituted |
| P07-05b | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4871 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto-substituted |
| P07-05r | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4871 | (none) | residual |
| P07-06a | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4872 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto |
| P07-06b | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4872 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto |
| P07-07a | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4873 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto |
| P07-07b | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4873 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto-substituted |
| P07-08a | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4874 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto |
| P07-08b | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4874 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto |
| P07-09 | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4875 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto |
| P07-10 | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4876 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto |
| P07-11 | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4877 | (none) | residual |

## Plan 9a: action items core

Walkthrough: `docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P09a-01a | docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md:7684 | tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php | auto |
| P09a-01b | docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md:7684 | tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php | auto |
| P09a-01c | docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md:7684 | tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php | auto |
| P09a-02 | docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md:7685 | tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php | auto |
| P09a-03a | docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md:7686 | tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php | auto |
| P09a-03b | docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md:7686 | tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php | auto |
| P09a-03c | docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md:7686 | tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php | auto |
| P09a-04 | docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md:7687 | tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php | auto |
| P09a-05 | docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md:7688 | tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php | auto |

## Plan 9b: action items scope additions

Walkthrough: `docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md, final walkthrough`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P09b-01a | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5229 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto |
| P09b-01b | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5229 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto |
| P09b-01c | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5229 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto |
| P09b-02a | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5230 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto |
| P09b-02b | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5230 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto |
| P09b-02c | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5230 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto |
| P09b-03 | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5231 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto |
| P09b-04 | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5232 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto |
| P09b-05 | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5233 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto |
| P09b-06a | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5234 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto-substituted |
| P09b-06b | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5234 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto |
| P09b-07 | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5235 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto-substituted |
| P09b-08 | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5236 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto |

````

- [ ] **Step 3: Add the notes**

In the same file, append these bullets to the `## Notes` section (drop a bullet whose difference turned out not to exist; add one for each difference found while implementing):

````markdown
- P06-02: the walkthrough votes "during a refetch triggered by a phase/settings change". The test holds the snapshot's response inside the member's page (a wrapper around `XMLHttpRequest` installed by the test) while the member votes, then lets it through; the facilitator's change is "Hide vote counts". The snapshot was built before the vote, as in the race PA1 describes.
- P06-03: "two tabs of the same member" are two browser contexts signed in as the same user (two sessions, one participant). The test also edits the card in the first tab and expects the new content in the second.
- P06-04a, P06-04b: a double click is two `click()` calls in one page script; the test counts the requests sent. The walkthrough names only the vote; the card deletion comes from acceptance criterion PB2.
- P06-05: the card is edited during Grouping, the last phase in which a card is editable, and the facilitator's "Next" moves to Voting.
- P06-07a, P06-07b: the walkthrough lists "PB5, PB6" without steps; the tests follow the acceptance criteria. For PB6 the response of the creating request is held in the page while the select is checked.
- P06-08a: keyboard pick-up instead of a pointer drag; structural facts only. The visual check is the residual row P06-08b.
- P06-09: keyboard-only grouping and moving in Grouping is covered by the plan 4 test `[P04-03]`, which uses `dragWithKeyboard(..., handleRemains: false)` since plan 16b Task 1. No test is added in the plan 6 file.
- P06-10a: "sign out in another tab" is a `POST /logout` sent from the board page with `fetch()`, which ends the same session and leaves the board on screen. The board is inert once the banner shows, so the second refused request is the refetch caused by the facilitator's phase change, not a second action of the member.
- P06-10b: not in the walkthrough. A guest-enabled retro answers the reload with the session-ended page instead of the login page (polish pass spec, PA5b); the walkthrough's "Reload leads to login" holds only for a retro without guest access (P06-10a).
- P06-11: "`docker pause` of the Sail app for about 20 s" is a `RouteMatched` listener that sleeps 15.5 seconds on the first vote request, longer than the client's 15-second timeout. The member's locale is French, which proves the translation.
- Step 1 (full checks) and Step 6 (report) of the plan 6 verification task are not walkthrough steps and have no row. PE1 and PE2 (image name, native build stages) are verified by plan 6 Task 5 Step 4, not by its walkthrough, and have no row either.
- **Step 1, "follow scrolling" (P07-01a).** The test checks that the cursor sits over the same card on the watching page, before and after that page scrolls its board sideways. Both pages have the same viewport (800 × 700) and the same board content, because positions are normalised to the board's scroll size and two boards of different scroll width do not agree on a position (see "Notes for the lead").
- **Step 1, "disappear on blur" (P07-01b).** A headless page cannot be unfocused, so the test dispatches the `blur` event the cursor library listens for and asserts that the cursor left in under 1.5 seconds, which separates it from the 3-second expiry of an idle cursor.
- **Step 1, "Hide my cursor" (P07-01b).** The control is a toggle button in the header (`aria-label` "Hide my cursor" / "Show my cursor", `aria-pressed`), not a switch as the feature spec's §7 words it. The test also asserts what the spec adds: the preference is kept in `localStorage` across a reload and the viewer still sees other cursors.
- **Step 2, "gather into a bubble" (P07-02a).** A bubble forms only when two different people send the same emoji within 700 ms and lasts under a second; the test records it with a `MutationObserver` and asserts a `gathering` reaction with a count of at least 2 on both pages.
- **Step 3, "chip tooltip shows names; anonymous retro shows none" (P07-03a, P07-06a).** On an anonymous retro the tooltip is not rendered at all, which is what the tests assert.
- **Step 3, "any emoji" (P07-03a, P07-03b).** P07-03a toggles an emoji outside the quick set that another participant already used (🦄); P07-03b picks one in the full picker with the emoji list faked upstream.
- **Step 4, notifications (P07-04b).** "Only on private channels" is asserted as absence: the facilitator, who is neither the card's author nor in the thread, receives the comment itself (the count changes) but no toast and no unread dot.
- **Step 5, "network panel shows no request to giphy.com, tenor.com or jsdelivr.net" (P07-05a, P07-05b, P07-07b).** Replaced by the page's Resource Timing entries and by the origin of every `img` and `source` element, read with `assertScript()`; the server side is asserted with `Http::assertSent()` (what skrum asked the provider and the CDN) and `Storage::assertExists()` (the proxy's local copy).
- **Step 6 (P07-06a, P07-06b).** Covered by two tests; P07-06b overlaps `[P10b-15c]`, which checks the same two facts after the poker refactoring of the shared layers.
- **Step 7, "each of the six toggles".** The settings dialog shows six engagement switches only when a GIF provider is configured, five otherwise (feature spec §5 and §7). P07-07a asserts the five and toggles reactions and cursors; P07-07b asserts the six and toggles GIFs; the three other switches are exercised live in P07-10 (hide vote counts), P07-08a (close for editing) and P07-09 (presentation mode).
- **Step 8, lock (P07-08a, P07-08b).** The interface does not let a locked board send an edit: it removes or disables the controls, which is what P07-08a asserts for cards, drag, reactions, comments, votes and action items. The server's 423 and its toast are reached in P07-08b from a page that has not yet received the lock, arranged by setting `is_locked` in the database. The 423 of every endpoint stays covered by `tests/Feature/Retros/BoardLockTest.php`.
- **Step 9, presentation overlay (P07-09).** When the facilitator closes the overlay the highlight is cleared for everyone (plan 7, line 4840), so "follows the highlight" is asserted as: opens for both, a participant's Escape hides it for that participant only, a new highlight reopens it, and the facilitator's close removes it for both.
- **P09a-01a** — the walkthrough writes the chip as "Due 3 Oct". In English the product formats the date with `Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' })`, which gives "Due Oct 3", and an overdue item's badge reads "Overdue · Oct 1". The test computes both labels from `ActionItem::today()` and asserts the red badge by its `bg-destructive` class.
- **P09a-01c** — "the guest ticks their own item" is read as the item assigned to the guest (spec §4: the assignee completes). The test also checks a plain member: Bob can tick the item assigned to him, cannot tick the guest's, and sees no edit or delete button.
- **P09a-03a / P09a-03b** — the walkthrough says "Lock the board: edits return the toast". Today's board disables every action item control as soon as it learns the board is closed, so no edit can be sent from a page that shows the lock. P09a-03a asserts the disabled controls and the "Board closed for editing" badge on both pages after the facilitator ticks "Close for editing"; P09a-03b locks the retro in the database after the page has loaded, so the click reaches the server and the page shows the toast "The board is closed for editing." and resyncs.
- **P09a-03c** — "complete the retro" is arranged in the database (the phase flow is covered by P04-07). The guest joins through the interface while the retro is in `Discussing`, then reloads the completed retro. The priority has no text in the Results view, so it is asserted by the icon's colour class.
- **P09a-05** — run with one and with two open items to cover the singular and plural sentences; a completed item is present and not counted.
- **P09b-01a** — "complete a retro that has open items, then start a new retro" is arranged with factories: an earlier `Completed` retro dated one week back with one open item, and a new retro in `Writing`. The second member cannot tick the carried item (not a manager, not the assignee, not the review facilitator); the test asserts that the toggle is disabled for him and that his sheet updates when the facilitator completes it.
- **P09b-01c** — not in the walkthrough's wording; added from spec §8 ("only when the board is first loaded while the phase is `Writing`"): on a board first opened in `Discussing` the sheet stays closed and the button opens it.
- **P09b-02a** — "(sidebar "Action items", below "Teams")" is asserted as the order of the sidebar entries, "Teams / Action items / Templates", for a member.
- **P09b-02c** — the guest and the retro are arranged with factories (a guest participant row, no browser session), because the step is about the member's page.
- **P09b-03** — "it appears within about a second" is asserted as "it appears without a reload" within the browser timeout; no duration is measured. The team's next retro is created by a factory, dated one minute ahead.
- **P09b-04** — the sub-tasks are reordered with the "Move up" button; the product has no drag handle for sub-tasks.
- **P09b-05** — the "repeat icon" is asserted through its label "Repeats weekly" (the icon is `aria-hidden`). "Follows up the item completed on …" is asserted without its date, which the browser formats in its own time zone.
- **P09b-06a** — substitution (spec §3.6, e-mail): `Notification::fake()` instead of `MAIL_MAILER=log`. The test asserts the recipient, the `mail` channel, the locale `fr`, and that the rendered digest lists the overdue item before the item due today. It has no browser page. It also travels two days to show the rule "one reminder per item, kind and due date".
- **P09b-06b** — the bell has no realtime update (spec §1, out of scope), so after the command the test reloads the page with `navigate()` to the same URL. "The sidebar badge shows 1" is the count of the viewer's overdue items and is already 1 before the command runs.
- **P09b-07** — substitution (spec §3.6, e-mail): the absence of the e-mail is asserted as "no `NotificationSent` event for the `mail` channel" while the `database` channel sent; the bell entry is then read in the browser. The reminder that step 6 had sent is arranged as an `action_item_reminders` row.
````

If a defect was found and fixed under the Defect rule, add its line under `## Defects found`.

- [ ] **Step 4: Add the residual entries**

In `docs/superpowers/walkthroughs/residual-manual-checklist.md`, append a section per walkthrough of this plan (heading `## <walkthrough title>` as in the coverage table) and distribute these entries under them by identifier:

````markdown
- **P06-01** — "amd64 (PE3) — `docker buildx build --platform linux/amd64 -t skrum:amd64 --load .`; smoke test it on a throwaway network with `postgres:18-alpine`: migrations run, `/up` 200 inside, websocket upgrade 101 via `/app`, services as `www-data`, healthy". Not automated: Docker image and packaging checks are out of scope (browser test spec §1); the browser suite runs the application inside the test process, never the image. Check by hand: build the image with the command above; create a throwaway Docker network; start `postgres:18-alpine` and the image on it, both with `--platform linux/amd64`, with the variables the README lists; confirm in the container's log that the migrations ran; `docker exec` a `curl -s -o /dev/null -w '%{http_code}' localhost/up` and expect `200`; request `/app/<key>` with the websocket upgrade headers and expect `101`; `docker exec … ps -o user,comm` shows the services running as `www-data`; `docker inspect --format '{{.State.Health.Status}}'` prints `healthy`. Remove the containers, the network and `skrum:amd64` afterwards; keep `skrum:latest`.
- **P06-08b** — "drag a card to the last column and near the right edge: preview visible". Not automated: the plugin's `drag()` does one press, one move and one release, which does not reliably start a drag with the board's 6-pixel pointer activation distance (browser test spec §3.5), and whether the preview is fully visible next to the window's edge is a judgement of visual quality (spec §1). `P06-08a` asserts the two structural facts of PB1 with a keyboard pick-up: the preview is rendered outside the scrolling board in a fixed-position layer, and it is as wide as the card. Check by hand: open a retro in Writing with four or more columns in a window narrow enough for the board to scroll sideways; with the mouse, drag one of your cards to the last column and hold it against the right edge of the window; the preview under the pointer must stay entirely visible, never cut off at the board's edge, and be as wide as the card it came from.
- **P07-01t** — "Mouse and touch cursors appear, follow scrolling, disappear on blur, on lift and with 'Hide my cursor'" (the touch part: a touch cursor appears while the finger is down and disappears on lift). Not automated: the suite drives a mouse; touch and pen devices are out of scope (browser test spec §1). `[P07-01a]` and `[P07-01b]` cover the mouse. Check by hand: open a retro in Grouping in a desktop browser and on a phone (or with the browser's device emulation in touch mode); hold a finger on the board and move it: the desktop browser shows a round dot with the name that follows the finger; lift the finger: the dot disappears at once; turn on "Hide my cursor" on the phone and touch again: no dot appears.
- **P07-05r** — "GIF search and display" against a real provider. Not automated: real GIF providers are out of scope (browser test spec §1); `[P07-05a]` and `[P07-07b]` run against a faked GIPHY, and Tenor is not driven in the browser at all (its request and response mapping is covered by `tests/Feature/Retros/GifsTest.php`). Check by hand: set `SKRUM_GIF_PROVIDER=giphy` and a real `SKRUM_GIF_API_KEY`, open a retro in Writing, search "party" in the GIF dialog, attach a result, and confirm in the browser's network panel that every image comes from `/gifs/…` on skrum's own host and that no request goes to giphy.com; repeat with `SKRUM_GIF_PROVIDER=tenor` and check the footer says "Powered by Tenor" and no request goes to tenor.com.
- **P07-11** — "Forged sender: in browser A's devtools console, whisper a reaction whose payload `id` is browser B's participant id …; browser B labels it with A's name (anonymous retro: no label), proving the Reverb stamp is used, not the payload." Not automated: sending a whisper needs a handle on the page's Echo client, and a test-only handle was declined (browser test spec §1). Check by hand: with a websocket debugging extension that can send frames on browser A's socket, send `{"event":"client-reaction","channel":"presence-retro.<retroId>","data":{"v":1,"t":"r","id":"<B's participant id>","e":"🎉"}}`; browser B must show the reaction labelled with A's name, and with no label on an anonymous retro; a frame whose `"e"` is `"hello"` must show nothing.
None. Every item of both walkthroughs is covered by a test.
````

- [ ] **Step 5: Check the table against the tests**

Run: `grep -ohE "\[P[0-9]+[a-z]?-[0-9]{2}[a-z]*\]" tests/Browser/Walkthroughs/*.php | sort -u | wc -l` and `grep -cE "^\| P[0-9]+[a-z]?-" docs/superpowers/walkthroughs/coverage.md`.
Expected: every identifier used in a test title appears in a row (alone or in a row that names its tests); every `auto` or `auto-substituted` row names an identifier that exists in a test title; `grep -cE "\| residual \|$" docs/superpowers/walkthroughs/coverage.md` equals `grep -c "^- \*\*P" docs/superpowers/walkthroughs/residual-manual-checklist.md`.

- [ ] **Step 6: Format the two documents and commit**

Run: `npx vp fmt docs/superpowers/walkthroughs/coverage.md docs/superpowers/walkthroughs/residual-manual-checklist.md`, then check with `git diff --stat` that only these two files changed.

```bash
git add docs/superpowers/walkthroughs/coverage.md docs/superpowers/walkthroughs/residual-manual-checklist.md
git commit -m "docs: add the plan 16b walkthroughs to the coverage table and the residual checklist"
```

### Task 9: Final verification

**Files:**
- Modify: `docs/superpowers/walkthroughs/coverage.md` (verification record at the end)

**Interfaces:**
- Consumes: everything produced by the tasks of this plan.
- Produces: the evidence that this plan's walkthroughs meet the spec's criterion 5 and leave criteria 1, 2, 6, 7, 9 and 10 intact.

Do not claim a result without the output of its command in front of you.

- [ ] **Step 1: Run the browser suite twice**

Run: `composer test:browser && composer test:browser`
Expected: PASS both times with the same number of tests; `lsof -i :8097` prints nothing afterwards. A test that passes once and fails once is flaky: find the missing wait and fix it before continuing.

- [ ] **Step 2: Run the architecture suite and the source scan**

Run: `composer test:arch`
Expected: PASS.

- [ ] **Step 3: Run the whole existing suite and the static checks**

Run: `composer test`, then `composer rector:check`, then `npm run types:check && npm run check`.
Expected: PASS; no browser test listed by `composer test`; Rector reports no change; `npm run check` lists no file touched by this plan.

- [ ] **Step 4: Check what product code changed**

Run: `git diff <first commit of this plan>^..HEAD -- app routes resources/js | grep -E "^[+-]" | grep -vE "^(\+\+\+|---)" | grep -vE "data-test|data-realtime|realtimeState"`
Expected: nothing, except the re-wrapped lines around an added attribute and any `fix(...)` commit made under the Defect rule (list those in the record).

- [ ] **Step 5: Record the verification**

Append to `docs/superpowers/walkthroughs/coverage.md`:

```markdown
## Verification of plan 16b

Date: <YYYY-MM-DD>

| Check | Evidence |
|---|---|
| Browser suite, twice | <n> tests, <seconds> s and <seconds> s |
| Arch suite and source scan | green |
| `composer test` | green, no browser test listed |
| Rector, types, lint | clean |
| Coverage rows of this plan | <n> rows: <n> `auto`, <n> `auto-substituted`, <n> `residual` |
| Product diff | only `data-test` / `data-realtime` (and these defect fixes: <list or "none">) |
```

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/walkthroughs/coverage.md
git commit -m "docs: record the verification of plan 16b"
```

---

## Appendix: notes from drafting

Nothing in this plan was executed while it was written. The notes below record what was read, what could not be verified, and the fallback for each doubt. Where a note says "the lead", read "whoever executes the plan".

### From `16b-1-harness-polish.md`

Signatures produced by Task 1 (in `tests/Browser/Support/InteractsWithBrowser.php`), exactly as assigned:

```php
/** Runs $jobs queued jobs, each outside any browser request, so a broadcast made by the job reaches every open page. */
protected function workQueue(int $jobs = 1): void;

/** $handleRemains = false: the drop removes the handle (e.g. grouping a card), so the helper ends by asserting the handle is gone instead of asserting aria-pressed is cleared. */
protected function dragWithKeyboard(mixed $page, string $handleSelector, array $keys, bool $handleRemains = true): mixed;
```

Facts for sections that code against them:

- `workQueue()` does not set the queue driver. The calling test sets `config(['queue.default' => 'database'])` before the action that queues the job. Passing more jobs than are waiting costs three seconds per extra job (`queue:work --once` sleeps on an empty queue). I kept the body of the proven local helper and did not add `--sleep=0`.
- The cure is in `workQueue()` only. A test that broadcasts from its body without a queued job (calling an action or firing a model event directly) still needs `app()->instance('request', Request::create('/'))` first; Task 1 Step 15 writes that into the harness findings. If several sections need it, a third helper is the next step, but it is not one of the assigned interfaces.
- `dragWithKeyboard()`'s docblock in the code keeps plan 16a's paragraph about the waits and adds the assigned sentence, wrapped over two lines.

Scope change applied (coordinator message during drafting):

- Task 1 no longer writes "Findings from plan 16a". Step 15 adjusts two bullets of that section (the `p10bWorkQueueOutsideAnyRequest()` workaround and the drag limit, both false after Task 1) and appends "Findings from plan 16b, Task 1". The step tells the implementer to read the section as it stands then.
- The two review items became **Task 1b** (regular-expression source scan with a red/green dataset test; two `data-test` hooks). Task 2 stays the plan 6 walkthrough.
- Task 1 Step 16 edits the browser test spec (§3.5 helper table, §3.6 timer row) so that the spec names the two helper changes; project rule "update the spec first". Drop the step if the lead prefers to batch spec edits.

Hooks introduced (name → file):

- `retro-action-items-panel` → `resources/js/components/retro/action-items-panel.tsx` (Task 1b).
- `retro-sort-by-votes` → `resources/js/components/retro/retro-column.tsx` (Task 1b).
- Task 2 introduces no hook and no product change.

Dependencies between sections:

- Task 2 `[P06-07b]` uses `[data-test="retro-action-items-panel"]`, so Task 1b must precede Task 2. Any later section that addresses the retro action-items panel (plans 8 and 9) should use this hook rather than `aside:not([aria-label])`.
- Coverage row P06-09 points at `[P04-03]`, which Task 1 edits.
- `plan06RecordRequests()`, `plan06Hold()`, `plan06Release()` (hold an XHR response inside the page, count requests) are local to the plan 6 file. If another section needs "a request in flight" (a disabled-while-saving check, an optimistic update), promoting them to the harness would be a small follow-up; say so and I rename them.

Facts that contradict the brief or the spec, with evidence:

- Brief, "Keyboard drag: … It cannot be used when the drop removes the handle": false after Task 1 (`handleRemains: false`).
- Brief, "use the helper pattern of `p10bWorkQueueOutsideAnyRequest()`": the helper is deleted by Task 1 Step 7; sections must call `$this->workQueue()`.
- The working tree changed while I was drafting (uncommitted fix-wave edits to `Plan04RetroCoreTest.php`, `Plan10bPokerAdditionsTest.php`, `harness-findings.md`, the spec and `coverage.md`). `[P04-05a]` already addresses the sort toggle with `button:has-text("Sort by votes")` in the working tree, not with `button[aria-pressed="true"]` (`git diff tests/Browser/Walkthroughs/Plan04RetroCoreTest.php`). Task 1b Step 7 gives both variants. The lines of `[P04-03]` and of the P10b helper that Task 1 replaces were unchanged at the time of writing.
- The `Arch` suite has no Laravel test case (`tests/Pest.php:72-78` binds only `Feature` and `Browser`), so Task 1b's fixture test uses `mkdir()`, `file_put_contents()` and `sys_get_temp_dir()`, not the `File` facade.
- `tests/` is not analysed by PHPStan (`phpstan.neon:6-11` lists `app/`, `bootstrap/app.php`, `config/`, `database/`, `routes/`), so the PHPStan step of Task 1 only confirms that nothing else moved.
- Plan 6's walkthrough says "Reload leads to login". That holds only for a retro without guest access (`app/Http/Middleware/ResolveRetroParticipant.php:47-55`); a guest-enabled retro shows the session-ended page (spec PA5b). Both branches are tested (`[P06-10a]`, `[P06-10b]`).
- Walkthrough Step 3 says "edit a card, facilitator moves to Voting". A card is editable in Writing and Grouping (`resources/js/components/retro/retro-card.tsx:36-39`), so the test starts in Grouping; from Writing, "Next" leads to Grouping and the editor rightly stays open.
- Not covered and not in the walkthrough: PA1b (version-ordered totals, beyond the "1 of 4 vote cast" assertion of `[P06-02]`), PA2b (own card saved between snapshot and private subscription), PA3 (channel authorisation), PA5a's revoked guest cookie, PC1, PI1. They stay with their feature tests.

Unverified items (nothing in this fragment was run; the repository was read-only for me). Each has a fallback:

- UNVERIFIED: Task 1 Step 4's red run. I expect the member's page to miss the reveal because the member's vote is the last request handled. If another request is handled after it (a refetch from the facilitator's page), the page that misses the reveal is the facilitator's; the step's expected failure is worded for either. If the test passes without the fresh request, the artefact does not reproduce in this minimal form: fall back to copying `[P10b-08a]` unchanged into the smoke test.
- UNVERIFIED: that Rector leaves `throw_if(count($keys) < 2, …)` and the `for` loop of `workQueue()` alone. Fallback: apply `composer rector` and keep its form; the guard test asserts only the exception class and message.
- UNVERIFIED: the `XMLHttpRequest` wrapper of `plan06RecordRequests()`. It relies on `@inertiajs/core` 3.7.1 assigning `xhr.onload` before `xhr.send()` (`node_modules/@inertiajs/core/dist/index.js:2093-2104`) and on `script()` accepting a multi-line arrow function, as the harness's one-line ones are accepted. Fallback for `[P06-02]` and `[P06-07b]`: mark both rows `residual` (a request in flight cannot be arranged otherwise); `[P06-04a]`, `[P06-04b]` and `[P06-10a]` can drop the request counts and keep their database and DOM assertions.
- UNVERIFIED: that Bob's initial resync snapshot has completed before the recorder is installed in `[P06-02]` and `[P06-10a]` (the tests open Bob's page first and sign Alice in afterwards, which takes about a second; the resync is scheduled 250 ms after subscription, `resources/js/hooks/use-retro-channel.ts:64`). If `held.length` reaches 2 in `[P06-02]`, add `->assertScript(plan06Held(), 0)` after a first `$bobPage->assertSee('Votes left: 2')` placed after Alice's sign-in, or install the recorder after `$alicePage` is ready (already the case).
- UNVERIFIED: `[P06-03]`, that the second context of the same user receives `own-card.saved` after the redacted `card.created` (or that the reducer keeps the full content whichever arrives last). If the second tab shows the placeholder, that is a product defect against PA2, not a selector problem.
- UNVERIFIED: `[P06-08a]`, the DOM of dnd-kit's `DragOverlay` (preview's parent is the `position: fixed` element; `node_modules/@dnd-kit/core/dist/core.esm.js:3631`) and that the overlay appears for a keyboard pick-up. Fallback: drop the `parentElement` assertion and keep `closest('main') === null` and the width; if the overlay does not render for the keyboard sensor, mark P06-08a `residual` and merge it into P06-08b.
- UNVERIFIED: `plan06SignOutElsewhere()`, that Fortify answers `POST /logout` with 204 for `Accept: application/json` (`vendor/laravel/fortify/src/Http/Responses/LogoutResponse.php:19-20`, no override under `app/`) and that the `XSRF-TOKEN` cookie is readable from the page. Fallback: remove the `Accept` header, add `redirect: 'manual'`, and assert `response.type === 'opaqueredirect'` instead of the status.
- UNVERIFIED: `[P06-11]`, that blocking the test process for 15.5 seconds inside a request is tolerated: the Playwright client has no timer of its own on the PHP side (`vendor/pestphp/pest-plugin-browser/src/Playwright/Client.php`, `execute()` only reads the websocket), so the `click()` should simply return late; Playwright's server or the browser's Reverb socket must not drop a connection in that time. The toast lasts 4 seconds (`node_modules/sonner/dist/index.mjs:470`), leaving about 3.5 seconds for the assertion. Fallback: mark P06-11 `residual` with the walkthrough's own instruction (`docker pause` the Sail app for about 20 seconds during a vote; expect the translated toast, then a working board after `docker unpause`).
- UNVERIFIED: `visit()`-level sign-in of the same user twice keeps the first session valid (array session store, one session id per context). If the first tab is signed out by the second sign-in, `[P06-03]` needs the `database` session driver, which spec §3.3 names as the fallback.

### From `16b-2-engagement.md`

- **Possible product defect, not asserted by the tests: cursor positions across window sizes.** Feature spec §3 says positions are "normalized to the board's scrollable content, so positions match across screen sizes and scroll offsets". `live-cursors` normalises to `el.scrollWidth` / `el.scrollHeight` (`node_modules/live-cursors/dist/cursors-BF2FQeHR.mjs:94-115`), and the board's `main` is `flex-1` (`resources/js/components/retro/board.tsx:305-307`), so on a window wider than the columns the scroll width is the window's width, not the content's. A 1728 px page and an 800 px page therefore map the same normalised x to different cards. `[P07-01a]` uses equal viewports so that it passes; if the lead wants the spec's sentence proved, add a test with two different widths and expect it to fail under the plan header's Defect rule.
- **The assignment mentions a "comments" toggle; there is none.** The six settings are reactions, cursors, GIFs, hide vote counts, lock and presentation mode (`resources/js/components/retro/settings-dialog.tsx:286-331`, feature spec §2). Comments only follow the phase and the lock.
- **Hooks introduced: none.** Both tasks use existing ids, aria-labels, `data-test="retro-card-handle-{id}"`, `data-test="retro-column-{id}"`, `data-slot="tooltip-content"` and the libraries' `.lc-*` / `.lr-*` classes.
- **Dependencies on other sections: none.** Neither task calls `$this->workQueue()` or `$this->dragWithKeyboard()`. Task 4 depends on Task 3 (same file, shared helpers). No helper of `Plan04RetroCoreTest.php` or `Plan10bPokerAdditionsTest.php` is called.
- **`Http::fake()` entries must be closures here.** `GifsController::download()` (`app/Http/Controllers/GifsController.php:76-81`) and `EmojiDataController::download()` (`app/Http/Controllers/EmojiDataController.php:79-84`) read the PSR stream without rewinding; a plain `Http::response()` in the array is one object reused for every match, so the second image would be read as empty and answered 502. The existing feature tests never download twice with one fake, which is why they do not show it.
- **Overlap with plan 16a.** `[P10b-15a]`, `[P10b-15b]` and `[P10b-15c]` already assert named cursors and reactions on a retro board in Writing, no cursor layer in Voting, and the anonymous labels. This fragment does not repeat the Voting case (it is not in the plan 7 walkthrough's list); `[P07-06b]` repeats the anonymous case so that step 6 has its own row.
- UNVERIFIED: `hover()` on a reaction chip opens the Radix tooltip, and `[data-slot="tooltip-content"]` is then a single element whose text `assertSeeIn()` can read (`[P07-03a]`, `[P07-06a]`). Hovering was proven in plan 16a only on text and on `main`. Fallback: assert the names through the visually hidden copy Radix renders, `assertSeeIn('[role="tooltip"]', 'Alice Martin')`; if the tooltip cannot be opened at all, keep the count and `aria-pressed` assertions and move "tooltip shows names" to a residual row P07-03t (names are in the payload: `tests/Feature/Retros/CardReactionsTest.php`).
- UNVERIFIED: `assertNotPresent('[data-slot="tooltip-content"]')` right after a hover proves little on its own if the tooltip were slow to open; `TooltipProvider` uses `delayDuration={0}` (`resources/js/app.tsx:74`), so it opens on the first pointer move. Fallback: none needed if the P07-03a tooltip assertion passes, since it proves the same hover opens a tooltip when names exist.
- UNVERIFIED: the frimousse picker renders the faked Emojibase data in headless Chromium (`[P07-02b]`, `[P07-05b]`, `[P07-03b]`). The data and messages shapes were derived from frimousse's loader (`node_modules/frimousse/dist/index.js`: it reads `group`, `version`, `label`, `tags`, `skins` from the data and `groups`, `subgroups`, `skinTones` from the messages) and both emoji carry the same `version`, so the version filter keeps them whether or not the headless font can draw them. Fallback: replace the fake bodies with the two real files copied from `node_modules` if `emojibase-data` is installed, or else from a one-time download committed under `tests/Fixtures/emojibase/en/` (needs the lead's approval as a new fixture folder), and click `[aria-label="Rocket"]` after filling `[aria-label="Search emoji…"]` with `rocket`.
- UNVERIFIED: `Storage::fake()` and streamed fake responses (`withOptions(['stream' => true])`) behave in a browser request as in a feature test. The feature tests `tests/Feature/Retros/GifsTest.php` and `tests/Feature/EmojiDataTest.php` prove the same code path in process; the browser adds nothing new on the server side. Fallback: if the image is refused, serve the pixel with `Content-Type: image/webp` as `GifsTest.php` does.
- UNVERIFIED: Resource Timing lists same-origin `fetch` and image requests in the plugin's Chromium (`plan07Requested()`, `plan07ThirdPartyRequests()`). It is a standard API with a 250-entry buffer, enough for one board page. Fallback: drop `plan07Requested()` and keep `plan07ForeignImages()` plus `plan07ThirdPartyRequests()` reduced to the `img` and `source` elements, which is the substitution the assignment asked for.
- UNVERIFIED: two `click()` calls on two pages land within the 700 ms gathering window (`[P07-02a]`). Each plugin call took 30 to 150 ms in plan 16a. Fallback if it proves flaky: open a third page (Carol), send 🎉 from Alice and Bob, and assert on Carol's page only, where both reactions are remote; if still flaky, keep the name assertions, and move "gather into a bubble" to a residual row P07-02g (visual, timing-dependent).
- UNVERIFIED: dispatching `new Event("blur")` on `window` triggers the library's leave, and the watching page's `MutationObserver` reports it in under 1.5 s (`[P07-01b]`). Fallback: replace the blur part by moving the pointer off the board, `$bobPage->hover('header > h1')`, which fires the library's `pointerleave` on `main`, keep the same timing assertion, and note in the coverage table that blur itself is checked by hand.
- UNVERIFIED: at 800 × 700 the board of a member overflows sideways (three 18rem columns plus gaps and padding, about 928 px) and `hover()` scrolls the third column into view on the hovering page (`[P07-01a]`). Fallback: resize to 600 × 700, or add a fourth column to `plan07Board()` for this test only.
- UNVERIFIED: `assertAttribute('@retro-card-handle-{id}', 'aria-disabled', 'false')` (`[P07-08a]`): dnd-kit renders `aria-disabled` from a boolean, which React writes as `"true"` / `"false"`. Fallback: assert the class instead, `assertAttributeContains($handle, 'class', 'cursor-grab')` when editable and its absence through `assertScript("document.querySelector('[data-test=\"retro-card-handle-{$mine->id}\"]').classList.contains('cursor-grab')", false)` when locked (`resources/js/components/retro/dnd.tsx:114-117`).
- UNVERIFIED: in `[P07-10]` the progress text is `1 of 15 vote cast` (three participants, five votes each, `resources/js/components/retro/vote-progress.tsx:7`); it assumes `board.participants` holds the three arranged participants although only two are online. Fallback: replace the assertion by `assertAttribute('[role="progressbar"]', 'aria-valuenow', '1')`.
- UNVERIFIED: a toast's title and description are visible text for `assertSee()` and stay long enough (sonner's default is about 4 seconds) (`[P07-04b]`, `[P07-06a]`, `[P07-08b]`). `[P04-13]` already asserts a sonner error toast this way.

### From `16b-3-action-items.md`

- **Brief versus code: the bell has no interval.** The assignment says the bell "reloads on an interval". `resources/js/components/notification-bell.tsx` has no timer: `refreshCounts()` (line 47) is bound to `window` `focus` only (lines 69 to 71), and the count otherwise comes from the shared prop `notifications.unreadCount` on each navigation (`app/Http/Middleware/HandleInertiaRequests.php`, `share()`), plus the workspace page's reload (`ReloadProps` in `resources/js/pages/action-items/index.tsx` line 83). The tests refresh with `$page->navigate($samePath)`.
- **The `data-realtime` edit is more than an attribute.** `resources/js/pages/action-items/index.tsx` tracks no subscription state (lines 403 to 441 only call `.private(name).listen(…)`), so Task 6 Step 1 adds one `useState`, one `useSafeConnectionStatus()` call, a `.subscribed()` callback and a reset in the effect's cleanup, all feeding only the attribute. Spec §3.7 says the attribute is "taken from the state the channel hooks already track"; here no hook tracked it. Spec criterion 10 may need the sentence "and the state needed to derive `data-realtime` on the workspace action items page". After a socket reconnect the attribute can read `connected` a moment before the channels are subscribed again (the list is not cleared on disconnect); no test in this section reconnects on that page.
- **Hooks summary:** no `data-test` hook. One `data-realtime` → `resources/js/pages/action-items/index.tsx` (root `<div>`), which makes `awaitRealtime()` usable on `/w/{workspace}/action-items`.
- **Dependencies on other sections:** none. `$this->workQueue()` from plan 16b Task 1 is not used: no test in this section needs the `database` queue. Task 7 depends on Task 6's file and helpers.
- **Walkthrough versus product:** the date format ("Due Oct 3", not "Due 3 Oct") and the lock behaviour (controls disabled rather than a toast on every edit) are described in the coverage notes. Neither contradicts the feature spec.
- **`[P09b-06a]` drives no browser page.** It is in `tests/Browser` so that the walkthrough's step 6 has all its tests in one file; it could equally be called covered by `tests/Feature/ActionItems/ReminderSelectionTest.php` and `ReminderDigestTest.php`. Say so if the lead prefers to drop it and mark the e-mail part of step 6 as covered by the feature tests.
- UNVERIFIED: `Event::fake([NotificationSent::class])` called in the middle of a browser test (`[P09b-07]`), after pages were served. Reasoning: `EventFake` forwards events it does not fake to the original dispatcher, so the isolation listener on `RequestHandled` keeps running, and `NotificationSender` resolves the dispatcher on each send. Fallback: replace the `Event::fake`/`Event::assert…` lines with `Notification::fake()` before the command, `Notification::assertSentTo($bob, ActionItemReminderNotification::class)` and `Notification::assertNotSentTo($bob, ActionItemReminderDigestNotification::class)`, and delete the final bell assertions of that test (the bell is then covered by `[P09b-06b]` only).
- UNVERIFIED: `fill()` on a native `<input type="date">` with an ISO date, and saving the card's due date by `keys($field, 'Tab')` (blur) (`[P09a-01a]`, `[P09b-05]`, `[P09b-07]`). Fallback for the card: arrange `due_on` with the factory and keep only the "Repeat" select or the date change through `script()` that sets the value with the native setter and dispatches `input` and `blur`.
- UNVERIFIED: a guest reloading a retro that was moved to `Completed` in the database (`[P09a-03c]`). Fallback: drop the guest half of that test and keep the member's assertions; the guest's missing link then rests on `links.actionItems` being `null` for guests (`app/Actions/Retros/BuildBoardSnapshot.php` lines 171 to 173).
- UNVERIFIED: `Mail::fake()` together with a real `mail`-channel notification on the `sync` queue (`[P09b-06b]`, `[P09b-08]`). It is only a guard; if it interferes, remove the two `Mail::fake()` lines and the `Mail` import: `phpunit.xml` already sets `MAIL_MAILER=array`.
- UNVERIFIED: `[role="option"][aria-disabled="true"]` for a disabled Radix select item (`[P09b-02c]`). Fallback: `[role="option"][data-disabled]`.
- UNVERIFIED: the selector `div.grid > [aria-label="…"]` for the three filter triggers. It was derived from the markup (`index.tsx` lines 563 to 639) and not run. Fallback: add `data-test="action-item-filter-status"`, `-assignee` and `-team` to the three `SelectTrigger`s and use `@action-item-filter-status` and so on.
- **Fragile by construction, stated in the task:** Radix options are matched with `:has-text()` (case-insensitive substring). The assignee filter option "Me" would also match a member whose name contains "me"; the tests use "Alice Martin" and "Bob Stone". All due-date labels are computed from `ActionItem::today()`; a run that crosses midnight in the instance time zone between arranging and asserting could fail once.
- **Counts:** Task 5 has 9 tests (10 cases with the data set of `[P09a-05]`); Task 6 has 9 tests; Task 7 has 4 tests. Four browser contexts at most are open in one test (`[P09a-01c]`, `[P09a-02]`: three).
