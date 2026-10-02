# Plan 18e — phase report

Branch `plan-18e-screens`, written at the close of the plan on 2026-10-02 (Task F3). Base of the plan: `310a5026` (head of `plan-18d-branding`). Nothing is pushed and `main` is untouched.

Every screen of the application is rebuilt on the design system and renders its own layout. The feature suite, Vitest and the architecture suite are green. **No browser walkthrough has run since integration 2b**, and nobody has compared a screen with its mockup by eye: see "Not verified".

## Gate totals (head of the branch, after the last commit of code)

| Gate | Result |
|---|---|
| Feature suite (`artisan test --parallel --exclude-testsuite=Browser`: Unit, Feature, Arch) | 5018 tests: 5017 passed, 1 skipped, 0 failed |
| Architecture suite alone (`--testsuite=Arch`, what `composer test:arch` runs) | 33 passed |
| Vitest | 3371 passed, 309 files |
| `wayfinder:generate --with-form`, then `npm run types:check` | clean |
| `npm run check` | 927 files formatted, 912 linted, no warning |
| `npm run build:front` | ok |
| `vendor/bin/pint --dirty` | passed |
| Rector, dry run | clean on `app` and `tests/Feature` after `0c914828`; 9 files under `tests/Browser` still have style suggestions (left: browser files are not touched) |
| Browser suite (`bin/test-browser`) | **not run** (owner decision) |

`composer test:arch` itself was not called: it starts with `artisan config:clear`, which is outside the commands allowed since the developer database was wiped. The same suite ran through `artisan test --testsuite=Arch`.

Greps of spec §13 criterion 5 over `resources/js` and `resources/views`: four hits, all in files listed for 18g (`components/user-info.tsx`: `bg-neutral-200`, `text-white`; `components/notification-bell.tsx`: `bg-red-600`, `text-white`, `text-[10px]`; `components/retro/card-insight.tsx`: `text-[11px]`), plus `border-[1.5px]` twice in `components/skrum/card-group.tsx` (an 18c component). No `sk-` preview class in `resources/js` or `resources/css`.

## Done, per group

One report per group holds the parity table, the places left and the differences with the mockup. Commits: 318 on the branch since the base; the scopes below are those of the commit subjects (`git log --grep` or `git log -- <path>` gives the list).

| Group | Report | What was built | Merges and main commits |
|---|---|---|---|
| 0 Preparation | `00-preparation.md` | Session shell, title, timer, presence, share dialog, guest join frame, admin pages of 18d on the new layout; session header rework RW-C2 | `b5ce68fd` (prep-b), scopes `skrum` (63), `session` (11) |
| 1 Session creation | `01-session-creation.md` | New session dialog (retro, poker, whiteboard, icebreaker), saved decks page; reworks D-37 to D-42 | `eeacb838` (back end 1.0a–1.0e), scope `session-create` (7) |
| 2 Retro | `02-retro.md` | Board shell, every phase, Actions and ROTI phases, session end, phone, guest join and session ended | `f0c35eda`, `f2931562`, `c22f3241`; scope `retro` (22) |
| 3 Poker | `03-poker.md` | Room, queue, result, rounds, import, estimation history; reworks RW-P1 to RW-P4 | `05c8dca4`, `e4282bab`, `742a9706`, `a8f33b16`; scope `poker` (26) |
| 4 Team page | `04-team.md` | Team page, health check page, ROTI trend; reworks RW-T1, RW-T2 | `54eeb9e2`, `8c548dd7`; scopes `team`, `teams` (18) |
| 5 Action items | `05-action-items.md` | Table, list, filters, sheet, creation dialog, realtime, bench section | `c5d1e293` (`a2ffdf01`, `5fec1ce0`, `ddb0dd7f`, `a3d9f6e8`, `52fa80c3`) |
| 6 Games | `06-games.md` | Games page, room, four games, leaderboard, icebreaker stage in the retro (G6); reworks RW-G1 to RW-G3 | `2d06823b`, `cfcede1c`, `60ea0ce1` (`431a0e8d`, `67f1b8f5`, `0741cf3e`); scope `games` (26) |
| 7 Whiteboard | `07-whiteboard.md` | Themed Excalidraw, header, colour bar, facilitation tools, join | `e80e4126`, `4192394e`; scope `whiteboard` (10) |
| 8 Surveys | `08-surveys.md` | Surveys column, answer and results cards, editor, AI draft, completed results | `60ea0ce1` (`7e004e5f`, `2af79980`, `136808e9`, `dfa09f58`) |
| 9 Workspace | `09-workspace.md` | Workspace page, creation, members, templates | `25385828`; scope `workspaces` (10) |
| 10 Settings | `10-settings.md` | Profile, security, appearance, notifications, API tokens, team integrations; recovery-code alert RW-S4 | `90d826a0`, `d54ea480`, `eaf9a6ff`; scope `settings` (13) |
| 11 Access | `11-access.md` | Login, register, password pages, two-factor challenge, invitation, error pages, static 503 | `757ca14d`, `4192394e`; scopes `auth` (10), `errors` (5), `invitations` (3) |
| 12 Redirect of `/` | none written (`12-redirect.md` does not exist) | `/` redirects to login or dashboard; the landing page is deleted | `65aca397` (Task 12.1), scope `home`; tested by `tests/Feature/HomeRedirectTest.php` |
| Guest join rework (RW-J1) | `02-retro.md`, rows D-51, D-115, D-126, D-127 | Suggested nickname on the four join pages, "Join the session", a true sentence | `344c1876` (`8521f970`, `21e232fc`, `a96b2f4c`, `99e2a727`) |
| F1 | `old-components-for-18g.md` | Old layouts and dead components deleted, `app.tsx` without a layout switch | `9343a36f` |
| Close-out fixes | this file; `.superpowers/sdd/…/integration-wave-5.md` | Participation of the session end, test storage, deviation rows, Rector | `66bd5b52`, `03c11032`, `385439b1`, `0d625c51`, `0c914828` |

Integration notes, one per wave, are in `.superpowers/sdd/2026-10-16-plan-18e-front-rewrite-screens/` (`integration-wave-1.md` to `integration-wave-5.md`, `closeout-tests-1.md`).

## Deviations from the mockup (gate G-deviations)

The table is in the plan (`docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, "Deviations from the mockup"): rows D-01 to D-127. D-37, D-38, D-39 and D-41 no longer exist: the owner asked for the mockup (round 4 and 4b) and the rework removed the difference.

### Approved by the owner (answer recorded in `owner-answers-2026-10-02.md`)

| Rows | Round | Note |
|---|---|---|
| D-01 to D-36 | third round | Reading of rule 13 confirmed on the first version of the table. D-01, D-02, D-04 kept by decision; D-03 stands until plan 19; D-21: the toolbars are a plan of their own. D-24 was reworded since (activity lines and template usage are built) |
| D-40, D-43, D-44, D-45, D-46, D-50, D-52, D-53, D-56, D-58, D-62 | round 4, 4b | "stays" |
| D-55 | round 4, 4b | 403 "this page" stays; no search on the 404, ever; the 503 reloads by itself (built) |
| D-42, D-47, D-48, D-51, D-54, D-57, D-59, D-60, D-61, D-63, D-64, D-65, D-66, D-67, D-68, D-69 | round 4, 4b | "REWORK": built (RW-C2, RW-G1 to RW-G3, RW-P1, RW-P2, RW-J1, R1; D-54 in plan 18f). **The row now describes what remains after the rework; the owner has not read that remainder** |
| D-71, D-74, D-75 | fifth round | "stays" |
| D-70, D-72, D-73, D-76, D-77 | fifth round | "REWORK": built (RW-P3, RW-P4, RW-T1, RW-T2). Same remark: the remainder is unread |

### Ruled by the controller under the autonomy mandate (the owner has read none of these)

| Rule applied | Rows |
|---|---|
| Mockup wins for presentation | D-110 (ROTI screen lists no action item, as the mockup) |
| An existing feature the mockup lacks is kept | D-82, D-83, D-85, D-89, D-93, D-97, D-98, D-99, D-100, D-103, D-104, D-106, D-107, D-108, D-118, D-121, D-122, D-124, D-127 |
| Heavy feature left to the roadmap, its place kept | D-86 (brand marks), D-91 (whiteboard activity, TM-4), D-94 (template visibility, WS-2), D-102 (health check scale, SV-5), D-105 ("finished voting", RT-4) |
| False, unsafe or inaccessible statement of the mockup, logged | D-78, D-79, D-80, D-84, D-87, D-90, D-92, D-113, D-116, D-126 |

"Simple data added" produced no deviation row: what was added is under "Decisions taken on the owner's behalf".

### Still open (no rule of the mandate settles them; the built state is the default)

| Row | Question |
|---|---|
| D-81 | French badge "Activé" on a feminine noun: a key of its own? |
| D-88 | "created in March 2025" under the team name needs a §9 item (the server holds the date and does not send it) |
| D-95 | "Regenerate codes" invalidates every saved code in one click, without a question |
| D-96 (with D-76) | The health check page opens on `view`; the plan said `update`. Writes still ask `update` |
| D-101, D-114 | Retro header at 1440 and on a phone: the rules of the 18c `PhaseStepper` and `SessionTitle`, not the mockup's rail |
| D-109 | ROTI question and labels differ from the mockup's wording |
| D-111 | Session end: the health card is `HealthCheckResults`; the subline does not name the team |
| D-112 | Session end has no reaction bar (spec §9.1); the mockup docks one |
| D-115 | Guest join: one logo, in the frame, not in the card |
| D-117 | Action items: the table from 80rem only |
| D-119 | Action items: "Edit" opens the sheet; ticket chip; browser wording of near dates |
| D-120 | Action items: "Reset" means every team, and that is remembered |
| D-123 | Completed retro: should the server show survey results to people who never answered? |
| D-125 | Icebreaker in the retro: live cursors against a frame whose columns scroll |

## Decisions taken on the owner's behalf, and how to overturn each

| Decision | Where | To overturn |
|---|---|---|
| Every "decide" row of `pre-build-deviations.md` built on its recommended option: PB-01 A, PB-02 A, PB-03 A, PB-04 A, PB-05 A, PB-06 A (action items); PB-13 A, PB-14 A, PB-15 A, PB-16 A (workspace); PB-24 A (surveys); PB-30 A (icebreaker); PB-50 A (recovery codes). PB-34, PB-38, PB-42, PB-46 belong to plan 18f | `.superpowers/sdd/…/progress.md`, ruling of 2026-10-02 | One screen each. PB-24: `asCount` in `components/skrum/survey-question.tsx`. PB-30: `primaryLabel` in `components/retro/facilitator-dock.tsx`. PB-01: `landingQuery` in `components/action-items/use-action-item-filters.ts` |
| Simple data added to the server because the mockup shows it: team tiles of the workspace page (activity lines, PB-13), "used n×" on a template (PB-15), ticket key and "across n games" (D-72), "Join" / "Resume" (D-73), team name in the session headers (RW-C2), votes per task in the poker queue (D-68) | group reports 03, 04, 09 | Remove the prop and its line; each has a feature test |
| The participation of the session end counts the team members who joined; guests and people outside the team are left out, so it can no longer read "3 of 2 · 100%". Spec B3 amended | `66bd5b52`, `0d625c51`; `app/Actions/Retros/BuildResults.php`, `tests/Feature/Retros/ResultsTest.php` | Revert both commits; then cap the count in `lib/retro/session-end.ts` instead |
| The health check page opens on `view` | D-96 | `authorize('update', …)` in the controller of `teams.healthCheck.show`, and `TeamHealthCheckPageTest` |
| "Regenerate codes" asks nothing | D-95 | Wrap the action in a `ConfirmDialog` |
| Action items: "Reset" stores "every team" | D-120, `52fa80c3` | `reset` in `use-action-item-filters.ts` visits `{ team: currentTeam }` |
| Completed results: the "Closed" badge only on a survey the facilitator closed (brief 08 row 36 asked for it on every card) | `dfa09f58` | Pass `closed` in `components/retro/surveys/survey-result-list.tsx` |
| French "Action items" is "Actions" (shared key: the retro panel title changes too) | PB-12, `lang/fr.json` | Change the value, or split the key |
| English "Remove from team" and "Remove from workspace" where it read "Remove" (so that French says "Retirer") | wave 4 | Rename the two keys |
| Guest join: a signed-in visitor who is not a player gets their own name on a game join page too; a name is cut at 50 characters | `8521f970`, `a96b2f4c` | `PresentJoinSession::nickname()` |
| `app.tsx` no longer wraps a page in a layout; a page without its own layout renders bare | F1, `9343a36f` | None needed: every page has one. A new page must render `AppLayout`, `AuthLayout` or a shell itself |
| Rector suggestions applied to 14 files of `app` and `tests/Feature` | `0c914828` | Revert the commit |
| Walkthroughs neither run nor updated; reduced fidelity pass in 18g | owner's own decision, not the controller's | — |

## Back-end items of spec §9 owned by this plan, and their feature tests

All files are under `tests/Feature` and pass in the run above.

| Item | Tested in |
|---|---|
| B1 Actions and ROTI phases | `Retros/ActionsPhaseTest.php`, and the fifteen other files that use `RetroPhase::Roti` |
| B2 ROTI in its phase | `Retros/RotiTest.php` |
| B3 session-end statistics | `Retros/ResultsTest.php`, `Retros/HealthCheckSummaryTest.php` |
| B10 eight column colours | `Retros/ColumnColorMigrationTest.php`, `Retros/TemplateCatalogueTest.php` |
| B15 error pages | `ErrorPagesTest.php` |
| B16 `currentTeam`, `teams` | `SharedPropsTest.php` |
| B17 top templates | `Retros/TopTeamTemplatesTest.php` |
| B18 icebreaker session type | `Teams/TeamsTest.php` |
| B19 `started_at`, duration | `Retros/RetroStartTest.php`, `Retros/ResultsTest.php` |
| B20 "+2 min" | `Retros/TimerExtensionTest.php`, `Poker/PokerTimerExtensionTest.php`, `Games/GameTimerExtensionTest.php`, `Whiteboards/WhiteboardTimerExtensionTest.php` |
| B21 saved decks page | `Poker/SavedDecksPageTest.php`, `Poker/DefaultPokerDeckTest.php` |
| B22 `/dashboard` | `DashboardTest.php` |
| B23 mood and ROTI trend | `Teams/TeamMoodTrendTest.php`, `Teams/TeamHealthCheckPageTest.php` |
| B24 member avatars | `Teams/TeamsTest.php` |
| B25 action item counters | `ActionItems/ActionItemsPageTest.php` |
| B26 drawing ink | `Games/DrawingInkPaletteTest.php` |
| B27 reactions in game rooms | `Games/GameRoomsTest.php`, `Games/GameSnapshotTest.php` |
| B28 rooms list | `Games/GamePagesTest.php` |
| B29 whiteboard templates | `Whiteboards/BuiltInWhiteboardTemplatesTest.php` |
| B30 workspace decks, templates page | `Poker/WorkspacePokerDecksTest.php`, `Workspaces/WorkspaceTemplatesTest.php` |
| B31 SSO on the invitation (props and buttons; the sign-in change is 18f) | `Auth/InvitationPagePropsTest.php`, `Auth/SsoButtonsTest.php` |
| B32 `/` | `HomeRedirectTest.php` |
| B36 request id | `RequestIdTest.php`, `ErrorPagesTest.php` |
| B37 creation options | `Retros/CreateRetroTest.php`, `Poker/CreatePokerGameTest.php`, `Whiteboards/CreateWhiteboardTest.php` |
| B38 writers, ROTI voters | `Retros/WritersCountTest.php` |
| B39 poker statistics | `Poker/PokerStatisticsTest.php` |
| B40 estimation history rows | `Poker/PokerEstimatesPageTest.php` |
| B41 team page summaries | `Teams/TeamRetroCardsTest.php`, `Poker/TeamPokerSectionTest.php` |
| B42 workspace page | `Workspaces/WorkspacesTest.php`, `SharedPropsTest.php` |
| B43 security page | `Settings/SecurityPagePropsTest.php` |
| B44 invitation page | `Auth/InvitationPagePropsTest.php` |
| B45 guest-join pages | `Sessions/JoinSessionPropsTest.php`, the four `*JoinTest.php` |

Not in §9 and to add there: the date of creation of a team (D-88). Known and left to the database plan: `ActionItemQuery::order()` uses `orderByRaw(… nulls last)` and `TeamEstimatesController` uses `ilike`.

## Old features: how they were checked

Each group report has a parity table "action in the old front end → control in the new one", filled by the task that built the screen and read again by its reviewer. The features the owner removed or changed are marked there as decided.

What backs the tables: the feature suite (routes, authorisation, validation and props unchanged or tested where changed) and Vitest (the containers and components). What does not: a browser. No parity row was exercised on a running page since integration 2b.

## Code deleted

- Under `resources/js`, against the base: 155 files deleted (17,170 lines), 14 moved; the folder as a whole is +109,001 and −27,802 lines over 861 files.
- Of the 287 view files that `components/` and `layouts/` held before the plan (outside `ui/`, `skrum/`, `session/`), 153 are gone, 91 were changed in place, 14 moved, 29 are untouched: listed in `old-components-for-18g.md`.
- F1 alone (`9343a36f`): 27 files, 1,294 lines: the old layouts and the layout switch, the old sidebar and its helpers, eleven components of the plan's F1 list, and `post-link-section.tsx`.
- The landing page `welcome.tsx` (Task 12.1). One test file went with its component (`games/game-panel.test.tsx`, rewritten as `icebreaker-stage.test.tsx`); no other test was deleted.

## Not verified

- **No browser walkthrough has run since integration 2b.** The suites under `tests/Browser/Walkthroughs` and `tests/Browser/Smoke` were neither run nor updated (owner decision). They still bind the old markup in many places (action items page, surveys, icebreaker game choice, "Join", settings, team page…) and will be red. Rewriting them is a separate job.
- **The visual tests** (`tests/Browser/Visual`, 13 files) were written or edited by reading and never run in this phase. New and unrun: `ActionsPageVisualTest.php` (`[P18e-05-11]` to `[P18e-05-14]`), `[P18e-08-04]` of `RetroPagesVisualTest.php`.
- **Captures are stale or missing.** Never generated: `actions-page`, `actions-index*`, `retro-phone-surveys-*`, `retro-phone-survey-thread-*`, the four `workspace*` sets. Stale: every `retro-board-*` (header line, avatar, ended rail, session end), `retro-board-icebreaker-*`, `retro-join-*`, `poker-join`, `games-join`, `whiteboard-join` (nickname, button, sentence), `poker-room-*` and `games-*` rooms (68 captures listed at integration 3), `poker-room-settings-*`, `poker-estimates-*`, `team-page-*` and the team bench states, `settings-security-two-factor-on-*`.
- **No human compared a screen with its mockup side by side** (gate G-visual of every group). The "Differences with the mockup" of the group reports come from reading the code and the mockups.
- **Spanish, German and French wording of the new keys is unreviewed**: about 200 keys since wave 3. The per-language review the owner asked for at the end of 18e was not done here. Every key used exists in the four files.
- **Phone layouts were not looked at since the reworks**: nothing was rendered at 390 after RW-C2, the retro phone tasks, the action items page or the icebreaker stage.
- Dark theme, overflow in French and German, focus order in a real browser, the stage height of the icebreaker in the retro, the survey dialog opened from a closing settings sheet, the guest-access question with a real guest connected.
- One whole-branch review (plan F2, last step) was not done: each lane had its own review and fix pass.
- MariaDB, MySQL and SQLite: the suite runs on PostgreSQL only.

## Items for plan 18g

- The twelve old view components of `old-components-for-18g.md`, and the criterion-5 hits they carry.
- Dead code the F1 check does not see: hooks, `lib/` and `types/` used only by deleted files; unused translation keys; unused dependencies; `OnboardingLayout`; the rename of `LocksDiscussingRetro`.
- The visual tests: first run, new captures, the reduced fidelity pass (light, 1440, French).
- Rector suggestions on nine files of `tests/Browser`.
- Arbitrary values in the new retro files (review finding of wave 4); `border-[1.5px]` in `card-group.tsx`.
- `SessionSettingsPopover`: closing while "Apply" is pending asks to discard; the tooltip shows again after closing.
- The breadcrumb `nav` inside the `span` of `SessionTitle`; `RetroSessionFormProps.llm`; the safe-area utility.
- `docs/design-system` READMEs not updated for props added in this plan (`RetroCard`, `RetroColumn`, `CardGroup`, `CardVotes`, `VoteBudget`, `ROTIWidget`, `StatCard`, `SurveyQuestion`, `IcebreakerGameCard`, `GuestJoin`; `ColumnTabs` is new).
- The workspace page reads the membership pivot eight times per request (constant, not an N+1).
- `guest-join.test.tsx` has no case of its own for `drawingName` and the status region (covered through the page tests).
- Templates page: a toast may cover "Save" of the editor sheet (to look at in a browser).
- The translations review, if 18g takes it.

## Items for plan 18f

- Places left: the magic-link button and tab of the login (`LoginForm` props `magicLink`, `methodTabs`), the search of the 404 (never: D-55), the notification row for `recap_emails`, the shortcut handlers of B35 and the keys `P` and `E` of the drawing toolbar, the security review of B31.
- D-54: the inline account creation of the invitation card (PB-46 B).
- `app.tsx` has no layout fallback: a page added by 18f renders its own layout, and `lib/page-layouts.ts` is gone (drop any entry added to it when merging).
- `components/notification-bell.tsx` is still the old component, imported by `layouts/skrum/app-layout.tsx`.
- Test traps: a rescued deferred prop cannot be asserted with `loadDeferredProps`; a query-count test visits once before counting; additions to `resources/css/app.css` go after the design-system block; the Vitest setup now gives a storage when Node hides the one of jsdom.

## Items for the feature roadmap

From the last column of the deviation table (`feature-roadmap.md` holds the plans):

- Surveys, plan 19: SV-1 to SV-5 (D-03, D-09, D-22, D-102); D-123 is a one-line server rule to decide before.
- Whiteboard: WB-1 (toolbars, D-21, D-49); WB-2 to WB-5 went to the backlog with plan 28.
- Retro, plan 21: RT-1 to RT-10 (D-10 to D-14, D-105, D-106).
- Sessions and poker, plan 22: SE-1, SE-3, PK-1 (D-06, D-07, D-16); scheduling (SE-2) is backlog.
- Team, workspace, team settings, plan 23: TM-1 to TM-7, WS-1 to WS-3 (D-18, D-24, D-27, D-77, D-91, D-94, D-100).
- Action items, plan 24: AI-1 to AI-4 (D-19, D-118); the page keeps their slots.
- Invitations and onboarding, plan 25: IN-1 to IN-4, ON-1 (D-30, D-33, D-52).
- Account and guests, plan 26: AC-1 to AC-6, GU-1, GU-2 (D-25, D-32, D-79).
- Games, plan 27: GM-1 to GM-4, the whole-word guess (D-20, D-59).
- Administration and error pages, plan 29: AD-1 to AD-5 (D-31, D-35).
- Backlog, not asked for: D-15, D-17, D-28, the GIF proxy (D-62), a list to tick in ROTI (D-110), mentions (MN-1, D-84), brand marks (D-86), one logo on the join card (D-115).

## Files of this folder

- `00-preparation.md` to `11-access.md`: one per group, written by the screen tasks (parity, places left, differences with the mockup). `12-redirect.md` was never written.
- `old-components-for-18g.md`: the list of Task F1.
