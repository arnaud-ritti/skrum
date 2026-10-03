# Deviations from the mockups

One place to find every recorded difference between the application and the mockups of `docs/design-system`.

## Where the rows are

| Rows | Table | Status |
|---|---|---|
| D-01 to D-127 | `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, "Deviations from the mockup" | See the 18e phase report (`18e-report/README.md`): approved by the owner, ruled under the autonomy mandate, or open |
| V1 to V32 | `docs/superpowers/plans/2026-10-16-plan-18f-front-rewrite-auth-mail-search.md`, "Deviations" | See `18f-report.md` §5 |
| P19-01 to P19-27 | `docs/superpowers/plans/2026-10-19-plan-19-standalone-surveys.md`, "Pre-build deviations" | Put to the owner before each screen was built. P19-23 to P19-27, found by the capture comparison of Task 32, were decided by the owner on 2026-10-03: P19-23 (scale results as a histogram) and P19-26 (builder: "Réglages", draft badge in the breadcrumb, "Saved … ago" always shown) are fixed and their rows removed; P19-24 (results topbar: "Reopen" in a "…" menu), P19-25 (participant header: an editor's "Results" and "Share", the reconnecting banner) and P19-27 (Compare: the two surveys overlaid in one chart per question, with a table) remain, reworded |
| P20-01 to P20-12 | `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, "Deviations from the mockup", after D-130; first in `docs/superpowers/plans/2026-10-21-plan-20-whiteboard-toolbars.md`, "Pre-build deviations" | Plan 20 (whiteboard toolbars, WB-1). P20-01 to P20-10 approved by the owner on 2026-10-03 before the build; P20-11 (minimap above the zoom bar) found by the capture comparison, **to approve by the owner**; P20-12 covered by 7-D1. Plan 20 also removed D-49 and reduced D-21 to the backlog part |
| D-128 to D-131 | this file | New in plan 18g. D-128 fixed and D-130 reworked in rework 3 (owner rounds 7 and 8); D-129 and D-131 still **to approve by the owner** |

The rows were not copied here: two copies of 170 rows would drift. Plan 18g Task 8 asked for one renumbered table; that was not done.

## New rows of plan 18g (fidelity pass, light theme, 1440 px, French)

| Id | Page | Mockup | Element | Built instead | Reason | Status |
|---|---|---|---|---|---|---|
| D-128 | Team page | ScreenTeam | Header button "Jeux d'équipe" | **Fixed** (rework 3, R3-12): the button has a key of its own, "Team games", "Jeux d'équipe" in French; the sidebar entry and the title of the games page stay "Jeux" as their mockups (Sidebar, GamesLeaderboard) | — | refused by the owner, fixed |
| D-129 | Every page with the sidebar | ScreenTeam, ScreenDashboard | "Sessions" is the current entry on the team page; the Actions entry carries "2 en retard"; the user card shows "Facilitateur · Admin" under the name | "Tableau de bord" is current on the team page; the Actions badge is a number; the user card shows the name alone | roadmap for "Sessions" (the Sessions page, SE-1); false for the role line (a person has one role per workspace and per team, the client is not sent one line to show); none for the badge wording | to approve by the owner |
| D-130 | User settings | ScreenUserSettings, ScreenSecurity | One long page (ScreenUserSettings); "Sécurité" a page of its own (ScreenSecurity); every card shown on opening with its state | Rework 3 (R3-8): one page at `/settings` with Profile, Security, Appearance, Notifications, API tokens under one another, the sub-navigation scrolling to each anchor and marking the section in view (it stays under the top bar on a phone); the old addresses redirect to their anchor. The cards of the mockup are all drawn on opening, and the password is asked in a dialog at each protected action, then the page loads what was kept back. What stays different: Security is a section of the page, not a page. Before the confirmation the two-factor card lists the methods the instance offers with no "Activée" badge, no date, no recovery-code row and one button "Manage two-factor authentication"; the passkey card and the token card show "Confirm your password to see…" with a "Show my…" button in place of their list; the team list of the token form opens after the confirmation; the server URL is a "Show the server URL" button. The confirmation dialog itself (password, or a passkey) has no mockup | owner decision of rework 3 (one page; confirmation at the sensitive action, not on opening); security rule of the rework (nothing protected becomes readable without confirmation) | stays |
| D-131 | Games page, game rooms | GamesLeaderboard | French keeps "Rooms", "Nouvelle room" | "Salons", "Nouveau salon", as every older string of the games | none of the allowed reasons: the application's French word against the mockup's | to approve by the owner; 24 values to change if refused |

## Counts, for the final report

Rows D-01 to D-127 minus the five removed (D-37, D-38, D-39, D-41; D-49 by plan 20): 122. Rows V1 to V32: 32. New: 4. Plan 20: 12 (P20-01 to P20-12). Total recorded: 170.
