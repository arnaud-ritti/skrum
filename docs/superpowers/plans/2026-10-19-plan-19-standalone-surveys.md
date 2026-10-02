# Standalone surveys, the Poll session type and the health check as a survey template (Plan 19) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to run this plan task by task (through the Workflow tool, as the project does). Steps use checkbox (`- [ ]`) syntax. Every agent reads **Owner decisions**, **Global Constraints**, **Pre-build deviations** and its own task before anything else. A screen task also follows the "Screen task procedure" of `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`.

**Status: draft.** Written on the recommended answer of each decision of the spec's §17. The owner has not answered them. The table **Owner decisions** says which tasks change with another answer; nothing is built before the answers.

**Goal:** A team creates a survey from the "New session" dialog (type Poll), builds it with scale, NPS, choice and text questions, shares it by link, watches the answers arrive, closes it, compares it with the previous one and exports it; the health check is one of its templates, the retro has no health-check phase any more, and every health score, trend and recap line shows the same numbers as before.

**Architecture:** A new aggregate, `TeamSurvey` (tables `team_surveys`, `team_survey_questions`, `team_survey_options`, `team_survey_respondents`, `team_survey_answers`, `team_survey_answer_options`), built end to end like the whiteboard: creation under the team, a page behind a respondent-resolving middleware, a JSON snapshot built per viewer, a presence channel, a guest join page. Results are withheld by the server per viewer; events carry counts only. The existing one-question surveys of a retro keep their own tables and code. Health data moves into the new tables through an additive, idempotent import; the health readers (`SummarizeHealthCheck`, `BuildHealthTrend`, `PresentHealthCheck`, `PresentHealthProgress`, `BuildTeamMoodTrend`) keep their signatures and output and are rewritten over the new tables, so that the board, the results, the recap e-mail, the AI summary and the MCP tool do not change. A retro attaches a health-check survey instead of running a phase.

**Tech Stack:** Laravel 13, PHP 8.4, Pest 5 (feature, arch, browser), Inertia 3, React 19, Tailwind 4, vite-plus (Vitest), Wayfinder, Reverb, dnd-kit. Run `composer show --direct` and read `package.json` before Task 1 and stop if a major differs.

**Spec:** `.superpowers/sdd/plan-19/2026-10-19-standalone-surveys-design.md` (moves to `docs/superpowers/specs/` when approved). Parent: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` §5. Mockups: `docs/design-system/components/ScreenSurvey`, `SurveyQuestion`, `MobileRituals`, `ScreenSessionCreate`, `SessionTypePicker`, `SessionSettingsPopover`, `HealthCheck`, `GuestJoin`, `ShareDialog`, `EmptyState` — for each, the `README.md` and the `preview.html`.

**Not in this plan:** the backlog of spec §13; dropping `retro_health_statements`, `health_check_answers` and `retros.health_check_enabled` (a later plan, after `surveys:verify-health-import` has passed on production data); moving the retro surveys onto the new tables.

**Tasks:** 33. Step A, back end, single writer: 1 to 13. Step B, health data, lane H: 14 to 16. Step C, screens: 17 (single writer), then lanes Create (18, 19), Build (20), Answer (21, 22), Results (23, 24), Health (25, 26). Step D, removal of the phase: 27 to 29. Final: 30 to 33.

## Branch and run

- Precondition: plans 18e, 18f and 18g are merged into `main`. Check before Task 1, and stop if one fails: `app/Enums/RetroPhase.php` has the cases `Actions` and `Roti`; `routes/web.php` has `teams.healthCheck.show`; `resources/js/pages/teams/health-check.tsx` exists; `resources/js/lib/page-layouts.ts` is gone or empty (18g).
- Branch `plan-19-standalone-surveys` from `main`. No merge into `main`, no push.
- Step A runs on that branch with one writer. Lanes run in git worktrees on branches `lane/19-<name>`, cut from the head named in **Lanes**; the controller merges one lane at a time and runs the gates (`npm run types:check`, `npm run check`, `npm run build:front`, `vendor/bin/pint --dirty --format agent`) after each merge.
- This plan was written from the branch `plan-18e-screens` at `4568a764` and from the worktrees `laneBackA` and `laneTeam`. **Every task re-reads the files it touches**; a line number or a method body quoted here that no longer matches is followed in spirit and reported.

## Owner decisions

The eight questions of spec §17. "Plan written on" is the recommended option. The last column names what changes with another answer.

| # | Question | Plan written on | If the owner answers otherwise |
|---|---|---|---|
| 1 | Health check inside a retro | **B**: attached to the retro, no phase, answered from a header button | **A**: drop Tasks 15 (the attach, answer and closure parts), 25, and the health-check part of 31; Task 27 also removes the creation row and `retros.health-check.*`; `PresentHealthCheck` reads migrated data only. **C**: Task 27 keeps a `HealthCheck` step and moves it between `Actions` and `Roti`; Task 25 builds a phase panel instead of the header button; Task 28 edits the stepper instead of removing a step |
| 2 | Surveys inside a retro | **A**: unchanged | **B**: a new step between A and C (about ten tasks: import of `surveys` into the team-survey tables, the six retro survey controllers and `PresentSurvey` over them, the 18e front adapter, `Plan08c` to `Plan08e`); Task 1 adds reactions and comments tables. **C**: the same, minus reactions and comments, plus the removal of those features |
| 3 | Health-check scale | **A**: 1 to 10 | **B**: Task 2 sets `scale_max` 5; Task 14 keeps old data at 10; Tasks 16 and 26 halve old scores in the trend. **C**: Task 2 takes the maximum from the creation form (Task 18) |
| 4 | Minimum of answers | **B**: 3 on a survey created from the dialog, 0 on an attached or migrated health check | **A**: `TeamSurvey::StandaloneThreshold` becomes 0 and the threshold states of Tasks 21 and 23 are dropped. **C**: Tasks 14 and 15 write 3; Task 16 hides summaries below it; `HealthCheckSummaryTest` fixtures need three respondents |
| 5 | Anonymity | **A**: always anonymous | **B**: Task 1 adds `is_anonymous`; Tasks 10, 12, 20, 23 gain a named variant. **C**: the same plus a per-respondent choice in Tasks 9 and 21 |
| 6 | Templates | **A**: Blank, Health check, Team pulse, and "a previous survey" | **B**: a new table and manager (about six tasks), the "From a template…" entry in Task 25. **C**: Task 2 drops Team pulse |
| 7 | Old health tables | **A**: kept one release | **B**: Task 29 adds the drop migration and `ImportHealthChecksTest` creates its old tables itself |
| 8 | CSV content | **A**: one row per respondent, shuffled, closed only | **B**: Task 12 writes one row per question and option. **C**: Task 12 drops the closed-only guard |

## File structure

Back end, created:

| File | Responsibility |
|---|---|
| `app/Enums/TeamSurveyStatus.php`, `TeamSurveyQuestionKind.php`, `TeamSurveyTemplate.php` | the three enums |
| `database/migrations/2026_10_19_100000_create_team_survey_tables.php` | the six tables |
| `app/Models/TeamSurvey.php`, `TeamSurveyQuestion.php`, `TeamSurveyOption.php`, `TeamSurveyRespondent.php`, `TeamSurveyAnswer.php` and their factories | the aggregate |
| `app/Support/Surveys/QuestionDefinition.php`, `SurveyTemplateCatalogue.php` | built-in templates |
| `app/Actions/HealthCheck/HealthCheckQuestions.php` | the team's statements as question definitions |
| `app/Actions/TeamSurveys/ResolveRespondent.php`, `RespondentForParticipant.php`, `TeamSurveyGuard.php` | who is in, who may do what |
| `app/Http/Middleware/ResolveSurveyRespondent.php` | puts the respondent on the request |
| `app/Actions/TeamSurveys/NewTeamSurvey.php`, `CreateTeamSurvey.php`, `WriteSurveyQuestions.php`, `DuplicateTeamSurvey.php` | creation |
| `app/Actions/TeamSurveys/SaveSurveyAnswer.php`, `AnnounceSurveyResponses.php` | answers |
| `app/Actions/TeamSurveys/SummarizeSurveyQuestion.php`, `BuildSurveyResults.php`, `BuildTeamSurveySnapshot.php`, `PresentTeamSurveySummary.php`, `CompareSurveys.php`, `ExportSurveyCsv.php`, `ChangeTeamSurveyStatus.php` | reading |
| `app/Events/TeamSurveys/TeamSurveyBroadcastEvent.php`, `TeamSurveyChanged.php`, `TeamSurveyResponsesChanged.php`, `TeamSurveyDeleted.php` | the channel |
| `app/Http/Requests/TeamSurveys/TeamSurveyStoreRequest.php`, `TeamSurveyUpdateRequest.php`, `TeamSurveyQuestionRequest.php`, `TeamSurveyQuestionOrderRequest.php`, `TeamSurveyStatusRequest.php` | validation |
| `app/Http/Controllers/TeamSurveys/*Controller.php` (thirteen, spec §12), `app/Http/Controllers/TeamSurveyJoinsController.php` | HTTP |
| `app/Support/Surveys/ImportHealthChecks.php`, `database/migrations/2026_10_19_100100_copy_health_checks_to_team_surveys.php`, `app/Console/Commands/ImportHealthChecksCommand.php`, `VerifyHealthCheckImportCommand.php` | the health data migration |
| `app/Actions/HealthCheck/HealthCheckSurvey.php`, `AttachHealthCheck.php` | the retro's health check as a team survey |
| `app/Http/Controllers/Retros/RetroHealthChecksController.php`, `RetroHealthCheckClosuresController.php` | attach, remove, close, reopen |
| `database/migrations/2026_10_19_100200_move_retros_out_of_the_health_check_phase.php` | the phase move |

Back end, rewritten in place: `app/Actions/HealthCheck/SummarizeHealthCheck.php`, `BuildHealthTrend.php`, `PresentHealthCheck.php`, `PresentHealthProgress.php`, `ManageTeamHealthStatements.php`; `app/Actions/Teams/BuildTeamMoodTrend.php`; `app/Http/Controllers/Retros/HealthCheckAnswersController.php`; `app/Mcp/Tools/Retro/GetHealth.php`. Modified: `app/Models/Team.php`, `Retro.php`, `app/Policies/TeamPolicy.php`, `app/Actions/Retros/GuestCookie.php`, `CreateRetro.php`, `ChangeRetroPhase.php`, `BuildBoardSnapshot.php`, `app/Actions/Sessions/PresentJoinSession.php`, `app/Http/Controllers/BroadcastAuthorizationsController.php`, `TeamsController.php`, `TeamHealthChecksController.php`, `Retros/RetroSettingsController.php`, `Retros/ColumnsController.php`, `Retros/ColumnOrdersController.php`, `app/Enums/RetroPhase.php`, `app/Mcp/Servers/SkrumServer.php`, `app/Mcp/Prompts/TeamHealth.php`, `AnalyzeRetro.php`, `routes/web.php`, `tests/Pest.php`. Deleted in Task 29: `app/Models/HealthCheckAnswer.php`, `RetroHealthStatement.php`, their factories, `app/Actions/HealthCheck/FreezeHealthStatements.php`.

Front end, created: `resources/js/lib/surveys/{types,api,survey-reducer,question-adapter,builder-state,compare}.ts`; `resources/js/hooks/{use-survey-channel,use-team-survey}.ts`; `resources/js/pages/surveys/{show,edit,results,join}.tsx`; `resources/js/components/surveys/*` (containers of the four pages); `resources/js/components/teams/team-surveys-section.tsx`, `session-create/survey-session-fields.tsx`; `resources/js/components/retro/health-check-button.tsx`, `health-check-dialog.tsx`; each with its `.test.ts(x)`. `components/surveys/` is a new domain folder under `components/`, in the pattern of spec §6.1 of the parent; it is not a new base folder.

## Global Constraints

- **Mockup first** (parent spec §5 rule 13). A screen follows its mockup: layout, placement, labels, states. A difference is fixed, or is a row of **Pre-build deviations**, and a row is put to the owner before its screen is built. Each screen task ends with its captures beside the mockup's `preview.html`, in light and dark, at 1440 and 390.
- **Front rules** of the parent spec §5 on every front file: tokens only, rem, Tailwind scale (no arbitrary size), no overflow from 20rem to 60rem, visible focus, contrast, motion with `prefers-reduced-motion`, lucide icons, the literal call shape `t('…')`, presentational `skrum/` components (no network, no Echo, no router). Containers live in `resources/js/components/<domain>/`.
- **Portable database code** (`docs/superpowers/research/database-portability-audit.md` §9), verbatim: no `ilike`, `::` cast, `filter (where …)`, `nulls first/last`, `date_trunc`, `interval`, `distinct on`, `returning`, `on conflict`, regex operator, `||`, or boolean literal in SQL; no `insertOrIgnore`, `whereJsonContains`, `whereJsonLength`; no new `whereRaw`, `selectRaw`, `orderByRaw`, `havingRaw`, `groupByRaw`, `DB::raw`, `DB::statement`, `DB::select` — plain `count(*)`, `sum(col)`, `max(col)` with `groupBy` through the builder's own methods are the only aggregates, and their result is cast in PHP; no `DB::getDriverName()`; migrations use the schema builder only, no database default on a JSON column, no expression or partial index, no raw constraint; a transaction locks the aggregate root first; sorting has an explicit tie-breaker and lists shown to people are sorted in PHP; tests never assert SQL text.
- **No new dependency**, PHP or JS, without the owner's approval. The builder reorders with `@dnd-kit/*`, already installed.
- **Four languages.** Every new `__('…')` and `t('…')` key is added to `lang/en.json`, `fr.json`, `es.json`, `de.json` in the commit that introduces it (`tests/Feature/TranslationKeysTest.php`). The table of Task 30 holds the French, Spanish and German of every key this plan names; in `en.json` the value is the key.
- **The browser suite is a contract.** `data-test`, `data-realtime`, `data-presence-id`, element ids and English accessible names are kept. A browser test changes only when this plan lists it. `Plan08cSurveysTest` and `Plan08eLlmTest` change in one way only: after `click('Add survey')`, a `click('Quick poll')` (the mockup's menu, Task 25). The survey part of `Plan08dResultsTest` is not edited.
- **No test is deleted** without the owner's approval. The health tests are rewritten on the new fixtures; each change is listed in its task.
- Primary and foreign keys are UUIDs (`tests/Feature/UuidPrimaryKeysTest.php`). Migrations have `up` only. Create files with `vendor/bin/sail artisan make:… --no-interaction`.
- Controllers: plural name, CRUD method names only (`tests/Arch/ArchTest.php`). Route names camelCase, URLs kebab-case, tuple notation. Form Requests with array rules.
- Arch facts that shape this plan: models do not use `App\Actions`, `App\Http` or `App\Mcp`; actions do not use `App\Http`; `App\Support`, jobs and events do not use `App\Http` or `App\Mcp`; enums use nothing of the application; no class is `final`; commands carry the `Command` suffix.
- PHP style: early returns, no `else`, happy path last, typed everything, PascalCase constants, constructor promotion, no comment that restates code, `vendor/bin/pint --dirty --format agent` before each commit.
- Octane is installed: no static or per-request singleton state in new classes.
- Tests: `vendor/bin/sail artisan test --compact <file>` for one file; never `--tia`. Front: `npm run test`, `npm run types:check`, `npm run check`, `npm run build:front` (build and `wayfinder:generate --with-form`) after every task that adds a route used by the front. The owner's working rule of 2026-10-02 ("no test runs during the work, one full run at the end of each phase") is assumed lifted for this plan; if the controller says it still holds, the "Run" steps are skipped **except in Tasks 14, 15, 16 and 27**, whose purpose is to prove that no health data is lost.
- One commit per task, in the repository's style (`feat(surveys): …`, `feat(health): …`, `test: …`). A change to a shared `skrum/` component is its own commit inside the task.

## Pre-build deviations

Put to the owner before the screen is built (owner's rule of the fifth round). Reasons as in plan 18e: **F** false or unsafe, **A** accessibility, **N** no such data or concept, **S** this spec, **O** an owner's answer.

| # | Screen | Mockup element | Built | Reason |
|---|---|---|---|---|
| P19-01 | Builder | anonymity radio group (three modes) | not rendered; a line "Answers are anonymous" in its place | N: spec §3; roadmap backlog |
| P19-02 | Builder | "Close" date and "or as soon as 11/11 members have answered" | not rendered, place left | N: roadmap backlog |
| P19-03 | Builder | "Display threshold" select | not rendered, place left | N: roadmap backlog |
| P19-04 | Builder | alert "a result is shown from 3 answers, and free answers are shuffled" | shown with the survey's real threshold; without the first half when the threshold is 0 | F otherwise |
| P19-05 | Builder | "5 questions · about 2 minutes · sent at the end of the retro of 2 October" | "n questions" | N: no duration estimate, no sending |
| P19-06 | Builder | "5 options · « Other » enabled", "280 characters max" | "n options"; "500 characters max" | N ("Other"); F (the limit is 500) |
| P19-07 | Participant | "~ 1 min left" | not rendered | N |
| P19-08 | Participant, phone | the category line above the question | not rendered | N: a question has no category |
| P19-09 | Results | keywords | not rendered | N: no text analysis |
| P19-10 | Results | "Send to whiteboard" | not rendered, place left | N: roadmap backlog |
| P19-11 | Results | "Share with the team" | "Share", opening the Share dialog of the survey | F: the team already sees the results; the dialog is what sharing means on every session type |
| P19-12 | Results | tab "Compare with sprint 41" | tab "Compare", naming the survey compared with inside it | N: no sprint entity |
| P19-13 | "New session" dialog | no Poll variant drawn | Name, "Start from" tiles, the guest switch (spec §9.1) | designed from the retro and whiteboard variants |
| P19-14 | "New session" dialog | "Poll" (SessionTypePicker, ScreenSessionCreate) against "New survey" (ScreenTeam) | "Poll" on the tile, "Survey" everywhere else | the mockups as drawn; the component of plan 18c says "Survey" on the tile and changes |
| P19-15 | Retro | SessionSettingsPopover: "Add survey" menu with "Health check", "Quick poll", "From a template…", note "Shown after Actions, before ROTI" | the first two entries; no note | N (templates: backlog); O (third round: no dedicated phase) |
| P19-16 | Retro | no place drawn for a health check without a phase | a "Health check" button with "n/m" in the session header, opening a dialog (a drawer on a phone) with `HealthCheckForm` or `HealthCheckResults` | spec §9.8, decision 1 |
| P19-17 | Retro, health check | `HealthCheck/README.md`: scale 1 to 5, results hidden under 3 respondents | scale 1 to 10, no minimum | O (D-76: real values); spec decisions 3 and 4 |
| P19-18 | Team page | ScreenTeam: a "New survey" creation tile | none: one "New session" trigger | O: 1-D2 (D-09 stays for the tiles) |

## Review Focus

The five inputs the spec implies and that are most likely to bite, each pinned by a test in the task that owns the code.

1. **A cell of the CSV that starts with `=`, `+`, `-` or `@`** (a text answer "=HYPERLINK(…)"): a spreadsheet must show it as text. Test in Task 12.
2. **Two requests saving the same answer at once** (a double click, two tabs): one answer row, no unique-constraint error on screen. Test in Task 9.
3. **A respondent who should not see results reads them anyway** through the snapshot, the page props or an event after someone else answered. Tests in Tasks 5 and 10 walk every viewer, status and event payload.
4. **An import run twice, or after new answers were written to the old tables**: no duplicate survey, question, respondent or answer, and the new answers arrive. Tests in Task 14.
5. **A retro that sits in the `health_check` phase when the release is deployed**: it must open, in another phase, with its answers. Test in Task 27.

## Lanes

| Lane | Tasks | Cut from | Shares with other lanes |
|---|---|---|---|
| main | 1 to 13, 17, 27 to 33 | — | — |
| H (health data) | 14, 15, 16 | head of Task 10 (needs the models, the catalogue, answers and results) | `tests/Pest.php`, `routes/web.php`, `app/Models/Retro.php`, the four `lang/*.json` |
| Create | 18, 19 | head of Task 17 | `resources/js/components/skrum/session-type-picker.tsx` (label only), `components/teams/team-page.tsx`, `lang/*.json` |
| Build | 20 | head of Task 17 | `lang/*.json` |
| Answer | 21, 22 | head of Task 17 | `resources/js/components/skrum/survey-question.tsx` (Task 17 makes the shared changes; a lane that needs another stops and asks), `guest-join.tsx`, `lang/*.json` |
| Results | 23, 24 | head of Task 17 | `survey-question.tsx` (same rule), `lang/*.json` |
| Health | 25, 26 | head of Task 17 **and** lane H merged | the retro container and header of plan 18e, `components/teams/team-health-check-page.tsx`, `lang/*.json` |

Lane H can run while Tasks 11 to 13 finish on main. The five screen lanes run in parallel. `lang/*.json` conflicts are resolved by the controller at each merge (keys are appended in alphabetical blocks per lane: `Survey…` keys in lane order). `tests/Pest.php`: Task 1 adds every helper of Step A; lane H adds its own in one block at the end of the file.

---

## Step A — back end of the team survey (single writer)

### Task 1: Tables, enums, models, factories, test helpers

**Files:**
- Create: `app/Enums/TeamSurveyStatus.php`, `app/Enums/TeamSurveyQuestionKind.php`, `app/Enums/TeamSurveyTemplate.php`
- Create: `database/migrations/2026_10_19_100000_create_team_survey_tables.php`
- Create: `app/Models/TeamSurvey.php`, `TeamSurveyQuestion.php`, `TeamSurveyOption.php`, `TeamSurveyRespondent.php`, `TeamSurveyAnswer.php`
- Create: `database/factories/TeamSurveyFactory.php`, `TeamSurveyQuestionFactory.php`, `TeamSurveyOptionFactory.php`, `TeamSurveyRespondentFactory.php`, `TeamSurveyAnswerFactory.php`
- Modify: `app/Models/Team.php` (relation `teamSurveys`), `app/Models/Retro.php` (relation `teamSurveys`), `app/Actions/Retros/GuestCookie.php` (constant `SurveyScope`), `tests/Pest.php` (helpers)
- Test: `tests/Feature/TeamSurveys/TeamSurveyModelTest.php`

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
    $builtin = surveyQuestion($survey, TeamSurveyQuestionKind::Scale, ['builtin' => HealthStatement::Vision, 'label' => 'stored text', 'scale_max' => 10]);
    $custom = surveyQuestion($survey, TeamSurveyQuestionKind::Scale, ['label' => 'We ship without fear', 'short_label' => 'Shipping', 'scale_max' => 10]);

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
```

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

`database/migrations/2026_10_19_100000_create_team_survey_tables.php`:

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

    public function audienceCount(): int
    {
        if ($this->retro !== null) {
            return $this->retro->participants()->count();
        }

        return $this->team->members()->count();
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

    public const BuilderScaleMax = 5;

    public const HealthScaleMax = 10;

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

- [ ] **Step 8: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/TeamSurveyModelTest.php tests/Feature/UuidPrimaryKeysTest.php tests/Arch`
Expected: PASS.

- [ ] **Step 9: Translations and commit**

Add `Draft`, `Open` to the four language files if they are missing (table of Task 30; `Closed` exists).

```bash
vendor/bin/pint --dirty --format agent
git add app/Enums app/Models database tests/Pest.php tests/Feature/TeamSurveys lang app/Actions/Retros/GuestCookie.php
git commit -m "feat(surveys): team survey tables, models and factories"
```

### Task 2: Built-in templates

**Files:**
- Create: `app/Support/Surveys/QuestionDefinition.php`, `app/Support/Surveys/SurveyTemplateCatalogue.php`, `app/Actions/HealthCheck/HealthCheckQuestions.php`, `app/Actions/TeamSurveys/WriteSurveyQuestions.php`
- Test: `tests/Feature/TeamSurveys/SurveyTemplateCatalogueTest.php`

**Interfaces:**
- Consumes: `App\Actions\HealthCheck\TeamHealthStatements::active(Team): Collection<int, TeamHealthStatement>`, `TeamHealthStatement::key(): string`; the models of Task 1.
- Produces: `QuestionDefinition` (public promoted properties `kind`, `label`, `shortLabel`, `description`, `builtin`, `matchKey`, `isRequired`, `allowsComment`, `scaleMax`, `scaleMinLabel`, `scaleMaxLabel`, `options`); `SurveyTemplateCatalogue::questions(?TeamSurveyTemplate $template, Team $team): array<int, QuestionDefinition>`; `SurveyTemplateCatalogue::options(Team $team): array<int, array{key: ?string, name: string, description: string, questionCount: int}>`; `HealthCheckQuestions::handle(Team $team): array<int, QuestionDefinition>`; `WriteSurveyQuestions::handle(TeamSurvey $survey, array $definitions): void` (replaces every question of the survey).

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

it('turns the six built-in statements into scale questions from 1 to 10', function () {
    $questions = resolve(SurveyTemplateCatalogue::class)->questions(TeamSurveyTemplate::HealthCheck, Team::factory()->create());

    expect($questions)->toHaveCount(6)
        ->and($questions[0]->kind)->toBe(TeamSurveyQuestionKind::Scale)
        ->and($questions[0]->scaleMax)->toBe(10)
        ->and($questions[0]->builtin)->toBe(HealthStatement::Interaction)
        ->and($questions[0]->matchKey)->toBe('interaction')
        ->and($questions[0]->isRequired)->toBeFalse()
        ->and($questions[0]->allowsComment)->toBeFalse();
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
use App\Models\TeamSurveyQuestion;
use App\Support\Surveys\QuestionDefinition;

class HealthCheckQuestions
{
    public function __construct(private TeamHealthStatements $teamHealthStatements) {}

    /**
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
                scaleMax: TeamSurveyQuestion::HealthScaleMax,
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
                'description' => __('The team\'s statements, scored 1 to 10.'),
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

- [ ] **Step 4: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/SurveyTemplateCatalogueTest.php tests/Arch`
Expected: PASS.

- [ ] **Step 5: Translations and commit**

Add the keys of this task to the four language files (table of Task 30, block "Templates").

```bash
vendor/bin/pint --dirty --format agent
git add app/Support/Surveys app/Actions tests/Feature/TeamSurveys lang
git commit -m "feat(surveys): built-in templates, with the health check fed by the team's statements"
```

### Task 3: Who is in — respondent resolution, middleware, guard, the survey page and its deletion

**Files:**
- Create: `app/Actions/TeamSurveys/ResolveRespondent.php`, `RespondentForParticipant.php`, `TeamSurveyGuard.php`, `BuildTeamSurveySnapshot.php`
- Create: `app/Http/Middleware/ResolveSurveyRespondent.php`
- Create: `app/Events/TeamSurveys/TeamSurveyBroadcastEvent.php`, `TeamSurveyDeleted.php`
- Create: `app/Http/Controllers/TeamSurveys/TeamSurveysController.php` (`show`, `edit`, `destroy`), `TeamSurveySnapshotsController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/TeamSurveys/TeamSurveyAccessTest.php`

**Interfaces:**
- Consumes: Task 1; `App\Actions\Retros\ResolveParticipant::handle(Request, Retro): ?Participant`; `GuestCookie::parse`, `GuestCookie::name`.
- Produces: `ResolveRespondent::handle(Request $request, TeamSurvey $survey): ?TeamSurveyRespondent`; `RespondentForParticipant::handle(TeamSurvey $survey, Participant $participant): TeamSurveyRespondent`; `TeamSurveyGuard::editor(TeamSurvey, TeamSurveyRespondent): void`, `::notGuest(TeamSurveyRespondent): void`, `::viewable(TeamSurvey, TeamSurveyRespondent): void`, `::structureEditable(TeamSurvey): void`, `::open(TeamSurvey): void`; request attribute `surveyRespondent`; `BuildTeamSurveySnapshot::handle(TeamSurvey $survey, TeamSurveyRespondent $viewer): array` with the keys `survey`, `me`, `links`, `serverTime` (Task 9 adds `questions` and `progress`, Task 10 adds `results`, Task 11 adds `comparable`); routes `surveys.show`, `surveys.edit`, `surveys.destroy`, `surveys.snapshot.show`; event `TeamSurveyDeleted` (`survey.deleted`) on `PresenceChannel("survey.{id}")`.

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

it('lets a guest of the retro into the survey attached to it, without joining again', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $survey = TeamSurvey::factory()->attachedTo($retro)->open()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->getJson(route('surveys.snapshot.show', $survey))
        ->assertOk()
        ->assertJsonPath('me.isGuest', true);

    $respondent = $survey->respondents()->where('participant_id', $guest->id)->sole();

    expect($respondent->guest_name)->toBe($guest->guest_name)
        ->and($survey->respondents()->count())->toBe(1);
});

it('does not let a guest of another retro in', function () {
    $survey = TeamSurvey::factory()->attachedTo(Retro::factory()->withGuestAccess()->create())->open()->create();
    $stranger = Participant::factory()->guest()->create(['retro_id' => Retro::factory()->withGuestAccess()->create()->id]);

    $this->withCookies(retroGuestCookie($stranger))->withCredentials()
        ->getJson(route('surveys.snapshot.show', $survey))
        ->assertUnauthorized();
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

- [ ] **Step 2: Run it and see it fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/TeamSurveyAccessTest.php`
Expected: FAIL, `Route [surveys.show] not defined`.

- [ ] **Step 3: Resolution and guard**

`app/Actions/TeamSurveys/RespondentForParticipant.php`:

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

`app/Actions/TeamSurveys/ResolveRespondent.php`:

```php
<?php

namespace App\Actions\TeamSurveys;

use App\Actions\Retros\GuestCookie;
use App\Actions\Retros\ResolveParticipant;
use App\Enums\TeamSurveyStatus;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\Request;

class ResolveRespondent
{
    public function __construct(
        private ResolveParticipant $resolveParticipant,
        private RespondentForParticipant $respondentForParticipant,
    ) {}

    public function handle(Request $request, TeamSurvey $survey): ?TeamSurveyRespondent
    {
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

        return $this->guest($request, $survey) ?? $this->retroParticipant($request, $survey);
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

    /**
     * Reached only by someone who cannot view the team, so the retro
     * resolver can only answer with a guest of that retro.
     */
    private function retroParticipant(Request $request, TeamSurvey $survey): ?TeamSurveyRespondent
    {
        if ($survey->retro === null) {
            return null;
        }

        $participant = $this->resolveParticipant->handle($request, $survey->retro);

        if ($participant === null) {
            return null;
        }

        return $this->respondentForParticipant->handle($survey, $participant);
    }
}
```

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

- [ ] **Step 5: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/TeamSurveyAccessTest.php tests/Arch`
Expected: PASS.

- [ ] **Step 6: Translations and commit**

Keys of this task: block "Guards" of Task 30.

```bash
vendor/bin/pint --dirty --format agent
git add app routes tests/Feature/TeamSurveys lang
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
        ->and($survey->questions()->first()->scale_max)->toBe(10);
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

- [ ] **Step 4: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/CreateTeamSurveyTest.php tests/Arch`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
vendor/bin/pint --dirty --format agent
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

it('signs for a guest of the survey and for a guest of the retro it is attached to', function () {
    $standalone = TeamSurvey::factory()->open()->withGuestAccess()->create();
    $guest = surveyGuest($standalone);

    $this->withCookies(surveyGuestCookie($guest))->withCredentials()
        ->postJson(route('broadcasting.auth'), surveyChannelRequest($standalone))
        ->assertOk();

    $retro = Retro::factory()->withGuestAccess()->create();
    $attached = TeamSurvey::factory()->attachedTo($retro)->open()->create();
    $retroGuest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($retroGuest))->withCredentials()
        ->postJson(route('broadcasting.auth'), surveyChannelRequest($attached))
        ->assertOk();
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

- [ ] **Step 5: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/TeamSurveyBroadcastAuthorizationTest.php tests/Feature/TeamSurveys/TeamSurveyEventsTest.php tests/Feature/Whiteboards/WhiteboardBroadcastAuthorizationTest.php`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app tests/Feature/TeamSurveys
git commit -m "feat(surveys): presence channel of a survey and its two count-only events"
```

### Task 6: Guest join and the guest link

**Files:**
- Modify: `app/Http/Controllers/TeamSurveyJoinsController.php` (bodies), `app/Actions/Sessions/PresentJoinSession.php` (`survey`), `routes/web.php`
- Create: `app/Http/Controllers/TeamSurveys/TeamSurveyGuestTokensController.php`
- Test: `tests/Feature/TeamSurveys/TeamSurveyJoinTest.php`

**Interfaces:**
- Consumes: `ResolveRespondent::handle`, `TeamSurveyGuard::editor`, `TeamSurveyChanged::for`, `GuestCookie::make`.
- Produces: `PresentJoinSession::survey(TeamSurvey $survey): array{title: string, facilitatorName: ?string, participantsCount: int, isLive: bool}`; routes `surveys.join.show`, `surveys.join.store`, `surveys.guestToken.store`; page `surveys/join` with the props `isInvalid`, `guestToken`, `surveyTitle`, `session`, `suggestedName`.

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
            ->where('session.isLive', true));
});

it('answers 404 with the invalid state for an unknown token, a survey without guest access and a draft', function (Closure $token) {
    $this->get(route('surveys.join.show', $token()))
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page->component('surveys/join')->where('isInvalid', true)->missing('session'));
})->with([
    'unknown' => [fn () => str_repeat('x', 40)],
    'guest access off' => [fn () => TeamSurvey::factory()->open()->create()->guest_token],
    'draft' => [fn () => TeamSurvey::factory()->withGuestAccess()->create()->guest_token],
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
            'suggestedName' => $request->user()?->name,
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

- [ ] **Step 4: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/TeamSurveyJoinTest.php tests/Feature/Sessions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app routes tests/Feature/TeamSurveys
git commit -m "feat(surveys): guests join a survey by link, and an editor can replace the link"
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
        $question->loadMissing('options');

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
            'scaleLabels' => $question->kind === TeamSurveyQuestionKind::Scale
                ? [$question->scale_min_label, $question->scale_max_label]
                : null,
            'isBuiltin' => $question->builtin !== null,
            'options' => $question->options->map(fn (TeamSurveyOption $option): array => [
                'id' => $option->id,
                'label' => $option->label,
            ])->values()->all(),
            'myAnswer' => $this->answer($myAnswer),
        ];
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

- [ ] **Step 5: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/TeamSurveyBuilderTest.php tests/Arch`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app routes tests/Feature/TeamSurveys lang
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
    [$facilitator] = surveyFacilitator($survey);

    putStatus($survey, 'open', $facilitator)->assertUnprocessable()->assertJsonValidationErrors('status');
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

- [ ] **Step 4: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/TeamSurveyStatusTest.php`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
vendor/bin/pint --dirty --format agent
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

- [ ] **Step 5: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/TeamSurveyAnswersTest.php tests/Feature/TeamSurveys/TeamSurveyAccessTest.php`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app routes tests/Feature/TeamSurveys lang
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
     * Ordered by text so the order tells neither when nor by whom an answer was written.
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
        return $answers
            ->filter(fn (TeamSurveyAnswer $answer): bool => trim((string) $answer->{$attribute}) !== '')
            ->sort(fn (TeamSurveyAnswer $first, TeamSurveyAnswer $second): int => [mb_strtolower((string) $first->{$attribute}), $first->id]
                <=> [mb_strtolower((string) $second->{$attribute}), $second->id])
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

- [ ] **Step 5: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys`
Expected: PASS (every file of the folder, the earlier ones included).

- [ ] **Step 6: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app tests/Feature/TeamSurveys
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

A pair is `{questionId, otherQuestionId, kind, label, current, other, delta}`. `current` and `other` are: scale `{mean, responses}`; NPS `{nps, responses}`; choice `{responses, options: [{label, percent}]}`; text `{responses}`. `delta` is: scale, the difference of means rounded to one decimal, or null when a mean is missing or the two maxima differ; NPS, the difference of scores; choice, a list `{label, delta}` in percentage points for the labels both have; text, the difference of the numbers of answers.

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

it('gives no scale difference between a scale of five and a scale of ten', function () {
    $team = Team::factory()->create();
    $before = closedSurvey($team, '2026-09-01 10:00:00');
    $now = closedSurvey($team, '2026-10-01 10:00:00');
    answeredBy(surveyQuestion($before, TeamSurveyQuestionKind::Scale, ['match_key' => 'k', 'scale_max' => 10]), [8]);
    answeredBy(surveyQuestion($now, TeamSurveyQuestionKind::Scale, ['match_key' => 'k', 'scale_max' => 5]), [4]);

    expect(resolve(CompareSurveys::class)->handle($now, $before)['pairs'][0]['delta'])->toBeNull();
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
                Rule::exists('team_surveys', 'id')->where('team_id', $this->route('team')->id)->where('status', '!=', TeamSurveyStatus::Draft->value),
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
        return mb_strtolower(trim($label));
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
        $comparable = $question->scale_max === $match->scale_max && $current['mean'] !== null && $other['mean'] !== null;

        return [
            'current' => ['mean' => $current['mean'], 'responses' => $current['responses']],
            'other' => ['mean' => $other['mean'], 'responses' => $other['responses']],
            'delta' => $comparable ? round($current['mean'] - $other['mean'], 1) : null,
        ];
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

- [ ] **Step 5: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
vendor/bin/pint --dirty --format agent
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

- [ ] **Step 4: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/TeamSurveyExportTest.php`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
vendor/bin/pint --dirty --format agent
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

- [ ] **Step 4: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/TeamSurveysSectionTest.php tests/Feature/Teams`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app tests/Feature/TeamSurveys
git commit -m "feat(team): the team page receives its surveys and the survey templates"
```

---

## Step B — the health data moves (lane H)

Tasks 14 to 16 always run their tests, whatever the working rule on test runs. Tasks 15 and 16 are merged into the main branch together: between them the board writes team surveys while the summaries still read the old tables.

### Task 14: Import of the health checks into team surveys

**Files:**
- Create: `app/Support/Surveys/ImportHealthChecks.php`, `app/Support/Surveys/VerifyHealthCheckImport.php`
- Create: `database/migrations/2026_10_19_100100_copy_health_checks_to_team_surveys.php`
- Create: `app/Console/Commands/ImportHealthChecksCommand.php`, `app/Console/Commands/VerifyHealthCheckImportCommand.php`
- Modify: `tests/Pest.php` (lane H block: fixtures written straight into the old tables)
- Test: `tests/Feature/TeamSurveys/ImportHealthChecksTest.php`

**Interfaces:**
- Consumes: the tables of Task 1 and the old tables `retro_health_statements`, `health_check_answers`, `retros`, `participants`. No model: the class must keep working after the old models are deleted (Task 29).
- Produces: `ImportHealthChecks::handle(): array{surveys: int, questions: int, respondents: int, answers: int, skippedAnswers: int}` (what this run created; additive, idempotent, returns zeros when the old tables are gone); `VerifyHealthCheckImport::handle(): array<int, array{retroId: string, title: string, oldAnswers: int, newAnswers: int, oldSum: int, newSum: int}>` (the retros that differ); commands `surveys:import-health-checks`, `surveys:verify-health-import`; test helpers `oldHealthStatements(Retro $retro, array $statements): void`, `oldHealthAnswer(Retro $retro, Participant $participant, string $statement, int $score, string $at = '2026-09-01 10:00:00'): void`, `oldHealthFlag(Retro $retro, bool $enabled, ?string $phase = null): void`.

What is imported (spec §11.3): a retro that has frozen statements and answers; or frozen statements, no answer, the setting on and a phase other than `completed`. The survey is `closed` for a completed retro with the setting on, `open` for an open retro with the setting on, and `draft` (hidden, as the setting hid it) when the setting is off. Answers to a statement outside the frozen set are counted and left behind.

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
            'id' => (string) Str::uuid(),
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
        'id' => (string) Str::uuid(),
        'retro_id' => $retro->id,
        'participant_id' => $participant->id,
        'statement' => $statement,
        'score' => $score,
        'created_at' => $at,
        'updated_at' => $at,
    ]);
}

function oldHealthFlag(Retro $retro, bool $enabled, ?string $phase = null): void
{
    DB::table('retros')->where('id', $retro->id)->update(array_filter([
        'health_check_enabled' => $enabled,
        'phase' => $phase,
    ], fn (mixed $value): bool => $value !== null));
}
```

Add `use Illuminate\Support\Facades\DB;` to the imports of `tests/Pest.php` if it is not there.

- [ ] **Step 2: Write the failing test**

`tests/Feature/TeamSurveys/ImportHealthChecksTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Support\Surveys\ImportHealthChecks;
use App\Support\Surveys\VerifyHealthCheckImport;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * One team with the six situations of the spec (§14). Scores are chosen so
 * that every expected value below can be checked by hand.
 *
 * @return array<string, mixed>
 */
function healthHistory(): array
{
    $team = Team::factory()->create();
    $custom = (string) Str::uuid();
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

    return compact('team', 'custom', 'sprint40', 'sprint41', 'inHealthPhase', 'completedUnanswered', 'turnedOff', 'openUnanswered', 'never', 'alice', 'aliceIn41', 'guest', 'former');
}

function importedSurvey(string $retroId): ?object
{
    return DB::table('team_surveys')->where('retro_id', $retroId)->where('template', 'health_check')->first();
}

it('copies each health check into a survey attached to its retro', function () {
    $history = healthHistory();

    $report = resolve(ImportHealthChecks::class)->handle();

    expect($report)->toBe(['surveys' => 5, 'questions' => 11, 'respondents' => 6, 'answers' => 10, 'skippedAnswers' => 1]);

    $survey = importedSurvey($history['sprint41']->id);

    expect($survey)
        ->team_id->toBe($history['team']->id)
        ->title->toBe('Sprint 41')
        ->status->toBe('closed')
        ->results_threshold->toEqual(0)
        ->and((bool) $survey->guest_access_enabled)->toBeFalse()
        ->and((bool) $survey->one_question_at_a_time)->toBeFalse()
        ->and((bool) $survey->show_results_after_answer)->toBeFalse()
        ->and(strlen($survey->guest_token))->toBe(40)
        ->and(substr((string) $survey->closed_at, 0, 19))->toBe('2026-09-10 10:00:00')
        ->and(substr((string) $survey->opened_at, 0, 19))->toBe('2026-09-10 09:00:00');

    $questions = DB::table('team_survey_questions')->where('team_survey_id', $survey->id)->orderBy('position')->get();

    expect($questions->pluck('match_key')->all())->toBe(['interaction', 'vision', $history['custom']])
        ->and($questions->pluck('builtin')->all())->toBe(['interaction', 'vision', null])
        ->and($questions->pluck('kind')->unique()->all())->toBe(['scale'])
        ->and($questions->pluck('scale_max')->map(fn ($max) => (int) $max)->unique()->all())->toBe([10])
        ->and($questions[0]->label)->toBe('Interaction with colleagues was productive')
        ->and($questions[2]->label)->toBe('We ship without fear')
        ->and($questions[2]->short_label)->toBe('Shipping');
});

it('keeps who answered what, for members, guests and former members', function () {
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
        ->and(substr((string) $respondents[$history['guest']->id]->completed_at, 0, 19))->toBe('2026-09-10 09:05:00');
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

it('brings an answer written to the old tables after the first run', function () {
    $history = healthHistory();
    $import = resolve(ImportHealthChecks::class);
    $import->handle();

    $late = Participant::factory()->create(['retro_id' => $history['inHealthPhase']->id, 'user_id' => User::factory()]);
    oldHealthAnswer($history['inHealthPhase'], $late, 'vision', 9, '2026-10-01 09:30:00');

    expect($import->handle())->toMatchArray(['surveys' => 0, 'questions' => 0, 'respondents' => 1, 'answers' => 1]);
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
        ->expectsOutputToContain('5')
        ->assertSuccessful();
});
```

`healthHistory()` and `importedSurvey()` are used again by Task 16: define them in the lane H block of `tests/Pest.php`, not in this file, so that each test file runs alone.

The numbers of the first test, by hand. Surveys: Sprint 40, Sprint 41, Sprint 42, "Turned off", "Open, unanswered" = 5. Questions: 2 + 3 + 2 + 2 + 2 = 11. Respondents (every participant who answered, plus the facilitator when the retro has one): 1 + 3 + 1 + 1 + 0 = 6. Answers: 2 + 6 + 1 + 1 + 0 = 10. Skipped: the `motivation` answer of Sprint 41 = 1. Sum of the six copied scores of Sprint 41: 8 + 6 + 4 + 6 + 10 + 7 = 41.

- [ ] **Step 3: Run it and see it fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/ImportHealthChecksTest.php`
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
 * Copies the health checks of before plan 19 into team surveys. Written
 * on the query builder alone: it runs from a migration and must not
 * depend on models that change or disappear. It only adds rows, and can
 * run again.
 */
class ImportHealthChecks
{
    private const string Template = 'health_check';

    private const int ScaleMax = 10;

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

        $surveyId = $this->surveyId($retro, $answers, $this->status($isEnabled, $isCompleted), $report);
        $questionIds = $this->questionIds($surveyId, $statements, $report);
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
     * @param  Collection<int, stdClass>  $statements
     * @param  array{surveys: int, questions: int, respondents: int, answers: int, skippedAnswers: int}  $report
     * @return array<string, string> question id by statement key
     */
    private function questionIds(string $surveyId, Collection $statements, array &$report): array
    {
        $ids = DB::table('team_survey_questions')->where('team_survey_id', $surveyId)->pluck('id', 'match_key')->all();

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
                'is_required' => false,
                'allows_comment' => false,
                'scale_max' => self::ScaleMax,
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
     * ignored it.
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
     * A participant of the old health check had "finished" when they had
     * answered: the time of their last answer stands for it.
     *
     * @param  Collection<int, stdClass>  $answers
     * @param  array<string, string>  $questionIds
     * @param  array<string, string>  $respondentIds
     */
    private function stampRespondents(Collection $answers, array $questionIds, array $respondentIds): void
    {
        $lastAnswerAt = $answers
            ->filter(fn (stdClass $answer): bool => isset($questionIds[$answer->statement], $respondentIds[$answer->participant_id]))
            ->groupBy('participant_id')
            ->map(fn (Collection $own) => $own->max('updated_at'));

        foreach ($lastAnswerAt as $participantId => $at) {
            DB::table('team_survey_respondents')
                ->where('id', $respondentIds[$participantId])
                ->whereNull('completed_at')
                ->update(['completed_at' => $at]);
        }
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
     * only answers to a statement of the retro's frozen set.
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
            'oldSum' => (int) $old->sum(),
            'newSum' => (int) $new->sum(),
        ];

        if ($row['oldAnswers'] === $row['newAnswers'] && $row['oldSum'] === $row['newSum']) {
            return null;
        }

        return $row;
    }
}
```

The verification compares the copy with the old tables only while the old tables are the source, that is until Task 15 is merged; after it, new answers exist only in the new tables and the command reports them as extra answers. Its help text says so, and the release note asks to run it right after the upgrade's migrations, before the application is opened.

`database/migrations/2026_10_19_100100_copy_health_checks_to_team_surveys.php`:

```php
<?php

use App\Support\Surveys\ImportHealthChecks;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
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

- [ ] **Step 5: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/ImportHealthChecksTest.php tests/Arch`
Expected: PASS.

Also run the import against a copy of a real database if the owner provides one, and attach the two commands' output to the report.

- [ ] **Step 6: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app database tests
git commit -m "feat(health): additive, repeatable import of health checks into team surveys, with a verification command"
```

### Task 15: The retro's health check lives in a team survey — attach, answer, close, board

**Files:**
- Create: `app/Actions/HealthCheck/HealthCheckSurvey.php`, `AttachHealthCheck.php`, `CloseAttachedSurveys.php`
- Create: `app/Http/Controllers/Retros/RetroHealthChecksController.php`, `RetroHealthCheckClosuresController.php`
- Rewrite: `app/Http/Controllers/Retros/HealthCheckAnswersController.php`, `app/Actions/HealthCheck/PresentHealthProgress.php`, `PresentHealthCheck.php`
- Modify: `app/Actions/HealthCheck/ManageTeamHealthStatements.php`, `app/Actions/TeamSurveys/AnnounceSurveyResponses.php`, `app/Actions/Retros/CreateRetro.php`, `ChangeRetroPhase.php`, `app/Http/Controllers/Retros/RetroSettingsController.php`, `routes/web.php`, `tests/Pest.php`
- Test: `tests/Feature/Retros/AttachedHealthCheckTest.php`; rewritten: `tests/Feature/Retros/HealthCheckTest.php`, `HealthStatementFreezeTest.php`, and the health cases of `CreateRetroTest.php`, `BoardSnapshotTest.php`, `RetroStartTest.php`, `FacilitationTest.php`

**Interfaces:**
- Consumes: `CreateTeamSurvey`, `NewTeamSurvey`, `RespondentForParticipant`, `SaveSurveyAnswer`, `WriteSurveyQuestions`, `HealthCheckQuestions`, `ChangeTeamSurveyStatus`, `TeamSurveyChanged`, `TeamSurveyDeleted`, the existing `HealthAnswered`, `RetroSettingsChanged`, `RetroGuard`, `MarkRetroStarted`.
- Produces: `HealthCheckSurvey::forRetro(Retro $retro): ?TeamSurvey` (the one that is not a draft), `::hidden(Retro $retro): ?TeamSurvey` (the draft kept from a health check that was turned off); `AttachHealthCheck::handle(Retro $locked): TeamSurvey`; `CloseAttachedSurveys::handle(Retro $locked): void`; `PresentHealthProgress::handle(Retro $retro): array<int, array{key: string, count: int, answeredBy: array<int, string>}>` (unchanged shape); `PresentHealthCheck::handle(Retro $retro, Participant $viewer): ?array{surveyId: string, isClosed: bool, respondents: int, participants: int, statements: array<int, array{key: string, label: string, text: string, isBuiltin: bool, count: int, answeredBy: array<int, string>, myScore: ?int}>}`; routes `retros.healthCheck.store|destroy`, `retros.healthCheck.closure.update|destroy`; the routes `retros.health-check.update|destroy` keep their names, URLs and bodies; test helpers `attachHealthCheck(Retro $retro): TeamSurvey`, `answerHealthCheck(Retro $retro, Participant $participant, array $scores): void`, `closeHealthCheck(Retro $retro): TeamSurvey`.

Behaviour kept from today, on purpose: turning a health check off hides it and keeps its answers; turning it on again brings them back, and rebuilds the statements only when nobody had answered.

- [ ] **Step 1: Test helpers**

In the lane H block of `tests/Pest.php`:

```php
function attachHealthCheck(Retro $retro): TeamSurvey
{
    return resolve(AttachHealthCheck::class)->handle($retro);
}

/**
 * @param  array<string, int>  $scores  statement key => score
 */
function answerHealthCheck(Retro $retro, Participant $participant, array $scores): void
{
    $survey = resolve(HealthCheckSurvey::class)->forRetro($retro) ?? attachHealthCheck($retro);
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

- [ ] **Step 2: Write the failing test**

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
use App\Models\TeamSurvey;
use Illuminate\Support\Facades\Event;

function healthRoute(Retro $retro, string $statement): string
{
    return route('retros.health-check.update', [$retro, $statement]);
}

it('attaches a health check when a retro is created with it', function () {
    $team = App\Models\Team::factory()->create();
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
        ->and($survey->facilitator->participant_id)->toBe($retro->facilitator_participant_id)
        ->and($survey->facilitator->user_id)->toBe($user->id);
});

it('attaches nothing to a retro created without it', function () {
    $team = App\Models\Team::factory()->create();

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

it('sets, changes and clears the own score for one statement, in any open phase', function (RetroPhase $phase) {
    Event::fake([HealthAnswered::class]);
    $retro = Retro::factory()->inPhase($phase)->create();
    [$user, $participant] = retroMember($retro);
    attachHealthCheck($retro);

    $this->actingAs($user)->putJson(healthRoute($retro, 'vision'), ['score' => 7])
        ->assertOk()
        ->assertJsonPath('statement', 'vision')
        ->assertJsonPath('score', 7)
        ->assertJsonPath('statements.3.key', 'vision')
        ->assertJsonPath('statements.3.count', 1)
        ->assertJsonPath('statements.3.answeredBy', [$participant->id]);

    $this->actingAs($user)->putJson(healthRoute($retro, 'vision'), ['score' => 9])->assertOk();

    $survey = resolve(HealthCheckSurvey::class)->forRetro($retro);
    $respondent = $survey->respondents()->where('participant_id', $participant->id)->sole();

    expect($respondent->answers()->count())->toBe(1)
        ->and($respondent->answers()->sole()->value)->toBe(9)
        ->and($respondent->user_id)->toBe($user->id);

    $this->actingAs($user)->deleteJson(healthRoute($retro, 'vision'))->assertOk()->assertJsonPath('statements.3.count', 0);

    Event::assertDispatched(fn (HealthAnswered $event) => $event->broadcastAs() === 'health.answered');
})->with([RetroPhase::Writing, RetroPhase::Discussing, RetroPhase::Roti]);

it('lets a guest of the retro answer', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    attachHealthCheck($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->putJson(healthRoute($retro, 'vision'), ['score' => 4])
        ->assertOk();
});

it('accepts scores from 1 to 10 only', function (mixed $score) {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    attachHealthCheck($retro);

    $this->actingAs($user)->putJson(healthRoute($retro, 'vision'), ['score' => $score])->assertJsonValidationErrors('score');
})->with([0, 11, 'seven', null]);

it('answers 404 for a statement outside the health check, and when there is none', function () {
    $with = Retro::factory()->create();
    [$user] = retroMember($with);
    attachHealthCheck($with);
    $without = Retro::factory()->create();
    [$other] = retroMember($without);

    $this->actingAs($user)->putJson(healthRoute($with, 'not_a_statement'), ['score' => 5])->assertNotFound();
    $this->actingAs($other)->putJson(healthRoute($without, 'vision'), ['score' => 5])->assertNotFound();
});

it('refuses answers on a locked board, once closed, and once the retro is completed', function (Closure $arrange, int $status) {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    attachHealthCheck($retro);
    $arrange($retro);

    $this->actingAs($user)->putJson(healthRoute($retro->fresh(), 'vision'), ['score' => 5])->assertStatus($status);
})->with([
    'locked board' => [fn (Retro $retro) => $retro->update(['is_locked' => true]), 423],
    'closed health check' => [fn (Retro $retro) => closeHealthCheck($retro), 422],
    'completed retro' => [fn (Retro $retro) => $retro->update(['phase' => RetroPhase::Completed, 'completed_at' => now()]), 403],
]);

it('hides who answered on an anonymous retro', function () {
    $retro = Retro::factory()->anonymous()->create();
    [$user] = retroMember($retro);
    attachHealthCheck($retro);

    $this->actingAs($user)->putJson(healthRoute($retro, 'vision'), ['score' => 7])
        ->assertJsonPath('statements.3.count', 1)
        ->assertJsonPath('statements.3.answeredBy', []);
});

it('sends each viewer their own score and the state of the health check in the board snapshot', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);
    [$other, $otherParticipant] = retroMember($retro);
    $survey = attachHealthCheck($retro);
    answerHealthCheck($retro, $participant, ['vision' => 7]);
    answerHealthCheck($retro, $otherParticipant, ['vision' => 2]);

    $this->actingAs($user)->getJson(route('retros.snapshot.show', $retro))
        ->assertJsonPath('healthCheck.surveyId', $survey->id)
        ->assertJsonPath('healthCheck.isClosed', false)
        ->assertJsonPath('healthCheck.respondents', 2)
        ->assertJsonPath('healthCheck.participants', 2)
        ->assertJsonPath('healthCheck.statements.3.myScore', 7)
        ->assertJsonPath('healthCheck.statements.3.count', 2)
        ->assertJsonPath('healthCheck.statements.3.label', 'Vision')
        ->assertJsonPath('healthCheck.statements.3.isBuiltin', true);
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
    answerHealthCheck($answered, $participant, ['vision' => 7]);

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
    $team = App\Models\Team::factory()->create();
    $unanswered = Retro::factory()->for($team)->create();
    $answered = Retro::factory()->for($team)->create();
    [, $participant] = retroMember($answered);
    $closed = Retro::factory()->for($team)->create();
    $standalone = TeamSurvey::factory()->healthCheck()->create(['team_id' => $team->id]);
    $ordinary = TeamSurvey::factory()->create(['team_id' => $team->id]);
    $ordinaryQuestion = surveyQuestion($ordinary);
    attachHealthCheck($unanswered);
    attachHealthCheck($answered);
    answerHealthCheck($answered, $participant, ['vision' => 7]);
    attachHealthCheck($closed);
    closeHealthCheck($closed);

    $custom = resolve(ManageTeamHealthStatements::class)->add($team, 'We ship without fear', 'Shipping');
    $keys = fn (Retro $retro) => TeamSurvey::query()->where('retro_id', $retro->id)->sole()->questions()->pluck('match_key')->all();

    expect($keys($unanswered))->toContain($custom->id)
        ->and($standalone->questions()->pluck('match_key')->all())->toContain($custom->id)
        ->and($keys($answered))->not->toContain($custom->id)
        ->and($keys($closed))->not->toContain($custom->id)
        ->and($ordinary->questions()->pluck('id')->all())->toBe([$ordinaryQuestion->id]);
    Event::assertDispatched(fn (RetroSettingsChanged $event) => $event->retroId === $unanswered->id);
});

it('still refuses to turn anonymity off once someone has answered the health check', function () {
    $retro = Retro::factory()->anonymous()->create();
    [$facilitator, $participant] = retroFacilitator($retro);
    attachHealthCheck($retro);
    answerHealthCheck($retro, $participant, ['vision' => 7]);

    $this->actingAs($facilitator)->patchJson(route('retros.settings.update', $retro), ['is_anonymous' => false])
        ->assertUnprocessable()->assertJsonValidationErrors('is_anonymous');
});
```

The index 3 is the position of `vision` among the six built-in statements. `RetroPhase::Roti` exists since plan 18e (B1).

- [ ] **Step 3: Run it and see it fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/AttachedHealthCheckTest.php`
Expected: FAIL, `Class "App\Actions\HealthCheck\AttachHealthCheck" not found`.

- [ ] **Step 4: Finder, attach, close**

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
     * A health check that was turned off: kept, with its answers, as a draft.
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
     * The statements follow the team again only when nobody had answered:
     * answers refer to the questions they were given to.
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
        $open = TeamSurvey::query()->where('retro_id', $locked->id)->where('status', TeamSurveyStatus::Open)->get();

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

`closeSurveys` runs after `move()`, which has just written `completed_at`.

- [ ] **Step 5: Presenters**

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
     * @return array<int, array{
     *     key: string,
     *     count: int,
     *     answeredBy: array<int, string>
     * }>
     */
    public function handle(Retro $retro): array
    {
        $survey = $this->healthCheckSurvey->forRetro($retro);

        if ($survey === null) {
            return [];
        }

        return $this->forSurvey($survey, $retro);
    }

    /**
     * Who answered is named by retro participant, and only on a retro that
     * is not anonymous. A member who answered from the survey's own page
     * without ever opening the retro counts and is not named.
     *
     * @return array<int, array{key: string, count: int, answeredBy: array<int, string>}>
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

        return $questions->map(function (TeamSurveyQuestion $question) use ($retro, $answers): array {
            /** @var Collection<int, TeamSurveyAnswer> $own */
            $own = $answers->get($question->id, collect());

            return [
                'key' => (string) $question->match_key,
                'count' => $own->count(),
                'answeredBy' => $retro->is_anonymous
                    ? []
                    : $own->map(fn (TeamSurveyAnswer $answer): ?string => $answer->respondent?->participant_id)->filter()->values()->all(),
            ];
        })->values()->all();
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
     *     respondents: int,
     *     participants: int,
     *     statements: array<int, array{
     *         key: string,
     *         label: string,
     *         text: string,
     *         isBuiltin: bool,
     *         count: int,
     *         answeredBy: array<int, string>,
     *         myScore: ?int
     *     }>
     * }|null
     */
    public function handle(Retro $retro, Participant $viewer): ?array
    {
        $survey = $this->healthCheckSurvey->forRetro($retro);

        if ($survey === null) {
            return null;
        }

        $progress = collect($this->presentHealthProgress->forSurvey($survey, $retro))->keyBy('key');
        $myScores = $this->myScores($survey, $viewer);

        return [
            'surveyId' => $survey->id,
            'isClosed' => $survey->status === TeamSurveyStatus::Closed,
            'respondents' => $survey->responseCount(),
            'participants' => $retro->participants()->count(),
            'statements' => $survey->questions()->get()->map(fn (TeamSurveyQuestion $question): array => [
                'key' => (string) $question->match_key,
                'label' => (string) $question->displayShortLabel(),
                'text' => $question->displayLabel(),
                'isBuiltin' => $question->builtin !== null,
                'count' => $progress[$question->match_key]['count'] ?? 0,
                'answeredBy' => $progress[$question->match_key]['answeredBy'] ?? [],
                'myScore' => $myScores[$question->id] ?? null,
            ])->values()->all(),
        ];
    }

    /**
     * Reads the viewer's respondent without creating one: a snapshot must
     * not add rows.
     *
     * @return array<string, int>
     */
    private function myScores(TeamSurvey $survey, Participant $viewer): array
    {
        $respondent = TeamSurveyRespondent::query()
            ->where('team_survey_id', $survey->id)
            ->where(fn (Builder $query) => $query
                ->where('participant_id', $viewer->id)
                ->when($viewer->user_id !== null, fn (Builder $own) => $own->orWhere('user_id', $viewer->user_id)))
            ->first();

        if ($respondent === null) {
            return [];
        }

        return TeamSurveyAnswer::query()
            ->where('team_survey_respondent_id', $respondent->id)
            ->whereNotNull('value')
            ->pluck('value', 'team_survey_question_id')
            ->map(fn (mixed $value): int => (int) $value)
            ->all();
    }
}
```

`BuildBoardSnapshot` keeps calling `$this->presentHealthCheck->handle($retro, $viewer)`; nothing changes there in this task.

In `app/Actions/TeamSurveys/AnnounceSurveyResponses.php`, so that the board hears an answer whichever page it came from:

```php
<?php

namespace App\Actions\TeamSurveys;

use App\Actions\HealthCheck\PresentHealthProgress;
use App\Events\Retros\HealthAnswered;
use App\Events\TeamSurveys\TeamSurveyResponsesChanged;
use App\Models\TeamSurvey;

class AnnounceSurveyResponses
{
    public function __construct(private PresentHealthProgress $presentHealthProgress) {}

    /**
     * @return array<int, array{key: string, count: int, answeredBy: array<int, string>}> the progress of an attached health check, empty otherwise
     */
    public function handle(TeamSurvey $survey): array
    {
        TeamSurveyResponsesChanged::for($survey)->sendToOthers();

        if ($survey->retro === null || ! $survey->isHealthCheck()) {
            return [];
        }

        $progress = $this->presentHealthProgress->forSurvey($survey, $survey->retro);

        (new HealthAnswered($survey->retro_id, $progress))->sendToOthers();

        return $progress;
    }
}
```

The return type changes from `void` to `array`; the two callers of Task 9 ignore it.

- [ ] **Step 6: Controllers**

`app/Http/Controllers/Retros/HealthCheckAnswersController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\HealthCheck\HealthCheckSurvey;
use App\Actions\Retros\MarkRetroStarted;
use App\Actions\Retros\RetroGuard;
use App\Actions\TeamSurveys\AnnounceSurveyResponses;
use App\Actions\TeamSurveys\RespondentForParticipant;
use App\Actions\TeamSurveys\SaveSurveyAnswer;
use App\Enums\TeamSurveyStatus;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyQuestion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class HealthCheckAnswersController extends Controller
{
    public function __construct(
        private HealthCheckSurvey $healthCheckSurvey,
        private RespondentForParticipant $respondentForParticipant,
        private SaveSurveyAnswer $saveSurveyAnswer,
        private AnnounceSurveyResponses $announceSurveyResponses,
        private MarkRetroStarted $markRetroStarted,
    ) {}

    public function update(Request $request, Retro $retro, string $statement): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro);

        $validated = $request->validate([
            'score' => ['required', 'integer', 'min:1', 'max:'.TeamSurveyQuestion::HealthScaleMax],
        ]);

        $score = (int) $validated['score'];

        $progress = DB::transaction(function () use ($retro, $participant, $statement, $score): array {
            [$locked, $survey, $question] = $this->lock($retro, $statement);

            $respondent = $this->respondentForParticipant->handle($survey, $participant);

            $this->saveSurveyAnswer->handle($question, $respondent, ['value' => $score]);

            $respondent->update(['completed_at' => now()]);

            $this->markRetroStarted->handle($locked);

            return $this->announceSurveyResponses->handle($survey);
        });

        return response()->json(['statement' => $statement, 'score' => $score, 'statements' => $progress]);
    }

    public function destroy(Request $request, Retro $retro, string $statement): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro);

        $progress = DB::transaction(function () use ($retro, $participant, $statement): array {
            [, $survey, $question] = $this->lock($retro, $statement);

            $respondent = $this->respondentForParticipant->handle($survey, $participant);

            $question->answers()->where('team_survey_respondent_id', $respondent->id)->delete();

            return $this->announceSurveyResponses->handle($survey);
        });

        return response()->json(['statements' => $progress]);
    }

    private function guard(Retro $retro): void
    {
        RetroGuard::open($retro);
        RetroGuard::unlocked($retro);
    }

    /**
     * The retro first, then its survey: every path that takes both locks
     * takes them in this order.
     *
     * @return array{0: Retro, 1: TeamSurvey, 2: TeamSurveyQuestion}
     */
    private function lock(Retro $retro, string $statement): array
    {
        $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

        $this->guard($locked);

        $found = $this->healthCheckSurvey->forRetro($locked);

        abort_if($found === null, 404);

        $survey = TeamSurvey::query()->whereKey($found->id)->lockForUpdate()->firstOrFail();

        if ($survey->status !== TeamSurveyStatus::Open) {
            throw ValidationException::withMessages(['health_check' => __('The health check is closed.')]);
        }

        $question = $survey->questions()->where('match_key', $statement)->first();

        abort_if($question === null, 404);

        return [$locked, $survey, $question];
    }
}
```

The three refusals keep the statuses the guards give today: 423 for a locked board (`RetroGuard::unlocked`), 403 for a completed retro (`RetroGuard::open`), and 422 for a closed health check.

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

            $survey = $healthCheckSurvey->forRetro($locked);

            abort_if($survey === null, 404);

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

Routes, in the `retros/{retro}` group, next to the two existing health routes (which stay):

```php
        Route::post('health-check', [RetroHealthChecksController::class, 'store'])->name('retros.healthCheck.store');
        Route::delete('health-check', [RetroHealthChecksController::class, 'destroy'])->name('retros.healthCheck.destroy');
        Route::put('health-check/closure', [RetroHealthCheckClosuresController::class, 'update'])->name('retros.healthCheck.closure.update');
        Route::delete('health-check/closure', [RetroHealthCheckClosuresController::class, 'destroy'])->name('retros.healthCheck.closure.destroy');
```

Register them **before** `health-check/{statement}`: the pattern `[A-Za-z0-9_-]{1,64}` of `{statement}` matches the word `closure`.

- [ ] **Step 7: Creation, settings, team statements**

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
     * the questions they were given to.
     */
    private function refreshUnansweredHealthChecks(Team $team): void
    {
        $surveys = TeamSurvey::query()
            ->where('team_id', $team->id)
            ->where('template', TeamSurveyTemplate::HealthCheck)
            ->where('status', '!=', TeamSurveyStatus::Closed)
            ->orderBy('id')
            ->get();

        foreach ($surveys as $found) {
            $survey = TeamSurvey::query()->whereKey($found->id)->lockForUpdate()->first();

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

The old models and `FreezeHealthStatements` are still on disk after this task (Task 29 deletes them); nothing writes the old tables any more. Check: `grep -rn "FreezeHealthStatements\|healthCheckAnswers()\|healthStatements()" app` shows only `Retro.php`, `Team.php`, the summaries of Task 16 and the old model files.

- [ ] **Step 8: Existing tests that move to the new fixtures**

Each is edited in this task's commit; none is deleted. "Fixture" means: replace `withHealthCheck()`, `FreezeHealthStatements`, `HealthCheckAnswer::factory()` and `healthStatements()` by `attachHealthCheck`, `answerHealthCheck`, `closeHealthCheck` and the survey's questions.

| File | Case | Change |
|---|---|---|
| `HealthCheckTest.php` | "sets, changes and clears…", "changes a score without duplicating…", "lets guests answer", "accepts scores from 1 to 10 only", "returns 404 for statements outside the retro set", "broadcasts counts and who answered, never a score", "hides who answered on anonymous retros", "sends each viewer only their own score in the snapshot" | fixture; the retro is in `Writing`, not `HealthCheck` |
| | "only accepts answers during the health check and while unlocked" | becomes "accepts answers in every open phase while unlocked and open": the phase dataset turns from refusals into acceptances; locked and completed stay refused |
| | "leaves the health check out of the snapshot when it is off and unanswered" | "…of a retro that has none" |
| | "presents built-in statements translated and custom statements as stored" | fixture; same assertions on `label` and `text` |
| | "includes the health check in the snapshot when answers exist though it is off" | becomes "keeps the answers of a health check that was removed, out of the snapshot, and brings them back when it is added again" |
| `HealthStatementFreezeTest.php` | "freezes the six built-ins when a retro is created with the health check", "freezes the team active statements, custom ones with their text and id" | assert the attached survey's questions (`match_key`, `builtin`, `label`, `short_label`) |
| | "freezes nothing for a retro created without the health check" | no survey |
| | "freezes the set when the facilitator turns the health check on", "refreshes an unanswered set when the health check is turned on again" | through `retros.healthCheck.store` and `.destroy` |
| | "keeps the frozen set once answered, whatever the team changes", "re-freezes unanswered enabled retros when the team edits its statements", "broadcasts a settings change…", "keeps the set of a retro that has answers…", "leaves completed retros untouched…", "leaves retros without the health check untouched…" | fixture; same assertions on the questions |
| `CreateRetroTest.php`, `BoardSnapshotTest.php` | health cases | `retro.healthCheckEnabled` stays in the snapshot until Task 27; assert `healthCheck.surveyId` beside it |
| `RetroStartTest.php` | "a health-check answer starts the retro" | fixture |
| `FacilitationTest.php` | cases that patch `health_check_enabled` through `retros.settings.update` | the field is ignored: move the cases to `retros.healthCheck.store` / `.destroy`; the "cannot turn the current phase off" case for the health check goes to Task 27's list (the phase still exists here) |
| `TeamHealthStatementsTest.php` | cases that read `retro_health_statements` after a team edit | read the survey's questions |

- [ ] **Step 9: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros tests/Feature/Teams tests/Feature/TeamSurveys`
Expected: PASS, except the summary, trend, results, recap and MCP health cases (`HealthCheckSummaryTest`, `HealthTrendTest`, `TeamMoodTrendTest`, the health cases of `ResultsTest`, `SummaryInputTest`, `ResultsEmailTest`, `InsightsHealthRotiTest`), which read the old tables until Task 16 and are not touched here. List the failing cases in the commit message body; Task 16 turns them green. Do not merge this task alone.

- [ ] **Step 10: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app routes tests lang
git commit -m "feat(health): a retro attaches its health check as a team survey; answers, closing and the board read it"
```

### Task 16: Summaries, trends and the MCP tool read team surveys

**Files:**
- Rewrite: `app/Actions/HealthCheck/SummarizeHealthCheck.php`, `BuildHealthTrend.php`, `app/Actions/Teams/BuildTeamMoodTrend.php`, `app/Mcp/Tools/Retro/GetHealth.php`
- Modify: `app/Actions/HealthCheck/PresentHealthCheck.php` (adds `results`), `tests/Pest.php`
- Test: `tests/Feature/TeamSurveys/HealthCheckParityTest.php`; fixtures moved in `tests/Feature/Retros/HealthCheckSummaryTest.php`, `HealthTrendTest.php`, `ResultsTest.php`, `SummaryInputTest.php`, `tests/Feature/Teams/TeamMoodTrendTest.php`, `tests/Feature/Integrations/ResultsEmailTest.php`, `tests/Feature/Mcp/InsightsHealthRotiTest.php`, `MessagesAndSummaryTest.php`, `ReadPrivacyTest.php`

**Interfaces:**
- Consumes: `HealthCheckSurvey::forRetro`, the models, `ImportHealthChecks` and the fixture helpers of Task 14.
- Produces, with the output shapes they have today: `SummarizeHealthCheck::handle(Retro $retro, ?Participant $viewer = null): ?array`; `SummarizeHealthCheck::forSurvey(TeamSurvey $survey, int $participants, bool $withPrevious = true): ?array`; `SummarizeHealthCheck::scoreOf(array $averages): ?float` (unchanged); `BuildHealthTrend::forViewer(Retro, Participant): ?array`, `::handle(Retro $retro): array`, `::forTeam(string $teamId, ?CarbonInterface $until = null): array` — each point is `{retroId: ?string, surveyId: string, title: string, completedAt: string, score: float, url: string, delta: ?float, sameStatements: bool}`; `BuildHealthTrend::scoresOf(Collection $surveys): Collection<string, ?float>` (keyed by survey id; replaces `scores(Collection $retroIds)`); `BuildTeamMoodTrend::handle(Team $team): array` — each point is `{retroId: ?string, surveyId: ?string, title, completedAt, url, mood, moodVoters, roti, rotiVoters}`; snapshot key `healthCheck.results` (the summary, once the health check is closed, else null).

- [ ] **Step 1: Write the failing test**

`tests/Feature/TeamSurveys/HealthCheckParityTest.php` — the values that the old readers gave for the fixture of Task 14, written by hand, asserted on the new readers after the import:

```php
<?php

use App\Actions\HealthCheck\BuildHealthTrend;
use App\Actions\HealthCheck\SummarizeHealthCheck;
use App\Actions\Teams\BuildTeamMoodTrend;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Support\Surveys\ImportHealthChecks;

beforeEach(function () {
    $this->history = healthHistory();

    resolve(ImportHealthChecks::class)->handle();
});

it('summarises an imported health check with the numbers it always had', function () {
    $summary = resolve(SummarizeHealthCheck::class)->handle($this->history['sprint41']);
    $statements = collect($summary['statements'])->keyBy('key');

    expect(array_keys($summary))->toBe(['statements', 'score', 'participation', 'topStrength', 'growthArea', 'alignment', 'assessment'])
        ->and(array_keys($summary['statements'][0]))->toBe(['key', 'label', 'text', 'isBuiltin', 'average', 'count', 'consensus', 'previousAverage'])
        ->and($statements['interaction'])->toMatchArray(['label' => 'Interaction', 'isBuiltin' => true, 'average' => 7.0, 'count' => 3, 'previousAverage' => 5.0])
        ->and($statements['vision'])->toMatchArray(['average' => 8.0, 'count' => 2, 'previousAverage' => 5.0])
        ->and($statements[$this->history['custom']])->toMatchArray(['label' => 'Shipping', 'text' => 'We ship without fear', 'isBuiltin' => false, 'average' => 4.0, 'count' => 1, 'previousAverage' => null])
        ->and($summary['score'])->toBe(6.3)
        ->and($summary['participation'])->toBe(['respondents' => 3, 'participants' => 3])
        ->and($summary['topStrength'])->toBe(['key' => 'vision', 'label' => 'Vision', 'average' => 8.0])
        ->and($summary['growthArea'])->toBe(['key' => $this->history['custom'], 'label' => 'Shipping', 'average' => 4.0])
        ->and($summary['assessment']['band'])->toBe('good');
});

it('computes the consensus of a statement as before', function () {
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

it('lists the imported health checks in the trend, oldest first, with their deltas', function () {
    $trend = resolve(BuildHealthTrend::class)->handle($this->history['sprint41']);

    expect($trend)->toHaveCount(2)
        ->and($trend[0])->toMatchArray([
            'retroId' => $this->history['sprint40']->id,
            'title' => 'Sprint 40',
            'score' => 5.0,
            'delta' => null,
            'sameStatements' => true,
            'url' => route('retros.show', $this->history['sprint40']->id),
        ])
        ->and($trend[1])->toMatchArray(['retroId' => $this->history['sprint41']->id, 'score' => 6.3, 'delta' => 1.3, 'sameStatements' => false])
        ->and($trend[1]['completedAt'])->toBe($this->history['sprint41']->completed_at->toIso8601String());
});

it('gives the team mood trend the same points, and adds a health check run as a survey', function () {
    $before = resolve(BuildTeamMoodTrend::class)->handle($this->history['team']);

    expect(array_column($before, 'retroId'))->toBe([$this->history['sprint40']->id, $this->history['sprint41']->id])
        ->and($before[1])->toMatchArray(['title' => 'Sprint 41', 'mood' => 6.3, 'moodVoters' => 3, 'roti' => null, 'rotiVoters' => 0]);

    $standalone = TeamSurvey::factory()->healthCheck()->closed()->create([
        'team_id' => $this->history['team']->id, 'title' => 'Health check — October', 'closed_at' => '2026-10-05 10:00:00',
    ]);
    [, $respondent] = surveyMember($standalone);
    answerSurveyQuestion(surveyQuestion($standalone, attributes: ['match_key' => 'vision', 'scale_max' => 10]), $respondent, 9);

    $after = resolve(BuildTeamMoodTrend::class)->handle($this->history['team']);

    expect($after)->toHaveCount(3)
        ->and($after[2])->toMatchArray([
            'retroId' => null,
            'surveyId' => $standalone->id,
            'title' => 'Health check — October',
            'mood' => 9.0,
            'moodVoters' => 1,
            'roti' => null,
            'url' => route('surveys.results.show', $standalone),
        ]);
});

it('gives a statement the average of the previous closed health check, whatever its kind of session', function () {
    $standalone = TeamSurvey::factory()->healthCheck()->closed()->create([
        'team_id' => $this->history['team']->id, 'closed_at' => '2026-09-01 10:00:00',
    ]);
    [, $respondent] = surveyMember($standalone);
    answerSurveyQuestion(surveyQuestion($standalone, attributes: ['match_key' => 'vision', 'scale_max' => 10]), $respondent, 2);

    $summary = resolve(SummarizeHealthCheck::class)->handle($this->history['sprint41']);
    $statements = collect($summary['statements'])->keyBy('key');

    expect($statements['vision']['previousAverage'])->toBe(2.0)
        ->and($statements['interaction']['previousAverage'])->toBeNull();
});
```

Hand computation for Sprint 41: interaction (8 + 6 + 7) ÷ 3 = 7.0; vision (6 + 10) ÷ 2 = 8.0; custom 4.0; score = round((7.0 + 8.0 + 4.0) ÷ 3, 1) = 6.3; Sprint 40 score 5.0, delta 1.3; the consensus of vision: variance of {6, 10} = 4, spread 2, 10 × (1 − 2 ÷ 4.5) = 5.56. The fixture's retros are used as built in memory and never reloaded: the one left in the `health_check` phase cannot be read through Eloquent once Task 27 has removed the enum case.

- [ ] **Step 2: Run it and see it fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/HealthCheckParityTest.php`
Expected: FAIL on every case: the readers still query `health_check_answers`, and after Task 15 nothing they need is written there; the first case fails with `participation` or a null summary.

Before rewriting, prove the claim "same numbers": check out the commit before Task 15 in a scratch worktree, add a throw-away test that builds `healthHistory()` and dumps `SummarizeHealthCheck::handle`, `BuildHealthTrend::handle` and `BuildTeamMoodTrend::handle` from the **old** code, and compare the dump with the literals above. Any literal that differs is corrected to the old code's value, and the difference is reported. Do not commit the throw-away test.

- [ ] **Step 3: SummarizeHealthCheck**

`app/Actions/HealthCheck/SummarizeHealthCheck.php` — `handle` and `forSurvey` replace the old `handle` and `previousAverages`; `scoreOf`, `consensus`, `extremes`, `extreme`, `alignment`, `assessment` and the constant `MaximumSpread` are kept exactly as they are:

```php
    public function __construct(private HealthCheckSurvey $healthCheckSurvey) {}

    /**
     * The previous averages come from another session of the team, which a guest of this one must not see.
     *
     * @return array{
     *     statements: array<int, array{key: string, label: string, text: string, isBuiltin: bool, average: ?float, count: int, consensus: ?float, previousAverage: ?float}>,
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
            $values = $valuesByQuestion->get($question->id, collect())->map(fn (TeamSurveyAnswer $answer): int => (int) $answer->value);
            $count = $values->count();
            $mean = $count === 0 ? null : $values->sum() / $count;
            $squares = $values->sum(fn (int $value): int => $value * $value);

            return [
                'key' => (string) $question->match_key,
                'label' => (string) $question->displayShortLabel(),
                'text' => $question->displayLabel(),
                'isBuiltin' => $question->builtin !== null,
                'average' => $mean === null ? null : round($mean, 1),
                'count' => $count,
                'consensus' => $mean === null ? null : $this->consensus($squares / $count - $mean ** 2),
                'previousAverage' => $previousAverages[$question->match_key] ?? null,
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
     * @return array<string, float> average by statement key, in the team's previous closed health check
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

        $keys = $previous->questions()->pluck('match_key', 'id');

        return TeamSurveyAnswer::query()
            ->whereIn('team_survey_question_id', $keys->keys())
            ->whereNotNull('value')
            ->get(['team_survey_question_id', 'value'])
            ->groupBy('team_survey_question_id')
            ->mapWithKeys(fn (Collection $own, string $questionId): array => [
                (string) $keys[$questionId] => round($own->avg('value'), 1),
            ])
            ->all();
    }
```

Two things the old code did are kept on purpose: the retro's summary is null without a visible health check (the old `health_check_enabled` test) and `participation.respondents` counts people, not answers. One thing changes and is in the spec (§11.6): the previous health check may be a survey of its own.

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
     * @param  Collection<int, TeamSurvey>  $surveys
     * @return Collection<string, ?float> score by survey id, null when it has no answer
     */
    public function scoresOf(Collection $surveys): Collection
    {
        $questions = TeamSurveyQuestion::query()->whereIn('team_survey_id', $surveys->pluck('id'))->get(['id', 'team_survey_id']);

        $valuesByQuestion = TeamSurveyAnswer::query()
            ->whereIn('team_survey_question_id', $questions->pluck('id'))
            ->whereNotNull('value')
            ->get(['team_survey_question_id', 'value'])
            ->groupBy('team_survey_question_id');

        $questionsBySurvey = $questions->groupBy('team_survey_id');

        return $surveys->mapWithKeys(function (TeamSurvey $survey) use ($questionsBySurvey, $valuesByQuestion): array {
            $averages = $questionsBySurvey->get($survey->id, collect())
                ->map(fn (TeamSurveyQuestion $question) => $valuesByQuestion->get($question->id))
                ->filter()
                ->map(fn (Collection $own): float => round($own->avg('value'), 1))
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

The number of queries stays constant (surveys, their retros, questions twice, answers), which the existing "builds the trend with a constant number of queries" case checks.

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
     * ROTI comes from completed retros. Mood comes from closed health
     * checks: the one attached to a completed retro joins that retro's
     * point, one run as a survey is a point of its own.
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
                ]),
        );

        return $points
            ->sort(fn (array $first, array $second): int => [$second['at'], $second['surveyId'] ?? $second['retroId']] <=> [$first['at'], $first['surveyId'] ?? $first['retroId']])
            ->take(self::Points)
            ->reverse()
            ->map(fn (array $point): array => collect($point)->except('at')->all())
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

A health check attached to a retro that is not completed (closed by hand during the retro) is in neither list until the retro is completed, as an open retro never was in this trend. The front adapter `lib/teams/mood-adapter.ts` keys a point by `retroId`; Task 26 moves it to `surveyId ?? retroId`.

- [ ] **Step 6: Board results, MCP**

In `PresentHealthCheck`, inject `SummarizeHealthCheck $summarizeHealthCheck`, add `results: ?array<string, mixed>` to the docblock and to the returned array:

```php
            'results' => $survey->status === TeamSurveyStatus::Closed ? $this->summarizeHealthCheck->handle($retro, $viewer) : null,
```

In `app/Mcp/Tools/Retro/GetHealth.php`, inject `HealthCheckSurvey $healthCheckSurvey` and replace the body of `run` down to the summary:

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

The `completed` payload is unchanged, except that each trend point also carries `'surveyId' => $point['surveyId']` and `boardId` may be null. `inProgress(Retro $retro, TeamSurvey $survey)` keeps its output; it reads `PresentHealthProgress::forSurvey` and the caller's scores through the respondent of `$this->context->participant($retro)`, found without creating it (the same lookup as `PresentHealthCheck::myScores`, keyed by `match_key`):

```php
        $viewer = $this->context->participant($retro);
        $questions = $survey->questions()->get()->keyBy('id');
        $respondent = $viewer === null ? null : TeamSurveyRespondent::query()
            ->where('team_survey_id', $survey->id)
            ->where(fn (Builder $query) => $query
                ->where('participant_id', $viewer->id)
                ->when($viewer->user_id !== null, fn (Builder $own) => $own->orWhere('user_id', $viewer->user_id)))
            ->first();
        $myScores = $respondent === null ? collect() : TeamSurveyAnswer::query()
            ->where('team_survey_respondent_id', $respondent->id)
            ->whereNotNull('value')
            ->get(['team_survey_question_id', 'value'])
            ->mapWithKeys(fn (TeamSurveyAnswer $answer): array => [(string) $questions[$answer->team_survey_question_id]->match_key => (int) $answer->value]);
```

The status `collected` is gone (spec §11.7): update the tool's `$description` ("while the health check is open, who answered and your own scores; once it is closed, the average per category…").

- [ ] **Step 7: Existing tests that move to the new fixtures**

| File | Change |
|---|---|
| `HealthCheckSummaryTest.php` | `summarizedRetro()` builds its scores with `answerHealthCheck` and ends with `closeHealthCheck`; "summarises nothing when the health check is off or unanswered" uses a removed health check (`retros.healthCheck.destroy` semantics: status `draft`) for "off"; "summarises the frozen set of 3 and of 10 statements" reads the survey's questions; the three `previousAverage` cases close each health check at its retro's `completed_at`. Every expected number stays. |
| `HealthTrendTest.php` | `trendRetro()` likewise; expected points gain `surveyId` (assert with `toMatchArray` where the case used `toBe` on a whole point); "builds the trend with a constant number of queries" keeps its bound, re-measured. |
| `TeamMoodTrendTest.php` | `withHealthScores()` likewise; expected points gain `surveyId`. "leaves out open retros and the retros of another team" stays. |
| `ResultsTest.php`, `SummaryInputTest.php`, `ResultsEmailTest.php`, `MessagesAndSummaryTest.php`, `ReadPrivacyTest.php` | health fixtures only; assertions unchanged. |
| `InsightsHealthRotiTest.php` | `mcpHealthBoard()` attaches a health check and puts the retro in `Writing` for "while collecting"; "shows only respondents between the health check and completion" becomes "shows the results of a health check closed before the retro is completed" (status `completed`); "never creates a participant when reading ROTI or health" also asserts that no respondent is created. |

- [ ] **Step 8: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros tests/Feature/Teams tests/Feature/TeamSurveys tests/Feature/Mcp tests/Feature/Integrations/ResultsEmailTest.php`
Expected: PASS, every case that Task 15 left red included.

Then: `grep -rn "health_check_answers\|retro_health_statements\|HealthCheckAnswer\|RetroHealthStatement\|healthCheckAnswers\|healthStatements()" app --include=*.php` shows only `app/Support/Surveys/ImportHealthChecks.php`, `VerifyHealthCheckImport.php`, the two old model files, the two relations of `Retro.php` and `FreezeHealthStatements.php`. Anything else is a reader this plan missed: stop and report it.

- [ ] **Step 9: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app tests
git commit -m "feat(health): summaries, trends, the board results and the MCP tool read team surveys, with the same numbers"
```

---

## Step C — the screens

Task 17 is done by a single writer on the main branch; the five lanes are cut from its head. Every screen task follows the "Screen task procedure" of plan 18e: read the README and the `preview.html` of the mockup first; build containers in `resources/js/components/surveys/` on `ui/` and `skrum/` components; page thin (layout and container); Vitest for logic; browser hooks (`data-test`, ids, English accessible names) listed in the task; captures in light and dark at 1440 and 390, in French and English, compared side by side with the mockup; every difference fixed or added to **Pre-build deviations** with the owner's word.

### Task 17: Front foundation — types, reducer, adapter, channel hook, shared component changes

**Files:**
- Create: `resources/js/lib/surveys/types.ts`, `survey-reducer.ts`, `survey-reducer.test.ts`, `question-adapter.ts`, `question-adapter.test.ts`, `api.ts`
- Create: `resources/js/hooks/use-survey-channel.ts`, `resources/js/hooks/use-team-survey.ts`
- Modify (each in its own commit): `resources/js/components/skrum/survey-question.tsx` (+ test, + `pages/dev/sections/survey-question.tsx`), `resources/js/components/skrum/guest-join.tsx` (+ test), `resources/js/components/skrum/session-card.tsx` (+ test, only if the kind `survey` is missing)
- Test: the two `.test.ts` files above and the component tests

**Interfaces:**
- Consumes: the snapshot of Tasks 3, 9, 10, 11; `retroRequest` and `RetroRequestError` of `@/lib/retro/api`; the Wayfinder actions of `@/actions/App/Http/Controllers/TeamSurveys/*` (run `npm run build:front` first); `useSafeConnectionStatus` of `hooks/use-retro-channel`.
- Produces: the types below; `surveyReducer(state: SurveySnapshot, action: SurveyAction): SurveySnapshot`; `toQuestionProps(question, options): SurveyQuestionProps`; `surveyApi` (one function per route); `useSurveyChannel(surveyId, enabled, handlers)`; `useTeamSurvey(initial: SurveySnapshot): { snapshot, dispatch, refetch, online, realtime, connection, gone }`; on `SurveyQuestion`: props `scaleMax?: 5 | 10`, `comment?: string`, `onCommentChange?: (value: string) => void`, `chrome?: 'card' | 'none'`, `labelledBy?: string`, and in `results`: `mode?: number | null`, `segments?: { detractors: number; passives: number; promoters: number }`, `delta?: { value: number; against: string } | null`.

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
    it('maps a scale to the component kind, with its maximum, its ends and the viewer answer', () => {
        const props = toQuestionProps(
            {
                ...base,
                scaleMax: 10,
                myAnswer: { value: 7, optionIds: [], text: null, comment: 'ok' },
            },
            { mode: 'answer', index: 2, count: 5 },
        );

        expect(props.kind).toBe('scale5');
        expect(props.scaleMax).toBe(10);
        expect(props.scaleLabels).toEqual(['Unbearable', 'Very comfortable']);
        expect(props.value).toBe(7);
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
        scaleMax: question.scaleMax === 10 ? 10 : 5,
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
| `scaleMax?: 5 \| 10` (default 5) | the scale renders 1 to `scaleMax`; ten values wrap on two rows below `@sm` with 2.75rem targets; digits 1 to 9 pick their value and 0 picks 10 when `scaleMax` is 10 | ten radios; pressing `0` selects 10; with 5, pressing `7` does nothing |
| `comment?: string`, `onCommentChange?` | for `scale5` and `nps` in answer mode, when `onCommentChange` is given: a labelled textarea "Why this score? (optional)", 500 characters, under the scale | typing calls `onCommentChange`; absent without the handler |
| `chrome?: 'card' \| 'none'` (default `card`), `labelledBy?: string` | `none` renders the control and its helper lines only: no card, no header, no footer; the group is named by `labelledBy` | no `article`; the radiogroup has `aria-labelledby` |
| `results.mode?: number \| null` | a second key figure "most frequent answer" beside the mean | shown for a scale, absent when null |
| `results.segments?` | NPS: the stacked bar detractors / passives / promoters with its percentages, `role="img"` and a written `aria-label`, and the three-count legend, above the distribution | the label reads "2 detractors, 3 passives, 4 promoters" |
| `results.delta?: { value: number; against: string } \| null` | a badge beside the key figure: "+11 vs Sprint 41", success tone when positive, destructive tone with the `trending-down` icon when negative, neutral "no change" at 0; never colour alone | the three wordings |

No existing prop changes meaning; `Plan08c` binds this component through the retro container and must stay green.

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

- `skrum/guest-join.tsx`: `GuestJoinSessionKind` gains `'survey'` (icon `ChartColumn`, tone `bg-skrum-col-iris text-skrum-col-iris-text`, label `t('Survey')`); `components/session/guest-join-page.tsx` accepts it.
- `skrum/session-card.tsx`: check that `kind` accepts `'survey'` with the iris square and `ChartColumn`; add it if not.
- `components/teams/use-team-anchor.ts` and the sidebar model: the anchor `#surveys` belongs to the "Sessions" entry.

- [ ] **Step 7: Gates and commits**

Run: `npm run test`, `npm run types:check`, `npm run check`, `npm run build:front` — Expected: PASS.

```bash
git add resources/js/components/skrum/survey-question.tsx resources/js/components/skrum/survey-question.test.tsx resources/js/pages/dev/sections/survey-question.tsx lang
git commit -m "feat(skrum): SurveyQuestion — scale of ten, optional comment, bare chrome, NPS segments, most frequent answer, delta badge"
git add resources/js/components/skrum/guest-join.tsx resources/js/components/skrum/guest-join.test.tsx resources/js/components/skrum/session-card.tsx resources/js/components/skrum/session-card.test.tsx resources/js/components/session resources/js/components/teams/use-team-anchor.ts
git commit -m "feat(skrum): the survey kind on the guest-join card, the session card and the Sessions anchor"
git add resources/js/lib/surveys resources/js/hooks/use-survey-channel.ts resources/js/hooks/use-team-survey.ts
git commit -m "feat(surveys): front types, reducer, question adapter, API and channel hook"
```

### Task 18 (lane Create): The Poll type in the "New session" dialog

**Mockup:** `ScreenSessionCreate` (the tile, the dialog frame, the footer), `SessionTypePicker` (tile content). The Poll variant of the form is P19-13.

**Files:**
- Create: `resources/js/components/teams/session-create/survey-session-fields.tsx` (+ `.test.tsx`)
- Modify: `resources/js/components/skrum/session-type-picker.tsx` (+ test), `resources/js/components/teams/session-create/new-session-dialog.tsx` (+ test), `use-new-session-intent.ts` (+ test), `resources/js/components/teams/team-page.tsx`, `resources/js/types/workspaces.ts`, `resources/js/pages/dev/sections/session-type-picker.tsx`
- Browser test changed: `tests/Browser/Walkthroughs/Plan18eSessionCreateTest.php` — the case that asserts four types and no Poll now asserts five, in order (spec criterion 1; parent criterion 15 is superseded)

**Interfaces:**
- Consumes: props of `teams/show` from Task 13 (`surveys: TeamSurveySummary[]`, `canCreateSurvey: boolean`, `surveyTemplates: SurveyTemplateOption[]`); `TeamSurveysController.store` (Wayfinder); `setting-row.tsx`, `field-error.tsx`.
- Produces: the dialog opens on `?new=survey`, with `&template=health_check|team_pulse` preselecting the template.

- [ ] **Step 1: Tile (own commit).** In `session-type-picker.tsx` the `survey` option reads `t('Poll')`, `t('Quick vote or health check')`, `t('5–10 min')`; the inline description of the dialog (the `descriptions` record of `new-session-dialog.tsx`) is `t('Quick vote')`. Update `session-type-picker.test.tsx` and the dev bench section. The key stays `survey`.
- [ ] **Step 2: Failing Vitest.** `survey-session-fields.test.tsx`: (a) the default choice is "Blank" and the body is `{ title, guest_access_enabled: false }` without `template`; (b) choosing "Health check" sends `template: 'health_check'` and shows "6 statements · scored 1 to 10" from `questionCount`; (c) choosing "A previous survey" reveals `#new-survey-source` listing the surveys that are not drafts, and sends `source_survey_id` and no `template`; (d) with no such survey that tile is disabled with "No survey to start from yet"; (e) the title is prefilled with the chosen template's name and today's short date, and is not overwritten once the user has typed; (f) a server error on `title` shows under the field. `new-session-dialog.test.tsx`: five tiles in the order Retro, Poker, Whiteboard, Poll, Icebreaker; the Poll tile is `aria-disabled` with its reason when `canCreateSurvey` is false. `use-new-session-intent.test.ts`: `?new=survey&template=health_check` yields `{ type: 'survey', template: 'health_check' }`; an unknown template is dropped.
- [ ] **Step 3: Build.** `SurveySessionFields`: `Name` (`#new-survey-title`, `ui/input`, 120 characters); `Start from` (`role="radiogroup"`, `aria-labelledby`, one tile per `surveyTemplates` entry plus "A previous survey", composed as the retro template shortcut tiles: title, one line, a `Badge variant="outline"` "Built-in" on the health check); the select `#new-survey-source` (`ui/select`, labels truncated); the settings row "Allow guests without an account" (`#new-survey-guests`, `ui/switch`, through `setting-row.tsx`). Submission through Inertia's `useForm` to `TeamSurveysController.store`, as `whiteboard-session-fields.tsx` does. `new-session-dialog.tsx`: `'survey'` joins `typeOrder` between `whiteboard` and `icebreaker`; its form is registered like the others; the footer shows "Cancel" and "Create & open". `use-new-session-intent.ts`: `SessionType` and `IntentTypes` gain `'survey'`.
- [ ] **Step 4: Browser hooks.** Ids `#new-survey-title`, `#new-survey-source`, `#new-survey-guests`; radio names "Blank", "Health check", "Team pulse", "A previous survey"; the tile "Poll".
- [ ] **Step 5: Gates, captures, commit.** `npm run test`, `npm run types:check`, `npm run check`, `npm run build:front`. Captures of the dialog on the Poll type at 1440 and 390, both themes, beside `ScreenSessionCreate/preview.html`.

```bash
git commit -m "feat(session-create): the Poll type — blank, health check, team pulse or a previous survey"
```

### Task 19 (lane Create): The Surveys section of the team page

**Mockup:** `ScreenTeam` (section pattern, session cards), `EmptyState` (module survey), `Card/README.md` (`SessionCard`).

**Files:**
- Create: `resources/js/components/teams/team-surveys-section.tsx` (+ `.test.tsx`)
- Modify: `resources/js/components/teams/team-page.tsx` (+ test), `resources/js/pages/dev/sections/team.tsx`
- Browser test changed: none (a new section; `Plan18eTeamPageTest` selectors are scoped by section)

**Interfaces:**
- Consumes: `surveys`, `canCreateSurvey`; `TeamSurveyDuplicatesController.store`, `TeamSurveysController.destroy`; `team-section.tsx`, `section-actions-menu.tsx`, `skrum/session-card`, `skrum/empty-state`, `skrum/confirm-dialog`.

- [ ] **Step 1: Failing Vitest.** (a) one `SessionCard` per survey, kind survey, with its title, a status badge ("Draft", "Open", "Closed"), "n answers · n questions" and a link to `url`; (b) the card menu holds "Duplicate" for everyone who may create, and "Delete" only when `canManage`; (c) "Delete" opens a destructive `ConfirmDialog` ("Delete this survey?" — "Its questions and answers are deleted too.") and calls the route on confirm; (d) with no survey the `EmptyState` of the module survey shows "No survey published yet" and the action "Create a survey", which opens the dialog on the Poll type; the action is absent when `canCreateSurvey` is false; (e) the section has `id="surveys"` and the heading "Surveys".
- [ ] **Step 2: Build**, modelled line for line on `team-whiteboards-section.tsx`: `TeamSection` with the heading, the grid `grid-cols-[repeat(auto-fill,minmax(min(100%,--spacing(72)),1fr))]`, the cards, the empty state. Duplicate is an Inertia `router.post`; delete goes through `lib/delete-visit.ts` like the other sections, then reloads the `surveys` prop only. Mounted in `team-page.tsx` after the whiteboards section.
- [ ] **Step 3: Browser hooks.** `section#surveys`; card `data-test="survey-card"`; menu button "Survey actions"; items "Duplicate", "Delete".
- [ ] **Step 4: Gates, captures (team page at 1440 and 390, both themes, with and without surveys), commit.**

```bash
git commit -m "feat(team): the Surveys section, its cards and its empty state"
```

### Task 20 (lane Build): The builder — `surveys/edit`

**Mockup:** `ScreenSurvey` frame a. Deviations P19-01 to P19-06.

**Files:**
- Create: `resources/js/pages/surveys/edit.tsx`; `resources/js/components/surveys/survey-builder.tsx`, `builder-topbar.tsx`, `builder-question-list.tsx`, `builder-question-card.tsx`, `builder-options-editor.tsx`, `builder-add-bar.tsx`, `builder-settings-panel.tsx`, `survey-preview-dialog.tsx`; `resources/js/lib/surveys/builder-state.ts`; each with its `.test.ts(x)`
- Browser test: new cases in Task 31

**Interfaces:**
- Consumes: `useTeamSurvey`, `surveyApi`, `surveyReducer`, `toQuestionProps` (Task 17); `@dnd-kit/core`, `@dnd-kit/sortable` as `retro-columns-editor.tsx` uses them; `layouts/skrum/app-layout`.
- Produces: `useAutosave` and `questionBody` of `builder-state.ts`; `SurveyPreviewDialog` (also used by nothing else: the participant flow it renders is the component of Task 21 — see the dependency note).

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
| `builder-topbar.tsx` | badge of the status; "Saved :time ago" / "Saving…" / "Not saved" (`role="status"`); "Preview"; "Publish" (draft), "Back to draft" (open, no answer), "View results" (open or closed) | "Publish" flushes pending saves first, is disabled without a question, and shows the server's message on 422 | buttons "Preview", "Publish", "Back to draft" |
| `survey-builder.tsx` | title `h1` editable in place (`#survey-title`), "n questions", list, add bar, alert, settings panel at 21.25rem (a `Sheet` opened by a "Settings" button below `lg`) | owns `useTeamSurvey` and `useAutosave`; warns on `beforeunload` while a save is pending or failed | `data-realtime` on the root, as every live screen |
| `builder-question-list.tsx` | the sortable list: handle, number, and collapsed or open card | pointer and keyboard reorder with the announcements of `retro-columns-editor.tsx`; on drop: optimistic `question.reorder`, then `reorderQuestions`; on failure the server order comes back with a toast | `ol > li`; handle "Reorder question :number" |
| `builder-question-card.tsx` | collapsed: number, label (truncate), "n options", kind badge with its icon (`gauge`, `chart-bar`, `circle-dot`, `square-check`, `text-cursor-input`), "Required" badge. Open (selected): kind select `#question-kind-{id}`, "Required" switch, Duplicate, Delete, label `#question-label-{id}`, then by kind | selecting a row opens it and closes the previous one; a change of kind goes through `withKind`; Delete asks for confirmation only when the question has a label the user typed | `section[aria-label="Question :number"]`, `data-test="survey-question"`; buttons "Duplicate", "Delete"; switch "Required" |
| by kind | scale: "Label of 1", "Label of 5" and a disabled preview of the scale; NPS: the fixed ends "Not at all likely" / "Extremely likely" shown as text; choices: `builder-options-editor.tsx`; text: "500 characters max" | — | `#scale-min-{id}`, `#scale-max-{id}` |
| `builder-options-editor.tsx` | one input per option, remove button, "Add option" | 2 to 10; remove disabled at 2, add at 10; Enter in the last input adds one | `[aria-label="Option :number"]`, "Remove option :number", "Add option" |
| `builder-add-bar.tsx` | dashed bar "Add" and five chips | a click posts the question with `t('Untitled question')` (and two options "Option 1", "Option 2" for a choice), selects it and focuses its label | group "Add a question"; buttons "Scale 1 – 5", "NPS", "Single choice", "Multiple choice", "Free text"; all disabled at 30 questions with the reason |
| `builder-settings-panel.tsx` | "Settings"; the line "Answers are anonymous" (P19-01); three switches: "One question at a time" (help "Recommended on a phone"), "Show results after answering", "Allow guests without an account"; the places of P19-02 and P19-03 left empty | each switch saves at once through `surveyApi.update` | `#survey-one-at-a-time`, `#survey-results-after`, `#survey-guests` |
| alert | P19-04 | "A result is shown from :count answers, and free answers are sorted before they are shown." or, without a threshold, the second half alone | — |
| locked template | health check: the list is read-only (no handle, no menu, no add bar) under an info alert "The questions of a health check come from the team's statements." with the link "Manage statements" to the health-check page | settings and title stay editable | — |
| open or closed survey | the list is read-only under "Questions cannot change once a survey is open." | — | — |

- [ ] **Step 3: States to cover in tests and captures:** empty draft; five questions with the first open (the mockup's frame); a choice question open; dragging; saving, saved, not saved; health check (locked); open survey; closed survey; 390 px with the settings sheet open.
- [ ] **Step 4: Gates, captures beside `ScreenSurvey/preview.html` frame a, commit.**

```bash
git commit -m "feat(surveys): the builder — questions of five kinds, reorder, duplicate, required, settings, autosave"
```

### Task 21 (lane Answer): The participant page — `surveys/show`

**Mockup:** `ScreenSurvey` frame b; `MobileRituals` (survey phone frame). Deviations P19-07, P19-08.

**Files:**
- Create: `resources/js/pages/surveys/show.tsx`; `resources/js/components/surveys/survey-room.tsx`, `survey-frame.tsx`, `survey-answer-flow.tsx`, `survey-answer-list.tsx`, `survey-progress.tsx`, `survey-thanks.tsx`, `survey-closed.tsx`; `resources/js/lib/surveys/answer-flow.ts`; each with its `.test.ts(x)`

**Interfaces:**
- Consumes: `useTeamSurvey`, `surveyApi`, `toQuestionProps`, `answerOf` (Task 17); `SurveyQuestion` with `chrome="none"`; the reconnecting and expired banners of `components/session/` (the pieces `SessionShell` composes; read `session-shell.tsx` and reuse them without the sidebar).
- Produces: `SurveyAnswerFlow` with the props `{ questions, onSave, onFinish, preview?: boolean }`, used by the builder's preview.

- [ ] **Step 1: `answer-flow.ts`, test first.** Pure functions: `firstUnanswered(questions): number` (index of the first question without an answer, else the last); `missingRequired(questions): string[]`; `stepOf(serverErrors: Record<string, string[]>, questions): number | null` (the index of the first question named by a `questions.{id}` error of `surveys.submission.store`); `digitValue(key: string, question): number | null` (scale of 5: `1`–`5`; scale of 10: `1`–`9` and `0` for 10; NPS: `0`–`9`; anything else null). Tests for each, including a scale of 5 ignoring `7` and an NPS mapping `0` to 0.
- [ ] **Step 2: Failing component tests**, then build:

| Part | Content | Behaviour |
|---|---|---|
| `show.tsx` | no `AppLayout`: renders `SurveyRoom` | — |
| `survey-frame.tsx` | header: brand logo (links to `links.team` for a member, to nothing for a guest), title, "· team" for a member, badge "Anonymous answers" (`venetian-mask`), the viewer's avatar; the connection banner under it; `main` centred | exactly one `[data-realtime]`; lost connection shows the banner with "Your answers are saved as you give them; the counter is paused."; expired session shows "Reload" over inert content |
| `survey-room.tsx` | chooses the view from the snapshot | open and not finished: the flow or the list, by `oneQuestionAtATime`; finished: thanks, then results when `me.canSeeResults`; closed: `SurveyClosed`; `gone`: "This survey was deleted." with a link back; an editor also gets the links "Results" and, in a draft that just reopened, "Edit" |
| `survey-answer-flow.tsx` | frame b: "Question n of N", `SurveyProgress`, a card of 47.5rem at most with the kind badge, the question as `h2` in the display font, its description, `SurveyQuestion chrome="none"`, the optional comment, "Previous" (ghost), the keyboard hint, "Next" (large; "Finish" on the last) and the privacy line | starts on `firstUnanswered`; a scale, NPS or single choice is saved the moment it is picked; a multiple choice, a text and a comment are saved 600 ms after the last change and when leaving the step; "Next" on a required question without an answer does not move and shows "An answer is required" (`aria-invalid`, focus on the control); "Finish" flushes, calls `submit`, and on 422 goes to `stepOf`; a failed save keeps the value on screen with "Not saved — retry"; digits follow `digitValue`, Enter goes on, both ignored while a text field has the focus and when the user turned single-key shortcuts off (the preference of plan 18f; read `hooks/use-shortcut.ts`); the hint line shows the real keys of the question; focus moves to the question's heading on each step |
| phone | below `md`: the card is full width and unframed, NPS and a scale of ten on two rows with 2.75rem targets, "Previous" as an icon button and "Next" filling the row in a footer docked at the bottom with the safe-area inset | the docked footer never covers the comment field: the scroll area has the footer's height as bottom padding |
| `survey-progress.tsx` | the mockup's segments up to twelve questions, a `Progress` bar with "Question n of N" and the percentage above twelve | `aria-hidden` on the segments; the text carries the information |
| `survey-answer-list.tsx` | setting off: every question as a `SurveyQuestion` card (`index`, `count`), one "Finish" button under the list | same saving rules; "Finish" scrolls to the first required question left empty |
| `survey-thanks.tsx` | "Thank you — your answers are saved.", "n of m have answered", "Change my answers" while open, and under it the results (the Summary of Task 23, mounted by the controller at merge; until then "Results will show when the survey is closed" or nothing) | "Change my answers" calls `reopenResponse` and returns to the first question |
| `survey-closed.tsx` | "This survey is closed.", the closing date, and the results link | — |
| preview mode | `SurveyAnswerFlow preview`: no request, a local answers map, "Finish" closes the dialog | — |

- [ ] **Step 3: Browser hooks.** `main[aria-label="Survey"]`; heading of the current question; `[data-test="survey-step"]` with `data-step`; buttons "Previous", "Next", "Finish", "Change my answers"; the radiogroup named by the question; text field named by the question; comment field "Why this score? (optional)".
- [ ] **Step 4: States in tests and captures:** each of the five kinds as the current step; required error; not saved; finished without results; finished with results; closed; reconnecting; 390 px for a scale of 5, an NPS and a text.
- [ ] **Step 5: Gates, captures beside frame b and the phone frame, commit.**

```bash
git commit -m "feat(surveys): the participant page — one question at a time or all at once, saved as answered, phone layout"
```

### Task 22 (lane Answer): Guest join and the Share dialog

**Mockup:** `GuestJoin`, `ShareDialog`.

**Files:**
- Create: `resources/js/pages/surveys/join.tsx` (+ `join.test.tsx`), `resources/js/components/surveys/survey-share.tsx` (+ test)
- Browser test: new cases in Task 31

- [ ] **Step 1: Join page**, a copy of `pages/whiteboards/join.tsx` on `GuestJoinPage` with `kind="survey"`, the props of Task 6 (`isInvalid`, `guestToken`, `surveyTitle`, `session`, `suggestedName`), `storeUrl` from `TeamSurveyJoinsController.store`, the invalid title `t('This survey link is no longer valid')`. Test: the summary shows the title, the facilitator, the number of people and "Live" only while `session.isLive`; the invalid state renders without a form; the suggested nickname is prefilled (D-51).
- [ ] **Step 2: Share**, a copy of `components/whiteboard/board-share.tsx`: `ShareDialog` with `session.kind = 'survey'`, `invite = { url: guestUrl, allowGuests }`, `canManage = me.isEditor`; `onChange({ allowGuests })` calls `surveyApi.update(id, { guest_access_enabled })`; `onRegenerate` calls `surveyApi.newGuestLink` after the dialog's own confirmation and stores the new URL; a member who is not an editor sees the link and no control; a guest has no Share button. Exported as `<SurveyShare snapshot dispatch />` with its trigger button ("Share", icon `share-2`), mounted by the builder topbar (once the survey is open), the participant frame (editors) and the results header (Task 23) — the three mounts are one line each, added by the controller at merge when the lanes meet.
- [ ] **Step 3: Gates, captures (join page at 1440 and 390, valid and invalid; the dialog), commit.**

```bash
git commit -m "feat(surveys): guest join page and Share dialog of a survey"
```

### Task 23 (lane Results): Results, live and closed — `surveys/results`

**Mockup:** `ScreenSurvey` frame c. Deviations P19-09 to P19-12.

**Files:**
- Create: `resources/js/pages/surveys/results.tsx`; `resources/js/components/surveys/survey-results.tsx`, `results-header.tsx`, `results-summary.tsx`, `results-free-text.tsx`, `results-states.tsx`; each with its `.test.tsx`

**Interfaces:**
- Consumes: `useTeamSurvey`, `surveyApi`, `toQuestionProps` (Task 17); `SurveyQuestion mode="results"`; `ui/tabs`, `skrum/confirm-dialog`, `skrum/skeletons`; `TeamSurveyExportsController.show`.
- Produces: `ResultsSummary` with the props `{ snapshot, deltas?: Record<string, { value: number; against: string }> }`, reused by the thank-you state of Task 21 and fed with deltas by Task 24.

- [ ] **Step 1: Failing tests**, then build:

| Part | Content (frame c) | Behaviour |
|---|---|---|
| `results.tsx` | `AppLayout active="sessions"`, breadcrumbs as the builder | a guest gets the minimal frame of Task 21 instead of `AppLayout` (the sidebar belongs to members); the controller wires `SurveyFrame` at merge, and until then this lane renders a bare `main` for guests |
| `results-header.tsx` | topbar: status badge ("Open" with a live dot, "Closed" with `check`), and at the end "Export CSV" (outline, `file-down`; editor and closed only; a plain link to the export route), "Share" (Task 22's trigger, mounted at merge), and for an editor "Close" (confirm: "Close the survey?" — "People can no longer answer. You can reopen it.") or "Reopen" | "Close" and "Reopen" call `setStatus`; the header line reads ":responses answers out of :audience members · anonymous" and, once closed, "· closed on :date" (`Intl.DateTimeFormat`); for a survey attached to a retro, "participants" replaces "members" and a link leads to the retro |
| tabs | "Summary", "Free-text answers", "Compare" (`ui/tabs`, the tab in `?tab=`) | "Free-text answers" is absent when no question is a text or takes comments; "Compare" is absent for a guest |
| `results-summary.tsx` | grid `grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(88)),1fr))]`; one `SurveyQuestion mode="results"` per question with `index` and `count` ("Q1 · Scale 1 – 5"); a text question spans two columns from `lg` | the cards update when the snapshot does; a question nobody answered shows "No answers yet." |
| text card | the first six answers as tinted cards (the eight column tones in rotation, by index), then "See the :count answers", which switches to the second tab | the viewer's own answer is marked "Your answer" |
| `results-free-text.tsx` | per question: its label, then every text answer; per scale or NPS question with comments: its label, then the comments | sorted as the server sent them |
| `results-states.tsx` | below the threshold: "Results appear from :threshold answers. :responses so far." with the progress of answers; not visible yet: "Results will show when the survey is closed." (setting off) or "Answer the survey to see the results." with a link to it (setting on, not finished); no answer: the empty state; loading: the skeleton variant of the cards | each is a `role="status"` region |

- [ ] **Step 2: Live.** With two renders of the container fed by a mocked channel: an event `survey.responses.changed` moves the header count at once; a viewer with `canSeeResults` refetches after one second and the cards change; a viewer without it does not refetch; `survey.changed` with status `closed` swaps the badge and shows "Export CSV" to an editor.
- [ ] **Step 3: Browser hooks.** `main` named "Results"; cards `article[aria-label=<question label>]` (the rest props added to `SurveyQuestion` by plan 18e, G4); `[data-slot="survey-result-bar"]`; tabs "Summary", "Free-text answers", "Compare"; buttons "Export CSV", "Close", "Reopen".
- [ ] **Step 4: States in tests and captures:** nine answers on the five kinds (the mockup's data: mean 3.8, NPS +22, "5 · 56%", "6 · 67%", seven texts); open and live; below the threshold; member who may not see yet; closed; 390 px (one column).
- [ ] **Step 5: Gates, captures beside frame c, commit.**

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

- [ ] **Step 2: Failing component test**, then build `results-compare.tsx`: a select "Compare with" (`#survey-compare-with`, the surveys of `comparable`, the default selected, each option "title · closing date"); a request to `surveyApi.comparison(id, withId)` on change, with a skeleton while it loads and an error state with "Retry"; then one row per pair: the question's label, the kind badge, "now" and "before" values, and the written difference (`signed`, with "points" for NPS and percentage points for a choice, one line per option; a text shows the two numbers of answers); "Only in this survey" and "Only in :title" list the unmatched questions; "Nothing to compare with yet." when `comparable.surveys` is empty; "The other survey does not have enough answers." when `belowThreshold`. A difference is never colour alone: the sign and the word ("higher", "lower", "no change") are in the text.
- [ ] **Step 3: Badges.** `survey-results.tsx` loads the default comparison once when `comparable.defaultId` is set and passes `deltasByQuestion(...)` to `ResultsSummary`, which hands each to `toQuestionProps` → `results.delta`.
- [ ] **Step 4: CSV.** Already a link in the header (Task 23); here its test: present only for an editor of a closed survey at or above the threshold, `download` attribute absent (the server names the file), `href` is the export route.
- [ ] **Step 5: Gates, captures (Compare tab at 1440 and 390; a Summary with badges), commit.**

```bash
git commit -m "feat(surveys): compare a survey with a previous one, with the differences on the summary cards"
```

### Task 25 (lane Health): The health check in a retro, without a phase

**Mockup:** `HealthCheck` (form and results), `SessionSettingsPopover` ("Add survey" menu), `ScreenSessionCreate` (the "Health check" row). Deviations P19-15, P19-16, P19-17. **P19-16 is put to the owner before this task starts.**

**Files:**
- Create: `resources/js/components/retro/health-check-button.tsx`, `health-check-dialog.tsx` (+ tests)
- Modify: `resources/js/components/skrum/session-settings-popover.tsx` (+ test, own commit), the retro container and header written by plan 18e (read `components/retro/` and `components/session/session-shell.tsx` for their current names), `resources/js/lib/retro/types.ts`, `resources/js/lib/retro/board-reducer.ts` (+ test), `resources/js/components/teams/session-create/retro-session-fields.tsx`
- Browser tests changed: `Plan08cSurveysTest` and `Plan08eLlmTest` — after `click('Add survey')`, one more `click('Quick poll')`; nothing else in those files. `Plan08bHealthCheckTest` is rewritten in Task 31.

**Interfaces:**
- Consumes: the snapshot key `healthCheck` of Tasks 15 and 16 (`surveyId`, `isClosed`, `respondents`, `participants`, `statements`, `results`); the routes `retros.health-check.update|destroy` (unchanged), `retros.healthCheck.store|destroy`, `retros.healthCheck.closure.update|destroy`; the reducer actions `health.progress` and `health.answer` (unchanged); `skrum/health-check-form`, `skrum/health-check-results`.

- [ ] **Step 1: Types and reducer.** `HealthCheckState` gains `surveyId: string`, `isClosed: boolean`, `respondents: number`, `participants: number`, `results: HealthResults | null`. `health.progress` also recomputes nothing: `respondents` comes with the next snapshot (the event does not carry it); the button's count is `statements` with a `myScore` over `statements.length` for "my progress" and `respondents`/`participants` for the team. Reducer test: a `health.progress` event leaves `surveyId`, `isClosed` and `results` untouched.
- [ ] **Step 2: `SessionSettingsPopover` (own commit).** As its README: `onAddSurvey?: (kind: 'health_check' | 'quick_poll') => void` and `surveys?: { healthCheckStatements: number; healthCheckAttached: boolean }`. The button "Add survey" (`clipboard-list`, `chevron-down`) opens a `DropdownMenu` of `w-80` with "Health check" (badge "Built-in", description ":count statements"; when attached: "Health check added", disabled) and "Quick poll" (description "One question, answered on the board"). The note of the mockup and "From a template…" are not rendered (P19-15). Vitest: the two items, the attached state, hidden when `readOnly`.
- [ ] **Step 3: Failing tests, then the button and the dialog.**

| Part | Content | Behaviour |
|---|---|---|
| `health-check-button.tsx` | in the header actions, before Share: `HeartPulse`, "Health check", and ":answered/:total" in mono; on a phone the icon and the count only | rendered when `healthCheck !== null`; accessible name "Health check, :answered of :total answered"; a dot marks it while the viewer has statements left and the health check is open |
| `health-check-dialog.tsx` | `Dialog` from `md`, `Drawer` below; title "Health check · :retro" | open: `HealthCheckForm` (scale 10, the anonymous badge on an anonymous retro, who answered otherwise, the viewer's scores, progress), each score saved through `retros.health-check.update` and cleared through `.destroy`, optimistic with `health.answer`; closed: `HealthCheckResults` fed by `healthCheck.results` (averages, `previousAverage`, summary), or "No answers." |
| facilitator footer | open: "Close the health check" (confirm: "Everyone will see the results."), "Remove" (confirm; with answers: "Its answers are kept and come back if you add it again."; without: "It has no answer yet."); closed: "Reopen" | the four routes; errors as toasts; the dialog stays open after closing so that the results show |
| locked board, completed retro | the form is read-only with the reason | — |
| digits | while the dialog is open, digits go to the focused statement and not to reactions (parent spec ruling 21) | test with the reaction shortcut mounted |

- [ ] **Step 4: Wiring.** The retro container passes `onAddSurvey={(kind) => kind === 'quick_poll' ? surveyEditor.openCreate() : attachHealthCheck()}` under the same conditions as today for the quick poll, and for the health check whenever the viewer is the facilitator and the retro is open; `surveys` from the team's statement count (a new field of the board snapshot: add `healthCheckStatements: int` to `retro` in `BuildBoardSnapshot`, from `HealthCheckQuestions::handle($retro->team)`, with its assertion in `BoardSnapshotTest`). `retro-session-fields.tsx`: the row "Health check" keeps its switch and its field; its help becomes `t('The team rates its statements during the retro')`.
- [ ] **Step 5: Browser hooks.** Button "Health check"; dialog title; the existing hooks of `HealthCheckForm` (fieldsets by statement, radios 1 to 10); buttons "Close the health check", "Reopen", "Remove"; menu items "Health check", "Quick poll".
- [ ] **Step 6: Gates, captures (retro in Writing and in ROTI with the dialog open and closed, 1440 and 390, both themes), commits.**

```bash
git commit -m "feat(skrum): SessionSettingsPopover — the Add survey menu (health check, quick poll)"
git commit -m "feat(retro): the health check as an attached survey, answered from the header in any open phase"
```

### Task 26 (lane Health): The health-check page — start one, and a trend that counts surveys

**Files:**
- Modify: `resources/js/components/teams/team-health-check-page.tsx` (+ test), `team-health-card.tsx` (+ test), `resources/js/lib/teams/mood-adapter.ts` (+ test), `resources/js/types/workspaces.ts`

- [ ] **Step 1: Adapter, test first.** A point's key is `surveyId ?? retroId`; a point without a retro links to its `url` (the survey's results); the label of a point is its `title` in both cases. Tests: two points of the same date, one retro and one survey, keep distinct keys; a survey point renders its link.
- [ ] **Step 2: Page.** A primary button "Start a health check" in the page header, an Inertia `Link` to the team page with `?new=survey&template=health_check`, shown when the viewer may create a survey (the page receives `canCreateSurvey`: add it to `TeamHealthChecksController@show` with its assertion in the controller's test). The trend's table view gains a "Kind" column ("Retro", "Survey").
- [ ] **Step 3: Card.** The sentence of the compact card reads `t(':count statements, scored 1 to 10, asked in every health check')`; test updated.
- [ ] **Step 4: Gates, captures (the page at 1440 and 390, with a trend mixing both kinds), commit.**

```bash
git commit -m "feat(team): start a health check from its page; the mood trend counts health checks run as surveys"
```

---

## Step D — the phase goes

Tasks 27 to 29 run on the main branch after every lane is merged. Task 27 always runs its tests.

### Task 27: Remove the health-check phase — back end

**Files:**
- Create: `database/migrations/2026_10_19_100200_move_retros_out_of_the_health_check_phase.php`
- Modify: `app/Enums/RetroPhase.php`, `app/Models/Retro.php`, `app/Http/Controllers/Retros/ColumnsController.php`, `ColumnOrdersController.php`, `RetroSettingsController.php`, `app/Actions/Retros/BuildBoardSnapshot.php`, `database/factories/RetroFactory.php`, `app/Mcp/Servers/SkrumServer.php`, `app/Mcp/Prompts/TeamHealth.php`, `AnalyzeRetro.php`
- Test: `tests/Feature/Retros/HealthPhaseRemovalTest.php`; edited: every test that names `RetroPhase::HealthCheck` or `'health_check'` as a phase (list below)

**Interfaces:**
- Consumes: `ImportHealthChecks::handle` (run again, so that an answer written to the old tables after the first run is not left behind), `AttachHealthCheck`.
- Produces: `RetroPhase` without `HealthCheck`; `Retro::phases()` = Icebreaker (when enabled), Writing, Grouping, Voting, Discussing, Actions, Roti, Completed; the board snapshot without `retro.healthCheckEnabled`; `RetroFactory::withHealthCheck()` attaches a health check after creating.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Retros/HealthPhaseRemovalTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\Retro;
use Illuminate\Support\Facades\DB;

function runHealthPhaseMove(): void
{
    $migration = require database_path('migrations/2026_10_19_100200_move_retros_out_of_the_health_check_phase.php');

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

it('moves a retro out of the health-check phase: to the icebreaker when it has one, else to writing', function () {
    $plain = Retro::factory()->create();
    $withIcebreaker = Retro::factory()->create(['icebreaker_enabled' => true]);
    $elsewhere = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    DB::table('retros')->whereIn('id', [$plain->id, $withIcebreaker->id])->update(['phase' => 'health_check']);

    runHealthPhaseMove();

    expect($plain->fresh()->phase)->toBe(RetroPhase::Writing)
        ->and($withIcebreaker->fresh()->phase)->toBe(RetroPhase::Icebreaker)
        ->and($elsewhere->fresh()->phase)->toBe(RetroPhase::Voting);
});

it('opens a retro that was in the health-check phase, in another phase, with its answers and an open health check', function () {
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
        ->assertJsonPath('healthCheck.statements.0.key', 'vision')
        ->assertJsonPath('healthCheck.statements.0.myScore', 7);

    $this->actingAs($user)->putJson(route('retros.health-check.update', [$retro, 'vision']), ['score' => 9])->assertOk();
});

it('can run twice', function () {
    $retro = Retro::factory()->create();
    DB::table('retros')->where('id', $retro->id)->update(['phase' => 'health_check']);

    runHealthPhaseMove();
    runHealthPhaseMove();

    expect($retro->fresh()->phase)->toBe(RetroPhase::Writing);
});

it('gives the factory state a real health check', function () {
    $retro = Retro::factory()->withHealthCheck()->create();

    expect($retro->teamSurveys()->sole()->questions()->count())->toBe(6);
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

The last case relies on `EnsureIcebreakerRoom` being called by the board snapshot, as its docblock says ("or the first time a board snapshot needs it"). If it fails, the snapshot does not ensure the room: add the call to `BuildBoardSnapshot` for a retro in the `icebreaker` phase without a room, in this task.

- [ ] **Step 2: Run it and see it fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/HealthPhaseRemovalTest.php`
Expected: FAIL (the enum still has the case; the migration file does not exist).

- [ ] **Step 3: Migration**

`database/migrations/2026_10_19_100200_move_retros_out_of_the_health_check_phase.php`:

```php
<?php

use App\Support\Surveys\ImportHealthChecks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
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

- [ ] **Step 4: Enum, model, guards, snapshot, factory**

- `RetroPhase`: remove the case `HealthCheck`, its `label()` arm, and its entry in `hidingOthersCards()`.
- `Retro`: `phases()` filters `Icebreaker` only; remove `health_check_enabled` from the docblock, from `#[Fillable]` and from `casts()`. The relations `healthStatements()` and `healthCheckAnswers()` go in Task 29.
- `ColumnsController` (`RetroGuard::phase($retro, RetroPhase::HealthCheck, RetroPhase::Icebreaker, RetroPhase::Writing)`), `ColumnOrdersController` (twice), `RetroSettingsController` (`votes_per_participant`): remove `RetroPhase::HealthCheck` from each list.
- `BuildBoardSnapshot`: remove `'healthCheckEnabled' => $retro->health_check_enabled`.
- `TeamRetrosController` and `NewRetro`: unchanged (`health_check_enabled` is still the name of the creation field).
- `RetroFactory`:

```php
    public function withHealthCheck(): static
    {
        return $this->afterCreating(function (Retro $retro): void {
            resolve(AttachHealthCheck::class)->handle($retro);
        });
    }
```

- MCP: in `SkrumServer`, the sentence "moves through phases (health check, icebreaker, writing, grouping, voting, discussing, completed)" becomes "moves through phases (icebreaker, writing, grouping, voting, discussing, actions, ROTI, completed) and can carry a health check, a short survey the team answers during the board" (keep whatever plan 18e already wrote for `actions` and `ROTI`); in `TeamHealth` and `AnalyzeRetro`, replace "health check phase" wordings by "health check"; the prompt `team-health` says "its last six closed health checks" where it said "last six completed retrospectives" only for the health part.

- [ ] **Step 5: Tests that name the phase**

`grep -rn "HealthCheck\b\|health_check" tests --include=*.php | grep -v "health_check_enabled\|healthCheck\.\|health-check\|oldHealth"` lists them. For each:

| File | Change |
|---|---|
| `RetroModelTest.php` | the phase lists lose the health check; "the first phase is the health check when enabled" becomes "the first phase is the icebreaker when enabled, else writing" |
| `FacilitationTest.php` | moves from and to `health_check` go; "cannot turn the current phase off" keeps its icebreaker case only |
| `RetroGuardTest.php`, `ColumnsTest.php`, `GroupNamesTest.php`, `RotiTest.php`, `SurveysTest.php`, `SurveyDraftsTest.php`, `CreateRetroTest.php`, `BoardSnapshotTest.php`, `ReadPrivacyTest.php`, `MessagesAndSummaryTest.php` | each dataset row or `inPhase(RetroPhase::HealthCheck)` becomes `inPhase(RetroPhase::Writing)` (or loses the row when it only listed phases); `retro.healthCheckEnabled` assertions go |
| `Plan08aFlowAndTemplatesTest.php`, `Plan08dResultsTest.php`, `Plan18eTeamPageTest.php`, `TeamPageVisualTest.php` | listed here, edited in Task 31 with the browser run |

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros tests/Feature/Teams tests/Feature/TeamSurveys tests/Feature/Mcp tests/Arch`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app database tests
git commit -m "feat(retro): the health-check phase is gone; retros that were in it move on with their health check open"
```

### Task 28: Remove the health-check phase — front

**Files:**
- Modify: `resources/js/lib/retro/types.ts` (the phase union loses `health_check`; `retro.healthCheckEnabled` goes), the retro container, phase panel and stepper configuration written by plan 18e, `resources/js/components/skrum/phase-stepper.tsx` (+ test) only if it names the phase, `resources/js/components/skrum/session-settings-popover.tsx` (+ test) if it still carries a health-check toggle, `resources/js/pages/dev/sections/{phase-stepper,session-shell,session-settings-popover,health-check}.tsx`
- Delete: the health-check phase panel of the retro container (the file plan 18e wrote from `components/retro/health-check-panel.tsx`), once `health-check-dialog.tsx` of Task 25 is its only replacement

- [ ] **Step 1:** `grep -rn "health_check\|healthCheckEnabled\|HealthCheckPanel" resources/js` and remove every use that is a phase: the stepper step, the phase panel branch, the "first phase" copy, the settings toggle. Keep `HealthCheckForm`, `HealthCheckResults`, the reducer actions `health.progress` and `health.answer`, the results section of the completed retro and the channel event `health.answered`.
- [ ] **Step 2:** Vitest: the stepper of a retro renders Writing to ROTI (and Icebreaker first when enabled) and no "Health check" step; the board reducer ignores nothing it handled before; the dev bench sections compile.
- [ ] **Step 3:** `npm run test`, `npm run types:check`, `npm run check`, `npm run build:front`. Captures of the retro stepper in Writing beside `ScreenRetroWriting/preview.html`: deviation D-03 of plan 18e is cleared.
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(retro): the stepper and the board without a health-check phase"
```

### Task 29: Delete the old health models, and prove nothing reads the old tables

**Files:**
- Delete: `app/Models/HealthCheckAnswer.php`, `app/Models/RetroHealthStatement.php`, `database/factories/HealthCheckAnswerFactory.php`, `database/factories/RetroHealthStatementFactory.php`, `app/Actions/HealthCheck/FreezeHealthStatements.php`, `app/Actions/HealthCheck/PresentHealthStatement.php` if nothing uses it any more (check `TeamsController`, `TeamHealthChecksController`, `PresentTeamHealthStatements`: it presents team statements too, in which case it stays, narrowed to `TeamHealthStatement|HealthStatement`)
- Modify: `app/Models/Retro.php` (relations `healthStatements`, `healthCheckAnswers` removed), `tests/Feature/Retros/HealthStatementModelsTest.php`
- Test: `tests/Feature/TeamSurveys/OldHealthTablesUnreadTest.php`

No table and no column is dropped (owner decision 7).

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
        ->filter(fn (SplFileInfo $file): bool => preg_match('/health_check_answers|retro_health_statements|\bHealthCheckAnswer\b|\bRetroHealthStatement\b|FreezeHealthStatements/', $file->getContents()) === 1)
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

Run: `vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys/OldHealthTablesUnreadTest.php` — Expected: FAIL on the first case, listing the four files to delete and `Models/Retro.php`.

- [ ] **Step 2:** Delete the files, remove the two relations of `Retro`. In `HealthStatementModelsTest.php`: "orders team and retro statements by position" keeps its team half; "stores one answer per participant and statement" and "removes a retro frozen set and its answers with the retro" are replaced, case for case, by "stores one answer per respondent and question" (already in `TeamSurveyModelTest`: remove the duplicate here and note it in the commit) and "removes an attached health check and its answers with the retro" (create a retro with `withHealthCheck()`, answer, delete the retro, assert no `team_surveys`, `team_survey_questions` or `team_survey_answers` row is left). The three cases about built-in statements and `TeamHealthStatement` are untouched.
- [ ] **Step 3:** Run: `vendor/bin/sail artisan test --compact tests/Feature tests/Arch` — Expected: PASS.
- [ ] **Step 4: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add -A app database tests
git commit -m "refactor(health): remove the models and the freeze action of the old health check; its tables stay, unread"
```

---

## Final

### Task 30: Translations

**Files:** `lang/en.json`, `lang/fr.json`, `lang/es.json`, `lang/de.json`; `tests/Feature/TranslationKeysTest.php` must pass.

Keys are added by the task that introduces them; this task is the review pass: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`, then one read of each language for term consistency ("Sondage" / "Encuesta" / "Umfrage"; "Bilan de santé" / "Chequeo de salud" / "Gesundheitscheck", as the files already translate "Health check"), register and length (no label of a button, tab or menu item may wrap). In `en.json` the value is the key. A key a task needs and that is not below gets its four values in that task's commit and is listed in the report.

Back end:

| Key | fr | es | de |
|---|---|---|---|
| Blank | Vierge | En blanco | Leer |
| Start with no question. | Commencer sans question. | Empezar sin preguntas. | Ohne Frage beginnen. |
| The team's statements, scored 1 to 10. | Les énoncés de l'équipe, notés de 1 à 10. | Los enunciados del equipo, puntuados de 1 a 10. | Die Aussagen des Teams, bewertet von 1 bis 10. |
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
| Only the survey's facilitator or a workspace admin can do this. | Seul le facilitateur du sondage ou un administrateur de l'espace peut faire cela. | Solo el facilitador de la encuesta o un administrador del espacio puede hacerlo. | Nur der Moderator der Umfrage oder ein Workspace-Admin kann das tun. |
| Questions can only change while the survey is a draft. | Les questions ne peuvent changer que tant que le sondage est un brouillon. | Las preguntas solo pueden cambiar mientras la encuesta es un borrador. | Fragen können nur geändert werden, solange die Umfrage ein Entwurf ist. |
| The questions of a health check come from the team's statements. | Les questions d'un bilan de santé viennent des énoncés de l'équipe. | Las preguntas de un chequeo de salud vienen de los enunciados del equipo. | Die Fragen eines Gesundheitschecks stammen aus den Aussagen des Teams. |
| This survey is not open. | Ce sondage n'est pas ouvert. | Esta encuesta no está abierta. | Diese Umfrage ist nicht geöffnet. |
| You no longer have access to this survey. | Vous n'avez plus accès à ce sondage. | Ya no tienes acceso a esta encuesta. | Du hast keinen Zugriff mehr auf diese Umfrage. |
| A survey can have at most 30 questions. | Un sondage peut avoir 30 questions au plus. | Una encuesta puede tener 30 preguntas como máximo. | Eine Umfrage kann höchstens 30 Fragen haben. |
| Send every question exactly once. | Envoyez chaque question exactement une fois. | Envía cada pregunta exactamente una vez. | Sende jede Frage genau einmal. |
| This change is not possible. | Ce changement n'est pas possible. | Este cambio no es posible. | Diese Änderung ist nicht möglich. |
| Add a question before publishing. | Ajoutez une question avant de publier. | Añade una pregunta antes de publicar. | Füge vor dem Veröffentlichen eine Frage hinzu. |
| An attached health check cannot be reopened once its retro is completed. | Un bilan de santé rattaché ne peut pas être rouvert une fois sa rétro terminée. | Un chequeo de salud adjunto no puede reabrirse una vez completada su retro. | Ein angehängter Gesundheitscheck kann nicht wieder geöffnet werden, sobald seine Retro abgeschlossen ist. |
| Answer at least one question before finishing. | Répondez à au moins une question avant de terminer. | Responde al menos a una pregunta antes de terminar. | Beantworte mindestens eine Frage, bevor du abschließt. |
| An answer is required. | Une réponse est requise. | Se requiere una respuesta. | Eine Antwort ist erforderlich. |
| Copy of :title | Copie de :title | Copia de :title | Kopie von :title |
| Respondent | Répondant | Participante | Teilnehmer |
| Respondent :number | Répondant :number | Participante :number | Teilnehmer :number |
| comment | commentaire | comentario | Kommentar |
| Results can be exported once the survey is closed. | Les résultats peuvent être exportés une fois le sondage clôturé. | Los resultados pueden exportarse cuando la encuesta esté cerrada. | Die Ergebnisse können exportiert werden, sobald die Umfrage geschlossen ist. |
| Not enough answers to show results. | Pas assez de réponses pour afficher les résultats. | No hay suficientes respuestas para mostrar los resultados. | Nicht genug Antworten, um Ergebnisse zu zeigen. |
| This retro already has a health check. | Cette rétro a déjà un bilan de santé. | Esta retro ya tiene un chequeo de salud. | Diese Retro hat bereits einen Gesundheitscheck. |
| The health check is closed. | Le bilan de santé est clôturé. | El chequeo de salud está cerrado. | Der Gesundheitscheck ist geschlossen. |

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
| :count statements · scored 1 to 10 | :count énoncés · notés de 1 à 10 | :count enunciados · puntuados de 1 a 10 | :count Aussagen · bewertet von 1 bis 10 |
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
| Required | Obligatoire | Obligatoria | Pflicht |
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
| Finish | Terminer | Terminar | Abschließen |
| Change my answers | Modifier mes réponses | Cambiar mis respuestas | Meine Antworten ändern |
| Thank you — your answers are saved. | Merci — vos réponses sont enregistrées. | Gracias: tus respuestas se han guardado. | Danke – deine Antworten sind gespeichert. |
| :count of :total have answered | :count sur :total ont répondu | :count de :total han respondido | :count von :total haben geantwortet |
| Neither the facilitator nor the team can link this answer to you. | Ni le facilitateur ni l'équipe ne peuvent relier cette réponse à toi. | Ni el facilitador ni el equipo pueden relacionar esta respuesta contigo. | Weder der Moderator noch das Team können diese Antwort dir zuordnen. |
| Your answers are saved as you give them; the counter is paused. | Vos réponses sont enregistrées au fur et à mesure ; le compteur est en pause. | Tus respuestas se guardan a medida que las das; el contador está en pausa. | Deine Antworten werden beim Geben gespeichert; der Zähler ist pausiert. |
| Not saved — retry | Non enregistré — réessayer | No guardado: reintentar | Nicht gespeichert – erneut versuchen |
| This survey is closed. | Ce sondage est clôturé. | Esta encuesta está cerrada. | Diese Umfrage ist geschlossen. |
| This survey was deleted. | Ce sondage a été supprimé. | Esta encuesta se ha eliminado. | Diese Umfrage wurde gelöscht. |
| This survey link is no longer valid | Ce lien de sondage n'est plus valide | Este enlace de encuesta ya no es válido | Dieser Umfragelink ist nicht mehr gültig |
| Free-text answers | Réponses libres | Respuestas libres | Freitextantworten |
| Compare | Comparer | Comparar | Vergleichen |
| Compare with | Comparer avec | Comparar con | Vergleichen mit |
| Export CSV | Exporter en CSV | Exportar CSV | CSV exportieren |
| Close the survey? | Clôturer le sondage ? | ¿Cerrar la encuesta? | Umfrage schließen? |
| People can no longer answer. You can reopen it. | Plus personne ne pourra répondre. Vous pourrez le rouvrir. | Ya nadie podrá responder. Puedes reabrirla. | Niemand kann mehr antworten. Du kannst sie wieder öffnen. |
| :responses answers out of :audience members · anonymous | :responses réponses sur :audience membres · anonyme | :responses respuestas de :audience miembros · anónima | :responses Antworten von :audience Mitgliedern · anonym |
| closed on :date | clôturé le :date | cerrada el :date | geschlossen am :date |
| most frequent answer | réponse la plus fréquente | respuesta más frecuente | häufigste Antwort |
| :detractors detractors, :passives passives, :promoters promoters | :detractors détracteurs, :passives passifs, :promoters promoteurs | :detractors detractores, :passives pasivos, :promoters promotores | :detractors Kritiker, :passives Passive, :promoters Fürsprecher |
| :value vs :title | :value vs :title | :value frente a :title | :value ggü. :title |
| no change | aucun changement | sin cambios | keine Änderung |
| See the :count answers | Voir les :count réponses | Ver las :count respuestas | Die :count Antworten ansehen |
| Results appear from :threshold answers. :responses so far. | Les résultats apparaissent à partir de :threshold réponses. :responses pour l'instant. | Los resultados aparecen a partir de :threshold respuestas. :responses por ahora. | Ergebnisse erscheinen ab :threshold Antworten. Bisher :responses. |
| Results will show when the survey is closed. | Les résultats s'afficheront à la clôture du sondage. | Los resultados se mostrarán cuando se cierre la encuesta. | Die Ergebnisse erscheinen, wenn die Umfrage geschlossen ist. |
| Answer the survey to see the results. | Répondez au sondage pour voir les résultats. | Responde a la encuesta para ver los resultados. | Beantworte die Umfrage, um die Ergebnisse zu sehen. |
| Nothing to compare with yet. | Rien à comparer pour l'instant. | Aún no hay nada con qué comparar. | Noch nichts zum Vergleichen. |
| The other survey does not have enough answers. | L'autre sondage n'a pas assez de réponses. | La otra encuesta no tiene suficientes respuestas. | Die andere Umfrage hat nicht genug Antworten. |
| Only in this survey | Seulement dans ce sondage | Solo en esta encuesta | Nur in dieser Umfrage |
| Only in :title | Seulement dans :title | Solo en :title | Nur in :title |
| higher | en hausse | más alto | höher |
| lower | en baisse | más bajo | niedriger |
| Quick poll | Sondage rapide | Encuesta rápida | Schnellumfrage |
| One question, answered on the board | Une question, à laquelle on répond sur le board | Una pregunta, respondida en el tablero | Eine Frage, auf dem Board beantwortet |
| Built-in | Intégré | Integrado | Integriert |
| Health check added | Bilan de santé ajouté | Chequeo de salud añadido | Gesundheitscheck hinzugefügt |
| Health check, :answered of :total answered | Bilan de santé, :answered sur :total ont répondu | Chequeo de salud, :answered de :total han respondido | Gesundheitscheck, :answered von :total haben geantwortet |
| Close the health check | Clôturer le bilan de santé | Cerrar el chequeo de salud | Gesundheitscheck schließen |
| Everyone will see the results. | Tout le monde verra les résultats. | Todo el mundo verá los resultados. | Alle werden die Ergebnisse sehen. |
| Its answers are kept and come back if you add it again. | Ses réponses sont conservées et reviennent si vous l'ajoutez à nouveau. | Sus respuestas se conservan y vuelven si lo añades de nuevo. | Die Antworten bleiben erhalten und kommen zurück, wenn du ihn wieder hinzufügst. |
| It has no answer yet. | Il n'a pas encore de réponse. | Aún no tiene respuestas. | Er hat noch keine Antwort. |
| The team rates its statements during the retro | L'équipe note ses énoncés pendant la rétro | El equipo puntúa sus enunciados durante la retro | Das Team bewertet seine Aussagen während der Retro |
| Start a health check | Lancer un bilan de santé | Iniciar un chequeo de salud | Gesundheitscheck starten |
| :count statements, scored 1 to 10, asked in every health check | :count énoncés, notés de 1 à 10, posés à chaque bilan de santé | :count enunciados, puntuados de 1 a 10, preguntados en cada chequeo de salud | :count Aussagen, bewertet von 1 bis 10, in jedem Gesundheitscheck gefragt |
| Kind | Type | Tipo | Art |

The key `The team rates its health statements first` is removed from the four files in Task 25 (its sentence is false once the phase is gone); `TranslationKeysTest` tells whether another key became unused.

- [ ] Run the test, fix what it reports, commit `chore(i18n): the survey and health-check strings in four languages`.

### Task 31: Browser walkthroughs

**Files:**
- Create: `tests/Browser/Walkthroughs/Plan19SurveysTest.php`
- Rewrite: `tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php`
- Edit (listed changes only): `Plan08cSurveysTest.php`, `Plan08eLlmTest.php` (one `click('Quick poll')` after each `click('Add survey')`), `Plan08aFlowAndTemplatesTest.php`, `Plan08dResultsTest.php` (the health-check steps: no phase to pass; the health check is answered through the header button; the results assertions on "Team health" are unchanged), `Plan18eSessionCreateTest.php` (five types), `Plan18eTeamPageTest.php` and `tests/Browser/Visual/TeamPageVisualTest.php` (the Surveys section and the health card sentence)

Read `tests/Browser/Support/InteractsWithBrowser.php` (`signIn`, `joinAsGuest`, `awaitRealtime`, `dragWithKeyboard`) and `Plan17aWhiteboardCoreTest.php` for the two-browser pattern; that file is not edited.

`Plan19SurveysTest.php`, one case each:

| Id | Case |
|---|---|
| P19-01 | A member opens "New session", picks "Poll", "Team pulse", "Create & open": the builder shows five questions and the badge "Draft". |
| P19-02 | In the builder: add a "Scale 1 – 5", type its label and its two end labels, mark it "Required", add a "Single choice" with three options, duplicate it, delete the copy, move the last question first with the keyboard; reload: everything is as left ("Saved" was shown each time). |
| P19-03 | "Publish" without a question is disabled; with questions it publishes, the badge reads "Open" and the questions are read-only. |
| P19-04 | Two browsers, facilitator on the results page and a member on the survey: the member answers question by question (digit key for the scale, click for the choice, typing for the text), "Finish"; the facilitator's counter goes from 0 to 1 without a reload; the member sees "Thank you". |
| P19-05 | A required question left empty: "Next" stays, "An answer is required" shows, focus is on the control. |
| P19-06 | The facilitator turns guests on in the Share dialog, copies the link; a second browser opens it logged out, joins with the suggested nickname, answers and finishes. With the default threshold of 3 the results page says "Results appear from 3 answers. 2 so far."; a third respondent makes the cards appear. |
| P19-07 | "Close": the participant page of the other browser switches to "This survey is closed." without a reload; "Export CSV" appears for the facilitator and its link answers 200 with `text/csv`. |
| P19-08 | "Duplicate" from the team page, publish, answer three times with other values, close: the Compare tab names the first survey and shows a signed difference on the scale; the Summary card carries the badge. |
| P19-09 | A member who is not an editor opens the builder URL: 403 page. A draft is not in that member's Surveys section. |
| P19-10 | Phone, 390 × 844: the participant flow of an NPS question (two rows, docked buttons, no horizontal scroll), then of a text question with the keyboard hint absent. |
| P19-11 | "Health check" from the dialog: six statements scored 1 to 10, read-only in the builder; after three answers and "Close", the team's health-check page shows a new point in the Mood trend that links to the survey's results. |

`Plan08bHealthCheckTest.php`, rewritten case for case (ids kept, `[P08b-nn]`):

| Was | Becomes |
|---|---|
| the retro starts in the Health check phase | a retro created with "Health check" on starts in Writing and shows the "Health check" button with "0/n" |
| each participant scores the statements in the phase | each opens the dialog from the header and scores; the count on the button moves for the other browser without a reload |
| who answered is shown, or hidden on an anonymous retro | the same, inside the dialog |
| the facilitator moves on to the next phase | the facilitator clicks "Close the health check"; every browser's dialog shows the results |
| turning the health check off in the settings | "Remove" in the dialog; "Add survey → Health check" brings the answers back |
| the completed retro shows "Team health" | unchanged |
| the team's statements manager | unchanged (it lives on the health-check page since plan 18e) |
| a guest answers | a retro guest opens the dialog and scores, without joining anything else |

- [ ] Build the assets (`npm run build:front`), run each edited file alone (`vendor/bin/sail artisan test --compact tests/Browser/Walkthroughs/<file>`), then `bin/test-browser`. Never port 8097.
- [ ] Commit `test(browser): survey walkthroughs; the health check without a phase`.

### Task 32: Captures, deviations, documents

- [ ] Add the five screens (dialog on Poll, builder, participant, results, compare) and the retro with the health-check dialog to the visual harness (`tests/visual`), in light and dark, at 1440 and 390, in French and English; the overflow check must pass.
- [ ] For each screen, open its captures beside the mockup's `preview.html` and write the remaining differences. Each is fixed, or is a row of **Pre-build deviations** above with the owner's word. A difference that fits no reason stops the task.
- [ ] Documents, in one commit:
  - move the spec to `docs/superpowers/specs/2026-10-19-standalone-surveys-design.md` and this plan to `docs/superpowers/plans/2026-10-19-plan-19-standalone-surveys.md`, with the owner's answers of §17 folded into the spec;
  - `docs/superpowers/research/front-rewrite/feature-roadmap.md`: rows SV-1 to SV-5 marked done; "Not requested, staying backlog" of the surveys section completed with spec §13;
  - `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, table "Deviations from the mockup": D-03 removed; D-09 reworded (the Poll type exists; the per-type tiles stay as decided); D-22 reduced to what stays backlog; D-23 unchanged except "Add survey" now opening the menu;
  - `docs/superpowers/specs/2026-10-01-front-rewrite-design.md`: §4 "Health check phase", §6.4 retro phases and session creation, B18, B23 and §10 amended with a pointer to the new spec;
  - `README.md`: one paragraph in the upgrade notes — run `php artisan surveys:verify-health-import` right after the migrations of this release.
- [ ] Commit `docs: plan 19 — spec and plan in place, roadmap and deviation rows updated`.

### Task 33: Full suites and report

- [ ] `vendor/bin/pint --format agent`
- [ ] `vendor/bin/sail artisan test --parallel --processes=8 --compact` — Expected: PASS.
- [ ] The same feature suite on SQLite: `DB_CONNECTION=sqlite DB_DATABASE=:memory: vendor/bin/sail artisan test --compact tests/Feature/TeamSurveys tests/Feature/Retros tests/Feature/Teams` — Expected: PASS, except `UuidPrimaryKeysTest` if it is still PostgreSQL-only (it reads `information_schema`; outside this plan). If the portability plan's harness (its WP1) is merged, run the whole feature suite on each driver it offers.
- [ ] `grep -rnE "ilike|whereRaw|selectRaw|orderByRaw|havingRaw|groupByRaw|DB::raw|DB::statement|DB::select\(|getDriverName|insertOrIgnore|whereJson" $(git diff --name-only main...HEAD -- app database | tr '\n' ' ')` — Expected: no line from a file this plan created or rewrote.
- [ ] `npm run test`, `npm run types:check`, `npm run check`, `npm run build:front` — Expected: PASS.
- [ ] `bin/test-browser` — Expected: PASS.
- [ ] `vendor/bin/sail artisan surveys:verify-health-import` on the development database, and on a copy of a production database if the owner provides one; attach the output.
- [ ] Report `docs/superpowers/research/plan-19-report.md` (asked for by this plan): what is done, per acceptance criterion of spec §15 with the test that proves it; the differences that remain with each mockup; every existing test that was edited and why; every translation key added outside the table of Task 30; the output of the import and verification commands; every decision taken on the owner's behalf; what is left for the plan that drops the old tables.
- [ ] Commit `docs: plan 19 report`. Then ask the owner to run the full suite once more and to read the report. No merge into `main`, no push.

---

## Self-review (done while writing; kept for the reader)

**Spec coverage.** §6.1 tables: Task 1. §6.2 kinds and limits: Tasks 7, 9, 10. §6.3 respondents and anonymity: Tasks 3, 9, 10, 15. §6.4 visibility and threshold: Tasks 1 (`resultsVisibleTo`), 10, 12. §6.5 templates: Tasks 2, 4, 11, 15 (statements follow the team). §6.6 comparison: Tasks 11, 24. §6.7 retro surveys untouched: no task touches them; Task 25 adds one click to two browser files. §7 lifecycle and permissions: Tasks 3, 4, 7, 8, 9, 11, 12, 13. §8 real time: Tasks 5, 9, 15, 17. §9 screens: Tasks 18 to 26. §10 CSV: Task 12 (the spec said "random order"; the plan sorts by content, and the spec is amended to say so). §11 migration: Tasks 14 (import), 15 (writers and board), 16 (readers), 27 (phase), 29 (models); §11.8 order: the Step B note and Task 27. §12 routes: Tasks 3 to 12 and 15. §14 testing: every task; Tasks 31 and 33. §15 criteria: 1 → 4, 18; 2 → 2, 4, 11; 3 → 7, 20; 4 → 8; 5 → 3, 6; 6 → 9; 7, 8 → 10; 9 → 1, 10, 12; 10 → 10; 11 → 5, 17, 23, 31; 12 → 5; 13 → 11; 14 → 12; 15 → 3; 16, 17 → 14, 16; 18, 19 → 27; 20, 21 → 15; 22, 23 → 16, 26; 24 → 25, 31; 25 → 13, 19, 26; 26 → 30, 32; 27 → 33.

**Gaps found and closed while writing.** A health check that was turned off keeps its answers today and brings them back when turned on again: the first draft deleted or refused; Tasks 14 and 15 now keep it as a hidden draft, and the spec says so. The CSV order moved from random to sorted by content. `Plan08c` and `Plan08e` cannot stay untouched once "Add survey" is the mockup's menu: one listed click each. `RetroGuard::open` answers 403 and `unlocked` 423: the tests of Task 15 use those statuses.

**Placeholders.** Back-end tasks carry their tests and code. Screen tasks 18 to 26 carry composition tables, behaviours, hooks, states and the code of their pure logic, not full component code: they follow the screen procedure of plan 18e, where the mockup is the specification of the markup. Three places name code that must be read at execution because another plan is still writing it: the retro container and header (Tasks 25, 28), `use-whiteboard.ts` for `realtime` and `connection` (Task 17), and the session banners (Task 21).

**Type consistency.** `BuildTeamSurveySnapshot::handle(TeamSurvey, TeamSurveyRespondent)` grows by keys in Tasks 3, 9, 10, 11 and matches `SurveySnapshot` of Task 17. `AnnounceSurveyResponses::handle` returns `void` in Task 9 and an array from Task 15; both callers of Task 9 ignore the value. `BuildHealthTrend::scores` becomes `scoresOf` in Task 16, and its only other caller, `BuildTeamMoodTrend`, is rewritten in the same task. `surveyQuestion()` gives the first question position 1, which the position assertions of Tasks 7 and 12 account for. `SummarizeHealthCheck::handle` keeps its signature; `forSurvey` is new and takes the number of participants.

**Review Focus.** Each of the five lines has its test: CSV formulas (Task 12), a double save (Task 9), a viewer without results (Tasks 5, 10), an import run twice or late (Task 14), a retro caught in the removed phase (Task 27).

**Known weak points of this draft.** Nothing was run. The literals of `HealthCheckParityTest` were computed by hand from the old code as read; Task 16 Step 2 checks them against the old code before the rewrite. The front tasks were written without the final retro container of plan 18e. The translations are a first pass, reviewed in Task 30.

