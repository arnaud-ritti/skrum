# Deviations from the mockups

One place to find every recorded difference between the application and the mockups of `docs/design-system`.

## Where the rows are

| Rows | Table | Status |
|---|---|---|
| D-01 to D-127 | `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, "Deviations from the mockup" | See the 18e phase report (`18e-report/README.md`): approved by the owner, ruled under the autonomy mandate, or open |
| V1 to V32 | `docs/superpowers/plans/2026-10-16-plan-18f-front-rewrite-auth-mail-search.md`, "Deviations" | See `18f-report.md` §5 |
| D-128 to D-131 | this file | New in plan 18g, **to approve by the owner** |

The rows were not copied here: two copies of 159 rows would drift. Plan 18g Task 8 asked for one renumbered table; that was not done.

## New rows of plan 18g (fidelity pass, light theme, 1440 px, French)

| Id | Page | Mockup | Element | Built instead | Reason | Status |
|---|---|---|---|---|---|---|
| D-128 | Team page | ScreenTeam | Header button "Jeux d'équipe" | "Jeux", the key of the sidebar entry | none of the allowed reasons: a label that differs | to approve by the owner; a key of its own for the button if refused |
| D-129 | Every page with the sidebar | ScreenTeam, ScreenDashboard | "Sessions" is the current entry on the team page; the Actions entry carries "2 en retard"; the user card shows "Facilitateur · Admin" under the name | "Tableau de bord" is current on the team page; the Actions badge is a number; the user card shows the name alone | roadmap for "Sessions" (the Sessions page, SE-1); false for the role line (a person has one role per workspace and per team, the client is not sent one line to show); none for the badge wording | to approve by the owner |
| D-130 | User settings | ScreenUserSettings | One long page: Profile, Appearance, Notifications, API tokens under one another, the sub-navigation scrolling to each | One page per section, each with its own address; "Sécurité" was already a page of its own in ScreenSecurity | owner goal 2 (the routes `settings/profile`, `settings/appearance`, `settings/notifications`, `settings/api-tokens` exist and are linked from mails and tests) | to approve by the owner |
| D-131 | Games page, game rooms | GamesLeaderboard | French keeps "Rooms", "Nouvelle room" | "Salons", "Nouveau salon", as every older string of the games | none of the allowed reasons: the application's French word against the mockup's | to approve by the owner; 24 values to change if refused |

## Counts, for the final report

Rows D-01 to D-127 minus the four removed (D-37, D-38, D-39, D-41): 123. Rows V1 to V32: 32. New: 4. Total recorded: 159.
