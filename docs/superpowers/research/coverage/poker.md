# Coverage matrix: planning poker

Coverage pass of 2026-10-04 on `tests/coverage-poker`. "CVP" tests are in `tests/Browser/Walkthroughs/CoveragePokerTest.php`.

## GET routes

| Route | Kind | Renders for the right person | Refused for the wrong person |
| --- | --- | --- | --- |
| `poker.show` `poker/{game}` | page | P10a-02 to P10a-16, P10b-*, P18e-03-*, R22-01 to R22-11; captures P18e-03-08 to 13, P22-20-06 (light/dark, 1440/390, en/fr) | CVP-01 (workspace member of another team: 403 with the team block; stranger: plain 403), CVP-02 (visitor: login; game open to guests: "Your session has ended."), CVP-03 (observer: watcher with the notice), P10a-14 and P10a-16 (guest after a new link or a deleted game) |
| `poker.join.show` `poker/join/{guestToken}` | page | P10a-06, P10b-03, CVP-05 (guest colour), captures P18e-03-14 | P18e-03-15 (link no longer valid), P10a-14; CVP-04 (signed-in member goes to the game as themself) |
| `teams.estimates.index` | page | P10a-15, P18e-03-05, CVP-06 (member and observer); captures P18e-03-16 to 18 | CVP-06 (another team: 403, visitor and poker guest: login) |
| `teams.pokerDecks.index` | page | P10b-01, P10b-02a, P18eTeamPage, CVP-07 (member may create, observer read-only); captures P18e-01-22 | CVP-07 (another team: 403, visitor: login) |
| `poker.snapshot.show` | JSON | Feature: PokerAccessTest, PokerRedactionTest, ObserverSessionsTest and others | PokerAccessTest (403, 401) |
| `poker.tasks.rounds.index` | JSON | Feature: PokerRoundHistoryTest | PokerRoundHistoryTest (403 outside the team, 401 logged out, 404 for a task of another game; added in this pass) |
| `poker.saved-decks.index` | JSON | Feature: PokerSavedDeckGamesTest, SavedPokerDecksTest, WorkspacePokerDecksTest | SavedPokerDecksTest (guests never reach saved decks) |
| `poker.imports.containers.index`, `poker.imports.iterations.index` | JSON | Feature: PokerImportBrowsingTest, GitHubTrackerTest, JiraDataCenterTrackerTest; browser P12c-02a, P12c-03a | PokerImportBrowsingTest (guests, ended games, disabled provider, throttle) |
| `teams.pokerImports.containers.index`, `teams.pokerImports.iterations.index` | JSON | Feature: TeamPokerImportBrowsingTest, PokerCreationImportTest; browser R22-08, CVP-08 | TeamPokerImportBrowsingTest (other team, observer, stranger, logged out, other workspace) |

## Mockups

Captures compared at 1440 (light and dark) and 390: mockup previews with the design-system CSS, the app through `PokerPagesVisualTest`, `SessionCreateVisualTest` and the `/dev/design-system` bench. Icons of the previews (`data-lucide`) do not draw without their script, so icons were compared in the code.

| Mockup | Status | What |
| --- | --- | --- |
| PokerCard | fixed | The faces lost their rounded corners: the flip layer between the card and its faces had no radius, so `rounded-[inherit]` inherited nothing. The flip layer now inherits the radius (the note of the ScreenPokerBefore README). |
| DeckPicker | fixed | The author of a saved deck reads "by Inès" (was the bare name). The dashed tile says "Your values, ? and ☕ optional." under "Create a deck" (French in tu: "Tes valeurs"). |
| ScreenPokerQueue (Saved decks page) | fixed | The header button reads "New deck" ("Nouveau deck"), not "Create a deck"; the editor keeps the title "Create a deck". |
| MobilePoker | fixed / open | Fixed: the French "Tout le jeu" button reads "Tout le deck". Open: the players row sits below the story instead of at the top with "5 / 8 ont voté"; the phone top bar is not the mockup's "Planning poker · Sprint 43 / Story 3 sur 8 · Fibonacci"; the auto-reveal info banner ("Camille révélera…") is a chip. |
| ScreenPokerBefore | matches / open | Story card, table, seats, reactions above the deck, task queue and facilitator settings match. Open: the table centre shows the story key and title only in the bench, not in the room; the facilitator's own seat shows "voted", the PokerTable preview shows the own value (the README says values after the reveal only: owner ruling needed). |
| ScreenPokerAfter | open | Final-estimate preselection (app: nearest card to the average; mockup: the median), table centre content ("Cartes révélées · 5 médiane · 8/8 votes" vs average, median and dispersion), the "écart" word under outlier seats. All already listed in the walkthrough report. |
| ScreenPokerQueue (room, Estimation history) | open | History: no deck, period or "Re-voted only" filters and no CSV export (backlog per plan 22); the search finds titles only while the mockup says "Search tasks or tickets…" (ticket keys have no folded search column: needs a migration); a "Search" button the mockup does not draw. Room: compact rounds list (known). |
| PokerTable | matches | Bench sections draw the seats, statuses above and below, progress, reveal, outliers and the result panel as the preview. |

Kept on purpose: the vote drawer title "Choose your card" follows the Drawer mockup ("Choisissez votre carte"), which disagrees with MobilePoker ("Votre estimation"); the mockups' "vous" texts are written in tu (owner rule); "3 / 6 de la partie" follows the English mockup "3 / 6 in this game".

## Roadmap acceptance criteria (poker)

| Criterion | Test |
| --- | --- |
| P22-3 poker form: timer per task, change of vote, write estimates, import tab | R22-07, R22-08 |
| P22-4 the same settings in the room popover | R22-05 |
| P22-5 story card ticket type, labels, criteria | R22-01, R22-09, R22-10, R22-11, capture P22-20-06 |
| P22-8 task timer starts each round; expiry reveals only with auto reveal | R22-04, R22-07 (start); P10b-08a, P10b-08b (expiry) |
| P22-9 change of vote after reveal until the estimate is saved | R22-02, R22-03; refusals and race: RevoteAfterRevealTest, tests/Concurrency |
| P22-10 write estimates off: no write, the reason shown | R22-06; field choice: feature tests |
| P22-11 import at creation: order, skipped ids reported, tracker error creates nothing | R22-08, CVP-08 (skipped, singular count), CVP-09 (Jira outage) |
| P22-12 team browse routes | TeamPokerImportBrowsingTest (feature) |
| P22-13 ticket details for members and guests, assignee hidden from guests | R22-01 |
| P22-14 and P22-15 criteria split | R22-01; AcceptanceCriteriaSection unit tests |
| P22-16 strings in four languages, informal | R22-11, P10b-16a/b; TranslationKeysTest, InformalRegisterTest |
| P22-17 captures | P22-20-04, P22-20-06, P18e-03-* |
| P23-6 every member may take control of a poker game | P10a-13a, P10a-13b |
| P23-7 an observer opening a game becomes a spectator, loses an unrevealed vote, sees the notice | CVP-03 |
| P26-2/3 and P26-16 guest colour at the poker join page | CVP-05 |
| P29-14 403 with the team block, plain 403 to a stranger | CVP-01, CVP-06, CVP-07 |

Phone 390, dark theme and English: every poker screen is captured in the eight configurations of `captureVisuals` (P18e-03-08 to 18, P18e-01-22), plus R22-09 (phone), R22-10 (dark), R22-11 (English, French).

## App bug found

- The flash after a creation import read "1 tickets imported, 1 skipped." It now counts in the singular (`PokerCreationImportTest`).
