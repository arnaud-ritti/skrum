# Action items: selection and bulk changes, priority / due-date / source filters, "In progress", export (Plan 24) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to run this plan task by task (through the Workflow tool, as the project does). Steps use checkbox (`- [ ]`) syntax. Every agent reads **Owner decisions**, **Global Constraints**, **Pre-build deviations** and its own task before anything else, then `docs/database.md` ("Rules for database code" and "Running the tests on an engine") for any task that touches PHP. A screen task also follows the "Screen task procedure" of `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, with the working rules below (no walkthrough, captures in Task 13 only).

**Status: draft of 2026-10-03, written on the recommended option of each question of spec §15.** Nothing runs before the owner has answered spec §15 and read the pre-build deviations. The table **Owner decisions** says which tasks change with another answer.

**Goal:** On the action items page a member selects rows and changes their status, assignee, due date or priority, sends them to the team's tracker, or deletes them, each item checked on its own; filters by several statuses, priorities, a due-date bucket and a source; marks items "In progress" anywhere an item's status is shown; and downloads the filtered list as CSV.

**Architecture:** "In progress" is a nullable `action_items.started_at` beside `completed_at`, which stays the one source of completion; `ActionItemStatus` gains `Doing`, `ActionItem::currentStatus()` derives the status, `SetActionItemStatus` handles the six transitions, and a tracker read promotes an open linked item whose issue is in progress. `ActionItemFilters` becomes lists and buckets read from the query (old single values mapped), and `ActionItemQuery` applies them to the list, the counters and the new CSV export. Two bulk endpoints loop over the single-item actions (`ApplyActionItemChanges`, `DeleteActionItem`), one transaction and one lock per item, and report refusals per item. The front fills the places plan 18e left in `ActionItemsPage` (`selectionCell`, `selectionHead`, `bulkBar`, `extraFacets`, `withDoing`, `NewActionItemButton.before`).

**Tech Stack:** Laravel 13, PHP 8.4, Pest (feature, unit, upgrade, arch, concurrency), Inertia 3, React 19, Tailwind 4, vite-plus (Vitest), Wayfinder, Reverb; PostgreSQL, MariaDB, MySQL and SQLite through `bin/test-db`; `Tests\Concurrency\Support\Race` for races. Run `composer show --direct` and read `package.json` before Task 1 and stop if a major differs.

**Spec:** `.superpowers/sdd/roadmap/plan-24/spec.md` (moves to `docs/superpowers/specs/2026-10-21-action-items-bulk-filters-status-export-design.md` in Task 15). Parent: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` §5. Mockups: `docs/design-system/components/ScreenActions`, `ActionItem`, `MobileDashboard`, `Checkbox`, `Popover`, `Command`, `DatePicker`, `DropdownMenu`, `Sonner` — for each, the `README.md` and the `preview.html`.

**Not in this plan:** the backlog of spec §3 (grouping by sprint, whiteboard and survey sources, the topbar search field, "select all matching" across pages, bulk on the retro board, pushing "In progress" to trackers, a webhook event for it, other export formats); browser walkthroughs (owner's working rule: none is written, edited or run); anything of the former plans 28 and 30 and scheduling.

**Tasks:** 16. Step A, back end, single writer: 1 to 6. Step B, front foundation, single writer: 7. Step C, screens, lanes: Status (8), Filters (9), Bulk (10, 11), Export (12). Final: 13 (bench and captures), 14 (translations), 15 (deviations and documents), 16 (four-engine suites and report).

## Branch and run

- Base: `main` at `18d3637e` or later (plans 18e to 18g, database portability, plan 19). Check before Task 1, and stop if one fails: `app/Enums/ActionItemStatus.php` has exactly `Open` and `Completed`; `resources/js/components/action-items/action-items-page.tsx` declares the slots `selectionCell`, `selectionHead`, `bulkBar`, `extraFacets`; `resources/js/components/skrum/action-item.tsx` exports `nextActionStatus` and accepts `withDoing`; `bin/test-db` exists and `bin/test-db pgsql -- tests/Arch` passes; `tests/Concurrency/Support/Race.php` exists; the last migration of `database/migrations` is dated before `2026_10_21_100000`. If plan 21 or plan 23 was merged since, re-read `ActionItem`, `PresentActionItem`, `ActionItemPermissions` and the action-items components, and take the next free migration date.
- Branch `plan-24-action-items` from that base. No merge into `main`, no push.
- Steps A and B run on that branch with one writer. Lanes run in git worktrees on branches `lane/24-<name>`, cut from the head of Task 7; the controller merges one lane at a time and runs the gates after each merge: `npm run types:check`, `npm run check`, `npm run build:front`, `vendor/bin/pint --dirty --format agent`, `vendor/bin/sail composer types:check`, `npm run test -- resources/js/components/action-items resources/js/lib/action-items`, and `bin/test-db pgsql -- tests/Feature/ActionItems tests/Arch`.
- From a worktree, `bin/test-db` needs `TEST_DB_CONTAINER` (the running application container) and `TEST_DB_WORKDIR` (the worktree's path inside it); MariaDB and MySQL are started once with `docker compose up -d mariadb mysql`. Never run two whole suites at once in the shared container.
- Between Task 3 (the `filters` prop becomes lists) and Task 7 (the front reads them) the page's filters misbehave at runtime on this branch. Nothing is merged in between.
- Every task re-reads the files it touches; a line number or a method body quoted here that no longer matches is followed in spirit and reported.

## Owner decisions

The seven questions of spec §15. "Plan written on" is the recommended option. The last column names what changes with another answer.

| # | Question | Plan written on | If the owner answers otherwise |
|---|---|---|---|
| 1 | A bulk change meets an item it cannot change | **A**: per-item outcome, refusals listed | **B**: Task 4 wraps the loop in one transaction that locks every row in id order first and rethrows the first refusal (422 naming the item); Task 5 the same; the race cases of Tasks 4 and 5 assert one winner; Task 10 drops the "Details" list. **C**: as B on the server, plus Task 7 computes per-action availability over the whole selection and Task 10 disables an action when one item refuses it |
| 2 | "In progress" and trackers | **B**: read only, promote open → doing | **A**: drop Task 2. **C**: Task 2 grows into three tasks (settings `startStatusId` / `startStateId` in `DoneMapping::configured`, the team integrations settings UI, `PushActionItemState` with a third target and `ExternalIssueState::InProgress`) |
| 3 | "Sync to Jira" in the bulk bar | **A**: client loop over the per-item export | **B**: a new back-end task after Task 5 (a `ExportActionItems` job per item, a `POST …/action-items/bulk-exports` endpoint, a result event on the user channel), to be shared with RT-10 of plan 21; Task 11's loop becomes one request and a listener. **C**: Task 11 drops the sync part; P24-06 stays a deviation |
| 4 | Due-date buckets | **A**: overdue, today, next 7 days, later, none | **B**: Task 3 replaces `week`/`later` by `this_week`/`next_week`/`later` with a week starting Monday (ISO) on the server and a translated note in the facet; Task 9 relabels. **C**: Task 3 reads `due_from` / `due_to` (`Y-m-d`), Task 9 builds a range calendar in the facet |
| 5 | What "Export" downloads | **A**: every matching item, all pages | **B**: Task 6 honours `page` (and Task 12 sends the selected ids when there is a selection, a new `ids` parameter capped at 50). **C**: Task 6 adds `format=md` with a checklist writer and its tests; Task 12 turns the button into a menu |
| 6 | How far a selection reaches | **A**: current page, 50 ids | **B**: a new back-end task after Task 5 (bulk endpoints accepting `filters` instead of `ids`, a cap of 500, a count check), Task 10 adds "Select all n matching" and the confirmation naming the count |
| 7 | Phone selection | **A**: long press and a "Select" button | **B**: Task 11 drops the "Select" button (and P24-09 becomes "no keyboard route into selection below 80rem") |

## File structure

Back end, created:

| File | Responsibility |
|---|---|
| `database/migrations/2026_10_21_100000_add_started_at_to_action_items.php` | the `started_at` column |
| `app/Actions/ActionItems/ActionItemBulkChanges.php` | the per-item loop for updates and deletions |
| `app/Http/Requests/ActionItems/ActionItemBulkUpdateRequest.php`, `ActionItemBulkDeletionRequest.php` | validation of the bulk bodies |
| `app/Http/Controllers/WorkspaceActionItemBulkUpdatesController.php`, `WorkspaceActionItemBulkDeletionsController.php` | the two bulk routes |
| `app/Support/CsvCell.php`, `app/Support/CsvDownload.php` | formula neutralisation and the streamed download, shared with the survey CSV |
| `app/Actions/ActionItems/ExportActionItemsCsv.php`, `app/Http/Controllers/WorkspaceActionItemCsvExportsController.php` | the list export |

Back end, modified: `app/Enums/ActionItemStatus.php`, `app/Models/ActionItem.php`, `database/factories/ActionItemFactory.php`, `app/Actions/ActionItems/{SetActionItemStatus,ActionItemSubtaskRules,ActionItemFilters,ActionItemQuery}.php`, `app/Actions/Retros/PresentActionItem.php`, `app/Actions/Integrations/ApplyIssueChanges.php`, `app/Actions/TeamSurveys/ExportSurveyCsv.php`, `app/Http/Controllers/TeamSurveys/TeamSurveyExportsController.php`, `app/Http/Controllers/WorkspaceActionItemsController.php` (no change of code: the props follow `ActionItemFilters::toArray()`), `app/Mcp/Tools/Retro/ListActionItems.php`, `routes/web.php`.

Tests, created: `tests/Feature/ActionItems/ActionItemInProgressTest.php`, `ActionItemFiltersTest.php`, `ActionItemBulkUpdatesTest.php`, `ActionItemBulkDeletionsTest.php`, `ActionItemCsvExportTest.php`; `tests/Upgrade/ActionItemStartedAtTest.php`; `tests/Concurrency/ActionItemBulkTest.php`. Modified: `tests/Feature/Integrations/ApplyIssueChangesTest.php` (new cases; one existing expectation, Task 2), `tests/Feature/Mcp/RetroListToolsTest.php` (one new case).

Front end, created: `resources/js/lib/action-items/{selection,bulk,status}.ts` and their `.test.ts`; `resources/js/components/action-items/{use-action-item-selection.ts,action-item-select-cell.tsx,action-items-bulk-bar.tsx,bulk-assign-menu.tsx,bulk-result-toast.tsx,bulk-delete-confirm.tsx,use-bulk-tracker-export.ts,action-item-facets.tsx,export-action-items-button.tsx}` and their tests. Modified: `lib/retro/types.ts`, `components/action-items/{action-items-page,action-items-table,action-items-list,action-item-sheet,action-item-filters,action-item-filters-drawer,use-action-item-filters,action-items-header}.tsx|ts`, `components/skrum/{action-item,action-sheet}.tsx` (only if a prop is missing; each such change is its own commit), `components/retro/{board-dialogs,action-item-rows,carried-items-sheet}.tsx`, `pages/action-items/index.tsx`, `pages/dev/sections/actions-index.tsx`, `tests/Browser/Visual/ActionsPageVisualTest.php` (captures only), `lang/{en,fr,es,de}.json`.

## Global Constraints

- **Mockup first** (parent spec §5 rule 13). A screen follows ScreenActions and ActionItem: layout, placement, labels, states. A difference is fixed, or is a row of **Pre-build deviations**, put to the owner before its screen is built. Captures are taken once, in Task 13, in light, at 1440, in French, and compared with the mockup's `preview.html`.
- **Front rules** of the parent spec §5 on every front file: tokens only, rem, Tailwind scale (no arbitrary size), no overflow from 20rem to 60rem, visible focus, contrast, motion with `prefers-reduced-motion`, lucide icons, the literal call shape `t('…')`, presentational `skrum/` components (no network, no Echo, no router). Containers live in `resources/js/components/action-items/`. Reuse what exists: `ActionItem`, `ActionSheet`, `ActionStatusBadge`, `ActionPriorityMark`, `Table`, `Checkbox` (it has the `indeterminate` state), `Popover` + `Command`, `DropdownMenu`, `Calendar`, `Dialog`, `Drawer`, `Tooltip`, `sonner`, `ItemDeleteConfirm`, `ItemExport`, `useActionItemMutations`, `useActionItemsRealtime`.
- **Database (owner rule): Eloquent and the standard query builder only.** `docs/database.md`, rules 1 to 12, apply to every line of PHP, migration and test; `tests/Arch/DatabasePortabilityTest.php` enforces them. In short: no raw query of any form; no driver test; migrations with the Schema builder only, `up` only, dated `2026_10_21_…`, nullable `timestamp()`; a transaction locks the aggregate root first (here: the action item row, `WorkspaceActionItemGuard::lockWritable`); transactions that broadcast are not retried (`Transactions::Attempts` is not used here); an explicit tie-breaker on every sort (`ActionItemQuery::order` has one); dates bound as `Y-m-d` strings; `action_items.sort_rank` is written by `ActionItem::save()` only, so a legacy row inserted with `DB::table()` in a test sets `sort_rank` itself; tests never read SQL text and never change the schema; writes never skip model events.
- **Four engines.** Every task runs the tests it wrote or touched on PostgreSQL, MariaDB, MySQL and SQLite: `bin/test-db pgsql -- <paths>`, then `mariadb`, `mysql`, `sqlite`. A step "Run the tests on the four engines" means exactly that; its "Expected" holds on each. The red step of a task ("see it fail") may run once, on SQLite in memory: `vendor/bin/sail artisan test --compact <path>`. Races (`tests/Concurrency`) run with `bin/test-db <engine> --concurrency -- tests/Concurrency/ActionItemBulkTest.php` on `pgsql`, `mariadb`, `mysql` and `sqlite-file`, never on SQLite in memory, never in parallel. The data migration test (`tests/Upgrade`) runs on the four engines.
- **Races** are proved with `Tests\Concurrency\Support\Race` (static closures capturing scalars only; `Race::request`); each case states the protection it proves (the row lock of `lockWritable` and the early return of `SetActionItemStatus` on an unchanged status; the unique `previous_occurrence_id`).
- **Working rules (owner):** unit, feature, upgrade, arch and concurrency tests are written and run per task; Vitest is written and run per task (`npm run test -- <pattern>`), the whole suite in Task 16; whole suites at merges into the plan branch (the gates above) and at the end; browser walkthroughs (`tests/Browser/Walkthroughs`) are neither written, edited nor run — a walkthrough whose selector this plan changes is listed in the report, not edited; captures only, in Task 13, light, 1440, French.
- **No new dependency**, PHP or JS, without the owner's approval. Long press is written with pointer events, not a library.
- **Four languages, informal.** Every new `__('…')` and `t('…')` key is added to `lang/en.json`, `fr.json`, `es.json`, `de.json` in the commit that introduces it (`tests/Feature/TranslationKeysTest.php`), in the informal register (French "tu", Spanish "tú", German "du"; `tests/Feature/InformalRegisterTest.php`). A key that exists keeps its value ("In progress", "Mark as in progress", "Export", "Priority", "Due date", "Source", "To do", "Done", "No due date", "Today", "Later", "Select", "Assign", ":count selected", "Added outside a retro", ":count of :total", ":name (guest)" exist). Task 14 lists the values of every new key.
- **No test is deleted** without the owner's approval. The one existing expectation this plan changes is named in Task 2.
- Primary and foreign keys are UUIDs. Create files with `vendor/bin/sail artisan make:… --no-interaction`.
- Controllers: plural name, CRUD method names only (`arch()->preset()->laravel()`). Route names camelCase, URLs kebab-case, tuple notation. Form Requests with array rules.
- Arch facts: models do not use `App\Actions`, `App\Http` or `App\Mcp`; actions do not use `App\Http`; `App\Support` does not use `App\Http` or `App\Mcp`; enums use nothing of the application; no class is `final`.
- PHP style: early returns, no `else`, happy path last, typed everything, PascalCase constants, constructor promotion, no comment that restates code; before each commit `vendor/bin/pint --dirty --format agent` and `vendor/bin/sail composer types:check` (PHPStan).
- Octane is installed: no static or per-request singleton state in new classes.
- Front gates after every task that touches the front: `npm run types:check`, `npm run check`, `npm run build:front` (it runs `wayfinder:generate --with-form`, needed after Tasks 4, 5 and 6 before the front uses their routes).
- One commit per task, in the repository's style (`feat(action-items): …`, `test: …`), ending with the trailer lines:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE
```

  Never push, never merge into `main`.

## Pre-build deviations

Put to the owner before the screen is built (owner's rule of the fifth round). Reasons as in plan 18e: **F** false or unsafe, **A** accessibility, **N** no such data or concept, **S** this spec, **O** an owner's answer.

| # | Screen | Mockup element | Built | Reason |
|---|---|---|---|---|
| P24-01 | Filter bar | "Statut · 3 sur 4" | "Status · 2 of 3" (three statuses) | N: there are three statuses |
| P24-02 | Filter bar, rows | Source "Whiteboard · …", "Sondage · …" and their icons | Source facet "From a retro" / "Added outside a retro"; rows keep the retro link or "Added outside a retro" | N: roadmap backlog (former plan 28; plan 19 §13) |
| P24-03 | Header, table | "Grouper par Sprint" (default), sprint group rows with "en cours" / "terminé" badges, dates and late counts | None / Team / Assignee, None by default; group rows with label, count and a selection box | N: no sprint (TM-1); D-19 keeps it |
| P24-04 | Table | a box on every row | a disabled box, with a tooltip, on a row the viewer can neither complete nor manage | F otherwise: a selection the server would refuse entirely |
| P24-05 | Bulk bar | no feedback drawn | a toast after each action ("n updated, m not changed" with "Details") and "Exporting n of m…" during a tracker sync | S: per-item outcome (decision 1) |
| P24-06 | Bulk bar | "Synchroniser vers Jira" always shown | "Sync to :tracker", named after the team's tracker, shown only for a selection of one team with a writable tracker | N/F: a tracker belongs to a team; several trackers or teams have no single target (decision 3) |
| P24-07 | Topbar | search field "Rechercher une action, un ticket… ⌘K" | not rendered | PB-12 of plan 18e stands |
| P24-08 | Sidebar | "Actions · 2 en retard" | the number alone | D-129, still to approve |
| P24-09 | Phone and tablet list | long press only | long press and a "Select" button in the header | A: keyboard and screen-reader route into selection (decision 7) |
| P24-10 | Phone chips | "Ouvertes", "Terminées" | "To do n" (To do + In progress), "Done", as D-118 | D-118 stands for the wording |

## Review Focus

The inputs the spec implies that are most likely to bite, each pinned by a test in the task that owns the code.

1. **A link or a stored filter from before this plan** (`?status=open`, `?status=overdue`, `?status=all`, the reminder digest's link): the same items as before. Tests in Task 3 (server mapping) and Task 7 (the landing sends the stored entry unchanged).
2. **A bulk selection mixing what may and may not be changed** (another author's item, a locked board, an item deleted in another tab, an item of a team the viewer left, a recurring item asked to lose its date): the rest changes, each refusal has its sentence, nothing leaks about invisible items. Test in Task 4.
3. **Two bulk requests over the same items at once** (a double click, two tabs): one next occurrence per recurring item, no 500. Race cases in Task 4 and Task 5.
4. **A tracker read of an issue "In Review" on an item a member just started, or just completed**: started stays started; completed follows the source's done/open rule as today. Tests in Task 2.
5. **A CSV cell typed as `=HYPERLINK(…)`** in an item's text, a retro title or a team name: shown as text by a spreadsheet. Test in Task 6.

## Lanes

| Lane | Tasks | Cut from | Shares with other lanes |
|---|---|---|---|
| main | 1 to 7, 13 to 16 | — | — |
| Status | 8 | head of Task 7 | `components/action-items/action-items-table.tsx` (status cell only), `lang/*.json` |
| Filters | 9 | head of Task 7 | `components/action-items/action-items-page.tsx` (the `extraFacets` line and the drawer props only), `lang/*.json` |
| Bulk | 10, then 11 | head of Task 7 | `components/action-items/action-items-page.tsx` (the `selectionCell`, `selectionHead`, `bulkBar` lines and the list's selection props), `action-items-table.tsx` (first column and group rows only), `action-items-list.tsx`, `action-items-header.tsx` ("Select" button), `lang/*.json` |
| Export | 12 | head of Task 7 | `pages/action-items/index.tsx` (the `before` prop only), `lang/*.json` |

The four lanes run in parallel. Merge order: Status, Filters, Bulk, Export. `action-items-page.tsx` and `action-items-table.tsx` are edited by several lanes in named regions; the controller resolves the conflicts at each merge. `lang/*.json` conflicts are resolved by the controller (keys appended in one alphabetical block per lane). A lane that needs a change in `components/skrum/` stops and asks: Task 7 makes the only planned one.

---

## Step A — back end (single writer)

### Task 1: "In progress" — column, status, transitions, presentation

**Files:**
- Create: `database/migrations/2026_10_21_100000_add_started_at_to_action_items.php`, `tests/Feature/ActionItems/ActionItemInProgressTest.php`, `tests/Upgrade/ActionItemStartedAtTest.php`
- Modify: `app/Enums/ActionItemStatus.php`, `app/Models/ActionItem.php`, `database/factories/ActionItemFactory.php`, `app/Actions/ActionItems/SetActionItemStatus.php`, `app/Actions/ActionItems/ActionItemSubtaskRules.php`, `app/Actions/Retros/PresentActionItem.php`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Produces: `ActionItemStatus::Doing` (`'doing'`), `ActionItemStatus::label(): string`; `ActionItem::currentStatus(): ActionItemStatus`; `ActionItem::$started_at` (`?Carbon`, cast `datetime`, not fillable); factory state `ActionItemFactory::started(string $at = '2026-10-20 08:00:00')`; `SetActionItemStatus::handle(ActionItem $locked, ActionItemActor|ExternalSyncActor $actor, ActionItemStatus $status): ActionItem` accepting the three values; `PresentActionItem` keys `status` (`open|doing|completed`) and `startedAt` (`?string`, ISO 8601).

- [ ] **Step 1: Write the failing tests**

`tests/Feature/ActionItems/ActionItemInProgressTest.php`:

```php
<?php

use App\Enums\ActionItemRecurrence;
use App\Enums\ActionItemStatus;
use App\Enums\RetroPhase;
use App\Events\ActionItems\ActionItemCompleted;
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
    Event::fake([ActionItemCompleted::class, ActionItemReopened::class, TeamActionItemSaved::class]);
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
});

it('changes and announces nothing when the item already has the status', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->started('2026-10-20 08:00:00')->create();

    patchItemStatus($item, $user, ['status' => 'doing'])->assertOk()->assertJsonPath('actionItem.startedAt', '2026-10-20T08:00:00+00:00');

    Event::assertNotDispatched(TeamActionItemSaved::class);
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
    $migration = '2026_10_21_100000_add_started_at_to_action_items.php';
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

`database/migrations/2026_10_21_100000_add_started_at_to_action_items.php`:

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

`app/Actions/ActionItems/SetActionItemStatus.php` (whole `handle`):

```php
    /**
     * Setting the current status again changes and announces nothing. Completion and
     * reopening keep their events; starting and stopping only announce the item.
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

- [ ] **Step 4: Run the tests on the four engines**

Run: `bin/test-db pgsql -- tests/Feature/ActionItems tests/Upgrade/ActionItemStartedAtTest.php tests/Feature/Integrations tests/Feature/Mcp`, then `mariadb`, `mysql`, `sqlite`.
Expected: PASS. `tests/Feature/ActionItems/PresentActionItemTest.php` and the MCP item-shape tests pass with the extra `startedAt` key; if one compares the whole payload with `toBe`, add `'startedAt' => null` to its expected array and list the file in the commit message.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_10_21_100000_add_started_at_to_action_items.php app/Enums/ActionItemStatus.php app/Models/ActionItem.php database/factories/ActionItemFactory.php app/Actions/ActionItems/SetActionItemStatus.php app/Actions/ActionItems/ActionItemSubtaskRules.php app/Actions/Retros/PresentActionItem.php tests/Feature/ActionItems/ActionItemInProgressTest.php tests/Upgrade/ActionItemStartedAtTest.php lang
git commit -m "feat(action-items): status In progress (AI-3)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 2: A tracker read starts an open linked item (decision 2, option B)

**Files:**
- Modify: `app/Actions/Integrations/ApplyIssueChanges.php`, `tests/Feature/Integrations/ApplyIssueChangesTest.php`

**Interfaces:**
- Consumes: `ActionItemStatus::Doing`, `ActionItem::currentStatus()`, `SetActionItemStatus::handle()` (Task 1); `DoneMapping::category(IntegrationProvider $provider, string $kind): ExternalStatusCategory` (exists).
- Produces: no new signature. Behaviour: on a read where both sides are "open", an `open` item whose issue is `InProgress` becomes `doing`; when the source reopens a completed item into an `InProgress` status, the item becomes `doing`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/Feature/Integrations/ApplyIssueChangesTest.php` (it already has `applyStatusSyncIssues()`, and `tests/Pest.php` has `statusSyncLink()` and `statusSyncIssue()`):

```php
it('starts an open item when its issue is in progress, as the system and without a push', function () {
    Event::fake([ActionItemCompleted::class, ActionItemReopened::class]);
    ['integration' => $integration, 'item' => $item, 'link' => $link] = statusSyncLink();

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'indeterminate', overrides: ['status' => 'In Progress'])]);

    $item->refresh();
    expect($item->currentStatus())->toBe(App\Enums\ActionItemStatus::Doing)
        ->and($item->completed_at)->toBeNull()
        ->and(LinkStatusSync::state($link->fresh(), $item))->toBe(LinkStatusSync::Synced);
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

it('never puts a started item back to do when its issue is still to do', function () {
    ['integration' => $integration, 'item' => $item] = statusSyncLink(item: ['started_at' => '2026-10-07 09:00:00']);

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new')]);

    expect($item->fresh()->started_at?->toDateTimeString())->toBe('2026-10-07 09:00:00');
    Queue::assertNotPushed(PushActionItemState::class);
});

it('reopens a completed item into in progress when the source reopens it into an in-progress status', function () {
    Event::fake([ActionItemReopened::class]);
    ['integration' => $integration, 'item' => $item] = statusSyncLink(item: ['completed_at' => '2026-10-06 09:00:00']);

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'indeterminate', overrides: ['status' => 'In Review'])]);

    $item->refresh();
    expect($item->completed_at)->toBeNull()
        ->and($item->started_at)->not->toBeNull();
    Event::assertDispatched(fn (ActionItemReopened $event) => $event->origin === ActionItemEventOrigin::External);
});
```

Change the existing test "only records the read when both sides agree" (it reads an `indeterminate` issue named "In Review"): keep its name, input and assertions, and add one expectation after `->and($item->fresh()->completed_at)->toBeNull()`:

```php
        ->and($item->fresh()->started_at)->not->toBeNull()
```

This is the only existing expectation the plan changes; say so in the commit message.

Before running, read `statusSyncLink()` in `tests/Pest.php` (around line 1467): if its `item` attributes go through a guarded `create()`, `started_at` is passed by the factory (factories fill unguarded); if they are applied with `update()`, use `forceFill([...])->save()` in the two tests above instead.

- [ ] **Step 2: Run the tests to see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Integrations/ApplyIssueChangesTest.php`
Expected: FAIL on the four new cases and on the changed one (`started_at` is null).

- [ ] **Step 3: Implement**

In `app/Actions/Integrations/ApplyIssueChanges.php`, add `use App\Enums\ExternalStatusCategory;` and, in `applyToItem()`, after `$state = DoneMapping::state($integration, $status);`:

```php
            $category = DoneMapping::category($integration->provider, $status->kind);
```

Replace

```php
            if ($state === $itemState) {
                continue;
            }
```

with

```php
            if ($state === $itemState) {
                if ($this->sourceStarted($item, $category)) {
                    $item = $this->setActionItemStatus->handle(
                        $item,
                        new ExternalSyncActor($integration->provider->value, $link->external_key),
                        ActionItemStatus::Doing,
                    );
                    $outcome['changed'] = true;
                }

                continue;
            }
```

and in the call that follows the source, replace the third argument

```php
                $state === ExternalIssueState::Done ? ActionItemStatus::Completed : ActionItemStatus::Open,
```

with

```php
                $this->followedStatus($state, $category),
```

Add the two private methods:

```php
    /**
     * Spec 24 §6.2: an item still to do follows its issue into progress; a started item is
     * never put back to do by a read, so a member may start an item before its issue moves.
     */
    private function sourceStarted(ActionItem $item, ExternalStatusCategory $category): bool
    {
        return $category === ExternalStatusCategory::InProgress && $item->currentStatus() === ActionItemStatus::Open;
    }

    private function followedStatus(ExternalIssueState $state, ExternalStatusCategory $category): ActionItemStatus
    {
        if ($state === ExternalIssueState::Done) {
            return ActionItemStatus::Completed;
        }

        if ($category === ExternalStatusCategory::InProgress) {
            return ActionItemStatus::Doing;
        }

        return ActionItemStatus::Open;
    }
```

`LinkStatusSync`, `PushActionItemState` and `QueueActionItemStatusPushes` do not change: they read `isCompleted()`, so a started item is "open" for the sync.

- [ ] **Step 4: Run the tests on the four engines**

Run: `bin/test-db pgsql -- tests/Feature/Integrations tests/Feature/ActionItems`, then `mariadb`, `mysql`, `sqlite`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Actions/Integrations/ApplyIssueChanges.php tests/Feature/Integrations/ApplyIssueChangesTest.php
git commit -m "feat(integrations): a tracker read starts an open linked action item

The test 'only records the read when both sides agree' gains one expectation:
its In Review issue now starts the item.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 3: Filters — statuses, priorities, due date, source (AI-2)

**Files:**
- Modify: `app/Actions/ActionItems/ActionItemFilters.php` (rewritten), `app/Actions/ActionItems/ActionItemQuery.php`, `app/Mcp/Tools/Retro/ListActionItems.php`, `tests/Feature/Mcp/RetroListToolsTest.php`
- Create: `tests/Feature/ActionItems/ActionItemFiltersTest.php`

**Interfaces:**
- Consumes: `started_at` (Task 1).
- Produces:
  - `ActionItemFilters` with public properties `array $statuses` (subset of `todo`, `doing`, `completed`, canonical order), `?string $assignee`, `?string $teamId`, `?string $itemId`, `array $priorities` (subset of `high`, `medium`, `low`), `?string $due` (`overdue|today|week|later|none`), `?string $source` (`retro|outside`); constants `Statuses` (the single values MCP and old links use: `open`, `doing`, `overdue`, `completed`, `all`), `StatusTokens`, `DefaultStatuses`, `DueBuckets`, `Sources`; `fromRequest(Request, Collection $visibleTeams): self`; `forStatus(string $status, ?string $assignee = null): self`; `toArray(): array{status: list<string>, priority: list<string>, due: ?string, source: ?string, assignee: ?string, team: ?string, item: ?string}`.
  - `ActionItemQuery::filter(Builder, User, ActionItemFilters): Builder` and `counts(...)` with the semantics of spec §6.3; `ActionItemQuery::forUser()` unchanged in signature.
  - The `filters` prop of `action-items/index` takes the shape of `toArray()` (consumed by Task 7).

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
     * Unknown values fall back to the defaults instead of failing.
     *
     * @param  Collection<int, Team>  $visibleTeams
     */
    public static function fromRequest(Request $request, Collection $visibleTeams): self
    {
        $team = $request->query('team');
        $item = $request->query('item');
        [$statuses, $statusDue] = self::readStatus($request->query('status'));

        return new self(
            statuses: $statuses,
            assignee: self::assignee($request->query('assignee')),
            teamId: is_string($team) && $visibleTeams->contains('id', $team) ? $team : null,
            itemId: is_string($item) && Str::isUuid($item) ? $item : null,
            priorities: self::many($request->query('priority'), self::priorityValues()),
            due: self::one($request->query('due'), self::DueBuckets) ?? $statusDue,
            source: self::one($request->query('source'), self::Sources),
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

- [ ] **Step 4: Run the tests on the four engines**

Run: `bin/test-db pgsql -- tests/Feature/ActionItems tests/Feature/Mcp tests/Feature/Database/ActionItemOrderTest.php`, then `mariadb`, `mysql`, `sqlite`.
Expected: PASS. `ActionItemsPageTest` ("filters by status, assignee and team") passes unchanged: it sends single values. If a test of that file reads `props.filters.status` as a string, change its expectation to the list and list the file in the commit message.

- [ ] **Step 5: Commit**

```bash
git add app/Actions/ActionItems/ActionItemFilters.php app/Actions/ActionItems/ActionItemQuery.php app/Mcp/Tools/Retro/ListActionItems.php tests/Feature/ActionItems/ActionItemFiltersTest.php tests/Feature/Mcp/RetroListToolsTest.php
git commit -m "feat(action-items): filters by statuses, priority, due date and source (AI-2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 4: Bulk changes (AI-1) — endpoint, per-item loop, races

**Files:**
- Create: `app/Actions/ActionItems/ActionItemBulkChanges.php`, `app/Http/Requests/ActionItems/ActionItemBulkUpdateRequest.php`, `app/Http/Controllers/WorkspaceActionItemBulkUpdatesController.php`, `tests/Feature/ActionItems/ActionItemBulkUpdatesTest.php`, `tests/Concurrency/ActionItemBulkTest.php`
- Modify: `routes/web.php`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: `ApplyActionItemChanges::handle(ActionItem $locked, ActionItemActor $actor, array $validated): ActionItem`, `WorkspaceActionItemGuard::lockWritable(string $id): ActionItem`, `ActionItemQuery::visibleTo(User, Workspace): Builder`, `PresentActionItem::many(iterable, ?ActionItemActor): array`.
- Produces: `ActionItemBulkChanges::update(User $user, Workspace $workspace, array $ids, array $changes): array{changed: array<int, ActionItem>, refused: array<int, array{id: string, message: string}>}` and `ActionItemBulkChanges::delete(User $user, Workspace $workspace, array $ids): array{changed: array<int, string>, refused: array<int, array{id: string, message: string}>}` (the latter used by Task 5); route `workspaces.actionItemBulkUpdates.store` (`POST workspaces/{workspace}/action-items/bulk-updates`, body `{ids, changes}`, answer `{actionItems, refused}`).

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
     * @return array{changed: array<int, ActionItem>, refused: array<int, array{id: string, message: string}>}
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
     * @return array{changed: array<int, string>, refused: array<int, array{id: string, message: string}>}
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
     * An item the viewer cannot see reads as one that is gone: nothing tells them it exists.
     *
     * @template TChanged
     *
     * @param  array<int, string>  $ids
     * @param  Closure(string): TChanged  $change
     * @return array{changed: array<int, TChanged>, refused: array<int, array{id: string, message: string}>}
     */
    private function each(User $user, Workspace $workspace, array $ids, Closure $change): array
    {
        $visible = $this->actionItemQuery->visibleTo($user, $workspace)->whereKey($ids)->pluck('id')->all();
        $changed = [];
        $refused = [];

        foreach ($ids as $id) {
            if (! in_array($id, $visible, true)) {
                $refused[] = ['id' => $id, 'message' => __('This action item no longer exists.')];

                continue;
            }

            try {
                $changed[] = $change($id);
            } catch (AuthorizationException|ValidationException|HttpException|ModelNotFoundException $exception) {
                $refused[] = ['id' => $id, 'message' => $this->reason($exception)];
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

`lang/*.json`: the key "This action item no longer exists." (values in Task 14's table; add them now).

- [ ] **Step 4: Run the tests on the four engines, and the race**

Run: `bin/test-db pgsql -- tests/Feature/ActionItems tests/Arch`, then `mariadb`, `mysql`, `sqlite`; then `bin/test-db pgsql --concurrency -- tests/Concurrency/ActionItemBulkTest.php`, then `mariadb`, `mysql`, `sqlite-file`.
Expected: PASS. If the refusal sentence of a locked board or of a missing right differs from the one written in the test, the test follows the code's sentence (they are the single-item endpoint's) and the commit message says so.

- [ ] **Step 5: Commit**

```bash
git add app/Actions/ActionItems/ActionItemBulkChanges.php app/Http/Requests/ActionItems/ActionItemBulkUpdateRequest.php app/Http/Controllers/WorkspaceActionItemBulkUpdatesController.php routes/web.php tests/Feature/ActionItems/ActionItemBulkUpdatesTest.php tests/Concurrency/ActionItemBulkTest.php lang
git commit -m "feat(action-items): bulk changes, item by item (AI-1)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 5: Bulk deletion (AI-1)

**Files:**
- Create: `app/Http/Requests/ActionItems/ActionItemBulkDeletionRequest.php`, `app/Http/Controllers/WorkspaceActionItemBulkDeletionsController.php`, `tests/Feature/ActionItems/ActionItemBulkDeletionsTest.php`
- Modify: `routes/web.php`, `tests/Concurrency/ActionItemBulkTest.php`

**Interfaces:**
- Consumes: `ActionItemBulkChanges::delete()` (Task 4).
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

- [ ] **Step 4: Run the tests on the four engines, and the race**

Run: `bin/test-db pgsql -- tests/Feature/ActionItems`, then `mariadb`, `mysql`, `sqlite`; then `bin/test-db <pgsql|mariadb|mysql|sqlite-file> --concurrency -- tests/Concurrency/ActionItemBulkTest.php`, one engine after the other.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Requests/ActionItems/ActionItemBulkDeletionRequest.php app/Http/Controllers/WorkspaceActionItemBulkDeletionsController.php routes/web.php tests/Feature/ActionItems/ActionItemBulkDeletionsTest.php tests/Concurrency/ActionItemBulkTest.php
git commit -m "feat(action-items): bulk deletion, item by item (AI-1)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 6: CSV export of the list (AI-4)

**Files:**
- Create: `app/Support/CsvCell.php`, `app/Support/CsvDownload.php`, `app/Actions/ActionItems/ExportActionItemsCsv.php`, `app/Http/Controllers/WorkspaceActionItemCsvExportsController.php`, `tests/Feature/ActionItems/ActionItemCsvExportTest.php`
- Modify: `app/Actions/TeamSurveys/ExportSurveyCsv.php` (uses `CsvCell`), `app/Http/Controllers/TeamSurveys/TeamSurveyExportsController.php` (uses `CsvDownload`), `routes/web.php`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: `ActionItemFilters::fromRequest()`, `ActionItemQuery::visibleTo()`, `filter()`, `order()` (Task 3); `ActionItemStatus::label()`, `ActionItem::currentStatus()` (Task 1); `BuildRetroRecap::assignee(ActionItem $item, bool $forMachines = false): ?string` (exists); `ActionItemPriority::label()` (exists).
- Produces: `CsvCell::safe(string $cell): string`; `CsvDownload::stream(iterable $rows, string $fileName): StreamedResponse`; `ExportActionItemsCsv::rows(User, Workspace, ActionItemFilters): Generator<int, array<int, string>>`, `ExportActionItemsCsv::fileName(Workspace): string`; route `workspaces.actionItemCsvExports.show` (`GET workspaces/{workspace}/action-items/export`, the page's query) used by Task 12.

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

- [ ] **Step 4: Run the tests on the four engines**

Run: `bin/test-db pgsql -- tests/Feature/ActionItems/ActionItemCsvExportTest.php tests/Feature/TeamSurveys/TeamSurveyExportTest.php tests/Arch`, then `mariadb`, `mysql`, `sqlite`.
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

### Task 7: Types, filters, selection, bulk client, status comparisons

**Files:**
- Create: `resources/js/lib/action-items/selection.ts`, `selection.test.ts`, `bulk.ts`, `bulk.test.ts`, `status.ts`, `status.test.ts`
- Modify: `resources/js/lib/retro/types.ts`, `components/action-items/use-action-item-filters.ts` and its test, `components/action-items/action-item-filters-drawer.tsx` (chips only), `components/action-items/action-items-page.tsx` (the empty-state condition only), `components/action-items/{action-item-sheet,action-items-list}.tsx`, `components/retro/{action-item-rows,board-dialogs,carried-items-sheet}.tsx`, `lib/action-items/endpoints.ts`

**Interfaces:**
- Consumes: the `filters` prop of Task 3; routes of Tasks 4, 5, 6 through Wayfinder (`npm run build:front` first).
- Produces:
  - `lib/retro/types.ts`: `ActionItemStatus = 'open' | 'doing' | 'completed'`; `ActionItem.startedAt: string | null`.
  - `use-action-item-filters.ts`: `StatusToken = 'todo' | 'doing' | 'completed'`, `DueBucket = 'overdue' | 'today' | 'week' | 'later' | 'none'`, `SourceFilter = 'retro' | 'outside'`, `ActionItemFilters = { status: StatusToken[]; priority: ActionItemPriority[]; due: DueBucket | null; source: SourceFilter | null; assignee: string | null; team: string | null; item: string | null }`, `DefaultStatuses`, `filterQuery()`, `activeFilterCount()`, `isDefaultStatus(statuses)`; `useActionItemFilters()` keeps its return shape.
  - `lib/action-items/status.ts`: `isOpenStatus(status: ActionItemStatus): boolean` (`open` or `doing`).
  - `lib/action-items/selection.ts`: `toggleSelected`, `setSelected`, `keepListed`, `headState` (below).
  - `lib/action-items/bulk.ts`: `bulkUpdate(workspace, ids, changes): Promise<BulkUpdateResult>`, `bulkDelete(workspace, ids): Promise<BulkDeleteResult>`, `actionItemsExportUrl(workspace, filters): string`, types `BulkChanges`, `BulkRefusal`.

- [ ] **Step 1: Write the failing tests**

`resources/js/lib/action-items/selection.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
    headState,
    keepListed,
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
import { actionItemsExportUrl, bulkDelete, bulkUpdate } from '@/lib/action-items/bulk';
import { retroRequest } from '@/lib/retro/api';

vi.mock('@/lib/retro/api', () => ({ retroRequest: vi.fn() }));

describe('bulk client', () => {
    beforeEach(() => vi.mocked(retroRequest).mockReset());

    it('posts the ids and the changes, with a long timeout', async () => {
        vi.mocked(retroRequest).mockResolvedValue({ actionItems: [], refused: [] });

        await bulkUpdate('acme', ['a', 'b'], { status: 'doing' });

        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'post', url: '/workspaces/acme/action-items/bulk-updates' }),
            { ids: ['a', 'b'], changes: { status: 'doing' } },
            { timeoutMs: 60_000 },
        );
    });

    it('posts the ids to delete', async () => {
        vi.mocked(retroRequest).mockResolvedValue({ deleted: ['a'], refused: [] });

        expect(await bulkDelete('acme', ['a'])).toEqual({ deleted: ['a'], refused: [] });
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

/** Fifty items, each in its own transaction, can take longer than one change. */
const BulkTimeoutMs = 60_000;

export type BulkChanges = Partial<{
    status: ActionItemStatus;
    priority: ActionItemPriority;
    due_on: string | null;
    assignee_user_id: string | null;
}>;

export type BulkRefusal = { id: string; message: string };

export type BulkUpdateResult = {
    actionItems: ActionItem[];
    refused: BulkRefusal[];
};

export type BulkDeleteResult = { deleted: string[]; refused: BulkRefusal[] };

export function bulkUpdate(
    workspace: string,
    ids: string[],
    changes: BulkChanges,
): Promise<BulkUpdateResult> {
    return retroRequest<BulkUpdateResult>(
        WorkspaceActionItemBulkUpdatesController.store(workspace),
        { ids, changes },
        { timeoutMs: BulkTimeoutMs },
    );
}

export function bulkDelete(
    workspace: string,
    ids: string[],
): Promise<BulkDeleteResult> {
    return retroRequest<BulkDeleteResult>(
        WorkspaceActionItemBulkDeletionsController.store(workspace),
        { ids },
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

`action-item-filters-drawer.tsx` (chips only): "Overdue" is pressed when `filters.due === 'overdue'` and toggles `{ due: overdue ? null : 'overdue' }`; "To do" is pressed when `isDefaultStatus(filters.status) && filters.due !== 'overdue'` and applies `{ status: DefaultStatuses, due: null }`; "Done" is pressed when the status is exactly `['completed']` and applies `{ status: ['completed'] }`. The overdue shortcut of `action-item-filters.tsx` moves to `due` in Task 9; until then, change its two lines the same way so the page works at the head of this task.

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

Every screen task: read ScreenActions (README and preview) and ActionItem first; write the Vitest tests first (render with the props, assert roles, names, states; mock `retroRequest` and `router`); implement; run `npm run test -- <files>`, `npm run types:check`, `npm run check`, `npm run build:front`; commit. No capture here (Task 13). New strings go to the four `lang/*.json` files (values in Task 14).

### Task 8 (lane Status): "In progress" everywhere an item's status shows

**Files:** modify `components/action-items/action-items-table.tsx` (status cell), `action-items-list.tsx`, `action-item-sheet.tsx`, `components/retro/action-item-rows.tsx`, `components/retro/carried-items-sheet.tsx` (props only); their tests.

**Interfaces:** consumes `nextActionStatus(status, withDoing)`, `ActionStatusBadge` and the `withDoing` prop of `components/skrum/action-item.tsx` and `action-sheet.tsx` (they exist; do not change them — if a prop is missing, stop and ask).

**Composition and behaviours:**
- Pass `withDoing` to every `ActionItem` and `ActionSheet` the application renders: the page list, the sheet, the board's action rows, the carried-items panel.
- Table status cell: `ActionStatusBadge` with the three tones (outline, info, success); the badge stays the status button (PB-05): its accessible name is "Mark as in progress" on To do, "Mark as done" on In progress, "Reopen" on Done; a click calls `context.onStatusChange(item, nextActionStatus(item.status, true))`; disabled without the right to complete, as today.
- Sheet: the Status select lists To do, In progress, Done; the footer keeps one-click "Mark as done" (on To do and In progress) and "Reopen" (on Done). Under the status, "Started :date" when `startedAt` is set and the item is not done (`formatActionDay` for the date).
- Board and carried panel: their open counts use `isOpenStatus` (Task 7).

**Vitest (written first):** the table badge reads and names each of the three statuses and sends the next one; the sheet select sends `doing`; the sheet footer completes a started item in one click; "Started …" shows for a started item and not for a done one; the board row cycles To do → In progress → Done → To do; the carried-items count includes a started item.

**Commit:** `feat(action-items): In progress on the page, the sheet and the board`

### Task 9 (lane Filters): Status, Priority, Due date and Source facets

**Files:** create `components/action-items/action-item-facets.tsx` and its test; modify `action-item-filters.tsx` (Status facet, overdue shortcut, `extraFacets` filled by the page), `action-item-filters-drawer.tsx` (the stacked facets), `action-items-page.tsx` (the `extraFacets` line), `action-item-filters.test.tsx`.

**Interfaces:** consumes `ActionItemFilters`, `DefaultStatuses`, `isDefaultStatus`, `activeFilterCount` (Task 7); `ActionPriorityMark` (exists); `Popover`, `Command` (`CommandList`, `CommandItem`), `Checkbox`.
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

### Task 10 (lane Bulk): Selection on the table, and the bulk bar

**Files:** create `components/action-items/use-action-item-selection.ts`, `action-item-select-cell.tsx`, `action-items-bulk-bar.tsx`, `bulk-assign-menu.tsx`, `bulk-result-toast.tsx`, `bulk-delete-confirm.tsx` and their tests; modify `action-items-page.tsx` (`selectionCell`, `selectionHead`, `bulkBar`, Escape), `action-items-table.tsx` (group rows get a box: a `selectionGroup?: (group) => ReactNode` prop in the group header row).

**Interfaces:**
- Consumes: `selection.ts`, `bulk.ts`, `isOpenStatus` (Task 7); `canManageActionItem`, `canCompleteActionItem` (read `lib/action-items/permissions.ts` for the exact names); `useActionItemsRealtime`'s `saveRow` and `removeRow`; `ItemDeleteConfirm` as the model for the confirmation; `Calendar` in a `Popover` for the due date.
- Produces: `useActionItemSelection({ rows, viewer }): { selected: Set<string>; selectable(item): boolean; toggle(id); setMany(ids, on); clear(); head(ids): boolean | 'indeterminate' }` (clears on a change of `filters`, page or grouping — the hook takes a `resetKey: string` built from them); `ActionItemsBulkBar({ workspace, items, selected, teams, sourcesOf, onDone, onClear, layout: 'floating' | 'docked' })`.

**Composition and behaviours (spec §9.3, §9.4):**
- Row box (`action-item-select-cell.tsx`): `Checkbox` named "Select :title"; disabled with a tooltip "You cannot change this action item" when `selectable(item)` is false (the viewer may neither complete nor manage it). A selected row gets `data-selected` and the selected background.
- Header box: `head(selectableIds)`; ticking selects the page's selectable rows, unticking clears; name "Select all on this page" / "Clear selection". A group row box selects its group's selectable rows.
- `keepListed` runs when `rows` change (a row that left the list leaves the selection).
- Bar (`action-items-bulk-bar.tsx`), mockup order: "**n** selected" (polite live region), separator, Status ▾ (To do, In progress, Done), Assign ▾ (`bulk-assign-menu.tsx`: "Unassigned" then the members common to every team of the selection, with avatars; a search field from eight people), Due date ▾ (calendar and "No due date"), Priority ▾ (High, Medium, Low with marks), "Sync to :tracker" (Task 11), Delete (destructive ghost), separator, ✕ "Clear selection". `role="toolbar"`, name "Bulk actions", fixed at the bottom centre of the content, `z-chrome`, `shadow-modal`, enter/leave motion off with reduced motion.
- Enabled actions: Status when one selected item may be completed by the viewer; Assign, Due date, Priority and Delete when one may be managed; otherwise disabled with a tooltip.
- A change: buttons disabled, spinner on the pressed one; `bulkUpdate(...)`; each returned item through `saveRow`; then `bulk-result-toast.tsx`: "n action items updated." (one: "1 action item updated.") when nothing was refused, else "n updated, m not changed." with a "Details" action opening a dialog listing each refused item's title and message. Full success clears the selection; a partial one removes the changed ids from it.
- Delete: `bulk-delete-confirm.tsx` (`role="alertdialog"`) "Delete n action items?" / "This cannot be undone. Their comments and sub-tasks are deleted too." / "Delete" / "Cancel"; then `bulkDelete(...)`, `removeRow` for each deleted id, the toast.
- A request that fails as a whole (network, 503, 422) shows the existing error toast of `useActionItemMutations.run` and resyncs; the selection stays.
- Escape clears the selection when no sheet, menu or dialog is open.

**Vitest (written first):** a row box toggles and marks the row; a disabled box for a row the viewer cannot change; the header box reads none / mixed / all and selects the page; a group box selects its rows; the bar appears with "3 selected" and disappears when cleared; Status → In progress posts `{ ids, changes: { status: 'doing' } }`; Assign lists only the common members; a partial answer shows "1 updated, 1 not changed." and the details list the refused title and sentence, and only the changed id leaves the selection; Delete asks first and Cancel sends nothing; Escape clears; a filter change clears.

**Commit:** `feat(action-items): selection and bulk bar on the table`

### Task 11 (lane Bulk, after Task 10): Selection below 80rem, and "Sync to :tracker"

**Files:** create `components/action-items/use-bulk-tracker-export.ts` and its test, `use-long-press.ts` and its test (in `components/action-items/`); modify `action-items-list.tsx` (selection mode), `action-items-header.tsx` ("Select" / "Done" button), `action-items-bulk-bar.tsx` (docked layout, "…" menu, sync button and progress), `action-items-page.tsx` (selection mode state).

**Interfaces:**
- Consumes: Task 10's hook and bar; `ItemExport`'s target form and `endpoints.exportItem` / `endpoints.exportPreview` (read `item-export.tsx` to reuse its target step as a component, or extract it into `ExportTargetForm` in its own commit if it is not separable); `exportSources` of the page.
- Produces: `useLongPress(onLongPress, { delayMs = 500, moveTolerancePx = 10 })` returning pointer handlers; `useBulkTrackerExport({ endpoints, run }): { start(items, source, target); stop(); progress: { done: number; total: number } | null; result: { exported: string[]; skipped: string[]; failed: BulkRefusal[] } | null }`.

**Composition and behaviours (spec §9.4, §9.5):**
- Header button "Select" (below 80rem only, after "Group by"); in selection mode it reads "Finish selecting" and leaves the mode (and clears the selection).
- Selection mode in the list: a box (20 px, 44 px target) before each item's status button; a tap on the item toggles it; the bulk bar docks at the bottom (`layout="docked"`, safe-area padding), full width, with Status, Assign, Due date and "…" (Priority, Sync, Delete).
- Long press (touch and pen pointers only, 500 ms without moving more than 10 px) on an item enters selection mode with that item selected; a short tap still opens it; the context menu of a long press is prevented on the item.
- "Sync to :tracker" (`:tracker` = the source label, e.g. "Jira"): shown when every selected item has the same `teamId` and `sourcesOf(teamId)` has one source (a menu of sources when it has several); opens the existing export target step for the first unlinked item; on confirm, exports the unlinked items one after the other through `endpoints.exportItem(id)` with the target; items already linked to that source are skipped; the bar shows "Exporting :done of :total…" with a `progress` bar and "Stop"; "reconnect required" (the error the export answers today; read `item-export.tsx` for how it is recognised) stops the loop; each exported item goes through `saveRow`; the end toast: ":count exported, :skipped already linked" plus failures in "Details".

**Vitest (written first):** "Select" enters the mode and shows boxes; "Finish selecting" leaves it and clears; a long press of 500 ms enters the mode with the item selected, a 200 ms press opens it, a move cancels; the docked bar shows three actions and "…" holding the rest; the sync button is hidden for a two-team selection and for a team without a source; the loop exports two unlinked items in order, skips a linked one, shows "Exporting 1 of 2…", and stops on a reconnect answer; "Stop" ends after the current item.

**Commit:** `feat(action-items): phone selection and bulk sync to a tracker`

### Task 12 (lane Export): "Export" in the topbar

**Files:** create `components/action-items/export-action-items-button.tsx` and its test; modify `pages/action-items/index.tsx` (the `before` prop of `NewActionItemButton`; also render the button when the viewer has no creatable team).

**Interfaces:** consumes `actionItemsExportUrl(workspace, filters)` (Task 7).

**Composition and behaviours (spec §9.1):** an outline `Button` rendered as an anchor (`asChild`) with `href={actionItemsExportUrl(workspace.slug, filters)}` and `download`, lucide `FileDown`, label "Export" (visually hidden below `sm`, as "New action item" does, keeping the accessible name); placed before "New action item"; when `creatableTeams` is empty, the topbar shows "Export" alone.

**Vitest (written first):** the link carries the filters of the props (status, priority, due, source, assignee, team) and not `item`; it sits before "New action item"; it shows without a creatable team; its name is "Export" at every width.

**Commit:** `feat(action-items): export the filtered list from the topbar`

---

## Final

### Task 13: Bench section and captures (light, 1440, French)

**Files:** modify `resources/js/pages/dev/sections/actions-index.tsx`, `tests/Browser/Visual/ActionsPageVisualTest.php`.

- [ ] Add the states of spec §9.8 to the bench section, built from the page's pieces as the section does today (it does not mount `ActionItemsPage`): `selection` (three of six rows selected, header box mixed, the floating bar), `bulk-result` (the partial toast open on "Details"), `bulk-delete` (the confirmation), `facets` (Status "2 of 3", Priority High, Due date "Next 7 days", Source "From a retro", the overdue shortcut), `in-progress` (one row per status, with the sheet open on a started item), `phone-selection` (rendered at its own narrow frame: the list in selection mode with the docked bar).
- [ ] Add the captures to `ActionsPageVisualTest.php` for those states and for the real page of a manager with an "Export" button, in light, at 1440, in French only (`VISUAL_ONLY=light-1440-fr`), and run them: `vendor/bin/sail artisan test --compact tests/Browser/Visual/ActionsPageVisualTest.php` with that variable. The harness's overflow check must pass.
- [ ] Compare each capture with `docs/design-system/components/ScreenActions/preview.html` (and ActionItem's preview for the status button): every difference is fixed in the lane's component, or added as a row to **Pre-build deviations** with its reason and put to the owner.
- [ ] Commit: `test(action-items): bench states and captures of bulk changes, facets and In progress`.

### Task 14: Translations

**Files:** `lang/{en,fr,es,de}.json`.

- [ ] Check that every key added by Tasks 1 to 12 is in the four files, with these values (English is the key). Existing keys keep their values.

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

  Keys that may already exist ("Any", "Details", "Stop", "Clear selection"): keep the existing value if there is one, and do not duplicate the key.
- [ ] Run `bin/test-db pgsql -- tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php` and `npm run test -- resources/js/lib/i18n` (if the front has a key test).
- [ ] Commit: `chore(i18n): action items bulk, facets, In progress and export in four languages`.

### Task 15: Deviations and documents

- [ ] `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`: D-19 — strike what this plan built (selection and bulk bar, priority / due date / source facets, "In progress", topbar "Export"); what remains: grouping by sprint (TM-1), whiteboard and survey sources (backlog). D-118 — "no long press" removed; the chips' wording stays.
- [ ] `docs/superpowers/research/front-rewrite/feature-roadmap.md`: AI-1 to AI-4 "done, plan 24"; the backlog line under the table lists spec §3.
- [ ] `docs/superpowers/research/front-rewrite/deviations.md`: the rows P24-01 to P24-10 (with the owner's answers) and those Task 13 added.
- [ ] `docs/database.md`: in "The database holds keys, not rules", nothing changes (`started_at` is not derived); in the upgrade list of the release, add "`started_at` on action items (empty)".
- [ ] Move the spec to `docs/superpowers/specs/2026-10-21-action-items-bulk-filters-status-export-design.md` and this plan to `docs/superpowers/plans/2026-10-21-plan-24-action-items.md`; fix the links between them.
- [ ] Commit: `docs: plan 24 — spec and plan in place, roadmap and deviation rows updated`.

### Task 16: Full suites on the four engines, and the report

- [ ] `npm run test` (the whole Vitest suite), `npm run types:check`, `npm run check`, `npm run build:front`.
- [ ] `vendor/bin/sail composer types:check` and `vendor/bin/pint --dirty --format agent`.
- [ ] `bin/test-db pgsql`, then `sqlite`, then `mariadb`, then `mysql` (Unit, Feature, Upgrade and Arch; one at a time).
- [ ] `bin/test-db pgsql --concurrency`, then `mariadb`, `mysql`, `sqlite-file`.
- [ ] Write `.superpowers/sdd/roadmap/plan-24/report.md`: tasks and commits; each acceptance criterion of spec §13 with the test that proves it; the four suites' result lines; the deviations added; the walkthrough files whose selectors changed and were not edited (`grep -rln "aria-label=\"Status\"\|Mark as done\|status=overdue" tests/Browser/Walkthroughs`); what was not determined (spec §16) and what was learnt.
- [ ] Commit: `docs: plan 24 report`.

---

## Self-review (done while writing; kept for the reader)

**Spec coverage.** §6.1 status and transitions → Task 1; sub-tasks → Task 1; §6.2 tracker read → Task 2; §6.3 filters, old values, counters, MCP → Task 3; §6.4 readers → Task 1 (presenter), Task 3 (MCP list), nothing for webhooks and recap (tests unchanged); §6.5 bulk → Tasks 4, 5 (server), 10, 11 (front, sync loop); §6.6 export → Task 6 (server), 12 (button); §7 permissions → Tasks 4, 5 (per item), 10 (selectable rows, enabled actions); §8 real time → Tasks 4, 5 (events per item asserted), 10 (`saveRow` / `removeRow`); §9.1 → 12; §9.2 → 9 and 7 (chips); §9.3, §9.4 → 10, 11; §9.5 → 11; §9.6, §9.7 → 8; §9.8 → 13; §10 → Task 1's Upgrade test; acceptance criteria 1–4 → Task 1; 5 → 2; 6–9 → 3; 10–13 → 4, 5; 14 → 5; 15 → 6; 16 → 10; 17, 18 → 11; 19 → 8; 20 → 13, 14; 21 → 16.

**Placeholder scan.** Each back-end step carries its code and tests. The screen tasks carry composition, behaviours and test lists, as the project's screen tasks do; their components are new files named with their props. Three reading checks are written as instructions with the exact file to read (the search column of a legacy row in Task 1, the `statusSyncLink` helper in Task 2, the external-link factory in Task 6), each with the alternative to apply.

**Type consistency.** `ActionItem::currentStatus()` (not `status()`) everywhere; `ActionItemStatus::Doing` value `doing` on both sides; filter token `todo` (server and front) distinct from the status value `open`; `ActionItemBulkChanges::update/delete` return `changed` and `refused`, the controllers rename them `actionItems` / `deleted` and `refused`, and `bulk.ts` types match; route names `workspaces.actionItemBulkUpdates.store`, `workspaces.actionItemBulkDeletions.store`, `workspaces.actionItemCsvExports.show` in routes, tests and Wayfinder imports.

**Review Focus.** 1 → Task 3 ("reads the single values of before") and Task 7 (stored entry sent unchanged); 2 → Task 4 ("changes what it can and refuses the rest"); 3 → Tasks 4 and 5 races; 4 → Task 2 ("never puts a started item back", "reopens … into in progress"); 5 → Task 6 ("neutralises formulas").
