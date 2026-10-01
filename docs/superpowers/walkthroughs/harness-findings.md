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
- Workaround: `p10bWorkQueueOutsideAnyRequest()` in `tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php` binds a fresh `Request::create('/')` and then runs `queue:work --once`. Use it (or do the same) before any job, action or model event that the test body runs and that broadcasts. A general cure in `BrowserTestCase` is left to plan 16b.

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

- `dragWithKeyboard()` ends with `assertAttributeMissing($handle, 'aria-pressed')`, so it cannot be used when the drop removes the handle (dropping a card onto another to group them). `[P04-03]` sends the same keys and waits by hand, then asserts `assertNotPresent($handle)`.

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
