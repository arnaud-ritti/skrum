# Skrum — Browser end-to-end tests, automated walkthroughs and architecture tests — Design

Date: 2026-10-01
Status: Approved decisions, awaiting spec review
Parent spec: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md`. This spec changes no product behaviour; it changes how every other spec's behaviour is verified.

## 1. Intent

Every plan from 4 to 15 ends with a manual **walkthrough**: a QA script in its Verification task, driven by hand in two or three browsers. There are about 25 of them and about 200 steps. None is recorded as passed, and eight specs carry "the walkthrough passes" as an acceptance criterion that is therefore still open. The walkthrough is also the only check of the interface, because the project has no browser test.

This spec turns the walkthroughs into automated browser tests, keeps a short manual checklist for what a test cannot judge, and adds architecture tests that keep the code's structure from drifting.

**Success:** every walkthrough step is either covered by a named, passing browser test or listed in the residual manual checklist with its reason; the architecture tests pass with no unexplained exception; the existing suite, phpstan, type-check and lint stay green.

### In scope

- A browser test suite built on Pest browser testing (`pestphp/pest-plugin-browser`, which drives Playwright).
- A test harness: real sign-in and guest join, several isolated users in one test, a real Reverb server, helpers for realtime waits and drag-and-drop.
- A convention that maps each walkthrough step to a test, and a coverage table that records the mapping.
- A residual manual checklist.
- Architecture tests (`pestphp/pest-plugin-arch`, already installed): the `php`, `security` and `laravel` presets plus project rules, and the code changes needed to pass them.
- A CI job for the browser suite, and Composer scripts to run each suite.
- **First slice (plan 16a):** the harness, the architecture tests, and the walkthroughs of plan 4 (retro core), plan 10a and plan 10b (planning poker).
- **Later slices (plans 16b onward, this same spec):** plans 6, 7, 8a–8e, 9a, 9b, 11b (API tokens page only), 12a–12d, 13a–13d, 14a–14d and 15.

### Out of scope

- Checks against real provider tenants (Slack, Telegram, Jira, Linear, GitHub, Microsoft Teams, Mattermost), real LLM and GIF providers: these go to the residual checklist.
- Claude Code or any other MCP client as an actor. MCP behaviour stays covered by its feature tests.
- Docker image and packaging checks.
- Judgement of visual quality: layout at 375px and 1440px, dark mode, fill parity in the drawing game, touch devices, sound.
- Forged websocket whispers (plan 7 step 11, plan 10b step 14): automating them needs a test-only handle on the Echo client, which was declined.
- Running browser tests in parallel.
- Screenshot comparison (`assertScreenshotMatches`) and accessibility audits (`assertNoAccessibilityIssues`) as gates.
- A JavaScript unit test runner.

### Dependencies

- **New, approved:** `pestphp/pest-plugin-browser` (Composer, dev) and `playwright` (npm, dev), plus the Chromium build Playwright downloads.
- The plugin requires PHP 8.4 and the `sockets` extension.
- Already installed: Pest 5, `pestphp/pest-plugin-arch`, Reverb.

### New folders (approved)

`tests/Browser`, `tests/Arch`, `docs/superpowers/walkthroughs`.

## 2. Decisions

1. **Tool:** Pest browser testing, not a separate `@playwright/test` suite. Browser tests run in the same process as the application, so factories, `Http::fake()`, `Mail::fake()` and time travel all apply to what the browser does.
2. **Slicing:** one spec; the first plan delivers the harness, the architecture tests and three walkthroughs; later plans port the rest.
3. **Third parties:** faked in process with `Http::fake()`; the skrum interface is driven for real. What only a real tenant can show goes to the residual checklist.
4. **Realtime:** the suite runs a real Reverb server; tests open several browser contexts and assert that one sees the other's change.
5. **Architecture tests:** presets `php`, `security` and `laravel`, plus project rules; existing violations are fixed in code. The `strict` preset is not used (the project does not make classes `final` by default).
6. **Listeners:** the two listeners that handle several events are split into one listener per event.
7. **Test hooks in product code:** `data-test` attributes where text or labels are ambiguous, and a `data-realtime` attribute that says when a page's channel is subscribed. No test-only global.
8. **Selectors:** English text and aria-labels first, with the locale fixed to English.

## 3. Harness

The statements in §3.1 come from reading the plugin's source (v5.0.1). They have not been run against this application. The first task of plan 16a is a spike that proves or corrects them; if one is wrong, this spec is corrected before the plan continues.

### 3.1 How the plugin serves the application

- The plugin starts an HTTP server inside the test process on `127.0.0.1` and a free port. Each browser request is handled by the test's own application instance.
- Consequences: `RefreshDatabase` works (same database connection); fakes and time travel apply to browser requests; the `array` session and cache stores keep their state for the length of one test; events marked to dispatch after commit still fire inside the test transaction.
- Each `visit()` opens its own browser context, so cookies and local storage are separate per user.

### 3.2 Base class

`tests/BrowserTestCase.php` extends `Tests\TestCase` and, in `setUp()`:

- re-enables Vite (`Tests\TestCase` disables it) and fails with a clear message when `public/build/manifest.json` is missing or `public/hot` exists;
- sets configuration for the test: broadcasting through Reverb, the Reverb server and client host, port, key and secret, and `app.locale` = `en`;
- makes sure the Reverb server is running (§3.4);
- registers the isolation listener (§3.3).

Configuration is set in the base class rather than in a second PHPUnit file, so a browser test behaves the same when run by path, by filter or from an editor.

`tests/Pest.php` binds the class: `pest()->extend(Tests\BrowserTestCase::class)->use(RefreshDatabase::class)->in('Browser')`, and sets the browser timeout.

### 3.3 Several users in one test

Browser contexts are separate, but they share one application instance, which caches the signed-in user and the session's attributes. Without a reset, a guest's request would inherit the member's session.

- After every handled request, the base class forgets the authentication guards, flushes the session store's loaded attributes and forgets scoped instances.
- If flushing proves unreliable in the spike, the browser suite uses the `database` session driver instead.
- **Rule:** browser tests never call `actingAs()` and never inject cookies. Members sign in through `/login`; guests join through the join page.

### 3.4 Reverb

- `tests/Browser/Support/ReverbServer.php` exposes `ensureRunning()`: if the test port already accepts connections it is reused; otherwise it starts `php artisan reverb:start` on `127.0.0.1` and the test port with the test credentials, waits until the port answers, and stops the process when the test run ends.
- The page reads its Reverb settings from the `reverb-config` meta tag, which is built from configuration at request time, so no asset rebuild is needed.
- The suite runs serially. Parallel runs are out of scope.

### 3.5 Helpers

In `tests/Browser/Support/`:

| Helper | What it does |
|---|---|
| `signIn(User $user, string $to)` | Signs in through `/login`, then opens `$to`; returns the page. |
| `joinAsGuest(string $url, string $name)` | Opens the join link in a new context and submits the name; returns the page. |
| `awaitRealtime($page)` | Waits until the page's root shows `data-realtime="connected"`. |
| `dragWithKeyboard($page, $handle, array $keys)` | Moves a sortable item with the keyboard (focus, Space, arrows, Space). |

- **Waiting:** no fixed sleeps. The plugin's assertions retry until the timeout, so after `awaitRealtime()` the assertion on the other page is the wait.
- **Drag-and-drop:** the boards use dnd-kit with a pointer sensor that needs 6px of movement; the plugin's `drag()` does one press, one move and one release, which is unreliable there. Tests use the keyboard sensor, which the product already supports and documents for screen readers. Keys are sent one at a time, and the helper waits for the sensor between them (a turn of the page's event loop after the pick-up, then the next animation frames or the "Moved … to position N." announcement after each arrow): keys sent back to back are lost (spike finding c). These waits follow the page's own events; they are not fixed sleeps.
- **Reverb process:** the suite's Reverb child process must not write to the test runner's output pipe (spike finding: it keeps the pipe open and hangs a piped run); its output goes to a file that the failure message quotes.
- **Reconnect time:** after Reverb comes back, the Echo client reconnected after about 13 seconds in the spike, so the browser timeout is 20 seconds.
- **Guest links:** read from the dialog's input, not from the clipboard.
- **Arranging data:** tests reuse the existing helpers in `tests/Pest.php` (`retroFacilitator()`, `retroMember()`, `teamMember()`, `workspaceManager()`, `pokerFacilitator()`, `pokerMember()`) and factory states (`RetroFactory::inPhase()`, `withGuestAccess()`, `PokerGameFactory::withGuestAccess()`, `deck()`). They do not use the guest-cookie helpers or the fake presence rosters: guests join through the interface and presence comes from Reverb.
- **Users** are created with locale `en`.

### 3.6 Substitutions

The plugin cannot inspect websocket frames, cut the network or control the browser's clock. Walkthrough steps that asked for those are checked as follows:

| Walkthrough asks for | Test does |
|---|---|
| "The websocket frame contains no card value" | Asserts the value is absent from the other user's page (visible text and document text). Payload redaction stays proved by the existing feature tests. |
| "Go offline, come back" | Stops and restarts Reverb; asserts the reconnecting banner, then the catch-up. |
| A timer reaching zero | Uses the `database` queue, travels in time, then runs one queued job. Where the browser's own countdown must be seen, a short real timer is used. |
| A link copied to the clipboard | Reads the link from the dialog's input. |
| A third-party call | `Http::fake()` with the provider's response; asserts what skrum shows and what it sent. |
| An email | `Mail::fake()` or `Notification::fake()`; asserts recipient and locale. |
| A layout at a given screen width | Sets the viewport and asserts structural facts with scripts (scroll widths, element order). The visual judgement stays residual. |
| Dark mode | Asserts that the `dark` class is applied and kept. Legibility stays residual. |
| A participant closing their tab | The participant leaves the page through the interface, which is the same presence-leave on the server. |

### 3.7 Changes to product code

- `data-realtime`: the root element of `retros/show`, `poker/show` and `games/show` carries `data-realtime="connecting"` or `"connected"`, taken from the state the channel hooks (`use-retro-channel.ts`, `use-poker-channel.ts`, `use-game-channel.ts`) already track.
- `data-test`: added to an element only when a test cannot target it by English text or label (for example a card, a column, a poker hand card, a task row).
- No other product change is made for the browser suite.

## 4. From walkthrough to tests

- **Files:** one file per walkthrough in `tests/Browser/Walkthroughs/`, named after the plan: `Plan04RetroCoreTest.php`, `Plan10aPokerCoreTest.php`, `Plan10bPokerAdditionsTest.php`.
- **Tests:** one `it()` per step, or per group of steps that only make sense together. Each test arranges its own state with factories; no test depends on another.
- **Identifiers:** each title starts with the step's identifier: `it('[P10a-07] hides the vote value until reveal')`. The identifier is `P<plan>-<step>`, with a letter suffix when one step becomes several tests.
- **Coverage table:** `docs/superpowers/walkthroughs/coverage.md` has one row per walkthrough step: identifier, plan file and line, test file, and status.

| Status | Meaning |
|---|---|
| `auto` | Covered by a browser test as written. |
| `auto-substituted` | Covered by a browser test using a substitution from §3.6. |
| `residual` | Not automated; listed in the residual checklist with the reason. |

- **Residual checklist:** `docs/superpowers/walkthroughs/residual-manual-checklist.md` lists each residual step, why it is not automated, and how to check it by hand.
- **Smoke tests:** `tests/Browser/Smoke/` holds the harness's own tests (two isolated users, one realtime round trip).

### 4.1 First slice

The three walkthroughs have 49 steps (plan 4's prose split into 17, plan 10a's 16, plan 10b's 16). Several steps become more than one test, and a step whose visual or audible part cannot be automated gets a separate `residual` row, so the coverage table has 70 rows.

| Walkthrough | Rows | `auto` | `auto-substituted` | `residual` |
|---|---|---|---|---|
| Plan 4, retro core | 26 | 19 | 5 | 2 |
| Plan 10a, poker core | 16 | 13 | 3 | 0 |
| Plan 10b, poker additions | 28 | 18 | 6 | 4 |
| **Total** | **70** | **50** | **14** | **6** |

Residual in this slice: the visual judgement at 375px/1440px and of dark mode (plan 4); touch cursors, where a reaction starts on screen, the timer's sound and toast, and the forged whisper (plan 10b). These counts come from plan 16a as written; the coverage table records the final classification after implementation.

## 5. Architecture tests

`tests/Arch/ArchTest.php`, in its own `Arch` test suite.

### 5.1 Presets

`php`, `security` and `laravel`.

### 5.2 Project rules

1. `App\Enums` uses nothing from `App` outside `App\Enums`. One exception, stated on the test: `McpFeature`, which asks the container whether its feature is available (`Llm`, `McpTrackers`).
2. `App\Models` does not use `App\Actions`, `App\Http` or `App\Mcp`.
3. `App\Support`, `App\Jobs` and `App\Events` do not use `App\Http` or `App\Mcp`.
4. `App\Actions` does not use `App\Http`.
5. `App\Contracts` contains only interfaces.
6. `App\Rules` classes implement `ValidationRule`.
7. Every `Concerns` namespace contains only traits.
8. `App\Mcp\Tools` classes extend `SkrumTool`.
9. No class in `App` is `final`. Enums are not checked: a PHP enum is final by nature.

A rule that turns out not to describe the code as designed (for example rule 8, if some tools legitimately extend another base) is corrected in this spec before it is written as a test.

### 5.3 Code changes to pass

The exact list, from running the presets and the rules against the code on 2026-10-01 (the `php` preset already passes).

| Violation | Where | Change |
|---|---|---|
| `md5` or `sha1` | `app/Support/Gifs/GifCatalog.php`, `app/Http/Controllers/EmojiDataController.php`, `app/Support/Integrations/InboundReachability.php`, `app/Jobs/Integrations/ApplyInboundIssueChanges.php` | `hash('xxh128', …)`. Three are cache or job-uniqueness keys; the fourth is the `ETag` of the emoji data, an opaque validator only this controller produces. None is compared with a digest defined elsewhere. |
| `assert` | `app/Actions/Mcp/IssueMcpToken.php` | An `instanceof` check that throws. |
| `array_rand` | `app/Actions/Games/RevealGameHint.php` | `Arr::random()`. |
| Enum outside `App\Enums` | `app/Mcp/McpFeature.php` | Move to `App\Enums` (rule 1's stated exception). |
| Exceptions outside `App\Exceptions` | 22 classes: 17 in `app/Support/Integrations/Exceptions`, `Inbound/InboundSignatureInvalid`, `Trackers/EstimateRejected`, 2 in `app/Support/Llm`, 1 in `app/Mcp/Prompts` | Move to `App\Exceptions\Integrations`, `App\Exceptions\Llm` and `App\Exceptions\Mcp`. Names and behaviour unchanged. |
| Listeners without `handle` | `app/Listeners/QueueActionItemStatusPushes.php`, `app/Listeners/QueueWebhookEvents.php` | One listener per event (seven), each with `handle()`; shared logic moves to two actions. Laravel's event discovery registers a listener that has `handle()`, so the seven explicit `Event::listen` lines in `AppServiceProvider` are removed (keeping them would run each listener twice). The order of the two listeners of the same event is then no longer fixed by code; they are independent. |
| A controller's public static helper used by actions | `EmojiDataController::emojibaseLocale()` and its locale map, used by `BuildBoardSnapshot` and `BuildGameSnapshot` | Move to `App\Support\EmojibaseLocale`. |
| A non-CRUD public controller method | `Games\GameDrawingOpsController::destroyLast()` | Its own controller, `GameLastDrawingOpsController::destroy()`. Route name and URL unchanged; the one frontend caller (`draw-board.tsx`) imports the new action. |

- These are refactors: no behaviour changes, and the existing feature tests must stay green without edits other than imports, class names and the two `ETag` assertions of `tests/Feature/EmojiDataTest.php`.
- An `ignoring()` is allowed only where the rule is wrong for that class, and carries the reason on the same test.
- The exception moves and the listener split touch files that plan 15 is changing. Plan 16a starts after plan 15 is merged.

## 6. Running the suites

| Command | Runs |
|---|---|
| `composer test` | As today (lint check, phpstan, Unit and Feature), plus the `Arch` suite. No browser test. |
| `composer test:arch` | The `Arch` suite only. |
| `composer test:browser` | Builds the assets, then runs `tests/Browser`. |

- The browser suite is not a PHPUnit test suite in `phpunit.xml`, so `php artisan test` does not pick it up.
- `.gitignore` gains `/tests/Browser/Screenshots`.
- `phpunit.xml` sets `memory_limit` to 1G: the architecture tests load the whole `app/` tree; they exhaust PHP's default 128M on their own, and 512M once the `laravel` preset runs after the Unit and Feature suites in one process.
- Locally the suite runs inside Sail, where the database host resolves; the Sail image already installs Playwright's system dependencies.

### 6.1 CI

`.github/workflows/tests.yml` gains a `browser` job: PHP 8.4 with `sockets` and `pdo_pgsql`, a PostgreSQL service with the `testing` database, Node, `npm ci`, `npx playwright install --with-deps chromium`, `composer test:browser`, and an upload of `tests/Browser/Screenshots` when the job fails.

The existing `ci` job runs PHP 8.3 and has no PostgreSQL service. The plugin needs PHP 8.4 and the `sockets` extension, and its hooks load in every Pest run, so that job's PHP version is raised to 8.4 and it gains the `sockets` extension. Anything else wrong with that job is reported to the user, not redesigned here.

## 7. Errors and failure modes

| Situation | Result |
|---|---|
| Assets not built, or a Vite dev server is running (`public/hot`) | The base class fails the test at once with a message naming the fix. |
| Reverb cannot start or the port never answers | The test fails with the Reverb process's output. |
| A realtime assertion never becomes true | The assertion times out; a screenshot of each open page is kept. |
| A browser test calls `actingAs()` or injects a cookie | A test in the `Arch` suite reads the files under `tests/Browser` and fails on `actingAs(`, `withCookie(` or `withCookies(`. (Architecture expectations see classes and functions, not method calls, so this is a source scan.) |
| A browser test calls `Event::fake()` with no argument | The same scan fails: a blanket fake removes the isolation listener of §3.3. Faking named events stays allowed. |
| A walkthrough step has no row in the coverage table | Found in review of the coverage table; acceptance criterion 5. |

## 8. Changes to other specs

This spec supersedes the following statements; the specs themselves are not edited.

- Retro board core: "No browser E2E in v1" and "Browser E2E test suite" (out of scope).
- Polish pass, board engagement, games: "no frontend test runner is added" and equivalents.
- In every spec with the criterion "the walkthrough passes": the criterion is met when every step of that spec's walkthroughs is `auto` or `auto-substituted` with a passing test, and every `residual` step has been checked by hand and recorded.

## 9. Testing

- **Harness smoke tests:** a member and a guest in one test, where the guest's page never shows the member's identity; a card or vote made by one user appearing on the other's page without reload.
- **Walkthrough tests:** as listed in the coverage table.
- **Architecture tests:** written first and seen failing on the violations in §5.3, then passing after each fix.
- **Regression:** the existing Unit and Feature suites pass before and after the refactors of §5.3.
- **Stability:** the browser suite passes twice in a row locally before the plan is closed.

## 10. Acceptance criteria

1. `composer test:browser` builds the assets, starts Reverb when it is not already running, and passes on a clean checkout inside Sail.
2. Browser tests never use `actingAs()` or injected cookies: members sign in and guests join through the interface. A source scan in the `Arch` suite enforces it (§7).
3. Two or more users in one test are isolated: a guest's page never inherits a member's session.
4. A change made by one user appears on another user's page through Reverb, asserted without a fixed sleep.
5. Every step of the plan 4, plan 10a and plan 10b walkthroughs has a row in `docs/superpowers/walkthroughs/coverage.md`; every `auto` and `auto-substituted` row names a passing test; every `residual` row appears in the residual checklist with its reason.
6. `composer test:arch` passes with the `php`, `security` and `laravel` presets and the project rules of §5.2; every `ignoring()` carries a reason.
7. `composer test` contains no browser test and includes the `Arch` suite.
8. CI runs the browser suite in its own job with PostgreSQL, Chromium and built assets, and uploads screenshots when it fails.
9. The refactors of §5.3 change no behaviour: the existing suite passes with only imports, class names and the two emoji `ETag` assertions updated; phpstan, type-check and lint are green.
10. Product code gains only `data-test` attributes, the `data-realtime` attribute and the refactors of §5.3.

Later slices (plans 16b onward) each add their walkthroughs' rows to the coverage table under criterion 5's rule.
