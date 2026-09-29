# Skrum — Games — Design

Date: 2026-09-29
Status: Draft — open decisions pending
Parent spec: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md` (all its rules apply unless this spec changes them explicitly). Builds on `docs/superpowers/specs/2026-09-29-board-engagement-design.md` (whispers with verified senders, GIF proxy, `SingleEmoji`, board lock) and on spec 2 "Retro flow extras" (Icebreaker phase, see §1 Dependencies).
Research: `docs/superpowers/research/qretro/` (QRetro parity roadmap, spec 7 of 7; `docs-inventory.md` "Games", `screens/game-*.{jpg,svg}`)

## 1. Intent

Give teams four short real-time games, playable in standalone game rooms or as the icebreaker of a retro: **Draw & Guess**, **Sprint in one GIF**, **Hangman** and **Decoded**. The server is the only authority on secrets: a word or a GIF answer never reaches a client that should not see it yet.

**Success:** every rule below is covered by a feature test or a step of the two-browser walkthrough; no endpoint, snapshot or broadcast delivers a secret word to a non-leader or a GIF answer before reveal; test suite, phpstan, type-check and lint stay green; no new dependency.

### In scope

- Game rooms per team: create, list, rename, delete; team-only or open by link; at most 12 players online and 10 rooms per team; last 20 rounds kept.
- The four games with QRetro's rules (§4), one engine shared by rooms and the retro icebreaker.
- Icebreaker: how a game runs inside the Icebreaker phase and how the board timer closes turns (§6).
- Word dictionaries and GIF questions in en/fr/es/de, no repeated word until the pool is exhausted.
- Drawing transport (live whispers + server-committed operations) and drawing persistence for round history.

### Out of scope (deferred)

- Personal (non-team) game rooms.
- GIF uploads (skrum has no uploads; GIFs come from search only, for everyone).
- Scores, leaderboards, streaks.
- Slack/Telegram invites to rooms (spec 6 may add them).
- "Games we played" on the retro Results view (spec 2 owns Results; it can read `game_rounds` of the icebreaker room later).
- LLM-generated words or questions: lists are deterministic files.
- A frontend test runner or browser E2E suite.

### Dependencies

- **Spec 2 assumption (drafted in parallel):** spec 2 adds an optional `Icebreaker` case to `RetroPhase`, placed before `Writing`, reachable only when a retro-level toggle (assumed `retros.icebreaker_enabled`) is on, with the same adjacent-phase navigation and facilitator-only control as other phases. If spec 2 also stores which game the icebreaker starts with, this spec uses that column instead of adding `retros.icebreaker_game` (§2).
- Spec 1: `whisperTransport` (`resources/js/lib/retro/whisper-transport.ts`) and Reverb `accept_client_events_from: 'members'` (`config/reverb.php`), `GifCatalog` / `GifsController` / `RetroGifsController`, `SingleEmoji` (`app/Rules/SingleEmoji.php`), `RetroGuard::unlocked`.
- Existing infrastructure: the database queue worker (s6 service) runs delayed jobs for timer expiry; `BroadcastAuthorizationsController` authorizes presence channels.
- No new PHP or npm dependency. The canvas and flood fill use the browser Canvas 2D API.

## 2. Data model

### Enums

- `GameKind`: `DrawAndGuess` (`draw`), `SprintGif` (`gif`), `Hangman` (`hangman`), `Decoded` (`decoded`).
- `GameRoomAccess`: `Team` (`team`), `Link` (`link`).
- `GameRoundOutcome`: `Guessed`, `Solved`, `Lost`, `TimedOut`, `Passed`, `Revealed`, `Abandoned` (string values in snake case). A round with `ended_at = null` is active.

### `game_rooms` — new table

| Column | Type / default | Meaning |
|---|---|---|
| `id` | UUID | |
| `team_id` | FK teams, cascade | Owning team |
| `retro_id` | nullable FK retros, cascade, unique | Set for the icebreaker room of a retro; null for standalone rooms |
| `name` | nullable string (1–60) | Required for standalone rooms, null for icebreaker rooms |
| `created_by_user_id` | nullable FK users, null on delete | Creator (standalone) |
| `host_player_id` | nullable FK game_players, null on delete | Standalone host; icebreaker host is always the retro facilitator |
| `game` | `GameKind`, default `draw` | Game being played |
| `locale` | string, one of `config('skrum.locales')` | Word/question language; creator's locale at creation, host can change |
| `access` | `GameRoomAccess`, default `team` | Standalone only; icebreaker access follows the retro |
| `guest_token` | unique string | For `/play/{guestToken}`; hidden from serialization |
| `turn_seconds` | nullable int (30–600) | Auto turn timer (§5); default 90 for rooms, null for icebreakers |
| `timer_ends_at` | nullable timestamp | Standalone timer; icebreakers use `retros.timer_ends_at` |
| `current_round_id` | nullable FK game_rounds, null on delete | Active or last round |
| timestamps | | |

### `game_players` — new table

- `id` (UUID), `game_room_id` (cascade), `user_id` (nullable, null on delete), `participant_id` (nullable FK participants, cascade; icebreaker only), `guest_name` (nullable, 1–50), `guest_secret_hash` (nullable, hidden), timestamps.
- Unique (`game_room_id`, `user_id`) when `user_id` is not null; unique (`game_room_id`, `participant_id`) when not null.
- **Presence id:** `participant_id` in an icebreaker (the retro presence channel already uses participant ids), otherwise `id`. Every payload names players by `playerId` and the players list maps `playerId → presenceId`, so whisper senders (stamped by Reverb with the presence id) can be matched to players.
- Display name and avatar: same rules as `Participant` (`displayName()`, `avatarUrl()`; "Former member" after user deletion).

### `game_rounds` — new table

| Column | Type | Meaning |
|---|---|---|
| `id` | UUID | |
| `game_room_id` | FK, cascade | |
| `game` | `GameKind` | Kind at round start |
| `leader_player_id` | nullable FK game_players, null on delete | Drawer (Draw & Guess) / clue giver (Decoded); null otherwise |
| `word` | nullable string | Secret word (Draw & Guess, Hangman, Decoded). In the model's `$hidden`; only presenters in §7 read it |
| `revealed_positions` | jsonb int[] default `[]` | Hint letters (Draw & Guess, Decoded) |
| `picked_letters` | jsonb string[] default `[]` | Hangman letters in pick order |
| `misses` | smallint default 0 | Hangman |
| `clue` | jsonb string[] default `[]` | Decoded emoji (≤ 5) |
| `question` | nullable string (≤ 200) | Sprint in one GIF |
| `drawing` | jsonb default `[]` | Committed drawing operations (§4.1) |
| `drawing_points` | int default 0 | Running point count, for the cap |
| `winner_player_id` | nullable FK game_players, null on delete | Correct guesser / letter that solved Hangman |
| `outcome` | nullable `GameRoundOutcome` | Set when ended |
| `started_at`, `ended_at` | timestamps | |

- Retention: after a round is created, rounds of the room beyond the newest 20 are deleted (with their guesses and answers).

### `game_guesses` — new table

- `id`, `game_round_id` (cascade), `player_id` (FK game_players, cascade), `text` (1–50), `is_near_miss` (bool), `is_correct` (bool), `created_at`.

### `game_gif_answers` — new table

- `id`, `game_round_id` (cascade), `player_id` (cascade), `gif_id` (string ≤ 64), timestamps; unique (`game_round_id`, `player_id`).

### `game_used_words` — new table

- `team_id` (cascade), `locale`, `word`, `created_at`; primary key (`team_id`, `locale`, `word`). Word history is per team, shared by the team's rooms and icebreakers (Open decision 3).

### `retros` — new column

- `icebreaker_game` (`GameKind`, default `draw`): game the icebreaker room starts with, chosen next to spec 2's Icebreaker toggle in the create dialog and settings. Omitted if spec 2 already defines it (§1).

### Word and question files

- `resources/games/words/{en,fr,es,de}.php` returns a list of `['word' => string, 'drawable' => bool]`, theme: work, software, teams and agile plus everyday objects. Each locale has ≥ 250 words, ≥ 150 of them drawable. Words are 3–24 characters, letters plus at most single spaces, hyphens or apostrophes between letters, and every letter folds to `a–z` through `Str::ascii()` (no `ß`, `æ`, `œ`).
- `resources/games/gif-questions/{en,fr,es,de}.php` returns a list of ≥ 60 questions (≤ 200 characters), e.g. "How did the last deploy feel?".
- A `GameWordBook` class reads them (immutable data, safe to memoize under Octane).

## 3. Rooms, players and access

### Standalone rooms

- **List/create** on the team page, tab "Games" (`GET /w/{workspace}/teams/{team}/games`). Any team member (and workspace Owner/Admin, per `TeamPolicy::view`) can create a room and see the team's rooms (Open decision 4). A team holds at most 10 rooms (icebreaker rooms do not count) → 422 "This team already has 10 game rooms."
- Room card: name, game, access mode, number of players who ever joined, number of rounds kept.
- **Settings** (host, creator, or workspace Owner/Admin): name, access, locale, `turn_seconds`, regenerate the guest link. **Delete** (creator or workspace Owner/Admin) removes the room, players and rounds, and broadcasts `game.room.deleted`.
- **Host:** the creator on creation. The host can hand hosting to any other member player (guests never host). The creator and workspace Owners/Admins can take hosting at any time ("Become host"), so a room never stays stuck with an absent host.
- A room opens directly on its current state; if no round is active, the host sees "Start".

### Joining

- `team` access: team members (per `TeamPolicy::view`) only. A player row is created on first visit.
- `link` access: also `/play/{guestToken}`. Same rules as retro guests (core spec §3): a visitor enters a display name (prefilled with a random "Adjective Animal" name in their locale), gets a player with a hashed secret and an encrypted cookie `game_guest_{roomId}`; a returning guest resumes; a logged-in team member joins as themselves; a logged-in non-member joins as a guest without team access. Regenerating the token revokes the link and clears existing guest secrets. Switching access to `team` blocks every guest request (403).
- **12-player cap:** enforced when authorizing `presence-game.{roomId}`: the server asks Reverb for the channel's members (`Pusher::getPresenceUsers`); if 12 distinct members are online and the requester is not one of them → 403 "This room is full." If Reverb cannot be reached the join is allowed (soft cap, fail open). The room page shows the same message (Open decision 5).
- Guests of a room see nothing of the team, its retros or other rooms.

### Icebreaker room

- One per retro, created by the `EnsureIcebreakerRoom` action the first time the retro enters `Icebreaker` (also lazily from the snapshot), with `game = retros.icebreaker_game`, `locale` = the facilitator's locale at that moment, `turn_seconds = null`.
- Players are the retro's participants (member or guest); a `game_players` row with `participant_id` is created on a participant's first game request. Access follows the retro (`ResolveParticipant`); no player cap.
- Host = the retro facilitator (follows facilitation transfer). The icebreaker room never appears in the team's Games list and cannot be renamed, shared or deleted on its own (it goes with the retro).

## 4. Games

Common rules:

- The host starts each round (`POST /rounds`). Starting a round while one is active → 409. Switching the game (host) ends the active round as `Abandoned` (word revealed) and broadcasts `game.room.changed`.
- Round ends broadcast `game.round.ended` with the word (if any), outcome, winner and leader; every ended round appears in history.
- Minimum players (UI only; the server does not track who is online): Draw & Guess and Decoded show "Waiting for another player" with fewer than 2 online players and disable Start.
- **Guess matching** (Draw & Guess, Decoded): normalize both sides (`Str::ascii`, lowercase, trim, collapse whitespace, drop `-` and `'`); equal → correct. Otherwise Levenshtein distance on the normalized strings: 1 for words of ≤ 4 letters, 1–2 for longer words → near miss.
- **Mask:** guessers receive `mask`: one entry per character of the word; spaces, hyphens and apostrophes are given, letters are `null` unless revealed. Word length is therefore public by design.
- Guesses and letter picks: rate-limited to burst 3 / 1 per second per player (keyed by player id) → 429.

### 4.1 Draw & Guess (2+ players)

- **Start:** host picks the drawer (`leaderPlayerId`); the UI preselects the next online player after the previous drawer in join order ("endless rotation"). The server picks a random word from the drawable pool of the room locale not in `game_used_words` for the team (§4.5).
- **Word visibility:** only the drawer gets the word: in their snapshot and from `GET /rounds/{round}/secret` (403 for anyone else). After `game.round.started`, the drawer's client calls it.
- **Tools:** 6 colours (`black`, `red`, `orange`, `green`, `blue`, `purple`), 3 sizes (4, 10, 24 canvas units), eraser (a stroke in the canvas background colour `white`), fill, undo (last operation), clear (removes all operations, not undoable).
- **Canvas:** logical 1000 × 750 (4:3); coordinates are integers in range; clients scale to their size. Fill is a flood fill computed client-side on an 800 × 600 offscreen raster by replaying operations in order, so every client gets the same image.
- **Operations** (`drawing` jsonb): `{type: "stroke", color, size, points: [[x,y], …]}` (1–1000 points) or `{type: "fill", color, x, y}`. Caps per round: 500 operations and 20 000 points → 422 "The drawing is full. Clear it to keep drawing."
- **Transport** (Open decision 1): while drawing, the drawer whispers `game-stroke` on the room's presence channel `{v: 1, id, color, size, points}` (≤ 100 points per message, 40 ms throttle) so others see the line live. On pointer-up the drawer POSTs the complete stroke (`clientOpId` = whisper `id`); the server validates, appends, and broadcasts `game.drawing.op-added {roundId, op, clientOpId}`; receivers replace the matching live preview with the committed operation. Fill, undo and clear are HTTP only. Receivers drop whispers whose Reverb-stamped sender is not the current drawer's presence id, whose round is not active, or whose fields are out of range. Late joiners and reconnects render from the snapshot's committed operations.
- **Hints:** the drawer reveals one random unrevealed letter per request, up to `floor(letters / 2)` → 422 beyond. Broadcast `game.hint.revealed {mask}`.
- **Guessing:** any player except the drawer (403). Response to the guesser: `{result: "wrong" | "near" | "correct"}`.
  - Wrong: stored; broadcast `game.guess.made {playerId, text}` to others; shown in the chat.
  - Near miss: stored; the guesser's own client shows it with "Very close!"; **not broadcast** (the text is close to the word; Open decision 6).
  - Correct: the round ends as `Guessed` with `winner_player_id`; the guess text is never broadcast or serialized to anyone (history shows who got it and the word).
- **Other ends:** timer expiry → `TimedOut`; drawer or host "Pass" → `Passed`. Each reveals the word.

### 4.2 Sprint in one GIF (1+ players)

- Available only when a GIF provider is configured (`GifCatalog::isAvailable()`) and, in an icebreaker, `retros.gifs_enabled` is on; otherwise it is hidden in the game picker and switching to it → 422.
- **Start:** the server picks a random question of the room locale, avoiding the room's last 20 questions. Until the first answer, the host can shuffle it or type a custom question (≤ 200) → `game.question.changed`; afterwards → 409.
- **Answering:** every player (host included) searches through `GET /games/{room}/gifs?q=` (proxy, same limits and caching as spec 1 §5: 20/min per player, 24 results) and sets one answer, replaceable or removable until reveal. Others receive only `game.answer.changed {playerId, answered: bool}`; gif ids of other players are never sent before reveal (snapshot or broadcast). The answerer's own snapshot includes their answer.
- **Reveal:** host or timer → outcome `Revealed`, broadcast `game.round.ended` with `answers: [{playerId, gif}]`. After reveal answers are read-only; the host starts a new round.
- `GifCatalog::servable()` also accepts ids present in `game_gif_answers`, so revealed answers keep loading after the search cache expires.
- Authors are shown with each revealed GIF, except in the icebreaker of an anonymous retro (Open decision 7).

### 4.3 Hangman (1+ players)

- **Start:** host; random word from the full pool (§4.5); no leader. Everyone sees the mask.
- **Letters:** any player picks a letter `a–z`; no turns. A letter already picked → 409. A hit reveals every position whose folded letter matches (`é` is revealed by `e`); a miss increments `misses`. Broadcast `game.letter.picked {playerId, letter, hit, mask, misses}`.
- **End:** all letters revealed → `Solved`, winner = player who picked the last letter; 6 misses → `Lost`; timer expiry → `TimedOut`; host "Give up" → `Passed`. The word is revealed; the host starts the next word.

### 4.4 Decoded (2+ players)

- **Start / word / hints / guessing / ends:** exactly as Draw & Guess (§4.1), with the clue giver as leader and the full word pool (§4.5).
- **Clue:** the leader edits up to 5 emoji live (`PUT /clue`, debounced 300 ms client-side, rate-limited 5/s) → broadcast `game.clue.changed {clue}`. Each item must pass `SingleEmoji` and must not be letter- or digit-like: keycap sequences, regional-indicator symbols and pairs (flags), `🅰 🅱 🅾 🅿 🆎 🆑–🆚 ℹ️ Ⓜ️ 🔠 🔡 🔢 🔤` → 422 "Use emoji only, without letters or digits."

### 4.5 Words

- Pools per locale: Draw & Guess uses `drawable` words; Hangman and Decoded use all words.
- A new word is drawn uniformly from the pool minus the team's `game_used_words` for that locale and inserted there. When nothing is left, the team's used words for that locale are deleted and the draw repeats (the previous word is excluded for that draw).
- Words are drawn inside the transaction that creates the round, with the room row locked, so two concurrent starts cannot both succeed.

## 5. Timers

- **Standalone rooms:** the host sets or clears `game_rooms.timer_ends_at` (10–7200 s, same control as the board timer). When `turn_seconds` is set, starting a round sets the timer to `now + turn_seconds` automatically (Open decision 2).
- **Icebreaker:** the board timer (`retros.timer_ends_at`, `PUT /retros/{retro}/timer`) is the game timer. If `turn_seconds` is set on the icebreaker room, starting a round sets the board timer and broadcasts the existing `timer.changed`.
- **Expiry closes the round**, server-side: whenever a timer is set while a round is active, or a round starts with a timer running, a `CloseExpiredGameRound(roundId, endsAt)` job is dispatched with a delay until `endsAt`. When it runs it ends the round only if the round is still active and the timer still equals `endsAt` (a changed or cleared timer makes stale jobs no-ops). Every game endpoint and snapshot also applies the same check first, so a late queue never shows a stale round. Outcome: `TimedOut` (Draw & Guess, Decoded, Hangman), `Revealed` (Sprint in one GIF).
- A timer that expires with no active round only plays the existing "time's up" feedback.

## 6. Icebreaker inside a retro

- In `Icebreaker` phase the board area shows the game panel instead of columns; everything else on the board page (presence strip, timer, flying reactions, cursors per spec 1 settings, facilitator controls) stays.
- The facilitator (host) can switch the game at any time, including mid-round (§4 common rules).
- Game events travel on the retro's `presence-retro.{retroId}` channel; the board snapshot gains `icebreaker: GameSnapshot | null` (non-null only in `Icebreaker` phase).
- Game mutations on an icebreaker room: only in `Icebreaker` phase (403 otherwise), not on a `Completed` retro, and 423 while `is_locked` (spec 1 §6). The history endpoints stay readable in every phase.
- Leaving `Icebreaker` ends the active round as `Abandoned` (in the phase-change transaction); coming back resumes with no active round.
- Retro anonymity (`is_anonymous`) covers board content. Games show player names like the presence strip does, except Sprint in one GIF authors on anonymous retros (Open decision 7).
- Deleting the retro deletes its icebreaker room (cascade).

## 7. Endpoints, channels and events

### Channels

- Standalone rooms: presence `presence-game.{roomId}`, authorized in `BroadcastAuthorizationsController` (new branch) by resolving the player (member or guest cookie), with the 12-player cap (§3). Member info `{id: playerId, name, avatarUrl, isGuest}`. Client events are allowed (same Reverb setting as spec 1).
- Icebreaker rooms: the existing `presence-retro.{retroId}` channel.
- No private channel is used: the leader fetches the secret word over HTTP.

### Routes

Board pages and team routes:

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/w/{workspace}/teams/{team}/games` | team viewer | Inertia `games/index` |
| POST | `/w/{workspace}/teams/{team}/games` | team viewer | Create room `{name, game, access}` |
| GET / POST | `/play/{guestToken}` | anyone | Guest join page / join (throttle 10/min) |
| GET | `/games/{room}` | player | Inertia `games/show`; for an icebreaker room redirects to the retro |

Under `/games/{room}/…` (middleware `ResolveGamePlayer`: resolves the player for either kind of room; JSON; controllers follow the one-controller-per-resource convention of `app/Http/Controllers/Retros`):

| Method | Path | Who | Body / response |
|---|---|---|---|
| GET | `snapshot` | player | `GameSnapshot` for the viewer |
| PATCH | `/` | host, creator, Owner/Admin | `{name?, access?, locale?, turnSeconds?}` (standalone; icebreaker: `turnSeconds`, `locale` only) |
| DELETE | `/` | creator, Owner/Admin | 204 (standalone only) |
| POST | `guest-token` | host, creator, Owner/Admin | regenerate link |
| PUT | `host` | host → member player; creator/Owner/Admin → self | `{playerId}` (standalone only) |
| PUT | `game` | host | `{game}` |
| PUT | `timer` | host | `{seconds \| null}` (standalone only) |
| POST | `rounds` | host | `{leaderPlayerId?}` → round payload |
| GET | `rounds` | player | last 20 ended rounds |
| GET | `rounds/{round}` | player | ended round with drawing, clue, answers; 404 while active |
| GET | `rounds/{round}/secret` | leader | `{word}`; 403 others |
| POST | `rounds/{round}/pass` | leader or host | ends round |
| POST | `rounds/{round}/hints` | leader | `{mask}` |
| POST | `rounds/{round}/drawing-ops` | drawer | `{clientOpId, op}`; rate 20/s |
| DELETE | `rounds/{round}/drawing-ops/last` | drawer | undo |
| DELETE | `rounds/{round}/drawing` | drawer | clear |
| PUT | `rounds/{round}/clue` | clue giver | `{clue: string[]}` |
| POST | `rounds/{round}/guesses` | non-leader player | `{text}` → `{result}` |
| POST | `rounds/{round}/letters` | player | `{letter}` |
| PUT | `rounds/{round}/question` | host | `{text?}` (absent = shuffle) |
| PUT / DELETE | `rounds/{round}/answer` | player | `{gifId}` |
| POST | `rounds/{round}/reveal` | host | ends GIF round |
| GET | `gifs?q=` | player | GIF search proxy |

Round-scoped mutations on a round that is not the room's active round, or on the wrong game kind → 409 "This round is over." / 422.

### Snapshot (`GameSnapshot`, built for the viewer by one `BuildGameSnapshot` class; all game redaction lives there and in its presenters)

- `room`: `{id, name, game, locale, access, turnSeconds, timerEndsAt, isHost, canManage, hostPlayerId, guestUrl}` (`guestUrl` only for managers of a `link` room; never the token alone in broadcasts).
- `players`: `[{id, presenceId, name, avatarUrl, isGuest}]`.
- `round`: null or `{id, game, leaderPlayerId, startedAt, mask?, misses?, pickedLetters?, clue?, question?, drawing?, guesses?, answers?, myAnswer?, word?}` where:
  - `word` only for the leader of an active Draw & Guess / Decoded round;
  - `guesses`: last 50 of the round, wrong guesses of everyone plus the viewer's own near misses; never correct guesses;
  - `answers`: before reveal `[{playerId, answered: true}]`; `myAnswer` only the viewer's gif.
- `history`: last 20 ended rounds `{id, game, outcome, word, question, leaderName, winnerName, endedAt}`.
- Constant query count as players, rounds and guesses grow.

### Broadcast events

Base class `GameBroadcastEvent` (same pattern as `RetroBroadcastEvent`: after commit, `toOthers()`, report-don't-throw); `broadcastOn()` returns the retro channel for icebreaker rooms and `presence-game.{roomId}` otherwise.

`game.room.changed` (settings, host, game switch → clients refetch the game snapshot), `game.room.deleted`, `game.timer.changed {timerEndsAt}`, `game.round.started {round}` (public payload, never the word), `game.round.ended {roundId, outcome, word, winnerPlayerId, leaderPlayerId, answers?}`, `game.hint.revealed {roundId, mask}`, `game.drawing.op-added {roundId, op, clientOpId}`, `game.drawing.undone {roundId}`, `game.drawing.cleared {roundId}`, `game.clue.changed {roundId, clue}`, `game.guess.made {roundId, playerId, text}` (wrong guesses only), `game.letter.picked {…}`, `game.question.changed {roundId, question}`, `game.answer.changed {roundId, playerId, answered}`.

Client events (whispers): `game-stroke` only (§4.1).

## 8. Secrecy and anti-cheat

- The secret word leaves the server only: to the leader (snapshot, `secret` endpoint) during the round, and to everyone in `game.round.ended`, history and round detail after it ends. It is `$hidden` on the model; tests assert its absence from every other payload.
- Hangman and hint state goes out as a mask only.
- Correct guess texts are never serialized. Near-miss texts reach only their author.
- GIF answers of others are never serialized before reveal; the round detail endpoint 404s while a round is active.
- The drawer cannot guess (403); the leader is fixed for the round (host cannot move the drawer mid-round, only pass).
- Stroke whispers are accepted only from the current drawer (Reverb-stamped sender, spec 1 §3); the committed drawing is written only by the drawer through HTTP.
- Rate limits: guesses/letters (§4), drawing ops 20/s, clue 5/s, GIF search 20/min, guest join 10/min.
- Accepted limitation: a drawer can still write the word on the canvas or tell it out loud; that is social, not technical.

## 9. UI

- **Team page:** new "Games" tab: room cards (§3), "New room" dialog (name, first game, access). Guests never see it.
- **Room page (`games/show`)** and **icebreaker panel** share `resources/js/components/games/*`:
  - Header: room name, game switcher (host), timer control (host), share link (managers of `link` rooms), history button.
  - Draw & Guess: canvas left (toolbar for the drawer: 6 colour dots, 3 sizes, eraser, fill, undo, clear, "Reveal a letter", "Pass"); right: player list with a check on the winner, chat of guesses with input (disabled for the drawer). The drawer sees the word above the canvas; others see the mask as `_ _ _`.
  - Sprint in one GIF: question banner (host: shuffle / edit until first answer), GIF search popover (with provider attribution), grid of answer tiles showing "answered" placeholders until reveal, then GIFs with author.
  - Hangman: mask, on-screen `A–Z` keyboard with picked letters greyed, 6-step miss drawing, last picker names.
  - Decoded: clue row (leader: emoji picker from spec 1 limited to 5 slots), mask, guess chat as Draw & Guess.
  - Round end card: word, outcome, winner; host "Next round" (preselects next leader).
  - History drawer: last 20 rounds; opening a Draw & Guess round replays its drawing read-only.
- **Retro:** the create dialog / settings gain the icebreaker game selector next to spec 2's Icebreaker toggle (GIF option hidden without a provider).
- **Guest join page** `games/join` like `retros/join`.
- Every new string in `lang/{en,fr,es,de}.json`.

## 10. Error handling

- Rejected mutation (403/409/422/423) → optimistic change rolled back + translated toast; 409 on a round → refetch game snapshot.
- 429 → "Slow down a little."; GIF 502 → "GIF search is unavailable."
- Room deleted while open → `game.room.deleted` or 404 → "This room was deleted." with a link back to the team (members) or a closed page (guests).
- Full room → "This room is full." page with a retry button.
- Websocket reconnect → refetch game snapshot (drawing re-rendered from committed ops).

## 11. Testing

Pest feature tests under `tests/Feature/Games/*`; provider HTTP faked with `Http::fake()`, broadcasts with `Event::fake()`, the queue with `Queue::fake()` / `travelTo()`.

- **Rooms:** create by team member; 11th room → 422; icebreaker rooms not counted; list scoped to team; guest cannot list; settings and delete permissions (creator, Owner/Admin, host); host transfer to member only; "Become host".
- **Access:** `team` room refuses guests; `link` room guest join, resume by cookie, token regeneration revokes; switching to `team` blocks guests; non-member logged-in joins as guest without team access.
- **Player cap:** channel auth refuses a 13th member when Reverb reports 12 (Pusher client mocked), allows a present member to reconnect, allows when Reverb errors.
- **Secrecy (main invariant):** for each game, the word is absent from non-leaders' snapshots, every broadcast before `game.round.ended`, `rounds` history of active rounds and `rounds/{round}` (404 while active); `secret` 403 for non-leaders; correct guess text absent everywhere; near-miss text only in its author's response and snapshot; GIF ids of others absent before reveal.
- **Draw & Guess:** drawer-only ops, undo, clear; point/op caps 422; coordinate/colour/size validation; hints up to half the letters; guess results wrong/near/correct with normalization (case, accents, spaces); correct guess ends the round with the winner; drawer guess 403; pass by drawer or host; rate limit 429.
- **Sprint in one GIF:** hidden without provider / with `gifs_enabled` off in an icebreaker; question shuffle/custom until first answer then 409; one answer per player, replace/remove until reveal; reveal by host; proxy serves revealed answer ids.
- **Hangman:** hit/miss, accent folding, duplicate letter 409, solved credits the last picker, 6 misses → lost.
- **Decoded:** clue ≤ 5, `SingleEmoji`, rejects keycaps, flags, letter-like emoji and text.
- **Words:** no repeat per team+locale until pool exhausted, then reset; drawable filter for Draw & Guess; dictionary files meet §2 constraints (sizes, allowed characters, all four locales).
- **Timers:** job ends the active round at expiry with the right outcome; stale job no-op after timer change; lazy expiry on the next request; `turn_seconds` auto-start; icebreaker uses the board timer and `timer.changed`.
- **Icebreaker:** room created on entering the phase; host = facilitator (follows transfer); mutations 403 outside the phase, 423 when locked; leaving the phase abandons the round; events on the retro channel; retro deletion cascades; anonymous retro hides GIF authors.
- **Retention:** 21st ended round prunes the oldest with its guesses and answers.
- **Snapshot:** constant query count.
- **Manual two-browser walkthrough** (desktop + phone): live strokes appear while drawing and match after pointer-up; fill identical on both; late joiner sees the drawing; near miss shown only to its author; correct guess ends the turn without showing the text; GIF answers hidden then revealed by the timer; Hangman with accents; Decoded rejects `1️⃣`; icebreaker switches game mid-round; room link guest join; 13th browser refused.

## 12. Acceptance criteria

1. Team members can create up to 10 standalone rooms per team, with team-only or link access; guests join link rooms only, as for retros; deleting a room removes its players and rounds.
2. A standalone room admits at most 12 online players (soft cap, fail open when Reverb is unreachable).
3. Draw & Guess, Sprint in one GIF, Hangman and Decoded follow §4, with one shared engine for rooms and icebreakers.
4. No snapshot, response or broadcast gives a secret word to anyone but the leader before the round ends; correct guess texts are never exposed; near misses reach only their author; GIF answers stay hidden until reveal (§8).
5. Live strokes travel as presence whispers accepted only from the current drawer; committed operations are server-validated, persisted, and rebuild the drawing for late joiners and history.
6. Words come from per-locale dictionaries (en/fr/es/de), exclude undrawable words from Draw & Guess, and never repeat within a team and locale until the pool is exhausted.
7. Timer expiry ends the active round server-side (job + lazy check), in rooms and with the board timer in the icebreaker.
8. In the retro `Icebreaker` phase (spec 2), the facilitator hosts the game, can switch it at any time, and leaving the phase abandons the active round.
9. Each room keeps its last 20 ended rounds, reopenable with their drawing, clue or answers.
10. GIFs are only fetched through skrum's proxy; the GIF game is unavailable without a provider.
11. All new strings are translated in en/fr/es/de; suite, phpstan, type-check and lint are green; the walkthrough passes.

## Open decisions

1. **Stroke transport.** (a) Hybrid: live whispers + HTTP-committed strokes *(recommended: live feel with no server load per point, verified sender, persisted drawing for late joiners and history)*; (b) HTTP only, server broadcasts every batch (simplest trust model, but ~25 requests/s per drawer through Octane and visible lag); (c) whispers only, drawer uploads the final drawing (lightest, but late joiners see a blank canvas and history depends on the drawer's client).
2. **Turn timer.** (a) Optional `turn_seconds` auto-starting the timer each round, default 90 s for rooms and off for icebreakers *(recommended: rooms run without a host clicking the timer every turn)*; (b) manual host timer only (strict QRetro parity, less setting surface); (c) fixed per-game durations (no setting, less flexible).
3. **Word history scope.** (a) Per team and locale *(recommended: consecutive retros of a team do not replay the same words)*; (b) per room (simpler, but every new icebreaker starts fresh and repeats); (c) none, random with replacement (simplest, repeats noticeable with ~150 drawable words).
4. **Who creates rooms.** (a) Any team member, delete by creator or workspace Owner/Admin *(recommended: matches who can create retros)*; (b) workspace Owner/Admin only (closer to QRetro's owner/admin/facilitator, but skrum has no team-level roles).
5. **Player cap enforcement.** (a) Count presence members through Reverb's HTTP API at channel auth, fail open *(recommended: counts who is actually online)*; (b) count players who made a request in the last N minutes (no Reverb call, approximate); (c) no cap (simplest; 12 is only a UI/perf guideline).
6. **Near-miss visibility.** (a) Shown only to the guesser, not broadcast *(recommended: a near-miss text almost gives the word away)*; (b) shown to everyone in the chat, flagged only for the guesser (possibly closer to QRetro's chat, leaks hints).
7. **Anonymous retros in the icebreaker.** (a) Names shown in games except Sprint in one GIF authors *(recommended: presence already shows who is there; GIF answers are opinions, closer to card content)*; (b) all game names shown; (c) every player shown as "Participant" with a colour (hard to play Draw & Guess turns).
8. **Guest names in rooms.** (a) Guest types a display name, prefilled with a random "Adjective Animal" *(recommended: retro join parity plus QRetro's quick start)*; (b) random name assigned, renameable later (QRetro parity, extra rename endpoint); (c) empty display name field as for retros.
