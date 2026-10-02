# Plan 18e — rework after the owner's fourth round of answers

Addendum to `2026-10-16-plan-18e-front-rewrite-screens.md`. Its Global Constraints, Screen task procedure and Back-end task procedure apply to every task here. Source of every task: `docs/superpowers/research/front-rewrite/owner-answers-2026-10-02.md`, section "Fourth round" (rows marked REWORK), and the deviation rows named, in the plan's "Deviations from the mockup" table. The mockup (`docs/design-system/`) is binding (spec §5 rule 13): read the screen's README and preview before writing. Each task: TDD, one commit per task (shared-component fixes in their own commit), captures refreshed and compared with the mockup, the deviation row updated (removed when the difference is gone, reworded when part remains), browser tests that bind the old markup rewritten for the new one and listed in the report (never dropped).

## Lane core (main tree)

### RW-C1: Session creation — poker deck tiles, rows moved to the session settings, colour swatches
Rows D-37, D-38, D-39, D-41, D-42. In the "New session" dialog: (a) poker deck choice as the mockup's four small tiles with the values in mono, and a "New deck" button in the header of the Deck section; the Tasks block is visible without scrolling at 1440 × 900 (assert it in the browser test). `DeckPicker` gains a compact variant in its own commit (keep the large variant for the saved decks page). (b) "Automatic AI summary" (retro) and "Anonymous votes" (poker) leave the creation dialog; the server defaults apply at creation; both stay settable in the session's settings once it exists (check they already are; add the setting where it is missing, with its test). (c) Column colours as swatches alone: no visible name, the name as tooltip and accessible name; keyboard selection unchanged.

### RW-C2: Session header — team line, avatar, "Synced"; whiteboard breadcrumb
Rows D-47, D-48, D-63, D-69 and the games header of D-57. On every session screen (`components/session/*`, `skrum/frames.tsx`): the overline "team · session type" above the title, the user avatar at the end of the topbar (guests: their guest avatar), and a visible "Synced" connection state when connected (still exactly one `[data-realtime]` per page). Whiteboard: logo and editable breadcrumb "team › Whiteboards › name" (rename in place kept). Back end: each session snapshot or page prop sends the team name where it is missing (poker room, game room, whiteboard), one small tested addition per controller. At 390: the title and the essentials only (title never cut to a few letters: the overline, avatar and Synced label give way first). The retro lane is still running on another branch and will pick the new header at its merge: keep every existing prop of `SessionShell` / `SessionFrame` working (additions only) and list the new props in your report.

## Lane poker (worktree lanePoker)

### RW-P1: Poker room — result in the oval and the dock, final-estimate cards
Rows D-64, D-65. No result panel under the table: average, median, spread in the oval; agreement, distribution and the line naming the extremes in the dock (ScreenPokerAfter). Dock after reveal: final-estimate cards (the deck's values, nearest card preselected) and one button "Validate :value · Next story" that saves the estimate and moves to the next task (two existing server actions called in order; on failure of the second, the estimate stays saved and the error shows); "Re-vote" stays. Keyboard: focus moves to the dock on reveal. Browser tests of `Plan10a`/`Plan10b` that click "Save estimate" / "Next task" follow the new control.

### RW-P2: Poker room — past rounds, phone layout, queue
Rows D-66, D-67, D-68. Past rounds open by default, "name: value" kept. On a phone: a scrolling row of participants (mockup), first names on the seats (first word of the display name; full name as accessible name and tooltip). Queue: "Votes: n" on every row (back end: the snapshot sends the vote count of the last round of each task — tested, no vote values leaked before reveal), and the mockup's drop line while dragging (keyboard drag and its announcements unchanged; the queue stays `ol > li`). "pts" stays omitted.

## Lane games (worktree laneBackB)

### RW-G1: Game room — the layout of each game's mockup
Row D-57. Each game follows its own mockup: players on the left for Draw & Guess and Sprint in one GIF, one "Scores" list on the right (no Players / Scores tabs), "In play" on the selected game card. The reaction bar keeps its strip under the stage (D-58 stays).

### RW-G2: Sprint in one GIF — picker on the stage, draft then send
Row D-61. The GIF picker is open on the stage (the `GifPicker` component inline, not the dialog), the pick is a draft the player can change, "Send my GIF" sends it. The retro keeps the dialog. D-62 stays (animated `<img>`).

### RW-G3: Games on a phone — docked hangman keyboard, guesses drawer
Rows D-59, D-60. Hangman: the keyboard is a docked panel at the bottom of the viewport on a phone (safe-area inset; the word and the gallows stay visible above it). Draw & Guess: the guesses are in a drawer on a phone. "Fill" stays.

## Lane small (worktree lanePrepB)

### RW-S1: Maintenance — full reload and a 503 page that reloads by itself
An Inertia visit answered 503 forces a full page load so the real maintenance page shows (not Inertia's error modal). The static 503 page reloads by itself every 30 s through a small inline script and shows the mockup's sentence "This page reloads by itself" (four languages are not available on a static page: follow what the existing static page does for language). Row D-55 updated.

### RW-S2: Branding — exact radius, undo per staged image
A stored radius outside the segments shows its exact value (segment unselected, value field filled). Each staged image change (upload or removal) has its own undo before saving.

### RW-S3: Expired invitation — workspace name and inviter
The expired state of the invitation page shows the workspace name and the inviter, as the mockup, so the visitor knows whom to ask. Back end: the page prop for an expired invitation carries only those two values (tested: nothing else of the workspace leaks; a revoked or unknown token still answers as today). Spec §13 criterion 43 reworded to match.

## Deferred (not in this run)
- D-51 guest join (suggested nickname everywhere, button "Join the session"): after the retro lane merges, because about twenty walkthroughs change, several of them being edited by the retro lane.
- Recovery codes low-count alert and regenerate button: after the settings lane merges (Security page).
- D-54 invitation, logged out, inline account creation: plan 18f front, under its security rules.
- Registration creating a workspace and a team, whole-word guess in hangman: feature roadmap.
