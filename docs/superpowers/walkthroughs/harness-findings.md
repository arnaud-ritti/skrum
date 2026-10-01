# Browser harness: spike findings

Date: 2026-10-01
Versions: pestphp/pest-plugin-browser v5.0.1, playwright 1.63.0 (Chromium build 1243, Chrome for Testing 153.0.8010.12), PHP 8.5.8
Spec: `docs/superpowers/specs/2026-10-01-browser-e2e-and-arch-tests-design.md`, sections 3.1 to 3.4

| #   | Assumption                                                                                                                                                   | Observed                                                                                                                                                                                                                                                                                                                        | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a1  | Without a reset, a second `visit()` context inherits the first user's session (spec 3.3).                                                                    | PASS. The second context never signed in and still opened `/poker/{id}` instead of being sent to `/login`. The leak is real.                                                                                                                                                                                                    | as specified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| a2  | Forgetting the guards, flushing the session store's attributes and forgetting scoped instances after every handled request isolates the contexts (spec 3.3). | PASS. With the `RequestHandled` listener the second context is sent to `/login`, and the first user is still signed in on a later navigation.                                                                                                                                                                                   | as specified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| b   | A broadcast made during a browser request reaches a second context through a real Reverb process, inside `RefreshDatabase` (spec 3.1, 3.4).                  | PASS. The member's page showed "Spike broadcast story" without a reload; the Reverb log shows `task.saved` broadcast to `presence-poker.{id}`. Control run without the Reverb configuration: the facilitator sees the task, the member does not after 3 s, so the pass is caused by Reverb.                                     | as specified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| c   | `keys()` drives the dnd-kit keyboard sensor on the poker task list; the handle carries `aria-pressed="true"` while dragging (spec 3.5).                      | PARTLY. `keys()` reaches the sensor: Space picks the row up and `aria-pressed` is `"true"`, arrows move it, Space drops it. The probe as written (`Space`, then `['ArrowDown', 'Space']` with nothing in between) FAILS: the order does not change. Keys sent back to back are lost in two places (see Notes, "Keyboard drag"). | Task 4 keeps `keys()` (no `KeyboardEvent` dispatch through `script()`), and keeps the `aria-pressed` wait, but `dragWithKeyboard()` must synchronise between keys: (1) `keys($handle, 'Space')`; (2) `assertAttribute($handle, 'aria-pressed', 'true')`; (3) `script('() => new Promise((resolve) => setTimeout(resolve, 0))')`; (4) for each arrow key: `keys($handle, $key)` then `script('() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))')`; (5) `keys($handle, 'Space')`. Passed 5 of 5 runs, order persisted in the database. Spec 3.5 needs one sentence saying the helper waits between keys. |
| d   | The `array` session and cache stores keep their state between browser requests of one test (spec 3.1).                                                       | PASS. The user stayed signed in across navigations, `Cache::increment()` returned 1 then 2, and both drivers were `array`.                                                                                                                                                                                                      | as specified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| e   | `ext-sockets` is loaded in the environment that runs the suite.                                                                                              | Yes. `8.5.8 sockets=yes` for the Homebrew PHP that the standing `PATH` selects; the Herd PHP 8.4.21 that is first on the default `PATH` also has it.                                                                                                                                                                            | as specified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| f   | Validation errors flashed by a POST are shown after the redirect, with the reset in place (spec 3.3).                                                        | PASS. The login page showed "These credentials do not match our records." after a failed sign-in.                                                                                                                                                                                                                               | as specified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Notes

### Keyboard drag (probe c)

- Lost key 1: dnd-kit's `KeyboardSensor` adds its `keydown` listener to the document inside a `setTimeout` after pick-up. An arrow key sent right after Space arrives before the listener exists and is ignored (observed: the first `ArrowDown` was not `defaultPrevented`, the second one moved the row). A timer measured in the page right after pick-up resolved after 4 to 14 ms.
- Lost key 2: the drop reads the "over" row, which only changes after React has rendered the move. `ArrowDown` immediately followed by `Space` drops the row where it started (announcement "Dropped Alpha story.", order unchanged). This explanation comes from reading dnd-kit and from the observation; the cure was verified, the cause was not isolated further.
- A second verified way to wait after an arrow key is to assert the live region: `assertScript('document.querySelector("[id^=DndLiveRegion]").textContent', 'Moved Alpha story to position 2.')`. It passed 5 of 5 runs, also with two arrow keys (position 3). It needs the expected position, so it suits a test more than a generic helper.
- A wrong pick-up leaves the row in drag mode: the failure screenshot shows the row dimmed.
- Selectors that worked unchanged: `li:has-text("Alpha story") [aria-label="Drag to reorder"]`, `ol li`. `:has-text()` works in explicit CSS selectors.

### Selectors

- All selectors of the brief worked as written: `#email`, `#password`, `@login-button`, `Add task` (text), `#poker-task-title`, `Save` (text), `[aria-label="Drag to reorder"]`. `@name` resolves `data-test` and `data-testid`.
- A selector is treated as CSS when it starts with `#`, `.`, `[` or contains one of `[ ] # > + ~ : * | ^ , = ( )` or a `.class` pattern; `@x` is a data-test id; anything else is tried as `id`, then `name`, then visible text (exact match).

### What retries

- Every call on the page object is retried until the timeout, not only `assert*`: the plugin wraps each method (`click`, `fill`, `keys`, `script`, `assertScript`, ...) and repeats it while it throws, and every Playwright error is turned into an `ExpectationFailedException`. Each attempt gets 1 s, the whole call gets the configured timeout (default 5 s). Only `assertScreenshotMatches`, `assertNoAccessibilityIssues` and `typeSlowly` are excluded.
- Consequence: an action on an element that is not there yet waits for it. A multi-key `keys()` that fails half-way is repeated from its first key, so one key per `keys()` call is safer for drags.
- `script()` awaits a returned promise.

### Server and requests

- The plugin sets `app.url` and the URL generator to `http://127.0.0.1:{free port}`, serves files under `public/` itself, and forces `app.debug` to `false` while a request is handled.
- Uploaded files are not passed to the application (the plugin's request builder has a `TODO` for files); only `application/x-www-form-urlencoded` bodies are parsed into parameters, other bodies arrive raw (JSON requests work).
- With broadcasting left at `null` (probes a, c, d, f), the failure message of probe c carried a `503` raised in `BroadcastAuthorizationsController::pusher()`: the page still reads a Reverb key from `.env`, connects, and its channel authorisation is refused. The base class should always configure Reverb (spec 3.2 already says so); otherwise every failure message ends with this unrelated stack trace.

### Reverb

- Reverb picked up the test credentials from the process environment (`REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET`) although `.env` defines other values.
- Reconnect, measured once on the poker page: the "Reconnecting…" banner appeared 1.0 s after the Reverb process was stopped. After Reverb was started again the banner disappeared 13 s later, which is longer than the default 5 s assertion timeout. A broadcast made after that reached the page in under 0.1 s.
- A Reverb process started from inside the test process inherits the test runner's output pipe: `pest ... | grep` did not return until that Reverb process was killed. `ReverbServer` must redirect the child's output and not leave it attached to the runner's stdout or stderr.

### Other

- Default viewport: 1728 x 1117 (the plugin's desktop device), headless.
- Duration: about 0.5 to 0.8 s for a one-page test, 2.3 s for the first test of a run (browser start), 4.5 s for the two-user broadcast probe including its fixed 3 s wait. Six probes took 15 to 19 s.
- Failure screenshots are written to `tests/Browser/Screenshots`.
- The output is JSON when the run is detected as coming from an agent (`laravel/pao`); `PAO_DISABLE=1` restores the normal Pest output with per-test timings.
- Composer added 20 packages besides the plugin (amphp/*, `revolt/event-loop`, `league/uri-components`, `daverandom/libdns`, `kelunik/certificate`); no installed package changed version. `amphp/amp` 3.1.3, `amphp/http-server` 3.4.6, `amphp/websocket-client` 2.0.2.
- Not probed: fakes and time travel applying to browser requests (spec 3.1), and `joinAsGuest`.

## Findings from plan 16a

Found while writing the harness and the first three walkthrough files, after the spike above.

### Broadcasts fired from test code (`toOthers()`)

- Artefact: a broadcast made by the test body, outside a browser request, never reaches the page that made the last browser request. Seen in `[P10b-08a]`: the reveal done by a job run with `queue:work` reached one page and not the page that had just voted.
- Cause: every browser request is handled by the test's own application instance, and the container keeps the last request bound after it is handled. `App\Events\Concerns\SendsToOthers` calls `broadcast($this)->toOthers()`, which reads `X-Socket-ID` from that bound request, so the socket of the last page that acted is excluded. Not a product defect: in production a worker has no such request.
- Cure: `$this->workQueue()` (plan 16b, Task 1) binds a fresh `Request::create(url('/'))` (the test server's root URL, so that URLs generated by the job point at the test server) and then runs `queue:work --once --sleep 0`, once per job. Code that broadcasts from the test body without a queued job (an action or a model event called directly) binds the fresh request itself first: `app()->instance('request', Request::create(url('/')))`.

### Selectors

- A bare tag name, or tags separated by a space (`aside`, `main`, `header h1`), has no CSS punctuation, so it is resolved as id, then name, then visible text, and never as CSS. Write `header > h1`, `aside:not([aria-label])` or an attribute selector.
- Text that contains a comma or parentheses is treated as CSS: `click('Start, Stop, Continue')` times out. Use `button:has-text("Start, Stop, Continue")`.
- `:has-text()` works in explicit CSS selectors.

### Retries

- Every page method retries until the timeout, not only `assert*`, and a multi-key `keys()` restarts from its first key when it is retried: send one key per `keys()` call wherever order matters (ruling R9).

### Radix menus

- Reopening a dropdown menu right after choosing one of its items can leave it closed: the closed content stays mounted during its exit animation, an assertion on the menu's text passes on that leftover, and the next click finds nothing. The mechanism was not isolated further.
- Guard: `assertNotPresent('[role="menu"]')` before clicking the trigger again (`[P04-08a]`, `[P10b-09]`). It is an assertion wait, not a sleep.

### Keyboard drag

- `dragWithKeyboard()` ends with `assertAttributeMissing($handle, 'aria-pressed')` by default, which cannot pass when the drop removes the handle (dropping a card onto another to group them). Pass `handleRemains: false` for such a drop; `[P04-03]` does.

### Durations

- A failing `awaitRealtime()` took about 43 s, more than twice the 20 s timeout (observed once, cause not investigated).
- The reconnect tests (`[P04-12]`, `[P10a-11]`) take about 20 s each; the reconnect itself is the 13 s measured in the spike.

### Orphan Reverb on port 8097

- `ReverbServer::ensureRunning()` accepts any listener on `127.0.0.1:8097` without checking that it is the test Reverb. A run that is killed (Ctrl-C, SIGKILL) skips the shutdown function and leaves its Reverb running; the next run reuses it, and the reconnect tests then fail with "A Reverb server this test run did not start is listening on port 8097", because `ReverbServer::stop()` refuses to stop a process it did not start.
- Clear it: `lsof -i :8097`, then `kill <PID>`.

### Stale build

- `BrowserTestCase` only checks that `public/build/manifest.json` exists and that `public/hot` does not. After a frontend edit, `vendor/bin/pest tests/Browser` tests the old build. Run `npm run build` first, or use `composer test:browser`, which builds.

### Tooling

- Pint removes unused imports (`laravel` preset). An import added for a later task is gone after `vendor/bin/pint --dirty`; add it again with the code that uses it.
- `package.json` has no `name`, so `npm install` in a worktree rewrites the root `name` of `package-lock.json` to the folder's name. Check `git diff package-lock.json` before committing; `npm ci` does not touch the lockfile.

## Findings from plan 16b, Task 1

### `workQueue()`

- `$this->workQueue(int $jobs = 1)` lives in `tests/Browser/Support/InteractsWithBrowser.php`. Before each job it binds a fresh request in the container (`Request::create(url('/'))`, the test server's root URL) and runs `queue:work --once --sleep 0`, so `toOthers()` finds no `X-Socket-ID` and the job's broadcast reaches every open page. `tests/Browser/Smoke/QueuedBroadcastTest.php` pins it: without the fresh request the page that voted last never sees the timer reveal.
- The cure is in `workQueue()` only, not in `BrowserTestCase::isolateRequests()`: that listener runs inside the kernel, before the plugin terminates the request, and changing the bound request there would affect the terminating middleware of every browser request.
- The test sets `config(['queue.default' => 'database'])` before the action that queues the job. Pass the exact number of waiting jobs. A call on an empty queue no longer costs three seconds (`--sleep 0`), but it runs nothing and does not fail, so a wrong count goes unnoticed: where the count matters, assert `DB::table('jobs')->count()` before and after (`[P08e-11b]`).
- A job that fails does not fail the helper: the worker releases it with its backoff or marks it as failed, and `queue:work` still exits with 0. The test asserts the outcome.
- The request is bound again before every job, because a page may send a request (a refetch) between two jobs.

### `dragWithKeyboard()`

- `handleRemains: false` ends the helper with `assertNotPresent($handle)` instead of `assertAttributeMissing($handle, 'aria-pressed')`. Use it when the dropped item is rendered again without its handle (a retro card dropped onto another card in Grouping).
- Fewer than two keys throws `InvalidArgumentException` ("dragWithKeyboard() needs at least two keys: the first picks the item up and the last drops it."). Before, the helper called `keys()` with `null` and failed after the 20 s timeout with a Playwright message.

## Findings from plan 16b (walkthroughs of plans 6, 7, 9a, 9b)

Proven by running the tests of plan 16b.

### Acting on elements

- Playwright waits until the timeout instead of clicking an element whose ancestor has `aria-disabled="true"` (for example a control inside a retro card that cannot be dragged, on a locked board). Click such a control with `script("() => document.querySelector('…').click()")` and assert its state before and after.
- `assertSeeIn($selector, $text)` is strict: it fails when the text matches more than one element inside the selector. Use `assertPresent()` with `:has-text()` on a narrower selector.
- `hover()` works on buttons and opens Radix tooltips (`[data-slot="tooltip-content"]`); hovering another element in between lets the same tooltip open again.
- A Radix dialog focuses its first focusable control. When that control has a tooltip, the tooltip opens on focus and takes the first Escape: send Escape to the focused control, assert the tooltip is gone, then send Escape again.
- Radix select: click the trigger, `assertPresent('[role="listbox"]')`, click `[role="option"]:has-text("…")`, `assertNotPresent('[role="listbox"]')`. `assertDisabled()` and `assertEnabled()` work on Radix checkboxes (`button[role="checkbox"]`) and select triggers.
- `fill()` on `<input type="date">` works with a `Y-m-d` value. Tab does not blur it (it walks the date segments): click neutral text elsewhere to trigger a save-on-blur.
- `resize()` sets the viewport size.

### Keyboard drag

- A key sent after the pick-up can be lost unless one timer turn precedes it, Escape included: `$page->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 0))')`. Assertions in between are not a substitute. The mechanism was not isolated: the sensor's late `keydown` listener (spike, "Lost key 1") does not explain all of it, since `[P06-08a]` made eight page round trips between the pick-up and Escape and still lost the key until the timer turn was added. Keep the recipe whatever the cause.
- Inside dnd-kit's `onDragStart` (6.3.1), `event.active.rect.current.initial` is null; measure the element.

### Scripts

- `assertScript()` passes the expression unwrapped to `page.evaluate` when it contains `==`, `>`, `<`, `&&` or `||` (so any arrow function); otherwise it wraps it in `function () { return …; }`. An `(async () => { … })()` expression is awaited.
- A value that is animated (a remote cursor moves to its target over about 150 ms) can satisfy a retried assertion while in transit: read it twice a short time apart in one script and assert it is stable.
- Holding an XHR response in the page works by wrapping `XMLHttpRequest.prototype.open` and `send` and deferring the `onload` handler (see `plan06RecordRequests()`, `plan06Hold()`, `plan06Release()`); install it after the page's first requests, it does not survive a navigation.
- `fetch('/logout', {method: 'POST'})` from the page with the `XSRF-TOKEN` cookie as `X-XSRF-TOKEN` ends that context's session while the page stays on screen.

### Server side

- `Http::fake()` closures, `Storage::fake()`, `Mail::fake()`, `Notification::fake()` and `Event::fake([Specific::class])` (even called in the middle of a test) apply to browser requests and to commands run from the test body.
- A listener that sleeps inside a browser request blocks the whole test process; the test resumes afterwards.
- Two `signIn()` calls for the same user give two contexts with separate sessions and the same participant.
- A guest page keeps its session across `navigate()`.
- A value shown only after navigation (a shared Inertia prop such as the unread count) is refreshed with `$page->navigate($samePath)`; no sleep is needed.
- A model instance held by the test goes stale once the browser changes its row: `$model->update([...])` writes nothing when the in-memory value already equals the new one. Use `Model::query()->whereKey($id)->update([...])` or `fresh()`.

### Hooks and helpers that exist

- `[data-test="retro-action-items-panel"]` (the retro action-items panel) and `[data-test="retro-sort-by-votes"]` (one per column: `[data-test="retro-column-{id}"] [data-test="retro-sort-by-votes"]`).
- `data-realtime` on the workspace action-items page; a viewer with no visible team stays `connecting`.
- The source scan matches regular expressions over the whole file, comments and strings included.
- Global helper functions already declared by walkthrough files must not be redeclared: `plan04*`, `plan06*`, `plan07*`, `p09a*`, `p09b*`, `p10a*`, `p10b*`.

### Tooling

- Format documents with `node_modules/.bin/vp fmt <file>`; `npx prettier` formats differently.
- `composer test` runs PHPStan through `composer types:check`, which passes `--memory-limit=1G` (since plan 16c; before, it had no limit and crashed at PHP's default 128M on host PHP). Run by hand: `vendor/bin/phpstan analyse --memory-limit=2G`.
- The browser suite holds 142 tests and takes about 270 seconds.

## Findings from plan 16c (walkthroughs of plans 8a to 8e)

Proven by running the tests of plan 16c.

### Keyboard drag

- `dragWithKeyboard()` fails on a list low on a scrolling page (the team page's health statements): the keyboard sensor scrolls the window one row per arrow key, and a drop sent two animation frames after the arrow lands on the starting row. Send the keys inline and, between the arrow and the drop, wait on the live region: `assertScript("document.querySelector('[id^=\"DndLiveRegion\"]').textContent", 'Moved Interaction to position 2.')`. That list announces the statement's axis label, not its text.
- In Grouping, an arrow towards a tall target (a group) below the dragged item ends over the column, not the group; towards a target above it ends over the target. Arrange the target above the dragged card. (The downward case is recorded as an open product defect, P08d-01c.)

### Selectors and controls

- Nested `:has()` works: `div:has(> h3:has-text("Preview"))`, `section:has(h2:has-text("…"))`. `:text-is("…")` gives an exact text match where `assertSeeIn()` is ambiguous.
- Emoji work in selectors: `[role="menuitem"]:has-text("🎉")`, `[aria-label="🎉, 1 reaction"]`.
- `keys('[role="menu"]', 'Escape')` closes a Radix dropdown menu. `assertAttribute(…, 'aria-disabled', 'true')` and `assertAriaAttribute(…, 'checked', 'true')` work on Radix menu checkbox items and switches. A Radix collapsible opens with a plain click on its trigger.
- `resize()` reflows breakpoint grids; row counts can be read with `getBoundingClientRect().top` in a script.

### Context options

- `visit($url, ['reducedMotion' => 'reduce'])` works: `matchMedia('(prefers-reduced-motion: reduce)').matches` is true in that page. Such a page joins as a guest by hand, since `joinAsGuest()` takes no options.

### Server side

- `config([...])` set in the test body, also in the middle of a test, applies to the next browser request (`navigate()` to the same path shows the change). `$this->travel()` applies to later browser requests too.
- `Http::fake()` and `Http::sequence()` apply to browser requests and to jobs run by `workQueue()`; `Http::assertSentCount()` and `Http::recorded()` see both.
- A job that fails when run by `workQueue()` is released with its backoff: travel past the backoff and call `workQueue()` again; the last attempt calls `failed()`, whose broadcast reaches the pages.
- A dispatch made `afterCommit()` during a browser request reaches the `jobs` table inside the test transaction.
- `fetch()` from a page with `script()` carries that context's session or guest cookie, so `fetch('/retros/{id}/snapshot')` returns that participant's snapshot; a `fetch(...).then(...)` chain returns the resolved value.
- A stale dialog reaches a server refusal: with a dialog open, change the model from the test body (no broadcast), then submit.

### Tooling

- The browser suite holds 214 tests and takes about 390 seconds.

## Findings from the final fix wave of plan 16c

Proven by running the whole browser suite.

### Stray-request guard

- `BrowserTestCase::setUp()` calls `Http::preventStrayRequests()`, so no browser test can send a request to a real third party: a request made with Laravel's HTTP client that no fake matches throws `Illuminate\Http\Client\StrayRequestException` ("Attempted request to [https://api.anthropic.com/v1/messages] without a matching fake."). It holds for browser requests, for jobs run by `workQueue()` and for the test body, with a pattern-only `Http::fake([...])` and with no fake at all.
- The exception is thrown inside the browser request, so the test fails on its next page assertion and the message ends with "The following exception was thrown by the HTTP server:" followed by the exception. The failing assertion is retried first, so such a failure takes the full timeout (about 20 seconds).
- When it fires: give the test a fake for that URL with a plausible answer (`Http::fake(['api.example.com/*' => Http::response([...])])`, or the helpers of `tests/Pest.php` such as `fakeLlmReply()`). Do not remove the guard. `Http::allowStrayRequests([...])` is only for a loopback URL that is part of the harness; none is needed today.
- Broadcasting is not affected: the Reverb broadcaster uses the Pusher SDK's own Guzzle client, not Laravel's HTTP client (`tests/Browser/Smoke/RealtimeTest.php` and `QueuedBroadcastTest.php` pass with the guard). For the same reason the guard does not cover a client that bypasses Laravel's HTTP client.
- With the guard added, the whole suite passed unchanged (214 tests, 390 seconds): no test was reaching a real URL.

### `snapshotOf()`

- `$this->snapshotOf($page, $path)` (`tests/Browser/Support/InteractsWithBrowser.php`) fetches a same-origin path from inside the page, so the request carries that context's session or guest cookie, and returns the decoded JSON as an array: `$this->snapshotOf($carolPage, "/retros/{$retro->id}/snapshot")` is the snapshot the server sends to Carol now. An answer other than HTTP 200 throws.
- Use it for every claim of the kind "the server did not send it" (a hidden card, another participant's score, an answer the viewer may not see yet). A scan of the document (`document.documentElement.outerHTML.includes(…)`) proves DOM absence only: the Inertia page data in the document dates from the page load, and what arrives later comes by XHR and never enters the document unless the page renders it. A scan on a page that does not render the element at all (the board during Icebreaker) cannot fail.
- A negative needs a sync point: an absence that is true before and after the broadcast proves nothing. Assert a positive first (a count that changed, a menu item shown as checked), or read the snapshot, whose answer does not depend on the page having processed the broadcast.
- It is a method of the test case, so a global helper function cannot call it: pass it the array (`p08bHealthSnapshot($this->snapshotOf(…))`).

### Tooling

- Rector rewrites `->toBe([])` to `->toBeEmpty()` when the value's type is known to be an array (`SimplifyToLiteralBooleanRector`); `->toBeArray()->toBeEmpty()` is as strict and is left alone.
- The agent output (`laravel/pao`) of a browser run can report `"warnings":2` with no details in the first run after a run that failed. The failed run leaves `tests/Browser/Screenshots`; at the start of the next run the plugin's `Screenshot::cleanup()` empties and removes that folder and calls `@rmdir()` on two sub-folders of it that do not exist (`Sliders`, `ImageDiffView`), and PHPUnit counts the two suppressed PHP warnings as test-runner warnings. They come from the plugin, are harmless, and the following run has none.
