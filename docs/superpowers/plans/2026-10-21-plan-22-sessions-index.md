# Sessions index, advanced creation options and ticket details in the poker room (Plan 22) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to run this plan task by task (through the Workflow tool, as the project does). Steps use checkbox (`- [ ]`) syntax. Every agent reads **Owner decisions**, **Global Constraints**, **Pre-build deviations** and its own task before anything else, then `docs/database.md` ("Rules for database code" and "Running the tests on an engine") for any task that touches PHP. A screen task also follows the "Screen task procedure" of `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, with the working rules below (no walkthrough, captures in Task 20 only).

**Status: built (2026-10-03).** Every task ran in numeric order on the branch `plan-22-sessions-index` (the lanes flattened by the controller), PostgreSQL only. The differences found while building are folded into spec §18 and, for the screens, into the rows P22-16 to P22-20 below (ruled while building). The spec and this plan keep their names of 2026-10-21 (Task 21 asked to move them; plans 20, 21 and 27 kept theirs in place, and so does this one). Was: **approved for execution, 2026-10-03.** Revised the same day with the owner's answers to spec §15 (decisions 3 and 6 answered B, not the recommended A; the others as recommended), then with the owner's answers to the pre-build deviations (P22-01 to P22-15: all approved as listed, P22-14 obsolete; spec §17). Spec §16.2 (Discussing per topic) and §16.8 (English heading only) are ruled. Runs after plans 20, 21, 26, 27 and 29 are merged into `roadmap`, before plan 23 (see **Branch and run**). Verification per task and per merge is PostgreSQL only (owner, 2026-10-03); the four-engine matrix runs once at the end of the roadmap, not in this plan.

**Goal:** A team member opens the team's Sessions page (Upcoming, Live, Finished, every session kind, "Load more", "New session"); the "New session" dialog sets phase durations for a retro (offered to the facilitator, never started by themselves), and a task timer, "change vote after reveal", the estimate write-back and a tracker import for poker, all editable again inside the session; the poker story card shows the ticket's type and labels, and the description's "Acceptance criteria" section apart.

**Architecture:** No new aggregate. The Sessions page reads the five session tables through one action (`ListTeamSessions`) that computes a state per kind from stored data and merges five ordered queries in PHP behind a `(updated_at, id)` cursor. The "New session" dialog's props move out of `TeamsController@show` into `PresentNewSessionOptions`, used by the team page and the Sessions page. Creation options are columns on `retros` (one JSON column, `phase_durations`) and `poker_games` (four columns); behaviour sits where the rule already lives: the retro's durations travel in the board snapshot and the facilitator's `BoardTimer` offers the current phase's one (no back-end timer change: the offer calls the existing start endpoint), `StartPokerRound` starts a task timer, a new `PokerGuard::acceptsCard` opens a revealed round to card changes, `RequestEstimateSync` and `JiraIssueTracker::writeEstimate` read the per-game write-back. The creation import fetches tickets before the game exists, then writes them in the creation transaction through the code that imports inside a game. Ticket type and labels are two `external_*` columns of `poker_tasks`, filled by every tracker through `TrackerIssue`; acceptance criteria are not stored: `AcceptanceCriteriaSection` splits them out of the description when `PresentPokerTask` renders it.

**Tech Stack:** Laravel 13, PHP 8.4, Pest (feature, unit, arch, concurrency), Inertia 3, React 19, Tailwind 4, vite-plus (Vitest), Wayfinder, Reverb; code portable to PostgreSQL, MariaDB, MySQL and SQLite, tested on PostgreSQL through `bin/test-db pgsql`; `Tests\Concurrency\Support\Race`. Run `composer show --direct` and read `package.json` before Task 1 and stop if a major version differs from these.

**Spec:** `.superpowers/sdd/roadmap/plan-22/spec.md` (moves to `docs/superpowers/specs/2026-10-22-sessions-index-and-creation-options-design.md` in Task 21). Parent: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` §5. Mockups: `docs/design-system/components/ScreenSessionCreate`, `ScreenPokerBefore`, `SessionTypePicker`, `Pagination`, `EmptyState`, `MobileDashboard` — for each, the `README.md` and the `preview.html`.

**Not in this plan:** scheduling (SE-2: "Schedule…", a start time, "starts in 5 min"), which is backlog by the owner's word, with no place reserved; the "ROTI at the end" switch; the invitation link inside the dialog (D-08); the team dashboard's recent sessions table and next retro (TM-1, TM-2: plan 23, which calls `ListTeamSessions`); the rest of spec §3; browser walkthroughs (owner's working rule).

**Tasks:** 22 (unchanged by the answers: tasks 5, 6, 7, 15 and 16 were rewritten in place). Step A, single writer: 1. Lane S (Sessions page): 2, 3, 4, 14. Lane K (ticket details and criteria section): 5, 6, 15. Lane C (creation options): 7 to 12, 16, 17, 18. Step C foundation, single writer: 13. Final: 19 (translations), 20 (captures), 21 (deviations and documents), 22 (PostgreSQL suites and report). The pre-build deviation answers changed no task.

## Branch and run

- Execution order of the roadmap (owner, 2026-10-03): plans 20, 21, 26, 27 and 29 in parallel → **22** → 23 → 24 and 25. Plan 23 reuses `ListTeamSessions` (Task 2) and runs after this plan.
- Base: the integration branch `roadmap` once plans 20, 21, 26, 27 and 29 are merged into it. Lane C needs plan 21 (retro facilitation, RT-1 to RT-10): RT-3 (the per-card cap `max_votes_per_card`, which plan 21 also puts in the dialog: plan 22 adds nothing for it), the retro timer and its controls as RT-2 (pause) and RT-5 (time per topic) leave them (the phase timer offer sits on them), and plan 21's edits of `RetroSettingsController` and `retro-session-fields.tsx`. Before Task 1 check, and stop if one fails: `bin/test-db` exists and `bin/test-db pgsql -- tests/Arch` passes; `tests/Concurrency/Support/Race.php` exists; `app/Actions/Search/ListRecentSessions.php`, `app/Actions/Integrations/ImportPokerTasks.php` and `resources/js/components/teams/session-create/new-session-dialog.tsx` exist; plan 21 is merged into `roadmap` (`git log roadmap --oneline` shows its merge; if not, stop: plan 22 does not start before it); the last migration of `database/migrations` is dated before `2026_10_22_100000` (plans of the first wave may have used later dates: if any migration is dated `2026_10_22_100000` or later, date this plan's two migrations one day after the last one and say so in the report). Record the base commit in `.superpowers/sdd/roadmap/plan-22/progress.md`.
- Plans 20, 26, 27 and 29 may have edited files this plan touches (`routes/web.php`, `lang/*.json`, `hooks/use-sidebar-model.ts`, `mobile-tab-bar.tsx`, `board-topbar.tsx`, the poker room files): the re-read rule below covers them.
- Branch `plan-22-sessions` from that base; it is merged into `roadmap` at the end, with the PostgreSQL suite only. No merge into `main`, no push.
- Lanes run in git worktrees on branches `lane/22-<name>`, cut from the head named in **Lanes**; the controller merges one lane at a time and runs the gates after each merge: `npm run types:check`, `npm run check`, `npm run build:front`, `vendor/bin/pint --dirty --format agent`, `vendor/bin/sail composer types:check`, and `bin/test-db pgsql -- tests/Feature/Sessions tests/Feature/Poker tests/Feature/Retros tests/Feature/Integrations tests/Arch`.
- From a worktree, `bin/test-db` needs `TEST_DB_CONTAINER` and `TEST_DB_WORKDIR`. Only `pgsql` (and `pgsql --concurrency`) is run by this plan; MariaDB and MySQL are not started. Never two whole suites at once in the shared container.
- This plan was written from `main` at `18d3637e`, before plan 21 existed. **Every task re-reads the files it touches**; a line or a method body quoted here that no longer matches is followed in spirit and reported.

## Owner decisions

Spec §15, **answered by the owner on 2026-10-03**. The plan follows the answers; the last column says what the answer changed in this plan.

| # | Question | Owner's answer | Effect on the plan |
|---|---|---|---|
| 1 | "Upcoming" without scheduling | **A**: created and not started (= recommendation) | none: Task 2 as drafted |
| 2 | Whiteboards and rooms, which never end | **A**: board by 15-minute activity, room by round in play (= recommendation) | none: Task 2 as drafted |
| 3 | "Timer per phase" | **B**: offered to the facilitator, nothing starts by itself (≠ recommendation A) | Task 7 no longer touches `ChangeRetroPhase` or the timer: it stores, validates and sends the durations, and proves a phase change starts nothing. Task 16 adds the offer to `BoardTimer` (a `suggestion` on `Timer` / `SessionTimer`: one-click button and first menu entry). In Discussing the offer goes through plan 21's per-topic start (spec §6.2, §16.2). New deviation row P22-15. Task 20 adds the capture `retro-phase-timer-offer` |
| 4 | "Timer per task" at expiry | **A**: the round timer; reveals with auto reveal, otherwise rings (= recommendation) | none: Task 9 as drafted |
| 5 | "Write estimates" | **A**: per game, on/off and field (= recommendation) | none: Tasks 10, 11, 17 as drafted |
| 6 | Acceptance criteria source | **B**: a section of the description headed "Acceptance criteria" (≠ recommendation A) | No `external_acceptance_criteria` column (Task 1), no Jira text-field detection, no `ensureTextFields`, no integration setting or select (Tasks 5, 12, 15). Task 5 now carries type and labels for all three trackers; Task 6 adds `AcceptanceCriteriaSection` (spec rules AC-1 to AC-7) and splits the description at presentation, for every task. P22-11 reworded; P22-14 withdrawn |
| 7 | Trackers offered by the creation import | **A**: every connected tracker (= recommendation) | none: Tasks 12 and 18 as drafted |
| 8 | Dates on rows | **A**: last activity on Upcoming and Finished rows (= recommendation) | none: Task 14 as drafted |

Later answers and rulings of 2026-10-03:

| Topic | Answer or ruling | Effect on the plan |
|---|---|---|
| Pre-build deviations P22-01 to P22-15 | "03 + 05 approved, 11 Markdown, 12 + 13 editable in session, P22-14 obsolete (acceptance criteria from a description section), others approved" | none: every row is built as listed; P22-14 builds nothing. No "waits for the owner" gate is left |
| Spec §16.2, "Discussing 15" | ruled: **per topic** — P22-15, approved as listed, draws "… per topic" in Discussing, and plan 21's per-topic rule is the owner's | none: Task 16's `offerFor` (`perTopic` in Discussing) as drafted |
| Spec §16.8, translated criteria headings | ruled: **English only** — the owner's answers name "Acceptance criteria" twice; AC-7 accepts the language fragility | none: `AcceptanceCriteriaSection::Headings = ['acceptance criteria']` (Task 6) |
| Database engines | owner: "Lance les 4 bases seulement à la fin" — per task and per merge **PostgreSQL only**; the four-engine matrix runs once after the roadmap's last merge | every test step runs `bin/test-db pgsql`; Task 8's race runs on `pgsql --concurrency`; Task 22 runs the PostgreSQL suites only. Portability rules unchanged |
| Execution order | parallel 20, 21, 26, 27, 29 → 22 → 23 → 24 and 25 | plan 21 is merged before Task 1: no lane starts early; lane C is cut like S and K |

## File structure

Back end, created:

| File | Responsibility |
|---|---|
| `database/migrations/2026_10_22_100000_add_session_options_to_retros_and_poker_games.php` | `retros.phase_durations`; the four `poker_games` columns |
| `database/migrations/2026_10_22_100100_add_ticket_details_to_poker_tasks.php` | `external_type`, `external_labels` |
| `app/Enums/SessionState.php` | Upcoming, Live, Finished |
| `app/Support/Sessions/SessionCursor.php` | the `(updated_at, id)` cursor and its string form |
| `app/Actions/Sessions/ListTeamSessions.php` | the five queries, the merge, the rows |
| `app/Actions/Teams/PresentNewSessionOptions.php` | the props of the "New session" dialog |
| `app/Http/Controllers/TeamSessionsController.php` | the Sessions page |
| `app/Support/Retros/PhaseDurations.php` | the timed phases, the standard set, validation, normalisation |
| `app/Support/Poker/AcceptanceCriteriaSection.php` | splits a description into the text shown and its "Acceptance criteria" section (spec §6.5, rules AC-1 to AC-6) |
| `app/Actions/Poker/PokerGameSettingsRules.php` | validation of the four poker settings, shared by creation and settings |
| `app/Actions/Integrations/FetchPokerImport.php`, `PokerImportBatch.php` | the creation import: resolve, fetch, map tracker errors to validation |
| `app/Http/Controllers/Integrations/TeamPokerImportContainersController.php`, `TeamPokerImportIterationsController.php`, `TeamPokerImportPreviewsController.php` | team-scoped browse |

Back end, modified: `app/Models/Retro.php`, `PokerGame.php`, `PokerTask.php`; `app/Http/Controllers/TeamsController.php`, `TeamRetrosController.php`, `TeamPokerGamesController.php`, `Retros/RetroSettingsController.php`, `Poker/PokerSettingsController.php`; `app/Actions/Retros/NewRetro.php`, `CreateRetro.php`, `BuildBoardSnapshot.php` (`ChangeRetroPhase.php` is **not** modified: decision 3, B); `app/Actions/Poker/NewPokerGame.php`, `CreatePokerGame.php`, `PokerGuard.php`, `PlayPokerCard.php`, `StartPokerRound.php`, `BuildPokerSnapshot.php`, `PresentPokerTask.php`; `app/Actions/Integrations/ImportPokerTasks.php`, `ApplyPokerTaskIssues.php`, `RequestEstimateSync.php`, `PokerTaskSync.php`, `ListPokerSources.php`; `app/Support/Integrations/Trackers/TrackerIssue.php`, `JiraIssueTracker.php`, `LinearTracker.php`, `GitHubTracker.php`; `routes/web.php`. (No integration setting changes: decision 6, B.)

Tests, created: `tests/Feature/Sessions/TeamSessionsTest.php`, `ListTeamSessionsTest.php`, `NewSessionOptionsTest.php`; `tests/Unit/Support/SessionCursorTest.php`, `PhaseDurationsTest.php`, `TrackerIssueLabelsTest.php`, `AcceptanceCriteriaSectionTest.php`; `tests/Feature/Retros/PhaseTimersTest.php`; `tests/Feature/Poker/RevoteAfterRevealTest.php`, `TaskTimerTest.php`, `PokerGameOptionsTest.php`; `tests/Feature/Integrations/PokerEstimateWriteBackOptionTest.php`, `PokerCreationImportTest.php`, `TicketDetailsTest.php`; `tests/Concurrency/RevoteAfterRevealTest.php`; `tests/Browser/Visual/SessionsPagesVisualTest.php` (captures only).

Front end, created: `resources/js/pages/teams/sessions.tsx`; `resources/js/components/teams/sessions-page.tsx`, `team-new-session-dialog.tsx`; `resources/js/components/skrum/session-row.tsx`; `resources/js/lib/teams/sessions.ts`; `resources/js/lib/retro/phase-durations.ts`; `resources/js/components/teams/session-create/phase-timers-field.tsx`, `poker-import-field.tsx`; `resources/js/components/poker/tracker-issue-picker.tsx`, `ticket-details.tsx`; `resources/js/lib/poker/tracker-browse.ts`; each with its `.test.ts(x)`. Modified: `components/teams/team-page.tsx`, `session-create/retro-session-fields.tsx`, `poker-session-fields.tsx`, `poker-tasks-field.tsx`; `components/skrum/session-type-picker.tsx` (exports the kind tones), `app-sidebar.tsx` (nothing but tests), `mobile-tab-bar.tsx`; `hooks/use-sidebar-model.ts`; `components/retro/board-settings.tsx`, `board-topbar.tsx` (`BoardTimer`: the phase timer offer); `components/skrum/timer.tsx` and `components/session/session-timer.tsx` (the optional `suggestion`); `components/poker/room-topbar.tsx` (settings popover), `room-dock.tsx`, `story-card.tsx`, `import-tasks-dialog.tsx`; `lib/poker/types.ts`, `lib/retro/types.ts`, `types/*.ts`.

## Global Constraints

- **Mockup first** (parent spec §5 rule 13). A screen follows its mockup; a difference is fixed or is a row of **Pre-build deviations**, put to the owner before its screen is built. Captures are taken once, in Task 20, in light, at 1440, in French.
- **Front rules** of the parent spec §5: tokens only, rem, Tailwind scale, no overflow from 20rem to 60rem, visible focus, contrast, reduced motion, lucide icons, literal `t('…')`, presentational `skrum/` components (no network, no router). Reuse: `teams/session-create/*` (`SettingRow`, `FieldError`, `SessionFormFooter`), `skrum/empty-state`, `skrum/skeletons` ("Loading sessions"), `ui/pagination` (`LoadMore`, `LoadMoreFeed`), `ui/tabs`, `ui/select`, `ui/switch`, `skrum/session-type-picker` (kind colours and icons).
- **Database (owner rule): Eloquent and the standard query builder only.** `docs/database.md` rules 1 to 12 on every line of PHP, migration and test; `tests/Arch/DatabasePortabilityTest.php` enforces them. No raw query of any form; no driver test; migrations with the Schema builder, `up` only, nullable `timestamp()`, no `enum()`, no collation, no JSON default (defaults in the model's `$attributes`), names within 64 characters; a transaction locks the aggregate root first (poker: the game; retro: the retro) and is retried with `Transactions::Attempts` only when it touches nothing but the database (the ones here broadcast or call a tracker: no retry); an explicit tie-breaker on every sort; JSON columns compared with `toBeIgnoringKeyOrder`; writes never skip model events.
- **Tests per task, on PostgreSQL only** (owner, 2026-10-03: the four-engine matrix runs once, after the roadmap's last merge, outside this plan). Each task runs the tests it wrote or touched with `bin/test-db pgsql -- <paths>`. The red step ("see it fail") may run once in memory: `vendor/bin/sail artisan test --compact <path>`. The race of Task 8 runs with `bin/test-db pgsql --concurrency -- tests/Concurrency/RevoteAfterRevealTest.php`, never in memory, never in parallel. The whole PostgreSQL suite runs at each lane merge (`bin/test-db pgsql`) and in Task 22. No task runs `sqlite`, `sqlite-file`, `mariadb` or `mysql`; the code is still written for all four (rules above, `DatabasePortabilityTest`).
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

**Status: answered by the owner on 2026-10-03** — "03 + 05 approved, 11 Markdown, 12 + 13 editable in session, P22-14 obsolete (acceptance criteria from a description section), others approved". Rows marked "O:" are approved by the owner's decisions they follow from. Every row is built as listed; no screen task waits. Reasons as in plan 18e: **F** false or unsafe, **A** accessibility, **N** no such data or concept, **S** this spec, **O** an owner's answer.

| # | Screen | Mockup element | Built | Reason | Owner (2026-10-03) |
|---|---|---|---|---|---|
| P22-01 | Sessions page | rows without a date | the last activity date ends the meta line on Upcoming and Finished rows | O: decision 8, answered A | approved |
| P22-02 | Sessions page | the Upcoming tab | sessions created and not started (spec §6.1) | N: no scheduling (backlog); O: decision 1, answered A | approved |
| P22-03 | Sessions page | — (Live tab only drawn) | empty states per tab, "Load more" and its end line from the `Pagination` mockup | N: no frame for them | approved |
| P22-04 | Dialog, retro | "ROTI at the end" switch | not rendered | O: backlog (ROTI is always a phase) | approved |
| P22-05 | Dialog, retro | "Timer per phase" select showing "Custom (5 phases)" | options "No timer", "Standard", "Custom (5 phases)"; Custom opens five minute steppers under the row | N: the mockup draws the closed select only | approved |
| P22-06 | Dialog, poker | "Timer per task: 2 minutes" | the choices Off, 1, 3, 5, 10 minutes | O: X5 (one list 1/3/5/10) | approved |
| P22-07 | Dialog, poker | "Schedule…" in the footer | not rendered, no place | O: scheduling is backlog | approved |
| P22-08 | Dialog, poker | "Import from Jira" | "Import from <source>", with a source select when the team has two trackers or more | O: decision 7, answered A | approved |
| P22-09 | Dialog, poker | "Write estimates to Jira · Story points" | for Linear and GitHub the row reads "Write estimates to <source>" with "Write" / "Don't write" | N: no field choice on those sources | approved |
| P22-10 | Dialog, retro and poker | the invitation link "skrum.atlas.dev/j/R7K-42Q · Copy link" | unchanged (still not rendered: D-08) | N: the link exists only once the session does | approved |
| P22-11 | Poker room | acceptance criteria as a plain list | the description's "Acceptance criteria" section rendered as Markdown (a list when the writer wrote one), under the heading "Acceptance criteria" of the app; nothing when the description has no such section | N: the source's own format; O: decision 6, B (a section of the description) | approved: Markdown |
| P22-12 | Poker room | settings popover (D-70) | three more rows: Timer per task, Change vote after reveal, Write estimates | S: spec §9.4 ("les réglages restent modifiables dans la session") | approved: editable in session |
| P22-13 | Retro | settings popover | one more row: Timer per phase | S: spec §9.4 | approved: editable in session |
| P22-14 | — | — | **withdrawn**: no "Acceptance criteria field" select (decision 6 answered B: no setting). The number is kept so that the other rows keep theirs | — | obsolete (acceptance criteria from a description section) |
| P22-15 | Retro board | the topbar `Timer` with its menu 1, 3, 5, 10 (`Timer`, `FacilitatorBar`) | facilitator only, in a phase with a duration: a one-click "<n> min" start button while no timer runs or is paused, and the first menu entry "<Phase> · <n> min" ("… per topic" in Discussing) before the list | O: decision 3, B (offered, nothing starts by itself); no mockup draws the offer | approved (settles spec §16.2: per topic) |
| P22-16 | Sessions page, topbar | a page search "Search sessions" of 16rem | the application's search of the topbar ("Search…", ⌘K), as on every page | S: spec §3 (no filter or search on the Sessions page); parent spec, the topbar of plan 18 | ruled while building (Task 21) |
| P22-17 | Sessions page, rows | the retro row's `sticky-note` icon (the dialog's retro tile draws `layers`) | the kind tile of `SessionTypePicker` on every row, so the retro row shows `layers` like the dialog | S: spec §9.1 (the kind's colour and icon of `SessionTypePicker`); the mockup draws two icons for one kind | ruled while building (Task 21) |
| P22-18 | Sessions page and story card, French | "… et icebreakers d'Atlas"; "Whiteboard"; "Animé par Inès"; "3 / 6 de la séance" | "… et icebreakers de l'équipe Atlas" (the elision of "de" depends on the team's name; "de l'équipe :team" is right for every name); "Tableau blanc", ":position / :total de la partie" and the facilitator's full name are the values the application already has | Global Constraints: a key that exists keeps its value; the meta line shows the stored name | ruled while building (Task 21) |
| P22-19 | Dialog, poker | the import tab: "Importer de Jira", one JQL field, the list | "Importer depuis Jira" (the key's existing value); the browse form of the in-game import before the list: "Sprint" / "Query", the query in mono, "Show issues"; "n of m selected · Select all" under the list, which scrolls inside the dialog body at 1440 | S: spec §9.3 (the browse form and the states of the in-game dialog); the existing key keeps its value | ruled while building (Task 21) |
| P22-20 | Dialog, retro | help of "Timer per phase": "Écriture 7 · Vote 3 · Discussion 15" | every phase with a duration ("Écriture 7 · Regroupement 5 · Vote 3 · Discussion 15 · Actions 5"), then "Offered to the facilitator, never started by itself" from 40rem up | S: spec §9.2 (the help lists the phases that have a duration and says what the durations do); O: decision 3, B | ruled while building (Task 21) |

## Review Focus

1. **A session that sits on a page boundary** ("Load more" twice while sessions of five kinds share timestamps): no duplicate, no gap. Walk test in Task 2, on PostgreSQL (in the task and in Task 22); the other engines run it in the roadmap's final matrix.
2. **A card changed after reveal while the facilitator saves the estimate**: either applied before the save or refused after it, never after. Race in Task 8, on PostgreSQL.
3. **The reveal and the timer endpoints after `acceptsCard`**: a revealed round must still refuse a second reveal and a timer. Test in Task 8.
4. **An import at creation whose tracker fails** (expired token, a 500): no game is left behind, the message is on the import tab. Test in Task 12.
5. **A guest reading a poker payload**: type, labels and the criteria section yes, assignee and sync errors no. Test in Task 6.
6. **The criteria split** (spec rules AC-1 to AC-7): the stored description is never changed; a heading in a code block, a second heading and another wording split nothing more than the rules say; old cached HTML is not served. Unit test and feature test in Task 6.
7. **A phase change starts no timer** (decision 3, B): no `TimerChanged`, a running timer runs on, a paused one stays paused. Test in Task 7.

## Lanes

| Lane | Tasks | Cut from | Shares with other lanes |
|---|---|---|---|
| main | 1, 13, 19 to 22 | — | — |
| S (Sessions page) | 2, 3, 4, then 14 | head of Task 1 (14 after Task 13 is merged into it) | `routes/web.php` (one block), `app/Http/Controllers/TeamsController.php` (Task 3 only), `lang/*.json` |
| K (ticket details) | 5, 6, then 15 | head of Task 1 (15 after Task 13) | `app/Actions/Integrations/ImportPokerTasks.php` and `ApplyPokerTaskIssues.php` (also lane C, Task 12: K merges first), `app/Actions/Poker/PresentPokerTask.php`, `lang/*.json` |
| C (creation options) | 7 to 12, then 16, 17, 18 | head of Task 1 (plan 21 is in the base) with lanes S and K merged (Task 12 needs K's `ImportPokerTasks`, Task 11's props go through S's `PresentNewSessionOptions`) | `routes/web.php`, `PokerSettingsController`, `RetroSettingsController`, `retro-session-fields.tsx`, `poker-session-fields.tsx`, `board-topbar.tsx`, `skrum/timer.tsx`, `session/session-timer.tsx`, `lang/*.json` |

Task 13 (front foundation: `TeamNewSessionDialog`, kind tones, shared types) runs on main after lanes S and K's back-end tasks are merged and before any screen task. `lang/*.json` conflicts are resolved by the controller at each merge (keys appended in alphabetical blocks per lane). `tests/Pest.php`: lane C adds its helpers, if any, in one block at the end of the file (lane K needs none since decision 6 was answered B).

---

## Step A — schema (single writer)

### Task 1: Columns, casts and defaults

**Files:**
- Create: `database/migrations/2026_10_22_100000_add_session_options_to_retros_and_poker_games.php`, `database/migrations/2026_10_22_100100_add_ticket_details_to_poker_tasks.php`, `app/Enums/SessionState.php`
- Modify: `app/Models/Retro.php`, `app/Models/PokerGame.php`, `app/Models/PokerTask.php`
- Test: `tests/Feature/Poker/PokerGameOptionsTest.php`

Read first: `docs/database.md` rule 5 and rule 10; `app/Models/PokerGame.php` (`#[Fillable]`, `casts()`); `app/Models/Retro.php` (`#[Fillable]`, `casts()`); `app/Models/PokerTask.php` (the `external_*` columns are not fillable: written with `forceFill` by the trackers only).

**Interfaces:**
- Produces: `retros.phase_durations` (JSON, nullable; cast `array`; fillable); `poker_games.revote_after_reveal` (bool, default false), `task_timer_seconds` (unsigned small int, nullable), `writes_estimates` (bool, default true), `estimate_field_id` (string 100, nullable), all fillable and cast; `PokerGame::TaskTimerChoices = [60, 180, 300, 600]`; `poker_tasks.external_type` (string 60, nullable), `external_labels` (JSON, nullable, cast `array`), not fillable (no criteria column: decision 6, B); `App\Enums\SessionState` (`Upcoming = 'upcoming'`, `Live = 'live'`, `Finished = 'finished'`).

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

    $task->fill(['external_type' => 'Story', 'external_labels' => ['ui']])->save();

    expect($task->fresh()->only(['external_type', 'external_labels']))
        ->toBe(['external_type' => null, 'external_labels' => null]);

    $task->forceFill(['external_type' => 'Story', 'external_labels' => ['ui', 'api']])->save();

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

`app/Models/PokerTask.php`: `@property` lines for the two columns (not fillable); in `casts()` `'external_labels' => 'array'`. Extend the class docblock sentence: "The external_*, needs_sync, sync_error and synced_at columns — ticket details included — are written only by the tracker imports, refreshes and write-back".

- [ ] **Step 4: Run the tests on PostgreSQL**

Run: `bin/test-db pgsql -- tests/Feature/Poker/PokerGameOptionsTest.php tests/Feature/Poker/PokerModelTest.php tests/Arch`.
Expected: PASS. (The JSON column and the defaults are engine-sensitive: they are written to the rules — no JSON default, defaults in `$attributes` — and checked on MariaDB, MySQL and SQLite by the roadmap's final matrix, not here.)

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_10_22_1000*.php app/Enums/SessionState.php app/Models/Retro.php app/Models/PokerGame.php app/Models/PokerTask.php tests/Feature/Poker/PokerGameOptionsTest.php
git commit -m "feat(sessions): columns for phase durations, poker options and ticket details

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

- [ ] **Step 5: Run the tests on PostgreSQL**

Run: `bin/test-db pgsql -- tests/Unit/Support/SessionCursorTest.php tests/Feature/Sessions/ListTeamSessionsTest.php tests/Arch`.
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

- [ ] **Step 4: Run the tests on PostgreSQL** — `bin/test-db pgsql -- tests/Feature/Sessions/NewSessionOptionsTest.php tests/Feature/Teams tests/Feature/Poker/TeamPokerSectionTest.php tests/Feature/TeamSurveys tests/Feature/Whiteboards`. Expected: PASS (the team page's existing tests unchanged).

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

- [ ] **Step 4: Run the tests on PostgreSQL** — `bin/test-db pgsql -- tests/Feature/Sessions tests/Arch`; `npm run types:check`, `npm run build:front`. Expected: PASS.

- [ ] **Step 5: Commit** — `feat(sessions): the team Sessions page and its route` (trailers).

---

## Lane K — ticket details and the criteria section (back end)

Decision 6 was answered **B**: acceptance criteria are a section of the description, split at presentation. Nothing in this lane detects a Jira field, adds an integration setting or stores the criteria. Spec §6.5 rules AC-1 to AC-7 are binding: do not widen the headings, add a tracker field or a setting "to make it work better" — the owner accepted the fragility (AC-7).

### Task 5: `TrackerIssue` carries type and labels; Jira, Linear and GitHub read them; the import writes them

**Files:**
- Modify: `app/Support/Integrations/Trackers/TrackerIssue.php`, `JiraIssueTracker.php`, `LinearTracker.php`, `GitHubTracker.php`; `app/Actions/Integrations/ImportPokerTasks.php`
- Test: `tests/Unit/Support/TrackerIssueLabelsTest.php`, `tests/Feature/Integrations/TicketDetailsTest.php`

Read first: `TrackerIssue` whole; `JiraIssueTracker::issue()`, `BaseFields`, `requestedFields()`; `LinearTracker::IssueFields` and its mapping (around the `new TrackerIssue(` call); `GitHubTracker::IssueFields` (GraphQL fragment) and the REST mapping used by `iterationIssues` (`list()`); `ImportPokerTasks::store()`; `tests/Feature/Integrations/PokerImportBrowsingTest.php` (how GitHub is faked).

**Interfaces:**
- Produces: `TrackerIssue` constructor gains, after `issueStatus`, `public ?string $type = null` and `public array $labels = []` (list<string>); constants `TypeLength = 60`, `LabelLength = 60`, `MaxLabels = 10`; static `TrackerIssue::labels(mixed $value): list<string>` (strings only, trimmed, non-empty, unique in order, cut to 60, at most 10). `ImportPokerTasks::store()` writes `external_type` and `external_labels`. Task 6 adds the refresh writer and the presenter; Task 12 extracts `storeIssues()` from this version.

- [ ] **Step 1: Write the failing tests**

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
```

Note: `['name' => 'ui']` is a map, not a list: `labels()` reads `array_is_list($value)` first and returns `[]` otherwise.

`tests/Feature/Integrations/TicketDetailsTest.php`:

```php
<?php

use App\Enums\IntegrationProvider;
use App\Models\PokerTask;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('imports the type and labels of a Jira issue', function () {
    $table = trackerTable();
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1', [
        'issuetype' => ['name' => 'Story'],
        'labels' => ['actions', 'csv'],
    ])]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.store', [$table['game'], 'jira']), ['external_ids' => ['10001']])
        ->assertCreated();

    $task = PokerTask::query()->where('external_id', '10001')->sole();

    expect($task->external_type)->toBe('Story')
        ->and($task->external_labels)->toBe(['actions', 'csv']);

    Http::assertSent(fn (Request $request) => str_contains($request->url(), 'search/jql')
        && in_array('issuetype', (array) $request['fields'], true)
        && in_array('labels', (array) $request['fields'], true));
});

it('stores no labels as null, not as an empty list', function () {
    $table = trackerTable();
    fakeJiraTrackerApi([jiraTrackerIssue('10001', 'PROJ-1', ['labels' => []])]);

    $this->actingAs($table['member'])
        ->postJson(route('poker.imports.store', [$table['game'], 'jira']), ['external_ids' => ['10001']])
        ->assertCreated();

    expect(PokerTask::query()->where('external_id', '10001')->sole()->external_labels)->toBeNull();
});

it('imports the labels of a Linear issue and no type', function () {
    $table = trackerTable(IntegrationProvider::Linear);
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
```

`fakeLinearGraphql` matches the first key found in the query text: the Linear tracker's issue query contains `issues(`. Add the GitHub case the same way with `gitHubIssue(7, ['labels' => [['name' => 'bug']], 'type' => ['name' => 'Bug']])` through the fake used by `PokerImportBrowsingTest.php`, and expect `['bug']` and `'Bug'`.

- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.

- [ ] **Step 3: Implement**

`TrackerIssue`: the two new constructor parameters with their defaults (every existing `new TrackerIssue(...)` call uses named arguments and keeps compiling), the constants, and:

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
```

- `JiraIssueTracker`: `BaseFields` gains `'issuetype'` and `'labels'`; `issue()` passes `type: TrackerIssue::shorten(data_get($fields, 'issuetype.name'), TrackerIssue::TypeLength)` and `labels: TrackerIssue::labels($fields['labels'] ?? null)`.
- `LinearTracker::IssueFields` gains `labels(first: 10) { nodes { name } }`; its mapping passes `labels: TrackerIssue::labels(array_column((array) data_get($node, 'labels.nodes', []), 'name'))`.
- `GitHubTracker::IssueFields` gains `labels(first: 10) { nodes { name } } issueType { name }`; the GraphQL mapping passes `labels: TrackerIssue::labels(array_column((array) data_get($raw, 'labels.nodes', []), 'name'))` and `type: TrackerIssue::shorten(data_get($raw, 'issueType.name'), TrackerIssue::TypeLength)`; the REST mapping passes `labels: TrackerIssue::labels(array_column((array) ($raw['labels'] ?? []), 'name'))` and `type: TrackerIssue::shorten(data_get($raw, 'type.name'), TrackerIssue::TypeLength)`. If GitHub's GraphQL refuses `issueType` on the supported API version (a 200 with `errors`), drop it from the fragment and say so in the report (spec §16.3).
- `ImportPokerTasks::store()`: the `forceFill` gains `'external_type' => $issue->type` and `'external_labels' => $issue->labels === [] ? null : $issue->labels`.

- [ ] **Step 4: Run the tests on PostgreSQL** — `bin/test-db pgsql -- tests/Unit/Support/TrackerIssueLabelsTest.php tests/Feature/Integrations tests/Arch`. Expected: PASS (all existing integration tests included).

- [ ] **Step 5: Commit** — `feat(integrations): ticket type and labels from Jira, Linear and GitHub` (trailers).

### Task 6: The criteria section; the refresh writer and the presenter

**Files:**
- Create: `app/Support/Poker/AcceptanceCriteriaSection.php`
- Modify: `app/Actions/Integrations/ApplyPokerTaskIssues.php`; `app/Actions/Poker/PresentPokerTask.php`
- Test: `tests/Unit/Support/AcceptanceCriteriaSectionTest.php`, `tests/Feature/Integrations/TicketDetailsTest.php` (more cases), `tests/Feature/Poker/PokerRedactionTest.php` (one case added)

Read first: spec §6.5 (rules AC-1 to AC-7) — the rules, not this plan's code, are the reference; `ApplyPokerTaskIssues::fields()`; `PresentPokerTask` whole (`descriptionHtml()`, its cache key, `external()`); `RenderTaskMarkdown::handle()`; `App\Support\Alphabetical::key()`; `AdfToMarkdown::block()` (headings as `#` lines, `strong` as `**…**`) and `WikiMarkupToMarkdown` (`h1.`–`h6.` as `#` lines, `*bold*` as `**bold**`) to see what reaches the description.

**Interfaces:**
- Consumes: Task 5.
- Produces: `AcceptanceCriteriaSection::Headings = ['acceptance criteria']`; `AcceptanceCriteriaSection::split(?string $markdown): array{description: ?string, criteria: ?string}` — when nothing is split, `description` is the input unchanged (null for null or blank) and `criteria` null. `PresentPokerTask`'s task gains `acceptanceCriteriaHtml: string` (empty when none) beside `descriptionHtml`, which now renders the description without the section; `description` (raw) is unchanged. The `external` block gains, for every viewer, `type: ?string` and `labels: list<string>`.

- [ ] **Step 1: Write the failing tests**

`tests/Unit/Support/AcceptanceCriteriaSectionTest.php`:

```php
<?php

use App\Support\Poker\AcceptanceCriteriaSection;

it('splits a section under an ATX heading, up to the next heading of the same level', function () {
    $split = AcceptanceCriteriaSection::split("Export invoices.\n\n## Acceptance criteria\n\n- UTF-8\n- semicolon\n\n### Edge case\n\n- empty file\n\n## Notes\n\nSee ATLAS-12.");

    expect($split['criteria'])->toBe("- UTF-8\n- semicolon\n\n### Edge case\n\n- empty file")
        ->and($split['description'])->toBe("Export invoices.\n\n## Notes\n\nSee ATLAS-12.");
});

it('reads every heading markup of rule AC-1, in any case', function (string $heading) {
    $split = AcceptanceCriteriaSection::split("Intro\n{$heading}\n- one");

    expect($split['criteria'])->toBe('- one')
        ->and($split['description'])->toBe('Intro');
})->with([
    'atx' => ['# ACCEPTANCE CRITERIA'],
    'atx closed' => ['### Acceptance criteria ###'],
    'atx colon' => ['## Acceptance Criteria:'],
    'bold' => ['**Acceptance criteria**'],
    'bold colon inside' => ['**Acceptance criteria:**'],
    'bold colon outside' => ['__Acceptance criteria__:'],
    'plain colon' => ['acceptance criteria:'],
]);

it('ends a bold or colon section at the next heading or bold line', function () {
    $split = AcceptanceCriteriaSection::split("**Acceptance criteria**\n- one\n**Out of scope**\n- two");

    expect($split['criteria'])->toBe('- one')
        ->and($split['description'])->toBe("**Out of scope**\n- two");
});

it('splits nothing outside the rules', function (string $markdown) {
    expect(AcceptanceCriteriaSection::split($markdown))->toBe(['description' => $markdown, 'criteria' => null]);
})->with([
    'in a code block' => ["```\n## Acceptance criteria\n- one\n```"],
    'empty section' => ["Intro\n## Acceptance criteria\n\n## Notes\nx"],
    'other wording' => ["## Definition of done\n- one"],
    'translated' => ["## Critères d'acceptation\n- un"],
    'setext' => ["Acceptance criteria\n---\n- one"],
    'inside a sentence' => ['The acceptance criteria: see below.'],
    'list item' => ["- Acceptance criteria:\n- one"],
]);

it('keeps a second heading in the body of the first', function () {
    expect(AcceptanceCriteriaSection::split("## Acceptance criteria\n- one\n\n## Acceptance criteria\n- two")['criteria'])
        ->toBe("- one\n\n## Acceptance criteria\n- two");
});

it('gives no description when the section is all there is', function () {
    expect(AcceptanceCriteriaSection::split("## Acceptance criteria\n- one"))->toBe(['description' => null, 'criteria' => '- one'])
        ->and(AcceptanceCriteriaSection::split(null))->toBe(['description' => null, 'criteria' => null])
        ->and(AcceptanceCriteriaSection::split("  \n"))->toBe(['description' => null, 'criteria' => null]);
});
```

The "keeps a second heading" case is rule AC-2: a repeated criteria heading is never an end, even at the first heading's level (AC-4 says so in its first clause). `endsSection()` checks that first.

Append to `tests/Feature/Integrations/TicketDetailsTest.php`:

```php
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

it('shows ticket details and the criteria section to a guest, and the assignee to the team only', function () {
    $table = trackerTable();
    $task = importedPokerTask($table['game'], [
        'external_type' => 'Story',
        'external_labels' => ['csv'],
        'external_assignee' => 'Jane Doe',
        'description' => "Export invoices.\n\n## Acceptance criteria\n\n- UTF-8\n- semicolon",
    ]);
    $guest = pokerGuest($table['game']);

    $payload = $this->withCookies(pokerGuestCookie($guest))
        ->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk()
        ->json('tasks.0');

    expect($payload['external']['type'])->toBe('Story')
        ->and($payload['external']['labels'])->toBe(['csv'])
        ->and($payload['external'])->not->toHaveKey('assignee')
        ->and($payload['acceptanceCriteriaHtml'])->toContain('<li>UTF-8</li>')
        ->and($payload['descriptionHtml'])->toContain('Export invoices.')
        ->and($payload['descriptionHtml'])->not->toContain('UTF-8')
        ->and($payload['description'])->toBe($task->description);
});

it('splits the criteria of a task typed by hand and leaves its stored description whole', function () {
    $table = trackerTable();
    $task = App\Models\PokerTask::factory()->create([
        'poker_game_id' => $table['game']->id,
        'description' => "**Acceptance criteria:**\n- one",
    ]);

    $this->actingAs($table['member'])
        ->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk()
        ->assertJsonPath('tasks.0.descriptionHtml', '')
        ->assertJsonPath('tasks.0.external', null);

    expect($task->fresh()->description)->toBe("**Acceptance criteria:**\n- one");
});

it('never serves the html cached for the whole description', function () {
    $table = trackerTable();
    $description = "Intro\n\n## Acceptance criteria\n\n- one";
    $task = App\Models\PokerTask::factory()->create(['poker_game_id' => $table['game']->id, 'description' => $description]);
    Illuminate\Support\Facades\Cache::forever('poker-task-description:'.$task->id.':'.hash('xxh128', $description), '<p>stale</p>');

    $this->actingAs($table['member'])
        ->getJson(route('poker.snapshot.show', $table['game']))
        ->assertOk()
        ->assertJsonPath('tasks.0.descriptionHtml', fn (string $html) => ! str_contains($html, 'stale') && str_contains($html, 'Intro'));
});
```

The snapshot route name, its JSON path to the tasks, the guest cookie helper and the factory's default `description` are those of `tests/Feature/Poker/PokerSnapshotTest.php` and `PokerTaskFactory`; adapt the names, not the meaning. In `PokerRedactionTest.php` add one case: a guest's task payload has `external.type`, `external.labels` and `acceptanceCriteriaHtml`, and no `external.assignee`.

- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.

- [ ] **Step 3: Implement**

`app/Support/Poker/AcceptanceCriteriaSection.php`:

```php
<?php

namespace App\Support\Poker;

use App\Support\Alphabetical;

/**
 * Spec plan 22 §6.5, rules AC-1 to AC-7 (owner, decision 6, B): the
 * criteria are the description's section under an "Acceptance criteria"
 * heading. The owner accepted that another wording or heading style splits
 * nothing (AC-7): do not widen these rules without the owner.
 */
class AcceptanceCriteriaSection
{
    /** Folded heading texts. English only: spec §16.8, ruled from the owner's answers of 2026-10-03. */
    public const array Headings = ['acceptance criteria'];

    private const string AtxHeading = '/^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/u';

    private const string BoldLine = '/^[ \t]*(\*\*|__)(.+?)\1:?[ \t]*$/u';

    private const string ColonLine = '/^[ \t]*(\p{L}[\p{L} \t\'’-]*):[ \t]*$/u';

    private const string Fence = '/^ {0,3}(```|~~~)/u';

    /**
     * @return array{description: ?string, criteria: ?string}
     */
    public static function split(?string $markdown): array
    {
        $unchanged = ['description' => trim((string) $markdown) === '' ? null : $markdown, 'criteria' => null];
        $lines = preg_split('/\R/u', (string) $markdown) ?: [];
        $start = null;
        $level = 0;
        $end = count($lines);
        $inFence = false;

        foreach ($lines as $index => $line) {
            if (preg_match(self::Fence, $line) === 1) {
                $inFence = ! $inFence;

                continue;
            }

            if ($inFence) {
                continue;
            }

            if ($start === null) {
                $headingLevel = self::criteriaHeadingLevel($line);

                if ($headingLevel !== null) {
                    $start = $index;
                    $level = $headingLevel;
                }

                continue;
            }

            if (self::endsSection($line, $level)) {
                $end = $index;

                break;
            }
        }

        if ($start === null) {
            return $unchanged;
        }

        $criteria = self::text(array_slice($lines, $start + 1, $end - $start - 1));

        if ($criteria === null) {
            return $unchanged;
        }

        $parts = array_filter(
            [self::text(array_slice($lines, 0, $start)), self::text(array_slice($lines, $end))],
            fn (?string $part): bool => $part !== null,
        );

        return ['description' => $parts === [] ? null : implode("\n\n", $parts), 'criteria' => $criteria];
    }

    /**
     * 1 to 6 for an ATX heading, 0 for a bold or a colon line, null when the
     * line is not the criteria heading.
     */
    private static function criteriaHeadingLevel(string $line): ?int
    {
        if (preg_match(self::AtxHeading, $line, $match) === 1) {
            return self::isCriteria($match[2]) ? strlen($match[1]) : null;
        }

        if (preg_match(self::BoldLine, $line, $match) === 1) {
            return self::isCriteria($match[2]) ? 0 : null;
        }

        if (preg_match(self::ColonLine, $line, $match) === 1) {
            return self::isCriteria($match[1]) ? 0 : null;
        }

        return null;
    }

    private static function endsSection(string $line, int $level): bool
    {
        if (self::criteriaHeadingLevel($line) !== null) {
            return false;
        }

        if (preg_match(self::AtxHeading, $line, $match) === 1) {
            return $level === 0 || strlen($match[1]) <= $level;
        }

        return $level === 0 && preg_match(self::BoldLine, $line) === 1;
    }

    private static function isCriteria(string $text): bool
    {
        $words = preg_replace('/\s+/u', ' ', trim(rtrim(trim($text), ':')));

        return in_array(Alphabetical::key((string) $words), self::Headings, true);
    }

    /**
     * @param  list<string>  $lines
     */
    private static function text(array $lines): ?string
    {
        $text = trim(implode("\n", $lines));

        return $text === '' ? null : $text;
    }
}
```

`ColonLine` starts with a letter, so a list item (`- …`, `1. …`), a quote (`> …`) or a table row never matches; a sentence with words after the colon never matches either (the colon must end the line).

- `ApplyPokerTaskIssues::fields()`: `'external_type' => $issue->type`, `'external_labels' => $issue->labels === [] ? null : $issue->labels`.
- `PresentPokerTask`: split once per task — `$parts = AcceptanceCriteriaSection::split($task->description);` — then `'descriptionHtml' => $this->html('poker-task-description', $task, $parts['description'])` and `'acceptanceCriteriaHtml' => $this->html('poker-task-criteria', $task, $parts['criteria'])`, with `descriptionHtml()` generalised:

```php
    private function html(string $prefix, PokerTask $task, ?string $markdown): string
    {
        if ($markdown === null || $markdown === '') {
            return '';
        }

        $key = "{$prefix}:{$task->id}:".hash('xxh128', $markdown);

        return Cache::rememberForever($key, fn (): string => $this->renderTaskMarkdown->handle($markdown));
    }
```

  The key hashes the text rendered (AC-6): a description without a section keeps the key and the HTML it has today; a split one gets a new key. A private `details(PokerTask $task): array` returns `type` and `labels` (`external_labels ?? []`), spread into **both** branches of `external()` (with and without a `PokerTaskSync`). Add `acceptanceCriteriaHtml: string` to the `Task` phpstan type and `type: ?string, labels: list<string>` to `TaskExternal`.

- [ ] **Step 4: Run the tests on PostgreSQL** — `bin/test-db pgsql -- tests/Unit/Support/AcceptanceCriteriaSectionTest.php tests/Feature/Integrations tests/Feature/Poker tests/Arch`. Expected: PASS.

- [ ] **Step 5: Commit** — `feat(poker): acceptance criteria from the description, ticket details for every viewer` (trailers).

---

## Lane C — creation options (back end; after plan 21)

Before Task 7, read plan 21's changes to `app/Models/Retro.php`, `RetroSettingsController`, `RetroTimersController`, `TeamRetrosController`, `retro-session-fields.tsx`, `board-topbar.tsx` (`BoardTimer`) and its facilitator bar, and note in `progress.md`: that `max_votes_per_card` is sent from the dialog and accepted by `teams.retros.store` (plan 21's spec §6.3 and §9.7 say so — **if it is not, stop and report**: plan 22 does not add it), how a timer start in Discussing sets the time per topic (`topic_seconds`), and how a paused timer is shown and restarted. Task 16's offer calls whatever plan 21 leaves as the start of the timer.

### Task 7: Retro — phase durations at creation, in the settings and in the snapshot; a phase change starts nothing

Decision 3 was answered **B**: the durations are offered to the facilitator; nothing starts by itself. This task writes no timer and does not modify `ChangeRetroPhase`.

**Files:**
- Create: `app/Support/Retros/PhaseDurations.php`
- Modify: `app/Actions/Retros/NewRetro.php`, `CreateRetro.php`, `BuildBoardSnapshot.php`; `app/Http/Controllers/TeamRetrosController.php`, `Retros/RetroSettingsController.php`
- Test: `tests/Unit/Support/PhaseDurationsTest.php`, `tests/Feature/Retros/PhaseTimersTest.php`

**Interfaces:**
- Produces: `PhaseDurations::TimedPhases` (list of the five `RetroPhase` values: `writing`, `grouping`, `voting`, `discussing`, `actions`); `PhaseDurations::Standard = ['writing' => 7, 'grouping' => 5, 'voting' => 3, 'discussing' => 15, 'actions' => 5]`; `PhaseDurations::rules(string $attribute): array<string, array<int, mixed>>` (for `phase_durations` and `phase_durations.*`); `PhaseDurations::normalise(?array $durations): ?array` (keeps the timed phases with 1–60, null when none). `NewRetro` gains `?array $phaseDurations = null`. The board snapshot's retro gains `phaseDurations: array<string, int>|null` (Task 16's offer reads it).

- [ ] **Step 1: Write the failing tests**

`tests/Unit/Support/PhaseDurationsTest.php`:

```php
<?php

use App\Support\Retros\PhaseDurations;

it('keeps the timed phases that have minutes', function () {
    expect(PhaseDurations::normalise(['writing' => 7, 'voting' => 0, 'roti' => 5, 'grouping' => null]))->toBe(['writing' => 7])
        ->and(PhaseDurations::normalise([]))->toBeNull()
        ->and(PhaseDurations::normalise(null))->toBeNull()
        ->and(PhaseDurations::normalise(PhaseDurations::Standard))->toBe(PhaseDurations::Standard);
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

it('starts no timer when the retro enters a phase that has a duration', function () {
    Event::fake([TimerChanged::class]);
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['phase_durations' => ['grouping' => 5]]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)
        ->putJson(route('retros.phase.update', $retro), ['phase' => RetroPhase::Grouping->value])
        ->assertSuccessful();

    expect($retro->fresh()->timer_ends_at)->toBeNull();

    Event::assertNotDispatched(TimerChanged::class);
});

it('leaves a running timer alone across a phase change', function () {
    $this->freezeSecond();
    $endsAt = now()->addMinutes(2);
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['phase_durations' => PhaseDurations::Standard, 'timer_ends_at' => $endsAt]);
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

it('starts the offered duration through the existing timer endpoint', function () {
    $this->freezeSecond();
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['phase_durations' => ['writing' => 7]]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)
        ->putJson(route('retros.timer.update', $retro), ['seconds' => 7 * 60])
        ->assertOk();

    expect($retro->fresh()->timer_ends_at?->equalTo(now()->addMinutes(7)))->toBeTrue();
});
```

The phase route (`retros.phase.update`, verb and body), the timer route (`retros.timer.update`, verb), the snapshot route and its key path, and the 403 of a member on settings (it may be a 403 from `RetroGuard::facilitator`, rendered as JSON) are read from `tests/Feature/Retros/` before running; adapt names, not meaning. "Leaves a running timer alone" also holds a paused timer after plan 21: if plan 21 is merged, add the case with `timer_paused_seconds` set and assert it is unchanged after the phase change. The last case pins the contract Task 16 relies on (minutes × 60 through the existing endpoint), not a new behaviour.

- [ ] **Step 2: Run them to see them fail.** Expected: FAIL (the starts-nothing and running-timer cases pass already: they guard the answer).

- [ ] **Step 3: Implement**

`app/Support/Retros/PhaseDurations.php`:

```php
<?php

namespace App\Support\Retros;

use Closure;

/**
 * Spec plan 22 §6.2: whole minutes per timed phase, offered to the
 * facilitator. Nothing starts by itself (owner, decision 3, B).
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

- `TeamRetrosController@store`: `...PhaseDurations::rules()` in `validate()`; `phaseDurations: PhaseDurations::normalise(array_map('intval', $validated['phase_durations'] ?? []))`. `NewRetro` gains the parameter; `CreateRetro` writes `'phase_durations' => $data->phaseDurations`.
- `RetroSettingsController@update`: `...PhaseDurations::rules()`; `phase_durations` written (normalised) while the retro is open (add it to `OpenPhaseSettings`); it announces `RetroSettingsChanged` as the other settings do.
- `BuildBoardSnapshot`: `'phaseDurations' => $retro->phase_durations` beside `timerEndsAt`.
- `ChangeRetroPhase`, `RetroTimersController`: **not modified**.

- [ ] **Step 4: Run the tests on PostgreSQL** — `bin/test-db pgsql -- tests/Unit/Support/PhaseDurationsTest.php tests/Feature/Retros`. Expected: PASS.

- [ ] **Step 5: Commit** — `feat(retro): durations per phase, offered to the facilitator` (trailers).

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

- [ ] **Step 4: Run the tests** — `bin/test-db pgsql -- tests/Feature/Poker`; then the race: `bin/test-db pgsql --concurrency -- tests/Concurrency/RevoteAfterRevealTest.php`. Expected: PASS on both. (MariaDB, MySQL and a SQLite file run it in the roadmap's final matrix.)

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

- [ ] **Step 4: Run the tests** — `bin/test-db pgsql -- tests/Feature/Poker`. Expected: PASS.

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

- [ ] **Step 4: Run the tests** — `bin/test-db pgsql -- tests/Feature/Integrations tests/Feature/Poker`. Expected: PASS.

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

- [ ] **Step 4: Run the tests** — `bin/test-db pgsql -- tests/Feature/Poker tests/Feature/Sessions tests/Feature/Integrations`. Expected: PASS.

- [ ] **Step 5: Commit** — `feat(poker): the game options at creation and in the room settings` (trailers).

### Task 12: Poker — browse a tracker from the team, and import at creation

**Files:**
- Create: `app/Actions/Integrations/FetchPokerImport.php`, `PokerImportBatch.php`; `app/Http/Controllers/Integrations/TeamPokerImportContainersController.php`, `TeamPokerImportIterationsController.php`, `TeamPokerImportPreviewsController.php`
- Modify: `app/Actions/Integrations/ImportPokerTasks.php` (extract `storeIssues`), `app/Actions/Poker/CreatePokerGame.php`, `app/Http/Controllers/TeamPokerGamesController.php`, `routes/web.php`
- Test: `tests/Feature/Integrations/PokerCreationImportTest.php`

**Interfaces:**
- Consumes: `ResolvePokerTracker`, `ListPokerIterations`, `PreviewPokerImport::fetch`, `Trackers::for()->issues()`, `TrackerBrowseLimit`, `NewPokerGame::$import` (Task 11).
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
    ) {}

    /**
     * @param  list<string>  $externalIds
     */
    public function handle(Team $team, string $source, array $externalIds): PokerImportBatch
    {
        $integration = $this->resolvePokerTracker->handle($team, $source);
        $externalIds = array_values(array_unique($externalIds));

        try {
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

- [ ] **Step 4: Run the tests** — `bin/test-db pgsql -- tests/Feature/Integrations tests/Feature/Poker tests/Feature/Mcp tests/Arch`. Expected: PASS.

- [ ] **Step 5: Commit** — `feat(poker): import tickets while creating the game` (trailers).

---

## Step C — screens

### Task 13 (main): Front foundation — the shared dialog, kind tones, types

**Files:**
- Create: `resources/js/components/teams/team-new-session-dialog.tsx` (+ `.test.tsx`), `resources/js/lib/teams/sessions.ts` (+ `.test.ts`)
- Modify: `resources/js/components/teams/team-page.tsx`, `resources/js/components/skrum/session-type-picker.tsx` (export `sessionKindTone(kind)` and `sessionKindIcon(kind)`), `resources/js/types/*.ts` (the `NewSessionOptions` type), `resources/js/lib/poker/types.ts` (`PokerTrackerSourceRow` with `estimateFields`, `defaultEstimateFieldId`; `PokerTask` with `acceptanceCriteriaHtml` and `PokerTask['external']` with `type`, `labels`; game fields of Task 11), `resources/js/lib/retro/types.ts` (`phaseDurations`)

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

### Task 15 (lane K): Ticket details and the criteria section on the story card

**Mockup:** `ScreenPokerBefore` (the story card: "ATLAS-1287 · Story · Actions · 3 / 6 de la séance", title, description, "Critères d'acceptation" list).

**Files:**
- Create: `resources/js/components/poker/ticket-details.tsx` (+ test)
- Modify: `resources/js/components/poker/story-card.tsx` (+ test). No integration settings change (decision 6, B: no setting).

**Composition:**

| Mockup element | Built with |
|---|---|
| key chip | existing `TaskSourceLink` |
| type ("Story") | `Badge variant="outline"` after the key, `data-slot="ticket-type"` |
| label ("Actions") | one `Badge variant="secondary"` per label (wrap, at most 10), `data-slot="ticket-label"` |
| position | existing ":position / :total in this game" |
| description | existing rendered Markdown, now the server's `descriptionHtml` without the criteria section (Task 6) |
| "Acceptance criteria" + list | `TicketCriteria`: an `h3` small label `t('Acceptance criteria')` (the app's heading, whatever the source wrote) and the server's `acceptanceCriteriaHtml` in `MarkdownClasses`, after the description; `data-slot="ticket-criteria"` |

`StoryCard`'s top line renders `<TicketChips external={task.external} />` right after `TaskSourceLink`; the `details` prop (reserved by 18e for PK-1) is removed and its comment with it; `TicketCriteria` renders after the description for **every** task whose `acceptanceCriteriaHtml` is not empty (a task typed by hand included). Nothing renders for a missing field. The task edit dialog (`room-dialogs.tsx`) keeps editing the raw `description`, section included: no change there.

**Vitest:** (a) type and labels after the key, in order; (b) the criteria block after the description, from the HTML; (c) a typed task with `acceptanceCriteriaHtml` shows the block and no chips; (d) nothing for an imported task with no details and no criteria; (e) a description that is all criteria (`descriptionHtml` empty) shows the criteria block and no empty description block.

- [ ] **Steps:** failing Vitest; build; `npm run test -- story-card ticket-details`, the three front gates; commit `feat(poker): ticket type, labels and acceptance criteria on the story card` (trailers).

### Task 16 (lane C): The retro form's "Timer per phase"; the settings popover row; the phase timer offer on the board

Decision 3 was answered **B**: the board offers the phase's duration to the facilitator; nothing starts by itself. "Max per card" is plan 21's row: this task does not touch it.

**Mockup:** `ScreenSessionCreate` frames a and c, the "Settings" rows; `Timer` and `FacilitatorBar` for the offer (no frame draws it: deviation P22-15, approved by the owner on 2026-10-03, "… per topic" in Discussing).

**Files:**
- Create: `resources/js/lib/retro/phase-durations.ts` (+ test), `resources/js/components/teams/session-create/phase-timers-field.tsx` (+ test)
- Modify: `resources/js/components/teams/session-create/retro-session-fields.tsx` (+ its tests in `new-session-dialog.test.tsx` or a new `retro-session-fields.test.tsx`), `resources/js/components/retro/board-settings.tsx` (+ test), `resources/js/components/retro/board-topbar.tsx` (`BoardTimer`, + `board-topbar.test.tsx`), `resources/js/components/skrum/timer.tsx` (+ test), `resources/js/components/session/session-timer.tsx` (+ test)

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

export type PhaseTimerOffer = { phase: TimedPhase; seconds: number; perTopic: boolean };

/** Spec §6.2: the current phase's duration, offered to the facilitator; null when the phase has none. */
export function offerFor(durations: PhaseDurations | null, phase: string): PhaseTimerOffer | null {
    if (durations === null || !(TimedPhases as readonly string[]).includes(phase)) {
        return null;
    }

    const minutes = durations[phase as TimedPhase];

    if (minutes === undefined || minutes < 1) {
        return null;
    }

    return { phase: phase as TimedPhase, seconds: minutes * 60, perTopic: phase === 'discussing' };
}
```

Vitest for it: `choiceOf` of null, of the standard set, of one changed value; `toPayload` drops zeros and returns null when empty; `summary` lists phases in phase order, not key order; `offerFor` gives 420 s in Writing with the standard set, `perTopic` only in Discussing, null in ROTI, in Icebreaker, for a phase without minutes and for null durations.

**Composition (dialog):** after plan 21's "Max per card" row: "Timer per phase" — `timer` icon, help = `summary(…)` or "Off", then " · " and "Offered to the facilitator, never started by itself" (the second part hidden under 40rem), control `ui/select` with "No timer", "Standard", "Custom (5 phases)"; with Custom, `PhaseTimersField` under the row: five rows (phase label, stepper 0–60 where 0 is "Off"). Sent as `phase_durations: toPayload(…)`. Ids: `#new-retro-phase-timers`, `#new-retro-phase-<phase>`.

**Settings popover:** the same select and field in `board-settings.tsx`, facilitator only, open retro only, saved through the existing settings request with `phase_durations`.

**The offer** (spec §9.5):
- `Timer` gains `suggestion?: TimerPreset & { startLabel: string }`. When `onStart` and `suggestion` are given: while `remainingSeconds === null` and not `paused`, a ghost button before the menu trigger, `Play` icon and `presetLabel(suggestion)` ("7 min"), `aria-label={suggestion.startLabel}`, `data-slot="timer-suggestion"`, calling `onStart(suggestion.seconds)`; in the menu, the suggestion first (its `label`), keyed `suggestion` (not by seconds: it may equal a preset), then a `DropdownMenuSeparator`, then the presets as today. Without `suggestion`, `Timer` renders exactly as today.
- `SessionTimer` passes `suggestion` through; its comment "Never passed by a page" on `presets` stays true (the list is unchanged).
- `BoardTimer`: `const offer = canControl ? offerFor(retro.phaseDurations, retro.phase) : null;` and passes `suggestion` when `offer` is not null: `label` = `t(':phase · :count min', …)` or, when `offer.perTopic`, `t(':phase · :count min per topic', …)`; `startLabel` = `t('Start the :phase timer, :count minutes', …)` or `t('Start the :phase timer, :count minutes per topic', …)`. `:phase` is the phase's label the board already shows (the phase stepper's; find it with `grep -rn "Discussing" resources/js/components/retro`). Taking it calls the existing `set(offer.seconds)` (the same `RetroTimersController.update` request as the list; after plan 21, whatever `set` became).
- Participants: `canControl` is false, no `onStart`, so neither button nor menu, as today.

**Vitest:** (a) the "Timer per phase" row in the mockup's place, after plan 21's row; (b) "Standard" sends the five values; "No timer" sends `null`; Custom with writing 10 and the rest off sends `{ writing: 10 }`; (c) the popover row is absent for a participant who is not the facilitator; (d) a server error on `phase_durations` shows under the row; (e) `Timer` with a suggestion: the button while idle, absent while running or paused, the menu's first entry then a separator then 1, 3, 5, 10; a suggestion of 180 s and the 3-minute preset both render (no duplicate key warning); without a suggestion the DOM matches today's test cases; (f) `BoardTimer` for the facilitator in Writing with the standard set sends `{ seconds: 420 }` on one click; in Discussing the labels say "per topic"; in a phase without minutes no button; for a participant nothing.

- [ ] **Steps:** failing Vitest; build; `npm run test -- phase-durations phase-timers-field retro-session-fields board-settings board-topbar timer session-timer new-session-dialog`, the three gates; commit `feat(retro): timers per phase in the dialog and the settings, offered on the board` (trailers).

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

- [ ] List every key added by Tasks 2 to 18 (`git diff main -- lang/en.json`) and review `fr.json`, `es.json`, `de.json` for each: informal register (tu / tú / du), the glossary of `docs/superpowers/research/front-rewrite/translations-review.md` (session, poll ↔ sondage / encuesta / Umfrage, facilitator, estimate), the mockup's French where it exists: "Sessions", "À venir", "En cours", "Terminées", "Rétros, poker, whiteboards, sondages et icebreakers de :team", "Timer par phase", "Personnalisé (5 phases)", "Proposé au facilitateur, jamais lancé tout seul", ":phase · :count min", ":phase · :count min par sujet", "Lancer le timer :phase, :count minutes", "Lancer le timer :phase, :count minutes par sujet", "Timer par tâche", "Relance après le délai", "Revoter après révélation", "Avant l'enregistrement", "Écrire l'estimation dans :source", "Champ utilisé pour l'estimation", "Les estimations sont écrites dans :source quand le facilitateur clique sur « Enregistrer l'estimation ». Les tickets non cochés restent dans le backlog.", "Importer de :source", "Saisie manuelle", "Plus tard", ":selected sur :total sélectionnés", "Tout sélectionner", "Critères d'acceptation".
- [ ] `bin/test-db pgsql -- tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php`. Expected: PASS.
- [ ] Commit `chore(lang): plan 22 strings in four languages, informal` (trailers).

### Task 20: Captures (light, 1440, French)

No browser walkthrough is written, edited or run. Captures only, through `tests/Browser/Visual` (`CapturesVisuals::captureVisuals`, honouring `VISUAL_ONLY`).

**Files:** Create `tests/Browser/Visual/SessionsPagesVisualTest.php`; modify `SessionCreateVisualTest.php` (the two dialog variants), the retro board visual file (the timer offer) and the poker room visual file (the story card with details).

| Name | Screen |
|---|---|
| `sessions-live` | the Sessions page, Live tab, one session of each kind (frame a's list: "Sprint 42 retro", "Sprint 43 refinement", "Q4 architecture", "Team health · October") |
| `sessions-finished` | the Finished tab with 25 sessions ("Load more" visible) |
| `session-create-retro-options` | the dialog on retro with "Timer per phase" Custom open (plan 21's "Max per card" row as plan 21 left it) |
| `retro-phase-timer-offer` | the retro board in Writing, facilitator, standard durations, no timer running: the "7 min" button and the open timer menu with "Écriture · 7 min" first (P22-15) |
| `session-create-poker-import` | the dialog on poker, Jira import tab with a query and 12 tickets, 9 selected, the three settings rows (fixtures with `Http::fake` of the team-scoped preview) |
| `poker-story-details` | the poker room before reveal with ATLAS-1287 "Story", "Actions", a description ending with a "## Acceptance criteria" section of three items, shown apart |

- [ ] Run as the 18e captures were taken: `npm run build:front`, then `docker compose exec -e VISUAL_ONLY=light-1440-fr laravel.test php artisan test --compact tests/Browser/Visual/SessionsPagesVisualTest.php` and the three modified files. The overflow check must pass. Only `-light-1440-fr.png` files are written.
- [ ] Commit `test(visual): sessions page, creation options and story card captures` (trailers).

### Task 21: Deviations and documents

- [x] Open each capture of Task 20 beside its mockup's `preview.html` (light, 1440, French); each remaining difference is fixed or becomes a row of **Pre-build deviations** with the owner's word; a difference that fits no reason stops the task.
- [x] Documents, one commit:
  - the spec to `docs/superpowers/specs/2026-10-22-sessions-index-and-creation-options-design.md` and this plan to `docs/superpowers/plans/2026-10-22-plan-22-sessions-and-creation-options.md`, with the owner's answers to §15, to the pre-build deviations (spec §17) and the rulings of §16.2 and §16.8 folded in;
  - `docs/superpowers/research/front-rewrite/feature-roadmap.md`: SE-1, SE-3, PK-1 marked done (plan 22); SE-2 marked backlog (owner, 2026-10-02); the dependency lines updated (TM-1 and ON-1 no longer wait on SE-2; TM-2 reads `ListTeamSessions`);
  - `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, "Deviations from the mockup": D-06 reduced to "Schedule…" (backlog); D-07 reduced to the ROTI switch (backlog); D-16 reduced to the spectator eye and the Share roles (backlog);
  - `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` §6.4 and §10 with a pointer to the new spec;
  - `docs/database.md`: nothing, unless a task found a new rule.
- [x] Commit `docs: plan 22 — spec and plan in place, roadmap and deviation rows updated` (trailers).

### Task 22: Full suites on PostgreSQL, and report

- [ ] `vendor/bin/pint --format agent`; `vendor/bin/sail composer types:check`; `vendor/bin/sail composer rector:check`.
- [ ] `bin/test-db pgsql` (Unit, Feature, Upgrade and Arch). Expected: `test-db pgsql: PASS`.
- [ ] `bin/test-db pgsql --concurrency`. Expected: PASS.
- [ ] Do not run `sqlite`, `sqlite-file`, `mariadb` or `mysql`: the owner's four-engine matrix runs once after the roadmap's last merge (plans 24 and 25), outside this plan. `tests/Arch/DatabasePortabilityTest.php` (in the Arch run above) is the portability guard here.
- [ ] `bin/check-pg-upgrade`. Expected: PASS.
- [ ] `npm run test`, `npm run types:check`, `npm run check`, `npm run build:front`. Expected: PASS.
- [ ] Report `docs/superpowers/research/plan-22-report.md`: each acceptance criterion of spec §12 with the test that proves it (PostgreSQL; criteria 3, 9 and 18 noted as "other engines at the roadmap's final matrix"); the differences left with each mockup; existing tests edited and why; plan 21's names used (column, timer method, the per-topic start in Discussing) and any plan-21 task this plan skipped; whether GitHub's `issueType` was kept (spec §16.3); the rulings of spec §16.2 (per topic) and §16.8 (English heading only) as applied; the decisions taken on the owner's behalf.
- [ ] Commit `docs: plan 22 report` (trailers). Ask the owner to read the report. The merge into `roadmap` runs the PostgreSQL suite only. No merge into `main`, no push.

---

## Self-review (done while writing, redone after the owner's answers of 2026-10-03 and again after the deviation answers; kept for the reader)

**Answers folded in.** Decision 3 (B): Task 7 stores and sends durations and proves a phase change starts nothing; Task 16 builds the offer; P22-15 added; capture `retro-phase-timer-offer` added; no task writes the retro timer. Decision 6 (B): no criteria column, no detection, no setting; Task 5 = type and labels for the three trackers, Task 6 = `AcceptanceCriteriaSection` and the presenter; Task 12 no longer calls the detection; Task 15 has no integration select; P22-11 reworded, P22-14 withdrawn. Max per card left to plan 21 (its draft spec puts it in the dialog). Deviation answers (2026-10-03): every row approved as listed, P22-14 obsolete — no task changes; §16.2 ruled per topic (matches Task 16's `offerFor`), §16.8 ruled English only (matches Task 6's `Headings`). Engines: every test step on PostgreSQL only; Task 22 renamed; no sqlite/mariadb/mysql step left. Order: plan 21 is in the base, the "lanes S and K before plan 21" option is gone. Task count unchanged: 22.

**Spec coverage.** §6.1 states and cursor: Task 2; rows' meta: Tasks 2 and 13; §6.2 phase durations: Task 7 (back: storage, validation, snapshot, nothing starts), 16 (front: dialog, popover, the offer); max per card: plan 21 (Task 7 checks it); §6.3 revote: Task 8 (+ dock in 17); task timer: Task 9 (+ 17); write-back per game: Task 10 (+ 17); options at creation and in the room: Task 11; §6.4 import at creation: Task 12 (back), 18 (front); §6.5 type and labels: Tasks 5, 6 (back), 15 (front); criteria section (rules AC-1 to AC-7): Task 6 (unit and feature), 15 (front); §7 permissions: Tasks 4 (view), 2 (drafts), 7 and 11 (facilitator; the offer through the existing facilitator-only timer endpoint, Task 7's last case), 12 (`createPokerGame`); §8 real time: Task 7 (no `TimerChanged` on a phase change; `RetroSettingsChanged` on a durations change), 8 (`PokerRoundChanged`), 11 (`PokerGameChanged`, existing); §9 screens: 14, 16 (§9.2, §9.4 retro, §9.5 offer), 17, 18, 15 (§9.7); §10 no migration of data: Task 1 defaults, Task 2's card rule, Task 6's split at presentation; §11 routes: Tasks 4 and 12; §12 criteria: 1 → 4, 14; 2 → 2; 3 → 2 (walk), 22 (PostgreSQL; other engines at the roadmap's final matrix); 4 → 2, 14; 5 → 3, 13, 14; 6 → 7; 7 → 16 (and Task 7's endpoint case); 8 → 9; 9 → 8; 10 → 10, 11; 11 → 12; 12 → 12; 13 → 5, 6; 14 → 15; 15 → 6, 15; 16 → 19; 17 → 20, 21; 18 → 22.

**Placeholders.** Back-end tasks carry their tests and code; where the plan names a route, a helper or a relation it has not read line by line (the retro phase route, the snapshot paths, `surveyFacilitatorFor`, the toast flash key, `PokerRound::task`), the step says where to read the real name. Screen tasks carry composition tables, behaviours, hooks and the code of their pure logic (`lib/teams/sessions.ts`, `lib/retro/phase-durations.ts`, `lib/poker/tracker-browse.ts`), following the screen procedure of plan 18e.

**Type consistency.** `TeamSession` (Task 2) = `TeamSession` of `lib/teams/sessions.ts` (Task 13) = the rows read in Task 14. `PokerGame::TaskTimerChoices` (Task 1) feeds `PokerGameSettingsRules` (Task 11) and the select values of Task 17 (60/180/300/600). `PhaseDurations::Standard` and `TimedPhases` (Task 7) = `StandardDurations` and `TimedPhases` (Task 16); the snapshot's `retro.phaseDurations` (Task 7) = `lib/retro/types.ts` (Task 13) read by `offerFor` (Task 16). `TrackerIssue::$type/$labels` (Task 5) are written by `ImportPokerTasks::store` (Task 5), `ApplyPokerTaskIssues` (Task 6) and `storeIssues` (extracted in Task 12 from the Task 5 version: lane K merges before lane C). `PresentPokerTask.external.{type,labels}` and `PresentPokerTask.acceptanceCriteriaHtml` (Task 6) = `PokerTask['external']` and `PokerTask` in `lib/poker/types.ts` (Task 13) read by Task 15. `AcceptanceCriteriaSection::split` returns `{description, criteria}` and is called only by `PresentPokerTask`. `pokerSources[].estimateFields/defaultEstimateFieldId` (Task 11) read by Task 17. `IssueTracker::writeEstimate` gains `?string $preferredFieldId = null` in Task 10 for all four trackers.

**Review Focus.** 1 → Task 2's walk test; 2 → Task 8's race; 3 → Task 8 ("still refuses a second reveal and a timer"); 4 → Task 12 ("creates nothing when the tracker fails"); 5 → Task 6 (guest payload); 6 → Task 6 (unit cases per rule, the stale-cache case, the stored description); 7 → Task 7 (starts no timer, leaves a running timer alone).

**Known weak points.** Nothing was run. Plan 21 was a draft when this plan was written; it is merged before Task 1, but Task 7 relies on its `max_votes_per_card` in the dialog and Task 16 on its timer start, its pause and its per-topic rule in Discussing, all re-read at the start of lane C. Only PostgreSQL runs here: an engine-specific failure (the cursor's timestamp comparison on SQLite, the JSON columns on MariaDB) shows up at the roadmap's final matrix (risk accepted by the owner). The criteria regexes of Task 6 were written, not run: the unit test is the reference, and a regex that fails a case is fixed toward the spec's rules, never by loosening them. Task 2's state test ages a whiteboard through the clock; if `Whiteboard::updated_at` does not move when elements are written (spec §16.5), the Live rule of whiteboards reads the board's own updates only and the report says so. The race of Task 8 asserts order through `Race`'s timings; the fallback assertion is written in the step.
