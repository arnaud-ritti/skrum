# Brief 06 — GAMES (icebreakers), plan 18e

Read-only research. Sources read: spec (§4-§10), `inventory-pages.md` (games sections, lines 2523-2830), `inventory-components.md` part C, `notes-for-18e.md`, mockups ScreenIcebreaker / Draw / Emoji / Gif, GamesLeaderboard, IcebreakerGameCard, GifPicker, MobileRituals READMEs, the new components `skrum/{games-leaderboard,icebreaker-game-card,gif-picker,guest-join,timer,presence-stack,connection-state,empty-state,frames}.tsx`, old pages/components, `tests/Browser/Walkthroughs/Plan13{a,b,c,d}*.php`. NOT verified: the `preview.html` files (README text only), Playwright behaviour of the new components, how Inertia v3 `Deferred` exposes a failure to a child (see risk R6), whether `GifPicker` is a Dialog/Popover/Drawer in the DOM (R2).

## 1. Scope

| Page | Route (name) | Layout today -> target | Mockup |
|---|---|---|---|
| `games/index` | `GET w/{workspace}/teams/{team}/games` (`teams.games.index`), `POST` same URI (`teams.games.store`) | `AppLayout` (default branch) -> new `layouts/skrum/app-layout` with `active="games"` | GamesLeaderboard (+ NewGameRoomDialog inside it) |
| `games/join` | `GET/POST play/{guestToken}` (`games.join.show/store`, 404 when invalid) | `AuthLayout` -> `layouts/skrum/auth-layout` (unchanged switch in `app.tsx`) | GuestJoin (kind `game`) + EmptyState-style invalid card (no mockup) |
| `games/show` | `GET games/{room}` (`games.show`), JSON `games/{room}/**` | `null` in `app.tsx` -> stays `null`; the container renders `layouts/skrum/session-layout` itself (R7) | ScreenIcebreakerDraw (standalone frame: back, name, game badge, invite, settings), ScreenIcebreaker (hangman), ScreenIcebreakerEmoji, ScreenIcebreakerGif, MobileRituals (hangman phone) |
| icebreaker stage in `retros/show` | retro phase `icebreaker`, `board.icebreaker: GameSnapshot` | retro frame (group 2 owns the frame, topbar, ReactionBar, LiveCursorLayer) | same four Screen mockups, grid without the standalone topbar |

Game kinds (`app/Enums/GameKind.php`): `hangman`, `draw` (DrawAndGuess), `decoded`, `gif` (SprintGif). The component library already uses exactly these values (`skrum/games-leaderboard.tsx` `GameKind`).

## 2. Commits (in order)

| # | Commit | Old files deleted | Kept on purpose |
|---|---|---|---|
| G1 | `feat(games): team games page` (index + leaderboard) | `components/games/new-room-dialog.tsx`, `room-card.tsx`, `team-leaderboard.tsx` | `types/games.ts` |
| G2 | `feat(games): guest join` | none (page is inline); drop `Heading`/`InputError` imports | |
| G3 | `feat(games): room shell and hangman` | `game-room`, `room-header`, `room-menu`, `room-settings-dialog`, `delete-room-dialog`, `reset-scores-dialog`, `room-timer`, `room-invite-button`, `room-invite-dialog`, `room-sidebar`, `players-list`, `room-scores`, `game-switcher`, `game-panel`, `game-board`, `round-end-card`, `round-points`, `start-round-controls`, `leader-picker`, `pass-round-button`, `history-drawer`, `round-detail`, `room-full`, `room-gone`, `hangman-board`, `hangman-figure`, `word-mask`, `letter-keyboard` (28) | `room-context.tsx` (imported by `hooks/use-secret-word.ts`) |
| G4 | `feat(games): draw & guess and decoded` | `draw-board`, `drawing-toolbar`, `guess-chat`, `hint-button`, `leader-word`, `decoded-board`, `clue-editor` (7) | `drawing-canvas.tsx`, `clue-row.tsx` rewritten IN PLACE (retro results import them: `retro/results/round-replay-dialog.tsx`, `games-played-round.tsx`) |
| G5 | `feat(games): sprint in one GIF` | `sprint-gif-board`, `gif-question-banner`, `gif-answer-stage`, `gif-voting-stage`, `gif-round-results`, `game-gif-picker` (6) | `gif-tile.tsx` (retro results); `components/gifs/gif-search-dialog.tsx` is still used by `retro/gif-picker.tsx`: deleted by whichever of group 2 / this group lands last |
| G6 | `feat(games): icebreaker stage in the retro` | `components/retro/icebreaker-stage.tsx`, `icebreaker-game.tsx`; edit `retro/board.tsx` import | `retro/icebreaker-game-select.tsx` (new-retro dialog / settings, other groups) |

44 files deleted, 4 kept (`room-context`, `drawing-canvas`, `clue-row`, `gif-tile`) = the 48 of `components/games/`. Order constraint: G6 needs group 2's retro frame merged first (shares `retro/board.tsx`); G1, G2 are independent of everything; G3 -> G4 -> G5 are sequential (shell, then boards).
Each commit also adds a `pages/dev/sections/games-*.tsx` bench section (as 18d did for about/admin) for the composed surfaces (R8), and the visual test captures.

## 3. Parity table

Hooks column: what the Pest suite binds to today. "same" = no change. Section 8 lists changes imposed by mockups.

### games/index (G1)

| # | Action | Old control (file) | Route / event | New control | Hook to preserve | Note |
|---|---|---|---|---|---|---|
| 1 | Open "New room" dialog | `new-room-dialog.tsx` | client | `skrum/NewGameRoomDialog` (inside `GamesLeaderboard`, header + empty state) | button "New room"; `#new-room-name`, `#new-room-game`, `#new-room-access`; options "Hangman"/"Draw & Guess"/"Decoded"/"Sprint in one GIF"/"Anyone with the link"/"Team members only" | `ids` defaults already equal the old ids. Shown only when `canCreate` |
| 2 | Create room (name max 60, game = available only, access team/link) | same | `POST teams.games.store`, redirect `games.show` | `onCreate(values)` -> `router.post(TeamGameRoomsController.store.url(...), values, {onError})`; `createErrors` = `errors` (name/game/access); `creatingRoom` = processing | button "Create room" | Server errors "This team already has 10 game rooms." (on `name`), "This game is not available." (on `game`) must show. Return `false` on error so the dialog stays open |
| 3 | Cancel | same | client | dialog Cancel | | |
| 4 | Back to the team | `pages/games/index.tsx` | `GET teams.show` | `backHref` of `GamesLeaderboard` | link "Back to the team" | |
| 5 | Open a room | `room-card.tsx` | `GET games.show` | `GamesRoom.href` (`GameRoomsController.show.url(id)`) -> `GameRoomList` row link | `a[href$=...]`; link name now "name, game, [status], n players" | Row shows rounds, Globe "Open by link" / Users "Team only" |
| 6 | Room limit text | `index.tsx:53-77` | props `roomLimit`, `rooms` | `roomLimit` prop | "This team already has :count game rooms." | |
| 7 | Empty rooms | `index.tsx:81` | | built-in `EmptyBlock` + "New room" | "No game rooms yet." | |
| 8 | Switch period 30d / all | `team-leaderboard.tsx` ToggleGroup | `router.reload({data:{period}, only:['period','leaderboard']})` | `onPeriodChange` (Radix Tabs in `Leaderboard`) | `[aria-label="Period"]`, "Last 30 days", "All time" | tests read `[data-state="on"]`; Tabs say `active` (section 8) |
| 9 | Deferred leaderboard skeleton / retry | `<Deferred rescue>` | `router.reload({only:['leaderboard']})` | `leaderboard`/`leaderboardLoading`/`leaderboardError`/`onRetryLeaderboard` | "Could not load the leaderboard.", "Try again" | R6 |
| 10 | Streak badge (>=2) | `team-leaderboard.tsx` | `streak` | badge ":count-week streak" | "2-week streak" in the row of the user | component only renders it from 4th place: R1 |
| 11 | Points / wins / rounds per row, "No games played yet." | same | | `LeaderboardBody` | "No games played yet." | |
| 12 | Current user highlighted | none today | | `currentUserId` = `auth.user.id` | | new, free |

### games/join (G2)

| # | Action | Old | Route | New | Hook | Note |
|---|---|---|---|---|---|---|
| 13 | Join with display name (required, max 50, prefilled `suggestedName`) | `join.tsx` `<Form {...GameJoinsController.store.form(token)}>` | `POST games.join.store` (throttle 10/min) | `GuestJoin` `session={{kind:'game', title: roomName ?? t('Join a game'), gameLabel}}`, `initialName={suggestedName}`, `onSubmit` -> `router.post(GameJoinsController.store.url(token), {name})`, `error={errors.name}`, `processing`, `loginUrl={route('login')}` | `#name` (GuestJoin id is `name`), button "Join" | prefill must be `initialName` (test reads `#name` value); `defaultName` would not prefill |
| 14 | Invalid link (HTTP 404 page) | `join.tsx:23-33` | | `EmptyState`-style card in AuthLayout: title "Join a game", text "This guest link is no longer valid." | both strings | no mockup: designed from ScreenErrors/EmptyState (section 6) |
| 15 | Already a player -> redirect | server | | unchanged | | |

### games/show — room chrome (G3), all games

| # | Action | Old control | Route / event | New composition | Hook | Note |
|---|---|---|---|---|---|---|
| 16 | Back to team | `room-header.tsx` | `links.team` | topbar `Button asChild variant=ghost` + `ArrowLeft` | `[aria-label="Back to the team"]`, absent for guests | |
| 17 | Room name, game badge | header | | `SessionLayout title` + `Badge` | `header > h1` / `header:has(h1)` text (5 asserts) | keep an `h1` in the header |
| 18 | Switch game (host; non-host sees badge) | `game-switcher.tsx` | `PUT games.game.update` `{game}`, 204, refetch; abandons round | `IcebreakerGameGrid` + `IcebreakerGameCard` (`available` from `GameOption.available`, `selected`, `onSelect`) in the left column (Sheet on mobile) | was `[aria-label="Game"]` Select + `[role=option]` | D1. Mid-round switch has no confirmation today: keep |
| 19 | Set timer 1/2/3/5/10 min | `room-timer.tsx` | `PUT games.timer.update` `{seconds}`, `apply(timer.set)` | `skrum/Timer` (`remainingSeconds` from `useCountdown(timerEndsAt, serverOffset)`, `onStart(seconds)`, `onStop`, `presets`) in `SessionLayout timer` | `[aria-label="Timer"]` trigger, menuitem "1 min" (`[role=menuitem]:text-is("1 min")`) | D4. host and standalone only |
| 20 | Stop timer | same | same `{seconds:null}` | `Timer onStop` | "Stop timer" | |
| 21 | "Time's up" | `Badge` in `room-timer` | client | `Badge variant=destructive` next to the stage title, rendered in `<main>` | `main [data-slot="badge"]` contains "Time's up" | R4: Timer pill lives in the header, outside `main` |
| 22 | Presence strip | `retro/presence-strip` | presence `here/joining/leaving` | `PresenceStack` (`participants` from `online`, `role: 'member'/'guest'`) | `[role="group"][aria-label="2 online"]` (34 asserts); `data-presence-id` | `labels` default already "n online" |
| 23 | History drawer, pick round, Back | `history-drawer.tsx`, `round-detail.tsx` | `snapshot.history`; `GET games.rounds.show` | `ui/sheet` (side right, `onCloseAutoFocus={useRestoreFocus(open)}`), list rows + outcome `Badge`, detail pane with game-specific replay | button "History", text "Last rounds", `[role=dialog]`, "Back" | spinner while loading, destructive text on error |
| 24 | Copy guest link | `room-header.tsx` | clipboard, toasts "Link copied" | topbar icon button | `[aria-label="Copy guest link"]` | only `guestUrl !== null` |
| 25 | Invite to chat | `room-invite-*.tsx` | `POST games.shares.store` `{channel, include_guest_link}`, refetch | `Dialog` + existing `integrations/share/post-link-section` (kept, other group) | "Invite", "Invite to the room", "Post link to Slack|Telegram|Microsoft Teams|Mattermost", "Send link to webhook", "Sending to Slack…", "Sent to Slack", "Slack: failed — …", checkbox | D7. shown if `hasShareChannel(share) \|\| deliveries.length>0` |
| 26 | Room menu (settings, regenerate link, hand over, become host, delete) | `room-menu.tsx` | see 27-31 | `DropdownMenu` (`size="wide"`) | `[aria-label="Room menu"]`, `[role=menuitem]` "Room settings", "Delete room" | hidden for icebreakers and when no right |
| 27 | Room settings (name, access, locale) | `room-settings-dialog.tsx` | `PATCH games.update` | `FormDialog`/`Dialog`, ids `room-name`, `room-access`, `room-locale` | `#room-name`, `#room-access`, "Save"; warning "Guests in this room lose access." | `NewGameRoomDialog.ids` precedent |
| 28 | Regenerate guest link | menu | `POST games.guest-token.store`, toast | menu item | | |
| 29 | Hand over / become host | menu submenu | `PUT games.host.update` `{player_id}` | `DropdownMenuSub` of non-guest players | | |
| 30 | Delete room (confirm) | `delete-room-dialog.tsx` | `DELETE games.destroy` then `router.visit(links.team ?? dashboard)` | `ConfirmDialog tone destructive` | `[role=dialog] button:has-text("Delete")` | |
| 31 | Reset scores (confirm) | `reset-scores-dialog.tsx` | `DELETE games.scores.destroy` | `ConfirmDialog` | "Reset scores", "Scores in this room start again from zero. The team leaderboard keeps them." | `canManage && !isIcebreaker` |
| 32 | Side column Players / Scores | `room-sidebar.tsx`, `players-list.tsx`, `room-scores.tsx` | client | `ui/tabs` kept (R-tabs, section 4) | `[role=tab]:has-text("Scores")`, `[role=tabpanel]`, `section[aria-labelledby="game-players"]` + `h2#game-players`, `[aria-label="6 points"]`, "(guest)", "No points yet.", "Former member" | ranked rows per mockup `.g-player`; crown on host, check on winner, offline at reduced opacity |
| 33 | Language switcher (guests) | `language-switcher` | `LocalesController.update` | kept component in topbar actions | `[aria-label="Language"]` | |
| 34 | Session expired / reconnecting | retro `session-expired-banner`, `connection-banner` | 401/419; status | `ConnectionState variant=banner status='expired'|'reconnecting'` + `onReload` | "Reconnecting…" `role=status`; content `inert` when expired | old retro banners are deleted by group 2, not here |
| 35 | Room full / gone | `room-full.tsx`, `room-gone.tsx` | presence 403; `game.room.deleted`; snapshot 404/403 | `EmptyState module="icebreaker"` (title+action) | "This room is full.", "Try again", "This room was deleted.", "Your access to this room has ended.", "Back to the team" | |
| 36 | `data-realtime` root | `game-room.tsx:46` | `realtimeState(connected, online)` | wrapper `div` inside the layout `main` | `[data-realtime]` = connected (`awaitRealtime`) | |

### Round lifecycle (G3)

| # | Action | Old | Route / event | New | Hook |
|---|---|---|---|---|---|
| 37 | "Ready to play?" + Start (host) / "Waiting for the host to start." | `round-end-card.tsx`, `start-round-controls.tsx` | `POST games.rounds.store` | `Card` + `Button`; non-host text | "Ready to play?", "Start", "Next round", "Waiting for the host to start." |
| 38 | Leader picker "Who draws?" / "Who gives the clues?" (online only, rotation) | `leader-picker.tsx` | body `{leader_player_id}` | `ui/select` | `button[aria-label="Who draws?"]`, "Waiting for another player" (disabled button) |
| 39 | End card: outcome badge, word, ":name found it!", points chips | `round-end-card.tsx`, `round-points.tsx` | `lastEnded` / history | `Card`, `Badge`, `ul[aria-label="Points of this round"]` "+6 Casey" | outcomes "Guessed/Solved/Lost/Time's up/Passed/Revealed/Abandoned" |
| 40 | Pass / Give up (host or leader) | `pass-round-button.tsx` | `POST games.rounds.pass.store` | `Button variant=outline` | "Pass", "Give up" (Hangman, host only) |
| 41 | Timer expiry | server job + lazy | `game.round.ended` timed_out | `Badge` "Time's up" (row 21) | |

### Hangman / Draw / Decoded / GIF boards (G3-G5)

| # | Action | Old | Route / event | New | Hook |
|---|---|---|---|---|---|
| 42 | Pick a letter (keyboard disabled while pending; picked disabled `aria-pressed`) | `letter-keyboard.tsx` | `POST games.rounds.letters.store` `{letter}`; 429 "Slow down a little.", 409 toast | composed keyboard of `ui/button` keys | `[role=group][aria-label="Letters"] button:has-text("t")` |
| 43 | Figure, misses, mask, last letters | `hangman-figure`, `word-mask`, `hangman-board` | `game.letter.picked` | SVG on tokens, `WordMask` cells | `[aria-label="1 of 6 misses"]` (role img) + text "1 of 6 misses", `[role=img][aria-label="6 letters left to find"]`, `ul[aria-label="Last letters"]` "Bob picked S" |
| 44 | Drawer: word, canvas, tools, hints | `draw-board`, `drawing-canvas`, `drawing-toolbar`, `leader-word` | `POST drawing-ops`, `DELETE .../last`, `DELETE .../drawing`, secret `GET`; whisper `game-stroke` | see section 4 | "Your word to draw", `canvas[aria-label="Your drawing"]`, `[role=toolbar][aria-label="Drawing tools"]`, `[aria-label="Red"]` `aria-pressed`, `[aria-label="Fill"]`, `[aria-label="Undo"]`, "Clear" -> "Click again to clear" |
| 45 | Guesser: mask, read-only canvas, live strokes | same | `game.drawing.*`, whisper | `canvas[aria-label="The drawing"]`, "Bob Leader is drawing" |
| 46 | Guess chat, "Very close!", leader notice | `guess-chat.tsx` | `POST games.rounds.guesses.store`; `game.guess.made` | `section[aria-labelledby="game-guesses"]` `role=log`, `input[aria-label="Your guess"]`, submit | "You know the word, so you cannot guess.", "Very close!", "You found it!" toast, "No guesses yet." |
| 47 | Reveal a letter | `hint-button.tsx` | `POST games.rounds.hints.store` | `Button` | `button:has-text("Reveal a letter (2 left)")` |
| 48 | Decoded clue editor (5 slots, remove, emoji picker, 300 ms debounce) | `clue-editor.tsx` | `PUT games.rounds.clue.update` | slots `ui/button`, `retro/emoji-picker` (kept) | `[aria-label="Add an emoji"]`, "More emoji…", `button[frimousse-emoji][aria-label="Rocket"]`, `[aria-label="Remove 🚀"]`, `[role=img][aria-label="Clue: 🚀 🌕"]` |
| 49 | GIF stage 1: question banner, Shuffle, Edit, Save/Cancel | `gif-question-banner.tsx` | `PUT games.rounds.question.update` | `Card` + `Button`s, `Input[aria-label="Question"]` | "Shuffle question", "Edit question", "Save" |
| 50 | Choose / Change / Remove GIF | `gif-answer-stage.tsx`, `game-gif-picker.tsx` | `GET games.gifs.index?q=`, `PUT/DELETE .../answer` | `skrum/GifPicker` (R2) | "Choose a GIF", "Change GIF", "Remove GIF", "Pick a GIF that answers the question.", "No GIFs yet.", `ul[aria-label="Answers"]` |
| 51 | Reveal | same | `POST games.rounds.reveal.store` | `Button` | "Reveal the GIFs" |
| 52 | Stage 2 vote (toggle, retract, live "n of m voted") | `gif-voting-stage.tsx` | `PUT/DELETE games.rounds.vote.*` | `ui/toggle` heart `aria-pressed` ("Favourite"/"Your favourite") | "Vote for your favourite GIF.", "1 of 2 voted" (`aria-live=polite`) |
| 53 | Finish round | same | `POST games.rounds.close.store` | `Button` | "Finish round" |
| 54 | Results: counts, "+N", "Anonymous GIF" | `gif-round-results.tsx` | `lastEnded.answers` / `GET rounds.show` | `Card` grid of `gif-tile` | "Votes: 1", "+2", "Anonymous GIF" |
| 55 | Round detail per game (hangman letters tried, draw replay, clue, GIF results) | `round-detail.tsx` | `GET games.rounds.show` | inside History sheet | `canvas[aria-label="Drawing of lantern"]`, no `canvas.cursor-crosshair`, "Letters tried: …" |
| 56 | Switch/game unavailable text "This game is not available." | `game-board.tsx`, `start-round-controls.tsx` | | `Alert` | |

### Icebreaker stage in the retro (G6)

| # | Action | Old | Route / event | New | Hook |
|---|---|---|---|---|---|
| 57 | Stage replaces columns in phase `icebreaker`; spinner when `board.icebreaker===null` | `icebreaker-stage.tsx` | `board.icebreaker` | `components/games/icebreaker-stage.tsx` container: `ui/spinner` then grid | `section[aria-label="Icebreaker game"]`, `[data-test^="retro-column-"]` count 0 |
| 58 | Slim bar "Icebreaker" + game badge/switcher + History | `icebreaker-game.tsx` | | left column (cards for facilitator, badge otherwise), `History` in stage header | `[aria-label="Game"]` -> D1 |
| 59 | `useGameRoom(snapshot,{subscribe:false})`, `subscribeGameEvents(handleEvent)`, `useUnknownPlayerRefetch`, `useBoardSnapshotRefetch`, `withBoardTimer` | same | retro presence | moved verbatim into the new container (these three helpers are logic, not view) | |
| 60 | Live cursors over the stage | `LiveCursorLayer` | | stage `main` keeps `ref` + layer (retro file) | `.lc-overlay` "Bob" |
| 61 | Not mounted: timer menu, copy link, invite, room menu, presence strip, language, full/gone, banners, "Reset scores" | | | same omissions via `room.isIcebreaker` | `[aria-label="Copy guest link"]`, `[aria-label="Room menu"]` absent |
| 62 | Board timer drives the game timer; "Time's up" in the stage | `withBoardTimer` | `board.retro.timerEndsAt` | same | `section[aria-label="Icebreaker game"]` contains "Time's up" |
| 63 | Retro results reuse: replay canvas, clue row, GIF tile, outcomes | `retro/results/*` | `GET rounds.show` | untouched here (files kept, R5) | P13d-11 |

## 4. Composition

### 4.1 `games/index` (G1) — container `components/games/team-games.tsx`
- Page (thin): `<Head title={t('Games')}/>` + `<TeamGames {...props}/>`; `GamesIndex.layout = { active: 'games', breadcrumbs }` (same mechanism as `pages/settings/profile.tsx`).
- `skrum/GamesLeaderboard` does everything. Adapters (field by field): `rooms[i]` -> `GamesRoom {id, name, game, access, playersCount, roundsCount, href: GameRoomsController.show.url(id)}`; `status`, `minPlayers`, `players` NOT passed (no server data, D6); `gameOptions` as is (`GameOption` identical); `canCreate` -> `canCreateRoom`; `roomLimit`; `period`; `leaderboard[i]` -> `GamesLeaderboardEntry {userId, name, avatarUrl, points, wins, roundsPlayed, streak}` (no `presence`); `currentUserId = auth.user.id`; `teamName = team.name`; `backHref = TeamsController.show.url({workspace: workspace.slug, team: team.id})`.
- Period: `router.reload({data:{period}, only:['period','leaderboard'], preserveScroll:true})`; retry: `router.reload({only:['leaderboard']})`.
- `GamesRoom.updatedAt` and `gameLabel` stay unused (as today).

### 4.2 `games/join` (G2) — container `components/games/guest-join.tsx`
`GuestJoin` + Inertia `router.post`/`useForm`; invalid state a small card (`Card`, `Button asChild` to `route('login')`? none: only the two strings, as today).

### 4.3 Room shell (G3) — containers in `components/games/`
- `game-room.tsx` (page container, keeps the name): `useGameRoom(initial,{subscribe:true})` -> `RoomProvider` (file `room-context.tsx` unchanged) -> `<SessionLayout title actions presence timer>`; inside: `div[data-realtime]` > `ConnectionState`, `section` grid `g-grid` = left column (`IcebreakerGameGrid`, host only; sidebar tabs), stage (board or end card), right column (guesses/last letters/points). Tailwind grid: `grid-cols-1 lg:grid-cols-[17.5rem_minmax(0,1fr)_20rem]` (arbitrary grid template is allowed by rule 3); `min-w-0` on all three; mobile: left column in a `Sheet` (facilitator), right column in a `Drawer` (scores) per MobileRituals.
- New small presentational pieces composed from primitives (no skrum component exists; put them in `components/games/` as pure view files with no network, props typed; the container passes data): `game-stage-card` (stage surface `bg-skrum-canvas` + Card), `player-row` (`.g-player`: rank, `PersonAvatar`, name, "(guest)", crown, points `aria-label=":count points"`), `outcome-badge`, `round-points` list.
- Hangman: `hangman-figure` SVG (strokes in `stroke-foreground`; lost parts `stroke-skrum-destructive-text`; remaining parts dashed `stroke-border`); `word-mask` (cells = `Badge`-like boxes, `role=img`); `letter-keyboard` rows by locale (fr AZERTY, de QWERTZ, en/es QWERTY; keys 2.75rem on phones, `is-hit`/`is-miss` via `bg-skrum-success-soft`/`bg-skrum-destructive-soft` + icon, picked => `disabled` + `aria-pressed`) — D8; "Last letters" `ul` (green hit / neutral miss, with text not colour only).
- Shared adapters: `GamePlayer {id, presenceId, name, avatarUrl, isGuest}` -> `Participant {id: presenceId, name, avatarUrl, role: isGuest?'guest':'member', status: online.has(presenceId)?'online':'offline'}` for `PresenceStack`; `GameRoom.timerEndsAt` + `serverOffset` -> `Timer.remainingSeconds` via `useCountdown`; `GameOption[]` -> `IcebreakerGameCard {game: value, title: label, available, selected: value===room.game, pitch}` (pitch = four new translated strings; `durationMin`, `players`, `participants` omitted: no source, the card hides them).
- Hooks/libs reused as they are: `use-game-room`, `use-game-channel`, `use-secret-word`, `use-stroke-whispers`, `use-countdown`, `lib/games/*` (reducer, rotation, outcomes, hints, clue, drawing, stroke-whisper, gif, leaderboard), `lib/realtime/*`, `lib/retro/api` (`retroRequest`), `components/integrations/share/*`, `components/language-switcher`, `retro/emoji-picker`.

### 4.4 Draw and Decoded (G4)
- Draw stage: card (`bg-card`) with word block (drawer: "Your word to draw" in `font-display`; guesser: `WordMask` + ":name is drawing"), then `drawing-canvas` (kept file: canvas `width=800 height=600`, `aspect-4/3 w-full touch-none`, wrapper `rounded-lg border bg-card`; drop the `bg-white` class, the white comes from raster palette index 0), then the tool bar. No `skrum/` component covers it (`WhiteboardColorBar` is the 8 sticky colours, unusable): compose `role="toolbar" aria-label="Drawing tools"` from `ui/toggle-group` (colours: six `ToggleGroupItem`s named by colour, swatch via inline `style` is NOT allowed, so map colour name -> class using the column tokens only for the swatch; the stroke itself stays the fixed raster palette, R3/D2), size group (4/10/24), Pen/Eraser/Fill (`aria-pressed`), Undo, Clear (two-step, 3 s auto-cancel) and a `Popover` for colours on phones (mockup).
- Serial promise queue, optimistic previews, 40 ms whisper throttle, `useSecretWord`, `committedOpIds`: copied unchanged from `draw-board.tsx` into the new `draw-board.tsx`.
- Guess chat (`guess-chat.tsx`, shared by Draw/Decoded): `section[aria-labelledby="game-guesses"]`, `h2#game-guesses`, list `role="log" aria-live="polite"` auto-scroll, "Very close!" `Badge variant=warning` on own near misses (mockup `is-close`), form `Input`+`Button` (type submit), maxLength 50.
- Decoded stage: `clue-row` (kept, tiles `size-14 rounded-lg border bg-card text-3xl`, `role=img`) + `clue-editor` (5 slots as today) + `WordMask` + `hint-button` + chat. The mockup's puzzle model (8 pre-set riddles, timed hints at -20 pts, attempts list, round list) does NOT match the engine (a player gives the clue); only its visuals are taken: sky card, big emoji tiles, hint chip as the existing `HintButton`.

### 4.5 Sprint in one GIF (G5)
- Stage 1: `Card` (question, host tools), answer area: own tile "Your GIF" (`gif-tile`), `Button` "Choose a GIF"/"Change GIF"/"Remove GIF", list of `ul[aria-label="Answers"]` with ":name answered" placeholders (`eye-off` icon + `PersonAvatar`, mockup `.gf-hidden`), host "Reveal the GIFs".
- `skrum/GifPicker` wired by a hook `useGameGifSearch(roomId)` (new, in `components/games/`): `GET games.gifs.index?q=` with 300 ms debounce and empty query on open; maps `{id, previewUrl, width, height}` -> `GifItem` (rest optional); `status`: `loading|idle|empty|error` (any non-429 error), `rate_limited` (429), `disabled` (404 / 403); `provider = round.gifProvider`; `withCaption=false` (no server field); `categories` default; `onSelect(gif)` -> `PUT answer {gif_id}` via `ctx.run(retroRequest(...))`; `selectedId = myAnswer?.gif.id`.
- Stage 2: grid (`grid gap-3 grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]`), caption "Your GIF" / "by :name" / "Anonymous GIF", vote toggle `ui/toggle` with `Heart` (not for own GIF), progress text "n of m voted", host "Finish round". Vote budget "2/2" and caption 60 chars: not rendered (engine: one vote).
- Results: same grid sorted by votes desc, "Votes: n" + "+N" `Badge`; top-voted card ring `ring-2 ring-primary` + crown "Winner" label (derived, D5).

### 4.6 Icebreaker stage in the retro (G6)
`components/games/icebreaker-stage.tsx` (default export used by `retro/board.tsx`): same container as `retro/icebreaker-game.tsx` (provider, 3 helper hooks) but renders `GameLayout` (the shell grid of 4.3, without topbar) under `section[aria-label="Icebreaker game"]`; no `SessionLayout`. Props unchanged: `{hideMyCursor}` and `useBoard()`. Left column holds `IcebreakerGameGrid` (facilitator) or the game `Badge`.

## 5. Realtime

| Item | Where it lands |
|---|---|
| Presence channel `game.{roomId}` (`use-game-channel`, `subscribe:true`) | `GameRoom` container only (standalone). Icebreaker: `subscribe:false`; events arrive through `board.subscribeGameEvents(room.handleEvent)` from `use-retro-channel` |
| 16 events (`GameEvents`) | handled by `use-game-room.handleEvent` -> reducer; unchanged. View landing: `game.round.started/ended` -> stage/end card; `letter.picked` -> keyboard, figure, last letters; `guess.made` -> chat; `drawing.*` -> canvas; `clue.changed` -> `ClueRow`; `question/answer/revealed/vote` -> GIF stages; `room.changed` -> refetch; `room.deleted` -> gone screen; `timer.changed` -> `Timer` |
| Whisper `client-game-stroke` | `use-stroke-whispers` in the new `draw-board.tsx` (drawer sends every 40 ms; guesser previews dropped after 3 s). Must keep working in the retro (shared retro channel with cursors) |
| `data-realtime` | wrapper in `GameRoom` (see 36) |
| Two browsers to verify per commit | G3: member + guest letters, timer, delete/settings (P13a); G4: stroke visible live to the viewer, fill identical pixels, secret word absent from page source; G5: placeholders then reveal then vote tallies; G6: member + guest in a retro, cursors + reactions still work |
| Reactions in the standalone room | none today; D3 |
| `team.{id}.games` channel of the GamesLeaderboard README | does not exist on the server: not subscribed (no realtime on `games/index`, as today) |

## 6. Mockup elements not rendered / elements without mockup

Not rendered (no back end, not in spec §9; add to the §10 backlog record in the report):

| Mockup element | Reason |
|---|---|
| Room status badges live/waiting/finished, "needs n more players", avatar stack, "started 4 min ago" (GamesLeaderboard) | `GameRoomSummary` has no status/players; `status` left undefined |
| `team.{id}.games` realtime list | no channel/events |
| Two truths and a lie, Mood, Who, Quick question games | not in `GameKind` |
| IcebreakerGameCard `durationMin`, `players {min,max}`, `participants` availability | no source (card hides each line) |
| Settings card (word theme, time per turn, auto hints, categories, guests, "votes", "hidden authors") | only name/access/locale exist (room settings dialog) |
| Turn order / "A toi de jouer" / "Tour d'Ines" (hangman) | Hangman has no turns: everybody plays together |
| Round counter "3 / 6", "Manche 4 / 8", per-turn timer | no round total; one room timer |
| "trouve · 0:18", "Trouve par 2/5", found time chips | correct guesses are never stored for display |
| Draw: Redo, "Autre mot (1)", 8 column-colour ink, Pencil/Eraser shortcuts `P` `E`, `Cmd+Z` | server `DrawingOp::Colors` has 6 + white; no redo, no re-roll |
| Emoji: 8 riddles, progressive timed hints, -20 pts hint, attempts list, "2 mots sur 3" | different engine (clue-giver), see 4.4 |
| GIF: captions (60 chars) and preview-before-send, 2 votes budget, vote heart reactions on cards, step 3 podium with ranks, "Pin to the retro", "New round" in results, content rating footer | single vote, no caption column; pinning is §10 backlog; "Next round" already exists on the end card |
| GifPicker richer fields: `title`, `durationMs`, mp4/webp, still, categories counts | proxy returns `id, previewUrl, width, height` only; each rendered only when present |
| ReactionBar in the standalone room | D3 |

No mockup (designed from neighbours): invalid join card (from ScreenErrors + EmptyState), RoomFull / RoomGone (EmptyState `module="icebreaker"`), room settings dialog / delete / reset (FormDialog + ConfirmDialog like NewGameRoomDialog), History sheet and round detail (Sheet + Card + Badge as SessionCard rows), end card (Card + outcome Badge + points chips), start controls, Players/Scores tabs, Invite dialog, standalone topbar (SessionFrame slots: title `h1`, Timer, PresenceStack, actions) — all with tokens, `@container` rules and no fixed label widths.

## 7. Back-end changes

None from spec §9 apply to this group (no B-item mentions games). B10 (`ColumnColor` rename) does not touch games. Gaps to report, not plan: room status for the list (D6), per-game duration/player limits, a game settings model, winner/found-time data, a games realtime channel for the team page. The GIF provider/key/switch were already moved to instance settings (commit 4fbfcc00): `gameOptions[].available` and `round.gifProvider` are already provider-aware.

## 8. Browser tests

Files: `Plan13aGamesFoundationTest.php` (10 tests), `Plan13bDrawAndDecodedTest.php` (about 22), `Plan13cSprintGifTest.php` (7), `Plan13dIcebreakerScoresInvitesTest.php` (about 22); shared helpers `Support/InteractsWithBrowser.php` (`joinAsGuest`: `#name` + "Join"; `awaitRealtime`: `[data-realtime]`). `Plan07BoardEngagementTest.php:1001-1012` also binds to the game-shared GIF dialog names (retro GIF picker, other group).

Selectors that stay (do not rename): `section[aria-label="Icebreaker game"]`, `section[aria-labelledby="game-players"]`, `section[aria-labelledby="game-guesses"]`, `[role=group][aria-label="Letters"]`, `ul[aria-label="Last letters"]`, `ul[aria-label="Points of this round"]`, `ul[aria-label="Answers"]`, `[role=img][aria-label="n letters left to find"]`, `[aria-label="n of 6 misses"]`, `[role=toolbar][aria-label="Drawing tools"]`, `canvas[aria-label="Your drawing"|"The drawing"|"Drawing of <word>"]`, `[aria-label="Room menu"|"Timer"|"Copy guest link"|"Back to the team"|"Undo"|"Fill"|"Question"|"Your guess"|"Add an emoji"]`, `button[aria-label="Who draws?"]`, colour names, `[aria-label="n online"]` group, `#new-room-*`, `#room-name`, `#room-access`, `#name`, `.lc-overlay`, `data-realtime`.

Tests that MUST change (mockup-imposed), edit in the commit that causes them:

| Test | Line(s) | Change | Mockup cause |
|---|---|---|---|
| P13d-10a, 10b, 09a (G1) | `section[aria-labelledby="team-leaderboard"]`, `ol > li span.font-medium`, `li span.font-semibold`, `[data-state="on"]`, `assertCount("{$board} ol > li", 1)` | podium (first 3) + list from 4th; `[data-state="active"]` (Radix Tabs); rewrite selectors on `data-slot="podium-place"` / `leaderboard-row` and a stable container (add `aria-labelledby` or `data-slot="leaderboard"`) | GamesLeaderboard README anatomy (podium, `sk-tabs`) |
| P13a-02 (G2) | 143-144 | "You are invited to play Hangman. Choose the name other players will see." and "Display name" -> GuestJoin copy ("Join as a guest", "Your nickname", game label) | GuestJoin component (ScreenAuth) |
| P13c helper `p13cPick` (G5) | 102, 106 | `button[aria-label="Choose this GIF"]:has(img[src=".../preview"])` and `[aria-label="Search GIFs…"]` -> GifPicker names ("Search GIPHY|Tenor", `role=option` tile `GIF n`) | GifPicker README. Same edit in Plan07 (coordinate with group 2) |
| P13a-06 etc. (G3) | `main [data-slot="badge"]` "Time's up" | keep by rendering the Badge in `main` (R4); no change if done | |
| Tests using `[aria-label="Game"]` + `[role=option]:has-text(...)` (P13a-01/06, P13c-01, P13d-06a/b/c, P13b-01/02, ~9 asserts) | | `[role=radio]:has-text("Hangman")` on the radiogroup "Choose an icebreaker"; `assertSeeIn` selected card | ScreenIcebreaker left column (D1); none if D1 = keep Select |
| P13b-05a / P13b-04 pixel asserts | `'23 23 23 255'`, `'255 255 255 255'` | NO change if D2 default (fixed palette) | |

New tests (file `tests/Browser/Walkthroughs/Plan18eGamesTest.php`, ids `[P18e-GM-nn]`): 01 index shows podium with streak badge on a top-3 user and the current user highlighted; 02 index room list link names and order; 03 invalid guest link renders 404 card; 04 host picks a game from the cards while a non-host sees a badge and unavailable GIF card shows its reason; 05 hangman keyboard follows locale (fr row 1 starts with "a z e r t y") and stays operable at 390 px; 06 draw toolbar colour popover on phone width; 07 stage renders no horizontal overflow at 390/1440 in FR (visual harness, `tests/Browser/Visual/GamesPagesVisualTest.php` like `AdminPagesVisualTest`); 08 (if D3) reactions fly between two players. Vitest: `player-row`, `letter-keyboard` layouts, `useGameGifSearch` status mapping, leaderboard streak-on-podium (component fix R1).

## 9. Risks and open questions

| # | Risk | Evidence |
|---|---|---|
| R1 | `Leaderboard` renders the streak badge only in rows from the 4th place, and points as ":count points" text; the browser suite and parity row 10 need the streak for top 3 (two-member teams are always podium) | `skrum/games-leaderboard.tsx:625-690` (podium has no streak) vs `LeaderboardBody` 733-780; test `Plan13dIcebreakerScoresInvitesTest.php:557-572`. Fix in the component (add streak to `PodiumPlace`) inside G1 |
| R2 | `GifPicker` is shared with retro (`Plan07`); its role/names differ from the old dialog (`role=option` tiles, "Search :provider", no "Choose this GIF"); mobile Drawer vs desktop Popover switching is not verified; the P13c test asserts `[role="dialog"]` disappears after a pick | `skrum/gif-picker.tsx:667, 929`; `Plan13cSprintGifTest.php:102-109`. One ruling for groups 2 and 6 |
| R3 | Drawing colours are data (wire names + RGB asserted by tests `23 23 23 255`); mockup wants theme tokens and 8 colours, server accepts 6 + white; rule 1 forbids `bg-white`/hex classes | `lib/games/drawing.ts` Palette; `app/Support/Games/DrawingOp.php:13`; `Plan13bDrawAndDecodedTest.php:265-318`. The canvas stays a white sheet in dark mode: judge by eye on captures |
| R4 | `SessionFrame` puts the Timer in the header, outside `<main>`; "Time's up" asserted in `main [data-slot="badge"]` and in `section[aria-label="Icebreaker game"]` (retro) | `Plan13aGamesFoundationTest.php:360,390`; `Plan13dIcebreakerScoresInvitesTest.php:305`; `skrum/frames.tsx:75-110` |
| R5 | `drawing-canvas`, `clue-row`, `gif-tile`, `use-secret-word` -> `room-context` are imported by retro results / hooks: deleting the folder wholesale breaks group 2 | grep in section 2 |
| R6 | Deferred failure state: `GamesLeaderboard` wants `leaderboardError`/`onRetryLeaderboard`, but Inertia v3 `<Deferred rescue>` hides the error from siblings. Unverified; search the v3 docs first (`search-docs`); fallback: render the exported `Leaderboard` inside `<Deferred>` | `pages/games/index.tsx` old; `skrum/games-leaderboard.tsx:600` |
| R7 | `games/show` needs live slots (timer, presence) in the layout header; `setLayoutProps` per tick would re-render the layout. Chosen: page layout stays `null`, container renders `SessionLayout` (it works for guests: no sidebar). Group 2/3 may choose another pattern: align | `app.tsx:58-62`, `layouts/skrum/session-layout.tsx` |
| R8 | Four mockups describe games the engine does not have (Emoji riddles, GIF 2-vote/caption/podium, hangman turns, Draw redo). Built to the engine, visuals only | section 6 |
| R9 | Guest on `games/show` is rendered by `SessionLayout` without app sidebar: verify the 12-player full state and 401 JSON path still render inside the frame | `use-game-channel.ts` 403 handling |
| R10 | `LetterKeyboard` by locale: `LocaleController` locale list has de/es/fr/en; a new keyboard layout per locale is design only (server accepts a-z) | D8 |
| R11 | Shared lang files: ~40 new keys x4 languages (pitches, "Choose an icebreaker" is already used by `IcebreakerGameGrid`, history, winner label, join copy) | |

Decisions needed (product owner):
- D1 Game choice: cards in the left column (mockup, ~9 asserts change, one extra click on mobile via Sheet) or keep the `Select` named "Game" (no test change). Recommendation: cards.
- D2 Drawing ink: keep 6 server colours + eraser with fixed colours (recommended) or extend the server palette to the 8 column colours and theme-following strokes (a back-end change outside §9, breaks pixel tests).
- D3 ReactionBar in the standalone room: front-only via the existing `FlyingReactions` whisper on `presence-game.{id}` (poker and whiteboard do it) or record as backlog. Icebreaker already has the retro bar.
- D4 Timer presets: 1/2/3/5/10 min (today) or 1/3/5/10 (ruling 19 / `Timer` default). "2 min" disappears otherwise.
- D5 GIF results: derive and highlight the top-voted card(s) as "Winner" (not a server concept) or keep plain "Votes: n" + "+N".
- D6 Rooms list status/avatars: add a back-end item (status, player preview) or ship without (recommended).
- D7 Invite dialog: keep `PostLinkSection` in a plain `Dialog` (recommended: `ShareDialog` has expiry/roles/QR tabs the games back end lacks) or adapt `ShareDialog` with `channelsExtra`.
- D8 Hangman keyboard by locale (AZERTY/QWERTZ/QWERTY, mockup) or a single alphabetical grid as today.

## 10. Size

- Containers/new view files to write: about 38 (`team-games`, `guest-join`, `game-room`, `game-layout`, `icebreaker-stage`, header/menu/dialogs 7, sidebar+player-row+scores 3, end card/start/pass/history/detail 6, hangman 4, draw/chat/toolbar/hint/leader-word 5, decoded 2, gif 6 + `useGameGifSearch`), plus 3 in-place rewrites (`drawing-canvas`, `clue-row`, `gif-tile`) and one component fix (`PodiumPlace` streak).
- Old files deleted: 44 (+2 retro icebreaker files in G6); old pages edited: 3.
- Tests touched: 3 leaderboard tests, 1 join test, `p13cPick` helper (+ Plan07 coordination), about 9 asserts if D1 = cards; new file `Plan18eGamesTest.php` (7-8 tests) + visual test + Vitest for about 4 files.
- Parallelism: G1 and G2 can run in parallel with every other group. Shared files touched: `resources/js/app.tsx` (no edit expected, switch already right), `lang/{en,fr,es,de}.json` (all commits), `retro/board.tsx` import line (G6 only, group 2), `types/games.ts` (unchanged), `components/gifs/gif-search-dialog.tsx` (deletion shared with group 2), `skrum/gif-picker.tsx` (shared ruling R2), `skrum/games-leaderboard.tsx` (R1 fix, G1). G3-G5 depend on nothing but the shared `lang` files; G6 must wait for group 2's retro frame.
