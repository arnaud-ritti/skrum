# Team and workspace data (roadmap plan 23) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to run this plan task by task (through the Workflow tool, as the project does). Steps use checkbox (`- [ ]`) syntax. Every agent reads **Owner decisions**, **Global Constraints**, **Pre-build deviations** and its own task before anything else, then `docs/database.md` ("Rules for database code" and "Running the tests on an engine") for any task that touches PHP. A screen task also follows the "Screen task procedure" of `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, with the working rules below (no walkthrough, captures in Task 25 only).

**Status: draft of 2026-10-03, revised the same day with the owner's answers to spec §15** (decisions 1 B, 2 B, 4 C and 7 B differ from the first draft and are written in; 3, 5, 6, 8 and 9 confirm it). Nothing runs before the owner has approved the pre-build deviations (not asked yet).

**Goal:** Teams get roles (owner, facilitator, member, observer), explicit sprints with "Start the next sprint" and a derived next retro, default facilitators that suggest who facilitates a retro, a default retro template, descriptions, an activity log and whiteboard thumbnails; a facilitator or owner can take control of any open session of the team; a workspace can be renamed; templates get a visibility; the team page, the workspace page and the four team-settings tabs show all of it as the mockups draw it, without taking a right away from anyone.

**Architecture:** Roles live on the existing `team_user` pivot (a `TeamMembership` pivot model, `App\Enums\TeamRole`) and are read by `TeamPolicy`, by a `WorkspaceTemplatePolicy`, by `ActionItemPermissions`, by the MCP write tools, by `AccessRequestRecipients` (plan 29) and by one middleware, `RefuseObserverWrites`, placed after the participant middleware of the five session scopes. Taking control reuses the four existing hand-over endpoints, widened by one ability (`TeamPolicy::takeControl`). Sprints are rows (`team_sprints`) written only under the team's row lock; `App\Support\Teams\SprintCalendar` reads the rows of a window of days and answers "which sprint contains this day" and "when is the next retro". The default facilitators are a small ordered list (`team_facilitators`) read by `SuggestedFacilitator`, which the "New session" dialog shows and `CreateRetro` compares, under the team's row lock, to the person chosen, moving the rotation only when the suggestion was followed. The activity log is one append-only table written in the same transaction as the nine changes it records. Thumbnails are a cached JSON preview on `whiteboards`, built by a unique queued job with the template gallery's renderer. Everything else (recent sessions, open actions, retro counts, last activity) is read with relationship aggregates on bounded sets.

**Tech Stack:** Laravel 13, PHP 8.4, Pest (feature, unit, upgrade, arch, concurrency), Inertia 3, React 19, Tailwind 4, vite-plus (Vitest), Wayfinder; PostgreSQL, MariaDB, MySQL and SQLite through `bin/test-db`; `Tests\Concurrency\Support\Race` for races. Run `composer show --direct` and read `package.json` before Task 1 and stop if a major differs from this list.

**Spec:** `docs/superpowers/specs/2026-10-21-plan-23-team-workspace-data-design.md` (renamed in Task 26). Parent: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` §5. Mockups: `docs/design-system/components/ScreenDashboard`, `ScreenTeam`, `ScreenWorkspace`, `ScreenSettings` (frame a), `ScreenSessionCreate`, `TemplateEditor`, `Card`, `ActionItem`, `MoodTrendChart`, `Sidebar`, `EmptyState`, `Table` — for each, the `README.md` and the `preview.html`.

**Not in this plan:** spec §3 (scheduling and automatic sprint starts, team invitations and the invite link of plan 25, sprint grouping of action items, the Sessions page of plan 22, template defaults, a team colour, live updates of the team page, a survey take-over, a workspace slug change, retro exports and a team archive, plans 28 and 30); browser walkthroughs (owner's working rule: none is written or run).

**Tasks:** 27. Step A, roles, observer and take-over, single writer: 1 to 5. Step B, back end in three lanes cut from the head of Task 5: lane R (rituals) 6, 7, 8; lane T (templates) 9, 10; lane F (feed and page data) 11 to 15. Step C, single writer after the three lanes merge: 16 (team settings pages, back end), 17 (front foundation). Step D, screens in four lanes cut from the head of Task 17: Page 18; Settings 19, 20, 21; Workspace 22; Sessions 23. Final: 24 (translations), 25 (captures, light, 1440, French), 26 (deviations and documents), 27 (four-engine suites and report). The three tasks more than the first draft come from decision 1 B (Tasks 7 and 21) and decision 2 B (Task 5).

## Branch and run

- **Order (owner, 2026-10-03):** plans 20, 21, 24, 26, 27 and 29 run in parallel, then plan 22, then this plan, then plan 25. Base: `main` with **plan 22 merged** (and the six plans before it). Check before Task 1, and stop if one fails: `app/Actions/Sessions/ListTeamSessions.php`, `app/Actions/Teams/PresentNewSessionOptions.php` and `app/Enums/SessionState.php` exist (plan 22); `app/Actions/Teams/AccessRequestRecipients.php` exists (plan 29); the route `workspaces.actionItemCsvExports.show` exists (plan 24); `database/migrations` holds no migration dated `2026_10_23_…`; `bin/test-db` exists and `bin/test-db pgsql -- tests/Arch` passes; `tests/Concurrency/Support/Race.php` exists; `resources/js/components/teams/team-page.tsx` exports the type `TeamPageSlots` with the slots `schedule`, `recentSessions`, `openActions`, `activity`, `roleBadgeFor`, `retroStatsFor`, `whiteboardThumbnailFor`.
- Plans merged before this one: 20, 21, 22, 24, 26, 27, 29. Each task re-reads the files it touches; a line quoted here that no longer matches (plans 21, 22 and 24 change `CreateRetro`, `NewRetro`, `TeamRetrosController`, `TeamsController@show`, `ActionItemPermissions`, `PresentActionItem` and the retro board) is followed in spirit and reported. If a merged plan already used a migration date of `2026_10_23_…`, re-date this plan's migrations to the first free day and say so in the commit.
- Branch `plan-23-team-workspace-data` from that base. **No merge into `main`, no push.**
- Step A runs on that branch with one writer. Lanes run in git worktrees on branches `lane/23-<name>`, cut from the head named in **Lanes**; the controller merges one lane at a time and runs, after each merge, the gates `npm run types:check`, `npm run check`, `npm run build:front`, `vendor/bin/pint --dirty --format agent`, `vendor/bin/sail composer types:check`, and the whole suites on PostgreSQL and SQLite (`bin/test-db pgsql`, `bin/test-db sqlite`).
- From a worktree, `bin/test-db` needs `TEST_DB_CONTAINER` (the running application container) and `TEST_DB_WORKDIR` (the worktree's path inside it); MariaDB and MySQL are started once with `docker compose up -d mariadb mysql`. Never run two whole suites at once in the shared container.

## Owner decisions

The nine questions of spec §15, **answered by the owner on 2026-10-03**. "≠ first draft" marks the four answers that differ from the option the first draft was written on; the tasks below are written on the answers.

| # | Question | Answer | Where it lands |
|---|---|---|---|
| 1 | What is a sprint | **B, ≠ first draft**: explicit sprint rows (`team_sprints`: number, first and last day), "Start the next sprint", a management card; a default length, retro day and time on the team | Task 6 (table, `SprintCalendar` over rows, readers), Task 7 (add, edit, delete, start the next sprint, retro day; race), Task 16 (props), Task 21 (the Sprints card), Tasks 18, 22, 23 (labels) |
| 2 | Powers of owners and facilitators | **B, ≠ first draft**: owner = manager without delete; facilitator = rituals, team templates, rotation, **plus "Take control" of any open session of the team** | Task 2 (policy, `takeControl`), Task 5 (retro and game room take-over; poker and whiteboards already let every member take control), Task 23 (the retro menu entry) |
| 3 | Observer scope | **A**: read-only everywhere | Tasks 3, 4, 23 |
| 4 | Default facilitators | **C, ≠ first draft**: a suggestion only — a "Facilitator" select in the retro form of the "New session" dialog, prefilled from the list (rotation on: the next of the list; off: the first; empty: the creator); no automatic assignment; no mockup (P23-05) | Task 8 (`SuggestedFacilitator`, `facilitator_user_id`, the rotation moved only when followed; race), Task 23 (the select) |
| 5 | Default columns | **A**: edit the default template's columns in place, else "Duplicate as a team template" | Tasks 10, 20 |
| 6 | Who creates templates | **A**: personal = any member; team = managers, owners, facilitators; workspace = managers | Tasks 9, 22 |
| 7 | Workspace description | **B, ≠ first draft**: the description **and the rename** in the same small dialog of the workspace page, for managers; the slug stays | Task 11 (`WorkspaceDetailsController`), Task 22 (the dialog) |
| 8 | Data & export | **A**: links to existing exports and a paragraph | Tasks 16, 19 |
| 9 | Recent sessions and plan 22 | **A**: plan 22 first; Task 13 uses its state rules | Task 13 |

## File structure

Back end, created:

| File | Responsibility |
|---|---|
| `app/Enums/TeamRole.php`, `TemplateVisibility.php`, `TeamActivityKind.php` | the three enums |
| `app/Models/TeamMembership.php` | pivot model of `team_user` |
| `app/Models/TeamSprint.php` (+ factory) | one sprint of a team |
| `app/Models/TeamActivity.php` (+ factory) | one line of the activity log |
| `database/migrations/2026_10_23_100000_add_role_to_team_user_table.php` | team roles |
| `database/migrations/2026_10_23_100100_add_rituals_to_teams_table.php` | default sprint length, retro day and time, rotation |
| `database/migrations/2026_10_23_100150_create_team_sprints_table.php` | sprints |
| `database/migrations/2026_10_23_100200_create_team_facilitators_table.php` | default facilitators |
| `database/migrations/2026_10_23_100300_add_visibility_to_workspace_templates_table.php` | template visibility |
| `database/migrations/2026_10_23_100400_add_default_retro_template_to_teams_table.php` | default template |
| `database/migrations/2026_10_23_100500_add_descriptions_to_teams_and_workspaces.php` | descriptions |
| `database/migrations/2026_10_23_100600_create_team_activities_table.php` | activity log |
| `database/migrations/2026_10_23_100700_add_preview_to_whiteboards_table.php` | thumbnails |
| `app/Http/Middleware/RefuseObserverWrites.php` | observers change nothing in a session |
| `app/Support/Teams/SprintCalendar.php` | the sprint of a day and the next retro, from the rows |
| `app/Actions/Teams/StartNextSprint.php`, `SuggestedFacilitator.php`, `RecordTeamActivity.php`, `ListTeamActivity.php`, `ListRecentTeamSessions.php`, `TeamTemplateUsage.php`, `MemberLastActivity.php`, `TeamSettingsSections.php`, `RefreshStaleWhiteboardPreviews.php`, `PresentTeamSprints.php` | team reads and writes |
| `app/Actions/Retros/TemplateAvailability.php` | one rule for "this template may be used here by this person" |
| `app/Policies/WorkspaceTemplatePolicy.php` | template visibility |
| `app/Jobs/RefreshWhiteboardPreview.php` | builds a board's thumbnail |
| `app/Http/Requests/Teams/TeamSprintRequest.php`, `TeamRitualsRequest.php`, `TeamFacilitatorsRequest.php` | validation |
| `app/Http/Controllers/TeamMemberRolesController.php`, `TeamSprintsController.php`, `TeamSprintStartsController.php`, `TeamRitualsController.php`, `TeamFacilitatorsController.php`, `TeamDefaultRetroTemplatesController.php`, `TeamSettingsController.php`, `TeamDataController.php`, `WorkspaceDetailsController.php` | HTTP |

Back end, modified: `app/Models/Team.php`, `User.php`, `Workspace.php`, `WorkspaceTemplate.php`, `Whiteboard.php`, `TeamSurvey.php`; `app/Policies/TeamPolicy.php`, `WorkspacePolicy.php`; `app/Http/Controllers/TeamsController.php`, `TeamMembersController.php`, `TeamRetrosController.php`, `WorkspacesController.php`, `WorkspaceTemplatesController.php`, `WorkspaceMembersController.php`, `Retros/RetroFacilitatorsController.php`, `Games/GameHostsController.php`, `Poker/PokerStatusesController.php`, `TeamSurveys/TeamSurveyStatusesController.php`, `Integrations/TeamIntegrationsController.php`; `app/Http/Middleware/ResolvePokerPlayer.php`, `HandleInertiaRequests.php`; `app/Http/Requests/WorkspaceTemplateRequest.php`; `app/Actions/Poker/ResolvePlayer.php`, `BuildPokerSnapshot.php`; `app/Actions/Retros/CreateRetro.php`, `NewRetro.php`, `ChangeRetroPhase.php`, `BuildBoardSnapshot.php`, `BuildResults.php`, `BuildTemplateCatalogue.php`, `PresentTeamRetro.php`, `TopTeamTemplates.php`; `app/Actions/Teams/PresentNewSessionOptions.php` (plan 22), `AccessRequestRecipients.php` (plan 29); `app/Actions/Whiteboards/BuildWhiteboardSnapshot.php`, `CreateWhiteboard.php`, `WriteWhiteboardElements.php`, `PresentWhiteboardSummary.php`; `app/Actions/Games/BuildGameSnapshot.php`; `app/Actions/TeamSurveys/BuildTeamSurveySnapshot.php`; `app/Actions/Poker/CreatePokerGame.php`; `app/Actions/ActionItems/ActionItemPermissions.php`, `SetActionItemStatus.php`; `app/Actions/Teams/BuildTeamMoodTrend.php`; `app/Mcp/Tools/SkrumTool.php` and its thirteen write tools, `Retro/ListTeamMembers.php`; `routes/web.php`; `tests/Pest.php`.

Tests, created besides each task's feature files: `tests/Unit/Support/Teams/SprintCalendarTest.php`; `tests/Upgrade/TeamRolesBackfillTest.php`, `WorkspaceTemplateVisibilityBackfillTest.php`; `tests/Concurrency/TeamSprintStartsTest.php`, `RetroRotationTest.php`, `TeamFacilitatorsTest.php`; `tests/Browser/Visual/TeamWorkspaceDataVisualTest.php` (captures only).

Front end, created: `resources/js/lib/teams/{roles,sprint,activity,session-rows,facilitator}.ts` (+ tests); `resources/js/components/teams/{team-schedule,team-recent-sessions,team-open-actions-card,team-activity-card,team-role-badge,whiteboard-thumbnail}.tsx` (+ tests); `resources/js/components/team-settings/{general-settings,data-export,members-table,sprints-card,default-facilitators-card,retro-templates-card,default-columns-card}.tsx` (+ tests); `resources/js/components/workspaces/workspace-details-dialog.tsx` (+ test); `resources/js/components/teams/session-create/retro-facilitator-field.tsx` (+ test); `resources/js/pages/teams/{settings,members,data}.tsx`. `components/team-settings/` is a domain folder under `components/`, as spec §6.1 of the parent allows; `TeamSettingsShell` moves there from `components/integrations/` (Task 17). Modified: the team page components named by the slots, `team-header.tsx`, `team-members-card.tsx`, `skrum/session-card.tsx` (`groups`), `skrum/template-editor.tsx` (team select), `workspaces/{team-tile,workspace-overview,templates-page,template-card,template-editor-sheet}.tsx`, `lib/teams/settings-href.ts`, `skrum/app-sidebar.tsx` (role line), `teams/session-create/retro-session-fields.tsx`, the five session screens' read-only switches, the retro board menu ("Take control"), `types/workspaces.ts`.

## Global Constraints

- **Mockup first** (parent spec §5 rule 13). A screen follows its mockup: layout, placement, labels, states. A difference is fixed, or is a row of **Pre-build deviations**, and a row is put to the owner before its screen is built. Captures are taken once, in Task 25, in light, at 1440, in French, and compared with the mockup's `preview.html` in Task 26.
- **Existing features kept** (owner's rule): a member keeps every right they have today (including "Take control" of poker games and whiteboards); every existing permission test passes unchanged at the end of each task of Step A.
- **Front rules** of the parent spec §5 on every front file: tokens only, rem, Tailwind scale (no arbitrary size), no overflow from 20rem to 60rem, visible focus, contrast, motion with `prefers-reduced-motion`, lucide icons, the literal call shape `t('…')`, presentational `skrum/` components (no network, no Echo, no router). Containers live in `resources/js/components/<domain>/`. Reuse what exists: `skrum/session-card`, `skrum/action-item`, `skrum/empty-state`, `skrum/template-editor`, `skrum/column-color-picker`, `skrum/confirm-dialog`, `skrum/sub-nav`, `skrum/date-picker`, `ui/table`, `ui/select`, `ui/switch`, `ui/drawer`, `teams/session-create/*`.
- **Database (owner rule): Eloquent and the standard query builder only.** `docs/database.md`, rules 1 to 12, apply to every line of PHP, migration and test; `tests/Arch/DatabasePortabilityTest.php` enforces them with no allowed list. In short: no raw query of any form; no driver test; what SQL cannot say the same way on the four engines is done in PHP on bounded sets, aggregates cast in PHP; migrations with the Schema builder only, `up` only, dated `2026_10_23_…`, nullable `timestamp()` or `dateTime()`, no `enum()`, no collation, no JSON default, index names within 64 characters; a transaction locks the aggregate root first (the team row for sprints, facilitators, rotation and every retro creation; the workspace row for templates and the workspace rename; the session row for a take-over) and is retried with `Transactions::Attempts` only when it touches nothing but the database; an explicit tie-breaker on every sort; lists read by people sorted with `Alphabetical::sort()`; tests never read SQL text and never change the schema; a legacy row written with `DB::table()` in a test sets the derived columns of its table (`users.email_key`, `users.name_search`); JSON compared with `toBeIgnoringKeyOrder`; writes never skip model events (`$model->timestamps = false` before `save()` is allowed: it skips no event).
- **Tests per task (owner's working rule).** Every task writes its tests first and runs the tests it wrote or touched on **PostgreSQL and SQLite**: `bin/test-db pgsql -- <paths>`, then `bin/test-db sqlite -- <paths>`. The red step ("see it fail") may run once on SQLite in memory: `vendor/bin/sail artisan test --compact <path>`. **Data migrations (Upgrade tests) and races run on the four engines:** `bin/test-db <pgsql|mariadb|mysql|sqlite> -- <upgrade path>`, races with `bin/test-db <pgsql|mariadb|mysql|sqlite-file> --concurrency`, never in parallel. The **whole suites** run at each lane merge (PostgreSQL and SQLite) and on the four engines in Task 27.
- **Races** are proved with `Tests\Concurrency\Support\Race` (`Race::run`, `Race::request`; static closures capturing scalars only); each case states the protection it proves, and removing it makes the case fail: two "Start the next sprint" (Task 7), two retro creations following the same suggestion (Task 8), two saves of the facilitator list (Task 8).
- **Data migrations** (Tasks 1, 9) are proved in `tests/Upgrade` in the pattern of `GamePointsWeekStartBackfillTest`: `migrate:fresh` up to the migration before, legacy rows written with `DB::table()`, the real migration run, the rows read back.
- **No browser walkthrough** is written, edited or run (owner). Vitest is written and run per front task (`npm run test -- <pattern>`), the whole Vitest suite in Tasks 17 and 27. **Captures only, light, 1440, French**, in Task 25.
- **No new dependency**, PHP or JS, without the owner's approval.
- **Four languages, informal.** Every new `__('…')` and `t('…')` key is added to `lang/en.json`, `fr.json`, `es.json`, `de.json` in the commit that introduces it (`tests/Feature/TranslationKeysTest.php`), in the informal register (French "tu", Spanish "tú", German "du"; `tests/Feature/InformalRegisterTest.php`). A key that exists keeps its value. Task 24 holds the values of every key this plan names; in `en.json` the value is the key.
- **No test is deleted** without the owner's approval; an existing test whose expectation changes is listed in its task with the reason.
- Primary and foreign keys are UUIDs (`tests/Feature/UuidPrimaryKeysTest.php`). Create files with `vendor/bin/sail artisan make:… --no-interaction`.
- Controllers: plural name, CRUD method names only (`tests/Arch/ArchTest.php`). Route names camelCase, URLs kebab-case, tuple notation. Form Requests with array rules. Every page the server renders has its file under `resources/js/pages` (`tests/Arch/FrontEndPagesTest.php`): a page rendered in Step A or C gets a thin page file in the same task.
- Arch facts: models do not use `App\Actions`, `App\Http` or `App\Mcp`; actions do not use `App\Http`; `App\Support`, jobs and events do not use `App\Http` or `App\Mcp`; enums use nothing of the application; no class is `final`.
- PHP style: early returns, no `else`, happy path last, typed everything, PascalCase constants, constructor promotion, no comment that restates code; before each commit `vendor/bin/pint --dirty --format agent` and `vendor/bin/sail composer types:check` (PHPStan, level 7).
- Octane is installed: no static or per-request singleton state in new classes.
- Front gates after every task that touches the front: `npm run types:check`, `npm run check`, `npm run build:front` (it runs `wayfinder:generate --with-form`, needed after every task that adds a route used by the front).
- One commit per task, in the repository's style (`feat(teams): …`, `feat(templates): …`, `test: …`); a change to a shared `skrum/` component is its own commit inside the task. **Every commit message ends with these two lines:**

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE
```

- **Never push, never merge into `main`.**

## Pre-build deviations

**To approve by the owner** (not asked yet): put to the owner before the screen is built (owner's rule of the fifth round). Reasons as in plan 18e: **F** false or unsafe, **A** accessibility, **N** no such data or concept, **S** the spec, **O** an owner's answer.

| # | Screen | Mockup element | Built | Reason |
|---|---|---|---|---|
| P23-01 | Members & rituals | no card for sprints | a "Sprints" card: the current sprint, "Start the next sprint" with its preview line, the list of sprints (edit, delete), "Add a sprint", and the settings (default length, retro day, time, next-retro preview, Save), designed from the settings cards of ScreenSettings a | O: decision 1 B (explicit sprints and a management card) |
| P23-02 | Data & export | the tab only | an "Exports" card (survey CSVs, estimates, plan 24's action items export) and a "What is kept" card | N: no content drawn; decision 8 |
| P23-03 | Workspace page | no workspace description, no rename | the description under the facts line; an "Edit" ghost button opening a dialog "Workspace" with Name and Description, for managers | O: decision 7 B |
| P23-04 | Retro, poker, whiteboard, game, survey | no observer view | each screen's existing read-only mode with an info line | N |
| P23-05 | "New session", retro form | no facilitator field | a "Facilitator" select under the settings (the viewer first, then owners, facilitators and members), preselected with the suggested person, "(suggested)" after their name, "Suggested by the rotation." when the rotation is on | O: decision 4 C (the owner chose it knowing it has no mockup) |
| P23-06 | Team header | "Next retro Thu 2 Oct, 2 pm" (a scheduled retro) | derived from the sprints and the retro day; the time only when set; "Start the first sprint" for who may when the team has no sprint | O: scheduling is backlog |
| P23-07 | Members table | "En ligne" in Last activity | the relative date of the last session joined; "Never" | N: no presence outside a session (D-91) |
| P23-08 | Activity feed | "Nadia K a répondu au sondage « … »" | no line about survey answers; a tracker's sync shows the tracker's name with initials | F: a team survey is anonymous (plan 19 spec §6.3) |
| P23-09 | Recent sessions | a whiteboard "Brouillon"; four kinds | a whiteboard is live, upcoming (no element) or finished by plan 22's rules; game rooms are listed too; "All sessions" leads to plan 22's Sessions page | N: a whiteboard has no draft |
| P23-10 | Team settings | "Modifications enregistrées" in the topbar | explicit "Save" per card, toasts | O: 10-D6; D-87 |
| P23-11 | Retro templates card | three templates | the team's top five plus the default, "Create" and "Browse" | S: §6.5 |
| P23-12 | Default facilitators | chips of any person | only owners and facilitators can be added; "Add" lists them; the switch reads "Rotate the suggestion at every retro" | S: §6.4 |
| P23-13 | Members card (team page), Members table | "Invite", "Lien d'invitation", "Renvoyer", the pending invitation row | places left | N: plan 25 |
| P23-14 | Team settings header | "Équipe produit · 11 membres · créée en mars 2025" | the same when a description exists; without it, ":count members · created in :month" | — (D-88 cleared) |
| P23-15 | Templates editor | Visibility "Équipe" without a team | "Team" followed by a team select when the person may create for several teams | S: §6.6 |
| P23-16 | Retro board menu | no "Take control" for a retro | the entry "Take control" (as on poker and whiteboards) for a team facilitator, owner or manager while the retro is open | O: decision 2 B |

## Review Focus

The inputs the spec implies and that are most likely to bite, each pinned by a test in the task that owns the code.

1. **A facilitator made observer while their retro is open**: they must still drive it (next phase, timer), or the session is stuck. Test in Task 3.
2. **A workspace admin whose `team_user` row says observer** (they joined a team and someone demoted them): never restricted anywhere. Tests in Tasks 1 and 3.
3. **A member posting a take-over of a retro** (the endpoint is the facilitator's hand-over): refused, while the same member keeps "Take control" on poker games and whiteboards. Test in Task 5.
4. **Two "Start the next sprint" at the same moment**: one sprint, the current one cut once. Race in Task 7.
5. **Two retros created at the same moment, both following the suggestion**: the rotation moves once, the next suggestion is the second person. Race in Task 8.
6. **A personal template key posted by someone else** (copied from a URL or a network log) to create a retro: refused. Test in Task 9.
7. **A sprint's day read across a daylight-saving change** (a session created at 00:30 in `Europe/Paris` on the first day of a sprint, 23:30 UTC the day before), and the next retro on the retro day itself before and after its time. Unit tests in Task 6.
8. **The thumbnail job moving a board's "edited" date**: the tile line "edited today" and the recent sessions order would lie. Test in Task 15.

## Lanes

| Lane | Tasks | Cut from | Shares with other lanes |
|---|---|---|---|
| main | 1 to 5, then 16, 17, then 24 to 27 | — | — |
| R (rituals) | 6, 7, 8 | head of Task 5 | `TeamsController.php` (props `schedule`, `hasSprints`), `CreateRetro.php` and `NewRetro.php` (facilitator choice; lane F adds one line), `TeamRetrosController.php` (`facilitator_user_id`; lane T changes the template rule), `PresentNewSessionOptions.php` (lane T adds `defaultRetroTemplate`), `WorkspacesController.php` (`openRetroSprint`), `BuildBoardSnapshot.php`, `BuildTeamMoodTrend.php`, `routes/web.php`, `tests/Pest.php`, `lang/*.json` |
| T (templates) | 9, 10 | head of Task 5 | `TeamsController.php` (`catalogue` arguments), `TeamRetrosController.php`, `PresentNewSessionOptions.php`, `routes/web.php`, `lang/*.json` |
| F (feed and page data) | 11 to 15 | head of Task 5 | `TeamsController.php` (`activity`, `recentSessions`, `openActionItems`, retro counts, previews), `WorkspacesController.php` (descriptions, whiteboard line), `CreateRetro.php`, `CreatePokerGame.php`, `CreateWhiteboard.php`, `routes/web.php`, `tests/Pest.php`, `lang/*.json` |
| Page | 18 | head of Task 17 | `lang/*.json` |
| Settings | 19, 20, 21 | head of Task 17 | `lang/*.json`, `pages/teams/members.tsx` (Tasks 20 and 21 in order) |
| Workspace | 22 | head of Task 17 | `skrum/template-editor.tsx` (this lane only), `lang/*.json` |
| Sessions | 23 | head of Task 17 | `teams/session-create/retro-session-fields.tsx`, `skrum/app-sidebar.tsx`, the session screens and the retro board menu (this lane only), `lang/*.json` |

`TeamsController@show` is the hot spot of Step B: each lane adds its props as one line each at the end of the props array and one private method each at the end of the class; the controller resolves the conflicts at merge by keeping every line. `PresentNewSessionOptions::handle` (plan 22) gets one block per lane at the end of its array (R: `suggestedFacilitatorId`, `retroFacilitators`, `currentSprintNumber`; T: `defaultRetroTemplate`). `CreateRetro::handle` gets one line per lane (R: the facilitator choice before `participants()->create`; F: the activity after it). `tests/Pest.php`: Task 1 adds the role helper; each lane adds its helpers in one block at the end of the file. `lang/*.json` conflicts are resolved by the controller (keys appended in alphabetical blocks per lane). Merge order: R, T, F (F's `TeamsController` lines are the most numerous).

---

## Step A — roles, observer and take-over (single writer)

### Task 1: Team roles — enum, pivot, migration, helpers

**Files:**
- Create: `app/Enums/TeamRole.php`, `app/Models/TeamMembership.php`, `database/migrations/2026_10_23_100000_add_role_to_team_user_table.php`
- Modify: `app/Models/Team.php` (`members()`, `roleOf()`), `app/Models/User.php` (`teams()`, `isObserverOf()`, `managesTeam()`, `managesRitualsOf()`), `tests/Pest.php` (`teamMember()` takes a role)
- Test: `tests/Feature/Teams/TeamRolesTest.php`, `tests/Upgrade/TeamRolesBackfillTest.php`

Read first: `app/Models/WorkspaceMembership.php` and `Workspace::members()` (the pattern), `User::roleIn()`, `tests/Upgrade/GamePointsWeekStartBackfillTest.php` and `HealthChecksToTeamSurveysTest.php` (how a legacy user row is written: `email_key`, `name_search`). Then run `grep -rn "pivot" app tests resources/js | grep -iv "withPivot\|wherePivot\|orderByPivot\|extends Pivot\|Relations\\\\Pivot"` and stop if any line reads the pivot of a team member: the accessor becomes `teamMembership`.

**Interfaces:**
- Produces: `TeamRole::{Owner, Facilitator, Member, Observer}` with `label(): string`, `managesTeam(): bool`, `managesRituals(): bool`, `contributes(): bool`, `static options(): array<int, array{value: string, label: string}>`; `Team::members(): BelongsToMany<User, Team, TeamMembership, 'teamMembership'>`; `Team::roleOf(User): ?TeamRole`; `User::teams()` with the same pivot; `User::isObserverOf(Team): bool`, `User::managesTeam(Team): bool`, `User::managesRitualsOf(Team): bool`; `teamMember(Team $team, TeamRole $role = TeamRole::Member): User`.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Teams/TeamRolesTest.php`:

```php
<?php

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;

it('gives a member added without a role the member role', function () {
    $team = Team::factory()->create();
    $user = User::factory()->create();
    $team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);

    $team->members()->attach($user);

    expect($team->roleOf($user))->toBe(TeamRole::Member)
        ->and($team->members()->first()->teamMembership->role)->toBe(TeamRole::Member);
});

it('reads the role of a member, and none for someone outside the team', function () {
    $team = Team::factory()->create();
    $facilitator = teamMember($team, TeamRole::Facilitator);

    expect($team->roleOf($facilitator))->toBe(TeamRole::Facilitator)
        ->and($team->roleOf(User::factory()->create()))->toBeNull();
});

it('says what each role may do', function (TeamRole $role, bool $managesTeam, bool $managesRituals, bool $isObserver) {
    $team = Team::factory()->create();
    $user = teamMember($team, $role);

    expect($user->managesTeam($team))->toBe($managesTeam)
        ->and($user->managesRitualsOf($team))->toBe($managesRituals)
        ->and($user->isObserverOf($team))->toBe($isObserver)
        ->and($role->contributes())->toBe(! $isObserver);
})->with([
    'owner' => [TeamRole::Owner, true, true, false],
    'facilitator' => [TeamRole::Facilitator, false, true, false],
    'member' => [TeamRole::Member, false, false, false],
    'observer' => [TeamRole::Observer, false, false, true],
]);

it('never restricts a workspace manager, whatever their team row says', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);
    $team->members()->attach($admin, ['role' => TeamRole::Observer->value]);

    expect($admin->isObserverOf($team))->toBeFalse()
        ->and($admin->managesTeam($team))->toBeTrue()
        ->and($admin->managesRitualsOf($team))->toBeTrue();
});

it('lists the four roles in order, labelled', function () {
    expect(array_column(TeamRole::options(), 'value'))->toBe(['owner', 'facilitator', 'member', 'observer'])
        ->and(TeamRole::options()[1]['label'])->toBe('Facilitator');
});
```

`tests/Upgrade/TeamRolesBackfillTest.php`:

```php
<?php

use App\Support\Database\SearchText;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

it('gives every existing team membership the member role by running the migration itself', function () {
    $migration = '2026_10_23_100000_add_role_to_team_user_table.php';
    $earlier = collect(glob(database_path('migrations/*.php')))
        ->filter(fn (string $path): bool => basename($path) < $migration)
        ->values()
        ->all();

    Artisan::call('migrate:fresh', ['--path' => $earlier, '--realpath' => true]);

    $row = function (string $table, array $values): string {
        $id = (string) Str::uuid7();

        DB::table($table)->insert(['id' => $id, 'created_at' => now(), 'updated_at' => now(), ...$values]);

        return $id;
    };
    $workspace = $row('workspaces', ['name' => 'Acme', 'slug' => 'acme']);
    $team = $row('teams', ['workspace_id' => $workspace, 'name' => 'Platform']);
    $users = collect(['Ada', 'Grace'])->map(fn (string $name): string => $row('users', [
        'name' => $name,
        'email' => strtolower($name).'@example.test',
        'email_key' => strtolower($name).'@example.test',
        'name_search' => SearchText::fold($name),
        'password' => 'secret',
    ]));

    foreach ($users as $user) {
        DB::table('team_user')->insert(['team_id' => $team, 'user_id' => $user, 'created_at' => now(), 'updated_at' => now()]);
    }

    Artisan::call('migrate', ['--path' => [database_path("migrations/{$migration}")], '--realpath' => true]);

    expect(DB::table('team_user')->where('team_id', $team)->orderBy('user_id')->pluck('role')->all())->toBe(['member', 'member']);
});
```

If the users table of that schema has another non-null column without a default, set it as `HealthChecksToTeamSurveysTest.php` does and say so in the commit.

- [ ] **Step 2: Run them and see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Teams/TeamRolesTest.php`
Expected: FAIL, `Class "App\Enums\TeamRole" not found`.

- [ ] **Step 3: Enum, pivot, migration**

`app/Enums/TeamRole.php`:

```php
<?php

namespace App\Enums;

enum TeamRole: string
{
    case Owner = 'owner';
    case Facilitator = 'facilitator';
    case Member = 'member';
    case Observer = 'observer';

    public function label(): string
    {
        return match ($this) {
            self::Owner => __('Owner'),
            self::Facilitator => __('Facilitator'),
            self::Member => __('Member'),
            self::Observer => __('Observer'),
        };
    }

    public function managesTeam(): bool
    {
        return $this === self::Owner;
    }

    public function managesRituals(): bool
    {
        return $this === self::Owner || $this === self::Facilitator;
    }

    public function contributes(): bool
    {
        return $this !== self::Observer;
    }

    /**
     * @return array<int, array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $role): array => ['value' => $role->value, 'label' => $role->label()], self::cases());
    }
}
```

`app/Models/TeamMembership.php`:

```php
<?php

namespace App\Models;

use App\Enums\TeamRole;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * @property string $team_id
 * @property string $user_id
 * @property TeamRole $role
 */
#[Table(name: 'team_user')]
class TeamMembership extends Pivot
{
    protected function casts(): array
    {
        return [
            'role' => TeamRole::class,
        ];
    }
}
```

`database/migrations/2026_10_23_100000_add_role_to_team_user_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('team_user', function (Blueprint $table) {
            $table->string('role', 20)->default('member');
        });
    }
};
```

- [ ] **Step 4: Relations and helpers**

In `app/Models/Team.php`, replace `members()` and add `roleOf()` (imports `App\Enums\TeamRole`):

```php
    /** @return BelongsToMany<User, $this, TeamMembership, 'teamMembership'> */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->using(TeamMembership::class)
            ->as('teamMembership')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function roleOf(User $user): ?TeamRole
    {
        return TeamMembership::query()
            ->where('team_id', $this->id)
            ->where('user_id', $user->id)
            ->first()
            ?->role;
    }
```

In `app/Models/User.php`, add `@property-read TeamMembership $teamMembership` to the class docblock, replace `teams()`, and add the three methods after `canManage()`:

```php
    /** @return BelongsToMany<Team, $this, TeamMembership, 'teamMembership'> */
    public function teams(): BelongsToMany
    {
        return $this->belongsToMany(Team::class)
            ->using(TeamMembership::class)
            ->as('teamMembership')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function isObserverOf(Team $team): bool
    {
        if ($this->canManage($team->workspace)) {
            return false;
        }

        return $team->roleOf($this) === TeamRole::Observer;
    }

    public function managesTeam(Team $team): bool
    {
        if ($this->canManage($team->workspace)) {
            return true;
        }

        return $team->roleOf($this)?->managesTeam() ?? false;
    }

    public function managesRitualsOf(Team $team): bool
    {
        if ($this->canManage($team->workspace)) {
            return true;
        }

        return $team->roleOf($this)?->managesRituals() ?? false;
    }
```

In `tests/Pest.php`, `teamMember()` becomes (import `App\Enums\TeamRole`):

```php
function teamMember(Team $team, TeamRole $role = TeamRole::Member): User
{
    $user = User::factory()->create();
    $team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $team->members()->attach($user, ['role' => $role->value]);

    return $user;
}
```

- [ ] **Step 5: Run the tests on PostgreSQL and SQLite, the Upgrade test on the four engines**

Run: `bin/test-db pgsql -- tests/Feature/Teams/TeamRolesTest.php tests/Feature/Teams tests/Feature/Workspaces`, then the same with `sqlite`.
Run: `bin/test-db pgsql -- tests/Upgrade/TeamRolesBackfillTest.php`, then `mariadb`, `mysql`, `sqlite`.
Expected: PASS on each; the existing team and workspace tests pass unchanged.

- [ ] **Step 6: Commit**

```bash
git add app/Enums/TeamRole.php app/Models/TeamMembership.php app/Models/Team.php app/Models/User.php database/migrations/2026_10_23_100000_add_role_to_team_user_table.php tests/Pest.php tests/Feature/Teams/TeamRolesTest.php tests/Upgrade/TeamRolesBackfillTest.php
git commit -m "feat(teams): team roles on the membership — owner, facilitator, member, observer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 2: Policies read the team role; changing a member's role

**Files:**
- Create: `app/Http/Controllers/TeamMemberRolesController.php`
- Modify: `app/Policies/TeamPolicy.php`, `app/Http/Controllers/TeamMembersController.php` (`store` takes a role), `app/Http/Controllers/TeamsController.php` (members carry their role; `roleOptions`, `viewerRole`; `availableMembers` for a team owner), `app/Mcp/Tools/Retro/ListTeamMembers.php` (adds `role`), `app/Actions/Teams/AccessRequestRecipients.php` (plan 29: the team's owners join the recipients), `routes/web.php`
- Test: `tests/Feature/Teams/TeamMemberRolesTest.php`, `tests/Feature/Teams/TeamPolicyMatrixTest.php`, `tests/Feature/TeamAccessRequests/AccessRequestRecipientsTest.php`

Read first: every caller of the abilities this task changes: `grep -rn "'update', \$team\|'manageMembers'\|'manageIntegrations'\|'createRetro'\|'createPokerGame'\|'createWhiteboard'\|'createGameRoom'\|'createSurvey'" app routes`. The health-statement controllers authorise with `update` (owners now manage statements, spec §7).

**Interfaces:**
- Consumes: Task 1.
- Produces: `TeamPolicy::manageRituals(User, Team): bool`, `TeamPolicy::takeControl(User, Team): bool` (read by Task 5); `AccessRequestRecipients::for(Team)` returns the workspace's owners and admins and the team's owners; `teams.members.role.update` (`PUT w/{workspace}/teams/{team}/members/{member}/role`, body `role`); `teams.members.store` accepts `role`; `teams/show` props `members[].role`, `roleOptions`, `viewerRole`, `canManageRituals`.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Teams/TeamPolicyMatrixTest.php` — the matrix of spec §7, ability by ability:

```php
<?php

use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\User;

function teamViewer(Team $team, string $who): User
{
    return match ($who) {
        'manager' => workspaceManager($team->workspace),
        'outsider' => User::factory()->create(),
        default => teamMember($team, TeamRole::from($who)),
    };
}

it('answers each team ability by role', function (string $ability, array $allowed) {
    $team = Team::factory()->create();

    foreach (['manager', 'owner', 'facilitator', 'member', 'observer', 'outsider'] as $who) {
        expect(teamViewer($team, $who)->can($ability, $team))->toBe(in_array($who, $allowed, true), "{$ability} for {$who}");
    }
})->with([
    'view' => ['view', ['manager', 'owner', 'facilitator', 'member', 'observer']],
    'update' => ['update', ['manager', 'owner']],
    'delete' => ['delete', ['manager']],
    'manageMembers' => ['manageMembers', ['manager', 'owner']],
    'manageRituals' => ['manageRituals', ['manager', 'owner', 'facilitator']],
    'takeControl' => ['takeControl', ['manager', 'owner', 'facilitator']],
    'manageIntegrations' => ['manageIntegrations', ['manager', 'owner']],
    'createRetro' => ['createRetro', ['manager', 'owner', 'facilitator', 'member']],
    'createPokerGame' => ['createPokerGame', ['manager', 'owner', 'facilitator', 'member']],
    'createWhiteboard' => ['createWhiteboard', ['manager', 'owner', 'facilitator', 'member']],
    'createGameRoom' => ['createGameRoom', ['manager', 'owner', 'facilitator', 'member']],
    'createSurvey' => ['createSurvey', ['manager', 'owner', 'facilitator', 'member']],
]);
```

`tests/Feature/Teams/TeamMemberRolesTest.php`:

```php
<?php

use App\Enums\TeamRole;
use App\Models\Team;
use Inertia\Testing\AssertableInertia as Assert;

it('lets a team owner who is not a workspace admin change a role', function () {
    $team = Team::factory()->create();
    $owner = teamMember($team, TeamRole::Owner);
    $member = teamMember($team);

    $this->actingAs($owner)
        ->put(route('teams.members.role.update', [$team->workspace, $team, $member]), ['role' => 'facilitator'])
        ->assertRedirect();

    expect($team->roleOf($member))->toBe(TeamRole::Facilitator);
});

it('lets a workspace admin change a role', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);

    $this->actingAs(workspaceManager($team->workspace))
        ->put(route('teams.members.role.update', [$team->workspace, $team, $member]), ['role' => 'observer'])
        ->assertRedirect();

    expect($team->roleOf($member))->toBe(TeamRole::Observer);
});

it('refuses a role change to whoever does not manage the team', function (TeamRole $role) {
    $team = Team::factory()->create();
    $member = teamMember($team);

    $this->actingAs(teamMember($team, $role))
        ->put(route('teams.members.role.update', [$team->workspace, $team, $member]), ['role' => 'owner'])
        ->assertForbidden();

    expect($team->roleOf($member))->toBe(TeamRole::Member);
})->with([TeamRole::Facilitator, TeamRole::Member, TeamRole::Observer]);

it('answers 404 for someone outside the team and 422 for an unknown role', function () {
    $team = Team::factory()->create();
    $owner = teamMember($team, TeamRole::Owner);
    $outsider = teamMember(Team::factory()->for($team->workspace)->create());

    $this->actingAs($owner)
        ->put(route('teams.members.role.update', [$team->workspace, $team, $outsider]), ['role' => 'member'])
        ->assertNotFound();

    $this->actingAs($owner)
        ->put(route('teams.members.role.update', [$team->workspace, $team, teamMember($team)]), ['role' => 'captain'])
        ->assertSessionHasErrors('role');
});

it('adds a member with a role, member by default, and leaves an existing member as they are', function () {
    $team = Team::factory()->create();
    $owner = teamMember($team, TeamRole::Owner);
    $newcomer = workspaceManager($team->workspace, \App\Enums\WorkspaceRole::Member);
    $observer = workspaceManager($team->workspace, \App\Enums\WorkspaceRole::Member);
    $facilitator = teamMember($team, TeamRole::Facilitator);
    $route = route('teams.members.store', [$team->workspace, $team]);

    $this->actingAs($owner)->post($route, ['user_id' => $newcomer->id])->assertRedirect();
    $this->actingAs($owner)->post($route, ['user_id' => $observer->id, 'role' => 'observer'])->assertRedirect();
    $this->actingAs($owner)->post($route, ['user_id' => $facilitator->id, 'role' => 'observer'])->assertRedirect();

    expect($team->roleOf($newcomer))->toBe(TeamRole::Member)
        ->and($team->roleOf($observer))->toBe(TeamRole::Observer)
        ->and($team->roleOf($facilitator))->toBe(TeamRole::Facilitator);
});

it('sends each member with their role, and the role options to who manages members only', function () {
    $team = Team::factory()->create();
    $owner = teamMember($team, TeamRole::Owner);
    $observer = teamMember($team, TeamRole::Observer);

    $this->actingAs($owner)->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('viewerRole', 'owner')
            ->where('canManage', true)
            ->has('roleOptions', 4)
            ->where('members', fn ($members) => collect($members)->firstWhere('id', $observer->id)['role'] === 'observer'));

    $this->actingAs($observer)->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('viewerRole', 'observer')
            ->where('canManage', false)
            ->where('roleOptions', [])
            ->where('availableMembers', []));
});

it('lets a team owner rename the team and refuses them its deletion', function () {
    $team = Team::factory()->create();
    $owner = teamMember($team, TeamRole::Owner);

    $this->actingAs($owner)->patch(route('teams.update', [$team->workspace, $team]), ['name' => 'Renamed'])->assertRedirect();
    $this->actingAs($owner)->delete(route('teams.destroy', [$team->workspace, $team]))->assertForbidden();

    expect($team->fresh()->name)->toBe('Renamed');
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Teams/TeamPolicyMatrixTest.php tests/Feature/Teams/TeamMemberRolesTest.php`
Expected: FAIL (the matrix fails on `update` for owner; the route is not defined).

- [ ] **Step 3: Policy**

`app/Policies/TeamPolicy.php` becomes:

```php
<?php

namespace App\Policies;

use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;

class TeamPolicy
{
    public function view(User $user, Team $team): bool
    {
        if ($user->canManage($team->workspace)) {
            return true;
        }

        return $team->hasMember($user);
    }

    public function create(User $user, Workspace $workspace): bool
    {
        return $user->canManage($workspace);
    }

    public function update(User $user, Team $team): bool
    {
        return $user->managesTeam($team);
    }

    public function delete(User $user, Team $team): bool
    {
        return $user->canManage($team->workspace);
    }

    public function manageMembers(User $user, Team $team): bool
    {
        return $user->managesTeam($team);
    }

    public function manageRituals(User $user, Team $team): bool
    {
        return $user->managesRitualsOf($team);
    }

    /**
     * Make oneself the facilitator of an open session of the team (owner's decision 2 B).
     */
    public function takeControl(User $user, Team $team): bool
    {
        return $user->managesRitualsOf($team);
    }

    public function createRetro(User $user, Team $team): bool
    {
        return $this->takesPart($user, $team);
    }

    public function createPokerGame(User $user, Team $team): bool
    {
        return $this->takesPart($user, $team);
    }

    public function createWhiteboard(User $user, Team $team): bool
    {
        return $this->takesPart($user, $team);
    }

    public function createGameRoom(User $user, Team $team): bool
    {
        return $this->takesPart($user, $team);
    }

    public function createSurvey(User $user, Team $team): bool
    {
        return $this->takesPart($user, $team);
    }

    public function manageIntegrations(User $user, Team $team): bool
    {
        return $user->managesTeam($team);
    }

    private function takesPart(User $user, Team $team): bool
    {
        if (! $this->view($user, $team)) {
            return false;
        }

        return ! $user->isObserverOf($team);
    }
}
```

- [ ] **Step 4: Controllers and route**

`TeamMembersController::store` (import `App\Enums\TeamRole`):

```php
    public function store(Request $request, Workspace $workspace, Team $team): RedirectResponse
    {
        Gate::authorize('manageMembers', $team);

        $validated = $request->validate([
            'user_id' => [
                'required',
                'uuid',
                Rule::exists('workspace_user', 'user_id')->where('workspace_id', $workspace->id),
            ],
            'role' => ['nullable', Rule::enum(TeamRole::class)],
        ]);

        if ($team->members()->whereKey($validated['user_id'])->exists()) {
            return back();
        }

        $team->members()->attach($validated['user_id'], ['role' => $validated['role'] ?? TeamRole::Member->value]);

        return back();
    }
```

`app/Http/Controllers/TeamMemberRolesController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class TeamMemberRolesController extends Controller
{
    public function update(Request $request, Workspace $workspace, Team $team, User $member): RedirectResponse
    {
        Gate::authorize('manageMembers', $team);

        $validated = $request->validate([
            'role' => ['required', Rule::enum(TeamRole::class)],
        ]);

        DB::transaction(function () use ($team, $member, $validated): void {
            $locked = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

            $locked->members()->updateExistingPivot($member->id, ['role' => $validated['role']]);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Role changed.')]);

        return back();
    }
}
```

The team row is locked so that Task 8 can remove a demoted facilitator from the default list in the same transaction. `{member}` is bound through the scoped binding of the team scope (`Team::members()`), so a person outside the team is a 404, as on `teams.members.destroy`.

Route, beside the two member routes in `routes/web.php`:

```php
            Route::put('teams/{team}/members/{member}/role', [TeamMemberRolesController::class, 'update'])->name('teams.members.role.update')->whereUuid('member');
```

- [ ] **Step 5: Team page props and MCP**

In `TeamsController@show`: `$canManage` stays `can('manageMembers', $team)` (now true for an owner, so `availableMembers` is sent to owners too). The `members` map becomes:

```php
            'members' => Alphabetical::sort($team->members()->orderBy('users.id')->get(), fn (User $member): string => $member->name)
                ->map(fn (User $member): array => [
                    ...$member->only(['id', 'name', 'email']),
                    'avatarUrl' => $member->avatarUrl(),
                    'role' => $member->teamMembership->role->value,
                ]),
```

and the props array gains, at its end:

```php
            'roleOptions' => $canManage ? TeamRole::options() : [],
            'viewerRole' => $team->roleOf($request->user())?->value,
            'canManageRituals' => $request->user()->can('manageRituals', $team),
```

`app/Mcp/Tools/Retro/ListTeamMembers.php`: read it; in the presenter of each member add `'role' => $member->teamMembership->role->value` (members loaded through `$team->members()`), and add `role` to the tool's description ("owner, facilitator, member or observer"). Extend its existing test file (find it with `grep -rln "retro.team.members.list" tests`) with one assertion that the role is listed.

- [ ] **Step 5b: Access-request recipients (plan 29)**

The owner's answer to plan 29 sends access requests to the workspace's owners and admins "until plan 23". Plan 29 answers a request with `Gate::authorize('manageMembers', $team)`, so a team owner can already approve once Step 3 lands; the recipients follow the same rule. `tests/Feature/TeamAccessRequests/AccessRequestRecipientsTest.php`:

```php
<?php

use App\Actions\Teams\AccessRequestRecipients;
use App\Enums\TeamRole;
use App\Models\Team;

it('sends an access request to the workspace admins and the team owners only', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);
    $owner = teamMember($team, TeamRole::Owner);
    teamMember($team, TeamRole::Facilitator);
    teamMember($team);
    teamMember($team, TeamRole::Observer);
    teamMember(Team::factory()->for($team->workspace)->create(), TeamRole::Owner);

    $ids = resolve(AccessRequestRecipients::class)->for($team)->pluck('id')->sort()->values()->all();

    expect($ids)->toBe(collect([$admin->id, $owner->id])->sort()->values()->all());
});
```

`AccessRequestRecipients::for` (read it first; plan 29 may have changed its body) becomes the union, without duplicates, ordered by id:

```php
    public function for(Team $team): Collection
    {
        $managers = $team->workspace->members()
            ->wherePivotIn('role', [WorkspaceRole::Owner->value, WorkspaceRole::Admin->value])
            ->orderBy('users.id')
            ->get();
        $owners = $team->members()
            ->wherePivot('role', TeamRole::Owner->value)
            ->orderBy('users.id')
            ->get();

        return $managers->concat($owners)->unique('id')->sortBy('id')->values();
    }
```

Its docblock line "Team roles (plan 23) change this one place." becomes "The people who may approve the request: who manages the team's members." The plan 29 tests of the recipients pass unchanged (no team owner in their fixtures); list any that changed.

- [ ] **Step 6: Run the tests on PostgreSQL and SQLite**

Run: `bin/test-db pgsql -- tests/Feature/Teams tests/Feature/Integrations tests/Feature/Mcp tests/Feature/Workspaces tests/Feature/TeamAccessRequests`, then `sqlite`.
Expected: PASS. An existing test that asserted a team owner role could not exist is none; an existing test asserting a plain member gets 403 on integrations still passes (member is not owner).

- [ ] **Step 7: Commit** — `feat(teams): policies read the team role; owners manage their team; change a member's role; access requests reach team owners` (with the two trailer lines).

### Task 3: The observer follows sessions and changes nothing in them

**Files:**
- Create: `app/Http/Middleware/RefuseObserverWrites.php`
- Modify: `routes/web.php` (the five session groups), `app/Actions/Poker/ResolvePlayer.php`, `app/Http/Middleware/ResolvePokerPlayer.php`, the five snapshot builders (`BuildBoardSnapshot`, `BuildPokerSnapshot`, `BuildWhiteboardSnapshot`, `BuildGameSnapshot`, `BuildTeamSurveySnapshot`), `app/Actions/Retros/RetroGuard.php` is **not** touched
- Test: `tests/Feature/Teams/ObserverSessionsTest.php`

Read first: the five `Resolve*` middlewares (the request attribute each sets: `participant`, `pokerPlayer`, `whiteboardMember`, `gamePlayer`, `surveyRespondent`) and the five route groups of `routes/web.php` (`retros/{retro}`, `poker/{game}`, `whiteboards/{board}`, `surveys/{teamSurvey}`, `games/{room}`). Then list the non-read routes of each scope with `vendor/bin/sail artisan route:list --path=retros --except-vendor` (and `poker`, `whiteboards`, `surveys`, `games`) and check each `POST` is a change, not a read; write the list in the commit body. A `POST` that is only a read (none is known at `18d3637e`) is moved out of the refusal by name and listed.

**Interfaces:**
- Consumes: `User::isObserverOf(Team)` (Task 1); `SetPokerSpectator::handle(PokerGame $locked, PokerPlayer $target, bool $spectator)`.
- Produces: `RefuseObserverWrites`; every session snapshot carries `viewerIsObserver: bool`; the message key "Observers can follow this session but not take part.".

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Teams/ObserverSessionsTest.php`:

```php
<?php

use App\Enums\TeamRole;
use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Whiteboard;

const ObserverMessage = 'Observers can follow this session but not take part.';

/**
 * @return array{0: string, 1: string, 2: string} [write method, write url, snapshot url]
 */
function observedSession(Team $team, string $kind): array
{
    return match ($kind) {
        'retro' => (function () use ($team): array {
            $retro = Retro::factory()->for($team)->create();

            return ['postJson', route('retros.cards.store', $retro), route('retros.snapshot.show', $retro)];
        })(),
        'poker' => (function () use ($team): array {
            $game = PokerGame::factory()->for($team)->create();

            return ['postJson', route('poker.tasks.store', $game), route('poker.snapshot.show', $game)];
        })(),
        'whiteboard' => (function () use ($team): array {
            $board = Whiteboard::factory()->for($team)->create();

            return ['putJson', route('whiteboards.elements.update', $board), route('whiteboards.snapshot.show', $board)];
        })(),
        'game' => (function () use ($team): array {
            $room = GameRoom::factory()->for($team)->create(['name' => 'Warm-up']);

            return ['putJson', route('games.timer.update', $room), route('games.snapshot.show', $room)];
        })(),
        'survey' => (function () use ($team): array {
            $survey = TeamSurvey::factory()->for($team)->open()->create();

            return ['postJson', route('surveys.submission.store', $survey), route('surveys.snapshot.show', $survey)];
        })(),
    };
}

dataset('session kinds', ['retro', 'poker', 'whiteboard', 'game', 'survey']);

it('refuses every change an observer sends and lets them read', function (string $kind) {
    $team = Team::factory()->create();
    [$write, $url, $snapshot] = observedSession($team, $kind);
    $observer = teamMember($team, TeamRole::Observer);

    $this->actingAs($observer)->{$write}($url, [])
        ->assertForbidden()
        ->assertJsonPath('message', ObserverMessage);

    $this->actingAs($observer)->getJson($snapshot)
        ->assertOk()
        ->assertJsonPath('viewerIsObserver', true);
})->with('session kinds');

it('does not refuse a member, and tells them they are not an observer', function (string $kind) {
    $team = Team::factory()->create();
    [$write, $url, $snapshot] = observedSession($team, $kind);
    $member = teamMember($team);

    $response = $this->actingAs($member)->{$write}($url, []);

    expect($response->json('message'))->not->toBe(ObserverMessage);

    $this->actingAs($member)->getJson($snapshot)->assertJsonPath('viewerIsObserver', false);
})->with('session kinds');

it('never refuses a workspace admin whose team row says observer', function (string $kind) {
    $team = Team::factory()->create();
    [$write, $url] = observedSession($team, $kind);
    $admin = workspaceManager($team->workspace);
    $team->members()->attach($admin, ['role' => TeamRole::Observer->value]);

    expect($this->actingAs($admin)->{$write}($url, [])->json('message'))->not->toBe(ObserverMessage);
})->with('session kinds');

it('lets a facilitator who became an observer keep driving the retro they facilitate', function () {
    $team = Team::factory()->create();
    $retro = Retro::factory()->for($team)->create();
    [$user] = retroFacilitator($retro);
    $team->members()->updateExistingPivot($user->id, ['role' => TeamRole::Observer->value]);

    $this->actingAs($user)
        ->putJson(route('retros.timer.update', $retro), ['seconds' => 300])
        ->assertSuccessful();
});

it('leaves guests as they are', function () {
    $retro = Retro::factory()->create(['guest_access_enabled' => true]);
    $guest = \App\Models\Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $response = $this->withCookies(retroGuestCookie($guest))->postJson(route('retros.cards.store', $retro), []);

    expect($response->json('message'))->not->toBe(ObserverMessage);
});

it('makes an observer a spectator when they open a poker game, withdrawing an open vote', function () {
    $team = Team::factory()->create();
    $game = PokerGame::factory()->for($team)->create();
    [$user, $player] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $player, '5');
    $team->members()->updateExistingPivot($user->id, ['role' => TeamRole::Observer->value]);

    $this->actingAs($user)->get(route('poker.show', $game))->assertOk();

    expect($player->fresh()->is_spectator)->toBeTrue()
        ->and($round->votes()->count())->toBe(0);
});

it('lets an observer join a poker game as a spectator', function () {
    $team = Team::factory()->create();
    $game = PokerGame::factory()->for($team)->create();
    $observer = teamMember($team, TeamRole::Observer);

    $this->actingAs($observer)->get(route('poker.show', $game))->assertOk();

    expect(PokerPlayer::query()->where('poker_game_id', $game->id)->where('user_id', $observer->id)->value('is_spectator'))->toBeTruthy();
});
```

The helpers `retroFacilitator`, `retroGuestCookie`, `pokerMember`, `openPokerRound`, `pokerVote` exist in `tests/Pest.php`; read their signatures before running (adapt the destructuring and the guest factory state to them). The body of `retros.timer.update` is the one `RetroTimersController` validates (read it).

- [ ] **Step 2: Run them and see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Teams/ObserverSessionsTest.php`
Expected: FAIL, the observer's write is not refused with the message.

- [ ] **Step 3: The middleware**

`app/Http/Middleware/RefuseObserverWrites.php`:

```php
<?php

namespace App\Http\Middleware;

use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * An observer of a team follows its sessions and changes nothing in them, unless
 * they already facilitate the session. Runs after the middleware that resolves
 * who is in the session.
 */
class RefuseObserverWrites
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isMethodSafe()) {
            return $next($request);
        }

        $user = $request->user();
        $team = $this->team($request);

        if ($user === null || $team === null) {
            return $next($request);
        }

        if (! $user->isObserverOf($team)) {
            return $next($request);
        }

        if ($this->facilitates($request)) {
            return $next($request);
        }

        abort(403, __('Observers can follow this session but not take part.'));
    }

    private function team(Request $request): ?Team
    {
        foreach (['retro', 'game', 'board', 'room', 'teamSurvey'] as $parameter) {
            $session = $request->route($parameter);

            if ($session instanceof Retro || $session instanceof PokerGame || $session instanceof Whiteboard || $session instanceof GameRoom || $session instanceof TeamSurvey) {
                return $session->team;
            }
        }

        return null;
    }

    private function facilitates(Request $request): bool
    {
        $retro = $request->route('retro');
        $participant = $request->attributes->get('participant');

        if ($retro instanceof Retro && $participant instanceof Participant) {
            return $retro->isFacilitator($participant);
        }

        $game = $request->route('game');
        $player = $request->attributes->get('pokerPlayer');

        if ($game instanceof PokerGame && $player instanceof PokerPlayer) {
            return $game->isFacilitator($player);
        }

        $board = $request->route('board');
        $member = $request->attributes->get('whiteboardMember');

        if ($board instanceof Whiteboard && $member instanceof WhiteboardMember) {
            return $board->isFacilitator($member);
        }

        $room = $request->route('room');
        $gamePlayer = $request->attributes->get('gamePlayer');

        if ($room instanceof GameRoom && $gamePlayer instanceof GamePlayer) {
            return $room->isHost($gamePlayer);
        }

        $survey = $request->route('teamSurvey');
        $respondent = $request->attributes->get('surveyRespondent');

        if ($survey instanceof TeamSurvey && $respondent instanceof TeamSurveyRespondent) {
            return $survey->isEditor($respondent);
        }

        return false;
    }
}
```

In `routes/web.php`, each of the five groups lists it after its resolver, for example:

```php
Route::prefix('retros/{retro}')
    ->whereUuid('retro')
    ->middleware([ResolveRetroParticipant::class, RefuseObserverWrites::class])
```

and the same for `ResolvePokerPlayer`, `ResolveWhiteboardMember`, `ResolveSurveyRespondent`, `ResolveGamePlayer`.

- [ ] **Step 4: Poker spectators**

`Poker\ResolvePlayer::handle`, the member branch:

```php
        if ($user !== null && $user->can('view', $game->team)) {
            return PokerPlayer::query()->firstOrCreate(
                ['poker_game_id' => $game->id, 'user_id' => $user->id],
                ['is_spectator' => $user->isObserverOf($game->team)],
            );
        }
```

`ResolvePokerPlayer`: inject `SetPokerSpectator`; after the player is resolved and before `$request->attributes->set('pokerPlayer', $player)`, call:

```php
    /**
     * An observer watches: a player who became one stops playing the next time they open the game.
     */
    private function keepObserverWatching(Request $request, PokerGame $game, PokerPlayer $player): PokerPlayer
    {
        $user = $request->user();

        if ($user === null || $player->is_spectator || $game->isFacilitator($player)) {
            return $player;
        }

        if (! $user->isObserverOf($game->team)) {
            return $player;
        }

        DB::transaction(function () use ($game, $player): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            $this->setPokerSpectator->handle($locked, $player, true);
        });

        return $player->refresh();
    }
```

- [ ] **Step 5: `viewerIsObserver` in the five snapshots**

In each builder's returned array, one top-level key:

| Builder | Line to add |
|---|---|
| `BuildBoardSnapshot::handle(Retro $retro, Participant $viewer)` | `'viewerIsObserver' => $viewer->user?->isObserverOf($retro->team) ?? false,` |
| `BuildPokerSnapshot::handle(PokerGame $game, PokerPlayer $viewer)` | `'viewerIsObserver' => $viewer->user?->isObserverOf($game->team) ?? false,` |
| `BuildWhiteboardSnapshot::handle(Whiteboard $board, WhiteboardMember $viewer)` | `'viewerIsObserver' => $viewer->user?->isObserverOf($board->team) ?? false,` |
| `BuildGameSnapshot::handle(GameRoom $room, GamePlayer $viewer)` | `'viewerIsObserver' => $viewer->user?->isObserverOf($room->team) ?? false,` |
| `BuildTeamSurveySnapshot::handle(TeamSurvey $survey, TeamSurveyRespondent $viewer)` | `'viewerIsObserver' => $viewer->user?->isObserverOf($survey->team) ?? false,` |

A builder whose snapshot test compares the whole payload with `toBe` gets the key in its expected array (list each such test in the commit).

- [ ] **Step 6: Run the tests on PostgreSQL and SQLite**

Run: `bin/test-db pgsql -- tests/Feature/Teams/ObserverSessionsTest.php tests/Feature/Retros tests/Feature/Poker tests/Feature/Whiteboards tests/Feature/Games tests/Feature/TeamSurveys`, then `sqlite`.
Expected: PASS; the session suites pass unchanged (nobody in their fixtures is an observer).

- [ ] **Step 7: Commit** — `feat(teams): observers follow sessions read-only; poker makes them spectators` (trailer lines).

### Task 4: Observers — action items, MCP writes, participation

**Files:**
- Modify: `app/Actions/ActionItems/ActionItemPermissions.php`, `app/Mcp/Tools/SkrumTool.php` (`refuseObserver()`), the thirteen MCP write tools (`Retro/CreateAction`, `UpdateAction`, `CompleteAction`, `UpdateMessage`, `DeleteOwnMessage`, `PromoteSuggestion`, `RejectSuggestion`; `Poker/AddTasks`, `CreateGame`, `ImportTasks`, `RevealTask`, `SelectTask`, `SyncTask`), `app/Actions/Retros/BuildResults.php` (`stats`), `app/Models/TeamSurvey.php` (`audienceCount`, `participantCount`)
- Test: `tests/Feature/Teams/ObserverActionItemsTest.php`, `tests/Feature/Teams/ObserverParticipationTest.php`, one case per tool family in `tests/Feature/Mcp/ObserverWritesTest.php`

Read first: `ActionItemPermissions` (whole file), `SkrumTool::handle` (an `AuthorizationException` becomes the tool's error), each write tool's `run()` up to the line that resolves its retro, game or team through `McpContext`, `BuildResults::stats`, `TeamSurvey::audienceCount` and `participantCount`.

**Interfaces:**
- Consumes: `User::isObserverOf(Team)`.
- Produces: `SkrumTool::refuseObserver(Team $team): void` (protected).

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Teams/ObserverActionItemsTest.php`:

```php
<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemPermissions;
use App\Enums\TeamRole;
use App\Models\ActionItem;
use App\Models\Team;

it('refuses an observer action items, comments and completion', function () {
    $team = Team::factory()->create();
    $observer = teamMember($team, TeamRole::Observer);
    $item = ActionItem::factory()->for($team)->create(['assignee_user_id' => $observer->id]);
    $permissions = resolve(ActionItemPermissions::class);
    $actor = ActionItemActor::forUser($observer);

    expect($permissions->canCreateWithoutRetro($observer, $team))->toBeFalse()
        ->and($permissions->canComment($item, $actor))->toBeFalse()
        ->and($permissions->canComplete($item, $actor))->toBeFalse();
});

it('keeps a member able to do what they did before', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $item = ActionItem::factory()->for($team)->create(['assignee_user_id' => $member->id]);
    $permissions = resolve(ActionItemPermissions::class);
    $actor = ActionItemActor::forUser($member);

    expect($permissions->canCreateWithoutRetro($member, $team))->toBeTrue()
        ->and($permissions->canComment($item, $actor))->toBeTrue()
        ->and($permissions->canComplete($item, $actor))->toBeTrue();
});
```

`tests/Feature/Mcp/ObserverWritesTest.php` (use the MCP helpers of `tests/Pest.php`: `mcpWriter`, `mcpToolCallPayload`; read one existing write-tool test, e.g. the one of `retro.actions.create`, for the call shape):

```php
<?php

use App\Enums\TeamRole;
use App\Models\PokerGame;
use App\Models\Team;

it('refuses the write tools to an observer of the team', function (string $tool, Closure $arguments) {
    $team = Team::factory()->create();
    $observer = teamMember($team, TeamRole::Observer);

    $response = mcpWriter($observer, $team)->tool($tool, $arguments($team));

    $response->assertHasErrors(['Observers can follow this session but not take part.']);
})->with([
    'action item on a team' => ['retro.actions.create', fn (Team $team): array => ['team_id' => $team->id, 'content' => 'Ship it']],
    'poker game' => ['poker.games.create', fn (Team $team): array => ['team_id' => $team->id, 'title' => 'Refinement']],
    'poker tasks' => ['poker.tasks.add', fn (Team $team): array => ['game_id' => PokerGame::factory()->for($team)->create()->id, 'titles' => ['One']]],
]);
```

The tool names and argument names are read from each tool class (`$name`, `schema()`); fix them before running. `mcpWriter($user, $team)` and `->tool()` / `assertHasErrors` follow the existing MCP tests.

`tests/Feature/Teams/ObserverParticipationTest.php`:

```php
<?php

use App\Actions\Retros\BuildResults;
use App\Enums\RetroPhase;
use App\Enums\TeamRole;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;

it('counts observers neither among who joined nor among who was expected', function () {
    $team = Team::factory()->create();
    $retro = Retro::factory()->for($team)->create(['phase' => RetroPhase::Completed]);
    $member = teamMember($team);
    teamMember($team);
    $observer = teamMember($team, TeamRole::Observer);
    $viewer = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $member->id]);
    Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $observer->id]);
    Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $participation = resolve(BuildResults::class)->handle($retro->fresh(), $viewer)['stats']['participation'];

    expect($participation)->toBe(['participants' => 2, 'expected' => 3]);
});

it('leaves observers out of a survey audience', function () {
    $team = Team::factory()->create();
    $survey = TeamSurvey::factory()->for($team)->open()->create();
    teamMember($team);
    teamMember($team, TeamRole::Observer);

    expect($survey->fresh()->audienceCount())->toBe(1);
});
```

`BuildResults::handle(Retro $retro, Participant $viewer, ?array $surveys = null): ?array`; read where `stats` sits in its payload and adapt the path. Two members (one joined), one observer (joined), one guest: who joined = the member and the guest = 2; expected = 2 non-observer members + the guest = 3.

- [ ] **Step 2: Run them and see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Teams/ObserverActionItemsTest.php tests/Feature/Teams/ObserverParticipationTest.php tests/Feature/Mcp/ObserverWritesTest.php`
Expected: FAIL on the observer cases.

- [ ] **Step 3: Action item permissions**

In `ActionItemPermissions`:

```php
    public function canCreateWithoutRetro(User $user, Team $team): bool
    {
        if (! $team->hasMember($user)) {
            return false;
        }

        return ! $user->isObserverOf($team);
    }
```

`canComplete()` and `canComment()` start with:

```php
        if ($this->isObserver($item, $actor)) {
            return false;
        }
```

and the class gains:

```php
    private function isObserver(ActionItem $item, ActionItemActor $actor): bool
    {
        if ($actor->user === null) {
            return false;
        }

        return $actor->user->isObserverOf($item->team);
    }
```

- [ ] **Step 4: MCP**

`SkrumTool` gains (import `App\Models\Team`):

```php
    /**
     * An observer of a team reads through the tools and changes nothing.
     */
    protected function refuseObserver(Team $team): void
    {
        if (! McpGrant::current()->user->isObserverOf($team)) {
            return;
        }

        throw new AuthorizationException(__('Observers can follow this session but not take part.'));
    }
```

Each of the thirteen write tools calls `$this->refuseObserver($team)` right after the line that resolves the retro, game or team it writes to (`$this->refuseObserver($retro->team)`, `$this->refuseObserver($game->team)`, `$this->refuseObserver($team)`). Read `McpGrant::current()->user` in `SkrumTool` and `CreateAction` (it is the token's user).

- [ ] **Step 5: Participation**

`BuildResults::stats` (import `App\Enums\TeamRole`):

```php
    private function stats(Retro $retro): array
    {
        $observerIds = $retro->team->members()->wherePivot('role', TeamRole::Observer->value)->pluck('users.id');
        $teamMemberIds = $retro->team->members()->wherePivot('role', '!=', TeamRole::Observer->value)->pluck('users.id');
        $participants = $retro->participants->filter(fn (Participant $participant): bool => ! $observerIds->contains($participant->user_id));
        $participantCount = $participants->count();

        return [
            'votesCast' => $retro->votes()->count(),
            'votesAvailable' => $participantCount * $retro->voteLimit(),
            'participation' => [
                'participants' => $participantCount,
                'expected' => $teamMemberIds->count() + $participants->filter(fn (Participant $participant): bool => ! $teamMemberIds->contains($participant->user_id))->count(),
            ],
            'durationSeconds' => $this->durationSeconds($retro),
        ];
    }
```

`TeamSurvey::audienceCount()` and `participantCount()`: `$memberIds` becomes `$this->team->members()->wherePivot('role', '!=', TeamRole::Observer->value)->pluck('users.id')` in both.

- [ ] **Step 6: Run the tests on PostgreSQL and SQLite**

Run: `bin/test-db pgsql -- tests/Feature/Teams tests/Feature/ActionItems tests/Feature/Mcp tests/Feature/Retros tests/Feature/TeamSurveys`, then `sqlite`.
Expected: PASS; the results and survey tests pass unchanged (no observer in their fixtures).

- [ ] **Step 7: Commit** — `feat(teams): observers cannot write action items or MCP changes, and are not counted in participation` (trailer lines).

### Task 5: Take control of an open session (decision 2 B)

**Files:**
- Modify: `app/Http/Controllers/Retros/RetroFacilitatorsController.php` (a take-over beside the hand-over), `app/Http/Controllers/Games/GameHostsController.php` (`ensureCanTakeHosting`), `app/Actions/Retros/BuildBoardSnapshot.php` (`viewer.canTakeControl`), `app/Actions/Games/BuildGameSnapshot.php` (`canBecomeHost`)
- Test: `tests/Feature/Teams/TakeControlTest.php`

Read first: the four hand-over controllers (`Retros\RetroFacilitatorsController`, `Poker\PokerFacilitatorsController`, `Whiteboards\WhiteboardFacilitatorsController`, `Games\GameHostsController`; the poker and whiteboard ones already have `ensureTakesControl` for any non-guest team member, kept as they are), `RetroGuard::facilitator`, `BuildBoardSnapshot` (the `viewer` block, as plans 21 and 22 left it), `BuildGameSnapshot` (`$canTakeOver` also drives `canDelete`: do not widen deletion), the existing tests of the four endpoints (`grep -rln "retros.facilitator.update\|games.host.update\|poker.facilitator.update\|whiteboards.facilitator.update" tests`) and the helpers they use (`retroFacilitator`, the game room host helper of `tests/Pest.php`).

**Interfaces:**
- Consumes: `TeamPolicy::takeControl` (Task 2), `RefuseObserverWrites` (Task 3: an observer's take-over is refused before the controller).
- Produces: `PUT retros/{retro}/facilitator` accepts, from a participant who is not the facilitator, their own `user_id` when they may `takeControl` on the retro's team and the retro is not completed; retro snapshot `viewer.canTakeControl: bool`; `GameHostsController` lets a player who may `takeControl` take hosting; game snapshot `room.canBecomeHost` true for them. Task 23 reads `viewer.canTakeControl`.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Teams/TakeControlTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Enums\TeamRole;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;

/**
 * @return array{0: Retro, 1: User}
 */
function retroInProgress(Team $team, RetroPhase $phase = RetroPhase::Writing): array
{
    $retro = Retro::factory()->for($team)->create(['phase' => $phase]);
    [$facilitator] = retroFacilitator($retro);

    return [$retro, $facilitator];
}

function takeRetroControl(Retro $retro, User $user): \Illuminate\Testing\TestResponse
{
    Participant::query()->firstOrCreate(['retro_id' => $retro->id, 'user_id' => $user->id]);

    return test()->actingAs($user)->putJson(route('retros.facilitator.update', $retro), ['user_id' => $user->id]);
}

it('lets a team facilitator, a team owner and a workspace admin take control of an open retro', function (string $who) {
    $team = Team::factory()->create();
    [$retro] = retroInProgress($team);
    $taker = $who === 'admin' ? workspaceManager($team->workspace) : teamMember($team, TeamRole::from($who));

    takeRetroControl($retro, $taker)->assertNoContent();

    expect($retro->fresh()->facilitator->user_id)->toBe($taker->id);
})->with(['facilitator', 'owner', 'admin']);

it('refuses a retro take-over to a member, and to anyone on a completed retro', function () {
    $team = Team::factory()->create();
    [$open, $facilitator] = retroInProgress($team);
    [$closed] = retroInProgress($team, RetroPhase::Completed);

    takeRetroControl($open, teamMember($team))->assertForbidden();
    takeRetroControl($closed, teamMember($team, TeamRole::Facilitator))->assertForbidden();

    expect($open->fresh()->facilitator->user_id)->toBe($facilitator->id);
});

it('refuses to take control on behalf of someone else', function () {
    $team = Team::factory()->create();
    [$retro, $facilitator] = retroInProgress($team);
    $owner = teamMember($team, TeamRole::Owner);
    Participant::query()->firstOrCreate(['retro_id' => $retro->id, 'user_id' => $owner->id]);

    $this->actingAs($owner)
        ->putJson(route('retros.facilitator.update', $retro), ['user_id' => teamMember($team)->id])
        ->assertForbidden();

    expect($retro->fresh()->facilitator->user_id)->toBe($facilitator->id);
});

it('refuses a take-over to an observer, with the observer message', function () {
    $team = Team::factory()->create();
    [$retro] = retroInProgress($team);

    takeRetroControl($retro, teamMember($team, TeamRole::Observer))
        ->assertForbidden()
        ->assertJsonPath('message', 'Observers can follow this session but not take part.');
});

it('keeps the hand-over of the current facilitator as it is', function () {
    $team = Team::factory()->create();
    [$retro, $facilitator] = retroInProgress($team);
    $member = teamMember($team);

    $this->actingAs($facilitator)
        ->putJson(route('retros.facilitator.update', $retro), ['user_id' => $member->id])
        ->assertNoContent();

    expect($retro->fresh()->facilitator->user_id)->toBe($member->id);
});

it('tells the retro snapshot who may take control', function (?TeamRole $role, bool $canTakeControl) {
    $team = Team::factory()->create();
    [$retro, $facilitator] = retroInProgress($team);
    $viewer = $role === null ? $facilitator : teamMember($team, $role);
    Participant::query()->firstOrCreate(['retro_id' => $retro->id, 'user_id' => $viewer->id]);

    $this->actingAs($viewer)->getJson(route('retros.snapshot.show', $retro))
        ->assertJsonPath('viewer.canTakeControl', $canTakeControl);
})->with([
    'the facilitator themselves' => [null, false],
    'a team facilitator' => [TeamRole::Facilitator, true],
    'a team owner' => [TeamRole::Owner, true],
    'a member' => [TeamRole::Member, false],
    'an observer' => [TeamRole::Observer, false],
]);

it('lets a team facilitator take hosting of a game room, not a member, and gives neither the deletion', function () {
    $team = Team::factory()->create();
    $room = GameRoom::factory()->for($team)->create(['name' => 'Warm-up']);
    $facilitator = teamMember($team, TeamRole::Facilitator);
    $member = teamMember($team);
    $facilitatorPlayer = GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $facilitator->id]);
    $memberPlayer = GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $member->id]);

    $this->actingAs($member)->putJson(route('games.host.update', $room), ['player_id' => $memberPlayer->id])->assertForbidden();

    $this->actingAs($facilitator)->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('room.canBecomeHost', true)
        ->assertJsonPath('room.canDelete', false);

    $this->actingAs($facilitator)->putJson(route('games.host.update', $room), ['player_id' => $facilitatorPlayer->id])->assertNoContent();

    expect($room->fresh()->host_player_id)->toBe($facilitatorPlayer->id);
});

it('keeps "Take control" of poker games and whiteboards for every member, and refuses it to observers', function () {
    $team = Team::factory()->create();
    $game = PokerGame::factory()->for($team)->create();
    $board = Whiteboard::factory()->for($team)->create();
    $member = teamMember($team);
    $observer = teamMember($team, TeamRole::Observer);

    $this->actingAs($member)->get(route('poker.show', $game))->assertOk();
    $this->actingAs($member)->putJson(route('poker.facilitator.update', $game), ['user_id' => $member->id])->assertNoContent();

    $this->actingAs($member)->get(route('whiteboards.show', $board))->assertOk();
    $this->actingAs($member)->putJson(route('whiteboards.facilitator.update', $board), ['user_id' => $member->id])->assertNoContent();

    $this->actingAs($observer)->get(route('whiteboards.show', $board))->assertOk();
    $this->actingAs($observer)->putJson(route('whiteboards.facilitator.update', $board), ['user_id' => $observer->id])->assertForbidden();
});
```

Adapt to what the code holds: the factory states of `Retro`, `GameRoom` and `GamePlayer` (a standalone room may need its creator and host player: read `GameRoomFactory` and the existing host tests), the snapshot keys (`room.` or another block for the game room; read `BuildGameSnapshot`), and whether opening a poker game or a board creates the player or member (`ResolvePokerPlayer`, `ResolveWhiteboardMember`). The expectations do not change.

- [ ] **Step 2: Run them and see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Teams/TakeControlTest.php`
Expected: FAIL on the retro take-over (403 from `RetroGuard::facilitator`), on `viewer.canTakeControl` (missing) and on the facilitator's game room hosting.

- [ ] **Step 3: The retro take-over**

`RetroFacilitatorsController::update` follows the shape of `PokerFacilitatorsController`: the current facilitator hands over (unchanged rules), anyone else may only take control for themselves (imports `App\Enums\RetroPhase`, `Illuminate\Auth\Access\AuthorizationException`):

```php
    public function update(Request $request, Retro $retro): Response
    {
        $participant = Participant::current($request);

        if (! $retro->isFacilitator($participant) && ! $this->mayTakeControl($retro, $participant)) {
            RetroGuard::facilitator($retro, $participant);
        }

        $validated = $request->validate([
            'user_id' => ['required', 'uuid', 'exists:users,id'],
        ]);

        $user = User::query()->whereKey($validated['user_id'])->firstOrFail();

        DB::transaction(function () use ($retro, $participant, $user): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $locked->isFacilitator($participant)
                ? $this->ensureCanHandOver($locked, $user)
                : $this->ensureTakesControl($locked, $participant, $user);

            $newFacilitator = Participant::query()->firstOrCreate(['retro_id' => $locked->id, 'user_id' => $user->id]);

            $locked->update(['facilitator_participant_id' => $newFacilitator->id]);

            (new RetroSettingsChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }

    private function ensureCanHandOver(Retro $locked, User $user): void
    {
        if ($user->can('view', $locked->team)) {
            return;
        }

        throw ValidationException::withMessages(['user_id' => __('The facilitator must be a member of this team.')]);
    }

    /**
     * A team facilitator, owner or workspace admin may make themselves the facilitator
     * of an open retro (owner's decision 2 B); nobody else, and never for someone else.
     */
    private function ensureTakesControl(Retro $locked, Participant $participant, User $user): void
    {
        if ($participant->user_id !== $user->id || ! $this->mayTakeControl($locked, $participant)) {
            throw new AuthorizationException(__('Only the facilitator can do this.'));
        }
    }

    private function mayTakeControl(Retro $retro, Participant $participant): bool
    {
        if ($participant->isGuest() || $retro->phase === RetroPhase::Completed) {
            return false;
        }

        return $participant->user?->can('takeControl', $retro->team) ?? false;
    }
```

`RetroGuard::facilitator` keeps the existing 403 (and its message) for whoever may neither hand over nor take control, before the body is validated, as today. If plan 21 changed the hand-over (read the file), keep its changes and add only the take-over branch.

- [ ] **Step 4: Snapshots and game room hosting**

`BuildBoardSnapshot`, in the `viewer` block:

```php
                'canTakeControl' => ! $viewer->isGuest()
                    && ! $isFacilitator
                    && $retro->phase !== RetroPhase::Completed
                    && ($viewerParticipant->user?->can('takeControl', $retro->team) ?? false),
```

A snapshot test that compares the whole `viewer` block gains `canTakeControl` (list it in the commit).

`GameHostsController::ensureCanTakeHosting`, before the workspace admin check:

```php
        if ($player->account()?->can('takeControl', $room->team) ?? false) {
            return;
        }
```

(`takeControl` already answers true for workspace admins; keep the existing admin line for rooms whose team the admin cannot see through the policy, if any, or drop it and say so.) Its docblock gains "and the team's facilitators and owners".

`BuildGameSnapshot`: `canBecomeHost` reads a new `$canTakeHosting = $canTakeOver || ($viewer->account()?->can('takeControl', $room->team) ?? false);` — `canDelete` keeps `$canTakeOver` (the creator and admins only).

- [ ] **Step 5: Run the tests on PostgreSQL and SQLite**

Run: `bin/test-db pgsql -- tests/Feature/Teams/TakeControlTest.php tests/Feature/Retros tests/Feature/Games tests/Feature/Poker tests/Feature/Whiteboards`, then `sqlite`.
Expected: PASS; the existing hand-over tests pass unchanged (a member who is not the facilitator still gets 403 on the retro endpoint).

- [ ] **Step 6: Commit** — `feat(teams): team facilitators and owners take control of an open retro or game room` (trailer lines).

---

## Step B — back end in three lanes (cut from the head of Task 5)

### Task 6 (lane R): Sprints — table, calendar, readers (decision 1 B)

**Files:**
- Create: `database/migrations/2026_10_23_100100_add_rituals_to_teams_table.php`, `database/migrations/2026_10_23_100150_create_team_sprints_table.php`, `app/Models/TeamSprint.php`, `database/factories/TeamSprintFactory.php`, `app/Support/Teams/SprintCalendar.php`
- Modify: `app/Models/Team.php` (fillable, casts, docblock, `sprints()`, `DefaultSprintLengthWeeks`), `app/Http/Controllers/TeamsController.php` (`schedule`, `hasSprints`), `app/Actions/Teams/PresentNewSessionOptions.php` (plan 22: `currentSprintNumber`), `app/Actions/Teams/BuildTeamMoodTrend.php` (`sprintLabel` per point), `app/Actions/Retros/BuildBoardSnapshot.php` (`retro.sprintNumber`), `app/Http/Controllers/WorkspacesController.php` (`activity.openRetroSprint`), `tests/Pest.php` (`teamSprint()`)
- Test: `tests/Unit/Support/Teams/SprintCalendarTest.php`, `tests/Feature/Teams/TeamSprintLabelsTest.php`

Read first: `app/Casts/DateOnly.php` (a day stored as `Y-m-d`; rule 11), `ActionItem::today()` (the application's time zone), `app/Models/TeamHealthStatement.php` (a small team-owned model: attributes, `HasUuids`, factory), `BuildTeamMoodTrend::handle` (the two `get([...])` column lists and the point arrays; how many points it reads), `BuildBoardSnapshot::handle` (the `retro` block), `WorkspacesController::show` (`$openRetroTitles`), `PresentNewSessionOptions::handle` (plan 22).

**Interfaces:**
- Consumes: `TeamPolicy::manageRituals` (Task 2).
- Produces: table `team_sprints`; `TeamSprint` (`team_id`, `number`, `starts_on`, `ends_on`; `present(): array{id: string, number: int, startsOn: string, endsOn: string}`); `Team::sprints(): HasMany<TeamSprint>` ordered by `starts_on`, `id`; `Team::DefaultSprintLengthWeeks = 2`; columns `teams.sprint_length_weeks`, `retro_weekday`, `retro_time`, and for Task 8 `facilitator_rotation_enabled`, `rotation_position`; `SprintCalendar::forTeam(Team, CarbonInterface $from, ?CarbonInterface $to = null)`, `SprintCalendar::fromToday(Team, CarbonInterface $now)`, `SprintCalendar::ofRows(iterable<TeamSprint>, ?int $retroWeekday = null, ?string $retroTime = null)`, `sprintOn(CarbonInterface): ?Sprint`, `numberOn(CarbonInterface): ?int`, `shortLabelOn(CarbonInterface): ?string` ("S42"), `nextRetro(CarbonInterface): ?array{date: string, time: ?string}`, `static dayOf(CarbonInterface): string`; props `teams/show.schedule: {sprint: Sprint|null, nextRetro: NextRetro|null}|null`, `teams/show.hasSprints: bool`; dialog option `currentSprintNumber: ?int`; mood trend points `sprintLabel: ?string`; board snapshot `retro.sprintNumber: ?int`; workspace tiles `activity.openRetroSprint: ?int`; helper `teamSprint(Team $team, int $number, string $startsOn, string $endsOn): TeamSprint`. Task 7 writes the rows; a later grouping of action items by sprint reads `sprintOn`.

- [ ] **Step 1: Write the failing unit test**

`tests/Unit/Support/Teams/SprintCalendarTest.php` (pure: rows are arrays, the time zone is an argument, no application needed). The spec's example: sprint 41 runs 2026-09-07 to 2026-09-20, 42 runs 2026-09-21 to 2026-10-04, 43 runs 2026-10-05 to 2026-10-18, 44 runs 2026-10-19 to 2026-11-01, 45 runs 2026-11-02 to 2026-11-15. Thursday is ISO weekday 4.

```php
<?php

use App\Support\Teams\SprintCalendar;
use Carbon\CarbonImmutable;

/**
 * @param  array<int, int>  $numbers
 */
function atlasSprints(array $numbers = [41, 42, 43, 44, 45], string $timezone = 'UTC', ?int $retroWeekday = 4, ?string $retroTime = '14:00'): SprintCalendar
{
    $all = [
        41 => ['2026-09-07', '2026-09-20'],
        42 => ['2026-09-21', '2026-10-04'],
        43 => ['2026-10-05', '2026-10-18'],
        44 => ['2026-10-19', '2026-11-01'],
        45 => ['2026-11-02', '2026-11-15'],
    ];

    $rows = array_map(fn (int $number): array => ['id' => "sprint-{$number}", 'number' => $number, 'startsOn' => $all[$number][0], 'endsOn' => $all[$number][1]], $numbers);

    return new SprintCalendar($rows, $timezone, $retroWeekday, $retroTime);
}

it('finds the sprint that contains a moment', function (string $moment, ?int $number) {
    expect(atlasSprints()->numberOn(CarbonImmutable::parse($moment, 'UTC')))->toBe($number);
})->with([
    'first day' => ['2026-09-21 00:00', 42],
    'a Wednesday' => ['2026-09-30 10:00', 42],
    'last day' => ['2026-10-04 23:59', 42],
    'before every sprint' => ['2026-09-06 12:00', null],
]);

it('has no sprint between two sprints', function () {
    $calendar = atlasSprints([41, 43]);

    expect($calendar->sprintOn(CarbonImmutable::parse('2026-09-25 10:00', 'UTC')))->toBeNull()
        ->and($calendar->shortLabelOn(CarbonImmutable::parse('2026-09-25 10:00', 'UTC')))->toBeNull();
});

it('gives a sprint its days and a short label', function () {
    $wednesday = CarbonImmutable::parse('2026-09-30 10:00', 'UTC');

    expect(atlasSprints()->sprintOn($wednesday))->toBe(['id' => 'sprint-42', 'number' => 42, 'startsOn' => '2026-09-21', 'endsOn' => '2026-10-04'])
        ->and(atlasSprints()->shortLabelOn($wednesday))->toBe('S42');
});

it('reads the day in the application time zone across a daylight-saving change', function () {
    $lateSunday = CarbonImmutable::parse('2026-11-01 23:30', 'UTC');

    expect(atlasSprints(timezone: 'Europe/Paris')->numberOn($lateSunday))->toBe(45)
        ->and(atlasSprints(timezone: 'UTC')->numberOn($lateSunday))->toBe(44);
});

it('finds the next retro on the last retro weekday of the current sprint, else of the next one', function (string $now, ?array $expected) {
    expect(atlasSprints([42, 43])->nextRetro(CarbonImmutable::parse($now, 'UTC')))->toBe($expected);
})->with([
    'the day before' => ['2026-09-30 10:00', ['date' => '2026-10-01', 'time' => '14:00']],
    'the day itself, before the time' => ['2026-10-01 13:59', ['date' => '2026-10-01', 'time' => '14:00']],
    'the day itself, after the time' => ['2026-10-01 15:00', ['date' => '2026-10-15', 'time' => '14:00']],
    'the weekend after' => ['2026-10-03 09:00', ['date' => '2026-10-15', 'time' => '14:00']],
    'after the last sprint' => ['2026-10-19 09:00', null],
]);

it('has no next retro when the next sprint is not there yet', function () {
    expect(atlasSprints([42])->nextRetro(CarbonImmutable::parse('2026-10-01 15:00', 'UTC')))->toBeNull();
});

it('skips a sprint too short to hold the retro weekday', function () {
    $calendar = new SprintCalendar([
        ['id' => 'short', 'number' => 1, 'startsOn' => '2026-10-05', 'endsOn' => '2026-10-07'],
        ['id' => 'next', 'number' => 2, 'startsOn' => '2026-10-08', 'endsOn' => '2026-10-21'],
    ], 'UTC', 4, null);

    expect($calendar->nextRetro(CarbonImmutable::parse('2026-10-05 09:00', 'UTC')))->toBe(['date' => '2026-10-15', 'time' => null]);
});

it('keeps the retro day all day long without a time, and has none without a weekday', function () {
    expect(atlasSprints([42], retroTime: null)->nextRetro(CarbonImmutable::parse('2026-10-01 23:00', 'UTC')))->toBe(['date' => '2026-10-01', 'time' => null])
        ->and(atlasSprints([42], retroWeekday: null, retroTime: null)->nextRetro(CarbonImmutable::parse('2026-09-30 10:00', 'UTC')))->toBeNull();
});
```

Hand checks: the last Thursday of sprint 42 (ends Sunday 2026-10-04) is 2026-10-01; of sprint 43 (ends 2026-10-18) is 2026-10-15. The short sprint ends Wednesday 2026-10-07: its "last Thursday" would be 2026-10-01, before its first day, so it has none; the next sprint's last Thursday before 2026-10-21 is 2026-10-15. 2026-11-01 23:30 UTC is 2026-11-02 00:30 in Paris (winter time, UTC+1): the first day of sprint 45; in UTC it is still the last day of sprint 44.

- [ ] **Step 2: Run it and see it fail**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Support/Teams/SprintCalendarTest.php`
Expected: FAIL, `Class "App\Support\Teams\SprintCalendar" not found`.

- [ ] **Step 3: `SprintCalendar`**

```php
<?php

namespace App\Support\Teams;

use App\Models\Team;
use App\Models\TeamSprint;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * The sprints of a team, as stored rows, and the next retro they give with the team's retro day.
 * Days are read in the application's time zone; the sprint of a session is the sprint
 * that contains the day it was created.
 *
 * @phpstan-type Sprint array{id: string, number: int, startsOn: string, endsOn: string}
 * @phpstan-type NextRetro array{date: string, time: ?string}
 */
class SprintCalendar
{
    /**
     * @param  list<Sprint>  $sprints  ordered by their first day
     */
    public function __construct(
        private array $sprints,
        public string $timezone,
        public ?int $retroWeekday = null,
        public ?string $retroTime = null,
    ) {}

    /**
     * The team's sprints that share at least one day with the window.
     */
    public static function forTeam(Team $team, CarbonInterface $from, ?CarbonInterface $to = null): self
    {
        $rows = $team->sprints()
            ->where('ends_on', '>=', self::dayOf($from))
            ->where('starts_on', '<=', self::dayOf($to ?? $from))
            ->get();

        return self::ofRows($rows, $team->retro_weekday, $team->retro_time);
    }

    /**
     * The current sprint and the next one: enough for "Sprint 42 · Next retro …".
     */
    public static function fromToday(Team $team, CarbonInterface $now): self
    {
        $rows = $team->sprints()
            ->where('ends_on', '>=', self::dayOf($now))
            ->limit(2)
            ->get();

        return self::ofRows($rows, $team->retro_weekday, $team->retro_time);
    }

    /**
     * @param  iterable<TeamSprint>  $rows
     */
    public static function ofRows(iterable $rows, ?int $retroWeekday = null, ?string $retroTime = null): self
    {
        $sprints = [];

        foreach ($rows as $row) {
            $sprints[] = $row->present();
        }

        usort($sprints, fn (array $first, array $second): int => [$first['startsOn'], $first['id']] <=> [$second['startsOn'], $second['id']]);

        return new self($sprints, (string) config('app.timezone'), $retroWeekday, $retroTime);
    }

    public static function dayOf(CarbonInterface $moment): string
    {
        return CarbonImmutable::instance($moment)->setTimezone((string) config('app.timezone'))->toDateString();
    }

    /**
     * @return Sprint|null
     */
    public function sprintOn(CarbonInterface $moment): ?array
    {
        $day = CarbonImmutable::instance($moment)->setTimezone($this->timezone)->toDateString();

        foreach ($this->sprints as $sprint) {
            if ($sprint['startsOn'] <= $day && $day <= $sprint['endsOn']) {
                return $sprint;
            }
        }

        return null;
    }

    public function numberOn(CarbonInterface $moment): ?int
    {
        return $this->sprintOn($moment)['number'] ?? null;
    }

    public function shortLabelOn(CarbonInterface $moment): ?string
    {
        $number = $this->numberOn($moment);

        if ($number === null) {
            return null;
        }

        return "S{$number}";
    }

    /**
     * The last retro weekday of the first sprint, from today on, whose retro has not passed yet.
     *
     * @return NextRetro|null
     */
    public function nextRetro(CarbonInterface $now): ?array
    {
        if ($this->retroWeekday === null) {
            return null;
        }

        $local = CarbonImmutable::instance($now)->setTimezone($this->timezone);

        foreach ($this->sprints as $sprint) {
            $retroDay = $this->retroDayOf($sprint);

            if ($retroDay === null || $this->hasPassed($retroDay, $local)) {
                continue;
            }

            return ['date' => $retroDay->toDateString(), 'time' => $this->retroTime];
        }

        return null;
    }

    /**
     * @param  Sprint  $sprint
     */
    private function retroDayOf(array $sprint): ?CarbonImmutable
    {
        $firstDay = CarbonImmutable::parse($sprint['startsOn'], $this->timezone)->startOfDay();
        $lastDay = CarbonImmutable::parse($sprint['endsOn'], $this->timezone)->startOfDay();
        $retroDay = $lastDay->subDays(($lastDay->dayOfWeekIso - (int) $this->retroWeekday + 7) % 7);

        if ($retroDay->lessThan($firstDay)) {
            return null;
        }

        return $retroDay;
    }

    private function hasPassed(CarbonImmutable $retroDay, CarbonImmutable $now): bool
    {
        $today = $now->startOfDay();

        if ($retroDay->lessThan($today)) {
            return true;
        }

        if ($retroDay->greaterThan($today)) {
            return false;
        }

        if ($this->retroTime === null) {
            return false;
        }

        return $now->format('H:i') > $this->retroTime;
    }
}
```

`Y-m-d` strings compare as days; the rows come back from the database in any order and are sorted in PHP with the id as tie-breaker (rule 7). `fromToday` relies on the database order of `Team::sprints()` (`starts_on`, `id`) for its `limit(2)`: sprints never overlap (Task 7), so the first one ending today or later is the current one when there is one.

- [ ] **Step 4: Run the unit test** — `vendor/bin/sail artisan test --compact tests/Unit/Support/Teams/SprintCalendarTest.php` — Expected: PASS.

- [ ] **Step 5: Write the failing feature test**

`tests/Feature/Teams/TeamSprintLabelsTest.php`:

```php
<?php

use App\Actions\Teams\BuildTeamMoodTrend;
use App\Actions\Teams\PresentNewSessionOptions;
use App\Enums\RetroPhase;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

function atlasTeam(): Team
{
    $team = Team::factory()->create(['retro_weekday' => 4, 'retro_time' => '14:00']);
    teamSprint($team, 41, '2026-09-07', '2026-09-20');
    teamSprint($team, 42, '2026-09-21', '2026-10-04');
    teamSprint($team, 43, '2026-10-05', '2026-10-18');

    return $team;
}

it('shows the current sprint and the next retro on the team page', function () {
    $team = atlasTeam();
    $this->travelTo(CarbonImmutable::parse('2026-09-30 10:00', 'UTC'));

    $this->actingAs(teamMember($team))->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('schedule.sprint.number', 42)
            ->where('schedule.sprint.startsOn', '2026-09-21')
            ->where('schedule.nextRetro', ['date' => '2026-10-01', 'time' => '14:00'])
            ->where('hasSprints', true));
});

it('moves the next retro to the next sprint once the day has passed, and has none without a next sprint', function () {
    $team = atlasTeam();
    $this->travelTo(CarbonImmutable::parse('2026-10-01 15:00', 'UTC'));
    $page = fn () => $this->actingAs(teamMember($team))->get(route('teams.show', [$team->workspace, $team]));

    $page()->assertInertia(fn (Assert $page) => $page->where('schedule.nextRetro.date', '2026-10-15'));

    $team->sprints()->where('number', 43)->delete();

    $page()->assertInertia(fn (Assert $page) => $page->where('schedule.sprint.number', 42)->where('schedule.nextRetro', null));
});

it('sends no schedule before the first sprint, and says the team has none', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->where('schedule', null)->where('hasSprints', false));
});

it('labels a trend point, a retro header, a live retro tile and the new retro name with the sprint of the day', function () {
    $team = atlasTeam();
    $this->travelTo(CarbonImmutable::parse('2026-09-10 09:00', 'UTC'));
    $closed = Retro::factory()->for($team)->create(['phase' => RetroPhase::Completed, 'completed_at' => now()]);
    RotiVote::factory()->create(['retro_id' => $closed->id, 'score' => 4]);
    $this->travelTo(CarbonImmutable::parse('2026-09-30 09:00', 'UTC'));
    $open = Retro::factory()->for($team)->create();
    $member = teamMember($team);
    [$viewer] = retroMember($open);

    expect(resolve(BuildTeamMoodTrend::class)->handle($team)[0]['sprintLabel'])->toBe('S41')
        ->and(resolve(PresentNewSessionOptions::class)->handle($member, $team->workspace, $team)['currentSprintNumber'])->toBe(42);

    $this->actingAs($viewer)->getJson(route('retros.snapshot.show', $open))->assertJsonPath('retro.sprintNumber', 42);

    $this->actingAs($member)->get(route('workspaces.show', $team->workspace))
        ->assertInertia(fn (Assert $page) => $page->where('teams.0.activity.openRetroSprint', 42));
});

it('gives no label to a retro created between two sprints', function () {
    $team = Team::factory()->create();
    teamSprint($team, 41, '2026-09-07', '2026-09-20');
    $this->travelTo(CarbonImmutable::parse('2026-09-25 09:00', 'UTC'));
    $retro = Retro::factory()->for($team)->create();
    [$viewer] = retroMember($retro);

    $this->actingAs($viewer)->getJson(route('retros.snapshot.show', $retro))->assertJsonPath('retro.sprintNumber', null);
});
```

Read `RotiVote`'s factory (its participant column) and adapt; the mood trend needs one ROTI vote for a completed retro to make a point (read `BuildTeamMoodTrend`). `retroMember` returns `[User, Participant]` in `tests/Pest.php` (check).

- [ ] **Step 6: Migrations, model, factory, helper**

`database/migrations/2026_10_23_100100_add_rituals_to_teams_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            $table->unsignedTinyInteger('sprint_length_weeks')->nullable();
            $table->unsignedTinyInteger('retro_weekday')->nullable();
            $table->string('retro_time', 5)->nullable();
            $table->boolean('facilitator_rotation_enabled')->default(false);
            $table->unsignedInteger('rotation_position')->default(0);
        });
    }
};
```

`database/migrations/2026_10_23_100150_create_team_sprints_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_sprints', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('number');
            $table->date('starts_on');
            $table->date('ends_on');
            $table->timestamps();

            $table->unique(['team_id', 'number']);
            $table->index(['team_id', 'starts_on']);
        });
    }
};
```

`app/Models/TeamSprint.php` (create with `vendor/bin/sail artisan make:model TeamSprint --factory --no-interaction`, then shape it as `TeamHealthStatement`):

```php
<?php

namespace App\Models;

use App\Casts\DateOnly;
use Carbon\CarbonInterface;
use Database\Factories\TeamSprintFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $team_id
 * @property int $number
 * @property CarbonInterface $starts_on
 * @property CarbonInterface $ends_on
 * @property-read Team $team
 */
#[Fillable(['number', 'starts_on', 'ends_on'])]
class TeamSprint extends Model
{
    /** @use HasFactory<TeamSprintFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * @return array{id: string, number: int, startsOn: string, endsOn: string}
     */
    public function present(): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'startsOn' => $this->starts_on->toDateString(),
            'endsOn' => $this->ends_on->toDateString(),
        ];
    }

    protected function casts(): array
    {
        return [
            'number' => 'integer',
            'starts_on' => DateOnly::class,
            'ends_on' => DateOnly::class,
        ];
    }
}
```

`TeamSprintFactory::definition()`: `team_id` → `Team::factory()`, `number` → `fake()->unique()->numberBetween(1, 9999)`, `starts_on` → `'2026-09-21'`, `ends_on` → `'2026-10-04'`.

`Team`: the five new columns join `#[Fillable]`; the docblock lists them (`@property int|null $sprint_length_weeks`, `@property int|null $retro_weekday`, `@property string|null $retro_time`, `@property bool $facilitator_rotation_enabled`, `@property int $rotation_position`); `public const int DefaultSprintLengthWeeks = 2;`; `casts()`:

```php
    protected function casts(): array
    {
        return [
            'sprint_length_weeks' => 'integer',
            'retro_weekday' => 'integer',
            'facilitator_rotation_enabled' => 'boolean',
            'rotation_position' => 'integer',
        ];
    }

    /** @return HasMany<TeamSprint, $this> */
    public function sprints(): HasMany
    {
        return $this->hasMany(TeamSprint::class)->orderBy('starts_on')->orderBy('id');
    }
```

`tests/Pest.php`, in lane R's block:

```php
function teamSprint(Team $team, int $number, string $startsOn, string $endsOn): TeamSprint
{
    return $team->sprints()->create(['number' => $number, 'starts_on' => $startsOn, 'ends_on' => $endsOn]);
}
```

- [ ] **Step 7: Readers**

`TeamsController@show` props gain `'schedule' => $this->schedule($team),` and `'hasSprints' => $team->sprints()->exists(),`, and the class:

```php
    /**
     * @return array{
     *     sprint: array{id: string, number: int, startsOn: string, endsOn: string}|null,
     *     nextRetro: array{date: string, time: ?string}|null
     * }|null
     */
    private function schedule(Team $team): ?array
    {
        $calendar = SprintCalendar::fromToday($team, now());
        $sprint = $calendar->sprintOn(now());
        $nextRetro = $calendar->nextRetro(now());

        if ($sprint === null && $nextRetro === null) {
            return null;
        }

        return ['sprint' => $sprint, 'nextRetro' => $nextRetro];
    }
```

`PresentNewSessionOptions::handle` (plan 22), at the end of its array (lane R's block): `'currentSprintNumber' => SprintCalendar::forTeam($team, now())->numberOn(now()),`. Its test comparing the exact key list (plan 22's `NewSessionOptionsTest`) gains the key; list it in the commit.

`BuildTeamMoodTrend::handle`: the retro query selects `['id', 'title', 'completed_at', 'created_at']` (and the survey query its `created_at`); once the points are read, `$calendar = SprintCalendar::forTeam($team, $oldestCreatedAt, $newestCreatedAt)` (skip it when there is no point); each point gains `'sprintLabel' => $calendar?->shortLabelOn($retro->created_at),` and each survey point the same with `$survey->created_at`. The existing tests that compare whole points (`TeamMoodTrendTest`) gain `'sprintLabel' => null` in their expected arrays (listed in the commit).

`BuildBoardSnapshot::handle`, in the `retro` block: `'sprintNumber' => SprintCalendar::forTeam($retro->team, $retro->created_at)->numberOn($retro->created_at),`.

`WorkspacesController::show`: the open retros query reads `->get(['id', 'team_id', 'title', 'created_at'])` and keeps the rows (`->unique('team_id')->keyBy('team_id')`); one query reads the sprints of those teams around those days (a bounded set: the visible teams' sprints that contain one of the open retros' days):

```php
        $openRetroDays = $openRetros->map(fn (Retro $retro): string => SprintCalendar::dayOf($retro->created_at));
        $sprintsByTeam = $openRetros->isEmpty()
            ? collect()
            : TeamSprint::query()
                ->whereIn('team_id', $openRetros->keys())
                ->where('starts_on', '<=', $openRetroDays->max())
                ->where('ends_on', '>=', $openRetroDays->min())
                ->get()
                ->groupBy('team_id');
```

and the tile's `activity` gains, with `$openRetro = $openRetros->get($team->id)`:

```php
                    'openRetroTitle' => $openRetro?->title,
                    'openRetroSprint' => $openRetro === null ? null : SprintCalendar::ofRows($sprintsByTeam->get($team->id, collect()))->numberOn($openRetro->created_at),
```

- [ ] **Step 8: Run the tests on PostgreSQL and SQLite**

Run: `bin/test-db pgsql -- tests/Unit/Support/Teams tests/Feature/Teams tests/Feature/Workspaces tests/Feature/Sessions tests/Feature/Retros/BoardSnapshotTest.php`, then `sqlite` (find the board snapshot test file with `grep -rln "retros.snapshot.show" tests/Feature/Retros | head -3`).
Expected: PASS.

- [ ] **Step 9: Commit** — `feat(teams): explicit sprints; the current sprint and the next retro read from them` (trailer lines).

### Task 7 (lane R): Sprints — add, edit, delete, start the next sprint, retro day (decision 1 B)

**Files:**
- Create: `app/Actions/Teams/StartNextSprint.php`, `app/Http/Requests/Teams/TeamSprintRequest.php`, `TeamRitualsRequest.php`, `app/Http/Controllers/TeamSprintsController.php`, `TeamSprintStartsController.php`, `TeamRitualsController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/Teams/TeamSprintsTest.php`, `tests/Concurrency/TeamSprintStartsTest.php`

Read first: Task 6's `TeamSprint`, `Team::sprints()`, `SprintCalendar::dayOf`; `tests/Concurrency/WorkspaceTemplateLimitsTest.php` (the `Race::request` shape); `App\Support\Database\Transactions`.

**Interfaces:**
- Consumes: Task 6.
- Produces: routes `teams.sprints.store` (`POST`, body `number`, `starts_on`, `ends_on`), `teams.sprints.update` (`PATCH …/sprints/{sprint}`), `teams.sprints.destroy` (`DELETE …/sprints/{sprint}`), `teams.sprintStarts.store` (`POST …/sprint-starts`, no body), `teams.rituals.update` (`PUT …/rituals`, body `sprint_length_weeks`, `retro_weekday`, `retro_time`); `StartNextSprint::handle(Team $team, CarbonInterface $now): TeamSprint`, `StartNextSprint::preview(Team $team, CarbonInterface $now): array{number: int, startsOn: string, endsOn: string, refusal: ?string}` (read by Task 16 for the card's preview line and the disabled reason).

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Teams/TeamSprintsTest.php`:

```php
<?php

use App\Enums\TeamRole;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSprint;
use Carbon\CarbonImmutable;

function sprintBody(array $override = []): array
{
    return ['number' => 42, 'starts_on' => '2026-09-21', 'ends_on' => '2026-10-04', ...$override];
}

it('lets a facilitator add a sprint and refuses a member', function () {
    $team = Team::factory()->create();
    $route = route('teams.sprints.store', [$team->workspace, $team]);

    $this->actingAs(teamMember($team))->post($route, sprintBody())->assertForbidden();
    $this->actingAs(teamMember($team, TeamRole::Facilitator))->post($route, sprintBody())->assertRedirect();

    expect($team->sprints()->sole()->present())->toMatchArray(['number' => 42, 'startsOn' => '2026-09-21', 'endsOn' => '2026-10-04']);
});

it('validates a sprint', function (array $override, string $field) {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team, TeamRole::Owner))
        ->post(route('teams.sprints.store', [$team->workspace, $team]), sprintBody($override))
        ->assertSessionHasErrors($field);
})->with([
    'number zero' => [['number' => 0], 'number'],
    'not a day' => [['starts_on' => '21/09/2026'], 'starts_on'],
    'ends before it starts' => [['ends_on' => '2026-09-20'], 'ends_on'],
    'longer than eight weeks' => [['ends_on' => '2026-11-16'], 'ends_on'],
]);

it('refuses a sprint that overlaps another or reuses its number, and lets a sprint keep its own days', function () {
    $team = Team::factory()->create();
    $owner = teamMember($team, TeamRole::Owner);
    $sprint = teamSprint($team, 42, '2026-09-21', '2026-10-04');
    $store = route('teams.sprints.store', [$team->workspace, $team]);

    $this->actingAs($owner)->post($store, sprintBody(['number' => 43, 'starts_on' => '2026-10-04', 'ends_on' => '2026-10-17']))->assertSessionHasErrors('starts_on');
    $this->actingAs($owner)->post($store, sprintBody(['starts_on' => '2026-10-05', 'ends_on' => '2026-10-18']))->assertSessionHasErrors('number');
    $this->actingAs($owner)->patch(route('teams.sprints.update', [$team->workspace, $team, $sprint]), sprintBody(['ends_on' => '2026-10-03']))->assertRedirect();

    expect($team->sprints()->count())->toBe(1)
        ->and($sprint->fresh()->ends_on->toDateString())->toBe('2026-10-03');
});

it('answers 404 for a sprint of another team', function () {
    $team = Team::factory()->create();
    $other = teamSprint(Team::factory()->for($team->workspace)->create(), 1, '2026-09-21', '2026-10-04');

    $this->actingAs(teamMember($team, TeamRole::Owner))
        ->delete(route('teams.sprints.destroy', [$team->workspace, $team, $other]))
        ->assertNotFound();
});

it('deletes a sprint, and the sessions of its days lose its label and nothing else', function () {
    $team = Team::factory()->create();
    $sprint = teamSprint($team, 42, '2026-09-21', '2026-10-04');
    $this->travelTo(CarbonImmutable::parse('2026-09-30 10:00', 'UTC'));
    $retro = Retro::factory()->for($team)->create();
    [$viewer] = retroMember($retro);

    $this->actingAs(teamMember($team, TeamRole::Facilitator))->delete(route('teams.sprints.destroy', [$team->workspace, $team, $sprint]))->assertRedirect();

    expect(TeamSprint::query()->count())->toBe(0)->and($retro->fresh())->not->toBeNull();
    $this->actingAs($viewer)->getJson(route('retros.snapshot.show', $retro))->assertJsonPath('retro.sprintNumber', null);
});

it('starts the next sprint today, ending the current one yesterday', function () {
    $team = Team::factory()->create();
    teamSprint($team, 42, '2026-09-21', '2026-10-04');
    $this->travelTo(CarbonImmutable::parse('2026-09-30 10:00', 'UTC'));

    $this->actingAs(teamMember($team, TeamRole::Facilitator))
        ->post(route('teams.sprintStarts.store', [$team->workspace, $team]))
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect($team->sprints()->get()->map->present()->map(fn (array $sprint): array => [$sprint['number'], $sprint['startsOn'], $sprint['endsOn']])->all())
        ->toBe([[42, '2026-09-21', '2026-09-29'], [43, '2026-09-30', '2026-10-13']]);
});

it('starts sprint 1 of a team without sprints, with the team default length', function () {
    $team = Team::factory()->create(['sprint_length_weeks' => 1]);
    $this->travelTo(CarbonImmutable::parse('2026-09-30 10:00', 'UTC'));

    $this->actingAs(teamMember($team, TeamRole::Owner))->post(route('teams.sprintStarts.store', [$team->workspace, $team]))->assertRedirect();

    expect($team->sprints()->sole()->present())->toMatchArray(['number' => 1, 'startsOn' => '2026-09-30', 'endsOn' => '2026-10-06']);
});

it('refuses to start a sprint when one starts today or one is planned', function (string $startsOn) {
    $team = Team::factory()->create();
    teamSprint($team, 44, $startsOn, '2026-11-01');
    $this->travelTo(CarbonImmutable::parse('2026-09-30 10:00', 'UTC'));

    $this->actingAs(teamMember($team, TeamRole::Owner))
        ->post(route('teams.sprintStarts.store', [$team->workspace, $team]))
        ->assertSessionHasErrors('sprint');

    expect($team->sprints()->count())->toBe(1);
})->with(['starts today' => ['2026-09-30'], 'planned' => ['2026-10-19']]);

it('previews the next start and its refusal', function () {
    $team = Team::factory()->create();
    teamSprint($team, 42, '2026-09-21', '2026-10-04');
    $start = resolve(\App\Actions\Teams\StartNextSprint::class);

    expect($start->preview($team, CarbonImmutable::parse('2026-09-30 10:00', 'UTC')))
        ->toBe(['number' => 43, 'startsOn' => '2026-09-30', 'endsOn' => '2026-10-13', 'refusal' => null])
        ->and($start->preview($team, CarbonImmutable::parse('2026-09-21 10:00', 'UTC'))['refusal'])->toBe('Sprint 42 already starts today.');
});

it('saves the default length, the retro day and its time, and validates them', function () {
    $team = Team::factory()->create();
    $route = route('teams.rituals.update', [$team->workspace, $team]);
    $facilitator = teamMember($team, TeamRole::Facilitator);

    $this->actingAs(teamMember($team))->put($route, ['sprint_length_weeks' => 2])->assertForbidden();
    $this->actingAs($facilitator)->put($route, ['sprint_length_weeks' => 5])->assertSessionHasErrors('sprint_length_weeks');
    $this->actingAs($facilitator)->put($route, ['retro_weekday' => null, 'retro_time' => '14:00'])->assertSessionHasErrors('retro_time');
    $this->actingAs($facilitator)->put($route, ['retro_weekday' => 8])->assertSessionHasErrors('retro_weekday');
    $this->actingAs($facilitator)->put($route, ['sprint_length_weeks' => 3, 'retro_weekday' => 4, 'retro_time' => '14:00'])->assertRedirect();

    expect($team->fresh()->only(['sprint_length_weeks', 'retro_weekday', 'retro_time']))
        ->toBe(['sprint_length_weeks' => 3, 'retro_weekday' => 4, 'retro_time' => '14:00']);
});
```

`tests/Concurrency/TeamSprintStartsTest.php`:

```php
<?php

use App\Enums\TeamRole;
use App\Models\Team;
use Tests\Concurrency\Support\Race;

it('creates one sprint when two people start the next sprint at the same moment (the team row lock)', function () {
    $team = Team::factory()->create();
    teamSprint($team, 42, now()->subDays(9)->toDateString(), now()->addDays(4)->toDateString());
    $ownerId = teamMember($team, TeamRole::Owner)->id;
    $facilitatorId = teamMember($team, TeamRole::Facilitator)->id;
    $uri = route('teams.sprintStarts.store', [$team->workspace, $team], false);

    $results = Race::run([
        static fn (): int => Race::request($ownerId, 'POST', $uri),
        static fn (): int => Race::request($facilitatorId, 'POST', $uri),
    ]);

    expect(array_column($results, 'value'))->toEqual([302, 302])
        ->and($team->sprints()->pluck('number')->all())->toBe([42, 43])
        ->and($team->sprints()->where('number', 42)->value('ends_on'))->not->toBeNull();
});
```

Without the lock, both requests read "no sprint starts today", both cut sprint 42 and both insert number 43: the unique index `(team_id, number)` refuses the second with a 500, so the results are not `[302, 302]`. Read `Race::request`'s signature (the body argument may be required: pass `[]`).

- [ ] **Step 2: Run them and see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Teams/TeamSprintsTest.php`
Expected: FAIL, the routes are not defined.

- [ ] **Step 3: `StartNextSprint`**

```php
<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Models\TeamSprint;
use App\Support\Database\Transactions;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StartNextSprint
{
    public const int MaxNumber = 9999;

    /**
     * Starts a sprint today, ending the current one yesterday (spec §6.3, rule 3).
     */
    public function handle(Team $team, CarbonInterface $now): TeamSprint
    {
        return DB::transaction(function () use ($team, $now): TeamSprint {
            $locked = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();
            $next = $this->preview($locked, $now);

            if ($next['refusal'] !== null) {
                throw ValidationException::withMessages(['sprint' => $next['refusal']]);
            }

            $today = $this->today($now);

            $locked->sprints()
                ->where('starts_on', '<', $today->toDateString())
                ->where('ends_on', '>=', $today->toDateString())
                ->first()
                ?->update(['ends_on' => $today->subDay()->toDateString()]);

            return $locked->sprints()->create([
                'number' => $next['number'],
                'starts_on' => $next['startsOn'],
                'ends_on' => $next['endsOn'],
            ]);
        }, Transactions::Attempts);
    }

    /**
     * What "Start the next sprint" would create now, or why it is refused.
     *
     * @return array{number: int, startsOn: string, endsOn: string, refusal: ?string}
     */
    public function preview(Team $team, CarbonInterface $now): array
    {
        $today = $this->today($now);
        $length = $team->sprint_length_weeks ?? Team::DefaultSprintLengthWeeks;
        $number = ((int) $team->sprints()->max('number')) + 1;

        return [
            'number' => $number,
            'startsOn' => $today->toDateString(),
            'endsOn' => $today->addDays(7 * $length - 1)->toDateString(),
            'refusal' => $this->refusal($team, $today, $number),
        ];
    }

    private function refusal(Team $team, CarbonImmutable $today, int $number): ?string
    {
        $later = $team->sprints()->where('starts_on', '>=', $today->toDateString())->first();

        if ($later !== null && $later->starts_on->toDateString() === $today->toDateString()) {
            return __('Sprint :number already starts today.', ['number' => $later->number]);
        }

        if ($later !== null) {
            return __('Sprint :number is already planned from :date.', ['number' => $later->number, 'date' => $later->starts_on->isoFormat('D MMM')]);
        }

        if ($number > self::MaxNumber) {
            return __('Sprint numbers stop at :max.', ['max' => self::MaxNumber]);
        }

        return null;
    }

    private function today(CarbonInterface $now): CarbonImmutable
    {
        return CarbonImmutable::instance($now)->setTimezone((string) config('app.timezone'))->startOfDay();
    }
}
```

The transaction touches the database only (rule 6: retried with `Transactions::Attempts`). The preview reads the same rules as the start, so the card and the server never disagree; inside `handle` it runs under the lock.

- [ ] **Step 4: Requests, controllers, routes**

`app/Http/Requests/Teams/TeamSprintRequest.php`:

```php
<?php

namespace App\Http\Requests\Teams;

use App\Models\Team;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class TeamSprintRequest extends FormRequest
{
    public const int MaxDays = 56;

    public function authorize(): bool
    {
        $team = $this->route('team');

        return $team instanceof Team && ($this->user()?->can('manageRituals', $team) ?? false);
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'number' => ['required', 'integer', 'min:1', 'max:9999'],
            'starts_on' => ['required', 'date_format:Y-m-d'],
            'ends_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:starts_on'],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $days = CarbonImmutable::parse((string) $this->input('starts_on'))->diffInDays(CarbonImmutable::parse((string) $this->input('ends_on'))) + 1;

                if ($days > self::MaxDays) {
                    $validator->errors()->add('ends_on', __('A sprint lasts at most eight weeks.'));
                }
            },
        ];
    }

    /**
     * @return array{number: int, starts_on: string, ends_on: string}
     */
    public function sprint(): array
    {
        return [
            'number' => (int) $this->validated('number'),
            'starts_on' => (string) $this->validated('starts_on'),
            'ends_on' => (string) $this->validated('ends_on'),
        ];
    }
}
```

`app/Http/Requests/Teams/TeamRitualsRequest.php`: `authorize()` as above; rules `'sprint_length_weeks' => ['nullable', 'integer', 'min:1', 'max:4']`, `'retro_weekday' => ['nullable', 'integer', 'min:1', 'max:7']`, `'retro_time' => ['nullable', 'date_format:H:i', Rule::prohibitedIf(fn (): bool => $this->input('retro_weekday') === null)]`; `rituals(): array{sprint_length_weeks: ?int, retro_weekday: ?int, retro_time: ?string}` casting each.

`app/Http/Controllers/TeamSprintsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Http\Requests\Teams\TeamSprintRequest;
use App\Models\Team;
use App\Models\TeamSprint;
use App\Models\Workspace;
use App\Support\Database\Transactions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class TeamSprintsController extends Controller
{
    public function store(TeamSprintRequest $request, Workspace $workspace, Team $team): RedirectResponse
    {
        $this->save($team, null, $request->sprint());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Sprint added.')]);

        return back();
    }

    public function update(TeamSprintRequest $request, Workspace $workspace, Team $team, TeamSprint $sprint): RedirectResponse
    {
        $this->save($team, $sprint, $request->sprint());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Sprint saved.')]);

        return back();
    }

    public function destroy(Workspace $workspace, Team $team, TeamSprint $sprint): RedirectResponse
    {
        Gate::authorize('manageRituals', $team);

        $sprint->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Sprint deleted.')]);

        return back();
    }

    /**
     * Number and days are checked under the team's lock, so that two saves never
     * leave two sprints sharing a number or a day (spec §6.3, rules 1 and 2).
     *
     * @param  array{number: int, starts_on: string, ends_on: string}  $attributes
     */
    private function save(Team $team, ?TeamSprint $sprint, array $attributes): void
    {
        DB::transaction(function () use ($team, $sprint, $attributes): void {
            $locked = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();
            $others = fn (): Builder => TeamSprint::query()
                ->where('team_id', $locked->id)
                ->when($sprint !== null, fn (Builder $query) => $query->whereKeyNot($sprint?->id));

            if ($others()->where('number', $attributes['number'])->exists()) {
                throw ValidationException::withMessages(['number' => __('Sprint :number already exists.', ['number' => $attributes['number']])]);
            }

            $overlap = $others()
                ->where('starts_on', '<=', $attributes['ends_on'])
                ->where('ends_on', '>=', $attributes['starts_on'])
                ->orderBy('starts_on')
                ->orderBy('id')
                ->first();

            if ($overlap !== null) {
                throw ValidationException::withMessages(['starts_on' => __('This sprint overlaps Sprint :number (:start – :end).', [
                    'number' => $overlap->number,
                    'start' => $overlap->starts_on->isoFormat('D MMM'),
                    'end' => $overlap->ends_on->isoFormat('D MMM'),
                ])]);
            }

            if ($sprint === null) {
                $locked->sprints()->create($attributes);

                return;
            }

            $sprint->update($attributes);
        }, Transactions::Attempts);
    }
}
```

`app/Http/Controllers/TeamSprintStartsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Teams\StartNextSprint;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class TeamSprintStartsController extends Controller
{
    public function store(Workspace $workspace, Team $team, StartNextSprint $startNextSprint): RedirectResponse
    {
        Gate::authorize('manageRituals', $team);

        $sprint = $startNextSprint->handle($team, now());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Sprint :number started.', ['number' => $sprint->number])]);

        return back();
    }
}
```

`app/Http/Controllers/TeamRitualsController.php`: `update(TeamRitualsRequest $request, Workspace $workspace, Team $team)`: `$team->update($request->rituals());`, toast "Rituals saved.", `back()`.

Routes, in the team scope:

```php
            Route::post('teams/{team}/sprints', [TeamSprintsController::class, 'store'])->name('teams.sprints.store');
            Route::patch('teams/{team}/sprints/{sprint}', [TeamSprintsController::class, 'update'])->name('teams.sprints.update')->whereUuid('sprint');
            Route::delete('teams/{team}/sprints/{sprint}', [TeamSprintsController::class, 'destroy'])->name('teams.sprints.destroy')->whereUuid('sprint');
            Route::post('teams/{team}/sprint-starts', [TeamSprintStartsController::class, 'store'])->name('teams.sprintStarts.store');
            Route::put('teams/{team}/rituals', [TeamRitualsController::class, 'update'])->name('teams.rituals.update');
```

`{sprint}` is bound through the scoped binding of the team scope (`Team::sprints()`), so a sprint of another team is a 404.

- [ ] **Step 5: Run the tests on PostgreSQL and SQLite, the race on the four engines**

Run: `bin/test-db pgsql -- tests/Feature/Teams`, then `sqlite`.
Run: `bin/test-db pgsql --concurrency -- tests/Concurrency/TeamSprintStartsTest.php`, then `mariadb`, `mysql`, `sqlite-file`.
Expected: PASS on each. Then remove the `lockForUpdate()` of `StartNextSprint::handle` once, run the race on PostgreSQL, see it fail, and put it back.

- [ ] **Step 6: Commit** — `feat(teams): add, edit and delete sprints, start the next sprint, the retro day` (trailer lines).

### Task 8 (lane R): Default facilitators — the suggestion and its rotation (decision 4 C)

**Files:**
- Create: `database/migrations/2026_10_23_100200_create_team_facilitators_table.php`, `app/Actions/Teams/SuggestedFacilitator.php`, `app/Http/Requests/Teams/TeamFacilitatorsRequest.php`, `app/Http/Controllers/TeamFacilitatorsController.php`
- Modify: `app/Models/Team.php` (`defaultFacilitators()`), `app/Models/User.php` (`defaultFacilitatorOf()`), `app/Actions/Retros/NewRetro.php` (`facilitatorUserId`), `app/Actions/Retros/CreateRetro.php`, `app/Http/Controllers/TeamRetrosController.php` (`facilitator_user_id`), `app/Actions/Teams/PresentNewSessionOptions.php` (plan 22: `retroFacilitators`, `suggestedFacilitatorId`, `facilitatorRotation`), `app/Http/Controllers/TeamMemberRolesController.php`, `TeamMembersController.php` (`destroy`), `WorkspaceMembersController.php` (`destroy`), `routes/web.php`
- Test: `tests/Feature/Teams/TeamFacilitatorsTest.php`, `tests/Concurrency/RetroRotationTest.php`, `tests/Concurrency/TeamFacilitatorsTest.php`

Read first: `CreateRetro::handle` and `NewRetro` (whole, as plans 21 and 22 left them), `TeamRetrosController::store`, `PresentNewSessionOptions::handle` (plan 22), `WorkspaceMembersController::destroy` (the detach of the teams), `tests/Concurrency/WorkspaceTemplateLimitsTest.php` (the `Race::request` shape).

**Interfaces:**
- Consumes: `teams.facilitator_rotation_enabled`, `teams.rotation_position` (Task 6's migration); `TeamPolicy::createRetro` (Task 2).
- Produces: `Team::defaultFacilitators(): BelongsToMany<User, Team>` ordered by position; `SuggestedFacilitator::for(Team): ?User` (null: the creator), `SuggestedFacilitator::follow(Team $locked, User $facilitator): void` (inside the team's lock); `NewRetro::$facilitatorUserId: ?string`; `teams.retros.store` accepts `facilitator_user_id`; route `teams.facilitators.update` (`PUT`, body `user_ids: string[]`, `rotation: bool`); dialog options `retroFacilitators: array<int, {id: string, name: string, avatarUrl: string}>`, `suggestedFacilitatorId: ?string`, `facilitatorRotation: bool` (read by Task 23).

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Teams/TeamFacilitatorsTest.php`:

```php
<?php

use App\Actions\Teams\PresentNewSessionOptions;
use App\Enums\TeamRole;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;

/**
 * @return array{0: Team, 1: User, 2: User}
 */
function rotatingTeam(): array
{
    $team = Team::factory()->create();
    $camille = teamMember($team, TeamRole::Facilitator);
    $ines = teamMember($team, TeamRole::Owner);

    test()->actingAs($ines)
        ->put(route('teams.facilitators.update', [$team->workspace, $team]), ['user_ids' => [$camille->id, $ines->id], 'rotation' => true])
        ->assertRedirect();

    return [$team->fresh(), $camille, $ines];
}

function createRetroAs(Team $team, User $user, string $title, ?User $facilitator = null): Retro
{
    test()->actingAs($user)
        ->post(route('teams.retros.store', [$team->workspace, $team]), array_filter([
            'title' => $title,
            'template' => 'start_stop_continue',
            'facilitator_user_id' => $facilitator?->id,
        ]))
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    return Retro::query()->where('team_id', $team->id)->where('title', $title)->with('facilitator')->firstOrFail();
}

function suggestedFor(Team $team, User $viewer): ?string
{
    return resolve(PresentNewSessionOptions::class)->handle($viewer, $team->workspace, $team->fresh())['suggestedFacilitatorId'];
}

it('saves the list in order with the rotation', function () {
    [$team, $camille, $ines] = rotatingTeam();

    expect($team->defaultFacilitators()->pluck('users.id')->all())->toBe([$camille->id, $ines->id])
        ->and($team->facilitator_rotation_enabled)->toBeTrue();
});

it('suggests the next person of the rotation and moves on only when the suggestion is followed', function () {
    [$team, $camille, $ines] = rotatingTeam();
    $creator = teamMember($team);

    expect(suggestedFor($team, $creator))->toBe($camille->id);

    expect(createRetroAs($team, $creator, 'One', $camille)->facilitator->user_id)->toBe($camille->id)
        ->and(suggestedFor($team, $creator))->toBe($ines->id);

    expect(createRetroAs($team, $creator, 'Two', $creator)->facilitator->user_id)->toBe($creator->id)
        ->and(suggestedFor($team, $creator))->toBe($ines->id)
        ->and($team->fresh()->rotation_position)->toBe(1);
});

it('suggests the first of the list without the rotation, and nobody with an empty list', function () {
    [$team, $camille] = rotatingTeam();
    $creator = teamMember($team);
    $team->update(['facilitator_rotation_enabled' => false]);

    expect(suggestedFor($team, $creator))->toBe($camille->id);

    $team->defaultFacilitators()->detach();

    expect(suggestedFor($team, $creator))->toBeNull();
});

it('lets the creator facilitate when nobody is chosen, and never assigns the suggestion', function () {
    [$team] = rotatingTeam();
    $creator = teamMember($team);

    expect(createRetroAs($team, $creator, 'Mine')->facilitator->user_id)->toBe($creator->id)
        ->and($team->fresh()->rotation_position)->toBe(0);
});

it('refuses as facilitator an observer and someone outside the team', function (Closure $who) {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->post(route('teams.retros.store', [$team->workspace, $team]), ['title' => 'X', 'template' => 'start_stop_continue', 'facilitator_user_id' => $who($team)->id])
        ->assertSessionHasErrors('facilitator_user_id');

    expect(Retro::query()->count())->toBe(0);
})->with([
    'an observer' => [fn (Team $team): User => teamMember($team, TeamRole::Observer)],
    'an outsider' => [fn (Team $team): User => teamMember(Team::factory()->for($team->workspace)->create())],
]);

it('lists in the dialog the members who take part, without observers', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $observer = teamMember($team, TeamRole::Observer);

    $ids = collect(resolve(PresentNewSessionOptions::class)->handle($member, $team->workspace, $team)['retroFacilitators'])->pluck('id');

    expect($ids)->toContain($member->id)->not->toContain($observer->id);
});

it('refuses a member, an observer, duplicates, more than ten people and a rotation without anyone', function (Closure $body, string $field) {
    $team = Team::factory()->create();
    $owner = teamMember($team, TeamRole::Owner);

    $this->actingAs($owner)
        ->put(route('teams.facilitators.update', [$team->workspace, $team]), $body($team, $owner))
        ->assertSessionHasErrors($field);
})->with([
    'a member' => [fn (Team $team): array => ['user_ids' => [teamMember($team)->id], 'rotation' => false], 'user_ids'],
    'an observer' => [fn (Team $team): array => ['user_ids' => [teamMember($team, TeamRole::Observer)->id], 'rotation' => false], 'user_ids'],
    'a duplicate' => [fn (Team $team, User $owner): array => ['user_ids' => [$owner->id, $owner->id], 'rotation' => false], 'user_ids.0'],
    'eleven people' => [fn (Team $team): array => ['user_ids' => collect(range(1, 11))->map(fn (): string => teamMember($team, TeamRole::Facilitator)->id)->all(), 'rotation' => false], 'user_ids'],
    'a rotation without anyone' => [fn (): array => ['user_ids' => [], 'rotation' => true], 'rotation'],
]);

it('refuses the list to a member', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->put(route('teams.facilitators.update', [$team->workspace, $team]), ['user_ids' => [], 'rotation' => false])
        ->assertForbidden();
});

it('takes a person out of the list when they become a member or leave the team', function () {
    [$team, $camille, $ines] = rotatingTeam();

    $this->actingAs($ines)->put(route('teams.members.role.update', [$team->workspace, $team, $camille]), ['role' => 'member'])->assertRedirect();

    expect($team->defaultFacilitators()->pluck('users.id')->all())->toBe([$ines->id])
        ->and($team->fresh()->rotation_position)->toBe(0);

    $this->actingAs(workspaceManager($team->workspace))->delete(route('teams.members.destroy', [$team->workspace, $team, $ines]))->assertRedirect();

    expect($team->defaultFacilitators()->count())->toBe(0);
});
```

`tests/Concurrency/RetroRotationTest.php`:

```php
<?php

use App\Enums\TeamRole;
use App\Models\Retro;
use App\Models\Team;
use Tests\Concurrency\Support\Race;

it('moves the rotation once when two retros follow the same suggestion at the same moment (the team row lock)', function () {
    $team = Team::factory()->create(['facilitator_rotation_enabled' => true]);
    $camille = teamMember($team, TeamRole::Facilitator);
    $ines = teamMember($team, TeamRole::Facilitator);
    $team->defaultFacilitators()->attach([$camille->id => ['position' => 0], $ines->id => ['position' => 1]]);
    $creatorId = teamMember($team)->id;
    $camilleId = $camille->id;
    $uri = route('teams.retros.store', [$team->workspace, $team], false);

    $results = Race::run([
        static fn (): int => Race::request($creatorId, 'POST', $uri, ['title' => 'One', 'template' => 'start_stop_continue', 'facilitator_user_id' => $camilleId]),
        static fn (): int => Race::request($creatorId, 'POST', $uri, ['title' => 'Two', 'template' => 'start_stop_continue', 'facilitator_user_id' => $camilleId]),
    ]);

    $facilitators = Retro::query()->where('team_id', $team->id)->with('facilitator')->get()
        ->map(fn (Retro $retro): string => (string) $retro->facilitator?->user_id)
        ->all();

    expect(array_column($results, 'value'))->toEqual([302, 302])
        ->and($facilitators)->toEqual([$camilleId, $camilleId])
        ->and($team->fresh()->rotation_position)->toBe(1);
});
```

Under the lock, the second creation sees the position already moved: Inès is the suggestion, Camille was chosen, the position stays at 1. Without the lock, both read position 0, both see Camille suggested and both increment: the position ends at 2 and the case fails.

`tests/Concurrency/TeamFacilitatorsTest.php`:

```php
<?php

use App\Enums\TeamRole;
use App\Models\Team;
use Tests\Concurrency\Support\Race;

it('keeps one whole list when two people save it at the same moment (the team row lock)', function () {
    $team = Team::factory()->create();
    $ownerId = teamMember($team, TeamRole::Owner)->id;
    $a = teamMember($team, TeamRole::Facilitator)->id;
    $b = teamMember($team, TeamRole::Facilitator)->id;
    $uri = route('teams.facilitators.update', [$team->workspace, $team], false);

    $results = Race::run([
        static fn (): int => Race::request($ownerId, 'PUT', $uri, ['user_ids' => [$a, $b], 'rotation' => true]),
        static fn (): int => Race::request($ownerId, 'PUT', $uri, ['user_ids' => [$b, $a], 'rotation' => true]),
    ]);

    $positions = $team->defaultFacilitators()->get()->map(fn ($user): int => (int) $user->pivot->position)->all();

    expect(array_column($results, 'value'))->toEqual([302, 302])
        ->and($positions)->toBe([0, 1])
        ->and($team->defaultFacilitators()->count())->toBe(2);
});
```

Without the lock, the two `sync` calls interleave and one fails on the primary key `(team_id, user_id)` (500), or the positions end up `[0, 0]`.

- [ ] **Step 2: Run them and see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Teams/TeamFacilitatorsTest.php`
Expected: FAIL, the route is not defined.

- [ ] **Step 3: Table, relations, the suggestion**

`database/migrations/2026_10_23_100200_create_team_facilitators_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_facilitators', function (Blueprint $table) {
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('position');
            $table->timestamps();

            $table->primary(['team_id', 'user_id']);
        });
    }
};
```

`Team`:

```php
    /** @return BelongsToMany<User, $this> */
    public function defaultFacilitators(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'team_facilitators')
            ->withPivot('position')
            ->withTimestamps()
            ->orderByPivot('position')
            ->orderBy('users.id');
    }
```

`User`:

```php
    /** @return BelongsToMany<Team, $this> */
    public function defaultFacilitatorOf(): BelongsToMany
    {
        return $this->belongsToMany(Team::class, 'team_facilitators')->withTimestamps();
    }
```

`app/Actions/Teams/SuggestedFacilitator.php`:

```php
<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Models\User;

/**
 * The person the "New session" dialog proposes as a retro's facilitator (owner's decision 4 C):
 * a suggestion only, never an assignment.
 */
class SuggestedFacilitator
{
    /**
     * Null means "the person creating the retro".
     */
    public function for(Team $team): ?User
    {
        $list = $team->defaultFacilitators()->get();

        if ($list->isEmpty()) {
            return null;
        }

        if (! $team->facilitator_rotation_enabled) {
            return $list->first();
        }

        return $list->get($team->rotation_position % $list->count());
    }

    /**
     * The rotation moves on only when the retro follows its suggestion.
     * Must run inside the transaction that locked the team row.
     */
    public function follow(Team $locked, User $facilitator): void
    {
        if (! $locked->facilitator_rotation_enabled) {
            return;
        }

        if ($this->for($locked)?->id !== $facilitator->id) {
            return;
        }

        $locked->increment('rotation_position');
    }
}
```

`increment()` writes `rotation_position + 1` in SQL; with the lock it is the same as an assignment, without it the race above shows the double move.

`NewRetro` gains a last promoted argument `public ?string $facilitatorUserId = null`.

`CreateRetro`: inject `SuggestedFacilitator $suggestedFacilitator`; the transaction starts by locking the team (every retro creation, since the suggestion is compared under the lock), and the facilitator participant is the chosen person:

```php
        return DB::transaction(function () use ($team, $creator, $data): Retro {
            $lockedTeam = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();
            $facilitatorUser = $data->facilitatorUserId === null ? $creator : User::query()->findOrFail($data->facilitatorUserId);
            $this->suggestedFacilitator->follow($lockedTeam, $facilitatorUser);
            $workspaceTemplate = $this->workspaceTemplate($team, $data->template);
            // … unchanged until the facilitator …
            $facilitator = $retro->participants()->create(['user_id' => $facilitatorUser->id]);
```

(the comment line above stands for the unchanged lines of the method; do not write it). The creator, when someone else facilitates, gets their participant row when they open the retro (`ResolveRetroParticipant`), as after a hand-over today.

`TeamRetrosController::store`: the rules gain `'facilitator_user_id' => ['nullable', 'uuid', $this->facilitatorCandidate($team)]` and `NewRetro` receives `facilitatorUserId: $validated['facilitator_user_id'] ?? null`, with:

```php
    /**
     * A person who may take part in the team's sessions (not an observer, not outside the team).
     */
    private function facilitatorCandidate(Team $team): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($team): void {
            $user = is_string($value) ? User::query()->find($value) : null;

            if ($user !== null && $user->can('createRetro', $team)) {
                return;
            }

            $fail(__('Choose a facilitator from the team.'));
        };
    }
```

`PresentNewSessionOptions::handle` (plan 22), lane R's block at the end of its array (inject `SuggestedFacilitator`):

```php
            'retroFacilitators' => Alphabetical::sort(
                $team->members()->wherePivot('role', '!=', TeamRole::Observer->value)->orderBy('users.id')->get(),
                fn (User $member): string => $member->name,
            )->map(fn (User $member): array => [...$member->only(['id', 'name']), 'avatarUrl' => $member->avatarUrl()])->values()->all(),
            'suggestedFacilitatorId' => $this->suggestedFacilitator->for($team)?->id,
            'facilitatorRotation' => $team->facilitator_rotation_enabled,
```

Plan 22's `NewSessionOptionsTest` (exact key list) gains the three keys; list it in the commit.

- [ ] **Step 4: Request, controller, clean-up, route**

`app/Http/Requests/Teams/TeamFacilitatorsRequest.php`:

```php
<?php

namespace App\Http\Requests\Teams;

use App\Models\Team;
use Illuminate\Foundation\Http\FormRequest;

class TeamFacilitatorsRequest extends FormRequest
{
    public const int MaxFacilitators = 10;

    public function authorize(): bool
    {
        $team = $this->route('team');

        return $team instanceof Team && ($this->user()?->can('manageRituals', $team) ?? false);
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'user_ids' => ['present', 'array', 'max:'.self::MaxFacilitators],
            'user_ids.*' => ['required', 'uuid', 'distinct'],
            'rotation' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<int, string>
     */
    public function userIds(): array
    {
        return array_values(array_map(fn (mixed $id): string => (string) $id, (array) $this->validated('user_ids')));
    }
}
```

`app/Http/Controllers/TeamFacilitatorsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Enums\TeamRole;
use App\Http\Requests\Teams\TeamFacilitatorsRequest;
use App\Models\Team;
use App\Models\TeamMembership;
use App\Models\Workspace;
use App\Support\Database\Transactions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class TeamFacilitatorsController extends Controller
{
    public function update(TeamFacilitatorsRequest $request, Workspace $workspace, Team $team): RedirectResponse
    {
        $userIds = $request->userIds();
        $rotation = $request->boolean('rotation');

        DB::transaction(function () use ($team, $userIds, $rotation): void {
            $locked = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

            $eligible = TeamMembership::query()
                ->where('team_id', $locked->id)
                ->whereIn('user_id', $userIds)
                ->whereIn('role', [TeamRole::Owner->value, TeamRole::Facilitator->value])
                ->count();

            if ($eligible !== count($userIds)) {
                throw ValidationException::withMessages(['user_ids' => __('Only owners and facilitators of the team can be suggested.')]);
            }

            if ($rotation && $userIds === []) {
                throw ValidationException::withMessages(['rotation' => __('Add a facilitator first.')]);
            }

            $current = $locked->defaultFacilitators()->pluck('users.id')->all();

            $locked->defaultFacilitators()->sync(
                collect($userIds)->mapWithKeys(fn (string $id, int $position): array => [$id => ['position' => $position]])->all(),
            );

            $locked->update([
                'facilitator_rotation_enabled' => $rotation,
                'rotation_position' => $current === $userIds ? $locked->rotation_position : 0,
            ]);
        }, Transactions::Attempts);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Facilitators saved.')]);

        return back();
    }
}
```

The transaction writes nothing but the database, so it may be retried. Eligibility is read under the lock, so a demotion committed meanwhile (it takes the same lock, below) cannot slip a member into the list.

Clean-up of the list:
- `TeamMemberRolesController::update`, inside its transaction after `updateExistingPivot`:

```php
            if (! TeamRole::from($validated['role'])->managesRituals() && $locked->defaultFacilitators()->detach($member->id) > 0) {
                $locked->update(['rotation_position' => 0]);
            }
```

- `TeamMembersController::destroy`: before `$team->members()->detach($member);`, `$team->defaultFacilitators()->detach($member);`.
- `WorkspaceMembersController::destroy`, next to the detach of the teams: `$member->defaultFacilitatorOf()->detach($workspace->teams()->pluck('id'));`.

Route: `Route::put('teams/{team}/facilitators', [TeamFacilitatorsController::class, 'update'])->name('teams.facilitators.update');`.

- [ ] **Step 5: Run the tests on PostgreSQL and SQLite, the races on the four engines**

Run: `bin/test-db pgsql -- tests/Feature/Teams tests/Feature/Retros tests/Feature/Sessions tests/Feature/Workspaces`, then `sqlite`.
Run: `bin/test-db pgsql --concurrency -- tests/Concurrency/RetroRotationTest.php tests/Concurrency/TeamFacilitatorsTest.php`, then `mariadb`, `mysql`, `sqlite-file`.
Expected: PASS on each; the existing retro creation tests pass unchanged (no `facilitator_user_id`: the creator facilitates). Then remove the `lockForUpdate()` of `CreateRetro` once, run `RetroRotationTest` on PostgreSQL, see it fail (the position moved twice), and put it back.

- [ ] **Step 6: Commit** — `feat(teams): default facilitators suggest who facilitates a retro; the rotation follows the choices` (trailer lines).

### Task 9 (lane T): Template visibility

**Files:**
- Create: `app/Enums/TemplateVisibility.php`, `database/migrations/2026_10_23_100300_add_visibility_to_workspace_templates_table.php`, `app/Policies/WorkspaceTemplatePolicy.php`, `app/Actions/Retros/TemplateAvailability.php`
- Modify: `app/Models/WorkspaceTemplate.php` (fillable, casts, `team()`, `scopeVisibleTo`), `app/Http/Requests/WorkspaceTemplateRequest.php`, `app/Http/Controllers/WorkspaceTemplatesController.php`, `TeamRetrosController.php`, `app/Actions/Teams/PresentNewSessionOptions.php` (plan 22: catalogue arguments), `app/Actions/Retros/BuildTemplateCatalogue.php`, `TopTeamTemplates.php`
- Test: `tests/Feature/Workspaces/TemplateVisibilityTest.php`, `tests/Upgrade/WorkspaceTemplateVisibilityBackfillTest.php`

Read first: `WorkspaceTemplateRequest` (whole: `authorize`, `after`, `nameIsTaken`, `templateAttributes`), `WorkspaceTemplatesController` (whole), `TeamRetrosController::availableTemplate` and `isAvailable`, `BuildTemplateCatalogue`, `TopTeamTemplates::usedKeys`, every caller of `BuildTemplateCatalogue::handle` (`grep -rn "buildTemplateCatalogue\|BuildTemplateCatalogue" app`), and `tests/Concurrency/WorkspaceTemplateLimitsTest.php` (it must pass unchanged: a manager posting without `visibility` creates a workspace template).

**Interfaces:**
- Produces: `TemplateVisibility::{Personal, Team, Workspace}`; `WorkspaceTemplate::scopeVisibleTo(Builder, User, Workspace, ?Team = null)`; `WorkspaceTemplatePolicy::view|update|delete(User, WorkspaceTemplate)`, `share(User, Workspace, TemplateVisibility, ?Team)`; `TemplateAvailability::isAvailable(Team $team, User $user, mixed $key): bool`; `BuildTemplateCatalogue::handle(Workspace $workspace, User $viewer, ?Team $team = null)`; templates page props `templates[].visibility`, `templates[].team`, `templates[].canManage`, `canCreate`, `canShareWorkspace`, `teamTemplateTeams: {id, name}[]`; request fields `visibility`, `team_id`.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Workspaces/TemplateVisibilityTest.php`:

```php
<?php

use App\Enums\TeamRole;
use App\Enums\TemplateVisibility;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceTemplate;
use Inertia\Testing\AssertableInertia as Assert;

function templateBody(array $override = []): array
{
    return [
        'name' => 'Our retro',
        'category' => 'team_mood',
        'columns' => [['title' => 'Energy', 'color' => 'moss']],
        ...$override,
    ];
}

function postTemplate(User $user, Team $team, array $override = []): \Illuminate\Testing\TestResponse
{
    return test()->actingAs($user)->post(route('workspaces.templates.store', $team->workspace), templateBody($override));
}

it('keeps a template posted by an admin without a visibility as a workspace template', function () {
    $team = Team::factory()->create();

    postTemplate(workspaceManager($team->workspace), $team)->assertRedirect();

    expect(WorkspaceTemplate::query()->sole()->visibility)->toBe(TemplateVisibility::Workspace);
});

it('lets any member keep a personal template that nobody else sees', function () {
    $team = Team::factory()->create();
    $author = teamMember($team);
    $colleague = teamMember($team);

    postTemplate($author, $team, ['visibility' => 'personal'])->assertRedirect();

    $templatesOf = fn (User $user) => test()->actingAs($user)->get(route('workspaces.templates.index', $team->workspace));

    $templatesOf($author)->assertInertia(fn (Assert $page) => $page->has('templates', 1)->where('templates.0.visibility', 'personal'));
    $templatesOf($colleague)->assertInertia(fn (Assert $page) => $page->has('templates', 0));
});

it('lets owners and facilitators share a template with their team only', function () {
    $atlas = Team::factory()->create();
    $borealis = Team::factory()->for($atlas->workspace)->create();
    $facilitator = teamMember($atlas, TeamRole::Facilitator);

    postTemplate(teamMember($atlas), $atlas, ['visibility' => 'team', 'team_id' => $atlas->id])->assertForbidden();
    postTemplate($facilitator, $atlas, ['visibility' => 'team', 'team_id' => $borealis->id])->assertForbidden();
    postTemplate($facilitator, $atlas, ['visibility' => 'team', 'team_id' => $atlas->id])->assertRedirect();

    $template = WorkspaceTemplate::query()->sole();

    expect(teamMember($atlas)->can('view', $template))->toBeTrue()
        ->and(teamMember($borealis)->can('view', $template))->toBeFalse();
});

it('keeps workspace templates to admins', function () {
    $team = Team::factory()->create();

    postTemplate(teamMember($team, TeamRole::Owner), $team, ['visibility' => 'workspace'])->assertForbidden();
});

it('refuses a team on a personal template', function () {
    $team = Team::factory()->create();

    postTemplate(teamMember($team), $team, ['visibility' => 'personal', 'team_id' => $team->id])->assertSessionHasErrors('team_id');
});

it('refuses to start a retro from a personal template of someone else', function () {
    $team = Team::factory()->create();
    $template = WorkspaceTemplate::factory()->for($team->workspace)->create([
        'visibility' => TemplateVisibility::Personal,
        'created_by_user_id' => teamMember($team)->id,
    ]);

    $this->actingAs(teamMember($team))
        ->post(route('teams.retros.store', [$team->workspace, $team]), ['title' => 'Copy', 'template' => $template->catalogueKey()])
        ->assertSessionHasErrors('template');
});

it('lists in the team catalogue the workspace templates, the team ones and the viewer personal ones', function () {
    $atlas = Team::factory()->create();
    $borealis = Team::factory()->for($atlas->workspace)->create();
    $viewer = teamMember($atlas);
    $make = fn (string $name, array $attributes) => WorkspaceTemplate::factory()->for($atlas->workspace)->create(['name' => $name, ...$attributes]);
    $make('Shared', ['visibility' => TemplateVisibility::Workspace]);
    $make('Atlas only', ['visibility' => TemplateVisibility::Team, 'team_id' => $atlas->id]);
    $make('Borealis only', ['visibility' => TemplateVisibility::Team, 'team_id' => $borealis->id]);
    $make('Mine', ['visibility' => TemplateVisibility::Personal, 'created_by_user_id' => $viewer->id]);
    $make('Someone else', ['visibility' => TemplateVisibility::Personal, 'created_by_user_id' => teamMember($atlas)->id]);

    $names = collect(resolve(\App\Actions\Retros\BuildTemplateCatalogue::class)->handle($atlas->workspace, $viewer, $atlas))
        ->where('isWorkspace', true)->pluck('name')->sort()->values()->all();

    expect($names)->toBe(['Atlas only', 'Mine', 'Shared']);
});

it('lets the author edit a personal template, a team facilitator a team one, and refuses the others', function () {
    $team = Team::factory()->create();
    $author = teamMember($team);
    $personal = WorkspaceTemplate::factory()->for($team->workspace)->create(['visibility' => TemplateVisibility::Personal, 'created_by_user_id' => $author->id]);
    $teamTemplate = WorkspaceTemplate::factory()->for($team->workspace)->create(['visibility' => TemplateVisibility::Team, 'team_id' => $team->id]);

    expect($author->can('update', $personal))->toBeTrue()
        ->and(teamMember($team)->can('update', $personal))->toBeFalse()
        ->and(teamMember($team, TeamRole::Facilitator)->can('update', $teamTemplate))->toBeTrue()
        ->and(teamMember($team)->can('delete', $teamTemplate))->toBeFalse();
});

it('shows a personal template whose author is gone to admins only', function () {
    $team = Team::factory()->create();
    $template = WorkspaceTemplate::factory()->for($team->workspace)->create(['visibility' => TemplateVisibility::Personal, 'created_by_user_id' => null]);

    expect(workspaceManager($team->workspace)->can('view', $template))->toBeTrue()
        ->and(teamMember($team)->can('view', $template))->toBeFalse();
});

it('tells the templates page who may share what', function () {
    $team = Team::factory()->create();
    $facilitator = teamMember($team, TeamRole::Facilitator);

    $this->actingAs($facilitator)->get(route('workspaces.templates.index', $team->workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->where('canCreate', true)
            ->where('canShareWorkspace', false)
            ->where('teamTemplateTeams', [['id' => $team->id, 'name' => $team->name]]));
});
```

`tests/Upgrade/WorkspaceTemplateVisibilityBackfillTest.php`: the pattern of Task 1's Upgrade test, migration `2026_10_23_100300_add_visibility_to_workspace_templates_table.php`; legacy rows: a workspace, a user (with `email_key`, `name_search`), two `workspace_templates` rows with `name`, `name_key` (`NameKey::of($name)`), `category`, `created_by_user_id`; after the migration both read `visibility = 'workspace'` and `team_id = null`.

- [ ] **Step 2: Run them and see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Workspaces/TemplateVisibilityTest.php`
Expected: FAIL, `Class "App\Enums\TemplateVisibility" not found`.

- [ ] **Step 3: Enum, migration, model**

`app/Enums/TemplateVisibility.php`:

```php
<?php

namespace App\Enums;

enum TemplateVisibility: string
{
    case Personal = 'personal';
    case Team = 'team';
    case Workspace = 'workspace';
}
```

`database/migrations/2026_10_23_100300_add_visibility_to_workspace_templates_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workspace_templates', function (Blueprint $table) {
            $table->string('visibility', 20)->default('workspace');
            $table->foreignUuid('team_id')->nullable()->constrained()->cascadeOnDelete();

            $table->index(['workspace_id', 'visibility']);
        });
    }
};
```

`WorkspaceTemplate`: `visibility` and `team_id` join the fillable list; `casts()` gains `'visibility' => TemplateVisibility::class`; docblock `@property TemplateVisibility $visibility`, `@property string|null $team_id`, `@property-read Team|null $team`; and:

```php
    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * What a person sees: the workspace's templates, those of the given team (or of every
     * team they can view), and their own personal ones; an admin also sees the personal
     * templates whose author's account is gone.
     *
     * @param  Builder<self>  $query
     */
    public function scopeVisibleTo(Builder $query, User $user, Workspace $workspace, ?Team $team = null): void
    {
        $teamIds = $team !== null ? [$team->id] : $workspace->teamsVisibleTo($user)->modelKeys();
        $managesWorkspace = $user->canManage($workspace);

        $query->where(function (Builder $visible) use ($user, $teamIds, $managesWorkspace): void {
            $visible->where('visibility', TemplateVisibility::Workspace->value)
                ->orWhere(fn (Builder $teamTemplates) => $teamTemplates->where('visibility', TemplateVisibility::Team->value)->whereIn('team_id', $teamIds))
                ->orWhere(fn (Builder $own) => $own->where('visibility', TemplateVisibility::Personal->value)->where('created_by_user_id', $user->id));

            if ($managesWorkspace) {
                $visible->orWhere(fn (Builder $orphans) => $orphans->where('visibility', TemplateVisibility::Personal->value)->whereNull('created_by_user_id'));
            }
        });
    }
```

`WorkspaceTemplateFactory`: no change (the column default gives `workspace`).

- [ ] **Step 4: Policy and availability**

`app/Policies/WorkspaceTemplatePolicy.php`:

```php
<?php

namespace App\Policies;

use App\Enums\TemplateVisibility;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;

class WorkspaceTemplatePolicy
{
    public function view(User $user, WorkspaceTemplate $template): bool
    {
        return match ($template->visibility) {
            TemplateVisibility::Workspace => $user->belongsToWorkspace($template->workspace),
            TemplateVisibility::Team => $template->team !== null && $user->can('view', $template->team),
            TemplateVisibility::Personal => $this->ownsPersonal($user, $template),
        };
    }

    public function update(User $user, WorkspaceTemplate $template): bool
    {
        return match ($template->visibility) {
            TemplateVisibility::Workspace => $user->canManage($template->workspace),
            TemplateVisibility::Team => $template->team !== null && $user->managesRitualsOf($template->team),
            TemplateVisibility::Personal => $this->ownsPersonal($user, $template),
        };
    }

    public function delete(User $user, WorkspaceTemplate $template): bool
    {
        return $this->update($user, $template);
    }

    /**
     * Whether the person may give a template this visibility (and this team).
     */
    public function share(User $user, Workspace $workspace, TemplateVisibility $visibility, ?Team $team = null): bool
    {
        return match ($visibility) {
            TemplateVisibility::Workspace => $user->canManage($workspace),
            TemplateVisibility::Team => $team !== null && $team->workspace_id === $workspace->id && $user->managesRitualsOf($team),
            TemplateVisibility::Personal => $user->belongsToWorkspace($workspace),
        };
    }

    private function ownsPersonal(User $user, WorkspaceTemplate $template): bool
    {
        if ($template->created_by_user_id === null) {
            return $user->canManage($template->workspace);
        }

        return $template->created_by_user_id === $user->id;
    }
}
```

`app/Actions/Retros/TemplateAvailability.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceTemplate;
use App\Support\RetroTemplates\TemplateCatalogue;

class TemplateAvailability
{
    /**
     * A built-in key, or a template of the team's workspace that this person sees from this team.
     */
    public function isAvailable(Team $team, User $user, mixed $key): bool
    {
        if (! is_string($key)) {
            return false;
        }

        $templateId = WorkspaceTemplate::idFromKey($key);

        if ($templateId === null) {
            return TemplateCatalogue::has($key);
        }

        return $team->workspace->templates()
            ->visibleTo($user, $team->workspace, $team)
            ->whereKey($templateId)
            ->exists();
    }
}
```

- [ ] **Step 5: Request, controllers, catalogue**

`WorkspaceTemplateRequest` (imports `TemplateVisibility`, `Team`, `Str`):

```php
    public function authorize(): bool
    {
        $user = $this->user();

        if ($user === null) {
            return false;
        }

        $template = $this->route('template');

        if ($template instanceof WorkspaceTemplate && $user->cannot('update', $template)) {
            return false;
        }

        return $user->can('share', [WorkspaceTemplate::class, $this->workspace(), $this->visibility(), $this->sharedTeam()]);
    }

    public function visibility(): TemplateVisibility
    {
        $template = $this->route('template');
        $fallback = $template instanceof WorkspaceTemplate ? $template->visibility : TemplateVisibility::Workspace;

        return TemplateVisibility::tryFrom((string) $this->input('visibility')) ?? $fallback;
    }

    public function sharedTeam(): ?Team
    {
        if ($this->visibility() !== TemplateVisibility::Team) {
            return null;
        }

        $teamId = $this->input('team_id');

        if (! is_string($teamId) || ! Str::isUuid($teamId)) {
            return null;
        }

        return $this->workspace()->teams()->whereKey($teamId)->first();
    }
```

`rules()` gains:

```php
            'visibility' => ['sometimes', Rule::enum(TemplateVisibility::class)],
            'team_id' => ['nullable', 'uuid', Rule::prohibitedIf(fn (): bool => $this->visibility() !== TemplateVisibility::Team)],
```

and `templateAttributes()` returns, besides `name` and `category`, `'visibility' => $this->visibility()->value` and `'team_id' => $this->sharedTeam()?->id` (its docblock shape gains both). A team visibility without a team the person may share with fails `authorize()` (403), as the test expects.

`WorkspaceTemplatesController`:
- `destroy`: `Gate::authorize('delete', $template);` replaces `manageTemplates`.
- `index` props: `'templates' => $this->retroTemplates($request->user(), $workspace, $visibleTeamIds)`, `'canCreate' => true` (every viewer of the page belongs to the workspace), `'canShareWorkspace' => $request->user()->canManage($workspace)`, `'teamTemplateTeams' => $workspace->teamsVisibleTo($request->user())->filter(fn (Team $team): bool => $request->user()->managesRitualsOf($team))->map(fn (Team $team): array => $team->only(['id', 'name']))->values()`, and `'catalogue' => Inertia::optional(fn (): array => $buildTemplateCatalogue->handle($workspace, $request->user()))`.
- `retroTemplates(User $user, Workspace $workspace, array $visibleTeamIds)`: the query becomes `$workspace->templates()->visibleTo($user, $workspace)->with(['columns', 'creator', 'team'])->withCount([...])->get()`; `present(WorkspaceTemplate $template, User $user)` adds `'visibility' => $template->visibility->value`, `'team' => $template->team?->only(['id', 'name'])`, `'canManage' => $user->can('update', $template)` (docblock shape updated).

`TeamRetrosController`: inject `TemplateAvailability $templateAvailability` in `store`; the `template` rule becomes `['required', 'string', $this->availableTemplate($team, $request->user(), $templateAvailability)]` with:

```php
    private function availableTemplate(Team $team, User $user, TemplateAvailability $availability): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($team, $user, $availability): void {
            if ($availability->isAvailable($team, $user, $value)) {
                return;
            }

            $fail(__('Choose a template from the list.'));
        };
    }
```

and `isAvailable()` is deleted.

`BuildTemplateCatalogue::handle(Workspace $workspace, User $viewer, ?Team $team = null)`: the query becomes `$workspace->templates()->visibleTo($viewer, $workspace, $team)->with('columns')->get()`. `PresentNewSessionOptions::handle` (plan 22, which `TeamsController@show` and the Sessions page spread): `'catalogue' => Inertia::optional(fn (): array => $this->buildTemplateCatalogue->handle($workspace, $viewer, $team))` (read how plan 22 wrote the key and keep its shape).

`TopTeamTemplates::usedKeys`: personal templates never become a team's shortcut:

```php
        $workspaceTemplateIds = WorkspaceTemplate::query()
            ->where('workspace_id', $team->workspace_id)
            ->where(fn (Builder $shared) => $shared
                ->where('visibility', TemplateVisibility::Workspace->value)
                ->orWhere(fn (Builder $teamTemplates) => $teamTemplates->where('visibility', TemplateVisibility::Team->value)->where('team_id', $team->id)))
            ->pluck('id')
            ->all();
```

- [ ] **Step 6: Run the tests on PostgreSQL and SQLite, the Upgrade test and the template races on the four engines**

Run: `bin/test-db pgsql -- tests/Feature/Workspaces tests/Feature/Teams tests/Feature/Retros`, then `sqlite`.
Run: `bin/test-db <engine> -- tests/Upgrade/WorkspaceTemplateVisibilityBackfillTest.php` on `pgsql`, `mariadb`, `mysql`, `sqlite`; `bin/test-db <engine> --concurrency -- tests/Concurrency/WorkspaceTemplateLimitsTest.php` on `pgsql`, `mariadb`, `mysql`, `sqlite-file`.
Expected: PASS on each; the existing template tests pass unchanged (a manager without `visibility` keeps today's behaviour).

- [ ] **Step 7: Commit** — `feat(templates): personal, team and workspace visibility` (trailer lines).

### Task 10 (lane T): The team's default retro template

**Files:**
- Create: `database/migrations/2026_10_23_100400_add_default_retro_template_to_teams_table.php`, `app/Http/Controllers/TeamDefaultRetroTemplatesController.php`, `app/Actions/Teams/TeamTemplateUsage.php`
- Modify: `app/Models/Team.php` (fillable, docblock), `app/Actions/Teams/PresentNewSessionOptions.php` (plan 22: `defaultRetroTemplate`), `routes/web.php`
- Test: `tests/Feature/Teams/TeamDefaultRetroTemplateTest.php`

**Interfaces:**
- Consumes: `TemplateAvailability` (Task 9), `TopTeamTemplates::handle(Team): array<int, string>`, `TemplateCatalogue::find`, `WorkspaceTemplate::presentColumns()`.
- Produces: route `teams.defaultRetroTemplate.update` (`PUT`, body `template: ?string`); dialog option `defaultRetroTemplate: ?string` (through `PresentNewSessionOptions`, so on `teams/show` and on plan 22's Sessions page); `TeamTemplateUsage::handle(Team $team, User $viewer): array<int, array{key: string, name: string, columns: array<int, array{title: string, description: ?string, color: string}>, usageCount: int, isDefault: bool, templateId: ?string, canEdit: bool}>` (read by Task 16).

- [ ] **Step 1: Write the failing test**

`tests/Feature/Teams/TeamDefaultRetroTemplateTest.php`:

```php
<?php

use App\Actions\Teams\TeamTemplateUsage;
use App\Enums\TeamRole;
use App\Enums\TemplateVisibility;
use App\Models\Retro;
use App\Models\Team;
use App\Models\WorkspaceTemplate;
use App\Support\RetroTemplates\TemplateCatalogue;
use Inertia\Testing\AssertableInertia as Assert;

it('lets a facilitator choose the default template and refuses a member', function () {
    $team = Team::factory()->create();
    $route = route('teams.defaultRetroTemplate.update', [$team->workspace, $team]);

    $this->actingAs(teamMember($team))->put($route, ['template' => '4l'])->assertForbidden();
    $this->actingAs(teamMember($team, TeamRole::Facilitator))->put($route, ['template' => 'start_stop_continue'])->assertRedirect();

    expect($team->fresh()->default_retro_template)->toBe('start_stop_continue');
});

it('refuses an unknown template and a personal one', function () {
    $team = Team::factory()->create();
    $facilitator = teamMember($team, TeamRole::Facilitator);
    $personal = WorkspaceTemplate::factory()->for($team->workspace)->create(['visibility' => TemplateVisibility::Personal, 'created_by_user_id' => $facilitator->id]);
    $route = route('teams.defaultRetroTemplate.update', [$team->workspace, $team]);

    $this->actingAs($facilitator)->put($route, ['template' => 'no_such_template'])->assertSessionHasErrors('template');
    $this->actingAs($facilitator)->put($route, ['template' => $personal->catalogueKey()])->assertSessionHasErrors('template');
});

it('sends the default to the team page while it is available, and nothing once it is gone', function () {
    $team = Team::factory()->create();
    $template = WorkspaceTemplate::factory()->for($team->workspace)->create();
    $team->update(['default_retro_template' => $template->catalogueKey()]);
    $member = teamMember($team);
    $page = fn () => $this->actingAs($member)->get(route('teams.show', [$team->workspace, $team]));

    $page()->assertInertia(fn (Assert $page) => $page->where('defaultRetroTemplate', $template->catalogueKey()));

    $template->delete();

    $page()->assertInertia(fn (Assert $page) => $page->where('defaultRetroTemplate', null));
});

it('counts the team retros only, lists the default beyond the top five, and says who may edit the columns', function () {
    $team = Team::factory()->create();
    $other = Team::factory()->for($team->workspace)->create();
    $teamTemplate = WorkspaceTemplate::factory()->for($team->workspace)->create(['visibility' => TemplateVisibility::Team, 'team_id' => $team->id]);
    Retro::factory()->for($team)->count(2)->create(['template' => TemplateCatalogue::Workspace, 'workspace_template_id' => $teamTemplate->id]);
    Retro::factory()->for($other)->create(['template' => TemplateCatalogue::Workspace, 'workspace_template_id' => $teamTemplate->id]);
    Retro::factory()->for($team)->create(['template' => 'start_stop_continue']);
    $team->update(['default_retro_template' => 'sailboat']);
    $facilitator = teamMember($team, TeamRole::Facilitator);

    $rows = collect(resolve(TeamTemplateUsage::class)->handle($team->fresh(), $facilitator))->keyBy('key');

    expect($rows[$teamTemplate->catalogueKey()]['usageCount'])->toBe(2)
        ->and($rows[$teamTemplate->catalogueKey()]['canEdit'])->toBeTrue()
        ->and($rows['start_stop_continue']['usageCount'])->toBe(1)
        ->and($rows['start_stop_continue']['canEdit'])->toBeFalse()
        ->and($rows['sailboat']['isDefault'])->toBeTrue()
        ->and($rows['sailboat']['usageCount'])->toBe(0);
});
```

Check the built-in keys used here (`start_stop_continue`, `4l`, `sailboat`) against `TemplateCatalogue::all()` and `TemplateCatalogue::Shortcuts` before running; `sailboat` must not be among the five shortcuts for the "beyond the top five" case (replace it by a built-in outside them).

- [ ] **Step 2: Run it and see it fail** — `vendor/bin/sail artisan test --compact tests/Feature/Teams/TeamDefaultRetroTemplateTest.php` — Expected: FAIL, the route is not defined.

- [ ] **Step 3: Migration, controller, usage**

`database/migrations/2026_10_23_100400_add_default_retro_template_to_teams_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            $table->string('default_retro_template', 80)->nullable();
        });
    }
};
```

`Team`: `default_retro_template` joins the fillable list and the docblock.

`app/Http/Controllers/TeamDefaultRetroTemplatesController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Retros\TemplateAvailability;
use App\Enums\TemplateVisibility;
use App\Models\Team;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class TeamDefaultRetroTemplatesController extends Controller
{
    public function update(Request $request, Workspace $workspace, Team $team, TemplateAvailability $availability): RedirectResponse
    {
        Gate::authorize('manageRituals', $team);

        $validated = $request->validate([
            'template' => ['nullable', 'string', function (string $attribute, mixed $value, Closure $fail) use ($team, $request, $availability): void {
                if (! $availability->isAvailable($team, $request->user(), $value)) {
                    $fail(__('Choose a template from the list.'));

                    return;
                }

                $templateId = WorkspaceTemplate::idFromKey((string) $value);

                if ($templateId !== null && WorkspaceTemplate::query()->whereKey($templateId)->value('visibility') === TemplateVisibility::Personal->value) {
                    $fail(__('A personal template cannot be the team default.'));
                }
            }],
        ]);

        $team->update(['default_retro_template' => $validated['template'] ?? null]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Default template saved.')]);

        return back();
    }
}
```

`app/Actions/Teams/TeamTemplateUsage.php`:

```php
<?php

namespace App\Actions\Teams;

use App\Actions\Retros\TemplateAvailability;
use App\Actions\Retros\TopTeamTemplates;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceTemplate;
use App\Support\RetroTemplates\TemplateCatalogue;
use Illuminate\Database\Eloquent\Builder;

/**
 * @phpstan-type TemplateUsage array{
 *     key: string,
 *     name: string,
 *     columns: array<int, array{title: string, description: ?string, color: string}>,
 *     usageCount: int,
 *     isDefault: bool,
 *     templateId: ?string,
 *     canEdit: bool
 * }
 */
class TeamTemplateUsage
{
    public function __construct(
        private TopTeamTemplates $topTeamTemplates,
        private TemplateAvailability $templateAvailability,
    ) {}

    /**
     * The team's top templates and its default, with the team's own usage of each.
     *
     * @return array<int, TemplateUsage>
     */
    public function handle(Team $team, User $viewer): array
    {
        $keys = $this->topTeamTemplates->handle($team);
        $default = $team->default_retro_template;

        if ($default !== null && ! in_array($default, $keys, true) && $this->templateAvailability->isAvailable($team, $viewer, $default)) {
            $keys[] = $default;
        }

        $rows = [];

        foreach ($keys as $key) {
            $row = $this->row($team, $viewer, $key, $default);

            if ($row !== null) {
                $rows[] = $row;
            }
        }

        return $rows;
    }

    /**
     * @return TemplateUsage|null
     */
    private function row(Team $team, User $viewer, string $key, ?string $default): ?array
    {
        $templateId = WorkspaceTemplate::idFromKey($key);

        if ($templateId !== null) {
            $template = WorkspaceTemplate::query()
                ->with('columns')
                ->withCount(['retros' => fn (Builder $retros) => $retros->where('team_id', $team->id)])
                ->find($templateId);

            if ($template === null) {
                return null;
            }

            return [
                'key' => $key,
                'name' => $template->name,
                'columns' => $template->presentColumns(),
                'usageCount' => (int) $template->retros_count,
                'isDefault' => $key === $default,
                'templateId' => $template->id,
                'canEdit' => $viewer->can('update', $template),
            ];
        }

        $definition = TemplateCatalogue::find($key);

        if ($definition === null) {
            return null;
        }

        return [
            'key' => $key,
            'name' => $definition->name(),
            'columns' => array_map(fn (array $column): array => [
                'title' => $column['title'],
                'description' => $column['description'],
                'color' => $column['color']->value,
            ], $definition->translatedColumns()),
            'usageCount' => Retro::query()->where('team_id', $team->id)->where('template', $key)->count(),
            'isDefault' => $key === $default,
            'templateId' => null,
            'canEdit' => false,
        ];
    }
}
```

At most six templates are read, each with one aggregate: a bounded set (rule 2).

Route: `Route::put('teams/{team}/default-retro-template', [TeamDefaultRetroTemplatesController::class, 'update'])->name('teams.defaultRetroTemplate.update');`.

`PresentNewSessionOptions::handle` (plan 22) gains, in lane T's block at the end of its array, `'defaultRetroTemplate' => $this->defaultRetroTemplate($team, $viewer),` (inject `TemplateAvailability` in its constructor) with:

```php
    private function defaultRetroTemplate(Team $team, User $viewer): ?string
    {
        $key = $team->default_retro_template;

        if ($key === null || ! $this->templateAvailability->isAvailable($team, $viewer, $key)) {
            return null;
        }

        return $key;
    }
```

Plan 22's `NewSessionOptionsTest` (exact key list) gains the key; list it in the commit.

- [ ] **Step 4: Run the tests on PostgreSQL and SQLite** — `bin/test-db pgsql -- tests/Feature/Teams tests/Feature/Workspaces tests/Feature/Sessions`, then `sqlite` — Expected: PASS.

- [ ] **Step 5: Commit** — `feat(teams): a default retro template, with each template's usage by the team` (trailer lines).

### Task 11 (lane F): Team and workspace descriptions; renaming a workspace (decision 7 B)

**Files:**
- Create: `database/migrations/2026_10_23_100500_add_descriptions_to_teams_and_workspaces.php`, `app/Http/Controllers/WorkspaceDetailsController.php`
- Modify: `app/Models/Team.php`, `app/Models/Workspace.php` (fillable, docblock), `app/Policies/WorkspacePolicy.php` (`update`), `app/Http/Controllers/TeamsController.php` (`update` takes `description`), `app/Http/Controllers/WorkspacesController.php` (descriptions in the props), `routes/web.php`
- Test: `tests/Feature/Teams/DescriptionsTest.php`

Read first: `WorkspacesController::store` (the name rule of a new workspace: required, at most 100), `CreateWorkspace` (how the slug is made: a rename never touches it), `Workspace` (`#[RouteKey('slug')]`), `HandleInertiaRequests` (`currentWorkspace`: the new name is read at the next request).

**Interfaces:**
- Produces: `teams.description`, `workspaces.description` (`string(200)`, nullable); `teams.update` accepts `description` (only changed when present); route `workspaces.details.update` (`PUT w/{workspace}/details`, body `name`, `description`); `WorkspacePolicy::update(User, Workspace)`; props `workspaces/show.workspace.description`, `teams[].description`, `workspaces/show.canEditDetails`. Plan 25's onboarding writes `teams.description`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Teams/DescriptionsTest.php`:

```php
<?php

use App\Enums\TeamRole;
use App\Models\Team;
use Inertia\Testing\AssertableInertia as Assert;

it('lets a team owner describe the team, and clears an empty description', function () {
    $team = Team::factory()->create();
    $owner = teamMember($team, TeamRole::Owner);
    $route = route('teams.update', [$team->workspace, $team]);

    $this->actingAs($owner)->patch($route, ['name' => $team->name, 'description' => '  Product squad · retro app  '])->assertRedirect();
    expect($team->fresh()->description)->toBe('Product squad · retro app');

    $this->actingAs($owner)->patch($route, ['name' => $team->name, 'description' => ''])->assertRedirect();
    expect($team->fresh()->description)->toBeNull();
});

it('keeps the description when only the name is sent, and refuses more than 200 characters', function () {
    $team = Team::factory()->create(['description' => 'Kept']);
    $owner = teamMember($team, TeamRole::Owner);
    $route = route('teams.update', [$team->workspace, $team]);

    $this->actingAs($owner)->patch($route, ['name' => 'Renamed'])->assertRedirect();
    $this->actingAs($owner)->patch($route, ['name' => 'Renamed', 'description' => str_repeat('a', 201)])->assertSessionHasErrors('description');

    expect($team->fresh()->description)->toBe('Kept');
});

it('lets a workspace admin rename and describe the workspace, keeping its address, and refuses a member', function () {
    $team = Team::factory()->create();
    $workspace = $team->workspace;
    $slug = $workspace->slug;
    $route = route('workspaces.details.update', $workspace);

    $this->actingAs(teamMember($team))->put($route, ['name' => 'Ours', 'description' => 'Ours'])->assertForbidden();
    $this->actingAs(workspaceManager($workspace))->put($route, ['name' => 'Nordlys', 'description' => 'Nordic product teams'])->assertRedirect();

    $workspace->refresh();

    expect($workspace->name)->toBe('Nordlys')
        ->and($workspace->description)->toBe('Nordic product teams')
        ->and($workspace->slug)->toBe($slug);

    $this->actingAs(teamMember($team))->get(route('workspaces.show', $slug))->assertOk();
});

it('refuses an empty or too long workspace name', function (string $name) {
    $team = Team::factory()->create();
    $before = $team->workspace->name;

    $this->actingAs(workspaceManager($team->workspace))
        ->put(route('workspaces.details.update', $team->workspace), ['name' => $name, 'description' => null])
        ->assertSessionHasErrors('name');

    expect($team->workspace->fresh()->name)->toBe($before);
})->with(['empty' => [''], 'too long' => [str_repeat('a', 101)]]);

it('shows both descriptions on the workspace page', function () {
    $team = Team::factory()->create(['description' => 'Product squad']);
    $team->workspace->update(['description' => 'Nordic product teams']);

    $this->actingAs(teamMember($team))->get(route('workspaces.show', $team->workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->where('workspace.description', 'Nordic product teams')
            ->where('teams.0.description', 'Product squad'));
});
```

- [ ] **Step 2: Run it and see it fail** — `vendor/bin/sail artisan test --compact tests/Feature/Teams/DescriptionsTest.php` — Expected: FAIL (no `description` column).

- [ ] **Step 3: Implement**

`database/migrations/2026_10_23_100500_add_descriptions_to_teams_and_workspaces.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            $table->string('description', 200)->nullable();
        });

        Schema::table('workspaces', function (Blueprint $table) {
            $table->string('description', 200)->nullable();
        });
    }
};
```

`Team` and `Workspace`: `description` joins the fillable list and the docblock (`@property string|null $description`). `WorkspacePolicy::update(User $user, Workspace $workspace): bool` returns `$user->canManage($workspace)`.

`TeamsController::update` (the global middlewares trim strings and turn an empty one into null):

```php
    public function update(Request $request, Workspace $workspace, Team $team): RedirectResponse
    {
        Gate::authorize('update', $team);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['sometimes', 'nullable', 'string', 'max:200'],
        ]);

        $team->update($validated);

        return back();
    }
```

`app/Http/Controllers/WorkspaceDetailsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class WorkspaceDetailsController extends Controller
{
    /**
     * The name and the description of the workspace (owner's decision 7 B). The slug,
     * and so every address of the workspace, never changes.
     */
    public function update(Request $request, Workspace $workspace): RedirectResponse
    {
        Gate::authorize('update', $workspace);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:200'],
        ]);

        DB::transaction(function () use ($workspace, $validated): void {
            $locked = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();

            $locked->update(['name' => $validated['name'], 'description' => $validated['description'] ?? null]);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Workspace saved.')]);

        return back();
    }
}
```

The workspace row is locked as every other workspace write of this plan (the aggregate root first); `name` and `slug` stay fillable as they are, and only `name` and `description` are written here.

Route, in the workspace scope: `Route::put('details', [WorkspaceDetailsController::class, 'update'])->name('workspaces.details.update');`.

`WorkspacesController::show`: `'workspace' => $workspace->only(['id', 'name', 'slug', 'description'])`, `'canEditDetails' => $request->user()->can('update', $workspace)`, and each tile `...$team->only(['id', 'name', 'description'])`.

- [ ] **Step 4: Run the tests on PostgreSQL and SQLite** — `bin/test-db pgsql -- tests/Feature/Teams tests/Feature/Workspaces`, then `sqlite` — Expected: PASS (a test comparing the whole `workspace` prop gains `description => null`; list it).

- [ ] **Step 5: Commit** — `feat(workspaces): descriptions of a team and of a workspace; a workspace can be renamed` (trailer lines).

### Task 12 (lane F): The activity log

**Files:**
- Create: `app/Enums/TeamActivityKind.php`, `database/migrations/2026_10_23_100600_create_team_activities_table.php`, `app/Models/TeamActivity.php`, `database/factories/TeamActivityFactory.php`, `app/Actions/Teams/RecordTeamActivity.php`, `app/Actions/Teams/ListTeamActivity.php`
- Modify: `app/Models/Team.php` (`activities()`), `app/Actions/Retros/CreateRetro.php`, `app/Actions/Retros/ChangeRetroPhase.php`, `app/Actions/Poker/CreatePokerGame.php`, `app/Http/Controllers/Poker/PokerStatusesController.php`, `app/Actions/Whiteboards/CreateWhiteboard.php`, `app/Http/Controllers/TeamSurveys/TeamSurveyStatusesController.php`, `app/Actions/ActionItems/SetActionItemStatus.php`, `app/Http/Controllers/TeamMembersController.php` (`store`), `app/Http/Controllers/TeamsController.php` (`activity`)
- Test: `tests/Feature/Teams/TeamActivityTest.php`

Read first: each of the nine writers (the transaction each runs in; the actor each knows), `IntegrationProvider::label()`, `HasGuestIdentity::displayName()` and `avatarUrl()`.

**Interfaces:**
- Produces: `TeamActivityKind::{RetroStarted, RetroCompleted, PokerStarted, PokerEnded, WhiteboardCreated, SurveyPublished, SurveyClosed, ActionItemCompleted, MemberJoined}` (values `retro_started`, …); `RecordTeamActivity::handle(string $teamId, TeamActivityKind $kind, ?User $user, ?string $actorName = null, ?string $subjectId = null, ?string $subjectTitle = null): void`; `ListTeamActivity::handle(Team $team): array<int, array{id: string, kind: string, actor: array{name: string, avatarUrl: ?string}, subject: array{title: string, url: ?string}|null, at: string}>`; prop `teams/show.activity`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Teams/TeamActivityTest.php`:

```php
<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ExternalSyncActor;
use App\Actions\ActionItems\SetActionItemStatus;
use App\Actions\Teams\RecordTeamActivity;
use App\Enums\ActionItemStatus;
use App\Enums\TeamActivityKind;
use App\Enums\TeamRole;
use App\Enums\TeamSurveyQuestionKind;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamActivity;
use App\Models\TeamSurvey;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

function lastActivity(Team $team): TeamActivity
{
    return TeamActivity::query()->where('team_id', $team->id)->latest()->orderByDesc('id')->firstOrFail();
}

it('records the start of a retro, of a poker game and the creation of a whiteboard, by their creator', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $scope = [$team->workspace, $team];

    $this->actingAs($member)->post(route('teams.retros.store', $scope), ['title' => 'Sprint 42 retro', 'template' => 'start_stop_continue']);
    expect(lastActivity($team))->kind->toBe(TeamActivityKind::RetroStarted)->actor_user_id->toBe($member->id)->subject_title->toBe('Sprint 42 retro');

    $this->actingAs($member)->post(route('teams.pokerGames.store', $scope), ['title' => 'Refinement', 'deck' => 'fibonacci']);
    expect(lastActivity($team)->kind)->toBe(TeamActivityKind::PokerStarted);

    $this->actingAs($member)->post(route('teams.whiteboards.store', $scope), ['title' => 'Journey']);
    expect(lastActivity($team)->kind)->toBe(TeamActivityKind::WhiteboardCreated);
});

it('records the close of a retro by its facilitator and the end of a poker game', function () {
    $team = Team::factory()->create();
    $retro = Retro::factory()->for($team)->create(['phase' => \App\Enums\RetroPhase::Roti]);
    [$facilitator] = retroFacilitator($retro);

    $this->actingAs($facilitator)->putJson(route('retros.phase.update', $retro), ['phase' => 'completed'])->assertSuccessful();
    expect(lastActivity($team))->kind->toBe(TeamActivityKind::RetroCompleted)->actor_user_id->toBe($facilitator->id);

    $game = PokerGame::factory()->for($team)->create();
    [$host] = pokerFacilitator($game);

    $this->actingAs($host)->putJson(route('poker.status.update', $game), ['ended' => true])->assertSuccessful();
    $this->actingAs($host)->putJson(route('poker.status.update', $game), ['ended' => true])->assertSuccessful();

    expect(TeamActivity::query()->where('kind', TeamActivityKind::PokerEnded)->count())->toBe(1);
});

it('records publishing and closing a standalone survey, not an attached health check', function () {
    $team = Team::factory()->create();
    $survey = TeamSurvey::factory()->for($team)->create();
    surveyQuestion($survey, TeamSurveyQuestionKind::Scale);
    [$editor] = surveyFacilitator($survey);

    $this->actingAs($editor)->putJson(route('surveys.status.update', $survey), ['status' => 'open'])->assertSuccessful();
    expect(lastActivity($team)->kind)->toBe(TeamActivityKind::SurveyPublished);

    $this->actingAs($editor)->putJson(route('surveys.status.update', $survey), ['status' => 'closed'])->assertSuccessful();
    expect(lastActivity($team)->kind)->toBe(TeamActivityKind::SurveyClosed);
});

it('records the completion of an action item by a member, a guest or a tracker', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $complete = function (ActionItem $item, ActionItemActor|ExternalSyncActor $actor): void {
        DB::transaction(fn () => resolve(SetActionItemStatus::class)->handle(ActionItem::query()->lockForUpdate()->findOrFail($item->id), $actor, ActionItemStatus::Completed));
    };

    $complete(ActionItem::factory()->for($team)->create(['content' => 'Fix CI', 'assignee_user_id' => $member->id]), ActionItemActor::forUser($member));
    expect(lastActivity($team))->kind->toBe(TeamActivityKind::ActionItemCompleted)->subject_title->toBe('Fix CI')->actor_user_id->toBe($member->id);

    $complete(ActionItem::factory()->for($team)->create(), new ExternalSyncActor('jira', 'ATLAS-12'));
    expect(lastActivity($team))->actor_user_id->toBeNull()->actor_name->toBe('Jira');
});

it('records a member joining the team', function () {
    $team = Team::factory()->create();
    $newcomer = workspaceManager($team->workspace, \App\Enums\WorkspaceRole::Member);

    $this->actingAs(workspaceManager($team->workspace))->post(route('teams.members.store', [$team->workspace, $team]), ['user_id' => $newcomer->id]);

    expect(lastActivity($team))->kind->toBe(TeamActivityKind::MemberJoined)->actor_user_id->toBe($newcomer->id);
});

it('has the nine kinds of the spec and none about cards, votes, comments or answers', function () {
    expect(array_column(TeamActivityKind::cases(), 'value'))->toBe([
        'retro_started', 'retro_completed', 'poker_started', 'poker_ended', 'whiteboard_created',
        'survey_published', 'survey_closed', 'action_item_completed', 'member_joined',
    ]);
});

it('sends the ten latest lines, newest first, with a link while the subject exists', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $record = resolve(RecordTeamActivity::class);
    $kept = Retro::factory()->for($team)->create(['title' => 'Kept']);
    $gone = Retro::factory()->for($team)->create(['title' => 'Gone']);

    foreach (range(1, 9) as $minute) {
        $this->travelTo(now()->addMinute());
        $record->handle($team->id, TeamActivityKind::MemberJoined, $member);
    }

    $this->travelTo(now()->addMinute());
    $record->handle($team->id, TeamActivityKind::RetroStarted, $member, null, $gone->id, 'Gone');
    $this->travelTo(now()->addMinute());
    $record->handle($team->id, TeamActivityKind::RetroStarted, null, null, $kept->id, 'Kept');
    $gone->delete();

    $this->actingAs($member)->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->has('activity', 10)
            ->where('activity.0.subject', ['title' => 'Kept', 'url' => route('retros.show', $kept)])
            ->where('activity.0.actor.name', 'Former member')
            ->where('activity.1.subject', ['title' => 'Gone', 'url' => null])
            ->where('activity.1.actor.name', $member->name));
});
```

Read the bodies `teams.pokerGames.store`, `teams.whiteboards.store`, `retros.phase.update`, `poker.status.update` (route name: `grep -n "PokerStatusesController" routes/web.php`) and `surveys.status.update` validate, and the helpers `pokerFacilitator`, `surveyFacilitator`, `surveyQuestion`; fix the bodies before running.

- [ ] **Step 2: Run it and see it fail** — `vendor/bin/sail artisan test --compact tests/Feature/Teams/TeamActivityTest.php` — Expected: FAIL, `Class "App\Enums\TeamActivityKind" not found`.

- [ ] **Step 3: Enum, table, model, factory**

`app/Enums/TeamActivityKind.php`:

```php
<?php

namespace App\Enums;

enum TeamActivityKind: string
{
    case RetroStarted = 'retro_started';
    case RetroCompleted = 'retro_completed';
    case PokerStarted = 'poker_started';
    case PokerEnded = 'poker_ended';
    case WhiteboardCreated = 'whiteboard_created';
    case SurveyPublished = 'survey_published';
    case SurveyClosed = 'survey_closed';
    case ActionItemCompleted = 'action_item_completed';
    case MemberJoined = 'member_joined';
}
```

`database/migrations/2026_10_23_100600_create_team_activities_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_activities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 40);
            $table->foreignUuid('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_name', 100)->nullable();
            $table->uuid('subject_id')->nullable();
            $table->string('subject_title', 200)->nullable();
            $table->timestamps();

            $table->index(['team_id', 'created_at']);
        });
    }
};
```

`app/Models/TeamActivity.php`:

```php
<?php

namespace App\Models;

use App\Enums\TeamActivityKind;
use Database\Factories\TeamActivityFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_id
 * @property TeamActivityKind $kind
 * @property string|null $actor_user_id
 * @property string|null $actor_name
 * @property string|null $subject_id
 * @property string|null $subject_title
 * @property Carbon|null $created_at
 * @property-read User|null $actor
 */
#[Fillable(['team_id', 'kind', 'actor_user_id', 'actor_name', 'subject_id', 'subject_title'])]
class TeamActivity extends Model
{
    /** @use HasFactory<TeamActivityFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return BelongsTo<User, $this> */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    protected function casts(): array
    {
        return [
            'kind' => TeamActivityKind::class,
        ];
    }
}
```

`database/factories/TeamActivityFactory.php` (made with `make:factory`): `team_id` a `Team::factory()`, `kind` `TeamActivityKind::MemberJoined`, `actor_user_id` null, `actor_name` null, `subject_id` null, `subject_title` null.

`Team::activities(): HasMany<TeamActivity, $this>`.

- [ ] **Step 4: The recorder and the nine writers**

`app/Actions/Teams/RecordTeamActivity.php`:

```php
<?php

namespace App\Actions\Teams;

use App\Enums\TeamActivityKind;
use App\Models\TeamActivity;
use App\Models\User;

class RecordTeamActivity
{
    /**
     * Runs inside the transaction of the change it records, so that both are kept or neither.
     */
    public function handle(string $teamId, TeamActivityKind $kind, ?User $user, ?string $actorName = null, ?string $subjectId = null, ?string $subjectTitle = null): void
    {
        TeamActivity::query()->create([
            'team_id' => $teamId,
            'kind' => $kind,
            'actor_user_id' => $user?->id,
            'actor_name' => $user === null && $actorName !== null ? mb_substr($actorName, 0, 100) : null,
            'subject_id' => $subjectId,
            'subject_title' => $subjectTitle === null ? null : mb_substr($subjectTitle, 0, 200),
        ]);
    }
}
```

Writers (inject `RecordTeamActivity $recordTeamActivity` where the class has a constructor; in a controller method, as a method argument):

| Where | Line, after the change, inside its transaction |
|---|---|
| `CreateRetro::handle`, after the facilitator participant | `$this->recordTeamActivity->handle($team->id, TeamActivityKind::RetroStarted, $creator, null, $retro->id, $retro->title);` |
| `ChangeRetroPhase::handle`, a new private `recordCompletion(Retro $locked, RetroPhase $phase)` called beside `announceCompletion` | returns unless `$phase === RetroPhase::Completed`; `$facilitator = $locked->facilitator;` then `$this->recordTeamActivity->handle($locked->team_id, TeamActivityKind::RetroCompleted, $facilitator?->user, $facilitator?->user === null ? $facilitator?->displayName() : null, $locked->id, $locked->title);` |
| `CreatePokerGame::handle`, after the facilitator player | `$this->recordTeamActivity->handle($team->id, TeamActivityKind::PokerStarted, $creator, null, $game->id, $game->title);` |
| `PokerStatusesController::update`, in its transaction | `$wasEnded = $locked->ended_at !== null;` before the update; after it, when `$validated['ended'] && ! $wasEnded`: `$recordTeamActivity->handle($locked->team_id, TeamActivityKind::PokerEnded, $player->user, $player->user === null ? $player->displayName() : null, $locked->id, $locked->title);` |
| `CreateWhiteboard::handle`, after the scene copy | `$this->recordTeamActivity->handle($team->id, TeamActivityKind::WhiteboardCreated, $creator, null, $board->id, $board->title);` |
| `TeamSurveyStatusesController::update`, in its transaction | `$from = $locked->status;` before `handle`; after it, when `$locked->retro_id === null`: `SurveyPublished` when `$from === TeamSurveyStatus::Draft && $target === TeamSurveyStatus::Open`, `SurveyClosed` when `$target === TeamSurveyStatus::Closed`; actor `$respondent->user`, subject the survey's id and title |
| `SetActionItemStatus::handle`, in the `if ($completing)` block | `$this->recordCompletion($locked, $actor);` (below) |
| `TeamMembersController::store`, after the attach | `$recordTeamActivity->handle($team->id, TeamActivityKind::MemberJoined, User::query()->findOrFail($validated['user_id']));` |

`SetActionItemStatus` gains:

```php
    private function recordCompletion(ActionItem $item, ActionItemActor|ExternalSyncActor $actor): void
    {
        if ($actor instanceof ExternalSyncActor) {
            $this->recordTeamActivity->handle($item->team_id, TeamActivityKind::ActionItemCompleted, null, IntegrationProvider::tryFrom($actor->source)?->label() ?? $actor->source, $item->id, $item->content);

            return;
        }

        $guestName = $actor->user === null ? $actor->participant?->displayName() : null;

        $this->recordTeamActivity->handle($item->team_id, TeamActivityKind::ActionItemCompleted, $actor->user, $guestName, $item->id, $item->content);
    }
```

`SetActionItemStatus` runs inside its caller's transaction (it receives a locked item); `TeamMembersController::store` runs its attach and the record without a transaction today: wrap both in `DB::transaction`.

- [ ] **Step 5: The reader**

`app/Actions/Teams/ListTeamActivity.php`:

```php
<?php

namespace App\Actions\Teams;

use App\Enums\TeamActivityKind;
use App\Models\ActionItem;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamActivity;
use App\Models\TeamSurvey;
use App\Models\Whiteboard;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Collection as BaseCollection;

/**
 * @phpstan-type ActivityLine array{
 *     id: string,
 *     kind: string,
 *     actor: array{name: string, avatarUrl: ?string},
 *     subject: array{title: string, url: ?string}|null,
 *     at: string
 * }
 */
class ListTeamActivity
{
    public const int Limit = 10;

    /**
     * @return array<int, ActivityLine>
     */
    public function handle(Team $team): array
    {
        $activities = $team->activities()
            ->with('actor')
            ->latest()
            ->orderByDesc('id')
            ->limit(self::Limit)
            ->get();

        $existing = $this->existingSubjects($activities);

        return $activities->map(fn (TeamActivity $activity): array => [
            'id' => $activity->id,
            'kind' => $activity->kind->value,
            'actor' => [
                'name' => $activity->actor?->name ?? $activity->actor_name ?? __('Former member'),
                'avatarUrl' => $activity->actor?->avatarUrl(),
            ],
            'subject' => $activity->subject_title === null ? null : [
                'title' => $activity->subject_title,
                'url' => $existing->contains($activity->subject_id) ? $this->url($team, $activity) : null,
            ],
            'at' => (string) $activity->created_at?->toIso8601String(),
        ])->values()->all();
    }

    /**
     * The subjects of these lines that still exist, at most one query per kind of subject.
     *
     * @param  Collection<int, TeamActivity>  $activities
     * @return BaseCollection<int, string>
     */
    private function existingSubjects(Collection $activities): BaseCollection
    {
        $idsOf = fn (TeamActivityKind ...$kinds): array => $activities
            ->filter(fn (TeamActivity $activity): bool => in_array($activity->kind, $kinds, true) && $activity->subject_id !== null)
            ->pluck('subject_id')
            ->all();

        return collect()
            ->concat(Retro::query()->whereIn('id', $idsOf(TeamActivityKind::RetroStarted, TeamActivityKind::RetroCompleted))->pluck('id'))
            ->concat(PokerGame::query()->whereIn('id', $idsOf(TeamActivityKind::PokerStarted, TeamActivityKind::PokerEnded))->pluck('id'))
            ->concat(Whiteboard::query()->whereIn('id', $idsOf(TeamActivityKind::WhiteboardCreated))->pluck('id'))
            ->concat(TeamSurvey::query()->whereIn('id', $idsOf(TeamActivityKind::SurveyPublished, TeamActivityKind::SurveyClosed))->pluck('id'))
            ->concat(ActionItem::query()->whereIn('id', $idsOf(TeamActivityKind::ActionItemCompleted))->pluck('id'));
    }

    private function url(Team $team, TeamActivity $activity): ?string
    {
        $id = (string) $activity->subject_id;

        return match ($activity->kind) {
            TeamActivityKind::RetroStarted, TeamActivityKind::RetroCompleted => route('retros.show', $id),
            TeamActivityKind::PokerStarted, TeamActivityKind::PokerEnded => route('poker.show', $id),
            TeamActivityKind::WhiteboardCreated => route('whiteboards.show', $id),
            TeamActivityKind::SurveyPublished => route('surveys.show', $id),
            TeamActivityKind::SurveyClosed => route('surveys.results.show', $id),
            TeamActivityKind::ActionItemCompleted => route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'team' => $team->id]),
            TeamActivityKind::MemberJoined => null,
        };
    }
}
```

`TeamsController@show` gains `'activity' => $listTeamActivity->handle($team),` (inject `ListTeamActivity` in `show`).

- [ ] **Step 6: Run the tests on PostgreSQL and SQLite** — `bin/test-db pgsql -- tests/Feature/Teams tests/Feature/Retros tests/Feature/Poker tests/Feature/Whiteboards tests/Feature/TeamSurveys tests/Feature/ActionItems tests/Feature/Integrations`, then `sqlite` — Expected: PASS; a test that counts the queries of one of the nine writers gains one insert (list it with its new count).

- [ ] **Step 7: Commit** — `feat(teams): an activity log of nine kinds, written with the change it records` (trailer lines).

### Task 13 (lane F): Recent sessions of a team (TM-2)

**Files:**
- Create: `app/Actions/Teams/ListRecentTeamSessions.php`
- Modify: `app/Http/Controllers/TeamsController.php` (`recentSessions`)
- Test: `tests/Feature/Teams/RecentTeamSessionsTest.php`

Read first: `app/Actions/Sessions/ListTeamSessions.php` and `tests/Feature/Sessions/ListTeamSessionsTest.php` (plan 22, merged before this plan: the state of each kind, `LiveWithinMinutes`, the draft rule), plan 22's spec §6.1, `app/Actions/Search/ListRecentSessions.php` (the live-then-latest pattern), `PresentPokerGameSummary::withCounts`, `PresentTeamSurveySummary::withCounts`.

- [ ] **Step 1: Plan 22's rules (decision 9 A).** Plan 22 has merged (checked in **Branch and run**). When `ListTeamSessions` exposes the state of one session, or its per-kind state conditions, as public methods, `ListRecentTeamSessions` below calls them instead of its own `match` blocks and `LiveWithinMinutes`, and its test keeps the same expectations (they are plan 22's rules). When it does not, keep the class as written here, copy into its test the cases of plan 22's matrix that decide a state (one per kind and state), and name the duplication in the report. Either way, the props of the team page are the ones below, and "All sessions" leads to plan 22's Sessions page.

**Interfaces:**
- Produces: `ListRecentTeamSessions::handle(Team $team, User $viewer): array<int, array{kind: string, id: string, title: string, url: string, state: 'upcoming'|'live'|'finished', updatedAt: string, participants: int, meta: array<string, int|string|null>, outcome: array{kind: 'actions'|'answers'|'estimated', count: int}|null}>`; prop `teams/show.recentSessions`.

- [ ] **Step 2: Write the failing test**

`tests/Feature/Teams/RecentTeamSessionsTest.php`:

```php
<?php

use App\Actions\Teams\ListRecentTeamSessions;
use App\Enums\RetroPhase;
use App\Enums\TeamSurveyStatus;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\Whiteboard;

it('lists at most five sessions of the team, live ones first, then the latest', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);

    foreach (range(1, 6) as $day) {
        $this->travelTo(now()->addDay());
        Retro::factory()->for($team)->create(['title' => "Done {$day}", 'phase' => RetroPhase::Completed, 'completed_at' => now()]);
    }

    $this->travelTo(now()->subDays(30));
    $open = Retro::factory()->for($team)->create(['title' => 'Still open', 'started_at' => now()]);
    $this->travelBack();
    Retro::factory()->for(Team::factory()->create())->create(['title' => 'Another team']);

    $rows = resolve(ListRecentTeamSessions::class)->handle($team, $viewer);

    expect($rows)->toHaveCount(5)
        ->and($rows[0])->toMatchArray(['id' => $open->id, 'state' => 'live'])
        ->and(collect($rows)->pluck('title')->slice(1)->values()->all())->toBe(['Done 6', 'Done 5', 'Done 4', 'Done 3']);
});

it('gives each kind its state, participants and outcome', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    $closed = Retro::factory()->for($team)->create(['phase' => RetroPhase::Completed, 'completed_at' => now()]);
    Participant::factory()->count(3)->create(['retro_id' => $closed->id]);
    ActionItem::factory()->for($team)->count(2)->create(['retro_id' => $closed->id]);
    $upcoming = Retro::factory()->for($team)->create(['started_at' => null]);
    $survey = TeamSurvey::factory()->for($team)->closed()->create();
    $board = Whiteboard::factory()->for($team)->create();

    $rows = collect(resolve(ListRecentTeamSessions::class)->handle($team, $viewer))->keyBy('id');

    expect($rows[$closed->id])->toMatchArray(['state' => 'finished', 'participants' => 3, 'outcome' => ['kind' => 'actions', 'count' => 2]])
        ->and($rows[$upcoming->id]['state'])->toBe('upcoming')
        ->and($rows[$survey->id])->toMatchArray(['kind' => 'survey', 'state' => 'finished', 'outcome' => ['kind' => 'answers', 'count' => 0]])
        ->and($rows[$board->id])->toMatchArray(['kind' => 'whiteboard', 'state' => 'upcoming']);
});

it('shows a draft survey to its author only', function () {
    $team = Team::factory()->create();
    $author = teamMember($team);
    $draft = TeamSurvey::factory()->for($team)->create(['created_by_user_id' => $author->id]);

    $ids = fn ($user) => collect(resolve(ListRecentTeamSessions::class)->handle($team, $user))->pluck('id')->all();

    expect($ids($author))->toContain($draft->id)
        ->and($ids(teamMember($team)))->not->toContain($draft->id);
});

it('sends the list to the team page', function () {
    $team = Team::factory()->create();
    Retro::factory()->for($team)->create();

    $this->actingAs(teamMember($team))->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn ($page) => $page->has('recentSessions', 1));
});
```

Read the `closed()` state of `TeamSurveyFactory` and the participant and action-item factories; adapt the attributes.

- [ ] **Step 3: Run it and see it fail** — `vendor/bin/sail artisan test --compact tests/Feature/Teams/RecentTeamSessionsTest.php` — Expected: FAIL, class not found.

- [ ] **Step 4: Implement**

`app/Actions/Teams/ListRecentTeamSessions.php`:

```php
<?php

namespace App\Actions\Teams;

use App\Enums\RetroPhase;
use App\Enums\TeamSurveyStatus;
use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Whiteboard;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

/**
 * The team's latest sessions of every kind, live ones first. A session's state follows
 * plan 22's rules (spec §6.9): upcoming, live or finished.
 *
 * @phpstan-type RecentTeamSession array{
 *     kind: string,
 *     id: string,
 *     title: string,
 *     url: string,
 *     state: string,
 *     updatedAt: string,
 *     participants: int,
 *     meta: array<string, int|string|null>,
 *     outcome: array{kind: string, count: int}|null
 * }
 */
class ListRecentTeamSessions
{
    public const int Limit = 5;

    public const int LiveWithinMinutes = 15;

    /**
     * @return array<int, RecentTeamSession>
     */
    public function handle(Team $team, User $viewer): array
    {
        return collect()
            ->concat($this->retros($team))
            ->concat($this->pokerGames($team))
            ->concat($this->whiteboards($team))
            ->concat($this->surveys($team, $viewer))
            ->concat($this->rooms($team))
            ->sort(fn (array $first, array $second): int => [$second['state'] === 'live', $second['updatedAt'], $second['id']] <=> [$first['state'] === 'live', $first['updatedAt'], $first['id']])
            ->take(self::Limit)
            ->values()
            ->all();
    }

    /**
     * @return Collection<int, RecentTeamSession>
     */
    private function retros(Team $team): Collection
    {
        $query = fn (): Builder => Retro::query()->where('team_id', $team->id)->withCount(['participants', 'cards', 'actionItems']);

        return $this->liveThenLatest($query, fn (Builder $notEnded) => $notEnded->where('phase', '!=', RetroPhase::Completed->value))
            ->map(fn (Retro $retro): array => [
                'kind' => 'retro',
                'id' => $retro->id,
                'title' => $retro->title,
                'url' => route('retros.show', $retro),
                'state' => match (true) {
                    $retro->phase === RetroPhase::Completed => 'finished',
                    $retro->started_at === null && (int) $retro->cards_count === 0 => 'upcoming',
                    default => 'live',
                },
                'updatedAt' => $this->updatedAt($retro),
                'participants' => (int) $retro->participants_count,
                'meta' => ['phaseLabel' => $retro->phase->label(), 'cards' => (int) $retro->cards_count],
                'outcome' => $retro->phase === RetroPhase::Completed ? ['kind' => 'actions', 'count' => (int) $retro->action_items_count] : null,
            ]);
    }

    /**
     * @return Collection<int, RecentTeamSession>
     */
    private function pokerGames(Team $team): Collection
    {
        $query = fn (): Builder => PokerGame::query()->where('team_id', $team->id)->withCount([
            'tasks',
            'tasks as estimated_tasks_count' => fn (Builder $tasks) => $tasks->whereNotNull('estimated_at'),
            'tasks as played_tasks_count' => fn (Builder $tasks) => $tasks->whereHas('rounds'),
            'players' => fn (Builder $players) => $players->where('is_spectator', false),
        ]);

        return $this->liveThenLatest($query, fn (Builder $notEnded) => $notEnded->whereNull('ended_at'))
            ->map(fn (PokerGame $game): array => [
                'kind' => 'poker',
                'id' => $game->id,
                'title' => $game->title,
                'url' => route('poker.show', $game),
                'state' => match (true) {
                    $game->ended_at !== null => 'finished',
                    (int) $game->played_tasks_count === 0 => 'upcoming',
                    default => 'live',
                },
                'updatedAt' => $this->updatedAt($game),
                'participants' => (int) $game->players_count,
                'meta' => ['tasks' => (int) $game->tasks_count],
                'outcome' => $game->ended_at !== null ? ['kind' => 'estimated', 'count' => (int) $game->estimated_tasks_count] : null,
            ]);
    }

    /**
     * @return Collection<int, RecentTeamSession>
     */
    private function whiteboards(Team $team): Collection
    {
        $liveSince = now()->subMinutes(self::LiveWithinMinutes);
        $query = fn (): Builder => Whiteboard::query()
            ->where('team_id', $team->id)
            ->with('facilitator.user')
            ->withCount(['members', 'elements' => fn (Builder $elements) => $elements->where('is_deleted', false)]);

        return $this->liveThenLatest($query, fn (Builder $recent) => $recent->where('updated_at', '>=', $liveSince))
            ->map(fn (Whiteboard $board): array => [
                'kind' => 'whiteboard',
                'id' => $board->id,
                'title' => $board->title,
                'url' => route('whiteboards.show', $board),
                'state' => match (true) {
                    (int) $board->elements_count === 0 => 'upcoming',
                    $board->updated_at !== null && $board->updated_at->greaterThanOrEqualTo($liveSince) => 'live',
                    default => 'finished',
                },
                'updatedAt' => $this->updatedAt($board),
                'participants' => (int) $board->members_count,
                'meta' => ['facilitatorName' => $board->facilitator?->displayName()],
                'outcome' => null,
            ]);
    }

    /**
     * Standalone surveys; a draft is listed to its author and to the workspace's admins only.
     *
     * @return Collection<int, RecentTeamSession>
     */
    private function surveys(Team $team, User $viewer): Collection
    {
        $managesWorkspace = $viewer->canManage($team->workspace);
        $query = fn (): Builder => TeamSurvey::query()
            ->where('team_id', $team->id)
            ->whereNull('retro_id')
            ->when(! $managesWorkspace, fn (Builder $visible) => $visible->where(fn (Builder $either) => $either
                ->where('status', '!=', TeamSurveyStatus::Draft->value)
                ->orWhere('created_by_user_id', $viewer->id)))
            ->withCount(['questions', 'respondents as responses_count' => fn (Builder $respondents) => $respondents->whereHas('answers')]);

        return $this->liveThenLatest($query, fn (Builder $open) => $open->where('status', TeamSurveyStatus::Open->value))
            ->map(fn (TeamSurvey $survey): array => [
                'kind' => 'survey',
                'id' => $survey->id,
                'title' => $survey->title,
                'url' => $survey->status === TeamSurveyStatus::Closed ? route('surveys.results.show', $survey) : route('surveys.show', $survey),
                'state' => match ($survey->status) {
                    TeamSurveyStatus::Draft => 'upcoming',
                    TeamSurveyStatus::Open => 'live',
                    TeamSurveyStatus::Closed => 'finished',
                },
                'updatedAt' => $this->updatedAt($survey),
                'participants' => (int) $survey->responses_count,
                'meta' => ['questions' => (int) $survey->questions_count],
                'outcome' => $survey->status === TeamSurveyStatus::Closed ? ['kind' => 'answers', 'count' => (int) $survey->responses_count] : null,
            ]);
    }

    /**
     * Standalone named rooms; icebreakers belong to their retro.
     *
     * @return Collection<int, RecentTeamSession>
     */
    private function rooms(Team $team): Collection
    {
        $query = fn (): Builder => GameRoom::query()
            ->where('team_id', $team->id)
            ->whereNull('retro_id')
            ->whereNotNull('name')
            ->withCount(['players', 'rounds']);

        return $this->liveThenLatest($query, fn (Builder $playing) => $playing->whereNotNull('current_round_id'))
            ->map(fn (GameRoom $room): array => [
                'kind' => 'game',
                'id' => $room->id,
                'title' => (string) $room->name,
                'url' => route('games.show', $room),
                'state' => match (true) {
                    $room->current_round_id !== null => 'live',
                    (int) $room->rounds_count === 0 => 'upcoming',
                    default => 'finished',
                },
                'updatedAt' => $this->updatedAt($room),
                'participants' => (int) $room->players_count,
                'meta' => ['gameLabel' => $room->game->label()],
                'outcome' => null,
            ]);
    }

    /**
     * The live sessions of a kind are read apart from its latest ones, so that five
     * ended sessions never push a live one out.
     *
     * @template TModel of Model
     *
     * @param  Closure(): Builder<TModel>  $query
     * @param  Closure(Builder<TModel>): mixed  $live
     * @return Collection<int, TModel>
     */
    private function liveThenLatest(Closure $query, Closure $live): Collection
    {
        $liveQuery = $query();
        $live($liveQuery);

        $liveRows = $liveQuery->latest('updated_at')->orderByDesc('id')->limit(self::Limit)->get();
        $latestRows = $query()->latest('updated_at')->orderByDesc('id')->limit(self::Limit)->get();

        return $liveRows->concat($latestRows->whereNotIn('id', $liveRows->modelKeys()))->toBase();
    }

    private function updatedAt(Model $session): string
    {
        return (string) $session->getAttribute('updated_at')?->toIso8601String();
    }
}
```

Each kind reads at most ten rows with their aggregates: bounded (rule 2). The order compares ISO strings of one time zone, then ids (rule 7).

`TeamsController@show` gains `'recentSessions' => $listRecentTeamSessions->handle($team, $request->user()),`.

- [ ] **Step 5: Run the tests on PostgreSQL and SQLite** — `bin/test-db pgsql -- tests/Feature/Teams/RecentTeamSessionsTest.php tests/Feature/Teams`, then `sqlite` — Expected: PASS.

- [ ] **Step 6: Commit** — `feat(teams): the recent sessions of a team, live first, with participants and outcome` (trailer lines).

### Task 14 (lane F): Open actions, retro counts, the workspace tile's whiteboard line

**Files:**
- Modify: `app/Http/Controllers/TeamsController.php` (`openActionItems`, `overdueActionItemCount`, retro counts), `app/Actions/Retros/PresentTeamRetro.php` (`stats`), `app/Http/Controllers/WorkspacesController.php` (`activity.whiteboardsEditedToday`)
- Test: `tests/Feature/Teams/TeamPageDataTest.php`

**Interfaces:**
- Consumes: `ActionItemQuery::order(Builder)`, `PresentActionItem::handle(ActionItem, ?ActionItemActor, ?CarbonInterface)`, `ActionItem::presentationRelations()`, `ActionItem::today()`.
- Produces: props `teams/show.openActionItems` (at most five presented items), `overdueActionItemCount: int`; `retros[].stats: {participants: int, cards: int, groups: int, actionItems: int}`; workspace tiles `activity.whiteboardsEditedToday: int`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Teams/TeamPageDataTest.php`:

```php
<?php

use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\Whiteboard;
use Inertia\Testing\AssertableInertia as Assert;

it('sends the first five open action items, overdue first, with the overdue count', function () {
    $team = Team::factory()->create();
    $this->travelTo(\Carbon\CarbonImmutable::parse('2026-10-01 09:00', 'UTC'));
    $make = fn (string $content, ?string $dueOn, bool $done = false) => ActionItem::factory()->for($team)->create([
        'content' => $content,
        'due_on' => $dueOn,
        'completed_at' => $done ? now() : null,
    ]);
    $make('Later', '2026-10-20');
    $make('Late two', '2026-09-26');
    $make('No date', null);
    $make('Late one', '2026-09-20');
    $make('Soon', '2026-10-03');
    $make('Next week', '2026-10-08');
    $make('Done and late', '2026-09-01', true);

    $this->actingAs(teamMember($team))->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('overdueActionItemCount', 2)
            ->where('openActionItemCount', 6)
            ->has('openActionItems', 5)
            ->where('openActionItems.0.content', 'Late one')
            ->where('openActionItems.1.content', 'Late two')
            ->where('openActionItems.2.content', 'Soon'));
});

it('counts the participants, cards, groups and action items of each retro', function () {
    $team = Team::factory()->create();
    $retro = Retro::factory()->for($team)->create();
    Participant::factory()->count(2)->create(['retro_id' => $retro->id]);
    $parent = Card::factory()->create(['retro_id' => $retro->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'parent_card_id' => $parent->id]);
    Card::factory()->create(['retro_id' => $retro->id]);
    ActionItem::factory()->for($team)->create(['retro_id' => $retro->id]);

    $this->actingAs(teamMember($team))->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('retros.0.stats', ['participants' => 2, 'cards' => 3, 'groups' => 1, 'actionItems' => 1]));
});

it('counts the whiteboards edited today on the workspace tile', function () {
    $team = Team::factory()->create();
    $this->travelTo(\Carbon\CarbonImmutable::parse('2026-10-01 15:00', 'UTC'));
    Whiteboard::factory()->for($team)->create(['updated_at' => now()->subHours(2)]);
    Whiteboard::factory()->for($team)->create(['updated_at' => now()->subDay()]);

    $this->actingAs(teamMember($team))->get(route('workspaces.show', $team->workspace))
        ->assertInertia(fn (Assert $page) => $page->where('teams.0.activity.whiteboardsEditedToday', 1));
});
```

Read `CardFactory` (it may need a column and a participant) and adapt; a factory `updated_at` is kept when passed (`Whiteboard::factory()->create(['updated_at' => …])`), or set it with `$board->timestamps = false` and `save()`.

- [ ] **Step 2: Run it and see it fail** — `vendor/bin/sail artisan test --compact tests/Feature/Teams/TeamPageDataTest.php` — Expected: FAIL.

- [ ] **Step 3: Implement**

`TeamsController@show`: the retros query gains

```php
                ->withCount([
                    'participants',
                    'cards',
                    'cards as groups_count' => fn (Builder $cards) => $cards->whereNull('parent_card_id')->whereHas('children'),
                    'actionItems',
                ])
```

and the props gain:

```php
            'openActionItems' => $this->openActionItems($team, $request->user(), $presentActionItem),
            'overdueActionItemCount' => $team->actionItems()
                ->whereNull('completed_at')
                ->whereNotNull('due_on')
                ->where('due_on', '<', ActionItem::today()->toDateString())
                ->count(),
```

with (inject `PresentActionItem` in `show`):

```php
    /**
     * @return array<int, array<string, mixed>>
     */
    private function openActionItems(Team $team, User $viewer, PresentActionItem $presentActionItem): array
    {
        $query = $team->actionItems()->getQuery()
            ->whereNull('completed_at')
            ->with(ActionItem::presentationRelations())
            ->withCount('comments');

        return ActionItemQuery::order($query)
            ->limit(5)
            ->get()
            ->map(fn (ActionItem $item): array => $presentActionItem->handle($item, ActionItemActor::forUser($viewer), ActionItem::today()))
            ->all();
    }
```

`PresentTeamRetro::handle` adds (docblock shape updated):

```php
            'stats' => [
                'participants' => (int) $retro->getAttribute('participants_count'),
                'cards' => (int) $retro->getAttribute('cards_count'),
                'groups' => (int) $retro->getAttribute('groups_count'),
                'actionItems' => (int) $retro->getAttribute('action_items_count'),
            ],
```

`WorkspacesController::show`: `loadCount` gains `'whiteboards as whiteboards_edited_today_count' => fn ($boards) => $boards->where('updated_at', '>=', ActionItem::today()->startOfDay())`, and the tile's `activity` gains `'whiteboardsEditedToday' => (int) $team->whiteboards_edited_today_count` (`Team` docblock: `@property-read int|null $whiteboards_edited_today_count`).

- [ ] **Step 4: Run the tests on PostgreSQL and SQLite** — `bin/test-db pgsql -- tests/Feature/Teams tests/Feature/Workspaces`, then `sqlite` — Expected: PASS; `TeamRetroCardsTest` cases that compare a whole retro summary gain `stats` (list them).

- [ ] **Step 5: Commit** — `feat(teams): open action items overdue first, retro counts, whiteboards edited today` (trailer lines).

### Task 15 (lane F): Whiteboard thumbnails

**Files:**
- Create: `database/migrations/2026_10_23_100700_add_preview_to_whiteboards_table.php`, `app/Jobs/RefreshWhiteboardPreview.php`, `app/Actions/Teams/RefreshStaleWhiteboardPreviews.php`
- Modify: `app/Models/Whiteboard.php` (fillable, casts, docblock), `app/Actions/Whiteboards/WriteWhiteboardElements.php`, `CreateWhiteboard.php`, `PresentWhiteboardSummary.php` (`preview`), `app/Http/Controllers/TeamsController.php`
- Test: `tests/Feature/Whiteboards/WhiteboardPreviewTest.php`

Read first: `PresentWhiteboardPreview` (the shape `{width, height, shapes}`), `OrderWhiteboardElements::handle`, `ReadWhiteboardScene`, `WriteWhiteboardElements::handle` (the line `$locked->update(['seq' => $seq])`), `WhiteboardElementFactory`, one existing job (`app/Jobs/SyncTaskEstimate.php`) for the queue conventions.

**Interfaces:**
- Produces: `whiteboards.preview` (`array|null`), `whiteboards.preview_seq` (`?int`); `RefreshWhiteboardPreview::dispatch(string $whiteboardId)`; `RefreshStaleWhiteboardPreviews::handle(iterable<Whiteboard>)`; `PresentWhiteboardSummary` adds `preview: Preview|null`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Whiteboards/WhiteboardPreviewTest.php`:

```php
<?php

use App\Jobs\RefreshWhiteboardPreview;
use App\Models\Team;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;

it('builds the preview from the live elements without moving the edited date', function () {
    $board = Whiteboard::factory()->create(['seq' => 3, 'updated_at' => now()->subDays(2)]);
    WhiteboardElement::factory()->for($board)->create(['data' => ['id' => 'a', 'type' => 'rectangle', 'x' => 10, 'y' => 20, 'width' => 40, 'height' => 30, 'backgroundColor' => '#ffd966', 'strokeColor' => '#1e1e1e']]);
    WhiteboardElement::factory()->for($board)->create(['is_deleted' => true, 'data' => ['id' => 'b', 'type' => 'ellipse', 'x' => 0, 'y' => 0, 'width' => 5, 'height' => 5]]);
    $editedAt = $board->fresh()->updated_at->toIso8601String();

    (new RefreshWhiteboardPreview($board->id))->handle(
        resolve(\App\Actions\Whiteboards\OrderWhiteboardElements::class),
        resolve(\App\Actions\Whiteboards\PresentWhiteboardPreview::class),
    );

    $board->refresh();

    expect($board->preview_seq)->toBe(3)
        ->and($board->preview['shapes'])->toHaveCount(1)
        ->and($board->preview['shapes'][0])->toMatchArray(['kind' => 'rect', 'x' => 0, 'y' => 0, 'width' => 40, 'height' => 30, 'fill' => '#ffd966'])
        ->and($board->updated_at->toIso8601String())->toBe($editedAt);
});

it('queues a refresh when elements are written', function () {
    Queue::fake();
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)->putJson(route('whiteboards.elements.update', $board), [
        'elements' => [['id' => 'a1', 'type' => 'rectangle', 'x' => 0, 'y' => 0, 'width' => 10, 'height' => 10, 'version' => 1, 'versionNonce' => 1, 'index' => 'a0']],
    ])->assertOk();

    Queue::assertPushed(RefreshWhiteboardPreview::class, fn (RefreshWhiteboardPreview $job): bool => $job->whiteboardId === $board->id);
});

it('sends the preview to the team page and queues the boards whose preview is stale', function () {
    Queue::fake();
    $team = Team::factory()->create();
    $fresh = Whiteboard::factory()->for($team)->create(['seq' => 2, 'preview_seq' => 2, 'preview' => ['width' => 1, 'height' => 1, 'shapes' => []]]);
    $stale = Whiteboard::factory()->for($team)->create(['seq' => 5, 'preview_seq' => null]);

    $this->actingAs(teamMember($team))->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->where('whiteboards', fn ($boards) => collect($boards)->firstWhere('id', $fresh->id)['preview'] !== null
            && collect($boards)->firstWhere('id', $stale->id)['preview'] === null));

    Queue::assertPushed(RefreshWhiteboardPreview::class, 1);
});

it('does nothing for a board that is gone or already up to date', function () {
    $board = Whiteboard::factory()->create(['seq' => 2, 'preview_seq' => 2, 'preview' => ['width' => 1, 'height' => 1, 'shapes' => []]]);
    $run = fn (string $id) => (new RefreshWhiteboardPreview($id))->handle(
        resolve(\App\Actions\Whiteboards\OrderWhiteboardElements::class),
        resolve(\App\Actions\Whiteboards\PresentWhiteboardPreview::class),
    );

    $run((string) \Illuminate\Support\Str::uuid7());
    $run($board->id);

    expect($board->fresh()->preview)->toBe(['width' => 1, 'height' => 1, 'shapes' => []]);
});
```

The element payload accepted by `whiteboards.elements.update` is the one `SanitizeWhiteboardElement` keeps (read an existing elements test, e.g. `grep -rln "whiteboards.elements.update" tests/Feature`, and copy a valid element); the facilitator helper's name is read from `tests/Pest.php` (`grep -n "function whiteboard" tests/Pest.php`). The preview JSON is compared with `toBe` on a value written by the test and read back from a JSON column: use `toBeIgnoringKeyOrder` instead (rule 10).

- [ ] **Step 2: Run it and see it fail** — `vendor/bin/sail artisan test --compact tests/Feature/Whiteboards/WhiteboardPreviewTest.php` — Expected: FAIL.

- [ ] **Step 3: Implement**

`database/migrations/2026_10_23_100700_add_preview_to_whiteboards_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('whiteboards', function (Blueprint $table) {
            $table->json('preview')->nullable();
            $table->unsignedInteger('preview_seq')->nullable();
        });
    }
};
```

`Whiteboard`: `preview`, `preview_seq` join the fillable list; `casts()` gains `'preview' => 'array'` and `'preview_seq' => 'integer'`; docblock `@property array{width: int, height: int, shapes: list<array<string, mixed>>}|null $preview`, `@property int|null $preview_seq`.

`app/Jobs/RefreshWhiteboardPreview.php`:

```php
<?php

namespace App\Jobs;

use App\Actions\Whiteboards\OrderWhiteboardElements;
use App\Actions\Whiteboards\PresentWhiteboardPreview;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Builds a board's thumbnail with the template gallery's renderer. One per board waits at
 * a time; when it runs it reads the board as it is then.
 */
class RefreshWhiteboardPreview implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $uniqueFor = 120;

    public function __construct(public string $whiteboardId) {}

    public function uniqueId(): string
    {
        return $this->whiteboardId;
    }

    public function handle(OrderWhiteboardElements $orderWhiteboardElements, PresentWhiteboardPreview $presentWhiteboardPreview): void
    {
        $board = Whiteboard::query()->find($this->whiteboardId);

        if ($board === null || $board->preview_seq === $board->seq) {
            return;
        }

        $seq = $board->seq;
        $elements = $orderWhiteboardElements
            ->handle($board->elements()->where('is_deleted', false)->get())
            ->map(fn (WhiteboardElement $element): array => $element->data)
            ->values()
            ->all();

        $board->timestamps = false;
        $board->forceFill([
            'preview' => $presentWhiteboardPreview->handle($elements),
            'preview_seq' => $seq,
        ])->save();
    }
}
```

`$seq` is read before the elements: a write that lands in between leaves a preview newer than its `preview_seq`, and the next team page visit queues another refresh. `timestamps = false` keeps `updated_at` (spec §6.8) and skips no model event.

Dispatch points:
- `WriteWhiteboardElements::handle`, right after `$locked->update(['seq' => $seq]);`: `RefreshWhiteboardPreview::dispatch($locked->id)->afterCommit()->delay(now()->addSeconds(30));`
- `CreateWhiteboard::handle`, after the scene copy, when `$scene['elements'] !== []`: `RefreshWhiteboardPreview::dispatch($board->id)->afterCommit();`

`app/Actions/Teams/RefreshStaleWhiteboardPreviews.php`:

```php
<?php

namespace App\Actions\Teams;

use App\Jobs\RefreshWhiteboardPreview;
use App\Models\Whiteboard;

class RefreshStaleWhiteboardPreviews
{
    /**
     * Boards whose thumbnail is older than their content, boards of before the release
     * included, get one built by the queue.
     *
     * @param  iterable<Whiteboard>  $boards
     */
    public function handle(iterable $boards): void
    {
        foreach ($boards as $board) {
            if ($board->preview_seq === $board->seq) {
                continue;
            }

            RefreshWhiteboardPreview::dispatch($board->id);
        }
    }
}
```

`TeamsController@show`: the whiteboards are read once into `$whiteboards = $team->whiteboards()->with('facilitator.user')->latest('updated_at')->orderByDesc('id')->get();`, passed to `$refreshStaleWhiteboardPreviews->handle($whiteboards)`, and mapped as today. `PresentWhiteboardSummary::handle` adds `'preview' => $board->preview` (docblock updated).

- [ ] **Step 4: Run the tests on PostgreSQL and SQLite** — `bin/test-db pgsql -- tests/Feature/Whiteboards tests/Feature/Teams`, then `sqlite` — Expected: PASS; whiteboard summary tests comparing whole arrays gain `preview` (list them).

- [ ] **Step 5: Commit** — `feat(whiteboards): a cached thumbnail per board, built by the queue` (trailer lines).

---

## Step C — single writer, after lanes R, T and F are merged

### Task 16: Team settings pages — back end

**Files:**
- Create: `app/Http/Controllers/TeamSettingsController.php`, `app/Http/Controllers/TeamDataController.php`, `app/Actions/Teams/TeamSettingsSections.php`, `app/Actions/Teams/MemberLastActivity.php`, `app/Actions/Teams/AvailableTeamMembers.php`, `app/Actions/Teams/PresentTeamSprints.php`, thin pages `resources/js/pages/teams/settings.tsx`, `members.tsx`, `data.tsx`
- Modify: `app/Http/Controllers/TeamMembersController.php` (`index`), `app/Http/Controllers/TeamsController.php` (`availableMembers` through `AvailableTeamMembers`), `app/Http/Controllers/Integrations/TeamIntegrationsController.php` (`sections`), `app/Http/Middleware/HandleInertiaRequests.php` (`currentTeam.viewerRole`, `currentTeam.settingsUrl`), `app/Models/User.php` (five session relations), `routes/web.php`
- Test: `tests/Feature/Teams/TeamSettingsPagesTest.php`

Read first: `TeamIntegrationsController::index` (its props, its authorisation), `HandleInertiaRequests::currentTeam`, `tests/Feature/SharedPropsTest.php` (it may compare `currentTeam` whole), the foreign keys of `participants`, `poker_players`, `whiteboard_members`, `game_players`, `team_survey_respondents` (their migrations), plan 19's survey export guard (`TeamSurveyExportsController`: editors are the survey's creator and workspace admins).

**Interfaces:**
- Consumes: Tasks 2, 6, 7, 8, 9, 10 (`TeamRole::options`, `SprintCalendar::fromToday`, `TeamSprint::present`, `StartNextSprint::preview`, `SuggestedFacilitator::for`, `TeamTemplateUsage`, `TemplateAvailability`, `BuildTemplateCatalogue::handle(Workspace, User, ?Team)`).
- Produces: routes `teams.settings.show`, `teams.members.index`, `teams.data.show`; `TeamSettingsSections::handle(User, Team): array{general: bool, members: bool, integrations: bool, data: bool, firstUrl: ?string}`; shared prop `currentTeam: {id, name, membersCount, viewerRole: ?string, settingsUrl: ?string}`; the props of the three pages listed in Step 3.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Teams/TeamSettingsPagesTest.php`:

```php
<?php

use App\Enums\TeamRole;
use App\Enums\TeamSurveyStatus;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use Inertia\Testing\AssertableInertia as Assert;

it('opens the General tab to owners and admins only', function () {
    $team = Team::factory()->create(['description' => 'Product squad']);
    $route = route('teams.settings.show', [$team->workspace, $team]);

    $this->actingAs(teamMember($team, TeamRole::Facilitator))->get($route)->assertForbidden();
    $this->actingAs(teamMember($team, TeamRole::Owner))->get($route)
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/settings')
            ->where('team.description', 'Product squad')
            ->where('canDelete', false)
            ->where('sections.general', true));
    $this->actingAs(workspaceManager($team->workspace))->get($route)
        ->assertInertia(fn (Assert $page) => $page->where('canDelete', true));
});

it('opens Members & rituals to facilitators with the members read-only, and refuses members', function () {
    $team = Team::factory()->create();
    $route = route('teams.members.index', [$team->workspace, $team]);

    $this->actingAs(teamMember($team))->get($route)->assertForbidden();
    $this->actingAs(teamMember($team, TeamRole::Facilitator))->get($route)
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/members')
            ->where('canManageMembers', false)
            ->where('availableMembers', [])
            ->has('roleOptions', 4)
            ->has('templates'));
});

it('sends the sprints, the next start and the suggested facilitator to Members & rituals', function () {
    $team = Team::factory()->create(['retro_weekday' => 4]);
    teamSprint($team, 41, '2026-09-07', '2026-09-20');
    teamSprint($team, 42, '2026-09-21', '2026-10-04');
    $this->travelTo(\Carbon\CarbonImmutable::parse('2026-09-30 10:00', 'UTC'));

    $this->actingAs(teamMember($team, TeamRole::Facilitator))->get(route('teams.members.index', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('sprints.current.number', 42)
            ->where('sprints.list.0.number', 42)
            ->where('sprints.list.0.isCurrent', true)
            ->where('sprints.total', 2)
            ->where('sprints.nextRetro.date', '2026-10-01')
            ->where('sprints.nextStart', ['number' => 43, 'startsOn' => '2026-09-30', 'endsOn' => '2026-10-13', 'refusal' => null])
            ->where('facilitators.suggested', null));
});

it('gives each member the date of their latest session row in this team', function () {
    $team = Team::factory()->create();
    $facilitator = teamMember($team, TeamRole::Facilitator);
    $member = teamMember($team);
    $this->travelTo(\Carbon\CarbonImmutable::parse('2026-09-28 10:00', 'UTC'));
    Participant::factory()->create(['retro_id' => Retro::factory()->for($team)->create()->id, 'user_id' => $member->id]);
    $this->travelTo(\Carbon\CarbonImmutable::parse('2026-09-30 10:00', 'UTC'));
    Participant::factory()->create(['retro_id' => Retro::factory()->create()->id, 'user_id' => $member->id]);

    $this->actingAs($facilitator)->get(route('teams.members.index', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->where('members', fn ($members) => collect($members)->firstWhere('id', $member->id)['lastActiveAt'] === '2026-09-28T10:00:00+00:00'
            && collect($members)->firstWhere('id', $facilitator->id)['lastActiveAt'] === null));
});

it('links Data & export to plan 24 action items CSV of the team', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team, TeamRole::Owner))->get(route('teams.data.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->where('actionItemsExportUrl', route('workspaces.actionItemCsvExports.show', ['workspace' => $team->workspace, 'team' => $team->id])));
});

it('lists on Data & export the closed surveys the viewer may export', function () {
    $team = Team::factory()->create();
    $owner = teamMember($team, TeamRole::Owner);
    $mine = TeamSurvey::factory()->for($team)->closed()->create(['created_by_user_id' => $owner->id]);
    TeamSurvey::factory()->for($team)->closed()->create(['created_by_user_id' => teamMember($team)->id]);
    TeamSurvey::factory()->for($team)->open()->create(['created_by_user_id' => $owner->id]);

    $this->actingAs($owner)->get(route('teams.data.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/data')
            ->has('closedSurveys', 1)
            ->where('closedSurveys.0.id', $mine->id)
            ->where('closedSurveys.0.exportUrl', route('surveys.export.show', $mine)));
});

it('leads the team settings entry where the viewer may go, and names their role', function (?TeamRole $role, ?string $routeName) {
    $team = Team::factory()->create();
    $user = $role === null ? workspaceManager($team->workspace) : teamMember($team, $role);

    $this->actingAs($user)->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('currentTeam.viewerRole', $role?->value)
            ->where('currentTeam.settingsUrl', $routeName === null ? null : route($routeName, [$team->workspace, $team])));
})->with([
    'admin' => [null, 'teams.settings.show'],
    'owner' => [TeamRole::Owner, 'teams.settings.show'],
    'facilitator' => [TeamRole::Facilitator, 'teams.members.index'],
    'member' => [TeamRole::Member, null],
    'observer' => [TeamRole::Observer, null],
]);
```

`currentTeam` is the team the visit resolves (`CurrentTeamResolver`); read how it picks the team on `teams.show` and adapt if it reads a remembered team instead.

- [ ] **Step 2: Run it and see it fail** — `vendor/bin/sail artisan test --compact tests/Feature/Teams/TeamSettingsPagesTest.php` — Expected: FAIL, routes not defined.

- [ ] **Step 3: Implement**

`User` gains five relations (each a `HasMany` of the session row, by `user_id`): `retroParticipations()` (`Participant`), `pokerPlayers()` (`PokerPlayer`), `whiteboardMemberships()` (`WhiteboardMember`), `gamePlayers()` (`GamePlayer`), `surveyRespondents()` (`TeamSurveyRespondent`).

`app/Actions/Teams/MemberLastActivity.php`:

```php
<?php

namespace App\Actions\Teams;

use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Whiteboard;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Date;

class MemberLastActivity
{
    private const array Aggregates = ['last_retro_at', 'last_poker_at', 'last_whiteboard_at', 'last_game_at', 'last_survey_at'];

    /**
     * The latest row of each member in this team's sessions, as an ISO date, by user id.
     *
     * @return array<string, ?string>
     */
    public function handle(Team $team): array
    {
        $inTeam = fn (string $model): Builder => $model::query()->select('id')->where('team_id', $team->id);

        $members = $team->members()
            ->withMax(['retroParticipations as last_retro_at' => fn (Builder $rows) => $rows->whereIn('retro_id', $inTeam(Retro::class))], 'updated_at')
            ->withMax(['pokerPlayers as last_poker_at' => fn (Builder $rows) => $rows->whereIn('poker_game_id', $inTeam(PokerGame::class))], 'updated_at')
            ->withMax(['whiteboardMemberships as last_whiteboard_at' => fn (Builder $rows) => $rows->whereIn('whiteboard_id', $inTeam(Whiteboard::class))], 'updated_at')
            ->withMax(['gamePlayers as last_game_at' => fn (Builder $rows) => $rows->whereIn('game_room_id', $inTeam(GameRoom::class))], 'updated_at')
            ->withMax(['surveyRespondents as last_survey_at' => fn (Builder $rows) => $rows->whereIn('team_survey_id', $inTeam(TeamSurvey::class))], 'updated_at')
            ->get();

        return $members->mapWithKeys(fn (User $member): array => [$member->id => $this->latest($member)])->all();
    }

    private function latest(User $member): ?string
    {
        $dates = collect(self::Aggregates)
            ->map(fn (string $aggregate): mixed => $member->getAttribute($aggregate))
            ->filter(fn (mixed $value): bool => $value !== null)
            ->map(fn (mixed $value): CarbonInterface => Date::parse((string) $value));

        if ($dates->isEmpty()) {
            return null;
        }

        return $dates->sortDesc()->first()?->toIso8601String();
    }
}
```

The aggregates come back as strings whose form differs per engine; they are parsed in PHP (rule 2). The set is the team's members (bounded).

`app/Actions/Teams/AvailableTeamMembers.php` (moved from `TeamsController`, used by both pages):

```php
<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Models\User;
use App\Support\Alphabetical;

class AvailableTeamMembers
{
    /**
     * Members of the workspace who are not in the team, by name.
     *
     * @return array<int, array{id: string, name: string, email: string, avatarUrl: string}>
     */
    public function handle(Team $team): array
    {
        $members = $team->workspace->members()
            ->whereNotIn('users.id', $team->members()->select('users.id'))
            ->orderBy('users.id')
            ->get();

        return Alphabetical::sort($members, fn (User $member): string => $member->name)
            ->map(fn (User $member): array => [...$member->only(['id', 'name', 'email']), 'avatarUrl' => $member->avatarUrl()])
            ->values()
            ->all();
    }
}
```

`app/Actions/Teams/TeamSettingsSections.php`:

```php
<?php

namespace App\Actions\Teams;

use App\Enums\IntegrationProvider;
use App\Models\Team;
use App\Models\User;

class TeamSettingsSections
{
    /**
     * Which tabs of the team settings this person may open, and where the entry leads.
     *
     * @return array{general: bool, members: bool, integrations: bool, data: bool, firstUrl: ?string}
     */
    public function handle(User $user, Team $team): array
    {
        $general = $user->can('update', $team);
        $members = $user->can('manageRituals', $team);
        $integrations = IntegrationProvider::anyEnabled() && $user->can('manageIntegrations', $team);
        $scope = [$team->workspace, $team];

        $firstUrl = match (true) {
            $general => route('teams.settings.show', $scope),
            $members => route('teams.members.index', $scope),
            $integrations => route('teams.integrations.index', $scope),
            default => null,
        };

        return ['general' => $general, 'members' => $members, 'integrations' => $integrations, 'data' => $general, 'firstUrl' => $firstUrl];
    }
}
```

`app/Http/Controllers/TeamSettingsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Teams\TeamSettingsSections;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamSettingsController extends Controller
{
    public function show(Request $request, Workspace $workspace, Team $team, TeamSettingsSections $sections): Response
    {
        Gate::authorize('update', $team);

        return Inertia::render('teams/settings', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name', 'description']),
            'createdAt' => $team->created_at?->toIso8601String(),
            'membersCount' => $team->members()->count(),
            'canDelete' => $request->user()->can('delete', $team),
            'sections' => $sections->handle($request->user(), $team),
        ]);
    }
}
```

`app/Http/Controllers/TeamDataController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Teams\TeamSettingsSections;
use App\Enums\TeamSurveyStatus;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\Workspace;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamDataController extends Controller
{
    public const MaxSurveys = 50;

    public function show(Request $request, Workspace $workspace, Team $team, TeamSettingsSections $sections): Response
    {
        Gate::authorize('update', $team);

        $user = $request->user();

        return Inertia::render('teams/data', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name', 'description']),
            'sections' => $sections->handle($user, $team),
            'closedSurveys' => $team->teamSurveys()
                ->whereNull('retro_id')
                ->where('status', TeamSurveyStatus::Closed->value)
                ->when(! $user->canManage($workspace), fn ($surveys) => $surveys->where('created_by_user_id', $user->id))
                ->latest('closed_at')
                ->orderByDesc('id')
                ->limit(self::MaxSurveys)
                ->get(['id', 'title', 'closed_at'])
                ->map(fn (TeamSurvey $survey): array => [
                    'id' => $survey->id,
                    'title' => $survey->title,
                    'closedAt' => $survey->closed_at?->toIso8601String(),
                    'exportUrl' => route('surveys.export.show', $survey),
                ]),
            'estimatesUrl' => route('teams.estimates.index', [$workspace, $team]),
            'actionItemsExportUrl' => route('workspaces.actionItemCsvExports.show', ['workspace' => $workspace, 'team' => $team->id]),
        ]);
    }
}
```

`TeamMembersController::index` (inject the actions as method arguments):

```php
    public function index(
        Request $request,
        Workspace $workspace,
        Team $team,
        MemberLastActivity $memberLastActivity,
        AvailableTeamMembers $availableTeamMembers,
        TeamTemplateUsage $teamTemplateUsage,
        PresentTeamSprints $presentTeamSprints,
        SuggestedFacilitator $suggestedFacilitator,
        TemplateAvailability $templateAvailability,
        BuildTemplateCatalogue $buildTemplateCatalogue,
        TeamSettingsSections $sections,
    ): Response {
        Gate::authorize('manageRituals', $team);

        $user = $request->user();
        $canManageMembers = $user->can('manageMembers', $team);
        $lastActivity = $memberLastActivity->handle($team);
        $defaultKey = $team->default_retro_template;
        $person = fn (User $member): array => [...$member->only(['id', 'name']), 'avatarUrl' => $member->avatarUrl()];

        return Inertia::render('teams/members', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name', 'description']),
            'sections' => $sections->handle($user, $team),
            'members' => Alphabetical::sort($team->members()->orderBy('users.id')->get(), fn (User $member): string => $member->name)
                ->map(fn (User $member): array => [
                    ...$member->only(['id', 'name', 'email']),
                    'avatarUrl' => $member->avatarUrl(),
                    'role' => $member->teamMembership->role->value,
                    'lastActiveAt' => $lastActivity[$member->id] ?? null,
                    'isViewer' => $member->id === $user->id,
                ])
                ->values(),
            'canManageMembers' => $canManageMembers,
            'roleOptions' => TeamRole::options(),
            'availableMembers' => $canManageMembers ? $availableTeamMembers->handle($team) : [],
            'sprints' => $presentTeamSprints->handle($team, now()),
            'rituals' => [
                'sprintLengthWeeks' => $team->sprint_length_weeks,
                'retroWeekday' => $team->retro_weekday,
                'retroTime' => $team->retro_time,
            ],
            'facilitators' => [
                'list' => $team->defaultFacilitators()->get()->map($person)->values(),
                'rotation' => $team->facilitator_rotation_enabled,
                'suggested' => $suggestedFacilitator->for($team)?->only(['id', 'name']),
                'candidates' => Alphabetical::sort(
                    $team->members()->wherePivotIn('role', [TeamRole::Owner->value, TeamRole::Facilitator->value])->orderBy('users.id')->get(),
                    fn (User $member): string => $member->name,
                )->map($person)->values(),
            ],
            'templates' => $teamTemplateUsage->handle($team, $user),
            'defaultRetroTemplate' => $defaultKey !== null && $templateAvailability->isAvailable($team, $user, $defaultKey) ? $defaultKey : null,
            'categories' => TemplateCategory::options(),
            'catalogue' => Inertia::optional(fn (): array => $buildTemplateCatalogue->handle($workspace, $user, $team)),
        ]);
    }
```

`app/Actions/Teams/PresentTeamSprints.php` (the Sprints card of Task 21):

```php
<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Models\TeamSprint;
use App\Support\Teams\SprintCalendar;
use Carbon\CarbonInterface;

class PresentTeamSprints
{
    public const int MaxListed = 52;

    public function __construct(private StartNextSprint $startNextSprint) {}

    /**
     * The latest sprints first (a year of weekly sprints at most), the current one,
     * the next retro, and what "Start the next sprint" would do now.
     *
     * @return array{
     *     list: list<array{id: string, number: int, startsOn: string, endsOn: string, isCurrent: bool}>,
     *     total: int,
     *     current: array{id: string, number: int, startsOn: string, endsOn: string}|null,
     *     nextRetro: array{date: string, time: ?string}|null,
     *     nextStart: array{number: int, startsOn: string, endsOn: string, refusal: ?string}
     * }
     */
    public function handle(Team $team, CarbonInterface $now): array
    {
        $calendar = SprintCalendar::fromToday($team, $now);
        $current = $calendar->sprintOn($now);

        $list = TeamSprint::query()
            ->where('team_id', $team->id)
            ->orderByDesc('starts_on')
            ->orderByDesc('id')
            ->limit(self::MaxListed)
            ->get()
            ->map(fn (TeamSprint $sprint): array => [...$sprint->present(), 'isCurrent' => $sprint->id === ($current['id'] ?? null)])
            ->values()
            ->all();

        return [
            'list' => $list,
            'total' => $team->sprints()->count(),
            'current' => $current,
            'nextRetro' => $calendar->nextRetro($now),
            'nextStart' => $this->startNextSprint->preview($team, $now),
        ];
    }
}
```

`TeamsController@show`: `'availableMembers' => $canManage ? $availableTeamMembers->handle($team) : []`.

`TeamIntegrationsController::index` gains `'sections' => $sections->handle($request->user(), $team)`.

`HandleInertiaRequests::currentTeam(CurrentTeamResolver $resolver, Request $request)` returns, besides `id`, `name`, `membersCount`:

```php
            'viewerRole' => $user === null ? null : $team->roleOf($user)?->value,
            'settingsUrl' => $user === null ? null : $this->teamSettingsSections->handle($user, $team)['firstUrl'],
```

(inject `TeamSettingsSections` in the middleware's constructor; the closure passes `$request`; update the return docblock).

Routes, in the team scope:

```php
            Route::get('teams/{team}/settings', [TeamSettingsController::class, 'show'])->name('teams.settings.show');
            Route::get('teams/{team}/members', [TeamMembersController::class, 'index'])->name('teams.members.index');
            Route::get('teams/{team}/data', [TeamDataController::class, 'show'])->name('teams.data.show');
```

Thin pages, each the same shape (Task 19 and 20 replace them):

```tsx
import { Head } from '@inertiajs/react';
import { useTrans } from '@/hooks/use-trans';

export default function TeamSettingsPage() {
    const { t } = useTrans();

    return <Head title={t('Team settings')} />;
}
```

- [ ] **Step 4: Run the tests on PostgreSQL and SQLite** — `bin/test-db pgsql -- tests/Feature/Teams tests/Feature/SharedPropsTest.php tests/Feature/Integrations tests/Arch`, then `sqlite` — Expected: PASS (`SharedPropsTest` gains the two keys if it compares `currentTeam` whole; list it).

- [ ] **Step 5: Gates and commit** — `npm run types:check`, `npm run check`, `npm run build:front`; commit `feat(teams): the General, Members & rituals and Data & export pages of the team settings` (trailer lines).

### Task 17: Front foundation — types, pure logic, shared components

**Files:**
- Create: `resources/js/lib/teams/roles.ts`, `sprint.ts`, `activity.ts`, `session-rows.ts`, `facilitator.ts` (+ `.test.ts` each); `resources/js/components/team-settings/team-settings-shell.tsx` (moved from `components/integrations/`, + test moved)
- Modify: `resources/js/types/workspaces.ts`, `resources/js/components/skrum/session-card.tsx` (+ test: `stats.groups`), `resources/js/lib/teams/settings-href.ts` (+ test), `resources/js/pages/teams/integrations.tsx` (new shell path, `sections`), `resources/js/components/teams/team-page.tsx` (props type only), `resources/js/pages/dev/sections/*` that render the moved shell or `SessionCard`

**Interfaces:**
- Produces the types and functions below; `TeamSettingsShell` with `active: 'general' | 'members' | 'integrations' | 'data'` and a `sections` prop; `SessionCardProps['stats']` gains `groups?: number`; `teamSettingsHref` reads `currentTeam.settingsUrl`.

- [ ] **Step 1: Types** (`types/workspaces.ts`)

```ts
export type TeamRole = 'owner' | 'facilitator' | 'member' | 'observer';

export type TeamRoleOption = { value: TeamRole; label: string };

export type TeamMember = MemberSummary & {
    avatarUrl: string;
    role?: TeamRole;
};

export type Sprint = { id: string; number: number; startsOn: string; endsOn: string };
export type NextRetro = { date: string; time: string | null };
export type TeamSchedule = { sprint: Sprint | null; nextRetro: NextRetro | null };
export type TeamSprintRow = Sprint & { isCurrent: boolean };
export type NextSprintStart = { number: number; startsOn: string; endsOn: string; refusal: string | null };
export type TeamSprintsPanel = { list: TeamSprintRow[]; total: number; current: Sprint | null; nextRetro: NextRetro | null; nextStart: NextSprintStart };
export type TeamRituals = { sprintLengthWeeks: number | null; retroWeekday: number | null; retroTime: string | null };
export type FacilitatorOption = { id: string; name: string; avatarUrl: string };

export type RetroStats = { participants: number; cards: number; groups: number; actionItems: number };

export type TeamActivityKind =
    | 'retro_started'
    | 'retro_completed'
    | 'poker_started'
    | 'poker_ended'
    | 'whiteboard_created'
    | 'survey_published'
    | 'survey_closed'
    | 'action_item_completed'
    | 'member_joined';

export type TeamActivityLine = {
    id: string;
    kind: TeamActivityKind;
    actor: { name: string; avatarUrl: string | null };
    subject: { title: string; url: string | null } | null;
    at: string;
};

export type RecentSessionRow = {
    kind: 'retro' | 'poker' | 'whiteboard' | 'survey' | 'game';
    id: string;
    title: string;
    url: string;
    state: 'upcoming' | 'live' | 'finished';
    updatedAt: string;
    participants: number;
    meta: { phaseLabel?: string; cards?: number; tasks?: number; facilitatorName?: string | null; questions?: number; gameLabel?: string };
    outcome: { kind: 'actions' | 'answers' | 'estimated'; count: number } | null;
};

export type TeamSettingsSections = { general: boolean; members: boolean; integrations: boolean; data: boolean; firstUrl: string | null };

export type TemplateVisibility = 'personal' | 'team' | 'workspace';
```

`RetroSummary` gains `stats: RetroStats`; the "New session" options type of plan 22 gains `currentSprintNumber: number | null`, `defaultRetroTemplate: string | null`, `retroFacilitators: FacilitatorOption[]`, `suggestedFacilitatorId: string | null`, `facilitatorRotation: boolean`; the retro snapshot's viewer type gains `canTakeControl: boolean`; `WorkspaceSummary` gains `description?: string | null`; `WorkspaceTeamTile` gains `description: string | null` and `activity.openRetroSprint: number | null`, `activity.whiteboardsEditedToday: number`; `CurrentTeam` gains `viewerRole: TeamRole | null; settingsUrl: string | null`; `WhiteboardSummary` (`types/poker.ts`) gains `preview: WhiteboardPreview | null`.

- [ ] **Step 2: Pure logic, test first**

`lib/teams/sprint.ts`:

```ts
import type { NextRetro, Sprint } from '@/types';

type Translate = (key: string, replacements?: Record<string, string | number>) => string;

/** A `Y-m-d` day as a date at midnight UTC, so that formatting never shifts it by the viewer's time zone. */
export function calendarDay(date: string): Date {
    const [year, month, day] = date.split('-').map(Number);

    return new Date(Date.UTC(year, month - 1, day));
}

export function formatDay(date: string, locale: string): string {
    return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(calendarDay(date));
}

export function formatTime(time: string, locale: string): string {
    const [hours, minutes] = time.split(':').map(Number);

    return new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        ...(minutes === 0 ? {} : { minute: '2-digit' }),
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(2000, 0, 1, hours, minutes)));
}

export function formatShortDay(date: string, locale: string): string {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(calendarDay(date));
}

export function sprintTitle(sprint: Pick<Sprint, 'number'>, t: Translate): string {
    return t('Sprint :number', { number: sprint.number });
}

/** "21 Sep → 4 Oct" */
export function sprintRange(sprint: Pick<Sprint, 'startsOn' | 'endsOn'>, locale: string): string {
    return `${formatShortDay(sprint.startsOn, locale)} → ${formatShortDay(sprint.endsOn, locale)}`;
}

export function nextRetroLabel(next: NextRetro, locale: string, t: Translate): string {
    const date = formatDay(next.date, locale);

    if (next.time === null) {
        return t('Next retro :date', { date });
    }

    return t('Next retro :date, :time', { date, time: formatTime(next.time, locale) });
}

/** The name the retro form proposes: "Sprint 42 retro", or nothing outside every sprint. */
export function retroNamePrefill(sprintNumber: number | null, t: Translate): string | undefined {
    if (sprintNumber === null) {
        return undefined;
    }

    return t('Sprint :number retro', { number: sprintNumber });
}
```

`sprint.test.ts`: `calendarDay('2026-10-01').toISOString()` is `2026-10-01T00:00:00.000Z`; `formatDay('2026-10-01', 'en-GB')` is `Thu 1 Oct`; `formatDay('2026-10-01', 'fr')` is `jeu. 1 oct.`; `formatTime('14:00', 'en')` is `2 PM`; `formatTime('14:00', 'fr')` is `14 h`; `formatTime('09:30', 'fr')` is `09:30`; `nextRetroLabel({date: '2026-10-01', time: null}, 'en-GB', t)` with an identity `t` that replaces placeholders gives `Next retro Thu 1 Oct`; `retroNamePrefill(null, t)` is `undefined`; `sprintRange({startsOn: '2026-09-21', endsOn: '2026-10-04'}, 'en-GB')` is `21 Sept → 4 Oct` or `21 Sep → 4 Oct` (the ICU of the project decides: check it once). The expected strings are those of the Node ICU the project runs (`node -p "new Intl.DateTimeFormat('fr',{hour:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(2000,0,1,14)))"`); check each once before writing it.

`lib/teams/roles.ts`:

```ts
import type { TeamRole } from '@/types';

type Translate = (key: string) => string;

export const teamRoles: TeamRole[] = ['owner', 'facilitator', 'member', 'observer'];

export function teamRoleLabel(role: TeamRole, t: Translate): string {
    switch (role) {
        case 'owner':
            return t('Owner');
        case 'facilitator':
            return t('Facilitator');
        case 'member':
            return t('Member');
        case 'observer':
            return t('Observer');
    }
}

export function takesPart(role: TeamRole | null | undefined): boolean {
    return role !== 'observer';
}

export function managesRituals(role: TeamRole | null | undefined): boolean {
    return role === 'owner' || role === 'facilitator';
}
```

`roles.test.ts`: each label; `takesPart('observer')` false, `takesPart(null)` true (a manager outside the team); `managesRituals`.

`lib/teams/facilitator.ts`:

```ts
import type { FacilitatorOption } from '@/types';

/** The person the retro form preselects: the suggestion while it is one of the options, else the viewer. */
export function initialFacilitatorId(options: FacilitatorOption[], suggestedId: string | null, viewerId: string): string {
    if (suggestedId !== null && options.some((option) => option.id === suggestedId)) {
        return suggestedId;
    }

    return viewerId;
}

/** The viewer first, then the others in the server's order (already alphabetical). */
export function facilitatorChoices(options: FacilitatorOption[], viewerId: string): FacilitatorOption[] {
    const viewer = options.filter((option) => option.id === viewerId);

    return [...viewer, ...options.filter((option) => option.id !== viewerId)];
}
```

`facilitator.test.ts`: the suggestion kept when listed, the viewer when the suggestion is null or not listed (an observer since demoted); the viewer moved first.

`lib/teams/activity.ts`:

```ts
import type { TeamActivityKind } from '@/types';

type Translate = (key: string) => string;

/** The words between the actor and the subject of a line of the feed. */
export function activityVerb(kind: TeamActivityKind, t: Translate): string {
    switch (kind) {
        case 'retro_started':
            return t('started the retrospective');
        case 'retro_completed':
            return t('closed the retrospective');
        case 'poker_started':
            return t('started the planning poker');
        case 'poker_ended':
            return t('ended the planning poker');
        case 'whiteboard_created':
            return t('created the whiteboard');
        case 'survey_published':
            return t('published the survey');
        case 'survey_closed':
            return t('closed the survey');
        case 'action_item_completed':
            return t('completed');
        case 'member_joined':
            return t('joined the team');
    }
}
```

`activity.test.ts`: the nine kinds map to nine distinct keys.

`lib/teams/session-rows.ts`:

```ts
import type { RecentSessionRow } from '@/types';

type Translate = (key: string, replacements?: Record<string, string | number>) => string;

function counted(count: number, one: string, many: string, t: Translate): string {
    return count === 1 ? t(one) : t(many, { count });
}

export function sessionMeta(row: RecentSessionRow, t: Translate): string {
    switch (row.kind) {
        case 'retro':
            return [t('Retro'), row.meta.phaseLabel, counted(row.meta.cards ?? 0, '1 card', ':count cards', t)].filter(Boolean).join(' · ');
        case 'poker':
            return [t('Planning poker'), counted(row.meta.tasks ?? 0, '1 task', ':count tasks', t)].join(' · ');
        case 'whiteboard':
            return row.meta.facilitatorName ? `${t('Whiteboard')} · ${t('Facilitated by :name', { name: row.meta.facilitatorName })}` : t('Whiteboard');
        case 'survey':
            return [t('Survey'), counted(row.meta.questions ?? 0, '1 question', ':count questions', t)].join(' · ');
        case 'game':
            return [t('Icebreaker'), row.meta.gameLabel].filter(Boolean).join(' · ');
    }
}

export function sessionOutcome(row: RecentSessionRow, t: Translate): string | null {
    if (row.outcome === null) {
        return null;
    }

    switch (row.outcome.kind) {
        case 'actions':
            return counted(row.outcome.count, '1 action', ':count actions', t);
        case 'answers':
            return counted(row.outcome.count, '1 answer', ':count answers', t);
        case 'estimated':
            return t(':count estimated', { count: row.outcome.count });
    }
}

export function sessionStateLabel(row: RecentSessionRow, t: Translate): string {
    if (row.state === 'live') {
        return t('Live');
    }

    if (row.state === 'finished') {
        return t('Ended');
    }

    return row.kind === 'survey' ? t('Draft') : t('Upcoming');
}
```

`session-rows.test.ts`: one case per kind for `sessionMeta`, the three outcomes with 1 and 2, the three states and the survey draft.

- [ ] **Step 3: Shared components (own commits)**

- `skrum/session-card.tsx`: `stats` gains `groups?: number`, rendered after the cards with the `layers` icon and the unit "groups" (`1 group` / `:count groups`), as the cards stat is; test: a card with `groups: 6` shows "6 groups".
- `team-settings-shell.tsx` moves to `components/team-settings/`; `active` becomes `'general' | 'members' | 'integrations' | 'data'`; it takes `sections: TeamSettingsSections` and lists, in the mockup's order, General (`teams.settings.show`, icon `settings`), Members & rituals (`teams.members.index`, `users`), Integrations (`teams.integrations.index`, `plug`), Data & export (`teams.data.show`, `database`), each only when its section is true; the header line reads the description (when set), ":count members" and "created in :date" (when the page sends `createdAt`; month and year by `Intl`). The crumbs keep three levels (D-87). Its test moves with it and gains: hidden entries, the line with and without a description.
- `lib/teams/settings-href.ts`: `teamSettingsHref(currentTeam)` returns `currentTeam?.settingsUrl ?? undefined`; its callers (the sidebar entry, `team-page.tsx`) pass `currentTeam`; its test follows.

- [ ] **Step 4: Gates and commit** — `npm run test -- lib/teams session-card team-settings-shell settings-href`, `npm run types:check`, `npm run check`, `npm run build:front`; commit `feat(teams): front foundation — roles, sprint, facilitator and activity helpers, the four-tab settings shell` (trailer lines).

---

## Step D — screens (four lanes cut from the head of Task 17)

Every screen task follows the "Screen task procedure" of plan 18e (mockup open beside the code, the hooks kept for later tests, Vitest for each state) with this plan's working rules: no walkthrough, no capture before Task 25. Composition tables name the mockup element, what is built, and the hooks (`data-test`, labels, ids).

### Task 18 (lane Page): The team page

**Mockups:** `ScreenTeam` (header, sections, right column), `ScreenDashboard` (recent sessions, open actions, activity, header meta), `Card` (`SessionCard`), `ActionItem`, `MoodTrendChart`. Deviations P23-06, P23-08, P23-09, P23-13.

**Files:**
- Create: `resources/js/components/teams/team-schedule.tsx`, `team-recent-sessions.tsx`, `team-open-actions-card.tsx`, `team-activity-card.tsx`, `team-role-badge.tsx`, `whiteboard-thumbnail.tsx` (+ `.test.tsx` each)
- Modify: `resources/js/components/teams/team-page.tsx` (+ test), `team-members-card.tsx` (+ test: role select when adding), `team-roti-card.tsx` (+ test: sprint labels), `resources/js/pages/teams/show.tsx` (props), `resources/js/pages/dev/sections/team.tsx`

**Interfaces:**
- Consumes: props of `teams/show` from Tasks 2, 6, 12 to 15 (`viewerRole`, `roleOptions`, `canManageRituals`, `schedule`, `hasSprints`, `activity`, `recentSessions`, `openActionItems`, `overdueActionItemCount`, `retros[].stats`, `whiteboards[].preview`, mood points `sprintLabel`); `lib/teams/*` (Task 17); `skrum/action-item`, `skrum/session-card`, `ui/table`, `skrum/empty-state`, `whiteboard-template-preview.tsx` (the shapes renderer), `skrum/avatar` (initials for a guest or a tracker).

| Slot / part | Content (mockup) | Behaviour | Hooks |
|---|---|---|---|
| `schedule` → `team-schedule.tsx` | at the end of the header meta line: `calendar-days` icon, "Sprint 42 · Next retro Thu 2 Oct, 2 pm" (ScreenTeam shows the next retro; ScreenDashboard adds the sprint); "Sprint 42" alone without a next retro; the next retro alone between two sprints | nothing without `schedule`; for who may set rituals (`canManageRituals`) on a team without any sprint (`hasSprints` false), a ghost link "Start the first sprint" to `teams.members.index#sprints` | `data-slot="team-schedule"` |
| `recentSessions` → `team-recent-sessions.tsx` | `TeamSection` "Recent sessions" with "All sessions" (to plan 22's Sessions page, through its Wayfinder route); `Table`: Session (kind icon in the kind's colour and `SessionTypePicker` icon, title link, `sessionMeta` muted), Date (`Intl` relative day: "Today", else "18 Sep"), Participants, Status (`Badge`: live = success with dot and a "Join" `Button size="sm"`; finished = muted "Ended" plus `sessionOutcome`; upcoming = outline, "Draft" for a survey) | below 40rem the table becomes a list of cards (title, meta, status); not rendered when the list is empty | `section#recent-sessions`, rows `data-test="recent-session"` |
| `retroStatsFor` | `SessionCard.stats` by phase: writing, grouping → participants (unit "joined"), cards; voting, discussing, actions, roti → plus groups; completed → participants without unit, cards, action items | — | — |
| `whiteboardThumbnailFor` → `whiteboard-thumbnail.tsx` | 6.5rem tall, `sk-dotgrid` paper (the whiteboard paper token of 1-D5), the preview's shapes scaled to fit (the renderer of `whiteboard-template-preview.tsx`), `aria-hidden` | paper alone while `preview` is null or has no shape | `data-slot="whiteboard-thumbnail"` |
| `openActions` → `team-open-actions-card.tsx` | card "Open action items" with the count `Badge` and ":count overdue" (warning), the line "Gathered from every session of the team · overdue first.", up to five `ActionItem` rows (title, assignee, priority, due with the late style and `alarm-clock`, ticket key, source retro), "See all" to `workspaces.actionItems.index?team=` | empty: "No open action items."; hidden when there is none and `canCreate` is false | `section#open-actions`, rows `data-test="open-action"` |
| `activity` → `team-activity-card.tsx` | card "Activity": per line the avatar (initials when `avatarUrl` is null), "**name** verb **subject link**", the relative time muted | empty: "Nothing has happened in this team yet." | `section#activity`, `li[data-test="activity-line"]` |
| `roleBadgeFor` → `team-role-badge.tsx` | the role as muted text after the email ("Facilitator") as ScreenTeam | — | `data-test="member-role"` |
| members card, add form | "Add as" `Select` with the four roles (default Member) beside the member picker, for who manages members | posts `role` with `user_id` | `#add-member-role` |
| ROTI card | x labels from `sprintLabel` ("S35") and the badge "since S35" when every point has one; the day otherwise (D-77 as today) | — | — |
| settings card | removed from the page (now on the General tab); `#settings` anchor kept for old links, redirecting through the gear's URL | — | — |
| "New session" | disabled for an observer with the reason "Observers cannot start sessions." (`takesPart(viewerRole)`) | — | — |

- [ ] **Step 1: Failing Vitest** for each new component (every row of the table, each empty state, the narrow layout of the recent sessions with `useIsMobile` mocked or a container width) and for `team-page.test.tsx` (the slots filled from the props; the settings card gone; the New session trigger disabled for an observer).
- [ ] **Step 2: Build**, component by component, against the mockups.
- [ ] **Step 3: Hooks kept for later tests:** listed in the table.
- [ ] **Step 4: Gates and commit** — `npm run test -- teams/`, `npm run types:check`, `npm run check`, `npm run build:front`; commit `feat(team): sprint and next retro, recent sessions, open actions, activity, retro counts, thumbnails, roles` (trailer lines).

### Task 19 (lane Settings): Team settings — General and Data & export

**Mockup:** `ScreenSettings` frame a (header, tabs, card style `st-card` with grey footer). Deviations P23-02, P23-10, P23-14.

**Files:**
- Replace: `resources/js/pages/teams/settings.tsx`, `resources/js/pages/teams/data.tsx`
- Create: `resources/js/components/team-settings/general-settings.tsx`, `data-export.tsx` (+ tests)
- Modify: `resources/js/components/teams/team-settings-card.tsx` (becomes the danger-zone card used by General; its rename form moves into `general-settings.tsx`)

| Part | Content | Behaviour | Hooks |
|---|---|---|---|
| `settings.tsx` | `TeamSettingsShell active="general"` | — | — |
| card "Team" | Name (`#team-name`, 100), Description (`#team-description`, `ui/textarea`, 200, help "Shown on the workspace page."), footer "Save" | `useForm` to `TeamsController.update` (`name`, `description`); field errors under each field; success toast from the server | button "Save" |
| card "Delete team" | only when `canDelete`; the sentence and "Delete team" with the existing confirmation | unchanged behaviour | button "Delete team" |
| `data.tsx` | `TeamSettingsShell active="data"` | — | — |
| card "Exports" | rows: "Survey results (CSV)" with the closed surveys (title, closed date, "Download CSV" link with `download`), "No closed survey yet." when empty; "Estimates" with a link to the estimation history; "Action items (CSV)" with a link to `actionItemsExportUrl` (plan 24's CSV export of the action items page, filtered on the team) | links only | `data-test="survey-export"`, `data-test="action-items-export"` |
| card "What is kept" | one paragraph: "Deleting the team deletes its sessions, action items and settings. Guests' names live only in the sessions they joined." | — | — |

- [ ] **Step 1: Failing Vitest:** the shell's active tab; the form posts both fields and shows a server error on `description`; the delete card absent when `canDelete` is false; the survey rows and the empty state.
- [ ] **Step 2: Build.**
- [ ] **Step 3: Gates and commit** — `npm run test -- team-settings settings`, `npm run types:check`, `npm run check`, `npm run build:front`; commit `feat(team-settings): General and Data & export tabs` (trailer lines).

### Task 20 (lane Settings): Team settings — Members & rituals

**Mockup:** `ScreenSettings` frame a, tab "Membres & rituels": Members card, Default facilitators, Retro templates, Default columns (the eight named colours). Deviations P23-07, P23-11, P23-12, P23-13. The Sprints card is Task 21 (its place in the page is left here: a `sprints` slot between the Members card and the Default facilitators card).

**Files:**
- Replace: `resources/js/pages/teams/members.tsx`
- Create: `resources/js/components/team-settings/members-table.tsx`, `default-facilitators-card.tsx`, `retro-templates-card.tsx`, `default-columns-card.tsx` (+ tests)

**Interfaces:**
- Consumes: the props of `teams.members.index` (Task 16); `TeamMemberRolesController.update`, `TeamMembersController.store|destroy`, `TeamFacilitatorsController.update`, `TeamDefaultRetroTemplatesController.update`, `WorkspaceTemplatesController.store|update` (Wayfinder); `skrum/template-editor` through `workspaces/template-editor-sheet.tsx`, `skrum/retro-template-picker` (Browse), `skrum/column-color-picker`, `teams/session-create/retro-columns-editor.tsx` (reorderable columns with dnd-kit), `ui/drawer`.
- Produces: the page with a `sprints` slot that Task 21 fills.

| Part | Content (mockup) | Behaviour | Hooks |
|---|---|---|---|
| Members card | header ":count members" (places of "Invitation link" and "Invite" left, plan 25); `Table`: Member (avatar, name, "(you)", email), Role (`Select` of the four roles for `canManageMembers`, text otherwise), Last activity (relative; "Never"), row menu "Remove from team" (confirmation, "Retirer" key of the fifth round); footer: "Facilitator: drives phases, timer and reveal, and can take control of any open session. Observer: read-only, does not vote." | a role change saves at once and shows the toast; removing reloads `members` only | `table[data-test="team-members"]`, `select[name="role-{id}"]`, menu "Member actions" |
| narrow | below 40rem a list; the role opens in a `Drawer` with the four options as radios | — | — |
| Default facilitators card | chips (avatar, first name, remove ×), "Add" (a menu of `candidates` not in the list), the switch "Rotate the suggestion at every retro" (`#facilitator-rotation`), the line "Suggested next: :name · retro of :date" (`facilitators.suggested` and `sprints.nextRetro`; "Suggested next: :name" without a next retro), the help line "The person creating a retro can always choose someone else." | each change saves the whole list (`user_ids` in chip order, `rotation`); the switch is disabled with "Add a facilitator first." while the list is empty; failed save restores the chips | `section#facilitators` |
| Retro templates card | radio list: name, "Default" badge, the column colour strip, "Used :count×" / "Never used"; "Create" (opens the template editor sheet in create mode with visibility Team and this team); "Browse" (the catalogue picker of the session dialog) | choosing saves the default; a default no longer available shows "This template is no longer available. Choose another." | `section#retro-templates`, radios by template name |
| Default columns card | "Default columns · template “:name”"; editable rows (handle, colour button opening `ColumnColorPicker`, title, delete) when `templates[default].canEdit`, "Save" (posts the template's update with its name, category, visibility, team and columns); read-only rows with "Duplicate as a team template" otherwise (store with visibility team, then set it as the default) | "Save" disabled while nothing changed; errors per column as `TemplateEditor` shows them | `section#default-columns` |

- [ ] **Step 1: Failing Vitest:** every row of the table and the states of spec §9.3 that are not the Sprints card's (facilitator: members read-only; owner: selects; rotation with empty list; the suggested line with and without a next retro; default gone; saving; errors per field).
- [ ] **Step 2: Build.**
- [ ] **Step 3: Gates and commit** — `npm run test -- team-settings`, `npm run types:check`, `npm run check`, `npm run build:front`; commit `feat(team-settings): Members & rituals — roles, last activity, suggested facilitators, default template and columns` (trailer lines).

### Task 21 (lane Settings): Team settings — the Sprints card (decision 1 B)

**Mockup:** none for the card (P23-01): designed from the settings cards of `ScreenSettings` frame a (`st-card` with grey footer, the rows and menus of the Members table, the segmented control and selects of the existing settings), put to the owner with the other pre-build deviations before it is built.

**Files:**
- Create: `resources/js/components/team-settings/sprints-card.tsx`, `sprint-form.tsx` (+ tests)
- Modify: `resources/js/pages/teams/members.tsx` (fills the `sprints` slot of Task 20)

**Interfaces:**
- Consumes: the props `sprints: TeamSprintsPanel` and `rituals: TeamRituals` of `teams.members.index` (Task 16); `TeamSprintsController.store|update|destroy`, `TeamSprintStartsController.store`, `TeamRitualsController.update` (Wayfinder); `lib/teams/sprint.ts` (`sprintTitle`, `sprintRange`, `nextRetroLabel`, `formatDay`); `skrum/date-picker`, `skrum/confirm-dialog`, `ui/table`, `ui/select`, `ui/dropdown-menu`.

| Part | Content | Behaviour | Hooks |
|---|---|---|---|
| card header | "Sprints" with `calendar-range` icon | — | `section#sprints` |
| current sprint | a highlighted row "Sprint 42 · 21 Sep → 4 Oct" with the badge "Current", or the muted line "No sprint in progress." | — | `[data-test="current-sprint"]` |
| start | primary `Button` "Start the next sprint", under it "Sprint :number · from today to :date" from `nextStart`; when `nextStart.refusal` is set, the button is disabled and the refusal is its description (`aria-describedby`) | `router.post(TeamSprintStartsController.store)`; success toast from the server; an error (a race lost) shows the toast of the `sprint` error and the props reload | button "Start the next sprint" |
| list | `Table` of `list`: Sprint ("Sprint 42"), Days (`sprintRange`), the "Current" badge, a row menu "Edit" / "Delete"; ten rows shown, "Show all (:count)" reveals the rest of `list`; when `total` exceeds the list, the line "The :count latest sprints are listed." | "Edit" opens `sprint-form.tsx` in a `Dialog` (number, first day, last day); "Delete" asks "Delete Sprint :number? Sessions keep their content; they lose this sprint's label." | `table[data-test="team-sprints"]`, menu "Sprint actions" |
| add | ghost button "Add a sprint" opening `sprint-form.tsx` with the number prefilled (`nextStart.number`), the first day prefilled with the day after the latest sprint's last day (today without a sprint), the last day from the default length; "Add" | `router.post(TeamSprintsController.store)`; errors under each field, the overlap message under "First day" | `#sprint-number`, `#sprint-starts-on`, `#sprint-ends-on` |
| settings | footer of the card: "Default length" (segmented 1, 2, 3, 4 weeks; none selected reads 2), "Retro day" (`Select` of seven weekdays, `Intl` names, "None"), "Time" (`ui/input type="time"`, disabled without a day), the preview "Next retro Thu 1 Oct, 2 pm" (`nextRetroLabel` of `sprints.nextRetro`, updated from the form with a pure `previewNextRetro()` over `list`) or "No next retro until the next sprint is started.", "Save" | `useForm` to `TeamRitualsController.update`; errors per field | `#sprint-length`, `#retro-weekday`, `#retro-time` |

States (spec §9.3): no sprint (the list empty, "No sprint in progress.", start enabled, "Sprint 1 · from today to …"); a current sprint; between two sprints; a sprint already planned (start disabled with the refusal); a sprint starting today (disabled); saving; an overlap error; a facilitator and an owner (same rights); below 40rem the list becomes cards and the form a `Drawer`.

- [ ] **Step 1: Failing Vitest:** each part of the table and each state; `previewNextRetro()` with the spec's example (sprints 42 and 43, Thursday 14:00: on 2026-09-30 → 2026-10-01; on 2026-10-01 at 15:00 → 2026-10-15; without 43 → none), written as a pure function beside the card and tested apart.
- [ ] **Step 2: Build.**
- [ ] **Step 3: Gates and commit** — `npm run test -- team-settings sprint`, `npm run types:check`, `npm run check`, `npm run build:front`; commit `feat(team-settings): the Sprints card — start the next sprint, add, edit and delete sprints, retro day` (trailer lines).

### Task 22 (lane Workspace): Workspace page and templates

**Mockups:** `ScreenWorkspace` frames a to d, `TemplateEditor`. Deviations P23-03, P23-15.

**Files:**
- Create: `resources/js/components/workspaces/workspace-details-dialog.tsx` (+ test)
- Modify: `workspace-overview.tsx` (+ test), `team-tile.tsx` (+ test), `templates-page.tsx`, `template-card.tsx`, `retro-templates-tab.tsx`, `template-editor-sheet.tsx` (+ tests), `resources/js/components/skrum/template-editor.tsx` (+ test, own commit: the team select), `resources/js/pages/workspaces/show.tsx`, `templates.tsx`

| Part | Content | Behaviour | Hooks |
|---|---|---|---|
| workspace header | the description under the facts line (muted, one paragraph); for a manager (`canEditDetails`) an "Edit" ghost icon button (pencil, accessible name "Edit the workspace name and description") beside the workspace name | opens the dialog | button "Edit the workspace name and description" |
| `workspace-details-dialog.tsx` | `ui/dialog` "Workspace": Name (`#workspace-name`, required, 100), Description (`#workspace-description`, textarea, 200, counter, optional), the help line "The workspace address does not change.", "Save", "Cancel" | `useForm` → `WorkspaceDetailsController.update` (`name`, `description`); errors under each field; on success the dialog closes and the header and the sidebar switcher show the new name (shared props reloaded by the visit) | `#workspace-name`, `#workspace-description` |
| team tile | description under the name (slot `teamDescriptionFor`); second activity line: active poker games when any, else ":count whiteboards edited today" / "1 whiteboard edited today" when any, else "No active game"; "Retro live now · Sprint 42" when `openRetroSprint`, the title otherwise | — | `data-slot="team-activity"` (exists) |
| template cards | visibility badge (outline) beside the name: "Personal" `user`, "Team · :team" `users`, "Workspace" `building-2` (slot of `templates-page.tsx`, `template-card.tsx`) | menu "Edit"/"Delete" only when `canManage` of the template | `data-test="template-visibility"` |
| "New template" | shown to everyone (`canCreate`) | opens the editor with visibility Personal for a member, Team for an owner or facilitator, Workspace for a manager | — |
| editor visibility | `TemplateEditor` already draws the segmented control when the draft carries `visibility`: the sheet passes it; "Workspace" disabled with "Only workspace admins can share a template with the whole workspace." when `canShareWorkspace` is false; "Team" disabled when `teamTemplateTeams` is empty; with "Team" chosen, a `Select` "Team" (`#template-team`) when there are two teams or more, the only one preselected otherwise | the sheet posts `visibility` and `team_id` | `#template-team` |

- [ ] **Step 1: Failing Vitest:** the dialog posts both fields, shows an error under the name (empty) and under the description, is absent for a member; the tile's lines in the three cases and with a sprint; the badges; the editor's disabled choices and the team select; a member's editor opens on Personal.
- [ ] **Step 2: Build** (the `template-editor.tsx` change first, own commit).
- [ ] **Step 3: Gates and commit** — `npm run test -- workspaces template-editor`, `npm run types:check`, `npm run check`, `npm run build:front`; commit `feat(workspaces): rename and describe a workspace, the whiteboard line of a tile, template visibility` (trailer lines).

### Task 23 (lane Sessions): Observers in sessions, "Take control" of a retro, the retro form's facilitator, the header sprint, the user card role

**Mockups:** none for the observer views (P23-04), none for the Facilitator select (P23-05), none for the retro's "Take control" (P23-16: built as the poker and whiteboard entries); `ScreenSessionCreate` (name prefill), `ScreenRetroWriting` header line ("Atlas · Sprint 42"), `Sidebar` (user card "Facilitateur · Admin").

**Files:**
- Modify: the retro board container and its write controls (read `components/retro/` and `hooks/use-retro-board.ts`: where `isLocked` and `canVote` reach the composer, vote buttons, reactions, ROTI widget, health-check button and retro survey answers), `components/poker/` (the spectator switch), `components/whiteboard/` (the read/edit mode of 7-D7), `components/games/` (the input controls), `components/surveys/survey-answer-flow.tsx` (+ tests of each); `components/teams/session-create/retro-session-fields.tsx` and a new `retro-facilitator-field.tsx` (+ tests; the options reach the form through plan 22's "New session" options: `currentSprintNumber`, `defaultRetroTemplate`, `retroFacilitators`, `suggestedFacilitatorId`, `facilitatorRotation`); the retro board menu (read `components/retro/` after plans 21 and 22: the menu that holds the hand-over entry of `board-dialogs.tsx`) (+ test: "Take control"); `components/session/session-shell.tsx` or the retro header (sprint line) (+ test); `components/skrum/app-sidebar.tsx` (+ test: role line)

| Part | Content | Behaviour | Hooks |
|---|---|---|---|
| retro, observer | the board rendered as when it is locked for this viewer, plus no vote buttons, no reactions, no ROTI vote, no health-check submission, no retro survey answers; an info line under the header "You follow this retrospective as an observer." | driven by `snapshot.viewerIsObserver` | `[data-slot="observer-notice"]` |
| poker, observer | the spectator view; the "Watch only" switch shown on and disabled with the same notice | — | — |
| whiteboard, observer | read mode forced; "Modifier" hidden | — | — |
| game room, observer | input controls (letters, guess field, drawing tools, answer and vote controls) hidden; the notice "You follow this session as an observer." | — | — |
| team survey, observer | questions read-only, "Observers do not answer surveys." | — | — |
| retro, "Take control" | an entry "Take control" (the icon of the poker and whiteboard entries) in the retro's board menu when `snapshot.viewer.canTakeControl` | a direct call of `RetroFacilitatorsController.update` with the viewer's own `user_id` (as `room-topbar.tsx` does for poker's "Take control"); success: the next snapshot gives the facilitator's controls; failure: the server's message as a toast | menu item "Take control" |
| retro form | name prefilled with `retroNamePrefill(currentSprintNumber)` when the user has not typed; the template preselected from `defaultRetroTemplate` ahead of `topTemplates[0]`; under the settings, `retro-facilitator-field.tsx`: a `Select` "Facilitator" (`#new-retro-facilitator`) listing `facilitatorChoices(retroFacilitators, viewerId)` (the viewer as "Me"), preselected with `initialFacilitatorId(…, suggestedFacilitatorId, viewerId)`, "(suggested)" after the suggested person's name, and the help line "Suggested by the rotation." when `facilitatorRotation` and the suggestion is shown | the form posts `facilitator_user_id` (the viewer's id is posted as null: the server's default); a 422 on it shows "Choose a facilitator from the team." under the select | `#new-retro-title` (exists), `#new-retro-facilitator` |
| retro header line | "team · Sprint 42" when `retro.sprintNumber` is set (D-100), unchanged otherwise | — | — |
| sidebar user card | second line "<team role> · <workspace role>" from `currentTeam.viewerRole` and `currentWorkspace.role`; the workspace role alone when `viewerRole` is null | — | `data-slot="user-card-role"` |

- [ ] **Step 1: Failing Vitest** for each row (snapshot fixtures with `viewerIsObserver: true`; the "Take control" entry shown with `canTakeControl` and absent without; the form with and without a sprint, a default template, a suggestion (rotation on and off), a suggestion no longer listed, the viewer chosen; the header line; the user card with and without a team role).
- [ ] **Step 2: Build.** Every write control already reads a flag from the snapshot or the board state: add `viewerIsObserver` to that flag at its source (the reducer or the hook), not control by control; list in the commit the controls that needed an extra condition.
- [ ] **Step 3: Gates and commit** — `npm run test -- retro poker whiteboard games surveys session-create app-sidebar`, `npm run types:check`, `npm run check`, `npm run build:front`; commit `feat(sessions): observers follow read-only; take control of a retro; the retro form suggests a facilitator and knows the sprint and the default template` (trailer lines).

---

## Final

### Task 24: Translations

Every key this plan names, in the four languages, informal (French "tu", Spanish "tú", German "du"). A key that already exists keeps its value: check with `jq 'has("<key>")' lang/fr.json` before adding, and skip it (keys known to exist at `0c294632`: Owner, Facilitator, Member, Observer, Team, Members, Description, General, Integrations, Team settings, Last activity, Sprint, :count members, Recent sessions, Personal, Workspace, Live, Ended, Draft, Join, Role, Save, Edit, Delete, Add, Me, Take control, Become host, Data & export, Members & rituals, Delete team, Team name, Choose a template from the list.). In `en.json` the value is the key. The lane tasks added their keys with these values; this task reviews them against `docs/superpowers/research/front-rewrite/translations-review.md` (glossary, lengths, register) and fixes drift.

| Key (en) | fr | es | de |
|---|---|---|---|
| Role changed. | Rôle modifié. | Rol cambiado. | Rolle geändert. |
| Observers can follow this session but not take part. | Les observateurs peuvent suivre cette session sans y participer. | Los observadores pueden seguir esta sesión, pero no participar. | Beobachter können dieser Sitzung folgen, aber nicht mitmachen. |
| Observers cannot start sessions. | Les observateurs ne peuvent pas lancer de session. | Los observadores no pueden iniciar sesiones. | Beobachter können keine Sitzungen starten. |
| You follow this retrospective as an observer. | Tu suis cette rétrospective en tant qu'observateur. | Sigues esta retrospectiva como observador. | Du verfolgst diese Retrospektive als Beobachter. |
| You follow this session as an observer. | Tu suis cette session en tant qu'observateur. | Sigues esta sesión como observador. | Du verfolgst diese Sitzung als Beobachter. |
| Observers do not answer surveys. | Les observateurs ne répondent pas aux sondages. | Los observadores no responden encuestas. | Beobachter beantworten keine Umfragen. |
| Add as | Ajouter comme | Añadir como | Hinzufügen als |
| (you) | (toi) | (tú) | (du) |
| Never | Jamais | Nunca | Nie |
| Remove from team | Retirer de l'équipe | Quitar del equipo | Aus dem Team entfernen |
| Member actions | Actions sur le membre | Acciones del miembro | Aktionen für das Mitglied |
| Sprint :number | Sprint :number | Sprint :number | Sprint :number |
| Sprint :number retro | Rétro sprint :number | Retro sprint :number | Retro Sprint :number |
| Next retro :date | Prochaine rétro :date | Próxima retro :date | Nächste Retro :date |
| Next retro :date, :time | Prochaine rétro :date à :time | Próxima retro :date a las :time | Nächste Retro :date um :time |
| 1 week | 1 semaine | 1 semana | 1 Woche |
| :count weeks | :count semaines | :count semanas | :count Wochen |
| Facilitator: drives phases, timer and reveal, and can take control of any open session. Observer: read-only, does not vote. | Facilitateur : pilote phases, timer et révélation, et peut prendre la main sur toute session ouverte. Observateur : lecture seule, ne vote pas. | Facilitador: dirige las fases, el temporizador y la revelación, y puede tomar el control de cualquier sesión abierta. Observador: solo lectura, no vota. | Moderation: steuert Phasen, Timer und Aufdecken und kann jede offene Sitzung übernehmen. Beobachter: nur lesen, stimmt nicht ab. |
| Start the first sprint | Lancer le premier sprint | Iniciar el primer sprint | Ersten Sprint starten |
| Sprints | Sprints | Sprints | Sprints |
| No sprint in progress. | Aucun sprint en cours. | Ningún sprint en curso. | Kein Sprint läuft gerade. |
| Current | En cours | En curso | Aktuell |
| Start the next sprint | Lancer le sprint suivant | Iniciar el siguiente sprint | Nächsten Sprint starten |
| Sprint :number · from today to :date | Sprint :number · d'aujourd'hui au :date | Sprint :number · de hoy al :date | Sprint :number · von heute bis :date |
| Show all (:count) | Tout afficher (:count) | Mostrar todo (:count) | Alle anzeigen (:count) |
| The :count latest sprints are listed. | Les :count derniers sprints sont affichés. | Se muestran los :count últimos sprints. | Die letzten :count Sprints werden angezeigt. |
| Sprint actions | Actions sur le sprint | Acciones del sprint | Aktionen für den Sprint |
| Delete Sprint :number? | Supprimer le sprint :number ? | ¿Eliminar el sprint :number? | Sprint :number löschen? |
| Sessions keep their content; they lose this sprint's label. | Les sessions gardent leur contenu ; elles perdent l'étiquette de ce sprint. | Las sesiones conservan su contenido; pierden la etiqueta de este sprint. | Die Sitzungen behalten ihren Inhalt; sie verlieren die Kennzeichnung dieses Sprints. |
| Add a sprint | Ajouter un sprint | Añadir un sprint | Sprint hinzufügen |
| Number | Numéro | Número | Nummer |
| First day | Premier jour | Primer día | Erster Tag |
| Last day | Dernier jour | Último día | Letzter Tag |
| Default length | Durée par défaut | Duración por defecto | Standardlänge |
| No next retro until the next sprint is started. | Pas de prochaine rétro tant que le sprint suivant n'est pas lancé. | No hay próxima retro hasta que se inicie el siguiente sprint. | Keine nächste Retro, bis der nächste Sprint gestartet ist. |
| Rituals saved. | Rituels enregistrés. | Rituales guardados. | Rituale gespeichert. |
| Sprint added. | Sprint ajouté. | Sprint añadido. | Sprint hinzugefügt. |
| Sprint saved. | Sprint enregistré. | Sprint guardado. | Sprint gespeichert. |
| Sprint deleted. | Sprint supprimé. | Sprint eliminado. | Sprint gelöscht. |
| Sprint :number started. | Sprint :number lancé. | Sprint :number iniciado. | Sprint :number gestartet. |
| Sprint :number already starts today. | Le sprint :number commence déjà aujourd'hui. | El sprint :number ya empieza hoy. | Sprint :number beginnt bereits heute. |
| Sprint :number is already planned from :date. | Le sprint :number est déjà prévu à partir du :date. | El sprint :number ya está previsto desde el :date. | Sprint :number ist bereits ab dem :date geplant. |
| Sprint numbers stop at :max. | Les numéros de sprint s'arrêtent à :max. | Los números de sprint terminan en :max. | Sprint-Nummern enden bei :max. |
| A sprint lasts at most eight weeks. | Un sprint dure au plus huit semaines. | Un sprint dura como máximo ocho semanas. | Ein Sprint dauert höchstens acht Wochen. |
| Sprint :number already exists. | Le sprint :number existe déjà. | El sprint :number ya existe. | Sprint :number gibt es bereits. |
| This sprint overlaps Sprint :number (:start – :end). | Ce sprint chevauche le sprint :number (:start – :end). | Este sprint se solapa con el sprint :number (:start – :end). | Dieser Sprint überschneidet sich mit Sprint :number (:start – :end). |
| Rotate the suggestion at every retro | Faire tourner la suggestion à chaque rétro | Rotar la sugerencia en cada retro | Vorschlag bei jeder Retro wechseln |
| Suggested next: :name · retro of :date | Suggestion suivante : :name · rétro du :date | Siguiente sugerencia: :name · retro del :date | Nächster Vorschlag: :name · Retro am :date |
| Suggested next: :name | Suggestion suivante : :name | Siguiente sugerencia: :name | Nächster Vorschlag: :name |
| The person creating a retro can always choose someone else. | La personne qui crée une rétro peut toujours choisir quelqu'un d'autre. | Quien crea una retro siempre puede elegir a otra persona. | Wer eine Retro erstellt, kann immer jemand anderen wählen. |
| Only owners and facilitators of the team can be suggested. | Seuls les propriétaires et facilitateurs de l'équipe peuvent être suggérés. | Solo se puede sugerir a propietarios y facilitadores del equipo. | Nur Inhaber und Moderation des Teams können vorgeschlagen werden. |
| :name (suggested) | :name (suggéré) | :name (sugerido) | :name (vorgeschlagen) |
| Suggested by the rotation. | Suggéré par la rotation. | Sugerido por la rotación. | Von der Rotation vorgeschlagen. |
| Choose a facilitator from the team. | Choisis un facilitateur dans l'équipe. | Elige un facilitador del equipo. | Wähle eine Moderation aus dem Team. |
| Workspace saved. | Espace de travail enregistré. | Espacio de trabajo guardado. | Arbeitsbereich gespeichert. |
| Edit the workspace name and description | Modifier le nom et la description de l'espace de travail | Editar el nombre y la descripción del espacio de trabajo | Name und Beschreibung des Arbeitsbereichs bearbeiten |
| The workspace address does not change. | L'adresse de l'espace de travail ne change pas. | La dirección del espacio de trabajo no cambia. | Die Adresse des Arbeitsbereichs ändert sich nicht. |
| Action items (CSV) | Actions (CSV) | Acciones (CSV) | Maßnahmen (CSV) |
| Retro day | Jour de la rétro | Día de la retro | Retro-Tag |
| Time | Heure | Hora | Uhrzeit |
| None | Aucun | Ninguno | Keiner |
| Default facilitators | Facilitateurs par défaut | Facilitadores por defecto | Standard-Moderation |
| Add a facilitator first. | Ajoute d'abord un facilitateur. | Añade primero un facilitador. | Füge zuerst eine Moderation hinzu. |
| Facilitators saved. | Facilitateurs enregistrés. | Facilitadores guardados. | Moderation gespeichert. |
| Retro templates | Modèles de rétro | Plantillas de retro | Retro-Vorlagen |
| Default | Par défaut | Por defecto | Standard |
| Used :count× | Utilisé :count× | Usada :count× | :count× verwendet |
| Never used | Jamais utilisé | Nunca usada | Nie verwendet |
| Create | Créer | Crear | Erstellen |
| Browse | Parcourir | Explorar | Durchsuchen |
| This template is no longer available. Choose another. | Ce modèle n'est plus disponible. Choisis-en un autre. | Esta plantilla ya no está disponible. Elige otra. | Diese Vorlage ist nicht mehr verfügbar. Wähle eine andere. |
| A personal template cannot be the team default. | Un modèle personnel ne peut pas être celui de l'équipe par défaut. | Una plantilla personal no puede ser la predeterminada del equipo. | Eine persönliche Vorlage kann nicht die Standardvorlage des Teams sein. |
| Default template saved. | Modèle par défaut enregistré. | Plantilla por defecto guardada. | Standardvorlage gespeichert. |
| Default columns · template “:name” | Colonnes par défaut · modèle « :name » | Columnas por defecto · plantilla «:name» | Standardspalten · Vorlage „:name“ |
| Duplicate as a team template | Dupliquer en modèle d'équipe | Duplicar como plantilla de equipo | Als Team-Vorlage duplizieren |
| Team · :team | Équipe · :team | Equipo · :team | Team · :team |
| Only workspace admins can share a template with the whole workspace. | Seuls les admins de l'espace peuvent partager un modèle avec tout l'espace. | Solo los administradores del espacio pueden compartir una plantilla con todo el espacio. | Nur Admins des Arbeitsbereichs können eine Vorlage mit dem ganzen Arbeitsbereich teilen. |
| Activity | Activité | Actividad | Aktivität |
| started the retrospective | a lancé la rétrospective | inició la retrospectiva | hat die Retrospektive gestartet |
| closed the retrospective | a clôturé la rétrospective | cerró la retrospectiva | hat die Retrospektive abgeschlossen |
| started the planning poker | a lancé le planning poker | inició el planning poker | hat das Planning Poker gestartet |
| ended the planning poker | a terminé le planning poker | terminó el planning poker | hat das Planning Poker beendet |
| created the whiteboard | a créé le tableau blanc | creó la pizarra | hat das Whiteboard erstellt |
| published the survey | a publié le sondage | publicó la encuesta | hat die Umfrage veröffentlicht |
| closed the survey | a clôturé le sondage | cerró la encuesta | hat die Umfrage geschlossen |
| completed | a terminé | completó | hat erledigt |
| joined the team | a rejoint l'équipe | se unió al equipo | ist dem Team beigetreten |
| Former member | Ancien membre | Antiguo miembro | Ehemaliges Mitglied |
| Nothing has happened in this team yet. | Il ne s'est encore rien passé dans cette équipe. | Todavía no ha pasado nada en este equipo. | In diesem Team ist noch nichts passiert. |
| Open action items | Actions ouvertes | Acciones abiertas | Offene Maßnahmen |
| :count overdue | :count en retard | :count atrasadas | :count überfällig |
| Gathered from every session of the team · overdue first. | Agrégées depuis toutes les sessions de l'équipe · en retard d'abord. | Reunidas de todas las sesiones del equipo · primero las atrasadas. | Aus allen Sitzungen des Teams · Überfällige zuerst. |
| See all | Tout voir | Ver todo | Alle ansehen |
| No open action items. | Aucune action ouverte. | No hay acciones abiertas. | Keine offenen Maßnahmen. |
| All sessions | Toutes les sessions | Todas las sesiones | Alle Sitzungen |
| Upcoming | À venir | Próximas | Geplant |
| 1 card | 1 carte | 1 tarjeta | 1 Karte |
| :count cards | :count cartes | :count tarjetas | :count Karten |
| 1 task | 1 tâche | 1 tarea | 1 Aufgabe |
| :count tasks | :count tâches | :count tareas | :count Aufgaben |
| 1 question | 1 question | 1 pregunta | 1 Frage |
| :count questions | :count questions | :count preguntas | :count Fragen |
| 1 action | 1 action | 1 acción | 1 Maßnahme |
| :count actions | :count actions | :count acciones | :count Maßnahmen |
| 1 answer | 1 réponse | 1 respuesta | 1 Antwort |
| :count answers | :count réponses | :count respuestas | :count Antworten |
| :count estimated | :count estimées | :count estimadas | :count geschätzt |
| 1 group | 1 groupe | 1 grupo | 1 Gruppe |
| :count groups | :count groupes | :count grupos | :count Gruppen |
| joined | connectés | conectados | dabei |
| 1 whiteboard edited today | 1 tableau blanc modifié aujourd'hui | 1 pizarra editada hoy | 1 Whiteboard heute bearbeitet |
| :count whiteboards edited today | :count tableaux blancs modifiés aujourd'hui | :count pizarras editadas hoy | :count Whiteboards heute bearbeitet |
| created in :date | créée en :date | creado en :date | erstellt im :date |
| Shown on the workspace page. | Affichée sur la page de l'espace de travail. | Se muestra en la página del espacio de trabajo. | Wird auf der Seite des Arbeitsbereichs angezeigt. |
| Exports | Exports | Exportaciones | Exporte |
| Survey results (CSV) | Résultats des sondages (CSV) | Resultados de encuestas (CSV) | Umfrageergebnisse (CSV) |
| No closed survey yet. | Aucun sondage clôturé pour l'instant. | Todavía no hay encuestas cerradas. | Noch keine geschlossene Umfrage. |
| Estimates | Estimations | Estimaciones | Schätzungen |
| What is kept | Ce qui est conservé | Qué se conserva | Was aufbewahrt wird |
| Deleting the team deletes its sessions, action items and settings. Guests' names live only in the sessions they joined. | Supprimer l'équipe supprime ses sessions, ses actions et ses réglages. Les noms des invités ne vivent que dans les sessions qu'ils ont rejointes. | Eliminar el equipo elimina sus sesiones, acciones y ajustes. Los nombres de los invitados solo existen en las sesiones a las que se unieron. | Wenn du das Team löschst, werden seine Sitzungen, Maßnahmen und Einstellungen gelöscht. Die Namen von Gästen gibt es nur in den Sitzungen, denen sie beigetreten sind. |

German "Facilitator" is "Moderation" in `lang/de.json` today (it names the activity, not the person); the table keeps that word so that the role select and the existing screens agree, and the report asks the owner whether "Moderator·in" should replace it everywhere (a change of an existing key, out of this plan's rule).

- [ ] **Step 1:** `bin/test-db pgsql -- tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php`, then `sqlite` — Expected: PASS.
- [ ] **Step 2:** Commit `chore(i18n): team and workspace data strings in four languages, informal` (trailer lines).

### Task 25: Captures (light, 1440, French)

The owner's working rule: no browser walkthrough is written or run. This task takes **captures only**, in one configuration — light theme, 1440 wide, French — through the visual harness of `tests/Browser/Visual` (`CapturesVisuals::captureVisuals`, which honours `VISUAL_ONLY`).

**Files:**
- Create: `tests/Browser/Visual/TeamWorkspaceDataVisualTest.php`
- Modify: `tests/Browser/Visual/TeamPageVisualTest.php` only if its fixtures break (the settings card left the page; a whole-page capture of 18e changes and is retaken in light, 1440, French only)

- [ ] **Step 1: Cases.** One `captureVisuals` call per screen, fixtures built with factories and the helpers of `tests/Pest.php`, fixed ids and names, `travelTo('2026-09-30 10:00')`, as `TeamPageVisualTest.php` does:

| Name | Screen |
|---|---|
| `team-page-data` | the team page of a team with sprints 41 to 43 (sprint 42 current, retro Thursday 14:00), five recent sessions of four kinds, seven open action items (two overdue), ten activity lines, three retros in Writing, Voting and Completed with counts, three whiteboards with previews, members with roles |
| `team-settings-general` | General, as an owner |
| `team-settings-members` | Members & rituals, as an owner: members with roles and last activity, the Sprints card (sprints 40 to 42, 42 current, retro Thursday 14:00, "Start the next sprint" enabled), two default facilitators with the rotation on, the template list with a default, editable default columns |
| `team-settings-sprints-planned` | the Sprints card with sprint 43 planned (start disabled with its reason) and the edit dialog open |
| `team-settings-data` | Data & export with two closed surveys |
| `workspace-page-descriptions` | the workspace page with a description and three team tiles (descriptions, a live retro with its sprint, whiteboards edited today) |
| `workspace-details-dialog` | the same page, as an admin, with the "Workspace" dialog open (name and description) |
| `workspace-templates-visibility` | the templates page with a personal, a team and a workspace template |
| `template-editor-visibility` | the template editor of a facilitator, Team chosen, team select open |
| `retro-observer` | a retro in Voting seen by an observer |
| `retro-take-control` | a retro in Writing seen by a team facilitator who does not facilitate it, the board menu open on "Take control" |
| `new-retro-facilitator` | the "New session" dialog, retro form, with the name "Sprint 42 retro", the default template and the Facilitator select open on the suggested person (rotation on) |

- [ ] **Step 2: Run.** `npm run build:front`, then `docker compose exec -e VISUAL_ONLY=light-1440-fr laravel.test php artisan test --compact tests/Browser/Visual/TeamWorkspaceDataVisualTest.php` (from a worktree, the container and working directory as `bin/test-db` documents them). The overflow check of the harness must pass. Only `-light-1440-fr.png` files are written.
- [ ] **Step 3:** Commit `test(visual): team and workspace data captures, light, 1440, French` (trailer lines).

### Task 26: Deviations and documents

- [ ] For each capture of Task 25, open it beside the mockup's `preview.html` (light, 1440, French) and write the remaining differences. Each is fixed, or is a row of **Pre-build deviations** above with the owner's word. A difference that fits no reason stops the task.
- [ ] Documents, in one commit:
  - the spec and this plan stay at `docs/superpowers/specs/2026-10-21-plan-23-team-workspace-data-design.md` and `docs/superpowers/plans/2026-10-21-plan-23-team-workspace-data.md` (the owner's answers to spec §15 are already folded in); their status lines say "built", with the deviation rows the owner approved;
  - `docs/superpowers/research/front-rewrite/feature-roadmap.md`: rows TM-1 to TM-7 and WS-1 to WS-3 marked done (TM-1 noting "explicit sprints with Start the next sprint; next retro from the sprints and the retro day; scheduling stays backlog"; TM-6 noting "Take control" for facilitators and owners); the dependency line `SE-1 → SE-2 → TM-1` rewritten (TM-1 no longer needs SE-2); "Not requested, staying backlog" of the section completed with spec §3;
  - `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, table "Deviations from the mockup": D-18 reduced to "Invite" (IN-4); D-19 keeps the grouping (plan 24) and notes the sprint data exists; D-24 reduced to template defaults and poker template settings (backlog); D-27 removed; D-77 and D-100 lose their TM-1 part; D-88 removed; D-91's whiteboard line and sprint removed; D-94's visibility badge removed; and `docs/superpowers/research/front-rewrite/deviations.md` D-129: the role line built;
  - `docs/superpowers/specs/2026-10-01-front-rewrite-design.md`: the team settings sub-navigation (10-D4) and the team page sections amended with a pointer to the new spec;
  - `docs/database.md`: nothing unless a task found a new rule;
  - `README.md`: one paragraph in the upgrade notes — every existing team member becomes "Member"; workspace admins keep managing every team and can now take control of any open retro; give owners and facilitators their roles in Team settings › Members & rituals; a team has no sprint until someone presses "Start the next sprint" (or adds sprints) there; a workspace admin can rename the workspace, its address stays.
- [ ] Commit `docs: plan 23 — spec and plan in place, roadmap and deviation rows updated` (trailer lines).

### Task 27: Four-engine suites and report

- [ ] `vendor/bin/pint --format agent`; `vendor/bin/sail composer types:check` (PHPStan level 7); `vendor/bin/sail composer rector:check`.
- [ ] `bin/test-db pgsql`, then `bin/test-db sqlite`, `bin/test-db mariadb`, `bin/test-db mysql` (Unit, Feature, Upgrade and Arch; one engine at a time) — Expected: `test-db <engine>: PASS` on each.
- [ ] `bin/test-db pgsql --concurrency`, `bin/test-db mariadb --concurrency`, `bin/test-db mysql --concurrency`, `bin/test-db sqlite-file --concurrency` — Expected: PASS on each.
- [ ] `bin/check-pg-upgrade` — Expected: PASS (the upgraded schema equals a fresh install's).
- [ ] `npm run test`, `npm run types:check`, `npm run check`, `npm run build:front` — Expected: PASS.
- [ ] Report `docs/superpowers/research/plan-23-report.md` (asked for by this plan): what is done, per acceptance criterion of spec §13 with the test that proves it and the engines it passed on; the differences that remain with each mockup; every existing test whose expectation changed and why; the non-GET routes of the five session scopes and how the observer middleware treats each; translation keys added outside Task 24's table; the German "Moderation" question; every decision taken on the owner's behalf; what plan 25 and later plans can now read from this plan (`TeamRole` and `TeamPolicy::manageMembers`, the Members tab's places, the General tab, `SprintCalendar::sprintOn` for a grouping of action items by sprint); what changed in plans 22, 24 and 29's files (`PresentNewSessionOptions`, `ListTeamSessions` reuse or duplication, `AccessRequestRecipients`); the existing "Take control" rights of members on poker games and whiteboards, kept.
- [ ] Commit `docs: plan 23 report` (trailer lines). Then ask the owner to read the report. **No merge into `main`, no push.**

---

## Self-review (done while writing, and again after the owner's answers; kept for the reader)

**Spec coverage.** §6.1 roles: Tasks 1, 2 (policy, role changes), 16 (Members tab), 18, 20, 23. §6.2 descriptions and the workspace rename: Tasks 11, 16, 19, 22. §6.3 sprints and next retro: Tasks 6 (table, calendar, readers), 7 (add, edit, delete, start the next sprint, retro day), 16 (props), 18, 21, 22, 23. §6.4 the suggested facilitator: Tasks 8, 16, 20, 23. §6.5 default template and columns: Tasks 10, 16, 20, 23. §6.6 visibility: Tasks 9, 22. §6.7 activity: Tasks 12, 18. §6.8 thumbnails: Tasks 15, 18. §6.9 reads: Tasks 13 (recent sessions), 14 (open actions, retro counts, tile line), 16 (last activity), 6 (tile sprint). §6.10 take control: Tasks 2 (`takeControl`), 5, 23. §7 permissions: Tasks 2 (matrix, access-request recipients), 3 (session scopes), 4 (action items, MCP, participation), 5 (take-over), 9 (templates), 11 (workspace), 16 (settings pages). §8 real time: nothing to build (stated). §9 screens: Tasks 18 to 23. §10 routes: Tasks 2, 5, 7, 8, 10, 11, 16. §11 migrations: Tasks 1, 6, 8, 9, 10, 11, 12, 15 (Upgrade tests in 1 and 9). §12 testing: every task; races in Tasks 7 and 8; captures in Task 25. §13 criteria: 1 → 1, 9; 2, 3, 4 → 2; 5 → 3, 4, 5, 23; 6 → 5, 23; 7 → 3; 8 → 6, 18; 9 → 7, 21; 10 → 6, 18, 22, 23; 11 → 8, 23; 12 → 8; 13 → 10, 23; 14 → 9, 22; 15 → 12, 18; 16 → 13, 18; 17, 18 → 14, 18; 19 → 15, 18; 20 → 11, 19, 22; 21 → 16, 17, 19, 20; 22 → 2, 16, 23; 23 → 24, 25, 26; 24 → 27.

**Owner's answers.** Each "≠ first draft" answer is written into the tasks that the first draft's table named: decision 1 B replaces the rhythm columns and the arithmetic calendar by `team_sprints` rows and `SprintCalendar` over rows (Task 6), adds the management endpoints and "Start the next sprint" with its race (Task 7) and the Sprints card (Task 21); decision 2 B adds `TeamPolicy::takeControl` (Task 2) and one take-over task (Task 5) instead of one per session type, because poker games and whiteboards already let every team member take control (read on `0c294632`: `PokerFacilitatorsController::ensureTakesControl`, `WhiteboardFacilitatorsController::ensureTakesControl`) — only the retro (no take-over today) and the game room (creator and admins only) change, and the front gains one entry (Task 23); decision 4 C replaces `NextRotationFacilitator` (automatic assignment) by `SuggestedFacilitator` and `facilitator_user_id` (Task 8) and the dialog line by a select (Task 23); decision 7 B turns `WorkspaceDescriptionsController` into `WorkspaceDetailsController` (name and description, slug kept; Task 11) and the dialog (Task 22). Decision 9 A (plan 22 first) moves the dialog's props (`defaultRetroTemplate`, the facilitator options, `currentSprintNumber`, the catalogue) into plan 22's `PresentNewSessionOptions` (Tasks 6, 8, 9, 10) and the recent sessions onto plan 22's rules (Task 13). Plan 29's answer "access requests to workspace owners and admins until plan 23" is honoured in Task 2 (`AccessRequestRecipients` gains the team's owners). Plan 24 (merged before) gives the action items CSV that Data & export links (Task 16).

**Placeholders.** Back-end tasks carry their tests and code. Where a body depends on a file this plan did not read line by line, or that plans 21, 22, 24 and 29 change before this plan runs (`CreateRetro`, `NewRetro`, `PresentNewSessionOptions`, `ListTeamSessions`, `AccessRequestRecipients`, the retro board menu, the factories' states, the bodies of `teams.pokerGames.store` and `poker.status.update`, a valid whiteboard element), the step names the file to read and what to adapt; the expectations do not change. Screen tasks carry composition tables, behaviours, hooks and states, and the code of their pure logic (Task 17), not full component code: the mockup, or the deviation the owner approves, is the specification of the markup (plan 18e's screen procedure).

**Type consistency.** `TeamRole` (Task 1) is the name plans 25 and 29 expect. `Team::members()` gives `teamMembership` (Tasks 1, 2, 16); `defaultFacilitators()` gives `pivot` (Task 8). `TeamSprint::present()` (Task 6) is the `Sprint` shape of `SprintCalendar::sprintOn` (Tasks 6, 16), of `StartNextSprint::preview` minus `id` plus `refusal` (Tasks 7, 16) and of the front's `Sprint`, `NextSprintStart`, `TeamSprintsPanel` (Task 17). `SprintCalendar::forTeam/fromToday/ofRows/sprintOn/numberOn/shortLabelOn/nextRetro/dayOf` (Task 6) are the calls of Tasks 6 and 16. `SuggestedFacilitator::for/follow` (Task 8) are called by `CreateRetro`, `PresentNewSessionOptions` and `TeamMembersController::index` (Task 16); the dialog's `retroFacilitators`, `suggestedFacilitatorId`, `facilitatorRotation` (Task 8) match `FacilitatorOption` and `initialFacilitatorId` (Task 17). `viewer.canTakeControl` (Task 5) is read by Task 23. `TeamTemplateUsage` rows (Task 10) are what Task 20 reads. `ListRecentTeamSessions` rows (Task 13) match `RecentSessionRow` (Task 17). `ListTeamActivity` lines (Task 12) match `TeamActivityLine`. `PresentTeamRetro.stats` (Task 14) matches `RetroStats`. `PresentWhiteboardSummary.preview` (Task 15) matches `WhiteboardSummary.preview`. `TeamSettingsSections` (Task 16) matches the type of Task 17 and the shell's `sections`. `BuildTemplateCatalogue::handle(Workspace, User, ?Team)` (Task 9) is called so by Tasks 9 and 16. Route names: `teams.sprints.*`, `teams.sprintStarts.store`, `teams.rituals.update` (Task 7), `workspaces.details.update` (Task 11) are the ones Tasks 21 and 22 call through Wayfinder.

**Review Focus.** Each line has its test: the facilitator turned observer (Task 3), the admin with an observer row (Tasks 1, 3), a member's retro take-over refused while poker and whiteboards keep theirs (Task 5), two "Start the next sprint" (Task 7, `Race`), two creations following one suggestion (Task 8, `Race`), someone else's personal template (Task 9), daylight saving and the retro day's time (Task 6), the thumbnail job and `updated_at` (Task 15).

**Known weak points of this draft.** Nothing was run. The observer middleware refuses every non-read request of the five scopes; Task 3's "Read first" lists them before it lands, and the commit body records the list. The front tasks assume the read-only switches of the session screens can take one more source flag (spec §16 item 5). Task 13 may duplicate plan 22's state rules when plan 22 exposes none (decision 9). The Sprints card, the Facilitator select, the workspace dialog and the retro's "Take control" entry have no mockup: P23-01, P23-03, P23-05 and P23-16 are put to the owner before Tasks 21, 22 and 23 build them. The German role word is an open question for the owner.
