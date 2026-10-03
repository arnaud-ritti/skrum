# Standalone surveys, the Poll session type and the health check as a survey template (Plan 19) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to run this plan task by task (through the Workflow tool, as the project does). Steps use checkbox (`- [ ]`) syntax. Every agent reads **Owner decisions**, **Global Constraints**, **Pre-build deviations** and its own task before anything else, then `docs/database.md` ("Rules for database code" and "Running the tests on an engine") for any task that touches PHP. A screen task also follows the "Screen task procedure" of `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, with the working rules below (no walkthrough, captures in Task 31 only).

**Status: revision v2 (2026-10-03) of the draft of 2026-10-19.** Written on the rulings of the spec's §17: items 1, 2 and 4 to 8 taken on the recommended option (owner mandate of 2026-10-02), item 3 decided by the owner (seventh round, D-102: 1 to 5 with "Submit answers", old 1-to-10 scores read halved), items 9 to 12 new with this revision and taken on the option marked in the spec. The table **Owner decisions** says which tasks change with another answer. Before Task 1: the owner reads spec §17 items 9 to 12 and the pre-build deviations; P19-16 is answered before Task 25 starts.

**Goal:** A team creates a survey from the "New session" dialog (type Poll), builds it with scale, NPS, choice and text questions, shares it by link, watches the answers arrive, closes it, compares it with the previous one and exports it; the health check is one of its templates, scored 1 to 5 and sent with "Submit answers"; the retro has no health-check phase any more; every health score ever given is kept as given, and every reader shows health on the 1-to-5 scale, old 1-to-10 scores read halved by one rule.

**Architecture:** A new aggregate, `TeamSurvey` (tables `team_surveys`, `team_survey_questions`, `team_survey_options`, `team_survey_respondents`, `team_survey_answers`, `team_survey_answer_options`), built end to end like the whiteboard: creation under the team, a page behind a respondent-resolving middleware, a JSON snapshot built per viewer, a presence channel, a guest join page. Results are withheld by the server per viewer; events carry counts only. The existing one-question surveys of a retro keep their own tables and code. A retro attaches a health-check survey instead of running a phase; the attached survey lives in its retro (answered there with one submission, closed there, read there) and the survey scope refuses it. Health data moves into the new tables through an additive, idempotent import that copies every score as given with the scale of its question; the health readers (`SummarizeHealthCheck`, `BuildHealthTrend`, `PresentHealthCheck`, `PresentHealthProgress`, `BuildTeamMoodTrend`) keep their signatures and shapes, are rewritten over the new tables, and report on the health scale through `App\Support\Surveys\HealthScale` (spec §11.9), so that the board, the results, the recap e-mail, the AI summary and the MCP tool agree.

**Tech Stack:** Laravel 13, PHP 8.4, Pest (feature, unit, upgrade, arch, concurrency), Inertia 3, React 19, Tailwind 4, vite-plus (Vitest), Wayfinder, Reverb, dnd-kit; PostgreSQL, MariaDB, MySQL and SQLite through `bin/test-db`; `Tests\Concurrency\Support\Race` for races. Run `composer show --direct` and read `package.json` before Task 1 and stop if a major differs.

**Spec:** `.superpowers/sdd/plan-19/2026-10-19-standalone-surveys-design.v2.md` (moves to `docs/superpowers/specs/` in Task 32). Parent: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` §5. Mockups: `docs/design-system/components/ScreenSurvey`, `SurveyQuestion`, `MobileRituals`, `ScreenSessionCreate`, `SessionTypePicker`, `SessionSettingsPopover`, `HealthCheck`, `GuestJoin`, `ShareDialog`, `EmptyState` — for each, the `README.md` and the `preview.html`.

**Not in this plan:** the backlog of spec §13; dropping `retro_health_statements`, `health_check_answers` and `retros.health_check_enabled` (a later plan, after `surveys:verify-health-import` has passed on production data); moving the retro surveys onto the new tables; browser walkthroughs (owner's working rule: none is written or run); anything of the former plans 28 (whiteboard collaboration) and 30 (mentions) and scheduling, which are backlog: no place is reserved for them.

**Tasks:** 33. Step A, back end, single writer: 1 to 13. Step B, health data and the retro's health check, lane H: 14 to 16. Step C, screens: 17 (single writer), then lanes Create (18, 19), Build (20), Answer (21, 22), Results (23, 24), Health (25, 26). Step D, removal of the phase: 27 to 29. Final: 30 (translations), 31 (captures only: light, 1440, French — the task that held the walkthroughs), 32 (deviations and documents), 33 (full suites on four engines and report).

## What revision v2 changes

1. **Health check on 1 to 5 with "Submit answers" (D-102).** Task 2 adds `HealthScale` and puts the health template on five, required, with the mockup's ends; Task 14 copies old scores as given (questions on ten when they hold answers, on five when not); Task 15 replaces the per-score endpoints with one submission (`retros.healthCheck.submission.store`) and moves the board's form to it; Task 16 reads every number on the health scale (halved for old data), adds the 1→5 distribution, changes the recap line to "/5", the AI summary input and the MCP tool, and moves the front's health components to five; Tasks 25 and 26 build on that.
2. **Owner decisions since the draft:** informal register in every language (Task 30 rewritten, `InformalRegisterTest`); guests count as participants (`TeamSurvey::audienceCount`, Task 1; the results line, Task 23); rework 3 kept (R3-7 untouched, the session-end compact card and "Details" fed on five, the reaction bar and the ROTI wording untouched).
3. **Database:** every task runs its tests on PostgreSQL, MariaDB, MySQL and SQLite through `bin/test-db`; races are proved with `Race` (Tasks 3, 7, 9, 15); the two data migrations are proved in `tests/Upgrade` (Tasks 14, 27); migrations are dated `2026_10_20_…` (the draft's dates collide with the portability work's); text sorting and label folding go through `Alphabetical`; PHPStan (`composer types:check`) gates every PHP commit.
4. **Working rules:** no walkthrough is written, edited or run; Task 31 becomes captures only (light, 1440, French), and the screen tasks no longer take captures of their own.
5. **Front end on the components that exist now:** the participant page on `SessionShell` (kind `survey`, `chrome="logo"`); the join page on `GuestJoinPage` with the random nickname of `PresentJoinSession::nickname`; the health-check button in `BoardActions` (and the phone's one menu); the "Add survey" menu in `SessionSettingsPopover`; the session-end health card of R3-5; kinds that already exist (`SessionCard`, `ShareDialog`, `SessionTypePicker`, `EmptyState`) are not re-added.
6. **An attached health check lives in its retro** (spec decision 10): the survey scope, the channel and the join route refuse it; `ResolveRespondent` no longer resolves retro participants; `SurveyQuestion` needs no scale of ten.
7. **Thin pages in Step A** (Tasks 3, 6, 10): `tests/Arch/FrontEndPagesTest.php` refuses a rendered component without its page file.

## Branch and run

- Base: the branch `plan-db-portability` (worktree `.claude/worktrees/laneDb`), once its Task 19 is merged — it holds plans 18e to 18g with rework 3, the portability rules (`docs/database.md`), `bin/test-db`, `tests/Concurrency/Support/Race.php`, `tests/Upgrade` and `tests/Arch/DatabasePortabilityTest.php`. Check before Task 1, and stop if one fails: `app/Enums/RetroPhase.php` has the cases `Actions` and `Roti`; `routes/web.php` has `teams.healthCheck.show`; `resources/js/pages/teams/health-check.tsx` exists; `bin/test-db` exists and `bin/test-db pgsql -- tests/Arch` passes; `tests/Concurrency/Support/Race.php` exists; the last migration of `database/migrations` is dated before `2026_10_20_100000`.
- Branch `plan-19-standalone-surveys` from that base. No merge into `main`, no push.
- Step A runs on that branch with one writer. Lanes run in git worktrees on branches `lane/19-<name>`, cut from the head named in **Lanes**; the controller merges one lane at a time and runs the gates after each merge: `npm run types:check`, `npm run check`, `npm run build:front`, `vendor/bin/pint --dirty --format agent`, `vendor/bin/sail composer types:check`, and `bin/test-db pgsql -- tests/Feature/TeamSurveys tests/Feature/Retros tests/Arch`.
- From a worktree, `bin/test-db` needs `TEST_DB_CONTAINER` (the running application container) and `TEST_DB_WORKDIR` (the worktree's path inside it); MariaDB and MySQL are started once with `docker compose up -d mariadb mysql`. Never run two whole suites at once in the shared container.
- This plan was revised from `plan-db-portability` at `8ea5ce49`. **Every task re-reads the files it touches**; a line number or a method body quoted here that no longer matches is followed in spirit and reported.

## Owner decisions

The twelve questions of spec §17. "Plan written on" is the option taken. The last column names what changes with another answer.

| # | Question | Plan written on | If the owner answers otherwise |
|---|---|---|---|
| 1 | Health check inside a retro | **B**: attached to the retro, no phase, answered from a header button | **A**: drop Tasks 15 (the attach, submission and closure parts) and 25; Task 27 also removes the creation row and the retro's health routes; `PresentHealthCheck` reads imported data only. **C**: Task 27 keeps a `HealthCheck` step and moves it between `Actions` and `Roti`; Task 25 builds a phase panel instead of the header button; Task 28 edits the stepper instead of removing a step |
| 2 | Surveys inside a retro | **A**: unchanged | **B**: a new step between A and C (about ten tasks: import of `surveys` into the team-survey tables, the six retro survey controllers and `PresentSurvey` over them, the 18e front adapter); Task 1 adds reactions and comments tables. **C**: the same, minus reactions and comments, plus the removal of those features |
| 3 | Health-check scale | **Decided by the owner** (D-102): 1 to 5, "Submit answers", old scores read halved (spec §11.9) | — (the options of the draft are withdrawn; the exact rule is item 12) |
| 4 | Minimum of answers | **B**: 3 on a survey created from the dialog, 0 on an attached or imported health check | **A**: `TeamSurvey::StandaloneThreshold` becomes 0 and the threshold states of Tasks 21 and 23 are dropped. **C**: Tasks 14 and 15 write 3; Task 16 hides summaries below it; the health fixtures of Task 16 need three respondents |
| 5 | Anonymity | **A**: always anonymous | **B**: Task 1 adds `is_anonymous`; Tasks 10, 12, 20, 23 gain a named variant. **C**: the same plus a per-respondent choice in Tasks 9 and 21 |
| 6 | Templates | **A**: Blank, Health check, Team pulse, and "a previous survey" | **B**: a new table and manager (about six tasks), the "From a template…" entry in Task 25. **C**: Task 2 drops Team pulse |
| 7 | Old health tables | **A**: kept one release | **B**: Task 29 adds the drop migration; the import tests then run in `tests/Upgrade` only (the schema up to before the drop), since a test may not create a table (`docs/database.md` rule 8) |
| 8 | CSV content | **A**: one row per respondent, sorted by content, closed only | **B**: Task 12 writes one row per question and option. **C**: Task 12 drops the closed-only guard |
| 9 | Change health-check answers once sent | **A**: no; the form is read-only once sent (the mockup) | **B**: Task 15 adds `DELETE retros/{retro}/health-check/submission` (clears `completed_at` while open) and its race case; Task 25 adds "Change my answers" under "Answers sent. Thank you." |
| 10 | Where an attached health check lives | **A**: in its retro only; the survey scope, channel and join refuse it | **B**: Task 3 brings back the retro-participant branch of `ResolveRespondent` (and `RespondentForParticipant` there), Task 5 signs retro guests on `presence-survey.{id}`, Task 15 announces `health.answered` from `AnnounceSurveyResponses`; Tasks 17, 21 and 23 handle a scale of ten (`SurveyQuestion` gains `scaleMax`); one health check can then be answered by two flows |
| 11 | Who is named while a health check is open | **A**: nobody in the interface; the MCP tool keeps who has sent, on a non-anonymous retro | **B**: Task 25 adds, for the facilitator, the avatars of who has sent under the progress (non-anonymous retro), fed by a new `sentBy` of `PresentHealthCheck`. **C**: Task 16 drops `answeredBy` from `GetHealth` |
| 12 | How old scores reach 1 to 5 | **A**: halved, `value × 5 ÷ scaleMax` | **B**: ends kept, `1 + (mean − 1) × (5 − 1) ÷ (scaleMax − 1)`: `HealthScale::normalise` and `bucket` change in Task 2, the hand-computed literals of Tasks 2, 11 and 16 are recomputed, the Mood axis of Task 16 runs from 1 to 5 |

## File structure

Back end, created:

| File | Responsibility |
|---|---|
| `app/Enums/TeamSurveyStatus.php`, `TeamSurveyQuestionKind.php`, `TeamSurveyTemplate.php` | the three enums |
| `database/migrations/2026_10_20_100000_create_team_survey_tables.php` | the six tables |
| `app/Models/TeamSurvey.php`, `TeamSurveyQuestion.php`, `TeamSurveyOption.php`, `TeamSurveyRespondent.php`, `TeamSurveyAnswer.php` and their factories | the aggregate |
| `app/Support/Surveys/HealthScale.php` | the health scale and the rule for old scores (spec §11.9) |
| `app/Support/Surveys/QuestionDefinition.php`, `SurveyTemplateCatalogue.php` | built-in templates |
| `app/Actions/HealthCheck/HealthCheckQuestions.php` | the team's statements as question definitions, on five |
| `app/Actions/TeamSurveys/ResolveRespondent.php`, `TeamSurveyGuard.php` | who is in, who may do what |
| `app/Http/Middleware/ResolveSurveyRespondent.php` | puts the respondent on the request; sends an attached survey's visitors to its retro |
| `app/Actions/TeamSurveys/NewTeamSurvey.php`, `CreateTeamSurvey.php`, `WriteSurveyQuestions.php`, `DuplicateTeamSurvey.php` | creation |
| `app/Actions/TeamSurveys/SaveSurveyAnswer.php`, `AnnounceSurveyResponses.php`, `PresentSurveyProgress.php`, `PresentSurveyQuestion.php` | answers |
| `app/Actions/TeamSurveys/SummarizeSurveyQuestion.php`, `BuildSurveyResults.php`, `BuildTeamSurveySnapshot.php`, `PresentTeamSurveySummary.php`, `CompareSurveys.php`, `ExportSurveyCsv.php`, `ChangeTeamSurveyStatus.php` | reading |
| `app/Events/TeamSurveys/TeamSurveyBroadcastEvent.php`, `TeamSurveyChanged.php`, `TeamSurveyResponsesChanged.php`, `TeamSurveyDeleted.php` | the channel |
| `app/Http/Requests/TeamSurveys/TeamSurveyStoreRequest.php`, `TeamSurveyUpdateRequest.php`, `TeamSurveyQuestionRequest.php`, `TeamSurveyQuestionOrderRequest.php`, `TeamSurveyStatusRequest.php` | validation |
| `app/Http/Controllers/TeamSurveys/*Controller.php` (thirteen, spec §12), `app/Http/Controllers/TeamSurveyJoinsController.php` | HTTP |
| `app/Support/Surveys/ImportHealthChecks.php`, `VerifyHealthCheckImport.php`, `database/migrations/2026_10_20_100100_copy_health_checks_to_team_surveys.php`, `app/Console/Commands/ImportHealthChecksCommand.php`, `VerifyHealthCheckImportCommand.php` | the health data migration |
| `app/Actions/HealthCheck/HealthCheckSurvey.php`, `AttachHealthCheck.php`, `CloseAttachedSurveys.php`, `app/Actions/TeamSurveys/RespondentForParticipant.php` | the retro's health check as a team survey |
| `app/Http/Controllers/Retros/RetroHealthChecksController.php`, `RetroHealthCheckClosuresController.php`, `RetroHealthCheckSubmissionsController.php` | attach, remove, close, reopen, send |
| `database/migrations/2026_10_20_100200_move_retros_out_of_the_health_check_phase.php` | the phase move |

Back end, rewritten in place: `app/Actions/HealthCheck/SummarizeHealthCheck.php`, `BuildHealthTrend.php`, `PresentHealthCheck.php`, `PresentHealthProgress.php`, `ManageTeamHealthStatements.php`; `app/Actions/Teams/BuildTeamMoodTrend.php`; `app/Events/Retros/HealthAnswered.php` (payload); `app/Mcp/Tools/Retro/GetHealth.php`. Modified: `app/Models/Team.php`, `Retro.php`, `Participant.php`, `app/Policies/TeamPolicy.php`, `app/Actions/Retros/GuestCookie.php`, `CreateRetro.php`, `ChangeRetroPhase.php`, `BuildBoardSnapshot.php`, `BuildSummaryInput.php`, `app/Actions/Sessions/PresentJoinSession.php`, `app/Support/Integrations/Messages/RetroRecapMail.php`, `app/Http/Controllers/BroadcastAuthorizationsController.php`, `TeamsController.php`, `TeamHealthChecksController.php`, `Retros/RetroSettingsController.php`, `Retros/ColumnsController.php`, `Retros/ColumnOrdersController.php`, `app/Enums/RetroPhase.php`, `app/Mcp/Servers/SkrumServer.php`, `app/Mcp/Prompts/TeamHealth.php`, `AnalyzeRetro.php`, `database/factories/RetroFactory.php`, `routes/web.php`, `tests/Pest.php`. Deleted: `app/Http/Controllers/Retros/HealthCheckAnswersController.php` (Task 15); `app/Models/HealthCheckAnswer.php`, `RetroHealthStatement.php`, their factories, `app/Actions/HealthCheck/FreezeHealthStatements.php` (Task 29).

Tests, created besides the feature files of each task: `tests/Unit/Support/Surveys/HealthScaleTest.php`; `tests/Concurrency/SurveyRespondentTest.php`, `SurveyQuestionLimitTest.php`, `SurveyAnswersTest.php`, `HealthCheckSubmissionTest.php`; `tests/Upgrade/HealthChecksToTeamSurveysTest.php`, `HealthPhaseMoveTest.php`; `tests/Browser/Visual/SurveyPagesVisualTest.php` (captures only).

Front end, created: `resources/js/lib/surveys/{types,api,survey-reducer,question-adapter,builder-state,answer-flow,compare}.ts`; `resources/js/hooks/{use-survey-channel,use-team-survey}.ts`; `resources/js/pages/surveys/{show,edit,results,join}.tsx` (thin in Step A, built in Step C); `resources/js/components/surveys/*` (containers of the four pages); `resources/js/components/teams/team-surveys-section.tsx`, `session-create/survey-session-fields.tsx`; `resources/js/components/retro/use-health-check-submission.ts`, `health-check-button.tsx`, `health-check-dialog.tsx`; each with its `.test.ts(x)`. `components/surveys/` is a new domain folder under `components/`, in the pattern of spec §6.1 of the parent; it is not a new base folder. Deleted: `resources/js/components/retro/phase-health.tsx` (Task 28).

## Global Constraints

- **Mockup first** (parent spec §5 rule 13). A screen follows its mockup: layout, placement, labels, states. A difference is fixed, or is a row of **Pre-build deviations**, and a row is put to the owner before its screen is built. Captures are taken once, in Task 31, in light, at 1440, in French, and compared with the mockup's `preview.html` in Task 32.
- **Front rules** of the parent spec §5 on every front file: tokens only, rem, Tailwind scale (no arbitrary size), no overflow from 20rem to 60rem, visible focus, contrast, motion with `prefers-reduced-motion`, lucide icons, the literal call shape `t('…')`, presentational `skrum/` components (no network, no Echo, no router). Containers live in `resources/js/components/<domain>/`. Reuse what exists: `components/session/` (`SessionShell`, `SessionTitle`, `GuestJoinPage`), `skrum/share-dialog`, `skrum/session-card`, `skrum/empty-state`, `skrum/survey-question`, `skrum/health-check-*`, `teams/session-create/*`.
- **Database (owner rule): Eloquent and the standard query builder only.** `docs/database.md`, rules 1 to 12, apply to every line of PHP, migration and test; `tests/Arch/DatabasePortabilityTest.php` enforces them with no allowed list. In short: no raw query of any form (`whereRaw`, `selectRaw`, `orderByRaw`, `DB::raw`, `DB::statement`, `DB::select` with SQL, `Expression`…); no driver test (`getDriverName`, connection names, grammar classes) in code, migrations, factories or tests; what SQL cannot say the same way on the four engines is done in PHP on bounded sets, aggregates cast in PHP; migrations with the Schema builder only, `up` only, dated `2026_10_20_…`, nullable `timestamp()` or `dateTime()`, no `enum()`, no collation, no JSON default, names within MySQL's 64 characters; a transaction locks the aggregate root first (survey routes: the survey; retro routes: the retro, then the survey; team statements: the team, then each survey), and is retried with `Transactions::Attempts` only when it touches nothing but the database (these broadcast: no retry); an explicit tie-breaker on every sort; lists read by people sorted with `Alphabetical::sort()`, labels compared with `Alphabetical::key()`; tests never read SQL text and never change the schema; a legacy row written with `DB::table()` in a test sets the derived columns of its table (`users.email_key`); JSON columns compared with `toBeIgnoringKeyOrder` (this plan adds none); writes never skip model events.
- **Four engines.** Every task runs the tests it wrote or touched on PostgreSQL, MariaDB, MySQL and SQLite: `bin/test-db pgsql -- <paths>`, then `mariadb`, `mysql`, `sqlite`. A step "Run the tests on the four engines" means exactly that; its "Expected" holds on each. The red step of a task ("see it fail") may run once, on SQLite in memory: `vendor/bin/sail artisan test --compact <path>`. Races (`tests/Concurrency`) run with `bin/test-db <engine> --concurrency` on `pgsql`, `mariadb`, `mysql` and `sqlite-file`, never on SQLite in memory, never in parallel.
- **Races** are proved with `Tests\Concurrency\Support\Race` (`Race::run`, `Race::request`; static closures capturing scalars only); each case states the protection it proves, and removing it makes the case fail: one respondent per person (Task 3), the question limit (Task 7), one answer per respondent and question, and closing while answers arrive (Task 9), one health-check submission per participant and one attached health check per retro (Task 15).
- **Data migrations** (Tasks 14, 27) are proved in `tests/Upgrade` in the pattern of `GamePointsWeekStartBackfillTest`: `migrate:fresh` up to the migration before, legacy rows written with `DB::table()`, the real migration run, the rows read back. They run outside a transaction (`$withinTransaction = false`) and can be run again.
- **Working rules (owner):** unit, feature, upgrade, arch and concurrency tests are written and run; Vitest is written and run (`npm run test -- <pattern>` per task, the whole suite in Tasks 28 and 33); browser walkthroughs (`tests/Browser/Walkthroughs`) are neither written, edited nor run; captures only, in Task 31. The draft's rule "no test runs during the work" does not apply to this plan.
- **No new dependency**, PHP or JS, without the owner's approval. The builder reorders with `@dnd-kit/*`, already installed.
- **Four languages, informal.** Every new `__('…')` and `t('…')` key is added to `lang/en.json`, `fr.json`, `es.json`, `de.json` in the commit that introduces it (`tests/Feature/TranslationKeysTest.php`), in the informal register (French "tu", Spanish "tú", German "du"; `tests/Feature/InformalRegisterTest.php`). A key that exists keeps its value. The tables of Task 30 hold the values of every key this plan names; in `en.json` the value is the key.
- **No test is deleted** without the owner's approval. The health tests are rewritten on the new fixtures; each change is listed in its task.
- Primary and foreign keys are UUIDs (`tests/Feature/UuidPrimaryKeysTest.php`). Create files with `vendor/bin/sail artisan make:… --no-interaction`.
- Controllers: plural name, CRUD method names only (`tests/Arch/ArchTest.php`). Route names camelCase, URLs kebab-case, tuple notation. Form Requests with array rules. Every page the server renders has its file under `resources/js/pages` (`tests/Arch/FrontEndPagesTest.php`).
- Arch facts that shape this plan: models do not use `App\Actions`, `App\Http` or `App\Mcp`; actions do not use `App\Http`; `App\Support`, jobs and events do not use `App\Http` or `App\Mcp`; enums use nothing of the application; no class is `final`; commands carry the `Command` suffix.
- PHP style: early returns, no `else`, happy path last, typed everything, PascalCase constants, constructor promotion, no comment that restates code; before each commit `vendor/bin/pint --dirty --format agent` and `vendor/bin/sail composer types:check` (PHPStan, level 7).
- Octane is installed: no static or per-request singleton state in new classes.
- Front gates after every task that touches the front: `npm run types:check`, `npm run check`, `npm run build:front` (build and `wayfinder:generate --with-form`, needed after every task that adds a route used by the front).
- One commit per task, in the repository's style (`feat(surveys): …`, `feat(health): …`, `test: …`). A change to a shared `skrum/` or `session/` component is its own commit inside the task.

## Pre-build deviations

Put to the owner before the screen is built (owner's rule of the fifth round). Reasons as in plan 18e: **F** false or unsafe, **A** accessibility, **N** no such data or concept, **S** this spec, **O** an owner's answer.

| # | Screen | Mockup element | Built | Reason |
|---|---|---|---|---|
| P19-01 | Builder | anonymity radio group (three modes) | not rendered; a line "Answers are anonymous" in its place | N: spec §3; roadmap backlog |
| P19-02 | Builder | "Close" date and "or as soon as 11/11 members have answered" | not rendered, place left | N: roadmap backlog |
| P19-03 | Builder | "Display threshold" select | not rendered, place left | N: roadmap backlog |
| P19-04 | Builder | alert "a result is shown from 3 answers, and free answers are shuffled" | shown with the survey's real threshold; without the first half when the threshold is 0; "sorted" for "shuffled" | F otherwise |
| P19-05 | Builder | "5 questions · about 2 minutes · sent at the end of the retro of 2 October" | "n questions" | N: no duration estimate, no sending |
| P19-06 | Builder | "5 options · « Other » enabled", "280 characters max" | "n options"; "500 characters max" | N ("Other"); F (the limit is 500) |
| P19-07 | Participant | "~ 1 min left" | not rendered | N |
| P19-08 | Participant, phone | the category line above the question | not rendered | N: a question has no category |
| P19-09 | Results | keywords | not rendered | N: no text analysis |
| P19-10 | Results | "Send to whiteboard" | not rendered; no place reserved | N: backlog (whiteboard collaboration, former plan 28, is backlog) |
| P19-11 | Results | "Share with the team" | "Share", opening the Share dialog of the survey | F: the team already sees the results; the dialog is what sharing means on every session type |
| P19-12 | Results | tab "Compare with sprint 41" | tab "Compare", naming the survey compared with inside it | N: no sprint entity |
| P19-13 | "New session" dialog | no Poll variant drawn | Name, "Start from" tiles, the guest switch (spec §9.1) | designed from the retro and whiteboard variants |
| P19-14 | "New session" dialog | "Poll" (SessionTypePicker, ScreenSessionCreate) against "New survey" (ScreenTeam) | "Poll" on the tile, "Survey" everywhere else | the mockups as drawn; the component of plan 18c says "Survey" on the tile and changes |
| P19-15 | Retro | SessionSettingsPopover: "Add survey" menu with "Health check", "Quick poll", "From a template…", note "Shown after Actions, before ROTI" | the first two entries; no note | N (templates: backlog); O (third round: no dedicated phase) |
| P19-16 | Retro | no place drawn for a health check without a phase | a "Health check" button with "n/m" in the session header before Share (an entry of the one menu on a phone), opening a dialog (a drawer on a phone) with `HealthCheckForm` or the results | spec §9.8, decision 1 |
| P19-17 | Retro, health check | `HealthCheck/README.md`: results hidden under 3 respondents ("Not enough answers to show results") | no minimum on an attached health check; its results show to everyone once it is closed | spec decision 4 |
| P19-18 | Team page | ScreenTeam: a "New survey" creation tile | none: one "New session" trigger | O: 1-D2 (D-09 stays for the tiles) |
| P19-19 | Results | "9 réponses sur 11 membres" | ":responses answers out of :audience participants", the audience counting the team's members and the respondents who are not members | O: sixth round (a guest counts as a participant); F: "members" would be false with guests |
| P19-20 | Team page, health card | "6 statements asked at the end of each retro, scored 1–5" | ":count statements, scored 1–5, asked in every health check" | F: no longer asked at the end of a retro; O: D-76 (real values) |
| P19-21 | Health-check page, Mood trend | the chart's scale | an axis from 0 to 5 | F: an old score read halved can be under 1 (decision 12-A; 1 to 5 with 12-B) |
| P19-22 | Retro, health check | `HealthCheck` form on 1 to 5 | an imported health check left open at the upgrade keeps 1 to 10 (same ends) until it closes | F: its answers were given on ten (spec §11.3) |

## Review Focus

The inputs the spec implies and that are most likely to bite, each pinned by a test in the task that owns the code.

1. **A cell of the CSV that starts with `=`, `+`, `-` or `@`** (a text answer "=HYPERLINK(…)"): a spreadsheet must show it as text. Test in Task 12.
2. **Two requests saving the same answer at once** (a double click, two tabs), **and answers arriving while the survey closes**: one answer row; no answer stored after the close. Race cases in Task 9.
3. **A respondent who should not see results reads them anyway** through the snapshot, the page props or an event after someone else answered. Tests in Tasks 5 and 10 walk every viewer, status and event payload.
4. **An import run twice, or after new answers were written to the old tables**: no duplicate survey, question, respondent or answer, the new answers arrive with their scale, and a question first created on five moves to ten only while unanswered. Tests in Task 14, and the Upgrade test of the migration.
5. **A retro that sits in the `health_check` phase when the release is deployed**: it must open, in another phase, with its answers on ten. Upgrade and feature tests in Task 27.
6. **The halving rule**: one rounding, after the normalisation; the score as the mean of the statements on five; consensus on the scale of the answers. Unit test in Task 2, parity test in Task 16.
7. **A double "Submit answers"**: one set of scores, a 422 for the second. Race case in Task 15.

## Lanes

| Lane | Tasks | Cut from | Shares with other lanes |
|---|---|---|---|
| main | 1 to 13, 17, 27 to 33 | — | — |
| H (health data and the retro's health check) | 14, 15, 16 | head of Task 10 (needs the models, the catalogue, answers and results) | `tests/Pest.php`, `routes/web.php`, `app/Models/Retro.php`, the four `lang/*.json`; front files no other lane touches before H is merged: `components/retro/phase-health.tsx`, `use-health-check-submission.ts`, `lib/retro/{types,board-reducer,adapters,session-end}.ts`, `hooks/use-retro-board.ts`, `components/skrum/health-check-{form,results,compact,summary}.tsx`, `components/retro/results/health-{radar,trend}.tsx`, `lib/teams/mood-adapter.ts` |
| Create | 18, 19 | head of Task 17 | `components/skrum/session-type-picker.tsx` (label only), `components/teams/team-page.tsx`, `lang/*.json` |
| Build | 20 | head of Task 17 | `lang/*.json` |
| Answer | 21, 22 | head of Task 17 | `components/session/session-shell.tsx` (the `survey` kind, this lane only), `lang/*.json` |
| Results | 23, 24 | head of Task 17 | `lang/*.json` |
| Health | 25, 26 | head of Task 17 **and** lane H merged | `components/retro/board-topbar.tsx`, `board-settings.tsx`, `components/skrum/session-settings-popover.tsx`, `components/teams/team-health-check-page.tsx`, `lang/*.json` |

Lane H can run while Tasks 11 to 13 finish on main. The five screen lanes run in parallel. `SurveyQuestion` changes only in Task 17; a lane that needs another change stops and asks. `lang/*.json` conflicts are resolved by the controller at each merge (keys appended in alphabetical blocks per lane). `tests/Pest.php`: Task 1 adds every helper of Step A; lane H adds its own in one block at the end of the file. `tests/Concurrency` files are new per task and do not conflict.

---

## Step A — back end of the team survey (single writer)

### Task 1: Tables, enums, models, factories, test helpers

**Files:**
- Create: `app/Enums/TeamSurveyStatus.php`, `app/Enums/TeamSurveyQuestionKind.php`, `app/Enums/TeamSurveyTemplate.php`
- Create: `database/migrations/2026_10_20_100000_create_team_survey_tables.php`
- Create: `app/Models/TeamSurvey.php`, `TeamSurveyQuestion.php`, `TeamSurveyOption.php`, `TeamSurveyRespondent.php`, `TeamSurveyAnswer.php`
- Create: `database/factories/TeamSurveyFactory.php`, `TeamSurveyQuestionFactory.php`, `TeamSurveyOptionFactory.php`, `TeamSurveyRespondentFactory.php`, `TeamSurveyAnswerFactory.php`
- Modify: `app/Models/Team.php` (relation `teamSurveys`), `app/Models/Retro.php` (relation `teamSurveys`), `app/Actions/Retros/GuestCookie.php` (constant `SurveyScope`), `tests/Pest.php` (helpers)
- Test: `tests/Feature/TeamSurveys/TeamSurveyModelTest.php`

Read first: `docs/database.md` ("Rules for database code"), `database/migrations/2026_10_09_100000_create_whiteboard_tables.php` (the two foreign keys added after creation, run on four engines), `app/Models/Whiteboard.php` and `WhiteboardMember.php` (the closest aggregate), `tests/Arch/DatabasePortabilityTest.php` (what the migrations may not contain: no non-null `timestamp()`, no `enum()`, no collation). The new tables have no JSON column and no derived column.

**Interfaces:**
- Consumes: `App\Concerns\HasGuestIdentity`, `App\Enums\HealthStatement`, `User::canManage(Workspace): bool`.
- Produces: the three enums; the five models with the relations and methods below; `GuestCookie::SurveyScope = 'survey'`; test helpers `surveyMember(TeamSurvey): array{0: User, 1: TeamSurveyRespondent}`, `surveyFacilitator(TeamSurvey): array{0: User, 1: TeamSurveyRespondent}`, `surveyGuest(TeamSurvey, string $secret = 'secret'): TeamSurveyRespondent`, `surveyGuestCookie(TeamSurveyRespondent, string $secret = 'secret'): array<string, string>`, `surveyQuestion(TeamSurvey, TeamSurveyQuestionKind $kind = Scale, array $attributes = [], array $options = []): TeamSurveyQuestion`, `answerSurveyQuestion(TeamSurveyQuestion, TeamSurveyRespondent, int|string|array $answer, ?string $comment = null): TeamSurveyAnswer`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/TeamSurveys/TeamSurveyModelTest.php`:

```php
<?php

use App\Enums\HealthStatement;
use App\Enums\TeamSurveyQuestionKind;
use App\Enums\TeamSurveyStatus;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

it('creates a draft survey with its defaults', function () {
    $survey = TeamSurvey::factory()->create()->fresh();

    expect($survey->status)->toBe(TeamSurveyStatus::Draft)
        ->and($survey->results_threshold)->toBe(3)
        ->and($survey->one_question_at_a_time)->toBeTrue()
        ->and($survey->show_results_after_answer)->toBeTrue()
        ->and($survey->guest_access_enabled)->toBeFalse()
        ->and($survey->version)->toBe(1)
        ->and($survey->toArray())->not->toHaveKey('guest_token');
});

it('orders questions and options by position and deletes them with the survey', function () {
    $survey = TeamSurvey::factory()->create();
    $second = surveyQuestion($survey, TeamSurveyQuestionKind::Single, ['position' => 1], ['B', 'A']);
    $first = surveyQuestion($survey, TeamSurveyQuestionKind::Nps, ['position' => 0]);

    expect($survey->questions->pluck('id')->all())->toBe([$first->id, $second->id])
        ->and($second->options->pluck('label')->all())->toBe(['B', 'A']);

    $survey->delete();

    expect(TeamSurveyQuestion::query()->count())->toBe(0)
        ->and(DB::table('team_survey_options')->count())->toBe(0);
});

it('gives an answer a random id, not a time-ordered one', function () {
    $question = surveyQuestion(TeamSurvey::factory()->open()->create());
    [, $respondent] = surveyMember($question->survey);

    $answer = answerSurveyQuestion($question, $respondent, 4);

    expect($answer->id[14])->toBe('4');
});

it('refuses two answers of one respondent to one question', function () {
    $question = surveyQuestion(TeamSurvey::factory()->open()->create());
    [, $respondent] = surveyMember($question->survey);
    answerSurveyQuestion($question, $respondent, 4);

    expect(fn () => DB::transaction(fn () => TeamSurveyAnswer::factory()->create([
        'team_survey_question_id' => $question->id,
        'team_survey_respondent_id' => $respondent->id,
        'value' => 2,
    ])))->toThrow(UniqueConstraintViolationException::class);
});

it('translates a built-in statement for each reader and keeps a custom one as written', function () {
    $survey = TeamSurvey::factory()->healthCheck()->create();
    $builtin = surveyQuestion($survey, TeamSurveyQuestionKind::Scale, ['builtin' => HealthStatement::Vision, 'label' => 'stored text']);
    $custom = surveyQuestion($survey, TeamSurveyQuestionKind::Scale, ['label' => 'We ship without fear', 'short_label' => 'Shipping']);

    expect($builtin->displayLabel())->toBe(HealthStatement::Vision->text())
        ->and($builtin->displayShortLabel())->toBe(HealthStatement::Vision->label())
        ->and($custom->displayLabel())->toBe('We ship without fear')
        ->and($custom->displayShortLabel())->toBe('Shipping');
});

it('names its editors: the facilitator and the workspace managers', function () {
    $survey = TeamSurvey::factory()->open()->create();
    [, $facilitator] = surveyFacilitator($survey);
    [, $member] = surveyMember($survey);
    $manager = workspaceManager($survey->team->workspace);
    $managerRespondent = TeamSurveyRespondent::factory()->create(['team_survey_id' => $survey->id, 'user_id' => $manager->id]);

    expect($survey->fresh()->isEditor($facilitator))->toBeTrue()
        ->and($survey->isEditor($managerRespondent))->toBeTrue()
        ->and($survey->isEditor($member))->toBeFalse()
        ->and($survey->isEditor(surveyGuest($survey)))->toBeFalse();
});

it('says who may see results', function (string $state, string $viewer, bool $expected) {
    $survey = TeamSurvey::factory()->{$state}()->create();
    [, $facilitator] = surveyFacilitator($survey);
    [, $member] = surveyMember($survey);
    [, $finished] = surveyMember($survey);
    $finished->update(['completed_at' => now()]);

    $respondent = ['facilitator' => $facilitator, 'member' => $member, 'finished' => $finished][$viewer];

    expect($survey->fresh()->resultsVisibleTo($respondent->fresh()))->toBe($expected);
})->with([
    'draft, editor' => ['draft', 'facilitator', false],
    'open, editor' => ['open', 'facilitator', true],
    'open, member who has not finished' => ['open', 'member', false],
    'open, member who has finished' => ['open', 'finished', true],
    'closed, any member' => ['closed', 'member', true],
]);

it('hides results from a finished member when the setting is off', function () {
    $survey = TeamSurvey::factory()->open()->create(['show_results_after_answer' => false]);
    [, $finished] = surveyMember($survey);
    $finished->update(['completed_at' => now()]);

    expect($survey->resultsVisibleTo($finished))->toBeFalse();
});

it('counts respondents who answered, not the ones who only opened the page', function () {
    $survey = TeamSurvey::factory()->open()->create();
    $question = surveyQuestion($survey);
    [, $answered] = surveyMember($survey);
    surveyMember($survey);
    answerSurveyQuestion($question, $answered, 3);

    expect($survey->responseCount())->toBe(1)
        ->and($survey->hasAnswers())->toBeTrue();
});

it('counts as its audience the team\'s members and the respondents who are not members, guests included', function () {
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->create();
    surveyMember($survey);
    teamMember($survey->team);
    surveyGuest($survey);
    $manager = workspaceManager($survey->team->workspace);
    TeamSurveyRespondent::factory()->create(['team_survey_id' => $survey->id, 'user_id' => $manager->id]);

    expect($survey->fresh()->audienceCount())->toBe(4);
});
```

The last case is the owner's participation rule (sixth round): everyone who took part, out of the team's members plus the participants who are not members, so that the ratio never exceeds 100 %. Two members, a guest and a workspace manager outside the team make four.

- [ ] **Step 2: Run it and see it fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/TeamSurveyModelTest.php`
Expected: FAIL, `Class "App\Models\TeamSurvey" not found`.

- [ ] **Step 3: Enums**

`app/Enums/TeamSurveyStatus.php`:

```php
<?php

namespace App\Enums;

enum TeamSurveyStatus: string
{
    case Draft = 'draft';
    case Open = 'open';
    case Closed = 'closed';

    public function label(): string
    {
        return match ($this) {
            self::Draft => __('Draft'),
            self::Open => __('Open'),
            self::Closed => __('Closed'),
        };
    }
}
```

`app/Enums/TeamSurveyQuestionKind.php`:

```php
<?php

namespace App\Enums;

enum TeamSurveyQuestionKind: string
{
    case Scale = 'scale';
    case Nps = 'nps';
    case Single = 'single';
    case Multiple = 'multiple';
    case Text = 'text';

    public function isChoice(): bool
    {
        return in_array($this, [self::Single, self::Multiple], true);
    }

    public function isNumeric(): bool
    {
        return in_array($this, [self::Scale, self::Nps], true);
    }
}
```

`app/Enums/TeamSurveyTemplate.php`:

```php
<?php

namespace App\Enums;

enum TeamSurveyTemplate: string
{
    case HealthCheck = 'health_check';
    case TeamPulse = 'team_pulse';

    public function hasLockedQuestions(): bool
    {
        return $this === self::HealthCheck;
    }
}
```

- [ ] **Step 4: Migration**

`database/migrations/2026_10_20_100000_create_team_survey_tables.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_surveys', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('retro_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('title', 120);
            $table->string('description', 500)->nullable();
            $table->string('template', 40)->nullable();
            $table->string('status', 20)->default('draft');
            $table->uuid('facilitator_respondent_id')->nullable();
            $table->foreignUuid('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('guest_access_enabled')->default(false);
            $table->string('guest_token', 40)->unique();
            $table->boolean('one_question_at_a_time')->default(true);
            $table->boolean('show_results_after_answer')->default(true);
            $table->unsignedTinyInteger('results_threshold')->default(3);
            $table->uuid('previous_survey_id')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index(['team_id', 'status']);
            $table->index(['team_id', 'closed_at']);
            $table->index(['retro_id', 'template']);
        });

        Schema::create('team_survey_respondents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_survey_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('participant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('guest_name', 50)->nullable();
            $table->string('guest_secret_hash', 64)->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['team_survey_id', 'user_id']);
            $table->unique(['team_survey_id', 'participant_id']);
        });

        Schema::table('team_surveys', function (Blueprint $table) {
            $table->foreign('facilitator_respondent_id')->references('id')->on('team_survey_respondents')->nullOnDelete();
            $table->foreign('previous_survey_id')->references('id')->on('team_surveys')->nullOnDelete();
        });

        Schema::create('team_survey_questions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_survey_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 20);
            $table->string('label', 200);
            $table->string('short_label', 30)->nullable();
            $table->string('description', 500)->nullable();
            $table->string('builtin', 40)->nullable();
            $table->string('match_key', 64)->nullable();
            $table->unsignedInteger('position');
            $table->boolean('is_required')->default(false);
            $table->boolean('allows_comment')->default(false);
            $table->unsignedTinyInteger('scale_max')->nullable();
            $table->string('scale_min_label', 60)->nullable();
            $table->string('scale_max_label', 60)->nullable();
            $table->timestamps();

            $table->index(['team_survey_id', 'position']);
        });

        Schema::create('team_survey_options', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_survey_question_id')->constrained()->cascadeOnDelete();
            $table->string('label', 100);
            $table->unsignedInteger('position');
            $table->timestamps();

            $table->index(['team_survey_question_id', 'position']);
        });

        Schema::create('team_survey_answers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_survey_question_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('team_survey_respondent_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('value')->nullable();
            $table->text('text')->nullable();
            $table->string('comment', 500)->nullable();
            $table->timestamps();

            $table->unique(['team_survey_question_id', 'team_survey_respondent_id'], 'team_survey_answers_question_respondent_unique');
        });

        Schema::create('team_survey_answer_options', function (Blueprint $table) {
            $table->foreignUuid('team_survey_answer_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('team_survey_option_id')->constrained()->cascadeOnDelete();

            $table->primary(['team_survey_answer_id', 'team_survey_option_id'], 'team_survey_answer_options_primary');
        });
    }
};
```

The two foreign keys added after creation follow `2026_10_09_100000_create_whiteboard_tables.php`. The explicit index names keep MySQL's 64-character identifier limit.

- [ ] **Step 5: Models**

`app/Models/TeamSurvey.php`:

```php
<?php

namespace App\Models;

use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use Database\Factories\TeamSurveyFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_id
 * @property string|null $retro_id
 * @property string $title
 * @property string|null $description
 * @property TeamSurveyTemplate|null $template
 * @property TeamSurveyStatus $status
 * @property string|null $facilitator_respondent_id
 * @property string|null $created_by_user_id
 * @property bool $guest_access_enabled
 * @property string $guest_token
 * @property bool $one_question_at_a_time
 * @property bool $show_results_after_answer
 * @property int $results_threshold
 * @property string|null $previous_survey_id
 * @property int $version
 * @property Carbon|null $opened_at
 * @property Carbon|null $closed_at
 * @property Carbon|null $created_at
 * @property-read Team $team
 * @property-read Retro|null $retro
 * @property-read Collection<int, TeamSurveyQuestion> $questions
 * @property-read Collection<int, TeamSurveyRespondent> $respondents
 */
#[Fillable([
    'retro_id', 'title', 'description', 'template', 'status', 'facilitator_respondent_id', 'created_by_user_id',
    'guest_access_enabled', 'guest_token', 'one_question_at_a_time', 'show_results_after_answer', 'results_threshold',
    'previous_survey_id', 'version', 'opened_at', 'closed_at',
])]
#[Hidden(['guest_token'])]
class TeamSurvey extends Model
{
    /** @use HasFactory<TeamSurveyFactory> */
    use HasFactory;

    use HasUuids;

    public const MaxQuestions = 30;

    public const StandaloneThreshold = 3;

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => 'draft',
        'guest_access_enabled' => false,
        'one_question_at_a_time' => true,
        'show_results_after_answer' => true,
        'results_threshold' => self::StandaloneThreshold,
        'version' => 1,
    ];

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    /** @return HasMany<TeamSurveyQuestion, $this> */
    public function questions(): HasMany
    {
        return $this->hasMany(TeamSurveyQuestion::class)->orderBy('position')->orderBy('id');
    }

    /** @return HasMany<TeamSurveyRespondent, $this> */
    public function respondents(): HasMany
    {
        return $this->hasMany(TeamSurveyRespondent::class)->oldest()->orderBy('id');
    }

    /** @return BelongsTo<TeamSurveyRespondent, $this> */
    public function facilitator(): BelongsTo
    {
        return $this->belongsTo(TeamSurveyRespondent::class, 'facilitator_respondent_id');
    }

    /** @return BelongsTo<TeamSurvey, $this> */
    public function previous(): BelongsTo
    {
        return $this->belongsTo(self::class, 'previous_survey_id');
    }

    public function isHealthCheck(): bool
    {
        return $this->template === TeamSurveyTemplate::HealthCheck;
    }

    public function hasLockedQuestions(): bool
    {
        return $this->template?->hasLockedQuestions() ?? false;
    }

    public function isEditor(TeamSurveyRespondent $respondent): bool
    {
        if ($this->facilitator_respondent_id === $respondent->id) {
            return true;
        }

        return (bool) $respondent->user?->canManage($this->team->workspace);
    }

    public function resultsVisibleTo(TeamSurveyRespondent $respondent): bool
    {
        if ($this->status === TeamSurveyStatus::Draft) {
            return false;
        }

        if ($this->status === TeamSurveyStatus::Closed) {
            return true;
        }

        if ($this->isEditor($respondent)) {
            return true;
        }

        return $this->show_results_after_answer && $respondent->completed_at !== null;
    }

    public function responseCount(): int
    {
        return $this->respondents()->whereHas('answers')->count();
    }

    public function completedCount(): int
    {
        return $this->respondents()->whereNotNull('completed_at')->count();
    }

    public function hasAnswers(): bool
    {
        return TeamSurveyAnswer::query()
            ->whereIn('team_survey_question_id', TeamSurveyQuestion::query()->where('team_survey_id', $this->id)->select('id'))
            ->exists();
    }

    /**
     * Everyone expected to answer: the team's members, plus the respondents who
     * are not members (guests, people outside the team), so that the share of
     * people who answered never exceeds 100 %. An attached health check counts
     * the retro's participants instead (`PresentHealthProgress`).
     */
    public function audienceCount(): int
    {
        $memberIds = $this->team->members()->pluck('users.id');

        return $memberIds->count() + $this->respondents()
            ->where(fn (Builder $respondents) => $respondents->whereNull('user_id')->orWhereNotIn('user_id', $memberIds))
            ->count();
    }

    protected function casts(): array
    {
        return [
            'template' => TeamSurveyTemplate::class,
            'status' => TeamSurveyStatus::class,
            'guest_access_enabled' => 'boolean',
            'one_question_at_a_time' => 'boolean',
            'show_results_after_answer' => 'boolean',
            'results_threshold' => 'integer',
            'version' => 'integer',
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }
}
```

`app/Models/TeamSurveyQuestion.php`:

```php
<?php

namespace App\Models;

use App\Enums\HealthStatement;
use App\Enums\TeamSurveyQuestionKind;
use Database\Factories\TeamSurveyQuestionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $team_survey_id
 * @property TeamSurveyQuestionKind $kind
 * @property string $label
 * @property string|null $short_label
 * @property string|null $description
 * @property HealthStatement|null $builtin
 * @property string|null $match_key
 * @property int $position
 * @property bool $is_required
 * @property bool $allows_comment
 * @property int|null $scale_max
 * @property string|null $scale_min_label
 * @property string|null $scale_max_label
 * @property-read TeamSurvey $survey
 * @property-read Collection<int, TeamSurveyOption> $options
 * @property-read Collection<int, TeamSurveyAnswer> $answers
 */
#[Fillable([
    'kind', 'label', 'short_label', 'description', 'builtin', 'match_key', 'position', 'is_required', 'allows_comment',
    'scale_max', 'scale_min_label', 'scale_max_label',
])]
class TeamSurveyQuestion extends Model
{
    /** @use HasFactory<TeamSurveyQuestionFactory> */
    use HasFactory;

    use HasUuids;

    public const MinOptions = 2;

    public const MaxOptions = 10;

    /**
     * Every scale created from now on, the builder's and the health check's
     * (`HealthScale::Max`); 10 survives only on imported health checks that
     * hold answers given on ten.
     */
    public const BuilderScaleMax = 5;

    /** @return BelongsTo<TeamSurvey, $this> */
    public function survey(): BelongsTo
    {
        return $this->belongsTo(TeamSurvey::class, 'team_survey_id');
    }

    /** @return HasMany<TeamSurveyOption, $this> */
    public function options(): HasMany
    {
        return $this->hasMany(TeamSurveyOption::class)->orderBy('position')->orderBy('id');
    }

    /** @return HasMany<TeamSurveyAnswer, $this> */
    public function answers(): HasMany
    {
        return $this->hasMany(TeamSurveyAnswer::class);
    }

    public function displayLabel(): string
    {
        return $this->builtin?->text() ?? $this->label;
    }

    public function displayShortLabel(): ?string
    {
        return $this->builtin?->label() ?? $this->short_label;
    }

    protected function casts(): array
    {
        return [
            'kind' => TeamSurveyQuestionKind::class,
            'builtin' => HealthStatement::class,
            'position' => 'integer',
            'is_required' => 'boolean',
            'allows_comment' => 'boolean',
            'scale_max' => 'integer',
        ];
    }
}
```

`app/Models/TeamSurveyOption.php`:

```php
<?php

namespace App\Models;

use Database\Factories\TeamSurveyOptionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $team_survey_question_id
 * @property string $label
 * @property int $position
 */
#[Fillable(['label', 'position'])]
class TeamSurveyOption extends Model
{
    /** @use HasFactory<TeamSurveyOptionFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<TeamSurveyQuestion, $this> */
    public function question(): BelongsTo
    {
        return $this->belongsTo(TeamSurveyQuestion::class, 'team_survey_question_id');
    }

    protected function casts(): array
    {
        return ['position' => 'integer'];
    }
}
```

`app/Models/TeamSurveyRespondent.php`:

```php
<?php

namespace App\Models;

use App\Concerns\HasGuestIdentity;
use Database\Factories\TeamSurveyRespondentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_survey_id
 * @property string|null $user_id
 * @property string|null $participant_id
 * @property string|null $guest_name
 * @property string|null $guest_secret_hash
 * @property Carbon|null $completed_at
 * @property-read TeamSurvey $survey
 * @property-read User|null $user
 */
#[Fillable(['team_survey_id', 'user_id', 'participant_id', 'guest_name', 'guest_secret_hash', 'completed_at'])]
#[Hidden(['guest_secret_hash'])]
class TeamSurveyRespondent extends Model
{
    /** @use HasFactory<TeamSurveyRespondentFactory> */
    use HasFactory;

    use HasGuestIdentity;
    use HasUuids;

    public static function current(Request $request): self
    {
        $respondent = $request->attributes->get('surveyRespondent');

        abort_unless($respondent instanceof self, 403);

        return $respondent;
    }

    /** @return BelongsTo<TeamSurvey, $this> */
    public function survey(): BelongsTo
    {
        return $this->belongsTo(TeamSurvey::class, 'team_survey_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function participant(): BelongsTo
    {
        return $this->belongsTo(Participant::class);
    }

    /** @return HasMany<TeamSurveyAnswer, $this> */
    public function answers(): HasMany
    {
        return $this->hasMany(TeamSurveyAnswer::class);
    }

    public function hasSubmitted(): bool
    {
        return $this->completed_at !== null;
    }

    protected function casts(): array
    {
        return ['completed_at' => 'datetime'];
    }
}
```

`app/Models/TeamSurveyAnswer.php`:

```php
<?php

namespace App\Models;

use Database\Factories\TeamSurveyAnswerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

/**
 * @property string $id
 * @property string $team_survey_question_id
 * @property string $team_survey_respondent_id
 * @property int|null $value
 * @property string|null $text
 * @property string|null $comment
 * @property-read Collection<int, TeamSurveyOption> $options
 */
#[Fillable(['team_survey_question_id', 'team_survey_respondent_id', 'value', 'text', 'comment'])]
class TeamSurveyAnswer extends Model
{
    /** @use HasFactory<TeamSurveyAnswerFactory> */
    use HasFactory;

    use HasUuids;

    /**
     * Random, so that an id never tells when an answer was written.
     */
    public function newUniqueId(): string
    {
        return (string) Str::uuid();
    }

    /** @return BelongsTo<TeamSurveyQuestion, $this> */
    public function question(): BelongsTo
    {
        return $this->belongsTo(TeamSurveyQuestion::class, 'team_survey_question_id');
    }

    /** @return BelongsTo<TeamSurveyRespondent, $this> */
    public function respondent(): BelongsTo
    {
        return $this->belongsTo(TeamSurveyRespondent::class, 'team_survey_respondent_id');
    }

    /** @return BelongsToMany<TeamSurveyOption, $this> */
    public function options(): BelongsToMany
    {
        return $this->belongsToMany(TeamSurveyOption::class, 'team_survey_answer_options');
    }

    protected function casts(): array
    {
        return ['value' => 'integer'];
    }
}
```

In `app/Models/Team.php` and `app/Models/Retro.php`, next to the other relations:

```php
    /** @return HasMany<TeamSurvey, $this> */
    public function teamSurveys(): HasMany
    {
        return $this->hasMany(TeamSurvey::class);
    }
```

In `app/Actions/Retros/GuestCookie.php`, after `WhiteboardScope`:

```php
    public const SurveyScope = 'survey';
```

- [ ] **Step 6: Factories**

`database/factories/TeamSurveyFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<TeamSurvey>
 */
class TeamSurveyFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'title' => fake()->sentence(3),
            'guest_token' => Str::random(40),
        ];
    }

    public function draft(): static
    {
        return $this->state(fn () => ['status' => TeamSurveyStatus::Draft]);
    }

    public function open(): static
    {
        return $this->state(fn () => ['status' => TeamSurveyStatus::Open, 'opened_at' => now()]);
    }

    public function closed(): static
    {
        return $this->state(fn () => ['status' => TeamSurveyStatus::Closed, 'opened_at' => now()->subHour(), 'closed_at' => now()]);
    }

    public function withGuestAccess(): static
    {
        return $this->state(fn () => ['guest_access_enabled' => true]);
    }

    public function withoutThreshold(): static
    {
        return $this->state(fn () => ['results_threshold' => 0]);
    }

    public function healthCheck(): static
    {
        return $this->state(fn () => ['template' => TeamSurveyTemplate::HealthCheck]);
    }

    public function attachedTo(Retro $retro): static
    {
        return $this->healthCheck()->state(fn () => [
            'team_id' => $retro->team_id,
            'retro_id' => $retro->id,
            'title' => $retro->title,
            'results_threshold' => 0,
            'one_question_at_a_time' => false,
            'show_results_after_answer' => false,
        ]);
    }
}
```

`database/factories/TeamSurveyQuestionFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\TeamSurveyQuestionKind;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyQuestion;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TeamSurveyQuestion>
 */
class TeamSurveyQuestionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_survey_id' => TeamSurvey::factory(),
            'kind' => TeamSurveyQuestionKind::Scale,
            'label' => fake()->sentence(6),
            'position' => 0,
            'scale_max' => TeamSurveyQuestion::BuilderScaleMax,
        ];
    }

    public function kind(TeamSurveyQuestionKind $kind): static
    {
        return $this->state(fn (array $attributes) => [
            'kind' => $kind,
            'scale_max' => $kind === TeamSurveyQuestionKind::Scale ? ($attributes['scale_max'] ?? TeamSurveyQuestion::BuilderScaleMax) : null,
        ]);
    }

    public function required(): static
    {
        return $this->state(fn () => ['is_required' => true]);
    }
}
```

`database/factories/TeamSurveyOptionFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\TeamSurveyOption;
use App\Models\TeamSurveyQuestion;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TeamSurveyOption>
 */
class TeamSurveyOptionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_survey_question_id' => TeamSurveyQuestion::factory(),
            'label' => fake()->word(),
            'position' => 0,
        ];
    }
}
```

`database/factories/TeamSurveyRespondentFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TeamSurveyRespondent>
 */
class TeamSurveyRespondentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_survey_id' => TeamSurvey::factory(),
            'user_id' => User::factory(),
        ];
    }

    public function guest(string $secret = 'secret'): static
    {
        return $this->state(fn () => [
            'user_id' => null,
            'guest_name' => fake()->firstName(),
            'guest_secret_hash' => hash('sha256', $secret),
        ]);
    }
}
```

`database/factories/TeamSurveyAnswerFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TeamSurveyAnswer>
 */
class TeamSurveyAnswerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_survey_question_id' => TeamSurveyQuestion::factory(),
            'team_survey_respondent_id' => TeamSurveyRespondent::factory(),
            'value' => 3,
        ];
    }
}
```

- [ ] **Step 7: Test helpers**

In `tests/Pest.php`, add the imports (`App\Enums\TeamSurveyQuestionKind`, `App\Models\TeamSurvey`, `TeamSurveyAnswer`, `TeamSurveyOption`, `TeamSurveyQuestion`, `TeamSurveyRespondent`) and, after the whiteboard helpers:

```php
/**
 * @return array{0: User, 1: TeamSurveyRespondent}
 */
function surveyMember(TeamSurvey $survey): array
{
    $user = teamMember($survey->team);

    return [$user, TeamSurveyRespondent::factory()->create(['team_survey_id' => $survey->id, 'user_id' => $user->id])];
}

/**
 * @return array{0: User, 1: TeamSurveyRespondent}
 */
function surveyFacilitator(TeamSurvey $survey): array
{
    [$user, $respondent] = surveyMember($survey);

    $survey->update(['facilitator_respondent_id' => $respondent->id, 'created_by_user_id' => $user->id]);

    return [$user, $respondent];
}

function surveyGuest(TeamSurvey $survey, string $secret = 'secret'): TeamSurveyRespondent
{
    return TeamSurveyRespondent::factory()->guest($secret)->create(['team_survey_id' => $survey->id]);
}

/**
 * @return array<string, string>
 */
function surveyGuestCookie(TeamSurveyRespondent $respondent, string $secret = 'secret'): array
{
    return [GuestCookie::name(GuestCookie::SurveyScope, $respondent->team_survey_id) => "{$respondent->id}|{$secret}"];
}

/**
 * @param  array<string, mixed>  $attributes
 * @param  array<int, string>  $options  labels, for a choice question
 */
function surveyQuestion(
    TeamSurvey $survey,
    TeamSurveyQuestionKind $kind = TeamSurveyQuestionKind::Scale,
    array $attributes = [],
    array $options = [],
): TeamSurveyQuestion {
    $question = TeamSurveyQuestion::factory()->kind($kind)->create([
        'team_survey_id' => $survey->id,
        'position' => (int) TeamSurveyQuestion::query()->where('team_survey_id', $survey->id)->max('position') + 1,
        ...$attributes,
    ]);

    foreach ($options as $position => $label) {
        TeamSurveyOption::factory()->create(['team_survey_question_id' => $question->id, 'label' => $label, 'position' => $position]);
    }

    return $question;
}

/**
 * @param  int|string|array<int, int>  $answer  a value (scale, NPS), a text, or option indexes (choices)
 */
function answerSurveyQuestion(TeamSurveyQuestion $question, TeamSurveyRespondent $respondent, int|string|array $answer, ?string $comment = null): TeamSurveyAnswer
{
    $row = TeamSurveyAnswer::factory()->create([
        'team_survey_question_id' => $question->id,
        'team_survey_respondent_id' => $respondent->id,
        'value' => is_int($answer) ? $answer : null,
        'text' => is_string($answer) ? $answer : null,
        'comment' => $comment,
    ]);

    if (is_array($answer)) {
        $options = $question->options()->get()->values();
        $row->options()->attach(array_map(fn (int $index): string => $options[$index]->id, $answer));
    }

    return $row;
}
```

- [ ] **Step 8: Run the tests on the four engines**

Run, for each of `pgsql`, `mariadb`, `mysql`, `sqlite`: `bin/test-db <engine> -- tests/Feature/TeamSurveys/TeamSurveyModelTest.php tests/Feature/UuidPrimaryKeysTest.php tests/Feature/Database/PortableSchemaTest.php tests/Arch`
Expected: PASS on each. The unique-violation case runs inside its own `DB::transaction`, as rule 6 asks, so that PostgreSQL does not abort the test's outer transaction. MySQL's 64-character limit on identifiers is met by the explicit names of the migration; check the generated names of the other indexes and foreign keys on MySQL (`bin/test-db mysql` fails at the preflight otherwise).

- [ ] **Step 9: Translations and commit**

Add `Open` to the four language files (table of Task 30; `Draft` and `Closed` exist).

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app/Enums app/Models database tests/Pest.php tests/Feature/TeamSurveys lang app/Actions/Retros/GuestCookie.php
git commit -m "feat(surveys): team survey tables, models and factories"
```

### Task 2: Built-in templates, and the health scale

**Files:**
- Create: `app/Support/Surveys/HealthScale.php`, `app/Support/Surveys/QuestionDefinition.php`, `app/Support/Surveys/SurveyTemplateCatalogue.php`, `app/Actions/HealthCheck/HealthCheckQuestions.php`, `app/Actions/TeamSurveys/WriteSurveyQuestions.php`
- Test: `tests/Unit/Support/Surveys/HealthScaleTest.php`, `tests/Feature/TeamSurveys/SurveyTemplateCatalogueTest.php`

**Interfaces:**
- Consumes: `App\Actions\HealthCheck\TeamHealthStatements::active(Team): Collection<int, TeamHealthStatement>`, `TeamHealthStatement::key(): string`; the models of Task 1.
- Produces: `HealthScale` (spec §11.9: `Max = 5`, `LegacyMax = 10`, `normalise(float $mean, int $scaleMax): float`, `average(float $mean, int $scaleMax): float`, `bucket(int $value, int $scaleMax): int`, `distribution(array $values, int $scaleMax): array{int, int, int, int, int}`, `maximumSpread(int $scaleMax): float`, `band(float $score): string`); `QuestionDefinition` (public promoted properties `kind`, `label`, `shortLabel`, `description`, `builtin`, `matchKey`, `isRequired`, `allowsComment`, `scaleMax`, `scaleMinLabel`, `scaleMaxLabel`, `options`); `SurveyTemplateCatalogue::questions(?TeamSurveyTemplate $template, Team $team): array<int, QuestionDefinition>`; `SurveyTemplateCatalogue::options(Team $team): array<int, array{key: ?string, name: string, description: string, questionCount: int}>`; `HealthCheckQuestions::handle(Team $team): array<int, QuestionDefinition>` (on five, required); `WriteSurveyQuestions::handle(TeamSurvey $survey, array $definitions): void` (replaces every question of the survey).

- [ ] **Step 0: The health scale, test first**

`tests/Unit/Support/Surveys/HealthScaleTest.php`:

```php
<?php

use App\Support\Surveys\HealthScale;

it('leaves a mean on five as it is and halves a mean on ten', function () {
    expect(HealthScale::normalise(3.8, 5))->toBe(3.8)
        ->and(HealthScale::normalise(7.0, 10))->toBe(3.5)
        ->and(HealthScale::normalise(1.0, 10))->toBe(0.5)
        ->and(HealthScale::average(7.25, 10))->toBe(3.6)
        ->and(HealthScale::average(22 / 3, 10))->toBe(3.7);
});

it('puts each answer in one of five buckets, two values of ten per bucket', function () {
    expect(array_map(fn (int $value): int => HealthScale::bucket($value, 10), range(1, 10)))->toBe([1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        ->and(array_map(fn (int $value): int => HealthScale::bucket($value, 5), range(1, 5)))->toBe([1, 2, 3, 4, 5])
        ->and(HealthScale::distribution([8, 6, 7], 10))->toBe([0, 0, 1, 2, 0])
        ->and(HealthScale::distribution([], 5))->toBe([0, 0, 0, 0, 0]);
});

it('measures the spread on the scale of the answers', function () {
    expect(HealthScale::maximumSpread(10))->toBe(4.5)
        ->and(HealthScale::maximumSpread(5))->toBe(2.0);
});

it('reads the bands on five', function (float $score, string $band) {
    expect(HealthScale::band($score))->toBe($band);
})->with([[4.0, 'excellent'], [3.9, 'good'], [3.0, 'good'], [2.9, 'needs_attention'], [2.0, 'needs_attention'], [1.9, 'critical'], [0.5, 'critical']]);
```

`app/Support/Surveys/HealthScale.php`:

```php
<?php

namespace App\Support\Surveys;

/**
 * The scale every reader of health data reports on (spec §11.9). Scores are
 * stored as they were given, on the scale of their question; they are
 * brought to five when they are read, never when they are written.
 */
class HealthScale
{
    public const int Max = 5;

    /** The scale of the health checks of before plan 19. */
    public const int LegacyMax = 10;

    /**
     * A mean on its own scale, brought to the health scale and not rounded:
     * identity on five, halving on ten.
     */
    public static function normalise(float $mean, int $scaleMax): float
    {
        return $mean * self::Max / $scaleMax;
    }

    /**
     * A statement's average as every reader shows it: normalised, then
     * rounded once to one decimal.
     */
    public static function average(float $mean, int $scaleMax): float
    {
        return round(self::normalise($mean, $scaleMax), 1);
    }

    /**
     * `ceil(value × 5 ÷ scaleMax)`, in integers so that no float decides a bucket.
     */
    public static function bucket(int $value, int $scaleMax): int
    {
        return max(1, min(self::Max, intdiv($value * self::Max + $scaleMax - 1, $scaleMax)));
    }

    /**
     * @param  array<int, int>  $values  answers on `$scaleMax`
     * @return array{int, int, int, int, int} answers per bucket, 1 to 5
     */
    public static function distribution(array $values, int $scaleMax): array
    {
        $counts = [0, 0, 0, 0, 0];

        foreach ($values as $value) {
            $counts[self::bucket($value, $scaleMax) - 1]++;
        }

        return $counts;
    }

    /** The largest population standard deviation on a scale from 1. */
    public static function maximumSpread(int $scaleMax): float
    {
        return ($scaleMax - 1) / 2;
    }

    public static function band(float $score): string
    {
        return match (true) {
            $score >= 4 => 'excellent',
            $score >= 3 => 'good',
            $score >= 2 => 'needs_attention',
            default => 'critical',
        };
    }
}
```

`22 / 3` is 7.333…, halved 3.667, rounded 3.7. 7.25 halved is 3.625, rounded 3.6; halving the old rounded 7.3 would have given 3.65, which is why the rounding happens once, after the normalisation, and why every reader goes through `average`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/TeamSurveys/SurveyTemplateCatalogueTest.php`:

```php
<?php

use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Actions\TeamSurveys\WriteSurveyQuestions;
use App\Enums\HealthStatement;
use App\Enums\TeamSurveyQuestionKind;
use App\Enums\TeamSurveyTemplate;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Support\Surveys\SurveyTemplateCatalogue;

it('gives a blank survey no question', function () {
    expect(resolve(SurveyTemplateCatalogue::class)->questions(null, Team::factory()->create()))->toBe([]);
});

it('turns the six built-in statements into required scale questions from 1 to 5', function () {
    $questions = resolve(SurveyTemplateCatalogue::class)->questions(TeamSurveyTemplate::HealthCheck, Team::factory()->create());

    expect($questions)->toHaveCount(6)
        ->and($questions[0]->kind)->toBe(TeamSurveyQuestionKind::Scale)
        ->and($questions[0]->scaleMax)->toBe(5)
        ->and($questions[0]->builtin)->toBe(HealthStatement::Interaction)
        ->and($questions[0]->matchKey)->toBe('interaction')
        ->and($questions[0]->isRequired)->toBeTrue()
        ->and($questions[0]->allowsComment)->toBeFalse()
        ->and($questions[0]->scaleMinLabel)->toBeNull()
        ->and($questions[0]->scaleMaxLabel)->toBeNull();
});

it('follows the statements the team customised: order, archived ones left out, custom ones keyed by their id', function () {
    $team = Team::factory()->create();
    $manage = resolve(ManageTeamHealthStatements::class);
    $custom = $manage->add($team, 'We ship without fear', 'Shipping');
    $manage->archive($team, HealthStatement::ManagerSupport->value);
    $manage->reorder($team, [$custom->id, 'interaction', 'task_clarity', 'vision', 'processes', 'motivation']);

    $questions = resolve(SurveyTemplateCatalogue::class)->questions(TeamSurveyTemplate::HealthCheck, $team);

    expect(array_map(fn ($question) => $question->matchKey, $questions))
        ->toBe([$custom->id, 'interaction', 'task_clarity', 'vision', 'processes', 'motivation'])
        ->and($questions[0]->label)->toBe('We ship without fear')
        ->and($questions[0]->shortLabel)->toBe('Shipping')
        ->and($questions[0]->builtin)->toBeNull();
});

it('gives the team pulse its five questions', function () {
    $questions = resolve(SurveyTemplateCatalogue::class)->questions(TeamSurveyTemplate::TeamPulse, Team::factory()->create());

    expect(array_map(fn ($question) => $question->kind, $questions))->toBe([
        TeamSurveyQuestionKind::Scale,
        TeamSurveyQuestionKind::Nps,
        TeamSurveyQuestionKind::Single,
        TeamSurveyQuestionKind::Multiple,
        TeamSurveyQuestionKind::Text,
    ])
        ->and($questions[0]->scaleMax)->toBe(5)
        ->and($questions[0]->isRequired)->toBeTrue()
        ->and($questions[0]->allowsComment)->toBeTrue()
        ->and($questions[2]->options)->toHaveCount(4)
        ->and($questions[3]->options)->toHaveCount(5);
});

it('lists the templates of the creation dialog with their number of questions', function () {
    $options = resolve(SurveyTemplateCatalogue::class)->options(Team::factory()->create());

    expect(array_column($options, 'key'))->toBe([null, 'health_check', 'team_pulse'])
        ->and(array_column($options, 'questionCount'))->toBe([0, 6, 5]);
});

it('writes definitions as questions and options, replacing what was there', function () {
    $survey = TeamSurvey::factory()->create();
    surveyQuestion($survey);
    $definitions = resolve(SurveyTemplateCatalogue::class)->questions(TeamSurveyTemplate::TeamPulse, $survey->team);

    resolve(WriteSurveyQuestions::class)->handle($survey, $definitions);

    $questions = $survey->questions()->with('options')->get();

    expect($questions)->toHaveCount(5)
        ->and($questions->pluck('position')->all())->toBe([0, 1, 2, 3, 4])
        ->and($questions[2]->options->pluck('position')->all())->toBe([0, 1, 2, 3]);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/SurveyTemplateCatalogueTest.php`
Expected: FAIL, `Class "App\Support\Surveys\SurveyTemplateCatalogue" not found`.

- [ ] **Step 3: Implementation**

`app/Support/Surveys/QuestionDefinition.php`:

```php
<?php

namespace App\Support\Surveys;

use App\Enums\HealthStatement;
use App\Enums\TeamSurveyQuestionKind;

class QuestionDefinition
{
    /**
     * @param  array<int, string>  $options
     */
    public function __construct(
        public TeamSurveyQuestionKind $kind,
        public string $label,
        public ?string $shortLabel = null,
        public ?string $description = null,
        public ?HealthStatement $builtin = null,
        public ?string $matchKey = null,
        public bool $isRequired = false,
        public bool $allowsComment = false,
        public ?int $scaleMax = null,
        public ?string $scaleMinLabel = null,
        public ?string $scaleMaxLabel = null,
        public array $options = [],
    ) {}
}
```

`app/Actions/HealthCheck/HealthCheckQuestions.php`:

```php
<?php

namespace App\Actions\HealthCheck;

use App\Enums\TeamSurveyQuestionKind;
use App\Models\Team;
use App\Models\TeamHealthStatement;
use App\Support\Surveys\HealthScale;
use App\Support\Surveys\QuestionDefinition;

class HealthCheckQuestions
{
    public function __construct(private TeamHealthStatements $teamHealthStatements) {}

    /**
     * One required question per active statement, on the health scale. The
     * ends "Strongly disagree" / "Strongly agree" are not stored: they are
     * translated for each reader (`PresentSurveyQuestion`, Task 7).
     *
     * @return array<int, QuestionDefinition>
     */
    public function handle(Team $team): array
    {
        return $this->teamHealthStatements->active($team)
            ->map(fn (TeamHealthStatement $statement): QuestionDefinition => new QuestionDefinition(
                kind: TeamSurveyQuestionKind::Scale,
                label: $statement->builtin?->text() ?? (string) $statement->text,
                shortLabel: $statement->builtin?->label() ?? $statement->label,
                builtin: $statement->builtin,
                matchKey: $statement->key(),
                isRequired: true,
                scaleMax: HealthScale::Max,
            ))
            ->values()
            ->all();
    }
}
```

`app/Support/Surveys/SurveyTemplateCatalogue.php`:

```php
<?php

namespace App\Support\Surveys;

use App\Actions\HealthCheck\HealthCheckQuestions;
use App\Enums\TeamSurveyQuestionKind;
use App\Enums\TeamSurveyTemplate;
use App\Models\Team;
use App\Models\TeamSurveyQuestion;

class SurveyTemplateCatalogue
{
    public function __construct(private HealthCheckQuestions $healthCheckQuestions) {}

    /**
     * @return array<int, QuestionDefinition>
     */
    public function questions(?TeamSurveyTemplate $template, Team $team): array
    {
        return match ($template) {
            null => [],
            TeamSurveyTemplate::HealthCheck => $this->healthCheckQuestions->handle($team),
            TeamSurveyTemplate::TeamPulse => $this->teamPulse(),
        };
    }

    /**
     * @return array<int, array{key: ?string, name: string, description: string, questionCount: int}>
     */
    public function options(Team $team): array
    {
        return [
            ['key' => null, 'name' => __('Blank'), 'description' => __('Start with no question.'), 'questionCount' => 0],
            [
                'key' => TeamSurveyTemplate::HealthCheck->value,
                'name' => __('Health check'),
                'description' => __('The team\'s statements, scored 1 to 5.'),
                'questionCount' => count($this->healthCheckQuestions->handle($team)),
            ],
            [
                'key' => TeamSurveyTemplate::TeamPulse->value,
                'name' => __('Team pulse'),
                'description' => __('Workload, recommendation, rituals and blockers.'),
                'questionCount' => count($this->teamPulse()),
            ],
        ];
    }

    /**
     * @return array<int, QuestionDefinition>
     */
    private function teamPulse(): array
    {
        return [
            new QuestionDefinition(
                kind: TeamSurveyQuestionKind::Scale,
                label: __('How do you rate the workload of this sprint?'),
                matchKey: 'pulse_workload',
                isRequired: true,
                allowsComment: true,
                scaleMax: TeamSurveyQuestion::BuilderScaleMax,
                scaleMinLabel: __('Unbearable'),
                scaleMaxLabel: __('Very comfortable'),
            ),
            new QuestionDefinition(
                kind: TeamSurveyQuestionKind::Nps,
                label: __('Would you recommend this team to a developer friend?'),
                matchKey: 'pulse_recommendation',
                isRequired: true,
                allowsComment: true,
            ),
            new QuestionDefinition(
                kind: TeamSurveyQuestionKind::Single,
                label: __('Which ritual should we keep at all costs?'),
                matchKey: 'pulse_ritual',
                options: [__('Retrospective'), __('Daily'), __('Planning poker'), __('Sprint review')],
            ),
            new QuestionDefinition(
                kind: TeamSurveyQuestionKind::Multiple,
                label: __('What slowed you down this sprint?'),
                matchKey: 'pulse_blockers',
                options: [
                    __('Too many meetings'),
                    __('Dependency on another team'),
                    __('Test environment'),
                    __('Unclear specifications'),
                    __('Something else'),
                ],
            ),
            new QuestionDefinition(
                kind: TeamSurveyQuestionKind::Text,
                label: __('A word for the team?'),
                matchKey: 'pulse_word',
            ),
        ];
    }
}
```

`app/Actions/TeamSurveys/WriteSurveyQuestions.php`:

```php
<?php

namespace App\Actions\TeamSurveys;

use App\Models\TeamSurvey;
use App\Support\Surveys\QuestionDefinition;

class WriteSurveyQuestions
{
    /**
     * Runs inside the caller's transaction.
     *
     * @param  array<int, QuestionDefinition>  $definitions
     */
    public function handle(TeamSurvey $survey, array $definitions): void
    {
        $survey->questions()->delete();

        foreach (array_values($definitions) as $position => $definition) {
            $question = $survey->questions()->create([
                'kind' => $definition->kind,
                'label' => $definition->label,
                'short_label' => $definition->shortLabel,
                'description' => $definition->description,
                'builtin' => $definition->builtin,
                'match_key' => $definition->matchKey,
                'position' => $position,
                'is_required' => $definition->isRequired,
                'allows_comment' => $definition->allowsComment,
                'scale_max' => $definition->scaleMax,
                'scale_min_label' => $definition->scaleMinLabel,
                'scale_max_label' => $definition->scaleMaxLabel,
            ]);

            foreach (array_values($definition->options) as $optionPosition => $label) {
                $question->options()->create(['label' => $label, 'position' => $optionPosition]);
            }
        }
    }
}
```

- [ ] **Step 4: Run the tests on the four engines**

Run, for each of `pgsql`, `mariadb`, `mysql`, `sqlite`: `bin/test-db <engine> -- tests/Unit/Support/Surveys/HealthScaleTest.php tests/Feature/TeamSurveys/SurveyTemplateCatalogueTest.php tests/Arch`
Expected: PASS on each.

- [ ] **Step 5: Translations and commit**

Add the keys of this task to the four language files (table of Task 30, back end), informal in French, Spanish and German.

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app/Support/Surveys app/Actions tests/Unit/Support/Surveys tests/Feature/TeamSurveys lang
git commit -m "feat(surveys): built-in templates on the health scale of five, with the health check fed by the team's statements"
```

### Task 3: Who is in — respondent resolution, middleware, guard, the survey page and its deletion

**Files:**
- Create: `app/Actions/TeamSurveys/ResolveRespondent.php`, `TeamSurveyGuard.php`, `BuildTeamSurveySnapshot.php`
- Create: `app/Http/Middleware/ResolveSurveyRespondent.php`
- Create: `app/Events/TeamSurveys/TeamSurveyBroadcastEvent.php`, `TeamSurveyDeleted.php`
- Create: `app/Http/Controllers/TeamSurveys/TeamSurveysController.php` (`show`, `edit`, `destroy`), `TeamSurveySnapshotsController.php`
- Create: `resources/js/pages/surveys/show.tsx`, `resources/js/pages/surveys/edit.tsx` (thin pages, replaced in Tasks 20 and 21: `tests/Arch/FrontEndPagesTest.php` refuses a component the server renders without its page file)
- Modify: `routes/web.php`
- Test: `tests/Feature/TeamSurveys/TeamSurveyAccessTest.php`, `tests/Concurrency/SurveyRespondentTest.php`

Read first: `app/Actions/Whiteboards/ResolveMember.php`, `app/Http/Middleware/ResolveWhiteboardMember.php`, `app/Events/Whiteboards/` (the base class and `SendsToOthers`), `tests/Concurrency/Support/Race.php` and `tests/Concurrency/VoteLimitTest.php`.

**Interfaces:**
- Consumes: Task 1; `GuestCookie::parse`, `GuestCookie::name`.
- Produces: `ResolveRespondent::handle(Request $request, TeamSurvey $survey): ?TeamSurveyRespondent` (a member as themselves, a guest of the survey by cookie; never anyone for an attached survey, which the middleware sends to its retro); `TeamSurveyGuard::editor(TeamSurvey, TeamSurveyRespondent): void`, `::notGuest(TeamSurveyRespondent): void`, `::viewable(TeamSurvey, TeamSurveyRespondent): void`, `::structureEditable(TeamSurvey): void`, `::open(TeamSurvey): void`; request attribute `surveyRespondent`; `BuildTeamSurveySnapshot::handle(TeamSurvey $survey, TeamSurveyRespondent $viewer): array` with the keys `survey`, `me`, `links`, `serverTime` (Task 9 adds `questions` and `progress`, Task 10 adds `results`, Task 11 adds `comparable`); routes `surveys.show`, `surveys.edit`, `surveys.destroy`, `surveys.snapshot.show`; event `TeamSurveyDeleted` (`survey.deleted`) on `PresenceChannel("survey.{id}")`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/TeamSurveys/TeamSurveyAccessTest.php`:

```php
<?php

use App\Enums\WorkspaceRole;
use App\Events\TeamSurveys\TeamSurveyDeleted;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;

it('lets a team member in as themselves, once', function () {
    $survey = TeamSurvey::factory()->open()->create();
    $user = teamMember($survey->team);

    $this->actingAs($user)->get(route('surveys.show', $survey))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('surveys/show')
            ->where('snapshot.survey.id', $survey->id)
            ->where('snapshot.survey.status', 'open')
            ->where('snapshot.me.isGuest', false)
            ->where('snapshot.me.isEditor', false));

    $this->actingAs($user)->getJson(route('surveys.snapshot.show', $survey))->assertOk();

    expect($survey->respondents()->where('user_id', $user->id)->count())->toBe(1);
});

it('lets a workspace manager in as an editor', function () {
    $survey = TeamSurvey::factory()->open()->create();

    $this->actingAs(workspaceManager($survey->team->workspace))
        ->getJson(route('surveys.snapshot.show', $survey))
        ->assertOk()
        ->assertJsonPath('me.isEditor', true);
});

it('refuses a member of the workspace who is not in the team', function () {
    $survey = TeamSurvey::factory()->open()->create();
    $outsider = User::factory()->create();
    $survey->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)->getJson(route('surveys.snapshot.show', $survey))->assertForbidden();
});

it('lets a guest in with a valid cookie while guest access is on, and never on a draft', function () {
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->create();
    $guest = surveyGuest($survey);

    $this->withCookies(surveyGuestCookie($guest))->withCredentials()
        ->getJson(route('surveys.snapshot.show', $survey))
        ->assertOk()
        ->assertJsonPath('me.id', $guest->id)
        ->assertJsonPath('me.isGuest', true)
        ->assertJsonPath('survey.teamName', null)
        ->assertJsonPath('survey.guestUrl', null);

    $this->withCookies(surveyGuestCookie($guest, 'wrong'))->withCredentials()
        ->getJson(route('surveys.snapshot.show', $survey))
        ->assertForbidden();

    $survey->update(['guest_access_enabled' => false]);

    $this->withCookies(surveyGuestCookie($guest))->withCredentials()
        ->getJson(route('surveys.snapshot.show', $survey))
        ->assertForbidden();
});

it('sends whoever opens an attached health check to its retro, and answers 404 to its JSON routes', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $survey = TeamSurvey::factory()->attachedTo($retro)->open()->create();
    $member = teamMember($survey->team);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->actingAs($member)->get(route('surveys.show', $survey))->assertRedirect(route('retros.show', $retro));
    $this->actingAs($member)->get(route('surveys.results.show', $survey))->assertRedirect(route('retros.show', $retro));
    $this->actingAs($member)->getJson(route('surveys.snapshot.show', $survey))->assertNotFound();
    $this->actingAs($member)->deleteJson(route('surveys.destroy', $survey))->assertNotFound();

    auth()->logout();
    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->getJson(route('surveys.snapshot.show', $survey))
        ->assertNotFound();

    expect($survey->respondents()->count())->toBe(0);
});

it('shows a draft to its editors only', function () {
    $survey = TeamSurvey::factory()->create();
    [$facilitator] = surveyFacilitator($survey);
    $member = teamMember($survey->team);

    $this->actingAs($facilitator)->get(route('surveys.edit', $survey))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('surveys/edit')->where('snapshot.me.isEditor', true));
    $this->actingAs($member)->get(route('surveys.show', $survey))->assertForbidden();
    $this->actingAs($member)->get(route('surveys.edit', $survey))->assertForbidden();
});

it('sends an editor who opens a draft to the builder', function () {
    $survey = TeamSurvey::factory()->create();
    [$facilitator] = surveyFacilitator($survey);

    $this->actingAs($facilitator)->get(route('surveys.show', $survey))->assertRedirect(route('surveys.edit', $survey));
});

it('sends a logged-out visitor to the login page, or to the session-ended page when guests are allowed', function () {
    $closedToGuests = TeamSurvey::factory()->open()->create();
    $openToGuests = TeamSurvey::factory()->open()->withGuestAccess()->create();

    $this->get(route('surveys.show', $closedToGuests))->assertRedirect(route('login'));
    $this->get(route('surveys.show', $openToGuests))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('retros/session-ended'));
});

it('lets an editor delete the survey and tells the others', function () {
    Event::fake([TeamSurveyDeleted::class]);
    $survey = TeamSurvey::factory()->open()->create();
    [$facilitator] = surveyFacilitator($survey);
    [$member] = surveyMember($survey);

    $this->actingAs($member)->deleteJson(route('surveys.destroy', $survey))->assertForbidden();
    $this->actingAs($facilitator)->deleteJson(route('surveys.destroy', $survey))->assertNoContent();

    expect(TeamSurvey::query()->find($survey->id))->toBeNull();
    Event::assertDispatched(fn (TeamSurveyDeleted $event) => $event->surveyId === $survey->id && $event->broadcastAs() === 'survey.deleted');
});
```

A cookie that does not resolve answers 403 and no cookie at all answers 401, as `ResolveWhiteboardMember` does (`WhiteboardAccessTest`).

`tests/Concurrency/SurveyRespondentTest.php` — one respondent per person, proved with real connections (`firstOrCreate` falls back to `createOrFirst` on the unique key of Task 1):

```php
<?php

use App\Models\TeamSurvey;
use Tests\Concurrency\Support\Race;

it('makes one respondent of a member whose first two visits arrive at once', function () {
    $survey = TeamSurvey::factory()->open()->create();
    $userId = teamMember($survey->team)->id;
    $uri = route('surveys.snapshot.show', $survey, false);

    $outcomes = Race::run(array_fill(0, 4, static fn (): int => Race::request($userId, 'GET', $uri)), Race::FirstQuery);

    expect(array_column($outcomes, 'value'))->each->toBe(200)
        ->and($survey->respondents()->where('user_id', $userId)->count())->toBe(1);
});
```

The pause after the first query (`Race::FirstQuery`) puts the four requests between the lookup and the insert at the same moment; without the unique key, four rows would be written.

- [ ] **Step 2: Run them and see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/TeamSurveyAccessTest.php`
Expected: FAIL, `Route [surveys.show] not defined`.

- [ ] **Step 3: Resolution and guard**

`app/Actions/TeamSurveys/ResolveRespondent.php`:

```php
<?php

namespace App\Actions\TeamSurveys;

use App\Actions\Retros\GuestCookie;
use App\Enums\TeamSurveyStatus;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\Request;

class ResolveRespondent
{
    /**
     * A standalone survey only: an attached health check lives in its retro
     * (spec §6.3), and the middleware sends its visitors there first.
     */
    public function handle(Request $request, TeamSurvey $survey): ?TeamSurveyRespondent
    {
        if ($survey->retro_id !== null) {
            return null;
        }

        $user = $request->user();

        if ($user !== null && $user->can('view', $survey->team)) {
            return TeamSurveyRespondent::query()->firstOrCreate([
                'team_survey_id' => $survey->id,
                'user_id' => $user->id,
            ]);
        }

        if ($survey->status === TeamSurveyStatus::Draft) {
            return null;
        }

        return $this->guest($request, $survey);
    }

    private function guest(Request $request, TeamSurvey $survey): ?TeamSurveyRespondent
    {
        if (! $survey->guest_access_enabled) {
            return null;
        }

        $credentials = GuestCookie::parse($request->cookie(GuestCookie::name(GuestCookie::SurveyScope, $survey->id)));

        if ($credentials === null) {
            return null;
        }

        [$respondentId, $secret] = $credentials;

        $respondent = $survey->respondents()
            ->whereKey($respondentId)
            ->whereNull('user_id')
            ->whereNotNull('guest_secret_hash')
            ->first();

        if ($respondent === null) {
            return null;
        }

        if (! hash_equals((string) $respondent->guest_secret_hash, hash('sha256', $secret))) {
            return null;
        }

        return $respondent;
    }
}

`app/Actions/TeamSurveys/TeamSurveyGuard.php`:

```php
<?php

namespace App\Actions\TeamSurveys;

use App\Enums\TeamSurveyStatus;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\ValidationException;

class TeamSurveyGuard
{
    public static function editor(TeamSurvey $survey, TeamSurveyRespondent $respondent): void
    {
        if ($survey->isEditor($respondent)) {
            return;
        }

        throw new AuthorizationException(__('Only the survey\'s facilitator or a workspace admin can do this.'));
    }

    public static function notGuest(TeamSurveyRespondent $respondent): void
    {
        if (! $respondent->isGuest()) {
            return;
        }

        throw new AuthorizationException(__('Guests cannot do this.'));
    }

    public static function viewable(TeamSurvey $survey, TeamSurveyRespondent $respondent): void
    {
        if ($survey->status !== TeamSurveyStatus::Draft) {
            return;
        }

        self::editor($survey, $respondent);
    }

    public static function structureEditable(TeamSurvey $survey): void
    {
        if ($survey->status !== TeamSurveyStatus::Draft) {
            throw ValidationException::withMessages(['survey' => __('Questions can only change while the survey is a draft.')]);
        }

        if ($survey->hasLockedQuestions()) {
            throw ValidationException::withMessages(['survey' => __('The questions of a health check come from the team\'s statements.')]);
        }
    }

    public static function open(TeamSurvey $survey): void
    {
        if ($survey->status === TeamSurveyStatus::Open) {
            return;
        }

        throw ValidationException::withMessages(['survey' => __('This survey is not open.')]);
    }
}
```

`app/Http/Middleware/ResolveSurveyRespondent.php`:

```php
<?php

namespace App\Http\Middleware;

use App\Actions\Retros\GuestCookie;
use App\Actions\TeamSurveys\ResolveRespondent;
use App\Models\TeamSurvey;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class ResolveSurveyRespondent
{
    public function __construct(private ResolveRespondent $resolveRespondent) {}

    public function handle(Request $request, Closure $next): Response
    {
        $survey = $request->route('teamSurvey');

        abort_unless($survey instanceof TeamSurvey, 404);

        if ($survey->retro_id !== null) {
            return $this->sendToRetro($request, $survey);
        }

        $respondent = $this->resolveRespondent->handle($request, $survey);

        if ($respondent === null && $request->user() === null && ! $request->expectsJson()) {
            return $this->sendToLogin($request, $survey);
        }

        if ($respondent === null) {
            $hasGuestCookie = $request->cookies->has(GuestCookie::name(GuestCookie::SurveyScope, $survey->id));

            abort_if($request->user() === null && ! $hasGuestCookie, 401, __('Your session has expired.'));

            abort(403, __('You no longer have access to this survey.'));
        }

        $request->attributes->set('surveyRespondent', $respondent);

        return $next($request);
    }

    private function sendToLogin(Request $request, TeamSurvey $survey): Response
    {
        if (! $survey->guest_access_enabled) {
            return redirect()->guest(route('login'));
        }

        redirect()->setIntendedUrl($request->fullUrl());

        return Inertia::render('retros/session-ended')->toResponse($request);
    }

    /**
     * An attached health check is answered, closed and read in its retro
     * (spec §6.3, decision 10): its two pages lead there, the rest of the
     * survey scope does not exist for it. The retro's own middleware decides
     * who may enter.
     */
    private function sendToRetro(Request $request, TeamSurvey $survey): Response
    {
        $isPage = $request->isMethod('GET') && ! $request->expectsJson()
            && in_array($request->route()?->getName(), ['surveys.show', 'surveys.results.show'], true);

        abort_unless($isPage, 404);

        return redirect()->route('retros.show', $survey->retro_id);
    }
}
```

- [ ] **Step 4: Event base class, snapshot, controllers, routes**

`app/Events/TeamSurveys/TeamSurveyBroadcastEvent.php`:

```php
<?php

namespace App\Events\TeamSurveys;

use App\Events\Concerns\SendsToOthers;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

abstract class TeamSurveyBroadcastEvent implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable;
    use InteractsWithSockets;
    use SendsToOthers;

    public function __construct(public string $surveyId) {}

    public function broadcastOn(): Channel
    {
        return new PresenceChannel("survey.{$this->surveyId}");
    }

    abstract public function broadcastAs(): string;

    /**
     * @return array<string, mixed>
     */
    abstract public function broadcastWith(): array;
}
```

`app/Events/TeamSurveys/TeamSurveyDeleted.php`:

```php
<?php

namespace App\Events\TeamSurveys;

class TeamSurveyDeleted extends TeamSurveyBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'survey.deleted';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
```

`app/Actions/TeamSurveys/BuildTeamSurveySnapshot.php`:

```php
<?php

namespace App\Actions\TeamSurveys;

use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;

class BuildTeamSurveySnapshot
{
    /**
     * @return array<string, mixed>
     */
    public function handle(TeamSurvey $survey, TeamSurveyRespondent $viewer): array
    {
        $survey->loadMissing(['team.workspace', 'retro', 'facilitator.user']);
        $viewer->loadMissing('user');

        $isGuest = $viewer->isGuest();
        $isEditor = $survey->isEditor($viewer);

        return [
            'survey' => [
                'id' => $survey->id,
                'title' => $survey->title,
                'description' => $survey->description,
                'status' => $survey->status->value,
                'template' => $survey->template?->value,
                'hasLockedQuestions' => $survey->hasLockedQuestions(),
                'teamId' => $survey->team_id,
                'teamName' => $isGuest ? null : $survey->team->name,
                'retroId' => $survey->retro_id,
                'facilitatorName' => $survey->facilitator?->displayName(),
                'guestAccessEnabled' => $survey->guest_access_enabled,
                'guestUrl' => $isGuest ? null : route('surveys.join.show', $survey->guest_token),
                'oneQuestionAtATime' => $survey->one_question_at_a_time,
                'showResultsAfterAnswer' => $survey->show_results_after_answer,
                'resultsThreshold' => $survey->results_threshold,
                'version' => $survey->version,
                'openedAt' => $survey->opened_at?->toIso8601String(),
                'closedAt' => $survey->closed_at?->toIso8601String(),
            ],
            'me' => [
                'id' => $viewer->id,
                'name' => $viewer->displayName(),
                'avatarUrl' => $viewer->avatarUrl(),
                'isGuest' => $isGuest,
                'isEditor' => $isEditor,
                'hasSubmitted' => $viewer->hasSubmitted(),
                'canSeeResults' => $survey->resultsVisibleTo($viewer),
            ],
            'links' => [
                'team' => $isGuest ? null : route('teams.show', [$survey->team->workspace, $survey->team], absolute: false),
                'show' => route('surveys.show', $survey, absolute: false),
                'results' => route('surveys.results.show', $survey, absolute: false),
                'edit' => $isEditor && ! $isGuest ? route('surveys.edit', $survey, absolute: false) : null,
            ],
            'serverTime' => now()->utc()->format('Y-m-d\TH:i:s.v\Z'),
        ];
    }
}
```

`surveys.join.show` and `surveys.results.show` are registered in this task as routes (below) so that the snapshot can name them; their controllers arrive in Tasks 5 and 10. Until then the two routes point to a controller method that Task 5 and Task 10 fill: register them now with the final controller classes, each holding a `show` that calls `abort(404)`, and replace the bodies in their tasks.

`app/Http/Controllers/TeamSurveys/TeamSurveysController.php`:

```php
<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\BuildTeamSurveySnapshot;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Enums\TeamSurveyStatus;
use App\Events\TeamSurveys\TeamSurveyDeleted;
use App\Http\Controllers\Controller;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class TeamSurveysController extends Controller
{
    public function show(Request $request, TeamSurvey $teamSurvey, BuildTeamSurveySnapshot $buildTeamSurveySnapshot): Response|RedirectResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::viewable($teamSurvey, $respondent);

        if ($teamSurvey->status === TeamSurveyStatus::Draft) {
            return to_route('surveys.edit', $teamSurvey);
        }

        return Inertia::render('surveys/show', [
            'snapshot' => $buildTeamSurveySnapshot->handle($teamSurvey, $respondent),
        ]);
    }

    public function edit(Request $request, TeamSurvey $teamSurvey, BuildTeamSurveySnapshot $buildTeamSurveySnapshot): Response
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::notGuest($respondent);
        TeamSurveyGuard::editor($teamSurvey, $respondent);

        return Inertia::render('surveys/edit', [
            'snapshot' => $buildTeamSurveySnapshot->handle($teamSurvey, $respondent),
        ]);
    }

    public function destroy(Request $request, TeamSurvey $teamSurvey): HttpResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::editor($teamSurvey, $respondent);

        DB::transaction(function () use ($teamSurvey, $respondent): void {
            $locked = TeamSurvey::query()->whereKey($teamSurvey->id)->lockForUpdate()->firstOrFail();

            TeamSurveyGuard::editor($locked, $respondent);

            $surveyId = $locked->id;

            $locked->delete();

            (new TeamSurveyDeleted($surveyId))->sendToOthers();
        });

        return response()->noContent();
    }
}
```

`app/Http/Controllers/TeamSurveys/TeamSurveySnapshotsController.php`:

```php
<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\BuildTeamSurveySnapshot;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Http\Controllers\Controller;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeamSurveySnapshotsController extends Controller
{
    public function show(Request $request, TeamSurvey $teamSurvey, BuildTeamSurveySnapshot $buildTeamSurveySnapshot): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::viewable($teamSurvey, $respondent);

        return response()->json($buildTeamSurveySnapshot->handle($teamSurvey, $respondent));
    }
}
```

In `routes/web.php`, after the whiteboard group (imports added at the top, alphabetically):

```php
Route::get('surveys/join/{guestToken}', [TeamSurveyJoinsController::class, 'show'])->name('surveys.join.show');
Route::post('surveys/join/{guestToken}', [TeamSurveyJoinsController::class, 'store'])->name('surveys.join.store')->middleware('throttle:10,1');

Route::prefix('surveys/{teamSurvey}')
    ->whereUuid('teamSurvey')
    ->middleware(ResolveSurveyRespondent::class)
    ->scopeBindings()
    ->group(function (): void {
        Route::get('/', [TeamSurveysController::class, 'show'])->name('surveys.show');
        Route::get('edit', [TeamSurveysController::class, 'edit'])->name('surveys.edit');
        Route::delete('/', [TeamSurveysController::class, 'destroy'])->name('surveys.destroy');
        Route::get('snapshot', [TeamSurveySnapshotsController::class, 'show'])->name('surveys.snapshot.show');
        Route::get('results', [TeamSurveyResultsController::class, 'show'])->name('surveys.results.show');
    });
```

`TeamSurveyJoinsController` (root namespace, `show` and `store` calling `abort(404)`) and `TeamSurveys\TeamSurveyResultsController` (`show` calling `abort(404)`) are created here as shells.

The two pages the controller renders get thin files now, so that `tests/Arch/FrontEndPagesTest.php` (every rendered component has a page file, every page file is rendered) passes at every task: `resources/js/pages/surveys/show.tsx` and `edit.tsx`, each a default export that takes `{ snapshot }` (typed `{ survey: { title: string } }` for now) and renders `<Head title={snapshot.survey.title} />` with a `main` holding the title. Tasks 20 and 21 replace them. `npm run types:check` and `npm run check` pass on them.

- [ ] **Step 5: Run the tests on the four engines**

Run, for each of `pgsql`, `mariadb`, `mysql`, `sqlite`: `bin/test-db <engine> -- tests/Feature/TeamSurveys/TeamSurveyAccessTest.php tests/Arch`
Expected: PASS on each. Then the race, for each of `pgsql`, `mariadb`, `mysql`, `sqlite-file`: `bin/test-db <engine> --concurrency` (the whole folder, in one process) — Expected: PASS on each.

- [ ] **Step 6: Translations and commit**

Keys of this task: the guard messages of Task 30, informal in French, Spanish and German.

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app routes tests/Feature/TeamSurveys tests/Concurrency resources/js/pages/surveys lang
git commit -m "feat(surveys): respondent resolution, the survey page behind its middleware, deletion"
```

### Task 4: Creation from the team

**Files:**
- Create: `app/Actions/TeamSurveys/NewTeamSurvey.php`, `CreateTeamSurvey.php`
- Create: `app/Http/Requests/TeamSurveys/TeamSurveyStoreRequest.php`
- Modify: `app/Policies/TeamPolicy.php` (`createSurvey`), `app/Http/Controllers/TeamSurveys/TeamSurveysController.php` (`store`), `routes/web.php`
- Test: `tests/Feature/TeamSurveys/CreateTeamSurveyTest.php`

**Interfaces:**
- Consumes: `SurveyTemplateCatalogue::questions`, `WriteSurveyQuestions::handle` (Task 2).
- Produces: `NewTeamSurvey` (promoted `title`, `template`, `guestAccessEnabled`, `retro`, `open`); `CreateTeamSurvey::handle(Team $team, ?User $creator, NewTeamSurvey $data): TeamSurvey`; ability `createSurvey` on a team; route `teams.surveys.store`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/TeamSurveys/CreateTeamSurveyTest.php`:

```php
<?php

use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\User;

function surveyTeam(): array
{
    $team = Team::factory()->create();

    return [$team, teamMember($team)];
}

it('creates a draft with its creator as facilitator and opens the builder', function () {
    [$team, $user] = surveyTeam();

    $response = $this->actingAs($user)->post(route('teams.surveys.store', [$team->workspace, $team]), ['title' => 'Team pulse — sprint 42']);

    $survey = TeamSurvey::query()->sole();

    $response->assertRedirect(route('surveys.edit', $survey));

    expect($survey->team_id)->toBe($team->id)
        ->and($survey->status)->toBe(TeamSurveyStatus::Draft)
        ->and($survey->template)->toBeNull()
        ->and($survey->results_threshold)->toBe(3)
        ->and($survey->created_by_user_id)->toBe($user->id)
        ->and($survey->facilitator->user_id)->toBe($user->id)
        ->and(strlen($survey->guest_token))->toBe(40)
        ->and($survey->questions()->count())->toBe(0);
});

it('creates a health check with the team\'s statements', function () {
    [$team, $user] = surveyTeam();

    $this->actingAs($user)->post(route('teams.surveys.store', [$team->workspace, $team]), [
        'title' => 'Health check — October',
        'template' => 'health_check',
        'guest_access_enabled' => true,
    ])->assertRedirect();

    $survey = TeamSurvey::query()->sole();

    expect($survey->template)->toBe(TeamSurveyTemplate::HealthCheck)
        ->and($survey->guest_access_enabled)->toBeTrue()
        ->and($survey->questions()->count())->toBe(6)
        ->and($survey->questions()->first()->scale_max)->toBe(5)
        ->and($survey->questions()->first()->is_required)->toBeTrue();
});

it('refuses someone who cannot view the team', function () {
    [$team] = surveyTeam();
    $outsider = User::factory()->create();
    $team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)->post(route('teams.surveys.store', [$team->workspace, $team]), ['title' => 'Nope'])->assertForbidden();
});

it('validates the title and the template', function (array $body, string $field) {
    [$team, $user] = surveyTeam();

    $this->actingAs($user)->postJson(route('teams.surveys.store', [$team->workspace, $team]), $body)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'no title' => [['title' => ''], 'title'],
    'title too long' => [['title' => str_repeat('a', 121)], 'title'],
    'unknown template' => [['title' => 'T', 'template' => 'ranking'], 'template'],
    'guest flag not a boolean' => [['title' => 'T', 'guest_access_enabled' => 'maybe'], 'guest_access_enabled'],
]);
```

- [ ] **Step 2: Run it and see it fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/CreateTeamSurveyTest.php`
Expected: FAIL, `Route [teams.surveys.store] not defined`.

- [ ] **Step 3: Implementation**

In `app/Policies/TeamPolicy.php`, after `createGameRoom`:

```php
    public function createSurvey(User $user, Team $team): bool
    {
        return $this->view($user, $team);
    }
```

`app/Actions/TeamSurveys/NewTeamSurvey.php`:

```php
<?php

namespace App\Actions\TeamSurveys;

use App\Enums\TeamSurveyTemplate;
use App\Models\Retro;

class NewTeamSurvey
{
    public function __construct(
        public string $title,
        public ?TeamSurveyTemplate $template = null,
        public bool $guestAccessEnabled = false,
        public ?Retro $retro = null,
        public bool $open = false,
    ) {}
}
```

`app/Actions/TeamSurveys/CreateTeamSurvey.php`:

```php
<?php

namespace App\Actions\TeamSurveys;

use App\Enums\TeamSurveyStatus;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Support\Surveys\SurveyTemplateCatalogue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateTeamSurvey
{
    public function __construct(
        private SurveyTemplateCatalogue $surveyTemplateCatalogue,
        private WriteSurveyQuestions $writeSurveyQuestions,
    ) {}

    /**
     * A survey attached to a retro has no minimum of answers, shows every
     * statement at once and keeps its results for the end, as the health
     * check of a retro always did.
     */
    public function handle(Team $team, ?User $creator, NewTeamSurvey $data): TeamSurvey
    {
        return DB::transaction(function () use ($team, $creator, $data): TeamSurvey {
            $isAttached = $data->retro !== null;

            $survey = $team->teamSurveys()->create([
                'retro_id' => $data->retro?->id,
                'title' => $data->title,
                'template' => $data->template,
                'status' => $data->open ? TeamSurveyStatus::Open : TeamSurveyStatus::Draft,
                'opened_at' => $data->open ? now() : null,
                'created_by_user_id' => $creator?->id,
                'guest_access_enabled' => $data->guestAccessEnabled,
                'guest_token' => Str::random(40),
                'results_threshold' => $isAttached ? 0 : TeamSurvey::StandaloneThreshold,
                'one_question_at_a_time' => ! $isAttached,
                'show_results_after_answer' => ! $isAttached,
            ]);

            if ($creator !== null) {
                $respondent = $survey->respondents()->create(['user_id' => $creator->id]);

                $survey->update(['facilitator_respondent_id' => $respondent->id]);
            }

            $this->writeSurveyQuestions->handle($survey, $this->surveyTemplateCatalogue->questions($data->template, $team));

            return $survey;
        });
    }
}
```

`app/Http/Requests/TeamSurveys/TeamSurveyStoreRequest.php`:

```php
<?php

namespace App\Http\Requests\TeamSurveys;

use App\Enums\TeamSurveyTemplate;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TeamSurveyStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('createSurvey', $this->route('team')) ?? false;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:120'],
            'template' => ['sometimes', 'nullable', Rule::enum(TeamSurveyTemplate::class)],
            'guest_access_enabled' => ['sometimes', 'boolean'],
        ];
    }
}
```

In `TeamSurveysController`, first method:

```php
    public function store(TeamSurveyStoreRequest $request, Workspace $workspace, Team $team, CreateTeamSurvey $createTeamSurvey): RedirectResponse
    {
        $survey = $createTeamSurvey->handle($team, $request->user(), new NewTeamSurvey(
            title: $request->validated('title'),
            template: $request->enum('template', TeamSurveyTemplate::class),
            guestAccessEnabled: $request->boolean('guest_access_enabled'),
        ));

        return to_route('surveys.edit', $survey);
    }
```

In the `w/{workspace}` group of `routes/web.php`, after `teams.whiteboards.store`:

```php
            Route::post('teams/{team}/surveys', [TeamSurveysController::class, 'store'])->name('teams.surveys.store');
```

- [ ] **Step 4: Run the tests on the four engines**

Run, for each of `pgsql`, `mariadb`, `mysql`, `sqlite`: `bin/test-db <engine> -- tests/Feature/TeamSurveys/CreateTeamSurveyTest.php tests/Arch`
Expected: PASS on each.

- [ ] **Step 5: Commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app routes tests/Feature/TeamSurveys
git commit -m "feat(surveys): a team member creates a survey, blank or from a built-in template"
```

### Task 5: The channel and its events

**Files:**
- Create: `app/Events/TeamSurveys/TeamSurveyChanged.php`, `TeamSurveyResponsesChanged.php`
- Modify: `app/Http/Controllers/BroadcastAuthorizationsController.php`
- Test: `tests/Feature/TeamSurveys/TeamSurveyBroadcastAuthorizationTest.php`, `tests/Feature/TeamSurveys/TeamSurveyEventsTest.php`

**Interfaces:**
- Consumes: `ResolveRespondent::handle`, `TeamSurveyBroadcastEvent` (Task 3).
- Produces: `TeamSurveyChanged::for(TeamSurvey $survey): self` (`survey.changed`, payload `version`, `status`); `TeamSurveyResponsesChanged::for(TeamSurvey $survey): self` (`survey.responses.changed`, payload `responses`, `completed`); the channel `presence-survey.{id}`.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/TeamSurveys/TeamSurveyBroadcastAuthorizationTest.php`:

```php
<?php

use App\Enums\WorkspaceRole;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\User;

beforeEach(function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);
});

function surveyChannelRequest(TeamSurvey $survey): array
{
    return ['socket_id' => '1234.5678', 'channel_name' => "presence-survey.{$survey->id}"];
}

it('signs presence data for a member', function () {
    $survey = TeamSurvey::factory()->open()->create();
    [$user, $respondent] = surveyMember($survey);

    $response = $this->actingAs($user)->postJson(route('broadcasting.auth'), surveyChannelRequest($survey))->assertOk();

    $channelData = json_decode($response->json('channel_data'), true);

    expect($response->json('auth'))->toStartWith('test-key:')
        ->and($channelData['user_id'])->toBe($respondent->id)
        ->and($channelData['user_info'])->toBe([
            'id' => $respondent->id,
            'name' => $user->name,
            'avatarUrl' => $respondent->avatarUrl(),
            'isGuest' => false,
        ]);
});

it('signs for a guest of the survey', function () {
    $standalone = TeamSurvey::factory()->open()->withGuestAccess()->create();
    $guest = surveyGuest($standalone);

    $this->withCookies(surveyGuestCookie($guest))->withCredentials()
        ->postJson(route('broadcasting.auth'), surveyChannelRequest($standalone))
        ->assertOk();
});

it('refuses the channel of an attached health check, which speaks on its retro\'s channel', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $attached = TeamSurvey::factory()->attachedTo($retro)->open()->create();
    $retroGuest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->actingAs(teamMember($attached->team))->postJson(route('broadcasting.auth'), surveyChannelRequest($attached))->assertForbidden();
    auth()->logout();
    $this->withCookies(retroGuestCookie($retroGuest))->withCredentials()
        ->postJson(route('broadcasting.auth'), surveyChannelRequest($attached))
        ->assertForbidden();
});

it('refuses an outsider, a guest of another survey, an unauthenticated socket and a malformed name', function () {
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->create();
    $outsider = User::factory()->create();
    $survey->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);
    $otherGuest = surveyGuest(TeamSurvey::factory()->open()->withGuestAccess()->create());

    $this->actingAs($outsider)->postJson(route('broadcasting.auth'), surveyChannelRequest($survey))->assertForbidden();
    auth()->logout();
    $this->withCookies(surveyGuestCookie($otherGuest))->withCredentials()
        ->postJson(route('broadcasting.auth'), surveyChannelRequest($survey))
        ->assertForbidden();
    $this->postJson(route('broadcasting.auth'), surveyChannelRequest($survey))->assertForbidden();
    $this->postJson(route('broadcasting.auth'), ['socket_id' => '1234.5678', 'channel_name' => 'presence-survey.not-a-uuid'])->assertForbidden();
});

it('refuses the channel of a draft to a member who is not an editor', function () {
    $survey = TeamSurvey::factory()->create();
    [$facilitator] = surveyFacilitator($survey);

    $this->actingAs(teamMember($survey->team))->postJson(route('broadcasting.auth'), surveyChannelRequest($survey))->assertForbidden();
    $this->actingAs($facilitator)->postJson(route('broadcasting.auth'), surveyChannelRequest($survey))->assertOk();
});
```

`tests/Feature/TeamSurveys/TeamSurveyEventsTest.php`:

```php
<?php

use App\Enums\TeamSurveyQuestionKind;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Events\TeamSurveys\TeamSurveyResponsesChanged;
use App\Models\TeamSurvey;
use Illuminate\Broadcasting\PresenceChannel;

it('announces a change with a version and a status, nothing else', function () {
    $survey = TeamSurvey::factory()->open()->create(['version' => 7]);

    $event = TeamSurveyChanged::for($survey);

    expect($event->broadcastAs())->toBe('survey.changed')
        ->and($event->broadcastWith())->toBe(['version' => 7, 'status' => 'open'])
        ->and($event->broadcastOn())->toBeInstanceOf(PresenceChannel::class)
        ->and($event->broadcastOn()->name)->toBe("presence-survey.{$survey->id}");
});

it('announces answers with two counts and never an answer, an aggregate or a respondent', function () {
    $survey = TeamSurvey::factory()->open()->create();
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Text);
    [, $first] = surveyMember($survey);
    [, $second] = surveyMember($survey);
    answerSurveyQuestion($question, $first, 'a very recognisable sentence');
    answerSurveyQuestion($question, $second, 'another one');
    $second->update(['completed_at' => now()]);

    $payload = TeamSurveyResponsesChanged::for($survey)->broadcastWith();

    expect($payload)->toBe(['responses' => 2, 'completed' => 1])
        ->and(json_encode($payload))->not->toContain('recognisable')
        ->and(json_encode($payload))->not->toContain($first->id);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/TeamSurveyBroadcastAuthorizationTest.php tests/Feature/TeamSurveys/TeamSurveyEventsTest.php`
Expected: FAIL, `Class "App\Events\TeamSurveys\TeamSurveyChanged" not found` and 403 on the member's channel.

- [ ] **Step 3: Events**

`app/Events/TeamSurveys/TeamSurveyChanged.php`:

```php
<?php

namespace App\Events\TeamSurveys;

use App\Models\TeamSurvey;

class TeamSurveyChanged extends TeamSurveyBroadcastEvent
{
    public function __construct(string $surveyId, public int $version, public string $status)
    {
        parent::__construct($surveyId);
    }

    public static function for(TeamSurvey $survey): self
    {
        return new self($survey->id, $survey->version, $survey->status->value);
    }

    public function broadcastAs(): string
    {
        return 'survey.changed';
    }

    public function broadcastWith(): array
    {
        return ['version' => $this->version, 'status' => $this->status];
    }
}
```

`app/Events/TeamSurveys/TeamSurveyResponsesChanged.php`:

```php
<?php

namespace App\Events\TeamSurveys;

use App\Models\TeamSurvey;

class TeamSurveyResponsesChanged extends TeamSurveyBroadcastEvent
{
    public function __construct(string $surveyId, public int $responses, public int $completed)
    {
        parent::__construct($surveyId);
    }

    public static function for(TeamSurvey $survey): self
    {
        return new self($survey->id, $survey->responseCount(), $survey->completedCount());
    }

    public function broadcastAs(): string
    {
        return 'survey.responses.changed';
    }

    public function broadcastWith(): array
    {
        return ['responses' => $this->responses, 'completed' => $this->completed];
    }
}
```

- [ ] **Step 4: Channel authorisation**

In `BroadcastAuthorizationsController::store`, add the parameter `ResolveRespondent $resolveRespondent` (import `App\Actions\TeamSurveys\ResolveRespondent`, `App\Models\TeamSurvey`, `App\Enums\TeamSurveyStatus`) and, before the `presence-whiteboard.` branch:

```php
        if (str_starts_with($validated['channel_name'], 'presence-survey.')) {
            return $this->authorizeSurveyChannel($request, $validated, $resolveRespondent);
        }
```

and the method:

```php
    /**
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeSurveyChannel(Request $request, array $validated, ResolveRespondent $resolveRespondent): JsonResponse
    {
        $surveyId = Str::after($validated['channel_name'], 'presence-survey.');

        abort_unless(Str::isUuid($surveyId), 403);

        $survey = TeamSurvey::query()->find($surveyId);

        abort_if($survey === null, 403);
        abort_unless($survey->id === $surveyId, 403);
        abort_if($survey->retro_id !== null, 403);

        $respondent = $resolveRespondent->handle($request, $survey);

        abort_if($respondent === null, 403);
        abort_if($survey->status === TeamSurveyStatus::Draft && ! $survey->isEditor($respondent), 403);

        $signature = $this->pusher()->authorizePresenceChannel(
            $validated['channel_name'],
            $validated['socket_id'],
            $respondent->id,
            [
                'id' => $respondent->id,
                'name' => $respondent->displayName(),
                'avatarUrl' => $respondent->avatarUrl(),
                'isGuest' => $respondent->isGuest(),
            ],
        );

        return response()->json(json_decode($signature, true));
    }
```

- [ ] **Step 5: Run the tests on the four engines**

Run, for each of `pgsql`, `mariadb`, `mysql`, `sqlite`: `bin/test-db <engine> -- tests/Feature/TeamSurveys/TeamSurveyBroadcastAuthorizationTest.php tests/Feature/TeamSurveys/TeamSurveyEventsTest.php tests/Feature/Whiteboards/WhiteboardBroadcastAuthorizationTest.php`
Expected: PASS on each.

- [ ] **Step 6: Commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app tests/Feature/TeamSurveys
git commit -m "feat(surveys): presence channel of a survey and its two count-only events"
```

### Task 6: Guest join and the guest link

**Files:**
- Modify: `app/Http/Controllers/TeamSurveyJoinsController.php` (bodies), `app/Actions/Sessions/PresentJoinSession.php` (`survey`), `routes/web.php`
- Create: `app/Http/Controllers/TeamSurveys/TeamSurveyGuestTokensController.php`; `resources/js/pages/surveys/join.tsx` (a thin page, as in Task 3; Task 22 replaces it)
- Test: `tests/Feature/TeamSurveys/TeamSurveyJoinTest.php`

Read first: `app/Http/Controllers/WhiteboardJoinsController.php` and `app/Actions/Sessions/PresentJoinSession.php` as they are now — the join pages receive `...PresentJoinSession::nickname($visitor)` (`suggestedName`, a random nickname for a visitor without an account, and the optional `randomName`), the owner's D-51.

**Interfaces:**
- Consumes: `ResolveRespondent::handle`, `TeamSurveyGuard::editor`, `TeamSurveyChanged::for`, `GuestCookie::make`, `PresentJoinSession::nickname`.
- Produces: `PresentJoinSession::survey(TeamSurvey $survey): array{title: string, facilitatorName: ?string, participantsCount: int, isLive: bool}`; routes `surveys.join.show`, `surveys.join.store`, `surveys.guestToken.store`; page `surveys/join` with the props `isInvalid`, `guestToken`, `surveyTitle`, `session`, `suggestedName`, `randomName` (optional).

- [ ] **Step 1: Write the failing test**

`tests/Feature/TeamSurveys/TeamSurveyJoinTest.php`:

```php
<?php

use App\Actions\Retros\GuestCookie;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Models\TeamSurvey;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;

it('shows the join page of an open survey with its summary', function () {
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->create(['title' => 'Team pulse']);
    [$facilitator] = surveyFacilitator($survey);

    $this->get(route('surveys.join.show', $survey->guest_token))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('surveys/join')
            ->where('isInvalid', false)
            ->where('surveyTitle', 'Team pulse')
            ->where('session.title', 'Team pulse')
            ->where('session.facilitatorName', $facilitator->name)
            ->where('session.participantsCount', 1)
            ->where('session.isLive', true)
            ->where('suggestedName', fn (string $name): bool => $name !== ''));
});

it('answers 404 with the invalid state for an unknown token, a survey without guest access, a draft and an attached health check', function (Closure $token) {
    $this->get(route('surveys.join.show', $token()))
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page->component('surveys/join')->where('isInvalid', true)->missing('session'));
})->with([
    'unknown' => [fn () => str_repeat('x', 40)],
    'guest access off' => [fn () => TeamSurvey::factory()->open()->create()->guest_token],
    'draft' => [fn () => TeamSurvey::factory()->withGuestAccess()->create()->guest_token],
    'attached' => [fn () => TeamSurvey::factory()->attachedTo(App\Models\Retro::factory()->create())->open()->withGuestAccess()->create()->guest_token],
]);

it('lets a guest join with a name and sends them to the survey with a cookie', function () {
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->create();

    $response = $this->post(route('surveys.join.store', $survey->guest_token), ['name' => 'Otter'])
        ->assertRedirect(route('surveys.show', $survey));

    $guest = $survey->respondents()->whereNull('user_id')->sole();

    expect($guest->guest_name)->toBe('Otter');
    $response->assertCookie(GuestCookie::name(GuestCookie::SurveyScope, $survey->id));
});

it('sends someone already in straight to the survey', function () {
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->create();

    $this->actingAs(teamMember($survey->team))
        ->get(route('surveys.join.show', $survey->guest_token))
        ->assertRedirect(route('surveys.show', $survey));
});

it('refuses a join without a name or with a name that is too long', function (string $name) {
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->create();

    $this->postJson(route('surveys.join.store', $survey->guest_token), ['name' => $name])->assertJsonValidationErrors('name');
})->with(['', str_repeat('a', 51)]);

it('lets an editor create a new link, which signs the guests out', function () {
    Event::fake([TeamSurveyChanged::class]);
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->create();
    [$facilitator] = surveyFacilitator($survey);
    [$member] = surveyMember($survey);
    $guest = surveyGuest($survey);
    $oldToken = $survey->guest_token;

    $this->actingAs($member)->postJson(route('surveys.guestToken.store', $survey))->assertForbidden();

    $url = $this->actingAs($facilitator)->postJson(route('surveys.guestToken.store', $survey))->assertOk()->json('guestUrl');

    expect($survey->fresh()->guest_token)->not->toBe($oldToken)
        ->and($url)->toBe(route('surveys.join.show', $survey->fresh()->guest_token))
        ->and($guest->fresh()->guest_secret_hash)->toBeNull();
    Event::assertDispatched(TeamSurveyChanged::class);

    auth()->logout();
    $this->withCookies(surveyGuestCookie($guest))->withCredentials()
        ->getJson(route('surveys.snapshot.show', $survey))
        ->assertForbidden();
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/TeamSurveyJoinTest.php`
Expected: FAIL (404 on the join page, missing route `surveys.guestToken.store`).

- [ ] **Step 3: Implementation**

In `app/Actions/Sessions/PresentJoinSession.php`:

```php
    /**
     * @return array{
     *     title: string,
     *     facilitatorName: ?string,
     *     participantsCount: int,
     *     isLive: bool
     * }
     */
    public function survey(TeamSurvey $survey): array
    {
        return [
            'title' => $survey->title,
            'facilitatorName' => $survey->facilitator?->displayName(),
            'participantsCount' => $survey->respondents()->count(),
            'isLive' => $survey->status === TeamSurveyStatus::Open,
        ];
    }
```

`app/Http/Controllers/TeamSurveyJoinsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Retros\GuestCookie;
use App\Actions\Sessions\PresentJoinSession;
use App\Actions\TeamSurveys\ResolveRespondent;
use App\Enums\TeamSurveyStatus;
use App\Models\TeamSurvey;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class TeamSurveyJoinsController extends Controller
{
    public function show(Request $request, string $guestToken, ResolveRespondent $resolveRespondent, PresentJoinSession $presentJoinSession): Response
    {
        $survey = $this->findSurvey($guestToken);

        if ($survey === null) {
            return $this->invalidLink($request);
        }

        if ($resolveRespondent->handle($request, $survey) !== null) {
            return to_route('surveys.show', $survey);
        }

        return Inertia::render('surveys/join', [
            'isInvalid' => false,
            'guestToken' => $guestToken,
            'surveyTitle' => $survey->title,
            'session' => $presentJoinSession->survey($survey),
            ...$presentJoinSession->nickname($request->user()),
        ])->toResponse($request);
    }

    public function store(Request $request, string $guestToken, ResolveRespondent $resolveRespondent): Response
    {
        $survey = $this->findSurvey($guestToken);

        if ($survey === null) {
            return $this->invalidLink($request);
        }

        if ($resolveRespondent->handle($request, $survey) !== null) {
            return to_route('surveys.show', $survey);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50'],
        ]);

        $secret = Str::random(40);

        $respondent = $survey->respondents()->create([
            'guest_name' => $validated['name'],
            'guest_secret_hash' => hash('sha256', $secret),
        ]);

        return to_route('surveys.show', $survey)
            ->withCookie(GuestCookie::make(GuestCookie::SurveyScope, $survey->id, $respondent->id, $secret));
    }

    private function findSurvey(string $guestToken): ?TeamSurvey
    {
        return TeamSurvey::query()
            ->where('guest_token', $guestToken)
            ->where('guest_access_enabled', true)
            ->where('status', '!=', TeamSurveyStatus::Draft)
            ->whereNull('retro_id')
            ->first();
    }

    private function invalidLink(Request $request): Response
    {
        return Inertia::render('surveys/join', ['isInvalid' => true])
            ->toResponse($request)
            ->setStatusCode(404);
    }
}
```

`app/Http/Controllers/TeamSurveys/TeamSurveyGuestTokensController.php`:

```php
<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Http\Controllers\Controller;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TeamSurveyGuestTokensController extends Controller
{
    public function store(Request $request, TeamSurvey $teamSurvey): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::editor($teamSurvey, $respondent);

        $guestToken = DB::transaction(function () use ($teamSurvey, $respondent): string {
            $locked = TeamSurvey::query()->whereKey($teamSurvey->id)->lockForUpdate()->firstOrFail();

            TeamSurveyGuard::editor($locked, $respondent);

            $locked->update(['guest_token' => Str::random(40)]);

            $locked->respondents()
                ->whereNull('user_id')
                ->whereNotNull('guest_secret_hash')
                ->update(['guest_secret_hash' => null]);

            TeamSurveyChanged::for($locked)->sendToOthers();

            return $locked->guest_token;
        });

        return response()->json(['guestUrl' => route('surveys.join.show', $guestToken)]);
    }
}
```

Route, inside the survey group: `Route::post('guest-token', [TeamSurveyGuestTokensController::class, 'store'])->name('surveys.guestToken.store');`

`resources/js/pages/surveys/join.tsx`: a thin page as in Task 3 (`<Head>` and a `main` with the title, or with nothing when `isInvalid`), so that `FrontEndPagesTest` passes; Task 22 builds the real one on `GuestJoinPage`.

- [ ] **Step 4: Run the tests on the four engines**

Run, for each of `pgsql`, `mariadb`, `mysql`, `sqlite`: `bin/test-db <engine> -- tests/Feature/TeamSurveys/TeamSurveyJoinTest.php tests/Feature/Sessions tests/Arch`
Expected: PASS on each.

- [ ] **Step 5: Commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app routes tests/Feature/TeamSurveys resources/js/pages/surveys/join.tsx
git commit -m "feat(surveys): guests join a survey by link with a suggested nickname, and an editor can replace the link"
```

### Task 7: Builder back end — settings, questions, order, duplicate

**Files:**
- Create: `app/Actions/TeamSurveys/PresentSurveyQuestion.php`
- Create: `app/Http/Requests/TeamSurveys/TeamSurveyUpdateRequest.php`, `TeamSurveyQuestionRequest.php`, `TeamSurveyQuestionOrderRequest.php`
- Create: `app/Http/Controllers/TeamSurveys/TeamSurveyQuestionsController.php`, `TeamSurveyQuestionOrdersController.php`, `TeamSurveyQuestionDuplicatesController.php`
- Modify: `app/Http/Controllers/TeamSurveys/TeamSurveysController.php` (`update`), `routes/web.php`
- Test: `tests/Feature/TeamSurveys/TeamSurveyBuilderTest.php`

**Interfaces:**
- Consumes: `TeamSurveyGuard::editor`, `::structureEditable`, `TeamSurveyChanged::for`.
- Produces: `PresentSurveyQuestion::handle(TeamSurveyQuestion $question, ?TeamSurveyAnswer $myAnswer = null): array{id: string, kind: string, label: string, shortLabel: ?string, description: ?string, position: int, isRequired: bool, allowsComment: bool, scaleMax: ?int, scaleLabels: ?array{0: ?string, 1: ?string}, isBuiltin: bool, options: array<int, array{id: string, label: string}>, myAnswer: ?array{value: ?int, optionIds: array<int, string>, text: ?string, comment: ?string}}`; `PresentSurveyQuestion::answer(?TeamSurveyAnswer $answer): ?array`; routes `surveys.update`, `surveys.questions.store|update|destroy`, `surveys.questionOrder.update`, `surveys.questions.duplicate.store`. Every write bumps `version` and sends `TeamSurveyChanged`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/TeamSurveys/TeamSurveyBuilderTest.php`:

```php
<?php

use App\Enums\TeamSurveyQuestionKind;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Models\TeamSurvey;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake([TeamSurveyChanged::class]);
});

function draftSurvey(array $attributes = []): array
{
    $survey = TeamSurvey::factory()->create($attributes);
    [$facilitator] = surveyFacilitator($survey);

    return [$survey, $facilitator];
}

it('saves the title and the three settings, and bumps the version', function () {
    [$survey, $facilitator] = draftSurvey();

    $this->actingAs($facilitator)->patchJson(route('surveys.update', $survey), [
        'title' => 'Team pulse — sprint 42',
        'one_question_at_a_time' => false,
        'show_results_after_answer' => false,
        'guest_access_enabled' => true,
    ])->assertOk()->assertJsonPath('survey.title', 'Team pulse — sprint 42')->assertJsonPath('survey.version', 2);

    expect($survey->fresh())
        ->one_question_at_a_time->toBeFalse()
        ->show_results_after_answer->toBeFalse()
        ->guest_access_enabled->toBeTrue();
    Event::assertDispatched(fn (TeamSurveyChanged $event) => $event->version === 2);
});

it('adds a question of each kind at the end', function (string $kind, array $body, ?int $scaleMax, int $options) {
    [$survey, $facilitator] = draftSurvey();
    surveyQuestion($survey);

    $this->actingAs($facilitator)->postJson(route('surveys.questions.store', $survey), ['kind' => $kind, 'label' => 'Q', ...$body])
        ->assertCreated()
        ->assertJsonPath('question.kind', $kind)
        ->assertJsonPath('question.position', 2)
        ->assertJsonPath('question.scaleMax', $scaleMax)
        ->assertJsonCount($options, 'question.options');

    expect($survey->questions()->count())->toBe(2)
        ->and($survey->questions()->get()->last()->match_key)->not->toBeNull();
})->with([
    'scale' => ['scale', ['scale_min_label' => 'Low', 'scale_max_label' => 'High', 'options' => []], 5, 0],
    'nps' => ['nps', ['options' => []], null, 0],
    'single' => ['single', ['options' => ['A', 'B']], null, 2],
    'multiple' => ['multiple', ['options' => ['A', 'B', 'C']], null, 3],
    'text' => ['text', ['options' => []], null, 0],
]);

it('validates a question by kind', function (array $body, string $field) {
    [$survey, $facilitator] = draftSurvey();

    $this->actingAs($facilitator)->postJson(route('surveys.questions.store', $survey), $body)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'no label' => [['kind' => 'text', 'label' => '', 'options' => []], 'label'],
    'label too long' => [['kind' => 'text', 'label' => str_repeat('a', 201), 'options' => []], 'label'],
    'unknown kind' => [['kind' => 'ranking', 'label' => 'Q', 'options' => []], 'kind'],
    'one option' => [['kind' => 'single', 'label' => 'Q', 'options' => ['A']], 'options'],
    'eleven options' => [['kind' => 'multiple', 'label' => 'Q', 'options' => array_map(fn (int $i) => "O{$i}", range(1, 11))], 'options'],
    'empty option' => [['kind' => 'single', 'label' => 'Q', 'options' => ['A', '']], 'options.1'],
    'options on a text' => [['kind' => 'text', 'label' => 'Q', 'options' => ['A', 'B']], 'options'],
    'end labels on an NPS' => [['kind' => 'nps', 'label' => 'Q', 'options' => [], 'scale_min_label' => 'Low'], 'scale_min_label'],
]);

it('refuses a thirty-first question', function () {
    [$survey, $facilitator] = draftSurvey();

    foreach (range(1, 30) as $ignored) {
        surveyQuestion($survey);
    }

    $this->actingAs($facilitator)->postJson(route('surveys.questions.store', $survey), ['kind' => 'text', 'label' => 'Q', 'options' => []])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('survey');
});

it('edits a question and replaces its options', function () {
    [$survey, $facilitator] = draftSurvey();
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Single, [], ['A', 'B']);

    $this->actingAs($facilitator)->patchJson(route('surveys.questions.update', [$survey, $question]), [
        'kind' => 'multiple', 'label' => 'Which ones?', 'is_required' => true, 'options' => ['X', 'Y', 'Z'],
    ])->assertOk()->assertJsonPath('question.isRequired', true)->assertJsonPath('question.options.2.label', 'Z');

    expect($question->fresh()->kind)->toBe(TeamSurveyQuestionKind::Multiple)
        ->and($question->options()->count())->toBe(3);
});

it('deletes a question and closes the gap in positions', function () {
    [$survey, $facilitator] = draftSurvey();
    $first = surveyQuestion($survey);
    $second = surveyQuestion($survey);
    $third = surveyQuestion($survey);

    $this->actingAs($facilitator)->deleteJson(route('surveys.questions.destroy', [$survey, $second]))->assertNoContent();

    expect($survey->questions()->pluck('position', 'id')->all())->toBe([$first->id => 0, $third->id => 1]);
});

it('reorders questions and refuses a list that is not every question once', function () {
    [$survey, $facilitator] = draftSurvey();
    $first = surveyQuestion($survey);
    $second = surveyQuestion($survey);

    $this->actingAs($facilitator)->putJson(route('surveys.questionOrder.update', $survey), ['ids' => [$second->id, $first->id]])->assertNoContent();

    expect($survey->questions()->pluck('id')->all())->toBe([$second->id, $first->id]);

    $this->actingAs($facilitator)->putJson(route('surveys.questionOrder.update', $survey), ['ids' => [$second->id]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('ids');
});

it('duplicates a question right after its source, with its options and a key of its own', function () {
    [$survey, $facilitator] = draftSurvey();
    $source = surveyQuestion($survey, TeamSurveyQuestionKind::Single, ['match_key' => 'source-key'], ['A', 'B']);
    $after = surveyQuestion($survey);

    $copyId = $this->actingAs($facilitator)->postJson(route('surveys.questions.duplicate.store', [$survey, $source]))
        ->assertCreated()
        ->json('question.id');

    expect($survey->questions()->pluck('id')->all())->toBe([$source->id, $copyId, $after->id])
        ->and($survey->questions()->find($copyId)->options()->pluck('label')->all())->toBe(['A', 'B'])
        ->and($survey->questions()->find($copyId)->match_key)->not->toBe('source-key');
});

it('refuses every write of the builder to a member who is not an editor', function () {
    [$survey] = draftSurvey();
    $question = surveyQuestion($survey);
    $member = teamMember($survey->team);

    $this->actingAs($member)->patchJson(route('surveys.update', $survey), ['title' => 'x'])->assertForbidden();
    $this->actingAs($member)->postJson(route('surveys.questions.store', $survey), ['kind' => 'text', 'label' => 'Q', 'options' => []])->assertForbidden();
    $this->actingAs($member)->patchJson(route('surveys.questions.update', [$survey, $question]), ['kind' => 'text', 'label' => 'Q', 'options' => []])->assertForbidden();
    $this->actingAs($member)->deleteJson(route('surveys.questions.destroy', [$survey, $question]))->assertForbidden();
    $this->actingAs($member)->putJson(route('surveys.questionOrder.update', $survey), ['ids' => [$question->id]])->assertForbidden();
    $this->actingAs($member)->postJson(route('surveys.questions.duplicate.store', [$survey, $question]))->assertForbidden();
});

it('locks the questions of an open survey and of a health check, and still saves settings', function (Closure $make) {
    $survey = $make();
    [$facilitator] = surveyFacilitator($survey);
    $question = surveyQuestion($survey);

    $this->actingAs($facilitator)->postJson(route('surveys.questions.store', $survey), ['kind' => 'text', 'label' => 'Q', 'options' => []])
        ->assertUnprocessable()->assertJsonValidationErrors('survey');
    $this->actingAs($facilitator)->deleteJson(route('surveys.questions.destroy', [$survey, $question]))->assertUnprocessable();
    $this->actingAs($facilitator)->patchJson(route('surveys.update', $survey), ['title' => 'Renamed'])->assertOk();
})->with([
    'open' => [fn () => TeamSurvey::factory()->open()->create()],
    'health check draft' => [fn () => TeamSurvey::factory()->healthCheck()->create()],
]);

it('does not find a question of another survey', function () {
    [$survey, $facilitator] = draftSurvey();
    $foreign = surveyQuestion(TeamSurvey::factory()->create());

    $this->actingAs($facilitator)->deleteJson(route('surveys.questions.destroy', [$survey, $foreign]))->assertNotFound();
});

it('gives the questions of a health check the ends of the mockup, in the reader\'s language', function () {
    [$survey, $facilitator] = draftSurvey(['template' => App\Enums\TeamSurveyTemplate::HealthCheck]);
    surveyQuestion($survey, TeamSurveyQuestionKind::Scale, ['scale_min_label' => null, 'scale_max_label' => null]);

    $this->actingAs($facilitator)->getJson(route('surveys.snapshot.show', $survey))
        ->assertJsonPath('questions.0.scaleLabels', ['Strongly disagree', 'Strongly agree']);
});
```

The last case needs the snapshot's `questions` of Task 9: write it here and run it from Task 9 on (or move it to `TeamSurveyAnswersTest`).

`tests/Concurrency/SurveyQuestionLimitTest.php` — the thirty-question limit under concurrent additions, proved by the lock on the survey row:

```php
<?php

use App\Models\TeamSurvey;
use Tests\Concurrency\Support\Race;

it('never gives a survey more than thirty questions when additions arrive at once', function () {
    $survey = TeamSurvey::factory()->create();
    [$facilitator] = surveyFacilitator($survey);

    foreach (range(1, 28) as $ignored) {
        surveyQuestion($survey);
    }

    $userId = $facilitator->id;
    $uri = route('surveys.questions.store', $survey, false);

    $outcomes = Race::run(array_fill(0, 4, static fn (): int => Race::request($userId, 'POST', $uri, ['kind' => 'text', 'label' => 'Q', 'options' => []])));

    $statuses = array_count_values(array_column($outcomes, 'value'));

    expect($survey->questions()->count())->toBe(30)
        ->and($statuses[201] ?? 0)->toBe(2)
        ->and($statuses[422] ?? 0)->toBe(2);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/TeamSurveyBuilderTest.php`
Expected: FAIL, `Route [surveys.update] not defined`.

- [ ] **Step 3: Presenter and requests**

`app/Actions/TeamSurveys/PresentSurveyQuestion.php`:

```php
<?php

namespace App\Actions\TeamSurveys;

use App\Enums\TeamSurveyQuestionKind;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyOption;
use App\Models\TeamSurveyQuestion;

class PresentSurveyQuestion
{
    /**
     * @return array<string, mixed>
     */
    public function handle(TeamSurveyQuestion $question, ?TeamSurveyAnswer $myAnswer = null): array
    {
        $question->loadMissing(['options', 'survey']);

        return [
            'id' => $question->id,
            'kind' => $question->kind->value,
            'label' => $question->displayLabel(),
            'shortLabel' => $question->displayShortLabel(),
            'description' => $question->description,
            'position' => $question->position,
            'isRequired' => $question->is_required,
            'allowsComment' => $question->allows_comment,
            'scaleMax' => $question->scale_max,
            'scaleLabels' => $this->scaleLabels($question),
            'isBuiltin' => $question->builtin !== null,
            'options' => $question->options->map(fn (TeamSurveyOption $option): array => [
                'id' => $option->id,
                'label' => $option->label,
            ])->values()->all(),
            'myAnswer' => $this->answer($myAnswer),
        ];
    }

    /**
     * A health check's ends are the HealthCheck mockup's, translated for each
     * reader; they are not stored, so a French team reads them in French and
     * a guest in their own language.
     *
     * @return array{0: ?string, 1: ?string}|null
     */
    private function scaleLabels(TeamSurveyQuestion $question): ?array
    {
        if ($question->kind !== TeamSurveyQuestionKind::Scale) {
            return null;
        }

        if ($question->survey->isHealthCheck()) {
            return [__('Strongly disagree'), __('Strongly agree')];
        }

        return [$question->scale_min_label, $question->scale_max_label];
    }

    /**
     * @return array{value: ?int, optionIds: array<int, string>, text: ?string, comment: ?string}|null
     */
    public function answer(?TeamSurveyAnswer $answer): ?array
    {
        if ($answer === null) {
            return null;
        }

        $answer->loadMissing('options');

        return [
            'value' => $answer->value,
            'optionIds' => $answer->options->pluck('id')->values()->all(),
            'text' => $answer->text,
            'comment' => $answer->comment,
        ];
    }
}
```

`app/Http/Requests/TeamSurveys/TeamSurveyUpdateRequest.php`:

```php
<?php

namespace App\Http\Requests\TeamSurveys;

use Illuminate\Foundation\Http\FormRequest;

class TeamSurveyUpdateRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'guest_access_enabled' => ['sometimes', 'boolean'],
            'one_question_at_a_time' => ['sometimes', 'boolean'],
            'show_results_after_answer' => ['sometimes', 'boolean'],
        ];
    }
}
```

`app/Http/Requests/TeamSurveys/TeamSurveyQuestionRequest.php`:

```php
<?php

namespace App\Http\Requests\TeamSurveys;

use App\Enums\TeamSurveyQuestionKind;
use App\Models\TeamSurveyQuestion;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TeamSurveyQuestionRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $kind = TeamSurveyQuestionKind::tryFrom((string) $this->input('kind'));
        $isChoice = $kind?->isChoice() ?? false;
        $isScale = $kind === TeamSurveyQuestionKind::Scale;
        $isNumeric = $kind?->isNumeric() ?? false;

        return [
            'kind' => ['required', Rule::enum(TeamSurveyQuestionKind::class)],
            'label' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_required' => ['sometimes', 'boolean'],
            'allows_comment' => ['sometimes', 'boolean', Rule::prohibitedIf(! $isNumeric && $this->boolean('allows_comment'))],
            'scale_min_label' => ['nullable', 'string', 'max:60', Rule::prohibitedIf(! $isScale)],
            'scale_max_label' => ['nullable', 'string', 'max:60', Rule::prohibitedIf(! $isScale)],
            'options' => $isChoice
                ? ['required', 'array', 'min:'.TeamSurveyQuestion::MinOptions, 'max:'.TeamSurveyQuestion::MaxOptions]
                : ['prohibited'],
            'options.*' => ['required', 'string', 'max:100'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function attributesForQuestion(): array
    {
        $kind = $this->enum('kind', TeamSurveyQuestionKind::class);

        return [
            'kind' => $kind,
            'label' => $this->validated('label'),
            'description' => $this->validated('description'),
            'is_required' => $this->boolean('is_required'),
            'allows_comment' => $kind->isNumeric() && $this->boolean('allows_comment'),
            'scale_max' => $kind === TeamSurveyQuestionKind::Scale ? TeamSurveyQuestion::BuilderScaleMax : null,
            'scale_min_label' => $this->validated('scale_min_label'),
            'scale_max_label' => $this->validated('scale_max_label'),
        ];
    }
}
```

`app/Http/Requests/TeamSurveys/TeamSurveyQuestionOrderRequest.php`:

```php
<?php

namespace App\Http\Requests\TeamSurveys;

use Illuminate\Foundation\Http\FormRequest;

class TeamSurveyQuestionOrderRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'ids' => ['required', 'array'],
            'ids.*' => ['required', 'uuid', 'distinct'],
        ];
    }
}
```

The three requests have no `authorize` method: who may write is decided on the respondent, by `TeamSurveyGuard`, in the controller (a Form Request's default `authorize` answers true when the method is absent; check `Illuminate\Foundation\Http\FormRequest::passesAuthorization` on the installed version and add `authorize(): bool { return true; }` if it does not).

- [ ] **Step 4: Controllers and routes**

In `TeamSurveysController`:

```php
    public function update(TeamSurveyUpdateRequest $request, TeamSurvey $teamSurvey, BuildTeamSurveySnapshot $buildTeamSurveySnapshot): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::editor($teamSurvey, $respondent);

        $fresh = DB::transaction(function () use ($request, $teamSurvey, $respondent): TeamSurvey {
            $locked = TeamSurvey::query()->whereKey($teamSurvey->id)->lockForUpdate()->firstOrFail();

            TeamSurveyGuard::editor($locked, $respondent);

            $locked->fill($request->validated());
            $locked->version++;
            $locked->save();

            TeamSurveyChanged::for($locked)->sendToOthers();

            return $locked;
        });

        return response()->json($buildTeamSurveySnapshot->handle($fresh, $respondent));
    }
```

`app/Http/Controllers/TeamSurveys/TeamSurveyQuestionsController.php`:

```php
<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\PresentSurveyQuestion;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Http\Controllers\Controller;
use App\Http\Requests\TeamSurveys\TeamSurveyQuestionRequest;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TeamSurveyQuestionsController extends Controller
{
    public function __construct(private PresentSurveyQuestion $presentSurveyQuestion) {}

    public function store(TeamSurveyQuestionRequest $request, TeamSurvey $teamSurvey): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::editor($teamSurvey, $respondent);

        $question = DB::transaction(function () use ($request, $teamSurvey, $respondent): TeamSurveyQuestion {
            $locked = $this->lock($teamSurvey, $respondent);

            if ($locked->questions()->count() >= TeamSurvey::MaxQuestions) {
                throw ValidationException::withMessages(['survey' => __('A survey can have at most 30 questions.')]);
            }

            $lastPosition = $locked->questions()->max('position');

            $question = $locked->questions()->create([
                ...$request->attributesForQuestion(),
                'match_key' => Str::random(16),
                'position' => $lastPosition === null ? 0 : (int) $lastPosition + 1,
            ]);

            $this->replaceOptions($question, $request->validated('options') ?? []);
            $this->announce($locked);

            return $question;
        });

        return response()->json(['question' => $this->presentSurveyQuestion->handle($question->fresh())], 201);
    }

    public function update(TeamSurveyQuestionRequest $request, TeamSurvey $teamSurvey, TeamSurveyQuestion $question): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::editor($teamSurvey, $respondent);

        $fresh = DB::transaction(function () use ($request, $teamSurvey, $question, $respondent): TeamSurveyQuestion {
            $locked = $this->lock($teamSurvey, $respondent);
            $fresh = $locked->questions()->whereKey($question->id)->firstOrFail();

            $fresh->update($request->attributesForQuestion());

            $this->replaceOptions($fresh, $request->validated('options') ?? []);
            $this->announce($locked);

            return $fresh;
        });

        return response()->json(['question' => $this->presentSurveyQuestion->handle($fresh->fresh())]);
    }

    public function destroy(Request $request, TeamSurvey $teamSurvey, TeamSurveyQuestion $question): Response
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::editor($teamSurvey, $respondent);

        DB::transaction(function () use ($teamSurvey, $question, $respondent): void {
            $locked = $this->lock($teamSurvey, $respondent);

            $locked->questions()->whereKey($question->id)->firstOrFail()->delete();

            foreach ($locked->questions()->get() as $position => $remaining) {
                $remaining->update(['position' => $position]);
            }

            $this->announce($locked);
        });

        return response()->noContent();
    }

    private function lock(TeamSurvey $survey, TeamSurveyRespondent $respondent): TeamSurvey
    {
        $locked = TeamSurvey::query()->whereKey($survey->id)->lockForUpdate()->firstOrFail();

        TeamSurveyGuard::editor($locked, $respondent);
        TeamSurveyGuard::structureEditable($locked);

        return $locked;
    }

    /**
     * @param  array<int, string>  $labels
     */
    private function replaceOptions(TeamSurveyQuestion $question, array $labels): void
    {
        $question->options()->delete();

        foreach (array_values($labels) as $position => $label) {
            $question->options()->create(['label' => $label, 'position' => $position]);
        }
    }

    private function announce(TeamSurvey $locked): void
    {
        $locked->increment('version');

        TeamSurveyChanged::for($locked)->sendToOthers();
    }
}
```

`app/Http/Controllers/TeamSurveys/TeamSurveyQuestionOrdersController.php`:

```php
<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Http\Controllers\Controller;
use App\Http\Requests\TeamSurveys\TeamSurveyQuestionOrderRequest;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TeamSurveyQuestionOrdersController extends Controller
{
    public function update(TeamSurveyQuestionOrderRequest $request, TeamSurvey $teamSurvey): Response
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::editor($teamSurvey, $respondent);

        /** @var array<int, string> $ids */
        $ids = $request->validated('ids');

        DB::transaction(function () use ($teamSurvey, $respondent, $ids): void {
            $locked = TeamSurvey::query()->whereKey($teamSurvey->id)->lockForUpdate()->firstOrFail();

            TeamSurveyGuard::editor($locked, $respondent);
            TeamSurveyGuard::structureEditable($locked);

            $known = $locked->questions()->pluck('id')->all();
            $sent = $ids;

            sort($known);
            sort($sent);

            if ($known !== $sent) {
                throw ValidationException::withMessages(['ids' => __('Send every question exactly once.')]);
            }

            foreach ($ids as $position => $id) {
                $locked->questions()->whereKey($id)->update(['position' => $position]);
            }

            $locked->increment('version');

            TeamSurveyChanged::for($locked)->sendToOthers();
        });

        return response()->noContent();
    }
}
```

`app/Http/Controllers/TeamSurveys/TeamSurveyQuestionDuplicatesController.php`:

```php
<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\PresentSurveyQuestion;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Http\Controllers\Controller;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyOption;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TeamSurveyQuestionDuplicatesController extends Controller
{
    public function store(Request $request, TeamSurvey $teamSurvey, TeamSurveyQuestion $question, PresentSurveyQuestion $presentSurveyQuestion): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::editor($teamSurvey, $respondent);

        $copy = DB::transaction(function () use ($teamSurvey, $question, $respondent): TeamSurveyQuestion {
            $locked = TeamSurvey::query()->whereKey($teamSurvey->id)->lockForUpdate()->firstOrFail();

            TeamSurveyGuard::editor($locked, $respondent);
            TeamSurveyGuard::structureEditable($locked);

            if ($locked->questions()->count() >= TeamSurvey::MaxQuestions) {
                throw ValidationException::withMessages(['survey' => __('A survey can have at most 30 questions.')]);
            }

            $source = $locked->questions()->with('options')->whereKey($question->id)->firstOrFail();

            foreach ($locked->questions()->where('position', '>', $source->position)->get() as $later) {
                $later->update(['position' => $later->position + 1]);
            }

            $copy = $source->replicate(['match_key']);
            $copy->match_key = Str::random(16);
            $copy->position = $source->position + 1;
            $copy->save();

            $source->options->each(fn (TeamSurveyOption $option) => $copy->options()->create([
                'label' => $option->label,
                'position' => $option->position,
            ]));

            $locked->increment('version');

            TeamSurveyChanged::for($locked)->sendToOthers();

            return $copy;
        });

        return response()->json(['question' => $presentSurveyQuestion->handle($copy->fresh())], 201);
    }
}
```

Routes, inside the survey group:

```php
        Route::patch('/', [TeamSurveysController::class, 'update'])->name('surveys.update');
        Route::post('questions', [TeamSurveyQuestionsController::class, 'store'])->name('surveys.questions.store');
        Route::patch('questions/{question}', [TeamSurveyQuestionsController::class, 'update'])->name('surveys.questions.update')->whereUuid('question');
        Route::delete('questions/{question}', [TeamSurveyQuestionsController::class, 'destroy'])->name('surveys.questions.destroy')->whereUuid('question');
        Route::put('question-order', [TeamSurveyQuestionOrdersController::class, 'update'])->name('surveys.questionOrder.update');
        Route::post('questions/{question}/duplicate', [TeamSurveyQuestionDuplicatesController::class, 'store'])->name('surveys.questions.duplicate.store')->whereUuid('question');
```

`{question}` resolves through `TeamSurvey::questions()` thanks to `scopeBindings()`, which is what makes the last test answer 404.

- [ ] **Step 5: Run the tests on the four engines**

Run, for each of `pgsql`, `mariadb`, `mysql`, `sqlite`: `bin/test-db <engine> -- tests/Feature/TeamSurveys/TeamSurveyBuilderTest.php tests/Arch`
Expected: PASS on each. Then, for each of `pgsql`, `mariadb`, `mysql`, `sqlite-file`: `bin/test-db <engine> --concurrency` — Expected: PASS on each (the question limit holds because `store` and `duplicate` count under the survey's lock).

- [ ] **Step 6: Commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app routes tests/Feature/TeamSurveys tests/Concurrency lang
git commit -m "feat(surveys): builder back end — settings, questions, order and duplicate"
```

### Task 8: Status — publish, back to draft, close, reopen

**Files:**
- Create: `app/Actions/TeamSurveys/ChangeTeamSurveyStatus.php`, `app/Http/Requests/TeamSurveys/TeamSurveyStatusRequest.php`, `app/Http/Controllers/TeamSurveys/TeamSurveyStatusesController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/TeamSurveys/TeamSurveyStatusTest.php`

**Interfaces:**
- Consumes: `TeamSurveyGuard::editor`, `TeamSurveyChanged::for`, `TeamSurvey::hasAnswers()`.
- Produces: `ChangeTeamSurveyStatus::handle(TeamSurvey $locked, TeamSurveyStatus $target): void` (runs inside the caller's transaction, on a locked row; bumps `version`, sends `TeamSurveyChanged`); route `surveys.status.update` (body `status`).

- [ ] **Step 1: Write the failing test**

`tests/Feature/TeamSurveys/TeamSurveyStatusTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Enums\TeamSurveyStatus;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Models\Retro;
use App\Models\TeamSurvey;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake([TeamSurveyChanged::class]);
});

function putStatus(TeamSurvey $survey, string $status, $user)
{
    return test()->actingAs($user)->putJson(route('surveys.status.update', $survey), ['status' => $status]);
}

it('publishes a draft that has a question', function () {
    $survey = TeamSurvey::factory()->create();
    [$facilitator] = surveyFacilitator($survey);
    surveyQuestion($survey);

    putStatus($survey, 'open', $facilitator)->assertNoContent();

    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Open)
        ->and($survey->fresh()->opened_at)->not->toBeNull()
        ->and($survey->fresh()->version)->toBe(2);
    Event::assertDispatched(fn (TeamSurveyChanged $event) => $event->status === 'open');
});

it('refuses to publish a survey without a question', function () {
    $survey = TeamSurvey::factory()->create();
    [$facilitator] = surveyFacilitator($survey);

    putStatus($survey, 'open', $facilitator)->assertUnprocessable()->assertJsonValidationErrors('status');
});

it('goes back to draft until the first answer, and not after', function () {
    $survey = TeamSurvey::factory()->open()->create();
    [$facilitator, $respondent] = surveyFacilitator($survey);
    $question = surveyQuestion($survey);

    putStatus($survey, 'draft', $facilitator)->assertNoContent();
    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Draft);

    putStatus($survey, 'open', $facilitator)->assertNoContent();
    answerSurveyQuestion($question, $respondent, 3);

    putStatus($survey, 'draft', $facilitator)->assertUnprocessable()->assertJsonValidationErrors('status');
});

it('closes and reopens', function () {
    $survey = TeamSurvey::factory()->open()->create();
    [$facilitator] = surveyFacilitator($survey);

    putStatus($survey, 'closed', $facilitator)->assertNoContent();
    expect($survey->fresh()->closed_at)->not->toBeNull();

    putStatus($survey, 'open', $facilitator)->assertNoContent();
    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Open)
        ->and($survey->fresh()->closed_at)->toBeNull();
});

it('refuses the changes that make no sense', function (string $from, string $to) {
    $survey = TeamSurvey::factory()->{$from}()->create();
    [$facilitator] = surveyFacilitator($survey);
    surveyQuestion($survey);

    putStatus($survey, $to, $facilitator)->assertUnprocessable()->assertJsonValidationErrors('status');
})->with([
    ['draft', 'closed'],
    ['draft', 'draft'],
    ['closed', 'draft'],
    ['closed', 'closed'],
    ['open', 'open'],
]);

it('does not reopen a survey attached to a completed retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create(['completed_at' => now()]);
    $survey = TeamSurvey::factory()->attachedTo($retro)->closed()->create();

    expect(fn () => DB::transaction(fn () => resolve(App\Actions\TeamSurveys\ChangeTeamSurveyStatus::class)->handle(
        TeamSurvey::query()->whereKey($survey->id)->lockForUpdate()->firstOrFail(),
        TeamSurveyStatus::Open,
    )))->toThrow(Illuminate\Validation\ValidationException::class);
});

it('refuses a member who is not an editor, and an unknown status', function () {
    $survey = TeamSurvey::factory()->open()->create();
    [$facilitator] = surveyFacilitator($survey);

    putStatus($survey, 'closed', teamMember($survey->team))->assertForbidden();
    putStatus($survey, 'archived', $facilitator)->assertUnprocessable()->assertJsonValidationErrors('status');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/TeamSurveyStatusTest.php`
Expected: FAIL, `Route [surveys.status.update] not defined`.

- [ ] **Step 3: Implementation**

`app/Actions/TeamSurveys/ChangeTeamSurveyStatus.php`:

```php
<?php

namespace App\Actions\TeamSurveys;

use App\Enums\RetroPhase;
use App\Enums\TeamSurveyStatus;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Models\TeamSurvey;
use Illuminate\Validation\ValidationException;

class ChangeTeamSurveyStatus
{
    /**
     * Runs inside the caller's transaction, on a survey row locked for update.
     */
    public function handle(TeamSurvey $locked, TeamSurveyStatus $target): void
    {
        $changes = match ([$locked->status, $target]) {
            [TeamSurveyStatus::Draft, TeamSurveyStatus::Open] => $this->publish($locked),
            [TeamSurveyStatus::Open, TeamSurveyStatus::Draft] => $this->backToDraft($locked),
            [TeamSurveyStatus::Open, TeamSurveyStatus::Closed] => ['closed_at' => now()],
            [TeamSurveyStatus::Closed, TeamSurveyStatus::Open] => $this->reopen($locked),
            default => throw ValidationException::withMessages(['status' => __('This change is not possible.')]),
        };

        $locked->fill([...$changes, 'status' => $target]);
        $locked->version++;
        $locked->save();

        TeamSurveyChanged::for($locked)->sendToOthers();
    }

    /**
     * @return array<string, mixed>
     */
    private function publish(TeamSurvey $locked): array
    {
        if (! $locked->questions()->exists()) {
            throw ValidationException::withMessages(['status' => __('Add a question before publishing.')]);
        }

        return ['opened_at' => $locked->opened_at ?? now()];
    }

    /**
     * @return array<string, mixed>
     */
    private function backToDraft(TeamSurvey $locked): array
    {
        if ($locked->hasAnswers()) {
            throw ValidationException::withMessages(['status' => __('This survey already has answers.')]);
        }

        return [];
    }

    /**
     * @return array<string, mixed>
     */
    private function reopen(TeamSurvey $locked): array
    {
        if ($locked->retro?->phase === RetroPhase::Completed) {
            throw ValidationException::withMessages(['status' => __('An attached health check cannot be reopened once its retro is completed.')]);
        }

        return ['closed_at' => null];
    }
}
```

`app/Http/Requests/TeamSurveys/TeamSurveyStatusRequest.php`:

```php
<?php

namespace App\Http\Requests\TeamSurveys;

use App\Enums\TeamSurveyStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TeamSurveyStatusRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::enum(TeamSurveyStatus::class)],
        ];
    }
}
```

`app/Http/Controllers/TeamSurveys/TeamSurveyStatusesController.php`:

```php
<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\ChangeTeamSurveyStatus;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Enums\TeamSurveyStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\TeamSurveys\TeamSurveyStatusRequest;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class TeamSurveyStatusesController extends Controller
{
    public function update(TeamSurveyStatusRequest $request, TeamSurvey $teamSurvey, ChangeTeamSurveyStatus $changeTeamSurveyStatus): Response
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::editor($teamSurvey, $respondent);

        $target = $request->enum('status', TeamSurveyStatus::class);

        DB::transaction(function () use ($teamSurvey, $respondent, $target, $changeTeamSurveyStatus): void {
            $locked = TeamSurvey::query()->whereKey($teamSurvey->id)->lockForUpdate()->firstOrFail();

            TeamSurveyGuard::editor($locked, $respondent);

            $changeTeamSurveyStatus->handle($locked, $target);
        });

        return response()->noContent();
    }
}
```

Route: `Route::put('status', [TeamSurveyStatusesController::class, 'update'])->name('surveys.status.update');`

- [ ] **Step 4: Run the tests on the four engines**

Run, for each of `pgsql`, `mariadb`, `mysql`, `sqlite`: `bin/test-db <engine> -- tests/Feature/TeamSurveys/TeamSurveyStatusTest.php`
Expected: PASS on each.

- [ ] **Step 5: Commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app routes tests/Feature/TeamSurveys lang
git commit -m "feat(surveys): publish, back to draft, close and reopen"
```

### Task 9: Answers and the response

**Files:**
- Create: `app/Actions/TeamSurveys/SaveSurveyAnswer.php`, `AnnounceSurveyResponses.php`, `PresentSurveyProgress.php`
- Create: `app/Http/Controllers/TeamSurveys/TeamSurveyAnswersController.php`, `TeamSurveySubmissionsController.php`
- Modify: `app/Actions/TeamSurveys/BuildTeamSurveySnapshot.php` (adds `questions`, `progress`), `routes/web.php`
- Test: `tests/Feature/TeamSurveys/TeamSurveyAnswersTest.php`

**Interfaces:**
- Consumes: `TeamSurveyGuard::open`, `PresentSurveyQuestion::handle`, `::answer`, `TeamSurveyResponsesChanged::for`.
- Produces: `SaveSurveyAnswer::rules(TeamSurveyQuestion $question): array<string, array<int, mixed>>`; `SaveSurveyAnswer::handle(TeamSurveyQuestion $question, TeamSurveyRespondent $respondent, array $validated): TeamSurveyAnswer`; `AnnounceSurveyResponses::handle(TeamSurvey $survey): void`; `PresentSurveyProgress::handle(TeamSurvey $survey): array{responses: int, completed: int, audience: int}`; routes `surveys.answers.update|destroy` (bodies `value`, `optionId`, `optionIds`, `text`, `comment`; answer `{answer, progress}`), `surveys.submission.store|destroy` (answer: the snapshot); snapshot keys `questions` (list of `PresentSurveyQuestion::handle`) and `progress`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/TeamSurveys/TeamSurveyAnswersTest.php`:

```php
<?php

use App\Enums\TeamSurveyQuestionKind;
use App\Events\TeamSurveys\TeamSurveyResponsesChanged;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake([TeamSurveyResponsesChanged::class]);
});

function openSurvey(array $attributes = []): array
{
    $survey = TeamSurvey::factory()->open()->create($attributes);
    [$user, $respondent] = surveyMember($survey);

    return [$survey, $user, $respondent];
}

it('saves an answer of each kind and returns it with the counts', function (TeamSurveyQuestionKind $kind, array $attributes, array $options, Closure $body, Closure $expected) {
    [$survey, $user] = openSurvey();
    $question = surveyQuestion($survey, $kind, $attributes, $options);
    $ids = $question->options()->pluck('id')->all();

    $this->actingAs($user)->putJson(route('surveys.answers.update', [$survey, $question]), $body($ids))
        ->assertOk()
        ->assertJsonPath('answer', $expected($ids))
        ->assertJsonPath('progress.responses', 1)
        ->assertJsonPath('progress.completed', 0);

    Event::assertDispatched(fn (TeamSurveyResponsesChanged $event) => $event->responses === 1);
})->with([
    'scale' => [TeamSurveyQuestionKind::Scale, ['allows_comment' => true], [], fn () => ['value' => 4, 'comment' => 'Fine'], fn () => ['value' => 4, 'optionIds' => [], 'text' => null, 'comment' => 'Fine']],
    'nps zero' => [TeamSurveyQuestionKind::Nps, [], [], fn () => ['value' => 0], fn () => ['value' => 0, 'optionIds' => [], 'text' => null, 'comment' => null]],
    'single' => [TeamSurveyQuestionKind::Single, [], ['A', 'B'], fn (array $ids) => ['optionId' => $ids[1]], fn (array $ids) => ['value' => null, 'optionIds' => [$ids[1]], 'text' => null, 'comment' => null]],
    'multiple' => [TeamSurveyQuestionKind::Multiple, [], ['A', 'B', 'C'], fn (array $ids) => ['optionIds' => [$ids[0], $ids[2]]], fn (array $ids) => ['value' => null, 'optionIds' => [$ids[0], $ids[2]], 'text' => null, 'comment' => null]],
    'text' => [TeamSurveyQuestionKind::Text, [], [], fn () => ['text' => 'Less meetings'], fn () => ['value' => null, 'optionIds' => [], 'text' => 'Less meetings', 'comment' => null]],
]);

it('refuses what does not belong to the kind', function (TeamSurveyQuestionKind $kind, array $attributes, array $options, Closure $body, string $field) {
    [$survey, $user] = openSurvey();
    $question = surveyQuestion($survey, $kind, $attributes, $options);
    $foreign = surveyQuestion($survey, TeamSurveyQuestionKind::Single, [], ['X', 'Y'])->options()->pluck('id')->all();

    $this->actingAs($user)->putJson(route('surveys.answers.update', [$survey, $question]), $body($foreign))
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);

    expect(TeamSurveyAnswer::query()->count())->toBe(0);
})->with([
    'scale above its maximum' => [TeamSurveyQuestionKind::Scale, [], [], fn () => ['value' => 6], 'value'],
    'scale at zero' => [TeamSurveyQuestionKind::Scale, [], [], fn () => ['value' => 0], 'value'],
    'health scale above ten' => [TeamSurveyQuestionKind::Scale, ['scale_max' => 10], [], fn () => ['value' => 11], 'value'],
    'nps above ten' => [TeamSurveyQuestionKind::Nps, [], [], fn () => ['value' => 11], 'value'],
    'comment where none is taken' => [TeamSurveyQuestionKind::Scale, [], [], fn () => ['value' => 3, 'comment' => 'x'], 'comment'],
    'option of another question' => [TeamSurveyQuestionKind::Single, [], ['A', 'B'], fn (array $foreign) => ['optionId' => $foreign[0]], 'optionId'],
    'no option ticked' => [TeamSurveyQuestionKind::Multiple, [], ['A', 'B'], fn () => ['optionIds' => []], 'optionIds'],
    'the same option twice' => [TeamSurveyQuestionKind::Multiple, [], ['A', 'B'], fn (array $foreign) => ['optionIds' => [$foreign[0], $foreign[0]]], 'optionIds.0'],
    'empty text' => [TeamSurveyQuestionKind::Text, [], [], fn () => ['text' => ''], 'text'],
    'text too long' => [TeamSurveyQuestionKind::Text, [], [], fn () => ['text' => str_repeat('a', 501)], 'text'],
    'a value on a text' => [TeamSurveyQuestionKind::Text, [], [], fn () => ['text' => 'ok', 'value' => 3], 'value'],
]);

it('keeps one answer when the same one is saved twice, and the last value wins', function () {
    [$survey, $user, $respondent] = openSurvey();
    $question = surveyQuestion($survey);

    $this->actingAs($user)->putJson(route('surveys.answers.update', [$survey, $question]), ['value' => 2])->assertOk();
    $this->actingAs($user)->putJson(route('surveys.answers.update', [$survey, $question]), ['value' => 5])->assertOk();

    expect($respondent->answers()->count())->toBe(1)
        ->and($respondent->answers()->sole()->value)->toBe(5);
});

it('replaces the ticked options of a multiple choice', function () {
    [$survey, $user, $respondent] = openSurvey();
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Multiple, [], ['A', 'B', 'C']);
    $ids = $question->options()->pluck('id')->all();

    $this->actingAs($user)->putJson(route('surveys.answers.update', [$survey, $question]), ['optionIds' => [$ids[0], $ids[1]]])->assertOk();
    $this->actingAs($user)->putJson(route('surveys.answers.update', [$survey, $question]), ['optionIds' => [$ids[2]]])->assertOk();

    expect($respondent->answers()->sole()->options()->pluck('team_survey_options.id')->all())->toBe([$ids[2]]);
});

it('withdraws an answer', function () {
    [$survey, $user, $respondent] = openSurvey();
    $question = surveyQuestion($survey);
    answerSurveyQuestion($question, $respondent, 3);

    $this->actingAs($user)->deleteJson(route('surveys.answers.destroy', [$survey, $question]))
        ->assertOk()
        ->assertJsonPath('answer', null)
        ->assertJsonPath('progress.responses', 0);
});

it('refuses answers on a draft and on a closed survey', function (string $state) {
    $survey = TeamSurvey::factory()->{$state}()->create();
    [$user] = surveyFacilitator($survey);
    $question = surveyQuestion($survey);

    $this->actingAs($user)->putJson(route('surveys.answers.update', [$survey, $question]), ['value' => 3])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('survey');
})->with(['draft', 'closed']);

it('lets a guest answer', function () {
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->create();
    $question = surveyQuestion($survey);
    $guest = surveyGuest($survey);

    $this->withCookies(surveyGuestCookie($guest))->withCredentials()
        ->putJson(route('surveys.answers.update', [$survey, $question]), ['value' => 5])
        ->assertOk();

    expect($guest->answers()->count())->toBe(1);
});

it('finishes a response when every required question is answered, and names the ones that are not', function () {
    [$survey, $user, $respondent] = openSurvey();
    $required = surveyQuestion($survey, TeamSurveyQuestionKind::Scale, ['is_required' => true]);
    $optional = surveyQuestion($survey, TeamSurveyQuestionKind::Text);
    answerSurveyQuestion($optional, $respondent, 'hello');

    $this->actingAs($user)->postJson(route('surveys.submission.store', $survey))
        ->assertUnprocessable()
        ->assertJsonValidationErrors("questions.{$required->id}");

    answerSurveyQuestion($required, $respondent, 4);

    $this->actingAs($user)->postJson(route('surveys.submission.store', $survey))
        ->assertOk()
        ->assertJsonPath('me.hasSubmitted', true)
        ->assertJsonPath('progress.completed', 1);

    expect($respondent->fresh()->completed_at)->not->toBeNull();
});

it('refuses to finish an empty response', function () {
    [$survey, $user] = openSurvey();
    surveyQuestion($survey);

    $this->actingAs($user)->postJson(route('surveys.submission.store', $survey))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('survey');
});

it('reopens one\'s own response while the survey is open', function () {
    [$survey, $user, $respondent] = openSurvey();
    $respondent->update(['completed_at' => now()]);

    $this->actingAs($user)->deleteJson(route('surveys.submission.destroy', $survey))
        ->assertOk()
        ->assertJsonPath('me.hasSubmitted', false);
});

it('sends each viewer their own answers in the snapshot, and nobody else\'s', function () {
    [$survey, $user, $respondent] = openSurvey();
    [$other, $otherRespondent] = surveyMember($survey);
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Text);
    answerSurveyQuestion($question, $respondent, 'mine');
    answerSurveyQuestion($question, $otherRespondent, 'theirs');

    $snapshot = $this->actingAs($user)->getJson(route('surveys.snapshot.show', $survey))->assertOk();

    $snapshot->assertJsonPath('questions.0.myAnswer.text', 'mine')
        ->assertJsonPath('progress.responses', 2)
        ->assertJsonPath('progress.audience', 2);

    expect($snapshot->getContent())->not->toContain('theirs');
});
```

`progress.audience` is 2: the team has the two members the test made, and no respondent outside it (Task 1, the owner's participation rule).

`tests/Concurrency/SurveyAnswersTest.php` — the two races of the Review Focus, with real connections:

```php
<?php

use App\Enums\TeamSurveyStatus;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use Tests\Concurrency\Support\Race;

it('keeps one answer when the same answer is saved twice at once', function () {
    $survey = TeamSurvey::factory()->open()->create();
    $question = surveyQuestion($survey);
    [$user, $respondent] = surveyMember($survey);
    $userId = $user->id;
    $uri = route('surveys.answers.update', [$survey, $question], false);

    $outcomes = Race::run([
        static fn (): int => Race::request($userId, 'PUT', $uri, ['value' => 2]),
        static fn (): int => Race::request($userId, 'PUT', $uri, ['value' => 5]),
    ]);

    expect(array_column($outcomes, 'value'))->each->toBe(200)
        ->and(TeamSurveyAnswer::query()->where('team_survey_respondent_id', $respondent->id)->count())->toBe(1)
        ->and(TeamSurveyAnswer::query()->where('team_survey_respondent_id', $respondent->id)->sole()->value)->toBeIn([2, 5]);
});

it('saves an answer that arrives while the survey closes either before the close or not at all', function () {
    $survey = TeamSurvey::factory()->open()->create();
    [$facilitator] = surveyFacilitator($survey);
    $question = surveyQuestion($survey);
    $members = collect(range(1, 4))->map(fn (): string => surveyMember($survey)[0]->id)->all();
    $closer = $facilitator->id;
    $closeUri = route('surveys.status.update', $survey, false);
    $answerUri = route('surveys.answers.update', [$survey, $question], false);

    $contenders = ['close' => static fn (): int => Race::request($closer, 'PUT', $closeUri, ['status' => 'closed'])];

    foreach ($members as $index => $memberId) {
        $contenders["answer{$index}"] = static fn (): int => Race::request($memberId, 'PUT', $answerUri, ['value' => 3]);
    }

    $outcomes = Race::run($contenders);
    $saved = collect($outcomes)->except('close')->filter(fn (array $outcome): bool => $outcome['value'] === 200)->count();
    $refused = collect($outcomes)->except('close')->filter(fn (array $outcome): bool => $outcome['value'] === 422)->count();
    $survey->refresh();

    expect($outcomes['close']['value'])->toBe(204)
        ->and($survey->status)->toBe(TeamSurveyStatus::Closed)
        ->and($saved + $refused)->toBe(4)
        ->and($question->answers()->count())->toBe($saved)
        ->and($question->answers()->where('created_at', '>', $survey->closed_at)->count())->toBe(0);
});
```

Each case states its protection: the survey row is locked first by the answer and the status controllers, so two saves of one answer run one after the other (one row), and an answer either commits before the close or reads the closed status under the lock and is refused. Without the lock, the second case can store an answer stamped after `closed_at`.

- [ ] **Step 2: Run it and see it fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/TeamSurveyAnswersTest.php`
Expected: FAIL, `Route [surveys.answers.update] not defined`.

- [ ] **Step 3: Actions**

`app/Actions/TeamSurveys/SaveSurveyAnswer.php`:

```php
<?php

namespace App\Actions\TeamSurveys;

use App\Enums\TeamSurveyQuestionKind;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use Illuminate\Validation\Rule;

class SaveSurveyAnswer
{
    /**
     * A field that does not belong to the kind is prohibited, so that a
     * client built for another kind fails loudly instead of saving nothing.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(TeamSurveyQuestion $question): array
    {
        $optionOfThisQuestion = Rule::exists('team_survey_options', 'id')->where('team_survey_question_id', $question->id);
        $comment = $question->allows_comment ? ['nullable', 'string', 'max:500'] : ['prohibited'];

        return match ($question->kind) {
            TeamSurveyQuestionKind::Scale => [
                'value' => ['required', 'integer', 'min:1', 'max:'.(int) $question->scale_max],
                'comment' => $comment,
                'optionId' => ['prohibited'],
                'optionIds' => ['prohibited'],
                'text' => ['prohibited'],
            ],
            TeamSurveyQuestionKind::Nps => [
                'value' => ['required', 'integer', 'min:0', 'max:10'],
                'comment' => $comment,
                'optionId' => ['prohibited'],
                'optionIds' => ['prohibited'],
                'text' => ['prohibited'],
            ],
            TeamSurveyQuestionKind::Single => [
                'optionId' => ['required', 'uuid', $optionOfThisQuestion],
                'value' => ['prohibited'],
                'optionIds' => ['prohibited'],
                'text' => ['prohibited'],
                'comment' => ['prohibited'],
            ],
            TeamSurveyQuestionKind::Multiple => [
                'optionIds' => ['required', 'array', 'min:1'],
                'optionIds.*' => ['uuid', 'distinct', $optionOfThisQuestion],
                'value' => ['prohibited'],
                'optionId' => ['prohibited'],
                'text' => ['prohibited'],
                'comment' => ['prohibited'],
            ],
            TeamSurveyQuestionKind::Text => [
                'text' => ['required', 'string', 'max:500'],
                'value' => ['prohibited'],
                'optionId' => ['prohibited'],
                'optionIds' => ['prohibited'],
                'comment' => ['prohibited'],
            ],
        };
    }

    /**
     * Runs inside the caller's transaction, after the survey row is locked.
     *
     * @param  array<string, mixed>  $validated
     */
    public function handle(TeamSurveyQuestion $question, TeamSurveyRespondent $respondent, array $validated): TeamSurveyAnswer
    {
        $answer = TeamSurveyAnswer::query()->updateOrCreate(
            ['team_survey_question_id' => $question->id, 'team_survey_respondent_id' => $respondent->id],
            [
                'value' => $validated['value'] ?? null,
                'text' => $validated['text'] ?? null,
                'comment' => $validated['comment'] ?? null,
            ],
        );

        $answer->options()->sync($this->optionIds($question, $validated));

        return $answer->load('options');
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<int, string>
     */
    private function optionIds(TeamSurveyQuestion $question, array $validated): array
    {
        return match ($question->kind) {
            TeamSurveyQuestionKind::Single => [(string) $validated['optionId']],
            TeamSurveyQuestionKind::Multiple => array_values($validated['optionIds']),
            default => [],
        };
    }
}
```

The `min:1` on a scale must not reject the integer `0` of an NPS, which has its own rule; the two datasets "scale at zero" and "nps zero" pin both.

`app/Actions/TeamSurveys/PresentSurveyProgress.php`:

```php
<?php

namespace App\Actions\TeamSurveys;

use App\Models\TeamSurvey;

class PresentSurveyProgress
{
    /**
     * @return array{responses: int, completed: int, audience: int}
     */
    public function handle(TeamSurvey $survey): array
    {
        return [
            'responses' => $survey->responseCount(),
            'completed' => $survey->completedCount(),
            'audience' => $survey->audienceCount(),
        ];
    }
}
```

`app/Actions/TeamSurveys/AnnounceSurveyResponses.php`:

```php
<?php

namespace App\Actions\TeamSurveys;

use App\Events\TeamSurveys\TeamSurveyResponsesChanged;
use App\Models\TeamSurvey;

class AnnounceSurveyResponses
{
    public function handle(TeamSurvey $survey): void
    {
        TeamSurveyResponsesChanged::for($survey)->sendToOthers();
    }
}
```

- [ ] **Step 4: Snapshot, controllers, routes**

`BuildTeamSurveySnapshot` gains the constructor `public function __construct(private PresentSurveyQuestion $presentSurveyQuestion, private PresentSurveyProgress $presentSurveyProgress) {}` and, in the returned array after `me`:

```php
            'questions' => $this->questions($survey, $viewer),
            'progress' => $this->presentSurveyProgress->handle($survey),
```

with:

```php
    /**
     * @return array<int, array<string, mixed>>
     */
    private function questions(TeamSurvey $survey, TeamSurveyRespondent $viewer): array
    {
        $questions = $survey->questions()->with('options')->get();

        $myAnswers = TeamSurveyAnswer::query()
            ->where('team_survey_respondent_id', $viewer->id)
            ->whereIn('team_survey_question_id', $questions->pluck('id'))
            ->with('options')
            ->get()
            ->keyBy('team_survey_question_id');

        return $questions
            ->map(fn (TeamSurveyQuestion $question): array => $this->presentSurveyQuestion->handle($question, $myAnswers->get($question->id)))
            ->values()
            ->all();
    }
```

`app/Http/Controllers/TeamSurveys/TeamSurveyAnswersController.php`:

```php
<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\AnnounceSurveyResponses;
use App\Actions\TeamSurveys\PresentSurveyProgress;
use App\Actions\TeamSurveys\PresentSurveyQuestion;
use App\Actions\TeamSurveys\SaveSurveyAnswer;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Http\Controllers\Controller;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class TeamSurveyAnswersController extends Controller
{
    public function __construct(
        private SaveSurveyAnswer $saveSurveyAnswer,
        private AnnounceSurveyResponses $announceSurveyResponses,
        private PresentSurveyQuestion $presentSurveyQuestion,
        private PresentSurveyProgress $presentSurveyProgress,
    ) {}

    public function update(Request $request, TeamSurvey $teamSurvey, TeamSurveyQuestion $question): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::open($teamSurvey);

        $answer = DB::transaction(function () use ($request, $teamSurvey, $question, $respondent): TeamSurveyAnswer {
            [$locked, $fresh] = $this->lock($teamSurvey, $question);

            $validated = Validator::make($request->all(), $this->saveSurveyAnswer->rules($fresh))->validate();

            $answer = $this->saveSurveyAnswer->handle($fresh, $respondent, $validated);

            $this->announceSurveyResponses->handle($locked);

            return $answer;
        });

        return response()->json([
            'answer' => $this->presentSurveyQuestion->answer($answer),
            'progress' => $this->presentSurveyProgress->handle($teamSurvey),
        ]);
    }

    public function destroy(Request $request, TeamSurvey $teamSurvey, TeamSurveyQuestion $question): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::open($teamSurvey);

        DB::transaction(function () use ($teamSurvey, $question, $respondent): void {
            [$locked, $fresh] = $this->lock($teamSurvey, $question);

            $fresh->answers()->where('team_survey_respondent_id', $respondent->id)->delete();

            $this->announceSurveyResponses->handle($locked);
        });

        return response()->json(['answer' => null, 'progress' => $this->presentSurveyProgress->handle($teamSurvey)]);
    }

    /**
     * The answer is validated against the question read under the survey's
     * lock, so a concurrent edit cannot slip a mismatched answer in, and two
     * saves of the same answer run one after the other.
     *
     * @return array{0: TeamSurvey, 1: TeamSurveyQuestion}
     */
    private function lock(TeamSurvey $survey, TeamSurveyQuestion $question): array
    {
        $locked = TeamSurvey::query()->whereKey($survey->id)->lockForUpdate()->firstOrFail();

        TeamSurveyGuard::open($locked);

        return [$locked, $locked->questions()->whereKey($question->id)->firstOrFail()];
    }
}
```

`app/Http/Controllers/TeamSurveys/TeamSurveySubmissionsController.php`:

```php
<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\AnnounceSurveyResponses;
use App\Actions\TeamSurveys\BuildTeamSurveySnapshot;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Http\Controllers\Controller;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TeamSurveySubmissionsController extends Controller
{
    public function __construct(
        private AnnounceSurveyResponses $announceSurveyResponses,
        private BuildTeamSurveySnapshot $buildTeamSurveySnapshot,
    ) {}

    public function store(Request $request, TeamSurvey $teamSurvey): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::open($teamSurvey);

        $locked = DB::transaction(function () use ($teamSurvey, $respondent): TeamSurvey {
            $locked = TeamSurvey::query()->whereKey($teamSurvey->id)->lockForUpdate()->firstOrFail();

            TeamSurveyGuard::open($locked);

            $this->ensureComplete($locked, $respondent);

            $respondent->update(['completed_at' => now()]);

            $this->announceSurveyResponses->handle($locked);

            return $locked;
        });

        return response()->json($this->buildTeamSurveySnapshot->handle($locked, $respondent->fresh()));
    }

    public function destroy(Request $request, TeamSurvey $teamSurvey): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::open($teamSurvey);

        $locked = DB::transaction(function () use ($teamSurvey, $respondent): TeamSurvey {
            $locked = TeamSurvey::query()->whereKey($teamSurvey->id)->lockForUpdate()->firstOrFail();

            TeamSurveyGuard::open($locked);

            $respondent->update(['completed_at' => null]);

            $this->announceSurveyResponses->handle($locked);

            return $locked;
        });

        return response()->json($this->buildTeamSurveySnapshot->handle($locked, $respondent->fresh()));
    }

    private function ensureComplete(TeamSurvey $survey, TeamSurveyRespondent $respondent): void
    {
        if (! $respondent->answers()->exists()) {
            throw ValidationException::withMessages(['survey' => __('Answer at least one question before finishing.')]);
        }

        $missing = $survey->questions()
            ->where('is_required', true)
            ->whereDoesntHave('answers', fn (Builder $answers) => $answers->where('team_survey_respondent_id', $respondent->id))
            ->pluck('id');

        if ($missing->isEmpty()) {
            return;
        }

        throw ValidationException::withMessages(
            $missing->mapWithKeys(fn (string $id): array => ["questions.{$id}" => __('An answer is required.')])->all(),
        );
    }
}
```

Routes:

```php
        Route::put('questions/{question}/answer', [TeamSurveyAnswersController::class, 'update'])->name('surveys.answers.update')->whereUuid('question');
        Route::delete('questions/{question}/answer', [TeamSurveyAnswersController::class, 'destroy'])->name('surveys.answers.destroy')->whereUuid('question');
        Route::post('submission', [TeamSurveySubmissionsController::class, 'store'])->name('surveys.submission.store');
        Route::delete('submission', [TeamSurveySubmissionsController::class, 'destroy'])->name('surveys.submission.destroy');
```

- [ ] **Step 5: Run the tests on the four engines**

Run, for each of `pgsql`, `mariadb`, `mysql`, `sqlite`: `bin/test-db <engine> -- tests/Feature/TeamSurveys/TeamSurveyAnswersTest.php tests/Feature/TeamSurveys/TeamSurveyAccessTest.php tests/Feature/TeamSurveys/TeamSurveyBuilderTest.php`
Expected: PASS on each. Then, for each of `pgsql`, `mariadb`, `mysql`, `sqlite-file`: `bin/test-db <engine> --concurrency` — Expected: PASS on each.

- [ ] **Step 6: Commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app routes tests/Feature/TeamSurveys tests/Concurrency lang
git commit -m "feat(surveys): answers per question, finishing and reopening a response"
```

### Task 10: Results, withheld per viewer

**Files:**
- Create: `app/Actions/TeamSurveys/SummarizeSurveyQuestion.php`, `BuildSurveyResults.php`
- Modify: `app/Actions/TeamSurveys/BuildTeamSurveySnapshot.php` (adds `results`), `app/Http/Controllers/TeamSurveys/TeamSurveyResultsController.php` (body)
- Test: `tests/Feature/TeamSurveys/SummarizeSurveyQuestionTest.php`, `tests/Feature/TeamSurveys/TeamSurveyResultsTest.php`

**Interfaces:**
- Consumes: `TeamSurvey::resultsVisibleTo`, `::responseCount`, the models.
- Produces: `SummarizeSurveyQuestion::handle(TeamSurveyQuestion $question, Collection $answers, ?TeamSurveyRespondent $viewer = null): array` — always `responses: int`; scale: `mean: ?float`, `mode: ?int`, `buckets: array<int, array{key: string, label: string, count: int}>`, `comments`; NPS: `nps: ?int`, `detractors`, `passives`, `promoters`, `buckets`, `comments`; choices: `options: array<int, array{id: string, label: string, count: int}>`; text: `answers: array<int, array{id: string, text: string, isMine: bool}>`; `comments` has the shape of `answers`. `BuildSurveyResults::handle(TeamSurvey $survey, TeamSurveyRespondent $viewer): ?array{belowThreshold: bool, responses: int, questions: array<string, array<string, mixed>>}`. Snapshot key `results`. Page `surveys/results` with the prop `snapshot`.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/TeamSurveys/SummarizeSurveyQuestionTest.php`:

```php
<?php

use App\Actions\TeamSurveys\SummarizeSurveyQuestion;
use App\Enums\TeamSurveyQuestionKind;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;

/**
 * @param  array<int, int|string|array<int, int>>  $answers  one per respondent
 * @return array<string, mixed>
 */
function summarized(TeamSurveyQuestion $question, array $answers, ?TeamSurveyRespondent $viewer = null): array
{
    foreach ($answers as $answer) {
        [, $respondent] = surveyMember($question->survey);
        answerSurveyQuestion($question, $respondent, $answer);
    }

    return resolve(SummarizeSurveyQuestion::class)->handle($question, $question->answers()->with('options')->get(), $viewer);
}

it('gives a scale its mean, its most frequent value and one bucket per value', function () {
    $question = surveyQuestion(TeamSurvey::factory()->open()->create());

    $summary = summarized($question, [2, 3, 3, 4, 4, 4, 5, 5, 4]);

    expect($summary['responses'])->toBe(9)
        ->and($summary['mean'])->toBe(3.8)
        ->and($summary['mode'])->toBe(4)
        ->and(array_column($summary['buckets'], 'count'))->toBe([0, 1, 2, 4, 2])
        ->and(array_column($summary['buckets'], 'key'))->toBe(['1', '2', '3', '4', '5']);
});

it('gives a scale of ten its ten buckets', function () {
    $question = surveyQuestion(TeamSurvey::factory()->open()->create(), TeamSurveyQuestionKind::Scale, ['scale_max' => 10]);

    $summary = summarized($question, [8, 6]);

    expect($summary['mean'])->toBe(7.0)
        ->and($summary['buckets'])->toHaveCount(10);
});

it('gives an unanswered scale no mean and no most frequent value', function () {
    $summary = summarized(surveyQuestion(TeamSurvey::factory()->open()->create()), []);

    expect($summary)->toMatchArray(['responses' => 0, 'mean' => null, 'mode' => null]);
});

it('computes the NPS score from detractors and promoters', function () {
    $question = surveyQuestion(TeamSurvey::factory()->open()->create(), TeamSurveyQuestionKind::Nps);

    $summary = summarized($question, [5, 6, 7, 8, 8, 9, 9, 10, 10]);

    expect($summary)->toMatchArray(['responses' => 9, 'detractors' => 2, 'passives' => 3, 'promoters' => 4, 'nps' => 22])
        ->and($summary['buckets'])->toHaveCount(11)
        ->and($summary['buckets'][0])->toBe(['key' => '0', 'label' => '0', 'count' => 0]);
});

it('gives a negative score when detractors outnumber promoters', function () {
    $question = surveyQuestion(TeamSurvey::factory()->open()->create(), TeamSurveyQuestionKind::Nps);

    expect(summarized($question, [0, 3, 10])['nps'])->toBe(-33);
});

it('counts each option, in the question\'s order', function () {
    $question = surveyQuestion(TeamSurvey::factory()->open()->create(), TeamSurveyQuestionKind::Multiple, [], ['Meetings', 'Specs', 'Tests']);

    $summary = summarized($question, [[0, 1], [0], [0, 2]]);

    expect($summary['responses'])->toBe(3)
        ->and(array_column($summary['options'], 'label'))->toBe(['Meetings', 'Specs', 'Tests'])
        ->and(array_column($summary['options'], 'count'))->toBe([3, 1, 1]);
});

it('sorts text answers by text, marks the viewer\'s own and names nobody', function () {
    $survey = TeamSurvey::factory()->open()->create();
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Text);
    [, $viewer] = surveyMember($survey);
    answerSurveyQuestion($question, $viewer, 'zebra');

    $summary = summarized($question, ['Apple', 'mango'], $viewer);

    expect(array_column($summary['answers'], 'text'))->toBe(['Apple', 'mango', 'zebra'])
        ->and(array_column($summary['answers'], 'isMine'))->toBe([false, false, true])
        ->and(array_keys($summary['answers'][0]))->toBe(['id', 'text', 'isMine']);
});

it('lists comments without the score they came with', function () {
    $survey = TeamSurvey::factory()->open()->create();
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Nps, ['allows_comment' => true]);
    [, $respondent] = surveyMember($survey);
    answerSurveyQuestion($question, $respondent, 8, 'Friday releases stress me');

    $summary = resolve(SummarizeSurveyQuestion::class)->handle($question, $question->answers()->get());

    expect($summary['comments'])->toHaveCount(1)
        ->and(array_keys($summary['comments'][0]))->toBe(['id', 'text', 'isMine'])
        ->and($summary['comments'][0]['text'])->toBe('Friday releases stress me');
});
```

`tests/Feature/TeamSurveys/TeamSurveyResultsTest.php`:

```php
<?php

use App\Enums\TeamSurveyQuestionKind;
use App\Models\TeamSurvey;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * A survey with one text question answered by three members, so that a
 * leak shows as a recognisable sentence in the payload.
 *
 * @return array{survey: TeamSurvey, facilitator: App\Models\User, finished: App\Models\User, unfinished: App\Models\User, bystander: App\Models\User}
 */
function answeredSurvey(string $state, array $attributes = []): array
{
    $survey = TeamSurvey::factory()->{$state}()->create($attributes);
    [$facilitator, $facilitatorRespondent] = surveyFacilitator($survey);
    [$finished, $finishedRespondent] = surveyMember($survey);
    [$unfinished, $unfinishedRespondent] = surveyMember($survey);
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Text);

    answerSurveyQuestion($question, $facilitatorRespondent, 'SECRET-ONE');
    answerSurveyQuestion($question, $finishedRespondent, 'SECRET-TWO');
    answerSurveyQuestion($question, $unfinishedRespondent, 'SECRET-THREE');
    $finishedRespondent->update(['completed_at' => now()]);

    return [
        'survey' => $survey,
        'facilitator' => $facilitator,
        'finished' => $finished,
        'unfinished' => $unfinished,
        'bystander' => teamMember($survey->team),
    ];
}

it('sends results to who may see them and to nobody else', function (string $state, array $attributes, string $viewer, bool $sees) {
    $fixture = answeredSurvey($state, $attributes);

    $response = $this->actingAs($fixture[$viewer])->getJson(route('surveys.snapshot.show', $fixture['survey']))->assertOk();
    $body = $response->getContent();
    $othersAnswers = substr_count($body, 'SECRET-');

    $response->assertJsonPath('me.canSeeResults', $sees)
        ->assertJsonPath('progress.responses', 3);

    if ($sees) {
        $response->assertJsonPath('results.belowThreshold', false);
        expect($othersAnswers)->toBeGreaterThanOrEqual(3);

        return;
    }

    $response->assertJsonPath('results', null);
    expect($othersAnswers)->toBeLessThanOrEqual(1);
})->with([
    'open: editor' => ['open', [], 'facilitator', true],
    'open: finished respondent' => ['open', [], 'finished', true],
    'open: unfinished respondent' => ['open', [], 'unfinished', false],
    'open: member who did not answer' => ['open', [], 'bystander', false],
    'open, setting off: finished respondent' => ['open', ['show_results_after_answer' => false], 'finished', false],
    'open, setting off: editor' => ['open', ['show_results_after_answer' => false], 'facilitator', true],
    'closed: unfinished respondent' => ['closed', [], 'unfinished', true],
    'closed: member who did not answer' => ['closed', [], 'bystander', true],
]);

it('withholds aggregates from everyone below the threshold, and gives the count', function () {
    $survey = TeamSurvey::factory()->closed()->create();
    [$facilitator, $respondent] = surveyFacilitator($survey);
    $question = surveyQuestion($survey);
    answerSurveyQuestion($question, $respondent, 4);
    [, $second] = surveyMember($survey);
    answerSurveyQuestion($question, $second, 2);

    $this->actingAs($facilitator)->getJson(route('surveys.snapshot.show', $survey))
        ->assertJsonPath('results.belowThreshold', true)
        ->assertJsonPath('results.responses', 2)
        ->assertJsonPath('results.questions', []);

    [, $third] = surveyMember($survey);
    answerSurveyQuestion($question, $third, 3);

    $this->actingAs($facilitator)->getJson(route('surveys.snapshot.show', $survey))
        ->assertJsonPath('results.belowThreshold', false)
        ->assertJsonPath("results.questions.{$question->id}.mean", 3.0);
});

it('shows results from the first answer when the survey has no threshold', function () {
    $survey = TeamSurvey::factory()->closed()->withoutThreshold()->create();
    [$facilitator, $respondent] = surveyFacilitator($survey);
    $question = surveyQuestion($survey);
    answerSurveyQuestion($question, $respondent, 4);

    $this->actingAs($facilitator)->getJson(route('surveys.snapshot.show', $survey))
        ->assertJsonPath("results.questions.{$question->id}.responses", 1);
});

it('lets a guest see results as a respondent does', function () {
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->withoutThreshold()->create();
    $question = surveyQuestion($survey);
    $guest = surveyGuest($survey);
    answerSurveyQuestion($question, $guest, 5);

    $this->withCookies(surveyGuestCookie($guest))->withCredentials()
        ->getJson(route('surveys.snapshot.show', $survey))
        ->assertJsonPath('results', null);

    $guest->update(['completed_at' => now()]);

    $this->withCookies(surveyGuestCookie($guest))->withCredentials()
        ->getJson(route('surveys.snapshot.show', $survey))
        ->assertJsonPath("results.questions.{$question->id}.mean", 5.0);
});

it('renders the results page for a member and keeps the same withholding in its props', function () {
    $fixture = answeredSurvey('open');

    $this->actingAs($fixture['bystander'])->get(route('surveys.results.show', $fixture['survey']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('surveys/results')
            ->where('snapshot.results', null)
            ->where('snapshot.progress.responses', 3));
});

it('sends an editor from the results of a draft to the builder, and refuses the others', function () {
    $survey = TeamSurvey::factory()->create();
    [$facilitator] = surveyFacilitator($survey);

    $this->actingAs($facilitator)->get(route('surveys.results.show', $survey))->assertRedirect(route('surveys.edit', $survey));
    $this->actingAs(teamMember($survey->team))->get(route('surveys.results.show', $survey))->assertForbidden();
});
```

In the first test the viewer's own sentence may appear once in `questions[].myAnswer`; that is why "does not see" allows one `SECRET-` and "sees" expects at least three.

- [ ] **Step 2: Run them and see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/SummarizeSurveyQuestionTest.php tests/Feature/TeamSurveys/TeamSurveyResultsTest.php`
Expected: FAIL, `Class "App\Actions\TeamSurveys\SummarizeSurveyQuestion" not found`.

- [ ] **Step 3: Summaries**

`app/Actions/TeamSurveys/SummarizeSurveyQuestion.php`:

```php
<?php

namespace App\Actions\TeamSurveys;

use App\Enums\TeamSurveyQuestionKind;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyOption;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use App\Support\Alphabetical;
use Illuminate\Support\Collection;

class SummarizeSurveyQuestion
{
    private const int NpsMax = 10;

    private const int FirstPassive = 7;

    private const int FirstPromoter = 9;

    /**
     * Aggregates are computed in PHP: a survey holds a few dozen answers per
     * question, and no SQL expression has to be portable.
     *
     * @param  Collection<int, TeamSurveyAnswer>  $answers  the answers to this question, with their options
     * @return array<string, mixed>
     */
    public function handle(TeamSurveyQuestion $question, Collection $answers, ?TeamSurveyRespondent $viewer = null): array
    {
        $summary = ['responses' => $answers->count()];

        return match ($question->kind) {
            TeamSurveyQuestionKind::Scale => [...$summary, ...$this->scale($question, $answers), 'comments' => $this->comments($answers, $viewer)],
            TeamSurveyQuestionKind::Nps => [...$summary, ...$this->nps($answers), 'comments' => $this->comments($answers, $viewer)],
            TeamSurveyQuestionKind::Single, TeamSurveyQuestionKind::Multiple => [...$summary, 'options' => $this->options($question, $answers)],
            TeamSurveyQuestionKind::Text => [...$summary, 'answers' => $this->texts($answers, $viewer)],
        };
    }

    /**
     * @param  Collection<int, TeamSurveyAnswer>  $answers
     * @return array{mean: ?float, mode: ?int, buckets: array<int, array{key: string, label: string, count: int}>}
     */
    private function scale(TeamSurveyQuestion $question, Collection $answers): array
    {
        $buckets = $this->buckets($answers, 1, (int) $question->scale_max);
        $values = $answers->pluck('value')->filter(fn (?int $value): bool => $value !== null);

        return [
            'mean' => $values->isEmpty() ? null : round($values->sum() / $values->count(), 1),
            'mode' => $this->mode($buckets),
            'buckets' => $buckets,
        ];
    }

    /**
     * @param  Collection<int, TeamSurveyAnswer>  $answers
     * @return array{nps: ?int, detractors: int, passives: int, promoters: int, buckets: array<int, array{key: string, label: string, count: int}>}
     */
    private function nps(Collection $answers): array
    {
        $values = $answers->pluck('value')->filter(fn (?int $value): bool => $value !== null);
        $detractors = $values->filter(fn (int $value): bool => $value < self::FirstPassive)->count();
        $promoters = $values->filter(fn (int $value): bool => $value >= self::FirstPromoter)->count();

        return [
            'nps' => $values->isEmpty() ? null : (int) round(($promoters - $detractors) / $values->count() * 100),
            'detractors' => $detractors,
            'passives' => $values->count() - $detractors - $promoters,
            'promoters' => $promoters,
            'buckets' => $this->buckets($answers, 0, self::NpsMax),
        ];
    }

    /**
     * @param  Collection<int, TeamSurveyAnswer>  $answers
     * @return array<int, array{key: string, label: string, count: int}>
     */
    private function buckets(Collection $answers, int $from, int $to): array
    {
        $counts = $answers->countBy(fn (TeamSurveyAnswer $answer): string => (string) $answer->value);

        return array_map(fn (int $value): array => [
            'key' => (string) $value,
            'label' => (string) $value,
            'count' => (int) $counts->get((string) $value, 0),
        ], range($from, $to));
    }

    /**
     * The lowest of the most frequent values, so that a tie reads the same every time.
     *
     * @param  array<int, array{key: string, label: string, count: int}>  $buckets
     */
    private function mode(array $buckets): ?int
    {
        $highest = max(array_column($buckets, 'count'));

        if ($highest === 0) {
            return null;
        }

        foreach ($buckets as $bucket) {
            if ($bucket['count'] === $highest) {
                return (int) $bucket['key'];
            }
        }

        return null;
    }

    /**
     * @param  Collection<int, TeamSurveyAnswer>  $answers
     * @return array<int, array{id: string, label: string, count: int}>
     */
    private function options(TeamSurveyQuestion $question, Collection $answers): array
    {
        $counts = $answers->flatMap(fn (TeamSurveyAnswer $answer) => $answer->options->pluck('id'))->countBy();

        return $question->options->map(fn (TeamSurveyOption $option): array => [
            'id' => $option->id,
            'label' => $option->label,
            'count' => (int) $counts->get($option->id, 0),
        ])->values()->all();
    }

    /**
     * Ordered by text (`Alphabetical`, the same on the four engines, docs/database.md rule 7) so the order
     * tells neither when nor by whom an answer was written; equal texts keep the order of their random ids.
     *
     * @param  Collection<int, TeamSurveyAnswer>  $answers
     * @return array<int, array{id: string, text: string, isMine: bool}>
     */
    private function texts(Collection $answers, ?TeamSurveyRespondent $viewer): array
    {
        return $this->sortedTexts($answers, 'text', $viewer);
    }

    /**
     * @param  Collection<int, TeamSurveyAnswer>  $answers
     * @return array<int, array{id: string, text: string, isMine: bool}>
     */
    private function comments(Collection $answers, ?TeamSurveyRespondent $viewer): array
    {
        return $this->sortedTexts($answers, 'comment', $viewer);
    }

    /**
     * @param  Collection<int, TeamSurveyAnswer>  $answers
     * @return array<int, array{id: string, text: string, isMine: bool}>
     */
    private function sortedTexts(Collection $answers, string $attribute, ?TeamSurveyRespondent $viewer): array
    {
        $filled = $answers
            ->filter(fn (TeamSurveyAnswer $answer): bool => trim((string) $answer->{$attribute}) !== '')
            ->sortBy('id')
            ->values();

        return Alphabetical::sort($filled, fn (TeamSurveyAnswer $answer): string => (string) $answer->{$attribute})
            ->map(fn (TeamSurveyAnswer $answer): array => [
                'id' => $answer->id,
                'text' => (string) $answer->{$attribute},
                'isMine' => $viewer !== null && $answer->team_survey_respondent_id === $viewer->id,
            ])
            ->values()
            ->all();
    }
}
```

`app/Actions/TeamSurveys/BuildSurveyResults.php`:

```php
<?php

namespace App\Actions\TeamSurveys;

use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;

class BuildSurveyResults
{
    public function __construct(private SummarizeSurveyQuestion $summarizeSurveyQuestion) {}

    /**
     * Null when the viewer may not see results; aggregates are withheld
     * from everyone, editors included, below the survey's threshold.
     *
     * @return array{belowThreshold: bool, responses: int, questions: array<string, array<string, mixed>>}|null
     */
    public function handle(TeamSurvey $survey, TeamSurveyRespondent $viewer): ?array
    {
        if (! $survey->resultsVisibleTo($viewer)) {
            return null;
        }

        $responses = $survey->responseCount();

        if ($responses < $survey->results_threshold) {
            return ['belowThreshold' => true, 'responses' => $responses, 'questions' => []];
        }

        return [
            'belowThreshold' => false,
            'responses' => $responses,
            'questions' => $this->summaries($survey, $viewer),
        ];
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public function summaries(TeamSurvey $survey, ?TeamSurveyRespondent $viewer = null): array
    {
        $questions = $survey->questions()->with('options')->get();

        $answers = TeamSurveyAnswer::query()
            ->whereIn('team_survey_question_id', $questions->pluck('id'))
            ->with('options')
            ->get()
            ->groupBy('team_survey_question_id');

        return $questions
            ->mapWithKeys(fn (TeamSurveyQuestion $question): array => [
                $question->id => $this->summarizeSurveyQuestion->handle($question, $answers->get($question->id, collect()), $viewer),
            ])
            ->all();
    }
}
```

- [ ] **Step 4: Snapshot and page**

`BuildTeamSurveySnapshot` takes `private BuildSurveyResults $buildSurveyResults` as a third constructor argument and returns, after `progress`:

```php
            'results' => $this->buildSurveyResults->handle($survey, $viewer),
```

`app/Http/Controllers/TeamSurveys/TeamSurveyResultsController.php`:

```php
<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\BuildTeamSurveySnapshot;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Enums\TeamSurveyStatus;
use App\Http\Controllers\Controller;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TeamSurveyResultsController extends Controller
{
    public function show(Request $request, TeamSurvey $teamSurvey, BuildTeamSurveySnapshot $buildTeamSurveySnapshot): Response|RedirectResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::viewable($teamSurvey, $respondent);

        if ($teamSurvey->status === TeamSurveyStatus::Draft) {
            return to_route('surveys.edit', $teamSurvey);
        }

        return Inertia::render('surveys/results', [
            'snapshot' => $buildTeamSurveySnapshot->handle($teamSurvey, $respondent),
        ]);
    }
}
```

`resources/js/pages/surveys/results.tsx`: a thin page as in Task 3, replaced in Task 23 (`FrontEndPagesTest`).

- [ ] **Step 5: Run the tests on the four engines**

Run, for each of `pgsql`, `mariadb`, `mysql`, `sqlite`: `bin/test-db <engine> -- tests/Feature/TeamSurveys tests/Arch`
Expected: PASS on each (every file of the folder, the earlier ones included).

- [ ] **Step 6: Commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app tests/Feature/TeamSurveys resources/js/pages/surveys/results.tsx
git commit -m "feat(surveys): results per question, withheld by viewer, status and threshold"
```

### Task 11: Starting from a previous survey, and comparing two

**Files:**
- Create: `app/Actions/TeamSurveys/DuplicateTeamSurvey.php`, `CompareSurveys.php`
- Create: `app/Http/Controllers/TeamSurveys/TeamSurveyDuplicatesController.php`, `TeamSurveyComparisonsController.php`
- Modify: `app/Http/Requests/TeamSurveys/TeamSurveyStoreRequest.php` (`source_survey_id`), `TeamSurveysController@store`, `BuildTeamSurveySnapshot` (adds `comparable`), `routes/web.php`
- Test: `tests/Feature/TeamSurveys/DuplicateTeamSurveyTest.php`, `tests/Feature/TeamSurveys/CompareSurveysTest.php`

**Interfaces:**
- Consumes: `BuildSurveyResults::summaries(TeamSurvey, ?TeamSurveyRespondent): array`, `CreateTeamSurvey`, `SurveyTemplateCatalogue`, `WriteSurveyQuestions`.
- Produces: `DuplicateTeamSurvey::handle(TeamSurvey $source, User $creator, ?string $title = null): TeamSurvey`; `CompareSurveys::defaultFor(TeamSurvey $survey): ?TeamSurvey`; `CompareSurveys::handle(TeamSurvey $current, TeamSurvey $other): array{other: array{id: string, title: string, closedAt: ?string}, belowThreshold: bool, pairs: array<int, array<string, mixed>>, onlyHere: array<int, array{questionId: string, label: string, kind: string}>, onlyThere: array<int, array{questionId: string, label: string, kind: string}>}`; routes `surveys.duplicate.store`, `surveys.comparison.show` (query `with`, optional); snapshot key `comparable: ?array{defaultId: ?string, surveys: array<int, array{id: string, title: string, closedAt: ?string}>}` (null for a guest and for a viewer without results).

A pair is `{questionId, otherQuestionId, kind, label, current, other, delta}`. `current` and `other` are: scale `{mean, responses}`, each mean on the health scale of five (spec §6.6: `HealthScale::average` of the raw mean, so a builder scale reads as answered and a health check of ten reads halved); NPS `{nps, responses}`; choice `{responses, options: [{label, percent}]}`; text `{responses}`. `delta` is: scale, the difference of the two means as shown, rounded to one decimal, or null when a mean is missing; NPS, the difference of scores; choice, a list `{label, delta}` in percentage points for the labels both have; text, the difference of the numbers of answers. Labels are matched once trimmed and folded by `Alphabetical::key` (rule 7).

- [ ] **Step 1: Write the failing tests**

`tests/Feature/TeamSurveys/DuplicateTeamSurveyTest.php`:

```php
<?php

use App\Enums\TeamSurveyQuestionKind;
use App\Enums\TeamSurveyStatus;
use App\Models\TeamSurvey;

it('copies title, settings, questions and options, and no answer', function () {
    $source = TeamSurvey::factory()->closed()->create(['title' => 'Pulse 41', 'one_question_at_a_time' => false, 'guest_access_enabled' => true]);
    [$facilitator, $respondent] = surveyFacilitator($source);
    $single = surveyQuestion($source, TeamSurveyQuestionKind::Single, ['match_key' => 'ritual', 'is_required' => true], ['Retro', 'Daily']);
    answerSurveyQuestion($single, $respondent, [0]);
    $member = teamMember($source->team);

    $this->actingAs($member)->post(route('surveys.duplicate.store', $source))->assertRedirect();

    $copy = TeamSurvey::query()->whereKeyNot($source->id)->sole();

    expect($copy->title)->toBe('Copy of Pulse 41')
        ->and($copy->status)->toBe(TeamSurveyStatus::Draft)
        ->and($copy->previous_survey_id)->toBe($source->id)
        ->and($copy->one_question_at_a_time)->toBeFalse()
        ->and($copy->guest_access_enabled)->toBeTrue()
        ->and($copy->guest_token)->not->toBe($source->guest_token)
        ->and($copy->facilitator->user_id)->toBe($member->id)
        ->and($copy->questions()->sole()->match_key)->toBe('ritual')
        ->and($copy->questions()->sole()->is_required)->toBeTrue()
        ->and($copy->questions()->sole()->options()->pluck('label')->all())->toBe(['Retro', 'Daily'])
        ->and($copy->hasAnswers())->toBeFalse();
});

it('gives a duplicated health check the team\'s statements of today, and no retro', function () {
    $source = TeamSurvey::factory()->healthCheck()->closed()->create();
    surveyQuestion($source, TeamSurveyQuestionKind::Scale, ['match_key' => 'gone', 'scale_max' => 10]);

    $this->actingAs(teamMember($source->team))->post(route('surveys.duplicate.store', $source))->assertRedirect();

    $copy = TeamSurvey::query()->whereKeyNot($source->id)->sole();

    expect($copy->questions()->count())->toBe(6)
        ->and($copy->questions()->pluck('match_key')->all())->not->toContain('gone')
        ->and($copy->retro_id)->toBeNull()
        ->and($copy->results_threshold)->toBe(3);
});

it('creates from a previous survey through the creation route', function () {
    $source = TeamSurvey::factory()->closed()->create();
    surveyQuestion($source);
    $member = teamMember($source->team);

    $this->actingAs($member)->post(route('teams.surveys.store', [$source->team->workspace, $source->team]), [
        'title' => 'Pulse 42',
        'source_survey_id' => $source->id,
    ])->assertRedirect();

    $copy = TeamSurvey::query()->whereKeyNot($source->id)->sole();

    expect($copy->title)->toBe('Pulse 42')
        ->and($copy->questions()->count())->toBe(1);
});

it('refuses a source of another team, a source with a template, and a guest', function () {
    $source = TeamSurvey::factory()->closed()->withGuestAccess()->create();
    $otherTeamSurvey = TeamSurvey::factory()->closed()->create();
    $member = teamMember($source->team);

    $this->actingAs($member)->postJson(route('teams.surveys.store', [$source->team->workspace, $source->team]), ['title' => 'T', 'source_survey_id' => $otherTeamSurvey->id])
        ->assertJsonValidationErrors('source_survey_id');
    $this->actingAs($member)->postJson(route('teams.surveys.store', [$source->team->workspace, $source->team]), ['title' => 'T', 'source_survey_id' => $source->id, 'template' => 'team_pulse'])
        ->assertJsonValidationErrors('template');

    auth()->logout();
    $this->withCookies(surveyGuestCookie(surveyGuest($source)))->withCredentials()
        ->postJson(route('surveys.duplicate.store', $source))
        ->assertForbidden();
});
```

`tests/Feature/TeamSurveys/CompareSurveysTest.php`:

```php
<?php

use App\Actions\TeamSurveys\CompareSurveys;
use App\Enums\TeamSurveyQuestionKind;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyQuestion;

/**
 * @param  array<int, int|string|array<int, int>>  $answers
 */
function answeredBy(TeamSurveyQuestion $question, array $answers): void
{
    foreach ($answers as $answer) {
        [, $respondent] = surveyMember($question->survey);
        answerSurveyQuestion($question, $respondent, $answer);
    }
}

function closedSurvey(Team $team, string $closedAt, array $attributes = []): TeamSurvey
{
    return TeamSurvey::factory()->closed()->withoutThreshold()->create(['team_id' => $team->id, 'closed_at' => $closedAt, ...$attributes]);
}

it('pairs questions by key, then by kind and label, and gives each difference', function () {
    $team = Team::factory()->create();
    $before = closedSurvey($team, '2026-09-01 10:00:00', ['title' => 'Sprint 41']);
    $now = closedSurvey($team, '2026-10-01 10:00:00', ['previous_survey_id' => $before->id]);

    answeredBy(surveyQuestion($before, TeamSurveyQuestionKind::Scale, ['match_key' => 'workload', 'label' => 'Old wording']), [3, 3]);
    answeredBy(surveyQuestion($now, TeamSurveyQuestionKind::Scale, ['match_key' => 'workload', 'label' => 'New wording']), [4, 5]);
    answeredBy(surveyQuestion($before, TeamSurveyQuestionKind::Nps, ['match_key' => null, 'label' => 'Recommend us? ']), [0, 10]);
    answeredBy(surveyQuestion($now, TeamSurveyQuestionKind::Nps, ['match_key' => null, 'label' => ' recommend US?']), [10, 10]);
    answeredBy(surveyQuestion($before, TeamSurveyQuestionKind::Single, ['match_key' => 'ritual'], ['Retro', 'Daily']), [[0], [1]]);
    answeredBy(surveyQuestion($now, TeamSurveyQuestionKind::Single, ['match_key' => 'ritual'], ['Retro', 'Demo']), [[0], [0]]);
    surveyQuestion($before, TeamSurveyQuestionKind::Text, ['match_key' => 'left', 'label' => 'Dropped']);
    surveyQuestion($now, TeamSurveyQuestionKind::Text, ['match_key' => 'new', 'label' => 'Added']);

    $comparison = resolve(CompareSurveys::class)->handle($now, $before);
    $pairs = collect($comparison['pairs'])->keyBy('kind');

    expect($comparison['other'])->toMatchArray(['id' => $before->id, 'title' => 'Sprint 41'])
        ->and($comparison['belowThreshold'])->toBeFalse()
        ->and($pairs['scale'])->toMatchArray(['label' => 'New wording', 'current' => ['mean' => 4.5, 'responses' => 2], 'other' => ['mean' => 3.0, 'responses' => 2], 'delta' => 1.5])
        ->and($pairs['nps']['delta'])->toBe(100)
        ->and($pairs['single']['delta'])->toBe([['label' => 'Retro', 'delta' => 50]])
        ->and(array_column($comparison['onlyHere'], 'label'))->toBe(['Added'])
        ->and(array_column($comparison['onlyThere'], 'label'))->toBe(['Dropped']);
});

it('compares a scale of ten with a scale of five on five, the old one read halved', function () {
    $team = Team::factory()->create();
    $before = closedSurvey($team, '2026-09-01 10:00:00');
    $now = closedSurvey($team, '2026-10-01 10:00:00');
    answeredBy(surveyQuestion($before, TeamSurveyQuestionKind::Scale, ['match_key' => 'k', 'scale_max' => 10]), [7, 8]);
    answeredBy(surveyQuestion($now, TeamSurveyQuestionKind::Scale, ['match_key' => 'k', 'scale_max' => 5]), [4, 5]);

    $pair = resolve(CompareSurveys::class)->handle($now, $before)['pairs'][0];

    expect($pair['current'])->toBe(['mean' => 4.5, 'responses' => 2])
        ->and($pair['other'])->toBe(['mean' => 3.8, 'responses' => 2])
        ->and($pair['delta'])->toBe(0.7);
});

it('compares with the source by default, and a health check with the team\'s previous closed health check', function () {
    $team = Team::factory()->create();
    $source = closedSurvey($team, '2026-08-01 10:00:00');
    $copy = closedSurvey($team, '2026-09-01 10:00:00', ['previous_survey_id' => $source->id]);
    $firstHealth = TeamSurvey::factory()->healthCheck()->closed()->create(['team_id' => $team->id, 'closed_at' => '2026-07-01 10:00:00']);
    $secondHealth = TeamSurvey::factory()->healthCheck()->closed()->create(['team_id' => $team->id, 'closed_at' => '2026-09-15 10:00:00']);
    $openHealth = TeamSurvey::factory()->healthCheck()->open()->create(['team_id' => $team->id]);
    $compare = resolve(CompareSurveys::class);

    expect($compare->defaultFor($copy)?->id)->toBe($source->id)
        ->and($compare->defaultFor($secondHealth)?->id)->toBe($firstHealth->id)
        ->and($compare->defaultFor($openHealth)?->id)->toBe($secondHealth->id)
        ->and($compare->defaultFor($firstHealth))->toBeNull()
        ->and($compare->defaultFor($source))->toBeNull();
});

it('serves the comparison to a member who sees the results, and lists what can be compared', function () {
    $team = Team::factory()->create();
    $before = closedSurvey($team, '2026-09-01 10:00:00', ['title' => 'Sprint 41']);
    $now = closedSurvey($team, '2026-10-01 10:00:00', ['previous_survey_id' => $before->id]);
    $member = teamMember($team);

    $this->actingAs($member)->getJson(route('surveys.comparison.show', $now))
        ->assertOk()
        ->assertJsonPath('comparison.other.id', $before->id);

    $this->actingAs($member)->getJson(route('surveys.snapshot.show', $now))
        ->assertJsonPath('comparable.defaultId', $before->id)
        ->assertJsonPath('comparable.surveys.0.title', 'Sprint 41');
});

it('answers with no comparison when there is nothing to compare with', function () {
    $survey = closedSurvey(Team::factory()->create(), '2026-10-01 10:00:00');

    $this->actingAs(teamMember($survey->team))->getJson(route('surveys.comparison.show', $survey))
        ->assertOk()
        ->assertJsonPath('comparison', null);
});

it('refuses a survey of another team, an open one, a viewer without results, and a guest', function () {
    $team = Team::factory()->create();
    $now = closedSurvey($team, '2026-10-01 10:00:00', ['guest_access_enabled' => true]);
    $foreign = closedSurvey(Team::factory()->create(), '2026-09-01 10:00:00');
    $open = TeamSurvey::factory()->open()->create(['team_id' => $team->id]);
    $member = teamMember($team);

    $this->actingAs($member)->getJson(route('surveys.comparison.show', [$now, 'with' => $foreign->id]))->assertNotFound();
    $this->actingAs($member)->getJson(route('surveys.comparison.show', [$now, 'with' => $open->id]))->assertNotFound();
    $this->actingAs($member)->getJson(route('surveys.comparison.show', [$open, 'with' => $now->id]))->assertForbidden();

    auth()->logout();
    $guest = surveyGuest($now);
    $this->withCookies(surveyGuestCookie($guest))->withCredentials()
        ->getJson(route('surveys.comparison.show', $now))
        ->assertForbidden();
    $this->withCookies(surveyGuestCookie($guest))->withCredentials()
        ->getJson(route('surveys.snapshot.show', $now))
        ->assertJsonPath('comparable', null);
});

it('gives no value of the other survey while it is below its threshold', function () {
    $team = Team::factory()->create();
    $before = TeamSurvey::factory()->closed()->create(['team_id' => $team->id, 'closed_at' => '2026-09-01 10:00:00']);
    $now = closedSurvey($team, '2026-10-01 10:00:00');
    answeredBy(surveyQuestion($before, TeamSurveyQuestionKind::Scale, ['match_key' => 'k']), [5]);
    answeredBy(surveyQuestion($now, TeamSurveyQuestionKind::Scale, ['match_key' => 'k']), [3]);

    $comparison = resolve(CompareSurveys::class)->handle($now, $before);

    expect($comparison['belowThreshold'])->toBeTrue()
        ->and($comparison['pairs'])->toBe([]);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/DuplicateTeamSurveyTest.php tests/Feature/TeamSurveys/CompareSurveysTest.php`
Expected: FAIL, `Route [surveys.duplicate.store] not defined`.

- [ ] **Step 3: Duplicate**

`app/Actions/TeamSurveys/DuplicateTeamSurvey.php`:

```php
<?php

namespace App\Actions\TeamSurveys;

use App\Models\TeamSurvey;
use App\Models\TeamSurveyOption;
use App\Models\TeamSurveyQuestion;
use App\Models\User;
use App\Support\Surveys\QuestionDefinition;
use App\Support\Surveys\SurveyTemplateCatalogue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DuplicateTeamSurvey
{
    public function __construct(
        private CreateTeamSurvey $createTeamSurvey,
        private WriteSurveyQuestions $writeSurveyQuestions,
        private SurveyTemplateCatalogue $surveyTemplateCatalogue,
    ) {}

    /**
     * The copy is always a survey of its own, even when the source was
     * attached to a retro. A locked template takes the team's statements
     * of today rather than the ones the source froze.
     */
    public function handle(TeamSurvey $source, User $creator, ?string $title = null): TeamSurvey
    {
        return DB::transaction(function () use ($source, $creator, $title): TeamSurvey {
            $copy = $this->createTeamSurvey->handle($source->team, $creator, new NewTeamSurvey(
                title: $title ?? Str::limit(__('Copy of :title', ['title' => $source->title]), 120, ''),
                template: $source->template,
                guestAccessEnabled: $source->guest_access_enabled,
            ));

            $copy->update([
                'description' => $source->description,
                'one_question_at_a_time' => $source->retro_id === null ? $source->one_question_at_a_time : true,
                'show_results_after_answer' => $source->retro_id === null ? $source->show_results_after_answer : true,
                'previous_survey_id' => $source->id,
            ]);

            if (! $source->hasLockedQuestions()) {
                $this->writeSurveyQuestions->handle($copy, $this->definitions($source));
            }

            return $copy;
        });
    }

    /**
     * @return array<int, QuestionDefinition>
     */
    private function definitions(TeamSurvey $source): array
    {
        return $source->questions()->with('options')->get()
            ->map(fn (TeamSurveyQuestion $question): QuestionDefinition => new QuestionDefinition(
                kind: $question->kind,
                label: $question->label,
                shortLabel: $question->short_label,
                description: $question->description,
                builtin: $question->builtin,
                matchKey: $question->match_key,
                isRequired: $question->is_required,
                allowsComment: $question->allows_comment,
                scaleMax: $question->scale_max,
                scaleMinLabel: $question->scale_min_label,
                scaleMaxLabel: $question->scale_max_label,
                options: $question->options->map(fn (TeamSurveyOption $option): string => $option->label)->all(),
            ))
            ->all();
    }
}
```

`CreateTeamSurvey` already writes the statements of today for a health check, which is what the second test expects.

`app/Http/Controllers/TeamSurveys/TeamSurveyDuplicatesController.php`:

```php
<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\DuplicateTeamSurvey;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Http\Controllers\Controller;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TeamSurveyDuplicatesController extends Controller
{
    public function store(Request $request, TeamSurvey $teamSurvey, DuplicateTeamSurvey $duplicateTeamSurvey): RedirectResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::notGuest($respondent);
        TeamSurveyGuard::viewable($teamSurvey, $respondent);
        Gate::authorize('createSurvey', $teamSurvey->team);

        return to_route('surveys.edit', $duplicateTeamSurvey->handle($teamSurvey, $request->user()));
    }
}
```

In `TeamSurveyStoreRequest::rules()`, replace the `template` line and add the source:

```php
            'template' => ['sometimes', 'nullable', 'prohibits:source_survey_id', Rule::enum(TeamSurveyTemplate::class)],
            'source_survey_id' => [
                'sometimes', 'nullable', 'uuid',
                Rule::exists('team_surveys', 'id')->where('team_id', $this->route('team')->id)->where('status', '!=', TeamSurveyStatus::Draft->value)->whereNull('retro_id'),
            ],
```

In `TeamSurveysController@store`, before the creation (inject `DuplicateTeamSurvey $duplicateTeamSurvey`):

```php
        if ($request->filled('source_survey_id')) {
            $source = $team->teamSurveys()->findOrFail($request->validated('source_survey_id'));

            return to_route('surveys.edit', $duplicateTeamSurvey->handle($source, $request->user(), $request->validated('title')));
        }
```

- [ ] **Step 4: Compare**

`app/Actions/TeamSurveys/CompareSurveys.php`:

```php
<?php

namespace App\Actions\TeamSurveys;

use App\Enums\TeamSurveyQuestionKind;
use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyQuestion;
use App\Support\Alphabetical;
use App\Support\Surveys\HealthScale;
use Illuminate\Support\Collection;

class CompareSurveys
{
    public function __construct(private BuildSurveyResults $buildSurveyResults) {}

    public function defaultFor(TeamSurvey $survey): ?TeamSurvey
    {
        if (! $survey->isHealthCheck()) {
            return $survey->previous()->where('status', TeamSurveyStatus::Closed)->first();
        }

        return TeamSurvey::query()
            ->where('team_id', $survey->team_id)
            ->whereKeyNot($survey->id)
            ->where('template', TeamSurveyTemplate::HealthCheck)
            ->where('status', TeamSurveyStatus::Closed)
            ->where('closed_at', '<', $survey->closed_at ?? now())
            ->orderByDesc('closed_at')
            ->orderByDesc('id')
            ->first();
    }

    /**
     * @return array<string, mixed>
     */
    public function handle(TeamSurvey $current, TeamSurvey $other): array
    {
        $header = [
            'other' => ['id' => $other->id, 'title' => $other->title, 'closedAt' => $other->closed_at?->toIso8601String()],
            'belowThreshold' => false,
            'pairs' => [],
            'onlyHere' => [],
            'onlyThere' => [],
        ];

        if ($other->responseCount() < $other->results_threshold || $current->responseCount() < $current->results_threshold) {
            return [...$header, 'belowThreshold' => true];
        }

        $currentQuestions = $current->questions()->with('options')->get();
        $otherQuestions = $other->questions()->with('options')->get();
        $currentSummaries = $this->buildSurveyResults->summaries($current);
        $otherSummaries = $this->buildSurveyResults->summaries($other);
        $taken = [];
        $pairs = [];
        $onlyHere = [];

        foreach ($currentQuestions as $question) {
            $match = $this->match($question, $otherQuestions->reject(fn (TeamSurveyQuestion $candidate): bool => in_array($candidate->id, $taken, true)));

            if ($match === null) {
                $onlyHere[] = $this->lone($question);

                continue;
            }

            $taken[] = $match->id;
            $pairs[] = $this->pair($question, $match, $currentSummaries[$question->id], $otherSummaries[$match->id]);
        }

        return [
            ...$header,
            'pairs' => $pairs,
            'onlyHere' => $onlyHere,
            'onlyThere' => $otherQuestions
                ->reject(fn (TeamSurveyQuestion $question): bool => in_array($question->id, $taken, true))
                ->map(fn (TeamSurveyQuestion $question): array => $this->lone($question))
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  Collection<int, TeamSurveyQuestion>  $candidates
     */
    private function match(TeamSurveyQuestion $question, Collection $candidates): ?TeamSurveyQuestion
    {
        if ($question->match_key !== null) {
            $byKey = $candidates->first(fn (TeamSurveyQuestion $candidate): bool => $candidate->match_key === $question->match_key && $candidate->kind === $question->kind);

            if ($byKey !== null) {
                return $byKey;
            }
        }

        return $candidates->first(fn (TeamSurveyQuestion $candidate): bool => $candidate->kind === $question->kind
            && $this->normalised($candidate->label) === $this->normalised($question->label)
            && ($candidate->match_key === null || $question->match_key === null));
    }

    private function normalised(string $label): string
    {
        return Alphabetical::key(trim($label));
    }

    /**
     * @return array{questionId: string, label: string, kind: string}
     */
    private function lone(TeamSurveyQuestion $question): array
    {
        return ['questionId' => $question->id, 'label' => $question->displayLabel(), 'kind' => $question->kind->value];
    }

    /**
     * @param  array<string, mixed>  $current
     * @param  array<string, mixed>  $other
     * @return array<string, mixed>
     */
    private function pair(TeamSurveyQuestion $question, TeamSurveyQuestion $match, array $current, array $other): array
    {
        $values = match ($question->kind) {
            TeamSurveyQuestionKind::Scale => $this->scale($question, $match, $current, $other),
            TeamSurveyQuestionKind::Nps => [
                'current' => ['nps' => $current['nps'], 'responses' => $current['responses']],
                'other' => ['nps' => $other['nps'], 'responses' => $other['responses']],
                'delta' => $current['nps'] === null || $other['nps'] === null ? null : $current['nps'] - $other['nps'],
            ],
            TeamSurveyQuestionKind::Single, TeamSurveyQuestionKind::Multiple => $this->choice($current, $other),
            TeamSurveyQuestionKind::Text => [
                'current' => ['responses' => $current['responses']],
                'other' => ['responses' => $other['responses']],
                'delta' => $current['responses'] - $other['responses'],
            ],
        };

        return [
            'questionId' => $question->id,
            'otherQuestionId' => $match->id,
            'kind' => $question->kind->value,
            'label' => $question->displayLabel(),
            ...$values,
        ];
    }

    /**
     * @param  array<string, mixed>  $current
     * @param  array<string, mixed>  $other
     * @return array<string, mixed>
     */
    private function scale(TeamSurveyQuestion $question, TeamSurveyQuestion $match, array $current, array $other): array
    {
        $currentMean = $this->onHealthScale($current, (int) $question->scale_max);
        $otherMean = $this->onHealthScale($other, (int) $match->scale_max);

        return [
            'current' => ['mean' => $currentMean, 'responses' => $current['responses']],
            'other' => ['mean' => $otherMean, 'responses' => $other['responses']],
            'delta' => $currentMean === null || $otherMean === null ? null : round($currentMean - $otherMean, 1),
        ];
    }

    /**
     * Both means on five (spec §6.6, §11.9), from the raw counts of the
     * summary's buckets, so that a mean is rounded once: a builder scale of
     * five reads as it was answered, a health check of ten reads halved.
     *
     * @param  array<string, mixed>  $summary
     */
    private function onHealthScale(array $summary, int $scaleMax): ?float
    {
        $buckets = collect($summary['buckets'] ?? []);
        $answers = (int) $buckets->sum('count');

        if ($answers === 0) {
            return null;
        }

        $total = $buckets->sum(fn (array $bucket): int => (int) $bucket['key'] * (int) $bucket['count']);

        return HealthScale::average($total / $answers, $scaleMax);
    }

    /**
     * @param  array<string, mixed>  $current
     * @param  array<string, mixed>  $other
     * @return array<string, mixed>
     */
    private function choice(array $current, array $other): array
    {
        $currentOptions = $this->percents($current);
        $otherOptions = $this->percents($other);
        $otherByLabel = collect($otherOptions)->keyBy(fn (array $option): string => $this->normalised($option['label']));

        $delta = collect($currentOptions)
            ->filter(fn (array $option): bool => $otherByLabel->has($this->normalised($option['label'])))
            ->map(fn (array $option): array => [
                'label' => $option['label'],
                'delta' => $option['percent'] - $otherByLabel[$this->normalised($option['label'])]['percent'],
            ])
            ->values()
            ->all();

        return [
            'current' => ['responses' => $current['responses'], 'options' => $currentOptions],
            'other' => ['responses' => $other['responses'], 'options' => $otherOptions],
            'delta' => $delta,
        ];
    }

    /**
     * @param  array<string, mixed>  $summary
     * @return array<int, array{label: string, percent: int}>
     */
    private function percents(array $summary): array
    {
        return array_map(fn (array $option): array => [
            'label' => $option['label'],
            'percent' => $summary['responses'] === 0 ? 0 : (int) round($option['count'] / $summary['responses'] * 100),
        ], $summary['options']);
    }
}
```

`app/Http/Controllers/TeamSurveys/TeamSurveyComparisonsController.php`:

```php
<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\CompareSurveys;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Enums\TeamSurveyStatus;
use App\Http\Controllers\Controller;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeamSurveyComparisonsController extends Controller
{
    public function show(Request $request, TeamSurvey $teamSurvey, CompareSurveys $compareSurveys): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::notGuest($respondent);
        abort_unless($teamSurvey->resultsVisibleTo($respondent), 403);

        $validated = $request->validate(['with' => ['sometimes', 'uuid']]);

        $other = isset($validated['with'])
            ? TeamSurvey::query()
                ->where('team_id', $teamSurvey->team_id)
                ->where('status', TeamSurveyStatus::Closed)
                ->whereKeyNot($teamSurvey->id)
                ->findOrFail($validated['with'])
            : $compareSurveys->defaultFor($teamSurvey);

        return response()->json([
            'comparison' => $other === null ? null : $compareSurveys->handle($teamSurvey, $other),
        ]);
    }
}
```

`BuildTeamSurveySnapshot` takes `private CompareSurveys $compareSurveys` as a fourth constructor argument and returns, after `results`:

```php
            'comparable' => $this->comparable($survey, $viewer),
```

with:

```php
    /**
     * @return array{defaultId: ?string, surveys: array<int, array{id: string, title: string, closedAt: ?string}>}|null
     */
    private function comparable(TeamSurvey $survey, TeamSurveyRespondent $viewer): ?array
    {
        if ($viewer->isGuest() || ! $survey->resultsVisibleTo($viewer)) {
            return null;
        }

        return [
            'defaultId' => $this->compareSurveys->defaultFor($survey)?->id,
            'surveys' => TeamSurvey::query()
                ->where('team_id', $survey->team_id)
                ->where('status', TeamSurveyStatus::Closed)
                ->whereKeyNot($survey->id)
                ->orderByDesc('closed_at')
                ->orderByDesc('id')
                ->limit(20)
                ->get(['id', 'title', 'closed_at'])
                ->map(fn (TeamSurvey $other): array => [
                    'id' => $other->id,
                    'title' => $other->title,
                    'closedAt' => $other->closed_at?->toIso8601String(),
                ])
                ->all(),
        ];
    }
```

Routes:

```php
        Route::get('comparison', [TeamSurveyComparisonsController::class, 'show'])->name('surveys.comparison.show');
        Route::post('duplicate', [TeamSurveyDuplicatesController::class, 'store'])->name('surveys.duplicate.store');
```

- [ ] **Step 5: Run the tests on the four engines**

Run, for each of `pgsql`, `mariadb`, `mysql`, `sqlite`: `bin/test-db <engine> -- tests/Feature/TeamSurveys`
Expected: PASS on each.

- [ ] **Step 6: Commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app routes tests/Feature/TeamSurveys lang
git commit -m "feat(surveys): start from a previous survey, compare two surveys of a team"
```

### Task 12: CSV export

**Files:**
- Create: `app/Actions/TeamSurveys/ExportSurveyCsv.php`, `app/Http/Controllers/TeamSurveys/TeamSurveyExportsController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/TeamSurveys/TeamSurveyExportTest.php`

**Interfaces:**
- Consumes: `TeamSurveyGuard::editor`, `::notGuest`, the models.
- Produces: `ExportSurveyCsv::rows(TeamSurvey $survey): array<int, array<int, string>>` (the header row first); `ExportSurveyCsv::fileName(TeamSurvey $survey): string`; route `surveys.export.show`.

Rows are sorted by their content, not shuffled: a random order cannot be tested and can repeat the order of arrival; an order by content tells nothing about when or by whom, which is the rule text answers already follow. Respondents are numbered after the sort.

- [ ] **Step 1: Write the failing test**

`tests/Feature/TeamSurveys/TeamSurveyExportTest.php`:

```php
<?php

use App\Actions\TeamSurveys\ExportSurveyCsv;
use App\Enums\TeamSurveyQuestionKind;
use App\Models\TeamSurvey;

/**
 * @return array{0: TeamSurvey, 1: App\Models\User}
 */
function exportableSurvey(string $state = 'closed'): array
{
    $survey = TeamSurvey::factory()->{$state}()->withoutThreshold()->create(['title' => 'Team pulse — sprint 42']);
    [$facilitator] = surveyFacilitator($survey);

    return [$survey, $facilitator];
}

it('writes one row per respondent, one column per question, and no name', function () {
    [$survey] = exportableSurvey();
    $scale = surveyQuestion($survey, TeamSurveyQuestionKind::Scale, ['label' => 'Workload', 'allows_comment' => true]);
    $multiple = surveyQuestion($survey, TeamSurveyQuestionKind::Multiple, ['label' => 'Blockers'], ['Meetings', 'Specs']);
    $text = surveyQuestion($survey, TeamSurveyQuestionKind::Text, ['label' => 'A word']);
    [$alice, $first] = surveyMember($survey);
    [, $second] = surveyMember($survey);
    surveyMember($survey);

    answerSurveyQuestion($scale, $first, 5, 'calm sprint');
    answerSurveyQuestion($multiple, $first, [0, 1]);
    answerSurveyQuestion($text, $second, 'thanks');
    answerSurveyQuestion($scale, $second, 2);

    $rows = resolve(ExportSurveyCsv::class)->rows($survey);

    expect($rows[0])->toBe(['Respondent', 'Q1 · Workload', 'Q1 · comment', 'Q2 · Blockers', 'Q3 · A word'])
        ->and($rows)->toHaveCount(3)
        ->and($rows[1])->toBe(['Respondent 1', '2', '', '', 'thanks'])
        ->and($rows[2])->toBe(['Respondent 2', '5', 'calm sprint', 'Meetings | Specs', ''])
        ->and(json_encode($rows))->not->toContain($alice->name);
});

it('orders rows by their content, whatever the order of answering', function () {
    [$survey] = exportableSurvey();
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Text, ['label' => 'Word']);

    foreach (['zebra', 'apple', 'mango'] as $word) {
        [, $respondent] = surveyMember($survey);
        answerSurveyQuestion($question, $respondent, $word);
    }

    expect(array_column(array_slice(resolve(ExportSurveyCsv::class)->rows($survey), 1), 1))->toBe(['apple', 'mango', 'zebra']);
});

it('neutralises a cell that a spreadsheet would run as a formula', function (string $text, string $expected) {
    [$survey] = exportableSurvey();
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Text, ['label' => '=Word']);
    [, $respondent] = surveyMember($survey);
    answerSurveyQuestion($question, $respondent, $text);

    $rows = resolve(ExportSurveyCsv::class)->rows($survey);

    expect($rows[1][1])->toBe($expected)
        ->and($rows[0][1])->toBe('Q1 · =Word');
})->with([
    'equals' => ['=HYPERLINK("http://evil.test","x")', '\'=HYPERLINK("http://evil.test","x")'],
    'plus' => ['+1+1', '\'+1+1'],
    'minus' => ['-2+3', '\'-2+3'],
    'at' => ['@SUM(A1)', '\'@SUM(A1)'],
    'tab' => ["\t=1", "'\t=1"],
    'plain' => ['fine = fine', 'fine = fine'],
]);

it('streams the file to an editor of a closed survey', function () {
    [$survey, $facilitator] = exportableSurvey();
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Text, ['label' => 'Word']);
    [, $respondent] = surveyMember($survey);
    answerSurveyQuestion($question, $respondent, 'été');

    $response = $this->actingAs($facilitator)->get(route('surveys.export.show', $survey))->assertOk();

    expect($response->headers->get('content-type'))->toBe('text/csv; charset=UTF-8')
        ->and($response->headers->get('content-disposition'))->toContain('survey-team-pulse-sprint-42-')
        ->and($response->streamedContent())->toStartWith("\u{FEFF}Respondent,")
        ->and($response->streamedContent())->toContain('été');
});

it('refuses the export of an open survey, to a member who is not an editor, and below the threshold', function () {
    [$open, $facilitator] = exportableSurvey('open');
    [$closed, $closedFacilitator] = exportableSurvey();
    $thresholded = TeamSurvey::factory()->closed()->create();
    [$thresholdedFacilitator] = surveyFacilitator($thresholded);

    $this->actingAs($facilitator)->getJson(route('surveys.export.show', $open))->assertUnprocessable()->assertJsonValidationErrors('survey');
    $this->actingAs(teamMember($closed->team))->getJson(route('surveys.export.show', $closed))->assertForbidden();
    $this->actingAs($thresholdedFacilitator)->getJson(route('surveys.export.show', $thresholded))->assertUnprocessable();
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/TeamSurveyExportTest.php`
Expected: FAIL, `Class "App\Actions\TeamSurveys\ExportSurveyCsv" not found`.

- [ ] **Step 3: Implementation**

`app/Actions/TeamSurveys/ExportSurveyCsv.php`:

```php
<?php

namespace App\Actions\TeamSurveys;

use App\Enums\TeamSurveyQuestionKind;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyOption;
use App\Models\TeamSurveyQuestion;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class ExportSurveyCsv
{
    private const string FormulaLeads = "=+-@\t\r";

    /**
     * The header, then one row per respondent who answered. Rows are
     * ordered by their content so that the order tells neither when nor
     * by whom a response was given; the numbering follows that order.
     *
     * @return array<int, array<int, string>>
     */
    public function rows(TeamSurvey $survey): array
    {
        $questions = $survey->questions()->with('options')->get();

        $answersByRespondent = TeamSurveyAnswer::query()
            ->whereIn('team_survey_question_id', $questions->pluck('id'))
            ->with('options')
            ->get()
            ->groupBy('team_survey_respondent_id');

        $rows = $answersByRespondent
            ->map(fn (Collection $answers): array => $this->cells($questions, $answers->keyBy('team_survey_question_id')))
            ->sort(fn (array $first, array $second): int => $first <=> $second)
            ->values()
            ->map(fn (array $cells, int $index): array => [__('Respondent :number', ['number' => $index + 1]), ...$cells])
            ->all();

        return [$this->header($questions), ...$rows];
    }

    public function fileName(TeamSurvey $survey): string
    {
        $slug = Str::slug($survey->title) ?: 'survey';

        return "survey-{$slug}-".now()->format('Y-m-d').'.csv';
    }

    /**
     * @param  Collection<int, TeamSurveyQuestion>  $questions
     * @return array<int, string>
     */
    private function header(Collection $questions): array
    {
        $header = [__('Respondent')];

        foreach ($questions->values() as $index => $question) {
            $number = $index + 1;
            $header[] = "Q{$number} · {$question->displayLabel()}";

            if ($question->allows_comment) {
                $header[] = "Q{$number} · ".__('comment');
            }
        }

        return $header;
    }

    /**
     * @param  Collection<int, TeamSurveyQuestion>  $questions
     * @param  Collection<string, TeamSurveyAnswer>  $answers  keyed by question id
     * @return array<int, string>
     */
    private function cells(Collection $questions, Collection $answers): array
    {
        $cells = [];

        foreach ($questions as $question) {
            $answer = $answers->get($question->id);
            $cells[] = $this->safe($this->value($question, $answer));

            if ($question->allows_comment) {
                $cells[] = $this->safe((string) $answer?->comment);
            }
        }

        return $cells;
    }

    private function value(TeamSurveyQuestion $question, ?TeamSurveyAnswer $answer): string
    {
        if ($answer === null) {
            return '';
        }

        return match ($question->kind) {
            TeamSurveyQuestionKind::Scale, TeamSurveyQuestionKind::Nps => (string) $answer->value,
            TeamSurveyQuestionKind::Text => (string) $answer->text,
            TeamSurveyQuestionKind::Single, TeamSurveyQuestionKind::Multiple => $question->options
                ->filter(fn (TeamSurveyOption $option): bool => $answer->options->contains('id', $option->id))
                ->map(fn (TeamSurveyOption $option): string => $option->label)
                ->implode(' | '),
        };
    }

    /**
     * A leading =, +, -, @, tab or carriage return makes a spreadsheet run
     * the cell as a formula; an apostrophe makes it text.
     */
    private function safe(string $cell): string
    {
        if ($cell === '' || ! str_contains(self::FormulaLeads, $cell[0])) {
            return $cell;
        }

        return "'".$cell;
    }
}
```

The header cells start with "Q", so they need no neutralising; the test pins that a label beginning with `=` stays behind "Q1 · ".

`app/Http/Controllers/TeamSurveys/TeamSurveyExportsController.php`:

```php
<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\ExportSurveyCsv;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Enums\TeamSurveyStatus;
use App\Http\Controllers\Controller;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TeamSurveyExportsController extends Controller
{
    public function show(Request $request, TeamSurvey $teamSurvey, ExportSurveyCsv $exportSurveyCsv): StreamedResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::notGuest($respondent);
        TeamSurveyGuard::editor($teamSurvey, $respondent);

        if ($teamSurvey->status !== TeamSurveyStatus::Closed) {
            throw ValidationException::withMessages(['survey' => __('Results can be exported once the survey is closed.')]);
        }

        if ($teamSurvey->responseCount() < $teamSurvey->results_threshold) {
            throw ValidationException::withMessages(['survey' => __('Not enough answers to show results.')]);
        }

        $rows = $exportSurveyCsv->rows($teamSurvey);

        return response()->streamDownload(function () use ($rows): void {
            $output = fopen('php://output', 'w');

            fwrite($output, "\u{FEFF}");

            foreach ($rows as $row) {
                fputcsv($output, $row, ',', '"', '');
            }

            fclose($output);
        }, $exportSurveyCsv->fileName($teamSurvey), ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
```

`fputcsv` takes the escape character as an explicit empty string, which PHP 8.4 asks for and which keeps a backslash in an answer as written.

Route: `Route::get('export', [TeamSurveyExportsController::class, 'show'])->name('surveys.export.show');`

- [ ] **Step 4: Run the tests on the four engines**

Run, for each of `pgsql`, `mariadb`, `mysql`, `sqlite`: `bin/test-db <engine> -- tests/Feature/TeamSurveys/TeamSurveyExportTest.php`
Expected: PASS on each.

- [ ] **Step 5: Commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app routes tests/Feature/TeamSurveys lang
git commit -m "feat(surveys): CSV export of a closed survey, unnamed and formula-safe"
```

### Task 13: The team page lists the team's surveys

**Files:**
- Create: `app/Actions/TeamSurveys/PresentTeamSurveySummary.php`
- Modify: `app/Http/Controllers/TeamsController.php`
- Test: `tests/Feature/TeamSurveys/TeamSurveysSectionTest.php`

**Interfaces:**
- Consumes: `SurveyTemplateCatalogue::options(Team)`, `TeamSurvey::isEditor` (through the creator), `User::canManage`.
- Produces: `PresentTeamSurveySummary::handle(TeamSurvey $survey, User $viewer, bool $viewerManagesWorkspace): array{id: string, title: string, status: string, template: ?string, questionCount: int, responseCount: int, updatedAt: ?string, closedAt: ?string, facilitatorName: ?string, canManage: bool, url: string}`; props of `teams/show`: `surveys`, `canCreateSurvey`, `surveyTemplates`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/TeamSurveys/TeamSurveysSectionTest.php`:

```php
<?php

use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use Inertia\Testing\AssertableInertia as Assert;

it('lists the team\'s surveys, newest first, with their counts', function () {
    $team = Team::factory()->create();
    $older = TeamSurvey::factory()->closed()->create(['team_id' => $team->id, 'title' => 'Older', 'updated_at' => now()->subDay()]);
    $newer = TeamSurvey::factory()->open()->create(['team_id' => $team->id, 'title' => 'Newer']);
    [$facilitator, $respondent] = surveyFacilitator($newer);
    $question = surveyQuestion($newer);
    surveyQuestion($newer);
    answerSurveyQuestion($question, $respondent, 3);

    $this->actingAs($facilitator)->get(route('teams.show', [$team->workspace, $team]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('canCreateSurvey', true)
            ->has('surveys', 2)
            ->where('surveys.0.title', 'Newer')
            ->where('surveys.0.status', 'open')
            ->where('surveys.0.questionCount', 2)
            ->where('surveys.0.responseCount', 1)
            ->where('surveys.0.canManage', true)
            ->where('surveys.0.url', route('surveys.results.show', $newer, absolute: false))
            ->where('surveys.1.id', $older->id)
            ->where('surveys.1.canManage', false)
            ->has('surveyTemplates', 3)
            ->where('surveyTemplates.1.key', 'health_check')
            ->where('surveyTemplates.1.questionCount', 6));
});

it('lists a draft for its editors only, and never a survey attached to a retro', function () {
    $team = Team::factory()->create();
    $draft = TeamSurvey::factory()->create(['team_id' => $team->id]);
    [$facilitator] = surveyFacilitator($draft);
    TeamSurvey::factory()->attachedTo(Retro::factory()->for($team)->create())->open()->create();
    $member = teamMember($team);

    $this->actingAs($facilitator)->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->has('surveys', 1)->where('surveys.0.url', route('surveys.edit', $draft, absolute: false)));
    $this->actingAs(workspaceManager($team->workspace))->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->has('surveys', 1));
    $this->actingAs($member)->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->has('surveys', 0));
});

it('does not grow the number of queries with the number of surveys', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    TeamSurvey::factory()->open()->create(['team_id' => $team->id]);
    warmInstanceSettings();

    DB::enableQueryLog();
    $this->actingAs($member)->get(route('teams.show', [$team->workspace, $team]))->assertOk();
    $withOne = count(DB::getQueryLog());
    DB::flushQueryLog();

    TeamSurvey::factory()->count(4)->open()->create(['team_id' => $team->id]);

    $this->actingAs($member)->get(route('teams.show', [$team->workspace, $team]))->assertOk();

    expect(count(DB::getQueryLog()))->toBe($withOne);
});
```

Add `use Illuminate\Support\Facades\DB;` at the top of the file.

- [ ] **Step 2: Run it and see it fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/TeamSurveysSectionTest.php`
Expected: FAIL, the prop `surveys` is missing.

- [ ] **Step 3: Implementation**

`app/Actions/TeamSurveys/PresentTeamSurveySummary.php`:

```php
<?php

namespace App\Actions\TeamSurveys;

use App\Enums\TeamSurveyStatus;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PresentTeamSurveySummary
{
    /**
     * @param  HasMany<TeamSurvey, Team>  $surveys
     * @return HasMany<TeamSurvey, Team>
     */
    public static function withCounts(HasMany $surveys): HasMany
    {
        return $surveys
            ->with('facilitator.user')
            ->withCount([
                'questions',
                'respondents as responses_count' => fn (Builder $respondents) => $respondents->whereHas('answers'),
            ]);
    }

    /**
     * @return array{id: string, title: string, status: string, template: ?string, questionCount: int, responseCount: int, updatedAt: ?string, closedAt: ?string, facilitatorName: ?string, canManage: bool, url: string}
     */
    public function handle(TeamSurvey $survey, User $viewer, bool $viewerManagesWorkspace): array
    {
        $canManage = $viewerManagesWorkspace || $survey->facilitator?->user_id === $viewer->id;

        return [
            'id' => $survey->id,
            'title' => $survey->title,
            'status' => $survey->status->value,
            'template' => $survey->template?->value,
            'questionCount' => (int) $survey->getAttribute('questions_count'),
            'responseCount' => (int) $survey->getAttribute('responses_count'),
            'updatedAt' => $survey->updated_at?->toIso8601String(),
            'closedAt' => $survey->closed_at?->toIso8601String(),
            'facilitatorName' => $survey->facilitator?->displayName(),
            'canManage' => $canManage,
            'url' => $survey->status === TeamSurveyStatus::Draft
                ? route('surveys.edit', $survey, absolute: false)
                : route('surveys.results.show', $survey, absolute: false),
        ];
    }
}
```

`withCounts` copies `PresentPokerGameSummary::withCounts`; read it and keep the same generic annotation style if PHPStan asks for another.

In `TeamsController`, inject `PresentTeamSurveySummary $presentTeamSurveySummary` in the constructor and `SurveyTemplateCatalogue $surveyTemplateCatalogue` in `show`, and add to the props, after the whiteboard ones:

```php
            'surveys' => PresentTeamSurveySummary::withCounts($team->teamSurveys())
                ->whereNull('retro_id')
                ->latest('updated_at')
                ->orderByDesc('id')
                ->get()
                ->map(fn (TeamSurvey $survey): array => $this->presentTeamSurveySummary->handle($survey, $request->user(), $managesWorkspace))
                ->reject(fn (array $survey): bool => $survey['status'] === TeamSurveyStatus::Draft->value && ! $survey['canManage'])
                ->values(),
            'canCreateSurvey' => $request->user()->can('createSurvey', $team),
            'surveyTemplates' => $surveyTemplateCatalogue->options($team),
```

- [ ] **Step 4: Run the tests on the four engines**

Run, for each of `pgsql`, `mariadb`, `mysql`, `sqlite`: `bin/test-db <engine> -- tests/Feature/TeamSurveys/TeamSurveysSectionTest.php tests/Feature/Teams`
Expected: PASS on each.

- [ ] **Step 5: Commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app tests/Feature/TeamSurveys
git commit -m "feat(team): the team page receives its surveys and the survey templates"
```

---

## Step B — the health data moves (lane H)

Tasks 14 to 16 run their tests on the four engines like every task. Tasks 15 and 16 are merged into the main branch together: between them the board writes team surveys while the summaries still read the old tables, and the front's health components are still on 10. Lane H owns, besides the back end, the front files of the retro's health check (listed in **Lanes**); no other lane touches them before it is merged.

### Task 14: Import of the health checks into team surveys

**Files:**
- Create: `app/Support/Surveys/ImportHealthChecks.php`, `app/Support/Surveys/VerifyHealthCheckImport.php`
- Create: `database/migrations/2026_10_20_100100_copy_health_checks_to_team_surveys.php`
- Create: `app/Console/Commands/ImportHealthChecksCommand.php`, `app/Console/Commands/VerifyHealthCheckImportCommand.php`
- Modify: `tests/Pest.php` (lane H block: fixtures written straight into the old tables)
- Test: `tests/Upgrade/HealthChecksToTeamSurveysTest.php` (the migration itself, on legacy rows), `tests/Feature/TeamSurveys/ImportHealthChecksTest.php` (the class and its commands)

**Interfaces:**
- Consumes: the tables of Task 1, `HealthScale` of Task 2, and the old tables `retro_health_statements`, `health_check_answers`, `retros`, `participants`. No model: the class must keep working after the old models are deleted (Task 29) and on the schema of any later release.
- Produces: `ImportHealthChecks::handle(): array{surveys: int, questions: int, respondents: int, answers: int, skippedAnswers: int}` (what this run created; additive, idempotent, returns zeros when the old tables are gone); `VerifyHealthCheckImport::handle(): array<int, array{retroId: string, title: string, oldAnswers: int, newAnswers: int, oldSum: int, newSum: int}>` (the retros that differ); commands `surveys:import-health-checks`, `surveys:verify-health-import`; test helpers `oldHealthStatements(Retro $retro, array $statements): void`, `oldHealthAnswer(Retro $retro, Participant $participant, string $statement, int $score, string $at = '2026-09-01 10:00:00'): void`, `oldHealthFlag(Retro $retro, bool $enabled, ?string $phase = null): void`, `healthHistory(): array`, `importedSurvey(string $retroId): ?object`.

What is imported (spec §11.3): a retro that has frozen statements and answers; or frozen statements, no answer, the setting on and a phase other than `completed`. The survey is `closed` for a completed retro with the setting on, `open` for an open retro with the setting on, and `draft` (hidden, as the setting hid it) when the setting is off. Each question is required and keeps the scale its answers were given on: **10 when the retro has at least one answer, 5 when it has none**. A respondent is stamped as having sent (`completed_at` = their last answer) only when they answered every frozen statement. Answers to a statement outside the frozen set are counted and left behind. Values are copied as given.

- [ ] **Step 1: Test helpers**

In `tests/Pest.php`, in a block of its own at the end of the file (lane H):

```php
/**
 * Rows of the tables the health check lived in before plan 19, written
 * without the models, which Task 29 deletes.
 *
 * @param  array<int, array{key: string, builtin?: ?string, text?: ?string, label?: ?string}>  $statements
 */
function oldHealthStatements(Retro $retro, array $statements): void
{
    foreach (array_values($statements) as $position => $statement) {
        DB::table('retro_health_statements')->insert([
            'id' => (string) Str::uuid7(),
            'retro_id' => $retro->id,
            'key' => $statement['key'],
            'team_health_statement_id' => null,
            'builtin' => $statement['builtin'] ?? null,
            'text' => $statement['text'] ?? null,
            'label' => $statement['label'] ?? null,
            'position' => $position,
            'created_at' => '2026-08-01 09:00:00',
            'updated_at' => '2026-08-01 09:00:00',
        ]);
    }
}

function oldHealthAnswer(Retro $retro, Participant $participant, string $statement, int $score, string $at = '2026-09-01 10:00:00'): void
{
    DB::table('health_check_answers')->insert([
        'id' => (string) Str::uuid7(),
        'retro_id' => $retro->id,
        'participant_id' => $participant->id,
        'statement' => $statement,
        'score' => $score,
        'created_at' => $at,
        'updated_at' => $at,
    ]);
}

/**
 * Changes only `health_check_enabled` and `phase`, never a source column of
 * the retro's derived search columns (docs/database.md, rule 9).
 */
function oldHealthFlag(Retro $retro, bool $enabled, ?string $phase = null): void
{
    DB::table('retros')->where('id', $retro->id)->update(array_filter([
        'health_check_enabled' => $enabled,
        'phase' => $phase,
    ], fn (mixed $value): bool => $value !== null));
}
```

`healthHistory()` (below, in Step 2) and `importedSurvey()` go in the same block: Task 16 uses them again. Add `use Illuminate\Support\Facades\DB;` and `use Illuminate\Support\Str;` to the imports of `tests/Pest.php` if they are not there.

- [ ] **Step 2: Write the failing tests**

The fixture, in the lane H block of `tests/Pest.php`:

```php
/**
 * One team with the situations of spec §14. Scores are chosen so that every
 * expected value of Tasks 14 and 16 can be checked by hand.
 *
 * @return array<string, mixed>
 */
function healthHistory(): array
{
    $team = Team::factory()->create();
    $custom = (string) Str::uuid7();
    $builtIns = [
        ['key' => 'interaction', 'builtin' => 'interaction'],
        ['key' => 'vision', 'builtin' => 'vision'],
    ];

    $sprint40 = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 40', 'completed_at' => '2026-08-10 10:00:00']);
    oldHealthFlag($sprint40, true);
    oldHealthStatements($sprint40, $builtIns);
    [$alice, $aliceIn40] = retroFacilitator($sprint40);
    oldHealthAnswer($sprint40, $aliceIn40, 'interaction', 5, '2026-08-10 09:00:00');
    oldHealthAnswer($sprint40, $aliceIn40, 'vision', 5, '2026-08-10 09:01:00');

    $sprint41 = Retro::factory()->for($team)->anonymous()->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 41', 'completed_at' => '2026-09-10 10:00:00']);
    oldHealthFlag($sprint41, true);
    oldHealthStatements($sprint41, [...$builtIns, ['key' => $custom, 'text' => 'We ship without fear', 'label' => 'Shipping']]);
    $aliceIn41 = Participant::factory()->create(['retro_id' => $sprint41->id, 'user_id' => $alice->id]);
    $sprint41->forceFill(['facilitator_participant_id' => $aliceIn41->id])->save();
    $guest = Participant::factory()->guest()->create(['retro_id' => $sprint41->id, 'guest_name' => 'Gus']);
    $former = Participant::factory()->create(['retro_id' => $sprint41->id]);
    DB::table('participants')->where('id', $former->id)->update(['user_id' => null]);
    oldHealthAnswer($sprint41, $aliceIn41, 'interaction', 8, '2026-09-10 09:00:00');
    oldHealthAnswer($sprint41, $aliceIn41, 'vision', 6, '2026-09-10 09:01:00');
    oldHealthAnswer($sprint41, $aliceIn41, $custom, 4, '2026-09-10 09:02:00');
    oldHealthAnswer($sprint41, $aliceIn41, 'motivation', 9, '2026-09-10 09:03:00');
    oldHealthAnswer($sprint41, $guest, 'interaction', 6, '2026-09-10 09:04:00');
    oldHealthAnswer($sprint41, $guest, 'vision', 10, '2026-09-10 09:05:00');
    oldHealthAnswer($sprint41, $former, 'interaction', 7, '2026-09-10 09:06:00');

    $inHealthPhase = Retro::factory()->for($team)->create(['title' => 'Sprint 42']);
    oldHealthStatements($inHealthPhase, $builtIns);
    [, $bobIn42] = retroMember($inHealthPhase);
    oldHealthAnswer($inHealthPhase, $bobIn42, 'interaction', 3, '2026-10-01 09:00:00');
    oldHealthFlag($inHealthPhase, true, 'health_check');

    $completedUnanswered = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Unanswered', 'completed_at' => '2026-07-10 10:00:00']);
    oldHealthFlag($completedUnanswered, true);
    oldHealthStatements($completedUnanswered, $builtIns);

    $turnedOff = Retro::factory()->for($team)->create(['title' => 'Turned off']);
    oldHealthFlag($turnedOff, false);
    oldHealthStatements($turnedOff, $builtIns);
    [, $carolInTurnedOff] = retroMember($turnedOff);
    oldHealthAnswer($turnedOff, $carolInTurnedOff, 'vision', 2);

    $openUnanswered = Retro::factory()->for($team)->create(['title' => 'Open, unanswered']);
    oldHealthFlag($openUnanswered, true);
    oldHealthStatements($openUnanswered, $builtIns);

    $never = Retro::factory()->for($team)->create(['title' => 'Never had one']);

    return compact('team', 'custom', 'sprint40', 'sprint41', 'inHealthPhase', 'completedUnanswered', 'turnedOff', 'openUnanswered', 'never', 'alice', 'aliceIn41', 'guest', 'former', 'bobIn42');
}

function importedSurvey(string $retroId): ?object
{
    return DB::table('team_surveys')->where('retro_id', $retroId)->where('template', 'health_check')->first();
}
```

The retro left in the `health_check` phase is used as built in memory and never reloaded through Eloquent: once Task 27 removes the enum case, it cannot be.

`tests/Feature/TeamSurveys/ImportHealthChecksTest.php`:

```php
<?php

use App\Models\Participant;
use App\Models\User;
use App\Support\Surveys\ImportHealthChecks;
use App\Support\Surveys\VerifyHealthCheckImport;
use Illuminate\Support\Facades\DB;

it('copies each health check into a survey attached to its retro, values and scale as given', function () {
    $history = healthHistory();

    $report = resolve(ImportHealthChecks::class)->handle();

    expect($report)->toBe(['surveys' => 5, 'questions' => 11, 'respondents' => 6, 'answers' => 10, 'skippedAnswers' => 1]);

    $survey = importedSurvey($history['sprint41']->id);

    expect($survey)
        ->team_id->toBe($history['team']->id)
        ->title->toBe('Sprint 41')
        ->status->toBe('closed')
        ->and((int) $survey->results_threshold)->toBe(0)
        ->and((bool) $survey->guest_access_enabled)->toBeFalse()
        ->and((bool) $survey->one_question_at_a_time)->toBeFalse()
        ->and((bool) $survey->show_results_after_answer)->toBeFalse()
        ->and(strlen($survey->guest_token))->toBe(40)
        ->and(substr((string) $survey->closed_at, 0, 19))->toBe('2026-09-10 10:00:00')
        ->and(substr((string) $survey->opened_at, 0, 19))->toBe('2026-09-10 09:00:00');

    $questions = DB::table('team_survey_questions')->where('team_survey_id', $survey->id)->orderBy('position')->orderBy('id')->get();

    expect($questions->pluck('match_key')->all())->toBe(['interaction', 'vision', $history['custom']])
        ->and($questions->pluck('builtin')->all())->toBe(['interaction', 'vision', null])
        ->and($questions->pluck('kind')->unique()->values()->all())->toBe(['scale'])
        ->and($questions->map(fn (object $question): int => (int) $question->scale_max)->unique()->values()->all())->toBe([10])
        ->and($questions->map(fn (object $question): bool => (bool) $question->is_required)->unique()->values()->all())->toBe([true])
        ->and($questions[0]->label)->toBe('Interaction with colleagues was productive')
        ->and($questions[2]->label)->toBe('We ship without fear')
        ->and($questions[2]->short_label)->toBe('Shipping');
});

it('asks a health check nobody answered on the new scale of five', function () {
    $history = healthHistory();

    resolve(ImportHealthChecks::class)->handle();

    $scales = fn (string $retroId): array => DB::table('team_survey_questions')
        ->where('team_survey_id', importedSurvey($retroId)->id)
        ->pluck('scale_max')
        ->map(fn (mixed $max): int => (int) $max)
        ->unique()
        ->values()
        ->all();

    expect($scales($history['openUnanswered']->id))->toBe([5])
        ->and($scales($history['inHealthPhase']->id))->toBe([10])
        ->and($scales($history['turnedOff']->id))->toBe([10]);
});

it('keeps who answered what, and stamps as sent only who answered every statement', function () {
    $history = healthHistory();

    resolve(ImportHealthChecks::class)->handle();

    $survey = importedSurvey($history['sprint41']->id);
    $respondents = DB::table('team_survey_respondents')->where('team_survey_id', $survey->id)->get()->keyBy('participant_id');
    $questions = DB::table('team_survey_questions')->where('team_survey_id', $survey->id)->pluck('id', 'match_key');
    $value = fn (string $participantId, string $key) => DB::table('team_survey_answers')
        ->where('team_survey_respondent_id', $respondents[$participantId]->id)
        ->where('team_survey_question_id', $questions[$key])
        ->value('value');

    expect($respondents)->toHaveCount(3)
        ->and($respondents[$history['aliceIn41']->id]->user_id)->toBe($history['alice']->id)
        ->and($respondents[$history['guest']->id]->guest_name)->toBe('Gus')
        ->and($respondents[$history['guest']->id]->guest_secret_hash)->toBeNull()
        ->and($respondents[$history['former']->id]->user_id)->toBeNull()
        ->and($respondents[$history['former']->id]->guest_name)->toBeNull()
        ->and($survey->facilitator_respondent_id)->toBe($respondents[$history['aliceIn41']->id]->id)
        ->and($survey->created_by_user_id)->toBe($history['alice']->id)
        ->and((int) $value($history['aliceIn41']->id, 'interaction'))->toBe(8)
        ->and((int) $value($history['aliceIn41']->id, $history['custom']))->toBe(4)
        ->and((int) $value($history['guest']->id, 'vision'))->toBe(10)
        ->and((int) $value($history['former']->id, 'interaction'))->toBe(7)
        ->and(substr((string) $respondents[$history['aliceIn41']->id]->completed_at, 0, 19))->toBe('2026-09-10 09:02:00')
        ->and($respondents[$history['guest']->id]->completed_at)->toBeNull()
        ->and($respondents[$history['former']->id]->completed_at)->toBeNull();
});

it('gives each retro the status its health check had', function () {
    $history = healthHistory();

    resolve(ImportHealthChecks::class)->handle();

    expect(importedSurvey($history['sprint40']->id)->status)->toBe('closed')
        ->and(importedSurvey($history['inHealthPhase']->id)->status)->toBe('open')
        ->and(importedSurvey($history['openUnanswered']->id)->status)->toBe('open')
        ->and(importedSurvey($history['turnedOff']->id)->status)->toBe('draft')
        ->and(importedSurvey($history['completedUnanswered']->id))->toBeNull()
        ->and(importedSurvey($history['never']->id))->toBeNull();
});

it('gives answers a random id', function () {
    healthHistory();

    resolve(ImportHealthChecks::class)->handle();

    expect(DB::table('team_survey_answers')->pluck('id')->every(fn (string $id): bool => $id[14] === '4'))->toBeTrue();
});

it('changes nothing when it runs a second time', function () {
    healthHistory();
    $import = resolve(ImportHealthChecks::class);
    $import->handle();
    $counts = fn (): array => array_map(fn (string $table): int => DB::table($table)->count(), [
        'team_surveys', 'team_survey_questions', 'team_survey_respondents', 'team_survey_answers',
    ]);
    $before = $counts();

    expect($import->handle())->toBe(['surveys' => 0, 'questions' => 0, 'respondents' => 0, 'answers' => 0, 'skippedAnswers' => 1])
        ->and($counts())->toBe($before);
});

it('brings an answer written to the old tables after the first run, on the scale it was given', function () {
    $history = healthHistory();
    $import = resolve(ImportHealthChecks::class);
    $import->handle();

    $late = Participant::factory()->create(['retro_id' => $history['inHealthPhase']->id, 'user_id' => User::factory()]);
    oldHealthAnswer($history['inHealthPhase'], $late, 'vision', 9, '2026-10-01 09:30:00');
    $first = Participant::factory()->create(['retro_id' => $history['openUnanswered']->id, 'user_id' => User::factory()]);
    oldHealthAnswer($history['openUnanswered'], $first, 'vision', 7, '2026-10-01 09:40:00');

    expect($import->handle())->toMatchArray(['surveys' => 0, 'questions' => 0, 'respondents' => 2, 'answers' => 2])
        ->and(DB::table('team_survey_questions')->where('team_survey_id', importedSurvey($history['openUnanswered']->id)->id)->pluck('scale_max')->map(fn (mixed $max): int => (int) $max)->unique()->values()->all())->toBe([10]);
});

it('leaves the old tables as they were', function () {
    healthHistory();
    $statements = DB::table('retro_health_statements')->orderBy('id')->get()->toArray();
    $answers = DB::table('health_check_answers')->orderBy('id')->get()->toArray();

    resolve(ImportHealthChecks::class)->handle();

    expect(DB::table('retro_health_statements')->orderBy('id')->get()->toArray())->toEqual($statements)
        ->and(DB::table('health_check_answers')->orderBy('id')->get()->toArray())->toEqual($answers);
});

it('verifies itself, and tells when a copied answer was altered', function () {
    $history = healthHistory();
    resolve(ImportHealthChecks::class)->handle();

    expect(resolve(VerifyHealthCheckImport::class)->handle())->toBe([]);
    $this->artisan('surveys:verify-health-import')->assertSuccessful();

    $survey = importedSurvey($history['sprint41']->id);
    DB::table('team_survey_answers')
        ->whereIn('team_survey_question_id', DB::table('team_survey_questions')->where('team_survey_id', $survey->id)->select('id'))
        ->where('value', 10)
        ->update(['value' => 1]);

    $differences = resolve(VerifyHealthCheckImport::class)->handle();

    expect($differences)->toHaveCount(1)
        ->and($differences[0])->toMatchArray(['retroId' => $history['sprint41']->id, 'oldAnswers' => 6, 'newAnswers' => 6, 'oldSum' => 41, 'newSum' => 32]);
    $this->artisan('surveys:verify-health-import')->assertFailed();
});

it('reports what the command imported', function () {
    healthHistory();

    $this->artisan('surveys:import-health-checks')
        ->expectsOutputToContain('Created 5 surveys')
        ->assertSuccessful();
});
```

The numbers of the first test, by hand. Surveys: Sprint 40, Sprint 41, Sprint 42, "Turned off", "Open, unanswered" = 5. Questions: 2 + 3 + 2 + 2 + 2 = 11. Respondents (every participant who answered, plus the facilitator when the retro has one): 1 + 3 + 1 + 1 + 0 = 6. Answers: 2 + 6 + 1 + 1 + 0 = 10. Skipped: the `motivation` answer of Sprint 41 = 1. Sum of the six copied scores of Sprint 41: 8 + 6 + 4 + 6 + 10 + 7 = 41. Alice answered the three frozen statements of Sprint 41 (her `motivation` answer is outside them), her last at 09:02; Gus answered two, the former member one.

`tests/Upgrade/HealthChecksToTeamSurveysTest.php` — the migration itself, on rows written with `DB::table()` at the schema of the migration before it, in the pattern of `tests/Upgrade/GamePointsWeekStartBackfillTest.php`:

```php
<?php

use App\Support\Surveys\ImportHealthChecks;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

const HealthImportMigration = '2026_10_20_100100_copy_health_checks_to_team_surveys.php';

/** @param array<string, mixed> $values */
function rowBeforeHealthImport(string $table, array $values): string
{
    $id = (string) Str::uuid7();

    DB::table($table)->insert(['id' => $id, 'created_at' => '2026-09-01 09:00:00', 'updated_at' => '2026-09-01 09:00:00', ...$values]);

    return $id;
}

it('copies the health checks of an existing install into team surveys by running the migration itself', function () {
    $earlier = collect(glob(database_path('migrations/*.php')))
        ->filter(fn (string $path): bool => basename($path) < HealthImportMigration)
        ->values()
        ->all();

    Artisan::call('migrate:fresh', ['--path' => $earlier, '--realpath' => true]);

    $workspace = rowBeforeHealthImport('workspaces', ['name' => 'Acme', 'slug' => 'acme']);
    $team = rowBeforeHealthImport('teams', ['workspace_id' => $workspace, 'name' => 'Platform']);
    $ada = rowBeforeHealthImport('users', ['name' => 'Ada', 'email' => 'ada@example.test', 'email_key' => 'ada@example.test', 'password' => 'secret']);
    $retro = fn (string $title, string $phase, ?string $completedAt): string => rowBeforeHealthImport('retros', [
        'team_id' => $team,
        'title' => $title,
        'template' => 'start_stop_continue',
        'guest_token' => Str::random(40),
        'phase' => $phase,
        'health_check_enabled' => true,
        'completed_at' => $completedAt,
    ]);
    $closed = $retro('Sprint 41', 'completed', '2026-09-10 10:00:00');
    $open = $retro('Sprint 42', 'health_check', null);
    $member = rowBeforeHealthImport('participants', ['retro_id' => $closed, 'user_id' => $ada]);
    $guest = rowBeforeHealthImport('participants', ['retro_id' => $closed, 'guest_name' => 'Gus']);
    $custom = (string) Str::uuid7();

    foreach ([[$closed, 'vision', 'vision', null, null], [$closed, $custom, null, 'We ship without fear', 'Shipping'], [$open, 'vision', 'vision', null, null]] as $position => [$retroId, $key, $builtin, $text, $label]) {
        rowBeforeHealthImport('retro_health_statements', ['retro_id' => $retroId, 'key' => $key, 'builtin' => $builtin, 'text' => $text, 'label' => $label, 'position' => $position]);
    }

    rowBeforeHealthImport('health_check_answers', ['retro_id' => $closed, 'participant_id' => $member, 'statement' => 'vision', 'score' => 8]);
    rowBeforeHealthImport('health_check_answers', ['retro_id' => $closed, 'participant_id' => $member, 'statement' => $custom, 'score' => 3]);
    rowBeforeHealthImport('health_check_answers', ['retro_id' => $closed, 'participant_id' => $guest, 'statement' => 'vision', 'score' => 10]);
    rowBeforeHealthImport('health_check_answers', ['retro_id' => $closed, 'participant_id' => $guest, 'statement' => 'motivation', 'score' => 1]);

    $oldAnswers = DB::table('health_check_answers')->orderBy('id')->get()->toArray();

    Artisan::call('migrate', ['--path' => [database_path('migrations/'.HealthImportMigration)], '--realpath' => true]);

    $closedSurvey = DB::table('team_surveys')->where('retro_id', $closed)->sole();
    $openSurvey = DB::table('team_surveys')->where('retro_id', $open)->sole();
    $values = DB::table('team_survey_answers')
        ->whereIn('team_survey_question_id', DB::table('team_survey_questions')->where('team_survey_id', $closedSurvey->id)->select('id'))
        ->pluck('value')
        ->map(fn (mixed $value): int => (int) $value)
        ->sort()
        ->values()
        ->all();

    expect($closedSurvey->status)->toBe('closed')
        ->and($openSurvey->status)->toBe('open')
        ->and($values)->toBe([3, 8, 10])
        ->and(DB::table('team_survey_questions')->where('team_survey_id', $closedSurvey->id)->pluck('scale_max')->map(fn (mixed $max): int => (int) $max)->unique()->values()->all())->toBe([10])
        ->and(DB::table('team_survey_questions')->where('team_survey_id', $openSurvey->id)->pluck('scale_max')->map(fn (mixed $max): int => (int) $max)->unique()->values()->all())->toBe([5])
        ->and(DB::table('team_survey_respondents')->where('team_survey_id', $closedSurvey->id)->whereNotNull('completed_at')->count())->toBe(1)
        ->and(DB::table('health_check_answers')->orderBy('id')->get()->toArray())->toEqual($oldAnswers)
        ->and(resolve(ImportHealthChecks::class)->handle())->toMatchArray(['surveys' => 0, 'questions' => 0, 'respondents' => 0, 'answers' => 0]);
});
```

Check the column list of `retros`, `participants`, `retro_health_statements` and `health_check_answers` at that point of the migrations before writing the rows (a column without a default must be given); `users.email_key` is required since the portability work.

- [ ] **Step 3: Run them and see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/ImportHealthChecksTest.php tests/Upgrade/HealthChecksToTeamSurveysTest.php`
Expected: FAIL, `Class "App\Support\Surveys\ImportHealthChecks" not found`.

- [ ] **Step 4: The import**

`app/Support/Surveys/ImportHealthChecks.php`:

```php
<?php

namespace App\Support\Surveys;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use stdClass;

/**
 * Copies the health checks of before plan 19 into team surveys. Written on
 * the standard query builder alone: it runs from a migration and must not
 * depend on models that change or disappear. It only adds rows, copies
 * scores as they were given, and can run again.
 */
class ImportHealthChecks
{
    private const string Template = 'health_check';

    /**
     * The label stored for a built-in statement is a fallback; readers
     * translate from the `builtin` column.
     */
    private const array BuiltinTexts = [
        'interaction' => 'Interaction with colleagues was productive',
        'task_clarity' => 'Tasks assigned to me were clear',
        'manager_support' => 'My manager was understanding and supportive',
        'vision' => 'The vision and goals are clear to me',
        'processes' => 'Our processes let me work without blockers',
        'motivation' => 'I felt motivated in my work',
    ];

    /**
     * @return array{surveys: int, questions: int, respondents: int, answers: int, skippedAnswers: int}
     */
    public function handle(): array
    {
        $report = ['surveys' => 0, 'questions' => 0, 'respondents' => 0, 'answers' => 0, 'skippedAnswers' => 0];

        if (! Schema::hasTable('retro_health_statements') || ! Schema::hasTable('health_check_answers')) {
            return $report;
        }

        DB::table('retros')
            ->whereIn('id', DB::table('retro_health_statements')->select('retro_id'))
            ->chunkById(100, function (Collection $retros) use (&$report): void {
                foreach ($retros as $retro) {
                    DB::transaction(function () use ($retro, &$report): void {
                        $this->importRetro($retro, $report);
                    });
                }
            });

        return $report;
    }

    /**
     * @param  array{surveys: int, questions: int, respondents: int, answers: int, skippedAnswers: int}  $report
     */
    private function importRetro(stdClass $retro, array &$report): void
    {
        $statements = DB::table('retro_health_statements')->where('retro_id', $retro->id)->orderBy('position')->orderBy('id')->get();
        $answers = DB::table('health_check_answers')->where('retro_id', $retro->id)->orderBy('created_at')->orderBy('id')->get();
        $isCompleted = $retro->phase === 'completed';
        $isEnabled = (bool) $retro->health_check_enabled;

        if ($answers->isEmpty() && ($isCompleted || ! $isEnabled)) {
            return;
        }

        $scaleMax = $answers->isEmpty() ? HealthScale::Max : HealthScale::LegacyMax;
        $surveyId = $this->surveyId($retro, $answers, $this->status($isEnabled, $isCompleted), $report);
        $questionIds = $this->questionIds($surveyId, $statements, $scaleMax, $report);
        $respondentIds = $this->respondentIds($surveyId, $retro, $answers, $report);

        $this->copyAnswers($answers, $questionIds, $respondentIds, $report);
        $this->stampRespondents($answers, $questionIds, $respondentIds);
        $this->nameFacilitator($surveyId, $retro, $respondentIds);
    }

    private function status(bool $isEnabled, bool $isCompleted): string
    {
        if (! $isEnabled) {
            return 'draft';
        }

        return $isCompleted ? 'closed' : 'open';
    }

    /**
     * @param  Collection<int, stdClass>  $answers
     * @param  array{surveys: int, questions: int, respondents: int, answers: int, skippedAnswers: int}  $report
     */
    private function surveyId(stdClass $retro, Collection $answers, string $status, array &$report): string
    {
        $existing = DB::table('team_surveys')->where('retro_id', $retro->id)->where('template', self::Template)->orderBy('created_at')->orderBy('id')->value('id');

        if ($existing !== null) {
            return (string) $existing;
        }

        $id = (string) Str::uuid7();

        DB::table('team_surveys')->insert([
            'id' => $id,
            'team_id' => $retro->team_id,
            'retro_id' => $retro->id,
            'title' => mb_substr((string) $retro->title, 0, 120),
            'template' => self::Template,
            'status' => $status,
            'guest_access_enabled' => false,
            'guest_token' => Str::random(40),
            'one_question_at_a_time' => false,
            'show_results_after_answer' => false,
            'results_threshold' => 0,
            'version' => 1,
            'opened_at' => $answers->min('created_at') ?? $retro->created_at,
            'closed_at' => $status === 'closed' ? ($retro->completed_at ?? $retro->updated_at) : null,
            'created_at' => $retro->created_at,
            'updated_at' => now(),
        ]);

        $report['surveys']++;

        return $id;
    }

    /**
     * A question takes the scale its answers were given on. One created on
     * five by an earlier run, when its retro had no answer yet, moves to ten
     * when old answers arrive, as long as nobody answered it on five.
     *
     * @param  Collection<int, stdClass>  $statements
     * @param  array{surveys: int, questions: int, respondents: int, answers: int, skippedAnswers: int}  $report
     * @return array<string, string> question id by statement key
     */
    private function questionIds(string $surveyId, Collection $statements, int $scaleMax, array &$report): array
    {
        $ids = DB::table('team_survey_questions')->where('team_survey_id', $surveyId)->pluck('id', 'match_key')->all();

        if ($scaleMax === HealthScale::LegacyMax && $ids !== []) {
            DB::table('team_survey_questions')
                ->whereIn('id', array_values($ids))
                ->where('scale_max', '!=', HealthScale::LegacyMax)
                ->whereNotIn('id', DB::table('team_survey_answers')->select('team_survey_question_id'))
                ->update(['scale_max' => HealthScale::LegacyMax]);
        }

        foreach ($statements as $statement) {
            if (isset($ids[$statement->key])) {
                continue;
            }

            $id = (string) Str::uuid7();

            DB::table('team_survey_questions')->insert([
                'id' => $id,
                'team_survey_id' => $surveyId,
                'kind' => 'scale',
                'label' => mb_substr((string) ($statement->text ?? self::BuiltinTexts[$statement->builtin] ?? $statement->key), 0, 200),
                'short_label' => $statement->label,
                'builtin' => $statement->builtin,
                'match_key' => $statement->key,
                'position' => (int) $statement->position,
                'is_required' => true,
                'allows_comment' => false,
                'scale_max' => $scaleMax,
                'created_at' => $statement->created_at,
                'updated_at' => now(),
            ]);

            $ids[$statement->key] = $id;
            $report['questions']++;
        }

        return $ids;
    }

    /**
     * One respondent per participant who answered, and one for the
     * facilitator. A respondent the application already created for the
     * same user is reused.
     *
     * @param  Collection<int, stdClass>  $answers
     * @param  array{surveys: int, questions: int, respondents: int, answers: int, skippedAnswers: int}  $report
     * @return array<string, string> respondent id by participant id
     */
    private function respondentIds(string $surveyId, stdClass $retro, Collection $answers, array &$report): array
    {
        $participantIds = $answers->pluck('participant_id')
            ->push($retro->facilitator_participant_id)
            ->filter()
            ->unique()
            ->values();

        $participants = DB::table('participants')->whereIn('id', $participantIds)->get()->keyBy('id');
        $existing = DB::table('team_survey_respondents')->where('team_survey_id', $surveyId)->get();
        $ids = $existing->whereNotNull('participant_id')->pluck('id', 'participant_id')->all();
        $byUser = $existing->whereNotNull('user_id')->pluck('id', 'user_id')->all();

        foreach ($participantIds as $participantId) {
            $participant = $participants->get($participantId);

            if ($participant === null || isset($ids[$participantId])) {
                continue;
            }

            if ($participant->user_id !== null && isset($byUser[$participant->user_id])) {
                DB::table('team_survey_respondents')->where('id', $byUser[$participant->user_id])->update(['participant_id' => $participantId]);
                $ids[$participantId] = (string) $byUser[$participant->user_id];

                continue;
            }

            $id = (string) Str::uuid7();

            DB::table('team_survey_respondents')->insert([
                'id' => $id,
                'team_survey_id' => $surveyId,
                'user_id' => $participant->user_id,
                'participant_id' => $participantId,
                'guest_name' => $participant->guest_name,
                'guest_secret_hash' => null,
                'created_at' => $participant->created_at,
                'updated_at' => now(),
            ]);

            $ids[$participantId] = $id;
            $report['respondents']++;
        }

        return $ids;
    }

    /**
     * An answer already copied is left as it is; an answer to a statement
     * outside the frozen set is counted and left behind, as every reader
     * ignored it. The score is copied as it was given.
     *
     * @param  Collection<int, stdClass>  $answers
     * @param  array<string, string>  $questionIds
     * @param  array<string, string>  $respondentIds
     * @param  array{surveys: int, questions: int, respondents: int, answers: int, skippedAnswers: int}  $report
     */
    private function copyAnswers(Collection $answers, array $questionIds, array $respondentIds, array &$report): void
    {
        $copied = DB::table('team_survey_answers')
            ->whereIn('team_survey_question_id', array_values($questionIds))
            ->get(['team_survey_question_id', 'team_survey_respondent_id'])
            ->mapWithKeys(fn (stdClass $row): array => ["{$row->team_survey_question_id}|{$row->team_survey_respondent_id}" => true])
            ->all();

        $rows = [];

        foreach ($answers as $answer) {
            $questionId = $questionIds[$answer->statement] ?? null;
            $respondentId = $respondentIds[$answer->participant_id] ?? null;

            if ($questionId === null || $respondentId === null) {
                $report['skippedAnswers']++;

                continue;
            }

            if (isset($copied["{$questionId}|{$respondentId}"])) {
                continue;
            }

            $copied["{$questionId}|{$respondentId}"] = true;

            $rows[] = [
                'id' => (string) Str::uuid(),
                'team_survey_question_id' => $questionId,
                'team_survey_respondent_id' => $respondentId,
                'value' => (int) $answer->score,
                'created_at' => $answer->created_at,
                'updated_at' => $answer->updated_at,
            ];
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('team_survey_answers')->insert($chunk);
        }

        $report['answers'] += count($rows);
    }

    /**
     * A participant who answered every statement has sent their answers:
     * the time of their last answer stands for it. Someone who answered part
     * of an open health check can still send the rest.
     *
     * @param  Collection<int, stdClass>  $answers
     * @param  array<string, string>  $questionIds
     * @param  array<string, string>  $respondentIds
     */
    private function stampRespondents(Collection $answers, array $questionIds, array $respondentIds): void
    {
        $answers
            ->filter(fn (stdClass $answer): bool => isset($questionIds[$answer->statement], $respondentIds[$answer->participant_id]))
            ->groupBy('participant_id')
            ->filter(fn (Collection $own): bool => $own->pluck('statement')->unique()->count() === count($questionIds))
            ->each(function (Collection $own, string $participantId) use ($respondentIds): void {
                DB::table('team_survey_respondents')
                    ->where('id', $respondentIds[$participantId])
                    ->whereNull('completed_at')
                    ->update(['completed_at' => $own->max('updated_at')]);
            });
    }

    /**
     * @param  array<string, string>  $respondentIds
     */
    private function nameFacilitator(string $surveyId, stdClass $retro, array $respondentIds): void
    {
        $respondentId = $respondentIds[$retro->facilitator_participant_id] ?? null;

        if ($respondentId === null) {
            return;
        }

        DB::table('team_surveys')
            ->where('id', $surveyId)
            ->whereNull('facilitator_respondent_id')
            ->update([
                'facilitator_respondent_id' => $respondentId,
                'created_by_user_id' => DB::table('team_survey_respondents')->where('id', $respondentId)->value('user_id'),
            ]);
    }
}
```

The writes go past the models on purpose (the models change in later tasks and the old ones are deleted in Task 29); the five tables written have no derived column (rule 9).

`app/Support/Surveys/VerifyHealthCheckImport.php`:

```php
<?php

namespace App\Support\Surveys;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use stdClass;

class VerifyHealthCheckImport
{
    /**
     * The retros whose copied answers differ from the old ones, counting
     * only answers to a statement of the retro's frozen set. Raw values on
     * both sides: the health scale of spec §11.9 is applied on read only.
     *
     * @return array<int, array{retroId: string, title: string, oldAnswers: int, newAnswers: int, oldSum: int, newSum: int}>
     */
    public function handle(): array
    {
        if (! Schema::hasTable('retro_health_statements') || ! Schema::hasTable('health_check_answers')) {
            return [];
        }

        $differences = [];

        DB::table('retros')
            ->whereIn('id', DB::table('health_check_answers')->select('retro_id'))
            ->chunkById(100, function (Collection $retros) use (&$differences): void {
                foreach ($retros as $retro) {
                    $difference = $this->compare($retro);

                    if ($difference !== null) {
                        $differences[] = $difference;
                    }
                }
            });

        return $differences;
    }

    /**
     * @return array{retroId: string, title: string, oldAnswers: int, newAnswers: int, oldSum: int, newSum: int}|null
     */
    private function compare(stdClass $retro): ?array
    {
        $keys = DB::table('retro_health_statements')->where('retro_id', $retro->id)->pluck('key');

        $old = DB::table('health_check_answers')->where('retro_id', $retro->id)->whereIn('statement', $keys)->pluck('score');

        $new = DB::table('team_survey_answers')
            ->whereIn('team_survey_question_id', DB::table('team_survey_questions')
                ->whereIn('team_survey_id', DB::table('team_surveys')->where('retro_id', $retro->id)->where('template', 'health_check')->select('id'))
                ->select('id'))
            ->pluck('value');

        $row = [
            'retroId' => (string) $retro->id,
            'title' => (string) $retro->title,
            'oldAnswers' => $old->count(),
            'newAnswers' => $new->count(),
            'oldSum' => (int) $old->sum(fn (mixed $score): int => (int) $score),
            'newSum' => (int) $new->sum(fn (mixed $value): int => (int) $value),
        ];

        if ($row['oldAnswers'] === $row['newAnswers'] && $row['oldSum'] === $row['newSum']) {
            return null;
        }

        return $row;
    }
}
```

The verification compares the copy with the old tables only while the old tables are the source, that is until Task 15 is merged; after it, new answers exist only in the new tables and the command reports them as extra answers. Its help text says so, and the release note asks to run it right after the upgrade's migrations, before the application is opened.

`database/migrations/2026_10_20_100100_copy_health_checks_to_team_surveys.php`:

```php
<?php

use App\Support\Surveys\ImportHealthChecks;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * The import commits retro by retro, so that a run stopped on a large
     * instance can be started again (docs/database.md, "Upgrading").
     */
    public $withinTransaction = false;

    public function up(): void
    {
        resolve(ImportHealthChecks::class)->handle();
    }
};
```

`app/Console/Commands/ImportHealthChecksCommand.php`:

```php
<?php

namespace App\Console\Commands;

use App\Support\Surveys\ImportHealthChecks;
use Illuminate\Console\Command;

class ImportHealthChecksCommand extends Command
{
    protected $signature = 'surveys:import-health-checks';

    protected $description = 'Copy the health checks of before plan 19 into team surveys (adds what is missing, changes nothing else)';

    public function handle(ImportHealthChecks $importHealthChecks): int
    {
        $this->info('Importing health checks…');

        $report = $importHealthChecks->handle();

        $this->comment("Created {$report['surveys']} surveys, {$report['questions']} questions, {$report['respondents']} respondents and {$report['answers']} answers.");
        $this->comment("Left behind {$report['skippedAnswers']} answers to statements outside their retro's set.");

        return self::SUCCESS;
    }
}
```

`app/Console/Commands/VerifyHealthCheckImportCommand.php`:

```php
<?php

namespace App\Console\Commands;

use App\Support\Surveys\VerifyHealthCheckImport;
use Illuminate\Console\Command;

class VerifyHealthCheckImportCommand extends Command
{
    protected $signature = 'surveys:verify-health-import';

    protected $description = 'Compare the copied health-check answers with the old tables. Run it right after the upgrade, before new answers are given.';

    public function handle(VerifyHealthCheckImport $verifyHealthCheckImport): int
    {
        $this->info('Comparing old and copied health-check answers…');

        $differences = $verifyHealthCheckImport->handle();

        if ($differences === []) {
            $this->comment('All ok: every retro has the same answers on both sides.');

            return self::SUCCESS;
        }

        $this->table(['Retro', 'Title', 'Old answers', 'Copied', 'Old sum', 'Copied sum'], array_map('array_values', $differences));
        $this->error(count($differences).' retros differ.');

        return self::FAILURE;
    }
}
```

- [ ] **Step 5: Run the tests on the four engines**

Run, for each of `pgsql`, `mariadb`, `mysql`, `sqlite`: `bin/test-db <engine> -- tests/Feature/TeamSurveys/ImportHealthChecksTest.php tests/Upgrade/HealthChecksToTeamSurveysTest.php tests/Arch`
Expected: PASS on each. Also run the import against a copy of a real database if the owner provides one, and attach the two commands' output to the report.

- [ ] **Step 6: Commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app database tests
git commit -m "feat(health): additive, repeatable import of health checks into team surveys, scores as given, with a verification command"
```

### Task 15: The retro's health check lives in a team survey — attach, send, close, board

**Files:**
- Create: `app/Actions/HealthCheck/HealthCheckSurvey.php`, `AttachHealthCheck.php`, `CloseAttachedSurveys.php`; `app/Actions/TeamSurveys/RespondentForParticipant.php`
- Create: `app/Http/Controllers/Retros/RetroHealthChecksController.php`, `RetroHealthCheckClosuresController.php`, `RetroHealthCheckSubmissionsController.php`
- Delete: `app/Http/Controllers/Retros/HealthCheckAnswersController.php` (and the routes `retros.health-check.update|destroy`)
- Rewrite: `app/Actions/HealthCheck/PresentHealthProgress.php`, `PresentHealthCheck.php`, `app/Events/Retros/HealthAnswered.php`
- Modify: `app/Actions/HealthCheck/ManageTeamHealthStatements.php`, `app/Actions/Retros/CreateRetro.php`, `ChangeRetroPhase.php`, `BuildBoardSnapshot.php` (`retro.healthCheckStatements`), `app/Http/Controllers/Retros/RetroSettingsController.php`, `database/factories/RetroFactory.php` (`withHealthCheck`), `routes/web.php`, `tests/Pest.php`
- Front (lane H): create `resources/js/components/retro/use-health-check-submission.ts` (+ test); modify `resources/js/components/retro/phase-health.tsx` (+ test), `resources/js/lib/retro/types.ts`, `board-reducer.ts` (+ test), `adapters.ts` (+ test), `resources/js/hooks/use-retro-board.ts`
- Test: `tests/Feature/Retros/AttachedHealthCheckTest.php`, `tests/Concurrency/HealthCheckSubmissionTest.php`; rewritten: `tests/Feature/Retros/HealthCheckTest.php`, `HealthStatementFreezeTest.php`, and the health cases of `CreateRetroTest.php`, `BoardSnapshotTest.php`, `RetroStartTest.php`, `FacilitationTest.php`, `tests/Feature/Teams/TeamHealthStatementsTest.php`

**Interfaces:**
- Consumes: `CreateTeamSurvey`, `NewTeamSurvey`, `SaveSurveyAnswer`, `WriteSurveyQuestions`, `HealthCheckQuestions`, `ChangeTeamSurveyStatus`, `TeamSurveyChanged`, `TeamSurveyDeleted`, `HealthScale`, the existing `RetroSettingsChanged`, `RetroGuard`, `MarkRetroStarted`, `TeamHealthStatements`.
- Produces: `HealthCheckSurvey::forRetro(Retro $retro): ?TeamSurvey` (the one that is not a draft), `::hidden(Retro $retro): ?TeamSurvey` (the draft kept from a health check that was removed); `AttachHealthCheck::handle(Retro $locked): TeamSurvey`; `CloseAttachedSurveys::handle(Retro $locked): void`; `RespondentForParticipant::handle(TeamSurvey $survey, Participant $participant): TeamSurveyRespondent`; `PresentHealthProgress::forSurvey(TeamSurvey $survey, Retro $retro): array{respondents: int, participants: int, statements: array<int, array{key: string, count: int, answeredBy: array<int, string>}>}` and `::handle(Retro $retro): ?array` (the same, for the retro's health check); `PresentHealthCheck::handle(Retro $retro, Participant $viewer): ?array{surveyId: string, isClosed: bool, scale: int, respondents: int, participants: int, hasSubmitted: bool, statements: array<int, array{key: string, label: string, text: string, isBuiltin: bool, myScore: ?int}>}` (Task 16 adds `results`); event `HealthAnswered` (`health.answered`, payload `respondents`, `participants`); routes `retros.healthCheck.store|destroy`, `retros.healthCheck.closure.update|destroy`, `retros.healthCheck.submission.store` (body `scores`); snapshot key `retro.healthCheckStatements: int`; test helpers `attachHealthCheck(Retro $retro): TeamSurvey`, `answerHealthCheck(Retro $retro, Participant $participant, array $scores, int $scaleMax = HealthScale::Max): void`, `closeHealthCheck(Retro $retro): TeamSurvey`; front: `useHealthCheckSubmission()`, reducer actions `health.progress` (`respondents`, `participants`) and `health.submitted` (`scores`, `respondents`, `participants`).

Behaviour kept from today, on purpose: removing a health check hides it and keeps its answers; adding it again brings them back, and rebuilds the statements only when nobody had answered. Behaviour changed (D-102): a participant scores every statement and sends them together; nothing reaches the server or the others before "Submit answers"; sent answers do not change (decision 9).

- [ ] **Step 1: Test helpers**

In the lane H block of `tests/Pest.php`:

```php
function attachHealthCheck(Retro $retro): TeamSurvey
{
    return resolve(AttachHealthCheck::class)->handle($retro);
}

/**
 * Sends the scores of one participant, as "Submit answers" does. A fixture
 * that reproduces an old health check passes the scale of ten: the
 * questions take it while nobody has answered them.
 *
 * @param  array<string, int>  $scores  statement key => score, as given
 */
function answerHealthCheck(Retro $retro, Participant $participant, array $scores, int $scaleMax = HealthScale::Max): void
{
    $survey = resolve(HealthCheckSurvey::class)->forRetro($retro) ?? attachHealthCheck($retro);

    if (! $survey->hasAnswers()) {
        $survey->questions()->update(['scale_max' => $scaleMax]);
    }

    $respondent = resolve(RespondentForParticipant::class)->handle($survey, $participant);
    $questions = $survey->questions()->get()->keyBy('match_key');

    foreach ($scores as $key => $score) {
        answerSurveyQuestion($questions[$key], $respondent, $score);
    }

    $respondent->update(['completed_at' => now()]);
}

/**
 * Closes the health check of a retro at the retro's completion time, as
 * completing the retro does.
 */
function closeHealthCheck(Retro $retro): TeamSurvey
{
    $survey = resolve(HealthCheckSurvey::class)->forRetro($retro);
    $survey->update(['status' => TeamSurveyStatus::Closed, 'closed_at' => $retro->completed_at ?? now()]);

    return $survey;
}
```

- [ ] **Step 2: Write the failing tests**

`tests/Feature/Retros/AttachedHealthCheckTest.php`:

```php
<?php

use App\Actions\HealthCheck\HealthCheckSurvey;
use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Enums\RetroPhase;
use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Events\Retros\HealthAnswered;
use App\Events\Retros\RetroSettingsChanged;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use Illuminate\Support\Facades\Event;

/**
 * @return array<string, int>
 */
function sixScores(int $vision = 4): array
{
    return ['interaction' => 3, 'task_clarity' => 4, 'manager_support' => 5, 'vision' => $vision, 'processes' => 2, 'motivation' => 4];
}

function sendHealthCheck(Retro $retro, array $scores)
{
    return test()->postJson(route('retros.healthCheck.submission.store', $retro), ['scores' => $scores]);
}

it('attaches a health check on five when a retro is created with it', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $this->actingAs($user)->post(route('teams.retros.store', [$team->workspace, $team]), [
        'title' => 'Sprint 42', 'template' => 'start_stop_continue', 'health_check_enabled' => true,
    ])->assertRedirect();

    $retro = Retro::query()->sole();
    $survey = resolve(HealthCheckSurvey::class)->forRetro($retro);

    expect($retro->phase)->toBe(RetroPhase::Writing)
        ->and($survey->template)->toBe(TeamSurveyTemplate::HealthCheck)
        ->and($survey->status)->toBe(TeamSurveyStatus::Open)
        ->and($survey->title)->toBe('Sprint 42')
        ->and($survey->results_threshold)->toBe(0)
        ->and($survey->questions()->count())->toBe(6)
        ->and($survey->questions()->pluck('scale_max')->unique()->values()->all())->toBe([5])
        ->and($survey->questions()->where('is_required', false)->count())->toBe(0)
        ->and($survey->facilitator->participant_id)->toBe($retro->facilitator_participant_id)
        ->and($survey->facilitator->user_id)->toBe($user->id);
});

it('attaches nothing to a retro created without it', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))->post(route('teams.retros.store', [$team->workspace, $team]), [
        'title' => 'Sprint 42', 'template' => 'start_stop_continue',
    ])->assertRedirect();

    expect(TeamSurvey::query()->count())->toBe(0);
});

it('lets the facilitator attach one later, once', function () {
    Event::fake([RetroSettingsChanged::class]);
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$facilitator] = retroFacilitator($retro);
    [$member] = retroMember($retro);

    $this->actingAs($member)->postJson(route('retros.healthCheck.store', $retro))->assertForbidden();
    $this->actingAs($facilitator)->postJson(route('retros.healthCheck.store', $retro))->assertCreated();
    $this->actingAs($facilitator)->postJson(route('retros.healthCheck.store', $retro))
        ->assertUnprocessable()->assertJsonValidationErrors('health_check');

    expect(TeamSurvey::query()->where('retro_id', $retro->id)->count())->toBe(1);
    Event::assertDispatched(RetroSettingsChanged::class);
});

it('refuses to attach one to a completed retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create(['completed_at' => now()]);
    [$facilitator] = retroFacilitator($retro);

    $this->actingAs($facilitator)->postJson(route('retros.healthCheck.store', $retro))->assertForbidden();
});

it('sends every score at once, in any open phase, and tells the others how many have sent', function (RetroPhase $phase) {
    Event::fake([HealthAnswered::class]);
    $retro = Retro::factory()->inPhase($phase)->create();
    [$user, $participant] = retroMember($retro);
    retroMember($retro);
    attachHealthCheck($retro);

    $this->actingAs($user);

    sendHealthCheck($retro, sixScores())
        ->assertOk()
        ->assertJsonPath('respondents', 1)
        ->assertJsonPath('participants', 2)
        ->assertJsonPath('hasSubmitted', true);

    $respondent = resolve(HealthCheckSurvey::class)->forRetro($retro)->respondents()->where('participant_id', $participant->id)->sole();

    expect($respondent->answers()->count())->toBe(6)
        ->and($respondent->completed_at)->not->toBeNull()
        ->and($respondent->user_id)->toBe($user->id);
    Event::assertDispatched(fn (HealthAnswered $event) => $event->broadcastAs() === 'health.answered'
        && $event->broadcastWith() === ['respondents' => 1, 'participants' => 2]);
})->with([RetroPhase::Writing, RetroPhase::Discussing, RetroPhase::Roti]);

it('lets a guest of the retro send their answers', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    attachHealthCheck($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))->withCredentials();

    sendHealthCheck($retro, sixScores())->assertOk();
});

it('refuses a set of scores that is not one score from 1 to 5 per statement', function (Closure $scores, string $field) {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    attachHealthCheck($retro);

    $this->actingAs($user);

    sendHealthCheck($retro, $scores())->assertUnprocessable()->assertJsonValidationErrors($field);

    expect(resolve(HealthCheckSurvey::class)->forRetro($retro)->hasAnswers())->toBeFalse();
})->with([
    'a statement missing' => [fn () => collect(sixScores())->except('vision')->all(), 'scores.vision'],
    'zero' => [fn () => sixScores(vision: 0), 'scores.vision'],
    'six' => [fn () => sixScores(vision: 6), 'scores.vision'],
    'not a number' => [fn () => [...sixScores(), 'vision' => 'seven'], 'scores.vision'],
    'an unknown statement' => [fn () => [...sixScores(), 'not_a_statement' => 3], 'scores'],
]);

it('refuses a second submission of the same participant', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    attachHealthCheck($retro);

    $this->actingAs($user);

    sendHealthCheck($retro, sixScores())->assertOk();
    sendHealthCheck($retro, sixScores(vision: 1))->assertUnprocessable()->assertJsonValidationErrors('health_check');

    expect(resolve(HealthCheckSurvey::class)->forRetro($retro)->questions()->where('match_key', 'vision')->sole()->answers()->sole()->value)->toBe(4);
});

it('answers 404 when the retro has no health check', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $this->actingAs($user);

    sendHealthCheck($retro, sixScores())->assertNotFound();
});

it('refuses answers on a locked board, once closed, and once the retro is completed', function (Closure $arrange, int $status) {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    attachHealthCheck($retro);
    $arrange($retro);

    $this->actingAs($user);

    sendHealthCheck($retro->fresh(), sixScores())->assertStatus($status);
})->with([
    'locked board' => [fn (Retro $retro) => $retro->update(['is_locked' => true]), 423],
    'closed health check' => [fn (Retro $retro) => closeHealthCheck($retro), 422],
    'completed retro' => [fn (Retro $retro) => $retro->update(['phase' => RetroPhase::Completed, 'completed_at' => now()]), 403],
]);

it('stamps the start of the retro with the first submission', function () {
    $retro = Retro::factory()->create(['started_at' => null]);
    [$user] = retroMember($retro);
    attachHealthCheck($retro);

    $this->actingAs($user);

    sendHealthCheck($retro, sixScores())->assertOk();

    expect($retro->fresh()->started_at)->not->toBeNull();
});

it('sends each viewer their own scores and the state of the health check in the board snapshot, and names nobody', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);
    [, $otherParticipant] = retroMember($retro);
    $survey = attachHealthCheck($retro);
    answerHealthCheck($retro, $participant, sixScores(vision: 4));
    answerHealthCheck($retro, $otherParticipant, sixScores(vision: 2));

    $snapshot = $this->actingAs($user)->getJson(route('retros.snapshot.show', $retro))
        ->assertJsonPath('healthCheck.surveyId', $survey->id)
        ->assertJsonPath('healthCheck.isClosed', false)
        ->assertJsonPath('healthCheck.scale', 5)
        ->assertJsonPath('healthCheck.respondents', 2)
        ->assertJsonPath('healthCheck.participants', 2)
        ->assertJsonPath('healthCheck.hasSubmitted', true)
        ->assertJsonPath('healthCheck.statements.3.myScore', 4)
        ->assertJsonPath('healthCheck.statements.3.label', 'Vision')
        ->assertJsonPath('healthCheck.statements.3.isBuiltin', true)
        ->assertJsonPath('retro.healthCheckStatements', 6);

    expect($snapshot->json('healthCheck.statements.3'))->not->toHaveKey('answeredBy');
});

it('leaves the health check out of the snapshot of a retro that has none', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)->getJson(route('retros.snapshot.show', $retro))->assertJsonPath('healthCheck', null);
});

it('closes and reopens from the retro, facilitator only', function () {
    Event::fake([RetroSettingsChanged::class]);
    $retro = Retro::factory()->create();
    [$facilitator] = retroFacilitator($retro);
    [$member] = retroMember($retro);
    $survey = attachHealthCheck($retro);

    $this->actingAs($member)->putJson(route('retros.healthCheck.closure.update', $retro))->assertForbidden();
    $this->actingAs($facilitator)->putJson(route('retros.healthCheck.closure.update', $retro))->assertNoContent();
    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Closed);

    $this->actingAs($facilitator)->deleteJson(route('retros.healthCheck.closure.destroy', $retro))->assertNoContent();
    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Open);
    Event::assertDispatchedTimes(RetroSettingsChanged::class, 2);
});

it('removes an unanswered health check, and hides an answered one without losing its answers', function () {
    $unanswered = Retro::factory()->create();
    [$facilitator] = retroFacilitator($unanswered);
    attachHealthCheck($unanswered);

    $this->actingAs($facilitator)->deleteJson(route('retros.healthCheck.destroy', $unanswered))->assertNoContent();
    expect(TeamSurvey::query()->where('retro_id', $unanswered->id)->count())->toBe(0);

    $answered = Retro::factory()->create();
    [$other, $participant] = retroFacilitator($answered);
    $survey = attachHealthCheck($answered);
    answerHealthCheck($answered, $participant, sixScores());

    $this->actingAs($other)->deleteJson(route('retros.healthCheck.destroy', $answered))->assertNoContent();

    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Draft)
        ->and($survey->hasAnswers())->toBeTrue()
        ->and(resolve(HealthCheckSurvey::class)->forRetro($answered))->toBeNull();

    $this->actingAs($other)->postJson(route('retros.healthCheck.store', $answered))->assertCreated();

    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Open)
        ->and(TeamSurvey::query()->where('retro_id', $answered->id)->count())->toBe(1)
        ->and($survey->hasAnswers())->toBeTrue();
});

it('closes the health check when the retro is completed, at the retro\'s completion time', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create();
    [$facilitator] = retroFacilitator($retro);
    $survey = attachHealthCheck($retro);

    $this->actingAs($facilitator)->putJson(route('retros.phase.update', $retro), ['phase' => 'completed'])->assertSuccessful();

    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Closed)
        ->and($survey->fresh()->closed_at->equalTo($retro->fresh()->completed_at))->toBeTrue();
});

it('rebuilds the statements of unanswered, unclosed health checks when the team edits its statements, and of no other', function () {
    Event::fake([RetroSettingsChanged::class]);
    $team = Team::factory()->create();
    $unanswered = Retro::factory()->for($team)->create();
    $answered = Retro::factory()->for($team)->create();
    [, $participant] = retroMember($answered);
    $closed = Retro::factory()->for($team)->create();
    $standalone = TeamSurvey::factory()->healthCheck()->create(['team_id' => $team->id]);
    $ordinary = TeamSurvey::factory()->create(['team_id' => $team->id]);
    $ordinaryQuestion = surveyQuestion($ordinary);
    attachHealthCheck($unanswered);
    attachHealthCheck($answered);
    answerHealthCheck($answered, $participant, sixScores());
    attachHealthCheck($closed);
    closeHealthCheck($closed);

    $custom = resolve(ManageTeamHealthStatements::class)->add($team, 'We ship without fear', 'Shipping');
    $keys = fn (Retro $retro) => TeamSurvey::query()->where('retro_id', $retro->id)->sole()->questions()->pluck('match_key')->all();

    expect($keys($unanswered))->toContain($custom->id)
        ->and($standalone->questions()->pluck('match_key')->all())->toContain($custom->id)
        ->and($standalone->questions()->pluck('scale_max')->unique()->values()->all())->toBe([5])
        ->and($keys($answered))->not->toContain($custom->id)
        ->and($keys($closed))->not->toContain($custom->id)
        ->and($ordinary->questions()->pluck('id')->all())->toBe([$ordinaryQuestion->id]);
    Event::assertDispatched(fn (RetroSettingsChanged $event) => $event->retroId === $unanswered->id);
});

it('still refuses to turn anonymity off once someone has answered the health check', function () {
    $retro = Retro::factory()->anonymous()->create();
    [$facilitator, $participant] = retroFacilitator($retro);
    attachHealthCheck($retro);
    answerHealthCheck($retro, $participant, sixScores());

    $this->actingAs($facilitator)->patchJson(route('retros.settings.update', $retro), ['is_anonymous' => false])
        ->assertUnprocessable()->assertJsonValidationErrors('is_anonymous');
});
```

The index 3 is the position of `vision` among the six built-in statements. `RetroPhase::Roti` and `RetroPhase::Actions` exist since plan 18e (B1).

`tests/Concurrency/HealthCheckSubmissionTest.php` (real connections, `Race`, pattern of `tests/Concurrency/VoteLimitTest.php`):

```php
<?php

use App\Actions\HealthCheck\HealthCheckSurvey;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use Tests\Concurrency\Support\Race;

it('writes one set of scores when "Submit answers" arrives twice at once', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $survey = attachHealthCheck($retro);
    $userId = $user->id;
    $uri = route('retros.healthCheck.submission.store', $retro, false);
    $scores = ['interaction' => 3, 'task_clarity' => 4, 'manager_support' => 5, 'vision' => 4, 'processes' => 2, 'motivation' => 4];

    $outcomes = Race::run(array_fill(0, 2, static fn (): int => Race::request($userId, 'POST', $uri, ['scores' => $scores])));

    $statuses = array_count_values(array_column($outcomes, 'value'));
    $questionIds = $survey->questions()->pluck('id');

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and($statuses[200] ?? 0)->toBe(1)
        ->and($statuses[422] ?? 0)->toBe(1)
        ->and(TeamSurveyAnswer::query()->whereIn('team_survey_question_id', $questionIds)->count())->toBe(6)
        ->and($survey->respondents()->count())->toBe(1);
});

it('attaches one health check when "Add survey → Health check" arrives twice at once', function () {
    $retro = Retro::factory()->create();
    [$facilitator] = retroFacilitator($retro);
    $userId = $facilitator->id;
    $uri = route('retros.healthCheck.store', $retro, false);

    $outcomes = Race::run(array_fill(0, 2, static fn (): int => Race::request($userId, 'POST', $uri)));

    $statuses = array_count_values(array_column($outcomes, 'value'));

    expect($statuses[201] ?? 0)->toBe(1)
        ->and($statuses[422] ?? 0)->toBe(1)
        ->and(TeamSurvey::query()->where('retro_id', $retro->id)->count())->toBe(1)
        ->and(resolve(HealthCheckSurvey::class)->forRetro($retro))->not->toBeNull();
});
```

One respondent in the first case: the retro has no facilitator, so the attach created none, and both requests resolve the same user. The protection each case proves is the lock on the retro row taken first by both controllers: without it, both requests read "not sent" (or "no health check") before either writes.

- [ ] **Step 3: Run them and see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/AttachedHealthCheckTest.php`
Expected: FAIL, `Class "App\Actions\HealthCheck\AttachHealthCheck" not found`.

- [ ] **Step 4: Finder, respondent, attach, close**

`app/Actions/HealthCheck/HealthCheckSurvey.php`:

```php
<?php

namespace App\Actions\HealthCheck;

use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Models\Retro;
use App\Models\TeamSurvey;
use Illuminate\Database\Eloquent\Builder;

class HealthCheckSurvey
{
    public function forRetro(Retro $retro): ?TeamSurvey
    {
        return $this->query($retro)->where('status', '!=', TeamSurveyStatus::Draft)->first();
    }

    /**
     * A health check that was removed: kept, with its answers, as a draft.
     */
    public function hidden(Retro $retro): ?TeamSurvey
    {
        return $this->query($retro)->where('status', TeamSurveyStatus::Draft)->first();
    }

    /** @return Builder<TeamSurvey> */
    private function query(Retro $retro): Builder
    {
        return TeamSurvey::query()
            ->where('retro_id', $retro->id)
            ->where('template', TeamSurveyTemplate::HealthCheck)
            ->oldest()
            ->orderBy('id');
    }
}
```

`app/Actions/TeamSurveys/RespondentForParticipant.php` (the unique keys of Task 1 and `firstOrCreate`, which falls back to `createOrFirst`, keep one respondent per person; the callers hold the retro's lock):

```php
<?php

namespace App\Actions\TeamSurveys;

use App\Models\Participant;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;

class RespondentForParticipant
{
    public function handle(TeamSurvey $survey, Participant $participant): TeamSurveyRespondent
    {
        if ($participant->user_id === null) {
            return TeamSurveyRespondent::query()->firstOrCreate(
                ['team_survey_id' => $survey->id, 'participant_id' => $participant->id],
                ['guest_name' => $participant->guest_name],
            );
        }

        $respondent = TeamSurveyRespondent::query()->firstOrCreate([
            'team_survey_id' => $survey->id,
            'user_id' => $participant->user_id,
        ]);

        if ($respondent->participant_id === null) {
            $respondent->update(['participant_id' => $participant->id]);
        }

        return $respondent;
    }
}
```

`app/Actions/HealthCheck/AttachHealthCheck.php`:

```php
<?php

namespace App\Actions\HealthCheck;

use App\Actions\TeamSurveys\CreateTeamSurvey;
use App\Actions\TeamSurveys\NewTeamSurvey;
use App\Actions\TeamSurveys\RespondentForParticipant;
use App\Actions\TeamSurveys\WriteSurveyQuestions;
use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Models\Retro;
use App\Models\TeamSurvey;
use Illuminate\Validation\ValidationException;

class AttachHealthCheck
{
    public function __construct(
        private HealthCheckSurvey $healthCheckSurvey,
        private CreateTeamSurvey $createTeamSurvey,
        private RespondentForParticipant $respondentForParticipant,
        private WriteSurveyQuestions $writeSurveyQuestions,
        private HealthCheckQuestions $healthCheckQuestions,
    ) {}

    /**
     * Runs inside the caller's transaction, on a retro row locked for update.
     */
    public function handle(Retro $locked): TeamSurvey
    {
        if ($this->healthCheckSurvey->forRetro($locked) !== null) {
            throw ValidationException::withMessages(['health_check' => __('This retro already has a health check.')]);
        }

        $hidden = $this->healthCheckSurvey->hidden($locked);

        if ($hidden !== null) {
            return $this->bringBack($hidden, $locked);
        }

        $facilitator = $locked->facilitator;

        $survey = $this->createTeamSurvey->handle($locked->team, $facilitator?->user, new NewTeamSurvey(
            title: $locked->title,
            template: TeamSurveyTemplate::HealthCheck,
            retro: $locked,
            open: true,
        ));

        if ($facilitator !== null) {
            $survey->update(['facilitator_respondent_id' => $this->respondentForParticipant->handle($survey, $facilitator)->id]);
        }

        return $survey;
    }

    /**
     * The statements follow the team again, on the scale of five, only when
     * nobody had answered: answers refer to the questions they were given to.
     */
    private function bringBack(TeamSurvey $hidden, Retro $locked): TeamSurvey
    {
        if (! $hidden->hasAnswers()) {
            $this->writeSurveyQuestions->handle($hidden, $this->healthCheckQuestions->handle($locked->team));
        }

        $hidden->update([
            'status' => TeamSurveyStatus::Open,
            'opened_at' => $hidden->opened_at ?? now(),
            'closed_at' => null,
            'version' => $hidden->version + 1,
        ]);

        return $hidden;
    }
}
```

`app/Actions/HealthCheck/CloseAttachedSurveys.php`:

```php
<?php

namespace App\Actions\HealthCheck;

use App\Enums\TeamSurveyStatus;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Models\Retro;
use App\Models\TeamSurvey;

class CloseAttachedSurveys
{
    /**
     * Closed at the retro's completion time, so that the retro's own
     * health check is never "after" it in a trend.
     */
    public function handle(Retro $locked): void
    {
        $open = TeamSurvey::query()->where('retro_id', $locked->id)->where('status', TeamSurveyStatus::Open)->orderBy('id')->get();

        foreach ($open as $survey) {
            $survey->update([
                'status' => TeamSurveyStatus::Closed,
                'closed_at' => $locked->completed_at ?? now(),
                'version' => $survey->version + 1,
            ]);

            TeamSurveyChanged::for($survey)->sendToOthers();
        }
    }
}
```

In `ChangeRetroPhase`, inject `private CloseAttachedSurveys $closeAttachedSurveys` and, in `closeSurveys()`, after `$this->closeOpenSurveys->handle($locked);`:

```php
        $this->closeAttachedSurveys->handle($locked);
```

`closeSurveys` runs after `move()`, which has just written `completed_at`. The retro surveys keep their rework-3 rule (a survey still open on a completed retro counts as closed, `PresentSurvey`): nothing changes there.

- [ ] **Step 5: Presenters and event**

`app/Events/Retros/HealthAnswered.php` keeps its name and channel (read the file: it extends the retro's broadcast base class) and changes its payload:

```php
    public function __construct(string $retroId, public int $respondents, public int $participants)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'health.answered';
    }

    /**
     * @return array{respondents: int, participants: int}
     */
    public function broadcastWith(): array
    {
        return ['respondents' => $this->respondents, 'participants' => $this->participants];
    }
```

`app/Actions/HealthCheck/PresentHealthProgress.php`:

```php
<?php

namespace App\Actions\HealthCheck;

use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use Illuminate\Support\Collection;

class PresentHealthProgress
{
    public function __construct(private HealthCheckSurvey $healthCheckSurvey) {}

    /**
     * @return array{respondents: int, participants: int, statements: array<int, array{key: string, count: int, answeredBy: array<int, string>}>}|null
     */
    public function handle(Retro $retro): ?array
    {
        $survey = $this->healthCheckSurvey->forRetro($retro);

        if ($survey === null) {
            return null;
        }

        return $this->forSurvey($survey, $retro);
    }

    /**
     * `respondents` counts who have sent their answers; `participants` everyone
     * who joined the retro, guests included. Who answered a statement is named
     * by retro participant, on a retro that is not anonymous only, for the MCP
     * tool: the board shows counts alone.
     *
     * @return array{respondents: int, participants: int, statements: array<int, array{key: string, count: int, answeredBy: array<int, string>}>}
     */
    public function forSurvey(TeamSurvey $survey, Retro $retro): array
    {
        $questions = $survey->questions()->get(['id', 'match_key']);

        $answers = TeamSurveyAnswer::query()
            ->whereIn('team_survey_question_id', $questions->pluck('id'))
            ->with('respondent:id,participant_id')
            ->oldest()
            ->orderBy('id')
            ->get()
            ->groupBy('team_survey_question_id');

        return [
            'respondents' => $survey->completedCount(),
            'participants' => $retro->participants()->count(),
            'statements' => $questions->map(function (TeamSurveyQuestion $question) use ($retro, $answers): array {
                /** @var Collection<int, TeamSurveyAnswer> $own */
                $own = $answers->get($question->id, collect());

                return [
                    'key' => (string) $question->match_key,
                    'count' => $own->count(),
                    'answeredBy' => $retro->is_anonymous
                        ? []
                        : $own->map(fn (TeamSurveyAnswer $answer): ?string => $answer->respondent?->participant_id)->filter()->values()->all(),
                ];
            })->values()->all(),
        ];
    }
}
```

`app/Actions/HealthCheck/PresentHealthCheck.php`:

```php
<?php

namespace App\Actions\HealthCheck;

use App\Enums\TeamSurveyStatus;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use App\Support\Surveys\HealthScale;
use Illuminate\Database\Eloquent\Builder;

class PresentHealthCheck
{
    public function __construct(
        private HealthCheckSurvey $healthCheckSurvey,
        private PresentHealthProgress $presentHealthProgress,
    ) {}

    /**
     * @return array{
     *     surveyId: string,
     *     isClosed: bool,
     *     scale: int,
     *     respondents: int,
     *     participants: int,
     *     hasSubmitted: bool,
     *     statements: array<int, array{key: string, label: string, text: string, isBuiltin: bool, myScore: ?int}>
     * }|null
     */
    public function handle(Retro $retro, Participant $viewer): ?array
    {
        $survey = $this->healthCheckSurvey->forRetro($retro);

        if ($survey === null) {
            return null;
        }

        $progress = $this->presentHealthProgress->forSurvey($survey, $retro);
        $questions = $survey->questions()->get();
        $respondent = $this->respondentOf($survey, $viewer);
        $myScores = $respondent === null ? [] : TeamSurveyAnswer::query()
            ->where('team_survey_respondent_id', $respondent->id)
            ->whereNotNull('value')
            ->pluck('value', 'team_survey_question_id')
            ->map(fn (mixed $value): int => (int) $value)
            ->all();

        return [
            'surveyId' => $survey->id,
            'isClosed' => $survey->status === TeamSurveyStatus::Closed,
            'scale' => (int) ($questions->first()?->scale_max ?? HealthScale::Max),
            'respondents' => $progress['respondents'],
            'participants' => $progress['participants'],
            'hasSubmitted' => (bool) $respondent?->hasSubmitted(),
            'statements' => $questions->map(fn (TeamSurveyQuestion $question): array => [
                'key' => (string) $question->match_key,
                'label' => (string) $question->displayShortLabel(),
                'text' => $question->displayLabel(),
                'isBuiltin' => $question->builtin !== null,
                'myScore' => $myScores[$question->id] ?? null,
            ])->values()->all(),
        ];
    }

    /**
     * Reads the viewer's respondent without creating one: a snapshot must
     * not add rows.
     */
    private function respondentOf(TeamSurvey $survey, Participant $viewer): ?TeamSurveyRespondent
    {
        return TeamSurveyRespondent::query()
            ->where('team_survey_id', $survey->id)
            ->where(fn (Builder $query) => $query
                ->where('participant_id', $viewer->id)
                ->when($viewer->user_id !== null, fn (Builder $own) => $own->orWhere('user_id', $viewer->user_id)))
            ->orderBy('id')
            ->first();
    }
}
```

`BuildBoardSnapshot` keeps calling `$this->presentHealthCheck->handle($retro, $viewer)`, and adds to the `retro` array `'healthCheckStatements' => $this->teamHealthStatements->active($retro->team)->count()` (inject `TeamHealthStatements`), the number the "Add survey" menu shows.

- [ ] **Step 6: Controllers**

`app/Http/Controllers/Retros/RetroHealthCheckSubmissionsController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\HealthCheck\HealthCheckSurvey;
use App\Actions\HealthCheck\PresentHealthProgress;
use App\Actions\Retros\MarkRetroStarted;
use App\Actions\Retros\RetroGuard;
use App\Actions\TeamSurveys\RespondentForParticipant;
use App\Actions\TeamSurveys\SaveSurveyAnswer;
use App\Enums\TeamSurveyStatus;
use App\Events\Retros\HealthAnswered;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyQuestion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class RetroHealthCheckSubmissionsController extends Controller
{
    public function __construct(
        private HealthCheckSurvey $healthCheckSurvey,
        private RespondentForParticipant $respondentForParticipant,
        private SaveSurveyAnswer $saveSurveyAnswer,
        private PresentHealthProgress $presentHealthProgress,
        private MarkRetroStarted $markRetroStarted,
    ) {}

    /**
     * "Submit answers": every statement scored at once, once. The retro is
     * locked first, then its health check, as on every retro route; the
     * scores are validated against the questions read under those locks.
     */
    public function store(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro);

        $progress = DB::transaction(function () use ($request, $retro, $participant): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->guard($locked);

            $found = $this->healthCheckSurvey->forRetro($locked);

            abort_if($found === null, 404);

            $survey = TeamSurvey::query()->whereKey($found->id)->lockForUpdate()->firstOrFail();

            if ($survey->status !== TeamSurveyStatus::Open) {
                throw ValidationException::withMessages(['health_check' => __('The health check is closed.')]);
            }

            $respondent = $this->respondentForParticipant->handle($survey, $participant);

            if ($respondent->hasSubmitted()) {
                throw ValidationException::withMessages(['health_check' => __('You have already sent your answers.')]);
            }

            $questions = $survey->questions()->get()->keyBy('match_key');
            $validated = Validator::make($request->all(), $this->rules($questions), $this->messages($questions))->validate();

            foreach ($questions as $key => $question) {
                $this->saveSurveyAnswer->handle($question, $respondent, ['value' => (int) $validated['scores'][$key]]);
            }

            $respondent->update(['completed_at' => now()]);

            $this->markRetroStarted->handle($locked);

            $progress = $this->presentHealthProgress->forSurvey($survey, $locked);

            (new HealthAnswered($locked->id, $progress['respondents'], $progress['participants']))->sendToOthers();

            return $progress;
        });

        return response()->json([
            'respondents' => $progress['respondents'],
            'participants' => $progress['participants'],
            'hasSubmitted' => true,
        ]);
    }

    private function guard(Retro $retro): void
    {
        RetroGuard::open($retro);
        RetroGuard::unlocked($retro);
    }

    /**
     * @param  Collection<string, TeamSurveyQuestion>  $questions
     * @return array<string, array<int, mixed>>
     */
    private function rules(Collection $questions): array
    {
        $rules = ['scores' => ['required', 'array:'.$questions->keys()->implode(',')]];

        foreach ($questions as $key => $question) {
            $rules["scores.{$key}"] = ['required', 'integer', 'min:1', 'max:'.(int) $question->scale_max];
        }

        return $rules;
    }

    /**
     * @param  Collection<string, TeamSurveyQuestion>  $questions
     * @return array<string, string>
     */
    private function messages(Collection $questions): array
    {
        return $questions->keys()
            ->mapWithKeys(fn (string $key): array => ["scores.{$key}.required" => __('Score every statement before sending.')])
            ->all();
    }
}
```

The three refusals keep the statuses the guards give today: 423 for a locked board (`RetroGuard::unlocked`), 403 for a completed retro (`RetroGuard::open`), and 422 for a closed health check or a second submission. The broadcast is dispatched after the commit (`ShouldDispatchAfterCommit` on the retro's events): the transaction is not retried (`Transactions::Attempts` is for callbacks that touch nothing but the database).

`app/Http/Controllers/Retros/RetroHealthChecksController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\HealthCheck\AttachHealthCheck;
use App\Actions\HealthCheck\HealthCheckSurvey;
use App\Actions\Retros\RetroGuard;
use App\Enums\TeamSurveyStatus;
use App\Events\Retros\RetroSettingsChanged;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Events\TeamSurveys\TeamSurveyDeleted;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamSurvey;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class RetroHealthChecksController extends Controller
{
    public function store(Request $request, Retro $retro, AttachHealthCheck $attachHealthCheck): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::open($retro);

        $surveyId = DB::transaction(function () use ($retro, $participant, $attachHealthCheck): string {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::open($locked);

            $survey = $attachHealthCheck->handle($locked);

            (new RetroSettingsChanged($locked->id))->sendToOthers();

            return $survey->id;
        });

        return response()->json(['surveyId' => $surveyId], 201);
    }

    /**
     * Without answers the health check goes; with answers it is hidden and
     * kept, as turning the setting off always did.
     */
    public function destroy(Request $request, Retro $retro, HealthCheckSurvey $healthCheckSurvey): Response
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::open($retro);

        DB::transaction(function () use ($retro, $participant, $healthCheckSurvey): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::open($locked);

            $found = $healthCheckSurvey->forRetro($locked);

            abort_if($found === null, 404);

            $survey = TeamSurvey::query()->whereKey($found->id)->lockForUpdate()->firstOrFail();

            if ($survey->hasAnswers()) {
                $survey->update(['status' => TeamSurveyStatus::Draft, 'closed_at' => null, 'version' => $survey->version + 1]);

                TeamSurveyChanged::for($survey)->sendToOthers();
            }

            if (! $survey->hasAnswers()) {
                $surveyId = $survey->id;

                $survey->delete();

                (new TeamSurveyDeleted($surveyId))->sendToOthers();
            }

            (new RetroSettingsChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }
}
```

`app/Http/Controllers/Retros/RetroHealthCheckClosuresController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\HealthCheck\HealthCheckSurvey;
use App\Actions\Retros\RetroGuard;
use App\Actions\TeamSurveys\ChangeTeamSurveyStatus;
use App\Enums\TeamSurveyStatus;
use App\Events\Retros\RetroSettingsChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamSurvey;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class RetroHealthCheckClosuresController extends Controller
{
    public function __construct(
        private HealthCheckSurvey $healthCheckSurvey,
        private ChangeTeamSurveyStatus $changeTeamSurveyStatus,
    ) {}

    public function update(Request $request, Retro $retro): Response
    {
        return $this->change($request, $retro, TeamSurveyStatus::Closed);
    }

    public function destroy(Request $request, Retro $retro): Response
    {
        return $this->change($request, $retro, TeamSurveyStatus::Open);
    }

    private function change(Request $request, Retro $retro, TeamSurveyStatus $target): Response
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::open($retro);

        DB::transaction(function () use ($retro, $participant, $target): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::open($locked);

            $found = $this->healthCheckSurvey->forRetro($locked);

            abort_if($found === null, 404);

            $this->changeTeamSurveyStatus->handle(
                TeamSurvey::query()->whereKey($found->id)->lockForUpdate()->firstOrFail(),
                $target,
            );

            (new RetroSettingsChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }
}
```

Routes, in the `retros/{retro}` group, in place of the two `health-check/{statement}` routes, which go with `HealthCheckAnswersController`:

```php
        Route::post('health-check', [RetroHealthChecksController::class, 'store'])->name('retros.healthCheck.store');
        Route::delete('health-check', [RetroHealthChecksController::class, 'destroy'])->name('retros.healthCheck.destroy');
        Route::put('health-check/closure', [RetroHealthCheckClosuresController::class, 'update'])->name('retros.healthCheck.closure.update');
        Route::delete('health-check/closure', [RetroHealthCheckClosuresController::class, 'destroy'])->name('retros.healthCheck.closure.destroy');
        Route::post('health-check/submission', [RetroHealthCheckSubmissionsController::class, 'store'])->name('retros.healthCheck.submission.store');
```

- [ ] **Step 7: Creation, settings, team statements, factory**

In `CreateRetro`: replace the dependency `FreezeHealthStatements` by `AttachHealthCheck`; remove `'health_check_enabled' => $data->healthCheckEnabled` from the `make([...])`; remove the `freezeHealthStatements` block; and after `$retro->update(['facilitator_participant_id' => $facilitator->id]);`:

```php
            if ($data->healthCheckEnabled) {
                $this->attachHealthCheck->handle($retro->setRelation('facilitator', $facilitator));
            }
```

In `RetroSettingsController`: remove `'health_check_enabled'` from `OpenPhaseSettings` and from the validation rules, remove the `FreezeHealthStatements` dependency, the `$isEnablingHealthCheck` lines and the health entry of `ensureCurrentPhaseStaysOn`; inject `HealthCheckSurvey $healthCheckSurvey` and replace the anonymity check:

```php
            if ($isDisablingAnonymity && (bool) $this->healthCheckSurvey->forRetro($locked)?->hasAnswers()) {
                throw ValidationException::withMessages(['is_anonymous' => __('Anonymity can only be turned off before anyone answers.')]);
            }
```

In `ManageTeamHealthStatements`: replace the dependency `FreezeHealthStatements` by `HealthCheckQuestions` and `WriteSurveyQuestions`, and replace `refreezeUnansweredRetros` (and its call in `change`) by:

```php
    /**
     * Statements follow the team until the first answer: answers refer to
     * the questions they were given to. The team is locked first by
     * `change()`; each survey is locked after it.
     */
    private function refreshUnansweredHealthChecks(Team $team): void
    {
        $surveyIds = TeamSurvey::query()
            ->where('team_id', $team->id)
            ->where('template', TeamSurveyTemplate::HealthCheck)
            ->where('status', '!=', TeamSurveyStatus::Closed)
            ->orderBy('id')
            ->pluck('id');

        foreach ($surveyIds as $surveyId) {
            $survey = TeamSurvey::query()->whereKey($surveyId)->lockForUpdate()->first();

            if ($survey === null || $survey->status === TeamSurveyStatus::Closed || $survey->hasAnswers()) {
                continue;
            }

            $this->writeSurveyQuestions->handle($survey, $this->healthCheckQuestions->handle($team));

            $survey->increment('version');

            TeamSurveyChanged::for($survey)->sendToOthers();

            if ($survey->retro_id !== null) {
                (new RetroSettingsChanged($survey->retro_id))->sendToOthers();
            }
        }
    }
```

`HealthCheckQuestions` must read the statements written earlier in the same transaction: `TeamHealthStatements::active` queries the table, so it does.

`database/factories/RetroFactory.php`: `withHealthCheck()` stops setting `health_check_enabled` and attaches a health check:

```php
    public function withHealthCheck(): static
    {
        return $this->afterCreating(function (Retro $retro): void {
            resolve(AttachHealthCheck::class)->handle($retro);
        });
    }
```

The old models and `FreezeHealthStatements` are still on disk after this task (Task 29 deletes them); nothing writes the old tables any more. Check: `grep -rn "FreezeHealthStatements\|healthCheckAnswers()\|healthStatements()" app` shows only `Retro.php`, `Team.php`, `Participant.php`, the summaries of Task 16 and the old model files.

- [ ] **Step 8: Front of the retro's health check (lane H)**

The phase panel stays until Task 28; it moves to the submission now, so that the board works at every merge. Read `components/retro/phase-health.tsx`, `lib/retro/types.ts` (`HealthCheckStatement`, `HealthProgress`, `HealthCheckState`), `lib/retro/board-reducer.ts` (`health.progress`, `health.answer`), `lib/retro/adapters.ts` (`toHealthStatements`) and `hooks/use-retro-board.ts` (`health.answered`).

- `lib/retro/types.ts`: `HealthCheckStatement` = `{ key, label, text, isBuiltin, myScore: number | null }`; `HealthCheckState` = `{ surveyId: string; isClosed: boolean; scale: number; respondents: number; participants: number; hasSubmitted: boolean; statements: HealthCheckStatement[] }` (Task 16 adds `results`); `HealthProgress` = `{ respondents: number; participants: number }`; `retro.healthCheckStatements: number`.
- `board-reducer.ts`: `health.progress` takes `{ respondents, participants }` and sets them; `health.submitted` takes `{ scores: Record<string, number>, respondents, participants }`, sets each `myScore`, `hasSubmitted: true` and the counts; `health.answer` goes. Vitest: both actions, and that they leave `surveyId`, `isClosed` and `scale` untouched; a board without a health check ignores both.
- `hooks/use-retro-board.ts`: `health.answered` dispatches `health.progress` with the event's two counts.
- `lib/retro/adapters.ts`: `toHealthStatements` maps `key`, `label`, `text`, `myScore` (no `count`, no `answeredBy`). Vitest updated.
- `components/retro/use-health-check-submission.ts` (new): `useHealthCheckSubmission()` reads the board context and returns `{ answers, setAnswer(key, score), submit(): Promise<void>, submitting, canSubmit }`; `answers` starts from the statements' `myScore`; `canSubmit` is true when every statement has a score, the health check is open, the viewer has not sent and the board is editable; `submit` posts `{ scores: answers }` to `RetroHealthCheckSubmissionsController.store` through `ctx.run(retroRequest(...))` and, on success, applies `health.submitted`. Vitest: the body sent, nothing sent while a statement is missing, the state after success, a 422 leaves the scores on screen.
- `components/retro/phase-health.tsx`: `HealthCheckForm` with `scale={healthCheck.scale}`, `answers` and `onAnswer` from the hook, `onSubmit={submit}` (the button "Submit answers" the form already draws, disabled until complete), `submitted={healthCheck.hasSubmitted}`, no `onClear`; the banner reads `t('Rate each statement from 1 (Strongly disagree) to :max (Strongly agree). Only you see your own scores.', { max: healthCheck.scale })`. Vitest updated: no request per score; one request on "Submit answers"; read-only after.

`npm run test -- board-reducer adapters use-health-check-submission phase-health`, `npm run types:check`, `npm run check`, `npm run build:front`.

- [ ] **Step 9: Existing tests that move to the new fixtures**

Each is edited in this task's commit; none is deleted. "Fixture" means: replace `withHealthCheck()` used as a flag, `FreezeHealthStatements`, `HealthCheckAnswer::factory()` and `healthStatements()` by `attachHealthCheck`, `answerHealthCheck`, `closeHealthCheck` and the survey's questions.

| File | Case | Change |
|---|---|---|
| `HealthCheckTest.php` | "sets, changes and clears…", "changes a score without duplicating…" | become "sends every score at once…" and "refuses a second submission…" (the cases of `AttachedHealthCheckTest` cover the route; keep these two files' cases as the old ids with the new behaviour) |
| | "lets guests answer", "returns 404 for statements outside the retro set" | fixture; through the submission ("an unknown statement" is refused by `array:` keys) |
| | "accepts scores from 1 to 10 only" | "accepts scores from 1 to 5 only"; an imported open health check on ten accepts 10 (`answerHealthCheck(..., scaleMax: 10)` for its fixture) |
| | "broadcasts counts and who answered, never a score" | "broadcasts the number who have sent and the number of participants, never a score or a name" |
| | "hides who answered on anonymous retros" | the board names nobody on any retro (decision 11); the case asserts the MCP-facing `PresentHealthProgress::forSurvey` keeps `answeredBy` empty on an anonymous retro and filled otherwise |
| | "sends each viewer only their own score in the snapshot" | fixture; `myScore` per statement |
| | "only accepts answers during the health check and while unlocked" | becomes "accepts a submission in every open phase while unlocked and open": the phase dataset turns from refusals into acceptances; locked and completed stay refused |
| | "leaves the health check out of the snapshot when it is off and unanswered" | "…of a retro that has none" |
| | "presents built-in statements translated and custom statements as stored" | fixture; same assertions on `label` and `text` |
| | "includes the health check in the snapshot when answers exist though it is off" | becomes "keeps the answers of a health check that was removed, out of the snapshot, and brings them back when it is added again" |
| `HealthStatementFreezeTest.php` | "freezes the six built-ins when a retro is created with the health check", "freezes the team active statements, custom ones with their text and id" | assert the attached survey's questions (`match_key`, `builtin`, `label`, `short_label`, `scale_max` 5, `is_required`) |
| | "freezes nothing for a retro created without the health check" | no survey |
| | "freezes the set when the facilitator turns the health check on", "refreshes an unanswered set when the health check is turned on again" | through `retros.healthCheck.store` and `.destroy` |
| | "keeps the frozen set once answered, whatever the team changes", "re-freezes unanswered enabled retros when the team edits its statements", "broadcasts a settings change…", "keeps the set of a retro that has answers…", "leaves completed retros untouched…", "leaves retros without the health check untouched…" | fixture; same assertions on the questions |
| `CreateRetroTest.php`, `BoardSnapshotTest.php` | health cases | `retro.healthCheckEnabled` stays in the snapshot until Task 27; assert `healthCheck.surveyId`, `healthCheck.scale` and `retro.healthCheckStatements` beside it |
| `RetroStartTest.php` | "a health-check answer starts the retro" | "the first health-check submission starts the retro" |
| `FacilitationTest.php` | cases that patch `health_check_enabled` through `retros.settings.update` | the field is ignored: move the cases to `retros.healthCheck.store` / `.destroy`; the "cannot turn the current phase off" case for the health check goes to Task 27's list (the phase still exists here) |
| `TeamHealthStatementsTest.php` | cases that read `retro_health_statements` after a team edit | read the survey's questions |

- [ ] **Step 10: Run the tests on the four engines**

Run, for each of `pgsql`, `mariadb`, `mysql`, `sqlite`: `bin/test-db <engine> -- tests/Feature/Retros tests/Feature/Teams tests/Feature/TeamSurveys`; then `bin/test-db <engine> --concurrency` for `pgsql`, `mariadb`, `mysql` and `sqlite-file`.
Expected: PASS, except the summary, trend, results, recap and MCP health cases (`HealthCheckSummaryTest`, `HealthTrendTest`, `TeamMoodTrendTest`, the health cases of `ResultsTest`, `SummaryInputTest`, `ResultsEmailTest`, `MailMockupTest`, `InsightsHealthRotiTest`), which read the old tables until Task 16 and are not touched here. List the failing cases in the commit message body; Task 16 turns them green. Do not merge this task alone.

- [ ] **Step 11: Commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app database routes tests resources/js lang
git commit -m "feat(health): a retro attaches its health check as a team survey, sent all at once on five; the board reads it"
```

### Task 16: Summaries, trends and the MCP tool read team surveys, on the health scale

**Files:**
- Rewrite: `app/Actions/HealthCheck/SummarizeHealthCheck.php`, `BuildHealthTrend.php`, `app/Actions/Teams/BuildTeamMoodTrend.php`, `app/Mcp/Tools/Retro/GetHealth.php`
- Modify: `app/Actions/HealthCheck/PresentHealthCheck.php` (adds `results`), `app/Support/Integrations/Messages/RetroRecapMail.php` (":score/5"), `app/Actions/Retros/BuildSummaryInput.php` (`scale`), `app/Mcp/Prompts/TeamHealth.php` (the scale sentence), `lang/*.json`, `tests/Pest.php`
- Front (lane H): `resources/js/components/skrum/health-check-form.tsx`, `health-check-results.tsx`, `health-check-compact.tsx`, `health-check-summary.tsx` (each + test), `resources/js/components/retro/results/health-radar.tsx` (+ test), `health-trend.tsx`, `resources/js/lib/retro/types.ts`, `session-end.ts` (+ test), `resources/js/lib/teams/mood-adapter.ts` (+ test), `resources/js/pages/dev/sections/{health-check,mood-trend-chart}.tsx`
- Test: `tests/Feature/TeamSurveys/HealthCheckParityTest.php`; fixtures and numbers moved in `tests/Feature/Retros/HealthCheckSummaryTest.php`, `HealthTrendTest.php`, `ResultsTest.php`, `SummaryInputTest.php`, `tests/Feature/Teams/TeamMoodTrendTest.php`, `tests/Feature/Integrations/ResultsEmailTest.php`, `tests/Feature/Mail/MailMockupTest.php`, `tests/Feature/Mcp/InsightsHealthRotiTest.php`, `MessagesAndSummaryTest.php`, `ReadPrivacyTest.php`, `PromptsTest.php` and `CatalogueTest.php` if they assert the tool's description or the prompt's text

**Interfaces:**
- Consumes: `HealthCheckSurvey::forRetro`, `HealthScale` (Task 2), the models, `ImportHealthChecks` and the fixture helpers of Task 14.
- Produces, with the output shapes they have today plus `distribution`: `SummarizeHealthCheck::handle(Retro $retro, ?Participant $viewer = null): ?array`; `SummarizeHealthCheck::forSurvey(TeamSurvey $survey, int $participants, bool $withPrevious = true): ?array`; `SummarizeHealthCheck::scoreOf(array $averages): ?float` (unchanged); each statement gains `distribution: array{int, int, int, int, int}`; `BuildHealthTrend::forViewer(Retro, Participant): ?array`, `::handle(Retro $retro): array`, `::forTeam(string $teamId, ?CarbonInterface $until = null): array` — each point is `{retroId: ?string, surveyId: string, title: string, completedAt: string, score: float, url: string, delta: ?float, sameStatements: bool}`; `BuildHealthTrend::scoresOf(Collection $surveys): Collection<string, ?float>` (keyed by survey id; replaces `scores(Collection $retroIds)`); `BuildTeamMoodTrend::handle(Team $team): array` — each point is `{retroId: ?string, surveyId: ?string, title, completedAt, url, mood, moodVoters, roti, rotiVoters}`; snapshot key `healthCheck.results` (the summary, once the health check is closed, else null). Every number is on the health scale (spec §11.9).

- [ ] **Step 1: Write the failing test**

`tests/Feature/TeamSurveys/HealthCheckParityTest.php` — the values the old readers gave for the fixture of Task 14, read by the rule of §11.9 after the import, written by hand:

```php
<?php

use App\Actions\HealthCheck\BuildHealthTrend;
use App\Actions\HealthCheck\SummarizeHealthCheck;
use App\Actions\Teams\BuildTeamMoodTrend;
use App\Models\TeamSurvey;
use App\Support\Surveys\ImportHealthChecks;

beforeEach(function () {
    $this->history = healthHistory();

    resolve(ImportHealthChecks::class)->handle();
});

it('summarises an imported health check on the health scale, each statement read halved', function () {
    $summary = resolve(SummarizeHealthCheck::class)->handle($this->history['sprint41']);
    $statements = collect($summary['statements'])->keyBy('key');

    expect(array_keys($summary))->toBe(['statements', 'score', 'participation', 'topStrength', 'growthArea', 'alignment', 'assessment'])
        ->and(array_keys($summary['statements'][0]))->toBe(['key', 'label', 'text', 'isBuiltin', 'average', 'count', 'consensus', 'previousAverage', 'distribution'])
        ->and($statements['interaction'])->toMatchArray(['label' => 'Interaction', 'isBuiltin' => true, 'average' => 3.5, 'count' => 3, 'previousAverage' => 2.5, 'distribution' => [0, 0, 1, 2, 0]])
        ->and($statements['vision'])->toMatchArray(['average' => 4.0, 'count' => 2, 'previousAverage' => 2.5, 'distribution' => [0, 0, 1, 0, 1]])
        ->and($statements[$this->history['custom']])->toMatchArray(['label' => 'Shipping', 'text' => 'We ship without fear', 'isBuiltin' => false, 'average' => 2.0, 'count' => 1, 'previousAverage' => null, 'distribution' => [0, 1, 0, 0, 0]])
        ->and($summary['score'])->toBe(3.2)
        ->and($summary['participation'])->toBe(['respondents' => 3, 'participants' => 3])
        ->and($summary['topStrength'])->toBe(['key' => 'vision', 'label' => 'Vision', 'average' => 4.0])
        ->and($summary['growthArea'])->toBe(['key' => $this->history['custom'], 'label' => 'Shipping', 'average' => 2.0])
        ->and($summary['alignment']['value'])->toBe(8)
        ->and($summary['assessment']['band'])->toBe('good');
});

it('keeps the consensus of a statement as it was, computed on the scale of its answers', function () {
    $summary = resolve(SummarizeHealthCheck::class)->handle($this->history['sprint41']);
    $vision = collect($summary['statements'])->firstWhere('key', 'vision');

    expect(round($vision['consensus'], 2))->toBe(5.56);
});

it('summarises nothing for a retro whose health check was turned off, completed without an answer, or never existed', function () {
    $summarize = resolve(SummarizeHealthCheck::class);

    expect($summarize->handle($this->history['completedUnanswered']))->toBeNull()
        ->and($summarize->handle($this->history['never']))->toBeNull()
        ->and($summarize->handle($this->history['turnedOff']))->toBeNull();
});

it('withholds the previous averages from a guest', function () {
    $summary = resolve(SummarizeHealthCheck::class)->handle($this->history['sprint41'], $this->history['guest']);

    expect(collect($summary['statements'])->pluck('previousAverage')->filter()->all())->toBe([]);
});

it('lists the imported health checks in the trend, oldest first, with their deltas on the health scale', function () {
    $trend = resolve(BuildHealthTrend::class)->handle($this->history['sprint41']);

    expect($trend)->toHaveCount(2)
        ->and($trend[0])->toMatchArray([
            'retroId' => $this->history['sprint40']->id,
            'title' => 'Sprint 40',
            'score' => 2.5,
            'delta' => null,
            'sameStatements' => true,
            'url' => route('retros.show', $this->history['sprint40']->id),
        ])
        ->and($trend[1])->toMatchArray(['retroId' => $this->history['sprint41']->id, 'score' => 3.2, 'delta' => 0.7, 'sameStatements' => false])
        ->and($trend[1]['completedAt'])->toBe($this->history['sprint41']->completed_at->toIso8601String());
});

it('gives the team mood trend the same points on the health scale, and adds a health check run as a survey on five', function () {
    $before = resolve(BuildTeamMoodTrend::class)->handle($this->history['team']);

    expect(array_column($before, 'retroId'))->toBe([$this->history['sprint40']->id, $this->history['sprint41']->id])
        ->and($before[0]['mood'])->toBe(2.5)
        ->and($before[1])->toMatchArray(['title' => 'Sprint 41', 'mood' => 3.2, 'moodVoters' => 3, 'roti' => null, 'rotiVoters' => 0]);

    $standalone = TeamSurvey::factory()->healthCheck()->closed()->create([
        'team_id' => $this->history['team']->id, 'title' => 'Health check — October', 'closed_at' => '2026-10-05 10:00:00',
    ]);
    [, $respondent] = surveyMember($standalone);
    answerSurveyQuestion(surveyQuestion($standalone, attributes: ['match_key' => 'vision', 'scale_max' => 5]), $respondent, 4);

    $after = resolve(BuildTeamMoodTrend::class)->handle($this->history['team']);

    expect($after)->toHaveCount(3)
        ->and($after[2])->toMatchArray([
            'retroId' => null,
            'surveyId' => $standalone->id,
            'title' => 'Health check — October',
            'mood' => 4.0,
            'moodVoters' => 1,
            'roti' => null,
            'url' => route('surveys.results.show', $standalone),
        ]);
});

it('gives a statement the average of the previous closed health check, whatever its kind of session and its scale', function () {
    $standalone = TeamSurvey::factory()->healthCheck()->closed()->create([
        'team_id' => $this->history['team']->id, 'closed_at' => '2026-09-01 10:00:00',
    ]);
    [, $respondent] = surveyMember($standalone);
    answerSurveyQuestion(surveyQuestion($standalone, attributes: ['match_key' => 'vision', 'scale_max' => 5]), $respondent, 1);

    $summary = resolve(SummarizeHealthCheck::class)->handle($this->history['sprint41']);
    $statements = collect($summary['statements'])->keyBy('key');

    expect($statements['vision']['previousAverage'])->toBe(1.0)
        ->and($statements['interaction']['previousAverage'])->toBeNull();
});
```

Hand computation for Sprint 41 (scale 10, §11.9). Old values: interaction (8 + 6 + 7) ÷ 3 = 7.0; vision (6 + 10) ÷ 2 = 8.0; custom 4.0; score 6.3; Sprint 40: 5.0 and 5.0, score 5.0, delta 1.3. On the health scale: interaction 7.0 × 5 ÷ 10 = 3.5; vision 4.0; custom 2.0; score round((3.5 + 4.0 + 2.0) ÷ 3, 1) = round(3.1667, 1) = 3.2 (not the old 6.3 halved, which would round 3.15: the score is always the mean of the statement averages on the health scale); Sprint 40: 2.5 and 2.5, score 2.5; delta round(3.2 − 2.5, 1) = 0.7; `previousAverage` 2.5 for interaction and vision. Distribution, `ceil(value × 5 ÷ 10)`: interaction 8, 6, 7 → buckets 4, 3, 4 → [0, 0, 1, 2, 0]; vision 6, 10 → 3, 5 → [0, 0, 1, 0, 1]; custom 4 → 2 → [0, 1, 0, 0, 0]. Consensus on the scale of the answers: vision, variance of {6, 10} = 4, spread 2, 10 × (1 − 2 ÷ 4.5) = 5.56; interaction, variance of {8, 6, 7} = 0.667, spread 0.816, 8.19; custom, one answer, 10; alignment round((8.19 + 5.56 + 10) ÷ 3) = 8, "high", as before. Band: 3.2 ≥ 3 → "good", as 6.3 ≥ 6 was. Mood: Sprint 41's three people who answered (Alice, Gus, the former member).

- [ ] **Step 2: Run it and see it fail, and prove the old values**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/HealthCheckParityTest.php`
Expected: FAIL on every case: the readers still query `health_check_answers`.

Before rewriting, prove the old values: check out the commit before Task 15 in a scratch worktree, add a throw-away test that builds `healthHistory()` and dumps `SummarizeHealthCheck::handle`, `BuildHealthTrend::handle` and `BuildTeamMoodTrend::handle` from the **old** code, and compare the dump with the old values above (7.0, 8.0, 4.0, 6.3, 5.0, 1.3, consensus 5.56). Any that differs is corrected, the health-scale literals are recomputed from it by §11.9 (never by halving a rounded literal), and the difference is reported. Do not commit the throw-away test.

- [ ] **Step 3: SummarizeHealthCheck**

`app/Actions/HealthCheck/SummarizeHealthCheck.php` — `handle` and `forSurvey` replace the old `handle` and `previousAverages`; `scoreOf`, `extremes`, `extreme` and `alignment` are kept as they are; the constant `MaximumSpread` goes (`HealthScale::maximumSpread`); `consensus` takes the scale; `assessment` reads `HealthScale::band`:

```php
    public function __construct(private HealthCheckSurvey $healthCheckSurvey) {}

    /**
     * The previous averages come from another session of the team, which a guest of this one must not see.
     *
     * @return array{
     *     statements: array<int, array{key: string, label: string, text: string, isBuiltin: bool, average: ?float, count: int, consensus: ?float, previousAverage: ?float, distribution: array<int, int>}>,
     *     score: float,
     *     participation: array{respondents: int, participants: int},
     *     topStrength: ?array{key: string, label: string, average: float},
     *     growthArea: ?array{key: string, label: string, average: float},
     *     alignment: array{value: int, level: string, label: string},
     *     assessment: array{band: string, title: string, sentence: string}
     * }|null
     */
    public function handle(Retro $retro, ?Participant $viewer = null): ?array
    {
        $survey = $this->healthCheckSurvey->forRetro($retro);

        if ($survey === null) {
            return null;
        }

        return $this->forSurvey($survey, $retro->participants()->count(), ! ($viewer?->isGuest() ?? false));
    }

    /**
     * Averages on the health scale (spec §11.9): each statement's mean on the
     * scale it was asked on, normalised, rounded once.
     *
     * @return array<string, mixed>|null
     */
    public function forSurvey(TeamSurvey $survey, int $participants, bool $withPrevious = true): ?array
    {
        $questions = $survey->questions()->get();

        $answers = TeamSurveyAnswer::query()
            ->whereIn('team_survey_question_id', $questions->pluck('id'))
            ->whereNotNull('value')
            ->get(['team_survey_question_id', 'team_survey_respondent_id', 'value']);

        $valuesByQuestion = $answers->groupBy('team_survey_question_id');
        $previousAverages = $withPrevious ? $this->previousAverages($survey) : [];

        $statements = $questions->map(function (TeamSurveyQuestion $question) use ($valuesByQuestion, $previousAverages): array {
            $scaleMax = (int) $question->scale_max;
            $values = $valuesByQuestion->get($question->id, collect())->map(fn (TeamSurveyAnswer $answer): int => (int) $answer->value)->values();
            $count = $values->count();
            $mean = $count === 0 ? null : $values->sum() / $count;
            $squares = $values->sum(fn (int $value): int => $value * $value);

            return [
                'key' => (string) $question->match_key,
                'label' => (string) $question->displayShortLabel(),
                'text' => $question->displayLabel(),
                'isBuiltin' => $question->builtin !== null,
                'average' => $mean === null ? null : HealthScale::average($mean, $scaleMax),
                'count' => $count,
                'consensus' => $mean === null ? null : $this->consensus($squares / $count - $mean ** 2, $scaleMax),
                'previousAverage' => $previousAverages[$question->match_key] ?? null,
                'distribution' => HealthScale::distribution($values->all(), $scaleMax),
            ];
        });

        $reported = $statements->whereNotNull('average')->values();

        if ($reported->isEmpty()) {
            return null;
        }

        $score = (float) self::scoreOf($reported->pluck('average')->all());
        [$topStrength, $growthArea] = $this->extremes($reported);

        return [
            'statements' => $statements->values()->all(),
            'score' => $score,
            'participation' => [
                'respondents' => $answers->pluck('team_survey_respondent_id')->unique()->count(),
                'participants' => $participants,
            ],
            'topStrength' => $topStrength,
            'growthArea' => $growthArea,
            'alignment' => $this->alignment((int) round((float) $reported->avg('consensus'))),
            'assessment' => $this->assessment($score),
        ];
    }

    /**
     * @return array<string, float> average on the health scale by statement key, in the team's previous closed health check
     */
    private function previousAverages(TeamSurvey $survey): array
    {
        if ($survey->closed_at === null) {
            return [];
        }

        $previous = TeamSurvey::query()
            ->where('team_id', $survey->team_id)
            ->whereKeyNot($survey->id)
            ->where('template', TeamSurveyTemplate::HealthCheck)
            ->where('status', TeamSurveyStatus::Closed)
            ->where('closed_at', '<', $survey->closed_at)
            ->whereHas('questions.answers')
            ->orderByDesc('closed_at')
            ->orderByDesc('id')
            ->first();

        if ($previous === null) {
            return [];
        }

        $questions = $previous->questions()->get(['id', 'match_key', 'scale_max'])->keyBy('id');

        return TeamSurveyAnswer::query()
            ->whereIn('team_survey_question_id', $questions->keys())
            ->whereNotNull('value')
            ->get(['team_survey_question_id', 'value'])
            ->groupBy('team_survey_question_id')
            ->mapWithKeys(function (Collection $own, string $questionId) use ($questions): array {
                $question = $questions[$questionId];
                $mean = $own->sum(fn (TeamSurveyAnswer $answer): int => (int) $answer->value) / $own->count();

                return [(string) $question->match_key => HealthScale::average($mean, (int) $question->scale_max)];
            })
            ->all();
    }

    private function consensus(float $variance, int $scaleMax): float
    {
        $spread = sqrt(max(0.0, $variance));

        return max(0.0, min(10.0, 10 * (1 - $spread / HealthScale::maximumSpread($scaleMax))));
    }

    /**
     * @return array{band: string, title: string, sentence: string}
     */
    private function assessment(float $score): array
    {
        return match (HealthScale::band($score)) {
            'excellent' => ['band' => 'excellent', 'title' => __('Excellent'), 'sentence' => __('The team is thriving. Keep doing what works.')],
            'good' => ['band' => 'good', 'title' => __('Good'), 'sentence' => __('Most health scores are above average. Keep the momentum going.')],
            'needs_attention' => ['band' => 'needs_attention', 'title' => __('Needs attention'), 'sentence' => __('Several areas need attention. Pick one to improve next.')],
            default => ['band' => 'critical', 'title' => __('Critical'), 'sentence' => __('The team is struggling. Talk about what would help most.')],
        };
    }
```

Two things the old code did are kept on purpose: the retro's summary is null without a visible health check (the old `health_check_enabled` test) and `participation.respondents` counts people who answered, not answers. One thing changes and is in the spec (§11.6): the previous health check may be a survey of its own.

- [ ] **Step 4: BuildHealthTrend**

`app/Actions/HealthCheck/BuildHealthTrend.php`:

```php
<?php

namespace App\Actions\HealthCheck;

use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use App\Support\Surveys\HealthScale;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class BuildHealthTrend
{
    private const int Points = 6;

    /**
     * Guests of one retro must not see the team's other sessions.
     *
     * @return array<int, array{retroId: ?string, surveyId: string, title: string, completedAt: string, score: float, url: string, delta: ?float, sameStatements: bool}>|null
     */
    public function forViewer(Retro $retro, Participant $viewer): ?array
    {
        if ($viewer->isGuest()) {
            return null;
        }

        return $this->handle($retro);
    }

    /**
     * @return array<int, array{retroId: ?string, surveyId: string, title: string, completedAt: string, score: float, url: string, delta: ?float, sameStatements: bool}>
     */
    public function handle(Retro $retro): array
    {
        return $this->forTeam($retro->team_id, $retro->completed_at);
    }

    /**
     * @return array<int, array{retroId: ?string, surveyId: string, title: string, completedAt: string, score: float, url: string, delta: ?float, sameStatements: bool}>
     */
    public function forTeam(string $teamId, ?CarbonInterface $until = null): array
    {
        $surveys = $this->closedHealthChecks($teamId)
            ->when($until, fn ($query, $until) => $query->where('closed_at', '<=', $until))
            ->limit(self::Points)
            ->get()
            ->reverse()
            ->values();

        $keys = $this->keysOf($surveys);
        $scores = $this->scoresOf($surveys);
        $points = [];
        $previous = null;

        foreach ($surveys as $survey) {
            $score = $scores->get($survey->id);

            if ($score === null) {
                continue;
            }

            $ownKeys = $keys->get($survey->id, []);

            $points[] = [
                'retroId' => $survey->retro_id,
                'surveyId' => $survey->id,
                'title' => $survey->retro?->title ?? $survey->title,
                'completedAt' => $survey->closed_at->toIso8601String(),
                'score' => $score,
                'url' => $survey->retro_id === null ? route('surveys.results.show', $survey) : route('retros.show', $survey->retro_id),
                'delta' => $previous === null ? null : round($score - $previous['score'], 1),
                'sameStatements' => $previous === null || $previous['keys'] === $ownKeys,
            ];

            $previous = ['score' => $score, 'keys' => $ownKeys];
        }

        return $points;
    }

    /** @return Builder<TeamSurvey> */
    public function closedHealthChecks(string $teamId): Builder
    {
        return TeamSurvey::query()
            ->where('team_id', $teamId)
            ->where('template', TeamSurveyTemplate::HealthCheck)
            ->where('status', TeamSurveyStatus::Closed)
            ->whereNotNull('closed_at')
            ->whereHas('questions.answers')
            ->with('retro:id,title,phase,completed_at')
            ->orderByDesc('closed_at')
            ->orderByDesc('id');
    }

    /**
     * The score of each survey on the health scale: each question's mean on
     * its own scale, normalised and rounded, then `SummarizeHealthCheck::scoreOf`.
     *
     * @param  Collection<int, TeamSurvey>  $surveys
     * @return Collection<string, ?float> score by survey id, null when it has no answer
     */
    public function scoresOf(Collection $surveys): Collection
    {
        $questions = TeamSurveyQuestion::query()->whereIn('team_survey_id', $surveys->pluck('id'))->get(['id', 'team_survey_id', 'scale_max']);

        $valuesByQuestion = TeamSurveyAnswer::query()
            ->whereIn('team_survey_question_id', $questions->pluck('id'))
            ->whereNotNull('value')
            ->get(['team_survey_question_id', 'value'])
            ->groupBy('team_survey_question_id');

        $questionsBySurvey = $questions->groupBy('team_survey_id');

        return $surveys->mapWithKeys(function (TeamSurvey $survey) use ($questionsBySurvey, $valuesByQuestion): array {
            $averages = $questionsBySurvey->get($survey->id, collect())
                ->filter(fn (TeamSurveyQuestion $question): bool => $valuesByQuestion->has($question->id))
                ->map(function (TeamSurveyQuestion $question) use ($valuesByQuestion): float {
                    $own = $valuesByQuestion->get($question->id);

                    return HealthScale::average($own->sum(fn (TeamSurveyAnswer $answer): int => (int) $answer->value) / $own->count(), (int) $question->scale_max);
                })
                ->values()
                ->all();

            return [$survey->id => SummarizeHealthCheck::scoreOf($averages)];
        });
    }

    /**
     * @param  Collection<int, TeamSurvey>  $surveys
     * @return Collection<string, array<int, string>> sorted statement keys by survey id
     */
    private function keysOf(Collection $surveys): Collection
    {
        return TeamSurveyQuestion::query()
            ->whereIn('team_survey_id', $surveys->pluck('id'))
            ->get(['team_survey_id', 'match_key'])
            ->groupBy('team_survey_id')
            ->map(fn (Collection $questions) => $questions->pluck('match_key')->sort()->values()->all());
    }
}
```

The number of queries stays constant (surveys, their retros, questions twice, answers), which the existing "builds the trend with a constant number of queries" case checks (it counts the query log, it does not read it).

- [ ] **Step 5: BuildTeamMoodTrend**

`app/Actions/Teams/BuildTeamMoodTrend.php`:

```php
<?php

namespace App\Actions\Teams;

use App\Actions\HealthCheck\BuildHealthTrend;
use App\Enums\RetroPhase;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use Illuminate\Support\Collection;

class BuildTeamMoodTrend
{
    private const int Points = 8;

    public function __construct(private BuildHealthTrend $buildHealthTrend) {}

    /**
     * ROTI comes from completed retros (1 to 5). Mood comes from closed
     * health checks, on the health scale: the one attached to a completed
     * retro joins that retro's point, one run as a survey is a point of its own.
     *
     * @return list<array{
     *     retroId: ?string,
     *     surveyId: ?string,
     *     title: string,
     *     completedAt: string,
     *     url: string,
     *     mood: ?float,
     *     moodVoters: int,
     *     roti: ?float,
     *     rotiVoters: int
     * }>
     */
    public function handle(Team $team): array
    {
        $surveys = $this->buildHealthTrend->closedHealthChecks($team->id)->get();
        $scores = $this->buildHealthTrend->scoresOf($surveys);
        $voters = $this->votersOf($surveys);

        $attached = $surveys
            ->filter(fn (TeamSurvey $survey): bool => $survey->retro_id !== null && $scores->get($survey->id) !== null)
            ->keyBy('retro_id');

        $retros = Retro::query()
            ->where('team_id', $team->id)
            ->where('phase', RetroPhase::Completed)
            ->whereNotNull('completed_at')
            ->where(fn ($query) => $query->whereIn('id', $attached->keys())->orHas('rotiVotes'))
            ->withAvg('rotiVotes', 'score')
            ->withCount('rotiVotes')
            ->get(['id', 'title', 'completed_at']);

        $points = $retros->map(function (Retro $retro) use ($attached, $scores, $voters): array {
            $survey = $attached->get($retro->id);

            return [
                'retroId' => $retro->id,
                'surveyId' => $survey?->id,
                'title' => $retro->title,
                'completedAt' => $retro->completed_at->toIso8601String(),
                'url' => route('retros.show', $retro),
                'mood' => $survey === null ? null : $scores->get($survey->id),
                'moodVoters' => $survey === null ? 0 : (int) $voters->get($survey->id, 0),
                'roti' => $retro->roti_votes_avg_score === null ? null : round((float) $retro->roti_votes_avg_score, 1),
                'rotiVoters' => (int) $retro->roti_votes_count,
                'at' => $retro->completed_at,
                'id' => $retro->id,
            ];
        })->concat(
            $surveys
                ->filter(fn (TeamSurvey $survey): bool => $survey->retro_id === null && $scores->get($survey->id) !== null)
                ->map(fn (TeamSurvey $survey): array => [
                    'retroId' => null,
                    'surveyId' => $survey->id,
                    'title' => $survey->title,
                    'completedAt' => $survey->closed_at->toIso8601String(),
                    'url' => route('surveys.results.show', $survey),
                    'mood' => $scores->get($survey->id),
                    'moodVoters' => (int) $voters->get($survey->id, 0),
                    'roti' => null,
                    'rotiVoters' => 0,
                    'at' => $survey->closed_at,
                    'id' => $survey->id,
                ]),
        );

        return $points
            ->sort(fn (array $first, array $second): int => [$second['at'], $second['id']] <=> [$first['at'], $first['id']])
            ->take(self::Points)
            ->reverse()
            ->map(fn (array $point): array => collect($point)->except(['at', 'id'])->all())
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, TeamSurvey>  $surveys
     * @return Collection<string, int> people who answered, by survey id
     */
    private function votersOf(Collection $surveys): Collection
    {
        $surveyOfQuestion = TeamSurveyQuestion::query()->whereIn('team_survey_id', $surveys->pluck('id'))->pluck('team_survey_id', 'id');

        return TeamSurveyAnswer::query()
            ->whereIn('team_survey_question_id', $surveyOfQuestion->keys())
            ->get(['team_survey_question_id', 'team_survey_respondent_id'])
            ->groupBy(fn (TeamSurveyAnswer $answer): string => (string) $surveyOfQuestion[$answer->team_survey_question_id])
            ->map(fn (Collection $own): int => $own->pluck('team_survey_respondent_id')->unique()->count());
    }
}
```

`withAvg('rotiVotes', 'score')` is the relationship aggregate the portability work kept; its value is cast in PHP. A health check attached to a retro that is not completed (closed by hand during the retro) is in neither list until the retro is completed, as an open retro never was in this trend. The front adapter `lib/teams/mood-adapter.ts` keys a point by `retroId`; Task 26 moves it to `surveyId ?? retroId`.

- [ ] **Step 6: Board results, recap, AI summary, MCP**

In `PresentHealthCheck`, inject `SummarizeHealthCheck $summarizeHealthCheck`, add `results: ?array<string, mixed>` to the docblock and to the returned array:

```php
            'results' => $survey->status === TeamSurveyStatus::Closed ? $this->summarizeHealthCheck->handle($retro, $viewer) : null,
```

`RetroRecapMail::healthLine` uses the key `Health check: :score/5 (:respondents of :participants participants answered)`; the key with "/10" leaves the four language files.

`BuildSummaryInput::health()` adds `'scale' => HealthScale::Max` to its array (its docblock too), so that the model reads 3.2 as "out of 5".

In `app/Mcp/Tools/Retro/GetHealth.php`, inject `HealthCheckSurvey $healthCheckSurvey`; the `$description` says "while the health check is open, who has answered and your own scores; once it is closed, the average per category (1–5), the overall score, alignment, strongest and weakest categories and the trend over the team's last health checks. Individual scores of others are never returned."; and the body of `run` down to the summary becomes:

```php
        $validated = $request->validate(['board_id' => ['required', 'uuid']]);
        $retro = $this->context->retro($validated['board_id']);
        $survey = $this->healthCheckSurvey->forRetro($retro);

        if ($survey === null) {
            return Response::structured(['status' => 'not_run']);
        }

        if ($survey->status === TeamSurveyStatus::Open) {
            return Response::structured($this->inProgress($retro, $survey));
        }

        $summary = $this->summarizeHealthCheck->handle($retro);

        if ($summary === null) {
            return Response::structured(['status' => 'not_run']);
        }
```

The `completed` payload is unchanged except: a top-level `'scale' => HealthScale::Max`, each category's `'distribution' => $statement['distribution']`, and each trend point's `'surveyId' => $point['surveyId']` (`boardId` may be null). `inProgress(Retro $retro, TeamSurvey $survey)` keeps its output and adds `'scale'` (the health check's) and `'respondents'` (who have sent); it reads `PresentHealthProgress::forSurvey` and the caller's scores through the respondent of `$this->context->participant($retro)`, found without creating it (the same lookup as `PresentHealthCheck::respondentOf`, keyed by `match_key`). The status `collected` is gone (spec §11.7).

`app/Mcp/Prompts/TeamHealth.php`: after the sentence that describes the boards, add "Health scores are on a scale of 1 to 5; boards of before the change to that scale were answered on 1 to 10 and are read halved." (`AnalyzeRetro` needs nothing: it embeds the tool's payload, which carries `scale`.)

- [ ] **Step 7: Front readers on the health scale (lane H)**

| File | Change | Vitest |
|---|---|---|
| `skrum/health-check-form.tsx` | `healthCheckScale = 5`; the ends `t(':score · Strongly disagree', { score: 1 })` and `t(':score · Strongly agree', { score: scale })`; the doc comments say the server stores 1 to 5 (10 on an imported open health check); the digit handling for 10 stays for that case | five radios by default; the two ends; `0` picks 10 only with `scale={10}` |
| `skrum/health-check-results.tsx` | `healthCheckResultsScale = 5`; the `distribution` prop is now sent by the server (the comment "Backlog" goes) | the distribution bar renders five segments from the payload |
| `skrum/health-check-compact.tsx` | default scale 5 (from `healthCheckResultsScale`) | the bars and the alert threshold 3 |
| `skrum/health-check-summary.tsx` | the sentence `t(':count statements, scored 1–5, asked in every health check')`, and `t('1 statement, scored 1–5, asked in every health check')` for one | both sentences |
| `retro/results/health-radar.tsx` | rings at 1.25, 2.5, 3.75 and 5; the radius and the labels on "/5" | the label "Vision: 4.0/5" |
| `retro/results/health-trend.tsx` | the axis and the labels on "/5" | — (drawn by hand, allowed by `FrontEndRulesTest`) |
| `lib/retro/types.ts` | `HealthStatementResult.distribution: number[]`; `HealthCheckState.results: HealthResults \| null` | — |
| `lib/retro/session-end.ts` | `toHealthResults` passes `distribution` to each result | the distribution reaches the results |
| `lib/teams/mood-adapter.ts` | `healthScale = { min: 0, max: 5 }` (an old score read halved can be under 1) | the scale |

`npm run test -- health-check health-radar session-end mood-adapter`, `npm run types:check`, `npm run check`, `npm run build:front`.

- [ ] **Step 8: Existing tests that move to the new fixtures**

Every expected health number is recomputed from the fixture's raw scores by §11.9 (each statement's mean on its scale, normalised, rounded once; the score as the mean of those; bands 4, 3, 2), never by halving an old rounded literal. A fixture that reproduces an old health check passes `scaleMax: 10` to `answerHealthCheck` and keeps its raw scores; a fixture that tests today's behaviour answers on 5. The commit body lists each literal that moved, with its computation.

| File | Change |
|---|---|
| `HealthCheckSummaryTest.php` | `summarizedRetro()` builds its scores with `answerHealthCheck(..., scaleMax: 10)` and ends with `closeHealthCheck`; "summarises nothing when the health check is off or unanswered" uses a removed health check (status `draft`) for "off"; "summarises the frozen set of 3 and of 10 statements" reads the survey's questions; the three `previousAverage` cases close each health check at its retro's `completed_at`; the consensus literals do not move; every average, score and band literal moves to the health scale; one case is added on 5 (answers 4, 5, 3 → 4.0) |
| `HealthTrendTest.php` | `trendRetro()` likewise; expected points gain `surveyId` (assert with `toMatchArray` where the case used `toBe` on a whole point) and their scores move to the health scale; "builds the trend with a constant number of queries" keeps its bound, re-measured |
| `TeamMoodTrendTest.php` | `withHealthScores()` likewise; expected points gain `surveyId`; mood literals on the health scale. "leaves out open retros and the retros of another team" stays |
| `ResultsTest.php`, `SummaryInputTest.php`, `MessagesAndSummaryTest.php`, `ReadPrivacyTest.php` | health fixtures; numbers on the health scale; `SummaryInputTest` asserts `health.scale` 5 |
| `ResultsEmailTest.php`, `MailMockupTest.php` | the recap line reads ":score/5"; `MailMockupTest`'s "Health check: 7.5/10 (6 of 9 participants answered)" is recomputed from its fixture's raw scores |
| `InsightsHealthRotiTest.php` | `mcpHealthBoard()` attaches a health check and puts the retro in `Writing` for "while collecting"; "shows only respondents between the health check and completion" becomes "shows the results of a health check closed before the retro is completed" (status `completed`); averages on the health scale and `scale` 5; "never creates a participant when reading ROTI or health" also asserts that no respondent is created |
| `PromptsTest.php`, `CatalogueTest.php` | only if they assert the tool's description or the `team-health` text: the new wording |

- [ ] **Step 9: Run the tests on the four engines**

Run, for each of `pgsql`, `mariadb`, `mysql`, `sqlite`: `bin/test-db <engine> -- tests/Feature/Retros tests/Feature/Teams tests/Feature/TeamSurveys tests/Feature/Mcp tests/Feature/Mail tests/Feature/Integrations/ResultsEmailTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS, every case that Task 15 left red included.

Then: `grep -rn "health_check_answers\|retro_health_statements\|HealthCheckAnswer\|RetroHealthStatement\|healthCheckAnswers\|healthStatements()" app --include=*.php` shows only `app/Support/Surveys/ImportHealthChecks.php`, `VerifyHealthCheckImport.php`, the two old model files, the relations of `Retro.php` and `Participant.php`, `Team.php`'s team statements and `FreezeHealthStatements.php`. Anything else is a reader this plan missed: stop and report it.

- [ ] **Step 10: Commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app tests resources/js lang
git commit -m "feat(health): summaries, trends, the recap, the board results and the MCP tool read team surveys on the 1-to-5 scale"
```

---

## Step C — the screens

Task 17 is done by a single writer on the main branch; the five lanes are cut from its head. Every screen task follows the "Screen task procedure" of plan 18e, with the owner's working rules of today: read the README and the `preview.html` of the mockup first; build containers in `resources/js/components/surveys/` on `ui/`, `skrum/` and `session/` components (read each one named in the task before using it: the draft of this plan was written before rework 3 and several components changed); page thin (layout and container); Vitest written and run for logic and components; hooks (`data-test`, ids, English accessible names) listed in the task and kept, though no walkthrough uses them yet; **no browser walkthrough**; captures are taken once, in Task 31 (light, 1440, French), and compared with the mockup in Task 32; every difference fixed or added to **Pre-build deviations** with the owner's word.

### Task 17: Front foundation — types, reducer, adapter, channel hook, shared component changes

**Files:**
- Create: `resources/js/lib/surveys/types.ts`, `survey-reducer.ts`, `survey-reducer.test.ts`, `question-adapter.ts`, `question-adapter.test.ts`, `api.ts`
- Create: `resources/js/hooks/use-survey-channel.ts`, `resources/js/hooks/use-team-survey.ts`
- Modify (each in its own commit): `resources/js/components/skrum/survey-question.tsx` (+ test, + `pages/dev/sections/survey-question.tsx`), `resources/js/components/skrum/guest-join.tsx` (+ test) and `resources/js/components/session/guest-join-page.tsx` (+ test)
- Test: the two `.test.ts` files above and the component tests

Already there, nothing to add: `skrum/session-card.tsx` has the kind `survey` (iris, `ChartColumn`); `skrum/share-dialog.tsx` has the `ShareSessionKind` `survey`; `skrum/session-type-picker.tsx` has the `survey` option; `skrum/empty-state.tsx` has the module `survey`.

**Interfaces:**
- Consumes: the snapshot of Tasks 3, 9, 10, 11; `retroRequest` and `RetroRequestError` of `@/lib/retro/api`; the Wayfinder actions of `@/actions/App/Http/Controllers/TeamSurveys/*` (run `npm run build:front` first); `useSafeConnectionStatus` of `hooks/use-retro-channel`; `hooks/use-whiteboard-channel.ts` and `hooks/use-whiteboard.ts` (the pattern of a live session hook with `realtime` and `connection` for `SessionShell`).
- Produces: the types below; `surveyReducer(state: SurveySnapshot, action: SurveyAction): SurveySnapshot`; `toQuestionProps(question, options): SurveyQuestionProps`; `surveyApi` (one function per route); `useSurveyChannel(surveyId, enabled, handlers)`; `useTeamSurvey(initial: SurveySnapshot): { snapshot, dispatch, refetch, online, realtime, connection, gone }`; on `SurveyQuestion`: props `comment?: string`, `onCommentChange?: (value: string) => void`, `chrome?: 'card' | 'none'`, `labelledBy?: string`, and in `results`: `mode?: number | null`, `segments?: { detractors: number; passives: number; promoters: number }`, `delta?: { value: number; against: string } | null`. No scale of ten reaches a survey page (an attached health check is refused by the survey scope, §6.3 of the spec), so `SurveyQuestion` keeps its scale of five (`scale5`).

- [ ] **Step 1: Types**

`resources/js/lib/surveys/types.ts`:

```ts
export type SurveyStatus = 'draft' | 'open' | 'closed';

export type SurveyKind = 'scale' | 'nps' | 'single' | 'multiple' | 'text';

export type SurveyAnswer = {
    value: number | null;
    optionIds: string[];
    text: string | null;
    comment: string | null;
};

export type SurveyOptionPayload = { id: string; label: string };

export type SurveyQuestionPayload = {
    id: string;
    kind: SurveyKind;
    label: string;
    shortLabel: string | null;
    description: string | null;
    position: number;
    isRequired: boolean;
    allowsComment: boolean;
    scaleMax: number | null;
    scaleLabels: [string | null, string | null] | null;
    isBuiltin: boolean;
    options: SurveyOptionPayload[];
    myAnswer: SurveyAnswer | null;
};

export type SurveyBucket = { key: string; label: string; count: number };

export type SurveyTextEntry = { id: string; text: string; isMine: boolean };

export type SurveyQuestionSummary = {
    responses: number;
    mean?: number | null;
    mode?: number | null;
    nps?: number | null;
    detractors?: number;
    passives?: number;
    promoters?: number;
    buckets?: SurveyBucket[];
    options?: { id: string; label: string; count: number }[];
    answers?: SurveyTextEntry[];
    comments?: SurveyTextEntry[];
};

export type SurveyResults = {
    belowThreshold: boolean;
    responses: number;
    questions: Record<string, SurveyQuestionSummary>;
};

export type SurveyProgress = {
    responses: number;
    completed: number;
    audience: number;
};

export type SurveyComparable = {
    defaultId: string | null;
    surveys: { id: string; title: string; closedAt: string | null }[];
};

export type SurveySnapshot = {
    survey: {
        id: string;
        title: string;
        description: string | null;
        status: SurveyStatus;
        template: 'health_check' | 'team_pulse' | null;
        hasLockedQuestions: boolean;
        teamId: string;
        teamName: string | null;
        retroId: string | null;
        facilitatorName: string | null;
        guestAccessEnabled: boolean;
        guestUrl: string | null;
        oneQuestionAtATime: boolean;
        showResultsAfterAnswer: boolean;
        resultsThreshold: number;
        version: number;
        openedAt: string | null;
        closedAt: string | null;
    };
    me: {
        id: string;
        name: string;
        avatarUrl: string;
        isGuest: boolean;
        isEditor: boolean;
        hasSubmitted: boolean;
        canSeeResults: boolean;
    };
    questions: SurveyQuestionPayload[];
    progress: SurveyProgress;
    results: SurveyResults | null;
    comparable: SurveyComparable | null;
    links: {
        team: string | null;
        show: string;
        results: string;
        edit: string | null;
    };
    serverTime: string;
};

export type SurveyComparisonPair = {
    questionId: string;
    otherQuestionId: string;
    kind: SurveyKind;
    label: string;
    current: Record<string, unknown>;
    other: Record<string, unknown>;
    delta: number | { label: string; delta: number }[] | null;
};

export type SurveyComparison = {
    other: { id: string; title: string; closedAt: string | null };
    belowThreshold: boolean;
    pairs: SurveyComparisonPair[];
    onlyHere: { questionId: string; label: string; kind: SurveyKind }[];
    onlyThere: { questionId: string; label: string; kind: SurveyKind }[];
};

export type TeamSurveySummary = {
    id: string;
    title: string;
    status: SurveyStatus;
    template: string | null;
    questionCount: number;
    responseCount: number;
    updatedAt: string | null;
    closedAt: string | null;
    facilitatorName: string | null;
    canManage: boolean;
    url: string;
};

export type SurveyTemplateOption = {
    key: 'health_check' | 'team_pulse' | null;
    name: string;
    description: string;
    questionCount: number;
};
```

- [ ] **Step 2: Reducer, test first**

`resources/js/lib/surveys/survey-reducer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { surveyReducer } from './survey-reducer';
import type { SurveyQuestionPayload, SurveySnapshot } from './types';

function question(
    id: string,
    position: number,
    overrides: Partial<SurveyQuestionPayload> = {},
): SurveyQuestionPayload {
    return {
        id,
        kind: 'scale',
        label: `Question ${id}`,
        shortLabel: null,
        description: null,
        position,
        isRequired: false,
        allowsComment: false,
        scaleMax: 5,
        scaleLabels: [null, null],
        isBuiltin: false,
        options: [],
        myAnswer: null,
        ...overrides,
    };
}

function snapshot(overrides: Partial<SurveySnapshot> = {}): SurveySnapshot {
    return {
        survey: {
            id: 's1',
            title: 'Pulse',
            description: null,
            status: 'open',
            template: null,
            hasLockedQuestions: false,
            teamId: 't1',
            teamName: 'Atlas',
            retroId: null,
            facilitatorName: 'Fran',
            guestAccessEnabled: false,
            guestUrl: null,
            oneQuestionAtATime: true,
            showResultsAfterAnswer: true,
            resultsThreshold: 3,
            version: 4,
            openedAt: null,
            closedAt: null,
        },
        me: {
            id: 'r1',
            name: 'Me',
            avatarUrl: '/a.svg',
            isGuest: false,
            isEditor: false,
            hasSubmitted: false,
            canSeeResults: false,
        },
        questions: [question('a', 0), question('b', 1)],
        progress: { responses: 0, completed: 0, audience: 11 },
        results: null,
        comparable: null,
        links: { team: '/t', show: '/s', results: '/r', edit: null },
        serverTime: '2026-10-19T10:00:00.000Z',
        ...overrides,
    };
}

describe('surveyReducer', () => {
    it('sets and clears the own answer of one question, and takes the counts that came with it', () => {
        const answered = surveyReducer(snapshot(), {
            type: 'answer.set',
            questionId: 'b',
            answer: { value: 4, optionIds: [], text: null, comment: null },
            progress: { responses: 1, completed: 0, audience: 11 },
        });

        expect(answered.questions[1].myAnswer?.value).toBe(4);
        expect(answered.questions[0].myAnswer).toBeNull();
        expect(answered.progress.responses).toBe(1);

        const cleared = surveyReducer(answered, {
            type: 'answer.set',
            questionId: 'b',
            answer: null,
        });

        expect(cleared.questions[1].myAnswer).toBeNull();
        expect(cleared.progress.responses).toBe(1);
    });

    it('moves the counters from an event and keeps the audience', () => {
        const next = surveyReducer(snapshot(), {
            type: 'progress.set',
            responses: 7,
            completed: 5,
        });

        expect(next.progress).toEqual({
            responses: 7,
            completed: 5,
            audience: 11,
        });
    });

    it('replaces the snapshot, except with one older than what it holds', () => {
        const current = snapshot();
        const older = snapshot({
            survey: { ...current.survey, version: 3, title: 'Stale' },
        });
        const newer = snapshot({
            survey: { ...current.survey, version: 5, title: 'Fresh' },
        });

        expect(
            surveyReducer(current, { type: 'snapshot.replace', snapshot: older })
                .survey.title,
        ).toBe('Pulse');
        expect(
            surveyReducer(current, { type: 'snapshot.replace', snapshot: newer })
                .survey.title,
        ).toBe('Fresh');
    });

    it('adds, replaces, removes and reorders questions, keeping positions in step', () => {
        const added = surveyReducer(snapshot(), {
            type: 'question.upsert',
            question: question('c', 2),
        });
        expect(added.questions.map((item) => item.id)).toEqual(['a', 'b', 'c']);

        const replaced = surveyReducer(added, {
            type: 'question.upsert',
            question: question('b', 1, { label: 'Renamed' }),
        });
        expect(replaced.questions[1].label).toBe('Renamed');

        const reordered = surveyReducer(replaced, {
            type: 'question.reorder',
            ids: ['c', 'a', 'b'],
        });
        expect(reordered.questions.map((item) => item.id)).toEqual([
            'c',
            'a',
            'b',
        ]);
        expect(reordered.questions.map((item) => item.position)).toEqual([
            0, 1, 2,
        ]);

        const removed = surveyReducer(reordered, {
            type: 'question.remove',
            questionId: 'a',
        });
        expect(removed.questions.map((item) => item.position)).toEqual([0, 1]);
    });

    it('inserts a duplicated question right after the position it carries', () => {
        const next = surveyReducer(snapshot(), {
            type: 'question.upsert',
            question: question('copy', 1),
        });

        expect(next.questions.map((item) => item.id)).toEqual([
            'a',
            'copy',
            'b',
        ]);
    });
});
```

Run: `npm run test -- survey-reducer` — Expected: FAIL, the module does not exist.

`resources/js/lib/surveys/survey-reducer.ts`:

```ts
import type {
    SurveyAnswer,
    SurveyProgress,
    SurveyQuestionPayload,
    SurveySnapshot,
} from './types';

export type SurveyAction =
    | { type: 'snapshot.replace'; snapshot: SurveySnapshot }
    | {
          type: 'answer.set';
          questionId: string;
          answer: SurveyAnswer | null;
          progress?: SurveyProgress;
      }
    | { type: 'progress.set'; responses: number; completed: number }
    | { type: 'question.upsert'; question: SurveyQuestionPayload }
    | { type: 'question.remove'; questionId: string }
    | { type: 'question.reorder'; ids: string[] };

function renumbered(questions: SurveyQuestionPayload[]): SurveyQuestionPayload[] {
    return questions.map((question, position) => ({ ...question, position }));
}

function upserted(
    questions: SurveyQuestionPayload[],
    question: SurveyQuestionPayload,
): SurveyQuestionPayload[] {
    if (questions.some((known) => known.id === question.id)) {
        return questions.map((known) =>
            known.id === question.id
                ? { ...question, myAnswer: known.myAnswer }
                : known,
        );
    }

    const index = Math.min(Math.max(question.position, 0), questions.length);

    return renumbered([
        ...questions.slice(0, index),
        question,
        ...questions.slice(index),
    ]);
}

export function surveyReducer(
    state: SurveySnapshot,
    action: SurveyAction,
): SurveySnapshot {
    switch (action.type) {
        case 'snapshot.replace':
            if (action.snapshot.survey.version < state.survey.version) {
                return state;
            }

            return action.snapshot;
        case 'answer.set':
            return {
                ...state,
                questions: state.questions.map((question) =>
                    question.id === action.questionId
                        ? { ...question, myAnswer: action.answer }
                        : question,
                ),
                progress: action.progress ?? state.progress,
            };
        case 'progress.set':
            return {
                ...state,
                progress: {
                    ...state.progress,
                    responses: action.responses,
                    completed: action.completed,
                },
            };
        case 'question.upsert':
            return {
                ...state,
                questions: upserted(state.questions, action.question),
            };
        case 'question.remove':
            return {
                ...state,
                questions: renumbered(
                    state.questions.filter(
                        (question) => question.id !== action.questionId,
                    ),
                ),
            };
        case 'question.reorder':
            return {
                ...state,
                questions: renumbered(
                    action.ids
                        .map((id) =>
                            state.questions.find(
                                (question) => question.id === id,
                            ),
                        )
                        .filter(
                            (question): question is SurveyQuestionPayload =>
                                question !== undefined,
                        ),
                ),
            };
    }
}
```

Run: `npm run test -- survey-reducer` — Expected: PASS.

- [ ] **Step 3: Adapter to `SurveyQuestion`, test first**

`resources/js/lib/surveys/question-adapter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { answerOf, toQuestionProps } from './question-adapter';
import type { SurveyQuestionPayload } from './types';

const base: SurveyQuestionPayload = {
    id: 'q1',
    kind: 'scale',
    label: 'Workload',
    shortLabel: null,
    description: null,
    position: 0,
    isRequired: true,
    allowsComment: true,
    scaleMax: 5,
    scaleLabels: ['Unbearable', 'Very comfortable'],
    isBuiltin: false,
    options: [],
    myAnswer: null,
};

describe('toQuestionProps', () => {
    it('maps a scale to the component kind, with its ends and the viewer answer', () => {
        const props = toQuestionProps(
            {
                ...base,
                myAnswer: { value: 4, optionIds: [], text: null, comment: 'ok' },
            },
            { mode: 'answer', index: 2, count: 5 },
        );

        expect(props.kind).toBe('scale5');
        expect(props.scaleLabels).toEqual(['Unbearable', 'Very comfortable']);
        expect(props.value).toBe(4);
        expect(props.comment).toBe('ok');
        expect(props.required).toBe(true);
        expect(props.index).toBe(2);
        expect(props.count).toBe(5);
        expect(props.anonymous).toBe(true);
    });

    it('gives a single choice its option id and a multiple choice its list', () => {
        const options = [
            { id: 'o1', label: 'A' },
            { id: 'o2', label: 'B' },
        ];
        const answer = { value: null, optionIds: ['o2'], text: null, comment: null };

        expect(
            toQuestionProps(
                { ...base, kind: 'single', options, myAnswer: answer },
                { mode: 'answer' },
            ).value,
        ).toBe('o2');
        expect(
            toQuestionProps(
                { ...base, kind: 'multiple', options, myAnswer: answer },
                { mode: 'answer' },
            ).value,
        ).toEqual(['o2']);
        expect(
            toQuestionProps(
                { ...base, kind: 'multiple', options, myAnswer: null },
                { mode: 'answer' },
            ).value,
        ).toEqual([]);
    });

    it('never invents a count: without a summary the results are hidden', () => {
        const props = toQuestionProps(
            { ...base, kind: 'single', options: [{ id: 'o1', label: 'A' }] },
            { mode: 'results', responses: 4 },
        );

        expect(props.results).toEqual({ responses: 4, hidden: true });
        expect(props.options?.[0].count).toBeUndefined();
    });

    it('passes the summary of each kind through', () => {
        const nps = toQuestionProps(
            { ...base, kind: 'nps', scaleMax: null },
            {
                mode: 'results',
                summary: {
                    responses: 9,
                    nps: 22,
                    detractors: 2,
                    passives: 3,
                    promoters: 4,
                    buckets: [{ key: '0', label: '0', count: 0 }],
                    comments: [],
                },
            },
        );

        expect(nps.results).toMatchObject({
            responses: 9,
            nps: 22,
            segments: { detractors: 2, passives: 3, promoters: 4 },
        });

        const text = toQuestionProps(
            { ...base, kind: 'text' },
            {
                mode: 'results',
                summary: {
                    responses: 1,
                    answers: [{ id: 'a1', text: 'thanks', isMine: true }],
                },
            },
        );

        expect(text.results?.textAnswers).toEqual([
            { id: 'a1', text: 'thanks', isMine: true },
        ]);

        const choice = toQuestionProps(
            { ...base, kind: 'multiple', options: [{ id: 'o1', label: 'A' }] },
            {
                mode: 'results',
                summary: {
                    responses: 9,
                    options: [{ id: 'o1', label: 'A', count: 6 }],
                },
            },
        );

        expect(choice.options?.[0].count).toBe(6);
    });
});

describe('answerOf', () => {
    it('builds the request body of each kind and refuses an empty answer', () => {
        expect(answerOf(base, 4, 'because')).toEqual({ value: 4, comment: 'because' });
        expect(answerOf({ ...base, allowsComment: false }, 4, 'x')).toEqual({ value: 4 });
        expect(answerOf({ ...base, kind: 'nps' }, 0, '')).toEqual({ value: 0 });
        expect(answerOf({ ...base, kind: 'single' }, 'o1', '')).toEqual({ optionId: 'o1' });
        expect(answerOf({ ...base, kind: 'multiple' }, ['o1', 'o2'], '')).toEqual({ optionIds: ['o1', 'o2'] });
        expect(answerOf({ ...base, kind: 'text' }, '  thanks  ', '')).toEqual({ text: 'thanks' });
        expect(answerOf({ ...base, kind: 'text' }, '   ', '')).toBeNull();
        expect(answerOf({ ...base, kind: 'multiple' }, [], '')).toBeNull();
        expect(answerOf(base, null, '')).toBeNull();
    });
});
```

`resources/js/lib/surveys/question-adapter.ts`:

```ts
import type {
    SurveyQuestionProps,
    SurveyQuestionValue,
} from '@/components/skrum/survey-question';
import type { SurveyQuestionPayload, SurveyQuestionSummary } from './types';

type AdapterOptions = {
    mode: 'answer' | 'results';
    index?: number;
    count?: number;
    /** The server's summary; absent when the viewer may not see results. */
    summary?: SurveyQuestionSummary;
    /** The number of answers, shown even when the results are hidden. */
    responses?: number;
};

const componentKind = {
    scale: 'scale5',
    nps: 'nps',
    single: 'single',
    multiple: 'multiple',
    text: 'text',
} as const;

function valueOf(question: SurveyQuestionPayload): SurveyQuestionValue {
    const answer = question.myAnswer;

    switch (question.kind) {
        case 'scale':
        case 'nps':
            return answer?.value ?? null;
        case 'single':
            return answer?.optionIds[0] ?? null;
        case 'multiple':
            return answer?.optionIds ?? [];
        case 'text':
            return answer?.text ?? '';
    }
}

function resultsOf(
    summary: SurveyQuestionSummary | undefined,
    responses: number,
): SurveyQuestionProps['results'] {
    if (summary === undefined) {
        return { responses, hidden: true };
    }

    return {
        responses: summary.responses,
        mean: summary.mean ?? undefined,
        mode: summary.mode,
        nps: summary.nps ?? undefined,
        segments:
            summary.promoters === undefined
                ? undefined
                : {
                      detractors: summary.detractors ?? 0,
                      passives: summary.passives ?? 0,
                      promoters: summary.promoters,
                  },
        buckets: summary.buckets,
        textAnswers: summary.answers,
    };
}

export function toQuestionProps(
    question: SurveyQuestionPayload,
    options: AdapterOptions,
): SurveyQuestionProps {
    const counts = new Map(
        (options.summary?.options ?? []).map((option) => [
            option.id,
            option.count,
        ]),
    );

    return {
        id: question.id,
        kind: componentKind[question.kind],
        label: question.label,
        description: question.description,
        mode: options.mode,
        index: options.index,
        count: options.count,
        required: question.isRequired,
        anonymous: true,
        scaleLabels:
            question.scaleLabels?.[0] && question.scaleLabels[1]
                ? [question.scaleLabels[0], question.scaleLabels[1]]
                : undefined,
        maxLength: 500,
        options: question.options.map((option) => ({
            id: option.id,
            label: option.label,
            count: counts.get(option.id),
        })),
        value: valueOf(question),
        comment: question.myAnswer?.comment ?? '',
        hasAnswered: question.myAnswer !== null,
        results:
            options.mode === 'results'
                ? resultsOf(options.summary, options.responses ?? 0)
                : undefined,
    };
}

export type AnswerBody =
    | { value: number; comment?: string }
    | { optionId: string }
    | { optionIds: string[] }
    | { text: string };

/** The body of `surveys.answers.update`, or null when there is nothing to save. */
export function answerOf(
    question: SurveyQuestionPayload,
    value: SurveyQuestionValue,
    comment: string,
): AnswerBody | null {
    switch (question.kind) {
        case 'scale':
        case 'nps': {
            if (typeof value !== 'number') {
                return null;
            }

            const trimmed = comment.trim();

            return question.allowsComment && trimmed !== ''
                ? { value, comment: trimmed }
                : { value };
        }
        case 'single':
            return typeof value === 'string' && value !== ''
                ? { optionId: value }
                : null;
        case 'multiple':
            return Array.isArray(value) && value.length > 0
                ? { optionIds: value }
                : null;
        case 'text': {
            const text = typeof value === 'string' ? value.trim() : '';

            return text === '' ? null : { text };
        }
    }
}
```

Run: `npm run test -- question-adapter` — Expected: FAIL until Step 4 adds the new props to `SurveyQuestionProps`, then PASS.

- [ ] **Step 4: `SurveyQuestion` gains what the three survey screens need (own commit)**

Read `SurveyQuestion/README.md` and `preview.html` again, then in `resources/js/components/skrum/survey-question.tsx`, each with a Vitest case in `survey-question.test.tsx` and a state on the dev bench section:

| Addition | Behaviour | Test |
|---|---|---|
| `comment?: string`, `onCommentChange?` | for `scale5` and `nps` in answer mode, when `onCommentChange` is given: a labelled textarea "Why this score? (optional)", 500 characters, under the scale | typing calls `onCommentChange`; absent without the handler |
| `chrome?: 'card' \| 'none'` (default `card`), `labelledBy?: string` | `none` renders the control and its helper lines only: no card, no header, no footer; the group is named by `labelledBy` | no `article`; the radiogroup has `aria-labelledby` |
| `results.mode?: number \| null` | a second key figure "most frequent answer" beside the mean | shown for a scale, absent when null |
| `results.segments?` | NPS: the stacked bar detractors / passives / promoters with its percentages, `role="img"` and a written `aria-label`, and the three-count legend, above the distribution | the label reads "2 detractors, 3 passives, 4 promoters" |
| `results.delta?: { value: number; against: string } \| null` | a badge beside the key figure: "+11 vs Sprint 41", success tone when positive, destructive tone with the `trending-down` icon when negative, neutral "no change" at 0; never colour alone | the three wordings |

No existing prop changes meaning: the retro surveys (`components/retro/surveys/`, `lib/retro/survey-question-adapter.ts`, rework 3 included) bind this component and their Vitest files must stay green (`npm run test -- surveys survey-question`).

- [ ] **Step 5: API, channel hook, state hook**

`resources/js/lib/surveys/api.ts` exports `surveyApi`, one function per route, each calling `retroRequest` with the Wayfinder action (the pattern of `lib/retro/survey-api.ts`): `snapshot(id)`, `update(id, patch)`, `addQuestion(id, body)`, `updateQuestion(id, questionId, body)`, `removeQuestion(id, questionId)`, `reorderQuestions(id, ids)`, `duplicateQuestion(id, questionId)`, `setStatus(id, status)`, `saveAnswer(id, questionId, body)`, `withdrawAnswer(id, questionId)`, `submit(id)`, `reopenResponse(id)`, `comparison(id, withId?)`, `newGuestLink(id)`, `destroy(id)`. Return types are the payloads of the tasks that own the routes (`SurveySnapshot` for `snapshot`, `update`, `submit`, `reopenResponse`; `{ question: SurveyQuestionPayload }`; `{ answer: SurveyAnswer | null; progress: SurveyProgress }`; `{ comparison: SurveyComparison | null }`; `{ guestUrl: string }`; `null` for the 204 answers).

`resources/js/hooks/use-survey-channel.ts`: a copy of `use-whiteboard-channel.ts` with the channel `survey.${surveyId}` and the events `['survey.changed', 'survey.responses.changed', 'survey.deleted']`; same presence handling, same resync on reconnect.

`resources/js/hooks/use-team-survey.ts`:

```ts
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { surveyApi } from '@/lib/surveys/api';
import { surveyReducer } from '@/lib/surveys/survey-reducer';
import type { SurveySnapshot, SurveyStatus } from '@/lib/surveys/types';
import { useSurveyChannel } from './use-survey-channel';

const RefetchDelayMs = 1000;

export function useTeamSurvey(initial: SurveySnapshot) {
    const [snapshot, dispatch] = useReducer(surveyReducer, initial);
    const [gone, setGone] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latest = useRef(snapshot);

    latest.current = snapshot;

    const refetch = useCallback(async () => {
        try {
            dispatch({
                type: 'snapshot.replace',
                snapshot: await surveyApi.snapshot(initial.survey.id),
            });
        } catch {
            // The next event or reconnect asks again.
        }
    }, [initial.survey.id]);

    const scheduleRefetch = useCallback(() => {
        if (timer.current !== null) {
            clearTimeout(timer.current);
        }

        timer.current = setTimeout(() => void refetch(), RefetchDelayMs);
    }, [refetch]);

    useEffect(
        () => () => {
            if (timer.current !== null) {
                clearTimeout(timer.current);
            }
        },
        [],
    );

    const channel = useSurveyChannel(initial.survey.id, !gone, {
        onEvent: (event) => {
            switch (event.name) {
                case 'survey.changed': {
                    const payload = event.payload as {
                        version: number;
                        status: SurveyStatus;
                    };

                    if (
                        payload.version !== latest.current.survey.version ||
                        payload.status !== latest.current.survey.status
                    ) {
                        void refetch();
                    }

                    break;
                }
                case 'survey.responses.changed': {
                    const payload = event.payload as {
                        responses: number;
                        completed: number;
                    };

                    dispatch({ type: 'progress.set', ...payload });

                    if (latest.current.me.canSeeResults) {
                        scheduleRefetch();
                    }

                    break;
                }
                case 'survey.deleted':
                    setGone(true);
                    break;
            }
        },
        onResync: () => void refetch(),
    });

    return { snapshot, dispatch, refetch, gone, ...channel };
}
```

`channel` spreads what `useWhiteboardChannel` returns (`online`, the connection status); the containers derive `realtime` and `connection` from it exactly as `hooks/use-whiteboard.ts` does. A viewer who may not see results never refetches on an answer: the counter moves from the event alone.

- [ ] **Step 6: The kind "survey" in the shared pieces (own commit each)**

- `skrum/guest-join.tsx`: `GuestJoinSessionKind` (`'retro' | 'poker' | 'whiteboard' | 'game'` today) gains `'survey'` (icon `ChartColumn`, label `t('Survey')`, the iris tone of `SessionTypePicker`'s survey tile; the card's poker kind also uses iris here, the icon and the label tell them apart); `components/session/guest-join-page.tsx` accepts it (its `kind` prop is typed by that union).
- The `#surveys` block lives inside the `#sessions` area of the team page, which the sidebar's "Sessions" entry already reaches: no change to `use-team-anchor.ts` or the sidebar model unless its test says otherwise.

- [ ] **Step 7: Gates and commits**

Run: `npm run test`, `npm run types:check`, `npm run check`, `npm run build:front` — Expected: PASS.

```bash
git add resources/js/components/skrum/survey-question.tsx resources/js/components/skrum/survey-question.test.tsx resources/js/pages/dev/sections/survey-question.tsx lang
git commit -m "feat(skrum): SurveyQuestion — optional comment, bare chrome, NPS segments, most frequent answer, delta badge"
git add resources/js/components/skrum/guest-join.tsx resources/js/components/skrum/guest-join.test.tsx resources/js/components/session/guest-join-page.tsx resources/js/components/session/guest-join-page.test.tsx
git commit -m "feat(skrum): the survey kind on the guest-join card and page"
git add resources/js/lib/surveys resources/js/hooks/use-survey-channel.ts resources/js/hooks/use-team-survey.ts
git commit -m "feat(surveys): front types, reducer, question adapter, API and channel hook"
```

### Task 18 (lane Create): The Poll type in the "New session" dialog

**Mockup:** `ScreenSessionCreate` (the tile, the dialog frame, the footer), `SessionTypePicker` (tile content). The Poll variant of the form is P19-13.

**Files:**
- Create: `resources/js/components/teams/session-create/survey-session-fields.tsx` (+ `.test.tsx`)
- Modify: `resources/js/components/skrum/session-type-picker.tsx` (+ test), `resources/js/components/teams/session-create/new-session-dialog.tsx` (+ test), `use-new-session-intent.ts` (+ test), `resources/js/components/teams/team-page.tsx`, `resources/js/types/workspaces.ts`, `resources/js/pages/dev/sections/session-type-picker.tsx`

**Interfaces:**
- Consumes: props of `teams/show` from Task 13 (`surveys: TeamSurveySummary[]`, `canCreateSurvey: boolean`, `surveyTemplates: SurveyTemplateOption[]`); `TeamSurveysController.store` (Wayfinder); `setting-row.tsx`, `field-error.tsx`, `SessionFormFooter` of `new-session-dialog.tsx`.
- Produces: the dialog opens on `?new=survey`, with `&template=health_check|team_pulse` preselecting the template.

Read first, as they are now: `new-session-dialog.tsx` (one form prop per type — `retro`, `poker`, `whiteboard`, `icebreaker` — `typeOrder`, `useTypeOptions` and its `descriptions` record, `SessionFormFooter`), `whiteboard-session-fields.tsx` (the closest sibling: a name, a gallery, a settings row, `useForm` to the store route), `use-new-session-intent.ts` (its own `SessionType` union, narrower than the picker's). The picker already has the `survey` kind (iris, `ChartColumn`) with the label "Survey".

- [ ] **Step 1: Tile (own commit).** In `session-type-picker.tsx` the `survey` option reads `t('Poll')`, `t('Quick vote or health check')`, `t('5–10 min')`; the inline description of the dialog (`descriptions` of `useTypeOptions`) is `t('Quick vote')`. Update `session-type-picker.test.tsx` and the dev bench section. The key stays `survey`.
- [ ] **Step 2: Failing Vitest.** `survey-session-fields.test.tsx`: (a) the default choice is "Blank" and the body is `{ title, guest_access_enabled: false }` without `template`; (b) choosing "Health check" sends `template: 'health_check'` and shows "6 statements · scored 1 to 5" from `questionCount`; (c) choosing "A previous survey" reveals `#new-survey-source` listing the surveys that are not drafts, and sends `source_survey_id` and no `template`; (d) with no such survey that tile is disabled with "No survey to start from yet"; (e) the title is prefilled with the chosen template's name and today's short date, and is not overwritten once the user has typed; (f) a server error on `title` shows under the field. `new-session-dialog.test.tsx`: five tiles in the order Retro, Poker, Whiteboard, Poll, Icebreaker; the Poll tile carries its `disabledReason` when `canCreateSurvey` is false. `use-new-session-intent.test.ts`: `?new=survey&template=health_check` yields `{ type: 'survey', template: 'health_check' }`; an unknown template is dropped.
- [ ] **Step 3: Build.** `SurveySessionFields`: `Name` (`#new-survey-title`, `ui/input`, 120 characters); `Start from` (`role="radiogroup"`, `aria-labelledby`, one tile per `surveyTemplates` entry plus "A previous survey", composed as the retro template shortcut tiles: title, one line, a `Badge variant="outline"` "Built-in" on the health check); the select `#new-survey-source` (`ui/select`, labels truncated); the settings row "Allow guests without an account" (`#new-survey-guests`, `ui/switch`, through `setting-row.tsx`). Submission through Inertia's `useForm` to `TeamSurveysController.store`, as `whiteboard-session-fields.tsx` does; the footer is `SessionFormFooter` with no `secondaryAction` (scheduling is backlog). `new-session-dialog.tsx`: a `survey?: SurveySessionForm` prop; `'survey'` joins `typeOrder` between `whiteboard` and `icebreaker` and `descriptions`; `team-page.tsx` passes the form when the team page has `canCreateSurvey` (with its `disabledReason` otherwise). `use-new-session-intent.ts`: `SessionType` and the intent parser gain `'survey'` and the optional `template`.
- [ ] **Step 4: Hooks kept for later tests.** Ids `#new-survey-title`, `#new-survey-source`, `#new-survey-guests`; radio names "Blank", "Health check", "Team pulse", "A previous survey"; the tile "Poll".
- [ ] **Step 5: Gates and commit.** `npm run test -- survey-session-fields new-session-dialog use-new-session-intent session-type-picker`, then `npm run types:check`, `npm run check`, `npm run build:front`. No capture here: Task 31 captures the dialog.

```bash
git commit -m "feat(session-create): the Poll type — blank, health check, team pulse or a previous survey"
```

### Task 19 (lane Create): The Surveys block of the team page

**Mockup:** `ScreenTeam` (section pattern, session cards), `EmptyState` (module survey), `Card/README.md` (`SessionCard`).

**Files:**
- Create: `resources/js/components/teams/team-surveys-section.tsx` (+ `.test.tsx`)
- Modify: `resources/js/components/teams/team-page.tsx` (+ test), `resources/js/components/teams/use-team-anchor.ts` (+ test, only if the `#surveys` anchor needs it), `resources/js/pages/dev/sections/team.tsx`

**Interfaces:**
- Consumes: `surveys`, `canCreateSurvey`; `TeamSurveyDuplicatesController.store`, `TeamSurveysController.destroy`; `team-section.tsx`, `section-actions-menu.tsx`, `skrum/session-card` (kind `survey` exists), `skrum/empty-state` (module `survey`), `skrum/confirm-dialog`, `lib/delete-visit.ts`.

- [ ] **Step 1: Failing Vitest.** (a) one `SessionCard` per survey, kind survey, with its title, a status badge ("Draft", "Open", "Closed"), "n answers · n questions" and a link to `url`; (b) the card menu holds "Duplicate" for everyone who may create, and "Delete" only when `canManage`; (c) "Delete" opens a destructive `ConfirmDialog` ("Delete this survey?" — "Its questions and answers are deleted too.") and calls the route on confirm; (d) with no survey the `EmptyState` of the module survey shows "No survey published yet" and the action "Create a survey", which opens the dialog on the Poll type; the action is absent when `canCreateSurvey` is false; (e) the block has `id="surveys"` and the heading "Surveys".
- [ ] **Step 2: Build**, modelled line for line on `team-whiteboards-section.tsx`: `TeamSection` with the heading, the grid of the sibling sections, the cards, the empty state. Duplicate is an Inertia `router.post`; delete goes through `lib/delete-visit.ts` like the other sections, then reloads the `surveys` prop only. Mounted in `team-page.tsx` inside the `#sessions` area, after the whiteboards block. The sidebar's "Sessions" entry already leads to `#sessions`; `#surveys` is reachable from there.
- [ ] **Step 3: Hooks kept for later tests.** `section#surveys`; card `data-test="survey-card"`; menu button "Survey actions"; items "Duplicate", "Delete".
- [ ] **Step 4: Gates and commit.** `npm run test -- team-surveys-section team-page`, `npm run types:check`, `npm run check`, `npm run build:front`.

```bash
git commit -m "feat(team): the Surveys block, its cards and its empty state"
```

### Task 20 (lane Build): The builder — `surveys/edit`

**Mockup:** `ScreenSurvey` frame a. Deviations P19-01 to P19-06.

**Files:**
- Replace: `resources/js/pages/surveys/edit.tsx` (the stub of Task 3)
- Create: `resources/js/components/surveys/survey-builder.tsx`, `builder-topbar.tsx`, `builder-question-list.tsx`, `builder-question-card.tsx`, `builder-options-editor.tsx`, `builder-add-bar.tsx`, `builder-settings-panel.tsx`, `survey-preview-dialog.tsx`; `resources/js/lib/surveys/builder-state.ts`; each with its `.test.ts(x)`

**Interfaces:**
- Consumes: `useTeamSurvey`, `surveyApi`, `surveyReducer`, `toQuestionProps` (Task 17); `@dnd-kit/core`, `@dnd-kit/sortable` as `retro-columns-editor.tsx` uses them; `layouts/skrum/app-layout` (`active="sessions"`).
- Produces: `useAutosave` and `questionBody` of `builder-state.ts`; `SurveyPreviewDialog`.

Dependency: the preview renders `SurveyAnswerFlow` of Task 21 in its `preview` mode. Lanes Build and Answer run in parallel, so this lane builds the dialog around a `children` slot and the controller wires `SurveyAnswerFlow` into it when both lanes are merged (one line in `survey-builder.tsx`, listed in the merge notes). Until then "Preview" is rendered disabled.

- [ ] **Step 1: `builder-state.ts`, test first.** Pure logic:

```ts
import type { SurveyKind, SurveyQuestionPayload } from './types';

export type QuestionBody = {
    kind: SurveyKind;
    label: string;
    description: string | null;
    is_required: boolean;
    allows_comment: boolean;
    scale_min_label?: string | null;
    scale_max_label?: string | null;
    options: string[];
};

/** The body `surveys.questions.store|update` expects for a question as the builder holds it. */
export function questionBody(question: SurveyQuestionPayload): QuestionBody {
    const isChoice = question.kind === 'single' || question.kind === 'multiple';
    const isNumeric = question.kind === 'scale' || question.kind === 'nps';

    return {
        kind: question.kind,
        label: question.label.trim(),
        description: question.description,
        is_required: question.isRequired,
        allows_comment: isNumeric && question.allowsComment,
        ...(question.kind === 'scale'
            ? {
                  scale_min_label: question.scaleLabels?.[0] ?? null,
                  scale_max_label: question.scaleLabels?.[1] ?? null,
              }
            : {}),
        options: isChoice ? question.options.map((option) => option.label) : [],
    };
}

/** What a question becomes when its kind changes: options appear for a choice, ends for a scale, and nothing else is carried over that the server would refuse. */
export function withKind(
    question: SurveyQuestionPayload,
    kind: SurveyKind,
    defaultOptions: [string, string],
): SurveyQuestionPayload {
    const isChoice = kind === 'single' || kind === 'multiple';
    const wasChoice = question.kind === 'single' || question.kind === 'multiple';

    return {
        ...question,
        kind,
        scaleMax: kind === 'scale' ? 5 : null,
        scaleLabels: kind === 'scale' ? (question.scaleLabels ?? [null, null]) : null,
        allowsComment: kind === 'scale' || kind === 'nps',
        options: isChoice
            ? wasChoice
                ? question.options
                : defaultOptions.map((label, index) => ({ id: `new-${index}`, label }))
            : [],
    };
}

export type SaveState =
    | { status: 'idle' }
    | { status: 'saving' }
    | { status: 'saved'; at: number }
    | { status: 'error'; message: string };

/** A choice question can be saved only with 2 to 10 non-empty options, a question only with a label. */
export function isSavable(question: SurveyQuestionPayload): boolean {
    if (question.label.trim() === '') {
        return false;
    }

    if (question.kind !== 'single' && question.kind !== 'multiple') {
        return true;
    }

    return (
        question.options.length >= 2 &&
        question.options.length <= 10 &&
        question.options.every((option) => option.label.trim() !== '')
    );
}
```

Tests: `questionBody` for each kind (no `scale_*` key outside a scale, `options` empty outside a choice, `allows_comment` false on a text even when the payload says true); `withKind` from text to single gives the two default options and from single to multiple keeps them; `isSavable` refuses an empty label, one option, eleven options, a blank option. `useAutosave(save, delayMs = 600)` in the same file returns `{ schedule(key, run), flush(): Promise<void>, state: SaveState }`: one pending save per key (a question id, or `survey`), the latest wins, `flush` runs every pending save at once and resolves when all have answered; tested with fake timers (two edits of one question within the delay make one request; edits of two questions make two; a rejected save sets `error` and keeps the others).

- [ ] **Step 2: Failing component tests**, then build, part by part:

| Part | Content (mockup frame a) | Behaviour | Hooks |
|---|---|---|---|
| `edit.tsx` | `AppLayout active="sessions"`, breadcrumbs team › `t('Surveys')` (to `links.team` + `#surveys`) › title | renders `SurveyBuilder` | — |
| `builder-topbar.tsx` | badge of the status; "Saved :time ago" / "Saving…" / "Not saved" (`role="status"`); "Preview"; "Publish" (draft), "Back to draft" (open, no answer), "View results" (open or closed); the Share trigger of Task 22 once the survey is open (mounted at merge) | "Publish" flushes pending saves first, is disabled without a question, and shows the server's message on 422 | buttons "Preview", "Publish", "Back to draft" |
| `survey-builder.tsx` | title `h1` editable in place (`#survey-title`), "n questions", list, add bar, alert, settings panel at 21.25rem (a `Sheet` opened by a "Settings" button below `lg`) | owns `useTeamSurvey` and `useAutosave`; warns on `beforeunload` while a save is pending or failed | `data-realtime` on the root, as every live screen |
| `builder-question-list.tsx` | the sortable list: handle, number, and collapsed or open card | pointer and keyboard reorder with the announcements of `retro-columns-editor.tsx`; on drop: optimistic `question.reorder`, then `reorderQuestions`; on failure the server order comes back with a toast | `ol > li`; handle "Reorder question :number" |
| `builder-question-card.tsx` | collapsed: number, label (truncate), "n options", kind badge with its icon (`gauge`, `chart-bar`, `circle-dot`, `square-check`, `text-cursor-input`), "Required" badge. Open (selected): kind select `#question-kind-{id}`, "Required" switch, Duplicate, Delete, label `#question-label-{id}`, then by kind | selecting a row opens it and closes the previous one; a change of kind goes through `withKind`; Delete asks for confirmation only when the question has a label the user typed | `section[aria-label="Question :number"]`, `data-test="survey-question"`; buttons "Duplicate", "Delete"; switch "Required" |
| by kind | scale: "Label of 1", "Label of 5" and a disabled preview of the scale; NPS: the fixed ends "Not at all likely" / "Extremely likely" shown as text; choices: `builder-options-editor.tsx`; text: "500 characters max" | — | `#scale-min-{id}`, `#scale-max-{id}` |
| `builder-options-editor.tsx` | one input per option, remove button, "Add option" | 2 to 10; remove disabled at 2, add at 10; Enter in the last input adds one | `[aria-label="Option :number"]`, "Remove option :number", "Add option" |
| `builder-add-bar.tsx` | dashed bar "Add" and five chips | a click posts the question with `t('Untitled question')` (and two options "Option 1", "Option 2" for a choice), selects it and focuses its label | group "Add a question"; buttons "Scale 1 – 5", "NPS", "Single choice", "Multiple choice", "Free text"; all disabled at 30 questions with the reason |
| `builder-settings-panel.tsx` | "Settings"; the line "Answers are anonymous" (P19-01); three switches: "One question at a time" (help "Recommended on a phone"), "Show results after answering", "Allow guests without an account"; the places of P19-02 and P19-03 left empty | each switch saves at once through `surveyApi.update` | `#survey-one-at-a-time`, `#survey-results-after`, `#survey-guests` |
| alert | P19-04 | "A result is shown from :count answers, and free answers are sorted before they are shown." or, without a threshold, the second half alone | — |
| locked template | health check: the list is read-only (no handle, no menu, no add bar) under an info alert "The questions of a health check come from the team's statements." with the link "Manage statements" to the health-check page; each question shows the scale 1 to 5 with the ends "Strongly disagree" / "Strongly agree" | settings and title stay editable | — |
| open or closed survey | the list is read-only under "Questions cannot change once a survey is open." | — | — |

- [ ] **Step 3: States to cover in Vitest:** empty draft; five questions with the first open (the mockup's frame); a choice question open; dragging (keyboard); saving, saved, not saved; health check (locked); open survey; closed survey; the settings sheet below `lg` (`useIsMobile` mocked).
- [ ] **Step 4: Gates and commit.** `npm run test -- surveys/builder survey-builder builder-`, `npm run types:check`, `npm run check`, `npm run build:front`.

```bash
git commit -m "feat(surveys): the builder — questions of five kinds, reorder, duplicate, required, settings, autosave"
```

### Task 21 (lane Answer): The participant page — `surveys/show`

**Mockup:** `ScreenSurvey` frame b; `MobileRituals` (survey phone frame). Deviations P19-07, P19-08.

**Files:**
- Replace: `resources/js/pages/surveys/show.tsx` (the stub of Task 3)
- Create: `resources/js/components/surveys/survey-room.tsx`, `survey-answer-flow.tsx`, `survey-answer-list.tsx`, `survey-progress.tsx`, `survey-thanks.tsx`, `survey-closed.tsx`; `resources/js/lib/surveys/answer-flow.ts`; each with its `.test.ts(x)`
- Modify: `resources/js/components/session/session-shell.tsx` (+ test, own commit): `SessionKind` gains `'survey'`, whose reconnecting sentence is "Your answers are saved as you give them; the counter is paused."

**Interfaces:**
- Consumes: `useTeamSurvey`, `surveyApi`, `toQuestionProps`, `answerOf` (Task 17); `SurveyQuestion` with `chrome="none"`; `SessionShell` and `SessionTitle` of `components/session/` (read `session-shell.tsx`, `session-title.tsx`, `layouts/skrum/session-layout.tsx` and `components/whiteboard/board-header.tsx`, the screen that uses `chrome="logo"`); `singleKeyShortcutsEnabled` of `lib/shortcuts/preference`, `isEditableTarget` of `hooks/use-shortcut`.
- Produces: `SurveyAnswerFlow` with the props `{ questions, onSave, onFinish, preview?: boolean }`, used by the builder's preview; `SurveyFrame`, the shell of a survey page for a guest, reused by Task 23.

- [ ] **Step 1: `answer-flow.ts`, test first.** Pure functions: `firstUnanswered(questions): number` (index of the first question without an answer, else the last); `missingRequired(questions): string[]`; `stepOf(serverErrors: Record<string, string[]>, questions): number | null` (the index of the first question named by a `questions.{id}` error of `surveys.submission.store`); `digitValue(key: string, question): number | null` (a scale of 5: `1`–`5`; NPS: `0`–`9`; anything else null). Tests for each, including a scale ignoring `7` and an NPS mapping `0` to 0.
- [ ] **Step 2: Failing component tests**, then build:

| Part | Content | Behaviour |
|---|---|---|
| `show.tsx` | no `AppLayout`: renders `SurveyRoom` | — |
| `SurveyFrame` (in `survey-room.tsx`) | `SessionShell` with `kind="survey"`, `chrome="logo"`, `homeHref` = `links.team` for a member and null for a guest, `title` = `SessionTitle` with the overline "team · Survey" (`t('Survey')` alone for a guest) and the badge "Anonymous answers" (`venetian-mask`), `self` = the viewer (`me.name`, `me.avatarUrl`, `me.isGuest`), `realtime` and `connection` from `useTeamSurvey` | the shell gives the one `[data-realtime]`, the "Synced" state, the reconnecting banner with the survey's sentence and the expired state; `main` centred |
| `survey-room.tsx` | chooses the view from the snapshot | open and not finished: the flow or the list, by `oneQuestionAtATime`; finished: thanks, then results when `me.canSeeResults`; closed: `SurveyClosed`; `gone`: "This survey was deleted." with a link back; an editor also gets the links "Results" and the Share trigger of Task 22 (mounted at merge) |
| `survey-answer-flow.tsx` | frame b: "Question n of N", `SurveyProgress`, a card of 47.5rem at most with the kind badge, the question as `h2` in the display font, its description, `SurveyQuestion chrome="none"`, the optional comment, "Previous" (ghost), the keyboard hint, "Next" (large; "Finish" on the last) and the privacy line | starts on `firstUnanswered`; a scale, NPS or single choice is saved the moment it is picked; a multiple choice, a text and a comment are saved 600 ms after the last change and when leaving the step; "Next" on a required question without an answer does not move and shows "An answer is required" (`aria-invalid`, focus on the control); "Finish" flushes, calls `submit`, and on 422 goes to `stepOf`; a failed save keeps the value on screen with "Not saved — retry"; digits follow `digitValue`, Enter goes on, both ignored while a text field has the focus and when the viewer turned single-key shortcuts off; the hint line shows the real keys of the question and is absent when single-key shortcuts are off; focus moves to the question's heading on each step |
| phone | below `md`: the card is full width and unframed, NPS on two rows with 2.75rem targets, "Previous" as an icon button and "Next" filling the row in a footer docked at the bottom with the safe-area inset | the docked footer never covers the comment field: the scroll area has the footer's height as bottom padding |
| `survey-progress.tsx` | the mockup's segments up to twelve questions, a `Progress` bar with "Question n of N" and the percentage above twelve | `aria-hidden` on the segments; the text carries the information |
| `survey-answer-list.tsx` | setting off: every question as a `SurveyQuestion` card (`index`, `count`), one "Finish" button under the list | same saving rules; "Finish" scrolls to the first required question left empty |
| `survey-thanks.tsx` | "Thank you — your answers are saved.", ":count of :total have answered", "Change my answers" while open, and under it the results (the Summary of Task 23, mounted by the controller at merge; until then "Results will show when the survey is closed" or nothing) | "Change my answers" calls `reopenResponse` and returns to the first question |
| `survey-closed.tsx` | "This survey is closed.", the closing date, and the results link | — |
| preview mode | `SurveyAnswerFlow preview`: no request, a local answers map, "Finish" closes the dialog | — |

- [ ] **Step 3: Hooks kept for later tests.** the region named "Survey" (`getByRole('region', { name: 'Survey' })`, the root of the session shell: the frame's `<main>` stays unlabelled, as on every session page); heading of the current question; `[data-test="survey-step"]` with `data-step`; buttons "Previous", "Next", "Finish", "Change my answers"; the radiogroup named by the question; text field named by the question; comment field "Why this score? (optional)".
- [ ] **Step 4: States in Vitest:** each of the five kinds as the current step; required error; not saved; finished without results; finished with results; closed; reconnecting; a guest (no team in the overline, no logo link); the phone layout (`useIsMobile` mocked) for a scale, an NPS and a text.
- [ ] **Step 5: Gates and commits.** `npm run test -- surveys/answer-flow survey-room survey-answer survey-progress survey-thanks survey-closed session-shell`, `npm run types:check`, `npm run check`, `npm run build:front`.

```bash
git commit -m "feat(session): the survey kind of the session shell"
git commit -m "feat(surveys): the participant page — one question at a time or all at once, saved as answered, phone layout"
```

### Task 22 (lane Answer): Guest join and the Share dialog

**Mockup:** `GuestJoin`, `ShareDialog`.

**Files:**
- Replace: `resources/js/pages/surveys/join.tsx` (the stub of Task 6) (+ `join.test.tsx`)
- Create: `resources/js/components/surveys/survey-share.tsx` (+ test)

- [ ] **Step 1: Join page**, a copy of `pages/whiteboards/join.tsx` on `GuestJoinPage` with `kind="survey"` (Task 17 adds the kind), the props of Task 6 (`isInvalid`, `guestToken`, `surveyTitle`, `session`, `suggestedName`, and the optional `randomName` that `GuestJoinPage` asks for when the visitor wants another nickname), `storeUrl` from `TeamSurveyJoinsController.store`, the invalid title `t('Join a survey')`. Test: the summary shows the title, the facilitator, the number of people and "Live" only while `session.isLive`; the invalid state renders without a form; the suggested nickname is prefilled (D-51); the button reads "Join the session".
- [ ] **Step 2: Share**, a copy of `components/whiteboard/board-share.tsx` (read it and `components/retro/board-share.tsx` first): `ShareDialog` with `session.kind = 'survey'` (the dialog already knows the kind), `invite = { url: guestUrl, allowGuests }`, `canManage = me.isEditor`; `onChange({ allowGuests })` calls `surveyApi.update(id, { guest_access_enabled })`; `onRegenerate` calls `surveyApi.newGuestLink` after the dialog's own confirmation and stores the new URL; a member who is not an editor sees the link and no control; a guest has no Share button. Exported as `<SurveyShare snapshot dispatch />` with its trigger button ("Share", icon `share-2`), mounted by the builder topbar (once the survey is open), the participant page (editors) and the results header (Task 23) — the three mounts are one line each, added by the controller at merge when the lanes meet.
- [ ] **Step 3: Gates and commit.** `npm run test -- surveys/join survey-share`, `npm run types:check`, `npm run check`, `npm run build:front`.

```bash
git commit -m "feat(surveys): guest join page and Share dialog of a survey"
```

### Task 23 (lane Results): Results, live and closed — `surveys/results`

**Mockup:** `ScreenSurvey` frame c. Deviations P19-09 to P19-12, P19-19.

**Files:**
- Replace: `resources/js/pages/surveys/results.tsx` (the stub of Task 10)
- Create: `resources/js/components/surveys/survey-results.tsx`, `results-header.tsx`, `results-summary.tsx`, `results-free-text.tsx`, `results-states.tsx`; each with its `.test.tsx`

**Interfaces:**
- Consumes: `useTeamSurvey`, `surveyApi`, `toQuestionProps` (Task 17); `SurveyQuestion mode="results"`; `ui/tabs`, `skrum/confirm-dialog`, `skrum/skeletons`; `TeamSurveyExportsController.show`; `SurveyFrame` of Task 21 for a guest (wired at merge).
- Produces: `ResultsSummary` with the props `{ snapshot, deltas?: Record<string, { value: number; against: string }> }`, reused by the thank-you state of Task 21 and fed with deltas by Task 24.

- [ ] **Step 1: Failing tests**, then build:

| Part | Content (frame c) | Behaviour |
|---|---|---|
| `results.tsx` | `AppLayout active="sessions"`, breadcrumbs as the builder | a guest gets `SurveyFrame` of Task 21 instead of `AppLayout` (the sidebar belongs to members); the controller wires it at merge, and until then this lane renders a bare `main` for guests |
| `results-header.tsx` | topbar: status badge ("Open" with a live dot, "Closed" with `check`), and at the end "Export CSV" (outline, `file-down`; editor and closed only; a plain link to the export route), "Share" (Task 22's trigger, mounted at merge), and for an editor "Close" (confirm: "Close the survey?" — "People can no longer answer. You can reopen it.") or "Reopen" | "Close" and "Reopen" call `setStatus`; the header line reads ":responses answers out of :audience participants · anonymous" and, once closed, "· closed on :date" (`Intl.DateTimeFormat`); `audience` is the server's count (members plus respondents who are not members, P19-19) |
| tabs | "Summary", "Free-text answers", "Compare" (`ui/tabs`, the tab in `?tab=`) | "Free-text answers" is absent when no question is a text or takes comments; "Compare" is absent for a guest |
| `results-summary.tsx` | grid of one to three columns as the mockup (`grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(88)),1fr))]`); one `SurveyQuestion mode="results"` per question with `index` and `count` ("Q1 · Scale 1 – 5"); a text question spans two columns from `lg` | the cards update when the snapshot does; a question nobody answered shows "No answers yet." |
| text card | the first six answers as tinted cards (the eight column tones in rotation, by index), then "See the :count answers", which switches to the second tab | the viewer's own answer is marked "Your answer" |
| `results-free-text.tsx` | per question: its label, then every text answer; per scale or NPS question with comments: its label, then the comments | sorted as the server sent them |
| `results-states.tsx` | below the threshold: "Results appear from :threshold answers. :responses so far." with the progress of answers; not visible yet: "Results will show when the survey is closed." (setting off) or "Answer the survey to see the results." with a link to it (setting on, not finished); no answer: the empty state; loading: the skeleton variant of the cards | each is a `role="status"` region |

- [ ] **Step 2: Live.** With two renders of the container fed by a mocked channel: an event `survey.responses.changed` moves the header count at once; a viewer with `canSeeResults` refetches after one second and the cards change; a viewer without it does not refetch; `survey.changed` with status `closed` swaps the badge and shows "Export CSV" to an editor.
- [ ] **Step 3: Hooks kept for later tests.** `main` named "Results"; cards `article[aria-label=<question label>]`; `[data-slot="survey-result-bar"]`; tabs "Summary", "Free-text answers", "Compare"; buttons "Export CSV", "Close", "Reopen".
- [ ] **Step 4: States in Vitest:** nine answers on the five kinds (the mockup's data: mean 3.8, NPS +22, "5 · 56%", "6 · 67%", seven texts); open and live; below the threshold; member who may not see yet; closed; a guest.
- [ ] **Step 5: Gates and commit.** `npm run test -- survey-results results-`, `npm run types:check`, `npm run check`, `npm run build:front`.

```bash
git commit -m "feat(surveys): results page — summary cards per kind, free-text tab, live counter, close and reopen"
```

### Task 24 (lane Results): Compare, and the CSV button

**Mockup:** the third tab of frame c and the "+11 vs sprint 41" badge. Deviation P19-12.

**Files:**
- Create: `resources/js/components/surveys/results-compare.tsx` (+ test), `resources/js/lib/surveys/compare.ts` (+ test)
- Modify: `resources/js/components/surveys/survey-results.tsx`, `results-summary.tsx`

- [ ] **Step 1: `compare.ts`, test first.**

```ts
import type { SurveyComparison } from './types';

/** "+1.5", "−0.6", or null when there is no difference to show. Uses the minus sign, not a hyphen. */
export function signed(value: number | null, digits = 0): string | null {
    if (value === null) {
        return null;
    }

    if (value === 0) {
        return '0';
    }

    const amount = Math.abs(value).toFixed(digits);

    return value > 0 ? `+${amount}` : `−${amount}`;
}

/** The badges of the Summary cards: one per scale or NPS question that has a numeric difference. */
export function deltasByQuestion(
    comparison: SurveyComparison | null,
): Record<string, { value: number; against: string }> {
    if (comparison === null || comparison.belowThreshold) {
        return {};
    }

    return Object.fromEntries(
        comparison.pairs
            .filter(
                (pair): pair is typeof pair & { delta: number } =>
                    (pair.kind === 'scale' || pair.kind === 'nps') &&
                    typeof pair.delta === 'number',
            )
            .map((pair) => [
                pair.questionId,
                { value: pair.delta, against: comparison.other.title },
            ]),
    );
}
```

Tests: `signed(1.5, 1)` is `+1.5`, `signed(-0.6, 1)` is `−0.6` with U+2212, `signed(0)` is `0`, `signed(null)` is null; `deltasByQuestion` keeps scale and NPS pairs with a number, drops choices, texts and a null delta, and is empty below the threshold.

- [ ] **Step 2: Failing component test**, then build `results-compare.tsx`: a select "Compare with" (`#survey-compare-with`, the surveys of `comparable`, the default selected, each option "title · closing date"); a request to `surveyApi.comparison(id, withId)` on change, with a skeleton while it loads and an error state with "Retry"; then one row per pair: the question's label, the kind badge, "now" and "before" values (a scale on 5, as the server sends it), and the written difference (`signed`, with "points" for NPS and percentage points for a choice, one line per option; a text shows the two numbers of answers); "Only in this survey" and "Only in :title" list the unmatched questions; "Nothing to compare with yet." when `comparable.surveys` is empty; "The other survey does not have enough answers." when `belowThreshold`. A difference is never colour alone: the sign and the word ("higher", "lower", "no change") are in the text.
- [ ] **Step 3: Badges.** `survey-results.tsx` loads the default comparison once when `comparable.defaultId` is set and passes `deltasByQuestion(...)` to `ResultsSummary`, which hands each to `toQuestionProps` → `results.delta`.
- [ ] **Step 4: CSV.** Already a link in the header (Task 23); here its test: present only for an editor of a closed survey at or above the threshold, `download` attribute absent (the server names the file), `href` is the export route.
- [ ] **Step 5: Gates and commit.** `npm run test -- surveys/compare results-compare survey-results`, `npm run types:check`, `npm run check`, `npm run build:front`.

```bash
git commit -m "feat(surveys): compare a survey with a previous one, with the differences on the summary cards"
```

### Task 25 (lane Health): The health check in a retro — header button, dialog, "Add survey" menu

**Mockup:** `HealthCheck` (form 1 to 5 with "Submit answers", results with the 1→5 distribution), `SessionSettingsPopover` ("Add survey" menu), `ScreenSessionCreate` (the "Health check" row). Deviations P19-15, P19-16, P19-17. **P19-16 is put to the owner before this task starts.**

**Files:**
- Create: `resources/js/components/retro/health-check-button.tsx`, `health-check-dialog.tsx` (+ tests)
- Modify: `resources/js/components/skrum/session-settings-popover.tsx` (+ test, own commit), `resources/js/components/retro/board-topbar.tsx` (`BoardActions`), `board-settings.tsx`, `resources/js/pages/dev/sections/session-settings-popover.tsx`, `resources/js/components/teams/session-create/retro-session-fields.tsx`

**Interfaces:**
- Consumes: the snapshot key `healthCheck` of Tasks 15 and 16 (`surveyId`, `isClosed`, `scale`, `respondents`, `participants`, `hasSubmitted`, `statements`, `results`) and `retro.healthCheckStatements`; the routes `retros.healthCheck.store|destroy`, `retros.healthCheck.closure.update|destroy`; the hook `useHealthCheckSubmission` of Task 15; `skrum/health-check-form`, `skrum/health-check-results` (on 5 since Task 16); `components/retro/results/health.tsx` for the results body (R3-5).

Read first: `board-topbar.tsx` — `BoardActions` holds settings, Share, the cursor toggle and the facilitator's "…" menu, and below `md` puts every entry into one menu (`mobile`); `board-settings.tsx` — `useSurveyEditor`, `canAddSurvey` and the `onAddSurvey` it passes to the popover; `session-settings-popover.tsx` — the health-check toggle row (`health_check_enabled`) and the "Add survey" button; `phase-health.tsx` as Task 15 left it.

- [ ] **Step 1: `SessionSettingsPopover` (own commit).** As its README: `onAddSurvey?: (kind: 'health_check' | 'quick_poll') => void` and `surveys?: { healthCheckStatements: number; healthCheckAttached: boolean }`. The button "Add survey" (`clipboard-list`, `chevron-down`) opens a `DropdownMenu` of `w-80` with "Health check" (badge "Built-in", description ":count statements"; when attached: "Health check added", disabled) and "Quick poll" (description "One question, answered on the board"). The note of the mockup and "From a template…" are not rendered (P19-15). The health-check toggle row (`health_check_enabled`, its `phaseOn` for the phase) goes, with the field of the settings type and the value `board-settings.tsx` passes for it (`retro.healthCheckEnabled`): the server stopped reading it in Task 15. `votePhases` and the phase labels keep `health_check` until Task 28. Vitest: the two items, the attached state, hidden when `readOnly`, no health-check toggle.
- [ ] **Step 2: Failing tests, then the button and the dialog.**

| Part | Content | Behaviour |
|---|---|---|
| `health-check-button.tsx` | in `BoardActions`, before Share: `HeartPulse`, "Health check", and ":answered/:total" in mono (`respondents`/`participants`); below `md` an entry of the header's one menu with the same name and count | rendered when `healthCheck !== null` and the retro is not completed; accessible name "Health check, :answered of :total answered"; a dot marks it while the viewer has not sent their answers and the health check is open |
| `health-check-dialog.tsx` | `Dialog` from `md`, `Drawer` below; title "Health check · :retro" | open: `HealthCheckForm` with `scale` from the snapshot, the viewer's scores from `useHealthCheckSubmission`, `onAnswer` local, `onSubmit` the submission, `submitted` = `hasSubmitted`; no `onClear`, no names (decision 11); closed: the results body of `retro/results/health.tsx` (compact rows, "Details") fed by `healthCheck.results`, or "No answers." |
| facilitator footer | open: "Close the health check" (confirm: "Everyone will see the results."), "Remove" (confirm; with answers: "Its answers are kept and come back if you add it again."; without: "It has no answer yet."); closed: "Reopen" | the four routes; errors as toasts; the dialog stays open after closing so that the results show |
| locked board | the form is disabled with the reason | — |
| digits | while the dialog is open, digits 1 to 5 go to the focused statement and not to reactions (parent spec ruling 21), and only when single-key shortcuts are on | test with the reaction shortcut mounted |
| session end | no button; the session-end page keeps its health card (R3-5) and its docked reaction bar (R3-2) | test: a completed retro renders no "Health check" button |

- [ ] **Step 3: Wiring.** `board-settings.tsx` passes `onAddSurvey={(kind) => kind === 'quick_poll' ? addSurvey() : attachHealthCheck()}`: the quick poll under the conditions of today (`canAddSurvey`), the health check whenever the viewer is the facilitator and the retro is open; `surveys` from `retro.healthCheckStatements` and `healthCheck !== null`. `retro-session-fields.tsx`: the row "Health check" keeps its switch and its field; its help becomes `t('The team rates its statements during the retro')`, and the key `The team rates its health statements first` leaves the four files.
- [ ] **Step 4: Hooks kept for later tests.** Button "Health check"; dialog title; the hooks of `HealthCheckForm` (fieldsets by statement, radios 1 to 5, "Submit answers"); buttons "Close the health check", "Reopen", "Remove"; menu items "Health check", "Quick poll".
- [ ] **Step 5: Gates and commits.** `npm run test -- session-settings-popover health-check-button health-check-dialog board-topbar board-settings`, `npm run types:check`, `npm run check`, `npm run build:front`.

```bash
git commit -m "feat(skrum): SessionSettingsPopover — the Add survey menu (health check, quick poll), no health-check toggle"
git commit -m "feat(retro): the health check as an attached survey, answered from the header in any open phase"
```

### Task 26 (lane Health): The health-check page — start one, and a trend that counts surveys

**Files:**
- Modify: `resources/js/components/teams/team-health-check-page.tsx` (+ test), `resources/js/lib/teams/mood-adapter.ts` (+ test), `resources/js/types/workspaces.ts`, `app/Http/Controllers/TeamHealthChecksController.php` (`canCreateSurvey`), `tests/Feature/Teams/TeamHealthCheckPageTest.php`

- [ ] **Step 1: Adapter, test first.** A point's key is `surveyId ?? retroId`; a point without a retro links to its `url` (the survey's results); the label of a point is its `title` in both cases. Tests: two points of the same date, one retro and one survey, keep distinct keys; a survey point renders its link. (The axis of 0 to 5 is set by Task 16.)
- [ ] **Step 2: Page.** A primary button "Start a health check" in the page header, an Inertia `Link` to the team page with `?new=survey&template=health_check`, shown when the viewer may create a survey: `TeamHealthChecksController@show` adds `canCreateSurvey` (`$request->user()->can('createSurvey', $team)`), with its assertion in `TeamHealthCheckPageTest` (run on the four engines). The trend's table view gains a "Kind" column ("Retro", "Survey").
- [ ] **Step 3: Gates and commit.** `npm run test -- team-health-check-page mood-adapter`, `npm run types:check`, `npm run check`, `npm run build:front`; `bin/test-db <engine> -- tests/Feature/Teams/TeamHealthCheckPageTest.php` on the four engines.

```bash
git commit -m "feat(team): start a health check from its page; the mood trend counts health checks run as surveys"
```

---

## Step D — the phase goes

Tasks 27 to 29 run on the main branch after every lane is merged.

### Task 27: Remove the health-check phase — back end

**Files:**
- Create: `database/migrations/2026_10_20_100200_move_retros_out_of_the_health_check_phase.php`
- Modify: `app/Enums/RetroPhase.php`, `app/Models/Retro.php`, `app/Http/Controllers/Retros/ColumnsController.php`, `ColumnOrdersController.php`, `RetroSettingsController.php`, `app/Actions/Retros/BuildBoardSnapshot.php`, `app/Mcp/Servers/SkrumServer.php`, `app/Mcp/Prompts/TeamHealth.php`, `AnalyzeRetro.php`
- Test: `tests/Upgrade/HealthPhaseMoveTest.php`, `tests/Feature/Retros/HealthPhaseRemovalTest.php`; edited: every test that names `RetroPhase::HealthCheck` or `'health_check'` as a phase (list below)

**Interfaces:**
- Consumes: `ImportHealthChecks::handle` (run again, so that an answer written to the old tables after the first run is not left behind), `AttachHealthCheck`, `RetroFactory::withHealthCheck()` (attaches since Task 15).
- Produces: `RetroPhase` without `HealthCheck`; `Retro::phases()` = Icebreaker (when enabled), Writing, Grouping, Voting, Discussing, Actions, Roti, Completed; the board snapshot without `retro.healthCheckEnabled`.

- [ ] **Step 1: Write the failing tests**

`tests/Upgrade/HealthPhaseMoveTest.php` — the migration itself, on rows written with `DB::table()` (the enum cannot read a retro in `health_check` once this task removes the case), in the pattern of `tests/Upgrade/GamePointsWeekStartBackfillTest.php`:

```php
<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

const HealthPhaseMoveMigration = '2026_10_20_100200_move_retros_out_of_the_health_check_phase.php';

/** @param array<string, mixed> $values */
function rowBeforeHealthPhaseMove(string $table, array $values): string
{
    $id = (string) Str::uuid7();

    DB::table($table)->insert(['id' => $id, 'created_at' => '2026-10-01 09:00:00', 'updated_at' => '2026-10-01 09:00:00', ...$values]);

    return $id;
}

it('moves the retros caught in the health-check phase on, with their answers, by running the migration itself', function () {
    $earlier = collect(glob(database_path('migrations/*.php')))
        ->filter(fn (string $path): bool => basename($path) < HealthPhaseMoveMigration)
        ->values()
        ->all();

    Artisan::call('migrate:fresh', ['--path' => $earlier, '--realpath' => true]);

    $workspace = rowBeforeHealthPhaseMove('workspaces', ['name' => 'Acme', 'slug' => 'acme']);
    $team = rowBeforeHealthPhaseMove('teams', ['workspace_id' => $workspace, 'name' => 'Platform']);
    $user = rowBeforeHealthPhaseMove('users', ['name' => 'Ada', 'email' => 'ada@example.test', 'email_key' => 'ada@example.test', 'password' => 'secret']);
    $retro = fn (string $title, string $phase, bool $icebreaker): string => rowBeforeHealthPhaseMove('retros', [
        'team_id' => $team,
        'title' => $title,
        'template' => 'start_stop_continue',
        'guest_token' => Str::random(40),
        'phase' => $phase,
        'health_check_enabled' => true,
        'icebreaker_enabled' => $icebreaker,
    ]);
    $plain = $retro('Plain', 'health_check', false);
    $withIcebreaker = $retro('With icebreaker', 'health_check', true);
    $voting = $retro('Voting', 'voting', false);
    $participant = rowBeforeHealthPhaseMove('participants', ['retro_id' => $plain, 'user_id' => $user]);
    rowBeforeHealthPhaseMove('retro_health_statements', ['retro_id' => $plain, 'key' => 'vision', 'builtin' => 'vision', 'position' => 0]);
    rowBeforeHealthPhaseMove('health_check_answers', ['retro_id' => $plain, 'participant_id' => $participant, 'statement' => 'vision', 'score' => 7]);

    Artisan::call('migrate', ['--path' => [database_path('migrations/'.HealthPhaseMoveMigration)], '--realpath' => true]);

    $phases = DB::table('retros')->pluck('phase', 'id');
    $survey = DB::table('team_surveys')->where('retro_id', $plain)->sole();
    $question = DB::table('team_survey_questions')->where('team_survey_id', $survey->id)->sole();

    expect($phases[$plain])->toBe('writing')
        ->and($phases[$withIcebreaker])->toBe('icebreaker')
        ->and($phases[$voting])->toBe('voting')
        ->and($survey->status)->toBe('open')
        ->and((int) $question->scale_max)->toBe(10)
        ->and((int) DB::table('team_survey_answers')->where('team_survey_question_id', $question->id)->value('value'))->toBe(7)
        ->and(DB::table('health_check_answers')->count())->toBe(1);
});
```

Check the column list of `retro_health_statements`, `participants` and `retros` at that point of the migrations before writing the rows (a column without a default must be given); `users.email_key` is required since the portability work.

`tests/Feature/Retros/HealthPhaseRemovalTest.php` — the application after the move:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\Retro;
use Illuminate\Support\Facades\DB;

function runHealthPhaseMove(): void
{
    $migration = require database_path('migrations/2026_10_20_100200_move_retros_out_of_the_health_check_phase.php');

    $migration->up();
}

it('has no health-check phase any more', function () {
    expect(RetroPhase::tryFrom('health_check'))->toBeNull()
        ->and(array_column(RetroPhase::cases(), 'value'))
        ->toBe(['icebreaker', 'writing', 'grouping', 'voting', 'discussing', 'actions', 'roti', 'completed']);
});

it('runs a retro through its phases without a health-check step', function () {
    $plain = Retro::factory()->create();
    $withIcebreaker = Retro::factory()->create(['icebreaker_enabled' => true]);

    expect(array_map(fn (RetroPhase $phase) => $phase->value, $plain->phases()))
        ->toBe(['writing', 'grouping', 'voting', 'discussing', 'actions', 'roti', 'completed'])
        ->and($withIcebreaker->firstPhase())->toBe(RetroPhase::Icebreaker)
        ->and(RetroPhase::hidingOthersCards())->toBe([RetroPhase::Icebreaker, RetroPhase::Writing]);
});

it('opens a retro that was in the health-check phase, in another phase, with its answers on their scale and an open health check', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);
    oldHealthStatements($retro, [['key' => 'vision', 'builtin' => 'vision']]);
    oldHealthAnswer($retro, $participant, 'vision', 7);
    oldHealthFlag($retro, true, 'health_check');

    runHealthPhaseMove();

    $this->actingAs($user)->getJson(route('retros.snapshot.show', $retro))
        ->assertOk()
        ->assertJsonPath('retro.phase', 'writing')
        ->assertJsonMissingPath('retro.healthCheckEnabled')
        ->assertJsonPath('healthCheck.isClosed', false)
        ->assertJsonPath('healthCheck.scale', 10)
        ->assertJsonPath('healthCheck.statements.0.key', 'vision')
        ->assertJsonPath('healthCheck.statements.0.myScore', 7)
        ->assertJsonPath('healthCheck.hasSubmitted', true);
});

it('can run twice', function () {
    $retro = Retro::factory()->create();
    DB::table('retros')->where('id', $retro->id)->update(['phase' => 'health_check']);

    runHealthPhaseMove();
    runHealthPhaseMove();

    expect($retro->fresh()->phase)->toBe(RetroPhase::Writing);
});

it('gives the factory state a real health check, on five', function () {
    $retro = Retro::factory()->withHealthCheck()->create();

    expect($retro->teamSurveys()->sole()->questions()->count())->toBe(6)
        ->and($retro->teamSurveys()->sole()->questions()->first()->scale_max)->toBe(5);
});

it('still creates the icebreaker room of a retro that arrived in that phase by the migration', function () {
    $retro = Retro::factory()->create(['icebreaker_enabled' => true]);
    [$user] = retroMember($retro);
    DB::table('retros')->where('id', $retro->id)->update(['phase' => 'health_check']);

    runHealthPhaseMove();

    $this->actingAs($user)->getJson(route('retros.snapshot.show', $retro))->assertOk();

    expect(DB::table('game_rooms')->where('retro_id', $retro->id)->count())->toBe(1);
});
```

The participant of the third case answered the only frozen statement, so the import stamped them as having sent (`hasSubmitted` true, §11.3). The last case relies on `EnsureIcebreakerRoom` being called by the board snapshot, as its docblock says ("or the first time a board snapshot needs it"). If it fails, the snapshot does not ensure the room: add the call to `BuildBoardSnapshot` for a retro in the `icebreaker` phase without a room, in this task.

- [ ] **Step 2: Run them and see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Upgrade/HealthPhaseMoveTest.php tests/Feature/Retros/HealthPhaseRemovalTest.php`
Expected: FAIL (the enum still has the case; the migration file does not exist).

- [ ] **Step 3: Migration**

`database/migrations/2026_10_20_100200_move_retros_out_of_the_health_check_phase.php`:

```php
<?php

use App\Support\Surveys\ImportHealthChecks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The import commits retro by retro and can be run again after a failure.
     */
    public $withinTransaction = false;

    public function up(): void
    {
        resolve(ImportHealthChecks::class)->handle();

        DB::table('retros')
            ->where('phase', 'health_check')
            ->where('icebreaker_enabled', true)
            ->update(['phase' => 'icebreaker']);

        DB::table('retros')
            ->where('phase', 'health_check')
            ->update(['phase' => 'writing']);
    }
};
```

`retros` has derived `*_search` columns: this update leaves their source columns alone (rule 9).

- [ ] **Step 4: Enum, model, guards, snapshot**

- `RetroPhase`: remove the case `HealthCheck`, its `label()` arm, and its entry in `hidingOthersCards()`.
- `Retro`: `phases()` filters `Icebreaker` only; remove `health_check_enabled` from the docblock, from `#[Fillable]` and from `casts()`. The relations `healthStatements()` and `healthCheckAnswers()` go in Task 29.
- `ColumnsController` (`RetroGuard::phase($retro, RetroPhase::HealthCheck, RetroPhase::Icebreaker, RetroPhase::Writing)`), `ColumnOrdersController` (twice), `RetroSettingsController` (`votes_per_participant`): remove `RetroPhase::HealthCheck` from each list.
- `BuildBoardSnapshot`: remove `'healthCheckEnabled' => $retro->health_check_enabled`.
- `TeamRetrosController` and `NewRetro`: unchanged (`health_check_enabled` is still the name of the creation field).
- `RetroFactory::withHealthCheck()` already attaches a health check (Task 15); the case "gives the factory state a real health check, on five" pins it.
- MCP: in `SkrumServer`, the sentence "moves through phases (health check, icebreaker, writing, grouping, voting, discussing, actions, roti, completed)" becomes "moves through phases (icebreaker, writing, grouping, voting, discussing, actions, roti, completed) and can carry a health check, a short survey the team answers during the board, scored 1 to 5"; in `TeamHealth` and `AnalyzeRetro`, replace "health check phase" wordings by "health check"; the prompt `team-health` says "its last six closed health checks" where it said "last six completed retrospectives" only for the health part (its scale sentence was added in Task 16).

- [ ] **Step 5: Tests that name the phase**

`grep -rn "HealthCheck\b\|health_check" tests/Feature tests/Unit tests/Upgrade tests/Concurrency --include=*.php | grep -v "health_check_enabled\|healthCheck\.\|health-check\|oldHealth\|HealthPhaseMove"` lists them. For each:

| File | Change |
|---|---|
| `RetroModelTest.php` | the phase lists lose the health check; "the first phase is the health check when enabled" becomes "the first phase is the icebreaker when enabled, else writing" |
| `FacilitationTest.php` | moves from and to `health_check` go; "cannot turn the current phase off" keeps its icebreaker case only |
| `RetroGuardTest.php`, `ColumnsTest.php`, `GroupNamesTest.php`, `RotiTest.php`, `SurveysTest.php`, `SurveyDraftsTest.php`, `CreateRetroTest.php`, `BoardSnapshotTest.php`, `ReadPrivacyTest.php`, `MessagesAndSummaryTest.php`, `ActionsPhaseTest.php` | each dataset row or `inPhase(RetroPhase::HealthCheck)` becomes `inPhase(RetroPhase::Writing)` (or loses the row when it only listed phases); `retro.healthCheckEnabled` assertions go |

`tests/Browser` is not edited here (walkthroughs are not run; the visual files are Task 31's).

- [ ] **Step 6: Run the tests on the four engines**

Run, for each of `pgsql`, `mariadb`, `mysql`, `sqlite`: `bin/test-db <engine> -- tests/Upgrade/HealthPhaseMoveTest.php tests/Feature/Retros tests/Feature/Teams tests/Feature/TeamSurveys tests/Feature/Mcp tests/Arch`
Expected: PASS on each.

- [ ] **Step 7: Commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app database tests
git commit -m "feat(retro): the health-check phase is gone; retros that were in it move on with their health check open"
```

### Task 28: Remove the health-check phase — front

**Files:**
- Modify: `resources/js/lib/retro/types.ts` (the phase union loses `health_check`; `retro.healthCheckEnabled` goes), `lib/retro/phases.ts` (+ test), `lib/retro/adapters.ts` (+ test), `components/retro/board.tsx` (the `phase === 'health_check'` branch), `components/skrum/session-settings-popover.tsx` (+ test: `votePhases`, the `health_check` phase label), `components/skrum/phase-stepper.tsx` (+ test) only if it names the phase, `resources/js/lib/shortcuts/sections.ts` if it names the phase, `resources/js/pages/dev/sections/{phase-stepper,session-shell,session-settings-popover,health-check}.tsx`
- Delete: `resources/js/components/retro/phase-health.tsx` and `phase-health.test.tsx` (the dialog of Task 25 replaces the panel; `useHealthCheckSubmission` stays)

- [ ] **Step 1:** `grep -rn "health_check\|healthCheckEnabled\|PhaseHealth" resources/js` and remove every use that is a phase: the stepper step, the phase panel branch, the "first phase" copy. Keep `HealthCheckForm`, `HealthCheckResults`, `HealthCheckCompact`, the reducer actions `health.progress` and `health.submitted`, the results section of the completed retro and the channel event `health.answered`.
- [ ] **Step 2:** Vitest: the stepper of a retro renders Writing to ROTI (and Icebreaker first when enabled) and no "Health check" step; the board reducer ignores nothing it handled before; the dev bench sections compile.
- [ ] **Step 3:** `npm run test`, `npm run types:check`, `npm run check`, `npm run build:front`. Deviation D-03 of plan 18e is cleared (Task 31 captures the stepper in Writing).
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(retro): the stepper and the board without a health-check phase"
```

### Task 29: Delete the old health models, and prove nothing reads the old tables

**Files:**
- Delete: `app/Models/HealthCheckAnswer.php`, `app/Models/RetroHealthStatement.php`, `database/factories/HealthCheckAnswerFactory.php`, `database/factories/RetroHealthStatementFactory.php`, `app/Actions/HealthCheck/FreezeHealthStatements.php`; `app/Actions/HealthCheck/PresentHealthStatement.php` if nothing uses it any more (check `TeamsController`, `TeamHealthChecksController`, `PresentTeamHealthStatements`: it presents team statements too, in which case it stays, narrowed to `TeamHealthStatement|HealthStatement`)
- Modify: `app/Models/Retro.php` (relations `healthStatements`, `healthCheckAnswers` removed), `app/Models/Participant.php` (relation `healthCheckAnswers` removed), `tests/Feature/Retros/HealthStatementModelsTest.php`
- Test: `tests/Feature/TeamSurveys/OldHealthTablesUnreadTest.php`

No table and no column is dropped (decision 7).

- [ ] **Step 1: Write the failing test**

```php
<?php

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\Finder\SplFileInfo;

it('reads and writes the old health tables nowhere but in the import and its verification', function () {
    $allowed = ['Support/Surveys/ImportHealthChecks.php', 'Support/Surveys/VerifyHealthCheckImport.php'];

    $offenders = collect(File::allFiles(app_path()))
        ->reject(fn (SplFileInfo $file): bool => in_array($file->getRelativePathname(), $allowed, true))
        ->filter(fn (SplFileInfo $file): bool => preg_match('/health_check_answers|retro_health_statements|\bHealthCheckAnswer\b|\bRetroHealthStatement\b|FreezeHealthStatements|healthCheckAnswers\(/', $file->getContents()) === 1)
        ->map(fn (SplFileInfo $file): string => $file->getRelativePathname())
        ->values()
        ->all();

    expect($offenders)->toBe([]);
});

it('keeps the old tables and the old column until a later release drops them', function () {
    expect(Schema::hasTable('health_check_answers'))->toBeTrue()
        ->and(Schema::hasTable('retro_health_statements'))->toBeTrue()
        ->and(Schema::hasColumn('retros', 'health_check_enabled'))->toBeTrue();
});
```

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/OldHealthTablesUnreadTest.php` — Expected: FAIL on the first case, listing the files to delete, `Models/Retro.php` and `Models/Participant.php`.

- [ ] **Step 2:** Delete the files, remove the three relations. In `HealthStatementModelsTest.php`: "orders team and retro statements by position" keeps its team half; "stores one answer per participant and statement" and "removes a retro frozen set and its answers with the retro" are replaced, case for case, by "stores one answer per respondent and question" (already in `TeamSurveyModelTest`: remove the duplicate here and note it in the commit) and "removes an attached health check and its answers with the retro" (create a retro with `withHealthCheck()`, answer through `answerHealthCheck`, delete the retro, assert no `team_surveys`, `team_survey_questions` or `team_survey_answers` row is left). The three cases about built-in statements and `TeamHealthStatement` are untouched. The fixture helpers `oldHealthStatements`, `oldHealthAnswer`, `oldHealthFlag` of `tests/Pest.php` stay: they write with `DB::table()`.
- [ ] **Step 3:** Run on the four engines: `bin/test-db <engine>` (the whole Unit, Feature, Upgrade and Arch suites, one engine at a time) — Expected: PASS on each.
- [ ] **Step 4: Commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add -A app database tests
git commit -m "refactor(health): remove the models, relations and freeze action of the old health check; its tables stay, unread"
```

---

## Final

### Task 30: Translations

**Files:** `lang/en.json`, `lang/fr.json`, `lang/es.json`, `lang/de.json`; `tests/Feature/TranslationKeysTest.php` and `tests/Feature/InformalRegisterTest.php` must pass.

Keys are added by the task that introduces them; this task is the review pass. Rules (owner, sixth round; `docs/superpowers/research/front-rewrite/translations-review.md`):

- **Informal register everywhere:** French "tu", Spanish "tú", German "du"; a plural "vous" only where the text addresses several people at once (the four assessment sentences of the health check already are; nothing in this plan adds one). `InformalRegisterTest` scans the values.
- **One value per key.** A key that already exists keeps its value and is not listed below: among them `Health check` (Bilan de santé / Chequeo de salud / Gesundheitscheck), `Survey`, `Surveys`, `Add survey`, `Draft`, `Closed` (Clos / Cerrada / Geschlossen), `Required` (Obligatoire / Obligatoria / Pflichtfeld), `Built-in` (Intégrée / Predefinida / Integriert), `Finish` (Terminer / Finalizar / Fertig), `Strongly disagree`, `Strongly agree`, `Submit answers`, `Answers sent. Thank you.`, `Anonymous`, `Facilitator` (Facilitateur / Facilitador / Moderation). Before adding a key, look it up in `lang/en.json`.
- **Glossary** of the review: French "facilitateur", "deck", "icebreaker"; Spanish "baraja", "póker"; German "Moderation" (not "Moderator"), "Arbeitsbereich" (not "Workspace"), "Aktionspunkt", "Gesundheitscheck".
- Length: no label of a button, tab or menu item may wrap at 1440.

Then: `bin/test-db sqlite -- tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php`, one read of each language for term consistency, and the report of any key a task added outside the tables below.

Back end:

| Key | fr | es | de |
|---|---|---|---|
| Open | Ouvert | Abierta | Offen |
| Blank | Vierge | En blanco | Leer |
| Start with no question. | Commencer sans question. | Empezar sin preguntas. | Ohne Frage beginnen. |
| The team's statements, scored 1 to 5. | Les énoncés de l'équipe, notés de 1 à 5. | Los enunciados del equipo, puntuados de 1 a 5. | Die Aussagen des Teams, bewertet von 1 bis 5. |
| Team pulse | Pulse d'équipe | Pulso del equipo | Team-Puls |
| Workload, recommendation, rituals and blockers. | Charge, recommandation, rituels et freins. | Carga, recomendación, rituales y bloqueos. | Arbeitslast, Empfehlung, Rituale und Hindernisse. |
| How do you rate the workload of this sprint? | Comment évalues-tu la charge de travail de ce sprint ? | ¿Cómo valoras la carga de trabajo de este sprint? | Wie bewertest du die Arbeitslast dieses Sprints? |
| Unbearable | Intenable | Insostenible | Untragbar |
| Very comfortable | Très confortable | Muy cómoda | Sehr angenehm |
| Would you recommend this team to a developer friend? | Recommanderais-tu cette équipe à un·e ami·e développeur·se ? | ¿Recomendarías este equipo a un amigo desarrollador? | Würdest du dieses Team einem befreundeten Entwickler empfehlen? |
| Which ritual should we keep at all costs? | Quel rituel garder absolument ? | ¿Qué ritual hay que mantener a toda costa? | Welches Ritual sollten wir unbedingt behalten? |
| Daily | Daily | Daily | Daily |
| Sprint review | Revue de sprint | Revisión del sprint | Sprint-Review |
| What slowed you down this sprint? | Qu'est-ce qui t'a freiné ce sprint ? | ¿Qué te ha frenado en este sprint? | Was hat dich in diesem Sprint gebremst? |
| Too many meetings | Trop de réunions | Demasiadas reuniones | Zu viele Meetings |
| Dependency on another team | Dépendance à une autre équipe | Dependencia de otro equipo | Abhängigkeit von einem anderen Team |
| Test environment | Environnement de recette | Entorno de pruebas | Testumgebung |
| Unclear specifications | Spécifications floues | Especificaciones poco claras | Unklare Spezifikationen |
| Something else | Autre chose | Otra cosa | Etwas anderes |
| A word for the team? | Un mot pour l'équipe ? | ¿Unas palabras para el equipo? | Ein Wort an das Team? |
| Only the survey's facilitator or a workspace admin can do this. | Seul le facilitateur du sondage ou un administrateur de l'espace peut faire cela. | Solo el facilitador de la encuesta o un administrador del espacio puede hacerlo. | Nur die Moderation der Umfrage oder ein Admin des Arbeitsbereichs kann das tun. |
| Questions can only change while the survey is a draft. | Les questions ne peuvent changer que tant que le sondage est un brouillon. | Las preguntas solo pueden cambiar mientras la encuesta es un borrador. | Fragen können nur geändert werden, solange die Umfrage ein Entwurf ist. |
| The questions of a health check come from the team's statements. | Les questions d'un bilan de santé viennent des énoncés de l'équipe. | Las preguntas de un chequeo de salud vienen de los enunciados del equipo. | Die Fragen eines Gesundheitschecks stammen aus den Aussagen des Teams. |
| This survey is not open. | Ce sondage n'est pas ouvert. | Esta encuesta no está abierta. | Diese Umfrage ist nicht geöffnet. |
| You no longer have access to this survey. | Tu n'as plus accès à ce sondage. | Ya no tienes acceso a esta encuesta. | Du hast keinen Zugriff mehr auf diese Umfrage. |
| A survey can have at most 30 questions. | Un sondage peut avoir 30 questions au plus. | Una encuesta puede tener 30 preguntas como máximo. | Eine Umfrage kann höchstens 30 Fragen haben. |
| Send every question exactly once. | Envoie chaque question exactement une fois. | Envía cada pregunta exactamente una vez. | Sende jede Frage genau einmal. |
| This change is not possible. | Ce changement n'est pas possible. | Este cambio no es posible. | Diese Änderung ist nicht möglich. |
| Add a question before publishing. | Ajoute une question avant de publier. | Añade una pregunta antes de publicar. | Füge vor dem Veröffentlichen eine Frage hinzu. |
| An attached health check cannot be reopened once its retro is completed. | Un bilan de santé rattaché ne peut pas être rouvert une fois sa rétro terminée. | Un chequeo de salud adjunto no puede reabrirse una vez completada su retro. | Ein angehängter Gesundheitscheck kann nicht wieder geöffnet werden, sobald seine Retro abgeschlossen ist. |
| Answer at least one question before finishing. | Réponds à au moins une question avant de terminer. | Responde al menos a una pregunta antes de terminar. | Beantworte mindestens eine Frage, bevor du abschließt. |
| An answer is required. | Une réponse est requise. | Se requiere una respuesta. | Eine Antwort ist erforderlich. |
| Copy of :title | Copie de :title | Copia de :title | Kopie von :title |
| Respondent | Répondant | Participante | Teilnehmer |
| Respondent :number | Répondant :number | Participante :number | Teilnehmer :number |
| comment | commentaire | comentario | Kommentar |
| Results can be exported once the survey is closed. | Les résultats peuvent être exportés une fois le sondage clôturé. | Los resultados pueden exportarse cuando la encuesta esté cerrada. | Die Ergebnisse können exportiert werden, sobald die Umfrage geschlossen ist. |
| Not enough answers to show results. | Pas assez de réponses pour afficher les résultats. | No hay suficientes respuestas para mostrar los resultados. | Nicht genug Antworten, um Ergebnisse zu zeigen. |
| This retro already has a health check. | Cette rétro a déjà un bilan de santé. | Esta retro ya tiene un chequeo de salud. | Diese Retro hat bereits einen Gesundheitscheck. |
| The health check is closed. | Le bilan de santé est clôturé. | El chequeo de salud está cerrado. | Der Gesundheitscheck ist geschlossen. |
| You have already sent your answers. | Tu as déjà envoyé tes réponses. | Ya has enviado tus respuestas. | Du hast deine Antworten bereits gesendet. |
| Score every statement before sending. | Note chaque énoncé avant d'envoyer. | Puntúa cada enunciado antes de enviar. | Bewerte jede Aussage vor dem Senden. |
| Health check: :score/5 (:respondents of :participants participants answered) | Bilan de santé : :score/5 (:respondents participants sur :participants ont répondu) | Chequeo de salud: :score/5 (:respondents de :participants participantes respondieron) | Gesundheitscheck: :score/5 (:respondents von :participants Teilnehmenden haben geantwortet) |

The key `Health check: :score/10 (…)` leaves the four files in Task 16 (no longer used); `TranslationKeysTest` tells whether another key became unused (`:score · Awful`, `:score · Great`, `Rate each statement from 1 (Awful) to 10 (Great). Only you see your own scores.`, the two "scored 1–10" sentences of `HealthCheckSummary`).

Front:

| Key | fr | es | de |
|---|---|---|---|
| Poll | Sondage | Encuesta | Umfrage |
| Quick vote or health check | Vote rapide ou bilan de santé | Votación rápida o chequeo de salud | Schnelle Abstimmung oder Gesundheitscheck |
| Quick vote | Vote rapide | Votación rápida | Schnelle Abstimmung |
| Start from | Partir de | Empezar desde | Ausgehend von |
| A previous survey | Un sondage précédent | Una encuesta anterior | Eine frühere Umfrage |
| No survey to start from yet | Aucun sondage dont partir pour l'instant | Aún no hay ninguna encuesta de la que partir | Noch keine Umfrage als Ausgangspunkt |
| Allow guests without an account | Autoriser les invités sans compte | Permitir invitados sin cuenta | Gäste ohne Konto zulassen |
| :count statements · scored 1 to 5 | :count énoncés · notés de 1 à 5 | :count enunciados · puntuados de 1 a 5 | :count Aussagen · bewertet von 1 bis 5 |
| :count questions | :count questions | :count preguntas | :count Fragen |
| :count answers · :questions questions | :count réponses · :questions questions | :count respuestas · :questions preguntas | :count Antworten · :questions Fragen |
| No survey published yet | Aucun sondage publié | Aún no hay encuestas publicadas | Noch keine Umfrage veröffentlicht |
| Create a survey | Créer un sondage | Crear una encuesta | Umfrage erstellen |
| Survey actions | Actions du sondage | Acciones de la encuesta | Umfrageaktionen |
| Delete this survey? | Supprimer ce sondage ? | ¿Eliminar esta encuesta? | Diese Umfrage löschen? |
| Its questions and answers are deleted too. | Ses questions et ses réponses sont supprimées aussi. | Sus preguntas y respuestas también se eliminan. | Ihre Fragen und Antworten werden ebenfalls gelöscht. |
| Publish | Publier | Publicar | Veröffentlichen |
| Back to draft | Repasser en brouillon | Volver a borrador | Zurück zum Entwurf |
| View results | Voir les résultats | Ver resultados | Ergebnisse ansehen |
| Saved :time ago | Enregistré il y a :time | Guardado hace :time | Vor :time gespeichert |
| Saving… | Enregistrement… | Guardando… | Wird gespeichert… |
| Not saved | Non enregistré | No guardado | Nicht gespeichert |
| Untitled question | Question sans titre | Pregunta sin título | Unbenannte Frage |
| Add a question | Ajouter une question | Añadir una pregunta | Frage hinzufügen |
| Scale 1 – 5 | Échelle 1 – 5 | Escala 1 – 5 | Skala 1 – 5 |
| NPS | NPS | NPS | NPS |
| Single choice | Choix unique | Opción única | Einfachauswahl |
| Multiple choice | Choix multiple | Opción múltiple | Mehrfachauswahl |
| Free text | Texte libre | Texto libre | Freitext |
| Label of 1 | Libellé du 1 | Etiqueta del 1 | Beschriftung der 1 |
| Label of 5 | Libellé du 5 | Etiqueta del 5 | Beschriftung der 5 |
| Not at all likely | Pas du tout probable | Nada probable | Überhaupt nicht wahrscheinlich |
| Extremely likely | Extrêmement probable | Extremadamente probable | Äußerst wahrscheinlich |
| 500 characters max | 500 caractères max | 500 caracteres máx. | max. 500 Zeichen |
| Reorder question :number | Réordonner la question :number | Reordenar la pregunta :number | Frage :number verschieben |
| One question at a time | Une question à la fois | Una pregunta a la vez | Eine Frage nach der anderen |
| Recommended on a phone | Recommandé sur mobile | Recomendado en el móvil | Auf dem Handy empfohlen |
| Show results after answering | Montrer les résultats après réponse | Mostrar los resultados tras responder | Ergebnisse nach der Antwort zeigen |
| Answers are anonymous | Les réponses sont anonymes | Las respuestas son anónimas | Antworten sind anonym |
| A result is shown from :count answers, and free answers are sorted before they are shown. | Un résultat n'est affiché qu'à partir de :count réponses, et les réponses libres sont triées avant affichage. | Un resultado solo se muestra a partir de :count respuestas, y las respuestas libres se ordenan antes de mostrarse. | Ein Ergebnis wird erst ab :count Antworten gezeigt, und Freitextantworten werden vor der Anzeige sortiert. |
| Free answers are sorted before they are shown. | Les réponses libres sont triées avant affichage. | Las respuestas libres se ordenan antes de mostrarse. | Freitextantworten werden vor der Anzeige sortiert. |
| Manage statements | Gérer les énoncés | Gestionar enunciados | Aussagen verwalten |
| Questions cannot change once a survey is open. | Les questions ne peuvent plus changer une fois le sondage ouvert. | Las preguntas no pueden cambiar una vez abierta la encuesta. | Fragen können nicht mehr geändert werden, sobald die Umfrage geöffnet ist. |
| Anonymous answers | Réponses anonymes | Respuestas anónimas | Anonyme Antworten |
| Question :current of :total | Question :current sur :total | Pregunta :current de :total | Frage :current von :total |
| Why this score? (optional) | Pourquoi cette note ? (facultatif) | ¿Por qué esta nota? (opcional) | Warum diese Bewertung? (optional) |
| Change my answers | Modifier mes réponses | Cambiar mis respuestas | Meine Antworten ändern |
| Thank you — your answers are saved. | Merci — tes réponses sont enregistrées. | Gracias: tus respuestas se han guardado. | Danke – deine Antworten sind gespeichert. |
| :count of :total have answered | :count sur :total ont répondu | :count de :total han respondido | :count von :total haben geantwortet |
| Neither the facilitator nor the team can link this answer to you. | Ni le facilitateur ni l'équipe ne peuvent relier cette réponse à toi. | Ni el facilitador ni el equipo pueden relacionar esta respuesta contigo. | Weder die Moderation noch das Team können diese Antwort dir zuordnen. |
| Your answers are saved as you give them; the counter is paused. | Tes réponses sont enregistrées au fur et à mesure ; le compteur est en pause. | Tus respuestas se guardan a medida que las das; el contador está en pausa. | Deine Antworten werden beim Geben gespeichert; der Zähler ist pausiert. |
| Not saved — retry | Non enregistré — réessayer | No guardado: reintentar | Nicht gespeichert – erneut versuchen |
| This survey is closed. | Ce sondage est clôturé. | Esta encuesta está cerrada. | Diese Umfrage ist geschlossen. |
| This survey was deleted. | Ce sondage a été supprimé. | Esta encuesta se ha eliminado. | Diese Umfrage wurde gelöscht. |
| Join a survey | Rejoindre un sondage | Unirse a una encuesta | Einer Umfrage beitreten |
| Free-text answers | Réponses libres | Respuestas libres | Freitextantworten |
| Compare | Comparer | Comparar | Vergleichen |
| Compare with | Comparer avec | Comparar con | Vergleichen mit |
| Export CSV | Exporter en CSV | Exportar CSV | CSV exportieren |
| Close the survey? | Clôturer le sondage ? | ¿Cerrar la encuesta? | Umfrage schließen? |
| People can no longer answer. You can reopen it. | Plus personne ne pourra répondre. Tu pourras le rouvrir. | Ya nadie podrá responder. Puedes reabrirla. | Niemand kann mehr antworten. Du kannst sie wieder öffnen. |
| :responses answers out of :audience participants · anonymous | :responses réponses sur :audience participants · anonyme | :responses respuestas de :audience participantes · anónima | :responses Antworten von :audience Teilnehmenden · anonym |
| closed on :date | clôturé le :date | cerrada el :date | geschlossen am :date |
| most frequent answer | réponse la plus fréquente | respuesta más frecuente | häufigste Antwort |
| :detractors detractors, :passives passives, :promoters promoters | :detractors détracteurs, :passives passifs, :promoters promoteurs | :detractors detractores, :passives pasivos, :promoters promotores | :detractors Kritiker, :passives Passive, :promoters Fürsprecher |
| :value vs :title | :value vs :title | :value frente a :title | :value ggü. :title |
| no change | aucun changement | sin cambios | keine Änderung |
| See the :count answers | Voir les :count réponses | Ver las :count respuestas | Die :count Antworten ansehen |
| Results appear from :threshold answers. :responses so far. | Les résultats apparaissent à partir de :threshold réponses. :responses pour l'instant. | Los resultados aparecen a partir de :threshold respuestas. :responses por ahora. | Ergebnisse erscheinen ab :threshold Antworten. Bisher :responses. |
| Results will show when the survey is closed. | Les résultats s'afficheront à la clôture du sondage. | Los resultados se mostrarán cuando se cierre la encuesta. | Die Ergebnisse erscheinen, wenn die Umfrage geschlossen ist. |
| Answer the survey to see the results. | Réponds au sondage pour voir les résultats. | Responde a la encuesta para ver los resultados. | Beantworte die Umfrage, um die Ergebnisse zu sehen. |
| Nothing to compare with yet. | Rien à comparer pour l'instant. | Aún no hay nada con qué comparar. | Noch nichts zum Vergleichen. |
| The other survey does not have enough answers. | L'autre sondage n'a pas assez de réponses. | La otra encuesta no tiene suficientes respuestas. | Die andere Umfrage hat nicht genug Antworten. |
| Only in this survey | Seulement dans ce sondage | Solo en esta encuesta | Nur in dieser Umfrage |
| Only in :title | Seulement dans :title | Solo en :title | Nur in :title |
| higher | en hausse | más alto | höher |
| lower | en baisse | más bajo | niedriger |
| Quick poll | Sondage rapide | Encuesta rápida | Schnellumfrage |
| One question, answered on the board | Une question, à laquelle on répond sur le board | Una pregunta, respondida en el tablero | Eine Frage, auf dem Board beantwortet |
| Health check added | Bilan de santé ajouté | Chequeo de salud añadido | Gesundheitscheck hinzugefügt |
| Health check, :answered of :total answered | Bilan de santé, :answered sur :total ont répondu | Chequeo de salud, :answered de :total han respondido | Gesundheitscheck, :answered von :total haben geantwortet |
| Close the health check | Clôturer le bilan de santé | Cerrar el chequeo de salud | Gesundheitscheck schließen |
| Everyone will see the results. | Tout le monde verra les résultats. | Todo el mundo verá los resultados. | Alle werden die Ergebnisse sehen. |
| Its answers are kept and come back if you add it again. | Ses réponses sont conservées et reviennent si tu l'ajoutes à nouveau. | Sus respuestas se conservan y vuelven si lo añades de nuevo. | Die Antworten bleiben erhalten und kommen zurück, wenn du ihn wieder hinzufügst. |
| It has no answer yet. | Il n'a pas encore de réponse. | Aún no tiene respuestas. | Er hat noch keine Antwort. |
| The team rates its statements during the retro | L'équipe note ses énoncés pendant la rétro | El equipo puntúa sus enunciados durante la retro | Das Team bewertet seine Aussagen während der Retro |
| Rate each statement from 1 (Strongly disagree) to :max (Strongly agree). Only you see your own scores. | Note chaque énoncé de 1 (Pas du tout d'accord) à :max (Tout à fait d'accord). Toi seul vois tes notes. | Puntúa cada enunciado de 1 (Totalmente en desacuerdo) a :max (Totalmente de acuerdo). Solo tú ves tus puntuaciones. | Bewerte jede Aussage von 1 (Stimme überhaupt nicht zu) bis :max (Stimme voll zu). Nur du siehst deine Bewertungen. |
| :score · Strongly disagree | :score · Pas du tout d'accord | :score · Totalmente en desacuerdo | :score · Stimme überhaupt nicht zu |
| :score · Strongly agree | :score · Tout à fait d'accord | :score · Totalmente de acuerdo | :score · Stimme voll zu |
| :count statements, scored 1–5, asked in every health check | :count énoncés, notés de 1 à 5, posés à chaque bilan de santé | :count enunciados, puntuados de 1 a 5, preguntados en cada chequeo de salud | :count Aussagen, bewertet von 1 bis 5, in jedem Gesundheitscheck gefragt |
| 1 statement, scored 1–5, asked in every health check | 1 énoncé, noté de 1 à 5, posé à chaque bilan de santé | 1 enunciado, puntuado de 1 a 5, preguntado en cada chequeo de salud | 1 Aussage, bewertet von 1 bis 5, in jedem Gesundheitscheck gefragt |
| Start a health check | Lancer un bilan de santé | Iniciar un chequeo de salud | Gesundheitscheck starten |
| Kind | Type | Tipo | Art |

The French sentence "Toi seul vois tes notes." is the review's form for a single reader; `InformalRegisterTest` accepts it. A key the table above cannot settle (gender, length) is listed in the report as a doubtful case, as `translations-review.md` does.

- [ ] Run the two tests on SQLite, fix what they report, commit `chore(i18n): the survey and health-check strings in four languages, informal`.

### Task 31: Captures (light, 1440, French)

The owner's working rule: no browser walkthrough is written or run. This task, which the first draft spent on walkthroughs, takes **captures only**, in one configuration — light theme, 1440 wide, French — through the visual harness of `tests/Browser/Visual` (`CapturesVisuals::captureVisuals`, which honours `VISUAL_ONLY`). Nothing in `tests/Browser/Walkthroughs` is written, edited or run; the walkthrough files that name the health-check phase or the old health models (`Plan08bHealthCheckTest`, `Plan08aFlowAndTemplatesTest`, `Plan08cSurveysTest`, `Plan08dResultsTest`, `Plan08eLlmTest`, `Plan18eSessionCreateTest`, `Plan18eTeamPageTest`) are listed in the report as stale.

**Files:**
- Create: `tests/Browser/Visual/SurveyPagesVisualTest.php`
- Modify: `tests/Browser/Visual/RetroPagesVisualTest.php` and `TeamPageVisualTest.php` (they build their health fixtures with `FreezeHealthStatements` and `HealthCheckAnswer`, which Task 29 deleted: move them to `attachHealthCheck` / `answerHealthCheck` / `closeHealthCheck`, scores on 1 to 5), `SessionCreateVisualTest.php` (the dialog on the Poll type)

- [ ] **Step 1: Cases.** One `captureVisuals` call per screen, with fixtures built by factories and the helpers of `tests/Pest.php`, in the style of `TeamPageVisualTest.php` (fixed ids and names, `travelTo` for dates):

| Name | Screen |
|---|---|
| `session-create-poll` | the "New session" dialog on Poll, "Health check" selected |
| `survey-builder` | the builder of a Team pulse draft with its first question open (frame a) |
| `survey-builder-health-check` | the builder of a health-check draft (locked list) |
| `survey-participant` | the participant page on the NPS question of a Team pulse (frame b) |
| `survey-results` | the results of a closed Team pulse with nine respondents (frame c, Summary) |
| `survey-compare` | the Compare tab against a previous Team pulse |
| `survey-join` | the guest join page of an open survey |
| `retro-health-check-dialog` | a retro in Writing with the health-check dialog open, three statements scored, "Submit answers" enabled |
| `retro-health-check-results` | the same retro once the health check is closed (results, distribution 1→5) |
| `team-surveys` | the team page scrolled to the Surveys block |
| `team-health-check-page` | the health-check page with a Mood trend mixing an imported retro (halved) and a health check run as a survey |

- [ ] **Step 2: Run.** Build the assets (`npm run build:front`), then, as the 18e captures were taken, with `VISUAL_ONLY=light-1440-fr` in the application container's environment: `docker compose exec -e VISUAL_ONLY=light-1440-fr laravel.test php artisan test --compact tests/Browser/Visual/SurveyPagesVisualTest.php`, and the same for the three edited files (from a worktree, the container and the working directory as `bin/test-db` documents them). The overflow check of the harness must pass. Only the `-light-1440-fr.png` files are written; the other configurations of the edited files are left as they are.
- [ ] **Step 3:** Commit `test(visual): survey and health-check captures, light, 1440, French`.

### Task 32: Deviations and documents

- [ ] For each capture of Task 31, open it beside the mockup's `preview.html` (light, 1440, French) and write the remaining differences. Each is fixed, or is a row of **Pre-build deviations** above with the owner's word. A difference that fits no reason stops the task.
- [ ] Documents, in one commit:
  - move the spec to `docs/superpowers/specs/2026-10-19-standalone-surveys-design.md` and this plan to `docs/superpowers/plans/2026-10-19-plan-19-standalone-surveys.md`, replacing the drafts, with the owner's answers to §17 items 9 to 12 folded into the spec;
  - `docs/superpowers/research/front-rewrite/feature-roadmap.md`: rows SV-1 to SV-5 marked done; "Not requested, staying backlog" of the surveys section completed with spec §13; no row of plans 28 or 30 or of scheduling is touched;
  - `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, table "Deviations from the mockup": D-03 and D-102 removed; D-09 reworded (the Poll type exists; the per-type tiles stay as decided); D-22 reduced to what stays backlog; D-23 unchanged except "Add survey" now opening the menu; D-76's sentence ("scored 1–5");
  - `docs/superpowers/specs/2026-10-01-front-rewrite-design.md`: §4 "Health check phase", §6.4 retro phases and session creation, B18, B23 and §10 amended with a pointer to the new spec;
  - `docs/database.md`: nothing to add unless a task found a new rule (then one line in "Rules for database code");
  - `README.md`: one paragraph in the upgrade notes — the health scores are now read on 1 to 5 (old 1-to-10 scores halved, raw values kept); run `php artisan surveys:verify-health-import` right after the migrations of this release.
- [ ] Commit `docs: plan 19 — spec and plan in place, roadmap and deviation rows updated`.

### Task 33: Full suites and report

- [ ] `vendor/bin/pint --format agent`; `vendor/bin/sail composer types:check` (PHPStan level 7); `vendor/bin/sail composer rector:check`.
- [ ] `bin/test-db pgsql`, then `bin/test-db sqlite`, `bin/test-db mariadb`, `bin/test-db mysql` (Unit, Feature, Upgrade and Arch in parallel; one engine at a time, never two whole suites at once in the shared container) — Expected: `test-db <engine>: PASS` on each.
- [ ] `bin/test-db pgsql --concurrency`, `bin/test-db mariadb --concurrency`, `bin/test-db mysql --concurrency`, `bin/test-db sqlite-file --concurrency` — Expected: PASS on each.
- [ ] `bin/check-pg-upgrade` — Expected: PASS (the upgraded schema equals a fresh install's).
- [ ] `npm run test`, `npm run types:check`, `npm run check`, `npm run build:front` — Expected: PASS.
- [ ] `vendor/bin/sail artisan surveys:verify-health-import` on the development database, and on a copy of a production database if the owner provides one; attach the output.
- [ ] Report `docs/superpowers/research/plan-19-report.md` (asked for by this plan): what is done, per acceptance criterion of spec §15 with the test that proves it and the engines it passed on; the differences that remain with each mockup; every existing test that was edited and why (with the hand computation of each health number that moved to the health scale); every translation key added outside the tables of Task 30; the output of the import and verification commands; the stale walkthrough files; every decision taken on the owner's behalf; what is left for the plan that drops the old tables.
- [ ] Commit `docs: plan 19 report`. Then ask the owner to read the report. No merge into `main`, no push.

---

## Self-review (done while writing; kept for the reader)

**Spec coverage.** §6.1 tables: Task 1. §6.2 kinds and limits: Tasks 7, 9, 10. §6.3 respondents and anonymity: Tasks 3, 9, 10, 15 (attached surveys refused by the survey scope: Tasks 3, 5, 6). §6.4 visibility and threshold: Tasks 1 (`resultsVisibleTo`), 10, 12. §6.5 templates: Tasks 2 (on five, required, translated ends), 4, 11, 15 (statements follow the team). §6.6 comparison on five: Tasks 11, 24. §6.7 retro surveys untouched: no task touches them. §7 lifecycle and permissions: Tasks 3, 4, 7, 8, 9, 11, 12, 13, 15 (submission). §8 real time: Tasks 5, 9, 15, 17. §9 screens: Tasks 18 to 26. §10 CSV: Task 12. §11 migration: Tasks 14 (import, Upgrade test), 15 (writers, submission and board), 16 (readers on the health scale, front scale), 27 (phase, Upgrade test), 29 (models); §11.8 order: the Step B note and Task 27; §11.9 the rule: Task 2 (`HealthScale`) and Task 16. §12 routes: Tasks 3 to 12 and 15. §14 testing: every task runs its tests on the four engines; races in Tasks 3, 7, 9, 15; Upgrade tests in Tasks 14, 27; captures in Task 31. §15 criteria: 1 → 4, 18; 2 → 2, 4, 11; 3 → 7, 20; 4 → 8; 5 → 3, 6; 6 → 9; 7, 8 → 10; 9 → 1, 10, 12; 10 → 10; 11 → 5, 17, 23; 12 → 5; 13 → 11; 14 → 12; 15 → 3; 16, 17 → 14, 16; 18, 19 → 27; 20, 21 → 15, 25; 22, 23 → 16, 26; 24 → no task (untouched routes; their tests run in Task 33); 25 → 13, 19, 26; 26 → 30, 31, 32; 27 → 33.

**Gaps found and closed while writing v2.** The draft named migration dates the portability work already uses (`2026_10_19_1000xx`): the plan's are `2026_10_20_…`. The draft rendered Inertia pages that did not exist before Step C, which `tests/Arch/FrontEndPagesTest.php` refuses: Tasks 3, 6 and 10 create thin page files. The draft's guest join suggested the user's name only; the code now draws a random nickname (`PresentJoinSession::nickname`). `Participant::healthCheckAnswers()` was missing from the readers to delete (Task 29). `MailMockupTest` asserts the recap's "/10" line (Task 16). The two visual files that build health fixtures with the old models would break once Task 29 deletes them (Task 31). Text answers and label matching sort and fold through `Alphabetical`, not `mb_strtolower` (rule 7).

**Placeholders.** Back-end tasks carry their tests and code. Screen tasks 18 to 26 carry composition tables, behaviours, hooks, states and the code of their pure logic, not full component code: they follow the screen procedure of plan 18e, where the mockup is the specification of the markup. Every component they build on was read on `plan-db-portability` and is named with its path.

**Type consistency.** `BuildTeamSurveySnapshot::handle(TeamSurvey, TeamSurveyRespondent)` grows by keys in Tasks 3, 9, 10, 11 and matches `SurveySnapshot` of Task 17. `AnnounceSurveyResponses::handle` stays `void` (attached surveys never reach it). `BuildHealthTrend::scores` becomes `scoresOf` in Task 16, and its only other caller, `BuildTeamMoodTrend`, is rewritten in the same task. `surveyQuestion()` gives the first question position 1, which the position assertions of Tasks 7 and 12 account for. `SummarizeHealthCheck::handle` keeps its signature; `forSurvey` is new and takes the number of participants. The board's `healthCheck` (Task 15) and the reducer actions `health.progress` (`respondents`, `participants`) and `health.submitted` are the ones Task 25 reads.

**Review Focus.** Each line has its test: CSV formulas (Task 12), a double save and a close during answers (Task 9, with `Race`), a viewer without results (Tasks 5, 10), an import run twice or late (Task 14), a retro caught in the removed phase (Task 27, Upgrade), the halving rule (Tasks 2 and 16), a double "Submit answers" (Task 15, with `Race`).

**Known weak points of this draft.** Nothing was run. The literals of `HealthCheckParityTest` were computed by hand from the old code as read and then halved per statement by §11.9; Task 16 Step 2 checks the old values against the old code before the rewrite. The translations are a first pass, reviewed in Task 30.

