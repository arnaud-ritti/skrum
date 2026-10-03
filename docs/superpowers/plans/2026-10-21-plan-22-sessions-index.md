# Sessions index, advanced creation options and ticket details in the poker room (Plan 22) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to run this plan task by task (through the Workflow tool, as the project does). Steps use checkbox (`- [ ]`) syntax. Every agent reads **Owner decisions**, **Global Constraints**, **Pre-build deviations** and its own task before anything else, then `docs/database.md` ("Rules for database code" and "Running the tests on an engine") for any task that touches PHP. A screen task also follows the "Screen task procedure" of `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, with the working rules below (no walkthrough, captures in Task 20 only).

**Status: draft of 2026-10-03.** Written on the recommended option of each decision of spec §15. Nothing starts before the owner has answered §15 and the pre-build deviations. Lanes S and K may start before plan 21 is merged; lane C may not (see **Branch and run**).

**Goal:** A team member opens the team's Sessions page (Upcoming, Live, Finished, every session kind, "Load more", "New session"); the "New session" dialog sets max votes per card and phase timers for a retro, and a task timer, "change vote after reveal", the estimate write-back and a tracker import for poker, all editable again inside the session; the poker story card shows the ticket's type, labels and acceptance criteria.

**Architecture:** No new aggregate. The Sessions page reads the five session tables through one action (`ListTeamSessions`) that computes a state per kind from stored data and merges five ordered queries in PHP behind a `(updated_at, id)` cursor. The "New session" dialog's props move out of `TeamsController@show` into `PresentNewSessionOptions`, used by the team page and the Sessions page. Creation options are columns on `retros` (one JSON column, `phase_durations`) and `poker_games` (four columns); behaviour sits where the rule already lives: `ChangeRetroPhase` starts a phase timer, `StartPokerRound` starts a task timer, a new `PokerGuard::acceptsCard` opens a revealed round to card changes, `RequestEstimateSync` and `JiraIssueTracker::writeEstimate` read the per-game write-back. The creation import fetches tickets before the game exists, then writes them in the creation transaction through the code that imports inside a game. Ticket details are three `external_*` columns of `poker_tasks`, filled by every tracker through `TrackerIssue`.

**Tech Stack:** Laravel 13, PHP 8.4, Pest (feature, unit, arch, concurrency), Inertia 3, React 19, Tailwind 4, vite-plus (Vitest), Wayfinder, Reverb; PostgreSQL, MariaDB, MySQL and SQLite through `bin/test-db`; `Tests\Concurrency\Support\Race`. Run `composer show --direct` and read `package.json` before Task 1 and stop if a major version differs from these.

**Spec:** `.superpowers/sdd/roadmap/plan-22/spec.md` (moves to `docs/superpowers/specs/2026-10-22-sessions-index-and-creation-options-design.md` in Task 21). Parent: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` §5. Mockups: `docs/design-system/components/ScreenSessionCreate`, `ScreenPokerBefore`, `SessionTypePicker`, `Pagination`, `EmptyState`, `MobileDashboard` — for each, the `README.md` and the `preview.html`.

**Not in this plan:** scheduling (SE-2: "Schedule…", a start time, "starts in 5 min"), which is backlog by the owner's word, with no place reserved; the "ROTI at the end" switch; the invitation link inside the dialog (D-08); the team dashboard's recent sessions table and next retro (TM-1, TM-2: plan 23, which calls `ListTeamSessions`); the rest of spec §3; browser walkthroughs (owner's working rule).

**Tasks:** 22. Step A, single writer: 1. Lane S (Sessions page): 2, 3, 4, 14. Lane K (ticket details): 5, 6, 15. Lane C (creation options, after plan 21): 7 to 12, 16, 17, 18. Step C foundation, single writer: 13. Final: 19 (translations), 20 (captures), 21 (deviations and documents), 22 (four-engine suites and report).

## Branch and run

- Base: `main` once plan 21 (retro facilitation, RT-1 to RT-10) is merged — lane C needs RT-3 (the per-card vote cap: its column, its validation in `RetroSettingsController`, its check in the vote endpoint) and the retro timer as RT-2 (pause) and RT-5 (per-topic timer) leave it. Before Task 1 check, and stop if one fails: `bin/test-db` exists and `bin/test-db pgsql -- tests/Arch` passes; `tests/Concurrency/Support/Race.php` exists; `app/Actions/Search/ListRecentSessions.php`, `app/Actions/Integrations/ImportPokerTasks.php` and `resources/js/components/teams/session-create/new-session-dialog.tsx` exist; the last migration of `database/migrations` is dated before `2026_10_22_100000` (plan 21 may have used `2026_10_21_…`; if it used `2026_10_22_…`, date this plan's migrations `2026_10_23_…` and say so in the report).
- **If plan 21 is not merged yet**, Task 1 and lanes S and K may run from `main` as it is; lane C waits. Record in `.superpowers/sdd/roadmap/plan-22/progress.md` which base each lane was cut from.
- Branch `plan-22-sessions` from that base. No merge into `main`, no push.
- Lanes run in git worktrees on branches `lane/22-<name>`, cut from the head named in **Lanes**; the controller merges one lane at a time and runs the gates after each merge: `npm run types:check`, `npm run check`, `npm run build:front`, `vendor/bin/pint --dirty --format agent`, `vendor/bin/sail composer types:check`, and `bin/test-db pgsql -- tests/Feature/Sessions tests/Feature/Poker tests/Feature/Retros tests/Feature/Integrations tests/Arch`.
- From a worktree, `bin/test-db` needs `TEST_DB_CONTAINER` and `TEST_DB_WORKDIR`; MariaDB and MySQL are started once with `docker compose up -d mariadb mysql`. Never two whole suites at once in the shared container.
- This plan was written from `main` at `18d3637e`, before plan 21 existed. **Every task re-reads the files it touches**; a line or a method body quoted here that no longer matches is followed in spirit and reported.

## Owner decisions

Spec §15. "Plan written on" is the recommended option; the last column names what changes with another answer.

| # | Question | Plan written on | If the owner answers otherwise |
|---|---|---|---|
| 1 | "Upcoming" without scheduling | **A**: created and not started | **B**: Task 2 drops `SessionState::Upcoming` (its rows join Live), Task 14 renders two tabs. **C**: Task 2 returns an empty Upcoming; Task 14's empty state says scheduling comes later |
| 2 | Whiteboards and rooms, which never end | **A**: board by 15-minute activity, room by round in play | **B**: Task 2's whiteboard and room Live clauses become "has elements / has rounds", Finished is empty for them. **C**: a new column and action (about two more tasks); Task 2 reads `archived_at` |
| 3 | "Timer per phase" | **A**: starts by itself at phase entry | **B**: Task 7 drops the change to `ChangeRetroPhase`; the snapshot's `phaseDurations` feeds the facilitator's timer menu (Task 16 adds the first entry "Phase: n min"). **C**: Task 1 adds `retros.phase_timers_auto` (boolean), Task 7 reads it, Task 16 adds the switch |
| 4 | "Timer per task" at expiry | **A**: today's round timer (reveal only with auto reveal) | **B**: Task 9 replaces the timer by a delayed job that notifies non-voters (new event, new toast). **C**: Task 9 adds a `force` flag to `RevealPokerRoundOnTimer` |
| 5 | "Write estimates" | **A**: per game, on/off and field | **B**: Task 10 writes the team connection's `storyPointFieldOverride` from the creation request (with `manageIntegrations`), drops `estimate_field_id`. **C**: Task 10 drops `estimate_field_id`; Task 17 shows the field read-only |
| 6 | Acceptance criteria source | **A**: a detected Jira text field, changeable | **B**: Task 5 parses a description section instead (no setting, Task 15 drops the settings select). **C**: Task 5 drops the column and Task 15 the block; D-16 keeps that part |
| 7 | Trackers offered by the creation import | **A**: every connected tracker | **B**: Task 12 restricts `{source}` to `jira|jira_dc`; Task 18 has no source select for Linear or GitHub |
| 8 | Dates on rows | **A**: last activity on Upcoming and Finished rows | **B**: Task 14 drops the date |

## File structure

Back end, created:

| File | Responsibility |
|---|---|
| `database/migrations/2026_10_22_100000_add_session_options_to_retros_and_poker_games.php` | `retros.phase_durations`; the four `poker_games` columns |
| `database/migrations/2026_10_22_100100_add_ticket_details_to_poker_tasks.php` | `external_type`, `external_labels`, `external_acceptance_criteria` |
| `app/Enums/SessionState.php` | Upcoming, Live, Finished |
| `app/Support/Sessions/SessionCursor.php` | the `(updated_at, id)` cursor and its string form |
| `app/Actions/Sessions/ListTeamSessions.php` | the five queries, the merge, the rows |
| `app/Actions/Teams/PresentNewSessionOptions.php` | the props of the "New session" dialog |
| `app/Http/Controllers/TeamSessionsController.php` | the Sessions page |
| `app/Support/Retros/PhaseDurations.php` | the timed phases, the standard set, validation, seconds per phase |
| `app/Actions/Poker/PokerGameSettingsRules.php` | validation of the four poker settings, shared by creation and settings |
| `app/Actions/Integrations/FetchPokerImport.php`, `PokerImportBatch.php` | the creation import: resolve, fetch, map tracker errors to validation |
| `app/Http/Controllers/Integrations/TeamPokerImportContainersController.php`, `TeamPokerImportIterationsController.php`, `TeamPokerImportPreviewsController.php` | team-scoped browse |

Back end, modified: `app/Models/Retro.php`, `PokerGame.php`, `PokerTask.php`; `database/factories/TeamIntegrationFactory.php`; `app/Http/Controllers/TeamsController.php`, `TeamRetrosController.php`, `TeamPokerGamesController.php`, `Retros/RetroSettingsController.php`, `Poker/PokerSettingsController.php`; `app/Actions/Retros/NewRetro.php`, `CreateRetro.php`, `ChangeRetroPhase.php`, `BuildBoardSnapshot.php`; `app/Actions/Poker/NewPokerGame.php`, `CreatePokerGame.php`, `PokerGuard.php`, `PlayPokerCard.php`, `StartPokerRound.php`, `BuildPokerSnapshot.php`, `PresentPokerTask.php`; `app/Actions/Integrations/ImportPokerTasks.php`, `ApplyPokerTaskIssues.php`, `RefreshPokerTasks.php`, `RequestEstimateSync.php`, `PokerTaskSync.php`, `ListPokerSources.php`, `DetectJiraStoryPointFields.php`, `UpdateTeamIntegration.php`, `PresentTeamIntegration.php`; `app/Support/Integrations/Trackers/TrackerIssue.php`, `JiraIssueTracker.php`, `LinearTracker.php`, `GitHubTracker.php`; `routes/web.php`; `tests/Pest.php`.

Tests, created: `tests/Feature/Sessions/TeamSessionsTest.php`, `ListTeamSessionsTest.php`, `NewSessionOptionsTest.php`; `tests/Unit/Support/SessionCursorTest.php`, `PhaseDurationsTest.php`; `tests/Feature/Retros/PhaseTimersTest.php`; `tests/Feature/Poker/RevoteAfterRevealTest.php`, `TaskTimerTest.php`, `PokerGameOptionsTest.php`; `tests/Feature/Integrations/PokerEstimateWriteBackOptionTest.php`, `PokerCreationImportTest.php`, `TicketDetailsTest.php`; `tests/Concurrency/RevoteAfterRevealTest.php`; `tests/Browser/Visual/SessionsPagesVisualTest.php` (captures only).

Front end, created: `resources/js/pages/teams/sessions.tsx`; `resources/js/components/teams/sessions-page.tsx`, `team-new-session-dialog.tsx`; `resources/js/components/skrum/session-row.tsx`; `resources/js/lib/teams/sessions.ts`; `resources/js/lib/retro/phase-durations.ts`; `resources/js/components/teams/session-create/phase-timers-field.tsx`, `poker-import-field.tsx`; `resources/js/components/poker/tracker-issue-picker.tsx`, `ticket-details.tsx`; `resources/js/lib/poker/tracker-browse.ts`; each with its `.test.ts(x)`. Modified: `components/teams/team-page.tsx`, `session-create/retro-session-fields.tsx`, `poker-session-fields.tsx`, `poker-tasks-field.tsx`; `components/skrum/session-type-picker.tsx` (exports the kind tones), `app-sidebar.tsx` (nothing but tests), `mobile-tab-bar.tsx`; `hooks/use-sidebar-model.ts`; `components/retro/board-settings.tsx`; `components/poker/room-topbar.tsx` (settings popover), `room-dock.tsx`, `story-card.tsx`, `import-tasks-dialog.tsx`; `components/integrations/story-points-field.tsx` (sibling select); `lib/poker/types.ts`, `lib/retro/types.ts`, `types/*.ts`.

## Global Constraints

- **Mockup first** (parent spec §5 rule 13). A screen follows its mockup; a difference is fixed or is a row of **Pre-build deviations**, put to the owner before its screen is built. Captures are taken once, in Task 20, in light, at 1440, in French.
- **Front rules** of the parent spec §5: tokens only, rem, Tailwind scale, no overflow from 20rem to 60rem, visible focus, contrast, reduced motion, lucide icons, literal `t('…')`, presentational `skrum/` components (no network, no router). Reuse: `teams/session-create/*` (`SettingRow`, `FieldError`, `SessionFormFooter`), `skrum/empty-state`, `skrum/skeletons` ("Loading sessions"), `ui/pagination` (`LoadMore`, `LoadMoreFeed`), `ui/tabs`, `ui/select`, `ui/switch`, `skrum/session-type-picker` (kind colours and icons).
- **Database (owner rule): Eloquent and the standard query builder only.** `docs/database.md` rules 1 to 12 on every line of PHP, migration and test; `tests/Arch/DatabasePortabilityTest.php` enforces them. No raw query of any form; no driver test; migrations with the Schema builder, `up` only, nullable `timestamp()`, no `enum()`, no collation, no JSON default (defaults in the model's `$attributes`), names within 64 characters; a transaction locks the aggregate root first (poker: the game; retro: the retro) and is retried with `Transactions::Attempts` only when it touches nothing but the database (the ones here broadcast or call a tracker: no retry); an explicit tie-breaker on every sort; JSON columns compared with `toBeIgnoringKeyOrder`; writes never skip model events.
- **Tests per task, on pgsql and sqlite.** Each task runs the tests it wrote or touched on PostgreSQL and SQLite: `bin/test-db pgsql -- <paths>`, then `bin/test-db sqlite -- <paths>`. The red step ("see it fail") may run once on SQLite in memory: `vendor/bin/sail artisan test --compact <path>`. The race of Task 8 runs on the four engines (`bin/test-db <pgsql|mariadb|mysql|sqlite-file> --concurrency -- tests/Concurrency/RevoteAfterRevealTest.php`), never in memory, never in parallel. The whole suites run on the four engines at lane merges (`bin/test-db pgsql` then `sqlite`; `mariadb` and `mysql` at the last lane merge) and in Task 22.
- **No data migration.** The new columns have defaults that keep today's behaviour; no `tests/Upgrade` test is needed. A task that finds it must backfill stops and asks.
- **Working rules (owner):** unit, feature, arch and concurrency tests are written and run; Vitest is written and run (`npm run test -- <pattern>` per task, the whole suite in Task 22); **no browser walkthrough** is written, edited or run; **captures light/1440/fr only**, in Task 20.
- **No new dependency**, PHP or JS, without the owner's approval.
- **Four languages, informal.** Every new `__('…')` and `t('…')` key goes into `lang/en.json`, `fr.json`, `es.json`, `de.json` in the commit that introduces it (`tests/Feature/TranslationKeysTest.php`), French "tu", Spanish "tú", German "du" (`tests/Feature/InformalRegisterTest.php`). A key that exists keeps its value. Task 19 reviews them.
- **No test is deleted** without the owner's approval.
- UUID keys; files created with `vendor/bin/sail artisan make:… --no-interaction`; controllers plural with CRUD names (`tests/Arch/ArchTest.php`); route names camelCase, URLs kebab-case, tuple notation; every rendered page has its file under `resources/js/pages` (`tests/Arch/FrontEndPagesTest.php`).
- Arch facts: models do not use `App\Actions`, `App\Http`, `App\Mcp`; actions do not use `App\Http`; `App\Support`, jobs and events do not use `App\Http` or `App\Mcp`; enums use nothing of the application; no class is `final`.
- PHP style: early returns, no `else`, happy path last, typed everything, PascalCase constants, constructor promotion, no comment that restates code; before each commit `vendor/bin/pint --dirty --format agent` and `vendor/bin/sail composer types:check`.
- Octane is installed: no static or per-request singleton state.
- Front gates after every task that touches the front: `npm run types:check`, `npm run check`, `npm run build:front` (it runs `wayfinder:generate --with-form`, needed after every new route the front uses).
- **Commits:** one per task, in the repository's style (`feat(sessions): …`, `feat(poker): …`, `feat(retro): …`, `test: …`), each ending with the two lines:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE
```

- **Never push, never merge into `main`.**

## Pre-build deviations

Put to the owner before the screen is built. Reasons as in plan 18e: **F** false or unsafe, **A** accessibility, **N** no such data or concept, **S** this spec, **O** an owner's answer.

| # | Screen | Mockup element | Built | Reason |
|---|---|---|---|---|
| P22-01 | Sessions page | rows without a date | the last activity date ends the meta line on Upcoming and Finished rows | S: decision 8 |
| P22-02 | Sessions page | the Upcoming tab | sessions created and not started (spec §6.1) | N: no scheduling (backlog); decision 1 |
| P22-03 | Sessions page | — (Live tab only drawn) | empty states per tab, "Load more" and its end line from the `Pagination` mockup | N: no frame for them |
| P22-04 | Dialog, retro | "ROTI at the end" switch | not rendered | O: backlog (ROTI is always a phase) |
| P22-05 | Dialog, retro | "Timer per phase" select showing "Custom (5 phases)" | options "No timer", "Standard", "Custom (5 phases)"; Custom opens five minute steppers under the row | N: the mockup draws the closed select only |
| P22-06 | Dialog, poker | "Timer per task: 2 minutes" | the choices Off, 1, 3, 5, 10 minutes | O: X5 (one list 1/3/5/10) |
| P22-07 | Dialog, poker | "Schedule…" in the footer | not rendered, no place | O: scheduling is backlog |
| P22-08 | Dialog, poker | "Import from Jira" | "Import from <source>", with a source select when the team has two trackers or more | S: decision 7 |
| P22-09 | Dialog, poker | "Write estimates to Jira · Story points" | for Linear and GitHub the row reads "Write estimates to <source>" with "Write" / "Don't write" | N: no field choice on those sources |
| P22-10 | Dialog, retro and poker | the invitation link "skrum.atlas.dev/j/R7K-42Q · Copy link" | unchanged (still not rendered: D-08) | N: the link exists only once the session does |
| P22-11 | Poker room | acceptance criteria as a plain list | the field's Markdown rendered (a list when the field holds one) | N: the source's own format |
| P22-12 | Poker room | settings popover (D-70) | three more rows: Timer per task, Change vote after reveal, Write estimates | S: spec §9.4 ("les réglages restent modifiables dans la session") |
| P22-13 | Retro | settings popover | one more row: Timer per phase | S: spec §9.4 |
| P22-14 | Team integrations | — | "Acceptance criteria field" select beside the story-points field | S: decision 6; no mockup for the settings of a connection |

## Review Focus

1. **A session that sits on a page boundary** ("Load more" twice while sessions of five kinds share timestamps): no duplicate, no gap. Walk test in Task 2, on pgsql and sqlite in the task, on the four engines in Task 22.
2. **A card changed after reveal while the facilitator saves the estimate**: either applied before the save or refused after it, never after. Race in Task 8.
3. **The reveal and the timer endpoints after `acceptsCard`**: a revealed round must still refuse a second reveal and a timer. Test in Task 8.
4. **An import at creation whose tracker fails** (expired token, a 500): no game is left behind, the message is on the import tab. Test in Task 12.
5. **A guest reading a poker payload**: ticket details yes, assignee and sync errors no. Test in Task 6.

## Lanes

| Lane | Tasks | Cut from | Shares with other lanes |
|---|---|---|---|
| main | 1, 13, 19 to 22 | — | — |
| S (Sessions page) | 2, 3, 4, then 14 | head of Task 1 (14 after Task 13 is merged into it) | `routes/web.php` (one block), `app/Http/Controllers/TeamsController.php` (Task 3 only), `lang/*.json` |
| K (ticket details) | 5, 6, then 15 | head of Task 1 (15 after Task 13) | `app/Actions/Integrations/ImportPokerTasks.php` and `ApplyPokerTaskIssues.php` (also lane C, Task 12: K merges first), `database/factories/TeamIntegrationFactory.php`, `tests/Pest.php` (one block), `lang/*.json` |
| C (creation options) | 7 to 12, then 16, 17, 18 | head of Task 1 **with plan 21 merged** and lanes S and K merged (Task 12 needs K's `ImportPokerTasks`, Task 11's props go through S's `PresentNewSessionOptions`) | `routes/web.php`, `PokerSettingsController`, `RetroSettingsController`, `retro-session-fields.tsx`, `poker-session-fields.tsx`, `lang/*.json` |

Task 13 (front foundation: `TeamNewSessionDialog`, kind tones, shared types) runs on main after lanes S and K's back-end tasks are merged and before any screen task. `lang/*.json` conflicts are resolved by the controller at each merge (keys appended in alphabetical blocks per lane). `tests/Pest.php`: lane K adds its helpers in one block at the end of the file; lane C in another.

---

## Step A — schema (single writer)

### Task 1: Columns, casts and defaults

**Files:**
- Create: `database/migrations/2026_10_22_100000_add_session_options_to_retros_and_poker_games.php`, `database/migrations/2026_10_22_100100_add_ticket_details_to_poker_tasks.php`, `app/Enums/SessionState.php`
- Modify: `app/Models/Retro.php`, `app/Models/PokerGame.php`, `app/Models/PokerTask.php`
- Test: `tests/Feature/Poker/PokerGameOptionsTest.php`

Read first: `docs/database.md` rule 5 and rule 10; `app/Models/PokerGame.php` (`#[Fillable]`, `casts()`); `app/Models/Retro.php` (`#[Fillable]`, `casts()`); `app/Models/PokerTask.php` (the `external_*` columns are not fillable: written with `forceFill` by the trackers only).

**Interfaces:**
- Produces: `retros.phase_durations` (JSON, nullable; cast `array`; fillable); `poker_games.revote_after_reveal` (bool, default false), `task_timer_seconds` (unsigned small int, nullable), `writes_estimates` (bool, default true), `estimate_field_id` (string 100, nullable), all fillable and cast; `PokerGame::TaskTimerChoices = [60, 180, 300, 600]`; `poker_tasks.external_type` (string 60, nullable), `external_labels` (JSON, nullable, cast `array`), `external_acceptance_criteria` (text, nullable), not fillable; `App\Enums\SessionState` (`Upcoming = 'upcoming'`, `Live = 'live'`, `Finished = 'finished'`).

- [ ] **Step 1: Write the failing test**

`tests/Feature/Poker/PokerGameOptionsTest.php`:

```php
<?php

use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;

it('keeps today behaviour on a game created without the new options', function () {
    $game = PokerGame::factory()->create()->fresh();

    expect($game->revote_after_reveal)->toBeFalse()
        ->and($game->task_timer_seconds)->toBeNull()
        ->and($game->writes_estimates)->toBeTrue()
        ->and($game->estimate_field_id)->toBeNull();
});

it('stores the poker options with their types', function () {
    $game = PokerGame::factory()->create([
        'revote_after_reveal' => true,
        'task_timer_seconds' => 180,
        'writes_estimates' => false,
        'estimate_field_id' => 'customfield_10016',
    ])->fresh();

    expect($game->revote_after_reveal)->toBeTrue()
        ->and($game->task_timer_seconds)->toBe(180)
        ->and($game->writes_estimates)->toBeFalse()
        ->and($game->estimate_field_id)->toBe('customfield_10016')
        ->and(PokerGame::TaskTimerChoices)->toBe([60, 180, 300, 600]);
});

it('stores phase durations as an object of minutes, null by default', function () {
    $retro = Retro::factory()->create();

    expect($retro->fresh()->phase_durations)->toBeNull();

    $retro->update(['phase_durations' => ['writing' => 7, 'voting' => 3]]);

    expect($retro->fresh()->phase_durations)->toBeIgnoringKeyOrder(['writing' => 7, 'voting' => 3]);
});

it('keeps ticket details out of mass assignment', function () {
    $task = PokerTask::factory()->create();

    $task->fill(['external_type' => 'Story', 'external_labels' => ['ui'], 'external_acceptance_criteria' => 'x'])->save();

    expect($task->fresh()->only(['external_type', 'external_labels', 'external_acceptance_criteria']))
        ->toBe(['external_type' => null, 'external_labels' => null, 'external_acceptance_criteria' => null]);

    $task->forceFill(['external_type' => 'Story', 'external_labels' => ['ui', 'api'], 'external_acceptance_criteria' => '- one'])->save();

    expect($task->fresh()->external_labels)->toBe(['ui', 'api'])
        ->and($task->fresh()->external_type)->toBe('Story');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerGameOptionsTest.php`
Expected: FAIL (unknown columns).

- [ ] **Step 3: Write the migrations, the enum and the model changes**

`database/migrations/2026_10_22_100000_add_session_options_to_retros_and_poker_games.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('retros', function (Blueprint $table) {
            $table->json('phase_durations')->nullable();
        });

        Schema::table('poker_games', function (Blueprint $table) {
            $table->boolean('revote_after_reveal')->default(false);
            $table->unsignedSmallInteger('task_timer_seconds')->nullable();
            $table->boolean('writes_estimates')->default(true);
            $table->string('estimate_field_id', 100)->nullable();
        });
    }
};
```

`database/migrations/2026_10_22_100100_add_ticket_details_to_poker_tasks.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('poker_tasks', function (Blueprint $table) {
            $table->string('external_type', 60)->nullable();
            $table->json('external_labels')->nullable();
            $table->text('external_acceptance_criteria')->nullable();
        });
    }
};
```

`app/Enums/SessionState.php`:

```php
<?php

namespace App\Enums;

enum SessionState: string
{
    case Upcoming = 'upcoming';
    case Live = 'live';
    case Finished = 'finished';
}
```

`app/Models/PokerGame.php`: add to `#[Fillable]` `'revote_after_reveal', 'task_timer_seconds', 'writes_estimates', 'estimate_field_id'`; the `@property` lines; the constant and the model defaults (the database defaults exist, but a model created in memory must read them before it is saved):

```php
    /** Seconds a task timer may start with: X5's one list, 1, 3, 5 and 10 minutes. */
    public const array TaskTimerChoices = [60, 180, 300, 600];

    /** @var array<string, mixed> */
    protected $attributes = [
        'revote_after_reveal' => false,
        'writes_estimates' => true,
    ];
```

and in `casts()`: `'revote_after_reveal' => 'boolean'`, `'task_timer_seconds' => 'integer'`, `'writes_estimates' => 'boolean'`.

`app/Models/Retro.php`: `'phase_durations'` in `#[Fillable]`, `@property array<string, int>|null $phase_durations`, and `'phase_durations' => 'array'` in `casts()`.

`app/Models/PokerTask.php`: `@property` lines for the three columns (not fillable); in `casts()` `'external_labels' => 'array'`. Extend the class docblock sentence: "The external_*, needs_sync, sync_error and synced_at columns — ticket details included — are written only by the tracker imports, refreshes and write-back".

- [ ] **Step 4: Run the tests on pgsql and sqlite**

Run: `bin/test-db pgsql -- tests/Feature/Poker/PokerGameOptionsTest.php tests/Feature/Poker/PokerModelTest.php tests/Arch`, then the same with `sqlite`.
Expected: PASS on both. Then `bin/test-db mariadb -- tests/Feature/Poker/PokerGameOptionsTest.php` and `mysql` once (the JSON column and the defaults are engine-sensitive). Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_10_22_1000*.php app/Enums/SessionState.php app/Models/Retro.php app/Models/PokerGame.php app/Models/PokerTask.php tests/Feature/Poker/PokerGameOptionsTest.php
git commit -m "feat(sessions): columns for phase timers, poker options and ticket details

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

---

## Lane S — the Sessions page (back end)

### Task 2: `ListTeamSessions` — states, order, cursor

**Files:**
- Create: `app/Support/Sessions/SessionCursor.php`, `app/Actions/Sessions/ListTeamSessions.php`
- Test: `tests/Unit/Support/SessionCursorTest.php`, `tests/Feature/Sessions/ListTeamSessionsTest.php`

Read first: `app/Actions/Search/ListRecentSessions.php` (the closest reader: per-kind queries, `LiveWithinMinutes = 15`), `app/Actions/TeamSurveys/PresentTeamSurveySummary.php` (`withCounts`: respondents with an answer), `app/Models/{Retro,PokerGame,Whiteboard,GameRoom,TeamSurvey}.php` (relations `cards`, `participants`, `rounds` (HasManyThrough on the game), `elements`, `facilitator`), `app/Enums/GameKind.php` (`label()`), `app/Enums/RetroPhase.php` (`label()`).

**Interfaces:**
- Consumes: `SessionState` (Task 1).
- Produces:
  - `SessionCursor` with public `CarbonImmutable $updatedAt`, `string $id`; `SessionCursor::parse(?string $value): ?self` (null for null, empty or malformed); `SessionCursor::after(Model $session): self`; `toString(): string` (`<ISO 8601 UTC>|<id>`).
  - `ListTeamSessions::handle(Team $team, User $viewer, SessionState $state, ?SessionCursor $before = null, int $limit = self::PageSize): array{sessions: list<TeamSession>, total: int, nextCursor: ?string}` with `PageSize = 20`, `LiveWithinMinutes = 15`, and the row shape `TeamSession`:

```php
/**
 * @phpstan-type TeamSession array{
 *     kind: 'retro'|'poker'|'whiteboard'|'survey'|'icebreaker',
 *     id: string,
 *     title: string,
 *     url: string,
 *     state: string,
 *     updatedAt: string,
 *     isDraft: bool,
 *     phase: ?string,
 *     people: ?int,
 *     tasks: ?int,
 *     facilitator: ?string,
 *     answers: ?int,
 *     game: ?string
 * }
 */
```

- [ ] **Step 1: Write the failing tests**

`tests/Unit/Support/SessionCursorTest.php`:

```php
<?php

use App\Support\Sessions\SessionCursor;
use Carbon\CarbonImmutable;

it('reads back the cursor it writes', function () {
    $cursor = new SessionCursor(CarbonImmutable::parse('2026-10-03 09:15:42', 'UTC'), '0199a1b2-0000-7000-8000-000000000001');

    $read = SessionCursor::parse($cursor->toString());

    expect($cursor->toString())->toBe('2026-10-03T09:15:42+00:00|0199a1b2-0000-7000-8000-000000000001')
        ->and($read?->updatedAt->equalTo($cursor->updatedAt))->toBeTrue()
        ->and($read?->id)->toBe($cursor->id);
});

it('refuses what it did not write', function (?string $value) {
    expect(SessionCursor::parse($value))->toBeNull();
})->with([
    'null' => [null],
    'empty' => [''],
    'no separator' => ['2026-10-03T09:15:42+00:00'],
    'bad date' => ['yesterday|0199a1b2-0000-7000-8000-000000000001'],
    'bad id' => ['2026-10-03T09:15:42+00:00|1; drop'],
]);
```

`tests/Feature/Sessions/ListTeamSessionsTest.php` (hand-built matrix of spec §6.1; `travelTo` fixes the clock):

```php
<?php

use App\Actions\Sessions\ListTeamSessions;
use App\Enums\RetroPhase;
use App\Enums\SessionState;
use App\Models\Card;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Support\Sessions\SessionCursor;

function sessionsOf(Team $team, User $viewer, SessionState $state, ?string $before = null): array
{
    return app(ListTeamSessions::class)->handle($team, $viewer, $state, SessionCursor::parse($before));
}

function titlesIn(array $page): array
{
    return array_column($page['sessions'], 'title');
}

beforeEach(fn () => $this->travelTo(now()->startOfMinute()));

it('puts each kind in the state its stored data says', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);

    Retro::factory()->for($team)->create(['title' => 'retro upcoming']);
    Retro::factory()->for($team)->started()->create(['title' => 'retro started']);
    $legacy = Retro::factory()->for($team)->create(['title' => 'retro legacy with cards']);
    Card::factory()->create(['retro_id' => $legacy->id]);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'retro done']);

    PokerGame::factory()->for($team)->create(['title' => 'poker upcoming']);
    $playing = PokerGame::factory()->for($team)->create(['title' => 'poker live']);
    openPokerRound($playing);
    PokerGame::factory()->for($team)->ended()->create(['title' => 'poker done']);

    $facilitatorSurvey = TeamSurvey::factory()->for($team)->draft()->create(['title' => 'poll draft']);
    TeamSurvey::factory()->for($team)->open()->create(['title' => 'poll open']);
    TeamSurvey::factory()->for($team)->closed()->create(['title' => 'poll closed']);
    TeamSurvey::factory()->for($team)->open()->attachedTo(Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'retro with attached']))->create(['title' => 'poll attached']);

    Whiteboard::factory()->for($team)->create(['title' => 'board empty']);
    $busy = Whiteboard::factory()->for($team)->create(['title' => 'board busy']);
    WhiteboardElement::factory()->create(['whiteboard_id' => $busy->id]);
    $this->travelTo(now()->subMinutes(16));
    $quiet = Whiteboard::factory()->for($team)->create(['title' => 'board quiet']);
    WhiteboardElement::factory()->create(['whiteboard_id' => $quiet->id]);
    $this->travelBack();
    $this->travelTo(now()->startOfMinute());

    GameRoom::factory()->for($team)->create(['name' => 'room new']);
    $live = GameRoom::factory()->for($team)->create(['name' => 'room live']);
    activeGameRound($live);
    playedRoom($team, 'room between');
    GameRoom::factory()->icebreaker(Retro::factory()->for($team)->started()->create(['title' => 'retro with room']))->create(['name' => 'room of a retro']);

    expect(titlesIn(sessionsOf($team, $viewer, SessionState::Upcoming)))->toEqualCanonicalizing(['retro upcoming', 'poker upcoming', 'board empty', 'room new'])
        ->and(titlesIn(sessionsOf($team, $viewer, SessionState::Live)))->toEqualCanonicalizing(['retro started', 'retro legacy with cards', 'retro with room', 'poker live', 'poll open', 'board busy', 'room live'])
        ->and(titlesIn(sessionsOf($team, $viewer, SessionState::Finished)))->toEqualCanonicalizing(['retro done', 'retro with attached', 'poker done', 'poll closed', 'board quiet', 'room between']);
});
```

Ages are set through the clock (`travelTo`), never with `saveQuietly()` or a raw `updated_at` write: `tests/Arch/DatabasePortabilityTest.php` refuses writes that skip model events. The helper used above and below goes at the top of the file:

```php
function playedRoom(Team $team, string $name): GameRoom
{
    $room = GameRoom::factory()->for($team)->create(['name' => $name]);
    activeGameRound($room);
    $room->forceFill(['current_round_id' => null])->save();

    return $room;
}
```

(`activeGameRound` of `tests/Pest.php` sets `current_round_id`; read it, and end the round the way the game code does if a plain `null` breaks an invariant of `GameRoom`.)

```php
it('lists a draft poll to its editors only', function () {
    $team = Team::factory()->create();
    $editor = teamMember($team);
    $other = teamMember($team);
    $survey = TeamSurvey::factory()->for($team)->draft()->create(['title' => 'poll draft']);
    surveyFacilitatorFor($survey, $editor);

    expect(titlesIn(sessionsOf($team, $editor, SessionState::Upcoming)))->toBe(['poll draft'])
        ->and(sessionsOf($team, $editor, SessionState::Upcoming)['sessions'][0]['isDraft'])->toBeTrue()
        ->and(titlesIn(sessionsOf($team, $other, SessionState::Upcoming)))->toBe([])
        ->and(titlesIn(sessionsOf($team, workspaceManager($team->workspace), SessionState::Upcoming)))->toBe(['poll draft']);
});

it('walks 45 sessions of five kinds in pages of 20 without a duplicate or a gap', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    $start = now()->subHours(2);
    $expected = [];

    foreach (range(1, 45) as $index) {
        $this->travelTo($start->copy()->addMinutes(intdiv($index, 3)));
        $title = "s{$index}";
        $expected[] = $title;

        match ($index % 5) {
            0 => Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => $title]),
            1 => PokerGame::factory()->for($team)->ended()->create(['title' => $title]),
            2 => TeamSurvey::factory()->for($team)->closed()->create(['title' => $title]),
            3 => tap(Whiteboard::factory()->for($team)->create(['title' => $title]), fn (Whiteboard $board) => WhiteboardElement::factory()->create(['whiteboard_id' => $board->id])),
            default => playedRoom($team, $title),
        };
    }

    $this->travelTo($start->copy()->addHours(2));

    $first = sessionsOf($team, $viewer, SessionState::Finished);
    $second = sessionsOf($team, $viewer, SessionState::Finished, $first['nextCursor']);
    $third = sessionsOf($team, $viewer, SessionState::Finished, $second['nextCursor']);
    $seen = [...titlesIn($first), ...titlesIn($second), ...titlesIn($third)];

    expect(count($first['sessions']))->toBe(20)
        ->and(count($second['sessions']))->toBe(20)
        ->and(count($third['sessions']))->toBe(5)
        ->and($third['nextCursor'])->toBeNull()
        ->and($first['total'])->toBe(45)
        ->and($seen)->toHaveCount(45)
        ->and(array_unique($seen))->toHaveCount(45)
        ->and($seen)->toEqualCanonicalizing($expected);

    $flat = [...$first['sessions'], ...$second['sessions'], ...$third['sessions']];

    foreach (array_slice($flat, 1) as $position => $row) {
        $previous = $flat[$position];
        $ordered = $previous['updatedAt'] > $row['updatedAt']
            || ($previous['updatedAt'] === $row['updatedAt'] && strcmp($previous['id'], $row['id']) > 0);

        expect($ordered)->toBeTrue();
    }
});

it('describes each row with the data of its kind', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    $retro = Retro::factory()->for($team)->started()->inPhase(RetroPhase::Voting)->create(['title' => 'R']);
    Participant::factory()->count(2)->create(['retro_id' => $retro->id]);
    Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => null, 'guest_name' => 'Ada']);
    $game = PokerGame::factory()->for($team)->create(['title' => 'P']);
    PokerTask::factory()->count(3)->create(['poker_game_id' => $game->id]);
    openPokerRound($game, $game->tasks()->first());

    $rows = collect(sessionsOf($team, $viewer, SessionState::Live)['sessions'])->keyBy('title');

    expect($rows['R'])->toMatchArray(['kind' => 'retro', 'phase' => RetroPhase::Voting->label(), 'people' => 3, 'url' => route('retros.show', $retro), 'state' => 'live'])
        ->and($rows['P'])->toMatchArray(['kind' => 'poker', 'tasks' => 3, 'url' => route('poker.show', $game)]);
});

it('lists nothing of another team', function () {
    $team = Team::factory()->create();
    Retro::factory()->started()->create();

    expect(sessionsOf($team, teamMember($team), SessionState::Live)['sessions'])->toBe([]);
});
```

`surveyFacilitatorFor(TeamSurvey, User)` is the helper of plan 19 if it exists under that name; otherwise use `surveyFacilitator($survey)` (it returns `[User, TeamSurveyRespondent]`) and take its user as the editor. Check `tests/Pest.php` and adapt the two lines; the `guest_name` attribute of `Participant` is read from `ParticipantFactory` (use its guest state if it has one).

- [ ] **Step 2: Run them to see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Support/SessionCursorTest.php tests/Feature/Sessions/ListTeamSessionsTest.php`
Expected: FAIL (classes missing).

- [ ] **Step 3: Write `SessionCursor`**

```php
<?php

namespace App\Support\Sessions;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Throwable;

/**
 * The position of the last row of a page in the order every session list
 * uses: `updated_at` descending, then `id` descending.
 */
class SessionCursor
{
    private const string IdPattern = '/^[0-9a-f-]{36}\z/';

    public function __construct(public CarbonImmutable $updatedAt, public string $id) {}

    public static function parse(?string $value): ?self
    {
        if ($value === null || ! str_contains($value, '|')) {
            return null;
        }

        [$time, $id] = explode('|', $value, 2);

        if (preg_match(self::IdPattern, $id) !== 1) {
            return null;
        }

        try {
            return new self(CarbonImmutable::parse($time)->utc(), $id);
        } catch (Throwable) {
            return null;
        }
    }

    public static function after(Model $session): self
    {
        return new self(CarbonImmutable::parse($session->getAttribute('updated_at'))->utc(), (string) $session->getKey());
    }

    public function toString(): string
    {
        return "{$this->updatedAt->toIso8601String()}|{$this->id}";
    }
}
```

`CarbonImmutable::parse('yesterday')` succeeds: add a check that `$time` matches `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}\z/` before parsing, so that the "bad date" case is refused.

- [ ] **Step 4: Write `ListTeamSessions`**

```php
<?php

namespace App\Actions\Sessions;

use App\Enums\RetroPhase;
use App\Enums\SessionState;
use App\Enums\TeamSurveyStatus;
use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Whiteboard;
use App\Support\Sessions\SessionCursor;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

/**
 * Spec plan 22 §6.1. Five ordered queries, one per kind, each asked for one
 * row more than a page after the cursor; the merge in PHP keeps the same
 * order, so the first page of the merge is the first page of the union.
 * Also read by the team dashboard (TM-2) with a smaller limit.
 *
 * @phpstan-type TeamSession array{kind: string, id: string, title: string, url: string, state: string, updatedAt: string, isDraft: bool, phase: ?string, people: ?int, tasks: ?int, facilitator: ?string, answers: ?int, game: ?string}
 */
class ListTeamSessions
{
    public const int PageSize = 20;

    public const int LiveWithinMinutes = 15;

    /**
     * @return array{sessions: list<TeamSession>, total: int, nextCursor: ?string}
     */
    public function handle(Team $team, User $viewer, SessionState $state, ?SessionCursor $before = null, int $limit = self::PageSize): array
    {
        $queries = [
            'retro' => $this->retros($team, $state)->withCount('participants'),
            'poker' => $this->pokerGames($team, $state)->withCount('tasks'),
            'survey' => $this->surveys($team, $viewer, $state)->with('facilitator')->withCount([
                'respondents as responses_count' => fn (Builder $respondents) => $respondents->whereHas('answers'),
            ]),
            'whiteboard' => $this->whiteboards($team, $state)->with('facilitator'),
            'icebreaker' => $this->rooms($team, $state),
        ];

        $total = 0;
        $rows = collect();

        foreach ($queries as $kind => $query) {
            $total += (clone $query)->count();

            $page = $this->after($query, $before)
                ->orderByDesc('updated_at')
                ->orderByDesc('id')
                ->limit($limit + 1)
                ->get();

            $rows = $rows->concat($page->map(fn (Model $session): array => ['kind' => $kind, 'model' => $session]));
        }

        $ordered = $rows->sort(fn (array $first, array $second): int => $this->compare($first['model'], $second['model']))->values();
        $kept = $ordered->take($limit);

        return [
            'sessions' => $kept->map(fn (array $row): array => $this->present($row['kind'], $row['model'], $state))->values()->all(),
            'total' => $total,
            'nextCursor' => $ordered->count() > $limit ? SessionCursor::after($kept->last()['model'])->toString() : null,
        ];
    }

    /**
     * Newer first, then the larger id first: the order of the queries.
     */
    private function compare(Model $first, Model $second): int
    {
        $byTime = $second->getAttribute('updated_at') <=> $first->getAttribute('updated_at');

        return $byTime !== 0 ? $byTime : strcmp((string) $second->getKey(), (string) $first->getKey());
    }

    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    private function after(Builder $query, ?SessionCursor $before): Builder
    {
        if ($before === null) {
            return $query;
        }

        return $query->where(fn (Builder $older) => $older
            ->where('updated_at', '<', $before->updatedAt)
            ->orWhere(fn (Builder $same) => $same->where('updated_at', $before->updatedAt)->where('id', '<', $before->id)));
    }

    /** @return Builder<Retro> */
    private function retros(Team $team, SessionState $state): Builder
    {
        $query = Retro::query()->where('team_id', $team->id);
        $open = fn (Builder $retros) => $retros->where('phase', '!=', RetroPhase::Completed->value);

        return match ($state) {
            SessionState::Upcoming => $open($query)->whereNull('started_at')->whereDoesntHave('cards'),
            SessionState::Live => $open($query)->where(fn (Builder $begun) => $begun->whereNotNull('started_at')->orWhereHas('cards')),
            SessionState::Finished => $query->where('phase', RetroPhase::Completed->value),
        };
    }

    /** @return Builder<PokerGame> */
    private function pokerGames(Team $team, SessionState $state): Builder
    {
        $query = PokerGame::query()->where('team_id', $team->id);

        return match ($state) {
            SessionState::Upcoming => $query->whereNull('ended_at')->whereDoesntHave('rounds'),
            SessionState::Live => $query->whereNull('ended_at')->whereHas('rounds'),
            SessionState::Finished => $query->whereNotNull('ended_at'),
        };
    }

    /** @return Builder<TeamSurvey> */
    private function surveys(Team $team, User $viewer, SessionState $state): Builder
    {
        $query = TeamSurvey::query()->where('team_id', $team->id)->whereNull('retro_id');

        return match ($state) {
            SessionState::Upcoming => $this->editableBy($query->where('status', TeamSurveyStatus::Draft->value), $team, $viewer),
            SessionState::Live => $query->where('status', TeamSurveyStatus::Open->value),
            SessionState::Finished => $query->where('status', TeamSurveyStatus::Closed->value),
        };
    }

    /**
     * @param  Builder<TeamSurvey>  $drafts
     * @return Builder<TeamSurvey>
     */
    private function editableBy(Builder $drafts, Team $team, User $viewer): Builder
    {
        if ($viewer->canManage($team->workspace)) {
            return $drafts;
        }

        return $drafts->whereHas('facilitator', fn (Builder $facilitator) => $facilitator->where('user_id', $viewer->id));
    }

    /** @return Builder<Whiteboard> */
    private function whiteboards(Team $team, SessionState $state): Builder
    {
        $query = Whiteboard::query()->where('team_id', $team->id);
        $recently = now()->subMinutes(self::LiveWithinMinutes);

        return match ($state) {
            SessionState::Upcoming => $query->whereDoesntHave('elements'),
            SessionState::Live => $query->whereHas('elements')->where('updated_at', '>=', $recently),
            SessionState::Finished => $query->whereHas('elements')->where('updated_at', '<', $recently),
        };
    }

    /** @return Builder<GameRoom> */
    private function rooms(Team $team, SessionState $state): Builder
    {
        $query = GameRoom::query()->where('team_id', $team->id)->whereNull('retro_id');

        return match ($state) {
            SessionState::Upcoming => $query->whereDoesntHave('rounds'),
            SessionState::Live => $query->whereNotNull('current_round_id'),
            SessionState::Finished => $query->whereHas('rounds')->whereNull('current_round_id'),
        };
    }

    /**
     * @return TeamSession
     */
    private function present(string $kind, Model $session, SessionState $state): array
    {
        $row = [
            'kind' => $kind,
            'id' => (string) $session->getKey(),
            'title' => '',
            'url' => '',
            'state' => $state->value,
            'updatedAt' => (string) $session->getAttribute('updated_at')?->toIso8601String(),
            'isDraft' => false,
            'phase' => null,
            'people' => null,
            'tasks' => null,
            'facilitator' => null,
            'answers' => null,
            'game' => null,
        ];

        return match (true) {
            $session instanceof Retro => [...$row, 'title' => $session->title, 'url' => route('retros.show', $session), 'phase' => $session->phase->label(), 'people' => (int) $session->getAttribute('participants_count')],
            $session instanceof PokerGame => [...$row, 'title' => $session->title, 'url' => route('poker.show', $session), 'tasks' => (int) $session->getAttribute('tasks_count')],
            $session instanceof TeamSurvey => [...$row, 'title' => $session->title, 'url' => $this->surveyUrl($session), 'isDraft' => $session->status === TeamSurveyStatus::Draft, 'answers' => (int) $session->getAttribute('responses_count')],
            $session instanceof Whiteboard => [...$row, 'title' => $session->title, 'url' => route('whiteboards.show', $session), 'facilitator' => $session->facilitator?->displayName()],
            $session instanceof GameRoom => [...$row, 'title' => (string) $session->name, 'url' => route('games.show', $session), 'game' => $session->game->label()],
            default => $row,
        };
    }

    private function surveyUrl(TeamSurvey $survey): string
    {
        return $survey->status === TeamSurveyStatus::Draft
            ? route('surveys.edit', $survey)
            : route('surveys.show', $survey);
    }
}
```

Check while writing: the relation names (`TeamSurvey::respondents`, `TeamSurvey::facilitator`, `TeamSurveyRespondent::answers`, `Whiteboard::facilitator` → `displayName()`), the `TeamSurveyStatus` cases, the `url` rule of `PresentTeamSurveySummary` (follow it if it differs). `Collection` import is used by `collect()` typing only; drop it if PHPStan says it is unused. A `HasManyThrough` (`PokerGame::rounds`) supports `whereHas`/`whereDoesntHave`; if PHPStan or the query disagrees, use `whereHas('tasks.rounds')`.

- [ ] **Step 5: Run the tests on pgsql and sqlite**

Run: `bin/test-db pgsql -- tests/Unit/Support/SessionCursorTest.php tests/Feature/Sessions/ListTeamSessionsTest.php tests/Arch`, then `sqlite`.
Expected: PASS on both.

- [ ] **Step 6: Commit** — `feat(sessions): one list of a team's sessions, by state, with a cursor` (with the two trailer lines).

### Task 3: `PresentNewSessionOptions` — the dialog's props, out of the team page

**Files:**
- Create: `app/Actions/Teams/PresentNewSessionOptions.php`
- Modify: `app/Http/Controllers/TeamsController.php`
- Test: `tests/Feature/Sessions/NewSessionOptionsTest.php`

Read first: `TeamsController@show` as it is (the keys listed below and the private `pokerDecks` method), `tests/Feature/Teams/TeamsTest.php` and `tests/Feature/Poker/TeamPokerSectionTest.php` (they assert these props on `teams/show`; they must pass unchanged).

**Interfaces:**
- Produces: `PresentNewSessionOptions::handle(User $viewer, Workspace $workspace, Team $team): array<string, mixed>` returning exactly the keys `templateCategories`, `topTemplates`, `catalogue` (optional prop), `llm`, `canCreateRetro`, `icebreakerGames`, `gameOptions`, `canCreateGameRoom`, `roomLimit`, `pokerDecks`, `defaultPokerDeck`, `pokerDeckOptions`, `canCreatePokerGame`, `canCreateWhiteboard`, `whiteboardGallery` (optional prop), `surveys`, `canCreateSurvey`, `surveyTemplates`. Task 11 adds `pokerSources`. `TeamsController@show` spreads it.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Actions\Teams\PresentNewSessionOptions;
use App\Models\Team;
use Inertia\Testing\AssertableInertia as Assert;

it('gives the team page the options of the dialog from one place', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $options = app(PresentNewSessionOptions::class)->handle($member, $team->workspace, $team);

    expect(array_keys($options))->toEqualCanonicalizing([
        'templateCategories', 'topTemplates', 'catalogue', 'llm', 'canCreateRetro', 'icebreakerGames', 'gameOptions',
        'canCreateGameRoom', 'roomLimit', 'pokerDecks', 'defaultPokerDeck', 'pokerDeckOptions', 'canCreatePokerGame',
        'canCreateWhiteboard', 'whiteboardGallery', 'surveys', 'canCreateSurvey', 'surveyTemplates',
    ]);

    $this->actingAs($member)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/show')
            ->where('canCreateRetro', true)
            ->where('canCreatePokerGame', true)
            ->has('topTemplates')
            ->has('pokerDeckOptions')
            ->missing('catalogue'));
});
```

- [ ] **Step 2: Run it to see it fail** — `vendor/bin/sail artisan test --compact tests/Feature/Sessions/NewSessionOptionsTest.php`. Expected: FAIL (class missing).

- [ ] **Step 3: Move the code.** Create the action with the constructor dependencies the moved lines use (`Llm`, `BuildTemplateCatalogue`, `IcebreakerGameOptions`, `BuildWhiteboardGallery`, `TopTeamTemplates`, `GameRulesRegistry`, `SurveyTemplateCatalogue`, `PresentTeamSurveySummary`); move the keys listed above out of `TeamsController@show` **verbatim**, with the private `pokerDecks()` method; `$request->user()` becomes `$viewer`. In `TeamsController@show`, replace them with `...$presentNewSessionOptions->handle($request->user(), $workspace, $team)` and remove the constructor and method parameters that only those lines used. The other keys of the team page (members, retros, poker games, whiteboards, trend, presence, …) stay in the controller. `surveys` is used by both the team page's Surveys block and the survey form: it moves to the action and keeps its name.

- [ ] **Step 4: Run the tests on pgsql and sqlite** — `bin/test-db pgsql -- tests/Feature/Sessions/NewSessionOptionsTest.php tests/Feature/Teams tests/Feature/Poker/TeamPokerSectionTest.php tests/Feature/TeamSurveys tests/Feature/Whiteboards`, then `sqlite`. Expected: PASS (the team page's existing tests unchanged).

- [ ] **Step 5: Commit** — `refactor(teams): the New session options in one action` (trailers).

### Task 4: The Sessions page route and controller

**Files:**
- Create: `app/Http/Controllers/TeamSessionsController.php`, `resources/js/pages/teams/sessions.tsx` (thin: renders a heading only; built in Task 14)
- Modify: `routes/web.php`
- Test: `tests/Feature/Sessions/TeamSessionsTest.php`

**Interfaces:**
- Consumes: `ListTeamSessions` (Task 2), `PresentNewSessionOptions` (Task 3), `SessionState`, `SessionCursor`.
- Produces: route `teams.sessions.index` (`GET w/{workspace}/teams/{team}/sessions`), Inertia page `teams/sessions` with props `workspace` (`id`, `name`, `slug`), `team` (`id`, `name`), `tab` (`'upcoming'|'live'|'finished'`), `sessions` (list of `TeamSession`), `total` (int), `nextCursor` (`?string`), and the options of Task 3.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Enums\RetroPhase;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('shows the live sessions of the team by default', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    Retro::factory()->for($team)->started()->create(['title' => 'Sprint 42 retro']);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Old retro']);

    $this->actingAs($member)
        ->get(route('teams.sessions.index', [$team->workspace, $team]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/sessions')
            ->where('tab', 'live')
            ->where('total', 1)
            ->where('nextCursor', null)
            ->where('sessions.0.title', 'Sprint 42 retro')
            ->where('team.id', $team->id)
            ->has('canCreatePokerGame'));
});

it('opens the tab named in the query and pages with before', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->count(21)->create();

    $first = $this->actingAs($member)->get(route('teams.sessions.index', [$team->workspace, $team, 'tab' => 'finished']));
    $cursor = $first->viewData('page')['props']['nextCursor'];

    $this->actingAs($member)
        ->get(route('teams.sessions.index', [$team->workspace, $team, 'tab' => 'finished', 'before' => $cursor]))
        ->assertInertia(fn (Assert $page) => $page->where('tab', 'finished')->has('sessions', 1)->where('total', 21));
});

it('refuses an unknown tab and an outsider', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->get(route('teams.sessions.index', [$team->workspace, $team, 'tab' => 'scheduled']))
        ->assertSessionHasErrors('tab');

    $this->actingAs(User::factory()->create())
        ->get(route('teams.sessions.index', [$team->workspace, $team]))
        ->assertForbidden();
});

it('ignores a malformed cursor and starts from the first page', function () {
    $team = Team::factory()->create();
    Retro::factory()->for($team)->started()->create();

    $this->actingAs(teamMember($team))
        ->get(route('teams.sessions.index', [$team->workspace, $team, 'before' => 'nonsense']))
        ->assertInertia(fn (Assert $page) => $page->has('sessions', 1));
});
```

- [ ] **Step 2: Run it to see it fail.** Expected: FAIL (route missing).

- [ ] **Step 3: Controller, route, thin page**

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Sessions\ListTeamSessions;
use App\Actions\Teams\PresentNewSessionOptions;
use App\Enums\SessionState;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\Sessions\SessionCursor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TeamSessionsController extends Controller
{
    public function index(
        Request $request,
        Workspace $workspace,
        Team $team,
        ListTeamSessions $listTeamSessions,
        PresentNewSessionOptions $presentNewSessionOptions,
    ): Response {
        Gate::authorize('view', $team);

        $validated = $request->validate([
            'tab' => ['sometimes', Rule::enum(SessionState::class)],
            'before' => ['sometimes', 'nullable', 'string', 'max:80'],
        ]);

        $state = SessionState::from($validated['tab'] ?? SessionState::Live->value);
        $page = $listTeamSessions->handle($team, $request->user(), $state, SessionCursor::parse($validated['before'] ?? null));

        return Inertia::render('teams/sessions', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name']),
            'tab' => $state->value,
            'sessions' => $page['sessions'],
            'total' => $page['total'],
            'nextCursor' => $page['nextCursor'],
            ...$presentNewSessionOptions->handle($request->user(), $workspace, $team),
        ]);
    }
}
```

In `routes/web.php`, inside the `w/{workspace}` group, after `teams.show`: `Route::get('teams/{team}/sessions', [TeamSessionsController::class, 'index'])->name('teams.sessions.index');`

`resources/js/pages/teams/sessions.tsx` (thin, replaced in Task 14):

```tsx
import { Head } from '@inertiajs/react';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function TeamSessions() {
    const { t } = useTrans();

    return (
        <AppLayout active="sessions">
            <Head title={t('Sessions')} />
            <h1 className="text-2xl font-title">{t('Sessions')}</h1>
        </AppLayout>
    );
}
```

- [ ] **Step 4: Run the tests on pgsql and sqlite** — `bin/test-db pgsql -- tests/Feature/Sessions tests/Arch`, then `sqlite`; `npm run types:check`, `npm run build:front`. Expected: PASS.

- [ ] **Step 5: Commit** — `feat(sessions): the team Sessions page and its route` (trailers).

---

## Lane K — ticket details (back end)

### Task 5: `TrackerIssue` carries type, labels and acceptance criteria; Jira reads them

**Files:**
- Modify: `app/Support/Integrations/Trackers/TrackerIssue.php`, `JiraIssueTracker.php`; `app/Actions/Integrations/DetectJiraStoryPointFields.php`, `UpdateTeamIntegration.php`, `PresentTeamIntegration.php`; `database/factories/TeamIntegrationFactory.php`; `tests/Pest.php`
- Test: `tests/Feature/Integrations/TicketDetailsTest.php`, `tests/Unit/Support/TrackerIssueLabelsTest.php`

Read first: `JiraIssueTracker::issue()`, `requestedFields()`, `storyPointFieldIds()`; `JiraTracker::description()` (ADF) and `JiraDataCenterTracker::description()` (wiki markup); `DetectJiraStoryPointFields` whole; `UpdateTeamIntegration::rules()` and `handle()`; `PresentTeamIntegration` (the settings keys exposed per provider); `tests/Feature/Integrations/JiraFieldDetectionTest.php` or the test that covers detection (find it with `grep -rl DetectJiraStoryPointFields tests`).

**Interfaces:**
- Produces: `TrackerIssue` constructor gains, after `issueStatus`, `public ?string $type = null`, `public array $labels = []` (list<string>), `public ?string $acceptanceCriteria = null`; constants `TypeLength = 60`, `LabelLength = 60`, `MaxLabels = 10`, `AcceptanceCriteriaLength = 5000`; static `TrackerIssue::labels(mixed $value): list<string>` (strings only, trimmed, non-empty, unique in order, cut to 60, at most 10); static `TrackerIssue::longText(?string $markdown): ?string` (trimmed, null when empty, cut to 5000). `JiraIssueTracker::acceptanceCriteriaFieldId(TeamIntegration): ?string`. Integration settings `textFields` (list of `{id, name}`), `acceptanceCriteriaField` (`?string`), `acceptanceCriteriaFieldChosen` (bool). `DetectJiraStoryPointFields::ensureTextFields(TeamIntegration): void`. Validation key `acceptance_criteria_field_id` (nullable) on Jira and Jira Data Center connections. Test helper `jiraTextField(string $id, string $name): array`.

- [ ] **Step 1: Keep existing tests quiet.** In `TeamIntegrationFactory::jira()` and `jiraDataCenter()` add `'textFields' => []` to `settings`, so that no existing test triggers the detection of Step 5 (they fake no `field` endpoint and prevent stray requests).

- [ ] **Step 2: Write the failing tests**

`tests/Unit/Support/TrackerIssueLabelsTest.php`:

```php
<?php

use App\Support\Integrations\Trackers\TrackerIssue;

it('keeps ten clean labels in the source order', function () {
    $labels = TrackerIssue::labels([' ui ', 'api', 'ui', '', 42, null, str_repeat('x', 70), 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);

    expect($labels)->toBe(['ui', 'api', str_repeat('x', 60), 'a', 'b', 'c', 'd', 'e', 'f', 'g']);
});

it('reads no labels from something that is not a list', function (mixed $value) {
    expect(TrackerIssue::labels($value))->toBe([]);
})->with([[null], ['ui'], [['name' => 'ui']]]);

it('cuts long criteria and drops empty ones', function () {
    expect(TrackerIssue::longText("  \n "))->toBeNull()
        ->and(mb_strlen((string) TrackerIssue::longText(str_repeat('é', 6000))))->toBe(5000);
});
```

Note: `['name' => 'ui']` is a map, not a list: `labels()` reads `array_is_list($value)` first and returns `[]` otherwise.

`tests/Feature/Integrations/TicketDetailsTest.php` (Jira part; lane K adds Linear and GitHub cases in Task 6):

```php
<?php

use App\Actions\Integrations\DetectJiraStoryPointFields;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('imports the type, labels and acceptance criteria of a Jira issue', function () {
    $table = trackerTable();
    $table['integration']->mergeSettings([
        'textFields' => [jiraTextField('customfield_10100', 'Acceptance criteria')],
        'acceptanceCriteriaField' => 'customfield_10100',
    ]);
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1', [
        'issuetype' => ['name' => 'Story'],
        'labels' => ['actions', 'csv'],
        'customfield_10100' => ['type' => 'doc', 'version' => 1, 'content' => [
            ['type' => 'bulletList', 'content' => [
                ['type' => 'listItem', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'UTF-8 encoding']]]]],
            ]],
        ]],
    ])]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.store', [$table['game'], 'jira']), ['external_ids' => ['10001']])
        ->assertCreated();

    $task = PokerTask::query()->where('external_id', '10001')->sole();

    expect($task->external_type)->toBe('Story')
        ->and($task->external_labels)->toBe(['actions', 'csv'])
        ->and($task->external_acceptance_criteria)->toContain('UTF-8 encoding');

    Http::assertSent(fn (Request $request) => str_contains($request->url(), 'search/jql')
        && in_array('issuetype', (array) $request['fields'], true)
        && in_array('labels', (array) $request['fields'], true)
        && in_array('customfield_10100', (array) $request['fields'], true));
});

it('asks for no criteria field when the connection has none', function () {
    $table = trackerTable();
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1', ['customfield_10100' => 'ignored'])]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.store', [$table['game'], 'jira']), ['external_ids' => ['10001']])
        ->assertCreated();

    expect(PokerTask::query()->where('external_id', '10001')->sole()->external_acceptance_criteria)->toBeNull();
});

it('detects the criteria field by name and keeps a chosen one', function () {
    $table = trackerTable();
    $integration = $table['integration'];
    Http::fake(['api.atlassian.com/ex/jira/cloud-1/rest/api/3/field' => Http::response([
        ['id' => 'customfield_10016', 'name' => 'Story point estimate', 'custom' => true, 'schema' => ['type' => 'number']],
        ['id' => 'customfield_10100', 'name' => 'ACCEPTANCE CRITERIA', 'custom' => true, 'schema' => ['type' => 'string']],
        ['id' => 'customfield_10200', 'name' => 'Notes', 'custom' => true, 'schema' => ['type' => 'string']],
    ])]);

    app(DetectJiraStoryPointFields::class)->handle($integration);

    expect($integration->fresh()->setting('acceptanceCriteriaField'))->toBe('customfield_10100')
        ->and(collect($integration->fresh()->setting('textFields'))->pluck('id')->all())->toBe(['customfield_10100', 'customfield_10200']);

    $this->actingAs(integrationAdmin($integration->team))
        ->patch(route('teams.integrations.update', [$integration->team->workspace, $integration->team, $integration]), ['acceptance_criteria_field_id' => 'customfield_10200'])
        ->assertSessionHasNoErrors();

    app(DetectJiraStoryPointFields::class)->handle($integration->fresh());

    expect($integration->fresh()->setting('acceptanceCriteriaField'))->toBe('customfield_10200');

    $this->actingAs(integrationAdmin($integration->team))
        ->patch(route('teams.integrations.update', [$integration->team->workspace, $integration->team, $integration]), ['acceptance_criteria_field_id' => 'customfield_99999'])
        ->assertSessionHasErrors('acceptance_criteria_field_id');
});

it('detects the text fields once for a connection detected before this release', function () {
    $table = trackerTable();
    $settings = $table['integration']->settings;
    unset($settings['textFields']);
    $table['integration']->forceFill(['settings' => $settings])->save();

    Http::fake([
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/field' => Http::response([
            ['id' => 'customfield_10100', 'name' => 'Acceptance criteria', 'custom' => true, 'schema' => ['type' => 'string']],
        ]),
    ]);
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1', ['customfield_10100' => 'Must export'])]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.store', [$table['game'], 'jira']), ['external_ids' => ['10001']])
        ->assertCreated();

    expect(PokerTask::query()->where('external_id', '10001')->sole()->external_acceptance_criteria)->toBe('Must export')
        ->and(TeamIntegration::query()->find($table['integration']->id)->setting('acceptanceCriteriaField'))->toBe('customfield_10100');
});
```

The Cloud field above holds a plain string in the last test (a single-line text field): Step 4 converts an ADF document and keeps a plain string as it is. The route name and HTTP verb of the integration update are those of `routes/web.php` (`teams.integrations.update`, PATCH); `Http::fake` calls accumulate patterns, the first match wins: the `field` pattern is registered before `fakeJiraTrackerApi` adds its own.

In `tests/Pest.php`, lane K block:

```php
/**
 * @return array{id: string, name: string}
 */
function jiraTextField(string $id, string $name): array
{
    return ['id' => $id, 'name' => $name];
}
```

- [ ] **Step 3: Run them to see them fail.** Expected: FAIL.

- [ ] **Step 4: `TrackerIssue` and `JiraIssueTracker`**

`TrackerIssue`: the three new constructor parameters with their defaults (every existing `new TrackerIssue(...)` call uses named arguments and keeps compiling), the constants, and:

```php
    /**
     * @return list<string>
     */
    public static function labels(mixed $value): array
    {
        if (! is_array($value) || ! array_is_list($value)) {
            return [];
        }

        $labels = [];

        foreach ($value as $label) {
            $name = self::shorten($label, self::LabelLength);

            if ($name === null || in_array($name, $labels, true)) {
                continue;
            }

            $labels[] = $name;
        }

        return array_slice($labels, 0, self::MaxLabels);
    }

    public static function longText(?string $markdown): ?string
    {
        $text = trim((string) $markdown);

        return $text === '' ? null : mb_substr($text, 0, self::AcceptanceCriteriaLength);
    }
```

`JiraIssueTracker`: `BaseFields` gains `'issuetype'` and `'labels'`; `requestedFields()` appends the criteria field id when there is one:

```php
    protected function requestedFields(TeamIntegration $integration): array
    {
        $criteria = self::acceptanceCriteriaFieldId($integration);

        return [...self::BaseFields, ...self::storyPointFieldIds($integration), ...($criteria === null ? [] : [$criteria])];
    }

    public static function acceptanceCriteriaFieldId(TeamIntegration $integration): ?string
    {
        $chosen = $integration->setting('acceptanceCriteriaField');

        if (! is_string($chosen)) {
            return null;
        }

        $known = collect((array) $integration->setting('textFields', []))
            ->contains(fn (mixed $field): bool => is_array($field) && ($field['id'] ?? null) === $chosen);

        return $known ? $chosen : null;
    }
```

and in `issue()` the three named arguments:

```php
            type: TrackerIssue::shorten(data_get($fields, 'issuetype.name'), TrackerIssue::TypeLength),
            labels: TrackerIssue::labels($fields['labels'] ?? null),
            acceptanceCriteria: $this->acceptanceCriteria($integration, $fields),
```

with

```php
    /**
     * Cloud gives a rich-text field as an ADF document and a one-line field as
     * a string; Data Center gives wiki markup. `description()` converts the
     * first and the last; a plain string on Cloud is kept as written.
     *
     * @param  array<array-key, mixed>  $fields
     */
    private function acceptanceCriteria(TeamIntegration $integration, array $fields): ?string
    {
        $fieldId = self::acceptanceCriteriaFieldId($integration);

        if ($fieldId === null) {
            return null;
        }

        $value = $fields[$fieldId] ?? null;

        return TrackerIssue::longText($this->description($value) ?? (is_string($value) ? $value : null));
    }
```

- [ ] **Step 5: Detection, override, and the once-only detection**

`DetectJiraStoryPointFields::handle()`: in the same loop over `field`, collect `$textFields[] = ['id' => …, 'name' => …]` for `custom === true` and `schema.type === 'string'`; merge `textFields`; unless `acceptanceCriteriaFieldChosen` is true, merge `acceptanceCriteriaField` = the id of the first text field whose `Alphabetical::key($name) === Alphabetical::key('Acceptance criteria')`, or null. Add:

```php
    /**
     * A connection detected before text fields were listed learns them once,
     * quietly, the first time an import or a refresh needs them.
     */
    public function ensureTextFields(TeamIntegration $integration): void
    {
        if (! in_array($integration->provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter], true)) {
            return;
        }

        if (is_array($integration->setting('textFields'))) {
            return;
        }

        $this->handleQuietly($integration);
    }
```

Call `ensureTextFields($integration)` at the start of `ImportPokerTasks::handle()` and `fromSource()` (after the guards) and in `RefreshPokerTasks::handle()` before `issues()` for each active integration. (Lane C's Task 12 calls it in the creation import too.)

`UpdateTeamIntegration::rules()`: for `Jira` and `JiraDataCenter`, `'acceptance_criteria_field_id' => ['sometimes', 'nullable', 'string', Rule::in($this->ids($integration->setting('textFields', []), 'id'))]`. `handle()`: when the key is present, `mergeSettings(['acceptanceCriteriaField' => $validated['acceptance_criteria_field_id'], 'acceptanceCriteriaFieldChosen' => true])`. `PresentTeamIntegration`: add `textFields` and `acceptanceCriteriaField` to the exposed keys of `jira` and `jira_dc`.

- [ ] **Step 6: Run the tests on pgsql and sqlite** — `bin/test-db pgsql -- tests/Unit/Support/TrackerIssueLabelsTest.php tests/Feature/Integrations tests/Arch`, then `sqlite`. Expected: PASS (all existing integration tests included).

- [ ] **Step 7: Commit** — `feat(integrations): Jira ticket type, labels and acceptance criteria` (trailers).

### Task 6: Linear and GitHub labels; every writer and the presenter carry the details

**Files:**
- Modify: `app/Support/Integrations/Trackers/LinearTracker.php`, `GitHubTracker.php`; `app/Actions/Integrations/ImportPokerTasks.php`, `ApplyPokerTaskIssues.php`; `app/Actions/Poker/PresentPokerTask.php`
- Test: `tests/Feature/Integrations/TicketDetailsTest.php` (more cases), `tests/Feature/Poker/PokerRedactionTest.php` (one case added)

Read first: `LinearTracker::IssueFields` and its `issue()` mapping (around the `new TrackerIssue(` call); `GitHubTracker::IssueFields` (GraphQL fragment) and the REST mapping used by `iterationIssues` (`list()`); `ApplyPokerTaskIssues::fields()`; `ImportPokerTasks::store()`; `PresentPokerTask::external()`.

**Interfaces:**
- Consumes: Task 5.
- Produces: `PresentPokerTask`'s `external` block gains, for every viewer, `type: ?string`, `labels: list<string>`, `acceptanceCriteriaHtml: string` (empty when none; rendered with `RenderTaskMarkdown`, cached like the description). Lane C's Task 12 relies on `ImportPokerTasks::storeIssues()` being the only writer of imported tasks (extracted there, not here).

- [ ] **Step 1: Write the failing tests** (append to `TicketDetailsTest.php`):

```php
it('imports the labels of a Linear issue and no type', function () {
    $table = trackerTable(App\Enums\IntegrationProvider::Linear);
    fakeLinearGraphql(['issues(' => ['issues' => ['nodes' => [
        linearTrackerIssue('uuid-1', 'ENG-1', ['labels' => ['nodes' => [['name' => 'backend'], ['name' => 'p1']]]]),
    ]]]]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.store', [$table['game'], 'linear']), ['external_ids' => ['uuid-1']])
        ->assertCreated();

    $task = PokerTask::query()->where('external_id', 'uuid-1')->sole();

    expect($task->external_labels)->toBe(['backend', 'p1'])
        ->and($task->external_type)->toBeNull();
});

it('follows the source on refresh', function () {
    $table = trackerTable();
    $task = importedPokerTask($table['game'], ['external_id' => '10001', 'external_key' => 'PROJ-1', 'external_labels' => ['old'], 'external_type' => 'Bug']);
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1', ['issuetype' => ['name' => 'Story'], 'labels' => ['new']])]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.refresh.store', $table['game']))
        ->assertOk();

    expect($task->fresh()->external_labels)->toBe(['new'])
        ->and($task->fresh()->external_type)->toBe('Story');
});

it('shows ticket details to a guest, and the assignee to the team only', function () {
    $table = trackerTable();
    importedPokerTask($table['game'], [
        'external_type' => 'Story',
        'external_labels' => ['csv'],
        'external_acceptance_criteria' => "- UTF-8\n- semicolon",
        'external_assignee' => 'Jane Doe',
    ]);
    $guest = pokerGuest($table['game']);

    $payload = $this->withCookies(pokerGuestCookie($guest))
        ->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk()
        ->json('tasks.0.external');

    expect($payload['type'])->toBe('Story')
        ->and($payload['labels'])->toBe(['csv'])
        ->and($payload['acceptanceCriteriaHtml'])->toContain('<li>UTF-8</li>')
        ->and($payload)->not->toHaveKey('assignee');
});
```

`fakeLinearGraphql` matches the first key found in the query text: the Linear tracker's issue query contains `issues(`. The GitHub case: add one with `gitHubIssue(7, ['labels' => [['name' => 'bug']]])` through the REST milestone listing (read `tests/Feature/Integrations/PokerImportBrowsingTest.php` for how GitHub is faked) and expect `['bug']`. The snapshot route name and the guest cookie helper are those of `tests/Feature/Poker/PokerSnapshotTest.php`; adapt the two names if they differ.

- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.

- [ ] **Step 3: Implement**
  - `LinearTracker::IssueFields` gains `labels(first: 10) { nodes { name } }`; its mapping passes `labels: TrackerIssue::labels(array_column((array) data_get($node, 'labels.nodes', []), 'name'))`.
  - `GitHubTracker::IssueFields` gains `labels(first: 10) { nodes { name } } issueType { name }`; the GraphQL mapping passes `labels: TrackerIssue::labels(array_column((array) data_get($raw, 'labels.nodes', []), 'name'))` and `type: TrackerIssue::shorten(data_get($raw, 'issueType.name'), TrackerIssue::TypeLength)`; the REST mapping passes `labels: TrackerIssue::labels(array_column((array) ($raw['labels'] ?? []), 'name'))` and `type: TrackerIssue::shorten(data_get($raw, 'type.name'), TrackerIssue::TypeLength)`. If GitHub's GraphQL refuses `issueType` on the supported API version (a 200 with `errors`), drop it from the fragment and say so in the report (spec §16.3).
  - `ImportPokerTasks::store()`: the `forceFill` gains `'external_type' => $issue->type`, `'external_labels' => $issue->labels === [] ? null : $issue->labels`, `'external_acceptance_criteria' => $issue->acceptanceCriteria`.
  - `ApplyPokerTaskIssues::fields()`: the same three keys.
  - `PresentPokerTask`: a private `details(PokerTask $task): array` returning the three keys, spread into **both** branches of `external()` (with and without a `PokerTaskSync`); `acceptanceCriteriaHtml` cached under `poker-task-criteria:{id}:{hash}` exactly as `descriptionHtml`. Add the keys to the `TaskExternal` phpstan type.

- [ ] **Step 4: Run the tests on pgsql and sqlite** — `bin/test-db pgsql -- tests/Feature/Integrations tests/Feature/Poker`, then `sqlite`. Expected: PASS.

- [ ] **Step 5: Commit** — `feat(poker): ticket details from every tracker, kept up to date` (trailers).

---

## Lane C — creation options (back end; after plan 21)

Before Task 7, read plan 21's changes to `app/Models/Retro.php`, `RetroSettingsController`, `RetroTimersController`, `ChangeRetroPhase` and the retro vote endpoint, and note in `progress.md` the name of the per-card cap column (written `max_votes_per_card` below; use plan 21's name) and the method that starts the retro timer after RT-2 (written "set `timer_ends_at`" below; use plan 21's way if it added a paused state).

### Task 7: Retro — phase durations at creation and in the settings; the timer starts at phase entry; max per card at creation

**Files:**
- Create: `app/Support/Retros/PhaseDurations.php`
- Modify: `app/Actions/Retros/NewRetro.php`, `CreateRetro.php`, `ChangeRetroPhase.php`, `BuildBoardSnapshot.php`; `app/Http/Controllers/TeamRetrosController.php`, `Retros/RetroSettingsController.php`
- Test: `tests/Unit/Support/PhaseDurationsTest.php`, `tests/Feature/Retros/PhaseTimersTest.php`

**Interfaces:**
- Produces: `PhaseDurations::TimedPhases` (list of the five `RetroPhase` values: `writing`, `grouping`, `voting`, `discussing`, `actions`); `PhaseDurations::Standard = ['writing' => 7, 'grouping' => 5, 'voting' => 3, 'discussing' => 15, 'actions' => 5]`; `PhaseDurations::rules(string $attribute): array<string, array<int, mixed>>` (for `phase_durations` and `phase_durations.*`); `PhaseDurations::normalise(?array $durations): ?array` (keeps the timed phases with 1–60, null when none); `PhaseDurations::secondsFor(?array $durations, RetroPhase $phase): ?int`. `NewRetro` gains `?array $phaseDurations = null` and `?int $maxVotesPerCard = null`. The board snapshot's retro gains `phaseDurations: array<string, int>|null`.

- [ ] **Step 1: Write the failing tests**

`tests/Unit/Support/PhaseDurationsTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Support\Retros\PhaseDurations;

it('keeps the timed phases that have minutes', function () {
    expect(PhaseDurations::normalise(['writing' => 7, 'voting' => 0, 'roti' => 5, 'grouping' => null]))->toBe(['writing' => 7])
        ->and(PhaseDurations::normalise([]))->toBeNull()
        ->and(PhaseDurations::normalise(null))->toBeNull();
});

it('gives the seconds of a phase', function () {
    expect(PhaseDurations::secondsFor(PhaseDurations::Standard, RetroPhase::Discussing))->toBe(900)
        ->and(PhaseDurations::secondsFor(PhaseDurations::Standard, RetroPhase::Roti))->toBeNull()
        ->and(PhaseDurations::secondsFor(null, RetroPhase::Writing))->toBeNull();
});
```

`tests/Feature/Retros/PhaseTimersTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\Retros\TimerChanged;
use App\Models\Retro;
use App\Models\Team;
use App\Support\Retros\PhaseDurations;
use Illuminate\Support\Facades\Event;

it('stores the standard durations chosen at creation', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->post(route('teams.retros.store', [$team->workspace, $team]), [
            'title' => 'Sprint 43 retro',
            'template' => 'start_stop_continue',
            'phase_durations' => PhaseDurations::Standard,
        ])
        ->assertSessionHasNoErrors();

    expect(Retro::query()->sole()->phase_durations)->toBeIgnoringKeyOrder(PhaseDurations::Standard);
});

it('refuses a duration out of range or an untimed phase', function (array $durations) {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->post(route('teams.retros.store', [$team->workspace, $team]), [
            'title' => 'R', 'template' => 'start_stop_continue', 'phase_durations' => $durations,
        ])
        ->assertSessionHasErrors();

    expect(Retro::query()->count())->toBe(0);
})->with([
    'zero' => [['writing' => 0]],
    'too long' => [['writing' => 61]],
    'roti' => [['roti' => 5]],
    'not a number' => [['writing' => 'seven']],
]);

it('starts the phase timer when the retro enters a timed phase', function () {
    Event::fake([TimerChanged::class]);
    $this->freezeSecond();
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['phase_durations' => ['grouping' => 5]]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)
        ->putJson(route('retros.phase.update', $retro), ['phase' => RetroPhase::Grouping->value])
        ->assertSuccessful();

    $retro->refresh();

    expect($retro->timer_ends_at?->equalTo(now()->addMinutes(5)))->toBeTrue()
        ->and($retro->started_at)->not->toBeNull();

    Event::assertDispatched(fn (TimerChanged $event) => $event->retroId === $retro->id);
});

it('leaves a running timer alone when the next phase has no duration', function () {
    $this->freezeSecond();
    $endsAt = now()->addMinutes(2);
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['phase_durations' => ['writing' => 7], 'timer_ends_at' => $endsAt]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)
        ->putJson(route('retros.phase.update', $retro), ['phase' => RetroPhase::Grouping->value])
        ->assertSuccessful();

    expect($retro->fresh()->timer_ends_at?->equalTo($endsAt))->toBeTrue();
});

it('lets the facilitator change the durations, and nobody else', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create();
    [$facilitator] = retroFacilitator($retro);
    [$member] = retroMember($retro);

    $this->actingAs($member)
        ->patchJson(route('retros.settings.update', $retro), ['phase_durations' => ['voting' => 3]])
        ->assertForbidden();

    $this->actingAs($facilitator)
        ->patchJson(route('retros.settings.update', $retro), ['phase_durations' => ['voting' => 3]])
        ->assertSuccessful();

    expect($retro->fresh()->phase_durations)->toBe(['voting' => 3]);

    $this->actingAs($facilitator)
        ->patchJson(route('retros.settings.update', $retro), ['phase_durations' => null])
        ->assertSuccessful();

    expect($retro->fresh()->phase_durations)->toBeNull();
});

it('sends the durations in the board snapshot', function () {
    $retro = Retro::factory()->create(['phase_durations' => ['writing' => 7]]);
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertOk()
        ->assertJsonPath('retro.phaseDurations.writing', 7);
});

it('passes max per card from the dialog to plan 21 setting', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->post(route('teams.retros.store', [$team->workspace, $team]), [
            'title' => 'R', 'template' => 'start_stop_continue', 'votes_per_participant' => 5, 'max_votes_per_card' => 2,
        ])
        ->assertSessionHasNoErrors();

    expect(Retro::query()->sole()->max_votes_per_card)->toBe(2);
});
```

The phase route (`retros.phase.update`, verb and body), the snapshot route and its key path, the `TimerChanged` property name, and the 403 of a member on settings (it may be a 403 from `RetroGuard::facilitator`, rendered as JSON) are read from `tests/Feature/Retros/` before running; adapt names, not meaning. The last case uses plan 21's column and validation; **skip it (and Step 3's max-per-card lines) if plan 21 already sends it from the dialog**, and say so.

- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.

- [ ] **Step 3: Implement**

`app/Support/Retros/PhaseDurations.php`:

```php
<?php

namespace App\Support\Retros;

use App\Enums\RetroPhase;
use Closure;

/**
 * Spec plan 22 §6.2: whole minutes per timed phase; entering a phase that
 * has one starts the retro's timer.
 */
class PhaseDurations
{
    public const array TimedPhases = ['writing', 'grouping', 'voting', 'discussing', 'actions'];

    public const array Standard = ['writing' => 7, 'grouping' => 5, 'voting' => 3, 'discussing' => 15, 'actions' => 5];

    public const int MaxMinutes = 60;

    /**
     * @return array<string, array<int, mixed>>
     */
    public static function rules(string $attribute = 'phase_durations'): array
    {
        return [
            $attribute => ['sometimes', 'nullable', 'array', self::onlyTimedPhases()],
            "{$attribute}.*" => ['integer', 'min:1', 'max:'.self::MaxMinutes],
        ];
    }

    /**
     * @param  ?array<array-key, mixed>  $durations
     * @return ?array<string, int>
     */
    public static function normalise(?array $durations): ?array
    {
        $kept = [];

        foreach (self::TimedPhases as $phase) {
            $minutes = $durations[$phase] ?? null;

            if (is_int($minutes) && $minutes >= 1 && $minutes <= self::MaxMinutes) {
                $kept[$phase] = $minutes;
            }
        }

        return $kept === [] ? null : $kept;
    }

    /**
     * @param  ?array<string, int>  $durations
     */
    public static function secondsFor(?array $durations, RetroPhase $phase): ?int
    {
        $minutes = self::normalise($durations)[$phase->value] ?? null;

        return $minutes === null ? null : $minutes * 60;
    }

    private static function onlyTimedPhases(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if (! is_array($value) || array_diff(array_keys($value), self::TimedPhases) === []) {
                return;
            }

            $fail(__('Only writing, grouping, voting, discussing and actions can have a timer.'));
        };
    }
}
```

Validated integers arrive as integers from JSON and as strings from a form post: `normalise()` is called on `array_map('intval', …)` of the validated array in both controllers (`TeamRetrosController@store`, `RetroSettingsController@update`).

- `TeamRetrosController@store`: `...PhaseDurations::rules()` in `validate()`; `phaseDurations: PhaseDurations::normalise(array_map('intval', $validated['phase_durations'] ?? []))`; `max_votes_per_card` (plan 21's rule) → `maxVotesPerCard:`. `NewRetro` gains both parameters; `CreateRetro` writes `'phase_durations' => $data->phaseDurations` and plan 21's column.
- `RetroSettingsController@update`: `...PhaseDurations::rules()`; `phase_durations` written (normalised) only while the retro is open (add it to `OpenPhaseSettings`); it announces `RetroSettingsChanged` as the other settings do.
- `ChangeRetroPhase::handle()`: after `$this->move($locked, $phase)` call

```php
    private function startPhaseTimer(Retro $locked, RetroPhase $phase): void
    {
        $seconds = PhaseDurations::secondsFor($locked->phase_durations, $phase);

        if ($seconds === null) {
            return;
        }

        $endsAt = now()->addSeconds($seconds)->startOfSecond();

        $locked->update(['timer_ends_at' => $endsAt]);

        (new TimerChanged($locked->id, $endsAt->toIso8601String()))->sendToOthers();
    }
```

(after plan 21's RT-2, write the timer the way plan 21's start does — it may clear a paused remainder too.) `markRetroStarted` already runs right after `move` in `handle()`; keep the order `move` → `startPhaseTimer` → `markRetroStarted`.
- `BuildBoardSnapshot`: `'phaseDurations' => $retro->phase_durations` beside `timerEndsAt`.

- [ ] **Step 4: Run the tests on pgsql and sqlite** — `bin/test-db pgsql -- tests/Unit/Support/PhaseDurationsTest.php tests/Feature/Retros`, then `sqlite`. Expected: PASS.

- [ ] **Step 5: Commit** — `feat(retro): timers per phase, started at phase entry` (trailers).

### Task 8: Poker — change vote after reveal

**Files:**
- Modify: `app/Actions/Poker/PokerGuard.php`, `PlayPokerCard.php`
- Test: `tests/Feature/Poker/RevoteAfterRevealTest.php`, `tests/Concurrency/RevoteAfterRevealTest.php`

**Interfaces:**
- Produces: `PokerGuard::acceptsCard(PokerGame $game, PokerRound $round, ?string $value): void` (throws the same `ValidationException` as `openRound`, key `votes`, "Voting is closed for this round."). `PokerGuard::openRound` unchanged.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Poker/RevoteAfterRevealTest.php`:

```php
<?php

use App\Events\Poker\PokerRoundChanged;
use App\Events\Poker\PokerVoteChanged;
use App\Models\PokerRound;
use Illuminate\Support\Facades\Event;

function revealedTable(bool $revote): array
{
    $table = pokerRevealTable();
    $table['game']->update(['revote_after_reveal' => $revote]);
    pokerVote($table['round'], $table['memberPlayer'], '3');
    pokerVote($table['round'], $table['facilitatorPlayer'], '5');
    $table['round']->update(['revealed_at' => now()]);

    return $table;
}

it('lets a player change their card after reveal until the estimate is saved', function () {
    Event::fake([PokerRoundChanged::class, PokerVoteChanged::class]);
    $table = revealedTable(revote: true);

    $this->actingAs($table['member'])
        ->putJson(route('poker.rounds.vote.update', [$table['game'], $table['round']]), ['value' => '5'])
        ->assertOk()
        ->assertJsonPath('myVote', '5');

    $this->actingAs($table['facilitator'])
        ->getJson(route('poker.snapshot.show', $table['game']))
        ->assertJsonPath('current.round.result.consensus', true);

    Event::assertDispatched(PokerRoundChanged::class);
    Event::assertNotDispatched(PokerVoteChanged::class);
});

it('closes the revealed round once the estimate is saved', function () {
    $table = revealedTable(revote: true);
    $task = $table['round']->task;

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $task]), ['value' => '5'])
        ->assertOk();

    $this->actingAs($table['member'])
        ->putJson(route('poker.rounds.vote.update', [$table['game'], $table['round']]), ['value' => '8'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['votes' => 'Voting is closed for this round.']);
});

it('refuses a change after reveal when the game does not allow it, and a withdrawal always', function () {
    $closed = revealedTable(revote: false);

    $this->actingAs($closed['member'])
        ->putJson(route('poker.rounds.vote.update', [$closed['game'], $closed['round']]), ['value' => '5'])
        ->assertUnprocessable();

    $open = revealedTable(revote: true);

    $this->actingAs($open['member'])
        ->deleteJson(route('poker.rounds.vote.destroy', [$open['game'], $open['round']]))
        ->assertUnprocessable();
});

it('still refuses a second reveal and a timer on a revealed round', function () {
    $table = revealedTable(revote: true);

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.rounds.reveal.store', [$table['game'], $table['round']]))
        ->assertUnprocessable();

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.rounds.timer.update', [$table['game'], $table['round']]), ['seconds' => 60])
        ->assertUnprocessable();
});

it('refuses a change in a revealed round that is not the latest', function () {
    $table = revealedTable(revote: true);
    $next = PokerRound::factory()->create(['poker_task_id' => $table['round']->poker_task_id]);

    $this->actingAs($table['member'])
        ->putJson(route('poker.rounds.vote.update', [$table['game'], $table['round']]), ['value' => '5'])
        ->assertUnprocessable();

    expect($next->votes()->count())->toBe(0);
});
```

`pokerRevealTable()` returns `game`, `facilitator`, `facilitatorPlayer`, `member`, `memberPlayer`, `round` (`tests/Pest.php`); the reveal and timer route names are read from `routes/web.php` (`poker.rounds.*`). `PokerRound::task` is the relation name if it exists; otherwise read the task with `PokerTask::find($table['round']->poker_task_id)`.

`tests/Concurrency/RevoteAfterRevealTest.php`:

```php
<?php

use App\Models\PokerVote;
use Tests\Concurrency\Support\Race;

it('never changes a card after the estimate is saved', function () {
    $table = pokerRevealTable();
    $table['game']->update(['revote_after_reveal' => true]);
    pokerVote($table['round'], $table['memberPlayer'], '3');
    pokerVote($table['round'], $table['facilitatorPlayer'], '5');
    $table['round']->update(['revealed_at' => now()]);

    $memberId = $table['member']->id;
    $facilitatorId = $table['facilitator']->id;
    $voteUri = route('poker.rounds.vote.update', [$table['game'], $table['round']], false);
    $estimateUri = route('poker.tasks.estimate.update', [$table['game'], $table['round']->poker_task_id], false);
    $votePlayer = $table['memberPlayer']->id;

    $outcomes = Race::run([
        'change' => static fn (): int => Race::request($memberId, 'PUT', $voteUri, ['value' => '8']),
        'save' => static fn (): int => Race::request($facilitatorId, 'PUT', $estimateUri, ['value' => '5']),
    ]);

    $vote = PokerVote::query()->where('poker_player_id', $votePlayer)->sole();
    $changeStatus = $outcomes['change']['value'];
    $changeEnded = $outcomes['change']['endedAt'];
    $saveEnded = $outcomes['save']['endedAt'];

    expect($outcomes['save']['value'])->toBe(200)
        ->and($changeStatus)->toBeIn([200, 422])
        ->and($vote->value)->toBe($changeStatus === 200 ? '8' : '3');

    if ($changeStatus === 200) {
        expect($changeEnded <= $saveEnded)->toBeTrue();
    }
});
```

The protection this proves: `PlayPokerCard` locks the game row, then reads the task's estimate through `acceptsCard` under that lock; the estimate save locks the same row first. Without the lock (or with the estimate read before the lock), a change can land after the save. The "ended before" comparison is the harness's evidence of order; if `Race`'s `endedAt` is not precise enough on a slow engine, assert only on the final value and status (a 200 with value 8 and an estimate saved means the change came first, which the transaction order guarantees).

- [ ] **Step 2: Run them to see them fail.** Expected: the feature tests FAIL (422 on the change).

- [ ] **Step 3: Implement**

`PokerGuard`:

```php
    /**
     * The card of a player: the open round as `openRound` says, or — when
     * the game lets cards change after reveal — the revealed latest round of
     * the current task until its estimate is saved. A card is changed then,
     * never withdrawn: the round keeps a result.
     */
    public static function acceptsCard(PokerGame $game, PokerRound $round, ?string $value): void
    {
        $latest = $game->latestRoundOfCurrentTask();
        $isLatest = $latest !== null && $latest->id === $round->id;

        if ($isLatest && ! $round->isRevealed()) {
            return;
        }

        $reopened = $isLatest
            && $value !== null
            && $game->revote_after_reveal
            && $game->currentTask?->estimate === null;

        if ($reopened) {
            return;
        }

        throw ValidationException::withMessages(['votes' => __('Voting is closed for this round.')]);
    }
```

`PlayPokerCard::handle()`: `PokerGuard::acceptsCard($locked, $lockedRound, $value)` replaces `PokerGuard::openRound(...)`; the `currentTask` is read inside the transaction after the game lock (`$locked->load('currentTask')` before the guard, so that a cached relation from before the lock is never read). When the round is revealed and the card changed, announce `(new PokerRoundChanged($locked->id))->sendToOthers()` instead of `PokerVoteChanged`, and return `'revealed' => $lockedRound->isRevealed()`. `PokerVotesController@update` calls `AutoRevealPokerRound` after the vote: it does nothing on a revealed round (`isOpenForAutoReveal`), keep it.

- [ ] **Step 4: Run the tests** — `bin/test-db pgsql -- tests/Feature/Poker`, then `sqlite`; then the race on the four engines: `bin/test-db pgsql --concurrency -- tests/Concurrency/RevoteAfterRevealTest.php`, and `mariadb`, `mysql`, `sqlite-file`. Expected: PASS on each.

- [ ] **Step 5: Commit** — `feat(poker): change a card after reveal until the estimate is saved` (trailers).

### Task 9: Poker — the task timer starts with every round

**Files:**
- Modify: `app/Actions/Poker/StartPokerRound.php`
- Test: `tests/Feature/Poker/TaskTimerTest.php`

Read first: `StartPokerRound`, its callers (`SelectPokerTask`, `PokerRoundsController@store`) and the events they send; `PokerTimersController@update` (whole seconds, the job after commit); `RevealPokerRoundOnTimer`.

**Interfaces:**
- Consumes: `poker_games.task_timer_seconds` (Task 1).

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Jobs\RevealPokerRoundOnTimer;
use App\Models\PokerTask;
use Illuminate\Support\Facades\Bus;

it('starts every new round with the task timer', function () {
    Bus::fake([RevealPokerRoundOnTimer::class]);
    $this->freezeSecond();
    $table = pokerRevealTable();
    $table['game']->update(['task_timer_seconds' => 180]);
    $task = PokerTask::factory()->create(['poker_game_id' => $table['game']->id]);

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.tasks.rounds.store', [$table['game'], $task]))
        ->assertSuccessful();

    $round = $task->rounds()->sole();

    expect($round->timer_ends_at?->equalTo(now()->addSeconds(180)))->toBeTrue();

    Bus::assertDispatched(RevealPokerRoundOnTimer::class, fn (RevealPokerRoundOnTimer $job) => $job->roundId === $round->id);
});

it('starts no timer without the setting', function () {
    $table = pokerRevealTable();
    $task = PokerTask::factory()->create(['poker_game_id' => $table['game']->id]);

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.tasks.rounds.store', [$table['game'], $task]))
        ->assertSuccessful();

    expect($task->rounds()->sole()->timer_ends_at)->toBeNull();
});

it('reveals at expiry with auto reveal only', function (bool $autoReveal, bool $revealed) {
    $table = pokerRevealTable();
    $table['game']->update(['task_timer_seconds' => 60, 'auto_reveal' => $autoReveal]);
    fakePokerRoster([$table['memberPlayer']->id, $table['facilitatorPlayer']->id]);
    $task = PokerTask::factory()->create(['poker_game_id' => $table['game']->id]);

    $this->actingAs($table['facilitator'])->postJson(route('poker.tasks.rounds.store', [$table['game'], $task]))->assertSuccessful();
    $round = $task->rounds()->sole();
    pokerVote($round, $table['memberPlayer'], '3');

    $this->travel(61)->seconds();
    (new RevealPokerRoundOnTimer($round->id, $round->timer_ends_at->toIso8601String()))->handle(app(App\Actions\Poker\AutoRevealPokerRound::class));

    expect($round->fresh()->isRevealed())->toBe($revealed);
})->with([[true, true], [false, false]]);
```

The last case leans on `AutoRevealPokerRound`'s reasons (a timer expiry is one of them): read `AutoRevealPokerRound::reason()` and set the roster so that only the timer can be the reason.

- [ ] **Step 2: Run it to see it fail.** Expected: FAIL.

- [ ] **Step 3: Implement**

```php
<?php

namespace App\Actions\Poker;

use App\Jobs\RevealPokerRoundOnTimer;
use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerTask;

class StartPokerRound
{
    /**
     * Runs inside the caller's transaction, on a game row locked for update.
     * A game with a task timer starts the round's timer at once; its expiry
     * behaves as the facilitator's timer does (spec plan 22 §6.3).
     */
    public function handle(PokerGame $locked, PokerTask $task): PokerRound
    {
        $endsAt = $locked->task_timer_seconds === null
            ? null
            : now()->addSeconds($locked->task_timer_seconds)->startOfSecond();

        $round = $task->rounds()->create([
            'number' => (int) $task->rounds()->max('number') + 1,
            'anonymous' => $locked->anonymous_votes,
            'timer_ends_at' => $endsAt,
        ]);

        if ($endsAt !== null) {
            dispatch(new RevealPokerRoundOnTimer($round->id, $endsAt->toIso8601String()))
                ->delay($endsAt)
                ->afterCommit();
        }

        return $round;
    }
}
```

`timer_ends_at` must be fillable on `PokerRound` (it is written by `update()` in `PokerTimersController`: check, and add it if the model guards it).

- [ ] **Step 4: Run the tests** — `bin/test-db pgsql -- tests/Feature/Poker`, then `sqlite`. Expected: PASS.

- [ ] **Step 5: Commit** — `feat(poker): a task timer that starts with every round` (trailers).

### Task 10: Poker — estimate write-back per game

**Files:**
- Modify: `app/Actions/Integrations/RequestEstimateSync.php`, `PokerTaskSync.php`; `app/Support/Integrations/Trackers/JiraIssueTracker.php` (`writeEstimate`)
- Test: `tests/Feature/Integrations/PokerEstimateWriteBackOptionTest.php`

Read first: `RequestEstimateSync` (`afterEstimateChange`, `retry`), `PokerTaskSync::unsupportedReason()` and `state()`, `JiraIssueTracker::writeEstimate()`, the job `SyncTaskEstimate` (how it reaches `writeEstimate`: it must have the game to read `estimate_field_id`), `tests/Feature/Integrations/PokerEstimateSyncTest.php`.

**Interfaces:**
- Produces: `PokerTaskSync::GameOptOutReason` message "Estimates are not written back in this game."; `IssueTracker::writeEstimate()` unchanged in signature; `JiraIssueTracker::writeEstimate()` reads a preferred field through a new optional parameter `?string $preferredFieldId = null` (an interface change: add the parameter to `IssueTracker::writeEstimate` and to the three other trackers, ignored there).

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Jobs\SyncTaskEstimate;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('queues no write when the game does not write estimates', function () {
    Bus::fake([SyncTaskEstimate::class]);
    $table = trackerTable();
    $table['game']->update(['writes_estimates' => false]);
    $task = importedPokerTask($table['game']);
    $round = openPokerRound($table['game'], $task);
    pokerVote($round, $table['memberPlayer'], '5');
    $round->update(['revealed_at' => now()]);

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $task]), ['value' => '5'])
        ->assertOk()
        ->assertJsonPath('external.syncState', 'unsupported')
        ->assertJsonPath('external.unsupportedReason', 'Estimates are not written back in this game.');

    Bus::assertNotDispatched(SyncTaskEstimate::class);

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.tasks.sync.store', [$table['game'], $task]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['task' => 'Estimates are not written back in this game.']);
});

it('writes to the field the game names', function () {
    $table = trackerTable();
    $table['integration']->mergeSettings(['numberFields' => [
        ['id' => 'customfield_10016', 'name' => 'Story point estimate'],
        ['id' => 'customfield_10200', 'name' => 'Team points'],
    ]]);
    $table['game']->update(['estimate_field_id' => 'customfield_10200']);
    $task = importedPokerTask($table['game'], ['external_id' => '10001', 'estimate' => '5', 'estimate_numeric' => 5]);
    Http::fake([
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/10001/editmeta' => Http::response(['fields' => [
            'customfield_10016' => ['name' => 'Story point estimate'],
            'customfield_10200' => ['name' => 'Team points'],
        ]]),
        'api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/10001' => Http::response(null, 204),
    ]);

    dispatch_sync(new SyncTaskEstimate($task->id));

    Http::assertSent(fn (Request $request) => $request->method() === 'PUT' && array_key_exists('customfield_10200', (array) $request['fields']));
});
```

If `PokerEstimateSyncTest.php` runs the job another way (for example `app()->call([$job, 'handle'])` because the job needs the task flagged `needs_sync` first), follow it: set `needs_sync` with `forceFill` before dispatching.

- [ ] **Step 2: Run it to see it fail.** Expected: FAIL.

- [ ] **Step 3: Implement**
  - `PokerTaskSync::unsupportedReason()`: first check `if (! $this->game->writes_estimates) { return __('Estimates are not written back in this game.'); }` (only for an imported task, which the method already assumes). `state()` therefore reads Unsupported; `RequestEstimateSync::afterEstimateChange` already returns when a reason exists; `retry()` already throws it.
  - `IssueTracker::writeEstimate(TeamIntegration $integration, string $externalId, ?string $estimate, ?string $preferredFieldId = null): void`; Linear, GitHub and Jira Data Center's inherited method take and ignore it except `JiraIssueTracker`, which tries `$preferredFieldId` first:

```php
        $candidates = array_values(array_unique(array_filter([$preferredFieldId, ...self::storyPointFieldIds($integration)])));
        $fieldId = collect($candidates)->first(fn (string $id): bool => array_key_exists($id, $editable));
```

  - `SyncTaskEstimate` passes `$task->game->estimate_field_id` when it calls `writeEstimate`.
  - `PokerTaskSync::storyPointsReason()`: a game with an `estimate_field_id` is not refused for "No story points field found." when the connection lists that field in `numberFields`.

- [ ] **Step 4: Run the tests** — `bin/test-db pgsql -- tests/Feature/Integrations tests/Feature/Poker`, then `sqlite`. Expected: PASS.

- [ ] **Step 5: Commit** — `feat(poker): write estimates back per game, to the field it names` (trailers).

### Task 11: Poker — the options at creation and in the room settings; the snapshot and the dialog props

**Files:**
- Create: `app/Actions/Poker/PokerGameSettingsRules.php`
- Modify: `app/Actions/Poker/NewPokerGame.php`, `CreatePokerGame.php`, `BuildPokerSnapshot.php`; `app/Http/Controllers/TeamPokerGamesController.php`, `Poker/PokerSettingsController.php`; `app/Actions/Integrations/ListPokerSources.php`; `app/Actions/Teams/PresentNewSessionOptions.php`
- Test: `tests/Feature/Poker/PokerGameOptionsTest.php` (more cases)

**Interfaces:**
- Produces: `PokerGameSettingsRules::rules(Team $team): array<string, array<int, mixed>>` for `revote_after_reveal`, `task_timer_seconds`, `writes_estimates`, `estimate_field_id`; `NewPokerGame` gains `bool $revoteAfterReveal = false`, `?int $taskTimerSeconds = null`, `bool $writesEstimates = true`, `?string $estimateFieldId = null`, `?PokerImportBatch $import = null` (the last one used by Task 12); snapshot `game` gains `revoteAfterReveal`, `taskTimerSeconds`, `writesEstimates`, `estimateFieldId`; `ListPokerSources` rows gain `estimateFields: list<array{id: string, name: string}>` (Jira and Jira DC: the connection's `numberFields`; `[]` otherwise) and `defaultEstimateFieldId: ?string` (the first of `storyPointFields`); `PresentNewSessionOptions` gains `pokerSources` (the rows of `ListPokerSources` when integrations are enabled and the viewer may create a game, else `[]`).

- [ ] **Step 1: Write the failing tests** (append to `PokerGameOptionsTest.php`):

```php
use App\Enums\IntegrationProvider;
use App\Models\Team;
use App\Models\TeamIntegration;
use Inertia\Testing\AssertableInertia as Assert;

it('creates a game with the three options and a field of the team connection', function () {
    enableIntegrations(IntegrationProvider::Jira);
    $team = Team::factory()->create();
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);

    $this->actingAs(teamMember($team))
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 44 refinement', 'deck' => 'fibonacci',
            'revote_after_reveal' => true, 'task_timer_seconds' => 180, 'writes_estimates' => true, 'estimate_field_id' => 'customfield_10016',
        ])
        ->assertSessionHasNoErrors();

    expect(App\Models\PokerGame::query()->sole()->only(['revote_after_reveal', 'task_timer_seconds', 'writes_estimates', 'estimate_field_id']))
        ->toBe(['revote_after_reveal' => true, 'task_timer_seconds' => 180, 'writes_estimates' => true, 'estimate_field_id' => 'customfield_10016']);
});

it('refuses a timer outside the list and a field the connection does not have', function (array $payload, string $error) {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), ['title' => 'P', 'deck' => 'fibonacci', ...$payload])
        ->assertSessionHasErrors($error);
})->with([
    'two minutes' => [['task_timer_seconds' => 120], 'task_timer_seconds'],
    'unknown field' => [['estimate_field_id' => 'customfield_1'], 'estimate_field_id'],
]);

it('lets the facilitator change the options in the room', function () {
    $table = pokerRevealTable();

    $this->actingAs($table['facilitator'])
        ->patchJson(route('poker.settings.update', $table['game']), ['revote_after_reveal' => true, 'task_timer_seconds' => 300, 'writes_estimates' => false])
        ->assertNoContent();

    $this->actingAs($table['member'])
        ->getJson(route('poker.snapshot.show', $table['game']))
        ->assertJsonPath('game.revoteAfterReveal', true)
        ->assertJsonPath('game.taskTimerSeconds', 300)
        ->assertJsonPath('game.writesEstimates', false);

    $this->actingAs($table['member'])
        ->patchJson(route('poker.settings.update', $table['game']), ['revote_after_reveal' => false])
        ->assertForbidden();
});

it('gives the dialog the tracker sources and their fields', function () {
    enableIntegrations(IntegrationProvider::Jira);
    $team = Team::factory()->create();
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);

    $this->actingAs(teamMember($team))
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('pokerSources.0.source', 'jira')
            ->where('pokerSources.0.estimateFields.0.id', 'customfield_10016')
            ->where('pokerSources.0.defaultEstimateFieldId', 'customfield_10016'));
});
```

- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.

- [ ] **Step 3: Implement**

```php
<?php

namespace App\Actions\Poker;

use App\Enums\IntegrationProvider;
use App\Models\PokerGame;
use App\Models\Team;
use App\Models\TeamIntegration;
use Illuminate\Validation\Rule;

class PokerGameSettingsRules
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public static function rules(Team $team): array
    {
        return [
            'revote_after_reveal' => ['sometimes', 'boolean'],
            'task_timer_seconds' => ['sometimes', 'nullable', 'integer', Rule::in(PokerGame::TaskTimerChoices)],
            'writes_estimates' => ['sometimes', 'boolean'],
            'estimate_field_id' => ['sometimes', 'nullable', 'string', 'max:100', Rule::in(self::estimateFieldIds($team))],
        ];
    }

    /**
     * @return array<int, string>
     */
    public static function estimateFieldIds(Team $team): array
    {
        $team->loadMissing('integrations');

        return $team->integrations
            ->filter(fn (TeamIntegration $integration): bool => in_array($integration->provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter], true))
            ->flatMap(fn (TeamIntegration $integration): array => array_column((array) $integration->setting('numberFields', []), 'id'))
            ->filter(fn (mixed $id): bool => is_string($id))
            ->values()
            ->all();
    }
}
```

- `TeamPokerGamesController@store`: `...PokerGameSettingsRules::rules($team)` in `validate()`; pass the four values to `NewPokerGame` (`(bool)`, `isset(...) ? (int) … : null`, default true for `writes_estimates`). `CreatePokerGame` writes them in `create([...])`.
- `PokerSettingsController@update`: `...PokerGameSettingsRules::rules($locked->team)` — the rules need the team before the transaction: use `$game->team`; add the four keys to `attributes()`'s `Arr::only`.
- `BuildPokerSnapshot`: the four keys in `game`.
- `ListPokerSources`: the two keys per row, as described in **Interfaces**.
- `PresentNewSessionOptions`: `'pokerSources' => $viewer->can('createPokerGame', $team) && IntegrationProvider::anyEnabled() ? $listPokerSources->handle($team) : []`.

- [ ] **Step 4: Run the tests** — `bin/test-db pgsql -- tests/Feature/Poker tests/Feature/Sessions tests/Feature/Integrations`, then `sqlite`. Expected: PASS.

- [ ] **Step 5: Commit** — `feat(poker): the game options at creation and in the room settings` (trailers).

### Task 12: Poker — browse a tracker from the team, and import at creation

**Files:**
- Create: `app/Actions/Integrations/FetchPokerImport.php`, `PokerImportBatch.php`; `app/Http/Controllers/Integrations/TeamPokerImportContainersController.php`, `TeamPokerImportIterationsController.php`, `TeamPokerImportPreviewsController.php`
- Modify: `app/Actions/Integrations/ImportPokerTasks.php` (extract `storeIssues`), `app/Actions/Poker/CreatePokerGame.php`, `app/Http/Controllers/TeamPokerGamesController.php`, `routes/web.php`
- Test: `tests/Feature/Integrations/PokerCreationImportTest.php`

**Interfaces:**
- Consumes: `ResolvePokerTracker`, `ListPokerIterations`, `PreviewPokerImport::fetch`, `Trackers::for()->issues()`, `TrackerBrowseLimit`, `DetectJiraStoryPointFields::ensureTextFields` (Task 5), `NewPokerGame::$import` (Task 11).
- Produces: `PokerImportBatch` (public `TeamIntegration $integration`, `array $externalIds` list<string>, `array $issues` array<string, TrackerIssue>); `FetchPokerImport::handle(Team $team, string $source, array $externalIds): PokerImportBatch` (throws `ValidationException` on `import_ids` with the tracker's `userMessage()`); `ImportPokerTasks::storeIssues(PokerGame $locked, TeamIntegration $integration, array $externalIds, array $issues): array{imported: int, skipped: int}` (no lock, no guard: the caller holds the game lock); routes `teams.pokerImports.containers.index`, `teams.pokerImports.iterations.index`, `teams.pokerImports.preview.store`.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Enums\IntegrationProvider;
use App\Models\PokerGame;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Jira);
});

function importTeam(): array
{
    $team = Team::factory()->create();
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);

    return [$team, $integration, teamMember($team)];
}

it('creates the game with the chosen tickets in the source order', function () {
    [$team, , $member] = importTeam();
    fakeJiraTrackerApi([
        jiraTrackerIssue('10002', 'PROJ-2', ['labels' => ['csv']]),
        jiraTrackerIssue('10001', 'PROJ-1'),
    ]);

    $this->actingAs($member)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 44 refinement', 'deck' => 'fibonacci',
            'import_source' => 'jira', 'import_ids' => ['10002', '10001', '10404'],
        ])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('flash.toast');

    $game = PokerGame::query()->sole();

    expect($game->tasks()->orderBy('position')->pluck('external_key')->all())->toBe(['PROJ-2', 'PROJ-1'])
        ->and($game->tasks()->where('external_key', 'PROJ-2')->sole()->external_labels)->toBe(['csv']);
});

it('creates nothing when the tracker fails', function () {
    [$team, , $member] = importTeam();
    Http::fake(['api.atlassian.com/*' => Http::response(['errorMessages' => ['boom']], 500)]);

    $this->actingAs($member)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'P', 'deck' => 'fibonacci', 'import_source' => 'jira', 'import_ids' => ['10001'],
        ])
        ->assertSessionHasErrors('import_ids');

    expect(PokerGame::query()->count())->toBe(0);
});

it('refuses an import with typed tasks, and an import without a connection', function () {
    [$team, , $member] = importTeam();

    $this->actingAs($member)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'P', 'deck' => 'fibonacci', 'import_source' => 'jira', 'import_ids' => ['1'], 'tasks' => ['Typed'],
        ])
        ->assertSessionHasErrors('import_ids');

    $this->actingAs($member)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'P', 'deck' => 'fibonacci', 'import_source' => 'linear', 'import_ids' => ['1'],
        ])
        ->assertNotFound();

    expect(PokerGame::query()->count())->toBe(0);
});

it('browses the tracker from the team, as from a game', function () {
    [$team, , $member] = importTeam();
    fakeJiraTrackerApi();

    $this->actingAs($member)
        ->getJson(route('teams.pokerImports.containers.index', [$team->workspace, $team, 'jira']))
        ->assertOk()
        ->assertJsonPath('containers.0.name', 'Sweep scrum board');

    $this->actingAs($member)
        ->getJson(route('teams.pokerImports.iterations.index', [$team->workspace, $team, 'jira', 'container' => '7']))
        ->assertOk()
        ->assertJsonPath('0.name', 'Sprint 31');

    $this->actingAs($member)
        ->postJson(route('teams.pokerImports.preview.store', [$team->workspace, $team, 'jira']), ['mode' => 'query', 'query' => 'project = PROJ'])
        ->assertOk()
        ->assertJsonPath('issues.0.key', 'PROJ-1')
        ->assertJsonPath('issues.0.alreadyImported', false);

    $this->actingAs(User::factory()->create())
        ->getJson(route('teams.pokerImports.containers.index', [$team->workspace, $team, 'jira']))
        ->assertForbidden();
});
```

The flash key (`flash.toast`) is the one the application uses for toasts after a redirect: read `HandleInertiaRequests` and use it (the message ":imported tickets imported, :skipped skipped."). The JSON shape of iterations is `ListPokerIterations::iterations()`'s.

- [ ] **Step 2: Run it to see it fail.** Expected: FAIL.

- [ ] **Step 3: Implement**

`ImportPokerTasks`: move the body of `store()` that follows the guards into `public function storeIssues(PokerGame $locked, TeamIntegration $integration, array $externalIds, array $issues): array` — unchanged lines, the 200-task limit included; `store()` keeps the transaction, the lock and the guards and calls it.

`app/Actions/Integrations/PokerImportBatch.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\TrackerIssue;

class PokerImportBatch
{
    /**
     * @param  list<string>  $externalIds  in the order the client chose them
     * @param  array<string, TrackerIssue>  $issues  keyed by external id; an id the source did not return is absent
     */
    public function __construct(
        public TeamIntegration $integration,
        public array $externalIds,
        public array $issues,
    ) {}
}
```

`app/Actions/Integrations/FetchPokerImport.php`:

```php
<?php

namespace App\Actions\Integrations;

use App\Exceptions\Integrations\IntegrationException;
use App\Models\Team;
use App\Support\Integrations\Trackers\Trackers;
use Illuminate\Validation\ValidationException;

/**
 * Spec plan 22 §6.4: the tickets are read from the source before the game
 * exists, so that a failing tracker leaves nothing behind. Only the ids
 * the client sends are trusted, as ids.
 */
class FetchPokerImport
{
    public function __construct(
        private ResolvePokerTracker $resolvePokerTracker,
        private Trackers $trackers,
        private DetectJiraStoryPointFields $detectJiraStoryPointFields,
    ) {}

    /**
     * @param  list<string>  $externalIds
     */
    public function handle(Team $team, string $source, array $externalIds): PokerImportBatch
    {
        $integration = $this->resolvePokerTracker->handle($team, $source);
        $externalIds = array_values(array_unique($externalIds));

        try {
            $this->detectJiraStoryPointFields->ensureTextFields($integration);
            $issues = $this->trackers->for($integration->provider)->issues($integration, $externalIds);
        } catch (IntegrationException $exception) {
            throw ValidationException::withMessages(['import_ids' => $exception->userMessage()]);
        }

        return new PokerImportBatch($integration, $externalIds, $issues);
    }
}
```

`ResolvePokerTracker::handle` throws `NotConnected` (an `IntegrationException`) for a missing connection and a 404 for an unknown or disabled source: call it **before** the `try` so that the 404 stays a 404, and catch `NotConnected` too (it is inside the `IntegrationException` family: move the resolve call into the `try` if the test "an import without a connection" expects 422; it expects 404 for a source disabled on the instance, which `enableIntegrations(Jira)` makes Linear — keep the resolve outside).

`TeamPokerGamesController@store`: rules `'import_source' => ['required_with:import_ids', 'string', Rule::in(['jira', 'linear', 'jira_dc', 'github'])]`, `'import_ids' => ['sometimes', 'array', 'min:1', 'max:100', 'prohibits:tasks']`, `'import_ids.*' => ['required', 'string', 'max:100', 'distinct']`. Before calling `CreatePokerGame`: `$import = isset($validated['import_ids']) ? $fetchPokerImport->handle($team, $validated['import_source'], array_values($validated['import_ids'])) : null;` and pass `import: $import`. After creation, when `$import !== null` and some ids were skipped, redirect with the toast. `CreatePokerGame`: after the facilitator and the typed tasks, `if ($new->import !== null) { $result = $this->importPokerTasks->storeIssues($game, $new->import->integration, $new->import->externalIds, $new->import->issues); }` and return the counts to the controller (change `handle()` to set them on a public property of the action's result, or return `[$game, $result]` — choose the smaller change and keep `handle()`'s other callers compiling: MCP's game creation calls it too).

The three team-scoped controllers mirror the game-scoped ones: `Gate::authorize('createPokerGame', $team)` instead of the player guards, `TrackerBrowseLimit::hit($request->user()->id)`, the same validation; the preview maps `PreviewPokerImport::fetch(...)` issues with `->preview(false)`. Routes inside `w/{workspace}`:

```php
Route::get('teams/{team}/poker-imports/{source}/containers', [TeamPokerImportContainersController::class, 'index'])->name('teams.pokerImports.containers.index')->where('source', 'jira|linear|jira_dc|github');
Route::get('teams/{team}/poker-imports/{source}/iterations', [TeamPokerImportIterationsController::class, 'index'])->name('teams.pokerImports.iterations.index')->where('source', 'jira|linear|jira_dc|github');
Route::post('teams/{team}/poker-imports/{source}/preview', [TeamPokerImportPreviewsController::class, 'store'])->name('teams.pokerImports.preview.store')->where('source', 'jira|linear|jira_dc|github');
```

(inside the integrations-enabled group of the team routes if there is one: read how `teams.integrations.*` are grouped and follow it.)

- [ ] **Step 4: Run the tests** — `bin/test-db pgsql -- tests/Feature/Integrations tests/Feature/Poker tests/Feature/Mcp tests/Arch`, then `sqlite`. Expected: PASS.

- [ ] **Step 5: Commit** — `feat(poker): import tickets while creating the game` (trailers).

---

## Step C — screens

### Task 13 (main): Front foundation — the shared dialog, kind tones, types

**Files:**
- Create: `resources/js/components/teams/team-new-session-dialog.tsx` (+ `.test.tsx`), `resources/js/lib/teams/sessions.ts` (+ `.test.ts`)
- Modify: `resources/js/components/teams/team-page.tsx`, `resources/js/components/skrum/session-type-picker.tsx` (export `sessionKindTone(kind)` and `sessionKindIcon(kind)`), `resources/js/types/*.ts` (the `NewSessionOptions` type), `resources/js/lib/poker/types.ts` (`PokerTrackerSourceRow` with `estimateFields`, `defaultEstimateFieldId`; `PokerTask['external']` with `type`, `labels`, `acceptanceCriteriaHtml`; game fields of Task 11), `resources/js/lib/retro/types.ts` (`phaseDurations`)

**Interfaces:**
- Produces: `TeamNewSessionDialog({ workspace, team, options, intent, trigger })` — the `NewSessionDialog` with the five forms exactly as `team-page.tsx` builds them today, `options: NewSessionOptions` (the keys of `PresentNewSessionOptions`); `team-page.tsx` uses it. `lib/teams/sessions.ts`: `type TeamSession` (the server row), `SessionTabs: readonly ['upcoming', 'live', 'finished']`, `sessionMeta(row, t): string` (the meta line), `sessionsHref(workspace, team, tab, before?)`.

- [ ] **Step 1: Failing Vitest.** `lib/teams/sessions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sessionMeta, type TeamSession } from './sessions';

const t = (key: string, replace: Record<string, string | number> = {}) =>
    Object.entries(replace).reduce((text, [name, value]) => text.replace(`:${name}`, String(value)), key);

const base: TeamSession = {
    kind: 'retro', id: '1', title: 'R', url: '/r', state: 'live', updatedAt: '2026-10-02T10:00:00+00:00',
    isDraft: false, phase: 'Writing', people: 9, tasks: null, facilitator: null, answers: null, game: null,
};

describe('sessionMeta', () => {
    it('describes each kind as the mockup does', () => {
        expect(sessionMeta(base, t)).toBe('Retro · Writing · 9 people');
        expect(sessionMeta({ ...base, kind: 'poker', tasks: 12 }, t)).toBe('Planning poker · 12 tasks');
        expect(sessionMeta({ ...base, kind: 'whiteboard', facilitator: 'Inès' }, t)).toBe('Whiteboard · Facilitated by Inès');
        expect(sessionMeta({ ...base, kind: 'survey', answers: 7 }, t)).toBe('Poll · 7 answers');
        expect(sessionMeta({ ...base, kind: 'icebreaker', game: 'Hangman' }, t)).toBe('Icebreaker · Hangman');
    });

    it('drops a part the row does not have', () => {
        expect(sessionMeta({ ...base, kind: 'whiteboard', facilitator: null }, t)).toBe('Whiteboard');
    });
});
```

The real `t` handles plurals (`:count people` with a plural form): use `t(':count people|:count person', …)` only if the project's `useTrans` supports choice strings — read `hooks/use-trans.ts`; otherwise keep the key `:count people` and let Task 19 translate it. `team-new-session-dialog.test.tsx`: the five tiles in the order Retro, Poker, Whiteboard, Poll, Icebreaker for a member who may create all; Poker absent without `canCreatePokerGame`; the dialog opens on `?new=poker` (reuse the cases of `new-session-dialog.test.tsx` that cover the team page's wiring and move them here).

- [ ] **Step 2: Build.** Move the `NewSessionDialog` block of `team-page.tsx` (lines from `<NewSessionDialog` to its closing tag, with `useNewSessionIntent` and `canManageTemplates`) into `TeamNewSessionDialog`; `team-page.tsx` renders `<TeamNewSessionDialog workspace={workspace} team={team} options={props} trigger={…} />`. Export from `session-type-picker.tsx` the `kinds` record's tone and icon through the two functions (no change of colours). Write `lib/teams/sessions.ts`.
- [ ] **Step 3: Gates and commit.** `npm run test -- sessions team-new-session-dialog team-page new-session-dialog session-type-picker`, `npm run types:check`, `npm run check`, `npm run build:front`. Commit `refactor(teams): the New session dialog as one component, kind tones exported` (trailers).

### Task 14 (lane S): The Sessions page

**Mockup:** `ScreenSessionCreate`, the page behind the overlay (frames a–d, EN and FR); `SessionTypePicker` (kind tiles); `Pagination` ("Load more"); `EmptyState`; `Skeleton` ("Loading sessions"); `MobileDashboard` (tab bar).

**Files:**
- Create: `resources/js/components/skrum/session-row.tsx` (+ test), `resources/js/components/teams/sessions-page.tsx` (+ test)
- Modify: `resources/js/pages/teams/sessions.tsx`, `resources/js/hooks/use-sidebar-model.ts` (+ test), `resources/js/components/skrum/mobile-tab-bar.tsx` (+ test), `resources/js/components/teams/use-team-anchor.ts` (+ test: `#sessions` no longer marks the sidebar's Sessions entry on the team page), `resources/js/pages/dev/sections/*` (a bench entry for `SessionRow`)

**Composition (element by element):**

| Mockup element | Built with |
|---|---|
| breadcrumb "Atlas › Sessions" | `AppLayout` `breadcrumbs`: team → `TeamsController.show`, "Sessions" |
| H2 "Sessions" + muted line | `h1` in the display style of the team header, `t('Retros, poker, whiteboards, polls and icebreakers of :team', { team })` |
| "New session" (primary, plus icon, focus ring kept on return) | `TeamNewSessionDialog` (Task 13) with the page's options and `useNewSessionIntent()` |
| tabs Upcoming / Live / Finished, left-aligned | `ui/tabs` list of `Link`s (`sessionsHref`), `aria-current="page"` on the active one; Inertia visit with `preserveScroll: false` |
| a row: kind tile, title (strong sm), meta (xs muted), chevron | `SessionRow` (presentational: `href`, `kind`, `title`, `meta`, `badge?`), a `Card` with the kind tile from `sessionKindTone`/`sessionKindIcon`, `ChevronRight` muted; the whole row is one `Link` with an accessible name "title, meta" |
| draft poll | `Badge variant="outline"` "Draft" after the title |
| date (P22-01) | ` · ` + short date of `updatedAt` (`Intl.DateTimeFormat(locale, { dateStyle: 'medium' })`) on Upcoming and Finished rows |
| list | `LoadMoreFeed` (`role="feed"`, `aria-busy` while loading) |
| "Load more" / end line | `LoadMore` with `remaining = total - rows.length`, `total`, `endLabel = t("You're all caught up · :count sessions", …)` |
| empty tab | `EmptyState` per tab ("No upcoming session", "No live session right now", "No finished session yet"; the action "New session" when any form is offered) |

**Behaviours:**
- The tab is the URL's (`?tab=`); a tab change is an Inertia visit that resets the accumulated rows.
- "Load more": `router.reload({ only: ['sessions', 'nextCursor'], data: { tab, before: nextCursor }, preserveUrl: true })`; the page keeps `rows` in state, appends the new page in `onSuccess`, and resets it when `tab` changes (a `key={tab}` on the container is enough).
- Loading: the `Skeleton` of `skrum/skeletons` ("Loading sessions") replaces the list during a tab visit (Inertia's `router.on('start')` for a visit to this page); the `LoadMore` button carries its own loading state.
- Phone (< 768 px): rows full width; the tab list scrolls horizontally without page overflow; "New session" stays in the header (icon and label; label hidden under 22.5rem with an `aria-label`).
- Sidebar and phone tab bar: `links.sessions = TeamSessionsController.index({ workspace, team })`; on this page `active="sessions"`; on the team page the `#sessions` anchor no longer selects "Sessions" (it stays a plain anchor of the page).

**Vitest:** (a) a row per session with its meta line and link; (b) the active tab has `aria-current="page"` and the URL's tab; (c) "Load more" calls `router.reload` with `before` and appends the second page without duplicates; (d) the end line appears when `nextCursor` is null and shows the total; (e) each tab's empty state, with "New session" only when a form is offered; (f) the draft badge; (g) the date only on Upcoming and Finished rows; (h) the sidebar model links Sessions to the page; the team anchor hook no longer returns `sessions`.

**Hooks kept for later tests:** `data-slot="sessions-page"`, `data-slot="session-row"` with `data-kind`, tab links named "Upcoming", "Live", "Finished".

- [ ] **Step 1:** Write the Vitest files (cases above). **Step 2:** Build. **Step 3:** `npm run test -- session-row sessions-page use-sidebar-model mobile-tab-bar use-team-anchor app-layout`, `npm run types:check`, `npm run check`, `npm run build:front`; `bin/test-db pgsql -- tests/Feature/Sessions tests/Arch/FrontEndPagesTest.php`. **Step 4:** Commit `feat(sessions): the Sessions page — tabs, rows, load more, empty states` (trailers).

### Task 15 (lane K): Ticket details on the story card; the criteria field in the integration settings

**Mockup:** `ScreenPokerBefore` (the story card: "ATLAS-1287 · Story · Actions · 3 / 6 de la séance", title, description, "Critères d'acceptation" list).

**Files:**
- Create: `resources/js/components/poker/ticket-details.tsx` (+ test)
- Modify: `resources/js/components/poker/story-card.tsx` (+ test), `resources/js/components/integrations/story-points-field.tsx` (+ test) or a sibling `acceptance-criteria-field.tsx` rendered beside it, `resources/js/types/integrations.ts`

**Composition:**

| Mockup element | Built with |
|---|---|
| key chip | existing `TaskSourceLink` |
| type ("Story") | `Badge variant="outline"` after the key, `data-slot="ticket-type"` |
| label ("Actions") | one `Badge variant="secondary"` per label (wrap, at most 10), `data-slot="ticket-label"` |
| position | existing ":position / :total in this game" |
| description | existing rendered Markdown |
| "Acceptance criteria" + list | `TicketCriteria`: an `h3` small label "Acceptance criteria" and the server's `acceptanceCriteriaHtml` in `MarkdownClasses`, after the description |

`StoryCard`'s top line renders `<TicketChips external={task.external} />` right after `TaskSourceLink`; the `details` prop (reserved by 18e for PK-1) is removed and its comment with it; `TicketCriteria` renders after the description. Nothing renders for a missing field.

Integration settings: under the story-points field select of a Jira or Jira DC connection, the select "Acceptance criteria field" (options "None" and `settings.textFields`, value `settings.acceptanceCriteriaField`), saved with the same request helper as the story-points field (`acceptance_criteria_field_id`).

**Vitest:** (a) type and labels after the key, in order; (b) the criteria block after the description, from the HTML; (c) nothing for a typed task, nothing for an imported task with no details; (d) the settings select lists "None" and the text fields, sends `acceptance_criteria_field_id: null` for "None".

- [ ] **Steps:** failing Vitest; build; `npm run test -- story-card ticket-details story-points-field`, the three front gates; commit `feat(poker): ticket type, labels and acceptance criteria on the story card` (trailers).

### Task 16 (lane C): The retro form — Max per card and Timer per phase; the settings popover row

**Mockup:** `ScreenSessionCreate` frames a and c, the "Settings" rows.

**Files:**
- Create: `resources/js/lib/retro/phase-durations.ts` (+ test), `resources/js/components/teams/session-create/phase-timers-field.tsx` (+ test)
- Modify: `resources/js/components/teams/session-create/retro-session-fields.tsx` (+ its tests in `new-session-dialog.test.tsx` or a new `retro-session-fields.test.tsx`), `resources/js/components/retro/board-settings.tsx` (+ test)

**Pure logic** (`lib/retro/phase-durations.ts`):

```ts
export const TimedPhases = ['writing', 'grouping', 'voting', 'discussing', 'actions'] as const;

export type TimedPhase = (typeof TimedPhases)[number];

export type PhaseDurations = Partial<Record<TimedPhase, number>>;

export const StandardDurations: Required<PhaseDurations> = {
    writing: 7,
    grouping: 5,
    voting: 3,
    discussing: 15,
    actions: 5,
};

export type PhaseTimerChoice = 'none' | 'standard' | 'custom';

export function choiceOf(durations: PhaseDurations | null): PhaseTimerChoice {
    if (durations === null || Object.keys(durations).length === 0) {
        return 'none';
    }

    const isStandard = TimedPhases.every((phase) => durations[phase] === StandardDurations[phase]);

    return isStandard ? 'standard' : 'custom';
}

/** The payload: null when no phase is timed, otherwise the phases with minutes. */
export function toPayload(durations: PhaseDurations): PhaseDurations | null {
    const kept = Object.fromEntries(
        TimedPhases.filter((phase) => (durations[phase] ?? 0) >= 1).map((phase) => [phase, durations[phase] as number]),
    ) as PhaseDurations;

    return Object.keys(kept).length === 0 ? null : kept;
}

/** "Writing 7 · Voting 3 · Discussing 15": the help line of the row. */
export function summary(durations: PhaseDurations | null, label: (phase: TimedPhase) => string): string | null {
    const kept = durations === null ? null : toPayload(durations);

    if (kept === null) {
        return null;
    }

    return TimedPhases.filter((phase) => kept[phase] !== undefined)
        .map((phase) => `${label(phase)} ${kept[phase]}`)
        .join(' · ');
}
```

Vitest for it: `choiceOf` of null, of the standard set, of one changed value; `toPayload` drops zeros and returns null when empty; `summary` lists phases in phase order, not key order.

**Composition (dialog):** after "Votes per person": "Max per card" — the stepper of the row above (the file's `Stepper`), `heart` icon, help "Votes one person can stack", min 1, max the votes per person (20 with "Automatic"), sent as plan 21's key; then "Timer per phase" — `timer` icon, help = `summary(…)` or "Off", control `ui/select` with "No timer", "Standard", "Custom (5 phases)"; with Custom, `PhaseTimersField` under the row: five rows (phase label, stepper 0–60 where 0 is "Off"). Sent as `phase_durations: toPayload(…)`. Ids: `#new-retro-max-per-card`, `#new-retro-phase-timers`, `#new-retro-phase-<phase>`.

**Settings popover:** the same select and field in `board-settings.tsx`, facilitator only, open retro only, saved through the existing settings request with `phase_durations`.

**Vitest:** (a) the two rows in the mockup's order; (b) "Standard" sends the five values; "No timer" sends `null`; Custom with writing 10 and the rest off sends `{ writing: 10 }`; (c) the max-per-card stepper is capped by the votes per person; (d) the popover row is absent for a participant who is not the facilitator; (e) a server error on `phase_durations` shows under the row.

- [ ] **Steps:** failing Vitest; build; `npm run test -- phase-durations phase-timers-field retro-session-fields board-settings new-session-dialog`, the three gates; commit `feat(retro): max per card and timers per phase in the dialog and the settings` (trailers).

### Task 17 (lane C): The poker form's settings; the room settings popover; the dock after reveal

**Mockup:** `ScreenSessionCreate` frames b and d (right column); `ScreenPokerBefore` (dock).

**Files:**
- Modify: `resources/js/components/teams/session-create/poker-session-fields.tsx` (+ test), `resources/js/components/poker/room-topbar.tsx` or the settings popover file D-70 created (+ test), `resources/js/components/poker/room-dock.tsx` (+ test), `resources/js/components/poker/use-round-actions.ts` (+ test, if it decides when a card can be played)

**Composition (dialog, right column, in the mockup's order):** Auto reveal; Facilitator in "Watch only"; **Timer per task** (`timer` icon, help "Nudges after the delay", `ui/select` `#new-poker-task-timer`: "Off", "1 minute", "3 minutes", "5 minutes", "10 minutes" → `task_timer_seconds` null/60/180/300/600); **Change vote after reveal** (`refresh-ccw` icon, help "Before the estimate is saved", `ui/switch` `#new-poker-revote`); **Write estimates to :source** (`upload` icon, help "Field used for the estimate", `ui/select` `#new-poker-write-back`: "Don't write" + `estimateFields` for Jira, "Write" for the others; preselected `defaultEstimateFieldId` / "Write"; sends `writes_estimates` and `estimate_field_id`) — rendered only when a source with `canWriteBack` exists (the first such source; the import tab's source when it is one of them); the info note (`ui/alert`, info) "Estimates are written to :source when the facilitator clicks “Save estimate”. Unselected tickets stay in the backlog." under the rows when the write row shows. Invitation block unchanged.

**Room settings popover:** the same three rows, facilitator only, while the game is not ended; saved through `poker.settings.update` with the keys of Task 11.

**Dock:** when `game.revoteAfterReveal` and the round is revealed and the current task has no estimate, the deck stays enabled; the hint under it reads "Your card · :value — you can still change it until the estimate is saved."; playing a card calls the same vote request (the server answers with `myVote`); once the estimate is saved (task payload `estimate` not null) the deck closes as today. A withdrawal (clicking the selected card again) is disabled after reveal.

**Vitest:** (a) rows in order with ids and payload values; (b) the write row absent without a writable source, with "Don't write" sending `writes_estimates: false, estimate_field_id: null`; (c) a Linear source shows "Write" / "Don't write" only; (d) the popover rows for the facilitator only; (e) the dock enabled after reveal with the setting, disabled without it or once estimated; the hint text; no withdrawal after reveal.

- [ ] **Steps:** failing Vitest; build; `npm run test -- poker-session-fields room-topbar room-dock use-round-actions`, the three gates; commit `feat(poker): task timer, change after reveal and write-back in the dialog and the room` (trailers).

### Task 18 (lane C): The poker form's "Import from <source>" tab

**Mockup:** `ScreenSessionCreate` frames b and d, the Tasks block (tabs, JQL in mono, `sk-ticket` rows, "9 of 12 selected · Select all").

**Files:**
- Create: `resources/js/lib/poker/tracker-browse.ts` (+ test), `resources/js/components/poker/tracker-issue-picker.tsx` (+ test), `resources/js/components/teams/session-create/poker-import-field.tsx` (+ test)
- Modify: `resources/js/components/poker/import-tasks-dialog.tsx` (+ test: it now renders `TrackerIssuePicker`, behaviour unchanged), `resources/js/components/teams/session-create/poker-tasks-field.tsx` (+ test), `poker-session-fields.tsx` (+ test)

**Pure logic** (`lib/poker/tracker-browse.ts`): `importTerms(source, t)` moved from `import-tasks-dialog.tsx` unchanged; `type TrackerBrowseApi = { containers(source, q, page): Promise<…>; iterations(source, container): Promise<…>; preview(source, body): Promise<{ issues: TrackerIssuePreview[]; truncated: boolean }> }`; `gameBrowseApi(gameId)` (the existing `PokerImport*Controller` routes through `retroRequest`) and `teamBrowseApi(workspace, teamId)` (the `TeamPokerImport*Controller` routes); `selectionLabel(selected, total, t)` → "n of m selected"; `toggleAll(issues, selected)` (selects every issue not `alreadyImported`, or none when all are).

**Composition:** `TrackerIssuePicker` is the body of today's dialog (source terms, board/sprint or query mode with `ToggleGroup`, the search field and select (D-71), the list of checkbox rows `sk-ticket` with key in mono and title, the truncated note, the error `Alert`, the "n of m selected · Select all" bar) taking `api`, `source`, `selected`, `onSelectedChange`; the dialog keeps its title, footer and import request. `PokerImportField` is the picker inside the creation form, with a source select above it when `pokerSources` has two or more importable sources. `PokerTasksField` gains the first tab "Import from :source" (only when an importable source exists; `PokerTasksValue.mode` gains `'import'` with `source` and `ids`), and the poker form sends `import_source` and `import_ids` (never `tasks` in that mode). A server error on `import_ids` shows under the picker.

**Vitest:** `tracker-browse.test.ts` (terms per source, `selectionLabel`, `toggleAll` skipping imported ones); `tracker-issue-picker.test.tsx` (query mode lists previews; selection; "Select all"; error and truncated states, with a mocked `api`); `poker-import-field.test.tsx` (source select only with two sources; uses `teamBrowseApi`); `poker-tasks-field.test.tsx` (three tabs with a source, two without; the import tab first; "Later" stays preselected in both cases, the 18e default); `poker-session-fields.test.tsx` (the payload in import mode); `import-tasks-dialog.test.tsx` passes unchanged except imports.

- [ ] **Steps:** failing Vitest; build; `npm run test -- tracker-browse tracker-issue-picker poker-import-field poker-tasks-field poker-session-fields import-tasks-dialog`, the three gates; commit `feat(poker): import tickets from the New session dialog` (trailers).

---

## Final

### Task 19: Translations

- [ ] List every key added by Tasks 2 to 18 (`git diff main -- lang/en.json`) and review `fr.json`, `es.json`, `de.json` for each: informal register (tu / tú / du), the glossary of `docs/superpowers/research/front-rewrite/translations-review.md` (session, poll ↔ sondage / encuesta / Umfrage, facilitator, estimate), the mockup's French where it exists: "Sessions", "À venir", "En cours", "Terminées", "Rétros, poker, whiteboards, sondages et icebreakers de :team", "Max par carte", "Votes cumulables sur une carte", "Timer par phase", "Personnalisé (5 phases)", "Timer par tâche", "Relance après le délai", "Revoter après révélation", "Avant l'enregistrement", "Écrire l'estimation dans :source", "Champ utilisé pour l'estimation", "Les estimations sont écrites dans :source quand le facilitateur clique sur « Enregistrer l'estimation ». Les tickets non cochés restent dans le backlog.", "Importer de :source", "Saisie manuelle", "Plus tard", ":selected sur :total sélectionnés", "Tout sélectionner", "Critères d'acceptation".
- [ ] `bin/test-db pgsql -- tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php`, then `sqlite`. Expected: PASS.
- [ ] Commit `chore(lang): plan 22 strings in four languages, informal` (trailers).

### Task 20: Captures (light, 1440, French)

No browser walkthrough is written, edited or run. Captures only, through `tests/Browser/Visual` (`CapturesVisuals::captureVisuals`, honouring `VISUAL_ONLY`).

**Files:** Create `tests/Browser/Visual/SessionsPagesVisualTest.php`; modify `SessionCreateVisualTest.php` (the two dialog variants) and the poker room visual file (the story card with details).

| Name | Screen |
|---|---|
| `sessions-live` | the Sessions page, Live tab, one session of each kind (frame a's list: "Sprint 42 retro", "Sprint 43 refinement", "Q4 architecture", "Team health · October") |
| `sessions-finished` | the Finished tab with 25 sessions ("Load more" visible) |
| `session-create-retro-options` | the dialog on retro with "Max per card" 2 and "Timer per phase" Custom open |
| `session-create-poker-import` | the dialog on poker, Jira import tab with a query and 12 tickets, 9 selected, the three settings rows (fixtures with `Http::fake` of the team-scoped preview) |
| `poker-story-details` | the poker room before reveal with ATLAS-1287 "Story", "Actions", three acceptance criteria |

- [ ] Run as the 18e captures were taken: `npm run build:front`, then `docker compose exec -e VISUAL_ONLY=light-1440-fr laravel.test php artisan test --compact tests/Browser/Visual/SessionsPagesVisualTest.php` and the two modified files. The overflow check must pass. Only `-light-1440-fr.png` files are written.
- [ ] Commit `test(visual): sessions page, creation options and story card captures` (trailers).

### Task 21: Deviations and documents

- [ ] Open each capture of Task 20 beside its mockup's `preview.html` (light, 1440, French); each remaining difference is fixed or becomes a row of **Pre-build deviations** with the owner's word; a difference that fits no reason stops the task.
- [ ] Documents, one commit:
  - the spec to `docs/superpowers/specs/2026-10-22-sessions-index-and-creation-options-design.md` and this plan to `docs/superpowers/plans/2026-10-22-plan-22-sessions-and-creation-options.md`, with the owner's answers to §15 folded in;
  - `docs/superpowers/research/front-rewrite/feature-roadmap.md`: SE-1, SE-3, PK-1 marked done (plan 22); SE-2 marked backlog (owner, 2026-10-02); the dependency lines updated (TM-1 and ON-1 no longer wait on SE-2; TM-2 reads `ListTeamSessions`);
  - `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, "Deviations from the mockup": D-06 reduced to "Schedule…" (backlog); D-07 reduced to the ROTI switch (backlog); D-16 reduced to the spectator eye and the Share roles (backlog);
  - `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` §6.4 and §10 with a pointer to the new spec;
  - `docs/database.md`: nothing, unless a task found a new rule.
- [ ] Commit `docs: plan 22 — spec and plan in place, roadmap and deviation rows updated` (trailers).

### Task 22: Full suites on four engines, and report

- [ ] `vendor/bin/pint --format agent`; `vendor/bin/sail composer types:check`; `vendor/bin/sail composer rector:check`.
- [ ] `bin/test-db pgsql`, then `sqlite`, `mariadb`, `mysql` (Unit, Feature, Upgrade and Arch; one engine at a time). Expected: `test-db <engine>: PASS` on each.
- [ ] `bin/test-db pgsql --concurrency`, `mariadb --concurrency`, `mysql --concurrency`, `sqlite-file --concurrency`. Expected: PASS on each.
- [ ] `bin/check-pg-upgrade`. Expected: PASS.
- [ ] `npm run test`, `npm run types:check`, `npm run check`, `npm run build:front`. Expected: PASS.
- [ ] Report `docs/superpowers/research/plan-22-report.md`: each acceptance criterion of spec §12 with the test that proves it and the engines it passed on; the differences left with each mockup; existing tests edited and why; plan 21's names used (column, timer method) and any plan-21 task this plan skipped; whether GitHub's `issueType` was kept (spec §16.3); the decisions taken on the owner's behalf.
- [ ] Commit `docs: plan 22 report` (trailers). Ask the owner to read the report. No merge into `main`, no push.

---

## Self-review (done while writing; kept for the reader)

**Spec coverage.** §6.1 states and cursor: Task 2; rows' meta: Tasks 2 and 13; §6.2 phase durations: Task 7 (back), 16 (front); max per card at creation: Tasks 7 and 16 (plan 21's column); §6.3 revote: Task 8 (+ dock in 17); task timer: Task 9 (+ 17); write-back per game: Task 10 (+ 17); options at creation and in the room: Task 11; §6.4 import at creation: Task 12 (back), 18 (front); §6.5 ticket details: Tasks 5, 6 (back), 15 (front); §7 permissions: Tasks 4 (view), 2 (drafts), 7 and 11 (facilitator), 12 (`createPokerGame`), 5 (`manageIntegrations` through the integration update route); §8 real time: Tasks 7 (`TimerChanged`), 8 (`PokerRoundChanged`), 11 (`PokerGameChanged`, existing); §9 screens: 14, 16, 17, 18, 15; §10 no migration of data: Task 1 defaults, Task 2's card rule, Task 5's once-only detection; §11 routes: Tasks 4 and 12; §12 criteria: 1 → 4, 14; 2 → 2; 3 → 2 (walk), 22 (four engines); 4 → 2, 14; 5 → 3, 13, 14; 6 → 7; 7 → 7; 8 → 9; 9 → 8; 10 → 10, 11; 11 → 12; 12 → 12; 13 → 5, 6; 14 → 15; 15 → 5, 15; 16 → 19; 17 → 20, 21; 18 → 22.

**Placeholders.** Back-end tasks carry their tests and code; where the plan names a route, a helper or a relation it has not read line by line (the retro phase route, the snapshot paths, `surveyFacilitatorFor`, the toast flash key, `PokerRound::task`), the step says where to read the real name. Screen tasks carry composition tables, behaviours, hooks and the code of their pure logic (`lib/teams/sessions.ts`, `lib/retro/phase-durations.ts`, `lib/poker/tracker-browse.ts`), following the screen procedure of plan 18e.

**Type consistency.** `TeamSession` (Task 2) = `TeamSession` of `lib/teams/sessions.ts` (Task 13) = the rows read in Task 14. `PokerGame::TaskTimerChoices` (Task 1) feeds `PokerGameSettingsRules` (Task 11) and the select values of Task 17 (60/180/300/600). `PhaseDurations::Standard` (Task 7) = `StandardDurations` (Task 16). `TrackerIssue::$type/$labels/$acceptanceCriteria` (Task 5) are written by `ImportPokerTasks` and `ApplyPokerTaskIssues` (Task 6) and by `storeIssues` (extracted in Task 12 from the Task 6 version: lane K merges before lane C). `PresentPokerTask.external.{type,labels,acceptanceCriteriaHtml}` (Task 6) = `PokerTask['external']` in `lib/poker/types.ts` (Task 13) read by Task 15. `pokerSources[].estimateFields/defaultEstimateFieldId` (Task 11) read by Task 17. `IssueTracker::writeEstimate` gains `?string $preferredFieldId = null` in Task 10 for all four trackers.

**Review Focus.** 1 → Task 2's walk test; 2 → Task 8's race; 3 → Task 8 ("still refuses a second reveal and a timer"); 4 → Task 12 ("creates nothing when the tracker fails"); 5 → Task 6 (guest payload).

**Known weak points.** Nothing was run. Plan 21 is not on disk: Task 7's max-per-card lines and its timer write follow plan 21's names, read at the start of lane C. Task 2's state test ages a whiteboard through the clock; if `Whiteboard::updated_at` does not move when elements are written (spec §16.5), the Live rule of whiteboards reads the board's own updates only and the report says so. The race of Task 8 asserts order through `Race`'s timings; the fallback assertion is written in the step.
