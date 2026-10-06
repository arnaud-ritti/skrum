# Skrum — Navigation redesign: sidebar, Home, Sessions, Insights, Members — Design

Date: 2026-10-05
Status: **approved for planning** (owner, 2026-10-05: "go on new branch"), branch `navigation-redesign`. The design of §4 was approved in conversation the same day. §15 was not answered point by point: the plan follows its recommendations until the owner says otherwise. §16 lists what reading the code did not settle.
Supersedes, for the screens it names: the navigation model of `docs/design-system/components/Sidebar`, `ScreenDashboard`, `ScreenTeam`, `MobileDashboard`, the Sessions page of `docs/superpowers/specs/2026-10-21-plan-22-sessions-index-design.md` (§9.1, tabs) and the team page of `2026-10-21-plan-23-team-workspace-data-design.md`. Owner's word, 2026-10-05: "you can ignore mockups, work like an ui ux designer".

## 1. Problem statement

Found by walking the app as the seeded facilitator on 2026-10-05 (`main` at `15bb4fec`), then by reading the code.

1. Three screens answer the same question. The team page lists sessions once in "Recent sessions" and again per kind (Retrospectives, Planning poker, Whiteboards, Surveys); the Sessions page lists them by status; the Games page lists icebreaker rooms a third time.
2. Two sidebar entries are not pages. "Mood & ROTI" and "Members" lead to `#mood` and `#members` of the team page (`hooks/use-sidebar-model.ts`): the highlight changes, the page does not.
3. The real pages hide behind other labels. `teams.members.index` is reached by "Team settings" and is closed to plain members (`Gate::authorize('manageRituals')`); `teams.healthCheck.show` is reached only by a "Details" link in a card.
4. "Actions" sits in the "Team" group and opens the workspace's list unfiltered, while the team page's own button opens it with `?team=`.
5. Nothing outside the team page says a session is live. The only "live" notice is a one-shot flash after joining by invitation (`FlashesLiveSession`).
6. The Sessions page opens on a "Live" tab that is empty most of the time; "Upcoming" is nearly dead since scheduling is backlog; its rows carry less than the team page's summary of the same sessions (no date, no outcome, no Join).
7. The team page offers three ways to create each kind (header button, four tiles, a button per section) and gives its best side-column place to configuration (the six health check statements).
8. Breadcrumbs disagree on their root (workspace › Teams › team, team › Sessions, workspace › Workspace).
9. Inside a session there are three ways back: the collapsed sidebar, the topbar arrow, a "Back to the team" button in the page.

## 2. Goals

One job per screen, ordered by how often people do it:

1. Join what is live — Home's banner, the Sessions page's first block, a dot on the sidebar entry.
2. Start a session — one "New session" control.
3. Follow up actions — Home's first card, the Actions page scoped to the team.
4. Look back at a session — the Sessions page, one chronological list.
5. Read the team's trend — Insights.
6. Manage people and rituals — Members, Settings.

No function of a removed section is lost: §9.9 gives each one a new place.

## 3. Non-goals

- The workspace screens (All teams, Templates, workspace Members), the team switcher's menu, the account settings, the instance administration: unchanged (owner, 2026-10-05: "keep the current dropdown").
- Scheduling a session, a "next retro" reminder: still backlog.
- Live refresh of the sidebar's dot or of the Sessions page: both are read at each visit (§8).
- New charts or new measures. Insights re-houses what exists.
- Card thumbnails in the Sessions list (the whiteboard thumbnail of the team page is not carried over).

## 4. Decisions already taken (owner, 2026-10-05)

| Screen | Decision |
|---|---|
| Sidebar | "Team hub": the switcher (unchanged), "New session", then Home, Sessions, Actions, Insights; group Team: Members, Settings; group Workspace: Templates, All teams. "Mood & ROTI" and "Games" leave. |
| Home | "What now": a live banner, then four cards. |
| Creation | One "New session" button; the four kind tiles only for a team with no session. |
| Sessions | One list grouped by sprint, live sessions pinned on top, chips by kind; no status tabs. |
| Session row | Rich row: kind tile, title, meta, outcome, date, status, Join when live. |
| Insights | One page, four tabs: Mood & ROTI, Health check, Estimates, Games. |
| Members | Its own page, people only, readable by every team member. |
| Settings | Left sub-navigation: General, Rituals, Integrations, Data & export. |
| Actions | Opens on the current team; a switch "team / All teams". |
| In a session | No sidebar. One back arrow. A facilitator leaving a live session is asked: Stay / Leave, keep running / End it. |
| Live signal | A dot and a count on the "Sessions" entry only. |
| Topbar | The page's title, no breadcrumb. |
| Phone | Tab bar: Home, Sessions, (+), Actions, More. |

## 5. Rules

- The front rules of `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` §5 and its back-end conventions §9.2 apply, except where they bind to a mockup this spec supersedes.
- `docs/database.md` rules 1 to 12 apply to every query: Eloquent and the standard builder only, no driver test, an explicit tie-breaker on every sort.
- Texts are informal (tu / tú / du) in every locale the app ships.
- Reuse before writing: `SessionRow`, `SubNav`, `LoadMoreFeed`, `EmptyState`, `TeamOpenActionsCard`, `TeamActivityCard`, `TeamRotiCard`, `TeamMoodCard`, `TeamCreateTiles`, `ConfirmDialog`, `MembersTable`, `GamesLeaderboard`, `EstimationHistory` exist and are moved, not rewritten.

## 6. Domain and data

### 6.1 Live sessions of the current team

"Live" keeps the rules of `ListTeamSessions` (`SessionState::Live`, per kind), with one change for icebreaker rooms (§17.2). A new shared Inertia prop `liveSessions: { count: int } | null` (null without a current team) carries the number of live sessions of the current team the viewer may see. It is evaluated lazily at each full page visit: five `count()` queries, one per kind.

### 6.2 The Sessions list

`ListTeamSessions` gains a reading that is not bound to one state:

- `live`: every live session of the team (kind filter applied), newest first, not paged.
- `sessions`: every session that is not live (upcoming and finished together), `updated_at` descending then `id` descending, 20 per page, same cursor as today.
- `counts`: the number of sessions per kind and in all (live included), for the chips.

Each row keeps today's fields and gains:

| Field | Value |
|---|---|
| `sprint` | `{ number, label, startsOn, endsOn }` of the sprint that contains the row's `updatedAt` (`SprintCalendar::sprintOn`), or null |
| `outcome` | retro: average ROTI and number of action items; poker: tasks and total points; survey: answers; icebreaker: game and players; whiteboard: null |
| `canDelete`, `canDuplicate` | what the row menu may offer (§9.9) |

Grouping uses `updatedAt`, the sort key, so a group is never split by paging. A row with no sprint goes under "Outside a sprint"; a team with no sprint at all (`hasSprints` false) is grouped by calendar month.

### 6.3 Home

`TeamsController@show` stops sending `retros`, `pokerGames`, `pokerPresence`, `whiteboards`, `whiteboardTemplates`, `healthStatements`, `canManageHealthStatements`, `pendingInvitations`, `inviteLink`, `inviteRoles`, `availableMembers`, `roleOptions`. It keeps `recentSessions` (five, live excluded), `openActionItems`, the two action counts, `moodTrend` (deferred), `activity`, `schedule`, the new-session options, and sends `liveSessions` (the live rows, for the banner), `hasSessions` (false for a team with no session of any kind) and `latestHealthScore` (deferred with the trend; null when no health check has results).

## 7. Permissions

| Screen or control | Who |
|---|---|
| Home, Sessions, Insights (four tabs), Members (the list) | `view` on the team |
| "New session" (sidebar, header, phone) | shown when the viewer may create at least one kind in the team |
| Members: "Invite", "Invitation link", pending invitations | `invite`, as today |
| Members: role change, removal | `manageMembers`, as today |
| Settings › General, Data & export | `update`, as today |
| Settings › Rituals | `manageRituals`, as today |
| Settings › Integrations | `manageIntegrations` and a provider enabled, as today |
| Sidebar "Settings" | shown when one section is allowed (`TeamSettingsSections`), leads to the first allowed |
| Leave dialog's "End it" | the viewer may end this session by the session's own rule (§9.7) |

The only widening: the Members list opens to every member of the team. It shows what the team page's members card shows today (name, e-mail, role) plus "last seen".

## 8. Real time

None added. The sidebar's count and the Sessions page are computed at request time. A session that starts while a page is open appears at the next visit.

## 9. Screens

### 9.1 Sidebar

```
+------------------------+
| skrum                  |
| [DT Demo Team       v] |   switcher, unchanged
| [ +  New session     ] |
|                        |
| Home                   |
| Sessions        o 1    |   dot + count when live
| Actions      2 overdue |
| Insights               |
|                        |
| TEAM                   |
| Members                |
| Settings               |
|                        |
| DEMO WORKSPACE         |
| Templates              |
| All teams              |
|                        |
| Administration         |   instance admins only
| [Fran Facilitator   v] |
+------------------------+
```

- `NavKey` becomes `dashboard | sessions | actions | insights | members | settings | templates | teams | admin`; `mood` and `games` go. The label of `dashboard` is "Home".
- Every entry is a page. `links.members` is `teams.members.index`, `links.insights` is `teams.insights.show`, `links.actions` carries `?team=<current team>` when a team is current.
- "New session" opens the New session dialog. On a page that does not carry the dialog's options it leads to Home with the `new` intent, which opens it there.
- Collapsed to icons: "New session" is a "+" icon with a tooltip; the live count becomes a dot on the Sessions icon, as the overdue dot does on Actions.
- Without a current team the Team entries are absent, as today; Actions stays under Workspace.
- The command palette lists the same entries from the same `links`; "Mood & ROTI" and "Games" leave, "Insights" joins.
- `use-team-anchor.ts` and the `#mood`, `#members`, `#sessions` anchors are removed.

### 9.2 Home — `teams.show`

```
Demo Team  (oo) 2 members  Sprint 1 - day 1 of 14     [+ New session]
+------------------------------------------------------------------+
| o Live   ygtytg - Icebreaker - 1 player                   [Join] |
+------------------------------------------------------------------+
+ Needs attention ---------------+ + Team pulse -------------------+
| 1 open - 0 overdue             | | ROTI 4.0  ^ +0.5   _.-'       |
| o fdhfdgh   Max - Nov 3        | | Health check: not run yet     |
|                     See all -> | |                   Insights -> |
+--------------------------------+ +-------------------------------+
+ Recent sessions ---------------+ + Activity ---------------------+
| Poker Oct 5      34 pts  Ended | | Ada completed fdhfdgh - 2 h   |
| Demo Retro   ROTI 4.0    Done  | | Ada ended Poker Oct 5 - 3 h   |
|               All sessions ->  | |                               |
+--------------------------------+ +-------------------------------+
```

- Header: team mark, name, the avatar stack (a link to Members), the schedule line, "New session". The buttons "Open action items", "Team games" and the gear leave: the sidebar carries them.
- Live banner: the newest live session with "Join"; with several, "+n more" leads to Sessions. Absent when nothing is live. It replaces the flash-only `LiveSessionBanner`; the `liveSession` flash is removed when nothing else reads it.
- Needs attention: the team's open action items, overdue first, five at most, "See all" to Actions on the team.
- Team pulse: the latest average ROTI, its change, a sparkline; the latest health score or "not run yet"; "Insights". A skeleton while the trend loads.
- Recent sessions: the five newest sessions that are not live, as compact rich rows; "All sessions".
- Activity: as today.
- A team with no session (`hasSessions` false): the four kind tiles take the place of the live banner and of the Recent sessions card. They disappear with the first session.
- The per-kind sections, the health check statements card, the members card and the invite dialog leave the page.
- Phone: one column, in the order banner, Needs attention, Recent sessions, Team pulse, Activity.

### 9.3 Sessions — `teams.sessions.index`

```
Sessions                                              [+ New session]
[All 4] [Retro 2] [Poker 1] [Whiteboard 0] [Survey 0] [Icebreaker 1]

LIVE NOW
+------------------------------------------------------------------+
| o  ygtytg                                                        |
|    Icebreaker - Quick question - 1 player       Now  Live [Join] |
+------------------------------------------------------------------+

SPRINT 1 - Oct 5 -> Oct 18
+------------------------------------------------------------------+
| P  Poker Oct 5, 2026                                             |
|    Planning poker - 2 tasks - 34 pts          Oct 5  Ended  ... >|
+------------------------------------------------------------------+
| R  Demo Retrospective                                            |
|    Retro - 2 people - ROTI 4.0 - 0 actions    Oct 5  Done   ... >|
+------------------------------------------------------------------+
                                                         Load more
```

- Query: `kind` (one of the five, optional), `q`, `before`. `tab` is no longer read; an old link with `?tab=` shows the whole list.
- Chips are links carrying `kind`; each shows its count; "All" is the default. `aria-current` on the active one.
- "Live now" appears only when a session is live under the current filter. Its rows carry "Join".
- A session not started carries the badge "Not started"; a draft survey "Draft" (visible to its editor only, as today).
- The whole row is a link to the session; the row menu "..." (§9.9) is the only other control.
- With a kind chosen, a line of links for that kind sits under the chips: Poker — "Estimation history", "Saved decks"; Whiteboard — "Whiteboard templates"; Icebreaker — "Leaderboard".
- Search stays in the topbar's search place, as today.
- Empty: no session at all — the `EmptyState` with "New session"; none under a chip — "No <kind> yet" with "New session"; none for a search — "No session matches".
- End of list: "You're all caught up · n sessions", as today.
- Phone: the chips scroll sideways; a row stacks its outcome under the meta line.

### 9.4 Insights — `teams.insights.show` and three existing routes

```
Insights
[Mood & ROTI] [Health check] [Estimates] [Games]
```

| Tab | Route | Content |
|---|---|---|
| Mood & ROTI | `teams.insights.show` (new) | `TeamRotiCard` at full width with its window (4, 8, all retros), then the ROTI of each retro as a list linking to the retro |
| Health check | `teams.healthCheck.show` | "Start a health check", `TeamMoodCard`; the statements manager leaves for Settings › Rituals, with a link "Edit the statements" for who may |
| Estimates | `teams.estimates.index` | `EstimationHistory`, without its "Back to the team" |
| Games | `teams.games.index` | the leaderboard with its period; the rooms list and "New room" leave for Sessions |

The tabs are links between four routes; the three existing URLs keep working and become the tabs. All four pass `active="insights"`.

### 9.5 Members — `teams.members.index`

```
Members - 2                          [Invitation link] [+ Invite]

Member                    Role          Last seen
Fran Facilitator (you)    Facilitator   Online          ...
Max Member                Member        Never           ...

PENDING INVITATIONS - 1
lea@acme.test             Member        2 days ago      Resend

(i) Facilitator drives phases, timer and reveal.
    Observer is read-only and does not vote.
```

`MembersTable` and `TeamInviteDialog` as today, on a page of their own, outside the settings shell, with `active="members"`. Controls follow §7; a plain member sees the list and the roles' note only.

### 9.6 Settings

```
+---------------+ + Sprints ---------------- [+ Add a sprint] +
| General       | | Sprint 1 - Oct 5 -> 18            Current |
| > Rituals     | +-------------------------------------------+
| Integrations  | + Default facilitators ---------------------+
| Data & export | + Retro templates and default columns ------+
+---------------+ + Health check statements ------------------+
```

- The shell and its `SubNav` stay. "Members & rituals" becomes "Rituals" at a new route `teams.rituals.show`, holding `SprintsCard`, `DefaultFacilitatorsCard`, `RetroTemplatesCard`, `DefaultColumnsCard` and the health check statements manager.
- The write routes of sprints, facilitators, templates and statements are untouched.
- The sidebar entry reads "Settings".

### 9.7 In a session

```
+------------------------------------------------------------------+
| <- Demo Team / Sprint 1 retro    1-2-3-4       2 online     (F)  |
+------------------------------------------------------------------+
|                         full-width board                         |
+------------------------------------------------------------------+
```

- `SessionFrame` renders no sidebar, for members as already for guests. The phone's sidebar trigger leaves with it.
- One exit: the topbar arrow, to the team's Home. The "Back to the team" buttons in page bodies are removed where the topbar arrow is present (ended retro, survey room, estimation history, saved decks, games). The "gone" screens (`room-gone`, `board-gone`), which have no topbar, keep theirs.
- Leave dialog. When the viewer may end the session and it is live, the arrow opens:

```
+ Leave Sprint 1 retro? ------------------------------------- x +
| The session is still running for 2 people.                    |
| Leave: it keeps running, you can come back.                   |
| End: it closes for everyone.                                  |
|                                                               |
| [Stay]              [Leave, keep running]            [End it] |
+---------------------------------------------------------------+
```

  "Stay" (also Esc and the cross) closes the dialog. "Leave, keep running" goes to Home. "End it" (destructive style) ends the session through the session's existing end action, then goes to Home. A member, an observer, a guest, or anyone on an ended session leaves at once.

  | Kind | "End it" calls |
  |---|---|
  | Retro | `retros.phase.update` to `completed`, from any open phase (§17.1); the dialog adds "The remaining phases are skipped." when phases are left |
  | Planning poker | `poker.status.update` to ended |
  | Icebreaker | `games.rounds.close.store` on the round in play |
  | Survey | no dialog: a survey stays open for days and is closed from its own screen |
  | Whiteboard | no dialog: nothing ends a board |

  If ending fails, the dialog stays open with the error; the viewer does not leave.

### 9.8 Topbar and phone

- Topbar: the sidebar toggle, the page's title, the search place, the page's actions, the bell. `AppLayout` takes `title` in place of `breadcrumbs`. Titles: Home shows the team's name; a settings section shows "Settings"; an Insights tab shows "Insights".
- Phone tab bar: Home, Sessions, (+), Actions, More. (+) opens the New session dialog as the sidebar's button does and is absent for a viewer who may create nothing. Sessions carries the live dot. "More" opens the sidebar sheet, as today.

### 9.9 Where each removed function goes

| Function (today) | New place |
|---|---|
| Team page › Retrospectives cards, "Summary", "Resume" | Sessions, chip Retro; the row opens the retro |
| Team page › Planning poker tables | Sessions, chip Poker |
| "Estimation history" | Insights › Estimates; link under the Poker chip |
| "Saved decks" | link under the Poker chip |
| Team page › Whiteboards, "Delete this board" | Sessions, chip Whiteboard; row menu "Delete" with the same confirmation |
| "Whiteboard templates" | link under the Whiteboard chip |
| Team page › Surveys, "Duplicate", "Delete" | Sessions, chip Survey; row menu |
| Team page › Health check statements | Settings › Rituals |
| Team page › Members card, "Invite" | Members |
| Team page › Mood trend | Home's Team pulse; Insights › Mood & ROTI |
| Games page › rooms, "New room" | Sessions, chip Icebreaker; New session |
| Games page › leaderboard | Insights › Games |
| Header "Open action items", "Team games", gear | sidebar: Actions, Insights, Settings |

### 9.10 Actions — `workspaces.actionItems.index`

The header gains a switch "<team> | All teams" that sets or removes `team`. On the team: the "Team" filter and the "Team" grouping are hidden. On all teams: today's page. Without a current team the switch is absent.

## 10. Migrations of existing data

None. No table changes.

## 11. Routes

| Route | Change |
|---|---|
| `GET w/{workspace}/teams/{team}/insights` → `teams.insights.show`, `TeamInsightsController@show` | new |
| `GET w/{workspace}/teams/{team}/rituals` → `teams.rituals.show`, `TeamRitualsController@show` | new; `manageRituals` |
| `teams.members.index` | `view` in place of `manageRituals`; people only |
| `teams.sessions.index` | `kind` added, `tab` no longer read |
| `teams.show` | fewer props (§6.3) |
| `teams.healthCheck.show`, `teams.estimates.index`, `teams.games.index` | same URLs, now Insights tabs |

## 12. Acceptance criteria

1. The sidebar lists, in order: New session; Home, Sessions, Actions, Insights; Team: Members, Settings; Workspace: Templates, All teams; Administration for an instance admin. No entry leads to an anchor.
2. With one live session in the current team, the Sessions entry shows a dot and "1"; with none, neither; collapsed, the dot alone. The count follows the viewer's rights (another member's draft survey is not counted).
3. "Actions" in the sidebar opens the list filtered on the current team; the switch to "All teams" removes the filter and brings back the Team filter and grouping.
4. "New session" in the sidebar opens the dialog from Home and from Sessions, and from any other page leads to Home with the dialog open. A viewer who may create nothing does not see it.
5. Home shows, for a team with sessions: the live banner only when a session is live, with a working "Join"; the four cards; no per-kind section, no statements card, no members card.
6. Home of a team with no session shows the four kind tiles and no Recent sessions card; after the first session the tiles are gone.
7. The Sessions page lists live sessions under "Live now" and every other session below, newest first, grouped by sprint; a session outside every sprint is under "Outside a sprint"; a team without sprints is grouped by month.
8. With 45 non-live sessions across the five kinds, the first page holds 20, "Load more" brings 20 then 5, with no duplicate, no gap, and no sprint group split in two headings.
9. Each chip shows its count and filters both blocks; the chip's links (Estimation history, Saved decks, Whiteboard templates, Leaderboard) appear for their kind only.
10. A row shows the outcome of its kind (§6.2), its date, its status; "Not started" and "Draft" appear as badges; `?tab=finished` on an old link shows the whole list.
11. The row menu deletes a whiteboard and deletes or duplicates a survey, each with today's confirmation and today's authorization; a viewer without the right has no menu.
12. Insights shows four tabs; each of `teams.insights.show`, `teams.healthCheck.show`, `teams.estimates.index`, `teams.games.index` renders its tab with "Insights" active in the sidebar; the Games tab holds no rooms list.
13. A plain member opens Members and sees every member with role and last seen, and no Invite, no invitation link, no pending invitations, no row action. A facilitator sees Invite and the pending invitations; a team manager also sees the row actions.
14. Settings shows General, Rituals, Integrations, Data & export by right; Rituals holds sprints, default facilitators, retro templates, default columns and the health check statements; a member who may not manage rituals gets 403 on `teams.rituals.show`.
15. No session screen renders the sidebar, at any width, for any role.
16. A facilitator who clicks the back arrow of a live retro, poker game or icebreaker round sees the leave dialog; "Stay" keeps them in; "Leave, keep running" leads to Home with the session still live; "End it" ends the session and leads to Home, where it is no longer live.
17. A member, an observer and a guest leave a live session with no dialog; a facilitator leaves an ended session, a survey and a whiteboard with no dialog.
18. No page shows a breadcrumb; the topbar shows the title of §9.8.
19. On a phone the tab bar reads Home, Sessions, (+), Actions, More; (+) opens the New session dialog; "More" opens the sidebar's entries.
20. The command palette offers Home, Sessions, Actions, Insights, Members, Settings, Templates, All teams (and Administration by right), and neither "Mood & ROTI" nor "Games".
21. Every function of §9.9's left column is reachable at its right column by a user who could reach it before.
22. Captures at 1440 and at a phone width, in light and dark, in English and French, of the sidebar, Home (with and without a live session, and empty), Sessions (all and one chip), Insights (four tabs), Members, Settings › Rituals and the leave dialog; the overflow check passes.
23. The unit, feature, arch and browser suites pass; `tests/Arch/DatabasePortabilityTest.php` passes.

## 13. Testing

- Feature: the shared `liveSessions` count per kind and per right; the Sessions list (live block, non-live paging, counts, kind filter, sprint and month grouping, the 45-row walk); `teams.members.index` by role; `teams.rituals.show` by role; `teams.insights.show`; the slimmer `teams.show`.
- Vitest: the sidebar model and entries, the grouping helper, the chips, the rich row per kind, the leave dialog's three paths and its absence, the tab bar.
- Browser: the walkthroughs that follow the old paths are rewritten to the new ones, not deleted. About 50 files name a string this spec moves (23 browser, 22 Vitest, 4 feature, 1 arch); the largest groups are "Back to the team" (22 files), `teams.games.index` (10), `#members` (11), `#mood` (8).
- Removing or renaming a test needs the owner's approval, file by file, in the plan.

## 14. Risks

1. Five more `count()` queries on every full page visit for the sidebar's dot. If measured as a cost, the count is cached for a few seconds per team; not built first.
2. About 50 test files move. The plan orders the work so each screen lands with its tests.
3. The release aimed at 2026-10-18 is 13 days away. This is built on a branch and merged after the release unless the owner says otherwise.
4. Grouping by the sprint of `updated_at`: a finished session touched later moves to a newer group. Accepted: it also moves in the order, as today.
5. Home loses the whiteboard thumbnails and the per-kind detail. Accepted by the owner's choice of "What now".

## 15. Decisions for the owner

1. **Page heading.** The topbar now shows the page's title, and most pages also open with the same word as their heading. Recommended: keep both in this change (the topbar title in the muted small style), and remove the in-page duplicates in a later pass if it reads badly. Alternative: remove the in-page heading on every page now.
2. **The mockups.** `docs/design-system/components/Sidebar`, `ScreenDashboard`, `ScreenTeam` and `MobileDashboard` will contradict the app. Recommended: add one line at the top of each README pointing to this spec; do not redraw the previews.
3. **Merge date.** Recommended: after the 2026-10-18 release (§14.3).

## 16. Not determined by reading

1. The exact phase value and authorization that close a retro, end a poker game and close an icebreaker round were read from the route list only (§9.7's table). The plan confirms each against its controller before the leave dialog is built. Whether the survey room has a topbar arrow at all (its "Back to the team" is in the page body today) is confirmed at the same time; if it has none, it keeps its button.
2. Whether "Whiteboard templates" and "Saved decks" are also reachable from inside the New session dialog today.
3. Which pages besides Home and Sessions already carry the New session dialog's options.
4. What reads the `liveSession` flash besides the team page.
5. The switcher's menu and the command palette were read in code, not operated: the browser automation did not open them. The phone layout and the instance admin's view were not walked.

## 17. Owner's answers of 2026-10-06

Asked when the build of the leave dialog met a rule this spec had read wrongly.

1. **A facilitator may end a retro from any open phase** through the leave dialog ("End from any phase"). `Retro::canMoveTo` accepted only the next or the previous phase (retro-board-core §"adjacent phase", retro-flow-extras "`canMoveTo` rejects skipping", front-rewrite "Neighbour rule"); it now also accepts `completed` from every open phase. Everything else of the neighbour rule stands: no other phase is skipped, and "Reopen" still lands on ROTI. Known and accepted: a retro ended early has no ROTI; the server accepts the same request outside the dialog. The dialog opens for the facilitator of a retro that is live by the list's rule (not completed, and started or holding a card), in every phase.
2. **An icebreaker room is live while it has a current round and something happened in it during the last 15 minutes** ("After 15 quiet minutes"), the rule whiteboards already follow (`ListTeamSessions::LiveWithinMinutes`). A room with rounds that has been quiet longer is Finished. Before, a room stayed live for ever once a round had started, because nothing clears its current round; the sidebar's dot never went out.

## 18. The team's activity — asked by the owner on 2026-10-06

Owner's word, on Home's card: "activity must be recent activity, create a page in Team, with all the activity paginated"; then, on the choices put to them: a sidebar entry and a link on Home; lines by day with "Load more", filters by kind and by person, and "add day filter".

### 18.1 Home

The card is titled "Recent activity", shows the five newest lines (ten before) and ends with the link "All activity" to the page of §18.3. Its empty text does not change.

### 18.2 Sidebar

A ninth entry, "Activity" (`History` icon), in the group Team, between Members and Settings. `NavKey` gains `activity`. The command palette lists it. On a phone it is in "More".

### 18.3 The Activity page — `teams.activity.index`

```
Activity
Everything that happened in Demo Team

[All] [Sessions] [Actions] [Members]      [Anyone v]  [Any day v]

TODAY
 (A) Ada Admin completed fdhfdgh                         07:10
 (A) Ada Admin ended the planning poker Poker Oct 5      06:40

YESTERDAY
 (A) Ada Admin created the whiteboard dfgdsfg            18:02
 (M) Max Member joined the team                          09:12

OCT 3
 ...
                                             [ Load more ]
```

- Route `GET w/{workspace}/teams/{team}/activity`, gate `view` on the team: whoever sees Home's card sees the page.
- Lines are the lines of Home's card (actor, sentence, subject as a link when it still exists), newest first (`created_at` then `id`, both descending), 30 per page, a cursor in `before`, "Load more" with the count left, the end line "You're all caught up · n events".
- Grouped by day. A day is read in the application's time zone, as sprints are. The server sends each line's day and today's date; the page writes "Today", "Yesterday", then the date in the viewer's locale, and the time of day beside each line.
- Filters, all in the query and combinable:
  - `group`: `sessions` (a retro started or completed, a poker game started or ended, a whiteboard created, a survey published or closed), `actions` (an action item completed), `members` (a member joined). Chips, "All" by default, `aria-current` on the active one.
  - `actor`: one member of the team. A select, "Anyone" by default, listing the team's members by name. Lines of a guest have no member: they show under "Anyone" only.
  - `day`: one day (`YYYY-MM-DD`). The application's date picker, "Any day" by default, with a way to clear it.
- Empty: no line at all — the card's text, "Nothing has happened in this team yet."; filters that match nothing — "No activity matches." with "Clear filters".
- Not built: an export, kinds of event the application does not record today, live refresh, an activity of the whole workspace.

### 18.4 Acceptance criteria

24. Home's card reads "Recent activity", shows at most five lines and links to the Activity page.
25. The sidebar shows "Activity" between Members and Settings for whoever sees the team; the palette offers it.
26. With 65 events, the page shows 30, "Load more" brings 30 then 5, with no duplicate and no gap, including when several events share a second.
27. Each chip keeps only its kinds; the person filter keeps only that member's lines and drops a guest's; the day filter keeps only the lines of that day in the application's time zone, including a line written just before and just after midnight.
28. Filters combine, stay in the address, and survive "Load more".
29. A user who cannot view the team gets 403; an unknown `group`, an `actor` who is not a member of the team and a malformed `day` are refused.
30. Database code is portable (no date function in a query: a day is two bounds).

## 19. ROTI values in colour — asked by the owner on 2026-10-06

Owner's word, on the list "Average ROTI per retro" of Insights: "ROTI value can be colored".

A ROTI value takes the colour of its score, on the five-step scale the retro's own ROTI screen already draws (1 "Waste of time" to 5 "Excellent"). An average takes the colour of the score it rounds to (3.5 reads as 4). The number and the word "ROTI" stay as text: colour is never the only sign.

Where: the list of Insights › Mood & ROTI, the outcome of a retro's row on Sessions and in Home's Recent sessions, the figure of Home's Team pulse. Nowhere else in this change.

31. On those four places a ROTI of 4.0 and one of 2.0 show in the colours of the scale's steps 4 and 2, in light and in dark, with the contrast the scale already has on the retro's ROTI screen.

## 20. eNPS — asked by the owner on 2026-10-06

Owner's word: "create a eNPS default template for survey, and add it to insights"; then, on the choices put to them: both scores (the team, then the company), and a tab of its own with the score, the split and the history.

### 20.1 The template

A third built-in survey template, `enps`, named "eNPS", beside Health check and Team pulse, offered wherever they are (the New session dialog's survey form, the `new=survey&template=` intent). Its questions are copied into the survey and stay editable, as Team pulse's are:

| # | Kind | Text | Required | Match key |
|---|---|---|---|---|
| 1 | NPS (0 to 10) | How likely are you to recommend working in this team to a friend or colleague? | yes | `enps_team` |
| 2 | NPS (0 to 10) | How likely are you to recommend our company as a place to work? | yes | `enps_company` |
| 3 | Text | What is the main reason for your scores? | no | `enps_reason` |

The picker's line: "Would people recommend the team and the company? Two scores from 0 to 10."

### 20.2 Insights › eNPS — `teams.enps.show`

```
Insights
[Mood & ROTI] [Health check] [eNPS] [Estimates] [Games]

+ Latest eNPS ------------------------ [Start an eNPS survey] +
|  +32     ^ +12 since the last one                           |
|  eNPS October - Oct 5 - 9 answers                           |
|  [#### promoters 5 ][== passives 2 ][.. detractors 2 ]      |
+-------------------------------------------------------------+
+ History ----------------------------------------------------+
| eNPS October      Oct 5     9 answers     +32   [##=..]     |
| eNPS September    Sep 4     8 answers     +20   [##==.]     |
+-------------------------------------------------------------+
```

- A fifth tab, between Health check and Estimates. Route `GET w/{workspace}/teams/{team}/enps`.
- It follows the **team** score (question `enps_team`). The company score is read in each survey's own results, one click away: every line links to the survey's results.
- A survey counts when it belongs to the team, was made from the `enps` template, stands alone (not attached to a retro), is closed, and still holds an NPS question with the match key `enps_team` that has at least one answer. A survey whose team question was removed or retyped does not count.
- The score is the one the survey's results already compute for an NPS question (promoters 9–10, detractors 0–6, the percentage of the first minus the percentage of the second, rounded): the same code, not a second formula. The change is against the previous survey that counts; absent for the first.
- Whatever rule the results page applies before showing figures (who may read them, a floor of answers if there is one) applies here unchanged.
- "Start an eNPS survey" for who may create a survey in the team; it opens the New session dialog on the survey form with the template chosen.
- History: the 24 newest, newest first, each with its closing date, its answers, its score and the split bar.
- Empty: "No eNPS survey has closed yet." with the button, or without it for who may not create one.

### 20.3 Acceptance criteria

32. The New session dialog offers "eNPS" among the survey templates; a survey created from it holds the three questions of §20.1, in order, with their kinds, match keys and required flags, and they can be edited.
33. `new=survey&template=enps` opens the dialog on the survey form with eNPS chosen.
34. With promoters 5, passives 2 and detractors 2 on the team question, the tab shows +33 (5/9 − 2/9, rounded) and the three counts; with an earlier survey at +20 it shows a change of +13.
35. A draft, an open survey, a survey of another template, one attached to a retro, one of another team, and an eNPS survey whose team question was removed are absent from the tab.
36. The tab is the third of five on every Insights page and marks "Insights" in the sidebar; each history line opens that survey's results.
37. Who may not read a closed survey's results does not read the tab's figures.
