# Roadmap plans 20–27, 29 — drafts of 2026-10-03

Specs and plans drafted read-only from main 18d3637e; not approved by the owner yet.

## Plan 20 — Whiteboard toolbars rebuilt to the mockup
Tasks: 20

### Decisions
Seven questions (spec §15). The plan is written on each recommendation, and its "Owner decisions" table says which tasks change if the owner answers otherwise.
(1) Sticky note key. ScreenWhiteboard uses S, but WhiteboardToolbar and KeyboardShortcuts use N, and in Excalidraw 0.18.1 S opens the stroke colour picker. Options: A N; B S, taking the key from the library; C both. Recommend A.
(2) The library's property panel (stroke, fill style, width, sloppiness, edges, arrowheads, font, size, align, opacity, layers, centre alignments) has no place in the mockup's selection bar. Options: A a "Styles" button in the selection bar shows the native panel, themed, beside the tool bar, hidden by default; B rebuild these controls ourselves (about 6 more tasks); C keep the native panel always shown. Recommend A.
(3) The library's hamburger menu (Export, Save as image, Find on canvas, Help, Clear canvas, Canvas background). Options: A hide it and move the entries into the header's board menu, with a "Canvas background" sub-menu; B keep it themed at the top left above the tool bar; C hide it and move only Save as image and Find. Recommend A.
(4) Tools the mockup's bar does not show (diamond, ellipse, line, laser, keep the tool active, stylus pen mode). Options: A Shape and Connector sub-bars plus a "More tools" overflow; B sub-bars, with the rest keyboard only; C sub-bars, with the rest dropped. Recommend A.
(5) Phone edit mode. Options: A the MobileRituals compact bottom bar (Selection, Sticky note, Pencil, plus a drawer for the rest, with no connector or frame below md); B keep Excalidraw's native mobile UI as a deviation. Recommend A.
(6) Minimap default. Options: A open from lg, remembered per browser; B closed by default. Recommend A.
(7) The "single-key shortcuts" preference (WCAG 2.1.4). Today the library's own letters ignore it. Options: A when the preference is off, the board swallows every single-character key in a capture listener, except while typing; B only our own keys (N, C, M) obey it. Recommend A.
The owner is also asked to approve removing the tests of components that go away: canvas-colors.test.tsx (5 cases, 3 of which move to the new containers) and 4 popover cases of sticky-tool.test.tsx (2 of which move).

### Dependencies
No roadmap plan has to come first. WB-1 is front-only, and I checked that by reading the code. Tool, zoom, minimap and selection state are local to the browser. Every element the new tools create is a type the server already accepts, or the existing sticky rectangle with its customData marker. No route, prop, event, model or migration changes. The plan starts from main at 18d3637e (plans 18, database portability and 19 merged).
It edits whiteboard files that no other roadmap plan (21–27, 29) touches. The only overlaps are files every plan appends to: lang/*.json, resources/css/app.css and lib/shortcuts/sections.ts. If plan 21 or 22 adds retro or poker shortcuts, the conflicts in sections.ts are textual only.
Later work that builds on this plan: the former plan 28 (WB-2 to WB-5: comments, follow, sticky authors, convert to actions) is now backlog. If it comes back, it needs this plan's selection bar and header first. No place is reserved for it, following the plan-19 precedent.

### Risks
1) The rebuild depends on Excalidraw 0.18.1 internals with no public API:
- the native chrome is hidden through CSS class names (.App-toolbar-container, the zoom-actions and undo-redo-buttons groups inside the footer, footer-right, .main-menu-trigger, .selected-shape-actions, the mobile .App-bottom-bar row);
- undo and redo press the library's hidden buttons [data-testid=button-undo/redo] and read their disabled state;
- group, ungroup, align, distribute, delete, element lock and clear canvas are triggered by sending the library's own shortcut keydowns to .excalidraw-container.
Mitigations: the version stays pinned; every selector and key is a named constant; a Vitest canary reads node_modules and fails if a string disappears; every helper fails soft.
2) Key clashes between the library's handler and ours. We use only N, C and M, which the library leaves free. A capture-phase guard enforces the single-key preference, and it has to let the canvas text editor's textarea through.
3) Layout: the "Styles" panel sits beside the vertical bar, and history, reactions and zoom share the bottom edge between 48rem and 64rem. Captures cover 1440 only, so overlap at narrow widths is a residual risk.
4) The walkthroughs Plan17a/b/c and Plan18eWhiteboardTest click native toolbar, menu and zoom selectors. Under the owner's rule they are neither edited nor run, so they go stale. Only the shared helper, the visual test and one smoke run cover the real browser.
5) Nothing in the new chrome was run in a browser while drafting. jsdom cannot render the Excalidraw canvas, so the composition is tested through a BoardChrome component and fake APIs.
6) Moving the sticky tool from a popover to a tool mode relies on the custom tool (setActiveTool type 'custom') plus api.onPointerDown, which the board has never used.

### Unverified
Read in node_modules/@excalidraw/excalidraw/dist/dev but never run in a browser:
- a synthetic KeyboardEvent dispatched on .excalidraw-container reaches the library's React onKeyDown and actionManager. No isTrusted check was found, but React's handling of the dispatched event was not observed.
- .click() on a display:none native undo button performs the undo.
- setActiveTool({type:'custom', customType}) together with api.onPointerDown gives the scene origin needed to place a sticky.
- setActiveTool({type:'image'}) opens the file picker.
- api.onChange fires on every scroll and zoom, so a single subscription can feed the zoom bar and the minimap.
Not determined at all: the exact class of the mobile bottom tool row, which plan Task 15 reads at execution, and where the native property panel lands under the margin-left rule at heights below 900px.
Not stated by the owner: whether tests/Browser/Smoke/WhiteboardHarnessTest counts as a walkthrough. The plan runs it once in Task 18 and skips it if the owner says it does.
The translation values for es and de are a first pass for the Task 17 review.
The final paths (docs/superpowers/specs/2026-10-21-whiteboard-toolbars-design.md and docs/superpowers/plans/2026-10-21-plan-20-whiteboard-toolbars.md) follow the dating pattern of plan 19. They are my choice, not the owner's.

## Plan 21 — Retro facilitation
Tasks: 22

### Decisions
Each decision is listed with its options, and the body of the spec and plan is written on the recommended one. 1) "Is writing…" on an anonymous retro. The Writing mockup shows a named indicator next to "Anonymity: on", but the presence id travels with every client event, so a determined participant can work out who wrote a hidden card. A: send it and mask the name as "Participant", the way live cursors do. B: send nothing on an anonymous retro; the "moving a card" and "taking notes" indicators stay. C: a count relayed by the server with no ids. Recommended: B, because anonymity is a promise and the product already turns cursors off where they would reveal a vote. 2) Which timers can be paused? A: the retro's timer only, which is what the request and the mockups show. B: every timer (retro, poker, whiteboard, game rooms), the way "+2 min" was extended; about 3 more tasks, and the jobs behind poker auto-reveal and game expiry would need to know about the pause. Recommended: A. 3) How the time per topic is set. A: from the topic timer in Discussing; the duration chosen there is remembered and the timer restarts each time the shared topic changes. B: a new "Time per topic" row in the settings popover, which the mockup does not draw. C: time proportional to votes. Recommended: A. 4) When a topic counts as "discussed". A: only by hand. B: automatically when the facilitator moves on. C: both. Recommended: C. 5) How the notes are edited together. A: one text per topic and one writer at a time (others see "X is taking notes…" and the field is read-only for them), plus a version check that refuses a stale save and keeps the loser's text on screen. B: a list of entries, one per person. C: real co-editing with a CRDT library, which is a new dependency. Recommended: A. 6) Where the notes go after the discussion (the README says "taken into the recap"; the session-end mockup draws no notes). A: the recap e-mail and the AI summary input. B: A plus a notes card on the session-end page, which has no mockup. C: the board only. Recommended: A. 7) Does revealing the ROTI close the vote? A: yes, for this pass through the phase. B: no, votes stay open and the distribution updates live (a changed vote would then show who moved which bar). C: the reveal can be undone. Recommended: A. 8) What "Nudge the last n" sends. A: a live toast and pulse on the boards of connected people who have not voted, guests included. B: A plus a bell notification and mail for members. Recommended: A. 9) How the bulk Jira export runs. A: the browser exports the items one by one through the existing per-item endpoint, with progress, stop and retry. B: one batch endpoint, synchronous, capped at 25 items. C: a queued job with progress events. Recommended: A (no new route, no long request, each item keeps its own rights and errors). 10) After "I have finished voting", can the participant still vote? A: no, their votes are frozen until they press "Change my votes". B: casting or removing a vote takes the "finished" back automatically. Recommended: A.

### Dependencies
Nothing on the roadmap has to come before plan 21. Plan 19 (merged on main) removed the health-check phase and is the base the retro code was read on. Plan 20 (WB-1, whiteboard toolbars) is independent, but if it runs at the same time it may touch shared components in components/skrum (facilitator-bar.tsx, timer.tsx) and the four lang/*.json files, so the conflicts would be resolved at merge. Plan 21 has to come before plan 22 because SE-3 builds on RT-3. Plan 21 already adds the "Max per card" row to the "New session" dialog and the column max_votes_per_card, so SE-3 reuses them. SE-3's "Timer per phase" must also respect the new timer_paused_seconds and topic_seconds columns this plan adds. WB-5 needed RT-8 (action_items.card_id), but WB-5 belonged to plan 28, which the owner moved to the backlog, so nothing waits on it now. No other roadmap plan depends on RT-1 to RT-10 or blocks them.

### Risks
1) Anonymity by timing. A named or timed "is writing" indicator in a column ties a hidden card to its author. Masking the name in the browser does not help, because the presence id travels with every client event; decision 1 is the guard. 2) The icebreaker clock. In the Icebreaker phase the retro's timer is also the game's round clock, so pause is refused there. A timer paused in another phase and carried back into Icebreaker leaves the game with no countdown until it is resumed; resuming reschedules the round's expiry, which a test covers. 3) Lost notes. The one-writer-at-a-time lock relies on client events; when two people start typing at once, the second save gets a 409 and their text stays on screen, never merged. 4) Bulk export. The browser loop stops if the tab is closed (the dialog asks for confirmation first), and a tracker's rate limit shows up as failed rows with a retry. 5) Restarting the topic timer on each topic change may surprise a facilitator who wanted one timer for the whole discussion; stopping the topic timer keeps today's behaviour. 6) Shared files. The plan avoids most conflicts by putting BuildBoardSnapshot, ChangeRetroPhase, the models, types.ts, board-reducer.ts and use-retro-board.ts in single-writer tasks (1 and 10). Lanes still share routes/web.php, lang/*.json, phase-discussing.tsx (lanes Df and Af, so Af merges after Df) and facilitator-dock.tsx (lanes W and Rf). 7) Coupling with plans 22 and 20, as described under dependencies. 8) Nothing was run: the test literals and some accessor names were written from reading the code (see the next field).

### Unverified
I could not determine the following by reading. 1) Whether Reverb relays client events (whispers) from guest presence members. The setting accept_client_events_from=members suggests yes, but no test proves it. 2) Whether ActionItemPermissions::authorizeEdit lets a member export an item they neither created nor own; the bulk dialog lists a 403 as a failed row. 3) Whether adding the card_id foreign key to action_items with Schema::table works on SQLite; plan 19 added foreign keys after table creation the same way. 4) Real Jira latency, so how long a 10-item bulk export takes. 5) The exact accessors of RetroRecapMail (its sections) and SummaryInput (its encoded data), and whether new RetroRecap( is called in tests or the mail preview. The plan adds an optional last argument and Task 9 adapts to the real names. 6) Whether the visual harness can show activity indicators or the mid-run bulk export without a live Reverb; those captures are seeded or left out and listed. 7) Whether useCountdown copes with a null end time while the timer is paused; the plan passes the paused seconds straight to Timer. 8) The fixture of tests/Feature/ActionItems for a workspace item its author may edit (used in Task 7). 9) Whether NewRetro is built anywhere besides TeamRetrosController (an MCP tool, for example); the new argument has a default. 10) Whether a channel hook keeps a list of event names that the six new events must be added to (Task 10 says to check). Also, Spanish and German translation values were drafted here and are reviewed in Task 19.

## Plan 22 — Sessions index, advanced creation options, Jira ticket details in poker (scheduling REMOVED by the owner: backlog)
Tasks: 22

### Decisions
Spec §15, 8 decisions. Each has a recommendation; the plan is written on the recommended option.

(1) What "Upcoming" means without scheduling. A: sessions created but not started yet: a retro with no card and no start time, a poker game with no round, a draft poll, an empty whiteboard, a room never played. B: no Upcoming tab until scheduling exists. C: keep the tab, always empty, with "Scheduling is coming later". Recommended: A.

(2) Where whiteboards and icebreaker rooms go, since they never end. A: by activity. A board is Live when touched in the last 15 minutes (the command palette's rule) and Finished otherwise; a room is Live while a round is in play and Finished between rounds; both are Upcoming while empty. B: always Live once used, never Finished. C: add an "Archive" action and an archived_at column; Finished means archived. Recommended: A.

(3) What "Timer per phase" does. A: the phase's timer starts by itself when the retro enters a phase that has a duration. B: nothing starts by itself; the facilitator's timer control offers the phase's duration first. C: A and B, with a switch. Recommended: A.

(4) What "Timer per task" does at expiry. A: it is the existing round timer, started by itself at each round. It reveals only when auto reveal is on, and otherwise rings (that ring is the mockup's "nudge"). B: a notification to non-voters, with no timer. C: it always reveals. Recommended: A.

(5) Where "Write estimates to Jira" lives. A: per game, an on/off switch plus the field, defaulting to the team connection's field. B: the dialog changes the team connection's field, plus a per-game on/off. C: per-game on/off only, with the field shown read-only. Recommended: A.

(6) Where acceptance criteria come from (Jira has no standard field). A: a Jira text field found by its name "Acceptance criteria", which can be changed per connection in the integration settings. B: a section of the description headed "Acceptance criteria". C: not shown. Recommended: A.

(7) Which trackers the creation import offers. A: every tracker the team has connected (Jira, Jira DC, Linear, GitHub), with a source select when there are several. B: Jira and Jira DC only, as the mockup draws it. Recommended: A.

(8) Dates on the Sessions rows (the mockup's rows have none). A: add the last-activity date on Upcoming and Finished rows. B: no date. Recommended: A.

The plan also lists 14 pre-build deviations (P22-01 to P22-14) to put to the owner. Examples: the timer list 1/3/5/10 instead of the mockup's "2 minutes" (X5), no "Schedule…" button, and "Import from <source>".

### Dependencies
Plan 21 (retro facilitation) must be merged before lane C (creation options: Tasks 7-12, 16-18), for two reasons:
- RT-3 owns the per-card vote cap: its column, its validation and its check in the vote endpoint. Plan 22 only sends "Max per card" from the dialog.
- RT-2 (pause) and RT-5 (per-topic timer) change the retro timer that the automatic phase timer writes.

Plan 21 also touches several of the same files: RetroSettingsController, ChangeRetroPhase, retro-session-fields.tsx, board-settings.tsx and lang/*.json.

Lanes S (Sessions page: Tasks 2-4, 14) and K (ticket details: Tasks 5, 6, 15) do not depend on plan 21. They can start from current main after Task 1. Lane K must merge before lane C, because Task 12 extracts ImportPokerTasks::storeIssues from Task 6's version. Lane S must merge before lane C, because Task 11 adds pokerSources to S's PresentNewSessionOptions.

Downstream:
- Plan 23 (TM-2, recent sessions table) should come after plan 22. It calls ListTeamSessions with a limit instead of writing its own cross-type query.
- TM-1 (plan 23) and ON-1 (plan 25) were listed as needing SE-2. SE-2 is now backlog, so they no longer wait on plan 22; their specs must drop that dependency.
- Migration dates: this plan uses 2026_10_22_*. If plan 21 used 2026_10_22, this plan's migrations move to 2026_10_23.

### Risks
1. Coupling with plan 21. The column name for max per card and the retro timer's shape after RT-2/RT-5 are not known; lane C re-reads plan 21's code before starting. Many shared files make merge conflicts likely (RetroSettingsController, ChangeRetroPhase, PokerSettingsController, retro/poker session-fields, routes/web.php, lang/*.json).

2. The cursor merged across five tables. It is only correct if every kind uses the same updated_at desc / id desc order and the same cursor comparison. The page walk test (45 sessions, pages of 20) is the guard, and Task 22 runs it on all four engines. Because the list orders by updated_at, a session that is touched can move between two "Load more" clicks.

3. updated_at may not move on activity for retros, whiteboards and rooms (only PokerTask is known to touch its game). This affects both the "last activity" order and the 15-minute Live rule for whiteboards.

4. Change vote after reveal changes a shared voting rule. It is done with a new guard (PokerGuard::acceptsCard) used only by PlayPokerCard; openRound is unchanged, so reveal and timers still refuse a revealed round. A race test against "Save estimate" runs on all four engines.

5. The creation import calls the tracker inside the request. A slow tracker slows the dialog. Tickets are fetched before anything is written, so a failure leaves no game behind.

6. Acceptance-criteria detection by name finds nothing on many Jira sites; the remedy is a select in the integration settings. Connections detected before this release are detected once, quietly, on their first import or refresh. The Jira and Jira DC test factories get textFields => [] so existing tests do not trigger that detection.

7. Moving the dialog's props into PresentNewSessionOptions touches the team page. The existing team-page tests must pass unchanged.

8. No data migration is planned. Retros created before started_at existed are classified as Live by the "has a card" rule, which avoids writing false start times.

### Unverified
Nothing was run; everything was read on main at 18d3637e. What reading could not settle:

1. Plan 21 is not on disk, so the following are unknown:
   - the column name of RT-3's per-card cap (written as max_votes_per_card);
   - whether plan 21 already adds "Max per card" to the creation dialog;
   - how the retro timer is started after RT-2 (pause) and RT-5 (per-topic timer).
2. Whether updated_at of a retro, a whiteboard and a game room moves on cards, elements and rounds. It affects both the order and the whiteboard Live rule.
3. Whether GitHub's REST/GraphQL responses carry an issue type (type / issueType) for supported installations.
4. Whether Jira Data Center returns a text custom field as wiki markup in search results.
5. Exact names the plan uses but I did not read line by line; each step says where to check them:
   - the retro phase-change route and the snapshot JSON paths;
   - the plan-19 survey facilitator test helper;
   - the toast flash key;
   - whether PokerRound has a task relation;
   - how SyncTaskEstimate is run in tests;
   - whether timer_ends_at is fillable on PokerRound.
6. Whether CreatePokerGame's other caller (the MCP game-creation tool) is affected by returning import counts.
7. Whether a HasManyThrough (PokerGame::rounds) works with whereHas/whereDoesntHave on all four engines; the fallback is tasks.rounds.
8. Whether useTrans supports plural choice strings for ":count people".
9. Whether Inertia's partial reload with preserveUrl behaves as needed for "Load more". The plan appends rows in the page's own state rather than relying on merge props.

Also checked by reading, and corrected against the roadmap's "Back end" lines:
- PK-1: tasks already store and render the description; only type, labels and acceptance criteria are missing.
- SE-3: estimate write-back is always on today, so "Write estimates" is a new per-game switch as well as a field.
- SE-3: all import routes are scoped to a game and need a player, so the dialog needs new team-scoped browse routes.
- Revote: "Change vote after reveal" is not the existing "Re-vote" button (which starts a new round).
- SE-1: started_at was added without a backfill.

Neither file appears in git status (.superpowers looks git-ignored), so the drafts are local only.

## Plan 23 — Team and workspace data
Tasks: 24

### Decisions
Spec §15 has nine decisions. The body of the spec and the plan are written on each recommendation.

1. What is a sprint? Scheduling (SE-2) is now in the backlog, so TM-1's "next retro" has to come from somewhere else.
   - A (recommended): a rhythm stored on the team (length of 1–4 weeks, plus the number and start date of one known sprint) and a retro weekday and time. Sprints and the next retro are calculated from these by SprintCalendar. Changing the rhythm renumbers past sessions.
   - B: explicit sprint rows, with a "Start the next sprint" action and a management card. About 3 more tasks.
   - C: no sprints; show only the next retro, and the sprint labels stay as deviations.

2. What can owners and facilitators do?
   - A (recommended): an owner can do everything a workspace admin can do on the team except delete it (name and description, members and roles, health statements, integrations, rituals, team templates). A facilitator gets the ritual settings, team templates and a place in the rotation; who facilitates a session does not change. A member keeps exactly today's rights. Nobody becomes owner at the upgrade.
   - B: as A, plus a facilitator can "Take over" any open session (one more task per session type).
   - C: as A, but integrations stay with admins only.

3. How far does "observer: read-only, does not vote" go?
   - A (recommended): read-only everywhere. Writes are refused by one middleware on the five session scopes, screens are read-only, observers cannot create sessions or touch action items, MCP writes are refused, and observers are left out of participation counts.
   - B: votes only (retro votes, ROTI, poker cards, survey answers and health check are blocked; observers can still write cards and comments).
   - C: a label only, with no enforcement.

4. What do the default facilitators do?
   - A (recommended): they only feed the rotation. With "Rotate at every retro" on, each new retro goes to the next person on the list. With it off, the creator facilitates, as today.
   - B: with the rotation off, the first person on the list facilitates every retro.
   - C: they are only a suggestion: a Facilitator select in the retro dialog, which has no mockup.

5. What does the "Default columns" card edit?
   - A (recommended): the columns of the team's default template, edited in place when the viewer may edit that template. Otherwise it offers "Duplicate as a team template".
   - B: columns stored on the team that override any template.
   - C: a read-only preview.

6. Who can create templates, and who sees personal ones?
   - A (recommended): any member can create a personal template, seen only by its creator (admins see it once the creator's account is gone). Admins, owners and facilitators can create team templates. Only admins can create workspace templates.
   - B: only admins create templates, as today.
   - C: as A, but admins see and moderate every personal template.

7. Where does the workspace description go?
   - A (recommended): under the facts line of the workspace page, edited by admins in a small dialog.
   - B: as A, and the same dialog also renames the workspace.
   - C: only team descriptions; no workspace description.

8. What goes in "Data & export"?
   - A (recommended): links to the exports that exist (survey CSVs, the estimates history, and the space kept for plan 24's export) plus a paragraph on what deleting the team removes.
   - B: a full JSON archive of the team (about 3 tasks; it overlaps the retro export, which is in the backlog).
   - C: leave the tab unbuilt.

9. Recent sessions table (TM-2) and plan 22.
   - A (recommended): plan 22 runs first and its ListTeamSessions gives each session's state; plan 23 adds participants and outcome, limited to 5.
   - B: plan 23 runs first with its own copy of plan 22's state rules (Task 11 already works this way), and plan 22 builds on it.
   - C: TM-2 moves into plan 22.

### Dependencies
Plans that should come first:
- **Plan 22 (SE-1), recommended but not required.** The roadmap puts it first, and decision 9-A has the recent sessions table reuse plan 22's ListTeamSessions state rules. Task 11 is written to work either way: it has its own copy of plan 22's §6.1 rules, with a step that switches to plan 22's class if it has merged.
- **SE-2 (scheduling) is no longer a dependency.** The owner moved it to the backlog on 2026-10-02, so TM-1 now gets its next retro from the team's rhythm. The roadmap's "SE-1 → SE-2 → TM-1" line needs rewriting; Task 23 does this.

Plans that need plan 23 first:
- **Plan 24:** its sprint grouping reads SprintCalendar::sprintOn. Observers also change ActionItemPermissions, which plan 24's bulk actions go through.
- **Plan 25:** its spec already uses the names this plan produces: App\Enums\TeamRole, team_user.role, TeamPolicy::manageMembers (admins plus team owners), teams.description, and the Members & rituals tab with places left for Invite, Invitation link and pending rows.
- **Plan 29 (AD-4):** access-request recipients can switch from admins to team owners and facilitators.

Shared files to rebase, whichever plan runs second:
- Plan 21: CreateRetro, ChangeRetroPhase, BuildBoardSnapshot.
- Plan 22: CreateRetro and TeamRetrosController (SE-3), ListTeamSessions.
- Plan 24: ActionItemPermissions, PresentActionItem.
- Plan 25: TeamMembersController, TeamPolicy.

Migration dates are `2026_10_23_…`, so they don't collide with plan 24's `2026_10_21_…` or plan 25's `2026_10_25_…`. The plan re-dates them if a plan merged earlier used the same day.

### Risks
1. **Roles touch every TeamPolicy ability.** One wrong method takes a right away from today's members or gives one to observers. Mitigation: a matrix test covering 11 abilities × 6 kinds of person, and today's permission tests must pass unchanged after each Step A task.
2. **The observer middleware is broad.** It refuses every non-GET request in the retro, poker, whiteboard, game and survey scopes, so a read sent as POST would be refused. A facilitator who becomes an observer must still be able to run their open session; there is an explicit exception and a test for it.
3. **TeamsController@show gets new props from three parallel lanes** (R, T, F), so it will conflict at merge. CreateRetro and WorkspacesController are also shared between lanes.
4. **`Team::members()` changes to `as('teamMembership')`.** Any code reading `->pivot` on team members breaks. A grep of `app/` found none; tests still need checking in Task 1.
5. **Changing the sprint rhythm renumbers history** (decision 1-A). The UI warns about it.
6. **Personal templates share the per-workspace name uniqueness.** A second person cannot use a name someone else already used for a private template, and gets a generic "already exists" error.
7. **Thumbnails are built lazily on the queue.** The first team-page visit queues one job per board, and an instance with no queue worker never gets thumbnails. The job must not touch `updated_at` (there is a test for this).
8. **German translation.** "Facilitator" is "Moderation" in `lang/de.json` today; changing an existing key is outside the plan's rules, so this is left for the owner.
9. **Nothing was run.** Several test bodies depend on factory states and route bodies that were not read line by line; each such step names the file to check.
10. **There is no live update** of the team page or the activity feed.

### Unverified
Things reading could not settle:

1. The exact signature of plan 22's ListTeamSessions: plan 22's plan isn't written yet; only its spec draft was read.
2. Which non-GET routes in the five session scopes are really reads. Task 3 lists them with `route:list` before the middleware lands.
3. Whether the retro board's "locked" rendering covers every write control. Votes, reactions, ROTI, the health-check submission and retro survey answers may need extra conditions besides `isLocked`.
4. The internal shapes of the poker, whiteboard, game and survey snapshots. The plan adds a top-level `viewerIsObserver` key to each; tests that compare whole payloads will need it added.
5. Whether CurrentTeamResolver picks the visited team on `teams.show`. The `currentTeam.settingsUrl` test assumes it does.
6. The factory states used in tests: TeamSurveyFactory `closed()`/`open()`, ParticipantFactory `guest()`, the RotiVote, Card and WhiteboardElement factories, and the whiteboard facilitator helper name.
7. The request bodies of `teams.pokerGames.store`, `teams.whiteboards.store`, `poker.status.update` and the MCP write tool argument names.
8. The exact Node ICU output for French and English times ("14 h", "2 PM").
9. Whether the queue worker runs on every install.
10. The foreign-key column names of `whiteboard_members` and `game_players` used by the last-activity query.
11. Whether any existing test reads `->pivot` on team members.
12. Whether the 18e TeamPageVisualTest breaks once the settings card leaves the team page.

## Plan 24 — Action items
Tasks: 16

### Decisions
1. What happens when a bulk change meets an item it cannot change. A: change every item that can be changed, refuse the others one by one with their reason, and show a toast with "Details". B: all or nothing, so one refused item refuses the whole request. C: the bulk bar disables an action as soon as one selected item would refuse it. Recommended: A. It keeps the single-item rules unchanged, and a selection that mixes teams or rights still does what it can.
2. "In progress" and the trackers (Jira, Linear, GitHub). A: skrum only; a started item counts as open for the sync. B: read only; an open linked item becomes "In progress" when its issue enters the tracker's in-progress category (Jira indeterminate, Linear started). Skrum never pushes "in progress" and never moves a started item back to to-do. C: both ways, with a configurable "start" status per project or team (about 4 more tasks plus a settings UI). Recommended: B (one task, no new settings, follows the mockup's "the ticket's status is authoritative when linked").
3. "Sync to Jira" in the bulk bar. A: the page exports the selected unlinked items one by one through the existing per-item export, after one target choice; offered only for a selection of one team with a writable tracker; items already linked are skipped. B: a server batch of queued jobs, shared with RT-10 of plan 21. C: leave the button out. Recommended: A (no new back end).
4. Due-date buckets. A: Overdue, Today, Next 7 days, Later, No due date. B: calendar weeks (This week / Next week), which depend on the locale's first day of the week. C: a date-range picker. Recommended: A.
5. What "Export" downloads. A: a CSV of every item matching the filters, all pages, in the page's order. B: the current page only, or the selection. C: CSV or Markdown. Recommended: A.
6. How far a selection reaches. A: the current page only (at most 50 items); changing the filter, page or grouping clears it. B: a "Select all n matching" link that sends the filters to the server instead of ids. Recommended: A.
7. Selection on a phone. A: long press (as the mockup draws) plus a visible "Select" button for keyboards and screen readers. B: long press only. Recommended: A.

### Dependencies
There is no hard dependency: AI-1 to AI-4 need nothing that is not on main today (18e places left, plan 19 merged). AI-4 depends on AI-2, and both are inside this plan.

- **Sprint grouping:** the roadmap's "needs TM-1" applies only to grouping by sprint, which is not in AI-1 to AI-4 and stays in the backlog with TM-1 (plan 23).
- **Order relative to plans 21 and 23:** run plan 24 after them, or at least not alongside them, to avoid conflicts in shared files.
  - Plan 21: RT-8 adds a card reference to action_items, `ActionItem` and `PresentActionItem`. RT-10 adds a bulk Jira export on the retro, which overlaps with decision 3; option B would build it once for both plans.
  - Plan 23: TM-3 adds open actions on the team page, and TM-6 brings team roles into `ActionItemPermissions`, which the bulk actions go through.
  - These plans touch `ActionItem`, `PresentActionItem`, `ActionItemPermissions`, the action-items components and the `action_items` migrations (dates must not collide).
- **Whiteboard and survey sources:** these stay in the backlog. Former plan 28 is in the backlog, and plan 19 §13 keeps the survey source in its backlog.

### Risks
- **A frequent gesture changes.** Following the ActionItem mockup, clicking a "To do" status now starts the item rather than completing it, including on the retro board. The sheet keeps a one-click "Mark as done".
- **Tracker sync.** The promotion to "In progress" sits inside `ApplyIssueChanges`, whose conflict rules are subtle. One existing expectation changes: the test "only records the read when both sides agree" reads an `indeterminate` issue, so the item now becomes started.
- **Event volume.** A 50-item bulk change sends 50 broadcasts per channel and up to 50 webhook deliveries and tracker pushes.
- **SQLite.** A bulk request is up to 50 sequential transactions, so on SQLite it holds the write lock in turns.
- **Client-side tracker loop.** Leaving the page stops it halfway.
- **Filter format change.** The `filters` prop changes from a single status string to lists, and old links and stored entries depend on the server-side mapping of `open`, `overdue` and `all`. The page is inconsistent on the branch between Task 3 and Task 7.
- **API consumers.** `PresentActionItem` and MCP `retro.actions.list` gain the status value `doing` and the key `startedAt`, so clients that expect two statuses see a third. Webhook payloads are deliberately unchanged.
- **Lane conflicts.** `action-items-page.tsx` and `action-items-table.tsx` are edited by several lanes, so the controller must resolve the merges.
- **Plan 19 code touched.** Task 6 refactors the survey CSV export to share `CsvCell` and `CsvDownload`.

### Unverified
Nothing was run; every point below was inferred from reading.

1. **Plans 21 and 23:** whether they are merged before plan 24 runs, and so which files are rebased and which migration date is free.
2. **Date picker in the bulk bar:** whether `Calendar` / `DatePicker` can open from a bulk-bar menu without changes. The sheet uses a native date input.
3. **MCP tests:** whether they pin the `retro.actions.list` status enum or the exact item keys. I saw no schema snapshot, but `McpSweepTest` and `CatalogueTest` were not read in full.
4. **Legacy rows in the Upgrade test:** whether a row inserted with `DB::table()` must hold a folded `content_search` value. The plan tells the implementer to read `SearchColumnsBackfillTest` first.
5. **Test helpers and factories:**
   - whether `statusSyncLink()` accepts `started_at` through a factory or needs `forceFill`;
   - whether an `ActionItemExternalLink` factory exists.
6. **Locale:** whether `SetLocale` applies the user's locale to the streamed CSV header as it does for pages.
7. **Wayfinder URLs:** the exact URLs it generates for the new routes (the `/workspaces/{slug}` prefix in the Vitest examples is assumed).
8. **Request time:** how long a 50-item bulk completion takes on MySQL and on a SQLite file.
9. **Tracker categories:** whether every Linear "In Progress" column uses the `started` type, and whether some teams use Jira `indeterminate` statuses for "blocked".
10. **Captures:** whether the visual harness can hold a selection state on the real page without a live socket. The bench section is planned for that reason.
11. **Mockup status count:** whether the mockup's "Statut 3 sur 4" stands for a fourth status that was intended. It is treated as a sample value and recorded as deviation P24-01.

## Plan 25 — Invitations and onboarding (registration that creates a workspace and a team joins this plan)
Tasks: 24

### Decisions
Nine decisions. Both files are written on the option marked "rec".
1) What does registration create (D-52)? A: the account only. "Team name" is kept on a new onboarding row and fills in step 2; the workspace and team are created by steps 1-2 once the address is verified (rec). B: account, workspace and team are created together at registration. C: no team field.
2) Who may invite to a team and manage its link? A: whoever manages the team's members under TM-6, i.e. workspace owners and admins plus team owners (rec). B: also facilitators. C: every member except observers.
3) Invite link limits. A: fixed at 7 days and 20 uses, as the mockup line reads, renewed by "Create a new link" (rec). B: chosen at creation (1/7/30 days; 5/10/20/50 uses). C: expiry only, no use limit.
4) Can a link open registration on a restricted instance? A: yes in invite mode; domain mode still applies its domain list (rec). B: never. C: yes in every mode, ignoring the domain list.
5) How is the inviter told of a decline? A: bell item only (rec). B: bell plus mail. C: bell to the inviter and to every team inviter.
6) Step 1 logo and default language. A: both omitted. B: store workspaces.locale, used for invitation mails to addresses with no account; no logo until AC-1 in plan 26 (rec). C: both, building logo upload here.
7) Team link slug (/t/atlas) on step 2. A: omitted, teams stay addressed by id (rec). B: a unique slug per workspace plus a redirect route.
8) What does "Create the retro" on step 4 do? A: completes the onboarding and opens the team page with the "New session" dialog on that type (?new=…, icebreaker added) (rec). B: creates the session directly with defaults.
9) One team or several per e-mail invitation? A: one, as every mockup shows (rec). B: several, each with its own role, in a satellite table.
Also put to the owner as pre-build deviations (P25-01 to P25-15). Examples: no "Skip for now" on step 2 (the README and the frame disagree); the language switcher stays in the onboarding header; the link page and the declined bell item have no mockup; links use /invite/<40 chars> because /join/ is the retro guest route.

### Dependencies
Plan 23 must be merged first.
- TM-6 (team roles on team_user, TeamRole enum, TeamPolicy::manageMembers reading the team role) is needed because a team invitation carries a team role, "who may invite" is defined as manageMembers, and the onboarding makes the user owner of the team it creates.
- WS-1 (teams.description) supplies the optional description of step 2.
- WS-3 (the team-settings Members tab) is where the pending-invitation rows, "Invitation link" and "Invite" of ScreenSettings a go.
- The plan's first check stops if TM-6 is absent. Without WS-1 the description is dropped; without WS-3 the rows go into the team page's members card.
Plan 22 (SE-2) is no longer a dependency, because scheduling moved to the backlog and step 4 has no date. Plan 26 (AC-1, stored images) comes after: the workspace logo stays omitted until it exists. Plan 19 is already on main; this plan dates its migrations 2026_10_25_… after it.

### Risks
- Plan 23's names (role enum, pivot column, policy rule, Members tab file) are assumed, and a mismatch ripples through Tasks 1, 6, 7, 10 and 12. The preflight checks them, and plan 23's names win.
- The invite link is a bearer key to a team. Mitigations: verified accounts only, a use limit enforced under a row lock (race test), one usable link per team, replace or turn off, token stored encrypted and looked up by hash.
- Decline works by token: whoever holds the link can decline. It is throttled, and the token is 40 random characters.
- The inviter's message is user-written text sent from the instance's branded mail, so it is a phishing/spam vector. It is plain text, never linked, capped at 500 characters, and the sends are throttled (20 addresses per request, 10 requests a minute).
- Registration path for a link visitor depends on Fortify sending them back to the intended URL after register and verify; a dashboard session rule is the fallback, and one test covers the full path.
- Existing users with no workspace will now land on onboarding step 1 instead of workspaces/create; three existing tests change their expected redirect.
- A completed onboarding plus leaving every workspace could loop between dashboard and onboarding. The plan reopens the row and tests it.
- The team colour is derived in TypeScript (lib/mark-color.ts) and must be copied to PHP (TeamMark) for the mail. A parity test covers it. The mail palette may lack column colours.
- Race-sensitive spots, each with a Race test on four engines: issuing two invitations to the same address (today it can leave two, so the plan adds a workspace lock), accept vs decline, link uses, two link creations, double "Continue" on steps 1 and 2.

### Unverified
- Every name plan 23 will give to team roles, the pivot column, the policy, the team description and the Members tab. Plan 23 is not written or built, so this plan assumes TeamRole {Owner, Facilitator, Member, Observer} on team_user.role, and that teamMember() may change.
- Whether Fortify's register and email-verification responses in the installed version redirect to the intended URL.
- Whether PhaseStepper can render a plain read-only four-step rail in the onboarding header without a new option.
- Whether the mail palette (MailBrand) has column colour values for the team mark in the invitation mail.
- The exact Inertia 3 testing helper for partial reloads (written as reloadOnly in Task 9).
- How many existing users belong to no workspace (they will see the onboarding).
- How CompleteLogin treats an intended URL after SSO (Task 7 sends a team invitation's SSO acceptance to the team page).
- Whether limiter names collide.
Verified by reading: workspace_user and team_user have composite primary keys, and every database notification is announced live by BroadcastNotificationReceivedListener, so the decline bell item needs no new real-time code.
Nothing was run: no tests, no artisan, no build.

## Plan 26 — Account, and what a guest picks
Tasks: 26

### Decisions
Nine decisions, each with options and a recommendation. The body of the spec is written on the recommended option.

1. Profile photo: who processes it, and when may it show?
   - A (recommended): the browser crops it to a square and resizes it to a 512 px JPEG. The server checks type, size (1 MB at most) and dimensions, and strips metadata itself in pure PHP. Photos follow the existing switch "members choose their avatar". No new dependency.
   - B: as A, plus a separate admin switch "Profile photos".
   - C: the server resizes and re-encodes. This needs the GD extension in the production image, which is a dependency change.

2. Active sessions on instances whose sessions are not in the database (the SQLite setup uses SESSION_DRIVER=file):
   - A (recommended): the card says the list is unavailable and offers no action.
   - B: add AuthenticateSession plus logoutOtherDevices. This works on every driver but changes what a password change does to other devices.
   - C: hide the card.

3. Location in Active sessions:
   - A (recommended): none. No city, no "Unusual location", no IP shown.
   - B: a GeoLite2 city lookup (new dependency, licence key, monthly download).

4. How does an account with no known password (created by SSO) confirm itself to open the security section? Today it cannot, unless it has a passkey.
   - A (recommended): "Confirm with <provider>", a round trip to a provider it has linked. Works under sso_required and without mail.
   - B: an e-mail code (needs mail).
   - C: nothing new; the user goes through "Forgot password" first, which is impossible under sso_required.

5. Which linked identities are "Managed by your admin" and cannot be unlinked?
   - A: none on their own; only the last-way-in guard decides.
   - B: always Entra and generic OIDC.
   - C (recommended): while sso_required is in force, every identity of an enabled provider.

6. Breach check:
   - A: at save only (as today in production), plus an on/off switch and a short timeout. D-79 stays.
   - B (recommended): also live while typing. The browser sends only 5 hex characters of the SHA-1 to an instance endpoint, which proxies and caches the HaveIBeenPwned range. Plus the check at save, plus the switch.
   - C: live, with the browser calling api.pwnedpasswords.com directly.

7. Short code format:
   - A: the mockup's literal form, three team letters and four digits (ATL-4821). Only 10 000 codes per team, easy to guess.
   - B (recommended): the mockup's shape, XXX-XXXX, with seven random characters from an alphabet without look-alikes (about 2.75×10^10 codes), throttled at 10 tries per minute.
   - C: 10 random characters, which breaks the mockup's "8 characters".

8. Guest colours:
   - A (recommended): "taken" means the colours of everyone who has joined the session. The picker disables them while free ones remain; the server accepts any colour.
   - B: "taken" means only the people online now. This needs presence rosters for retro, whiteboard and survey.
   - C: the server enforces unique colours under a lock and answers 422 when one is taken.

9. Where is "join with a code" offered, besides the Share dialog's "Join at …/join"?
   - A (recommended): the /join page plus a link on the login page.
   - B: the /join page only.
   - C: a code field on the login page itself.

### Dependencies
No other roadmap plan has to come first. Plan 26 builds on main at 18d3637e, which already holds plans 18e–18g, the database portability work and plan 19 (TeamSurveyRespondent and the survey join page and channel exist). GU-1 depends on AC-4, and both are inside this plan (Task 2 comes before Tasks 3 and 6 in the Presence lane).

Plans to coordinate with:
- Plan 25 (onboarding, and registration that creates a workspace and a team) edits CreateNewUser and the registration form. That is the same file plan 26 changes to record password_set_at. Either order works. If plan 25 lands first, the Task 13 registration test gains its new fields; if plan 26 lands first, plan 25 must keep writing password_set_at.
- Plan 21 (retro facilitation, RT-1 "is writing / is moving" indicators) can use the presence colour of AC-4. Plan 26 is better placed before it but does not block it.
- Plan 27 (games) changes GamePlayer and the game snapshot, which plan 26 also touches (presenceColor, and joinCode in BuildGameSnapshot). These are textual merges whichever order they run in.
- Plan 29 (AD-1, SSO configuration moving to instance settings) would change SsoProvider::isEnabled. Plan 26's guard and linking read SsoProvider::enabled() and isEnabled(), so they keep working either way.
- Migration dates: plan 26 uses 2026_10_26_1000xx. If a plan merged earlier uses that day, the next free day is taken and noted in the report.

### Risks
- The SSO callback route (auth/{provider}/callback) leaves the guest group and serves three flows: sign-in, link and confirm. Wrongly honouring an intent would be an account-takeover path. To prevent it, the intent is pulled once and checked against the signed-in user and the provider, the link route needs a fresh confirmation, and every branch has a test, including signed-in users with no intent, someone else's intent, or another provider's intent.
- Four roadmap "Back end" lines are wrong:
  - AC-4: the back end assigns no colour today. Mail derives one from the avatar seed, the whiteboard hashes each board member id in the browser, and retro and poker cursors use the cursor library's own palette.
  - AC-6: Password::defaults() already has uncompromised() in production. The real gaps are the live line of the mockup and the 30-second fail-open timeout on instances without outbound access.
  - AC-2: the session driver is already database by default, but the SQLite setup uses files.
  - AC-3: the SSO routes are guest-only. An account created by SSO keeps a random password, nothing records that its owner knows no password, and it cannot pass password confirmation.
- password_set_at backfill: an account counts as created by SSO when its first social account was created within 60 seconds of the user. The heuristic is wrong in one direction only, and the cost is a "Set a password" form behind a fresh confirmation.
- Signing out a session or other sessions cycles the remember token, so every remembered device must sign in again when its session ends.
- Redefining Tailwind 4's built-in motion-reduce and motion-safe variants with @custom-variant is unproven. Task 8 checks the compiled CSS and falls back to global rules only.
- Photos are public under random, rotating names, like generated avatars. Metadata is stripped on the server because a request can bypass the browser's canvas step. Without GD, the server neither resizes nor re-encodes.
- Join codes can be brute-forced, which is why the code space is large, attempts are throttled, every failure gets the same answer, and the join page still enforces guest access.
- Five copies of everything: five participant tables, five join controllers, five share mounts, five token rotations and five snapshot builders. The plan handles them with datasets, but snapshot tests that assert exact keys will change and must be listed.
- Shared files across lanes: routes/settings.php, routes/web.php, AccountSettingsController, SecuritySettings, HasGuestIdentity, account-settings.tsx and lang/*.json. The plan sets the merge order M, Ph, P, C, S.
- Races proved with Race on four engines: one identity per provider per account, never the last way in removed by two concurrent unlinks, and one code per session.

### Unverified
Nothing was run, as the task required.

Open behaviour points:
- Whether Tailwind 4 accepts @custom-variant motion-reduce and motion-safe over its built-ins, with a block holding both the media query and the class selector.
- Whether Socialite::fake behaves as the tests assume for a signed-in callback and for redirect(). This was read from its use in InvitationSsoTest only.
- That RequirePassword answers 423 to JSON requests, and that the extend() of the UncompromisedVerifier survives the deferred ValidationServiceProvider. Both are framework behaviour as read.
- That canvas toBlob('image/jpeg') works in every supported browser.
- That getimagesize and fileinfo accept the hand-built 1×1 JPEG and PNG test fixtures.

Fixtures and helpers to confirm against the code:
- The exact InstanceSettings key for the avatar member choice.
- The team-membership helper for whiteboards and the survey/game guest helpers used in channel tests.
- The snapshot route names and JSON paths of the four non-retro share data cases.
- The factory password used by ProfileDeleteRequest.
- Where the project defines its named rate limiters.

Data and deployment questions:
- How many existing accounts were created by SSO and later reset their password (the backfill's null case).
- Whether production instances run the database session driver.
- Whether any operator's identity provider objects to the same callback URL being used by signed-in users (nothing changes on the provider side).

Out of scope:
- Account deletion asks for the current password, so an account with no known password still cannot delete itself. This is reported, not fixed.
- Plan 25's spec folder was empty when read, so possible overlaps in CreateNewUser and the registration form could not be checked.

## Plan 27 — Games (settings, turns and rounds, GIF captions and podium, whole-word guess in hangman, four new games: Two truths and a lie, Mood weather, Guess who, Quick question)
Tasks: 27

### Decisions
Ten questions; the spec and plan are written on each recommended option. (1) Whole-word guess points: the mockup says "+50 pts", but the product scores 1 per letter and 5 for solving. A: keep the product's scale, so a correct word earns +5 and the field reads "+5 pts" (recommended). B: multiply every game's points by 10 from the release, so leaderboards mix both scales for 30 days. C: as B, plus a migration that multiplies the stored points. (2) Turns in hangman. A: a "Take turns" switch, on for rooms created after the release and off for existing rooms (recommended). B: always in turns, and the free-for-all goes. C: a switch, off by default everywhere. (3) Default number of rounds. A: endless by default, and the host picks 3/5/6/8/10 in the card (recommended). B: a default per game, as the mockups show (3/6/8/5). C: equal to the number of players at start. (4) Word themes. A: four themes for every word game — Team & tech, Everyday objects, Food, Nature & animals — with hangman's "Outils d'équipe" read as "Team & tech" (recommended). B: two themes from today's drawable/abstract split, with no content work. C: the mockups' labels per game, which needs a film list. (5) A hangman turn that runs out. A: the turn passes, nothing else (recommended). B: it counts as a miss. (6) Guess who? in an anonymous retro's icebreaker. A: not available there (recommended). B: available, with authors revealed at the close. (7) A winner in Sprint in one GIF. A: the author(s) of the most-voted GIF (at least one vote) get is_win, but not in an anonymous retro (recommended). B: the "Winner" tag is shown, but no win counts in the leaderboards. (8) Mood weather with few answers. A: the weather is shown from 3 picks, and under that "Not enough answers" (the surveys' threshold) (recommended). B: always shown. (9) Rules of Two truths and Guess who? (no mockup beyond the picker). A: Two truths has one teller per round who writes 3 statements, and the others vote for the lie; Guess who? has everyone answer one prompt, then everyone names each answer's author (recommended). B: Two truths uses statement sets written before the game, one player's set per round; Guess who? draws one answer per round, and players vote once for its author. (10) Quick question. A: spoken turns ("2 min / pers." in the mockup): a prompt, a speaking order, a turn timer, "Done"/"Next", nothing typed, no points (recommended). B: a written wall revealed at once, with no turns. The plan's 14 pre-build deviation rows (P27-01..14) also need the owner's word before the screens are built. They cover eight picker cards instead of six; "Decoded" kept for the mockup's "Sprint en emojis"; game tile colours (ScreenIcebreaker and GamesLeaderboard disagree, so the picker is followed and four existing games change colour); extra "Take turns"/"Rounds" rows; one theme list; "+5" for "+50"; the four new stages designed without a mockup; and the "Game over" card.

### Dependencies
No other roadmap plan has to come first. The roadmap marks plan 27 as independent, and reading the code confirms it: every back-end piece it needs (the game engine, icebreaker, GIF proxy, leaderboards, Race harness, Upgrade suite, bin/test-db) is already on main at 18d3637e. There are only order and merge interactions. (a) Plans 20–26 and 29 all add keys to lang/*.json and routes to routes/web.php, so conflicts at merge only. (b) Plan 22 (sessions index, advanced creation options) may touch components/teams/session-create/*, where plan 27 changes icebreaker-session-fields.tsx (pitches). (c) Plan 21 (retro facilitation) may touch the retro board and the icebreaker stage, where plan 27 mounts the settings card (icebreaker-stage.tsx, through useRoomPanels). (d) Plan 23 (TM-6 team roles) could change who "manages" a room if it changes User::canManage, which GameRoom::isManager uses; plan 27 only reads it. (e) Migration dates: plan 27 uses 2026_10_27_100000/100100. If an earlier plan already uses that prefix, take the next free date (the plan's Branch and run section says so). Plans 28 and 30 and scheduling are backlog, and nothing in plan 27 reserves a place for them.

### Risks
Size: four new games plus settings, turns, auto hints and GIF changes make this the largest plan of the roadmap (27 tasks). It is mitigated by a single-writer foundation (Tasks 1–7, then 15) and one lane per game.
GameRules interface growth: three methods on every rules class, plus four optional interfaces. Every existing rules class and FakeGameRules change, and the GIF game moves onto generic reveal/close/question actions (four classes deleted). The existing Sprint in one GIF tests are the proof that this changes nothing.
Turn timing: the room timer, a per-round turn deadline, delayed jobs (CloseExpiredGameTurn, RevealAutoHint) and the lazy check in ResolveGamePlayer interact, so a stale job or a double "Done" could skip a turn. This is covered by expected_player_id plus locks, a Race test and travelTo tests.
New icebreaker rooms take turns in hangman (decision 2), so two existing IcebreakerRoomTest cases are edited to send turn_order. The front cannot start such a room until Task 15 lands.
MySQL unique-key swap on game_gif_votes: the new key is added before the old one is dropped. This is proved by the Upgrade test on four engines.
Race tests may hit the per-player rate limit (burst 3) before the GIF vote budget.
Content work: the four word files are restructured into themes (by index, since the files are parallel), and 60 prompts are needed in four languages, in the informal register.
Anonymity: Mood weather with few players can be deduced by elimination; the 3-pick threshold reduces this but does not remove it.
Shared files across lanes cause trivial conflicts at merge: routes/web.php, AppServiceProvider (registry), lang/*.json, game-stage.tsx, round-detail.tsx.
Payload choices: Mood weather and Guess who? reuse the GIF game's payload names (answers, voters) so that the existing client reducers serve them.

### Unverified
Nothing was run, so every test, migration and line number in the plan is unverified.
- Laravel's alter-table foreign key on SQLite for game_rounds.turn_player_id: the pattern exists in 2026_10_01_100500, so it is assumed to work.
- Whether MySQL's foreign key on game_gif_votes.game_round_id relies on the old unique index. The plan's order (add the new key, then drop the old) is safe either way.
- Whether the Timer component (components/skrum/timer.tsx) shows no controls when it gets no handler.
- The exact response shape of GameRoundPassesController, so Task 4's two assertJsonPath may need adapting.
- Whether HangmanTest uses assertExactJson on letter responses (it would need the two new keys).
- Whether the cache shared by Race processes makes the GIF budget race hit the rate limit first.
- Whether PHP/PHPStan accept the generic actions in App\Support\Games calling GameGuard; this is the existing practice, but tests/Arch was not re-read for it.
- How BuildGamesPlayed is built internally, beyond its per-game lines, which matters for adding captions and a Mood row.
- The real French/Spanish/German values of the existing game labels. fr was checked: "Pendu", "Dessine et devine", "Décodé".
- Whether eight picker cards fit at 1440 without scrolling (the captures will tell).
- How the parallel word files map index by index in fr/es/de: the index lists were derived from en.php and the fr.php head; the other files were not read word by word.
- Whether any browser or visual test (not run, by the owner's working rules) breaks on the colour changes and the eight cards. GamesPagesVisualTest will be recaptured in Task 25 only for the new cases.

## Plan 29 — Administration and error pages
Tasks: 32

### Decisions
Ten questions are in spec §16. The plan is written on the recommended option of each one, and its "Owner decisions" table lists the tasks that change if the owner picks another.

1. Where do the SSO, SMTP and integration-app settings live? A: they stay in the environment; the sections show them read-only, with "Test the connection" and "Send a test e-mail". B: editable, stored encrypted in instance_settings with the environment as fallback (the GIF-key precedent); about 6 more tasks, and any instance admin could take over SSO accounts or read password-reset mails. C: B for SMTP and the integration apps, A for SSO. Recommended: A.

2. Licence section? A: not built. B: an informational card showing the licence name, "every feature included", accounts in use, no limit and no expiry. C: real licence keys with seats and expiry, which is a separate plan. Recommended: B. The owner must also give the licence name: composer.json says MIT, the mockup says AGPL-3.0.

3. What can the Users section do? A: list and search. B: list, search, deactivate and reactivate. C: B plus deleting an account. Recommended: B.

4. What does the audit log record? A: admin actions only. B: admin actions plus security events (sign-in success and failure, second factor, password, MCP tokens), kept 365 days. C: B plus workspace and team administration. Recommended: B.

5. Who sees the status page, and in how much detail? A: public, states only. B: instance admins only. C: public, with timings, heartbeats and version. Recommended: A.

6. Who sees the version line on error pages? A: everyone, as in the mockup. B: signed-in users only, with none on the static 503 and status pages. C: admins only. Recommended: B.

7. What does the 403 page show a workspace member who is not in the team? A: what the mockup shows (team name, member count, the managers' names and avatars). B: the team name only. C: nothing about the team. Recommended: A.

8. Who receives access requests before team roles (TM-6) exist? A: nobody yet; move AD-4 after plan 23. B: the workspace owners and admins now, switched to team roles in one class when plan 23 lands. C: the workspace owner only. Recommended: B.

9. Where do "Back at" and the maintenance message come from? A: "Back at" from artisan down --retry; the message is written beforehand in General and attached to the maintenance payload at down time by a listener. B: a skrum:down command with options only. C: both. Recommended: A.

10. Update check? A: none, version only. B: off by default, with a switch in General; once a day to the project's GitHub releases. C: on by default. Recommended: B.

The plan also lists pre-build deviations P29-01 to P29-11 to confirm before the screens are built.

### Dependencies
Hard dependencies: none. Plan 29 can start from main at 18d3637e as soon as the owner approves it.

Soft dependencies:
- AD-4 (access request) needs TM-6, team roles, from plan 23. Spec decision 8B removes that block: requests go to the workspace owners and admins through a single class, AccessRequestRecipients, which plan 23 switches to team owners and facilitators. If the owner picks 8A, Tasks 9–11, 27 and 28 move to after plan 23.
- If plan 23 merges first, Task 11 must re-read TeamPolicy::view and manageMembers, which plan 23 rewrites for team roles.

Files shared with other plans (merge conflicts, not ordering):
- With plan 25 (invitations and onboarding, IN-3 "Decline" notifies the inviter): resources/js/components/skrum/notifications-panel.tsx, app/Actions/Notifications/ListNotifications.php, lang/*.json.
- With plan 26 (account): app/Models/User.php and the users migrations. AC-2 (active sessions) and AC-3 (linked accounts) touch the same sign-in paths as Task 13's deactivation enforcement and Task 3's last-sign-in listener. Whichever plan merges second re-reads FortifyServiceProvider and the Login listeners.

No dependency on plans 20, 21, 22, 24 or 27.

### Risks
1. Deactivation and the sign-in paths. There are many: password, two-factor, e-mail code, magic link, passkey, SSO, invitation account. Only the password login is refused up front, through a Fortify pipeline step. The other paths are cut by a web middleware on the next request, so one request is served first. MCP tokens and broadcast authorisation need explicit checks.

2. Privacy on the 403 page. It shows the team name and the managers' names to a workspace member who is not in the team; today such a member never sees that team's name. ResolveDeniedTeam must return nothing for anyone outside the workspace (Review Focus item 1).

3. Status and 503 pages with a dead database. The default cache store, queue and session are all the database. The status page must live outside the web middleware group, use no throttle, and catch every check. The database connect timeout is the driver's, so a hanging database makes the page slow.

4. Maintenance mode. A pre-rendered page (artisan down --render) or a cache-driver maintenance store on the database drops the "Back at" block. It must also stay at exactly one inline script, which an existing test enforces.

5. Arch rule change. IntegrationProvider::isEnabled() has to read the new instance setting, so the enum joins McpFeature on the ignoring list of tests/Arch/ArchTest.php. That edits a test, though nothing is deleted.

6. Branding reset. InstanceSettingKey::branding() today returns every key except sso_required, so a reset would wipe the new keys. Task 1 makes the list explicit.

7. Update check. It is an outbound call from a self-hosted instance to a repository whose public availability is unknown; it is off by default.

8. Version source. Docker images all report 1.0.0 today. The fix needs a Dockerfile ARG and a workflow build-arg, and Docker is not available to every agent.

9. Size and conflicts. 32 tasks across three back-end lanes and three screen lanes; every lane touches lang/*.json, and routes/admin.php is touched by lane U only.

10. Admin escalation if the owner picks decision 1B or 1C: an admin could repoint OIDC or SMTP and take over accounts.

### Unverified
1. The project's licence: composer.json says MIT, the mockup says AGPL-3.0.
2. Whether github.com/arnaud-ritti/skrum is public and publishes releases with a tag_name (the update check's source).
3. Whether Reverb accepts a TCP connect on broadcasting.connections.reverb.options host:port from inside the container. The client-facing address may differ from the server's bind address.
4. Whether a passkey sign-in fires Illuminate\Auth\Events\Login. This feeds last_signed_in_at and the audit log.
5. Whether a web-group middleware also covers the broadcast authorisation route, so a deactivated account is refused there.
6. The exact default login pipeline of the installed Fortify version (AuthenticatedSessionController::loginPipeline), which Task 13 copies and extends.
7. Whether the teamSurvey and room route parameters are bound before their participant middleware aborts with 403 (true for retro, game and board).
8. The exact name and signature of Middleware::preventRequestsDuringMaintenance in the installed Laravel, and how artisan down takes --except.
9. Route names and test helpers assumed but not confirmed: login.store, the settings.apiTokens routes and ApiTokenSettings::Expirations values, surveys.show, games.show, and the TeamSurvey and GameRoom factories.
10. How Inertia::flash data is asserted in feature tests (the assertSessionHas('inertia.flash_data…') form is assumed).
11. Whether tests/Unit uses RefreshDatabase; this decides where InstanceVersionTest lives.
12. The size of the lang/*.json merge conflicts between lanes.

Nothing was run: no artisan, no tests, no Docker. Every "Back end" line of the roadmap was checked by reading. Two corrections are in spec §1: AD-2's "No version is exposed" is partly false (config skrum.version exists and is shown on the About page), and AD-5 cannot compute "Back at" from --retry at request time unless the time is stored when artisan down runs.
