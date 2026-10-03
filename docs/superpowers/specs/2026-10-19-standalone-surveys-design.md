# Skrum — Standalone surveys, the Poll session type, and the health check as a survey template — Design

Date: 2026-10-19, revision v2 of 2026-10-03
Status: Rulings taken on the recommended option of each decision of §17 (owner mandate of 2026-10-02: autonomous, rulings logged for the owner), except ruling 3, which the owner replaced (seventh round, D-102). The new questions this revision raises are §17 items 9 to 12. Nothing is built before the owner has read §17.
Parent spec: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` (§4 "Health check phase", §5 rule 13, §6.4, §9 B1, B3, B18, B19, B23, §10). This spec reverses three lines of it: the health-check phase of §6.4, the "four session types" of §6.4 and B18, and the mood source of B23.
Owner's word: `docs/superpowers/research/front-rewrite/owner-answers-2026-10-02.md` — third round ("1 Poll", "Health check", "10 Mood"), fourth round (D-51), fifth round (D-76, D-77, roadmap change, working rules), sixth round (register, participation), and the seventh round recorded in `.superpowers/sdd/plan-19/progress.md` (D-102: health check scored 1 to 5 with "Submit answers"; old 1-to-10 scores halved in trends).
Roadmap rows: SV-1 to SV-5 of `docs/superpowers/research/front-rewrite/feature-roadmap.md`. Deviation rows cleared: D-03, D-09 (Poll), D-22 and D-102 of plan 18e. D-23 stays.
Mockups (binding, parent spec §5 rule 13): `docs/design-system/components/ScreenSurvey` (three frames: a builder, b participant, c results), `SurveyQuestion`, `MobileRituals` (survey phone frame), `ScreenSessionCreate` and `SessionTypePicker` (Poll tile), `SessionSettingsPopover` ("Add survey" menu), `HealthCheck` (form 1 to 5 with "Submit answers", results with the 1→5 distribution), `GuestJoin`, `ShareDialog`, `EmptyState`.
Database rules: `docs/database.md` of the branch `plan-db-portability` ("Rules for database code" 1 to 12, the concurrency harness, the Upgrade suite).
Research: `docs/superpowers/research/front-rewrite/18e-briefs/08-surveys.md`, `18e-report/02-retro.md` (rows D-97 to D-115), `translations-review.md` (register, glossary choices).

What was read, and what was not: the code of the branch `plan-db-portability` in the worktree `.claude/worktrees/laneDb` at `8ea5ce49` (plans 18e to 18g with rework 3 merged, and the database-portability work up to its concurrency harness). Nothing was run. The plan re-reads every file it touches.

## 0. What revision v2 changes

1. **Health check on 1 to 5 with "Submit answers" (D-102).** New health checks are scored 1 to 5 between "Strongly disagree" and "Strongly agree"; a participant scores every statement and sends them together; once sent the form is read-only. Old 1-to-10 scores are kept as given and read on the 1-to-5 scale by one rule (§11.9), used by every reader.
2. **Owner decisions since the first draft:** informal register in every language for every new text; a guest counts as a participant; rework 3 (surveys still open at the end of a retro show their results to everyone; the session-end health card is compact rows plus "Details"; the reaction bar stays at session end; the ROTI wording of the mockup).
3. **Database rules:** Eloquent and the standard query builder only, Schema builder only in migrations, no driver branch; every test runs on PostgreSQL, SQLite, MariaDB and MySQL through `bin/test-db`; races are proved with `tests/Concurrency` (`Race`); the health-data migrations are tested with the `tests/Upgrade` pattern.
4. **Working rules:** no browser walkthrough is written or run; unit and feature tests are written and run; captures are taken in one configuration (light, 1440, French).
5. **Front end:** the screens use the components that exist now (session shell and header, Share dialog, guest-join page, `SurveyQuestion`, the health-check components of `components/skrum`).
6. **Roadmap:** plans 28 and 30 and scheduling are backlog; nothing here reserves a place for them.
7. **An attached health check lives in its retro.** It is answered, closed and read there only; the survey pages refuse it. This follows from 1 (one answering flow per health check) and is decision 10 of §17.

## 1. Problem statement

A survey exists only inside a retro, as one question with three kinds of answer (`surveys.retro_id`, `SurveyKind`: single, multiple, text). The mockups show a survey as a session of its own: a builder with several questions, scale and NPS questions, a page a participant answers one question at a time, aggregated results, a comparison with the previous survey and a CSV export. The "New session" dialog shows five types; the application offers four.

The health check is a retro phase (`RetroPhase::HealthCheck`) with its own tables (`team_health_statements`, `retro_health_statements`, `health_check_answers`), its own endpoints and its own event, scored 1 to 10, each score saved on its own. The mockups have no such phase (deviation D-03) and score 1 to 5 with a "Submit answers" step (deviation D-102). The owner decided that the health check becomes a default survey template, that the phase goes, and that it is scored 1 to 5 as the mockup draws it.

## 2. Goals

1. A team runs a survey as a session of its own: created from the "New session" dialog (type Poll), built in a builder, answered on its own page by members and by guests with a link, followed live, closed, compared and exported.
2. The five question kinds of the mockup exist: scale, NPS, single choice, multiple choice, free text.
3. The health check is a built-in survey template fed by the team's statements, scored 1 to 5. The retro has no health-check phase.
4. No health data is lost: every score ever given is kept as it was given, and no reader of health data goes dark. Every reader (summaries, team mood trend, session-end deltas, recap e-mail, AI summary input, MCP) shows health on the 1-to-5 scale, old scores read by the rule of §11.9, so that two readers never disagree.
5. The surveys inside a retro (plan 8c, rewritten by plan 18e and rework 3) keep working as they are.
6. Database code is Eloquent and the standard query builder only and runs unchanged on PostgreSQL, MySQL, MariaDB and SQLite; every test that touches the database passes on the four.

## 3. Non-goals

- The builder settings the owner left in the backlog: the three anonymity modes, the close date and "close when everyone has answered", the display-threshold setting. Their place in the settings panel is left (the mockup draws it in the panel itself).
- "Send to whiteboard", the keyword cloud, the "Other" option with free text, the per-question character limit, "about n minutes" estimates. No place is reserved for "Send to whiteboard": whiteboard collaboration (former plan 28) is backlog.
- Saved survey templates managed by a team or a workspace (the "From a template…" entry of the retro's "Add survey" menu, a Surveys tab on the workspace templates page).
- Moving the surveys inside a retro onto the new tables (§6.7, decision 2).
- Survey tools on the MCP server, a `surveys:read` token scope, survey webhooks, survey results by e-mail, survey mentions (former plan 30, backlog).
- Hand-over of a survey to another facilitator; scheduling a survey (scheduling is backlog).
- Dropping the old health tables: they are kept, unread, for one release (§11.8, decision 7).

## 4. Decisions already taken

| Topic | Decision | Source |
|---|---|---|
| Poll | A standalone survey entity, with its own page, guest link, live channel and results; the fifth type of the "New session" dialog | owner, third round; roadmap SV-1 |
| Builder, kinds, compare, CSV | The mockup's multi-question builder (reorder, duplicate, required), scale and NPS questions, compare, CSV export | owner, "Features to specify after the rewrite"; roadmap SV-2 to SV-4 |
| Health check | A default survey template; no dedicated retro phase | owner, third round; roadmap SV-5 |
| Health-check scale and flow | 1 to 5, ends "Strongly disagree" and "Strongly agree", a "Submit answers" step (the mockup), instead of 1 to 10 saved per score; existing 1-to-10 answers stay comparable, read halved (§11.9) | owner, seventh round (D-102) |
| Mood | Health-check score, beside ROTI | owner, third round point 10 |
| Mood trend | Lives on the health-check management page; the team page shows the ROTI curve alone | owner, fifth round D-77 |
| Health check card | Compact list with "Manage" ("Details" for a member who cannot manage); the sentence uses the real values | owner, fifth round D-76 |
| "Add survey" in a retro | In the settings popover only; no "Anonymous" badge on a retro survey; "n · p%" | owner 8-D2, 8-D3, 8-D4 |
| Surveys at the end of a retro | A survey still open when the retro is completed counts as closed: everyone sees its results, nobody is asked to answer | rework 3, R3-7 (D-123) |
| Session end | The health check shows compact rows, one per statement with its move, and "Details" opens the full results in a dialog; the reaction bar is docked under the results; the ROTI asks "Was this time together worth it?" with the five labels of the mockup | rework 3, R3-5 (D-111), R3-2 (D-112), R3-3 (D-109) |
| Participation | A guest counts as a participant. Participation = everyone who joined out of the team's members plus the participants who are not members | owner, sixth round; `BuildResults::participation` |
| Register | Informal everywhere: French "tu", Spanish "tú", German "du"; English unchanged; a plural "vous" only where a text addresses several people at once | owner, sixth round; `tests/Feature/InformalRegisterTest.php` |
| Guest join | Suggested random nickname and "Join the session" on every session type | owner, fourth round D-51; `PresentJoinSession::nickname` |
| Guest link controls | In the Share dialog only; "Create a new link" asks for confirmation | owner 2-D11 / 7-D2 |
| Session header | "team · type" above the title, the viewer's avatar at the end, a visible "Synced" state | owner, fourth round D-47, D-48, D-69; `components/session/session-shell.tsx` |
| Presentation | The mockup wins; a mockup element with no data is omitted, listed, and its place is left | parent spec §5 rule 13 |
| Database | Eloquent and the standard query builder only, no raw query, Schema builder only in migrations, no driver branch; tests on PostgreSQL, SQLite, MariaDB and MySQL | owner; `docs/database.md` |
| Tests | Unit and feature tests are written and run; browser walkthroughs are neither written nor run; captures in light, at 1440, in French | owner, working rules |
| Roadmap | Plans 28 (whiteboard collaboration) and 30 (mentions) and scheduling are backlog | owner, fifth round, roadmap change |

The product choices the sources do not settle are in §17, each with the option taken and the reason; the body is written on them.

## 5. Rules

The rules of the parent spec §5 apply to every front file (tokens, rem, Tailwind scale, no overflow, focus, contrast, motion, lucide, literal `t('…')`, presentational `skrum/` components, rule 13). The conventions of §9.2 of the parent spec apply to the back end: actions in `app/Actions/<Domain>`, one controller per resource with CRUD method names, `Gate::authorize` for team-level access, a guard class on live JSON endpoints, events sent to others only, UUID keys, migrations with `up` only.

The database rules of `docs/database.md` apply to every query, migration and test, in particular:

- no raw query of any form (rule 1); what SQL cannot say the same way on the four engines is done in PHP on bounded sets, aggregates are cast in PHP (rule 2); no driver test anywhere (rule 3);
- migrations: Schema builder only, `up` only, no expression or partial index, no `->collation()`, no database default on a JSON column, `dateTime()` for a non-null date column (rule 5); this spec adds no JSON column;
- transactions lock the aggregate root first; a callback retried with `Transactions::Attempts` touches nothing but the database (rule 6);
- an explicit tie-breaker on every sort; lists read by people sorted in PHP with `Alphabetical::sort()` (rule 7);
- tests never read SQL text (rule 8); derived columns are written by the models only (rule 9: none of the new tables has one; a legacy row written with `DB::table()` in a test sets the derived columns of the tables it writes, such as `users.email_key`); JSON compared with `toBeIgnoringKeyOrder` (rule 10);
- a race (one response per person, a limit, closing while answers arrive) is proved with `Tests\Concurrency\Support\Race` on PostgreSQL, MariaDB, MySQL and a SQLite file.

Every new text is written in the four languages, informal in French, Spanish and German.

Vocabulary, used the same way in code and in this document:

| Term | Meaning |
|---|---|
| retro survey | The existing one-question survey inside a retro (`Survey`, table `surveys`). Called "Quick poll" in the retro's "Add survey" menu. Unchanged. |
| team survey | The new entity (`TeamSurvey`, table `team_surveys`): a survey owned by a team, with questions. "Survey" in the interface; "Poll" on the tile of the "New session" dialog, as the mockup writes it. |
| attached survey | A team survey with a `retro_id`. In this spec only a health check can be attached. It lives in its retro (§6.3, §9.8). |
| standalone survey | A team survey without a `retro_id`. |
| respondent | A person in a team survey (`TeamSurveyRespondent`): a member, a guest of the survey, or a participant of the retro an attached survey belongs to. |
| editor | The survey's facilitator (its creator) or a workspace manager (`User::canManage`). |
| health scale | The 1-to-5 scale every reader of health data reports on (`App\Support\Surveys\HealthScale`, §11.9). |
| submission | A respondent's "Submit answers" (attached health check) or "Finish" (participant page): it stamps `completed_at`. |

## 6. Domain model

### 6.1 Tables

All keys are UUIDs. No JSON column, no expression index, no check constraint. Migrations are dated after the last one of the portability work (`2026_10_20_…`).

**`team_surveys`**: `team_id` (cascade), `retro_id` (nullable, cascade), `title` (120), `description` (500, nullable), `template` (nullable string: `health_check`, `team_pulse`, or null for a blank survey), `status` (`draft`, `open`, `closed`), `facilitator_respondent_id` (nullable, null on delete), `created_by_user_id` (nullable, null on delete), `guest_access_enabled` (default false), `guest_token` (40, unique), `one_question_at_a_time` (default true), `show_results_after_answer` (default true), `results_threshold` (small integer, default 3), `previous_survey_id` (nullable, self, null on delete), `version` (default 1), `opened_at`, `closed_at` (nullable), timestamps. Indexes `(team_id, status)`, `(team_id, closed_at)`, `(retro_id, template)`.

**`team_survey_questions`**: `team_survey_id` (cascade), `kind` (`scale`, `nps`, `single`, `multiple`, `text`), `label` (200), `short_label` (30, nullable: the short name of a health statement, "Vision"), `description` (500, nullable), `builtin` (nullable: a `HealthStatement` value, translated when read, as built-in statements are today), `match_key` (64, nullable: what "the same question" means across two surveys), `position`, `is_required` (default false), `allows_comment` (default false), `scale_max` (5 or 10 for a scale, null otherwise: the scale the question was asked on, never changed once it has an answer), `scale_min_label`, `scale_max_label` (60, nullable). Index `(team_survey_id, position)`.

**`team_survey_options`**: `team_survey_question_id` (cascade), `label` (100), `position`.

**`team_survey_respondents`**: `team_survey_id` (cascade), `user_id` (nullable, null on delete), `participant_id` (nullable, null on delete: the retro participant, for an attached survey), `guest_name` (50, nullable), `guest_secret_hash` (64, nullable), `completed_at` (nullable), timestamps. Unique `(team_survey_id, user_id)` and `(team_survey_id, participant_id)`.

**`team_survey_answers`**: `team_survey_question_id` (cascade), `team_survey_respondent_id` (cascade), `value` (small integer, nullable: scale and NPS, **exactly as given**, on the question's `scale_max`), `text` (nullable: free text, at most 500 characters), `comment` (500, nullable), timestamps. Unique `(team_survey_question_id, team_survey_respondent_id)`. The primary key is a random UUID (version 4), not a time-ordered one, so that an id never tells when an answer was written (as `SurveyTextAnswer` does today).

**`team_survey_answer_options`**: `team_survey_answer_id` (cascade), `team_survey_option_id` (cascade). Composite primary key on the pair. One row for a single choice, one per ticked option for a multiple choice.

`team_health_statements` is kept as it is: it is the content of the team's health-check template.

The two foreign keys added after table creation (`facilitator_respondent_id`, `previous_survey_id`) follow `2026_10_09_100000_create_whiteboard_tables.php`, which the portability work runs on the four engines.

### 6.2 Question kinds

| Kind | Answer | Validation | Result |
|---|---|---|---|
| `scale` | an integer from 1 to `scale_max` (5 for every question created from now on; 10 only on health checks imported with answers, §11.3) | integer in range | mean (one decimal), most frequent value, one bucket per value |
| `nps` | an integer from 0 to 10 | integer in range | score = round((promoters − detractors) ÷ answers × 100), promoters 9–10, passives 7–8, detractors 0–6; the three counts; one bucket per value |
| `single` | one option of the question | option belongs to the question | count per option; percentage of the answers |
| `multiple` | one or more options of the question | distinct options of the question, at least one | count per option; percentage of the respondents to the question |
| `text` | a text of at most 500 characters | non-empty | the texts, sorted by `Alphabetical::sort()` on the text then by id, never by time or author |

A scale or NPS question with `allows_comment` accepts an optional comment (the mockup's "Why this score? (optional)"). Comments are listed with the free-text answers, without their score.

Limits: 30 questions per survey; 2 to 10 options per choice question; a health check has 3 to 10 statements (the existing team rule).

### 6.3 Respondents and anonymity

A respondent row exists so that one person has one response and can change it; it is never a way to read who answered what.

- A team survey is anonymous: no payload, page, export or event tells which respondent gave which answer. The only people named are the facilitator and, on the presence channel, who is connected.
- Counts are public to whoever can open the survey: how many people have answered, how many have finished, out of how many.
- The health-check form names nobody (the mockup): it shows the viewer's own scores and, in the header button, how many have sent their answers out of how many participants. The MCP tool keeps, on a retro that is not anonymous, the names of who has sent their answers while the health check is open (as it names who answered today); on an anonymous retro, counts only. This is decision 11 of §17.
- A member answers as themselves (one respondent per user and survey, proved under concurrency). A guest of a standalone survey answers with a cookie scoped to the survey (`GuestCookie`, scope `survey`). A participant of a retro, a retro guest included, answers the health check attached to that retro from the retro, without joining anything else.
- **An attached survey lives in its retro.** Every route of the survey scope (§12) refuses it: its pages redirect to the retro, its JSON endpoints answer 404, its presence channel is refused. Its answers, closing, removal and results go through the retro's routes. Decision 10 of §17.

### 6.4 Results and when they are visible

`results` is built per viewer and withheld by the server, never by the front end.

| Viewer | Draft | Open | Closed |
|---|---|---|---|
| Editor | no results | yes | yes |
| Respondent who has finished | — | when `show_results_after_answer` | yes |
| Other member, respondent who has not finished | — | no | yes |
| Guest | — | as a respondent | as a respondent, while the cookie is valid and guest access is on |

On top of that, while fewer than `results_threshold` people have answered, nobody receives aggregates, editors included; the payload says so and carries the count. The threshold is 3 for a survey created from the dialog, and 0 for a health check attached to a retro and for imported health checks, which behave as today (§17 decision 4). No setting changes it in this spec.

An attached health check follows the retro: its results are shown to everyone once it is closed (by hand or by the completion of the retro, R3-7), never before.

A viewer without results receives the questions, their own answers and the counts of §6.3, nothing else.

### 6.5 Templates

Built in, defined in code, translated into the creator's language when the survey is created (as the retro templates are):

| Key | Content |
|---|---|
| blank | no question |
| `health_check` | one `scale` question per active statement of the team (`TeamHealthStatements::active`), `scale_max` 5, **required**, no comment, `builtin` and `match_key` set from the statement, no stored end labels: every reader receives the ends "Strongly disagree" and "Strongly agree" translated into their language. The questions are locked: the builder shows them read-only with a link to the statements page. |
| `team_pulse` | the five questions of the ScreenSurvey mockup: workload (scale 1–5, labelled ends, required), recommendation (NPS, required), ritual to keep (single, four options), what slowed you down (multiple, five options), a word for the team (text). |

A survey can also start from an earlier survey of the team ("Duplicate"): title, settings, questions, options and `match_key` are copied; answers are not; `previous_survey_id` points to the source. A health check duplicated takes the team's statements of today, on the scale of 5.

Team-customised statements stay where they are: `team_health_statements`, managed from the health-check page (add, reword a custom one, reorder, archive, restore; 3 to 10 active, 30 in all). The rule "changes apply to health checks that have not collected answers yet" is kept: when the statements change, every health-check survey of the team that is not closed and has no answer gets its questions rebuilt (on the scale of 5).

### 6.6 Comparison

Two surveys of the same team are compared question by question. Two questions are the same when their `match_key` is equal and their kind is equal, or, failing that, when their kind is equal and their labels are equal once trimmed and folded by `Alphabetical::key()` in PHP. For each pair the comparison gives both values and the difference: for a scale, both means **on the health scale of 5** (`HealthScale::normalise`, §11.9; a scale of 5 is unchanged, so an ordinary builder question reads as it was answered), and their difference; for NPS, the scores; for a choice, percentage points per option label both have; for a text, the number of answers. Questions without a match are listed apart. The default comparison is `previous_survey_id`; for a health check it is the team's previous closed health check, attached or standalone. The viewer can pick any other closed survey of the team, attached ones included (titled by their retro). A guest never receives anything of another survey.

### 6.7 The surveys inside a retro

They do not share the model. `surveys`, its five satellite tables, `SurveyKind`, the fourteen `retros.surveys.*` routes, their events on the retro channel and the front built by plan 18e and rework 3 are untouched — the behaviour of R3-7 included (a survey still open when the retro is completed counts as closed and shows its results to everyone) — except for their entry point, which becomes the "Quick poll" item of the "Add survey" menu. Reason: they carry things a team survey does not have (reactions, comment threads, "Show who answered", one card per question on the board); moving them is a rewrite of plan 8c for no change a user asked for. The two share the `SurveyQuestion` component and nothing on the server. This is decision 2 of §17.

## 7. Lifecycle and permissions

```
draft ──publish──▶ open ──close──▶ closed
  ▲                  │  ◀──reopen──
  └─back to draft────┘   (only while nobody has answered)
```

| Action | Who | Condition |
|---|---|---|
| Create | any member who can view the team (`createSurvey`, as the three other creation abilities) | — |
| Open the builder, change title, settings, questions | editor | questions and options only in `draft`; standalone survey |
| Publish | editor | at least one question |
| Back to draft | editor | `open`, no answer yet |
| Answer, change an answer, withdraw it, finish, reopen one's own response | respondent | `open`; standalone survey |
| Send the health-check answers ("Submit answers") | participant of the retro | attached health check `open`, retro open and unlocked, every statement scored, not sent before |
| Close, reopen | editor (standalone); the retro's facilitator (attached) | an attached survey cannot be reopened once its retro is completed |
| See results | §6.4 | — |
| Compare | a non-guest who sees the results | the other survey is closed and of the same team |
| Export CSV | editor | `closed`; standalone survey |
| Guest access on or off, new guest link | editor | a new link signs out the survey's guests, as on the other session types |
| Duplicate | any member who may create | — |
| Delete | editor (standalone); "Remove" by the retro's facilitator (attached) | — |
| See the survey in the team's list | members; a draft is listed for editors only | attached surveys are not listed there |

A draft is opened by editors only; anyone else gets 403. A guest link works only while the survey is `open` or `closed`, with guest access on.

On the participant page, "Finish" checks that every required question is answered and stamps `completed_at`. An answer is saved the moment it is given, so a respondent who leaves midway has lost nothing; every saved answer counts in its question's result. "Change my answers" clears `completed_at` while the survey is open.

In a retro, the health-check form keeps the scores in the page until "Submit answers"; one request writes every score and stamps `completed_at`; the form is then read-only ("Answers sent. Thank you."). A participant cannot change sent answers (the mockup's sent state; decision 9 of §17). A reload before sending loses the unsent scores.

Closing an attached survey happens by hand, or automatically when its retro is completed (next to `CloseOpenSurveys`).

## 8. Real time

Presence channel `presence-survey.{id}` (the name `SurveyQuestion/README.md` gives), for standalone surveys only, authorised in `BroadcastAuthorizationsController` for whoever `ResolveRespondent` accepts, with the same member data as the other session channels (`id`, `name`, `avatarUrl`, `isGuest`).

| Event | Name | Payload | Sent when |
|---|---|---|---|
| `TeamSurveyChanged` | `survey.changed` | `version`, `status` | title, settings, questions, status |
| `TeamSurveyResponsesChanged` | `survey.responses.changed` | `responses`, `completed` | an answer is saved or withdrawn, a response is finished or reopened |
| `TeamSurveyDeleted` | `survey.deleted` | none | the survey is deleted |

Redaction: events carry counts and a version, never an answer, an aggregate or a respondent id. A client that may see results refetches the snapshot (debounced one second) and the server applies §6.4 again; a client that may not sees the counter move. Events go to others only; the caller applies the HTTP response.

An attached health check speaks on the retro channel: `health.answered` with `respondents` (who have sent their answers) and `participants` (everyone who joined the retro, guests included), nothing else; and `settings.changed` when a health check is attached, removed, closed or reopened, which makes the board refetch its snapshot.

## 9. Screens

Each screen follows its mockup. "Omitted" means: not built, place left, row of the deviations table of the plan. Where no mockup exists the screen is designed from the neighbours named, and the plan puts that design to the owner before it is built (owner's rule of the fifth round).

### 9.1 "New session" dialog — type Poll

Mockup: ScreenSessionCreate (tile), SessionTypePicker. The fifth tile, in the mockup's order (Retro, Poker, Whiteboard, Poll, Icebreaker): iris, `chart-column`, "Poll", "Quick vote or health check" (tiles) / "Quick vote" (inline), "5–10 min". The form for this type has no mockup; it is designed from the retro and whiteboard variants of `components/teams/session-create/`: Name (prefilled), "Start from" (Blank, Health check with "n statements · scored 1 to 5", Team pulse with "5 questions", and "A previous survey" with a select of the team's surveys), and the settings row "Allow guests without an account" (`setting-row.tsx`). Footer: `SessionFormFooter` ("Cancel", "Create & open"). Creation makes a draft and opens the builder. The team page opens the dialog on this type for `?new=survey`, with `&template=health_check` preselecting the template.

States: default; a team without statements changes nothing (the six built-in statements apply); the tile is disabled, with its reason, for a viewer who may not create.

### 9.2 Builder — `surveys/edit`

Mockup: ScreenSurvey frame a. `AppLayout` (`active="sessions"`), breadcrumb team › Surveys › title, badge "Draft", "Saved n s ago", "Preview", "Publish".

- Title and a line "n questions".
- Question list: drag handle (dnd-kit, keyboard move with announcements), number, type, label, badges ("Required", the kind, "n options"). The selected question opens: type select, "Required" switch, Duplicate, Delete, label field, and by kind: the two end labels and a preview of the scale; the option rows (add, remove, 2 to 10); nothing more for NPS and text.
- "Add" bar with the five kinds.
- Settings panel (a Sheet below `lg`): "One question at a time", "Show results after answering", "Allow guests without an account".
- Every change is saved by itself (debounced); a failed save shows the error on its field and "Not saved".
- "Preview" opens the participant view in a dialog, fed by the builder's state, without saving an answer.

States: empty (no question: the "Add" bar and an empty state); selected question; dragging; saving, saved, not saved; locked template (health check: the list is read-only, with "Manage statements"); open or closed survey (the builder shows the questions read-only, the settings stay editable, "Back to draft" when allowed); 403 for a non-editor.

Omitted: the anonymity radio group, "Close" (date) and "Display threshold" of the settings panel, "about 2 minutes", "sent at the end of the retro of…", the "Other" option, "280 characters max".

### 9.3 Participant page — `surveys/show`

Mockup: ScreenSurvey frame b; MobileRituals (phone). The session shell of the other session types (`SessionShell`, kind `survey`, `chrome="logo"`): logo (leading to the team for a member, to nothing for a guest), the session title with "team · Survey" above it (the title alone for a guest), the badge "Anonymous answers", the "Synced" state, the viewer's avatar. No sidebar.

- One question at a time (setting on): "Question n of N", the segmented progress, the card with the kind badge, the question in the display font, its control, the optional comment, "Previous" / "Next" ("Finish" on the last), the keyboard hint, the privacy line. Digits answer a scale or NPS (when single-key shortcuts are on), arrows move inside a group, Enter goes on. On a phone: the card is full width, NPS on two rows with 2.75rem targets, the two buttons docked at the bottom.
- All on one page (setting off): the questions as `SurveyQuestion` cards and one "Finish" button.
- After "Finish": a thank-you state with "Change my answers", then the results when §6.4 allows them.

States: answering; a required question left empty ("An answer is required"); saving an answer failed (the answer stays on screen with "Not saved", retry); finished; finished with results; closed before the viewer answered ("This survey is closed", results); draft (403); lost connection (the reconnecting banner of the session shell, with the sentence "Your answers are saved as you give them; the counter is paused"); expired session; deleted survey.

Omitted: "~ 1 min left"; the category line above the question on the phone frame.

### 9.4 Results, live and closed — `surveys/results`

Mockup: ScreenSurvey frame c. `AppLayout`, breadcrumb, status badge ("Open" with the live response count, or "Closed"), "Export CSV" (closed, editor), "Share" (opens the Share dialog), and for an editor "Close" / "Reopen". A guest gets the session shell of §9.3 instead of `AppLayout`.

- Line "n answers out of m participants · anonymous · closed on …", where m counts the team's members plus the respondents who are not members (guests, people outside the team), so that the ratio never exceeds 100 % (the owner's participation rule).
- Tabs: Summary, Free-text answers, Compare.
- Summary: one card per question in a three-column grid (one column on a phone): scale (mean, most frequent, histogram with the end labels), NPS (score, stacked bar, three counts, distribution), single and multiple choice (result bars, "n · p%", the leading option full, the others at 45 %), text (the first six answers as coloured cards, "See the n answers").
- Free-text answers: every text answer and every comment, per question.

States: open and live (the counter and, for whoever may see them, the cards update without a reload); below the threshold ("Results appear from 3 answers. n so far."); no answer yet; closed; a member who may not see results yet (the counter and "Results will show when the survey is closed"); skeleton while the snapshot loads.

Omitted: keywords, "Send to whiteboard" (backlog, no place kept).

### 9.5 Compare

Mockup: the third tab of frame c ("Compare with sprint 41") and the "+11 vs sprint 41" badge of the NPS card. A select names the survey compared with (default of §6.6). Each matched question shows the two values and the signed difference, written, never colour alone; unmatched questions are listed under "Only in this survey" and "Only in the other". When the default comparison exists, the Summary cards carry the same badge as the mockup.

States: no other closed survey ("Nothing to compare with yet"); the other survey below its threshold (no values); questions that all differ.

### 9.6 Closed survey

The results page with the "Closed" badge, "Export CSV" and "Reopen" for an editor. The participant page of a closed survey shows the closed state of §9.3.

### 9.7 Team page, guest join, share

- Team page: a "Surveys" block inside the "Sessions" area, after the whiteboards, built as `team-whiteboards-section.tsx`: `SessionCard` kind survey with status, the number of answers and questions, and for an editor "Duplicate" and "Delete" in the card menu; `EmptyState` module survey ("No survey published yet", "Create a survey"). The sidebar entry "Sessions" reaches it by its anchor.
- Guest join: `surveys/join` on the shared `GuestJoinPage`, kind survey, with the session summary of B45 (title, facilitator, people who joined, live while open), the suggested random nickname (`PresentJoinSession::nickname`) and "Join the session".
- Share: the existing `ShareDialog`, kind survey: link, QR code, guest switch, "Create a new link" with its confirmation.

### 9.8 The health check in a retro

No mockup shows where it sits once the phase is gone; this is designed from `HealthCheck/README.md`, `SessionSettingsPopover/README.md` and the retro frames, and is decision 1 of §17.

- Creation: the "Health check" row of the dialog stays (the mockup has it); it attaches a health check when the retro is created.
- Settings popover: "Add survey" becomes the mockup's menu with two entries, "Health check" (badge "Built-in", "n statements") and "Quick poll" (today's dialog). Once attached the first entry reads "Health check added". "From a template…" is omitted.
- Header: a "Health check" button with "n/m" (sent answers out of participants) in the header actions, before Share; on a phone it is an entry of the header's one menu. It opens a dialog (a drawer on a phone) holding, while open, `HealthCheckForm` as the mockup draws it: the anonymous badge and sentence, the ends "1 · Strongly disagree" and "5 · Strongly agree", one 1-to-5 radio group per statement (dashed while unscored), "n of m answered" and "Submit answers", disabled until every statement is scored; once sent, read-only with "Answers sent. Thank you."; and `HealthCheckResults` once closed, with each statement's mean on 5, its move against the previous health check, the 1→5 distribution and the alert under 3. The facilitator finds "Close the health check", "Reopen" and "Remove". "Remove" deletes a health check nobody has answered; one that has answers is hidden and kept, and comes back with them when it is added again, as turning the setting off and on does today.
- It can be answered in every open phase unless the board is locked. It closes with the retro. The completed retro has no button: the session end shows the compact rows and "Details" (R3-5), on the scale of 5, with the reaction bar docked under the results as today (R3-2); the ROTI widget and its wording (R3-3) are untouched.
- A health check imported with answers while its retro was open (§11.3) keeps the scale it was answered on until it is closed; its form shows 1 to 10 with the same two ends. No other health check has a scale of 10.

### 9.9 Health-check page of a team

The page built by plan 18e (`teams/health-check`): statements manager and Mood trend. It gains a primary action "Start a health check" (opens the "New session" dialog on Poll with the template selected) and its trend counts the health checks run as surveys. The Mood trend's axis runs from 0 to 5 (an old score read halved can be under 1). The compact card of the team page reads ":count statements, scored 1–5, asked in every health check".

## 10. CSV export

`GET surveys/{teamSurvey}/export`, editors only, closed standalone surveys only (an export of an open survey taken after each answer would tell who answered what). `text/csv; charset=UTF-8` with a byte-order mark, streamed, file name `survey-<slug of the title>-<date>.csv`.

One row per respondent who gave at least one answer, sorted by the content of the row (never by time or by person, the rule text answers already follow), and named "Respondent 1" to "Respondent n" after the sort. Columns: "Respondent", then one per question in order ("Q1 · label"), followed by "Q1 · comment" when the question takes comments. Cells: the number as given for a scale or NPS, the option label for a single choice, the labels joined by " | " for a multiple choice, the text for a text. A cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return is prefixed with an apostrophe, so that a spreadsheet does not run it as a formula. Below the threshold the export is refused like the results.

## 11. The health-check migration

### 11.1 What exists

| Thing | Where |
|---|---|
| Team statements | `team_health_statements`, `TeamHealthStatements`, `ManageTeamHealthStatements`, four `teams.healthStatements.*` routes |
| Statements frozen per retro | `retro_health_statements`, `FreezeHealthStatements` (at creation, when the setting is turned on, and again for every unanswered open retro when the team's statements change) |
| Answers | `health_check_answers` (retro, participant, statement key, score 1 to 10), `HealthCheckAnswersController`, routes `retros.health-check.update|destroy`, event `health.answered` (progress per statement) |
| The phase | `RetroPhase::HealthCheck`, `Retro::phases()`, `retros.health_check_enabled`, guards naming the phase in `ColumnsController`, `ColumnOrdersController`, `RetroSettingsController`, `RetroPhase::hidingOthersCards()` |
| Back-end readers | `PresentHealthCheck` and `PresentHealthProgress` (board snapshot), `SummarizeHealthCheck` (results, B3 `previousAverage`, AI summary input, recap e-mail line, mail preview, MCP), `BuildHealthTrend` (results, MCP), `BuildTeamMoodTrend` (team page ROTI curve and health-check page Mood trend), `BuildResults`, `BuildSummaryInput`, `RetroResultsNotification`, `RetroRecapMail` (":score/10"), `MailPreviewsController`, MCP `retro.board.health.get` ("0–10" in its description), the prompts `team-health` and `analyze-retro`, the MCP server instructions (phase names), `TeamsController` and `TeamHealthChecksController` (statements); relations `Retro::healthStatements`, `Retro::healthCheckAnswers`, `Participant::healthCheckAnswers` |
| Front readers | `phase-health.tsx`, the reducer actions `health.progress` and `health.answer`, `skrum/health-check-form.tsx` (`healthCheckScale = 10`, ends "Awful" / "Great"), `skrum/health-check-results.tsx` and `health-check-compact.tsx` (`healthCheckResultsScale = 10`), `retro/results/health.tsx`, `health-radar.tsx` (rings to 10), `health-trend.tsx` ("/10"), `skrum/health-check-summary.tsx` ("scored 1–10"), `lib/teams/mood-adapter.ts` (`healthScale` 0 to 10), the creation switch, the settings toggle, the health-check page |

No REST API exposes health data; the MCP server is the only programmatic reader. No webhook or chat message carries it. The recap built by `BuildRetroRecap` leaves it out; the e-mail adds one line from `SummarizeHealthCheck`.

### 11.2 Principle

The data moves to the team-survey tables, each score as it was given, on the scale it was given on. The readers keep their signatures and their shapes (one key added: the 1→5 `distribution` of a statement, which the HealthCheck mockup draws) and are rewritten over the new tables. Their numbers are on the health scale of 5 (§11.9): for a health check answered on 1 to 5 they are the plain values; for one imported from 1 to 10 they are the old values read by the rule. `SummarizeHealthCheck::handle(Retro, ?Participant)`, `BuildHealthTrend::handle(Retro)`, `PresentHealthCheck::handle(Retro, Participant)` and `PresentHealthProgress::handle(Retro)` answer the same shapes, so that `BuildResults`, `BuildSummaryInput`, the recap, the MCP tool and the board need no change beyond the scale they name and what the removal of the phase imposes.

### 11.3 Data migration

One class, `App\Support\Surveys\ImportHealthChecks`, written with the standard query builder only (no model, no raw SQL), run by a migration (outside a transaction, `$withinTransaction = false`, so that a stopped run can be started again) and by the command `surveys:import-health-checks`. It is additive and idempotent: it never changes or deletes an old row, creates what is missing, and can be run again.

For each retro that has frozen statements and either has answers, or is not completed and has `health_check_enabled`:

| New row | From |
|---|---|
| one `team_surveys` row | `team_id` and `retro_id` of the retro; `title` = the retro's title; `template` = `health_check`; `status` = `closed` when the retro is completed, `open` when it is not, and `draft` when the retro's setting is off (a health check that was turned off keeps its answers today and shows them nowhere but on the board; as a draft it is hidden, and comes back with its answers if it is added again); `opened_at` = the first answer, else the retro's creation; `closed_at` = `completed_at`; `results_threshold` = 0; `one_question_at_a_time` = false; `show_results_after_answer` = false; guest access off; a fresh `guest_token` |
| one `team_survey_questions` row per frozen statement | `kind` scale; **`scale_max` 10 when the retro has at least one answer, 5 when it has none** (nobody has answered on 10, so the new scale applies); `is_required` true; `position`, `match_key` = the statement key, `builtin`, `label` = the custom text or the English text of the built-in, `short_label` = the custom label |
| one `team_survey_respondents` row per participant who answered, and one for the retro's facilitator | `participant_id`, the participant's `user_id` and `guest_name`; `completed_at` = their last answer **when they answered every frozen statement**, else null (an open retro's participant who answered part of it can still send the rest) |
| one `team_survey_answers` row per answer to a frozen statement | `value` = the score **as given**, the original timestamps |

Not copied: answers whose statement is not in the retro's frozen set. Every reader ignores them today (`BuildHealthTrend` filters on the frozen keys, `SummarizeHealthCheck` iterates over the frozen statements), so copying them would change scores. The import counts them and the old tables keep them.

A completed retro with the setting on and no answer gets nothing, as it has no result today.

The command `surveys:verify-health-import` compares, per retro, the number of answers and the sum of scores on frozen statements in the old and the new tables (raw values on both sides), and fails on a difference.

The migration is tested with the `tests/Upgrade` pattern: the schema migrated up to the migration before it, legacy rows written with `DB::table()`, the real migration run, the result read back; on the four engines.

### 11.4 The retro without the phase

- Phases: Icebreaker (optional) → Writing → Grouping → Voting → Discussing → Actions → ROTI → Completed. `RetroPhase::HealthCheck` is removed, with its place in `Retro::phases()`, `hidingOthersCards()`, the three guard lists and the settings toggle.
- A migration moves every retro still in `health_check` to `icebreaker` when its icebreaker is on, else to `writing`, after running the import again so that an answer written since the first run is not left behind. The icebreaker room is created on the first board snapshot, as `EnsureIcebreakerRoom` already allows. Tested with the `tests/Upgrade` pattern (the retro rows in `health_check` are written with `DB::table()`: the enum can no longer read them).
- `teams.retros.store` keeps the field `health_check_enabled`; it now attaches a health check (`AttachHealthCheck`). `retros.settings.update` no longer takes it. Three resources replace the toggle and the per-statement answers: `retros/{retro}/health-check` (attach; remove, which hides a health check that has answers and deletes one that has none), `retros/{retro}/health-check/closure` (close, reopen) and `retros/{retro}/health-check/submission` (send every score at once).
- `retros.health-check.update|destroy` and `HealthCheckAnswersController` are removed: a score is no longer saved on its own. The submission is allowed in every open phase, while the health check is open and the board unlocked, once per participant. The first submission still stamps `started_at` (B19).
- The board snapshot keeps `healthCheck` and gives `surveyId`, `isClosed`, `scale` (5, or 10 for an imported open one), `respondents` (who have sent), `participants` (everyone who joined), `hasSubmitted`, the statements (`key`, `label`, `text`, `isBuiltin`, `myScore`) and, once closed, `results` (the summary). `retro.healthCheckEnabled` goes; `phases` loses `health_check`.
- `retros.health_check_enabled` is no longer read or written. The column stays until the old tables are dropped.

### 11.5 Team card, management page, Mood trend

- The compact card of the team page reads ":count statements, scored 1–5, asked in every health check".
- The management page keeps the manager and the trend, and gains "Start a health check".
- `BuildTeamMoodTrend` keeps its point shape and adds `surveyId`; `retroId` becomes nullable. ROTI comes from completed retros as today (1 to 5). Mood comes from the team's closed health checks, on the health scale: an attached one is merged into its retro's point, a standalone one is a point of its own, titled and dated by the survey, linking to its results. Order and the limit of eight are unchanged.
- `BuildHealthTrend` lists the team's last six closed health checks, attached or not, on the health scale, with `delta` and `sameStatements` computed as today from the questions' `match_key`.

### 11.6 Session-end deltas, recap, AI summary

- `results.health.statements[].previousAverage` (B3): the average of the same statement in the team's previous closed health check, whatever its kind of session, on the health scale. Still withheld from a guest.
- The recap e-mail line reads "Health check: :score/5 (:respondents of :participants participants answered)", from `SummarizeHealthCheck`. The AI summary input keeps its shape and adds `scale: 5` to its health part so that the model reads the numbers right.

### 11.7 MCP

`retro.board.health.get` keeps its name and fields, on the health scale; its description says "1–5" where it said "0–10", and its completed payload adds `scale: 5` and each statement's `distribution`. Its `status` becomes `not_run` (no health check), `in_progress` (open: categories with the number of answers, who has sent their answers on a non-anonymous retro, the caller's own scores as given with the health check's `scale`) or `completed` (closed: averages, score, alignment, strengths, trend). `collected` disappears: a closed health check shows its results whether or not the retro is completed. Trend points gain `surveyId` and may have a null `boardId`. The server instructions and the two prompts drop the phase name; `team-health` says that health scores are on 1 to 5 and that boards of before the change were answered on 1 to 10 and are read halved. No survey tool is added.

### 11.8 Rollout order

Each step leaves every reader fed.

1. Tables and models of the team survey. Nothing reads them.
2. The import migration. Old tables stay the source; the copy is beside them.
3. The switch, merged as one unit: the retro's health check is attached and answered through the submission, the board presenters, summaries and trends read the new tables on the health scale, and the front's health components switch to 1 to 5 at the same time. No commit of the unit is deployed alone.
4. The Poll screens. Standalone health checks start to appear in the trend.
5. Removal of the phase: the second import run, the phase move, the enum case, the front. Then the old models, factories, relations and `FreezeHealthStatements` are deleted.
6. Not in this spec: a later release drops `retro_health_statements`, `health_check_answers` and `retros.health_check_enabled`, after `surveys:verify-health-import` has passed on the production data. `ImportHealthChecks` returns at once when the old tables are gone, so a fresh install keeps migrating.

A production upgrade runs steps 1 to 5 in one deploy: the migrations run, then the new code serves. Mood data is on screen before and after, on the health scale after.

### 11.9 The health scale and the old scores

The rule, used by every reader through one class, `App\Support\Surveys\HealthScale`:

- **Storage.** A score is stored as it was given, in `team_survey_answers.value`, and the scale it was given on is the question's `scale_max` (5 or 10). Nothing converts a stored value; the old tables keep theirs too. Normalising on read was chosen over converting at import because: the original value is never lost, not even after the old tables are dropped; a halved score is not an integer (7 → 3.5) and would need a decimal column, which the four engines return as different types; the scale belongs to the question, so no answer can disagree with its neighbours; one function, applied by every reader, keeps every number on screen consistent; and the verification command compares raw values on both sides.
- **The health scale** is 1 to 5 (`HealthScale::Max = 5`).
- **Normalising a mean.** A statement's mean on its own scale, unrounded, is brought to the health scale by `normalise(mean, scaleMax) = mean × 5 ÷ scaleMax`: identity on a scale of 5, **halving** on a scale of 10 (the owner's word). It is then rounded once to one decimal. A statement average, a `previousAverage`, a `topStrength` or `growthArea` average are such values.
- **The score** of a health check is the mean of its statements' normalised averages (each already rounded to one decimal), rounded to one decimal: `SummarizeHealthCheck::scoreOf`, unchanged. Trend scores, mood points and deltas (`round(score − previous score, 1)`) are computed from these scores, so a trend that mixes old and new health checks compares like with like.
- **The distribution** of a statement has five buckets; an answer goes to the bucket `ceil(value × 5 ÷ scaleMax)`: on a scale of 10, 1–2 → 1, 3–4 → 2, 5–6 → 3, 7–8 → 4, 9–10 → 5.
- **Consensus** is computed on the answers' own scale, with the largest spread of that scale, `(scaleMax − 1) ÷ 2` (4.5 on 10, as today; 2 on 5), so the consensus and the alignment of an old health check do not change.
- **Bands** of the assessment are read on the health scale: excellent from 4, good from 3, needs attention from 2, critical below (today's 8, 6, 4 halved). The alert of a statement is under 3 (the mockup's threshold, 60 % of the scale as today).
- **A single score** (`myScore`, a CSV cell) is never normalised: it is shown on the scale it was given on, with that scale.

Consequences, by hand, for an old retro whose statements averaged 7.0, 8.0 and 4.0 on 10 (score 6.3 today): the statements read 3.5, 4.0 and 2.0, the score 3.2, the band "good" as before, the consensus unchanged. A trend point that read 5.0 reads 2.5, and the delta from it to the retro above is 0.7 (today 1.3).

The halving keeps the owner's word and an old 1 reads 0.5, under the floor of the new scale. The alternative that keeps both ends (1 → 1, 10 → 5: `1 + (value − 1) × 4 ÷ 9`) is decision 12 of §17; it changes `HealthScale::normalise` and the bucket rule only.

## 12. Routes, policies, validation

Team scope (prefix `w/{workspace}`, `can:view,workspace`, scoped bindings):

| Route | Name | Controller | Authorisation |
|---|---|---|---|
| `POST teams/{team}/surveys` | `teams.surveys.store` | `TeamSurveys\TeamSurveysController@store` | `createSurvey` on the team (new ability of `TeamPolicy`, equal to `view`) |
| `POST teams/{team}/health-statements` and the four others | unchanged | unchanged | unchanged |

Survey scope (prefix `surveys/{teamSurvey}`, UUID, middleware `ResolveSurveyRespondent`, scoped bindings). Every route of this scope refuses an attached survey: `show` and `results.show` redirect to the retro, the others answer 404.

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

Outside any scope: `GET|POST surveys/join/{guestToken}` (`surveys.join.show|store`, `TeamSurveyJoinsController`, the store throttled 10 per minute; a standalone survey only).

Retro scope, added: `POST|DELETE retros/{retro}/health-check` (`retros.healthCheck.store|destroy`, `Retros\RetroHealthChecksController`, facilitator, open retro), `PUT|DELETE retros/{retro}/health-check/closure` (`retros.healthCheck.closure.update|destroy`, `Retros\RetroHealthCheckClosuresController`, facilitator) and `POST retros/{retro}/health-check/submission` (`retros.healthCheck.submission.store`, `Retros\RetroHealthCheckSubmissionsController`, participant, body `scores`: one integer per statement key, every statement, each from 1 to the health check's scale). Removed: `retros.health-check.update|destroy`.

Validation, in Form Requests with array rules: `title` required, at most 120; `template` one of the enum; `source_survey_id` a survey of the same team, exclusive with `template`; settings are booleans; a question: `kind` of the enum, `label` required at most 200, `description` at most 500, `is_required` boolean, `scale_min_label` and `scale_max_label` at most 60 and only for a scale, `options` required for a choice (2 to 10, each 1 to 100 characters) and prohibited otherwise; an order: every question id of the survey exactly once. An answer is validated against the question read under the survey's lock, so that a concurrent edit cannot slip a mismatched answer in: a field that does not belong to the kind is prohibited. A health-check submission is validated against the questions read under the retro's and the survey's locks: a missing, unknown or out-of-range key is refused, and a second submission of the same participant is refused.

Transactions lock the aggregate root first: the survey row on survey routes; the retro row, then the survey row, on retro routes; the team row, then each survey row, when the team's statements change. No path locks a survey and then its retro or team.

## 13. Backlog

Anonymity modes; close date and automatic close; a threshold setting; saved survey templates and "From a template…"; "Send to whiteboard"; keywords; the "Other" option; per-question length; MCP survey tools and a token scope; a survey source for action items (roadmap AI, D-19); hand-over; scheduling; a live list of surveys on the team page; moving the retro surveys onto the team-survey tables; changing one's health-check answers after sending them (decision 9).

## 14. Testing

- Every test touching the database runs on PostgreSQL, SQLite, MariaDB and MySQL: `bin/test-db <engine> -- <path>` for each task's files, and the four suites at the end.
- Pest feature tests for every route, guard and transition; the redaction matrix of §6.4 per viewer and status; the threshold; the summaries per kind with hand-computed values; comparison matching, the normalised scale pair included; the CSV, including formula-leading cells and the order; channel authorisation for a member, a survey guest, an outsider, and the refusal of an attached survey.
- Races in `tests/Concurrency` with `Race`, on PostgreSQL, MariaDB, MySQL and a SQLite file: two first visits of one member make one respondent; the same answer saved twice at once makes one row; answers arriving while the survey closes are each either saved before the close or refused, never saved after it; the thirty-question limit holds under concurrent adds; a double "Submit answers" writes one set of scores; two "Add survey → Health check" at once attach one health check.
- Unit tests for `HealthScale` (halving, buckets, spread, bands, identity on 5).
- Import tests on legacy rows written with `DB::table()`, in the `tests/Upgrade` pattern for the two migrations (import, phase move) and as feature tests for the class and its commands: a team with custom and archived statements; a completed anonymous retro with a guest, a former member, partial answers and an answer to a statement outside the frozen set; an earlier completed retro (for deltas and trend); an open retro in the health-check phase with answers; a completed retro with the setting on and no answer; a retro with answers whose setting was turned off; an open retro without answers (its questions on 5). Expected values are written by hand, on both scales (raw values kept, readers halved). The import is run twice to prove idempotence.
- The existing health tests (`HealthCheckTest`, `HealthCheckSummaryTest`, `HealthTrendTest`, `HealthStatementFreezeTest`, `HealthStatementModelsTest`, `TeamMoodTrendTest`, `TeamHealthStatementsTest`, `InsightsHealthRotiTest`, the health parts of `ResultsTest`, `SummaryInputTest`, `RetroStartTest`, `ResultsEmailTest`, `MailMockupTest`) are kept: their fixtures move to the new tables through test helpers; their expected numbers move to the health scale, each change listed in the plan with its hand computation; the ones about the phase or about per-score saving are rewritten for the attached health check and its submission. None is deleted.
- Vitest for the reducers, the adapters, the hooks and the changes to `SurveyQuestion` and the health-check components.
- No browser walkthrough is written or run; the existing walkthrough files that name the health-check phase are left as they are and listed in the report.
- Captures, in light, at 1440, in French (`VISUAL_ONLY=light-1440-fr`), of the five new screens and the retro with the health-check dialog, through the visual harness of `tests/Browser/Visual`, compared with the mockup; the overflow check of the harness must pass.

## 15. Acceptance criteria

1. The "New session" dialog offers five types in the order Retro, Poker, Whiteboard, Poll, Icebreaker. Poll creates a draft team survey through `teams.surveys.store` and opens its builder. A user who cannot view the team gets 403.
2. A survey created from "Health check" has one required scale question from 1 to 5 per active statement of the team, in the team's order, with the built-in ones translated for each reader and the ends "Strongly disagree" / "Strongly agree" in the reader's language; its questions cannot be edited, added or removed. A survey created from "Team pulse" has the five questions of the mockup. A duplicate copies questions, options and settings, no answer, and points to its source.
3. In the builder an editor adds each of the five kinds, edits, reorders (pointer and keyboard), duplicates and deletes questions, marks one required, and every change is saved without a save button. A choice question refuses fewer than 2 or more than 10 options; a survey refuses a thirty-first question, also when the additions arrive at the same moment. A non-editor gets 403 on the builder and on every write.
4. Publish is refused without a question. Questions cannot change once the survey is open. "Back to draft" works until the first answer and is refused after.
5. A member and a guest holding the link can each answer a standalone survey; an outsider, a guest when guest access is off, and a guest whose link was replaced cannot. One person has one response, also when two first visits arrive at once. Every survey-scope route refuses an attached survey.
6. Each kind accepts its values and refuses the others (a scale answer above its maximum, an option of another question, an empty text, a comment on a question that takes none). "Finish" is refused while a required question is unanswered and names it. Answers are refused on a draft and on a closed survey; an answer arriving while the survey closes is either saved before the close or refused.
7. A viewer without the right of §6.4 receives no count per option, no mean, no score and no text of others, in the page props, the snapshot and every event. An editor receives them while the survey is open. A respondent receives them after finishing when the setting is on, and everyone who can open the survey once it is closed.
8. With a threshold of 3, nobody receives aggregates before the third respondent; the payload carries the number of answers. A health check attached to a retro shows its results from the first answer once closed.
9. No payload, export or event links an answer to a respondent. Text answers come sorted by text. The ids of answers are not time-ordered.
10. For the scale answers 2, 3, 3, 4, 4, 4, 5, 5, 4 the result gives the mean 3.8 and the most frequent value 4. For the NPS answers 5, 6, 7, 8, 8, 9, 9, 10, 10 it gives 2 detractors, 3 passives, 4 promoters and the score 22. A multiple choice ticked by 6 of 9 respondents reads "6 · 67%".
11. An answer given in one browser moves the counter in another without a reload; a viewer who may see results sees the cards change; closing the survey switches every open participant page to its closed state. (Proved by Vitest with a mocked channel and by feature tests of the events; no browser walkthrough.)
12. The channel `presence-survey.{id}` is refused to an unauthenticated socket, to an outsider, to a guest of another survey and for an attached survey.
13. Compare pairs the questions of two surveys of the same team by `match_key`, then by kind and label, and gives each difference, a scale of 10 against a scale of 5 compared on 5; a question present in one only is listed apart; a survey of another team, an open survey and any survey for a guest are refused.
14. The CSV is served to an editor of a closed standalone survey only. It holds one row per respondent in an order that does not depend on when or by whom the answers were given, no name, one column per question, values as given, and a cell that begins with `=`, `+`, `-` or `@` is neutralised.
15. Deleting a survey removes its questions, respondents and answers, and tells the open pages.
16. After the import every score is in the new tables with the value it was given and its scale; for every retro of the fixtures, `SummarizeHealthCheck` returns the statements, averages, counts, consensus, score, participation, strengths and assessment computed by §11.9 from the old values (written by hand in the plan: the old values halved per statement, consensus unchanged); `BuildHealthTrend` and `BuildTeamMoodTrend` return the same points as before on the health scale; the recap e-mail carries ":score/5"; `retro.board.health.get` returns the completed payload on the health scale. Running the import a second time changes nothing.
17. The import leaves the old tables as they were, and `surveys:verify-health-import` passes; it fails when a copied answer is altered. The migration is proved by an Upgrade test on legacy rows on the four engines.
18. A retro in the `health_check` phase when the migration runs is in `icebreaker` (icebreaker on) or `writing` afterwards, its health check is open, and its answers are there with their scale of 10.
19. A retro runs Icebreaker (optional) → Writing → Grouping → Voting → Discussing → Actions → ROTI → Completed; no payload, page or MCP answer names a health-check phase.
20. A retro created with "Health check" on has an attached health check with the team's active statements on 1 to 5. A participant, a retro guest included, scores every statement in the header dialog of any open phase and sends them with "Submit answers", which is disabled until every statement is scored; after sending, the form is read-only and a second submission is refused, also when two arrive at once. Sending is refused on a locked board and once the health check is closed. The facilitator closes it, which shows the results to everyone, and reopens it. Removing it deletes it when it has no answer, and otherwise hides it with its answers, which come back when it is added again. Completing the retro closes it. The form names nobody.
21. Changing the team's statements rebuilds the questions of every health check of the team that is not closed and has no answer, attached or not, on the scale of 5, and of no other.
22. The Mood trend of the health-check page shows the points of before on the health scale, and a health check run as a survey adds a point, titled by the survey and linking to its results. The team page still shows the ROTI curve.
23. On a completed retro each statement carries `previousAverage` from the team's previous closed health check, attached or standalone, on the health scale; a guest receives none. The session end shows the compact rows on 5 and "Details" with the distribution 1→5.
24. The fourteen `retros.surveys.*` routes behave as before, R3-7 included.
25. The team page lists the team's standalone surveys with their status and counts; a draft is listed for its editors only; the health-check page offers "Start a health check".
26. Every new string exists in the four languages, informal in French, Spanish and German (`InformalRegisterTest` passes); the five new screens and the retro with the health-check dialog are captured in light at 1440 in French without horizontal overflow, and each is compared with its mockup, the differences being rows of the plan's deviations table or fixed.
27. The unit, feature, upgrade and arch suites pass on PostgreSQL, SQLite, MariaDB and MySQL through `bin/test-db`, and the concurrency suite on PostgreSQL, MariaDB, MySQL and a SQLite file. `tests/Arch/DatabasePortabilityTest.php` passes: no raw query, no driver branch, no write that skips model events.

## 16. Risks

- **The switch of the health readers.** Seven actions, the front's health components and about fourteen test files move at once. The readers keep their shapes and a hand-computed parity test proves "old value, read by §11.9"; the unit of step 3 of §11.8 must not be split across deploys.
- **Numbers that change on screen.** Every past health score is shown halved after the deploy (6.3 becomes 3.2). This is the owner's decision; the release note says it, the MCP prompt says it, and the raw values stay in the database.
- **Scores that change silently.** Answers outside the frozen set are ignored today; an import that copied them would move scores. The import skips them and the verification command proves the rest.
- **Two things called survey.** `Survey` (in a retro) and `TeamSurvey`. The vocabulary of §5 is the guard; a later plan may merge them (§13).
- **Privacy by timing.** An editor watching live results sees which bar moves when someone answers. The threshold of 3 covers the first answers of a standalone survey; it does not exist for a health check in a retro, whose results show only once it is closed. The CSV is closed-only for the same reason.
- **Base branch.** This was read on `plan-db-portability` while its last tasks may still land. The plan starts from that branch once its concurrency harness and `docs/database.md` are merged, and re-reads each file.
- **A health check with no place on the board.** The header button of §9.8 has no mockup. It is put to the owner before it is built.
- **Concurrency on SQLite.** One writer at a time: the races of §14 prove the invariants on a SQLite file as on the server engines; a write that waits past five seconds answers 503 and writes nothing (`docs/database.md`).
- **Size.** A new session type end to end, a builder, three other screens and a data migration. The lanes of the plan keep the migration apart from the screens.

## 17. Decisions for the owner

The body above is written on the option marked **taken**. The plan carries a table of the tasks that change with another answer.

**1. Can a health check still be answered inside a retro?** — **taken: B.**
- A. No. It is run only as a Poll. The "Health check" row leaves the retro's creation dialog; a retro's results, recap line and MCP answer show health for the retros of before only.
- B. Yes, attached to the retro, without a phase: the "Health check" row and the "Add survey → Health check" entry attach it; participants answer from a header button in any open phase; it closes with the retro. It keeps the one-link flow teams have today, and the health section of the results, the recap line and the session-end deltas stay alive for new retros. Cost: about five tasks, and a header button with no mockup.
- C. Attached, and shown as a step of its own between Actions and ROTI, as the note of the SessionSettingsPopover mockup says. This is a phase again, which the owner's third round rules out.

**2. Do the surveys inside a retro change?** — **taken: A.**
- A. No: one question, three kinds, their own tables, as plan 18e and rework 3 leave them; "Quick poll" in the menu. No regression risk; nothing a user asked for is missing.
- B. They move onto the team-survey tables now and gain scale, NPS and several questions. About ten more tasks.
- C. They are removed; a retro attaches team surveys only. Loses reactions, comments and "Show who answered" on a survey.

**3. The scale of the health check.** — **decided by the owner (seventh round, D-102): 1 to 5, the mockup's form with "Submit answers"; existing 1-to-10 answers stay comparable, read halved.** The exact rule is §11.9: scores stored as given with their scale, normalised on read by `HealthScale`, every reader on the health scale of 5. The options of the first draft (A: keep 1 to 10; C: the team chooses) are withdrawn.

**4. Results before three answers.** — **taken: B.**
- A. No minimum anywhere, as today.
- B. A minimum of 3 on a survey created from the dialog (what the mockup states in three places); none on a health check attached to a retro and on imported ones. Faithful where the mockup speaks, unchanged where a small team's retro would otherwise lose its health results. The HealthCheck mockup's "fewer than 3 respondents" state stays a deviation (P19-17 of the plan).
- C. A minimum of 3 everywhere. A two-person retro no longer sees its health check; old retros with one or two respondents go blank.

**5. Anonymity.** — **taken: A.** A team survey is always anonymous. B (one switch per survey) and C (the three modes now) stay in the backlog.

**6. Templates.** — **taken: A.** Built in only (Blank, Health check, Team pulse) plus "start from a previous survey". B (saved templates per workspace, about six more tasks) and C (Health check and Blank only) are not built.

**7. The old health tables.** — **taken: A.** Kept unread for one release, dropped by a later plan once the verification command has passed on production data. B (dropped at the end of this plan) leaves no way back.

**8. What the CSV holds.** — **taken: A.** One row per respondent, unnamed, in an order that tells nothing, available once the survey is closed. B (aggregates only) and C (rows at any time) are not built.

New with revision v2:

**9. Can a participant change health-check answers once sent?**
- A. No: the form is read-only once sent, as the mockup's sent state; a wrong score stays. **Taken.** Faithful to the mockup; one submission per person is simple to prove under concurrency.
- B. Yes, while the health check is open: a "Change my answers" link reopens the form and the next submission replaces the scores. One endpoint more (`DELETE …/submission`) and a state the mockup does not draw.

**10. Where does an attached health check live?**
- A. In its retro only: the survey pages, the survey channel and the CSV refuse it; it is answered, closed and read from the retro. **Taken.** One answering flow per health check (the submission of D-102), no scale of 10 ever on the survey pages, no second channel to authorise for retro guests.
- B. Also on the survey pages, as the first draft had it (a retro guest could open it by URL and answer question by question). Two flows with two meanings of "answered" for one health check.

**11. Who is named while a health check is open?**
- A. Nobody in the interface (the mockup's form has no names; D-102 listed them as a deviation): counts only, "n/m" on the button. The MCP tool keeps naming who has sent their answers on a non-anonymous retro, as it names who answered today. **Taken.**
- B. The facilitator also sees, in the dialog, who has sent their answers on a non-anonymous retro (a list of avatars under the progress). A place the mockup does not draw.
- C. Nobody anywhere, the MCP tool included.

**12. How exactly are old scores brought to 1 to 5?**
- A. Halved: `value ÷ 2` (the owner's word, "halved"). An old 1 reads 0.5, under the floor of the new scale; an old 10 reads 5; the Mood axis runs from 0 to 5. **Taken.**
- B. Mapped end to end: `1 + (value − 1) × 4 ÷ 9`, so that 1 stays 1 and 10 becomes 5. Truer at the bottom of the scale; an old 7.4 reads 3.8 instead of 3.7. Changes `HealthScale::normalise`, the bucket rule and the hand-computed literals of the parity tests only.

Not decisions, but to confirm with the pre-build deviations: the English label is "Poll" on the tile, as the SessionTypePicker mockup writes it, and "Survey" everywhere else (the component of plan 18c says "Survey" on the tile today); the form of the Poll type in the dialog and the health-check button of the retro header have no mockup and are designed from their neighbours.

## 18. Not determined by reading

1. Whether the portability plan's tasks after its concurrency harness change any file this plan touches (`tests/Pest.php`, `routes/web.php`, the health actions). The plan re-reads them.
2. Whether `SurveyQuestion` renders the NPS segments and the delta badge as the mockup draws them without a change to its existing props; the plan adds them as new optional props.
3. How many production retros hold answers outside their frozen statement set, and whether any retro has frozen statements but an inconsistent key (a deleted custom statement).
4. Whether `settings.changed` is enough for every open board to pick up an attached health check (it refetches the snapshot in `hooks/use-retro-board.ts` today).
5. Whether the team mood trend was meant to count a completed retro whose health check had been turned off but still held answers: `BuildTeamMoodTrend` does today (it does not read the setting), `BuildHealthTrend` does not. After the migration neither does.
6. The size of `tests/Pest.php` conflicts: every lane adds helpers to it.
7. What the old readers return for the migration fixtures: the expected values of the parity tests were computed by hand from the code as read; the plan checks them against the old code before it rewrites the readers, then applies §11.9 to them.
8. Whether the visual harness can reach the retro health-check dialog and the survey pages without a live Reverb server (the existing retro captures do; the plan follows them).
</content>
</invoke>
