# Action items: selection and bulk changes, priority / due-date / source filters, "In progress", export (Plan 24) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to run this plan task by task (through the Workflow tool, as the project does). Steps use checkbox (`- [ ]`) syntax. Every agent reads **Owner decisions**, **Global Constraints**, **Pre-build deviations** and its own task before anything else, then `docs/database.md` ("Rules for database code" and "Running the tests on an engine") for any task that touches PHP. A screen task also follows the "Screen task procedure" of `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, with the working rules below (no walkthrough, captures in Task 16 only).

**Status: revised 2026-10-03 on the owner's answers to spec §15** (`.superpowers/sdd/roadmap/progress.md`, "Owner answers 2026-10-03", line "Plan 24"). Answers 2 (C) and 6 (B) differ from the draft's recommendation; the plan is rewritten on them (Tasks 2, 3, 4 and 8 are new or rewritten; Tasks 6, 7, 10, 13, 14 changed). **Second revision, 2026-10-03, on the pre-build deviation answers** (`progress.md`, "Pre-build deviations (owner, 2026-10-03)", line "P24"): P24-03 adds a "By sprint" grouping, the default (Tasks 21, 23), and moves this plan after plan 23; P24-07 builds the topbar search field (Tasks 20, 24); P24-08 words the sidebar badge (Task 22); every other row approved as listed. Per-plan verification is PostgreSQL only (owner: the four-engine matrix runs once at the end of the roadmap). Nothing waits for the owner.

**Goal:** On the action items page a member selects rows — or every item matching the filters — and changes their status, assignee, due date or priority, sends them to the team's tracker, or deletes them, each item checked on its own; filters by several statuses, priorities, a due-date bucket, a source and a topbar search; groups the list by sprint by default; marks items "In progress" anywhere an item's status is shown, synced both ways with Jira and Linear through a configurable start status; and downloads the filtered list as CSV. The sidebar names the overdue count in words.

**Architecture:** "In progress" is a nullable `action_items.started_at` beside `completed_at`, which stays the one source of completion; `ActionItemStatus` gains `Doing`, `ActionItem::currentStatus()` derives the status, `SetActionItemStatus` handles the six transitions and fires a new domain event `ActionItemProgressChanged` on start and stop. The tracker sync gains a third state: `ExternalIssueState::Started`, `DoneMapping::state()` reads it from the in-progress category of Jira and Linear, `DoneMapping::itemState()` gives an item's state per provider, and the existing conflict rules, push job and transition choosers carry it, with a `startStatusId` / `startStateId` target per project or team saved by the status mapping settings. `ActionItemFilters` becomes lists and buckets read from the query or from an array (old single values mapped), and `ActionItemQuery` applies them to the list, the counters, the CSV export and the "all matching" bulk target. Two bulk endpoints loop over the single-item actions (`ApplyActionItemChanges`, `DeleteActionItem`), one transaction and one lock per item, over ids or over the ids the filters match (count checked, cap 500), and report refusals per item. The front fills the places plan 18e left in `ActionItemsPage` (`selectionCell`, `selectionHead`, `bulkBar`, `extraFacets`, `withDoing`, `NewActionItemButton.before`) and adds "Start to" to the status mapping panel. A search parameter `q` (the item's folded text, or a ticket key through a new `external_key_search` column) joins `ActionItemFilters`; the page's `items` prop carries `sprints` (plan 23's `team_sprints` containing the rows' creation days), from which the front groups by sprint by default; the topbar's search place holds the page's own field on this page; the sidebar badge is worded.

**Tech Stack:** Laravel 13, PHP 8.4, Pest (feature, unit, upgrade, arch, concurrency), Inertia 3, React 19, Tailwind 4, vite-plus (Vitest), Wayfinder, Reverb, Octane; PostgreSQL through `bin/test-db pgsql` (the code stays portable to MariaDB, MySQL and SQLite; their matrix runs at the end of the roadmap, not here); `Tests\Concurrency\Support\Race` for races. Run `composer show --direct` and read `package.json` before Task 1 and stop if a major differs.

**Spec:** `docs/superpowers/specs/2026-10-21-plan-24-action-items-design.md`. Parent: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` §5. Mockups: `docs/design-system/components/ScreenActions`, `ActionItem`, `MobileDashboard`, `Checkbox`, `Popover`, `Command`, `DatePicker`, `DropdownMenu`, `Sonner` — for each, the `README.md` and the `preview.html`. The status mapping panel has no mockup (P24-12).

**Not in this plan:** the backlog of spec §3 (whiteboard and survey sources, a search of comments or sub-tasks, a server-side grouping by sprint, "all matching" beyond 500, a queued bulk change and exclusions, "Sync to :tracker" for an "all matching" selection, bulk on the retro board, "In progress" on GitHub, a webhook event for it, other export formats); browser walkthroughs (owner's working rule: none is written, edited or run); anything of the former plans 28 and 30 and scheduling.

**Tasks:** 24, numbered in the order they were written; they **run** in this order:
- Step A, back end, single writer: 1 to 9, then **20** (search `q`) and **21** (sprints of the page). Task 4 also touches the integrations front.
- Step B, front foundation, single writer: 10, then **22** (sidebar badge in words).
- Step C, screens, lanes cut from the head of Task 22: Status (11), Filters (12), Bulk (13, 14), Export (15), Grouping (**23**), Search (**24**).
- Final: 16 (bench and captures), 17 (translations), 18 (deviations and documents), 19 (PostgreSQL suites and report).

## Branch and run

- Base: the head of `roadmap` once plan 23 is merged into it (execution order of 2026-10-03: parallel 20, 21, 26, 27, 29 → 22 → 23 → 24 and 25). Plans 20, 21, 22, 23, 26, 27 and 29 are then merged; plan 25 runs in parallel on its own branch. Check before Task 1, and stop if one fails: plan 23 is merged (`app/Models/TeamSprint.php` with `present()`, `Team::sprints()`, the helper `teamSprint()` of `tests/Pest.php`, `TeamRole` read by `ActionItemPermissions`); plan 21 is merged (`resources/js/lib/action-items/bulk-export.ts` exports `runBulkExport` and `itemsToExport`, `components/action-items/export-target-fields.tsx` exists); `app/Enums/ActionItemStatus.php` has exactly `Open` and `Completed`; `app/Enums/ExternalIssueState.php` has exactly `Open` and `Done`; `app/Support/Integrations/Trackers/DoneMapping.php` has `state`, `category` and `configured`; `resources/js/components/action-items/action-items-page.tsx` declares the slots `selectionCell`, `selectionHead`, `bulkBar`, `extraFacets`; `resources/js/components/skrum/action-item.tsx` exports `nextActionStatus` and accepts `withDoing`; `resources/js/components/integrations/status-mapping-panel.tsx` has the "Complete to" and "Reopen to" selects; `bin/test-db` exists and `bin/test-db pgsql -- tests/Arch` passes; `tests/Concurrency/Support/Race.php` exists; no file `database/migrations/2026_10_24_*` exists (plan 23's migrations are dated `2026_10_23_…`, plan 25's `2026_10_25_…`; if a merged plan took `2026_10_24_…`, take the first free `2026_10_24_1xxxxx` numbers and rename the two migrations of this plan and the upgrade tests' `$migration` with them). Plans 21 and 23 changed `ActionItem`, `PresentActionItem` (`cardId`), `ActionItemPermissions` (team roles, the observer), `SetActionItemStatus` and the action-items components: every task re-reads them before editing.
- Branch `plan-24-action-items` from that base. Merged into `roadmap` when Task 19 passes (the controller's merge; `main` is fast-forwarded only when the owner asks); no push. Whichever of plans 24 and 25 merges second rebases on the other (`lang/*.json`, `routes/web.php`, `tests/Pest.php`) and runs the PostgreSQL suites again.
- Steps A and B run on that branch with one writer. Lanes run in git worktrees on branches `lane/24-<name>`, cut from the head of Task 22; the controller merges one lane at a time and runs the gates after each merge: `npm run types:check`, `npm run check`, `npm run build:front`, `vendor/bin/pint --dirty --format agent`, `vendor/bin/sail composer types:check`, `npm run test -- resources/js/components/action-items resources/js/lib/action-items resources/js/components/skrum resources/js/layouts`, and `bin/test-db pgsql -- tests/Feature/ActionItems tests/Arch`.
- From a worktree, `bin/test-db` needs `TEST_DB_CONTAINER` (the running application container) and `TEST_DB_WORKDIR` (the worktree's path inside it). Only PostgreSQL is used in this plan: MariaDB and MySQL are not started. Never run two whole suites at once in the shared container.
- Between Task 5 (the `filters` prop becomes lists) and Task 10 (the front reads them) the page's filters misbehave at runtime on this branch. Nothing is merged in between. Tasks 20 and 21 run between Task 9 and Task 10 for the same reason (they change the `filters` and `items` props).
- Every task re-reads the files it touches; a line number or a method body quoted here that no longer matches is followed in spirit and reported.

## Owner decisions

The seven questions of spec §15, answered by the owner on 2026-10-03. Every row is answered; the plan is written on the answers.

| # | Question | Answer | Where the plan carries it |
|---|---|---|---|
| 1 | A bulk change meets an item it cannot change | **A** (as recommended): per-item outcome, refusals listed | Tasks 6, 7, 8 (loop, refusals with title), 13 (toast and "Details") |
| 2 | "In progress" and trackers | **C** (differs from the recommendation B): both ways, with a configurable start status per Jira project and Linear team | Task 1 (`ActionItemProgressChanged`), Task 2 (three-state reads and sync state), Task 3 (start pushes and their listener), Task 4 (start status settings, server and "Start to" select) |
| 3 | "Sync to Jira" in the bulk bar | **A** (as recommended): browser loop over the per-item export, one by one | Task 14 (rows only; disabled in "all matching" mode) |
| 4 | Due-date buckets | **A** (as recommended): overdue, today, next 7 days, later, none | Task 5, Task 12 |
| 5 | What "Export" downloads | **A** (as recommended): CSV of every matching item, all pages | Task 9, Task 15 |
| 6 | How far a selection reaches | **B** (differs from the recommendation A): "Select all n matching", sent as filters to the server | Task 5 (`ActionItemFilters::fromQuery`), Task 8 (filters target, count check, cap 500, race, measurement), Task 10 (bulk client and selection modes), Task 13 ("Select all :count matching", confirmation naming the count, changed-count answer), Task 14 (the phone "…" entry) |
| 7 | Phone selection | **A** (as recommended): long press and a "Select" button | Task 14 |

The pre-build deviation rows, answered by the owner on 2026-10-03 (`progress.md`, "Pre-build deviations (owner, 2026-10-03)", line "P24"):

| Row | Answer | Where the plan carries it |
|---|---|---|
| P24-03 | **Add the "By sprint" grouping, the default** (≠ the row as drafted); plan 24 runs after plan 23 | Task 21 (`items.sprints`), Task 23 (grouping, header, table and list group rows), Task 16 (state `sprint-groups`), Task 18 (D-19) |
| P24-07 | **Build the mockup's topbar search field, filtering action items** (≠ the row as drafted) | Task 20 (`q`, `external_key_search`), Task 24 (field, ⌘K, drawer), Task 16 (state `search`), Task 18 (PB-12) |
| P24-08 | **"Actions · n overdue" in the sidebar, as the mockup** (≠ the row as drafted; settles D-129 for this entry) | Task 22, Task 18 (D-129) |
| P24-01, 02, 04, 05, 06, 09, 10, 11, 12 | Approved as listed | unchanged |

Open points of the first revision, ruled on 2026-10-03 (spec §14, last risk): the "Automatic" start target, "both ways" moving a started item back to "to do", the release case, the Jira reopen fallback and the two-tab case are kept as specified; the 500 cap follows the rule of Task 8, Step 5 (lower the cap, never stop); "Sync to :tracker" stays disabled in "all matching" mode (P24-06, P24-11 approved); whether the team integrations page is captured is decided by reading in Task 16.

## File structure

Back end, created:

| File | Responsibility |
|---|---|
| `database/migrations/2026_10_24_100000_add_started_at_to_action_items.php` | the `started_at` column |
| `app/Events/ActionItems/ActionItemProgressChanged.php` | start and stop of an item (domain event, not broadcast) |
| `app/Listeners/QueueProgressedActionItemStatusPushesListener.php` | queues the tracker pushes of a start or stop |
| `app/Actions/ActionItems/ActionItemBulkChanges.php` | the per-item loop for updates and deletions, and the "all matching" ids |
| `app/Http/Requests/ActionItems/ActionItemBulkUpdateRequest.php`, `ActionItemBulkDeletionRequest.php` | validation of the bulk bodies (ids or filters and count) |
| `app/Http/Controllers/WorkspaceActionItemBulkUpdatesController.php`, `WorkspaceActionItemBulkDeletionsController.php` | the two bulk routes |
| `app/Support/CsvCell.php`, `app/Support/CsvDownload.php` | formula neutralisation and the streamed download, shared with the survey CSV |
| `app/Actions/ActionItems/ExportActionItemsCsv.php`, `app/Http/Controllers/WorkspaceActionItemCsvExportsController.php` | the list export |
| `database/migrations/2026_10_24_100100_add_external_key_search_to_action_item_external_links.php` | the folded ticket key the search reads (Task 20) |
| `app/Actions/ActionItems/ActionItemSprints.php` | the sprints of the page's rows (Task 21) |

Back end, modified: `app/Enums/ActionItemStatus.php`, `app/Enums/ExternalIssueState.php`, `app/Models/ActionItem.php`, `database/factories/ActionItemFactory.php`, `app/Actions/ActionItems/{SetActionItemStatus,ActionItemSubtaskRules,ActionItemFilters,ActionItemQuery}.php`, `app/Actions/Retros/PresentActionItem.php`, `app/Actions/Integrations/{ApplyIssueChanges,LinkStatusSync,UpdateStatusSyncSettings}.php`, `app/Support/Integrations/Trackers/{DoneMapping,LinearTracker}.php`, `app/Support/Integrations/Jira/JiraTransitions.php`, `app/Exceptions/Integrations/StatusPushRejected.php`, `app/Jobs/Integrations/PushActionItemState.php`, `app/Actions/TeamSurveys/ExportSurveyCsv.php`, `app/Http/Controllers/TeamSurveys/TeamSurveyExportsController.php`, `app/Http/Controllers/WorkspaceActionItemsController.php` (Task 21: `items.sprints`; the `filters` prop follows `ActionItemFilters::toArray()`), `app/Models/ActionItemExternalLink.php` (Task 20: `HasSearchColumns`), `app/Mcp/Tools/Retro/ListActionItems.php`, `routes/web.php`.

Tests, created: `tests/Feature/ActionItems/ActionItemInProgressTest.php`, `ActionItemFiltersTest.php`, `ActionItemBulkUpdatesTest.php`, `ActionItemBulkDeletionsTest.php`, `ActionItemBulkMatchingTest.php`, `ActionItemCsvExportTest.php`, `ActionItemSearchTest.php` (Task 20), `ActionItemSprintsTest.php` (Task 21); `tests/Upgrade/ActionItemStartedAtTest.php`, `tests/Upgrade/ExternalKeySearchTest.php` (Task 20); `tests/Concurrency/ActionItemBulkTest.php`. Modified by Task 20: `tests/Feature/ActionItems/ActionItemFiltersTest.php` (two expectations of Task 5 gain `'q' => null`). Modified: `tests/Feature/Integrations/ApplyIssueChangesTest.php` (new cases; one existing test's input, Task 2), `tests/Feature/Integrations/IssueStatusReadsTest.php` (two dataset rows, Task 2), `tests/Feature/Integrations/StatusSyncSettingsTest.php` (one expectation and new cases, Task 4), `tests/Feature/Integrations/IssueTransitionsTest.php` and `ActionItemStatusPushTest.php` (new cases, Task 3), `tests/Feature/Mcp/RetroListToolsTest.php` (one new case).

Front end, created: `resources/js/lib/action-items/{selection,bulk,status}.ts` and their `.test.ts`; `resources/js/components/action-items/{use-action-item-selection.ts,action-item-select-cell.tsx,action-items-bulk-bar.tsx,bulk-assign-menu.tsx,bulk-result-toast.tsx,bulk-delete-confirm.tsx,bulk-matching-confirm.tsx,use-bulk-tracker-export.ts,use-long-press.ts,action-item-facets.tsx,export-action-items-button.tsx}` and their tests. Modified: `lib/retro/types.ts`, `types/integrations.ts`, `components/integrations/status-mapping-panel.tsx` and `trackers.test.tsx`, `components/action-items/{action-items-page,action-items-table,action-items-list,action-item-sheet,action-item-filters,action-item-filters-drawer,use-action-item-filters,action-items-header}.tsx|ts`, `components/skrum/{action-item,action-sheet}.tsx` (only if a prop is missing; each such change is its own commit), `components/retro/{board-dialogs,action-item-rows,carried-items-sheet}.tsx`, `pages/action-items/index.tsx`, `pages/dev/sections/actions-index.tsx`, `tests/Browser/Visual/ActionsPageVisualTest.php` (captures only), `lang/{en,fr,es,de}.json`. Second revision: created `components/action-items/action-item-search-field.tsx`, `action-item-group-meta.tsx` and `lib/action-items/search.ts` (+ tests); modified `lib/action-items/grouping.ts` (+ test), `components/action-items/{action-items-page,action-items-table,action-items-list,action-item-filters-drawer}.tsx`, `pages/action-items/index.tsx`, `components/action-items/{action-items-header,use-action-item-filters}.ts(x)` (+ tests), `components/skrum/app-sidebar.tsx` (+ test), `layouts/skrum/app-layout.tsx`, `components/workspaces/command-menu.tsx`, `components/ui/command.tsx` (one option of `CommandPalette`), and their tests.

## Global Constraints

- **Mockup first** (parent spec §5 rule 13). A screen follows ScreenActions and ActionItem: layout, placement, labels, states. A difference is fixed, or is a row of **Pre-build deviations** (all answered by the owner on 2026-10-03; a difference found later follows Task 16's rule: a new row, listed in the report, without stopping the plan). Captures are taken once, in Task 16, in light, at 1440, in French, and compared with the mockup's `preview.html`.
- **Front rules** of the parent spec §5 on every front file: tokens only, rem, Tailwind scale (no arbitrary size), no overflow from 20rem to 60rem, visible focus, contrast, motion with `prefers-reduced-motion`, lucide icons, the literal call shape `t('…')`, presentational `skrum/` components (no network, no Echo, no router). Containers live in `resources/js/components/action-items/`. Reuse what exists: `ActionItem`, `ActionSheet`, `ActionStatusBadge`, `ActionPriorityMark`, `Table`, `Checkbox` (it has the `indeterminate` state), `Popover` + `Command`, `DropdownMenu`, `Calendar`, `Dialog`, `Drawer`, `Tooltip`, `sonner`, `ItemDeleteConfirm`, `ItemExport`, `useActionItemMutations`, `useActionItemsRealtime`.
- **Database (owner rule): Eloquent and the standard query builder only.** `docs/database.md`, rules 1 to 12, apply to every line of PHP, migration and test; `tests/Arch/DatabasePortabilityTest.php` enforces them. In short: no raw query of any form; no driver test; migrations with the Schema builder only, `up` only, dated `2026_10_24_…`, nullable `timestamp()`; a transaction locks the aggregate root first (here: the action item row, `WorkspaceActionItemGuard::lockWritable`); transactions that broadcast are not retried (`Transactions::Attempts` is not used here); an explicit tie-breaker on every sort (`ActionItemQuery::order` has one); dates bound as `Y-m-d` strings; `action_items.sort_rank` is written by `ActionItem::save()` only, so a legacy row inserted with `DB::table()` in a test sets `sort_rank` itself; tests never read SQL text and never change the schema; writes never skip model events.
- **PostgreSQL per plan; four engines at the end of the roadmap** (owner, 2026-10-03: "Lance les 4 bases seulement à la fin"). Every task runs the tests it wrote or touched on PostgreSQL: `bin/test-db pgsql -- <paths>`. A step "Run the tests on PostgreSQL" means exactly that. The red step of a task ("see it fail") may run once, on SQLite in memory: `vendor/bin/sail artisan test --compact <path>`. Races (`tests/Concurrency`) run with `bin/test-db pgsql --concurrency -- tests/Concurrency/ActionItemBulkTest.php`, never on SQLite in memory, never in parallel. The upgrade tests (`tests/Upgrade`) run on PostgreSQL. MariaDB, MySQL, SQLite and `sqlite-file` are not run by this plan: the controller runs the four-engine matrix once, after the last merge of the roadmap into `roadmap` (plans 24 and 25). Portability is still a rule of every line (the database rule above; `tests/Arch/DatabasePortabilityTest.php`).
- **Races** are proved with `Tests\Concurrency\Support\Race` (static closures capturing scalars only; `Race::request`); each case states the protection it proves (the row lock of `lockWritable` and the early return of `SetActionItemStatus` on an unchanged status; the unique `previous_occurrence_id`; the count check of an "all matching" request).
- **Working rules (owner):** unit, feature, upgrade, arch and concurrency tests are written and run per task; Vitest is written and run per task (`npm run test -- <pattern>`), the whole suite in Task 19; whole suites at merges into the plan branch (the gates above) and at the end; browser walkthroughs (`tests/Browser/Walkthroughs`) are neither written, edited nor run — a walkthrough whose selector this plan changes is listed in the report, not edited; captures only, in Task 16, light, 1440, French.
- **No new dependency**, PHP or JS, without the owner's approval. Long press is written with pointer events, not a library.
- **Four languages, informal.** Every new `__('…')` and `t('…')` key is added to `lang/en.json`, `fr.json`, `es.json`, `de.json` in the commit that introduces it (`tests/Feature/TranslationKeysTest.php`), in the informal register (French "tu", Spanish "tú", German "du"; `tests/Feature/InformalRegisterTest.php`). A key that exists keeps its value ("In progress", "Mark as in progress", "Export", "Priority", "Due date", "Source", "To do", "Done", "No due date", "Today", "Later", "Select", "Assign", ":count selected", "Added outside a retro", ":count of :total", ":name (guest)", "Automatic", "Complete to", "Reopen to", "Status mapping saved." exist). Task 17 lists the values of every new key.
- **No test is deleted** without the owner's approval. The existing expectations this plan changes are named in Tasks 2, 4 and 23 (and the fixtures of Task 10), and nowhere else; any other existing test that fails is reported, not edited.
- Primary and foreign keys are UUIDs. Create files with `vendor/bin/sail artisan make:… --no-interaction`.
- Controllers: plural name, CRUD method names only (`arch()->preset()->laravel()`). Route names camelCase, URLs kebab-case, tuple notation. Form Requests with array rules.
- Arch facts: models do not use `App\Actions`, `App\Http` or `App\Mcp`; actions do not use `App\Http`; `App\Support` does not use `App\Http` or `App\Mcp`; enums use nothing of the application; no class is `final`.
- PHP style: early returns, no `else`, happy path last, typed everything, PascalCase constants, constructor promotion, no comment that restates code; before each commit `vendor/bin/pint --dirty --format agent` and `vendor/bin/sail composer types:check` (PHPStan).
- Octane is installed: no static or per-request singleton state in new classes. A request stops at 30 seconds (`config/octane.php`); Task 8's measurement guards the 500-item cap and lowers it by rule if needed.
- Front gates after every task that touches the front: `npm run types:check`, `npm run check`, `npm run build:front` (it runs `wayfinder:generate --with-form`, needed after Tasks 6, 7 and 9 before the front uses their routes).
- **Plans merged before this one** are built on, not redone: plan 21's `runBulkExport`, `itemsToExport` and `ExportTargetFields` (Task 14), plan 23's `TeamSprint` and team roles (Tasks 21, 23; `ActionItemPermissions`).
- One commit per task, in the repository's style (`feat(action-items): …`, `test: …`), ending with the trailer lines:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE
```

  Never push, never merge into `main`.

## Pre-build deviations

Put to the owner before the screen is built (owner's rule of the fifth round). **Every row was answered on 2026-10-03** (`progress.md`, "Pre-build deviations (owner, 2026-10-03)", line "P24"): P24-03, P24-07 and P24-08 were answered against the drafted row and are now built as the mockup draws them; every other row is approved as listed. Reasons as in plan 18e: **F** false or unsafe, **A** accessibility, **N** no such data or concept, **S** this spec, **O** an owner's answer.

| # | Screen | Mockup element | Built | Reason | Answer (2026-10-03) |
|---|---|---|---|---|---|
| P24-01 | Filter bar | "Statut · 3 sur 4" | "Status · 2 of 3" (three statuses) | N: there are three statuses | Approved as listed |
| P24-02 | Filter bar, rows | Source "Whiteboard · …", "Sondage · …" and their icons | Source facet "From a retro" / "Added outside a retro"; rows keep the retro link or "Added outside a retro" | N: roadmap backlog (former plan 28; plan 19 §13) | Approved as listed |
| P24-03 | Header, table, list | "Grouper par Sprint" (default), sprint group rows with "en cours" / "terminé" badges, dates and late counts | **As the mockup:** Sprint (default) / Team / Assignee / None; sprint group rows with "In progress" / "Finished", ":count action items · start → end" or ":count carried over", ":count overdue"; "No sprint" last | was N (no sprint before plan 23) | **Add, default** (≠ the drafted row); built in Tasks 21 and 23; plan 24 runs after plan 23 |
| P24-04 | Table | a box on every row | a disabled box, with a tooltip, on a row the viewer can neither complete nor manage | F otherwise: a selection the server would refuse entirely | Approved as listed |
| P24-05 | Bulk bar | no feedback drawn | a toast after each action ("n updated, m not changed" with "Details") and "Exporting n of m…" during a tracker sync | O: per-item outcome (decision 1) | Approved as listed |
| P24-06 | Bulk bar | "Synchroniser vers Jira" always shown | "Sync to :tracker", named after the team's tracker, shown only for a selection of rows of one team with a writable tracker; disabled in "all matching" mode | N/F: a tracker belongs to a team; several trackers or teams have no single target; the browser loop needs ids (decisions 3 and 6) | Approved as listed |
| P24-07 | Topbar | search field "Rechercher une action, un ticket… ⌘K" | **As the mockup:** "Search an action item, a ticket…" with "⌘K", filtering the list (`q`); ⌘K focuses it on this page, "/" opens the palette; below 48rem in the "Filters" drawer | was PB-12 | **Build** (≠ the drafted row); Tasks 20 and 24 |
| P24-08 | Sidebar | "Actions · 2 en retard" | **As the mockup:** ":count overdue" in the badge ("99+ overdue" above 99) | was D-129 | **Words, as the mockup** (≠ the drafted row; settles D-129 for this entry); Task 22 |
| P24-09 | Phone and tablet list | long press only | long press and a "Select" button in the header | O: keyboard and screen-reader route into selection (decision 7) | Approved as listed |
| P24-10 | Phone chips | "Ouvertes", "Terminées" | "To do n" (To do + In progress), "Done", as D-118 | D-118 stands for the wording | Approved as listed |
| P24-11 | Bulk bar | "n sélectionnées" only | "Select all :count matching" after the page is selected, "All :count matching selected", and the "Apply to :count action items?" confirmation (with the changed-count sentence) | O: decision 6 | Approved as listed |
| P24-12 | Team integrations, status mapping | no mockup | a "Start to" select before "Complete to" and "Reopen to", same layout | O: decision 2 | Approved as listed |

## Review Focus

The inputs the spec implies that are most likely to bite, each pinned by a test in the task that owns the code.

1. **A link or a stored filter from before this plan** (`?status=open`, `?status=overdue`, `?status=all`, the reminder digest's link): the same items as before. Tests in Task 5 (server mapping) and Task 10 (the landing sends the stored entry unchanged).
2. **A bulk selection mixing what may and may not be changed** (another author's item, a locked board, an item deleted in another tab, an item of a team the viewer left, a recurring item asked to lose its date): the rest changes, each refusal has its sentence, nothing leaks about invisible items (no title). Test in Task 6.
3. **Two bulk requests over the same items at once** (a double click, two tabs), with ids or with "all matching", **or an "all matching" request after the list changed** (an item added in another tab between the count and "Apply"): one next occurrence per recurring item, no 500, and a changed list refused with its new number, nothing changed. Race cases in Tasks 6, 7 and 8; "changes nothing when the list changed since the member counted it" in Task 8.
4. **A tracker read of an issue "To Do" on an item a member just started, and of an issue "In Review" on an item still to do**: the member's unpushed newer start wins and is pushed; an older start yields to the source; the to-do item becomes started without a push. Tests in Task 2. **A start push on a Jira workflow whose in-progress transition requires a field**: a failed write with its sentence, the item stays started. Test in Task 3.
5. **A CSV cell typed as `=HYPERLINK(…)`** in an item's text, a retro title or a team name: shown as text by a spreadsheet. Test in Task 9.
6. **A search for a ticket key in another case** (`proj-12` for `PROJ-12`), **a link written before the search column**, **and a search sent as `filters.q` of an "all matching" request by a member of another team**: found, found after the migration, and never reaching a team the viewer cannot see. Tests in Task 20 ("finds an item by its ticket key in any case", the upgrade test, "never searches a team the viewer cannot see").
7. **An item created on the last day of a sprint, one created the day after it ended (between two sprints), and a row created live while the page is open**: grouped in the sprint, in "No sprint", and in its team's current sprint. Tests in Task 21 (server) and Task 23 (Vitest "places a live row in its team's current sprint").

## Lanes

| Lane | Tasks | Cut from | Shares with other lanes |
|---|---|---|---|
| main | 1 to 9, 20, 21, 10, 22, then 16 to 19 | — | — |
| Status | 11 | head of Task 22 | `components/action-items/action-items-table.tsx` (status cell only), `lang/*.json` |
| Filters | 12 | head of Task 22 | `components/action-items/action-items-page.tsx` (the `extraFacets` line and the drawer props only), `action-item-filters-drawer.tsx` (facets), `lang/*.json` |
| Bulk | 13, then 14 | head of Task 22 | `components/action-items/action-items-page.tsx` (the `selectionCell`, `selectionHead`, `bulkBar` lines and the list's selection props), `action-items-table.tsx` (first column and the box of group rows only), `action-items-list.tsx`, `action-items-header.tsx` ("Select" button), `lang/*.json` |
| Export | 15 | head of Task 22 | `pages/action-items/index.tsx` (the `before` prop only), `lang/*.json` |
| Grouping | 23 | head of Task 22 | `lib/action-items/grouping.ts`, `use-action-item-filters.ts` (grouping default only), `action-items-header.tsx` (the segmented control only), `action-items-table.tsx` and `action-items-list.tsx` (the label part of group rows only, through `ActionItemGroupMeta`), `action-items-page.tsx` (the `groupItems` call only), `lang/*.json` |
| Search | 24 | head of Task 22 | `layouts/skrum/app-layout.tsx`, `components/workspaces/command-menu.tsx`, `components/ui/command.tsx`, `pages/action-items/index.tsx` (the layout's `search` prop only), `action-item-filters-drawer.tsx` (the field at its top only), `use-action-item-filters.ts` (`q` only), `action-items-page.tsx` (the search subscription and the empty-state condition only), `lib/action-items/search.ts`, `lang/*.json` |

The six lanes run in parallel. Merge order: Status, Filters, Bulk, Export, Grouping, Search. `action-items-page.tsx`, `action-items-table.tsx`, `action-items-list.tsx`, `action-items-header.tsx`, `action-item-filters-drawer.tsx`, `use-action-item-filters.ts` and `pages/action-items/index.tsx` are edited by several lanes in named regions; the controller resolves the conflicts at each merge (the group row of the table holds Bulk's box, then Grouping's `ActionItemGroupMeta`). `lang/*.json` conflicts are resolved by the controller (keys appended in one alphabetical block per lane). A lane that needs a change in `components/skrum/` stops and asks: Tasks 10 and 22 make the only planned ones. The status mapping panel (Task 4) is done in Step A and touched by no lane.

---

## Step A — back end (single writer)

### Task 1: "In progress" — column, status, transitions, presentation

**Files:**
- Create: `database/migrations/2026_10_24_100000_add_started_at_to_action_items.php`, `app/Events/ActionItems/ActionItemProgressChanged.php`, `tests/Feature/ActionItems/ActionItemInProgressTest.php`, `tests/Upgrade/ActionItemStartedAtTest.php`
- Modify: `app/Enums/ActionItemStatus.php`, `app/Models/ActionItem.php`, `database/factories/ActionItemFactory.php`, `app/Actions/ActionItems/SetActionItemStatus.php`, `app/Actions/ActionItems/ActionItemSubtaskRules.php`, `app/Actions/Retros/PresentActionItem.php`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Produces: `ActionItemStatus::Doing` (`'doing'`), `ActionItemStatus::label(): string`; `ActionItem::currentStatus(): ActionItemStatus`; `ActionItem::$started_at` (`?Carbon`, cast `datetime`, not fillable); factory state `ActionItemFactory::started(string $at = '2026-10-20 08:00:00')`; `SetActionItemStatus::handle(ActionItem $locked, ActionItemActor|ExternalSyncActor $actor, ActionItemStatus $status): ActionItem` accepting the three values and firing `ActionItemProgressChanged(ActionItem $actionItem, ActionItemEventOrigin $origin, ActionItemActor|ExternalSyncActor|null $actor)` on open ↔ doing (spec §6.1; its listener is Task 3's); `PresentActionItem` keys `status` (`open|doing|completed`) and `startedAt` (`?string`, ISO 8601).

- [ ] **Step 1: Write the failing tests**

`tests/Feature/ActionItems/ActionItemInProgressTest.php`:

```php
<?php

use App\Enums\ActionItemRecurrence;
use App\Enums\ActionItemStatus;
use App\Enums\RetroPhase;
use App\Enums\ActionItemEventOrigin;
use App\Events\ActionItems\ActionItemCompleted;
use App\Events\ActionItems\ActionItemProgressChanged;
use App\Events\ActionItems\ActionItemReopened;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Models\ActionItem;
use App\Models\ActionItemSubtask;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Event::fake([ActionItemCompleted::class, ActionItemReopened::class, ActionItemProgressChanged::class, TeamActionItemSaved::class]);
    $this->travelTo(CarbonImmutable::parse('2026-10-21 09:00:00'));
});

/**
 * @param  array<string, mixed>  $payload
 */
function patchItemStatus(ActionItem $item, User $user, array $payload): TestResponse
{
    return test()->actingAs($user)->patchJson(route('workspaces.actionItems.update', [$item->team->workspace, $item]), $payload);
}

it('starts an open item and puts it back to do, without completion events', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create();

    patchItemStatus($item, $user, ['status' => 'doing'])
        ->assertOk()
        ->assertJsonPath('actionItem.status', 'doing')
        ->assertJsonPath('actionItem.startedAt', '2026-10-21T09:00:00+00:00');

    expect($item->fresh()->currentStatus())->toBe(ActionItemStatus::Doing)
        ->and($item->fresh()->completed_at)->toBeNull();

    patchItemStatus($item, $user, ['status' => 'open'])
        ->assertOk()
        ->assertJsonPath('actionItem.status', 'open')
        ->assertJsonPath('actionItem.startedAt', null);

    expect($item->fresh()->started_at)->toBeNull();
    Event::assertNotDispatched(ActionItemCompleted::class);
    Event::assertNotDispatched(ActionItemReopened::class);
    Event::assertDispatchedTimes(TeamActionItemSaved::class, 2);
    Event::assertDispatchedTimes(ActionItemProgressChanged::class, 2);
    Event::assertDispatched(fn (ActionItemProgressChanged $event) => $event->origin === ActionItemEventOrigin::Skrum);
});

it('changes and announces nothing when the item already has the status', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->started('2026-10-20 08:00:00')->create();

    patchItemStatus($item, $user, ['status' => 'doing'])->assertOk()->assertJsonPath('actionItem.startedAt', '2026-10-20T08:00:00+00:00');

    Event::assertNotDispatched(TeamActionItemSaved::class);
    Event::assertNotDispatched(ActionItemProgressChanged::class);
});

it('keeps the start when a started item is completed, and the next occurrence starts to do', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->recurring(ActionItemRecurrence::Weekly)->started('2026-10-20 08:00:00')->create();

    patchItemStatus($item, $user, ['status' => 'completed'])->assertOk()->assertJsonPath('actionItem.status', 'completed');

    $next = ActionItem::query()->where('previous_occurrence_id', $item->id)->sole();

    expect($item->fresh()->started_at?->toDateTimeString())->toBe('2026-10-20 08:00:00')
        ->and($item->fresh()->currentStatus())->toBe(ActionItemStatus::Completed)
        ->and($next->currentStatus())->toBe(ActionItemStatus::Open)
        ->and($next->started_at)->toBeNull();
    Event::assertDispatchedTimes(ActionItemCompleted::class, 1);
    Event::assertNotDispatched(ActionItemProgressChanged::class);
});

it('reopens a completed item to do or in progress', function (string $target, bool $staysStarted) {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->completed()->started('2026-10-19 08:00:00')->create(['completed_via_source' => 'jira']);

    patchItemStatus($item, $user, ['status' => $target])->assertOk()->assertJsonPath('actionItem.status', $target);

    $fresh = $item->fresh();
    expect($fresh->completed_at)->toBeNull()
        ->and($fresh->completed_via_source)->toBeNull()
        ->and($fresh->started_at !== null)->toBe($staysStarted);
    Event::assertDispatchedTimes(ActionItemReopened::class, 1);
    Event::assertNotDispatched(ActionItemProgressChanged::class);
})->with([
    'to do' => ['open', false],
    'in progress' => ['doing', true],
]);

it('lets a guest assignee start their item on the board', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Actions)->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $item = ActionItem::factory()->assignedToGuest($guest)->create();

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->patchJson(route('retros.action-items.update', [$retro, $item]), ['status' => 'doing'])
        ->assertOk()
        ->assertJsonPath('actionItem.status', 'doing');
});

it('refuses to start an item to a member who may not complete it', function () {
    $team = Team::factory()->create();
    $author = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $author)->create();

    patchItemStatus($item, teamMember($team), ['status' => 'doing'])->assertForbidden();

    expect($item->fresh()->started_at)->toBeNull();
});

it('keeps two states for sub-tasks', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->withSubtasks(1)->create();
    $subtask = ActionItemSubtask::query()->where('action_item_id', $item->id)->sole();

    $this->actingAs($user)
        ->patchJson(route('workspaces.actionItemSubtasks.update', [$team->workspace, $subtask]), ['status' => 'doing'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');
});

it('labels the three statuses', function () {
    expect(ActionItemStatus::Open->label())->toBe('To do')
        ->and(ActionItemStatus::Doing->label())->toBe('In progress')
        ->and(ActionItemStatus::Completed->label())->toBe('Done');
});
```

`tests/Upgrade/ActionItemStartedAtTest.php`:

```php
<?php

use App\Enums\ActionItemStatus;
use App\Models\ActionItem;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

it('reads every row from before the column as to do or done, with its rank unchanged', function () {
    $migration = '2026_10_24_100000_add_started_at_to_action_items.php';
    $earlier = collect(glob(database_path('migrations/*.php')))
        ->filter(fn (string $path): bool => basename($path) < $migration)
        ->values()
        ->all();

    Artisan::call('migrate:fresh', ['--path' => $earlier, '--realpath' => true]);

    $workspace = (string) Str::uuid7();
    $team = (string) Str::uuid7();
    DB::table('workspaces')->insert(['id' => $workspace, 'name' => 'Acme', 'slug' => 'acme', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('teams')->insert(['id' => $team, 'workspace_id' => $workspace, 'name' => 'Platform', 'created_at' => now(), 'updated_at' => now()]);
    $row = fn (string $content, array $values) => DB::table('action_items')->insert([
        'id' => (string) Str::uuid7(),
        'team_id' => $team,
        'content' => $content,
        'content_search' => $content,
        'priority' => 'medium',
        'created_at' => '2026-09-01 10:00:00',
        'updated_at' => '2026-09-01 10:00:00',
        ...$values,
    ]);

    $row('open', ['sort_rank' => 1_000_000_001]);
    $row('done', ['completed_at' => '2026-09-02 10:00:00', 'sort_rank' => ActionItem::CompletedSortRank]);

    Artisan::call('migrate', ['--path' => [database_path("migrations/{$migration}")], '--realpath' => true]);

    $items = ActionItem::query()->get()->keyBy('content');

    expect($items['open']->currentStatus())->toBe(ActionItemStatus::Open)
        ->and($items['done']->currentStatus())->toBe(ActionItemStatus::Completed)
        ->and($items['open']->started_at)->toBeNull()
        ->and($items->map(fn (ActionItem $item): int => $item->sort_rank)->all())
        ->toBe(['open' => 1_000_000_001, 'done' => ActionItem::CompletedSortRank]);
});
```

Before writing the upgrade test, read `tests/Upgrade/SearchColumnsBackfillTest.php`: if `action_items.content_search` must hold the folded text (`SearchText::fold()`), write `'content_search' => SearchText::fold($content)` instead of the raw text.

- [ ] **Step 2: Run the tests to see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ActionItemInProgressTest.php`
Expected: FAIL — `Call to undefined method …ActionItemFactory::started()`, then `"doing" is not a valid backing value` (422 on `status`).

- [ ] **Step 3: Implement**

`database/migrations/2026_10_24_100000_add_started_at_to_action_items.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * "In progress" (plan 24, AI-3): when an item was started. Meaningful only while
     * `completed_at` is null; every existing row stays to do or done.
     */
    public function up(): void
    {
        Schema::table('action_items', function (Blueprint $table): void {
            $table->timestamp('started_at')->nullable();
        });
    }
};
```

`app/Enums/ActionItemStatus.php`:

```php
<?php

namespace App\Enums;

enum ActionItemStatus: string
{
    case Open = 'open';
    case Doing = 'doing';
    case Completed = 'completed';

    public function label(): string
    {
        return match ($this) {
            self::Open => __('To do'),
            self::Doing => __('In progress'),
            self::Completed => __('Done'),
        };
    }
}
```

`app/Models/ActionItem.php`: add `@property Carbon|null $started_at` to the class docblock, `'started_at' => 'datetime'` to `casts()`, `use App\Enums\ActionItemStatus;`, and after `isCompleted()`:

```php
    /**
     * Completion is read from `completed_at` alone; `started_at` only tells a started item
     * from one still to do.
     */
    public function currentStatus(): ActionItemStatus
    {
        if ($this->completed_at !== null) {
            return ActionItemStatus::Completed;
        }

        if ($this->started_at !== null) {
            return ActionItemStatus::Doing;
        }

        return ActionItemStatus::Open;
    }
```

`database/factories/ActionItemFactory.php`, after `completed()`:

```php
    public function started(string $at = '2026-10-20 08:00:00'): static
    {
        return $this->state(fn () => ['started_at' => $at]);
    }
```

`app/Events/ActionItems/ActionItemProgressChanged.php` (`vendor/bin/sail artisan make:event ActionItems/ActionItemProgressChanged --no-interaction`, then the shape of `ActionItemReopened`):

```php
<?php

namespace App\Events\ActionItems;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ExternalSyncActor;
use App\Enums\ActionItemEventOrigin;
use App\Models\ActionItem;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * An item was started or put back to do (spec 24 §6.1). A domain event: not broadcast, not
 * a webhook; its listener queues the tracker pushes (Task 3).
 */
class ActionItemProgressChanged implements ShouldDispatchAfterCommit
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(
        public ActionItem $actionItem,
        public ActionItemEventOrigin $origin,
        public ActionItemActor|ExternalSyncActor|null $actor = null,
    ) {}
}
```

`app/Actions/ActionItems/SetActionItemStatus.php` (whole `handle`; add `use App\Events\ActionItems\ActionItemProgressChanged;`):

```php
    /**
     * Setting the current status again changes and announces nothing. Completion and
     * reopening keep their events; starting and stopping fire ActionItemProgressChanged.
     */
    public function handle(ActionItem $locked, ActionItemActor|ExternalSyncActor $actor, ActionItemStatus $status): ActionItem
    {
        if ($actor instanceof ActionItemActor) {
            $this->permissions->authorizeComplete($locked, $actor);
        }

        if ($locked->currentStatus() === $status) {
            return $locked->loadForPresentation();
        }

        $wasCompleted = $locked->isCompleted();
        $completing = $status === ActionItemStatus::Completed;

        $locked->forceFill([
            'completed_at' => $completing ? now() : null,
            'completed_via_source' => $completing && $actor instanceof ExternalSyncActor ? $actor->source : null,
            'started_at' => match ($status) {
                ActionItemStatus::Open => null,
                ActionItemStatus::Doing => $locked->started_at ?? now(),
                ActionItemStatus::Completed => $locked->started_at,
            },
        ])->save();

        if ($completing) {
            $this->createNextOccurrence->handle($locked);
            $this->markActionItemRemindersRead->handle($locked);
        }

        $origin = $actor instanceof ExternalSyncActor ? ActionItemEventOrigin::External : ActionItemEventOrigin::Skrum;

        if ($completing) {
            event(new ActionItemCompleted($locked, $origin, $actor));
        }

        if ($wasCompleted && ! $completing) {
            event(new ActionItemReopened($locked, $origin, $actor));
        }

        if (! $wasCompleted && ! $completing) {
            event(new ActionItemProgressChanged($locked, $origin, $actor));
        }

        $this->broadcastActionItemChange->saved($locked);

        return $locked;
    }
```

`app/Actions/ActionItems/ActionItemSubtaskRules.php`, the `status` rule of `update()`:

```php
            'status' => ['sometimes', 'required', Rule::enum(ActionItemStatus::class)->only([ActionItemStatus::Open, ActionItemStatus::Completed])],
```

`app/Actions/Retros/PresentActionItem.php`: in `handle()`, replace the `status` line and add `startedAt` after `completedAt`:

```php
            'status' => $item->currentStatus()->value,
            'completedAt' => $item->completed_at?->toIso8601String(),
            'startedAt' => $item->started_at?->toIso8601String(),
```

and in the docblock shape: `status: string` stays, add `startedAt: ?string,` after `completedAt`. Remove the now unused `use App\Enums\ActionItemStatus;` if Pint reports it.

`ApplyActionItemChanges` and `ActionItemRules::update()` need no change: `Rule::enum(ActionItemStatus::class)` accepts `doing`, and `ActionItemStatus::from()` reads it.

- [ ] **Step 4: Run the tests on PostgreSQL**

Run: `bin/test-db pgsql -- tests/Feature/ActionItems tests/Upgrade/ActionItemStartedAtTest.php tests/Feature/Integrations tests/Feature/Mcp`.
Expected: PASS. `tests/Feature/ActionItems/PresentActionItemTest.php` and the MCP item-shape tests pass with the extra `startedAt` key; if one compares the whole payload with `toBe`, add `'startedAt' => null` to its expected array and list the file in the commit message.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_10_24_100000_add_started_at_to_action_items.php app/Events/ActionItems/ActionItemProgressChanged.php app/Enums/ActionItemStatus.php app/Models/ActionItem.php database/factories/ActionItemFactory.php app/Actions/ActionItems/SetActionItemStatus.php app/Actions/ActionItems/ActionItemSubtaskRules.php app/Actions/Retros/PresentActionItem.php tests/Feature/ActionItems/ActionItemInProgressTest.php tests/Upgrade/ActionItemStartedAtTest.php lang
git commit -m "feat(action-items): status In progress (AI-3)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 2: Three-state tracker reads — `Started`, item state per provider (decision 2, option C)

**Files:**
- Modify: `app/Enums/ExternalIssueState.php`, `app/Support/Integrations/Trackers/DoneMapping.php`, `app/Actions/Integrations/ApplyIssueChanges.php`, `app/Actions/Integrations/LinkStatusSync.php`, `resources/js/types/integrations.ts`, `tests/Feature/Integrations/ApplyIssueChangesTest.php`, `tests/Feature/Integrations/IssueStatusReadsTest.php`

**Interfaces:**
- Consumes: `ActionItemStatus::Doing`, `ActionItem::currentStatus()`, `SetActionItemStatus::handle()`, `ActionItemProgressChanged` (Task 1); `DoneMapping::category(IntegrationProvider $provider, string $kind): ExternalStatusCategory` (exists).
- Produces: `ExternalIssueState::Started` (`'started'`); `DoneMapping::state()` answering `Started` for Jira, Jira Data Center and Linear in-progress statuses; `DoneMapping::tracksStart(IntegrationProvider $provider): bool`; `DoneMapping::itemState(ActionItem $item, IntegrationProvider $provider): ExternalIssueState`. Behaviour (spec §6.2, "Reads", "Sync state"): `ApplyIssueChanges` and `LinkStatusSync::state()` compare over three states; a source that wins sets the item to completed, doing or to do. The front type `ExternalLink.state` is `'open' | 'started' | 'done' | null`. Pushes still send two states until Task 3.

- [ ] **Step 1: Write the failing tests**

`statusSyncLink()` (`tests/Pest.php`, around line 1467) passes its `item` attributes to the action item factory's `create()` (through `exportBoardItem()`), so `started_at` and `completed_at` go through it unguarded.

Append to `tests/Feature/Integrations/ApplyIssueChangesTest.php` (it has `applyStatusSyncIssues()`, `Queue::fake()` and the clock at `2026-10-07 10:30:00` in its `beforeEach`; add the imports `App\Enums\ActionItemStatus`, `App\Events\ActionItems\ActionItemProgressChanged`, `App\Support\Integrations\Trackers\DoneMapping` and `App\Models\Team`):

```php
it('starts an open item when its issue is in progress, as the system and without a push', function () {
    Event::fake([ActionItemCompleted::class, ActionItemReopened::class, ActionItemProgressChanged::class]);
    ['integration' => $integration, 'item' => $item, 'link' => $link] = statusSyncLink();

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'indeterminate', overrides: ['status' => 'In Review'])]);

    $item->refresh();
    $link->refresh();
    expect($item->currentStatus())->toBe(ActionItemStatus::Doing)
        ->and($item->completed_at)->toBeNull()
        ->and($link->external_state)->toBe(ExternalIssueState::Started)
        ->and($link->external_status_name)->toBe('In Review')
        ->and(LinkStatusSync::state($link, $item))->toBe(LinkStatusSync::Synced);
    Event::assertDispatched(fn (ActionItemProgressChanged $event) => $event->origin === ActionItemEventOrigin::External);
    Event::assertNotDispatched(ActionItemCompleted::class);
    Event::assertNotDispatched(ActionItemReopened::class);
    Queue::assertNotPushed(PushActionItemState::class);
});

it('starts an item on a locked board as the system', function () {
    ['integration' => $integration, 'item' => $item, 'retro' => $retro] = statusSyncLink();
    $retro->forceFill(['phase' => RetroPhase::Discussing, 'is_locked' => true])->save();

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'indeterminate')]);

    expect($item->fresh()->started_at)->not->toBeNull();
});

it('puts a started item back to do when its issue went back to do after the start', function () {
    Event::fake([ActionItemProgressChanged::class]);
    ['integration' => $integration, 'item' => $item] = statusSyncLink(
        ['local_state_changed_at' => '2026-10-07 10:15:00'],
        item: ['started_at' => '2026-10-07 10:15:00'],
    );

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', '2026-10-07T10:20:00+00:00')]);

    expect($item->fresh()->currentStatus())->toBe(ActionItemStatus::Open);
    Event::assertDispatched(fn (ActionItemProgressChanged $event) => $event->origin === ActionItemEventOrigin::External);
    Queue::assertNotPushed(PushActionItemState::class);
});

it('keeps a newer unpushed start and pushes it', function () {
    ['integration' => $integration, 'item' => $item, 'link' => $link] = statusSyncLink(
        ['local_state_changed_at' => '2026-10-07 10:25:00'],
        item: ['started_at' => '2026-10-07 10:25:00'],
    );

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', '2026-10-07T10:20:00+00:00')]);

    expect($item->fresh()->currentStatus())->toBe(ActionItemStatus::Doing)
        ->and($link->fresh()->external_state)->toBe(ExternalIssueState::Open);
    Queue::assertPushed(PushActionItemState::class, fn (PushActionItemState $job) => $job->linkId === $link->id);
});

it('reopens a completed item into in progress when the source reopens it into an in-progress status', function () {
    Event::fake([ActionItemReopened::class]);
    ['integration' => $integration, 'item' => $item] = statusSyncLink(item: ['completed_at' => '2026-10-06 09:00:00']);

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'indeterminate', overrides: ['status' => 'In Review'])]);

    $item->refresh();
    expect($item->completed_at)->toBeNull()
        ->and($item->currentStatus())->toBe(ActionItemStatus::Doing);
    Event::assertDispatched(fn (ActionItemReopened $event) => $event->origin === ActionItemEventOrigin::External);
});

it('reads a started item as open for GitHub and as started for Jira and Linear', function (IntegrationProvider $provider, ExternalIssueState $expected) {
    $team = Team::factory()->create();
    $item = ActionItem::factory()->withoutRetro($team, teamMember($team))->started()->create();

    expect(DoneMapping::itemState($item, $provider))->toBe($expected)
        ->and(DoneMapping::itemState($item->forceFill(['started_at' => null]), $provider))->toBe(ExternalIssueState::Open)
        ->and(DoneMapping::itemState($item->forceFill(['completed_at' => now()]), $provider))->toBe(ExternalIssueState::Done);
})->with([
    'jira' => [IntegrationProvider::Jira, ExternalIssueState::Started],
    'jira data center' => [IntegrationProvider::JiraDataCenter, ExternalIssueState::Started],
    'linear' => [IntegrationProvider::Linear, ExternalIssueState::Started],
    'github' => [IntegrationProvider::GitHub, ExternalIssueState::Open],
]);
```

Change the existing test "only records the read when both sides agree" (line ~101): its issue becomes a to-do one, so that both sides still agree under three states; its in-progress case is the first new test above. Replace its read and its status name expectation, keep its name and its other assertions:

```php
    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new')]);

    expect($item->fresh()->completed_at)->toBeNull()
        ->and($link->fresh()->external_state)->toBe(ExternalIssueState::Open)
        ->and($link->fresh()->external_status_name)->toBe('To Do');
```

In `tests/Feature/Integrations/IssueStatusReadsTest.php`, the dataset of "maps source states to done or open": the rows `'jira in progress'` and `'linear started'` expect `ExternalIssueState::Started` (they expected `Open`), and one row is added after `'jira dc done'`:

```php
    'jira dc in progress' => [IntegrationProvider::JiraDataCenter, [], 'indeterminate', '3', ExternalIssueState::Started],
```

These three changes (one test's input, two dataset rows) are the only existing expectations this task changes; say so in the commit message. "announces link changes only when a link or the item changed" (its second read is an In Review issue) is expected to pass unchanged: it reads one announcement per read that changed something; if it fails, report it, do not edit it.

- [ ] **Step 2: Run the tests to see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ApplyIssueChangesTest.php tests/Feature/Integrations/IssueStatusReadsTest.php`
Expected: FAIL — `Undefined constant App\Enums\ExternalIssueState::Started`, then `Call to undefined method …DoneMapping::itemState()`.

- [ ] **Step 3: Implement**

`app/Enums/ExternalIssueState.php`:

```php
<?php

namespace App\Enums;

/**
 * An issue's state for the status sync (spec 8 §5, spec 24 §6.2). `Started` only exists for
 * trackers with an in-progress category (DoneMapping::tracksStart). Stored in `string(10)` columns.
 */
enum ExternalIssueState: string
{
    case Open = 'open';
    case Started = 'started';
    case Done = 'done';
}
```

`app/Support/Integrations/Trackers/DoneMapping.php`: add `use App\Enums\ActionItemStatus;` and `use App\Models\ActionItem;`; in `state()`, replace the last line `return $done ? ExternalIssueState::Done : ExternalIssueState::Open;` with:

```php
        if ($done) {
            return ExternalIssueState::Done;
        }

        if (self::tracksStart($integration->provider) && self::category($integration->provider, $status->kind) === ExternalStatusCategory::InProgress) {
            return ExternalIssueState::Started;
        }

        return ExternalIssueState::Open;
```

and add after `category()`:

```php
    /**
     * Spec 24 §6.2: Jira and Linear have an in-progress category, synced both ways; GitHub has none.
     */
    public static function tracksStart(IntegrationProvider $provider): bool
    {
        return in_array($provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter, IntegrationProvider::Linear], true);
    }

    /**
     * What an item is for a link of this provider: a started item is open where the
     * provider has no start.
     */
    public static function itemState(ActionItem $item, IntegrationProvider $provider): ExternalIssueState
    {
        return match ($item->currentStatus()) {
            ActionItemStatus::Completed => ExternalIssueState::Done,
            ActionItemStatus::Doing => self::tracksStart($provider) ? ExternalIssueState::Started : ExternalIssueState::Open,
            ActionItemStatus::Open => ExternalIssueState::Open,
        };
    }
```

Update the class docblock: "when an issue counts as done or started, and which poker category its status belongs to".

`app/Actions/Integrations/ApplyIssueChanges.php`, in `applyToItem()`: replace

```php
            $itemState = $item->isCompleted() ? ExternalIssueState::Done : ExternalIssueState::Open;
```

with

```php
            $itemState = DoneMapping::itemState($item, $integration->provider);
```

and, in the call that follows the source, replace the third argument

```php
                $state === ExternalIssueState::Done ? ActionItemStatus::Completed : ActionItemStatus::Open,
```

with

```php
                self::followedStatus($state),
```

Add:

```php
    /**
     * Spec 24 §6.2: the source's state, when it wins, as the item's status.
     */
    private static function followedStatus(ExternalIssueState $state): ActionItemStatus
    {
        return match ($state) {
            ExternalIssueState::Done => ActionItemStatus::Completed,
            ExternalIssueState::Started => ActionItemStatus::Doing,
            ExternalIssueState::Open => ActionItemStatus::Open,
        };
    }
```

`skrumWins`, `echoesLastPush`, `isStale`, `canPush` and `markOtherTrackersChanged` do not change: they compare `ExternalIssueState` values, now three.

`app/Actions/Integrations/LinkStatusSync.php`, in `state()`: replace the `$itemState` line with

```php
        $itemState = DoneMapping::itemState($item, $integration->provider);
```

(`use App\Support\Integrations\Trackers\DoneMapping;`; drop `use App\Enums\ExternalIssueState;` if Pint reports it unused).

`resources/js/types/integrations.ts`, `ExternalLink`: `state: 'open' | 'started' | 'done' | null;`. Run `npm run types:check`: no other change is expected (`action-items-table.tsx` compares with `'done'` only).

`PushActionItemState`, `JiraTransitions`, `LinearTracker` and `StatusPushRejected` are Task 3's.

- [ ] **Step 4: Run the tests on PostgreSQL**

Run: `bin/test-db pgsql -- tests/Feature/Integrations tests/Feature/ActionItems tests/Feature/Poker tests/Arch`; then `npm run types:check`.
Expected: PASS. If a test of `tests/Feature/Integrations` other than the three changes above fails, stop and report it.

- [ ] **Step 5: Commit**

```bash
git add app/Enums/ExternalIssueState.php app/Support/Integrations/Trackers/DoneMapping.php app/Actions/Integrations/ApplyIssueChanges.php app/Actions/Integrations/LinkStatusSync.php resources/js/types/integrations.ts tests/Feature/Integrations/ApplyIssueChangesTest.php tests/Feature/Integrations/IssueStatusReadsTest.php
git commit -m "feat(integrations): tracker reads carry In progress both ways

Changed expectations: 'only records the read when both sides agree' now reads
a to-do issue (its In Review case is a new test); the rows 'jira in progress'
and 'linear started' of 'maps source states to done or open' read Started.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 3: Pushing a start or a stop — start targets of Jira and Linear (decision 2, option C)

**Files:**
- Create: `app/Listeners/QueueProgressedActionItemStatusPushesListener.php`
- Modify: `app/Jobs/Integrations/PushActionItemState.php`, `app/Support/Integrations/Jira/JiraTransitions.php`, `app/Support/Integrations/Trackers/LinearTracker.php`, `app/Support/Integrations/Trackers/DoneMapping.php` (the `configured()` docblock), `app/Exceptions/Integrations/StatusPushRejected.php`, `tests/Feature/Integrations/IssueTransitionsTest.php`, `tests/Feature/Integrations/ActionItemStatusPushTest.php`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: `ActionItemProgressChanged` (Task 1); `ExternalIssueState::Started`, `DoneMapping::itemState()` (Task 2); `QueueActionItemStatusPushes::handle(ActionItem, ActionItemEventOrigin)`, `SyncsIssueStatus::transition(TeamIntegration, string, ExternalIssueState): ?TrackerIssue` (exist).
- Produces: a start or stop made in skrum queues `PushActionItemState` for each synced link; `PushActionItemState` pushes `DoneMapping::itemState()`; `JiraTransitions::choose()` and `LinearTracker::transition()` reach a `Started` target through the settings keys `startStatusId` (Jira projects) and `startStateId` (Linear teams), else the first `indeterminate` transition / the first `started` state; refusals "Jira requires more fields to start :key. Start it in Jira." and "No transition to an in-progress status is available for :key.". The settings keys are written by Task 4; this task reads them.

- [ ] **Step 1: Write the failing tests**

Append to `tests/Feature/Integrations/IssueTransitionsTest.php` (it has `jiraSyncIntegration()`, `jiraTransitionRequest()` and `$this->jiraOpen`; read the existing Linear test "moves Linear issues to the first completed or unstarted state" for `fakeLinearGraphql()` and `linearTrackerIssue()`):

```php
it('starts a Jira issue through the configured start status, else the first in-progress one', function (array $mapping, array $transitions, string $expected) {
    $integration = jiraSyncIntegration(['statusMapping' => ['projects' => ['PROJ' => $mapping]]]);
    $started = ['status' => ['id' => '3', 'name' => 'In Progress', 'statusCategory' => ['key' => 'indeterminate']], 'project' => ['key' => 'PROJ']];
    fakeJiraTransitions($this->jiraOpen, $started, $transitions);

    resolve(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Started);

    expect(jiraTransitionRequest()?->data())->toBe(['transition' => ['id' => $expected]]);
})->with([
    'first in progress' => [[], [jiraTransition('31', '10002', 'Done', 'done'), jiraTransition('41', '3', 'In Progress', 'indeterminate'), jiraTransition('42', '4', 'In Review', 'indeterminate')], '41'],
    'configured' => [['startStatusId' => '4'], [jiraTransition('41', '3', 'In Progress', 'indeterminate'), jiraTransition('42', '4', 'In Review', 'indeterminate')], '42'],
    'configured but not reachable' => [['startStatusId' => '9'], [jiraTransition('41', '3', 'In Progress', 'indeterminate')], '41'],
]);

it('explains when no transition reaches an in-progress status', function () {
    $integration = jiraSyncIntegration();
    fakeJiraTransitions($this->jiraOpen, $this->jiraOpen, [jiraTransition('31', '10002', 'Done', 'done')]);

    expect(fn () => resolve(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Started))
        ->toThrow(StatusPushRejected::class, 'No transition to an in-progress status is available for PROJ-1.');
});

it('refuses a start transition that needs other fields', function () {
    $integration = jiraSyncIntegration();
    fakeJiraTransitions($this->jiraOpen, $this->jiraOpen, [jiraTransition('41', '3', 'In Progress', 'indeterminate', [
        'customfield_10050' => ['required' => true, 'hasDefaultValue' => false],
    ])]);

    expect(fn () => resolve(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Started))
        ->toThrow(StatusPushRejected::class, 'Jira requires more fields to start PROJ-1. Start it in Jira.')
        ->and(jiraTransitionRequest())->toBeNull();
});

it('skips the start when the Jira issue is already in progress', function () {
    $integration = jiraSyncIntegration();
    $started = ['status' => ['id' => '3', 'name' => 'In Progress', 'statusCategory' => ['key' => 'indeterminate']], 'project' => ['key' => 'PROJ']];
    fakeJiraTransitions($started, $started, []);

    resolve(Trackers::class)->syncing(IntegrationProvider::Jira)->transition($integration, '10001', ExternalIssueState::Started);

    Http::assertNotSent(fn (Request $request) => str_contains($request->url(), '/transitions'));
});

it('moves Linear issues to the configured start state, else the first started one', function (array $settings, string $expected) {
    enableIntegrations(IntegrationProvider::Linear);
    $integration = TeamIntegration::factory()->linear()->create();
    $integration->forceFill(['settings' => [...$integration->settings, 'statusSync' => true, ...$settings]])->save();
    $current = 'unstarted';
    $mutations = [];
    fakeLinearGraphql([
        'issueUpdate' => function (array $variables) use (&$mutations, &$current): array {
            $mutations[] = $variables;
            $current = 'started';

            return ['issueUpdate' => ['success' => true]];
        },
        'states(first' => ['issue' => ['team' => ['states' => ['nodes' => [
            ['id' => 'st-review', 'name' => 'In Review', 'type' => 'started', 'position' => 4],
            ['id' => 'st-done', 'name' => 'Done', 'type' => 'completed', 'position' => 5],
            ['id' => 'st-started', 'name' => 'In Progress', 'type' => 'started', 'position' => 3],
            ['id' => 'st-todo', 'name' => 'Todo', 'type' => 'unstarted', 'position' => 1],
        ]]]]],
        'issues(' => function () use (&$current): array {
            return ['issues' => ['nodes' => [linearTrackerIssue('lin-1', 'ENG-1', [
                'state' => ['id' => "st-{$current}", 'name' => $current, 'type' => $current],
                'team' => ['key' => 'ENG'],
            ])]]];
        },
    ]);

    resolve(Trackers::class)->syncing(IntegrationProvider::Linear)->transition($integration, 'lin-1', ExternalIssueState::Started);

    expect($mutations)->toBe([['id' => 'lin-1', 'stateId' => $expected]]);
})->with([
    'first started in workflow order' => [[], 'st-started'],
    'configured' => [['statusMapping' => ['teams' => ['ENG' => ['startStateId' => 'st-review']]]], 'st-review'],
]);
```

Append to `tests/Feature/Integrations/ActionItemStatusPushTest.php` (add `use App\Actions\Integrations\LinkStatusSync;`):

```php
it('queues a push when a manager starts or stops a synced item', function (array $item, string $status) {
    Queue::fake();
    ['item' => $actionItem, 'retro' => $retro, 'author' => $author, 'link' => $link] = statusSyncLink(item: $item);

    $this->actingAs($author)
        ->patchJson(route('workspaces.actionItems.update', [$retro->team->workspace, $actionItem]), ['status' => $status])
        ->assertOk();

    Queue::assertPushed(PushActionItemState::class, fn (PushActionItemState $job) => $job->linkId === $link->id);
    expect($link->fresh()->local_state_changed_at)->not->toBeNull();
})->with([
    'start' => [[], 'doing'],
    'stop' => [['started_at' => '2026-10-07 09:00:00'], 'open'],
]);

it('does not push a start that came from the source', function () {
    Queue::fake();
    ['item' => $item, 'link' => $link] = statusSyncLink();

    DB::transaction(fn () => resolve(SetActionItemStatus::class)->handle(
        ActionItem::query()->whereKey($item->id)->lockForUpdate()->firstOrFail(),
        new ExternalSyncActor('jira', 'PROJ-1'),
        ActionItemStatus::Doing,
    ));

    Queue::assertNotPushed(PushActionItemState::class);
    expect($link->fresh()->local_state_changed_at)->toBeNull();
});

it('pushes a started item to the in-progress status and records it', function () {
    ['item' => $item, 'link' => $link] = statusSyncLink(item: ['started_at' => '2026-10-07 10:00:00']);
    $started = ['status' => ['id' => '3', 'name' => 'In Progress', 'statusCategory' => ['key' => 'indeterminate']], 'project' => ['key' => 'PROJ']];
    fakeJiraTransitions($this->open, $started, [jiraTransition('31', '10002', 'Done', 'done'), jiraTransition('41', '3', 'In Progress', 'indeterminate')]);

    runStatusPush($link);

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && str_contains($request->url(), '/issue/10001/transitions')
        && $request['transition'] === ['id' => '41']);
    $link->refresh();
    expect($link->last_pushed_state)->toBe(ExternalIssueState::Started)
        ->and($link->external_state)->toBe(ExternalIssueState::Started)
        ->and($link->external_status_name)->toBe('In Progress')
        ->and(LinkStatusSync::state($link, $item->fresh()))->toBe(LinkStatusSync::Synced);
});

it('records a start the workflow cannot take, and keeps the item started', function () {
    ['item' => $item, 'link' => $link] = statusSyncLink(item: ['started_at' => '2026-10-07 10:00:00']);
    fakeJiraTransitions($this->open, $this->open, [jiraTransition('31', '10002', 'Done', 'done')]);

    runStatusPush($link);

    expect($link->fresh()->sync_error)->toBe('No transition to an in-progress status is available for PROJ-1.')
        ->and($item->fresh()->currentStatus())->toBe(ActionItemStatus::Doing);
});

it('pushes a stopped item back to the open status', function () {
    ['link' => $link] = statusSyncLink();
    $started = ['status' => ['id' => '3', 'name' => 'In Progress', 'statusCategory' => ['key' => 'indeterminate']], 'project' => ['key' => 'PROJ']];
    fakeJiraTransitions($started, $this->open, [jiraTransition('11', '10000', 'To Do', 'new'), jiraTransition('31', '10002', 'Done', 'done')]);

    runStatusPush($link);

    Http::assertSent(fn (Request $request) => $request->method() === 'POST' && $request['transition'] === ['id' => '11']);
    expect($link->fresh()->last_pushed_state)->toBe(ExternalIssueState::Open);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/IssueTransitionsTest.php tests/Feature/Integrations/ActionItemStatusPushTest.php`
Expected: FAIL — the start chooses a reopen transition, no push is queued on a start, the job pushes `open` for a started item.

- [ ] **Step 3: Implement**

`app/Listeners/QueueProgressedActionItemStatusPushesListener.php` (`vendor/bin/sail artisan make:listener QueueProgressedActionItemStatusPushesListener --event=ActionItemProgressChanged --no-interaction`, then):

```php
<?php

namespace App\Listeners;

use App\Actions\Integrations\QueueActionItemStatusPushes;
use App\Events\ActionItems\ActionItemProgressChanged;

class QueueProgressedActionItemStatusPushesListener
{
    public function __construct(private QueueActionItemStatusPushes $queueActionItemStatusPushes) {}

    public function handle(ActionItemProgressChanged $event): void
    {
        $this->queueActionItemStatusPushes->handle($event->actionItem, $event->origin);
    }
}
```

Read how `QueueCompletedActionItemStatusPushesListener` is registered (event discovery, or a line in a provider) and register the new listener the same way. `QueueActionItemStatusPushes` does not change: it already ignores changes that came from the source.

`app/Jobs/Integrations/PushActionItemState.php`, in `handle()`: replace

```php
        $target = $item->isCompleted() ? ExternalIssueState::Done : ExternalIssueState::Open;
```

with

```php
        $target = DoneMapping::itemState($item, $integration->provider);
```

and the class docblock's "the item's current open/done state" with "the item's current state (open, started where the tracker has it, done)".

`app/Support/Integrations/Jira/JiraTransitions.php`:

```php
    private const array ConfiguredTargets = [
        'open' => 'reopenStatusId',
        'started' => 'startStatusId',
        'done' => 'completeStatusId',
    ];

    private const array StartCategories = ['indeterminate'];
```

In `choose()`, the configured line becomes

```php
        $configured = DoneMapping::configured($integration, $project, self::ConfiguredTargets[$target->value]);
```

and the last statement

```php
        return match ($target) {
            ExternalIssueState::Done => self::doneTransition($integration, $project, $available),
            ExternalIssueState::Started => self::firstOfCategories($available, self::StartCategories),
            ExternalIssueState::Open => self::firstOfCategories($available, self::ReopenCategories),
        };
```

Rename `reopenTransition(array $available)` to `firstOfCategories(array $available, array $categories)` (loop over `$categories` instead of `self::ReopenCategories`; docblock `@param array<int, string> $categories`). In `requiredFields()`, the refusal becomes

```php
                throw new StatusPushRejected($provider, match ($target) {
                    ExternalIssueState::Done => __('Jira requires more fields to close :key. Close it in Jira.', ['key' => $key]),
                    ExternalIssueState::Started => __('Jira requires more fields to start :key. Start it in Jira.', ['key' => $key]),
                    ExternalIssueState::Open => __('Jira requires more fields to reopen :key. Reopen it in Jira.', ['key' => $key]),
                });
```

Class docblock: add "for a start, the configured start status, else the first `indeterminate` target".

`app/Exceptions/Integrations/StatusPushRejected.php`, `unavailable()`:

```php
        return new self($provider, match ($target) {
            ExternalIssueState::Done => __('No transition to a done status is available for :key.', ['key' => $key]),
            ExternalIssueState::Started => __('No transition to an in-progress status is available for :key.', ['key' => $key]),
            ExternalIssueState::Open => __('No transition to an open status is available for :key.', ['key' => $key]),
        });
```

`app/Support/Integrations/Trackers/LinearTracker.php`, `targetState()`:

```php
        $configured = DoneMapping::configured($integration, $team, match ($target) {
            ExternalIssueState::Done => 'completeStateId',
            ExternalIssueState::Started => 'startStateId',
            ExternalIssueState::Open => 'reopenStateId',
        });

        foreach ($states as $state) {
            if ($configured !== null && $state['id'] === $configured) {
                return $state;
            }
        }

        $types = match ($target) {
            ExternalIssueState::Done => ['completed'],
            ExternalIssueState::Started => ['started'],
            ExternalIssueState::Open => ['unstarted', 'backlog'],
        };

        foreach ($types as $type) {
            foreach ($states as $state) {
                if ($state['type'] === $type) {
                    return $state;
                }
            }
        }

        return null;
```

and its docblock: "else the first `completed` state, for a start the first `started` state, or for a reopen the first `unstarted`, then `backlog` state, in workflow order".

`DoneMapping::configured()` docblock: list `startStatusId` and `startStateId` with the four others. `GitHubTracker::transition()` does not change: it never receives `Started` (Task 2's `itemState()`).

`lang/*.json`: "Jira requires more fields to start :key. Start it in Jira.", "No transition to an in-progress status is available for :key." (values in Task 17's table; add them now).

- [ ] **Step 4: Run the tests on PostgreSQL**

Run: `bin/test-db pgsql -- tests/Feature/Integrations tests/Feature/ActionItems tests/Arch`.
Expected: PASS, the existing transition and push tests unchanged.

- [ ] **Step 5: Commit**

```bash
git add app/Listeners/QueueProgressedActionItemStatusPushesListener.php app/Jobs/Integrations/PushActionItemState.php app/Support/Integrations/Jira/JiraTransitions.php app/Support/Integrations/Trackers/LinearTracker.php app/Support/Integrations/Trackers/DoneMapping.php app/Exceptions/Integrations/StatusPushRejected.php tests/Feature/Integrations/IssueTransitionsTest.php tests/Feature/Integrations/ActionItemStatusPushTest.php lang
git commit -m "feat(integrations): push In progress to Jira and Linear

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 4: Start status settings — server and "Start to" (decision 2, option C)

**Files:**
- Modify: `app/Actions/Integrations/UpdateStatusSyncSettings.php`, `tests/Feature/Integrations/StatusSyncSettingsTest.php`, `resources/js/types/integrations.ts`, `resources/js/components/integrations/status-mapping-panel.tsx`, `resources/js/components/integrations/trackers.test.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: the settings keys `startStatusId` / `startStateId` read by Task 3.
- Produces: `status_mapping.start_status_id` (Jira, Jira Data Center) and `status_mapping.start_state_id` (Linear) accepted by the team integration update route and stored as `statusMapping.projects.{KEY}.startStatusId` / `statusMapping.teams.{KEY}.startStateId`; `JiraStatusMapping.startStatusId` and `LinearStatusMapping.startStateId` in `types/integrations.ts`; a "Start to" select first in the panel (spec §6.7, §9.8).

- [ ] **Step 1: Write the failing tests**

In `tests/Feature/Integrations/StatusSyncSettingsTest.php`, change the expectation of "saves and resets a status mapping per project" (the stored entry gains the start key, null):

```php
    expect($integration->fresh()->setting('statusMapping'))->toBeIgnoringKeyOrder(['projects' => ['PROJ' => [
        'doneStatusIds' => ['10002', '10005'],
        'startStatusId' => null,
        'completeStatusId' => '10002',
        'reopenStatusId' => null,
    ]]]);
```

Add three rows to the dataset of "validates status mappings":

```php
    'jira start status id' => [IntegrationProvider::Jira, ['container' => 'PROJ', 'start_status_id' => 'abc']],
    'linear start state id' => [IntegrationProvider::Linear, ['container' => 'ENG', 'start_state_id' => 'has spaces']],
    'linear key on jira' => [IntegrationProvider::Jira, ['container' => 'PROJ', 'start_state_id' => 'x']],
```

Append:

```php
it('saves and resets a start status per Jira project and a start state per Linear team', function () {
    $jira = syncSettingsIntegration();
    $admin = integrationAdmin($jira->team);

    $this->actingAs($admin)->patchJson(syncSettingsRoute($jira), ['status_mapping' => ['container' => 'PROJ', 'start_status_id' => '3']])->assertOk();

    expect($jira->fresh()->setting('statusMapping'))->toBeIgnoringKeyOrder(['projects' => ['PROJ' => [
        'doneStatusIds' => null,
        'startStatusId' => '3',
        'completeStatusId' => null,
        'reopenStatusId' => null,
    ]]]);

    $linear = syncSettingsIntegration(IntegrationProvider::Linear);

    $this->actingAs(integrationAdmin($linear->team))->patchJson(syncSettingsRoute($linear), ['status_mapping' => ['container' => 'ENG', 'start_state_id' => 'st-started']])->assertOk();

    expect($linear->fresh()->setting('statusMapping'))->toBeIgnoringKeyOrder(['teams' => ['ENG' => [
        'startStateId' => 'st-started',
        'completeStateId' => null,
        'reopenStateId' => null,
    ]]]);

    $this->actingAs($admin)->patchJson(syncSettingsRoute($jira), ['status_mapping' => ['container' => 'PROJ', 'start_status_id' => null]])->assertOk();

    expect($jira->fresh()->setting('statusMapping'))->toBe(['projects' => []]);
});
```

Read "presents the sync state without secrets" in the same file and add, in the same way it reads the page props, one assertion that a saved `startStatusId` reaches `providers.*.connection.settings.statusMapping.projects.PROJ.startStatusId` (`PresentTeamIntegration` passes `statusMapping` whole, so no server change is expected for it).

In `resources/js/components/integrations/trackers.test.tsx`: add `startStatusId: null` to every Jira mapping fixture and `startStateId: null` to every Linear one (`npm run types:check` names them); then, beside the existing case that reads the "Complete to" combobox (around line 907), add a case written the same way: after "Edit mapping" loads the statuses, the comboboxes are named "Start to", "Complete to", "Reopen to" in that order; choosing "In Progress" in "Start to" sends `TeamIntegrationsController.update` with `status_mapping: { container: 'PROJ', done_status_ids: null, start_status_id: '3', complete_status_id: null, reopen_status_id: null }`; for a Linear connection the select sends `start_state_id`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/StatusSyncSettingsTest.php` and `npm run test -- resources/js/components/integrations/trackers`
Expected: FAIL — `start_status_id` is refused by the `array:` rule; no "Start to" combobox.

- [ ] **Step 3: Implement**

`app/Actions/Integrations/UpdateStatusSyncSettings.php`, `rules()`:
- Jira: `'status_mapping' => ['sometimes', 'array:container,done_status_ids,start_status_id,complete_status_id,reopen_status_id', 'required_array_keys:container']` and, before `complete_status_id`, `'status_mapping.start_status_id' => ['nullable', 'string', self::JiraStatusIdRule],`.
- Linear: `'status_mapping' => ['sometimes', 'array:container,start_state_id,complete_state_id,reopen_state_id', 'required_array_keys:container']` and `'status_mapping.start_state_id' => ['nullable', 'string', self::LinearStateIdRule],`.

`saveMapping()`: the Jira entry gains `'startStatusId' => $mapping['start_status_id'] ?? null,` after `doneStatusIds`; the Linear entry gains `'startStateId' => $mapping['start_state_id'] ?? null,` first. The class docblock adds "the start target (spec 24 §6.7)". Nothing else changes: a container whose values are all null is removed, a remap re-reads.

`resources/js/types/integrations.ts`: `JiraStatusMapping` gains `startStatusId: string | null;` (after `doneStatusIds`), `LinearStatusMapping` gains `startStateId: string | null;` (first).

`resources/js/components/integrations/status-mapping-panel.tsx`, in `ContainerMapping`:
- `current` gains `start_status_id: jira?.startStatusId ?? null,` (Jira, after `done_status_ids`) and `start_state_id: linear?.startStateId ?? null,` (Linear, first);
- `const startKey = isJira ? 'start_status_id' : 'start_state_id';`
- the grid renders `{targetSelect(startKey, t('Start to'))}` before the two existing selects.

`lang/*.json`: "Start to" (values in Task 17's table).

- [ ] **Step 4: Run the tests on PostgreSQL, and the gates**

Run: `bin/test-db pgsql -- tests/Feature/Integrations/StatusSyncSettingsTest.php tests/Feature/Integrations/IssueTransitionsTest.php tests/Feature/Integrations/ActionItemStatusPushTest.php`; `npm run test -- resources/js/components/integrations`; `npm run types:check`, `npm run check`, `npm run build:front`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Actions/Integrations/UpdateStatusSyncSettings.php tests/Feature/Integrations/StatusSyncSettingsTest.php resources/js/types/integrations.ts resources/js/components/integrations/status-mapping-panel.tsx resources/js/components/integrations/trackers.test.tsx lang
git commit -m "feat(integrations): a start status per Jira project and Linear team

Changed expectation: 'saves and resets a status mapping per project' stores
startStatusId (null); three rows added to 'validates status mappings'.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 5: Filters — statuses, priorities, due date, source (AI-2)

**Files:**
- Modify: `app/Actions/ActionItems/ActionItemFilters.php` (rewritten), `app/Actions/ActionItems/ActionItemQuery.php`, `app/Mcp/Tools/Retro/ListActionItems.php`, `tests/Feature/Mcp/RetroListToolsTest.php`
- Create: `tests/Feature/ActionItems/ActionItemFiltersTest.php`

**Interfaces:**
- Consumes: `started_at` (Task 1).
- Produces:
  - `ActionItemFilters` with public properties `array $statuses` (subset of `todo`, `doing`, `completed`, canonical order), `?string $assignee`, `?string $teamId`, `?string $itemId`, `array $priorities` (subset of `high`, `medium`, `low`), `?string $due` (`overdue|today|week|later|none`), `?string $source` (`retro|outside`); constants `Statuses` (the single values MCP and old links use: `open`, `doing`, `overdue`, `completed`, `all`), `StatusTokens`, `DefaultStatuses`, `DueBuckets`, `Sources`; `fromRequest(Request, Collection $visibleTeams): self`, which reads through `fromQuery(array $query, Collection $visibleTeams): self` (used by Task 8 for the `filters` of a bulk request); `forStatus(string $status, ?string $assignee = null): self`; `toArray(): array{status: list<string>, priority: list<string>, due: ?string, source: ?string, assignee: ?string, team: ?string, item: ?string}`.
  - `ActionItemQuery::filter(Builder, User, ActionItemFilters): Builder` and `counts(...)` with the semantics of spec §6.3; `ActionItemQuery::forUser()` unchanged in signature.
  - The `filters` prop of `action-items/index` takes the shape of `toArray()` (consumed by Task 10).

- [ ] **Step 1: Write the failing tests**

`tests/Feature/ActionItems/ActionItemFiltersTest.php`:

```php
<?php

use App\Enums\ActionItemPriority;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-10 12:00:00'));
});

/**
 * Eight items of one team, named by what the filters should find.
 *
 * @return array{0: Team, 1: User}
 */
function actionItemFilterFixture(): array
{
    $team = Team::factory()->create();
    $user = teamMember($team);
    $outside = fn (string $content, array $attributes = []) => ActionItem::factory()->withoutRetro($team, $user)->create(['content' => $content, ...$attributes]);

    $outside('todo high', ['priority' => ActionItemPriority::High]);
    $outside('doing week', ['due_on' => '2026-10-12', 'started_at' => '2026-10-09 10:00:00']);
    $outside('done low', ['priority' => ActionItemPriority::Low, 'completed_at' => '2026-10-09 10:00:00', 'due_on' => '2026-10-01']);
    $outside('overdue low', ['priority' => ActionItemPriority::Low, 'due_on' => '2026-10-08']);
    $outside('today', ['due_on' => '2026-10-10']);
    $outside('last day of week', ['due_on' => '2026-10-16']);
    $outside('later', ['due_on' => '2026-10-17']);
    ActionItem::factory()->create(['retro_id' => Retro::factory()->create(['team_id' => $team->id])->id, 'content' => 'from retro']);

    return [$team, $user];
}

/**
 * @param  array<string, string>  $query
 * @return array<int, string>
 */
function filteredContents(Team $team, User $user, array $query): array
{
    $items = test()->actingAs($user)
        ->get(route('workspaces.actionItems.index', ['workspace' => $team->workspace, ...$query]))
        ->assertOk()
        ->viewData('page')['props']['items']['data'];

    return collect($items)->pluck('content')->sort()->values()->all();
}

it('filters by status, several at once', function (array $query, array $expected) {
    [$team, $user] = actionItemFilterFixture();

    expect(filteredContents($team, $user, $query))->toBe(collect($expected)->sort()->values()->all());
})->with([
    'default: to do and in progress' => [[], ['todo high', 'doing week', 'overdue low', 'today', 'last day of week', 'later', 'from retro']],
    'to do' => [['status' => 'todo'], ['todo high', 'overdue low', 'today', 'last day of week', 'later', 'from retro']],
    'in progress' => [['status' => 'doing'], ['doing week']],
    'done' => [['status' => 'completed'], ['done low']],
    'every status' => [['status' => 'todo,doing,completed'], ['todo high', 'doing week', 'done low', 'overdue low', 'today', 'last day of week', 'later', 'from retro']],
    'unknown falls back' => [['status' => 'someday'], ['todo high', 'doing week', 'overdue low', 'today', 'last day of week', 'later', 'from retro']],
]);

it('reads the single values of before as before', function (string $status, array $expected) {
    [$team, $user] = actionItemFilterFixture();

    expect(filteredContents($team, $user, ['status' => $status]))->toBe(collect($expected)->sort()->values()->all());
})->with([
    'open' => ['open', ['todo high', 'doing week', 'overdue low', 'today', 'last day of week', 'later', 'from retro']],
    'overdue' => ['overdue', ['overdue low']],
    'completed' => ['completed', ['done low']],
    'all' => ['all', ['todo high', 'doing week', 'done low', 'overdue low', 'today', 'last day of week', 'later', 'from retro']],
]);

it('filters by priority, due date and source', function (array $query, array $expected) {
    [$team, $user] = actionItemFilterFixture();

    expect(filteredContents($team, $user, $query))->toBe(collect($expected)->sort()->values()->all());
})->with([
    'priorities' => [['priority' => 'high,low'], ['todo high', 'overdue low']],
    'unknown priority ignored' => [['priority' => 'urgent'], ['todo high', 'doing week', 'overdue low', 'today', 'last day of week', 'later', 'from retro']],
    'overdue' => [['due' => 'overdue'], ['overdue low']],
    'overdue never lists done items' => [['due' => 'overdue', 'status' => 'completed'], []],
    'today' => [['due' => 'today'], ['today']],
    'next 7 days' => [['due' => 'week'], ['doing week', 'today', 'last day of week']],
    'later' => [['due' => 'later'], ['later']],
    'no due date' => [['due' => 'none'], ['todo high', 'from retro']],
    'from a retro' => [['source' => 'retro'], ['from retro']],
    'outside a retro' => [['source' => 'outside'], ['todo high', 'doing week', 'overdue low', 'today', 'last day of week', 'later']],
    'combined' => [['status' => 'todo,completed', 'priority' => 'low', 'source' => 'outside'], ['done low', 'overdue low']],
]);

it('gives the filters back in their canonical form', function () {
    [$team, $user] = actionItemFilterFixture();

    $filters = $this->actingAs($user)
        ->get(route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'status' => 'doing,todo,doing', 'priority' => 'low,high,low', 'due' => 'week', 'source' => 'nowhere']))
        ->viewData('page')['props']['filters'];

    expect($filters)->toBe([
        'status' => ['todo', 'doing'],
        'priority' => ['high', 'low'],
        'due' => 'week',
        'source' => null,
        'assignee' => null,
        'team' => null,
        'item' => null,
    ]);

    $legacy = $this->actingAs($user)
        ->get(route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'status' => 'overdue']))
        ->viewData('page')['props']['filters'];

    expect($legacy['status'])->toBe(['todo', 'doing'])->and($legacy['due'])->toBe('overdue');
});

it('reads the same filters from an array as from the query', function () {
    $team = Team::factory()->create();
    $hidden = Team::factory()->create(['workspace_id' => $team->workspace_id]);

    expect(App\Actions\ActionItems\ActionItemFilters::fromQuery(['status' => 'overdue', 'priority' => 'low,high', 'team' => $hidden->id, 'source' => 7], collect([$team]))->toArray())->toBe([
        'status' => ['todo', 'doing'],
        'priority' => ['high', 'low'],
        'due' => 'overdue',
        'source' => null,
        'assignee' => null,
        'team' => null,
        'item' => null,
    ])->and(App\Actions\ActionItems\ActionItemFilters::fromQuery([], collect([$team]))->toArray()['status'])->toBe(['todo', 'doing']);
});

it('counts under team, assignee, priority and source, whatever the status and the due date', function () {
    [$team, $user] = actionItemFilterFixture();
    $counts = fn (array $query) => $this->actingAs($user)
        ->get(route('workspaces.actionItems.index', ['workspace' => $team->workspace, ...$query]))
        ->viewData('page')['props']['counts'];

    expect($counts([]))->toBe(['open' => 7, 'overdue' => 1, 'completed' => 1, 'mine' => 0, 'rituals' => 1])
        ->and($counts(['status' => 'completed', 'due' => 'today']))->toBe($counts([]))
        ->and($counts(['priority' => 'low']))->toBe(['open' => 1, 'overdue' => 1, 'completed' => 1, 'mine' => 0, 'rituals' => 0])
        ->and($counts(['source' => 'retro']))->toBe(['open' => 1, 'overdue' => 0, 'completed' => 0, 'mine' => 0, 'rituals' => 1]);
});
```

Append to `tests/Feature/Mcp/RetroListToolsTest.php`:

```php
it('lists started action items and keeps the single statuses of before', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $started = ActionItem::factory()->withoutRetro($team, $user)->started()->create();
    $todo = ActionItem::factory()->withoutRetro($team, $user)->create();
    $ids = fn (array $arguments) => collect(mcpStructured(actingAsMcp($user)->tool(ListActionItems::class, $arguments))['items'])->pluck('id')->sort()->values()->all();

    expect($ids(['status' => 'doing']))->toBe([$started->id])
        ->and($ids(['status' => 'open']))->toBe(collect([$started->id, $todo->id])->sort()->values()->all())
        ->and(collect(mcpStructured(actingAsMcp($user)->tool(ListActionItems::class, ['status' => 'doing']))['items'])->first()['status'])->toBe('doing');
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ActionItemFiltersTest.php tests/Feature/Mcp/RetroListToolsTest.php`
Expected: FAIL (the status lists, priority, due and source are ignored; `filters.status` is a string).

- [ ] **Step 3: Implement**

`app/Actions/ActionItems/ActionItemFilters.php` (whole file):

```php
<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemPriority;
use App\Models\Team;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class ActionItemFilters
{
    /**
     * Single status values, as MCP takes them and as links and stored filters of before
     * plan 24 carry them: `open` is "not done", `overdue` is "not done and late".
     */
    public const Statuses = ['open', 'doing', 'overdue', 'completed', 'all'];

    public const StatusTokens = ['todo', 'doing', 'completed'];

    public const DefaultStatuses = ['todo', 'doing'];

    public const DueBuckets = ['overdue', 'today', 'week', 'later', 'none'];

    public const Sources = ['retro', 'outside'];

    /**
     * @param  array<int, string>  $statuses  StatusTokens, canonical order
     * @param  array<int, string>  $priorities  priority values, canonical order; empty is every priority
     */
    public function __construct(
        public array $statuses = self::DefaultStatuses,
        public ?string $assignee = null,
        public ?string $teamId = null,
        public ?string $itemId = null,
        public array $priorities = [],
        public ?string $due = null,
        public ?string $source = null,
    ) {}

    /**
     * @param  Collection<int, Team>  $visibleTeams
     */
    public static function fromRequest(Request $request, Collection $visibleTeams): self
    {
        return self::fromQuery($request->query(), $visibleTeams);
    }

    /**
     * The page's parameters as an array: the request's query, or the `filters` of an "all
     * matching" bulk request. Unknown values fall back to the defaults instead of failing; a
     * team the viewer cannot see is ignored, as on the page.
     *
     * @param  array<array-key, mixed>  $query
     * @param  Collection<int, Team>  $visibleTeams
     */
    public static function fromQuery(array $query, Collection $visibleTeams): self
    {
        $team = $query['team'] ?? null;
        $item = $query['item'] ?? null;
        [$statuses, $statusDue] = self::readStatus($query['status'] ?? null);

        return new self(
            statuses: $statuses,
            assignee: self::assignee($query['assignee'] ?? null),
            teamId: is_string($team) && $visibleTeams->contains('id', $team) ? $team : null,
            itemId: is_string($item) && Str::isUuid($item) ? $item : null,
            priorities: self::many($query['priority'] ?? null, self::priorityValues()),
            due: self::one($query['due'] ?? null, self::DueBuckets) ?? $statusDue,
            source: self::one($query['source'] ?? null, self::Sources),
        );
    }

    /**
     * One of `Statuses`, as MCP sends it.
     */
    public static function forStatus(string $status, ?string $assignee = null): self
    {
        [$statuses, $due] = self::readStatus($status);

        return new self(statuses: $statuses, assignee: self::assignee($assignee), due: $due);
    }

    public function hasEveryStatus(): bool
    {
        return count($this->statuses) === count(self::StatusTokens);
    }

    /**
     * @return array{
     *     status: array<int, string>,
     *     priority: array<int, string>,
     *     due: ?string,
     *     source: ?string,
     *     assignee: ?string,
     *     team: ?string,
     *     item: ?string
     * }
     */
    public function toArray(): array
    {
        return [
            'status' => $this->statuses,
            'priority' => $this->priorities,
            'due' => $this->due,
            'source' => $this->source,
            'assignee' => $this->assignee,
            'team' => $this->teamId,
            'item' => $this->itemId,
        ];
    }

    /**
     * @return array{0: array<int, string>, 1: ?string} the statuses and the due bucket a status value stands for
     */
    private static function readStatus(mixed $value): array
    {
        return match ($value) {
            'open' => [self::DefaultStatuses, null],
            'overdue' => [self::DefaultStatuses, 'overdue'],
            'all' => [self::StatusTokens, null],
            default => [self::many($value, self::StatusTokens) ?: self::DefaultStatuses, null],
        };
    }

    /**
     * The known values of a comma list, once each, in the order of $known.
     *
     * @param  array<int, string>  $known
     * @return array<int, string>
     */
    private static function many(mixed $value, array $known): array
    {
        if (! is_string($value)) {
            return [];
        }

        $given = explode(',', $value);

        return array_values(array_filter($known, fn (string $candidate): bool => in_array($candidate, $given, true)));
    }

    /**
     * @param  array<int, string>  $known
     */
    private static function one(mixed $value, array $known): ?string
    {
        return is_string($value) && in_array($value, $known, true) ? $value : null;
    }

    /**
     * @return array<int, string>
     */
    private static function priorityValues(): array
    {
        return array_map(fn (ActionItemPriority $priority): string => $priority->value, ActionItemPriority::cases());
    }

    private static function assignee(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        if (in_array($value, ['me', 'unassigned'], true)) {
            return $value;
        }

        return Str::isUuid($value) ? $value : null;
    }
}
```

`app/Actions/ActionItems/ActionItemQuery.php`: replace `filter()`, `filterByScope()` and `filterByStatus()`; `counts()` keeps its body (it calls `filterByScope`, which now also applies priority and source):

```php
    /**
     * @param  Builder<ActionItem>  $query
     * @return Builder<ActionItem>
     */
    public function filter(Builder $query, User $user, ActionItemFilters $filters): Builder
    {
        $this->filterByStatuses($query, $filters);
        $this->filterByDue($query, $filters->due);

        return $this->filterByScope($query, $user, $filters);
    }

    /**
     * What the counters follow: everything but the status and the due date.
     *
     * @param  Builder<ActionItem>  $query
     * @return Builder<ActionItem>
     */
    private function filterByScope(Builder $query, User $user, ActionItemFilters $filters): Builder
    {
        $this->filterByAssignee($query, $user, $filters->assignee);

        if ($filters->teamId !== null) {
            $query->where('team_id', $filters->teamId);
        }

        if ($filters->priorities !== [] && count($filters->priorities) < count(ActionItemPriority::cases())) {
            $query->whereIn('priority', $filters->priorities);
        }

        if ($filters->source === 'retro') {
            $query->whereNotNull('retro_id');
        }

        if ($filters->source === 'outside') {
            $query->whereNull('retro_id');
        }

        return $query;
    }

    /**
     * @param  Builder<ActionItem>  $query
     */
    private function filterByStatuses(Builder $query, ActionItemFilters $filters): void
    {
        if ($filters->hasEveryStatus()) {
            return;
        }

        $query->where(function (Builder $query) use ($filters): void {
            foreach ($filters->statuses as $status) {
                $query->orWhere(function (Builder $query) use ($status): void {
                    if ($status === 'completed') {
                        $query->whereNotNull('completed_at');

                        return;
                    }

                    $query->whereNull('completed_at');

                    if ($status === 'doing') {
                        $query->whereNotNull('started_at');

                        return;
                    }

                    $query->whereNull('started_at');
                });
            }
        });
    }

    /**
     * Dates are compared as `Y-m-d` strings (docs/database.md rule 11).
     *
     * @param  Builder<ActionItem>  $query
     */
    private function filterByDue(Builder $query, ?string $due): void
    {
        if ($due === null) {
            return;
        }

        $today = ActionItem::today();
        $todayDate = $today->toDateString();
        $lastOfWeek = $today->addDays(6)->toDateString();

        if ($due === 'none') {
            $query->whereNull('due_on');

            return;
        }

        $query->whereNotNull('due_on');

        if ($due === 'overdue') {
            $query->whereNull('completed_at')->where('due_on', '<', $todayDate);

            return;
        }

        if ($due === 'today') {
            $query->where('due_on', $todayDate);

            return;
        }

        if ($due === 'week') {
            $query->where('due_on', '>=', $todayDate)->where('due_on', '<=', $lastOfWeek);

            return;
        }

        $query->where('due_on', '>', $lastOfWeek);
    }
```

Add `use App\Enums\ActionItemPriority;`. Delete the old `filterByStatus()`.

`app/Mcp/Tools/Retro/ListActionItems.php`: replace the `new ActionItemFilters(…)` call with

```php
        $filters = ActionItemFilters::forStatus((string) ($validated['status'] ?? 'open'), $validated['assignee'] ?? null);
```

The schema and the validation keep reading `ActionItemFilters::Statuses`, which now includes `doing`.

`WorkspaceActionItemsController::index` needs no change: `filters` is `$filters->toArray()`.

- [ ] **Step 4: Run the tests on PostgreSQL**

Run: `bin/test-db pgsql -- tests/Feature/ActionItems tests/Feature/Mcp tests/Feature/Database/ActionItemOrderTest.php`.
Expected: PASS. `ActionItemsPageTest` ("filters by status, assignee and team") passes unchanged: it sends single values. If a test of that file reads `props.filters.status` as a string, change its expectation to the list and list the file in the commit message.

- [ ] **Step 5: Commit**

```bash
git add app/Actions/ActionItems/ActionItemFilters.php app/Actions/ActionItems/ActionItemQuery.php app/Mcp/Tools/Retro/ListActionItems.php tests/Feature/ActionItems/ActionItemFiltersTest.php tests/Feature/Mcp/RetroListToolsTest.php
git commit -m "feat(action-items): filters by statuses, priority, due date and source (AI-2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 6: Bulk changes (AI-1) — endpoint, per-item loop, races

**Files:**
- Create: `app/Actions/ActionItems/ActionItemBulkChanges.php`, `app/Http/Requests/ActionItems/ActionItemBulkUpdateRequest.php`, `app/Http/Controllers/WorkspaceActionItemBulkUpdatesController.php`, `tests/Feature/ActionItems/ActionItemBulkUpdatesTest.php`, `tests/Concurrency/ActionItemBulkTest.php`
- Modify: `routes/web.php`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: `ApplyActionItemChanges::handle(ActionItem $locked, ActionItemActor $actor, array $validated): ActionItem`, `WorkspaceActionItemGuard::lockWritable(string $id): ActionItem`, `ActionItemQuery::visibleTo(User, Workspace): Builder`, `PresentActionItem::many(iterable, ?ActionItemActor): array`.
- Produces: `ActionItemBulkChanges::update(User $user, Workspace $workspace, array $ids, array $changes): array{changed: array<int, ActionItem>, refused: array<int, array{id: string, title: ?string, message: string}>}` and `ActionItemBulkChanges::delete(User $user, Workspace $workspace, array $ids): array{changed: array<int, string>, refused: array<int, array{id: string, title: ?string, message: string}>}` (the latter used by Task 7; both used by Task 8); a refusal's `title` is the item's text when the viewer can see it, null when it is gone or invisible; route `workspaces.actionItemBulkUpdates.store` (`POST workspaces/{workspace}/action-items/bulk-updates`, body `{ids, changes}`, answer `{actionItems, changedCount, refused}`; Task 8 adds the `{filters, count}` body).

- [ ] **Step 1: Write the failing tests**

`tests/Feature/ActionItems/ActionItemBulkUpdatesTest.php`:

```php
<?php

use App\Enums\ActionItemRecurrence;
use App\Enums\RetroPhase;
use App\Events\ActionItems\ActionItemCompleted;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Event::fake([TeamActionItemSaved::class, ActionItemCompleted::class]);
});

/**
 * @param  array<int, string>  $ids
 * @param  array<string, mixed>  $changes
 */
function postBulkUpdate(Team $team, User $user, array $ids, array $changes): TestResponse
{
    return test()->actingAs($user)->postJson(route('workspaces.actionItemBulkUpdates.store', $team->workspace), ['ids' => $ids, 'changes' => $changes]);
}

it('changes every item the member may change, and announces each', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $mate = teamMember($team);
    $items = ActionItem::factory()->withoutRetro($team, $user)->count(3)->create();

    postBulkUpdate($team, $user, $items->pluck('id')->all(), ['priority' => 'high', 'due_on' => '2026-11-02', 'assignee_user_id' => $mate->id])
        ->assertOk()
        ->assertJsonCount(3, 'actionItems')
        ->assertJsonPath('changedCount', 3)
        ->assertJsonPath('refused', [])
        ->assertJsonPath('actionItems.0.priority', 'high')
        ->assertJsonPath('actionItems.0.dueOn', '2026-11-02')
        ->assertJsonPath('actionItems.0.assignee.id', $mate->id);

    expect(ActionItem::query()->whereKey($items->pluck('id'))->where('priority', 'high')->count())->toBe(3);
    Event::assertDispatchedTimes(TeamActionItemSaved::class, 3);
});

it('completes in bulk, with one next occurrence and one completion per item', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $items = ActionItem::factory()->withoutRetro($team, $user)->recurring(ActionItemRecurrence::Weekly)->count(2)->create();

    postBulkUpdate($team, $user, $items->pluck('id')->all(), ['status' => 'completed'])->assertOk()->assertJsonPath('actionItems.1.status', 'completed');

    expect(ActionItem::query()->whereIn('previous_occurrence_id', $items->pluck('id'))->count())->toBe(2);
    Event::assertDispatchedTimes(ActionItemCompleted::class, 2);
});

it('starts items in bulk', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $items = ActionItem::factory()->withoutRetro($team, $user)->count(2)->create();

    postBulkUpdate($team, $user, $items->pluck('id')->all(), ['status' => 'doing'])->assertOk();

    expect(ActionItem::query()->whereKey($items->pluck('id'))->whereNotNull('started_at')->count())->toBe(2);
});

it('changes what it can and refuses the rest, each with its reason', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $author = teamMember($team);
    $mine = ActionItem::factory()->withoutRetro($team, $user)->create();
    $someoneElses = ActionItem::factory()->withoutRetro($team, $author)->create();
    $recurring = ActionItem::factory()->withoutRetro($team, $user)->recurring(ActionItemRecurrence::Weekly)->create();
    $lockedRetro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['team_id' => $team->id, 'is_locked' => true]);
    $onLockedBoard = ActionItem::factory()->create(['retro_id' => $lockedRetro->id]);
    $invisible = ActionItem::factory()->withoutRetro(Team::factory()->create(['workspace_id' => $team->workspace_id]), User::factory()->create())->create();
    $deleted = ActionItem::factory()->withoutRetro($team, $user)->create();
    $deletedId = $deleted->id;
    $deleted->delete();

    $response = postBulkUpdate($team, $user, [$mine->id, $someoneElses->id, $recurring->id, $onLockedBoard->id, $invisible->id, $deletedId], ['due_on' => null, 'priority' => 'low'])
        ->assertOk()
        ->assertJsonCount(1, 'actionItems')
        ->assertJsonPath('actionItems.0.id', $mine->id)
        ->assertJsonPath('actionItems.0.priority', 'low');

    expect(collect($response->json('refused'))->pluck('message', 'id')->all())->toBe([
        $someoneElses->id => 'Only the author, the facilitator or an admin can change this action item.',
        $recurring->id => 'A recurring action item needs a due date.',
        $onLockedBoard->id => 'The board is closed for editing.',
        $invisible->id => 'This action item no longer exists.',
        $deletedId => 'This action item no longer exists.',
    ]);
    expect(collect($response->json('refused'))->pluck('title', 'id')->all())->toBe([
        $someoneElses->id => $someoneElses->content,
        $recurring->id => $recurring->content,
        $onLockedBoard->id => $onLockedBoard->content,
        $invisible->id => null,
        $deletedId => null,
    ]);
    expect($someoneElses->fresh()->priority->value)->toBe('medium')
        ->and($recurring->fresh()->due_on)->not->toBeNull()
        ->and($recurring->fresh()->priority->value)->toBe('medium');
});

it('refuses an assignee who is not in the item\'s team, item by item', function () {
    $team = Team::factory()->create();
    $other = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $admin = workspaceManager($team->workspace);
    $mate = teamMember($team);
    $here = ActionItem::factory()->withoutRetro($team, $admin)->create();
    $there = ActionItem::factory()->withoutRetro($other, $admin)->create();

    $response = postBulkUpdate($team, $admin, [$here->id, $there->id], ['assignee_user_id' => $mate->id])->assertOk();

    expect($response->json('actionItems.0.id'))->toBe($here->id)
        ->and($response->json('refused.0.id'))->toBe($there->id)
        ->and($there->fresh()->assignee_user_id)->toBeNull();
});

it('refuses a request it cannot read', function (Closure $body) {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create();

    $this->actingAs($user)->postJson(route('workspaces.actionItemBulkUpdates.store', $team->workspace), $body($item->id))->assertUnprocessable();

    expect($item->fresh()->priority->value)->toBe('medium');
})->with([
    'no id' => [fn (string $id) => ['ids' => [], 'changes' => ['priority' => 'low']]],
    'too many ids' => [fn (string $id) => ['ids' => [$id, ...array_map(fn () => (string) Illuminate\Support\Str::uuid7(), range(1, 50))], 'changes' => ['priority' => 'low']]],
    'not a uuid' => [fn (string $id) => ['ids' => [$id, 'nope'], 'changes' => ['priority' => 'low']]],
    'no change' => [fn (string $id) => ['ids' => [$id], 'changes' => []]],
    'unknown change' => [fn (string $id) => ['ids' => [$id], 'changes' => ['priority' => 'low', 'content' => 'Renamed']]],
    'bad status' => [fn (string $id) => ['ids' => [$id], 'changes' => ['priority' => 'low', 'status' => 'someday']]],
    'bad date' => [fn (string $id) => ['ids' => [$id], 'changes' => ['priority' => 'low', 'due_on' => '02/11/2026']]],
]);

it('keeps guests and other workspaces out', function () {
    $team = Team::factory()->create();
    $item = ActionItem::factory()->withoutRetro($team, teamMember($team))->create();

    $this->postJson(route('workspaces.actionItemBulkUpdates.store', $team->workspace), ['ids' => [$item->id], 'changes' => ['priority' => 'low']])->assertUnauthorized();
    postBulkUpdate($team, User::factory()->create(), [$item->id], ['priority' => 'low'])->assertForbidden();
});
```

The unknown-change case sends `changes: {priority: low, content: Renamed}` after `array_replace_recursive`, which the `array:` rule refuses. Before writing the "too many ids" case, check that `Str::uuid7()` is how the suite makes ids elsewhere (`tests/Upgrade/ActionItemSortRankBackfillTest.php` does).

`tests/Concurrency/ActionItemBulkTest.php`:

```php
<?php

use App\Enums\ActionItemRecurrence;
use App\Models\ActionItem;
use App\Models\Team;
use Tests\Concurrency\Support\Race;

it('completes the same recurring items twice at once and leaves one next occurrence each', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $ids = ActionItem::factory()->withoutRetro($team, $user)->recurring(ActionItemRecurrence::Weekly)->count(4)->create()->pluck('id')->all();
    $userId = $user->id;
    $uri = route('workspaces.actionItemBulkUpdates.store', $team->workspace, false);
    $payload = ['ids' => $ids, 'changes' => ['status' => 'completed']];

    $outcomes = Race::run([
        static fn (): int => Race::request($userId, 'POST', $uri, $payload),
        static fn (): int => Race::request($userId, 'POST', $uri, $payload),
    ]);

    expect(array_column($outcomes, 'value'))->toBe([200, 200])
        ->and(ActionItem::query()->whereIn('previous_occurrence_id', $ids)->count())->toBe(4)
        ->and(ActionItem::query()->whereKey($ids)->whereNull('completed_at')->count())->toBe(0);
});
```

The protection proved: the row lock of `WorkspaceActionItemGuard::lockWritable` and the early return of `SetActionItemStatus` when the item already has the status; without the lock both requests read "open" and the second completion collides with the unique `previous_occurrence_id` (500).

- [ ] **Step 2: Run the tests to see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ActionItemBulkUpdatesTest.php`
Expected: FAIL — `Route [workspaces.actionItemBulkUpdates.store] not defined.`

- [ ] **Step 3: Implement**

`app/Actions/ActionItems/ActionItemBulkChanges.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;
use App\Models\User;
use App\Models\Workspace;
use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

/**
 * Spec 24 §5 rules 1 and 2: a bulk change is the single-item change applied to each item in
 * turn, each in its own transaction under its own lock, so that a refused item leaves the
 * others changed. The transactions broadcast, so they are not retried.
 */
class ActionItemBulkChanges
{
    public function __construct(
        private ActionItemQuery $actionItemQuery,
        private ApplyActionItemChanges $applyActionItemChanges,
        private DeleteActionItem $deleteActionItem,
    ) {}

    /**
     * @param  array<int, string>  $ids
     * @param  array<string, mixed>  $changes  validated like ActionItemRules::update(allowsGuests: false)
     * @return array{changed: array<int, ActionItem>, refused: array<int, array{id: string, title: ?string, message: string}>}
     */
    public function update(User $user, Workspace $workspace, array $ids, array $changes): array
    {
        $actor = ActionItemActor::forUser($user);

        return $this->each($user, $workspace, $ids, fn (string $id): ActionItem => DB::transaction(
            fn (): ActionItem => $this->applyActionItemChanges->handle(WorkspaceActionItemGuard::lockWritable($id), $actor, $changes),
        ));
    }

    /**
     * @param  array<int, string>  $ids
     * @return array{changed: array<int, string>, refused: array<int, array{id: string, title: ?string, message: string}>}
     */
    public function delete(User $user, Workspace $workspace, array $ids): array
    {
        $actor = ActionItemActor::forUser($user);

        return $this->each($user, $workspace, $ids, function (string $id) use ($actor): string {
            DB::transaction(fn () => $this->deleteActionItem->handle(WorkspaceActionItemGuard::lockWritable($id), $actor));

            return $id;
        });
    }

    /**
     * An item the viewer cannot see reads as one that is gone, without a title: nothing tells
     * them it exists. A visible item's refusal carries its text, for a list the page may not hold.
     *
     * @template TChanged
     *
     * @param  array<int, string>  $ids
     * @param  Closure(string): TChanged  $change
     * @return array{changed: array<int, TChanged>, refused: array<int, array{id: string, title: ?string, message: string}>}
     */
    private function each(User $user, Workspace $workspace, array $ids, Closure $change): array
    {
        $titles = $this->actionItemQuery->visibleTo($user, $workspace)->whereKey($ids)->pluck('content', 'id')->all();
        $changed = [];
        $refused = [];

        foreach ($ids as $id) {
            if (! array_key_exists($id, $titles)) {
                $refused[] = ['id' => $id, 'title' => null, 'message' => __('This action item no longer exists.')];

                continue;
            }

            try {
                $changed[] = $change($id);
            } catch (AuthorizationException|ValidationException|HttpException|ModelNotFoundException $exception) {
                $refused[] = [
                    'id' => $id,
                    'title' => $exception instanceof ModelNotFoundException ? null : (string) $titles[$id],
                    'message' => $this->reason($exception),
                ];
            }
        }

        return ['changed' => $changed, 'refused' => $refused];
    }

    private function reason(Throwable $exception): string
    {
        if ($exception instanceof ValidationException) {
            return (string) collect($exception->errors())->flatten()->first();
        }

        if ($exception instanceof ModelNotFoundException) {
            return __('This action item no longer exists.');
        }

        return $exception->getMessage();
    }
}
```

`app/Http/Requests/ActionItems/ActionItemBulkUpdateRequest.php` (`vendor/bin/sail artisan make:request ActionItems/ActionItemBulkUpdateRequest --no-interaction`):

```php
<?php

namespace App\Http\Requests\ActionItems;

use App\Actions\ActionItems\ActionItemQuery;
use App\Actions\ActionItems\ActionItemRules;
use Illuminate\Foundation\Http\FormRequest;

class ActionItemBulkUpdateRequest extends FormRequest
{
    public const Changes = ['status', 'priority', 'due_on', 'assignee_user_id'];

    public function authorize(): bool
    {
        return true;
    }

    /**
     * The values are checked as the single-item update checks them.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $single = collect(ActionItemRules::update(allowsGuests: false))
            ->only(self::Changes)
            ->mapWithKeys(fn (array $rules, string $field): array => ["changes.{$field}" => $rules])
            ->all();

        return [
            'ids' => ['required', 'array', 'min:1', 'max:'.ActionItemQuery::PerPage],
            'ids.*' => ['required', 'uuid', 'distinct'],
            'changes' => ['required', 'array:'.implode(',', self::Changes), 'min:1'],
            ...$single,
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ActionItemRules::messages();
    }
}
```

`app/Http/Controllers/WorkspaceActionItemBulkUpdatesController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemBulkChanges;
use App\Actions\Retros\PresentActionItem;
use App\Http\Requests\ActionItems\ActionItemBulkUpdateRequest;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;

class WorkspaceActionItemBulkUpdatesController extends Controller
{
    public function store(ActionItemBulkUpdateRequest $request, Workspace $workspace, ActionItemBulkChanges $bulkChanges, PresentActionItem $presentActionItem): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validated();
        $result = $bulkChanges->update($user, $workspace, $validated['ids'], $validated['changes']);

        return response()->json([
            'actionItems' => $presentActionItem->many($result['changed'], ActionItemActor::forUser($user)),
            'changedCount' => count($result['changed']),
            'refused' => $result['refused'],
        ]);
    }
}
```

`routes/web.php`, before `Route::patch('action-items/{actionItem}', …)` in the workspace group:

```php
            Route::post('action-items/bulk-updates', [WorkspaceActionItemBulkUpdatesController::class, 'store'])->name('workspaces.actionItemBulkUpdates.store');
```

with `use App\Http\Controllers\WorkspaceActionItemBulkUpdatesController;` in alphabetical place.

`lang/*.json`: the key "This action item no longer exists." (values in Task 17's table; add them now).

- [ ] **Step 4: Run the tests on PostgreSQL, and the race**

Run: `bin/test-db pgsql -- tests/Feature/ActionItems tests/Arch`; then `bin/test-db pgsql --concurrency -- tests/Concurrency/ActionItemBulkTest.php`.
Expected: PASS. If the refusal sentence of a locked board or of a missing right differs from the one written in the test, the test follows the code's sentence (they are the single-item endpoint's) and the commit message says so.

- [ ] **Step 5: Commit**

```bash
git add app/Actions/ActionItems/ActionItemBulkChanges.php app/Http/Requests/ActionItems/ActionItemBulkUpdateRequest.php app/Http/Controllers/WorkspaceActionItemBulkUpdatesController.php routes/web.php tests/Feature/ActionItems/ActionItemBulkUpdatesTest.php tests/Concurrency/ActionItemBulkTest.php lang
git commit -m "feat(action-items): bulk changes, item by item (AI-1)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 7: Bulk deletion (AI-1)

**Files:**
- Create: `app/Http/Requests/ActionItems/ActionItemBulkDeletionRequest.php`, `app/Http/Controllers/WorkspaceActionItemBulkDeletionsController.php`, `tests/Feature/ActionItems/ActionItemBulkDeletionsTest.php`
- Modify: `routes/web.php`, `tests/Concurrency/ActionItemBulkTest.php`

**Interfaces:**
- Consumes: `ActionItemBulkChanges::delete()` (Task 6).
- Produces: route `workspaces.actionItemBulkDeletions.store` (`POST workspaces/{workspace}/action-items/bulk-deletions`, body `{ids}`, answer `{deleted: string[], refused: {id, message}[]}`).

- [ ] **Step 1: Write the failing tests**

`tests/Feature/ActionItems/ActionItemBulkDeletionsTest.php`:

```php
<?php

use App\Events\ActionItems\TeamActionItemDeleted;
use App\Models\ActionItem;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake([TeamActionItemDeleted::class]);
});

it('deletes what the member may delete and refuses the rest', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $mine = ActionItem::factory()->withoutRetro($team, $user)->withSubtasks(2)->create();
    $someoneElses = ActionItem::factory()->withoutRetro($team, teamMember($team))->create();
    $invisible = ActionItem::factory()->withoutRetro(Team::factory()->create(['workspace_id' => $team->workspace_id]), User::factory()->create())->create();

    $this->actingAs($user)
        ->postJson(route('workspaces.actionItemBulkDeletions.store', $team->workspace), ['ids' => [$mine->id, $someoneElses->id, $invisible->id]])
        ->assertOk()
        ->assertJsonPath('deleted', [$mine->id])
        ->assertJsonPath('refused.0.id', $someoneElses->id)
        ->assertJsonPath('refused.0.message', 'Only the author, the facilitator or an admin can change this action item.')
        ->assertJsonPath('refused.1.message', 'This action item no longer exists.');

    expect(ActionItem::query()->find($mine->id))->toBeNull()
        ->and($someoneElses->fresh())->not->toBeNull()
        ->and($invisible->fresh())->not->toBeNull();
    Event::assertDispatchedTimes(TeamActionItemDeleted::class, 1);
});

it('lets a workspace admin delete any item in bulk', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);
    $ids = ActionItem::factory()->withoutRetro($team, teamMember($team))->count(3)->create()->pluck('id')->all();

    $this->actingAs($admin)
        ->postJson(route('workspaces.actionItemBulkDeletions.store', $team->workspace), ['ids' => $ids])
        ->assertOk()
        ->assertJsonCount(3, 'deleted');

    expect(ActionItem::query()->whereKey($ids)->count())->toBe(0);
});

it('refuses an empty or oversized list', function (array $ids) {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->postJson(route('workspaces.actionItemBulkDeletions.store', $team->workspace), ['ids' => $ids])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('ids');
})->with([
    'empty' => [[]],
    'too many' => [array_map(fn () => (string) Illuminate\Support\Str::uuid7(), range(1, 51))],
]);
```

Append to `tests/Concurrency/ActionItemBulkTest.php`:

```php
it('deletes and changes the same items at once without a failure, and leaves none', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $ids = ActionItem::factory()->withoutRetro($team, $user)->count(4)->create()->pluck('id')->all();
    $userId = $user->id;
    $update = route('workspaces.actionItemBulkUpdates.store', $team->workspace, false);
    $deletion = route('workspaces.actionItemBulkDeletions.store', $team->workspace, false);

    $outcomes = Race::run([
        'update' => static fn (): int => Race::request($userId, 'POST', $update, ['ids' => $ids, 'changes' => ['status' => 'doing']]),
        'deletion' => static fn (): int => Race::request($userId, 'POST', $deletion, ['ids' => $ids]),
    ]);

    expect($outcomes['update']['value'])->toBe(200)
        ->and($outcomes['deletion']['value'])->toBe(200)
        ->and(ActionItem::query()->whereKey($ids)->count())->toBe(0);
});
```

The protection proved: each item is locked by the deletion and by the update; an update that finds its row gone (`lockWritable` → `firstOrFail`) records a refusal instead of failing the request.

- [ ] **Step 2: Run the tests to see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ActionItemBulkDeletionsTest.php`
Expected: FAIL — route not defined.

- [ ] **Step 3: Implement**

`app/Http/Requests/ActionItems/ActionItemBulkDeletionRequest.php`:

```php
<?php

namespace App\Http\Requests\ActionItems;

use App\Actions\ActionItems\ActionItemQuery;
use Illuminate\Foundation\Http\FormRequest;

class ActionItemBulkDeletionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'ids' => ['required', 'array', 'min:1', 'max:'.ActionItemQuery::PerPage],
            'ids.*' => ['required', 'uuid', 'distinct'],
        ];
    }
}
```

`app/Http/Controllers/WorkspaceActionItemBulkDeletionsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\ActionItems\ActionItemBulkChanges;
use App\Http\Requests\ActionItems\ActionItemBulkDeletionRequest;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;

class WorkspaceActionItemBulkDeletionsController extends Controller
{
    public function store(ActionItemBulkDeletionRequest $request, Workspace $workspace, ActionItemBulkChanges $bulkChanges): JsonResponse
    {
        $result = $bulkChanges->delete($request->user(), $workspace, $request->validated('ids'));

        return response()->json(['deleted' => $result['changed'], 'refused' => $result['refused']]);
    }
}
```

`routes/web.php`, beside the bulk-updates route:

```php
            Route::post('action-items/bulk-deletions', [WorkspaceActionItemBulkDeletionsController::class, 'store'])->name('workspaces.actionItemBulkDeletions.store');
```

- [ ] **Step 4: Run the tests on PostgreSQL, and the race**

Run: `bin/test-db pgsql -- tests/Feature/ActionItems`; then `bin/test-db pgsql --concurrency -- tests/Concurrency/ActionItemBulkTest.php`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Requests/ActionItems/ActionItemBulkDeletionRequest.php app/Http/Controllers/WorkspaceActionItemBulkDeletionsController.php routes/web.php tests/Feature/ActionItems/ActionItemBulkDeletionsTest.php tests/Concurrency/ActionItemBulkTest.php
git commit -m "feat(action-items): bulk deletion, item by item (AI-1)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 8: "All matching" — bulk changes and deletions over the filters (decision 6, option B)

**Files:**
- Create: `tests/Feature/ActionItems/ActionItemBulkMatchingTest.php`
- Modify: `app/Actions/ActionItems/ActionItemBulkChanges.php`, `app/Http/Requests/ActionItems/ActionItemBulkUpdateRequest.php`, `app/Http/Requests/ActionItems/ActionItemBulkDeletionRequest.php`, `app/Http/Controllers/WorkspaceActionItemBulkUpdatesController.php`, `app/Http/Controllers/WorkspaceActionItemBulkDeletionsController.php`, `tests/Concurrency/ActionItemBulkTest.php`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: `ActionItemFilters::fromQuery(array, Collection)` (Task 5); `ActionItemQuery::visibleTo()`, `filter()`, `order()`; `ActionItemBulkChanges::update()`, `delete()` (Tasks 6, 7); `Workspace::teamsVisibleTo(User)` (exists).
- Produces: `ActionItemBulkChanges::MatchingCap = 500`, `ActionItemBulkChanges::FilterKeys`, `ActionItemBulkChanges::matching(User $user, Workspace $workspace, array $query, int $confirmedCount): array<int, string>` (throws `ValidationException` on `filters` above the cap, on `count` when the number differs); both bulk routes accept `{filters, count}` instead of `{ids}` (spec §6.5; `filters` may be empty, which is the landing filters); the update answer's `actionItems` is empty for a filters target.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/ActionItems/ActionItemBulkMatchingTest.php`:

```php
<?php

use App\Enums\ActionItemPriority;
use App\Events\ActionItems\TeamActionItemDeleted;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Models\ActionItem;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Event::fake([TeamActionItemSaved::class, TeamActionItemDeleted::class]);
    $this->travelTo(CarbonImmutable::parse('2026-11-02 09:00:00'));
});

/**
 * @param  array<string, mixed>  $body
 */
function postBulkMatching(Team $team, User $user, string $route, array $body): TestResponse
{
    return test()->actingAs($user)->postJson(route($route, $team->workspace), $body);
}

it('changes every visible item the filters match, and only those', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $low = ActionItem::factory()->withoutRetro($team, $user)->count(3)->create(['priority' => ActionItemPriority::Low]);
    $high = ActionItem::factory()->withoutRetro($team, $user)->create(['priority' => ActionItemPriority::High]);
    $elsewhere = ActionItem::factory()->withoutRetro(Team::factory()->create(['workspace_id' => $team->workspace_id]), User::factory()->create())->create(['priority' => ActionItemPriority::Low]);

    postBulkMatching($team, $user, 'workspaces.actionItemBulkUpdates.store', ['filters' => ['priority' => 'low'], 'count' => 3, 'changes' => ['status' => 'doing']])
        ->assertOk()
        ->assertJsonPath('actionItems', [])
        ->assertJsonPath('changedCount', 3)
        ->assertJsonPath('refused', []);

    expect(ActionItem::query()->whereNotNull('started_at')->pluck('id')->sort()->values()->all())->toBe($low->pluck('id')->sort()->values()->all())
        ->and($high->fresh()->started_at)->toBeNull()
        ->and($elsewhere->fresh()->started_at)->toBeNull();
    Event::assertDispatchedTimes(TeamActionItemSaved::class, 3);
});

it('reads empty filters as the landing filters', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $user)->count(2)->create();
    $done = ActionItem::factory()->withoutRetro($team, $user)->completed()->create();

    postBulkMatching($team, $user, 'workspaces.actionItemBulkUpdates.store', ['filters' => [], 'count' => 2, 'changes' => ['priority' => 'high']])
        ->assertOk()
        ->assertJsonPath('changedCount', 2);

    expect($done->fresh()->priority)->toBe(ActionItemPriority::Medium);
});

it('never reaches a team the member cannot see through the filters', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $hidden = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $mine = ActionItem::factory()->withoutRetro($team, $user)->create();
    $theirs = ActionItem::factory()->withoutRetro($hidden, User::factory()->create())->create();

    postBulkMatching($team, $user, 'workspaces.actionItemBulkUpdates.store', ['filters' => ['team' => $hidden->id], 'count' => 1, 'changes' => ['priority' => 'low']])
        ->assertOk()
        ->assertJsonPath('changedCount', 1);

    expect($mine->fresh()->priority)->toBe(ActionItemPriority::Low)
        ->and($theirs->fresh()->priority)->toBe(ActionItemPriority::Medium);
});

it('refuses the items the member may not change, with their title, in the order of the list', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $author = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Mine']);
    $later = ActionItem::factory()->withoutRetro($team, $author)->create(['content' => 'Later', 'due_on' => '2026-11-20']);
    $sooner = ActionItem::factory()->withoutRetro($team, $author)->create(['content' => 'Sooner', 'due_on' => '2026-11-10']);

    $response = postBulkMatching($team, $user, 'workspaces.actionItemBulkUpdates.store', ['filters' => [], 'count' => 3, 'changes' => ['priority' => 'low']])
        ->assertOk()
        ->assertJsonPath('changedCount', 1);

    expect($response->json('refused'))->toBe([
        ['id' => $sooner->id, 'title' => 'Sooner', 'message' => 'Only the author, the facilitator or an admin can change this action item.'],
        ['id' => $later->id, 'title' => 'Later', 'message' => 'Only the author, the facilitator or an admin can change this action item.'],
    ]);
});

it('changes nothing when the list changed since the member counted it', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $items = ActionItem::factory()->withoutRetro($team, $user)->count(3)->create();

    postBulkMatching($team, $user, 'workspaces.actionItemBulkUpdates.store', ['filters' => [], 'count' => 2, 'changes' => ['priority' => 'low']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['count' => 'The list changed: 3 action items match now.']);

    expect(ActionItem::query()->whereKey($items->pluck('id'))->where('priority', 'low')->count())->toBe(0);
    Event::assertNotDispatched(TeamActionItemSaved::class);
});

it('refuses more matching items than the cap, and changes the cap in one request', function () {
    Queue::fake();
    $team = Team::factory()->create();
    $user = teamMember($team);
    $items = ActionItem::factory()->withoutRetro($team, $user)->count(500)->create();

    postBulkMatching($team, $user, 'workspaces.actionItemBulkUpdates.store', ['filters' => [], 'count' => 500, 'changes' => ['status' => 'completed']])
        ->assertOk()
        ->assertJsonPath('changedCount', 500);

    ActionItem::factory()->withoutRetro($team, $user)->count(501)->create();

    postBulkMatching($team, $user, 'workspaces.actionItemBulkUpdates.store', ['filters' => [], 'count' => 500, 'changes' => ['priority' => 'low']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['filters' => 'More than 500 action items match. Narrow the filters.']);

    expect(ActionItem::query()->whereKey($items->pluck('id'))->whereNull('completed_at')->count())->toBe(0)
        ->and(ActionItem::query()->where('priority', 'low')->count())->toBe(0);
});

it('deletes every matching item the member may delete', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $outside = ActionItem::factory()->withoutRetro($team, $user)->count(2)->create();
    $theirs = ActionItem::factory()->withoutRetro($team, teamMember($team))->create(['content' => 'Theirs']);

    $response = postBulkMatching($team, $user, 'workspaces.actionItemBulkDeletions.store', ['filters' => ['source' => 'outside'], 'count' => 3])
        ->assertOk()
        ->assertJsonCount(2, 'deleted')
        ->assertJsonPath('refused.0.title', 'Theirs');

    expect(ActionItem::query()->whereKey($outside->pluck('id'))->count())->toBe(0)
        ->and($theirs->fresh())->not->toBeNull()
        ->and($response->json('refused.0.id'))->toBe($theirs->id);
    Event::assertDispatchedTimes(TeamActionItemDeleted::class, 2);
});

it('refuses a target it cannot read', function (string $route, Closure $body) {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create();

    postBulkMatching($team, $user, $route, $body($item->id))->assertUnprocessable();

    expect($item->fresh())->not->toBeNull()
        ->and($item->fresh()->priority)->toBe(ActionItemPriority::Medium);
})->with([
    'ids and count' => ['workspaces.actionItemBulkUpdates.store', fn (string $id) => ['ids' => [$id], 'count' => 1, 'changes' => ['priority' => 'low']]],
    'ids and filters' => ['workspaces.actionItemBulkUpdates.store', fn (string $id) => ['ids' => [$id], 'filters' => [], 'changes' => ['priority' => 'low']]],
    'filters without count' => ['workspaces.actionItemBulkUpdates.store', fn (string $id) => ['filters' => ['priority' => 'medium'], 'changes' => ['priority' => 'low']]],
    'count above the cap' => ['workspaces.actionItemBulkUpdates.store', fn (string $id) => ['filters' => [], 'count' => 501, 'changes' => ['priority' => 'low']]],
    'unknown filter' => ['workspaces.actionItemBulkUpdates.store', fn (string $id) => ['filters' => ['item' => $id], 'count' => 1, 'changes' => ['priority' => 'low']]],
    'deletion without count' => ['workspaces.actionItemBulkDeletions.store', fn (string $id) => ['filters' => []]],
    'deletion with ids and count' => ['workspaces.actionItemBulkDeletions.store', fn (string $id) => ['ids' => [$id], 'count' => 1]],
]);
```

Append to `tests/Concurrency/ActionItemBulkTest.php`:

```php
it('starts the same matching items twice at once without a failure', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $ids = ActionItem::factory()->withoutRetro($team, $user)->count(4)->create()->pluck('id')->all();
    $userId = $user->id;
    $uri = route('workspaces.actionItemBulkUpdates.store', $team->workspace, false);
    $payload = ['filters' => ['status' => 'todo'], 'count' => 4, 'changes' => ['status' => 'doing']];

    $outcomes = Race::run([
        static fn (): int => Race::request($userId, 'POST', $uri, $payload),
        static fn (): int => Race::request($userId, 'POST', $uri, $payload),
    ]);

    $statuses = array_column($outcomes, 'value');

    expect($statuses)->toContain(200)
        ->and(array_diff($statuses, [200, 422]))->toBe([])
        ->and(ActionItem::query()->whereKey($ids)->whereNull('started_at')->count())->toBe(0);
});
```

The protection proved: the count check (a request that counts after the other started the items finds none to do and answers 422) and, when both count first, the row lock and the early return of `SetActionItemStatus` on an unchanged status. The change is idempotent on purpose: a repeated "all matching" completion of recurring items would complete their next occurrences (they match the landing filter again, so the count does not move); the bar is disabled while its request runs, and spec §14 names the two-tab case.

- [ ] **Step 2: Run the tests to see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ActionItemBulkMatchingTest.php`
Expected: FAIL — 422 on `ids` (required) for every filters body.

- [ ] **Step 3: Implement**

`app/Actions/ActionItems/ActionItemBulkChanges.php`: add `use Illuminate\Support\Collection;` if needed, and:

```php
    public const MatchingCap = 500;

    public const FilterKeys = ['status', 'priority', 'due', 'source', 'assignee', 'team'];

    /**
     * Spec 24 §5 rule 7: the items the filters match for the viewer now, in the order of the
     * list. Refused above the cap, and when they are not as many as the viewer confirmed, so
     * that nothing is changed on a set the viewer did not see.
     *
     * @param  array<string, mixed>  $query  page parameters among FilterKeys
     * @return array<int, string>
     *
     * @throws ValidationException
     */
    public function matching(User $user, Workspace $workspace, array $query, int $confirmedCount): array
    {
        $filters = ActionItemFilters::fromQuery($query, $workspace->teamsVisibleTo($user));
        $ids = ActionItemQuery::order($this->actionItemQuery->filter($this->actionItemQuery->visibleTo($user, $workspace), $user, $filters))
            ->limit(self::MatchingCap + 1)
            ->pluck('action_items.id')
            ->map(fn (mixed $id): string => (string) $id)
            ->all();

        if (count($ids) > self::MatchingCap) {
            throw ValidationException::withMessages([
                'filters' => __('More than :cap action items match. Narrow the filters.', ['cap' => self::MatchingCap]),
            ]);
        }

        if (count($ids) !== $confirmedCount) {
            throw ValidationException::withMessages([
                'count' => __('The list changed: :count action items match now.', ['count' => count($ids)]),
            ]);
        }

        return $ids;
    }
```

`app/Http/Requests/ActionItems/ActionItemBulkUpdateRequest.php`, `rules()`: the `ids` lines become

```php
            'ids' => ['required_without:count', 'prohibits:count,filters', 'array', 'min:1', 'max:'.ActionItemQuery::PerPage],
            'ids.*' => ['required', 'uuid', 'distinct'],
            'filters' => ['sometimes', 'array:'.implode(',', ActionItemBulkChanges::FilterKeys)],
            'filters.*' => ['nullable', 'string', 'max:500'],
            'count' => ['required_without:ids', 'integer', 'min:1', 'max:'.ActionItemBulkChanges::MatchingCap],
```

(`use App\Actions\ActionItems\ActionItemBulkChanges;`). `ActionItemBulkDeletionRequest::rules()` gets the same five lines.

`WorkspaceActionItemBulkUpdatesController::store()`:

```php
        $user = $request->user();
        $validated = $request->validated();
        $byIds = array_key_exists('ids', $validated);
        $ids = $byIds ? $validated['ids'] : $bulkChanges->matching($user, $workspace, $validated['filters'] ?? [], (int) $validated['count']);
        $result = $bulkChanges->update($user, $workspace, $ids, $validated['changes']);

        return response()->json([
            'actionItems' => $byIds ? $presentActionItem->many($result['changed'], ActionItemActor::forUser($user)) : [],
            'changedCount' => count($result['changed']),
            'refused' => $result['refused'],
        ]);
```

`WorkspaceActionItemBulkDeletionsController::store()`:

```php
        $user = $request->user();
        $validated = $request->validated();
        $ids = array_key_exists('ids', $validated)
            ? $validated['ids']
            : $bulkChanges->matching($user, $workspace, $validated['filters'] ?? [], (int) $validated['count']);
        $result = $bulkChanges->delete($user, $workspace, $ids);

        return response()->json(['deleted' => $result['changed'], 'refused' => $result['refused']]);
```

`lang/*.json`: "More than :cap action items match. Narrow the filters.", "The list changed: :count action items match now." (values in Task 17's table).

- [ ] **Step 4: Run the tests on PostgreSQL, and the race**

Run: `bin/test-db pgsql -- tests/Feature/ActionItems tests/Arch`; then `bin/test-db pgsql --concurrency -- tests/Concurrency/ActionItemBulkTest.php`.
Expected: PASS.

- [ ] **Step 5: Measure the cap (spec §14, §16.4)**

Run: `bin/test-db pgsql -- tests/Feature/ActionItems/ActionItemBulkMatchingTest.php --filter="changes the cap" --profile`. Read the time of the request part of the test (it creates 500 items, completes them in one request with the queue faked, then creates 501 more; wrap the first `postBulkMatching` call in `$started = hrtime(true)` … `dump((hrtime(true) - $started) / 1e9)` for this run only, and remove the two lines before the commit). Write the number in the commit message.

Rule (spec §14, "Request time"; no stop for the owner): if the request takes more than 15 seconds (half of Octane's 30), set `ActionItemBulkChanges::MatchingCap` to the largest multiple of 50 at or below `500 × 15 / seconds`, at least 50, set the front's `MatchingCap` (Task 10, `lib/action-items/selection.ts`) to the same number, change the test's `count(500)`, `'count' => 500`, `changedCount` 500, `count(501)` and the 500 / 501 of the dataset "count above the cap" to the new cap and cap + 1, run this step again at the new cap, and write both numbers in the commit message and in the report (Task 19). A queued bulk change stays in the backlog (spec §3).

- [ ] **Step 6: Commit**

```bash
git add app/Actions/ActionItems/ActionItemBulkChanges.php app/Http/Requests/ActionItems app/Http/Controllers/WorkspaceActionItemBulkUpdatesController.php app/Http/Controllers/WorkspaceActionItemBulkDeletionsController.php tests/Feature/ActionItems/ActionItemBulkMatchingTest.php tests/Concurrency/ActionItemBulkTest.php lang
git commit -m "feat(action-items): bulk changes over every matching item (AI-1)

500-item completion: <n> s on PostgreSQL (cap <500, or the lowered cap and its time>).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 9: CSV export of the list (AI-4)

**Files:**
- Create: `app/Support/CsvCell.php`, `app/Support/CsvDownload.php`, `app/Actions/ActionItems/ExportActionItemsCsv.php`, `app/Http/Controllers/WorkspaceActionItemCsvExportsController.php`, `tests/Feature/ActionItems/ActionItemCsvExportTest.php`
- Modify: `app/Actions/TeamSurveys/ExportSurveyCsv.php` (uses `CsvCell`), `app/Http/Controllers/TeamSurveys/TeamSurveyExportsController.php` (uses `CsvDownload`), `routes/web.php`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: `ActionItemFilters::fromRequest()`, `ActionItemQuery::visibleTo()`, `filter()`, `order()` (Task 5); `ActionItemStatus::label()`, `ActionItem::currentStatus()` (Task 1); `BuildRetroRecap::assignee(ActionItem $item, bool $forMachines = false): ?string` (exists); `ActionItemPriority::label()` (exists).
- Produces: `CsvCell::safe(string $cell): string`; `CsvDownload::stream(iterable $rows, string $fileName): StreamedResponse`; `ExportActionItemsCsv::rows(User, Workspace, ActionItemFilters): Generator<int, array<int, string>>`, `ExportActionItemsCsv::fileName(Workspace): string`; route `workspaces.actionItemCsvExports.show` (`GET workspaces/{workspace}/action-items/export`, the page's query) used by Task 15.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/ActionItems/ActionItemCsvExportTest.php`:

```php
<?php

use App\Enums\ActionItemPriority;
use App\Enums\IntegrationProvider;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-10 12:00:00'));
});

/**
 * @return array<int, array<int, string>>
 */
function actionItemCsvRows(TestResponse $response): array
{
    $body = ltrim($response->streamedContent(), "\u{FEFF}");

    return array_map(fn (string $line): array => str_getcsv($line, ',', '"', ''), explode("\n", trim($body)));
}

it('exports every matching item of every page, in the order of the list, with its columns', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $user = teamMember($team);
    $retro = Retro::factory()->create(['team_id' => $team->id, 'title' => 'Sprint 42']);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Carol']);
    $late = ActionItem::factory()->assignedToGuest($guest)->create([
        'content' => 'Fix the flaky test',
        'priority' => ActionItemPriority::High,
        'due_on' => '2026-10-08',
        'created_at' => '2026-10-01 09:00:00',
    ]);
    ActionItemExternalLink::factory()->create(['action_item_id' => $late->id, 'source' => IntegrationProvider::Jira, 'external_key' => 'PROJ-12']);
    ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->started()->create([
        'content' => 'Write the runbook',
        'created_at' => '2026-10-02 09:00:00',
    ]);
    ActionItem::factory()->withoutRetro($team, $user)->count(55)->create();

    $response = $this->actingAs($user)
        ->get(route('workspaces.actionItemCsvExports.show', ['workspace' => $team->workspace]))
        ->assertOk()
        ->assertHeader('Content-Type', 'text/csv; charset=UTF-8')
        ->assertDownload("action-items-{$team->workspace->slug}-2026-10-10.csv");

    $rows = actionItemCsvRows($response);

    expect($rows[0])->toBe(['Action', 'Status', 'Team', 'Assignee', 'Priority', 'Due date', 'Source', 'Created', 'Completed', 'Tickets', 'Link'])
        ->and($rows)->toHaveCount(58)
        ->and(array_slice($rows[1], 0, 10))->toBe(['Fix the flaky test', 'To do', 'Platform', 'Carol (guest)', 'High', '2026-10-08', 'Sprint 42', '2026-10-01', '', 'PROJ-12'])
        ->and($rows[1][10])->toBe(route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'item' => $late->id]))
        ->and(collect($rows)->firstWhere(0, 'Write the runbook'))->toMatchArray([1 => 'In progress', 3 => $user->name, 6 => 'Added outside a retro']);
});

it('follows the filters of the page and the viewer\'s visibility', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'open one']);
    ActionItem::factory()->withoutRetro($team, $user)->completed()->create(['content' => 'done one']);
    ActionItem::factory()->withoutRetro(Team::factory()->create(['workspace_id' => $team->workspace_id]), User::factory()->create())->create(['content' => 'hidden']);

    $contents = fn (array $query) => collect(actionItemCsvRows($this->actingAs($user)->get(route('workspaces.actionItemCsvExports.show', ['workspace' => $team->workspace, ...$query]))))->skip(1)->pluck(0)->sort()->values()->all();

    expect($contents([]))->toBe(['open one'])
        ->and($contents(['status' => 'completed']))->toBe(['done one'])
        ->and($contents(['status' => 'all']))->toBe(['done one', 'open one']);
});

it('neutralises formulas', function (string $text) {
    $team = Team::factory()->create(['name' => '=cmd|calc']);
    $user = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => $text]);

    $row = actionItemCsvRows($this->actingAs($user)->get(route('workspaces.actionItemCsvExports.show', ['workspace' => $team->workspace])))[1];

    expect($row[0])->toBe("'{$text}")->and($row[2])->toBe("'=cmd|calc");
})->with(['=HYPERLINK("http://x")', '+1', '-1', '@SUM(A1)']);

it('writes the header in the viewer\'s language', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $user->update(['locale' => 'fr']);
    ActionItem::factory()->withoutRetro($team, $user)->started()->create();

    $rows = actionItemCsvRows($this->actingAs($user)->get(route('workspaces.actionItemCsvExports.show', ['workspace' => $team->workspace])));

    expect($rows[0][1])->toBe('Statut')->and($rows[1][1])->toBe('En cours');
});

it('keeps people outside the workspace out', function () {
    $team = Team::factory()->create();

    $this->actingAs(User::factory()->create())->get(route('workspaces.actionItemCsvExports.show', ['workspace' => $team->workspace]))->assertForbidden();
});
```

Before writing, check that `ActionItemExternalLink` has a factory (`database/factories/ActionItemExternalLinkFactory.php`); if not, create the link with `$late->externalLinks()->create([...])` using the fillable columns of the model (`source`, `external_site`, `external_id`, `external_key`, `external_url`). Check the French values of "Status" and "In progress" in `lang/fr.json` ("Statut", "En cours").

- [ ] **Step 2: Run the tests to see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ActionItemCsvExportTest.php`
Expected: FAIL — route not defined.

- [ ] **Step 3: Implement**

`app/Support/CsvCell.php`:

```php
<?php

namespace App\Support;

class CsvCell
{
    private const string FormulaLeads = "=+-@\t\r";

    /**
     * A leading =, +, -, @, tab or carriage return makes a spreadsheet run the cell as a
     * formula; an apostrophe makes it text.
     */
    public static function safe(string $cell): string
    {
        if ($cell === '' || ! str_contains(self::FormulaLeads, $cell[0])) {
            return $cell;
        }

        return "'".$cell;
    }
}
```

`app/Support/CsvDownload.php`:

```php
<?php

namespace App\Support;

use Symfony\Component\HttpFoundation\StreamedResponse;

class CsvDownload
{
    /**
     * UTF-8 with a byte-order mark, so that spreadsheets read accents; cells are written as
     * given (make them safe with CsvCell first).
     *
     * @param  iterable<int, array<int, string>>  $rows
     */
    public static function stream(iterable $rows, string $fileName): StreamedResponse
    {
        return response()->streamDownload(function () use ($rows): void {
            $output = fopen('php://output', 'w');

            if ($output === false) {
                return;
            }

            fwrite($output, "\u{FEFF}");

            foreach ($rows as $row) {
                fputcsv($output, $row, ',', '"', '');
            }

            fclose($output);
        }, $fileName, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
```

`app/Actions/TeamSurveys/ExportSurveyCsv.php`: delete the constant `FormulaLeads` and the private `safe()`; call `CsvCell::safe(...)` where `$this->safe(...)` was called (`use App\Support\CsvCell;`). `TeamSurveyExportsController::show`: replace the `response()->streamDownload(…)` block with `return CsvDownload::stream($rows, $exportSurveyCsv->fileName($teamSurvey));`.

`app/Actions/ActionItems/ExportActionItemsCsv.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Actions\Integrations\BuildRetroRecap;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\User;
use App\Models\Workspace;
use App\Support\CsvCell;
use Generator;
use Illuminate\Support\Str;

class ExportActionItemsCsv
{
    private const int ChunkSize = 200;

    public function __construct(
        private ActionItemQuery $actionItemQuery,
        private BuildRetroRecap $buildRetroRecap,
    ) {}

    /**
     * Spec 24 §6.6: the header, then every item the viewer sees under the filters, in the
     * order of the page, read in chunks.
     *
     * @return Generator<int, array<int, string>>
     */
    public function rows(User $user, Workspace $workspace, ActionItemFilters $filters): Generator
    {
        yield $this->header();

        $query = ActionItemQuery::order($this->actionItemQuery->filter($this->actionItemQuery->visibleTo($user, $workspace), $user, $filters))
            ->with(['team', 'retro', 'assigneeUser', 'assigneeParticipant', 'externalLinks']);

        foreach ($query->lazy(self::ChunkSize) as $item) {
            yield array_map(CsvCell::safe(...), $this->cells($item, $workspace));
        }
    }

    public function fileName(Workspace $workspace): string
    {
        $slug = Str::slug($workspace->slug) ?: 'workspace';

        return "action-items-{$slug}-".now()->format('Y-m-d').'.csv';
    }

    /**
     * @return array<int, string>
     */
    private function header(): array
    {
        return [
            __('Action'), __('Status'), __('Team'), __('Assignee'), __('Priority'), __('Due date'),
            __('Source'), __('Created'), __('Completed'), __('Tickets'), __('Link'),
        ];
    }

    /**
     * @return array<int, string>
     */
    private function cells(ActionItem $item, Workspace $workspace): array
    {
        return [
            $item->content,
            $item->currentStatus()->label(),
            $item->team->name,
            (string) $this->buildRetroRecap->assignee($item),
            $item->priority->label(),
            (string) $item->due_on?->toDateString(),
            $item->retro === null ? __('Added outside a retro') : $item->retro->title,
            (string) $item->created_at?->toDateString(),
            (string) $item->completed_at?->toDateString(),
            $item->externalLinks
                ->sortBy(fn (ActionItemExternalLink $link): string => $link->source->value)
                ->pluck('external_key')
                ->implode(' | '),
            route('workspaces.actionItems.index', ['workspace' => $workspace, 'item' => $item->id]),
        ];
    }
}
```

`app/Http/Controllers/WorkspaceActionItemCsvExportsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\ActionItems\ActionItemFilters;
use App\Actions\ActionItems\ExportActionItemsCsv;
use App\Models\Workspace;
use App\Support\CsvDownload;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class WorkspaceActionItemCsvExportsController extends Controller
{
    public function show(Request $request, Workspace $workspace, ExportActionItemsCsv $exportActionItemsCsv): StreamedResponse
    {
        $user = $request->user();
        $filters = ActionItemFilters::fromRequest($request, $workspace->teamsVisibleTo($user));

        return CsvDownload::stream($exportActionItemsCsv->rows($user, $workspace, $filters), $exportActionItemsCsv->fileName($workspace));
    }
}
```

`routes/web.php`, before `Route::get('action-items/{actionItem}/comments', …)`:

```php
            Route::get('action-items/export', [WorkspaceActionItemCsvExportsController::class, 'show'])->name('workspaces.actionItemCsvExports.show');
```

`lang/*.json`: "Tickets" (new). The other header keys exist ("Action", "Status", "Team", "Assignee", "Priority", "Due date", "Source", "Created", "Completed", "Link"); check each in the four files and add what is missing.

- [ ] **Step 4: Run the tests on PostgreSQL**

Run: `bin/test-db pgsql -- tests/Feature/ActionItems/ActionItemCsvExportTest.php tests/Feature/TeamSurveys/TeamSurveyExportTest.php tests/Arch`.
Expected: PASS (the survey export tests unchanged).

- [ ] **Step 5: Commit**

```bash
git add app/Support/CsvCell.php app/Support/CsvDownload.php app/Actions/ActionItems/ExportActionItemsCsv.php app/Http/Controllers/WorkspaceActionItemCsvExportsController.php app/Actions/TeamSurveys/ExportSurveyCsv.php app/Http/Controllers/TeamSurveys/TeamSurveyExportsController.php routes/web.php tests/Feature/ActionItems/ActionItemCsvExportTest.php lang
git commit -m "feat(action-items): CSV export of the filtered list (AI-4)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

---

## Step B — front foundation (single writer)

### Task 10: Types, filters, selection, bulk client, status comparisons

**Files:**
- Create: `resources/js/lib/action-items/selection.ts`, `selection.test.ts`, `bulk.ts`, `bulk.test.ts`, `status.ts`, `status.test.ts`
- Modify: `resources/js/lib/retro/types.ts`, `components/action-items/use-action-item-filters.ts` and its test, `components/action-items/action-item-filters-drawer.tsx` (chips only), `components/action-items/action-items-page.tsx` (the empty-state condition only), `components/action-items/{action-item-sheet,action-items-list}.tsx`, `components/retro/{action-item-rows,board-dialogs,carried-items-sheet}.tsx`, `lib/action-items/endpoints.ts`

**Interfaces:**
- Consumes: the `filters` prop of Task 5; routes of Tasks 6, 7, 9 through Wayfinder (`npm run build:front` first).
- Produces:
  - `lib/retro/types.ts`: `ActionItemStatus = 'open' | 'doing' | 'completed'`; `ActionItem.startedAt: string | null`.
  - `use-action-item-filters.ts`: `StatusToken = 'todo' | 'doing' | 'completed'`, `DueBucket = 'overdue' | 'today' | 'week' | 'later' | 'none'`, `SourceFilter = 'retro' | 'outside'`, `ActionItemFilters = { status: StatusToken[]; priority: ActionItemPriority[]; due: DueBucket | null; source: SourceFilter | null; assignee: string | null; team: string | null; item: string | null }`, `DefaultStatuses`, `filterQuery()`, `activeFilterCount()`, `isDefaultStatus(statuses)`; `useActionItemFilters()` keeps its return shape.
  - `lib/action-items/status.ts`: `isOpenStatus(status: ActionItemStatus): boolean` (`open` or `doing`).
  - `lib/action-items/selection.ts`: `toggleSelected`, `setSelected`, `keepListed`, `headState`, and for "all matching" (decision 6) `MatchingCap` (500), `matchingOffer(selection, selectableIds, total): 'offer' | 'too-many' | null`, `leaveMatching(selectableIds, id): Set<string>` (below).
  - `lib/action-items/bulk.ts`: `BulkTarget = { ids: string[] } | { filters: Record<string, string>; count: number }`, `matchingTarget(filters, count): BulkTarget`, `bulkUpdate(workspace, target, changes): Promise<BulkUpdateResult>`, `bulkDelete(workspace, target): Promise<BulkDeleteResult>`, `actionItemsExportUrl(workspace, filters): string`, types `BulkChanges`, `BulkRefusal` (`{ id, title: string | null, message }`), `BulkUpdateResult` (`{ actionItems, changedCount, refused }`).

- [ ] **Step 1: Write the failing tests**

`resources/js/lib/action-items/selection.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
    headState,
    keepListed,
    leaveMatching,
    MatchingCap,
    matchingOffer,
    setSelected,
    toggleSelected,
} from '@/lib/action-items/selection';

describe('selection', () => {
    it('toggles one id', () => {
        const once = toggleSelected(new Set(), 'a');

        expect([...once]).toEqual(['a']);
        expect([...toggleSelected(once, 'a')]).toEqual([]);
    });

    it('selects and clears several ids', () => {
        const all = setSelected(new Set(['a']), ['b', 'c'], true);

        expect([...all].sort()).toEqual(['a', 'b', 'c']);
        expect([...setSelected(all, ['a', 'b'], false)]).toEqual(['c']);
    });

    it('drops the ids that left the list and keeps the same set otherwise', () => {
        const selection = new Set(['a', 'b']);

        expect([...keepListed(selection, ['b', 'c'])]).toEqual(['b']);
        expect(keepListed(selection, ['a', 'b', 'c'])).toBe(selection);
    });

    it('reads the header box', () => {
        expect(headState(new Set(), ['a', 'b'])).toBe(false);
        expect(headState(new Set(['a']), ['a', 'b'])).toBe('indeterminate');
        expect(headState(new Set(['a', 'b']), ['a', 'b'])).toBe(true);
        expect(headState(new Set(['a']), [])).toBe(false);
    });

    it('offers every matching item once the whole page is selected and more items match', () => {
        expect(matchingOffer(new Set(['a', 'b']), ['a', 'b'], 137)).toBe('offer');
        expect(matchingOffer(new Set(['a']), ['a', 'b'], 137)).toBeNull();
        expect(matchingOffer(new Set(['a', 'b']), ['a', 'b'], 2)).toBeNull();
        expect(matchingOffer(new Set(['a', 'b']), ['a', 'b'], MatchingCap + 1)).toBe('too-many');
    });

    it('leaves "all matching" for the page without the unticked row', () => {
        expect([...leaveMatching(['a', 'b', 'c'], 'b')]).toEqual(['a', 'c']);
    });
});
```

`resources/js/lib/action-items/status.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isOpenStatus } from '@/lib/action-items/status';

describe('isOpenStatus', () => {
    it('counts to do and in progress as open', () => {
        expect(isOpenStatus('open')).toBe(true);
        expect(isOpenStatus('doing')).toBe(true);
        expect(isOpenStatus('completed')).toBe(false);
    });
});
```

`resources/js/lib/action-items/bulk.test.ts` (mock `retroRequest` as `use-action-item-mutations.test.tsx` does; read it first):

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    actionItemsExportUrl,
    bulkDelete,
    bulkUpdate,
    matchingTarget,
} from '@/lib/action-items/bulk';
import { retroRequest } from '@/lib/retro/api';

vi.mock('@/lib/retro/api', () => ({ retroRequest: vi.fn() }));

describe('bulk client', () => {
    beforeEach(() => vi.mocked(retroRequest).mockReset());

    it('posts the ids and the changes, with a long timeout', async () => {
        vi.mocked(retroRequest).mockResolvedValue({ actionItems: [], changedCount: 0, refused: [] });

        await bulkUpdate('acme', { ids: ['a', 'b'] }, { status: 'doing' });

        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'post', url: '/workspaces/acme/action-items/bulk-updates' }),
            { ids: ['a', 'b'], changes: { status: 'doing' } },
            { timeoutMs: 60_000 },
        );
    });

    it('posts the filters and the count of every matching item', async () => {
        vi.mocked(retroRequest).mockResolvedValue({ actionItems: [], changedCount: 137, refused: [] });

        const target = matchingTarget(
            { status: ['todo', 'doing'], priority: ['low'], due: null, source: null, assignee: null, team: 't1', item: 'x' },
            137,
        );
        await bulkUpdate('acme', target, { priority: 'high' });

        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'post' }),
            { filters: { priority: 'low', team: 't1' }, count: 137, changes: { priority: 'high' } },
            { timeoutMs: 60_000 },
        );
    });

    it('posts the ids to delete', async () => {
        vi.mocked(retroRequest).mockResolvedValue({ deleted: ['a'], refused: [] });

        expect(await bulkDelete('acme', { ids: ['a'] })).toEqual({ deleted: ['a'], refused: [] });
    });

    it('builds the export link from the filters, without the item', () => {
        expect(
            actionItemsExportUrl('acme', {
                status: ['completed'],
                priority: ['high'],
                due: 'week',
                source: null,
                assignee: 'me',
                team: 't1',
                item: 'x',
            }),
        ).toBe('/workspaces/acme/action-items/export?status=completed&priority=high&due=week&assignee=me&team=t1');
    });
});
```

The URL prefix `/workspaces/acme` is an assumption: read the route list (`php artisan route:list --name=actionItems`) and write the URLs Wayfinder produces.

In `use-action-item-filters.test.ts`, add cases (keep the existing ones, change their fixtures from `status: 'open'` to `status: ['todo', 'doing']`, and list each changed fixture in the commit message):

```ts
it('writes the default statuses as no query, and lists otherwise', () => {
    expect(filterQuery({ status: ['todo', 'doing'], priority: [], due: null, source: null, assignee: null, team: null })).toEqual({});
    expect(
        filterQuery({ status: ['todo', 'doing', 'completed'], priority: ['high', 'low'], due: 'overdue', source: 'outside', assignee: null, team: null }),
    ).toEqual({ status: 'todo,doing,completed', priority: 'high,low', due: 'overdue', source: 'outside' });
});

it('counts every narrowing facet', () => {
    expect(
        activeFilterCount({ status: ['todo', 'doing'], priority: ['high'], due: 'today', source: 'retro', assignee: null, team: null, item: null }),
    ).toBe(3);
});

it('sends a stored entry of before unchanged, for the server to read', () => {
    expect(landingQuery({ status: 'overdue' }, null, [])).toEqual({ status: 'overdue' });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm run test -- resources/js/lib/action-items resources/js/components/action-items/use-action-item-filters`
Expected: FAIL — modules not found; `filterQuery` writes `status=todo,doing`.

- [ ] **Step 3: Implement**

`resources/js/lib/action-items/selection.ts`:

```ts
/** The ids of the selected rows; a new set on every change, so React sees it. */
export type Selection = ReadonlySet<string>;

export function toggleSelected(selection: Selection, id: string): Set<string> {
    const next = new Set(selection);

    if (next.has(id)) {
        next.delete(id);

        return next;
    }

    next.add(id);

    return next;
}

export function setSelected(
    selection: Selection,
    ids: string[],
    selected: boolean,
): Set<string> {
    const next = new Set(selection);

    for (const id of ids) {
        if (selected) {
            next.add(id);
        } else {
            next.delete(id);
        }
    }

    return next;
}

/** A row that left the list leaves the selection; nothing changes otherwise. */
export function keepListed<T extends Selection>(
    selection: T,
    listedIds: string[],
): T | Set<string> {
    const listed = new Set(listedIds);

    if ([...selection].every((id) => listed.has(id))) {
        return selection;
    }

    return new Set([...selection].filter((id) => listed.has(id)));
}

/** The header box: none, some (`indeterminate`) or all of the selectable rows. */
export function headState(
    selection: Selection,
    selectableIds: string[],
): boolean | 'indeterminate' {
    const selected = selectableIds.filter((id) => selection.has(id)).length;

    if (selected === 0) {
        return false;
    }

    return selected === selectableIds.length ? true : 'indeterminate';
}

/** Spec 24 §5 rule 7: the server refuses more matching items than this. */
export const MatchingCap = 500;

/**
 * "Select all :count matching" once every selectable row of the page is selected and the
 * list has more items than the page; disabled above the cap.
 */
export function matchingOffer(
    selection: Selection,
    selectableIds: string[],
    total: number,
): 'offer' | 'too-many' | null {
    const wholePage =
        selectableIds.length > 0 &&
        selectableIds.every((id) => selection.has(id));

    if (!wholePage || total <= selectableIds.length) {
        return null;
    }

    return total > MatchingCap ? 'too-many' : 'offer';
}

/** Unticking a row in "all matching" mode keeps the page's other selectable rows. */
export function leaveMatching(selectableIds: string[], id: string): Set<string> {
    return new Set(selectableIds.filter((selectable) => selectable !== id));
}
```

`resources/js/lib/action-items/status.ts`:

```ts
import type { ActionItemStatus } from '@/lib/retro/types';

/** To do and in progress are what is left to do. */
export function isOpenStatus(status: ActionItemStatus): boolean {
    return status !== 'completed';
}
```

`resources/js/lib/action-items/bulk.ts`:

```ts
import WorkspaceActionItemBulkDeletionsController from '@/actions/App/Http/Controllers/WorkspaceActionItemBulkDeletionsController';
import WorkspaceActionItemBulkUpdatesController from '@/actions/App/Http/Controllers/WorkspaceActionItemBulkUpdatesController';
import WorkspaceActionItemCsvExportsController from '@/actions/App/Http/Controllers/WorkspaceActionItemCsvExportsController';
import { filterQuery } from '@/components/action-items/use-action-item-filters';
import type { ActionItemFilters } from '@/components/action-items/use-action-item-filters';
import { retroRequest } from '@/lib/retro/api';
import type {
    ActionItem,
    ActionItemPriority,
    ActionItemStatus,
} from '@/lib/retro/types';

/** Up to 500 items, each in its own transaction, take longer than one change. */
const BulkTimeoutMs = 60_000;

/** Rows of the page by id, or every item matching the filters, counted (spec 24 §6.5). */
export type BulkTarget =
    | { ids: string[] }
    | { filters: Record<string, string>; count: number };

export type BulkChanges = Partial<{
    status: ActionItemStatus;
    priority: ActionItemPriority;
    due_on: string | null;
    assignee_user_id: string | null;
}>;

/** `title` is null for an item that is gone or that the viewer cannot see. */
export type BulkRefusal = { id: string; title: string | null; message: string };

/** `actionItems` is empty for a filters target: the page reloads instead. */
export type BulkUpdateResult = {
    actionItems: ActionItem[];
    changedCount: number;
    refused: BulkRefusal[];
};

export type BulkDeleteResult = { deleted: string[]; refused: BulkRefusal[] };

/**
 * The page's filters as its query writes them and the count it showed; `filterQuery` never
 * writes `item` (the export link's test proves it), and the default filters are `{}`.
 */
export function matchingTarget(
    filters: ActionItemFilters,
    count: number,
): BulkTarget {
    return { filters: filterQuery(filters), count };
}

export function bulkUpdate(
    workspace: string,
    target: BulkTarget,
    changes: BulkChanges,
): Promise<BulkUpdateResult> {
    return retroRequest<BulkUpdateResult>(
        WorkspaceActionItemBulkUpdatesController.store(workspace),
        { ...target, changes },
        { timeoutMs: BulkTimeoutMs },
    );
}

export function bulkDelete(
    workspace: string,
    target: BulkTarget,
): Promise<BulkDeleteResult> {
    return retroRequest<BulkDeleteResult>(
        WorkspaceActionItemBulkDeletionsController.store(workspace),
        { ...target },
        { timeoutMs: BulkTimeoutMs },
    );
}

/** The list as filtered, every page: `item` and `page` are not part of an export. */
export function actionItemsExportUrl(
    workspace: string,
    filters: ActionItemFilters,
): string {
    return WorkspaceActionItemCsvExportsController.show.url(workspace, {
        query: filterQuery(filters),
    });
}
```

If `filterQuery` omits the default statuses, the export follows the server's default, which is the same; keep it.

`use-action-item-filters.ts`: replace `StatusFilter` and `ActionItemFilters` by the types of **Interfaces**; `export const DefaultStatuses: StatusToken[] = ['todo', 'doing'];` `export function isDefaultStatus(statuses: StatusToken[]): boolean` (same members as the default, order-free); `filterQuery()` writes `status` only when not default (joined with `,` in the canonical order `todo, doing, completed`), `priority` when not empty (order `high, medium, low`), `due`, `source`, `assignee`, `team`; `activeFilterCount()` counts team, assignee, a non-default status, a non-empty priority, due, source; `isDefault` adds `filters.priority.length === 0 && filters.due === null && filters.source === null` and uses `isDefaultStatus`. `landingQuery()` is unchanged: a stored entry of before is sent as it is and the server maps it (spec §6.3); the page then stores the canonical form at the next change.

`action-item-filters-drawer.tsx` (chips only): "Overdue" is pressed when `filters.due === 'overdue'` and toggles `{ due: overdue ? null : 'overdue' }`; "To do" is pressed when `isDefaultStatus(filters.status) && filters.due !== 'overdue'` and applies `{ status: DefaultStatuses, due: null }`; "Done" is pressed when the status is exactly `['completed']` and applies `{ status: ['completed'] }`. The overdue shortcut of `action-item-filters.tsx` moves to `due` in Task 12; until then, change its two lines the same way so the page works at the head of this task.

`action-items-page.tsx`: `nothingOpen` becomes `isDefaultStatus(filters.status) && filters.due === null && filters.priority.length === 0 && filters.source === null && filters.assignee === null`.

Status comparisons found by `grep -rnE "status (===|!==) '(open|completed)'" resources/js` (re-run it; the list at drafting time):
- `components/retro/board-dialogs.tsx:136` and `components/retro/carried-items-sheet.tsx:180`: `item.status === 'open'` → `isOpenStatus(item.status)`.
- `components/action-items/action-item-sheet.tsx:80`, `action-items-list.tsx:108`, `components/retro/action-item-rows.tsx:115`: the mapping `status === 'completed' ? 'completed' : 'open'` passes the status through unchanged (`'doing'` reaches the component).
- `lib/action-items/order.ts`, `lib/action-items/due.ts`, `action-items-table.tsx:240,256`: compare with `'completed'` and stay right.

`lib/retro/types.ts`: `export type ActionItemStatus = 'open' | 'doing' | 'completed';` and `startedAt: string | null;` after `completedAt`. Fix every fixture that builds an `ActionItem` in Vitest (`npm run types:check` names them) by adding `startedAt: null`.

- [ ] **Step 4: Run the tests and the gates**

Run: `npm run test -- resources/js/lib/action-items resources/js/components/action-items resources/js/components/retro`, then `npm run types:check`, `npm run check`, `npm run build:front`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add resources/js
git commit -m "feat(action-items): front foundation for bulk changes, filters and In progress

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

---

## Step C — screens (lanes)

Every screen task: read ScreenActions (README and preview) and ActionItem first; write the Vitest tests first (render with the props, assert roles, names, states; mock `retroRequest` and `router`); implement; run `npm run test -- <files>`, `npm run types:check`, `npm run check`, `npm run build:front`; commit. No capture here (Task 16). New strings go to the four `lang/*.json` files (values in Task 17).

### Task 11 (lane Status): "In progress" everywhere an item's status shows

**Files:** modify `components/action-items/action-items-table.tsx` (status cell), `action-items-list.tsx`, `action-item-sheet.tsx`, `components/retro/action-item-rows.tsx`, `components/retro/carried-items-sheet.tsx` (props only); their tests.

**Interfaces:** consumes `nextActionStatus(status, withDoing)`, `ActionStatusBadge` and the `withDoing` prop of `components/skrum/action-item.tsx` and `action-sheet.tsx` (they exist; do not change them — if a prop is missing, stop and ask).

**Composition and behaviours:**
- Pass `withDoing` to every `ActionItem` and `ActionSheet` the application renders: the page list, the sheet, the board's action rows, the carried-items panel.
- Table status cell: `ActionStatusBadge` with the three tones (outline, info, success); the badge stays the status button (PB-05): its accessible name is "Mark as in progress" on To do, "Mark as done" on In progress, "Reopen" on Done; a click calls `context.onStatusChange(item, nextActionStatus(item.status, true))`; disabled without the right to complete, as today.
- Sheet: the Status select lists To do, In progress, Done; the footer keeps one-click "Mark as done" (on To do and In progress) and "Reopen" (on Done). Under the status, "Started :date" when `startedAt` is set and the item is not done (`formatActionDay` for the date).
- Board and carried panel: their open counts use `isOpenStatus` (Task 10).

**Vitest (written first):** the table badge reads and names each of the three statuses and sends the next one; the sheet select sends `doing`; the sheet footer completes a started item in one click; "Started …" shows for a started item and not for a done one; the board row cycles To do → In progress → Done → To do; the carried-items count includes a started item.

**Commit:** `feat(action-items): In progress on the page, the sheet and the board`

### Task 12 (lane Filters): Status, Priority, Due date and Source facets

**Files:** create `components/action-items/action-item-facets.tsx` and its test; modify `action-item-filters.tsx` (Status facet, overdue shortcut, `extraFacets` filled by the page), `action-item-filters-drawer.tsx` (the stacked facets), `action-items-page.tsx` (the `extraFacets` line), `action-item-filters.test.tsx`.

**Interfaces:** consumes `ActionItemFilters`, `DefaultStatuses`, `isDefaultStatus`, `activeFilterCount` (Task 10); `ActionPriorityMark` (exists); `Popover`, `Command` (`CommandList`, `CommandItem`), `Checkbox`.
Produces: `MultiFacet<T extends string>({ label, icon, options: { value: T; label: string; mark?: ReactNode }[], value: T[], allValue: T[], onChange, stacked })` and `SingleFacet` (the current `Facet`, renamed and kept for Team, Assignee, Due date, Source) in `action-item-facets.tsx`; `ActionItemExtraFacets({ filters, onChange, stacked })` rendering Priority, Due date and Source in that order.

**Composition and behaviours (spec §9.2):**
- Status: `MultiFacet` with To do (`todo`), In progress (`doing`), Done (`completed`); trigger "Status" plus, when fewer than three are ticked, the one label or ":count of :total"; active style whenever fewer than three are ticked; unticking the last ticked box does nothing; the facet keeps `aria-label="Status"` on its trigger.
- Priority: `MultiFacet` High, Medium, Low, each with `ActionPriorityMark`; none ticked means every priority (sends nothing); three ticked is sent as none.
- Due date: `SingleFacet` Any, Overdue, Today, Next 7 days, Later, No due date; values `null`, `overdue`, `today`, `week`, `later`, `none`; a cross clears it.
- Source: `SingleFacet` Any, From a retro (`retro`), Added outside a retro (`outside`); a cross clears it.
- "Overdue" shortcut: pressed while `due === 'overdue'`; toggles `due` between `overdue` and `null`; its badge is `counts.overdue`.
- Order: Team, Status, Assignee, Priority, Due date, Source, separator, Overdue, Reset (mockup).
- Phone drawer: the same facets, stacked, 44 px rows; the "Filters · n" button counts `activeFilterCount`.
- Every facet change goes through `filtering.apply(changes)`; "Reset" as today.

**Vitest (written first):** each facet renders its options and sends its change (`onChange` called with `{ priority: ['high', 'low'] }`, `{ due: 'week' }`, `{ source: 'outside' }`, `{ status: ['todo'] }`); the Status trigger reads "2 of 3" for the default and is plain for the three; unticking the last status does not call `onChange`; the overdue shortcut is pressed with `due: 'overdue'` and clears it; the drawer lists the six facets; `Reset` shows when Priority is set.

**Commit:** `feat(action-items): status, priority, due date and source facets`

### Task 13 (lane Bulk): Selection on the table, and the bulk bar

**Files:** create `components/action-items/use-action-item-selection.ts`, `action-item-select-cell.tsx`, `action-items-bulk-bar.tsx`, `bulk-assign-menu.tsx`, `bulk-result-toast.tsx`, `bulk-delete-confirm.tsx`, `bulk-matching-confirm.tsx` and their tests; modify `action-items-page.tsx` (`selectionCell`, `selectionHead`, `bulkBar`, Escape, the reload after an "all matching" request), `action-items-table.tsx` (group rows get a box: a `selectionGroup?: (group) => ReactNode` prop in the group header row).

**Interfaces:**
- Consumes: `selection.ts` (with `matchingOffer`, `leaveMatching`, `MatchingCap`), `bulk.ts` (`BulkTarget`, `matchingTarget`), `isOpenStatus` (Task 10); the page's `items.total` and `filters`; `RetroRequestError` (`lib/retro/api.ts`: `status` and `errors`, for the 422 on `count`); `router.reload({ only: ['items', 'counts'] })`; `canManageActionItem`, `canCompleteActionItem` (read `lib/action-items/permissions.ts` for the exact names); `useActionItemsRealtime`'s `saveRow` and `removeRow`; `ItemDeleteConfirm` as the model for the confirmation; `Calendar` in a `Popover` for the due date.
- Produces: `useActionItemSelection({ rows, viewer, total }): { selected: Set<string>; matching: { count: number } | null; selectable(item): boolean; toggle(id); setMany(ids, on); selectMatching(); clear(); head(ids): boolean | 'indeterminate'; offer: 'offer' | 'too-many' | null; target(filters): BulkTarget }` (the hook takes a `filtersKey: string` and a `pageKey: string`: a change of `filtersKey` clears everything; a change of `pageKey` — page or grouping — clears the rows and keeps `matching`); `ActionItemsBulkBar({ workspace, items, selection, filters, teams, sourcesOf, onDone, onClear, layout: 'floating' | 'docked' })`; `BulkMatchingConfirm({ count, changedSentence, onApply, onCancel })`.

**Composition and behaviours (spec §9.3, §9.4):**
- Row box (`action-item-select-cell.tsx`): `Checkbox` named "Select :title"; disabled with a tooltip "You cannot change this action item" when `selectable(item)` is false (the viewer may neither complete nor manage it). A selected row gets `data-selected` and the selected background.
- Header box: `head(selectableIds)`; ticking selects the page's selectable rows, unticking clears; name "Select all on this page" / "Clear selection". A group row box selects its group's selectable rows.
- `keepListed` runs when `rows` change (a row that left the list leaves the selection).
- **All matching** (spec §9.3, decision 6): when `offer` is `'offer'`, the bar shows a link button "Select all :count matching" (`:count` = `items.total`) after "n selected"; pressing it calls `selectMatching()`: the bar reads "All :count matching selected", every row box reads ticked (the header box too), group boxes too. When `offer` is `'too-many'` the button is disabled with the tooltip "Up to :cap at once. Narrow the filters." (`:cap` = `MatchingCap`). Unticking a row in that mode calls `leaveMatching(selectableIds, id)`; ticking the header box off clears everything.
- Bar (`action-items-bulk-bar.tsx`), mockup order: "**n** selected" (polite live region), separator, Status ▾ (To do, In progress, Done), Assign ▾ (`bulk-assign-menu.tsx`: "Unassigned" then the members common to every team of the selection, with avatars; a search field from eight people), Due date ▾ (calendar and "No due date"), Priority ▾ (High, Medium, Low with marks), "Sync to :tracker" (Task 14), Delete (destructive ghost), separator, ✕ "Clear selection". `role="toolbar"`, name "Bulk actions", fixed at the bottom centre of the content, `z-chrome`, `shadow-modal`, enter/leave motion off with reduced motion.
- Enabled actions: Status when one selected row of the page may be completed by the viewer; Assign, Due date, Priority and Delete when one may be managed; otherwise disabled with a tooltip. In "all matching" mode the same reading over the page's rows (the server checks each item); Assign lists the members common to the filter's team, else to every team of `filterTeams` (spec §7).
- A change on rows: buttons disabled, spinner on the pressed one; `bulkUpdate(workspace, { ids }, changes)`; each returned item through `saveRow`; then `bulk-result-toast.tsx`: "n action items updated." (one: "1 action item updated.") when nothing was refused, else "n updated, m not changed." (`changedCount`, `refused.length`) with a "Details" action opening a dialog listing each refused item's title — or its sentence alone when `title` is null — and message. Full success clears the selection; a partial one removes the changed ids from it.
- A change in "all matching" mode: `bulk-matching-confirm.tsx` (`role="alertdialog"`) first: "Apply to :count action items?" / "Every action item matching the filters is changed: :count in all." / "Apply" / "Cancel"; on "Apply", `bulkUpdate(workspace, matchingTarget(filters, count), changes)`. A 422 whose `errors.count` is set keeps the dialog open with that sentence ("The list changed: :count action items match now."), reloads `items` and `counts`, and "Apply" then sends the new `items.total`; a 422 on `filters` (above the cap) closes the dialog with the error toast. On success: the toast as above, the selection cleared, `router.reload({ only: ['items', 'counts'] })`.
- Delete: `bulk-delete-confirm.tsx` (`role="alertdialog"`) "Delete n action items?" / "This cannot be undone. Their comments and sub-tasks are deleted too." / "Delete" / "Cancel" (`n` = the count in "all matching" mode, with the same changed-count handling); then `bulkDelete(...)` with the rows' ids or the matching target, `removeRow` for each deleted id (and the reload in "all matching" mode), the toast.
- A request that fails as a whole (network, 503, 422) shows the existing error toast of `useActionItemMutations.run` and resyncs; the selection stays.
- Escape clears the selection when no sheet, menu or dialog is open.

**Vitest (written first):** a row box toggles and marks the row; a disabled box for a row the viewer cannot change; the header box reads none / mixed / all and selects the page; a group box selects its rows; the bar appears with "3 selected" and disappears when cleared; Status → In progress posts `{ ids, changes: { status: 'doing' } }`; Assign lists only the common members; a partial answer shows "1 updated, 1 not changed." and the details list the refused title and sentence (and the sentence alone for a null title), and only the changed id leaves the selection; Delete asks first and Cancel sends nothing; Escape clears; a filter change clears. All matching: with the page selected and `items.total` 137, "Select all 137 matching" shows and enters the mode ("All 137 matching selected"); it is disabled above `MatchingCap` (its tooltip reads "Up to 500 at once. Narrow the filters." with the default cap); Priority → High asks "Apply to 137 action items?" and Cancel sends nothing; Apply posts `{ filters, count: 137, changes: { priority: 'high' } }` and reloads `items` and `counts`; a 422 on `count` keeps the dialog with its sentence and the next Apply sends the reloaded total; unticking a row leaves the mode with the other page rows selected; a page change keeps the mode and a filter change clears it.

**Commit:** `feat(action-items): selection, all matching and bulk bar on the table`

### Task 14 (lane Bulk, after Task 13): Selection below 80rem, and "Sync to :tracker"

**Files:** create `components/action-items/use-bulk-tracker-export.ts` and its test, `use-long-press.ts` and its test (in `components/action-items/`); modify `action-items-list.tsx` (selection mode), `action-items-header.tsx` ("Select" / "Done" button), `action-items-bulk-bar.tsx` (docked layout, "…" menu, sync button and progress), `action-items-page.tsx` (selection mode state).

**Interfaces:**
- Consumes: Task 13's hook and bar; plan 21's browser loop, merged before this plan (Task 18 of plan 21, RT-10): `runBulkExport(itemIds, exportOne, onProgress, shouldStop)` and `itemsToExport(items, source)` of `lib/action-items/bulk-export.ts`, and `ExportTargetFields({ source, scope, teamId, value, onChange })` of `components/action-items/export-target-fields.tsx` (read both first; use them as they are — the loop, its outcomes and the reconnect stop are plan 21's, not rewritten here); `endpoints.exportItem` of the workspace page (`lib/action-items/endpoints.ts`); `exportSources` of the page.
- Produces: `useLongPress(onLongPress, { delayMs = 500, moveTolerancePx = 10 })` returning pointer handlers; `useBulkTrackerExport({ endpoints, run }): { start(items, source, target); stop(); progress: { done: number; total: number } | null; result: { exported: string[]; skipped: string[]; failed: BulkRefusal[] } | null }`, a thin hook over `runBulkExport` (progress state, `stop` through `shouldStop`, `skipped` = the selected items `itemsToExport` leaves out, `failed` mapped from the loop's failed outcomes to `BulkRefusal`).

**Composition and behaviours (spec §9.4, §9.5):**
- Header button "Select" (below 80rem only, after "Group by"); in selection mode it reads "Finish selecting" and leaves the mode (and clears the selection).
- Selection mode in the list: a box (20 px, 44 px target) before each item's status button; a tap on the item toggles it; the bulk bar docks at the bottom (`layout="docked"`, safe-area padding), full width, with Status, Assign, Due date and "…" (Priority, Sync, Delete, and "Select all :count matching" when `items.total` is above the rows shown — it selects the page's selectable rows and enters "all matching" mode in one step, disabled above `MatchingCap` as in Task 13).
- Long press (touch and pen pointers only, 500 ms without moving more than 10 px) on an item enters selection mode with that item selected; a short tap still opens it; the context menu of a long press is prevented on the item.
- "Sync to :tracker" (`:tracker` = the source label, e.g. "Jira"): in "all matching" mode, disabled with the tooltip "Select rows on this page to sync them." (the loop needs ids; spec §3, P24-06); otherwise shown when every selected item has the same `teamId` and `sourcesOf(teamId)` has one source (a menu of sources when it has several); opens a small dialog holding `ExportTargetFields` for the selection's team (the target chosen once); on confirm, `runBulkExport` exports the unlinked items (`itemsToExport`) one after the other through `endpoints.exportItem(id)` with the target; items already linked to that source are skipped; the bar shows "Exporting :done of :total…" with a `progress` bar and "Stop"; "reconnect required" (the error the export answers today; read `item-export.tsx` for how it is recognised) stops the loop; each exported item goes through `saveRow`; the end toast: ":count exported, :skipped already linked" plus failures in "Details".

**Vitest (written first):** "Select" enters the mode and shows boxes; "Finish selecting" leaves it and clears; a long press of 500 ms enters the mode with the item selected, a 200 ms press opens it, a move cancels; the docked bar shows three actions and "…" holding the rest; the "…" menu offers "Select all 137 matching" and enters the mode; the sync button is hidden for a two-team selection and for a team without a source, and disabled with its tooltip in "all matching" mode; the loop exports two unlinked items in order, skips a linked one, shows "Exporting 1 of 2…", and stops on a reconnect answer; "Stop" ends after the current item.

**Commit:** `feat(action-items): phone selection and bulk sync to a tracker`

### Task 15 (lane Export): "Export" in the topbar

**Files:** create `components/action-items/export-action-items-button.tsx` and its test; modify `pages/action-items/index.tsx` (the `before` prop of `NewActionItemButton`; also render the button when the viewer has no creatable team).

**Interfaces:** consumes `actionItemsExportUrl(workspace, filters)` (Task 10).

**Composition and behaviours (spec §9.1):** an outline `Button` rendered as an anchor (`asChild`) with `href={actionItemsExportUrl(workspace.slug, filters)}` and `download`, lucide `FileDown`, label "Export" (visually hidden below `sm`, as "New action item" does, keeping the accessible name); placed before "New action item"; when `creatableTeams` is empty, the topbar shows "Export" alone.

**Vitest (written first):** the link carries the filters of the props (status, priority, due, source, assignee, team) and not `item`; it sits before "New action item"; it shows without a creatable team; its name is "Export" at every width.

**Commit:** `feat(action-items): export the filtered list from the topbar`

---

## Final

### Task 16: Bench section and captures (light, 1440, French)

**Files:** modify `resources/js/pages/dev/sections/actions-index.tsx`, `tests/Browser/Visual/ActionsPageVisualTest.php`.

- [ ] Add the states of spec §9.9 to the bench section, built from the page's pieces as the section does today (it does not mount `ActionItemsPage`): `selection` (three of six rows selected, header box mixed, the floating bar with "Select all 137 matching" once the page is selected), `all-matching` (the bar reading "All 137 matching selected", every row ticked, "Sync to Jira" disabled), `confirm-matching` (the "Apply to 137 action items?" dialog), `bulk-result` (the partial toast open on "Details"), `bulk-delete` (the confirmation), `facets` (Status "2 of 3", Priority High, Due date "Next 7 days", Source "From a retro", the overdue shortcut), `in-progress` (one row per status, with the sheet open on a started item), `phone-selection` (rendered at its own narrow frame: the list in selection mode with the docked bar), `sprint-groups` (grouped by sprint: "Sprint 42" current with ":count action items · 21 Sep → 4 Oct", "Sprint 41" finished with ":count carried over" and ":count overdue", then "No sprint"; built with `ActionItemGroupMeta` of Task 23), `search` (the page's topbar field of Task 24 holding "runbook", the list narrowed to two rows).
- [ ] Add the captures to `ActionsPageVisualTest.php` for those states and for the real page of a manager with an "Export" button, the topbar search field, the grouping by sprint (a team with two sprints, `teamSprint()`) and the sidebar's "Actions · n overdue", in light, at 1440, in French only (`VISUAL_ONLY=light-1440-fr`), and run them: `vendor/bin/sail artisan test --compact tests/Browser/Visual/ActionsPageVisualTest.php` with that variable. The harness's overflow check must pass. If `tests/Browser/Visual` already captures the team integrations page, add its status mapping state with "Start to" (light, 1440, French) the same way; if it does not, add none and say so in the report (spec §9.9).
- [ ] Compare each capture with `docs/design-system/components/ScreenActions/preview.html` (and ActionItem's preview for the status button): every difference is fixed in the lane's component; one that cannot be (no data, accessibility) is added as a row to **Pre-build deviations** with its reason and listed in the report for the owner, without stopping the plan (autonomy mandate of 2026-10-03).
- [ ] Commit: `test(action-items): bench states and captures of bulk changes, facets and In progress`.

### Task 17: Translations

**Files:** `lang/{en,fr,es,de}.json`.

- [ ] Check that every key added by Tasks 1 to 15 and 20 to 24 is in the four files, with these values (English is the key). Existing keys keep their values.

| Key | fr | es | de |
|---|---|---|---|
| This action item no longer exists. | Cette action n'existe plus. | Esta acción ya no existe. | Diese Aktion gibt es nicht mehr. |
| Tickets | Tickets | Tickets | Tickets |
| Next 7 days | 7 prochains jours | Próximos 7 días | Nächste 7 Tage |
| From a retro | Issue d'une rétro | De una retro | Aus einer Retro |
| Any | Toutes | Cualquiera | Alle |
| Bulk actions | Actions groupées | Acciones en bloque | Sammelaktionen |
| Clear selection | Désélectionner | Deseleccionar | Auswahl aufheben |
| Select all on this page | Tout sélectionner sur cette page | Seleccionar todo en esta página | Alle auf dieser Seite auswählen |
| Select :title | Sélectionner :title | Seleccionar :title | :title auswählen |
| You cannot change this action item | Tu ne peux pas modifier cette action | No puedes modificar esta acción | Du kannst diese Aktion nicht ändern |
| Sync to :tracker | Synchroniser vers :tracker | Sincronizar con :tracker | Mit :tracker synchronisieren |
| Exporting :done of :total… | Export :done sur :total… | Exportando :done de :total… | Export :done von :total… |
| Stop | Arrêter | Detener | Stoppen |
| Delete :count action items? | Supprimer :count actions ? | ¿Eliminar :count acciones? | :count Aktionen löschen? |
| This cannot be undone. Their comments and sub-tasks are deleted too. | C'est définitif. Leurs commentaires et sous-tâches sont supprimés aussi. | No se puede deshacer. Sus comentarios y subtareas también se eliminan. | Das lässt sich nicht rückgängig machen. Ihre Kommentare und Unteraufgaben werden ebenfalls gelöscht. |
| 1 action item updated. | 1 action mise à jour. | 1 acción actualizada. | 1 Aktion aktualisiert. |
| :count action items updated. | :count actions mises à jour. | :count acciones actualizadas. | :count Aktionen aktualisiert. |
| :count updated, :refused not changed. | :count mises à jour, :refused inchangées. | :count actualizadas, :refused sin cambios. | :count aktualisiert, :refused unverändert. |
| :count deleted, :refused not deleted. | :count supprimées, :refused non supprimées. | :count eliminadas, :refused no eliminadas. | :count gelöscht, :refused nicht gelöscht. |
| :count action items deleted. | :count actions supprimées. | :count acciones eliminadas. | :count Aktionen gelöscht. |
| :count exported, :skipped already linked. | :count exportées, :skipped déjà liées. | :count exportadas, :skipped ya vinculadas. | :count exportiert, :skipped bereits verknüpft. |
| Details | Détails | Detalles | Details |
| Started :date | Commencée le :date | Empezada el :date | Begonnen am :date |
| Finish selecting | Terminer la sélection | Terminar la selección | Auswahl beenden |
| Start to | Statut au démarrage | Estado al empezar | Status beim Starten |
| Jira requires more fields to start :key. Start it in Jira. | Jira exige d’autres champs pour démarrer :key. Démarre-le dans Jira. | Jira necesita más campos para empezar :key. Empiézalo en Jira. | Jira verlangt weitere Felder, um :key zu starten. Starte es in Jira. |
| No transition to an in-progress status is available for :key. | Aucune transition vers un statut en cours n’est disponible pour :key. | No hay ninguna transición a un estado en curso disponible para :key. | Für :key ist kein Übergang in einen laufenden Status verfügbar. |
| Select all :count matching | Sélectionner les :count correspondantes | Seleccionar las :count que coinciden | Alle :count Treffer auswählen |
| All :count matching selected | Les :count correspondantes sont sélectionnées | Las :count que coinciden están seleccionadas | Alle :count Treffer ausgewählt |
| Up to :cap at once. Narrow the filters. | :cap au maximum à la fois. Affine les filtres. | Hasta :cap a la vez. Ajusta los filtros. | Höchstens :cap auf einmal. Grenze die Filter ein. |
| Apply to :count action items? | Appliquer à :count actions ? | ¿Aplicar a :count acciones? | Auf :count Aktionen anwenden? |
| Every action item matching the filters is changed: :count in all. | Chaque action qui correspond aux filtres est modifiée : :count en tout. | Se modifica cada acción que coincide con los filtros: :count en total. | Jede Aktion, die zu den Filtern passt, wird geändert: insgesamt :count. |
| The list changed: :count action items match now. | La liste a changé : :count actions correspondent maintenant. | La lista cambió: ahora coinciden :count acciones. | Die Liste hat sich geändert: Jetzt passen :count Aktionen. |
| More than :cap action items match. Narrow the filters. | Plus de :cap actions correspondent. Affine les filtres. | Coinciden más de :cap acciones. Ajusta los filtros. | Mehr als :cap Aktionen passen. Grenze die Filter ein. |
| Select rows on this page to sync them. | Sélectionne des lignes de cette page pour les synchroniser. | Selecciona filas de esta página para sincronizarlas. | Wähle Zeilen auf dieser Seite aus, um sie zu synchronisieren. |
| Sprint | Sprint | Sprint | Sprint |
| Sprint :number | Sprint :number | Sprint :number | Sprint :number |
| :team · Sprint :number | :team · Sprint :number | :team · Sprint :number | :team · Sprint :number |
| Finished | Terminé | Terminado | Beendet |
| No sprint | Sans sprint | Sin sprint | Ohne Sprint |
| 1 action item · :start → :end | 1 action · :start → :end | 1 acción · :start → :end | 1 Aktion · :start → :end |
| :count action items · :start → :end | :count actions · :start → :end | :count acciones · :start → :end | :count Aktionen · :start → :end |
| 1 carried over | 1 reportée | 1 aplazada | 1 übertragen |
| :count carried over | :count reportées | :count aplazadas | :count übertragen |
| Search an action item, a ticket… | Rechercher une action, un ticket… | Buscar una acción, un ticket… | Aktion oder Ticket suchen… |
| Search action items | Rechercher des actions | Buscar acciones | Aktionen suchen |

  The worded sidebar badge reuses ":count overdue" (it exists: "4 en retard" in French). "In progress" exists ("En cours"); a sprint's badge reuses it. ":count action items" and "1 action item" exist if the table's group count uses them; check, and do not duplicate.

  Keys that may already exist ("Any", "Details", "Stop", "Clear selection", "Apply"): keep the existing value if there is one, and do not duplicate the key. The French values use the typographic apostrophe (’) where the neighbouring Jira sentences do.
- [ ] Run `bin/test-db pgsql -- tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php` and `npm run test -- resources/js/lib/i18n` (if the front has a key test).
- [ ] Commit: `chore(i18n): action items bulk, facets, In progress and export in four languages`.

### Task 18: Deviations and documents

- [ ] `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`: D-19 — strike what this plan built (selection and bulk bar, priority / due date / source facets, "In progress", topbar "Export", the grouping by sprint as the default, the topbar search field); what remains: whiteboard and survey sources (backlog). D-118 — "no long press" removed; the chips' wording stays.
- [ ] `docs/superpowers/research/front-rewrite/deviations.md`, D-129: the Actions badge wording is built (plan 24, P24-08); the row keeps what other plans own ("Sessions" current entry, the role line of plan 23). `docs/superpowers/research/front-rewrite/pre-build-deviations.md`, PB-12: on the action items page the topbar holds the page's search field (plan 24, P24-07); every other page keeps the palette's field.
- [ ] `docs/superpowers/research/front-rewrite/feature-roadmap.md`: AI-1 to AI-4 "done, plan 24"; the backlog line under the table lists spec §3.
- [ ] `docs/superpowers/research/front-rewrite/deviations.md`: the rows P24-01 to P24-12 (with the owner's answers) and those Task 16 added.
- [ ] `docs/database.md`: in "The database holds keys, not rules", nothing changes (`started_at` is not derived); in the upgrade list of the release, add "`started_at` on action items (empty)", "`external_key_search` on `action_item_external_links` (filled by its migration, outside a transaction, re-runnable; run in maintenance mode as the other search-column fills)" and "`started` as a value of `action_item_external_links.external_state` and `last_pushed_state` (no migration; links are corrected by their next read)"; in the list of `*_search` columns (rule 4, rule 9), add `action_item_external_links.external_key_search`.
- [ ] The release note (where the project keeps it; read `docs/` for the release notes of plans 18 and 19, and ask if there is none): the status button now starts a to-do item (spec §14, "A gesture that changes"); "In progress" moves linked Jira and Linear issues, with "Start to" per project or team; the first read after the release may move an issue with an unpushed reopening back to its reopen target (spec §14, "The release"); the list groups by sprint by default and searches from the topbar, where ⌘K focuses the page's field and "/" opens the palette (spec §14, "The search takes ⌘K on one page").
- [ ] Commit: `docs: plan 24 — roadmap, deviation rows, database notes and release note`.

### Task 19: Full suites on PostgreSQL, and the report

- [ ] `npm run test` (the whole Vitest suite), `npm run types:check`, `npm run check`, `npm run build:front`.
- [ ] `vendor/bin/sail composer types:check` and `vendor/bin/pint --dirty --format agent`.
- [ ] `bin/test-db pgsql` (Unit, Feature, Upgrade and Arch), then `bin/test-db pgsql --concurrency`, one at a time. No other engine: the four-engine matrix (pgsql, sqlite, mariadb, mysql, and `sqlite-file` for the races) runs once after the last merge of the roadmap into `roadmap` (plans 24 and 25), by the controller, outside this plan.
- [ ] Write `.superpowers/sdd/roadmap/plan-24/report.md`: tasks and commits; each acceptance criterion of spec §13 (1 to 30) with the test that proves it; the PostgreSQL suites' result lines; the cap measured in Task 8 (and the lowered cap if the rule applied); the deviations added; the walkthrough files whose selectors changed and were not edited (`grep -rln "aria-label=\"Status\"\|Mark as done\|status=overdue" tests/Browser/Walkthroughs`); what was not determined (spec §16) and what was learnt.
- [ ] Commit: `docs: plan 24 report`.

---

## Added by the second revision (2026-10-03): Tasks 20 to 24

The owner's answers to P24-03, P24-07 and P24-08 add five tasks. They keep their numbers but run where **Tasks** (top of the plan) says: 20 and 21 in Step A after Task 9 and before Task 10; 22 in Step B after Task 10; 23 and 24 as two more lanes of Step C, cut from the head of Task 22.

### Task 20 (Step A, after Task 9): Search `q` — text and ticket key (P24-07)

**Files:**
- Create: `database/migrations/2026_10_24_100100_add_external_key_search_to_action_item_external_links.php`, `tests/Feature/ActionItems/ActionItemSearchTest.php`, `tests/Upgrade/ExternalKeySearchTest.php`
- Modify: `app/Models/ActionItemExternalLink.php`, `app/Actions/ActionItems/ActionItemFilters.php`, `app/Actions/ActionItems/ActionItemQuery.php`, `app/Actions/ActionItems/ActionItemBulkChanges.php` (`FilterKeys`), `tests/Feature/ActionItems/ActionItemFiltersTest.php` (two expectations of Task 5)

Read first: `docs/database.md` rules 4 and 9; `app/Concerns/HasSearchColumns.php`; `app/Support/Database/SearchText.php`; `database/migrations/2026_10_19_100700_add_search_columns_for_workspace_search.php` (the fill this migration copies); `ActionItem::searchColumns()`; the `filterByScope()` Task 5 wrote. Run `grep -rn "action_item_external_links')" app database tests` : a write that inserts or updates a link without the model must set `external_key_search` too (rule 9); list each one you find in the commit message and fix it the same way.

**Interfaces:**
- Consumes: `ActionItemFilters::fromQuery()` (Task 5), `ActionItemQuery::filter()`, `counts()` (Task 5), `ActionItemBulkChanges::FilterKeys` (Task 8), `ExportActionItemsCsv` (Task 9, reads the page's filters), `actionItemCsvRows()` (Task 9's test helper).
- Produces: `ActionItemFilters::$search` (`?string`, constructor's last argument `search`), `ActionItemFilters::SearchMaxLength = 100`, `toArray()` gains `q` after `source` (`array{status, priority, due, source, q, assignee, team, item}`); `ActionItemExternalLink` uses `HasSearchColumns` (`external_key` → `external_key_search`); `ActionItemBulkChanges::FilterKeys` gains `q`. The `filters` prop carries `q` (string or null), read by Task 24.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/ActionItems/ActionItemSearchTest.php`:

```php
<?php

use App\Enums\ActionItemPriority;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Team;
use App\Models\User;

/**
 * @param  array<string, string>  $query
 * @return array<int, string>
 */
function searchedContents(Team $team, User $user, array $query): array
{
    $items = test()->actingAs($user)
        ->get(route('workspaces.actionItems.index', ['workspace' => $team->workspace, ...$query]))
        ->assertOk()
        ->viewData('page')['props']['items']['data'];

    return collect($items)->pluck('content')->sort()->values()->all();
}

it('finds an item by its text in any case, and respects accents', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Write the on-call RUNBOOK']);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Été planning']);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Other']);

    expect(searchedContents($team, $user, ['q' => 'runbook']))->toBe(['Write the on-call RUNBOOK'])
        ->and(searchedContents($team, $user, ['q' => 'ÉTÉ']))->toBe(['Été planning'])
        ->and(searchedContents($team, $user, ['q' => 'ete']))->toBe([]);
});

it('finds an item by its ticket key in any case', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $linked = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Linked']);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Not linked']);
    ActionItemExternalLink::factory()->create(['action_item_id' => $linked->id, 'external_key' => 'PROJ-12']);

    expect(searchedContents($team, $user, ['q' => 'proj-12']))->toBe(['Linked'])
        ->and(searchedContents($team, $user, ['q' => 'PROJ-1']))->toBe(['Linked']);
});

it('combines the search with the other filters and narrows the counters', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'runbook high', 'priority' => ActionItemPriority::High]);
    ActionItem::factory()->withoutRetro($team, $user)->completed()->create(['content' => 'runbook done']);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'other high', 'priority' => ActionItemPriority::High]);

    $counts = $this->actingAs($user)
        ->get(route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'q' => 'runbook']))
        ->viewData('page')['props']['counts'];

    expect(searchedContents($team, $user, ['q' => 'runbook', 'priority' => 'high']))->toBe(['runbook high'])
        ->and(searchedContents($team, $user, ['q' => 'runbook', 'status' => 'todo,doing,completed']))->toBe(['runbook done', 'runbook high'])
        ->and($counts)->toBe(['open' => 1, 'overdue' => 0, 'completed' => 1, 'mine' => 0, 'rituals' => 0]);
});

it('gives the search back trimmed and cut, and an empty search as none', function (string $given, ?string $expected) {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $filters = $this->actingAs($user)
        ->get(route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'q' => $given]))
        ->viewData('page')['props']['filters'];

    expect($filters['q'])->toBe($expected);
})->with([
    'trimmed' => ['  runbook  ', 'runbook'],
    'cut at 100' => [str_repeat('a', 120), str_repeat('a', 100)],
    'blank' => ['   ', null],
]);

it('never searches a team the viewer cannot see, on the page or through "all matching"', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $hidden = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $mine = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'runbook mine']);
    $theirs = ActionItem::factory()->withoutRetro($hidden, User::factory()->create())->create(['content' => 'runbook theirs']);

    expect(searchedContents($team, $user, ['q' => 'runbook']))->toBe(['runbook mine']);

    $this->actingAs($user)
        ->postJson(route('workspaces.actionItemBulkUpdates.store', $team->workspace), ['filters' => ['q' => 'runbook'], 'count' => 1, 'changes' => ['priority' => 'low']])
        ->assertOk()
        ->assertJsonPath('changedCount', 1);

    expect($mine->fresh()->priority)->toBe(ActionItemPriority::Low)
        ->and($theirs->fresh()->priority)->toBe(ActionItemPriority::Medium);
});

it('exports what the search finds', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'runbook']);
    ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'other']);

    $rows = actionItemCsvRows($this->actingAs($user)->get(route('workspaces.actionItemCsvExports.show', ['workspace' => $team->workspace, 'q' => 'RUNBOOK'])));

    expect(collect($rows)->skip(1)->pluck(0)->values()->all())->toBe(['runbook']);
});

it('keeps the folded key of a link up to date', function () {
    $link = ActionItemExternalLink::factory()->create(['external_key' => 'ABC-1']);

    expect(ActionItemExternalLink::query()->whereContains('external_key', 'abc-1')->exists())->toBeTrue();

    $link->update(['external_key' => 'XYZ-2']);

    expect(ActionItemExternalLink::query()->whereContains('external_key', 'abc')->exists())->toBeFalse()
        ->and(ActionItemExternalLink::query()->whereContains('external_key', 'xyz-2')->exists())->toBeTrue();
});
```

`tests/Upgrade/ExternalKeySearchTest.php`:

```php
<?php

use App\Models\ActionItemExternalLink;
use App\Support\Database\SearchText;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

it('finds a link written before the column by its key', function () {
    $migration = '2026_10_24_100100_add_external_key_search_to_action_item_external_links.php';
    $earlier = collect(glob(database_path('migrations/*.php')))
        ->filter(fn (string $path): bool => basename($path) < $migration)
        ->values()
        ->all();

    Artisan::call('migrate:fresh', ['--path' => $earlier, '--realpath' => true]);

    $workspace = (string) Str::uuid7();
    $team = (string) Str::uuid7();
    $item = (string) Str::uuid7();
    DB::table('workspaces')->insert(['id' => $workspace, 'name' => 'Acme', 'slug' => 'acme', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('teams')->insert(['id' => $team, 'workspace_id' => $workspace, 'name' => 'Platform', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('action_items')->insert([
        'id' => $item,
        'team_id' => $team,
        'content' => 'Linked',
        'content_search' => SearchText::fold('Linked'),
        'priority' => 'medium',
        'sort_rank' => 1_000_000_001,
        'created_at' => '2026-09-01 10:00:00',
        'updated_at' => '2026-09-01 10:00:00',
    ]);
    DB::table('action_item_external_links')->insert([
        'id' => (string) Str::uuid7(),
        'action_item_id' => $item,
        'source' => 'jira',
        'external_site' => 'cloud-1',
        'external_id' => '10012',
        'external_key' => 'PROJ-12',
        'external_url' => 'https://acme.atlassian.net/browse/PROJ-12',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    Artisan::call('migrate', ['--path' => [database_path("migrations/{$migration}")], '--realpath' => true]);
    Artisan::call('migrate', ['--path' => [database_path("migrations/{$migration}")], '--realpath' => true]);

    expect(ActionItemExternalLink::query()->whereContains('external_key', 'proj-12')->pluck('action_item_id')->all())->toBe([$item]);
});
```

Write the `action_items` row as Task 1's upgrade test does (if that test had to fold `content_search` or set another column, do the same here). The second `migrate` call proves the migration can run again (it is skipped as already run; the `hasColumn` guard covers a run stopped midway).

In `tests/Feature/ActionItems/ActionItemFiltersTest.php` (Task 5's file), two expectations gain the new key, in its place after `source`: "gives the filters back in their canonical form" (`'source' => null, 'q' => null, 'assignee' => null, …`) and "reads the same filters from an array as from the query" (the same line). Name both in the commit message.

- [ ] **Step 2: Run the tests to see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ActionItemSearchTest.php`
Expected: FAIL — every item is listed (`q` is ignored), then `Call to undefined method …whereContains()` on the link.

- [ ] **Step 3: Implement**

`database/migrations/2026_10_24_100100_add_external_key_search_to_action_item_external_links.php`:

```php
<?php

use App\Support\Database\SearchText;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Off, so that no table stays locked while its rows are filled. The work can then stop midway:
     * up() adds only what is missing and can be run again.
     */
    public $withinTransaction = false;

    /**
     * The folded ticket key the action items search reads (plan 24, P24-07), as the earlier
     * search-column migrations do. Existing links are filled here, one update per link to fill.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('action_item_external_links', 'external_key_search')) {
            Schema::table('action_item_external_links', function (Blueprint $table): void {
                $table->text('external_key_search')->nullable();
            });
        }

        DB::table('action_item_external_links')
            ->select(['id', 'external_key'])
            ->whereNull('external_key_search')
            ->lazyById(500)
            ->each(fn (object $row) => DB::table('action_item_external_links')
                ->where('id', $row->id)
                ->update(['external_key_search' => SearchText::fold($row->external_key)]));
    }
};
```

`app/Models/ActionItemExternalLink.php`: `use App\Concerns\HasSearchColumns;` and `use HasSearchColumns;` (one trait per line, after `use HasUuids;`); the docblock gains `@property string|null $external_key_search`; add

```php
    /**
     * @return array<string, string>
     */
    public function searchColumns(): array
    {
        return ['external_key' => 'external_key_search'];
    }
```

`app/Actions/ActionItems/ActionItemFilters.php`:
- `public const SearchMaxLength = 100;` after `Sources`.
- The constructor gains a last argument `public ?string $search = null,` (docblock line `@param  ?string  $search  the topbar search, trimmed, cut at SearchMaxLength`).
- `fromQuery()` passes `search: self::search($query['q'] ?? null),` after `source:`.
- `toArray()`: `'q' => $this->search,` after `'source' => $this->source,`; its docblock shape gains `q: ?string` at the same place.
- New private method:

```php
    private static function search(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $term = trim(mb_substr(trim($value), 0, self::SearchMaxLength));

        return $term === '' ? null : $term;
    }
```

`app/Actions/ActionItems/ActionItemQuery.php`: at the end of `filterByScope()`, before `return $query;`:

```php
        if ($filters->search !== null) {
            $this->filterBySearch($query, $filters->search);
        }
```

and the method:

```php
    /**
     * Spec 24 §6.3: the item's text or one of its ticket keys contains the term, case ignored
     * (the folded columns of docs/database.md rule 4). The rows are not checked again in PHP:
     * the list, its counters, its export and "all matching" must stay one set.
     *
     * @param  Builder<ActionItem>  $query
     */
    private function filterBySearch(Builder $query, string $term): void
    {
        $query->where(function (Builder $query) use ($term): void {
            $query->whereContains('content', $term)
                ->orWhereHas('externalLinks', fn (Builder $links) => $links->whereContains('external_key', $term));
        });
    }
```

`app/Actions/ActionItems/ActionItemBulkChanges.php`: `public const FilterKeys = ['status', 'priority', 'due', 'source', 'q', 'assignee', 'team'];`.

`ExportActionItemsCsv` and the controllers need no change: they read the page's parameters through `ActionItemFilters`.

- [ ] **Step 4: Run the tests on PostgreSQL**

Run: `bin/test-db pgsql -- tests/Feature/ActionItems tests/Upgrade/ExternalKeySearchTest.php tests/Feature/Integrations tests/Arch`.
Expected: PASS (`DatabasePortabilityTest` included: `whereContains` is the rule-4 scope, the migration uses the Schema builder and the query builder only).

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_10_24_100100_add_external_key_search_to_action_item_external_links.php app/Models/ActionItemExternalLink.php app/Actions/ActionItems/ActionItemFilters.php app/Actions/ActionItems/ActionItemQuery.php app/Actions/ActionItems/ActionItemBulkChanges.php tests/Feature/ActionItems/ActionItemSearchTest.php tests/Feature/ActionItems/ActionItemFiltersTest.php tests/Upgrade/ExternalKeySearchTest.php
git commit -m "feat(action-items): search by text or ticket key (P24-07)

ActionItemFiltersTest: two expectations of plan 24 Task 5 gain q.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 21 (Step A, after Task 20): The sprints of the page (P24-03)

**Files:**
- Create: `app/Actions/ActionItems/ActionItemSprints.php`, `tests/Feature/ActionItems/ActionItemSprintsTest.php`
- Modify: `app/Http/Controllers/WorkspaceActionItemsController.php` (`items()` and the constructor)

Read first: plan 23's `app/Models/TeamSprint.php` (`present()`, the `DateOnly` casts), `Team::sprints()`, the helper `teamSprint()` of `tests/Pest.php`, `ActionItem::today()`, `WorkspaceActionItemsController::items()`.

**Interfaces:**
- Consumes: `TeamSprint` and `teamSprint()` (plan 23), `ActionItem::today()`.
- Produces: `ActionItemSprints::forPage(iterable $items): array{sprints: array<int, array{id: string, number: int, startsOn: string, endsOn: string, teamId: string, state: string, itemIds: array<int, string>}>, withoutSprint: array<int, string>}`; the `items` prop of `action-items/index` gains `sprints` and `withoutSprint` (spec §6.8), read by Task 23.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/ActionItems/ActionItemSprintsTest.php`:

```php
<?php

use App\Models\ActionItem;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * @return array{sprints: array<int, array<string, mixed>>, withoutSprint: array<int, string>}
 */
function pageSprints(Team $team, User $user): array
{
    $items = test()->actingAs($user)
        ->get(route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'status' => 'todo,doing,completed']))
        ->assertOk()
        ->viewData('page')['props']['items'];

    return ['sprints' => $items['sprints'], 'withoutSprint' => $items['withoutSprint']];
}

function actionItemCreatedOn(Team $team, User $user, string $day, string $content): ActionItem
{
    test()->travelTo(CarbonImmutable::parse("{$day} 10:00:00"));

    return ActionItem::factory()->withoutRetro($team, $user)->create(['content' => $content]);
}

it('places each row in the sprint of its team that contains its creation day', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $sprint41 = teamSprint($team, 41, '2026-09-07', '2026-09-20');
    $sprint42 = teamSprint($team, 42, '2026-09-21', '2026-10-04');
    $before = actionItemCreatedOn($team, $user, '2026-09-05', 'before the first sprint');
    $last41 = actionItemCreatedOn($team, $user, '2026-09-20', 'last day of 41');
    $first42 = actionItemCreatedOn($team, $user, '2026-09-21', 'first day of 42');
    $this->travelTo(CarbonImmutable::parse('2026-09-30 12:00:00'));

    expect(pageSprints($team, $user))->toBe([
        'sprints' => [
            ['id' => $sprint42->id, 'number' => 42, 'startsOn' => '2026-09-21', 'endsOn' => '2026-10-04', 'teamId' => $team->id, 'state' => 'current', 'itemIds' => [$first42->id]],
            ['id' => $sprint41->id, 'number' => 41, 'startsOn' => '2026-09-07', 'endsOn' => '2026-09-20', 'teamId' => $team->id, 'state' => 'finished', 'itemIds' => [$last41->id]],
        ],
        'withoutSprint' => [$before->id],
    ]);
});

it('lists the current sprint of a team even when no row of the page is in it', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $sprint41 = teamSprint($team, 41, '2026-09-07', '2026-09-20');
    $sprint42 = teamSprint($team, 42, '2026-09-21', '2026-10-04');
    $old = actionItemCreatedOn($team, $user, '2026-09-10', 'in 41');
    $this->travelTo(CarbonImmutable::parse('2026-09-30 12:00:00'));

    expect(collect(pageSprints($team, $user)['sprints'])->map(fn (array $sprint): array => [$sprint['id'], $sprint['state'], $sprint['itemIds']])->all())->toBe([
        [$sprint42->id, 'current', []],
        [$sprint41->id, 'finished', [$old->id]],
    ]);
});

it('lists no sprint between two sprints, nor a planned one', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    teamSprint($team, 41, '2026-09-07', '2026-09-20');
    teamSprint($team, 43, '2026-10-05', '2026-10-18');
    $between = actionItemCreatedOn($team, $user, '2026-09-25', 'between');
    $this->travelTo(CarbonImmutable::parse('2026-09-30 12:00:00'));

    expect(pageSprints($team, $user))->toBe(['sprints' => [], 'withoutSprint' => [$between->id]]);
});

it('keeps the sprints of each team apart and brings none of a team the viewer cannot see', function () {
    $atlas = Team::factory()->create();
    $nova = Team::factory()->create(['workspace_id' => $atlas->workspace_id]);
    $member = teamMember($atlas);
    $manager = workspaceManager($atlas->workspace);
    $atlasSprint = teamSprint($atlas, 42, '2026-09-21', '2026-10-04');
    $novaSprint = teamSprint($nova, 42, '2026-09-21', '2026-10-04');
    $atlasItem = actionItemCreatedOn($atlas, $member, '2026-09-22', 'atlas');
    $novaItem = actionItemCreatedOn($nova, User::factory()->create(), '2026-09-22', 'nova');
    $this->travelTo(CarbonImmutable::parse('2026-09-30 12:00:00'));

    $forManager = collect(pageSprints($atlas, $manager)['sprints'])->mapWithKeys(fn (array $sprint): array => [$sprint['id'] => [$sprint['teamId'], $sprint['itemIds']]])->all();

    expect($forManager)->toEqual([
        $atlasSprint->id => [$atlas->id, [$atlasItem->id]],
        $novaSprint->id => [$nova->id, [$novaItem->id]],
    ])->and(collect(pageSprints($atlas, $member)['sprints'])->pluck('id')->all())->toBe([$atlasSprint->id]);
});

it('sends no sprint for an empty page', function () {
    $team = Team::factory()->create();
    teamSprint($team, 42, '2026-09-21', '2026-10-04');
    $this->travelTo(CarbonImmutable::parse('2026-09-30 12:00:00'));

    expect(pageSprints($team, teamMember($team)))->toBe(['sprints' => [], 'withoutSprint' => []]);
});
```

The manager case uses `toEqual` on a map: two sprints that start the same day come in descending `id` order, which the test does not pin. A request without `team` lists every team the viewer may see (the front's landing choice of a team is not involved), which is what this test reads.

- [ ] **Step 2: Run the tests to see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ActionItemSprintsTest.php`
Expected: FAIL — `Undefined array key "sprints"`.

- [ ] **Step 3: Implement**

`app/Actions/ActionItems/ActionItemSprints.php` (`vendor/bin/sail artisan make:class Actions/ActionItems/ActionItemSprints --no-interaction`, then the body):

```php
<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;
use App\Models\TeamSprint;
use Illuminate\Support\Collection;

class ActionItemSprints
{
    /**
     * Spec 24 §6.8: the sprint of each row of the page is the sprint of its team that contains
     * the day the row was created (plan 23 rule 5). The current sprint of each team on the page
     * is listed too, so that a row created live finds its group before the next reload.
     *
     * @param  iterable<int, ActionItem>  $items
     * @return array{
     *     sprints: array<int, array{id: string, number: int, startsOn: string, endsOn: string, teamId: string, state: string, itemIds: array<int, string>}>,
     *     withoutSprint: array<int, string>
     * }
     */
    public function forPage(iterable $items): array
    {
        $rows = collect($items);

        if ($rows->isEmpty()) {
            return ['sprints' => [], 'withoutSprint' => []];
        }

        $today = ActionItem::today()->toDateString();
        $sprints = TeamSprint::query()
            ->whereIn('team_id', $rows->pluck('team_id')->unique()->values()->all())
            ->where('ends_on', '>=', $rows->map(fn (ActionItem $item): string => $this->createdOn($item))->min())
            ->where('starts_on', '<=', $today)
            ->orderBy('starts_on')
            ->orderBy('id')
            ->get();
        $itemIds = $rows
            ->groupBy(fn (ActionItem $item): string => $this->sprintOf($sprints, $item)?->id ?? '')
            ->map(fn (Collection $group): array => $group->pluck('id')->values()->all());

        return [
            'sprints' => $sprints
                ->filter(fn (TeamSprint $sprint): bool => $itemIds->has($sprint->id) || $this->state($sprint, $today) === 'current')
                ->reverse()
                ->map(fn (TeamSprint $sprint): array => [
                    ...$sprint->present(),
                    'teamId' => $sprint->team_id,
                    'state' => $this->state($sprint, $today),
                    'itemIds' => $itemIds->get($sprint->id, []),
                ])
                ->values()
                ->all(),
            'withoutSprint' => $itemIds->get('', []),
        ];
    }

    /**
     * @param  Collection<int, TeamSprint>  $sprints
     */
    private function sprintOf(Collection $sprints, ActionItem $item): ?TeamSprint
    {
        $day = $this->createdOn($item);

        return $sprints->first(fn (TeamSprint $sprint): bool => $sprint->team_id === $item->team_id
            && $sprint->starts_on->toDateString() <= $day
            && $sprint->ends_on->toDateString() >= $day);
    }

    /**
     * Only sprints that started are read: one that ended before today is finished.
     */
    private function state(TeamSprint $sprint, string $today): string
    {
        return $sprint->ends_on->toDateString() < $today ? 'finished' : 'current';
    }

    /**
     * The day in the application's time zone, as ActionItem::today() reads today.
     */
    private function createdOn(ActionItem $item): string
    {
        return ($item->created_at ?? now())->timezone(config('app.timezone'))->toDateString();
    }
}
```

The key `''` holds the rows created outside every sprint (`withoutSprint`).

`WorkspaceActionItemsController`: inject `private ActionItemSprints $actionItemSprints` in the constructor (after `ListExportSources`); in `items()`, after `'nextPageUrl' => …`, spread the sprints:

```php
            ...$this->actionItemSprints->forPage($page->items()),
```

and add `sprints: array<int, array<string, mixed>>, withoutSprint: array<int, string>` to its docblock shape (`use App\Actions\ActionItems\ActionItemSprints;`).

- [ ] **Step 4: Run the tests on PostgreSQL**

Run: `bin/test-db pgsql -- tests/Feature/ActionItems tests/Arch`.
Expected: PASS. An existing page test that compares the whole `items` prop with `toBe` (none at drafting time; `grep -rn "\['items'\]" tests/Feature/ActionItems`) fails on the two new keys: report it, do not edit it.

- [ ] **Step 5: Commit**

```bash
git add app/Actions/ActionItems/ActionItemSprints.php app/Http/Controllers/WorkspaceActionItemsController.php tests/Feature/ActionItems/ActionItemSprintsTest.php
git commit -m "feat(action-items): the sprints of the page's rows (P24-03)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 22 (Step B, after Task 10): "Actions · n overdue" in the sidebar (P24-08)

**Files:** modify `resources/js/components/skrum/app-sidebar.tsx` and `app-sidebar.test.tsx`.

**Mockup:** ScreenActions, sidebar: `<span class="sk-badge sk-badge--destructive sk-badge--pill">2 en retard</span>`.

- [ ] **Step 1: Write the failing tests** — append to `app-sidebar.test.tsx`, in the describe block that holds "shows the overdue badge with an accessible name" (reuse its `renderSidebar`):

```tsx
    it('words the overdue count in the badge, as the mockup', () => {
        renderSidebar({ overdueActions: 3 });

        expect(screen.getByText('3 overdue').className).not.toContain('sr-only');
    });

    it('words a count above 99 as 99+ and keeps the full count for screen readers', () => {
        renderSidebar({ overdueActions: 120 });

        expect(screen.getByText('99+ overdue')).toBeTruthy();
        expect(screen.getByText('120 overdue').className).toContain('sr-only');
    });
```

The existing cases ("shows the overdue badge with an accessible name", "caps the visible overdue count and keeps the full count for screen readers", "hides the badge when nothing is overdue", the dot cases) keep passing unchanged: each text is found once.

- [ ] **Step 2: Run them to see them fail** — `npm run test -- resources/js/components/skrum/app-sidebar`. Expected: FAIL (the visible badge reads `3`; `3 overdue` is the screen-reader span).

- [ ] **Step 3: Implement** — in `NavEntries`, replace the content of `SidebarMenuBadge` and add `whitespace-nowrap` to its class:

```tsx
                        {hasOverdue && (
                            <SidebarMenuBadge className="rounded-full bg-destructive px-1.5 whitespace-nowrap text-destructive-foreground tabular-nums peer-hover/menu-button:text-destructive-foreground">
                                {overdueActions > 99 ? (
                                    <>
                                        <span aria-hidden>
                                            {t(':count overdue', {
                                                count: '99+',
                                            })}
                                        </span>
                                        <span className="sr-only">
                                            {overdueLabel}
                                        </span>
                                    </>
                                ) : (
                                    overdueLabel
                                )}
                            </SidebarMenuBadge>
                        )}
```

The link's `aria-label` ("Actions, 3 overdue") and the collapsed dot do not change. The menu label "Actions" truncates before the badge if a language makes it long (the label already has `truncate`).

- [ ] **Step 4: Gates** — `npm run test -- resources/js/components/skrum/app-sidebar resources/js/layouts`, `npm run types:check`, `npm run check`, `npm run build:front`. Expected: PASS.

- [ ] **Step 5: Commit** — `feat(skrum): the sidebar names the overdue actions in words (P24-08)` with the trailer lines of **Global Constraints**.

### Task 23 (lane Grouping): "By sprint" grouping, the default (P24-03)

**Mockup:** ScreenActions: "Grouper par" Sprint / Équipe / Responsable / Aucun (Sprint on); group rows `Sprint 42 · en cours · 6 actions · 22 sept. → 3 oct.` and `Sprint 41 · terminé · 4 actions reportées · 2 en retard`; phone: "liste d'ActionItem groupée par sprint".

**Files:** create `components/action-items/action-item-group-meta.tsx` and its test; modify `lib/action-items/grouping.ts` and `grouping.test.ts`, `components/action-items/use-action-item-filters.ts` and its test, `action-items-header.tsx` and its test, `action-items-table.tsx`, `action-items-list.tsx` (the count of a group row becomes `ActionItemGroupMeta`), `action-items-page.tsx` (the `groupItems` call and the `items` type), and the tests of the table and the list.

**Interfaces:**
- Consumes: `items.sprints` and `items.withoutSprint` (Task 21); `formatShortDate(iso, locale)` (`lib/action-items/format.ts`); `Badge` (`variant` `info`, `muted`, `destructive`, `shape="pill"`); `ActionItem.isOverdue`, `isOpenStatus` (Task 10).
- Produces (`lib/action-items/grouping.ts`): `ActionItemGrouping = 'sprint' | 'team' | 'assignee' | 'none'`; `ActionItemGroupings` in that order; `DefaultGrouping = 'sprint'`; `ActionItemSprint = { id; number; startsOn; endsOn; teamId; state: 'current' | 'finished'; itemIds: string[] }`; `SprintPage = { sprints: ActionItemSprint[]; withoutSprint: string[] }`; `sprintOfItem(item, page): ActionItemSprint | null`; `ActionItemGroup.sprint?: ActionItemSprint | null`; `ActionItemGroupLabels.sprint?` and `noSprint?` (optional, so the existing label fixtures still type); `groupItems(items, by, labels, page = { sprints: [], withoutSprint: [] })`; `ActionItemGroupMeta({ group, countLabel })`.

- [ ] **Step 1: Write the failing tests**

Append to `resources/js/lib/action-items/grouping.test.ts` (import `sprintOfItem` and the type `ActionItemSprint` with the others):

```ts
describe('grouping by sprint', () => {
    const sprint = (
        id: string,
        number: number,
        teamId: string,
        state: ActionItemSprint['state'],
        itemIds: string[],
    ): ActionItemSprint => ({
        id,
        number,
        startsOn: '2026-09-21',
        endsOn: '2026-10-04',
        teamId,
        state,
        itemIds,
    });
    const sprintLabels: ActionItemGroupLabels = {
        ...labels,
        sprint: (found, withTeam) =>
            withTeam ? `${found.teamId} · Sprint ${found.number}` : `Sprint ${found.number}`,
        noSprint: 'No sprint',
    };
    const rows = [
        actionItemFixture({ id: 'a', teamId: 't1' }),
        actionItemFixture({ id: 'b', teamId: 't1' }),
        actionItemFixture({ id: 'c', teamId: 't1' }),
        actionItemFixture({ id: 'd', teamId: 't1' }),
    ];

    it('groups in the order of the sprints, keeps the order of the rows, and puts "No sprint" last', () => {
        const page = {
            sprints: [sprint('s42', 42, 't1', 'current', ['c']), sprint('s41', 41, 't1', 'finished', ['a', 'd'])],
            withoutSprint: ['b'],
        };

        expect(shape(groupItems(rows, 'sprint', sprintLabels, page))).toEqual([
            { key: 'sprint-s42', label: 'Sprint 42', ids: ['c'] },
            { key: 'sprint-s41', label: 'Sprint 41', ids: ['a', 'd'] },
            { key: 'no-sprint', label: 'No sprint', ids: ['b'] },
        ]);
    });

    it('names the team when the page spans several teams', () => {
        const page = {
            sprints: [sprint('s42', 42, 't1', 'current', ['a']), sprint('n42', 42, 't2', 'current', ['e'])],
            withoutSprint: [],
        };
        const twoTeams = [rows[0], actionItemFixture({ id: 'e', teamId: 't2' })];

        expect(shape(groupItems(twoTeams, 'sprint', sprintLabels, page)).map((group) => group.label)).toEqual([
            't1 · Sprint 42',
            't2 · Sprint 42',
        ]);
    });

    it('places a live row in its team\'s current sprint', () => {
        const page = { sprints: [sprint('s42', 42, 't1', 'current', [])], withoutSprint: ['a'] };

        expect(sprintOfItem(rows[0], page)).toBeNull();
        expect(sprintOfItem(rows[1], page)?.id).toBe('s42');
        expect(sprintOfItem(actionItemFixture({ id: 'x', teamId: 't9' }), page)).toBeNull();
    });

    it('draws no group row when no row of the page has a sprint', () => {
        expect(shape(groupItems(rows, 'sprint', sprintLabels, { sprints: [], withoutSprint: ['a', 'b', 'c', 'd'] }))).toEqual([
            { key: 'all', label: '', ids: ['a', 'b', 'c', 'd'] },
        ]);
    });
});
```

(`shape` and `labels` are the helpers at the top of the file; if `shape` does not keep `key`, compare the fields it keeps. If `actionItemFixture` does not take `teamId`, pass it the way the existing cases build team rows.)

In the same file, the existing case "accepts the three groupings and nothing else" becomes "accepts the four groupings and nothing else" and gains `expect(isActionItemGrouping('sprint')).toBe(true);` — name it in the commit message.

`components/action-items/action-item-group-meta.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActionItemGroupMeta } from '@/components/action-items/action-item-group-meta';
import { actionItemFixture } from '@/test/action-items';
import { renderWithProviders } from '@/test/render';

const countLabel = (count: number) => `${count} items`;
const sprint = {
    id: 's42',
    number: 42,
    startsOn: '2026-09-21',
    endsOn: '2026-10-04',
    teamId: 't1',
    itemIds: [],
};

describe('ActionItemGroupMeta', () => {
    it('reads a current sprint as in progress, with its count and days', () => {
        renderWithProviders(
            <ActionItemGroupMeta
                countLabel={countLabel}
                group={{
                    key: 'sprint-s42',
                    label: 'Sprint 42',
                    sprint: { ...sprint, state: 'current' },
                    items: [actionItemFixture({ id: 'a' }), actionItemFixture({ id: 'b' })],
                }}
            />,
        );

        expect(screen.getByText('In progress')).toBeTruthy();
        expect(screen.getByText(/^2 action items · /)).toBeTruthy();
    });

    it('reads a finished sprint with what was carried over and what is overdue', () => {
        renderWithProviders(
            <ActionItemGroupMeta
                countLabel={countLabel}
                group={{
                    key: 'sprint-s41',
                    label: 'Sprint 41',
                    sprint: { ...sprint, id: 's41', number: 41, state: 'finished' },
                    items: [
                        actionItemFixture({ id: 'a', status: 'open', isOverdue: true }),
                        actionItemFixture({ id: 'b', status: 'doing', isOverdue: false }),
                        actionItemFixture({ id: 'c', status: 'completed', isOverdue: false }),
                    ],
                }}
            />,
        );

        expect(screen.getByText('Finished')).toBeTruthy();
        expect(screen.getByText('2 carried over')).toBeTruthy();
        expect(screen.getByText('1 overdue')).toBeTruthy();
    });

    it('counts the rows of any other group as today', () => {
        renderWithProviders(
            <ActionItemGroupMeta
                countLabel={countLabel}
                group={{ key: 'no-sprint', label: 'No sprint', sprint: null, items: [actionItemFixture({ id: 'a' })] }}
            />,
        );

        expect(screen.getByText('1 items')).toBeTruthy();
        expect(screen.queryByText('In progress')).toBeNull();
    });
});
```

(Read `resources/js/test/` for the exact names of the render helper and the fixture; the paths above are the ones the existing action-items tests import.)

`use-action-item-filters.test.ts`, the existing expectations that change (name each in the commit message):
- "reads the grouping and falls back to none" becomes "reads the grouping and falls back to sprint": `storedGrouping({ group: 'status' })` and `storedGrouping(null)` are `'sprint'`.
- The case that ends with `setGrouping('none')` and expects `{ team: 'team-1' }` now calls `setGrouping('sprint')` (the default is not stored), and gains `act(() => result.current.setGrouping('none'));` then `expect(stored()).toEqual({ team: 'team-1', group: 'none' });`.
- The reset case expects `result.current.grouping` to be `'sprint'`.

`action-items-header.test.tsx`: "offers Team, Assignee and None, in that order, and no Status" becomes "offers Sprint, Team, Assignee and None, in that order, and no Status", expecting `['Sprint', 'Team', 'Assignee', 'None']`.

Table and list tests (`action-items-table.test.tsx`, `action-items-list.test.tsx`), one case each: with a sprint group (`sprint` set, `state: 'finished'`, one overdue open row), the group row shows the label, "Finished", "1 carried over" and "1 overdue", and the fold button still folds its rows.

- [ ] **Step 2: Run them to see them fail** — `npm run test -- resources/js/lib/action-items/grouping resources/js/components/action-items`. Expected: FAIL.

- [ ] **Step 3: Implement**

`resources/js/lib/action-items/grouping.ts` (whole file):

```ts
import { assigneeValue } from '@/lib/action-items/assignees';
import type { ActionItem, ActionItemAssignee } from '@/lib/retro/types';

export type ActionItemGrouping = 'sprint' | 'team' | 'assignee' | 'none';

/** In the order of the control: the mockup starts on "Sprint" and ends on "None". */
export const ActionItemGroupings: ActionItemGrouping[] = [
    'sprint',
    'team',
    'assignee',
    'none',
];

/** The page lands grouped by sprint (P24-03). */
export const DefaultGrouping: ActionItemGrouping = 'sprint';

/** A sprint of the page, as `items.sprints` sends it (spec 24 §6.8). */
export type ActionItemSprint = {
    id: string;
    number: number;
    startsOn: string;
    endsOn: string;
    teamId: string;
    state: 'current' | 'finished';
    itemIds: string[];
};

export type SprintPage = {
    sprints: ActionItemSprint[];
    withoutSprint: string[];
};

export type ActionItemGroup = {
    key: string;
    label: string;
    items: ActionItem[];
    /** Set when grouped by sprint: the sprint, or null for "No sprint". */
    sprint?: ActionItemSprint | null;
};

export type ActionItemGroupLabels = {
    team: (teamId: string) => string;
    assignee: (assignee: ActionItemAssignee | null) => string;
    sprint?: (sprint: ActionItemSprint, withTeam: boolean) => string;
    noSprint?: string;
};

const NoSprints: SprintPage = { sprints: [], withoutSprint: [] };

export function isActionItemGrouping(
    value: unknown,
): value is ActionItemGrouping {
    return ActionItemGroupings.some((grouping) => grouping === value);
}

/**
 * The sprint the server placed the row in; a row it did not send (created live)
 * goes to its team's current sprint until the next reload.
 */
export function sprintOfItem(
    item: ActionItem,
    page: SprintPage,
): ActionItemSprint | null {
    const placed = page.sprints.find((sprint) =>
        sprint.itemIds.includes(item.id),
    );

    if (placed !== undefined) {
        return placed;
    }

    if (page.withoutSprint.includes(item.id)) {
        return null;
    }

    return (
        page.sprints.find(
            (sprint) =>
                sprint.teamId === item.teamId && sprint.state === 'current',
        ) ?? null
    );
}

function groupBySprint(
    items: ActionItem[],
    labels: ActionItemGroupLabels,
    page: SprintPage,
): ActionItemGroup[] {
    const placed = items.map((item) => ({
        item,
        sprint: sprintOfItem(item, page),
    }));

    if (placed.every(({ sprint }) => sprint === null)) {
        return [{ key: 'all', label: '', items }];
    }

    const withTeam = new Set(items.map((item) => item.teamId)).size > 1;
    const groups: ActionItemGroup[] = page.sprints
        .map((sprint) => ({
            key: `sprint-${sprint.id}`,
            label:
                labels.sprint?.(sprint, withTeam) ?? String(sprint.number),
            sprint,
            items: placed
                .filter((entry) => entry.sprint?.id === sprint.id)
                .map(({ item }) => item),
        }))
        .filter((group) => group.items.length > 0);
    const rest = placed
        .filter(({ sprint }) => sprint === null)
        .map(({ item }) => item);

    if (rest.length === 0) {
        return groups;
    }

    return [
        ...groups,
        {
            key: 'no-sprint',
            label: labels.noSprint ?? '',
            sprint: null,
            items: rest,
        },
    ];
}

/**
 * The rows of the current page under one header per sprint, team or assignee.
 * By team and by assignee, groups come in the order of their first row; by
 * sprint, in the order of the page's sprints (latest first), "No sprint" last.
 * Rows keep the order the server gave; "none" is one group without a label.
 */
export function groupItems(
    items: ActionItem[],
    by: ActionItemGrouping,
    labels: ActionItemGroupLabels,
    page: SprintPage = NoSprints,
): ActionItemGroup[] {
    if (items.length === 0) {
        return [];
    }

    if (by === 'none') {
        return [{ key: 'all', label: '', items }];
    }

    if (by === 'sprint') {
        return groupBySprint(items, labels, page);
    }

    const groups = new Map<string, ActionItemGroup>();

    for (const item of items) {
        const key = by === 'team' ? item.teamId : assigneeValue(item.assignee);
        const group = groups.get(key);

        if (group) {
            group.items.push(item);

            continue;
        }

        groups.set(key, {
            key,
            label:
                by === 'team'
                    ? labels.team(item.teamId)
                    : labels.assignee(item.assignee),
            items: [item],
        });
    }

    return [...groups.values()];
}
```

`components/action-items/action-item-group-meta.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { formatShortDate } from '@/lib/action-items/format';
import type { ActionItemGroup } from '@/lib/action-items/grouping';
import { isOpenStatus } from '@/lib/action-items/status';

/**
 * What follows the label of a group row. A sprint reads as the mockup's
 * "en cours · 6 actions · 22 sept. → 3 oct." or "terminé · 4 actions
 * reportées · 2 en retard"; any other group counts its rows.
 */
export function ActionItemGroupMeta({
    group,
    countLabel,
}: {
    group: ActionItemGroup;
    countLabel: (count: number) => string;
}) {
    const { t, locale } = useTrans();
    const sprint = group.sprint ?? null;

    if (sprint === null) {
        return (
            <span className="font-medium text-muted-foreground">
                {countLabel(group.items.length)}
            </span>
        );
    }

    const open = group.items.filter((item) => isOpenStatus(item.status));
    const overdue = open.filter((item) => item.isOverdue).length;
    const isCurrent = sprint.state === 'current';
    const days = `${formatShortDate(sprint.startsOn, locale)} → ${formatShortDate(sprint.endsOn, locale)}`;
    const count = group.items.length;
    let summary = countLabel(count);

    if (isCurrent) {
        summary =
            count === 1
                ? t('1 action item · :start → :end', {
                      start: formatShortDate(sprint.startsOn, locale),
                      end: formatShortDate(sprint.endsOn, locale),
                  })
                : t(':count action items · :start → :end', {
                      count,
                      start: formatShortDate(sprint.startsOn, locale),
                      end: formatShortDate(sprint.endsOn, locale),
                  });
    }

    if (!isCurrent && open.length > 0) {
        summary =
            open.length === 1
                ? t('1 carried over')
                : t(':count carried over', { count: open.length });
    }

    return (
        <>
            <Badge variant={isCurrent ? 'info' : 'muted'} shape="pill">
                {isCurrent ? t('In progress') : t('Finished')}
            </Badge>
            <span className="font-medium text-muted-foreground" title={days}>
                {summary}
            </span>
            {overdue > 0 && (
                <Badge variant="destructive" shape="pill">
                    {t(':count overdue', { count: overdue })}
                </Badge>
            )}
        </>
    );
}
```

Read `hooks/use-trans` for how the locale is exposed (the table formats its due dates with it) and `formatShortDate`'s output ("21 Sep"); the mockup's "22 sept." is that format in French. The `let summary` with two overriding `if` keeps the happy path last; rewrite it as a small pure function `sprintSummary(...)` in the same file if the linter prefers.

`action-items-table.tsx` and `action-items-list.tsx`: the group row's `<span className="font-medium text-muted-foreground">{countLabel(group.items.length)}</span>` becomes `<ActionItemGroupMeta group={group} countLabel={countLabel} />`. Nothing else of the row changes (the Bulk lane adds its box in the first cell; the controller keeps both at the merge).

`use-action-item-filters.ts`: import `DefaultGrouping`; `storedGrouping()` falls back to `DefaultGrouping`; `withGrouping()` stores nothing when `grouping === DefaultGrouping`; `reset()` sets `DefaultGrouping`; `isDefault` compares with `DefaultGrouping`. The doc comment of `reset` reads "the current team, the open items and the grouping by sprint".

`action-items-header.tsx`: `groupingLabels` gains `sprint: t('Sprint')`; the doc comment drops the sentence about a later sprint grouping.

`action-items-page.tsx`: the `items` prop type gains `sprints?: ActionItemSprint[]; withoutSprint?: string[]` (optional: a page fixture without them still types); the `groupItems` call becomes

```tsx
    const groups = groupItems(
        rows,
        filtering.grouping,
        {
            team: (teamId) => teamsById.get(teamId)?.name ?? t('Team'),
            assignee: (assignee) => {
                const owner = toActionItemOwner(assignee);

                return owner === null
                    ? t('Unassigned')
                    : labels.ownerName(owner);
            },
            sprint: (sprint, withTeam) =>
                withTeam
                    ? t(':team · Sprint :number', {
                          team: teamsById.get(sprint.teamId)?.name ?? t('Team'),
                          number: sprint.number,
                      })
                    : t('Sprint :number', { number: sprint.number }),
            noSprint: t('No sprint'),
        },
        {
            sprints: items.sprints ?? [],
            withoutSprint: items.withoutSprint ?? [],
        },
    );
```

`lang/*.json`: "Sprint", "Sprint :number", ":team · Sprint :number", "Finished", "No sprint", "1 action item · :start → :end", ":count action items · :start → :end", "1 carried over", ":count carried over" (values in Task 17).

- [ ] **Step 4: Run the tests and the gates** — `npm run test -- resources/js/lib/action-items resources/js/components/action-items`, `npm run types:check`, `npm run check`, `npm run build:front`. Expected: PASS.

- [ ] **Step 5: Commit** — `feat(action-items): group by sprint, the default (P24-03)`, listing in the message the five existing expectations changed (grouping, filters hook ×3, header), with the trailer lines.

### Task 24 (lane Search): The topbar search field (P24-07)

**Mockup:** ScreenActions, topbar: `sk-input-group` 18.75rem, lucide `search`, placeholder "Rechercher une action, un ticket…", `sk-kbd` "⌘K" at the end.

**Files:** create `lib/action-items/search.ts` and its test, `components/action-items/action-item-search-field.tsx` and its test; modify `layouts/skrum/app-layout.tsx`, `components/workspaces/command-menu.tsx`, `components/ui/command.tsx` (`CommandPalette` gains `toggleShortcut`), `pages/action-items/index.tsx`, `components/action-items/action-items-page.tsx` (subscription and empty-state condition), `action-item-filters-drawer.tsx` (the field at its top), `use-action-item-filters.ts` (`q`) and their tests.

**Interfaces:**
- Consumes: `filters.q` (Task 20); `useActionItemFilters().apply` (`{ q }` is one more change); `detectPlatform` (`components/skrum/keyboard-shortcuts`), `Kbd`, `useShortcut(keys, handler, { enabled, enableOnFormTags })`, `useEffectEvent` (React 19.2).
- Produces: `actionItemsSearchEvent`, `requestActionItemsSearch(term: string | null): void`, `useActionItemsSearchRequests(onSearch: (term: string | null) => void): void` (`lib/action-items/search.ts`); `ActionItemSearchField({ value, onSearch, shortcut = true, className })`; `AppLayout`'s new prop `search?: ReactNode`; `CommandMenu`'s new props `wideTrigger = true`, `toggleShortcut = true`; `CommandPalette`'s new prop `toggleShortcut = true`; `ActionItemFilters.q?: string | null` in `use-action-item-filters.ts`.

- [ ] **Step 1: Write the failing tests**

`resources/js/lib/action-items/search.test.ts`:

```ts
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    requestActionItemsSearch,
    useActionItemsSearchRequests,
} from '@/lib/action-items/search';

describe('action items search requests', () => {
    it('hands the term from the topbar to the page', () => {
        const onSearch = vi.fn();
        const { unmount } = renderHook(() => useActionItemsSearchRequests(onSearch));

        requestActionItemsSearch('runbook');
        requestActionItemsSearch(null);

        expect(onSearch.mock.calls).toEqual([['runbook'], [null]]);

        unmount();
        requestActionItemsSearch('later');

        expect(onSearch).toHaveBeenCalledTimes(2);
    });
});
```

`components/action-items/action-item-search-field.test.tsx`:

```tsx
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionItemSearchField } from '@/components/action-items/action-item-search-field';
import { renderWithProviders } from '@/test/render';

describe('ActionItemSearchField', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const field = () =>
        screen.getByRole('searchbox', { name: 'Search action items' });

    it('shows the mockup placeholder and the shortcut', () => {
        renderWithProviders(<ActionItemSearchField value={null} onSearch={vi.fn()} />);

        expect(field().getAttribute('placeholder')).toBe('Search an action item, a ticket…');
        expect(screen.getByText(/K$/)).toBeTruthy();
    });

    it('applies the term 300 ms after the last key, trimmed', () => {
        const onSearch = vi.fn();
        renderWithProviders(<ActionItemSearchField value={null} onSearch={onSearch} />);

        fireEvent.change(field(), { target: { value: 'run' } });
        act(() => vi.advanceTimersByTime(200));
        fireEvent.change(field(), { target: { value: 'runbook ' } });
        act(() => vi.advanceTimersByTime(299));

        expect(onSearch).not.toHaveBeenCalled();

        act(() => vi.advanceTimersByTime(1));

        expect(onSearch).toHaveBeenCalledExactlyOnceWith('runbook');
    });

    it('applies at once on Enter, and Escape clears', () => {
        const onSearch = vi.fn();
        renderWithProviders(<ActionItemSearchField value="runbook" onSearch={onSearch} />);

        fireEvent.change(field(), { target: { value: 'wiki' } });
        fireEvent.keyDown(field(), { key: 'Enter' });

        expect(onSearch).toHaveBeenLastCalledWith('wiki');

        fireEvent.keyDown(field(), { key: 'Escape' });

        expect(onSearch).toHaveBeenLastCalledWith(null);
        expect((field() as HTMLInputElement).value).toBe('');
    });

    it('focuses on mod+K, a field included, unless its shortcut is off', () => {
        const { unmount } = renderWithProviders(
            <>
                <input aria-label="Other" />
                <ActionItemSearchField value={null} onSearch={vi.fn()} />
            </>,
        );

        screen.getByLabelText('Other').focus();
        fireEvent.keyDown(screen.getByLabelText('Other'), { key: 'k', metaKey: true, ctrlKey: true });

        expect(document.activeElement).toBe(field());

        unmount();
        renderWithProviders(<ActionItemSearchField value={null} onSearch={vi.fn()} shortcut={false} />);
        fireEvent.keyDown(document.body, { key: 'k', metaKey: true, ctrlKey: true });

        expect(document.activeElement).not.toBe(field());
    });

    it('takes a value changed elsewhere (Reset) without losing what is being typed', () => {
        const onSearch = vi.fn();
        const { rerender } = renderWithProviders(<ActionItemSearchField value={null} onSearch={onSearch} />);

        fireEvent.change(field(), { target: { value: 'runbook' } });
        act(() => vi.advanceTimersByTime(300));
        fireEvent.change(field(), { target: { value: 'runbook wiki' } });
        rerender(<ActionItemSearchField value="runbook" onSearch={onSearch} />);

        expect((field() as HTMLInputElement).value).toBe('runbook wiki');

        rerender(<ActionItemSearchField value={null} onSearch={onSearch} />);

        expect((field() as HTMLInputElement).value).toBe('');
    });
});
```

(`fireEvent.keyDown` with both `metaKey` and `ctrlKey` matches `mod` on either platform; read `hooks/use-shortcut.ts` and use the event shape its own tests use if it differs. `renderWithProviders` returns `rerender` as Testing Library's `render` does; if it wraps providers, rerender through the same wrapper.)

`use-action-item-filters.test.ts`, new case:

```ts
it('writes the search into the query and counts it as a filter', () => {
    const base: ActionItemFilters = {
        status: ['todo', 'doing'],
        priority: [],
        due: null,
        source: null,
        assignee: null,
        team: null,
        item: null,
    };

    expect(filterQuery({ ...base, q: 'runbook' })).toEqual({ q: 'runbook' });
    expect(filterQuery({ ...base, q: null })).toEqual({});
    expect(activeFilterCount({ ...base, q: 'runbook' })).toBe(1);
});
```

(`import type { ActionItemFilters } from '@/components/action-items/use-action-item-filters';` at the top if the file does not import it yet.)

`app-layout` (a new `resources/js/layouts/skrum/app-layout.test.tsx` if none exists, else a case in it): with `search={<input aria-label="Page search" />}` the topbar holds that field and the palette's compact button, not the wide "Search…" button; pressing `/` still opens the palette (`screen.getByRole('dialog')`), and mod+K does not; without `search` the topbar is as before (the wide button is there and mod+K opens the palette). Mock `usePage` as the existing layout or command-menu tests do (read `command-menu.test.tsx`).

`action-items-page.test.tsx`, new case: `requestActionItemsSearch('runbook')` visits the page with `q=runbook` (assert on the mocked `router.get` URL as the existing filter cases do); with `filters.q` set and no item, the empty state is "Nothing matches these filters.".

- [ ] **Step 2: Run them to see them fail** — `npm run test -- resources/js/lib/action-items/search resources/js/components/action-items resources/js/layouts resources/js/components/workspaces/command-menu`. Expected: FAIL.

- [ ] **Step 3: Implement**

`resources/js/lib/action-items/search.ts`:

```ts
import { useEffect, useEffectEvent } from 'react';

/**
 * The topbar is drawn by the layout, outside the page that owns the filters:
 * its field hands the term over through a window event, as the palette and the
 * shortcuts dialog are opened (`lib/shortcuts/events`).
 */
export const actionItemsSearchEvent = 'skrum:action-items-search';

export function requestActionItemsSearch(term: string | null): void {
    window.dispatchEvent(
        new CustomEvent<string | null>(actionItemsSearchEvent, {
            detail: term,
        }),
    );
}

export function useActionItemsSearchRequests(
    onSearch: (term: string | null) => void,
): void {
    const handle = useEffectEvent((term: string | null) => onSearch(term));

    useEffect(() => {
        const listener = (event: Event) =>
            handle((event as CustomEvent<string | null>).detail);

        window.addEventListener(actionItemsSearchEvent, listener);

        return () =>
            window.removeEventListener(actionItemsSearchEvent, listener);
    }, []);
}
```

`components/action-items/action-item-search-field.tsx`:

```tsx
import { Search } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import type { KeyboardEvent } from 'react';
import { detectPlatform } from '@/components/skrum/keyboard-shortcuts';
import { Kbd } from '@/components/ui/kbd';
import { useShortcut } from '@/hooks/use-shortcut';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

const SearchDelayMs = 300;

function subscribeToNothing(): () => void {
    return () => {};
}

function termOf(text: string): string | null {
    const term = text.trim();

    return term === '' ? null : term;
}

/**
 * The mockup's search of the action items page (P24-07): the list follows the
 * field 300 ms after the last key; mod+K focuses it on this page.
 */
export function ActionItemSearchField({
    value,
    onSearch,
    shortcut = true,
    className,
}: {
    value: string | null;
    onSearch: (term: string | null) => void;
    shortcut?: boolean;
    className?: string;
}) {
    const { t } = useTrans();
    const input = useRef<HTMLInputElement>(null);
    const [draft, setDraft] = useState(value ?? '');
    const [sent, setSent] = useState<string | null>(value);
    const [seen, setSeen] = useState<string | null>(value);
    const platform = useSyncExternalStore(
        subscribeToNothing,
        detectPlatform,
        () => 'mac' as const,
    );

    if (seen !== value) {
        setSeen(value);

        if (value !== sent) {
            setSent(value);
            setDraft(value ?? '');
        }
    }

    const submit = (term: string | null): void => {
        setSent(term);
        onSearch(term);
    };
    const submitLater = useEffectEvent((term: string | null) => submit(term));

    useEffect(() => {
        const term = termOf(draft);

        if (term === sent) {
            return;
        }

        const timer = window.setTimeout(
            () => submitLater(term),
            SearchDelayMs,
        );

        return () => window.clearTimeout(timer);
    }, [draft, sent]);

    useShortcut(
        'mod+k',
        () => {
            input.current?.focus();
            input.current?.select();
        },
        { enabled: shortcut, enableOnFormTags: true },
    );

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === 'Enter') {
            submit(termOf(draft));

            return;
        }

        if (event.key !== 'Escape' || draft === '') {
            return;
        }

        event.stopPropagation();
        setDraft('');
        submit(null);
    };

    return (
        <div
            className={cn(
                'relative flex w-full min-w-0 items-center',
                className,
            )}
        >
            <Search
                aria-hidden
                className="pointer-events-none absolute start-3 size-4 text-muted-foreground"
            />
            <input
                ref={input}
                type="search"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
                aria-label={t('Search action items')}
                aria-keyshortcuts={shortcut ? 'Meta+K Control+K' : undefined}
                placeholder={t('Search an action item, a ticket…')}
                className="h-9 w-full min-w-0 rounded-md border border-input bg-background ps-9 pe-14 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {shortcut && (
                <Kbd aria-hidden className="pointer-events-none absolute end-2">
                    {platform === 'mac' ? '⌘K' : 'Ctrl K'}
                </Kbd>
            )}
        </div>
    );
}
```

Match the input's classes to `components/ui/input.tsx` (read it; use its class list for border, radius, height and focus ring rather than the list above when they differ) and the width to the palette's button (`AppTopbar` gives the place 10rem to 16.25rem). Setting state during render on a changed `value` is React's documented pattern for "adjusting state when a prop changes"; if the linter refuses it, move the three lines into the `key` of the field instead (`key={value ?? ''}` on the layout's side would lose the focus while typing, so prefer the pattern).

`components/ui/command.tsx`, `CommandPalette`: a new prop `toggleShortcut?: boolean` (default `true`, documented "mod+K opens and closes the palette; off where a page gives mod+K to its own field"); the line `useShortcut("mod+k", () => onOpenChange(!open), { enableInOverlays: true })` gains `enabled: toggleShortcut`. Its test gains one case: with `toggleShortcut={false}`, mod+K does not open it and "/" still does.

`components/workspaces/command-menu.tsx`: `CommandMenu({ links, wideTrigger = true, toggleShortcut = true })`; the wide outline button renders only when `wideTrigger`; `<CommandPalette … toggleShortcut={toggleShortcut} />`.

`layouts/skrum/app-layout.tsx`: a prop `search?: ReactNode` ("The page's own search, in the topbar's search place; the palette stays on '/' and its compact button."); the topbar's `search` becomes

```tsx
                    search={
                        search === undefined ? (
                            <CommandMenu links={sidebar.links} />
                        ) : (
                            <>
                                {search}
                                <CommandMenu
                                    links={sidebar.links}
                                    wideTrigger={false}
                                    toggleShortcut={false}
                                />
                            </>
                        )
                    }
```

`pages/action-items/index.tsx`: `<AppLayout … search={<ActionItemSearchField value={filters.q ?? null} onSearch={requestActionItemsSearch} className="hidden md:flex" />}>`.

`action-items-page.tsx`: `useActionItemsSearchRequests((term) => filtering.apply({ q: term }));` after `filtering` is built; `nothingOpen` gains `&& !filters.q`. The selection's `filtersKey` (Task 13) must change with `q` so that a search clears the selection and "all matching" mode (spec §9.1): if Task 13 built it from `filterQuery(filters)`, it does already; otherwise add `q` to it, with a case in `action-items-page.test.tsx`.

`action-item-filters-drawer.tsx`: at the top of the drawer's body, `<ActionItemSearchField value={filters.q ?? null} onSearch={(term) => onChange({ q: term })} shortcut={false} />` (use the drawer's own change callback name; read the file).

`use-action-item-filters.ts`: `ActionItemFilters` gains `q?: string | null`; `filterQuery()` writes `q` when it is a non-empty string; `activeFilterCount()` counts it; `isDefault` requires `!filters.q`. `ActionItemFilterChanges` accepts `q` (it is `Partial<ActionItemFilters>` or lists its keys; follow it).

`lang/*.json`: "Search an action item, a ticket…", "Search action items" (values in Task 17).

- [ ] **Step 4: Run the tests and the gates** — `npm run test -- resources/js/lib/action-items resources/js/components/action-items resources/js/layouts resources/js/components/workspaces resources/js/components/ui/command`, `npm run types:check`, `npm run check`, `npm run build:front`. Expected: PASS.

- [ ] **Step 5: Commit** — `feat(action-items): the topbar search filters the list (P24-07)`, with the trailer lines.

---

## Self-review (done while revising on the owner's answers, then again on the pre-build deviation answers; kept for the reader)

**Spec coverage.** §5 rules 1, 2 → Tasks 6, 7, 8; rule 3 → Task 1; rule 4 → Tasks 5, 8, 9, 20 (`q`); rule 5 → Task 9 (and Task 20, "exports what the search finds"); rule 6 → Tasks 2, 3; rule 7 → Task 8 (and Task 20, `filters.q`). §6.1 status, transitions and `ActionItemProgressChanged` → Task 1; sub-tasks → Task 1; §6.2 three-state reads and sync state → Task 2, pushes and start targets → Task 3, release note → Task 18; §6.3 filters, old values, counters, MCP → Task 5, `fromQuery` → Task 5, the search and `external_key_search` → Task 20; §6.4 readers → Task 1 (presenter), Task 2 (link state, front type), Task 4 (settings presentation), Task 5 (MCP list); §6.5 bulk → Tasks 6, 7 (ids), 8 (filters and count), 13, 14 (front, sync loop on plan 21's `runBulkExport`); §6.6 export → Task 9 (server), 15 (button); §6.7 start settings → Task 4; §6.8 sprint of an item → Task 21 (server), Task 23 (front); §7 permissions → Tasks 6, 7, 8 (per item, through `ActionItemPermissions` with plan 23's roles), 4 (settings), 13 (selectable rows, enabled actions, assignees in "all matching" mode), 20 and 21 (search and sprints never reach an invisible team); §8 real time → Tasks 6, 7, 8 (events per item asserted), 13 (`saveRow` / `removeRow`, reload after "all matching"), 23 (a live row in its team's current sprint); §9.1 → 15 (Export), 24 (search field); §9.2 → 12 and 10 (chips), 23 and 24 (Reset with grouping and search); §9.3 → 13 (selection), 23 (group by sprint); §9.4 → 13, 14; §9.5 → 14, 23 (list grouped); §9.6, §9.7 → 11; §9.8 → 4; §9.9 → 16; §9.10 → 22; §10 → Task 1's and Task 20's upgrade tests, Task 18 (database notes); §12 measurement → Task 8 step 5 (with the cap rule). Acceptance criteria 1–4 → Task 1; 5 → 2; 6 → 3; 7 → 4; 8–11 → 5 (10 also Task 20); 12, 13 → 6; 14 → 6 and 8; 15 → 8; 16 → 6, 7, 8 (races, PostgreSQL); 17 → 7; 18 → 9; 19 → 13; 20 → 13, 14; 21, 22 → 14; 23 → 11; 24 → 16, 17; 25 → 19; 26 → 20 (and 24 for the front); 27 → 21; 28 → 23; 29 → 24; 30 → 22.

**Placeholder scan.** Each back-end step carries its code and tests (Tasks 20 and 21 included). The screen tasks carry composition, behaviours and test lists, as the project's screen tasks do; Tasks 22, 23 and 24 carry their code. Reading checks are written as instructions with the exact file to read and the alternative to apply: the search column of a legacy row (Tasks 1 and 20), the registration of listeners (Task 3), the page-props reading of "presents the sync state without secrets" and the "Complete to" Vitest case (Task 4), the external-link factory (Task 9), `retroRequest`'s error (Task 13), plan 21's loop (Task 14), writes of links past the model (Task 20), plan 23's `TeamSprint` (Task 21), the render helper, fixture, `useTrans` locale and input classes (Tasks 23, 24), the shortcut event shape (Task 24). The only blanks are the measured number(s) of Task 8's commit message, which the measurement fills; the cap rule decides without the owner.

**Type consistency.** `ActionItem::currentStatus()` (not `status()`) everywhere; `ActionItemStatus::Doing` value `doing` on both sides; `ExternalIssueState::Started` value `started` (fits `string(10)`), in PHP and in `ExternalLink.state`; `DoneMapping::itemState(ActionItem, IntegrationProvider)` in `ApplyIssueChanges`, `LinkStatusSync` and `PushActionItemState`; settings keys `startStatusId` / `startStateId` stored by Task 4 and read by Task 3 (`DoneMapping::configured`), request keys `start_status_id` / `start_state_id`; `ActionItemProgressChanged($actionItem, $origin, $actor)` fired in Task 1, listened in Task 3; filter token `todo` (server and front) distinct from the status value `open`; `ActionItemFilters::fromQuery()` (Task 5) used by `ActionItemBulkChanges::matching()` (Task 8); the search: query key `q` on the server (`ActionItemFilters::$search`, `toArray()['q']`, `FilterKeys`) and in the front (`ActionItemFilters.q`, `filterQuery`), so the export link and `matchingTarget` carry it with no change of Task 10's code; `ActionItemBulkChanges::update/delete` return `changed` and `refused` (`{id, title, message}`), the controllers answer `actionItems`, `changedCount` / `deleted` and `refused`, and `bulk.ts` types match; `BulkTarget` built by `matchingTarget()`; `MatchingCap` the same number on both sides (500, or the cap Task 8's rule sets on both); `items.sprints[]` keys `id, number, startsOn, endsOn, teamId, state ('current' | 'finished'), itemIds` and `items.withoutSprint` from `ActionItemSprints::forPage` (Task 21) to `ActionItemSprint` / `SprintPage` (Task 23); grouping value `sprint` and `DefaultGrouping` in `grouping.ts`, `use-action-item-filters.ts` and the header; route names `workspaces.actionItemBulkUpdates.store`, `workspaces.actionItemBulkDeletions.store`, `workspaces.actionItemCsvExports.show` in routes, tests and Wayfinder imports; migrations `2026_10_24_100000_…` and `2026_10_24_100100_…` in the files, the upgrade tests and the file list.

**Review Focus.** 1 → Task 5 ("reads the single values of before") and Task 10 (stored entry sent unchanged); 2 → Task 6 ("changes what it can and refuses the rest", titles); 3 → Tasks 6, 7, 8 races and Task 8 ("changes nothing when the list changed since the member counted it"); 4 → Task 2 and Task 3; 5 → Task 9 ("neutralises formulas"); 6 → Task 20; 7 → Tasks 21 and 23.

**Verification.** Every "Run the tests" step and Task 19 run PostgreSQL only (owner, 2026-10-03); no step starts MariaDB or MySQL; the four-engine matrix belongs to the controller after the last merge of the roadmap. Portability stays a rule of every line (Global Constraints) and `DatabasePortabilityTest` runs in every task that touches PHP.

**Dependencies.** The plan's base is `roadmap` after plan 23 (execution order 20, 21, 26, 27, 29 → 22 → 23 → 24 and 25): plan 23's sprints and roles, and plan 21's export loop, are consumed, not rebuilt; plan 25 runs beside it and only shares the translation, route and Pest helper files.

**What the answers changed, by task.** First revision (answers to §15): new Tasks 2, 3, 4, 8; changed Tasks 1, 5, 6, 10, 13, 14, 16 to 18; 16 → 19 tasks. Second revision (pre-build answers, PostgreSQL per plan, order after plan 23): new Tasks 20 (search, server), 21 (sprints, server), 22 (sidebar), 23 (grouping), 24 (search field); changed: Branch and run (base, checks, migration dates, merge into `roadmap`), Global Constraints (PostgreSQL only, migration date), every "Run the tests" step and Tasks 8 (cap rule), 13 (`:cap`), 14 (plan 21's loop), 16 (states, captures), 17 (keys), 18 (D-19, D-129, PB-12, database notes, release note), 19 (PostgreSQL suites); the Pre-build deviations table carries the answers. Task count: 19 → 24.
