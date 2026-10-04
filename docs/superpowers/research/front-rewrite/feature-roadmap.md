# Feature roadmap after the front-end rewrite

> **Changes by the owner, 2026-10-02 (after this file was written):** plan 28 (whiteboard collaboration: comments, follow, sticky authors, convert to actions) and plan 30 (mentions) are removed and move to the backlog; scheduling ("Schedule…", start time, "starts in 5 min") leaves plan 22 for the backlog; registration that creates a workspace and a team joins plan 25 (onboarding); the whole-word guess of hangman joins plan 27; the four extra games stay in plan 27. The roadmap is plans 19–27 and 29. Rows below are not yet edited.

Date: 2026-10-02. Source: the owner's third round of answers (`owner-answers-2026-10-02.md`, "Features to specify after the rewrite").

Rule (spec §5 rule 13): **rewrite first, features after.** Plans 18e to 18g deliver every existing screen faithful to its mockup with what the server already holds. A mockup element with no data is omitted there and listed in the table "Deviations from the mockup" of plan 18e; its place is left in the screen (the "Places left" line of each task). Each such element is a feature below. Every feature gets its own spec, then its plan: nothing here is a specification.

How to read a row:

- **Mockup**: where the design system shows it (`docs/design-system/`, names as in `design-system-digest.md`).
- **Clears**: the row of the deviations table of plan 18e that the feature removes, wholly or in part.
- **Back end**: one line, from a reading of the current code. It says what is missing, not how to build it.
- **Needs**: features that must exist first.
- **Plan**: the proposed plan. The order is a proposal; the owner sets it.

The "Back end" lines were written from the models and controllers read while revising plan 18e. None was verified by running code, and each spec re-reads the code it touches.

## Proposed order

| Plan | Content | Why here |
|---|---|---|
| 19 | Standalone surveys, the Poll session type, the survey builder, health check as a default survey template (SV-1 to SV-5) | Decided by the owner. It removes a retro phase (D-03), so it comes before the retro features that touch the stepper |
| 20 | Whiteboard toolbars rebuilt to the mockup (WB-1) | Decided by the owner as a plan of its own. No back end; independent of everything else |
| 21 | Retro facilitation (RT-1 to RT-10) | The largest group of omitted elements on the most used screen; RT-3 is needed by SE-3 and RT-8 by WB-5 |
| 22 | Sessions index, advanced creation options, ticket details in poker (SE-1, SE-3, PK-1; scheduling SE-2 is backlog) | SE-3 needs RT-3; PK-1 needs the Jira import of SE-3 |
| 23 | Team and workspace data (TM-1 to TM-7, WS-1 to WS-3) | TM-2 reads `ListTeamSessions` (SE-1); TM-6 (team roles) is needed by WS-3, IN-1 and ON-1 |
| 24 | Action items (AI-1 to AI-4) | Sprint grouping needs TM-1 |
| 25 | Invitations and onboarding (IN-1 to IN-4, ON-1) | Needs team roles (TM-6); the onboarding's last step no longer waits on scheduling (SE-2 is backlog) |
| 26 | Account, and what a guest picks (AC-1 to AC-6, GU-1, GU-2) | GU-1 needs AC-4 |
| 27 | Games (GM-1 to GM-4) | Independent; four new engines make it the largest plan |
| 28 | Whiteboard collaboration (WB-2 to WB-5) | After the toolbars (WB-1), which give the selection bar its place; WB-5 needs RT-8 |
| 29 | Administration and error pages (AD-1 to AD-5) | Independent |
| 30 | Mentions and their notifications (MN-1) | After plan 18f (the bell) and after WB-2, so that every commentable surface exists |

## Surveys — plan 19

| Id | Feature | Mockup | Clears | Back end | Needs | Status |
|---|---|---|---|---|---|---|
| SV-1 | Standalone survey, and the Poll type of the "New session" dialog | ScreenSurvey (builder, answer, results); ScreenSessionCreate (Poll tile) | D-09 (Poll), D-22 | A survey belongs to a retro today (`surveys.retro_id`): a survey owned by a team, with its own page, guest link and channel | — | done, plan 19 |
| SV-2 | Multi-question builder (reorder, duplicate, required) | ScreenSurvey a | D-22 | One question per survey today: a questions table under a survey, with positions | SV-1 | done, plan 19 |
| SV-3 | Scale (1–5) and NPS (0–10) questions and their results | ScreenSurvey a, b, c | D-22 | `SurveyKind` has no scale or NPS case; results need a mean and an NPS score | SV-2 | done, plan 19 |
| SV-4 | Compare with a previous survey; CSV export | ScreenSurvey c | D-22 | No link between two surveys; no export route | SV-1 | done, plan 19 |
| SV-5 | Health check as a default survey template; the dedicated retro phase goes | none (the mockups have no health-check phase) | D-03 | Health statements, answers and the trend are their own tables and a `RetroPhase` case: a migration of that data, of the team trend (B23) and of the stepper | SV-1, SV-3 | done, plan 19 |

Not requested, staying backlog (spec `2026-10-19-standalone-surveys-design.md` §13): anonymity modes; close date and automatic close; a threshold setting; saved survey templates and "From a template…"; "Send to whiteboard"; keywords; the "Other" option; per-question length; MCP survey tools and a token scope; a survey source for action items (D-19); hand-over; scheduling; a live list of surveys on the team page; moving the retro surveys onto the team-survey tables; changing one's health-check answers after sending them.

## Whiteboard

| Id | Feature | Mockup | Clears | Back end | Needs | Plan |
|---|---|---|---|---|---|---|
| WB-1 | Rebuilt toolbars: vertical tool bar, selection bar, zoom, minimap | ScreenWhiteboard | D-21 (toolbars) | None: front only, over Excalidraw's API. Spec §3 and rulings 5 and 29 are reversed by its spec (`2026-10-21-whiteboard-toolbars-design.md`) | — | done, plan 20 |
| WB-2 | Comments on the board | ScreenWhiteboard (topbar "Comments") | D-21 | No comment model for a whiteboard | WB-1 | 28 |
| WB-3 | Follow a person | ScreenWhiteboard ("Suivre Camille") | D-21 | Viewport follow exists for the facilitator ("Bring everyone to me"); following any member needs a per-member viewport broadcast | WB-1 | 28 |
| WB-4 | Author of a sticky | ScreenWhiteboard | D-21 | Elements store no author | — | 28 |
| WB-5 | Convert selected stickies to action items | ScreenWhiteboard (selection bar) | D-21, D-19 (whiteboard source) | An action item has a retro or no source: a whiteboard source | WB-1, RT-8 | 28 |

## Retro — plan 21

| Id | Feature | Mockup | Clears | Back end | Needs | Status |
|---|---|---|---|---|---|---|
| RT-1 | "is writing…" and "is moving a card…" indicators | ScreenRetroWriting, ScreenRetroGrouping | D-10 | None stored: two client events on the retro's presence channel, with masking on an anonymous retro | — | done, plan 21 |
| RT-2 | Pause of the timer | ScreenRetroWriting (FacilitatorBar) | D-10 | A timer is an end time only: a paused state with the remaining seconds, on the four timers or the retro's alone | — | done, plan 21 |
| RT-3 | Maximum votes per card | ScreenRetroVote; ScreenSessionCreate ("Max per card") | D-11, D-07 | No per-card cap: a retro setting and its check in the vote endpoint | — | done, plan 21 |
| RT-4 | "I have finished voting" and "x/y have finished" | ScreenRetroVote | D-11 | No per-participant flag | — | done, plan 21 |
| RT-5 | Per-topic timer and time estimates | ScreenRetroDiscussion | D-12 | One timer per retro: a duration per topic and the remaining estimate | RT-7 | done, plan 21 |
| RT-6 | Shared discussion notes per topic | ScreenRetroDiscussion | D-12 | No notes model; collaborative editing and its place in the recap | — | done, plan 21 |
| RT-7 | "Discussed" flag on a topic | ScreenRetroDiscussion | D-12 | No flag on a card or a group | — | done, plan 21 |
| RT-8 | Action items linked to a card | ScreenRetroDiscussion, ScreenRetroActions | D-12 | `action_items` has no card reference | — | done, plan 21 |
| RT-9 | ROTI reveal and nudge | ScreenRetroROTI | D-14 | Results are shown at completion: a reveal state in the `roti` phase, and a notification to those who have not voted | — | done, plan 21 |
| RT-10 | Bulk export of a retro's action items to Jira | ScreenRetroActions | D-13 | Export is per item: a batch over the existing export action | — | done, plan 21 |

Not requested, staying backlog (spec `2026-10-21-plan-21-retro-facilitation-design.md` §3): "Reveal the cards" as a separate button, duplicate detection and "Auto-group duplicates", "Undo last group", the "n/n following" count, the export of a retro as PDF, CSV or Markdown, the ROTI delta and sparkline of the session-end screen; "⌘J create the Jira ticket too" of the Actions quick add; the pause of the poker, whiteboard and game-room timers; real co-editing of the notes; activity indicators on other session types and a stored history of who wrote or moved what; notes in the chat recaps, the webhook payload, search and MCP tools; a bell notification for the ROTI nudge; template defaults for "Max per card" ("Timer per phase" is SE-3, plan 22).

## Sessions and poker — plan 22

| Id | Feature | Mockup | Clears | Back end | Needs | Status |
|---|---|---|---|---|---|---|
| SE-1 | Sessions index page (upcoming, live, finished) | ScreenSessionCreate (page behind the dialog); ScreenDashboard | D-06 | No page lists the four session types together: one query across them, with a common summary | — | done, plan 22 (`ListTeamSessions`, the five kinds) |
| SE-2 | Scheduling ("Schedule…") and the "starts in 5 min" notification | ScreenSessionCreate; ScreenDashboard ("next retro") | D-06 | No scheduled date on a session; a scheduled notification | SE-1 | backlog (owner, 2026-10-02) |
| SE-3 | Advanced creation options: max per card, timer per phase and per task, re-vote after reveal, Jira import, write estimates to Jira | ScreenSessionCreate | D-07 | Per-phase and per-task durations; a revote flag on a poker game; import at creation (the import exists inside a game); the write-back field is a team integration setting today | RT-3 | done, plan 22 (max per card by plan 21; the phase durations are offered to the facilitator, never started by themselves; the import from every connected tracker) |
| PK-1 | Jira ticket details in the poker room: type, labels, acceptance criteria, description | ScreenPokerBefore | D-16 | A task stores its title, key and URL: the other fields at import and at refresh | SE-3 (import) | done, plan 22 (type and labels from Jira, Linear and GitHub; the criteria from the description's "Acceptance criteria" section) |

Not requested, staying backlog (spec `2026-10-21-plan-22-sessions-index-design.md` §3): scheduling (SE-2), the "ROTI at the end" switch, the invitation link inside the dialog, the poker CSV export and history filters, the spectator eye in presence, roles and expiry in the Share dialog.

## Team page, workspace and team settings — plan 23

| Id | Feature | Mockup | Clears | Back end | Needs | Status |
|---|---|---|---|---|---|---|
| TM-1 | Sprint, and the next retro of a team | ScreenDashboard, ScreenTeam | D-18, D-19 (sprint grouping) | No sprint entity | — (SE-2 is backlog; TM-1 does not need it) | done, plan 23 (explicit sprints with "Start the next sprint"; next retro from the sprints and the retro day; scheduling stays backlog) |
| TM-2 | Recent sessions table | ScreenDashboard | D-18 | The query of SE-1, limited to a team: `ListTeamSessions` (plan 22) | SE-1 | done, plan 23 (`ListRecentTeamSessions` on plan 22's state rules; game rooms listed too) |
| TM-3 | Aggregated open actions on the team page | ScreenDashboard | D-18 | The page has a count only: the first items, overdue first | — | done, plan 23 |
| TM-4 | Activity feed of a team, and the activity lines of a team tile | ScreenDashboard, ScreenWorkspace | D-18, D-24 | No activity log | — | done, plan 23 (no survey answers: a team survey is anonymous, P23-08) |
| TM-5 | Participant, card and action counts on a retro card | ScreenTeam | D-18 | Three counts per retro in the team page query | — | done, plan 23 |
| TM-6 | Member role in a team (owner, facilitator, member, observer) | ScreenTeam, ScreenSettings a | D-18 | `team_user` holds no role; policies read the workspace role | — | done, plan 23 ("Take control" of any open session for facilitators and owners; observers read-only) |
| TM-7 | Whiteboard thumbnails | ScreenTeam | D-18 | A preview exists for templates only: the same renderer on a board's elements, cached | — | done, plan 23 |
| WS-1 | Description of a workspace and of a team | ScreenWorkspace | D-24 | No description column | — | done, plan 23 (and the rename of a workspace; the slug stays) |
| WS-2 | Template usage and visibility | ScreenWorkspace (templates), TemplateEditor | D-24 | Usage is countable from `retros`; visibility (personal, team, workspace) has no column | — | done, plan 23 |
| WS-3 | Remaining team-settings tabs: Members & rituals, default facilitators and rotation, default template and columns, Data & export | ScreenSettings a | D-27 | None of these settings is stored | TM-6 | done, plan 23 (and the Sprints card; "Online" through the workspace presence channel) |

Not requested, staying backlog (spec `2026-10-21-plan-23-team-workspace-data-design.md` §3): scheduling and any automatic sprint start; team invitations, the invite link and the pending-invitation rows (plan 25); grouping action items by sprint (plan 24, on `SprintCalendar`); template defaults and poker template settings; a template description, "modified by …" and concurrent-edit detection in `TemplateEditor`; a team colour; "Online" anywhere but the members table of the team settings; live updates of the team page or the activity feed; an activity-log retention policy; activity lines for sprints and take-overs; survey answers in the feed; a workspace slug change; a take-over of a team survey; retro exports as PDF, CSV or Markdown and a team archive; plans 28 and 30.

## Action items — plan 24

| Id | Feature | Mockup | Clears | Back end | Needs | Status |
|---|---|---|---|---|---|---|
| AI-1 | Selection and the bulk bar (status, assign, due date, priority, sync, delete) | ScreenActions | D-19 | Every write is per item: batch endpoints with per-item authorisation | — | done, plan 24 (rows or every item matching the filters, up to 500; refusals per item; "Sync to :tracker" for rows of one team; long press and "Select" on a phone) |
| AI-2 | Filters by priority, due date and source | ScreenActions | D-19 | `ActionItemFilters` has status, assignee and team only | — | done, plan 24 (several statuses and priorities, a due-date bucket, a source; old `status` links mapped) |
| AI-3 | Status "In progress" | ScreenActions | D-19 | `ActionItemStatus` is open or completed, derived from `completed_at`; the tracker status sync maps to two states | — | done, plan 24 (`started_at`; synced both ways with Jira and Linear, "Start to" per project or team) |
| AI-4 | Export of the list | ScreenActions (topbar) | D-19 | No export route | AI-2 | done, plan 24 (CSV of every matching item) |

Grouping by sprint (on TM-1's sprints, the default) and the topbar search are plan 24's answers to P24-03 and P24-07 (its Tasks 20, 21, 23, 24). Not requested, staying backlog (spec `2026-10-21-plan-24-action-items-design.md` §3): the whiteboard and survey sources (WB-5, SV-1); a search of comments, sub-tasks or the retro's title, and of the sprint grouping by name; "all matching" beyond 500 items, a queued bulk change and exclusions from an "all matching" selection; "Sync to :tracker" for an "all matching" selection; bulk changes on the retro board; "In progress" on GitHub; a webhook event, a recap e-mail status and an MCP tool for "In progress"; export formats other than CSV, a "Download selection" action and an export of a retro; a server-side grouping by sprint.

## Invitations and onboarding — plan 25

| Id | Feature | Mockup | Clears | Back end | Needs | Status |
|---|---|---|---|---|---|---|
| IN-1 | Team invitations (invite to a team, with a role) | ScreenOnboarding (accept invitation), ScreenSettings a | D-30 | An invitation is to a workspace: a team and a team role on it | TM-6 | done, plan 25 (one team per invitation; the team's owners, member managers and facilitators invite, resend and revoke; the pending, expired and declined invitations in the team's Members card) |
| IN-2 | Inviter's message | ScreenOnboarding | D-30 | No message column | — | done, plan 25 (plain text in the card, the mail and the bell) |
| IN-3 | "Decline" | ScreenOnboarding | D-30 | No decline route or state; a notification to the inviter | — | done, plan 25 (the inviter is told in the bell only) |
| IN-4 | Team invite link (expiry; no use limit, decision 3 C) | ScreenTeam ("Invite"), ScreenSettings a | D-18 | No link-based invitation | IN-1 | done, plan 25 (one usable link per team, 7 days, the joins counted; it opens registration in `invite` mode) |
| ON-1 | Four-step onboarding (workspace, team, invite, first ritual) | ScreenOnboarding | D-33 | No onboarding state per user; `OnboardingLayout` exists and is unused | IN-1, IN-4 | done, plan 25 (each step saved; "Skip for now" on step 2 ends the onboarding, P25-03; a new SSO account joins the instance's default workspace and starts at step 2, P25-15; the team slug and `/t/<slug>`) |

Registration: "Create your workspace" with "Team name" when the account will start an onboarding — done, plan 25 (the team name waits on the onboarding row and prefills step 2; with an invitation or a link in the session the page keeps "Create your account").

Not requested, staying backlog: "already in n teams".

## Account and guests — plan 26

| Id | Feature | Mockup | Clears | Back end | Needs | Status |
|---|---|---|---|---|---|---|
| AC-1 | Photo upload | ScreenUserSettings | D-25 | Avatars are generated (DiceBear): a stored image and its serving, beside the generated one | — | done, plan 26 |
| AC-2 | Active sessions (list, sign out one, sign out others) | ScreenSecurity | D-25 | Needs the database session driver and a device description; the mockup's city needs a lookup the owner has not asked for | — | done, plan 26 |
| AC-3 | Linked accounts (link, unlink) | ScreenSecurity | D-25 | `social_accounts` exists and is written at sign-in only: link and unlink routes, with a "last sign-in method" guard, read against `sso_required` (B33) | — | done, plan 26 |
| AC-4 | Presence colour chosen by the user | ScreenUserSettings | D-25 | No page or channel received a colour: mail derived one from the avatar seed, the whiteboard hashed the member id in the browser, retro and poker cursors used the `live-cursors` palette (plan 26 spec §1.1) | — | done, plan 26 |
| AC-5 | "Reduce animations" on the account | ScreenUserSettings | D-25 | A user preference; the system setting is already respected | — | done, plan 26 |
| AC-6 | Breach check of a new password | ScreenSecurity | D-25 | `Password::defaults()` already set `uncompromised()` in production, through a 30-second outbound call that passes on failure; missing were the live line while typing and a way to turn the call off (plan 26 spec §1.1) | — | done, plan 26 |
| GU-1 | Colour picker on the guest-join page | GuestJoin | D-32 | Taken colours of the session, and a colour on the participant | AC-4 | done, plan 26 |
| GU-2 | Short session code (join by code) | GuestJoin | D-32 | Sessions are joined by a 40-character token: a short code and its entry page | — | done, plan 26 |

Not requested, staying backlog: other notification events, "last changed", "Change device", revoked-token rows; and from plan 26 spec §3: approximate location and "Unusual location" in Active sessions, listing sessions where they are not in the database, any confirmation for an account without a known password, a device model or browser version beyond "Firefox on macOS", the theme stored on the account, a guest changing name or colour after joining, a colour per session, the card-lock use of the colour, a `/s/{code}` short URL, server-side image resizing, animated or SVG photos, the "Print" button of recovery codes, deleting an account without a known password.

## Games — plan 27

| Id | Feature | Mockup | Clears | Back end | Needs |
|---|---|---|---|---|---|
| GM-1 | Settings card of a room (word theme, time per turn, auto hints, categories) — **done, plan 27** | ScreenIcebreaker, ScreenIcebreakerDraw, ScreenIcebreakerEmoji | D-20 | A room stores name, access, language and reactions only | — |
| GM-2 | Turn order and a number of rounds; hangman in turns and the whole-word guess — **done, plan 27** | ScreenIcebreaker, ScreenIcebreakerDraw | D-20 | Hangman has no turns and a room no round total | GM-1 |
| GM-3 | GIF captions and the podium — **done, plan 27** | ScreenIcebreakerGif | D-20 | An answer has no caption; one vote per player and no ranking | — |
| GM-4 | The four games the engine lacks (Two truths and a lie, Mood weather, Guess who, Quick question) — **done, plan 27** | ScreenIcebreaker (game picker) | D-20 | Four new `GameKind` cases with their rules classes, events and redaction | — |

Brought in by the owner's answers to plan 27's deviations (P27-04, P27-08, P27-14), built by plan 27 Tasks 28 to 31 (owner's deviation answers): the Draw & Guess extras ("found · time", "Found by n/m", points per finder, "New word", Redo), the duration and players on a game card, Decoded's list of puzzles. They are marked done when those tasks are merged.

Not requested, staying backlog (plan 27 spec §3): "needs n more players", the emoji riddle bank with timed hints and the "−20" hint, several finders in Decoded, "Pin to the retro", GIFs as video with a title.

## Administration and error pages — plan 29

| Id | Feature | Mockup | Clears | Back end | Needs | Status |
|---|---|---|---|---|---|---|
| AD-1 | Remaining admin sections (General, SSO configuration, SMTP, Integrations, MCP keys, Licence, Users, Audit log) | ScreenSettings b | D-35 | These are environment configuration today: settings stored in `instance_settings`, each with its own risk; best split into several specs | — | done, plan 29 |
| AD-2 | Version line (admin, error pages) | ScreenSettings b, ScreenErrors | D-31, D-35 | Corrected by the plan 29 spec (§1): `config('skrum.version')` (`SKRUM_VERSION`) existed and was shown on the About page, but the Docker build never set it, so every image said `1.0.0`; "up to date" needs a check the instance makes outward | — | done, plan 29 |
| AD-3 | Status page | ScreenErrors ("Instance status") | D-31 | No status page; `/up` is the framework health route | — | done, plan 29 |
| AD-4 | Access request on the 403 page | ScreenErrors | D-31 | No request model; a notification to the team's managers | TM-6 | done, plan 29 |
| AD-5 | Maintenance message and "Back at" | ScreenErrors (503) | D-31 | The 503 page is static and reads no database (B15): the message must come from `artisan down` options | — | done, plan 29 |

Not requested, staying backlog: the "Help" link.

## Mentions — plan 30

| Id | Feature | Mockup | Clears | Back end | Needs |
|---|---|---|---|---|---|
| MN-1 | Mentions of a person in a comment, and their notifications | the comment threads of the retro and action-item mockups; Emails README | none (no deviation row: the mockups of plan 18e's screens do not show it) | No mention parsing; a notification type and a preference row | plan 18f (bell); WB-2 if whiteboard comments are to be included |

## What stays backlog by the owner's word

Terms and privacy pages, the version in the login footer; export of a retro as PDF, CSV or Markdown; poker CSV export and history filters. Other elements marked "backlog" in the tables above were not in the owner's list either; they stay in spec §10 until asked for.

## Dependencies at a glance

```
SV-1 → SV-2 → SV-3 → SV-5          WB-1 → WB-2, WB-3
SV-1 → SV-4                         WB-1 + RT-8 → WB-5
RT-3 → SE-3 → PK-1                  RT-7 → RT-5
TM-1 → sprint grouping of action items  (plan 24; TM-1 needs no SE-2)
SE-1 → TM-2                         TM-6 → WS-3, IN-1, AD-4
IN-1 → IN-4 → ON-1                  AC-4 → GU-1
GM-1 → GM-2                         AI-2 → AI-4
plan 18f → MN-1
```
