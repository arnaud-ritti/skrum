# Plan 23: team and workspace data — report

Branch `plan-23-team-workspace-data` (worktree `.claude/worktrees/rm23`), cut from `roadmap` after the merge of plan 22
(`03a05e4f`). Spec: `docs/superpowers/specs/2026-10-21-plan-23-team-workspace-data-design.md`; plan:
`docs/superpowers/plans/2026-10-21-plan-23-team-workspace-data.md`. Final run on 2026-10-04 on the code of `e2cb2757`
(the two fixes of §1.2); the commit after it adds this report only. Not pushed; `main` and `roadmap` untouched. The
controller ran every task in numeric order on this one branch (lanes flattened), so **Task 28 (the workspace presence
channel) runs after this report**: see §1.3 and criterion 25.

## 1. Result

One command at a time in the shared application container `skrum-laravel.test-1`, database `testing_l23`
(`TEST_DB_DATABASE=testing_l23`, `TEST_DB_WORKDIR=/var/www/html/.claude/worktrees/rm23`). PostgreSQL only (owner,
2026-10-03): SQLite, MariaDB and MySQL run in the roadmap's final four-engine matrix, not here.

| Run | Result |
|---|---|
| `bin/test-db pgsql --parallel --processes=4` (Unit, Feature, Upgrade, Arch), first run | `FAIL, 2 failed, 2 skipped, 7167 passed (60517 assertions)`: the two failures of §1.2 |
| the same, after the fixes of §1.2 | `PASS, Tests: 2 skipped, 7169 passed (60532 assertions)` |
| `bin/test-db pgsql --concurrency` | `PASS, Tests: 1 skipped, 50 passed (193 assertions)` |
| `bin/check-pg-upgrade` (databases `testing_l23_upgrade_old` and `_fresh`) | `PASS, every row is there, and the schemas are equal apart from the five legacy check constraints`; the nine migrations of this plan ran on the old install |
| `bin/test-db pgsql -- tests/Feature/Mcp/ObserverWritesTest.php tests/Unit/Support/Teams/SprintCalendarTest.php tests/Feature/Teams tests/Feature/Whiteboards/WhiteboardPreviewTest.php` (after the rector pass) | `PASS, 244 passed (1408 assertions)` |
| `bin/test-db pgsql -- tests/Feature/ErrorPagesTest.php tests/Feature/DesignTokensTest.php` (after the fixes) | `PASS, 41 passed (325 assertions)` |
| `composer types:check` (PHPStan) | `passed`, 0 errors (before and after the rector pass) |
| `vendor/bin/pint --format agent` | `passed` |
| `composer rector:check` | fails on 245 files before the pass, as on the base; see §1.1 |
| `npm run test` (Vitest) | `528 files, 5448 tests passed` |
| `npm run types:check`, `npm run check` | no error; 1366 files formatted, no lint warning in 1349 files |
| `vp build`, then `wayfinder:generate --with-form` | built (the plan 23 utility `bg-whiteboard-dotgrid` is in the built stylesheet); nothing to commit afterwards |

`TranslationKeysTest`, `InformalRegisterTest`, `UuidPrimaryKeysTest` and `tests/Arch/DatabasePortabilityTest.php` ran
inside the whole suite. Browser walkthroughs and smoke tests were not run (owner's rule); the captures are those of
Task 25.

The migrations are dated `2026_10_23_100000` to `2026_10_23_100700` as the plan names them: no merged plan used that
day (plans 27 and 22 used `2026_10_27_…` and `2026_10_28_…`). On an install that already ran plan 22's
`2026_10_28_…` migrations, this plan's nine run afterwards as pending migrations; they touch none of plan 22's columns,
and `bin/check-pg-upgrade` ran every migration of the branch on the old install.

### 1.1 Rector

`composer rector:check` is not clean on this branch, nor on its base (as in plans 18e, 19, 22 and 27): 245 files before
the pass. As those plans did, the pass (`6a81c427`) applied rector to the files plan 23 created: `latest('starts_on')`
in `PresentTeamSprints`, `oldest('starts_on')` in `TeamSprintsController`, `dispatch()` / `dispatch_sync()` for
`RefreshWhiteboardPreview` in `RefreshStaleWhiteboardPreviews` and the visual test, first-class callables in the
dataset of `ObserverWritesTest`, a `User` type on a closure of `RecentTeamSessionsTest`, one chained `expect` in
`TeamFacilitatorsTest`, a default `null` argument dropped in `SprintCalendarTest`. Left as they were:
`NewMethodCallWithoutParenthesesRector` in `WhiteboardPreviewTest` (no file of the project uses that form yet), and
every finding in a file older than this plan, among them the lines plan 23 edited in `BuildTeamMoodTrend`,
`CreateWhiteboard`, `Team`, `User`, `WorkspaceTemplate`, `tests/Pest.php` and the older visual tests.

### 1.2 Two failures of the first whole run, fixed in `e2cb2757`

- `DesignTokensTest` ("starts the stylesheet with the design-system file, unmodified"): Task 18 had put the utility
  `.bg-whiteboard-dotgrid` (the paper behind a whiteboard thumbnail) inside the copy of `docs/design-system/app.css`
  that opens `resources/css/app.css`. It moved, unchanged, to a "Plan 23 additions" block at the end of the file, as
  plans 18e and 20 did. No visible change.
- `ErrorPagesTest` ("still renders the page of another status when the shared props cannot be built"): the test builds
  an anonymous subclass of `HandleInertiaRequests` with `new class extends …`; plan 23 gave the middleware a constructor
  dependency (`TeamSettingsSections`, Task 16). The test now passes it (`new class(resolve(TeamSettingsSections::class))`);
  its expectation is unchanged.

Neither failure showed in the per-task runs, which ran the files each task wrote or touched; both are listed in §4.

### 1.3 Task 28 is not built yet

`resources/js/hooks/use-online-user-ids.ts` answers nobody ("Nobody until the workspace presence channel is joined
(Task 28 of plan 23)"), `BroadcastAuthorizationsController` has no `presence-workspace-online.` branch and
`tests/Feature/Workspaces/WorkspaceOnlineChannelTest.php` does not exist. The plan's status line ("Tasks 1 to 28") was
written by Task 26 ahead of it. The members table already says "Online" for the viewer's own row and for every id the
hook returns (`members-table.test.tsx`), so Task 28 only fills the hook. Criterion 25 below is proved by Task 28; its
run updates this row.

## 2. Acceptance criteria (spec §13)

Every PHP test named here ran in the whole PostgreSQL suite above, unless the row says concurrency or upgrade. Vitest
files ran once in `npm run test`. The races and the upgrade tests run on SQLite, MariaDB and MySQL in the roadmap's
final matrix.

| # | Criterion | Proved by |
|---|---|---|
| 1 | Existing memberships become `member`, templates `workspace`; nobody gains or loses a right but the take-over | `TeamRolesBackfillTest`, `WorkspaceTemplateVisibilityBackfillTest` (upgrade, the real migrations); every permission test older than this plan passes unchanged in the whole suite (none of their expectations changed, §4); `TeamRolesTest` ("gives a member added without a role the member role"); `TemplateVisibilityTest` ("keeps a template posted by an admin without a visibility as a workspace template") |
| 2 | Owner or manager changes a role; facilitator, member, observer 403; outsider 404; unknown role 422 | `TeamMemberRolesTest` (the first four cases); `members-table.test.tsx`; `TeamPolicyMatrixTest` |
| 3 | A team owner renames, describes, adds and removes members, changes roles, health statements, integrations; cannot delete | `TeamMemberRolesTest` ("lets a team owner who is not a workspace admin change a role", "lets a team owner rename the team and refuses them its deletion"); `TeamPolicyMatrixTest` ("answers each team ability by role"); `DescriptionsTest` ("lets a team owner describe the team…") |
| 4 | A facilitator changes the rituals and nothing marked owner | `TeamPolicyMatrixTest`; `TeamSprintsTest` ("lets a facilitator add a sprint and refuses a member"), `TeamFacilitatorsTest`, `TeamDefaultRetroTemplateTest` ("lets a facilitator choose the default template and refuses a member"); `TeamSettingsPagesTest` ("opens the General tab to owners and admins only", "opens Members & rituals to facilitators with the members read-only…") |
| 5 | Observer: 403 on every non-read request of the five scopes, read-only, no session, action item, comment, completion (web and MCP), no take-over, not counted; "You are observing this session."; a manager with an observer row not restricted; guests unaffected; a former facilitator keeps facilitating | `ObserverSessionsTest` (the first five cases), `ObserverActionItemsTest`, `ObserverWritesTest` (the thirteen MCP write tools), `ObserverParticipationTest`, `TakeControlTest` ("refuses a take-over to an observer, with the observer message"), `TeamMemberRolesTest` ("never counts a workspace admin as observing…"), `TeamRolesTest` ("never restricts a workspace manager…"), `SavedPokerDecksTest` ("keeps team decks read-only to observers…"); `observer-notice.test.tsx`, `session-shell.test.tsx`, `board.test.tsx`, `phase-roti.test.tsx`, `voting-finished.test.tsx`, `board-reactions.test.tsx`, `phase-voting-bar.test.tsx`, `poker-room.test.tsx`, `room-topbar.test.tsx`, `use-read-mode.test.ts`, `board-menu.test.tsx`, `guess-dock.test.tsx`, `hangman-board.test.tsx`, `room-sidebar.test.tsx`, `survey-room.test.tsx`, `survey-answer-flow.test.tsx`, `survey-answer-list.test.tsx`, `team-page.test.tsx` ("New session" disabled for an observer). The routes: §5 |
| 6 | Facilitator, owner and manager take control of an open retro and a game room; member 403 on the retro and keeps poker and whiteboards; completed retro refused; guest refused; `canTakeControl` exact | `TakeControlTest` (nine cases, among them "refuses a retro take-over to a member, and to anyone on a completed retro", "tells the retro snapshot who may take control", "keeps "Take control" of poker games and whiteboards for every member, and refuses it to observers"); `board-topbar.test.tsx`. A guest: the take-over route needs a signed-in user whose id is the one posted ("refuses to take control on behalf of someone else") |
| 7 | An observer opening a poker game becomes a spectator and loses their unrevealed votes | `ObserverSessionsTest` ("makes an observer a spectator when they open a poker game, withdrawing an open vote", "lets an observer join a poker game as a spectator") |
| 8 | Sprints 41 to 43, retro Thursday 14:00: the four dates | `TeamSprintLabelsTest` (the first three cases); `SprintCalendarTest` (eight cases, among them the daylight-saving one); `team-schedule.test.tsx`, `lib/teams/sprint.test.ts` |
| 9 | "Start the next sprint": dates, refused twice the same day, refused with a planned sprint, one sprint on two presses, overlap and number refused, deletion removes the label only | `TeamSprintsTest` (eleven cases); concurrency `TeamSprintStartsTest` ("creates one sprint when two people start the next sprint at the same moment"), PostgreSQL; `sprints-card.test.tsx`, `sprint-form.test.tsx`, `sprint-planning.test.ts` |
| 10 | ROTI "S41", retro header, live tile, "Sprint 42 retro"; none between two sprints | `TeamSprintLabelsTest` ("labels a trend point, a retro header, a live retro tile and the new retro name…", "gives no label to a retro created between two sprints"); `team-roti-card.test.tsx`, `board-topbar.test.tsx`, `team-tile.test.tsx`, `new-session-dialog.test.tsx` |
| 11 | Suggestion and rotation; two retros at once move it once; rotation off; empty list; the chosen person facilitates; observer or outsider 422 | `TeamFacilitatorsTest` (the first six cases); concurrency `RetroRotationTest`, PostgreSQL; `retro-facilitator-field.test.tsx`, `lib/teams/facilitator.test.ts`, `new-session-dialog.test.tsx` |
| 12 | Demotion or removal leaves the list; the list refuses members, observers, more than ten, duplicates | `TeamFacilitatorsTest` ("refuses a member, an observer, duplicates, more than ten people…", "takes a person out of the list when they become a member or leave the team", "starts the rotation over…"); concurrency `TeamFacilitatorsTest` ("keeps one whole list when two people save it at the same moment"); `default-facilitators-card.test.tsx` |
| 13 | Default template preselected; one no longer available ignored; "Used :count×" counts the team's retros | `TeamDefaultRetroTemplateTest` (five cases); `NewSessionOptionsTest`; `retro-templates-card.test.tsx`, `default-columns-card.test.tsx`, `new-session-dialog.test.tsx` |
| 14 | Personal, team and workspace templates by role; `TeamRetrosController` refuses an unseen template; the badge | `TemplateVisibilityTest` (thirteen cases, among them "refuses to start a retro from a personal template of someone else"); `templates-page.test.tsx`, `template-editor-sheet.test.tsx`, `template-editor.test.tsx`, `retro-template-picker.test.tsx`, `template-draft.test.ts` |
| 15 | Nine kinds, newest first, ten at most, links while the subject exists, nothing about cards, votes, comments, reactions, health checks, answers | `TeamActivityTest` (eight cases); `team-activity-card.test.tsx`, `lib/teams/activity.test.ts` |
| 16 | Recent sessions: five at most, live first, participants, date, state by plan 22's rules, outcome; a draft survey to its editors only | `RecentTeamSessionsTest` (five cases); `team-recent-sessions.test.tsx`, `lib/teams/session-rows.test.ts` |
| 17 | Open actions: five, overdue first, open and overdue counts | `TeamPageDataTest` ("sends the first five open action items, overdue first, with the overdue count"); `team-open-actions-card.test.tsx` |
| 18 | A retro card's counts by phase | `TeamPageDataTest` ("counts the participants, cards, groups and action items of each retro"); `session-card.test.tsx` |
| 19 | Thumbnail within a minute without moving "edited"; boards edited before the release get one | `WhiteboardPreviewTest` (four cases); `WhiteboardElementWritesTest` ("queues no job but the thumbnail refresh for an element write"); `whiteboard-thumbnail.test.tsx`. A queue worker must run (spec §16 point 3): without one the card shows the paper alone |
| 20 | Descriptions on the tile and the settings header; a manager renames and describes the workspace, slug kept; empty name 422; member 403 | `DescriptionsTest` (six cases); `TeamSettingsPagesTest` ("sends every tab the facts of the header line…"); `workspace-details-dialog.test.tsx`, `workspace-overview.test.tsx`, `team-tile.test.tsx` |
| 21 | Four tabs, each to who may see it, 403 to others; no settings card on the team page | `TeamSettingsPagesTest` (nine cases); `pages/teams/settings.test.tsx`, `members.test.tsx`, `data.test.tsx`, `integrations.test.tsx`, `general-settings.test.tsx`, `data-export.test.tsx`, `lib/teams/settings-href.test.ts`, `team-page.test.tsx`; the visual test `TeamPageVisualTest` now expects the card absent (not run, §4) |
| 22 | The user card shows team and workspace role; access requests reach workspace owners and admins and team owners only | `nav-user.test.tsx` ("reads the team role, then the workspace role", "reads the workspace role alone outside the current team"); `AccessRequestRecipientsTest` |
| 23 | Four languages, informal; captures compared | `TranslationKeysTest`, `InformalRegisterTest` (Task 24 reviewed the values); Task 25's twelve new captures and two retaken ones (`tests/visual/__screenshots__/*-light-1440-fr.png`), compared in Task 26: differences fixed or rows P23-01 to P23-19 |
| 24 | Unit, feature, upgrade, arch and concurrency on PostgreSQL; `DatabasePortabilityTest` | §1 above. Other engines: final matrix |
| 25 | "Online" in the members table, live; navigation keeps the channel; outsiders 403; user ids only | **Open: Task 28 runs after this report** (§1.3). Built so far: the viewer's own row and the column read from `useOnlineUserIds` (`members-table.test.tsx`, "says Online for the viewer and for who is in the channel, the date or Never for the others"); without the channel the cell shows the last session date or "Never" |

## 3. Differences left with the mockups

All in the plan: **Pre-build deviations** P23-01 to P23-16 (answered by the owner on 2026-10-03; P23-01 and P23-05
obsolete, built as described), and **Mockup comparison** (Task 26), whose three rows **wait for the owner**:

- **P23-17**, Members & rituals: Members at full width, then Sprints beside Default facilitators and Retro templates;
  the tabs stay the sub-navigation column (the mockup puts Members on the left and the tabs in a segmented control).
- **P23-18**, team page: the open action items are `ActionItem` cards in the side column (five at most), not the
  compact one-line rows of ScreenDashboard.
- **P23-19**, workspace tile: the whiteboard line is cut with an ellipsis when four tiles leave it too little room.

Covered by earlier rows (Task 26): the header's sprint line wrapping (P23-06), creation tiles (D-09), "Remove" (D-75),
the invitation places (P23-13), no outcome for a finished whiteboard (P23-09), "Changes saved" (P23-10), "Browse"
(P23-11), the observer line (P23-04), "Take control" in the retro menu (P23-16). Fixed in Task 26: the members table
cut to one letter, the observer's vote budget and reaction bar.

## 4. Existing tests edited, and why

PHP:

- `tests/Feature/Sessions/NewSessionOptionsTest.php`: the exact key list of the "New session" options gains
  `currentSprintNumber`, `retroFacilitators`, `suggestedFacilitatorId`, `facilitatorRotation` (Tasks 6 and 8) and
  `defaultRetroTemplate` (Task 10).
- `tests/Feature/Workspaces/WorkspacesTest.php`: a tile's whole `activity` array gains `openRetroSprint` (Task 6) and
  `whiteboardsEditedToday` (Task 14).
- `tests/Feature/Whiteboards/WhiteboardElementWritesTest.php`: "queues no job for an element write" became "queues no
  job but the thumbnail refresh for an element write": a write now queues `RefreshWhiteboardPreview` (Task 15, TM-7).
- `tests/Feature/Mcp/RetroListToolsTest.php`: `ListTeamMembers` returns each member's `role`; the key list gains it and
  a case checks the values (Task 2).
- `tests/Feature/Poker/SavedPokerDecksTest.php`: one case added (observers cannot create or delete team decks); no
  existing expectation changed.
- `tests/Feature/ErrorPagesTest.php`: the anonymous middleware gets its new constructor argument (§1.2); expectation
  unchanged.
- `tests/Browser/Visual/TeamPageVisualTest.php` (captures only, not run here): the team page no longer has the
  settings card (`assertNotPresent('[data-slot="team-settings"]')`), moved to the General tab (spec §9.1).

Vitest, expectations changed (the other edits add cases or fixture fields):

- Session fixtures (`test/retro-board.tsx`, `test/poker-room.tsx`, `test/whiteboard-state.ts`,
  `test/survey-snapshot.ts`, `test/survey-results.ts`, `lib/retro/adapters.test.ts`, `lib/poker/room-adapters.test.ts`,
  `lib/surveys/survey-reducer.test.ts`, `survey-builder.test.tsx`): the snapshots gain `viewerIsObserver` (and the
  retro viewer `canTakeControl`).
- `team-page.test.tsx`: the settings gear leads to `currentTeam.settingsUrl` instead of `#settings` or the integrations
  page; the places left by plan 18e are filled from their slots; "New session" is disabled for an observer.
- `team-settings-card.test.tsx`: the rename form left the card for the Team card of General; the card keeps the danger
  zone.
- `use-sidebar-model.test.ts`: "Team settings" reads `currentTeam.settingsUrl` (decided on the server by
  `TeamSettingsSections`); the client-side cases on roles and providers moved to `TeamSettingsPagesTest`.
- `templates-page.test.tsx`: a member now has "New template" (personal templates, decision 6 A) and may duplicate a
  built-in template; `template-editor-sheet.test.tsx` and `template-draft.test.ts`: the payload carries `visibility`
  and `team_id`.
- `team-tile.test.tsx`, `workspace-overview.test.tsx`: the description places are filled; the tile shows the sprint
  in place of the retro title and the whiteboard line in place of "No active game".
- `nav-user.test.tsx`, `team-members-card.test.tsx`, `sessions-page.test.tsx`, `team-new-session-dialog.test.tsx`,
  `integrations.test.tsx`, `guess-dock.test.tsx`, `hangman-board.test.tsx`, `use-read-mode.test.ts`: helper signatures
  or mocks gain the role, `auth.user` or the observer flag; `integrations.test.tsx` follows `TeamSettingsShell` to
  `components/team-settings`.

No test was deleted.

## 5. The non-GET routes of the five session scopes and the observer middleware

`RefuseObserverWrites` runs after the resolver of each scope and refuses (403, "Observers can follow this session but
not take part.") every non-safe request of a signed-in observer of the session's team, unless they facilitate the
session (retro facilitator, poker facilitator, whiteboard facilitator, game room host, survey editor). Workspace
owners and admins are never observers; guests carry no team role. Counted with `route:list` on 2026-10-04:

| Scope | Non-GET routes | Treated |
|---|---|---|
| `retros/{retro}` | 76: the retro itself, cards (create, edit, delete, comments, discussion, group, group name, notes, position, reactions, votes), columns and their order, comments, facilitator (hand-over and take-over), group-name suggestions, guest token, health check (create, delete, closure, submission), highlight, phase, results email, ROTI (vote, withdraw, nudges, reveal), settings, shares, suggested actions (reject, promote), summary, the retro's surveys (drafts, create, edit, delete, closure, comments, reactions, response), timer (set, extension, pause), voting completion, writing; action items, their comments, subtasks, exports and syncs | all refused |
| `poker/{game}` | 25: the game, current task, facilitator, guest token, imports (refresh, import, preview), spectator, auto reveal, reveal, timer and extension, vote, settings, shares, status, task order, tasks (create, edit, delete, estimate, estimate conflict, rounds, sync) | all refused; opening the game (GET) makes the observer a spectator |
| `whiteboards/{board}` | 10: the board, duplicate, elements, facilitator, files, guest token, settings, template, timer and extension | all refused |
| `surveys/{teamSurvey}` | 14: the survey, duplicate, guest token, question order, questions (create, edit, delete, duplicate), answers, status, submission | all refused |
| `games/{room}` | 34: the room, game, guest token, host, rounds and every answer, choice, clue, drawing, guess, hint, letter, pass, question, reveal, turn, vote and word route, scores, shares, statements, timer and extension | all refused |

No POST of these scopes is a pure read (spec §16 point 2): the closest, the poker import preview and the group-name
suggestions, call a tracker or the LLM on the session's behalf, so they stay refused. The flying reactions are
whispers on the retro's presence channel, which no middleware sees: the bar is hidden for an observer (Task 26).

## 6. Translation keys added outside Task 24's table

103 keys were added to `lang/en.json` (none removed); 15 are not in Task 24's table, each with its four values in the
commit that added it:

- the activity lines, made whole sentences with `:actor` and `:title` (`844a41e8`) instead of a name followed by a
  fragment, so that each language orders the words itself: ":actor started the retrospective :title", ":actor closed
  the retrospective :title", ":actor started the planning poker :title", ":actor ended the planning poker :title",
  ":actor created the whiteboard :title", ":actor published the survey :title", ":actor closed the survey :title",
  ":actor completed :title", ":actor joined the team";
- General: "Team saved." (the server's toast);
- Data & export: "Download CSV", "One CSV file per closed survey of the team.", "The estimates saved in the team's
  planning poker games.";
- the sprint form: "Days", "Sessions created in these days take this sprint's label.".

German, Task 24: the value of the existing key `Facilitator` changed from "Moderation" to "Moderator" (the role in the
role select, the presence stack, the facilitator dock, the share dialog and the poker table; 26 German strings already
called the person "Moderator"). "Take control" keeps "Moderation übernehmen". No PHP or TypeScript test reads that
value, so none was touched. In the three keys this plan added about action items, German "Maßnahme" became
"Aktionspunkt", the word of the translations review.

## 7. The presence channel

Ruled in the plan (owner's answer to P23-07, read on the owner's behalf): one channel **per workspace**,
`presence-workspace-online.{workspaceId}` (Echo `workspace-online.{workspaceId}`), signed for a signed-in user who may
view the workspace, member data `{id}` and nothing else, joined on every signed-in page of the application for the
current workspace and kept across navigations inside it. **Task 28 builds it after this report** (§1.3); the pages
that join it and the test that refuses a member of another workspace, a guest and a visitor are its own.

## 8. Decisions taken on the owner's behalf

- Read "global" (P23-07) as app-wide per workspace, not instance-wide, so nobody learns who is online in a workspace
  they do not belong to (§7).
- German "Moderator" for the facilitator role; "Aktionspunkt" in this plan's three action-item keys (§6).
- Access requests (plan 29) reach who holds `manageMembers`: workspace owners and admins and the team's owners, not
  facilitators; plan 25 widens invitations on its own.
- Data & export links the team's action items page (`workspaces.actionItems.index?team=`), where plan 24's CSV export
  lands.
- Every non-GET route of the five scopes is refused to observers, previews and suggestions included (§5); a poker
  player who became an observer is made a spectator the next time they open a game that has not ended, unless they
  facilitate it; an observer who answered a survey before being demoted is no longer counted.
- Game room hosting may be taken by whoever holds `takeControl` on the team; deleting the room stays with its creator
  and workspace managers.
- A workspace admin whose team row says observer may start sessions and add actions (`3dba49cc`), as for every other
  right.
- The activity lines as whole sentences (§6); an approved access request records the member joining, once.
- Members & rituals layout (P23-17), the open actions as cards (P23-18), the ellipsis of the whiteboard line (P23-19):
  built so, waiting for the owner.
- Task 27: the rector pass on this plan's files only (§1.1); `.bg-whiteboard-dotgrid` moved after the design-system
  copy; `ErrorPagesTest` passes the middleware's new dependency (§1.2).

## 9. What later plans can read

Plan 25 and later:

- `App\Enums\TeamRole` (Owner, Facilitator, Member, Observer; `label()`, `managesTeam()`, `managesRituals()`,
  `contributes()`, `options()`), the `team_user.role` column through the `TeamMembership` pivot, `User::isObserverOf()`.
- `TeamPolicy::manageMembers` (workspace owners and admins, team owners), `manageRituals`, `takeControl`, `update`,
  `delete`, the `create*` abilities that refuse observers.
- The Members tab (`pages/teams/members.tsx`): `MembersTable` is a `SettingsPanel` whose `actions` slot is free for
  "Invite", and its table body for pending invitation rows; the team page's `TeamMembersCard` keeps its `inviteAction`
  place (IN-4, P23-13).
- The General tab (`pages/teams/settings.tsx`, `components/team-settings/general-settings.tsx`) and
  `TeamSettingsSections`, which decides the tabs and where the settings entry leads.
- `SprintCalendar::forTeam($team, $from, $to)`, `sprintOn($moment)`, `numberOn`, `shortLabelOn`, `nextRetro`,
  `dayOf` for a grouping of action items by sprint.

Plan 24 (next) reads: `SprintCalendar::forTeam/sprintOn` for its "By sprint" grouping; the observer refusals of
`ActionItemPermissions` (creation without a retro, comments, completion) and the 403 of the retro scope; the Data &
export card that links the team's action items page, where its CSV export goes.

Kept: every member's "Take control" on poker games and whiteboards (`PokerFacilitatorsController`,
`WhiteboardFacilitatorsController`), refused only to observers (`TakeControlTest`).

## 10. What changed in plans 22 and 29's files

- `app/Actions/Sessions/ListTeamSessions.php` (plan 22): reused, not duplicated. Its five per-kind queries
  (`retros`, `pokerGames`, `surveys`, `whiteboards`, `rooms`) and `surveyUrl` became public, so
  `ListRecentTeamSessions` reads each state by the same rules; nothing else changed.
- `app/Actions/Teams/PresentNewSessionOptions.php` (plan 22): the catalogue reads the viewer and the team (template
  visibility); the options gain `currentSprintNumber`, `retroFacilitators`, `suggestedFacilitatorId`,
  `facilitatorRotation` and `defaultRetroTemplate`.
- `app/Actions/Teams/AccessRequestRecipients.php` (plan 29): the workspace owners and admins plus the team's owners,
  without duplicates, sorted by id.
