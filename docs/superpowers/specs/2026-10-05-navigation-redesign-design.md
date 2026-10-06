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

### 20.4 eNPS on Home — asked by the owner on 2026-10-06

Owner's word, on Home's Team pulse card: "in team pulse it can be nice too".

```
+ Team pulse ---------------------------------- Insights +
| Average ROTI                                           |
| 4.0 / 5    ^ +0.5 since the previous retro             |
|                                                        |
| Health check: not run yet                              |
| eNPS: +32   ^ +12 since the last one                   |
+--------------------------------------------------------+
```

The card gains one line under the health check: the latest team eNPS of §20.2 with its sign and its change, linking to Insights › eNPS; "eNPS: not run yet" when no survey counts. The figure arrives with the trend (deferred), under the same reading rule as the tab.

38. Home's Team pulse shows the latest team eNPS and its change, or "not run yet", and the line opens Insights › eNPS; who may not read the tab's figures does not get the figure on Home.

## 21. Team pulse: three figures of the same weight — asked by the owner on 2026-10-06

Owner's word, on Home's Team pulse card: "Health Check is not well displayed" (it was one muted line of text under a large ROTI). It replaces the card's drawing in §9.2 and in §20.4.

```
+ Team pulse ------------------------------------------- Insights +
| Average ROTI          Health check          eNPS                |
| 4.0 / 5               2.8 / 5               +32                 |
| ^ +0.5 since the      v -0.4 since the      ^ +12 since the     |
|   previous retro        previous one          last one          |
+-----------------------------------------------------------------+
```

- Three figures side by side, each built the same way: a small label, the value in the large type, the change under it as the chip ROTI has today (up in the positive tone, down in the negative tone, absent when there is nothing to compare with).
- A figure without data keeps its place and reads "Not run yet" in muted text where the value would be (ROTI: "No retro yet").
- Each figure is a link to its Insights tab: Mood & ROTI, Health check, eNPS.
- The ROTI value keeps the colour of its score (§19). The health score and the eNPS stay in the text colour: their change chip carries the direction.
- From 20rem to the width where three no longer fit, the figures stack, one per line, label and value on one row.
- The health check's change is against the previous health check that has a score.

39. The card shows ROTI, health check and eNPS as three figures of the same size, each with its change when one exists and "Not run yet" otherwise; each opens its Insights tab; nothing overflows at 20rem.

## 22. The deck picker of the New session dialog — asked by the owner on 2026-10-06

Owner's word, on the poker form of the dialog: "use 2 col instead of 4 for card decks, highlight the card preview in a section". With four columns a deck's name is cut ("Modified Fib…") and its values too; the cards of the chosen deck sit loose under the grid.

```
Deck                                          + New deck
+ Fibonacci ------------+ + Modified Fibonacci ----+
| 0 1 2 3 5 8 13 21 34… | | 0 ½ 1 2 3 5 8 13 20 …  |
| Built-in              | | Built-in               |
+-----------------------+ +------------------------+
+ T-shirt sizes --------+ + Powers of 2 -----------+
| XXS XS S M L XL XXL   | | 0 1 2 4 8 16 32 64     |
| Built-in              | | Built-in               |
+-----------------------+ +------------------------+

+ CARDS OF FIBONACCI · 13 --------------------------+
|  [0] [1] [2] [3] [5] [8] [13] [21] [34] [55] [89] |
|  [?] [☕]                                          |
+---------------------------------------------------+
```

- The deck tiles are laid out in two columns; one column when the picker is too narrow for two (a container rule, so the same picker stays right in a narrower place such as the room's settings).
- The cards of the chosen deck are shown in a section of their own under the tiles: a framed, lightly tinted panel with an overline "Cards of :deck · :count", the cards wrapping inside it. The section follows the selection.
- Nothing else of the picker changes: the selection, "New deck", the built-in mark, the keyboard order.

40. In the New session dialog the decks are in two columns and "Modified Fibonacci" is read in full at 1440; the cards of the chosen deck sit in a titled section that changes with the selection; at 20rem the tiles are in one column and nothing overflows.

## 23. Retro form of the New session dialog: the columns explain the template — asked by the owner on 2026-10-06

Owner's word, with three captures (the template tiles; the template's preview panel at the very bottom of the long list; the "Columns" editor): "The explanation is too far. hide it, adjust this to do that role". With 52 built-in templates the preview panel sits under the whole list, far from the tile that was picked; the "Columns" block, which is right there, cuts every title and description ("(Hypo…", "Imagine the pro…").

```
Template                                              <- Back
[tiles ...]                       (no preview panel under the list)

Columns · 4                                     + Add a column
Pre-mortem · Analysis
+ (Hypothetically) The project  ::+ + What didn't we do?      ::+
|   failed! What went wrong?      | |                           |
| Imagine the project already     | | Steps the team skipped on |
| failed — describe how it        | | the way to that failure   |
| happened                        | |                           |
+---------------------------------+ +---------------------------+
+ What current problems really ::+ + Any other concerns?      ::+
|   worry you?                    | |                           |
| Problems that exist today and   | | Anything else that nags   |
| would make the failure worse    | | at you and has no owner   |
+---------------------------------+ +---------------------------+

Colour of "(Hypothetically) The project failed! …"
(o) (o) (o) (o) (o) (o) (o) (o)                  Delete column
```

- The template picker of the dialog no longer shows the preview panel under its list ("Template preview"). The picker elsewhere (the workspace's Templates page) keeps it.
- The "Columns" block takes that role:
  - under its heading, one line names the template in use and its category ("Pre-mortem · Analysis"); absent for columns that come from no template;
  - the columns are laid out two per row (one per row when the dialog is too narrow), and a column shows its whole title and its whole description, wrapped, with its colour as today; the grey placeholder bars of the cards leave;
  - everything the block does today stays: selecting a column, reordering by the handle and by keyboard, the colour row with the swap rule, "Add a column", "Delete column".
- Picking another tile updates the block at once, so the explanation is always beside the choice.

41. In the retro form of the dialog, no preview panel is rendered under the template list; after picking "Pre-mortem" the Columns block shows "Pre-mortem · Analysis" and the four columns with their full titles and descriptions, two per row at the dialog's width, one per row at 20rem with no overflow; reordering, colours, adding and deleting a column work as before.

## 24. The brand panel of the sign-in screens — asked by the owner on 2026-10-06

Owner's word, with two captures (their sign-in screen, whose right half shows the word "Laravel" alone; the panel with the promise and three sample notes): "auth screen should look like this without the badge, make card floating".

Why the owner saw "Laravel": the panel with the promise is shown on an instance that runs as Skrüm; an instance under another name or its own logo shows that brand alone (owner's answer 11-D4, unchanged). The owner's local `.env` names the application "Laravel", so it counts as rebranded. `config/app.php` also falls back to "Laravel" when no name is set.

- The badge "Open source · self-hostable" leaves the panel. The headline, the sentence and the three sample notes stay.
- The three notes float: each rises and settles by a few pixels in a slow loop, out of step with the others, keeps its tilt and offset, and carries the raised shadow. With "reduce motion" they do not move.
- The panel stays decoration: hidden from assistive technology, inert.
- An installation that sets no name is Skrüm: the fallback of `config/app.php` becomes "Skrum" (the value `.env.example` already gives).
- A rebranded instance keeps its brand alone on that half.

42. On an instance named Skrum the sign-in, register, password and magic-link screens show the panel without the badge, with the three notes moving slowly and independently; with "reduce motion" they are still; an instance with another name shows its brand alone; an installation without `APP_NAME` shows the Skrüm panel.

## 25. Settings: Rituals becomes three pages — asked by the owner on 2026-10-06

Owner's word, on Settings › Rituals: "its a bit messy, can we split it into sub pages ?"; then, on the choices put to them: three more entries, flat. It replaces §9.6's single "Rituals" section.

```
+----------------+  Sprints
| General        |
| > Sprints      |  + Sprints ---------------- + Add a sprint +
| Retrospectives |  | Sprint 1 - Oct 5 -> 18         Current  |
| Health check   |  | [Start the next sprint]                 |
| Integrations   |  | Default length  [1w][2w][3w][4w]        |
| Data & export  |  | Retro day [None v]   Time [--:--] [Save]|
+----------------+  +-----------------------------------------+
```

| Entry | Holds | Opens for |
|---|---|---|
| General | as today | `update` |
| Sprints | the sprints card (the sprints, starting the next one, the default length, the retro day and time) | `manageRituals` |
| Retrospectives | default facilitators and the rotation, retro templates, default columns | `manageRituals` |
| Health check | the health check statements | `manageRituals` to read; editing stays with `update`, as today |
| Integrations | as today | as today |
| Data & export | as today | `update` |

- The sub-navigation lists the six in that order, each by right; the sidebar's "Settings" leads to the first one allowed.
- The page "Rituals" (`teams.rituals.show`), which this branch introduced, leaves with its address; nothing was released with it. The write routes of sprints, rituals, facilitators, templates and statements do not change.
- Links that led to Rituals lead to the page of their subject: "Edit the statements" on Insights › Health check to Settings › Health check; any link to the sprints to Settings › Sprints.
- The cards themselves are moved, not redrawn.

43. Settings shows General, Sprints, Retrospectives, Health check, Integrations, Data & export by right; each of the three new pages holds exactly the cards of the table; a facilitator opens the three and reads the statements without the controls to change them; a plain member gets 403 on each; no link in the application leads to the former Rituals address.

## 26. Members: adding a member is a dialog — asked by the owner on 2026-10-06

Owner's word, on the Members page: "add a member can be a modal instead this small form". The page showed, under the table, a small card "Add a member" with a picker, a role and a button; it also read "Members" twice (the page's heading, then the table card's own title and count).

```
Members · 2          [Invitation link]  [Add a member]  [+ Invite]

Member                    Role             Last activity
Fran Facilitator          [Facilitator v]  36 minutes ago    ...
Max Member                [Member v]       Never             ...
(i) Facilitator drives phases, timer and reveal. ...

+ Add a member -------------------------------------------- x +
| Someone already in Demo Workspace joins this team.          |
|                                                             |
| Member                                                      |
| [ (o) Pick a member                                     v ] |
|   (A) Ada Admin        admin@skrum.test                     |
|   (L) Lea Martin       lea@acme.test                        |
| Role                                                        |
| [ Member                                                v ] |
|                                                             |
|                                      [Cancel]     [Add]     |
+-------------------------------------------------------------+
```

- The card under the table leaves. A button "Add a member" sits in the page's header, between "Invitation link" and "Invite", for who may manage the members. It opens a dialog with the same two fields and the same request as the card.
- The member picker shows each person with their avatar, their name and their e-mail, in the list and once chosen (owner, 2026-10-06: "add the user avatar in the user select"). The same holds for the person filter of the Activity page (§18.3).
- When every member of the workspace is already in the team, the button is disabled and says why ("Everyone in :workspace is already in this team.").
- On success the dialog closes and the table shows the new row; an error of the server shows in the dialog, under its field, and the dialog stays open.
- The table card loses its own title and count: the page's heading "Members · n" says it once.

44. The Members page has no "Add a member" card; a team manager opens the dialog from the header, adds a workspace member with a role, and sees the row; a facilitator and a plain member have no such button; with nobody left to add the button is disabled with its reason; the word "Members" heads the page once.

## 27. Templates: one "New template" menu, and the retro template editor as a dialog — asked by the owner on 2026-10-06

Owner's word, with three captures (the workspace's Templates page; the retro template editor sliding in from the right; the "Create a deck" dialog): "New model must be a dropdown for the 2 types. Use a modal instead slideover to be coherent with [the deck dialog]". This lifts, for these two points, §3's "the workspace screens are unchanged".

```
Templates                                    [+ New template v]
                                              +----------------+
                                              | Retro template |
                                              | Poker deck     |
                                              +----------------+

+ New template · Retro -------------------------------------- x +
| Start from a built-in template        | LIVE PREVIEW          |
| [ Pick a template               v ]   | +-------------------+ |
| Name                                  | | o Untitled        | |
| [                                 ]   | | ----              | |
| Category        Visibility            | +-------------------+ |
| [Essentials v]  [Me][Team][Workspace] |                       |
| COLUMNS                         1/10  |                       |
| :: (o) [Column title          ] [del] |                       |
|        [Help question (optional)]     |                       |
| [+ Add a column]      9 more available|                       |
+---------------------------------------+-----------------------+
|                                        [Cancel]   [Save]      |
+----------------------------------------------------------------+
```

- "New template" on the Templates page is a menu with two entries, "Retro template" and "Poker deck"; each opens the dialog the section's own button opens ("Create a template", "Create a deck"). Whiteboard templates are still saved from a board, so they are not in the menu.
- The retro template editor (create and edit) opens in a centred dialog, built like the deck dialog: the title with a close control, the form on the left and the live preview on the right, a footer with "Cancel" and "Save". Below the width where two columns fit, the preview goes under the form and the body scrolls inside the dialog.
- Wherever the editor opened as a panel from the side, it now opens as that dialog (the Templates page, and the team's retro templates in the settings).
- Fields, rules, messages and what is saved do not change.

45. On the Templates page "New template" opens a menu of two entries and each opens its dialog; creating and editing a retro template happens in a centred dialog with the form beside its preview and "Cancel" / "Save" in a footer; no editor slides in from the side anywhere; at 20rem the dialog scrolls and nothing overflows; a template saved through it is the same as before.

### 18.5 The person filter — asked by the owner on 2026-10-06

Owner's word, on the Activity page with the person filter open: "add the user avatar". The capture also shows a gap of §18.3: Ada Admin, a workspace manager who is not a member of the team, wrote most of the lines and is not in the filter.

- Each person of the filter shows their avatar beside their name, in the list and on the chosen value; "Anyone" has none.
- The filter lists the members of the team **and** every other user who has at least one line in the team's activity, by name. `actor` accepts any of them; another id is still refused. A guest's lines stay under "Anyone" only.

46. The person filter shows an avatar for each person; a workspace manager who acted in the team without being a member is listed and filters to their lines; an id that is neither a member nor an actor of the team is refused.

### 18.6 The page's empty states — asked by the owner on 2026-10-06

Owner's word, on the page filtered to nothing (one line of text and a button at the left edge): "make the empty state nicer".

```
[All] [Sessions] [Actions] [Members]            [Anyone v] [Any day v]

+ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
|                          (illustration)                           |
|                             ACTIVITY                              |
|                 No activity matches these filters                 |
|               Try another kind, person or day.                    |
|                        [ Clear filters ]                          |
+ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
```

Both empty states of the page use the application's empty state (the dashed, centred panel with its illustration, an overline, a title, a line and an action, as on the Sessions and Templates pages):

- filters that match nothing: "No activity matches these filters" / "Try another kind, person or day." / "Clear filters";
- a team where nothing happened yet: "Nothing has happened in this team yet." / "Sessions, completed actions and new members show up here." / "New session" for who may create one.

47. Each of the two empty states of the Activity page is the centred panel with its title, its line and its action; "Clear filters" returns to the unfiltered page.

## 28. The whiteboard form of the New session dialog — asked by the owner on 2026-10-06

Owner's word, on the whiteboard form (templates in three columns, "Carte des récits u…" and every description cut): "use 2 cols too", as for the decks (§22).

```
Template
+ [ thumbnail            ] + + [ thumbnail            ] +
| Blank                    | | Brainstorming            |
| An empty canvas.         | | A question, a space for  |
|                          | | the ideas, then a sort.  |
+--------------------------+ +--------------------------+
+ [ thumbnail            ] + + [ thumbnail            ] +
| User story map           | | Impact map               |
| Activities, steps and    | | From the goal to the     |
| stories laid out in rows | | actors, impacts and work |
+--------------------------+ +--------------------------+
```

- The whiteboard template tiles are laid out two per row (one per row when the form is too narrow for two), by the same container rule as the decks.
- A tile shows its whole name and its whole description, wrapped; the thumbnail keeps its proportions and takes the tile's width.
- Selection, keyboard order and the tiles' content do not change.

48. In the whiteboard form the templates are two per row at the dialog's width, "User story map" and its description read in full, and at 20rem they are one per row with no overflow.

### 28.1 No cut names in the retro template tiles — asked by the owner on 2026-10-06

Owner's word, on the retro template tiles of the dialog ("Les 3 A (Aimé, Appris, …", "Le Bon, la Brute et le Tru…"): "dont make elision".

A retro template tile shows its whole name, wrapped on as many lines as it needs; the tiles of one row take the height of the tallest. The rule of this dialog is now the same for decks (§22), columns (§23), whiteboard templates (§28) and retro templates: a name or a description is never ended with "…".

49. In the retro form no template tile ends its name with "…": "Le Bon, la Brute et le Truand" reads in full, in French and in German, at the dialog's width and at 20rem.

### 21.1 The three figures in colour — asked by the owner on 2026-10-06

Owner's word, on the health check figure of Team pulse ("2,8 / 5" in the text colour beside a coloured ROTI): "colored too". It replaces §21's "the health score and the eNPS stay in the text colour".

- The health check score takes the colour of its step on the same five-step scale as ROTI (§19): 2.8 reads as 3.
- The eNPS takes the tone of its side: the detractors' tone below zero, the promoters' tone above zero, the text colour at zero. These are the tones the survey results already give the two ends of the split bar.
- The change chips keep their own up and down tones.

50. On Home's Team pulse a health score of 2.8 shows in the colour of step 3 and one of 4.2 in the colour of step 4; an eNPS of −10 shows in the detractors' tone, +32 in the promoters' tone, 0 in the text colour; in light and in dark.

## 29. Sessions rows: the right side in columns — asked by the owner on 2026-10-06

Owner's word, on the Sessions list: "elements on right are strange aligned". The date and the status sat on the row's second line, at the bottom, while "Join", the "…" menu and the chevron were centred; and the date moved left or right from one row to the next, depending on whether the row had a status, a menu or a button.

```
| [k] ygtytg                                       Now      Live     [Join]   > |
|     Icebreaker · Draw and guess · 2 players                                   |
| [k] eNPS Oct 6  [Draft]                          Oct 6                 ...  > |
|     Survey                                                                    |
| [k] Health check Oct 6                           Oct 6    Ended        ...  > |
|     Survey · 3 answers                                                        |
| [k] Poker Oct 5, 2026                            Oct 5    Ended             > |
|     Planning poker · 2 tasks · 34 pts                                         |
```

- The right side of a row is four columns of fixed width, the same on every row of the list: the date (right-aligned), the status, the action (the "Join" button or the "…" menu, or nothing), the chevron. A row without one of them keeps the column empty, so dates sit under dates and statuses under statuses.
- The four are centred on the row's height, like the kind tile on the left.
- "Draft" and "Not started" stay the badge beside the title; the status column of such a row is empty.
- On a phone the date and the status go under the meta line, as today; the action and the chevron stay at the right, centred.
- The same row serves Home's Recent sessions: the same alignment there.

51. On the Sessions page at 1440 the dates of all rows share one right edge and the statuses one left edge, whatever the row holds; date, status, action and chevron are centred on the row; at a phone width nothing overflows.

## 30. The icebreaker room's settings dialog — asked by the owner on 2026-10-06

Owner's word, on the dialog "Room settings" (a name, two selects of uneven width under their labels, a switch on the left, two buttons): "make it nicer".

```
+ Room settings ------------------------------------- x +
| Name                                                  |
| [ ygtytg                                            ] |
|-------------------------------------------------------|
| Who can join                  [ Team members only v ] |
| Who may enter the room with its link or its code.     |
|-------------------------------------------------------|
| Language of words and questions        [ Français v ] |
| The language the games draw their words from.         |
|-------------------------------------------------------|
| Reactions                                       ( o) |
| Players can send emoji reactions during the game.     |
|-------------------------------------------------------|
|                                 [Cancel]    [Save]    |
+-------------------------------------------------------+
```

- The dialog is built like the other session settings of the application (the poker room's and the retro's): after the name, each setting is a row with its label and one line of help on the left and its control on the right, rows separated by a rule, the switch at the right like the selects.
- The two selects take the width of their widest choice and align on the right edge.
- The footer is set apart by a rule, "Cancel" then "Save", as in the deck dialog.
- On a phone a row stacks: label and help, then the control at full width.
- Fields, choices, validation and what is saved do not change.

52. The room's settings dialog shows the name, then three rows (who can join, language, reactions) each with a help line and its control at the right edge, and a footer set apart; at 20rem the rows stack and nothing overflows; saving behaves as before.

## 31. The card composer of the retro board — asked by the owner on 2026-10-06

Owner's word, on the box where a card is written or edited (the keyboard hints and "Cancel" on one line, "Save" and the counter on the next, far from each other): "make it more ux friendly".

```
+----------------------------------------------------+
| The deploy took two hours on Friday                |
|                                                    |
|                                                    |
|----------------------------------------------------|
| 36/280                          [Cancel]  [ Save ] |
| Enter to save · Shift+Enter for a new line · Esc   |
+----------------------------------------------------+
```

- One row of actions under the text: the counter at the left, "Cancel" then the primary button at the right, side by side. The primary button keeps the word it has today for the case (adding or editing a card).
- The keyboard hints go on a quiet line of their own under that row, and say what the keys really do with the same verb as the button ("Enter to save", not "publish" beside a button that reads "Save"); the line is absent on a touch device and when the composer is too narrow for it.
- The counter stays muted until the text nears the limit, takes the warning tone from 90 % and the destructive tone at the limit, where the primary button is disabled as today.
- The text area keeps the focus when the composer opens, grows with its text, and keeps what Enter, Shift+Enter and Esc do today.

53. The composer shows the counter, "Cancel" and the primary button on one row, with the two buttons adjacent; the hint line uses the button's verb and is absent on a touch device; the counter changes tone at 90 % and at the limit; Enter, Shift+Enter and Esc behave as before.

### 31.1 The card's own actions — asked by the owner on 2026-10-06

Owner's word, on a card of the board with its two icon buttons: "reduce a bit the space between edit and delete and reduce the icon size".

On a retro card the "Edit" and "Delete" icon buttons sit closer together (the tight gap of an icon group) and draw their icon one step smaller on the scale. Each button keeps its hit area, its accessible name, its tooltip and its visible focus.

54. On a card the two icons are one size step smaller and closer together than before; each button still measures at least the application's small icon-button size and is reached by the keyboard with a visible focus.

### 31.2 The card's footer — asked by the owner on 2026-10-06

Owner's word, on a card whose footer shows the author at the left, then the drag handle and the comments count floating in the middle with nothing at the right: "strange spaces".

```
+----------------------------------------------+
| The deploy took two hours on Friday          |
| (+)                                          |
| (A) Ada [You]                     [c] 0   :: |
+----------------------------------------------+
```

A card's footer has two groups: the author (avatar, name, "You") at the left edge, and the card's controls at the right edge, in one order on every card — votes when the phase has them, the comments count, the edit and delete icons when the viewer may use them, the drag handle last. A control that is absent takes no room: the group closes up against the right edge instead of leaving a hole. The gap inside the group is the one of §31.1.

55. In every phase a card's controls sit together against the right edge of its footer in the same order, with no empty slot between or after them, whichever of them the phase and the viewer's rights show.

### 31.3 Edit and delete always shown — asked by the owner on 2026-10-06

Owner's word, on the same card with the pointer over it: "icon appear on hover may be keep the icons". The hole of §31.2 was the room kept for two icons that only showed under the pointer.

```
+----------------------------------------------+
| The deploy took two hours on Friday          |
| (+)                                          |
| (A) Ada [You]            [c] 0  [e] [d]   :: |
+----------------------------------------------+
```

On a card the viewer may edit or delete, the two icons are always visible, in the muted tone, and take the full tone under the pointer and with the keyboard focus. Nothing on a card appears only on hover: a phone and a keyboard have none. A card the viewer may not change shows neither icon and keeps no room for them.

56. The edit and delete icons of one's own card are visible without the pointer over it, at a phone width too; another participant's card shows neither and its controls sit against the right edge.

### 31.4 A narrow card never orphans a control — asked by the owner on 2026-10-06

Owner's word, on a grouped card with four controls (ungroup, comments, edit, delete) where "Delete" fell alone to a second line at the left: "space strange".

```
wide enough                                narrow
+------------------------------------+     +--------------------------+
| Text of the card                   |     | Text of the card         |
| (A) Ada [You]   [u] [c]0 [e] [d]   |     | (A) Ada [You]            |
+------------------------------------+     |         [u] [c]0 [e] [d] |
                                           +--------------------------+
```

The controls of §31.2 are one block that does not break between two of its controls. When the author and the block do not fit on one line, the whole block goes to a line of its own under the author, against the right edge. The order of the block, complete: votes, ungroup (on a card of a group), comments, edit, delete, drag handle.

57. At every column width from 20rem up, in every phase, no control of a card sits alone on a line: the controls are either all beside the author or all on the line below, against the right edge.

### 31.5 The vote control is one unit — asked by the owner on 2026-10-06

Owner's word, on two cards in the voting phase (on the card that holds three of the viewer's votes, the dots and the "−" stay beside the comments while "+ Vote 3" falls to a second line at the left): "voting also break render".

```
no vote of mine yet                       three votes of mine, narrow card
+--------------------------------------+  +--------------------------------+
| Text of the card                     |  | Text of the card               |
| (A) Ada [You]     [c]0  [+ Vote 0]   |  | (A) Ada [You]            [c] 0 |
+--------------------------------------+  |          ooo  [-]  [+ Vote 3]  |
                                          +--------------------------------+
```

- The viewer's dots, the "−" that takes a vote back and the "+ Vote n" button are one unit that never breaks; it is the last thing at the right edge of the controls block (this corrects §31.2 and §31.4, which put votes first).
- When the block does not fit beside the author it goes to the line below, as §31.4 says; when even the block is wider than the card, it breaks once, before the vote unit, which then takes a line of its own against the right edge. It never breaks inside the vote unit.
- With many dots the dots wrap inside their own area or are summed up as today; the buttons do not move apart.

58. In the voting phase, at every column width from 20rem up and with zero to the maximum of votes on a card, the dots, "−" and "+ Vote n" stay together on one line at the right edge; no button of a card is alone at the left of a line.

## 32. One guest setting for every kind of session — asked by the owner on 2026-10-06

Owner's question, with two captures (the icebreaker form: "Access — Who can join [Team members only v]"; the other forms: "Invitation — Allow guests without an account ( o)"): "why on icebreaker I have this and on others this?".

Why: the games were built with a stored choice of two values, "team" and "link" (`GameRoomAccess`), drawn as a select; the retro, the poker game, the whiteboard and the survey store a yes/no and draw a switch. "Link" means exactly what the switch means — anyone with the link joins without an account. Two drawings for one setting, by history, with no reason a user could see.

- The icebreaker form of the New session dialog shows the same block as the other forms: the heading "Invitation" and the row "Allow guests without an account" with its help line and its switch. On is the stored value "link", off is "team". Nothing changes in what is stored or sent.
- The room's settings dialog (§30) shows the same row with the same switch in place of its "Who can join" select; its two other rows stay.
- The select and its two choices leave both screens.

59. The icebreaker form and the room's settings show "Allow guests without an account" as a switch, worded and placed as on the retro form; a room created with the switch on is joined by a guest through its link, and with the switch off refuses one; rooms that exist keep their setting.

### 32.1 The switch's thumb sits centred in its track — asked by the owner on 2026-10-06

Owner's word, on a switch seen close: "toggle are not well aligned". The cause is in the shared switch: its track has a one-pixel transparent border, the thumb is centred vertically inside that border (one pixel of room above and below) but moved two pixels in from the side, so the gap around the thumb is not the same on its three near sides, off and on.

The thumb keeps the same gap to the track's edge above, below and on its near side, in both positions; the travel between the two positions is adjusted to match. The track's size, its border (kept for forced-colours modes), the colours and the motion do not change. Every switch of the application takes the correction.

60. Measured in the browser, a switch's thumb is at the same distance from the top, the bottom and the near side of its track, off and on, at 100 % and at 200 % zoom.

## 33. A page's side panel reaches the window's edge — asked by the owner on 2026-10-06

Owner's word, on the survey editor on a wide screen (the "Settings" panel ends before the window does, an empty strip at its right): "the right sidebar is not on right".

Why: every page of the application is drawn in a column of at most 75rem, centred. The survey editor's panel is pulled to the edge of that column, not of the window; on a window wider than the column plus the sidebar the column's right margin shows beside the panel.

```
| sidebar |            questions (centred)            |  Settings  |
|         |                                           |  panel     |
|         |                                           |  to the    |
|         |                                           |  edge      |
```

- A page that has a side panel takes the whole width of the window beside the sidebar: its panel is against the window's right edge at every width, from the top bar to the bottom, and its main column keeps the reading width it has today, centred in the room that is left.
- This holds for the survey editor and for any other page of the application built the same way (a panel pulled to the column's edge).
- Pages without a side panel keep the centred column of 75rem.
- Below the width where the panel goes under the content, nothing changes.

61. On the survey editor at 1440, 1920 and 2560 pixels wide the settings panel touches the window's right edge and reaches the bottom; the questions keep their width and are centred between the sidebar and the panel; at a phone width the page is as before.

### 33.1 A survey's questions are read in full — asked by the owner on 2026-10-06

Owner's word, on the survey editor ("Les échanges avec mes collègues on…", every question cut before its badges): "dont use elision on questions".

```
+----------------------------------------------------------------+
| (1) Les échanges avec mes collègues ont   [Scale 1–5] [Required]|
|     été productifs                                              |
|     [ 1 ]   [ 2 ]   [ 3 ]   [ 4 ]   [ 5 ]                       |
+----------------------------------------------------------------+
```

In the survey editor and in its preview a question shows its whole text, wrapped on as many lines as it needs; the kind and "Required" badges stay at the right of the first line, and go under the text when the card is too narrow for both. The same holds wherever the application lists a survey's questions for reading (the room where people answer already shows them in full: check, and correct if not).

62. In the survey editor no question ends with "…": the six statements of a health check and the three questions of an eNPS read in full in French and German, at 1440 and at a phone width, with their badges on screen.

## 34. The retro board's horizontal scrollbar — asked by the owner on 2026-10-06

Owner's word, on a board whose columns are wider than the window (a thick grey bar across the canvas, floating above the reactions and the facilitator's dock): "ugly scrollbar".

- The columns scroll sideways in an area that goes down to the bottom of the canvas, so its scrollbar lies along the bottom edge of the window, under the floating reactions bar and the dock, not in the middle of the canvas. The columns keep the room they need above the docks (the area's bottom padding), so no card is hidden behind them.
- The bar is the thin kind, in the application's muted tones on a transparent track, in light and in dark, and stays visible when the columns overflow: the board must still say that it scrolls.
- The same thin bar is used by the other scrolling areas of a session screen that show a default system bar today (a long column, the side panels), so a session has one look of scrollbar.
- Scrolling by wheel, trackpad, touch, keyboard and by dragging the bar works as before.

63. On a board with more columns than fit, the horizontal bar is thin, in the theme's tones, at the bottom edge of the window under the docks, in light and dark; every column can still be reached by scrolling; no card is covered by the docks at the end of a scroll.

## 35. The session's top bar at a medium width — asked by the owner on 2026-10-06

Owner's word, on a retro's top bar in a window of about 940 pixels (the title cut to "Dem… / Spr…", the phases showing three steps of seven above a scrollbar of their own, eleven controls squeezed after them): "topbar broken".

```
wide (all fits)
| <- Demo Team / Sprint 1 retro  (1 Writing)-(2)-(3)-(4)-(5)-(6)-(7)  [<][>] o [t] (ooo) 3 online [1 guest] [c][s][share][...][k] (me) |

medium
| <- Sprint 1 retro        [<] 1/7 Writing [>]        o [t]  (ooo) 3  [share] [...] (me) |

phone
| <- Sprint 1 retro   [<] 1/7 [>]   [...] (me) |
```

The bar gives its room away in a fixed order as it narrows, and nothing in it scrolls:

1. The session's name always keeps a readable width (it shortens last, never to three letters); the team's name above it leaves first.
2. The phases: every step with the current one named when they fit; otherwise the compact form "n/7" with the current phase's name between the previous and next arrows; on a phone "n/7" alone. Never a row of steps with a scrollbar. The full list of phases stays reachable from the compact form (it opens them in a small menu) for who may change phase.
3. Presence: the avatars with "n online"; then the avatars with the number only; the guests' badge folds into the presence's own popover.
4. Secondary controls (the pointer mode, the session's settings, the keyboard shortcuts) move into the "…" menu, in that order; "Share" and the timer stay out as long as there is room, then join it.
5. Always visible: the back arrow, the name, the phase control, "…", the viewer's avatar.

The same order holds for the poker room's and the icebreaker room's top bars with the controls they have.

64. From 20rem to 120rem wide the retro's top bar never shows a scrollbar, never cuts the session's name under ten characters while a secondary control is still out of the "…" menu, and every control stays reachable (in place or in "…"); at 940 pixels it reads as the "medium" drawing; the phase can be changed from the compact form.

### 35.1 The same bar at full width — asked by the owner on 2026-10-06

Owner's word, on the same bar in a window of about 1700 pixels (five named steps of seven, "Ac…" cut, above a scrollbar, while "Previous", "Next", "Synced", "Share" keep their words): "here too".

The phases scroll at every width today, because the steps keep their names while the bar has no room for seven of them. The order of §35 gains what comes before the compact form:

```
very wide
| <- Demo Team · Sprint 1 / Sprint 1 retro  (1 Writing)-(2 Grouping)-(3 Vote)-(4 Discussion)-(5 Actions)-(6 ROTI)-(7 Done)  [< Previous][Next >] o Synced [t] (ooo) 3 online [1 guest] [c][s][Share][...][k] (me) |

wide (the capture)
| <- Demo Team · Sprint 1 / Sprint 1 retro  (1 Writing)-(2)-(3)-(4)-(5)-(6)-(7)  [<][>]  o  [t] (ooo) 3 online [1 guest] [c][s][share][...][k] (me) |
```

- The phases have three forms and take the richest one that fits whole: every step named; every step shown with only the current one named (the others are their number, their name in a tooltip); the compact "n/7" of §35. No form scrolls.
- Before the phases leave their first form, the words of the controls around them go: "Previous" and "Next" become their arrows, "Synced" its dot, "Share" its icon, each keeping its accessible name and a tooltip. Words are the first thing the bar gives away, the session's name the last.

65. At 1700 pixels the retro's top bar shows the seven phases without a scrollbar and without a cut name (each step named, or only the current one), and from 20rem to 160rem no part of the bar scrolls sideways.

## 36. The leave dialog: each choice with its consequence — asked by the owner on 2026-10-06

Owner's word, on the dialog a facilitator gets when leaving a live session ("Stay" alone at the left, two buttons at the right, three sentences above them): "button miss aligned, content a bit unreadable". It replaces the drawing of §9.7; who gets the dialog and what each choice does are unchanged.

```
+ Leave Sprint 1 retro? ---------------------------------- x +
| Still running for 3 people.                                |
|                                                            |
| +--------------------------------------------------------+ |
| | [->]  Leave, the session continues                     | |
| |       It keeps running. You can come back.             | |
| +--------------------------------------------------------+ |
| +--------------------------------------------------------+ |
| | [x]   End the session                                  | |
| |       It closes for everyone. The remaining phases     | |
| |       are skipped.                                     | |
| +--------------------------------------------------------+ |
|                                                  [ Stay ]  |
+------------------------------------------------------------+
```

- The two ways out are two full-width choices, one under the other, each a button holding its icon, its name and, under the name, what it does. The reader no longer matches a sentence above to a button below.
- "End the session" is drawn as the destructive choice (the destructive tone on its icon, name and border), and is the second, so it is not the one under the pointer or the first reached by the keyboard.
- "Stay" is the dialog's only footer button, at the right; Esc and the cross do the same.
- The line about who is still in the session opens the dialog and is absent when the viewer is alone. "The remaining phases are skipped." shows only when phases remain (§17.1).
- While ending, both choices and "Stay" are disabled and the destructive choice shows the progress; an error shows above the choices and the dialog stays open, as before.
- The focus opens on "Stay".

66. The leave dialog shows two stacked choices with their consequence under each and "Stay" alone in the footer; the keyboard reaches Stay, Leave, End in an order where End is not first; ending, leaving, staying and a failed ending behave as criterion 16 and Review Focus 4 say.

## 37. Survey results: the waiting state — asked by the owner on 2026-10-06

Owner's word, on the results page of a survey that has fewer answers than its floor (an icon and a sentence centred, then a short bar at the far left and "1 / 3" at the far right): "rework the progress".

```
+--------------------------------------------------------------+
|                         (hourglass)                          |
|               Results appear from 3 answers                  |
|               1 so far · 2 more to go                        |
|                                                              |
|            [##########--------------------]  1 / 3           |
+--------------------------------------------------------------+
```

- The waiting state is one centred block: the icon, a title that gives the floor, a line that gives where it stands ("1 so far · 2 more to go", "No answer yet · 3 to go"), then the bar and its count together, the bar of a fixed readable width with the count right after it.
- The bar is the application's progress component, named for assistive technology ("1 of 3 answers"), and fills in the primary tone.
- Nothing about who sees results, or when, changes.

67. Below the floor, the results page shows the centred block with the bar and "n / floor" side by side under the text, at 1440 and at a phone width; with 0, 1 and 2 answers of 3 the line and the bar agree; at the floor the results show as before.

## 38. Branding: the instance takes its new look on save — asked by the owner on 2026-10-06

Owner's word, on Administration › Branding after "Save": "on save refresh the ui". The colours, the radius and the favicon of an instance are written into the page's own document when it is first loaded; the application then moves from page to page without loading the document again, so a saved brand showed only after the administrator reloaded the browser by hand.

- After a write that changes the brand (saving the form, uploading or removing a logo or the favicon, "Back to Skrüm"), the browser loads the page again in full: the sidebar, the buttons, the logo, the favicon and the page's title show the saved brand at once, with the confirmation toast.
- A save that changes nothing does not reload.
- A failed save (validation) stays on the form with its errors and its unsaved values, as today.
- Other people get the new brand at their next full page load, as today.

68. An instance administrator changes the primary colour and saves: without touching the browser's reload, the sidebar's active entry and the primary buttons are in the new colour and the toast "Branding saved." shows; the same holds after a logo upload and after "Back to Skrüm"; an invalid colour leaves the form with its error and no reload.

## 39. Every list of people shows avatars — asked by the owner on 2026-10-06

Owner's word, on the "Add" menu of the team's default facilitators (names only): "add the avatar". It is the third time (§26, §18.5), so it becomes a rule.

Wherever the application lets someone pick a person from a list — a select, a menu, a combobox — each person is shown with their avatar beside their name, in the list and on the chosen value, through the one shared piece the selects already use. Known places without it today: the "Add" menu of the default facilitators. The task looks for the others (a facilitator picker in the New session dialog, an assignee or owner picker, a member picker in the settings) and gives each the same piece; a place that already shows avatars is left alone.

69. The "Add" menu of the default facilitators shows each person's avatar; no select, menu or combobox of the application lists people by name alone (the task's report lists every place checked).

### 39.1 The health check statements' list keeps its corners — asked by the owner on 2026-10-06

Owner's word, on the list of statements in Settings › Health check (the frame's side and top lines stop short of each other at the corners): "corners are cut".

The list of statements is one framed block with the application's card radius on its four corners; its rows are separated by rules and carry no frame of their own, so the frame is drawn once, whole, and a row's hover or drag state is clipped by the rounded frame.

70. The statements' list shows four whole rounded corners, in light and in dark, at rest, while a row is hovered and while one is dragged.

### 39.2 Room above "New session" in the sidebar — asked by the owner on 2026-10-06

Owner's word, on the sidebar's header (the "New session" button right under the team switcher): "add a bit space before new session button".

The "New session" button is set apart from the team switcher above it by the gap the sidebar puts between two groups, not the gap between two entries of one group; the gap below the button, before "Home", is at least as large. Collapsed to icons, the "+" keeps the same distances.

71. In the sidebar the distance between the team switcher and "New session" equals the distance between two groups of entries, expanded and collapsed.

### 39.3 The live count of the Sessions entry is a chip — asked by the owner on 2026-10-06

Owner's word, on the sidebar's Sessions entry (a dot, then "1", not on the same line): "the live dot and count are not aligned, and put them into a chip".

```
| Sessions                     ( o 1 ) |
| Actions                  ( 2 overdue ) |
```

The dot and the number sit together in one pill at the end of the entry, centred on its line, as the "n overdue" pill of Actions is: the pill in the live (positive) tone at low strength, the dot and the figure in that tone at full strength, the figure in tabular numbers. Its accessible name stays "Sessions, n live". Collapsed to icons, the dot alone stays on the icon as today. The dot does not pulse under "reduce motion".

72. With a live session the Sessions entry ends with one pill holding the dot and the count, both centred on the entry's text line; the pill and the "overdue" pill of Actions share one height and one right edge.

### 39.4 The ROTI chip's figure is centred — asked by the owner on 2026-10-06

Owner's word, on a ROTI chip seen close ("3,5" sitting off-centre in its green pill): "not well aligned".

The figure of a ROTI chip (and of the health score drawn the same way) is centred in its pill on both axes: the same room left and right of the figure, and above and below its digits, whatever the locale's decimal mark. The chip aligns on the baseline of the text it sits in ("ROTI", the meta line of a row).

73. Measured in the browser, the box of the figure "3,5" is centred in its chip within half a pixel on both axes, in French and in English, on Insights, on a Sessions row and on Home.

### 39.5 The brand in the phone's top bar — asked by the owner on 2026-10-06

Owner's word, on the top bar at a phone width (the page's title, the search and the bell; the sidebar and its logo are not on screen): "add small skrum (or branding) logo".

```
| [U]  Demo Team                                   [search] [bell] |
```

Below the width where the sidebar is shown, the top bar starts with the instance's mark: the Skrüm symbol, or the instance's own logo on a rebranded one, small, before the page's title. It is a link to the home of the application, named after the instance for assistive technology. From the width where the sidebar shows its logo, the top bar shows none.

74. At a phone width every page of the application shows the instance's mark at the left of the top bar, linking home, the instance's own logo when it has one; at a desktop width the top bar shows no logo and the sidebar keeps its own.

### 39.6 The command palette's corners do not cut its content — asked by the owner on 2026-10-06

Owner's word, on the command palette (the search field's focus outline sliced by the dialog's rounded top corners, the list's scrollbar running into the rounded edge, the footer's corners clipped): "corners cut content".

```
+------------------------------------------------------+
|  Q  Search or run a command…                  [Esc]  |
|------------------------------------------------------|
|  ACTIONS                                           : |
|  [+] New retrospective                             : |
|  ...                                                 |
|------------------------------------------------------|
|  [^][v] navigate  [↵] open  [Esc] close   21 results |
+------------------------------------------------------+
```

- The search field has no outline of its own inside the palette: the palette is the focused surface (it keeps its own border and shadow), and the field is set off from the list by one rule under it. Nothing is drawn where a rounded corner would cut it.
- The list scrolls inside the palette with the thin themed scrollbar of §34, held off the palette's edge, between the rule under the field and the rule above the footer, so it never meets a rounded corner.
- The footer and the header keep an inner padding at least equal to the palette's radius at their corners.
- Keyboard focus stays visible: the active item's highlight is the focus indicator of the list, as today.

75. In the command palette no line, outline or scrollbar is cut by a rounded corner, in light and dark, with a short and a long list; the field is still announced as focused and typing filters as before.

## 40. The emoji picker — asked by the owner on 2026-10-06

Owner's word, with two captures (the grid of every emoji: uneven rows, a first category that starts mid-list, the system scrollbar, no field and no way to know what an emoji is; the quick reactions with "More emoji…" under them): "rework the emoji picker".

```
quick reactions                      the picker
+-------------------------------+    +------------------------------------------+
| 👍  ❤️  👏  🎉  🤔  👎   [+] |    | Q  Search an emoji…                      |
+-------------------------------+    |------------------------------------------|
                                     | RECENT                                   |
                                     | 👍 🎉 🙏 😅 🚀 ✅ 👀 🔥               |
                                     | SMILEYS & EMOTION                        |
                                     | 😀 😃 😄 😁 😆 😅 🤣 😂               |
                                     | 🙂 🙃 😉 😊 😇 🥰 😍 🤩               |
                                     | PEOPLE & BODY                          : |
                                     | 👋 🤚 🖐 ✋ 🖖 👌 🤌 🤏               |
                                     |------------------------------------------|
                                     | 🎉  Party popper              [skin tone]|
                                     +------------------------------------------+
```

- **Quick reactions.** The row of the six usual reactions ends with one "more" button ("+", named "More emoji"); it opens the picker in the same place. The search field that sat under the row leaves: searching belongs to the picker.
- **The picker**, one design wherever an emoji is chosen (a card's reactions, the session's reactions, a column or a template that takes an emoji):
  - a search field at the top, focused on opening, filtering by the emoji's name in the interface's language;
  - "Recent": the emoji this person picked last on this browser, most recent first, one row; absent until there is one;
  - then the categories, each under its heading, the heading staying at the top of the list while its emoji scroll; rows of eight cells of one size, the glyphs centred, the same rhythm from the first row to the last;
  - the thin themed scrollbar (§34), inside the picker's edge;
  - a footer that names the emoji under the pointer or the keyboard focus, large glyph then name, with the skin tone choice at its right when the library gives one; before any emoji is pointed at, a hint ("Pick an emoji");
  - "No emoji matches" when the search finds nothing; a quiet loading state while the emoji data arrives.
- **Keyboard:** arrows move in the grid, Enter picks, Esc closes and gives the focus back to where it was; typing goes to the search field.
- Picking an emoji closes the picker and does what it did before.

76. The quick row ends with a "More emoji" button that opens the picker; the picker shows the search field, "Recent" after a first pick, headed categories in even rows of eight, a footer naming the pointed emoji, and the thin scrollbar; search filters in French and English; arrows, Enter and Esc work; nothing is cut at 20rem.

### 35.2 A guest sees the instance's mark in the session's top bar — asked by the owner on 2026-10-06

Owner's word, on a game room seen by a guest (the bar starts with the room's name; nothing says whose application this is): "on invited add the logo in topbar".

```
| [U]  Games / test  [Decoded]            o  (o) 1 online  [1 guest]  [Français v]  [k]  (guest) |
```

A guest's session top bar starts with the instance's mark — the Skrüm symbol, or the instance's own logo when it has one — before the session's name, in every kind of session (retro, poker, whiteboard, survey, icebreaker). It is not a way out of the session for someone who has no account: it is not a link for a guest. A signed-in member keeps the back arrow in that place and no logo. In the order of §35 the mark is among what stays at every width.

77. A guest in each of the five kinds of session sees the instance's mark at the left of the top bar, the instance's own logo on a rebranded instance, and it is not a link; a member sees the back arrow and no mark.

## 41. Administration: check for a new version now — asked by the owner on 2026-10-06

Owner's word, on Administration › General › Updates (the version, the daily switch, "Never checked."): "add a verify now".

```
+ Updates ----------------------------------------------------------+
| Version  v1.0.0                                                    |
| ( o) Look for a new version once a day                             |
|      The instance asks GitHub once a day; nothing about the        |
|      instance is sent.                                             |
| Never checked.                                    [ Check now ]    |
+--------------------------------------------------------------------+
```

- A button "Check now" beside the line that says when the instance last checked. It asks the release feed at once, the same question the daily check asks, and nothing about the instance is sent.
- It works whether the daily switch is on or off: pressing it is the administrator's own request.
- While it asks, the button shows its progress and cannot be pressed again. Then the line reads "Checked just now." and a toast says the outcome: "You're on the latest version.", "Version :version is available.", or, when the feed cannot be reached or gives nothing usable, "The release feed could not be reached. Try again later." — in that case the last successful check and its date stay as they were.
- For instance administrators only, and no more often than a few times a minute.

78. An instance administrator presses "Check now": with a newer release in the feed the card and the rest of the administration show that version as available and the line says when it was checked; with the feed down the toast says so and the stored version and date do not change; a user who is not an instance administrator gets 403; a seventh press within a minute is refused.

### 40.1 The session's reactions bar opens the picker directly — asked by the owner on 2026-10-06

Owner's word, on the floating reactions bar of a session (its last button opens a popover that shows the same six reactions as the bar, then "More emoji…"): "to rework with the emoji picker".

```
the bar                                 its last button opens the picker
( 👍 ❤️ 👏 🎉 🤔 👎 | [☺+] )    ->     +------------------------------+
                                        | Q  Search an emoji…          |
                                        | RECENT   👍 🎉 🙏 …          |
                                        | SMILEYS & EMOTION  …         |
                                        | 🎉  Party popper             |
                                        +------------------------------+
```

The bar already shows the six quick reactions: its last button ("More emoji") opens the picker of §40 at once, above the bar, with no step that repeats the six. A card's reaction button, which shows no quick row of its own, keeps the quick row of §40 with its "+".

79. In a session the last button of the reactions bar opens the picker of §40 directly; the six quick reactions appear once on screen, in the bar; sending a reaction from the picker does what it did before and adds it to "Recent".

### 35.3 The phases are centred on the bar — asked by the owner on 2026-10-06

Owner's word, on a finished retro's top bar on a very wide screen (the phases sit left of the middle, because the right side of the bar holds more than the left): "the progress is not truly centred".

```
| <- Team / Sprint 1 retro          (v)-(v)-(v)-(v)-(v)-(v)-(v) [Done] [Reopen]          o Synced (ooo) 3 online [1 guest] [s][...][k] (me) |
|<------------- left ------------->|<--------- centred on the bar --------->|<------------------- right ------------------>|
```

The bar has three parts: the title at the left, the phase group in the middle, the controls at the right. The phase group — the steps, the phase's state ("Done") and the phase's own actions (previous, next, "Reopen") — is centred on the bar itself, not on the room left between the two sides, as long as both sides fit beside it. When a side is too wide for that, the group moves just enough to clear it, and the folding order of §35 applies before anything overlaps.

80. On a bar wide enough for all three parts, the middle of the phase group is at the middle of the bar within two pixels, on a live and on a finished retro, whatever the two sides hold; narrowing the window never makes the group overlap a side.

### 39.7 One gap on a finished retro's results — asked by the owner on 2026-10-06

Owner's word, on the results of a finished retro (the five figures in a row, then two columns of cards: the space between two figures, between the figures and the cards, and between the two columns are three different sizes): "use same gaps".

The results page uses one gap, from the scale, everywhere between its blocks: between two figures of the top row, between that row and the cards under it, between two cards of a column and between the two columns. The inner padding of the cards is not concerned.

81. On a finished retro's results, the horizontal gap between two figures, the vertical gap under the figures' row, the gap between two stacked cards and the gap between the two columns measure the same, at 1440 and at a phone width.

### 39.8 "Sort by votes" is a small icon in the column's header — asked by the owner on 2026-10-06

Owner's word, on a retro column (a button "Sort by votes" on a line of its own between the column's description and its first card): "move the 'Tri par votes' in top right corner icon only (small)".

```
+----------------------------------------------+
| o Liked                          [sort] (13) |
|   What you enjoyed or valued about the period|
| +------------------------------------------+ |
| | card                                     | |
```

The sort control moves to the column's header, at the right, beside the cards' count: a small icon button, without text, named "Sort by votes" for assistive technology and in a tooltip. It shows that it is on (the pressed state of the application's toggle buttons) and is announced as pressed. It appears in the phases and for the people it appeared for before. The line it occupied under the description is given back to the cards.

82. In a column's header the sort control is a small icon button at the right, before the count, with its name in a tooltip and `aria-pressed` following its state; sorting works as before; the column shows no button between its description and its first card.

### 39.9 The template editor's live preview reads in full — asked by the owner on 2026-10-06

Owner's word, on the live preview of the retro template editor (three small columns per row: "Environnem…", "Causes liées aux compétences, au…"): "preview still have elision".

The live preview of a retro template shows each column's whole title and whole description, wrapped; its columns are laid out two per row (one per row when the preview is too narrow), as the Columns block of the New session dialog is (§23), so that the two drawings of the same columns agree. The placeholder bars that stand for cards stay. The same preview component is used on the workspace's Templates page and in the team's retro templates: the rule holds there.

83. In the template editor's live preview and wherever a retro template is previewed, no column's title or description ends with "…": "Environnement" and its description read in full in French and German.

### 39.10 "Add" is the default facilitators card's own action — asked by the owner on 2026-10-06

Owner's word, on the card "Default facilitators" with nobody in it (a lone "+ Add" in the body, above the rotation switch): "the add button look like an error, move it as section action".

```
+ Default facilitators ------------------------------- [+ Add] +
| No default facilitator yet.                                  |
|--------------------------------------------------------------|
| Rotate the suggestion at every retro                    ( o) |
| Add a facilitator first.                                     |
| The person creating a retro can always choose someone else.  |
+--------------------------------------------------------------+
```

"Add" sits in the card's header, at the right, as "Add a sprint" does on the sprints card; it opens the same menu of people (with avatars, §39). The body lists the default facilitators, or says "No default facilitator yet." when there is none. The rotation switch and its lines stay under the list.

84. The default facilitators card shows "Add" in its header and no button in its body; with nobody chosen the body says so; adding and removing a facilitator work as before.

### 39.11 Content the team wrote is not cut — asked by the owner on 2026-10-06

Owner's word, on the "Default columns" card of the retro settings ("Quel vent gonfle no…", four pills cut): "elision here too". It is the fifth request of the kind (§28.1 template tiles, §33.1 survey questions, §39.9 the template preview, the deck names of §22), so it becomes a rule, with its limits.

- **Rule.** A text that is the content itself — a retro column's title or description, a template's or a deck's name, a survey's question or statement, a card's text — is shown whole, wrapped on as many lines as it needs, wherever the application shows it to be read or chosen: cards, tiles, pills, previews, lists of settings.
- **Not concerned:** the places that are a fixed-height line of chrome and name something for orientation — the sidebar, the top bars, a breadcrumb-like title, a table cell, a menu item, a toast. They may shorten a long name, with the whole name in a tooltip.
- **Here:** the default columns of the retro settings show each column's whole title; the pills wrap to as many rows as needed (two per row when four whole titles do not fit on one).

The task that applies this looks for the other places (a truncating class on one of those texts) and corrects them; its report lists every place checked.

85. The "Default columns" card shows the four titles of the "Sailboat" template in full, in French and German; the task's report lists each place where a column's title or description, a template's or deck's name, a question or a card's text was cut and is no longer.

### 39.12 "Group by" stays with its choices on a phone — asked by the owner on 2026-10-06

Owner's word, on the Actions page at a phone width (the label "Group by" ends the line of the team switch; its choices "Sprint / Assignee / None" start the next line beside "Select"): "Grouped by misplaced on mobile".

```
phone
[ Demo Team | All teams ]
Group by  [ Sprint | Assignee | None ]
[ Select ]
[ My actions 0 ] [ Overdue 0 ] [ To do 0 ] [ Done ]
[ Filters ]
```

The label "Group by" and its choices are one unit that never breaks between the two: on a narrow page the unit goes to a line of its own, label first. The team switch (§9.10) is a line of its own above it on a phone, and "Select" follows on the next line or beside the unit when it fits. On a wide page the row is as today.

86. From 20rem up, "Group by" is on the same line as its choices, immediately before them; no control of the Actions header is separated from its label.

### 35.4 An icebreaker room centres its game — asked by the owner on 2026-10-06

Owner's word, on an icebreaker room's top bar (the game's badge "Draw and guess" beside the room's name, at the left; the middle of the bar empty): "on game center the game type".

```
| <- Demo Team · Games / dfsdf                 [✎ Draw and guess]                 o [t] (o) 1 online [Invite] [s][k] (me) |
```

In an icebreaker room the badge that names the game in play sits in the middle part of the top bar (§35.3), centred on the bar, where a retro shows its phases. With no game chosen yet the middle part is empty. It folds as the phases do: on a narrow bar it keeps its icon and shortens its name last.

87. In an icebreaker room the game's badge is centred on the top bar within two pixels on a wide window, and stays visible down to a phone width.

## 42. The whiteboard: the same top bar rules, the facilitator's controls on the board — asked by the owner on 2026-10-06

Owner's word, with two captures (the whiteboard's top bar: a three-step path "Demo Team › Whiteboards › test", then presence, a pill holding the timer, "Lock the board" and "Bring everyone…" cut, then Export, Share, "…"; and that pill alone): "on whiteboard follow same topbar rules. This part must be IN the board on top right".

```
top bar
| <- Demo Team / test [edit]                                   o (o) 1 online   [Export] [Share] [...] [k] (me) |

the board
+---------------------------------------------------------------------------------------------------------------+
| [tools]                                                    ( [t]  [Lock the board]  [Bring everyone here] )   |
| [rail ]                                                                                                       |
|                                              canvas                                                           |
```

- **Top bar.** The whiteboard's bar follows §35 to §35.3 like the other sessions': the back arrow and the board's name with the team above it (no path of three steps; "Whiteboards" was a step to an anchor that no longer exists), the name still editable in place; three parts with an empty middle; presence, then the board's actions (Export, Share, "…", shortcuts), which give up their words and fold into "…" in the order of §35; nothing scrolls and no label is cut mid-word. A guest sees the instance's mark (§35.2).
- **The facilitator's controls** — the timer, "Lock the board", "Bring everyone here" — leave the top bar and float on the board, at its top right corner, as one pill, above the canvas and under the top bar, clear of the tools at the left and of anything else that floats on the board. Their words show in full; on a narrow board they become icons with their names in tooltips, and the pill never covers more than the corner. They are shown to who had them before; the state of each (a running timer, a locked board) reads on the pill as it did in the bar.
- Everyone else sees no pill; what a locked board tells them stays where it is today.

88. On a whiteboard the top bar shows the back arrow and the board's name, no three-step path, and never a cut label or a scrollbar from 20rem to 160rem; the facilitator sees the timer, "Lock the board" and "Bring everyone here" in one pill at the top right of the board with their whole names at 1440; a member who is not the facilitator sees no pill; locking, the timer and bringing everyone work as before.

### 42.1 Renaming a session from its top bar, in every kind — asked by the owner on 2026-10-06

Owner's word, about the pencil beside a whiteboard's name: "ship the edit if not present on the others".

```
| <- Demo Team / Sprint 1 retro [edit]      …
        click ->   | <- Demo Team / [ Sprint 1 retro______ ]   Enter saves · Esc cancels
```

The pencil beside the session's name, which renames it in place, is offered in the top bar of a retro, a planning poker game and an icebreaker room as it is on a whiteboard, to whoever may already rename that session in its settings (its facilitator or host). The server already accepts the new name for each kind (the session's settings); nothing changes there. A survey keeps the title field of its editor.

- One click (or Enter on the pencil) turns the name into a field holding it, selected; Enter or leaving the field saves, Esc cancels; an empty name is refused with the field's message and nothing is saved.
- The others in the session see the new name without reloading, as they already do when it is changed in the settings.
- Who may not rename sees no pencil. In the folding order of §35 the pencil leaves with the secondary controls; renaming stays in the session's settings.

89. A facilitator renames a retro, a poker game and an icebreaker room from the pencil of the top bar, as on a whiteboard: the new name shows for them at once and for another participant without a reload; Esc keeps the old name; an empty name is refused; a participant who may not rename has no pencil.

## 43. Voting on a card — asked by the owner on 2026-10-06

Owner's word, on cards in the voting phase (the viewer's votes as a row of dots that wraps on two lines at six, a lone "−", then "+ Vote 6" — a button whose number is the card's total, greyed once the viewer has voted): "rework the vote ui/ux". It replaces the vote unit of §31.5; its place in the footer (last, at the right edge, never broken) stays.

```
no vote of mine on the card          some of mine                         none left to give
[c] 0   (7)   [ + Vote ]             [c] 0   (7)   [ − | ● 3 | + ]        [c] 0   (7)   [ − | ● 3 | + ]
                                                                                              ^ off, says why
total hidden until reveal
[c] 0   (lock)   [ − | ● 1 | + ]
```

Two different things were drawn as one. They are now two:

- **My votes on this card** — a stepper. With none: one button "+ Vote". With one or more: "−", a dot and the number of my votes, "+", in the primary tone so a card I voted on is seen at a glance. The number replaces the row of dots: it never wraps and reads the same at 1 and at 12.
- **The card's total** — a quiet count before the stepper, with the votes icon, named "n votes" in its tooltip; while totals are hidden it is a small lock named "Total hidden until reveal". It is never inside a button.

Rules that do not change, said where they act:

- "+" is off when I have no vote left or reached the limit of a card; its tooltip says which ("You have used all your votes" / "You reached the limit of n votes on this card"). "−" takes one of mine back.
- The votes I have left stay shown once on the board, where they are today.
- Outside the voting phase a card shows its total alone, as today.
- Keyboard: "+" and "−" are buttons with their names ("Add a vote", "Remove a vote"); the number is announced with them ("Your votes: n").

90. In the voting phase a card shows its total (or the lock) apart from the stepper; with none of my votes the stepper is "+ Vote", with some it is "− n +" in the primary tone and never wraps, at 1 and at the maximum; "+" is off with its reason when no vote is left or the card's limit is reached; adding and taking back a vote change both numbers at once.

## 44. The whiteboard's Export holds the image too — asked by the owner on 2026-10-06

Owner's word, with two captures (the dialog the top bar's Export button opens, "Save as…", which offers the data file alone; the "…" menu, where "Save as image" sits between "Show animated reactions" and "Find on the board"): "add image export here instead of here".

```
+ Export -------------------------------------------------------- x +
| +-----------------------------+  +-----------------------------+ |
| |          (image)            |  |          (file)             | |
| | An image of the board, to   |  | Everything on the board, as | |
| | paste or share.             |  | a data file to open again.  | |
| | [ Save as image ]           |  | [ Download board data ]     | |
| +-----------------------------+  +-----------------------------+ |
+-------------------------------------------------------------------+
```

- The dialog the Export button opens offers the two ways out of a board side by side: an image, and the data file. "Save as image" opens the image export the "…" menu opened (its choice of format, background and scale is unchanged).
- "Save as image" leaves the "…" menu: everything that exports is behind Export.
- The dialog is titled "Export", like the button that opens it.
- Who could export an image before can still; who could not sees the data file alone, or no Export at all, as today.

91. The whiteboard's Export dialog shows "Save as image" beside "Download board data"; choosing it opens the image export and saves a picture of the board; the "…" menu has no "Save as image"; on a phone the two choices stack.

### 44.1 The Export dialog is the application's own — asked by the owner on 2026-10-06

Owner's word, on the same dialog (the drawing library's own window: its title "Save as…", its frame, its type, a button in a colour of its own): "rework the modal to match our ui". It replaces the drawing of §44; what §44 decided (the image beside the data, nothing that exports left in the "…" menu) stays.

```
+ Export the board ------------------------------------------- x +
| What                                                           |
| [ Image ]  [ Board data ]                                      |
|                                                                |
| Format            [ PNG | SVG ]            +----------------+  |
| Background        ( o)  With the board's   |    preview     |  |
|                         background         |                |  |
| Size              [ 1× | 2× | 3× ]         +----------------+  |
| Only the selection ( o)                                        |
|----------------------------------------------------------------|
|                                    [Cancel]   [ Download ]     |
+----------------------------------------------------------------+
```

- The Export button opens a dialog of the application — its frame, title, type, controls and buttons are the ones of every other dialog (the deck's, the template editor's) — and no window of the drawing library is shown for exporting.
- **What:** "Image" or "Board data", "Image" first.
- **Image:** the format (PNG or SVG), with or without the board's background, the size (1×, 2×, 3×; PNG only), "Only the selection" when something is selected on the board; a preview of what will be saved; "Download" saves the file named after the board.
- **Board data:** one sentence ("Everything on the board, as a data file to open again.") and "Download", the file of today.
- Esc, the cross and "Cancel" close it and give the focus back to the Export button. On a phone the preview goes under the options.
- An empty board: "Image" says there is nothing to draw yet and "Download" is off; "Board data" still works.

92. The Export button opens a dialog drawn with the application's dialog, fields and buttons; a PNG at 2× and an SVG without background are saved with the board's name and hold the board's drawing; "Only the selection" saves the selected shapes alone; "Board data" saves the same file as before; no window of the drawing library opens for exporting, and the "…" menu has no "Save as image".

## 45. The whiteboard's closed "Styles" panel takes no click and shows nothing — asked by the owner on 2026-10-06

Owner's word, on a board with one shape selected (four icons — duplicate, delete, group, link — floating at the left with no frame, and an area beside the tools that takes clicks though nothing is drawn there): "on shape select the select panel is clickable but not visible, it generates strange behaviour".

Why: the drawing library's own panel of shape properties is kept in the page while closed, hidden with `visibility: hidden`, because one of its controls needs its measured width when it opens. Hiding a box that way does not hide a child that declares itself visible — the four action buttons — and leaves the panel's frame in place to receive the pointer.

- While "Styles" is closed, nothing of the library's panel is visible — no button, no frame — and nothing of it receives the pointer or the keyboard focus: a click where it lies reaches the board (selects, drags, draws) as anywhere else on the canvas.
- The panel still opens from "Styles" as today, complete, with its controls measured right (the reason it was kept in the page still holds).
- The application's own selection bar under the shape is the only set of shape actions on screen while "Styles" is closed.

93. With a shape selected and "Styles" closed, no control of the library's panel is visible, a click in the area it occupies selects or drags a shape lying there, and the Tab key does not stop on any of its controls; opening "Styles" shows the panel whole with its opacity value in place.

## 46. A locked element can be reached and unlocked — asked by the owner on 2026-10-06

Owner's word, on the whiteboard: "locked element are not selectable and not unlockable".

Why: the selection bar locks a shape and would unlock it — its lock button turns into "Unlock" for a locked selection — but the drawing library does not select a locked element when it is clicked, so the bar never comes back for it. The way back exists in the code and cannot be reached.

```
click on a locked shape                         the "…" menu of the board
        +-----------+                           | ...                         |
        |  (lock)   |   <- a small mark on      | Unlock everything (3)       |
        |   Fin     |      every locked shape   | ...                         |
        +-----------+
   ( Locked   [ Unlock ] )   <- the bar, with this one action
```

- **A locked element says it is locked:** a small lock mark at its corner, for who may change it, so a shape that does not respond explains itself.
- **A click on a locked element** shows the selection bar for it, reading "Locked" with one action, "Unlock". It does not move, resize or restyle the element. Unlocking gives the element back its normal selection, with the full bar.
- **"Unlock everything (n)"** in the board's "…" menu, shown while at least one element is locked, unlocks them all at once.
- **Who:** whoever may unlock today — the rule "Only the facilitator can change a locked element." stands: another member sees the mark, and on a click the bar with "Unlock" off and that reason.
- A locked element still cannot be dragged, erased or drawn over by mistake: that is the point of locking.

94. A facilitator locks a shape, clicks it, gets the bar with "Unlock", unlocks it and can move it again; with three locked shapes "Unlock everything (3)" unlocks the three; a member who is not the facilitator sees the lock mark and "Unlock" turned off with its reason; a locked shape cannot be dragged.
