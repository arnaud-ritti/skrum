# Skrum — Games: room settings, turns and rounds, GIF captions and podium, the whole-word guess, and four new games — Design

Date: 2026-10-03
Status: Draft. Written on the option marked **recommended** of each question of §15; nothing is built before the owner has answered §15 and the pre-build deviations of the plan.
Parent specs: `docs/superpowers/specs/2026-09-29-games-design.md` (the game engine; every rule of it holds unless this spec changes it, and §4.9 lists what it changes) and `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` (§5 rule 13: the mockup is binding for presentation).
Owner's word: `docs/superpowers/research/front-rewrite/owner-answers-2026-10-02.md` — group 6 (6-D1 cards, 6-D3 reactions in rooms, 6-D8 keyboard by locale), third round ("Games: settings card, turn order and rounds, GIF captions and podium, the four games the engine lacks"), round 4b (D-59: the whole-word guess goes to the games roadmap), fifth round (working rules, database portability, roadmap change: "the four extra games (GM-4) stay in plan 27", whole-word guess joins plan 27), sixth round (informal register fr tu / es tú / de du; a guest counts as a participant). Owner note at the top of the roadmap: plans 28 and 30 and scheduling are backlog.
Roadmap rows: GM-1 to GM-4 of `docs/superpowers/research/front-rewrite/feature-roadmap.md`, plus the whole-word guess of hangman (owner's roadmap change). Deviation rows cleared: D-20 (wholly, except the elements the roadmap keeps in the backlog, §3), D-59 (the whole-word field), D-61 (no caption) and the caption part of D-62's "no title or caption" of `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`.
Mockups (binding for presentation): `docs/design-system/components/ScreenIcebreaker` (hangman, game picker of six games, settings card, turn order, last moves, whole-word guess), `ScreenIcebreakerDraw` (settings card of a drawing round, drawing order, "Round 3 / 6", turn timer, "next letter in 0:12"), `ScreenIcebreakerEmoji` (settings card: categories, timer, auto hints; "Round 4 / 8"), `ScreenIcebreakerGif` (caption with counter, "Send my GIF", votes budget, hidden authors, winner card, ranking with ties), `IcebreakerGameCard` (the cards and "Two truths, one lie"), `GamesLeaderboard` (game tiles of a room row). For each: `README.md` and `preview.html`.
Database rules: `docs/database.md` ("Rules for database code" 1 to 12; JSON columns without a database default; `Race` for concurrency; the `tests/Upgrade` pattern).

What was read, and what was not: the code of `main` at `18d3637e` — `app/Enums/{GameKind,GameRoundOutcome,GameRoomAccess}.php`; `app/Models/{GameRoom,GameRound,GamePlayer,GameGifAnswer,GameGifVote,GameGuess,GamePoint}.php`; `app/Support/Games/*` (the `GameRules` interface, its registry, `HangmanRules`, `WordGuessRules`, `DrawAndGuessRules`, `DecodedRules`, `SprintGifRules`, `GameWord`, `GameWordBook`, `GuessMatch`, `GameRateLimit`); `app/Actions/Games/*` (start, end, award, expire, schedule, pick letter, guess, hint, GIF answer / vote / reveal / close / question, switch, create, ensure icebreaker room, snapshot, round and history presenters, leaderboard, games played); `app/Jobs/CloseExpiredGameRound.php`; `app/Http/Middleware/ResolveGamePlayer.php`; the controllers of `app/Http/Controllers/Games` and `TeamGameRoomsController`; the game routes of `routes/web.php`; the game migrations; `resources/games/*`; `tests/Pest.php` (game helpers), `tests/Feature/Games/*` (names and samples), `tests/Concurrency/VoteLimitTest.php`, `tests/Upgrade/GamePointsWeekStartBackfillTest.php`; the front of the games: `resources/js/components/games/*` (layout, panels, sidebar, picker, stage, hangman board and keyboard, start controls, settings dialog, game room), `components/skrum/icebreaker-game-card.tsx`, `lib/games/{types,rotation}.ts`, the per-game maps listed in §9.10. Nothing was run.

## 1. Problem statement

The four games of the engine (Draw & Guess, Sprint in one GIF, Hangman, Decoded) were rebuilt to their mockups by plan 18e with what the server holds. The mockups show more, and plan 18e left a place for each element (`settingsCard`, `turnOrder`, `roundInfo`, `gifCaption`, `gifPodium` of `useRoomPanels` and `GameRoom`; the `settings` place of `GamePicker` and `RoomPlayersSide`):

- **GM-1** A settings card per game: word theme or categories, time per turn, auto hints, guests allowed; for the GIF game, votes per person and authors hidden until the votes close. A room stores only name, access, language and reactions.
- **GM-2** Turns and rounds: "Round 2 of 3", "Round 3 / 6"; a turn order ("Speaking order", "Drawing order", "Next: Inès · 30 s per turn"); a turn timer on the stage; in hangman, "Your turn, Arnaud — pick a letter" and a keyboard disabled out of turn. Hangman has no turns, a room has no number of rounds, and the only timer is the host's room timer (games spec §5, Decision 2: "no `turn_seconds`, no auto-start").
- **GM-3** Sprint in one GIF: a 60-character caption sent with the GIF, two votes per person, authors hidden until the votes close, the winner's card and a ranking with ties. An answer has no caption, a player has one vote, there is no ranking, and authors are shown from the reveal.
- **Whole-word guess** in hangman ("Guess the whole word (+50 pts, −1 life if wrong)"). The engine has none (D-59).
- **GM-4** The game picker of ScreenIcebreaker lists six games: Hangman, Two truths and a lie, Mood weather, Guess who?, Sprint in emojis, Quick question. "Sprint in emojis" is the existing Decoded (an emoji clue, guessed in a chat); the other three and Two truths and a lie do not exist.

Verification of the roadmap's "Back end" lines:

| Row | Line | Found |
|---|---|---|
| GM-1 | "A room stores name, access, language and reactions only" | True (plus host, timer end, current round and reset time). The word book has no theme: a word is `{word, drawable}`, two lists per locale, parallel across the four locales. |
| GM-2 | "Hangman has no turns and a room no round total" | True. Also: no per-turn timer anywhere; the "endless rotation" of a drawer is a client rule (`lib/games/rotation.ts`) and the host's choice is sent as `leader_player_id`. |
| GM-3 | "An answer has no caption; one vote per player and no ranking" | True. Also: one vote is enforced by a unique key (`game_gif_votes` on round and voter), and revealed answers carry their author except in the icebreaker of an anonymous retro, whereas the mockup hides authors until the votes close. |
| GM-4 | "Four new `GameKind` cases with their rules classes, events and redaction" | True but incomplete: two of the games need answers that are not GIFs and votes that are not for a GIF (three small tables); three need a reveal or a close the engine only has for the GIF game (an interface for staged games); two need a question bank other than the GIF questions; the front holds six exhaustive maps per game (`Record<GameKind, …>`). |

## 2. Goals

1. The host of a room (the facilitator in a retro's icebreaker) sets, per room, what the mockups' settings cards show: word theme, time per turn, auto hints, guests allowed, number of rounds; for hangman, whether players take turns; for the GIF game, votes per person and hidden authors.
2. A round has a number ("Round 2 of 3") and, when the room times turns, a turn timer the server enforces. Hangman can be played in turns; the drawing order and the speaking order are shown.
3. In hangman a player can guess the whole word: right, the word is solved; wrong, it costs a life.
4. Sprint in one GIF has a caption per GIF, a vote budget, authors hidden until the close when the room says so, and a ranking with the winner.
5. Four new games: Two truths and a lie, Mood weather, Guess who?, Quick question, playable in standalone rooms and as a retro's icebreaker, with the engine's guarantees (the server is the only authority on secrets; points only at the end of a round; constant query count of the snapshot).
6. Nothing existing is lost: every existing room plays exactly as before until its host changes a setting; every existing test passes; database code is Eloquent only and runs on PostgreSQL, MariaDB, MySQL and SQLite.

## 3. Non-goals (what stays in the backlog)

From the roadmap ("Not requested, staying backlog") and D-20: "needs n more players" and the players min–max line of a game card; "found by" chips and "found · 0:18" (a time per finder); Redo and "New word" in Draw & Guess; the emoji riddle bank with progressive timed hints and the "−20" hint (ScreenIcebreakerEmoji's engine; Decoded keeps its clue giver); "Pin to the retro" of the GIF winner; the duration on a game card. Also out of scope:

- GIFs as looping video, a still under reduced motion, a GIF title (D-62: the proxy gives none; backlog "proxy").
- The GIF game's "Theme: Sprint 42" setting (no theme entity; the host already shuffles or types the question).
- Mood weather feeding the team's Mood trend (owner, third round, point 10: the Mood is health-check score plus ROTI).
- Scheduling, plans 28 (whiteboard collaboration) and 30 (mentions): nothing here reserves a place for them.
- MCP tools for games (there are none today), and games in the retro recap or the AI summary input.
- Changing the points scale of the existing games (§15 decision 1).

## 4. Decisions already taken

1. **Mockup first** (parent §5 rule 13): layout, placement, labels and states follow the mockups; a difference is fixed or is a pre-build deviation of the plan, put to the owner before its screen is built (fifth round).
2. **Existing features kept**: every control the four games have today stays (manual hint button, leader picker, Pass / Give up, room timer, "+2 min", reset scores, history, share). A new setting defaults, for an existing room, to today's behaviour.
3. **Simple data added**: columns on `game_rooms` and `game_rounds`, one column on `game_gif_answers`, three small tables; no JSON object column (lists only), no stored derived column.
4. **Informal register** in every new text (fr tu, es tú, de du).
5. **Guests count as participants**: guests play, answer, vote and score in every new game exactly as members (inside the room only, games spec §4.7); they never edit settings.
6. **Eloquent only** (`docs/database.md`).
7. **One engine**: the new games are `GameRules` implementations registered in `GameRulesRegistry`, played through the same start, end, award, expiry and snapshot paths, in standalone rooms and in the icebreaker.
8. **"Sprint in emojis" is Decoded.** The mockup's picker names the existing emoji game "Sprint en emojis" and ScreenIcebreakerEmoji calls it "Guess the emoji"; the product keeps its name "Decoded" (a pre-build deviation, no new game).

### 4.9 What this spec changes in the games spec

- §2: `GameKind` gains four cases and `GameRoundOutcome` one; `game_rooms`, `game_rounds`, `game_gif_answers` gain columns; `game_gif_votes`' unique key changes; three tables are added (§6.13).
- §4.2: the GIF vote is a budget of 1 to 3 votes (one per GIF), answers carry a caption, authors can stay hidden until the close, and the closed round has a ranking whose top authors win (§6.7).
- §4.3: hangman can be played in turns, and a player can guess the whole word (§6.6).
- §4.5: a room can restrict words to themes (§6.3).
- §5 and Decision 2: a room can time each turn (`turn_seconds`); the server ends a turn when its time is up. The host's room timer is unchanged.
- §4.6: the scores table gains the rows of §6.12.

## 5. Rules

- The server decides whose turn it is, when a turn ends, and what each viewer may see; the client only proposes (the host's client proposes the turn order from who is online, as it proposes the drawer today).
- Settings are read when a round starts and copied onto the round where a running round depends on them (`turn_seconds`, `hint_seconds`, `votes_allowed`, `authors_hidden`, `rounds_total`). Changing a setting never changes a round in play.
- Every new mutation runs in a transaction that locks the room, then the round (`LockGameRound`), as every round mutation does.
- Every new broadcast is a `GameBroadcastEvent` (after commit, to others); the actor gets the same data in its response.
- Points are computed from stored round state only, once, in `EndGameRound` (unchanged).

## 6. Domain and data

### 6.1 The games

| `GameKind` | Value | Label (en / fr) | Leader | Turns | Stages | Players (UI rule for Start) |
|---|---|---|---|---|---|---|
| `Hangman` | `hangman` | Hangman / Pendu (existing) | — | when the room takes turns | — | 1 |
| `DrawAndGuess` | `draw` | Draw & Guess / Dessine et devine (existing) | drawer | — (the round is the turn) | — | 2 |
| `Decoded` | `decoded` | Decoded / Décodé (existing) | clue giver | — | — | 2 |
| `SprintGif` | `gif` | Sprint in one GIF / Le sprint en un GIF (existing) | — | — | answer, vote | 1 |
| `TwoTruths` (new) | `two_truths` | Two truths and a lie / Deux vérités, un mensonge | teller | — (the round is the turn) | write, vote | 3 |
| `MoodWeather` (new) | `mood` | Mood weather / Météo de l'humeur | — | — | pick | 1 |
| `GuessWho` (new) | `guess_who` | Guess who? / Devine qui ? | — | — | answer, attribute | 3 |
| `QuickQuestion` (new) | `quick_question` | Quick question / Question express | — | always | speak | 1 |

"Players" is the existing UI-only rule ("Waiting for another player" under the count, Start disabled), extended: the server does not track who is online (games spec §4).

`GameRoundOutcome` gains `Finished` (`finished`): every speaker of a Quick question had their turn.

A game is available (`GameRules::isAvailable`) as follows: the four existing as today; Two truths, Mood weather and Quick question always; Guess who? always, except in the icebreaker of an anonymous retro (decision 6).

### 6.2 Room settings (GM-1)

New columns of `game_rooms`; each existing room gets the value in "Existing rooms", which is today's behaviour; a room created after the release (standalone, or the icebreaker room of a retro) gets "New rooms".

| Column | Type | Meaning | Existing rooms | New rooms | Accepted |
|---|---|---|---|---|---|
| `word_themes` | JSON list, nullable | themes the words are drawn from; null or empty = every word | null | null | values of `GameWordTheme`, distinct |
| `turn_seconds` | small unsigned int, nullable | time per turn; null = untimed | null | null | 15, 30, 45, 60, 80, 90, 120, 180 |
| `auto_hints` | boolean, default false | the server reveals letters on its own (Draw & Guess, Decoded) | false | false | boolean |
| `takes_turns` | boolean, default false | hangman is played in turns | false | **true** (decision 2) | boolean |
| `rounds_per_game` | tiny unsigned int, nullable | number of rounds of a game; null = endless | null | null (decision 3) | 1 to 20 |
| `gif_votes` | tiny unsigned int, default 1 | votes per person in Sprint in one GIF | 1 | **2** (mockup "Votes: 2 each") | 1, 2, 3 |
| `gif_authors_hidden` | boolean, default false | authors stay hidden until the votes close | false | **true** (mockup "Hide authors until votes", on) | boolean |

`PATCH /games/{room}` accepts them (snake case, each `sometimes`) for standalone rooms and for icebreaker rooms (where `name`, `access` and `reactions_enabled` stay prohibited), from a room manager (§7); it broadcasts `game.room.changed` as today. The snapshot's `room` gains `settings: {wordThemes: string[], turnSeconds: number|null, autoHints: bool, takesTurns: bool, roundsPerGame: number|null, gifVotes: number, gifAuthorsHidden: bool}`. A setting that does not apply to the game in play is stored and kept for when the host switches to a game it applies to.

Which settings each card shows (§9.2): Hangman — word theme, time per turn, take turns, rounds, guests allowed; Draw & Guess — word theme ("Word list"), time per turn, auto hints, rounds; Decoded — categories (several themes), time per round, auto hints, rounds; Sprint in one GIF — votes, hidden authors, rounds; Two truths — time per turn, rounds; Mood weather — none (the card says "Answers are anonymous."); Guess who? — rounds; Quick question — time per person, rounds. "Guests allowed" is the existing room access (`team` / `link`), standalone only.

### 6.3 Word themes

`GameWordTheme` (new enum): `Work` (`work`, "Team & tech" / "Équipe & tech"), `Objects` (`objects`, "Everyday objects" / "Objets du quotidien"), `Food` (`food`, "Food" / "Cuisine"), `Nature` (`nature`, "Nature & animals" / "Nature & animaux") (decision 4).

- Every word of `resources/games/words/{locale}.php` gets one theme. The four files are parallel today (the same concepts in the same order); each file is rewritten as themed lists, the same concepts in the same themes in each locale. Every abstract word is `work`. The English partition is in the plan (Task 2); each theme holds at least 15 drawable words in every locale, and `work` at least 60 words.
- `GameWordBook::words($locale, $drawableOnly, $themes)` filters by theme; an empty list means every theme. `DrawGameWord` draws from the pool of the room's themes minus the team's used words; when the pool is used up, it forgets the used words **of that pool** only (not of the whole locale), and excludes the previous word for that draw (games spec §4.5 otherwise unchanged).
- A theme that leaves Draw & Guess with no drawable word cannot happen (every theme has drawable words); the validation still refuses an empty pool (422 "No word fits these themes.").
- The stage line "Round 2 of 3 · Theme: Team & tech" names the theme when exactly one is chosen.

### 6.4 Rounds and turns (GM-2)

**Number.** `game_rounds.number` (1-based) and `rounds_total` (copied from `rounds_per_game` at start, null when endless). At start, inside the locked transaction: the previous round of the room (the latest by `started_at`, then id) continues the game when it is of the same game, has a number, and either `rounds_total` is null or its number is below it; then `number = previous + 1`, else 1. A game switch therefore starts again at 1; a round abandoned by leaving the icebreaker phase keeps its number. Rounds from before the release have no number and are shown without one. When the last round of a game ends, the end card says "Game over" with the room's scores and the host's button reads "New game" (it starts round 1).

**Turn order.** For a game that takes turns (hangman when `takes_turns`, Quick question always) the start request carries `turn_order`: the ids of the players to play, in order — the host's client sends the online players in join order, as it proposes the drawer today. The server checks they are distinct players of the room (1 to 50), stores the list on the round (`turn_order`), and sets `turn_player_id` to the first. A player who joins during the round plays from the next round.

**Turn timer.** When the game times turns and the room has `turn_seconds`, the round copies it (`turn_seconds`) and the server sets `turn_ends_at = now + turn_seconds` (whole seconds) at the start of each turn. A game "times turns" when its turn is the round (Draw & Guess, Decoded, Two truths, hangman without turns: one deadline for the round) or when it takes turns (hangman in turns, Quick question: one deadline per turn). Sprint in one GIF, Mood weather and Guess who? do not time turns: their stages follow the room timer as the GIF game does today.

**Turn end.** A turn ends when its player acts (hangman: a letter or a whole-word guess; Quick question: "Done"), when the host skips it, or when `turn_ends_at` passes. Then:
- hangman in turns and Quick question: the turn passes to the next player of `turn_order` (wrapping round for hangman; for Quick question, after the last speaker the round ends `Finished`);
- a game whose round is the turn: an expired deadline ends the round as the room timer does (`TimedOut`; Two truths: `Revealed` when the statements are written, §6.8).

A delayed job (`CloseExpiredGameTurn`, one per `turn_ends_at`) ends an expired turn, and the existing lazy check of every game request (`ExpireGameRound`, run by `ResolveGamePlayer`) also checks the turn, so a late queue never shows a stale turn. A changed turn makes the job of the previous one a no-op (it compares `turn_ends_at`). The host's room timer (and the board timer of an icebreaker) is unchanged and still ends the round when it runs out.

**Skip / Done.** `POST /games/{room}/rounds/{round}/turn` with `{expected_player_id}`: the current turn's player or the host ends the turn; `expected_player_id` must be the current turn's player, else 409 "The turn has already moved on." — a double click or two hosts never skip two turns.

### 6.5 Auto hints (GM-1)

For Draw & Guess and Decoded with `auto_hints`, the round copies `hint_seconds` at start: `turn_seconds ? max(10, intdiv(turn_seconds, maxHints + 1)) : 20` (maxHints = half the letters, games spec §4.1). The start dispatches, after commit, one delayed job `RevealAutoHint(roundId, k)` per hint k = 1..maxHints at `started_at + k × hint_seconds`; the job reveals one random hidden position when the round is still active and has fewer than k revealed positions, and broadcasts `game.hint.revealed` like the leader's button (which stays). A guesser's points still depend on the hints revealed (games spec §4.6, unchanged). The round payload gains `hintSeconds`; the client shows "next letter in 0:12" from `startedAt`, `hintSeconds` and the number of revealed positions.

### 6.6 Hangman: turns and the whole word

- **In turns** (`takes_turns` on the round's room at start): a letter or a whole-word guess from a player who is not `turn_player_id` → 403 "It's not your turn." Every letter or word guess passes the turn (hit or miss). An expired turn passes it with no penalty (decision 5). Without turns, hangman plays as today.
- **Whole word**: `POST /games/{room}/rounds/{round}/word-guesses` `{text}` (1 to 50 characters; same rate limit as letters). Compared with `GuessMatch` (folded, normalised): correct → every position revealed, round `Solved`, winner = the guesser; wrong → `misses + 1` (6 misses → `Lost`). Stored as a `game_guesses` row (`is_correct`); a wrong guess is broadcast as `game.guess.made {roundId, guessId, playerId, text}` (shown in "Last moves"); a correct one is never broadcast (the round ends and the word is public then).
- **Points**: unchanged for letters (1 per position revealed by the picker's hits); the solver (by letter or by word) gets the solve bonus 5, `is_win` (decision 1: the mockup's "+50" is "+5" on the product's scale). A player whose only act was a wrong word guess gets a 0-point row.
- Round payload adds `wordGuesses: [{playerId, text}]` (the round's wrong word guesses, last 10).

### 6.7 Sprint in one GIF: caption, votes, hidden authors, podium (GM-3)

- **Caption**: `game_gif_answers.caption` (nullable, ≤ 60 characters, trimmed; empty → null). `PUT rounds/{round}/answer` takes `{gif_id, caption?}`; caption alone can change until the reveal. The caption is the viewer's own until the reveal (`myAnswer.caption`), then is part of every revealed and closed answer; `alt` of a GIF is its caption.
- **Votes**: the round copies `votes_allowed` from `gif_votes` at start. `PUT rounds/{round}/vote {answer_id}`: with one vote allowed, it replaces the player's vote (today's behaviour); with more, it adds a vote for that answer — a second vote for the same answer is a no-op, a vote beyond the budget → 409 "You have used all your votes." `DELETE rounds/{round}/vote` takes an optional `{answer_id}`: that vote, or every vote of the player without it. Self-votes stay refused (403). `game.vote.changed {playerId, voted}` says whether the player has at least one vote. The snapshot keeps `myVote` (the first of the viewer's votes, or null) and adds `myVotes: string[]` and `votesAllowed`.
- **Hidden authors**: the round copies `authors_hidden` from `gif_authors_hidden`. When set, revealed answers carry `playerId: null` until the round closes; closed answers carry their author (except in the icebreaker of an anonymous retro, where they never do, as today).
- **Podium**: closed answers of a `Revealed` round carry `rank` (competition ranking by votes: 1, 2, 3, 4, 4, 6; null when votes are null). Authors of rank 1 with at least one vote win the round (`is_win`), except in the icebreaker of an anonymous retro, where every row stays 0 and no one wins (decision 7). Points stay 2 per vote received.

### 6.8 Two truths and a lie

- **Start**: the host names the teller (`leader_player_id`, required; the UI proposes the next online player in join order, as for the drawer). The round starts in its writing stage.
- **Write**: `PUT rounds/{round}/statements {statements: [string × 3], lie_index: 0|1|2}` by the teller: three distinct statements of 1 to 120 characters. Replaceable until the first vote (then 409 "Votes have started."). Broadcast `game.statements.set {roundId, statements}` — never the lie.
- **Vote**: every player but the teller (403) picks the lie: `PUT rounds/{round}/choice {choice: "0"|"1"|"2"}` — before the statements → 409 "The statements are not written yet."; replaceable until the reveal; `DELETE rounds/{round}/choice` retracts. Broadcast `game.vote.changed {playerId, voted}`.
- **Reveal**: the host or the teller (`POST rounds/{round}/reveal`), the turn deadline, or the room timer ends the round as `Revealed` (statements written) or `TimedOut` (not written). `game.round.ended` carries `statements`, `lieIndex` and `votes: [{index, playerIds}]`.
- **Points**: a voter who found the lie 5, `is_win`; the teller 2 per voter fooled; others 0. `TimedOut` and `Passed`: 0 for the teller and every voter.
- **Secrecy**: `lie_index` is hidden on the model; before the end it reaches the teller only (`lieIndex` in the teller's snapshot and response); votes are counted to nobody, the viewer's own choice excepted (`myChoice`).

### 6.9 Mood weather

- **Start**: no leader. Five weathers (`GameWeather`): `sunny` ("Sunny"), `partly_cloudy` ("Some clouds"), `cloudy` ("Cloudy"), `rainy` ("Rainy"), `stormy` ("Stormy").
- **Pick**: every player, host included, `PUT rounds/{round}/choice {choice}`; replaceable, `DELETE` retracts, until the reveal. Broadcast `game.answer.changed {playerId, answered}` (who has picked is public, as for GIF answers).
- **Reveal**: the host (`POST reveal`) or the room timer ends the round as `Revealed`. The ended payload carries `answered` (the number of picks) and `weather: {sunny: n, …}` — or `weather: null` with fewer than 3 picks (decision 8: "Not enough answers to show the weather").
- **Anonymity**: no snapshot, response, broadcast, history or "Games we played" entry ever ties a weather to a player, the viewer's own pick excepted (`myChoice`, active round only). Each picker gets a 0-point row (round played, streak kept); no winner.

### 6.10 Guess who?

- **Start**: no leader. The server draws a prompt from `resources/games/prompts/{locale}.php` (≥ 60 prompts per locale, ≤ 200 characters, shared with Quick question), avoiding the room's last 20 questions; the host shuffles or types one until the first answer (`PUT rounds/{round}/question`, as for the GIF game).
- **Answer**: every player writes one answer (1 to 120 characters), replaceable or removable until the reveal: `PUT / DELETE rounds/{round}/text-answer {text}`. Broadcast `game.answer.changed {playerId, answered}`.
- **Reveal**: the host or the room timer opens the attribution stage (`revealed_at`), the round stays active. Broadcast `game.round.revealed {roundId, revealedAt, answers: [{id, text}]}`, answers in random order (random ids, as GIF answers), **without author**.
- **Attribute**: every player names an author for any answer but their own: `PUT rounds/{round}/attributions/{answer} {player_id}` (a player who answered in this round; not the attributor; changeable until the close), `DELETE` retracts. Broadcast `game.vote.changed {playerId, voted}` (has made at least one attribution). The viewer receives their own attributions only (`myAttributions`, pairs of answer and player).
- **Close**: the host (`POST close`), the room timer during the attribution stage, or the host starting the next round ends the round as `Revealed`. `game.round.ended` carries `answers: [{id, text, playerId, foundBy: [playerIds]}]`.
- **Points**: 2 per correct attribution; attributors with the most correct attributions (at least one) win; authors get a 0-point row.
- **Not available** in the icebreaker of an anonymous retro (decision 6).

### 6.11 Quick question

- **Start**: the server draws a prompt (§6.10's bank); `turn_order` required; the first speaker's turn starts; with `turn_seconds` (the card's "Time per person", from the list of §6.2), each turn has its deadline; untimed otherwise.
- **Speak**: answers are spoken aloud, nothing is typed. The current speaker ("Done") or the host ("Next") ends the turn (§6.4). The host can change the question until the first turn ends.
- **End**: after the last speaker → `Finished`; the room timer → `TimedOut`; "Pass" → `Passed`. Every player whose turn came gets a 0-point row; no winner.

### 6.12 Scores (additions to games spec §4.6)

| Game | Outcome | Points |
|---|---|---|
| Hangman | `Solved` by a whole-word guess | the guesser: their letter points plus 5, `is_win`; a wrong word guess alone: 0 |
| Sprint in one GIF | `Revealed` | unchanged (2 per vote received); authors of rank 1 with ≥ 1 vote: `is_win` (not in an anonymous retro's icebreaker) |
| Two truths | `Revealed` | voter who found the lie: 5, `is_win`; teller: 2 per voter fooled; other voters 0 |
| Two truths | `TimedOut`, `Passed` | 0 for the teller and every voter |
| Mood weather | `Revealed` | 0 for every picker |
| Guess who? | `Revealed` | 2 per correct attribution; best attributors (≥ 1 correct): `is_win`; authors without attributions: 0 |
| Quick question | `Finished`, `TimedOut`, `Passed` | 0 for every player whose turn came |

### 6.13 Tables and columns

Migrations dated `2026_10_27_…`, Schema builder only, `up` only:

- `game_rooms`: the seven columns of §6.2.
- `game_rounds`: `number` (small unsigned, nullable), `rounds_total` (tiny unsigned, nullable), `turn_order` (JSON, nullable; null = no turns), `turn_player_id` (UUID, nullable, foreign key to `game_players`, null on delete), `turn_ends_at` (`dateTime`, nullable), `turn_seconds` (small unsigned, nullable), `hint_seconds` (small unsigned, nullable), `votes_allowed` (tiny unsigned, default 1), `authors_hidden` (boolean, default false), `statements` (JSON, nullable), `lie_index` (tiny unsigned, nullable).
- `game_gif_answers.caption` (string 60, nullable).
- `game_gif_votes`: unique (`game_round_id`, `voter_player_id`, `answer_id`) added, then unique (`game_round_id`, `voter_player_id`) dropped (in that order, so that MySQL always has an index for the round's foreign key).
- `game_choices` (new): `id`, `game_round_id` (cascade), `player_id` (cascade), `choice` (string 20), timestamps; unique (`game_round_id`, `player_id`). Two truths (the lie) and Mood weather (the weather).
- `game_text_answers` (new): `id` (random UUID, not time-ordered), `game_round_id` (cascade), `player_id` (cascade), `text` (string 120), timestamps; unique (`game_round_id`, `player_id`).
- `game_attributions` (new): `id`, `game_round_id` (cascade), `guesser_player_id` (cascade), `answer_id` (to `game_text_answers`, cascade), `author_player_id` (cascade), timestamps; unique (`game_round_id`, `guesser_player_id`, `answer_id`).

JSON columns are nullable without a database default (rule 5); the model reads null as an empty list. Round pruning (last 20) takes the new rows with it by cascade.

### 6.14 Secrecy (additions to games spec §8)

- `lie_index` joins `word` and `picked_by` in `GameRound::$hidden`; it reaches the teller only before the end.
- A Mood weather pick never leaves the server with its author; a Guess who? answer leaves with its author only once the round closed; attributions are known to their author only until the close.
- GIF answers, captions included, are never serialised before the reveal; with hidden authors, a revealed answer has no author until the close.
- Hangman whole-word guesses that are correct are never serialised.
- Every new payload goes through the rules' `presentActive`, `presentEnded` and `endedPayload`, and every new test walks the snapshot of each viewer and each broadcast (the `gamePayloadExposesWord` pattern).

## 7. Permissions

| Action | Who |
|---|---|
| Change a room's game settings (§6.2) | room managers: the host, the creator, workspace Owners/Admins (standalone); the facilitator and workspace Owners/Admins (icebreaker, `GameRoom::isManager`), in any phase, as the language today. Guests never |
| Start a round, reveal, close, change the question, skip a turn | host (Two truths reveal: host or teller; turn end: host or the turn's player) |
| Write the statements | the teller |
| Pick a letter, guess the word | any player; in turns, the turn's player |
| Vote the lie | any player but the teller |
| Pick a weather, answer Guess who?, attribute, vote a GIF | any player, guests included (not one's own answer) |

## 8. Real time

New events (on the room's channel, `game.*`): `game.turn.changed {roundId, turnPlayerId, turnEndsAt}` (a turn ended by act, skip or time), `game.statements.set {roundId, statements}`. Reused with new uses: `game.letter.picked` (adds `turnPlayerId`, `turnEndsAt`), `game.guess.made` (hangman wrong word guesses), `game.answer.changed` (Mood pick, Guess who answer), `game.vote.changed` (GIF budget, Two truths vote, Guess who attribution), `game.round.revealed` (Guess who answers), `game.question.changed` (Guess who, Quick question), `game.hint.revealed` (auto hints), `game.room.changed` (settings). The client adds the two new events to `use-game-channel.ts` and handles every reused event by the round's game.

## 9. Screens

All in the existing room page (`games/show`) and the retro's icebreaker stage, through `GameLayout` and `useRoomPanels`; no new page.

### 9.1 Game picker (ScreenIcebreaker, IcebreakerGameCard)

Eight cards (the six of the mockup — Decoded as "Sprint in emojis" is the existing game — plus Draw & Guess and Sprint in one GIF, which the mockup's room screens show chosen upstream). Each card has the mockup's icon and colour (pre-build deviation for the colours, where the mockups disagree). An unavailable card shows its reason ("Not available"; Guess who? in an anonymous retro: "Not in an anonymous retro"). The same eight in the "New session" dialog's icebreaker fields (pitches), the team page's room rows and the leaderboard tiles, the history and "Games we played".

### 9.2 Settings card (GM-1)

`GameSettingsCard`, under the picker (hangman, Decoded, the new games: "Game settings") or at the foot of the players column (Draw & Guess: "Round settings"; Sprint in one GIF: "Game settings"), as the mockups place it; in the chooser sheet below the game cards on narrower screens. Shown to room managers only. Controls, by game (§6.2): `Select` "Word theme" / "Word list" (All words + the four themes), a categories popover with checkboxes for Decoded ("n chosen"), `Select` "Time per turn" / "Time per round" / "Time per person" (Off, 15 s … 180 s), `Switch` "Auto hints", `Switch` "Take turns", `Select` "Rounds" (Endless, 3, 5, 6, 8, 10), `Select` "Votes" ("1 each", "2 each", "3 each"), `Switch` "Hide authors until the votes close", `Switch` "Guests allowed" (standalone; turning it off asks the existing "Guests in this room lose access." confirmation). Each control saves on change (optimistic, rolled back with a toast on error); a note "Changes apply from the next round." while a round is in play. The room settings dialog (name, access, language, reactions) stays.

### 9.3 Round line, turn timer, turn order (GM-2)

- **Round line** (`roundInfo` place, above the stage title): "Round 2 of 3 · Theme: Team & tech" (fr "Manche 2 sur 3 · Thème : …"); "Round 7" when endless; nothing for a round without a number. A standalone room's header also shows "Round 3 / 6" beside the game badge (ScreenIcebreakerDraw topbar).
- **Turn timer**: `Timer size="lg"` read-only on the stage, counting to `turnEndsAt` ("Arnaud's turn 0:18", "left this turn 0:44", "left 0:38"); absent when the round has no deadline.
- **Turn order** (`turnOrder` place): "Speaking order" (hangman, right column, under the scores), "Drawing order" (Draw & Guess, left column, under the players), "Order of tellers" (Two truths), "Speaking order" (Quick question): avatars in order, the current one ringed, the past ones faded, then "Next: Inès · 30 s per turn" (without "· …" when untimed). For Draw & Guess and Two truths the order is the client's rotation (`nextLeaderId` over the online players), for the turn games the round's `turnOrder`.
- **Game over**: after the last numbered round, the end card's title is "Game over" and the host's button "New game".

### 9.4 Hangman (ScreenIcebreaker)

In turns: the banner "Your turn, Arnaud — pick a letter" (`ib-turn`, primary soft) or "Inès's turn" above the keyboard; out of turn the keyboard is disabled (`is-disabled`) with "Inès's turn" (phone: the docked keyboard too). Under the keyboard: "Guess the whole word (+5 pts, −1 life if wrong)" field and "Guess" (disabled out of turn); a wrong guess shakes the field and is announced (`role="status"`). "Last moves" adds "Théo tries LAPTOP — missed". Phone: the word-guess field sits above the docked keyboard.

### 9.5 Draw & Guess and Decoded (ScreenIcebreakerDraw, ScreenIcebreakerEmoji)

Settings card, drawing order, round line, turn timer; under the mask "next letter in 0:12" when auto hints are on ("Hint · 2 words" stays). The manual hint button stays for the leader.

### 9.6 Sprint in one GIF (ScreenIcebreakerGif)

Step 1, "Your pick": the preview, "Caption" field with "20 / 60" counter, "Send my GIF" / "Change"; badge "Draft" before sending. Step 2/3 left column: "Your votes 2 / 2 used" (`VoteDots`), participants "voted". Gallery: caption under each GIF, heart toggle per tile (`sk-vote-btn`, `is-mine`, disabled on one's own GIF and when the budget is used), author shown or hidden per the round. After the close: the winner card ringed in primary with the "Winner" tag (crown), the vote count; right column "This sprint's GIF" ("Malik wins the round", "“CI on Friday at 6 pm” · 5 votes out of 12") and the ranking 2..n with ties (`gifPodium` place); "New round" (existing). No "Pin to the retro".

### 9.7 Two truths and a lie (no stage mockup: built on the shared grid `.g-*`)

Left: players and "Order of tellers"; right: scores. Stage: teller — three text fields "Statement 1/2/3", a radio "This one is the lie" per field, "Send"; others — "Inès is writing…" then three statement cards (`sk-card`, large text), each a radio "It's the lie!" with the viewer's choice marked, "n of m voted"; host and teller: "Reveal the lie". After the end: the lie card marked "Lie" (destructive soft), the truths "True", the voters' avatars under each card, points on the end card.

### 9.8 Mood weather (no stage mockup)

Stage: "What's the weather of your mood?" and five large weather buttons (lucide `sun`, `cloud-sun`, `cloud`, `cloud-rain`, `cloud-lightning`, label under each) as a radiogroup; "Answers are anonymous." badge; "n have answered"; host: "Show the weather". After: a horizontal bar per weather (`sk-progress`, count), or "Not enough answers to show the weather (3 needed)." Right column: scores (all 0, rounds played). The left column has the picker as hangman (game choice variant).

### 9.9 Guess who? and Quick question (no stage mockup)

Guess who? — stage: the prompt banner (host: shuffle / edit until the first answer, as the GIF question banner), the answer field (120, counter) and "Send"; "n have answered"; host "Reveal the answers". Attribution stage: the answers as cards in random order, each with a `Select` "Who wrote this?" (the players who answered, minus the viewer; the viewer's own card says "Your answer"); "n attributing"; host "Show the authors". After: each card with its author and the avatars of who found them; points.
Quick question — stage: the prompt banner, the speaker's avatar large with "Inès is speaking" and the turn timer, "Done" (speaker) / "Next" (host), the speaking order; host: "Another question" until the first turn ends. After: "Everyone has spoken." on the end card.

### 9.10 Elsewhere

The six per-game maps of the front gain the four games: `components/skrum/icebreaker-game-card.tsx` (colours, icons, art), `components/games/room-header.tsx` (icons), `components/skrum/games-leaderboard.tsx` (tile style), `components/retro/results/games-played.tsx` (icons; a row per round: the prompt or "Mood weather", the outcome), `components/teams/session-create/icebreaker-session-fields.tsx` (pitches), `lib/games/types.ts`. `round-detail.tsx` (history) shows the ended state of each new game. `lib/games/outcomes.ts` labels `finished` ("Everyone has spoken").

States of every new screen: waiting to start (host: Start with its leader or order; others: "Waiting for the host to start."), waiting for players (under the minimum), active (each stage), ended (end card), reconnecting (existing banner), read-only (a retro player watching the choice), guest, phone (columns in sheets, the stage's main control docked at the bottom as the hangman keyboard), reduced motion (no shake, no confetti).

## 10. Migrations of existing data

- Existing rooms receive the "Existing rooms" values of §6.2 by the columns' defaults and nulls: they play exactly as before (no turns, untimed turns, no themes, no auto hints, endless, one vote, authors at the reveal).
- Existing rounds get `number` null, no turn, `votes_allowed` 1, `authors_hidden` false: an active round at the upgrade finishes as it started.
- Existing GIF votes stay; the new unique key holds them (one per round and voter is a stricter case of one per round, voter and answer).
- Existing points, leaderboards and histories are unchanged. No backfill is needed: no derived column, no data rewritten. An `Upgrade` test proves the migration on legacy rows on the four engines.
- The word files change format; `game_used_words` rows stay valid (the words are the same strings).

## 11. Routes

New, under `games/{room}` (middleware `ResolveGamePlayer`, JSON, `whereUuid`):

| Method | Path | Controller | Name |
|---|---|---|---|
| POST | `rounds/{round}/turn` | `GameTurnsController@store` | `games.rounds.turn.store` |
| POST | `rounds/{round}/word-guesses` | `GameWordGuessesController@store` | `games.rounds.wordGuesses.store` |
| PUT | `rounds/{round}/statements` | `GameStatementsController@update` | `games.rounds.statements.update` |
| PUT, DELETE | `rounds/{round}/choice` | `GameChoicesController@update`, `@destroy` | `games.rounds.choice.update`, `.destroy` |
| PUT, DELETE | `rounds/{round}/text-answer` | `GameTextAnswersController@update`, `@destroy` | `games.rounds.textAnswer.update`, `.destroy` |
| PUT, DELETE | `rounds/{round}/attributions/{answer}` | `GameAttributionsController@update`, `@destroy` | `games.rounds.attributions.update`, `.destroy` |

Changed: `PATCH /games/{room}` (settings), `POST rounds` (`turn_order`), `PUT rounds/{round}/answer` (`caption`), `PUT / DELETE rounds/{round}/vote` (budget, `answer_id` on delete), `POST rounds/{round}/reveal` and `POST rounds/{round}/close` (any staged game), `PUT rounds/{round}/question` (any game that asks questions). Rate limits: the per-player `game-play` bucket (3 then 1/s) for votes, choices, attributions, text answers, statements, word guesses and turns; letters keep theirs.

## 12. Testing

Pest feature tests under `tests/Feature/Games/*` (new files per subject), unit tests for pure rules, `tests/Upgrade/GameSettingsUpgradeTest.php`, and races under `tests/Concurrency`: the GIF vote budget under concurrent votes; two "Done"/"Next" at once advance one turn; a double click on a hangman letter in turns picks one letter; two first picks of a weather keep one row. Per task: the tests run on PostgreSQL and SQLite; the Upgrade test and the races on the four engines; whole suites at merges and on the four engines at the end. Vitest for every new component and pure function. No browser walkthrough; captures in light, 1440, French only.

## 13. Acceptance criteria

1. A room manager changes word themes, time per turn, auto hints, take turns, number of rounds, GIF votes and hidden authors from the settings card; a player who is not a manager, and a guest, get 403; values outside §6.2 get 422; a change reaches every player through `game.room.changed`.
2. An existing room plays exactly as before the release until a setting is changed (no turn, no turn deadline, endless, one GIF vote, authors from the reveal); a new room starts with turns in hangman, two GIF votes and hidden authors.
3. Words come only from the chosen themes; a used-up themed pool is reset without forgetting the other themes' used words.
4. Rounds are numbered within a game; with a number of rounds, the end of the last one shows "Game over" and the next start is round 1; a game switch starts at 1.
5. With a time per turn, the server ends each turn on time (job and lazy check), in rooms and icebreakers, without touching the room timer; a stale turn job does nothing.
6. In hangman with turns, only the turn's player can pick a letter or guess the word; every act and every expired turn pass the turn; the host can skip a turn; two skips at once move one turn.
7. A correct whole-word guess solves the round for its guesser (+5, win); a wrong one costs a life and appears in "Last moves"; a correct guess text is never broadcast.
8. With auto hints, letters are revealed on schedule up to half the word, and the "next letter" countdown matches.
9. A GIF answer carries a caption of up to 60 characters, hidden until the reveal; a player uses up to the round's vote budget, never on their own GIF, and never more under concurrent requests; with hidden authors no revealed answer names its author before the close; a closed round ranks the GIFs with ties and its top authors win (not in an anonymous retro's icebreaker).
10. Two truths and a lie, Mood weather, Guess who? and Quick question follow §6.8 to §6.11, in standalone rooms and in the icebreaker, with the points of §6.12.
11. The lie, a weather's author, a Guess who answer's author before the close, another player's attributions and votes never reach a viewer who should not see them (every snapshot, response and broadcast tested).
12. Mood weather shows no distribution under 3 picks; Guess who? is unavailable in the icebreaker of an anonymous retro.
13. The settings card, round line, turn timer, turn order, hangman turn banner and word field, GIF caption, votes and podium match their mockups (captures light/1440/fr), and every other difference is a pre-build deviation approved by the owner.
14. The eight games appear in the picker, the session-create icebreaker fields, the team page, the leaderboard, the history and "Games we played".
15. The snapshot keeps a constant query count with the new games.
16. Every new string exists in en, fr, es, de, in the informal register; suites, PHPStan, type-check, lint and build pass; the migration passes the Upgrade test on the four engines.

## 14. Risks

- **Size.** Four engines plus three features: the largest plan of the roadmap. Mitigation: a single-writer foundation (enums, schema, settings, turns, staged games, front maps), then one lane per game.
- **The interface grows.** `GameRules` gains three methods and two optional interfaces; every existing rules class changes. Mitigation: the existing feature tests of the four games run after the foundation tasks, unchanged.
- **Turn timing.** Jobs, lazy checks and two timers (room and turn) interact; an off-by-one or a stale job could skip a turn. Mitigation: the job compares `turn_ends_at`; races and `travelTo` tests.
- **Turn order from the client.** A host's client that sends a wrong order (a player offline) stalls a turn until it expires or is skipped. Accepted, as the drawer proposal today; the host's "Skip" and the turn timer recover.
- **MySQL unique swap** on `game_gif_votes`: dropping the index the foreign key uses would fail. Mitigation: add the new unique first, then drop the old; Upgrade test on MySQL.
- **Content.** Word themes in four languages and a 60-prompt bank in four languages are content work, reviewed by the translation pass; the dictionary tests pin counts, lengths and characters.
- **Anonymity.** Mood weather with few players tells who picked what by elimination; the threshold of 3 reduces, not removes, it (accepted as for the GIF game).
- **Shared files** across lanes: `routes/web.php`, `AppServiceProvider` (the registry list), `lang/*.json`, `tests/Pest.php`, `game-stage.tsx`, `round-detail.tsx`, `room-reducer.ts`. Mitigation: the foundation registers routes and maps for every game; each lane adds its own lines in marked blocks.
- **Plans 21 to 26 run before or beside** this one and touch `lang/*.json`, `routes/web.php` and the retro board; conflicts at merge only.

## 15. Decisions for the owner

The body above is written on the option marked **recommended**.

**1. Points of the whole-word guess (the mockup says "+50 pts", the product scores 1 per letter and 5 for solving).**
- A. **Recommended.** Keep the product's scale: a correct word earns the solve bonus (+5) and the field reads "+5 pts". Leaderboards stay comparable with every round played so far.
- B. Multiply every game's points by 10 from the release (letters 10, solve 50, guesser up to 100…); old rows kept as they are, so leaderboards mix both scales for 30 days.
- C. As B, and multiply the stored points by 10 in a migration so that leaderboards stay consistent; rewrites every `game_points` row.

**2. Turns in hangman.**
- A. **Recommended.** A "Take turns" switch: on for rooms created after the release (the mockup), off for existing rooms (today's free-for-all kept).
- B. Always in turns, existing rooms included (the free-for-all goes).
- C. A switch, off by default everywhere.

**3. Number of rounds by default.**
- A. **Recommended.** Endless by default (today's behaviour); the host picks 3, 5, 6, 8 or 10 in the card, and "Round n of m" appears then.
- B. A default per game as the mockups show (hangman 3, Draw & Guess 6, Decoded 8, others 5).
- C. Equal to the number of players at start (each draws or tells once), recomputed per game.

**4. The word themes.**
- A. **Recommended.** Four themes for every word game: Team & tech, Everyday objects, Food, Nature & animals; hangman's "Team tools" and Draw's "Team & tech" of the mockups both read "Team & tech".
- B. Two themes from today's split: "Team & tech" (abstract words) and "Everyday things" (drawable words); no content work, but Draw & Guess could not use "Team & tech".
- C. The mockups' labels per game (hangman "Team tools", Draw "Team & tech", Decoded "Films · Team"); needs a film list and three partitions.

**5. A hangman turn that runs out.**
- A. **Recommended.** The turn passes, nothing else.
- B. It counts as a miss (−1 life), as a wrong letter.

**6. Guess who? in the icebreaker of an anonymous retro.**
- A. **Recommended.** Not available there ("Not in an anonymous retro"): the game's point is to reveal authors.
- B. Available; authors are revealed at the close as in any room (the players write knowing it).

**7. A winner in Sprint in one GIF.**
- A. **Recommended.** The author(s) of the most-voted GIF (at least one vote) win the round (`is_win`), as the mockup's "Winner"; not in an anonymous retro's icebreaker.
- B. The "Winner" tag is shown, but no win is counted in the leaderboards (today: GIF rounds give no win).

**8. Mood weather with few answers.**
- A. **Recommended.** The weather is shown from 3 picks; under that, "Not enough answers to show the weather (3 needed)" (the threshold the surveys use).
- B. Always shown (as the GIF game's accepted residual risk).

**9. The rules of Two truths and a lie and Guess who? (no mockup beyond the picker).**
- A. **Recommended.** Two truths: one teller per round writes three statements, the others vote the lie (§6.8). Guess who?: everyone answers one prompt, then everyone names the author of each answer (§6.10).
- B. Two truths: every player writes their three statements before the game, one player's set per round, no writing stage. Guess who?: one answer per round, picked at random among those sent, and the others vote for its author (one choice, no matching).

**10. Quick question.**
- A. **Recommended.** Spoken turns ("2 min / pers." of the mockup): a prompt, a speaking order, a turn timer, "Done" / "Next"; nothing typed, no points.
- B. Written: every player types a short answer, all shown together at the reveal (a wall), no turns.

## 16. Not determined by reading

- Whether MySQL's foreign key of `game_gif_votes.game_round_id` uses its own index or the unique key (decides only whether the order of §6.13 is needed; the order is safe either way).
- Whether `ReverbGamePresenceRoster` could tell the server who is online in an icebreaker (it is used for the standalone cap); this spec does not depend on it.
- The existing `Timer` (`components/skrum/timer.tsx`) takes `remainingSeconds`, `totalSeconds` and optional handlers; whether it renders no control at all when no handler is given was not checked line by line (the plan's Task 16 checks it).
- Whether the six-game grid of the mockup's picker (two columns of 340 px) keeps eight cards on screen at 1440 without scrolling; the capture will tell (a deviation row otherwise).
- Whether the owner wants the existing French labels ("Pendu", "Dessine et devine") aligned with the mockups ("Le pendu", "Dessin à deviner"): a key keeps its value unless the owner says so (pre-build deviation P27-02).
- Whether the retro's icebreaker stage shows the settings card to the facilitator in the same place as a room (the plan follows `useRoomPanels`, which both share).
