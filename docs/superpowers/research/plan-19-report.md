# Plan 19: standalone team surveys, and the health check as a survey — report

Branch `plan-19-surveys` (worktree `.claude/worktrees/p19`), cut from `plan-db-portability` at `3fa2e0c3`. Spec:
`docs/superpowers/specs/2026-10-19-standalone-surveys-design.md`; plan:
`docs/superpowers/plans/2026-10-19-plan-19-standalone-surveys.md`. Final run on 2026-10-03 on the code of
`d1d6302b` (the rector pass of Task 33); the commit after it adds this report only. Not pushed; `main` untouched.

## 1. Result

One command at a time in the shared application container `skrum-laravel.test-1`, database `testing_l30`
(`TEST_DB_DATABASE=testing_l30`, `TEST_DB_WORKDIR=/var/www/html/.claude/worktrees/p19`), eight processes.

| Run | Result |
|---|---|
| `bin/test-db pgsql` | `PASS, Tests: 2 skipped, 6162 passed (55685 assertions)` (2 min 11) |
| `bin/test-db sqlite` (in memory) | `PASS, Tests: 8 skipped, 6156 passed (55672 assertions)` |
| `bin/test-db mariadb` | `PASS, Tests: 1 skipped, 6163 passed (55687 assertions)` |
| `bin/test-db mysql` | `PASS, Tests: 1 skipped, 6163 passed (55687 assertions)` (over 10 min) |
| `bin/test-db pgsql --concurrency` | `PASS, Tests: 1 skipped, 26 passed (117 assertions)` |
| `bin/test-db mariadb --concurrency` | `PASS, Tests: 1 skipped, 26 passed (117 assertions)` |
| `bin/test-db mysql --concurrency` | `PASS, Tests: 1 skipped, 26 passed (117 assertions)` |
| `bin/test-db sqlite-file --concurrency` | `PASS, Tests: 1 skipped, 26 passed (118 assertions)` |
| `bin/check-pg-upgrade` (databases `testing_l30_upgrade_old` and `_fresh`) | `PASS, every row is there, and the schemas are equal apart from the five legacy check constraints` |
| `composer types:check` (PHPStan level 7) | `passed`, 0 errors |
| `vendor/bin/pint --format agent` | `passed` |
| `composer rector:check` | fails on 198 files, of which plan 19 created 16; see §1.1 |
| `npx vitest run` (`npm run test`) | `373 files, 4013 tests passed` |
| `npm run types:check`, `npm run check` | no error; 1065 files formatted, no lint warning |
| `vp build`, then `wayfinder:generate --with-form` | built; nothing to commit afterwards |

The whole suites hold Unit, Feature, Upgrade and Arch (`phpunit.xml`); `tests/Arch/DatabasePortabilityTest.php`,
`TranslationKeysTest` and `InformalRegisterTest` passed inside each. The skips are the engine skips of the
portability work, unchanged by this plan (6 164 tests on every engine, the same split as in its report).
Browser walkthroughs and smoke tests were not run (owner's rule).

### 1.1 Rector

`composer rector:check` is not clean on this branch, nor on its base: 198 files, mostly
`NewMethodCallWithoutParenthesesRector` (132) over code older than this plan. In the pattern of plan 18e
(`refactor: rector suggestions on the code and feature tests of plan 18e`), Task 33 applied rector to the files
plan 19 created (commit `d1d6302b`): the two commands take `#[Signature]` and `#[Description]` like the other
commands, `latest()`/`oldest()` for an explicit date sort (the tie-breaker on `id` stays), `doesntContain`,
`to_route`, a typed constant, `toBeEmpty()`, typed closure parameters. Left as they were, and put to the owner:
`NewMethodCallWithoutParenthesesRector` on four new controllers (no file of `app/` uses that form yet), the three
visual test files, `tests/Concurrency/Support/Race.php` (its `usleep` would become `Sleep::usleep`, which a fake
can stop), and every file older than this plan.

## 2. Acceptance criteria (spec §15)

Every PHP test named here ran in the four whole suites above (PostgreSQL, SQLite, MariaDB, MySQL), unless the row
says concurrency. Vitest files ran once (`npx vitest run`).

| # | Criterion | Proved by |
|---|---|---|
| 1 | Five types in order; Poll creates a draft and opens the builder; 403 | `session-type-picker.test.tsx` ("renders the five types in order by default", "names the survey type Poll"), `new-session-dialog.test.tsx`, `survey-session-fields.test.tsx`; `CreateTeamSurveyTest` ("creates a draft with its creator as facilitator and opens the builder", "refuses someone who cannot view the team") |
| 2 | Health check from the team's statements on 1 to 5, translated ends, locked questions; Team pulse; duplicate | `SurveyTemplateCatalogueTest`, `TeamSurveyBuilderTest` ("gives the questions of a health check the ends of the mockup…", "locks the questions of an open survey and of a health check…"), `CreateTeamSurveyTest` ("creates a health check with the team's statements"), `DuplicateTeamSurveyTest` |
| 3 | Builder: five kinds, edit, reorder, duplicate, delete, autosave; 2 to 10 options; 30 questions, also at once; 403 | `TeamSurveyBuilderTest`; concurrency `SurveyQuestionLimitTest`; `builder-question-list.test.tsx` (keyboard reorder), `survey-builder.test.tsx`, `builder-state.test.ts`, `builder-options-editor.test.tsx` |
| 4 | Publish needs a question; questions locked once open; back to draft until the first answer | `TeamSurveyStatusTest` |
| 5 | Member and guest answer; outsiders, guests without access or with an old link refused; one response per person, also at once; attached survey refused | `TeamSurveyAccessTest`, `TeamSurveyJoinTest`; concurrency `SurveyRespondentTest` |
| 6 | Values per kind; "Finish" names the missing required; refused on draft and closed; close race | `TeamSurveyAnswersTest`; concurrency `SurveyAnswersTest` (three cases) |
| 7 | Aggregates only to who may see them, in props, snapshot and events | `TeamSurveyResultsTest`, `TeamSurveyEventsTest`, `TeamSurveyModelTest` ("says who may see results", "hides results from a finished member when the setting is off") |
| 8 | Threshold 3; attached health check from the first answer once closed | `TeamSurveyResultsTest` ("withholds aggregates from everyone below the threshold…", "shows results from the first answer when the survey has no threshold"), `AttachedHealthCheckTest` |
| 9 | No link answer → respondent; text sorted; ids not time-ordered | `TeamSurveyModelTest` ("gives an answer a random id"), `SummarizeSurveyQuestionTest` ("sorts text answers by text…"), `TeamSurveyEventsTest`, `TeamSurveyExportTest` |
| 10 | Mean 3.8 and mode 4; NPS 2/3/4 and 22; "6 · 67%" | `SummarizeSurveyQuestionTest`; `question-adapter.test.ts`, `survey-question.test.tsx` |
| 11 | Live counter and cards; closing switches open pages | `TeamSurveyEventsTest`; `survey-reducer.test.ts`, `survey-room.test.tsx`, `survey-results.test.tsx` (mocked channel). No browser walkthrough (spec) |
| 12 | `presence-survey.{id}` refusals | `TeamSurveyBroadcastAuthorizationTest` |
| 13 | Compare by key, then kind and label; 10 against 5 on 5; refusals | `CompareSurveysTest`; `compare.test.ts`, `results-compare.test.tsx` |
| 14 | CSV: editor, closed, standalone; one row per respondent in content order; no name; formulas neutralised | `TeamSurveyExportTest` |
| 15 | Deleting removes everything and tells open pages | `TeamSurveyAccessTest` ("lets an editor delete the survey and tells the others"), `TeamSurveyModelTest` |
| 16 | Import: values and scales; summaries, trends, mood, recap ":score/5", MCP on the health scale; second run changes nothing | `ImportHealthChecksTest`, `HealthCheckParityTest`, `HealthCheckSummaryTest`, `HealthTrendTest`, `TeamMoodTrendTest`, `ResultsEmailTest`, `MailMockupTest`, `InsightsHealthRotiTest`; `HealthScaleTest` (unit) |
| 17 | Old tables untouched; verification passes and fails on an altered answer; Upgrade test on four engines | `ImportHealthChecksTest` ("leaves the old tables as they were", "verifies itself, and tells when a copied answer was altered"), `OldHealthTablesUnreadTest`, `tests/Upgrade/HealthChecksToTeamSurveysTest.php` |
| 18 | A retro in `health_check` moves to `icebreaker` or `writing`, health check open, answers on 10 | `HealthPhaseRemovalTest`, `tests/Upgrade/HealthPhaseMoveTest.php` |
| 19 | Phases without a health-check step; no payload names it | `HealthPhaseRemovalTest` ("has no health-check phase any more", "runs a retro through its phases without a health-check step"), `MessagesAndSummaryTest`; `phases.test.ts` |
| 20 | Attached health check: header dialog, "Submit answers", read-only after, second refused (also at once), locked/closed refusals, close/reopen, remove/hide, completed closes it, names nobody | `AttachedHealthCheckTest`, `HealthCheckTest`, `FacilitationTest`; concurrency `HealthCheckSubmissionTest` (two cases); `health-check-dialog.test.tsx`, `health-check-button.test.tsx`, `use-health-check-submission.test.tsx` |
| 21 | Statements edited → open unanswered health checks rebuilt on 5, no other | `AttachedHealthCheckTest` ("rebuilds the statements of unanswered, unclosed health checks…"), `HealthStatementFreezeTest` |
| 22 | Mood trend on the health scale, a survey adds a linked point; ROTI curve stays | `TeamMoodTrendTest`, `HealthCheckParityTest`, `TeamHealthCheckPageTest`; `team-health-check-page.test.tsx`, `mood-adapter.test.ts`, `team-roti-card.test.tsx` |
| 23 | `previousAverage` across kinds and scales, none for a guest; session end on 5 with "Details" 1→5 | `HealthCheckParityTest` ("gives a statement the average of the previous closed health check…", "withholds the previous averages from a guest"), `HealthCheckSummaryTest`; `session-end.test.tsx`, `health-check-compact.test.tsx`, `health-check-results.test.tsx` |
| 24 | The fourteen `retros.surveys.*` routes unchanged, R3-7 included | `tests/Feature/Retros/SurveysTest.php`, `SurveyDraftsTest.php` (one line each removed: the `HealthCheck` phase they listed) |
| 25 | Team page lists surveys, drafts to editors only; "Start a health check" | `TeamSurveysSectionTest`; `team-surveys-section.test.tsx`, `team-health-check-page.test.tsx` |
| 26 | Four languages, informal; captures in light, 1440, French, compared with the mockups | `TranslationKeysTest`, `InformalRegisterTest` (inside each whole suite); captures and comparison of Tasks 31–32 (commits `6a9425f0`, `81622890`, `7e464799`), not re-taken by this task |
| 27 | Whole suites on four engines, concurrency on four, portability arch test | §1 |

## 3. Differences that remain with the mockups

They are the rows P19-01 to P19-27 of the plan's **Pre-build deviations** table, unchanged by this task. P19-23 to
P19-27 were found when Task 32 compared the captures and were taken on the owner's behalf; they wait for the
owner's word. Plan 18e's deviation rows D-03 and D-102 are gone, D-09, D-22, D-23 and D-76 were reworded (Task 32).

## 4. Existing tests edited, and why

No test was deleted except `resources/js/components/retro/phase-health.test.tsx`, deleted with the component it
tested (Task 28, the phase is gone; listed by the plan).

**The health-check phase is gone (Task 27).** One line or a few each, removing `RetroPhase::HealthCheck` from a list
of phases or replacing it by `Actions`: `ActionsPhaseTest`, `ColumnsTest`, `GroupNamesTest`, `RetroGuardTest`,
`RetroModelTest`, `RotiTest`, `SurveyDraftsTest`, `SurveysTest`, `Mcp/MessagesAndSummaryTest`, part of
`BoardSnapshotTest`, `CreateRetroTest`, `FacilitationTest`. Vitest: `lib/retro/phases.test.ts`,
`facilitator-dock.test.tsx`, `board-topbar.test.tsx`, `board-settings.test.tsx`.

**The retro's health check is an attached team survey sent at once (Task 15).** Fixtures moved from
`HealthCheckAnswer::factory()` to the `answerHealthCheck()` helper of `tests/Pest.php`; per-score endpoints replaced
by the one submission: `HealthCheckTest`, `HealthStatementFreezeTest` (statements now follow the team while the
health check is open and unanswered), `RetroStartTest`, `CreateRetroTest`, `BoardSnapshotTest`, `FacilitationTest`.

**The old models are gone (Task 29).** `HealthStatementModelsTest` now proves only what remains (the team's
statements); the frozen-statement and answer model cases went with the models.

**Every number read on the health scale (Task 16).** The rule (spec §11.9, decision 12-A): an old score on ten is
read as `value × 5 ÷ 10`, the mean is taken on the health scale and rounded once to one decimal; the score is the
mean of the statement averages; consensus stays on the scale of the answers. Each literal that moved:

| Test | Before | After | Hand computation |
|---|---|---|---|
| `HealthCheckSummaryTest`, two statements | interaction 7.0, clarity 4.0, score 5.5 | 3.5, 2.0, 2.8 | 7 × ½ = 3.5; 4 × ½ = 2.0; (3.5 + 2.0) ÷ 2 = 2.75 → 2.8 |
| same, one statement | vision 3.0, score 3.0 | 1.5, 1.5 | 3 × ½ |
| same, bands | 8, 7.5, 6, 5.5, 4, 3.5 | 4.0, 3.8, 3.0, 2.8, 2.0, 1.8 | each halved, one rounding: 7.5 ÷ 2 = 3.75 → 3.8; 5.5 ÷ 2 = 2.75 → 2.8; 3.5 ÷ 2 = 1.75 → 1.8; the bands are read on five (excellent ≥ 4, good ≥ 3, needs attention ≥ 2) |
| same, custom statement | 9.0 | 4.5 | 9 × ½ |
| same, `previousAverage` | 6.5, 4.0, 9.0 | 3.3, 2.0, 4.5 | 6.5 ÷ 2 = 3.25 → 3.3; 4 ÷ 2; 9 ÷ 2 |
| same, new case on five | — | vision 4.0, distribution [0,0,1,1,1] | (4 + 5 + 3) ÷ 3 = 4.0; one answer each on 3, 4, 5 |
| `HealthTrendTest`, six retros | 3.5 … 8.5, deltas 1.0 | 1.8, 2.3, 2.8, 3.3, 3.8, 4.3, deltas 0.5 | each halved and rounded once (3.5 ÷ 2 = 1.75 → 1.8, 4.5 ÷ 2 = 2.25 → 2.3, …); the delta is the difference of the rounded points |
| same, `scoresOf` | 6.8, 10.0 | 3.4, 5.0 | 6.75 ÷ 2 = 3.375 → 3.4 (rounded once, from the unrounded mean); 10 ÷ 2 |
| same, last point | 5.0 | 2.5 | 5 ÷ 2 |
| `TeamMoodTrendTest` | mood 6.0, 7.5 | 3.0, 3.8 | 6 ÷ 2; 7.5 ÷ 2 = 3.75 → 3.8 |
| `ResultsTest` (board results) | interaction 7.0 (8 and 6), score 7.0; previousAverage 6.0; vision 8.0 | 3.5 with distribution [0,0,1,1,0], score 3.5; 3.0; 4.0 | the fixtures now answer on five: (4 + 3) ÷ 2 = 3.5; the previous health check 6 on ten read 3.0; 4 on five |
| `ResultsEmailTest` | "Health check: 7.0/10" | "4.0/5" | the fixture now answers 4 on five |
| `MailMockupTest` | 7.5/10 | 3.8/5 | the mockup's 7.5 halved, 3.75 → 3.8 |
| `SummaryInputTest` (AI summary input) | interaction 8.0 | 4.0, `scale` 5 | the fixture now answers 4 on five |
| `ReadPrivacyTest` (MCP `GetHealth`) | average 8, score 8 | 4, 4 | the fixture now answers 4 on five |
| `InsightsHealthRotiTest` (MCP) | averages on ten | on five | the fixtures moved to the new helpers; every number read on the health scale |

`TeamHealthCheckPageTest` and the Vitest files of the health components (`health-check-form`, `-results`,
`-compact`, `-summary`, `health-radar`, `mood-trend-chart`, `team-health-card`, `team-mood-card`, `trend-states`,
`adapters`, `board-reducer`, `session-end`) moved to the scale of five and to the new props (Tasks 16, 25, 26).
`TranslationKeysTest` gained one entry in its list of keys whose English value differs from the key
(`'Built-in survey' => 'Built-in'`). `tests/Pest.php` gained the
helpers of Step A and lane H; `tests/Concurrency/Support/Race.php` gained a way to hold a transaction open (Task 9:
the closing race holds the close instead of sleeping). Visual files (`RetroPagesVisualTest`,
`SessionCreateVisualTest`, `TeamPageVisualTest`) build their health fixtures on the new helpers (Task 31).

## 5. Translation keys added outside the tables of Task 30

177 keys added, 12 removed (the strings of the phase and of the 1-to-10 scale). These 57 added keys are not in
Task 30's tables; they came with the screens and the component catalogue, each in the four languages, informal:

- Component catalogue (`/dev/components`): "Health trend of the app today · score out of 5, links, no quartiles",
  "Answer view on the health scale, 1 to 5, each answer on its own, clear, live progress", "Answer view, 1 to 10
  scale of an imported health check, narrow container (20rem)", "Results as the server sends them: averages out of
  5, summary, no distribution", "Results with distribution, trend up, down and unchanged, one alert below 3",
  "NPS 0-10, with an optional comment", "Scale 1-5, bare control under a heading of the page", "Results, scale 1-5
  with mean, most frequent answer and a fall", "Results, NPS with segments and a rise", "Results, NPS with no
  change", "Sprint 41".
- Survey results and NPS: "Detractors · 0–6", "Passives · 7–8", "Promoters · 9–10", "1 answer", ":value
  percentage points", ":value, :trend", "Difference", "No answers to compare.", "The comparison could not be
  loaded.", "No option in common.", "Survey closed", "Answers appear here as people send them.", "Closed on :date".
- Participant page: "It can be answered once it is published.", "Question :index of :count", "See the results",
  "This survey is not open yet.", "to go on", "to score", "Guests answering this survey lose access.".
- Builder: "Built-in survey", "Delete this question?", "NPS 0 – 10", "Some changes are not saved yet.", "No question
  yet", "Option 1", "Option 2", "Question :number", "Survey settings", "“:label” leaves the survey.", "Add a first
  question with one of the five kinds below.", "1 question", ":count options".
- Creation: "Copy the questions of an earlier survey", "Its settings are copied from that survey.", "Survey :date",
  ":template :date", "You cannot create a survey in this team.".
- Retro health check: "Add to this retro", "Health check, :answered of :total answered, your answers not sent",
  "No answers.", "Remove the health check", "Any answers it holds are kept and come back if you add it again.",
  "Your answers could not be sent. Try again.", "Automatic vote limit, health check added".
- Health-check page: "The statements :team scores from 1 to 5 in every health check, and the mood they give.".

## 6. The import and the verification

The import runs inside the migration `2026_10_20_100100_copy_health_checks_to_team_surveys` and again with
`php artisan surveys:import-health-checks` (additive). Its behaviour on legacy rows is proved by
`tests/Upgrade/HealthChecksToTeamSurveysTest.php` and `ImportHealthChecksTest` on the four engines.

`surveys:verify-health-import` was **not** run on the development database `skrum`: the rules of this run allow no
database but `testing_l30…`, after an earlier agent wiped `skrum`. It was run on `testing_l30` (PostgreSQL, a fresh
schema with no legacy row):

```
Comparing old and copied health-check answers…
All ok: every retro has the same answers on both sides.
```

To do by the owner, right after the migrations on the development database and on any production copy:
`php artisan surveys:verify-health-import`.

## 7. Stale walkthrough files

Not read, not run, not fixed (owner's rule). These name the old health check or its phase and will fail until a
later plan rewrites them: `tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php`,
`Plan08bHealthCheckTest.php`, `Plan08dResultsTest.php`, `Plan18eTeamPageTest.php`. Others may break on the screens
this plan changed (session creation, team page, retro header) without naming the health check.

## 8. Decisions taken on the owner's behalf

Under the autonomy mandate of 2026-10-02 (`.superpowers/sdd/plan-19/progress.md`):

- Spec §17 items 9 to 12 on the recommended option: health-check answers are final once sent (9-A); an attached
  health check lives only in its retro (10-A); nobody is named while it is open, the MCP tool names senders on a
  non-anonymous retro (11-A); old scores are halved, Mood axis 0 to 5 (12-A).
- P19-16: the "Health check" header button, with no mockup, built from the sibling buttons of the session header.
- P19-23 to P19-27 (Task 32): the scale results as the SurveyQuestion component draws them, "Reopen" in the results
  topbar, the `SessionShell` chrome on the participant page, "Paramètres" kept as the settings title, the Compare
  tab's cards.
- Task 33: rector applied to the files plan 19 created only, without the `new … ->` form (§1.1).
- Task 33: the verification command run on the test database only (§6).

## 9. Left for the plan that drops the old tables

- Drop `health_check_answers`, `retro_health_statements` and `retros.health_check_enabled` (decision 7-A keeps them
  one release); then remove `ImportHealthChecks`, `VerifyHealthCheckImport`, their two commands, the copy step of
  the migration (or keep the migration a no-op), and `OldHealthTablesUnreadTest`; the import tests then live in
  `tests/Upgrade` only, on the schema before the drop (`docs/database.md` rule 8).
- `HealthScale::LegacyMax` and the halving stay as long as answers on ten exist in `team_survey_answers`; the scale
  of ten of an imported health check left open (P19-22) ends when it closes.
- Rewrite the walkthroughs of §7.
