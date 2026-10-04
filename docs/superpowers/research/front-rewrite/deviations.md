# Deviations from the mockups

One place to find every recorded difference between the application and the mockups of `docs/design-system`.

## Where the rows are

| Rows | Table | Status |
|---|---|---|
| D-01 to D-127 | `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, "Deviations from the mockup" | See the 18e phase report (`18e-report/README.md`): approved by the owner, ruled under the autonomy mandate, or open |
| V1 to V32 | `docs/superpowers/plans/2026-10-16-plan-18f-front-rewrite-auth-mail-search.md`, "Deviations" | See `18f-report.md` §5 |
| P19-01 to P19-27 | `docs/superpowers/plans/2026-10-19-plan-19-standalone-surveys.md`, "Pre-build deviations" | Put to the owner before each screen was built. P19-23 to P19-27, found by the capture comparison of Task 32, were decided by the owner on 2026-10-03: P19-23 (scale results as a histogram) and P19-26 (builder: "Réglages", draft badge in the breadcrumb, "Saved … ago" always shown) are fixed and their rows removed; P19-24 (results topbar: "Reopen" in a "…" menu), P19-25 (participant header: an editor's "Results" and "Share", the reconnecting banner) and P19-27 (Compare: the two surveys overlaid in one chart per question, with a table) remain, reworded |
| P20-01 to P20-12 | `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, "Deviations from the mockup", after D-130; first in `docs/superpowers/plans/2026-10-21-plan-20-whiteboard-toolbars.md`, "Pre-build deviations" | Plan 20 (whiteboard toolbars, WB-1). P20-01 to P20-10 approved by the owner on 2026-10-03 before the build; P20-11 (minimap above the zoom bar) found by the capture comparison, **to approve by the owner**; P20-12 covered by 7-D1. Plan 20 also removed D-49 and reduced D-21 to the backlog part |
| P24-01 to P24-13 | this file, "Rows of plan 24"; first in `docs/superpowers/plans/2026-10-21-plan-24-action-items.md`, "Pre-build deviations" | Plan 24 (action items, AI-1 to AI-4). P24-01 to P24-12 answered by the owner on 2026-10-03 before the build (P24-03, P24-07, P24-08 built as the mockup, the others approved as listed); P24-13 found by the capture comparison of Task 16, **to approve by the owner**. Plan 24 also reduced D-19 and D-118 to what remains |
| D-128 to D-131 | this file | New in plan 18g. D-128 fixed and D-130 reworked in rework 3 (owner rounds 7 and 8); D-129 and D-131 still **to approve by the owner** |

The rows of the other tables were not copied here: two copies of 170 rows would drift. Plan 24's rows are kept here (Task 18 of that plan) and in its own "Pre-build deviations". Plan 18g Task 8 asked for one renumbered table; that was not done.

## New rows of plan 18g (fidelity pass, light theme, 1440 px, French)

| Id | Page | Mockup | Element | Built instead | Reason | Status |
|---|---|---|---|---|---|---|
| D-128 | Team page | ScreenTeam | Header button "Jeux d'équipe" | **Fixed** (rework 3, R3-12): the button has a key of its own, "Team games", "Jeux d'équipe" in French; the sidebar entry and the title of the games page stay "Jeux" as their mockups (Sidebar, GamesLeaderboard) | — | refused by the owner, fixed |
| D-129 | Every page with the sidebar | ScreenTeam, ScreenDashboard | "Sessions" is the current entry on the team page; the Actions entry carries "2 en retard"; the user card shows "Facilitateur · Admin" under the name | "Tableau de bord" is current on the team page; the Actions badge is a number, until plan 24 words it (":count overdue", "99+ overdue" above 99; owner's answer to P24-08, 2026-10-03, built by plan 24 Task 22); the user card shows the name alone; since plan 23 the user card reads "<team role> · <workspace role>" for the current team ("Facilitateur · Admin"), the workspace role alone outside it: the role line is built | roadmap for "Sessions" (the Sessions page, SE-1); the badge wording settled by P24-08 | to approve by the owner for "Sessions" (the role line and the badge wording are no longer deviations) |
| D-130 | User settings | ScreenUserSettings, ScreenSecurity | One long page (ScreenUserSettings); "Sécurité" a page of its own (ScreenSecurity); every card shown on opening with its state | Rework 3 (R3-8): one page at `/settings` with Profile, Security, Appearance, Notifications, API tokens under one another, the sub-navigation scrolling to each anchor and marking the section in view (it stays under the top bar on a phone); the old addresses redirect to their anchor. The cards of the mockup are all drawn on opening, and the password is asked in a dialog at each protected action, then the page loads what was kept back. What stays different: Security is a section of the page, not a page. Before the confirmation the two-factor card lists the methods the instance offers with no "Activée" badge, no date, no recovery-code row and one button "Manage two-factor authentication"; the passkey card and the token card show "Confirm your password to see…" with a "Show my…" button in place of their list; the team list of the token form opens after the confirmation; the server URL is a "Show the server URL" button. The confirmation dialog itself (password, or a passkey) has no mockup | owner decision of rework 3 (one page; confirmation at the sensitive action, not on opening); security rule of the rework (nothing protected becomes readable without confirmation) | stays |
| D-131 | Games page, game rooms | GamesLeaderboard | French keeps "Rooms", "Nouvelle room" | "Salons", "Nouveau salon", as every older string of the games | none of the allowed reasons: the application's French word against the mockup's | to approve by the owner; 24 values to change if refused |

## Rows of plan 24 (action items, answered by the owner on 2026-10-03)

Reasons as in plan 18e: **F** false or unsafe, **A** accessibility, **N** no such data or concept, **S** a spec decision, **O** an owner's answer. Rows answered "as the mockup" are kept for the record: the element is built as drawn.

| Id | Screen | Mockup element | Built | Reason | Status |
|---|---|---|---|---|---|
| P24-01 | Action items, filter bar | "Statut · 3 sur 4" | "Status · 2 of 3" (three statuses) | N: there are three statuses | approved by the owner (2026-10-03) |
| P24-02 | Action items, filter bar and rows | Source "Whiteboard · …", "Sondage · …" and their icons | Source facet "From a retro" / "Added outside a retro"; rows keep the retro link or "Added outside a retro" | N: roadmap backlog (former plan 28; plan 19 §13) | approved by the owner (2026-10-03) |
| P24-03 | Action items, header, table, list | "Grouper par Sprint" (default), sprint group rows with "en cours" / "terminé" badges, dates and late counts | as the mockup: Sprint (default) / Team / Assignee / None, sprint group rows, "No sprint" last (plan 24, Tasks 21 and 23) | was N (no sprint before plan 23) | owner: add it, the default (2026-10-03); not a deviation once built |
| P24-04 | Action items, table | a box on every row | a disabled box, with a tooltip, on a row the viewer can neither complete nor manage | F otherwise: a selection the server would refuse entirely | approved by the owner (2026-10-03) |
| P24-05 | Action items, bulk bar | no feedback drawn | a toast after each action ("n updated, m not changed" with "Details") and "Exporting n of m…" during a tracker sync | O: per-item outcome (decision 1) | approved by the owner (2026-10-03) |
| P24-06 | Action items, bulk bar | "Synchroniser vers Jira" always shown | "Sync to :tracker", named after the team's tracker, shown only for a selection of rows of one team with a writable tracker; disabled in "all matching" mode | N/F: a tracker belongs to a team; the browser loop needs ids (decisions 3 and 6) | approved by the owner (2026-10-03) |
| P24-07 | Topbar of the action items page | search field "Rechercher une action, un ticket… ⌘K" | as the mockup: "Search an action item, a ticket…" with ⌘K, filtering the list; "/" opens the palette there; below 48rem in the "Filters" drawer (plan 24, Tasks 20 and 24) | was PB-12 | owner: build it (2026-10-03); not a deviation once built |
| P24-08 | Sidebar | "Actions · 2 en retard" | as the mockup: ":count overdue" in the badge, "99+ overdue" above 99 (plan 24, Task 22) | was D-129 | owner: words, as the mockup (2026-10-03); not a deviation once built |
| P24-09 | Action items, phone and tablet list | long press only | long press and a "Select" button in the header | O: a keyboard and screen-reader route into selection (decision 7) | approved by the owner (2026-10-03) |
| P24-10 | Action items, phone chips | "Ouvertes", "Terminées" | "To do n" (To do and In progress), "Done", as D-118 | D-118 stands for the wording | approved by the owner (2026-10-03) |
| P24-11 | Action items, bulk bar | "n sélectionnées" only | "Select all :count matching" after the page is selected, "All :count matching selected", and the "Apply to :count action items?" confirmation | O: decision 6 | approved by the owner (2026-10-03) |
| P24-12 | Team integrations, status mapping | no mockup | a "Start to" select before "Complete to" and "Reopen to", same layout | O: decision 2 | approved by the owner (2026-10-03) |
| P24-13 | Action items, bulk bar | "Synchroniser vers Jira" with the Jira mark (`ac-mark--jira`) | a secondary button with the lucide `send` icon | N: no provider mark exists in the application (D-86) | found by plan 24 Task 16; **to approve by the owner** |

## Counts, for the final report

Rows D-01 to D-127 minus the five removed (D-37, D-38, D-39, D-41; D-49 by plan 20): 122. Rows V1 to V32: 32. New: 4. Plan 20: 12 (P20-01 to P20-12). Plan 24: 13 (P24-01 to P24-13; P24-03, P24-07 and P24-08 are built as the mockup once its Tasks 20 to 24 land). Total recorded: 183.
