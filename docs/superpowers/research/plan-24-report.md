# Plan 24: action items, bulk changes, filters, "In progress" and export — report

Branch `plan-24-action-items` (worktree `.claude/worktrees/rm24`), cut from `roadmap` at `1d2b51b2` (plans 20 to 23,
26, 27 and 29 merged). Spec: `docs/superpowers/specs/2026-10-21-plan-24-action-items-design.md`; plan:
`docs/superpowers/plans/2026-10-21-plan-24-action-items.md`. Final run on 2026-10-04 on the code of `e00a131c`
(Task 18); the commit after it adds this report only. Not pushed; `main` and `roadmap` untouched.

The controller ran every task in numeric order on this one branch (lanes flattened), so **Tasks 20 to 24 (search `q`,
the sprints of the page, the sidebar's "n overdue", the "By sprint" grouping and the topbar search field) run after
this report**: see §1.2 and criteria 26 to 30. The report was written where plans 22, 23, 26, 27 and 29 put theirs
(`docs/superpowers/research/plan-NN-report.md`): the path the plan names, `.superpowers/sdd/roadmap/plan-24/report.md`,
is excluded from git (`.git/info/exclude`) and lives in the main tree, which this run does not touch.

## 1. Result

One command at a time in the shared application container `skrum-laravel.test-1`, database `testing_l24`
(`TEST_DB_DATABASE=testing_l24`, `TEST_DB_WORKDIR=/var/www/html/.claude/worktrees/rm24`). PostgreSQL only (owner,
2026-10-03): SQLite, MariaDB, MySQL and `sqlite-file` run in the roadmap's final four-engine matrix, not here.

| Run | Result |
|---|---|
| `bin/test-db pgsql --parallel --processes=4` (Unit, Feature, Upgrade, Arch) | `PASS, Tests: 2 skipped, 7290 passed (60945 assertions)` |
| `bin/test-db pgsql --concurrency` | `PASS, Tests: 1 skipped, 53 passed (201 assertions)` |
| `composer types:check` (PHPStan) | `passed`, 0 errors |
| `vendor/bin/pint --dirty --format agent` | `passed` |
| `npm run test` (Vitest) | `541 files, 5561 tests passed` |
| `npm run types:check`, `npm run check` | no error; 1395 files formatted, no lint warning in 1378 files |
| `npx vp build`, then `wayfinder:generate --with-form` | built; nothing to commit afterwards |

`TranslationKeysTest`, `InformalRegisterTest`, `tests/Upgrade/ActionItemStartedAtTest.php` and
`tests/Arch/DatabasePortabilityTest.php` ran inside the whole suite. Browser walkthroughs and smoke tests were not run
(owner's rule); the captures are those of Task 16 (`8b120da4`).

The one migration of this plan is `2026_10_24_100000_add_started_at_to_action_items`: no merged plan used that day.

### 1.1 The 500-item cap (Task 8)

A 500-item "all matching" completion took **2.44 s** on PostgreSQL (`bf209007`), far under Octane's 30-second limit:
the cap stays at 500 (`ActionItemBulkChanges::MatchingCap`); the lowering rule of Task 8, Step 5 did not apply.

### 1.2 Tasks 20 to 24 are not built yet

`app/`, `resources/js/`, `database/` and `lang/` hold no `external_key_search`, `items.sprints` / `withoutSprint`,
`ActionItemGroupMeta` or "Search an action item, a ticket…". Task 18's documents word those parts as decided, not as
built (`e00a131c`), and Task 16's bench has no `sprint-groups` or `search` state yet. Criteria 26 to 30 are proved by
those tasks; their runs update these rows, and the PostgreSQL suites run again after them.

## 2. Acceptance criteria (spec §13)

Every PHP test named here ran in the whole PostgreSQL suite above, unless the row says concurrency or upgrade. Vitest
files ran once in `npm run test`.

| # | Criterion | Proved by |
|---|---|---|
| 1 | Start / stop, `started_at`, `ActionItemProgressChanged`, no completion events | `ActionItems/ActionItemInProgressTest.php`: "starts an open item and puts it back to do, without completion events", "changes and announces nothing when the item already has the status" |
| 2 | Completing a started item, next occurrence open, reopening to open or doing | `ActionItemInProgressTest.php`: "keeps the start when a started item is completed, and the next occurrence starts to do", "reopens a completed item to do or in progress" |
| 3 | Guest assignee starts on the board; 403; sub-tasks 422 | `ActionItemInProgressTest.php`: "lets a guest assignee start their item on the board", "refuses to start an item to a member who may not complete it", "keeps two states for sub-tasks" |
| 4 | Existing items read open or completed, rank unchanged | upgrade: `tests/Upgrade/ActionItemStartedAtTest.php` "reads every row from before the column as to do or done, with its rank unchanged" |
| 5 | Three-state tracker reads | `Integrations/ApplyIssueChangesTest.php`: "starts an open item when its issue is in progress, as the system and without a push", "starts an item on a locked board as the system", "puts a started item back to do when its issue went back to do after the start", "keeps a newer unpushed start and pushes it", "reopens a completed item into in progress when the source reopens it into an in-progress status", "reads a started item as open for GitHub and as started for Jira and Linear"; `IssueStatusReadsTest.php` "maps source states to done or open" |
| 6 | Start and stop pushes, start targets, failed writes | `Integrations/ActionItemStatusPushTest.php`: "queues a push when a manager starts or stops a synced item", "does not push a start that came from the source", "pushes a started item to the in-progress status and records it", "records a start the workflow cannot take, and keeps the item started", "pushes a stopped item back to the open status", "keeps a stopped item to do when the Jira workflow has no way back to to do"; `IssueTransitionsTest.php`: "starts a Jira issue through the configured start status, else the first in-progress one", "explains when no transition reaches an in-progress status", "refuses a start transition that needs other fields", "skips the start when the Jira issue is already in progress", "moves Linear issues to the configured start state, else the first started one", "stops an in-progress Jira issue only through a to-do transition" |
| 7 | Start status settings | `Integrations/StatusSyncSettingsTest.php`: "saves and resets a start status per Jira project and a start state per Linear team", "validates status mappings", "reserves status sync to owners and admins, before validation", "presents the start target as null in a mapping saved before it existed"; Vitest `integrations/trackers.test.tsx`: "offers a start target before the two others, and saves it", "saves the start state of a Linear team" |
| 8 | Status, priority, due and source filters | `ActionItems/ActionItemFiltersTest.php`: "filters by status, several at once", "filters by priority, due date and source" |
| 9 | Single values of before; canonical `filters` | `ActionItemFiltersTest.php`: "reads the single values of before as before", "gives the filters back in their canonical form"; `ActionItemsPageTest.php` (the new shape); Vitest `use-action-item-filters.test.ts` "sends a stored entry of before unchanged, for the server to read". `q: null` comes with Task 20 |
| 10 | Counters | `ActionItemFiltersTest.php` "counts under team, assignee, priority and source, whatever the status and the due date" (the search part comes with Task 20) |
| 11 | MCP `retro.actions.list` | `Mcp/RetroListToolsTest.php` "lists started action items and keeps the single statuses of before"; `Mcp/ActionItemWriteToolsTest.php` "leaves a started item in progress when it is not completed" (`f8fc543d`) |
| 12 | Bulk update, one broadcast per item, completions | `ActionItems/ActionItemBulkUpdatesTest.php`: "changes every item the member may change, and announces each", "completes in bulk, with one next occurrence and one completion per item", "starts items in bulk" |
| 13 | Mixed refusals, nothing leaks | `ActionItemBulkUpdatesTest.php`: "changes what it can and refuses the rest, each with its reason", "refuses an assignee who is not in the item's team, item by item", "refuses each item of a team the member only observes", "goes on past an item that fails unexpectedly, and reports it" |
| 14 | 422 on a bad request | `ActionItemBulkUpdatesTest.php` "refuses a request it cannot read"; `ActionItemBulkDeletionsTest.php` "refuses an empty or oversized list"; `ActionItemBulkMatchingTest.php` "refuses a target it cannot read" |
| 15 | "All matching" | `ActionItems/ActionItemBulkMatchingTest.php`: "changes every visible item the filters match, and only those", "reads empty filters as the landing filters", "never reaches a team the member cannot see through the filters", "refuses the items the member may not change, with their title, in the order of the list", "changes nothing when the list changed since the member counted it", "refuses more matching items than the cap, and changes the cap in one request", "deletes every matching item the member may delete", "keeps other workspaces out of the filters target" |
| 16 | Races | concurrency: `tests/Concurrency/ActionItemBulkTest.php` "completes the same recurring items twice at once and leaves one next occurrence each", "deletes and changes the same items at once without a failure, and leaves none", "starts the same matching items twice at once without a failure" (the "all matching" race starts the items rather than completing them; see §4) |
| 17 | Bulk deletion | `ActionItems/ActionItemBulkDeletionsTest.php`: "deletes what the member may delete and refuses the rest", "lets a workspace admin delete any item in bulk" |
| 18 | CSV export, 403 outside the workspace | `ActionItems/ActionItemCsvExportTest.php`: "exports every matching item of every page, in the order of the list, with its columns", "follows the filters of the page and the viewer's visibility", "neutralises formulas", "writes the header in the viewer's language", "keeps people outside the workspace out"; the bulk routes: "keeps guests and other workspaces out" in `ActionItemBulkUpdatesTest.php` and `ActionItemBulkDeletionsTest.php`; the shared limiter: "allows twenty bulk changes and exports a minute" |
| 19 | Selection and bulk bar from 80rem | Vitest `action-items-bulk-bar.test.tsx` (count, status, common members, refused items kept selected, delete with confirmation), `action-items-page.test.tsx` ("selects rows on the table and shows the bulk bar", "clears the selection when the filters change", "clears the selection with Escape"), `action-item-select-cell.test.tsx`, `use-action-item-selection.test.ts` ("drops a row that left the list", "clears the rows on a page change"), `lib/action-items/selection.test.ts`, `lib/action-items/bulk.test.ts` |
| 20 | "All matching" on the page | Vitest `action-items-bulk-bar.test.tsx` ("offers every matching item once the page is selected", "refuses above the cap", "asks before a change, and Cancel sends nothing", "applies the change to the filters and reloads", "keeps the dialog open when the list changed, then sends the new count", "leaves the mode when a row is unticked", "is disabled in all matching mode, with its reason"), `use-action-item-selection.test.ts` ("keeps all matching over a page change and clears it on a filter change"), `action-items-page.test.tsx` ("keeps all matching over a page change, and reloads after a change") |
| 21 | Below 80rem: Select, long press, phone bar | Vitest `action-items-header.test.tsx`, `action-items-list.test.tsx` ("enters the mode on a long press of 500 ms, not on a 200 ms press"), `use-long-press.test.tsx`, `action-items-page.test.tsx` ("enters selection mode below the table with Select, and Finish selecting clears it", "enters selection mode with the item of a long press selected"), `action-items-bulk-bar.test.tsx` ("shows Status, Assign and Due date, and the rest under More actions") |
| 22 | "Sync to :tracker" | Vitest `action-items-bulk-bar.test.tsx` ("is hidden for a selection of two teams", "is hidden for a team without a tracker", "exports the unlinked items one after the other and skips the linked one", "stops on a reconnect answer and lists it in the details", "ends after the current item when stopped"), `use-bulk-tracker-export.test.ts` |
| 23 | Three statuses everywhere | Vitest `action-items-table.test.tsx` "reads, names and advances each of the three statuses from the badge", `action-items-list.test.tsx`, `action-item-sheet.test.tsx`, `skrum/action-sheet.test.tsx`, `retro/action-items-list.test.tsx` "cycles an item To do → In progress → Done → To do from its status button", `retro/carried-items-sheet.test.tsx` "counts an item in progress as open on its button", `lib/action-items/status.test.ts`; `ActionItemInProgressTest.php` "labels the three statuses" |
| 24 | Translations, informal register, captures | `TranslationKeysTest`, `InformalRegisterTest` in the whole suite; captures of Task 16 in `tests/Browser/Visual/ActionsPageVisualTest.php` and `SettingsPagesVisualTest.php` (light, 1440, French), compared with ScreenActions (`8b120da4`); the `sprint-groups` and `search` states come with Tasks 23 and 24 |
| 25 | Suites on PostgreSQL | §1 |
| 26 | Search `q` | Task 20, not built yet (§1.2) |
| 27 | `items.sprints` | Task 21, not built yet |
| 28 | "By sprint" grouping | Task 23, not built yet |
| 29 | Topbar search field | Task 24, not built yet |
| 30 | Sidebar "n overdue" | Task 22, not built yet |

## 3. Differences left with the mockups

All in the plan's **Pre-build deviations**: P24-01 to P24-12, answered by the owner on 2026-10-03, and **P24-13**, added
by Task 16 and **waiting for the owner**: the bulk bar's "Sync to :tracker" is a secondary button with lucide `send`,
not the mockup's Jira mark, as no provider mark exists in the application (D-86). Fixed in Task 16 from the comparison:
the sync button is secondary, and the docked phone bar hides its labels below 32rem so it fits.

## 4. Existing tests edited, and why

PHP (expectations changed, each named in the commit that changed it):

- `PresentActionItemTest.php`: the whole-payload expectation gains `'startedAt' => null` (`ddac3a8c`).
- `ApplyIssueChangesTest.php`: "only records the read when both sides agree" now reads a to-do issue; its In Review
  case is a new test. `IssueStatusReadsTest.php`: the rows "jira in progress" and "linear started" of "maps source
  states to done or open" read `Started` (`49c3f983`).
- `StatusSyncSettingsTest.php`: "saves and resets a status mapping per project" stores `startStatusId` (null); three
  rows added to "validates status mappings" (`ba7c98d6`).
- `ActionItemsPageTest.php`: the `filters` prop has the new shape (`b8b9c526`).

Vitest (`aa887b9d`): status `'open'` becomes `['todo', 'doing']` in `use-action-item-filters.test.ts`,
`action-item-filters.test.tsx` and `action-items-page.test.tsx`; the overdue shortcut is now due `'overdue'`; status
`'all'` becomes the three statuses; the stored entry after a team reset is written in canonical form;
`board-dialogs.test.tsx`'s invalid `'done'` status is `'completed'`, with one item `'doing'`; `ActionItem` fixtures gain
`startedAt: null`. The panel's done-status save case in `trackers.test.tsx` sends `start_status_id` (null).

No test was deleted.

Criterion 16 names two concurrent "all matching" **completions**; the race of this plan runs two "all matching"
**starts** of the same filters ("starts the same matching items twice at once without a failure"). Both go through the
same count check and per-item lock; the completion race over ids covers the next occurrences.

## 5. Walkthroughs

The plan asks for the walkthrough files whose selectors this plan changed (`aria-label="Status"`, "Mark as done",
`status=overdue`). By the controller's rule for this roadmap, `tests/Browser/Walkthroughs` is neither read, written nor
run, so that list was not drawn up. What changed for a walkthrough: the status button cycles To do → In progress →
Done, so one click on a to-do item starts it instead of completing it; the overdue shortcut is now `due=overdue`
(`?status=overdue` still lands on the same items).

## 6. Not determined by reading (spec §16)

1. Settled: plans 21 and 23 were merged; their code was read by each task.
2. The bulk bar's due date uses `components/ui/calendar.tsx` inside the bar's popover (`action-items-bulk-bar.tsx`)
   without change to the calendar.
3. No MCP contract snapshot pins `retro.actions.list`'s enum: only `RetroListToolsTest.php` and
   `ActionItemWriteToolsTest.php` gained cases.
4. Measured: 2.44 s for 500 items (§1.1).
5. Still open: whether every Linear workspace uses the `started` type for its "In Progress" columns, and whether a team
   uses Jira `indeterminate` statuses meaning "blocked". "Start to" settles the push side per project or team, not the
   read side.
6. The visual harness captured the selection states from the bench section (Task 16), as planned, not from the real
   page.

## 7. What was learnt

- A bulk loop must catch an unexpected failure of one item and report it as a refusal, or one item aborts the answer
  of the whole request (`c1084999`).
- "All matching" is offered only when the list goes beyond the rows shown, counting the rows the viewer cannot select
  (`8e58f22e`; the plan's `matchingOffer` gained `rowsShown`).
- A stop out of an in-progress Jira status must take a to-do transition only; a sideways move to another in-progress
  status would let the next read start the item again (`c982193c`).
- The bulk routes and the export share one limiter, twenty requests a minute per member (`e7d3bfe9`).
