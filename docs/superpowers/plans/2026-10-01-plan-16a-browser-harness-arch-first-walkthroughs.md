# Plan 16a — Browser harness, architecture tests and the first walkthroughs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give skrum a browser test suite (Pest browser testing with a real Reverb server) and an architecture test suite, and turn the manual walkthroughs of plan 4, plan 10a and plan 10b into automated browser tests with a coverage table.

**Architecture:** Browser tests live in `tests/Browser`, bound to `Tests\BrowserTestCase`, which serves the built assets, points broadcasting at a Reverb process that the suite starts itself, and resets authentication state after every request so several browser contexts can act as different users in one test. Tests sign in and join through the real interface, wait on a `data-realtime` attribute instead of sleeping, and move sortable items with the keyboard. Architecture tests live in `tests/Arch` as their own PHPUnit suite; the code is refactored until the `php`, `security` and `laravel` presets and nine project rules pass. Each walkthrough step maps to a test whose title starts with the step's identifier, recorded in `docs/superpowers/walkthroughs/coverage.md`.

**Tech Stack:** PHP 8.4, Laravel 13, Pest 5 with `pestphp/pest-plugin-browser` 5.x (Playwright, Chromium) and `pestphp/pest-plugin-arch`, Laravel Reverb, Inertia v3 with React 19, PostgreSQL, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-01-browser-e2e-and-arch-tests-design.md`. Read it before starting; every task argues from it.

## Global Constraints

- Branch `feat/plan-16-browser-e2e-arch`, on top of the Rector commits and the plan 15 merge. Do not start on another base.
- New dependencies allowed: `pestphp/pest-plugin-browser` (Composer, dev) and `playwright` (npm, dev). No other dependency is added or upgraded.
- New folders allowed: `tests/Browser`, `tests/Arch`, `docs/superpowers/walkthroughs`. No other new base folder.
- The plugin requires PHP 8.4 and the `sockets` extension.
- Browser tests never call `actingAs()`, `withCookie()`, `withCookies()` or `Event::fake()` without arguments. Members sign in with `$this->signIn(...)`; guests join with `$this->joinAsGuest(...)`. They do not use the guest-cookie helpers or the fake presence rosters of `tests/Pest.php`.
- No fixed sleep for realtime: call `$this->awaitRealtime($page)` after opening a live page, act on one page, assert on the other. Only `assert*` calls are retried by the plugin; assert that an element is visible before clicking it or reading from it.
- An explicit CSS selector must match exactly one element (the plugin is strict), except in `assertCount()`, `assertPresent()` and `assertNotPresent()`.
- Selectors are English text and aria-labels first; the locale is English. A `data-test` attribute is added only where a target cannot be addressed otherwise.
- Product code gains only: `data-test` attributes, the `data-realtime` attribute, and the refactors of spec §5.3. Nothing else changes behaviour.
- The refactors of spec §5.3 change no behaviour: existing tests stay green with only imports, class names and the two emoji `ETag` assertions edited.
- Every `ignoring()` in an architecture test carries its reason.
- `composer test` must never run a browser test: `tests/Browser` is in no suite of `phpunit.xml`.
- PHP style: curly braces always, early returns, typed properties and return types, no `final` or `readonly` by default, string interpolation, PascalCase constants, no comments in tests. After editing PHP run `vendor/bin/pint --dirty --format agent`. Rector must stay clean: `composer rector:check` reports no change at the end of each task that edits PHP under `app/` or `tests/`.
- Frontend: after editing a `.tsx` or `.ts` file run `npm run types:check`, `npm run check` and `npm run build` (the browser suite serves `public/build`, so an edit is invisible to the tests until it is built).
- Every new user-visible string would need the four languages; this plan adds none.

## Environment

Commands in the tasks are written plainly. Prefix them according to where you work:

- **In this worktree** (host PHP, PostgreSQL published by Sail on `127.0.0.1:5432`, test database `testing_plan16`): run Pest as `DB_HOST=127.0.0.1 DB_DATABASE=testing_plan16 php -d memory_limit=2G vendor/bin/pest …`, and `composer test`, `composer test:arch`, `composer test:browser`, `php artisan test` with the same two variables exported (`export DB_HOST=127.0.0.1 DB_DATABASE=testing_plan16`). The worktree has its own `.env` (git-ignored).
- **In the primary checkout** with Sail: `vendor/bin/sail` in front of `composer`, `artisan`, `pest` and `npm`.
- The browser suite needs built assets (`npm run build`) and no Vite dev server (`public/hot` must not exist). It starts its own Reverb server on `127.0.0.1:8097`; nothing else may listen on that port.
- Run one test: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php --filter='P10a-07'`. Watch it: add `--headed`. Pause on failure: add `--debug`. Screenshots of failed assertions are written to `tests/Browser/Screenshots`.

## Defect rule

The walkthroughs were never run, so a browser test may reveal a real defect. When a walkthrough test fails:

1. If the interface text or structure differs from the selector, and the behaviour is right, fix the selector.
2. If the behaviour is wrong against the feature's spec: stop the task, write a failing feature test where the behaviour is server-side, fix the defect in its own commit (`fix(<area>): …`), then return to the task. Record the defect and its commit in `docs/superpowers/walkthroughs/coverage.md` under "Defects found".
3. If the walkthrough's text and the feature's spec disagree, the feature's spec wins; note the difference in the coverage table's "Notes" column. Two such differences are already known and written into the tests: the poker join page shows the game's title, not "Join a planning poker game" (P10a-06); after the guest link is regenerated the guest sees "Your access to this game has ended." rather than the session-expired banner (P10a-14).
4. If a harness assumption is wrong (Task 1 found otherwise), follow the "Decision" column of `docs/superpowers/walkthroughs/harness-findings.md`.

## Task order

| # | Task | Depends on |
|---|---|---|
| 1 | Install the plugin and prove the harness assumptions (spike) | — |
| 2 | `BrowserTestCase`, Pest binding, isolation, first smoke test | 1 |
| 3 | Reverb lifecycle, `data-realtime`, realtime smoke test | 2 |
| 4 | Keyboard drag-and-drop helper | 3 |
| 5 | Arch suite, the `php` preset and the browser source scan | — |
| 6 | Security preset and the emoji locale helper | 5 |
| 7 | Laravel preset, part 1: enum, exception and controller-method locations | 6 |
| 8 | Laravel preset, part 2: one listener per event | 7 |
| 9 | Project rules | 8 |
| 10 | Poker core walkthrough, steps 1 to 9 | 4 |
| 11 | Poker core walkthrough, steps 10 to 16 | 10 |
| 12a | Plan 4 walkthrough, Step 1 (the scripted phase flow) | 4 |
| 12b | Plan 4 walkthrough, Steps 2 to 4 | 12a |
| 13 | Poker additions walkthrough, part 1 | 11 |
| 14 | Poker additions walkthrough, part 2 | 13 |
| 15 | Coverage table and residual checklist | 11, 12b, 14 |
| 16 | CI job and Composer scripts | 5, 4 |
| 17 | Final verification | all |

Tasks 5 to 9 (architecture) do not depend on Tasks 1 to 4 (harness) and may be done first. Do Tasks 7 and 8 before Tasks 10 to 14 if possible: they move classes that walkthrough tests import nowhere, but they touch many files and are easier to review on a quiet branch.

## Review Focus

Conditions the spec implies that no single task's happy path exercises. Each is pinned by the test named after it.

1. **A blanket `Event::fake()` in a browser test silently merges the users of two contexts.** Expected: the suite refuses it. Pinned by the source scan of Task 5 (`tests/Arch/BrowserTestRulesTest.php`), whose forbidden list includes `Event::fake()`, and by Task 5 Step 5's red demonstration.
2. **A validation error flashed by a POST must survive the per-request reset.** Expected: the form shows its error after the redirect. Pinned by spike probe `[f]` in Task 1 and by `[P10a-03]` in Task 10 (custom deck validation messages).
3. **Assets missing or a Vite dev server running.** Expected: an immediate failure that names the fix, not a blank page and a timeout. Pinned by `tests/Browser/Smoke/AssetCheckTest.php` in Task 2 and the hand check of Task 2 Step 10.
4. **Port 8097 already held by a foreign Reverb, or Reverb failing to start.** Expected: a failure with the process output, and reconnect tests refusing to "stop" a server they did not start. Pinned by Task 3 Step 13 and by the `try`/`finally` restoration in `[P10a-11]` (Task 11) and `[P04-12]` (Task 12b).
5. **A listener registered twice after the split** (explicit `Event::listen` plus discovery). Expected: one webhook delivery and one status push per event. Pinned by Task 8 Step 10 (`event:list` shows each listener once) and by the existing tests that use `->sole()` and exact counts in `WebhookEventsTest` and `ActionItemStatusPushTest`.

---

### Task 1: Install the plugin and prove the harness assumptions (spike)

**Files:**
- Modify: `composer.json`, `composer.lock` (adds `pestphp/pest-plugin-browser` to `require-dev`)
- Modify: `package.json`, `package-lock.json` (adds `playwright` to `devDependencies`)
- Modify: `.gitignore` (adds `/tests/Browser/Screenshots`)
- Create, then delete before the commit: `tests/Browser/Spike/HarnessSpikeTest.php`
- Create: `docs/superpowers/walkthroughs/harness-findings.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the installed plugin (global `visit()`, `pest()->browser()`), the Chromium build, and `docs/superpowers/walkthroughs/harness-findings.md`, whose "Decision" column Tasks 2, 3 and 4 follow. The Reverb test port `8097` and the credentials `skrum-browser` / `skrum-browser-key` / `skrum-browser-secret` used here are the ones Task 3 turns into constants.

- [ ] **Step 1: Check the PHP requirements of the plugin**

The plugin requires PHP `^8.4` and `ext-sockets` (its `composer.json`).

Run: `php -r 'echo PHP_VERSION, " sockets=", extension_loaded("sockets") ? "yes" : "no", PHP_EOL;'`
Expected: a version `8.4.x` or higher and `sockets=yes`. This is spike question (e). If it prints `sockets=no`, stop: the Sail image must be rebuilt with `PHP_EXTENSIONS=sockets` before anything else, and that is reported to the user.

- [ ] **Step 2: Install the Composer package**

Run: `composer require pestphp/pest-plugin-browser --dev`
Expected: `pestphp/pest-plugin-browser` at `v5.0.x` is added under `require-dev`, with `amphp/amp`, `amphp/http-server` and `amphp/websocket-client` installed as its dependencies. No other direct dependency changes version.

- [ ] **Step 3: Install Playwright and Chromium**

`.npmrc` contains `ignore-scripts=true`, so no install script downloads a browser. The browser is installed explicitly.

Run: `npm install -D playwright@latest`
Expected: `playwright` appears under `devDependencies` in `package.json` at `^1.62.1` or higher.

Run: `npx playwright install chromium`
Expected: the output ends with the Chromium (and headless shell) download completing, or prints nothing when it is already installed.

- [ ] **Step 4: Ignore the screenshots folder**

In `.gitignore`, add one line after `/public/storage`:

```gitignore
/tests/Browser/Screenshots
```

- [ ] **Step 5: Build the assets**

Run: `npm run build`
Expected: the build finishes and `public/build/manifest.json` exists. Confirm that `public/hot` does not exist (`ls public/hot` prints "No such file or directory"); if it exists, stop the Vite dev server first.

- [ ] **Step 6: Start a Reverb server for the spike in a second terminal**

Run, and leave running: `REVERB_APP_ID=skrum-browser REVERB_APP_KEY=skrum-browser-key REVERB_APP_SECRET=skrum-browser-secret php artisan reverb:start --host=127.0.0.1 --port=8097`
Expected: `INFO  Starting server on 127.0.0.1:8097`.

- [ ] **Step 7: Write the throwaway probe tests**

Create `tests/Browser/Spike/HarnessSpikeTest.php`. This file is deleted in Step 10; it is the only place in the suite where a fixed wait is tolerated.

```php
<?php

use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\User;
use Illuminate\Foundation\Http\Events\RequestHandled;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    $this->withVite();

    config(['app.locale' => 'en']);
});

function spikeSignIn(User $user, string $to = '/dashboard'): mixed
{
    $page = visit('/login');

    $page->fill('#email', $user->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIsNot('/login');

    $page->navigate($to);

    return $page;
}

function spikeIsolateRequests(): void
{
    Event::listen(RequestHandled::class, function (): void {
        resolve('auth')->forgetGuards();
        resolve('session')->driver()->flush();
        app()->forgetScopedInstances();
    });
}

function spikeUseReverb(): void
{
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'skrum-browser-key',
        'broadcasting.connections.reverb.secret' => 'skrum-browser-secret',
        'broadcasting.connections.reverb.app_id' => 'skrum-browser',
        'broadcasting.connections.reverb.client.host' => '127.0.0.1',
        'broadcasting.connections.reverb.client.port' => 8097,
        'broadcasting.connections.reverb.client.scheme' => 'http',
        'broadcasting.connections.reverb.options.host' => '127.0.0.1',
        'broadcasting.connections.reverb.options.port' => 8097,
        'broadcasting.connections.reverb.options.scheme' => 'http',
        'broadcasting.connections.reverb.options.useTLS' => false,
    ]);

    Broadcast::forgetDrivers();
}

it('[a1] leaks the first user into a second context without the reset', function () {
    $game = PokerGame::factory()->create();
    [$member] = pokerFacilitator($game);

    spikeSignIn($member, "/poker/{$game->id}")->assertPathIs("/poker/{$game->id}");

    visit("/poker/{$game->id}")->assertPathIs("/poker/{$game->id}");
});

it('[a2] isolates the second context with the reset', function () {
    spikeIsolateRequests();
    $game = PokerGame::factory()->create();
    [$member] = pokerFacilitator($game);

    $memberPage = spikeSignIn($member, "/poker/{$game->id}");
    $memberPage->assertPathIs("/poker/{$game->id}");

    visit("/poker/{$game->id}")->assertPathIs('/login');

    $memberPage->navigate("/poker/{$game->id}")->assertPathIs("/poker/{$game->id}");
});

it('[b] delivers a broadcast to a second context through a real Reverb process', function () {
    spikeIsolateRequests();
    spikeUseReverb();
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);
    [$member] = pokerMember($game);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Existing story']);

    $facilitatorPage = spikeSignIn($facilitator, "/poker/{$game->id}");
    $memberPage = spikeSignIn($member, "/poker/{$game->id}");
    $facilitatorPage->assertSee('Existing story');
    $memberPage->assertSee('Existing story')->wait(3);

    $facilitatorPage->click('Add task')
        ->fill('#poker-task-title', 'Spike broadcast story')
        ->click('Save');

    $memberPage->assertSee('Spike broadcast story');
});

it('[c] drives the dnd-kit keyboard sensor with keys()', function () {
    spikeIsolateRequests();
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);

    foreach (['Alpha story', 'Bravo story', 'Charlie story'] as $title) {
        PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => $title]);
    }

    $handle = 'li:has-text("Alpha story") [aria-label="Drag to reorder"]';
    $page = spikeSignIn($facilitator, "/poker/{$game->id}");
    $page->assertSee('Charlie story');

    $page->keys($handle, 'Space');
    $pressedWhileDragging = $page->attribute($handle, 'aria-pressed');
    $page->keys($handle, ['ArrowDown', 'Space']);

    $page->assertScript('Array.from(document.querySelectorAll("ol li")).findIndex((row) => row.textContent.includes("Alpha story"))', 1);
    expect($pressedWhileDragging)->toBe('true');
});

it('[d] keeps the array session and cache stores across browser requests', function () {
    spikeIsolateRequests();
    Route::get('/spike/cache', fn (): string => 'hits:'.Cache::increment('spike-hits'));
    $game = PokerGame::factory()->create();
    [$member] = pokerFacilitator($game);

    $page = spikeSignIn($member, "/poker/{$game->id}");
    $page->navigate("/poker/{$game->id}")->assertPathIs("/poker/{$game->id}");

    $page->navigate('/spike/cache')->assertSee('hits:1');
    $page->navigate('/spike/cache')->assertSee('hits:2');

    expect(config('session.driver'))->toBe('array')
        ->and(config('cache.default'))->toBe('array');
});

it('[f] keeps flashed validation errors across the redirect with the reset', function () {
    spikeIsolateRequests();
    $user = User::factory()->create(['locale' => 'en']);

    visit('/login')
        ->fill('#email', $user->email)
        ->fill('#password', 'not-the-password')
        ->click('@login-button')
        ->assertSee('These credentials do not match our records.');
});
```

- [ ] **Step 8: Run the probes and note each result**

Run: `vendor/bin/pest tests/Browser/Spike`

Expected observation per probe, and what to do when the observation differs:

| Probe | Expected | If it differs |
|---|---|---|
| `[a1]` | PASS: the second context opens the game page although it never signed in. This is the leak that spec §3.3 predicts. | If it FAILS because the second context lands on `/login`, there is no leak. Record it. The reset stays in Task 2 (it is harmless), and spec §3.3's sentence "Without a reset, a guest's request would inherit the member's session" is corrected. |
| `[a2]` | PASS: with the reset the second context is sent to `/login`, and the first user is still signed in afterwards. | If the second context still opens the game: add `config(['session.driver' => 'database']);` to the `beforeEach`, rerun. If that passes, the decision is "database session driver" and Task 2's config overrides gain that line (spec §3.3 already allows it). If the first user is signed out afterwards, the flush is too broad: same fallback. |
| `[b]` | PASS: the member's page shows "Spike broadcast story" without a reload. | If the facilitator's own page shows the task but the member's page never does, events marked `ShouldDispatchAfterCommit` do not fire inside the `RefreshDatabase` transaction, or the broadcast does not reach Reverb. Read the terminal of Step 6 (rerun it with `--debug`). Spec §3.1 is corrected and the user is asked before continuing. |
| `[c]` | PASS: "Alpha story" is at index 1, and `aria-pressed` was `true` while dragging. | If the order did not change, `keys()` does not reach the sensor: Task 4 then implements `dragWithKeyboard()` with `$page->script()` dispatching `KeyboardEvent`s on the handle, and spec §3.5 is corrected. If only the `aria-pressed` expectation fails, Task 4 drops its two `aria-pressed` waits. |
| `[d]` | PASS: the user is still signed in on the second navigation and the counter reaches 2. | If the user is signed out or the counter stays at 1, the `array` stores do not survive between requests: Task 2 sets `session.driver` to `database` and `cache.default` to `database`, and spec §3.1 is corrected. |
| (e) | Step 1 printed `sockets=yes`. | Covered in Step 1. |
| `[f]` | PASS: the login page shows the error flashed by the failed sign-in. | If the error never appears, flushing the session store after each request drops flash data: the decision is "database session driver" (same fallback as `[a2]`), and every form-validation test of the walkthroughs depends on it. |

If the whole file fails before any probe runs with `Playwright is not installed` or `Playwright is outdated`, repeat Step 3. If a probe fails on the selector of the sign-in form rather than on its final assertion, fix the selector in the probe, and carry the same fix into Task 2's `signIn()`.

- [ ] **Step 9: Record the findings**

Create `docs/superpowers/walkthroughs/harness-findings.md` with this template, replacing every `<…>` with what Step 8 showed. The "Decision" is one of: `as specified`, or the exact change made to the harness.

```markdown
# Browser harness: spike findings

Date: <YYYY-MM-DD>
Versions: pestphp/pest-plugin-browser <version>, playwright <version>, PHP <version>
Spec: `docs/superpowers/specs/2026-10-01-browser-e2e-and-arch-tests-design.md`, sections 3.1 to 3.4

| # | Assumption | Observed | Decision |
|---|---|---|---|
| a1 | Without a reset, a second `visit()` context inherits the first user's session (spec 3.3). | <PASS or FAIL, and what the second context showed> | <as specified, or the change> |
| a2 | Forgetting the guards, flushing the session store's attributes and forgetting scoped instances after every handled request isolates the contexts (spec 3.3). | <…> | <…> |
| b | A broadcast made during a browser request reaches a second context through a real Reverb process, inside `RefreshDatabase` (spec 3.1, 3.4). | <…> | <…> |
| c | `keys()` drives the dnd-kit keyboard sensor on the poker task list; the handle carries `aria-pressed="true"` while dragging (spec 3.5). | <…> | <…> |
| d | The `array` session and cache stores keep their state between browser requests of one test (spec 3.1). | <…> | <…> |
| e | `ext-sockets` is loaded in the environment that runs the suite. | <…> | <…> |
| f | Validation errors flashed by a POST are shown after the redirect, with the reset in place (spec 3.3). | <…> | <…> |

## Notes

<Anything else seen during the spike: flaky probes, timings, console errors. Write "None." when there is nothing.>
```

- [ ] **Step 10: Stop if a finding contradicts the spec, then delete the spike**

If any row's decision is not `as specified` and it contradicts spec §3.1 to §3.4: stop, correct that section of the spec, get the user's confirmation, then continue.

Then stop the Reverb process of Step 6 (Ctrl+C) and run: `rm -r tests/Browser/Spike`
Expected: `git status --short` lists `composer.json`, `composer.lock`, `package.json`, `package-lock.json`, `.gitignore` and `docs/superpowers/walkthroughs/harness-findings.md`, and no file under `tests/Browser`.

- [ ] **Step 11: Check the existing suite still boots with the plugin installed**

The plugin registers an `afterEach` hook for every test of the project (its `Plugin::boot()`), so the Unit and Feature suites must still run.

Run: `php artisan test --compact tests/Feature/RequestIsolationTest.php`
Expected: PASS, 3 tests.

- [ ] **Step 12: Commit**

```bash
git add composer.json composer.lock package.json package-lock.json .gitignore docs/superpowers/walkthroughs/harness-findings.md
git commit -m "chore(browser): install the Pest browser plugin and record the harness spike findings"
```

### Task 2: `BrowserTestCase`, Pest binding, isolation, first smoke test

**Files:**
- Create: `tests/BrowserTestCase.php`
- Create: `tests/Browser/Support/InteractsWithBrowser.php`
- Modify: `tests/Pest.php` (binds `tests/Browser` to `BrowserTestCase`, sets the browser timeout)
- Test: `tests/Browser/Smoke/HarnessTest.php`
- Test: `tests/Browser/Smoke/AssetCheckTest.php`

**Interfaces:**
- Consumes: the plugin installed by Task 1 (`visit()`, `pest()->browser()`), the findings of Task 1.
- Produces:
  - `Tests\BrowserTestCase` (abstract, extends `Tests\TestCase`, uses `Tests\Browser\Support\InteractsWithBrowser`), with `public static function assetProblem(string $publicPath): ?string`.
  - `Tests\Browser\Support\InteractsWithBrowser::signIn(\App\Models\User $user, string $to = '/dashboard'): mixed`
  - `Tests\Browser\Support\InteractsWithBrowser::joinAsGuest(string $joinUrl, string $name): mixed`
  - In `tests/Pest.php`: `pest()->extend(Tests\BrowserTestCase::class)->use(RefreshDatabase::class)->in('Browser');` and `pest()->browser()->timeout(20_000);`

`php artisan make:test` only creates files under `tests/Feature` and `tests/Unit`, so the files under `tests/Browser` are created by hand.

- [ ] **Step 1: Write the failing smoke test**

Create `tests/Browser/Smoke/HarnessTest.php`:

```php
<?php

use App\Models\Retro;

it('signs a member in through the login form', function () {
    $retro = Retro::factory()->create();
    [$member] = retroFacilitator($retro);
    $member->update(['name' => 'Mona Member', 'locale' => 'en']);

    $page = $this->signIn($member);

    $page->assertSee('Mona Member');
});

it('keeps a guest context apart from a signed-in member', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    [$member] = retroFacilitator($retro);
    $member->update(['name' => 'Mona Member', 'locale' => 'en']);

    $memberPage = $this->signIn($member);
    $guestPage = $this->joinAsGuest("/join/{$retro->guest_token}", 'Gus Guest');

    $guestPage->assertPathIs("/retros/{$retro->id}");
    $guestPage->navigate('/dashboard')->assertPathIs('/login');
    $memberPage->navigate('/dashboard')->assertSee('Mona Member');
});
```

`/dashboard` redirects a signed-in user to their workspace page, whose sidebar shows the user's name; it redirects anyone else to `/login`.

- [ ] **Step 2: Run it and see it fail**

Run: `vendor/bin/pest tests/Browser/Smoke/HarnessTest.php`
Expected: FAIL, both tests, with "Call to undefined method" for `signIn` (the tests are not bound to a class that has it yet).

- [ ] **Step 3: Write the failing asset-check test**

Create `tests/Browser/Smoke/AssetCheckTest.php`:

```php
<?php

use Illuminate\Support\Facades\File;
use Tests\BrowserTestCase;

beforeEach(function () {
    $this->publicPath = sys_get_temp_dir().'/skrum-browser-assets-'.bin2hex(random_bytes(4));

    File::ensureDirectoryExists("{$this->publicPath}/build");
});

afterEach(function () {
    File::deleteDirectory($this->publicPath);
});

it('reports a missing Vite manifest', function () {
    expect(BrowserTestCase::assetProblem($this->publicPath))
        ->toBe('Browser tests need built assets: public/build/manifest.json is missing. Run `npm run build`, or run the suite with `composer test:browser`.');
});

it('reports a running Vite dev server', function () {
    File::put("{$this->publicPath}/build/manifest.json", '{}');
    File::put("{$this->publicPath}/hot", 'http://localhost:5173');

    expect(BrowserTestCase::assetProblem($this->publicPath))
        ->toBe('Browser tests cannot use the Vite dev server: public/hot exists. Stop `npm run dev` (or delete public/hot), then run `npm run build`.');
});

it('accepts built assets', function () {
    File::put("{$this->publicPath}/build/manifest.json", '{}');

    expect(BrowserTestCase::assetProblem($this->publicPath))->toBeNull();
});
```

- [ ] **Step 4: Run it and see it fail**

Run: `vendor/bin/pest tests/Browser/Smoke/AssetCheckTest.php`
Expected: FAIL with `Class "Tests\BrowserTestCase" not found`.

- [ ] **Step 5: Write the helper trait**

Create `tests/Browser/Support/InteractsWithBrowser.php`. The selectors are the real ones: `#email`, `#password` and `data-test="login-button"` in `resources/js/pages/auth/login.tsx`; `#name` and the button "Join" in `resources/js/pages/{retros,poker,games}/join.tsx`.

```php
<?php

namespace Tests\Browser\Support;

use App\Models\User;

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
}
```

`assertPathIsNot()` retries until the browser timeout, so it is the wait for the redirect that follows the form. If a selector fails here, see Task 1's findings.

- [ ] **Step 6: Write the base class**

Create `tests/BrowserTestCase.php`. If Task 1's findings chose the `database` session driver, add `'session.driver' => 'database'` to the `config([...])` call; otherwise write it as shown.

```php
<?php

namespace Tests;

use Illuminate\Foundation\Http\Events\RequestHandled;
use Illuminate\Support\Facades\Event;
use Tests\Browser\Support\InteractsWithBrowser;

abstract class BrowserTestCase extends TestCase
{
    use InteractsWithBrowser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withVite();

        $assetProblem = self::assetProblem(public_path());

        if ($assetProblem !== null) {
            $this->fail($assetProblem);
        }

        config(['app.locale' => 'en']);

        $this->isolateRequests();
    }

    public static function assetProblem(string $publicPath): ?string
    {
        if (! is_file("{$publicPath}/build/manifest.json")) {
            return 'Browser tests need built assets: public/build/manifest.json is missing. Run `npm run build`, or run the suite with `composer test:browser`.';
        }

        if (is_file("{$publicPath}/hot")) {
            return 'Browser tests cannot use the Vite dev server: public/hot exists. Stop `npm run dev` (or delete public/hot), then run `npm run build`.';
        }

        return null;
    }

    /**
     * Every browser context is served by this one application instance, which
     * would otherwise hand the previous request's user and session attributes
     * to the next context.
     */
    private function isolateRequests(): void
    {
        Event::listen(RequestHandled::class, function (): void {
            resolve('auth')->forgetGuards();
            resolve('session')->driver()->flush();
            $this->app->forgetScopedInstances();
        });
    }
}
```

- [ ] **Step 7: Bind the folder in `tests/Pest.php`**

In `tests/Pest.php`, add the import next to the existing `use Tests\TestCase;` line:

```php
use Tests\BrowserTestCase;
use Tests\TestCase;
```

Then, directly below the existing block

```php
pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');
```

add:

```php
pest()->extend(BrowserTestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Browser');

pest()->browser()->timeout(20_000);
```

The timeout is in milliseconds; every retrying assertion of the plugin waits up to that long.

- [ ] **Step 8: Build the assets**

Run: `npm run build`
Expected: `public/build/manifest.json` exists. (Skip when it was built in Task 1 and no file under `resources/` changed since.)

- [ ] **Step 9: Run the smoke tests and see them pass**

Run: `vendor/bin/pest tests/Browser/Smoke`
Expected: PASS, 5 tests (2 in `HarnessTest.php`, 3 in `AssetCheckTest.php`). If "keeps a guest context apart" fails on `assertPathIs('/login')`, see Task 1's findings (row a2).

- [ ] **Step 10: Check the fail-fast message by hand**

Run: `mv public/build public/build.off && vendor/bin/pest tests/Browser/Smoke/HarnessTest.php; mv public/build.off public/build`
Expected: both tests FAIL with "Browser tests need built assets: public/build/manifest.json is missing. Run `npm run build`, or run the suite with `composer test:browser`.", and `public/build` is back in place afterwards.

- [ ] **Step 11: Check the existing suite is unaffected**

Run: `php artisan test --compact tests/Feature/RequestIsolationTest.php tests/Feature/Auth`
Expected: PASS. No test under `tests/Browser` is listed.

- [ ] **Step 12: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining style issue.

- [ ] **Step 13: Commit**

```bash
git add tests/BrowserTestCase.php tests/Browser/Support/InteractsWithBrowser.php tests/Browser/Smoke/HarnessTest.php tests/Browser/Smoke/AssetCheckTest.php tests/Pest.php
git commit -m "test(browser): add the browser test case with real sign-in, guest join and request isolation"
```

### Task 3: Reverb lifecycle, `data-realtime`, realtime smoke test

**Files:**
- Create: `tests/Browser/Support/ReverbServer.php`
- Create: `resources/js/lib/realtime/realtime-state.ts`
- Modify: `tests/BrowserTestCase.php` (Reverb configuration, `ReverbServer::ensureRunning()`)
- Modify: `tests/Browser/Support/InteractsWithBrowser.php` (adds `awaitRealtime()`)
- Modify: `resources/js/components/retro/board.tsx` (root element gains `data-realtime`)
- Modify: `resources/js/components/poker/game.tsx` (root element gains `data-realtime`)
- Modify: `resources/js/components/games/game-room.tsx` (root element gains `data-realtime`)
- Test: `tests/Browser/Smoke/RealtimeTest.php`

**Interfaces:**
- Consumes: `Tests\BrowserTestCase`, `signIn()` (Task 2).
- Produces:
  - `Tests\Browser\Support\ReverbServer` with `public static function ensureRunning(): void`, `public static function start(): void`, `public static function stop(): void`, and the constants `Host` (`'127.0.0.1'`), `Port` (`8097`), `AppId`, `AppKey`, `AppSecret`.
  - `Tests\Browser\Support\InteractsWithBrowser::awaitRealtime(mixed $page): mixed`
  - `data-realtime="connecting"|"connected"` on the root `<div>` of the pages `retros/show`, `poker/show` and `games/show` (rendered by `Board`, `Game` and `GameRoom`). Selector for tests: `[data-realtime]`.

The three pages render one root component each (`resources/js/pages/retros/show.tsx` renders `Board`, `poker/show.tsx` renders `Game`, `games/show.tsx` renders `GameRoom`), so the attribute goes on those components' root `<div>`. The state hooks `useRetroBoard`, `usePokerGame` and `useGameRoom` already return `connected` (the socket is connected) and `online` (the presence members, filled when the presence subscription succeeds). The page is "connected" when both hold; no hook changes.

- [ ] **Step 1: Write the failing realtime smoke test**

Create `tests/Browser/Smoke/RealtimeTest.php`:

```php
<?php

use App\Models\PokerGame;
use App\Models\PokerTask;

it('shows one member a task another member adds, without a reload', function () {
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);
    [$member] = pokerMember($game);
    $facilitator->update(['locale' => 'en']);
    $member->update(['locale' => 'en']);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Existing story']);

    $facilitatorPage = $this->awaitRealtime($this->signIn($facilitator, "/poker/{$game->id}"));
    $memberPage = $this->awaitRealtime($this->signIn($member, "/poker/{$game->id}"));

    $facilitatorPage->click('Add task')
        ->fill('#poker-task-title', 'Realtime smoke story')
        ->click('Save');

    $memberPage->assertSee('Realtime smoke story');
});
```

One task exists beforehand so that the page shows a single "Add task" button (with no task, the empty table shows a second one).

- [ ] **Step 2: Run it and see it fail**

Run: `vendor/bin/pest tests/Browser/Smoke/RealtimeTest.php`
Expected: FAIL with "Call to undefined method" for `awaitRealtime`.

- [ ] **Step 3: Write `ReverbServer`**

Create `tests/Browser/Support/ReverbServer.php`:

```php
<?php

namespace Tests\Browser\Support;

use RuntimeException;
use Symfony\Component\Process\Process;

class ReverbServer
{
    public const string Host = '127.0.0.1';

    public const int Port = 8097;

    public const string AppId = 'skrum-browser';

    public const string AppKey = 'skrum-browser-key';

    public const string AppSecret = 'skrum-browser-secret';

    private const int StartTimeoutSeconds = 15;

    private const int StopTimeoutSeconds = 5;

    private static ?Process $process = null;

    private static bool $stopsAtShutdown = false;

    public static function ensureRunning(): void
    {
        if (self::isListening()) {
            return;
        }

        self::start();
    }

    public static function start(): void
    {
        if (self::isListening()) {
            return;
        }

        $port = self::Port;
        $host = self::Host;

        $process = new Process(
            [PHP_BINARY, 'artisan', 'reverb:start', "--host={$host}", "--port={$port}"],
            base_path(),
            [
                'REVERB_APP_ID' => self::AppId,
                'REVERB_APP_KEY' => self::AppKey,
                'REVERB_APP_SECRET' => self::AppSecret,
                'REVERB_SERVER_HOST' => $host,
                'REVERB_SERVER_PORT' => (string) $port,
                'REVERB_SCALING_ENABLED' => 'false',
            ],
        );
        $process->setTimeout(null);
        $process->start();

        self::$process = $process;
        self::stopAtShutdown();

        $deadline = microtime(true) + self::StartTimeoutSeconds;

        while (microtime(true) < $deadline && $process->isRunning()) {
            if (self::isListening()) {
                return;
            }

            usleep(100_000);
        }

        $output = trim("{$process->getOutput()}\n{$process->getErrorOutput()}");
        $seconds = self::StartTimeoutSeconds;

        self::stop();

        throw new RuntimeException("Reverb did not answer on {$host}:{$port} within {$seconds} seconds. Output of `php artisan reverb:start`:\n{$output}");
    }

    public static function stop(): void
    {
        $port = self::Port;

        if (self::$process === null) {
            throw_if(self::isListening(), RuntimeException::class, "A Reverb server this test run did not start is listening on port {$port}, so it cannot be stopped. Stop that process and run the suite again.");

            return;
        }

        self::$process->stop(self::StopTimeoutSeconds);
        self::$process = null;

        $deadline = microtime(true) + self::StopTimeoutSeconds;

        while (microtime(true) < $deadline && self::isListening()) {
            usleep(100_000);
        }
    }

    private static function isListening(): bool
    {
        $connection = @fsockopen(self::Host, self::Port, $errorCode, $errorMessage, 0.2);

        if ($connection === false) {
            return false;
        }

        fclose($connection);

        return true;
    }

    private static function stopAtShutdown(): void
    {
        if (self::$stopsAtShutdown) {
            return;
        }

        self::$stopsAtShutdown = true;

        register_shutdown_function(function (): void {
            if (self::$process !== null) {
                self::$process->stop(self::StopTimeoutSeconds);
            }
        });
    }
}
```

The child process inherits the test process's environment; the values passed here win over `.env`, because Laravel never overwrites an environment variable that is already set. A cached configuration (`bootstrap/cache/config.php`) would ignore them, which is why `composer test:browser` (Task 16) clears it first.

- [ ] **Step 4: Point the application at the test Reverb server**

Replace `tests/BrowserTestCase.php` with:

```php
<?php

namespace Tests;

use Illuminate\Foundation\Http\Events\RequestHandled;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Event;
use Tests\Browser\Support\InteractsWithBrowser;
use Tests\Browser\Support\ReverbServer;

abstract class BrowserTestCase extends TestCase
{
    use InteractsWithBrowser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withVite();

        $assetProblem = self::assetProblem(public_path());

        if ($assetProblem !== null) {
            $this->fail($assetProblem);
        }

        $this->configureBrowserEnvironment();

        ReverbServer::ensureRunning();

        $this->isolateRequests();
    }

    public static function assetProblem(string $publicPath): ?string
    {
        if (! is_file("{$publicPath}/build/manifest.json")) {
            return 'Browser tests need built assets: public/build/manifest.json is missing. Run `npm run build`, or run the suite with `composer test:browser`.';
        }

        if (is_file("{$publicPath}/hot")) {
            return 'Browser tests cannot use the Vite dev server: public/hot exists. Stop `npm run dev` (or delete public/hot), then run `npm run build`.';
        }

        return null;
    }

    private function configureBrowserEnvironment(): void
    {
        config([
            'app.locale' => 'en',
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => ReverbServer::AppKey,
            'broadcasting.connections.reverb.secret' => ReverbServer::AppSecret,
            'broadcasting.connections.reverb.app_id' => ReverbServer::AppId,
            'broadcasting.connections.reverb.client.host' => ReverbServer::Host,
            'broadcasting.connections.reverb.client.port' => ReverbServer::Port,
            'broadcasting.connections.reverb.client.scheme' => 'http',
            'broadcasting.connections.reverb.options.host' => ReverbServer::Host,
            'broadcasting.connections.reverb.options.port' => ReverbServer::Port,
            'broadcasting.connections.reverb.options.scheme' => 'http',
            'broadcasting.connections.reverb.options.useTLS' => false,
        ]);

        Broadcast::forgetDrivers();
    }

    /**
     * Every browser context is served by this one application instance, which
     * would otherwise hand the previous request's user and session attributes
     * to the next context.
     */
    private function isolateRequests(): void
    {
        Event::listen(RequestHandled::class, function (): void {
            resolve('auth')->forgetGuards();
            resolve('session')->driver()->flush();
            $this->app->forgetScopedInstances();
        });
    }
}
```

If Task 2 added `'session.driver' => 'database'` after Task 1's findings, keep that line in the `config([...])` call.

What each group of keys feeds: `key` and `client.*` are what `App\Support\ReverbClientConfig::toArray()` reads to build the page's `reverb-config` meta tag; `key`, `secret`, `app_id` and `options.*` are what the broadcaster, `BroadcastAuthorizationsController` and the presence rosters (`ReverbPokerPresenceRoster`, `ReverbGamePresenceRoster`) use to reach Reverb from PHP.

- [ ] **Step 5: Add `awaitRealtime()` to the trait**

In `tests/Browser/Support/InteractsWithBrowser.php`, add this method after `joinAsGuest()`:

```php
    protected function awaitRealtime(mixed $page): mixed
    {
        $page->assertAttribute('[data-realtime]', 'data-realtime', 'connected');

        return $page;
    }
```

- [ ] **Step 6: Run the smoke test and see it fail on the missing attribute**

Run: `vendor/bin/pest tests/Browser/Smoke/RealtimeTest.php`
Expected: FAIL after about 20 seconds on `assertAttribute`, because no element matches `[data-realtime]` yet. Reverb itself must have started: `lsof -i :8097` (or `ss -ltn | grep 8097`) shows nothing once the run has ended, and the failure message is not "Reverb did not answer".

- [ ] **Step 7: Add the realtime state helper**

Create `resources/js/lib/realtime/realtime-state.ts`:

```ts
export type RealtimeState = 'connecting' | 'connected';

/**
 * A page is connected once its socket is up and its presence channel has
 * answered with the members who are here, which always include the viewer.
 */
export function realtimeState(
    connected: boolean,
    online: readonly unknown[],
): RealtimeState {
    return connected && online.length > 0 ? 'connected' : 'connecting';
}
```

- [ ] **Step 8: Add `data-realtime` to the retro board**

In `resources/js/components/retro/board.tsx`, add the import next to the other `@/lib` imports:

```tsx
import { realtimeState } from '@/lib/realtime/realtime-state';
```

In the destructuring of `useRetroBoard(snapshot)`, add `connected` before `reconnecting`:

```tsx
        markCommentsRead,
        connected,
        reconnecting,
```

In the component's final `return`, replace the root element

```tsx
                <div className="flex min-h-dvh flex-col">
                    {sessionExpired && <SessionExpiredBanner />}
```

with:

```tsx
                <div
                    className="flex min-h-dvh flex-col"
                    data-realtime={realtimeState(connected, online)}
                >
                    {sessionExpired && <SessionExpiredBanner />}
```

- [ ] **Step 9: Add `data-realtime` to the poker game**

In `resources/js/components/poker/game.tsx`, add the import after the `PokerSnapshot` type import:

```tsx
import { realtimeState } from '@/lib/realtime/realtime-state';
```

In `Game`'s final `return`, replace

```tsx
            <div className="flex min-h-dvh flex-col">
                {game.sessionExpired && <SessionExpiredBanner />}
```

with:

```tsx
            <div
                className="flex min-h-dvh flex-col"
                data-realtime={realtimeState(game.connected, game.online)}
            >
                {game.sessionExpired && <SessionExpiredBanner />}
```

- [ ] **Step 10: Add `data-realtime` to the game room**

In `resources/js/components/games/game-room.tsx`, add the import after the `GameSnapshot` type import:

```tsx
import { realtimeState } from '@/lib/realtime/realtime-state';
```

In `GameRoom`'s final `return`, replace

```tsx
            <div className="flex min-h-dvh flex-col">
                {room.sessionExpired && <SessionExpiredBanner />}
```

with:

```tsx
            <div
                className="flex min-h-dvh flex-col"
                data-realtime={realtimeState(room.connected, room.online)}
            >
                {room.sessionExpired && <SessionExpiredBanner />}
```

- [ ] **Step 11: Check types and lint, then rebuild**

Run: `npm run types:check`
Expected: no error.

Run: `npm run check`
Expected: no error (run `npm run check:fix` if only formatting is reported, then rerun).

Run: `npm run build`
Expected: the build finishes; `public/build/manifest.json` is rewritten.

- [ ] **Step 12: Run the smoke tests and see them pass**

Run: `vendor/bin/pest tests/Browser/Smoke`
Expected: PASS, 6 tests. If `RealtimeTest` fails on the member's `assertSee`, see Task 1's findings (row b).

- [ ] **Step 13: Check the failure mode of a Reverb that cannot start**

In `tests/Browser/Support/ReverbServer.php`, temporarily change `'reverb:start'` to `'reverb:nope'` in the `Process` arguments.

Run: `vendor/bin/pest tests/Browser/Smoke/RealtimeTest.php`
Expected: FAIL at once (well before 15 seconds) with "Reverb did not answer on 127.0.0.1:8097 within 15 seconds. Output of `php artisan reverb:start`:" followed by Artisan's error that the command "reverb:nope" is not defined.

Change `'reverb:nope'` back to `'reverb:start'`, then run: `grep -c "reverb:start" tests/Browser/Support/ReverbServer.php`
Expected: `2` (the argument and the failure message). Rerun Step 12 to confirm the suite is green again.

- [ ] **Step 14: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining style issue.

- [ ] **Step 15: Commit**

```bash
git add tests/BrowserTestCase.php tests/Browser/Support/ReverbServer.php tests/Browser/Support/InteractsWithBrowser.php tests/Browser/Smoke/RealtimeTest.php resources/js/lib/realtime/realtime-state.ts resources/js/components/retro/board.tsx resources/js/components/poker/game.tsx resources/js/components/games/game-room.tsx
git commit -m "test(browser): run a real Reverb server and expose the realtime state of the live pages"
```

### Task 4: Keyboard drag-and-drop helper

**Files:**
- Modify: `tests/Browser/Support/InteractsWithBrowser.php` (adds `dragWithKeyboard()`)
- Test: `tests/Browser/Smoke/KeyboardDragTest.php`

**Interfaces:**
- Consumes: `signIn()` (Task 2), `awaitRealtime()` (Task 3).
- Produces: `Tests\Browser\Support\InteractsWithBrowser::dragWithKeyboard(mixed $page, string $handleSelector, array $keys): mixed`. `$keys` are Playwright key names; the first key picks the item up (`'Space'` or `'Enter'`), the last one drops it (`'Space'` or `'Enter'`) or cancels (`'Escape'`), the keys in between are arrows (`'ArrowUp'`, `'ArrowDown'`, `'ArrowLeft'`, `'ArrowRight'`). `$handleSelector` must match exactly one element.

No `data-test` attribute is needed. The poker task row's handle is a `<button aria-label="Drag to reorder">` inside the row's `<li>` (`resources/js/components/poker/tasks-pane.tsx`), so one row's handle is `li:has-text("<task title>") [aria-label="Drag to reorder"]`. The retro cards (`SortableCard` and `GroupableCard` in `resources/js/components/retro/dnd.tsx`) have no separate handle: the card's wrapper `<div>` is the draggable and receives the keys; the retro walkthrough task adds its own `data-test` for it.

- [ ] **Step 1: Write the failing test**

Create `tests/Browser/Smoke/KeyboardDragTest.php`:

```php
<?php

use App\Models\PokerGame;
use App\Models\PokerTask;

it('reorders poker tasks with the keyboard and keeps the new order', function () {
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);
    [$member] = pokerMember($game);
    $facilitator->update(['locale' => 'en']);
    $member->update(['locale' => 'en']);

    foreach (['Alpha story', 'Bravo story', 'Charlie story'] as $title) {
        PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => $title]);
    }

    $positionOfAlpha = 'Array.from(document.querySelectorAll("ol li")).findIndex((row) => row.textContent.includes("Alpha story"))';
    $facilitatorPage = $this->awaitRealtime($this->signIn($facilitator, "/poker/{$game->id}"));
    $memberPage = $this->awaitRealtime($this->signIn($member, "/poker/{$game->id}"));
    $facilitatorPage->assertScript($positionOfAlpha, 0);

    $this->dragWithKeyboard(
        $facilitatorPage,
        'li:has-text("Alpha story") [aria-label="Drag to reorder"]',
        ['Space', 'ArrowDown', 'Space'],
    );

    $memberPage->assertScript($positionOfAlpha, 1);
    $facilitatorPage->navigate("/poker/{$game->id}")->assertScript($positionOfAlpha, 1);
});
```

The member's page only changes when the server has saved the order and broadcast it, so its assertion is also the wait that makes the facilitator's reload safe.

- [ ] **Step 2: Run it and see it fail**

Run: `vendor/bin/pest tests/Browser/Smoke/KeyboardDragTest.php`
Expected: FAIL with "Call to undefined method" for `dragWithKeyboard`.

- [ ] **Step 3: Implement `dragWithKeyboard()`**

In `tests/Browser/Support/InteractsWithBrowser.php`, add this method after `awaitRealtime()`:

```php
    /**
     * @param  array<int, string>  $keys
     */
    protected function dragWithKeyboard(mixed $page, string $handleSelector, array $keys): mixed
    {
        $pickUp = array_shift($keys);
        $drop = array_pop($keys);

        $page->keys($handleSelector, $pickUp);
        $page->assertAttribute($handleSelector, 'aria-pressed', 'true');

        foreach ($keys as $key) {
            $page->keys($handleSelector, $key);
        }

        $page->keys($handleSelector, $drop);
        $page->assertAttributeMissing($handleSelector, 'aria-pressed');

        return $page;
    }
```

`keys()` focuses the element and presses the key on it. dnd-kit marks the dragged element with `aria-pressed="true"`; waiting for it makes sure the sensor is listening before the arrows are sent, and waiting for it to go makes sure the drop was handled. If this fails, see Task 1's findings (row c).

- [ ] **Step 4: Run it and see it pass**

Run: `vendor/bin/pest tests/Browser/Smoke/KeyboardDragTest.php`
Expected: PASS, 1 test.

- [ ] **Step 5: Run the whole smoke folder twice**

Run: `vendor/bin/pest tests/Browser/Smoke && vendor/bin/pest tests/Browser/Smoke`
Expected: PASS twice, 7 tests each time.

- [ ] **Step 6: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining style issue.

- [ ] **Step 7: Commit**

```bash
git add tests/Browser/Support/InteractsWithBrowser.php tests/Browser/Smoke/KeyboardDragTest.php
git commit -m "test(browser): add the keyboard drag-and-drop helper"
```

### Task 5: Arch suite, the `php` preset and the browser source scan

**Files:**
- Create: `tests/Arch/ArchTest.php`
- Create: `tests/Arch/BrowserTestRulesTest.php`
- Modify: `phpunit.xml` (add the `Arch` test suite and a memory limit)
- Modify: `composer.json` (add the `test:arch` script)

**Interfaces:**
- Consumes: nothing from earlier tasks. `tests/Pest.php` is NOT changed: architecture tests and the source scan run on the default `PHPUnit\Framework\TestCase`; they need no application instance and no database.
- Produces: the `Arch` test suite (`vendor/bin/pest --testsuite=Arch`), the Composer script `composer test:arch`, and `tests/Arch/ArchTest.php`, to which Tasks 6 to 9 append expectations. Because `Arch` is a suite in `phpunit.xml`, `php artisan test` (and so `composer test`) runs it from this task on.

Ground truth for Tasks 5 to 9: the three presets and every candidate project rule were run once against the current code (probe run, file since deleted). Results, grouped by rule:

| Rule | Result today | Offenders |
|---|---|---|
| `php` preset | green | none |
| `security` preset: `md5` | red | `app/Support/Gifs/GifCatalog.php:62`, `app/Http/Controllers/EmojiDataController.php:52` |
| `security` preset: `sha1` | red | `app/Support/Integrations/InboundReachability.php:59`, `app/Jobs/Integrations/ApplyInboundIssueChanges.php:48` |
| `security` preset: `array_rand` | red | `app/Actions/Games/RevealGameHint.php:41` |
| `security` preset: `assert` | red | `app/Actions/Mcp/IssueMcpToken.php:34` |
| `laravel` preset: `App` has no enum outside `App\Enums` | red | `App\Mcp\McpFeature` |
| `laravel` preset: `App` has no `Throwable` outside `App\Exceptions` | red | 22 classes (table in Task 7) |
| `laravel` preset: `App\Listeners` have `handle` | red | `App\Listeners\QueueActionItemStatusPushes`, `App\Listeners\QueueWebhookEvents` |
| `laravel` preset: `App\Http` only used in `App\Http` and `App\Providers` | red | `EmojiDataController` used by `app/Actions/Retros/BuildBoardSnapshot.php:20` and `app/Actions/Games/BuildGameSnapshot.php:6` |
| `laravel` preset: controllers have no public method besides the CRUD ones | red | `EmojiDataController::emojibaseLocale` (static), `Games\GameDrawingOpsController::destroyLast` |
| `laravel` preset: every other expectation (34 of them) | green | none |
| Project rules 1, 2, 3, 5, 6, 7, 8 | green | none |
| Project rule 4 (`App\Actions` does not use `App\Http`) | red | the same two snapshot actions |
| Project rule 9 (no `final` class) | green when written with `->classes()` | none |

An architecture expectation stops at its first offender, so a red run names one file per expectation, not the whole list above.

- [ ] **Step 1: Add the `Arch` suite and the memory limit to `phpunit.xml`**

The architecture plugin loads the whole `app/` tree and runs out of memory at PHP's default 128M (measured: fatal at 128M, passes at 256M). Replace this block of `phpunit.xml`:

```xml
    <testsuites>
        <testsuite name="Unit">
            <directory>tests/Unit</directory>
        </testsuite>
        <testsuite name="Feature">
            <directory>tests/Feature</directory>
        </testsuite>
    </testsuites>
```

with:

```xml
    <testsuites>
        <testsuite name="Unit">
            <directory>tests/Unit</directory>
        </testsuite>
        <testsuite name="Feature">
            <directory>tests/Feature</directory>
        </testsuite>
        <testsuite name="Arch">
            <directory>tests/Arch</directory>
        </testsuite>
    </testsuites>
```

and add one line as the first child of the existing `<php>` element:

```xml
    <php>
        <ini name="memory_limit" value="512M"/>
        <env name="APP_ENV" value="testing"/>
```

- [ ] **Step 2: Add the `test:arch` Composer script**

In `composer.json`, inside `"scripts"`, add this entry directly after the `"test"` entry:

```json
        "test:arch": [
            "@php artisan config:clear --ansi",
            "pest --testsuite=Arch"
        ],
```

- [ ] **Step 3: Write the source scan test**

`php artisan make:test` only creates files under `tests/Feature` and `tests/Unit`, so create `tests/Arch/BrowserTestRulesTest.php` by hand:

```php
<?php

/**
 * @return array<int, string>
 */
function forbiddenBrowserTestCalls(string $directory): array
{
    if (! is_dir($directory)) {
        return [];
    }

    $forbiddenCalls = ['actingAs(', 'withCookie(', 'withCookies(', 'Event::fake()'];
    $offences = [];
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS));

    foreach ($files as $file) {
        if ($file->getExtension() !== 'php') {
            continue;
        }

        foreach (file($file->getPathname()) ?: [] as $index => $line) {
            foreach ($forbiddenCalls as $forbiddenCall) {
                if (str_contains($line, $forbiddenCall)) {
                    $lineNumber = $index + 1;
                    $offences[] = "{$file->getPathname()}:{$lineNumber} calls {$forbiddenCall}";
                }
            }
        }
    }

    sort($offences);

    return $offences;
}

it('keeps browser tests free of actingAs, injected cookies and a blanket event fake', function () {
    expect(forbiddenBrowserTestCalls(dirname(__DIR__).'/Browser'))->toBe([]);
});
```

`Event::fake()` without arguments is forbidden because it removes the listener that `BrowserTestCase` registers to keep browser contexts apart (Task 2); `Event::fake([SomeEvent::class])` stays allowed.

- [ ] **Step 4: Run it and see it pass on the current tree**

Run: `vendor/bin/pest tests/Arch/BrowserTestRulesTest.php`
Expected: PASS, 1 test. It passes whether `tests/Browser` is missing, empty, or already holds the harness of Tasks 1 to 4.

- [ ] **Step 5: Prove the scan fails on a forbidden call**

```bash
mkdir -p tests/Browser
printf '<?php\n\nit("cheats", function () {\n    $this->actingAs(null);\n});\n' > tests/Browser/TmpForbiddenCallTest.php
vendor/bin/pest tests/Arch/BrowserTestRulesTest.php
```

Expected: FAIL with "Failed asserting that two arrays are identical." and a diff line ending in `tests/Browser/TmpForbiddenCallTest.php:4 calls actingAs(`.

- [ ] **Step 6: Remove the proof file and see the scan pass again**

```bash
rm tests/Browser/TmpForbiddenCallTest.php
rmdir tests/Browser 2>/dev/null || true
vendor/bin/pest tests/Arch/BrowserTestRulesTest.php
git status --short tests/Browser
```

Expected: PASS, and `git status` prints nothing new for `tests/Browser` (the `rmdir` only removes the folder when this step created it).

- [ ] **Step 7: Create the architecture test file with the preset that is already green**

Create `tests/Arch/ArchTest.php`:

```php
<?php

arch()->preset()->php();
```

- [ ] **Step 8: Run the suite and see it green**

Run: `composer test:arch`
Expected: PASS, 2 tests (the `php` preset and the source scan).

- [ ] **Step 9: Format and commit**

```bash
vendor/bin/pint --dirty --format agent
git add phpunit.xml composer.json tests/Arch/ArchTest.php tests/Arch/BrowserTestRulesTest.php
git commit -m "test(arch): add the Arch suite with the php preset and the browser source scan"
```

### Task 6: Security preset and the emoji locale helper

**Files:**
- Modify: `tests/Arch/ArchTest.php` (add the `security` preset and project rule 4)
- Modify: `app/Support/Gifs/GifCatalog.php` (line 62)
- Modify: `app/Support/Integrations/InboundReachability.php` (line 59)
- Modify: `app/Jobs/Integrations/ApplyInboundIssueChanges.php` (line 48)
- Modify: `app/Http/Controllers/EmojiDataController.php` (ETag, locale map, static helper removed)
- Modify: `app/Actions/Mcp/IssueMcpToken.php` (line 34)
- Modify: `app/Actions/Games/RevealGameHint.php` (line 41)
- Create: `app/Support/EmojibaseLocale.php`
- Modify: `app/Actions/Retros/BuildBoardSnapshot.php` (import and line 178)
- Modify: `app/Actions/Games/BuildGameSnapshot.php` (import and line 103)
- Test: `tests/Feature/EmojiDataTest.php` (two ETag assertions follow the new digest)

**Interfaces:**
- Consumes: `tests/Arch/ArchTest.php` and `composer test:arch` from Task 5.
- Produces: `App\Support\EmojibaseLocale` with `public const Locales` (`array<string, string>`, app locale to Emojibase locale) and `public static function forAppLocale(string $appLocale): string`. `EmojiDataController` keeps only `show()` as a public method.

What each digest is, so that nothing compared against an outside value is touched:

| Call site | What the value is | Compared with an external digest? | Change |
|---|---|---|---|
| `GifCatalog.php:62` `md5(mb_strtolower($query))` | suffix of a cache key | no | `hash('xxh128', …)` |
| `InboundReachability.php:59` `sha1($url)` | suffix of a cache key | no | `hash('xxh128', …)` |
| `ApplyInboundIssueChanges.php:48` `sha1(implode(',', $ids))` | suffix of the job's `uniqueId()` lock key (held at most 300 seconds) | no | `hash('xxh128', …)` |
| `EmojiDataController.php:52` `md5($body)` | the `ETag` response header, an opaque validator that only this controller produces; the URL is versioned and served `immutable` | no | `hash('xxh128', …)` |

The signature checks in `app/Support/Integrations/Inbound/ReadInboundEvent.php` use `hash_hmac('sha256', …)` and are not reported by the preset; they are not touched. The `sha1()` and `md5()` calls in `tests/Feature/Auth/EmailVerificationTest.php` and `tests/Feature/Auth/AuthenticationTest.php` mirror framework behaviour, live outside `app/`, and are not touched.

- [ ] **Step 1: Run the tests that cover the files this task touches, before any change**

Run:

```bash
vendor/bin/pest tests/Feature/Retros/GifsTest.php tests/Feature/Games/SprintGifSupportTest.php tests/Feature/Integrations/InboundReachabilityTest.php tests/Feature/Integrations/InboundWebhooksTest.php tests/Feature/EmojiDataTest.php tests/Feature/Mcp/IssueMcpTokenTest.php tests/Feature/Mcp/ApiTokensTest.php tests/Feature/Games/WordGuessPlayTest.php tests/Feature/Retros/BoardSnapshotTest.php tests/Feature/Games/DecodedClueTest.php tests/Feature/Games/GameSnapshotTest.php
```

Expected: PASS.

- [ ] **Step 2: Add the failing expectations**

Replace the content of `tests/Arch/ArchTest.php` with:

```php
<?php

arch()->preset()->php();

arch()->preset()->security();

arch('actions do not use the http layer')
    ->expect('App\Http')
    ->not->toBeUsedIn('App\Actions');
```

- [ ] **Step 3: Run it and see it fail**

Run: `composer test:arch`
Expected: FAIL, 2 failed. The `security` preset fails with "Expecting 'md5' not to be used on 'App\Support\Gifs\GifCatalog'." and the rule fails with "Expecting 'App\Http' not to be used in 'App\Actions'."

- [ ] **Step 4: Replace `md5` in the GIF search cache key**

In `app/Support/Gifs/GifCatalog.php`, replace:

```php
        $cacheKey = "gifs:search:{$this->providerName()}:{$rating}:".md5(mb_strtolower($query));
```

with:

```php
        $cacheKey = "gifs:search:{$this->providerName()}:{$rating}:".hash('xxh128', mb_strtolower($query));
```

- [ ] **Step 5: Replace `sha1` in the inbound reachability cache key**

In `app/Support/Integrations/InboundReachability.php`, replace:

```php
        $key = 'integrations:inbound-public:'.sha1($url);
```

with:

```php
        $key = 'integrations:inbound-public:'.hash('xxh128', $url);
```

- [ ] **Step 6: Replace `sha1` in the inbound job's uniqueness key**

In `app/Jobs/Integrations/ApplyInboundIssueChanges.php`, replace:

```php
        return $this->integrationId.':'.sha1(implode(',', $ids));
```

with:

```php
        return $this->integrationId.':'.hash('xxh128', implode(',', $ids));
```

- [ ] **Step 7: Replace `assert` in the token action**

In `app/Actions/Mcp/IssueMcpToken.php`, add `use LogicException;` to the imports (after `use Laravel\Sanctum\NewAccessToken;`), and replace:

```php
            assert($token instanceof PersonalAccessToken);
```

with:

```php
            throw_unless($token instanceof PersonalAccessToken, LogicException::class, 'Sanctum issued a token that is not a skrum personal access token.');
```

- [ ] **Step 8: Replace `array_rand` in the hint action**

In `app/Actions/Games/RevealGameHint.php`, add `use Illuminate\Support\Arr;` to the imports (before `use Illuminate\Support\Facades\DB;`), and replace:

```php
            $revealed[] = $hidden[array_rand($hidden)];
```

with:

```php
            $revealed[] = Arr::random($hidden);
```

- [ ] **Step 9: Create the emoji locale helper**

Run: `php artisan make:class Support/EmojibaseLocale --no-interaction`

Replace the content of `app/Support/EmojibaseLocale.php` with:

```php
<?php

namespace App\Support;

class EmojibaseLocale
{
    /** @var array<string, string> */
    public const array Locales = [
        'en' => 'en',
        'fr' => 'fr',
        'es' => 'es',
        'de' => 'de',
    ];

    public static function forAppLocale(string $appLocale): string
    {
        return self::Locales[$appLocale] ?? 'en';
    }
}
```

- [ ] **Step 10: Remove the helper from the controller and replace `md5` in the ETag**

In `app/Http/Controllers/EmojiDataController.php`:

Add the import `use App\Support\EmojibaseLocale;` as the first `use` line.

Delete this block (the constant, its docblock and the static method):

```php
    /** App locale => Emojibase locale. */
    public const EmojibaseLocales = [
        'en' => 'en',
        'fr' => 'fr',
        'es' => 'es',
        'de' => 'de',
    ];

```

```php
    public static function emojibaseLocale(string $appLocale): string
    {
        return self::EmojibaseLocales[$appLocale] ?? 'en';
    }

```

Replace:

```php
        abort_unless(in_array($locale, self::EmojibaseLocales, true), 404);
```

with:

```php
        abort_unless(in_array($locale, EmojibaseLocale::Locales, true), 404);
```

Replace:

```php
            'ETag' => '"'.md5($body).'"',
```

with:

```php
            'ETag' => '"'.hash('xxh128', $body).'"',
```

The class now starts like this:

```php
class EmojiDataController extends Controller
{
    private const array Files = ['data.json', 'messages.json'];

    private const MaxBytes = 10 * 1024 * 1024;

    public function show(string $version, string $locale, string $file): Response
    {
```

- [ ] **Step 11: Point the two snapshot actions at the helper**

In `app/Actions/Retros/BuildBoardSnapshot.php`, replace the import `use App\Http\Controllers\EmojiDataController;` with `use App\Support\EmojibaseLocale;`, and replace:

```php
                'locale' => EmojiDataController::emojibaseLocale(app()->getLocale()),
```

with:

```php
                'locale' => EmojibaseLocale::forAppLocale(app()->getLocale()),
```

Make the same two replacements in `app/Actions/Games/BuildGameSnapshot.php` (import on line 6, call on line 103).

- [ ] **Step 12: Update the two ETag assertions**

The ETag digest is the one observable value that changes. In `tests/Feature/EmojiDataTest.php`, replace:

```php
        ->assertHeader('ETag', '"'.md5('[{"emoji":"👍"}]').'"')
```

with:

```php
        ->assertHeader('ETag', '"'.hash('xxh128', '[{"emoji":"👍"}]').'"')
```

and replace:

```php
        ->assertHeader('ETag', '"'.md5('{"groups":[]}').'"');
```

with:

```php
        ->assertHeader('ETag', '"'.hash('xxh128', '{"groups":[]}').'"');
```

- [ ] **Step 13: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: imports are sorted; no other change.

- [ ] **Step 14: Run the architecture suite and see it green**

Run: `composer test:arch`
Expected: PASS, 4 tests.

- [ ] **Step 15: Run the covering feature tests and phpstan**

Run the command of Step 1 again, then `composer types:check`.
Expected: PASS for both. `tests/Feature/Retros/BoardSnapshotTest.php` ("points the emoji picker at the self-hosted emoji data in the viewer locale") and `tests/Feature/Games/DecodedClueTest.php` prove the locale helper still answers the same values.

- [ ] **Step 16: Commit**

```bash
git add tests/Arch/ArchTest.php tests/Feature/EmojiDataTest.php app/Support/EmojibaseLocale.php app/Support/Gifs/GifCatalog.php app/Support/Integrations/InboundReachability.php app/Jobs/Integrations/ApplyInboundIssueChanges.php app/Http/Controllers/EmojiDataController.php app/Actions/Mcp/IssueMcpToken.php app/Actions/Games/RevealGameHint.php app/Actions/Retros/BuildBoardSnapshot.php app/Actions/Games/BuildGameSnapshot.php
git commit -m "refactor: pass the security preset and move the emoji locale helper to App\Support"
```

### Task 7: Laravel preset, part 1: enum, exception and controller-method locations

**Files:**
- Modify: `tests/Arch/ArchTest.php` (add the `laravel` preset with a temporary `ignoring()` for the two listeners)
- Move: 22 exception classes and 1 enum (mapping table below)
- Modify: every file under `app/`, `tests/`, `database/`, `routes/`, `config/`, `bootstrap/` that imports one of the moved classes (done by the commands of Steps 4 to 6)
- Create: `app/Http/Controllers/Games/GameLastDrawingOpsController.php`
- Modify: `app/Http/Controllers/Games/GameDrawingOpsController.php` (remove `destroyLast`)
- Modify: `routes/web.php` (line 502 and one import)
- Modify: `resources/js/components/games/draw-board.tsx` (one import, one call)
- Test: the whole suite; no test file is edited by hand (imports are rewritten by Step 5)

**Interfaces:**
- Consumes: `tests/Arch/ArchTest.php` as left by Task 6.
- Produces: the namespaces `App\Exceptions\Integrations`, `App\Exceptions\Llm`, `App\Exceptions\Mcp`; `App\Enums\McpFeature`; `App\Http\Controllers\Games\GameLastDrawingOpsController::destroy()`. The route name `games.rounds.drawing-ops.last.destroy` and its URL are unchanged. Task 8 removes the temporary `ignoring()` this task adds.

Old to new mapping (23 classes; class names and bodies unchanged):

| # | Old | New |
|---|---|---|
| 1 | `App\Support\Integrations\Exceptions\AssigneeMappingUnavailable` | `App\Exceptions\Integrations\AssigneeMappingUnavailable` |
| 2 | `App\Support\Integrations\Exceptions\ConnectionRefused` | `App\Exceptions\Integrations\ConnectionRefused` |
| 3 | `App\Support\Integrations\Exceptions\IntegrationException` | `App\Exceptions\Integrations\IntegrationException` |
| 4 | `App\Support\Integrations\Exceptions\IssueCreationUncertain` | `App\Exceptions\Integrations\IssueCreationUncertain` |
| 5 | `App\Support\Integrations\Exceptions\NotConnected` | `App\Exceptions\Integrations\NotConnected` |
| 6 | `App\Support\Integrations\Exceptions\ProviderRejected` | `App\Exceptions\Integrations\ProviderRejected` |
| 7 | `App\Support\Integrations\Exceptions\ProviderUnavailable` | `App\Exceptions\Integrations\ProviderUnavailable` |
| 8 | `App\Support\Integrations\Exceptions\RateLimited` | `App\Exceptions\Integrations\RateLimited` |
| 9 | `App\Support\Integrations\Exceptions\ReadOnlyConnection` | `App\Exceptions\Integrations\ReadOnlyConnection` |
| 10 | `App\Support\Integrations\Exceptions\ReconnectRequired` | `App\Exceptions\Integrations\ReconnectRequired` |
| 11 | `App\Support\Integrations\Exceptions\StatusPushRejected` | `App\Exceptions\Integrations\StatusPushRejected` |
| 12 | `App\Support\Integrations\Exceptions\TelegramConflict` | `App\Exceptions\Integrations\TelegramConflict` |
| 13 | `App\Support\Integrations\Exceptions\UnresolvableWebhookHost` | `App\Exceptions\Integrations\UnresolvableWebhookHost` |
| 14 | `App\Support\Integrations\Exceptions\UnsafeWebhookUrl` | `App\Exceptions\Integrations\UnsafeWebhookUrl` |
| 15 | `App\Support\Integrations\Exceptions\WebhookContentMissing` | `App\Exceptions\Integrations\WebhookContentMissing` |
| 16 | `App\Support\Integrations\Exceptions\WebhookDisabled` | `App\Exceptions\Integrations\WebhookDisabled` |
| 17 | `App\Support\Integrations\Exceptions\WebhookGone` | `App\Exceptions\Integrations\WebhookGone` |
| 18 | `App\Support\Integrations\Inbound\InboundSignatureInvalid` | `App\Exceptions\Integrations\InboundSignatureInvalid` |
| 19 | `App\Support\Integrations\Trackers\EstimateRejected` | `App\Exceptions\Integrations\EstimateRejected` |
| 20 | `App\Support\Llm\InvalidLlmOutput` | `App\Exceptions\Llm\InvalidLlmOutput` |
| 21 | `App\Support\Llm\LlmUnavailable` | `App\Exceptions\Llm\LlmUnavailable` |
| 22 | `App\Mcp\Prompts\PromptToolFailed` | `App\Exceptions\Mcp\PromptToolFailed` |
| 23 | `App\Mcp\McpFeature` (enum) | `App\Enums\McpFeature` |

Checked before writing this task: no class name above appears as a string in `lang/`, `config/`, `bootstrap/`, `phpstan.neon`, `rector.php` or `pint.json`; none is referenced by an inline fully qualified name (only by `use` lines); `bootstrap/app.php` registers no `report`/`render` callback for any of them (`IntegrationException` renders itself through its own `render()` method, which moves with the class); no job stores one of these exceptions in its serialized payload. Five places write an exception's class name to a log line (`SkrumTool.php:75`, `SkrumPrompt.php:38`, `PollTelegramUpdates.php:44`, `GenerateRetroSummary.php:99`) or its base name to a delivery detail (`class_basename`, unchanged by a namespace move): the log lines will show the new namespace, and no test asserts them.

The word `ReconnectRequired` is also an enum case (`IntegrationStatus::ReconnectRequired`) used in about 20 files, so the rewrite below matches fully qualified names only, never bare class names.

- [ ] **Step 1: Run the whole suite before the move**

Run: `composer test`
Expected: PASS.

- [ ] **Step 2: Add the failing expectation**

Append to `tests/Arch/ArchTest.php` (after the `security` preset line, before the `arch('actions do not use the http layer')` test):

```php
arch()->preset()->laravel()->ignoring([
    'App\Listeners\QueueActionItemStatusPushes',
    'App\Listeners\QueueWebhookEvents',
]);
```

The two ignored classes are the multi-event listeners that Task 8 replaces; Task 8 deletes this `ignoring()`.

- [ ] **Step 3: Run it and see it fail**

Run: `composer test:arch`
Expected: FAIL, 1 failed, with "Expecting 'app/Mcp/McpFeature.php' not to be enum." (After the enum is moved the same test would report `app/Mcp/Prompts/PromptToolFailed.php` "not to implement 'Throwable'", then `GameDrawingOpsController.php` "not to have public methods besides …".)

- [ ] **Step 4: Move the files and rewrite their namespace lines**

```bash
mkdir -p app/Exceptions/Integrations app/Exceptions/Llm app/Exceptions/Mcp
for file in app/Support/Integrations/Exceptions/*.php; do git mv "$file" app/Exceptions/Integrations/; done
rmdir app/Support/Integrations/Exceptions
git mv app/Support/Integrations/Inbound/InboundSignatureInvalid.php app/Exceptions/Integrations/InboundSignatureInvalid.php
git mv app/Support/Integrations/Trackers/EstimateRejected.php app/Exceptions/Integrations/EstimateRejected.php
git mv app/Support/Llm/InvalidLlmOutput.php app/Exceptions/Llm/InvalidLlmOutput.php
git mv app/Support/Llm/LlmUnavailable.php app/Exceptions/Llm/LlmUnavailable.php
git mv app/Mcp/Prompts/PromptToolFailed.php app/Exceptions/Mcp/PromptToolFailed.php
git mv app/Mcp/McpFeature.php app/Enums/McpFeature.php

sed -i '' -E 's/^namespace App\\Support\\Integrations\\(Exceptions|Inbound|Trackers);/namespace App\\Exceptions\\Integrations;/' app/Exceptions/Integrations/*.php
sed -i '' 's/^namespace App\\Support\\Llm;/namespace App\\Exceptions\\Llm;/' app/Exceptions/Llm/*.php
sed -i '' 's/^namespace App\\Mcp\\Prompts;/namespace App\\Exceptions\\Mcp;/' app/Exceptions/Mcp/PromptToolFailed.php
sed -i '' 's/^namespace App\\Mcp;/namespace App\\Enums;/' app/Enums/McpFeature.php
```

Check: `grep -L '^namespace App\\Exceptions\\' app/Exceptions/Integrations/*.php app/Exceptions/Llm/*.php app/Exceptions/Mcp/*.php` prints nothing, and `grep -c '^namespace App\\Enums;' app/Enums/McpFeature.php` prints `1`.

- [ ] **Step 5: Rewrite every import of a moved class**

```bash
rewrite() {
    grep -rl --include='*.php' -F "$1" app tests database routes config bootstrap | while read -r file; do
        OLD="$1" NEW="$2" perl -pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/g' "$file"
    done
}

rewrite 'App\Support\Integrations\Exceptions\' 'App\Exceptions\Integrations\'
rewrite 'App\Support\Integrations\Inbound\InboundSignatureInvalid' 'App\Exceptions\Integrations\InboundSignatureInvalid'
rewrite 'App\Support\Integrations\Trackers\EstimateRejected' 'App\Exceptions\Integrations\EstimateRejected'
rewrite 'App\Support\Llm\InvalidLlmOutput' 'App\Exceptions\Llm\InvalidLlmOutput'
rewrite 'App\Support\Llm\LlmUnavailable' 'App\Exceptions\Llm\LlmUnavailable'
rewrite 'App\Mcp\Prompts\PromptToolFailed' 'App\Exceptions\Mcp\PromptToolFailed'
rewrite 'App\Mcp\McpFeature' 'App\Enums\McpFeature'
```

The values travel through environment variables so that Perl does not read `\E`, `\L` or `\M` in the namespaces as escape sequences.

Check: `grep -rnF -e 'App\Support\Integrations\Exceptions' -e 'App\Mcp\McpFeature' -e 'App\Support\Llm\LlmUnavailable' -e 'App\Support\Llm\InvalidLlmOutput' -e 'Inbound\InboundSignatureInvalid' -e 'Trackers\EstimateRejected' -e 'Prompts\PromptToolFailed' app tests database routes config bootstrap` prints nothing.

- [ ] **Step 6: Add the imports that used to be implicit**

Fourteen files referenced a moved class without a `use` line because they shared its namespace. Add the import after each file's `namespace` line:

```bash
import() {
    IMPORT="use $1;" perl -0pi -e 's/^(namespace [^;]+;\n\n)/$1$ENV{IMPORT}\n/m' "${@:2}"
}

import 'App\Exceptions\Llm\LlmUnavailable' app/Support/Llm/LlmCall.php app/Support/Llm/AnthropicClient.php app/Support/Llm/Llm.php app/Support/Llm/OpenAiCompatibleClient.php app/Support/Llm/LlmClient.php
import 'App\Exceptions\Integrations\EstimateRejected' app/Support/Integrations/Trackers/IssueTracker.php app/Support/Integrations/Trackers/JiraIssueTracker.php app/Support/Integrations/Trackers/LinearTracker.php app/Support/Integrations/Trackers/GitHubTracker.php
import 'App\Exceptions\Integrations\InboundSignatureInvalid' app/Support/Integrations/Inbound/ReadInboundEvent.php
import 'App\Exceptions\Mcp\PromptToolFailed' app/Mcp/Prompts/SkrumPrompt.php app/Mcp/Prompts/AnalyzeRetro.php app/Mcp/Prompts/TeamHealth.php
import 'App\Mcp\McpTrackers' app/Enums/McpFeature.php
```

`app/Enums/McpFeature.php` must now read:

```php
<?php

namespace App\Enums;

use App\Mcp\McpTrackers;
use App\Support\Llm\Llm;

enum McpFeature
{
    case Insights;
    case Trackers;

    public function isAvailable(): bool
    {
        return match ($this) {
            self::Insights => resolve(Llm::class)->isConfigured(),
            self::Trackers => resolve(McpTrackers::class)->available(),
        };
    }
}
```

- [ ] **Step 7: Rebuild the autoloader and format**

```bash
composer dump-autoload
vendor/bin/pint --dirty --format agent
```

Expected: `dump-autoload` ends with "Generated optimized autoload files"; Pint re-sorts the rewritten imports and adds the blank line after the import block in `app/Support/Llm/Llm.php` and `app/Support/Llm/LlmClient.php` (they had no import before).

- [ ] **Step 8: Run phpstan**

Run: `composer types:check`
Expected: "[OK] No errors". An "unknown class" error here names a file that still needs an import; add `use <new fully qualified name>;` to it and rerun.

- [ ] **Step 9: Create the controller for the "undo last drawing operation" action**

`GameDrawingOpsController::destroyLast()` is the only non-CRUD public controller method in the application. Run:

`php artisan make:controller Games/GameLastDrawingOpsController --no-interaction`

Replace the content of `app/Http/Controllers/Games/GameLastDrawingOpsController.php` with:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\UndoDrawingOp;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameLastDrawingOpsController extends Controller
{
    public function destroy(Request $request, GameRoom $room, GameRound $round, UndoDrawingOp $undoDrawingOp): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-draw:{$player->id}", GameDrawingOpsController::RateLimitPerSecond, GameDrawingOpsController::SecondsPerDrawingToken);

        return response()->json($undoDrawingOp->handle($room, $round, $player));
    }
}
```

- [ ] **Step 10: Remove `destroyLast` from the old controller**

In `app/Http/Controllers/Games/GameDrawingOpsController.php`, delete the import `use App\Actions\Games\UndoDrawingOp;` and delete this method (with the blank line before it):

```php
    public function destroyLast(Request $request, GameRoom $room, GameRound $round, UndoDrawingOp $undoDrawingOp): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-draw:{$player->id}", self::RateLimitPerSecond, self::SecondsPerDrawingToken);

        return response()->json($undoDrawingOp->handle($room, $round, $player));
    }
```

- [ ] **Step 11: Point the route at the new controller**

In `routes/web.php`, add `use App\Http\Controllers\Games\GameLastDrawingOpsController;` after the line `use App\Http\Controllers\Games\GameHostsController;`, and replace:

```php
        Route::delete('rounds/{round}/drawing-ops/last', [GameDrawingOpsController::class, 'destroyLast'])->name('games.rounds.drawing-ops.last.destroy')->whereUuid('round');
```

with:

```php
        Route::delete('rounds/{round}/drawing-ops/last', [GameLastDrawingOpsController::class, 'destroy'])->name('games.rounds.drawing-ops.last.destroy')->whereUuid('round');
```

- [ ] **Step 12: Update the one frontend caller**

In `resources/js/components/games/draw-board.tsx`, add this import after the `GameDrawingsController` import on line 3:

```tsx
import GameLastDrawingOpsController from '@/actions/App/Http/Controllers/Games/GameLastDrawingOpsController';
```

and in the `undo` function replace:

```tsx
                    GameDrawingOpsController.destroyLast({
```

with:

```tsx
                    GameLastDrawingOpsController.destroy({
```

- [ ] **Step 13: Regenerate the Wayfinder actions and check the frontend**

```bash
npm run build
npm run types:check
npm run check
```

Expected: all three succeed. The build runs the Wayfinder Vite plugin, which generates `resources/js/actions/App/Http/Controllers/Games/GameLastDrawingOpsController.ts` (a git-ignored file).

- [ ] **Step 14: Format, then run the architecture suite and see it green**

```bash
vendor/bin/pint --dirty --format agent
composer test:arch
```

Expected: PASS, 5 tests.

- [ ] **Step 15: Run the whole suite**

Run: `composer test`
Expected: PASS (Pint check, phpstan, Unit, Feature, Arch). `tests/Feature/Games/DrawingTest.php` ("undoes the last operation and frees its points", "ignores an undo on an empty drawing", "keeps drawing to the drawer") covers the moved controller method through its unchanged route name; `tests/Feature/Mcp/ToolBaseTest.php` covers `McpFeature`.

- [ ] **Step 16: Commit**

```bash
git add -A app tests database routes resources/js/components/games/draw-board.tsx
git commit -m "refactor: move exceptions to App\Exceptions, McpFeature to App\Enums and the drawing undo to its own controller"
```

### Task 8: Laravel preset, part 2: one listener per event

**Files:**
- Modify: `tests/Arch/ArchTest.php` (remove the temporary `ignoring()`)
- Create: `app/Actions/Integrations/QueueWebhookEvent.php`
- Create: `app/Actions/Integrations/QueueActionItemStatusPushes.php`
- Create: `app/Listeners/QueueRetroCompletedWebhookEvent.php`
- Create: `app/Listeners/QueueActionItemCreatedWebhookEvent.php`
- Create: `app/Listeners/QueueActionItemCompletedWebhookEvent.php`
- Create: `app/Listeners/QueueActionItemReopenedWebhookEvent.php`
- Create: `app/Listeners/QueuePokerTaskEstimatedWebhookEvent.php`
- Create: `app/Listeners/QueueCompletedActionItemStatusPushes.php`
- Create: `app/Listeners/QueueReopenedActionItemStatusPushes.php`
- Delete: `app/Listeners/QueueWebhookEvents.php`, `app/Listeners/QueueActionItemStatusPushes.php`
- Modify: `app/Providers/AppServiceProvider.php` (remove seven `Event::listen` lines and seven imports)
- Test: `tests/Feature/Integrations/WebhookEventsTest.php`, `tests/Feature/Integrations/ActionItemStatusPushTest.php` (not edited)

**Interfaces:**
- Consumes: `App\Exceptions\Integrations\ReadOnlyConnection` from Task 7; `tests/Arch/ArchTest.php` as left by Task 7.
- Produces: `App\Actions\Integrations\QueueWebhookEvent::handle(Team $team, WebhookEvent $event, Model $subject, Closure $buildData): void`; `App\Actions\Integrations\QueueActionItemStatusPushes::handle(ActionItem $item, ActionItemEventOrigin $origin): void`; seven listeners, each with `handle(<Event> $event): void`.

Design notes:

- The preset asks only for a `handle` method; it asks for no name suffix. The new listeners keep the existing naming style (verb first, no `Listener` suffix).
- Registration changes from explicit to discovered. The application uses Laravel's default event discovery (`bootstrap/app.php` calls `Application::configure()`, which calls `withEvents()`), and discovery registers every public `handle*` method of a class in `app/Listeners` for the event type of its first parameter. The old classes named their methods `on…` precisely to stay out of discovery. With `handle` methods, discovery registers the new listeners by itself, so the seven `Event::listen` lines must be removed: keeping them would run every listener twice.
- No new test is needed. Each of the seven listeners has an existing test that fails if the listener is not registered, and several fail if it is registered twice (`->sole()`, `toHaveCount(2)`, `assertPushed(…, 1)`):

| Listener | Existing test that fails without it |
|---|---|
| `QueueActionItemCreatedWebhookEvent` | `WebhookEventsTest`: "sends action_item.created while the retro is still in Writing, with the item named" |
| `QueueActionItemCompletedWebhookEvent`, `QueueActionItemReopenedWebhookEvent` | `WebhookEventsTest`: "sends action_item.completed and action_item.reopened with origin and actor" |
| `QueueRetroCompletedWebhookEvent` | `WebhookEventsTest`: "sends retro.completed on each completion with the recap rules" |
| `QueuePokerTaskEstimatedWebhookEvent` | `WebhookEventsTest`: "sends poker.task.estimated when a card is set or changed, never on clear" |
| `QueueCompletedActionItemStatusPushes` | `ActionItemStatusPushTest`: "queues a push when a manager completes a synced item" |
| `QueueReopenedActionItemStatusPushes` | `ActionItemStatusPushTest`: "queues a push when a manager reopens a synced item" |

- [ ] **Step 1: Run the safety-net tests before the change**

Run: `vendor/bin/pest tests/Feature/Integrations/WebhookEventsTest.php tests/Feature/Integrations/ActionItemStatusPushTest.php tests/Feature/Integrations/WebhookRedeliveryTest.php tests/Feature/Integrations/StatusSyncSettingsTest.php tests/Feature/Poker/PokerEstimateTest.php tests/Feature/Retros/RetroCompletedTest.php tests/Feature/ActionItems/ActionItemActionsTest.php`
Expected: PASS.

- [ ] **Step 2: Remove the temporary `ignoring()`**

In `tests/Arch/ArchTest.php`, replace:

```php
arch()->preset()->laravel()->ignoring([
    'App\Listeners\QueueActionItemStatusPushes',
    'App\Listeners\QueueWebhookEvents',
]);
```

with:

```php
arch()->preset()->laravel();
```

- [ ] **Step 3: Run it and see it fail**

Run: `composer test:arch`
Expected: FAIL, 1 failed, with "Expecting 'app/Listeners/QueueActionItemStatusPushes.php' to have method [handle]."

- [ ] **Step 4: Create the action that queues one webhook event**

Run: `php artisan make:class Actions/Integrations/QueueWebhookEvent --no-interaction`

Replace the content of `app/Actions/Integrations/QueueWebhookEvent.php` with (the body is the old listener's private `queue()` and `subscribedWebhook()`, unchanged):

```php
<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\WebhookEvent;
use App\Jobs\Integrations\DeliverWebhookEvent;
use App\Models\IntegrationDelivery;
use App\Models\Team;
use App\Models\TeamIntegration;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Queues an automatic event for the team's generic webhook when that
 * webhook subscribed to it. A failure is reported, never thrown into the
 * request that raised the event.
 */
class QueueWebhookEvent
{
    public function __construct(private StoreWebhookPayload $storeWebhookPayload) {}

    /**
     * @param  Closure(): array<string, mixed>  $buildData
     */
    public function handle(Team $team, WebhookEvent $event, Model $subject, Closure $buildData): void
    {
        $integration = $this->subscribedWebhook($team, $event);

        if ($integration === null) {
            return;
        }

        $delivery = null;

        try {
            $data = $buildData();

            $occurredAt = now()->toIso8601ZuluString();

            $delivery = DB::transaction(function () use ($team, $integration, $event, $subject, $occurredAt, $data): IntegrationDelivery {
                $delivery = IntegrationDelivery::query()->create([
                    'team_id' => $team->id,
                    'channel' => IntegrationDeliveryChannel::Webhook,
                    'kind' => IntegrationDeliveryKind::Event,
                    'team_integration_id' => $integration->id,
                    'event' => $event->value,
                    'subject_type' => $subject->getMorphClass(),
                    'subject_id' => $subject->getKey(),
                    'requested_by_user_id' => null,
                    'status' => IntegrationDeliveryStatus::Queued,
                ]);

                $this->storeWebhookPayload->keepIfPossible($delivery, [
                    'id' => $delivery->id,
                    'event' => $event->value,
                    'occurredAt' => $occurredAt,
                    'data' => $data,
                ]);

                return $delivery;
            });

            dispatch(new DeliverWebhookEvent($delivery->id, $event->value, $occurredAt, $data, app()->getLocale()))->afterCommit();
        } catch (Throwable $exception) {
            report($exception);

            $delivery?->markFailed(__('The message could not be delivered.'));
        }
    }

    private function subscribedWebhook(Team $team, WebhookEvent $event): ?TeamIntegration
    {
        if (! IntegrationProvider::Webhook->isEnabled()) {
            return null;
        }

        $integration = $team->integration(IntegrationProvider::Webhook);

        if ($integration === null) {
            return null;
        }

        if (! $integration->isActive()) {
            return null;
        }

        $events = (array) $integration->setting('events', []);

        return in_array($event->value, $events, true) ? $integration : null;
    }
}
```

- [ ] **Step 5: Create the action that queues status pushes**

Run: `php artisan make:class Actions/Integrations/QueueActionItemStatusPushes --no-interaction`

Replace the content of `app/Actions/Integrations/QueueActionItemStatusPushes.php` with (the body is the old listener's private `queue()` and `queuePushes()`, unchanged):

```php
<?php

namespace App\Actions\Integrations;

use App\Actions\ActionItems\BroadcastActionItemChange;
use App\Enums\ActionItemEventOrigin;
use App\Exceptions\Integrations\ReadOnlyConnection;
use App\Jobs\Integrations\PushActionItemState;
use App\Models\ActionItem;
use Throwable;

/**
 * Spec 8 §5.6: every status change made in skrum is remembered on the
 * item's links (the conflict rule compares it) and pushed where the
 * connection syncs. Changes that came from the source are never pushed
 * back, which is what stops loops. A failure here is reported, never
 * thrown into the request that changed the item.
 */
class QueueActionItemStatusPushes
{
    public function __construct(private BroadcastActionItemChange $broadcast) {}

    public function handle(ActionItem $item, ActionItemEventOrigin $origin): void
    {
        if ($origin !== ActionItemEventOrigin::Skrum) {
            return;
        }

        try {
            $this->queuePushes($item);
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    private function queuePushes(ActionItem $item): void
    {
        $links = $item->externalLinks()->get();

        if ($links->isEmpty()) {
            return;
        }

        $item->externalLinks()->update(['local_state_changed_at' => now()]);
        $changed = false;

        foreach ($links as $link) {
            $integration = LinkStatusSync::integration($link, $item->team);

            if ($integration === null || ! $integration->isActive()) {
                continue;
            }

            if (! $integration->canWrite()) {
                $link->forceFill(['sync_error' => (new ReadOnlyConnection($integration->provider))->userMessage()])->save();
                $changed = true;

                continue;
            }

            $link->forceFill(['sync_error' => null])->save();
            dispatch(new PushActionItemState($link->id))->afterCommit();
            $changed = true;
        }

        if ($changed) {
            rescue(fn () => $this->broadcast->externalLinksChanged($item));
        }
    }
}
```

- [ ] **Step 6: Delete the two old listeners**

```bash
git rm app/Listeners/QueueWebhookEvents.php app/Listeners/QueueActionItemStatusPushes.php
```

- [ ] **Step 7: Create the five webhook listeners**

`app/Listeners/QueueRetroCompletedWebhookEvent.php`:

```php
<?php

namespace App\Listeners;

use App\Actions\Integrations\BuildWebhookEventData;
use App\Actions\Integrations\QueueWebhookEvent;
use App\Enums\WebhookEvent;
use App\Events\RetroCompleted;

class QueueRetroCompletedWebhookEvent
{
    public function __construct(
        private QueueWebhookEvent $queueWebhookEvent,
        private BuildWebhookEventData $buildWebhookEventData,
    ) {}

    public function handle(RetroCompleted $event): void
    {
        $retro = $event->retro;

        $this->queueWebhookEvent->handle($retro->team, WebhookEvent::RetroCompleted, $retro, fn (): array => $this->buildWebhookEventData->retroCompleted($retro));
    }
}
```

`app/Listeners/QueueActionItemCreatedWebhookEvent.php`:

```php
<?php

namespace App\Listeners;

use App\Actions\Integrations\BuildWebhookEventData;
use App\Actions\Integrations\QueueWebhookEvent;
use App\Enums\WebhookEvent;
use App\Events\ActionItems\ActionItemCreated;

class QueueActionItemCreatedWebhookEvent
{
    public function __construct(
        private QueueWebhookEvent $queueWebhookEvent,
        private BuildWebhookEventData $buildWebhookEventData,
    ) {}

    public function handle(ActionItemCreated $event): void
    {
        $item = $event->actionItem;

        $this->queueWebhookEvent->handle($item->team, WebhookEvent::ActionItemCreated, $item, fn (): array => $this->buildWebhookEventData->actionItemCreated($item));
    }
}
```

`app/Listeners/QueueActionItemCompletedWebhookEvent.php`:

```php
<?php

namespace App\Listeners;

use App\Actions\Integrations\BuildWebhookEventData;
use App\Actions\Integrations\QueueWebhookEvent;
use App\Enums\WebhookEvent;
use App\Events\ActionItems\ActionItemCompleted;

class QueueActionItemCompletedWebhookEvent
{
    public function __construct(
        private QueueWebhookEvent $queueWebhookEvent,
        private BuildWebhookEventData $buildWebhookEventData,
    ) {}

    public function handle(ActionItemCompleted $event): void
    {
        $item = $event->actionItem;

        $this->queueWebhookEvent->handle($item->team, WebhookEvent::ActionItemCompleted, $item, fn (): array => $this->buildWebhookEventData->actionItemStatusChanged($item, $event->origin, $event->actor));
    }
}
```

`app/Listeners/QueueActionItemReopenedWebhookEvent.php`:

```php
<?php

namespace App\Listeners;

use App\Actions\Integrations\BuildWebhookEventData;
use App\Actions\Integrations\QueueWebhookEvent;
use App\Enums\WebhookEvent;
use App\Events\ActionItems\ActionItemReopened;

class QueueActionItemReopenedWebhookEvent
{
    public function __construct(
        private QueueWebhookEvent $queueWebhookEvent,
        private BuildWebhookEventData $buildWebhookEventData,
    ) {}

    public function handle(ActionItemReopened $event): void
    {
        $item = $event->actionItem;

        $this->queueWebhookEvent->handle($item->team, WebhookEvent::ActionItemReopened, $item, fn (): array => $this->buildWebhookEventData->actionItemStatusChanged($item, $event->origin, $event->actor));
    }
}
```

`app/Listeners/QueuePokerTaskEstimatedWebhookEvent.php`:

```php
<?php

namespace App\Listeners;

use App\Actions\Integrations\BuildWebhookEventData;
use App\Actions\Integrations\QueueWebhookEvent;
use App\Enums\WebhookEvent;
use App\Events\Poker\PokerTaskEstimated;

class QueuePokerTaskEstimatedWebhookEvent
{
    public function __construct(
        private QueueWebhookEvent $queueWebhookEvent,
        private BuildWebhookEventData $buildWebhookEventData,
    ) {}

    public function handle(PokerTaskEstimated $event): void
    {
        $task = $event->task;

        $this->queueWebhookEvent->handle($task->game->team, WebhookEvent::PokerTaskEstimated, $task, fn (): array => $this->buildWebhookEventData->pokerTaskEstimated($task));
    }
}
```

- [ ] **Step 8: Create the two status-push listeners**

`app/Listeners/QueueCompletedActionItemStatusPushes.php`:

```php
<?php

namespace App\Listeners;

use App\Actions\Integrations\QueueActionItemStatusPushes;
use App\Events\ActionItems\ActionItemCompleted;

class QueueCompletedActionItemStatusPushes
{
    public function __construct(private QueueActionItemStatusPushes $queueActionItemStatusPushes) {}

    public function handle(ActionItemCompleted $event): void
    {
        $this->queueActionItemStatusPushes->handle($event->actionItem, $event->origin);
    }
}
```

`app/Listeners/QueueReopenedActionItemStatusPushes.php`:

```php
<?php

namespace App\Listeners;

use App\Actions\Integrations\QueueActionItemStatusPushes;
use App\Events\ActionItems\ActionItemReopened;

class QueueReopenedActionItemStatusPushes
{
    public function __construct(private QueueActionItemStatusPushes $queueActionItemStatusPushes) {}

    public function handle(ActionItemReopened $event): void
    {
        $this->queueActionItemStatusPushes->handle($event->actionItem, $event->origin);
    }
}
```

- [ ] **Step 9: Remove the explicit registration**

In `app/Providers/AppServiceProvider.php`, delete these seven imports:

```php
use App\Events\ActionItems\ActionItemCompleted;
use App\Events\ActionItems\ActionItemCreated;
use App\Events\ActionItems\ActionItemReopened;
use App\Events\Poker\PokerTaskEstimated;
use App\Events\RetroCompleted;
use App\Listeners\QueueActionItemStatusPushes;
use App\Listeners\QueueWebhookEvents;
```

and delete these seven lines of `boot()`:

```php
        Event::listen(RetroCompleted::class, [QueueWebhookEvents::class, 'onRetroCompleted']);
        Event::listen(ActionItemCreated::class, [QueueWebhookEvents::class, 'onActionItemCreated']);
        Event::listen(ActionItemCompleted::class, [QueueWebhookEvents::class, 'onActionItemCompleted']);
        Event::listen(ActionItemReopened::class, [QueueWebhookEvents::class, 'onActionItemReopened']);
        Event::listen(ActionItemCompleted::class, [QueueActionItemStatusPushes::class, 'onActionItemCompleted']);
        Event::listen(ActionItemReopened::class, [QueueActionItemStatusPushes::class, 'onActionItemReopened']);
        Event::listen(PokerTaskEstimated::class, [QueueWebhookEvents::class, 'onPokerTaskEstimated']);
```

The line `Event::listen(IntegrationActivated::class, fn (IntegrationActivated $event) => MatchIntegrationUsers::start($event->integration));` and the imports `IntegrationActivated`, `MatchIntegrationUsers` and `Event` stay.

- [ ] **Step 10: Check that discovery registers each listener exactly once**

```bash
composer dump-autoload
php artisan event:clear
php artisan event:list --event=ActionItem
php artisan event:list --event=RetroCompleted
php artisan event:list --event=PokerTaskEstimated
```

Expected, each listener once and with `@handle`:

- `App\Events\ActionItems\ActionItemCompleted`: `QueueActionItemCompletedWebhookEvent@handle` and `QueueCompletedActionItemStatusPushes@handle`
- `App\Events\ActionItems\ActionItemCreated`: `QueueActionItemCreatedWebhookEvent@handle`
- `App\Events\ActionItems\ActionItemReopened`: `QueueActionItemReopenedWebhookEvent@handle` and `QueueReopenedActionItemStatusPushes@handle`
- `App\Events\RetroCompleted`: `QueueRetroCompletedWebhookEvent@handle`
- `App\Events\Poker\PokerTaskEstimated`: `QueuePokerTaskEstimatedWebhookEvent@handle`

- [ ] **Step 11: Format, then run the architecture suite and see it green**

```bash
vendor/bin/pint --dirty --format agent
composer test:arch
```

Expected: PASS, 5 tests, with the `laravel` preset no longer ignoring anything.

- [ ] **Step 12: Run the safety-net tests and phpstan**

Run the command of Step 1 again, then `composer types:check`.
Expected: PASS for both, with no edit to any test file.

- [ ] **Step 13: Commit**

```bash
git add -A app/Listeners app/Actions/Integrations/QueueWebhookEvent.php app/Actions/Integrations/QueueActionItemStatusPushes.php app/Providers/AppServiceProvider.php tests/Arch/ArchTest.php
git commit -m "refactor(listeners): split the multi-event listeners into one discovered listener per event"
```

### Task 9: Project rules

**Files:**
- Modify: `tests/Arch/ArchTest.php` (add the rules of spec §5.2)

**Interfaces:**
- Consumes: `tests/Arch/ArchTest.php` as left by Task 8 (three presets and the rule `actions do not use the http layer`, which is spec rule 4, added in Task 6); `App\Enums\McpFeature` from Task 7.
- Produces: the final `tests/Arch/ArchTest.php`; `composer test:arch` and `composer test` green (acceptance criteria 6 and 7).

State of each rule (from the probe run, and for rule 1 from the code after Task 7):

| Rule | State | How it is written |
|---|---|---|
| 1. `App\Enums` uses nothing from `App` outside `App\Enums` | green today; after Task 7 one enum, `App\Enums\McpFeature`, uses `App\Support\Llm\Llm` and `App\Mcp\McpTrackers` | list of the other `App` namespaces, with `McpFeature` ignored and the reason in the test name |
| 2. `App\Models` does not use `App\Actions`, `App\Http`, `App\Mcp` | green | as is |
| 3. `App\Support`, `App\Jobs`, `App\Events` do not use `App\Http`, `App\Mcp` | green | as is |
| 4. `App\Actions` does not use `App\Http` | green since Task 6 | already in the file |
| 5. `App\Contracts` contains only interfaces | green (3 interfaces) | as is |
| 6. `App\Rules` classes implement `ValidationRule` | green (5 classes) | as is |
| 7. Every `Concerns` namespace contains only traits | green (`App\Concerns`, `App\Events\Concerns`, `App\Http\Controllers\Concerns`, `App\Mcp\Concerns`) | the four namespaces are listed |
| 8. `App\Mcp\Tools` classes extend `SkrumTool` | green (29 tools; the abstract base itself is accepted) | as is |
| 9. No class in `App` is `final` | green only with `->classes()`: Pest's `not->toBeFinal()` fails on every enum, because PHP enums are final by nature | with `->classes()` |

Two forms were tried and rejected because they pass on anything: `expect('App')->not->toBeUsedIn('App\Enums')->ignoring('App\Enums')` and `expect('App\Enums')->not->toUse('App')->ignoring('App\Enums')`. Ignoring a namespace removes it from both sides of the expectation, so nothing is left to check (verified: the same forms pass for `App\Actions`, which uses `App\Models` everywhere). Rule 1 is therefore written as an explicit list of namespaces.

- [ ] **Step 1: Write the rules**

Replace the content of `tests/Arch/ArchTest.php` with:

```php
<?php

arch()->preset()->php();

arch()->preset()->security();

arch()->preset()->laravel();

arch('enums use nothing from the application, except McpFeature which asks the container whether its feature is available')
    ->expect('App\Enums')
    ->not->toUse([
        'App\Actions',
        'App\Concerns',
        'App\Console',
        'App\Contracts',
        'App\Events',
        'App\Exceptions',
        'App\Http',
        'App\Jobs',
        'App\Listeners',
        'App\Mcp',
        'App\Models',
        'App\Notifications',
        'App\Policies',
        'App\Providers',
        'App\Rules',
        'App\Support',
    ])
    ->ignoring('App\Enums\McpFeature');

arch('models do not use actions, the http layer or the mcp layer')
    ->expect('App\Models')
    ->not->toUse(['App\Actions', 'App\Http', 'App\Mcp']);

arch('support classes, jobs and events do not use the http layer or the mcp layer')
    ->expect(['App\Support', 'App\Jobs', 'App\Events'])
    ->not->toUse(['App\Http', 'App\Mcp']);

arch('actions do not use the http layer')
    ->expect('App\Http')
    ->not->toBeUsedIn('App\Actions');

arch('contracts are interfaces')
    ->expect('App\Contracts')
    ->toBeInterfaces();

arch('validation rules implement ValidationRule')
    ->expect('App\Rules')
    ->classes()
    ->toImplement('Illuminate\Contracts\Validation\ValidationRule');

arch('concerns are traits')
    ->expect([
        'App\Concerns',
        'App\Events\Concerns',
        'App\Http\Controllers\Concerns',
        'App\Mcp\Concerns',
    ])
    ->toBeTraits();

arch('mcp tools extend SkrumTool')
    ->expect('App\Mcp\Tools')
    ->classes()
    ->toExtend('App\Mcp\Tools\SkrumTool');

arch('no class is final')
    ->expect('App')
    ->classes()
    ->not->toBeFinal();
```

- [ ] **Step 2: Run it and see it green**

Run: `composer test:arch`
Expected: PASS, 13 tests (three presets, nine rules, the source scan). If "models do not use…" or "support classes, jobs and events do not use…" fails, see the note on these two forms in "Notes for the lead"; the equivalent probed forms are given there.

- [ ] **Step 3: Prove that a rule can fail**

A rule that cannot fail proves nothing. Stage the file, then temporarily break rule 1: in `tests/Arch/ArchTest.php`, delete the line `    ->ignoring('App\Enums\McpFeature');` and end the previous line (`    ])`) with a semicolon. Then:

```bash
git add tests/Arch/ArchTest.php
composer test:arch
git checkout tests/Arch/ArchTest.php
```

Run `git add` BEFORE making the temporary edit, so that `git checkout` restores the version of Step 1.

Expected from `composer test:arch`: FAIL, 1 failed, with "Expecting 'App\Enums' not to use 'App\Mcp'." (or `'App\Support'`). After the `git checkout`, `composer test:arch` passes again.

- [ ] **Step 4: Format and run the full suite**

```bash
vendor/bin/pint --dirty --format agent
composer test
```

Expected: PASS. Pint check, phpstan, then the Unit, Feature and Arch suites; no file under `tests/Browser` is run, because `tests/Browser` is not a suite in `phpunit.xml`.

- [ ] **Step 5: Commit**

```bash
git add tests/Arch/ArchTest.php
git commit -m "test(arch): add the project layering rules"
```

### Task 10: Poker core walkthrough, steps 1 to 9 (team page to estimate)

This task automates steps 1 to 9 of the plan 10a walkthrough (`docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md`, lines 12535 to 12543). Step 7 asked for a look at the `vote.changed` websocket frame; the browser plugin cannot read frames, so the test asserts that the value never appears in the other player's table area, and payload redaction stays covered by `tests/Feature/Poker/PokerRedactionTest.php`. Step 5 asked to copy the link; the test reads it from the dialog's input.

Facts about the interface that the selectors rely on (all read from the current code):

- The tasks pane is rendered inside `<aside class="hidden … lg:flex">` (`resources/js/components/poker/game.tsx`), so the browser viewport must be at least 1024 px wide. Playwright's default of 1280 x 720 satisfies this.
- A hand card is `<button aria-label="Play 5">` (`hand.tsx`, `poker-card.tsx`); a seat's card on the table is `<div role="img" aria-label="Visitor: Voted">`, `"Visitor: Not voted yet"` or `"Visitor: 5"` inside `<section aria-label="Players">` (`players-grid.tsx`). These are unique, so they need no `data-test` hook.
- The facilitator menu trigger is `<button aria-label="Facilitator menu">` (`game-menu.tsx`).
- The plugin treats a selector that contains `(`, `:`, `,`, `=` or `[` as CSS. Text such as `Rounds (2)` therefore cannot be passed to `click()` as plain text; the tests use `button:has-text("Rounds (2)")`.
- The plugin retries only `assert*` calls, and only when they fail as an expectation. `click()`, `fill()` and `keys()` are not retried, and reading an attribute or a value of an element that does not exist yet raises a Playwright timeout that is not retried either. The tests therefore assert that an element is visible (or enabled) before they act on it or read from it.
- An explicit CSS selector or an `@name` selector is strict: outside `assertCount()`, `assertPresent()`, `assertNotPresent()` and `assertDontSeeIn()` (which only count), it must match exactly one element. Task rows share one hook, so a single row is always addressed by its title, `[data-test="poker-task-row"]:has-text("Export invoices")`, or by its state, `[data-test="poker-task-row"][aria-current="true"]`; the bare `@poker-task-row` is used only with `assertCount()`.

**Files:**
- Modify: `resources/js/components/poker/tasks-pane.tsx` (adds `data-test="poker-task-row"` to the task row)
- Create: `tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php`
- Test: `tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` bound to `tests/Browser` (Task 2), with `$this->signIn(User $user, string $to): mixed`, `$this->joinAsGuest(string $joinUrl, string $name): mixed`, `$this->awaitRealtime(mixed $page): mixed`, `$this->dragWithKeyboard(mixed $page, string $handleSelector, array $keys): mixed`.
  - `data-realtime` on the root of `poker/show` (Task 3).
  - Existing helpers in `tests/Pest.php`: `teamMember(Team $team): User`, `pokerMember(PokerGame $game): array{0: User, 1: PokerPlayer}`, `pokerFacilitator(PokerGame $game): array{0: User, 1: PokerPlayer}`, `openPokerRound(PokerGame $game, ?PokerTask $task = null): PokerRound`, `pokerVote(PokerRound $round, PokerPlayer $player, string $value): PokerVote`.
  - Factories: `PokerGameFactory::customCards(array $cards)`, `PokerTaskFactory::estimated(string $value = '5')`, `PokerRoundFactory::revealed()`.
- Produces:
  - `data-test="poker-task-row"` on the `<li>` of `TaskRow` in `resources/js/components/poker/tasks-pane.tsx`. The row keeps its `aria-current="true"` attribute when it is the current task. Selector in tests: `@poker-task-row`, or `[data-test="poker-task-row"]` when combined with other CSS.
  - File-level helpers in `tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php` (global functions, so later test files may call them but must not redeclare them): `p10aGame(array $attributes = []): PokerGame`, `p10aTeamMember(Team $team, string $name = 'Ada Facilitator'): User`, `p10aFacilitator(PokerGame $game, string $name = 'Ada Facilitator'): array`, `p10aMember(PokerGame $game, string $name): array`, `p10aTeamPath(Team $team): string`, `p10aTaskOrderScript(): string`, `p10aCurrentTaskScript(): string`.
  - Stable selectors that need no hook, for reuse by Tasks 13 and 14: hand card `[aria-label="Play <card>"]`; hand group `[aria-label="Your cards"]`; seat card `[aria-label="<player name>: Voted"]`, `[aria-label="<player name>: Not voted yet"]`, `[aria-label="<player name>: <value>"]`; table area `section[aria-label="Players"]`; result panel `[aria-labelledby="poker-result"]`; current task detail `section[aria-labelledby^="poker-task-"]`; facilitator menu `[aria-label="Facilitator menu"]`; presence avatars `img[data-presence-id]`; estimate select `[aria-label="Estimate"]`; facilitator toolbar `[aria-label="Facilitator tools"]`.

- [ ] **Step 1: Add the task-row hook**

In `resources/js/components/poker/tasks-pane.tsx`, inside `function TaskRow`, the returned `<li>` currently starts like this:

```tsx
        <li
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            data-dragging={isDragging}
            aria-current={isCurrent ? 'true' : undefined}
```

Change it to:

```tsx
        <li
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            data-test="poker-task-row"
            data-dragging={isDragging}
            aria-current={isCurrent ? 'true' : undefined}
```

- [ ] **Step 2: Check and rebuild the frontend**

Run: `npm run types:check`
Expected: no error.

Run: `npm run check`
Expected: only the known pre-existing findings in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`; nothing in `resources/js`.

Run: `npm run build`
Expected: the build succeeds. The browser suite serves `public/build`, so the hook is invisible to the tests until this build has run.

- [ ] **Step 3: Create the test file with its helpers and the team-page tests (steps 1 to 3)**

`php artisan make:test` only writes under `tests/Feature` or `tests/Unit`, so create `tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php` directly with this content:

```php
<?php

use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\PokerVote;
use App\Models\Team;
use App\Models\User;
use Tests\Browser\Support\ReverbServer;

/**
 * @param  array<string, mixed>  $attributes
 */
function p10aGame(array $attributes = []): PokerGame
{
    return PokerGame::factory()
        ->customCards(['1', '2', '3', '5', '8', '?', '☕'])
        ->create(['title' => 'Sprint 12 estimates', ...$attributes]);
}

function p10aTeamMember(Team $team, string $name = 'Ada Facilitator'): User
{
    $user = teamMember($team);

    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return $user;
}

/**
 * @return array{
 *     0: User,
 *     1: PokerPlayer
 * }
 */
function p10aFacilitator(PokerGame $game, string $name = 'Ada Facilitator'): array
{
    [$user, $player] = pokerFacilitator($game);

    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return [$user, $player];
}

/**
 * @return array{
 *     0: User,
 *     1: PokerPlayer
 * }
 */
function p10aMember(PokerGame $game, string $name): array
{
    [$user, $player] = pokerMember($game);

    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return [$user, $player];
}

function p10aTeamPath(Team $team): string
{
    return route('teams.show', [$team->workspace, $team], false);
}

function p10aTaskOrderScript(): string
{
    return 'Array.from(document.querySelectorAll(\'[data-test="poker-task-row"]\')).map(function (row) { return row.querySelector("span span").textContent; }).join(" / ")';
}

function p10aCurrentTaskScript(): string
{
    return 'document.querySelector(\'[data-test="poker-task-row"][aria-current="true"] span span\').textContent';
}

it('[P10a-01] shows the planning poker section under the retrospectives on the team page', function () {
    $team = Team::factory()->create();
    $ada = p10aTeamMember($team);

    $page = $this->signIn($ada, p10aTeamPath($team));

    $page->assertSee('No retrospectives yet.')
        ->assertSee('Planning poker')
        ->assertSee('New game')
        ->assertSee('Estimation history')
        ->assertSee('No games yet.')
        ->assertScript('document.body.innerText.indexOf("No retrospectives yet.") < document.body.innerText.indexOf("Planning poker")', true);
});

it('[P10a-02] creates a game with a custom deck and opens it', function () {
    $team = Team::factory()->create();
    $ada = p10aTeamMember($team);

    $page = $this->signIn($ada, p10aTeamPath($team));

    $page->assertSee('New game')
        ->click('New game')
        ->assertVisible('#new-poker-title')
        ->assertScript('document.querySelector("#new-poker-title").value === "Poker " + new Date().toLocaleDateString("en", { dateStyle: "medium" })', true)
        ->assertCount('[role="radio"]', 5)
        ->assertSee('Fibonacci')
        ->assertSee('Modified Fibonacci')
        ->assertSee('T-shirt sizes')
        ->assertSee('Powers of 2')
        ->assertSee('Custom')
        ->assertScript('Array.from(document.querySelectorAll(\'[role="radio"]\')[0].querySelectorAll("span span")).map(function (chip) { return chip.textContent; }).join(" ")', '0 1 2 3 5 8 13 21 34 55 89 ? ☕')
        ->click('[role="radio"]:has-text("Custom")')
        ->assertVisible('#deck-custom-cards')
        ->fill('#deck-custom-cards', '1, 2, 3, 5, 8')
        ->assertSee('Add ?')
        ->assertSee('Add ☕')
        ->assertAttribute('#deck-include-unknown', 'aria-checked', 'true')
        ->assertAttribute('#deck-include-coffee', 'aria-checked', 'true')
        ->fill('#new-poker-title', 'Sprint 12 estimates')
        ->click('Create game')
        ->assertPathBeginsWith('/poker/');

    $game = PokerGame::query()->sole();

    $page->assertPathIs("/poker/{$game->id}")
        ->assertVisible('[aria-label="Game title"]')
        ->assertValue('[aria-label="Game title"]', 'Sprint 12 estimates')
        ->assertSee('Custom')
        ->assertVisible('[aria-label="Facilitator menu"]')
        ->assertSee('Add the first task')
        ->assertCount('[aria-label="Your cards"] button', 7);

    expect($game->cards)->toBe(['1', '2', '3', '5', '8', '?', '☕'])
        ->and($game->team_id)->toBe($team->id);
});

it('[P10a-03] rejects a custom deck with a repeated card or without an estimate card', function () {
    $team = Team::factory()->create();
    $ada = p10aTeamMember($team);

    $page = $this->signIn($ada, p10aTeamPath($team));

    $page->assertSee('New game')
        ->click('New game')
        ->assertVisible('[role="radio"]:has-text("Custom")')
        ->click('[role="radio"]:has-text("Custom")')
        ->assertVisible('#deck-custom-cards')
        ->fill('#deck-custom-cards', '3,  3')
        ->click('Create game')
        ->assertSee('Each card can appear only once.')
        ->fill('#deck-custom-cards', '?, ☕')
        ->click('Create game')
        ->assertSee('Add at least one card that can be an estimate.')
        ->click('Cancel')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('No games yet.');

    expect(PokerGame::query()->count())->toBe(0);
});
```

- [ ] **Step 4: Run the team-page tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php --filter='P10a-01|P10a-02|P10a-03'`
Expected: PASS (3 tests). A failure means a product defect or a wrong selector: fix the selector if the UI text differs, otherwise report the defect per the plan header's defect rule. If the validation messages of `[P10a-03]` never appear, see Task 1's findings on session flash data between two requests.

- [ ] **Step 5: Append the tests for tasks, the guest link and the guest join (steps 4 to 6)**

Append to `tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php`:

```php
it('[P10a-04a] adds tasks in order and renders their Markdown safely', function () {
    $game = p10aGame();
    [$ada] = p10aFacilitator($game);

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->assertSee('Add the first task')
        ->click('Add task')
        ->assertVisible('#poker-task-title')
        ->fill('#poker-task-title', 'Login page')
        ->fill('#poker-task-description', "**bold** and [the docs](https://example.com/docs)\n\n<script>alert(1)</script>")
        ->click('Save')
        ->assertCount('@poker-task-row', 1)
        ->click('Add task')
        ->assertVisible('#poker-task-title')
        ->fill('#poker-task-title', 'Password reset')
        ->click('Save')
        ->assertCount('@poker-task-row', 2)
        ->click('Add task')
        ->assertVisible('#poker-task-title')
        ->fill('#poker-task-title', 'Export invoices')
        ->click('Save')
        ->assertCount('@poker-task-row', 3)
        ->assertScript(p10aTaskOrderScript(), 'Login page / Password reset / Export invoices');

    $page->click('Login page')
        ->assertVisible('section[aria-labelledby^="poker-task-"] strong')
        ->assertScript('document.querySelector(\'section[aria-labelledby^="poker-task-"] strong\').textContent', 'bold')
        ->assertAttribute('section[aria-labelledby^="poker-task-"] a[href="https://example.com/docs"]', 'target', '_blank')
        ->assertAttributeContains('section[aria-labelledby^="poker-task-"] a[href="https://example.com/docs"]', 'rel', 'noopener')
        ->assertSee('<script>alert(1)</script>')
        ->assertScript('document.querySelectorAll(\'section[aria-labelledby^="poker-task-"] script\').length', 0);

    expect(PokerTask::query()->where('poker_game_id', $game->id)->orderBy('position')->pluck('title')->all())
        ->toBe(['Login page', 'Password reset', 'Export invoices']);
});

it('[P10a-04b] moves a task to the top with the keyboard and keeps the order after a reload', function () {
    $game = p10aGame();
    [$ada] = p10aFacilitator($game);
    [$bob] = p10aMember($game, 'Bob Member');

    foreach (['Login page', 'Password reset', 'Export invoices'] as $title) {
        PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => $title]);
    }

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    $facilitator->assertCount('@poker-task-row', 3);

    $this->dragWithKeyboard(
        $facilitator,
        '[data-test="poker-task-row"]:has-text("Export invoices") [aria-label="Drag to reorder"]',
        ['Space', 'ArrowUp', 'ArrowUp', 'Space'],
    );

    $facilitator->assertScript(p10aTaskOrderScript(), 'Export invoices / Login page / Password reset');
    $member->assertScript(p10aTaskOrderScript(), 'Export invoices / Login page / Password reset');

    $facilitator->navigate("/poker/{$game->id}")
        ->assertCount('@poker-task-row', 3)
        ->assertScript(p10aTaskOrderScript(), 'Export invoices / Login page / Password reset');
});

it('[P10a-05] lets the facilitator allow guests and gives a working guest link', function () {
    $game = p10aGame();
    [$ada] = p10aFacilitator($game);

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $facilitator->assertVisible('[aria-label="Facilitator menu"]')
        ->click('[aria-label="Facilitator menu"]')
        ->assertSee('Guest link…')
        ->click('Guest link…')
        ->assertVisible('#poker-guest-link-access')
        ->click('#poker-guest-link-access')
        ->assertVisible('input[aria-label="Guest link"]')
        ->assertSee('Copy');

    $joinUrl = $facilitator->value('input[aria-label="Guest link"]');

    expect($joinUrl)->toEndWith("/poker/join/{$game->guest_token}")
        ->and($game->refresh()->guest_access_enabled)->toBeTrue();

    $guest = $this->joinAsGuest($joinUrl, 'Visitor');

    $guest->assertPathIs("/poker/{$game->id}")
        ->assertSee('Sprint 12 estimates');
});

it('[P10a-06] lets a guest join through the link with a restricted view', function () {
    $game = p10aGame(['guest_access_enabled' => true]);
    [$ada] = p10aFacilitator($game);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    $joinUrl = "/poker/join/{$game->guest_token}";

    visit($joinUrl)
        ->assertSee('Sprint 12 estimates')
        ->assertSee('Choose the name other players will see.')
        ->assertSee('Display name')
        ->assertSee('Join as spectator');

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest($joinUrl, 'Visitor'));

    $guest->assertPathIs("/poker/{$game->id}")
        ->assertSee('Sprint 12 estimates')
        ->assertCount('img[data-presence-id]', 2)
        ->assertPresent('img[data-presence-id][alt="Ada Facilitator"]')
        ->assertPresent('img[data-presence-id][alt="Visitor"]')
        ->assertNotPresent('[aria-label="Back to the team"]')
        ->assertDontSee('Add task')
        ->assertVisible('[aria-label="Language"]');

    $facilitator->assertCount('img[data-presence-id]', 2)
        ->assertPresent('img[data-presence-id][alt="Visitor"]')
        ->assertVisible('[aria-label="Back to the team"]')
        ->assertSee('Add task')
        ->assertNotPresent('[aria-label="Language"]');
});
```

The second user in `[P10a-04b]` is not in the walkthrough. He is there because the reorder request is asynchronous: his page changes only after the server has stored the new order and broadcast it, so his assertion is the wait that makes the following `navigate()` safe without a fixed sleep.

- [ ] **Step 6: Run the tests of steps 4 to 6**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php --filter='P10a-04|P10a-05|P10a-06'`
Expected: PASS (4 tests). A failure means a product defect or a wrong selector: fix the selector if the UI text differs, otherwise report the defect per the plan header's defect rule. If the keyboard move of `[P10a-04b]` does not change the order, or if the `:has-text()` selectors are rejected, see Task 1's findings.

- [ ] **Step 7: Append the tests for selecting, voting, revealing and estimating (steps 7 to 9)**

Append to `tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php`:

```php
it('[P10a-07a] shows the task picked by the facilitator as current to everyone', function () {
    $game = p10aGame(['guest_access_enabled' => true]);
    [$ada] = p10aFacilitator($game);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Password reset']);

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$game->guest_token}", 'Visitor'));

    $facilitator->assertSee('Pick a task to start voting');
    $guest->assertSee('Waiting for the facilitator to pick a task');

    $facilitator->click('Login page')
        ->assertCount('[data-test="poker-task-row"][aria-current="true"]', 1)
        ->assertScript(p10aCurrentTaskScript(), 'Login page')
        ->assertSee('Show votes')
        ->assertButtonDisabled('Show votes');

    $guest->assertCount('[data-test="poker-task-row"][aria-current="true"]', 1)
        ->assertScript(p10aCurrentTaskScript(), 'Login page')
        ->assertVisible('section[aria-labelledby^="poker-task-"]')
        ->assertEnabled('[aria-label="Play 5"]')
        ->assertDontSee('Show votes');
});

it('[P10a-07b] shows a played card face-down and never its value before the reveal', function () {
    $game = p10aGame(['guest_access_enabled' => true]);
    [$ada] = p10aFacilitator($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    openPokerRound($game, $task);

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$game->guest_token}", 'Visitor'));

    $guest->assertEnabled('[aria-label="Play 5"]')
        ->click('[aria-label="Play 5"]');

    $facilitator->assertVisible('[aria-label="Visitor: Voted"]')
        ->assertSee('Votes: 1')
        ->assertNotPresent('[aria-label="Visitor: 5"]')
        ->assertDontSeeIn('section[aria-label="Players"]', '5')
        ->assertScript('document.querySelector(\'section[aria-label="Players"]\').innerText.includes("5")', false)
        ->assertButtonEnabled('Show votes')
        ->assertEnabled('[aria-label="Play 8"]')
        ->click('[aria-label="Play 8"]');

    $guest->assertVisible('[aria-label="Ada Facilitator: Voted"]')
        ->assertSee('Votes: 2')
        ->assertNotPresent('[aria-label="Ada Facilitator: 8"]')
        ->assertDontSeeIn('section[aria-label="Players"]', '8')
        ->assertScript('document.querySelector(\'section[aria-label="Players"]\').innerText.includes("8")', false);
});

it('[P10a-07c] lets a player change, withdraw and replay a card', function () {
    $game = p10aGame(['guest_access_enabled' => true]);
    [$ada] = p10aFacilitator($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    openPokerRound($game, $task);

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$game->guest_token}", 'Visitor'));

    $guest->assertEnabled('[aria-label="Play 5"]')
        ->click('[aria-label="Play 5"]')
        ->assertAttribute('[aria-label="Play 5"]', 'aria-pressed', 'true');

    $facilitator->assertVisible('[aria-label="Visitor: Voted"]')
        ->assertSee('Votes: 1');

    $guest->assertEnabled('[aria-label="Play 3"]')
        ->click('[aria-label="Play 3"]')
        ->assertAttribute('[aria-label="Play 3"]', 'aria-pressed', 'true')
        ->assertAttribute('[aria-label="Play 5"]', 'aria-pressed', 'false')
        ->assertEnabled('[aria-label="Play 3"]')
        ->click('[aria-label="Play 3"]')
        ->assertAttribute('[aria-label="Play 3"]', 'aria-pressed', 'false');

    $facilitator->assertVisible('[aria-label="Visitor: Not voted yet"]')
        ->assertSee('Votes: 0');

    $guest->assertEnabled('[aria-label="Play 3"]')
        ->click('[aria-label="Play 3"]')
        ->assertAttribute('[aria-label="Play 3"]', 'aria-pressed', 'true');

    $facilitator->assertVisible('[aria-label="Visitor: Voted"]')
        ->assertSee('Votes: 1');

    $visitor = PokerPlayer::query()
        ->where('poker_game_id', $game->id)
        ->where('guest_name', 'Visitor')
        ->sole();

    expect(PokerVote::query()->where('poker_player_id', $visitor->id)->pluck('value')->all())->toBe(['3']);
});

it('[P10a-08] reveals both votes with the result to everyone', function () {
    $game = p10aGame();
    [$ada, $adaPlayer] = p10aFacilitator($game);
    [$bob, $bobPlayer] = p10aMember($game, 'Bob Member');
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    $round = openPokerRound($game, $task);
    pokerVote($round, $adaPlayer, '8');
    pokerVote($round, $bobPlayer, '3');

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    $facilitator->assertSee('Show votes')
        ->assertButtonEnabled('Show votes')
        ->click('Show votes');

    foreach ([$facilitator, $member] as $page) {
        $page->assertVisible('[aria-label="Ada Facilitator: 8"]')
            ->assertVisible('[aria-label="Bob Member: 3"]')
            ->assertSee('Average')
            ->assertSee('5.5')
            ->assertSee('Nearest card: 5')
            ->assertScript('Array.from(document.querySelectorAll(\'[aria-labelledby="poker-result"] li\')).map(function (row) { return row.querySelectorAll("span")[0].textContent + " x" + row.querySelectorAll("span")[2].textContent; }).join(" / ")', '3 x1 / 8 x1')
            ->assertDontSee('Consensus')
            ->assertDisabled('[aria-label="Play 5"]');
    }
});

it('[P10a-09] re-votes to a consensus and saves the estimate for everyone', function () {
    $game = p10aGame();
    [$ada, $adaPlayer] = p10aFacilitator($game);
    [$bob, $bobPlayer] = p10aMember($game, 'Bob Member');
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    $firstRound = PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id]);
    pokerVote($firstRound, $adaPlayer, '8');
    pokerVote($firstRound, $bobPlayer, '3');
    $game->forceFill(['current_task_id' => $task->id])->save();

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    $facilitator->assertSee('Re-vote')
        ->click('Re-vote')
        ->assertVisible('[aria-label="Ada Facilitator: Not voted yet"]')
        ->assertSee('Show votes');

    $member->assertVisible('[aria-label="Bob Member: Not voted yet"]')
        ->assertEnabled('[aria-label="Play 5"]');

    $facilitator->assertEnabled('[aria-label="Play 5"]')
        ->click('[aria-label="Play 5"]');
    $member->click('[aria-label="Play 5"]');

    $facilitator->assertVisible('[aria-label="Bob Member: Voted"]')
        ->assertSee('Votes: 2')
        ->assertButtonEnabled('Show votes')
        ->click('Show votes');

    foreach ([$facilitator, $member] as $page) {
        $page->assertSee('Consensus')
            ->assertSee('Nearest card: 5');
    }

    $facilitator->assertVisible('[aria-label="Estimate"]')
        ->assertSeeIn('[aria-label="Estimate"]', '5')
        ->click('Save estimate');

    foreach ([$facilitator, $member] as $page) {
        $page->assertSee('Estimate: 5')
            ->assertScript('Array.from(document.querySelectorAll(\'[data-test="poker-task-row"] [data-slot="badge"]\')).map(function (badge) { return badge.textContent; }).join(" / ")', '5 / Votes: 2');
    }

    $facilitator->assertVisible('button:has-text("Rounds (2)")')
        ->click('button:has-text("Rounds (2)")')
        ->assertSee('Round 2')
        ->assertSee('Round 1')
        ->assertSee('Ada Facilitator: 5')
        ->assertSee('Bob Member: 5')
        ->assertSee('Ada Facilitator: 8')
        ->assertSee('Bob Member: 3')
        ->assertSee('Average: 5.5');

    expect($task->refresh()->estimate)->toBe('5');
});
```

`[P10a-08]` and `[P10a-09]` use a second team member instead of the walkthrough's guest so that both votes can be arranged with factories before the browsers open; the guest's view of a hidden vote is covered by `[P10a-07b]` and `[P10a-07c]`.

- [ ] **Step 8: Run the tests of steps 7 to 9**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php --filter='P10a-07|P10a-08|P10a-09'`
Expected: PASS (5 tests). A failure means a product defect or a wrong selector: fix the selector if the UI text differs, otherwise report the defect per the plan header's defect rule.

- [ ] **Step 9: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. Pint may reflow the long chained calls; keep its result.

- [ ] **Step 10: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php`
Expected: PASS (12 tests).

- [ ] **Step 11: Commit**

```bash
git add resources/js/components/poker/tasks-pane.tsx tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php
git commit -m "test(browser): cover the poker core walkthrough steps 1 to 9"
```

### Task 11: Poker core walkthrough, steps 10 to 16 (next task to delete)

This task automates steps 10 to 16 of the plan 10a walkthrough (lines 12544 to 12550 of the plan 10a file). Step 11 asked to cut the guest's network; the test stops and restarts the Reverb server instead. That test is the last one in the file and restarts Reverb in a `finally` block, so a failure cannot leave the server down for the files that run after it. No product file changes in this task, so no frontend build is needed.

Two behaviours differ from the walkthrough's wording; the tests follow the code, which is deliberate in both cases (see `## Notes for the lead`):

- After the guest link is regenerated, the guest's page does not wait for the guest's next action and does not show the session-expired banner. The broadcast makes it reload its snapshot, the server answers 403, and the page shows "Your access to this game has ended." at once.
- Step 16's "B re-joined through the new link" is arranged as a guest who joins through the game's current link; regeneration itself is covered by `[P10a-14]`.

**Files:**
- Modify: `tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php` (appends eight tests)
- Test: `tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php`

**Interfaces:**
- Consumes:
  - Everything Task 10 consumes, plus `Tests\Browser\Support\ReverbServer::stop(): void` and `ReverbServer::start(): void` (Task 2); the file already imports `ReverbServer`.
  - From Task 10: `data-test="poker-task-row"`, and the helpers `p10aGame()`, `p10aFacilitator()`, `p10aMember()`, `p10aTeamPath()`, `p10aCurrentTaskScript()`.
  - Factory state `PokerTaskFactory::estimated(string $value = '5')`, `PokerRoundFactory::revealed()`.
- Produces: nothing new. No `data-test` hook is added in this task.

- [ ] **Step 1: Append the tests for the next task and for ending and reopening (steps 10 and 12)**

Append to `tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php`:

```php
it('[P10a-10] moves to the next task and drops a deleted current task for everyone', function () {
    $game = p10aGame(['guest_access_enabled' => true]);
    [$ada] = p10aFacilitator($game);
    $estimated = PokerTask::factory()->estimated('5')->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Password reset']);
    openPokerRound($game, $estimated);

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$game->guest_token}", 'Visitor'));

    $facilitator->assertSee('Next task')
        ->click('Next task')
        ->assertScript(p10aCurrentTaskScript(), 'Password reset');

    $guest->assertScript(p10aCurrentTaskScript(), 'Password reset')
        ->assertEnabled('[aria-label="Play 3"]')
        ->click('[aria-label="Play 3"]');

    $facilitator->assertVisible('[aria-label="Visitor: Voted"]')
        ->assertVisible('[aria-label="Delete task"]')
        ->click('[aria-label="Delete task"]')
        ->assertSee('Delete this task?')
        ->click('[role="dialog"] button:has-text("Delete")');

    $facilitator->assertSee('Pick a task to start voting')
        ->assertCount('@poker-task-row', 1);

    $guest->assertSee('Waiting for the facilitator to pick a task')
        ->assertCount('@poker-task-row', 1)
        ->assertDontSee('Password reset');

    expect(PokerTask::query()->where('poker_game_id', $game->id)->pluck('title')->all())->toBe(['Login page'])
        ->and($game->refresh()->current_task_id)->toBeNull();
});

it('[P10a-12] makes an ended game read-only for everyone and editable again once reopened', function () {
    $game = p10aGame(['guest_access_enabled' => true]);
    [$ada] = p10aFacilitator($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    openPokerRound($game, $task);

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$game->guest_token}", 'Visitor'));

    $guest->assertEnabled('[aria-label="Play 5"]');

    $facilitator->assertVisible('[aria-label="Facilitator menu"]')
        ->click('[aria-label="Facilitator menu"]')
        ->assertSee('End game')
        ->click('End game')
        ->assertSee('End this game?')
        ->click('[role="dialog"] button:has-text("End game")');

    $facilitator->assertSee('Game ended')
        ->assertDontSee('Add task')
        ->assertNotPresent('[data-test="poker-task-row"] button')
        ->assertDisabled('[aria-label="Play 5"]');

    $guest->assertSee('Game ended')
        ->assertSee('Waiting for the facilitator to pick a task')
        ->assertDisabled('[aria-label="Play 5"]');

    expect($game->refresh()->ended_at)->not->toBeNull();

    $facilitator->assertVisible('[aria-label="Facilitator menu"]')
        ->click('[aria-label="Facilitator menu"]')
        ->assertSee('Reopen game')
        ->click('Reopen game')
        ->assertDontSee('Game ended')
        ->assertSee('Add task')
        ->click('Login page');

    $guest->assertDontSee('Game ended')
        ->assertEnabled('[aria-label="Play 5"]')
        ->click('[aria-label="Play 5"]');

    $facilitator->assertVisible('[aria-label="Visitor: Voted"]');

    expect($game->refresh()->ended_at)->toBeNull();
});
```

- [ ] **Step 2: Run the tests of steps 10 and 12**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php --filter='P10a-10|P10a-12'`
Expected: PASS (2 tests). A failure means a product defect or a wrong selector: fix the selector if the UI text differs, otherwise report the defect per the plan header's defect rule.

- [ ] **Step 3: Append the tests for taking control and for regenerating the link (steps 13 and 14)**

Append to `tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php`:

```php
it('[P10a-13a] lets another member take control and hand facilitation back', function () {
    $game = p10aGame();
    [$ada, $adaPlayer] = p10aFacilitator($game);
    [$cleo, $cleoPlayer] = p10aMember($game, 'Cleo Member');

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $member = $this->awaitRealtime($this->signIn($cleo, "/poker/{$game->id}"));

    $facilitator->assertVisible('[aria-label="Facilitator menu"]');

    $member->assertSee('Take control')
        ->click('Take control')
        ->assertVisible('[aria-label="Facilitator menu"]')
        ->assertDontSee('Take control');

    $facilitator->assertSee('Take control')
        ->assertNotPresent('[aria-label="Facilitator menu"]');

    expect($game->refresh()->facilitator_player_id)->toBe($cleoPlayer->id);

    $member->assertVisible('[aria-label="Facilitator menu"]')
        ->click('[aria-label="Facilitator menu"]')
        ->assertSee('Hand over facilitation…')
        ->click('Hand over facilitation…')
        ->assertVisible('#poker-new-facilitator')
        ->click('#poker-new-facilitator')
        ->assertVisible('[role="option"]:has-text("Ada Facilitator")')
        ->click('[role="option"]:has-text("Ada Facilitator")')
        ->assertButtonEnabled('Hand over')
        ->click('Hand over');

    $facilitator->assertVisible('[aria-label="Facilitator menu"]')
        ->assertDontSee('Take control');

    $member->assertSee('Take control')
        ->assertNotPresent('[aria-label="Facilitator menu"]');

    expect($game->refresh()->facilitator_player_id)->toBe($adaPlayer->id);
});

it('[P10a-13b] lets a member take control of an ended game and reopen it', function () {
    $game = p10aGame(['ended_at' => now()]);
    [$ada] = p10aFacilitator($game);
    [$cleo, $cleoPlayer] = p10aMember($game, 'Cleo Member');

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $member = $this->awaitRealtime($this->signIn($cleo, "/poker/{$game->id}"));

    $facilitator->assertSee('Game ended');

    $member->assertSee('Game ended')
        ->assertSee('Take control')
        ->click('Take control')
        ->assertVisible('[aria-label="Facilitator menu"]')
        ->click('[aria-label="Facilitator menu"]')
        ->assertSee('Reopen game')
        ->click('Reopen game')
        ->assertDontSee('Game ended');

    $facilitator->assertDontSee('Game ended')
        ->assertSee('Take control');

    expect($game->refresh()->ended_at)->toBeNull()
        ->and($game->facilitator_player_id)->toBe($cleoPlayer->id);
});

it('[P10a-14] ends the access of guests when the guest link is regenerated', function () {
    $game = p10aGame(['guest_access_enabled' => true]);
    [$ada] = p10aFacilitator($game);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    $oldToken = $game->guest_token;

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$oldToken}", 'Visitor'));

    $facilitator->assertVisible('[aria-label="Facilitator menu"]')
        ->click('[aria-label="Facilitator menu"]')
        ->assertSee('Guest link…')
        ->click('Guest link…')
        ->assertVisible('input[aria-label="Guest link"]');

    $oldUrl = $facilitator->value('input[aria-label="Guest link"]');

    $facilitator->click('Create a new link')
        ->assertValueIsNot('input[aria-label="Guest link"]', $oldUrl);

    $guest->assertSee('Your access to this game has ended.')
        ->assertDontSee('Back to the team');

    visit($oldUrl)->assertSee('This guest link is no longer valid.');

    expect($game->refresh()->guest_token)->not->toBe($oldToken)
        ->and($facilitator->value('input[aria-label="Guest link"]'))->toEndWith("/poker/join/{$game->guest_token}");
});
```

- [ ] **Step 4: Run the tests of steps 13 and 14**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php --filter='P10a-13|P10a-14'`
Expected: PASS (3 tests). A failure means a product defect or a wrong selector: fix the selector if the UI text differs, otherwise report the defect per the plan header's defect rule.

- [ ] **Step 5: Append the tests for the history and for deleting the game (steps 15 and 16)**

Append to `tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php`:

```php
it('[P10a-15] shows the game summary on the team page and the rounds in the estimation history', function () {
    $game = p10aGame();
    [$ada, $adaPlayer] = p10aFacilitator($game);
    [, $bobPlayer] = p10aMember($game, 'Bob Member');
    $task = PokerTask::factory()->estimated('5')->create(['poker_game_id' => $game->id, 'title' => 'Export invoices']);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Password reset']);
    $firstRound = PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id]);
    pokerVote($firstRound, $adaPlayer, '8');
    pokerVote($firstRound, $bobPlayer, '3');
    $secondRound = PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id]);
    pokerVote($secondRound, $adaPlayer, '5');
    pokerVote($secondRound, $bobPlayer, '5');
    $otherGame = p10aGame(['team_id' => $game->team_id, 'title' => 'Sprint 13 estimates']);
    PokerTask::factory()->estimated('3')->create(['poker_game_id' => $otherGame->id, 'title' => 'Search page']);
    $teamPath = p10aTeamPath($game->team);

    $page = $this->signIn($ada, $teamPath);

    $page->assertSee('Sprint 12 estimates')
        ->assertSee('3 tasks · 1 estimated · 5 points')
        ->assertSee('Last activity')
        ->click('Estimation history')
        ->assertPathIs("{$teamPath}/estimates")
        ->assertSee('Export invoices')
        ->assertSee('Search page');

    $page->click('button[aria-label="Game"]')
        ->assertVisible('[role="option"]:has-text("Sprint 12 estimates")')
        ->click('[role="option"]:has-text("Sprint 12 estimates")')
        ->assertQueryStringHas('game', $game->id)
        ->assertDontSee('Search page')
        ->assertSee('Export invoices');

    $page->fill('input[aria-label="Search tasks"]', 'search')
        ->click('Search')
        ->assertQueryStringHas('q', 'search')
        ->assertSee('No estimated tasks yet.')
        ->fill('input[aria-label="Search tasks"]', 'invoice')
        ->click('Search')
        ->assertQueryStringHas('q', 'invoice')
        ->assertSee('Export invoices');

    $page->assertVisible('[aria-label="Show rounds"]')
        ->click('[aria-label="Show rounds"]')
        ->assertSee('Round 2')
        ->assertSee('Round 1')
        ->assertSee('Ada Facilitator: 5')
        ->assertSee('Bob Member: 5')
        ->assertSee('Ada Facilitator: 8')
        ->assertSee('Bob Member: 3')
        ->assertSee('5 × 2')
        ->assertSee('Average: 5.5')
        ->assertSee('Consensus');
});

it('[P10a-16] deletes the game, sends the facilitator to the team page and tells the guest', function () {
    $game = p10aGame(['guest_access_enabled' => true]);
    [$ada] = p10aFacilitator($game);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    $teamPath = p10aTeamPath($game->team);

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$game->guest_token}", 'Visitor'));

    $facilitator->assertVisible('[aria-label="Facilitator menu"]')
        ->click('[aria-label="Facilitator menu"]')
        ->assertSee('Delete game…')
        ->click('Delete game…')
        ->assertSee('Delete this game?')
        ->click('[role="dialog"] button:has-text("Delete")');

    $facilitator->assertPathIs($teamPath)
        ->assertSee('Planning poker')
        ->assertSee('No games yet.');

    $guest->assertSee('This game was deleted.')
        ->assertDontSee('Back to the team');

    expect(PokerGame::query()->whereKey($game->id)->exists())->toBeFalse();
});
```

- [ ] **Step 6: Run the tests of steps 15 and 16**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php --filter='P10a-15|P10a-16'`
Expected: PASS (2 tests). A failure means a product defect or a wrong selector: fix the selector if the UI text differs, otherwise report the defect per the plan header's defect rule.

- [ ] **Step 7: Append the reconnect test as the last test of the file (step 11)**

Append to the very end of `tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php`. This test must stay the last one in the file.

```php
it('[P10a-11] shows the reconnecting banner and catches up when the connection returns', function () {
    $game = p10aGame(['guest_access_enabled' => true]);
    [$ada] = p10aFacilitator($game);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);

    $facilitator = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest("/poker/join/{$game->guest_token}", 'Visitor'));

    try {
        ReverbServer::stop();

        $guest->assertSee('Reconnecting…');

        $facilitator->assertSee('Add task')
            ->click('Add task')
            ->assertVisible('#poker-task-title')
            ->fill('#poker-task-title', 'Added while offline')
            ->click('Save')
            ->assertCount('@poker-task-row', 2);

        $guest->assertCount('@poker-task-row', 1);
    } finally {
        ReverbServer::start();
    }

    $guest->assertDontSee('Reconnecting…')
        ->assertSee('Added while offline')
        ->assertCount('@poker-task-row', 2);
});
```

How it works: with Reverb stopped, the facilitator's request still succeeds because `App\Events\Concerns\SendsToOthers` wraps the broadcast in `rescue()`. The guest's page therefore misses the `task.saved` event and shows one task. When Reverb is back, the presence channel subscribes again, `usePokerChannel` schedules a resync, and the fresh snapshot brings the new task without a reload. The Echo client retries its connection with a growing delay, so the last three assertions can need several seconds. If this fails, see Task 1's findings.

- [ ] **Step 8: Run the reconnect test**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php --filter='P10a-11'`
Expected: PASS (1 test). A failure means a product defect or a wrong selector: fix the selector if the UI text differs, otherwise report the defect per the plan header's defect rule.

- [ ] **Step 9: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue.

- [ ] **Step 10: Run the whole file twice**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php`
Expected: PASS (20 tests).

Run the same command a second time.
Expected: PASS (20 tests) again. The second run proves that the reconnect test left Reverb running and that no test depends on leftovers of another.

- [ ] **Step 11: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php
git commit -m "test(browser): cover the poker core walkthrough steps 10 to 16"
```

### Task 12a: Plan 4 walkthrough, Step 1 (the scripted phase flow)

This task automates Step 1 of the plan 4 walkthrough (`docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793`). The walkthrough prose is split into 11 items, `P04-01` to `P04-11`. The tests check the behaviour plan 4 describes against the interface as it is today; the places where today's interface differs from plan 4's wording are listed in "Notes for the lead" at the end of this fragment.

**Files:**
- Modify: `resources/js/components/retro/retro-column.tsx` (adds one `data-test` attribute to the column's `<section>`)
- Modify: `resources/js/components/retro/dnd.tsx` (adds one `data-test` attribute to the wrapper `<div>` of `SortableCard` and of `GroupableCard`)
- Create: `tests/Browser/Walkthroughs/Plan04RetroCoreTest.php`
- Test: `tests/Browser/Walkthroughs/Plan04RetroCoreTest.php`

**Interfaces:**
- Consumes: `Tests\BrowserTestCase` bound to `tests/Browser` (Task 4); `$this->signIn(User $user, string $to = '/dashboard'): mixed`, `$this->joinAsGuest(string $joinUrl, string $name): mixed`, `$this->awaitRealtime(mixed $page): mixed`, `$this->dragWithKeyboard(mixed $page, string $handleSelector, array $keys): mixed` (Task 2); `data-realtime` on the root of `retros/show` (Task 3); the global helpers `retroFacilitator(Retro $retro): array`, `retroMember(Retro $retro): array`, `teamMember(Team $team): User` from `tests/Pest.php`; the factory states `RetroFactory::inPhase()` and `RetroFactory::withGuestAccess()`.
- Produces:
  - `data-test="retro-column-{columnId}"` on each board column (`retro-column.tsx`). Test selector: `[data-test="retro-column-<uuid>"]`.
  - `data-test="retro-card-handle-{cardId}"` on the focusable drag wrapper of a card in the Writing and Grouping phases (`dnd.tsx`). Test selector: `@retro-card-handle-<uuid>`.
  - A card itself needs no hook: `retro-card.tsx` already renders `<article id="card-{cardId}">`. Test selector: `#card-<uuid>`.
  - Test-file helpers, global functions declared in `Plan04RetroCoreTest.php` and reused by Task 12b: `plan04Board(RetroPhase $phase = RetroPhase::Writing, array $attributes = []): array` (returns `[$retro, $columns, $alice, $bob, $aliceParticipant, $bobParticipant]`), `plan04Card(Retro $retro, Column $column, Participant $author, string $content, int $position = 0): Card`, `plan04Column(Column $column): string`, `plan04CardOrder(Column $column): string`.

- [ ] **Step 1: Add the column hook**

In `resources/js/components/retro/retro-column.tsx`, find the `return (` of `RetroColumn`. Before:

```tsx
        <section
            className={cn(
                'flex w-72 shrink-0 flex-col rounded-lg border border-t-4 bg-muted/30 p-3',
                columnAccent[column.color],
            )}
        >
```

After:

```tsx
        <section
            data-test={`retro-column-${column.id}`}
            className={cn(
                'flex w-72 shrink-0 flex-col rounded-lg border border-t-4 bg-muted/30 p-3',
                columnAccent[column.color],
            )}
        >
```

- [ ] **Step 2: Add the drag handle hook to both card wrappers**

In `resources/js/components/retro/dnd.tsx`, in `SortableCard`. Before:

```tsx
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
```

After:

```tsx
        <div
            ref={setNodeRef}
            data-test={`retro-card-handle-${id}`}
            style={{ transform: CSS.Transform.toString(transform), transition }}
```

In the same file, in `GroupableCard`. Before:

```tsx
        <div
            ref={(node) => {
                drag.setNodeRef(node);
                drop.setNodeRef(node);
            }}
            className={cn(
                'rounded-md',
```

After:

```tsx
        <div
            ref={(node) => {
                drag.setNodeRef(node);
                drop.setNodeRef(node);
            }}
            data-test={`retro-card-handle-${id}`}
            className={cn(
                'rounded-md',
```

These wrappers are the elements that receive dnd-kit's `attributes` and `listeners` (`role="button"`, `tabindex="0"`), so they are the elements the keyboard sensor listens on. The keyboard sensor only starts a drag when the key event's target is this wrapper itself, which is why the tests need to focus exactly this element.

- [ ] **Step 3: Check types and lint, then rebuild the assets**

Run: `npm run types:check`
Expected: exits 0 with no output from `tsc`.

Run: `npm run check`
Expected: exits 0.

Run: `npm run build`
Expected: the build finishes and rewrites `public/build/manifest.json`. The browser suite serves the built assets, so the two hooks do not exist for the tests until this build has run.

- [ ] **Step 4: Create the test file with its helpers and the creation test**

Create `tests/Browser/Walkthroughs/Plan04RetroCoreTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Vote;
use Tests\Browser\Support\ReverbServer;

/**
 * @param  RetroPhase  $phase
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
function plan04Board(RetroPhase $phase = RetroPhase::Writing, array $attributes = []): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
        ->withGuestAccess()
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

    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    return [$retro->fresh(), $columns, $alice, $bob, $aliceParticipant, $bobParticipant];
}

function plan04Card(Retro $retro, Column $column, Participant $author, string $content, int $position = 0): Card
{
    return Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $author->id,
        'content' => $content,
        'position' => $position,
    ]);
}

function plan04Column(Column $column): string
{
    return "[data-test=\"retro-column-{$column->id}\"]";
}

function plan04CardOrder(Column $column): string
{
    return "[...document.querySelectorAll('[data-test=\"retro-column-{$column->id}\"] article[id^=\"card-\"]')].map((card) => card.id).join(',')";
}

it('[P04-01] creates a Start, Stop, Continue retro from the team page', function () {
    $team = Team::factory()->create();
    $alice = teamMember($team);
    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);

    $page = $this->signIn($alice, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('New retrospective')
        ->click('New retrospective')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Sprint 12 retro')
        ->assertSee('Start, Stop, Continue')
        ->click('Start, Stop, Continue')
        ->assertSeeIn('[role="dialog"] li button[aria-pressed="true"]', 'Start, Stop, Continue')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header h1', 'Sprint 12 retro')
        ->assertSeeIn('[aria-current="step"]', 'Writing')
        ->assertCount('[data-test^="retro-column-"]', 3)
        ->assertSeeIn('main', 'Start')
        ->assertSeeIn('main', 'Stop')
        ->assertSeeIn('main', 'Continue')
        ->assertPresent('[aria-label="Facilitator menu"]');

    $retro = Retro::query()->where('title', 'Sprint 12 retro')->firstOrFail();

    expect($retro->template)->toBe('start_stop_continue')
        ->and($retro->phase)->toBe(RetroPhase::Writing)
        ->and($retro->columns->pluck('title')->all())->toBe(['Start', 'Stop', 'Continue'])
        ->and($retro->facilitator->user_id)->toBe($alice->id);
});
```

How this maps to the real interface: the team page (`resources/js/pages/teams/show.tsx`) shows the button "New retrospective", which opens `NewRetroDialog` (`resources/js/components/teams/new-retro-dialog.tsx`). The dialog loads its template catalogue lazily, so the click on the template name waits for the list. Each template is a `<li><button aria-pressed>` (the category filter buttons also carry `aria-pressed`, hence the `li` in the selector, which must match exactly one element); the dialog's only `type="submit"` button is "Start". `TeamRetrosController::store` redirects to `/retros/{id}`.

- [ ] **Step 5: Run the creation test**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan04RetroCoreTest.php --filter="P04-01"`
Expected: PASS (1 test). A failure means a wrong selector or a product defect: fix the selector if the interface text differs from the one quoted here, otherwise report it under the plan header's defect rule. If the failure is about sign-in, the lazy catalogue or the built assets, see Task 1's findings.

- [ ] **Step 6: Add the Writing and Grouping tests**

Append to `tests/Browser/Walkthroughs/Plan04RetroCoreTest.php`:

```php
it('[P04-02] hides the cards of other participants behind placeholders during Writing', function () {
    [$retro, $columns, $alice, $bob] = plan04Board();
    $start = plan04Column($columns[0]);
    $composer = "{$start} textarea";
    $add = "{$start} form button:not([type=\"button\"])";
    $placeholders = "[...document.querySelectorAll('article[id^=\"card-\"]')].filter((card) => card.innerText.includes('Hidden until writing ends')).length";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->fill($composer, 'Ship smaller pull requests')
        ->click($add)
        ->assertSee('Ship smaller pull requests');
    $bobPage->assertScript($placeholders, 1);

    $bobPage->fill($composer, 'Stop skipping code review')
        ->click($add)
        ->assertSee('Stop skipping code review');
    $carolPage->assertScript($placeholders, 2);

    $carolPage->fill($composer, 'Keep the demo on Fridays')
        ->click($add)
        ->assertSee('Keep the demo on Fridays');

    $views = [
        [$alicePage, 'Ship smaller pull requests', ['Stop skipping code review', 'Keep the demo on Fridays']],
        [$bobPage, 'Stop skipping code review', ['Ship smaller pull requests', 'Keep the demo on Fridays']],
        [$carolPage, 'Keep the demo on Fridays', ['Ship smaller pull requests', 'Stop skipping code review']],
    ];

    foreach ($views as [$page, $own, $others]) {
        $page->assertCount('article[id^="card-"]', 3)
            ->assertScript($placeholders, 2)
            ->assertSee($own);

        foreach ($others as $text) {
            $page->assertDontSee($text)
                ->assertScript("document.body.innerText.includes(\"{$text}\")", false)
                ->assertScript("document.documentElement.outerHTML.includes(\"{$text}\")", false);
        }
    }

    expect($retro->cards()->count())->toBe(3);
});

it('[P04-03] groups, ungroups and moves a card during Grouping', function () {
    [$retro, $columns, $alice, $bob, , $bobParticipant] = plan04Board(RetroPhase::Grouping);
    $flaky = plan04Card($retro, $columns[0], $bobParticipant, 'Flaky tests', 0);
    $slow = plan04Card($retro, $columns[0], $bobParticipant, 'Slow CI', 1);
    $handle = "@retro-card-handle-{$flaky->id}";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertSee('Drag cards onto each other to group them.')
        ->assertPresent($handle);

    $this->dragWithKeyboard($bobPage, $handle, ['Space', 'ArrowDown', 'Space']);

    $alicePage->assertPresent("#card-{$slow->id} #card-{$flaky->id}");
    expect($flaky->fresh()->parent_card_id)->toBe($slow->id);

    $bobPage->assertPresent("#card-{$flaky->id} [aria-label=\"Ungroup\"]")
        ->click("#card-{$flaky->id} [aria-label=\"Ungroup\"]");

    $alicePage->assertNotPresent("#card-{$slow->id} #card-{$flaky->id}")
        ->assertPresent("#card-{$flaky->id}");
    expect($flaky->fresh()->parent_card_id)->toBeNull();

    $bobPage->assertPresent($handle);

    $this->dragWithKeyboard($bobPage, $handle, ['Space', 'ArrowRight', 'Space']);

    $stop = plan04Column($columns[1]);

    $alicePage->assertPresent("{$stop} #card-{$flaky->id}");
    expect($flaky->fresh()->column_id)->toBe($columns[1]->id);
});
```

How the keyboard drag works in Grouping (read `resources/js/components/retro/dnd.tsx` and `board.tsx`): every top-level card is wrapped in `GroupableCard`, which is both a draggable and a droppable with the id `card:{id}`; every column is a droppable `column:{id}`. The board registers dnd-kit's `KeyboardSensor` with `sortableKeyboardCoordinates`. The documented keys are in the screen-reader instructions of `useDragAccessibility`: Space or Enter picks a card up, the arrow keys move it, Space or Enter drops it, Escape cancels. An arrow key moves the picked-up card onto the nearest droppable in that direction. With "Flaky tests" above "Slow CI" in the same column, ArrowDown puts it over "Slow CI"; dropping on a card in Grouping calls `CardGroupsController::update`, which makes the dropped card a child of the target, and the child is then rendered as a nested `<article>` inside the parent's `<article>`. After the ungroup, ArrowRight puts the card over the next column's drop zone (the "Stop" column is empty, so its drop zone is the only droppable to the right that is close); dropping on a column calls `CardPositionsController::update`. This third part also covers the walkthrough's "move a card with the keyboard sensor" for the Grouping phase.

`P04-02` uses the redaction substitution of spec §3.6: the other participants' text is absent from the visible text and from the document.

- [ ] **Step 7: Run the Writing and Grouping tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan04RetroCoreTest.php --filter="P04-02|P04-03"`
Expected: PASS (2 tests). If the keyboard drag does not group or move the card, see Task 1's findings.

- [ ] **Step 8: Add the Voting test**

Append to the same file:

```php
it('[P04-04] enforces the vote limit, shows the progress and hides per-card totals during Voting', function () {
    [$retro, $columns, $alice, $bob, $aliceParticipant] = plan04Board(RetroPhase::Voting, [
        'votes_per_participant' => 2,
        'hide_vote_counts' => true,
    ]);
    $slow = plan04Card($retro, $columns[0], $aliceParticipant, 'Slow CI', 0);
    $flaky = plan04Card($retro, $columns[0], $aliceParticipant, 'Flaky tests', 1);
    $addVote = fn (Card $card): string => "#card-{$card->id} [aria-label=\"Add a vote\"]";
    $isDisabled = fn (Card $card): string => "document.querySelector('#card-{$card->id} [aria-label=\"Add a vote\"]').disabled";
    $showsTotal = fn (Card $card): string => "[...document.querySelectorAll('#card-{$card->id} [aria-label]')].some((element) => /^\\d+ votes?$/.test(element.getAttribute('aria-label')))";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertSee('Votes left: 2')
        ->assertSee('0 of 4 votes cast')
        ->click($addVote($slow))
        ->assertSee('Votes left: 1');
    $alicePage->assertSee('1 of 4 vote cast');

    $bobPage->click($addVote($flaky))
        ->assertSee('Votes left: 0')
        ->assertScript($isDisabled($slow), true)
        ->assertScript($isDisabled($flaky), true)
        ->assertScript($showsTotal($slow), false)
        ->assertScript($showsTotal($flaky), false);

    $alicePage->assertSee('2 of 4 votes cast')
        ->assertAttribute('[role="progressbar"]', 'aria-valuenow', '2')
        ->assertAttribute('[role="progressbar"]', 'aria-valuemax', '4')
        ->assertSee('Votes left: 2')
        ->assertScript($showsTotal($slow), false)
        ->assertScript($showsTotal($flaky), false);

    $bobPage->click("#card-{$slow->id} [aria-label=\"Remove a vote\"]")
        ->assertSee('Votes left: 1');
    $alicePage->assertSee('1 of 4 vote cast');

    expect($retro->votes()->count())->toBe(1);
});
```

Facts this relies on: `VoteProgress` (`vote-progress.tsx`) renders "Votes left: :count", a `role="progressbar"` and ":cast of :total vote(s) cast", where the total is participants times the vote limit (two participants, limit 2). `VoteControls` (`vote-controls.tsx`) disables "Add a vote" when the viewer has no votes left. The per-card total is a badge whose `aria-label` is ":count vote" or ":count votes" (`retro-card.tsx`); it is rendered in Voting only when the snapshot carries a total, which `Retro::showsVoteTotals()` withholds when `hide_vote_counts` is on. Plan 4 had no such setting and never showed totals in Voting, so the test turns the setting on to check plan 4's behaviour.

- [ ] **Step 9: Run the Voting test**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan04RetroCoreTest.php --filter="P04-04"`
Expected: PASS (1 test).

- [ ] **Step 10: Add the three Discussing tests**

Append to the same file:

```php
it('[P04-05a] shows the vote totals and sorts the cards by votes during Discussing', function () {
    [$retro, $columns, , $bob, $aliceParticipant, $bobParticipant] = plan04Board(RetroPhase::Discussing);
    $flaky = plan04Card($retro, $columns[0], $aliceParticipant, 'Flaky tests', 0);
    $slow = plan04Card($retro, $columns[0], $aliceParticipant, 'Slow CI', 1);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $flaky->id, 'participant_id' => $aliceParticipant->id]);
    Vote::factory()->count(3)->create(['retro_id' => $retro->id, 'card_id' => $slow->id, 'participant_id' => $bobParticipant->id]);
    $start = plan04Column($columns[0]);

    $page = $this->signIn($bob, "/retros/{$retro->id}");

    $page->assertPresent("#card-{$slow->id} [aria-label=\"3 votes\"]")
        ->assertPresent("#card-{$flaky->id} [aria-label=\"1 vote\"]")
        ->assertNotPresent('[aria-label="Add a vote"]')
        ->assertScript(plan04CardOrder($columns[0]), "card-{$slow->id},card-{$flaky->id}")
        ->click("{$start} button[aria-pressed=\"true\"]")
        ->assertPresent("{$start} button[aria-pressed=\"false\"]")
        ->assertScript(plan04CardOrder($columns[0]), "card-{$flaky->id},card-{$slow->id}");
});

it('[P04-05b] scrolls the highlighted card into view for everyone during Discussing', function () {
    [$retro, $columns, $alice, $bob, $aliceParticipant] = plan04Board(RetroPhase::Discussing);
    $cards = [];

    foreach (range(0, 13) as $position) {
        $cards[] = plan04Card($retro, $columns[0], $aliceParticipant, "Topic {$position}", $position);
    }

    $target = $cards[13];
    $inView = "(() => { const box = document.getElementById('card-{$target->id}').getBoundingClientRect(); return box.top >= 0 && box.bottom <= window.innerHeight; })()";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->resize(1280, 600)
        ->assertPresent("#card-{$target->id}")
        ->assertScript($inView, false);

    $alicePage->click("#card-{$target->id} button[aria-pressed=\"false\"]")
        ->assertPresent("#card-{$target->id} button[aria-pressed=\"true\"]");

    $bobPage->assertAttributeContains("#card-{$target->id}", 'class', 'ring-primary')
        ->assertScript($inView, true);

    expect($retro->fresh()->highlighted_card_id)->toBe($target->id);
});

it('[P04-05c] lets a guest and a member add, complete and delete action items during Discussing', function () {
    [$retro, , , $bob] = plan04Board(RetroPhase::Discussing);
    $input = '[aria-label="Add an action item…"]';

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->fill($input, 'Automate the release notes')
        ->keys($input, 'Enter')
        ->assertSeeIn('aside', 'Automate the release notes');
    $bobPage->assertSeeIn('aside', 'Automate the release notes');

    $bobPage->fill($input, 'Rotate the on-call')
        ->keys($input, 'Enter')
        ->assertSeeIn('aside', 'Rotate the on-call');
    $carolPage->assertSeeIn('aside', 'Rotate the on-call');

    $guestItem = ActionItem::query()->where('content', 'Automate the release notes')->firstOrFail();

    $carolPage->click("#action-item-{$guestItem->id} [aria-label=\"Mark as done\"]")
        ->assertPresent("#action-item-{$guestItem->id} [aria-label=\"Reopen\"]");
    $bobPage->assertPresent("#action-item-{$guestItem->id} [aria-label=\"Reopen\"]");
    expect($guestItem->fresh()->completed_at)->not->toBeNull();

    $carolPage->click("#action-item-{$guestItem->id} [aria-label=\"Delete action item\"]");
    $bobPage->assertNotPresent("#action-item-{$guestItem->id}")
        ->assertSeeIn('aside', 'Rotate the on-call');

    expect($retro->actionItems()->pluck('content')->all())->toBe(['Rotate the on-call']);
});
```

Facts this relies on: in Discussing each column shows a "Sort by votes" toggle (`retro-column.tsx`) that starts pressed; for a member it is the only `button[aria-pressed]` inside a column when no card has a reaction. The facilitator's "Discuss" button is the only `button[aria-pressed]` inside a card under the same condition; highlighting sets `ring-2 ring-primary` on the card and `Board` calls `scrollIntoView` on `#card-{id}` for every viewer (`board.tsx`). The action items panel is the only `<aside>` on the page when the retro has no AI insights; its form submits on Enter (`action-item-form.tsx`), and each item is `<li id="action-item-{id}">` with a checkbox labelled "Mark as done" or "Reopen" (`action-item-card.tsx`). A participant can complete and delete their own items (`lib/action-items/permissions.ts`).

- [ ] **Step 11: Run the Discussing tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan04RetroCoreTest.php --filter="P04-05"`
Expected: PASS (3 tests).

- [ ] **Step 12: Add the Completed test and the phase flow test**

Append to the same file:

```php
it('[P04-06] shows the summary and a read-only board once Completed', function () {
    [$retro, $columns, , $bob, $aliceParticipant, $bobParticipant] = plan04Board(RetroPhase::Completed, [
        'completed_at' => now(),
    ]);
    $slow = plan04Card($retro, $columns[0], $aliceParticipant, 'Slow CI', 0);
    plan04Card($retro, $columns[0], $bobParticipant, 'Flaky tests', 1);
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $slow->id, 'participant_id' => $bobParticipant->id]);
    ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'content' => 'Buy a faster runner',
        'created_by_participant_id' => $aliceParticipant->id,
    ]);

    $page = $this->signIn($bob, "/retros/{$retro->id}");

    $page->assertSeeIn('[aria-current="step"]', 'Completed')
        ->assertSee('Retrospective completed on')
        ->assertSee('Top topics')
        ->assertSee('Slow CI')
        ->assertSee('Action items')
        ->assertSee('Buy a faster runner')
        ->assertNotPresent('[aria-label="Add an action item…"]')
        ->click('#completed-tab-board')
        ->assertPresent("#card-{$slow->id} [aria-label=\"2 votes\"]")
        ->assertSee('Flaky tests')
        ->assertNotPresent('[aria-label="Add a card…"]')
        ->assertNotPresent('[aria-label="Add a vote"]')
        ->assertNotPresent('[aria-label="Edit card"]')
        ->assertNotPresent('[aria-label="Delete card"]')
        ->assertNotPresent('[aria-label="Add an action item…"]');
});

it('[P04-07] follows the facilitator through every phase, a reopen and a second completion', function () {
    [$retro, $columns, $alice, $bob, , $bobParticipant] = plan04Board();
    plan04Card($retro, $columns[0], $bobParticipant, 'Pair on reviews');
    $current = '[aria-current="step"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->assertSeeIn($current, 'Writing')->assertSee('Hidden until writing ends');
    $bobPage->assertSeeIn($current, 'Writing')->assertCount('[aria-label="Add a card…"]', 3);

    $alicePage->press('Next')->assertSeeIn($current, 'Grouping')->assertSee('Pair on reviews');
    $bobPage->assertSeeIn($current, 'Grouping')
        ->assertSee('Drag cards onto each other to group them.')
        ->assertNotPresent('[aria-label="Add a card…"]');

    $alicePage->press('Next')->assertSeeIn($current, 'Voting');
    $bobPage->assertSeeIn($current, 'Voting')
        ->assertSee('Votes left: 5')
        ->assertPresent('[aria-label="Add a vote"]');

    $alicePage->press('Next')->assertSeeIn($current, 'Discussing');
    $bobPage->assertSeeIn($current, 'Discussing')
        ->assertNotPresent('[aria-label="Add a vote"]')
        ->assertPresent('[aria-label="Add an action item…"]');

    $alicePage->press('Complete')->assertSeeIn($current, 'Completed');
    $bobPage->assertSeeIn($current, 'Completed')
        ->assertSee('Top topics')
        ->assertNotPresent('[aria-label="Add an action item…"]');
    expect($retro->fresh()->completed_at)->not->toBeNull();

    $alicePage->press('Reopen')->assertSeeIn($current, 'Discussing');
    $bobPage->assertSeeIn($current, 'Discussing')
        ->assertPresent('[aria-label="Add an action item…"]');
    expect($retro->fresh()->completed_at)->toBeNull();

    $alicePage->press('Complete')->assertSeeIn($current, 'Completed');
    $bobPage->assertSeeIn($current, 'Completed')->assertSee('Top topics');

    expect($retro->fresh()->phase)->toBe(RetroPhase::Completed);
});
```

Facts this relies on: in Completed the board opens on the "Results" tab (`results/results-view.tsx`: "Retrospective completed on :date", "Top topics", "Action items"); the cards are behind the "Board" tab, a `<button id="completed-tab-board">` (`results/completed-tabs.tsx`). `PhaseStepper` (`phase-stepper.tsx`) marks the current phase with `aria-current="step"` and gives the facilitator the buttons "Next", "Complete" (when the next phase is Completed) and "Reopen" (in Completed). The factory's vote limit is 5.

- [ ] **Step 13: Run the Completed and phase flow tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan04RetroCoreTest.php --filter="P04-06|P04-07"`
Expected: PASS (2 tests).

- [ ] **Step 14: Add the timer and anonymity tests**

Append to the same file:

```php
it('[P04-08a] shows the one minute timer to every participant during Writing', function () {
    [$retro, , $alice, $bob] = plan04Board();
    $isCountingDown = "/^(1:00|0:[3-5]\\d)$/.test(document.querySelector('[role=\"timer\"]').innerText.trim())";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $bobPage->assertNotPresent('[role="timer"]');

    $alicePage->click('[aria-label="Timer"]')
        ->assertSee('1 min')
        ->click('1 min');

    foreach ([$alicePage, $bobPage, $carolPage] as $page) {
        $page->assertPresent('[role="timer"]')->assertScript($isCountingDown, true);
    }

    expect($retro->fresh()->timer_ends_at)->not->toBeNull();

    $alicePage->click('[aria-label="Timer"]')
        ->assertSee('Stop timer')
        ->click('Stop timer');

    foreach ([$alicePage, $bobPage, $carolPage] as $page) {
        $page->assertNotPresent('[role="timer"]');
    }

    expect($retro->fresh()->timer_ends_at)->toBeNull();
});

it('[P04-08b] tells the participant when the timer reaches zero', function () {
    [$retro, , , $bob] = plan04Board();
    $retro->update(['timer_ends_at' => now()->addSeconds(3)]);

    $page = $this->signIn($bob, "/retros/{$retro->id}");

    $page->assertSeeIn('[role="timer"]', "Time's up!");
});

it('[P04-09] never shows the author of another participant\'s card on an anonymous retro', function (string $phase) {
    [$retro, $columns, , $bob, $aliceParticipant, $bobParticipant] = plan04Board(RetroPhase::from($phase), [
        'is_anonymous' => true,
        'completed_at' => $phase === RetroPhase::Completed->value ? now() : null,
    ]);
    $theirs = plan04Card($retro, $columns[0], $aliceParticipant, 'Too many meetings', 0);
    $mine = plan04Card($retro, $columns[0], $bobParticipant, 'Pairing works well', 1);

    $page = $this->signIn($bob, "/retros/{$retro->id}");

    if ($phase === RetroPhase::Completed->value) {
        $page->click('#completed-tab-board');
    }

    $page->assertSeeIn("#card-{$mine->id}", 'Pairing works well')
        ->assertSeeIn("#card-{$mine->id}", 'Bob Stone')
        ->assertDontSeeIn("#card-{$theirs->id}", 'Alice Martin');

    if ($phase === RetroPhase::Writing->value) {
        $page->assertSeeIn("#card-{$theirs->id}", 'Hidden until writing ends');

        return;
    }

    $page->assertSeeIn("#card-{$theirs->id}", 'Too many meetings');
})->with(['writing', 'grouping', 'voting', 'discussing', 'completed']);
```

Facts this relies on: the facilitator's timer menu (`timer-control.tsx`) is a button labelled "Timer" with the items "1 min", "3 min", "5 min", "10 min" and "Stop timer"; the countdown is `<span role="timer">` showing `m:ss` (`timer-display.tsx`, `formatSeconds`). At zero nothing happens on the server during Writing: the client shows "Time's up!" inside the timer element (and a toast and a beep if the page saw the timer running). `P04-08b` therefore uses a short real timer (spec §3.6) set through the model and asserts the timer element's text, which holds whether or not the page loaded before the three seconds ran out. `PresentCard` withholds the author of every card that is not the viewer's own when `is_anonymous` is on. The assertion is scoped to the card because participant names legitimately appear elsewhere (the presence strip, the results' participant list, and action items, which are not anonymous by design).

- [ ] **Step 15: Run the timer and anonymity tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan04RetroCoreTest.php --filter="P04-08|P04-09"`
Expected: PASS (7 tests: two timer tests and five anonymity cases).

- [ ] **Step 16: Add the guest link and deletion tests**

Append to the same file:

```php
it('[P04-10] ends a guest\'s access when the facilitator creates a new guest link', function () {
    [$retro, , $alice] = plan04Board();
    $oldToken = $retro->guest_token;
    $link = 'input[aria-label="Guest link"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$oldToken}", 'Carol Guest'));

    $carolPage->assertSeeIn('header h1', 'Sprint 12');

    $alicePage->click('[aria-label="Facilitator menu"]')
        ->assertSee('Guest link…')
        ->click('Guest link…')
        ->assertVisible($link)
        ->assertScript("document.querySelector('{$link}').value.includes('{$oldToken}')", true)
        ->press('Create a new link');

    $carolPage->assertSee('Your access to this retrospective has ended.')
        ->assertNotPresent('[aria-label="Add a card…"]');

    $alicePage->assertScript("document.querySelector('{$link}').value.includes('{$oldToken}')", false);

    $newLink = $alicePage->value($link);
    $newToken = $retro->fresh()->guest_token;

    expect($newToken)->not->toBe($oldToken)
        ->and($newLink)->toEndWith("/join/{$newToken}");

    visit("/join/{$oldToken}")->assertSee('This guest link is no longer valid.');

    $davePage = $this->joinAsGuest("/join/{$newToken}", 'Dave Guest');

    $davePage->assertSeeIn('header h1', 'Sprint 12')
        ->assertCount('[aria-label="Add a card…"]', 3);
});

it('[P04-11] tells a member that the retro was deleted', function () {
    [$retro, , $alice, $bob] = plan04Board();
    $teamPath = route('teams.show', [$retro->team->workspace, $retro->team], false);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->click('[aria-label="Facilitator menu"]')
        ->assertSee('Delete retrospective…')
        ->click('Delete retrospective…')
        ->assertSee('Delete this retrospective? Everyone loses access to it.')
        ->press('Delete');

    $bobPage->assertSee('This retrospective has been deleted.')
        ->assertSee('Back to the team')
        ->assertNotPresent('[aria-label="Add a card…"]');

    $alicePage->assertPathIs($teamPath);

    expect(Retro::query()->whereKey($retro->id)->exists())->toBeFalse();
});
```

Facts this relies on: `FacilitatorMenu` (`facilitator-menu.tsx`) is a button labelled "Facilitator menu" with the items "Settings…", "Guest link…", "Hand over facilitation…" and "Delete retrospective…". `GuestLinkDialog` shows the link in a read-only input labelled "Guest link" and the button "Create a new link"; the test reads the link from that input (spec §3.6). `RetroGuestTokensController::store` clears every guest's secret and broadcasts `settings.changed`; the guest's page refetches the snapshot, gets a 403 and shows `BoardEnded` with "Your access to this retrospective has ended." `RetrosController::destroy` broadcasts `retro.deleted`, on which the other pages show "This retrospective has been deleted." and, for members, a "Back to the team" button; the facilitator's own page goes to the team page.

- [ ] **Step 17: Run the guest link and deletion tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan04RetroCoreTest.php --filter="P04-10|P04-11"`
Expected: PASS (2 tests).

- [ ] **Step 18: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan04RetroCoreTest.php`
Expected: PASS (18 test cases: 14 tests, of which `P04-09` runs five times). A failure means a wrong selector or a product defect: fix the selector if the interface text differs, otherwise report it under the plan header's defect rule.

- [ ] **Step 19: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: exits 0; any formatting it applies to the new test file is kept.

- [ ] **Step 20: Commit**

```bash
git add resources/js/components/retro/retro-column.tsx resources/js/components/retro/dnd.tsx tests/Browser/Walkthroughs/Plan04RetroCoreTest.php
git commit -m "test(browser): cover the retro core walkthrough phase flow"
```

---

### Task 12b: Plan 4 walkthrough, Steps 2 to 4 (resilience, accessibility and layout, i18n)

This task automates Steps 2, 3 and 4 of the plan 4 walkthrough (`docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1794` to `:1796`), items `P04-12` to `P04-17`. It changes no product code. The Reverb test stops the shared Reverb server, so it is the last test of the file and restores the server in a `finally` block.

**Files:**
- Modify: `tests/Browser/Walkthroughs/Plan04RetroCoreTest.php` (appends ten tests)
- Test: `tests/Browser/Walkthroughs/Plan04RetroCoreTest.php`

**Interfaces:**
- Consumes: everything Task 12a consumes; the hooks `data-test="retro-column-{columnId}"` and `data-test="retro-card-handle-{cardId}"` and the helpers `plan04Board()`, `plan04Card()`, `plan04Column()`, `plan04CardOrder()` from Task 12a; `Tests\Browser\Support\ReverbServer::stop(): void` and `ReverbServer::start(): void` (Task 2), already imported at the top of the file by Task 12a.
- Produces: nothing that later tasks rely on.

- [ ] **Step 1: Add the refused-action test**

Append to `tests/Browser/Walkthroughs/Plan04RetroCoreTest.php`:

```php
it('[P04-13] shows a translated toast and resyncs the board when the server refuses a vote', function (string $locale, string $addVoteLabel, string $toast, string $discussing) {
    [$retro, $columns, , $bob, $aliceParticipant] = plan04Board(RetroPhase::Voting);
    $bob->update(['locale' => $locale]);
    $card = plan04Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $addVote = "#card-{$card->id} [aria-label=\"{$addVoteLabel}\"]";

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertPresent($addVote);

    $retro->update(['phase' => RetroPhase::Discussing]);

    $page->click($addVote)
        ->assertSee($toast)
        ->assertSeeIn('[aria-current="step"]', $discussing)
        ->assertNotPresent($addVote)
        ->assertPresent('aside');

    expect($retro->votes()->count())->toBe(0);
})->with([
    'en' => ['en', 'Add a vote', 'This action is not available in the current phase.', 'Discussing'],
    'fr' => ['fr', 'Ajouter un vote', "Cette action n'est pas disponible dans la phase actuelle.", 'Discussion'],
]);
```

How the refusal is arranged: the member's page is loaded in Voting, then the phase is changed through the model, which broadcasts nothing, so the page still shows the vote buttons. The click reaches `CardVotesController::store`, where `RetroGuard::phase` throws an `AuthorizationException` with the message translated into the request's locale (HTTP 403). `useRetroBoard().run` shows that message with `toast.error` and refetches the snapshot, after which the board shows Discussing (the action items `<aside>` appears and the vote buttons disappear). The French case proves the toast is translated; its strings are the values of the keys "Add a vote", "This action is not available in the current phase." and "Discussing" in `lang/fr.json`.

- [ ] **Step 2: Run the refused-action test**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan04RetroCoreTest.php --filter="P04-13"`
Expected: PASS (2 cases). If the French case fails at sign-in, see Task 1's findings (the sign-in helper must not depend on English text after the login form is submitted).

- [ ] **Step 3: Add the four keyboard tests**

Append to the same file:

```php
it('[P04-14a] writes a card with the keyboard only', function () {
    [$retro, $columns, $alice, $bob] = plan04Board();
    $start = plan04Column($columns[0]);
    $composer = "{$start} textarea";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->type($composer, 'Typed without a mouse')
        ->keys($composer, 'Enter')
        ->assertSeeIn('article[id^="card-"]', 'Typed without a mouse')
        ->assertValue($composer, '');

    $alicePage->assertCount('article[id^="card-"]', 1)
        ->assertSee('Hidden until writing ends');

    expect($retro->cards()->where('content', 'Typed without a mouse')->exists())->toBeTrue();
});

it('[P04-14b] casts and retracts a vote with the keyboard only', function () {
    [$retro, $columns, , $bob, $aliceParticipant] = plan04Board(RetroPhase::Voting);
    $card = plan04Card($retro, $columns[0], $aliceParticipant, 'Slow CI');

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertSee('Votes left: 5')
        ->keys("#card-{$card->id} [aria-label=\"Add a vote\"]", 'Enter')
        ->assertSee('Votes left: 4');

    expect($retro->votes()->count())->toBe(1);

    $page->keys("#card-{$card->id} [aria-label=\"Remove a vote\"]", 'Space')
        ->assertSee('Votes left: 5');

    expect($retro->votes()->count())->toBe(0);
});

it('[P04-14c] reorders a card with the keyboard sensor during Writing', function () {
    [$retro, $columns, $alice, $bob, , $bobParticipant] = plan04Board();
    $first = plan04Card($retro, $columns[0], $bobParticipant, 'First thought', 0);
    $second = plan04Card($retro, $columns[0], $bobParticipant, 'Second thought', 1);
    $order = plan04CardOrder($columns[0]);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertScript($order, "card-{$first->id},card-{$second->id}");

    $this->dragWithKeyboard($bobPage, "@retro-card-handle-{$first->id}", ['Space', 'ArrowDown', 'Space']);

    $bobPage->assertScript($order, "card-{$second->id},card-{$first->id}");
    $alicePage->assertScript($order, "card-{$second->id},card-{$first->id}");

    expect($first->fresh()->position)->toBeGreaterThan($second->fresh()->position);
});

it('[P04-14d] opens every facilitator dialog with the keyboard only', function () {
    [$retro, , $alice] = plan04Board();
    $dialogs = [
        1 => 'Retrospective settings',
        2 => 'Guest link',
        3 => 'Hand over facilitation',
        5 => 'Delete retrospective',
    ];

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    foreach ($dialogs as $position => $title) {
        $page->keys('[aria-label="Facilitator menu"]', 'Enter')
            ->assertPresent('[role="menu"]')
            ->keys("[role=\"menu\"] > :nth-child({$position})", 'Enter')
            ->assertSeeIn('[role="dialog"]', $title)
            ->keys('[role="dialog"]', 'Escape')
            ->assertNotPresent('[role="dialog"]');
    }

    $page->keys('[aria-label="Timer"]', 'Enter')
        ->assertSeeIn('[role="menu"]', '1 min')
        ->assertSeeIn('[role="menu"]', 'Stop timer')
        ->keys('[role="menu"]', 'Escape')
        ->assertNotPresent('[role="menu"]');
});
```

Facts this relies on: the composer submits on Enter (`card-composer.tsx`, `onKeyDown`); in Writing only the author's own cards are draggable (`retro-column.tsx`: `disabled={!ctx.isEditable || !card.isMine}`), each wrapped in `SortableCard`, and a card the viewer cannot read still renders `<article id="card-{id}">`, so the facilitator's page can observe the new order although it shows placeholders. The facilitator menu's content has five children in this order: "Settings…", "Guest link…", "Hand over facilitation…", a separator, "Delete retrospective…" (`facilitator-menu.tsx`); the dialogs' titles are "Retrospective settings" (`settings-dialog.tsx`), "Guest link" (`guest-link-dialog.tsx`), "Hand over facilitation" (`handover-dialog.tsx`) and "Delete retrospective" (`delete-retro-dialog.tsx`). The walkthrough's "move a card with the keyboard sensor" is covered twice: here for the Writing phase (sortable reorder) and in `P04-03` for the Grouping phase (group, then move to another column).

- [ ] **Step 4: Run the keyboard tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan04RetroCoreTest.php --filter="P04-14"`
Expected: PASS (4 tests). If the keyboard drag or the key presses on menus and dialogs fail, see Task 1's findings.

- [ ] **Step 5: Add the layout and dark mode tests**

Append to the same file:

```php
it('[P04-15a] reflows the board between 375px and 1440px', function () {
    [$retro, $columns, , $bob, $aliceParticipant] = plan04Board(RetroPhase::Discussing);
    plan04Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $columnsScroll = "(() => { const board = document.querySelector('main'); return board.scrollWidth > board.clientWidth; })()";
    $stepperWrapsBelowTitle = "document.querySelector('header ol[aria-label=\"Phases\"]').getBoundingClientRect().top >= document.querySelector('header h1').getBoundingClientRect().bottom";
    $panelIsBelowBoard = "document.querySelector('aside').getBoundingClientRect().top >= document.querySelector('main').getBoundingClientRect().bottom";
    $panelIsBesideBoard = "document.querySelector('aside').getBoundingClientRect().left >= document.querySelector('main').getBoundingClientRect().right";

    $page = $this->signIn($bob, "/retros/{$retro->id}");

    $page->resize(375, 812)
        ->assertPresent('aside')
        ->assertScript($columnsScroll, true)
        ->assertScript($stepperWrapsBelowTitle, true)
        ->assertScript($panelIsBelowBoard, true)
        ->assertScript($panelIsBesideBoard, false);

    $page->resize(1440, 900)
        ->assertScript($stepperWrapsBelowTitle, false)
        ->assertScript($panelIsBesideBoard, true)
        ->assertScript($panelIsBelowBoard, false);
});

it('[P04-16a] keeps the dark appearance on the board', function () {
    [$retro, , , $bob] = plan04Board();
    $isDark = 'document.documentElement.classList.contains("dark")';

    $page = $this->signIn($bob, '/settings/appearance');

    $page->assertScript($isDark, false)
        ->click('Dark')
        ->assertScript($isDark, true)
        ->assertScript('localStorage.getItem("appearance")', 'dark')
        ->navigate("/retros/{$retro->id}")
        ->assertSeeIn('header h1', 'Sprint 12')
        ->assertScript($isDark, true);
});
```

Facts this relies on: the columns live in the page's only `<main>`, which has `overflow-x-auto`, and each column is 18rem wide, so three columns overflow a 375px viewport; the board header is `flex flex-wrap`; the action items panel is the only `<aside>` and sits in a container that is `flex-col` below the `lg` breakpoint and `lg:flex-row` above it (`board.tsx`, `action-items-panel.tsx`). The appearance page (`pages/settings/appearance.tsx`, `appearance-tabs.tsx`) has the buttons "Light", "Dark" and "System"; choosing "Dark" stores `appearance=dark` in local storage and in a cookie and sets the `dark` class on `<html>` (`hooks/use-appearance.tsx`, `resources/views/app.blade.php`). The test starts from the browser's default light scheme; it drives the real settings page instead of the plugin's `inDarkMode()` because `signIn()` owns the first visit of the context. These two tests assert the structural facts only. Whether the two widths and the dark theme look right is a visual judgement and stays on the residual checklist (`P04-15b`, `P04-16b`).

- [ ] **Step 6: Run the layout and dark mode tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan04RetroCoreTest.php --filter="P04-15|P04-16"`
Expected: PASS (2 tests). If `P04-16a` fails on its first assertion because the browser context starts in a dark colour scheme, see Task 1's findings.

- [ ] **Step 7: Add the two i18n tests**

Append to the same file:

```php
dataset('plan04Locales', [
    'fr' => ['fr', 'Français', 'Langue', 'Écriture', 'Regroupement', "Masquée jusqu'à la fin de la rédaction", 'Ajouter une carte…', 'Vous'],
    'es' => ['es', 'Español', 'Idioma', 'Escritura', 'Agrupación', 'Oculta hasta que termine la escritura', 'Añadir una tarjeta…', 'Tú'],
    'de' => ['de', 'Deutsch', 'Sprache', 'Schreiben', 'Gruppieren', 'Verborgen, bis die Schreibphase endet', 'Karte hinzufügen…', 'Du'],
]);

it('[P04-17a] translates the board after a member changes language in the settings', function (string $locale, string $languageName, string $languageLabel, string $writing, string $grouping, string $hidden, string $composer, string $you) {
    [$retro, $columns, , $bob, $aliceParticipant, $bobParticipant] = plan04Board();
    $theirs = plan04Card($retro, $columns[0], $aliceParticipant, 'Too many meetings', 0);
    $mine = plan04Card($retro, $columns[0], $bobParticipant, 'Pairing works well', 1);

    $page = $this->signIn($bob, '/settings/appearance');

    $page->assertPresent('[aria-label="Language"]')
        ->click('[aria-label="Language"]')
        ->assertPresent('[role="listbox"]')
        ->click($languageName)
        ->assertPresent("[aria-label=\"{$languageLabel}\"]");

    expect($bob->fresh()->locale)->toBe($locale);

    $page->navigate("/retros/{$retro->id}")
        ->assertSeeIn('[aria-current="step"]', $writing)
        ->assertSeeIn('header ol', $grouping)
        ->assertSeeIn("#card-{$theirs->id}", $hidden)
        ->assertSeeIn("#card-{$mine->id}", $you)
        ->assertCount("[aria-label=\"{$composer}\"]", 3)
        ->assertDontSee('Hidden until writing ends')
        ->assertNotPresent('[aria-label="Add a card…"]')
        ->assertDontSeeIn('header ol', 'Writing');
})->with('plan04Locales');

it('[P04-17b] translates the board after a guest changes language in the header', function (string $locale, string $languageName, string $languageLabel, string $writing, string $grouping, string $hidden, string $composer, string $you) {
    [$retro, $columns, , , $aliceParticipant] = plan04Board();
    $theirs = plan04Card($retro, $columns[0], $aliceParticipant, 'Too many meetings');

    $page = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $page->assertSeeIn('[aria-current="step"]', 'Writing')
        ->click('header [aria-label="Language"]')
        ->assertPresent('[role="listbox"]')
        ->click($languageName)
        ->assertPresent("header [aria-label=\"{$languageLabel}\"]")
        ->assertSeeIn('[aria-current="step"]', $writing)
        ->assertSeeIn('header ol', $grouping)
        ->assertSeeIn("#card-{$theirs->id}", $hidden)
        ->assertCount("[aria-label=\"{$composer}\"]", 3)
        ->assertDontSee('Hidden until writing ends')
        ->assertNotPresent('[aria-label="Add a card…"]')
        ->assertDontSeeIn('header ol', 'Writing');
})->with('plan04Locales');
```

Facts this relies on: members change language on the appearance settings page, which renders `LanguageSwitcher` under the heading "Language" (`pages/settings/appearance.tsx`); guests get the same switcher in the board header (`board-header.tsx`: `{board.viewer.isGuest && <LanguageSwitcher />}`). The switcher is a Radix select whose trigger has `aria-label` "Language" and whose options are the language names "English", "Français", "Español" and "Deutsch", identical in every locale (`language-switcher.tsx`). Choosing one sends `PUT /locale`; `LocalesController::update` stores the locale on the user (members) and in a `locale` cookie (everyone), and `SetLocale` applies it to every later request. The trigger's translated label ("Langue", "Idioma", "Sprache") is the signal that the change was applied. The strings in the dataset are the values of the keys "Language", "Writing", "Grouping", "Hidden until writing ends", "Add a card…" and "You" in `lang/fr.json`, `lang/es.json` and `lang/de.json`. The guest test receives the same eight dataset values and does not use `$locale` and `$you`: a guest has written no card, so there is no "You" badge to check. The composer is asserted with `assertCount(…, 3)` because each of the three columns has one.

- [ ] **Step 8: Run the i18n tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan04RetroCoreTest.php --filter="P04-17"`
Expected: PASS (6 cases: three locales for each of the two tests). If the click on the language name does not select the option of the Radix select, see Task 1's findings.

- [ ] **Step 9: Add the Reverb test as the last test of the file**

Append to the very end of the same file. No test may be added after this one.

```php
it('[P04-12] shows the reconnecting banner and catches up when Reverb comes back', function () {
    [$retro, $columns, $alice, $bob, $aliceParticipant] = plan04Board();
    plan04Card($retro, $columns[0], $aliceParticipant, 'Deploy on Fridays');
    $start = plan04Column($columns[0]);
    $composer = "{$start} textarea";
    $add = "{$start} form button:not([type=\"button\"])";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertSee('Hidden until writing ends')
        ->assertDontSee('Reconnecting…');

    ReverbServer::stop();

    try {
        $bobPage->assertSee('Reconnecting…');
        $alicePage->assertSee('Reconnecting…');

        $alicePage->fill($composer, 'Add a staging environment')
            ->click($add)
            ->assertSee('Add a staging environment')
            ->press('Next')
            ->assertSeeIn('[aria-current="step"]', 'Grouping');

        $bobPage->assertSeeIn('[aria-current="step"]', 'Writing')
            ->assertDontSee('Add a staging environment');
    } finally {
        ReverbServer::start();
    }

    $bobPage->assertDontSee('Reconnecting…')
        ->assertSeeIn('[aria-current="step"]', 'Grouping')
        ->assertSee('Deploy on Fridays')
        ->assertSee('Add a staging environment');

    $alicePage->assertDontSee('Reconnecting…');

    expect($retro->fresh()->phase)->toBe(RetroPhase::Grouping);
});
```

Facts this relies on: `ConnectionBanner` (`connection-banner.tsx`) renders `<div role="status">Reconnecting…</div>` while the Echo connection that was once connected is not connected (`use-retro-channel.ts`: `reconnecting`). The test finds it by its text and not by `[role="status"]`, because dnd-kit's live region on the same page also has `role="status"` and an explicit selector must match exactly one element. With Reverb down the facilitator's requests still succeed, because every retro broadcast goes through `SendsToOthers::sendToOthers()`, which wraps `broadcast()` in `rescue()`. When the connection returns, the presence and private channels resubscribe, `scheduleResync` fires and the page refetches the snapshot, which is the catch-up the walkthrough asks for. This is the "go offline, come back" substitution of spec §3.6.

- [ ] **Step 10: Run the Reverb test**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan04RetroCoreTest.php --filter="P04-12"`
Expected: PASS (1 test). If the banner does not appear or the page does not reconnect within the assertion timeout, see Task 1's findings.

- [ ] **Step 11: Run the whole file twice**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan04RetroCoreTest.php`
Expected: PASS (33 test cases: the 18 of Task 12a plus 15 here: `P04-13` twice, `P04-14a` to `P04-14d`, `P04-15a`, `P04-16a`, `P04-17a` and `P04-17b` three times each, `P04-12`).

Run the same command a second time.
Expected: PASS again with the same count, which shows the Reverb test left the server running for the next run. A failure means a wrong selector or a product defect: fix the selector if the interface text differs, otherwise report it under the plan header's defect rule.

- [ ] **Step 12: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: exits 0.

- [ ] **Step 13: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan04RetroCoreTest.php
git commit -m "test(browser): cover the retro core walkthrough resilience, accessibility and i18n steps"
```

### Task 13: Plan 10b walkthrough, part 1: saved decks, spectators, anonymous rounds, toggles, ended game, retro regression, translations

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php`
- Modify: none (no product file changes; every target is reachable by an id, a role, an aria-label or exact English text)
- Test: `tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php`

**Interfaces:**
- Consumes (harness, Tasks 1–4): `Tests\BrowserTestCase` bound to `tests/Browser` in `tests/Pest.php`; `$this->signIn(User $user, string $to): mixed`; `$this->joinAsGuest(string $joinUrl, string $name): mixed`; `$this->awaitRealtime(mixed $page): mixed`; the global `visit(string $url)`; `data-realtime="connected"` on the root of `poker/show` and `retros/show`.
- Consumes (existing helpers in `tests/Pest.php`): `teamMember(Team $team): User`, `pokerFacilitator(PokerGame $game): array`, `pokerMember(PokerGame $game): array`, `openPokerRound(PokerGame $game, ?PokerTask $task = null): PokerRound`, `pokerVote(PokerRound $round, PokerPlayer $player, string $value): PokerVote`, `retroFacilitator(Retro $retro): array`, `retroMember(Retro $retro): array`.
- Consumes (poker markup, no hook): Tasks 10–11 add one hook, `data-test="poker-task-row"`, and this fragment does not use it. Poker elements are targeted through their existing, unique markup, the same way Tasks 10–11 do:
  - a hand card for one value: `button[aria-label="Play 5"]` (`hand.tsx`, `label={t('Play :card', { card })}`).
  - a player's seat card: `[role="img"][aria-label="Bob: Voted"]`, `[role="img"][aria-label="Bob: Not voted yet"]`, and after a named reveal `[role="img"][aria-label="Bob: 8"]` (`players-grid.tsx`, `` label={`${player.name}: ${face === 'up' ? vote?.value : status}`} ``).
  - a task row: the exact task title text (`click('Checkout flow')`), used once in `[P10b-05]` while that task is not the current one, so the title appears only in its row.
- Produces: the test file and these file-level helper functions, which Task 14 reuses:
  - `p10bTable(array $attributes = []): array{game: PokerGame, ada: User, adaPlayer: PokerPlayer, bob: User, bobPlayer: PokerPlayer}`
  - `p10bJoinAsSpectator(PokerGame $game, string $name): mixed`
  - `p10bOpenSettings(mixed $page): mixed`
  - `p10bRenamed(User $user, string $name): User`

Facts the tests rely on (read from the code, quoted so a wrong selector can be fixed quickly):

| Element | Source | Selector used |
|---|---|---|
| Saved decks dialog trigger, "New deck", "Edit deck", "Delete deck", name and cards inputs `deck-new-name`, `deck-new-cards`, `deck-{id}-cards`, checkboxes `deck-new-unknown`, `deck-new-coffee` | `resources/js/components/teams/saved-decks-dialog.tsx` | exact text and `#id` |
| "New game" dialog, "Your team's decks" heading, deck radios (`role="radio"`), checkboxes `new-poker-anonymous`, `new-poker-auto-reveal`, "Create game" | `resources/js/components/teams/new-poker-game-dialog.tsx`, `resources/js/components/poker/deck-fields.tsx` | exact text, `#id`, `[role="radio"]:has-text("…")` |
| Facilitator menu (`aria-label="Facilitator menu"`), items "Settings…", "Guest link…", "End game", "Reopen game" | `resources/js/components/poker/game-menu.tsx` | aria-label, exact text, `[role="menuitem"]:has-text("…")` |
| Settings dialog "Game settings", checkboxes `poker-auto-reveal`, `poker-anonymous-votes`, `poker-cursors`, `poker-reactions`, "Save" | `resources/js/components/poker/game-settings-dialog.tsx` | `#id`, exact text |
| Guest link dialog: checkbox `poker-guest-link-access`, read-only input `aria-label="Guest link"` | `resources/js/components/poker/game-guest-link-dialog.tsx` | `#id`, `input[aria-label="Guest link"]` |
| Join page: input `name`, checkbox `spectator`, button "Join" | `resources/js/pages/poker/join.tsx` | `name`, `#spectator`, exact text |
| Header badges "Anonymous votes", "Auto-reveal", "Game ended"; "Watch only" / "Play" toggle; "Hide my cursor" / "Show my cursor" button; guest-only language select (`aria-label="Language"`) | `resources/js/components/poker/game-header.tsx`, `spectator-toggle.tsx`, `resources/js/components/language-switcher.tsx` | text and aria-label |
| Spectator text "You're watching — switch to Play to vote"; hand group `role="group" aria-label="Your cards"`; hand card `aria-label="Play :card"` with `aria-pressed` | `resources/js/components/poker/hand.tsx`, `poker-card.tsx` | text, role and aria-label |
| Seat card `role="img" aria-label="{name}: Voted \| Not voted yet \| {value}"`; "Player options" menu with "Make spectator" / "Make player"; `section[aria-label="Watching"]`; `section[aria-label="Anonymous votes"]` | `resources/js/components/poker/players-grid.tsx`, `watching-row.tsx`, `anonymous-values-row.tsx`, `spectator-toggle.tsx` | role and aria-label |
| Eye badge of a spectator in the presence strip: `svg[aria-label="Watching"]` next to `img[data-presence-id]`; strip `role="group" aria-label=":count online"` | `resources/js/components/poker/game-header.tsx`, `resources/js/components/retro/presence-strip.tsx` | attribute selectors |
| Round history trigger "Rounds (:count)", anonymous history line "3 × 1" | `resources/js/components/poker/task-detail.tsx`, `round-votes.tsx` | `button:has-text("Rounds (1)")`, text |
| Cursor layer `.lc-overlay` holding `.lc-cursor` with `.lc-label` (the sender's name); reactions bar `role="toolbar" aria-label="Reactions"` with buttons `aria-label="Send a reaction {emoji}"`; flying layer `.lr-overlay` holding `.lr-reaction` with an optional `.lr-label` | `resources/js/components/realtime/live-cursors.tsx`, `flying-reactions.tsx`, packages `live-cursors` and `live-reactions` 0.2 (`dist/react.mjs`) | class and aria-label |

Selector rules that shape the code below (from the plugin source): a plain string is matched as exact text unless it contains one of `[ ] # > + ~ : * | ^ , = ( )` or a `.class` pattern, in which case it is treated as CSS; that is why "Rounds (1)" is written as `button:has-text("Rounds (1)")`. A CSS selector must match exactly one element when it is used by an action, `assertSeeIn`, `assertAttribute` or `assertEnabled`; `assertPresent` and `assertNotPresent` count matches. Actions are not retried, so every action on something that appears after a click or a broadcast is preceded by an assertion on it.

- [ ] **Step 1: Create the test file with its helpers and the saved-deck tests**

`php artisan make:test` cannot target `tests/Browser`, so create the file directly. Create `tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php` with this content:

```php
<?php

use App\Enums\PokerRevealReason;
use App\Enums\RetroPhase;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\DB;

function p10bRenamed(User $user, string $name): User
{
    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return $user;
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     game: PokerGame,
 *     ada: User,
 *     adaPlayer: PokerPlayer,
 *     bob: User,
 *     bobPlayer: PokerPlayer
 * }
 */
function p10bTable(array $attributes = []): array
{
    $game = PokerGame::factory()->withGuestAccess()->create(['title' => 'Sprint planning', ...$attributes]);
    [$ada, $adaPlayer] = pokerFacilitator($game);
    [$bob, $bobPlayer] = pokerMember($game);

    return [
        'game' => $game,
        'ada' => p10bRenamed($ada, 'Ada'),
        'adaPlayer' => $adaPlayer,
        'bob' => p10bRenamed($bob, 'Bob'),
        'bobPlayer' => $bobPlayer,
    ];
}

function p10bJoinAsSpectator(PokerGame $game, string $name): mixed
{
    $page = visit(route('poker.join.show', $game->guest_token, false));

    $page->assertSee('Join as spectator')
        ->fill('name', $name)
        ->click('#spectator')
        ->assertAriaAttribute('#spectator', 'checked', 'true')
        ->click('Join')
        ->assertPathIs("/poker/{$game->id}");

    return $page;
}

function p10bOpenSettings(mixed $page): mixed
{
    return $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertSee('Game settings');
}

it('[P10b-01] saves a team deck, rejects a duplicate name and hides edit and delete from other members', function () {
    $team = Team::factory()->create();
    $ada = p10bRenamed(teamMember($team), 'Ada');
    $bob = p10bRenamed(teamMember($team), 'Bob');
    $teamPath = route('teams.show', [$team->workspace, $team], false);
    $chips = 'Array.from(document.querySelectorAll(\'[role="dialog"] li span.font-mono\')).map((chip) => chip.textContent).join(" ")';

    $a = $this->signIn($ada, $teamPath);

    $a->assertSee('Saved decks')
        ->click('Saved decks')
        ->assertSee('No saved decks yet.')
        ->click('New deck')
        ->assertAriaAttribute('#deck-new-unknown', 'checked', 'true')
        ->assertAriaAttribute('#deck-new-coffee', 'checked', 'true')
        ->fill('#deck-new-name', 'Team scale')
        ->fill('#deck-new-cards', '1, 2, 3, 5, 8')
        ->click('Save')
        ->assertSeeIn('[role="dialog"]', 'Team scale')
        ->assertScript($chips, '1 2 3 5 8 ? ☕')
        ->assertSee('Edit deck')
        ->assertSee('New deck')
        ->click('New deck')
        ->assertVisible('#deck-new-name')
        ->fill('#deck-new-name', 'team scale ')
        ->fill('#deck-new-cards', '1, 2')
        ->click('Save')
        ->assertSee('A deck with this name already exists.');

    expect(SavedPokerDeck::query()->count())->toBe(1);

    $b = $this->signIn($bob, $teamPath);

    $b->assertSee('Saved decks')
        ->click('Saved decks')
        ->assertSeeIn('[role="dialog"]', 'Team scale')
        ->assertDontSee('Edit deck')
        ->assertDontSee('Delete deck');
});

it('[P10b-02a] creates a game from a saved deck and keeps its cards when the deck is edited', function () {
    $team = Team::factory()->create();
    $ada = p10bRenamed(teamMember($team), 'Ada');
    $deck = SavedPokerDeck::factory()->create([
        'team_id' => $team->id,
        'name' => 'Team scale',
        'cards' => ['1', '2', '3', '5', '8', '?', '☕'],
        'created_by_user_id' => $ada->id,
    ]);
    $teamPath = route('teams.show', [$team->workspace, $team], false);

    $page = $this->signIn($ada, $teamPath);

    $page->assertSee('New game')
        ->click('New game')
        ->assertSee("Your team's decks")
        ->click('[role="radio"]:has-text("Team scale")')
        ->assertAriaAttribute('[role="radio"]:has-text("Team scale")', 'checked', 'true')
        ->assertAriaAttribute('#new-poker-anonymous', 'checked', 'false')
        ->assertAriaAttribute('#new-poker-auto-reveal', 'checked', 'false')
        ->click('Create game')
        ->assertPathBeginsWith('/poker/')
        ->assertSee('Team scale');

    $game = PokerGame::query()->sole();
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Checkout flow']);

    expect($game->cards)->toBe(['1', '2', '3', '5', '8', '?', '☕'])
        ->and($game->deck_name)->toBe('Team scale')
        ->and($game->anonymous_votes)->toBeFalse()
        ->and($game->auto_reveal)->toBeFalse();

    $page->navigate($teamPath)
        ->assertSee('Saved decks')
        ->click('Saved decks')
        ->assertSee('Edit deck')
        ->click('Edit deck')
        ->assertVisible("#deck-{$deck->id}-cards")
        ->fill("#deck-{$deck->id}-cards", '1, 2, 3, 5, 8, 13')
        ->click('Save')
        ->assertSeeIn('[role="dialog"] li', '13');

    expect($deck->fresh()->cards)->toContain('13');

    $page->navigate("/poker/{$game->id}")
        ->assertSee('Team scale')
        ->assertPresent('button[aria-label="Play 8"]')
        ->assertNotPresent('button[aria-label="Play 13"]');
});

it('[P10b-02b] keeps a game unchanged when its saved deck is deleted', function () {
    $cards = ['1', '2', '3', '5', '8', '?', '☕'];
    $game = PokerGame::factory()->customCards($cards)->create(['deck_name' => 'Team scale']);
    [$ada] = pokerFacilitator($game);
    p10bRenamed($ada, 'Ada');
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Checkout flow']);
    SavedPokerDeck::factory()->create([
        'team_id' => $game->team_id,
        'name' => 'Team scale',
        'cards' => $cards,
        'created_by_user_id' => $ada->id,
    ]);

    $page = $this->signIn($ada, route('teams.show', [$game->team->workspace, $game->team], false));

    $page->assertSee('Saved decks')
        ->click('Saved decks')
        ->assertSee('Delete deck')
        ->click('Delete deck')
        ->assertSee('Games that use it keep their cards.')
        ->click('button:has-text("Delete deck") >> nth=1')
        ->assertSee('No saved decks yet.');

    expect(SavedPokerDeck::query()->count())->toBe(0);

    $page->navigate("/poker/{$game->id}")
        ->assertSee('Team scale')
        ->assertPresent('button[aria-label="Play 8"]');
});

it('[P10b-02c] offers saved decks to the facilitator only, never to a guest', function () {
    ['game' => $game, 'ada' => $ada] = p10bTable();
    SavedPokerDeck::factory()->create([
        'team_id' => $game->team_id,
        'name' => 'Team scale',
        'created_by_user_id' => $ada->id,
    ]);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest(route('poker.join.show', $game->guest_token, false), 'Casey'));

    p10bOpenSettings($a)
        ->assertSee("Your team's decks")
        ->assertSee('Team scale');

    $guest->assertPresent('[aria-label="Language"]')
        ->assertNotPresent('[aria-label="Facilitator menu"]')
        ->assertDontSee('Team scale');
});
```

- [ ] **Step 2: Run the saved-deck tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php --filter='P10b-0[12]'`
Expected: PASS, 4 tests. These tests check behaviour that already exists, so there is no red run. A failure means a wrong selector or a product defect: if the UI text or attribute differs from the table above, fix the selector; otherwise report it under the plan header's defect rule.

- [ ] **Step 3: Add the spectator tests**

Append to `tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php`. The guest link is read from the dialog's input (substitution for the clipboard, spec §3.6), and only its path is used so the test does not depend on the host the link was built with.

```php
it('[P10b-03] lets a guest join as a spectator who watches without a hand', function () {
    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable(['guest_access_enabled' => false]);
    openPokerRound($game);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $a->click('[aria-label="Facilitator menu"]')
        ->assertSee('Guest link…')
        ->click('Guest link…')
        ->assertVisible('#poker-guest-link-access')
        ->click('#poker-guest-link-access')
        ->assertVisible('input[aria-label="Guest link"]');

    $joinPath = (string) parse_url($a->value('input[aria-label="Guest link"]'), PHP_URL_PATH);

    expect($joinPath)->toBe("/poker/join/{$game->guest_token}");

    $c = visit($joinPath);
    $c->assertSee('Join as spectator')
        ->fill('name', 'Casey')
        ->click('#spectator')
        ->assertAriaAttribute('#spectator', 'checked', 'true')
        ->click('Join')
        ->assertPathIs("/poker/{$game->id}");
    $this->awaitRealtime($c);

    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    $casey = PokerPlayer::query()->where('guest_name', 'Casey')->sole();

    expect($casey->is_spectator)->toBeTrue();

    $c->assertSee("You're watching — switch to Play to vote")
        ->assertNotPresent('[role="group"][aria-label="Your cards"]');

    $a->assertSeeIn('section[aria-label="Watching"]', 'Casey')
        ->assertPresent("span:has(> img[data-presence-id=\"{$casey->id}\"]) svg[aria-label=\"Watching\"]");

    $b->assertSeeIn('section[aria-label="Watching"]', 'Casey')
        ->assertEnabled('button[aria-label="Play 5"]')
        ->assertNotPresent("[role=\"img\"][aria-label=\"Casey: Not voted yet\"]");
});

it('[P10b-11a] lets the facilitator switch a player to spectator and back, and facilitate while watching', function () {
    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable();
    $round = openPokerRound($game);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    $b->assertEnabled('button[aria-label="Play 3"]')
        ->click('button[aria-label="Play 3"]');

    $a->assertPresent('[role="img"][aria-label="Bob: Voted"]')
        ->click('[aria-label="Player options"]')
        ->assertSee('Make spectator')
        ->click('Make spectator')
        ->assertSeeIn('section[aria-label="Watching"]', 'Bob')
        ->assertNotPresent('[role="img"][aria-label="Bob: Voted"]');

    $b->assertSee("You're watching — switch to Play to vote")
        ->assertNotPresent('[role="group"][aria-label="Your cards"]');

    expect($round->votes()->count())->toBe(0);

    $a->click('[aria-label="Player options"]')
        ->assertSee('Make player')
        ->click('Make player')
        ->assertPresent('[role="img"][aria-label="Bob: Not voted yet"]');

    $b->assertEnabled('button[aria-label="Play 5"]');

    $a->click('Watch only')
        ->assertSee("You're watching — switch to Play to vote")
        ->assertNotPresent('[role="group"][aria-label="Your cards"]');

    $b->click('button[aria-label="Play 5"]');

    $a->assertPresent('[role="img"][aria-label="Bob: Voted"]')
        ->assertSee('Show votes')
        ->click('Show votes')
        ->assertPresent('[role="img"][aria-label="Bob: 5"]')
        ->assertSee('Save estimate')
        ->click('Save estimate')
        ->assertSee('Estimate: 5')
        ->click('Re-vote')
        ->assertSee('Show votes')
        ->assertNotPresent('[role="group"][aria-label="Your cards"]');
});

it('[P10b-11b] lets a player switch to watching, which withdraws the open vote, and back to playing', function () {
    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable();
    $round = openPokerRound($game);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    $b->assertEnabled('button[aria-label="Play 3"]')
        ->click('button[aria-label="Play 3"]');

    $a->assertPresent('[role="img"][aria-label="Bob: Voted"]');

    $b->click('Watch only')
        ->assertSee("You're watching — switch to Play to vote")
        ->assertNotPresent('[role="group"][aria-label="Your cards"]');

    $a->assertSeeIn('section[aria-label="Watching"]', 'Bob')
        ->assertNotPresent('[role="img"][aria-label="Bob: Voted"]');

    expect($round->votes()->count())->toBe(0);

    $b->assertSee('Play')
        ->click('Play')
        ->assertEnabled('button[aria-label="Play 3"]');

    $a->assertPresent('[role="img"][aria-label="Bob: Not voted yet"]');
});
```

- [ ] **Step 4: Run the spectator tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php --filter='P10b-(03|11)'`
Expected: PASS, 3 tests. A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise report it under the plan header's defect rule.

- [ ] **Step 5: Add the anonymous-round tests**

Append to the same file. The first test starts on a revealed named round so that "Re-vote" opens the first anonymous round; the second starts on a revealed anonymous round built with factories.

```php
it('[P10b-10a] reveals an anonymous round as values without names', function () {
    ['game' => $game, 'ada' => $ada, 'adaPlayer' => $adaPlayer, 'bob' => $bob, 'bobPlayer' => $bobPlayer] = p10bTable();
    $round = openPokerRound($game);
    pokerVote($round, $adaPlayer, '8');
    pokerVote($round, $bobPlayer, '8');
    $round->forceFill(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual])->save();
    $values = 'Array.from(document.querySelectorAll(\'section[aria-label="Anonymous votes"] [role="img"]\')).map((card) => card.textContent).join(",")';

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    p10bOpenSettings($a)
        ->assertSee("With two voters, each can work out the other's vote from their own.")
        ->click('#poker-anonymous-votes')
        ->assertAriaAttribute('#poker-anonymous-votes', 'checked', 'true')
        ->click('Save');

    $b->assertSee('Anonymous votes');

    $a->assertSee('Re-vote')
        ->click('Re-vote')
        ->assertEnabled('button[aria-label="Play 3"]')
        ->click('button[aria-label="Play 3"]');

    $b->assertEnabled('button[aria-label="Play 5"]')
        ->click('button[aria-label="Play 5"]');

    $a->assertPresent('[role="img"][aria-label="Bob: Voted"]')
        ->click('Show votes');

    foreach ([$a, $b] as $page) {
        $page->assertPresent('section[aria-label="Anonymous votes"]')
            ->assertScript($values, '3,5')
            ->assertPresent('[role="img"][aria-label="Ada: Voted"]')
            ->assertPresent('[role="img"][aria-label="Bob: Voted"]')
            ->assertNotPresent('[role="img"][aria-label="Ada: 3"]')
            ->assertNotPresent('[role="img"][aria-label="Bob: 5"]')
            ->assertSee('Average');
    }

    $a->assertAriaAttribute('button[aria-label="Play 3"]', 'pressed', 'true')
        ->assertAriaAttribute('button[aria-label="Play 5"]', 'pressed', 'false');

    $b->assertAriaAttribute('button[aria-label="Play 5"]', 'pressed', 'true')
        ->assertAriaAttribute('button[aria-label="Play 3"]', 'pressed', 'false');
});

it('[P10b-10b] keeps a revealed anonymous round anonymous in the history after anonymity is turned off', function () {
    ['game' => $game, 'ada' => $ada, 'adaPlayer' => $adaPlayer, 'bobPlayer' => $bobPlayer] = p10bTable(['anonymous_votes' => true]);
    $round = openPokerRound($game);
    pokerVote($round, $adaPlayer, '3');
    pokerVote($round, $bobPlayer, '5');
    $round->forceFill(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual])->save();

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $a->assertPresent('section[aria-label="Anonymous votes"]')
        ->click('button:has-text("Rounds (1)")')
        ->assertSee('3 × 1')
        ->assertSee('5 × 1')
        ->assertDontSee('Ada: 3')
        ->assertDontSee('Bob: 5');

    p10bOpenSettings($a)
        ->click('#poker-anonymous-votes')
        ->assertSee('Applies from the next round.')
        ->click('Save')
        ->assertScript('document.querySelector("header").textContent.includes("Anonymous votes")', false)
        ->assertPresent('section[aria-label="Anonymous votes"]')
        ->assertSee('3 × 1')
        ->assertDontSee('Bob: 5');

    expect($game->fresh()->anonymous_votes)->toBeFalse()
        ->and($round->fresh()->anonymous)->toBeTrue();
});
```

- [ ] **Step 6: Run the anonymous-round tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php --filter='P10b-10'`
Expected: PASS, 2 tests. A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise report it under the plan header's defect rule.

- [ ] **Step 7: Add the toggle and ended-game tests**

Append to the same file. Both tests start with no current task, the state in which the cursor layer is mounted, so its presence and absence are meaningful. On an ended game the hand stays on screen with every card disabled (the feature spec, §"Hand": "Disabled when … the game ended"), so the test asserts a disabled card where the walkthrough says "no hand".

```php
it('[P10b-12] shows the four switches to the facilitator and removes the cursor layer and the reactions bar for everyone when turned off', function () {
    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable();

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('.lc-overlay')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertPresent('[aria-label="Hide my cursor"]');
    }

    $b->assertNotPresent('[aria-label="Facilitator menu"]');

    p10bOpenSettings($a)
        ->assertSee('Reveal automatically when everyone has voted or the timer ends')
        ->assertSee('Anonymous votes')
        ->assertSee('Show live cursors')
        ->assertSee('Show flying reactions')
        ->click('#poker-cursors')
        ->click('#poker-reactions')
        ->click('Save');

    foreach ([$a, $b] as $page) {
        $page->assertNotPresent('.lc-overlay')
            ->assertNotPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertNotPresent('[aria-label="Hide my cursor"]');
    }

    p10bOpenSettings($a)
        ->assertAriaAttribute('#poker-cursors', 'checked', 'false')
        ->assertAriaAttribute('#poker-reactions', 'checked', 'false')
        ->click('#poker-cursors')
        ->click('#poker-reactions')
        ->click('Save');

    foreach ([$a, $b] as $page) {
        $page->assertPresent('.lc-overlay')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertPresent('[aria-label="Hide my cursor"]');
    }
});

it('[P10b-13] removes cursors, reactions and the watch toggle on an ended game and restores them on reopen', function () {
    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable();
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Checkout flow']);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('.lc-overlay')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertSee('Watch only');
    }

    $a->click('[aria-label="Facilitator menu"]')
        ->assertVisible('[role="menuitem"]:has-text("End game")')
        ->click('[role="menuitem"]:has-text("End game")')
        ->assertSee('End this game?')
        ->click('[role="dialog"] button:has-text("End game")');

    foreach ([$a, $b] as $page) {
        $page->assertSee('Game ended')
            ->assertNotPresent('.lc-overlay')
            ->assertNotPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertNotPresent('[aria-label="Hide my cursor"]')
            ->assertDontSee('Watch only')
            ->assertDisabled('button[aria-label="Play 5"]');
    }

    $a->click('[aria-label="Facilitator menu"]')
        ->assertVisible('[role="menuitem"]:has-text("Reopen game")')
        ->click('[role="menuitem"]:has-text("Reopen game")');

    foreach ([$a, $b] as $page) {
        $page->assertSee('Watch only')
            ->assertPresent('.lc-overlay')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertDontSee('Game ended');
    }
});
```

In `[P10b-12]` Bob has no "Facilitator menu" because `pokerMember()` creates a plain workspace member who neither facilitates nor may delete the game (`game-header.tsx`: `(me.isFacilitator || me.canDelete) && <GameMenu />`).

- [ ] **Step 8: Run the toggle and ended-game tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php --filter='P10b-1[23]'`
Expected: PASS, 2 tests. A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise report it under the plan header's defect rule.

- [ ] **Step 9: Add the retro regression tests**

Append to the same file. They cover walkthrough item 15 and the same check written earlier in plan 10b (Task 6, Step 7): the cursor and reaction layers that plan 10b extracted from the retro board still work there. Before a whisper is sent, each page waits for the presence strip to read "2 online", so the sender is subscribed and the receiver knows the sender (a cursor or reaction from an unknown sender is dropped by `whisperTransport`'s `accept` callback). A remote cursor is removed 3 seconds after its last move and a flying reaction lives 2 to 3.5 seconds (library defaults `ttlMs` and `durationMs`), so each assertion directly follows the action that causes it; no wait is used. Card dragging on the retro board is covered by the plan 4 walkthrough tests and is not repeated here.

```php
it('[P10b-15a] still shares named cursors and reactions on a retro board in Writing', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create();
    [$ada] = retroFacilitator($retro);
    [$bob] = retroMember($retro);
    p10bRenamed($ada, 'Ada');
    p10bRenamed($bob, 'Bob');

    $a = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('.lc-overlay');
    }

    $b->hover('No columns yet.')->hover('main.relative');
    $a->assertSeeIn('.lc-overlay', 'Bob');

    $a->click('[aria-label="Send a reaction 🎉"]');
    $b->assertSeeIn('.lr-overlay', 'Ada');
});

it('[P10b-15b] still hides cursors and keeps reactions on a retro board in Voting', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$ada] = retroFacilitator($retro);
    [$bob] = retroMember($retro);
    p10bRenamed($ada, 'Ada');
    p10bRenamed($bob, 'Bob');

    $a = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertNotPresent('.lc-overlay');
    }

    $a->click('[aria-label="Send a reaction 🎉"]');
    $b->assertSeeIn('.lr-overlay', 'Ada');
});

it('[P10b-15c] still labels cursors "Participant" and sends unnamed reactions on an anonymous retro', function () {
    $retro = Retro::factory()->anonymous()->create();
    [$ada] = retroFacilitator($retro);
    [$bob] = retroMember($retro);
    p10bRenamed($ada, 'Ada');
    p10bRenamed($bob, 'Bob');

    $a = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('.lc-overlay');
    }

    $b->hover('No columns yet.')->hover('main.relative');
    $a->assertSeeIn('.lc-overlay', 'Participant');

    $a->click('[aria-label="Send a reaction 🎉"]');
    $b->assertPresent('.lr-reaction')
        ->assertNotPresent('.lr-label');
});
```

- [ ] **Step 10: Add the translation test**

Append to the same file. A guest switches language with the real language select in the game header (`LanguageSwitcher`, shown to guests only, which sends `PUT /locale`). The three French strings are the values of the keys "Auto-reveal", "You're watching — switch to Play to vote" and "Watching" in `lang/fr.json`. Spanish and German are not repeated in the browser: `tests/Feature/TranslationKeysTest.php` already fails when a key used by the interface is missing from any of the four language files.

```php
it('[P10b-16] shows the scope additions in French after a guest switches language', function () {
    ['game' => $game] = p10bTable(['auto_reveal' => true]);
    openPokerRound($game);

    $c = $this->awaitRealtime(p10bJoinAsSpectator($game, 'Casey'));

    $c->assertSee('Auto-reveal')
        ->assertSee("You're watching — switch to Play to vote")
        ->assertPresent('section[aria-label="Watching"]')
        ->click('[aria-label="Language"]')
        ->assertVisible('[role="option"]:has-text("Français")')
        ->click('[role="option"]:has-text("Français")')
        ->assertSee('Révélation automatique')
        ->assertSee('Vous observez — passez en mode Jouer pour voter')
        ->assertPresent('section[aria-label="Observateurs"]');
});
```

- [ ] **Step 11: Run the retro regression and translation tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php --filter='P10b-1[56]'`
Expected: PASS, 4 tests. A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise report it under the plan header's defect rule.

- [ ] **Step 12: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php`
Expected: PASS, 15 tests.

- [ ] **Step 13: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. No `.tsx` file changed in this task, so `npm run types:check`, `npm run check` and `npm run build` are not needed.

- [ ] **Step 14: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php
git commit -m "test(browser): cover the poker additions walkthrough: decks, spectators, anonymity, toggles"
```

### Task 14: Plan 10b walkthrough, part 2: round timer, auto-reveal, cursors and flying reactions

**Files:**
- Modify: `tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php` (append seven tests)
- Test: `tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php`

**Interfaces:**
- Consumes: the harness of Tasks 1–4 (`signIn`, `awaitRealtime`, `visit`, `data-realtime`, the real Reverb server started by `ReverbServer::ensureRunning()`); from Task 13 the helpers `p10bTable()`, `p10bJoinAsSpectator()` and `p10bOpenSettings()` and the `use` statements already at the top of the file (`DB`, `PokerTask`); from `tests/Pest.php` `openPokerRound()`.
- Produces: nothing other tasks rely on.

How each technique maps to the code:

- **Timer.** `PokerTimersController::update` stores `timer_ends_at` (whole seconds), broadcasts `timer.changed` to the other players and queues `RevealPokerRoundOnTimer` with a delay equal to the end time. The interface offers 30 s, 1, 2 and 3 minutes and whole custom minutes (`round-timer-control.tsx`), so 30 seconds is the shortest timer a user can start, although the endpoint accepts 10. The tests therefore do not wait for a real timer: they set `queue.default` to `database` so the delayed job is stored instead of run at once (the test environment's `sync` queue would run it immediately, where it returns because the end time is still in the future), move the server clock 31 seconds forward with `$this->travel()`, and run the one stored job with `queue:work --once`. The job compares the stored end time with `now()` (`isFuture()`), and `AutoRevealPokerRound` compares it with `now()` again, so travel is enough. The reveal reaches both browsers through the `round.changed` broadcast the job sends, which is the path the tests exercise.
- **The browser's own countdown.** Travel moves the server clock only. The facilitator's page also asks the server to reveal when its countdown reaches zero (`auto-reveal-triggers.tsx`, a fallback for a delayed queue); that client path needs 30 real seconds and is not exercised by the timer tests. It calls the same endpoint (`POST rounds/{round}/auto-reveal`) and the same action as the departure path, which `[P10b-07]` exercises for real. With auto-reveal off, "Time's up!" is shown by the countdown element once the page's server offset says the end has passed, so `[P10b-08b]` reloads both pages after travelling; the transition toast and the sound, which need the countdown to run down on screen, are residual.
- **Presence.** No fake roster: `ReverbPokerPresenceRoster` asks the real Reverb server who is on `presence-poker.{id}`. Each test waits until the presence strip reads the expected "N online" on every page before anyone votes.
- **Leaving.** `usePokerChannel` leaves the channel when the game page unmounts (`echo().leave(name)` in the effect's cleanup). Clicking the header's "Back to the team" link is a real, deterministic way for a member to leave, so `[P10b-07]` uses it in place of closing the tab. The facilitator's page then waits 2 seconds (`DebounceMs` in `auto-reveal-triggers.tsx`) before asking the server; the test does not sleep, the assertion's retry covers that delay, which requires the suite's browser timeout to be at least 5 seconds. To close the tab instead, replace the click with `$b->page()->close();` (`page()` is marked internal in the plugin). If this fails, see Task 1's findings.
- **Whisper limits.** Cursor moves are throttled to one per 40 ms by the library and reactions to a burst of 5 then 2 per second, both when sending and per sender when receiving (`ReceiveLimit` in `flying-reactions.tsx`); Reverb's own rate limiting is off by default (`config/reverb.php`). Each test sends at most three reactions and a handful of cursor moves per page, well inside those limits.
- **Proving that nothing was sent.** A remote cursor disappears by itself 3 seconds after its last move, so "Bob no longer sees Ada's cursor" would pass by expiry alone. `[P10b-04]` therefore moves Ada's pointer again while hidden, then sends a reaction from Ada and waits for it on Bob's page: whispers travel in order on one socket, so if a cursor move had been sent it would have arrived before the reaction.
- **Viewport.** `[P10b-05]` selects a task in the task list, which is a side column from 1024 px (`hidden … lg:flex` in `game.tsx`); the plugin's default viewport is wide enough.

- [ ] **Step 1: Add the cursor and reaction tests**

Append to `tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php`:

```php
it('[P10b-04] shows named cursors between rounds and lets a player hide theirs', function () {
    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable();

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('.lc-overlay')
            ->assertSee('Add the first task');
    }

    $a->hover('Add the first task')->hover('main button:has-text("Add task")');
    $b->assertSeeIn('.lc-overlay', 'Ada');

    $b->hover('Add the first task')->hover('main button:has-text("Add task")');
    $a->assertSeeIn('.lc-overlay', 'Bob');

    $a->click('[aria-label="Hide my cursor"]')
        ->assertAriaAttribute('[aria-label="Show my cursor"]', 'pressed', 'true');
    $b->assertNotPresent('.lc-cursor');

    $a->hover('Add the first task')
        ->hover('main button:has-text("Add task")')
        ->click('[aria-label="Send a reaction 🎉"]');
    $b->assertSeeIn('.lr-overlay', 'Ada')
        ->assertNotPresent('.lc-cursor');

    $a->click('[aria-label="Show my cursor"]')
        ->assertAriaAttribute('[aria-label="Hide my cursor"]', 'pressed', 'false')
        ->hover('Add the first task')
        ->hover('main button:has-text("Add task")');
    $b->assertSeeIn('.lc-overlay', 'Ada');
});

it('[P10b-05] hides every cursor while a round is open and keeps reactions flying', function () {
    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable();
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Checkout flow']);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));
    $c = $this->awaitRealtime(p10bJoinAsSpectator($game, 'Casey'));

    foreach ([$a, $b, $c] as $page) {
        $page->assertPresent('[role="group"][aria-label="3 online"]')
            ->assertPresent('.lc-overlay');
    }

    $a->hover('Pick a task to start voting');
    $b->assertSeeIn('.lc-overlay', 'Ada');

    $a->click('Checkout flow');

    foreach ([$a, $b, $c] as $page) {
        $page->assertPresent('[role="img"][aria-label="Ada: Not voted yet"]')
            ->assertNotPresent('.lc-overlay')
            ->assertNotPresent('[aria-label="Hide my cursor"]')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]');
    }

    $a->click('[aria-label="Send a reaction 🎉"]');
    $b->assertSeeIn('.lr-overlay', 'Ada');

    $b->click('[aria-label="Send a reaction 👏"]');
    $c->assertSeeIn('.lr-overlay', 'Bob');

    $c->click('[aria-label="Send a reaction 👍"]');
    $a->assertSeeIn('.lr-overlay', 'Casey');
});
```

- [ ] **Step 2: Run the cursor and reaction tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php --filter='P10b-0[45]'`
Expected: PASS, 2 tests. A failure means a wrong selector or a product defect: fix the selector if the UI text or the library's class name differs, otherwise report it under the plan header's defect rule.

- [ ] **Step 3: Add the auto-reveal tests**

Append to the same file:

```php
it('[P10b-06] reveals by itself when the last online player votes, without waiting for a spectator', function () {
    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable();
    $round = openPokerRound($game);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));
    $c = $this->awaitRealtime(p10bJoinAsSpectator($game, 'Casey'));

    foreach ([$a, $b, $c] as $page) {
        $page->assertPresent('[role="group"][aria-label="3 online"]')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertNotPresent('.lc-overlay');
    }

    p10bOpenSettings($a)
        ->click('#poker-auto-reveal')
        ->assertAriaAttribute('#poker-auto-reveal', 'checked', 'true')
        ->click('Save');

    foreach ([$a, $b, $c] as $page) {
        $page->assertSee('Auto-reveal');
    }

    $a->assertEnabled('button[aria-label="Play 5"]')
        ->click('button[aria-label="Play 5"]');

    $b->assertPresent('[role="img"][aria-label="Ada: Voted"]')
        ->click('button[aria-label="Play 8"]');

    foreach ([$a, $b, $c] as $page) {
        $page->assertSee('Revealed automatically — everyone voted')
            ->assertPresent('[role="img"][aria-label="Ada: 5"]')
            ->assertPresent('[role="img"][aria-label="Bob: 8"]')
            ->assertPresent('.lc-overlay');
    }

    expect($round->fresh()->reveal_reason)->toBe(PokerRevealReason::EveryoneVoted)
        ->and($round->votes()->count())->toBe(2);
});

it('[P10b-07] reveals by itself when the only player who has not voted leaves the game', function () {
    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable(['auto_reveal' => true]);
    $round = openPokerRound($game);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));
    $c = $this->awaitRealtime(p10bJoinAsSpectator($game, 'Casey'));

    foreach ([$a, $b, $c] as $page) {
        $page->assertPresent('[role="group"][aria-label="3 online"]');
    }

    $a->assertEnabled('button[aria-label="Play 5"]')
        ->click('button[aria-label="Play 5"]');

    $b->assertPresent('[role="img"][aria-label="Ada: Voted"]');

    expect($round->fresh()->revealed_at)->toBeNull();

    $b->click('[aria-label="Back to the team"]')
        ->assertPathBeginsWith('/w/');

    foreach ([$a, $c] as $page) {
        $page->assertSee('Revealed automatically — everyone voted')
            ->assertPresent('[role="img"][aria-label="Ada: 5"]');
    }

    expect($round->fresh()->reveal_reason)->toBe(PokerRevealReason::EveryoneVoted);

    $b->navigate("/poker/{$game->id}")
        ->assertSee('Revealed automatically — everyone voted');
});
```

- [ ] **Step 4: Run the auto-reveal tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php --filter='P10b-0[67]'`
Expected: PASS, 2 tests. `[P10b-07]` takes about 3 seconds longer than the others because the facilitator's page waits 2 seconds after a departure before it asks the server. A failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise report it under the plan header's defect rule.

- [ ] **Step 5: Add the timer tests**

Append to the same file. Each test asserts that exactly one job is stored before it runs the worker, so a job queued by something else is reported clearly instead of being run in place of the timer job.

```php
it('[P10b-08a] counts a round timer down for everyone and reveals at zero when auto-reveal is on', function () {
    config(['queue.default' => 'database']);

    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable(['auto_reveal' => true]);
    $round = openPokerRound($game);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertNotPresent('[role="timer"]');
    }

    $a->click('[aria-label="Timer"]')
        ->assertSee('30 s')
        ->click('30 s');

    foreach ([$a, $b] as $page) {
        $page->assertSeeIn('[role="timer"]', '0:');
    }

    $b->click('button[aria-label="Play 8"]');
    $a->assertPresent('[role="img"][aria-label="Bob: Voted"]');

    expect(DB::table('jobs')->count())->toBe(1)
        ->and($round->fresh()->revealed_at)->toBeNull();

    $this->travel(31)->seconds();
    $this->artisan('queue:work', ['--once' => true])->assertSuccessful();

    foreach ([$a, $b] as $page) {
        $page->assertSee("Revealed automatically — time's up")
            ->assertPresent('[role="img"][aria-label="Bob: 8"]')
            ->assertNotPresent('[role="timer"]');
    }

    expect($round->fresh()->reveal_reason)->toBe(PokerRevealReason::Timer);
});

it('[P10b-08b] only shows "Time\'s up!" at zero when auto-reveal is off and leaves the round open until "Show votes"', function () {
    config(['queue.default' => 'database']);

    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable();
    $round = openPokerRound($game);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]');
    }

    $a->click('[aria-label="Timer"]')
        ->assertSee('30 s')
        ->click('30 s');

    foreach ([$a, $b] as $page) {
        $page->assertSeeIn('[role="timer"]', '0:');
    }

    $b->click('button[aria-label="Play 8"]');
    $a->assertPresent('[role="img"][aria-label="Bob: Voted"]');

    expect(DB::table('jobs')->count())->toBe(1);

    $this->travel(31)->seconds();
    $this->artisan('queue:work', ['--once' => true])->assertSuccessful();

    expect(DB::table('jobs')->count())->toBe(0)
        ->and($round->fresh()->revealed_at)->toBeNull();

    $this->awaitRealtime($a->navigate("/poker/{$game->id}"));
    $this->awaitRealtime($b->navigate("/poker/{$game->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertSeeIn('[role="timer"]', "Time's up!")
            ->assertPresent('[role="img"][aria-label="Bob: Voted"]')
            ->assertDontSee('Revealed automatically');
    }

    $a->assertSee('Show votes')
        ->click('Show votes');

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="img"][aria-label="Bob: 8"]')
            ->assertDontSee('Revealed automatically');
    }

    expect($round->fresh()->reveal_reason)->toBe(PokerRevealReason::Manual);
});

it('[P10b-09] does not reveal at the original zero of a timer that was stopped', function () {
    config(['queue.default' => 'database']);

    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable(['auto_reveal' => true]);
    $round = openPokerRound($game);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]');
    }

    $a->click('[aria-label="Timer"]')
        ->assertSee('30 s')
        ->click('30 s');

    foreach ([$a, $b] as $page) {
        $page->assertSeeIn('[role="timer"]', '0:');
    }

    $b->click('button[aria-label="Play 8"]');

    $a->assertPresent('[role="img"][aria-label="Bob: Voted"]')
        ->click('[aria-label="Timer"]')
        ->assertSee('Stop timer')
        ->click('Stop timer');

    foreach ([$a, $b] as $page) {
        $page->assertNotPresent('[role="timer"]');
    }

    expect(DB::table('jobs')->count())->toBe(1)
        ->and($round->fresh()->timer_ends_at)->toBeNull();

    $this->travel(31)->seconds();
    $this->artisan('queue:work', ['--once' => true])->assertSuccessful();

    expect(DB::table('jobs')->count())->toBe(0)
        ->and($round->fresh()->revealed_at)->toBeNull();

    $a->assertSee('Show votes')
        ->assertPresent('[role="img"][aria-label="Bob: Voted"]')
        ->assertDontSee('Revealed automatically');

    $b->assertEnabled('button[aria-label="Play 8"]')
        ->assertDontSee('Revealed automatically');
});
```

In the three timer tests Bob votes and Ada does not, so the "everyone voted" condition never holds and the timer is the only possible reason for a reveal; in `[P10b-09]` a vote exists, so the round would have been revealed if the stopped timer's job had not turned into a no-op.

- [ ] **Step 6: Run the timer tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php --filter='P10b-0[89]'`
Expected: PASS, 3 tests. If `expect(DB::table('jobs')->count())->toBe(1)` fails with a higher count, another job is being queued by the page loads or the vote: list the stored jobs' `payload->displayName`, and report it under the plan header's defect rule rather than changing the count. Any other failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise report it.

- [ ] **Step 7: Run the whole file twice**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php`
Expected: PASS, 22 tests.

Run the same command a second time.
Expected: PASS, 22 tests again (the cursor, reaction and departure tests depend on real websocket timing, so two consecutive green runs are required before committing).

- [ ] **Step 8: Format**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue. No `.tsx` file changed in this task, so `npm run types:check`, `npm run check` and `npm run build` are not needed.

- [ ] **Step 9: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php
git commit -m "test(browser): cover the poker additions walkthrough: timer, auto-reveal, cursors, reactions"
```

### Task 15: Coverage table and residual checklist

**Files:**
- Create: `docs/superpowers/walkthroughs/coverage.md`
- Create: `docs/superpowers/walkthroughs/residual-manual-checklist.md`

**Interfaces:**
- Consumes: the test identifiers of Tasks 10 to 14 (`[P04-…]`, `[P10a-…]`, `[P10b-…]`) and `docs/superpowers/walkthroughs/harness-findings.md` (Task 1, same folder).
- Produces: the two documents acceptance criterion 5 names. Task 17 appends its verification record to `coverage.md`. Later plans (16b onward) add their own sections to both files.

- [ ] **Step 1: Write the coverage table**

Create `docs/superpowers/walkthroughs/coverage.md` with this content. If a test was renamed, split or dropped while Tasks 10 to 14 were implemented, change its row here to match the code, and correct the summary counts.

````markdown
# Walkthrough coverage

Spec: `docs/superpowers/specs/2026-10-01-browser-e2e-and-arch-tests-design.md` (§4). One row per walkthrough step. A step that became several tests has one row per test, or one row naming its tests.

| Status | Meaning |
|---|---|
| `auto` | Covered by a browser test as written. |
| `auto-substituted` | Covered by a browser test using a substitution from spec §3.6. |
| `residual` | Not automated; listed in `residual-manual-checklist.md` with the reason. |

A test is found by its identifier: `vendor/bin/pest tests/Browser/Walkthroughs --filter='P10a-07'`.

## Summary

| Walkthrough | Rows | `auto` | `auto-substituted` | `residual` |
|---|---|---|---|---|
| Plan 4, retro core | 26 | 19 | 5 | 2 |
| Plan 10a, poker core | 16 | 13 | 3 | 0 |
| Plan 10b, poker additions | 28 | 18 | 6 | 4 |
| **Total** | **70** | **50** | **14** | **6** |

## Plan 4: retro board core

Walkthrough: `docs/superpowers/plans/2026-09-29-plan-4-board-ui.md`, Task 9, Steps 1 to 4.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P04-01 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-02 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-03 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-04 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-05a | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-05b | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-05c | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-06 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-07 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-08a | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-08b | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto-substituted |
| P04-09 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-10 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto-substituted |
| P04-11 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-12 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1794 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto-substituted |
| P04-13 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1794 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-14a | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-14b | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-14c | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-14d | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-15a | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto-substituted |
| P04-15b | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | (none) | residual |
| P04-16a | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto-substituted |
| P04-16b | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | (none) | residual |
| P04-17a | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1796 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-17b | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1796 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |

## Plan 10a: planning poker core

Walkthrough: `docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md`, "Two-browser walkthrough (10a scope)".

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P10a-01 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12535 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-02 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12536 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-03 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12537 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-04 (tests P10a-04a, P10a-04b) | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12538 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-05 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12539 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto-substituted |
| P10a-06 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12540 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-07 (tests P10a-07a, P10a-07b, P10a-07c) | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12541 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto-substituted |
| P10a-08 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12542 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-09 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12543 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-10 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12544 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-11 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12545 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto-substituted |
| P10a-12 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12546 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-13 (tests P10a-13a, P10a-13b) | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12547 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-14 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12548 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-15 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12549 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-16 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12550 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |

## Plan 10b: planning poker scope additions

Walkthrough: `docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md`, final walkthrough step and the inline check near line 3886.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P10b-01 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5901 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-02a | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5902 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-02b | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5902 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-02c | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5902 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-03 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5903 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto-substituted |
| P10b-04 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5904 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-04t | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5904 | (none) | residual |
| P10b-05 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5905 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-05o | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5905 | (none) | residual |
| P10b-06 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5906 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-07 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5907 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto-substituted |
| P10b-08a | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5908 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto-substituted |
| P10b-08b | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5908 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto-substituted |
| P10b-08s | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5908 | (none) | residual |
| P10b-09 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5909 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto-substituted |
| P10b-10a | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5910 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-10b | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5910 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-11a | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5911 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-11b | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5911 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-12 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5912 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-13 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5913 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-14 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5914 | (none) | residual |
| P10b-15a | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5915 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-15b | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5915 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-15c | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5915 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-15d (test P04-14c) | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5915 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P10b-15a, P10b-15b, P10b-15c (Task 6 Step 7 retro smoke check) | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:3886 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-16 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5916 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto-substituted |

## Notes

Where a walkthrough's wording and today's interface differ, the test follows the feature's spec.

- P04-04: vote totals are shown during Voting unless the board setting "hide vote counts" is on; the test turns it on to check plan 4's "no per-card numbers".
- P04-06, P04-09: a completed retro opens on a Results tab; the cards are behind the Board tab.
- P04-09: action items, the presence strip and the results' participant list are not anonymous by design; the test asserts "no author name" on the cards.
- P04-08b: the timer reaching zero is a client-side notice only.
- P04-17a: members change language under Settings, Appearance.
- P10a-06: the valid join page shows the game's title and "Choose the name other players will see.", not "Join a planning poker game".
- P10a-14: after the guest link is regenerated the guest sees "Your access to this game has ended.", not the session-expired banner.
- P10b-10b: the history of an anonymous round shows each value with its count and no names; the walkthrough says "lists who voted without values". The feature's spec only requires that no value is linked to a player. To confirm with the product owner.
- P10b-13: an ended game keeps the hand, disabled; the walkthrough says "no hand".
- P10b-08a, P10b-08b: the shortest timer the interface offers is 30 seconds, so the tests travel in time and run one queued job.
- P10b-15d: "card dragging still works" on the retro board is covered by the plan 4 keyboard-drag test `[P04-14c]`.

## Defects found

None recorded yet. Add one line per defect: identifier, what was wrong, the commit that fixed it.
````

- [ ] **Step 2: Write the residual checklist**

Create `docs/superpowers/walkthroughs/residual-manual-checklist.md` with this content:

````markdown
# Residual manual checklist

Walkthrough steps that the browser suite does not automate, with the reason and how to check each by hand. Spec: `docs/superpowers/specs/2026-10-01-browser-e2e-and-arch-tests-design.md` (§1 "Out of scope", §4).

Record each manual check below its entry: date, who, result.

## Plan 4: retro board core

- **P04-15b** — "screen widths 375px and 1440px (columns scroll horizontally, header wraps, action items panel moves below on small screens)". Not automated: whether the board looks right at those widths (nothing overlaps, nothing is cut off, the header stays usable, spacing is sensible) is a judgement of visual quality, which spec §1 puts out of scope. The three structural facts the step names are asserted by `P04-15a`. Check by hand: open a retro in Discussing with three columns and a few cards, as a facilitator and as a member; set the browser to 375px wide and confirm that the columns scroll sideways without the page itself scrolling sideways, that the header wraps onto several lines with every control reachable, and that the action items panel sits below the columns; then set it to 1440px and confirm that the header fits on one line and the panel sits to the right of the columns.
- **P04-16b** — "dark mode". Not automated: whether every board element is legible in the dark theme (contrast of cards, column accents, badges, the reconnecting banner, dialogs and toasts) is a judgement of visual quality, out of scope per spec §1. `P04-16a` asserts only that choosing "Dark" sets the `dark` class and that the board keeps it. Check by hand: choose Dark under Settings, Appearance; open a retro and walk through Writing, Grouping, Voting, Discussing and Completed; open the facilitator menu's four dialogs and trigger one toast; confirm that no text or icon is unreadable and that no element keeps a light background.

## Plan 10b: planning poker scope additions

- **P10b-04t — touch cursors** ("on a touch device the dot appears while the finger is down", item 4). Not automated: the suite drives a mouse; touch devices are out of scope (browser test spec §1, "Out of scope"). By hand: open the game on a phone or with the browser's device emulation in touch mode, with no current task; hold a finger on the main pane and check that the other browser shows a round dot with the name, and that it disappears when the finger lifts.
- **P10b-05o — reactions rise from the sender's avatar** (item 5, "from each sender's avatar"). Not automated: the test proves the reaction arrives with the sender's name; where it starts on screen is a visual judgement. By hand: with three browsers in one game, send a reaction from each and check that each one starts under that sender's avatar in the presence strip.
- **P10b-08s — the soft sound and the "Time's up!" toast at zero** (item 8, "at zero everyone hears the soft sound, sees 'Time's up!'"). Not automated: sound is out of scope (browser test spec §1), and the toast and sound fire only when the countdown runs down on screen, which needs the browser's clock, not the server's; the shortest timer the interface offers is 30 seconds. `[P10b-08b]` covers the "Time's up!" text in the countdown element after the end. By hand: start a 30 s timer with two browsers and the sound on; at zero both play a short beep and show a "Time's up!" toast; with auto-reveal on, the round also reveals with "Revealed automatically — time's up" without anyone clicking.
- **P10b-14 — forged whisper sender** (item 14). Not automated: sending a frame on a guest's existing Reverb socket needs a test-only handle on the Echo client, which was declined (browser test spec §1, "Out of scope"). By hand: with a websocket debugging extension that can send frames on guest C's socket, send `{"event":"client-reaction","channel":"presence-poker.<gameId>","data":{"e":"🎉","id":"<A's player id>"}}`; A and B must see the reaction labelled with C's name; a frame with `"e":"hello"` must show nothing.
````

- [ ] **Step 3: Check the table against the tests**

Run: `grep -cE "^\| P(04|10a|10b)-" docs/superpowers/walkthroughs/coverage.md`
Expected: `70`.

Run: `grep -cE "\| residual \|$" docs/superpowers/walkthroughs/coverage.md`
Expected: `6`, and each of those identifiers has an entry in `residual-manual-checklist.md` (`grep -c "^- \*\*P" docs/superpowers/walkthroughs/residual-manual-checklist.md` prints the same number).

Run: `grep -ohE "\[P(04|10a|10b)-[0-9]{2}[a-z]?\]" tests/Browser/Walkthroughs/*.php | sort -u`
Expected: every identifier printed appears in the table, either as its own row or inside a row that names its tests, and no `auto` or `auto-substituted` row names an identifier missing from this list.

- [ ] **Step 4: Run every walkthrough test once more**

Run: `vendor/bin/pest tests/Browser/Walkthroughs`
Expected: PASS. A row may say `auto` or `auto-substituted` only if its test passes.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/walkthroughs/coverage.md docs/superpowers/walkthroughs/residual-manual-checklist.md
git commit -m "docs: add the walkthrough coverage table and the residual manual checklist"
```

### Task 16: CI job and Composer scripts

**Files:**
- Modify: `composer.json` (script `test:browser`)
- Modify: `.github/workflows/tests.yml` (PHP 8.4 for `ci`, new `browser` job)

**Interfaces:**
- Consumes: the `Arch` test suite that Task 5 adds to `phpunit.xml`; `tests/Browser` (Tasks 2 to 4 and the walkthrough tasks); `Tests\Browser\Support\ReverbServer` (started by the suite itself, so CI starts no Reverb).
- Produces: `composer test:browser` and the `browser` job of the `tests` workflow. (`composer test:arch` exists since Task 5.)

- [ ] **Step 1: Add the Composer script**

In `composer.json`, inside `"scripts"`, add this entry directly after the `"test:arch"` entry that Task 5 added. The `"test"` entry itself does not change: it runs `php artisan test`, which runs every suite of `phpunit.xml`, including the `Arch` suite of Task 5. `tests/Browser` is in no suite, so `composer test` never runs it.

```json
        "test:browser": [
            "Composer\\Config::disableProcessTimeout",
            "@php artisan config:clear --ansi",
            "npm run build",
            "pest tests/Browser"
        ],
```

- [ ] **Step 2: Check the scripts**

Run: `composer validate --no-check-publish`
Expected: `./composer.json is valid`.

Run: `composer test:arch`
Expected: PASS; only tests under `tests/Arch` are listed.

Run: `composer test:browser`
Expected: the assets are built, then every test under `tests/Browser` runs and PASSES. No Reverb server needs to be started by hand.

Run: `php artisan test --compact`
Expected: PASS; the output lists Unit, Feature and Arch tests and no test under `tests/Browser`.

- [ ] **Step 3: Raise the `ci` job to PHP 8.4**

The browser plugin requires PHP 8.4 and `ext-sockets`, and it is loaded in every Pest run, so the existing job must meet both. In `.github/workflows/tests.yml`, replace

```yaml
        with:
          php-version: '8.3'
          tools: composer:v2
          coverage: none
```

with:

```yaml
        with:
          php-version: '8.4'
          extensions: sockets
          tools: composer:v2
          coverage: none
```

- [ ] **Step 4: Add the `browser` job**

In `.github/workflows/tests.yml`, append this job after the `ci` job (same indentation as `ci:`). The `checkout`, `setup-php` and `setup-node` pins are the ones the file already uses; `upload-artifact` is pinned to the commit of its tag `v7.0.1`.

```yaml
  browser:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:18-alpine
        env:
          POSTGRES_DB: testing
          POSTGRES_USER: skrum
          POSTGRES_PASSWORD: password
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U skrum -d testing"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

    env:
      DB_CONNECTION: pgsql
      DB_HOST: 127.0.0.1
      DB_PORT: 5432
      DB_USERNAME: skrum
      DB_PASSWORD: password

    steps:
      - name: Checkout code
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - name: Setup PHP
        uses: shivammathur/setup-php@f3e473d116dcccaddc5834248c87452386958240 # v2
        with:
          php-version: '8.4'
          extensions: sockets, pdo_pgsql
          tools: composer:v2
          coverage: none

      - name: Setup Node
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: '22'

      - name: Install Composer dependencies
        run: composer install --no-interaction --prefer-dist

      - name: Install npm dependencies
        run: npm ci

      - name: Install Chromium
        run: npx playwright install --with-deps chromium

      - name: Create the environment file
        run: |
          cp .env.example .env
          php artisan key:generate

      - name: Run the browser suite
        run: composer test:browser

      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: browser-screenshots
          path: tests/Browser/Screenshots
          if-no-files-found: ignore
```

The database name is not in the job's `env`: `phpunit.xml` sets `DB_DATABASE=testing` for every Pest run. The other `DB_*` variables are real environment variables, so they win over the values of `.env.example`.

- [ ] **Step 5: Check the workflow's syntax**

Run: `ruby -ryaml -e 'jobs = YAML.load_file(".github/workflows/tests.yml").fetch("jobs"); puts jobs.keys.join(", ")'`
Expected: `ci, browser`.

Run: `grep -n "php-version" .github/workflows/tests.yml`
Expected: two lines, both `php-version: '8.4'`.

- [ ] **Step 6: Commit**

```bash
git add composer.json .github/workflows/tests.yml
git commit -m "ci: run the browser suite in its own job and add the arch and browser Composer scripts"
```

### Task 17: Final verification

**Files:**
- Modify: `docs/superpowers/walkthroughs/coverage.md` (verification record at the end)

**Interfaces:**
- Consumes: everything produced by Tasks 1 to 16.
- Produces: the evidence for each acceptance criterion of spec §10, recorded in `docs/superpowers/walkthroughs/coverage.md`.

Do not claim a criterion met without the output of its command in front of you.

- [ ] **Step 1: Run the browser suite twice (criteria 1, 3, 4)**

Run: `composer test:browser && composer test:browser`
Expected: PASS both times, with the same number of tests. The run builds the assets and starts Reverb itself; `lsof -i :8097` prints nothing once it has ended. A test that passes once and fails once is flaky: find the missing wait (an action on something not yet asserted visible) and fix it before continuing.

- [ ] **Step 2: Run the architecture suite (criterion 6)**

Run: `composer test:arch`
Expected: PASS, 13 tests.

Run: `grep -n "ignoring" tests/Arch/ArchTest.php`
Expected: one line, the `McpFeature` exception of rule 1, whose reason is in that test's name.

- [ ] **Step 3: Run the scan against the real browser tests (criterion 2)**

Run: `vendor/bin/pest tests/Arch/BrowserTestRulesTest.php`
Expected: PASS.

Run: `grep -rnE "actingAs\(|withCookies?\(|Event::fake\(\)" tests/Browser`
Expected: no output.

- [ ] **Step 4: Run the whole existing suite (criteria 7, 9)**

Run: `composer test`
Expected: PASS: Pint check, phpstan, then Unit, Feature and Arch. The output lists no test under `tests/Browser`.

Run: `composer rector:check`
Expected: no file would change.

Run: `npm run types:check && npm run check`
Expected: no error.

- [ ] **Step 5: Check the coverage table against the tests (criterion 5)**

Run: `grep -ohE "\[P(04|10a|10b)-[0-9]{2}[a-z]?\]" tests/Browser/Walkthroughs/*.php | sort -u | wc -l`
Run: `grep -cE "^\| P(04|10a|10b)-" docs/superpowers/walkthroughs/coverage.md`

Expected: every identifier used in a test title appears in a row of the table, and every row whose status is `auto` or `auto-substituted` names an identifier that exists in a test title. Rows that group several tests (for example `P10a-04 (tests P10a-04a, P10a-04b)`) count once in the table; check them by eye. Every `residual` row has an entry in `docs/superpowers/walkthroughs/residual-manual-checklist.md`.

- [ ] **Step 6: Check what product code changed (criterion 10)**

Run: `git diff --stat cb727bc..HEAD -- resources/js app routes | tail -5` and `git diff cb727bc..HEAD -- resources/js | grep -E "^[+-]" | grep -vE "^(\+\+\+|---)" | grep -vE "data-test|data-realtime|realtimeState|realtime-state|GameLastDrawingOpsController|^\+\s*$|^-\s*$"`

Expected: the second command prints only the lines of `resources/js/lib/realtime/realtime-state.ts` (a new file), the added `connected` destructuring in `board.tsx`, and the re-wrapped `<div` and `className` lines around the three `data-realtime` attributes. Anything else is outside criterion 10: remove it or justify it to the user. Under `app/` and `routes/`, the diff contains only the refactors of spec §5.3 (and the Rector commits, which precede `cb727bc..HEAD` only if the branch was not rebased; compare against the Rector commit `b321061` instead in that case).

- [ ] **Step 7: Watch one walkthrough**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php --headed --filter='P10a-07'`
Expected: a browser window opens, two players vote, and the run ends green.

- [ ] **Step 8: Push and check CI (criterion 8)**

Ask the user before pushing. After the push, the `browser` job of the `tests` workflow must be green; if it fails, download the `browser-screenshots` artifact and read it before changing anything.

- [ ] **Step 9: Record the verification**

Append to `docs/superpowers/walkthroughs/coverage.md`:

```markdown
## Verification of plan 16a

Date: <YYYY-MM-DD>

| Criterion (spec §10) | Evidence |
|---|---|
| 1 | `composer test:browser` passed twice: <n> tests, <seconds> s and <seconds> s |
| 2 | Source scan green; grep for forbidden calls empty |
| 3 | `tests/Browser/Smoke/HarnessTest.php` green |
| 4 | `tests/Browser/Smoke/RealtimeTest.php` green |
| 5 | <n> rows; <n> `auto`, <n> `auto-substituted`, <n> `residual` |
| 6 | `composer test:arch`: 13 tests green; one `ignoring()` with its reason |
| 7 | `composer test` green; no browser test listed |
| 8 | CI run <url or "not pushed yet: waiting for the user"> |
| 9 | Suite green; phpstan, types, lint, Rector clean |
| 10 | Product diff reviewed: only `data-test`, `data-realtime` and the §5.3 refactors |

Residual steps still to be checked by hand: see `residual-manual-checklist.md`.
```

- [ ] **Step 10: Commit**

```bash
git add docs/superpowers/walkthroughs/coverage.md
git commit -m "docs: record the verification of plan 16a"
```

---

## Appendix: notes from drafting

Nothing in this plan was executed while it was written (except the architecture probe behind Tasks 5 to 9). The notes below record what was read, what could not be verified, and the fallback for each doubt. Task 1 settles the harness doubts; where a note says "the lead", read "whoever executes the plan".

### Tasks 1 to 4 and 16 (harness, CI)

#### Sources relied on

Plugin source: `pestphp/pest-plugin-browser`, branch `5.x` (latest tag `v5.0.1`), downloaded and read in full for these files: `composer.json`, `package.json`, `src/Browsable.php`, `src/Plugin.php`, `src/ServerManager.php`, `src/Drivers/LaravelHttpServer.php`, `src/GlobalState.php`, `src/Cleanables/Inertia.php`, `src/Configuration.php`, `src/Execution.php`, `src/Api/PendingAwaitablePage.php`, `src/Api/AwaitableWebpage.php`, `src/Api/Webpage.php`, `src/Api/Concerns/InteractsWithElements.php`, `src/Api/Concerns/MakesElementAssertions.php`, `src/Api/Concerns/InteractsWithToolbar.php`, `src/Playwright/Playwright.php`, `src/Playwright/Browser.php`, `src/Playwright/Page.php`, `src/Support/GuessLocator.php`, `src/Support/Selector.php`, `src/Support/Screenshot.php`, `src/Support/Port.php`, `src/Support/BrowserTestIdentifier.php`, `src/Filters/UsesBrowserTestCaseMethodFilter.php`, `src/Exceptions/BrowserExpectationFailedException.php`, `src/Enums/Device.php`. Docs: https://pestphp.com/docs/browser-testing.

Repo: every file listed in the assignment, plus `bootstrap/app.php`, `app/Http/Controllers/BroadcastAuthorizationsController.php`, `app/Support/Poker/ReverbPokerPresenceRoster.php`, `app/Http/Controllers/RetroJoinsController.php`, `app/Http/Controllers/CurrentWorkspaceController.php`, `resources/js/components/{retro/board,poker/game,games/game-room,poker/tasks-pane,poker/task-form-dialog,retro/dnd}.tsx`, `resources/js/hooks/use-{retro-board,poker-game,game-room}.ts`, `tests/Feature/RequestIsolationTest.php`, `vendor/laravel/framework/src/Illuminate/Session/{Store,ArraySessionHandler}.php`, `Session/Middleware/StartSession.php`, `Auth/AuthManager.php`, `Foundation/Http/Kernel.php`, `Broadcasting/BroadcastManager.php`, `Foundation/Testing/Concerns/InteractsWithContainer.php`, `vendor/pestphp/pest/src/Configuration.php`.

#### Facts the other sections should know

1. **Plugin facts confirmed from source.**
   - `visit(array|string $url, array $options = [])` returns a `PendingAwaitablePage`; the page (and its own `newContext`) is created lazily on the first method call (`PendingAwaitablePage.php:160-191`). Context defaults: `locale` `en-US`, `timezoneId` `UTC`, light colour scheme, desktop viewport 1728×1117 (`Enums/Device.php:62-67`). The `en-US` locale means guests get the English UI through `SetLocale`'s `Accept-Language` branch.
   - The HTTP server binds `127.0.0.1` and a free port (`ServerManager.php:28,94-98`, `Support/Port.php`); every request goes through `app()->make(HttpKernel::class)->handle()` then `terminate()` in the test's own application (`LaravelHttpServer.php:306-354`). It forces `app.url` to its own origin and serves files under `public/` directly.
   - Before each request the plugin only flushes Inertia's shared props, Livewire and Ziggy (`GlobalState.php`) and queued cookies. It does NOT reset guards or the session store: `Store::loadSession()` merges into the existing attributes (`Session/Store.php:116`, `array_replace($this->attributes, …)`), so the leak in spec §3.3 is real by reading; Task 1 probes `[a1]`/`[a2]` prove it.
   - `test()->prepareCookiesForRequest()` is merged into every browser request's cookies (`LaravelHttpServer.php:320`), which is why `withCookie()`/`actingAs()` would silently leak into the browser. This supports the Arch source scan.
   - Signatures: `keys(string $selector, array|string $keys): self` (calls Playwright `locator.press` per key, which focuses the element first); `script(string $content): mixed`; `assertScript(string $expression, mixed $expected = true)` compares with `toBe` (strict), and wraps the expression in a function only when it contains none of `=== !== == != > < >= <= && ||` (note: an arrow function contains `>`, so it is evaluated as a plain expression, which is fine); `value(string $selector): string`; `assertAttribute(string $selector, string $attribute, string|int|float $value)`; `assertAttributeMissing(string $selector, string $attribute)`; `assertPathIsNot(string $path)`; `navigate(string $url, array $options = [])`; `screenshot(bool $fullPage = true, ?string $filename = null)`.
   - `click`, `press`, `pressAndWaitFor`, `keys`, `drag`, `append`, `typeSlowly`, `rightClick` are NOT retried by the plugin (`AwaitableWebpage.php:28-43`); Playwright's own auto-wait for the element still applies. Everything else, including `fill` and all assertions, is retried until the timeout.
   - Explicit CSS selectors are STRICT: `[data-x]`, `#id`, `.class` and any selector containing `[ ] # > + ~ : * | ^ , = ( )` go to `page->locator()` in strict mode (`GuessLocator.php:30-36`, `Page.php:151`), so they must match exactly one element. `@name` (matches `data-testid` or `data-test`) and plain text are non-strict. Walkthrough sections that target "the first of several cards" must use `@name` on a unique attribute value or a `:has-text()` CSS selector, not a bare `[data-test="retro-card"]`.
   - The page object exposes the Playwright page: `$page->page()` returns `Pest\Browser\Playwright\Page` (`AwaitableWebpage.php:92`), which has `context()`, `locator()`, `getByRole()`, `getByLabel()`, `waitForFunction()`. These classes are marked `@internal`; the harness does not use them.
   - Screenshots: `tests/Browser/Screenshots/<test name>.png`, written on every failed assertion (`BrowserExpectationFailedException.php`), and the folder is emptied at the start of each run (`Screenshot::cleanup()`). The failure message also carries console logs, JavaScript errors and the last server exception.
   - `pest()->browser()` exists in Pest core (`vendor/pestphp/pest/src/Configuration.php:78`) and returns the plugin's `Configuration` (`timeout(int $milliseconds)`, `headed()`, `withHost()`, `inFirefox()`…). CLI flags: `--headed`, `--debug`, `--browser`.
   - Requirements: PHP `^8.4`, `ext-sockets`, `pestphp/pest ^5.0.4` (installed 5.2.1), `symfony/process ^8.1.0` (installed 8.1.7), npm `playwright ^1.62.1`.

2. **Every file under `tests/Browser/` is treated as a browser test** by the plugin (`BrowserTestIdentifier::usesBrowserFolder`), even one that never calls `visit()`. `AssetCheckTest.php` therefore also boots Playwright; that is accepted.

3. **The plugin's `afterEach` hook runs for every test of the project** (`Plugin::boot()` registers it for the whole test path) and creates the HTTP server object, which calls `socket_create_listen`. So `ext-sockets` is needed by `composer test` too, not only by the browser suite. Task 16 adds `extensions: sockets` to the existing `ci` job for that reason. This goes one line beyond spec §6.1 ("that job's PHP version is raised to 8.4"); please confirm or have the user confirm.

4. **`data-realtime` derivation.** Spec §3.7 says the attribute comes from "the state the channel hooks already track". The hooks expose `connected` (socket state) and `online` (presence members, set in the `here` callback). I derive `connected && online.length > 0`, so `connected` really means "presence channel subscribed", which is what decision 7 of the spec asks for; `connected` alone would turn true before the subscription. No hook changes. Limitation: after a Reverb restart, `online` still holds the old members, so the attribute returns to `connected` when the socket reconnects, slightly before the re-subscription; the hooks' resync (`here` → `onResync` → refetch) covers that gap. Reconnect tests should assert on the banner text "Reconnecting…" disappearing and then on content, not on an event sent in that instant.

5. **`ReverbServer::stop()` throws** when the port is held by a Reverb process the test run did not start (the "reuse" branch of spec §3.4). Reconnect tests therefore require that nothing else listens on port 8097. This is deliberate: silently not stopping would make a reconnect test pass for the wrong reason.

6. **Session lifetime and time travel.** The `array` session handler expires entries with `Carbon::now()` and `session.lifetime` (120 minutes) (`ArraySessionHandler.php:82-97`). A browser test that calls `$this->travel()` forward by more than 120 minutes signs every user out on their next request. Timer steps travel seconds or minutes, so this should not bite, but the walkthrough sections should know.

7. **`Event::fake()` without arguments removes the isolation listener** (it is registered on `RequestHandled`). Browser tests must fake specific events only (`Event::fake([SomeEvent::class])`). An alternative that is immune to this is `$this->app->terminating(...)` (the plugin calls `$kernel->terminate()` after each request, `LaravelHttpServer.php:354`); I kept `RequestHandled` because the assignment names it. Say the word and Task 2 switches.

8. **`signIn()` default target.** `/dashboard` redirects to `/w/{workspace}` (`CurrentWorkspaceController`), or to the workspace creation page for a user with no workspace. `signIn()` waits for the path to leave `/login`, then navigates to `$to`; it makes no assertion on the final path.

9. **User locale.** `UserFactory` does not set `locale` (it is nullable). With the browser context's `en-US` and `app.locale = en` the UI is English anyway; tests still set `'locale' => 'en'` as the brief says. The helpers `retroMember()`, `pokerMember()` etc. create the user themselves, so the smoke tests call `$user->update(['locale' => 'en'])` afterwards.

10. **The existing `ci` job looks broken independently of this plan** (to report to the user, per spec §6.1, not fixed here): `composer setup` runs `php artisan migrate --force` with `.env.example`'s `DB_HOST=pgsql`, and the job has no PostgreSQL service (`.github/workflows/tests.yml:34-38`, `.env.example:26-31`); `composer test` then needs the `testing` database as well.


12. **`Broadcast::forgetDrivers()`** is called after the config override because the manager caches resolved drivers. The application has no `routes/channels.php` (authorization is the custom `BroadcastAuthorizationsController`, which calls `Broadcast::connection()` at request time), so nothing registered on the earlier `null` driver is lost.

#### UNVERIFIED

- UNVERIFIED: nothing in this fragment was executed (read-only assignment, plugin not installed). All plugin behaviour is from reading source; Task 1 is what proves it.
- UNVERIFIED: dnd-kit's keyboard sensor details. `node_modules` is not installed in this worktree, so I could not read `@dnd-kit/core`. From knowledge of the library: activation on `Space`/`Enter` keydown on the activator, arrow keys handled by a document-level listener attached on a zero timeout after activation, drop on `Space`/`Enter`, cancel on `Escape`, and `aria-pressed="true"` on the draggable while dragging. Probe `[c]` checks both the reorder and `aria-pressed`. The repo side is verified: both boards register `KeyboardSensor` with `sortableKeyboardCoordinates` (`tasks-pane.tsx:105-110`, `board.tsx:74-79`), and the handle's `aria-label` is `Drag to reorder` (`tasks-pane.tsx:347`).
- UNVERIFIED: several arrow keys in a row. `dragWithKeyboard()` sends them back to back; dnd-kit measures positions between moves, so a multi-step move may need a wait between arrows. If a walkthrough test needs two or more arrows and is flaky, the fix belongs in `dragWithKeyboard()` (for example waiting for the live-region announcement to change), not in the test.
- UNVERIFIED: that the signed-in workspace page shows the user's name as visible text (sidebar footer `NavUser` → `UserInfo`, sidebar open by default per `HandleInertiaRequests.php:47`). `HarnessTest` relies on it.
- UNVERIFIED: `ext-sockets` inside the Sail image. The Sail 8.5 Dockerfile does not name it explicitly (it normally ships in `php-common`); Task 1 Step 1 checks it. On the host PHP 8.4.21 it is loaded.
- UNVERIFIED: that `shivammathur/setup-php` needs `extensions: sockets` spelled out (it may be enabled by default); listing it is harmless.
- UNVERIFIED: the `postgres:18-alpine` service image tag in CI (chosen to match `compose.yaml:28`).
- UNVERIFIED: `upload-artifact` pin. `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` is what the GitHub API returned for the tag `v7.0.1` of `actions/upload-artifact` on 2026-10-01; the workflow file had no existing pin for that action to reuse.
- UNVERIFIED: Task 3 Step 6's check that Reverb stopped (`lsof`/`ss`) depends on which of the two tools the environment has; it is an aid, not a gate.

### Tasks 5 to 9 (architecture)

Probe: a temporary `tests/Unit/TmpArchProbeTest.php` ran each preset, each expectation of the `laravel` preset separately, each `security` function separately, each candidate project rule, and a reflection pass over every class in `app/` to list all offenders (an architecture expectation reports only its first). The file is deleted; `git status --short` is empty.

#### Spec statements that the probe contradicts

1. **§5.3 misses a `laravel` preset violation.** `App\Http\Controllers\Games\GameDrawingOpsController::destroyLast()` (`app/Http/Controllers/Games/GameDrawingOpsController.php:35`, route at `routes/web.php:502`) fails "controllers have no public methods besides the CRUD ones". Task 7 fixes it by extracting `GameLastDrawingOpsController::destroy()`; route name and URL are unchanged. This needs a two-line edit of `resources/js/components/games/draw-board.tsx` (lines 3 and 158), which is a product-code change that acceptance criterion 10 does not list. Alternative if the lead prefers no frontend edit: `->ignoring('App\Http\Controllers\Games\GameDrawingOpsController')` on the preset, but that ignores the class for every `laravel` expectation and contradicts the project's own "CRUD methods only" rule.
2. **§5.3 "About 20 classes in `app/Support/Integrations`, `app/Support/Llm` and `app/Mcp/Prompts`": exactly 22**, and two sit outside the `Exceptions` folder: `app/Support/Integrations/Inbound/InboundSignatureInvalid.php:8` and `app/Support/Integrations/Trackers/EstimateRejected.php:11`. Both go to `App\Exceptions\Integrations`.
3. **§5.2 rule 1 contradicts §5.3 "move `McpFeature` to `App\Enums`".** `McpFeature::isAvailable()` (`app/Mcp/McpFeature.php:14-17`) resolves `App\Support\Llm\Llm` and `App\Mcp\McpTrackers`, so once moved it breaks rule 1. Task 9 writes rule 1 with `->ignoring('App\Enums\McpFeature')` and the reason in the test name. The alternative is to move `isAvailable()` out of the enum, but that changes callers (`SkrumTool`, `AnalyzeRetro.php:47`, `TeamHealth.php:144`) and two assertions in `tests/Feature/Mcp/ToolBaseTest.php:163,169`, which is more than "imports and class names". The spec should say which.
4. **§5.2 rule 9 as worded cannot be written literally.** `expect('App')->not->toBeFinal()` fails on `app/Enums/SignupMode.php` (and every enum): `vendor/pestphp/pest/src/Expectations/OppositeExpectation.php:170` returns false for any enum. Written with `->classes()` it is green. (For information: `SkrumPrompt::handle()` is a `final` method, `app/Mcp/Prompts/SkrumPrompt.php:28`; the rule is about classes and does not see it. `app/Actions/Poker/NewPokerGame.php:7` is `readonly`, not `final`.)
5. **§5.3 "Only cache keys and job-uniqueness keys change" is not exact.** The fourth `md5` is the `ETag` header of `EmojiDataController` (`app/Http/Controllers/EmojiDataController.php:52`), and `tests/Feature/EmojiDataTest.php:29,55` assert `md5(...)` literally. Task 6 changes the header to `xxh128` and edits those two assertions. This is an edit "other than imports and class names" (§5.3, criterion 9). It is harmless (the URL is versioned and served `immutable`; nothing compares the ETag to an outside digest), but the spec sentence should allow it. Alternative that keeps the tests untouched: leave `md5` and add `// @pest-arch-ignore-line` on that line (supported by `vendor/pestphp/pest-plugin-arch/src/Blueprint.php:122`), which would be an unlisted exception to the `security` preset.
6. **§5.3 emoji row is right but incomplete.** Moving the helper fixes three things at once: `App\Http` used outside `App\Http`/`App\Providers`, the public static method on a controller, and project rule 4. The public constant `EmojiDataController::EmojibaseLocales` moves too (`EmojibaseLocale::Locales`); nothing else used it.
7. **§5.3 listeners: the registration must change from explicit to discovered.** The old classes use `on…` method names on purpose (docblock at `app/Listeners/QueueWebhookEvents.php:26-30`) because event discovery is on. A listener with `handle()` in `app/Listeners` is auto-registered, so the `Event::listen` lines in `app/Providers/AppServiceProvider.php:82-88` must go or every listener runs twice. Consequence to accept: the order of the two listeners of `ActionItemCompleted`/`ActionItemReopened` is no longer fixed by code (discovery follows directory order). They are independent (each catches and reports its own failure), and no test depends on the order. If a fixed order is wanted, the alternative is `->withEvents(discover: false)` in `bootstrap/app.php` plus seven explicit `Event::listen(Event::class, Listener::class)` lines.

#### Things the lead should reconcile with other sections

- **Memory.** The architecture plugin needs more than PHP's default 128M (fatal at 128M, fine at 256M on this code base). Task 5 adds `<ini name="memory_limit" value="512M"/>` to `phpunit.xml`; I verified with a throwaway config outside the repo that Pest honours this without a `-d` flag. This affects every suite run through `phpunit.xml`, including the browser suite if it uses the same file.
- **Composer scripts.** Task 5 adds `test:arch` (`config:clear`, then `pest --testsuite=Arch`). `composer test` needs no change to include the Arch suite: `php artisan test` runs every suite of `phpunit.xml`. If another section also edits `composer.json` scripts (`test:browser`), merge the edits.
- **Source scan and the harness.** The scan reads every `.php` file under `tests/Browser`, including `tests/Browser/Support`. The harness (`InteractsWithBrowser`, `ReverbServer`) must therefore not contain the strings `actingAs(`, `withCookie(` or `withCookies(`, even in a comment.
- **Rule 1 lists namespaces by hand.** A new top-level namespace under `app/` (for example `App\Services`) is not covered until it is added to the list in `tests/Arch/ArchTest.php`.
- **Deploy note for Task 6.** `ApplyInboundIssueChanges::uniqueId()` changes its digest; a job queued by the old code holds its uniqueness lock under the old key for at most 300 seconds, so during that window one duplicate job per integration is possible. The job is idempotent by design (`WithoutOverlapping` middleware). Cached GIF searches and the inbound-reachability flag are simply recomputed once.
- **Logs.** Four log lines print an exception's class name (`app/Mcp/Tools/SkrumTool.php:75`, `app/Mcp/Prompts/SkrumPrompt.php:38`, `app/Actions/Integrations/PollTelegramUpdates.php:44`, `app/Jobs/GenerateRetroSummary.php:99`); after Task 7 they show `App\Exceptions\…`. Any log alert keyed on the old names needs updating.

#### UNVERIFIED

- UNVERIFIED: the exact forms `expect('App\Models')->not->toUse([...])` and `expect(['App\Support', 'App\Jobs', 'App\Events'])->not->toUse([...])` used in Task 9 for rules 2 and 3. The probe ran these rules in the equivalent inverse form, one per pair, all green and proven able to fail: `expect('App\Actions')->not->toBeUsedIn('App\Models')`, `expect('App\Http')->not->toBeUsedIn('App\Models')`, `expect('App\Mcp')->not->toBeUsedIn('App\Models')`, and `expect('App\Http')`/`expect('App\Mcp')` `->not->toBeUsedIn(...)` for each of `App\Support`, `App\Jobs`, `App\Events`. The `->not->toUse([list])` form itself was probed on `App\Enums` (green) and on `App\Actions` and `App\Mcp` (red, as it should be). If the array-of-targets form misbehaves, write rules 2 and 3 as those nine `toBeUsedIn` tests.
- UNVERIFIED: the test counts quoted in "Expected" lines (2, 4, 5, 13). They assume each `arch()->preset()` call and each `arch('…')` counts as one test, which is what the probe showed for named tests.
- UNVERIFIED: the move commands of Task 7 Steps 4 to 6 were not executed (read-only brief). The lists they act on come from a script that scanned `app`, `tests`, `config`, `routes`, `bootstrap`, `database`, `lang` and `resources/views` for every moved class: no inline fully qualified reference exists, and the 14 same-namespace users listed in Step 6 are complete. Step 8 (phpstan) is the safety net.
- UNVERIFIED: that Pint adds the blank line after a newly inserted first import in `app/Support/Llm/Llm.php` and `app/Support/Llm/LlmClient.php`; if it does not, add it by hand.
- UNVERIFIED: `npm run build` as the way to regenerate the Wayfinder action for the new controller (the generated folder is git-ignored and built by the Vite plugin, `vite.config.ts:27`); `php artisan wayfinder:generate` also exists.

### Tasks 10 and 11 (poker core)

1. **Counts differ from the spec's estimate.** Spec §4.1 estimates 15 `auto`, 1 `auto-substituted`, 0 `residual` for plan 10a. The final classification is 13 `auto`, 3 `auto-substituted`, 0 `residual`, because steps 5 (link read from the input) and 11 (Reverb stop and start) also use substitutions of §3.6. The spec says its counts are estimates, so no spec correction is needed, but the coverage table's totals must use 13 / 3 / 0.

2. **Walkthrough step 6 names a heading the valid join page does not show.** The walkthrough says: `"Join a planning poker game" form`. In `resources/js/pages/poker/join.tsx`, that string is only the heading of the invalid-link page (lines 26 to 30); the valid form's heading is the game's title with the description "Choose the name other players will see." (lines 39 to 42). `[P10a-06]` asserts the real text. This is a wording slip in the walkthrough, not a defect.

3. **Walkthrough step 14 describes a behaviour the code does not have.** The walkthrough expects "B's next action … shows the session-expired banner". In the code, `PokerGuestTokensController::store` broadcasts `PokerGameChanged` to the others (`app/Http/Controllers/Poker/PokerGuestTokensController.php`, inside the transaction); the guest's page refetches its snapshot on `game.changed` (`resources/js/hooks/use-poker-game.ts`, `case 'game.changed'`); `ResolvePokerPlayer` answers 403 because the guest cookie is still present but its secret was cleared (`app/Http/Middleware/ResolvePokerPlayer.php`, `abort(403, __('You no longer have access to this game.'))`); and a 403 makes the hook call `end('ended')`, which renders `GameGone` with "Your access to this game has ended." (`resources/js/components/poker/game-gone.tsx`). The session-expired banner is shown only for 401 and 419. `[P10a-14]` asserts the code's behaviour, which matches the feature spec ("regenerating the link signs them out", `docs/superpowers/specs/2026-09-29-planning-poker-design.md:385`). If the lead wants the walkthrough's wording to win, that is a product change and needs its own spec decision.

4. **One hook only, shared by all rows.** The harness finding says strict selectors must match one element and suggests a per-item hook. I kept one shared `data-test="poker-task-row"` and never use it alone outside counting assertions: a single row is addressed with `:has-text("<title>")` or `[aria-current="true"]`. A per-task hook (`poker-task-row-${task.id}`) would work too, but the tests arrange tasks by title and several tests create tasks through the interface, where the id is unknown until queried. If the lead prefers the per-id form, change Task 10 Step 1 and replace the `:has-text()` forms. I added `data-test="poker-task-row"` (`resources/js/components/poker/tasks-pane.tsx`). Hand cards, seat cards and the table area already have unique `aria-label` values (listed under Task 10's Produces), so hooks for them would be redundant. If the poker-additions section (Tasks 13 and 14) introduced hooks named `poker-hand-card`, `poker-player-seat` or similar, either drop them in favour of the aria-labels or keep them; they do not conflict with this section. If that section also adds `poker-task-row`, keep a single edit step (this one, in Task 10).

5. **Global helper names.** The helpers `p10aGame()`, `p10aTeamMember()`, `p10aFacilitator()`, `p10aMember()`, `p10aTeamPath()`, `p10aTaskOrderScript()`, `p10aCurrentTaskScript()` are global functions declared in the test file, as `tests/Feature/Poker/TeamPokerSectionTest.php` does with `pokerTeamPage()`. They set the user's `locale` to `en` and a fixed name, which `pokerMember()` and `pokerFacilitator()` cannot do (they take no attributes; `tests/Pest.php:220-237`). If the lead prefers shared helpers in `tests/Pest.php` or in the harness trait, rename them once there and remove them from this file; another file must not redeclare the same names.

6. **`make:test` does not apply.** `php artisan make:test --pest` writes only under `tests/Feature` or `tests/Unit`, so Task 10 Step 3 creates the file directly.

7. **Selector rules taken from the plugin's source** (`src/Support/GuessLocator.php`, `src/Support/Selector.php`, `src/Api/AwaitableWebpage.php`, read from the copy in the scratchpad `pb/` directory, version as downloaded there):
   - Plain text is matched exactly and takes the first match; a string containing `(`, `)`, `:`, `,`, `=`, `[`, `>`, `+`, `~`, `*`, `|`, `^` or `#` is treated as CSS. The brief's "plain text" rule therefore fails for labels such as `Rounds (2)`.
   - `click`, `press`, `keys` and `drag` are not retried by the plugin; Playwright's own waiting applies to them.
   - Other calls are retried only on `ExpectationFailedException`, with an inner Playwright timeout of 1 second per attempt. Reading from a missing element is not retried.
   These rules shaped the tests; the other walkthrough sections should follow them too.

8. UNVERIFIED: Playwright's `:has-text()` pseudo-class inside a CSS selector passed through `GuessLocator` (used for `[role="radio"]:has-text("Custom")`, `[role="option"]:has-text(…)`, `[role="dialog"] button:has-text(…)`, `button:has-text("Rounds (2)")`, `[data-test="poker-task-row"]:has-text(…)`). The source passes an explicit selector straight to `page->locator()`, so it should work; the Task 1 spike should confirm it with one case.

9. UNVERIFIED: the default viewport. The tests need a width of at least 1024 px, otherwise the tasks pane is hidden behind the "Tasks" button and every `@poker-task-row` assertion fails. If the harness does not guarantee it, add `->resize(1280, 800)` in `signIn()` and `joinAsGuest()` rather than in each test.

10. UNVERIFIED: the assertion timeout against the Echo client's reconnect delay in `[P10a-11]`. After `ReverbServer::start()`, pusher-js may wait up to about 10 to 15 seconds before its next attempt. If the suite's browser timeout is the plugin's default of 5 seconds, this test will be flaky; the harness should set the timeout to at least 20 seconds in `tests/Pest.php`, or `ReverbServer::start()` should be followed by `$this->awaitRealtime($guest)` with a longer wait of its own.

11. UNVERIFIED: flash data across the isolation listener. `[P10a-03]` depends on validation errors flashed by the POST and read by the redirected GET. Spec §3.3 says the base class flushes the session store's loaded attributes after every request; if that also drops flashed errors with the `array` driver, this test fails and the spike's fallback (the `database` session driver) is needed.

12. UNVERIFIED: the guest link's host. `[P10a-05]` passes the URL read from the dialog (built with `route('poker.join.show', …)` during a browser request, so it should carry the plugin server's host and port) to `joinAsGuest()`. If the spike shows another host there, `joinAsGuest()` should keep only the path.

13. **A second observer in `[P10a-04b]`, and members instead of the guest in `[P10a-08]` and `[P10a-09]`.** Both are deliberate deviations from the walkthrough's cast, explained in the task text: the observer is the deterministic wait for the stored order, and the two members let both votes be arranged with factories.

### Tasks 12a and 12b (retro core)

Differences between plan 4's walkthrough and the interface as it is today (all read from the current code):

1. **Per-card totals in Voting.** Plan 4 says "no per-card numbers" in Voting. Today the totals are shown in Voting by default and hidden only when the board setting `hide_vote_counts` is on (`app/Models/Retro.php:95` `showsVoteTotals()`, `resources/js/components/retro/retro-card.tsx:160`, migration default `false` in `database/migrations/2026_09_30_090000_add_engagement_settings_to_retros_table.php:15`). `P04-04` arranges `hide_vote_counts => true` so that it checks plan 4's behaviour.
2. **Completed.** Plan 4's "summary" above the columns is now a "Results" tab that replaces the columns; the cards are behind a "Board" tab (`resources/js/components/retro/board.tsx:250`, `results/completed-tabs.tsx`). `P04-06` and `P04-09` click `#completed-tab-board` to reach the read-only cards.
3. **Anonymity.** Action items are not anonymous by design (`resources/js/components/action-items/anonymous-notice.tsx`: "Action items are not anonymous: your name is shown."), and names also appear in the presence strip and in the results' participant list. `P04-09` therefore asserts "no author name" on the card element, not on the whole page.
4. **Language for members** is on `settings/appearance`, not on `settings/profile` (`resources/js/pages/settings/appearance.tsx:33`).
5. **Timer at zero.** Nothing happens on the server during Writing; the client shows "Time's up!", a toast and a beep (`resources/js/components/retro/timer-display.tsx:32`). The only server-side timer effect is the icebreaker round expiry, which is outside plan 4. No `travel()` is used.
6. **Vote limit.** Retros created through the dialog now have an automatic limit (`votes_per_participant` null, `Retro::voteLimit()`); the factory still sets 5. The tests set the limit explicitly or rely on the factory's 5.
7. **Health check and icebreaker phases** are off by default (`RetroFactory`, `NewRetroDialog`), so the stepper has the five phases plan 4 describes; the tests do not turn them on.

Deviations from the brief:

8. **Hook names carry the model id** (`retro-column-{id}`, `retro-card-handle-{id}`) instead of the static `retro-card` / `retro-column` the brief suggested. A static name cannot single out one column or one card, and spec §10 criterion 10 allows only `data-test` attributes, so a second attribute such as `data-column-id` was not an option. No `retro-card` hook is added because `<article id="card-{id}">` already exists (`retro-card.tsx:113`).
9. **Step order in Task 12a:** the type check, lint and build run right after the hook edits and before the tests, because the browser suite serves built assets and the hooks do not exist for the tests until the build has run.
10. **`UserFactory` sets no locale** (`database/factories/UserFactory.php`), and `retroMember()` / `retroFacilitator()` / `teamMember()` create their users through it. `plan04Board()` and `P04-01` set `'locale' => 'en'` (and fixed names) on the users they get back, to meet the brief's "users have locale en".
11. **Harness findings applied.** Every CSS and `@` selector used in an action or an assertion targets exactly one element (cards by `#card-{id}`, columns and drag handles by the per-id hooks); repeated elements are checked with `assertCount()`; every action on something that appears asynchronously (a menu, a dialog, a lazily loaded list, a control that arrives by realtime) is preceded by an assertion on it. No test calls `Event::fake()` or `travel()`.
12. **Spec §4.1 estimate.** The spec expects 13 `auto`, 2 `auto-substituted`, 2 `residual` for plan 4. The final classification has more rows because five items were split; see the count under the coverage table.

UNVERIFIED (nothing was run; these depend on plugin or library behaviour):

- UNVERIFIED: that `dragWithKeyboard()` with `['Space', 'ArrowDown', 'Space']` gives dnd-kit time to recompute the `over` target between the arrow key and the drop. The expected targets were derived by reading `sortableKeyboardCoordinates` and `closestCenter` against the layout, not by running them. If the drop lands before `over` updates, the helper needs a short pause or an assertion on dnd-kit's live region between keys.
- UNVERIFIED: that in `P04-03` ArrowRight from a card in the first column lands on the second column's drop zone (and not the third's), and that the drop then resolves to `column:{id}` of the second column.
- UNVERIFIED: that `press('Next')`, `press('Delete')`, `press('Complete')`, `click('1 min')` and `click('Dark')` match the intended element. If the plugin matches text as a substring, "1 min" could match "10 min" (it is first in the DOM, so the first match is still right) and `press('Delete')` could match another button; the delete dialog is the only place with a "Delete" button while it is open.
- UNVERIFIED: that clicking a Radix select option by its text (`click('Français')`) selects it, and that `keys()` on `[role="menu"] > :nth-child(n)` and on `[role="dialog"]` focuses those elements before pressing the key.
- UNVERIFIED: that `assertAttributeContains($selector, 'class', …)` reads the `class` attribute, and that `assertNotPresent()` passes for a selector with zero matches under the strict-selector rule (it is only used that way).
- UNVERIFIED: that the open Radix select list has `role="listbox"`, and that a member's Discussing column holds exactly one `button[aria-pressed]` (`P04-05a`) and a facilitator's card exactly one (`P04-05b`) when no card has a reaction.
- UNVERIFIED: that after `ReverbServer::start()` pusher-js reconnects within the plugin's assertion timeout; its retry delay after an "unavailable" state can be several seconds.
- UNVERIFIED: that `signIn()` works for a user whose locale is `fr` (`P04-13`'s French case): the login page itself is rendered before authentication and so in English, but anything the helper waits for after the redirect is in French.
- UNVERIFIED: that the browser context's default colour scheme is light, which `P04-16a` asserts before choosing "Dark".
- UNVERIFIED: that `route('teams.show', [$team->workspace, $team], false)` returns the path `/w/{slug}/teams/{id}` the facilitator's page ends on after deleting the retro (`delete-retro-dialog.tsx` visits `board.links.team`, whose exact form was not read).

### Tasks 13 and 14 (poker additions)

1. **No `data-test` hook is introduced or required by Tasks 13–14.** Hand cards (`aria-label="Play :card"`), seats (`role="img"` with `aria-label="{name}: …"`), the player menu, the timer (`role="timer"`), the watching and anonymous rows (`section[aria-label]`) and every checkbox (`id`) are already unique. The cursor and reaction layers are targeted by the class names of the `live-cursors` and `live-reactions` packages (`.lc-overlay`, `.lc-cursor`, `.lr-overlay`, `.lr-reaction`, `.lr-label`; both `^0.2.0` in `package.json:45-46`). If the lead wants these insulated from a package upgrade, the smallest edit is a `data-test` on a wrapper in `resources/js/components/realtime/live-cursors.tsx:85` and `flying-reactions.tsx:102`; I did not add it because the brief asks to keep the count of new attributes low. The fragment does not use `poker-task-row` (Task 10): the one task selection, in `[P10b-05]`, clicks the exact title text; `[data-test="poker-task-row"]:has-text("Checkout flow")` is the equivalent if you want it uniform.
2. **Walkthrough item 13 says "no hand" on an ended game; the code keeps the hand and disables it.** `resources/js/components/poker/hand.tsx:24-25,85` (`isClosed … game.endedAt !== null` → `disabled`), and the feature spec agrees with the code (`docs/superpowers/specs/2026-09-29-planning-poker-design.md:321`, "Disabled when … the game ended"). `[P10b-13]` asserts a disabled card. This is a loose walkthrough sentence, not a defect.
3. **Walkthrough item 10 says the history of an anonymous round "lists who voted without values"; the code lists values with counts and no names.** `resources/js/components/poker/round-votes.tsx:17-32` renders "Anonymous votes" and `{value} × {count}`. The feature spec (`…planning-poker-design.md:145`) only requires that no payload links a value to a player, which the code satisfies. `[P10b-10b]` asserts "3 × 1" and "5 × 1" and the absence of "Ada: 3" / "Bob: 5". Please confirm which wording is intended; if the walkthrough is right this is a product defect to report, not a selector to change.
4. **The shortest timer in the interface is 30 seconds, not 10.** `resources/js/components/poker/round-timer-control.tsx:25` (`PresetSeconds = [30, 60, 120, 180]`) and custom whole minutes (`:73`); only the endpoint accepts 10 (`app/Http/Controllers/Poker/PokerTimersController.php:26`). The browser-test spec's "a short real timer is used" (§3.6) would therefore mean a 30-second wait per test; Tasks 13–14 use no real timer.
5. **Time travel does not move the browser's clock.** With auto-reveal off, the page shows "Time's up!" only after it receives a newer `serverTime`; `[P10b-08b]` reloads both pages (`navigate`) after travelling. The toast and sound are listed as residual `P10b-08s`. The spec's estimate for plan 10b (9 auto, 6 substituted, 1 residual, §4.1) becomes, per walkthrough item: 10 auto (1, 2, 4, 5, 6, 10, 11, 12, 13, 15), 5 substituted (3, 7, 8, 9, 16) and 1 residual (14), plus three partial residuals (touch cursors, reaction origin, timer sound); the table above has the per-test rows.
6. **Browser timeout.** `[P10b-07]` relies on assertion retry across the 2-second debounce in `resources/js/components/poker/auto-reveal-triggers.tsx:7`; the timeout set in `tests/Pest.php` must be at least 5 seconds.
7. **`teamMember()` / `pokerMember()` create users with `locale = null`** (the column is nullable, `database/migrations/2026_09_29_104444_add_locale_to_users_table.php:12`), which contradicts the brief's "users … have `'locale' => 'en'`". My helper `p10bRenamed()` force-fills `locale = 'en'` and a fixed name. Without it `SetLocale` falls back to the browser's `Accept-Language` (`app/Http/Middleware/SetLocale.php:35-43`).
8. **Item 15's "card dragging still works"** is not tested in the plan 10b file: row `P10b-15d` of the coverage table points at the plan 4 keyboard-drag test `[P04-14c]` (Task 12b).
9. **The worktree has no `node_modules`**; I read the two packages' `dist/react.mjs` from the main checkout's `node_modules` (read-only) to get the class names and lifetimes (`ttlMs = 3000` for cursors, `durationMs = [2000, 3500]` for reactions).
10. UNVERIFIED: that the plugin passes Playwright selector-engine syntax through unchanged, which the tests use in four places: `:has-text("…")`, `:has(> img[…])`, and `button:has-text("Delete deck") >> nth=1` (`[P10b-02b]`). `GuessLocator::for()` sends any explicit selector to `$page->locator($selector)`, so this should hold; if `>> nth=1` is rejected, replace that click with `click('.bg-muted button:has-text("Delete deck")')` (the confirmation bar in `saved-decks-dialog.tsx:157`).
11. UNVERIFIED: that Playwright's `hover()` on a paragraph and a button inside `<main>` produces a `pointermove` the cursor library accepts (it listens on the main pane and ignores non-mouse pointers; Playwright's mouse reports `pointerType: "mouse"`). I avoided hovering the hand because its cards are disabled between rounds and disabled controls may swallow pointer events.
12. UNVERIFIED: that `$this->artisan('queue:work', ['--once' => true])` runs in-process against the test's database connection and honours the travelled clock when it picks the delayed job (`DatabaseQueue` uses `Carbon::now()` through `InteractsWithTime`), and that the job's dispatch `->afterCommit()` fires inside the `RefreshDatabase` transaction (brief §3.1 says after-commit callbacks do).
13. UNVERIFIED: that the saved-decks dialog stays open after a successful save. It depends on Inertia keeping component state on `router.post`/`patch`/`delete` (the installed `@inertiajs/core` defaults those to `preserveState: true`). `[P10b-01]` and `[P10b-02a]` assert on the dialog right after "Save"; if it closes instead, that contradicts walkthrough item 1 ("the list shows `1 2 3 5 8 ? ☕`") and should be reported as a defect.
14. UNVERIFIED: that a member's `signIn()` followed by `navigate()` on the same page keeps the session (used in `[P10b-02a]`, `[P10b-02b]`, `[P10b-07]`, `[P10b-08b]`).
