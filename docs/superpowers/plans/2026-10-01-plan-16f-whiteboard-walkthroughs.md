# Plan 16f — Whiteboard walkthroughs (plans 17a to 17d) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate the whiteboard walkthroughs of plans 17a (core), 17b (templates, duplicate, export), 17c (facilitation) and what is left of 17d (secrecy and history) as browser tests, with shared whiteboard test support.

**Architecture:** Browser tests live in `tests/Browser/Walkthroughs`, one file per walkthrough, bound to `Tests\BrowserTestCase` (built assets, a Reverb server started by the suite, authentication reset after every request so several browser contexts act as different users). Each walkthrough step maps to a test whose title starts with the step's identifier; the mapping is recorded in `docs/superpowers/walkthroughs/coverage.md`, and what cannot be automated in `residual-manual-checklist.md`. Tests sign in and join through the real interface, wait on `data-realtime` instead of sleeping, and arrange their own state with factories.

**Tech Stack:** PHP 8.4, Laravel 13, Pest 5 with `pestphp/pest-plugin-browser` 5.x (Playwright, Chromium), Laravel Reverb, Inertia v3 with React 19, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-10-01-browser-e2e-and-arch-tests-design.md` (this plan is one of its "later slices", §1). Read it, and read `docs/superpowers/walkthroughs/harness-findings.md`: it holds the facts proven by running the browser plugin against this application, and it overrides this plan's text where they differ.

**Depends on:** Plans 16a to 16e and the whiteboard feature (plans 17a to 17d) merged on `main` (merge commit 84d4c2d).

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
- The walkthroughs of this plan are files, already replayed once by hand: `docs/superpowers/walkthroughs/plan-17a…17d-*.md`. Coverage rows cite those files.
- A walkthrough section about a feature the product owner removed (dot voting, private writing, quick vote, version history) gets the status `removed` and no test. The coverage task adds the `removed` row to the status legend of `coverage.md` and a "removed" count beside the summary.
- Task 1 adds two hooks to the whiteboard root (`data-realtime` and the `data-scene` stamp, with `resources/js/lib/whiteboard/scene-stamp.ts`); the spec allows both (§3.7). No test-only global is added.
- The server state is the proof: what a participant received is read with `$this->whiteboardSnapshot()` from that participant's page, and the database. Scenes are arranged with factories or the real write endpoint; the canvas is drawn on only where the step is about drawing.
- Driving the Excalidraw canvas with scripted pointer events is unproven. The drawing-dependent tests are few and named in Task 1; if drawing cannot be made reliable, those tests are removed and their rows become `residual`, without touching the rest.
- The timer of a whiteboard has no server job: the test of "time is up" waits about ten real seconds on a ten-second timer. This is the one real wait of the plan.

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
| 1 | Whiteboard test support (hooks, shared helpers, smoke test) |
| 2 | Whiteboard core walkthrough (plan 17a) |
| 3 | Whiteboard templates walkthrough, part 1 (plan 17b, sections 1 and 2) |
| 4 | Whiteboard templates walkthrough, part 2 (plan 17b, sections 3 to 6) |
| 5 | Whiteboard facilitation walkthrough (plan 17c): timer, board lock, element lock |
| 6 | Whiteboard facilitation walkthrough (plan 17c): follow-me, hand-over, reactions, regression |
| 7 | Whiteboard secrecy and history walkthrough (plan 17d): what is left of it |
| 8 | Coverage table and residual checklist |
| 9 | Final verification |

## Review Focus

Conditions the spec implies that a happy-path reading could miss, each pinned by a test.

1. A guest never receives what the server withholds. Expected: absent from the snapshot fetched from the guest's own page, not only from the DOM. Pinned by the guest tests of Tasks 2 and 7.
2. A locked board refuses a participant's write on the server, not only in the interface. Expected: the write endpoint answers with the refusal status and the stored scene is unchanged. Pinned by the lock tests of Task 5.
3. A board created from a template is a copy. Expected: changing or deleting the template changes no board, images included. Pinned by the template tests of Task 3.
4. A reload must not write. Expected: zero element writes after a reload of an unchanged board. Pinned by the reload test of Task 2.
5. Only the facilitator changes facilitation settings. Expected: a guest's or member's request is refused with 403 and nothing changes. Pinned by the tests of Tasks 6 and 7.

---

### Task 1: Whiteboard test support (hooks, shared helpers, smoke test)

This task gives browser tests four things on a whiteboard: a way to wait until the board is live, a way to read what a participant's canvas holds, ways to create elements (through the interface and through the real write endpoint), and a smoke test that proves them.

Facts read from the current code that the task relies on:

- The board page is `resources/js/pages/whiteboards/show.tsx`, which lazy-loads `resources/js/components/whiteboard/board.tsx`. The root `<div className="flex h-dvh flex-col">` of `Board` carries no `data-realtime` today, so `$this->awaitRealtime()` cannot work on a whiteboard. `useWhiteboard()` (`resources/js/hooks/use-whiteboard.ts`) exposes `connected` and `online`, the two values `realtimeState()` (`resources/js/lib/realtime/realtime-state.ts`) needs. The canvas itself is ready only once Excalidraw has handed over its API (`api !== null` in `board.tsx`): before that, `scene-sync` has no listener and an `elements.changed` event is dropped until the first resync. The hook therefore reports `connected` only when the socket is up, the presence channel has answered and the canvas is ready.
- The scene lives inside Excalidraw. Nothing reachable from `script()` exposes it: the API object is held in React state, there is no global, no context a script can read, and `localStorage` holds only `skrum.hideMyCursor`. The server snapshot (`GET /whiteboards/{board}/snapshot`) is the same for every viewer, so it cannot prove that one page received a change. The task therefore adds one hook, `data-scene`, on the board root: the number of live elements on the canvas, then the sum of their `version`, then the sum of their `versionNonce`, as `"<count>:<versions>:<nonces>"`. It holds no text, no position and no identity. Excalidraw's own merge rule treats two copies with the same `version` and `versionNonce` as the same copy, so a page whose stamp equals the stamp computed from the database holds exactly the server's live scene. Excalidraw calls `onChange` after every scene update, local or remote (`board.tsx` already relies on it: `scene-sync` says "the canvas reports it again"), so the stamp follows both.
- Server paths: `GET /whiteboards/{board}/snapshot` (keys `board`, `me`, `members`, `elements` (live elements only), `seq`, `links`, `serverTime`), `GET /whiteboards/{board}/elements?since={seq}` (delta), `PUT /whiteboards/{board}/elements` with a JSON body `{"elements": [...]}` (answers 200 with `{seq, fromSeq, rejected: [{id, reason, element}]}`; limited to 20 writes per second per user and board). The write broadcasts `elements.changed` with `toOthers()`; a write sent with `fetch()` carries no `X-Socket-ID`, so the page that sent it receives the broadcast too and its canvas takes the element in like any other page.
- The post-subscription resync of a whiteboard calls `GET /whiteboards/{board}/snapshot` and `GET /whiteboards/{board}/elements?since=`, 250 ms after the presence subscription, so `$this->awaitResync($page)` works on a whiteboard unchanged.
- `tests/Pest.php` already has `sceneElement(array $overrides = []): array` ("a rectangle as Excalidraw sends it", `index` `a0`, `versionNonce` 100), `whiteboardMember(Whiteboard $board): array{0: User, 1: WhiteboardMember}`, `whiteboardFacilitator(Whiteboard $board): array{0: User, 1: WhiteboardMember}` and the factory state `WhiteboardFactory::withGuestAccess()`. The guest join page (`resources/js/pages/whiteboards/join.tsx`, `/whiteboards/join/{guest_token}`) has `#name` and the button "Join", so `$this->joinAsGuest()` works on it unchanged.
- Two live elements with the same fractional `index` are repaired by the first client that sees them (it gives one a new index and a new version, and writes it back). `sceneElement()` always answers `a0`, so the write helper of this task gives every element it adds its own index (`a0`, `a1`, … `az`, from the number of elements the board already has).
- The sticky tool (`resources/js/components/whiteboard/sticky-tool.tsx`) sits in the canvas toolbar as `button[aria-label="Sticky note"]` at the default desktop viewport; its menu holds six buttons `[aria-label="Add a sticky note: Yellow"]` (Yellow, Orange, Red, Purple, Blue, Green). It needs no canvas pointer event: a click adds a 200×200 note in the middle of the view.
- Excalidraw 0.18.1 (`node_modules/@excalidraw/excalidraw/dist/dev/index.js`): each tool of the shapes toolbar is a `<label class="ToolIcon">` wrapping a hidden radio `input[data-testid="toolbar-<tool>"]` (`selection`, `rectangle`, `diamond`, `ellipse`, `arrow`, `line`, `freedraw`, `text`, `image`, `eraser`); the drawing surface is `canvas.excalidraw__canvas.interactive`; its `pointerdown` handler calls `event.target.setPointerCapture(event.pointerId)` and then listens for `pointermove` and `pointerup` on `window`. `setPointerCapture` throws for an event the browser did not create, so the pointer helper replaces it with a no-op, as `p13bPointer()` does on the games canvas. A new board is neither scrolled nor zoomed, so a point given in pixels from the canvas's top-left corner is also the scene coordinate.

Driving the Excalidraw canvas with dispatched pointer events is not proven. The second smoke test of this task is the proof. It is written so that it can be removed alone: if it cannot be made to pass, delete that one test and the three methods `selectWhiteboardTool()`, `dragOnWhiteboard()` and `drawOnWhiteboard()` from the trait, and nothing else in this task changes. The only later tests that use those three methods are `[P17a-02b]` and `[P17a-03a]` (Task 2); Task 2 says what to do with them in that case.

**Files:**
- Create: `resources/js/lib/whiteboard/scene-stamp.ts`
- Modify: `resources/js/components/whiteboard/board.tsx`
- Create: `tests/Browser/Support/InteractsWithWhiteboards.php`
- Modify: `tests/BrowserTestCase.php`
- Create: `tests/Browser/Smoke/WhiteboardHarnessTest.php`
- Test: `tests/Browser/Smoke/WhiteboardHarnessTest.php`

**Interfaces:**
- Consumes:
  - `Tests\BrowserTestCase` with `$this->signIn(User $user, string $to): mixed`, `$this->joinAsGuest(string $joinUrl, string $name): mixed`, `$this->awaitRealtime(mixed $page): mixed`, `$this->snapshotOf(mixed $page, string $snapshotPath): array`.
  - `realtimeState(connected: boolean, online: readonly unknown[]): RealtimeState` from `resources/js/lib/realtime/realtime-state.ts`.
  - `tests/Pest.php`: `sceneElement(array $overrides = []): array`, `whiteboardFacilitator(Whiteboard $board): array`.
- Produces:
  - Hook `data-realtime` (`connecting` or `connected`) on the root `<div>` of `Board` in `resources/js/components/whiteboard/board.tsx`. `connected` means: socket up, presence answered, canvas ready. The root is not rendered once the board is gone for the viewer ("Your access to this board has ended." or "This board was deleted."), so `assertNotPresent('[data-realtime]')` proves that state.
  - Hook `data-scene="<count>:<versions>:<nonces>"` on the same element: live elements on this page's canvas, the sum of their `version`, the sum of their `versionNonce`.
  - `sceneStamp(elements: readonly SceneElement[]): string` in `resources/js/lib/whiteboard/scene-stamp.ts`.
  - Trait `Tests\Browser\Support\InteractsWithWhiteboards`, used by `Tests\BrowserTestCase`, so every method is called as `$this->…` from a test (a file-level helper function cannot call them):
    - `whiteboardSnapshot(mixed $page, Whiteboard $board): array` — `GET /whiteboards/{board}/snapshot` as that page's viewer; throws `RuntimeException` ("snapshotOf() got HTTP 403 for …") on any answer other than 200.
    - `whiteboardElements(mixed $page, Whiteboard $board): array` — the `elements` list of that snapshot.
    - `writeWhiteboardElements(mixed $page, Whiteboard $board, array $elements): array` — `PUT /whiteboards/{board}/elements` sent with `fetch()` from the page; returns `['status' => int, 'body' => array]` whatever the status (use it for refusals and tampering).
    - `addWhiteboardElement(mixed $page, Whiteboard $board, array $overrides = []): array` — writes one `sceneElement()` with its own `index`, `seed` and `versionNonce`; throws unless the answer is 200 with no rejection; returns the element as sent (`$element['id']` is its id).
    - `addWhiteboardSticky(mixed $page, string $colour = 'Yellow'): mixed` — adds a sticky note through the sticky tool of the interface.
    - `awaitWhiteboardElements(mixed $page, int $count): mixed` — waits until this page's canvas holds `$count` live elements.
    - `awaitWhiteboardStored(mixed $page, Whiteboard $board, int $count): mixed` — waits until the server's snapshot holds `$count` live elements (fetched from the page, so the wait lets the server work).
    - `awaitWhiteboardScene(mixed $page, Whiteboard $board): mixed` — waits until this page's canvas holds exactly the server's live scene (stamp equality, read again from the database on every attempt, up to 15 seconds).
    - `whiteboardSceneStamp(Whiteboard $board): string` — the stamp of the live elements in the database.
    - `selectWhiteboardTool(mixed $page, string $tool): mixed`, `dragOnWhiteboard(mixed $page, array $from, array $to, int $steps = 8): mixed`, `drawOnWhiteboard(mixed $page, string $tool, array $from, array $to): mixed` — canvas driving with pointer events; `$from` and `$to` are `[x, y]` in pixels from the top-left corner of the canvas. Unproven until the second smoke test passes.
  - Paths: board `/whiteboards/{board}`, guest join `/whiteboards/join/{guest_token}`, snapshot `/whiteboards/{board}/snapshot`, write `/whiteboards/{board}/elements`.
  - Stable selectors that need no hook: board title `header > h1`; presence `[role="group"][aria-label="<n> online"]` with `header img[data-presence-id][alt="<name>"]`; board menu `[aria-label="Board menu"]` (items `[role="menuitem"]:has-text("…")`, switches `[role="menuitemcheckbox"]:has-text("…")`); facilitator tools `[role="toolbar"][aria-label="Facilitation tools"]`; sticky tool `button[aria-label="Sticky note"]`; reactions bar `.whiteboard-reactions[role="toolbar"][aria-label="Reactions"]`; canvas container `.whiteboard-canvas`.

- [ ] **Step 1: Create the trait**

Create `tests/Browser/Support/InteractsWithWhiteboards.php` with this content:

```php
<?php

namespace Tests\Browser\Support;

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use InvalidArgumentException;
use RuntimeException;

trait InteractsWithWhiteboards
{
    /**
     * @return array<string, mixed>
     */
    protected function whiteboardSnapshot(mixed $page, Whiteboard $board): array
    {
        return $this->snapshotOf($page, "/whiteboards/{$board->id}/snapshot");
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    protected function whiteboardElements(mixed $page, Whiteboard $board): array
    {
        return $this->whiteboardSnapshot($page, $board)['elements'];
    }

    /**
     * Sends the write from inside the page, without X-Socket-ID, so the page that sends it receives the broadcast as well.
     *
     * @param  array<int, mixed>  $elements
     * @return array{
     *     status: int,
     *     body: array<string, mixed>
     * }
     */
    protected function writeWhiteboardElements(mixed $page, Whiteboard $board, array $elements): array
    {
        $path = json_encode("/whiteboards/{$board->id}/elements", JSON_THROW_ON_ERROR);
        $body = json_encode(json_encode(['elements' => $elements], JSON_THROW_ON_ERROR), JSON_THROW_ON_ERROR);

        $answer = json_decode((string) $page->script(<<<JS
            async () => {
                const cookie = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='));
                const response = await fetch({$path}, {
                    method: 'PUT',
                    credentials: 'same-origin',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-XSRF-TOKEN': decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)),
                    },
                    body: {$body},
                });

                return JSON.stringify({ status: response.status, body: await response.text() });
            }
            JS), true, flags: JSON_THROW_ON_ERROR);

        return ['status' => $answer['status'], 'body' => json_decode((string) $answer['body'], true) ?? []];
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    protected function addWhiteboardElement(mixed $page, Whiteboard $board, array $overrides = []): array
    {
        $element = sceneElement([
            'index' => $this->nextWhiteboardIndex($board),
            'seed' => random_int(1, 2_000_000_000),
            'versionNonce' => random_int(1, 2_000_000_000),
            ...$overrides,
        ]);

        $answer = $this->writeWhiteboardElements($page, $board, [$element]);
        $refusal = json_encode($answer['body']);

        throw_unless(
            $answer['status'] === 200 && ($answer['body']['rejected'] ?? null) === [],
            RuntimeException::class,
            "addWhiteboardElement() was refused with HTTP {$answer['status']}: {$refusal}",
        );

        return $element;
    }

    protected function addWhiteboardSticky(mixed $page, string $colour = 'Yellow'): mixed
    {
        $page->assertPresent('button[aria-label="Sticky note"]')
            ->click('button[aria-label="Sticky note"]')
            ->click("[aria-label=\"Add a sticky note: {$colour}\"]")
            ->assertNotPresent('[role="menu"]');

        return $page;
    }

    protected function awaitWhiteboardElements(mixed $page, int $count): mixed
    {
        $page->assertPresent("[data-scene^=\"{$count}:\"]");

        return $page;
    }

    protected function awaitWhiteboardStored(mixed $page, Whiteboard $board, int $count): mixed
    {
        $path = json_encode("/whiteboards/{$board->id}/snapshot", JSON_THROW_ON_ERROR);

        $page->assertScript("() => fetch({$path}, { headers: { Accept: 'application/json' } }).then((response) => response.json()).then((snapshot) => snapshot.elements.length)", $count);

        return $page;
    }

    /**
     * The server stamp is read again on every attempt: a canvas sends a drag or a stroke in several writes,
     * so the scene the server holds can still change after the first look.
     */
    protected function awaitWhiteboardScene(mixed $page, Whiteboard $board): mixed
    {
        $held = '';
        $stored = '';

        for ($attempt = 0; $attempt < 60; $attempt++) {
            $stored = $this->whiteboardSceneStamp($board);
            $held = (string) $page->script("() => document.querySelector('[data-scene]')?.dataset.scene ?? ''");

            if ($held === $stored) {
                return $page;
            }

            $page->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 250))');
        }

        $this->assertSame($stored, $held, 'The canvas of this page does not hold the scene the server holds.');

        return $page;
    }

    protected function whiteboardSceneStamp(Whiteboard $board): string
    {
        $live = WhiteboardElement::query()
            ->where('whiteboard_id', $board->id)
            ->where('is_deleted', false)
            ->get(['version', 'version_nonce']);

        return "{$live->count()}:{$live->sum('version')}:{$live->sum('version_nonce')}";
    }

    protected function selectWhiteboardTool(mixed $page, string $tool): mixed
    {
        $page->click(".whiteboard-canvas .App-toolbar label:has([data-testid=\"toolbar-{$tool}\"])")
            ->assertScript("document.querySelector('.whiteboard-canvas [data-testid=\"toolbar-{$tool}\"]').checked", true);

        return $page;
    }

    /**
     * Excalidraw captures the pointer on pointerdown, which throws for an event the browser did not create,
     * and it reads moves once per animation frame, so every event waits for a frame.
     *
     * @param  array{0: int|float, 1: int|float}  $from
     * @param  array{0: int|float, 1: int|float}  $to
     */
    protected function dragOnWhiteboard(mixed $page, array $from, array $to, int $steps = 8): mixed
    {
        $gesture = json_encode(['from' => $from, 'to' => $to, 'steps' => $steps], JSON_THROW_ON_ERROR);

        $page->script(<<<JS
            async () => {
                const gesture = {$gesture};
                const canvas = document.querySelector('.whiteboard-canvas canvas.excalidraw__canvas.interactive');
                const box = canvas.getBoundingClientRect();
                const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(true)));
                const fire = (type, point, buttons) => canvas.dispatchEvent(new PointerEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    pointerId: 1,
                    pointerType: 'mouse',
                    isPrimary: true,
                    button: 0,
                    buttons,
                    pressure: buttons === 1 ? 0.5 : 0,
                    clientX: box.left + point[0],
                    clientY: box.top + point[1],
                }));

                canvas.setPointerCapture = () => {};
                canvas.releasePointerCapture = () => {};

                fire('pointerdown', gesture.from, 1);
                await frame();

                for (let step = 1; step <= gesture.steps; step += 1) {
                    fire('pointermove', [
                        gesture.from[0] + ((gesture.to[0] - gesture.from[0]) * step) / gesture.steps,
                        gesture.from[1] + ((gesture.to[1] - gesture.from[1]) * step) / gesture.steps,
                    ], 1);
                    await frame();
                }

                fire('pointerup', gesture.to, 0);
                await frame();

                return true;
            }
            JS);

        return $page;
    }

    /**
     * @param  array{0: int|float, 1: int|float}  $from
     * @param  array{0: int|float, 1: int|float}  $to
     */
    protected function drawOnWhiteboard(mixed $page, string $tool, array $from, array $to): mixed
    {
        $this->selectWhiteboardTool($page, $tool);

        return $this->dragOnWhiteboard($page, $from, $to);
    }

    /**
     * Two live elements with the same index are repaired by the first canvas that sees them, which rewrites one of them.
     */
    protected function nextWhiteboardIndex(Whiteboard $board): string
    {
        $position = WhiteboardElement::query()->where('whiteboard_id', $board->id)->count();

        throw_if($position > 61, InvalidArgumentException::class, 'addWhiteboardElement() can name 62 indexes; pass an "index" in the overrides.');

        return 'a'.'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'[$position];
    }
}
```

- [ ] **Step 2: Use the trait in the browser test case**

In `tests/BrowserTestCase.php`, add the import after the existing `InteractsWithBrowser` import:

```php
use Tests\Browser\Support\InteractsWithBrowser;
use Tests\Browser\Support\InteractsWithWhiteboards;
use Tests\Browser\Support\ReverbServer;
```

and use the trait in the class:

```php
abstract class BrowserTestCase extends TestCase
{
    use InteractsWithBrowser;
    use InteractsWithWhiteboards;
```

- [ ] **Step 3: Write the smoke test**

`php artisan make:test` only writes under `tests/Feature` or `tests/Unit`, so create `tests/Browser/Smoke/WhiteboardHarnessTest.php` directly with this content:

```php
<?php

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;

it('shows a guest an element a member writes to the board, without a reload', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create(['title' => 'Harness board']);
    [$member] = whiteboardFacilitator($board);
    $member->update(['locale' => 'en']);

    $memberPage = $this->awaitRealtime($this->signIn($member, "/whiteboards/{$board->id}"));
    $guestPage = $this->awaitRealtime($this->joinAsGuest("/whiteboards/join/{$board->guest_token}", 'Guest Gia'));

    $this->awaitWhiteboardElements($memberPage, 0);
    $this->awaitWhiteboardElements($guestPage, 0);

    $element = $this->addWhiteboardElement($memberPage, $board);

    $this->awaitWhiteboardElements($guestPage, 1);
    $this->awaitWhiteboardScene($guestPage, $board);
    $this->awaitWhiteboardScene($memberPage, $board);

    $received = $this->whiteboardElements($guestPage, $board);

    expect($received)->toHaveCount(1)
        ->and($received[0]['id'])->toBe($element['id'])
        ->and($this->whiteboardSceneStamp($board))->toBe("1:1:{$element['versionNonce']}")
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->count())->toBe(1);
});

it('stores a rectangle drawn on the canvas with the pointer', function () {
    $board = Whiteboard::factory()->create(['title' => 'Harness board']);
    [$member] = whiteboardFacilitator($board);
    $member->update(['locale' => 'en']);

    $page = $this->awaitRealtime($this->signIn($member, "/whiteboards/{$board->id}"));

    $this->awaitWhiteboardElements($page, 0);

    $this->drawOnWhiteboard($page, 'rectangle', [500, 300], [700, 450]);

    $this->awaitWhiteboardStored($page, $board, 1);
    $this->awaitWhiteboardScene($page, $board);

    $rectangle = WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole();

    expect($rectangle->type)->toBe('rectangle')
        ->and($rectangle->is_deleted)->toBeFalse()
        ->and($rectangle->data['x'])->toEqualWithDelta(500, 2)
        ->and($rectangle->data['y'])->toEqualWithDelta(300, 2)
        ->and($rectangle->data['width'])->toEqualWithDelta(200, 2)
        ->and($rectangle->data['height'])->toEqualWithDelta(150, 2);
});
```

- [ ] **Step 4: Run the first smoke test and see it fail**

Run: `vendor/bin/pest tests/Browser/Smoke/WhiteboardHarnessTest.php --filter='shows a guest an element'`

Expected: FAIL in `awaitRealtime()` after its timeout (the board has no `[data-realtime]` yet). The run takes about 45 seconds.

- [ ] **Step 5: Add the scene stamp**

Create `resources/js/lib/whiteboard/scene-stamp.ts` with this content:

```ts
import type { SceneElement } from './types';

/**
 * What the canvas holds, in a form a browser test can compare with the
 * server: the number of live elements, then the sums of their versions and
 * of their version nonces. Two copies of an element with the same version
 * and nonce are the same copy, so two scenes with the same stamp hold the
 * same elements.
 */
export function sceneStamp(elements: readonly SceneElement[]): string {
    let count = 0;
    let versions = 0;
    let nonces = 0;

    for (const element of elements) {
        if (element.isDeleted) {
            continue;
        }

        count += 1;
        versions += element.version;
        nonces += element.versionNonce;
    }

    return `${count}:${versions}:${nonces}`;
}
```

- [ ] **Step 6: Add `data-realtime` and `data-scene` to the board root**

In `resources/js/components/whiteboard/board.tsx`, make four edits.

Add the import of `realtimeState` before the `appearance` import. Before:

```tsx
import { useWhiteboardToolbarSlot } from '@/hooks/use-whiteboard-toolbar-slot';
import {
    CanvasLocales,
    isDark,
    subscribeToTheme,
} from '@/lib/whiteboard/appearance';
```

After:

```tsx
import { useWhiteboardToolbarSlot } from '@/hooks/use-whiteboard-toolbar-slot';
import { realtimeState } from '@/lib/realtime/realtime-state';
import {
    CanvasLocales,
    isDark,
    subscribeToTheme,
} from '@/lib/whiteboard/appearance';
```

Add the import of `sceneStamp` between the `restore` and `scene-sync` imports. Before:

```tsx
import { restoreScene } from '@/lib/whiteboard/restore';
import { createSceneSync, type SceneSync } from '@/lib/whiteboard/scene-sync';
```

After:

```tsx
import { restoreScene } from '@/lib/whiteboard/restore';
import { sceneStamp } from '@/lib/whiteboard/scene-stamp';
import { createSceneSync, type SceneSync } from '@/lib/whiteboard/scene-sync';
```

Keep the stamp in state, next to the initial elements. Before:

```tsx
    const [initialElements] = useState(() =>
        restoreScene(initial.current.elements),
    );
```

After:

```tsx
    const [initialElements] = useState(() =>
        restoreScene(initial.current.elements),
    );
    const [stamp, setStamp] = useState(() => sceneStamp(initialElements));
```

Put both attributes on the root element. Before:

```tsx
        <div className="flex h-dvh flex-col">
            {state.sessionExpired && <SessionExpiredBanner />}
```

After:

```tsx
        <div
            className="flex h-dvh flex-col"
            data-realtime={realtimeState(
                state.connected && api !== null,
                state.online,
            )}
            data-scene={stamp}
        >
            {state.sessionExpired && <SessionExpiredBanner />}
```

Refresh the stamp whenever the canvas reports its scene. Before:

```tsx
                        onChange={(elements, appState) =>
                            sync.current?.handleChange(
                                elements as unknown as SceneElement[],
                                appState.editingTextElement?.id ?? null,
                            )
                        }
```

After:

```tsx
                        onChange={(elements, appState) => {
                            const reported =
                                elements as unknown as SceneElement[];

                            setStamp(sceneStamp(reported));
                            sync.current?.handleChange(
                                reported,
                                appState.editingTextElement?.id ?? null,
                            );
                        }}
```

React skips the render when the stamp is unchanged, so a pointer move that changes nothing costs one pass over the elements, which `handleChange` already makes.

- [ ] **Step 7: Check and build the frontend**

Run: `npm run types:check`
Expected: no error.

Run: `npm run check`
Expected: no error. If it reports formatting or import order only, run `npm run check:fix` and run `npm run check` again.

Run: `npm run build`
Expected: the build ends without error (the browser suite serves `public/build`).

- [ ] **Step 8: Run the first smoke test and see it pass**

Run: `vendor/bin/pest tests/Browser/Smoke/WhiteboardHarnessTest.php --filter='shows a guest an element'`

Expected: PASS. A failure in `awaitRealtime()` means the hook of Step 6 is not in the build (run `npm run build`). A failure in `awaitWhiteboardElements($guestPage, 1)` with the element present in the database means the canvas does not report a remote change through `onChange`: read the failure screenshot under `tests/Browser/Screenshots`, and see the harness findings.

- [ ] **Step 9: Run the canvas smoke test**

Run: `vendor/bin/pest tests/Browser/Smoke/WhiteboardHarnessTest.php --filter='stores a rectangle drawn'`

Expected: PASS. If it fails, see the harness findings ("Canvas") and try, in this order, each on its own: (1) in `dragOnWhiteboard()`, dispatch `pointermove` and `pointerup` on `window` instead of the canvas; (2) raise `$steps` to 16; (3) in `selectWhiteboardTool()`, replace the click by `keys('.excalidraw', '2')` for the rectangle. If none makes it pass, canvas driving is declared unreliable for this plan: delete this one test and the methods `selectWhiteboardTool()`, `dragOnWhiteboard()` and `drawOnWhiteboard()` from `tests/Browser/Support/InteractsWithWhiteboards.php`, and apply the note "If canvas driving was removed" of Task 2. Nothing else in this task depends on them.

- [ ] **Step 10: Run both smoke tests and the existing smoke tests**

Run: `vendor/bin/pest tests/Browser/Smoke`

Expected: PASS (the existing smoke tests are unchanged; they prove that the new trait breaks nothing).

- [ ] **Step 11: Format and check the PHP**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue.

Run: `composer rector:check`
Expected: no change proposed for the three PHP files of this task. If it proposes one, run `composer rector` and run the smoke tests again.

Run: `vendor/bin/pest tests/Arch`
Expected: PASS (the source scan finds none of its forbidden calls in the new files).

- [ ] **Step 12: Commit**

```bash
git add resources/js/lib/whiteboard/scene-stamp.ts resources/js/components/whiteboard/board.tsx tests/Browser/Support/InteractsWithWhiteboards.php tests/BrowserTestCase.php tests/Browser/Smoke/WhiteboardHarnessTest.php
git commit -m "test(browser): add whiteboard hooks, shared whiteboard helpers and their smoke test"
```

### Task 2: Whiteboard core walkthrough (plan 17a)

This task automates `docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md`: its sections 1 to 9 and the checks of its "Second pass". The two lines that were never replayed by hand (the non-member 403 of section 6 and the action of a guest inside the board in section 7) are automated here.

How each section is proven:

- A change made on one page is proven on the other page in three ways: the other page's canvas (`data-scene`, with `$this->awaitWhiteboardElements()` and `$this->awaitWhiteboardScene()`), the snapshot the server sends to that viewer (`$this->whiteboardElements()`), and the database.
- Section 2 asked for a sticky note, a shape, a connector, a freehand drawing and an image. The sticky note goes through the sticky tool (`[P17a-02a]`). The shape, the connector and the stroke are drawn on the canvas with pointer events (`[P17a-02b]`). The image cannot be uploaded: the plugin's server does not pass uploaded files to the application (harness findings, "Server and requests"). `[P17a-02c]` therefore arranges the stored file with the factory and `Storage::fake()`, writes the image element through the real write endpoint, and proves that the guest's page receives the element and downloads the file. Choosing a file in the picker, pasting an image and the upload itself are residual.
- Section 3 asked both participants to drag the same element. `[P17a-03a]` drags it on each page with pointer events, one after the other as the manual replay did. `[P17a-03b]` proves the convergence rule without the canvas: three writes of the same element at the same version from the two pages, of which the server keeps the lowest nonce and answers the late one "stale" with its own copy.
- Section 4 and the second pass ("reload causes no write"): `[P17a-04]` builds the scene with the sticky tool, reloads both pages, and reads the page's Resource Timing entries: a write is a request whose path ends in `/elements` with no query string (the delta read is `/elements?since=…`). It waits 800 ms after the delta read has ended, because the canvas sends its writes 300 ms after a change (`FlushDelayMs` in `resources/js/lib/whiteboard/scene-sync.ts`). The board's `seq` in the database must be unchanged as well.
- Section 5 (offline): the manual replay blocked the member's requests to the board from the page. `[P17a-05a]` does the same: it replaces `XMLHttpRequest.prototype.send` in the member's page so that every request to `/whiteboards/…` ends with a network error (the board's requests go through Inertia's XHR client; the write helper of the harness uses `fetch()` and is not affected). `[P17a-05b]` covers the other way of being offline, with the Reverb process stopped: both pages show "Reconnecting…" and receive each other's edits through the five-second poll (`PollMs` in `board.tsx`). It is the last test of the file.
- Section 7: the facilitator's "Replace the guest link" is broadcast, so a live guest page shows "Your access to this board has ended." at once, before the guest does anything (`[P17a-07a]`). To prove that an action inside the board also ends the session, `[P17a-07b]` arranges a guest page that has not heard of the replacement: the test body changes the token and clears the guest's secret in the database, without a broadcast, and the guest then adds a sticky note.
- Section 8: the walkthrough itself used `fetch` from the member's console, which is what `$this->writeWhiteboardElements()` does. The SVG upload is residual for the reason given for images; `WhiteboardFilesTest` covers it.
- Section 9 was "not replayed by hand". `[P17a-11]` replays it with the limit lowered to one element through the public property `WriteWhiteboardElements::$maxLiveElements`, as the feature test does (the action is a singleton, so browser requests use the same instance).

Facts about the interface that the selectors rely on (all read from the current code):

- Team page (`resources/js/components/teams/whiteboards-section.tsx`, `new-whiteboard-dialog.tsx`): the button "New whiteboard" opens a dialog with `#whiteboard-title`, a gallery of template tiles (`[role="radio"]`, loaded by a partial reload after the dialog opens; "Blank" is selected by default) and the button "Create". The list shows each board as `a[href="/whiteboards/{id}"]` with its title and "Facilitated by <name>"; an empty list reads "No whiteboards yet.".
- Board (`board.tsx`, `top-bar.tsx`, `board-menu.tsx`): `header > h1` holds the title; members have `a[aria-label="Back to the team"]`; the menu `[aria-label="Board menu"]` has, for the facilitator, the switch "Allow guests to join with a link" and, while it is on, the item "Replace the guest link"; non-guests have "Copy the guest link" while it is on. A facilitator has `[role="toolbar"][aria-label="Facilitation tools"]`.
- A board that is gone for the viewer renders only "Your access to this board has ended." or "This board was deleted." (`board-gone.tsx`). A guest whose cookie no longer opens a guest-enabled board gets the page "Your session has ended." with "Guests: ask the facilitator for the guest link." (`resources/js/pages/retros/session-ended.tsx`). An invalid guest link answers 404 with "This guest link is no longer valid." (`join.tsx`).
- A signed-in user who cannot view the team gets 403 on the board URL and `{"message": "You no longer have access to this board."}` on its JSON endpoints (`app/Http/Middleware/ResolveWhiteboardMember.php`). A workspace member who is not in the team is such a user (`TeamPolicy::view`).
- A failed write shows the banner "Reconnecting…" (`ConnectionBanner`, fed by `onOffline` of `scene-sync`); a write refused as "full" shows the toast "This board is full." and the note disappears from the sender's canvas.
- Reactions (`board-reactions.tsx`, `resources/js/components/realtime/flying-reactions.tsx`): the bar is `.whiteboard-reactions[role="toolbar"][aria-label="Reactions"]`, fixed 16 px above the bottom and centred, with six quick buttons `[aria-label="Send a reaction 👍"]` (👍 ❤️ 👏 🎉 🤔 👎); a flying reaction is drawn in `.lr-overlay` with the sender's name.
- Canvas chrome of Excalidraw 0.18.1: the library button is `.default-sidebar-trigger`, the main menu opens with `[data-testid="main-menu-trigger"]` into `[data-testid="dropdown-menu"]`, whose item `[data-testid="help-menu-item"]` opens `.HelpDialog`; the dialog's four outbound links sit in `.HelpDialog__header`, and its content in `.HelpDialog__islands-container`. `resources/css/app.css` hides the trigger and the header with `display: none !important`.

No product file changes in this task.

If canvas driving was removed (Task 1, Step 9): do not write `[P17a-02b]` and `[P17a-03a]`. In the coverage table their rows become `residual` with `(none)` as test file, and these two entries go to the residual checklist: "**P17a-02b** — "on A add … a shape, a connector, a freehand drawing". Not automated: pointer events dispatched from a script do not drive the Excalidraw canvas reliably (harness findings). Check by hand: with a member and a guest on one board, draw a rectangle, an arrow and a pen stroke on the member's side; each appears on the guest's side without a reload." and "**P17a-03a** — "both drag the same element and release". Not automated: same reason; `[P17a-03b]` proves the convergence rule through the write endpoint. Check by hand: drag one note on both sides one after the other, then reload both: the note is at the same place on both."

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php`
- Test: `tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php`

**Interfaces:**
- Consumes:
  - Task 1: `data-realtime` and `data-scene` on the board root; `$this->whiteboardSnapshot()`, `$this->whiteboardElements()`, `$this->writeWhiteboardElements()`, `$this->addWhiteboardElement()`, `$this->addWhiteboardSticky()`, `$this->awaitWhiteboardElements()`, `$this->awaitWhiteboardStored()`, `$this->awaitWhiteboardScene()`, `$this->whiteboardSceneStamp()`, `$this->dragOnWhiteboard()`, `$this->drawOnWhiteboard()`.
  - `Tests\BrowserTestCase`: `$this->signIn()`, `$this->joinAsGuest()`, `$this->awaitRealtime()`, `$this->awaitResync()`.
  - `Tests\Browser\Support\ReverbServer::stop()` and `::start()`.
  - `tests/Pest.php`: `teamMember(Team $team): User`, `whiteboardMember(Whiteboard $board): array{0: User, 1: WhiteboardMember}`, `whiteboardFacilitator(Whiteboard $board): array{0: User, 1: WhiteboardMember}`, `sceneElement(array $overrides = []): array`.
  - Factories: `WhiteboardFactory::withGuestAccess()`, `WhiteboardFileFactory`, `TeamFactory`, `UserFactory`.
  - `App\Actions\Whiteboards\WriteWhiteboardElements::$maxLiveElements` (public, the action is bound as a singleton in `AppServiceProvider`).
- Produces:
  - File-level helpers in `tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php` (global functions; later files must not redeclare them): `p17aRenamed(User $user, string $name): User`, `p17aBoard(array $attributes = []): array{board: Whiteboard, fran: User, franMember: WhiteboardMember}`, `p17aBoardPath(Whiteboard $board): string`, `p17aJoinPath(Whiteboard $board): string`, `p17aGuestMember(Whiteboard $board): WhiteboardMember`, `p17aElementWrites(): string`, `p17aDeltaFetched(): string`, `p17aBlockBoardRequests(mixed $page): void`, `p17aUnblockBoardRequests(mixed $page): void`, `p17aOpenBoardMenu(mixed $page): mixed`; the constant `P17aPng`.

- [ ] **Step 1: Create the test file with its helpers and the tests of sections 1, 2 (sticky note) and 4**

Create `tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php` directly with this content:

```php
<?php

use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;

function p17aRenamed(User $user, string $name): User
{
    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return $user;
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     board: Whiteboard,
 *     fran: User,
 *     franMember: WhiteboardMember
 * }
 */
function p17aBoard(array $attributes = []): array
{
    $board = Whiteboard::factory()->withGuestAccess()->create(['title' => 'Sprint board', ...$attributes]);
    [$fran, $franMember] = whiteboardFacilitator($board);

    return [
        'board' => $board,
        'fran' => p17aRenamed($fran, 'Fran Facilitator'),
        'franMember' => $franMember,
    ];
}

function p17aBoardPath(Whiteboard $board): string
{
    return "/whiteboards/{$board->id}";
}

function p17aJoinPath(Whiteboard $board): string
{
    return "/whiteboards/join/{$board->fresh()->guest_token}";
}

function p17aGuestMember(Whiteboard $board): WhiteboardMember
{
    return WhiteboardMember::query()->where('whiteboard_id', $board->id)->whereNull('user_id')->sole();
}

function p17aElementWrites(): string
{
    return "performance.getEntriesByType('resource').filter((entry) => new URL(entry.name).pathname.endsWith('/elements') && new URL(entry.name).search === '').length";
}

function p17aDeltaFetched(): string
{
    return "performance.getEntriesByType('resource').some((entry) => entry.name.includes('/elements?since=') && entry.responseEnd > 0)";
}

it('[P17a-01] creates a whiteboard from the team page, lands on it as its facilitator and finds it listed on the team page', function () {
    $team = Team::factory()->create();
    $fran = p17aRenamed(teamMember($team), 'Fran Facilitator');
    $teamPath = route('teams.show', [$team->workspace, $team], false);

    $page = $this->signIn($fran, $teamPath);

    $page->assertSee('No whiteboards yet.')
        ->click('New whiteboard')
        ->assertPresent('[role="dialog"] #whiteboard-title')
        ->assertPresent('[role="dialog"] [role="radio"][aria-checked="true"]')
        ->fill('#whiteboard-title', 'Sprint planning board')
        ->click('[role="dialog"] form button:text-is("Create")')
        ->assertPathBeginsWith('/whiteboards/');

    $board = Whiteboard::query()->where('title', 'Sprint planning board')->sole();

    $this->awaitRealtime($page);
    $this->awaitWhiteboardElements($page, 0);

    $page->assertPathIs(p17aBoardPath($board))
        ->assertSeeIn('header > h1', 'Sprint planning board')
        ->assertPresent('[role="toolbar"][aria-label="Facilitation tools"]')
        ->assertPresent('header img[data-presence-id][alt="Fran Facilitator"]');

    $snapshot = $this->whiteboardSnapshot($page, $board);

    expect($snapshot['me']['isFacilitator'])->toBeTrue()
        ->and($snapshot['me']['name'])->toBe('Fran Facilitator')
        ->and($snapshot['board']['facilitatorMemberId'])->toBe($snapshot['me']['id'])
        ->and($snapshot['elements'])->toBeArray()->toBeEmpty()
        ->and($board->team_id)->toBe($team->id)
        ->and($board->facilitator->user_id)->toBe($fran->id);

    $page->click('a[aria-label="Back to the team"]')
        ->assertPathIs($teamPath)
        ->assertSeeIn("a[href=\"/whiteboards/{$board->id}\"]", 'Sprint planning board')
        ->assertSeeIn("a[href=\"/whiteboards/{$board->id}\"]", 'Facilitated by Fran Facilitator')
        ->assertDontSee('No whiteboards yet.');
});

it('[P17a-02a] shows a guest who joined through the guest link the sticky note a member adds, without a reload', function () {
    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = p17aBoard();

    $franPage = $this->awaitRealtime($this->signIn($fran, p17aBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17aJoinPath($board), 'Guest Gia'));

    foreach ([$franPage, $guestPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('header img[data-presence-id][alt="Fran Facilitator"]')
            ->assertPresent('header img[data-presence-id][alt="Guest Gia"]');

        $this->awaitWhiteboardElements($page, 0);
    }

    $guestPage->assertPathIs(p17aBoardPath($board))
        ->assertNotPresent('a[aria-label="Back to the team"]')
        ->assertNotPresent('[role="toolbar"][aria-label="Facilitation tools"]');

    $this->addWhiteboardSticky($franPage, 'Yellow');

    $this->awaitWhiteboardElements($guestPage, 1);
    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    $sticky = WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole();
    $received = $this->whiteboardElements($guestPage, $board);

    expect($sticky->is_sticky)->toBeTrue()
        ->and($sticky->type)->toBe('rectangle')
        ->and($sticky->author_member_id)->toBe($franMember->id)
        ->and($sticky->data['backgroundColor'])->toBe('#fff3bf')
        ->and($received)->toHaveCount(1)
        ->and($received[0]['id'])->toBe($sticky->element_id)
        ->and($received[0]['customData'])->toBe(['skrum' => ['kind' => 'sticky']])
        ->and(p17aGuestMember($board)->guest_name)->toBe('Guest Gia');
});

it('[P17a-04] keeps the scene over a reload of both pages and writes nothing while loading', function () {
    ['board' => $board, 'fran' => $fran] = p17aBoard();

    $franPage = $this->awaitRealtime($this->signIn($fran, p17aBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17aJoinPath($board), 'Guest Gia'));

    $this->addWhiteboardSticky($franPage, 'Yellow');
    $this->awaitWhiteboardElements($guestPage, 1);
    $this->addWhiteboardSticky($franPage, 'Blue');
    $this->awaitWhiteboardElements($guestPage, 2);
    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    $seq = $board->fresh()->seq;
    $stamp = $this->whiteboardSceneStamp($board);

    foreach ([$franPage, $guestPage] as $page) {
        $page->navigate(p17aBoardPath($board));

        $this->awaitRealtime($page);
        $this->awaitResync($page);

        $page->assertScript(p17aDeltaFetched(), true);
        $page->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 800))');

        $page->assertScript(p17aElementWrites(), 0)
            ->assertAttribute('[data-scene]', 'data-scene', $stamp)
            ->assertDontSee('Reconnecting…');
    }

    expect($board->fresh()->seq)->toBe($seq)
        ->and($this->whiteboardSceneStamp($board))->toBe($stamp)
        ->and(str_starts_with($stamp, '2:'))->toBeTrue();
});
```

- [ ] **Step 2: Run the tests of Step 1**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php --filter='P17a-0(1|2a|4)'`

Expected: PASS; a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. In `[P17a-04]`, a write count above 0 or a changed `seq` is the defect "loading a board writes to it" that the second pass of the walkthrough checked.

- [ ] **Step 3: Add the tests of section 2 (drawn shapes, image) and section 3**

Replace the import block at the top of the file by:

```php
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardMember;
use Illuminate\Support\Facades\Storage;

const P17aPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
```

Append these tests to the file:

```php
it('[P17a-02b] shows the guest a shape, a connector and a freehand stroke the member draws on the canvas', function () {
    ['board' => $board, 'fran' => $fran] = p17aBoard();

    $franPage = $this->awaitRealtime($this->signIn($fran, p17aBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17aJoinPath($board), 'Guest Gia'));

    $this->awaitWhiteboardElements($guestPage, 0);

    $this->drawOnWhiteboard($franPage, 'rectangle', [450, 250], [650, 400]);
    $this->awaitWhiteboardElements($guestPage, 1);

    $this->drawOnWhiteboard($franPage, 'arrow', [720, 300], [920, 420]);
    $this->awaitWhiteboardElements($guestPage, 2);

    $this->drawOnWhiteboard($franPage, 'freedraw', [450, 500], [800, 620]);
    $this->awaitWhiteboardElements($guestPage, 3);

    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    $received = collect($this->whiteboardElements($guestPage, $board))->pluck('type')->sort()->values()->all();
    $stored = WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('is_deleted', false)->pluck('type')->sort()->values()->all();

    expect($received)->toBe(['arrow', 'freedraw', 'rectangle'])
        ->and($stored)->toBe(['arrow', 'freedraw', 'rectangle']);
});

it('[P17a-02c] shows the guest an image element whose file the board holds, and the guest page downloads the file', function () {
    Storage::fake();

    ['board' => $board, 'fran' => $fran] = p17aBoard();
    $fileId = 'p17aImage0001';
    $path = "{$board->storageDirectory()}/{$fileId}";
    $bytes = (string) base64_decode(P17aPng);

    Storage::put($path, $bytes);
    WhiteboardFile::factory()->create([
        'whiteboard_id' => $board->id,
        'file_id' => $fileId,
        'path' => $path,
        'mime_type' => 'image/png',
        'size' => strlen($bytes),
    ]);

    $franPage = $this->awaitRealtime($this->signIn($fran, p17aBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17aJoinPath($board), 'Guest Gia'));

    $this->awaitWhiteboardElements($guestPage, 0);

    $image = $this->addWhiteboardElement($franPage, $board, [
        'type' => 'image',
        'x' => 500,
        'y' => 300,
        'width' => 120,
        'height' => 120,
        'strokeColor' => 'transparent',
        'fileId' => $fileId,
        'status' => 'saved',
        'scale' => [1, 1],
        'crop' => null,
    ]);

    $this->awaitWhiteboardElements($guestPage, 1);
    $this->awaitWhiteboardScene($guestPage, $board);
    $this->awaitWhiteboardScene($franPage, $board);

    $guestPage->assertScript("performance.getEntriesByType('resource').some((entry) => entry.name.endsWith('/files/{$fileId}') && entry.responseEnd > 0)", true);

    $download = $guestPage->script("() => fetch('/whiteboards/{$board->id}/files/{$fileId}').then((response) => response.blob().then((blob) => response.status + ' ' + blob.type + ' ' + blob.size))");
    $received = $this->whiteboardElements($guestPage, $board);

    expect($download)->toBe('200 image/png '.strlen($bytes))
        ->and($received)->toHaveCount(1)
        ->and($received[0]['id'])->toBe($image['id'])
        ->and($received[0]['fileId'])->toBe($fileId);
});

it('[P17a-03a] ends with the same position on both pages after the member and the guest drag the same note', function () {
    ['board' => $board, 'fran' => $fran] = p17aBoard();

    $franPage = $this->awaitRealtime($this->signIn($fran, p17aBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17aJoinPath($board), 'Guest Gia'));

    $note = $this->addWhiteboardElement($franPage, $board, [
        'x' => 600,
        'y' => 300,
        'width' => 200,
        'height' => 200,
        'backgroundColor' => '#a5d8ff',
        'roughness' => 0,
    ]);

    $this->awaitWhiteboardElements($franPage, 1);
    $this->awaitWhiteboardElements($guestPage, 1);

    $this->dragOnWhiteboard($franPage, [700, 400], [860, 400]);
    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    $afterFran = WhiteboardElement::query()->where('element_id', $note['id'])->sole();

    expect($afterFran->data['x'])->toEqualWithDelta(760, 2)
        ->and($afterFran->data['y'])->toEqualWithDelta(300, 2)
        ->and($afterFran->version)->toBeGreaterThan(1);

    $this->dragOnWhiteboard($guestPage, [860, 400], [860, 520]);
    $this->awaitWhiteboardScene($guestPage, $board);
    $this->awaitWhiteboardScene($franPage, $board);

    $afterGuest = WhiteboardElement::query()->where('element_id', $note['id'])->sole();
    $stamp = $this->whiteboardSceneStamp($board);

    expect($afterGuest->data['x'])->toEqualWithDelta(760, 2)
        ->and($afterGuest->data['y'])->toEqualWithDelta(420, 2)
        ->and($afterGuest->version)->toBeGreaterThan($afterFran->version)
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->count())->toBe(1);

    foreach ([$franPage, $guestPage] as $page) {
        $page->navigate(p17aBoardPath($board));

        $this->awaitRealtime($page);

        $page->assertAttribute('[data-scene]', 'data-scene', $stamp);
    }
});

it('[P17a-03b] keeps one copy when both write the same note at the same version, and hands the late writer the copy that won', function () {
    ['board' => $board, 'fran' => $fran] = p17aBoard();

    $franPage = $this->awaitRealtime($this->signIn($fran, p17aBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17aJoinPath($board), 'Guest Gia'));

    $note = $this->addWhiteboardElement($franPage, $board, ['x' => 600, 'y' => 300]);

    $this->awaitWhiteboardElements($franPage, 1);
    $this->awaitWhiteboardElements($guestPage, 1);

    $first = $this->writeWhiteboardElements($franPage, $board, [[...$note, 'version' => 2, 'versionNonce' => 500, 'x' => 100]]);
    $second = $this->writeWhiteboardElements($guestPage, $board, [[...$note, 'version' => 2, 'versionNonce' => 100, 'x' => 900]]);
    $late = $this->writeWhiteboardElements($franPage, $board, [[...$note, 'version' => 2, 'versionNonce' => 700, 'x' => 50]]);

    expect($first['status'])->toBe(200)
        ->and($first['body']['rejected'])->toBeArray()->toBeEmpty()
        ->and($second['body']['rejected'])->toBeArray()->toBeEmpty()
        ->and($late['status'])->toBe(200)
        ->and($late['body']['rejected'])->toHaveCount(1)
        ->and($late['body']['rejected'][0]['reason'])->toBe('stale')
        ->and($late['body']['rejected'][0]['element']['x'])->toBe(900)
        ->and($late['body']['rejected'][0]['element']['versionNonce'])->toBe(100);

    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    $stored = WhiteboardElement::query()->where('element_id', $note['id'])->sole();

    expect($stored->data['x'])->toBe(900)
        ->and($stored->version)->toBe(2)
        ->and($stored->version_nonce)->toBe(100)
        ->and($this->whiteboardSceneStamp($board))->toBe('1:2:100');

    foreach ([$franPage, $guestPage] as $page) {
        $page->assertAttribute('[data-scene]', 'data-scene', '1:2:100');
    }
});
```

- [ ] **Step 4: Run the tests of Step 3**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php --filter='P17a-0(2b|2c|3a|3b)'`

Expected: PASS; a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If `[P17a-02b]` fails on one tool only (the arrow or the pen), keep the tools that work, and move the other to the residual checklist with the wording of the note "If canvas driving was removed". If this fails in the canvas helpers, see the harness findings.

- [ ] **Step 5: Add the tests of sections 5 (blocked requests), 6 and 7**

Replace the import block at the top of the file by:

```php
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardMember;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
```

Add these helpers after `p17aDeltaFetched()`:

```php
function p17aBlockBoardRequests(mixed $page): void
{
    $page->script(<<<'JS'
        () => {
            const open = XMLHttpRequest.prototype.open;
            const send = XMLHttpRequest.prototype.send;

            window.p17aBlocked = { active: true, refused: 0 };

            XMLHttpRequest.prototype.open = function (method, url, ...rest) {
                this.p17aPath = new URL(String(url), window.location.href).pathname;

                return open.call(this, method, url, ...rest);
            };

            XMLHttpRequest.prototype.send = function (body) {
                if (window.p17aBlocked.active && this.p17aPath.startsWith('/whiteboards/')) {
                    window.p17aBlocked.refused += 1;
                    setTimeout(() => this.dispatchEvent(new ProgressEvent('error')), 0);

                    return undefined;
                }

                return send.call(this, body);
            };

            return true;
        }
        JS);
}

function p17aUnblockBoardRequests(mixed $page): void
{
    $page->script('() => { window.p17aBlocked.active = false; return true; }');
}

function p17aOpenBoardMenu(mixed $page): mixed
{
    $page->assertNotPresent('[role="menu"]')
        ->click('[aria-label="Board menu"]')
        ->assertPresent('[role="menu"]');

    return $page;
}
```

Append these tests to the file:

```php
it('[P17a-05a] replays the edit a member made while the board could not be reached, and brings the guest\'s edit to the member meanwhile', function () {
    ['board' => $board, 'fran' => $fran] = p17aBoard();

    $franPage = $this->awaitRealtime($this->signIn($fran, p17aBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17aJoinPath($board), 'Guest Gia'));

    $this->awaitResync($franPage);
    p17aBlockBoardRequests($franPage);

    $this->addWhiteboardSticky($franPage, 'Yellow');

    $franPage->assertSee('Reconnecting…')
        ->assertScript('window.p17aBlocked.refused >= 1', true);

    $this->awaitWhiteboardElements($franPage, 1);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->count())->toBe(0);

    $diamond = $this->addWhiteboardElement($guestPage, $board, ['type' => 'diamond', 'index' => 'a1', 'x' => 900, 'y' => 300]);

    $this->awaitWhiteboardElements($franPage, 2);
    $this->awaitWhiteboardElements($guestPage, 1);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->pluck('element_id')->all())->toBe([$diamond['id']]);

    p17aUnblockBoardRequests($franPage);

    $this->awaitWhiteboardElements($guestPage, 2);

    $franPage->assertDontSee('Reconnecting…');

    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('is_sticky', true)->count())->toBe(1)
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('type', 'diamond')->count())->toBe(1)
        ->and($this->whiteboardElements($guestPage, $board))->toHaveCount(2);
});

it('[P17a-06a] ends the guest\'s access and invalidates the guest link when the facilitator turns guest access off', function () {
    ['board' => $board, 'fran' => $fran] = p17aBoard();
    $joinPath = p17aJoinPath($board);
    $guestSwitch = '[role="menuitemcheckbox"]:has-text("Allow guests to join with a link")';

    $franPage = $this->awaitRealtime($this->signIn($fran, p17aBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($joinPath, 'Guest Gia'));

    p17aOpenBoardMenu($franPage)
        ->assertAriaAttribute($guestSwitch, 'checked', 'true')
        ->assertPresent('[role="menuitem"]:has-text("Replace the guest link")')
        ->assertPresent('[role="menuitem"]:has-text("Copy the guest link")')
        ->click($guestSwitch);

    $guestPage->assertSee('Your access to this board has ended.')
        ->assertNotPresent('[data-realtime]');

    expect($board->fresh()->guest_access_enabled)->toBeFalse()
        ->and(fn () => $this->whiteboardSnapshot($guestPage, $board))->toThrow(RuntimeException::class, 'HTTP 403');

    p17aOpenBoardMenu($franPage)
        ->assertAriaAttribute($guestSwitch, 'checked', 'false')
        ->assertNotPresent('[role="menuitem"]:has-text("Replace the guest link")')
        ->assertNotPresent('[role="menuitem"]:has-text("Copy the guest link")');

    $visitorPage = visit($joinPath);

    $visitorPage->assertSee('This guest link is no longer valid.')
        ->assertNotPresent('#name');

    expect(WhiteboardMember::query()->where('whiteboard_id', $board->id)->whereNull('user_id')->count())->toBe(1);
});

it('[P17a-06b] refuses the board, its snapshot and a write to a signed-in user who is not in the team, with 403', function () {
    ['board' => $board] = p17aBoard(['guest_access_enabled' => false]);
    $oscar = p17aRenamed(User::factory()->create(), 'Oscar Outsider');
    $board->team->workspace->members()->attach($oscar, ['role' => WorkspaceRole::Member->value]);

    $page = $this->signIn($oscar, p17aBoardPath($board));

    $page->assertSee('403')
        ->assertNotPresent('[data-realtime]')
        ->assertDontSee('Sprint board');

    $write = $this->writeWhiteboardElements($page, $board, [sceneElement()]);

    expect(fn () => $this->whiteboardSnapshot($page, $board))->toThrow(RuntimeException::class, 'HTTP 403')
        ->and($write['status'])->toBe(403)
        ->and($write['body']['message'])->toBe('You no longer have access to this board.')
        ->and(WhiteboardMember::query()->where('whiteboard_id', $board->id)->where('user_id', $oscar->id)->count())->toBe(0)
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->count())->toBe(0);
});

it('[P17a-07a] ends the guest\'s session when the facilitator replaces the guest link, kills the old link and lets a guest in with the new one', function () {
    ['board' => $board, 'fran' => $fran] = p17aBoard();
    $oldJoinPath = p17aJoinPath($board);

    $franPage = $this->awaitRealtime($this->signIn($fran, p17aBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($oldJoinPath, 'Guest Gia'));

    p17aOpenBoardMenu($franPage)
        ->click('[role="menuitem"]:has-text("Replace the guest link")');

    $guestPage->assertSee('Your access to this board has ended.')
        ->assertNotPresent('[data-realtime]');

    $newJoinPath = p17aJoinPath($board);

    expect($newJoinPath)->not->toBe($oldJoinPath)
        ->and(p17aGuestMember($board)->guest_secret_hash)->toBeNull()
        ->and(fn () => $this->whiteboardSnapshot($guestPage, $board))->toThrow(RuntimeException::class, 'HTTP 403')
        ->and(str_ends_with((string) $this->whiteboardSnapshot($franPage, $board)['board']['guestUrl'], $newJoinPath))->toBeTrue();

    $guestPage->navigate(p17aBoardPath($board))
        ->assertSee('Your session has ended.')
        ->assertSee('Guests: ask the facilitator for the guest link.');

    $visitorPage = visit($oldJoinPath);

    $visitorPage->assertSee('This guest link is no longer valid.');

    $newGuestPage = $this->awaitRealtime($this->joinAsGuest($newJoinPath, 'Guest Gil'));

    $newGuestPage->assertPathIs(p17aBoardPath($board))
        ->assertPresent('header img[data-presence-id][alt="Guest Gil"]');
});

it('[P17a-07b] shows the session-ended state on the next action of a guest whose link was replaced behind an open page', function () {
    ['board' => $board, 'fran' => $fran] = p17aBoard();

    $franPage = $this->awaitRealtime($this->signIn($fran, p17aBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17aJoinPath($board), 'Guest Gia'));

    $this->awaitResync($guestPage);

    Whiteboard::query()->whereKey($board->id)->update(['guest_token' => Str::random(40)]);
    WhiteboardMember::query()->whereKey(p17aGuestMember($board)->id)->update(['guest_secret_hash' => null]);

    $guestPage->assertPresent('[data-realtime="connected"]');

    $this->addWhiteboardSticky($guestPage, 'Green');

    $guestPage->assertSee('Your access to this board has ended.')
        ->assertNotPresent('[data-realtime]')
        ->assertNotPresent('button[aria-label="Sticky note"]');

    $this->awaitWhiteboardElements($franPage, 0);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->count())->toBe(0);
});
```

- [ ] **Step 6: Run the tests of Step 5**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php --filter='P17a-0(5a|6a|6b|7a|7b)'`

Expected: PASS; a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. In `[P17a-05a]`, if "Reconnecting…" never appears while `window.p17aBlocked.refused` stays 0, the board's requests no longer go through `XMLHttpRequest`; see the harness findings ("Scripts").

- [ ] **Step 7: Add the tests of sections 8 and 9, of the second pass, and the Reverb test**

Replace the import block at the top of the file by:

```php
use App\Actions\Whiteboards\WriteWhiteboardElements;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardMember;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Browser\Support\ReverbServer;
```

Append these tests to the file, in this order (`[P17a-05b]` stops Reverb and must stay last):

```php
it('[P17a-08a] stores nothing forged: the author is the requester, unknown data and unsafe links are dropped, and invalid elements are refused next to a valid one', function () {
    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = p17aBoard();
    [$mia, $miaMember] = whiteboardMember($board);
    p17aRenamed($mia, 'Mia Member');

    $franPage = $this->awaitRealtime($this->signIn($fran, p17aBoardPath($board)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, p17aBoardPath($board)));

    $answer = $this->writeWhiteboardElements($miaPage, $board, [
        sceneElement([
            'id' => 'p17aValid',
            'index' => 'a0',
            'authorMemberId' => $franMember->id,
            'author_member_id' => $franMember->id,
            'link' => 'javascript:alert(1)',
            'customData' => ['skrum' => ['kind' => 'sticky', 'owner' => $franMember->id], 'note' => 'forged'],
        ]),
        sceneElement(['id' => 'p17aFrame', 'index' => 'a1', 'type' => 'iframe', 'link' => 'https://example.com']),
        sceneElement(['id' => 'p17aLine', 'index' => 'a2', 'type' => 'line']),
        sceneElement(['id' => 'p17aHuge', 'index' => 'a3', 'version' => 2147483648]),
        sceneElement(['id' => 'p17aLock', 'index' => 'a4', 'locked' => true]),
    ]);

    $reasons = collect($answer['body']['rejected'])->pluck('reason', 'id')->all();

    expect($answer['status'])->toBe(200)
        ->and($reasons)->toBe(['p17aFrame' => 'invalid', 'p17aLine' => 'invalid', 'p17aHuge' => 'invalid', 'p17aLock' => 'locked']);

    $this->awaitWhiteboardElements($franPage, 1);
    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($miaPage, $board);

    $stored = WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole();
    $received = $this->whiteboardElements($franPage, $board);

    expect($stored->element_id)->toBe('p17aValid')
        ->and($stored->author_member_id)->toBe($miaMember->id)
        ->and($stored->data['link'])->toBeNull()
        ->and($stored->data['customData'])->toBe(['skrum' => ['kind' => 'sticky']])
        ->and($stored->data)->not->toHaveKey('authorMemberId')
        ->and($stored->data)->not->toHaveKey('author_member_id')
        ->and($received)->toHaveCount(1)
        ->and(json_encode($received))->not->toContain('javascript:')
        ->and(json_encode($received))->not->toContain('forged');
});

it('[P17a-09] shows no Library button, no link group in the canvas menu and no outbound link in the help dialog', function () {
    ['board' => $board, 'fran' => $fran] = p17aBoard();

    $page = $this->awaitRealtime($this->signIn($fran, p17aBoardPath($board)));

    $page->assertPresent('.whiteboard-canvas [data-testid="main-menu-trigger"]')
        ->assertScript("Array.from(document.querySelectorAll('.excalidraw .default-sidebar-trigger')).every((trigger) => getComputedStyle(trigger).display == 'none')", true)
        ->assertDontSee('Library')
        ->click('.whiteboard-canvas [data-testid="main-menu-trigger"]')
        ->assertPresent('[data-testid="dropdown-menu"] [data-testid="help-menu-item"]')
        ->assertNotPresent('[data-testid="dropdown-menu"] a[href]')
        ->click('[data-testid="help-menu-item"]')
        ->assertPresent('.HelpDialog .HelpDialog__islands-container')
        ->assertScript("Array.from(document.querySelectorAll('.HelpDialog a[href]')).filter((link) => link.getClientRects().length > 0).length", 0)
        ->assertScript("Array.from(document.querySelectorAll('.HelpDialog__header')).every((header) => getComputedStyle(header).display == 'none')", true)
        ->assertDontSeeIn('.HelpDialog', 'Documentation')
        ->assertDontSeeIn('.HelpDialog', 'Excalidraw');
});

it('[P17a-10] shows the reactions bar at the bottom centre to the member and the guest, and flies the guest\'s reactions on the member\'s page with the guest\'s name', function () {
    ['board' => $board, 'fran' => $fran] = p17aBoard();
    $bar = '.whiteboard-reactions[role="toolbar"][aria-label="Reactions"]';
    $placed = "(() => { const box = document.querySelector('.whiteboard-reactions').getBoundingClientRect(); return Math.abs(box.left + box.width / 2 - window.innerWidth / 2) < 2 && window.innerHeight - box.bottom > 0 && window.innerHeight - box.bottom < 40; })()";

    $franPage = $this->awaitRealtime($this->signIn($fran, p17aBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17aJoinPath($board), 'Guest Gia'));

    foreach ([$franPage, $guestPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent($bar)
            ->assertCount("{$bar} [aria-label^=\"Send a reaction \"]", 6)
            ->assertScript($placed, true);
    }

    $guestPage->click('[aria-label="Send a reaction 👍"]');

    $franPage->assertSeeIn('.lr-overlay', '👍')
        ->assertSeeIn('.lr-overlay', 'Guest Gia');

    $guestPage->click('[aria-label="Send a reaction ❤️"]');

    $franPage->assertSeeIn('.lr-overlay', '❤️');
});

it('[P17a-11] refuses a new note on a full board, says so and takes the note off the canvas', function () {
    ['board' => $board, 'fran' => $fran] = p17aBoard();

    resolve(WriteWhiteboardElements::class)->maxLiveElements = 1;

    $page = $this->awaitRealtime($this->signIn($fran, p17aBoardPath($board)));

    $this->addWhiteboardSticky($page, 'Yellow');
    $this->awaitWhiteboardStored($page, $board, 1);
    $this->awaitWhiteboardScene($page, $board);

    $this->addWhiteboardSticky($page, 'Blue');

    $page->assertSee('This board is full.');

    $this->awaitWhiteboardElements($page, 1);
    $this->awaitWhiteboardScene($page, $board);

    $stored = WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole();

    expect($stored->data['backgroundColor'])->toBe('#fff3bf')
        ->and($this->whiteboardElements($page, $board))->toHaveCount(1);
});

it('[P17a-05b] shows the reconnecting banner while Reverb is down, still exchanges edits by polling, and clears the banner when Reverb is back', function () {
    ['board' => $board, 'fran' => $fran] = p17aBoard();

    $franPage = $this->awaitRealtime($this->signIn($fran, p17aBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17aJoinPath($board), 'Guest Gia'));

    foreach ([$franPage, $guestPage] as $page) {
        $page->assertDontSee('Reconnecting…');
    }

    ReverbServer::stop();

    try {
        $franPage->assertSee('Reconnecting…');
        $guestPage->assertSee('Reconnecting…');

        $this->addWhiteboardSticky($franPage, 'Yellow');
        $this->awaitWhiteboardElements($guestPage, 1);

        $this->addWhiteboardElement($guestPage, $board, ['type' => 'ellipse', 'x' => 900, 'y' => 300]);
        $this->awaitWhiteboardElements($franPage, 2);
        $this->awaitWhiteboardElements($guestPage, 2);

        $franPage->assertSee('Reconnecting…');
        $guestPage->assertSee('Reconnecting…');
    } finally {
        ReverbServer::start();
    }

    foreach ([$franPage, $guestPage] as $page) {
        $page->assertDontSee('Reconnecting…');

        $this->awaitRealtime($page);
        $this->awaitWhiteboardScene($page, $board);
    }

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('is_deleted', false)->count())->toBe(2);
});
```

- [ ] **Step 8: Run the tests of Step 7**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php --filter='P17a-(08a|09|10|11|05b)'`

Expected: PASS; a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. `[P17a-05b]` takes about 30 seconds (the reconnect alone takes 13 to 20 seconds). In `[P17a-09]`, a visible "Library" button or a visible link in the help dialog is the first defect recorded in the walkthrough file: follow the Defect rule.

- [ ] **Step 9: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php`

Expected: PASS, 17 tests (15 if canvas driving was removed).

- [ ] **Step 10: Format and check**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue, and no import removed (every import of Step 7 is used).

Run: `composer rector:check`
Expected: no change proposed for the test file. If it proposes one, run `composer rector` and run the file again.

Run: `vendor/bin/pest tests/Arch`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php
git commit -m "test(browser): automate the whiteboard core walkthrough of plan 17a"
```

### Task 3: Whiteboard templates walkthrough, part 1 (plan 17b, sections 1 and 2)

This task automates sections 1 and 2 of `docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md`: the eight built-in templates, saving a board as a workspace template, creating a board from a workspace template, the independence of the copies, and who may manage a template. The lines that were never replayed by hand because they needed a second account (the second member, the workspace admin) or a deletion are automated here.

How each section is proven:

- The gallery of the "New whiteboard" dialog is read in the page: tile names in order, the selected tile, one thumbnail (`svg`) and one description per tile, and the tiles under "Workspace templates".
- What a template puts on a board is proven by the snapshot the server sends to the creator (`$this->whiteboardSnapshot()`), by the canvas (`data-scene`, with `$this->awaitWhiteboardElements()`) and by the database. The numbers of locked elements per template are those the manual replay recorded (line 51) and those of `resources/whiteboard-templates/*.json`.
- "Frames cannot be moved or deleted, sample notes can" (line 50) is the only step of this task about drawing: `[P17b-03]` drives the canvas with pointer events on one template (SWOT). It depends on the canvas driving of Task 1.
- "Every label sits inside its shape" (line 52) is proven on the geometry of the snapshot, as the manual replay did ("in the snapshot every bound text box lies inside its container"), for the Flowchart and the Impact map in French and in German.
- Scenes are arranged with the factories (the recipe of Task 1's notes: one row per element, each with its own `index`), templates with the real action `SaveWhiteboardTemplate` or with `WhiteboardTemplateFactory`, and boards "created from a template" with the real interface where the step is about creating, otherwise with the real action `CreateWhiteboard`.
- The image of a scene cannot be uploaded in a browser test (harness findings, "Server and requests"). The stored file is arranged with `Storage::fake()` and `WhiteboardFileFactory`, as `[P17a-02c]` does; the copy made by the server and the download from the new board are real.
- "A edits the source, the second member edits the new board" (line 68): the edits are writes through the real endpoint from each page (`$this->writeWhiteboardElements()`), not canvas gestures.

Facts about the interface that the selectors rely on (all read from the current code):

- Team page (`resources/js/components/teams/whiteboards-section.tsx`): the buttons "New whiteboard" and "Whiteboard templates"; each board is `a[href="/whiteboards/{id}"]`; a board the viewer may delete has `button[aria-label="Delete <title>"]`, which opens a dialog "Delete this board?" with the button "Delete this board".
- "New whiteboard" dialog (`new-whiteboard-dialog.tsx`): `#whiteboard-title`; the built-in tiles are `[role="radio"]` inside the first `[role="radiogroup"]`; the workspace templates sit in a second `[role="radiogroup"]` under the text "Workspace templates"; a tile holds a thumbnail (`whiteboard-template-preview.tsx`: a `div` with a white background around an `svg`), its name in `span.font-medium` and its description; the selected tile has `aria-checked="true"`. The gallery is an optional Inertia prop loaded after the dialog opens.
- Templates dialog (`whiteboard-templates-dialog.tsx`): one `li` per template with its name in a `p`; "Edit" and "Delete" only when `canManage`; the edit form has `#whiteboard-template-{id}-name` and `#whiteboard-template-{id}-description` and the buttons "Save" and "Cancel"; "Delete" opens an inline confirmation ("Delete this template?") in a `div.bg-muted` with its own "Delete" and "Cancel".
- Board menu (`board-menu.tsx`): "Save as template" opens `save-template-dialog.tsx`, whose name input has `maxlength="80"` and whose description input has `maxlength="300"` (their ids come from `useId()` and are not stable); success shows the toast "Template saved." and closes the dialog; a refused name shows "A template with this name already exists." under the name field and keeps the dialog open.
- The interface language of a signed-in user is the user's `locale` column (`app/Http/Middleware/SetLocale.php`). In French the button and the submit are "Nouveau tableau blanc" and "Créer"; in German "Neues Whiteboard" and "Erstellen" (`lang/fr.json`, `lang/de.json`). Template names and texts come from `lang/{locale}/whiteboards.php`.
- The dark theme is the class `dark` on `<html>`, set by the server from the cookie `appearance` (not encrypted, `bootstrap/app.php`) and by the client from `localStorage.appearance`.
- A workspace template may be changed by its creator and by a workspace admin (`app/Policies/WhiteboardTemplatePolicy.php`); a workspace admin who is not in the team can open the team page (`TeamPolicy::view`).

No product file changes in this task.

If canvas driving was removed (Task 1, Step 9): do not write `[P17b-03]`. In the coverage table its row becomes `residual` with `(none)` as test file, and this entry goes to the residual checklist: "**P17b-03** — "click-drag a frame, a legend or an axis, then select it and press Delete; then do the same with a sample sticky note". Not automated: pointer events dispatched from a script do not drive the Excalidraw canvas reliably (harness findings); `[P17b-02]` proves that the structure is stored locked and the sample notes unlocked. Check by hand: create a SWOT board, try to drag a quadrant by its border and to delete it (nothing happens), then drag a sample note and delete it (both work)."

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php`
- Test: `tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php`

**Interfaces:**
- Consumes:
  - Task 1: `data-realtime` and `data-scene` on the board root; `$this->whiteboardSnapshot()`, `$this->whiteboardElements()`, `$this->writeWhiteboardElements()`, `$this->awaitWhiteboardElements()`, `$this->awaitWhiteboardScene()`, `$this->dragOnWhiteboard()`.
  - `Tests\BrowserTestCase`: `$this->signIn()`, `$this->awaitRealtime()`.
  - `tests/Pest.php`: `teamMember(Team $team): User`, `workspaceManager(Workspace $workspace): User`, `whiteboardFacilitator(Whiteboard $board): array{0: User, 1: WhiteboardMember}`, `sceneElement(array $overrides = []): array`.
  - Factories: `WhiteboardFactory`, `WhiteboardElementFactory`, `WhiteboardFileFactory`, `WhiteboardTemplateFactory`, `TeamFactory`.
  - Actions: `App\Actions\Whiteboards\SaveWhiteboardTemplate::handle(Whiteboard $board, User $user, string $name, ?string $description): WhiteboardTemplate`, `App\Actions\Whiteboards\CreateWhiteboard::handle(Team $team, User $creator, string $title, array $scene): Whiteboard`, `App\Support\WhiteboardTemplates\BuiltInTemplates::elements(string $key): array`.
- Produces:
  - File-level helpers in `tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php` (global functions; later files must not redeclare them): `p17bRenamed(User $user, string $name, string $locale = 'en'): User`, `p17bTeamPath(Team $team): string`, `p17bBoardPath(Whiteboard $board): string`, `p17bBoard(array $attributes = []): array{board: Whiteboard, team: Team, fran: User, franMember: WhiteboardMember}`, `p17bStored(Whiteboard $board, WhiteboardMember $author, array $overrides, int $seq): array`, `p17bScene(Whiteboard $board, WhiteboardMember $author): void`, `p17bTile(string $name): string`, `p17bCreateBoard(mixed $page, string $tileName, string $title, string $newLabel = 'New whiteboard', string $createLabel = 'Create'): Whiteboard`, `p17bOpenBoardMenu(mixed $page, string $label = 'Board menu'): mixed`, `p17bTemplateRow(string $name): string`, `p17bLabelsOutside(array $elements): array`, `p17bSend(mixed $page, string $method, string $path, array $body = []): array{status: int, body: array}`, `p17bFileDownload(Whiteboard $board): string`; the constants `P17bPng` and `P17bFileId`.

- [ ] **Step 1: Create the test file with its helpers and the tests of section 1**

Create `tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php` directly with this content:

```php
<?php

use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardTemplate;
use App\Support\WhiteboardTemplates\BuiltInTemplates;
use Illuminate\Support\Facades\Storage;

const P17bPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const P17bFileId = 'p17bImage0001';

function p17bRenamed(User $user, string $name, string $locale = 'en'): User
{
    $user->forceFill(['name' => $name, 'locale' => $locale])->save();

    return $user;
}

function p17bTeamPath(Team $team): string
{
    return route('teams.show', [$team->workspace, $team], false);
}

function p17bBoardPath(Whiteboard $board): string
{
    return "/whiteboards/{$board->id}";
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     board: Whiteboard,
 *     team: Team,
 *     fran: User,
 *     franMember: WhiteboardMember
 * }
 */
function p17bBoard(array $attributes = []): array
{
    $board = Whiteboard::factory()->create(['title' => 'Sprint board', ...$attributes]);
    [$fran, $franMember] = whiteboardFacilitator($board);

    return [
        'board' => $board,
        'team' => $board->team,
        'fran' => p17bRenamed($fran, 'Fran Facilitator'),
        'franMember' => $franMember,
    ];
}

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function p17bStored(Whiteboard $board, WhiteboardMember $author, array $overrides, int $seq): array
{
    $data = sceneElement($overrides);

    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id,
        'element_id' => $data['id'],
        'type' => $data['type'],
        'data' => $data,
        'version' => $data['version'],
        'version_nonce' => $data['versionNonce'],
        'author_member_id' => $author->id,
        'is_sticky' => isset($data['customData']),
        'seq' => $seq,
    ]);

    Whiteboard::query()->whereKey($board->id)->update(['seq' => $seq]);

    return $data;
}

function p17bScene(Whiteboard $board, WhiteboardMember $author): void
{
    $path = "{$board->storageDirectory()}/".P17bFileId;
    $bytes = (string) base64_decode(P17bPng);

    Storage::put($path, $bytes);
    WhiteboardFile::factory()->create([
        'whiteboard_id' => $board->id,
        'file_id' => P17bFileId,
        'path' => $path,
        'mime_type' => 'image/png',
        'size' => strlen($bytes),
    ]);

    p17bStored($board, $author, [
        'id' => 'p17bSticky',
        'index' => 'a0',
        'x' => 100,
        'y' => 100,
        'width' => 200,
        'height' => 200,
        'backgroundColor' => '#fff3bf',
        'roughness' => 0,
        'versionNonce' => 101,
        'customData' => ['skrum' => ['kind' => 'sticky']],
    ], 1);
    p17bStored($board, $author, [
        'id' => 'p17bShape',
        'index' => 'a1',
        'x' => 400,
        'y' => 120,
        'width' => 160,
        'height' => 100,
        'versionNonce' => 102,
        'boundElements' => [['id' => 'p17bArrow', 'type' => 'arrow']],
    ], 2);
    p17bStored($board, $author, [
        'id' => 'p17bArrow',
        'type' => 'arrow',
        'index' => 'a2',
        'x' => 564,
        'y' => 170,
        'width' => 150,
        'height' => 0,
        'versionNonce' => 103,
        'points' => [[0, 0], [150, 0]],
        'lastCommittedPoint' => null,
        'startBinding' => ['elementId' => 'p17bShape', 'focus' => 0, 'gap' => 4],
        'endBinding' => null,
        'startArrowhead' => null,
        'endArrowhead' => 'arrow',
        'elbowed' => false,
    ], 3);
    p17bStored($board, $author, [
        'id' => 'p17bImage',
        'type' => 'image',
        'index' => 'a3',
        'x' => 100,
        'y' => 400,
        'width' => 120,
        'height' => 120,
        'strokeColor' => 'transparent',
        'versionNonce' => 104,
        'fileId' => P17bFileId,
        'status' => 'saved',
        'scale' => [1, 1],
        'crop' => null,
    ], 4);
}

function p17bTile(string $name): string
{
    return "[role=\"dialog\"] [role=\"radio\"]:has(span:text-is(\"{$name}\"))";
}

function p17bCreateBoard(mixed $page, string $tileName, string $title, string $newLabel = 'New whiteboard', string $createLabel = 'Create'): Whiteboard
{
    $page->click("button:text-is(\"{$newLabel}\")")
        ->assertPresent('[role="dialog"] [role="radiogroup"]')
        ->click(p17bTile($tileName))
        ->assertAriaAttribute(p17bTile($tileName), 'checked', 'true')
        ->fill('#whiteboard-title', $title)
        ->click("[role=\"dialog\"] form button:text-is(\"{$createLabel}\")")
        ->assertPathBeginsWith('/whiteboards/');

    return Whiteboard::query()->where('title', $title)->sole();
}

/**
 * @param  array<int, array<string, mixed>>  $elements
 * @return array<int, string>
 */
function p17bLabelsOutside(array $elements): array
{
    $byId = collect($elements)->keyBy('id');

    return collect($elements)
        ->filter(fn (array $element): bool => $element['type'] === 'text' && ($element['containerId'] ?? null) !== null)
        ->filter(fn (array $text): bool => $byId[$text['containerId']]['type'] !== 'arrow')
        ->reject(function (array $text) use ($byId): bool {
            $shape = $byId[$text['containerId']];

            return $text['x'] >= $shape['x']
                && $text['y'] >= $shape['y']
                && $text['x'] + $text['width'] <= $shape['x'] + $shape['width']
                && $text['y'] + $text['height'] <= $shape['y'] + $shape['height'];
        })
        ->pluck('text')
        ->values()
        ->all();
}

it('[P17b-01a] offers eight built-in templates with Blank first and selected, each with a thumbnail, a name and a description, and lists a workspace template apart', function () {
    $team = Team::factory()->create();
    $fran = p17bRenamed(teamMember($team), 'Fran Facilitator');
    WhiteboardTemplate::factory()->create([
        'workspace_id' => $team->workspace_id,
        'name' => 'Kick-off map',
        'description' => 'How we start a project',
        'preview' => ['width' => 200, 'height' => 100, 'shapes' => [
            ['kind' => 'rect', 'x' => 0, 'y' => 0, 'width' => 200, 'height' => 100, 'fill' => null, 'stroke' => '#1e1e1e', 'points' => []],
        ]],
        'created_by_user_id' => $fran->id,
    ]);
    $builtIns = "document.querySelectorAll('[role=\"dialog\"] [role=\"radiogroup\"]')[0]";

    $page = $this->signIn($fran, p17bTeamPath($team));

    $page->click('button:text-is("New whiteboard")')
        ->assertPresent('[role="dialog"] #whiteboard-title')
        ->assertPresent('[role="dialog"] [role="radiogroup"]')
        ->assertScript("Array.from({$builtIns}.querySelectorAll('[role=\"radio\"] span.font-medium')).map((name) => name.textContent).join('|')", 'Blank|Brainstorm|Flowchart|User story map|Impact map|SWOT|Lean canvas|2×2 matrix')
        ->assertScript("{$builtIns}.querySelectorAll('[role=\"radio\"] svg').length", 8)
        ->assertScript("Array.from({$builtIns}.querySelectorAll('[role=\"radio\"]')).filter((tile) => tile.querySelector('span.text-muted-foreground')?.textContent.trim().length > 0).length", 8)
        ->assertAriaAttribute(p17bTile('Blank'), 'checked', 'true')
        ->assertCount('[role="dialog"] [role="radio"][aria-checked="true"]', 1)
        ->assertSeeIn('[role="dialog"]', 'Workspace templates')
        ->assertCount('[role="dialog"] [role="radiogroup"]', 2)
        ->assertPresent('[role="dialog"] [role="radiogroup"] >> nth=1 >> [role="radio"]:has(span:text-is("Kick-off map"))')
        ->assertSeeIn(p17bTile('Kick-off map'), 'How we start a project')
        ->assertCount(p17bTile('Kick-off map').' svg rect[stroke="#1e1e1e"]', 1);
});

it('[P17b-02] creates a board from each of the eight built-in templates, with its creator as facilitator, its structure locked and its sample notes free', function () {
    $team = Team::factory()->create();
    $fran = p17bRenamed(teamMember($team), 'Fran Facilitator');
    $templates = [
        'Blank' => ['key' => 'blank', 'frames' => 0, 'locked' => 0, 'stickies' => 0],
        'Brainstorm' => ['key' => 'brainstorm', 'frames' => 3, 'locked' => 3, 'stickies' => 3],
        'Flowchart' => ['key' => 'flowchart', 'frames' => 1, 'locked' => 7, 'stickies' => 0],
        'User story map' => ['key' => 'user_story_map', 'frames' => 3, 'locked' => 3, 'stickies' => 3],
        'Impact map' => ['key' => 'impact_map', 'frames' => 4, 'locked' => 4, 'stickies' => 4],
        'SWOT' => ['key' => 'swot', 'frames' => 4, 'locked' => 4, 'stickies' => 4],
        'Lean canvas' => ['key' => 'lean_canvas', 'frames' => 9, 'locked' => 9, 'stickies' => 1],
        '2×2 matrix' => ['key' => 'matrix', 'frames' => 4, 'locked' => 8, 'stickies' => 1],
    ];

    $page = $this->signIn($fran, p17bTeamPath($team));

    foreach ($templates as $tile => $expected) {
        $board = p17bCreateBoard($page, $tile, "Board from {$expected['key']}");

        $this->awaitRealtime($page);

        $snapshot = $this->whiteboardSnapshot($page, $board);
        $elements = collect($snapshot['elements']);
        $stickies = $elements->filter(fn (array $element): bool => isset($element['customData']));

        expect($snapshot['me']['isFacilitator'])->toBeTrue()
            ->and($snapshot['me']['name'])->toBe('Fran Facilitator')
            ->and($elements)->toHaveCount(count(resolve(BuiltInTemplates::class)->elements($expected['key'])))
            ->and($elements->where('type', 'frame'))->toHaveCount($expected['frames'])
            ->and($elements->where('type', 'frame')->where('locked', false))->toHaveCount(0)
            ->and($elements->where('locked', true))->toHaveCount($expected['locked'])
            ->and($stickies)->toHaveCount($expected['stickies'])
            ->and($stickies->where('locked', true))->toHaveCount(0)
            ->and($board->facilitator->user_id)->toBe($fran->id);

        $this->awaitWhiteboardElements($page, $elements->count());

        $page->assertSeeIn('header > h1', "Board from {$expected['key']}")
            ->navigate(p17bTeamPath($team))
            ->assertPresent("a[href=\"/whiteboards/{$board->id}\"]");
    }

    expect(Whiteboard::query()->where('team_id', $team->id)->count())->toBe(8);
});

it('[P17b-03] leaves a locked frame where it is when it is dragged and deleted on the canvas, and moves and deletes a sample note', function () {
    $team = Team::factory()->create();
    $fran = p17bRenamed(teamMember($team), 'Fran Facilitator');

    $page = $this->signIn($fran, p17bTeamPath($team));
    $board = p17bCreateBoard($page, 'SWOT', 'Locked structure');

    $this->awaitRealtime($page);
    $this->awaitWhiteboardElements($page, 12);
    $this->awaitWhiteboardScene($page, $board);

    $elements = collect($this->whiteboardElements($page, $board));
    $note = $elements->first(fn (array $element): bool => isset($element['customData']));
    $frame = $elements->first(fn (array $element): bool => $element['type'] === 'frame' && $element['id'] !== ($note['frameId'] ?? null));
    $border = [$frame['x'], $frame['y'] + $frame['height'] / 2];
    $centre = [$note['x'] + $note['width'] / 2, $note['y'] + $note['height'] / 2];
    $seq = $board->fresh()->seq;
    $stamp = $this->whiteboardSceneStamp($board);

    $this->dragOnWhiteboard($page, $border, [$border[0] + 60, $border[1]]);

    $page->keys('.whiteboard-canvas .excalidraw-container', 'Delete');
    $page->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 800))');
    $page->assertAttribute('[data-scene]', 'data-scene', $stamp);

    expect($board->fresh()->seq)->toBe($seq);

    $this->dragOnWhiteboard($page, $centre, [$centre[0] + 40, $centre[1] + 30]);
    $this->awaitWhiteboardScene($page, $board);

    $movedNote = WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('element_id', $note['id'])->sole();
    $sameFrame = WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('element_id', $frame['id'])->sole();

    expect($movedNote->data['x'])->toEqualWithDelta($note['x'] + 40, 2)
        ->and($movedNote->data['y'])->toEqualWithDelta($note['y'] + 30, 2)
        ->and($movedNote->is_deleted)->toBeFalse()
        ->and($sameFrame->version)->toBe(1)
        ->and($sameFrame->data['x'])->toBe($frame['x'])
        ->and($sameFrame->data['y'])->toBe($frame['y']);

    $page->keys('.whiteboard-canvas .excalidraw-container', 'Delete');

    $this->awaitWhiteboardElements($page, 10);
    $this->awaitWhiteboardScene($page, $board);

    expect($movedNote->fresh()->is_deleted)->toBeTrue()
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('type', 'frame')->where('is_deleted', false)->where('version', 1)->count())->toBe(4);
});

it('[P17b-04] keeps every label inside its shape on a Flowchart and an Impact map created in French and in German', function () {
    $team = Team::factory()->create();
    $fran = p17bRenamed(teamMember($team), 'Fran Facilitator');
    $locales = [
        'fr' => ['new' => 'Nouveau tableau blanc', 'create' => 'Créer', 'tiles' => ['Logigramme', "Carte d'impact"], 'word' => 'Légende'],
        'de' => ['new' => 'Neues Whiteboard', 'create' => 'Erstellen', 'tiles' => ['Flussdiagramm', 'Impact-Map'], 'word' => 'Legende'],
    ];

    $page = $this->signIn($fran, p17bTeamPath($team));

    foreach ($locales as $locale => $labels) {
        User::query()->whereKey($fran->id)->update(['locale' => $locale]);

        $words = '';

        foreach ($labels['tiles'] as $tile) {
            $page->navigate(p17bTeamPath($team));

            $board = p17bCreateBoard($page, $tile, "{$tile} {$locale}", $labels['new'], $labels['create']);

            $this->awaitRealtime($page);

            $elements = $this->whiteboardElements($page, $board);
            $labelCount = collect($elements)->where('type', 'text')->whereNotNull('containerId')->count();
            $words .= json_encode($elements, JSON_UNESCAPED_UNICODE);

            expect($labelCount)->toBeGreaterThan(3)
                ->and(p17bLabelsOutside($elements))->toBeArray()->toBeEmpty();
        }

        expect($words)->toContain($labels['word']);
    }
});

it('[P17b-05] shows the gallery in French to a French-speaking member and creates a SWOT board whose quadrants and notes are in French', function () {
    $team = Team::factory()->create();
    $fran = p17bRenamed(teamMember($team), 'Fran Facilitator', 'fr');
    $builtIns = "document.querySelectorAll('[role=\"dialog\"] [role=\"radiogroup\"]')[0]";

    $page = $this->signIn($fran, p17bTeamPath($team));

    $page->click('button:text-is("Nouveau tableau blanc")')
        ->assertPresent('[role="dialog"] [role="radiogroup"]')
        ->assertScript("Array.from({$builtIns}.querySelectorAll('[role=\"radio\"] span.font-medium')).map((name) => name.textContent).join('|')", "Vierge|Brainstorming|Logigramme|Carte des récits utilisateur|Carte d'impact|SWOT|Lean canvas|Matrice 2×2")
        ->assertSeeIn(p17bTile('Vierge'), 'Un canevas vide.')
        ->assertSeeIn(p17bTile('SWOT'), 'Forces, faiblesses, opportunités et menaces.')
        ->click(p17bTile('SWOT'))
        ->assertAriaAttribute(p17bTile('SWOT'), 'checked', 'true')
        ->fill('#whiteboard-title', 'SWOT FR')
        ->click('[role="dialog"] form button:text-is("Créer")')
        ->assertPathBeginsWith('/whiteboards/');

    $board = Whiteboard::query()->where('title', 'SWOT FR')->sole();

    $this->awaitRealtime($page);

    $elements = collect($this->whiteboardElements($page, $board));
    $everything = json_encode($elements->all(), JSON_UNESCAPED_UNICODE);

    expect($elements->where('type', 'frame')->pluck('name')->sort()->values()->all())->toBe(['Faiblesses', 'Forces', 'Menaces', 'Opportunités'])
        ->and($elements->where('type', 'text')->pluck('text')->all())->toContain("Que faisons-nous\nbien ?")
        ->and($everything)->not->toContain('Strengths')
        ->and($everything)->not->toContain('Weaknesses')
        ->and($everything)->not->toContain('Opportunities')
        ->and($everything)->not->toContain('Threats')
        ->and($everything)->not->toContain('What ');
});

it('[P17b-06] keeps the new-whiteboard dialog usable at 375 pixels of width, without a horizontal scroll of the page and with a Create button that works', function () {
    $team = Team::factory()->create();
    $fran = p17bRenamed(teamMember($team), 'Fran Facilitator');

    $page = $this->signIn($fran, p17bTeamPath($team));

    $page->resize(375, 812)
        ->click('button:text-is("New whiteboard")')
        ->assertPresent('[role="dialog"] [role="radiogroup"]')
        ->assertCount('[role="dialog"] [role="radio"]', 8)
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true)
        ->assertScript("document.querySelector('[role=\"dialog\"]').getBoundingClientRect().right <= window.innerWidth", true)
        ->click(p17bTile('Brainstorm'))
        ->assertAriaAttribute(p17bTile('Brainstorm'), 'checked', 'true')
        ->fill('#whiteboard-title', 'Narrow board')
        ->click('[role="dialog"] form button:text-is("Create")')
        ->assertPathBeginsWith('/whiteboards/');

    $board = Whiteboard::query()->where('title', 'Narrow board')->sole();

    expect($board->elements()->count())->toBe(9);
});

it('[P17b-07] draws every thumbnail on a white surface in the dark theme, with the frames of the Lean canvas, the shapes of the Flowchart and the outline of a workspace template', function () {
    $team = Team::factory()->create();
    $fran = p17bRenamed(teamMember($team), 'Fran Facilitator');
    WhiteboardTemplate::factory()->create([
        'workspace_id' => $team->workspace_id,
        'name' => 'Plain shapes',
        'preview' => ['width' => 300, 'height' => 100, 'shapes' => [
            ['kind' => 'rect', 'x' => 0, 'y' => 0, 'width' => 100, 'height' => 100, 'fill' => null, 'stroke' => '#1e1e1e', 'points' => []],
            ['kind' => 'ellipse', 'x' => 200, 'y' => 0, 'width' => 100, 'height' => 100, 'fill' => null, 'stroke' => '#1e1e1e', 'points' => []],
        ]],
        'created_by_user_id' => $fran->id,
    ]);

    $page = $this->signIn($fran, p17bTeamPath($team));

    $page->script("() => { localStorage.setItem('appearance', 'dark'); document.cookie = 'appearance=dark;path=/;max-age=31536000;SameSite=Lax'; return true; }");

    $page->navigate(p17bTeamPath($team))
        ->assertScript("document.documentElement.classList.contains('dark')", true)
        ->click('button:text-is("New whiteboard")')
        ->assertPresent('[role="dialog"] [role="radiogroup"]')
        ->assertCount('[role="dialog"] [role="radio"]', 9)
        ->assertScript("Array.from(document.querySelectorAll('[role=\"dialog\"] [role=\"radio\"] > div')).filter((surface) => getComputedStyle(surface).backgroundColor == 'rgb(255, 255, 255)').length", 9)
        ->assertCount(p17bTile('Lean canvas').' svg rect[fill="none"][stroke="#1e1e1e"]', 9)
        ->assertCount(p17bTile('Flowchart').' svg ellipse', 3)
        ->assertCount(p17bTile('Flowchart').' svg polygon', 2)
        ->assertCount(p17bTile('Flowchart').' svg polyline', 5)
        ->assertCount(p17bTile('Plain shapes').' svg rect[stroke="#1e1e1e"]', 1)
        ->assertCount(p17bTile('Plain shapes').' svg ellipse[stroke="#1e1e1e"]', 1);
});
```

- [ ] **Step 2: Run the tests of Step 1**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php --filter='P17b-0[1-7]'`

Expected: PASS; a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. `[P17b-02]` opens eight boards and takes about 15 seconds. If `[P17b-03]` fails in the canvas helpers, see the harness findings; if only its `Delete` key does nothing (the note is moved but never deleted), replace both `keys()` calls by `$page->script("() => { document.querySelector('.whiteboard-canvas .excalidraw-container').dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true })); return true; }")`. Pint may remove the imports `WhiteboardFile`, `WhiteboardMember` and `Storage` only if the helpers `p17bBoard()`, `p17bStored()` and `p17bScene()` were left out: they are part of this step and use them.

- [ ] **Step 3: Add the helpers and the tests of section 2**

Replace the import block at the top of the file by:

```php
use App\Actions\Whiteboards\CreateWhiteboard;
use App\Actions\Whiteboards\SaveWhiteboardTemplate;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardTemplate;
use App\Support\WhiteboardTemplates\BuiltInTemplates;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
```

Add these helpers after `p17bLabelsOutside()`:

```php
function p17bOpenBoardMenu(mixed $page, string $label = 'Board menu'): mixed
{
    $page->assertNotPresent('[role="menu"]')
        ->click("[aria-label=\"{$label}\"]")
        ->assertPresent('[role="menu"]');

    return $page;
}

function p17bTemplateRow(string $name): string
{
    return "[role=\"dialog\"] li:has(p:text-is(\"{$name}\"))";
}

/**
 * @param  array<string, mixed>  $body
 * @return array{
 *     status: int,
 *     body: array<string, mixed>
 * }
 */
function p17bSend(mixed $page, string $method, string $path, array $body = []): array
{
    $request = json_encode([
        'method' => $method,
        'path' => $path,
        'body' => json_encode($body, JSON_THROW_ON_ERROR | JSON_FORCE_OBJECT),
    ], JSON_THROW_ON_ERROR);

    $answer = json_decode((string) $page->script(<<<JS
        async () => {
            const request = {$request};
            const cookie = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='));
            const response = await fetch(request.path, {
                method: request.method,
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)),
                },
                body: request.body,
            });

            return JSON.stringify({ status: response.status, body: await response.text() });
        }
        JS), true, flags: JSON_THROW_ON_ERROR);

    return ['status' => $answer['status'], 'body' => json_decode((string) $answer['body'], true) ?? []];
}

function p17bFileDownload(Whiteboard $board): string
{
    $path = "/whiteboards/{$board->id}/files/".P17bFileId;

    return "() => fetch('{$path}').then((response) => response.blob().then((blob) => response.status + ' ' + blob.type + ' ' + blob.size))";
}
```

Append these tests to the file:

```php
it('[P17b-08] saves a board as a workspace template from the board menu, says so, and lists the template with a thumbnail in the gallery of the team page', function () {
    Storage::fake();

    ['board' => $board, 'team' => $team, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard();
    p17bScene($board, $franMember);

    $page = $this->awaitRealtime($this->signIn($fran, p17bBoardPath($board)));

    $this->awaitWhiteboardElements($page, 4);

    p17bOpenBoardMenu($page)
        ->click('[role="menuitem"]:has-text("Save as template")')
        ->assertSeeIn('[role="dialog"]', 'Everyone in the workspace can start a board from it.')
        ->fill('[role="dialog"] input[maxlength="80"]', 'Kick-off')
        ->fill('[role="dialog"] input[maxlength="300"]', 'How we start a project')
        ->click('[role="dialog"] form button:text-is("Save")')
        ->assertSee('Template saved.')
        ->assertNotPresent('[role="dialog"]');

    $template = WhiteboardTemplate::query()->sole();
    $copy = "whiteboard-templates/{$template->id}/".P17bFileId;

    expect($template->workspace_id)->toBe($team->workspace_id)
        ->and($template->name)->toBe('Kick-off')
        ->and($template->description)->toBe('How we start a project')
        ->and($template->created_by_user_id)->toBe($fran->id)
        ->and($template->scene['elements'])->toHaveCount(4)
        ->and(array_column($template->scene['files'], 'path'))->toBe([$copy])
        ->and(Storage::exists($copy))->toBeTrue()
        ->and(json_encode($template->scene))->not->toContain($franMember->id)
        ->and(json_encode($template->scene))->not->toContain($fran->id);

    $page->click('a[aria-label="Back to the team"]')
        ->assertPathIs(p17bTeamPath($team))
        ->click('button:text-is("New whiteboard")')
        ->assertPresent('[role="dialog"] [role="radiogroup"]')
        ->assertSeeIn('[role="dialog"]', 'Workspace templates')
        ->assertSeeIn(p17bTile('Kick-off'), 'How we start a project')
        ->assertCount(p17bTile('Kick-off').' svg > *', 4)
        ->assertCount(p17bTile('Kick-off').' svg polyline', 1);
});

it('[P17b-09] keeps the save dialog open with the error under the name when the name is taken, whatever its case and the spaces around it', function () {
    Storage::fake();

    ['board' => $board, 'team' => $team, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard();
    p17bScene($board, $franMember);
    WhiteboardTemplate::factory()->create(['workspace_id' => $team->workspace_id, 'name' => 'Kick-off', 'created_by_user_id' => $fran->id]);
    $answered = "performance.getEntriesByType('resource').filter((entry) => entry.name.endsWith('/template') && entry.responseEnd > 0).length";

    $page = $this->awaitRealtime($this->signIn($fran, p17bBoardPath($board)));

    p17bOpenBoardMenu($page)
        ->click('[role="menuitem"]:has-text("Save as template")')
        ->fill('[role="dialog"] input[maxlength="80"]', 'Kick-off')
        ->click('[role="dialog"] form button:text-is("Save")')
        ->assertScript($answered, 1)
        ->assertSeeIn('[role="dialog"]', 'A template with this name already exists.')
        ->assertDontSee('Template saved.')
        ->fill('[role="dialog"] input[maxlength="80"]', '  kick-OFF  ')
        ->click('[role="dialog"] form button:text-is("Save")')
        ->assertScript($answered, 2)
        ->assertSeeIn('[role="dialog"]', 'A template with this name already exists.')
        ->assertPresent('[role="dialog"] input[maxlength="80"]')
        ->assertDontSee('Template saved.');

    expect(WhiteboardTemplate::query()->where('workspace_id', $team->workspace_id)->pluck('name')->all())->toBe(['Kick-off']);
});

it('[P17b-10] gives another member who picks the workspace template a board with the same elements and image, the arrow still bound, fresh ids and no trace of the source author', function () {
    Storage::fake();

    ['board' => $source, 'team' => $team, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard(['title' => 'Source board']);
    p17bScene($source, $franMember);
    resolve(SaveWhiteboardTemplate::class)->handle($source, $fran, 'Kick-off', 'How we start a project');
    $mia = p17bRenamed(teamMember($team), 'Mia Member');

    $page = $this->signIn($mia, p17bTeamPath($team));
    $board = p17bCreateBoard($page, 'Kick-off', 'From template');

    $this->awaitRealtime($page);
    $this->awaitWhiteboardElements($page, 4);

    $snapshot = $this->whiteboardSnapshot($page, $board);
    $elements = collect($snapshot['elements']);
    $shape = $elements->first(fn (array $element): bool => $element['type'] === 'rectangle' && ! isset($element['customData']));
    $arrow = $elements->firstWhere('type', 'arrow');
    $image = $elements->firstWhere('type', 'image');
    $rows = WhiteboardElement::query()->where('whiteboard_id', $board->id)->get();
    $file = WhiteboardFile::query()->where('whiteboard_id', $board->id)->sole();

    $page->assertScript("performance.getEntriesByType('resource').some((entry) => entry.name.endsWith('/files/".P17bFileId."') && entry.responseEnd > 0)", true);

    expect($snapshot['me']['isFacilitator'])->toBeTrue()
        ->and($snapshot['me']['name'])->toBe('Mia Member')
        ->and($elements->pluck('type')->sort()->values()->all())->toBe(['arrow', 'image', 'rectangle', 'rectangle'])
        ->and($elements->filter(fn (array $element): bool => isset($element['customData'])))->toHaveCount(1)
        ->and($arrow['startBinding']['elementId'])->toBe($shape['id'])
        ->and($shape['boundElements'])->toBe([['id' => $arrow['id'], 'type' => 'arrow']])
        ->and($image['fileId'])->toBe(P17bFileId)
        ->and($elements->pluck('id')->intersect(['p17bSticky', 'p17bShape', 'p17bArrow', 'p17bImage'])->all())->toBeEmpty()
        ->and($rows->pluck('version')->unique()->all())->toBe([1])
        ->and($rows->pluck('author_member_id')->unique()->all())->toBe([$board->facilitator_member_id])
        ->and($board->facilitator->user_id)->toBe($mia->id)
        ->and($board->facilitator_member_id)->not->toBe($franMember->id)
        ->and($file->file_id)->toBe(P17bFileId)
        ->and($file->path)->toBe("whiteboards/{$board->id}/".P17bFileId)
        ->and($page->script(p17bFileDownload($board)))->toBe('200 image/png '.strlen((string) base64_decode(P17bPng)))
        ->and(WhiteboardFile::query()->where('whiteboard_id', $source->id)->count())->toBe(1);
});

it('[P17b-11] keeps the source board and the board created from its template apart when each is edited, after a reload too', function () {
    Storage::fake();

    ['board' => $source, 'team' => $team, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard(['title' => 'Source board']);
    p17bScene($source, $franMember);
    $template = resolve(SaveWhiteboardTemplate::class)->handle($source, $fran, 'Kick-off', null);
    $mia = p17bRenamed(teamMember($team), 'Mia Member');
    $copy = resolve(CreateWhiteboard::class)->handle($team, $mia, 'From template', $template->scene);

    $franPage = $this->awaitRealtime($this->signIn($fran, p17bBoardPath($source)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, p17bBoardPath($copy)));

    $this->awaitWhiteboardElements($franPage, 4);
    $this->awaitWhiteboardElements($miaPage, 4);

    $sourceSticky = WhiteboardElement::query()->where('whiteboard_id', $source->id)->where('element_id', 'p17bSticky')->sole();
    $sourceShape = WhiteboardElement::query()->where('whiteboard_id', $source->id)->where('element_id', 'p17bShape')->sole();
    $copySticky = WhiteboardElement::query()->where('whiteboard_id', $copy->id)->where('is_sticky', true)->sole();

    $onSource = $this->writeWhiteboardElements($franPage, $source, [
        [...$sourceSticky->data, 'version' => $sourceSticky->version + 1, 'versionNonce' => 9001, 'x' => 900],
        [...$sourceShape->data, 'version' => $sourceShape->version + 1, 'versionNonce' => 9002, 'isDeleted' => true],
    ]);
    $onCopy = $this->writeWhiteboardElements($miaPage, $copy, [
        [...$copySticky->data, 'version' => $copySticky->version + 1, 'versionNonce' => 9003, 'y' => 700],
    ]);

    expect($onSource['status'])->toBe(200)
        ->and($onSource['body']['rejected'])->toBeArray()->toBeEmpty()
        ->and($onCopy['status'])->toBe(200)
        ->and($onCopy['body']['rejected'])->toBeArray()->toBeEmpty();

    $this->awaitWhiteboardElements($franPage, 3);
    $this->awaitWhiteboardScene($franPage, $source);
    $this->awaitWhiteboardScene($miaPage, $copy);

    $franPage->navigate(p17bBoardPath($source));
    $miaPage->navigate(p17bBoardPath($copy));

    $this->awaitRealtime($franPage);
    $this->awaitRealtime($miaPage);
    $this->awaitWhiteboardElements($franPage, 3);
    $this->awaitWhiteboardElements($miaPage, 4);
    $this->awaitWhiteboardScene($franPage, $source);
    $this->awaitWhiteboardScene($miaPage, $copy);

    $sourceNow = collect($this->whiteboardElements($franPage, $source));
    $copyNow = collect($this->whiteboardElements($miaPage, $copy));

    expect($sourceNow)->toHaveCount(3)
        ->and($sourceNow->firstWhere('id', 'p17bSticky')['x'])->toBe(900)
        ->and($sourceNow->firstWhere('id', 'p17bSticky')['y'])->toBe(100)
        ->and($sourceNow->pluck('id')->all())->not->toContain('p17bShape')
        ->and($copyNow)->toHaveCount(4)
        ->and($copyNow->firstWhere('id', $copySticky->element_id)['x'])->toBe(100)
        ->and($copyNow->firstWhere('id', $copySticky->element_id)['y'])->toBe(700)
        ->and($copyNow->filter(fn (array $element): bool => $element['type'] === 'rectangle' && ! isset($element['customData'])))->toHaveCount(1);
});

it('[P17b-12] renames a template and edits its description in the templates dialog, refuses the name of another template, and leaves a board created from it unchanged', function () {
    $team = Team::factory()->create();
    $fran = p17bRenamed(teamMember($team), 'Fran Facilitator');
    $template = WhiteboardTemplate::factory()->create([
        'workspace_id' => $team->workspace_id,
        'name' => 'Kick-off',
        'description' => 'How we start a project',
        'scene' => ['elements' => [sceneElement(['id' => 'p17bOnly', 'x' => 300, 'y' => 200])], 'files' => []],
        'created_by_user_id' => $fran->id,
    ]);
    WhiteboardTemplate::factory()->create(['workspace_id' => $team->workspace_id, 'name' => 'Second', 'created_by_user_id' => $fran->id]);
    $board = resolve(CreateWhiteboard::class)->handle($team, $fran, 'From template', $template->scene);
    $boardBefore = $board->fresh()->only(['title', 'seq']);
    $elementBefore = $board->elements()->sole()->data;
    $name = "#whiteboard-template-{$template->id}-name";
    $description = "#whiteboard-template-{$template->id}-description";

    $page = $this->signIn($fran, p17bTeamPath($team));

    $page->click('button:text-is("Whiteboard templates")')
        ->assertPresent(p17bTemplateRow('Kick-off'))
        ->assertPresent(p17bTemplateRow('Second'))
        ->click(p17bTemplateRow('Kick-off').' button:text-is("Edit")')
        ->fill($name, 'Renamed')
        ->fill($description, 'Edited description')
        ->click('[role="dialog"] form button:text-is("Save")')
        ->assertPresent(p17bTemplateRow('Renamed'))
        ->assertSeeIn(p17bTemplateRow('Renamed'), 'Edited description')
        ->assertNotPresent(p17bTemplateRow('Kick-off'));

    expect($template->fresh()->only(['name', 'description']))->toBe(['name' => 'Renamed', 'description' => 'Edited description']);

    $page->click(p17bTemplateRow('Renamed').' button:text-is("Edit")')
        ->fill($name, ' second ')
        ->click('[role="dialog"] form button:text-is("Save")')
        ->assertSeeIn('[role="dialog"]', 'A template with this name already exists.')
        ->assertPresent($name)
        ->click('[role="dialog"] form button:text-is("Cancel")')
        ->assertPresent(p17bTemplateRow('Renamed'));

    expect($template->fresh()->name)->toBe('Renamed');

    $page->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]')
        ->click('button:text-is("New whiteboard")')
        ->assertPresent('[role="dialog"] [role="radiogroup"]')
        ->assertSeeIn(p17bTile('Renamed'), 'Edited description')
        ->assertNotPresent(p17bTile('Kick-off'));

    expect($board->fresh()->only(['title', 'seq']))->toBe($boardBefore)
        ->and($board->elements()->sole()->data)->toBe($elementBefore);
});

it('[P17b-13] offers neither Edit nor Delete on a template to a member who did not create it, and the server refuses both', function () {
    $team = Team::factory()->create();
    $fran = p17bRenamed(teamMember($team), 'Fran Facilitator');
    $mia = p17bRenamed(teamMember($team), 'Mia Member');
    $template = WhiteboardTemplate::factory()->create([
        'workspace_id' => $team->workspace_id,
        'name' => 'Kick-off',
        'description' => 'How we start a project',
        'created_by_user_id' => $fran->id,
    ]);
    $templatePath = Str::before(p17bTeamPath($team), '/teams/')."/whiteboard-templates/{$template->id}";

    $page = $this->signIn($mia, p17bTeamPath($team));

    $page->click('button:text-is("Whiteboard templates")')
        ->assertPresent(p17bTemplateRow('Kick-off'))
        ->assertSeeIn(p17bTemplateRow('Kick-off'), 'How we start a project')
        ->assertNotPresent('[role="dialog"] li button');

    $update = p17bSend($page, 'PATCH', $templatePath, ['name' => 'Taken over']);
    $delete = p17bSend($page, 'DELETE', $templatePath);

    expect($update['status'])->toBe(403)
        ->and($update['body']['message'])->toBe('Only the creator of this template or a workspace admin can change it.')
        ->and($delete['status'])->toBe(403)
        ->and($template->fresh()->name)->toBe('Kick-off');
});

it('[P17b-14] lets a workspace admin who created neither template edit one and delete the other', function () {
    $team = Team::factory()->create();
    $fran = p17bRenamed(teamMember($team), 'Fran Facilitator');
    $ada = p17bRenamed(workspaceManager($team->workspace), 'Ada Admin');
    $template = WhiteboardTemplate::factory()->create(['workspace_id' => $team->workspace_id, 'name' => 'Kick-off', 'created_by_user_id' => $fran->id]);
    $second = WhiteboardTemplate::factory()->create(['workspace_id' => $team->workspace_id, 'name' => 'Second', 'created_by_user_id' => $fran->id]);

    $page = $this->signIn($ada, p17bTeamPath($team));

    $page->click('button:text-is("Whiteboard templates")')
        ->assertPresent(p17bTemplateRow('Kick-off').' button:text-is("Edit")')
        ->assertPresent(p17bTemplateRow('Kick-off').' button:text-is("Delete")')
        ->assertPresent(p17bTemplateRow('Second').' button:text-is("Edit")')
        ->assertPresent(p17bTemplateRow('Second').' button:text-is("Delete")')
        ->click(p17bTemplateRow('Kick-off').' button:text-is("Edit")')
        ->fill("#whiteboard-template-{$template->id}-description", 'Edited by the admin')
        ->click('[role="dialog"] form button:text-is("Save")')
        ->assertSeeIn(p17bTemplateRow('Kick-off'), 'Edited by the admin')
        ->click(p17bTemplateRow('Second').' button:text-is("Delete")')
        ->assertSeeIn(p17bTemplateRow('Second'), 'Delete this template?')
        ->assertSeeIn(p17bTemplateRow('Second'), 'Boards already created from it are not changed.')
        ->click(p17bTemplateRow('Second').' div.bg-muted button:text-is("Delete")')
        ->assertNotPresent(p17bTemplateRow('Second'))
        ->assertPresent(p17bTemplateRow('Kick-off'));

    expect($template->fresh()->description)->toBe('Edited by the admin')
        ->and($template->fresh()->created_by_user_id)->toBe($fran->id)
        ->and(WhiteboardTemplate::query()->whereKey($second->id)->exists())->toBeFalse();
});

it('[P17b-15] still opens a board created from a template, with its elements and its image, after the template and the source board are deleted', function () {
    Storage::fake();

    ['board' => $source, 'team' => $team, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard(['title' => 'Source board']);
    p17bScene($source, $franMember);
    $template = resolve(SaveWhiteboardTemplate::class)->handle($source, $fran, 'Kick-off', null);
    $board = resolve(CreateWhiteboard::class)->handle($team, $fran, 'From template', $template->scene);
    $templateFile = "whiteboard-templates/{$template->id}/".P17bFileId;
    $sourceFile = "whiteboards/{$source->id}/".P17bFileId;

    expect(Storage::exists($templateFile))->toBeTrue();

    $page = $this->signIn($fran, p17bTeamPath($team));

    $page->click('button:text-is("Whiteboard templates")')
        ->click(p17bTemplateRow('Kick-off').' button:text-is("Delete")')
        ->assertSeeIn(p17bTemplateRow('Kick-off'), 'Delete this template?')
        ->click(p17bTemplateRow('Kick-off').' div.bg-muted button:text-is("Delete")')
        ->assertSeeIn('[role="dialog"]', 'No whiteboard templates yet.')
        ->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]')
        ->click('button[aria-label="Delete Source board"]')
        ->assertSeeIn('[role="dialog"]', 'Delete this board?')
        ->click('[role="dialog"] button:text-is("Delete this board")')
        ->assertNotPresent("a[href=\"/whiteboards/{$source->id}\"]")
        ->assertNotPresent('[role="dialog"]');

    expect(WhiteboardTemplate::query()->count())->toBe(0)
        ->and(Whiteboard::query()->whereKey($source->id)->exists())->toBeFalse()
        ->and(Storage::exists($templateFile))->toBeFalse()
        ->and(Storage::exists($sourceFile))->toBeFalse();

    $page->click("a[href=\"/whiteboards/{$board->id}\"]")
        ->assertPathIs(p17bBoardPath($board));

    $this->awaitRealtime($page);
    $this->awaitWhiteboardElements($page, 4);

    expect($this->whiteboardElements($page, $board))->toHaveCount(4)
        ->and($page->script(p17bFileDownload($board)))->toBe('200 image/png '.strlen((string) base64_decode(P17bPng)));

    $page->click('a[aria-label="Back to the team"]')
        ->click('button:text-is("New whiteboard")')
        ->assertPresent('[role="dialog"] [role="radiogroup"]')
        ->assertCount('[role="dialog"] [role="radiogroup"]', 1)
        ->assertDontSee('Workspace templates');
});
```

- [ ] **Step 4: Run the tests of Step 3**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php --filter='P17b-(08|09|10|11|12|13|14|15)'`

Expected: PASS; a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. In `[P17b-10]`, a `version` other than 1 on the new board right after its creation means the canvas rewrote an element while loading it: read which element and why before changing the assertion (see the harness findings). In `[P17b-10]` and `[P17b-15]`, an image that answers 404 on the new board is the defect "the copy does not own its image".

- [ ] **Step 5: Run the tests of this task together**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php`

Expected: PASS, 15 tests (14 if canvas driving was removed).

- [ ] **Step 6: Format and check**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue, and no import removed (every import of Step 3 is used).

Run: `composer rector:check`
Expected: no change proposed for the test file. If it proposes one, run `composer rector` and run the file again.

Run: `vendor/bin/pest tests/Arch`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php
git commit -m "test(browser): automate the built-in and workspace template sections of the plan 17b walkthrough"
```

### Task 4: Whiteboard templates walkthrough, part 2 (plan 17b, sections 3 to 6)

This task automates sections 3 to 6 of the same walkthrough: what a guest may not do, the exports, duplicating a board, deleting a board from the list, and the two sync follow-ups.

How each section is proven:

- Section 3: the guest's menu is read in the guest's page, and every request the walkthrough sent from the guest's console is sent from the guest's page with `fetch()` (`p17bSend()`).
- Section 4: nothing can be observed on disk. The page's save paths are replaced by a recorder (`p17bRecordDownloads()`), as the manual replay did with `showSaveFilePicker`: `window.showSaveFilePicker` records the suggested name and aborts, a click on an `<a download>` records its `download` name, and `URL.createObjectURL` keeps the blob. The image export is proven by the names it asks to save ("<title>.png", "<title>.svg"). The data export is proven by the name and by the content of the blob the page built: it is JSON, it holds the board's elements, and it holds the image's file.
- Today's data export is not the one the walkthrough saw. The walkthrough saved a `.excalidraw` file through the library's own "save to disk". The product now switches that action off (`HiddenSaveToDiskAction` in `resources/js/lib/whiteboard/excalidraw.ts`) and shows its own panel in the export dialog (`resources/js/components/whiteboard/scene-export.tsx`): the sentence "Download everything on the board as a data file." and the button "Download board data", which downloads `<title>.whiteboard.json`. `[P17b-20]` tests today's behaviour.
- Section 5: duplicates are made through the board menu; the copy is read from its page, its snapshot and the database. "Edit the copy, reload the original" uses a write through the real endpoint on the copy.
- "An open tab on that board shows This board was deleted" uses two contexts of the same user (harness findings: two `signIn()` calls for one user give two contexts and one participant).
- Section 6: the manual replay made the remote changes with `fetch` from A's page; so do the tests (`$this->addWhiteboardElement()` sends no `X-Socket-ID`, so the page receives the event). To put the page behind the purge mark, the test writes one element row and moves `seq` and `purged_seq` in the database without a broadcast, after the page's resync. The next event the page receives does not follow the seq it holds, so it asks for a delta, which answers 409, and then for the snapshot. `[P17b-30a]` makes the snapshot request fail first by ending the page's XHR requests to `/snapshot` with a network error; the write helper and `snapshotOf()` use `fetch()` and are not affected. The retry delays (about 2 s, then about 4 s) are not measured.

Facts about the interface that the selectors rely on (all read from the current code):

- Board menu (`board-menu.tsx`): a guest's menu holds only the switch "Hide my cursor"; a member's menu also holds the items "Duplicate this board" and "Save as template". "Duplicate this board" posts to `/whiteboards/{board}/duplicate` and visits the `url` of the answer. In French the menu is `[aria-label="Menu du tableau"]` and the item "Dupliquer ce tableau"; the copy's title ends with " (copie)".
- `POST /whiteboards/{board}/template` and `POST /whiteboards/{board}/duplicate` answer a guest 403 with "Guests cannot do this." (`WhiteboardGuard::notGuest`). The team routes are behind `auth`: a guest gets 401 on a JSON request and is sent to `/login` on a page visit.
- Canvas menu of Excalidraw 0.18.1 (`node_modules/@excalidraw/excalidraw/dist/dev/index.js`): `[data-testid="main-menu-trigger"]` opens `[data-testid="dropdown-menu"]`, whose items are `[data-testid="json-export-button"]` and `[data-testid="image-export-button"]`. The image dialog is `.ImageExportModal`: the file name is the input inside `.ImageExportModal__preview__filename` (its value is the `name` prop, the board title), and `.ImageExportModal__settings__buttons` holds three buttons whose `aria-label` are "Export to PNG", "Export to SVG" and "Copy PNG to clipboard". The data dialog is `.ExportDialog--json`; the library's own cards (`.Card`) are not rendered because `saveFileToDisk` is `false` and no backend export is configured.
- A deleted board renders only "This board was deleted." with a link "Back to the team" for a member (`board-gone.tsx`), and the board root with `data-realtime` is gone.
- A delta older than the purge mark answers 409 (`WhiteboardElementsController::index`); `scene-sync.ts` then calls `recover()`, which requests the snapshot, and on failure shows the banner "Reconnecting…" and retries after `RetryDelayMs * 2 ** (failures - 1)` (2 s, 4 s, …).

No product file changes in this task.

**Files:**
- Modify: `tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php`
- Test: `tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php`

**Interfaces:**
- Consumes:
  - Task 1: `data-realtime` and `data-scene`; `$this->whiteboardSnapshot()`, `$this->whiteboardElements()`, `$this->writeWhiteboardElements()`, `$this->addWhiteboardElement()`, `$this->awaitWhiteboardElements()`, `$this->awaitWhiteboardScene()`, `$this->whiteboardSceneStamp()`.
  - `Tests\BrowserTestCase`: `$this->signIn()`, `$this->joinAsGuest()`, `$this->awaitRealtime()`, `$this->awaitResync()`.
  - Task 3: `p17bRenamed()`, `p17bTeamPath()`, `p17bBoardPath()`, `p17bBoard()`, `p17bStored()`, `p17bScene()`, `p17bOpenBoardMenu()`, `p17bSend()`, `p17bFileDownload()`, `P17bPng`, `P17bFileId`.
  - `tests/Pest.php`: `teamMember()`, `workspaceManager()`, `whiteboardMember(Whiteboard $board): array{0: User, 1: WhiteboardMember}`, `whiteboardFacilitator()`.
  - `App\Actions\Whiteboards\DuplicateWhiteboard::handle(Whiteboard $board, User $user): Whiteboard`.
- Produces:
  - File-level helpers added to `tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php`: `p17bJoinPath(Whiteboard $board): string`, `p17bRecordDownloads(mixed $page): void`, `p17bShapes(array $elements): array`, `p17bBlockSnapshots(mixed $page): void`, `p17bUnblockSnapshots(mixed $page): void`, `p17bSnapshotRequests(): string`; page-side state `window.p17bDownloads` and `window.p17bBlocked` (set by test scripts, not by product code).

- [ ] **Step 1: Add the helpers and the tests of sections 3 and 4**

Add these helpers after `p17bFileDownload()`:

```php
function p17bJoinPath(Whiteboard $board): string
{
    return "/whiteboards/join/{$board->fresh()->guest_token}";
}

function p17bRecordDownloads(mixed $page): void
{
    $page->script(<<<'JS'
        () => {
            const create = URL.createObjectURL.bind(URL);
            const click = HTMLAnchorElement.prototype.click;

            window.p17bDownloads = { names: [], blobs: [] };

            URL.createObjectURL = (blob) => {
                window.p17bDownloads.blobs.push(blob);

                return create(blob);
            };

            window.showSaveFilePicker = (options) => {
                window.p17bDownloads.names.push(options?.suggestedName ?? '');

                return Promise.reject(new DOMException('The user aborted a request.', 'AbortError'));
            };

            HTMLAnchorElement.prototype.click = function () {
                if (this.hasAttribute('download')) {
                    window.p17bDownloads.names.push(this.download);

                    return undefined;
                }

                return click.call(this);
            };

            return true;
        }
        JS);
}
```

Append these tests to the file:

```php
it('[P17b-16] lists Duplicate this board and Save as template in a member\'s board menu and neither in a guest\'s', function () {
    ['board' => $board, 'fran' => $fran] = p17bBoard(['guest_access_enabled' => true]);

    $franPage = $this->awaitRealtime($this->signIn($fran, p17bBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17bJoinPath($board), 'Guest Gia'));

    p17bOpenBoardMenu($franPage)
        ->assertPresent('[role="menu"] [role="menuitem"]:has-text("Duplicate this board")')
        ->assertPresent('[role="menu"] [role="menuitem"]:has-text("Save as template")');

    p17bOpenBoardMenu($guestPage)
        ->assertPresent('[role="menu"] [role="menuitemcheckbox"]:has-text("Hide my cursor")')
        ->assertCount('[role="menu"] [role="menuitemcheckbox"]', 1)
        ->assertCount('[role="menu"] [role="menuitem"]', 0)
        ->assertDontSeeIn('[role="menu"]', 'Duplicate this board')
        ->assertDontSeeIn('[role="menu"]', 'Save as template');

    expect($this->whiteboardSnapshot($guestPage, $board)['me']['isGuest'])->toBeTrue();
});

it('[P17b-17] refuses a guest who posts a template or a duplicate of the board, with 403, and creates nothing', function () {
    ['board' => $board, 'fran' => $fran] = p17bBoard(['guest_access_enabled' => true]);

    $this->awaitRealtime($this->signIn($fran, p17bBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17bJoinPath($board), 'Guest Gia'));

    $template = p17bSend($guestPage, 'POST', "/whiteboards/{$board->id}/template", ['name' => 'x']);
    $duplicate = p17bSend($guestPage, 'POST', "/whiteboards/{$board->id}/duplicate");

    expect($template['status'])->toBe(403)
        ->and($template['body']['message'])->toBe('Guests cannot do this.')
        ->and($duplicate['status'])->toBe(403)
        ->and($duplicate['body']['message'])->toBe('Guests cannot do this.')
        ->and(WhiteboardTemplate::query()->count())->toBe(0)
        ->and(Whiteboard::query()->count())->toBe(1);

    $guestPage->assertPresent('[data-realtime="connected"]');
});

it('[P17b-18] sends a guest who opens the team page to the login page, and answers 401 to the guest\'s requests on templates and on the team\'s boards', function () {
    ['board' => $board, 'team' => $team, 'fran' => $fran] = p17bBoard(['guest_access_enabled' => true]);
    $template = WhiteboardTemplate::factory()->create(['workspace_id' => $team->workspace_id, 'name' => 'Kick-off', 'created_by_user_id' => $fran->id]);
    $templatePath = Str::before(p17bTeamPath($team), '/teams/')."/whiteboard-templates/{$template->id}";

    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17bJoinPath($board), 'Guest Gia'));

    $update = p17bSend($guestPage, 'PATCH', $templatePath, ['name' => 'Taken over']);
    $delete = p17bSend($guestPage, 'DELETE', $templatePath);
    $create = p17bSend($guestPage, 'POST', p17bTeamPath($team).'/whiteboards', ['title' => 'Guest board', 'workspace_template_id' => $template->id]);

    expect($update['status'])->toBe(401)
        ->and($delete['status'])->toBe(401)
        ->and($create['status'])->toBe(401)
        ->and($template->fresh()->name)->toBe('Kick-off')
        ->and(Whiteboard::query()->count())->toBe(1);

    $guestPage->navigate(p17bTeamPath($team))
        ->assertPathIs('/login')
        ->assertDontSee('Kick-off')
        ->assertDontSee('Whiteboard templates')
        ->assertDontSee('New whiteboard');
});

it('[P17b-19] offers PNG, SVG and the clipboard in the image export, and asks to save files named after the board title', function () {
    Storage::fake();

    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard(['title' => 'Export board']);
    p17bScene($board, $franMember);

    $page = $this->awaitRealtime($this->signIn($fran, p17bBoardPath($board)));

    $this->awaitWhiteboardElements($page, 4);
    p17bRecordDownloads($page);

    $page->click('.whiteboard-canvas [data-testid="main-menu-trigger"]')
        ->click('[data-testid="dropdown-menu"] [data-testid="image-export-button"]')
        ->assertPresent('.ImageExportModal')
        ->assertScript("document.querySelector('.ImageExportModal__preview__filename input').value", 'Export board')
        ->assertCount('.ImageExportModal__settings__buttons button', 3)
        ->assertPresent('.ImageExportModal button[aria-label="Copy PNG to clipboard"]')
        ->click('.ImageExportModal button[aria-label="Export to PNG"]')
        ->assertScript("window.p17bDownloads.names.includes('Export board.png')", true)
        ->click('.ImageExportModal button[aria-label="Export to SVG"]')
        ->assertScript("window.p17bDownloads.names.includes('Export board.svg')", true);
});

it('[P17b-20] downloads the board data as a file named after the board title, which holds the elements and the image of the board', function () {
    Storage::fake();

    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard(['title' => 'Export board']);
    p17bScene($board, $franMember);
    $holdsImage = "(async () => { document.querySelector('.ExportDialog--json button').click(); const blob = window.p17bDownloads.blobs.at(-1); const scene = JSON.parse(await blob.text()); return Object.keys(scene.files ?? {}).includes('".P17bFileId."'); })()";

    $page = $this->awaitRealtime($this->signIn($fran, p17bBoardPath($board)));

    $this->awaitWhiteboardElements($page, 4);
    p17bRecordDownloads($page);

    $page->click('.whiteboard-canvas [data-testid="main-menu-trigger"]')
        ->click('[data-testid="dropdown-menu"] [data-testid="json-export-button"]')
        ->assertPresent('.ExportDialog--json')
        ->assertSeeIn('.ExportDialog--json', 'Download everything on the board as a data file.')
        ->assertCount('.ExportDialog--json button', 1)
        ->assertNotPresent('.ExportDialog--json .Card')
        ->click('.ExportDialog--json button:text-is("Download board data")')
        ->assertScript("window.p17bDownloads.names.includes('Export board.whiteboard.json')", true)
        ->assertScript($holdsImage, true);

    $exported = json_decode((string) $page->script(<<<'JS'
        async () => {
            const blob = window.p17bDownloads.blobs.at(-1);
            const scene = JSON.parse(await blob.text());

            return JSON.stringify({
                type: blob.type,
                source: scene.source,
                origin: window.location.origin,
                ids: scene.elements.filter((element) => !element.isDeleted).map((element) => element.id).sort(),
                names: window.p17bDownloads.names,
            });
        }
        JS), true, flags: JSON_THROW_ON_ERROR);

    expect($exported['type'])->toBe('application/json')
        ->and($exported['source'])->toBe($exported['origin'])
        ->and($exported['ids'])->toBe(['p17bArrow', 'p17bImage', 'p17bShape', 'p17bSticky'])
        ->and(collect($exported['names'])->filter(fn (string $name): bool => str_ends_with($name, '.excalidraw'))->all())->toBeEmpty();
});

it('[P17b-22] shows no library name and no outbound link in the canvas menu and in the two export dialogs', function () {
    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard(['title' => 'Export board']);
    p17bStored($board, $franMember, ['id' => 'p17bOnly', 'x' => 300, 'y' => 200], 1);
    $links = fn (string $scope): string => "Array.from(document.querySelectorAll('{$scope} a[href]')).filter((link) => link.getClientRects().length > 0).length";

    $page = $this->awaitRealtime($this->signIn($fran, p17bBoardPath($board)));

    $this->awaitWhiteboardElements($page, 1);

    $page->click('.whiteboard-canvas [data-testid="main-menu-trigger"]')
        ->assertPresent('[data-testid="dropdown-menu"] [data-testid="json-export-button"]')
        ->assertNotPresent('[data-testid="dropdown-menu"] a[href]')
        ->assertDontSeeIn('[data-testid="dropdown-menu"]', 'Excalidraw')
        ->click('[data-testid="dropdown-menu"] [data-testid="image-export-button"]')
        ->assertPresent('.ImageExportModal')
        ->assertScript($links('.ImageExportModal'), 0)
        ->assertDontSeeIn('.ImageExportModal', 'Excalidraw')
        ->keys('.ImageExportModal', 'Escape')
        ->assertNotPresent('.ImageExportModal')
        ->click('.whiteboard-canvas [data-testid="main-menu-trigger"]')
        ->click('[data-testid="dropdown-menu"] [data-testid="json-export-button"]')
        ->assertPresent('.ExportDialog--json')
        ->assertScript($links('.excalidraw-modal-container'), 0)
        ->assertDontSeeIn('.excalidraw-modal-container', 'Excalidraw')
        ->assertDontSee('Excalidraw');
});
```

- [ ] **Step 2: Run the tests of Step 1**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php --filter='P17b-(16|17|18|19|20|22)'`

Expected: PASS; a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. In `[P17b-19]`, if no name is ever recorded, read `window.p17bDownloads` with `script()` after the click and see the harness findings ("Stubs and bindings"): the library chooses its save path when its module loads, and the recorder covers both paths. If the three buttons carry other labels, address them by position (`.ImageExportModal__settings__buttons button >> nth=0` for PNG, `>> nth=1` for SVG). In `[P17b-22]`, a visible link or the library's name is the defect the walkthrough checked on line 95: follow the Defect rule.

- [ ] **Step 3: Add the tests of section 5**

Replace the import block at the top of the file by:

```php
use App\Actions\Whiteboards\CreateWhiteboard;
use App\Actions\Whiteboards\DuplicateWhiteboard;
use App\Actions\Whiteboards\SaveWhiteboardTemplate;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardTemplate;
use App\Support\WhiteboardTemplates\BuiltInTemplates;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
```

Add this helper after `p17bRecordDownloads()`:

```php
/**
 * @param  array<int, array<string, mixed>>  $elements
 * @return array<int, string>
 */
function p17bShapes(array $elements): array
{
    return collect($elements)
        ->map(fn (array $element): string => "{$element['type']}:{$element['x']}:{$element['y']}:{$element['width']}:{$element['height']}")
        ->sort()
        ->values()
        ->all();
}
```

Append these tests to the file:

```php
it('[P17b-23] duplicates a board from its menu and lands on the copy, with the same elements and image, the member as facilitator and the default settings', function () {
    Storage::fake();

    ['board' => $source, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard(['guest_access_enabled' => true, 'cursors_enabled' => false]);
    p17bScene($source, $franMember);

    $page = $this->awaitRealtime($this->signIn($fran, p17bBoardPath($source)));

    $this->awaitWhiteboardElements($page, 4);

    $sourceShapes = p17bShapes($this->whiteboardElements($page, $source));

    p17bOpenBoardMenu($page)
        ->click('[role="menuitem"]:has-text("Duplicate this board")')
        ->assertPathIsNot(p17bBoardPath($source))
        ->assertSeeIn('header > h1', 'Sprint board (copy)');

    $copy = Whiteboard::query()->whereKeyNot($source->id)->sole();

    $page->assertPathIs(p17bBoardPath($copy));

    $this->awaitRealtime($page);
    $this->awaitWhiteboardElements($page, 4);

    $snapshot = $this->whiteboardSnapshot($page, $copy);
    $rows = WhiteboardElement::query()->where('whiteboard_id', $copy->id)->get();

    expect($snapshot['board']['title'])->toBe('Sprint board (copy)')
        ->and($snapshot['me']['isFacilitator'])->toBeTrue()
        ->and($snapshot['me']['name'])->toBe('Fran Facilitator')
        ->and($snapshot['board']['guestAccessEnabled'])->toBeFalse()
        ->and($snapshot['board']['cursorsEnabled'])->toBeTrue()
        ->and($snapshot['board']['reactionsEnabled'])->toBeTrue()
        ->and(p17bShapes($snapshot['elements']))->toBe($sourceShapes)
        ->and($rows->pluck('version')->unique()->all())->toBe([1])
        ->and($rows->pluck('element_id')->intersect(['p17bSticky', 'p17bShape', 'p17bArrow', 'p17bImage'])->all())->toBeEmpty()
        ->and($copy->team_id)->toBe($source->team_id)
        ->and($copy->guest_token)->not->toBe($source->guest_token)
        ->and($page->script(p17bFileDownload($copy)))->toBe('200 image/png '.strlen((string) base64_decode(P17bPng)))
        ->and(WhiteboardFile::query()->where('whiteboard_id', $copy->id)->sole()->path)->toBe("whiteboards/{$copy->id}/".P17bFileId);
});

it('[P17b-24] makes a second member the facilitator of the copy she duplicates, while the source keeps its facilitator and its page shows nothing of it', function () {
    Storage::fake();

    ['board' => $source, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard();
    p17bScene($source, $franMember);
    [$mia] = whiteboardMember($source);
    p17bRenamed($mia, 'Mia Member');

    $franPage = $this->awaitRealtime($this->signIn($fran, p17bBoardPath($source)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, p17bBoardPath($source)));

    $this->awaitWhiteboardElements($franPage, 4);
    $this->awaitWhiteboardElements($miaPage, 4);
    $this->awaitWhiteboardScene($franPage, $source);

    $seq = $source->fresh()->seq;

    p17bOpenBoardMenu($miaPage)
        ->click('[role="menuitem"]:has-text("Duplicate this board")')
        ->assertPathIsNot(p17bBoardPath($source))
        ->assertSeeIn('header > h1', 'Sprint board (copy)');

    $copy = Whiteboard::query()->whereKeyNot($source->id)->sole();

    $this->awaitRealtime($miaPage);

    expect($this->whiteboardSnapshot($miaPage, $copy)['me']['isFacilitator'])->toBeTrue()
        ->and($copy->facilitator->user_id)->toBe($mia->id)
        ->and($source->fresh()->facilitator_member_id)->toBe($franMember->id)
        ->and($source->fresh()->seq)->toBe($seq);

    $this->addWhiteboardElement($franPage, $source, ['type' => 'ellipse', 'x' => 900, 'y' => 500]);
    $this->awaitWhiteboardElements($franPage, 5);

    $franSnapshot = $this->whiteboardSnapshot($franPage, $source);

    $franPage->assertSeeIn('header > h1', 'Sprint board')
        ->assertDontSee('(copy)')
        ->assertNotPresent('[data-sonner-toast]')
        ->assertPresent('[role="toolbar"][aria-label="Facilitation tools"]');

    expect($franSnapshot['me']['isFacilitator'])->toBeTrue()
        ->and($franSnapshot['board']['facilitatorMemberId'])->toBe($franMember->id)
        ->and($copy->elements()->count())->toBe(4);
});

it('[P17b-25] leaves the original unchanged when the copy is edited, after a reload of the original too', function () {
    Storage::fake();

    ['board' => $source, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard();
    p17bScene($source, $franMember);
    $copy = resolve(DuplicateWhiteboard::class)->handle($source, $fran);
    $copySticky = WhiteboardElement::query()->where('whiteboard_id', $copy->id)->where('is_sticky', true)->sole();
    $sourceBefore = WhiteboardElement::query()->where('whiteboard_id', $source->id)->orderBy('seq')->get()->map(fn (WhiteboardElement $element): array => $element->data)->all();

    $page = $this->awaitRealtime($this->signIn($fran, p17bBoardPath($copy)));

    $this->awaitWhiteboardElements($page, 4);

    $removal = $this->writeWhiteboardElements($page, $copy, [
        [...$copySticky->data, 'version' => $copySticky->version + 1, 'versionNonce' => 9004, 'isDeleted' => true],
    ]);

    expect($removal['status'])->toBe(200)
        ->and($removal['body']['rejected'])->toBeArray()->toBeEmpty();

    $this->awaitWhiteboardElements($page, 3);
    $this->awaitWhiteboardScene($page, $copy);

    $page->navigate(p17bBoardPath($source));

    $this->awaitRealtime($page);
    $this->awaitWhiteboardElements($page, 4);

    $page->assertSeeIn('header > h1', 'Sprint board')
        ->assertDontSee('(copy)');

    expect(p17bShapes($this->whiteboardElements($page, $source)))->toBe(p17bShapes($sourceBefore))
        ->and(collect($this->whiteboardElements($page, $source))->pluck('id')->sort()->values()->all())->toBe(['p17bArrow', 'p17bImage', 'p17bShape', 'p17bSticky'])
        ->and(WhiteboardElement::query()->where('whiteboard_id', $copy->id)->where('is_deleted', false)->count())->toBe(3);
});

it('[P17b-26] ends the title of a copy with the French word when the member who duplicates uses French', function () {
    ['board' => $source, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard(['title' => 'Carte du sprint']);
    p17bStored($source, $franMember, ['id' => 'p17bOnly', 'x' => 300, 'y' => 200], 1);
    p17bRenamed($fran, 'Fran Facilitator', 'fr');

    $page = $this->awaitRealtime($this->signIn($fran, p17bBoardPath($source)));

    p17bOpenBoardMenu($page, 'Menu du tableau')
        ->click('[role="menuitem"]:has-text("Dupliquer ce tableau")')
        ->assertPathIsNot(p17bBoardPath($source))
        ->assertSeeIn('header > h1', 'Carte du sprint (copie)');

    $copy = Whiteboard::query()->whereKeyNot($source->id)->sole();

    expect($copy->title)->toBe('Carte du sprint (copie)')
        ->and($copy->elements()->count())->toBe(1);
});

it('[P17b-27] shows the trash button to each member only on the boards she facilitates, and to a workspace admin on every board', function () {
    ['board' => $franBoard, 'team' => $team, 'fran' => $fran] = p17bBoard(['title' => 'Fran board']);
    $miaBoard = Whiteboard::factory()->create(['team_id' => $team->id, 'title' => 'Mia board']);
    [$mia] = whiteboardFacilitator($miaBoard);
    p17bRenamed($mia, 'Mia Member');
    $ada = p17bRenamed(workspaceManager($team->workspace), 'Ada Admin');
    $franTrash = 'button[aria-label="Delete Fran board"]';
    $miaTrash = 'button[aria-label="Delete Mia board"]';

    $franPage = $this->signIn($fran, p17bTeamPath($team));

    $franPage->assertSeeIn("a[href=\"/whiteboards/{$franBoard->id}\"]", 'Facilitated by Fran Facilitator')
        ->assertSeeIn("a[href=\"/whiteboards/{$miaBoard->id}\"]", 'Facilitated by Mia Member')
        ->assertPresent($franTrash)
        ->assertNotPresent($miaTrash);

    $miaPage = $this->signIn($mia, p17bTeamPath($team));

    $miaPage->assertPresent("a[href=\"/whiteboards/{$franBoard->id}\"]")
        ->assertPresent($miaTrash)
        ->assertNotPresent($franTrash);

    $adaPage = $this->signIn($ada, p17bTeamPath($team));

    $adaPage->assertPresent("a[href=\"/whiteboards/{$franBoard->id}\"]")
        ->assertPresent($franTrash)
        ->assertPresent($miaTrash);
});

it('[P17b-28] removes a board from the list without a page load when its facilitator deletes it, and tells an open tab on that board that it was deleted', function () {
    ['board' => $board, 'team' => $team, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard();
    p17bStored($board, $franMember, ['id' => 'p17bOnly', 'x' => 300, 'y' => 200], 1);
    $kept = Whiteboard::factory()->create(['team_id' => $team->id, 'title' => 'Kept board']);

    $boardPage = $this->awaitRealtime($this->signIn($fran, p17bBoardPath($board)));
    $teamPage = $this->signIn($fran, p17bTeamPath($team));

    $teamPage->assertPresent("a[href=\"/whiteboards/{$board->id}\"]");
    $teamPage->script('() => { window.p17bSamePage = true; return true; }');

    $teamPage->click('button[aria-label="Delete Sprint board"]')
        ->assertSeeIn('[role="dialog"]', 'Delete this board?')
        ->assertSeeIn('[role="dialog"]', 'Everything on it is removed for everyone.')
        ->click('[role="dialog"] button:text-is("Delete this board")')
        ->assertNotPresent("a[href=\"/whiteboards/{$board->id}\"]")
        ->assertNotPresent('[role="dialog"]')
        ->assertPresent("a[href=\"/whiteboards/{$kept->id}\"]")
        ->assertScript('window.p17bSamePage === true', true);

    $boardPage->assertSee('This board was deleted.')
        ->assertNotPresent('[data-realtime]')
        ->assertNotPresent('.whiteboard-canvas');

    expect(Whiteboard::query()->whereKey($board->id)->exists())->toBeFalse()
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->count())->toBe(0)
        ->and(Whiteboard::query()->whereKey($kept->id)->exists())->toBeTrue();
});
```

- [ ] **Step 4: Run the tests of Step 3**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php --filter='P17b-2[3-8]'`

Expected: PASS; a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. In `[P17b-24]`, a changed `seq` on the source after the duplication, with no write made by the test, means that a canvas rewrote an arranged element while loading it: see the harness findings.

- [ ] **Step 5: Add the helpers and the tests of section 6**

Add these helpers after `p17bShapes()`:

```php
function p17bBlockSnapshots(mixed $page): void
{
    $page->script(<<<'JS'
        () => {
            const open = XMLHttpRequest.prototype.open;
            const send = XMLHttpRequest.prototype.send;

            window.p17bBlocked = { active: true, refused: 0 };

            XMLHttpRequest.prototype.open = function (method, url, ...rest) {
                this.p17bPath = new URL(String(url), window.location.href).pathname;

                return open.call(this, method, url, ...rest);
            };

            XMLHttpRequest.prototype.send = function (body) {
                if (window.p17bBlocked.active && this.p17bPath.endsWith('/snapshot')) {
                    window.p17bBlocked.refused += 1;
                    setTimeout(() => this.dispatchEvent(new ProgressEvent('error')), 0);

                    return undefined;
                }

                return send.call(this, body);
            };

            return true;
        }
        JS);
}

function p17bUnblockSnapshots(mixed $page): void
{
    $page->script('() => { window.p17bBlocked.active = false; return true; }');
}

function p17bSnapshotRequests(): string
{
    return "performance.getEntriesByType('resource').filter((entry) => new URL(entry.name).pathname.endsWith('/snapshot') && entry.initiatorType === 'xmlhttprequest' && entry.responseEnd > 0).length";
}
```

Append these tests to the file:

```php
it('[P17b-29] reloads the scene from the snapshot when the delta it asks for is older than the purge mark, without losing anything and without the reconnecting banner', function () {
    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard();
    p17bStored($board, $franMember, ['id' => 'p17bFirst', 'index' => 'a0', 'x' => 300, 'y' => 200], 1);
    $refused = "performance.getEntriesByType('resource').some((entry) => entry.name.includes('/elements?since=1') && entry.responseStatus === 409)";

    $page = $this->awaitRealtime($this->signIn($fran, p17bBoardPath($board)));

    $this->awaitResync($page);
    $this->awaitWhiteboardElements($page, 1);

    $page->assertScript("performance.getEntriesByType('resource').some((entry) => entry.name.includes('/elements?since=') && entry.responseEnd > 0)", true);

    $snapshotsBefore = (int) $page->script('() => '.p17bSnapshotRequests());

    p17bStored($board, $franMember, ['id' => 'p17bBehind', 'index' => 'a1', 'x' => 600, 'y' => 200, 'versionNonce' => 201], 2);
    Whiteboard::query()->whereKey($board->id)->update(['purged_seq' => 2]);

    $this->addWhiteboardElement($page, $board, ['x' => 900, 'y' => 200]);

    $this->awaitWhiteboardElements($page, 3);
    $this->awaitWhiteboardScene($page, $board);

    $page->assertScript($refused, true)
        ->assertDontSee('Reconnecting…')
        ->assertPresent('[data-realtime="connected"]');

    expect((int) $page->script('() => '.p17bSnapshotRequests()))->toBeGreaterThan($snapshotsBefore)
        ->and(collect($this->whiteboardElements($page, $board))->pluck('id')->all())->toContain('p17bFirst', 'p17bBehind')
        ->and($board->fresh()->seq)->toBe(3);
});

it('[P17b-30a] keeps the reconnecting banner while the snapshot cannot be fetched, tries again, and clears the banner once the snapshot arrives', function () {
    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard();
    p17bStored($board, $franMember, ['id' => 'p17bFirst', 'index' => 'a0', 'x' => 300, 'y' => 200], 1);

    $page = $this->awaitRealtime($this->signIn($fran, p17bBoardPath($board)));

    $this->awaitResync($page);
    $this->awaitWhiteboardElements($page, 1);

    $page->assertScript("performance.getEntriesByType('resource').some((entry) => entry.name.includes('/elements?since=') && entry.responseEnd > 0)", true)
        ->assertDontSee('Reconnecting…');

    p17bBlockSnapshots($page);
    p17bStored($board, $franMember, ['id' => 'p17bBehind', 'index' => 'a1', 'x' => 600, 'y' => 200, 'versionNonce' => 201], 2);
    Whiteboard::query()->whereKey($board->id)->update(['purged_seq' => 2]);

    $this->addWhiteboardElement($page, $board, ['x' => 900, 'y' => 200]);

    $page->assertScript('window.p17bBlocked.refused >= 1', true)
        ->assertSee('Reconnecting…')
        ->assertScript('window.p17bBlocked.refused >= 2', true)
        ->assertSee('Reconnecting…')
        ->assertAttribute('[data-scene]', 'data-scene', '1:1:100');

    p17bUnblockSnapshots($page);

    $this->awaitWhiteboardElements($page, 3);

    $page->assertDontSee('Reconnecting…');

    $this->awaitWhiteboardScene($page, $board);

    expect(collect($this->whiteboardElements($page, $board))->pluck('id')->all())->toContain('p17bFirst', 'p17bBehind');
});
```

- [ ] **Step 6: Run the tests of Step 5**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php --filter='P17b-(29|30a)'`

Expected: PASS; a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. `[P17b-30a]` waits for two failed snapshot requests and one more retry, so it takes about ten seconds. If `window.p17bBlocked.refused` stays 0 in `[P17b-30a]`, the board's snapshot request no longer goes through `XMLHttpRequest`; see the harness findings ("Scripts"). If `[P17b-29]` fails only on the 409 entry (`responseStatus` is not reported), drop that one assertion: the larger number of snapshot requests and the three elements on the canvas prove the reload.

- [ ] **Step 7: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php`

Expected: PASS, 29 tests (28 if canvas driving was removed).

- [ ] **Step 8: Format and check**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue, and no import removed (every import of Step 3 is used).

Run: `composer rector:check`
Expected: no change proposed for the test file. If it proposes one, run `composer rector` and run the file again.

Run: `vendor/bin/pest tests/Arch`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php
git commit -m "test(browser): automate the guest, export, duplicate and sync sections of the plan 17b walkthrough"
```

### Task 5: Whiteboard facilitation walkthrough (plan 17c): timer, board lock, element lock

This task automates sections 1, 2 and 3 of `docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md` (lines T1.1, T1.2, B5.1 to B5.6, B5.8, L2.1, E3.1) and its line R1.

Facts read from the current code that the tests rely on:

- Timer (`app/Http/Controllers/Whiteboards/WhiteboardTimersController.php`, `resources/js/components/retro/timer-display.tsx`, `resources/js/hooks/use-countdown.ts`): `PUT /whiteboards/{board}/timer` with `{seconds: 10–3600 | null}`, facilitator only, stores `timer_ends_at` and broadcasts `timer.changed`. There is no job and no server action at zero: each browser counts down by itself against the server clock (offset taken from the snapshot's `serverTime`), shows `Time's up!` in the top-bar element `[role="timer"]`, shows the toast `Time's up!` and plays a sound. The toast is shown only by a page that saw the countdown running. The tests therefore use neither `$this->travel()` nor `$this->workQueue()`. The interface offers 1, 3, 5 and 10 minutes (`[aria-label="Timer"]` opens a menu with `1 min`, `3 min`, `5 min`, `10 min`, `Stop timer`); to reach zero inside a test, `[P17c-01c]` starts the server's minimum of ten seconds through the endpoint from the facilitator's page, without `X-Socket-ID`, so every page receives the broadcast.
- The snapshot answers `timerEndsAt: null` once the timer ended more than five minutes ago (`BuildWhiteboardSnapshot::TimerLingerMinutes`), while the column keeps its value.
- Facilitator tools (`resources/js/components/whiteboard/facilitator-bar.tsx`): inside `[role="toolbar"][aria-label="Facilitation tools"]`, the buttons `[aria-label="Timer"]`, `[aria-label="Lock the board"]` (it becomes `[aria-label="Unlock the board"]` with `aria-pressed="true"`) and `[aria-label="Bring everyone to me"]`. Only the facilitator gets the toolbar. A member or a guest who calls `PUT timer` or `PATCH settings` gets 403 `Only the facilitator can do this.` (`WhiteboardGuard::facilitator`).
- Board lock (`WhiteboardGuard::notLocked`, `board.tsx`): for everyone but the facilitator, `PUT elements` answers 403 with `{"message": "This board is locked.", "errors": {"locked": ["This board is locked."]}}`. The page of such a participant puts the canvas in view mode (`.excalidraw.excalidraw--view-mode`, no shapes toolbar, so no `[data-testid="toolbar-rectangle"]`), removes the sticky tool (`button[aria-label="Sticky note"]`) and shows `This board is locked.` in the status row (`div[role="status"]`). The status row is not rendered at all when it has nothing to say. `ConnectionBanner` also has `role="status"` while reconnecting, so the tests address the status row with `:has-text()`.
- When a write of the page's own sync is refused with `errors.locked` (`resources/js/lib/whiteboard/scene-sync.ts`, `discard()`), the page closes the text editor, drops what it has not sent, reloads the scene from the server, shows the toast `This board is locked.` and refetches the board, without leaving the board. `[P17c-02b]` reaches that refusal for the reason claimed: the test body locks the board in the database without a broadcast, behind an open guest page whose tools are still there, and the guest then adds a sticky note through the interface.
- Element lock (`WriteWhiteboardElements::touchesLock`): a non-facilitator's write of an element whose stored copy is locked, or that sets `locked: true`, is answered 200 with `rejected: [{id, reason: "locked", element: <stored copy or null>}]`; the page's sync then puts the stored copy back and shows the toast `Only the facilitator can change a locked element.`. The canvas container carries `data-facilitator="true|false"`, and `resources/css/app.css` hides `li[data-testid="toggleElementLock"]` and `li[data-testid="unlockAllElements"]` of the canvas context menu (`ul.context-menu`) for `data-facilitator="false"` with `display: none !important`.
- Excalidraw 0.18.1 (`node_modules/@excalidraw/excalidraw/dist/dev/index.js`): the context menu is opened by React's `onContextMenu` on the interactive canvas and includes locked elements in its hit test; each entry is `li[data-testid="<action name>"] > button` (`deleteSelectedElements`, `toggleElementLock`, `unlockAllElements`, `viewMode`). The `viewMode` entry is offered only while the `viewModeEnabled` prop is `undefined`, which is what `board.tsx` passes on an unlocked board. The text editor is `textarea.excalidraw-wysiwyg`.
- `$page->rightClick($selector)` of the browser plugin right-clicks the middle of the element with a real mouse event. The tests use it on the interactive canvas: `[P17c-03b]` arranges a filled shape that covers the middle of the canvas, `[P17c-02d]` keeps the middle empty.

Three tests of this task drive the canvas, which nothing has proven yet: `[P17c-02c]` (text tool, through `$this->drawOnWhiteboard()` of Task 1), `[P17c-02d]` and `[P17c-03b]` (right-click on the canvas). Each is written so that it can be removed alone; Step 4 and Step 6 say what to do if one cannot be made to pass. The server rules they touch are proven without the canvas by `[P17c-02a]`, `[P17c-02b]` and `[P17c-03a]`.

No product file changes in this task.

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php`
- Test: `tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php`

**Interfaces:**
- Consumes:
  - Task 1: `data-realtime` and `data-scene` on the board root; `$this->whiteboardSnapshot()`, `$this->whiteboardElements()`, `$this->writeWhiteboardElements()`, `$this->addWhiteboardElement()`, `$this->addWhiteboardSticky()`, `$this->awaitWhiteboardElements()`, `$this->awaitWhiteboardStored()`, `$this->awaitWhiteboardScene()`, `$this->drawOnWhiteboard()`.
  - `Tests\BrowserTestCase`: `$this->signIn()`, `$this->joinAsGuest()`, `$this->awaitRealtime()`, `$this->awaitResync()`.
  - `tests/Pest.php`: `whiteboardMember(Whiteboard $board): array{0: User, 1: WhiteboardMember}`, `whiteboardFacilitator(Whiteboard $board): array{0: User, 1: WhiteboardMember}`.
  - Factories: `WhiteboardFactory::withGuestAccess()`.
  - Paths: `PUT /whiteboards/{board}/timer`, `PATCH /whiteboards/{board}/settings`, `PUT /whiteboards/{board}/elements`, `GET /whiteboards/{board}/snapshot`.
- Produces:
  - File-level helpers in `tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php` (global functions; later files must not redeclare them): `p17cRenamed(User $user, string $name): User`, `p17cBoard(array $attributes = []): array{board: Whiteboard, fran: User, franMember: WhiteboardMember}`, `p17cBoardPath(Whiteboard $board): string`, `p17cJoinPath(Whiteboard $board): string`, `p17cSend(mixed $page, string $method, string $path, array $body): array{status: int, body: array}`, `p17cPause(mixed $page, int $milliseconds): void`, `p17cTimerSeconds(mixed $page): int`.
  - Constants: `P17cTools`, `P17cLockedNotice`, `P17cLockedToast`, `P17cTimesUpToast`, `P17cViewMode`, `P17cCanvas`.

- [ ] **Step 1: Create the test file with its helpers and the timer tests**

Create `tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php` directly with this content:

```php
<?php

use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;

const P17cTools = '[role="toolbar"][aria-label="Facilitation tools"]';
const P17cLockedNotice = 'div[role="status"]:has-text("This board is locked.")';
const P17cLockedToast = '[data-sonner-toast]:has-text("This board is locked.")';
const P17cTimesUpToast = '[data-sonner-toast]:has-text("Time\'s up!")';
const P17cViewMode = '.whiteboard-canvas .excalidraw.excalidraw--view-mode';
const P17cCanvas = '.whiteboard-canvas canvas.excalidraw__canvas.interactive';

function p17cRenamed(User $user, string $name): User
{
    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return $user;
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     board: Whiteboard,
 *     fran: User,
 *     franMember: WhiteboardMember
 * }
 */
function p17cBoard(array $attributes = []): array
{
    $board = Whiteboard::factory()->withGuestAccess()->create(['title' => 'Sprint board', ...$attributes]);
    [$fran, $franMember] = whiteboardFacilitator($board);

    return [
        'board' => $board,
        'fran' => p17cRenamed($fran, 'Fran Facilitator'),
        'franMember' => $franMember,
    ];
}

function p17cBoardPath(Whiteboard $board): string
{
    return "/whiteboards/{$board->id}";
}

function p17cJoinPath(Whiteboard $board): string
{
    return "/whiteboards/join/{$board->fresh()->guest_token}";
}

/**
 * @param  array<string, mixed>  $body
 * @return array{
 *     status: int,
 *     body: array<string, mixed>
 * }
 */
function p17cSend(mixed $page, string $method, string $path, array $body): array
{
    $request = json_encode([
        'method' => $method,
        'path' => $path,
        'body' => json_encode($body, JSON_THROW_ON_ERROR),
    ], JSON_THROW_ON_ERROR);

    $answer = json_decode((string) $page->script(<<<JS
        async () => {
            const request = {$request};
            const cookie = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='));
            const response = await fetch(request.path, {
                method: request.method,
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)),
                },
                body: request.body,
            });

            return JSON.stringify({ status: response.status, body: await response.text() });
        }
        JS), true, flags: JSON_THROW_ON_ERROR);

    return ['status' => $answer['status'], 'body' => json_decode((string) $answer['body'], true) ?? []];
}

function p17cPause(mixed $page, int $milliseconds): void
{
    for ($waited = 0; $waited < $milliseconds; $waited += 400) {
        $page->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 400))');
    }
}

function p17cTimerSeconds(mixed $page): int
{
    return (int) $page->script('() => { const [minutes, seconds] = document.querySelector(\'[role="timer"]\').textContent.trim().split(":").map(Number); return minutes * 60 + seconds; }');
}

it('[P17c-01a] shows the timer, lock and follow buttons to the facilitator only, and refuses the timer, the lock and follow-me to a member and to a guest', function () {
    ['board' => $board, 'fran' => $fran] = p17cBoard();
    [$mia] = whiteboardMember($board);
    p17cRenamed($mia, 'Mia Member');

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

    $franPage->assertPresent(P17cTools.' [aria-label="Timer"]')
        ->assertPresent(P17cTools.' [aria-label="Lock the board"][aria-pressed="false"]')
        ->assertPresent(P17cTools.' [aria-label="Bring everyone to me"][aria-pressed="false"]')
        ->assertNotPresent('[role="timer"]');

    foreach ([$miaPage, $guestPage] as $page) {
        $page->assertPresent('[aria-label="Board menu"]')
            ->assertNotPresent(P17cTools)
            ->assertNotPresent('[aria-label="Timer"]')
            ->assertNotPresent('[aria-label="Lock the board"]')
            ->assertNotPresent('[aria-label="Bring everyone to me"]');

        $timer = p17cSend($page, 'PUT', "/whiteboards/{$board->id}/timer", ['seconds' => 60]);
        $lock = p17cSend($page, 'PATCH', "/whiteboards/{$board->id}/settings", ['locked' => true]);
        $follow = p17cSend($page, 'PATCH', "/whiteboards/{$board->id}/settings", ['follow_enabled' => true]);

        expect($timer['status'])->toBe(403)
            ->and($timer['body']['message'])->toBe('Only the facilitator can do this.')
            ->and($lock['status'])->toBe(403)
            ->and($lock['body']['message'])->toBe('Only the facilitator can do this.')
            ->and($follow['status'])->toBe(403)
            ->and($this->whiteboardSnapshot($page, $board)['me']['isFacilitator'])->toBeFalse();
    }

    $stored = $board->fresh();

    expect($stored->timer_ends_at)->toBeNull()
        ->and($stored->locked)->toBeFalse()
        ->and($stored->follow_enabled)->toBeFalse()
        ->and($this->whiteboardSnapshot($franPage, $board)['me']['isFacilitator'])->toBeTrue();

    $franPage->assertNotPresent('[role="timer"]')
        ->assertPresent(P17cTools.' [aria-label="Lock the board"][aria-pressed="false"]');
});

it('[P17c-01b] shows the facilitator and a guest the same countdown and the same end time, and removes it for both on Stop timer', function () {
    ['board' => $board, 'fran' => $fran] = p17cBoard();
    $stop = '[role="menuitem"]:has-text("Stop timer")';

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

    $franPage->click('[aria-label="Timer"]')
        ->assertPresent('[role="menu"]')
        ->assertCount('[role="menu"] [role="menuitem"]', 5)
        ->assertAttribute($stop, 'aria-disabled', 'true')
        ->click('[role="menuitem"]:text-is("1 min")')
        ->assertNotPresent('[role="menu"]')
        ->assertPresent('[role="timer"]');

    $guestPage->assertPresent('[role="timer"]');

    $franSeconds = p17cTimerSeconds($franPage);
    $guestSeconds = p17cTimerSeconds($guestPage);
    $endsAt = $board->fresh()->timer_ends_at;

    expect($franSeconds)->toBeBetween(50, 60)
        ->and($guestSeconds)->toBeBetween(50, 60)
        ->and(abs($franSeconds - $guestSeconds))->toBeLessThanOrEqual(1)
        ->and($endsAt)->not->toBeNull()
        ->and($endsAt->getTimestamp() - now()->getTimestamp())->toBeBetween(50, 60)
        ->and($this->whiteboardSnapshot($franPage, $board)['board']['timerEndsAt'])->toBe($endsAt->toIso8601String())
        ->and($this->whiteboardSnapshot($guestPage, $board)['board']['timerEndsAt'])->toBe($endsAt->toIso8601String());

    $franPage->click('[aria-label="Timer"]')
        ->assertPresent('[role="menu"]')
        ->assertAttributeMissing($stop, 'aria-disabled')
        ->click($stop)
        ->assertNotPresent('[role="menu"]')
        ->assertNotPresent('[role="timer"]');

    $guestPage->assertNotPresent('[role="timer"]')
        ->assertNotPresent(P17cTimesUpToast);

    expect($board->fresh()->timer_ends_at)->toBeNull()
        ->and($this->whiteboardSnapshot($guestPage, $board)['board']['timerEndsAt'])->toBeNull();
});

it('[P17c-01c] shows the time-up notice in the top bar and as a toast to the facilitator and to a guest when the countdown reaches zero', function () {
    ['board' => $board, 'fran' => $fran] = p17cBoard();

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

    $started = p17cSend($franPage, 'PUT', "/whiteboards/{$board->id}/timer", ['seconds' => 10]);

    expect($started['status'])->toBe(200)
        ->and($started['body']['timerEndsAt'])->toBe($board->fresh()->timer_ends_at->toIso8601String());

    $franPage->assertPresent('[role="timer"]');
    $guestPage->assertPresent('[role="timer"]');

    expect(p17cTimerSeconds($franPage))->toBeBetween(1, 10)
        ->and(p17cTimerSeconds($guestPage))->toBeBetween(1, 10);

    $franPage->assertSeeIn('[role="timer"]', "Time's up!")
        ->assertPresent(P17cTimesUpToast);

    $guestPage->assertSeeIn('[role="timer"]', "Time's up!")
        ->assertPresent(P17cTimesUpToast);

    expect($this->whiteboardSnapshot($guestPage, $board)['board']['timerEndsAt'])->toBe($started['body']['timerEndsAt']);
});

it('[P17c-01d] shows the remaining time to a guest who opens the board mid-countdown, and no timer once it ended more than five minutes ago', function () {
    ['board' => $board] = p17cBoard(['timer_ends_at' => now()->addSeconds(90)]);

    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

    $guestPage->assertPresent('[role="timer"]');

    expect(p17cTimerSeconds($guestPage))->toBeBetween(78, 90);

    Whiteboard::query()->whereKey($board->id)->update(['timer_ends_at' => now()->subMinute()]);

    $this->awaitRealtime($guestPage->navigate(p17cBoardPath($board)));

    $guestPage->assertSeeIn('[role="timer"]', "Time's up!")
        ->assertNotPresent('[data-sonner-toast]');

    expect($this->whiteboardSnapshot($guestPage, $board)['board']['timerEndsAt'])->not->toBeNull();

    Whiteboard::query()->whereKey($board->id)->update(['timer_ends_at' => now()->subMinutes(6)]);

    $this->awaitRealtime($guestPage->navigate(p17cBoardPath($board)));

    $guestPage->assertSeeIn('header > h1', 'Sprint board')
        ->assertNotPresent('[role="timer"]');

    expect($this->whiteboardSnapshot($guestPage, $board)['board']['timerEndsAt'])->toBeNull()
        ->and($board->fresh()->timer_ends_at)->not->toBeNull();
});
```

- [ ] **Step 2: Run the timer tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php --filter='P17c-01'`

Expected: PASS; a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. `[P17c-01c]` takes about twelve seconds (it waits for a ten-second countdown). In `[P17c-01b]`, two pages more than one second apart is the defect the walkthrough's line T1.1 looks for.

- [ ] **Step 3: Add the board lock tests**

Replace the import block at the top of the file by:

```php
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;
```

Append these tests to the file:

```php
it('[P17c-02a] puts a guest in view mode on a locked board, refuses the guest\'s writes with 403 and errors.locked, lets the facilitator edit, and gives the tools back on unlock', function () {
    ['board' => $board, 'fran' => $fran] = p17cBoard();
    $shapesTool = '.whiteboard-canvas [data-testid="toolbar-rectangle"]';
    $stickyTool = 'button[aria-label="Sticky note"]';

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

    $shape = $this->addWhiteboardElement($franPage, $board, ['x' => 300, 'y' => 300]);

    $this->awaitWhiteboardElements($guestPage, 1);

    $guestPage->assertPresent($stickyTool)
        ->assertPresent($shapesTool)
        ->assertNotPresent(P17cViewMode);

    $franPage->click('[aria-label="Lock the board"]')
        ->assertAriaAttribute('[aria-label="Unlock the board"]', 'pressed', 'true');

    $guestPage->assertPresent(P17cLockedNotice)
        ->assertPresent(P17cViewMode)
        ->assertNotPresent($stickyTool)
        ->assertNotPresent($shapesTool);

    $franPage->assertPresent($stickyTool)
        ->assertPresent($shapesTool)
        ->assertNotPresent(P17cViewMode)
        ->assertDontSee('This board is locked.');

    $newElement = $this->writeWhiteboardElements($guestPage, $board, [sceneElement(['index' => 'a5', 'x' => 700, 'y' => 500])]);
    $move = $this->writeWhiteboardElements($guestPage, $board, [[...$shape, 'version' => 2, 'versionNonce' => 4242, 'x' => 900]]);

    expect($board->fresh()->locked)->toBeTrue()
        ->and($this->whiteboardSnapshot($guestPage, $board)['board']['locked'])->toBeTrue()
        ->and($newElement['status'])->toBe(403)
        ->and($newElement['body']['message'])->toBe('This board is locked.')
        ->and($newElement['body']['errors']['locked'])->toBe(['This board is locked.'])
        ->and($move['status'])->toBe(403)
        ->and($move['body']['errors']['locked'])->toBe(['This board is locked.'])
        ->and($board->fresh()->seq)->toBe(1)
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole()->data['x'])->toBe(300);

    $guestPage->assertPresent('[data-realtime="connected"]')
        ->assertDontSee('Your access to this board has ended.');

    $this->addWhiteboardSticky($franPage, 'Yellow');
    $this->awaitWhiteboardElements($guestPage, 2);

    $moved = $this->writeWhiteboardElements($franPage, $board, [[...$shape, 'version' => 2, 'versionNonce' => 7001, 'x' => 250]]);

    expect($moved['status'])->toBe(200)
        ->and($moved['body']['rejected'])->toBeArray()->toBeEmpty();

    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    $received = collect($this->whiteboardElements($guestPage, $board))->firstWhere('id', $shape['id']);

    expect($received['x'])->toBe(250)
        ->and($received['version'])->toBe(2)
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->count())->toBe(2);

    $franPage->click('[aria-label="Unlock the board"]')
        ->assertAriaAttribute('[aria-label="Lock the board"]', 'pressed', 'false');

    $guestPage->assertDontSee('This board is locked.')
        ->assertNotPresent(P17cViewMode)
        ->assertPresent($stickyTool)
        ->assertPresent($shapesTool);

    $this->addWhiteboardSticky($guestPage, 'Blue');
    $this->awaitWhiteboardStored($guestPage, $board, 3);
    $this->awaitWhiteboardScene($guestPage, $board);
    $this->awaitWhiteboardElements($franPage, 3);

    expect($board->fresh()->locked)->toBeFalse()
        ->and($this->whiteboardSnapshot($guestPage, $board)['board']['locked'])->toBeFalse()
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('is_sticky', true)->count())->toBe(2);
});

it('[P17c-02b] drops the note a guest adds on a board that was locked behind the open page, says the board is locked and keeps the guest on the board', function () {
    ['board' => $board, 'fran' => $fran] = p17cBoard();

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

    $this->awaitWhiteboardElements($guestPage, 0);
    $this->awaitResync($guestPage);

    Whiteboard::query()->whereKey($board->id)->update(['locked' => true]);

    $guestPage->assertPresent('button[aria-label="Sticky note"]')
        ->assertNotPresent(P17cViewMode);

    $this->addWhiteboardSticky($guestPage, 'Green');

    $guestPage->assertPresent(P17cLockedToast)
        ->assertPresent(P17cLockedNotice)
        ->assertPresent(P17cViewMode)
        ->assertNotPresent('button[aria-label="Sticky note"]')
        ->assertPresent('[data-realtime="connected"]')
        ->assertDontSee('Your access to this board has ended.');

    $this->awaitWhiteboardElements($guestPage, 0);
    $this->awaitWhiteboardScene($guestPage, $board);
    $this->awaitWhiteboardElements($franPage, 0);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->count())->toBe(0)
        ->and($board->fresh()->seq)->toBe(0)
        ->and($this->whiteboardElements($franPage, $board))->toBeArray()->toBeEmpty();
});

it('[P17c-02c] closes the text a guest is typing when the facilitator locks the board, and stores nothing more of it during the lock or after the unlock', function () {
    ['board' => $board, 'fran' => $fran] = p17cBoard();
    $editor = '.whiteboard-canvas textarea.excalidraw-wysiwyg';

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

    $this->awaitWhiteboardElements($guestPage, 0);

    $this->drawOnWhiteboard($guestPage, 'text', [600, 400], [600, 400]);

    $guestPage->assertPresent($editor)
        ->fill($editor, 'unsent words');

    $this->awaitWhiteboardStored($guestPage, $board, 1);
    $this->awaitWhiteboardScene($guestPage, $board);
    $this->awaitWhiteboardElements($franPage, 1);

    $typed = WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole();
    $seq = $board->fresh()->seq;

    expect($typed->type)->toBe('text')
        ->and($typed->data['text'])->toBe('unsent words');

    $franPage->click('[aria-label="Lock the board"]')
        ->assertAriaAttribute('[aria-label="Unlock the board"]', 'pressed', 'true');

    $guestPage->assertPresent(P17cLockedNotice)
        ->assertNotPresent($editor)
        ->assertPresent(P17cViewMode)
        ->assertPresent(P17cLockedToast)
        ->assertPresent('[data-realtime="connected"]')
        ->assertDontSee('Your access to this board has ended.');

    $this->awaitWhiteboardScene($guestPage, $board);
    p17cPause($guestPage, 800);

    $duringLock = WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole();

    expect($board->fresh()->seq)->toBe($seq)
        ->and($duringLock->version)->toBe($typed->version)
        ->and($duringLock->data['text'])->toBe('unsent words')
        ->and($this->whiteboardElements($franPage, $board)[0]['text'])->toBe('unsent words');

    $franPage->click('[aria-label="Unlock the board"]');

    $guestPage->assertPresent('button[aria-label="Sticky note"]')
        ->assertNotPresent($editor);

    p17cPause($guestPage, 800);

    $this->awaitWhiteboardScene($guestPage, $board);
    $this->awaitWhiteboardScene($franPage, $board);

    expect($board->fresh()->seq)->toBe($seq)
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole()->data['text'])->toBe('unsent words');
});

it('[P17c-02d] keeps the View mode entry of the canvas menu on an unlocked board, and shows Unlock all elements to the facilitator only', function () {
    ['board' => $board, 'fran' => $fran] = p17cBoard();
    [$mia] = whiteboardMember($board);
    p17cRenamed($mia, 'Mia Member');
    $viewMode = '.whiteboard-canvas .context-menu li[data-testid="viewMode"]';
    $unlockAll = '.whiteboard-canvas .context-menu li[data-testid="unlockAllElements"]';
    $unlockAllDisplay = "getComputedStyle(document.querySelector('{$unlockAll}')).display";

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, p17cBoardPath($board)));

    $this->addWhiteboardElement($franPage, $board, ['x' => 60, 'y' => 60, 'width' => 120, 'height' => 80, 'locked' => true]);

    $this->awaitWhiteboardElements($franPage, 1);
    $this->awaitWhiteboardElements($miaPage, 1);

    $miaPage->assertAttribute('.whiteboard-canvas', 'data-facilitator', 'false')
        ->rightClick(P17cCanvas)
        ->assertPresent('.whiteboard-canvas .context-menu')
        ->assertPresent($viewMode)
        ->assertSeeIn($viewMode, 'View mode')
        ->assertPresent($unlockAll)
        ->assertScript($unlockAllDisplay, 'none');

    $franPage->assertAttribute('.whiteboard-canvas', 'data-facilitator', 'true')
        ->rightClick(P17cCanvas)
        ->assertPresent($viewMode)
        ->assertPresent($unlockAll)
        ->assertScript("{$unlockAllDisplay} != 'none'", true);
});
```

- [ ] **Step 4: Run the board lock tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php --filter='P17c-02'`

Expected: PASS; a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If this fails in the canvas helpers, see the harness findings.

Two tests here drive the canvas and may be removed alone, in this order of attempts:

- `[P17c-02c]`: if canvas driving was removed in Task 1 (Step 9), do not write this test. If the text editor never opens, replace the `drawOnWhiteboard()` line by a double-click dispatched on the canvas in selection mode: `$guestPage->script("() => { const canvas = document.querySelector('".P17cCanvas."'); const box = canvas.getBoundingClientRect(); canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: box.left + 600, clientY: box.top + 400 })); return true; }");`. If the editor closes but the toast never shows while `seq` stays unchanged, closing the editor made no write: remove the single assertion `->assertPresent(P17cLockedToast)` (the toast after a refused write is proven by `[P17c-02b]`). If none of this makes it pass, delete the test, set its coverage row to `residual` with `(none)` as test file, and add this entry to the residual checklist: "**P17c-02c** — "B starts typing in a text, A locks while B types: B's unsent text disappears, B sees the toast and stays on the board in view mode". Not automated: the text editor of the canvas could not be driven from a script (harness findings); `[P17c-02b]` proves that unsent edits are dropped with the toast. Check by hand: as a guest, type in a text; the facilitator locks the board; the editor closes, what is typed afterwards goes nowhere, and after the unlock the stored text is what it was at the lock."
- `[P17c-02d]`: if `rightClick()` on the canvas is refused by the browser (the click waits until the timeout), replace each `->rightClick(P17cCanvas)` by `->script("() => { const canvas = document.querySelector('".P17cCanvas."'); const box = canvas.getBoundingClientRect(); canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 })); return true; }")` on its own statement. If the menu still does not open, delete the test, set its row to `residual`, and add: "**P17c-02d** — "The canvas's own View mode entry (context menu on the empty canvas) is still there on an unlocked board", and "no Unlock all elements entry" for a non-facilitator. Not automated: the canvas context menu could not be opened from a test. Check by hand: right-click the empty canvas of an unlocked board holding a locked shape, as a member: "View mode" is listed and "Unlock all elements" is not; as the facilitator both are."

- [ ] **Step 5: Add the element lock tests**

Append these tests to the file:

```php
it('[P17c-03a] rejects a guest\'s move, unlock and deletion of a shape the facilitator locked, hands back the stored copy, and accepts them once the facilitator unlocked it', function () {
    ['board' => $board, 'fran' => $fran] = p17cBoard();

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

    $shape = $this->addWhiteboardElement($franPage, $board, ['x' => 250, 'y' => 300, 'locked' => true]);

    $this->awaitWhiteboardElements($guestPage, 1);

    $unlock = $this->writeWhiteboardElements($guestPage, $board, [[...$shape, 'locked' => false, 'version' => 2, 'versionNonce' => 4242, 'x' => 900]]);
    $delete = $this->writeWhiteboardElements($guestPage, $board, [[...$shape, 'isDeleted' => true, 'version' => 2, 'versionNonce' => 4243]]);
    $forged = $this->writeWhiteboardElements($guestPage, $board, [sceneElement(['id' => 'p17cGuestLock', 'index' => 'a5', 'locked' => true])]);

    expect($unlock['status'])->toBe(200)
        ->and($unlock['body']['seq'])->toBe($unlock['body']['fromSeq'])
        ->and($unlock['body']['rejected'])->toHaveCount(1)
        ->and($unlock['body']['rejected'][0]['id'])->toBe($shape['id'])
        ->and($unlock['body']['rejected'][0]['reason'])->toBe('locked')
        ->and($unlock['body']['rejected'][0]['element']['x'])->toBe(250)
        ->and($unlock['body']['rejected'][0]['element']['version'])->toBe(1)
        ->and($unlock['body']['rejected'][0]['element']['locked'])->toBeTrue()
        ->and($delete['status'])->toBe(200)
        ->and($delete['body']['rejected'][0]['reason'])->toBe('locked')
        ->and($delete['body']['rejected'][0]['element']['isDeleted'])->toBeFalse()
        ->and($forged['status'])->toBe(200)
        ->and($forged['body']['rejected'][0]['reason'])->toBe('locked')
        ->and($forged['body']['rejected'][0]['element'])->toBeNull();

    $stored = WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole();

    expect($stored->version)->toBe(1)
        ->and($stored->is_deleted)->toBeFalse()
        ->and($stored->data['x'])->toBe(250)
        ->and($stored->data['locked'])->toBeTrue()
        ->and($board->fresh()->seq)->toBe(1);

    $guestPage->assertPresent('[data-realtime="connected"]')
        ->assertNotPresent(P17cLockedNotice);

    $released = $this->writeWhiteboardElements($franPage, $board, [[...$shape, 'locked' => false, 'version' => 2, 'versionNonce' => 7001]]);
    $moved = $this->writeWhiteboardElements($guestPage, $board, [[...$shape, 'locked' => false, 'version' => 3, 'versionNonce' => 4244, 'x' => 900]]);

    expect($released['body']['rejected'])->toBeArray()->toBeEmpty()
        ->and($moved['status'])->toBe(200)
        ->and($moved['body']['rejected'])->toBeArray()->toBeEmpty();

    $this->awaitWhiteboardScene($guestPage, $board);
    $this->awaitWhiteboardScene($franPage, $board);

    $stored->refresh();

    expect($stored->version)->toBe(3)
        ->and($stored->data['x'])->toBe(900)
        ->and($stored->data['locked'])->toBeFalse();
});

it('[P17c-03b] lets the facilitator lock a shape from the canvas menu, hides the lock entry from a guest, and puts the shape back when the guest deletes it', function () {
    ['board' => $board, 'fran' => $fran] = p17cBoard();
    $lockEntry = '.whiteboard-canvas .context-menu li[data-testid="toggleElementLock"]';
    $lockEntryDisplay = "getComputedStyle(document.querySelector('{$lockEntry}')).display";
    $versions = "document.querySelector('[data-scene]').dataset.scene.split(':')[1]";

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

    $shape = $this->addWhiteboardElement($franPage, $board, [
        'x' => 500,
        'y' => 250,
        'width' => 700,
        'height' => 500,
        'backgroundColor' => '#a5d8ff',
        'roughness' => 0,
    ]);

    $this->awaitWhiteboardElements($franPage, 1);
    $this->awaitWhiteboardElements($guestPage, 1);

    $franPage->rightClick(P17cCanvas)
        ->assertPresent($lockEntry)
        ->assertScript("{$lockEntryDisplay} != 'none'", true)
        ->click("{$lockEntry} button")
        ->assertNotPresent('.whiteboard-canvas .context-menu')
        ->assertScript($versions, '2');

    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    $locked = WhiteboardElement::query()->where('element_id', $shape['id'])->sole();

    expect($locked->data['locked'])->toBeTrue()
        ->and($locked->version)->toBe(2);

    $guestPage->assertAttribute('.whiteboard-canvas', 'data-facilitator', 'false')
        ->rightClick(P17cCanvas)
        ->assertPresent($lockEntry)
        ->assertScript($lockEntryDisplay, 'none')
        ->click('.whiteboard-canvas .context-menu li[data-testid="deleteSelectedElements"] button')
        ->assertPresent('[data-sonner-toast]:has-text("Only the facilitator can change a locked element.")');

    $this->awaitWhiteboardElements($guestPage, 1);
    $this->awaitWhiteboardScene($guestPage, $board);
    $this->awaitWhiteboardElements($franPage, 1);

    $locked->refresh();

    expect($locked->is_deleted)->toBeFalse()
        ->and($locked->version)->toBe(2)
        ->and($locked->data['locked'])->toBeTrue()
        ->and($this->whiteboardElements($guestPage, $board))->toHaveCount(1);

    $franPage->rightClick(P17cCanvas)
        ->assertPresent($lockEntry)
        ->assertSeeIn($lockEntry, 'Unlock')
        ->click("{$lockEntry} button")
        ->assertScript($versions, '3');

    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    expect($locked->refresh()->data['locked'])->toBeFalse();
});
```

- [ ] **Step 6: Run the element lock tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php --filter='P17c-03'`

Expected: PASS; a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If this fails in the canvas menu, see the harness findings.

`[P17c-03b]` opens the canvas context menu with `rightClick()`. If the click is refused or the menu does not open, apply the replacement given for `[P17c-02d]` in Step 4 (a dispatched `contextmenu` event at the middle of the canvas). If the menu still does not open, delete `[P17c-03b]`, set its coverage row to `residual` with `(none)` as test file, and add this entry to the residual checklist: "**P17c-03b** — "A locks a shape (context menu). B right-clicks it: no Lock / Unlock entry; B deletes the shape: it returns and the toast "Only the facilitator can change a locked element." shows. A still sees the entries". Not automated: the canvas context menu could not be opened from a test; `[P17c-03a]` proves the server's rejection and the stored copy it hands back. Check by hand: as the facilitator, lock a shape from its context menu; as a guest, right-click it: no lock entry; choose Delete: the shape comes back with the toast."

- [ ] **Step 7: Run the tests of this task together**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php`

Expected: PASS, 10 tests (fewer if a canvas test was removed in Step 4 or Step 6).

- [ ] **Step 8: Format and check**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue, and no import removed (every import of Step 3 is used).

Run: `composer rector:check`
Expected: no change proposed for the test file. If it proposes one, run `composer rector` and run the file again.

Run: `vendor/bin/pest tests/Arch`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php
git commit -m "test(browser): automate the timer and lock checks of the whiteboard facilitation walkthrough (plan 17c)"
```

### Task 6: Whiteboard facilitation walkthrough (plan 17c): follow-me, hand-over, reactions, regression

This task automates section 4 of `docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md` (F4.1, F4.2, B6.1 to B6.7), its lines B5.7, B7.12 and G5, and the reaction part of B5.3. Sections 5, 6 and 7 of the walkthrough describe dot voting, which was removed on 2026-10-01: they get no test (see "Removed sections").

Facts read from the current code that the tests rely on:

- Follow-me (`resources/js/hooks/use-whiteboard-follow.ts`, `board.tsx`): `PATCH settings` with `{follow_enabled}` (button `[aria-label="Bring everyone to me"]`, `aria-pressed`) is broadcast as `board.changed`. While it is on, the facilitator's page whispers its view (`viewport`) on every change of scroll or zoom, at most every 100 ms, and again every 2 seconds; whispers never reach the server. Every other page fits that rectangle into its own canvas (`zoom = min(own width / rectangle width, own height / rectangle height)`), and a change of its own scroll or zoom that is not the one it just applied pauses it. The status row (`div[role="status"]`) says `Everyone follows your view.` to the facilitator, `Following the facilitator` to a follower, and `Following paused` with a `Resume` button to a paused follower.
- The one effect of following that the page exposes without a hook is the canvas's zoom: Excalidraw 0.18.1 writes it in the footer button `.reset-zoom-button` as `(zoom * 100).toFixed(0) + "%"`, next to `.zoom-in-button` and `.zoom-out-button` (steps of 10 %), and the footer's zoom buttons stay in view mode. The tests therefore make the facilitator zoom with the canvas's own button and read the follower's zoom label; a follower pauses by clicking its own zoom button. With equal windows the follower's zoom equals the facilitator's; with a narrower window it is the ratio the hook computes, which `[P17c-04d]` calculates from the two canvas sizes. A pan changes only the scroll position, which nothing in the page exposes: following a pan is residual.
- A change of facilitator (`WhiteboardFacilitatorsController`) switches `follow_enabled` off. The facilitator hands over from the board menu ("Hand over facilitation" opens a dialog with the select `#whiteboard-new-facilitator` and the button "Hand over", disabled until a choice is made; with no candidate it says `No one else can facilitate this board yet.`). The candidates (`me.transferCandidates` of the snapshot) are the team's members and the workspace's Owners and Admins, by name, the viewer excepted; a guest is never one. A signed-in member who is not the facilitator has "Take control" in the board menu; a guest has neither entry, and a guest's `PUT facilitator` answers 403.
- A workspace made by `Team::factory()` has no member of its own, and `whiteboardFacilitator()` adds one team member: on a board made by `p17cBoard()` alone, nobody else can facilitate.
- Reactions (`board-reactions.tsx`, `resources/js/components/realtime/flying-reactions.tsx`): the bar `.whiteboard-reactions[role="toolbar"][aria-label="Reactions"]` and the flying layer `.lr-overlay` are mounted while the board's `reactionsEnabled` is on, whatever the lock; the facilitator's board menu has the switch "Show flying reactions".
- Duplicate (`DuplicateWhiteboard`, `CreateWhiteboard`): the copy is a new board titled `<title> (copy)` whose facilitator is the person who duplicated; it is created with the default `locked`, `follow_enabled` and `timer_ends_at`, and the elements are copied with their own `locked` flag.

No product file changes in this task.

**Files:**
- Modify: `tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php`
- Test: `tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php`

**Interfaces:**
- Consumes:
  - Task 1: `data-realtime` and `data-scene` on the board root; `$this->whiteboardSnapshot()`, `$this->addWhiteboardElement()`, `$this->awaitWhiteboardElements()`, `$this->awaitWhiteboardScene()`.
  - Task 5: `p17cRenamed()`, `p17cBoard()`, `p17cBoardPath()`, `p17cJoinPath()`, `p17cSend()`, `p17cPause()`, the constants `P17cTools`, `P17cLockedNotice`, `P17cViewMode`.
  - `Tests\BrowserTestCase`: `$this->signIn()`, `$this->joinAsGuest()`, `$this->awaitRealtime()`.
  - `tests/Pest.php`: `whiteboardMember(Whiteboard $board): array{0: User, 1: WhiteboardMember}`, `workspaceManager(Workspace $workspace, WorkspaceRole $role = WorkspaceRole::Admin): User`.
  - Paths: `PUT /whiteboards/{board}/facilitator`, `GET /whiteboards/{board}/snapshot`.
- Produces:
  - File-level helper `p17cOpenBoardMenu(mixed $page): mixed`.
  - Constants: `P17cLeadingNotice`, `P17cFollowingNotice`, `P17cPausedNotice`, `P17cResume`, `P17cFollowSwitch`, `P17cZoomLabel`, `P17cZoomIn`, `P17cZoomOut`.

- [ ] **Step 1: Add the follow-me constants, the menu helper and the follow-me tests**

In `tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php`, add these constants after the line `const P17cCanvas = …;`:

```php
const P17cLeadingNotice = 'div[role="status"]:has-text("Everyone follows your view.")';
const P17cFollowingNotice = 'div[role="status"]:has-text("Following the facilitator")';
const P17cPausedNotice = 'div[role="status"]:has-text("Following paused")';
const P17cResume = 'div[role="status"] button:text-is("Resume")';
const P17cFollowSwitch = '[aria-label="Bring everyone to me"]';
const P17cZoomLabel = '.whiteboard-canvas .reset-zoom-button';
const P17cZoomIn = '.whiteboard-canvas .zoom-in-button';
const P17cZoomOut = '.whiteboard-canvas .zoom-out-button';
```

Add this helper after `p17cTimerSeconds()`:

```php
function p17cOpenBoardMenu(mixed $page): mixed
{
    $page->assertNotPresent('[role="menu"]')
        ->click('[aria-label="Board menu"]')
        ->assertPresent('[role="menu"]');

    return $page;
}
```

Append these tests to the file:

```php
it('[P17c-04a] brings a guest to the facilitator\'s zoom, pauses the guest who zooms without moving the facilitator, and resumes at the facilitator\'s current view', function () {
    ['board' => $board, 'fran' => $fran] = p17cBoard();

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

    foreach ([$franPage, $guestPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertSeeIn(P17cZoomLabel, '100%')
            ->assertNotPresent('div[role="status"]');
    }

    $franPage->click(P17cFollowSwitch)
        ->assertAriaAttribute(P17cFollowSwitch, 'pressed', 'true')
        ->assertPresent(P17cLeadingNotice);

    $guestPage->assertPresent(P17cFollowingNotice)
        ->assertNotPresent(P17cPausedNotice);

    expect($board->fresh()->follow_enabled)->toBeTrue()
        ->and($this->whiteboardSnapshot($guestPage, $board)['board']['followEnabled'])->toBeTrue();

    $franPage->click(P17cZoomIn)
        ->assertSeeIn(P17cZoomLabel, '110%');

    $guestPage->assertSeeIn(P17cZoomLabel, '110%');

    p17cPause($guestPage, 2400);

    $guestPage->assertPresent(P17cFollowingNotice)
        ->assertNotPresent(P17cPausedNotice)
        ->assertSeeIn(P17cZoomLabel, '110%');

    $guestPage->click(P17cZoomOut)
        ->assertSeeIn(P17cZoomLabel, '100%')
        ->assertPresent(P17cPausedNotice)
        ->assertPresent(P17cResume)
        ->assertNotPresent(P17cFollowingNotice);

    p17cPause($franPage, 800);

    $franPage->assertSeeIn(P17cZoomLabel, '110%')
        ->assertPresent(P17cLeadingNotice)
        ->assertNotPresent(P17cPausedNotice);

    $franPage->click(P17cZoomIn)
        ->assertSeeIn(P17cZoomLabel, '120%');

    p17cPause($guestPage, 2400);

    $guestPage->assertSeeIn(P17cZoomLabel, '100%')
        ->assertPresent(P17cPausedNotice);

    $guestPage->click(P17cResume)
        ->assertSeeIn(P17cZoomLabel, '120%')
        ->assertPresent(P17cFollowingNotice)
        ->assertNotPresent(P17cResume);

    $franPage->assertSeeIn(P17cZoomLabel, '120%');
});

it('[P17c-04b] brings a guest who joins while follow-me is on to the facilitator\'s view, and frees everyone when it is switched off', function () {
    ['board' => $board, 'fran' => $fran] = p17cBoard(['follow_enabled' => true]);

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));

    $franPage->assertPresent(P17cLeadingNotice)
        ->assertAriaAttribute(P17cFollowSwitch, 'pressed', 'true')
        ->click(P17cZoomIn)
        ->assertSeeIn(P17cZoomLabel, '110%')
        ->click(P17cZoomIn)
        ->assertSeeIn(P17cZoomLabel, '120%');

    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

    $guestPage->assertPresent(P17cFollowingNotice)
        ->assertSeeIn(P17cZoomLabel, '120%')
        ->assertNotPresent(P17cPausedNotice);

    $franPage->click(P17cFollowSwitch)
        ->assertAriaAttribute(P17cFollowSwitch, 'pressed', 'false')
        ->assertNotPresent('div[role="status"]');

    $guestPage->assertNotPresent('div[role="status"]');

    $guestPage->click(P17cZoomOut)
        ->assertSeeIn(P17cZoomLabel, '110%');

    p17cPause($guestPage, 800);

    $guestPage->assertNotPresent('div[role="status"]')
        ->assertSeeIn(P17cZoomLabel, '110%');

    $franPage->assertSeeIn(P17cZoomLabel, '120%');

    expect($board->fresh()->follow_enabled)->toBeFalse()
        ->and($this->whiteboardSnapshot($guestPage, $board)['board']['followEnabled'])->toBeFalse();
});

it('[P17c-04c] lets a guest in view mode on a locked board follow the facilitator, pause by zooming and resume', function () {
    ['board' => $board, 'fran' => $fran] = p17cBoard(['locked' => true, 'follow_enabled' => true]);

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

    $guestPage->assertPresent(P17cViewMode)
        ->assertPresent(P17cLockedNotice)
        ->assertPresent(P17cFollowingNotice);

    $franPage->click(P17cZoomIn)
        ->assertSeeIn(P17cZoomLabel, '110%');

    $guestPage->assertSeeIn(P17cZoomLabel, '110%')
        ->assertNotPresent(P17cPausedNotice);

    $guestPage->click(P17cZoomOut)
        ->assertSeeIn(P17cZoomLabel, '100%')
        ->assertPresent(P17cPausedNotice)
        ->assertPresent(P17cLockedNotice);

    $guestPage->click(P17cResume)
        ->assertSeeIn(P17cZoomLabel, '110%')
        ->assertPresent(P17cFollowingNotice)
        ->assertPresent(P17cViewMode);

    $franPage->assertSeeIn(P17cZoomLabel, '110%');
});

it('[P17c-04d] zooms a follower with a narrower window out until the facilitator\'s view fits in it', function () {
    ['board' => $board, 'fran' => $fran] = p17cBoard(['follow_enabled' => true]);
    $size = '() => { const box = document.querySelector(".whiteboard-canvas").getBoundingClientRect(); return JSON.stringify([box.width, box.height]); }';

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

    $guestPage->assertPresent(P17cFollowingNotice)
        ->assertSeeIn(P17cZoomLabel, '100%');

    $guestPage->resize(900, 1117)
        ->assertScript('window.innerWidth', 900);

    [$franWidth, $franHeight] = json_decode((string) $franPage->script($size), true);
    [$guestWidth, $guestHeight] = json_decode((string) $guestPage->script($size), true);
    $fitted = min($guestWidth / $franWidth, $guestHeight / $franHeight);

    expect($fitted)->toBeGreaterThan(0.3)->toBeLessThan(0.6);

    $guestPage->assertSeeIn(P17cZoomLabel, number_format($fitted * 100).'%')
        ->assertPresent(P17cFollowingNotice)
        ->assertNotPresent(P17cPausedNotice);

    $franPage->assertSeeIn(P17cZoomLabel, '100%');
});
```

- [ ] **Step 2: Run the follow-me tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php --filter='P17c-04'`

Expected: PASS; a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. If this fails, see the harness findings. Two readings of a failure:

- The follower shows `Following paused` without having been touched (`[P17c-04a]`, after the first pause of 2.4 seconds): this is the defect line B6.1 of the walkthrough warns about (the canvas does not report back exactly the numbers it was given). Follow the Defect rule.
- The follower's label is one point away from the facilitator's (for example `109%`): the two canvases do not have the same size (a top bar or a status row of a different height). Replace the exact label of the follower by a computed one, as `[P17c-04d]` does, in the test that fails.

- [ ] **Step 3: Add the hand-over tests**

Append these tests to the file:

```php
it('[P17c-05a] lists the team members and the workspace admins in the hand-over dialog, hands facilitation over without a reload, switches follow-me off at each change, and lets the former facilitator take control back', function () {
    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = p17cBoard();
    [$max, $maxMember] = whiteboardMember($board);
    p17cRenamed($max, 'Max Member');
    p17cRenamed(workspaceManager($board->team->workspace), 'Ada Admin');
    $handOver = '[role="dialog"] button:text-is("Hand over")';

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $maxPage = $this->awaitRealtime($this->signIn($max, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

    $franPage->assertPresent('[role="group"][aria-label="3 online"]')
        ->click(P17cFollowSwitch)
        ->assertPresent(P17cLeadingNotice);

    $maxPage->assertPresent(P17cFollowingNotice)
        ->assertNotPresent(P17cTools);

    p17cOpenBoardMenu($franPage)
        ->assertNotPresent('[role="menuitem"]:has-text("Take control")')
        ->click('[role="menuitem"]:has-text("Hand over facilitation")')
        ->assertPresent('[role="dialog"] #whiteboard-new-facilitator')
        ->assertDisabled($handOver)
        ->click('#whiteboard-new-facilitator')
        ->assertPresent('[role="listbox"]');

    $offered = json_decode((string) $franPage->script('() => JSON.stringify(Array.from(document.querySelectorAll(\'[role="listbox"] [role="option"]\')).map((option) => option.textContent.trim()))'), true);
    $candidates = array_column($this->whiteboardSnapshot($franPage, $board)['me']['transferCandidates'], 'name');

    expect($offered)->toBe(['Ada Admin', 'Max Member'])
        ->and($candidates)->toBe(['Ada Admin', 'Max Member'])
        ->and($this->whiteboardSnapshot($guestPage, $board)['me']['transferCandidates'])->toBeArray()->toBeEmpty();

    $franPage->click('[role="option"]:has-text("Max Member")')
        ->assertNotPresent('[role="listbox"]')
        ->click($handOver)
        ->assertNotPresent('[role="dialog"]')
        ->assertNotPresent(P17cTools)
        ->assertNotPresent('div[role="status"]');

    $maxPage->assertPresent(P17cTools)
        ->assertAriaAttribute(P17cFollowSwitch, 'pressed', 'false')
        ->assertNotPresent('div[role="status"]');

    $afterHandOver = $this->whiteboardSnapshot($guestPage, $board)['board'];

    expect($board->fresh()->facilitator_member_id)->toBe($maxMember->id)
        ->and($board->fresh()->follow_enabled)->toBeFalse()
        ->and($afterHandOver['facilitatorMemberId'])->toBe($maxMember->id)
        ->and($afterHandOver['followEnabled'])->toBeFalse();

    $maxPage->click(P17cFollowSwitch)
        ->assertPresent(P17cLeadingNotice);

    $franPage->assertPresent(P17cFollowingNotice);
    $guestPage->assertPresent(P17cFollowingNotice);

    p17cOpenBoardMenu($franPage)
        ->assertNotPresent('[role="menuitem"]:has-text("Hand over facilitation")')
        ->click('[role="menuitem"]:has-text("Take control")')
        ->assertNotPresent('[role="menu"]')
        ->assertPresent(P17cTools)
        ->assertAriaAttribute(P17cFollowSwitch, 'pressed', 'false')
        ->assertNotPresent('div[role="status"]');

    $maxPage->assertNotPresent(P17cTools)
        ->assertNotPresent('div[role="status"]');

    $guestPage->assertNotPresent('div[role="status"]');

    $afterTakeOver = $this->whiteboardSnapshot($guestPage, $board)['board'];

    expect($board->fresh()->facilitator_member_id)->toBe($franMember->id)
        ->and($board->fresh()->follow_enabled)->toBeFalse()
        ->and($afterTakeOver['facilitatorMemberId'])->toBe($franMember->id)
        ->and($afterTakeOver['followEnabled'])->toBeFalse();
});

it('[P17c-05b] says that no one else can facilitate when the facilitator is alone in the team, and never offers or allows facilitation to a guest', function () {
    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = p17cBoard();

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

    p17cOpenBoardMenu($franPage)
        ->click('[role="menuitem"]:has-text("Hand over facilitation")')
        ->assertSeeIn('[role="dialog"]', 'No one else can facilitate this board yet.')
        ->assertNotPresent('[role="dialog"] #whiteboard-new-facilitator')
        ->assertNotPresent('[role="dialog"] button:text-is("Hand over")')
        ->click('[role="dialog"] button:text-is("Cancel")')
        ->assertNotPresent('[role="dialog"]')
        ->assertPresent(P17cTools);

    p17cOpenBoardMenu($guestPage)
        ->assertPresent('[role="menuitemcheckbox"]:has-text("Hide my cursor")')
        ->assertCount('[role="menu"] [role="menuitem"]', 0)
        ->assertDontSeeIn('[role="menu"]', 'Take control')
        ->assertDontSeeIn('[role="menu"]', 'Hand over facilitation');

    $attempt = p17cSend($guestPage, 'PUT', "/whiteboards/{$board->id}/facilitator", ['user_id' => $fran->id]);

    expect($attempt['status'])->toBe(403)
        ->and($attempt['body']['message'])->toBe('Only the facilitator can do this.')
        ->and($board->fresh()->facilitator_member_id)->toBe($franMember->id)
        ->and($this->whiteboardSnapshot($guestPage, $board)['me']['canTakeControl'])->toBeFalse();
});
```

- [ ] **Step 4: Run the hand-over tests**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php --filter='P17c-05'`

Expected: PASS; a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule.

- [ ] **Step 5: Add the reactions, branding and duplicate tests**

Append these tests to the file:

```php
it('[P17c-06] flies reactions both ways on a locked board with the sender\'s name, and removes the bar for everyone when the facilitator switches reactions off', function () {
    ['board' => $board, 'fran' => $fran] = p17cBoard(['locked' => true]);
    $bar = '.whiteboard-reactions[role="toolbar"][aria-label="Reactions"]';

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

    foreach ([$franPage, $guestPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent($bar);
    }

    $guestPage->assertPresent(P17cViewMode)
        ->assertPresent(P17cLockedNotice)
        ->click('[aria-label="Send a reaction ❤️"]');

    $franPage->assertSeeIn('.lr-overlay', '❤️')
        ->assertSeeIn('.lr-overlay', 'Guest Gia');

    $franPage->click('[aria-label="Send a reaction 🎉"]');

    $guestPage->assertSeeIn('.lr-overlay', '🎉')
        ->assertSeeIn('.lr-overlay', 'Fran Facilitator');

    p17cOpenBoardMenu($franPage)
        ->assertAriaAttribute('[role="menuitemcheckbox"]:has-text("Show flying reactions")', 'checked', 'true')
        ->click('[role="menuitemcheckbox"]:has-text("Show flying reactions")');

    $guestPage->assertNotPresent($bar)
        ->assertPresent(P17cLockedNotice);

    $franPage->assertNotPresent($bar);

    expect($board->fresh()->reactions_enabled)->toBeFalse()
        ->and($board->fresh()->locked)->toBeTrue();
});

it('[P17c-07] names no canvas library and shows no outbound link on a board with the timer, the lock and follow-me in use', function () {
    ['board' => $board, 'fran' => $fran] = p17cBoard(['locked' => true, 'follow_enabled' => true, 'timer_ends_at' => now()->addMinutes(5)]);
    $scan = '() => { const words = [document.body.innerText, ...Array.from(document.querySelectorAll("[aria-label], [title]")).flatMap((node) => [node.getAttribute("aria-label") ?? "", node.getAttribute("title") ?? ""])].join("\n").toLowerCase(); const links = Array.from(document.querySelectorAll("a[href]")).filter((link) => link.getClientRects().length > 0 && new URL(link.href, location.href).origin !== location.origin).length; return JSON.stringify({ named: words.includes("excalidraw"), links }); }';

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

    $franPage->assertPresent(P17cLeadingNotice)
        ->assertPresent('[role="timer"]')
        ->click('[aria-label="Timer"]')
        ->assertPresent('[role="menuitem"]:has-text("Stop timer")');

    $guestPage->assertPresent(P17cLockedNotice)
        ->assertPresent(P17cFollowingNotice)
        ->assertPresent('[role="timer"]');

    expect(json_decode((string) $franPage->script($scan), true))->toBe(['named' => false, 'links' => 0])
        ->and(json_decode((string) $guestPage->script($scan), true))->toBe(['named' => false, 'links' => 0]);
});

it('[P17c-08] duplicates a locked board with a running timer and follow-me into a copy that has none of them, and keeps a locked shape locked', function () {
    ['board' => $board, 'fran' => $fran] = p17cBoard(['locked' => true, 'follow_enabled' => true, 'timer_ends_at' => now()->addMinutes(5)]);

    $page = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));

    $shape = $this->addWhiteboardElement($page, $board, ['x' => 300, 'y' => 300, 'locked' => true]);

    $this->awaitWhiteboardElements($page, 1);

    $page->assertPresent('[role="timer"]')
        ->assertAriaAttribute('[aria-label="Unlock the board"]', 'pressed', 'true')
        ->assertAriaAttribute(P17cFollowSwitch, 'pressed', 'true');

    p17cOpenBoardMenu($page)
        ->click('[role="menuitem"]:has-text("Duplicate this board")')
        ->assertSeeIn('header > h1', 'Sprint board (copy)');

    $copy = Whiteboard::query()->where('title', 'Sprint board (copy)')->sole();

    $this->awaitRealtime($page);
    $this->awaitWhiteboardElements($page, 1);

    $page->assertPathIs(p17cBoardPath($copy))
        ->assertNotPresent('[role="timer"]')
        ->assertNotPresent('div[role="status"]')
        ->assertAriaAttribute('[aria-label="Lock the board"]', 'pressed', 'false')
        ->assertAriaAttribute(P17cFollowSwitch, 'pressed', 'false');

    $copied = WhiteboardElement::query()->where('whiteboard_id', $copy->id)->sole();
    $snapshot = $this->whiteboardSnapshot($page, $copy);

    expect($copy->id)->not->toBe($board->id)
        ->and($copy->locked)->toBeFalse()
        ->and($copy->follow_enabled)->toBeFalse()
        ->and($copy->timer_ends_at)->toBeNull()
        ->and($copied->element_id)->not->toBe($shape['id'])
        ->and($copied->data['locked'])->toBeTrue()
        ->and($snapshot['me']['isFacilitator'])->toBeTrue()
        ->and($snapshot['board']['timerEndsAt'])->toBeNull()
        ->and($board->fresh()->locked)->toBeTrue()
        ->and($board->fresh()->timer_ends_at)->not->toBeNull();
});
```

- [ ] **Step 6: Run the tests of Step 5**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php --filter='P17c-0[678]'`

Expected: PASS; a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. In `[P17c-07]`, `named: true` means that a text, an `aria-label` or a `title` of the board page contains the canvas library's name: find it with `document.body.innerText` in the failure screenshot's page and follow the Defect rule. In `[P17c-08]`, if the copy keeps the element's id, remove the single assertion on `element_id` (the walkthrough does not ask for a new id).

- [ ] **Step 7: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php`

Expected: PASS, 19 tests (fewer if a canvas test of Task 5 was removed). The file takes about 70 seconds.

- [ ] **Step 8: Format and check**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue, and no import removed.

Run: `composer rector:check`
Expected: no change proposed for the test file. If it proposes one, run `composer rector` and run the file again.

Run: `vendor/bin/pest tests/Arch`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php
git commit -m "test(browser): automate follow-me, the hand-over and the regression checks of the whiteboard facilitation walkthrough (plan 17c)"
```

### Task 7: Whiteboard secrecy and history walkthrough (plan 17d): what is left of it

This task automates what still applies of `docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md`. Almost everything in that walkthrough describes features the product owner removed on 2026-10-01: private writing (sections 1 to 4), version history (sections 5 to 7) and dot voting (one regression line). The walkthrough says so itself at line 3: "Nothing of this walkthrough applies any more except "Regression of 17a to 17c basics", minus its lines about votes, hidden notes and versions." The current code confirms it (see `## Removed sections`). The task is therefore small: six tests, one commit, no Task 7b.

What is kept and how it is proven:

- Line 38, "A board is created from the team page": `[P17d-00a]`, through the real dialog with the Blank template.
- Lines 39 and 40, "A rectangle and a sticky note are drawn" and "A second participant sees them": `[P17d-00b]`. The walkthrough had no second participant (line 11) and left line 40 unticked; the test has one, a guest who joined through the guest link. The sticky note goes through the sticky tool of the interface. The rectangle is written through the real write endpoint from the facilitator's page, not dragged on the canvas: drawing with the pointer is proven once, by `[P17a-02b]`, and this line is a regression check of that same behaviour. The guest's receipt is proven three ways: the guest's canvas (`data-scene`), the snapshot the server sends to the guest, and the database.
- Line 41, "A reload keeps the scene with no write-back": `[P17d-00d]`, with the same reading of the page's Resource Timing entries as `[P17a-04]` (a write is a request whose path ends in `/elements` with no query string) and the board's `seq` unchanged in the database.
- Lines 42 and 43, "The reactions bar is present" and "No canvas-library branding is visible": `[P17d-00e]`. The walkthrough looked for the library's name in the text, the `aria-label`s, the `title`s and the links of the board page, and for outbound links; the test does the same from a script. The history sheet and the preview dialog that the line also names no longer exist.
- Line 45, "Lock and unlock": `[P17d-00g]`, with the top-bar button, the snapshot's `locked` flag and the button's label, as the walkthrough did. The walkthrough could not see what a non-facilitator can do on a locked board; the test has a second member, proves that this member's own snapshot says `locked`, that the member's write is refused, and that it is accepted again after the unlock.
- Line 119 (inside removed section 7): "the guest's change of the settings (`PATCH settings`) answered 403". The settings endpoint still exists and still refuses a guest: `[P17d-07a]`. Today's message is "Only the facilitator can do this." (`WhiteboardGuard::facilitator()`, the only guard of `WhiteboardSettingsController::update()`), not "Guests cannot do this." as that line's neighbours read for the version endpoints.

Facts read from the current code that the selectors rely on:

- Facilitator tools (`resources/js/components/whiteboard/facilitator-bar.tsx`): the lock button is a `<button>` whose `aria-label` is "Lock the board" with `aria-pressed="false"`, or "Unlock the board" with `aria-pressed="true"`. A click sends `PATCH /whiteboards/{board}/settings` with `{"locked": true|false}` and then refetches the snapshot; the other pages refetch on the `WhiteboardChanged` broadcast.
- A non-facilitator on a locked board (`board.tsx`): the status row shows "This board is locked." and the canvas is in view mode. A write to a locked board from a non-facilitator answers 403 with `{"message": "This board is locked.", "errors": {"locked": ["This board is locked."]}}` (`WhiteboardGuard::notLocked()`); the facilitator's writes are accepted.
- Settings (`app/Http/Controllers/Whiteboards/WhiteboardSettingsController.php`): `PATCH /whiteboards/{board}/settings` answers 204 to the facilitator and 403 `{"message": "Only the facilitator can do this."}` to anyone else. Its keys are `title`, `guest_access_enabled`, `cursors_enabled`, `reactions_enabled`, `locked`, `follow_enabled`.
- Snapshot for a guest (`app/Actions/Whiteboards/BuildWhiteboardSnapshot.php`): `me.isGuest` true, `me.isFacilitator` false, `board.guestUrl` null, `links.team` null.
- Team page, board top bar, sticky tool and reactions bar: as described in Task 2 (same selectors).

No product file changes in this task. No new hook.

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan17dWhiteboardSecrecyTest.php`
- Test: `tests/Browser/Walkthroughs/Plan17dWhiteboardSecrecyTest.php`

**Interfaces:**
- Consumes:
  - Task 1: `data-realtime` and `data-scene` on the board root; `$this->whiteboardSnapshot()`, `$this->whiteboardElements()`, `$this->writeWhiteboardElements()`, `$this->addWhiteboardElement()`, `$this->addWhiteboardSticky()`, `$this->awaitWhiteboardElements()`, `$this->awaitWhiteboardScene()`, `$this->whiteboardSceneStamp()`. None of the three canvas-driving methods is used, so this task does not depend on the outcome of Task 1, Step 9.
  - `Tests\BrowserTestCase`: `$this->signIn()`, `$this->joinAsGuest()`, `$this->awaitRealtime()`, `$this->awaitResync()`.
  - `tests/Pest.php`: `teamMember(Team $team): User`, `whiteboardMember(Whiteboard $board): array{0: User, 1: WhiteboardMember}`, `whiteboardFacilitator(Whiteboard $board): array{0: User, 1: WhiteboardMember}`, `sceneElement(array $overrides = []): array`.
  - Factories: `WhiteboardFactory::withGuestAccess()`, `TeamFactory`.
- Produces:
  - File-level helpers in `tests/Browser/Walkthroughs/Plan17dWhiteboardSecrecyTest.php` (global functions; other files must not redeclare them): `p17dRenamed(User $user, string $name): User`, `p17dBoard(array $attributes = []): array{board: Whiteboard, fran: User, franMember: WhiteboardMember}`, `p17dBoardPath(Whiteboard $board): string`, `p17dJoinPath(Whiteboard $board): string`, `p17dElementWrites(): string`, `p17dDeltaFetched(): string`, `p17dLibraryNamed(): string`, `p17dPatchSettings(mixed $page, Whiteboard $board, array $settings): array{status: int, body: array<string, mixed>}`.

- [ ] **Step 1: Create the test file with its helpers and the tests of the regression lines about the scene**

Create `tests/Browser/Walkthroughs/Plan17dWhiteboardSecrecyTest.php` directly with this content:

```php
<?php

use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;

function p17dRenamed(User $user, string $name): User
{
    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return $user;
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     board: Whiteboard,
 *     fran: User,
 *     franMember: WhiteboardMember
 * }
 */
function p17dBoard(array $attributes = []): array
{
    $board = Whiteboard::factory()->withGuestAccess()->create(['title' => 'Sprint board', ...$attributes]);
    [$fran, $franMember] = whiteboardFacilitator($board);

    return [
        'board' => $board,
        'fran' => p17dRenamed($fran, 'Fran Facilitator'),
        'franMember' => $franMember,
    ];
}

function p17dBoardPath(Whiteboard $board): string
{
    return "/whiteboards/{$board->id}";
}

function p17dJoinPath(Whiteboard $board): string
{
    return "/whiteboards/join/{$board->fresh()->guest_token}";
}

function p17dElementWrites(): string
{
    return "performance.getEntriesByType('resource').filter((entry) => new URL(entry.name).pathname.endsWith('/elements') && new URL(entry.name).search === '').length";
}

function p17dDeltaFetched(): string
{
    return "performance.getEntriesByType('resource').some((entry) => entry.name.includes('/elements?since=') && entry.responseEnd > 0)";
}

it('[P17d-00a] creates a board from the team page with the Blank template and lands on it as its facilitator', function () {
    $team = Team::factory()->create();
    $fran = p17dRenamed(teamMember($team), 'Fran Facilitator');

    $page = $this->signIn($fran, route('teams.show', [$team->workspace, $team], false));

    $page->click('New whiteboard')
        ->assertPresent('[role="dialog"] #whiteboard-title')
        ->assertPresent('[role="dialog"] [role="radio"][aria-checked="true"]')
        ->fill('#whiteboard-title', 'Walkthrough 17d')
        ->click('[role="dialog"] form button:text-is("Create")')
        ->assertPathBeginsWith('/whiteboards/');

    $board = Whiteboard::query()->where('title', 'Walkthrough 17d')->sole();

    $this->awaitRealtime($page);
    $this->awaitWhiteboardElements($page, 0);

    $page->assertPathIs(p17dBoardPath($board))
        ->assertSeeIn('header > h1', 'Walkthrough 17d')
        ->assertPresent('[role="toolbar"][aria-label="Facilitation tools"]');

    $snapshot = $this->whiteboardSnapshot($page, $board);

    expect($snapshot['me']['isFacilitator'])->toBeTrue()
        ->and($snapshot['board']['facilitatorMemberId'])->toBe($snapshot['me']['id'])
        ->and($snapshot['board']['locked'])->toBeFalse()
        ->and($snapshot['elements'])->toBeArray()->toBeEmpty()
        ->and($board->team_id)->toBe($team->id);
});

it('[P17d-00b] shows a second participant the rectangle and the sticky note the facilitator adds, without a reload', function () {
    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = p17dBoard();

    $franPage = $this->awaitRealtime($this->signIn($fran, p17dBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17dJoinPath($board), 'Guest Gia'));

    $this->awaitWhiteboardElements($franPage, 0);
    $this->awaitWhiteboardElements($guestPage, 0);

    $rectangle = $this->addWhiteboardElement($franPage, $board, ['x' => 300, 'y' => 200, 'width' => 220, 'height' => 140]);

    $this->awaitWhiteboardElements($franPage, 1);
    $this->awaitWhiteboardElements($guestPage, 1);

    $this->addWhiteboardSticky($franPage, 'Yellow');

    $this->awaitWhiteboardElements($guestPage, 2);
    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    $sticky = WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('is_sticky', true)->sole();
    $received = collect($this->whiteboardElements($guestPage, $board))->keyBy('id');

    expect($received)->toHaveCount(2)
        ->and($received[$rectangle['id']]['type'])->toBe('rectangle')
        ->and($received[$rectangle['id']]['width'])->toBe(220)
        ->and($received[$sticky->element_id]['customData'])->toBe(['skrum' => ['kind' => 'sticky']])
        ->and($sticky->data['backgroundColor'])->toBe('#fff3bf')
        ->and($sticky->author_member_id)->toBe($franMember->id)
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('is_deleted', false)->count())->toBe(2);
});

it('[P17d-00d] keeps the rectangle and the sticky note over a reload of both pages and writes nothing back', function () {
    ['board' => $board, 'fran' => $fran] = p17dBoard();

    $franPage = $this->awaitRealtime($this->signIn($fran, p17dBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17dJoinPath($board), 'Guest Gia'));

    $this->addWhiteboardElement($franPage, $board, ['x' => 300, 'y' => 200, 'width' => 220, 'height' => 140]);
    $this->awaitWhiteboardElements($franPage, 1);
    $this->awaitWhiteboardElements($guestPage, 1);

    $this->addWhiteboardSticky($franPage, 'Yellow');
    $this->awaitWhiteboardElements($guestPage, 2);
    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    $seq = $board->fresh()->seq;
    $stamp = $this->whiteboardSceneStamp($board);

    foreach ([$franPage, $guestPage] as $page) {
        $page->navigate(p17dBoardPath($board));

        $this->awaitRealtime($page);
        $this->awaitResync($page);

        $page->assertScript(p17dDeltaFetched(), true);
        $page->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 800))');

        $page->assertScript(p17dElementWrites(), 0)
            ->assertAttribute('[data-scene]', 'data-scene', $stamp)
            ->assertDontSee('Reconnecting…');
    }

    expect($board->fresh()->seq)->toBe($seq)
        ->and($this->whiteboardSceneStamp($board))->toBe($stamp)
        ->and(str_starts_with($stamp, '2:'))->toBeTrue();
});
```

- [ ] **Step 2: Run the tests of Step 1**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17dWhiteboardSecrecyTest.php --filter='P17d-00(a|b|d)'`

Expected: PASS; a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. In `[P17d-00d]`, a write count above 0 or a changed `seq` is the defect "loading a board writes to it". If the write is caused by the rectangle that the test wrote through the endpoint (and not by the sticky note), see the harness findings, then replace the rectangle of that test by a second sticky note (`$this->addWhiteboardSticky($franPage, 'Blue')`), as `[P17a-04]` does.

- [ ] **Step 3: Add the tests of the reactions bar, the branding, the lock and the guest's settings refusal**

Add these helpers after `p17dDeltaFetched()`:

```php
function p17dLibraryNamed(): string
{
    return <<<'JS'
        (() => {
            const named = (value) => /excalidraw/i.test(value ?? '');
            const shown = (element) => element.getClientRects().length > 0;
            const labels = Array.from(document.querySelectorAll('[aria-label], [title]'))
                .filter(shown)
                .filter((element) => named(element.getAttribute('aria-label')) || named(element.getAttribute('title')))
                .length;
            const links = Array.from(document.querySelectorAll('a[href]'))
                .filter(shown)
                .filter((link) => named(link.href) || new URL(link.href, window.location.href).origin !== window.location.origin)
                .length;

            return `${named(document.body.innerText) ? 1 : 0}:${labels}:${links}`;
        })()
        JS;
}

/**
 * @param  array<string, mixed>  $settings
 * @return array{
 *     status: int,
 *     body: array<string, mixed>
 * }
 */
function p17dPatchSettings(mixed $page, Whiteboard $board, array $settings): array
{
    $path = json_encode("/whiteboards/{$board->id}/settings", JSON_THROW_ON_ERROR);
    $body = json_encode(json_encode($settings, JSON_THROW_ON_ERROR), JSON_THROW_ON_ERROR);

    $answer = json_decode((string) $page->script(<<<JS
        async () => {
            const cookie = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='));
            const response = await fetch({$path}, {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)),
                },
                body: {$body},
            });

            return JSON.stringify({ status: response.status, body: await response.text() });
        }
        JS), true, flags: JSON_THROW_ON_ERROR);

    return ['status' => $answer['status'], 'body' => json_decode((string) $answer['body'], true) ?? []];
}
```

Append these tests to the file:

```php
it('[P17d-00e] shows the six reactions at the bottom centre and names no canvas library in the text, the labels, the titles or the links of the board page', function () {
    ['board' => $board, 'fran' => $fran] = p17dBoard();
    $bar = '.whiteboard-reactions[role="toolbar"][aria-label="Reactions"]';
    $placed = "(() => { const box = document.querySelector('.whiteboard-reactions').getBoundingClientRect(); return Math.abs(box.left + box.width / 2 - window.innerWidth / 2) < 2 && window.innerHeight - box.bottom > 0 && window.innerHeight - box.bottom < 40; })()";

    $page = $this->awaitRealtime($this->signIn($fran, p17dBoardPath($board)));

    $this->awaitWhiteboardElements($page, 0);

    $page->assertPresent($bar)
        ->assertCount("{$bar} [aria-label^=\"Send a reaction \"]", 6)
        ->assertScript($placed, true)
        ->assertPresent('a[aria-label="Back to the team"]')
        ->assertScript(p17dLibraryNamed(), '0:0:0');
});

it('[P17d-00g] locks and unlocks the board from the top bar, and another member cannot write while it is locked', function () {
    ['board' => $board, 'fran' => $fran] = p17dBoard();
    [$mia] = whiteboardMember($board);
    p17dRenamed($mia, 'Mia Member');

    $franPage = $this->awaitRealtime($this->signIn($fran, p17dBoardPath($board)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, p17dBoardPath($board)));

    $this->awaitWhiteboardElements($miaPage, 0);

    $miaPage->assertNotPresent('[role="toolbar"][aria-label="Facilitation tools"]')
        ->assertDontSee('This board is locked.');

    $franPage->assertPresent('button[aria-label="Lock the board"][aria-pressed="false"]')
        ->click('button[aria-label="Lock the board"]')
        ->assertPresent('button[aria-label="Unlock the board"][aria-pressed="true"]')
        ->assertDontSee('This board is locked.');

    $miaPage->assertSee('This board is locked.');

    $refused = $this->writeWhiteboardElements($miaPage, $board, [sceneElement()]);

    expect($board->fresh()->locked)->toBeTrue()
        ->and($this->whiteboardSnapshot($franPage, $board)['board']['locked'])->toBeTrue()
        ->and($this->whiteboardSnapshot($miaPage, $board)['board']['locked'])->toBeTrue()
        ->and($refused['status'])->toBe(403)
        ->and($refused['body']['errors']['locked'][0])->toBe('This board is locked.')
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->count())->toBe(0);

    $this->addWhiteboardElement($franPage, $board, ['x' => 300, 'y' => 200]);
    $this->awaitWhiteboardElements($miaPage, 1);

    $franPage->click('button[aria-label="Unlock the board"]')
        ->assertPresent('button[aria-label="Lock the board"][aria-pressed="false"]');

    $miaPage->assertDontSee('This board is locked.');

    expect($board->fresh()->locked)->toBeFalse()
        ->and($this->whiteboardSnapshot($franPage, $board)['board']['locked'])->toBeFalse()
        ->and($this->whiteboardSnapshot($miaPage, $board)['board']['locked'])->toBeFalse();

    $this->addWhiteboardElement($miaPage, $board, ['x' => 700, 'y' => 200]);
    $this->awaitWhiteboardElements($franPage, 2);
    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($miaPage, $board);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('is_deleted', false)->count())->toBe(2);
});

it('[P17d-07a] refuses a change of the settings sent by a guest with 403 and changes nothing', function () {
    ['board' => $board] = p17dBoard();

    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17dJoinPath($board), 'Guest Gia'));

    $guestPage->assertNotPresent('[role="toolbar"][aria-label="Facilitation tools"]')
        ->assertNotPresent('button[aria-label="Lock the board"]');

    $answer = p17dPatchSettings($guestPage, $board, [
        'title' => 'Taken over',
        'locked' => true,
        'guest_access_enabled' => false,
    ]);

    $snapshot = $this->whiteboardSnapshot($guestPage, $board);
    $stored = $board->fresh();

    expect($answer['status'])->toBe(403)
        ->and($answer['body']['message'])->toBe('Only the facilitator can do this.')
        ->and($stored->title)->toBe('Sprint board')
        ->and($stored->locked)->toBeFalse()
        ->and($stored->guest_access_enabled)->toBeTrue()
        ->and($snapshot['me']['isGuest'])->toBeTrue()
        ->and($snapshot['me']['isFacilitator'])->toBeFalse()
        ->and($snapshot['board']['title'])->toBe('Sprint board')
        ->and($snapshot['board']['locked'])->toBeFalse()
        ->and($snapshot['board']['guestUrl'])->toBeNull()
        ->and($snapshot['links']['team'])->toBeNull();

    $guestPage->assertSeeIn('header > h1', 'Sprint board')
        ->assertPresent('[data-realtime="connected"]');
});
```

- [ ] **Step 4: Run the tests of Step 3**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17dWhiteboardSecrecyTest.php --filter='P17d-(00e|00g|07a)'`

Expected: PASS; a failure means a wrong selector or a product defect: fix the selector if the UI text differs, otherwise follow the plan header's Defect rule. In `[P17d-00e]`, an answer other than `0:0:0` tells which part named the library or left the site: the first number is the page text, the second the visible `aria-label`s and `title`s, the third the visible links. A non-zero number is the branding defect the walkthrough checked for (plan 17a's first recorded defect): follow the Defect rule. If this fails in a helper of Task 1, see the harness findings.

- [ ] **Step 5: Run the whole file**

Run: `vendor/bin/pest tests/Browser/Walkthroughs/Plan17dWhiteboardSecrecyTest.php`

Expected: PASS, 6 tests.

- [ ] **Step 6: Format and check**

Run: `vendor/bin/pint --dirty --format agent`
Expected: no remaining issue, and no import removed (every import of Step 1 is used by the tests of Step 1).

Run: `composer rector:check`
Expected: no change proposed for the test file. If it proposes one, run `composer rector` and run the file again.

Run: `vendor/bin/pest tests/Arch`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/Browser/Walkthroughs/Plan17dWhiteboardSecrecyTest.php
git commit -m "test(browser): automate what remains of the whiteboard walkthrough of plan 17d"
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

In `docs/superpowers/walkthroughs/coverage.md`, in the Summary table, add these rows before the `**Total**` row, and recompute the total row from all rows of the table (this plan adds 97 rows: 48 `auto`, 25 `auto-substituted`, 13 `residual` and 11 `removed`, as planned; add the `removed` row to the status legend at the top of the file, and state the number of removed rows in a sentence under the Summary table since the table has no column for it):

```markdown
| Plan 17a: whiteboard core | 22 | 9 | 8 | 5 |
| Plan 17b: whiteboard templates, duplicate, export | 33 | 22 | 8 | 3 |
| Plan 17c: whiteboard facilitation | 27 | 12 | 8 | 4 |
| Plan 17d: whiteboard secrecy and history | 15 | 5 | 1 | 1 |
```

- [ ] **Step 2: Add one section per walkthrough**

In the same file, insert these sections before the `## Notes` section:

````markdown
## Plan 17a: whiteboard core

Walkthrough: `docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P17a-00 | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:12 | (none) | residual |
| P17a-01 | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:24 | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto |
| P17a-02a | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:30 | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto |
| P17a-02b | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:33 | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto-substituted |
| P17a-02c | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:33 | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto-substituted |
| P17a-02d | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:33 | (none) | residual |
| P17a-02e | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:34 | (none) | residual |
| P17a-03a | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:36 | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto-substituted |
| P17a-03b | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:36 | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto-substituted |
| P17a-04 | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:42 (and :19, "Reload causes no write") | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto |
| P17a-05a | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:48 | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto-substituted |
| P17a-05b | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:48 | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto-substituted |
| P17a-06a | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:54 | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto |
| P17a-06b | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:57 | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto |
| P17a-07a | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:60 | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto |
| P17a-07b | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:63 | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto-substituted |
| P17a-08a | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:66 | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto |
| P17a-08b | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:69 | (none) | residual |
| P17a-09 | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:18 | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto |
| P17a-10 | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:20 | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto |
| P17a-11 | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:72 | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto-substituted |
| P17a-12 | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:21 (and :10) | (none) | residual |

## Plan 17b: whiteboard templates, duplicate, export

Walkthrough: `docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P17b-00 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:25 (to :29) | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto |
| P17b-01a | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:48 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-01b | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:48 | (none) | residual |
| P17b-02 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:49 (and :51) | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-03 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:50 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto-substituted |
| P17b-04 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:52 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto-substituted |
| P17b-05 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:53 (and :54) | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-06 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:55 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-07 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:56 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-08 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:62 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-09 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:63 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-10 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:64 (to :67) | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-11 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:68 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto-substituted |
| P17b-12 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:69 (and :70) | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-13 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:71 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-14 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:72 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-15 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:73 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-16 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:79 (and :80) | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-17 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:81 (and :82) | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-18 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:83 (and :84) | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-19 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:92 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto-substituted |
| P17b-20 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:93 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto-substituted |
| P17b-21 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:94 | (none) | residual |
| P17b-22 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:95 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-23 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:101 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-24 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:102 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-25 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:103 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto-substituted |
| P17b-26 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:104 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-27 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:105 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-28 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:106 (and :107) | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto |
| P17b-29 | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:115 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto-substituted |
| P17b-30a | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:116 | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto-substituted |
| P17b-30b | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:116 | (none) | residual |

## Plan 17c: whiteboard facilitation

Walkthrough: `docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P17c-01a | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:72 (B5.1) | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php | auto |
| P17c-01b | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:69 (T1.1), :70 (T1.2), :73 (B5.2) | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php | auto |
| P17c-01c | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:69 (T1.1), :73 (B5.2) | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php | auto-substituted |
| P17c-01d | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:73 (B5.2), :150 (R1) | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php | auto-substituted |
| P17c-01e | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:73 (B5.2, "plays the sound") | (none) | residual |
| P17c-01f | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:72 (B5.1, "nothing new lies over the canvas … at 1280 px and at 375 px"), :151 (R2, status row) | (none) | residual |
| P17c-02a | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:78 (L2.1), :80 (B5.3), :81 (B5.4) | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php | auto |
| P17c-02b | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:81 (B5.4), :82 (B5.5) | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php | auto-substituted |
| P17c-02c | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:82 (B5.5) | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php | auto-substituted |
| P17c-02d | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:83 (B5.8), :90 (B5.6, empty canvas) | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php | auto |
| P17c-02e | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:80 (B5.3, "a drag pans … B can still pan") | (none) | residual |
| P17c-03a | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:88 (E3.1) | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php | auto |
| P17c-03b | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:88 (E3.1), :90 (B5.6) | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php | auto |
| P17c-04a | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:95 (F4.1), :98 (B6.1), :99 (B6.2), :100 (B6.3), :104 (B6.7) | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php | auto-substituted |
| P17c-04b | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:101 (B6.4), :102 (B6.5) | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php | auto-substituted |
| P17c-04c | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:103 (B6.6) | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php | auto-substituted |
| P17c-04d | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:99 (B6.2, windows of different shapes) | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php | auto-substituted |
| P17c-04e | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:99 (B6.2, "A pans … within about a second"), :101 (B6.4, "within about 2 s") | (none) | residual |
| P17c-05a | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:147 (B5.7), :96 (F4.2), :102 (B6.5, take-over) | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php | auto |
| P17c-05b | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:147 (B5.7, "never a guest", "No one else can facilitate this board yet.") | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php | auto |
| P17c-06 | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:80 (B5.3, "send a reaction") | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php | auto |
| P17c-07 | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:148 (B7.12) | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php | auto |
| P17c-08 | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:159 (G5, without its vote), :158 (G4, duplicate) | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php | auto |
| P17c-09 | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:107 (section 5: V5.1 :113, B7.1 :115, B7.2 :116, B7.3 :117, B7.4 :118, B7.7 :119, B7.10 :120) | (none) | removed |
| P17c-10 | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:123 (section 6: C6.1 :127, B7.8 :129, B7.9 :130, B7.11 :131) | (none) | removed |
| P17c-11 | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:134 (section 7: S7.1 :138, B7.5 :140, B7.6 :141), and the voting parts of :151 (R2) and :159 (G5) | (none) | removed |
| P17c-12 | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:155 (G1), :156 (G2), :157 (G3), :158 (G4, save as template) | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php (`[P17a-02a]`, `[P17a-04]`) and the plan 17b test file (new board from a template, save as template) | auto |

## Plan 17d: whiteboard secrecy and history

Walkthrough: `docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md`.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P17d-00a | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:38 | tests/Browser/Walkthroughs/Plan17dWhiteboardSecrecyTest.php | auto |
| P17d-00b | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:39 (and :40) | tests/Browser/Walkthroughs/Plan17dWhiteboardSecrecyTest.php | auto-substituted |
| P17d-00c | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:39 | (none) | residual |
| P17d-00d | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:41 | tests/Browser/Walkthroughs/Plan17dWhiteboardSecrecyTest.php | auto |
| P17d-00e | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:42 (and :43) | tests/Browser/Walkthroughs/Plan17dWhiteboardSecrecyTest.php | auto |
| P17d-00f | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:44 | (none) | removed |
| P17d-00g | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:45 | tests/Browser/Walkthroughs/Plan17dWhiteboardSecrecyTest.php | auto |
| P17d-01 | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:55 | (none) | removed |
| P17d-02 | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:65 | (none) | removed |
| P17d-03 | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:75 | (none) | removed |
| P17d-04 | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:83 | (none) | removed |
| P17d-05 | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:93 | (none) | removed |
| P17d-06 | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:103 | (none) | removed |
| P17d-07 | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:111 | (none) | removed |
| P17d-07a | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:119 | tests/Browser/Walkthroughs/Plan17dWhiteboardSecrecyTest.php | auto |

````

- [ ] **Step 3: Add the notes**

In the same file, append these bullets to the `## Notes` section (drop a bullet whose difference turned out not to exist; add one for each difference found while implementing):

````markdown
- Section 1 says "press Create"; today's dialog also shows a template gallery (plan 17b) with "Blank" selected. `[P17a-01]` leaves "Blank" selected and asserts that the new board is empty.
- Section 2: the walkthrough's "within 1 s" is not asserted (residual `P17a-02e`); the tests assert arrival without a reload on the guest's canvas (`data-scene`), in the guest's snapshot and in the database.
- `[P17a-02b]` and `[P17a-03a]` drive the Excalidraw canvas with pointer events dispatched from a script (substitution for the mouse), which is why they are `auto-substituted`.
- `[P17a-02c]` replaces the upload by a stored file arranged with `Storage::fake()` and `WhiteboardFileFactory`, and the image element by a write through the real endpoint.
- Section 3: the walkthrough's drags were "one after the other in the same second, not truly simultaneous"; `[P17a-03a]` does the same. `[P17a-03b]` adds the rule that decides a true tie (same version: the lower nonce wins, the late writer gets the stored copy back), through the write endpoint.
- Section 5: "put A offline (devtools)" is replaced by failing A's XHR requests to the board from inside the page (`[P17a-05a]`, as the manual replay did) and by stopping Reverb (`[P17a-05b]`). In `[P17a-05b]` the edits travel through the five-second poll, because the HTTP server stays up.
- Section 6: the walkthrough expected the guest link to "show" the message; the page answers 404 with "This guest link is no longer valid.", which is what `[P17a-06a]` asserts. `[P17a-06a]` also asserts what the walkthrough did not look at: a guest already on the board loses access at once.
- Section 7: on a live page the session-ended state arrives with the broadcast, before any action (`[P17a-07a]`). `[P17a-07b]` arranges the replacement in the database without a broadcast so that the guest's own action is what reveals it. A reload of the ended page shows "Your session has ended.", not the board-gone message.
- Section 8: the "facilitator lock" of the manual replay is the write of a `locked: true` element by a non-facilitator, refused with the reason `locked`. The forged author is sent under both spellings (`authorMemberId`, `author_member_id`).
- Section 9 was not replayed by hand; `[P17a-11]` replays it in the browser with the limit lowered to one element.
- Second pass, "the main menu has no links group": asserted as "no `a[href]` in the canvas menu". "No library name" is asserted as the absence of the word "Excalidraw" in the help dialog.
- The regression block at the top of the walkthrough (lines 25 to 29: created from the team page, elements seen by a guest, reload with no write-back, reactions bar, no library name) repeats plan 17a; it is covered by `[P17a-01]`, `[P17a-02a]` to `[P17a-02c]`, `[P17a-04]`, `[P17a-10]` and `[P17a-09]`, which is why row `P17b-00` names the plan 17a test file.
- Line 49 ("the board shows the template's structure") and line 51 (snapshot: frames locked, notes unlocked) are one test, `[P17b-02]`: it asserts the number of elements of each template (the number `BuiltInTemplates::elements()` gives), the number of frames, the number of locked elements recorded on line 51 (Brainstorm 3, Flowchart 7, User story map 3, Impact map 4, SWOT 4, Lean canvas 9, 2×2 matrix 8) and that no sample note is locked.
- Line 50 was replayed by hand on seven boards; `[P17b-03]` replays it on the SWOT board only, with pointer events dispatched from a script (substitution for the mouse) and the Delete key. `[P17b-02]` proves the stored lock on all seven.
- Line 52: "every label sits inside its shape without clipping" is asserted on the geometry in the snapshot (each text bound to a shape lies inside that shape), not on the rendering; labels bound to arrows are left out, since an arrow has no inside.
- Line 55: the manual replay used a 375 px iframe; `[P17b-06]` resizes the viewport to 375×812 and also creates a board from the narrow dialog.
- Line 56: "shows its structure" is asserted on the thumbnail's SVG (nine outlined frames for the Lean canvas; three ellipses, two diamonds and five arrows for the Flowchart; the outlined shapes of a workspace template) and on the computed white background of every thumbnail surface in the dark theme.
- Lines 64 to 67 were replayed by hand with the same member; `[P17b-10]` does it with a second member, as the walkthrough asked. "Moving the shape moves the arrow end" is asserted as the binding itself: the arrow's `startBinding` names the copied shape and the shape lists the copied arrow.
- Line 68: both edits are writes through `PUT /whiteboards/{board}/elements` sent from each member's page, not canvas gestures.
- Line 72 ("delete a second template saved by A for this line") and line 73 are automated although the manual replay could not delete anything.
- Lines 83 and 84: the walkthrough accepted "redirect to login or 401/403"; the tests assert 401 for the three JSON requests and the redirect to `/login` for the page visit.
- Lines 92 and 93: the save picker is replaced in the page by a recorder, as in the manual replay. Line 93 expected a `.excalidraw` file; the product has since replaced the library's save by its own panel, and `[P17b-20]` asserts `<title>.whiteboard.json`, an `application/json` blob whose `source` is the application's origin and which holds the four elements and the image's file. It also asserts that no `.excalidraw` name was offered.
- Line 95: asserted as "no visible `a[href]`" and "the word Excalidraw is not on the page" in the canvas menu and in both export dialogs.
- Line 102: "nobody on the source sees a notice" is asserted on the facilitator's open page after a later change has reached it (so the page is known to be live): same title, no toast, still the facilitator.
- Line 105 was observed for one account only; `[P17b-27]` checks the three accounts.
- Lines 106 and 107 were not replayed by hand; `[P17b-28]` automates both. "Without a full page reload" is asserted with a value set on `window` before the deletion that is still there after it.
- Lines 115 and 116: the page is put behind the purge mark by a database write made without a broadcast (one element, `seq` and `purged_seq`), then a change the page does receive makes it ask for a delta. The banner "never appeared" in the manual replay of line 115; `[P17b-29]` asserts its absence at the end.
Dot voting was removed from the product on 2026-10-01 (note at the top of `docs/superpowers/plans/2026-10-11-plan-17c-whiteboard-facilitation.md` and of the walkthrough file; spec `docs/superpowers/specs/2026-10-01-whiteboard-design.md:28`). Checked in the current code: no route contains `vote` under `whiteboards/` (`php artisan route:list --path=whiteboards` lists 16 routes, none for vote sessions); `grep -rniE "vote|voting"` finds nothing in `app/Models/Whiteboard*`, `app/Actions/Whiteboards`, `app/Http/Controllers/Whiteboards`, `app/Events/Whiteboards`, `resources/js/components/whiteboard`, `resources/js/pages/whiteboards`, `resources/js/hooks/use-whiteboard*`, `resources/js/lib/whiteboard` or the whiteboard migrations; the snapshot has no `voting` or `votingHistory` key (`BuildWhiteboardSnapshot`); the channel has no `vote.changed` event (`use-whiteboard-channel.ts`).
- Removed: **P17c-09** — section 5, "Given an open voting session, then no payload received by any member contains another member's votes or any total, and a member cannot exceed their budget" (V5.1, B7.1, B7.2, B7.3, B7.4, B7.7, B7.10). Feature removed on 2026-10-01, no test.
- Removed: **P17c-10** — section 6, "Given a closed session, then every member sees the same counts on notes and the same ranked list" (C6.1, B7.8, B7.9, B7.11). Feature removed on 2026-10-01, no test.
- Removed: **P17c-11** — section 7, "Given an open session, when a sticky in scope has its text changed, then the write is rejected" (S7.1, B7.5, B7.6), the screenshots "with a vote open and with a vote closed (panel shown)" of R2, and "the copy has no vote" of G5. Feature removed on 2026-10-01, no test. The fix found under B7.5 (a note keeps its height when its text is edited) stays in `scene-sync.ts`; it is not a line of this walkthrough any more and no browser test covers it.
- Section 1: the interface offers only whole minutes, so the countdown to zero (`[P17c-01c]`) starts the server's minimum of ten seconds through `PUT timer` from the facilitator's page; the pages then behave as after a click. `[P17c-01b]` clicks "1 min" and compares the two countdowns (at most one second apart) and the `timerEndsAt` of both snapshots, as lines T1.1 and T1.2 ask.
- B5.2 "A browser that opens the board mid-countdown shows the right remaining time": `[P17c-01d]` arranges a timer ending in 90 seconds with the factory and opens the board as a guest (78 to 90 seconds shown). The server's clock and the browser's are the same clock in a test, so the correction for a browser whose clock is wrong is not exercised.
- R1 used `psql` to move the end of the timer six minutes back; `[P17c-01d]` does it with Eloquent and reloads. It also asserts what the code does between zero and five minutes: a page opened after the end shows "Time's up!" without a toast.
- B5.1 "a member … sees neither": the walkthrough observed the facilitator after a hand-over; `[P17c-01a]` uses a second signed-in team member and a guest, and also sends the three requests they have no button for (403).
- L2.1 and B5.3 "B tries to draw": the interface gives a locked-out participant no tool to draw with, which `[P17c-02a]` asserts (view mode, no shapes toolbar, no sticky tool); the refusal itself is reached with `$this->writeWhiteboardElements()` from the guest's page (403, `errors.locked`), as the walkthrough did with `fetch`. "A can still draw": the facilitator adds a sticky note through the interface and moves the shape through the endpoint.
- B5.4 "the page stays on the board": asserted twice, after a refused `fetch` (`[P17c-02a]`) and after a write refused to the page's own sync (`[P17c-02b]`, where the lock is arranged in the database behind the open page so that the guest still has the sticky tool).
- B5.5: the walkthrough's own remark holds ("what B types before the lock is sent while typing"): `[P17c-02c]` waits until the typed words are stored, then asserts that the lock closes the editor and that nothing more is stored during the lock or after the unlock. The keys typed after the lock ("MORE", "X") are not replayed; with the editor closed they have no target.
- E3.1 and B5.6: the canvas does not let a non-facilitator drag a locked shape (the walkthrough found the same), so "it returns to its place" is proven with "Delete" from the guest's context menu, and the toast is asserted after that deletion. The facilitator locks and unlocks the shape through the context menu itself.
- B5.6 "B right-clicks … the empty canvas: no Unlock all elements entry": the entry is in the page and hidden by CSS (`display: none`), which is what `[P17c-02d]` asserts for a member, and that it is displayed for the facilitator.
- Section 4: following is proven through the zoom label of the canvas, which follows the facilitator's zoom; pausing through a click on the follower's own zoom button. The facilitator's pan is not replayed (residual `P17c-04e`). F4.1 is a pointer to B6.1–B6.7 and has no test of its own.
- B6.1 "after ten seconds without touching B, its row still says Following the facilitator": `[P17c-04a]` waits 2.4 seconds, which covers one repeated whisper (every 2 seconds), not ten seconds.
- B6.5 and F4.2: the take-over by a second member, which the walkthrough could not replay for lack of a second login, is replayed in `[P17c-05a]` with three browser contexts (the facilitator, a member, a guest).
- B5.7: the candidates are compared exactly (`Ada Admin`, `Max Member`), in the dialog and in the snapshot; the empty dialog, not replayed by hand, is `[P17c-05b]`.
- B7.12 is a voting-era line that still applies ("the new UI" is now the facilitator bar, the status row and the timer): `[P17c-07]` runs the walkthrough's own check (no library name in the text, the `aria-label`s or the `title`s, no outbound link) on a board with all three in use.
- G5: the vote part is removed; the rest is `[P17c-08]`. As the walkthrough noted, the locked shape stays locked in the copy.
- G1 to G4 repeat checks of plans 17a and 17b; they are covered by the tests of those walkthroughs (row `P17c-12`), and "Duplicate this board" is exercised again by `[P17c-08]`.
- The walkthrough's list "Feature tests that pin these criteria" still names `WhiteboardVotingTest`, `WhiteboardVotingWritesTest`, `WhiteboardVoteModelTest` and `WhiteboardVotingSecrecyTest` and "the text freeze under vote, refund of deleted notes" (lines 167 to 170), which its own line 163 says no longer exist.
Each of these describes a feature removed on 2026-10-01; no test is written. Evidence common to all of them: `php artisan route:list --path=whiteboards` lists 16 routes, none for versions, votes or a reveal; `app/Http/Controllers/Whiteboards/` holds no versions, vote or private-writing controller; `app/Models/` holds no `WhiteboardVersion`; `database/migrations/` holds four whiteboard migrations, none adding `private_writing`, `is_private`, `last_versioned_seq` or `whiteboard_versions`; `lang/en.json` no longer holds "Reveal the notes first.", "Version history", "Private writing" or "Start a vote"; `tests/Feature/Whiteboards/` holds no `WhiteboardPrivateWriting*`, `WhiteboardVersion*` or `WhiteboardAutomaticVersionsTest`; the walkthrough's own notes (lines 3 and 5) and the notes at the top of `docs/superpowers/plans/2026-10-12-plan-17d-whiteboard-secrecy-history.md` say so.
- Removed: **P17d-00f** — "A quick vote: open, one vote, close, results" (line 44). Dot voting was removed: commits `bd30526` (server) and `603c5d8` (interface and strings). `resources/js/components/whiteboard/facilitator-bar.tsx` holds the timer, the lock and follow-me only.
- Removed: **P17d-01** — section 1, "A masked note carries no text for anyone but its author" (lines 55 to 63, with B7.5 and B7.10). Private writing was removed: commits `bd30526` (server), `603c5d8` (interface), `4adbffe` (plan and walkthrough notes). `PresentWhiteboardElement` masks nothing; the snapshot (`BuildWhiteboardSnapshot`) has no `privateWriting` key; `WhiteboardSettingsController::update()` validates no `private_writing` key.
- Removed: **P17d-02** — section 2, "A masked note cannot be changed by another member" (lines 65 to 73, with B7.11 and B7.12). Same removal. The reject reasons of the client are `invalid`, `stale`, `locked`, `file`, `full` (`board.tsx`): there is no `private`.
- Removed: **P17d-03** — section 3, "The reveal shows every note to every member" (lines 75 to 81). Same removal: no reveal button, no reveal endpoint.
- Removed: **P17d-04** — section 4, "Features that would leak a hidden note are refused" (lines 83 to 89). Same removal: `WhiteboardGuard` has no `notPrivateWriting()`; duplicate and save-as-template have no such refusal.
- Removed: **P17d-05** — section 5, "Automatic versions" (lines 93 to 101). Version history was removed: commits `a3ca4f3` (server), `1af3b88` (interface and strings), `3320cb1` (leftovers), merged by `47cc047`; `e1bc67a` marks it in the plan and the walkthrough. There is no `StoreAutomaticWhiteboardVersion` job.
- Removed: **P17d-06** — section 6, "Restore" (lines 103 to 109). Same removal: no versions endpoints, no history button, panel or preview.
- Removed: **P17d-07** — section 7, "Guests have no history" (lines 111 to 117, and the seven version requests of line 119). Same removal: the endpoints a guest was refused on no longer exist. The one observation of line 119 that still applies, the guest's `PATCH settings` answering 403, is `[P17d-07a]`.
Also not replayable, and not rows (they are not checked lines): the version lines of "Result" (lines 24 to 26), the notes "Seen in passing" about version names, "Vote results" and the history sheet (lines 30 to 32 and 34), the queue-worker instruction of "Before starting" (line 49), and the table of the secrecy invariant with its list of feature tests (lines 121 to 142), all of which name code and tests that were removed.
- The plan 17d walkthrough is almost entirely about private writing and version history, both removed on 2026-10-01, with dot voting. Its sections 1 to 7 and its "quick vote" line have the status `removed` and no test. Only "Regression of 17a to 17c basics" still applies, and one observation of section 7.
- The walkthrough was run with a single participant (line 11): line 40, "A second participant sees them", was never ticked. `[P17d-00b]` and `[P17d-00d]` have a second participant, a guest who joined through the guest link; `[P17d-00g]` has a second team member.
- Line 39 says the rectangle was drawn "by drag". `[P17d-00b]` writes the rectangle through the real write endpoint from the facilitator's page instead (drawing with the pointer is `[P17a-02b]`), hence `auto-substituted`. The sticky note goes through the sticky tool, as in the walkthrough. The text typed into the note is residual (`P17d-00c`).
- Line 41 observed one tab; `[P17d-00d]` reloads both participants' pages and asserts, for each, no write request, the same scene stamp and, in the database, the same `seq`.
- Line 43 also named the history sheet and the preview dialog, which no longer exist; `[P17d-00e]` checks the board page. Only rendered elements are examined (an element hidden by the application's style sheet is not "visible branding"); the help dialog and the canvas menu are examined by `[P17a-09]`.
- Line 45: the walkthrough read `locked` in the snapshot and the button's label. `[P17d-00g]` asserts both, and adds what the walkthrough could not see without a second participant: the other member's snapshot, the "This board is locked." status, the refusal of that member's write (403 with `errors.locked`), the facilitator's write still accepted, and the member's write accepted after the unlock.
- Line 119 reads "403" for the guest's `PATCH settings` next to version requests answered "Guests cannot do this.". The settings endpoint answers a guest "Only the facilitator can do this." (`WhiteboardGuard::facilitator()`), which is what `[P17d-07a]` asserts, with the unchanged board in the database and in the guest's own snapshot.
````

If a defect was found and fixed under the Defect rule, add its line under `## Defects found`.

- [ ] **Step 4: Add the residual entries**

In `docs/superpowers/walkthroughs/residual-manual-checklist.md`, append a section per walkthrough of this plan (heading `## <walkthrough title>` as in the coverage table) and distribute these entries under them by identifier:

````markdown
- **P17a-00** — "Latency (spec §6.4): 11 `PUT elements` requests during drags took 39–114 ms (median 56 ms), and a drag sends its intermediate states", with the decision that drafts are not built. Not automated: a latency measured in a test process that also runs the browser, Reverb and the application says nothing about a deployment, and the decision is a judgement on those numbers. Check by hand: with two browsers on one board, open the network panel on the first, drag a rectangle steadily for about ten seconds, and read how often `PUT …/elements` fires and how long each takes; on the second browser judge whether the movement looks continuous.
- **P17a-02d** — "on A add … an image" through the file picker or by pasting, and the second pass line "Image paste … not replayed". Not automated: the plugin's in-process server does not pass uploaded files to the application (harness findings, "Server and requests"), so the upload (`POST /whiteboards/{board}/files`) cannot succeed in a browser test; `[P17a-02c]` covers what happens once the file is stored. Check by hand: on a board open in two browsers, choose the image tool and pick a PNG, then paste another image from the clipboard; both appear on the other browser.
- **P17a-02e** — "each one appears on B within 1 s". Not automated: the tests prove that each element arrives without a reload, not how fast; timings are out of scope (browser test spec §1). Check by hand: add a sticky note on the first browser while watching the second; it is there within about a second.
- **P17a-08b** — "upload an SVG" (expected: 422, no file stored). Not automated: uploaded files do not reach the application in a browser test, so the request would be refused for a missing file and prove nothing about SVG; `tests/Feature/Whiteboards/WhiteboardFilesTest.php` covers the rule. Check by hand: in the console of a member's board page, post an SVG file to `/whiteboards/{board}/files` with a `file_id`; the answer is 422 and `whiteboard_files` gains no row.
- **P17a-12** — "The sticky colour swatches now show the colour the note really has in the dark theme (notes are still dark in the dark theme)". Not automated: how colours look in the dark theme is a judgement of visual quality, out of scope per browser test spec §1. Check by hand: switch the appearance to dark, open a board, open the sticky tool: each swatch shows the colour the note gets on the canvas.
- **P17b-01b** — "skeletons show while the gallery loads". Not automated: the skeletons exist for the length of one partial reload and a retried assertion cannot be made to look during that request without holding it; `[P17b-01a]` proves that the gallery arrives after the dialog opens (it waits for the tiles). Check by hand: on the team page, throttle the network in the developer tools, press "New whiteboard": six grey blocks show under "Template" until the tiles replace them.
- **P17b-21** — "the image placed on the board is present in the PNG export". Not automated: no file can be read after a save, and the picture drawn in the export preview would have to be judged by its pixels; `[P17b-20]` proves that the image's file is in the exported board data, and `[P17b-10]` and `[P17b-23]` that it is on the board created from the template and on the duplicate. Check by hand: on a board with an image, canvas menu, "Export image…", save as PNG, open the file: the image is in it.
- **P17b-30b** — "a retry happens after about 2 s then about 4 s". Not automated: timings are out of scope (browser test spec §1); `[P17b-30a]` proves that the banner stays, that the snapshot is requested again after a failure, and that the banner clears on success. Check by hand: with the board open, block `…/snapshot` in the developer tools, set `purged_seq = seq` behind a remote change as line 115 describes, and read the times of the failed `snapshot` requests in the network panel.
- **P17c-01e** — "at zero each … plays the sound". Not automated: sound is out of scope (browser test spec §1); `[P17c-01c]` proves the notice in the top bar and the toast. Check by hand: with two browsers on one board, start "1 min" as the facilitator and wait: both play a short beep at zero (a browser that had no interaction with the page may stay silent).
- **P17c-01f** — "Nothing new lies over the canvas, its shapes toolbar, its bottom controls or the reactions bar, at 1280 px and at 375 px; the canvas still fills the area under the bars", and R2 "the reactions bar, the shapes toolbar and the canvas's bottom controls are never covered by the status row". Not automated: whether controls are covered or legible is a judgement of layout, out of scope per browser test spec §1. Check by hand: as the facilitator, with the board locked, follow-me on and a timer running, look at the board at 1280 px and at 375 px wide: the top bar, the status row, the shapes toolbar, the zoom controls and the reactions bar are all visible and none covers another.
- **P17c-02e** — "A locks: … a drag pans … B can still pan". Not automated: a pan changes only the scroll position of the canvas, which the page does not expose; `[P17c-04c]` proves that the zoom buttons still work in view mode. Check by hand: as a guest on a locked board, drag on the canvas: the view moves and nothing is selected or drawn.
- **P17c-04e** — "A pans and zooms: B's view follows within about a second, and what A sees is inside B's window", and "is brought to A's view within about 2 s". Not automated: the tests prove following through the zoom the canvas displays (`[P17c-04a]`, `[P17c-04b]`, `[P17c-04d]`); the scroll position after a pan is not exposed by the page, and timings are out of scope (browser test spec §1). Check by hand: with follow-me on and content spread over more than one screen, pan on the facilitator's browser: the guest's view shows the same part of the board within about a second; reload the guest: it is back at the facilitator's view within about two seconds.
- **P17d-00c** — ""Public note" typed by double-click" (line 39). Not automated: typing into a note means opening the canvas's own text editor with a double-click on the canvas and typing into it, which no proven helper does (canvas driving covers drags only, and is itself unproven until Task 1, Step 9). Check by hand: add a sticky note, double-click it, type "Public note", click outside; the note keeps the text, a second browser on the board shows it, and it is still there after a reload.
````

- [ ] **Step 5: Check the table against the tests**

Run: `grep -ohE "\[P[0-9]+[a-z]?-[0-9]{2}[a-z]*\]" tests/Browser/Walkthroughs/*.php | sort -u | wc -l` and `grep -cE "^\| P[0-9]+[a-z]?-" docs/superpowers/walkthroughs/coverage.md`.
Expected: every identifier used in a test title appears in a row (alone or in a row that names its tests); every `auto` or `auto-substituted` row names an identifier that exists in a test title; `grep -cE "\| residual \|$" docs/superpowers/walkthroughs/coverage.md` equals `grep -c "^- \*\*P" docs/superpowers/walkthroughs/residual-manual-checklist.md`.

- [ ] **Step 6: Format the two documents and commit**

Run: `npx vp fmt docs/superpowers/walkthroughs/coverage.md docs/superpowers/walkthroughs/residual-manual-checklist.md`, then check with `git diff --stat` that only these two files changed.

```bash
git add docs/superpowers/walkthroughs/coverage.md docs/superpowers/walkthroughs/residual-manual-checklist.md
git commit -m "docs: add the plan 16f walkthroughs to the coverage table and the residual checklist"
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
## Verification of plan 16f

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
git commit -m "docs: record the verification of plan 16f"
```

---

## Appendix: notes from drafting

Nothing in this plan was executed while it was written. The notes below record what was read, what could not be verified, and the fallback for each doubt. Where a note says "the lead", read "whoever executes the plan".

### From `16f-1-core.md`

Facts that differ from the brief:

- The brief suggested "one `data-*` hook … such as the element count or scene version". A count alone cannot prove that two pages hold the same copy of an element (section 3). The single hook `data-scene` therefore carries three numbers, `count:Σversion:ΣversionNonce`; it stays one attribute, small and without content. It needs one new product file (`resources/js/lib/whiteboard/scene-stamp.ts`, 20 lines) and one `useState` in `board.tsx`, which is more than an attribute: spec criterion 10 of the browser test spec speaks of attributes only, so the lead may want to mention this in the plan header.
- `data-realtime` on the whiteboard is `connected` only when the canvas is ready as well (`state.connected && api !== null`), which is stricter than on the other live pages. Without this, a test could write before `scene-sync` listens.
- `routes/channels.php` does not exist; presence authorisation is in `app/Http/Controllers/BroadcastAuthorizationsController.php`.
- `$this->awaitResync()` works on a whiteboard unchanged (its resync fetches `/whiteboards/{id}/snapshot`).
- The brief asks that arrangement helpers stay file-level. A board arranged with elements BEFORE any page is open needs database rows; the recipe for the other three fragments (each with its own prefix) is: `$data = sceneElement(['index' => 'a0', …]); WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => $data['id'], 'type' => $data['type'], 'data' => $data, 'version' => $data['version'], 'version_nonce' => $data['versionNonce'], 'author_member_id' => $member->id, 'is_sticky' => isset($data['customData']), 'seq' => $seq]);` then `Whiteboard::query()->whereKey($board->id)->update(['seq' => $seq]);`. Every element needs its own valid `index` (`a0`, `a1`, …): the bare `WhiteboardElementFactory` rectangle has no `index`, and the first canvas that loads it repairs it and writes it back, which makes stamps move. With a page open, `$this->addWhiteboardElement($page, $board, [...])` is simpler and does all of this through the real endpoint.
- Sync rule for the other fragments: after an action in the interface of page A, wait on A first with `$this->awaitWhiteboardScene($pageA, $board)` (A's stamp differs from the server's until its write is stored), or on another page with `awaitWhiteboardElements()`. PHP code that polls the database in a loop without calling a page method blocks the in-process server.
- `addWhiteboardSticky()` needs the sticky tool in the canvas toolbar (`button[aria-label="Sticky note"]`), which is where it is at the default viewport when the board is not view-only. On a locked board for a non-facilitator the tool is absent.

Hooks summary: `data-realtime` → `resources/js/components/whiteboard/board.tsx` (root div of `Board`); `data-scene` → same element; `sceneStamp()` → `resources/js/lib/whiteboard/scene-stamp.ts`.

Helper names declared: trait `Tests\Browser\Support\InteractsWithWhiteboards` (methods listed in Task 1, "Produces", plus the internal `nextWhiteboardIndex()`); file-level `p17aRenamed`, `p17aBoard`, `p17aBoardPath`, `p17aJoinPath`, `p17aGuestMember`, `p17aElementWrites`, `p17aDeltaFetched`, `p17aBlockBoardRequests`, `p17aUnblockBoardRequests`, `p17aOpenBoardMenu`; constant `P17aPng`; page-side state `window.p17aBlocked` (set by a test script, not by product code).

Dependencies: Task 2 depends on Task 1. The fragments for plans 17b, 17c and 17d depend on Task 1's trait and hooks. Tests that depend on canvas driving: the second smoke test, `[P17a-02b]`, `[P17a-03a]`.

For the harness findings (to record once the plan has run): whether dispatched pointer events drive the Excalidraw canvas; that `onChange` reports remote changes; the index rule; that a `fetch()` write reaches the sender's own canvas by broadcast.

UNVERIFIED items (nothing below was run; all were read from the code):

- UNVERIFIED: Excalidraw calls `onChange` after `api.updateScene()` made by `scene-sync` for a remote change, so `data-scene` follows remote changes. Evidence: `scene-sync.ts` relies on it ("the canvas reports it again"). Fallback: compute the stamp in a `useEffect` on an interval is not acceptable; instead set the stamp from `scene-sync` through a new callback `onScene(elements)` called at the end of `setScene()`.
- UNVERIFIED: dispatched `PointerEvent`s drive the Excalidraw canvas (tool chosen by clicking the toolbar label, `setPointerCapture` stubbed, one animation frame per event, canvas pixels equal scene coordinates on a fresh board). Fallback: Task 1, Step 9 (three attempts, then removal of one test and three methods; `[P17a-02b]` and `[P17a-03a]` become residual).
- UNVERIFIED: dragging an unselected filled rectangle with the selection tool moves it by exactly the pointer's travel (`[P17a-03a]` asserts within 2 px). Fallback: assert only that `x` (then `y`) changed and that both pages reach the server's stamp.
- UNVERIFIED: `dispatchEvent(new ProgressEvent('error'))` on an opened, unsent `XMLHttpRequest` makes Inertia's XHR client reject with its network error (it sets `xhr.onerror`, `node_modules/@inertiajs/core/dist/index.js:2092`), which `scene-sync` treats as offline. Fallback: let the request go and call `this.abort()` right after `send`, which the client turns into a cancelled request (status 0, also treated as offline).
- UNVERIFIED: an `image` element written with `status: 'saved'`, `scale: [1, 1]`, `crop: null` is restored by the canvas and triggers the file download on the receiving pages. Fallback: assert only the element's arrival (stamp and snapshot) and fetch the file from the guest page with the script that is already in the test.
- UNVERIFIED: the stickies created by the sticky tool are restored without any repair on reload (0 writes); the walkthrough's second pass observed exactly this.
- UNVERIFIED: the Excalidraw selectors of `[P17a-09]` (`[data-testid="main-menu-trigger"]`, `[data-testid="dropdown-menu"]`, `[data-testid="help-menu-item"]`, `.HelpDialog`, `.HelpDialog__islands-container`, `.default-sidebar-trigger`) were read from the 0.18.1 development bundle, not seen in a page; and the help dialog may contain the word "Excalidraw" in a shortcut label. Fallback: drop the last assertion and keep the link and header assertions.
- UNVERIFIED: `assertSee('403')` on the board URL for a non-member (the same assertion passes for other 403 pages in `[P12a-01b]` and `[P14b-07]`).
- UNVERIFIED: a fixed 800 ms wait in `[P17a-04]` is enough for a write that loading would cause (the flush delay is 300 ms); the unchanged `seq` is the server-side proof either way.
- UNVERIFIED: `Storage::fake()` with no argument fakes the disk that `WhiteboardFilesController::show` reads (the default disk). Fallback: `Storage::fake(config('filesystems.default'))`.

### From `16f-2-templates.md`

Facts that differ from the brief or from the walkthrough:

- The export of board data changed after the walkthrough was replayed: `resources/js/components/whiteboard/scene-export.tsx` downloads `<title>.whiteboard.json` through an `<a download>` and a blob URL; `resources/js/lib/whiteboard/excalidraw.ts` switches the library's "save to disk" off (`HiddenSaveToDiskAction`) and `board.tsx` passes `export: { saveFileToDisk: false, renderCustomUI: … }`. There is no export request or response to assert (nothing goes to the server, spec §10): the tests read the name asked for and the blob built in the page.
- The image export still goes through the library (`.ImageExportModal`), which saves through `showSaveFilePicker` or an `<a download>`.
- The brief's Task 3 list names "previews": they are covered by `[P17b-01a]`, `[P17b-07]` and `[P17b-08]` on the thumbnails' SVG.
- Section 3 (guests) is in Task 4 ("the remaining sections"), although it is about templates too.
- The walkthrough's closing paragraph mentions private writing as "not in this plan"; it has no line to mark as removed.

Hooks summary: none introduced. This fragment uses only Task 1's `data-realtime` and `data-scene`.

Helper names declared (prefix `p17b`): `p17bRenamed`, `p17bTeamPath`, `p17bBoardPath`, `p17bBoard`, `p17bStored`, `p17bScene`, `p17bTile`, `p17bCreateBoard`, `p17bLabelsOutside`, `p17bOpenBoardMenu`, `p17bTemplateRow`, `p17bSend`, `p17bFileDownload`, `p17bJoinPath`, `p17bRecordDownloads`, `p17bShapes`, `p17bBlockSnapshots`, `p17bUnblockSnapshots`, `p17bSnapshotRequests`; constants `P17bPng`, `P17bFileId`; page-side state `window.p17bDownloads`, `window.p17bBlocked`, `window.p17bSamePage` (set by test scripts). No new trait method was needed.

Dependencies: both tasks depend on Task 1 (trait and hooks). `[P17b-03]` is the only test that depends on canvas driving (`$this->dragOnWhiteboard()`). Task 4 depends on Task 3 (same file, shared helpers). No helper of the plan 17a file is called.

For the harness findings (to record once the plan has run): whether the save recorder catches the library's image export; whether arranged elements (an arrow with a binding, an image) are rewritten by the canvas on load; whether `responseStatus` is reported for XHR entries; whether the Delete key reaches the canvas through `keys()`.

UNVERIFIED items (nothing below was run; all were read from the code):

- UNVERIFIED: the canvas loads elements arranged with the factory (`p17bScene()`: a sticky, a rectangle, an arrow with a `startBinding`, an image) and elements copied by the server without rewriting any of them. `[P17b-10]` and `[P17b-23]` assert `version` 1 on every copied row, `[P17b-24]` an unchanged `seq` on the source. Evidence: the manual replay saw "all version 1 in the snapshot taken right after creation" and "0 `PUT elements`" on reload. Fallback: drop the `version` assertions and compare `seq` only between two points that follow `$this->awaitWhiteboardScene()`.
- UNVERIFIED: `p17bRecordDownloads()` catches the library's image export. The library's save helper chooses between `showSaveFilePicker` and an `<a download>` when its module loads; the recorder replaces both, but the legacy path may create its link and dispatch a click event instead of calling `click()`. Fallback: also wrap `HTMLAnchorElement.prototype.dispatchEvent` for anchors with a `download` attribute; if neither path can be recorded, `[P17b-19]` keeps the dialog assertions (file name input, three buttons) and the two name assertions move to the residual checklist.
- UNVERIFIED: the selectors of the library's dialogs (`[data-testid="json-export-button"]`, `[data-testid="image-export-button"]`, `.ImageExportModal`, `.ImageExportModal__preview__filename input`, `.ImageExportModal__settings__buttons button`, the `aria-label`s "Export to PNG", "Export to SVG", "Copy PNG to clipboard", `.ExportDialog--json`, `.excalidraw-modal-container`) were read from the 0.18.1 development bundle, and the English label texts were not found in the bundle's source files (they come from the library's standard English locale). Fallback for the labels: Task 4, Step 2 (address the buttons by position).
- UNVERIFIED: in `[P17b-20]`, the exported data holds the image's file. `serializeAsJSON(…, 'local')` keeps the files of the image elements once the page has downloaded them; the assertion is retried (it clicks the button again each time) to wait for that download. Fallback: assert only the name and the four elements.
- UNVERIFIED: canvas driving in `[P17b-03]`: a note of a template board dragged from its centre (where its bound text is) moves by the pointer's travel; a pointer-down on a locked frame's border moves nothing; a canvas pixel equals a scene coordinate on a board created from a template (the walkthrough observed that such a board "opens with the scene origin in the top-left corner"); the Delete key sent with `keys('.whiteboard-canvas .excalidraw-container', 'Delete')` reaches the canvas, and deleting a note also deletes its bound text (12 live elements become 10). Fallbacks: Task 3, Step 2 (dispatch the key), and the note "If canvas driving was removed".
- UNVERIFIED: `dispatchEvent(new ProgressEvent('error'))` on an opened, unsent `XMLHttpRequest` makes Inertia's XHR client reject (same item and same fallback as `p17aBlockBoardRequests()` in Task 2: call `this.abort()` after `send`). `[P17b-30a]` depends on it.
- UNVERIFIED: `entry.responseStatus === 409` is reported for the delta request in Resource Timing. Fallback: Task 4, Step 6.
- UNVERIFIED: `[P17b-29]`/`[P17b-30a]` rely on the event of a `fetch()` write reaching the page with `fromSeq` 2 while the page holds seq 1, which sends it to the delta (`handleRemote` in `scene-sync.ts`), and on `data-scene` staying `1:1:100` while the snapshot is blocked (the event's elements are not applied).
- UNVERIFIED: `Storage::fake()` with no argument fakes the disk the copy path and `WhiteboardFilesController::show` use (the default disk); `Storage::exists()` in the test then reads the same fake. Fallback: `Storage::fake(config('filesystems.default'))`.
- UNVERIFIED: the dark theme is applied from the `appearance` cookie set by a script (`document.cookie`) plus `localStorage`; `[P17b-07]` asserts the `dark` class before anything else, so a failure there is unambiguous. `bg-white` is expected to compute to `rgb(255, 255, 255)`.
- UNVERIFIED: `assertCount()` with a `>> nth=1 >>` chain in `[P17b-01a]` (the harness findings prove `>> nth=1` at the end of a selector only). Fallback: replace that line by `->assertScript("document.querySelectorAll('[role=\"dialog\"] [role=\"radiogroup\"]')[1].querySelectorAll('[role=\"radio\"]').length", 1)`.
- UNVERIFIED: `[data-sonner-toast]` is the selector of a toast (used in `[P17b-24]` for an absence only).
- UNVERIFIED: a workspace admin who is not in the team sees "Whiteboard templates" and the list on the team page (`TeamPolicy::view` allows it; `[P17b-14]` and `[P17b-27]` depend on it).

### From `16f-3-facilitation.md`

Facts that differ from the brief or the assignment:

- The timer has no server side at zero: no job, no scheduled command, no event besides `timer.changed` at start and stop (`WhiteboardTimersController`, spec §11.1 "The timer triggers nothing else"). The tests use neither `config(['queue.default' => 'database'])`, `$this->travel()` nor `$this->workQueue()`.
- The validation minimum of `PUT timer` is 10 seconds and the interface offers minutes only, so the one test that reaches zero waits about ten real seconds inside the 20-second assertion timeout.
- Follow-me has no "following" state on the server besides `follow_enabled`; the only DOM-visible effect of a followed view is Excalidraw's own zoom label. No hook was added. If the lead prefers a proof of the pan as well, it would need one more hook on the board root (for example `data-view="<scrollX>:<scrollY>:<zoom>"`, updated from `api.onScrollChange`); I did not add it because the brief says pure viewport visuals are residual.
- `P17c-12` (G1 to G4) points to tests of other fragments: `[P17a-02a]` (G2), `[P17a-04]` (G3) are in `16f-1-core.md`; G1 (a new board from a template opens) and G4 (save as template) belong to the plan 17b fragment, whose file name and ids I do not know. The lead must fill them in, or turn the row into a note.
- The status `removed` is used for three rows (sections 5, 6 and 7 of the walkthrough); the coverage table's legend needs it.
- The walkthrough has 43 checked lines; they map to 27 rows because several lines are proven by one test and each removed section is one row.

Hooks introduced: none (name → file: nothing). The tests rely on Task 1's `data-realtime` and `data-scene` (`resources/js/components/whiteboard/board.tsx`) and on existing attributes: `data-facilitator` on `.whiteboard-canvas`, `role="timer"`, `role="status"`, the `aria-label`s of the facilitator bar, Excalidraw's `.reset-zoom-button`, `.zoom-in-button`, `.zoom-out-button`, `.excalidraw--view-mode`, `ul.context-menu li[data-testid]`, `textarea.excalidraw-wysiwyg`.

Trait methods: none invented. `PUT timer`, `PATCH settings` and `PUT facilitator` have no trait method, so the file declares the file-level helper `p17cSend(mixed $page, string $method, string $path, array $body): array{status, body}` (same `fetch` recipe as `writeWhiteboardElements()`, any method and path). It may deserve to move into the trait as `sendWhiteboardRequest()` if the 17b or 17d fragments need the same.

Helper names declared: `p17cRenamed`, `p17cBoard`, `p17cBoardPath`, `p17cJoinPath`, `p17cSend`, `p17cPause`, `p17cTimerSeconds`, `p17cOpenBoardMenu`; constants `P17cTools`, `P17cLockedNotice`, `P17cLockedToast`, `P17cTimesUpToast`, `P17cViewMode`, `P17cCanvas`, `P17cLeadingNotice`, `P17cFollowingNotice`, `P17cPausedNotice`, `P17cResume`, `P17cFollowSwitch`, `P17cZoomLabel`, `P17cZoomIn`, `P17cZoomOut`.

Dependencies: Tasks 5 and 6 depend on Task 1 (trait and hooks). `[P17c-02c]` depends on `$this->drawOnWhiteboard()` (canvas driving, unproven until Task 1's second smoke test passes). Task 6 depends on Task 5 (same file, helpers and constants).

For the harness findings (to record once the plan has run): whether `rightClick()` on the Excalidraw canvas opens its context menu; whether the text tool and `fill()` on `textarea.excalidraw-wysiwyg` work; that the zoom label follows a followed view; that `div[role="status"]` is absent when the status row is empty; that a `script()` promise of 400 ms is safe.

UNVERIFIED items (nothing below was run; all were read from the code):

- UNVERIFIED: a follower with a window of the same size shows exactly the facilitator's zoom label (`110%`, `120%`). It holds if the two canvases have the same size (same top-bar and status-row heights for the facilitator and a guest). Fallback: Step 2 of Task 6 (compute the expected label from the two canvas sizes, as `[P17c-04d]` does).
- UNVERIFIED: a follower does not pause on its own when the facilitator repeats the same view every 2 seconds, and after `resize()` (`[P17c-04d]`): the hook compares the numbers it applied with the numbers the canvas reports, with `===`. The walkthrough ticked B6.1. Fallback for `[P17c-04d]` only: if the resize pauses the follower, click `P17cResume` once after the resize and assert the label then; record it as a product finding (a follower who resizes the window is paused).
- UNVERIFIED: Excalidraw's footer (`.reset-zoom-button`, `.zoom-in-button`, `.zoom-out-button`) is rendered in view mode and at a 900 px wide viewport, and the three selectors each match one element (read from `dist/dev/index.js`: `ZoomActions` is rendered unconditionally in `Footer`; the mobile layout starts under 730 px). Fallback for `[P17c-04c]`: pause the follower with a dispatched `WheelEvent` on the canvas (`new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120, clientX, clientY })`) instead of the zoom button, and assert only the notices.
- UNVERIFIED: `$page->rightClick(P17cCanvas)` opens the canvas context menu (`[P17c-02d]`, `[P17c-03b]`); Playwright may refuse the click if another element lies over the middle of the canvas. Fallback: Step 4 of Task 5 (dispatched `contextmenu` event), then removal to residual.
- UNVERIFIED: the context menu of a locked shape offers `deleteSelectedElements` to a non-facilitator, and deleting it sends a write that the server rejects as `locked` (the walkthrough observed exactly this, line 88). Fallback: assert only the hidden lock entry in `[P17c-03b]` and leave the rejection to `[P17c-03a]`.
- UNVERIFIED: in `[P17c-03b]`, "Lock" from the context menu raises the shape's version by exactly one (stamp `1:2:…`), and "Unlock" by one more. Fallback: replace `assertScript($versions, '2')` by `assertScript("{$versions} != '1'", true)` and drop the exact versions from the expectations.
- UNVERIFIED: `[P17c-02c]`: the text tool opens the editor with one pointer down and up at the same point; `fill()` on the editor updates the element; the element is written while typing; closing the editor at the lock produces a refused write and therefore the toast. Fallbacks: Step 4 of Task 5.
- UNVERIFIED: Radix marks a disabled menu item with `aria-disabled="true"` and an enabled one without the attribute (`[P17c-01b]`, "Stop timer"). Fallback: assert `data-disabled` with `assertAttribute($stop, 'data-disabled', '')`, or drop the two assertions.
- UNVERIFIED: `assertDisabled()` works on a plain button addressed by a CSS selector (`[P17c-05a]`, "Hand over" before a choice). Fallback: `assertScript("document.querySelector('[role=\"dialog\"] button:disabled') !== null", true)`.
- UNVERIFIED: the toast "Time's up!" is still on screen on the second page when the test reaches it (sonner's default of four seconds; both pages reach zero together and the first page's two assertions take well under a second). Fallback: assert the toast on the guest's page first with `assertPresent(P17cTimesUpToast)` (it waits for zero), then the top bars of both.
- UNVERIFIED: a page opened after the end of the timer shows no toast at all (`[P17c-01d]`, `assertNotPresent('[data-sonner-toast]')`); it relies on no other toast being shown on load.
- UNVERIFIED: the snapshot's `transferCandidates` are ordered `Ada Admin`, `Max Member` by the database (`orderBy('name')`), and the Radix select renders every option in `[role="listbox"]`.
- UNVERIFIED: `[P17c-07]`: no `aria-label` or `title` rendered by the canvas contains the library's name (the walkthrough observed none on 2026-10-01, line 148).
- UNVERIFIED: `[P17c-08]`: the copy gives the element a new id (`RemapWhiteboardScene` exists; I did not read it). Fallback: Step 6 of Task 6.
- UNVERIFIED: a 403 from `WhiteboardGuard::facilitator` (an `AuthorizationException`) is rendered as JSON `{"message": "Only the facilitator can do this."}` while the plugin forces `app.debug` to false (the same shape is asserted for other 403 answers in `[P17a-06b]`).

### From `16f-4-secrecy-history.md`

Result in one sentence: 8 of the 15 rows are `removed`; the task is one file with six tests and no product change, and there is no Task 7b.

Facts that differ from the brief or the assignment:

- The assignment gave "guest secrecy/redaction of names, access rules, pruning, tombstones, sanitising of elements" as examples of what might be kept. None of them is a line of this walkthrough: the file keeps only the eight regression lines (38 to 45, one of them removed) and marks everything else as not to be replayed (line 3). Those behaviours exist in the product and are covered elsewhere: access rules and sanitising by `[P17a-06a]`, `[P17a-06b]`, `[P17a-07a]`, `[P17a-07b]` and `[P17a-08a]`; pruning and tombstones by `tests/Feature/Whiteboards/PruneWhiteboardsTest.php` and `WhiteboardElementDeltaTest.php` (scheduled command and delta endpoint, nothing a browser shows). I wrote no test for them here.
- The file has 33 checkbox lines: 8 in the regression part and 25 in sections 1 to 7. 26 of them are removed (the 25, and the vote line of the regression part).
- Five of the six tests repeat, on purpose, behaviour that Tasks 2 and (probably) the plan 17c task already prove (`[P17a-01]`, `[P17a-02a]`, `[P17a-04]`, `[P17a-09]`, `[P17a-10]`, and the lock tests of plan 17c). They exist because the regression lines are rows of this walkthrough. If the lead prefers no duplication, the alternative is to keep only `[P17d-00g]` and `[P17d-07a]` and point rows `P17d-00a`, `00b`, `00d`, `00e` at `Plan17aWhiteboardCoreTest.php` with a coverage note; I did not do that because every other row id in the coverage table matches a test title.
- The guest's settings refusal message is "Only the facilitator can do this.", not "Guests cannot do this." (`app/Http/Controllers/Whiteboards/WhiteboardSettingsController.php:20`, `app/Actions/Whiteboards/WhiteboardGuard.php:12-19`).
- Status legend: this fragment uses the new status `removed` (8 rows); the coverage table's legend and summary need the column.

Hooks summary: none introduced. The task uses `data-realtime` and `data-scene` of Task 1 only.

Helper names declared (file-level, prefix `p17d`): `p17dRenamed`, `p17dBoard`, `p17dBoardPath`, `p17dJoinPath`, `p17dElementWrites`, `p17dDeltaFetched`, `p17dLibraryNamed`, `p17dPatchSettings`. `p17dPatchSettings()` is the one helper that does something the trait does not (a `PATCH` to the settings endpoint with `fetch()` from the page, same header handling as `writeWhiteboardElements()`); if the plan 17c fragment needs the same thing, the lead may want to move it into the trait as one method and drop it here. No trait method was invented, and none of the canvas-driving methods is used.

Dependencies: Task 1 (trait and hooks). No dependency on Task 2's `p17a*` helpers, and none on canvas driving.

UNVERIFIED items (nothing was run; all were read from the code):

- UNVERIFIED: a rectangle written through the endpoint (`sceneElement()` with index `a0`) followed by a sticky note from the sticky tool reloads with no repair write (`[P17d-00d]`). The sticky note gets its index from the canvas; if the canvas gives it an index that collides or rewrites the rectangle on load, the write count is above 0. Fallback, written in Step 2: use two sticky notes, as `[P17a-04]` does.
- UNVERIFIED: the board page holds no rendered `aria-label`, `title`, text or link naming "excalidraw" (`[P17d-00e]`). The walkthrough observed exactly this by hand at 42e59a3 (line 43). If the library sets such a label on a rendered control, that is the product defect the line is about, not a test error; if it is on an element hidden some other way than `display: none` (for example `visibility: hidden`, which still has client rectangles), extend `shown()` with `getComputedStyle(element).visibility !== 'hidden'`.
- UNVERIFIED: `window.innerHeight - box.bottom < 40` and the 2 px centring tolerance for the reactions bar are copied from `[P17a-10]`, itself unproven.
- UNVERIFIED: the non-facilitator's page shows "This board is locked." only in the status row at that moment, and `assertDontSee()` after the unlock waits for the refetch that follows the `WhiteboardChanged` broadcast. Fallback: replace it by `assertNotPresent('[role="status"]:has-text("This board is locked.")')`, which waits on the status row itself.
- UNVERIFIED: `aria-pressed="false"` is rendered as an attribute on the lock button when the board is unlocked (React renders a boolean `aria-*` value as the string). Fallback: drop `[aria-pressed="false"]` from the two selectors and keep `[aria-pressed="true"]` on the locked one.
- UNVERIFIED: a `PATCH` sent with `fetch()` and the `X-XSRF-TOKEN` header from a guest's page passes CSRF and reaches the controller (the trait's `PUT` does the same thing with the same header, also unproven until Task 1 runs). A 419 instead of 403 would mean the cookie was not readable from the page.
- UNVERIFIED: the selectors of the "New whiteboard" dialog in `[P17d-00a]` are those of `[P17a-01]` (Task 2), read from the code and not yet run.
