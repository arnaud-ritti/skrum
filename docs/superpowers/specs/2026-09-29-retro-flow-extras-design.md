# Skrum — Retro flow extras — Design

Date: 2026-09-29
Status: Approved decisions, awaiting spec review
Parent spec: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md` (all its rules apply unless this spec changes them explicitly — see §12), as amended by `docs/superpowers/specs/2026-09-29-board-engagement-design.md`
Research: `docs/superpowers/research/qretro/` (QRetro parity roadmap, spec 2 of 7; `templates.md` for the catalogue, `screens/retro-health-check.png`, `retro-survey.png`, `retro-results.png`, `retro-create.png`)

## 1. Intent

Give a retrospective the structure QRetro offers around the board: an optional team health check before writing, an icebreaker slot, surveys on the board, a results page when the retro is completed, an automatic vote limit, and a real template catalogue with column descriptions and a creation dialog with preview.

**Success:** every rule below is covered by a feature test or a step of the walkthrough (§10); the suite, phpstan, type-check and lint stay green; no new Composer or npm dependency is added; with no LLM provider configured, every screen works and shows only deterministic content.

### In scope

- Two optional phases before `Writing`: **Health check** (6 statements, 1–10) and **Icebreaker** (phase slot and toggle only).
- Phase list driven by the retro's enabled phases; adjacency over that list.
- **Surveys** on the board: single choice, 2–10 options, results after answering, close/reopen.
- **Results** view for `Completed` retros: participants, team health (radar, score, participation, top strength, growth area, alignment, assessment, trend across the team's retros), survey results, top-voted cards, action items, ROTI.
- **ROTI** (return on time invested, 1–5) collected at the end of the meeting.
- **Automatic vote limit** (top-level cards + 3, max 10) next to the existing fixed `votes_per_participant`.
- **Template catalogue** (all 52 QRetro templates) with translated names, column titles and column descriptions; column descriptions stored on columns and shown under titles; a creation dialog with search and preview.
- **Optional LLM features** (only when an admin configures a provider key): generate a survey draft from a prompt; generate a results summary automatically when the retro is completed (per-retro opt-out) or on demand.

### Out of scope (deferred)

- Icebreaker games (spec 7). This spec only adds the phase, its toggle and a placeholder screen.
- Custom or editable health-check statements; health check outside the pre-writing slot.
- Reactions and comments on surveys; multiple-choice or free-text surveys.
- "Send to email", Slack/Telegram sharing of results (spec 6), "Games we played" (spec 7), LLM "recommended next steps" / suggested actions (spec 3), automatic group names.
- Action item changes (priority, due date, global list: spec 3).
- Workspace-level custom templates stored in the DB, template categories.
- Health data in MCP (spec 5 reads what this spec stores).

### Dependencies

None new. Charts (radar, trend sparkline) are inline SVG components. LLM calls use Laravel's HTTP client; the results summary runs in a Laravel queued job (needs a running queue worker, as for the rest of the app's jobs).

## 2. Phases

### 2.1 Enum and order

`App\Enums\RetroPhase` gains two cases, placed first:

`HealthCheck = 'health_check'` → `Icebreaker = 'icebreaker'` → `Writing` → `Grouping` → `Voting` → `Discussing` → `Completed`.

The `retros.phase` column is already a string; no data migration is needed.

### 2.2 Enabled phases and adjacency

- New `retros` columns `health_check_enabled` (bool, default `false`) and `icebreaker_enabled` (bool, default `false`). Existing retros keep today's flow.
- `Retro::phases(): array<RetroPhase>` returns every case in order, minus `HealthCheck` when `health_check_enabled` is false and `Icebreaker` when `icebreaker_enabled` is false.
- `RetroPhase::next()` / `previous()` / `isAdjacentTo()` are replaced by `Retro::nextPhase()`, `Retro::previousPhase()` and `Retro::canMoveTo(RetroPhase)`, computed over `Retro::phases()`. `RetroPhasesController` uses `canMoveTo`; the error message is unchanged. Reopening (`Completed` → `Discussing`) is unchanged.
- A new retro starts in the first enabled phase (`HealthCheck`, else `Icebreaker`, else `Writing`).
- The snapshot exposes `retro.phases` (enabled phase values, in order); the frontend stepper renders that list instead of the constant `Phases`.

### 2.3 Toggles

- `health_check_enabled`, `icebreaker_enabled` and `ai_summary_enabled` (§6.3) are set at creation (§8.4) and through `PATCH /retros/{retro}/settings` (facilitator only), in any phase except `Completed`, broadcasting `settings.changed`. `ai_summary_enabled` is rejected with 422 "Not available." when no LLM provider is configured.
- Turning off the phase the retro is currently in → 422 "Move to another phase before turning this phase off."
- Turning a phase on after the retro has passed it inserts it in the stepper as a past step; the facilitator reaches it by moving back.
- Turning the health check off keeps existing answers; they are shown again in results only if it is on (§4.5).

### 2.4 Phase helpers (replacing hard-coded lists)

Existing guards that list phases explicitly are rewritten with two helpers so new phases are handled in one place:

- `RetroPhase::isOpen()`: every phase except `Completed`. Used by the timer (`RetroTimersController`) and the engagement settings (`RetroSettingsController`), which today list `Writing…Discussing`.
- `RetroPhase::hidesOthersCards()`: `HealthCheck`, `Icebreaker`, `Writing`. Used by `PresentCard` instead of `=== RetroPhase::Writing`. Cards only exist before `Writing` when the facilitator moved back; they stay hidden from others until the retro moves past `Writing` again.
- Column edits (`ColumnsController`, `ColumnOrdersController`) are allowed in `HealthCheck`, `Icebreaker` and `Writing` (the "no cards in the column" rule still applies), so the facilitator can prepare columns during the health check.
- Changing the vote limit (§7) is allowed in every phase before `Voting`.
- Card creation stays `Writing` only; every other card, group, vote, reaction, comment and action-item rule is unchanged.

### 2.5 Icebreaker placeholder

Until spec 7 adds games, the `Icebreaker` phase shows a "Warm-up" panel with one question from a built-in list of 12 translated questions (e.g. "What was the highlight of your week?"), chosen deterministically from the retro id, plus the shared timer. Nothing is stored. Spec 7 replaces the panel content; the phase, toggle and adjacency rules stay.

## 3. Data model

### `retros` — new columns

| Column | Type / default | Meaning |
|---|---|---|
| `health_check_enabled` | bool, `false` | Health check phase in the flow |
| `icebreaker_enabled` | bool, `false` | Icebreaker phase in the flow |
| `ai_summary_enabled` | bool, DB default `false` | Automatic results summary at completion (§6.3). Existing retros never opted in; a new retro gets `true` when a provider is configured and the creator did not opt out |
| `summary` | text, nullable | LLM-generated results summary (plain text, ≤ 2000 characters) |
| `summary_generated_at` | timestamp, nullable | When `summary` was generated |
| `summary_status` | string, nullable | `pending`, `ready` or `failed`; `null` = never requested |

`votes_per_participant` becomes nullable: `null` means automatic (§7). Existing rows keep their value. `template` stops being cast to the `RetroTemplate` enum and becomes a plain string validated against the catalogue (§8).

### `columns` — changes

- New `description` (nullable string, ≤ 200 characters).
- `title` limit raised from 60 to 100 characters (the longest catalogue title is 81), in the migration and in `ColumnsController` validation.

### `health_check_answers` — new table

- `id` (UUID), `retro_id` (cascade), `participant_id` (cascade), `statement` (string, `HealthStatement` value), `score` (unsigned tinyint 1–10), timestamps.
- Unique (`retro_id`, `participant_id`, `statement`).

### `surveys` — new table

- `id` (UUID), `retro_id` (cascade), `created_by_participant_id`, `question` (string, 1–200), `description` (nullable string, ≤ 500), `position` (int), `is_closed` (bool, default `false`), `show_voters` (bool, default `false`; always `false` on anonymous retros, §5.1), `version` (int, default 1; incremented on every structural change: edit, close, reopen, `show_voters` change), timestamps.

### `survey_options` — new table

- `id` (UUID), `survey_id` (cascade), `label` (string, 1–100), `position` (int).

### `survey_responses` — new table

- `id` (UUID), `survey_id` (cascade), `survey_option_id` (cascade), `participant_id` (cascade), timestamps.
- Unique (`survey_id`, `participant_id`): one answer per participant per survey.

### `roti_votes` — new table

- `id` (UUID), `retro_id` (cascade), `participant_id` (cascade), `score` (unsigned tinyint 1–5), timestamps. Unique (`retro_id`, `participant_id`).

All new tables use UUID primary keys and `foreignUuid` like the rest of the schema.

## 4. Health check

### 4.1 Statements

Enum `App\Enums\HealthStatement` (order = display order = radar axes):

| Value | Statement (translation key) | Axis label |
|---|---|---|
| `interaction` | Interaction with colleagues was productive | Interaction |
| `task_clarity` | Tasks assigned to me were clear | Clear tasks |
| `manager_support` | My manager was understanding and supportive | Manager support |
| `vision` | The vision and goals are clear to me | Vision |
| `processes` | Our processes let me work without blockers | Processes |
| `motivation` | I felt motivated in my work | Motivation |

Statements and scale labels ("Awful" at 1, "Great" at 10) are translation keys rendered in the viewer's locale; nothing is stored as text.

### 4.2 Answering

- Allowed only in the `HealthCheck` phase, for any participant (guests included). Other phases → 403. `is_locked` → 423.
- `PUT` sets or changes the participant's score for one statement (upsert); `DELETE` clears it. Answering some statements and skipping others is allowed.
- A participant only ever sees their own scores (`myScore`).

### 4.3 Live progress (during `HealthCheck`)

- Per statement: number of answers and, unless the retro is anonymous, the participant ids who answered (rendered as avatars, as in QRetro). On anonymous retros only the count is sent.
- No average, distribution or score of anyone else is sent while the retro is in `HealthCheck`.

### 4.4 Aggregates

Computed server-side by `SummarizeHealthCheck`, only from answers of the current retro:

- **No minimum respondents:** every statement with at least one answer reports its average, whatever the number of answers (QRetro parity). A statement with no answer reports `average: null`, is shown as "No answers" and is excluded from every aggregate below. Only averages, spread/alignment, counts and who answered are exposed; individual scores never are.
- **Statement average:** mean of scores, one decimal.
- **Score:** mean of the reported statement averages, one decimal; `null` when none is reported.
- **Participation:** respondents (participants with at least one answer) / participants of the retro.
- **Top strength / growth area:** the reported statements with the highest / lowest average; ties go to the earlier statement. Both `null` when fewer than two statements are reported or all reported averages are equal.
- **Alignment (consensus):** per reported statement, `10 × (1 − σ / 4.5)` clamped to 0–10, where σ is the population standard deviation of its scores (4.5 is the largest possible σ on a 1–10 scale). The retro's alignment is the mean over reported statements, rounded to an integer. Level: ≥ 8 "High team consensus", ≥ 5 "Moderate consensus", otherwise "Divided opinions".
- **Assessment** (fixed translated sentence by score band): ≥ 8 "Excellent", ≥ 6 "Good", ≥ 4 "Needs attention", < 4 "Critical", each with one explanatory sentence (e.g. Good: "Most health scores are above average. Keep the momentum going.").

### 4.5 Trend across retros

- For the Results view (§6), the last 6 `Completed` retros of the same team whose health check is enabled and whose score is non-null (current retro included), ordered by `completed_at`: `{retroId, title, completedAt, score, url}` per point, plus the delta to the previous point.
- Each point uses the same aggregates as §4.4.
- Sent only to viewers who are not guests (guests of one retro must not see the team's other retros). Computed with one grouped query (retro × statement), not one query per retro.

## 5. Surveys

### 5.1 Rules

- **Create / edit / delete:** facilitator only, in phases `Writing` to `Discussing`, not while locked (423). At most 10 surveys per retro (422). 2–10 options (422 otherwise), each 1–100 characters; question 1–200; description ≤ 500.
- **Edit** (question, description, options) only while the survey has no response (422 "This survey already has answers."). The `show_voters` switch is the exception: it can be changed at any time before `Completed`, with or without responses, open or closed. Delete is always allowed for the facilitator and removes its responses.
- **Show who answered (`show_voters`):** per-survey facilitator switch, default off, accepted by `POST` and `PATCH` (a `PATCH` carrying only `show_voters` is allowed on a survey with responses). Off: counts only. On: each option also lists the participants who chose it, under the same visibility rule as counts (below). On an anonymous retro the switch is forced off: any request setting it to true → 422 "Names are never shown on anonymous retros.", and the presenter also returns no voters whenever the retro is anonymous.
- **Answer:** any participant, phases `Writing` to `Discussing`, survey open, not locked. `PUT` sets or changes the participant's single choice; `DELETE` withdraws it. Closed survey → 422 "This survey is closed."
- **Close / reopen:** facilitator only, any phase except `Completed`, allowed while locked. Moving the retro to `Completed` closes every open survey in the same transaction; reopening the retro leaves them closed.
- **Results visibility:** a viewer receives option counts only when they have answered that survey or the survey is closed. Otherwise counts are `null` (redaction is done server-side, not by the client). Everyone always sees the number of responses.
- **Ballot secrecy:** unless `show_voters` is on, who chose which option is never sent to anyone, in any phase. When on, voter ids are sent only together with the counts (viewer answered or survey closed) and never on anonymous retros. Broadcasts never carry voters.

### 5.2 Survey payload (per viewer)

`{id, question, description, position, isClosed, version, showVoters, responseCount, myOptionId, resultsVisible, options: [{id, label, position, count, voters}]}` — `count` is `null` when `resultsVisible` is false; `voters` is `null` unless `showVoters` and `resultsVisible` and the retro is not anonymous, else the list of participant ids who chose the option. Participant ids appear nowhere else in survey payloads.

### 5.3 LLM survey draft (optional)

- `POST /retros/{retro}/survey-drafts` `{prompt}` (1–300 characters), facilitator only, same phases as creation. Available only when an LLM provider is configured (§9); otherwise 404 and the button is hidden.
- The provider receives the prompt and the retro title, and returns a question, an optional description and 2–10 options in the facilitator's locale. The server validates the result against §5.1 limits without truncating it (an invalid draft → 502 "Could not generate a survey. Try again or write it yourself.").
- Nothing is saved: the draft prefills the survey dialog, and the facilitator edits and saves it through the normal endpoint.
- Rate limit: 10 drafts per minute per participant (429).

## 6. Results view (`Completed`)

### 6.1 Placement

When the retro is `Completed`, the board page shows two tabs: **Results** (default) and **Board** (the existing read-only board). The Results view replaces `completed-summary.tsx`. The facilitator's "Reopen" stays in the header. Guests who open a completed retro through a still-enabled guest link see the same view without the health trend.

### 6.2 Sections

1. **Thanks for participating** — every participant of the retro (avatar and name). This lists who joined, never who wrote what; it is shown on anonymous retros too, like the presence strip.
2. **Summary** — when `ai_summary_enabled` and a provider is configured: the stored LLM summary; a "Generating the summary…" skeleton while `summary_status` is `pending`; nothing but, for the facilitator, "The summary could not be generated" with a Retry button when `failed`. The facilitator also has "Regenerate" and "Remove" (§6.3), and "Generate summary" when none exists (e.g. opted out). Without a provider the section is absent.
3. **Team health** (when `health_check_enabled` and at least one answer) — radar (6 axes, 0–10; axes without answers drawn as gaps and labelled "No answers"), score `x.x/10`, participation `n / m participants`, top strength and growth area with their averages, alignment `n/10` with its level, assessment sentence, and the trend sparkline with delta (members only).
4. **Surveys** — every survey with its final counts and percentages, and the voters per option when `show_voters` is on (all surveys are closed at this point).
5. **Top topics** — the 5 top-level cards with the most votes (existing `sortByVotes`), with the number of grouped cards.
6. **Action items** — as today.
7. **ROTI** — the viewer's own rating control (§6.4) and the distribution (1–5 bars), the average (one decimal) and the respondent count.

### 6.3 LLM summary (optional)

- **Automatic generation:** when a retro moves to `Completed`, if a provider is configured and `ai_summary_enabled` is true, the transition sets `summary_status = pending` and dispatches the queued job `GenerateRetroSummary` after commit (broadcasting `results.changed`). `ai_summary_enabled` is chosen at creation (§8.4, default on when a provider is configured) and editable by the facilitator in the settings dialog until completion (§2.3); it is locked once `Completed`. Opting out means no content is ever sent automatically.
- **Job:** unique per retro, `tries = 3` with backoff (10 s, 60 s), provider timeout 60 s. At run time it aborts silently unless the retro is still `Completed` and the provider is configured, so nothing is sent if the facilitator reopened the retro. On success it stores `summary`, `summary_generated_at`, `summary_status = ready` and broadcasts `results.changed`. After the last failed attempt (`failed()`), it sets `summary_status = failed`, leaves `summary` null, logs the error without the key or board content, and broadcasts `results.changed`: the Results view shows no summary and the facilitator can retry.
- **On demand:** `POST /retros/{retro}/summary` — facilitator only, `Completed` only, provider configured (else 404), whatever `ai_summary_enabled` says. Sets `pending` (a request while already `pending` returns 202 without a second job; a `pending` older than 10 minutes counts as `failed`), dispatches the same job, broadcasts `results.changed` and returns 202 `{status}`. Rate limit 5 per minute per retro. Used for "Generate", "Regenerate" and "Retry". Completing the retro again after a reopen regenerates (and overwrites) the summary when `ai_summary_enabled` is true.
- `DELETE /retros/{retro}/summary` — facilitator only, clears `summary`, `summary_generated_at` and `summary_status`, broadcasts `results.changed`. It does not disable the automatic generation.
- **Input sent to the provider** (data minimisation): only built by the job at `Completed`, when every card is revealed, so no Writing-phase-hidden data can leak. Content: retro title, column titles, top-level card contents with their grouped children and vote totals (most-voted first, input capped at 30 000 characters), action item contents and done state, health aggregates from §4.4, closed survey results (counts only, no voters), ROTI aggregate. Never sent, on any retro: participant names or ids, card authors, assignees, GIFs, comments, reactions; anonymous retros therefore send no author information either.
- Output language: the retro creator's locale, else the facilitator's (the job has no request). The output is trimmed to 2000 characters and rendered as plain text (no HTML or Markdown).
- **Privacy notice:** the creation dialog and the settings switch carry "When the retro is completed, its board content is sent automatically to :provider to write a summary. Turn this off to keep it on this server."; the Results view names the provider next to a generated summary.

### 6.4 ROTI

- `PUT /retros/{retro}/roti` `{score}` (1–5) and `DELETE /retros/{retro}/roti`, any participant.
- Allowed in `Discussing` and `Completed`. This is an explicit exception to "Completed is read-only": ROTI is feedback on the meeting, not board content. `is_locked` does not block it.
- In `Discussing` a compact "How was this retro?" prompt (1–5 with labels: Time wasted, Not really worth it, Break-even, Good use of time, Excellent use of time) sits under the action items panel; in `Completed` it is part of the Results view.
- The distribution and average are sent only in `Completed`, whatever the number of ratings (aligned with the health check); before `Completed` only the respondent count and the viewer's own score are sent. Individual ratings are never exposed.

## 7. Automatic vote limit

- `votes_per_participant = null` means automatic: limit = min(10, number of top-level cards in the retro + 3). An explicit value (1–20) keeps today's behaviour.
- `Retro::voteLimit(): int` returns the effective limit; `CardVotesController` and `BuildBoardSnapshot` (`remainingVotes`) use it instead of the column.
- The limit is evaluated at vote time. Cards cannot be created, deleted or grouped during `Voting`, so it is stable within the phase. If the facilitator moves back to `Grouping` and groups cards, the limit may drop below votes already cast: existing votes are kept, `remainingVotes` is `max(0, limit − used)`, as for a manual reduction today.
- Settings: `votes_per_participant` accepts `null` or 1–20, changeable in any phase before `Voting` (§2.4).
- Snapshot: `retro.votesPerParticipant` becomes the effective limit; new `retro.votesAuto: bool`.
- New retros default to automatic; existing retros keep their fixed value. Other new-retro defaults: health check off, icebreaker off (`ai_summary_enabled`: §3).

## 8. Template catalogue

### 8.1 Definitions

- `App\Enums\RetroTemplate` is replaced by `App\Support\RetroTemplates\TemplateCatalogue`, which holds the definitions: key, `isCommon` flag, and per column a palette colour and an optional leading emoji. Titles and descriptions are translation keys.
- Keys are snake_case. The five existing keys (`start_stop_continue`, `mad_sad_glad`, `four_ls`, `went_well_to_improve_actions`, `custom`) are kept, with their current names and column titles; they gain column descriptions from `templates.md`. The other templates take their order and content from `docs/superpowers/research/qretro/templates.md`.
- Colours use the existing palette (`green`, `red`, `blue`, `amber`, `purple`, `slate`); positive columns green, negative red, the rest in catalogue order.
- `isCommon` marks the first 8 templates of `templates.md` (shown first in the dialog).
- `Custom` still starts with no columns.

### 8.2 Translations

- Template names, column titles and column descriptions live in `lang/{en,fr,es,de}/templates.php` (PHP translation group), not in `lang/*.json`, so they are not shipped to every page with the shared JSON strings.
- `TranslationKeysTest` also asserts that every key of `lang/en/templates.php` exists in the three other locales.
- As today, titles and descriptions are copied into `columns` in the creator's locale at creation (stored text). Participants with another locale see the creator's text; this is unchanged behaviour.

### 8.3 Column descriptions

- `PresentColumns` adds `description`. The column header shows it under the title (muted, clamped to two lines, full text in a tooltip).
- The facilitator edits it next to the title in the column menu. Editing the description is allowed even when the column has cards (it clarifies, it does not change meaning); renaming the title keeps the "no cards" rule. Both remain limited to the phases in §2.4.

### 8.4 Creation dialog

- On the team page, "New retrospective" opens a dialog instead of the inline form:
  - **Title**, prefilled "Retro :date" (localized medium date).
  - **Template list** (left): search field (matches name and column titles), "Common templates" first, then the rest in catalogue order, "Custom" last. Each item shows name and column titles.
  - **Preview** (right): the selected template's columns as coloured chips with their descriptions.
  - **Settings** (collapsible): anonymous cards, health check (off), icebreaker (off), vote limit (Automatic / fixed 1–20), and, only when `features.llm`, "Automatic AI summary" (on) with the privacy notice of §6.3.
  - **Start** button.
- The catalogue is sent as an Inertia optional prop (`Inertia::optional`), loaded when the dialog opens, in the viewer's locale: `[{key, name, isCommon, columns: [{title, description, color}]}]`.
- `POST /w/{workspace}/teams/{team}/retros` accepts `title`, `template` (catalogue key), `is_anonymous`, `health_check_enabled`, `icebreaker_enabled`, `votes_per_participant` (null or 1–20), `ai_summary_enabled` (ignored, stored `false`, when no provider is configured). Unknown template → 422.

## 9. LLM provider (bring your own key)

- `config/services.php` → `llm`: `provider` (`anthropic` | `openai`, env `SKRUM_LLM_PROVIDER`), `key` (`SKRUM_LLM_API_KEY`), `model` (`SKRUM_LLM_MODEL`, required), `base_url` (`SKRUM_LLM_BASE_URL`, optional; for `openai` it allows any OpenAI-compatible server, including a self-hosted one).
- The features exist only when provider, key and model are set. Otherwise: endpoints return 404, buttons are hidden, the snapshot flag `features.llm` is false.
- `App\Support\Llm\LlmClient` (interface) with `AnthropicClient` and `OpenAiCompatibleClient`, built on `Http::` with a 60 s timeout, bound per request (no static state, Octane-safe). Requests go from the server only (the summary from a queued job that reads the config at run time); the browser never contacts the provider. The key never appears in payloads, logs or error messages.
- Prompts ask for JSON (survey draft) or plain text (summary); card contents are passed as quoted data, and outputs are validated and rendered as text, so injected instructions cannot produce markup or bypass limits.
- `.env.example` documents the four variables and states that board content is sent to the configured provider when a facilitator uses the survey draft, and automatically when a retro with the AI summary enabled is completed.

## 10. Endpoints and events

### 10.1 Endpoints (under `/retros/{retro}/…`, participant resolved per request)

| Method | Path | Body | Who | Response |
|---|---|---|---|---|
| PUT | `/health-check/{statement}` | `{score}` | participant | `{statement, score}` + progress |
| DELETE | `/health-check/{statement}` | — | participant | progress |
| POST | `/surveys` | `{question, description?, options[], show_voters?}` | facilitator | survey (201) |
| GET | `/surveys/{survey}` | — | participant | survey for the viewer |
| PATCH | `/surveys/{survey}` | same as POST | facilitator | survey |
| DELETE | `/surveys/{survey}` | — | facilitator | 204 |
| PUT / DELETE | `/surveys/{survey}/closure` | — | facilitator | survey (close / reopen) |
| PUT | `/surveys/{survey}/response` | `{optionId}` | participant | survey for the viewer |
| DELETE | `/surveys/{survey}/response` | — | participant | survey for the viewer |
| POST | `/survey-drafts` | `{prompt}` | facilitator | `{question, description, options[]}` |
| PUT | `/roti` | `{score}` | participant | `{myScore, respondents}` |
| DELETE | `/roti` | — | participant | `{myScore: null, respondents}` |
| POST | `/summary` | — | facilitator | 202 `{status}` (queued job, §6.3) |
| DELETE | `/summary` | — | facilitator | 204 |

Unknown `statement` → 404. An `optionId` from another survey → 422. `PATCH /settings` also accepts `ai_summary_enabled`. Every mutation locks the retro row like existing endpoints and broadcasts after commit (`RetroBroadcastEvent`, `toOthers()`, report-don't-throw). Error messages are translated.

### 10.2 Broadcast events (presence channel `retro.{id}`)

| Event | Payload | Client reaction |
|---|---|---|
| `health.answered` | `{statements: [{key, count, answeredBy}]}` (`answeredBy` is `[]` on anonymous retros) | update progress |
| `survey.changed` | `{surveyId, version, responseCount}` | refetch `GET /surveys/{id}` (debounced 1 s) when `version` changed or the viewer can see its results; otherwise update `responseCount` |
| `survey.deleted` | `{surveyId}` | remove |
| `roti.changed` | `{respondents}` | update count; in `Completed`, refetch the snapshot (debounced 1 s) |
| `results.changed` | `{}` | refetch the snapshot (also sent when the summary becomes pending, ready or failed, or is removed) |

`settings.changed` also covers the two phase toggles and the vote limit. No payload contains a score, a rating or a chosen option, and none links a participant to one (`health.answered` only says who answered a statement, never with what score).

### 10.3 Snapshot additions

- `retro`: `phases`, `healthCheckEnabled`, `icebreakerEnabled`, `aiSummaryEnabled`, `votesAuto` (and `votesPerParticipant` is the effective limit).
- `features`: `{llm: bool}`.
- `healthCheck`: `{statements: [{key, count, answeredBy, myScore}]}` when enabled or when answers exist.
- `surveys`: survey payloads (§5.2) ordered by position.
- `roti`: `{myScore, respondents}`.
- `results` (only in `Completed`, else `null`): `{participants, health, healthTrend, surveys, roti: {distribution, average, respondents}, summary: {text, generatedAt, status} | null}` (`status`: `pending`, `ready`, `failed`); `health` follows §4.4, `healthTrend` is `null` for guests.
- Query count stays constant as cards, surveys and answers grow (one query per relation; health and ROTI aggregates computed in SQL).

## 11. Redaction and privacy

- **Health check:** individual scores are visible only to their author. Others see, during `HealthCheck`, answer counts and (non-anonymous retros) who answered; averages appear only in `results`, for every statement with at least one answer (no minimum, QRetro parity). Accepted residual risks: with very few respondents an average reveals individual scores (with two respondents each can infer the other's; with one, the average is that score); and if the facilitator moves back to `HealthCheck` and a single participant changes an answer, comparing two results views could reveal that change; answers cannot be edited outside `HealthCheck`, which limits it.
- **Surveys:** counts only after the viewer answered or the survey closed, enforced in `PresentSurvey`. Voters are sent only when the facilitator turned on "Show who answered", only with the counts, and never on anonymous retros (switch forced off, validated on write and redacted in `PresentSurvey`).
- **ROTI:** aggregates only, in `Completed`, whatever the number of ratings.
- **Cards before `Writing`:** hidden from others, like in `Writing` (§2.4).
- **Trend:** never sent to guests.
- **LLM:** only enabled by an admin. The survey draft is triggered by the facilitator. The results summary is sent automatically at completion unless the facilitator opted the retro out (creation dialog or settings, until completion), so content leaves the instance without a per-retro deliberate action; the notice in §6.3 says so and names the provider. Nothing hidden during `Writing` is ever sent (the job runs only in `Completed`), no personal data or author information is sent, and anonymous retros are covered by the same rule (§6.3).

## 12. Changes to the parent spec

- Phases: `RetroPhase` gains `HealthCheck` and `Icebreaker` before `Writing`; adjacency is computed over the retro's enabled phases (§2.2). The parent phase table gets a note pointing here.
- Redaction table: "Others' card content / author hidden" applies to `HealthCheck` and `Icebreaker` as well as `Writing`.
- Templates: the `RetroTemplate` enum is replaced by the catalogue (§8); column titles go up to 100 characters and columns gain a description.
- Votes per participant: nullable (automatic), changeable in every phase before `Voting`.
- Completed read-only: ROTI (and the facilitator's summary actions) are allowed in `Completed`.
- The parent "summary view (top-voted cards + action items)" becomes the Results view (§6).

## 13. UI

- **Stepper:** renders `retro.phases`, with the new labels "Health check" and "Icebreaker".
- **Health check phase:** centred list of the six statements, each with a 1–10 segmented control (Awful … Great), a check mark once answered, answer count and avatars (names on hover; counts only on anonymous retros), and a "Clear" action for the own answer. Mobile: the scale wraps to two rows of five.
- **Icebreaker phase:** "Warm-up" panel with the question (§2.5).
- **Surveys:** a leftmost "Surveys" column appears in `Writing`–`Discussing` when the retro has surveys. Each survey card shows question, description, options as buttons; after answering (or when closed) each option shows a percentage bar and count, the own choice is marked, voter avatars (names on hover) under each option when "Show who answered" is on, "n responses" at the bottom; facilitator ⋮ menu: Edit (only without responses), Close / Reopen, Delete. Toolbar "Add survey" (facilitator) opens a dialog with question, description, dynamic option list (2–10), a "Show who answered" switch (off by default; disabled with an explanatory hint on anonymous retros), and, when `features.llm`, a "Generate from a prompt" field.
- **Results view** (§6) with inline-SVG `HealthRadar` and `HealthTrend` components; `prefers-reduced-motion` respected (no chart animation).
- **ROTI:** five labelled buttons in `Discussing` (under action items) and in Results.
- **Settings dialog:** switches "Health check" and "Icebreaker"; vote limit becomes "Automatic" or a number; "Automatic AI summary" switch (only when `features.llm`, disabled once `Completed`) with the privacy notice of §6.3.
- **Column header:** description under the title; column menu edits it.
- **Team page:** "New retrospective" dialog (§8.4).
- Every new string exists in `lang/{en,fr,es,de}.json`, template strings in `lang/{locale}/templates.php`.

## 14. Error handling

- Rejected mutation (phase, lock, closed survey, limits) → 403/422/423 with a translated message → optimistic update rolled back + toast, as for votes.
- Survey or option deleted concurrently → 404 → survey removed locally / refetched.
- LLM: survey draft: provider error or timeout → 502 "The text generator is unavailable. Try again later."; invalid output → 502 with the survey-specific message (§5.3); 429 → "Too many requests, wait a moment.". Summary job: retried 3 times, then `summary_status = failed`; the Results view keeps working without a summary and the facilitator sees a Retry button (§6.3).
- Turning off the current phase → 422 (§2.3).

## 15. Testing

Pest feature tests alongside `tests/Feature/Retros/*`; LLM calls faked with `Http::fake()`.

- **Phases:** `Retro::phases()` for each toggle combination; new retros start in the first enabled phase; `canMoveTo` rejects skipping and accepts neighbours over the enabled list; turning off the current phase → 422; toggles facilitator-only, rejected in `Completed`, broadcast `settings.changed`; timer and engagement settings accepted in the new phases.
- **Card redaction:** after moving back from `Writing` to `Icebreaker` or `HealthCheck`, others' cards are hidden in the snapshot and broadcasts.
- **Health check:** upsert/clear per statement; score 0 and 11 → 422; unknown statement → 404; 403 outside `HealthCheck`; 423 locked; `health.answered` carries counts and ids, ids empty on anonymous retros, never scores; the snapshot never contains another participant's score; snapshot `myScore` only for the author; aggregates: averages, score, top strength/growth area (ties, all-equal), alignment formula on known inputs, assessment bands, no minimum-respondents rule (an average is reported with 1 or 2 answers; a statement with no answer → `null` and excluded); participation denominator; trend limited to 6 completed retros of the same team, excluded for guests, constant query count.
- **Surveys:** create/edit/delete facilitator-only with limits (1 option, 11 options, 11th survey → 422); edit refused once answered; answer/change/withdraw; closed → 422; completion closes all; counts `null` before answering and visible after or when closed; `show_voters` off (default): no participant id in any survey payload or broadcast; on: `voters` present only once counts are visible, absent in broadcasts; on an anonymous retro, `show_voters: true` → 422 on create and update and `voters` always `null`; `show_voters` togglable on a survey with responses while other edits stay refused; version bump on toggle; `optionId` from another survey → 422; lock rules.
- **ROTI:** allowed in `Discussing` and `Completed`, 403 elsewhere; not blocked by lock; distribution and average present in `Completed` even with a single rating, absent outside `Completed`.
- **Vote limit:** automatic = top-level cards + 3 capped at 10 (0 cards → 3; 20 cards → 10); grouped cards count once; fixed value unchanged; exceeding → 422; `remainingVotes` after moving back and grouping; settings accept `null`.
- **Templates:** every catalogue key creates a retro with its columns and descriptions in the creator's locale; unknown key → 422; existing keys still resolve; all four locales have every template key; title up to 100 characters accepted; description editable with cards, title not.
- **Results:** `results` only in `Completed`; participants listed; `POST`/`DELETE /summary` facilitator-only, `Completed`-only, 404 without provider; survey draft validated (invalid JSON or 11 options → 502) and not persisted.
- **AI summary:** with `Queue::fake()`, moving to `Completed` dispatches `GenerateRetroSummary` only when a provider is configured and `ai_summary_enabled` is true (not when opted out, not without provider); new retros default `ai_summary_enabled` true with a provider and false without; the flag is togglable by the facilitator until `Completed` (422 without provider, 403 for others, rejected in `Completed`); running the job with `Http::fake()` stores summary, timestamp, `ready` and broadcasts `results.changed`; the request body contains no participant names or ids, no author information (also on anonymous retros) and only revealed content; the job aborts without calling the provider if the retro is no longer `Completed`; provider failure → retries, then `failed` with no summary, results still render, and `POST /summary` re-queues (202, `pending`); a second `POST` while pending dispatches no second job; `DELETE` clears the summary.
- **Translations:** `TranslationKeysTest` passes for JSON and `templates.php`.
- **Manual two-browser walkthrough** (one guest): create a retro from the dialog with health check and icebreaker on; answer the health check in both browsers (avatars appear, no scores); icebreaker panel; surveys created, answered, results appear only after answering, closed; automatic vote limit shown; complete; Results view with radar, alignment, surveys, ROTI (distribution visible from the first rating), trend visible to the member and not to the guest; a survey with "Show who answered" on shows voters, and the switch is disabled on an anonymous retro; with an LLM key configured, generate a survey draft, complete a retro and see the summary appear automatically (and a retro created with the summary off gets none until the facilitator generates one); without a key, no LLM control anywhere.

Type-check and lint stay green; no frontend test runner is added.

## 16. Acceptance criteria

1. `HealthCheck` and `Icebreaker` phases exist, are toggled per retro, and phase moves follow the enabled list (§2).
2. Others' cards stay hidden in every phase before `Grouping` (§2.4).
3. Health-check answers are only visible to their author; others get counts (and who answered on non-anonymous retros) during the phase and, in results, every statement's average whatever the number of answers, never an individual score (§4, §11).
4. Health results show score, participation, top strength, growth area, alignment, assessment, and a team trend visible to members only (§4.4–4.5, §6).
5. Surveys follow the creation, answering, closing and result-visibility rules in §5; voters are visible only when the facilitator turned on "Show who answered", never on anonymous retros.
6. Completed retros open on a Results view with all sections of §6.2; ROTI follows §6.4; the summary follows §6.3 (automatic at completion unless opted out, retry on failure).
7. The automatic vote limit equals min(10, top-level cards + 3) and fixed limits behave as before (§7).
8. The catalogue offers the templates of §8 in en/fr/es/de with column descriptions stored and shown; the creation dialog previews them and sets the new options.
9. LLM features appear only with a configured provider, run server-side, send no personal data or hidden content, the automatic summary is opt-out per retro (creation and settings, until completion) with a privacy notice, and every screen works without them (§9, §6.3, §5.3).
10. All new strings are translated in en/fr/es/de; suite, phpstan, type-check and lint are green; no new dependency; walkthrough passes.

## Decisions (2026-09-29)

1. Health check: every statement's average is always shown whatever the number of answers (QRetro parity), with voter avatars; no "≥ 3 answers" threshold; individual scores are never exposed.
2. Survey ballot: per-survey facilitator switch "Show who answered" (default off: counts only); forced off and rejected on anonymous retros.
3. New-retro defaults: health check off, icebreaker off, vote limit automatic (cards + 3, max 10).
4. Icebreaker until spec 7: placeholder "Warm-up" panel with a built-in translated question and the timer.
5. ROTI window: `Discussing` and `Completed` (explicit exception to Completed read-only).
6. Template catalogue: all 52 templates, translated in en/fr/es/de.
7. LLM providers: Anthropic and any OpenAI-compatible endpoint (configurable base URL).
8. Results summary: generated automatically on completion by a queued job when a provider is configured, with a per-retro opt-out (`ai_summary_enabled`, set at creation, editable until completion); the facilitator can regenerate or retry on demand.
9. ROTI: average and distribution always shown (aligned with health check).
