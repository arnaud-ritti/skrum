# Coverage: team, workspace, sessions index, dashboard, palette and errors

Date: 2026-10-04. Branch `tests/coverage-team`. New file: `tests/Browser/Walkthroughs/CoverageTeamTest.php` (17 cases, `CVT-*`), and one feature case in `tests/Feature/Notifications/BellNotificationsTest.php` (the bell's JSON is closed to visitors, retro guests and unverified accounts).

Abbreviations: `P18eT` = `Walkthroughs/Plan18eTeamPageTest.php`, `P18eW` = `Plan18eWorkspaceTest.php`, `P18eSC` = `Plan18eSessionCreateTest.php`, `R22S` = `Roadmap22SessionsIndexTest.php`, `R23` = `Roadmap23TeamWorkspaceDataTest.php`, `R23D` = `Roadmap23DashboardSearchNotificationsTest.php`, `R29` = `Roadmap29AdministrationTest.php`, `CA` = `CoverageAccessTest.php`, `CVP` = `CoveragePokerTest.php`, `CVS` = `CoverageSurveysTest.php`, `P18eA` = `Plan18eAccessTest.php`. Visual files: `TeamV` = `Visual/TeamPageVisualTest.php`, `TWDV` = `TeamWorkspaceDataVisualTest.php`, `WsV` = `WorkspacePagesVisualTest.php`, `SessV` = `SessionsPagesVisualTest.php`, `SCV` = `SessionCreateVisualTest.php`, `CrossV` = `CrossCuttingVisualTest.php`, `ErrV` = `AdminAndErrorPagesVisualTest.php`, `AccV` = `AccessPagesVisualTest.php`, `GamesV` = `GamesPagesVisualTest.php`, `PokerV` = `PokerPagesVisualTest.php`, `DSV` = `DesignSystemVisualTest.php`.

Every visual capture runs in eight configurations: light and dark, 1440 and 390, English and French. Each one checks the theme, the language and that nothing overflows. So every screen below has been checked on a phone, in the dark theme and in English.

## Routes

| Route (GET) | Renders for the right person | Refused for the wrong one |
| --- | --- | --- |
| `dashboard` | R23D-01 (desktop and phone), CVT-01, CA-01 | CVT-01 (visitor → `/login`); P18e-09-03 (no workspace → onboarding); P18eT-04-07 (no team → workspace page) |
| `w/{workspace}` | P18eW-09-08, R23-09, CVT-10 (member sees only their teams), WsV, TWDV | CVT-10 (someone of another workspace: 403; visitor → `/login`) |
| `w/{workspace}/members` | P18eW-09-04/05, CVT-11, WsV | CVT-11 (a team owner who is a plain workspace member: 403; visitor → `/login`) |
| `w/{workspace}/templates` | P18eW-09-07/09/10/11, R23-10, CVT-12 (observer), WsV, TWDV | CVT-12 (someone of another workspace: 403; visitor → `/login`) |
| `w/{workspace}/teams/{team}` | P18eT-04-01…09, R23-01, CVT-02 (observer, workspace admin outside the team), TeamV, TWDV | CVT-02 (another team: 403 with the access request; another workspace: plain 403; visitor → `/login`), R29-08/09, CVT-03 (team under another workspace's address: 404), CVT-17 (retro guest → `/login`) |
| `…/teams/{team}/sessions` | R22S-01…10, SessV | R22S-05 (another team: 403; visitor → `/login`), CVT-17 (retro guest → `/login`) |
| `…/teams/{team}/settings` (General) | P18eT-04-05, R23-08 (team owner), CVT-04 (owner, workspace admin), TWDV | P18eT-04-05 (member: 403), CVT-04 (facilitator and observer: 403; visitor → `/login`) |
| `…/teams/{team}/members` (Members & rituals) | R23-02/03/04, CVT-05 (facilitator, from the gear and the sidebar), CVT-07, TWDV | R23-04 (member: 403), CVT-06 (observer, another team: 403; visitor → `/login`) |
| `…/teams/{team}/data` (Data & export) | R23-08, CVT-08, TWDV | CVT-08 (facilitator and member: 403; visitor → `/login`) |
| `…/teams/{team}/estimates` | CVP-06, Plan10a, PokerV | CVP-06 (another team, visitor, game guest) |
| `…/teams/{team}/poker-decks` | CVP-07, P18eSC-01-07/19/20, SCV | CVP-07 (another team, visitor; observer read-only) |
| `…/teams/{team}/games` | Plan13a, Plan18eGames, Roadmap27GamesEverywhere, CVT-09 (member, observer), GamesV | CVT-09 (another team: 403 with the access request; visitor → `/login`) |
| `…/teams/{team}/health-check` | P18eT-04-09, Plan08b-01a/b | CVS-09 (another team, another workspace, visitor; observer without "Start") |
| `…/teams/{team}/poker-imports/{source}/containers`, `…/iterations` (JSON) | feature `TeamPokerImportBrowsingTest` | feature (another team, observer, stranger, visitor 401, other workspace 404) |
| `workspaces/create` | P18e-09-03, CVT-13 (a member who already has a workspace), WsV | CVT-13 (visitor → `/login`) |
| `search` (JSON) | R23D-02 (palette), feature `SearchTest` | feature `SearchTest` (visitor 401 / redirect, unverified 403, teams the user cannot view) |
| `notifications` (JSON) | R23D-03/04, feature `BellNotificationsTest`, `NotificationsTest` | feature `BellNotificationsTest` (new: visitor 401 / redirect, retro guest 401, unverified 403; another user's cursor 404) |
| `recent-sessions` (JSON) | CVT-14 (palette lists it), feature `RecentSessionsTest` | feature `RecentSessionsTest` (visitor, unverified) |
| Command palette (mod+K, topbar) | R23D-02, CVT-14 (keyboard, recent session, "New retrospective", "Go to"), CrossV (empty, results, no result) | R23D-02 (another team's sessions hidden) |
| Keyboard shortcuts (`?`) | CVT-15, R20-16, CrossV (default, filtered, no result) | CVT-15 (`?` in a field is typed, not caught) |
| New session dialog | P18eSC-01-01…22, R22S-04, R23-06/07, SCV | R23-11 (observer: disabled with the reason), P18eSC-01-18b (room limit) |
| 403 page | R29-08/09, CVT-02/04/06/08/09/10/11/12, ErrV, AccV | — |
| 404 page | R29-10, CVT-03, AccV | — |
| 419 page | P18eA-11-10, AccV | — |
| 503 page (maintenance) | ErrV, AccV | — |

## Mockups

Each mockup's `preview.html` was rendered at 1440 with the built `app.css` and `_preview-bundle.css`. None of these previews has a dark variant. It was compared with the current design-system bench (recaptured from this branch) or with the screen's visual capture.

| Mockup | Status | Notes |
| --- | --- | --- |
| ScreenTeam | open (already reported) | Open, unchanged: the four creation tiles under the header, the "New …" buttons per section, and the "Remove" buttons in the team members card (the mockup shows role badges only). |
| ScreenWorkspace | **fixed** | The team tile footer now reads "Open →" ("Ouvrir") next to the members, as the mockup draws it. Before, the label was "Open team" ("Ouvrir l'équipe") and the link wrapped to a second line on two tiles out of three. The leave zone (ghost destructive button) matches. |
| ScreenDashboard | open (already reported) | The dashboard is the team page (`/dashboard` redirects to it). The compact action rows of the mockup are still open. |
| MobileDashboard | open (big) | The phone team page is the desktop page stacked. The mockup's "Bonjour Camille" greeting, the "Resume the session" live card, the "Launch a ritual" 2×2 tiles and the "My actions" block are not built. The phone Actions and Team settings frames belong to other lanes. |
| ScreenSessionCreate | matches | The dialog's type row matches (retro "Phases and cards"). The invitation block is still open (already reported). |
| SessionTypePicker | **fixed** | The tile descriptions and durations now read as in the mockup: "Phases, cards, votes and actions", "Estimate stories together", "Free canvas and sticky notes", "Warm-up games", "Open-ended" ("Sans limite"). Before they were the app's own sentences ("Look back on the sprint and agree on actions.", "No time limit", …). |
| RetroTemplatePicker | matches | Bench template groups and the "Browse" tile match. The bench fixtures are English names (not an app issue). |
| Sidebar | matches | Labels, groups, overdue badge, footer entries and the "role · workspace role" user card match. |
| Breadcrumb | matches | Separators, ellipsis menu, truncation and the slash variant match. |
| Command | matches, open minor | Groups, footer and the result count match. Open: the input keeps a 2 px inset focus ring, which the mockup does not draw. It was added on purpose for keyboard focus visibility (commit 91782db3), so it is the owner's call. |
| KeyboardShortcuts | **fixed** | The `?` that opened the dialog was also typed into its search field, which then filtered on "?" and showed two results instead of every section. Now the dialog opens on the full list with an empty search, as in the mockup. |
| NotificationsPanel | matches | Matches the README (unread dot on the right, ghost "Mark all as read", footer, empty state). The left dot in the static preview is a rendering artefact. |
| EmptyState | matches | Illustration, overline, title, text and actions match. The bench copy is slightly different from the mockup's sample texts (bench only). |
| ScreenErrors | matches, open (already reported) | The 404 still lacks the "Search sessions" button and the "Help" link (account lane, already reported). |
| Accordion, Dialog, Drawer, Sheet, Popover, DropdownMenu, Skeleton | matches | Structure, radius, overlay and states match on the bench. |
| Badge | matches | Variants, pill, roles and statuses with icons, and dot badges match. |
| Button | open (global) | Variants, sizes and states match. Open: the mockup draws labels at weight 600, while the app's `Button` uses shadcn's `font-medium` (500). The README mapping does not state a weight. Changing it restyles every screen and every baseline, so it is the owner's call. |
| Card | matches, open minor | Session card, stat card and container-query widths match. Open minor: on the bench, presence avatars without an image show initials cut by the overlap. Real sessions always carry an avatar image. |
| CardGroup | matches | — |
| Checkbox | matches | **Fixed (bench):** the switch examples were captioned "Changer" / "Cambiar" / "Wechseln", a verb. They are now "Interrupteur" / "Interruptor" / "Schalter". |
| Input | matches, open minor | Open: the textarea near its limit keeps its height and scrolls, while the mockup's grows with the text. The README does not ask for auto-height, and `Textarea` is shared by every form. |
| Select | matches | Placeholder ellipsis and group names are bench fixtures. |
| Tabs | matches | — |
| ToggleGroup | matches | The bench captions the off state with the app's "Off" ("Désactivé"); the mockup writes "Repos" (bench only). |

## Plan 23 acceptance criteria (browser-visible)

| # | Criterion | Test |
| --- | --- | --- |
| 1 | Migration of roles and visibilities | feature (upgrade suite) |
| 2 | Role change on Members & rituals; facilitator, member, observer refused | R23-04, CVT-06; 404/422: feature |
| 3 | A team owner who is not a manager renames, describes, adds and removes, changes roles, cannot delete | R23-08 (describe, no "Delete team"), R23-04 (role), CVT-07 (remove after confirmation) |
| 4 | A facilitator changes the rituals | R23-03 (starts the next sprint), CVT-05 (reaches Members & rituals, members read-only) |
| 5 | Observer read-only, "You are observing this session." | R23-11 (retro, no session creation), CVP-03 (poker), other screens: their lanes |
| 6 | Take control of an open retro | R23-12 |
| 7 | Observer becomes a spectator in poker | CVP-03 |
| 8 | Sprint and next retro in the header | R23-01, R23-02 |
| 9 | "Start the next sprint" ends the current one, a second start refused | R23-02, R23-03 |
| 10 | Sprint labels: ROTI "S41", retro header "team · Sprint 42", workspace tile, prefilled name | CVT-16 (ROTI S41/S42, "Atlas · Sprint 42"), P18eW-09-08 (tile "Retro in progress · Sprint 42"), R23-06 (prefill) |
| 11 | Facilitator suggestion and rotation | R23-06 |
| 12 | Facilitator list cleanup | feature |
| 13 | Default retro template preselected | R23-07 |
| 14 | Template visibility and badges | R23-10 |
| 15 | Activity feed | R23-01 |
| 16 | Recent sessions table | R23-01 |
| 17 | Open actions block | R23-01 |
| 18 | Retro card counts by phase | CVT-16 (joined, no groups while writing; "1 group" once voting) |
| 19 | Whiteboard thumbnail | TWDV P23-25-01 (three thumbnails drawn); queue timing: feature |
| 20 | Descriptions; workspace rename dialog; member has no button | R23-08, R23-09 |
| 21 | Settings tabs reachable by who may, refused (403) to others; no settings card on the team page | CVT-04, CVT-05, CVT-06, CVT-08, P18eT-04-05 |
| 22 | Sidebar user card roles; access request recipients | R23-13; R29-08 (bell of the owner); recipients: feature |
| 23 | Four languages, captures without overflow | R23-16, TWDV (eight configurations each) |
| 24 | Suites pass | (gates) |
| 25 | "Online" in the members table | R23-05 |

## Plan 22 acceptance criteria, Sessions page part (browser-visible)

| # | Criterion | Test |
| --- | --- | --- |
| 1 | Sidebar and tab bar open the Live tab; 403 to another team; a guest cookie gives no access | R22S-01, R22S-08, R22S-05, CVT-17 |
| 2 | Each state in its tab, newest first; draft poll for its editor only | R22S-01, R22S-02 |
| 3 | 45 sessions, twenty at a time, no duplicate or gap, the count | R22S-03 |
| 4 | Kind icon and colour, meta line, never a retro's icebreaker or poll | R22S-01 |
| 5 | "New session" from the page, `?new=poker` | R22S-04 |
| 6 | Timer per phase stored, changed by the facilitator only | R22S-06, R22S-07 |
| 7 | Phase timer offer to the facilitator only | R22S-06 |
| 8–15 | Poker game settings, imports, story card | poker coverage (`docs/superpowers/research/coverage/poker.md`) |
| 16 | Four languages | R22S-10 |
| 17 | Captures | SessV, SCV |
| 18 | Suites | (gates) |
