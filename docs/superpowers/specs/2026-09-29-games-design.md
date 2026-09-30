# Skrum — Games — Design

Date: 2026-09-29
Status: Approved decisions, awaiting spec review
Parent spec: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md` (all its rules apply unless this spec changes them explicitly). Builds on `docs/superpowers/specs/2026-09-29-board-engagement-design.md` (whispers with verified senders, GIF proxy, `SingleEmoji`, board lock) and on spec 2 "Retro flow extras" (Icebreaker phase, see §1 Dependencies).
Research: `docs/superpowers/research/qretro/` (QRetro parity roadmap, spec 7 of 8; `docs-inventory.md` "Games", `screens/game-*.{jpg,svg}`)

## 1. Intent

Give teams four short real-time games, playable in standalone game rooms or as the icebreaker of a retro: **Draw & Guess**, **Sprint in one GIF**, **Hangman** and **Decoded**. The server is the only authority on secrets: a word or a GIF answer never reaches a client that should not see it yet.

**Success:** every rule below is covered by a feature test or a step of the two-browser walkthrough; no endpoint, snapshot or broadcast delivers a secret word to a non-leader or a GIF answer before reveal; test suite, phpstan, type-check and lint stay green; no new dependency.

### In scope

- Game rooms per team: create, list, rename, delete; team-only or open by link; at most 12 players online and 10 rooms per team; last 20 rounds kept.
- The four games with QRetro's rules (§4), one engine shared by rooms and the retro icebreaker.
- Icebreaker: how a game runs inside the Icebreaker phase and how the board timer ends turns (§6).
- Word dictionaries and GIF questions in en/fr/es/de, no repeated word until the pool is exhausted.
- Drawing transport (live whispers + server-committed operations) and drawing persistence for round history.
- Scores per game, a leaderboard per room and per team, and weekly play streaks for members; guests score per room only (§4.6, §4.7).
- The "Games we played" read model consumed by spec 2's Results view (§6.1).
- Room invites to every share channel: Slack and Telegram (spec 6) plus Microsoft Teams, Mattermost and generic webhooks (spec 8), through the link sharing of spec 6 §5.1 (§3.1).

### Out of scope (deferred)

- Personal (non-team) game rooms.
- GIF uploads (skrum has no uploads; GIFs come from search only, for everyone).
- Cross-team or workspace-wide leaderboards, badges/achievements, per-room win streaks (§4.7 defines the only streak).
- Room invites by email; invites for icebreaker rooms (the retro's own link share, spec 6 §5.1, covers them).
- Games in spec 6's Slack/Telegram results recap and results email (the recap keeps spec 6 §5.2's content).
- LLM-generated words or questions: lists are deterministic files.
- A frontend test runner or browser E2E suite.

### Dependencies

- **Spec 2 (retro flow extras):** `RetroPhase::Icebreaker` (`icebreaker`) sits after the optional `HealthCheck` and before `Writing`; it is in the flow only when `retros.icebreaker_enabled` is on (default off, set at creation and through `PATCH /retros/{retro}/settings`), and the facilitator moves to it like any phase (`Retro::canMoveTo` over the enabled phases). `RetroPhase::isOpen()` includes it (timer), and others' cards stay hidden in it. Spec 2 stores no game choice, so this spec adds `retros.icebreaker_game` (§2), and its game panel replaces spec 2's "Warm-up" placeholder (spec 2 §2.5).
- Spec 1: `whisperTransport` — imported from its board-agnostic location `resources/js/lib/realtime/whisper-transport.ts`, where spec 4 moves it from spec 1's `resources/js/lib/retro/whisper-transport.ts` (spec 4 §4) — and Reverb `accept_client_events_from: 'members'` (`config/reverb.php`), `GifCatalog` / `GifsController` / `RetroGifsController`, `SingleEmoji` (`app/Rules/SingleEmoji.php`), `RetroGuard::unlocked`.
- Existing infrastructure: the database queue worker (s6 service) runs the delayed job that ends a round when the host timer expires; `BroadcastAuthorizationsController` authorizes presence channels.
- **Spec 2 (Results view):** renders the `results.games` section defined in §6.1 (see §11).
- **Spec 6 (integrations):** room invites reuse its share-channel connections, `integration_deliveries`, delivery jobs, message escaping and permissions model (spec 6 §3, §5.1, §5.4, §5.5); the additions it needs are listed in §11. Without spec 6, or with no active share-channel integration for the team (Slack, Telegram and, once spec 8 is built, Teams, Mattermost or a generic webhook), the invite controls are absent and everything else in this spec works.
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
| `timer_ends_at` | nullable timestamp | Host-set room timer (manual, §5); icebreakers use `retros.timer_ends_at` |
| `current_round_id` | nullable FK game_rounds, null on delete | Active or last round |
| `scores_reset_at` | nullable timestamp | Standalone only: the room leaderboard counts points awarded after it (§4.7); never affects the team leaderboard |
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
| `picked_by` | jsonb string[] default `[]` | Hangman: player id of each pick, aligned with `picked_letters` (scoring, §4.6); never serialized, the pickers are already public through `game.letter.picked` |
| `misses` | smallint default 0 | Hangman |
| `clue` | jsonb string[] default `[]` | Decoded emoji (≤ 5) |
| `question` | nullable string (≤ 200) | Sprint in one GIF |
| `drawing` | jsonb default `[]` | Committed drawing operations (§4.1) |
| `drawing_points` | int default 0 | Running point count, for the cap |
| `winner_player_id` | nullable FK game_players, null on delete | Correct guesser / letter that solved Hangman |
| `revealed_at` | nullable timestamp | Sprint in one GIF: set at reveal, which opens the voting window; the round stays active until it is closed (§4.2) |
| `outcome` | nullable `GameRoundOutcome` | Set when ended |
| `started_at`, `ended_at` | timestamps | |

- Retention: after a round is created, ended rounds of the room beyond the newest 20 **ended** rounds are deleted (with their guesses, answers and votes), so a room holds at most 20 ended rounds plus its active one; their `game_points` rows stay with `game_round_id = null`.

### `game_guesses` — new table

- `id`, `game_round_id` (cascade), `player_id` (FK game_players, cascade), `text` (1–50), `is_near_miss` (bool; "very close" flag, delivered only to the guesser), `is_correct` (bool), `created_at`.

### `game_gif_answers` — new table

- `id`, `game_round_id` (cascade), `player_id` (cascade), `gif_id` (string ≤ 64), timestamps; unique (`game_round_id`, `player_id`).
- `id` is a **random UUID v4** (`GameGifAnswer::newUniqueId()`), not Laravel's time-ordered v7: `game.answer.changed` tells everyone when each player answered, so a time-ordered id would re-identify authors on anonymous retros. Revealed answers are listed in id order (random, stable).

### `game_gif_votes` — new table

- `id`, `game_round_id` (cascade), `voter_player_id` (FK game_players, cascade), `answer_id` (FK game_gif_answers, cascade), timestamps; unique (`game_round_id`, `voter_player_id`) (one vote per player per round). The voter cannot be the answer's author (checked on write).

### `game_points` — new table

One row per player who took part in a scored round (§4.6), written when the round ends. Rows outlive round retention so leaderboards keep their history.

| Column | Type | Meaning |
|---|---|---|
| `id` | UUID | |
| `team_id` | FK teams, cascade | Team of the room (icebreaker: the retro's team) |
| `game_room_id` | FK game_rooms, cascade | Deleting a room (or its retro) deletes its points |
| `game_round_id` | nullable FK game_rounds, **null on delete** | Kept after the round is pruned (§2 retention) |
| `player_id` | FK game_players, cascade | |
| `user_id` | nullable FK users, null on delete | Copied at award time: the player's `user_id`, or for an icebreaker player the participant's `user_id`; null for guests. Only rows with a user reach the team leaderboard |
| `game` | `GameKind` | |
| `points` | smallint, ≥ 0 | 0 = took part without scoring (counts as a round played and for streaks) |
| `is_win` | bool | Correct guesser (Draw & Guess, Decoded) or solver (Hangman) |
| `created_at` | timestamp | Award time |

- Unique (`game_round_id`, `player_id`) while `game_round_id` is not null. Indexes (`game_room_id`, `created_at`), (`team_id`, `user_id`, `created_at`).

### `game_used_words` — new table

- `team_id` (cascade), `locale`, `word`, `created_at`; primary key (`team_id`, `locale`, `word`). Word history is per team, shared by the team's rooms and icebreakers (Decision 3).

### `retros` — new column

- `icebreaker_game` (`GameKind`, default `draw`): game the icebreaker room starts with, chosen next to spec 2's Icebreaker toggle in the create dialog (`POST /w/{workspace}/teams/{team}/retros`) and the settings dialog (`PATCH /retros/{retro}/settings`, facilitator only, any phase except `Completed`, broadcasting `settings.changed`); `gif` is refused (422) when no GIF provider is configured.

### Word and question files

- `resources/games/words/{en,fr,es,de}.php` returns a list of `['word' => string, 'drawable' => bool]`, theme: work, software, teams and agile plus everyday objects. Each locale has ≥ 250 words, ≥ 150 of them drawable. Words are 3–24 characters, letters plus at most single spaces, hyphens or apostrophes between letters, and every letter folds to `a–z` through `Str::ascii()` (no `ß`, `æ`, `œ`).
- `resources/games/gif-questions/{en,fr,es,de}.php` returns a list of ≥ 60 questions (≤ 200 characters), e.g. "How did the last deploy feel?".
- A `GameWordBook` class reads them (immutable data, safe to memoize under Octane).

## 3. Rooms, players and access

### Standalone rooms

- **List/create** on the team page, tab "Games" (`GET /w/{workspace}/teams/{team}/games`). Any team member (and workspace Owner/Admin, per `TeamPolicy::view`) can create a room and see the team's rooms (Decision 4). A team holds at most 10 rooms (icebreaker rooms do not count) → 422 "This team already has 10 game rooms." A room is created with an available game only (422 "This game is not available." otherwise); the `draw` column default stays for rows created without a game.
- Room card: name, game, access mode, number of players who ever joined, number of rounds kept.
- **Settings** (host, creator, or workspace Owner/Admin): name, access, locale, regenerate the guest link. **Delete** (creator or workspace Owner/Admin) removes the room, players and rounds, and broadcasts `game.room.deleted`.
- **Host:** the creator on creation. The host can hand hosting to any other member player (guests never host). The creator and workspace Owners/Admins can take hosting at any time ("Become host"), so a room never stays stuck with an absent host.
- A room opens directly on its current state; if no round is active, the host sees "Start".

### Joining

- `team` access: team members (per `TeamPolicy::view`) only. A player row is created on first visit.
- `link` access: also `/play/{guestToken}`. Same rules as retro guests (core spec §3): a visitor enters a display name (prefilled with a random "Adjective Animal" name in their locale, editable; Decision 8; lists in `resources/games/guest-names/{locale}.php`, with grammatical gender in fr/es/de, e.g. "Loutre joyeuse", "Fröhlicher Otter"), gets a player with a hashed secret and an encrypted cookie `game_guest_{roomId}`; a returning guest resumes; a logged-in team member joins as themselves; a logged-in non-member joins as a guest without team access. Regenerating the token revokes the link and clears existing guest secrets. Switching access to `team` blocks every guest request (403).
- **12-player cap:** enforced when authorizing `presence-game.{roomId}`: the server asks Reverb for the channel's members (`Pusher::getPresenceUsers`); if 12 distinct members are online and the requester is not one of them → 403 "This room is full." If Reverb cannot be reached the join is allowed (soft cap, fail open). The room page shows the same message (Decision 5).
- Guests of a room see nothing of the team, its retros or other rooms.

### Icebreaker room

- One per retro, created by the `EnsureIcebreakerRoom` action the first time the retro enters `Icebreaker` (also lazily from the snapshot), with `game = retros.icebreaker_game`, `locale` = the facilitator's locale at that moment, and a player row for the facilitator, so every viewer's snapshot names the host (`room.hostPlayerId`) from the first load.
- Changing `retros.icebreaker_game` after the room exists does not switch the room's game: the setting is the game the room starts with; afterwards the facilitator switches from the panel's game switcher.
- Players are the retro's participants (member or guest); a `game_players` row with `participant_id` is created on a participant's first game request. Access follows the retro (`ResolveParticipant`); no player cap.
- Host = the retro facilitator (follows facilitation transfer). The icebreaker room never appears in the team's Games list and cannot be renamed, shared or deleted on its own (it goes with the retro).

### 3.1 Invites through every share channel (standalone rooms)

Room invites are spec 6 link shares (spec 6 §5.1) with a room as subject. Icebreaker rooms have no invite of their own: the retro's link share brings people to the board, where the icebreaker runs.

- **Channels:** `slack`, `telegram` (spec 6) and `msteams`, `mattermost`, `webhook` (spec 8 §4.6); each channel is offered independently. Spec 8's channels exist only once spec 8 is built; until then the endpoint accepts `slack|telegram`.
- **Available** per channel when the provider is enabled and the room's team has an `Active` integration of that provider (spec 6 §2.2, spec 8 §2.2); otherwise the controls are absent and the endpoint returns 404 (provider disabled), 409 "Connect :provider in the team settings." (not connected) or 409 "Reconnect :provider in the team settings." (reconnect required) — the same answers as spec 6's retro and poker shares (spec 6 §13).
- **Who may send** (scope decision 5): room managers who are team members — the host, the creator (while still a team member) and workspace Owners/Admins (same rule as spec 6 decision 7 for retros). Guests are refused (403), as on every integration endpoint.
- **Message** (built once at dispatch in the sharer's locale, escaped per spec 6 §5.4): "{sharer} invites you to play {game} in "{room}" ({team})" with one button/link "Join the game". Link: `/games/{room}` (team members sign in) or, when the sharer ticks "Include the guest link (anyone who can see the message can join)", `/play/{guestToken}`.
- **Guest-link requirement** (scope decision 4): the guest-link option exists only when the room's `access` is `link`; it is off by default; `includeGuestLink: true` on a `team` room → 422 "Guest access is off for this room." A `team` room invite therefore only works for team members, and the dialog says so ("Only members of :team can join.", from the snapshot's `room.teamName`). Regenerating the guest link or switching to `team` revokes links already posted (§3), and the dialog says "Posted guest links stop working if you regenerate the link."
- **Never sent:** player names, the current game state, words, questions, drawings, GIFs, scores, the guest token unless opted in.
- **Delivery:** `integration_deliveries` row with `kind = game_room_link`, `subject` = the `GameRoom` (a `deleting` hook on `GameRoom` removes its rows), queued `DeliverToSlack` / `DeliverToTelegram` / `DeliverToMicrosoftTeams` / `DeliverToMattermost` / `DeliverToWebhook` exactly as spec 6 §5.5 (retries, failure states, `throttle:5,1` per user). When the job finishes it broadcasts `game.room.changed` so the sharer's snapshot refreshes the delivery line.

## 4. Games

Common rules:

- The host starts each round (`POST /rounds`). Starting a round while one is active → 409. Switching the game (host) ends the active round as `Abandoned` (word revealed) and broadcasts `game.room.changed`.
- Round ends broadcast `game.round.ended` with the word (if any), outcome, winner and leader; every ended round appears in history.
- The round's leader and the host see a "Pass" button (Draw & Guess, Decoded) or "Give up" (Hangman), backed by `POST rounds/{round}/pass`.
- Minimum players (UI only; the server does not track who is online): Draw & Guess and Decoded show "Waiting for another player" with fewer than 2 online players and disable Start.
- **Guess matching** (Draw & Guess, Decoded): normalize both sides (`Str::ascii`, lowercase, trim, collapse whitespace, drop `-` and `'`); equal → correct. Otherwise Levenshtein distance on the normalized strings: 1 for words of ≤ 4 letters, 1–2 for longer words → near miss.
- **Mask:** guessers receive `mask`: one entry per character of the word; spaces, hyphens and apostrophes are given, letters are `null` unless revealed. Word length is therefore public by design.
- Guesses and letter picks: rate-limited to burst 3 / 1 per second per player (keyed by player id) → 429.

### 4.1 Draw & Guess (2+ players)

- **Start:** host picks the drawer (`leaderPlayerId`, required for Draw & Guess and Decoded: 422 "Choose who leads this round."); the UI preselects the next online player after the previous drawer in join order ("endless rotation"; a UI rule, since the server does not track who is online). The server picks a random word from the drawable pool of the room locale not in `game_used_words` for the team (§4.5).
- **Word visibility:** only the drawer gets the word: in their snapshot and from `GET /rounds/{round}/secret` (403 for anyone else; 409 "This round is over." for the leader once the round ended, the word then being in `game.round.ended`). After `game.round.started`, the drawer's client calls it.
- **Round payload** (Draw & Guess and Decoded, active): `{mask, maxHints, guesses, word?}` plus `drawing` (Draw & Guess) or `clue` (Decoded); `maxHints = floor(letters / 2)`, separators not counted. Ended-round detail: `{mask (full), drawing | clue}`, with no guesses of any kind.
- **Tools:** 6 colours (`black`, `red`, `orange`, `green`, `blue`, `purple`), 3 sizes (4, 10, 24 canvas units), eraser (a stroke in the canvas background colour `white`, which is also an accepted operation colour for strokes and fills), fill, undo (last operation; on an empty drawing a no-op without broadcast, responding `{roundId, count: 0}`), clear (removes all operations, not undoable). Undo and clear share the drawing rate limit (20/s).
- **Canvas:** logical 1000 × 750 (4:3); coordinates are integers in 0–1000 × 0–750 inclusive; clients scale to their size. Fill is a flood fill computed client-side on an 800 × 600 offscreen raster by replaying operations in order, so every client gets the same image.
- **Operations** (`drawing` jsonb): `{type: "stroke", color, size, points: [[x,y], …]}` (1–1000 points) or `{type: "fill", color, x, y}`. Caps per round: 500 operations and 20 000 points → 422 "The drawing is full. Clear it to keep drawing."
- **Transport** (Decision 1): while drawing, the drawer whispers `game-stroke` on the room's presence channel `{v: 1, id, color, size, points}` (≤ 100 points per message, 40 ms throttle) so others see the line live. A longer stroke travels as several messages with the same `id`, each starting with the previous message's last point; the `id` starts with the first 8 characters of the round id, so receivers drop strokes of any other round; the drawer commits a stroke automatically at 400 points and continues with a new one, so every committed-stroke broadcast stays well under the 10 KB event limit of Reverb and Pusher (the server still accepts 1–1 000 points per stroke). On pointer-up the drawer POSTs the complete stroke (body `{client_op_id, op}`, `client_op_id` = whisper `id`, matching `[A-Za-z0-9_-]{1,64}`; response 201 `{roundId, op, clientOpId, count}`); the server validates, appends, and broadcasts `game.drawing.op-added {roundId, op, clientOpId, count}`; receivers replace the matching live preview with the committed operation. `count` is the number of operations after the change; undo and clear respond 200 `{roundId, count}` and broadcast it too. Clients, the drawer's own responses included, apply an addition only when their drawing has `count − 1` operations and an undo only when it has `count + 1`, ignore it when it already has `count`, and refetch the snapshot otherwise; a clear always applies. This keeps events replayed after a refetch from duplicating or removing operations. Fill, undo and clear are HTTP only. Receivers drop whispers whose Reverb-stamped sender is not the current drawer's presence id, whose round is not active, or whose fields are out of range. Late joiners and reconnects render from the snapshot's committed operations.
- **Hints:** the drawer reveals one random unrevealed position per request (one position, not every occurrence of its letter, never a separator), up to `floor(letters / 2)` → 422 beyond. Broadcast `game.hint.revealed {mask}`.
- **Guessing:** any player except the drawer (403). Response to the guesser: `{result: "wrong" | "near" | "correct", guessId, ended}`, where `ended` is the `game.round.ended` payload on a correct guess (the guesser is skipped by `toOthers()`), else `null`.
  - Wrong: stored; broadcast `game.guess.made {guessId, playerId, text}` to others; shown in the chat.
  - Near miss (Decision 6): stored; the text is broadcast like any wrong guess (`game.guess.made`, no flag) and shown to everyone in the chat. Only the guesser learns it was close: the response `{result: "near", guessId}` (and their own snapshot entries) carry the "Very close!" flag; the broadcast and other players' snapshots never do. Accepted trade-off: the near-miss text leaks a hint to everyone.
  - Correct: the round ends as `Guessed` with `winner_player_id`; the guess text is never broadcast or serialized to anyone (history shows who got it and the word).
- **Other ends:** the host timer reaching zero → `TimedOut`; drawer or host "Pass" → `Passed`. Each reveals the word.

### 4.2 Sprint in one GIF (1+ players)

- Available only when a GIF provider is configured (`GifCatalog::isAvailable()`) and, in an icebreaker, `retros.gifs_enabled` is on; otherwise it is hidden in the game picker and switching to it → 422.
- **Start:** the server picks a random question of the room locale, avoiding the room's last 20 questions. Until the first answer, the host can shuffle it or type a custom question (≤ 200) → `game.question.changed`; afterwards → 409.
- **Answering:** every player (host included) searches through `GET /games/{room}/gifs?q=` (proxy, same limits and caching as spec 1 §5: 20/min per player, 24 results; 404 without a GIF provider, 403 "GIFs are turned off for this board." when the game is unavailable for the room, and the icebreaker phase rule of §6) and sets one answer, replaceable or removable until reveal. A GIF object is `{id, previewUrl, url}` (proxied URLs, as card GIFs); the round payload carries `gifProvider` (`giphy` | `tenor` | `null`) for the attribution line. `myAnswer` is `{id, gif}` before and after the reveal. A replacing `PUT answer` or `PUT vote` does not broadcast again. Others receive only `game.answer.changed {playerId, answered: bool}`; gif ids of other players are never sent before reveal (snapshot or broadcast). The answerer's own snapshot includes their answer.
- **Reveal:** host (`POST /reveal`) or timer sets `revealed_at`, which opens the **voting window**; the round stays active. Broadcast `game.round.revealed {roundId, revealedAt, answers: [{id, gif, playerId | null}]}` (`playerId` null in the icebreaker of an anonymous retro, Decision 7). After reveal answers are read-only.
- **Voting** (scope decision 1): during the window every player (guests included) can vote for one favourite GIF, not their own (403 "You cannot vote for your own GIF."); players who did not answer can vote too. A vote is replaceable or removable until the round closes. Before the reveal → 409 "Voting has not started."; after close → 409. One vote per player per round (unique key). Votes are hidden until the round closes: others receive only `game.vote.changed {roundId, playerId, voted: bool}`; who voted for what, and vote counts, are sent to nobody, the voter's own choice excepted (`myVote` in their snapshot).
- **Close:** the host (`POST /close`, "Finish round"), the timer (§5), or the host starting the next round (`POST /rounds` on a GIF round in its voting window closes it first, the only exception to the 409 rule) ends the round as `Revealed`, awards points (§4.6) and broadcasts `game.round.ended` with `question` and `answers: [{id, gif, playerId | null, votes}]`. `votes` (ended payloads, round detail, history) is the final count for `Revealed` rounds and `null` for rounds that ended otherwise (`Passed` through the generic pass endpoint, `Abandoned`): their votes are discarded, they award no points and write no `game_points` rows.
- **Responses:** `PUT question` → `{question}`; `PUT answer` → `{myAnswer}`; `DELETE answer`, `PUT vote`, `DELETE vote` → 204; `POST reveal` → the round as the host sees it (`GameSnapshot.round` shape); `POST close` → `{ended}`. A round the host abandons during voting (game switch, leaving the icebreaker) scores nothing and its votes are discarded with it.
- `GifCatalog::servable()` also accepts ids present in `game_gif_answers`, so revealed answers keep loading after the search cache expires.
- Authors are shown with each revealed GIF, except in the icebreaker of an anonymous retro (Decision 7): votes are then cast on anonymous tiles, addressed by `answerId`, and never award points (§4.6, §4.7).

### 4.3 Hangman (1+ players)

- **Start:** host; random word from the full pool (§4.5); no leader. Everyone sees the mask.
- **Letters:** any player picks a letter `a–z`; no turns. A letter already picked → 409. A hit reveals every position whose folded letter matches (`é` is revealed by `e`); a miss increments `misses`; the picker's id is appended to `picked_by`. Round payload: `{mask, misses, maxMisses, pickedLetters}` (`picked_by` is never serialized). Broadcast `game.letter.picked {playerId, letter, hit, mask, misses}`.
- **End:** all letters revealed → `Solved`, winner = player who picked the last letter; 6 misses → `Lost`; host timer reaching zero → `TimedOut`; host "Give up" → `Passed`. The word is revealed; the host starts the next word.

### 4.4 Decoded (2+ players)

- **Start / word / hints / guessing / ends:** exactly as Draw & Guess (§4.1), with the clue giver as leader and the full word pool (§4.5).
- **Clue:** the leader edits up to 5 emoji live (`PUT /clue`, debounced 300 ms client-side, rate-limited 5/s) → broadcast `game.clue.changed {clue}`. Each item must pass `SingleEmoji` and must not be letter- or digit-like: keycap sequences, regional-indicator symbols and pairs (flags), `🅰 🅱 🅾 🅿 🆎 🆑–🆚 ℹ️ Ⓜ️ 🔠 🔡 🔢 🔤` → 422 "Use emoji only, without letters or digits."

### 4.5 Words

- Pools per locale: Draw & Guess uses `drawable` words; Hangman and Decoded use all words.
- A new word is drawn uniformly from the pool minus the team's `game_used_words` for that locale and inserted there. When nothing is left, the team's used words for that locale are deleted and the draw repeats (the previous word is excluded for that draw).
- Words are drawn inside the transaction that creates the round, with the room row locked, so two concurrent starts cannot both succeed.

### 4.6 Scores

Points are awarded once, by an `AwardRoundPoints` action called inside the transaction that ends a round (every end path: guess, pass, give up, reveal, timer job, lazy expiry, game switch, phase change). Nothing is scored while a round is active, so points can never hint at a secret or a correct guess before the end.

- **Abandoned rounds score nothing** (game switch, leaving the icebreaker phase): no `game_points` rows.
- **Participants of a round** = players who acted in it: the leader (Draw & Guess drawer, Decoded clue giver), anyone who made a guess, picked a letter, had a GIF answer at reveal or cast a GIF vote. Each gets exactly one row (0 points if they scored nothing); players who only watched get none.

| Game | Outcome | Points |
|---|---|---|
| Draw & Guess, Decoded | `Guessed` | Correct guesser: `max(10 − 2 × hints revealed, 4)`, `is_win`. Leader: 5 |
| Draw & Guess, Decoded | `TimedOut`, `Passed` | 0 for everyone who acted |
| Hangman | any non-abandoned end | Each picker: 1 per position their hits revealed (from `picked_by`) |
| Hangman | `Solved` | Plus 5 for the player who picked the last letter, `is_win` |
| Sprint in one GIF | `Revealed` | 2 per favourite vote received (scope decision 1), awarded to the GIF's author at close; answerers with no vote and voters without an answer get a 0-point row; no winner. In the icebreaker of an anonymous retro every row is 0 (§4.7) |

- The engine computes the rows from stored round state only (`revealed_positions`, `picked_letters` + `picked_by`, `winner_player_id`, `game_gif_answers` + `game_gif_votes`, `game_guesses`), so a replayed end (job after a lazy expiry) is a no-op thanks to the unique key and the "round still active" check.
- `game.round.ended` carries `points: [{playerId, points, isWin}]`.
- Guests score like members, inside the room only (§4.7).

### 4.7 Leaderboards and streaks

- **Room leaderboard** (standalone and icebreaker rooms): every player with `game_points` rows in the room awarded strictly after `scores_reset_at` (`created_at > scores_reset_at`, standalone) or ever (icebreaker), ranked by points desc, then wins desc, then name. Row: `{playerId, points, wins, roundsPlayed}`. Guests appear here under their room name. Names and avatars come from the `players` list, so a deleted user shows as "Former member".
- **Reset** (standalone rooms, room managers): `DELETE /games/{room}/scores` sets `scores_reset_at = now()` and broadcasts `game.room.changed`. The team leaderboard is not affected. Icebreaker rooms cannot be reset (they belong to one retro).
- **Team leaderboard** (Games tab, team viewers only; periods of scope decision 3): the team's current members (`Team::members()`) with at least one `game_points` row whose `user_id` is theirs, across the team's standalone and icebreaker rooms, for **Last 30 days** (default; `created_at >= now() − 30 days`) or **All time**; ranked as above, top 20. Row: `{userId, name, avatarUrl, points, wins, roundsPlayed, streak}`. Guests never appear (no account, so no identity across rooms); workspace Owners/Admins who are not team members do not appear either. Deleting a room or a retro removes its points from the team leaderboard.
- **Streak** (members only, scope decision 2): number of consecutive ISO weeks (Monday start, `created_at` read in UTC) in which the member has at least one `game_points` row in the team, counting back from the current week, or from the previous week when the current week has none yet (a streak is not broken before the week is over). Shown when ≥ 2 as "n-week streak". Computed at read time with one grouped query (no stored counter).
- **Anonymous retros** (safer option chosen): votes are cast on anonymous answers, so points would tie a GIF to its author. In the icebreaker of an anonymous retro (`retros.is_anonymous`) Sprint in one GIF **awards no points at all**: `AwardRoundPoints` writes 0-point rows (round played, streak kept) and no leaderboard, round end card or `results.games` figure ever carries GIF points. Votes still count: the close payload shows the vote total per anonymous GIF, without author. Other games keep named leaderboards (Decision 7). Accepted residual risk (as today): when a single player answered, `game.answer.changed` alone tells who posted the only GIF.

## 5. Timers

Turns are timed manually by the host (Decision 2); there is no per-turn setting and no automatic start. A turn ends on a correct guess, a pass/give-up/reveal by the host (or leader), or when the host's timer reaches zero.

- **Standalone rooms:** the host sets or clears `game_rooms.timer_ends_at` (10–7200 s, same control as the board timer) whenever they want; starting a round never touches it.
- **Icebreaker:** the board timer (`retros.timer_ends_at`, `PUT /retros/{retro}/timer`) is the game timer, set by the facilitator with the existing `timer.changed` broadcast. Both timers are stored in whole seconds (`startOfSecond()`), so the expiry job's comparison with the scheduled end time is exact.
- **Expiry closes the active round**, server-side: whenever a timer is set while a round is active, or a round starts while a host timer is already running, a `CloseExpiredGameRound(roundId, endsAt)` job is dispatched with a delay until `endsAt`. When it runs it ends the round only if the round is still active and the timer still equals `endsAt` (a changed or cleared timer makes stale jobs no-ops). An expiry applies to a round only when the timer ended after the round's expiry anchor (its `started_at`, or the reveal time for the voting stage of Sprint in one GIF): a timer that ran out before the round started never ends it. Every game endpoint and snapshot also applies the same check first, so a late queue never shows a stale round. Outcome: `TimedOut` (Draw & Guess, Decoded, Hangman). Sprint in one GIF has two stages: expiry before the reveal reveals the answers and opens voting (the host sets a new timer for the voting window, or closes it manually); expiry during voting closes the round as `Revealed` and awards the vote points.
- A timer that expires with no active round only plays the existing "time's up" feedback.

## 6. Icebreaker inside a retro

- In `Icebreaker` phase the board area shows the game panel instead of columns; everything else on the board page (presence strip, timer, flying reactions, cursors per spec 1 settings, facilitator controls) stays.
- The facilitator (host) can switch the game at any time, including mid-round (§4 common rules).
- Game events travel on the retro's `presence-retro.{retroId}` channel; the board snapshot gains `icebreaker: GameSnapshot | null` (non-null only in `Icebreaker` phase), `retro.icebreakerGame` and `icebreakerGames: [{value, label, available}]` (the create/settings selector; `gif` available only with a GIF provider).
- Game mutations on an icebreaker room: only in `Icebreaker` phase (403 otherwise), not on a `Completed` retro, and 423 while `is_locked` (spec 1 §6). The history endpoints stay readable in every phase.
- Leaving `Icebreaker` ends the active round as `Abandoned` (in the phase-change transaction); coming back resumes with no active round.
- Retro anonymity (`is_anonymous`) covers board content. Games show player names like the presence strip does, except Sprint in one GIF authors on anonymous retros (Decision 7).
- Turning the Icebreaker phase off (spec 2 §2.3) never deletes the icebreaker room, its rounds or its points: they stay readable (history, `results.games`) and the room resumes if the phase is turned on again.
- Deleting the retro deletes its icebreaker room (cascade); nothing else does.

### 6.1 "Games we played" (retro Results view)

Spec 2's Results view (retro `Completed`) renders a "Games we played" section from `results.games`, built by this spec's `BuildGamesPlayed` presenter and added to `results` by spec 2's snapshot builder. `BuildGamesPlayed` presents each round through the standalone round-history presenter `App\Actions\Games\PresentGameRoundHistory` (the same class that builds `GameSnapshot.history`, §7) and adds the `clue`, `leader` / `winner` objects and `answers` below; no secrecy rule is re-implemented outside these two classes.

- **`results.games`** is `null` when the retro has no icebreaker room or the room has no ended round other than `Abandoned`; otherwise `{roomId, rounds, leaderboard, roundsPlayed}` (`roomId` for the "Replay" link):
  - `rounds`: the room's retained ended rounds, `Abandoned` excluded, oldest first: `{id, game, outcome, word, question, clue, leader, winner, answers, endedAt}`, where `leader` / `winner` are `{playerId, name, avatarUrl, isGuest} | null` and `answers` (Sprint in one GIF only, else `null`) is `[{gif, playerId | null, votes}]` with `playerId` null on anonymous retros (Decision 7); `votes` is the final count, known since the round is closed. "Who guessed" is the `winner`: a Draw & Guess or Decoded round ends on its first correct guess, a Hangman round credits the solver. Guess texts (wrong, near-miss or correct) are not included.
  - `leaderboard`: the icebreaker room leaderboard (§4.7) with names and avatars: `[{playerId, name, avatarUrl, isGuest, points, wins, roundsPlayed}]`.
  - `roundsPlayed`: count of rounds listed.
- **Secrecy:** only rounds with `ended_at` set are read (all of them are ended in `Completed`, since leaving `Icebreaker` abandons the active round); words and GIF answers are therefore already public (§8). Drawings are not in the payload: a round's "Replay" link calls `GET /games/{room}/rounds/{round}`, which resolves the viewer as a player of the icebreaker room like any game request.
- **Viewers:** everyone who sees the Results view, guests included (same content; spec 2 §6.1).
- **Query budget:** constant number of queries whatever the rounds and players (eager loads plus one grouped points query).
- **Refresh:** results only exist in `Completed`, where game mutations are refused (§6), so the section never changes while shown; reopening the retro hides the Results view as spec 2 already does.

## 7. Endpoints, channels and events

### Channels

- Standalone rooms: presence `presence-game.{roomId}`, authorized in `BroadcastAuthorizationsController` (new branch) by resolving the player (member or guest cookie), with the 12-player cap (§3). Member info `{id: playerId, name, avatarUrl, isGuest}`. Client events are allowed (same Reverb setting as spec 1).
- Icebreaker rooms: the existing `presence-retro.{retroId}` channel.
- No private channel is used: the leader fetches the secret word over HTTP.

### Routes

Board pages and team routes:

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/w/{workspace}/teams/{team}/games` | team viewer | Inertia `games/index`; `?period=30d\|all` (default `30d`, anything else → `30d`) selects the team leaderboard, sent as a deferred prop `leaderboard` (§4.7) |
| POST | `/w/{workspace}/teams/{team}/games` | team viewer | Create room `{name, game, access}` |
| GET / POST | `/play/{guestToken}` | anyone | Guest join page / join (throttle 10/min) |
| GET | `/games/{room}` | player | Inertia `games/show`; for an icebreaker room redirects to the retro |

Under `/games/{room}/…` (middleware `ResolveGamePlayer`: resolves the player for either kind of room; JSON; controllers follow the one-controller-per-resource convention of `app/Http/Controllers/Retros`):

| Method | Path | Who | Body / response |
|---|---|---|---|
| GET | `snapshot` | player | `GameSnapshot` for the viewer |
| PATCH | `/` | host, creator, Owner/Admin | `{name?, access?, locale?}` (standalone; icebreaker: `locale` only) → 204; clients refetch on `game.room.changed` |
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
| POST | `rounds/{round}/reveal` | host | reveals the GIFs and opens voting (§4.2) |
| PUT / DELETE | `rounds/{round}/vote` | player, not the GIF's author | `{answerId}` → 204; replace or retract until close; same rate limit as guesses |
| POST | `rounds/{round}/close` | host | closes the voting window, ends the GIF round and awards points |
| GET | `gifs?q=` | player | GIF search proxy |
| DELETE | `scores` | host, creator, Owner/Admin | reset the room leaderboard (standalone only; 404 for icebreaker rooms) → 204 |
| POST | `shares` | host, creator, Owner/Admin — team members only (§3.1) | `{channel: slack\|telegram\|msteams\|mattermost\|webhook, includeGuestLink?}` → 202 delivery (standalone only; `throttle:5,1` per user; registered only when the provider is enabled) |

Round-scoped mutations on a round that is not the room's active round, or on the wrong game kind → 409 "This round is over." / 422.

### Snapshot (`GameSnapshot`, built for the viewer by one `BuildGameSnapshot` class; all game redaction lives there and in its presenters)

- `room`: `{id, name, game, locale, access, timerEndsAt, isHost, canManage, canDelete, canBecomeHost, isIcebreaker, hostPlayerId, currentRoundId, teamName, guestUrl}` (`guestUrl` only for managers of a `link` room, never the token alone in broadcasts; `canDelete` = creator or workspace Owner/Admin and `canBecomeHost` = creator or Owner/Admin who is not the host, both standalone only; `currentRoundId` lets the client show the last round's end card after a refetch; `teamName` null for guests).
- `me: {playerId, userId, isGuest}`; `games: [{value, label, available}]` (the game switcher; `available` false without a GIF provider or, in an icebreaker, with GIFs off); `links: {team, retro}` (team for members of standalone rooms, retro for icebreaker rooms); `serverTime` (UTC, `Y-m-d\TH:i:s.v\Z`); `emojiData: {baseUrl, locale}` (as the retro snapshot, for the Decoded clue editor).
- `players`: `[{id, presenceId, name, avatarUrl, isGuest}]`.
- `round`: null or `{id, game, leaderPlayerId, startedAt, mask?, misses?, pickedLetters?, clue?, question?, drawing?, guesses?, answers?, myAnswer?, word?}` where:
  - `word` only for the leader of an active Draw & Guess / Decoded round;
  - `guesses`: last 50 of the round, `{id, playerId, text, veryClose?}` for wrong and near-miss guesses of everyone, with `veryClose: true` only on the viewer's own near misses; never correct guesses;
  - `answers`: before reveal `[{playerId, answered: true}]`; `myAnswer` only the viewer's gif. From reveal (`revealedAt` set) until close `[{id, gif, playerId | null}]` (no votes, no counts), `voters: [playerId]` and `myVote` (the viewer's answer id, viewer only).
- `history`: last 20 ended rounds `{id, game, outcome, word, question, leaderPlayerId, leaderName, winnerPlayerId, winnerName, endedAt}` (the round detail endpoint also carries the two player ids), each presented by `App\Actions\Games\PresentGameRoundHistory` (a standalone class, reused by `BuildGamesPlayed`, §6.1); it refuses a round with `ended_at` null.
- `leaderboard`: the room leaderboard (§4.7) `[{playerId, points, wins, roundsPlayed}]`; `scoresResetAt`.
- `share`: `{slack, telegram, msteams, mattermost, webhook}` booleans, true only when the invite is available and the viewer may send it (§3.1); `deliveries`: the latest `game_room_link` delivery per channel `{channel, status, error, sentAt, requestedBy}` for those viewers, else `[]`. Both absent (false / `[]`) in icebreaker rooms.
- Constant query count as players, rounds and guesses grow.

### Broadcast events

Base class `GameBroadcastEvent` (same pattern as `RetroBroadcastEvent`: after commit, `toOthers()`, report-don't-throw); `broadcastOn()` returns the retro channel for icebreaker rooms and `presence-game.{roomId}` otherwise.

`game.room.changed` (settings, host, game switch → clients refetch the game snapshot), `game.room.deleted`, `game.timer.changed {timerEndsAt}`, `game.round.started {round}` (public payload, never the word), `game.round.ended {roundId, outcome, word, winnerPlayerId, leaderPlayerId, question?, answers? (with `votes`), points}` (`points` per §4.6; clients add them to their room leaderboard; the actor of the ending request receives the same payload in its HTTP response as `ended`, since `toOthers()` skips them), `game.hint.revealed {roundId, mask}`, `game.drawing.op-added {roundId, op, clientOpId, count}`, `game.drawing.undone {roundId, count}`, `game.drawing.cleared {roundId, count}` (`count` per §4.1), `game.clue.changed {roundId, clue}`, `game.guess.made {roundId, guessId, playerId, text}` (wrong and near-miss guesses, no near-miss flag; never correct guesses), `game.letter.picked {…}`, `game.question.changed {roundId, question}`, `game.answer.changed {roundId, playerId, answered}`, `game.round.revealed {roundId, answers}` (§4.2), `game.vote.changed {roundId, playerId, voted}`.

Client events (whispers): `game-stroke` only (§4.1).

## 8. Secrecy and anti-cheat

- The secret word leaves the server only: to the leader (snapshot, `secret` endpoint) during the round, and to everyone in `game.round.ended`, history and round detail after it ends. It is `$hidden` on the model; tests assert its absence from every other payload.
- Hangman and hint state goes out as a mask only.
- Correct guess texts are never serialized.
- Near-miss texts are broadcast and shown to everyone like other wrong guesses; only the "very close" flag is private to the guesser (response and own snapshot entries; never in a broadcast or another player's snapshot). Accepted trade-off (Decision 6): a near-miss text is a hint that leaks to every player, including those who are not guessing well; correct guesses stay hidden.
- GIF answers of others are never serialized before reveal; the round detail endpoint 404s while a round is active.
- Votes are private until the round closes: no snapshot or broadcast carries a vote count or who voted for which GIF (only `voted: bool` per voter and the viewer's own `myVote`); the vote endpoints refuse self-votes; on anonymous retros answers carry no author before or after close and award no points, so neither votes nor points identify an author.
- The drawer cannot guess (403); the leader is fixed for the round (host cannot move the drawer mid-round, only pass).
- Stroke whispers are accepted only from the current drawer (Reverb-stamped sender, spec 1 §3); the committed drawing is written only by the drawer through HTTP.
- Rate limits: guesses/letters (§4), drawing ops 20/s, clue 5/s, GIF search 20/min, guest join 10/min.
- Accepted limitation: a drawer can still write the word on the canvas or tell it out loud; that is social, not technical.
- Points are computed and sent only when a round ends (§4.6); no endpoint or broadcast exposes a score for an active round.
- `results.games` reads ended rounds only and carries no guess text; GIF authors are null on anonymous retros (§6.1).
- Invites carry no game content; the guest token leaves the instance only on the sharer's explicit opt-in for a `link` room (§3.1).
- The team leaderboard is visible to team viewers only, never to guests; it holds members only, and guests' points stay inside their room.

## 9. UI

- **Team page:** new "Games" tab: room cards (§3), "New room" dialog (name, first game, access), and a "Leaderboard" panel (period toggle "Last 30 days" / "All time", rank, avatar, name, points, wins, rounds played, "n-week streak" badge; skeleton while the deferred prop loads; empty state "No games played yet."). Guests never see it.
- **Scores in rooms:** a "Scores" tab next to the player list (room leaderboard, guests marked "(guest)"); the round end card shows "+n" per player who scored; room managers get "Reset scores" (confirmation "Scores in this room start again from zero. The team leaderboard keeps them.").
- **Invite:** the room header share button (managers) gains an invite channel picker (§3.1) listing "Slack", "Telegram", "Microsoft Teams", "Mattermost" and "Webhook", each only when available, with the guest-link checkbox for `link` rooms and a muted delivery line ("Posted to Slack · 2 min ago" / "Slack: failed — reconnect required").
- **"Games we played"** (rendered by spec 2 in the Results view from §6.1): one row per round (game icon, word or question, outcome, winner and leader avatars, GIF thumbnails with authors unless anonymous, "Replay" for drawings) and the icebreaker podium (top 3) with the full leaderboard behind "Show all".
- **Room page (`games/show`)** and **icebreaker panel** share `resources/js/components/games/*`:
  - Header: room name, game switcher (host), timer control (host), share link (managers of `link` rooms), history button.
  - Draw & Guess: canvas left (toolbar for the drawer: 6 colour dots, 3 sizes, eraser, fill, undo, clear, "Reveal a letter", "Pass"); right: player list with a check on the winner, chat of guesses with input (disabled for the drawer). The drawer sees the word above the canvas; others see the mask as `_ _ _`.
  - Sprint in one GIF: question banner (host: shuffle / edit until first answer), GIF search popover (with provider attribution), grid of answer tiles showing "answered" placeholders until reveal; after reveal the GIFs (with author unless anonymous) with a "Favourite" button on every tile but your own (one choice, changeable, "n of m voted" without counts), host "Finish round"; at close, vote counts per GIF and "+n" for the authors (no points on anonymous retros).
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
- Invites (every channel): 404 when the provider is disabled, 409 "Connect :provider in the team settings." / "Reconnect :provider in the team settings.", 422 "Guest access is off for this room.", 403 for non-managers and guests, 429 after 5 per minute; delivery failures follow spec 6 §5.5 and show on the delivery line.
- Reset scores on an icebreaker room → 404; by a non-manager → 403.
- Votes: 409 before the reveal or after close, 403 on a self-vote, 422 for an unknown answer id.
- Team leaderboard failure to load the deferred prop → "Could not load the leaderboard." with a retry link; the room list still works.

## 11. Changes to other specs

- **Retro flow extras (spec 2):** the `Icebreaker` phase shows the game panel instead of the "Warm-up" placeholder (§6); `retros` gains `icebreaker_game`, accepted at creation and by `PATCH /retros/{retro}/settings` (§2); leaving `Icebreaker` abandons the active round inside the phase-change transaction (§6). Phase, toggle and adjacency rules are unchanged. *(Applied in spec 2 §2.3, §2.5, §3, §8.4, §10.1.)*
- **Board engagement (spec 1):** `GifCatalog::servable()` also serves ids stored in `game_gif_answers` (§4.2); in an icebreaker the `game-stroke` whisper travels on `presence-retro.{retroId}` next to `cursor` and `reaction`, with the same Reverb-stamped sender check (§4.1). Card GIF, whisper and lock rules are otherwise unchanged. *(Spec 1 is built: this change is made by this spec's implementation plan.)*
- **Core spec** (built; this spec's implementation plan makes the change): `BroadcastAuthorizationsController` gains the `presence-game.{roomId}` branch (§7); the retro channel's authorization is unchanged.
- **Retro flow extras (spec 2), Results view:** `results` gains `games` (§6.1, `null` when no games were played), built by `BuildGamesPlayed` inside spec 2's snapshot builder; §6.2 gains a "Games we played" section (after Action items, before ROTI) shown only when `results.games` is not null, for every viewer including guests; the out-of-scope line about "Games we played" goes away. Spec 2's LLM summary input is unchanged (games are not sent). *(Applied in spec 2 §1, §6.2, §6.6, §10.3, §11, §13, §15.)*
- **Integrations (spec 6):**
  - §1 out of scope: remove "Game room invites"; in scope: room invites to Slack/Telegram (spec 7 §3.1); spec 8 adds the other channels.
  - §3 `integration_deliveries`: `kind` gains `game_room_link`; `subject_type` gains `GameRoom` (with the `deleting` hook).
  - §5.1: a third link kind, the standalone game room, with the message and guest-link rule of spec 7 §3.1 (guest link only for `link` rooms, opt-in, off by default).
  - §5.5: a finished `game_room_link` delivery broadcasts `game.room.changed` on `presence-game.{roomId}`.
  - §8 permissions: "Post a game room invite" — room host, creator and workspace Owners/Admins, team members only.
  - §9: route `POST /games/{room}/shares` (spec 7 §7), registered only when the provider is enabled.
  - §10.1: row "Room invite (Slack, Telegram; spec 8 adds Teams, Mattermost, webhook)" — sent: room name, game, team name, sharer's name, URL (guest URL only on opt-in); never: players, words, questions, drawings, GIFs, scores.
  - §15 tests: invite permissions, guest-link rule, message content and escaping, delivery row and broadcast.
  - *(Applied in spec 6 §1, §2.2, §3, §5.1, §5.5, §8, §9, §10.1, §14, §15.)*

## 12. Testing

Pest feature tests under `tests/Feature/Games/*`; provider HTTP faked with `Http::fake()`, broadcasts with `Event::fake()`, the queue with `Queue::fake()` / `travelTo()`.

- **Rooms:** create by team member; 11th room → 422; icebreaker rooms not counted; list scoped to team; guest cannot list; settings and delete permissions (creator, Owner/Admin, host); host transfer to member only; "Become host".
- **Access:** `team` room refuses guests; `link` room guest join, resume by cookie, token regeneration revokes; switching to `team` blocks guests; non-member logged-in joins as guest without team access.
- **Player cap:** channel auth refuses a 13th member when Reverb reports 12 (Pusher client mocked), allows a present member to reconnect, allows when Reverb errors.
- **Secrecy (main invariant):** for each game, the word is absent from non-leaders' snapshots, every broadcast before `game.round.ended`, `rounds` history of active rounds and `rounds/{round}` (404 while active); `secret` 403 for non-leaders; correct guess text absent everywhere; near-miss text broadcast like wrong guesses while the "very close" flag appears only in its author's response and snapshot; GIF ids of others absent before reveal.
- **Draw & Guess:** drawer-only ops, undo, clear; point/op caps 422; coordinate/colour/size validation; hints up to half the letters; guess results wrong/near/correct with normalization, near-miss text broadcast without the flag (case, accents, spaces); correct guess ends the round with the winner; drawer guess 403; pass by drawer or host; rate limit 429.
- **Sprint in one GIF:** hidden without provider / with `gifs_enabled` off in an icebreaker; question shuffle/custom until first answer then 409; one answer per player, replace/remove until reveal; reveal by host opens voting (round stays active, no points yet); proxy serves revealed answer ids; votes: one per player, replaceable and retractable until close, self-vote 403, vote before reveal or after close 409, non-answerers may vote, guests may vote; no vote count or voter-to-GIF link in any snapshot or broadcast before close; close by host, by timer expiry during voting, and by starting the next round; timer expiry before reveal reveals instead of closing.
- **Hangman:** hit/miss, accent folding, duplicate letter 409, solved credits the last picker, 6 misses → lost.
- **Decoded:** clue ≤ 5, `SingleEmoji`, rejects keycaps, flags, letter-like emoji and text.
- **Words:** no repeat per team+locale until pool exhausted, then reset; drawable filter for Draw & Guess; dictionary files meet §2 constraints (sizes, allowed characters, all four locales).
- **Timers:** starting a round never sets a timer; job ends the active round when the host timer expires with the right outcome; stale job no-op after timer change or clear; lazy expiry on the next request; icebreaker uses the board timer and `timer.changed`.
- **Icebreaker:** room created on entering the phase; host = facilitator (follows transfer); mutations 403 outside the phase, 423 when locked; leaving the phase abandons the round; events on the retro channel; retro deletion cascades; anonymous retro hides GIF authors, lets votes be cast on anonymous tiles and awards no GIF points (leaderboard, `points` payload and `results.games` unchanged by GIF rounds).
- **Retention:** 21st ended round prunes the oldest with its guesses and answers.
- **Snapshot:** constant query count.
- **Scores:** each row of the §4.6 table (guesser with 0, 1, 3 hints; leader 5; Hangman hits per position and solve bonus; Lost keeps hit points; GIF votes 2 per vote received, awarded to the author at close, 0-point rows for answerers without votes and for voters without an answer, nothing when abandoned during voting, all rows 0 in the icebreaker of an anonymous retro); watchers get no row, actors without points get 0; `Abandoned` rounds award nothing; a second end attempt (job after lazy expiry) adds no row; no points in any payload before the round ends; `game.round.ended` carries `points`; points survive round pruning.
- **Leaderboards:** room ranking (points, wins, name) and reset (managers only, standalone only, team leaderboard unchanged); team leaderboard lists current members only, excludes guests, removed members and deleted users, includes icebreaker points, honours `30d` / `all`; team leaderboard 403 for guests and non-viewers; deleting a room removes its points.
- **Streaks:** consecutive ISO weeks with `travelTo()`; a gap breaks it; no play yet this week keeps last week's streak; guests have none.
- **Games we played:** `results.games` null without an icebreaker room or with only abandoned rounds; still present after the Icebreaker phase is turned off; `PresentGameRoundHistory` output identical in `history` and `results.games` rounds for the shared fields; lists ended rounds with word, winner and leader; no guess text; GIF answers without `playerId` on anonymous retros and with it otherwise; leaderboard matches the room's; guests receive it; constant query count.
- **Invites (each of `slack`, `telegram`, `msteams`, `mattermost`, `webhook`, data-provided):** 404 with the provider disabled; 409 when not connected ("Connect/Reconnect :provider in the team settings."); 422 for `includeGuestLink` on a `team` room; 403 for guests and non-manager players; manager creates a `game_room_link` delivery and dispatches the matching job (`Queue::fake()`); the message (with `Http::fake()`) contains room, game, team, sharer and `/games/{room}` or, on opt-in, `/play/{token}`, escaped per channel (Slack mrkdwn, Telegram HTML, Adaptive Card, Mattermost Markdown), and no player names; the generic webhook body is `event = game_room.link` with `data {title, game, team, url, sharedBy}`; job completion broadcasts `game.room.changed`; deleting the room removes its deliveries.
- **Manual two-browser walkthrough** (desktop + phone): live strokes appear while drawing and match after pointer-up; fill identical on both; late joiner sees the drawing; near miss shown to everyone but flagged "very close" only for its author; correct guess ends the turn without showing the text; GIF answers hidden, revealed by the timer, then voted on in both browsers (no self-vote, counts and "+2" points only at close); Hangman with accents; Decoded rejects `1️⃣`; icebreaker switches game mid-round; room link guest join; 13th browser refused; "+n" points on the round end card and the Scores tab update in both browsers; team leaderboard with a streak badge; completed retro shows "Games we played"; with Slack, Telegram, Teams, Mattermost and a generic webhook connected, an invite with the guest link arrives in each and opens the guest join page.

## 13. Acceptance criteria

1. Team members can create up to 10 standalone rooms per team, with team-only or link access; guests join link rooms only, as for retros; deleting a room removes its players and rounds.
2. A standalone room admits at most 12 online players (soft cap, fail open when Reverb is unreachable).
3. Draw & Guess, Sprint in one GIF, Hangman and Decoded follow §4, with one shared engine for rooms and icebreakers.
4. No snapshot, response or broadcast gives a secret word to anyone but the leader before the round ends; correct guess texts are never exposed; near-miss texts are shown to everyone but the "very close" flag reaches only the guesser (accepted hint leak); GIF answers stay hidden until reveal and vote counts until close (§8).
5. Live strokes travel as presence whispers accepted only from the current drawer; committed operations are server-validated, persisted, and rebuild the drawing for late joiners and history.
6. Words come from per-locale dictionaries (en/fr/es/de), exclude undrawable words from Draw & Guess, and never repeat within a team and locale until the pool is exhausted.
7. Timer expiry ends the active round server-side (job + lazy check), in rooms and with the board timer in the icebreaker.
8. In the retro `Icebreaker` phase (spec 2), the facilitator hosts the game, can switch it at any time, and leaving the phase abandons the active round.
9. Each room keeps its last 20 ended rounds, reopenable with their drawing, clue or answers.
10. GIFs are only fetched through skrum's proxy; the GIF game is unavailable without a provider.
11. All new strings are translated in en/fr/es/de; suite, phpstan, type-check and lint are green; the walkthrough passes.
12. Ended, non-abandoned rounds award points per §4.6, only at round end; points outlive round retention. In Sprint in one GIF, players vote for a favourite GIF after the reveal (one vote each, no self-vote, hidden until close) and each vote earns its author 2 points at close; anonymous-retro icebreakers award no GIF points (§4.2, §4.7).
13. Each room shows a leaderboard (resettable in standalone rooms); each team shows a members-only leaderboard for the last 30 days or all time with weekly streaks; guests score in their room only (§4.7).
14. A completed retro with icebreaker rounds exposes `results.games` (rounds, words, leaders, winners, leaderboard) with no guess text and no GIF authors on anonymous retros (§6.1).
15. Room managers who are team members can invite through every share channel the team has connected (Slack, Telegram, Microsoft Teams, Mattermost, generic webhook); the guest link is sent only on opt-in for `link` rooms; no game content is sent (§3.1).

Plan-writing amendments (2026-09-30), from plans 13a–13d: applied in §2 (retention of ended rounds, random GIF answer ids), §3 (available game on creation, gendered guest names, icebreaker room player and `icebreaker_game` rule), §3.1 and §10 (409 when not connected, `teamName`), §4 (Pass/Give up control), §4.1 (required leader, round payload, hints by position, guess `ended`, secret 409, drawing ops and whisper chunks), §4.2 (GIF payloads, responses, search errors, `votes` null outside `Revealed`), §4.3 (Hangman payload), §4.7 (reset, 30-day window, ISO weeks), §5 (whole-second timers, expiry anchor), §6 and §6.1 (board snapshot keys, `roomId`), §7 (snapshot keys, history ids, PATCH 204, ended payload to the actor).

## Decisions (2026-09-30)

1. Stroke transport: hybrid, live whispers from a verified sender plus HTTP-committed strokes persisted for late joiners and history.
2. Turn timer: manual host timer only (QRetro parity); no `turn_seconds`, no auto-start; turns end on a correct guess, a host pass, or the host timer reaching zero (server-side expiry job kept).
3. Word history: per team and locale.
4. Rooms: any team member creates; delete by the creator or a workspace Owner/Admin.
5. Player cap: count presence members through Reverb's HTTP API at channel auth, fail open.
6. Near-miss: text shown to everyone in the chat, "very close" flag only for the guesser (hint leak accepted); correct guesses never shown.
7. Anonymous retros in the icebreaker: names shown in games except "Sprint in one GIF" answer authors.
8. Guest names: guest types a display name, prefilled with a random "Adjective Animal".
9. Scope additions (2026-09-30): scores, room and team leaderboards and streaks (§4.6, §4.7); the "Games we played" read model for spec 2's Results view (§6.1); room invites to every share channel through spec 6/8 link sharing (§3.1). Recorded in "Decisions (scope additions, 2026-09-30)" below.

## Decisions (scope additions, 2026-09-30)

1. Sprint in one GIF scoring: favourite votes after the reveal, one vote per player, no self-vote, hidden until the round closes, 2 points per vote received; anonymous-retro icebreakers award no GIF points.
2. Streak: weekly play streak per team member (ISO weeks, UTC).
3. Team leaderboard: visible to every team viewer, "Last 30 days" (default) and "All time".
4. Invite guest link: opt-in checkbox, off by default, `link` rooms only.
5. Who invites: room managers who are team members (host, creator, workspace Owners/Admins).
