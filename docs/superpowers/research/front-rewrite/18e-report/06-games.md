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
| Draw & Guess, Decoded and Sprint in one GIF still show their old boards inside the new stage | Tasks G4 and G5 |
