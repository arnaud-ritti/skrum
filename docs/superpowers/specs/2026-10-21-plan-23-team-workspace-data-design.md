# Skrüm — Team and workspace data (roadmap plan 23) — Design

Date: 2026-10-03 (draft)
Status: Draft — the decisions of §15 are open. The body is written on the option marked **recommended**; nothing is built before the owner has answered §15.
Parent spec: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` (§5 rule 13 "rewrite first, features after", §6.1 domain folders, §9.2 back-end conventions).
Owner's word: `docs/superpowers/research/front-rewrite/owner-answers-2026-10-02.md` — third round ("Team page: sprint and next retro, recent sessions table, aggregated open actions, activity feed, per-retro counts, member role, whiteboard thumbnails"; "Workspace and team: descriptions, template usage and visibility, remaining team-settings tabs"), fourth round (D-51, D-73), fifth round (D-73, D-76, D-77, the roadmap change: plans 28 and 30 and scheduling are backlog; the working rules), sixth round (informal register; a guest counts as a participant).
Roadmap rows: TM-1 to TM-7 and WS-1 to WS-3 of `docs/superpowers/research/front-rewrite/feature-roadmap.md`.
Deviation rows cleared, wholly or in part: D-18, D-19 (sprint part: only the sprint data; the grouping stays plan 24's), D-24, D-27, D-77 (sprint labels), D-88 (team creation date), D-91 (whiteboard line, sprint), D-94 (visibility badge), D-100 (sprint in the header line), D-129 (role line of the user card) of plan 18e / 18g.
Mockups (binding for presentation): `docs/design-system/components/ScreenDashboard`, `ScreenTeam`, `ScreenWorkspace` (frames a to d), `ScreenSettings` (frame a), `TemplateEditor`, `Card` (`SessionCard`), `ActionItem`, `MoodTrendChart`, `Sidebar` (user card), `EmptyState`, `Table`, `Select`, `Badge` — the `README.md` and `preview.html` of each.
Database rules: `docs/database.md`, "Rules for database code" 1 to 12.
Sibling drafts read for names they expect from this plan: `.superpowers/sdd/roadmap/plan-22/spec.md` (`ListTeamSessions`, §6.1), `plan-24/spec.md` (sprint grouping), `plan-25/spec.md` (`App\Enums\TeamRole`, `team_user.role`, `TeamPolicy::manageMembers`, `teams.description`, the Members tab), `plan-29/spec.md` (access-request recipients).

What was read, and what was not: `main` at `18d3637e` (front rewrite, database portability, plan 19). Read: `Team`, `User`, `Workspace`, `WorkspaceMembership`, `WorkspaceTemplate`, `Retro`, `Card`, `Whiteboard`, `PokerPlayer`, `ActionItem`; the `team_user` and `workspace_templates` migrations; `TeamPolicy`, `WorkspacePolicy`; `TeamsController`, `TeamMembersController`, `WorkspacesController`, `WorkspaceTemplatesController`, `WorkspaceTemplateRequest`, `RecentSessionsController`, `Retros\RetroFacilitatorsController`, `Retros\CardVotesController`; the middlewares `ResolveRetroParticipant` and the four other `Resolve*`; `ResolveParticipant`, `Poker\ResolvePlayer`, `Whiteboards\ResolveMember`, `RetroGuard`, `CreateRetro`, `NewRetro`, `PresentTeamRetro`, `TopTeamTemplates`, `BuildTemplateCatalogue`, `ActionItemQuery`, `ActionItemPermissions`, `ActionItemActor`, `BuildTeamMoodTrend`, `BuildResults::participation`, `TeamSurvey::audienceCount`, `PresentWhiteboardPreview`, `PresentWhiteboardSummary`, `WriteWhiteboardElements`, `ReadWhiteboardScene`, `SetPokerSpectator`, `ListRecentSessions`, the domain events `ActionItemCompleted` and `RetroCompleted` and their webhook listeners, `HandleInertiaRequests` (`currentTeam`, `currentWorkspace`), the MCP tool list; `routes/web.php` (team, workspace and the five session scopes); on the front `components/teams/team-page.tsx` (its `TeamPageSlots`), `team-header.tsx`, `team-members-card.tsx`, `team-retros-section.tsx`, `team-whiteboards-section.tsx`, `team-settings-card.tsx`, `whiteboard-template-preview.tsx`, `components/integrations/team-settings-shell.tsx`, `lib/teams/settings-href.ts`, `components/workspaces/team-tile.tsx`, `workspace-overview.tsx`, `template-card.tsx`, `components/skrum/template-editor.tsx` (its `TemplateVisibility`), `skrum/session-card.tsx` (`stats`), `types/workspaces.ts`; `lang/*.json` for the keys that exist. Nothing was run. Every "Back end" line of the roadmap was checked against this code (§1).

## 1. Problem statement

The rewrite (plans 18e to 18g) left a place in the screens for every mockup element the server had no data for. For the team page, the workspace page and the team settings, those places are the TM and WS rows. Read against the code:

| Roadmap line | What the code says |
|---|---|
| TM-1 "No sprint entity" | True. No sprint anywhere; "next retro" needs a date, and scheduling (SE-2) moved to the backlog on 2026-10-02, so the roadmap's dependency on SE-2 cannot be met: the next retro has to come from somewhere else (§6.3). |
| TM-2 "The query of SE-1, limited to a team" | True. `ListRecentSessions` (plan 18f, the command palette) lists five sessions across teams with `kind`, `title`, `url`, `updatedAt`, `live`, no participant count and no surveys. Plan 22's draft defines `ListTeamSessions` (SE-1) with a state per kind and says plan 23 calls it with a limit. |
| TM-3 "The page has a count only" | True: `openActionItemCount`. `ActionItemQuery::order` already sorts overdue first (the stored `sort_rank` is the due date). |
| TM-4 "No activity log" | True. The workspace tile already shows three activity lines (D-91); its "n whiteboards edited today" is derivable from `whiteboards.updated_at`, which every element write touches (`WriteWhiteboardElements` updates `seq`). |
| TM-5 "Three counts per retro in the team page query" | True; plus the "groups" count the mockup shows on a voting retro, and `SessionCard` has no `groups` stat. |
| TM-6 "`team_user` holds no role; policies read the workspace role" | True: `team_user` is `(team_id, user_id, timestamps)`; every `TeamPolicy` method is `canManage(workspace)` or `view`. |
| TM-7 "A preview exists for templates only" | True: `PresentWhiteboardPreview` turns elements into outlines for the template gallery, stored in `whiteboard_templates.preview`. A board has none. |
| WS-1 "No description column" | True for teams and workspaces. A workspace cannot even be renamed today. |
| WS-2 "Usage is countable; visibility has no column" | Usage is **already built** (`usageCount` on the templates page, D-94). Visibility has no column; templates are created by workspace managers only. `TemplateEditor` already draws the visibility control when its draft carries one. |
| WS-3 "None of these settings is stored" | True. The team settings have two entries today, "Team" (an anchor to a card on the team page) and "Integrations" (owner 10-D4). |

## 2. Goals

1. A team has roles: owner, facilitator, member, observer. They decide who manages the team, who sets its rituals, who takes part in sessions and who only watches.
2. A team has a sprint rhythm and a retro day, from which the team page, the trend and the session headers name the current sprint and the next retro.
3. The team page shows what the mockup shows: the current sprint and next retro, the recent sessions table, the open action items (overdue first), the activity feed, the counts of each retro card, the role of each member and a thumbnail of each whiteboard.
4. Teams and workspaces have a description; templates have a visibility (personal, team, workspace).
5. The team settings have the four tabs of the mockup: General, Members & rituals, Integrations, Data & export.
6. Every existing feature keeps working for every existing user: a member keeps every right they have today (owner's rule: existing features kept).
7. Database code is Eloquent and the standard query builder only and runs unchanged on PostgreSQL, MySQL, MariaDB and SQLite; every test that touches the database passes on the four.

## 3. Non-goals

Backlog, by the owner's word or because no row asks for it:

- **Scheduling** (owner, 2026-10-02): no scheduled session, no "starts in 5 min" notification, no scheduled start time on a session. The next retro of §6.3 is a date computed from the team's rhythm, shown only.
- Team invitations, the invite link, "Invitation link", "Invite", "Resend" and the pending-invitation rows of the Members card: plan 25 (IN-1 to IN-4). This plan leaves their places.
- Grouping action items by sprint: plan 24 (it reads §6.3's calendar).
- The Sessions index page (SE-1): plan 22.
- Template defaults (votes per person, max per card, anonymous cards, timer per phase in `TemplateEditor`) and poker template settings: backlog (D-24 as written).
- A template description, a "modified by … 2 days ago" line and concurrent-edit detection in `TemplateEditor`: no reader in the mockups for the first, no row for the others.
- A team colour (the coral mark of ScreenTeam), "Online" in the last-activity column (no presence outside a session, D-91), live updates of the team page or the activity feed, an activity-log retention policy.
- Survey answers in the activity feed ("Nadia K answered the survey…"): a team survey is anonymous (plan 19 spec §6.3); the line is a deviation (P23-08).
- Renaming a workspace (only its description is added).
- Exporting a retro as PDF, CSV or Markdown (owner: backlog).
- Plans 28 (whiteboard collaboration) and 30 (mentions): backlog; no place is reserved.

## 4. Decisions already taken

| Topic | Decision | Source |
|---|---|---|
| Presentation | The mockup wins; an element with no data is omitted, listed, its place left | parent spec §5 rule 13 |
| `/dashboard` | Redirects to the current team page; ScreenDashboard's content lives on the team page | owner 4-D1 |
| Existing features | Kept for every user | owner's standing rule |
| Simple data | Added when a mockup element needs it | owner's standing rule |
| Team settings navigation | A sub-navigation of the team settings (10-D4); this plan extends it to the mockup's four tabs | owner 10-D4, roadmap WS-3 |
| Gear "Team settings" | In the team header, hidden for who can change nothing | owner D-73 |
| Members card on the team page | Avatars, confirmation on removal, "Retirer" | owner 4-D4, 4-D5, fifth round |
| Trend on the team page | The ROTI curve alone, main column | owner D-77 |
| Guests | A guest counts as a participant | owner, sixth round |
| Register | Informal everywhere: French "tu", Spanish "tú", German "du"; English unchanged | owner, sixth round |
| Scheduling, plans 28 and 30 | Backlog | owner, 2026-10-02 |
| Database | Eloquent and the standard query builder only; four engines | owner; `docs/database.md` |
| Tests | Unit, feature, upgrade, arch and concurrency tests written and run per task on PostgreSQL and SQLite, all four engines for data migrations and races, the whole suites at merges; no browser walkthrough; captures in light, 1440, French | owner, working rules |

## 5. Rules and vocabulary

The front rules of the parent spec §5 apply to every front file (tokens, rem, Tailwind scale, no overflow from 20rem to 60rem, focus, contrast, reduced motion, lucide, literal `t('…')`, presentational `skrum/` components). The back-end conventions of its §9.2 apply (actions in `app/Actions/<Domain>`, one controller per resource with CRUD names, `Gate::authorize`, events sent to others only, UUID keys, `up`-only migrations). `docs/database.md` rules 1 to 12 apply to every query, migration and test. Migrations are dated `2026_10_23_…` so that they sort after plan 19 and never collide with the dates the sibling drafts chose (plan 24 `2026_10_21_…`, plan 25 `2026_10_25_…`); the plan re-dates them if a plan merged before uses the same day.

| Term | Meaning |
|---|---|
| team role | `App\Enums\TeamRole`: `owner`, `facilitator`, `member`, `observer`, stored on `team_user.role` |
| manager | A workspace owner or admin (`User::canManage`). A manager is never restricted by a team role. |
| team owner | A member whose team role is `owner` |
| ritual settings | The sprint rhythm and retro day (§6.3), the default facilitators and rotation (§6.4), the default retro template (§6.5) |
| sprint | A numbered period of a team, derived from its rhythm (§6.3); there is no sprint row |
| activity | A row of `team_activities` (§6.7): one thing a person did in the team, worth a line on the team page |
| session | A retro, a poker game, a whiteboard, a standalone team survey or a standalone game room of a team (plan 22's word) |

## 6. Domain and data

### 6.1 Team roles (TM-6)

- `team_user.role`: `string(20)`, not null, default `member`. Every existing row reads `member` after the migration (§11).
- `App\Enums\TeamRole` (`Owner`, `Facilitator`, `Member`, `Observer`) with `label()`, `managesTeam()` (owner), `managesRituals()` (owner, facilitator), `contributes()` (every role but observer) and `options()`.
- `App\Models\TeamMembership`, the pivot model of `team_user` (as `WorkspaceMembership` is of `workspace_user`), casting `role`. `Team::members()` and `User::teams()` use it, `as('membership')`, `withPivot('role')`.
- `Team::roleOf(User): ?TeamRole`; `User::isObserverOf(Team)`, `User::managesTeam(Team)`, `User::managesRitualsOf(Team)`. A manager answers false, true, true whatever their pivot row says.
- A person added to a team gets `member` unless the adder chooses another role. A team needs no owner: managers always manage it. Creating a team does not add its creator (as today).
- Removing a member, or changing their role to `member` or `observer`, removes them from the team's default facilitators (§6.4).

What each role may do is §7.

### 6.2 Descriptions (WS-1)

- `teams.description` and `workspaces.description`: `string(200)`, nullable. Trimmed; an empty value is stored as null.
- A team's description is edited on the General tab (§9.2) and read on the workspace tiles (§9.5) and the header of the team settings. A workspace's description is edited and read on the workspace page (§9.5, decision 7).

### 6.3 Sprint rhythm and next retro (TM-1)

Columns on `teams` (all nullable; null means "no rhythm"):

| Column | Type | Meaning |
|---|---|---|
| `sprint_length_weeks` | unsigned tiny integer | 1 to 4 |
| `sprint_anchor_number` | unsigned integer | the number of a known sprint, 1 to 9999 |
| `sprint_anchor_starts_on` | date (`DateOnly`) | the first day of that sprint |
| `retro_weekday` | unsigned tiny integer | ISO weekday of the retro, 1 (Monday) to 7 |
| `retro_time` | `string(5)` | `HH:MM`, 24-hour, optional |

The three `sprint_*` columns are set together or not at all. `retro_weekday` needs them; `retro_time` needs `retro_weekday`.

`App\Support\Teams\SprintCalendar` (pure PHP, no database), built from a team, or null when the team has no rhythm. Dates are days in the application's time zone (`config('app.timezone')`, as action items' "today").

- `numberOn(date)`: `anchor + floor(days(anchorStart → date) ÷ (7 × length))`, null when below 1.
- `sprintOn(date)`: `{number, startsOn, endsOn}` (the end is the start plus `7 × length − 1` days), null when the number is null.
- `nextRetro(now)`: null without a retro weekday. Else, in the sprint of today, the **last** day of that weekday; if that day is before today, or is today and `retro_time` is set and already past, the same day of the next sprint. Returns `{date, time}` (`time` null when not set).
- Label: "Sprint 42" in sentences, "S42" on the trend axis.

Readers: the team header (current sprint and next retro), the ROTI trend labels of the team page (D-77: each point labelled by the sprint of its retro), the session header line of a retro ("Atlas · Sprint 42", D-100), the workspace tile's "Retro live now · Sprint 42" (D-91), the prefilled name of a new retro ("Sprint 42 retro", ScreenSessionCreate), and plan 24's grouping. **The sprint of a session is the sprint of the day it was created.** Changing the rhythm relabels past sessions (decision 1).

### 6.4 Default facilitators and rotation (WS-3)

- `team_facilitators`: `team_id` (cascade), `user_id` (cascade), `position`, timestamps; primary key `(team_id, user_id)`. `Team::defaultFacilitators()`, ordered by position.
- `teams.facilitator_rotation_enabled` (boolean, default false) and `teams.rotation_position` (unsigned integer, default 0).
- The list holds 0 to 10 members whose team role is owner or facilitator.
- **At retro creation**, when the rotation is on and the list is not empty, the retro's facilitator is `list[rotation_position mod count]` and `rotation_position` grows by one; the creator is an ordinary participant. When the rotation is off, the creator facilitates, as today (decision 4). Creation locks the team row first, so two retros created at once take two consecutive people.
- Changing the list resets `rotation_position` to 0.
- "Next: Inès · retro of 2 Oct" = the person at the current position and the date of §6.3.

### 6.5 Default retro template and default columns (WS-3)

- `teams.default_retro_template`: `string(80)`, nullable, a catalogue key (a built-in key or `workspace:<uuid>`), validated as available to the team and to the person who sets it (§6.6).
- The "New session" dialog preselects it for a retro when it is still available to the viewer; otherwise it falls back to today's choice silently.
- The card "Retro templates" lists the team's top templates (`TopTeamTemplates`, five) plus the default when it is not among them, each with the team's usage ("Used 6×", "Never used"): for a workspace template a `withCount` of the team's retros, for a built-in one count of the team's retros with that key (at most six `count()` queries).
- The card "Default columns · template X" shows the default template's columns. They are editable in place when the viewer may edit that template (§6.6); saving goes through the existing template update. A built-in template, or one the viewer may not edit, is read-only with "Duplicate as a team template", which creates a team template with the same columns and makes it the default (decision 5).

### 6.6 Template visibility (WS-2)

- `workspace_templates.visibility`: `string(20)`, not null, default `workspace`; `workspace_templates.team_id`: nullable, cascade. Existing rows read `workspace` (§11). `App\Enums\TemplateVisibility` (`Personal`, `Team`, `Workspace`).
- A `team` template has a `team_id`; the others have none.

| Visibility | Who sees and uses it | Who creates it | Who edits or deletes it |
|---|---|---|---|
| workspace | every member of the workspace | managers | managers |
| team | the members of its team, and managers | managers, the team's owners and facilitators | the same |
| personal | its creator; managers when the creator's account is gone | any member of the workspace | its creator; managers when the creator's account is gone |

- The templates page lists what the viewer sees, with a visibility badge (D-94). "New template" is offered to every workspace member (personal at least); the editor's "Workspace" choice is disabled for a non-manager (`canShareWorkspace`) and "Team" lists the teams the viewer may create team templates for.
- The catalogue of the "New session" dialog for team T: workspace templates, T's team templates, the viewer's personal templates, then the built-ins. `TeamRetrosController` and `CreateRetro` refuse a template the creator cannot see.
- The limit of 100 templates per workspace and name uniqueness per workspace (`name_key`) are unchanged: two personal templates of two people cannot share a name (risk §14).
- A visibility change by its editor is limited to the visibilities they may create. Retros already created from a template are not affected (9-D7).

### 6.7 Activity log (TM-4)

`team_activities`: `id` (UUID), `team_id` (cascade), `kind` (`string(40)`), `actor_user_id` (nullable, null on delete), `actor_name` (`string(100)`, nullable: a guest's name, or the tracker for an inbound sync), `subject_id` (UUID, nullable, no foreign key), `subject_title` (`string(200)`), timestamps; index `(team_id, created_at)`. `App\Enums\TeamActivityKind`.

| Kind | Written by, in the same transaction as the change | Actor | Subject | Line |
|---|---|---|---|---|
| `retro_started` | `CreateRetro` | the creator | the retro | ":actor started the retrospective :title" |
| `retro_completed` | `ChangeRetroPhase` entering `completed` | the facilitator | the retro | ":actor closed the retrospective :title" |
| `poker_started` | `CreatePokerGame` | the creator | the game | ":actor started the planning poker :title" |
| `poker_ended` | `PokerStatusesController` ending the game | who ended it | the game | ":actor ended the planning poker :title" |
| `whiteboard_created` | `CreateWhiteboard` | the creator | the board | ":actor created the whiteboard :title" |
| `survey_published` | `TeamSurveyStatusesController` draft → open (standalone only) | the editor | the survey | ":actor published the survey :title" |
| `survey_closed` | the same, → closed (standalone only) | the editor | the survey | ":actor closed the survey :title" |
| `action_item_completed` | `SetActionItemStatus` → completed | the user; a guest's name; the tracker's name for an inbound sync | the item | ":actor completed :title" |
| `member_joined` | `TeamMembersController@store` (a new member) | the new member | none | ":actor joined the team" |

Never written: anything about cards, votes, comments, reactions, health checks or survey answers (anonymity of retros and surveys), presence, deletions. The team page reads the last 10 rows (newest first, `id` as tie-breaker). The link of a line is built when read; a subject that no longer exists keeps its stored title without a link. A deleted account shows "Former member".

### 6.8 Whiteboard thumbnails (TM-7)

- `whiteboards.preview` (JSON, nullable, no database default, cast `array`) and `whiteboards.preview_seq` (unsigned integer, nullable).
- `App\Jobs\RefreshWhiteboardPreview` (queued, unique per board for two minutes): reads the board's live elements in canvas order, runs `PresentWhiteboardPreview` (the template gallery's renderer, text drawn as bars, no words), stores `preview` and `preview_seq = seq`, without touching `updated_at` (it is the "edited" date of §6.9).
- Dispatched after commit, delayed 30 s, by every element write that advanced `seq`, by board creation with a non-empty scene, and by the team page for any board whose `preview_seq` differs from its `seq` (this covers boards that existed before the release: no backfill).
- The team page sends `preview` (or null while none is built); the card draws it on the dot-grid paper; an empty board shows the paper alone.

### 6.9 Read without new storage

- **Recent sessions (TM-2):** the five most recently active sessions of the team, any state, live ones first, then by last activity (`updated_at` descending, `id` descending). Each row: kind, title, URL, state (live, finished, upcoming; plan 22 §6.1 rules), date, participants (retro: participants; poker: players who are not spectators; whiteboard: members; survey: respondents with an answer; game room: players), the outcome of a finished one (retro: ":count actions"; survey: ":count answers"; poker: ":count estimated") and the kind's meta line. Drafts appear for their editors only, as on the team page. Built by `ListTeamSessions` of plan 22 with a limit when it exists (decision 9).
- **Open actions (TM-3):** the team's first five open action items in `ActionItemQuery::order` (overdue first), presented by `PresentActionItem`; the count of open and of overdue ones; "See all" leads to the action items page filtered on the team.
- **Retro counts (TM-5):** per retro of the team page, `withCount` of participants, cards, groups (top-level cards with children) and action items.
- **Last activity of a member:** the latest `updated_at` among the member's participant, poker player, whiteboard member, game player and survey respondent rows in the team's sessions (`withMax` per relation, the maximum in PHP), null when none.
- **Workspace tile (TM-4):** the second line becomes "n whiteboards edited today" when the team has no active poker game and at least one board was updated today; the live retro line reads "Retro live now · Sprint 42" when the team has a rhythm, the retro's title otherwise.

## 7. Permissions

Managers (workspace owners and admins) can do everything on every team of their workspace, whatever their pivot row. Guests (session cookies, no account) are not team members: nothing here changes what they can do.

| Ability | Manager | Owner | Facilitator | Member | Observer |
|---|---|---|---|---|---|
| View the team page and its sessions | yes | yes | yes | yes | yes |
| Create a session (retro, poker, whiteboard, survey, game room) | yes | yes | yes | yes | **no** |
| Take part in a session (write, vote, answer, play) | yes | yes | yes | yes | **no** (§7.1) |
| Facilitate a session they created or were handed | yes | yes | yes | yes | only one they already facilitated before becoming observer |
| Create, comment on, complete action items | as today | as today | as today | as today | **no** |
| Rename the team, its description, health statements | yes | yes | no | no | no |
| Add and remove members, change roles | yes | yes | no | no | no |
| Ritual settings (rhythm, retro day, facilitators, rotation, default template) | yes | yes | yes | no | no |
| Integrations of the team | yes | yes | no | no | no |
| Delete the team | yes | no | no | no | no |
| Team templates of this team | yes | yes | yes | no | no |
| Personal templates | yes | yes | yes | yes | yes |
| See the team settings | General, Members & rituals, Integrations, Data | the four | Members & rituals (read-only members) | — | — |

Decision 2 is what owners and facilitators may do; decision 3 is how far the observer's read-only goes. The table is written on their recommended options.

`TeamPolicy`: `update`, `manageMembers` and `manageIntegrations` become `managesTeam`; `manageRituals` is new (`managesRitualsOf`); the five `create*` abilities add "not an observer"; `view` and `delete` are unchanged. `WorkspacePolicy::update` (new) is `canManage`, for the workspace description. Plan 25 reads `manageMembers` as "who may invite to a team"; plan 29 can send access requests to the team's owners and facilitators.

### 7.1 The observer

- One middleware, `RefuseObserverWrites`, added after the participant middleware of each of the five session scopes (`retros/{retro}`, `poker/{game}`, `whiteboards/{board}`, `games/{room}`, `surveys/{teamSurvey}`): a request that is not a read (`GET`, `HEAD`, `OPTIONS`), by a signed-in observer of the session's team, is refused with 403 "Observers can follow this session but not take part.", unless that person is the session's facilitator (host for a game room, editor for a survey).
- Poker: an observer joins as a spectator; an existing player who becomes an observer is made a spectator when they next open the game (`SetPokerSpectator`, which withdraws their open votes).
- Each session snapshot carries `viewerIsObserver`; the screens render read-only (§9.7).
- Action items: `ActionItemPermissions` refuses an observer creation, comments and completion, on every surface (retro, action items page, MCP).
- MCP: every write tool refuses an observer of the team concerned with the same message.
- Participation (session-end statistics, survey audience): observers count neither among those who joined nor among those expected.

## 8. Real time

No new channel and no new event. Role and settings changes apply at the next request of the person concerned; an open board that becomes read-only for a new observer learns it at its next snapshot (any `settings.changed`, reconnect or reload). The activity feed and the recent sessions table are read when the team page loads, like the rest of the page.

## 9. Screens

Each screen follows its mockup. "Omitted" means: not built, place left, row of the plan's pre-build deviations. Where no mockup exists, the screen is designed from the neighbours named, and the plan puts the design to the owner before it is built (owner's rule of the fifth round).

### 9.1 Team page — `teams/show`

Mockups: ScreenTeam (layout, header, sections, right column), ScreenDashboard (recent sessions, open actions, activity, the header meta line). The page keeps the structure of plan 18e; the slots of `TeamPageSlots` are filled.

- **Header** (slot `schedule`): at the end of the meta line, "Sprint 42" and "Next retro Thu 2 Oct, 2 pm" (calendar icon), or "Next retro Thu 2 Oct" without a time; nothing when the team has no rhythm. For who may set rituals and has no rhythm yet: a ghost link "Set the sprint rhythm" to the Members & rituals tab.
- **Recent sessions** (slot `recentSessions`, first block of the main column): a `Table` with Session (kind icon in the kind's colour, title, meta line), Date ("Today", "18 Sep"), Participants, Status (a live session: badge "Live" and a "Join" button; a finished one: "Ended" and the outcome; a draft: "Draft"), and "All sessions" in the header, leading to plan 22's Sessions page when it exists, else to `#sessions`. Below 40rem the rows become cards (title, meta, status). Empty: the block is not rendered (the sections below have their own empty states).
- **Retro cards** (slot `retroStatsFor`): Writing and Grouping: ":count joined", ":count cards"; Voting, Discussing, Actions, ROTI: plus ":count groups"; Completed: participants without a unit, ":count cards", ":count action items". `SessionCard.stats` gains `groups`.
- **Whiteboard cards** (slot `whiteboardThumbnailFor`): the 6.5rem thumbnail of §6.8 above the name; dot-grid paper while no preview exists.
- **Open actions** (slot `openActions`, first block of the side column): "Open action items" with the count and ":count overdue" (warning badge), the sentence "Gathered from every session of the team · overdue first.", up to five `ActionItem` rows (title, assignee avatar, priority, due date with the late style and alarm icon, ticket key, source retro), "See all". Empty: "No open action items." Hidden when the team has none and the viewer may not create one.
- **Activity** (slot `activity`, last block of the main column): up to ten lines: the actor's avatar (initials for a guest or a tracker), the sentence of §6.7 with the subject as a link, the relative time. Empty: "Nothing has happened in this team yet."
- **Members card** (slot `roleBadgeFor`): the role as text after the email ("Facilitator"), as in ScreenTeam; for an owner or manager the role is a `Select` in the add-member form ("Add as"); changing a role happens on the Members & rituals tab. The slot `inviteAction` stays empty (plan 25).
- **The settings card** (`#settings`, rename and delete) leaves the team page: it moves to the General tab (§9.2). The gear and the sidebar entry "Team settings" lead to General for who manages the team, to Members & rituals for a facilitator, and are hidden for others.

States: no rhythm; rhythm without retro day; a viewer who is an observer (the "New session" button is disabled with "Observers cannot start sessions."); every block empty (new team); a deferred trend still loading (unchanged).

### 9.2 Team settings — General — `teams/settings`

Mockup: ScreenSettings frame a (header and tabs; no frame for this tab). Designed from the header of the mockup and the existing `TeamSettingsCard`.

- `TeamSettingsShell` with the four tabs of the mockup: General, Members & rituals, Integrations (when a provider is enabled and the viewer may manage integrations), Data & export. Header: team mark, name, the line "description · :count members · created in :month :year" (D-88).
- One card "Team": Name (required, 100), Description (optional, 200, "Shown on the workspace page."), "Save" (explicit, owner 10-D6).
- A danger zone card with "Delete team", for managers only (the existing confirmation).

States: saved (toast), validation error per field, a viewer who may only read (403: the page is for who manages the team).

### 9.3 Team settings — Members & rituals — `teams/members`

Mockup: ScreenSettings frame a, tab "Members & rituals".

- **Members** card: header ":count members"; the places of "Invitation link" and "Invite" are left (plan 25). `Table`: Member (avatar, name, "(you)", email), Role (a `Select` with the four roles for an owner or manager; text otherwise), Last activity (relative, "Never" when null), and the row menu with "Remove from team" (confirmation, "Retirer"). Footer: "Facilitator: drives phases, timer and reveal. Observer: read-only, does not vote." Below 40rem the table becomes a list and the role opens in a `Drawer`.
- **Sprint & retro day** card (no mockup: P23-01): sprint length (1 to 4 weeks, segmented), "Sprint number" and "Starts on" (date picker) of a known sprint, retro day (weekday select, optional) and time (optional), a preview line "Sprint 42 runs from 21 Sep to 4 Oct · next retro Thu 1 Oct, 2 pm", "Save", and "Remove the rhythm".
- **Default facilitators** card: removable chips of the list (avatar, first name), "Add" (a menu of owners and facilitators not in the list), the switch "Rotate at every retro" with "Next: :name · retro of :date" (or "Next: :name" without a retro day). Saves on each change.
- **Retro templates** card: radio list (template name, "Default" badge, column colour strip, "Used :count×" / "Never used"), "Create" (opens the template editor in a sheet with visibility Team and this team), "Browse" (the catalogue picker of the dialog). Choosing a radio saves the default.
- **Default columns** card: "Default columns · template :name": the columns as reorderable rows with the colour picker of the eight colours (Soleil, Abricot, Corail, Prune, Iris, Ciel, Lagon, Mousse), editable as §6.5, "Save"; read-only with "Duplicate as a team template" otherwise.

States: a facilitator (members read-only, rituals editable); an owner; no rhythm; rotation on with an empty list (the switch disabled, "Add a facilitator first."); default template no longer available ("This template is no longer available. Choose another."); saving; errors per field.

### 9.4 Team settings — Data & export — `teams/data`

No mockup content (the tab only). Designed from the settings cards (P23-02), decision 8 option A:

- "Exports" card, one row per export that exists, each with a short sentence and a link or button: "Survey results (CSV)" with the closed standalone surveys of the team and their CSV (plan 19's route); "Estimates" to the estimation history (`teams.estimates.index`); "Action items" with the place of plan 24's export (AI-4) left.
- "What is kept" card: one paragraph saying that deleting the team deletes its sessions, action items and settings, and that guests' names live only in the sessions they joined.

States: no closed survey ("No closed survey yet."); viewer without the right (403).

### 9.5 Workspace page — `workspaces/show`

Mockup: ScreenWorkspace frames a, b.

- Header: under "3 teams · 24 members · you're an admin", the workspace description in muted text, and for a manager an "Edit description" ghost button opening a small dialog (textarea, 200, "Save") (decision 7; no mockup for the edit: P23-03).
- Team tiles: the description under the name (slot `teamDescriptionFor`); the second activity line of §6.9; "Retro live now · Sprint 42".

States: no description (nothing rendered; a manager sees "Add a description" instead of "Edit description").

### 9.6 Templates page and editor — `workspaces/templates`, `TemplateEditor`

Mockups: ScreenWorkspace frames c, d; TemplateEditor.

- Retro template cards: the visibility badge beside the name (slot of `templates-page.tsx`): "Personal" (`user` icon), "Team · Atlas" (`users`), "Workspace" (`building-2`), outline badge.
- "New template" for every workspace member. The editor shows Visibility (segmented: Personal, Team, Workspace with its help line); "Workspace" disabled for a non-manager with the reason; "Team" followed by a team `Select` when the viewer may create for more than one team.
- The editor's other fields are unchanged.

States: a member (personal only, or team for an owner or facilitator); a manager (all three); a template the viewer may not edit (no menu, as today).

### 9.7 Sessions for an observer

No mockup (P23-04): each session screen renders its existing read-only mode.

- Retro: the board as when it is locked for this viewer (no composer, no vote buttons, no reactions, no ROTI or health-check submission), with an info line under the header "You follow this retrospective as an observer.".
- Poker: the spectator view of plan 18e (the "Watch only" switch shown on and disabled).
- Whiteboard: read mode (7-D7), without "Modifier".
- Game room: the room without the input controls, with the same info line.
- Team survey: the questions read-only with "Observers do not answer surveys."; results as for any member.

### 9.8 Other places

- "New session" dialog, retro form: the name is prefilled "Sprint 42 retro" when the team has a rhythm; with the rotation on, a line under the settings: "Facilitated by :name (rotation)." (P23-05).
- Sidebar user card (D-129): the second line reads "<team role> · <workspace role>" for the current team ("Facilitator · Admin"), the workspace role alone when the user is not in the current team.
- Retro session header: "Atlas · Sprint 42" when the team has a rhythm (D-100), unchanged otherwise.
- Team page ROTI card: x labels "S35"… and "since S35" when every point has a sprint, the day otherwise (D-77).

## 10. Routes, validation, transactions

Team scope (prefix `w/{workspace}`, `can:view,workspace`, scoped bindings):

| Route | Name | Controller | Authorisation |
|---|---|---|---|
| `PATCH teams/{team}` | `teams.update` (exists) | `TeamsController@update` | `update`; body gains `description` |
| `GET teams/{team}/settings` | `teams.settings.show` | `TeamSettingsController@show` | `update` |
| `GET teams/{team}/members` | `teams.members.index` | `TeamMembersController@index` | `manageRituals` |
| `POST teams/{team}/members` | `teams.members.store` (exists) | `TeamMembersController@store` | `manageMembers`; body gains `role` (default `member`) |
| `PUT teams/{team}/members/{member}/role` | `teams.members.role.update` | `TeamMemberRolesController@update` | `manageMembers` |
| `PUT teams/{team}/sprint-rhythm` | `teams.sprintRhythm.update` | `TeamSprintRhythmsController@update` | `manageRituals` |
| `DELETE teams/{team}/sprint-rhythm` | `teams.sprintRhythm.destroy` | `TeamSprintRhythmsController@destroy` | `manageRituals` |
| `PUT teams/{team}/facilitators` | `teams.facilitators.update` | `TeamFacilitatorsController@update` | `manageRituals` |
| `PUT teams/{team}/default-retro-template` | `teams.defaultRetroTemplate.update` | `TeamDefaultRetroTemplatesController@update` | `manageRituals` |
| `GET teams/{team}/data` | `teams.data.show` | `TeamDataController@show` | `update` |
| `PUT description` | `workspaces.description.update` | `WorkspaceDescriptionsController@update` | `update` on the workspace |
| `POST|PATCH|DELETE templates…` | exist | `WorkspaceTemplatesController` | per §6.6 (a new `WorkspaceTemplatePolicy`) |

Validation, in Form Requests with array rules: `description` nullable, string, max 200; `role` `Rule::enum(TeamRole::class)`; rhythm: `sprint_length_weeks` integer 1–4, `sprint_anchor_number` integer 1–9999, `sprint_anchor_starts_on` date `Y-m-d`, `retro_weekday` nullable integer 1–7, `retro_time` nullable `date_format:H:i` and prohibited without `retro_weekday`; facilitators: `user_ids` array max 10, distinct, each a member of the team with role owner or facilitator; `rotation` boolean, accepted only with at least one facilitator; default template: a key available to the team and the person (§6.6); template: `visibility` enum, `team_id` required with `team` and prohibited otherwise, a team the person may create team templates for.

Transactions lock the aggregate root first: the team row for the facilitators, the rotation and a retro creation that rotates; the workspace row for template creation and renaming (as today); the template row on update.

## 11. Migrations of existing data

| Migration | Existing rows | Proof |
|---|---|---|
| `add_role_to_team_user_table` | every membership reads `member` (column default) | Upgrade test, four engines |
| `add_descriptions_to_teams_and_workspaces` | null | none needed |
| `add_rituals_to_teams_table` | no rhythm, rotation off, position 0 | none needed |
| `add_default_retro_template_to_teams_table` | no default template: the dialog chooses as today | none needed |
| `create_team_facilitators_table` | empty | none needed |
| `add_visibility_to_workspace_templates_table` | every template reads `workspace`, `team_id` null: visible as today | Upgrade test, four engines |
| `create_team_activities_table` | empty: the feed starts at the release (no backfill: nothing records who did what before) | none needed |
| `add_preview_to_whiteboards_table` | null; built lazily (§6.8) | feature test of the lazy build |

No existing member becomes owner (decision 2): managers keep managing every team as today, and no person loses or gains a right on the day of the upgrade.

## 12. Testing

- Every test touching the database runs per task on PostgreSQL and SQLite (`bin/test-db pgsql -- <paths>`, `bin/test-db sqlite -- <paths>`); the Upgrade tests and the races run on the four engines (`mariadb`, `mysql` too; races on `sqlite-file`); the whole suites run on the four engines at each merge and at the end.
- Pest feature tests for every route, policy and role (the matrix of §7 walked as a dataset), the observer middleware on each of the five scopes (refused write, allowed read, facilitator exception, manager exception, guest unaffected), the poker spectator switch, action item permissions and MCP refusals, participation without observers.
- Unit tests for `SprintCalendar` with hand-computed dates (anchor, before the anchor, sprint boundaries, next retro on the day before, the day of, after the time, a one-week rhythm).
- Races (`tests/Concurrency`, `Race`): two retros created at once with rotation on take two consecutive facilitators; saving the facilitator list twice at once leaves one consistent list.
- Upgrade tests (`tests/Upgrade`) for the two migrations of existing rows.
- Vitest for the pure logic (sprint formatting, role labels, activity sentence, session row state labels) and for each new or changed component.
- No browser walkthrough is written or run. Captures in light, 1440, French of: the team page, the three new settings tabs, the workspace page, the templates page with badges and the editor with visibility, a retro seen by an observer.

## 13. Acceptance criteria

1. After the migration every existing team membership has the role `member`, every existing template the visibility `workspace`; nobody gains or loses a right (the feature tests of today's permissions pass unchanged).
2. An owner or a manager changes a member's role on the Members & rituals tab; a facilitator, a member and an observer get 403; a non-member target gets 404; an unknown role gets 422.
3. A team owner who is not a manager can rename the team, change its description, add and remove members, change roles, manage health statements and integrations, and cannot delete the team.
4. A facilitator can change the ritual settings and nothing of §7 marked owner.
5. An observer gets 403 on every non-read request of the five session scopes of a team session, sees each session read-only, cannot create a session, an action item, a comment or a completion (web and MCP), and is not counted in participation; a manager whose pivot row says observer is not restricted; a guest is unaffected; an observer who facilitated a session before keeps facilitating it.
6. An observer opening a poker game becomes a spectator and loses their unrevealed votes.
7. With a two-week rhythm whose sprint 40 starts on Monday 2026-08-24 and a retro on Thursday at 14:00, on Wednesday 2026-09-30 the team page shows "Sprint 42" (21 Sep to 4 Oct) and "Next retro Thu 1 Oct, 2 pm"; on Thursday 2026-10-01 at 15:00 it shows the next retro on Thursday 2026-10-15 (the last Thursday of sprint 43); on Sunday 2026-08-23 it shows sprint 39.
8. The ROTI trend labels its points "S41"… by the sprint of each retro's creation; the retro header reads "team · Sprint 42"; the workspace tile reads "Retro live now · Sprint 42"; a new retro is prefilled "Sprint 42 retro".
9. With the rotation on over [Camille, Inès], three retros created in a row are facilitated by Camille, Inès, Camille; two created at once get Camille and Inès; with the rotation off the creator facilitates.
10. Removing a facilitator from the team or making them a member removes them from the list; the list refuses a member or observer, more than ten people and duplicates.
11. The default retro template is preselected in the "New session" dialog; a template no longer available is ignored; "Used :count×" counts the team's retros only.
12. A member creates a personal template that nobody else sees; an owner or facilitator creates a team template that the team's members see and other teams do not; only a manager creates a workspace template; `TeamRetrosController` refuses a template the creator cannot see; the templates page shows the badge.
13. The activity feed shows the nine kinds of §6.7, newest first, at most ten, with links to subjects that still exist, and never a line about a card, a vote, a comment, a reaction, a health check or a survey answer.
14. The recent sessions table shows at most five sessions of the team, live first, with participants, date, state and outcome; a draft survey only to its editors.
15. The open actions block shows at most five open items, overdue first, with the counts of open and overdue items.
16. A retro card shows the counts of its phase (joined, cards, groups, action items).
17. A whiteboard card shows a thumbnail built from its elements within a minute of an edit, without moving its "edited" date; a board edited before the release gets one the first time the team page is opened after a queue run.
18. A team's description shows on its workspace tile and in the team settings header; a manager edits the workspace description; a member cannot (403).
19. The team settings have General, Members & rituals, Integrations (when enabled) and Data & export, each reachable by who may see it and refused (403) to others; the settings card is no longer on the team page.
20. The sidebar user card shows the team role and the workspace role.
21. Every new string exists in the four languages, informal in French, Spanish and German (`InformalRegisterTest`, `TranslationKeysTest`); the captures of §12 are taken without horizontal overflow and compared with their mockups, each difference fixed or a row of the plan's deviations.
22. The unit, feature, upgrade and arch suites pass on PostgreSQL, SQLite, MariaDB and MySQL, the concurrency suite on PostgreSQL, MariaDB, MySQL and a SQLite file; `tests/Arch/DatabasePortabilityTest.php` passes.

## 14. Risks

- **Roles touch every policy.** A wrong `TeamPolicy` method could take a right away from today's members or give one to observers. The matrix of §7 is a dataset test run against every ability, and today's permission tests run unchanged before the observer task lands.
- **The observer middleware is broad.** It refuses every non-read request of a session scope; a read implemented as `POST` (a search, a preview) would be refused. The plan lists the non-GET routes of the five scopes and checks each.
- **`as('membership')` on `Team::members()`.** Code reading `->pivot` on team members breaks. The plan greps for it before the change.
- **Relabelled history.** Changing the sprint rhythm renumbers past sessions (decision 1); the Members & rituals card says so under "Save".
- **Name uniqueness and personal templates.** Two people cannot both have a personal template called "Our retro"; the second gets "A template with this name already exists." without seeing the first. Accepted for now (§6.6).
- **Lazy previews on the team page.** The first visit after the release dispatches one job per board without a preview; the job is unique per board and reads at most 5 000 elements (`Whiteboard::MaxLiveElements`). On SQLite, one writer at a time: the jobs queue behind requests.
- **Shared files with plans 22, 24, 25, 29.** `ListTeamSessions` (plan 22), `ActionItemPermissions` and `PresentActionItem` (plan 24), `TeamMembersController`, `TeamPolicy` and the Members tab (plan 25), access-request recipients (plan 29). Whichever runs second rebases; migration dates are spaced (§5).
- **Translations of roles.** "Facilitator" is "Moderation" in German today (`lang/de.json`), which reads as the activity, not the person; the plan's translation task decides it with the glossary of `translations-review.md`.
- **No live updates on the team page.** The activity feed and the counts are as fresh as the last load.

## 15. Decisions for the owner

The body is written on the option marked **recommended**.

**1. What is a sprint?**
- A. **Recommended.** A rhythm on the team: length (1–4 weeks) and the number and start date of one known sprint; every date maps to a sprint by arithmetic; the retro day and time are part of the rhythm and give the next retro. Simple data, five columns, no screen to manage sprints. Cost: changing the rhythm renumbers past sessions, and an irregular sprint (holidays) is only fixed by moving the anchor.
- B. Explicit sprints: a `sprints` table (number or name, start, end) managed on the Members & rituals tab with "Start the next sprint"; history never moves. About three more tasks and a screen the mockups do not draw.
- C. No sprint: TM-1 shows the next retro only (from a retro day), and the sprint labels (trend, headers, plan 24's grouping) stay deviations.

**2. What do owners and facilitators get?**
- A. **Recommended.** Owner: everything a manager can do on the team except deleting it (name, description, members and roles, health statements, integrations, rituals, team templates). Facilitator: the ritual settings and team templates, and a place in the rotation; session facilitation is unchanged (the creator, or whoever is handed the session). Member: exactly today's rights. No existing member becomes owner at the upgrade.
- B. As A, and a facilitator may also take over the facilitation of any open session of the team (a "Take over" entry in each session's menu). Closer to "drives phases, timer and reveal" for every session; one more task per session type.
- C. As A, but an owner does not manage integrations (secrets and OAuth stay with managers).

**3. How far does "observer: read-only, does not vote" go?**
- A. **Recommended.** Read-only everywhere in the team: the five session types (server-refused writes, read-only screens), no session creation, no action item writes, MCP writes refused, not counted in participation. Faithful to the mockup's sentence; about four tasks.
- B. Votes only: an observer cannot vote (retro votes, ROTI, poker cards, survey answers, health check) but can write cards and comments. Smaller, but "read-only" becomes false.
- C. A label only in this plan; no enforcement until a later plan.

**4. What do the default facilitators do?**
- A. **Recommended.** They feed the rotation only: with "Rotate at every retro" on, each new retro is facilitated by the next person of the list (the creator joins as a participant); with it off, the creator facilitates, as today.
- B. With the rotation off, the first person of the list facilitates every new retro.
- C. A proposal only: the "New session" dialog gains a "Facilitator" select prefilled from the list (no automatic assignment); the select has no mockup.

**5. What does "Default columns" edit?**
- A. **Recommended.** The columns of the team's default template, in place, when the viewer may edit that template; for a built-in or a template they cannot edit, "Duplicate as a team template" (which becomes the default). One source of columns, the template.
- B. Columns stored on the team that override the template's columns for every new retro, whatever template is chosen. Two places define columns; a template's preview no longer says what a retro gets.
- C. Read-only preview of the default template's columns, no editing on this tab.

**6. Who may create templates, and who sees personal ones?**
- A. **Recommended.** Personal: any workspace member, seen by its creator only (managers only once the creator's account is gone); team: managers and the team's owners and facilitators; workspace: managers. "New template" is offered to every member.
- B. Only managers create templates (as today), choosing any visibility for them; members never create one.
- C. As A, and managers also see and may delete every personal template (moderation), the editor's help line changing to "Only you and the workspace admins can see this template.".

**7. Where does the workspace description live?**
- A. **Recommended.** Under the facts line of the workspace page header, edited by managers in a small dialog ("Edit description"). No mockup draws it; the team description is the one the mockups show.
- B. As A, and the dialog also renames the workspace (rename does not exist today).
- C. Team descriptions only; the workspace description is not built (no place in the mockups).

**8. What goes in "Data & export"?**
- A. **Recommended.** The exports that exist or are planned (survey CSVs of the team, the estimates history, the place of plan 24's action items export) and a paragraph on what deleting the team removes. No new export.
- B. A full team archive (one JSON file: sessions, cards, action items, survey results, redacted as an owner sees them). About three tasks; overlaps the retro export the owner put in the backlog.
- C. The tab is not built; D-27 stays for it.

**9. The recent sessions table and plan 22.**
- A. **Recommended.** Plan 22 runs first (the roadmap's order) and its `ListTeamSessions` gives the rows; plan 23's task adds the participant count and the outcome and calls it with a limit of five.
- B. Plan 23 runs first and builds the team-limited list itself with plan 22's state rules; plan 22 then grows it into the paginated Sessions page.
- C. TM-2 moves into plan 22.

Not decisions, but to confirm with the pre-build deviations: the Sprint & retro day card, the Data & export content, the workspace description dialog, the observer screens and the rotation line of the dialog have no mockup and are designed from their neighbours (P23-01 to P23-05).

## 16. Not determined by reading

1. Whether any code reads `->pivot` on team members (the switch to `as('membership')` would break it); the plan greps first.
2. Which non-GET routes of the five session scopes are reads in disguise (the observer middleware would refuse them).
3. Whether the queue runs on every install (a database queue is configured; an instance without a worker never builds thumbnails, the cards then show the paper alone).
4. Plan 22's exact `ListTeamSessions` signature (its plan is not written yet): decision 9.
5. Whether the retro board's "locked" rendering covers every write control (composer, votes, reactions, ROTI, health-check button, survey answers) once driven by `viewerIsObserver` instead of `isLocked`.
6. How the session snapshots of poker, whiteboard and games name their viewer block (where `viewerIsObserver` goes): the plan reads each builder.
7. The German word for the facilitator role (today "Moderation").
