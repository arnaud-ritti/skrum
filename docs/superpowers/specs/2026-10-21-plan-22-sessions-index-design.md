# Skrum — Sessions index, advanced creation options, ticket details in the poker room — Design

Date: 2026-10-03 (draft for plan 22; revised the same day with the owner's answers to §15, then with the owner's answers to the pre-build deviations); built 2026-10-03
Status: **built** (plan 22, branch `plan-22-sessions-index`; the differences found while building are folded in below and in §18). Was: approved for execution. §15 answered by the owner on 2026-10-03 (decisions 3 and 6 differ from the recommendation; the body follows the answers). The pre-build deviations of the plan (P22-01 to P22-15) answered by the owner on 2026-10-03: all approved as listed, P22-14 obsolete (§17). §16.2 and §16.8 ruled on the owner's behalf from those answers (§16). Plan 22 runs after plans 20, 21, 26, 27 and 29 are merged into `roadmap`, and before plan 23.
Parent spec: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` (§5 rules, rule 13 "rewrite first, features after", §6.4 session creation, §10 backlog).
Owner's word: `docs/superpowers/research/front-rewrite/owner-answers-2026-10-02.md` — first round (1-D2 one "New session" trigger, 1-D4 five types, X5 one timer list 1/3/5/10, 3-D8 the poker dock), third round (point 2 "start of a retro = first activity", points 3/4 "poker keeps Custom… beside 1/3/5/10", the list of features to specify), fourth round (D-37 to D-39 deck tiles, D-41 AI summary and anonymous votes live in the session settings, D-44 server defaults), fifth round (D-70 poker settings popover, D-71 import and source, D-72 ticket key and "across n games", roadmap change: **scheduling is backlog**), sixth round (informal register; a guest counts as a participant).
Roadmap rows: SE-1, SE-3 and PK-1 of `docs/superpowers/research/front-rewrite/feature-roadmap.md`. SE-2 (scheduling: "Schedule…", a start time, "starts in 5 min") is **backlog** by the owner's word and is not specified here.
Deviation rows cleared: D-06 (the Sessions page behind the dialog; "Schedule…" stays a deviation, backlog), D-07 (except the "ROTI at the end" switch, backlog), D-16 (ticket type, labels, acceptance criteria, description; the spectator eye and the Share roles stay backlog) — `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, table "Deviations from the mockup".
Mockups (binding for presentation): `docs/design-system/components/ScreenSessionCreate` (frames a–d: the Sessions page behind the dialog, the retro and poker variants), `ScreenPokerBefore` (the story card), `ScreenDashboard` (the session list on the team dashboard is TM-2, plan 23: only its row content is read here), `SessionTypePicker` (kind colours), `Pagination` ("Load more" for chronological lists), `EmptyState`, `MobileDashboard` (tab bar entry "Sessions").
Database rules: `docs/database.md`, "Rules for database code" 1 to 12.

What was read: the code of `main` at `18d3637e` (plans 18, database portability and 19 merged). Nothing was run. Every "Back end" line of the roadmap for these rows was checked against the code; §1 lists what the roadmap had wrong.

## 1. Problem statement

The sidebar's "Sessions" entry leads to an anchor of the team page (`${teamUrl}#sessions` in `hooks/use-sidebar-model.ts`); no page lists a team's retros, poker games, whiteboards, polls and icebreaker rooms together, and the mockup's Sessions page (tabs Upcoming / Live / Finished, one row per session) does not exist. A cross-type query exists for the command palette only (`App\Actions\Search\ListRecentSessions`: five most recent per kind, no polls, no paging).

The "New session" dialog omits five settings the mockup draws (D-07): "Max per card" and "Timer per phase" for a retro; "Timer per task", "Change vote after reveal" and "Write estimates to Jira" for poker; and the poker "Import from Jira" tab. The import exists inside a game only (`poker.imports.*`, game-scoped, a player required).

The poker story card shows the ticket key, its link, its status and its description, but not the ticket type, the labels and the acceptance criteria the mockup draws (D-16).

Corrections to the roadmap's "Back end" lines, from the code:

- SE-3: "the import exists inside a game": true, and every route of it is game-scoped (`PokerImportPreviewsController` needs a `PokerPlayer`); the creation needs team-scoped browse routes. "The write-back field is a team integration setting": true (`storyPointFieldOverride` in `TeamIntegration::settings`, written by `UpdateTeamIntegration`); write-back is also always on for every imported task today (`RequestEstimateSync::afterEstimateChange`), so "Write estimates to Jira" is a new per-game switch as well as a field.
- SE-3: "a revote flag on a poker game": a revealed round refuses every vote today (`PokerGuard::openRound`); the existing "Re-vote" button of the dock starts a new round (3-D8). "Change vote after reveal" is a different thing: the revealed round stays open to card changes until the estimate is saved.
- SE-3: "per-phase and per-task durations": the retro has one timer (`retros.timer_ends_at`), a poker round has one (`poker_rounds.timer_ends_at`, its expiry reveals only when auto reveal is on: `AutoRevealPokerRound`). Nothing starts a timer by itself today.
- PK-1: "a task stores its title, key and URL": it also stores the description (imported, refreshed, rendered as safe Markdown in `StoryCard`), the assignee, the source estimate and the status. Missing: type, labels, acceptance criteria. Jira has no standard acceptance-criteria field; by the owner's answer (decision 6, B) the criteria are read from a section of the description (§6.5).
- SE-1: `retros.started_at` (plan 18e, 2-D6) was added without a backfill: retros created before 2026-10-15 have no start time even when they ran. The index cannot use it alone (§6.1).

## 2. Goals

1. A team member opens the team's Sessions page from the sidebar (and the phone's tab bar) and sees every session of the team — retros, poker games, whiteboards, polls, icebreaker rooms — in three tabs, Upcoming, Live and Finished, newest activity first, with "Load more"; "New session" on that page opens the same dialog as the team page.
2. The retro form of the dialog sets "Timer per phase" ("Max per card" is plan 21's row, RT-3); in a phase with a duration, the facilitator's timer control offers that duration first, one click to start. Nothing starts by itself (owner, decision 3).
3. The poker form of the dialog sets "Timer per task" (a round timer that starts by itself), "Change vote after reveal", and "Write estimates to Jira" (on or off, and the field); its Tasks block gains "Import from Jira" (from any tracker the team has connected), choosing tickets before the game exists.
4. Every option set in the dialog stays editable inside the session (the mockup: "les réglages restent modifiables dans la session"): the retro settings popover and the poker room settings popover (D-70) gain the same rows.
5. The poker story card shows the ticket's type and labels beside its key (imported tasks, kept up to date by import, refresh and status sync), and, under the description, the description's section headed "Acceptance criteria", shown apart and no longer repeated in the description (any task, owner, decision 6).
6. Database code is Eloquent and the standard query builder only and runs unchanged on PostgreSQL, MySQL, MariaDB and SQLite.

## 3. Non-goals (backlog)

- **Scheduling (SE-2)**, by the owner's word: no "Schedule…" button, no start time, no "starts in 5 min" notification, no "next retro". The Upcoming tab is defined without it (§6.1, decision 1); no place is reserved for "Schedule…" in the dialog footer.
- The "ROTI at the end" switch of the retro form (ROTI is always a phase, parent spec §6.4).
- The invitation link inside the dialog (D-08): not in SE-1 to SE-3.
- The team dashboard's recent sessions table (TM-2) and the team's next retro (TM-1): plan 23. Plan 23 reuses the query of §6.1 (`ListTeamSessions`).
- The spectator eye in presence, roles and expiry in the Share dialog (rest of D-16), the poker CSV export and history filters: backlog.
- A workspace-wide sessions list, filters and search on the Sessions page; live updates of the page (§8).
- Changing the command palette's recent sessions (`ListRecentSessions`), which keeps its own rule.
- MCP tools for the new options.
- Writing acceptance criteria, labels or type back to a tracker.
- Reading acceptance criteria from a dedicated tracker field, and any per-connection setting for them (decision 6, option A, not chosen).
- Starting a retro timer by itself at a phase change (decision 3, options A and C, not chosen).

## 4. Decisions already taken

| Topic | Decision | Source |
|---|---|---|
| Presentation | The mockup wins; an element with no data is omitted, listed, and its place left | parent §5 rule 13 |
| One trigger | One "New session" trigger, type chosen in the dialog; five types | owner 1-D2, 1-D4 |
| Timer durations | One list 1, 3, 5, 10 minutes on every screen; poker keeps "Custom…" beside it on its timer control | owner X5, third round 3/4 |
| Start of a retro | Its first activity (first card, health answer, timer start or phase change): `MarkRetroStarted` | owner, third round point 2 |
| Settings after creation | "Automatic AI summary" and "Anonymous votes" are set in the session settings only; server defaults at creation | owner D-41, D-44 |
| Poker settings | A popover anchored to a header button, like the retro's | owner D-70 |
| Import UI | Search field + select, done check, tracker block | owner D-71 |
| Scheduling | Backlog | owner, roadmap change of 2026-10-02 |
| §15 of this spec | Answered: 1 A, 2 A, 3 **B**, 4 A, 5 A, 6 **B**, 7 A, 8 A | owner, 2026-10-03 |
| Register | Informal: French "tu", Spanish "tú", German "du" | owner, sixth round |
| Database | Eloquent only, four engines, `docs/database.md` rules | owner |
| Verification engines | Per plan: PostgreSQL only (feature, unit, arch, concurrency). The four-engine matrix (PostgreSQL, SQLite, MariaDB, MySQL) runs once, after the last merge of the roadmap into `roadmap` (plans 24 and 25), not in this plan. The portability rules still bind every line | owner, 2026-10-03 ("Lance les 4 bases seulement à la fin") |
| Pre-build deviations | P22-01 to P22-15 approved as listed; P22-14 obsolete (§17) | owner, 2026-10-03 |
| Tests | Unit, feature, arch and concurrency tests written and run; no browser walkthrough; captures light, 1440, French | owner, working rules |

## 5. Rules

The front rules of the parent spec §5 apply to every front file; the back-end conventions of its §9.2 apply (actions in `app/Actions/<Domain>`, one controller per resource with CRUD names, `Gate::authorize` at team level, guards on live JSON endpoints, events sent to others only, UUID keys, `up`-only migrations). `docs/database.md` rules 1 to 12 apply to every query, migration and test: in particular no raw SQL, no driver test, an explicit tie-breaker on every sort, lists read by people sorted in PHP, transactions locking the aggregate root first, JSON columns without a database default and never compared by key order.

Vocabulary:

| Term | Meaning |
|---|---|
| session | A retro, a poker game, a whiteboard, a standalone team survey ("Poll"), or a standalone icebreaker room (`game_rooms.retro_id` null) of one team |
| state | Upcoming, Live or Finished, computed per kind by §6.1 |
| phase durations | The retro's minutes per timed phase, offered to the facilitator (§6.2) |
| phase timer offer | The first entry of the facilitator's timer control in a phase with a duration, and its one-click start button (§6.2, §9.5) |
| task timer | The duration a poker round's timer starts with (§6.3) |
| ticket details | Type and labels of an imported poker task (§6.5) |
| criteria section | The part of a task's description under a heading "Acceptance criteria", shown apart (§6.5) |

## 6. Domain and data

### 6.1 The state of a session (SE-1)

No column is added. Each kind's state is read from what it already stores:

| Kind | Upcoming | Live | Finished |
|---|---|---|---|
| Retro | not completed, `started_at` null, no card | not completed, and `started_at` set or a card exists | phase `completed` |
| Poker game | not ended, no round in any task | not ended, a round exists | `ended_at` set |
| Poll (team survey, `retro_id` null) | `draft` (listed to its editors only, as on the team page) | `open` | `closed` |
| Whiteboard | no element | an element, touched in the last 15 minutes (decision 2) | an element, not touched in the last 15 minutes (decision 2) |
| Icebreaker room (`retro_id` null) | no round | a round in play (`current_round_id` set) | rounds played, none in play (decision 2: a room is "finished" between two rounds) |

The "or a card exists" clause classifies the retros created before `started_at` existed without a backfill, which would put a false start time on them (the owner shows a duration for new retros only, 2-D6).

Order: `updated_at` descending, then `id` descending, in every tab. One page holds 20 rows. The next page is read with a cursor `before = <updated_at ISO 8601>|<id>`: each kind is asked for its first 21 rows strictly after the cursor in that order, the five lists are merged in PHP and cut at 20 (a k-way merge: correct because each kind is sorted the same way). Each tab carries its total (five `count()` queries, one per kind), for "Load more" and its end line.

A row: `kind`, `id`, `title`, `url`, `state`, `updatedAt`, and one `meta` line built per kind from data the presenters already hold: retro "Retro · <phase> · n people" (participants, guests included); poker "Planning poker · n tasks"; whiteboard "Whiteboard · Facilitated by <name>"; poll "Poll · n answers" (respondents with an answer); icebreaker "Icebreaker · <game>". `ListTeamSessions` is the one action that builds this list; plan 23 (TM-2) calls it with a limit.

### 6.2 Retro: phase durations (SE-3)

**Max per card** is plan 21's (RT-3): its column `max_votes_per_card`, its validation at creation and in the settings, its row in the dialog and in the settings popover are all specified by plan 21 (its spec §6.3 and §9.7, draft of 2026-10-03). Plan 22 builds nothing for it. If plan 21 as merged does not send it from the dialog, plan 22's Task 7 stops and reports instead of adding it.

**Phase durations**: one new nullable JSON column `retros.phase_durations`, an object from phase value to whole minutes, for the five timed phases `writing`, `grouping`, `voting`, `discussing`, `actions`. A key is absent when that phase has no duration. Minutes are 1 to 60. Null (the server default, D-44) means no phase is timed. Cast `array` on the model; never compared by key order (rule 10).

Behaviour (owner, decision 3, option B): **nothing starts by itself**. A phase change does not touch the timer (`ChangeRetroPhase` is unchanged: a running or paused timer runs on or stays paused, as today). The durations are an offer to the facilitator:

- the board snapshot carries `phaseDurations` for every viewer (they are not secret; only the facilitator uses them);
- while the current phase has a duration, the facilitator's timer control (§9.5) offers it first: a one-click "<n> min" start button while no timer runs and none is paused, and the first entry of the timer menu, "<Phase> · <n> min", at all times;
- choosing the offer calls the existing start endpoint (`retros.timer.update`, `seconds` = minutes × 60), with everything that endpoint does today and after plan 21: the start of the retro (`MarkRetroStarted`), `TimerChanged`, a paused timer replaced, the icebreaker expiry;
- in Discussing, plan 21 (RT-5, answered "time per topic set from the topic timer") makes any timer started there the time per topic: the Discussing duration is therefore offered as "Discussing · <n> min per topic" and becomes `topic_seconds` through plan 21's rule (§16.2);
- the list 1, 3, 5, 10 of X5 stays, after the offer.

Durations can be edited in the retro settings popover while the retro is open; a change shows in the offer at once (the settings change announces `RetroSettingsChanged`, the boards refetch).

### 6.3 Poker: three game settings (SE-3)

Four new columns on `poker_games`:

| Column | Type | Default | Meaning |
|---|---|---|---|
| `revote_after_reveal` | boolean | false | Players may change their card in the revealed round of the current task until its estimate is saved |
| `task_timer_seconds` | unsigned small integer, nullable | null | When set, every new round starts with its timer at this duration |
| `writes_estimates` | boolean | true | Estimates of imported tasks are written back (today's behaviour) |
| `estimate_field_id` | string(100), nullable | null | Jira (Cloud or Data Center) field the estimate is written to; null = the team connection's field |

Defaults keep every existing game as it behaves today; no data migration.

**Change vote after reveal.** A new guard, `PokerGuard::acceptsCard`, used by `PlayPokerCard` only, accepts the latest round of the current task when it is not revealed (today's `openRound`), **or** when it is revealed, the game has `revote_after_reveal`, and the task has no estimate. `PokerGuard::openRound` itself is unchanged: the reveal and the two timer endpoints keep refusing a revealed round. Spectators still cannot vote. After reveal a card can be changed, not withdrawn (a revealed round keeps a result). A card changed in a revealed round announces `PokerRoundChanged` (every client refetches; the values are public in a revealed round), not `PokerVoteChanged`. The result (`PokerResult`) is recomputed from the votes at every read. A change and the facilitator's "Save estimate" both lock the game row first: a change arriving with the save is either applied before it or refused after it (race, §13).

**Task timer.** `StartPokerRound` sets `timer_ends_at` to now plus `task_timer_seconds` (whole seconds) on the round it creates, and queues `RevealPokerRoundOnTimer` after commit, exactly as `PokerTimersController@update` does. The expiry behaves as today (decision 4): it reveals when auto reveal is on; otherwise the timer reaches `0:00` with its alarm (X4), which is the "nudge" of the mockup. Values: 60, 180, 300, 600 seconds (X5); the facilitator's own timer control is unchanged.

**Write estimates.** `RequestEstimateSync::afterEstimateChange` queues nothing when `writes_estimates` is off; the task's write-back state reads "Estimates are not written back in this game." (`PokerTaskSync::unsupportedReason`), and the facilitator's retry is refused with that reason. When `estimate_field_id` is set, `JiraIssueTracker::writeEstimate` tries that field first (it must still be on the issue's edit screen, as today's fields are), then the connection's fields. The field must be one of the connection's detected number fields (`numberFields`) when it is saved; a field that disappears later makes the write fail with today's message "This issue has no story points field on its edit screen." (decision 5).

### 6.4 Poker: import at creation (SE-3)

The Tasks block of the poker form has three tabs: "Import from <source>", "Type them", "Later". The import tab exists when the team has at least one active tracker connection the instance enables (`ResolvePokerTracker::teamHasTracker`); with several, a source select heads the tab (decision 7: every tracker, not Jira only).

Team-scoped browse routes mirror the game-scoped ones, under `createPokerGame` on the team: containers, iterations, preview. The preview marks nothing "already imported". The browse limit (`TrackerBrowseLimit`) is counted per user.

The creation request carries `import_source` and `import_ids` (1 to 100 external ids, distinct), exclusive with `tasks`. The controller resolves the tracker and **fetches the issues before creating anything** (`IssueTracker::issues`, the client's ids trusted as ids only, as `ImportPokerTasks` does today); a tracker failure answers a validation error on `import_ids` with the tracker's message and creates no game. Then the game, its facilitator and its imported tasks are written in one transaction, through the same code that writes imported tasks inside a game (`ImportPokerTasks::storeIssues`, extracted). Ids the source no longer returns are skipped and counted; the game opens with a flash "n tickets imported, m skipped" when m > 0.

### 6.5 Ticket details (PK-1)

**Type and labels.** Two new columns on `poker_tasks`, written like the other `external_*` columns (by import, refresh and status sync only; not fillable):

| Column | Type | Content |
|---|---|---|
| `external_type` | string(60), nullable | Jira `issuetype.name`; GitHub issue type name when the API returns one; null for Linear |
| `external_labels` | JSON, nullable | list of at most 10 label names, each at most 60 characters, in the source's order; Jira `labels`, Linear `labels.nodes.name`, GitHub `labels.name` |

`TrackerIssue` gains `type` and `labels` (default null / empty); every tracker fills what it has. `ImportPokerTasks`, `ApplyPokerTaskIssues` (refresh and automatic sync) write them. Existing imported tasks receive them at their next refresh or sync; no migration calls a tracker.

**Acceptance criteria (owner, decision 6, option B): a section of the description.** No column, no tracker field, no setting. The criteria are read from the task's description (`poker_tasks.description`, Markdown) when it is presented, by one pure class, `AcceptanceCriteriaSection::split(?string $markdown)`, which returns the description without the section and the section's body. Reading at presentation, not at import, means: every task gets it, imported (any tracker) or typed by hand; existing tasks get it at once; the stored description is never changed, so the facilitator's edit dialog and every other reader of `description` (MCP, exports, AI) keep the full text.

Rules of the split, numbered so that no implementer widens or narrows them without the owner:

- **AC-1 The heading.** A line is the criteria heading when, after removing its markup (and outside a list item, a quote or a table row), its text folded (`Alphabetical::key`, spaces collapsed, one trailing `:` removed) equals one entry of `AcceptanceCriteriaSection::Headings`, which holds exactly `acceptance criteria` (English only: §16.8, ruled from the owner's answer). Three markups are recognised: a Markdown ATX heading of any level (`#` to `######`, closing `#`s allowed) — what the ADF and wiki-markup converters produce for Jira headings; a line made only of bold text (`**…**` or `__…__`); a plain line holding only the words and a trailing colon (`Acceptance criteria:`). Setext headings (a line underlined with `===` or `---`) are not recognised.
- **AC-2 First one only.** Only the first criteria heading is used; a later one stays in the section's body.
- **AC-3 Code is not read.** Lines inside fenced code blocks (``` or ~~~) are never a heading, neither for the start nor for the end.
- **AC-4 The end.** A repeated criteria heading never ends the section (AC-2). After an ATX heading of level L, the section ends before the next ATX heading of level L or less. After a bold or a colon heading, it ends before the next ATX heading of any level or the next bold-only line. Otherwise it runs to the end of the description.
- **AC-5 Empty section.** When the body is empty after trimming, nothing is split: the description is shown as it is and no criteria block appears.
- **AC-6 What is shown.** The description shown is the text before the heading and the text after the section, joined by one blank line, trimmed, or nothing when empty; the criteria shown are the body, trimmed. Both are rendered with `RenderTaskMarkdown` (safe Markdown) and cached by the hash of the text rendered, so that HTML cached before this release, which held the whole description, is never served for the shorter text.
- **AC-7 Accepted fragility.** A heading in another wording ("Definition of done", "AC", "Critères d'acceptation"), an image or a table used as heading, or a section the writer did not end with a heading, is shown as the source wrote it (no criteria block, or a longer block). The owner chose this option knowing it (§15, decision 6: "fragile (language, heading style)"); an implementer does not add a tracker field, a setting or a heuristic to "fix" it.

**Who sees them.** Type and labels are in `PresentPokerTask`'s `external` block for every viewer, guests included; the criteria (`acceptanceCriteriaHtml`) sit beside `descriptionHtml` on every task, for every viewer who sees the description today; the assignee and the sync errors stay team-only as today (spec 6 §6.6).

## 7. Permissions

| Action | Who |
|---|---|
| Open the Sessions page | `view` on the team (team members, workspace managers). Guests never (team pages are for members) |
| See a draft poll on it | its editors (facilitator or workspace manager), as on the team page |
| "New session" on it | as on the team page: each type's form appears per `createRetro`, `createPokerGame`, `createWhiteboard`, `createSurvey`, `createGameRoom` |
| Team-scoped tracker browse, import at creation | `createPokerGame` on the team, an active tracker connection |
| Set phase durations | the retro's creator in the dialog; the facilitator in the settings popover (`RetroSettingsController`) |
| Use the phase timer offer | the facilitator of an open retro, through the existing start endpoint (`RetroGuard::facilitator`) |
| Set the three poker settings | the creator in the dialog; the facilitator in the room settings (`PokerSettingsController`) |
| Change a card after reveal | a player who can vote (not a spectator), guests included, as for any vote |

## 8. Real time

- Sessions page: none. The page is read at each visit; "Live" is computed at request time. (A live list is not in the mockup and not requested.)
- Retro: a phase change announces `PhaseChanged` only, as today (no timer starts); a facilitator who takes the offer starts the timer through the existing endpoint, which announces `TimerChanged`; a change of the durations announces `RetroSettingsChanged` (existing; the boards refetch).
- Poker: a new round with a task timer is announced by the caller's existing events, and its `timerEndsAt` is in the snapshot every client refetches; a card change in a revealed round announces `PokerRoundChanged` (clients refetch); a settings change announces `PokerGameChanged` (existing).
- Ticket details and the criteria travel inside the task payloads already broadcast (`PokerTaskSaved`, `PokerGameChanged` → refetch); a description edited by hand re-splits at its next presentation.

## 9. Screens

### 9.1 Sessions page — `teams/sessions` (SE-1)

Mockup: `ScreenSessionCreate`, the page behind the overlay (frames a–d). Route `GET w/{workspace}/teams/{team}/sessions?tab=upcoming|live|finished&before=…`, name `teams.sessions.index`.

Composition: application shell with the sidebar entry "Sessions" active; breadcrumb "<team> › Sessions"; header: H2 "Sessions", the line "Retros, poker, whiteboards, polls and icebreakers of <team>", the primary button "New session" (the same dialog as the team page, same `?new=` intent); tabs "Upcoming", "Live", "Finished" (links, `aria-current`, the tab in the URL; default Live); a list of rows: a card per session with the kind tile in the kind's colour and icon of `SessionTypePicker` (retro coral, poker moss, whiteboard sky, poll iris, icebreaker sun), the title, the meta line, a chevron; the whole row is a link to the session.

States: loading (the `Skeleton` "Loading sessions" while a tab or "Load more" loads); empty per tab (`EmptyState`: "No upcoming session", "No live session right now", "No finished session yet", with "New session" when the viewer may create one); end of list ("You're all caught up · n sessions", `LoadMore` of `ui/pagination`); "Load more" with "n more"; a draft poll row carries the badge "Draft".

Phone: rows full width, the tabs scroll horizontally, "New session" stays in the header; the phone tab bar's "Sessions" leads here.

The sidebar's and tab bar's "Sessions" entries lead to this page instead of `#sessions`; the team page keeps its sections and its `#sessions` anchor.

### 9.2 "New session" dialog — retro form (SE-3)

Mockup: `ScreenSessionCreate` frames a and c, right column "Settings". Rows in the mockup's order: Anonymous cards; Votes per person (stepper, with "Automatic" kept by D-40); Max per card (plan 21's row, untouched here); **Timer per phase** (select, help listing the timed phases with their minutes, "Writing 7 · Voting 3 · Discussing 15"); Icebreaker at the start (+ game); Health check. The ROTI switch is not built (backlog).

"Timer per phase" select: "No timer" (default), "Standard" (Writing 7 · Grouping 5 · Voting 3 · Discussing 15 · Actions 5), "Custom (5 phases)". "Custom" opens, under the row, five minute steppers (1 to 60, or off) labelled by phase. The help line lists the phases that have a duration, or "Off". The row says what the durations do: its help ends with "Offered to the facilitator, never started by itself" (shortened to the summary on phone).

### 9.3 "New session" dialog — poker form (SE-3)

Mockup: frames b and d. Left column: Name; Deck (unchanged); **Tasks** with three tabs "Import from <source>", "Type them", "Later". The import tab: source select (only with two sources or more); the browse form of the in-game import (board and sprint, or query; for Jira the query in mono), the list of tickets with a checkbox, key and title (`sk-ticket` rows), "n of m selected · Select all"; the states of the in-game dialog (loading, empty "No ticket matches.", truncated "Only the first 100 are shown.", tracker error with its message, "Reconnect <source> in the team settings." for a lost connection).

Right column "Settings": Auto reveal; Facilitator in "Watch only"; **Timer per task** (select "Off", "1 minute", "3 minutes", "5 minutes", "10 minutes"; help "Nudges after the delay"); **Change vote after reveal** (switch; help "Before the estimate is saved"); **Write estimates to <source>** (select: "Don't write" and the connection's number fields, the connection's field preselected; help "Field used for the estimate"); the info note "Estimates are written to <source> when the facilitator clicks “Save estimate”. Unselected tickets stay in the backlog." The write row and the note show only when the team has a tracker connection that can write; for Linear and GitHub the select holds "Write" / "Don't write" (no field). Invitation block unchanged. Footer: Cancel, "Create & open" ("Schedule…" is not built: backlog).

### 9.4 In-session settings

Retro settings popover (`components/retro/board-settings.tsx`): the "Timer per phase" row of §9.2, facilitator only, while the retro is open. Poker room settings popover (D-70): "Timer per task", "Change vote after reveal", "Write estimates to <source>", facilitator only, while the game is not ended.

### 9.5 Retro board — the phase timer offer

Mockups: `Timer` (the menu) and `FacilitatorBar`. Only the facilitator of an open retro sees it, on the topbar timer (`BoardTimer`), in a phase that has a duration:

- no timer running and none paused: a one-click button before the timer's menu, play icon and "<n> min", accessible name "Start the <phase> timer, <n> minutes" ("… per topic" in Discussing);
- the timer menu: first entry "<Phase> · <n> min" ("Discussing · <n> min per topic"), a separator, then the list 1, 3, 5, 10, then "Stop timer" as today;
- a running or paused timer: no button; the menu entry stays (it restarts the timer for the phase's duration).

Participants see the countdown only, as today. A phase without a duration shows the timer exactly as today. The `Timer` component gains an optional `suggestion` (one preset, rendered as above); `SessionTimer` passes it through; no other screen passes it, so X5's list is unchanged everywhere else.

### 9.6 Poker room — the dock after reveal with "Change vote after reveal"

The deck stays playable after reveal while the task has no estimate; the hint under the deck reads "Your card · <value> — you can still change it until the estimate is saved."; the result in the oval and the dock follow the votes. Once the estimate is saved, the deck is closed as today.

### 9.7 Poker room — story card (PK-1)

Mockup: `ScreenPokerBefore`, the story card: first line "<key> · <type> · <label>… · n / m of this session"; the title; the description; "Acceptance criteria" with its list. Built: the type as an outline badge after the key link, each label as a soft badge (at most 10, wrapped), then the position; the description without its criteria section; under it the heading "Acceptance criteria" (the app's string, in the viewer's language, whatever heading the source used) and the section's rendered Markdown. Nothing is shown for a field the ticket does not have. A task typed by hand has no type or labels, and shows the criteria block when its description has the section. The edit dialog of a task shows the whole description, section included.

## 10. Migrations of existing data

None. The new columns have defaults that keep today's behaviour (`writes_estimates` true, the others off or null). Retros started before `started_at` existed are classified by the card rule of §6.1. Imported tasks receive their type and labels at their next refresh or sync. The criteria section is read from the stored description at each presentation, so every existing task shows it at once; nothing stored changes.

## 11. Routes and validation

| Route | Name | Controller | Authorisation |
|---|---|---|---|
| `GET teams/{team}/sessions` | `teams.sessions.index` | `TeamSessionsController@index` | `view` team |
| `GET teams/{team}/poker-imports/{source}/containers` | `teams.pokerImports.containers.index` | `TeamPokerImportContainersController@index` | `createPokerGame`, tracker active |
| `GET teams/{team}/poker-imports/{source}/iterations` | `teams.pokerImports.iterations.index` | `TeamPokerImportIterationsController@index` | same |
| `POST teams/{team}/poker-imports/{source}/preview` | `teams.pokerImports.preview.store` | `TeamPokerImportPreviewsController@store` | same, throttled per user |

All under `w/{workspace}`, scoped bindings; `{source}` one of `jira|linear|jira_dc|github`.

Validation added:

- `teams.retros.store` and `retros.settings.update`: `phase_durations` nullable array; keys among the five timed phases (`Rule::in` on `array_keys`, through a closure rule); values integers 1 to 60. (`max_votes_per_card` is plan 21's.) `retros.timer.update` is unchanged: the offer sends minutes × 60, within its 10 to 7 200 seconds.
- `teams.pokerGames.store` and `poker.settings.update`: `revote_after_reveal` boolean; `task_timer_seconds` nullable, in 60, 180, 300, 600; `writes_estimates` boolean; `estimate_field_id` nullable string ≤ 100, one of the team's Jira connection's `numberFields` ids. Store only: `import_source` required with `import_ids`, a tracker value; `import_ids` array 1 to 100, distinct strings ≤ 100, prohibited with `tasks`.

## 12. Acceptance criteria

1. The sidebar's "Sessions" (and the phone tab bar's) opens `teams.sessions.index` for the current team, with the Live tab; a user who cannot view the team gets 403; a guest cookie gives no access.
2. With one session of each kind in each state of §6.1, each tab lists exactly the sessions of its state, newest `updated_at` first, ties by id; a retro created before `started_at` existed, with cards and no start time, is Live; a draft poll appears in Upcoming for its editor and for no other member.
3. With 45 sessions spread over the five kinds in one tab, the first page has 20 rows, "Load more" brings rows 21 to 40 with no duplicate and no gap, the third brings 5 and the end line reads "45 sessions"; proved on PostgreSQL in this plan (the same walk runs on SQLite, MariaDB and MySQL in the roadmap's final four-engine matrix).
4. Each row shows its kind's icon and colour, its title, the meta line of §6.1 (retro participants counting guests), and links to the session; the icebreaker rooms of retros and the polls attached to retros are never listed.
5. "New session" on the Sessions page opens the same dialog as the team page with the same types and permissions, and `?new=poker` opens it on poker.
6. Creating a retro with "Standard" stores `{writing: 7, grouping: 5, voting: 3, discussing: 15, actions: 5}` and the board snapshot carries them; a value of 0 or 61, or an unknown phase, is refused. Entering a phase with a duration starts no timer and announces no `TimerChanged` (the phase change still marks the retro started, as today); a running timer runs on and a paused one stays paused across the change. The facilitator changes the durations in the settings popover; a member cannot (403).
7. In a phase with a duration, the facilitator's timer control shows the one-click "<n> min" button while no timer runs or is paused, and the first menu entry "<Phase> · <n> min" (in Discussing "… per topic") followed by 1, 3, 5, 10; taking it sends `seconds` = minutes × 60 to the existing start endpoint; a participant sees no button and no menu; a phase without a duration shows the timer as today; no other screen's timer list changes.
8. A poker game created with "Timer per task: 3 minutes" starts each new round with a timer ending 180 seconds after its start; at expiry it reveals when auto reveal is on and does not otherwise.
9. With "Change vote after reveal" on, a player changes their card after reveal until the estimate is saved, every client refetches, and the result follows; once the estimate is saved, or a new round started, a change is refused with "Voting is closed for this round."; withdrawing a card after reveal is refused; the reveal and timer endpoints still refuse a revealed round; with the setting off, a change after reveal is refused as today; a change and a "Save estimate" at the same moment end with the change either applied before or refused (race on PostgreSQL in this plan; on the other engines in the roadmap's final matrix).
10. With "Write estimates" off, saving an estimate of an imported task queues no write, the task shows "Estimates are not written back in this game.", and the retry is refused with it; with a field chosen, the write goes to that field; a field id that is not among the connection's number fields is refused at creation and in the settings.
11. Creating a game with `import_source=jira` and three ids fetches them from Jira, creates the game with the three tasks in the source's order, with their key, link, description and ticket details, and redirects to it; an id the source does not return is skipped and reported; a tracker error creates no game and shows the tracker's message on the import tab; `import_ids` with `tasks` is refused; a member of another team gets 403 on the browse routes.
12. The team-scoped browse routes return the same containers, iterations and previews as the game-scoped ones for the same connection, with no "already imported" mark, and count against the user's browse limit.
13. An imported Jira task carries its type and labels, refreshed by "Refresh from the source" and by status sync; Linear and GitHub tasks carry their labels (and GitHub its type when given); a task typed by hand carries none. A guest of the game sees them; the assignee stays hidden from guests.
14. The story card shows the type and labels on its first line and "Acceptance criteria" under the description, as the mockup, and nothing for fields a ticket lacks.
15. A task whose description holds a section headed "Acceptance criteria" (an ATX heading of any level, a bold-only line or "Acceptance criteria:", any case) presents `descriptionHtml` without the section and `acceptanceCriteriaHtml` with its body, for an imported task of each tracker and for a task typed by hand, to members and guests; the stored `description` is unchanged and the edit dialog shows it whole; the section ends as rule AC-4 says; a heading inside a code block, a second heading, an empty section, or another wording ("Definition of done", "Critères d'acceptation") splits nothing beyond rules AC-1 to AC-5; HTML cached before the change is not served for the shorter description.
16. Every new string exists in the four languages, informal in French, Spanish and German (`InformalRegisterTest`, `TranslationKeysTest` pass).
17. Captures in light, at 1440, in French of the Sessions page (Live tab), the dialog on retro and on poker (import tab), the retro topbar with the phase timer offer, the poker room's story card, compared with the mockup; the overflow check passes.
18. The unit, feature, upgrade, arch and concurrency suites pass on PostgreSQL; `tests/Arch/DatabasePortabilityTest.php` passes (no raw SQL, no driver test). SQLite, MariaDB and MySQL are not run by this plan: the owner's four-engine matrix runs once at the end of the roadmap (§4).

## 13. Testing

- Feature tests for every route, guard, state rule and setting; the state matrix of §6.1 written by hand; the cursor walk of criterion 3 (the cursor compares timestamps: SQLite compares them as text, which `updated_at` stored by Eloquent orders correctly — written portable now, run on SQLite in the roadmap's final matrix).
- One race in `tests/Concurrency` (`Race`): a card change after reveal against "Save estimate", on PostgreSQL.
- Engines (owner, 2026-10-03): every test of this plan runs on PostgreSQL; the four-engine matrix (SQLite, MariaDB, MySQL as well) runs once after the roadmap's last merge, outside this plan.
- Tracker tests with `Http::fake` and the helpers of `tests/Pest.php` (`fakeJiraTrackerApi`, `jiraTrackerIssue`, `fakeLinearGraphql`, `trackerTable`).
- Unit tests for `AcceptanceCriteriaSection` (rules AC-1 to AC-6, one case per rule and per markup), written by hand.
- Vitest for the state helpers of the Sessions page, the phase-duration summary and offer, the timer's `suggestion`, the poker settings rows, the import tab's selection, the story card details.
- No data migration, so no Upgrade test; the defaults are asserted by feature tests on rows created without the new columns.
- No browser walkthrough; captures only.

## 14. Risks

- **Plan 21 shapes the retro part.** "Max per card" is plan 21's entirely; plan 21's pause (RT-2) and time per topic (RT-5) change the timer control the offer sits on (`BoardTimer`, the facilitator bar) and what a start does in Discussing. Plan 22 runs after plan 21 (and 20, 26, 27, 29) is merged into `roadmap`, and re-reads `Retro`, `RetroTimersController`, `RetroSettingsController`, `board-topbar.tsx` and plan 21's facilitator bar.
- **Engine regressions found late.** Only PostgreSQL runs during this plan; an engine-specific failure (SQLite, MariaDB, MySQL) surfaces at the roadmap's final matrix. Accepted by the owner (2026-10-03); the portability rules and `DatabasePortabilityTest` are the guard meanwhile.
- **The offer is easy to miss.** Nothing starts by itself (owner's answer): a facilitator who ignores the button runs the phase untimed. Accepted; the dialog's help says the durations are offered.
- **The cursor across five tables.** A merge in PHP of five ordered queries is correct only if every kind uses the same order and the same cursor test; the walk test of criterion 3 is the guard. `updated_at` moves when a session is touched: a session can jump to the first page between two "Load more" (accepted: the list is "last activity").
- **"Live" for things that never end** (whiteboards, rooms) is a product choice (decision 2).
- **Revote after reveal** changes a rule that several components read (`PokerGuard::openRound`, the dock's `isClosed`, auto reveal). The guard stays the one place; the race proves the boundary with "Save estimate".
- **Outbound calls during creation.** The import fetches from the tracker inside the creation request; a slow tracker slows the dialog (the client's timeouts apply). No game is created when it fails.
- **The criteria section is fragile, by choice.** It depends on the writer's wording and heading style (rule AC-7); teams writing their heading in French, Spanish or German see no block (§16.8, ruled: English only). A Jira site that keeps its criteria in a custom field shows none. The owner accepted both; the rules are numbered and tested so that they are not widened silently.
- **The split runs at each presentation.** It is a linear scan of at most 10 000 characters (the description cap), cached with the rendered HTML; a snapshot of a 100-task game splits 100 descriptions once per description change.
- **Shared files.** `routes/web.php`, `TeamsController`, `team-page.tsx`, `poker-session-fields.tsx`, `retro-session-fields.tsx`, `board-topbar.tsx`, `skrum/timer.tsx`, `PokerSettingsController`, `RetroSettingsController`, `lang/*.json` are also touched by plans 21 and 23: the plan's lanes keep them in one lane each.

## 15. Decisions for the owner — answered 2026-10-03

The body follows the owner's answers. Six are the recommended option; decisions 3 and 6 are not (option B for both).

| # | Answer | Equal to the recommendation |
|---|---|---|
| 1 | A: Upcoming = created, not started | yes |
| 2 | A: whiteboards and rooms by activity (15 minutes) | yes |
| 3 | **B**: the phase's duration is offered to the facilitator; nothing starts by itself | **no** (A was recommended) |
| 4 | A: the round timer; reveals with auto reveal, otherwise rings | yes |
| 5 | A: "Write estimates" per game, on/off and field | yes |
| 6 | **B**: a section of the description headed "Acceptance criteria" | **no** (A was recommended) |
| 7 | A: every connected tracker | yes |
| 8 | A: last-activity date on Upcoming and Finished rows | yes |

The options as they were put:

**1. What is "Upcoming" without scheduling?** — answered A.
- A. Sessions created and not started yet: a retro with no card and no start, a poker game with no round, a draft poll, an empty whiteboard, a room never played. Uses what is stored; the tab the mockup draws is kept and useful (sessions prepared in advance). **Recommended.**
- B. No Upcoming tab until scheduling exists: two tabs, Live and Finished; a never-started session is Live. Simpler, but a deviation from the mockup.
- C. The tab is kept and always empty, with "Scheduling is coming later". Faithful to the drawing, useless.

**2. Where do whiteboards and icebreaker rooms go, since they never end?** — answered A.
- A. By activity: a whiteboard is Live when touched in the last 15 minutes (the rule of the command palette's "live"), Finished otherwise; a room is Live while a round is in play, Finished between rounds; both Upcoming while empty. No new data. A board edited yesterday reads "Finished". **Recommended.**
- B. Always Live once used (they are persistent places); Upcoming while empty; never Finished. The Live tab fills with old boards and rooms.
- C. Add an "Archive" action to whiteboards and rooms (a new `archived_at`), Finished = archived. New data and a new action the mockup does not draw.

**3. What does "Timer per phase" do?** — answered **B** (≠ recommendation).
- A. The phase's timer starts by itself when the retro enters a phase with a duration; the facilitator can still change or clear it. Matches the mockup's "phases set by the timer". **Recommended.**
- B. Nothing starts by itself: the facilitator's timer control offers the phase's duration first, one click to start.
- C. A and B with a switch "Start timers automatically".

**4. What does "Timer per task" do at expiry?** — answered A.
- A. The existing round timer, started by itself at each new round: at `0:00` it reveals when auto reveal is on, otherwise it rings (the "nudge"). No new behaviour. **Recommended.**
- B. A nudge only, without a visible timer: a notification "n players haven't voted" after the delay.
- C. The timer always reveals at expiry, auto reveal or not.

**5. Where does "Write estimates to Jira" live?** — answered A.
- A. Per game: on/off and the field (default: the connection's field), set in the dialog and in the room settings; the team setting stays the default. **Recommended** (the mockup draws it in the game's dialog).
- B. The select changes the team connection's field itself (team-wide, needs `manageIntegrations`), plus a per-game on/off.
- C. Per-game on/off only; the field shown read-only from the team settings.

**6. Where do acceptance criteria come from?** — answered **B** (≠ recommendation).
- A. A Jira text field detected by name ("Acceptance criteria"), changeable per connection in the integration settings; other trackers have none. Deterministic. **Recommended.**
- B. A section of the description headed "Acceptance criteria" (any tracker), shown apart. No setting, but fragile (language, heading style) and the description repeats it.
- C. Not shown: type and labels only; the mockup's block stays a deviation.

**7. Which trackers does the creation import offer?** — answered A.
- A. Every tracker the team has connected (Jira, Jira Data Center, Linear, GitHub), the tab titled by the source, a select when there are several — as the import inside a game. **Recommended** (existing features kept).
- B. Jira and Jira Data Center only, as drawn.

**8. Dates on the rows.** The mockup's rows (Live tab) have no date. — answered A.
- A. Add the date of last activity at the end of the meta line on Upcoming and Finished rows only ("· 2 Oct"). **Recommended** (a finished list without dates is hard to use).
- B. No date anywhere, as drawn.

## 16. Not determined by reading

1. Resolved by reading plan 21's draft spec (2026-10-03, §6.1, §6.3, §9.7): the column is `max_votes_per_card` and plan 21 sets it at creation and in the dialog. Plan 22 builds nothing for it; Task 7 checks plan 21 as merged.
2. How plan 21's facilitator bar and topic timer (RT-5) present the timer in Discussing. Plan 21's draft says a start in Discussing sets `topic_seconds` (its criterion 10), so the Discussing duration is offered per topic (§6.2). **Ruled 2026-10-03:** per topic. The owner approved deviation P22-15 as listed, and that row draws the offer as "… per topic" in Discussing; plan 21's rule (any timer started in Discussing is the time per topic) is the owner's own answer. "Discussing 15" of the "Standard" set is therefore 15 minutes per topic; no start that bypasses plan 21's rule is built.
3. Whether the GitHub REST and GraphQL responses the tracker reads carry an issue type (`type` / `issueType`) for the installations Skrüm supports; the plan reads it when present. **Kept while building:** the GraphQL fragment asks for `issueType { name }` and the REST mapping reads `type.name`; a repository without issue types gives none, and the card shows no type.
4. Whether the headings Jira users write reach the description Markdown in a form rule AC-1 reads: the ADF converter writes headings as `#` lines and bold as `**…**` (`AdfToMarkdown` lines 76 and 150), the wiki-markup converter `h1.`–`h6.` as `#` lines and `*bold*` as `**bold**` (`WikiMarkupToMarkdown` lines 73 and 114); a bold run with a trailing colon inside it (`**Acceptance criteria:**`) is read; a heading split over several marks (`**Acceptance** criteria`) is not.
5. Whether `updated_at` of a retro, a whiteboard and a room moves on every activity (cards, elements, rounds) — `PokerTask` touches its game (`#[Touches]`), the others were not checked line by line; the "last activity" order depends on it.
6. Whether the current `RetroSettingsController` (or plan 21's version of it) restricts settings per phase in a way phase durations must follow.
7. Whether an Inertia merge prop (`Inertia::merge`) would append across a tab change as well as on "Load more"; the plan avoids the question: a partial reload of `sessions` and `nextCursor` with `before`, appended in the page's own state, reset when the tab changes.
8. Whether the criteria heading should also be recognised in French, Spanish and German ("Critères d'acceptation", "Criterios de aceptación", "Akzeptanzkriterien"). **Ruled 2026-10-03:** English only. The owner's answer names "Acceptance criteria" (decision 6) and, answering P22-14, repeats "acceptance criteria from a description section"; the fragility in language was in the option he chose (AC-7). Adding a translation later is one line of `AcceptanceCriteriaSection::Headings` and one test case each, on the owner's word only.

## 17. Pre-build deviations — answered 2026-10-03

The plan's table "Pre-build deviations" lists each row in full. The owner's answers of 2026-10-03: "P22: 03 + 05 approved, 11 Markdown, 12 + 13 editable in session, P22-14 obsolete (acceptance criteria from a description section), others approved." Rows marked "O:" follow from an owner's decision and are approved by it. No answer differs from the plan's proposal, so nothing in §§6–12 changes because of them.

| Row | What it covers | Answer (2026-10-03) |
|---|---|---|
| P22-01 | last-activity date on Upcoming and Finished rows | approved (O: decision 8) |
| P22-02 | Upcoming = created, not started | approved (O: decision 1) |
| P22-03 | empty states per tab, "Load more" and its end line | approved |
| P22-04 | no "ROTI at the end" switch | approved (backlog) |
| P22-05 | "Timer per phase": No timer / Standard / Custom with five steppers | approved |
| P22-06 | "Timer per task": Off, 1, 3, 5, 10 minutes | approved (O: X5) |
| P22-07 | no "Schedule…" in the footer | approved (backlog) |
| P22-08 | "Import from <source>" with a source select | approved (O: decision 7) |
| P22-09 | "Write" / "Don't write" for Linear and GitHub | approved |
| P22-10 | invitation link still not in the dialog | approved |
| P22-11 | the criteria section rendered as Markdown under the app's heading | approved: **Markdown** |
| P22-12 | three rows in the poker room settings popover | approved: **editable in session** |
| P22-13 | "Timer per phase" row in the retro settings popover | approved: **editable in session** |
| P22-14 | (an "Acceptance criteria field" select) | **obsolete**: the criteria come from a section of the description (decision 6, B); nothing built |
| P22-15 | the phase timer offer on the facilitator's topbar timer, "… per topic" in Discussing | approved (O: decision 3, B); settles §16.2 |

## 18. As built — differences found while building (2026-10-03)

Folded in from the plan's tasks and its comparison of the captures with the mockups (plan 22, Task 21). None changes a decision of §15 or a criterion of §12.

- **Cursor (§6.1).** The cursor travels in UTC while `updated_at` is stored without an offset in `app.timezone`; `ListTeamSessions` binds the cursor's time in the application timezone before comparing, so "Load more" neither skips nor repeats a session outside UTC.
- **Criteria section (§6.5, rules AC-1 and AC-3).** A Jira heading made bold reaches the description as `## **Acceptance criteria**`: one pair of emphasis marks around the heading text is markup under AC-1. A code fence closes only on a fence line without an info string, and a bold or colon heading line may be indented by three spaces at most, so an indented code block is never read as a heading.
- **Creation import (§6.4).** The tickets are fetched before the game exists; a failing tracker or a missing connection is an error on `import_ids` and leaves nothing. They are then written in the creation transaction through `ImportPokerTasks::storeIssues`, the code the in-game import uses. The in-game dialog's browse body is the shared `TrackerIssuePicker`, fed by the game-scoped or the team-scoped routes.
- **Poker room snapshot (§9.4).** The room's tracker connections carry the Jira estimate fields and the default one, so that the settings popover offers the same "Write estimates" choices as the dialog.
- **Dialog selects (§9.2, §9.3).** "Timer per phase" and "Write estimates to <source>" stop at 14rem, so that "Custom (5 phases)" and a Jira field such as "Story point estimate" show whole, as the mockup draws them (fixed after the comparison of the captures; the first build cut them at 11rem).
- **Rulings while building**, with the owner's autonomy mandate of 2026-10-03: rows P22-16 to P22-20 of the plan's "Pre-build deviations" table (the topbar search, the retro row's icon, the French wording that keeps existing values, the import tab's browse form, the help of "Timer per phase").
