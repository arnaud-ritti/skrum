# Plan 22: the Sessions page, creation options and ticket details in the poker room — report

Branch `plan-22-sessions-index` (worktree `.claude/worktrees/rm22`), cut from `roadmap` after the merges of plans 20, 21,
26, 27 and 29 (`3799fe61`). Spec: `docs/superpowers/specs/2026-10-21-plan-22-sessions-index-design.md`; plan:
`docs/superpowers/plans/2026-10-21-plan-22-sessions-index.md` (both keep their names, see Task 21). Final run on
2026-10-03 on the code of `888949b9` (the rector pass below); the commit after it adds this report only. Not pushed;
`main` and `roadmap` untouched. The controller ran every task in numeric order on this one branch (lanes flattened).

## 1. Result

One command at a time in the shared application container `skrum-laravel.test-1`, database `testing_l22`
(`TEST_DB_DATABASE=testing_l22`, `TEST_DB_WORKDIR=/var/www/html/.claude/worktrees/rm22`). PostgreSQL only (owner,
2026-10-03): SQLite, MariaDB and MySQL run in the roadmap's final four-engine matrix, not here.

| Run | Result |
|---|---|
| `bin/test-db pgsql --parallel --processes=4` (Unit, Feature, Upgrade, Arch) | `PASS, Tests: 2 skipped, 6966 passed (59554 assertions)` (4 min 50) |
| `bin/test-db pgsql --concurrency` | `PASS, Tests: 1 skipped, 47 passed (183 assertions)`, run before and after the rector pass |
| `bin/check-pg-upgrade` (databases `testing_l22_upgrade_old` and `_fresh`) | `PASS, every row is there, and the schemas are equal apart from the five legacy check constraints`; the two migrations of this plan ran on the old install |
| `bin/test-db pgsql -- tests/Feature/Sessions tests/Feature/Poker/TaskTimerTest.php tests/Feature/Integrations/TicketDetailsTest.php tests/Unit/Support/TrackerIssueLabelsTest.php tests/Arch` (after the rector pass) | `PASS, 222 passed (1042 assertions)` |
| `composer types:check` (PHPStan) | `passed`, 0 errors (before and after the rector pass) |
| `vendor/bin/pint --format agent` | `passed` |
| `composer rector:check` | fails on 234 files, as on the base; see §1.1 |
| `npm run test` (Vitest) | `501 files, 5246 tests passed` |
| `npm run types:check`, `npm run check` | no error; 1311 files formatted, no lint warning in 1294 files |
| `vp build`, then `wayfinder:generate --with-form` | built; nothing to commit afterwards |

`TranslationKeysTest`, `InformalRegisterTest`, `UuidPrimaryKeysTest` and `tests/Arch/DatabasePortabilityTest.php` passed
inside the whole suite. Browser walkthroughs and smoke tests were not run (owner's rule); the captures are those of
Task 20.

The migrations are dated `2026_10_28_100000_add_session_options_to_retros_and_poker_games` and
`2026_10_28_100100_add_ticket_details_to_poker_tasks`, not `2026_10_22_…`: plan 27 had used `2026_10_27_…`, so this
plan's two migrations come one day after the last one, as **Branch and run** asks.

### 1.1 Rector

`composer rector:check` is not clean on this branch, nor on its base (as in plans 18e, 19 and 27): 240 files before the
pass. As those plans did, the pass (`888949b9`) applied rector to the files plan 22 created: `latest('updated_at')` in
`ListTeamSessions`, `toBeLessThanOrEqual` in the race, `Bus::assertDispatched` with a typed closure only, `resolve()`
instead of `app()`, `toBeEmpty()`. Left as they were: `NewMethodCallWithoutParenthesesRector` (no file of the project
uses that form yet), the `Collection|GameRoom` type rector proposes for the `tap()` closure of
`SessionsPagesVisualTest` (the closure receives a room), and every finding in a file older than this plan, among them the
lines plan 22 edited in `PokerSettingsController`, `RetroSettingsController`, `PlayPokerCard`, `ImportPokerTasks`,
`PokerTaskSync`, `tests/Pest.php` and the visual tests.

## 2. Acceptance criteria (spec §12)

Every PHP test named here ran in the whole PostgreSQL suite above, unless the row says concurrency. Vitest files ran once
in `npm run test`. Criteria 3, 9 and 18 run on SQLite, MariaDB and MySQL in the roadmap's final matrix.

| # | Criterion | Proved by |
|---|---|---|
| 1 | Sidebar and tab bar open `teams.sessions.index` on Live; 403 for who cannot view the team; no access with a guest cookie | `TeamSessionsTest` ("shows the live sessions of the team by default", "refuses an unknown tab and an outsider"); `use-sidebar-model.test.ts` (the Sessions link is `/w/…/teams/t1/sessions`), `mobile-tab-bar.test.tsx` ("leads Sessions to the Sessions page…"). A guest cookie: the route sits behind `auth` and `verified` (`route:list`), so a guest cookie alone is redirected to the login; no separate test |
| 2 | Each tab lists its state, newest `updated_at` first, ties by id; an old retro with cards and no start is Live; a draft poll to its editors only | `ListTeamSessionsTest` ("puts each kind in the state its stored data says", "lists a draft poll to its editors only"); `sessions-page.test.tsx` ("carries the Draft badge on a draft poll") |
| 3 | 45 sessions of five kinds: 20, 20, 5, no duplicate, no gap, "45 sessions" | `ListTeamSessionsTest` ("walks 45 sessions of five kinds in pages of 20 without a duplicate or a gap"), PostgreSQL; `SessionCursorTest`; `TeamSessionsTest` ("opens the tab named in the query and pages with before", "ignores a malformed cursor…"); `sessions-page.test.tsx` ("asks for the next page with the cursor and appends it without duplicates", "ends the list with the total once there is no next page"); `lib/teams/sessions.test.ts`. Other engines: final matrix |
| 4 | Kind icon and colour, title, meta line (guests count), link; no icebreaker room of a retro, no poll of a retro | `ListTeamSessionsTest` ("describes each row with the data of its kind", "lists nothing of another team"); `session-row.test.tsx`, `sessions-page.test.tsx` ("lists a row per session, with its meta line and its link", "ends the meta line with the date on the Upcoming and Finished tabs only"); `session-type-picker.test.tsx` ("gives each kind the colours and the icon of its tile") |
| 5 | "New session" opens the same dialog; `?new=poker` opens poker | `NewSessionOptionsTest`; `team-new-session-dialog.test.tsx` (six cases, among them "opens on the poker form when the address asks for ?new=poker"); `sessions-page.test.tsx` ("opens the New session dialog from the empty state") |
| 6 | "Standard" stored and in the snapshot; 0, 61, an unknown phase refused; a phase change starts no timer, no `TimerChanged`; running runs on, paused stays paused; facilitator only in the settings | `PhaseTimersTest` (the first nine cases); `PhaseDurationsTest`; `PokerGameOptionsTest` ("stores phase durations as an object of minutes, null by default") |
| 7 | The offer: "<n> min" button and first menu entry ("… per topic" in Discussing), `seconds` = minutes × 60 to the existing endpoint; nothing for a participant; untimed phases as today | `PhaseTimersTest` ("starts the offered duration through the existing timer endpoint"); `lib/retro/phase-durations.test.ts` (`offerFor`), `timer.test.tsx`, `session-timer.test.tsx`, `board-topbar.test.tsx`, `board-settings.test.tsx`, `phase-timers-field.test.tsx` |
| 8 | "Timer per task: 3 minutes" sets a 180 s timer on each new round; reveals at expiry with auto reveal only | `TaskTimerTest` (four cases) |
| 9 | Change after reveal until the estimate is saved; closed afterwards; withdrawal refused; reveal and timer still refuse a revealed round; off = as today; race | `RevoteAfterRevealTest` (feature, five cases); concurrency `RevoteAfterRevealTest` ("never changes a card after the estimate is saved"), PostgreSQL; `room-dock.test.tsx`. Other engines: final matrix |
| 10 | "Write estimates" off queues nothing and says so; a chosen field is written; an unknown field refused at creation and in the settings | `PokerEstimateWriteBackOptionTest` (three cases); `PokerGameOptionsTest` ("refuses a timer outside the list and a field the connection does not have", "lets the facilitator change the options in the room", "gives the dialog the tracker sources and their fields"); `room-dialogs.test.tsx`, `poker-session-fields.test.tsx`, `lib/poker/game-options.test.ts` |
| 11 | Import at creation: tasks in the source's order with key, link, description, details; a missing id skipped and reported; a tracker error creates nothing; `import_ids` with `tasks` refused; 403 on the browse routes for another team | `PokerCreationImportTest` ("creates the game with the chosen tickets in the source order", "creates nothing when the tracker fails", "refuses an import with typed tasks, and an import without a connection", "browses the tracker from the team, as from a game"); `poker-import-field.test.tsx`, `tracker-issue-picker.test.tsx`, `lib/poker/tracker-browse.test.ts` |
| 12 | Team-scoped browse = game-scoped browse, no "already imported" mark, same limit | `PokerCreationImportTest` ("browses the tracker from the team, as from a game") |
| 13 | Jira type and labels, refreshed; Linear labels; GitHub labels and type; none by hand; guests see them, not the assignee | `TicketDetailsTest` (the first seven cases); `TrackerIssueLabelsTest`; `IssueTrackersTest` (Jira asks for `issuetype` and `labels`); `PokerRedactionTest` ("shows a guest the ticket details and the criteria section of a task, never its assignee") |
| 14 | Story card: type and labels on the first line, "Acceptance criteria" under the description, nothing for missing fields | `ticket-details.test.tsx` (six cases), `story-card.test.tsx`, `room-adapters.test.ts` |
| 15 | The criteria split (AC-1 to AC-7), for each tracker and by hand, members and guests; stored description whole; no stale cache | `AcceptanceCriteriaSectionTest` (nine cases); `TicketDetailsTest` ("splits the criteria of a task typed by hand and leaves its stored description whole", "never serves the html cached for the whole description", the guest case); `PokerRedactionTest` (guest) |
| 16 | Four languages, informal | `TranslationKeysTest`, `InformalRegisterTest` (Task 19 reviewed the values) |
| 17 | Captures light/1440/fr, compared with the mockups; overflow check | Task 20: `tests/visual/__screenshots__/sessions-live`, `sessions-finished`, `session-create-retro-options`, `retro-phase-timer-offer`, `session-create-poker-import`, `poker-story-details` (`-light-1440-fr.png`); compared in Task 21, the differences are rows P22-16 to P22-20 |
| 18 | Unit, feature, upgrade, arch and concurrency on PostgreSQL; `DatabasePortabilityTest` | §1 above. Other engines: final matrix |

## 3. Differences left with the mockups

All in the plan's **Pre-build deviations**: P22-01 to P22-15 answered by the owner on 2026-10-03 (P22-14 obsolete);
P22-16 to P22-20 ruled while building (Task 21) under the owner's autonomy mandate, to be confirmed by the owner:

- **P22-16** — the Sessions page has no page search; the topbar keeps the application's search.
- **P22-17** — the retro row shows the `layers` tile of `SessionTypePicker`, not the mockup's `sticky-note`.
- **P22-18** — French: "de l'équipe :team", "Tableau blanc", ":position / :total de la partie" and the facilitator's
  full name, values the application already had.
- **P22-19** — the import tab keeps "Importer depuis Jira" and the in-game browse form (Sprint / Query, "Show issues")
  before the list.
- **P22-20** — the help of "Timer per phase" lists every phase with a duration, then "Offered to the facilitator, never
  started by itself" from 40rem up.

## 4. Existing tests edited, and why

None deleted. The only case renamed is in `use-team-anchor.test.tsx`.

| Test | Edit | Why |
|---|---|---|
| `IssueTrackersTest` | the Jira search asks for `issuetype` and `labels` too | Task 5 reads type and labels |
| `PokerEstimateSyncTest`, `PokerTaskExternalTest`, `task-queue.test.tsx`, `task-source.test.tsx` | `external` carries `type` and `labels`; the room's Jira connection carries `estimateFields` and `defaultEstimateFieldId` | Tasks 6 and 11 (spec §18, "Poker room snapshot") |
| `TrackerToolsTest` (MCP) | the sources list carries `estimateFields` and `defaultEstimateFieldId` | Task 11: the same presenter feeds the dialog and the MCP tool |
| `PokerEventsTest`, `PokerSnapshotTest` | the task payload has `acceptanceCriteriaHtml` | Task 6 |
| `PokerRedactionTest` | one case added (guest payload) | Review Focus 5 |
| `TranslationKeysTest` | three keys held as data ("Upcoming sessions", "Live sessions", "Finished sessions") | the Sessions page's tab labels come from a map |
| `use-team-anchor.test.tsx` | `#sessions` and `#surveys` now fall back to the dashboard; the case is renamed | the team page's sessions block left for its own page (Task 14) |
| `use-sidebar-model.test.ts` | the Sessions link is asserted to be the Sessions page | criterion 1 |
| `session-type-picker.test.tsx` | a case for the exported kind tones | Task 13 |
| `new-session-dialog.test.tsx`, `poker-session-fields.test.tsx`, `poker-tasks-field.test.tsx`, `room-dialogs.test.tsx`, `room-dock.test.tsx`, `story-card.test.tsx`, `board-settings.test.tsx`, `board-topbar.test.tsx`, `timer.test.tsx`, `session-timer.test.tsx`, `room-adapters.test.ts`, `empty-state.test.tsx`, `team-page.test.tsx` | cases added for the new rows, the offer, the dock after reveal and the details; fixtures gain the new fields (`resources/js/test/poker-room.tsx`, `retro-board.tsx`) | Tasks 13 to 18 |
| `PokerPagesVisualTest`, `RetroFacilitationVisualTest`, `SessionCreateVisualTest` | new captures | Task 20 |

## 5. Plan 21's names

- The per-card cap is plan 21's `retros.max_votes_per_card`, sent by `retro-session-fields.tsx` and accepted by
  `RetroSettingsController`; plan 22 adds nothing for it.
- The offer starts the retro timer through plan 21's endpoint `retros.timer.update` (`PUT`, `seconds`), facilitator
  only. In Discussing, plan 21's `RetroTimersController` keeps the started length as `retros.topic_seconds`, so the
  offer is "… per topic" and `offerFor` marks it `perTopic`; no start bypasses that rule.
- With a timer running or paused (plan 21's `timer_paused_seconds`), the one-click "<n> min" button is hidden
  (`skrum/timer.tsx`: shown only while no timer runs and none is paused); the menu keeps the offered entry. A phase
  change leaves a paused timer paused (`PhaseTimersTest`).
- No task of plan 21 was skipped: plan 21 was merged into the base before Task 1.

## 6. Questions the spec left open

- **GitHub `issueType` (§16.3): kept.** The GraphQL fragment asks for `issueType { name }`, the REST mapping reads
  `type.name`; a repository without issue types gives none and the card shows no type (`TicketDetailsTest`, the two
  GitHub cases).
- **§16.2, per topic: applied** as §5 says.
- **§16.8, English heading only: applied.** `AcceptanceCriteriaSection::Headings` is `['acceptance criteria']`;
  "Critères d'acceptation" and "Definition of done" split nothing (`AcceptanceCriteriaSectionTest`, "splits nothing
  outside the rules").

## 7. Decisions taken on the owner's behalf

- P22-16 to P22-20 (§3).
- The cursor is bound in the application timezone (spec §18), and a malformed cursor starts from the first page rather
  than refusing the request.
- The import at creation fetches before the game exists and writes through `ImportPokerTasks::storeIssues` (spec §18).
- "Timer per phase" and "Write estimates to <source>" stop at 14rem so that their longest choice shows whole.
- The two migrations are dated `2026_10_28` (§1).
- The rector pass of §1.1, limited to the files this plan created.
