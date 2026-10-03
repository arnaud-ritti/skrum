# Skrüm — Team and workspace data (roadmap plan 23) — Design

Date: 2026-10-03 (draft, revised the same day with the owner's answers)
Status: Built (2026-10-04, branch `plan-23-team-workspace-data`; the deviation rows P23-01 to P23-16 approved by the owner on 2026-10-03, and P23-17 to P23-19, found when the captures were compared with the mockups, to approve: see the plan's **Mockup comparison**). Approved for building — the nine decisions of §15 are **answered** (owner, 2026-10-03). Four answers differ from the option the first draft was written on (decisions 1, 2, 4, 7); the body below is rewritten on the chosen options. The pre-build deviations (P23-01 to P23-16 of the plan) are **answered** too (owner, 2026-10-03, §15.2): P23-04 as recommended with a "You are observing" line; P23-07 against the recommendation — a new app-wide presence channel gives "Online" in the members table (§6.11); P23-01 and P23-05 obsolete (settled by decisions 1 B and 4 C); every other row approved as listed. Nothing waits for the owner.
Parent spec: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` (§5 rule 13 "rewrite first, features after", §6.1 domain folders, §9.2 back-end conventions).
Owner's word: `docs/superpowers/research/front-rewrite/owner-answers-2026-10-02.md` — third round ("Team page: sprint and next retro, recent sessions table, aggregated open actions, activity feed, per-retro counts, member role, whiteboard thumbnails"; "Workspace and team: descriptions, template usage and visibility, remaining team-settings tabs"), fourth round (D-51, D-73), fifth round (D-73, D-76, D-77, the roadmap change: plans 28 and 30 and scheduling are backlog; the working rules), sixth round (informal register; a guest counts as a participant); the answers of 2026-10-03 to §15 (`.superpowers/sdd/roadmap/progress.md`, "Owner answers 2026-10-03", line "Plan 23").
Roadmap rows: TM-1 to TM-7 and WS-1 to WS-3 of `docs/superpowers/research/front-rewrite/feature-roadmap.md`.
Deviation rows cleared, wholly or in part: D-18, D-19 (sprint part: only the sprint data; the grouping stays a later plan's), D-24, D-27, D-77 (sprint labels), D-88 (team creation date), D-91 (whiteboard line, sprint), D-94 (visibility badge), D-100 (sprint in the header line), D-129 (role line of the user card) of plan 18e / 18g.
Mockups (binding for presentation): `docs/design-system/components/ScreenDashboard`, `ScreenTeam`, `ScreenWorkspace` (frames a to d), `ScreenSettings` (frame a), `ScreenSessionCreate`, `TemplateEditor`, `Card` (`SessionCard`), `ActionItem`, `MoodTrendChart`, `Sidebar` (user card), `EmptyState`, `Table`, `Select`, `Badge` — the `README.md` and `preview.html` of each.
Database rules: `docs/database.md`, "Rules for database code" 1 to 12.
Sibling specs read for names they expect from this plan: `docs/superpowers/specs/2026-10-21-plan-22-sessions-index-design.md` (`ListTeamSessions`, `PresentNewSessionOptions`, §6.1), `2026-10-21-plan-24-action-items-design.md` (its "By sprint" grouping, answer P24-03, reads this plan's sprints: plan 24 runs after this plan), `2026-10-21-plan-25-invitations-onboarding-design.md` (`App\Enums\TeamRole`, `team_user.role`, `TeamPolicy::manageMembers`, `teams.description`, the Members tab, the General tab that takes the team slug), `2026-10-21-plan-29-administration-errors-design.md` (access-request recipients).

Execution order (owner, 2026-10-03, updated with the pre-build deviation answers): plans 20, 21, 26, 27 and 29 in parallel, then plan 22, then **this plan**, then plans 24 and 25. This plan therefore runs on the integration branch `roadmap` holding plan 22 (`ListTeamSessions`, `PresentNewSessionOptions`, the Sessions page) and plan 29 (`AccessRequestRecipients`); plan 24 is **not** merged yet: `ActionItemPermissions`, `PresentActionItem` and the action items page are read as they are today, and plan 24 rebases on this plan (its "By sprint" grouping uses `SprintCalendar`).

What was read, and what was not: `main` at `18d3637e` (front rewrite, database portability, plan 19), and, for the revision, `0c294632`. Read: `Team`, `User`, `Workspace` (`#[RouteKey('slug')]`, fillable `name`, `slug`), `WorkspaceMembership`, `WorkspaceTemplate`, `Retro`, `Card`, `Whiteboard`, `PokerPlayer`, `GameRoom` (`isHost`, `isCreator`, `isManager`), `TeamSurvey` (`facilitator`, `isEditor`), `ActionItem`; the `team_user` and `workspace_templates` migrations; `TeamPolicy`, `WorkspacePolicy`; `TeamsController`, `TeamMembersController`, `TeamRetrosController` (`store` and its validation), `WorkspacesController` (`store`, `show`), `WorkspaceTemplatesController`, `WorkspaceTemplateRequest`, `RecentSessionsController`, the four hand-over controllers `Retros\RetroFacilitatorsController`, `Poker\PokerFacilitatorsController`, `Whiteboards\WhiteboardFacilitatorsController`, `Games\GameHostsController`, `Retros\CardVotesController`; `GameGuard`; the middlewares `ResolveRetroParticipant` and the four other `Resolve*`; `ResolveParticipant`, `Poker\ResolvePlayer`, `Whiteboards\ResolveMember`, `RetroGuard`, `CreateRetro`, `NewRetro`, `PresentTeamRetro`, `TopTeamTemplates`, `BuildTemplateCatalogue`, `BuildBoardSnapshot` (its `viewer` block), `BuildPokerSnapshot` and `BuildWhiteboardSnapshot` (`canTakeControl`), `BuildGameSnapshot` (`canBecomeHost`), `ActionItemQuery`, `ActionItemPermissions`, `ActionItemActor`, `BuildTeamMoodTrend`, `BuildResults::participation`, `TeamSurvey::audienceCount`, `PresentWhiteboardPreview`, `PresentWhiteboardSummary`, `WriteWhiteboardElements`, `ReadWhiteboardScene`, `SetPokerSpectator`, `ListRecentSessions`, the domain events `ActionItemCompleted` and `RetroCompleted` and their webhook listeners, `HandleInertiaRequests` (`currentTeam`, `currentWorkspace`), the MCP tool list; `routes/web.php` (team, workspace and the five session scopes); on the front `components/teams/team-page.tsx` (its `TeamPageSlots`), `team-header.tsx`, `team-members-card.tsx`, `team-retros-section.tsx`, `team-whiteboards-section.tsx`, `team-settings-card.tsx`, `whiteboard-template-preview.tsx`, `components/integrations/team-settings-shell.tsx`, `lib/teams/settings-href.ts`, `components/workspaces/team-tile.tsx`, `workspace-overview.tsx`, `template-card.tsx`, `components/skrum/template-editor.tsx` (its `TemplateVisibility`), `skrum/session-card.tsx` (`stats`), `components/poker/room-topbar.tsx` and `components/whiteboard/board-menu.tsx` ("Take control"), `components/games/room-menu.tsx` (`canBecomeHost`), `types/workspaces.ts`; `lang/*.json` for the keys that exist. Nothing was run. Every "Back end" line of the roadmap was checked against this code (§1).

## 1. Problem statement

The rewrite (plans 18e to 18g) left a place in the screens for every mockup element the server had no data for. For the team page, the workspace page and the team settings, those places are the TM and WS rows. Read against the code:

| Roadmap line | What the code says |
|---|---|
| TM-1 "No sprint entity" | True. No sprint anywhere; "next retro" needs a date, and scheduling (SE-2) moved to the backlog on 2026-10-02, so the roadmap's dependency on SE-2 cannot be met: the next retro comes from the team's sprints and retro day (§6.3). |
| TM-2 "The query of SE-1, limited to a team" | True. `ListRecentSessions` (plan 18f, the command palette) lists five sessions across teams with `kind`, `title`, `url`, `updatedAt`, `live`, no participant count and no surveys. Plan 22 (merged before this plan) gives `ListTeamSessions` (SE-1) with a state per kind; this plan reads the team's five most recent sessions with plan 22's state rules. |
| TM-3 "The page has a count only" | True: `openActionItemCount`. `ActionItemQuery::order` already sorts overdue first (the stored `sort_rank` is the due date). |
| TM-4 "No activity log" | True. The workspace tile already shows three activity lines (D-91); its "n whiteboards edited today" is derivable from `whiteboards.updated_at`, which every element write touches (`WriteWhiteboardElements` updates `seq`). |
| TM-5 "Three counts per retro in the team page query" | True; plus the "groups" count the mockup shows on a voting retro, and `SessionCard` has no `groups` stat. |
| TM-6 "`team_user` holds no role; policies read the workspace role" | True: `team_user` is `(team_id, user_id, timestamps)`; every `TeamPolicy` method is `canManage(workspace)` or `view`. Taking control of a session exists today for poker and whiteboards (any non-guest team member), for game rooms (the creator and workspace admins), and not for retros (only the facilitator hands over). |
| TM-7 "A preview exists for templates only" | True: `PresentWhiteboardPreview` turns elements into outlines for the template gallery, stored in `whiteboard_templates.preview`. A board has none. |
| WS-1 "No description column" | True for teams and workspaces. A workspace cannot be renamed today (only its name at creation); its URL uses its slug (`#[RouteKey('slug')]`). |
| WS-2 "Usage is countable; visibility has no column" | Usage is **already built** (`usageCount` on the templates page, D-94). Visibility has no column; templates are created by workspace managers only. `TemplateEditor` already draws the visibility control when its draft carries one. |
| WS-3 "None of these settings is stored" | True. The team settings have two entries today, "Team" (an anchor to a card on the team page) and "Integrations" (owner 10-D4). |

## 2. Goals

1. A team has roles: owner, facilitator, member, observer. They decide who manages the team, who sets its rituals and may take control of its sessions, who takes part in sessions and who only watches.
2. A team has explicit sprints (numbered rows with a start and an end, started one after the other with "Start the next sprint") and a retro day, from which the team page, the trend and the session headers name the current sprint and the next retro.
3. The team page and the team settings show what the mockups show — on the team page the current sprint and next retro, the recent sessions table, the open action items (overdue first), the activity feed, the counts of each retro card, the role of each member and a thumbnail of each whiteboard; in the members table of the settings, "Online" for who has the application open (§6.11).
4. Teams and workspaces have a description; a workspace can be renamed; templates have a visibility (personal, team, workspace).
5. The team settings have the four tabs of the mockup: General, Members & rituals, Integrations, Data & export.
6. Every existing feature keeps working for every existing user: a member keeps every right they have today (owner's rule: existing features kept).
7. Database code is Eloquent and the standard query builder only and runs unchanged on PostgreSQL, MySQL, MariaDB and SQLite. This plan verifies on PostgreSQL; the four-engine matrix runs once, after the last plan of the roadmap is merged (owner, 2026-10-03), and must pass there.

## 3. Non-goals

Backlog, by the owner's word or because no row asks for it:

- **Scheduling** (owner, 2026-10-02): no scheduled session, no "starts in 5 min" notification, no scheduled start time on a session. The next retro of §6.3 is a date computed from the team's sprints and retro day, shown only.
- Starting a sprint automatically at a date: a sprint starts when someone presses "Start the next sprint" or when its stored start date arrives; nothing runs on a schedule.
- Team invitations, the invite link, "Invitation link", "Invite", "Resend" and the pending-invitation rows of the Members card: plan 25 (IN-1 to IN-4). This plan leaves their places.
- Grouping action items by sprint: plan 24 builds it ("By sprint", its default grouping, answer P24-03) after this plan; `SprintCalendar::forTeam` and `sprintOn` are the readers it uses.
- The Sessions index page (SE-1): plan 22, merged before this plan.
- Template defaults (votes per person, max per card, anonymous cards, timer per phase in `TemplateEditor`) and poker template settings: backlog (D-24 as written).
- A template description, a "modified by … 2 days ago" line and concurrent-edit detection in `TemplateEditor`: no reader in the mockups for the first, no row for the others.
- A team colour (the coral mark of ScreenTeam), "Online" anywhere but the members table of the team settings (§6.11: not on the team page's Members card, the tiles or the sidebar), live updates of the team page or the activity feed, an activity-log retention policy, an activity line for sprints or for a take-over.
- Survey answers in the activity feed ("Nadia K answered the survey…"): a team survey is anonymous (plan 19 spec §6.3); the line is a deviation (P23-08).
- Changing a workspace's slug (its address): a rename keeps the slug, so every link stays valid.
- Taking over the editing of a team survey: a survey has editors (its creator and workspace admins), not a live facilitator; "Take control" is for the four session kinds that have one (§6.10).
- Exporting a retro as PDF, CSV or Markdown, a team archive (owner: decision 8 option A).
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
| Order of plans | 20, 21, 26, 27, 29 → 22 → **23** → 24 and 25 | owner, 2026-10-03 |
| Pre-build deviations P23-01 to P23-16 | Answered (§15.2) | owner, 2026-10-03 |
| §15 decisions 1 to 9 | Answered: 1 B, 2 B, 3 A, 4 C, 5 A, 6 A, 7 B, 8 A, 9 A | owner, 2026-10-03 |
| Database | Eloquent and the standard query builder only; four engines | owner; `docs/database.md` |
| Tests | Unit, feature, upgrade, arch and concurrency tests written and run per task on PostgreSQL, the whole PostgreSQL suites at merges; the four-engine matrix (PostgreSQL, SQLite, MariaDB, MySQL) once, after the roadmap's last merge, the risk of finding an engine-specific regression late accepted; no browser walkthrough; captures in light, 1440, French | owner, working rules; owner, 2026-10-03 ("Lance les 4 bases seulement à la fin") |

## 5. Rules and vocabulary

The front rules of the parent spec §5 apply to every front file (tokens, rem, Tailwind scale, no overflow from 20rem to 60rem, focus, contrast, reduced motion, lucide, literal `t('…')`, presentational `skrum/` components). The back-end conventions of its §9.2 apply (actions in `app/Actions/<Domain>`, one controller per resource with CRUD names, `Gate::authorize`, events sent to others only, UUID keys, `up`-only migrations). `docs/database.md` rules 1 to 12 apply to every query, migration and test. Migrations are dated `2026_10_23_…` so that they sort after plans 19, 21, 22 and 24 and never collide with the dates the sibling plans chose (plan 21 `2026_10_21_…`, plan 22 `2026_10_22_…`, plan 25 `2026_10_25_…`); the plan re-dates them if a plan merged before uses the same day.

| Term | Meaning |
|---|---|
| team role | `App\Enums\TeamRole`: `owner`, `facilitator`, `member`, `observer`, stored on `team_user.role` |
| manager | A workspace owner or admin (`User::canManage`). A manager is never restricted by a team role. |
| team owner | A member whose team role is `owner` |
| ritual settings | The team's sprints, default sprint length, retro day and time (§6.3), the default facilitators and rotation (§6.4), the default retro template (§6.5) |
| sprint | A row of `team_sprints` (§6.3): a team's numbered period with a first and a last day |
| current sprint | The sprint whose days contain today (application time zone); none between two sprints |
| suggested facilitator | The person the "New session" dialog preselects as a retro's facilitator (§6.4); a suggestion, never an assignment |
| take control | A team facilitator, owner or manager makes themselves the facilitator (host for a game room) of an open session of the team (§6.10) |
| activity | A row of `team_activities` (§6.7): one thing a person did in the team, worth a line on the team page |
| session | A retro, a poker game, a whiteboard, a standalone team survey or a standalone game room of a team (plan 22's word) |

## 6. Domain and data

### 6.1 Team roles (TM-6)

- `team_user.role`: `string(20)`, not null, default `member`. Every existing row reads `member` after the migration (§11).
- `App\Enums\TeamRole` (`Owner`, `Facilitator`, `Member`, `Observer`) with `label()`, `managesTeam()` (owner), `managesRituals()` (owner, facilitator), `contributes()` (every role but observer) and `options()`.
- `App\Models\TeamMembership`, the pivot model of `team_user` (as `WorkspaceMembership` is of `workspace_user`), casting `role`. `Team::members()` and `User::teams()` use it, `as('teamMembership')`, `withPivot('role')`.
- `Team::roleOf(User): ?TeamRole`; `User::isObserverOf(Team)`, `User::managesTeam(Team)`, `User::managesRitualsOf(Team)`. A manager answers false, true, true whatever their pivot row says.
- A person added to a team gets `member` unless the adder chooses another role. A team needs no owner: managers always manage it. Creating a team does not add its creator (as today).
- Removing a member, or changing their role to `member` or `observer`, removes them from the team's default facilitators (§6.4).

What each role may do is §7.

### 6.2 Descriptions and the workspace name (WS-1)

- `teams.description` and `workspaces.description`: `string(200)`, nullable. Trimmed; an empty value is stored as null.
- A team's description is edited on the General tab (§9.2) and read on the workspace tiles (§9.5) and the header of the team settings.
- A workspace's **name and description** are edited together in one small dialog of the workspace page, by managers (§9.5, decision 7 B). The name is required, at most 100 characters (the rule of workspace creation); the **slug never changes** on a rename, so the workspace's URLs, bookmarks and invitation links stay valid. The new name reaches the sidebar switcher and the shared `currentWorkspace` at the next request.

### 6.3 Sprints and next retro (TM-1, decision 1 B)

**`team_sprints`** (new):

| Column | Type | Meaning |
|---|---|---|
| `id` | UUID | |
| `team_id` | foreign UUID, cascade on delete | |
| `number` | unsigned integer | 1 to 9999, unique per team (`team_sprints_team_id_number_unique`) |
| `starts_on` | date (`DateOnly`) | first day |
| `ends_on` | date (`DateOnly`) | last day, on or after `starts_on`, at most 55 days after it (8 weeks) |
| timestamps | | |

Index `(team_id, starts_on)`. `App\Models\TeamSprint` (+ factory), `Team::sprints()` ordered by `starts_on` then `id`.

**Columns on `teams`** (all nullable unless said; null means "not set"):

| Column | Type | Meaning |
|---|---|---|
| `sprint_length_weeks` | unsigned tiny integer | 1 to 4: the length "Start the next sprint" gives; null reads 2 |
| `retro_weekday` | unsigned tiny integer | ISO weekday of the retro, 1 (Monday) to 7 |
| `retro_time` | `string(5)` | `HH:MM`, 24-hour, optional; needs `retro_weekday` |
| `facilitator_rotation_enabled` | boolean, default false | §6.4 |
| `rotation_position` | unsigned integer, default 0 | §6.4 |

**Rules of the sprint rows** (checked under the team row's lock, §10):

1. Two sprints of a team never share a day: a sprint whose days overlap another sprint's of the same team is refused ("This sprint overlaps Sprint :number (:start – :end).").
2. Two sprints of a team never share a number.
3. **Start the next sprint** (one button): under the team row's lock, with `today` in the application's time zone and `length = sprint_length_weeks ?? 2`:
   - refused when a sprint starts today ("Sprint :number already starts today.") or when a sprint starts after today ("Sprint :number is already planned from :date.");
   - when a sprint contains today (it started before today), its `ends_on` becomes yesterday;
   - a new sprint is created: number = the team's highest number + 1 (1 for the first), `starts_on` = today, `ends_on` = today + 7 × length − 1 days.
4. Adding a sprint by hand (number, first day, last day) plans one ahead or records one in the past; editing changes its number or days; deleting removes the row only. Sessions are never written: their sprint is read from the dates (rule 5), so editing a sprint's days relabels the sessions created in those days and nothing else ("history never moves" unless someone edits that sprint).
5. **The sprint of a session is the sprint containing the day it was created** (application time zone); none when it was created between two sprints.

**`App\Support\Teams\SprintCalendar`**, built from a team's rows for a window of days (`SprintCalendar::forTeam(Team, from, to)` reads the sprints that overlap the window: a bounded set) or from given rows (pure, for unit tests). Dates are days in the application's time zone (`config('app.timezone')`, as action items' "today").

- `sprintOn(date)`: `{id, number, startsOn, endsOn}` of the sprint containing the day, or null.
- `numberOn(date)`, `shortLabelOn(date)` ("S42"): from `sprintOn`, null outside every sprint.
- `nextRetro(now)`: null without a retro weekday. Else, among the sprints that end today or later (at most two are read: the current one and the next), in order, the **last** day of that weekday within the sprint's days; a day before today, or today with `retro_time` set and already past, is skipped; the first left is returned as `{date, time}` (`time` null when not set). Null when none is left (the next sprint is not started or planned yet).
- Label: "Sprint 42" in sentences, "S42" on the trend axis.

Readers: the team header (current sprint and next retro), the ROTI trend labels of the team page (D-77: each point labelled by the sprint of its retro), the session header line of a retro ("Atlas · Sprint 42", D-100), the workspace tile's "Retro live now · Sprint 42" (D-91), the prefilled name of a new retro ("Sprint 42 retro", ScreenSessionCreate), and later the grouping of action items by sprint (D-19).

### 6.4 Default facilitators: a suggestion (WS-3, decision 4 C)

- `team_facilitators`: `team_id` (cascade), `user_id` (cascade), `position`, timestamps; primary key `(team_id, user_id)`. `Team::defaultFacilitators()`, ordered by position.
- The list holds 0 to 10 members whose team role is owner or facilitator.
- **The list never assigns anyone.** The "New session" dialog's retro form has a **Facilitator** select (no mockup; P23-05 obsolete, the owner's decision 4 C asked for it), preselected with the **suggested facilitator**:
  - the rotation on and the list not empty: `list[rotation_position mod count]`;
  - the rotation off and the list not empty: the first person of the list;
  - an empty list: the person creating the retro.
  The person creating the retro may choose anyone of the select: the members of the team who take part (owner, facilitator, member: not observers), and themselves. The server accepts any person who may take part in the team's sessions (`TeamPolicy::createRetro` for that person), the creator by default when nothing is posted.
- The chosen person becomes the retro's facilitator participant; the creator is an ordinary participant (as when the facilitation is handed over today).
- **The rotation moves only when it is followed:** a retro created with the rotation on and with the suggested facilitator chosen moves `rotation_position` by one, under the team row's lock; a retro created with someone else leaves it, so the suggested person stays next. Two retros created at once that both chose the same suggested person move the position once (the second, under the lock, no longer sees that person as the suggestion).
- Changing the list resets `rotation_position` to 0.
- "Next: Inès · retro of 2 Oct" = the suggested facilitator (rotation on) and the date of §6.3.

### 6.5 Default retro template and default columns (WS-3, decision 5 A)

- `teams.default_retro_template`: `string(80)`, nullable, a catalogue key (a built-in key or `workspace:<uuid>`), validated as available to the team and to the person who sets it (§6.6); a personal template cannot be the default.
- The "New session" dialog preselects it for a retro when it is still available to the viewer; otherwise it falls back to today's choice silently.
- The card "Retro templates" lists the team's top templates (`TopTeamTemplates`, five) plus the default when it is not among them, each with the team's usage ("Used 6×", "Never used"): for a workspace template a `withCount` of the team's retros, for a built-in one count of the team's retros with that key (at most six `count()` queries).
- The card "Default columns · template X" shows the default template's columns. They are editable in place when the viewer may edit that template (§6.6); saving goes through the existing template update. A built-in template, or one the viewer may not edit, is read-only with "Duplicate as a team template", which creates a team template with the same columns and makes it the default.

### 6.6 Template visibility (WS-2, decision 6 A)

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

Never written: anything about cards, votes, comments, reactions, health checks or survey answers (anonymity of retros and surveys), presence, deletions, sprints, take-overs. The team page reads the last 10 rows (newest first, `id` as tie-breaker). The link of a line is built when read; a subject that no longer exists keeps its stored title without a link. A deleted account shows "Former member".

### 6.8 Whiteboard thumbnails (TM-7)

- `whiteboards.preview` (JSON, nullable, no database default, cast `array`) and `whiteboards.preview_seq` (unsigned integer, nullable).
- `App\Jobs\RefreshWhiteboardPreview` (queued, unique per board for two minutes): reads the board's live elements in canvas order, runs `PresentWhiteboardPreview` (the template gallery's renderer, text drawn as bars, no words), stores `preview` and `preview_seq = seq`, without touching `updated_at` (it is the "edited" date of §6.9).
- Dispatched after commit, delayed 30 s, by every element write that advanced `seq`, by board creation with a non-empty scene, and by the team page for any board whose `preview_seq` differs from its `seq` (this covers boards that existed before the release: no backfill).
- The team page sends `preview` (or null while none is built); the card draws it on the dot-grid paper; an empty board shows the paper alone.

### 6.9 Read without new storage

- **Recent sessions (TM-2, decision 9 A):** the five most recently active sessions of the team, any state, live ones first, then by last activity (`updated_at` descending, `id` descending). Each row: kind, title, URL, state (live, finished, upcoming; plan 22 §6.1 rules), date, participants (retro: participants; poker: players who are not spectators; whiteboard: members; survey: respondents with an answer; game room: players), the outcome of a finished one (retro: ":count actions"; survey: ":count answers"; poker: ":count estimated") and the kind's meta line. Drafts appear for their editors only, as on the team page. The states are plan 22's: `ListRecentTeamSessions` reuses `ListTeamSessions`'s rules (a public state method when plan 22 exposes one; else the same rules, pinned by the same matrix of cases).
- **Open actions (TM-3):** the team's first five open action items in `ActionItemQuery::order` (overdue first), presented by `PresentActionItem`; the count of open and of overdue ones; "See all" leads to the action items page filtered on the team.
- **Retro counts (TM-5):** per retro of the team page, `withCount` of participants, cards, groups (top-level cards with children) and action items.
- **Last activity of a member:** the latest `updated_at` among the member's participant, poker player, whiteboard member, game player and survey respondent rows in the team's sessions (`withMax` per relation, the maximum in PHP), null when none.
- **Workspace tile (TM-4):** the second line becomes "n whiteboards edited today" when the team has no active poker game and at least one board was updated today; the live retro line reads "Retro live now · Sprint 42" when the retro was created inside a sprint, the retro's title otherwise.

### 6.10 Taking control of an open session (decision 2 B)

A team facilitator, a team owner and a manager may make **themselves** the facilitator of any **open** session of the team, from the session's menu ("Take control", the label the poker and whiteboard menus already use):

| Session | Open means | Today | With this plan |
|---|---|---|---|
| Retro | phase is not `completed` | only the facilitator hands over (`RetroFacilitatorsController`) | a team facilitator, owner or manager takes control (`PUT retros/{retro}/facilitator` with their own `user_id`) |
| Poker game | not ended | any non-guest team member takes control, also on an ended game (`PokerFacilitatorsController::ensureTakesControl`) | unchanged (already covers facilitators and owners); observers refused (§7.1) |
| Whiteboard | always | any non-guest team member takes control (`WhiteboardFacilitatorsController::ensureTakesControl`) | unchanged; observers refused (§7.1) |
| Game room (standalone) | always | the creator and managers take hosting (`GameHostsController::ensureCanTakeHosting`) | plus team facilitators and owners |

- One ability, `TeamPolicy::takeControl(User, Team)` = `managesRitualsOf` (owner, facilitator, manager), read by the retro and game-room controllers and by the snapshots' `canTakeControl` (retro, new) and `canBecomeHost` (game room, widened).
- The previous facilitator stays a participant; the session's settings event tells the others (`RetroSettingsChanged`, `GameRoomChanged`), as a hand-over does today.
- A retro's take-over is refused (403, the existing "Only the facilitator can do this.") on a completed retro and to a guest; the target is always the person asking (a facilitator who wants to give the session to someone else uses the existing hand-over, which stays the current facilitator's).
- A team survey is not taken over (§3).

### 6.11 "Online" in the members table (P23-07, owner's answer ≠ recommendation)

The members table of Members & rituals (ScreenSettings a) shows "En ligne" in its Last activity column. The owner chose a new app-wide presence channel over the recommendation (the last session date only).

1. **One presence channel per workspace**, `presence-workspace-online.{workspaceId}` (Echo name `workspace-online.{workspaceId}`). "Global" is read as *app-wide*: every signed-in page of the application (team pages, settings, the action items page, a session page) joins the channel of the current workspace (the shared `currentWorkspace`), once, and stays in it while the person moves between pages of that workspace. It is not one instance-wide channel: nobody learns who is online in a workspace they do not belong to.
2. **Authorisation** (`BroadcastAuthorizationsController`, as the other channels): a signed-in user who may view the workspace (`WorkspacePolicy::view`: any member, observers and managers included). A guest cookie, a visitor or a member of another workspace gets 403.
3. **What travels:** the user id only (`{id}`); the members table already has the names and avatars.
4. **Join and leave:** the client follows Inertia's `navigate` event (fired on the first page and on every visit): a new current workspace leaves the old channel and joins the new one; an unchanged one does nothing (no flicker for the others); a signed-out page leaves. Several tabs of the same person count once (presence channels key members by user id).
5. **Reading:** the Last activity cell reads "Online" (the existing key) when the member's id is in the channel, and always on the viewer's own row (the viewer is here, as the mockup's "(toi) · En ligne" row); otherwise the relative date of the last session joined (§6.9), "Never" when none. It changes live as people join and leave, without a reload.
6. **Without Reverb** (Echo not configured) nothing is joined and the column shows dates, the viewer's row still "Online".
7. Nothing is stored: no "last seen" column, no event, no log.

## 7. Permissions

Managers (workspace owners and admins) can do everything on every team of their workspace, whatever their pivot row. Guests (session cookies, no account) are not team members: nothing here changes what they can do.

| Ability | Manager | Owner | Facilitator | Member | Observer |
|---|---|---|---|---|---|
| View the team page and its sessions | yes | yes | yes | yes | yes |
| Create a session (retro, poker, whiteboard, survey, game room) | yes | yes | yes | yes | **no** |
| Take part in a session (write, vote, answer, play) | yes | yes | yes | yes | **no** (§7.1) |
| Facilitate a session they created or were handed | yes | yes | yes | yes | only one they already facilitated before becoming observer |
| Be chosen as a retro's facilitator in the "New session" dialog | yes | yes | yes | yes | no |
| Take control of an open retro or game room of the team (§6.10) | yes | yes | yes | no (game room: its creator, as today) | no |
| Take control of a poker game or whiteboard of the team | yes | yes | yes | yes (as today) | no |
| Create, comment on, complete action items | as today | as today | as today | as today | **no** |
| Rename the team, its description, health statements | yes | yes | no | no | no |
| Add and remove members, change roles | yes | yes | no | no | no |
| Ritual settings (sprints, "Start the next sprint", retro day, facilitators, rotation, default template) | yes | yes | yes | no | no |
| Integrations of the team | yes | yes | no | no | no |
| Delete the team | yes | no | no | no | no |
| Team templates of this team | yes | yes | yes | no | no |
| Personal templates | yes | yes | yes | yes | yes |
| Rename the workspace, its description | yes | no | no | no | no |
| See the team settings | General, Members & rituals, Integrations, Data | the four | Members & rituals (read-only members) | — | — |

Decision 2 (B: owner ≈ manager except delete; facilitator: rituals, templates, rotation, and taking control of any open session) and decision 3 (A: observer read-only everywhere) are answered; the table is written on them.

The workspace presence channel of §6.11 is open to every signed-in member of the workspace, whatever their team role; the members table that reads it is shown to who may open Members & rituals.

`TeamPolicy`: `update`, `manageMembers` and `manageIntegrations` become `managesTeam`; `manageRituals` and `takeControl` are new (`managesRitualsOf`); the five `create*` abilities add "not an observer"; `view` and `delete` are unchanged. `WorkspacePolicy::update` (new) is `canManage`, for the workspace name and description. Plan 25 reads `manageMembers` as "who may invite to a team" and widens it to facilitators for invitations (its own decision). **Access requests (plan 29, merged before):** the owner's answer to plan 29 sends them to the workspace's owners and admins "until plan 23"; this plan switches `AccessRequestRecipients::for(Team)` to the people who may approve one, that is who holds `manageMembers` on the team: the workspace's owners and admins and the team's owners (plan 29 already authorises the answer with `manageMembers`, so a team owner can approve without another change). Ruling of this revision: team facilitators do not receive them; plan 25's answer ("inviters = members managers plus facilitators") widens who may *invite*, which plan 25 builds on its own, not who approves an access request.

### 7.1 The observer

- One middleware, `RefuseObserverWrites`, added after the participant middleware of each of the five session scopes (`retros/{retro}`, `poker/{game}`, `whiteboards/{board}`, `games/{room}`, `surveys/{teamSurvey}`): a request that is not a read (`GET`, `HEAD`, `OPTIONS`), by a signed-in observer of the session's team, is refused with 403 "Observers can follow this session but not take part.", unless that person is the session's facilitator (host for a game room, editor for a survey). It refuses an observer's "Take control" too.
- Poker: an observer joins as a spectator; an existing player who becomes an observer is made a spectator when they next open the game (`SetPokerSpectator`, which withdraws their open votes).
- Each session snapshot carries `viewerIsObserver`; the screens render read-only (§9.7).
- Action items: `ActionItemPermissions` refuses an observer creation, comments and completion, on every surface (retro, action items page, MCP).
- MCP: every write tool refuses an observer of the team concerned with the same message.
- Participation (session-end statistics, survey audience): observers count neither among those who joined nor among those expected.

## 8. Real time

One new channel, the workspace presence channel of §6.11 (joined app-wide, user id only); no new event. Role and settings changes apply at the next request of the person concerned; an open board that becomes read-only for a new observer learns it at its next snapshot (any `settings.changed`, reconnect or reload). A take-over sends the session's existing settings event (§6.10). The activity feed, the recent sessions table and the current sprint are read when the team page loads, like the rest of the page.

## 9. Screens

Each screen follows its mockup. "Omitted" means: not built, place left, row of the plan's pre-build deviations. Where no mockup exists, the screen is designed from the neighbours named; each such design is a pre-build deviation row the owner answered on 2026-10-03 (§15.2).

### 9.1 Team page — `teams/show`

Mockups: ScreenTeam (layout, header, sections, right column), ScreenDashboard (recent sessions, open actions, activity, the header meta line). The page keeps the structure of plan 18e; the slots of `TeamPageSlots` are filled.

- **Header** (slot `schedule`): at the end of the meta line, "Sprint 42" and "Next retro Thu 2 Oct, 2 pm" (calendar icon), or "Next retro Thu 2 Oct" without a time; "Sprint 42" alone when no retro day is set or no next retro is left; nothing when no sprint contains today and no next retro is known. For who may set rituals and whose team has no sprint yet: a ghost link "Start the first sprint" to the Sprints card of Members & rituals.
- **Recent sessions** (slot `recentSessions`, first block of the main column): a `Table` with Session (kind icon in the kind's colour, title, meta line), Date ("Today", "18 Sep"), Participants, Status (a live session: badge "Live" and a "Join" button; a finished one: "Ended" and the outcome; a draft: "Draft"), and "All sessions" in the header, leading to plan 22's Sessions page. Below 40rem the rows become cards (title, meta, status). Empty: the block is not rendered (the sections below have their own empty states).
- **Retro cards** (slot `retroStatsFor`): Writing and Grouping: ":count joined", ":count cards"; Voting, Discussing, Actions, ROTI: plus ":count groups"; Completed: participants without a unit, ":count cards", ":count action items". `SessionCard.stats` gains `groups`.
- **Whiteboard cards** (slot `whiteboardThumbnailFor`): the 6.5rem thumbnail of §6.8 above the name; dot-grid paper while no preview exists.
- **Open actions** (slot `openActions`, first block of the side column): "Open action items" with the count and ":count overdue" (warning badge), the sentence "Gathered from every session of the team · overdue first.", up to five `ActionItem` rows (title, assignee avatar, priority, due date with the late style and alarm icon, ticket key, source retro), "See all". Empty: "No open action items." Hidden when the team has none and the viewer may not create one.
- **Activity** (slot `activity`, last block of the main column): up to ten lines: the actor's avatar (initials for a guest or a tracker), the sentence of §6.7 with the subject as a link, the relative time. Empty: "Nothing has happened in this team yet."
- **Members card** (slot `roleBadgeFor`): the role as text after the email ("Facilitator"), as in ScreenTeam; for an owner or manager the role is a `Select` in the add-member form ("Add as"); changing a role happens on the Members & rituals tab. The slot `inviteAction` stays empty (plan 25).
- **The settings card** (`#settings`, rename and delete) leaves the team page: it moves to the General tab (§9.2). The gear and the sidebar entry "Team settings" lead to General for who manages the team, to Members & rituals for a facilitator, and are hidden for others.

States: no sprint; a sprint without retro day; between two sprints; a viewer who is an observer (the "New session" button is disabled with "Observers cannot start sessions."); every block empty (new team); a deferred trend still loading (unchanged).

### 9.2 Team settings — General — `teams/settings`

Mockup: ScreenSettings frame a (header and tabs; no frame for this tab). Designed from the header of the mockup and the existing `TeamSettingsCard`.

- `TeamSettingsShell` with the four tabs of the mockup: General, Members & rituals, Integrations (when a provider is enabled and the viewer may manage integrations), Data & export. Header: team mark, name, the line "description · :count members · created in :month :year" (D-88).
- One card "Team": Name (required, 100), Description (optional, 200, "Shown on the workspace page."), "Save" (explicit, owner 10-D6).
- A danger zone card with "Delete team", for managers only (the existing confirmation).

States: saved (toast), validation error per field, a viewer who may only read (403: the page is for who manages the team).

### 9.3 Team settings — Members & rituals — `teams/members`

Mockup: ScreenSettings frame a, tab "Members & rituals".

- **Members** card: header ":count members"; the places of "Invitation link" and "Invite" are left (plan 25). `Table`: Member (avatar, name, "(you)", email), Role (a `Select` with the four roles for an owner or manager; text otherwise), Last activity ("Online" while the member is in the workspace presence channel and always on the viewer's row, §6.11; else relative, "Never" when null), and the row menu with "Remove from team" (confirmation, "Retirer"). Footer: "Facilitator: drives phases, timer and reveal, and can take control of any open session. Observer: read-only, does not vote." Below 40rem the table becomes a list and the role opens in a `Drawer`.
- **Sprints** card (no mockup: P23-01, obsolete — decision 1 B asked for it), `section#sprints`:
  - the current sprint in a highlighted row ("Sprint 42 · 21 Sep → 4 Oct · current"), or "No sprint in progress.";
  - the primary button **"Start the next sprint"** with the line under it "Sprint 43 · from today to 13 Oct" (computed from the default length), disabled with the reason when rule 3 of §6.3 refuses (a sprint starts today; a sprint is already planned);
  - the list of sprints, latest first, ten shown and "Show all" (a sprint per row: number, first and last day, "current" badge, a row menu "Edit" and "Delete" with confirmation "Sessions keep their content; they lose this sprint's label.");
  - "Add a sprint" (a small form: number prefilled with the next one, first day prefilled with the day after the last sprint, last day prefilled from the default length; "Add");
  - the settings, saved with one "Save": default length (segmented 1, 2, 3, 4 weeks), retro day (weekday select, optional, "None") and time (optional, disabled without a day), and the preview "Next retro Thu 1 Oct, 2 pm" or "No next retro until the next sprint is started.".
- **Default facilitators** card: removable chips of the list (avatar, first name), "Add" (a menu of owners and facilitators not in the list), the switch "Rotate the suggestion at every retro" with "Suggested next: :name · retro of :date" (or "Suggested next: :name" without a next retro), and the help line "The person creating a retro can always choose someone else." Saves on each change.
- **Retro templates** card: radio list (template name, "Default" badge, column colour strip, "Used :count×" / "Never used"), "Create" (opens the template editor in a sheet with visibility Team and this team), "Browse" (the catalogue picker of the dialog). Choosing a radio saves the default.
- **Default columns** card: "Default columns · template :name": the columns as reorderable rows with the colour picker of the eight colours (Soleil, Abricot, Corail, Prune, Iris, Ciel, Lagon, Mousse), editable as §6.5, "Save"; read-only with "Duplicate as a team template" otherwise.

States: a facilitator (members read-only, rituals editable); an owner; no sprint; between two sprints; a planned next sprint (start disabled); rotation on with an empty list (the switch disabled, "Add a facilitator first."); default template no longer available ("This template is no longer available. Choose another."); saving; errors per field (an overlap names the sprint it overlaps).

### 9.4 Team settings — Data & export — `teams/data`

No mockup content (the tab only). Designed from the settings cards (P23-02), decision 8 A:

- "Exports" card, one row per export that exists, each with a short sentence and a link or button: "Survey results (CSV)" with the closed standalone surveys of the team and their CSV (plan 19's route); "Estimates" to the estimation history (`teams.estimates.index`); "Action items" with the sentence "The team's action items, on the action items page." linking to the action items page filtered on the team (`workspaces.actionItems.index?team=`); plan 24, after this plan, adds its CSV export ("CSV of the whole filter") to that page, so the link reaches it without a change here.
- "What is kept" card: one paragraph saying that deleting the team deletes its sessions, action items and settings, and that guests' names live only in the sessions they joined.

States: no closed survey ("No closed survey yet."); viewer without the right (403).

### 9.5 Workspace page — `workspaces/show`

Mockup: ScreenWorkspace frames a, b.

- Header: under "3 teams · 24 members · you're an admin", the workspace description in muted text, and for a manager an "Edit" ghost button (pencil icon, accessible name "Edit the workspace name and description") opening a small dialog "Workspace": Name (required, 100), Description (textarea, 200, counter), the line "The workspace address does not change.", "Save", "Cancel" (decision 7 B; no mockup for the dialog: P23-03). A rename shows the new name in the header and the sidebar switcher after the save; the address does not change.
- Team tiles: the description under the name (slot `teamDescriptionFor`); the second activity line of §6.9; "Retro live now · Sprint 42".

States: no description (nothing rendered under the facts line); the dialog with a name error (empty, too long); a member (no button).

### 9.6 Templates page and editor — `workspaces/templates`, `TemplateEditor`

Mockups: ScreenWorkspace frames c, d; TemplateEditor.

- Retro template cards: the visibility badge beside the name (slot of `templates-page.tsx`): "Personal" (`user` icon), "Team · Atlas" (`users`), "Workspace" (`building-2`), outline badge.
- "New template" for every workspace member. The editor shows Visibility (segmented: Personal, Team, Workspace with its help line); "Workspace" disabled for a non-manager with the reason; "Team" followed by a team `Select` when the viewer may create for more than one team.
- The editor's other fields are unchanged.

States: a member (personal only, or team for an owner or facilitator); a manager (all three); a template the viewer may not edit (no menu, as today).

### 9.7 Sessions for an observer, and "Take control"

No mockup for the observer views (P23-04, approved as recommended): each session screen renders its existing read-only mode, with one info line under its header, the same on the five screens: "You are observing this session." (`eye` icon, muted, a polite status).

- Retro: the board as when it is locked for this viewer (no composer, no vote buttons, no reactions, no ROTI or health-check submission).
- Poker: the spectator view of plan 18e (the "Watch only" switch shown on and disabled).
- Whiteboard: read mode (7-D7), without "Modifier".
- Game room: the room without the input controls.
- Team survey: the questions read-only; results as for any member.

"Take control" (P23-16): the retro's board menu gains the entry "Take control" (the icon and confirmation-free behaviour of the poker and whiteboard entries) when the snapshot's `viewer.canTakeControl` is true; the game room menu's existing "Become host" entry appears for team facilitators and owners through the widened `canBecomeHost`; poker and whiteboard menus are unchanged. Success: the viewer's controls switch to the facilitator's at the next snapshot; failure: the toast of the server's message.

### 9.8 Other places

- "New session" dialog, retro form (props through plan 22's `PresentNewSessionOptions`): the name is prefilled "Sprint 42 retro" when a sprint contains today; the template preselected from the team's default; a **Facilitator** `Select` under the settings (no mockup: P23-05, obsolete — decision 4 C asked for it): the viewer first ("Me"), then the team's owners, facilitators and members by name, preselected with the suggested facilitator of §6.4, with "(suggested)" after that person's name and, when the rotation is on, the help line "Suggested by the rotation."; the dialog posts `facilitator_user_id`.
- Sidebar user card (D-129): the second line reads "<team role> · <workspace role>" for the current team ("Facilitator · Admin"), the workspace role alone when the user is not in the current team.
- Retro session header: "Atlas · Sprint 42" when the retro was created inside a sprint (D-100), unchanged otherwise.
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
| `POST teams/{team}/sprints` | `teams.sprints.store` | `TeamSprintsController@store` | `manageRituals` |
| `PATCH teams/{team}/sprints/{sprint}` | `teams.sprints.update` | `TeamSprintsController@update` | `manageRituals` |
| `DELETE teams/{team}/sprints/{sprint}` | `teams.sprints.destroy` | `TeamSprintsController@destroy` | `manageRituals` |
| `POST teams/{team}/sprint-starts` | `teams.sprintStarts.store` | `TeamSprintStartsController@store` ("Start the next sprint") | `manageRituals` |
| `PUT teams/{team}/rituals` | `teams.rituals.update` | `TeamRitualsController@update` (default length, retro day and time) | `manageRituals` |
| `PUT teams/{team}/facilitators` | `teams.facilitators.update` | `TeamFacilitatorsController@update` | `manageRituals` |
| `PUT teams/{team}/default-retro-template` | `teams.defaultRetroTemplate.update` | `TeamDefaultRetroTemplatesController@update` | `manageRituals` |
| `GET teams/{team}/data` | `teams.data.show` | `TeamDataController@show` | `update` |
| `POST teams/{team}/retros` | `teams.retros.store` (exists) | `TeamRetrosController@store` | `createRetro`; body gains `facilitator_user_id` |
| `PUT details` | `workspaces.details.update` | `WorkspaceDetailsController@update` (name and description) | `update` on the workspace |
| `POST|PATCH|DELETE templates…` | exist | `WorkspaceTemplatesController` | per §6.6 (a new `WorkspaceTemplatePolicy`) |

Session scopes (existing routes, widened by §6.10): `PUT retros/{retro}/facilitator` (`retros.facilitator.update`) and `PUT games/{room}/host` (`games.host.update`).

Broadcasting (existing route `POST broadcasting/auth`, `BroadcastAuthorizationsController@store`): the new prefix `presence-workspace-online.{workspace}` of §6.11, a UUID of an existing workspace that the signed-in user may view.

Validation, in Form Requests with array rules: `description` nullable, string, max 200; workspace `name` required, string, max 100; `role` `Rule::enum(TeamRole::class)`; sprint: `number` integer 1–9999, distinct per team, `starts_on` and `ends_on` dates `Y-m-d`, `ends_on` after or equal to `starts_on` and at most 55 days after it, no overlap with another sprint of the team (checked under the lock); rituals: `sprint_length_weeks` nullable integer 1–4, `retro_weekday` nullable integer 1–7, `retro_time` nullable `date_format:H:i` and prohibited without `retro_weekday`; facilitators: `user_ids` array max 10, distinct, each a member of the team with role owner or facilitator; `rotation` boolean, accepted only with at least one facilitator; retro creation: `facilitator_user_id` nullable UUID, a person who may take part in the team's sessions; default template: a key available to the team and the person, not personal (§6.6); template: `visibility` enum, `team_id` required with `team` and prohibited otherwise, a team the person may create team templates for.

Transactions lock the aggregate root first: the team row for the sprints (store, update, start), the facilitators, the rotation and a retro creation (always, since the suggestion is compared under the lock), the role changes; the workspace row for template creation and the workspace rename; the template row on update; the retro or game room row on a take-over (as the hand-over does today).

## 11. Migrations of existing data

| Migration | Existing rows | Proof |
|---|---|---|
| `add_role_to_team_user_table` | every membership reads `member` (column default) | Upgrade test (PostgreSQL in this plan; the four engines in the roadmap's final matrix) |
| `add_descriptions_to_teams_and_workspaces` | null | none needed |
| `add_rituals_to_teams_table` | no default length, no retro day, rotation off, position 0 | none needed |
| `create_team_sprints_table` | empty: no team has a sprint until someone starts one | none needed |
| `add_default_retro_template_to_teams_table` | no default template: the dialog chooses as today | none needed |
| `create_team_facilitators_table` | empty | none needed |
| `add_visibility_to_workspace_templates_table` | every template reads `workspace`, `team_id` null: visible as today | Upgrade test (PostgreSQL in this plan; the four engines in the roadmap's final matrix) |
| `create_team_activities_table` | empty: the feed starts at the release (no backfill: nothing records who did what before) | none needed |
| `add_preview_to_whiteboards_table` | null; built lazily (§6.8) | feature test of the lazy build |

No existing member becomes owner: managers keep managing every team as today, and no person loses or gains a right on the day of the upgrade except the new take-over of §6.10, which only managers can use until someone is given a team role.

## 12. Testing

- Every test touching the database runs per task on PostgreSQL (`bin/test-db pgsql -- <paths>`), the Upgrade tests and the races too (`bin/test-db pgsql --concurrency`); the whole PostgreSQL suites run at each lane merge and at the end of the plan. SQLite, MariaDB and MySQL run once, in the four-engine matrix after the roadmap's last merge (owner, 2026-10-03); `tests/Arch/DatabasePortabilityTest.php`, in every Arch run, keeps the code portable meanwhile.
- Pest feature tests for every route, policy and role (the matrix of §7 walked as a dataset), the observer middleware on each of the five scopes (refused write, allowed read, facilitator exception, manager exception, guest unaffected), the poker spectator switch, action item permissions and MCP refusals, participation without observers, the take-over on the four kinds (allowed and refused by role, a completed retro, a guest, an observer), the workspace presence channel (a member, an observer and an admin signed with their user id only; another workspace's member, a visitor, a malformed or unknown workspace refused).
- Unit tests for `SprintCalendar` with hand-built sprint rows (inside a sprint, between two sprints, the first and last day, the next retro on the day before, the day of before and after the time, in the next sprint, none when no next sprint exists, a sprint shorter than a week without the retro weekday, a day read across a daylight-saving change).
- Feature tests for the sprint rules of §6.3 (overlap, numbers, "Start the next sprint" cutting the current sprint, refused when a sprint starts today or is planned).
- Races (`tests/Concurrency`, `Race`): two "Start the next sprint" at once create one sprint; two retros created at once that both chose the suggested facilitator move the rotation once; saving the facilitator list twice at once leaves one consistent list.
- Upgrade tests (`tests/Upgrade`) for the two migrations of existing rows.
- Vitest for the pure logic (sprint formatting and the "Start the next sprint" preview, role labels, activity sentence, session row state labels, the suggested facilitator of the dialog, the presence store: join, here, joining, leaving, an unchanged workspace ignored, a changed one left) and for each new or changed component (the members table's "Online").
- No browser walkthrough is written or run. Captures in light, 1440, French of: the team page, the three new settings tabs, the workspace page and its dialog, the templates page with badges and the editor with visibility, a retro seen by an observer (with "You are observing this session."), the retro form with the Facilitator select.

## 13. Acceptance criteria

1. After the migration every existing team membership has the role `member`, every existing template the visibility `workspace`; nobody gains or loses a right except the take-over of criterion 6 for managers (the feature tests of today's permissions pass unchanged).
2. An owner or a manager changes a member's role on the Members & rituals tab; a facilitator, a member and an observer get 403; a non-member target gets 404; an unknown role gets 422.
3. A team owner who is not a manager can rename the team, change its description, add and remove members, change roles, manage health statements and integrations, and cannot delete the team.
4. A facilitator can change the ritual settings and nothing of §7 marked owner.
5. An observer gets 403 on every non-read request of the five session scopes of a team session, sees each session read-only, cannot create a session, an action item, a comment or a completion (web and MCP), cannot take control of a session, and is not counted in participation; each of the five screens shows "You are observing this session."; a manager whose pivot row says observer is not restricted; a guest is unaffected; an observer who facilitated a session before keeps facilitating it.
6. A team facilitator, a team owner and a manager take control of an open retro and of a standalone game room of the team; a member gets 403 on the retro (and keeps today's right on poker games and whiteboards, and the creator's on their game room); a completed retro refuses the take-over; a guest is refused; the retro's snapshot says `canTakeControl` to exactly who may.
7. An observer opening a poker game becomes a spectator and loses their unrevealed votes.
8. With sprints 41 (7 to 20 Sep 2026), 42 (21 Sep to 4 Oct) and 43 (5 to 18 Oct) and a retro on Thursday at 14:00: on Wednesday 2026-09-30 the team page shows "Sprint 42" and "Next retro Thu 1 Oct, 2 pm"; on Thursday 2026-10-01 at 15:00 it shows the next retro on Thursday 2026-10-15 (the last Thursday of sprint 43); without sprint 43 it shows "Sprint 42" and no next retro; on 2026-09-06 (before sprint 41) it shows no sprint.
9. "Start the next sprint" on Wednesday 2026-09-30 with sprint 42 current ends sprint 42 on 2026-09-29 and creates sprint 43 from 2026-09-30 to 2026-10-13 (default length two weeks); pressed again the same day it is refused; with a sprint planned after today it is refused; two presses at once create one sprint; a sprint overlapping another or reusing its number is refused; deleting a sprint removes its label from the sessions created in it and nothing else.
10. The ROTI trend labels its points "S41"… by the sprint of each retro's creation; the retro header reads "team · Sprint 42"; the workspace tile reads "Retro live now · Sprint 42"; a new retro is prefilled "Sprint 42 retro"; a retro created between two sprints has none of these labels.
11. With the list [Camille, Inès] and the rotation on, the dialog suggests Camille; a retro created with Camille as facilitator makes Inès the next suggestion; a retro created with someone else keeps Camille suggested; two retros created at once both with Camille move the rotation once; with the rotation off the first of the list is suggested; with an empty list the creator is; in every case the chosen person facilitates and the creator is a participant; an observer or a person outside the team cannot be chosen (422).
12. Removing a facilitator from the team or making them a member removes them from the list; the list refuses a member or observer, more than ten people and duplicates.
13. The default retro template is preselected in the "New session" dialog; a template no longer available is ignored; "Used :count×" counts the team's retros only.
14. A member creates a personal template that nobody else sees; an owner or facilitator creates a team template that the team's members see and other teams do not; only a manager creates a workspace template; `TeamRetrosController` refuses a template the creator cannot see; the templates page shows the badge.
15. The activity feed shows the nine kinds of §6.7, newest first, at most ten, with links to subjects that still exist, and never a line about a card, a vote, a comment, a reaction, a health check or a survey answer.
16. The recent sessions table shows at most five sessions of the team, live first, with participants, date, state (plan 22's rules) and outcome; a draft survey only to its editors.
17. The open actions block shows at most five open items, overdue first, with the counts of open and overdue items.
18. A retro card shows the counts of its phase (joined, cards, groups, action items).
19. A whiteboard card shows a thumbnail built from its elements within a minute of an edit, without moving its "edited" date; a board edited before the release gets one the first time the team page is opened after a queue run.
20. A team's description shows on its workspace tile and in the team settings header; a manager renames the workspace and changes its description in one dialog, the slug and every URL staying the same; an empty name is refused (422); a member cannot (403).
21. The team settings have General, Members & rituals, Integrations (when enabled) and Data & export, each reachable by who may see it and refused (403) to others; the settings card is no longer on the team page.
22. The sidebar user card shows the team role and the workspace role; an access request to a team (plan 29) reaches the workspace's owners and admins and the team's owners, and not its facilitators, members or observers.
23. Every new string exists in the four languages, informal in French, Spanish and German (`InformalRegisterTest`, `TranslationKeysTest`); the captures of §12 are taken without horizontal overflow and compared with their mockups, each difference fixed or a row of the plan's deviations.
24. The unit, feature, upgrade, arch and concurrency suites pass on PostgreSQL at the end of the plan; `tests/Arch/DatabasePortabilityTest.php` passes. (SQLite, MariaDB and MySQL are proved once, by the roadmap's final four-engine matrix, not by this plan.)
25. In the members table of Members & rituals, a member who has a signed-in page of the workspace open reads "Online", and the viewer's own row always does; when they close their last page the cell turns back to their last session date without a reload; moving between pages of the workspace does not make anyone leave the channel; a member of another workspace, a guest and a visitor cannot join the channel (403), and the channel tells its members nothing but user ids.

## 14. Risks

- **Roles touch every policy.** A wrong `TeamPolicy` method could take a right away from today's members or give one to observers. The matrix of §7 is a dataset test run against every ability, and today's permission tests run unchanged before the observer task lands.
- **Taking control is a new power over others' sessions.** A team facilitator can take a retro from its facilitator in the middle of a phase (decision 2 B). It is limited to open sessions of their own team, to themselves as the target, refused to observers and guests, and announced to the others by the session's settings event; nothing else of the session changes hands.
- **The observer middleware is broad.** It refuses every non-read request of a session scope; a read implemented as `POST` (a search, a preview) would be refused. The plan lists the non-GET routes of the five scopes and checks each.
- **`as('teamMembership')` on `Team::members()`.** Code reading `->pivot` on team members breaks. The plan greps for it before the change.
- **Sprint rows need care from the team.** With explicit sprints, nothing moves on its own: a team that forgets "Start the next sprint" has no current sprint, no next retro and no labels on the sessions of those days. The team page offers the button's place to who may press it ("Start the first sprint"), the Sprints card says "No sprint in progress.", and a sprint can be added afterwards for past days (the labels follow, rule 5 of §6.3).
- **Editing a sprint's days relabels sessions.** Deliberate (the dates are the source); the edit form says so and an overlap is refused.
- **The rotation is advisory.** A team that always overrides the suggestion never moves the rotation; this is the owner's choice (decision 4 C) and the dialog says the suggestion comes from the rotation.
- **Name uniqueness and personal templates.** Two people cannot both have a personal template called "Our retro"; the second gets "A template with this name already exists." without seeing the first. Accepted for now (§6.6).
- **Lazy previews on the team page.** The first visit after the release dispatches one job per board without a preview; the job is unique per board and reads at most 5 000 elements (`Whiteboard::MaxLiveElements`). On SQLite, one writer at a time: the jobs queue behind requests.
- **Shared files with plans 22, 24, 25, 29.** `ListTeamSessions` and `PresentNewSessionOptions` (plan 22, merged before), `AccessRequestRecipients` (plan 29, merged before: its recipients gain the team's owners here, §7); `ActionItemPermissions` and `PresentActionItem` (plan 24, **after**: it rebases on this plan's observer refusals), `TeamMembersController`, `TeamPolicy`, the General tab and the Members tab (plan 25, after). This plan rebases on 22 and 29; plans 24 and 25 rebase on this one; migration dates are spaced (§5).
- **Translations of roles.** "Facilitator" is "Moderation" in German today (`lang/de.json`), the activity, while every use of the key names the person and 26 German strings already say "Moderator". Ruled in this revision: the value becomes "Moderator" (the plan's translation task, the one exception to "an existing key keeps its value"); "Take control" ("Moderation übernehmen") keeps its value.
- **No live updates on the team page.** The activity feed, the counts and the current sprint are as fresh as the last load.
- **Who is online is visible to the whole workspace** (§6.11, the owner's answer). Any member of a workspace can learn which members have it open, through the channel even where no screen shows it; limited to members of that workspace and to user ids. Each signed-in tab holds one more websocket subscription; Reverb's presence bookkeeping grows with the number of signed-in people per workspace (bounded by the workspace's members).
- **Engines proved late.** Per the owner (2026-10-03), SQLite, MariaDB and MySQL run only in the roadmap's final matrix; a non-portable line in this plan is found then. The portability rules and `DatabasePortabilityTest` are the guard meanwhile.

## 15. Decisions for the owner — answered 2026-10-03

### 15.1 The nine questions

**1. What is a sprint?** — **Answered: B** (≠ the first draft's recommendation A).
- A. A rhythm on the team: length and one known sprint; sprints derived by arithmetic.
- **B. Chosen.** Explicit sprints: a `team_sprints` table (number, start, end) managed on the Members & rituals tab with "Start the next sprint" and a management card; history never moves unless a sprint is edited. About three more tasks and a card the mockups do not draw (P23-01). Written in §6.3, §9.3, §10, criteria 8 to 10.
- C. No sprint: TM-1 shows the next retro only.

**2. What do owners and facilitators get?** — **Answered: B** (≠ A).
- A. Owner: everything a manager can do on the team except deleting it. Facilitator: the ritual settings and team templates, and a place in the rotation. Member: exactly today's rights.
- **B. Chosen.** As A, and a facilitator may also take control of any open session of the team. Written in §6.10, §7, §9.7, criterion 6. Owners and managers have the same power (owner ≈ manager except delete). Poker and whiteboards already let every team member take control: kept.
- C. As A, but an owner does not manage integrations.

**3. How far does "observer: read-only, does not vote" go?** — **Answered: A** (the recommendation). Read-only everywhere in the team: the five session types, no session creation, no action item writes, MCP writes refused, not counted in participation.

**4. What do the default facilitators do?** — **Answered: C** (≠ A).
- A. They feed the rotation only, which assigns each new retro's facilitator.
- B. With the rotation off, the first person of the list facilitates every new retro.
- **C. Chosen.** A suggestion only: the "New session" dialog gains a "Facilitator" select prefilled from the list (the rotation decides who is suggested); no automatic assignment; the select has no mockup (P23-05). Written in §6.4, §9.8, criterion 11.

**5. What does "Default columns" edit?** — **Answered: A** (the recommendation). The columns of the team's default template, in place, when the viewer may edit that template; otherwise "Duplicate as a team template".

**6. Who may create templates, and who sees personal ones?** — **Answered: A** (the recommendation). Personal: any workspace member, seen by its creator only; team: managers and the team's owners and facilitators; workspace: managers.

**7. Where does the workspace description live?** — **Answered: B** (≠ A).
- A. Under the facts line of the workspace page header, edited by managers in a small dialog.
- **B. Chosen.** As A, and the same small dialog also renames the workspace; the slug and every URL stay. Written in §6.2, §9.5, §10, criterion 20.
- C. Team descriptions only.

**8. What goes in "Data & export"?** — **Answered: A** (the recommendation). Links to the exports that exist (survey CSVs, the estimates history, plan 24's action items export) and a paragraph on what deleting the team removes. No new export.

**9. The recent sessions table and plan 22.** — **Answered: A** (the recommendation). Plan 22 runs first; this plan reads the team's recent sessions with its state rules.

### 15.2 Pre-build deviations — answered 2026-10-03

The rows P23-01 to P23-16 of the plan (`.superpowers/sdd/roadmap/progress.md`, line "P23: …"). Rows not named by the owner are approved as listed.

| Row | Subject | Answer (owner, 2026-10-03) | Written in |
|---|---|---|---|
| P23-01 | Sprints card (no mockup) | **Obsolete**: decision 1 B (explicit sprints and a management card) settles it; built as §9.3 describes | §9.3 |
| P23-02 | Data & export content | Approved as listed (the action items row links the action items page, where plan 24 adds its CSV after this plan) | §9.4 |
| P23-03 | Workspace dialog (name and description) | Approved as listed | §9.5 |
| P23-04 | Observer views | **Approved as recommended**: each screen's read-only mode, plus the line "You are observing this session." | §9.7, criterion 5 |
| P23-05 | Facilitator select of the retro form (no mockup) | **Obsolete**: decision 4 C (a suggestion in a select) settles it; built as §9.8 describes | §6.4, §9.8 |
| P23-06 | Next retro derived from the sprints | Approved as listed | §6.3, §9.1 |
| P23-07 | "En ligne" in the members table | **≠ recommendation**: a **global presence channel** gives "Online" (the recommendation was the last session date only) | §6.11, §8, §9.3, §10, criterion 25 |
| P23-08 | No survey answers in the feed | Approved as listed | §6.7 |
| P23-09 | Recent sessions: whiteboard states, game rooms | Approved as listed | §6.9, §9.1 |
| P23-10 | Explicit "Save" per card | Approved as listed | §9.2, §9.3 |
| P23-11 | Retro templates card: top five plus the default | Approved as listed | §6.5 |
| P23-12 | Default facilitators: owners and facilitators only | Approved as listed | §6.4 |
| P23-13 | Invitation places left for plan 25 | Approved as listed | §9.1, §9.3 |
| P23-14 | Team settings header without a description | Approved as listed | §9.2 |
| P23-15 | Team select in the template editor | Approved as listed | §9.6 |
| P23-16 | "Take control" in the retro's menu | Approved as listed | §6.10, §9.7 |

## 16. Not determined by reading

1. Whether any code reads `->pivot` on team members (the switch to `as('teamMembership')` would break it); the plan greps first.
2. Which non-GET routes of the five session scopes are reads in disguise (the observer middleware would refuse them).
3. Whether the queue runs on every install (a database queue is configured; an instance without a worker never builds thumbnails, the cards then show the paper alone).
4. Whether plan 22's `ListTeamSessions` exposes the state of one session as a public method (the plan reuses it when it does).
5. Whether the retro board's "locked" rendering covers every write control (composer, votes, reactions, ROTI, health-check button, survey answers) once driven by `viewerIsObserver` instead of `isLocked`.
6. How the session snapshots of poker, whiteboard and games name their viewer block (where `viewerIsObserver` goes): the plan reads each builder.
7. ~~The German word for the facilitator role (today "Moderation").~~ Ruled in the 2026-10-03 revision: "Moderator" (§14).
8. Where the retro's board menu lives after plans 21 and 22 (the "Take control" entry goes beside the hand-over entry); the plan reads `components/retro/` first.
