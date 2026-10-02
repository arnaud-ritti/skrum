# Plan 18e — Group 6, games

## Task G1: team games page (`games/index`)

Page `resources/js/pages/games/index.tsx` (renders `AppLayout active="games"`), container `components/games/team-games.tsx`, hook `components/games/use-team-games-channel.ts`, presentational `skrum/games-leaderboard.tsx`.

### Parity (brief 06 §3 rows 1–12, brief 01 §3 rows 47–52)

| # | Action | New control | Done |
|---|---|---|---|
| 1 / 47 | Open "New room" | `NewGameRoomDialog` in the header and in the empty state; only when `canCreate` | done |
| 2 / 48–51 | Create a room (name max 60, available games only, access) | `#new-room-name`, `#new-room-game`, `#new-room-access`, "Create room"; `router.post` to `teams.games.store`; the server messages show under their field and the dialog stays open | done |
| 3 / 52 | Cancel, Escape | dialog "Cancel", Radix | done |
| 4 | Back to the team | header link "Back to the team" | done |
| 5 | Open a room | one link per room, named "name, game, status, n players"; rounds, "Open by link" / "Team only" in the row | done |
| 6 | Room limit text | "This team already has :count game rooms." | done |
| 7 | Empty rooms | "No game rooms yet." with "New room" | done |
| 8 | Period 30 days / all time | tabs `[aria-label="Period"]`, partial reload of `period` and `leaderboard` | done |
| 9 | Deferred leaderboard, retry | skeleton while the prop is absent; "Could not load the leaderboard." and "Try again" when the page's `rescuedProps` holds `leaderboard` | done |
| 10 | Streak badge from two weeks | on the podium and in the rows | done |
| 11 | Points, wins, rounds; "No games played yet." | podium points; rows "n rounds · n wins" and points | done (wins and rounds of the first three are not shown: the mockup's podium has points only) |
| 12 | Current user marked | ring on the podium, accent row | done |

New with B28 (M19): status badge, avatar stack with the count of players not sent, "started n min ago"; the list is live on `private-team-games.{teamId}` and the leaderboard reloads when a round of a listed room ends.

### Places left

None. The deviations of D-20 that concern this page stay backlog.

### Differences with the mockup

| Difference | Covered by |
|---|---|
| No "needs n more players" line; a waiting room shows its rounds count there | D-20 |
| No "Finished" rooms: a room is live or waiting | D-20 (spec B28: two statuses) |
| Game tiles are the four games of the engine (Sprint in one GIF takes the sky tile of "Two truths and a lie") | D-20 |
| Row of a room also shows the rounds count and "Open by link" / "Team only" | parity rows 5 (no existing feature lost); no row in the table |
| Leaderboard rows read "n rounds · n wins", the mockup "n games · n wins" | the product counts rounds; no row in the table |
| Streak badge on the podium and in the rows; the mockup has none | parity row 10, Task 0.10; no row in the table |
| Status labels are the mockup's ("Live", "Waiting for players"); the plan text says "Playing" and "Waiting" | the mockup wins (rule 13) |
| The rooms card scrolls inside itself beyond 30rem (`GameRoomList`), the mockup shows four rooms only | component of plan 18c |

## Task G2: guest join (`games/join`)

Page `resources/js/pages/games/join.tsx` renders `GuestJoinPage` (`components/session/`, Task 0.7) with `kind="game"`; the page is in `ownLayoutPages`.

### Parity (brief 06 §3 rows 13–15, brief 11 §3 row 34)

| # | Action | New control | Done |
|---|---|---|---|
| 13 | Join with a name (required, 50 characters at most, prefilled with `suggestedName`) | `#name` "Your nickname", prefilled (6-D9); "Join" posts `{name}` to `games.join.store`; the server error shows under the field | done |
| 14 | Invalid link, HTTP 404 | notice "Join a game" / "This guest link is no longer valid." in the centred frame, no form | done |
| 15 | Already a player: redirect to the room | server, unchanged | done |
| 34 (brief 11) | Session card of the join page | room name, game name, "Live", "n participants", ":name facilitates" (the host), from the `session` prop of R2a (M28); sticky "Join" on a phone | done |

### Places left

None in the page. The colour picker and the short code of D-32 have their place in `GuestJoin` (`takenColors`, `session.code`), not given today.

### Differences with the mockup

| Difference | Covered by |
|---|---|
| No avatar colour picker, no short code | D-32 |
| The preview avatar is neutral (no presence colour) | D-32 |
| The session card starts with the game name ("Hangman") before the state | `GuestJoin` of plan 18c, plan text of G2; no row in the table |
| Button "Join", the mockup "Rejoindre la session" (Join the session) | `GuestJoin` of plan 18c and the browser contract (`click('Join')`); no row in the table |
| The Skrüm logo shows twice at 1440 and 390: in the frame's header and in the card | `AuthLayout` centred of Task 0.7 with the card of the mockup; no row in the table |
| Language select in the frame's header; the mockup card stands alone | `AuthLayout` of Task 0.7; no row in the table |
| The page sends no "Another random nickname" button: the name is prefilled, so the empty-name state only appears once the guest clears the field, and it then has no suggestion | O: 6-D9 (prefilled); `defaultName` not given, no row in the table |
| Invalid link: a notice card; the mockup has no such state | brief 06 row 14 |

## Task G3: room shell and hangman (`games/show`)

Page `resources/js/pages/games/show.tsx` (thin, in `ownLayoutPages`) renders `components/games/game-room.tsx`: `SessionShell kind="game"` with `RoomTitle`, `RoomTimer`, `SessionPresence`, `RoomActions` (`room-header.tsx`) and `GameLayout({ left, stage, right, summary, dock })` (`game-layout.tsx`, no topbar, reused by G6). Left: `GamePicker` (host). Stage: `GameStage` (title, "Time's up", History, Pass / Give up, then the board of the game or the end card). Right: `RoomSidebar` (Players / Scores tabs, then the last letters of a hangman round). Dock: `SessionReactions`.

### Parity (brief 06 §3 rows 16–43, 55–56)

| # | Action | New control | Done |
|---|---|---|---|
| 16 | Back to the team | `SessionTitle backHref`, `[aria-label="Back to the team"]`; absent for a guest | done |
| 17 | Room name, game badge | `h1` in the session header; soft badge with the icon of the game (`data-slot="room-game"`, from `sm`) | done |
| 18 | Switch game (host); a non-host sees a badge | `IcebreakerGameGrid` of compact `IcebreakerGameCard`s in the left column (a sheet under 80rem); `PUT games.game.update`; an unavailable game is listed with "Not available"; no confirmation mid-round, as before | done |
| 19 | Set the timer | `SessionTimer` in the header, the Timer's own list 1, 3, 5, 10 minutes (X5: the 2-minute entry is gone); host of a standalone room only | done |
| 20 | Stop the timer; "+2 min" | "Stop timer"; "+2 min" posts to `games.timer.extension.store` (B20) | done |
| 21 | "Time's up" | `TimeUpBadge` beside the stage title, in `<main>`; not shown when the end card already carries the outcome "Time's up" | done |
| 22 | Presence | `SessionPresence` (`[role="group"][aria-label="n online"]`, `data-presence-id`), the host as facilitator | done |
| 23 | History, a round, Back | "History" in the stage header; sheet "Last rounds", rows with the outcome, detail with "Back"; focus returns to the button | done |
| 24 | Copy the guest link | "Invite" → Share dialog → "Copy link" (6-D7); toast "Link copied" | done |
| 25 | Post the link to a chat | Share dialog, "Post a link": the connected channels, "Include the guest link", the hint and the delivery lines (`DeliveryLines`) | done |
| 26 | Room menu | `[aria-label="Room menu"]` (settings icon): Room settings, Hand over hosting, Become host, Delete room | done |
| 27 | Room settings | `FormDialog`: `#room-name`, `#room-access` (with "Guests in this room lose access."), `#room-locale`, and the new switch `#room-reactions` (B27, 6-D3); "Save" | done |
| 28 | New guest link | Share dialog, "Create a new link" with its confirmation; no longer in the menu | done |
| 29 | Hand over / become host | menu, unchanged routes | done |
| 30 | Delete the room | `ConfirmDialog` destructive (`[role="alertdialog"]`), then the team page | done |
| 31 | Reset scores | Scores tab, "Reset scores", `ConfirmDialog` destructive | done |
| 32 | Players / Scores | `ui/tabs`; `section[aria-labelledby="game-players"]` of `PlayerRow`s (online first, host crown, winner check, offline dimmed, "(guest)", "(you)"); ranked `ol` with `[aria-label="n points"]`, "No points yet.", "Former member" | done |
| 33 | Language (guest) | `LanguageSwitcher` in the header actions | done |
| 34 | Session expired / reconnecting | `SessionShell` banners; content inert when expired; the header's Invite and menu are disabled | done |
| 35 | Room full / gone | `EmptyState module="icebreaker"`: "This room is full." with "Try again"; "This room was deleted." / "Your access to this room has ended." with "Back to the team" for a member | done |
| 36 | `data-realtime` | the shell's one `[data-slot="session-root"]` | done |
| 37 | "Ready to play?", Start, "Waiting for the host to start." | card on the stage, `StartRoundControls` | done |
| 38 | Leader picker | `LeaderPicker` (`button[aria-label="Who draws?"]`), "Waiting for another player" | done |
| 39 | End card | card: outcome badge, word, ":name found it!", `ul[aria-label="Points of this round"]`, "Next round" | done |
| 40 | Pass / Give up | stage header, host or leader | done |
| 41 | Timer expiry | outcome "Time's up" on the end card | done |
| 42 | Pick a letter | `LetterKeyboard` laid out for the language of the player (6-D8: AZERTY for French, QWERTZ for German, QWERTY otherwise); a picked key is disabled and pressed, a hit green, a miss struck through | done |
| 43 | Figure, misses, mask, last letters | `HangmanFigure` (lost parts in the destructive text colour, the parts left dashed), badge "n of 6 misses", "Missed: A, R, S", `WordMask`, `ul[aria-label="Last letters"]` in the right column with a check or a cross | done |
| 55 | Round detail per game | history sheet, unchanged content | done |
| 56 | "This game is not available." | stage and start controls, unchanged | done |

New with the owner's answers: the reaction bar docked under the stage while `room.reactionsEnabled` (6-D3; its digit shortcuts are off while a hangman, drawing or decoded round is in play); the full Share dialog (6-D7: guest switch `#room-guests`, link, QR code, "Create a new link").

### Places left

| Place | Slot | Feature |
|---|---|---|
| Left column, under the game cards | `GameRoom settingsCard` → `GamePicker settings` | settings card of a game (GM-1) |
| Right column, under the players | `GameRoom turnOrder` → `RoomSidebar turnOrder` | turn order (GM-2) |
| Stage header, above the title | `GameRoom roundInfo` → `GameStage roundInfo` | "Round n of m" (GM-2) |
| Game picker | lists whatever `snapshot.games` holds | the four other games (GM-4) |

### Kept until G6

`components/games/game-switcher.tsx` (the old `Select` named "Game") and `game-panel.tsx` (now a thin two-column frame over the new stage and sidebar) are still imported by `components/retro/icebreaker-game.tsx`, which G6 replaces: G6 deletes both.

### Differences with the mockup

| Difference | Covered by |
|---|---|
| No "Round n of m", no turn banner, no turn order, no per-turn timer; everyone picks at once | D-20 (places left) |
| No settings card under the game cards | D-20 (place left) |
| Four game cards (the engine's), compact, without duration; the selected card has a check mark, not an "In play" badge | D-20; the badge would be false while no round is in play (F); no row for the badge |
| No field "guess the whole word (+50 pts)" | the engine has no whole-word guess in hangman; no row in the table |
| Right column: Players / Scores tabs; the mockup has one "Scores" list | brief 06 row 32 and the browser contract (`[role="tab"]`, `section[aria-labelledby="game-players"]`); no row in the table |
| "Last letters" reads ":name picked :letter" with a check or a cross; the mockup adds the points of each pick | points are given at the end of a round; D-20 ("found by" chips) is the nearest row |
| Topbar: the room's name alone, the mockup has "Atlas · Games" above it and "Back to games"; the back link goes to the team page, named "Back to the team" | `SessionTitle` of Task 0.3 and the browser contract; no row in the table |
| Topbar: the room timer (alarm button for the host) stands where ScreenIcebreakerDraw has none; the stage has no large turn timer | one room timer (D-20); `SessionTimer` of Task 0.5 |
| The reaction bar is docked under the stage, in its own strip, not floating over it | it can then never cover the keyboard or a guess field (plan, P18e-06-08) |
| Phone: the keyboard is in the flow under the word, not a docked panel; the players are chips with their points, the full lists in a sheet; no "guess the word" button, no hint line | D-20 for the hint and the turn; the rest has no row |
| No user avatar at the right end of the topbar | `SessionFrame` of plan 18a (the user menu is in the sidebar) |
| Sprint in one GIF still shows its old board inside the new stage | Task G5 |

## Task G4: Draw & Guess and Decoded

New bodies, same files: `draw-board.tsx`, `drawing-toolbar.tsx`, `guess-chat.tsx`, `hint-button.tsx`, `leader-word.tsx` (now also `WordCard` and `MaskedWord`), `decoded-board.tsx`, `clue-editor.tsx`; rewritten in place with the same exports: `drawing-canvas.tsx`, `clue-row.tsx` (the retro results import them). Touched for the stage: `game-stage.tsx` (`RoundStatus`, the line above the name of the game; a drawing takes the height the stage has left), `room-sidebar.tsx` (the guesses under the players, where the right column exists), `game-layout.tsx` (`useHasRightColumn`), `word-mask.tsx` (`hint`), `game-panel.tsx` (the status line, for the retro frame G6 replaces). Two utilities at the end of `resources/css/app.css` (`draw-area`, `draw-sheet`): the sheet is the largest 4:3 box of its area.

### Parity (brief 06 §3 rows 44–48)

| # | Action | New control | Done |
|---|---|---|---|
| 44 | Drawer: word, canvas, tools, hints | word card "Your word to draw · only you see it" with "Reveal a letter (n left)" at its right end; `canvas[aria-label="Your drawing"]`; `[role="toolbar"][aria-label="Drawing tools"]`: Pencil (P), Eraser (E), Fill, three strokes, Ink and the eight theme colours (`aria-pressed`), Undo (⌘Z / Ctrl+Z), "Clear" then "Click again to clear" (3 s) | done |
| 45 | Guesser: mask, read-only canvas, live strokes | word card with the blanks (a revealed letter in the primary colour) and "Letters revealed: n of m"; `canvas[aria-label="The drawing"]`; ":name is drawing" above the name of the game; the drawer's pencil and name follow the stroke being drawn | done |
| 46 | Guesses, "Very close!", leader notice | `section[aria-labelledby="game-guesses"]` in the right column (on the stage under 64rem, the field first): `role="log"`, avatar, name and text per guess, own near miss on the warning background with the badge "Very close!"; `input[aria-label="Your guess"]` and "Guess"; the leader reads "You know the word, so you cannot guess."; "No guesses yet."; toast "You found it!" | done |
| 47 | Reveal a letter | `HintButton` in the word card of the leader (Draw & Guess and Decoded) | done |
| 48 | Decoded clue editor | five slots in the sky card: `[aria-label="Remove 🚀"]`, `[aria-label="Add an emoji"]` (quick row, "More emoji…", the full list), 300 ms debounce, "Use emoji only, without letters or digits."; guessers see `[role="img"][aria-label="Clue: …"]` | done |

Kept from the old boards without change: the serial queue of drawing operations, the optimistic previews, the 40 ms whisper, the three-second drop of an abandoned live stroke, `useSecretWord`, `committedOpIds`. The legacy colours (red, orange, green, blue, purple) are drawn and never offered.

New with rule 13 (M20): `P`, `E` and `⌘Z` / `Ctrl+Z`, for the drawer, on the stage only (`useShortcut`: not in a field, not under a dialog or a menu); shown in the tooltips, `P` and `E` also in the corner of their key. They are always on until plan 18f brings `single_key_shortcuts` (B35).

### Places left

None new. "Round n of m" keeps the `roundInfo` slot of G3, above the status line.

### Differences with the mockup

| Difference | Covered by |
|---|---|
| No Redo, no "New word" (the hint button stands in its place in the word card) | D-20 |
| No "found · 0:18" per player, no "Found by · n / m" block, no system line ":name found it! +120" in the guesses: the first right guess ends the round | D-20 ("found by" chips) |
| No drawing order, no settings card, no "Round n of m", no turn timer on the stage | D-20 (places left by G3) |
| The hint block reads "Letters revealed: n of m"; the mockup "Hint · 2 words · next letter in 0:12" (hints are given by the leader, not by a clock) | D-20 (auto hints) |
| Left column: the game cards of G3 (host only); right column: Players / Scores tabs, then the guesses. The mockup has the players on the left and the guesses alone on the right | G3 layout (brief 06 row 32 and the browser contract); no row in the table |
| A "Fill" tool beside Pencil and Eraser | parity row 44 and the browser contract (`[aria-label="Fill"]`); no row in the table |
| The sheet is white in both themes; the mockup's is `--card` | spec ruling 36 (canvas data) |
| The swatches follow the theme (the `-text` tokens, pastel in the dark theme) while the strokes are the light literals on the white sheet: in the dark theme a swatch is lighter than the line it draws, and "Ink" is a light dot that draws black | plan text of G4 and ruling 36; no row in the table — reported |
| The live pencil tag is in the primary colour, not in a presence colour | game rooms give no presence colour to a player; no row in the table |
| Under the guess field: "Enter to send. Only you are told when you are close."; the mockup "Enter to send · close guesses stay private" (a close guess is shown to all, only its "Very close!" is private) | F |
| Phone: the guesses stand on the stage under the game, the field first; the mockup has them in a drawer with the field at the keyboard. The toolbar wraps on two rows at 390 | no row in the table |
| Decoded: a player gives the clue; the mockup's riddle bank, timed hints, "Hint now (−20)", attempts chips, "Found" chips, rounds list and round leaderboard are not built. Taken from it: the sky card, the emoji tiles, the hint block. The guesses are the shared list of the right column | D-20 (emoji riddle bank) |
| Decoded: one meta badge, "n letters"; the mockup has category, words and time | D-20 |
| The clue giver's view (editor in the sky card) has no mockup | brief 06 §6 |

### Browser tests

Changed: none in this task (`Plan13bDrawAndDecodedTest` already reads "Coral" and its RGB since G0a). New in `Plan18eGamesTest.php`: `[P18e-06-06]`, `[P18e-06-10a]`, `[P18e-06-10b]` (the plan's `[P18e-06-10]` in two tests: live inks and keys; the legacy red replay in the retro results). The RGB of each ink is read from `lib/games/drawing.ts` by the test.

## Task G5: Sprint in one GIF

New bodies, same files: `sprint-gif-board.tsx`, `gif-question-banner.tsx`, `gif-answer-stage.tsx`, `gif-voting-stage.tsx`, `gif-round-results.tsx`; rewritten in place with the same export: `gif-tile.tsx` (the retro results import it). New: `gif-steps.tsx` (`useGifStep`, `GifStepLine`, `GifSteps`). Deleted: `game-gif-picker.tsx` (the answer stage gives its search to `GifSearchDialog` itself). Touched for the stage: `game-stage.tsx` (the step line above the name of the game, the caption place), `room-sidebar.tsx` (status of each player, "Ready", "How it works", the podium place), `round-end-card.tsx` (a wider card for the gallery), `game-room.tsx` (the two places).

### Parity (brief 06 §3 rows 49–54)

| # | Action | New control | Done |
|---|---|---|---|
| 49 | Question, Shuffle, Edit, Save / Cancel | prompt card of the mockup (iris clapperboard, question, what to do at this step); "Shuffle question" and "Edit question" at its right end for the host until the first answer; `Input[aria-label="Question"]`, "Save", "Cancel" | done |
| 50 | Choose / Change / Remove a GIF | card "Your pick": "Choose a GIF" in the empty frame; then the tile "Your GIF", badge "Sent", "Your GIF stays hidden until the reveal.", "Change GIF", "Remove GIF"; `GifSearchDialog` with `search` = `GET games.gifs.index?q=`, `provider = round.gifProvider`, `selectedId = myAnswer?.gif.id`; "Already sent · n" over `ul[aria-label="Answers"]` of hidden tiles (eye-off, avatar, ":name answered"); "No GIFs yet." | done |
| 51 | Reveal | "Reveal the GIFs" (host) | done |
| 52 | Vote, change, retract; live tally | gallery of GIF cards (`auto-fill`, one column on a phone); `Toggle` with the heart, "Favourite" / "Your favourite" (`aria-pressed`), not on one's own GIF; "n of m voted" (`aria-live="polite"`) | done |
| 53 | Finish the round | "Finish round" (host), beside the tally | done |
| 54 | Results: counts, "+N", "Anonymous GIF" | gallery in the end card, the most voted first with the mark "Winner" (6-D5; every GIF of a tie, none without a vote), "Votes: n", "+N", "by :name" / "Anonymous GIF"; same gallery in the history sheet | done |

New from the mockup: "Step n of 3 · …" above the name of the game; in the right column, the status of each player ("GIF picked" / "picking…", then "voted" / "voting…"), the "Ready n / m" bar while picking, and "How it works" (Pick a GIF, Reveal & vote, Winner).

### Places left

| Place | Slot | Feature |
|---|---|---|
| Card "Your pick", under the line of the chosen GIF | `GameRoom gifCaption` → `GameStage gifCaption` → `RoundBoard gifCaption` → `SprintGifBoard caption` → `GifAnswerStage caption` | caption of a GIF (GM-3) |
| Right column, under the players and the turn order | `GameRoom gifPodium` → `RoomSidebar gifPodium` | podium of the results (GM-3) |

### Differences with the mockup

| Difference | Covered by |
|---|---|
| No caption (field, counter, caption on a card), two votes, vote budget, podium and ranking, "Pin to the retro", "New round" in the right column, "Copy the gallery link" | D-20 (places left for the caption and the podium) |
| No reactions on a GIF card; the vote control reads "Favourite" / "Your favourite" and shows no count while the votes are open; the results read "Votes: n", the mockup "n votes" | D-20; the labels are the browser contract |
| The GIF picker opens in a dialog from "Choose a GIF" / "Change GIF"; the mockup shows it open on the stage | plan text of G5 (`GifSearchDialog`, no second GIF container) and the browser contract; no row in the table |
| "Your pick" stands on the stage, under the question; the mockup has it in the right column. There is no "Draft" then "Send my GIF": a chosen GIF is sent at once (badge "Sent") | the picker being a dialog, the stage would be empty; the engine has no draft (N); no row in the table |
| Participants, their status and "How it works" stand in the right column, under the Players / Scores tabs; the mockup has them on the left. The left column is the game choice of G3 (host only) | G3 layout; no row in the table |
| No settings card (theme, votes, hide authors), no "Sprint 42" badge, no timer on the stage | D-20 (settings card, place left by G3); one room timer in the header |
| Step line "Step 1 of 3 · Pick a GIF"; the mockup "Pick your GIF" | the browser contract: `assertDontSee('Your GIF')` after a removal is not case sensitive; no row in the table |
| Step 2 (the votes open) has no mockup: it uses the gallery of step 3. The end card keeps the outcome badge "Revealed" and the question; the mockup has a badge "Votes closed" in the stage header | browser contract ("Revealed"); no row in the table |
| A hidden pick shows ":name answered" beside the avatar; the mockup the avatar alone | browser contract (`Casey answered` in `ul[aria-label="Answers"]`) |
| GIFs are `<img>` of the proxied preview, in a 4:3 frame, with an empty `alt`; the mockup asks for looping video, a still under reduced motion and the title as `alt` | the proxy gives a preview and a full GIF, no still, no video, no title (brief 06 §6); no row in the table — reported |
| Phone: the picker is the dialog of Task 0.13, not a full-screen drawer; no double-tap vote | Task 0.13; no row in the table |

### Browser tests

Changed: none. `Plan13cSprintGifTest.php` passes as it is. New captures: `games-room-gif`, `games-room-gif-voting`, `games-room-gif-results` (`GamesPagesVisualTest.php`, a GIF provider faked with flat tiles) and the bench section `games-gif`.

## Integration of wave 2a (2026-10-02)

Captures opened on the merged build: light 1440 and dark 390 of the games page (with rooms, empty), the join page (valid, invalid), and the room in hangman (round, end card), Draw & Guess (drawer, guesser), Decoded (clue giver, guesser) and Sprint in one GIF (pick, vote, results), beside a rendering of `GamesLeaderboard`, `GuestJoin`, `ScreenIcebreaker`, `ScreenIcebreakerDraw`, `ScreenIcebreakerEmoji` and `ScreenIcebreakerGif`.

Fixed at the integration:

| Difference | Fix |
|---|---|
| Join page: the logo twice (frame header and card) | `GuestJoin` takes `logo={false}`; `GuestJoinPage` passes it. One logo, the instance's own |
| Join page: no document title (the old page had one) | `<Head>` in `pages/games/join.tsx` |
| Games page at 390: the rooms card scrolled inside itself and cut the fourth room | the inner scroll applies from 64rem up; on a phone the list scrolls with the page |
| "1 players", "1 letters", "1 guesses" | singular keys |
| `P13a-06a` selector `:has(:text-is("1 min"))` no longer matched after lane W made the preset label the item's own text | the selector of the plan, `[role="menuitem"]:text-is("1 min")`, is back |

Remaining differences:

| Difference | Fix later or deviation row |
|---|---|
| Room rows with rounds and access, "n rounds · n wins", streak badges | D-56 |
| Shell: Players / Scores tabs, columns, "Back to the team", check on the selected card | D-57 |
| Reaction bar in its own strip | D-58 |
| Hangman: no whole-word field (keyboard docked on a phone since RW-G3) | D-59 |
| Draw: "Fill", pencil tag colour (guesses in a drawer on a phone since RW-G3) | D-60 |
| GIF: dialog picker, immediate send, voting on the results gallery, labels | D-61 |
| GIF: `<img alt="">`, no reduced-motion still (spec §5 rule 8) | D-62, owner decision |
| No turn banner, turn order, round counter, per-turn timer, settings card, caption, podium of a GIF round | D-20 |
| Podium streak badge cut at 390 in French ("2 semain…") | fix later: a shorter badge on the podium |
| Room header at 390: the title is cut to "Monday w…" | fix later, with the header budget of Task 0 |
| The aria-labels ":count points" and ":count letters left to find" have no singular (the browser suite binds "1 letters left to find") | fix later, with the test |
| At 390 the floating reaction bar of the room overlays the end of a long guesses list while it scrolls | not verified in a browser; fix later if confirmed |

## Rework RW-G1 (owner round 4, row D-57): each game on its mockup layout

`GameLayout` takes panels (`left`, `right`, `chooser`: `{ id, label, icon, content }`), a `variant` (`choice`: 21.25rem · stage · 20rem, Hangman and Decoded; `players`: 18.75rem · stage · 21.25rem, Draw & Guess and Sprint in one GIF) and `summaryFor` (the panel the chips stand for while it is in a sheet). `RoomPlayers` (`room-players.tsx`) is the one list of a room: rank, avatar, name, "(guest)", "(you)", "Host", what the player does in the round, the winner check, points, "No points yet.", "Reset scores". The Players / Scores tabs and `room-scores.tsx` are gone.

| Game | Left (from 80rem) | Right (from 64rem) |
|---|---|---|
| Hangman | game cards (host), the selected one says "In play" | "Scores" (`#game-players`), turn order (place left), last letters |
| Decoded | game cards (host) | "Scores" with "giving clues" / "guessing…", guesses |
| Draw & Guess | "Players" (`#game-players`) with points and "drawing" / "guessing…", drawing order (place left), settings (place left), "Choose a game" (host, opens the cards in a sheet) | guesses, during a round |
| Sprint in one GIF | "Participants" (`#game-players`) with the "Ready" bar and each status, "How it works", settings (place left), "Choose a game" (host) | "Scores" (`#game-scores`), podium (place left) |

Under 80rem the left panel is a sheet opened from the bar above the stage, under 64rem the right one too; the game choice of Draw & Guess and Sprint in one GIF is then a third button of that bar. The retro icebreaker (`game-panel.tsx`, old frame until G6) stacks the same pieces in its one side column.

Places left: `turnOrder` (under the Scores of Hangman and Decoded, under the Players of Draw & Guess), `settingsCard` (foot of the game cards, or foot of the players column), `gifPodium` (under the Scores of Sprint in one GIF).

### Browser tests changed

| Test | Change | Why |
|---|---|---|
| `P13b-01` | after the switch to Draw & Guess: the stage title, no cards in the left column, the cards open from "Choose a game" with the game checked and "In play" | players hold the left column (mockup) |
| `P13b-09` | no "Scores" tab; points read in `[data-slot="game-left"] section[aria-labelledby="game-players"]` | one list |
| `P13c-01` | as `P13b-01` | players hold the left column |
| `P13c-06` | no tab; `[data-slot="game-right"] [data-slot="room-scores"]`, and no points among the participants | one Scores list on the right |
| `P13d-09a`, `P13d-09b` | no tab; `[data-slot="room-scores"]`; after a reset "No points yet." and every player at "0 points" without a rank | one list of every player |
| `P18e-06-04` | added: "In play" on the selected card only, no tab, the right heading reads "Scores" | new behaviour |

No test removed. Vitest: `room-sidebar.test.tsx` rewritten for `RoomPlayersSide` / `RoomSidebar`; new `room-players.test.tsx`, `game-layout.test.tsx`.

### Differences with the mockup that remain

| Difference | Row |
|---|---|
| "Back to the team", no "Atlas · Games" overline, no avatar at the end of the topbar | D-57 (RW-C2) |
| Decoded: game cards on the left, not the "Rounds" list; "Scores" and guesses on the right, not a round leaderboard and totals | D-57 |
| Draw & Guess, Sprint in one GIF: "Choose a game" at the foot of the left column (host) | D-57 |
| "Host" badge in the list; no "found · 0:18"; no guesses column between two rounds of Draw & Guess | D-57 |
| Sprint in one GIF: "Scores" on the right, "Your pick" still on the stage | done in RW-G2, below |
| Turn order, settings card, podium | D-20 |
| Left column of the players variant is 18.75rem wide; a long name is cut next to "(you)" and "Host" | fix later if the owner asks: the badge could go to the second line |

## Rework RW-G2 (owner round 4, row D-61): picker on the stage, draft then send

While the players pick, the stage holds the question and the `GifPicker` open in the page (`inline`: a `group` as wide as the 40rem stage column, no focus taken, Escape left to the page, tiles of 10rem at most). A click on a tile is a draft: it is ticked in the picker and shown in "Your pick" with the badge "Draft", "Send my GIF" and "Change". Nothing reaches the server before "Send my GIF" (`PUT games.answers.update`); "Change" drops the draft and gives the keyboard back to the search. A sent GIF reads "Sent" with "Change GIF" (keyboard to the search; the next pick is a draft over the sent GIF, which stays sent until "Send my GIF") and "Remove GIF".

"Your pick" (`gif-your-pick.tsx`) heads the right column from 64rem, above "Already sent · n" (hidden tiles: eye-off and the avatar; the name is read by a screen reader and shown when a player has no avatar) and the "Scores" list. Under 64rem, and in the retro icebreaker under its `lg` column, it is a card under the picker, scrolled into view after a pick. The draft is shared by the two columns through `gif-draft.tsx` (`GifDraftProvider`, mounted by `RoomProvider`; `useGifDraft(roundId)`); it never leaves the browser.

The retro keeps `GifSearchDialog` for the GIF of a card; the games no longer import it.

| Place | Slot | Feature |
|---|---|---|
| "Your pick", under "Your GIF stays hidden until the reveal." | `GameRoom gifCaption` → `RoomSidebar gifCaption` (right column) and `GameStage gifCaption` → … → `GifAnswerStage caption` (card on the stage) → `GifYourPick caption` | caption of a GIF (GM-3) |

### Parity (row 50, rewritten)

| # | Action | New control | Done |
|---|---|---|---|
| 50 | Choose a GIF | picker open on the stage: search, categories, tiles; a click is a draft | done |
| 50 | Send | "Send my GIF" in "Your pick" | done |
| 50 | Change | "Change" (draft) / "Change GIF" (sent), then another tile | done |
| 50 | Remove | "Remove GIF" (sent) | done |
| 50 | Who has sent | "Already sent · n", `ul[aria-label="Answers"]`, ":name answered"; "No GIFs yet." | done |
| 51 | Reveal | "Reveal the GIFs" (host), under the picker | done |

### Browser tests changed

| Test | Change | Why |
|---|---|---|
| `Plan13cSprintGifTest` helper `p13cPick` | no opener and no dialog: searches in `[data-slot="gif-answer-stage"] [data-slot="gif-picker"]`, clicks the tile, reads "Draft" and the tile "Your GIF" in `[data-slot="gif-your-pick"]`, clicks "Send my GIF", reads "Sent" (new helper `p13cDraft` for the first half) | picker on the stage, draft then send (mockup, D-61) |
| `P13c-01`, `P13c-02` | call the new helper | same |
| `P13c-02` | added: a draft is ticked, sends nothing (no answer in the database, the other player still reads "No GIFs yet."), "Change" drops it and focuses the search; "Change GIF" focuses the search, and the sent GIF stays the answer until the new draft is sent; after "Remove GIF", "Choose a GIF" is read in "Your pick" | draft |
| `P13c-06` | `assertNotPresent('[role="tab"]')` is scoped to the two side columns (the categories of the picker are tabs, per the README of GifPicker); added: "Your pick" is in the right column | picker on the stage |
| `GamesPagesVisualTest`, "picking a GIF" | the viewer has sent nothing and clicks the first tile (a draft, as the mockup); three players have sent; eight GIFs in the fake search | the capture shows the mockup's state |

No test removed. Vitest: new `gif-your-pick.test.tsx`, `gif-answer-stage.test.tsx`; one more case in `room-sidebar.test.tsx` and in `skrum/gif-picker.test.tsx`.

### Differences with the mockup that remain

| Difference | Row |
|---|---|
| "Scores" list under "Already sent" in the right column | D-61 (no feature lost) |
| No title, duration, "loops" under the preview; the tile reads "Your GIF" | D-62 |
| No caption field and counter | D-20 (place left) |
| "Sent" state with "Change GIF" / "Remove GIF"; "Reveal the GIFs" under the picker (host); "Pass" and "History" in the stage head | D-61 |
| Hint "Pick a GIF that answers the question. GIFs stay hidden until the reveal."; the mockup adds "A short caption helps people vote." | D-20 |
| No "to pick" timer on the stage; no settings card | D-20, one room timer in the header |
| Tiles are the proxied pictures (4:3 in the fake provider), stills are placeholders under reduced motion; no duration pill, no title on hover | D-62 |
| The picker is a `group`, the mockup a `dialog` | D-61 (A) |
| Phone: picker in the flow of the stage (16rem body), "Your pick" under it; the mockup asks for a full-screen drawer | D-61 |

## RW-G3 — games on a phone (owner round 4b, D-59 and D-60)

`GameLayout` holds a footer under the stage and under the strip of the reaction bar, on a phone only (under 48rem): `[data-slot="game-footer"]`, read by a game through `useStageFooter()` (null on a wider screen and outside a `GameLayout`, such as the retro stage of `game-panel.tsx`, where the game keeps everything in its flow). A docked panel pads the inset of the home indicator (`dockedPanelClass`).

- **Hangman**: the keyboard is docked in the footer, on the muted ground of the mockup; the gallows, the misses, the word and the last three letters stay on the stage above it. From 48rem on, nothing changes.
- **Draw & Guess**: the footer holds the latest guess (announced, `aria-live`), a "Guesses" button with the count, and the guess field of who may guess; the button opens a `Drawer` with the whole list (`role="log"`). Who draws has the line and the button, no field; the drawer says why. From 48rem to 64rem the guesses stay on the stage as before; from 64rem on, in their column.

### Browser tests changed

| Test | Change | Why |
|---|---|---|
| `P18e-06-05` | at 390 the keyboard is in the footer, at the bottom of the viewport, the gallows and the word above it and in view; the assertion "keyboard above the last letters" is gone (the last letters stay in the board, asserted) | docked keyboard |
| `P18e-06-08` | at 390 the reaction bar is above the keyboard, without overlap; at 1440 the keyboard is above the bar, as before | docked keyboard, D-58 |
| `P18e-06-08b` | renamed; at 390 the field is in the footer at the bottom of the viewport, under the bar and the drawing; a guess shows in the line above the field and in the drawer, which has no field and closes on Escape; back at 1440 the guess is in the right column | guesses drawer |
| `GamesPagesVisualTest` | new captures `games-room-draw-guesses-*`: the drawer open at 390 (the 1440 ones are the guesser's room) | capture of the drawer |

No test removed. Vitest: new `hangman-board.test.tsx`, `guess-dock.test.tsx`; one more case in `game-layout.test.tsx`.

### Differences with the mockup that remain

| Difference | Row |
|---|---|
| Hangman: the reaction bar's strip between the stage and the keyboard | D-58 |
| Hangman: no "Guess the word" button in the last row of keys; gallows centred above the word, no "tries left" and hint beside them; players as chips in the bar with a sheet | D-59, D-20 |
| Draw & Guess: the drawer's toolbar is in the flow under the drawing, not docked; the secret word is a card, not a band | D-60 |
| Decoded: the guesses stay on the stage on a phone | D-60 |
| The page does not declare `viewport-fit=cover`, so the inset of the home indicator is zero today; the panels already pad it | none (blade shared, not changed) |

