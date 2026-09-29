# Skrum — Retro flow extras — Design

Date: 2026-09-29
Status: Approved decisions, awaiting spec review
Parent spec: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md` (all its rules apply unless this spec changes them explicitly — see §12), as amended by `docs/superpowers/specs/2026-09-29-board-engagement-design.md`
Research: `docs/superpowers/research/qretro/` (QRetro parity roadmap, spec 2 of 8; `templates.md` for the catalogue, `screens/retro-health-check.png`, `retro-survey.png`, `retro-results.png`, `retro-create.png`)

## 1. Intent

Give a retrospective the structure QRetro offers around the board: an optional team health check before writing, an icebreaker slot, surveys on the board, a results page when the retro is completed, an automatic vote limit, and a real template catalogue with column descriptions and a creation dialog with preview.

**Success:** every rule below is covered by a feature test or a step of the walkthrough (§10); the suite, phpstan, type-check and lint stay green; no new Composer or npm dependency is added; with no LLM provider configured, every screen works and shows only deterministic content.

### In scope

- Two optional phases before `Writing`: **Health check** (the team's statements, six by default, 1–10) and **Icebreaker** (phase slot and toggle only).
- Phase list driven by the retro's enabled phases; adjacency over that list.
- **Surveys** on the board: single choice, multiple choice (2–10 options) or free text, results after answering, close/reopen, reactions and comments.
- **Results** view for `Completed` retros: participants, team health (radar, score, participation, top strength, growth area, alignment, assessment, trend across the team's retros), survey results, top-voted cards, action items, games we played, ROTI.
- **ROTI** (return on time invested, 1–5) collected at the end of the meeting.
- **Automatic vote limit** (top-level cards + 3, max 10) next to the existing fixed `votes_per_participant`.
- **Template catalogue** (all 52 QRetro templates) with translated names, column titles and column descriptions; column descriptions stored on columns and shown under titles; a creation dialog with search, category filter and preview.
- **Optional LLM features** (only when the instance admin configures a provider, §9): generate a survey draft from a prompt; generate a results summary automatically when the retro is completed (per-retro opt-out) or on demand; suggest group names (§7.2).
- **Suggested actions and card insights** (same LLM job as the summary): themes (clusters of cards), suggested actions the facilitator can promote to action items or reject, and per-card `sentiment` and `category` (§6.5).
- *Scope additions (2026-09-30, Decision 11):*
  - **Custom health-check statements per team** (defaults = the six built-in statements), frozen per retro so results and trends stay comparable (§4.6).
  - **Richer surveys:** multiple-choice and free-text surveys (§5.4), plus emoji reactions and threaded comments on surveys, reusing spec 1's card patterns (§5.5).
  - **Workspace templates** stored in the database, and **template categories** for built-in and workspace templates (§8.5, §8.6).
  - **Group names:** anyone who can group names a card group; optional LLM-suggested names to accept or edit (§7.2).
  - **"Games we played"** on the Results view, reading the icebreaker rounds that spec 7 stores (§6.6).
  - Promoting a suggested action stores a copy of the theme name on the action item (`action_items.theme_name`, spec 3; §6.5).

### Out of scope (deferred)

- Icebreaker game logic (spec 7). This spec adds the phase, its toggle and a placeholder screen that spec 7 replaces with its game panel (§2.5), and renders spec 7's `results.games` read model under "Games we played" (§6.6).
- Health check outside the pre-writing slot; per-retro statement edits (statements are edited per team, §4.6); translating custom statements.
- Survey kinds beyond single, multiple and free text (ranking, scale); a maximum number of choices on multiple-choice surveys; moderating (deleting) others' free-text answers; unread dots for survey comments.
- "Send to email", Slack/Telegram sharing of results: built by spec 6 into this spec's Results view (Share menu and delivery lines, §6.1); spec 8 adds Microsoft Teams, Mattermost and generic webhooks to that menu.
- Action item changes (priority, due date, global list: spec 3).
- Saving a retro's columns as a workspace template from the board; sharing templates across workspaces; workspace-defined categories (scope decision 4); translated workspace templates.
- Health data in MCP (spec 5 reads what this spec stores).

### Dependencies

None new. Charts (radar, trend sparkline) are inline SVG components. LLM calls use Laravel's HTTP client; the results summary runs in a Laravel queued job (needs a running queue worker, as for the rest of the app's jobs). "Games we played" (§6.6) renders `results.games`, built by spec 7's `BuildGamesPlayed` from its tables (`game_rooms`, `game_rounds`, `game_players`, `game_points`, `game_gif_answers`, `game_gif_votes`); spec 7 comes later in the roadmap, so that section is built in or after spec 7's plan and is absent (`results.games: null`) until then. Survey reactions and comments reuse spec 1's `SingleEmoji` rule, reaction summary and comment presenter.

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

- `health_check_enabled`, `icebreaker_enabled` and `ai_summary_enabled` (§6.3) are set at creation (§8.4) and through `PATCH /retros/{retro}/settings` (facilitator only), in any phase except `Completed`, broadcasting `settings.changed`. Spec 7 adds `icebreaker_game` to both, with the same rules (`gif` refused with 422 when no GIF provider is configured, spec 7 §2). `ai_summary_enabled` is rejected with 422 "Not available." when no LLM provider is configured.
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

Until spec 7 adds games, the `Icebreaker` phase shows a "Warm-up" panel with one question from a built-in list of 12 translated questions (e.g. "What was the highlight of your week?"), chosen deterministically from the retro id, plus the shared timer. Nothing is stored.

Once spec 7 is built (spec 7 §6), the phase shows spec 7's game panel instead of the Warm-up panel, starting with `retros.icebreaker_game` (spec 7 §2); leaving `Icebreaker` ends the active game round as `Abandoned` inside the phase-change transaction; turning the phase off keeps the icebreaker room and its rounds (removed only with the retro), so they still appear under "Games we played" (§6.6). The phase, toggle and adjacency rules of this section stay unchanged.

## 3. Data model

### `retros` — new columns

| Column | Type / default | Meaning |
|---|---|---|
| `health_check_enabled` | bool, `false` | Health check phase in the flow |
| `icebreaker_enabled` | bool, `false` | Icebreaker phase in the flow |
| `ai_summary_enabled` | bool, DB default `false` | Automatic results summary at completion (§6.3). Existing retros never opted in; a new retro gets `true` when a provider is configured and the creator did not opt out |
| `summary` | text, nullable | LLM-generated results summary (plain text, ≤ 2000 characters) |
| `summary_generated_at` | timestamp, nullable | When `summary` was generated |
| `summary_status` | string, nullable | `pending`, `ready` or `failed`; `null` = never requested. Covers the whole generation (summary, themes, suggested actions, card insights) |
| `workspace_template_id` | nullable FK `workspace_templates`, null on delete | Workspace template the retro was created from (§8.5); `template` is then `workspace` |
| `icebreaker_game` | string (`GameKind`), default `draw` | Added by spec 7 §2 (not by this spec): the game the icebreaker room starts with |

`votes_per_participant` becomes nullable: `null` means automatic (§7). Existing rows keep their value. `template` stops being cast to the `RetroTemplate` enum and becomes a plain string validated against the catalogue (§8): a built-in key, or `workspace` for a retro created from a workspace template.

### `columns` — changes

- New `description` (nullable string, ≤ 200 characters).
- `title` limit raised from 60 to 100 characters (the longest catalogue title is 81), in the migration and in `ColumnsController` validation.

### `cards` — new columns

- `sentiment` (string, nullable): `positive`, `neutral` or `negative`. `category` (string, nullable, ≤ 40 characters): short label in the output language. Both are written only by the generation job (§6.5), never by users, and are `null` when nothing was generated.
- `group_name` (string, nullable, 1–60 characters): name of the group led by this card (§7.2). Only set on a top-level card that has at least one grouped card.

### `retro_themes` — new table

- `id` (UUID), `retro_id` (cascade), `name` (string, ≤ 80), `position` (int), timestamps.

### `retro_theme_cards` — new table

- `theme_id` (cascade), `card_id` (cascade). Unique (`theme_id`, `card_id`). A card belongs to at most one theme.

### `suggested_actions` — new table

- `id` (UUID), `retro_id` (cascade), `theme_id` (nullable, null on delete), `content` (string, ≤ 500, the wording), `position` (int), `status` (string: `pending`, `promoted`, `rejected`; default `pending`), `action_item_id` (nullable, null on delete; set when promoted), `handled_by_participant_id` (nullable), `handled_at` (nullable timestamp), timestamps.
- A suggestion is handled once: only a `pending` suggestion can be promoted or rejected.

### `health_check_answers` — new table

- `id` (UUID), `retro_id` (cascade), `participant_id` (cascade), `statement` (string, the `key` of one of the retro's `retro_health_statements`, §4.6), `score` (unsigned tinyint 1–10), timestamps.
- Unique (`retro_id`, `participant_id`, `statement`).

### `team_health_statements` — new table (§4.6)

| Column | Type / default | Meaning |
|---|---|---|
| `id` | UUID | Also the `key` of a custom statement |
| `team_id` | FK teams, cascade | |
| `builtin` | nullable string (`HealthStatement` value) | Set for a built-in statement, `null` for a custom one |
| `text` | nullable string (1–150) | Custom statement text, `null` for built-ins |
| `label` | nullable string (1–30) | Custom radar axis label, `null` for built-ins |
| `position` | int | Display order among the team's active statements |
| `archived_at` | nullable timestamp | Archived statements are not used by new retros; they can be restored |
| timestamps | | |

- Unique (`team_id`, `builtin`) where `builtin` is not null. Check constraint: either `builtin` is set and `text`/`label` are null, or `builtin` is null and both are set.
- A team with no row uses the six built-in statements in enum order (nothing is stored until the first edit).

### `retro_health_statements` — new table (§4.6)

- `id` (UUID), `retro_id` (cascade), `key` (string: the `HealthStatement` value for a built-in, the `team_health_statements.id` for a custom statement), `team_health_statement_id` (nullable FK, null on delete), `builtin` (nullable string), `text` (nullable string ≤ 150), `label` (nullable string ≤ 30), `position` (int), timestamps. Unique (`retro_id`, `key`).
- The frozen set of statements a retro's health check uses; answers, aggregates and the radar read only this set.

### `surveys` — new table

- `id` (UUID), `retro_id` (cascade), `created_by_participant_id`, `kind` (string `SurveyKind`: `single`, `multiple`, `text`; default `single`, §5.4), `question` (string, 1–200), `description` (nullable string, ≤ 500), `position` (int), `is_closed` (bool, default `false`), `show_voters` (bool, default `false`; always `false` on anonymous retros, §5.1), `version` (int, default 1; incremented on every structural change: edit, close, reopen, `show_voters` change), timestamps.

### `survey_options` — new table

- `id` (UUID), `survey_id` (cascade), `label` (string, 1–100), `position` (int). Text surveys have none.

### `survey_responses` — new table

- `id` (UUID), `survey_id` (cascade), `survey_option_id` (cascade), `participant_id` (cascade), timestamps.
- Unique (`survey_id`, `participant_id`, `survey_option_id`). A `single` survey holds at most one row per participant (enforced by the answering action inside the locked transaction); a `multiple` survey one row per chosen option.

### `survey_text_answers` — new table (§5.4)

- `id` (UUID), `survey_id` (cascade), `participant_id` (cascade), `content` (text, 1–500 characters), timestamps. Unique (`survey_id`, `participant_id`).

### `survey_reactions` — new table (§5.5)

- `id` (UUID), `retro_id` (cascade), `survey_id` (cascade), `participant_id` (cascade), `emoji` (string, spec 1 `SingleEmoji` rule), timestamps. Unique (`survey_id`, `participant_id`, `emoji`).

### `survey_comments` — new table (§5.5)

- `id` (UUID), `retro_id` (cascade), `survey_id` (cascade), `participant_id` (cascade), `parent_comment_id` (nullable self-FK, cascade), `content` (nullable text, 1–500 characters when present), `deleted_at` (nullable timestamp), timestamps. Same shape and one-level rule as spec 1's `card_comments`.

### `workspace_templates` — new table (§8.5)

- `id` (UUID), `workspace_id` (cascade), `name` (string, 1–80; unique per workspace, case-insensitive), `category` (string, `TemplateCategory` value, §8.6), `created_by_user_id` (nullable, null on delete), timestamps.

### `workspace_template_columns` — new table (§8.5)

- `id` (UUID), `workspace_template_id` (cascade), `title` (string, 1–100), `description` (nullable string, ≤ 200), `color` (`ColumnColor`), `position` (int). 1–10 columns per template.

### `roti_votes` — new table

- `id` (UUID), `retro_id` (cascade), `participant_id` (cascade), `score` (unsigned tinyint 1–5), timestamps. Unique (`retro_id`, `participant_id`).

All new tables use UUID primary keys and `foreignUuid` like the rest of the schema.

## 4. Health check

### 4.1 Statements

Enum `App\Enums\HealthStatement` holds the six built-in statements, the default set of every team (order = default display order = radar axes). A team can reorder, archive and restore them and add custom statements (§4.6); a retro uses the frozen set copied into `retro_health_statements`, in its stored order.

| Value | Statement (translation key) | Axis label |
|---|---|---|
| `interaction` | Interaction with colleagues was productive | Interaction |
| `task_clarity` | Tasks assigned to me were clear | Clear tasks |
| `manager_support` | My manager was understanding and supportive | Manager support |
| `vision` | The vision and goals are clear to me | Vision |
| `processes` | Our processes let me work without blockers | Processes |
| `motivation` | I felt motivated in my work | Motivation |

Built-in statements and scale labels ("Awful" at 1, "Great" at 10) are translation keys rendered in the viewer's locale; nothing is stored as text for them. Custom statements are shown as typed (§4.6).

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
- Each point also carries `sameStatements: bool`: true when its set of statement keys equals the previous point's (always true for the first point). When false, the delta to the previous point is still computed but the sparkline marks the point and the tooltip says "The statements changed since the previous retro" (§4.6).

### 4.6 Team statements (custom health check)

- **Where:** a "Health check statements" section on the team page (`teams/show.tsx`). Every viewer of the team sees the active list; managing it requires `TeamPolicy::update` (workspace Owner/Admin, scope decision 2).
- **Built-in statements:** can be reordered, archived and restored, never reworded (their text is a translation key). To reword one, archive it and add a custom statement.
- **Custom statements:** `text` 1–150 characters and `label` (radar axis) 1–30 characters, stored as typed (not translated). Adding, rewording, reordering, archiving and restoring are allowed at any time.
- **Limits:** a team always has 3–10 active statements (fewer than 3 makes a meaningless radar) → 422 "A team needs between 3 and 10 health check statements." Archived statements are kept forever (past retros refer to them by key) and do not count. At most 30 statements per team including archived ones (422).
- **Materialisation:** a team with no row uses the six built-ins. The first change creates the six built-in rows (positions 0–5) and applies the change, in one transaction.
- **Frozen set per retro:** when the health check becomes enabled on a retro (at creation with `health_check_enabled`, or through `PATCH /settings`), the team's active statements are copied into `retro_health_statements` (key, text, label, position), in the same transaction. If the retro already has a set and **no answer**, the set is replaced by the team's current statements; if it has answers, the set is kept. Team edits never change a set that has answers, so past results keep the statements people actually answered.
- **Identity and comparability:** a statement's `key` is its identity across retros: a built-in's enum value, or a custom statement's id. Rewording a custom statement keeps its key (scope decision 1): later retros show the new wording, earlier retros keep the wording they froze. Archiving and re-adding creates a new key. Aggregates (§4.4) are computed per retro over its own set; comparisons across retros match statements by key: the trend's `sameStatements` flag (§4.5), and per-statement comparisons in spec 5's `team-health` prompt.
- **Answer endpoint:** `{statement}` in `/health-check/{statement}` is a key of the retro's set; any other value → 404.
- **Endpoints** (`auth`, `verified`, `can:view,workspace`, scoped to the team; Inertia, redirect back with a flash message, following `TeamsController`):

| Method | Path | Body | Who |
|---|---|---|---|
| POST | `/w/{workspace}/teams/{team}/health-statements` | `{text, label}` | `TeamPolicy::update` |
| PATCH | `/w/{workspace}/teams/{team}/health-statements/{statement}` | `{text, label}` (custom only; a built-in → 422 "Built-in statements cannot be reworded.") | same |
| PUT | `/w/{workspace}/teams/{team}/health-statement-order` | `{ids[]}` (every active statement id exactly once, else 422) | same |
| PUT / DELETE | `/w/{workspace}/teams/{team}/health-statements/{statement}/archival` | — | same (archive / restore) |

  The virtual built-ins of a team with no row are addressed by their enum value in `{statement}` and `ids[]`; the materialisation step maps them to the new rows. Controller `App\Http\Controllers\TeamHealthStatementsController` (`store`, `update`), `TeamHealthStatementOrdersController`, `TeamHealthStatementArchivalsController`; logic in `App\Actions\HealthCheck\*` actions. Routes named `teams.healthStatements.*`.
- **Presented statement** (snapshot, results, team page): `{key, label, text, isBuiltin}` where built-in `label`/`text` are translated in the viewer's locale and custom ones are the stored strings.

## 5. Surveys

### 5.1 Rules

- **Create / edit / delete:** facilitator only, in phases `Writing` to `Discussing`, not while locked (423). At most 10 surveys per retro (422). Choice surveys (`single`, `multiple`) have 2–10 options (422 otherwise), each 1–100 characters; `text` surveys have none (options sent → 422); question 1–200; description ≤ 500.
- **Edit** (kind, question, description, options) only while the survey has no response (422 "This survey already has answers."). The `show_voters` switch is the exception: it can be changed at any time before `Completed`, with or without responses, open or closed. Delete is always allowed for the facilitator and removes its responses.
- **Show who answered (`show_voters`):** per-survey facilitator switch, default off, accepted by `POST` and `PATCH` (a `PATCH` carrying only `show_voters` is allowed on a survey with responses). Off: counts only. On: each option also lists the participants who chose it, under the same visibility rule as counts (below). On an anonymous retro the switch is forced off: any request setting it to true → 422 "Names are never shown on anonymous retros.", and the presenter also returns no voters whenever the retro is anonymous.
- **Answer:** any participant, phases `Writing` to `Discussing`, survey open, not locked. `PUT` sets or replaces the participant's whole answer (shape by kind, §5.4); `DELETE` withdraws it. Closed survey → 422 "This survey is closed."
- **Close / reopen:** facilitator only, any phase except `Completed`, allowed while locked. Moving the retro to `Completed` closes every open survey in the same transaction; reopening the retro leaves them closed.
- **Results visibility:** a viewer receives option counts only when they have answered that survey or the survey is closed. Otherwise counts are `null` (redaction is done server-side, not by the client). Everyone always sees the number of responses.
- **Ballot secrecy:** unless `show_voters` is on, who chose which option is never sent to anyone, in any phase. When on, voter ids are sent only together with the counts (viewer answered or survey closed) and never on anonymous retros. Broadcasts never carry voters.

### 5.2 Survey payload (per viewer)

`{id, kind, question, description, position, isClosed, version, showVoters, responseCount, myOptionIds, myText, resultsVisible, options: [{id, label, position, count, voters}], textAnswers, reactions, commentCount, comments}` — `responseCount` is the number of distinct participants who answered; `myOptionIds` is the viewer's chosen option ids (`[]` when none; at most one for `single`); `myText` the viewer's own free-text answer or `null`; `count` is `null` when `resultsVisible` is false; `voters` is `null` unless `showVoters` and `resultsVisible` and the retro is not anonymous, else the list of participant ids who chose the option; `textAnswers` is §5.4; `reactions`, `commentCount`, `comments` are §5.5. Participant ids appear nowhere else in survey payloads (the `authorId` of text answers and comment authors follow the same conditions, §5.4–5.5).

### 5.3 LLM survey draft (optional)

- `POST /retros/{retro}/survey-drafts` `{prompt, kind?}` (prompt 1–300 characters; `kind` defaults to `single`), facilitator only, same phases as creation. Available only when an LLM provider is configured (§9); otherwise 404 and the button is hidden.
- The provider receives the prompt, the kind and the retro title, and returns a question, an optional description and, for choice kinds, 2–10 options in the facilitator's locale (for `text`, options are not requested and any returned are dropped). The server validates the result against §5.1 limits without truncating it (an invalid draft → 502 "Could not generate a survey. Try again or write it yourself.").
- Nothing is saved: the draft prefills the survey dialog, and the facilitator edits and saves it through the normal endpoint.
- Rate limit: 10 drafts per minute per participant (429).

### 5.4 Multiple-choice and free-text surveys

- Enum `App\Enums\SurveyKind`: `Single = 'single'`, `Multiple = 'multiple'`, `Text = 'text'`. Chosen in the survey dialog; changeable only while the survey has no response (§5.1).
- **Answer shape** (`PUT /surveys/{survey}/response`): `single` → `{optionId}`; `multiple` → `{optionIds}` (1 to all options, distinct, every id of this survey); `text` → `{text}` (1–500 characters, trimmed). A body that does not match the kind, or an option of another survey → 422. The new answer replaces the previous one entirely (rows deleted and inserted in the locked transaction). `DELETE` removes every row of the participant for that survey.
- **Counts:** per option, the number of participants who chose it; `responseCount` counts distinct participants. Percentages are `count / responseCount`, so a `multiple` survey's percentages can add up to more than 100 % (the UI says "Several answers allowed").
- **Free-text answers** (`textAnswers`): `null` unless `resultsVisible` (same rule as counts: viewer answered or survey closed); then `[{id, text, authorId, isMine}]`. `authorId` is a participant id only when `showVoters` is on and the retro is not anonymous, else `null`. Answers are ordered by text (case-insensitive), never by time or author, so their order cannot be matched to who answered when. The author edits their answer with `PUT` while the survey is open, or withdraws it.
- **Broadcasts** keep the §5.1 rule: `survey.changed` carries no option, no text and no participant.
- **Results view** (§6.2 Surveys): choice surveys show bars and percentages; text surveys list the answers (with names only when `showVoters` is on and the retro is not anonymous).
- **LLM summary input** (§6.3): closed choice surveys send counts; closed text surveys send their answers as quoted data without any author (scope decision 6), at most 50 answers per survey, inside the global 30 000-character cap.

### 5.5 Survey reactions and comments

Reuses spec 1 §4's card patterns (toggle reactions with `SingleEmoji`, one level of threaded replies, soft delete of parents with replies, facilitator can delete any comment, `mine`/`isMine` flags), with these survey rules:

- **When:** phases `Writing` to `Discussing`, on open or closed surveys. `Completed` → read-only (403). `is_locked` → 423. Reactions additionally require `reactions_enabled` (403).
- **Who and visibility (scope decision 3):** a participant can see and join a survey's discussion only when that survey's results are visible to them (`resultsVisible`: answered or closed). Otherwise reacting or commenting → 403 "Answer the survey to join the discussion.", and the payload has `reactions: []`, `comments: []` and only `commentCount`. This keeps the discussion from steering answers or revealing results early, as for counts.
- **Names and anonymity:** reaction `names` are sent only when `showVoters` is on and the retro is not anonymous (otherwise counts only), because with results hidden until answering, a named reaction reveals who answered. Comment authors are shown on non-anonymous retros (a comment is a deliberate, signed contribution; the composer says "Your name is shown with your comment." when `showVoters` is off) and never on anonymous retros. No comment or reaction ever shows the author's chosen option.
- **Endpoints** (under `/retros/{retro}/…`): `PUT` / `DELETE` `/surveys/{survey}/reactions` `{emoji}` → the survey for the viewer (idempotent); `POST /surveys/{survey}/comments` `{content, parentCommentId?}` → 201 comment presented for the author; `PATCH /survey-comments/{comment}` `{content}`; `DELETE /survey-comments/{comment}` → 204. A `parentCommentId` of another survey → 422. Controllers `SurveyReactionsController`, `SurveyCommentsController`; spec 1's reaction summary (`SummarizeReactions`) and comment presenter are generalised to take a survey or a card.
- **Broadcasts:** `survey.discussion.changed {surveyId, commentCount}` only, never content, names or emoji; clients whose results are visible refetch `GET /surveys/{id}` (debounced 1 s). The author's other tabs get `own-survey-comment.saved` on the private `participant.{id}` channel.
- **Notifications:** a new comment or reply sends spec 1's `comment.notification` (payload with `surveyId` instead of `cardId`) to the survey's creator and to every participant who already commented in the same thread, minus the author, and only to recipients whose results of that survey are visible. `authorName` only on non-anonymous retros.
- **Deleting a survey** deletes its reactions and comments. Editing a survey (no responses yet) keeps them.
- **Results view:** each survey shows its reaction chips and a collapsed, read-only comment thread.

## 6. Results view (`Completed`)

### 6.1 Placement

When the retro is `Completed`, the board page shows two tabs: **Results** (default) and **Board** (the existing read-only board). The Results view replaces `completed-summary.tsx`. The facilitator's "Reopen" stays in the header. Guests who open a completed retro through a still-enabled guest link see the same view without the health trend.

Spec 6 adds a **Share** menu to the Results header for those allowed to share (the retro's facilitator when a team member, and workspace Owners/Admins, spec 6 §8): "Send to email", "Share to Slack", "Share to Telegram", and with spec 8 "Share to Microsoft Teams", "Share to Mattermost", "Send to webhook"; each entry appears only when that channel is available (snapshot `integrations`, spec 6 §9 / spec 8 §7), with a muted delivery line per channel from `results.deliveries` (§10.3). `results.changed` is also broadcast when a delivery finishes (spec 6 §5.5). Every transition into `Completed` dispatches the plain event `RetroCompleted` (§10.2).

### 6.2 Sections

1. **Thanks for participating** — every participant of the retro (avatar and name). This lists who joined, never who wrote what; it is shown on anonymous retros too, like the presence strip.
2. **Summary, themes and suggested actions** — when `ai_summary_enabled` and a provider is configured: the stored LLM summary; a "Generating the summary…" skeleton while `summary_status` is `pending`; nothing but, for the facilitator, "The summary could not be generated" with a Retry button when `failed`. The facilitator also has "Regenerate" and "Remove" (§6.3), and "Generate summary" when none exists (e.g. opted out). Below the summary: the **themes** (name and the cards they group, with the card's sentiment as a small icon and its category as a chip) and the **suggested actions** (§6.5): pending ones with Promote and Reject buttons for those allowed to (§6.5), promoted ones with a link to their action item, rejected ones collapsed under "Dismissed (n)". Without a provider the section is absent.
3. **Team health** (when `health_check_enabled` and at least one answer) — radar (one axis per statement of the retro's frozen set, 3–10, labelled with the statement's `label`; 0–10; axes without answers drawn as gaps and labelled "No answers"), score `x.x/10`, participation `n / m participants`, top strength and growth area with their averages, alignment `n/10` with its level, assessment sentence, and the trend sparkline with delta (members only).
4. **Surveys** — every survey with its final counts and percentages, and the voters per option when `show_voters` is on (all surveys are closed at this point); text answers, reactions and comments per §5.4–5.5.
5. **Top topics** — the 5 top-level cards with the most votes (existing `sortByVotes`), with the group name when set (§7.2) and the number of grouped cards.
6. **Action items** — the retro's items, read-only, with the fields and link that spec 3 §8 lists for this section (priority, due date, overdue badge, assignee, status, theme).
7. **Games we played** (§6.6) — only when `results.games` is not `null` (the retro's icebreaker room has at least one ended, non-abandoned round).
8. **ROTI** — the viewer's own rating control (§6.4) and the distribution (1–5 bars), the average (one decimal) and the respondent count.

### 6.3 LLM summary (optional)

- **Automatic generation:** when a retro moves to `Completed`, if a provider is configured and `ai_summary_enabled` is true, the transition sets `summary_status = pending` and dispatches the queued job `GenerateRetroSummary` after commit (broadcasting `results.changed`). `ai_summary_enabled` is chosen at creation (§8.4, default on when a provider is configured) and editable by the facilitator in the settings dialog until completion (§2.3); it is locked once `Completed`. Opting out means no content is ever sent automatically.
- **Job:** unique per retro, `tries = 3` with backoff (10 s, 60 s), provider timeout 60 s. At run time it aborts silently unless the retro is still `Completed` and the provider is configured, so nothing is sent if the facilitator reopened the retro. On success it stores `summary`, `summary_generated_at`, `summary_status = ready` and broadcasts `results.changed`. After the last failed attempt (`failed()`), it sets `summary_status = failed`, leaves `summary` null, logs the error without the key or board content, and broadcasts `results.changed`: the Results view shows no summary and the facilitator can retry.
- **On demand:** `POST /retros/{retro}/summary` — facilitator only, `Completed` only, provider configured (else 404), whatever `ai_summary_enabled` says. Sets `pending` (a request while already `pending` returns 202 without a second job; a `pending` older than 10 minutes counts as `failed`), dispatches the same job, broadcasts `results.changed` and returns 202 `{status}`. Rate limit 5 per minute per retro. Used for "Generate", "Regenerate" and "Retry". Completing the retro again after a reopen regenerates (and overwrites) the summary when `ai_summary_enabled` is true.
- `DELETE /retros/{retro}/summary` — facilitator only, clears `summary`, `summary_generated_at` and `summary_status`, broadcasts `results.changed`. It does not disable the automatic generation.
- **Input sent to the provider** (data minimisation): only built by the job at `Completed`, when every card is revealed, so no Writing-phase-hidden data can leak. Content: retro title, column titles, top-level card contents with their group name (§7.2), grouped children and vote totals (most-voted first, input capped at 30 000 characters), action item contents and done state, health aggregates from §4.4 labelled with the statements' labels, closed survey results (counts only, no voters; text answers without authors, §5.4), ROTI aggregate. Survey reactions and comments, and games, are never sent. Never sent, on any retro: participant names or ids, card authors, assignees, GIFs, comments, reactions; anonymous retros therefore send no author information either.
- Output language: the retro creator's locale, else the facilitator's (the job has no request). The output is trimmed to 2000 characters and rendered as plain text (no HTML or Markdown).
- **Privacy notice:** the creation dialog and the settings switch carry "When the retro is completed, its board content is sent automatically to :provider to write a summary. Participants can also ask it to suggest group names. Turn this off to keep it on this server."; the Results view names the provider next to a generated summary.

### 6.4 ROTI

- `PUT /retros/{retro}/roti` `{score}` (1–5) and `DELETE /retros/{retro}/roti`, any participant.
- Allowed in `Discussing` and `Completed`. This is an explicit exception to "Completed is read-only": ROTI is feedback on the meeting, not board content. `is_locked` does not block it.
- In `Discussing` a compact "How was this retro?" prompt (1–5 with labels: Time wasted, Not really worth it, Break-even, Good use of time, Excellent use of time) sits under the action items panel; in `Completed` it is part of the Results view.
- The distribution and average are sent only in `Completed`, whatever the number of ratings (aligned with the health check); before `Completed` only the respondent count and the viewer's own score are sent. Individual ratings are never exposed.

### 6.5 Suggested actions and card insights (optional)

- **Same job, same conditions:** `GenerateRetroSummary` also produces themes, suggested actions and per-card insights in the same provider call, when a provider is configured and `ai_summary_enabled` is true at `Completed`. It is regenerated by `POST /summary` (Generate, Regenerate, Retry) and cleared by `DELETE /summary`. The input, redaction and privacy notice of §6.3 apply unchanged, with these additions: card ids are sent as opaque per-request indexes (never the UUIDs), and only top-level and grouped card contents already revealed at `Completed` are sent. Nothing is sent per author: no names, ids or authorship, also on named retros.
- **Output** (validated; anything invalid is dropped, and a fully invalid output fails the job like an invalid summary):
  - **Themes:** 1–8 clusters `{name, cardIds}`; ids must belong to the retro, a card appears in at most one theme, unknown ids are ignored.
  - **Suggested actions:** 0–8 items `{content, theme?}` (content ≤ 500 characters, plain text, in the output language of §6.3), each optionally attached to one theme by name.
  - **Card insights:** `{cardId, sentiment, category}` per card; `sentiment` outside `positive|neutral|negative` or an empty category is stored as `null`. Sentiment and category describe the card, never its author; there is no per-participant aggregate.
- **Storage:** on success, in one transaction, existing themes, `pending` suggestions and card insights of the retro are replaced. Suggestions already `promoted` or `rejected` are kept (history is not rewritten) and are not proposed again when their wording equals a new one. On failure or `DELETE /summary`, themes, `pending` suggestions and card `sentiment`/`category` are cleared to `null`/empty; handled suggestions stay.
- **Without a provider, or when the retro opted out:** no themes, no suggestions, `sentiment` and `category` are `null` on every card.
- **Actions:** promote and reject are the actions `App\Actions\Retros\PromoteSuggestedAction` and `RejectSuggestedAction`, called by the controllers below and by the MCP tools `retro.board.suggested_actions.promote|reject` (spec 5), so both surfaces share rules, locking and broadcasts.
- **Promote** (`POST /retros/{retro}/suggested-actions/{suggestedAction}/promotion`): creates an action item through spec 3's `CreateActionItem` action with the suggestion's `content` unchanged, no assignee, default priority, the acting participant as author, a reference to the theme it came from (`action_items.theme_id`, spec 3 §2: nullable, null on theme deletion) and a copy of that theme's name (`action_items.theme_name`, spec 3 §2: nullable string ≤ 80, written only by this action, never client-writable). The copy survives summary regeneration, `DELETE /summary` and failure, which delete themes and so null `theme_id`; `PresentActionItem` exposes `themeId` (null once the theme is gone) and `themeName` read from `theme_name`, and the name is shown next to the item. A suggestion without a theme stores both as `null`. Then sets `status = promoted`, `action_item_id`, `handled_by_participant_id`, `handled_at`. Returns the action item and the suggestion. Already handled → 422 "This suggestion was already handled."
- **Reject** (`DELETE /retros/{retro}/suggested-actions/{suggestedAction}`): sets `status = rejected` with the same handling fields (the row is kept, so it is not proposed again). Already handled → 422.
- **Who and when:** available in `Discussing` and `Completed`, when the suggestion is `pending`. Allowed to the facilitator and to anyone whom spec 3 lets create action items in that phase; in `Discussing` that is every participant, in `Completed` (where nobody creates action items) only the facilitator and workspace Owners/Admins (`viewer.canManageActionItems`). Others → 403. `is_locked` blocks it in `Discussing` (423) but not in `Completed`. **Exception to "Completed is read-only":** like ROTI, handling a suggestion in `Completed` is allowed, and promoting there creates an action item in a completed retro (spec 3's phase rule on board creation does not apply to this action, which is called with the promote permission above). Promoting or rejecting in other phases → 403.
- **Results and Discussing UI:** see §13. Promotion broadcasts `action-item.saved` (spec 3) only outside `Completed` and always `insights.changed`.

### 6.6 Games we played

- **Source:** spec 7's read model `results.games` (spec 7 §6.1), built by its `BuildGamesPlayed` presenter and added to `results` by this spec's snapshot builder. It reads the retro's icebreaker room (`game_rooms.retro_id = retro.id`), its ended rounds except `Abandoned`, their players and the room's `game_points`; `BuildGamesPlayed` reuses spec 7's standalone round-history presenter `App\Actions\Games\PresentGameRoundHistory`. This spec adds no game table, column or logic. Spec 7 keeps the newest 20 rounds per room, so at most 20 appear.
- **Shown** in the Results view when `results.games` is not `null` (the room has at least one ended, non-abandoned round), whatever `icebreaker_enabled` says now (turning the phase off keeps the room, §2.5). Otherwise the section is absent.
- **Content** (spec 7 §6.1, §9): one row per round, oldest first — game, word or question, Decoded clue, outcome, leader and winner, Sprint in one GIF answers with their final vote counts, a "Replay" link for drawings (spec 7's round detail endpoint) — and the icebreaker podium (top 3 of the room leaderboard) with the full leaderboard behind "Show all". Guess texts are never included.
- **Secrecy and names:** only ended rounds, so every word and GIF is already public (spec 7 §8). Player names are shown, also on anonymous retros (spec 7 Decision 7), except Sprint in one GIF answer authors, which are `null` on anonymous retros; Sprint in one GIF awards no points on anonymous retros (spec 7 §4.7), so the leaderboard never ties a GIF to its author.
- **Visibility:** every viewer of the Results view, guests included (they played). Loaded with a constant number of queries.
- **Payload:** `results.games: {rounds: [{id, game, outcome, word, question, clue, leader, winner, answers, endedAt}], leaderboard: [{playerId, name, avatarUrl, isGuest, points, wins, roundsPlayed}], roundsPlayed} | null`, where `leader` / `winner` are `{playerId, name, avatarUrl, isGuest} | null` and `answers` is `[{gif, playerId | null, votes}]` for Sprint in one GIF rounds, else `null` (spec 7 §6.1 is authoritative).
- Games are not part of the LLM summary input.

## 7. Voting and grouping

### 7.1 Automatic vote limit

- `votes_per_participant = null` means automatic: limit = min(10, number of top-level cards in the retro + 3). An explicit value (1–20) keeps today's behaviour.
- `Retro::voteLimit(): int` returns the effective limit; `CardVotesController` and `BuildBoardSnapshot` (`remainingVotes`) use it instead of the column.
- The limit is evaluated at vote time. Cards cannot be created, deleted or grouped during `Voting`, so it is stable within the phase. If the facilitator moves back to `Grouping` and groups cards, the limit may drop below votes already cast: existing votes are kept, `remainingVotes` is `max(0, limit − used)`, as for a manual reduction today.
- Settings: `votes_per_participant` accepts `null` or 1–20, changeable in any phase before `Voting` (§2.4).
- Snapshot: `retro.votesPerParticipant` becomes the effective limit; new `retro.votesAuto: bool`.
- New retros default to automatic; existing retros keep their fixed value. Other new-retro defaults: health check off, icebreaker off (`ai_summary_enabled`: §3).

### 7.2 Group names

**Naming (no LLM needed):**

- A group is a top-level card with at least one grouped card (parent spec: `parent_card_id`). Its name is `cards.group_name` on the lead card (1–60 characters, trimmed; empty → cleared).
- `PUT /retros/{retro}/cards/{card}/group-name` `{name}` sets it, `DELETE` clears it. Allowed to any participant (guests included, like grouping) in `Grouping`, `Voting` and `Discussing`; other phases → 403; `is_locked` → 423; a card that is not a lead with at least one grouped card → 422 "Only groups can be named."
- **Lifecycle:** the name belongs to the group. When a lead with a name is grouped onto another card, the target keeps its own name, or takes the moved lead's name if it has none, and the moved card's name is cleared. When the last grouped card leaves a lead, its name is cleared. When the lead is deleted, the name follows whichever card becomes the group's lead under the existing rules, and is cleared if no group remains.
- **Redaction:** `PresentCard` adds `groupName`; it is `null` on hidden cards (a group formed before the facilitator moved back to `Writing` stays nameless for others). A group name has no author and is shown on anonymous retros too.
- **Broadcast:** `card.group-named {cardId, groupName}` (`toOthers()`). Grouping/ungrouping broadcasts carry the updated names of the affected leads.
- **UI:** a group shows its name above the stack (placeholder "Name this group" for those allowed); click to edit inline. Results "Top topics", the discussion view and the LLM summary input use the name.

**LLM suggestions (optional, scope decision 5):**

- `POST /retros/{retro}/group-name-suggestions` `{cardIds?}` (lead card ids, default every group without a name; at most 30 groups). Available only when a provider is configured **and** the retro's `ai_summary_enabled` is on (the retro's opt-out keeps its content on the server); otherwise 404 and the button is hidden. Same participants, phases and lock rule as naming; the ids must be groups of this retro (else 422).
- **Input:** retro title, and per group its column title and the contents of the lead and grouped cards as quoted data, groups identified by opaque per-request indexes; capped at 20 000 characters (groups beyond the cap are skipped). Only revealed cards (never before `Grouping`), no author, participant name or id, vote, reaction or comment.
- **Output:** JSON `[{index, name}]`, `name` 1–60 characters plain text in the requester's locale; invalid or unknown entries are dropped; all invalid → 502 "Could not suggest names. Try again or name the groups yourself."; provider error or timeout → 502 "The text generator is unavailable. Try again later."
- **Nothing is saved or broadcast:** the response `{suggestions: [{cardId, name}]}` goes to the requester only. Each suggestion appears as a ghost name on the group with Accept (sends the `PUT` above unchanged) and Edit (opens the inline editor prefilled); a group named meanwhile by someone else shows its name and drops the suggestion.
- Rate limit: 5 requests per minute per participant and 20 per minute per retro (429).
- Privacy notice next to the button: "Card contents of these groups are sent to :provider." The creation dialog and settings notice of §6.3 also mention group names (§13).

## 8. Template catalogue

### 8.1 Definitions

- `App\Enums\RetroTemplate` is replaced by `App\Support\RetroTemplates\TemplateCatalogue`, which holds the definitions: key, `isCommon` flag, and per column a palette colour and an optional leading emoji. Titles and descriptions are translation keys.
- Keys are snake_case. The five existing keys (`start_stop_continue`, `mad_sad_glad`, `four_ls`, `went_well_to_improve_actions`, `custom`) are kept, with their current names and column titles; they gain column descriptions from `templates.md`. The other templates take their order and content from `docs/superpowers/research/qretro/templates.md`.
- Colours use the existing palette (`green`, `red`, `blue`, `amber`, `purple`, `slate`); positive columns green, negative red, the rest in catalogue order.
- `isCommon` marks the first 8 templates of `templates.md` (shown first in the dialog).
- Each definition carries a `category` (§8.6), except `custom`.
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
  - **Template list** (left): search field (matches name and column titles) and category chips ("All" by default, then the categories of §8.6) that filter the list; "Workspace templates" first (§8.5), then "Common templates", then the rest in catalogue order, "Custom" last (shown under "All" only). Each item shows name, category and column titles.
  - **Preview** (right): the selected template's columns as coloured chips with their descriptions.
  - **Settings** (collapsible): anonymous cards, health check (off), icebreaker (off; with spec 7, the icebreaker game selector next to it), vote limit (Automatic / fixed 1–20), and, only when `features.llm`, "Automatic AI summary" (on) with the privacy notice of §6.3.
  - **Start** button.
- The catalogue is sent as an Inertia optional prop (`Inertia::optional`), loaded when the dialog opens, in the viewer's locale: `[{key, name, category, isCommon, isWorkspace, columns: [{title, description, color}]}]`, workspace templates first with `key = "workspace:{id}"` and their stored texts.
- `POST /w/{workspace}/teams/{team}/retros` accepts `title`, `template` (catalogue key, or `workspace:{id}` of a template of this workspace), `is_anonymous`, `health_check_enabled`, `icebreaker_enabled`, `votes_per_participant` (null or 1–20), `ai_summary_enabled` (ignored, stored `false`, when no provider is configured), and, with spec 7, `icebreaker_game` (spec 7 §2). Unknown template, or a workspace template of another workspace → 422.

### 8.5 Workspace templates

- **What:** templates owned by a workspace, stored in `workspace_templates` / `workspace_template_columns` (§3): name, category, 1–10 columns with title, optional description and colour. Stored as typed, not translated. At most 100 per workspace (422 "This workspace already has 100 templates."); duplicate name in the workspace → 422.
- **Who:** every workspace member sees them (templates page, creation dialog of every team of the workspace). Creating, editing and deleting require `User::canManage($workspace)` (Owner/Admin, scope decision 2); others → 403.
- **Page:** "Templates" in the workspace navigation, `GET /w/{workspace}/templates` → Inertia page `workspaces/templates.tsx`: list with name, category and column chips; an editor dialog (name, category select, ordered column list with title, description and colour, add/remove/reorder, 1–10) and "Start from a built-in template", which prefills the editor from the catalogue in the editor's locale (client-side, from the same optional catalogue prop).
- **Endpoints** (`auth`, `verified`, `can:view,workspace`; Inertia, redirect back with a flash message): `POST /w/{workspace}/templates` `{name, category, columns: [{title, description?, color}]}`; `PATCH /w/{workspace}/templates/{template}` (same body, replaces the column list); `DELETE /w/{workspace}/templates/{template}`. A template of another workspace → 404 (scoped binding). Controller `App\Http\Controllers\WorkspaceTemplatesController` (`index`, `store`, `update`, `destroy`) with a form request; routes named `workspaces.templates.*`.
- **Use:** creating a retro from `workspace:{id}` copies its columns (title, description, colour, position) into `columns`, sets `template = workspace` and `workspace_template_id`. Editing or deleting the template later never changes existing retros (deletion nulls `workspace_template_id`).

### 8.6 Template categories

- Enum `App\Enums\TemplateCategory` (fixed list, scope decision 4): `Essentials = 'essentials'`, `TeamMood = 'team_mood'`, `Themed = 'themed'`, `Ideas = 'ideas'`, `Analysis = 'analysis'`. Labels in `lang/{locale}/templates.php` ("Essentials", "Team & mood", "Themed & fun", "Ideas & planning", "Analysis").
- Built-in assignment (numbers of `templates.md`):

| Category | Templates |
|---|---|
| `essentials` | 1, 2, 3, 5, 6, 8, 9, 16, 19, 22, 23, 24, 26, 30, 32, 33, 35, 38, 39, 41, 42, 45, 47 |
| `team_mood` | 13, 20, 31, 36, 43, 48, 49, 50 |
| `themed` | 4, 10, 12, 15, 17, 18, 28, 44, 46 |
| `ideas` | 7, 11, 14, 21, 27, 34 |
| `analysis` | 25, 29, 37, 40, 51, 52 |

- `custom` (empty board) has no category. A workspace template picks one category (required).

## 9. LLM provider (bring your own key)

- `config/services.php` → `llm`: `provider` (`anthropic` | `openai`, env `SKRUM_LLM_PROVIDER`), `key` (`SKRUM_LLM_API_KEY`), `model` (`SKRUM_LLM_MODEL`, required), `base_url` (`SKRUM_LLM_BASE_URL`, optional; for `openai` it allows any OpenAI-compatible server, including a self-hosted one).
- The features exist only when provider, key and model are set. Otherwise: endpoints return 404, buttons are hidden, the snapshot flag `features.llm` is false.
- `App\Support\Llm\LlmClient` (interface) with `AnthropicClient` and `OpenAiCompatibleClient`, built on `Http::` with a 60 s timeout, bound per request (no static state, Octane-safe). Requests go from the server only (the summary from a queued job that reads the config at run time); the browser never contacts the provider. The key never appears in payloads, logs or error messages.
- Prompts ask for JSON (survey draft; summary with themes, suggested actions and card insights, §6.5; group names, §7.2); card contents are passed as quoted data, and outputs are validated and rendered as text, so injected instructions cannot produce markup or bypass limits.
- `.env.example` documents the four variables and states that board content is sent to the configured provider when a facilitator uses the survey draft, when a participant asks for group names, and automatically when a retro with the AI summary enabled is completed.

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
| PUT | `/surveys/{survey}/response` | `{optionId}` / `{optionIds}` / `{text}` by kind (§5.4) | participant | survey for the viewer |
| DELETE | `/surveys/{survey}/response` | — | participant | survey for the viewer |
| PUT / DELETE | `/surveys/{survey}/reactions` | `{emoji}` | participant whose results are visible (§5.5) | survey for the viewer |
| POST | `/surveys/{survey}/comments` | `{content, parentCommentId?}` | same | comment (201) |
| PATCH | `/survey-comments/{comment}` | `{content}` | author | comment |
| DELETE | `/survey-comments/{comment}` | — | author or facilitator | 204 |
| POST | `/survey-drafts` | `{prompt, kind?}` | facilitator | `{question, description, options[]}` |
| PUT / DELETE | `/cards/{card}/group-name` | `{name}` / — | participant (§7.2) | `{cardId, groupName}` |
| POST | `/group-name-suggestions` | `{cardIds?}` | participant (§7.2) | `{suggestions: [{cardId, name}]}` |
| PUT | `/roti` | `{score}` | participant | `{myScore, respondents}` |
| DELETE | `/roti` | — | participant | `{myScore: null, respondents}` |
| POST | `/summary` | — | facilitator | 202 `{status}` (queued job, §6.3; also regenerates themes, suggestions and card insights, §6.5) |
| POST | `/suggested-actions/{suggestedAction}/promotion` | — | facilitator or who may create action items (§6.5) | `{suggestedAction, actionItem}` |
| DELETE | `/suggested-actions/{suggestedAction}` | — | same | `{suggestedAction}` (rejected) |
| DELETE | `/summary` | — | facilitator | 204 |

Unknown `statement` (not a key of the retro's frozen set) → 404; a `suggestedAction` of another retro → 404. Team statement and workspace template endpoints are in §4.6 and §8.5. An `optionId` from another survey → 422. `PATCH /settings` also accepts `ai_summary_enabled` (and, with spec 7, `icebreaker_game`). Every mutation locks the retro row like existing endpoints and broadcasts after commit (`RetroBroadcastEvent`, `toOthers()`, report-don't-throw). Error messages are translated.

### 10.2 Broadcast events (presence channel `retro.{id}`)

| Event | Payload | Client reaction |
|---|---|---|
| `health.answered` | `{statements: [{key, count, answeredBy}]}` (`answeredBy` is `[]` on anonymous retros) | update progress |
| `survey.changed` | `{surveyId, version, responseCount}` | refetch `GET /surveys/{id}` (debounced 1 s) when `version` changed or the viewer can see its results; otherwise update `responseCount` |
| `survey.deleted` | `{surveyId}` | remove |
| `survey.discussion.changed` | `{surveyId, commentCount}` | update the count; refetch `GET /surveys/{id}` (debounced 1 s) when the viewer's results are visible (§5.5) |
| `card.group-named` | `{cardId, groupName}` | update the group's name (§7.2) |
| `roti.changed` | `{respondents}` | update count; in `Completed`, refetch the snapshot (debounced 1 s) |
| `insights.changed` | `{}` | refetch the snapshot (debounced 1 s); sent when themes, suggestions or card insights are generated, cleared, promoted or rejected |
| `results.changed` | `{}` | refetch the snapshot (also sent when the summary becomes pending, ready or failed, or is removed, and when a spec 6 share or email delivery finishes) |

`insights.changed` carries no content, and card `sentiment`/`category` never travel in broadcasts other than through the snapshot refetch. `settings.changed` also covers the two phase toggles and the vote limit. No payload contains a score, a rating or a chosen option, and none links a participant to one (`health.answered` only says who answered a statement, never with what score).

**Plain (non-broadcast) event:** every transition of a retro into `Completed` (including a re-completion after a reopen) dispatches `App\Events\RetroCompleted` (`retro`) after commit, from the same phase-change code that closes surveys and queues the summary. This spec adds no listener; spec 8 subscribes it for generic-webhook `retro.completed` events (spec 8 §4.7).

### 10.3 Snapshot additions

- `retro`: `phases`, `healthCheckEnabled`, `icebreakerEnabled`, `aiSummaryEnabled`, `votesAuto` (and `votesPerParticipant` is the effective limit).
- `features`: `{llm: bool}`.
- `healthCheck`: `{statements: [{key, label, text, isBuiltin, count, answeredBy, myScore}]}` (the retro's frozen set, §4.6) when enabled or when answers exist.
- Cards gain `groupName` (§7.2; `null` on hidden cards).
- `surveys`: survey payloads (§5.2) ordered by position.
- `roti`: `{myScore, respondents}`.
- `insights`: `{themes: [{id, name, cardIds}], suggestedActions: [{id, content, themeId, status, actionItemId}]}` in `Discussing` and `Completed` (else `null`), with suggestions and themes empty when nothing was generated. Cards in `cards[]` gain `sentiment` and `category` (`null` when absent), only for revealed cards and identical for every viewer. `viewer.canHandleSuggestions` says whether the viewer may promote or reject (§6.5). Action items gain `themeId`/`themeName` (spec 3 `PresentActionItem`).
- `results` (only in `Completed`, else `null`): `{participants, health, healthTrend, surveys, games, roti: {distribution, average, respondents}, summary: {text, generatedAt, status} | null}` (`status`: `pending`, `ready`, `failed`); `health` follows §4.4 with each statement presented per §4.6, `healthTrend` is `null` for guests and its points carry `sameStatements` (§4.5); `games` follows §6.6. Spec 6 adds `results.deliveries` (latest delivery per channel for viewers who may share, else `[]`) and a top-level `integrations` object (channels available to the viewer), spec 6 §9, extended by spec 8 §7.
- Query count stays constant as cards, surveys and answers grow (one query per relation; health and ROTI aggregates computed in SQL).

## 11. Redaction and privacy

- **Health check:** individual scores are visible only to their author. Others see, during `HealthCheck`, answer counts and (non-anonymous retros) who answered; averages appear only in `results`, for every statement with at least one answer (no minimum, QRetro parity). Accepted residual risks: with very few respondents an average reveals individual scores (with two respondents each can infer the other's; with one, the average is that score); and if the facilitator moves back to `HealthCheck` and a single participant changes an answer, comparing two results views could reveal that change; answers cannot be edited outside `HealthCheck`, which limits it.
- **Surveys:** counts only after the viewer answered or the survey closed, enforced in `PresentSurvey`. Voters are sent only when the facilitator turned on "Show who answered", only with the counts, and never on anonymous retros (switch forced off, validated on write and redacted in `PresentSurvey`).
- **Custom health statements:** the frozen set per retro only changes what is asked, never who sees what; the rules above apply to every statement. Team statements are visible to viewers of the team, never to guests (guests only see the retro's set).
- **Free-text survey answers:** visible under the same condition as counts; named only when "Show who answered" is on and the retro is not anonymous; ordered by text so the order reveals neither time nor author (§5.4).
- **Survey reactions and comments:** only for viewers whose results of that survey are visible; reaction names only with "Show who answered" on a named retro; comment authors never on anonymous retros; broadcasts carry counts only (§5.5).
- **Group names:** no author stored; `null` on hidden cards. Suggestions send only revealed card contents of the requested groups, without authors, and only when the retro has not opted out of AI (§7.2).
- **Games we played:** only ended, non-abandoned rounds through spec 7's `BuildGamesPlayed`; no guess text; GIF answer authors `null` and no GIF points on anonymous retros; spec 7 secrecy and naming rules unchanged (§6.6).
- **ROTI:** aggregates only, in `Completed`, whatever the number of ratings.
- **Cards before `Writing`:** hidden from others, like in `Writing` (§2.4).
- **Trend:** never sent to guests.
- **Insights:** themes, suggestions, sentiment and category are derived from revealed content only, sent to the provider without any author information, exposed per card (not per author) and never in broadcasts. Sentiment/category cannot be edited by users and are `null` without a provider or when opted out.
- **LLM:** only enabled by the instance admin (§9). The survey draft is triggered by the facilitator. The results summary is sent automatically at completion unless the facilitator opted the retro out (creation dialog or settings, until completion), so content leaves the instance without a per-retro deliberate action; the notice in §6.3 says so and names the provider. Nothing hidden during `Writing` is ever sent (the job runs only in `Completed`), no personal data or author information is sent, and anonymous retros are covered by the same rule (§6.3).

## 12. Changes to the parent spec and other specs

The parent (core) spec and spec 1 are built: the items that target them are changes this spec's implementation plan makes.

- Phases: `RetroPhase` gains `HealthCheck` and `Icebreaker` before `Writing`; adjacency is computed over the retro's enabled phases (§2.2). The parent phase table gets a note pointing here.
- Redaction table: "Others' card content / author hidden" applies to `HealthCheck` and `Icebreaker` as well as `Writing`.
- Templates: the `RetroTemplate` enum is replaced by the catalogue (§8); column titles go up to 100 characters and columns gain a description.
- Votes per participant: nullable (automatic), changeable in every phase before `Voting`.
- Completed read-only: ROTI, the facilitator's summary actions and promoting/rejecting suggested actions (§6.5) are allowed in `Completed`.
- Cards gain nullable `sentiment` and `category`; `action_items` gains a nullable `theme_id`, defined in spec 3 §2 (its model, `CreateActionItem` and `PresentActionItem` carry it, §6.5).
- The parent "summary view (top-voted cards + action items)" becomes the Results view (§6).
- Cards gain nullable `group_name` (§7.2); `retros` gains `workspace_template_id` and `template` may be `workspace` (§8.5).

### Changes to other specs

- **Spec 1 (board engagement):** the reaction summary (`SummarizeReactions`) and the comment presenter take a survey as well as a card; `comment.notification` accepts `surveyId` in place of `cardId` (§5.5). Card rules are unchanged. *(Spec 1 is built: this change is made by this spec's implementation plan.)*
- **Spec 3 (action items v2):** `action_items` gains `theme_name` (nullable string ≤ 80), written only by `PromoteSuggestedAction` with the theme's name at promotion and never client-writable; `PresentActionItem.themeName` reads `theme_name` (kept when the theme is deleted by regeneration, `DELETE /summary` or failure), while `themeId` still becomes `null`. Spec 3's theme tests should assert the name survives theme deletion (§6.5). *(Applied in spec 3 §2, §3, §5, §12.)*
- **Spec 5 (MCP):** `retro.board.health.get` categories come from the retro's frozen set (§4.6): `key` is a built-in value or a custom statement id, `label` the presented label; the `team-health` prompt matches per-category averages across boards by `key` and should mention changed statement sets (`sameStatements`). Optionally, messages may expose `groupName` (§7.2). *(Applied in spec 5 §6.1 and §7, `groupName` included.)*
- **Spec 7 (games):** "Games we played" (§6.6) reads `game_rooms` (by `retro_id`), `game_rounds` (ended only) and `game_players`, and reuses spec 7's round-history presenter; spec 7 should expose that presenter as a standalone class (e.g. `App\Actions\Games\PresentGameRoundHistory`) and keep the icebreaker room when the Icebreaker phase is turned off (it is removed only with the retro, as spec 7 already states). *(Applied in spec 7 §6, §6.1, §7; the `results.games` shape of spec 7 §6.1 is adopted in §6.6 here.)*

## 13. UI

- **Stepper:** renders `retro.phases`, with the new labels "Health check" and "Icebreaker".
- **Health check phase:** centred list of the retro's statements (six built-ins by default), each with a 1–10 segmented control (Awful … Great), a check mark once answered, answer count and avatars (names on hover; counts only on anonymous retros), and a "Clear" action for the own answer. Mobile: the scale wraps to two rows of five.
- **Icebreaker phase:** "Warm-up" panel with the question (§2.5), replaced by spec 7's game panel once spec 7 is built.
- **Surveys:** a leftmost "Surveys" column appears in `Writing`–`Discussing` when the retro has surveys. Each survey card shows question, description, options as buttons; after answering (or when closed) each option shows a percentage bar and count, the own choice is marked, voter avatars (names on hover) under each option when "Show who answered" is on, "n responses" at the bottom; facilitator ⋮ menu: Edit (only without responses), Close / Reopen, Delete. Toolbar "Add survey" (facilitator) opens a dialog with question, description, dynamic option list (2–10), a "Show who answered" switch (off by default; disabled with an explanatory hint on anonymous retros), and, when `features.llm`, a "Generate from a prompt" field.
- **Results view** (§6) with inline-SVG `HealthRadar` and `HealthTrend` components; `prefers-reduced-motion` respected (no chart animation).
- **ROTI:** five labelled buttons in `Discussing` (under action items) and in Results.
- **Suggested actions and themes:** in `Discussing`, a "Suggestions" panel next to the action items panel lists themes and pending suggestions with Promote / Reject (for those allowed, §6.5; others see them read-only); in `Completed`, the same content is part of the Results view. Promote turns the row into a link to the new action item, which shows its theme name. Card headers show the sentiment icon and category chip when present. Nothing appears without a provider or when the retro opted out.
- **Settings dialog:** switches "Health check" and "Icebreaker"; vote limit becomes "Automatic" or a number; "Automatic AI summary" switch (only when `features.llm`, disabled once `Completed`) with the privacy notice of §6.3.
- **Survey kinds and discussion:** the dialog has a kind selector (Single choice, Multiple choice, Free text; options hidden for Free text). Multiple-choice options are checkboxes with a Submit button; free text is a textarea (500 characters) with Submit/Update. Once results are visible, each survey card shows reaction chips (quick set and picker, as on cards) and a "n comments" toggle opening the thread (spec 1's thread component); before, only "n comments" and "Answer to join the discussion".
- **Groups:** name above each group (inline edit); with `features.llm` and the retro not opted out, a toolbar "Suggest group names" button (Grouping–Discussing) showing ghost names with Accept / Edit.
- **Results view:** "Games we played" card between Action items and ROTI (§6.6: round list, podium and leaderboard, per spec 7 §9); header Share menu and delivery lines added by spec 6 (§6.1).
- **Column header:** description under the title; column menu edits it.
- **Team page:** "New retrospective" dialog (§8.4); "Health check statements" section (§4.6): active list with drag-to-reorder, Add (text + axis label), Edit (custom only), Archive, and an "Archived" disclosure with Restore; read-only for non-managers; a note says "Changes apply to retros that have not collected answers yet."
- **Workspace:** "Templates" navigation entry and page (§8.5); creation dialog category chips (§8.4, §8.6).
- Every new string exists in `lang/{en,fr,es,de}.json`, template strings in `lang/{locale}/templates.php`.

## 14. Error handling

- Rejected mutation (phase, lock, closed survey, limits) → 403/422/423 with a translated message → optimistic update rolled back + toast, as for votes.
- Survey or option deleted concurrently → 404 → survey removed locally / refetched.
- LLM: survey draft: provider error or timeout → 502 "The text generator is unavailable. Try again later."; invalid output → 502 with the survey-specific message (§5.3); 429 → "Too many requests, wait a moment.". Summary job: retried 3 times, then `summary_status = failed`; the Results view keeps working without a summary and the facilitator sees a Retry button (§6.3).
- Turning off the current phase → 422 (§2.3).
- Team statements: outside 3–10 active → 422; rewording a built-in → 422; incomplete order list → 422; non-manager → 403 (§4.6).
- Surveys: wrong answer shape for the kind → 422; discussion before results are visible → 403 (§5.5).
- Group names: not a group → 422; suggestions: provider error → 502, all-invalid output → 502 with the group-specific message, 429 over the limit; a suggestion accepted after the group changed simply sets the name (or 422 if it is no longer a group) (§7.2).
- Workspace templates: limits and duplicate name → 422 on the form; non-manager → 403; another workspace's template → 404 / 422 at retro creation (§8.5).
- "Games we played": when the retro has no icebreaker room or it has no ended, non-abandoned round, `results.games` is `null` and the section is hidden (§6.6).

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
- **Suggested actions and insights:** with `Http::fake()` returning themes, suggestions and card insights, the job stores themes with card ids, `pending` suggestions and per-card `sentiment`/`category`; invalid sentiment → `null`, unknown card ids ignored, a card in two themes kept once; the request body has no participant names or ids, no author information (also on anonymous retros), and card ids are opaque indexes; regeneration replaces pending suggestions and cards' insights but keeps promoted/rejected ones and does not re-propose an identical handled wording; `DELETE /summary` and failure clear themes, pending suggestions and insights; without provider or when opted out: no themes, no suggestions, `sentiment`/`category` null on all cards; promote creates an action item with unchanged wording and `theme_id`, sets `promoted`, `action_item_id` and handler, and calls spec 3's `CreateActionItem`; reject sets `rejected`; a second promote/reject → 422; allowed in `Discussing` (participants per spec 3; 423 when locked) and in `Completed` for the facilitator and workspace Owners/Admins only (a plain participant or guest → 403; locked does not block), 403 in other phases; another retro's suggestion → 404; `insights` is `null` before `Discussing`; snapshot `sentiment`/`category` are the same for every viewer and never in broadcasts.
- **Team health statements:** a team without rows gets the six built-ins; the first change materialises them; add/reword custom, reorder, archive/restore; 2 or 11 active → 422; rewording a built-in → 422; non-manager → 403, member of another team → 403/404; enabling the health check freezes the active set; re-enabling without answers refreshes it, with answers keeps it; team edits after answers leave the retro's set, answers and results unchanged; answering an archived or foreign key → 404; radar and aggregates use the frozen set (3 and 10 statements); trend `sameStatements` false after a set change and true otherwise; rewording a custom statement keeps its key across retros.
- **Survey kinds:** multiple: several options stored, replace on re-answer, counts per option and `responseCount` per participant, `optionIds` from another survey or empty → 422; single still refuses two options; text: 1–500 characters, options on create → 422, `textAnswers` `null` before answering, visible after answering or closing, `authorId` only with `show_voters` on a named retro, ordered by text; no text or option in any broadcast; kind change refused once answered; draft with `kind: text` returns no options.
- **Survey reactions and comments:** allowed only once the viewer's results are visible (403 before), 403 in `Completed`, 423 locked, reactions 403 when `reactions_enabled` is off; reaction names only with `show_voters` on a named retro; comment authors hidden on anonymous retros; one-level replies and soft delete as for cards; facilitator deletes any comment; `survey.discussion.changed` carries only `surveyId` and `commentCount`; notifications only to the survey creator and thread participants whose results are visible; deleting a survey removes its reactions and comments.
- **Group names:** set/clear by a guest and a member in `Grouping`–`Discussing`, 403 in `Writing` and `Completed`, 423 locked, 422 on a card without grouped cards; lifecycle when grouping a named lead onto a named/unnamed card, ungrouping the last card and deleting the lead; `groupName` `null` on hidden cards; broadcast `card.group-named`; suggestions: 404 without provider or when `ai_summary_enabled` is off, request body with opaque indexes and no author, name, id or vote, invalid entries dropped, all-invalid → 502, nothing stored, rate limits.
- **Games we played:** with spec 7 factories, `results.games` lists the ended rounds of the retro's icebreaker room with leader, winner and leaderboard; active, abandoned and other rooms' rounds absent; no guess text; GIF answer `playerId` null on anonymous retros; still present after the Icebreaker phase is turned off; `null` without a room or ended round; visible to guests; constant query count (spec 7 §12 covers the presenter itself).
- **`RetroCompleted`:** dispatched once per transition into `Completed` (`Event::fake()`), again after a reopen and re-completion, never on other phase changes.
- **Workspace templates and categories:** Owner/Admin create/update/delete, member → 403, other workspace → 404; 0 or 11 columns and 101st template → 422; duplicate name → 422; creating a retro from `workspace:{id}` copies columns and sets `workspace_template_id`, from another workspace → 422; editing/deleting the template leaves the retro's columns; catalogue prop lists workspace templates first with categories; every built-in except `custom` has a category, and the table of §8.6 covers the 52 templates exactly once.
- **Promotion theme name:** promoting stores `theme_name`; after regeneration or `DELETE /summary`, `themeId` is `null` and `themeName` unchanged; a suggestion without theme stores `null`.
- **Translations:** `TranslationKeysTest` passes for JSON and `templates.php`.
- **Manual two-browser walkthrough** (one guest): create a retro from the dialog with health check and icebreaker on; answer the health check in both browsers (avatars appear, no scores); icebreaker panel; surveys created, answered, results appear only after answering, closed; automatic vote limit shown; complete; Results view with radar, alignment, surveys, ROTI (distribution visible from the first rating), trend visible to the member and not to the guest; a survey with "Show who answered" on shows voters, and the switch is disabled on an anonymous retro; with an LLM key configured, generate a survey draft, complete a retro and see the summary, themes, suggested actions and card sentiment/category appear automatically, promote one suggestion (an action item appears with the same wording and its theme) and reject another (and a retro created with the summary off gets none until the facilitator generates one); without a key, no LLM control anywhere. Scope additions: as an Owner, add a custom health statement and archive a built-in, then run a retro whose radar shows the new set and whose trend marks the change; create a multiple-choice and a free-text survey, answer them, react and comment (hidden before answering in the other browser); name a group by hand and, with a key, accept a suggested name; create a workspace template in a category, filter by that category in the dialog and start a retro from it; after spec 7, play two icebreaker rounds and see them under "Games we played".

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
10. Themes, suggested actions and per-card sentiment/category are generated with the summary (same job, conditions and redaction, §6.5); they can be promoted (wording and theme kept) or rejected once, in `Discussing` and `Completed`, by those allowed; without a provider or when opted out, there are none and sentiment/category are `null`.
11. All new strings are translated in en/fr/es/de; suite, phpstan, type-check and lint are green; no new dependency; walkthrough passes.
12. Teams manage 3–10 active health statements (built-ins reorderable and archivable, custom ones editable); each retro freezes its set when the health check is enabled and keeps it once answered; results use the frozen set and the trend flags changed sets (§4.6, §4.5).
13. Multiple-choice and free-text surveys follow §5.4, with the same result visibility, ballot secrecy and anonymity rules as single choice; free-text answers are named only with "Show who answered" on a named retro.
14. Survey reactions and comments follow §5.5: available only once the viewer's results are visible, names restricted as specified, no content in broadcasts.
15. Any participant can name a group in `Grouping`–`Discussing`; with a provider and the retro not opted out, suggested names are generated from revealed content only, returned to the requester, and applied only when accepted (§7.2).
16. Owners/Admins manage workspace templates; every workspace member can create a retro from one; built-in and workspace templates carry a category and the dialog filters by it (§8.5, §8.6).
17. The Results view lists the icebreaker rounds of the retro under "Games we played" from spec 7's tables, with spec 7's secrecy and naming rules (§6.6).
18. A promoted action item keeps its theme name after the theme is regenerated or removed (`action_items.theme_name`, §6.5).

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
10. Suggested actions, themes and card sentiment/category are generated with the AI summary (added 2026-09-30 for the MCP contract).
11. Scope additions (2026-09-30): custom health-check statements per team (§4.6); multiple-choice and free-text surveys (§5.4) with reactions and comments (§5.5); workspace templates stored in the database and template categories (§8.5, §8.6); group names with optional LLM suggestions (§7.2); "Games we played" on the Results view from spec 7's icebreaker rounds (§6.6); promotion copies the theme name to `action_items.theme_name` (§6.5). The choices below were settled by the user on 2026-09-30 and are applied in the body.

## Decisions (scope additions, 2026-09-30)

All recommended options below were chosen by the user on 2026-09-30.


1. **Rewording a custom health statement.** (a) Keeps its key; past retros keep their frozen wording, trends treat it as the same statement — flexible, but a big rewording silently compares different questions. (b) Every rewording creates a new key (archive + add) — strict comparability, but fixing a typo breaks the trend. (c) Rewording allowed only until a completed retro used it — strict and typo-friendly early, more rules. **Chosen: (a)**, with the per-retro frozen wording visible in results.
2. **Who manages team health statements and workspace templates.** (a) Workspace Owner/Admin only (`TeamPolicy::update`, `canManage`) — matches other team/workspace settings. (b) Any team member for statements, Owner/Admin for templates — teams self-serve their health check. (c) Any workspace member for both — least friction, most churn. **Chosen: (a).**
3. **Survey discussion visibility.** (a) Reactions and comments only once the viewer's results are visible — no steering or early leak of results; you must answer to discuss. (b) Always visible and open — freer discussion, but comments can reveal or bias results. **Chosen: (a).**
4. **Template categories.** (a) Fixed list of five categories (§8.6), translated — simple, consistent across workspaces. (b) Workspace-defined categories stored in the DB — flexible, but built-ins need a mapping and a new management UI. **Chosen: (a).**
5. **Gating LLM group-name suggestions.** (a) Provider configured and the retro's `ai_summary_enabled` on — one per-retro AI switch keeps content on the server when opted out. (b) Provider configured only — always available, but an opted-out retro can still send content. (c) Like (a) but facilitator-only — fewer requests, less useful for self-organising teams. **Chosen: (a).**
6. **Free-text survey answers in the LLM summary input.** (a) Sent as quoted data without authors (closed surveys, ≤ 50 per survey) — richer summary, same exposure as card contents. (b) Never sent — tighter data minimisation; the summary ignores open feedback. **Chosen: (a).**
- (2026-09-30) "Games we played" uses spec 7's podium and leaderboard (`BuildGamesPlayed`); no separate per-game totals or "Top player".
