# Skrum — Standalone surveys, the Poll session type, and the health check as a survey template — Design

Date: 2026-10-19
Status: Draft — decisions for the owner pending (§17). Nothing here is approved.
Parent spec: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` (§4 "Health check phase", §5 rule 13, §6.4, §9 B1, B3, B18, B19, B23, §10). This spec reverses three lines of it: the health-check phase of §6.4, the "four session types" of §6.4 and B18, and the mood source of B23.
Owner's word: `docs/superpowers/research/front-rewrite/owner-answers-2026-10-02.md`, third round ("1 Poll", "Health check", "10 Mood"), fifth round (D-76, D-77), and the list "Features to specify after the rewrite".
Roadmap rows: SV-1 to SV-5 of `docs/superpowers/research/front-rewrite/feature-roadmap.md`. Deviation rows cleared: D-03, D-09 (Poll), D-22 of plan 18e. D-23 stays.
Mockups (binding, parent spec §5 rule 13): `docs/design-system/components/ScreenSurvey` (three frames: a builder, b participant, c results), `SurveyQuestion`, `MobileRituals` (survey phone frame), `ScreenSessionCreate` and `SessionTypePicker` (Poll tile), `SessionSettingsPopover` ("Add survey" menu), `HealthCheck`, `GuestJoin`, `ShareDialog`, `EmptyState`.
Research: `docs/superpowers/research/front-rewrite/18e-briefs/08-surveys.md` (the surveys inside a retro, as rewritten by plan 18e).

What was read, and what was not: the code of the branch `plan-18e-screens` at `4568a764`, plus the worktrees `laneBackA` (nine retro phases, B1) and `laneTeam` (the health-check management page of rework RW-T2, not yet committed). Nothing was run. Plans 18e to 18g are still moving: the plan re-reads every file it touches.

## 1. Problem statement

A survey exists only inside a retro, as one question with three kinds of answer (`surveys.retro_id`, `SurveyKind`: single, multiple, text). The mockups show a survey as a session of its own: a builder with several questions, scale and NPS questions, a page a participant answers one question at a time, aggregated results, a comparison with the previous survey and a CSV export. The "New session" dialog shows five types; the application offers four.

The health check is a retro phase (`RetroPhase::HealthCheck`) with its own tables (`team_health_statements`, `retro_health_statements`, `health_check_answers`), its own endpoints and its own event. The mockups have no such phase (deviation D-03). The owner decided that it becomes a default survey template and that the phase goes.

## 2. Goals

1. A team runs a survey as a session of its own: created from the "New session" dialog (type Poll), built in a builder, answered on its own page by members and by guests with a link, followed live, closed, compared and exported.
2. The five question kinds of the mockup exist: scale, NPS, single choice, multiple choice, free text.
3. The health check is a built-in survey template fed by the team's statements. The retro has no health-check phase.
4. No health data is lost and no reader of health data goes dark: every score, trend, delta, recap line and MCP answer that exists today shows the same numbers after the migration, for old retros and for new health checks.
5. The surveys inside a retro (plan 8c, rewritten by plan 18e) keep working as they are.
6. Database code runs unchanged on PostgreSQL, MySQL, MariaDB and SQLite.

## 3. Non-goals

- The builder settings the owner left in the backlog: the three anonymity modes, the close date and "close when everyone has answered", the display-threshold setting. Their place in the settings panel is left.
- "Send to whiteboard", the keyword cloud, the "Other" option with free text, the per-question character limit, "about n minutes" estimates.
- Saved survey templates managed by a team or a workspace (the "From a template…" entry of the retro's "Add survey" menu, a Surveys tab on the workspace templates page).
- Moving the surveys inside a retro onto the new tables (§6.7, decision 2).
- Survey tools on the MCP server, a `surveys:read` token scope, survey webhooks, survey results by e-mail.
- Hand-over of a survey to another facilitator; scheduling.
- Dropping the old health tables: they are kept, unread, for one release (§11.8, decision 7).

## 4. Decisions already taken

| Topic | Decision | Source |
|---|---|---|
| Poll | A standalone survey entity, with its own page, guest link, live channel and results; the fifth type of the "New session" dialog | owner, third round; roadmap SV-1 |
| Builder, kinds, compare, CSV | The mockup's multi-question builder (reorder, duplicate, required), scale and NPS questions, compare, CSV export | owner, "Features to specify after the rewrite"; roadmap SV-2 to SV-4 |
| Health check | A default survey template; no dedicated retro phase | owner, third round; roadmap SV-5 |
| Mood | Health-check score, beside ROTI | owner, third round point 10 |
| Mood trend | Lives on the health-check management page; the team page shows the ROTI curve alone | owner, fifth round D-77 |
| Health check card | Compact list with "Manage"; the sentence uses the real values (actual count, scale 1 to 10) | owner, fifth round D-76 |
| "Add survey" in a retro | In the settings popover only; no "Anonymous" badge on a retro survey; "n · p%" | owner 8-D2, 8-D3, 8-D4 |
| Guest join | Suggested nickname and "Join the session" on every session type | owner, fourth round D-51 |
| Guest link controls | In the Share dialog only; "Create a new link" asks for confirmation | owner 2-D11 / 7-D2 |
| Presentation | The mockup wins; a mockup element with no data is omitted, listed, and its place is left | parent spec §5 rule 13 |
| Database | Portable code, rule of `database-portability-audit.md` §9 | owner, fifth round |

Everything else in this document is a proposal. The product choices the sources do not settle are in §17, each with a recommendation; the body is written on the recommendations.

## 5. Rules

The rules of the parent spec §5 apply to every front file (tokens, rem, Tailwind scale, no overflow, focus, contrast, motion, lucide, literal `t('…')`, presentational `skrum/` components, rule 13). The conventions of §9.2 of the parent spec apply to the back end: actions in `app/Actions/<Domain>`, one controller per resource with CRUD method names, `Gate::authorize` for team-level access, a guard class on live JSON endpoints, events sent to others only, UUID keys, migrations with `up` only. The portability rule applies to every query and migration: no raw SQL beyond plain `count`, `sum`, `max` with `groupBy`; aggregates that need an expression are computed in PHP; lists shown to people are sorted in PHP.

Vocabulary, used the same way in code and in this document:

| Term | Meaning |
|---|---|
| retro survey | The existing one-question survey inside a retro (`Survey`, table `surveys`). Called "Quick poll" in the retro's "Add survey" menu. Unchanged. |
| team survey | The new entity (`TeamSurvey`, table `team_surveys`): a survey owned by a team, with questions. "Survey" in the interface; "Poll" on the tile of the "New session" dialog, as the mockup writes it. |
| attached survey | A team survey with a `retro_id`. In this spec only a health check can be attached. |
| respondent | A person in a team survey (`TeamSurveyRespondent`): a member, a guest of the survey, or a participant of the retro it is attached to. |
| editor | The survey's facilitator (its creator) or a workspace manager (`User::canManage`). |

## 6. Domain model

### 6.1 Tables

All keys are UUIDs. No JSON column, no expression index, no check constraint.

**`team_surveys`**: `team_id` (cascade), `retro_id` (nullable, cascade), `title` (120), `description` (500, nullable), `template` (nullable string: `health_check`, `team_pulse`, or null for a blank survey), `status` (`draft`, `open`, `closed`), `facilitator_respondent_id` (nullable, null on delete), `created_by_user_id` (nullable, null on delete), `guest_access_enabled` (default false), `guest_token` (40, unique), `one_question_at_a_time` (default true), `show_results_after_answer` (default true), `results_threshold` (small integer, default 3), `previous_survey_id` (nullable, self, null on delete), `version` (default 1), `opened_at`, `closed_at` (nullable), timestamps. Indexes `(team_id, status)`, `(team_id, closed_at)`, `(retro_id, template)`.

**`team_survey_questions`**: `team_survey_id` (cascade), `kind` (`scale`, `nps`, `single`, `multiple`, `text`), `label` (200), `short_label` (30, nullable: the short name of a health statement, "Vision"), `description` (500, nullable), `builtin` (nullable: a `HealthStatement` value, translated when read, as built-in statements are today), `match_key` (64, nullable: what "the same question" means across two surveys), `position`, `is_required` (default false), `allows_comment` (default false), `scale_max` (5 or 10 for a scale, null otherwise), `scale_min_label`, `scale_max_label` (60, nullable). Index `(team_survey_id, position)`.

**`team_survey_options`**: `team_survey_question_id` (cascade), `label` (100), `position`.

**`team_survey_respondents`**: `team_survey_id` (cascade), `user_id` (nullable, null on delete), `participant_id` (nullable, null on delete: the retro participant, for an attached survey), `guest_name` (50, nullable), `guest_secret_hash` (64, nullable), `completed_at` (nullable), timestamps. Unique `(team_survey_id, user_id)` and `(team_survey_id, participant_id)`.

**`team_survey_answers`**: `team_survey_question_id` (cascade), `team_survey_respondent_id` (cascade), `value` (small integer, nullable: scale and NPS), `text` (nullable: free text, at most 500 characters), `comment` (500, nullable), timestamps. Unique `(team_survey_question_id, team_survey_respondent_id)`. The primary key is a random UUID (version 4), not a time-ordered one, so that an id never tells when an answer was written (as `SurveyTextAnswer` does today).

**`team_survey_answer_options`**: `team_survey_answer_id` (cascade), `team_survey_option_id` (cascade). Unique on the pair. One row for a single choice, one per ticked option for a multiple choice.

`team_health_statements` is kept as it is: it is the content of the team's health-check template.

### 6.2 Question kinds

| Kind | Answer | Validation | Result |
|---|---|---|---|
| `scale` | an integer from 1 to `scale_max` (5 in the builder; 10 for a health check, §17 decision 3) | integer in range | mean (one decimal), most frequent value, one bucket per value |
| `nps` | an integer from 0 to 10 | integer in range | score = round((promoters − detractors) ÷ answers × 100), promoters 9–10, passives 7–8, detractors 0–6; the three counts; one bucket per value |
| `single` | one option of the question | option belongs to the question | count per option; percentage of the answers |
| `multiple` | one or more options of the question | distinct options of the question, at least one | count per option; percentage of the respondents to the question |
| `text` | a text of at most 500 characters | non-empty | the texts, sorted by text, never by time or author |

A scale or NPS question with `allows_comment` accepts an optional comment (the mockup's "Why this score? (optional)"). Comments are listed with the free-text answers, without their score.

Limits: 30 questions per survey; 2 to 10 options per choice question; a health check has 3 to 10 statements (the existing team rule).

### 6.3 Respondents and anonymity

A respondent row exists so that one person has one response and can change it; it is never a way to read who answered what.

- A team survey is anonymous: no payload, page, export or event tells which respondent gave which answer. The only people named are the facilitator and, on the presence channel, who is connected.
- Counts are public to whoever can open the survey: how many people have answered, how many have finished, out of how many.
- One exception, kept from today: in a health check attached to a retro that is not anonymous, the board shows who has answered each statement (never the score), as `PresentHealthProgress` does now. On an anonymous retro it shows counts only.
- A member answers as themselves (one respondent per user and survey). A guest answers with a cookie scoped to the survey (`GuestCookie`, scope `survey`). A participant of the retro an attached survey belongs to (a retro guest included) is a respondent without joining again.

### 6.4 Results and when they are visible

`results` is built per viewer and withheld by the server, never by the front end.

| Viewer | Draft | Open | Closed |
|---|---|---|---|
| Editor | no results | yes | yes |
| Respondent who has finished | — | when `show_results_after_answer` | yes |
| Other member, respondent who has not finished | — | no | yes |
| Guest | — | as a respondent | as a respondent, while the cookie is valid and guest access is on |

On top of that, while fewer than `results_threshold` people have answered, nobody receives aggregates, editors included; the payload says so and carries the count. The threshold is 3 for a survey created from the dialog, and 0 for a health check attached to a retro and for migrated health checks, which behave as today (§17 decision 4). No setting changes it in this spec.

A viewer without results receives the questions, their own answers and the counts of §6.3, nothing else.

### 6.5 Templates

Built in, defined in code, translated into the creator's language when the survey is created (as the retro templates are):

| Key | Content |
|---|---|
| blank | no question |
| `health_check` | one `scale` question per active statement of the team (`TeamHealthStatements::active`), `scale_max` 10, not required, no comment, `builtin` and `match_key` set from the statement. The questions are locked: the builder shows them read-only with a link to the statements page. |
| `team_pulse` | the five questions of the ScreenSurvey mockup: workload (scale 1–5, labelled ends, required), recommendation (NPS, required), ritual to keep (single, four options), what slowed you down (multiple, five options), a word for the team (text). |

A survey can also start from an earlier survey of the team ("Duplicate"): title, settings, questions, options and `match_key` are copied; answers are not; `previous_survey_id` points to the source.

Team-customised statements stay where they are: `team_health_statements`, managed from the health-check page (add, reword a custom one, reorder, archive, restore; 3 to 10 active, 30 in all). The rule "changes apply to health checks that have not collected answers yet" is kept: when the statements change, every health-check survey of the team that is not closed and has no answer gets its questions rebuilt.

### 6.6 Comparison

Two surveys of the same team are compared question by question. Two questions are the same when their `match_key` is equal, or, failing that, when their kind is equal and their labels are equal once trimmed and lower-cased in PHP. For each pair the comparison gives both values and the difference (mean for a scale, score for NPS, percentage points per option for a choice, the number of answers for a text). Questions without a match are listed apart. The default comparison is `previous_survey_id`; for a health check it is the team's previous closed health check. The viewer can pick any other closed survey of the team. A guest never receives anything of another survey.

### 6.7 The surveys inside a retro

They do not share the model. `surveys`, its five satellite tables, `SurveyKind`, the fourteen `retros.surveys.*` routes, their events on the retro channel and the front built by plan 18e are untouched, except for their entry point, which becomes the "Quick poll" item of the "Add survey" menu. Reason: they carry things a team survey does not have (reactions, comment threads, "Show who answered", one card per question on the board) and are bound by about sixty browser assertions that plan 18e has just rewritten; moving them is a rewrite of plan 8c for no change a user asked for. The two share the `SurveyQuestion` component and nothing on the server. This is decision 2 of §17.

## 7. Lifecycle and permissions

```
draft ──publish──▶ open ──close──▶ closed
  ▲                  │  ◀──reopen──
  └─back to draft────┘   (only while nobody has answered)
```

| Action | Who | Condition |
|---|---|---|
| Create | any member who can view the team (`createSurvey`, as the three other creation abilities) | — |
| Open the builder, change title, settings, questions | editor | questions and options only in `draft` |
| Publish | editor | at least one question |
| Back to draft | editor | `open`, no answer yet |
| Answer, change an answer, withdraw it, finish, reopen one's own response | respondent | `open` |
| Close, reopen | editor | an attached survey cannot be reopened once its retro is completed |
| See results | §6.4 | — |
| Compare | a non-guest who sees the results | the other survey is closed and of the same team |
| Export CSV | editor | `closed` |
| Guest access on or off, new guest link | editor | a new link signs out the survey's guests, as on the other session types |
| Duplicate | any member who may create | — |
| Delete | editor | — |
| See the survey in the team's list | members; a draft is listed for editors only | attached surveys are not listed there |

A draft is opened by editors only; anyone else gets 403. A guest link works only while the survey is `open` or `closed`, with guest access on.

"Finish" checks that every required question is answered and stamps `completed_at`. An answer is saved the moment it is given, so a respondent who leaves midway has lost nothing; every saved answer counts in its question's result. "Change my answers" clears `completed_at` while the survey is open.

Closing an attached survey happens by hand, or automatically when its retro is completed (next to `CloseOpenSurveys`).

## 8. Real time

Presence channel `presence-survey.{id}` (the name `SurveyQuestion/README.md` gives), authorised in `BroadcastAuthorizationsController` for whoever `ResolveRespondent` accepts, with the same member data as the other session channels (`id`, `name`, `avatarUrl`, `isGuest`).

| Event | Name | Payload | Sent when |
|---|---|---|---|
| `TeamSurveyChanged` | `survey.changed` | `version`, `status` | title, settings, questions, status |
| `TeamSurveyResponsesChanged` | `survey.responses.changed` | `responses`, `completed` | an answer is saved or withdrawn, a response is finished or reopened |
| `TeamSurveyDeleted` | `survey.deleted` | none | the survey is deleted |

Redaction: events carry counts and a version, never an answer, an aggregate or a respondent id. A client that may see results refetches the snapshot (debounced one second) and the server applies §6.4 again; a client that may not sees the counter move. Events go to others only; the caller applies the HTTP response.

An attached health check also keeps today's `health.answered` on the retro channel (progress per statement), sent whichever page the answer came from, and `settings.changed` when a health check is attached, removed, closed or reopened, which makes the board refetch its snapshot.

## 9. Screens

Each screen follows its mockup. "Omitted" means: not built, place left, row of the deviations table of the plan. Where no mockup exists the screen is designed from the neighbours named, and the plan puts that design to the owner before it is built.

### 9.1 "New session" dialog — type Poll

Mockup: ScreenSessionCreate (tile), SessionTypePicker. The fifth tile, in the mockup's order (Retro, Poker, Whiteboard, Poll, Icebreaker): iris, `chart-column`, "Poll", "Quick vote or health check" (tiles) / "Quick vote" (inline), "5–10 min". The form for this type has no mockup; it is designed from the retro and whiteboard variants: Name (prefilled), "Start from" (Blank, Health check with "n statements · scored 1 to 10", Team pulse with "5 questions", and "A previous survey" with a select of the team's surveys), and the settings row "Allow guests without an account". Footer: "Cancel", "Create & open". Creation makes a draft and opens the builder. The team page opens the dialog on this type for `?new=survey`, with `&template=health_check` preselecting the template.

States: default; a team without statements changes nothing (the six built-in statements apply); the tile is disabled, with its reason, for a viewer who may not create.

### 9.2 Builder — `surveys/edit`

Mockup: ScreenSurvey frame a. AppLayout, breadcrumb team › Surveys › title, badge "Draft", "Saved n s ago", "Preview", "Publish".

- Title and a line "n questions".
- Question list: drag handle (dnd-kit, keyboard move with announcements), number, type, label, badges ("Required", the kind, "n options"). The selected question opens: type select, "Required" switch, Duplicate, Delete, label field, and by kind: the two end labels and a preview of the scale; the option rows (add, remove, 2 to 10); nothing more for NPS and text.
- "Add" bar with the five kinds.
- Settings panel (a Sheet below `lg`): "One question at a time", "Show results after answering", "Allow guests without an account".
- Every change is saved by itself (debounced); a failed save shows the error on its field and "Not saved".
- "Preview" opens the participant view in a dialog, fed by the builder's state, without saving an answer.

States: empty (no question: the "Add" bar and an empty state); selected question; dragging; saving, saved, not saved; locked template (health check: the list is read-only, with "Manage statements"); open or closed survey (the builder shows the questions read-only, the settings stay editable, "Back to draft" when allowed); 403 for a non-editor.

Omitted: the anonymity radio group, "Close" (date) and "Display threshold" of the settings panel, the info alert about three answers when the threshold does not apply, "about 2 minutes", "sent at the end of the retro of…", the "Other" option, "280 characters max".

### 9.3 Participant page — `surveys/show`

Mockup: ScreenSurvey frame b; MobileRituals (phone). Minimal chrome: logo, title · team, badge "Anonymous answers", the viewer's avatar. No sidebar.

- One question at a time (setting on): "Question n of N", the segmented progress, the card with the kind badge, the question in the display font, its control, the optional comment, "Previous" / "Next" ("Finish" on the last), the keyboard hint, the privacy line. Digits answer a scale or NPS, arrows move inside a group, Enter goes on. On a phone: the card is full width, NPS on two rows with 44 px targets, the two buttons docked at the bottom.
- All on one page (setting off): the questions as `SurveyQuestion` cards and one "Finish" button.
- After "Finish": a thank-you state with "Change my answers", then the results when §6.4 allows them.

States: answering; a required question left empty ("An answer is required"); saving an answer failed (the answer stays on screen with "Not saved", retry); finished; finished with results; closed before the viewer answered ("This survey is closed", results); draft (403); lost connection (the session banner of the parent spec §6.3, with the sentence "Your answers are saved as you give them; the counter is paused"); expired session; deleted survey.

Omitted: "~ 1 min left"; the category line above the question on the phone frame.

### 9.4 Results, live and closed — `surveys/results`

Mockup: ScreenSurvey frame c. AppLayout, breadcrumb, status badge ("Open" with the live response count, or "Closed"), "Export CSV" (closed, editor), "Share" (opens the Share dialog), and for an editor "Close" / "Reopen".

- Line "n answers out of m members · anonymous · closed on …".
- Tabs: Summary, Free-text answers, Compare.
- Summary: one card per question in a three-column grid (one column on a phone): scale (mean, most frequent, histogram with the end labels), NPS (score, stacked bar, three counts, distribution), single and multiple choice (result bars, "n · p%", the leading option full, the others at 45 %), text (the first six answers as coloured cards, "See the n answers").
- Free-text answers: every text answer and every comment, per question.

States: open and live (the counter and, for whoever may see them, the cards update without a reload); below the threshold ("Results appear from 3 answers. n so far."); no answer yet; closed; a member who may not see results yet (the counter and "Results will show when the survey is closed"); skeleton while the snapshot loads.

Omitted: keywords, "Send to whiteboard".

### 9.5 Compare

Mockup: the third tab of frame c ("Compare with sprint 41") and the "+11 vs sprint 41" badge of the NPS card. A select names the survey compared with (default of §6.6). Each matched question shows the two values and the signed difference, written, never colour alone; unmatched questions are listed under "Only in this survey" and "Only in the other". When the default comparison exists, the Summary cards carry the same badge as the mockup.

States: no other closed survey ("Nothing to compare with yet"); the other survey below its threshold (no values); questions that all differ.

### 9.6 Closed survey

The results page with the "Closed" badge, "Export CSV" and "Reopen" for an editor. The participant page of a closed survey shows the closed state of §9.3.

### 9.7 Team page, guest join, share

- Team page: a "Surveys" section in the mockup's place for sessions of this type: `SessionCard` kind survey with status, the number of answers and questions, and for an editor "Duplicate" and "Delete" in the card menu; `EmptyState` module survey ("No survey published yet", "Create a survey"). The sidebar entry "Sessions" reaches it by anchor.
- Guest join: `surveys/join` on the shared `GuestJoinPage`, kind survey, with the session summary of B45 (title, facilitator, people who joined, live while open).
- Share: the existing `ShareDialog`, kind survey: link, QR code, guest switch, "Create a new link" with confirmation.

### 9.8 The health check in a retro

No mockup shows where it sits once the phase is gone; this is designed from `HealthCheck/README.md`, `SessionSettingsPopover/README.md` and the retro frames, and is decision 1 of §17.

- Creation: the "Health check" row of the dialog stays (the mockup has it); it attaches a health check when the retro is created.
- Settings popover: "Add survey" becomes the mockup's menu with two entries, "Health check" (badge "Built-in", "n statements") and "Quick poll" (today's dialog). Once attached the first entry reads "Health check added". "From a template…" is omitted.
- Header: a "Health check" button with "n/m" while one is attached. It opens a dialog (a drawer on a phone) holding the existing `HealthCheckForm` while open, and `HealthCheckResults` once closed. The facilitator finds "Close the health check", "Reopen" and "Remove". "Remove" deletes a health check nobody has answered; one that has answers is hidden and kept, and comes back with them when it is added again, as turning the setting off and on does today.
- It can be answered in every open phase unless the board is locked. It closes with the retro. The completed retro shows "Team health" as today.

### 9.9 Health-check page of a team

The page built by plan 18e (`teams/health-check`): statements manager and Mood trend. It gains a primary action "Start a health check" (opens the "New session" dialog on Poll with the template selected) and its trend counts the health checks run as surveys.

## 10. CSV export

`GET surveys/{teamSurvey}/export`, editors only, closed surveys only (an export of an open survey taken after each answer would tell who answered what). `text/csv; charset=UTF-8` with a byte-order mark, streamed, file name `survey-<slug of the title>-<date>.csv`.

One row per respondent who gave at least one answer, sorted by the content of the row (never by time or by person, the rule text answers already follow), and named "Respondent 1" to "Respondent n" after the sort. Columns: "Respondent", then one per question in order ("Q1 · label"), followed by "Q1 · comment" when the question takes comments. Cells: the number for a scale or NPS, the option label for a single choice, the labels joined by " | " for a multiple choice, the text for a text. A cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return is prefixed with an apostrophe, so that a spreadsheet does not run it as a formula. Below the threshold the export is refused like the results.

## 11. The health-check migration

### 11.1 What exists

| Thing | Where |
|---|---|
| Team statements | `team_health_statements`, `TeamHealthStatements`, `ManageTeamHealthStatements`, four `teams.healthStatements.*` routes |
| Statements frozen per retro | `retro_health_statements`, `FreezeHealthStatements` (at creation, when the setting is turned on, and again for every unanswered open retro when the team's statements change) |
| Answers | `health_check_answers` (retro, participant, statement key, score 1 to 10), `HealthCheckAnswersController`, routes `retros.health-check.update|destroy`, event `health.answered` |
| The phase | `RetroPhase::HealthCheck`, `Retro::phases()`, `retros.health_check_enabled`, guards naming the phase in `ColumnsController`, `ColumnOrdersController`, `RetroSettingsController`, `RetroPhase::hidingOthersCards()` |
| Readers | `PresentHealthCheck` and `PresentHealthProgress` (board snapshot), `SummarizeHealthCheck` (results, B3 `previousAverage`, AI summary input, recap e-mail line, MCP), `BuildHealthTrend` (results, MCP), `BuildTeamMoodTrend` (B23), `BuildResults`, `BuildSummaryInput`, `RetroResultsNotification` and `RetroRecapMail` (and the Mailable and mail preview of plan 18f), MCP `retro.board.health.get`, the prompts `team-health` and `analyze-retro`, the MCP server instructions and board presenter (phase names), `TeamsController` and `TeamHealthChecksController` (statements), `MarkRetroStarted` (first health answer) |
| Front | the health-check panel of the retro, the stepper, the reducer actions `health.progress` and `health.answer`, the results section with radar and trend, the creation switch, the settings toggle, the team card, the health-check page |

No REST API exposes health data; the MCP server is the only programmatic reader. No webhook or chat message carries it. The recap built by `BuildRetroRecap` leaves it out; the e-mail adds one line from `SummarizeHealthCheck`.

### 11.2 Principle

The data moves to the team-survey tables; the readers keep their signatures and their output and are rewritten over the new tables. `SummarizeHealthCheck::handle(Retro, ?Participant)`, `BuildHealthTrend::handle(Retro)`, `PresentHealthCheck::handle(Retro, Participant)` and `PresentHealthProgress::handle(Retro)` answer the same shapes with the same numbers, so that `BuildResults`, `BuildSummaryInput`, the recap, the MCP tool and the board need no change beyond what the removal of the phase imposes.

### 11.3 Data migration

One class, `App\Support\Surveys\ImportHealthChecks`, written with the query builder only (no model, no raw SQL), run by a migration and by the command `surveys:import-health-checks`. It is additive and idempotent: it never changes or deletes an old row, creates what is missing, and can be run again.

For each retro that has frozen statements and either has answers, or is not completed and has `health_check_enabled`:

| New row | From |
|---|---|
| one `team_surveys` row | `team_id` and `retro_id` of the retro; `title` = the retro's title; `template` = `health_check`; `status` = `closed` when the retro is completed, `open` when it is not, and `draft` when the retro's setting is off (a health check that was turned off keeps its answers today and shows them nowhere but on the board; as a draft it is hidden, and comes back with its answers if it is added again); `opened_at` = the first answer, else the retro's creation; `closed_at` = `completed_at`; `results_threshold` = 0; `one_question_at_a_time` = false; `show_results_after_answer` = false; guest access off (the retro's own guests reach it through the retro); a fresh `guest_token` |
| one `team_survey_questions` row per frozen statement | `kind` scale, `scale_max` 10, `position`, `match_key` = the statement key, `builtin`, `label` = the custom text or the English text of the built-in, `short_label` = the custom label |
| one `team_survey_respondents` row per participant who answered, and one for the retro's facilitator | `participant_id`, the participant's `user_id` and `guest_name`; `completed_at` = their last answer |
| one `team_survey_answers` row per answer to a frozen statement | `value` = the score, the original timestamps |

Not copied: answers whose statement is not in the retro's frozen set. Every reader ignores them today (`BuildHealthTrend` filters on the frozen keys, `SummarizeHealthCheck` iterates over the frozen statements), so copying them would change scores. The import counts them and the old tables keep them.

A completed retro with the setting on and no answer gets nothing, as it has no result today.

The command `surveys:verify-health-import` compares, per retro, the number of answers and the sum of scores on frozen statements in the old and the new tables, and fails on a difference.

### 11.4 The retro without the phase

- Phases: Icebreaker (optional) → Writing → Grouping → Voting → Discussing → Actions → ROTI → Completed. `RetroPhase::HealthCheck` is removed, with its place in `Retro::phases()`, `hidingOthersCards()`, the three guard lists and the settings toggle.
- A migration moves every retro still in `health_check` to `icebreaker` when its icebreaker is on, else to `writing`, after running the import again so that an answer written since the first run is not left behind. The icebreaker room is created on the first board snapshot, as `EnsureIcebreakerRoom` already allows.
- `teams.retros.store` keeps the field `health_check_enabled`; it now attaches a health check (`AttachHealthCheck`). `retros.settings.update` no longer takes it. Two new resources replace the toggle: `retros/{retro}/health-check` (attach; remove, which hides a health check that has answers and deletes one that has none) and `retros/{retro}/health-check/closure` (close, reopen).
- `retros.health-check.update|destroy` keep their URLs and bodies and write a team-survey answer. They are allowed in every open phase, while the health check is open and the board unlocked. The first answer still stamps `started_at` (B19).
- The board snapshot keeps `healthCheck` (statements with `count`, `answeredBy`, `myScore`) and adds `surveyId`, `isClosed`, `respondents`, `participants` and, once closed, `results` (the summary). `retro.healthCheckEnabled` goes; `phases` loses `health_check`.
- `retros.health_check_enabled` is no longer read or written. The column stays until the old tables are dropped.

### 11.5 Team card, management page, Mood trend

- The compact card of the team page is unchanged; its sentence becomes "n statements, scored 1 to 10, asked in every health check".
- The management page keeps the manager and the trend, and gains "Start a health check".
- `BuildTeamMoodTrend` keeps its point shape and adds `surveyId`; `retroId` becomes nullable. ROTI comes from completed retros as today. Mood comes from the team's closed health checks: an attached one is merged into its retro's point, a standalone one is a point of its own, titled and dated by the survey, linking to its results. Order and the limit of eight are unchanged.
- `BuildHealthTrend` lists the team's last six closed health checks, attached or not, with `delta` and `sameStatements` computed as today from the questions' `match_key`.

### 11.6 Session-end deltas, recap, AI summary

- `results.health.statements[].previousAverage` (B3): the average of the same statement in the team's previous closed health check, whatever its kind of session. Still withheld from a guest.
- The recap e-mail line and the AI summary input read `SummarizeHealthCheck` and do not change.

### 11.7 MCP

`retro.board.health.get` keeps its name and fields. Its `status` becomes `not_run` (no health check), `in_progress` (open: categories with the number of answers, who answered on a non-anonymous retro, the caller's own scores) or `completed` (closed: averages, score, alignment, strengths, trend). `collected` disappears: a closed health check shows its results whether or not the retro is completed. Trend points gain `surveyId` and may have a null `boardId`. The server instructions and the two prompts drop the phase name. No survey tool is added.

### 11.8 Rollout order

Each step leaves every reader fed.

1. Tables and models of the team survey. Nothing reads them.
2. The import migration. Old tables stay the source; the copy is beside them.
3. The switch, merged as one unit: the retro's health endpoints write team surveys, and the board presenters, summaries and trends read them. Before this unit the old readers read the old tables; after it the new readers read the new tables, which the import filled. No commit of the unit is deployed alone.
4. The Poll screens. Standalone health checks start to appear in the trend.
5. Removal of the phase: the second import run, the phase move, the enum case, the front. Then the old models, factories and `FreezeHealthStatements` are deleted.
6. Not in this spec: a later release drops `retro_health_statements`, `health_check_answers` and `retros.health_check_enabled`, after `surveys:verify-health-import` has passed on the production data. `ImportHealthChecks` returns at once when the old tables are gone, so a fresh install keeps migrating.

A production upgrade runs steps 1 to 5 in one deploy: the migrations run, then the new code serves. Mood data is on screen before and after.

## 12. Routes, policies, validation

Team scope (prefix `w/{workspace}`, `can:view,workspace`, scoped bindings):

| Route | Name | Controller | Authorisation |
|---|---|---|---|
| `POST teams/{team}/surveys` | `teams.surveys.store` | `TeamSurveys\TeamSurveysController@store` | `createSurvey` on the team (new ability of `TeamPolicy`, equal to `view`) |
| `POST teams/{team}/health-statements` and the four others | unchanged | unchanged | unchanged |

Survey scope (prefix `surveys/{teamSurvey}`, UUID, middleware `ResolveSurveyRespondent`, scoped bindings):

| Route | Name | Controller | Guard |
|---|---|---|---|
| `GET /` | `surveys.show` | `TeamSurveysController@show` | respondent; draft: editor |
| `GET edit` | `surveys.edit` | `@edit` | editor, not a guest |
| `PATCH /` | `surveys.update` | `@update` | editor |
| `DELETE /` | `surveys.destroy` | `@destroy` | editor |
| `GET snapshot` | `surveys.snapshot.show` | `TeamSurveySnapshotsController@show` | respondent |
| `POST questions`, `PATCH questions/{question}`, `DELETE questions/{question}` | `surveys.questions.store|update|destroy` | `TeamSurveyQuestionsController` | editor, draft, not a locked template |
| `PUT question-order` | `surveys.questionOrder.update` | `TeamSurveyQuestionOrdersController@update` | as above |
| `POST questions/{question}/duplicate` | `surveys.questions.duplicate.store` | `TeamSurveyQuestionDuplicatesController@store` | as above |
| `PUT status` | `surveys.status.update` | `TeamSurveyStatusesController@update` | editor; transitions of §7 |
| `PUT questions/{question}/answer`, `DELETE …` | `surveys.answers.update|destroy` | `TeamSurveyAnswersController` | respondent, open |
| `POST submission`, `DELETE submission` | `surveys.submission.store|destroy` | `TeamSurveySubmissionsController` | respondent, open |
| `GET results` | `surveys.results.show` | `TeamSurveyResultsController@show` | not a draft; the page renders for whoever may open the survey, the data follows §6.4 |
| `GET comparison` | `surveys.comparison.show` | `TeamSurveyComparisonsController@show` | §6.6 |
| `GET export` | `surveys.export.show` | `TeamSurveyExportsController@show` | editor, closed |
| `POST guest-token` | `surveys.guestToken.store` | `TeamSurveyGuestTokensController@store` | editor |
| `POST duplicate` | `surveys.duplicate.store` | `TeamSurveyDuplicatesController@store` | not a guest, `createSurvey` on the team |

Outside any scope: `GET|POST surveys/join/{guestToken}` (`surveys.join.show|store`, `TeamSurveyJoinsController`, the store throttled 10 per minute).

Retro scope, added: `POST|DELETE retros/{retro}/health-check` (`retros.healthCheck.store|destroy`, `Retros\RetroHealthChecksController`, facilitator, open retro; the delete removes an unanswered health check and hides an answered one) and `PUT|DELETE retros/{retro}/health-check/closure` (`retros.healthCheck.closure.update|destroy`, `Retros\RetroHealthCheckClosuresController`, facilitator).

Validation, in Form Requests with array rules: `title` required, at most 120; `template` one of the enum; `source_survey_id` a survey of the same team, exclusive with `template`; settings are booleans; a question: `kind` of the enum, `label` required at most 200, `description` at most 500, `is_required` boolean, `scale_min_label` and `scale_max_label` at most 60 and only for a scale, `options` required for a choice (2 to 10, each 1 to 100 characters) and prohibited otherwise; an order: every question id of the survey exactly once. An answer is validated against the question read under the survey's lock, so that a concurrent edit cannot slip a mismatched answer in: a field that does not belong to the kind is prohibited.

Transactions lock the `team_surveys` row first (the aggregate root), then read.

## 13. Backlog

Anonymity modes; close date and automatic close; a threshold setting; saved survey templates and "From a template…"; "Send to whiteboard"; keywords; the "Other" option; per-question length; MCP survey tools and a token scope; a survey source for action items (roadmap AI, D-19); hand-over; a live list of surveys on the team page; moving the retro surveys onto the team-survey tables.

## 14. Testing

- Pest feature tests for every route, guard and transition; the redaction matrix of §6.4 per viewer and status; the threshold; the summaries per kind with hand-computed values; comparison matching; the CSV, including formula-leading cells and the shuffle; channel authorisation for a member, a survey guest, a retro guest of an attached survey, an outsider.
- Import tests on fixtures written straight into the old tables: a team with custom and archived statements; a completed anonymous retro with a guest, a former member, partial answers and an answer to a statement outside the frozen set; an earlier completed retro (for deltas and trend); an open retro in the health-check phase with answers; a completed retro with the setting on and no answer; a retro with answers whose setting was turned off. Expected values are written by hand. The import is run twice to prove idempotence.
- The existing health tests (`HealthCheckTest`, `HealthCheckSummaryTest`, `HealthTrendTest`, `HealthStatementFreezeTest`, `HealthStatementModelsTest`, `TeamMoodTrendTest`, `TeamHealthStatementsTest`, `InsightsHealthRotiTest`, the health parts of `ResultsTest`, `SummaryInputTest`, `RetroStartTest`, `ResultsEmailTest`) are kept: their fixtures move to the new tables through two test helpers, their assertions on values do not change, and the ones about the phase are rewritten for the attached health check. None is deleted; the plan lists each change.
- Vitest for the reducer, the adapters and the changes to `SurveyQuestion`.
- Browser: a new walkthrough file for the survey (create, build, publish, answer as member and as guest in two browsers, live counter, close, results, compare, export link) and the rewrite of `Plan08bHealthCheckTest` for the health check without a phase. `Plan08c` and `Plan08e` gain one click ("Quick poll" after "Add survey"); the survey part of `Plan08d` must pass untouched.
- Visual captures of the five new screens in light and dark, at 1440 and 390, in French and English, compared with the mockup.

## 15. Acceptance criteria

1. The "New session" dialog offers five types in the order Retro, Poker, Whiteboard, Poll, Icebreaker. Poll creates a draft team survey through `teams.surveys.store` and opens its builder. A user who cannot view the team gets 403.
2. A survey created from "Health check" has one scale question from 1 to 10 per active statement of the team, in the team's order, with the built-in ones translated for each reader; its questions cannot be edited, added or removed. A survey created from "Team pulse" has the five questions of the mockup. A duplicate copies questions, options and settings, no answer, and points to its source.
3. In the builder an editor adds each of the five kinds, edits, reorders (pointer and keyboard), duplicates and deletes questions, marks one required, and every change is saved without a save button. A choice question refuses fewer than 2 or more than 10 options; a survey refuses a thirty-first question. A non-editor gets 403 on the builder and on every write.
4. Publish is refused without a question. Questions cannot change once the survey is open. "Back to draft" works until the first answer and is refused after.
5. A member, a guest holding the link, and a participant (guest included) of the retro an attached survey belongs to can each answer; an outsider, a guest when guest access is off, and a guest whose link was replaced cannot. One person has one response.
6. Each kind accepts its values and refuses the others (a scale answer above its maximum, an option of another question, an empty text, a comment on a question that takes none). "Finish" is refused while a required question is unanswered and names it. Answers are refused on a draft and on a closed survey.
7. A viewer without the right of §6.4 receives no count per option, no mean, no score and no text of others, in the page props, the snapshot and every event. An editor receives them while the survey is open. A respondent receives them after finishing when the setting is on, and everyone who can open the survey once it is closed.
8. With a threshold of 3, nobody receives aggregates before the third respondent; the payload carries the number of answers. A health check attached to a retro shows its results from the first answer.
9. No payload, export or event links an answer to a respondent. Text answers come sorted by text. The ids of answers are not time-ordered.
10. For the scale answers 2, 3, 3, 4, 4, 4, 5, 5, 4 the result gives the mean 3.8 and the most frequent value 4. For the NPS answers 5, 6, 7, 8, 8, 9, 9, 10, 10 it gives 2 detractors, 3 passives, 4 promoters and the score 22. A multiple choice ticked by 6 of 9 respondents reads "6 · 67%".
11. An answer given in one browser moves the counter in another without a reload; a viewer who may see results sees the cards change; closing the survey switches every open participant page to its closed state.
12. The channel `presence-survey.{id}` is refused to an unauthenticated socket, to an outsider and to a guest of another survey.
13. Compare pairs the questions of two surveys of the same team by `match_key`, then by kind and label, and gives each difference; a question present in one only is listed apart; a survey of another team, an open survey and any survey for a guest are refused.
14. The CSV is served to an editor of a closed survey only. It holds one row per respondent in an order that does not depend on when or by whom the answers were given, no name, one column per question, and a cell that begins with `=`, `+`, `-` or `@` is neutralised.
15. Deleting a survey removes its questions, respondents and answers, and tells the open pages.
16. After the import, for every retro of the fixtures, `SummarizeHealthCheck` returns the same statements, averages, counts, consensus, score, participation, strengths and assessment as before; `BuildHealthTrend` and `BuildTeamMoodTrend` return the same points; the recap e-mail carries the same health line; `retro.board.health.get` returns the same completed payload. Running the import a second time changes nothing.
17. The import leaves the old tables as they were, and `surveys:verify-health-import` passes; it fails when a copied answer is altered.
18. A retro in the `health_check` phase when the migration runs is in `icebreaker` (icebreaker on) or `writing` afterwards, its health check is open, and its answers are there.
19. A retro runs Icebreaker (optional) → Writing → Grouping → Voting → Discussing → Actions → ROTI → Completed; no payload, page or MCP answer names a health-check phase.
20. A retro created with "Health check" on has an attached health check with the team's active statements. A participant, a retro guest included, answers it from the header button in any open phase; it is refused on a locked board and once closed. The facilitator closes it, which shows the results to everyone, and reopens it. Removing it deletes it when it has no answer, and otherwise hides it with its answers, which come back when it is added again. Completing the retro closes it. On a non-anonymous retro the form shows who has answered each statement; on an anonymous one, counts only.
21. Changing the team's statements rebuilds the questions of every health check of the team that is not closed and has no answer, attached or not, and of no other.
22. The Mood trend of the health-check page shows the same points as before the migration, and a health check run as a survey adds a point, titled by the survey and linking to its results. The team page still shows the ROTI curve.
23. On a completed retro each statement carries `previousAverage` from the team's previous closed health check, attached or standalone; a guest receives none.
24. The fourteen `retros.surveys.*` routes behave as before. The survey part of `Plan08d` passes without an edit; `Plan08c` and `Plan08e` pass with one change, a click on "Quick poll" after "Add survey", which the mockup's menu imposes.
25. The team page lists the team's standalone surveys with their status and counts; a draft is listed for its editors only; the health-check page offers "Start a health check".
26. Every new string exists in the four languages; the five new screens render at 1440 and 390, in light and dark, without horizontal overflow, and each is compared with its mockup, the differences being rows of the plan's deviations table or fixed.
27. The feature suite passes on SQLite and on PostgreSQL. No new `whereRaw`, `selectRaw`, `DB::raw`, `DB::statement` or `DB::getDriverName()`.

## 16. Risks

- **The switch of the health readers.** Seven actions and about twelve test files move at once. The readers keep their shapes so that the comparison "same numbers before and after" is a test, not a hope; the unit of step 3 of §11.8 must not be split across deploys.
- **Scores that change silently.** Answers outside the frozen set are ignored today; an import that copied them would move scores. The import skips them and the verification command proves the rest.
- **Two things called survey.** `Survey` (in a retro) and `TeamSurvey`. The vocabulary of §5 is the guard; a later plan may merge them (§13).
- **Privacy by timing.** An editor watching live results sees which bar moves when someone answers. The threshold of 3 covers the first answers of a standalone survey; it does not exist for a health check in a retro, where today's behaviour is kept. The CSV is closed-only for the same reason.
- **Base branch.** This was read on `plan-18e-screens` while lanes are open; `RetroPhase` has nine cases only in `laneBackA`, the health-check page exists only in `laneTeam`. The plan starts after plans 18e to 18g are merged and re-reads each file.
- **A health check with no place on the board.** The header button of §9.8 has no mockup. It is put to the owner before it is built.
- **Foreign keys added after table creation** (`facilitator_respondent_id`, `previous_survey_id`) follow the pattern of `whiteboards` and `survey_comments`; how SQLite's table rebuild treats them was not verified by the portability audit either (its §8 point 8).
- **Size.** A new session type end to end, a builder, three other screens and a data migration. The lanes of the plan keep the migration apart from the screens.

## 17. Decisions for the owner

The body above is written on the recommended option of each. The plan carries a table of the tasks that change with another answer.

**1. Can a health check still be answered inside a retro?**
- A. No. It is run only as a Poll. The "Health check" row leaves the retro's creation dialog; a retro's results, recap line and MCP answer show health for the retros of before only.
- B. Yes, attached to the retro, without a phase: the "Health check" row and the "Add survey → Health check" entry attach it; participants answer from a header button in any open phase; it closes with the retro. **Recommended.** It keeps the one-link flow teams have today, and the health section of the results, the recap line and the session-end deltas stay alive for new retros. Cost: about five tasks, and a header button with no mockup.
- C. Attached, and shown as a step of its own between Actions and ROTI, as the note of the SessionSettingsPopover mockup says. This is a phase again, which the owner's third round rules out.

**2. Do the surveys inside a retro change?**
- A. No: one question, three kinds, their own tables, as plan 18e leaves them; "Quick poll" in the menu. **Recommended.** No regression risk on sixty browser assertions; nothing a user asked for is missing.
- B. They move onto the team-survey tables now and gain scale, NPS and several questions. A rewrite of the retro-survey back end and front, about ten more tasks.
- C. They are removed; a retro attaches team surveys only. Loses reactions, comments and "Show who answered" on a survey.

**3. The scale of the health check.**
- A. Stays 1 to 10. **Recommended.** It is what the data holds and what the owner's answer on D-76 wrote ("scale 1–10"); the trend stays continuous. The builder still offers the mockup's 1 to 5 for an ordinary scale question.
- B. New health checks use 1 to 5, as `HealthCheck/README.md` draws; old ones are shown halved in the trend. Changes the meaning of every past score on screen.
- C. The team chooses per health check. A setting more, and trends that mix scales.

**4. Results before three answers.**
- A. No minimum anywhere, as today.
- B. A minimum of 3 on a survey created from the dialog (what the mockup states in three places); none on a health check attached to a retro and on migrated ones. **Recommended.** Faithful where the mockup speaks, unchanged where a small team's retro would otherwise lose its health results.
- C. A minimum of 3 everywhere. A two-person retro no longer sees its health check; old retros with one or two respondents go blank.

**5. Anonymity.**
- A. A team survey is always anonymous; the only names ever shown are who has answered a statement of a health check in a non-anonymous retro, as today. **Recommended.** The mockup's default; the three modes stay in the backlog as the roadmap says.
- B. One switch per survey, anonymous or named (two of the mockup's three modes). Named results need a "who answered what" view the mockup does not draw.
- C. The three modes now. The largest; "at the participant's choice" changes every result card.

**6. Templates.**
- A. Built in only (Blank, Health check, Team pulse) plus "start from a previous survey". **Recommended.** Covers the owner's sentence ("health check as a default template") and repeat surveys; nothing to manage.
- B. Also saved templates per workspace, with a Surveys tab on the templates page and the "From a template…" entry in a retro. About six more tasks.
- C. Health check and Blank only. Drops the mockup's example survey.

**7. The old health tables.**
- A. Kept unread for one release, dropped by a later plan once the verification command has passed on production data. **Recommended.** A way back if a number is wrong.
- B. Dropped at the end of this plan. One migration less later, no way back.

**8. What the CSV holds.**
- A. One row per respondent, unnamed, in an order that tells nothing, available once the survey is closed. **Recommended.** What a spreadsheet needs, without telling who answered when.
- B. Aggregates only (one row per question and option). Safer for a very small team; useless for cross-reading answers.
- C. Rows per respondent at any time. Lets an editor follow answers one by one.

Not decisions, but to confirm with the pre-build deviations: the English label is "Poll" on the tile, as the SessionTypePicker mockup writes it, and "Survey" everywhere else, as the team-page mockup writes "New survey" (the component built by plan 18c says "Survey" on the tile today); the form of the Poll type in the dialog and the health-check button of the retro header have no mockup and are designed from their neighbours.

## 18. Not determined by reading

1. Whether the health-check page of rework RW-T2 lands as read in `laneTeam` (route `teams.healthCheck.show`, `PresentTeamHealthStatements`, the trend prop). Uncommitted there.
2. The final state of `SurveyGuard::activePhase` and of the retro header after the retro lane merges (B1, the rework of the session header), which decides where the health-check button and the "Add survey" menu are mounted.
3. The Mailable and the mail preview of plan 18f that read `SummarizeHealthCheck` (`laneAuth`): assumed to call it with the same arguments.
4. Whether `SurveyQuestion` renders a scale of ten values correctly; it was built for five and for NPS.
5. How many production retros hold answers outside their frozen statement set, and whether any retro has frozen statements but an inconsistent key (a deleted custom statement).
6. Whether `settings.changed` is enough for every open board to pick up an attached health check (it refetches the snapshot in `use-retro-board.ts` today).
7. Whether the team mood trend was meant to count a completed retro whose health check had been turned off but still held answers: `BuildTeamMoodTrend` does today (it does not read the setting), `BuildHealthTrend` does not. After the migration neither does.
8. The size of `tests/Pest.php` conflicts: every lane adds helpers to it.
9. What the old readers return for the migration fixtures: the expected values of the parity tests were computed by hand from the code as read; the plan checks them against the old code before it rewrites the readers.
10. How `UuidPrimaryKeysTest` (it reads `information_schema`) and the rest of the suite behave on SQLite and MariaDB today: the portability work is a separate plan.
