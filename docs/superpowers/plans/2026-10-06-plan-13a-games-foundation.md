# Plan 13a — Game rooms, engine and Hangman Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every team gets standalone game rooms (team-only or open by link, at most 10 per team, at most 12 players online) with one shared, server-authoritative round engine — word dictionaries in en/fr/es/de, round start/end, points, retention, host timers with server-side expiry — and the first complete game, **Hangman**, playable end to end in the browser, without the secret word ever reaching a client before the round ends.

**Architecture:** Every table of spec §2 is created now (`game_rooms`, `game_players`, `game_rounds`, `game_guesses`, `game_gif_answers`, `game_gif_votes`, `game_points`, `game_used_words`, `retros.icebreaker_game`) so Plans 13b–13d only add code. Players mirror poker players (own table, `HasGuestIdentity`, scoped `GuestCookie`); a player can also stand for a retro participant (icebreaker rooms, wired by 13d). The engine is game-agnostic: `StartGameRound`, `EndGameRound` (the only way a round ends), `AwardRoundPoints`, `ExpireGameRound` and `ScheduleRoundExpiry` delegate every game-specific decision to a `GameRules` implementation looked up in `GameRulesRegistry` (13a registers `HangmanRules`; 13b/13c append theirs). All redaction lives in `BuildGameSnapshot`, `PresentGameRound` (active round, per viewer), `PresentGameRoundHistory` (ended rounds) and the rules' `present*` methods. Realtime uses `presence-game.{roomId}` (or the retro channel for icebreaker rooms) through `GameBroadcastEvent` subclasses. The frontend is a new `resources/js/components/games/` tree driven by `useGameRoom` (snapshot + reducer + buffered refetch, modelled on `usePokerGame`), with a `handleEvent` entry point so the retro board (13d) can feed it events from its own channel.

**Tech Stack:** Laravel 13 (PHP 8.4), PostgreSQL (jsonb), Pest, Reverb (Pusher HTTP API for the player cap), React 19, Inertia v3, `@laravel/echo-react`, Wayfinder, Tailwind 4, lucide, Radix dialog/select/dropdown/sheet (all already installed).

**Spec:** `docs/superpowers/specs/2026-09-29-games-design.md` — §2 (all of it), §3 (standalone rooms, joining, 12-player cap; the icebreaker room's player resolution and host rule), §4 common rules, §4.3 Hangman, §4.5 words, §4.6 scores (engine + Hangman rows), §5 timers (standalone rooms; the expiry hook the icebreaker reuses), §7 (routes, channels, snapshot and events listed in the Task 4–10 interfaces), §8 (secret word, rate limits), §9 (team Games page without the leaderboard, room page shell, Hangman, guest join page), §10, §12 tests for rooms, access, player cap, secrecy (Hangman), Hangman, words, timers, retention, snapshot, Hangman scores; §13 criteria 1, 2, 3 (Hangman and the shared engine), 4 (Hangman), 6, 7 (rooms), 9, 11 (for this plan's strings). Plans 13b (Draw & Guess, Decoded), 13c (Sprint in one GIF) and 13d (icebreaker, leaderboards and streaks, `results.games`, room invites) deliver the rest. Parent: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md`.

## Global Constraints

- Work on branch `feat/plan-13-games`, created from the tip of `feat/plan-12-integrations` (spec 6 plans 12a–12d implemented first). Plans 13b–13d continue on the same branch.
- Commands through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse --no-progress` (level 7, 0 errors). npm on the host. Shells need `export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH"`.
- Tests run on PostgreSQL (the Sail `testing` database). Every table uses a UUID primary key except `game_used_words` (composite key, no `id`); `tests/Feature/UuidPrimaryKeysTest.php` must stay green.
- Migration filenames use the prefix `2026_10_06_1000xx`; only `up()` methods.
- No new Composer or npm dependency. Drawing (13b) uses the browser Canvas 2D API.
- **Request fields are snake_case**, like every existing endpoint (`name`, `game`, `access`, `locale`, `player_id`, `seconds`, `letter`, `leader_player_id`); the spec's camelCase body names map one-to-one (`playerId` → `player_id`, `leaderPlayerId` → `leader_player_id`). Response and broadcast payloads are camelCase exactly as spec §7.
- JSON responses are bare payloads (no `{room}` / `{round}` envelopes), as in poker.
- Every mutation: resolve the player (middleware, which also applies the lazy timer expiry) → cheap guards on the route-bound room → `DB::transaction` with `GameRoom::query()->whereKey(...)->lockForUpdate()->firstOrFail()` (round mutations also lock the round) → the same guards again on the locked rows → persist → broadcast with `->sendToOthers()` (after commit, `toOthers()`, report-don't-throw via `App\Events\Concerns\SendsToOthers`). Guard order: `GameGuard::mutable` (icebreaker phase/lock) → role (403) → round state (409) → input (422).
- **The secret word leaves the server only through** `PresentGameRound` for the round's leader (13b), `EndGameRound`'s `game.round.ended` payload, `PresentGameRoundHistory` and the round detail endpoint of an ended round. `GameRound::$hidden` holds `word` and `picked_by`. No log line contains a word. `tests/Pest.php` gains `gamePayloadExposesWord()` in Task 1; Task 11 and Plans 13b/13c use it.
- Guests never receive team or workspace data: `links.team` is `null` for guests; guests cannot reach `teams.*` pages or the team Games page (the `w/{workspace}` group already requires `auth`).
- Every user-facing string via `t()` / `__()` with real translations in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"), appended at the end of each file, keeping every existing value. Each task lists its own rows; add only keys that are missing at execution time. Game words, GIF questions and guest names live in `resources/games/*` and are **not** translation keys. `tests/Feature/TranslationKeysTest.php` stays green.
- Wayfinder: run `vendor/bin/sail artisan wayfinder:generate --with-form` after every route change. `resources/js/actions` and `resources/js/routes` are gitignored — never stage them. Frontend imports use the generated controllers (`@/actions/App/Http/Controllers/Games/…`), never hard-coded URLs.
- Frontend checks: `npm run types:check && npm run check` (known pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`). Format only touched files with `npx vp check --fix <paths>`.
- React: function components, `type Props`, no default exports except pages, Tailwind, lucide icons, `useRoom()` for room state, `retroRequest()` from `@/lib/retro/api` for JSON calls (it adds `X-Socket-ID`), `usePage().props.locale` for `Intl` formatting.
- PHP: constructor promotion, typed everything, array-shape docblocks on presenter return values, early returns, curly braces, no comments restating code, class constants in PascalCase. Test helper functions are global in Pest: every new helper name below is unique in `tests/`.
- Never run two implementer subagents concurrently (shared git index).
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`

## Spec amendments made with this plan

Plan writing found gaps in spec §7 "Snapshot" and §2; these are decisions of this plan, to be copied into the spec before 13b starts:

- `room` also carries `isIcebreaker`, `canDelete` (creator or workspace Owner/Admin, standalone), `canBecomeHost` (creator or Owner/Admin who is not the host, standalone) and `currentRoundId` (so the client shows the end card of the last round after a refetch).
- The snapshot carries `me: {playerId, userId, isGuest}`, `games: [{value, label, available}]` (the game switcher; `available` is false for kinds without rules yet or without a GIF provider), `links: {team, retro}` (team for members of standalone rooms, retro for icebreaker rooms) and `serverTime` (UTC, `Y-m-d\TH:i:s.v\Z`), as the poker snapshot does.
- `history` rows and the round detail endpoint also carry `leaderPlayerId` and `winnerPlayerId` (13d's `BuildGamesPlayed` builds `leader` / `winner` objects from them).
- The Hangman round payload is `{mask, misses, maxMisses, pickedLetters}`; `picked_by` is never serialized.
- `game.round.ended` carries `roundId, outcome, word, winnerPlayerId, leaderPlayerId, points` plus the keys a game's rules add (13c: `answers`). The actor of the ending request receives the same payload in the HTTP response (`ended`), since `toOthers()` skips them.
- Retention keeps the newest 20 **ended** rounds; it runs when a round is created, so a room holds at most 20 ended rounds plus its active one.
- A timer expiry applies to a round only when the timer ended after the round's expiry anchor (its `started_at`, or 13c's reveal time): a timer that ran out before the round started never ends it (§5 "A timer that expires with no active round only plays the existing feedback").
- New rooms are created with an available game only (422 "This game is not available." otherwise); the `draw` column default stays for rows created without a game.
- `PATCH /games/{room}` answers 204; clients refetch on `game.room.changed` (the actor refetches after the response).
- Guest names come from `resources/games/guest-names/{locale}.php` with grammatical gender for fr/es/de ("Loutre joyeuse", "Fröhlicher Otter").

## Review Focus

1. **A timer that ran out before the round started** (host set 1 min, waited, then pressed Start) → the new round is not ended by the lazy check or a stale job; it keeps running until a new timer expires. Pinned in Task 9 ("does not end a round started after the timer ran out").
2. **Two hosts' tabs pressing Start at the same time, or Start while a round is active** → exactly one round is created; the other request gets 409 "A round is already in progress." and no second word is drawn. Pinned in Task 8 ("refuses a second start while a round is active") and by the room lock.
3. **The last pick solves the word while another player picks a letter in the same instant** → the second pick gets 409 "This round is over.", no second end, no duplicate points. Pinned in Task 10 ("refuses a pick after the round ended") and Task 8 ("ends a round only once").
4. **Access revoked mid-game** — a guest after the link was regenerated or the room switched to team-only, a member removed from the team — gets 403/401 on the next request and presence auth refused; a retro or poker guest cookie never opens a game room. Pinned in Task 5 ("revokes guests when the link is regenerated or access becomes team-only", "keeps game guest cookies apart from retro and poker cookies").
5. **Accented and apostrophe words in Hangman** (`é` revealed by `e`, `l'` style separators given in the mask, uppercase German nouns) → picks are case- and accent-insensitive, separators are shown from the start and never count as letters to find. Pinned in Task 3 (`GameWordTest`) and Task 10 ("reveals accented letters with their plain letter").

## File map

| Area | Files |
|---|---|
| Schema & models | `database/migrations/2026_10_06_100000_create_game_tables.php`, `database/migrations/2026_10_06_100100_add_icebreaker_game_to_retros_table.php`; `app/Enums/{GameKind,GameRoomAccess,GameRoundOutcome}.php`; `app/Models/{GameRoom,GamePlayer,GameRound,GameGuess,GameGifAnswer,GameGifVote,GamePoint,Retro,Team}.php`; `database/factories/{GameRoomFactory,GamePlayerFactory,GameRoundFactory,GameGuessFactory,GameGifAnswerFactory,GameGifVoteFactory,GamePointFactory}.php`; `app/Actions/Retros/GuestCookie.php` |
| Dictionaries | `resources/games/words/{en,fr,es,de}.php`, `resources/games/gif-questions/{en,fr,es,de}.php`, `resources/games/guest-names/{en,fr,es,de}.php`; `app/Support/Games/{GameWordBook,GuestNames}.php` |
| Words | `app/Support/Games/GameWord.php`; `app/Actions/Games/DrawGameWord.php` |
| Engine contract & presenting | `app/Support/Games/{GameRules,GameRulesRegistry}.php`; `app/Events/Games/{GameBroadcastEvent,GameRoomChanged,GameRoomDeleted,GameTimerChanged,GameRoundStarted,GameRoundEnded,GameLetterPicked}.php`; `app/Actions/Games/{PresentGamePlayer,PresentGameRound,PresentGameRoundHistory,BuildGameSnapshot}.php`; `app/Providers/AppServiceProvider.php` |
| Access | `app/Actions/Games/{FindGamePlayer,GameGuard}.php`; `app/Http/Middleware/ResolveGamePlayer.php`; `app/Http/Controllers/Games/{GameRoomsController,GameSnapshotsController}.php`; `app/Http/Controllers/GameJoinsController.php`; `app/Contracts/GamePresenceRoster.php`; `app/Support/Games/ReverbGamePresenceRoster.php`; `app/Http/Controllers/BroadcastAuthorizationsController.php`; `routes/web.php` |
| Rooms | `app/Actions/Games/{CreateGameRoom,PresentGameRoomSummary}.php`; `app/Http/Controllers/TeamGameRoomsController.php`; `app/Http/Controllers/Games/{GameGuestTokensController,GameHostsController}.php`; `app/Policies/TeamPolicy.php` |
| Engine | `app/Actions/Games/{StartGameRound,EndGameRound,AwardRoundPoints,PassGameRound,SwitchGame}.php`; `app/Http/Controllers/Games/{GameRoundsController,GameRoundPassesController,GameSwitchesController}.php` |
| Timers | `app/Actions/Games/{ExpireGameRound,ScheduleRoundExpiry}.php`; `app/Jobs/CloseExpiredGameRound.php`; `app/Http/Controllers/Games/GameTimersController.php` |
| Hangman | `app/Support/Games/{HangmanRules,GameRateLimit}.php`; `app/Actions/Games/PickGameLetter.php`; `app/Http/Controllers/Games/GameLettersController.php` |
| Frontend core | `resources/js/lib/games/{types,room-reducer,outcomes}.ts`; `resources/js/hooks/{use-game-channel,use-game-room}.ts`; `resources/js/components/games/room-context.tsx` |
| Frontend room UI | `resources/js/pages/games/{show,join,index}.tsx`; `resources/js/components/games/{game-room,game-panel,game-board,room-header,game-switcher,room-timer,players-list,start-round-controls,round-end-card,history-drawer,round-detail,room-menu,room-settings-dialog,delete-room-dialog,room-gone,room-full,word-mask,hangman-board,hangman-figure,letter-keyboard,room-card,new-room-dialog}.tsx`; `resources/js/app.tsx`; `resources/js/pages/teams/show.tsx`; `resources/js/types/{games,index}.ts` |
| Tests | `tests/Pest.php`; `tests/Unit/Games/GameWordTest.php`; `tests/Feature/Games/{GameModelTest,DictionaryTest,DrawGameWordTest,GameSnapshotTest,GameEventsTest,GameAccessTest,GameJoinTest,GameBroadcastAuthorizationTest,ReverbGamePresenceRosterTest,GameRoomsTest,GameRoundEngineTest,GameTimerTest,HangmanTest,GameRedactionTest}.php` |
| Translations | `lang/{en,fr,es,de}.json` (rows inside each task) |

## Contract for Plans 13b–13d

Plans 13b–13d build on exactly these products; renaming any of them breaks them.

**Schema (Task 1).** Every column of spec §2 exists with these types: `game_rooms` (`id, team_id, retro_id (unique, nullable), name (60, nullable), created_by_user_id, host_player_id, game (string 20, default draw), locale (5), access (string 10, default team), guest_token (40, unique), timer_ends_at, current_round_id, scores_reset_at, timestamps`); `game_players` (`id, game_room_id, user_id, participant_id, guest_name (50), guest_secret_hash (64), timestamps`, unique `(game_room_id, user_id)` and `(game_room_id, participant_id)`); `game_rounds` (`id, game_room_id, game, leader_player_id, word (24), revealed_positions jsonb [], picked_letters jsonb [], picked_by jsonb [], misses smallint 0, clue jsonb [], question (200), drawing jsonb [], drawing_points int 0, winner_player_id, revealed_at, outcome (20), started_at, ended_at, timestamps`); `game_guesses` (`id, game_round_id, player_id, text (50), is_near_miss, is_correct, timestamps`); `game_gif_answers` (`id, game_round_id, player_id, gif_id (64), timestamps`, unique `(game_round_id, player_id)`); `game_gif_votes` (`id, game_round_id, voter_player_id, answer_id, timestamps`, unique `(game_round_id, voter_player_id)`); `game_points` (`id, team_id, game_room_id, game_round_id (null on delete), player_id, user_id, game, points smallint, is_win, created_at`, unique `(game_round_id, player_id)`); `game_used_words` (`team_id, locale, word, created_at`, primary `(team_id, locale, word)`); `retros.icebreaker_game` (string 20, default `draw`, cast `GameKind`, fillable).

**Enums.** `App\Enums\GameKind` (`DrawAndGuess = 'draw'`, `SprintGif = 'gif'`, `Hangman = 'hangman'`, `Decoded = 'decoded'`; `label(): string`), `App\Enums\GameRoomAccess` (`Team`, `Link`), `App\Enums\GameRoundOutcome` (`Guessed = 'guessed'`, `Solved = 'solved'`, `Lost = 'lost'`, `TimedOut = 'timed_out'`, `Passed = 'passed'`, `Revealed = 'revealed'`, `Abandoned = 'abandoned'`).

**Models.**
- `GameRoom`: constants `MaxRoomsPerTeam = 10`, `MaxOnlinePlayers = 12`, `KeptRounds = 20`; relations `team`, `retro`, `creator`, `host` (BelongsTo `GamePlayer`), `players` (join order), `rounds`, `currentRound`, `points`; `isIcebreaker(): bool`, `activeRound(): ?GameRound`, `isHost(GamePlayer): bool` (icebreaker: the player's participant is the retro facilitator), `isCreator(GamePlayer): bool`, `isManager(GamePlayer): bool` (host, creator or workspace Owner/Admin), `effectiveTimerEndsAt(): ?CarbonInterface` (icebreaker: `retro->timer_ends_at`), `broadcastChannel(): string` (`retro.{retroId}` or `game.{id}`, without the `presence-` prefix), `guestUrl(): string`. `guest_token` hidden. Casts: `game` → `GameKind`, `access` → `GameRoomAccess`, `timer_ends_at`, `scores_reset_at` → datetime.
- `GamePlayer`: `current(Request): self` (request attribute `gamePlayer`), relations `room`, `user`, `participant`; `isGuest()`, `displayName()`, `avatarSeed()`, `avatarUrl()` (delegating to the participant when `participant_id` is set), `presenceId(): string` (`participant_id ?? id`), `accountUserId(): ?string`, `account(): ?User`.
- `GameRound`: `$hidden = ['word', 'picked_by']`; array casts for `revealed_positions, picked_letters, picked_by, clue, drawing`; defaults `[]` / `0`; relations `room`, `leader`, `winner`, `guesses`, `gifAnswers`, `gifVotes`, `points`; `isActive(): bool`.
- `GameGuess` (`round`, `player`), `GameGifAnswer` (`round`, `player`, `votes`), `GameGifVote` (`round`, `voter`, `answer`), `GamePoint` (no `updated_at`; `room`, `round`, `player`, `user`).
- Factories: `GameRoom::factory()` (default game `hangman`, access `team`, locale `en`) with states `game(GameKind)`, `linkAccess()`, `icebreaker(Retro)`; `GamePlayer::factory()` with `guest(string $secret = 'secret')`, `forParticipant(Participant)`; `GameRound::factory()` (active Hangman round with word `sprint`) with `game(GameKind)`, `word(string)`, `ledBy(GamePlayer)`, `ended(GameRoundOutcome = Solved)`; `GameGuess::factory()`, `GameGifAnswer::factory()`, `GameGifVote::factory()`, `GamePoint::factory()`.
- `Team::gameRooms(): HasMany` (standalone and icebreaker rooms).

**Test helpers (`tests/Pest.php`).** `gameRoomMember(GameRoom): array{0: User, 1: GamePlayer}`, `gameRoomHost(GameRoom): array{0: User, 1: GamePlayer}`, `gameRoomGuest(GameRoom, string $secret = 'secret'): GamePlayer`, `gameGuestCookie(GamePlayer, string $secret = 'secret'): array<string, string>`, `activeGameRound(GameRoom, array $attributes = []): GameRound` (creates the round and points `current_round_id` at it), `fakeGameRoster(?array $presenceIds): void`, `gamePayloadJson(array|string): string`, `gamePayloadExposesWord(array|string $payload, string $word): bool`, `bindGameRules(GameRules ...$rules): void` (replaces the registry for one test).

**Dictionaries.** `App\Support\Games\GameWordBook` (`__construct(?array $words = null, ?array $questions = null)` for test overrides; `entries(string $locale): array<int, array{word: string, drawable: bool}>`, `words(string $locale, bool $drawableOnly): array<int, string>`, `questions(string $locale): array<int, string>`); `App\Support\Games\GuestNames::random(string $locale): string`.

**Words.** `App\Support\Games\GameWord` (static): `characters(string): array<int, string>`, `fold(string $character): string`, `isSeparator(string $character): bool`, `letterPositions(string $word): array<int, int>`, `positionsOf(string $word, string $letter): array<int, int>`, `mask(string $word, array $revealedPositions): array<int, ?string>`, `isFullyRevealed(string $word, array $revealedPositions): bool`, `normalize(string $text): string` (guess matching, used by 13b). `App\Actions\Games\DrawGameWord::handle(GameRoom $room, bool $drawableOnly): string` (call inside the start transaction).

**Rules contract.** `App\Support\Games\GameRules` (interface):
- `kind(): GameKind`
- `isAvailable(GameRoom $room): bool`
- `prepare(GameRoom $room, GameRound $round, array $input): void` — fills the unsaved round (word, question, leader); `$input` is the validated start request (`leader_player_id` when present); throw `ValidationException` for bad input.
- `presentActive(GameRound $round, GameRoom $room, ?GamePlayer $viewer): array` — game fields of an active round; `$viewer === null` is the public view used for `game.round.started`.
- `presentEnded(GameRound $round): array` — extra fields of `GET rounds/{round}` (drawing, clue, answers…).
- `endedPayload(GameRound $round, GameRoom $room): array` — extra keys of `game.round.ended` (13c `answers`).
- `expiryAnchor(GameRound $round): CarbonInterface` — the timer must have ended after this instant to expire the round (13c: `revealed_at ?? started_at`).
- `expire(GameRoom $room, GameRound $round): ?GameRoundOutcome` — called with both rows locked when the timer expired; return the outcome to end the round with, or `null` after handling it yourself (13c reveal stage). Must not call `EndGameRound`.
- `outcomeOnNextRound(GameRound $round): ?GameRoundOutcome` — `null` refuses `POST rounds` while this round is active (409); 13c returns `Revealed` during voting.
- `points(GameRound $round, GameRoom $room): array<string, array{points: int, isWin: bool}>` — one entry per player who acted, keyed by player id.

`App\Support\Games\GameRulesRegistry` (`find(GameKind): ?GameRules`, `for(GameKind): GameRules`, `isAvailable(GameKind, GameRoom): bool`, `options(GameRoom): array<int, array{value: string, label: string, available: bool}>`), bound in `AppServiceProvider::register()` as `new GameRulesRegistry([$app->make(HangmanRules::class)])` — 13b/13c append their classes to that list.

**Engine actions (all inside the caller's or their own transaction, rows locked).**
- `StartGameRound::handle(GameRoom $room, GamePlayer $host, array $input): array{round: GameRound, ended: ?array}` — locks, `GameGuard::mutable`, `GameGuard::host`, availability (422), active round → `outcomeOnNextRound` or 409 "A round is already in progress.", `prepare`, save, `current_round_id`, prune to `KeptRounds` ended rounds, `ScheduleRoundExpiry`, broadcast `GameRoundStarted`.
- `EndGameRound::handle(GameRoom $lockedRoom, GameRound $lockedRound, GameRoundOutcome $outcome, ?GamePlayer $winner = null): ?array` — no-op returning `null` when the round already ended; otherwise sets `outcome`, `ended_at`, `winner_player_id`, awards points unless `Abandoned`, broadcasts `GameRoundEnded` and returns its payload (`RoundEnded` shape below).
- `AwardRoundPoints::handle(GameRoom $room, GameRound $round): array<int, array{playerId: string, points: int, isWin: bool}>`.
- `LockGameRound::handle(GameRoom $room, GameRound $round): array{0: GameRoom, 1: GameRound}` — locks the room, then the round; every round mutation calls it first inside its transaction.
- `PassGameRound::handle(GameRoom $room, GameRound $round, GamePlayer $player): array` (leader or host → `Passed`).
- `SwitchGame::handle(GameRoom $room, GamePlayer $host, GameKind $game): void` (abandons the active round).
- `ExpireGameRound::handle(GameRoom $room): void` (lazy check; also called by `ResolveGamePlayer` on every request) and `ScheduleRoundExpiry::handle(GameRoom $room, GameRound $round): void` (dispatches `CloseExpiredGameRound` when the effective timer runs in the future — 13d calls it from the retro timer endpoint).
- Job `App\Jobs\CloseExpiredGameRound(string $roundId, string $timerEndsAt)`.

**Guards.** `App\Actions\Games\GameGuard` (static): `mutable(GameRoom)` (icebreaker: retro phase `Icebreaker` else 403 "The game can only be played during the icebreaker.", then `RetroGuard::unlocked` 423), `host`, `manager`, `canDelete`, `standalone` (404 for icebreaker rooms), `activeRound(GameRoom, GameRound)` (409 "This round is over."), `roundGame(GameRound, GameKind ...)` (422), `leaderOrHost(GameRoom, GameRound, GamePlayer)`, `member(GamePlayer)` (403 for guests). `App\Support\Games\GameRateLimit::hit(string $key, int $burst, float $secondsPerToken)` is a per-player token bucket: up to `$burst` actions at once, then one more every `$secondsPerToken` (so 20/s is `hit($key, 20, 0.05)`); an empty bucket or a lock timeout under same-player contention answers 429 "Slow down a little.". Keys in use: `game-letter:{playerId}` (hangman letters, `3, 1.0`), `game-play:{playerId}` (guesses, `3, 1.0`) and `game-draw:{playerId}` (drawing operations and commits, 20 burst at 0.05 s).

**Presenting.** `PresentGamePlayer::handle(GamePlayer): array{id, presenceId, name, avatarUrl, isGuest}`; `PresentGameRound::handle(GameRound, GameRoom, ?GamePlayer $viewer): array` (`{id, game, leaderPlayerId, startedAt, revealedAt}` + `presentActive`); `PresentGameRoundHistory::handle(GameRound): array{id, game, outcome, word, question, leaderPlayerId, leaderName, winnerPlayerId, winnerName, endedAt}` (throws `LogicException` for an active round; callers eager-load `PresentGameRoundHistory::Relations`) and `forRoom(GameRoom): array` (the retained ended rounds, newest first); `BuildGameSnapshot::handle(GameRoom, GamePlayer $viewer): array` with keys `room, me, players, games, round, history, links, serverTime` — 13d adds `leaderboard`, `scoresResetAt`, `share`, `deliveries` inside `handle()`.

**Events** (`App\Events\Games`, base `GameBroadcastEvent(GameRoom $room)` storing `roomId` and `channelName`): `GameRoomChanged` (`game.room.changed`, `[]`), `GameRoomDeleted` (`game.room.deleted`, `[]`), `GameTimerChanged(GameRoom, ?string $timerEndsAt)` (`game.timer.changed`), `GameRoundStarted(GameRoom, array $round)` (`game.round.started`, `{round}`), `GameRoundEnded(GameRoom, array $payload)` (`game.round.ended`, the payload), `GameLetterPicked(GameRoom, array $payload)` (`game.letter.picked`). 13b/13c add their events on the same base.

**`RoundEnded` payload:** `{roundId, outcome, word, winnerPlayerId, leaderPlayerId, ...endedPayload, points: [{playerId, points, isWin}]}`.

**Routes** (names): team `teams.games.index` (GET `/w/{workspace}/teams/{team}/games`), `teams.games.store` (POST); join `games.join.show` / `games.join.store` (`/play/{guestToken}`); under `games/{room}` (middleware `ResolveGamePlayer`, `whereUuid('room')`, `scopeBindings`): `games.show` (GET `/`), `games.snapshot.show`, `games.update` (PATCH `/`), `games.destroy` (DELETE `/`), `games.guest-token.store`, `games.host.update`, `games.game.update`, `games.timer.update`, `games.rounds.store`, `games.rounds.index`, `games.rounds.show`, `games.rounds.pass.store`, `games.rounds.letters.store`. Controllers live in `app/Http/Controllers/Games/` (namespace `App\Http\Controllers\Games`); `{round}` binds to `GameRound` scoped by `GameRoom::rounds()`.

**Presence.** `presence-game.{roomId}` authorized in `BroadcastAuthorizationsController::authorizeGameChannel()` with member info `{id: playerId, name, avatarUrl, isGuest}` and the 12-player cap through `App\Contracts\GamePresenceRoster::presenceIds(GameRoom): ?array` (bound to `ReverbGamePresenceRoster`). Icebreaker rooms are refused there (they use `presence-retro.{retroId}`).

**Frontend.**
- Types `resources/js/lib/games/types.ts`: `GameKind`, `GameRoundOutcome`, `GameRoomAccess`, `GamePlayer`, `GameOption`, `GameRoomInfo`, `GameMask`, `GameRound` (optional per-game fields; 13b/13c add theirs to this type), `GameHistoryRound`, `GamePointsAward`, `GameRoundEnded`, `GameSnapshot`, `GameRoomState` (`{snapshot, lastEnded}`).
- Reducer `resources/js/lib/games/room-reducer.ts`: `RoomAction` = `replace`, `round.started`, `round.ended`, `round.patched {roundId, patch: Partial<GameRound>}`, `letter.picked`, `timer.set`; exported `roomReducer`, `initialRoomState(snapshot)`.
- Hooks: `useGameChannel(roomId, enabled, handlers)` → `{online, connected, reconnecting, presence, full}` with exported `GameEvents` (13b/13c append names) and `GameEvent`; `useGameRoom(initial, {subscribe})` → `{state, dispatch, apply, refetch, run, handleError, handleEvent, status, online, connected, reconnecting, presence, full, sessionExpired, serverOffset}`; `handleEvent({name, payload})` is the switch 13b/13c extend and 13d calls from the retro channel.
- Context `resources/js/components/games/room-context.tsx`: `RoomProvider`, `useRoom()`, `RoomContextValue` = `{snapshot, lastEnded, dispatch, apply, run, handleError, refetch, online, presence, serverOffset, sessionExpired}`.
- Components: `GamePanel` (stage + players list; 13d mounts it in the icebreaker phase inside its own `RoomProvider`), `GameBoard` (switch on `round.game`; 13b/13c add cases), `StartRoundControls` (switch on `room.game`; 13b adds leader selection), `RoundEndCard`, `RoundDetail` (switch on `game`; 13b adds the drawing replay), `WordMask`, `PlayersList` (prop `highlightPlayerId?`), `RoomHeader`, `RoomTimer`, `HistoryDrawer`, `RoomMenu`, `NewRoomDialog`, `RoomCard`; page `games/index` (13d adds the leaderboard panel below the rooms).

---
### Task 1: Game schema, enums, models, factories and test helpers

**Files:**
- Create: `database/migrations/2026_10_06_100000_create_game_tables.php`, `database/migrations/2026_10_06_100100_add_icebreaker_game_to_retros_table.php`
- Create: `app/Enums/GameKind.php`, `app/Enums/GameRoomAccess.php`, `app/Enums/GameRoundOutcome.php`
- Create: `app/Models/{GameRoom,GamePlayer,GameRound,GameGuess,GameGifAnswer,GameGifVote,GamePoint}.php`
- Create: `database/factories/{GameRoomFactory,GamePlayerFactory,GameRoundFactory,GameGuessFactory,GameGifAnswerFactory,GameGifVoteFactory,GamePointFactory}.php`
- Modify: `app/Models/Retro.php` (fillable + cast `icebreaker_game`), `app/Models/Team.php` (`gameRooms()`), `app/Actions/Retros/GuestCookie.php` (`GameScope`), `tests/Pest.php` (helpers)
- Test: create `tests/Feature/Games/GameModelTest.php`

**Interfaces:**
- Consumes: `HasGuestIdentity`, `Participant`, `Retro`, `Team`, `User::canManage(Workspace)`, `GuestCookie`.
- Produces: everything listed under "Schema", "Enums", "Models" and "Test helpers" in the Contract section. `GuestCookie::GameScope = 'game'`. `bindGameRules()` is added in Task 4 (it needs the registry); every other helper is added here.

- [ ] **Step 1: Create the branch**

```bash
git switch feat/plan-12-integrations
git switch -c feat/plan-13-games
```

- [ ] **Step 2: Write the failing test**

Create `tests/Feature/Games/GameModelTest.php`:

```php
<?php

use App\Actions\Retros\GuestCookie;
use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use Carbon\CarbonImmutable;

it('creates a standalone room with casts and defaults', function () {
    $room = GameRoom::factory()->create();

    expect($room->game)->toBe(GameKind::Hangman)
        ->and($room->access)->toBe(GameRoomAccess::Team)
        ->and($room->isIcebreaker())->toBeFalse()
        ->and($room->broadcastChannel())->toBe("game.{$room->id}")
        ->and($room->toArray())->not->toHaveKey('guest_token');
});

it('stores rounds with empty jsonb defaults and hides the word', function () {
    $room = GameRoom::factory()->create();
    $round = activeGameRound($room, ['word' => 'sprint']);

    $fresh = $round->fresh();

    expect($fresh->revealed_positions)->toBe([])
        ->and($fresh->picked_letters)->toBe([])
        ->and($fresh->picked_by)->toBe([])
        ->and($fresh->clue)->toBe([])
        ->and($fresh->drawing)->toBe([])
        ->and($fresh->misses)->toBe(0)
        ->and($fresh->isActive())->toBeTrue()
        ->and($fresh->toArray())->not->toHaveKeys(['word', 'picked_by'])
        ->and($room->fresh()->activeRound()?->id)->toBe($round->id);
});

it('has no active round once the current round ended', function () {
    $room = GameRoom::factory()->create();
    activeGameRound($room)->forceFill(['ended_at' => now(), 'outcome' => GameRoundOutcome::Passed])->save();

    expect($room->fresh()->activeRound())->toBeNull();
});

it('knows host, creator and managers of a standalone room', function () {
    $room = GameRoom::factory()->create();
    [$hostUser, $host] = gameRoomHost($room);
    [, $member] = gameRoomMember($room);
    $admin = workspaceManager($room->team->workspace);
    $adminPlayer = GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $admin->id]);
    $room->forceFill(['created_by_user_id' => $hostUser->id])->save();

    expect($room->isHost($host))->toBeTrue()
        ->and($room->isCreator($host))->toBeTrue()
        ->and($room->isManager($host))->toBeTrue()
        ->and($room->isManager($member))->toBeFalse()
        ->and($room->isManager($adminPlayer))->toBeTrue()
        ->and($room->isHost($adminPlayer))->toBeFalse();
});

it('uses the retro for icebreaker rooms', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create(['timer_ends_at' => CarbonImmutable::parse('2026-10-06 10:05:00')]);
    [, $facilitator] = retroFacilitator($retro);
    [, $participant] = retroMember($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create(['timer_ends_at' => null]);
    $hostPlayer = GamePlayer::factory()->forParticipant($facilitator)->create(['game_room_id' => $room->id]);
    $player = GamePlayer::factory()->forParticipant($participant)->create(['game_room_id' => $room->id]);

    expect($room->isIcebreaker())->toBeTrue()
        ->and($room->team_id)->toBe($retro->team_id)
        ->and($room->broadcastChannel())->toBe("retro.{$retro->id}")
        ->and($room->effectiveTimerEndsAt()?->toIso8601String())->toBe('2026-10-06T10:05:00+00:00')
        ->and($room->isHost($hostPlayer))->toBeTrue()
        ->and($room->isHost($player))->toBeFalse()
        ->and($player->presenceId())->toBe($participant->id)
        ->and($player->displayName())->toBe($participant->displayName())
        ->and($player->avatarUrl())->toBe($participant->avatarUrl())
        ->and($player->accountUserId())->toBe($participant->user_id);
});

it('names guest players and uses the player id as presence id', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    $guest = GamePlayer::factory()->guest()->create(['game_room_id' => $room->id, 'guest_name' => 'Happy Otter']);

    expect($guest->isGuest())->toBeTrue()
        ->and($guest->displayName())->toBe('Happy Otter')
        ->and($guest->presenceId())->toBe($guest->id)
        ->and($guest->accountUserId())->toBeNull()
        ->and($guest->toArray())->not->toHaveKey('guest_secret_hash');
});

it('shows former members once their user is deleted', function () {
    $room = GameRoom::factory()->create();
    [$user, $player] = gameRoomMember($room);

    $user->delete();

    expect($player->fresh()->displayName())->toBe(__('Former member'));
});

it('keeps points when their round is deleted and drops them with the room', function () {
    $room = GameRoom::factory()->create();
    [$user, $player] = gameRoomMember($room);
    $round = GameRound::factory()->ended()->create(['game_room_id' => $room->id]);
    $point = GamePoint::factory()->create([
        'team_id' => $room->team_id,
        'game_room_id' => $room->id,
        'game_round_id' => $round->id,
        'player_id' => $player->id,
        'user_id' => $user->id,
        'points' => 3,
    ]);

    $round->delete();

    expect($point->fresh()->game_round_id)->toBeNull();

    $room->delete();

    expect(GamePoint::query()->count())->toBe(0)
        ->and(GamePlayer::query()->count())->toBe(0);
});

it('casts the icebreaker game of a retro', function () {
    $retro = Retro::factory()->create();

    expect($retro->fresh()->icebreaker_game)->toBe(GameKind::DrawAndGuess);

    $retro->update(['icebreaker_game' => GameKind::Hangman]);

    expect($retro->fresh()->icebreaker_game)->toBe(GameKind::Hangman);
});

it('scopes game guest cookies', function () {
    expect(GuestCookie::name(GuestCookie::GameScope, 'room-id'))->toBe('game_guest_room-id');
});

it('lists a team game rooms', function () {
    $room = GameRoom::factory()->create();

    expect($room->team->gameRooms()->pluck('id')->all())->toBe([$room->id]);
});

it('labels every game kind and outcome', function () {
    expect(collect(GameKind::cases())->map->label()->all())
        ->toBe([__('Draw & Guess'), __('Sprint in one GIF'), __('Hangman'), __('Decoded')])
        ->and(GameRoundOutcome::TimedOut->value)->toBe('timed_out');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/GameModelTest.php`
Expected: FAIL — `Class "App\Models\GameRoom" not found`.

- [ ] **Step 4: Write the migrations**

Create `database/migrations/2026_10_06_100000_create_game_tables.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Expression;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_rooms', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('retro_id')->nullable()->unique()->constrained()->cascadeOnDelete();
            $table->string('name', 60)->nullable();
            $table->foreignUuid('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->uuid('host_player_id')->nullable();
            $table->string('game', 20)->default('draw');
            $table->string('locale', 5);
            $table->string('access', 10)->default('team');
            $table->string('guest_token', 40)->unique();
            $table->timestamp('timer_ends_at')->nullable();
            $table->uuid('current_round_id')->nullable();
            $table->timestamp('scores_reset_at')->nullable();
            $table->timestamps();

            $table->index(['team_id', 'retro_id']);
        });

        Schema::create('game_players', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('game_room_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('participant_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('guest_name', 50)->nullable();
            $table->string('guest_secret_hash', 64)->nullable();
            $table->timestamps();

            $table->unique(['game_room_id', 'user_id']);
            $table->unique(['game_room_id', 'participant_id']);
        });

        Schema::table('game_rooms', function (Blueprint $table) {
            $table->foreign('host_player_id')->references('id')->on('game_players')->nullOnDelete();
        });

        Schema::create('game_rounds', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('game_room_id')->constrained()->cascadeOnDelete();
            $table->string('game', 20);
            $table->foreignUuid('leader_player_id')->nullable()->constrained('game_players')->nullOnDelete();
            $table->string('word', 24)->nullable();
            $table->jsonb('revealed_positions')->default(new Expression("'[]'::jsonb"));
            $table->jsonb('picked_letters')->default(new Expression("'[]'::jsonb"));
            $table->jsonb('picked_by')->default(new Expression("'[]'::jsonb"));
            $table->unsignedSmallInteger('misses')->default(0);
            $table->jsonb('clue')->default(new Expression("'[]'::jsonb"));
            $table->string('question', 200)->nullable();
            $table->jsonb('drawing')->default(new Expression("'[]'::jsonb"));
            $table->unsignedInteger('drawing_points')->default(0);
            $table->foreignUuid('winner_player_id')->nullable()->constrained('game_players')->nullOnDelete();
            $table->timestamp('revealed_at')->nullable();
            $table->string('outcome', 20)->nullable();
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();

            $table->index(['game_room_id', 'ended_at']);
        });

        Schema::table('game_rooms', function (Blueprint $table) {
            $table->foreign('current_round_id')->references('id')->on('game_rounds')->nullOnDelete();
        });

        Schema::create('game_guesses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('game_round_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('player_id')->constrained('game_players')->cascadeOnDelete();
            $table->string('text', 50);
            $table->boolean('is_near_miss')->default(false);
            $table->boolean('is_correct')->default(false);
            $table->timestamps();

            $table->index(['game_round_id', 'created_at']);
        });

        Schema::create('game_gif_answers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('game_round_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('player_id')->constrained('game_players')->cascadeOnDelete();
            $table->string('gif_id', 64);
            $table->timestamps();

            $table->unique(['game_round_id', 'player_id']);
        });

        Schema::create('game_gif_votes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('game_round_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('voter_player_id')->constrained('game_players')->cascadeOnDelete();
            $table->foreignUuid('answer_id')->constrained('game_gif_answers')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['game_round_id', 'voter_player_id']);
        });

        Schema::create('game_points', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('game_room_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('game_round_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('player_id')->constrained('game_players')->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('game', 20);
            $table->unsignedSmallInteger('points');
            $table->boolean('is_win')->default(false);
            $table->timestamp('created_at');

            $table->unique(['game_round_id', 'player_id']);
            $table->index(['game_room_id', 'created_at']);
            $table->index(['team_id', 'user_id', 'created_at']);
        });

        Schema::create('game_used_words', function (Blueprint $table) {
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('locale', 5);
            $table->string('word', 24);
            $table->timestamp('created_at');

            $table->primary(['team_id', 'locale', 'word']);
        });
    }
};
```

Create `database/migrations/2026_10_06_100100_add_icebreaker_game_to_retros_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('retros', function (Blueprint $table) {
            $table->string('icebreaker_game', 20)->default('draw');
        });
    }
};
```

- [ ] **Step 5: Write the enums**

Create `app/Enums/GameKind.php`:

```php
<?php

namespace App\Enums;

enum GameKind: string
{
    case DrawAndGuess = 'draw';
    case SprintGif = 'gif';
    case Hangman = 'hangman';
    case Decoded = 'decoded';

    public function label(): string
    {
        return match ($this) {
            self::DrawAndGuess => __('Draw & Guess'),
            self::SprintGif => __('Sprint in one GIF'),
            self::Hangman => __('Hangman'),
            self::Decoded => __('Decoded'),
        };
    }
}
```

Create `app/Enums/GameRoomAccess.php`:

```php
<?php

namespace App\Enums;

enum GameRoomAccess: string
{
    case Team = 'team';
    case Link = 'link';
}
```

Create `app/Enums/GameRoundOutcome.php`:

```php
<?php

namespace App\Enums;

enum GameRoundOutcome: string
{
    case Guessed = 'guessed';
    case Solved = 'solved';
    case Lost = 'lost';
    case TimedOut = 'timed_out';
    case Passed = 'passed';
    case Revealed = 'revealed';
    case Abandoned = 'abandoned';
}
```

- [ ] **Step 6: Write the models**

Create `app/Models/GameRoom.php`:

```php
<?php

namespace App\Models;

use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use Carbon\CarbonInterface;
use Database\Factories\GameRoomFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_id
 * @property string|null $retro_id
 * @property string|null $name
 * @property string|null $created_by_user_id
 * @property string|null $host_player_id
 * @property GameKind $game
 * @property string $locale
 * @property GameRoomAccess $access
 * @property string $guest_token
 * @property Carbon|null $timer_ends_at
 * @property string|null $current_round_id
 * @property Carbon|null $scores_reset_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Team $team
 * @property-read Retro|null $retro
 * @property-read GameRound|null $currentRound
 */
#[Fillable([
    'team_id', 'retro_id', 'name', 'created_by_user_id', 'host_player_id', 'game', 'locale',
    'access', 'guest_token', 'timer_ends_at', 'current_round_id', 'scores_reset_at',
])]
#[Hidden(['guest_token'])]
class GameRoom extends Model
{
    /** @use HasFactory<GameRoomFactory> */
    use HasFactory;

    use HasUuids;

    public const MaxRoomsPerTeam = 10;

    public const MaxOnlinePlayers = 12;

    public const KeptRounds = 20;

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /** @return BelongsTo<GamePlayer, $this> */
    public function host(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class, 'host_player_id');
    }

    /** @return HasMany<GamePlayer, $this> */
    public function players(): HasMany
    {
        return $this->hasMany(GamePlayer::class)->orderBy('created_at')->orderBy('id');
    }

    /** @return HasMany<GameRound, $this> */
    public function rounds(): HasMany
    {
        return $this->hasMany(GameRound::class);
    }

    /** @return BelongsTo<GameRound, $this> */
    public function currentRound(): BelongsTo
    {
        return $this->belongsTo(GameRound::class, 'current_round_id');
    }

    /** @return HasMany<GamePoint, $this> */
    public function points(): HasMany
    {
        return $this->hasMany(GamePoint::class);
    }

    public function isIcebreaker(): bool
    {
        return $this->retro_id !== null;
    }

    public function activeRound(): ?GameRound
    {
        $round = $this->currentRound;

        if ($round === null || ! $round->isActive()) {
            return null;
        }

        return $round;
    }

    /**
     * The icebreaker host is always the retro facilitator, so it follows a
     * facilitation transfer without any write here.
     */
    public function isHost(GamePlayer $player): bool
    {
        if ($this->isIcebreaker()) {
            return $player->participant_id !== null
                && $player->participant_id === $this->retro?->facilitator_participant_id;
        }

        return $this->host_player_id === $player->id;
    }

    public function isCreator(GamePlayer $player): bool
    {
        return $player->user_id !== null && $player->user_id === $this->created_by_user_id;
    }

    public function isManager(GamePlayer $player): bool
    {
        if ($this->isHost($player) || $this->isCreator($player)) {
            return true;
        }

        return $player->account()?->canManage($this->team->workspace) ?? false;
    }

    public function effectiveTimerEndsAt(): ?CarbonInterface
    {
        if ($this->isIcebreaker()) {
            return $this->retro?->timer_ends_at;
        }

        return $this->timer_ends_at;
    }

    public function broadcastChannel(): string
    {
        if ($this->retro_id !== null) {
            return "retro.{$this->retro_id}";
        }

        return "game.{$this->id}";
    }

    public function guestUrl(): string
    {
        return route('games.join.show', $this->guest_token);
    }

    protected function casts(): array
    {
        return [
            'game' => GameKind::class,
            'access' => GameRoomAccess::class,
            'timer_ends_at' => 'datetime',
            'scores_reset_at' => 'datetime',
        ];
    }
}
```

Create `app/Models/GamePlayer.php`:

```php
<?php

namespace App\Models;

use App\Concerns\HasGuestIdentity;
use Database\Factories\GamePlayerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * A player of one room: a team member, a guest of a link room, or — in an
 * icebreaker room — a retro participant, whose identity it borrows.
 *
 * @property string $id
 * @property string $game_room_id
 * @property string|null $user_id
 * @property string|null $participant_id
 * @property string|null $guest_name
 * @property string|null $guest_secret_hash
 * @property Carbon|null $created_at
 * @property-read GameRoom $room
 * @property-read User|null $user
 * @property-read Participant|null $participant
 */
#[Fillable(['game_room_id', 'user_id', 'participant_id', 'guest_name', 'guest_secret_hash'])]
#[Hidden(['guest_secret_hash'])]
class GamePlayer extends Model
{
    /** @use HasFactory<GamePlayerFactory> */
    use HasFactory;

    use HasGuestIdentity {
        isGuest as private identityIsGuest;
        displayName as private identityDisplayName;
        avatarSeed as private identityAvatarSeed;
    }
    use HasUuids;

    public static function current(Request $request): self
    {
        $player = $request->attributes->get('gamePlayer');

        abort_unless($player instanceof self, 403);

        return $player;
    }

    /** @return BelongsTo<GameRoom, $this> */
    public function room(): BelongsTo
    {
        return $this->belongsTo(GameRoom::class, 'game_room_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function participant(): BelongsTo
    {
        return $this->belongsTo(Participant::class);
    }

    public function isGuest(): bool
    {
        if ($this->participant_id !== null && $this->participant !== null) {
            return $this->participant->isGuest();
        }

        return $this->identityIsGuest();
    }

    public function displayName(): string
    {
        if ($this->participant_id !== null && $this->participant !== null) {
            return $this->participant->displayName();
        }

        return $this->identityDisplayName();
    }

    public function avatarSeed(): string
    {
        if ($this->participant_id !== null && $this->participant !== null) {
            return $this->participant->avatarSeed();
        }

        return $this->identityAvatarSeed();
    }

    /**
     * Reverb stamps whispers with this id: icebreaker players share the
     * retro presence channel, where members are participants.
     */
    public function presenceId(): string
    {
        return $this->participant_id ?? $this->id;
    }

    public function accountUserId(): ?string
    {
        if ($this->participant_id !== null) {
            return $this->participant?->user_id;
        }

        return $this->user_id;
    }

    public function account(): ?User
    {
        if ($this->participant_id !== null) {
            return $this->participant?->user;
        }

        return $this->user;
    }
}
```

Create `app/Models/GameRound.php`:

```php
<?php

namespace App\Models;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use Database\Factories\GameRoundFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $game_room_id
 * @property GameKind $game
 * @property string|null $leader_player_id
 * @property string|null $word
 * @property array<int, int> $revealed_positions
 * @property array<int, string> $picked_letters
 * @property array<int, string> $picked_by
 * @property int $misses
 * @property array<int, string> $clue
 * @property string|null $question
 * @property array<int, array<string, mixed>> $drawing
 * @property int $drawing_points
 * @property string|null $winner_player_id
 * @property Carbon|null $revealed_at
 * @property GameRoundOutcome|null $outcome
 * @property Carbon $started_at
 * @property Carbon|null $ended_at
 * @property Carbon|null $created_at
 * @property-read GameRoom $room
 * @property-read GamePlayer|null $leader
 * @property-read GamePlayer|null $winner
 */
#[Fillable([
    'game_room_id', 'game', 'leader_player_id', 'word', 'revealed_positions', 'picked_letters', 'picked_by',
    'misses', 'clue', 'question', 'drawing', 'drawing_points', 'winner_player_id', 'revealed_at',
    'outcome', 'started_at', 'ended_at',
])]
#[Hidden(['word', 'picked_by'])]
class GameRound extends Model
{
    /** @use HasFactory<GameRoundFactory> */
    use HasFactory;

    use HasUuids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'revealed_positions' => '[]',
        'picked_letters' => '[]',
        'picked_by' => '[]',
        'misses' => 0,
        'clue' => '[]',
        'drawing' => '[]',
        'drawing_points' => 0,
    ];

    /** @return BelongsTo<GameRoom, $this> */
    public function room(): BelongsTo
    {
        return $this->belongsTo(GameRoom::class, 'game_room_id');
    }

    /** @return BelongsTo<GamePlayer, $this> */
    public function leader(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class, 'leader_player_id');
    }

    /** @return BelongsTo<GamePlayer, $this> */
    public function winner(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class, 'winner_player_id');
    }

    /** @return HasMany<GameGuess, $this> */
    public function guesses(): HasMany
    {
        return $this->hasMany(GameGuess::class);
    }

    /** @return HasMany<GameGifAnswer, $this> */
    public function gifAnswers(): HasMany
    {
        return $this->hasMany(GameGifAnswer::class);
    }

    /** @return HasMany<GameGifVote, $this> */
    public function gifVotes(): HasMany
    {
        return $this->hasMany(GameGifVote::class);
    }

    /** @return HasMany<GamePoint, $this> */
    public function points(): HasMany
    {
        return $this->hasMany(GamePoint::class);
    }

    public function isActive(): bool
    {
        return $this->ended_at === null;
    }

    protected function casts(): array
    {
        return [
            'game' => GameKind::class,
            'outcome' => GameRoundOutcome::class,
            'revealed_positions' => 'array',
            'picked_letters' => 'array',
            'picked_by' => 'array',
            'clue' => 'array',
            'drawing' => 'array',
            'misses' => 'integer',
            'drawing_points' => 'integer',
            'revealed_at' => 'datetime',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }
}
```

Create `app/Models/GameGuess.php`:

```php
<?php

namespace App\Models;

use Database\Factories\GameGuessFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $game_round_id
 * @property string $player_id
 * @property string $text
 * @property bool $is_near_miss
 * @property bool $is_correct
 * @property Carbon|null $created_at
 * @property-read GameRound $round
 * @property-read GamePlayer $player
 */
#[Fillable(['game_round_id', 'player_id', 'text', 'is_near_miss', 'is_correct'])]
class GameGuess extends Model
{
    /** @use HasFactory<GameGuessFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<GameRound, $this> */
    public function round(): BelongsTo
    {
        return $this->belongsTo(GameRound::class, 'game_round_id');
    }

    /** @return BelongsTo<GamePlayer, $this> */
    public function player(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class);
    }

    protected function casts(): array
    {
        return [
            'is_near_miss' => 'boolean',
            'is_correct' => 'boolean',
        ];
    }
}
```

Create `app/Models/GameGifAnswer.php`:

```php
<?php

namespace App\Models;

use Database\Factories\GameGifAnswerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $game_round_id
 * @property string $player_id
 * @property string $gif_id
 * @property-read GameRound $round
 * @property-read GamePlayer $player
 */
#[Fillable(['game_round_id', 'player_id', 'gif_id'])]
class GameGifAnswer extends Model
{
    /** @use HasFactory<GameGifAnswerFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<GameRound, $this> */
    public function round(): BelongsTo
    {
        return $this->belongsTo(GameRound::class, 'game_round_id');
    }

    /** @return BelongsTo<GamePlayer, $this> */
    public function player(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class);
    }

    /** @return HasMany<GameGifVote, $this> */
    public function votes(): HasMany
    {
        return $this->hasMany(GameGifVote::class, 'answer_id');
    }
}
```

Create `app/Models/GameGifVote.php`:

```php
<?php

namespace App\Models;

use Database\Factories\GameGifVoteFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $game_round_id
 * @property string $voter_player_id
 * @property string $answer_id
 * @property-read GameRound $round
 * @property-read GamePlayer $voter
 * @property-read GameGifAnswer $answer
 */
#[Fillable(['game_round_id', 'voter_player_id', 'answer_id'])]
class GameGifVote extends Model
{
    /** @use HasFactory<GameGifVoteFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<GameRound, $this> */
    public function round(): BelongsTo
    {
        return $this->belongsTo(GameRound::class, 'game_round_id');
    }

    /** @return BelongsTo<GamePlayer, $this> */
    public function voter(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class, 'voter_player_id');
    }

    /** @return BelongsTo<GameGifAnswer, $this> */
    public function answer(): BelongsTo
    {
        return $this->belongsTo(GameGifAnswer::class, 'answer_id');
    }
}
```

Create `app/Models/GamePoint.php`:

```php
<?php

namespace App\Models;

use App\Enums\GameKind;
use Database\Factories\GamePointFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_id
 * @property string $game_room_id
 * @property string|null $game_round_id
 * @property string $player_id
 * @property string|null $user_id
 * @property GameKind $game
 * @property int $points
 * @property bool $is_win
 * @property Carbon|null $created_at
 */
#[Fillable(['team_id', 'game_room_id', 'game_round_id', 'player_id', 'user_id', 'game', 'points', 'is_win'])]
class GamePoint extends Model
{
    /** @use HasFactory<GamePointFactory> */
    use HasFactory;

    use HasUuids;

    public const UPDATED_AT = null;

    /** @return BelongsTo<GameRoom, $this> */
    public function room(): BelongsTo
    {
        return $this->belongsTo(GameRoom::class, 'game_room_id');
    }

    /** @return BelongsTo<GameRound, $this> */
    public function round(): BelongsTo
    {
        return $this->belongsTo(GameRound::class, 'game_round_id');
    }

    /** @return BelongsTo<GamePlayer, $this> */
    public function player(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return [
            'game' => GameKind::class,
            'points' => 'integer',
            'is_win' => 'boolean',
        ];
    }
}
```

Modify `app/Models/Retro.php`: add `'icebreaker_game'` at the end of the `#[Fillable([...])]` list (after `'summary_requested_at'`), add `use App\Enums\GameKind;`, the docblock line ` * @property GameKind $icebreaker_game` after `@property bool $icebreaker_enabled`, and in `casts()` the entry `'icebreaker_game' => GameKind::class,` after `'icebreaker_enabled' => 'boolean',`.

Modify `app/Models/Team.php`: add after `pokerDecks()`:

```php
    /** @return HasMany<GameRoom, $this> */
    public function gameRooms(): HasMany
    {
        return $this->hasMany(GameRoom::class);
    }
```

Modify `app/Actions/Retros/GuestCookie.php`: add after `public const PokerScope = 'poker';`:

```php

    public const GameScope = 'game';
```

- [ ] **Step 7: Write the factories**

Create `database/factories/GameRoomFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Models\GameRoom;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<GameRoom>
 */
class GameRoomFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'name' => Str::limit(fake()->words(3, true), 60, ''),
            'game' => GameKind::Hangman,
            'locale' => 'en',
            'access' => GameRoomAccess::Team,
            'guest_token' => Str::random(40),
        ];
    }

    public function game(GameKind $game): static
    {
        return $this->state(fn () => ['game' => $game]);
    }

    public function linkAccess(): static
    {
        return $this->state(fn () => ['access' => GameRoomAccess::Link]);
    }

    public function icebreaker(Retro $retro): static
    {
        return $this->state(fn () => [
            'team_id' => $retro->team_id,
            'retro_id' => $retro->id,
            'name' => null,
            'access' => GameRoomAccess::Team,
        ]);
    }
}
```

Create `database/factories/GamePlayerFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GamePlayer>
 */
class GamePlayerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'game_room_id' => GameRoom::factory(),
            'user_id' => User::factory(),
        ];
    }

    public function guest(string $secret = 'secret'): static
    {
        return $this->state(fn () => [
            'user_id' => null,
            'guest_name' => fake()->firstName(),
            'guest_secret_hash' => hash('sha256', $secret),
        ]);
    }

    public function forParticipant(Participant $participant): static
    {
        return $this->state(fn () => [
            'user_id' => null,
            'participant_id' => $participant->id,
        ]);
    }
}
```

Create `database/factories/GameRoundFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GameRound>
 */
class GameRoundFactory extends Factory
{
    public function definition(): array
    {
        return [
            'game_room_id' => GameRoom::factory(),
            'game' => GameKind::Hangman,
            'word' => 'sprint',
            'started_at' => now()->startOfSecond(),
        ];
    }

    public function game(GameKind $game): static
    {
        return $this->state(fn () => ['game' => $game]);
    }

    public function word(string $word): static
    {
        return $this->state(fn () => ['word' => $word]);
    }

    public function ledBy(GamePlayer $player): static
    {
        return $this->state(fn () => ['leader_player_id' => $player->id]);
    }

    public function ended(GameRoundOutcome $outcome = GameRoundOutcome::Solved): static
    {
        return $this->state(fn () => ['outcome' => $outcome, 'ended_at' => now()->startOfSecond()]);
    }
}
```

Create `database/factories/GameGuessFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\GameGuess;
use App\Models\GamePlayer;
use App\Models\GameRound;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GameGuess>
 */
class GameGuessFactory extends Factory
{
    public function definition(): array
    {
        return [
            'game_round_id' => GameRound::factory(),
            'player_id' => GamePlayer::factory(),
            'text' => fake()->word(),
        ];
    }
}
```

Create `database/factories/GameGifAnswerFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\GameGifAnswer;
use App\Models\GamePlayer;
use App\Models\GameRound;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<GameGifAnswer>
 */
class GameGifAnswerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'game_round_id' => GameRound::factory(),
            'player_id' => GamePlayer::factory(),
            'gif_id' => Str::random(12),
        ];
    }
}
```

Create `database/factories/GameGifVoteFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GamePlayer;
use App\Models\GameRound;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GameGifVote>
 */
class GameGifVoteFactory extends Factory
{
    public function definition(): array
    {
        return [
            'game_round_id' => GameRound::factory(),
            'voter_player_id' => GamePlayer::factory(),
            'answer_id' => GameGifAnswer::factory(),
        ];
    }
}
```

Create `database/factories/GamePointFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\GameKind;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GamePoint>
 */
class GamePointFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'game_room_id' => GameRoom::factory(),
            'player_id' => GamePlayer::factory(),
            'game' => GameKind::Hangman,
            'points' => 0,
            'is_win' => false,
        ];
    }
}
```

- [ ] **Step 8: Add the test helpers**

In `tests/Pest.php`, add the imports `use App\Models\GamePlayer;`, `use App\Models\GameRoom;`, `use App\Models\GameRound;` (`fakeGameRoster()` and its import come with Task 6, `bindGameRules()` with Task 4) and append at the end of the file:

```php
/**
 * @return array{0: User, 1: GamePlayer}
 */
function gameRoomMember(GameRoom $room): array
{
    $user = teamMember($room->team);

    return [$user, GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $user->id])];
}

/**
 * @return array{0: User, 1: GamePlayer}
 */
function gameRoomHost(GameRoom $room): array
{
    [$user, $player] = gameRoomMember($room);

    $room->forceFill(['host_player_id' => $player->id])->save();

    return [$user, $player];
}

function gameRoomGuest(GameRoom $room, string $secret = 'secret'): GamePlayer
{
    return GamePlayer::factory()->guest($secret)->create(['game_room_id' => $room->id]);
}

/**
 * @return array<string, string>
 */
function gameGuestCookie(GamePlayer $player, string $secret = 'secret'): array
{
    return [GuestCookie::name(GuestCookie::GameScope, $player->game_room_id) => "{$player->id}|{$secret}"];
}

/**
 * @param  array<string, mixed>  $attributes
 */
function activeGameRound(GameRoom $room, array $attributes = []): GameRound
{
    $round = GameRound::factory()->create([
        'game_room_id' => $room->id,
        'game' => $room->game,
        ...$attributes,
    ]);

    $room->forceFill(['current_round_id' => $round->id])->save();

    return $round;
}

/**
 * @param  array<array-key, mixed>|string  $payload
 */
function gamePayloadJson(array|string $payload): string
{
    return is_string($payload) ? $payload : (string) json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/**
 * The word as a JSON string value, case-insensitively: masks carry single
 * letters, never the word itself.
 *
 * @param  array<array-key, mixed>|string  $payload
 */
function gamePayloadExposesWord(array|string $payload, string $word): bool
{
    return str_contains(mb_strtolower(gamePayloadJson($payload)), '"'.mb_strtolower($word).'"');
}
```

- [ ] **Step 9: Run the tests**

Run: `vendor/bin/sail artisan migrate:fresh --env=testing --no-interaction && vendor/bin/sail artisan test --compact tests/Feature/Games/GameModelTest.php tests/Feature/UuidPrimaryKeysTest.php`
Expected: PASS. (`guestUrl()` is exercised in Task 5, once `games.join.show` exists.)

- [ ] **Step 10: Translations**

Append to `lang/{en,fr,es,de}.json` (add only missing keys):

| Key (en) | fr | es | de |
|---|---|---|---|
| Draw & Guess | Dessine et devine | Dibuja y adivina | Zeichnen & Raten |
| Sprint in one GIF | Le sprint en un GIF | El sprint en un GIF | Der Sprint in einem GIF |
| Hangman | Pendu | Ahorcado | Galgenmännchen |
| Decoded | Décodé | Descifrado | Entschlüsselt |

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php` — Expected: PASS.

- [ ] **Step 11: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add database/migrations/2026_10_06_100000_create_game_tables.php database/migrations/2026_10_06_100100_add_icebreaker_game_to_retros_table.php app/Enums/GameKind.php app/Enums/GameRoomAccess.php app/Enums/GameRoundOutcome.php app/Models database/factories app/Actions/Retros/GuestCookie.php tests/Pest.php tests/Feature/Games/GameModelTest.php lang
git commit -m "feat(games): add game schema, models and factories

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 2: Dictionaries — words, GIF questions, guest names (`GameWordBook`, `GuestNames`)

**Files:**
- Create: `resources/games/words/{en,fr,es,de}.php`, `resources/games/gif-questions/{en,fr,es,de}.php`, `resources/games/guest-names/{en,fr,es,de}.php`
- Create: `app/Support/Games/GameWordBook.php`, `app/Support/Games/GuestNames.php`
- Test: create `tests/Feature/Games/DictionaryTest.php`

**Interfaces:**
- Consumes: `config('skrum.locales')`.
- Produces: `GameWordBook::__construct(?array $words = null, ?array $questions = null)`, `entries(string $locale): array<int, array{word: string, drawable: bool}>`, `words(string $locale, bool $drawableOnly): array<int, string>`, `questions(string $locale): array<int, string>`; `GuestNames::random(string $locale): string`. Unknown locales fall back to `en`. Files are `require`d once per process and memoized in a static array (immutable data, Octane-safe).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Games/DictionaryTest.php`:

```php
<?php

use App\Support\Games\GameWordBook;
use App\Support\Games\GuestNames;
use Illuminate\Support\Str;

dataset('game locales', ['en', 'fr', 'es', 'de']);

function dictionaryFold(string $character): string
{
    return Str::lower(Str::ascii($character));
}

it('ships at least 250 valid words with 150 drawable ones', function (string $locale) {
    $book = new GameWordBook;
    $entries = $book->entries($locale);
    $words = array_column($entries, 'word');

    expect(count($entries))->toBeGreaterThanOrEqual(250)
        ->and(count($book->words($locale, drawableOnly: true)))->toBeGreaterThanOrEqual(150)
        ->and(count($book->words($locale, drawableOnly: false)))->toBe(count($entries));

    foreach ($words as $word) {
        expect(mb_strlen($word))->toBeGreaterThanOrEqual(3, "Too short: [{$word}]")
            ->and(mb_strlen($word))->toBeLessThanOrEqual(24, "Too long: [{$word}]")
            ->and(preg_match("/^\\p{L}+(?:[ '\\-]\\p{L}+)*$/u", $word))->toBe(1, "Invalid characters: [{$word}]");

        foreach (mb_str_split($word) as $character) {
            if (in_array($character, [' ', '-', "'"], true)) {
                continue;
            }

            expect(dictionaryFold($character))->toMatch('/^[a-z]$/', "Letter [{$character}] of [{$word}] does not fold to a-z");
        }
    }

    $normalized = array_map(fn (string $word): string => preg_replace('/[\s\'-]+/', '', dictionaryFold($word)) ?? $word, $words);

    expect(array_unique($normalized))->toHaveCount(count($words));
})->with('game locales');

it('ships at least 60 GIF questions', function (string $locale) {
    $questions = (new GameWordBook)->questions($locale);

    expect(count($questions))->toBeGreaterThanOrEqual(60)
        ->and(array_unique($questions))->toHaveCount(count($questions));

    foreach ($questions as $question) {
        expect(trim($question))->not->toBe('')
            ->and(mb_strlen($question))->toBeLessThanOrEqual(200);
    }
})->with('game locales');

it('builds guest names for every animal and adjective', function (string $locale) {
    $data = require resource_path("games/guest-names/{$locale}.php");

    foreach ($data['animals'] as $animal) {
        foreach ($data['adjectives'] as $adjective) {
            expect($adjective)->toHaveKey($animal['gender']);
        }
    }

    foreach (range(1, 30) as $attempt) {
        $name = GuestNames::random($locale);

        expect($name)->not->toContain(':')
            ->and(mb_strlen($name))->toBeGreaterThan(2)
            ->and(mb_strlen($name))->toBeLessThanOrEqual(50);
    }
})->with('game locales');

it('lets tests replace the word book', function () {
    $book = new GameWordBook(
        words: ['en' => [['word' => 'kite', 'drawable' => true], ['word' => 'scope', 'drawable' => false]]],
        questions: ['en' => ['Why?']],
    );

    expect($book->words('en', drawableOnly: true))->toBe(['kite'])
        ->and($book->words('en', drawableOnly: false))->toBe(['kite', 'scope'])
        ->and($book->questions('en'))->toBe(['Why?']);
});

it('falls back to English for unknown locales', function () {
    expect((new GameWordBook)->words('xx', drawableOnly: false))->toBe((new GameWordBook)->words('en', drawableOnly: false))
        ->and(GuestNames::random('xx'))->not->toBe('');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/DictionaryTest.php`
Expected: FAIL — `Class "App\Support\Games\GameWordBook" not found`.

- [ ] **Step 3: Write `GameWordBook` and `GuestNames`**

Create `app/Support/Games/GameWordBook.php`:

```php
<?php

namespace App\Support\Games;

/**
 * Word and GIF-question lists per locale, read from resources/games. The
 * files are immutable, so one copy per process is safe under Octane.
 */
class GameWordBook
{
    /** @var array<string, array<int, mixed>> */
    private static array $files = [];

    /**
     * @param  array<string, array<int, array{word: string, drawable: bool}>>|null  $words
     * @param  array<string, array<int, string>>|null  $questions
     */
    public function __construct(
        private ?array $words = null,
        private ?array $questions = null,
    ) {}

    /**
     * @return array<int, array{word: string, drawable: bool}>
     */
    public function entries(string $locale): array
    {
        if ($this->words !== null) {
            return $this->words[$locale] ?? $this->words['en'] ?? [];
        }

        /** @var array<int, array{word: string, drawable: bool}> */
        return self::file('words', $locale);
    }

    /**
     * @return array<int, string>
     */
    public function words(string $locale, bool $drawableOnly): array
    {
        $entries = array_filter(
            $this->entries($locale),
            fn (array $entry): bool => ! $drawableOnly || $entry['drawable'],
        );

        return array_values(array_map(fn (array $entry): string => $entry['word'], $entries));
    }

    /**
     * @return array<int, string>
     */
    public function questions(string $locale): array
    {
        if ($this->questions !== null) {
            return $this->questions[$locale] ?? $this->questions['en'] ?? [];
        }

        /** @var array<int, string> */
        return self::file('gif-questions', $locale);
    }

    /**
     * @return array<int, mixed>
     */
    private static function file(string $kind, string $locale): array
    {
        $locale = self::supported($locale);

        return self::$files["{$kind}/{$locale}"] ??= require resource_path("games/{$kind}/{$locale}.php");
    }

    public static function supported(string $locale): string
    {
        /** @var array<int, string> $locales */
        $locales = config('skrum.locales');

        return in_array($locale, $locales, true) ? $locale : 'en';
    }
}
```

Create `app/Support/Games/GuestNames.php`:

```php
<?php

namespace App\Support\Games;

use Illuminate\Support\Arr;

/**
 * "Adjective Animal" suggestions for guests, with the adjective agreeing
 * with the animal's grammatical gender where the language needs it.
 */
class GuestNames
{
    /** @var array<string, array{pattern: string, animals: array<int, array{name: string, gender: string}>, adjectives: array<int, array<string, string>>}> */
    private static array $files = [];

    public static function random(string $locale): string
    {
        $locale = GameWordBook::supported($locale);

        /** @var array{pattern: string, animals: array<int, array{name: string, gender: string}>, adjectives: array<int, array<string, string>>} $data */
        $data = self::$files[$locale] ??= require resource_path("games/guest-names/{$locale}.php");

        /** @var array{name: string, gender: string} $animal */
        $animal = Arr::random($data['animals']);

        /** @var array<string, string> $adjective */
        $adjective = Arr::random($data['adjectives']);

        return strtr($data['pattern'], [
            ':adjective' => $adjective[$animal['gender']],
            ':animal' => $animal['name'],
        ]);
    }
}
```

- [ ] **Step 4: Write the word files**

Create `resources/games/words/en.php`:

```php
<?php

$drawable = [
    'laptop', 'keyboard', 'mouse', 'monitor', 'printer', 'coffee cup', 'pizza', 'sandwich', 'cookie', 'banana',
    'apple', 'rocket', 'robot', 'spider', 'whiteboard', 'sticky note', 'marker', 'pencil', 'scissors', 'stapler',
    'paperclip', 'calendar', 'clock', 'alarm clock', 'hourglass', 'stopwatch', 'trophy', 'medal', 'crown', 'lightbulb',
    'battery', 'plug', 'headphones', 'microphone', 'camera', 'smartphone', 'satellite', 'antenna', 'server rack', 'cloud',
    'umbrella', 'rainbow', 'sun', 'moon', 'star', 'planet', 'volcano', 'mountain', 'island', 'bridge',
    'lighthouse', 'castle', 'house', 'desk', 'chair', 'sofa', 'lamp', 'window', 'door', 'key',
    'padlock', 'wallet', 'coin', 'piggy bank', 'backpack', 'suitcase', 'briefcase', 'envelope', 'mailbox', 'newspaper',
    'book', 'notebook', 'map', 'compass', 'anchor', 'sailboat', 'submarine', 'train', 'bicycle', 'scooter',
    'car', 'bus', 'truck', 'tractor', 'helicopter', 'airplane', 'parachute', 'balloon', 'kite', 'ladder',
    'hammer', 'wrench', 'screwdriver', 'saw', 'shovel', 'bucket', 'broom', 'toothbrush', 'glasses', 'hat',
    'tie', 'shirt', 'sock', 'boot', 'glove', 'scarf', 'ring', 'guitar', 'piano', 'drum',
    'trumpet', 'violin', 'football', 'basketball', 'skateboard', 'dice', 'puzzle', 'teddy bear', 'snowman', 'cactus',
    'flower', 'tree', 'leaf', 'mushroom', 'carrot', 'pineapple', 'cherry', 'lemon', 'cake', 'donut',
    'ice cream', 'popcorn', 'burger', 'taco', 'sushi', 'cheese', 'bread', 'fish', 'whale', 'octopus',
    'turtle', 'penguin', 'owl', 'elephant', 'giraffe', 'lion', 'monkey', 'snail', 'butterfly', 'bee',
    'dragon', 'ghost', 'unicorn', 'flashlight', 'candle', 'campfire', 'magnet', 'microscope', 'telescope', 'thermometer',
    'shield', 'flag', 'tent', 'fence', 'traffic light', 'fountain', 'windmill', 'igloo', 'pyramid', 'snake',
    'frog', 'rabbit', 'horse', 'duck', 'pig', 'cow', 'bug', 'spaceship', 'bell', 'ladybug',
];

$abstract = [
    'sprint', 'backlog', 'retrospective', 'deadline', 'deployment', 'standup', 'velocity', 'estimate', 'feedback', 'refactoring',
    'pull request', 'code review', 'merge conflict', 'release', 'roadmap', 'milestone', 'stakeholder', 'product owner', 'scrum master', 'user story',
    'epic', 'definition of done', 'burndown', 'kanban', 'workflow', 'priority', 'blocker', 'dependency', 'technical debt', 'hotfix',
    'rollback', 'database', 'algorithm', 'variable', 'function', 'framework', 'library', 'compiler', 'debugger', 'syntax',
    'exception', 'timeout', 'latency', 'bandwidth', 'password', 'firewall', 'encryption', 'backup', 'version', 'branch',
    'commit', 'repository', 'pipeline', 'container', 'migration', 'prototype', 'wireframe', 'usability', 'accessibility', 'onboarding',
    'meeting', 'agenda', 'brainstorm', 'workshop', 'presentation', 'budget', 'invoice', 'strategy', 'vision', 'innovation',
    'collaboration', 'trust', 'empathy', 'motivation', 'focus', 'patience', 'curiosity', 'courage', 'teamwork', 'consensus',
    'compromise', 'decision', 'experiment', 'hypothesis', 'metric', 'insight', 'iteration', 'increment', 'scope', 'quality',
];

return [
    ...array_map(fn (string $word): array => ['word' => $word, 'drawable' => true], $drawable),
    ...array_map(fn (string $word): array => ['word' => $word, 'drawable' => false], $abstract),
];
```

Create `resources/games/words/fr.php`:

```php
<?php

$drawable = [
    'ordinateur portable', 'clavier', 'souris', 'écran', 'imprimante', 'tasse de café', 'pizza', 'sandwich', 'biscuit', 'banane',
    'pomme', 'fusée', 'robot', 'araignée', 'tableau blanc', 'post-it', 'feutre', 'crayon', 'ciseaux', 'agrafeuse',
    'trombone', 'calendrier', 'horloge', 'réveil', 'sablier', 'chronomètre', 'trophée', 'médaille', 'couronne', 'ampoule',
    'pile', 'prise', 'casque audio', 'micro', 'appareil photo', 'smartphone', 'satellite', 'antenne', 'serveur', 'nuage',
    'parapluie', 'arc-en-ciel', 'soleil', 'lune', 'étoile', 'planète', 'volcan', 'montagne', 'île', 'pont',
    'phare', 'château', 'maison', 'bureau', 'chaise', 'canapé', 'lampe', 'fenêtre', 'porte', 'clé',
    'cadenas', 'portefeuille', 'pièce', 'tirelire', 'sac à dos', 'valise', 'mallette', 'enveloppe', 'boîte aux lettres', 'journal',
    'livre', 'carnet', 'carte', 'boussole', 'ancre', 'voilier', 'sous-marin', 'train', 'vélo', 'trottinette',
    'voiture', 'bus', 'camion', 'tracteur', 'hélicoptère', 'avion', 'parachute', 'ballon', 'cerf-volant', 'échelle',
    'marteau', 'clé anglaise', 'tournevis', 'scie', 'pelle', 'seau', 'balai', 'brosse à dents', 'lunettes', 'chapeau',
    'cravate', 'chemise', 'chaussette', 'botte', 'gant', 'écharpe', 'bague', 'guitare', 'piano', 'tambour',
    'trompette', 'violon', 'ballon de foot', 'ballon de basket', 'skateboard', 'dés', 'puzzle', 'ours en peluche', 'bonhomme de neige', 'cactus',
    'fleur', 'arbre', 'feuille', 'champignon', 'carotte', 'ananas', 'cerise', 'citron', 'gâteau', 'beignet',
    'glace', 'pop-corn', 'hamburger', 'taco', 'sushi', 'fromage', 'pain', 'poisson', 'baleine', 'pieuvre',
    'tortue', 'pingouin', 'hibou', 'éléphant', 'girafe', 'lion', 'singe', 'escargot', 'papillon', 'abeille',
    'dragon', 'fantôme', 'licorne', 'lampe torche', 'bougie', 'feu de camp', 'aimant', 'microscope', 'télescope', 'thermomètre',
    'bouclier', 'drapeau', 'tente', 'clôture', 'feu rouge', 'fontaine', 'moulin à vent', 'igloo', 'pyramide', 'serpent',
    'grenouille', 'lapin', 'cheval', 'canard', 'cochon', 'vache', 'insecte', 'vaisseau spatial', 'cloche', 'coccinelle',
];

$abstract = [
    'sprint', 'backlog', 'rétrospective', 'échéance', 'déploiement', 'mêlée quotidienne', 'vélocité', 'estimation', 'retour', 'refactorisation',
    'demande de fusion', 'revue de code', 'conflit de fusion', 'livraison', 'feuille de route', 'jalon', 'partie prenante', 'responsable produit', 'scrum master', 'récit utilisateur',
    'épopée', 'définition de fini', 'burndown', 'kanban', 'flux de travail', 'priorité', 'blocage', 'dépendance', 'dette technique', 'correctif',
    'retour arrière', 'base de données', 'algorithme', 'variable', 'fonction', 'framework', 'bibliothèque', 'compilateur', 'débogueur', 'syntaxe',
    'exception', 'délai dépassé', 'latence', 'bande passante', 'mot de passe', 'pare-feu', 'chiffrement', 'sauvegarde', 'version', 'branche',
    'commit', 'dépôt', 'pipeline', 'conteneur', 'migration', 'prototype', 'maquette', 'utilisabilité', 'accessibilité', 'intégration',
    'réunion', 'ordre du jour', 'remue-méninges', 'atelier', 'présentation', 'budget', 'facture', 'stratégie', 'vision', 'innovation',
    'collaboration', 'confiance', 'empathie', 'motivation', 'concentration', 'patience', 'curiosité', 'courage', "esprit d'équipe", 'consensus',
    'compromis', 'décision', 'expérience', 'hypothèse', 'indicateur', 'idée', 'itération', 'incrément', 'périmètre', 'qualité',
];

return [
    ...array_map(fn (string $word): array => ['word' => $word, 'drawable' => true], $drawable),
    ...array_map(fn (string $word): array => ['word' => $word, 'drawable' => false], $abstract),
];
```

Create `resources/games/words/es.php`:

```php
<?php

$drawable = [
    'portátil', 'teclado', 'ratón', 'monitor', 'impresora', 'taza de café', 'pizza', 'sándwich', 'galleta', 'plátano',
    'manzana', 'cohete', 'robot', 'araña', 'pizarra', 'nota adhesiva', 'rotulador', 'lápiz', 'tijeras', 'grapadora',
    'clip', 'calendario', 'reloj', 'despertador', 'reloj de arena', 'cronómetro', 'trofeo', 'medalla', 'corona', 'bombilla',
    'batería', 'enchufe', 'auriculares', 'micrófono', 'cámara', 'teléfono móvil', 'satélite', 'antena', 'servidor', 'nube',
    'paraguas', 'arcoíris', 'sol', 'luna', 'estrella', 'planeta', 'volcán', 'montaña', 'isla', 'puente',
    'faro', 'castillo', 'casa', 'escritorio', 'silla', 'sofá', 'lámpara', 'ventana', 'puerta', 'llave',
    'candado', 'cartera', 'moneda', 'hucha', 'mochila', 'maleta', 'maletín', 'sobre', 'buzón', 'periódico',
    'libro', 'cuaderno', 'mapa', 'brújula', 'ancla', 'velero', 'submarino', 'tren', 'bicicleta', 'patinete',
    'coche', 'autobús', 'camión', 'tractor', 'helicóptero', 'avión', 'paracaídas', 'globo', 'cometa', 'escalera',
    'martillo', 'llave inglesa', 'destornillador', 'sierra', 'pala', 'cubo', 'escoba', 'cepillo de dientes', 'gafas', 'sombrero',
    'corbata', 'camisa', 'calcetín', 'bota', 'guante', 'bufanda', 'anillo', 'guitarra', 'piano', 'tambor',
    'trompeta', 'violín', 'balón de fútbol', 'balón de baloncesto', 'monopatín', 'dados', 'rompecabezas', 'osito de peluche', 'muñeco de nieve', 'cactus',
    'flor', 'árbol', 'hoja', 'seta', 'zanahoria', 'piña', 'cereza', 'limón', 'pastel', 'dónut',
    'helado', 'palomitas', 'hamburguesa', 'taco', 'sushi', 'queso', 'pan', 'pez', 'ballena', 'pulpo',
    'tortuga', 'pingüino', 'búho', 'elefante', 'jirafa', 'león', 'mono', 'caracol', 'mariposa', 'abeja',
    'dragón', 'fantasma', 'unicornio', 'linterna', 'vela', 'hoguera', 'imán', 'microscopio', 'telescopio', 'termómetro',
    'escudo', 'bandera', 'tienda de campaña', 'valla', 'semáforo', 'fuente', 'molino de viento', 'iglú', 'pirámide', 'serpiente',
    'rana', 'conejo', 'caballo', 'pato', 'cerdo', 'vaca', 'bicho', 'nave espacial', 'campana', 'mariquita',
];

$abstract = [
    'sprint', 'backlog', 'retrospectiva', 'fecha límite', 'despliegue', 'reunión diaria', 'velocidad', 'estimación', 'comentarios', 'refactorización',
    'solicitud de cambios', 'revisión de código', 'conflicto de fusión', 'lanzamiento', 'hoja de ruta', 'hito', 'parte interesada', 'dueño de producto', 'scrum master', 'historia de usuario',
    'épica', 'definición de hecho', 'burndown', 'kanban', 'flujo de trabajo', 'prioridad', 'bloqueo', 'dependencia', 'deuda técnica', 'parche',
    'reversión', 'base de datos', 'algoritmo', 'variable', 'función', 'framework', 'biblioteca', 'compilador', 'depurador', 'sintaxis',
    'excepción', 'tiempo de espera', 'latencia', 'ancho de banda', 'contraseña', 'cortafuegos', 'cifrado', 'copia de seguridad', 'versión', 'rama',
    'commit', 'repositorio', 'pipeline', 'contenedor', 'migración', 'prototipo', 'boceto', 'usabilidad', 'accesibilidad', 'incorporación',
    'reunión', 'agenda', 'lluvia de ideas', 'taller', 'presentación', 'presupuesto', 'factura', 'estrategia', 'visión', 'innovación',
    'colaboración', 'confianza', 'empatía', 'motivación', 'concentración', 'paciencia', 'curiosidad', 'valentía', 'trabajo en equipo', 'consenso',
    'compromiso', 'decisión', 'experimento', 'hipótesis', 'métrica', 'percepción', 'iteración', 'incremento', 'alcance', 'calidad',
];

return [
    ...array_map(fn (string $word): array => ['word' => $word, 'drawable' => true], $drawable),
    ...array_map(fn (string $word): array => ['word' => $word, 'drawable' => false], $abstract),
];
```

Create `resources/games/words/de.php`:

```php
<?php

$drawable = [
    'Laptop', 'Tastatur', 'Maus', 'Bildschirm', 'Drucker', 'Kaffeetasse', 'Pizza', 'Sandwich', 'Keks', 'Banane',
    'Apfel', 'Rakete', 'Roboter', 'Spinne', 'Whiteboard', 'Haftnotiz', 'Textmarker', 'Bleistift', 'Schere', 'Hefter',
    'Büroklammer', 'Kalender', 'Uhr', 'Wecker', 'Sanduhr', 'Stoppuhr', 'Pokal', 'Medaille', 'Krone', 'Glühbirne',
    'Batterie', 'Stecker', 'Kopfhörer', 'Mikrofon', 'Kamera', 'Smartphone', 'Satellit', 'Antenne', 'Server', 'Wolke',
    'Regenschirm', 'Regenbogen', 'Sonne', 'Mond', 'Stern', 'Planet', 'Vulkan', 'Berg', 'Insel', 'Brücke',
    'Leuchtturm', 'Burg', 'Haus', 'Schreibtisch', 'Stuhl', 'Sofa', 'Lampe', 'Fenster', 'Tür', 'Schlüssel',
    'Vorhängeschloss', 'Geldbörse', 'Münze', 'Sparschwein', 'Rucksack', 'Koffer', 'Aktentasche', 'Briefumschlag', 'Briefkasten', 'Zeitung',
    'Buch', 'Notizbuch', 'Landkarte', 'Kompass', 'Anker', 'Segelboot', 'U-Boot', 'Zug', 'Fahrrad', 'Roller',
    'Auto', 'Bus', 'Lastwagen', 'Traktor', 'Hubschrauber', 'Flugzeug', 'Fallschirm', 'Luftballon', 'Flugdrachen', 'Leiter',
    'Hammer', 'Schraubenschlüssel', 'Schraubenzieher', 'Säge', 'Schaufel', 'Eimer', 'Besen', 'Zahnbürste', 'Brille', 'Hut',
    'Krawatte', 'Hemd', 'Socke', 'Stiefel', 'Handschuh', 'Schal', 'Ring', 'Gitarre', 'Klavier', 'Trommel',
    'Trompete', 'Geige', 'Tennisschläger', 'Basketball', 'Skateboard', 'Würfel', 'Puzzle', 'Teddybär', 'Schneemann', 'Kaktus',
    'Blume', 'Baum', 'Blatt', 'Pilz', 'Karotte', 'Ananas', 'Kirsche', 'Zitrone', 'Kuchen', 'Donut',
    'Eistüte', 'Popcorn', 'Burger', 'Taco', 'Sushi', 'Käse', 'Brot', 'Fisch', 'Wal', 'Krake',
    'Schildkröte', 'Pinguin', 'Eule', 'Elefant', 'Giraffe', 'Löwe', 'Affe', 'Schnecke', 'Schmetterling', 'Biene',
    'Drache', 'Gespenst', 'Einhorn', 'Taschenlampe', 'Kerze', 'Lagerfeuer', 'Magnet', 'Mikroskop', 'Teleskop', 'Thermometer',
    'Schild', 'Flagge', 'Zelt', 'Zaun', 'Ampel', 'Brunnen', 'Windmühle', 'Iglu', 'Pyramide', 'Schlange',
    'Frosch', 'Hase', 'Pferd', 'Ente', 'Schwein', 'Kuh', 'Käfer', 'Raumschiff', 'Glocke', 'Marienkäfer',
];

$abstract = [
    'Sprint', 'Backlog', 'Retrospektive', 'Frist', 'Deployment', 'Daily', 'Geschwindigkeit', 'Schätzung', 'Feedback', 'Refactoring',
    'Pull-Request', 'Code-Review', 'Merge-Konflikt', 'Release', 'Roadmap', 'Meilenstein', 'Stakeholder', 'Product Owner', 'Scrum Master', 'User Story',
    'Epic', 'Definition of Done', 'Burndown', 'Kanban', 'Arbeitsablauf', 'Priorität', 'Blocker', 'Abhängigkeit', 'technische Schulden', 'Hotfix',
    'Rollback', 'Datenbank', 'Algorithmus', 'Variable', 'Funktion', 'Framework', 'Bibliothek', 'Compiler', 'Debugger', 'Syntax',
    'Ausnahme', 'Zeitüberschreitung', 'Latenz', 'Bandbreite', 'Passwort', 'Firewall', 'Verschlüsselung', 'Backup', 'Version', 'Branch',
    'Commit', 'Repository', 'Pipeline', 'Container', 'Migration', 'Prototyp', 'Wireframe', 'Benutzbarkeit', 'Barrierefreiheit', 'Einarbeitung',
    'Besprechung', 'Tagesordnung', 'Brainstorming', 'Workshop', 'Präsentation', 'Budget', 'Rechnung', 'Strategie', 'Vision', 'Innovation',
    'Zusammenarbeit', 'Vertrauen', 'Empathie', 'Motivation', 'Konzentration', 'Geduld', 'Neugier', 'Mut', 'Teamgeist', 'Konsens',
    'Kompromiss', 'Entscheidung', 'Experiment', 'Hypothese', 'Kennzahl', 'Erkenntnis', 'Iteration', 'Inkrement', 'Umfang', 'Qualität',
];

return [
    ...array_map(fn (string $word): array => ['word' => $word, 'drawable' => true], $drawable),
    ...array_map(fn (string $word): array => ['word' => $word, 'drawable' => false], $abstract),
];
```

- [ ] **Step 5: Write the GIF question files**

Create `resources/games/gif-questions/en.php`:

```php
<?php

return [
    'How did the last deploy feel?',
    'How was this sprint, in one GIF?',
    'How do you feel about our backlog?',
    'What did the last standup look like?',
    'How do you feel right now?',
    'What does Monday morning feel like?',
    'How did you react to the last bug report?',
    'What does our team look like on a Friday afternoon?',
    'How did the last demo go?',
    'What was your face when the build turned red?',
    'How do you feel about the next sprint?',
    'What does a code review feel like?',
    'How was your week?',
    'What does our coffee machine think of us?',
    'How did you feel when the tests passed?',
    'What does a merge conflict feel like?',
    'How would you describe our last meeting?',
    'What does it feel like to close a ticket?',
    'How do you feel about estimates?',
    'What was the biggest surprise of the sprint?',
    'How did the team handle the last emergency?',
    'What does working from home look like today?',
    'How do you feel about deadlines?',
    'What does your inbox look like?',
    'How did you feel during the planning?',
    'What does our velocity look like?',
    'What does pairing with a teammate feel like?',
    'How do you celebrate a release?',
    'What does a production incident feel like?',
    'How did you feel when the requirements changed?',
    'What did the last retro look like?',
    'How do you feel about the documentation?',
    'What does learning a new tool feel like?',
    'How is your energy level today?',
    'What does the end of the sprint look like?',
    'How do you feel after lunch?',
    'What does a long meeting feel like?',
    'How did you feel when the customer said yes?',
    'What does the team chat look like right now?',
    'What does refactoring old code feel like?',
    'How do you feel about the next release?',
    'What does a perfect workday look like?',
    'How did the onboarding feel?',
    'What does your to-do list look like?',
    'How did you feel when the server went down?',
    'What does our team spirit look like?',
    'How do you feel when someone says "quick question"?',
    'What does waiting for the pipeline feel like?',
    "How did you feel about this week's surprises?",
    'What does finishing a big task feel like?',
    'How do you feel about our goals?',
    'What does a Friday deploy feel like?',
    'How did the last workshop go?',
    'What does your brain look like right now?',
    'How do you feel about the holidays coming?',
    'What does backlog refinement feel like?',
    'How did you feel when you found the bug?',
    'What does our daily look like from the outside?',
    'How do you feel about trying something new?',
    'What does teamwork look like?',
    'How would you sum up this month?',
    'What does a quiet day at work feel like?',
];
```

Create `resources/games/gif-questions/fr.php`:

```php
<?php

return [
    "Comment s'est passé le dernier déploiement ?",
    'Ce sprint, en un GIF ?',
    'Que pensez-vous de notre backlog ?',
    'À quoi ressemblait le dernier stand-up ?',
    'Comment vous sentez-vous en ce moment ?',
    'À quoi ressemble le lundi matin ?',
    'Comment avez-vous réagi au dernier rapport de bug ?',
    "À quoi ressemble l'équipe le vendredi après-midi ?",
    "Comment s'est passée la dernière démo ?",
    'Quelle tête avez-vous faite quand le build est passé au rouge ?',
    'Comment voyez-vous le prochain sprint ?',
    "Qu'est-ce que ça fait, une revue de code ?",
    "Comment s'est passée votre semaine ?",
    'Que pense la machine à café de nous ?',
    "Qu'avez-vous ressenti quand les tests sont passés ?",
    "Qu'est-ce que ça fait, un conflit de fusion ?",
    'Comment décririez-vous notre dernière réunion ?',
    "Qu'est-ce que ça fait de fermer un ticket ?",
    'Que pensez-vous des estimations ?',
    'Quelle a été la plus grande surprise du sprint ?',
    "Comment l'équipe a-t-elle géré la dernière urgence ?",
    "À quoi ressemble le télétravail aujourd'hui ?",
    'Que pensez-vous des échéances ?',
    'À quoi ressemble votre boîte mail ?',
    'Comment vous êtes-vous senti pendant la planification ?',
    'À quoi ressemble notre vélocité ?',
    "Qu'est-ce que ça fait de travailler en binôme ?",
    'Comment fêtez-vous une mise en production ?',
    "Qu'est-ce que ça fait, un incident en production ?",
    "Qu'avez-vous ressenti quand le besoin a changé ?",
    'À quoi ressemblait la dernière rétro ?',
    'Que pensez-vous de la documentation ?',
    "Qu'est-ce que ça fait d'apprendre un nouvel outil ?",
    "Quel est votre niveau d'énergie aujourd'hui ?",
    'À quoi ressemble la fin du sprint ?',
    'Comment vous sentez-vous après le déjeuner ?',
    "Qu'est-ce que ça fait, une longue réunion ?",
    "Qu'avez-vous ressenti quand le client a dit oui ?",
    "À quoi ressemble le chat de l'équipe en ce moment ?",
    "Qu'est-ce que ça fait de refactoriser du vieux code ?",
    'Comment voyez-vous la prochaine version ?',
    'À quoi ressemble une journée de travail parfaite ?',
    "Comment s'est passée votre intégration ?",
    'À quoi ressemble votre liste de tâches ?',
    "Qu'avez-vous ressenti quand le serveur est tombé ?",
    "À quoi ressemble notre esprit d'équipe ?",
    "Que ressentez-vous quand quelqu'un dit « petite question » ?",
    "Qu'est-ce que ça fait d'attendre le pipeline ?",
    "Qu'avez-vous pensé des surprises de la semaine ?",
    "Qu'est-ce que ça fait de terminer une grosse tâche ?",
    'Que pensez-vous de nos objectifs ?',
    "Qu'est-ce que ça fait, un déploiement le vendredi ?",
    "Comment s'est passé le dernier atelier ?",
    'À quoi ressemble votre cerveau en ce moment ?',
    'Que pensez-vous des vacances qui approchent ?',
    "Qu'est-ce que ça fait, l'affinage du backlog ?",
    "Qu'avez-vous ressenti en trouvant le bug ?",
    "À quoi ressemble notre daily vu de l'extérieur ?",
    "Que pensez-vous d'essayer quelque chose de nouveau ?",
    "À quoi ressemble le travail d'équipe ?",
    'Comment résumeriez-vous ce mois-ci ?',
    "Qu'est-ce que ça fait, une journée calme au travail ?",
];
```

Create `resources/games/gif-questions/es.php`:

```php
<?php

return [
    '¿Cómo fue el último despliegue?',
    '¿Este sprint, en un GIF?',
    '¿Qué opinas de nuestro backlog?',
    '¿Cómo fue la última daily?',
    '¿Cómo te sientes ahora mismo?',
    '¿Cómo se siente un lunes por la mañana?',
    '¿Cómo reaccionaste al último informe de error?',
    '¿Cómo es nuestro equipo un viernes por la tarde?',
    '¿Cómo fue la última demo?',
    '¿Qué cara pusiste cuando la build se puso en rojo?',
    '¿Qué esperas del próximo sprint?',
    '¿Qué se siente en una revisión de código?',
    '¿Qué tal tu semana?',
    '¿Qué piensa la cafetera de nosotros?',
    '¿Qué sentiste cuando pasaron los tests?',
    '¿Qué se siente con un conflicto de fusión?',
    '¿Cómo describirías nuestra última reunión?',
    '¿Qué se siente al cerrar un ticket?',
    '¿Qué opinas de las estimaciones?',
    '¿Cuál fue la mayor sorpresa del sprint?',
    '¿Cómo manejó el equipo la última emergencia?',
    '¿Cómo es hoy trabajar desde casa?',
    '¿Qué opinas de las fechas límite?',
    '¿Cómo está tu bandeja de entrada?',
    '¿Cómo te sentiste durante la planificación?',
    '¿Cómo se ve nuestra velocidad?',
    '¿Qué se siente al programar en pareja?',
    '¿Cómo celebras un lanzamiento?',
    '¿Qué se siente con un incidente en producción?',
    '¿Qué sentiste cuando cambiaron los requisitos?',
    '¿Cómo fue la última retro?',
    '¿Qué opinas de la documentación?',
    '¿Qué se siente al aprender una herramienta nueva?',
    '¿Cómo está tu nivel de energía hoy?',
    '¿Cómo se ve el final del sprint?',
    '¿Cómo te sientes después de comer?',
    '¿Qué se siente en una reunión larga?',
    '¿Qué sentiste cuando el cliente dijo que sí?',
    '¿Cómo está ahora mismo el chat del equipo?',
    '¿Qué se siente al refactorizar código antiguo?',
    '¿Qué esperas de la próxima versión?',
    '¿Cómo sería un día de trabajo perfecto?',
    '¿Cómo fue tu incorporación?',
    '¿Cómo está tu lista de tareas?',
    '¿Qué sentiste cuando se cayó el servidor?',
    '¿Cómo es nuestro espíritu de equipo?',
    '¿Qué sientes cuando alguien dice «una pregunta rápida»?',
    '¿Qué se siente al esperar al pipeline?',
    '¿Qué te parecieron las sorpresas de esta semana?',
    '¿Qué se siente al terminar una tarea grande?',
    '¿Qué opinas de nuestros objetivos?',
    '¿Qué se siente al desplegar un viernes?',
    '¿Cómo fue el último taller?',
    '¿Cómo está tu cerebro ahora mismo?',
    '¿Qué opinas de las vacaciones que se acercan?',
    '¿Qué se siente al refinar el backlog?',
    '¿Qué sentiste al encontrar el error?',
    '¿Cómo se ve nuestra daily desde fuera?',
    '¿Qué opinas de probar algo nuevo?',
    '¿Cómo es el trabajo en equipo?',
    '¿Cómo resumirías este mes?',
    '¿Qué se siente en un día tranquilo de trabajo?',
];
```

Create `resources/games/gif-questions/de.php`:

```php
<?php

return [
    'Wie hat sich das letzte Deployment angefühlt?',
    'Dieser Sprint in einem GIF?',
    'Was hältst du von unserem Backlog?',
    'Wie sah das letzte Daily aus?',
    'Wie fühlst du dich gerade?',
    'Wie fühlt sich ein Montagmorgen an?',
    'Wie hast du auf den letzten Bugreport reagiert?',
    'Wie sieht unser Team am Freitagnachmittag aus?',
    'Wie lief die letzte Demo?',
    'Was war dein Gesicht, als der Build rot wurde?',
    'Was erwartest du vom nächsten Sprint?',
    'Wie fühlt sich ein Code-Review an?',
    'Wie war deine Woche?',
    'Was denkt die Kaffeemaschine über uns?',
    'Wie hast du dich gefühlt, als die Tests grün wurden?',
    'Wie fühlt sich ein Merge-Konflikt an?',
    'Wie würdest du unser letztes Meeting beschreiben?',
    'Wie fühlt es sich an, ein Ticket zu schließen?',
    'Was hältst du von Schätzungen?',
    'Was war die größte Überraschung im Sprint?',
    'Wie ist das Team mit dem letzten Notfall umgegangen?',
    'Wie sieht Homeoffice heute aus?',
    'Was hältst du von Deadlines?',
    'Wie sieht dein Posteingang aus?',
    'Wie hast du dich in der Planung gefühlt?',
    'Wie sieht unsere Velocity aus?',
    'Wie fühlt sich Pair Programming an?',
    'Wie feierst du ein Release?',
    'Wie fühlt sich ein Produktionsvorfall an?',
    'Wie hast du dich gefühlt, als sich die Anforderungen geändert haben?',
    'Wie sah die letzte Retro aus?',
    'Was hältst du von der Dokumentation?',
    'Wie fühlt es sich an, ein neues Tool zu lernen?',
    'Wie ist dein Energielevel heute?',
    'Wie sieht das Ende des Sprints aus?',
    'Wie fühlst du dich nach dem Mittagessen?',
    'Wie fühlt sich ein langes Meeting an?',
    'Wie hast du dich gefühlt, als der Kunde Ja gesagt hat?',
    'Wie sieht der Team-Chat gerade aus?',
    'Wie fühlt es sich an, alten Code zu refaktorieren?',
    'Was erwartest du vom nächsten Release?',
    'Wie sieht ein perfekter Arbeitstag aus?',
    'Wie war deine Einarbeitung?',
    'Wie sieht deine To-do-Liste aus?',
    'Wie hast du dich gefühlt, als der Server ausgefallen ist?',
    'Wie sieht unser Teamgeist aus?',
    'Wie fühlst du dich, wenn jemand „kurze Frage“ sagt?',
    'Wie fühlt es sich an, auf die Pipeline zu warten?',
    'Was hältst du von den Überraschungen dieser Woche?',
    'Wie fühlt es sich an, eine große Aufgabe abzuschließen?',
    'Was hältst du von unseren Zielen?',
    'Wie fühlt sich ein Deployment am Freitag an?',
    'Wie lief der letzte Workshop?',
    'Wie sieht dein Gehirn gerade aus?',
    'Was hältst du vom nahenden Urlaub?',
    'Wie fühlt sich Backlog-Refinement an?',
    'Wie hast du dich gefühlt, als du den Bug gefunden hast?',
    'Wie sieht unser Daily von außen aus?',
    'Was hältst du davon, etwas Neues auszuprobieren?',
    'Wie sieht Teamarbeit aus?',
    'Wie würdest du diesen Monat zusammenfassen?',
    'Wie fühlt sich ein ruhiger Arbeitstag an?',
];
```

- [ ] **Step 6: Write the guest-name files**

Create `resources/games/guest-names/en.php`:

```php
<?php

$animals = ['Otter', 'Panda', 'Fox', 'Owl', 'Koala', 'Penguin', 'Tiger', 'Dolphin', 'Hedgehog', 'Rabbit', 'Falcon', 'Badger', 'Llama', 'Beaver', 'Squirrel', 'Turtle'];

$adjectives = ['Happy', 'Brave', 'Clever', 'Curious', 'Gentle', 'Jolly', 'Lucky', 'Calm', 'Swift', 'Bright', 'Cheerful', 'Witty', 'Kind', 'Bold', 'Sunny', 'Quiet'];

return [
    'pattern' => ':adjective :animal',
    'animals' => array_map(fn (string $name): array => ['name' => $name, 'gender' => 'n'], $animals),
    'adjectives' => array_map(fn (string $adjective): array => ['n' => $adjective], $adjectives),
];
```

Create `resources/games/guest-names/fr.php`:

```php
<?php

return [
    'pattern' => ':animal :adjective',
    'animals' => [
        ['name' => 'Loutre', 'gender' => 'f'], ['name' => 'Panda', 'gender' => 'm'], ['name' => 'Renard', 'gender' => 'm'],
        ['name' => 'Hibou', 'gender' => 'm'], ['name' => 'Koala', 'gender' => 'm'], ['name' => 'Pingouin', 'gender' => 'm'],
        ['name' => 'Tigre', 'gender' => 'm'], ['name' => 'Dauphin', 'gender' => 'm'], ['name' => 'Hérisson', 'gender' => 'm'],
        ['name' => 'Lapin', 'gender' => 'm'], ['name' => 'Faucon', 'gender' => 'm'], ['name' => 'Blaireau', 'gender' => 'm'],
        ['name' => 'Tortue', 'gender' => 'f'], ['name' => 'Chouette', 'gender' => 'f'], ['name' => 'Girafe', 'gender' => 'f'],
        ['name' => 'Abeille', 'gender' => 'f'],
    ],
    'adjectives' => [
        ['m' => 'joyeux', 'f' => 'joyeuse'], ['m' => 'courageux', 'f' => 'courageuse'], ['m' => 'malin', 'f' => 'maligne'],
        ['m' => 'curieux', 'f' => 'curieuse'], ['m' => 'doux', 'f' => 'douce'], ['m' => 'rieur', 'f' => 'rieuse'],
        ['m' => 'chanceux', 'f' => 'chanceuse'], ['m' => 'calme', 'f' => 'calme'], ['m' => 'rapide', 'f' => 'rapide'],
        ['m' => 'brillant', 'f' => 'brillante'], ['m' => 'gai', 'f' => 'gaie'], ['m' => 'taquin', 'f' => 'taquine'],
        ['m' => 'gentil', 'f' => 'gentille'], ['m' => 'audacieux', 'f' => 'audacieuse'], ['m' => 'radieux', 'f' => 'radieuse'],
        ['m' => 'discret', 'f' => 'discrète'],
    ],
];
```

Create `resources/games/guest-names/es.php`:

```php
<?php

return [
    'pattern' => ':animal :adjective',
    'animals' => [
        ['name' => 'Nutria', 'gender' => 'f'], ['name' => 'Panda', 'gender' => 'm'], ['name' => 'Zorro', 'gender' => 'm'],
        ['name' => 'Búho', 'gender' => 'm'], ['name' => 'Koala', 'gender' => 'm'], ['name' => 'Pingüino', 'gender' => 'm'],
        ['name' => 'Tigre', 'gender' => 'm'], ['name' => 'Delfín', 'gender' => 'm'], ['name' => 'Erizo', 'gender' => 'm'],
        ['name' => 'Conejo', 'gender' => 'm'], ['name' => 'Halcón', 'gender' => 'm'], ['name' => 'Tejón', 'gender' => 'm'],
        ['name' => 'Llama', 'gender' => 'f'], ['name' => 'Tortuga', 'gender' => 'f'], ['name' => 'Ardilla', 'gender' => 'f'],
        ['name' => 'Jirafa', 'gender' => 'f'],
    ],
    'adjectives' => [
        ['m' => 'alegre', 'f' => 'alegre'], ['m' => 'valiente', 'f' => 'valiente'], ['m' => 'listo', 'f' => 'lista'],
        ['m' => 'curioso', 'f' => 'curiosa'], ['m' => 'tranquilo', 'f' => 'tranquila'], ['m' => 'risueño', 'f' => 'risueña'],
        ['m' => 'afortunado', 'f' => 'afortunada'], ['m' => 'veloz', 'f' => 'veloz'], ['m' => 'brillante', 'f' => 'brillante'],
        ['m' => 'simpático', 'f' => 'simpática'], ['m' => 'amable', 'f' => 'amable'], ['m' => 'audaz', 'f' => 'audaz'],
        ['m' => 'sereno', 'f' => 'serena'], ['m' => 'ingenioso', 'f' => 'ingeniosa'], ['m' => 'feliz', 'f' => 'feliz'],
        ['m' => 'sonriente', 'f' => 'sonriente'],
    ],
];
```

Create `resources/games/guest-names/de.php`:

```php
<?php

return [
    'pattern' => ':adjective :animal',
    'animals' => [
        ['name' => 'Otter', 'gender' => 'm'], ['name' => 'Panda', 'gender' => 'm'], ['name' => 'Fuchs', 'gender' => 'm'],
        ['name' => 'Koala', 'gender' => 'm'], ['name' => 'Pinguin', 'gender' => 'm'], ['name' => 'Tiger', 'gender' => 'm'],
        ['name' => 'Delfin', 'gender' => 'm'], ['name' => 'Igel', 'gender' => 'm'], ['name' => 'Hase', 'gender' => 'm'],
        ['name' => 'Falke', 'gender' => 'm'], ['name' => 'Dachs', 'gender' => 'm'], ['name' => 'Eule', 'gender' => 'f'],
        ['name' => 'Schildkröte', 'gender' => 'f'], ['name' => 'Giraffe', 'gender' => 'f'], ['name' => 'Biene', 'gender' => 'f'],
        ['name' => 'Eichhörnchen', 'gender' => 'n'], ['name' => 'Lama', 'gender' => 'n'],
    ],
    'adjectives' => [
        ['m' => 'Fröhlicher', 'f' => 'Fröhliche', 'n' => 'Fröhliches'],
        ['m' => 'Mutiger', 'f' => 'Mutige', 'n' => 'Mutiges'],
        ['m' => 'Kluger', 'f' => 'Kluge', 'n' => 'Kluges'],
        ['m' => 'Neugieriger', 'f' => 'Neugierige', 'n' => 'Neugieriges'],
        ['m' => 'Sanfter', 'f' => 'Sanfte', 'n' => 'Sanftes'],
        ['m' => 'Lustiger', 'f' => 'Lustige', 'n' => 'Lustiges'],
        ['m' => 'Glücklicher', 'f' => 'Glückliche', 'n' => 'Glückliches'],
        ['m' => 'Ruhiger', 'f' => 'Ruhige', 'n' => 'Ruhiges'],
        ['m' => 'Flinker', 'f' => 'Flinke', 'n' => 'Flinkes'],
        ['m' => 'Strahlender', 'f' => 'Strahlende', 'n' => 'Strahlendes'],
        ['m' => 'Munterer', 'f' => 'Muntere', 'n' => 'Munteres'],
        ['m' => 'Freundlicher', 'f' => 'Freundliche', 'n' => 'Freundliches'],
        ['m' => 'Kühner', 'f' => 'Kühne', 'n' => 'Kühnes'],
        ['m' => 'Witziger', 'f' => 'Witzige', 'n' => 'Witziges'],
        ['m' => 'Gemütlicher', 'f' => 'Gemütliche', 'n' => 'Gemütliches'],
        ['m' => 'Stiller', 'f' => 'Stille', 'n' => 'Stilles'],
    ],
];
```

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/DictionaryTest.php`
Expected: PASS (16 dataset cases + 2 tests).

- [ ] **Step 8: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add resources/games app/Support/Games/GameWordBook.php app/Support/Games/GuestNames.php tests/Feature/Games/DictionaryTest.php
git commit -m "feat(games): add word, question and guest name dictionaries

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 3: Words — masks, folding and the per-team draw (`GameWord`, `DrawGameWord`)

**Files:**
- Create: `app/Support/Games/GameWord.php`, `app/Actions/Games/DrawGameWord.php`
- Test: create `tests/Unit/Games/GameWordTest.php`, `tests/Feature/Games/DrawGameWordTest.php`

**Interfaces:**
- Consumes: `GameWordBook` (Task 2), table `game_used_words` (Task 1).
- Produces: `GameWord` static API of the Contract; `DrawGameWord::handle(GameRoom $room, bool $drawableOnly): string` — draws uniformly from the room locale's pool minus the team's used words, records the word, resets the team's history for that locale when the pool is exhausted (excluding the previous word for that draw). Callers hold the room lock (spec §4.5).

- [ ] **Step 1: Write the failing tests**

Create `tests/Unit/Games/GameWordTest.php`:

```php
<?php

use App\Support\Games\GameWord;

it('masks letters and gives separators', function () {
    expect(GameWord::mask("l'équipe-a b", []))->toBe([null, "'", null, null, null, null, null, null, '-', null, ' ', null])
        ->and(GameWord::mask('Sprint', [0, 5]))->toBe(['S', null, null, null, null, 't']);
});

it('lists letter positions without separators', function () {
    expect(GameWord::letterPositions('U-Boot'))->toBe([0, 2, 3, 4, 5])
        ->and(GameWord::letterPositions('pull request'))->toHaveCount(11);
});

it('finds positions of a letter across case and accents', function () {
    expect(GameWord::positionsOf('Éléphant', 'e'))->toBe([0, 2])
        ->and(GameWord::positionsOf('Brücke', 'U'))->toBe([2])
        ->and(GameWord::positionsOf('piña', 'n'))->toBe([2])
        ->and(GameWord::positionsOf('sprint', 'z'))->toBe([]);
});

it('knows when every letter is revealed', function () {
    expect(GameWord::isFullyRevealed('a-b', [0, 2]))->toBeTrue()
        ->and(GameWord::isFullyRevealed('a-b', [0]))->toBeFalse();
});

it('normalizes guesses', function (string $text, string $expected) {
    expect(GameWord::normalize($text))->toBe($expected);
})->with([
    ['  Pull   Request ', 'pull request'],
    ['Arc-en-Ciel', 'arcenciel'],
    ["esprit d'Équipe", 'esprit dequipe'],
    ['ÉLÉPHANT', 'elephant'],
]);

it('folds single characters', function () {
    expect(GameWord::fold('É'))->toBe('e')
        ->and(GameWord::isSeparator(' '))->toBeTrue()
        ->and(GameWord::isSeparator('a'))->toBeFalse();
});
```

Create `tests/Feature/Games/DrawGameWordTest.php`:

```php
<?php

use App\Actions\Games\DrawGameWord;
use App\Models\GameRoom;
use App\Support\Games\GameWordBook;
use Illuminate\Support\Facades\DB;

function useTinyWordBook(): void
{
    app()->instance(GameWordBook::class, new GameWordBook(words: [
        'en' => [
            ['word' => 'kite', 'drawable' => true],
            ['word' => 'lamp', 'drawable' => true],
            ['word' => 'scope', 'drawable' => false],
        ],
        'fr' => [
            ['word' => 'lune', 'drawable' => true],
        ],
    ]));
}

/**
 * @return array<int, string>
 */
function usedWords(GameRoom $room): array
{
    return DB::table('game_used_words')->where('team_id', $room->team_id)->where('locale', $room->locale)->orderBy('word')->pluck('word')->all();
}

it('never repeats a word for a team and locale until the pool is exhausted', function () {
    useTinyWordBook();
    $room = GameRoom::factory()->create();
    $draw = app(DrawGameWord::class);

    $words = [$draw->handle($room, drawableOnly: false), $draw->handle($room, drawableOnly: false), $draw->handle($room, drawableOnly: false)];

    expect(collect($words)->sort()->values()->all())->toBe(['kite', 'lamp', 'scope'])
        ->and(usedWords($room))->toBe(['kite', 'lamp', 'scope']);
});

it('shares the history between the rooms of a team', function () {
    useTinyWordBook();
    $room = GameRoom::factory()->create();
    $other = GameRoom::factory()->create(['team_id' => $room->team_id]);
    $draw = app(DrawGameWord::class);

    $first = $draw->handle($room, drawableOnly: true);
    $second = $draw->handle($other, drawableOnly: true);

    expect($first)->not->toBe($second);
});

it('keeps separate histories per locale and per team', function () {
    useTinyWordBook();
    $room = GameRoom::factory()->create();
    $french = GameRoom::factory()->create(['team_id' => $room->team_id, 'locale' => 'fr']);
    $elsewhere = GameRoom::factory()->create();
    $draw = app(DrawGameWord::class);

    $draw->handle($room, drawableOnly: true);

    expect($draw->handle($french, drawableOnly: true))->toBe('lune')
        ->and(usedWords($elsewhere))->toBe([]);
});

it('uses only drawable words when asked', function () {
    useTinyWordBook();
    $room = GameRoom::factory()->create();
    $draw = app(DrawGameWord::class);

    foreach (range(1, 6) as $attempt) {
        expect($draw->handle($room, drawableOnly: true))->toBeIn(['kite', 'lamp']);
    }
});

it('resets the history once the pool is exhausted and avoids the previous word', function () {
    useTinyWordBook();
    $room = GameRoom::factory()->create();
    $draw = app(DrawGameWord::class);

    $first = $draw->handle($room, drawableOnly: true);
    $this->travel(1)->seconds();
    $second = $draw->handle($room, drawableOnly: true);
    $this->travel(1)->seconds();
    $third = $draw->handle($room, drawableOnly: true);

    expect($second)->not->toBe($first)
        ->and($third)->not->toBe($second)
        ->and(usedWords($room))->toBe([$third]);
});

it('draws a single-word pool again after a reset', function () {
    useTinyWordBook();
    $room = GameRoom::factory()->create(['locale' => 'fr']);
    $draw = app(DrawGameWord::class);

    expect($draw->handle($room, drawableOnly: true))->toBe('lune')
        ->and($draw->handle($room, drawableOnly: true))->toBe('lune');
});

it('draws from the real dictionaries', function () {
    $room = GameRoom::factory()->create(['locale' => 'de']);

    $word = app(DrawGameWord::class)->handle($room, drawableOnly: true);

    expect(app(GameWordBook::class)->words('de', drawableOnly: true))->toContain($word);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Games/GameWordTest.php tests/Feature/Games/DrawGameWordTest.php`
Expected: FAIL — `Class "App\Support\Games\GameWord" not found`.

- [ ] **Step 3: Write `GameWord`**

Create `app/Support/Games/GameWord.php`:

```php
<?php

namespace App\Support\Games;

use Illuminate\Support\Str;

/**
 * Letter-level view of a secret word: separators (space, hyphen,
 * apostrophe) are always given, letters match through their ASCII fold.
 */
class GameWord
{
    private const Separators = [' ', '-', "'"];

    /**
     * @return array<int, string>
     */
    public static function characters(string $word): array
    {
        return mb_str_split($word);
    }

    public static function isSeparator(string $character): bool
    {
        return in_array($character, self::Separators, true);
    }

    public static function fold(string $character): string
    {
        return Str::lower(Str::ascii($character));
    }

    /**
     * @return array<int, int>
     */
    public static function letterPositions(string $word): array
    {
        $positions = [];

        foreach (self::characters($word) as $index => $character) {
            if (! self::isSeparator($character)) {
                $positions[] = $index;
            }
        }

        return $positions;
    }

    /**
     * @return array<int, int>
     */
    public static function positionsOf(string $word, string $letter): array
    {
        $folded = self::fold($letter);
        $positions = [];

        foreach (self::characters($word) as $index => $character) {
            if (! self::isSeparator($character) && self::fold($character) === $folded) {
                $positions[] = $index;
            }
        }

        return $positions;
    }

    /**
     * @param  array<int, int>  $revealedPositions
     * @return array<int, ?string>
     */
    public static function mask(string $word, array $revealedPositions): array
    {
        $revealed = array_flip($revealedPositions);
        $mask = [];

        foreach (self::characters($word) as $index => $character) {
            $mask[] = self::isSeparator($character) || isset($revealed[$index]) ? $character : null;
        }

        return $mask;
    }

    /**
     * @param  array<int, int>  $revealedPositions
     */
    public static function isFullyRevealed(string $word, array $revealedPositions): bool
    {
        return array_diff(self::letterPositions($word), $revealedPositions) === [];
    }

    public static function normalize(string $text): string
    {
        $folded = str_replace(['-', "'"], '', Str::lower(Str::ascii($text)));

        return trim((string) preg_replace('/\s+/', ' ', $folded));
    }
}
```

- [ ] **Step 4: Write `DrawGameWord`**

Create `app/Actions/Games/DrawGameWord.php`:

```php
<?php

namespace App\Actions\Games;

use App\Models\GameRoom;
use App\Support\Games\GameWordBook;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class DrawGameWord
{
    public function __construct(private GameWordBook $gameWordBook) {}

    public function handle(GameRoom $room, bool $drawableOnly): string
    {
        $pool = $this->gameWordBook->words($room->locale, $drawableOnly);
        $available = array_values(array_diff($pool, $this->history($room)->pluck('word')->all()));

        if ($available === []) {
            $previous = $this->history($room)->orderByDesc('created_at')->value('word');

            $this->history($room)->delete();

            $available = array_values(array_diff($pool, [$previous])) ?: $pool;
        }

        /** @var string $word */
        $word = Arr::random($available);

        DB::table('game_used_words')->insertOrIgnore([
            'team_id' => $room->team_id,
            'locale' => $room->locale,
            'word' => $word,
            'created_at' => now(),
        ]);

        return $word;
    }

    private function history(GameRoom $room): Builder
    {
        return DB::table('game_used_words')
            ->where('team_id', $room->team_id)
            ->where('locale', $room->locale);
    }
}
```

- [ ] **Step 5: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Games/GameWordTest.php tests/Feature/Games/DrawGameWordTest.php`
Expected: PASS.

- [ ] **Step 6: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Support/Games/GameWord.php app/Actions/Games/DrawGameWord.php tests/Unit/Games/GameWordTest.php tests/Feature/Games/DrawGameWordTest.php
git commit -m "feat(games): mask words and draw them without repeats per team

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 4: Rules contract, broadcast events and the game snapshot

**Files:**
- Create: `app/Support/Games/GameRules.php`, `app/Support/Games/GameRulesRegistry.php`
- Create: `app/Events/Games/{GameBroadcastEvent,GameRoomChanged,GameRoomDeleted,GameTimerChanged,GameRoundStarted,GameRoundEnded,GameLetterPicked}.php`
- Create: `app/Actions/Games/{PresentGamePlayer,PresentGameRound,PresentGameRoundHistory,BuildGameSnapshot}.php`
- Create: `tests/Support/FakeGameRules.php`
- Modify: `app/Providers/AppServiceProvider.php` (bind the registry), `tests/Pest.php` (`bindGameRules`)
- Test: create `tests/Feature/Games/GameSnapshotTest.php`, `tests/Feature/Games/GameEventsTest.php`

**Interfaces:**
- Consumes: models of Task 1.
- Produces: `GameRules`, `GameRulesRegistry`, the six events, `PresentGamePlayer`, `PresentGameRound`, `PresentGameRoundHistory` (with `public const Relations`), `BuildGameSnapshot` exactly as in the Contract section; `Tests\Support\FakeGameRules` (configurable rules double used by Tasks 7–9 and by 13b–13d engine tests); `bindGameRules(GameRules ...$rules): void`.

- [ ] **Step 1: Write the test double and helper**

Create `tests/Support/FakeGameRules.php`:

```php
<?php

namespace Tests\Support;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRules;
use Carbon\CarbonInterface;

/**
 * Game-agnostic rules for engine tests: every decision is a public knob.
 */
class FakeGameRules implements GameRules
{
    /**
     * @param  array<string, array{points: int, isWin: bool}>  $points
     */
    public function __construct(
        public GameKind $kind = GameKind::Hangman,
        public string $word = 'engine',
        public bool $available = true,
        public ?GameRoundOutcome $nextRoundOutcome = null,
        public array $points = [],
        public ?GameRoundOutcome $expiryOutcome = GameRoundOutcome::TimedOut,
    ) {}

    public function kind(): GameKind
    {
        return $this->kind;
    }

    public function isAvailable(GameRoom $room): bool
    {
        return $this->available;
    }

    public function prepare(GameRoom $room, GameRound $round, array $input): void
    {
        $round->word = $this->word;

        if (isset($input['leader_player_id']) && is_string($input['leader_player_id'])) {
            $round->leader_player_id = $input['leader_player_id'];
        }
    }

    public function presentActive(GameRound $round, GameRoom $room, ?GamePlayer $viewer): array
    {
        return ['fake' => true, 'viewerPlayerId' => $viewer?->id];
    }

    public function presentEnded(GameRound $round): array
    {
        return ['fakeDetail' => true];
    }

    public function endedPayload(GameRound $round, GameRoom $room): array
    {
        return ['fakeExtra' => true];
    }

    public function expiryAnchor(GameRound $round): CarbonInterface
    {
        return $round->started_at;
    }

    public function expire(GameRoom $room, GameRound $round): ?GameRoundOutcome
    {
        return $this->expiryOutcome;
    }

    public function outcomeOnNextRound(GameRound $round): ?GameRoundOutcome
    {
        return $this->nextRoundOutcome;
    }

    public function points(GameRound $round, GameRoom $room): array
    {
        return $this->points;
    }
}
```

In `tests/Pest.php` add `use App\Support\Games\GameRules;` and `use App\Support\Games\GameRulesRegistry;` and append:

```php
function bindGameRules(GameRules ...$rules): void
{
    app()->instance(GameRulesRegistry::class, new GameRulesRegistry(array_values($rules)));
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/Feature/Games/GameEventsTest.php`:

```php
<?php

use App\Events\Games\GameBroadcastEvent;
use App\Events\Games\GameLetterPicked;
use App\Events\Games\GameRoomChanged;
use App\Events\Games\GameRoomDeleted;
use App\Events\Games\GameRoundEnded;
use App\Events\Games\GameRoundStarted;
use App\Events\Games\GameTimerChanged;
use App\Enums\RetroPhase;
use App\Models\GameRoom;
use App\Models\Retro;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;

it('broadcasts standalone rooms on their presence channel', function () {
    $room = GameRoom::factory()->create();
    $event = new GameRoomChanged($room);

    expect($event)->toBeInstanceOf(ShouldBroadcastNow::class)
        ->and($event)->toBeInstanceOf(ShouldDispatchAfterCommit::class)
        ->and($event->broadcastOn())->toBeInstanceOf(PresenceChannel::class)
        ->and($event->broadcastOn()->name)->toBe("presence-game.{$room->id}");
});

it('broadcasts icebreaker rooms on the retro channel', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    $room = GameRoom::factory()->icebreaker($retro)->create();

    expect((new GameRoomChanged($room))->broadcastOn()->name)->toBe("presence-retro.{$retro->id}");
});

it('names every event and its payload keys', function (Closure $make, string $name, array $keys) {
    $room = GameRoom::factory()->create();

    /** @var GameBroadcastEvent $event */
    $event = $make($room);

    expect($event->broadcastAs())->toBe($name)
        ->and(array_keys($event->broadcastWith()))->toBe($keys);
})->with([
    'room changed' => [fn (GameRoom $room) => new GameRoomChanged($room), 'game.room.changed', []],
    'room deleted' => [fn (GameRoom $room) => new GameRoomDeleted($room), 'game.room.deleted', []],
    'timer changed' => [fn (GameRoom $room) => new GameTimerChanged($room, null), 'game.timer.changed', ['timerEndsAt']],
    'round started' => [fn (GameRoom $room) => new GameRoundStarted($room, ['id' => 'r']), 'game.round.started', ['round']],
    'round ended' => [fn (GameRoom $room) => new GameRoundEnded($room, ['roundId' => 'r', 'points' => []]), 'game.round.ended', ['roundId', 'points']],
    'letter picked' => [fn (GameRoom $room) => new GameLetterPicked($room, ['roundId' => 'r', 'letter' => 'a']), 'game.letter.picked', ['roundId', 'letter']],
]);
```

Create `tests/Feature/Games/GameSnapshotTest.php`:

```php
<?php

use App\Actions\Games\BuildGameSnapshot;
use App\Actions\Games\PresentGameRoundHistory;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Tests\Support\FakeGameRules;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
    bindGameRules(new FakeGameRules);
});

function gameSnapshotFor(GameRoom $room, GamePlayer $viewer): array
{
    return app(BuildGameSnapshot::class)->handle($room->fresh(), $viewer->fresh());
}

it('builds the room for its host', function () {
    $room = GameRoom::factory()->linkAccess()->create(['name' => 'Friday fun', 'locale' => 'fr']);
    [$user, $host] = gameRoomHost($room);
    $room->forceFill(['created_by_user_id' => $user->id])->save();

    $snapshot = gameSnapshotFor($room, $host);

    expect($snapshot['room'])->toBe([
        'id' => $room->id,
        'name' => 'Friday fun',
        'game' => 'hangman',
        'locale' => 'fr',
        'access' => 'link',
        'timerEndsAt' => null,
        'isHost' => true,
        'canManage' => true,
        'canDelete' => true,
        'canBecomeHost' => false,
        'hostPlayerId' => $host->id,
        'guestUrl' => route('games.join.show', $room->guest_token),
        'isIcebreaker' => false,
        'currentRoundId' => null,
    ])
        ->and($snapshot['me'])->toBe(['playerId' => $host->id, 'userId' => $user->id, 'isGuest' => false])
        ->and($snapshot['players'])->toBe([[
            'id' => $host->id,
            'presenceId' => $host->id,
            'name' => $user->name,
            'avatarUrl' => $host->avatarUrl(),
            'isGuest' => false,
        ]])
        ->and($snapshot['round'])->toBeNull()
        ->and($snapshot['history'])->toBe([])
        ->and($snapshot['links'])->toBe(['team' => route('teams.show', [$room->team->workspace, $room->team]), 'retro' => null])
        ->and($snapshot['serverTime'])->toBe('2026-10-06T10:00:00.000Z');
})->skip(fn () => ! Route::has('games.join.show'), 'Unskipped by Task 5, which registers the join route.');

it('hides management data from members and team data from guests', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    gameRoomHost($room);
    [, $member] = gameRoomMember($room);
    $guest = gameRoomGuest($room);

    $memberSnapshot = gameSnapshotFor($room, $member);
    $guestSnapshot = gameSnapshotFor($room, $guest);

    expect($memberSnapshot['room']['canManage'])->toBeFalse()
        ->and($memberSnapshot['room']['canDelete'])->toBeFalse()
        ->and($memberSnapshot['room']['canBecomeHost'])->toBeFalse()
        ->and($memberSnapshot['room']['guestUrl'])->toBeNull()
        ->and($memberSnapshot['links']['team'])->not->toBeNull()
        ->and($guestSnapshot['me']['isGuest'])->toBeTrue()
        ->and($guestSnapshot['room']['guestUrl'])->toBeNull()
        ->and($guestSnapshot['room']['canBecomeHost'])->toBeFalse()
        ->and($guestSnapshot['links']['team'])->toBeNull();
});

it('lets workspace admins delete and take hosting', function () {
    $room = GameRoom::factory()->create();
    gameRoomHost($room);
    $admin = workspaceManager($room->team->workspace);
    $adminPlayer = GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $admin->id]);

    $snapshot = gameSnapshotFor($room, $adminPlayer);

    expect($snapshot['room']['canManage'])->toBeTrue()
        ->and($snapshot['room']['canDelete'])->toBeTrue()
        ->and($snapshot['room']['canBecomeHost'])->toBeTrue()
        ->and($snapshot['room']['isHost'])->toBeFalse();
});

it('lists the games with their availability', function () {
    bindGameRules(new FakeGameRules(kind: GameKind::Hangman), new FakeGameRules(kind: GameKind::SprintGif, available: false));
    $room = GameRoom::factory()->create();
    [, $host] = gameRoomHost($room);

    expect(gameSnapshotFor($room, $host)['games'])->toBe([
        ['value' => 'draw', 'label' => __('Draw & Guess'), 'available' => false],
        ['value' => 'gif', 'label' => __('Sprint in one GIF'), 'available' => false],
        ['value' => 'hangman', 'label' => __('Hangman'), 'available' => true],
        ['value' => 'decoded', 'label' => __('Decoded'), 'available' => false],
    ]);
});

it('presents the active round for the viewer through the rules', function () {
    $room = GameRoom::factory()->create();
    [, $host] = gameRoomHost($room);
    [, $member] = gameRoomMember($room);
    $round = activeGameRound($room, ['word' => 'secret']);

    $snapshot = gameSnapshotFor($room, $member);

    expect($snapshot['round'])->toBe([
        'id' => $round->id,
        'game' => 'hangman',
        'leaderPlayerId' => null,
        'startedAt' => '2026-10-06T10:00:00+00:00',
        'revealedAt' => null,
        'fake' => true,
        'viewerPlayerId' => $member->id,
    ])
        ->and($snapshot['room']['currentRoundId'])->toBe($round->id)
        ->and(gamePayloadExposesWord($snapshot, 'secret'))->toBeFalse();
});

it('lists ended rounds newest first with names and without the active one', function () {
    $room = GameRoom::factory()->create();
    [, $host] = gameRoomHost($room);
    [$winnerUser, $winner] = gameRoomMember($room);
    $older = GameRound::factory()->ended(GameRoundOutcome::Passed)->word('kite')->create(['game_room_id' => $room->id, 'ended_at' => now()->subMinutes(5)]);
    $newer = GameRound::factory()->ended(GameRoundOutcome::Solved)->word('lamp')->create(['game_room_id' => $room->id, 'winner_player_id' => $winner->id]);
    activeGameRound($room, ['word' => 'hidden']);

    $history = gameSnapshotFor($room, $host)['history'];

    expect(array_column($history, 'id'))->toBe([$newer->id, $older->id])
        ->and($history[0])->toBe([
            'id' => $newer->id,
            'game' => 'hangman',
            'outcome' => 'solved',
            'word' => 'lamp',
            'question' => null,
            'leaderPlayerId' => null,
            'leaderName' => null,
            'winnerPlayerId' => $winner->id,
            'winnerName' => $winnerUser->name,
            'endedAt' => '2026-10-06T10:00:00+00:00',
        ])
        ->and(gamePayloadExposesWord($history, 'hidden'))->toBeFalse();
});

it('refuses to present an active round as history', function () {
    $round = GameRound::factory()->create();

    app(PresentGameRoundHistory::class)->handle($round);
})->throws(LogicException::class);

it('names the facilitator host of an icebreaker room and links to the retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    [, $facilitator] = retroFacilitator($retro);
    [, $participant] = retroMember($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create();
    $hostPlayer = GamePlayer::factory()->forParticipant($facilitator)->create(['game_room_id' => $room->id]);
    $player = GamePlayer::factory()->forParticipant($participant)->create(['game_room_id' => $room->id]);

    $snapshot = gameSnapshotFor($room, $player);

    expect($snapshot['room']['hostPlayerId'])->toBe($hostPlayer->id)
        ->and($snapshot['room']['isIcebreaker'])->toBeTrue()
        ->and($snapshot['room']['canDelete'])->toBeFalse()
        ->and($snapshot['room']['guestUrl'])->toBeNull()
        ->and($snapshot['players'][1]['presenceId'])->toBe($participant->id)
        ->and($snapshot['links'])->toBe(['team' => null, 'retro' => route('retros.show', $retro)]);
});

it('builds the snapshot with a constant number of queries', function () {
    $count = function (int $players, int $rounds): int {
        $room = GameRoom::factory()->create();
        [, $host] = gameRoomHost($room);

        foreach (range(1, $players) as $index) {
            gameRoomMember($room);
        }

        foreach (range(1, $rounds) as $index) {
            $winner = GamePlayer::query()->where('game_room_id', $room->id)->inRandomOrder()->first();
            GameRound::factory()->ended()->create(['game_room_id' => $room->id, 'winner_player_id' => $winner?->id, 'leader_player_id' => $host->id]);
        }

        activeGameRound($room);
        $fresh = $room->fresh();
        $viewer = $host->fresh();

        DB::flushQueryLog();
        DB::enableQueryLog();
        app(BuildGameSnapshot::class)->handle($fresh, $viewer);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    expect($count(8, 12))->toBe($count(2, 2));
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/GameEventsTest.php tests/Feature/Games/GameSnapshotTest.php`
Expected: FAIL — `Class "App\Events\Games\GameRoomChanged" not found`.

- [ ] **Step 4: Write the rules contract and registry**

Create `app/Support/Games/GameRules.php`:

```php
<?php

namespace App\Support\Games;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Carbon\CarbonInterface;

/**
 * Everything the shared engine needs to know about one game. Rules never
 * end a round themselves: the engine does, with the outcome they return.
 */
interface GameRules
{
    public function kind(): GameKind;

    public function isAvailable(GameRoom $room): bool;

    /**
     * Fills the new, unsaved round (word, question, leader) inside the start
     * transaction, with the room locked.
     *
     * @param  array<string, mixed>  $input  the validated start request
     */
    public function prepare(GameRoom $room, GameRound $round, array $input): void;

    /**
     * Game fields of an active round as the viewer may see them; a null
     * viewer is the public view broadcast to every player.
     *
     * @return array<string, mixed>
     */
    public function presentActive(GameRound $round, GameRoom $room, ?GamePlayer $viewer): array;

    /**
     * @return array<string, mixed>
     */
    public function presentEnded(GameRound $round): array;

    /**
     * @return array<string, mixed>
     */
    public function endedPayload(GameRound $round, GameRoom $room): array;

    /**
     * A timer expires the round only when it ended after this instant.
     */
    public function expiryAnchor(GameRound $round): CarbonInterface;

    /**
     * The outcome that ends a round whose timer ran out, or null when the
     * rules moved the round to another stage themselves.
     */
    public function expire(GameRoom $room, GameRound $round): ?GameRoundOutcome;

    /**
     * The outcome to end this active round with when the host starts the next
     * one, or null to refuse the start.
     */
    public function outcomeOnNextRound(GameRound $round): ?GameRoundOutcome;

    /**
     * One entry per player who acted in the ended round, keyed by player id.
     *
     * @return array<string, array{points: int, isWin: bool}>
     */
    public function points(GameRound $round, GameRoom $room): array;
}
```

Create `app/Support/Games/GameRulesRegistry.php`:

```php
<?php

namespace App\Support\Games;

use App\Enums\GameKind;
use App\Models\GameRoom;
use LogicException;

class GameRulesRegistry
{
    /** @var array<string, GameRules> */
    private array $rules = [];

    /**
     * @param  array<int, GameRules>  $rules
     */
    public function __construct(array $rules)
    {
        foreach ($rules as $rule) {
            $this->rules[$rule->kind()->value] = $rule;
        }
    }

    public function find(GameKind $kind): ?GameRules
    {
        return $this->rules[$kind->value] ?? null;
    }

    public function for(GameKind $kind): GameRules
    {
        return $this->find($kind) ?? throw new LogicException("No rules are registered for [{$kind->value}].");
    }

    public function isAvailable(GameKind $kind, GameRoom $room): bool
    {
        return $this->find($kind)?->isAvailable($room) ?? false;
    }

    /**
     * @return array<int, array{value: string, label: string, available: bool}>
     */
    public function options(GameRoom $room): array
    {
        return array_map(fn (GameKind $kind): array => [
            'value' => $kind->value,
            'label' => $kind->label(),
            'available' => $this->isAvailable($kind, $room),
        ], GameKind::cases());
    }
}
```

In `app/Providers/AppServiceProvider.php` add `use App\Support\Games\GameRulesRegistry;` and in `register()`:

```php
        $this->app->bind(GameRulesRegistry::class, fn (): GameRulesRegistry => new GameRulesRegistry([]));
```

- [ ] **Step 5: Write the events**

Create `app/Events/Games/GameBroadcastEvent.php`:

```php
<?php

namespace App\Events\Games;

use App\Events\Concerns\SendsToOthers;
use App\Models\GameRoom;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Secret words never travel before a round ends; icebreaker rooms speak on
 * their retro's channel, standalone rooms on their own.
 */
abstract class GameBroadcastEvent implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable;
    use InteractsWithSockets;
    use SendsToOthers;

    public string $roomId;

    public string $channelName;

    public function __construct(GameRoom $room)
    {
        $this->roomId = $room->id;
        $this->channelName = $room->broadcastChannel();
    }

    public function broadcastOn(): Channel
    {
        return new PresenceChannel($this->channelName);
    }

    abstract public function broadcastAs(): string;

    /**
     * @return array<string, mixed>
     */
    abstract public function broadcastWith(): array;
}
```

Create `app/Events/Games/GameRoomChanged.php`:

```php
<?php

namespace App\Events\Games;

class GameRoomChanged extends GameBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'game.room.changed';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
```

Create `app/Events/Games/GameRoomDeleted.php`:

```php
<?php

namespace App\Events\Games;

class GameRoomDeleted extends GameBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'game.room.deleted';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
```

Create `app/Events/Games/GameTimerChanged.php`:

```php
<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameTimerChanged extends GameBroadcastEvent
{
    public function __construct(GameRoom $room, public ?string $timerEndsAt)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.timer.changed';
    }

    public function broadcastWith(): array
    {
        return ['timerEndsAt' => $this->timerEndsAt];
    }
}
```

Create `app/Events/Games/GameRoundStarted.php`:

```php
<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameRoundStarted extends GameBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $round  the public view of the round, never the word
     */
    public function __construct(GameRoom $room, public array $round)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.round.started';
    }

    public function broadcastWith(): array
    {
        return ['round' => $this->round];
    }
}
```

Create `app/Events/Games/GameRoundEnded.php`:

```php
<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameRoundEnded extends GameBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(GameRoom $room, public array $payload)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.round.ended';
    }

    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
```

Create `app/Events/Games/GameLetterPicked.php`:

```php
<?php

namespace App\Events\Games;

use App\Models\GameRoom;

class GameLetterPicked extends GameBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(GameRoom $room, public array $payload)
    {
        parent::__construct($room);
    }

    public function broadcastAs(): string
    {
        return 'game.letter.picked';
    }

    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
```

- [ ] **Step 6: Write the presenters and the snapshot**

Create `app/Actions/Games/PresentGamePlayer.php`:

```php
<?php

namespace App\Actions\Games;

use App\Models\GamePlayer;

class PresentGamePlayer
{
    /**
     * @return array{
     *     id: string,
     *     presenceId: string,
     *     name: string,
     *     avatarUrl: string,
     *     isGuest: bool
     * }
     */
    public function handle(GamePlayer $player): array
    {
        return [
            'id' => $player->id,
            'presenceId' => $player->presenceId(),
            'name' => $player->displayName(),
            'avatarUrl' => $player->avatarUrl(),
            'isGuest' => $player->isGuest(),
        ];
    }
}
```

Create `app/Actions/Games/PresentGameRound.php`:

```php
<?php

namespace App\Actions\Games;

use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRulesRegistry;

/**
 * An active round as one viewer may see it. The word is never read here:
 * only a game's rules may hand it to the round's leader.
 */
class PresentGameRound
{
    public function __construct(private GameRulesRegistry $gameRulesRegistry) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(GameRound $round, GameRoom $room, ?GamePlayer $viewer): array
    {
        return [
            'id' => $round->id,
            'game' => $round->game->value,
            'leaderPlayerId' => $round->leader_player_id,
            'startedAt' => $round->started_at->toIso8601String(),
            'revealedAt' => $round->revealed_at?->toIso8601String(),
            ...($this->gameRulesRegistry->find($round->game)?->presentActive($round, $room, $viewer) ?? []),
        ];
    }
}
```

Create `app/Actions/Games/PresentGameRoundHistory.php`:

```php
<?php

namespace App\Actions\Games;

use App\Models\GameRoom;
use App\Models\GameRound;
use LogicException;

/**
 * The one place that presents ended rounds (room history, round detail,
 * "Games we played"); it refuses active rounds, whose word is secret.
 */
class PresentGameRoundHistory
{
    public const Relations = ['leader.user', 'leader.participant.user', 'winner.user', 'winner.participant.user'];

    /**
     * @return array{
     *     id: string,
     *     game: string,
     *     outcome: string,
     *     word: ?string,
     *     question: ?string,
     *     leaderPlayerId: ?string,
     *     leaderName: ?string,
     *     winnerPlayerId: ?string,
     *     winnerName: ?string,
     *     endedAt: string
     * }
     */
    public function handle(GameRound $round): array
    {
        if ($round->ended_at === null || $round->outcome === null) {
            throw new LogicException('Only ended rounds have a history.');
        }

        return [
            'id' => $round->id,
            'game' => $round->game->value,
            'outcome' => $round->outcome->value,
            'word' => $round->word,
            'question' => $round->question,
            'leaderPlayerId' => $round->leader_player_id,
            'leaderName' => $round->leader?->displayName(),
            'winnerPlayerId' => $round->winner_player_id,
            'winnerName' => $round->winner?->displayName(),
            'endedAt' => $round->ended_at->toIso8601String(),
        ];
    }

    /**
     * The room's retained ended rounds, newest first.
     *
     * @return array<int, array<string, mixed>>
     */
    public function forRoom(GameRoom $room): array
    {
        return $room->rounds()
            ->whereNotNull('ended_at')
            ->with(self::Relations)
            ->orderByDesc('ended_at')
            ->orderByDesc('id')
            ->limit(GameRoom::KeptRounds)
            ->get()
            ->map(fn (GameRound $round): array => $this->handle($round))
            ->all();
    }
}
```

Create `app/Actions/Games/BuildGameSnapshot.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameRoomAccess;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Support\Games\GameRulesRegistry;

/**
 * @phpstan-type Snapshot array{
 *     room: array{
 *         id: string,
 *         name: ?string,
 *         game: string,
 *         locale: string,
 *         access: string,
 *         timerEndsAt: ?string,
 *         isHost: bool,
 *         canManage: bool,
 *         canDelete: bool,
 *         canBecomeHost: bool,
 *         hostPlayerId: ?string,
 *         guestUrl: ?string,
 *         isIcebreaker: bool,
 *         currentRoundId: ?string
 *     },
 *     me: array{playerId: string, userId: ?string, isGuest: bool},
 *     players: array<int, array{id: string, presenceId: string, name: string, avatarUrl: string, isGuest: bool}>,
 *     games: array<int, array{value: string, label: string, available: bool}>,
 *     round: ?array<string, mixed>,
 *     history: array<int, array<string, mixed>>,
 *     links: array{team: ?string, retro: ?string},
 *     serverTime: string
 * }
 */
class BuildGameSnapshot
{
    public function __construct(
        private PresentGamePlayer $presentGamePlayer,
        private PresentGameRound $presentGameRound,
        private PresentGameRoundHistory $presentGameRoundHistory,
        private GameRulesRegistry $gameRulesRegistry,
    ) {}

    /**
     * @return Snapshot
     */
    public function handle(GameRoom $room, GamePlayer $viewer): array
    {
        $room->load(['team.workspace', 'retro', 'players.user', 'players.participant.user', 'currentRound']);
        $viewer->loadMissing(['user', 'participant.user']);

        $isStandalone = ! $room->isIcebreaker();
        $isGuest = $viewer->isGuest();
        $isHost = $room->isHost($viewer);
        $isManager = $room->isManager($viewer);
        $canTakeOver = ! $isGuest && ($room->isCreator($viewer) || ($viewer->account()?->canManage($room->team->workspace) ?? false));
        $round = $room->activeRound();

        return [
            'room' => [
                'id' => $room->id,
                'name' => $room->name,
                'game' => $room->game->value,
                'locale' => $room->locale,
                'access' => $room->access->value,
                'timerEndsAt' => $room->effectiveTimerEndsAt()?->toIso8601String(),
                'isHost' => $isHost,
                'canManage' => $isManager,
                'canDelete' => $isStandalone && $canTakeOver,
                'canBecomeHost' => $isStandalone && ! $isHost && $canTakeOver,
                'hostPlayerId' => $this->hostPlayerId($room),
                'guestUrl' => $isStandalone && $isManager && $room->access === GameRoomAccess::Link ? $room->guestUrl() : null,
                'isIcebreaker' => ! $isStandalone,
                'currentRoundId' => $room->current_round_id,
            ],
            'me' => [
                'playerId' => $viewer->id,
                'userId' => $viewer->accountUserId(),
                'isGuest' => $isGuest,
            ],
            'players' => $room->players->map(fn (GamePlayer $player): array => $this->presentGamePlayer->handle($player))->values()->all(),
            'games' => $this->gameRulesRegistry->options($room),
            'round' => $round === null ? null : $this->presentGameRound->handle($round, $room, $viewer),
            'history' => $this->presentGameRoundHistory->forRoom($room),
            'links' => [
                'team' => $isStandalone && ! $isGuest ? route('teams.show', [$room->team->workspace, $room->team]) : null,
                'retro' => $isStandalone ? null : route('retros.show', $room->retro_id),
            ],
            'serverTime' => now()->utc()->format('Y-m-d\TH:i:s.v\Z'),
        ];
    }

    private function hostPlayerId(GameRoom $room): ?string
    {
        if (! $room->isIcebreaker()) {
            return $room->host_player_id;
        }

        return $room->players->first(fn (GamePlayer $player): bool => $room->isHost($player))?->id;
    }

}
```

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/GameEventsTest.php tests/Feature/Games/GameSnapshotTest.php`
Expected: PASS, with "builds the room for its host" skipped until Task 5.

- [ ] **Step 8: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Support/Games/GameRules.php app/Support/Games/GameRulesRegistry.php app/Events/Games app/Actions/Games/PresentGamePlayer.php app/Actions/Games/PresentGameRound.php app/Actions/Games/PresentGameRoundHistory.php app/Actions/Games/BuildGameSnapshot.php app/Providers/AppServiceProvider.php tests/Support/FakeGameRules.php tests/Pest.php tests/Feature/Games/GameEventsTest.php tests/Feature/Games/GameSnapshotTest.php
git commit -m "feat(games): add the rules contract, game events and snapshot

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 5: Access — resolving players, guards, room page, snapshot endpoint and guest join

**Files:**
- Create: `app/Actions/Games/FindGamePlayer.php`, `app/Actions/Games/GameGuard.php`, `app/Http/Middleware/ResolveGamePlayer.php`
- Create: `app/Http/Controllers/Games/GameRoomsController.php` (`show` only; Task 7 adds `update`, `destroy`), `app/Http/Controllers/Games/GameSnapshotsController.php`, `app/Http/Controllers/GameJoinsController.php`
- Modify: `routes/web.php`, `tests/Feature/Games/GameSnapshotTest.php` (drop the `->skip(...)`), `tests/Feature/Games/GameModelTest.php` (assert `guestUrl()`)
- Test: create `tests/Feature/Games/GameAccessTest.php`, `tests/Feature/Games/GameJoinTest.php`

**Interfaces:**
- Consumes: `ResolveParticipant` (retro), `GuestCookie::GameScope`, `GuestNames::random`, `BuildGameSnapshot`, `TeamPolicy::view`.
- Produces: `FindGamePlayer::handle(Request, GameRoom): ?GamePlayer` (member → `firstOrCreate` by `user_id`; guest of a `link` room → cookie `game_guest_{roomId}` with hashed secret; icebreaker room → the retro participant's player, `firstOrCreate` by `participant_id`); middleware `ResolveGamePlayer` (sets request attribute `gamePlayer`; 401 "Your session has expired." / 403 "You no longer have access to this room."; Task 9 adds the lazy expiry call); `GameGuard` (full method list of the Contract); routes `games.show`, `games.snapshot.show`, `games.join.show`, `games.join.store`. Pages `games/show` and `games/join` are rendered here and written in Tasks 13 and 15 — tests of this task assert props with `where()` only (never `component()`, which checks the page file exists).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Games/GameAccessTest.php`:

```php
<?php

use App\Actions\Retros\GuestCookie;
use App\Enums\GameRoomAccess;
use App\Enums\RetroPhase;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('creates the player of a team member on first visit', function () {
    $room = GameRoom::factory()->create();
    $user = teamMember($room->team);

    $this->actingAs($user)
        ->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('me.userId', $user->id);

    expect($room->players()->where('user_id', $user->id)->count())->toBe(1);

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))->assertOk();

    expect($room->players()->count())->toBe(1);
});

it('lets workspace admins in and keeps other users out', function () {
    $room = GameRoom::factory()->create();
    $admin = workspaceManager($room->team->workspace);

    $this->actingAs($admin)->getJson(route('games.snapshot.show', $room))->assertOk();
    $this->actingAs(User::factory()->create())
        ->getJson(route('games.snapshot.show', $room))
        ->assertForbidden()
        ->assertJsonPath('message', __('You no longer have access to this room.'));
});

it('renders the room page with the snapshot', function () {
    $room = GameRoom::factory()->create(['name' => 'Lunch break']);
    [$user] = gameRoomHost($room);

    $this->actingAs($user)
        ->get(route('games.show', $room))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('snapshot.room.name', 'Lunch break'));
});

it('sends signed-out visitors to the login page or the session-ended page', function () {
    $teamRoom = GameRoom::factory()->create();
    $linkRoom = GameRoom::factory()->linkAccess()->create();

    $this->get(route('games.show', $teamRoom))->assertRedirect(route('login'));
    $this->get(route('games.show', $linkRoom))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('retros/session-ended'));
    $this->getJson(route('games.snapshot.show', $teamRoom))
        ->assertUnauthorized()
        ->assertJsonPath('message', __('Your session has expired.'));
});

it('resumes guests of link rooms with their cookie', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    $guest = gameRoomGuest($room);

    $this->withCookies(gameGuestCookie($guest))
        ->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('me.playerId', $guest->id)
        ->assertJsonPath('me.isGuest', true)
        ->assertJsonPath('links.team', null);
});

it('revokes guests when the link is regenerated or access becomes team-only', function (string $change) {
    $room = GameRoom::factory()->linkAccess()->create();
    $guest = gameRoomGuest($room);

    if ($change === 'regenerated') {
        $guest->forceFill(['guest_secret_hash' => null])->save();
    } else {
        $room->update(['access' => GameRoomAccess::Team]);
    }

    $this->withCookies(gameGuestCookie($guest))
        ->getJson(route('games.snapshot.show', $room))
        ->assertForbidden();
})->with(['regenerated', 'team-only']);

it('refuses a wrong secret', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    $guest = gameRoomGuest($room, 'right');

    $this->withCookies(gameGuestCookie($guest, 'wrong'))
        ->getJson(route('games.snapshot.show', $room))
        ->assertForbidden();
});

it('revokes removed members', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomMember($room);

    $room->team->members()->detach($user);

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))->assertForbidden();
});

it('keeps game guest cookies apart from retro and poker cookies', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    $retroGuest = Participant::factory()->guest()->create();

    $this->withCookies([GuestCookie::name(GuestCookie::GameScope, $room->id) => "{$retroGuest->id}|secret"])
        ->getJson(route('games.snapshot.show', $room))
        ->assertForbidden();

    $this->withCookies([GuestCookie::name(GuestCookie::PokerScope, $room->id) => "{$retroGuest->id}|secret"])
        ->getJson(route('games.snapshot.show', $room))
        ->assertUnauthorized();
});

it('never lets a guest of one room into another room', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    $other = GameRoom::factory()->linkAccess()->create();
    $guest = gameRoomGuest($room);

    $this->withCookies([GuestCookie::name(GuestCookie::GameScope, $other->id) => "{$guest->id}|secret"])
        ->getJson(route('games.snapshot.show', $other))
        ->assertForbidden();
});

it('resolves icebreaker players from retro participants', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->withGuestAccess()->create();
    [$user, $participant] = retroMember($retro);
    $retroGuest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $room = GameRoom::factory()->icebreaker($retro)->create();

    $this->withCookies(retroGuestCookie($retroGuest))
        ->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('me.isGuest', true);

    $this->actingAs($user)
        ->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('me.isGuest', false)
        ->assertJsonFragment(['presenceId' => $participant->id]);

    expect(GamePlayer::query()->where('game_room_id', $room->id)->pluck('participant_id')->sort()->values()->all())
        ->toBe(collect([$participant->id, $retroGuest->id])->sort()->values()->all());
});

it('sends the icebreaker room page to its retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    [$user] = retroMember($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create();

    $this->actingAs($user)->get(route('games.show', $room))->assertRedirect(route('retros.show', $retro));
});

it('answers 404 for unknown rooms', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->getJson('/games/'.fake()->uuid().'/snapshot')->assertNotFound();
});
```

Create `tests/Feature/Games/GameJoinTest.php`:

```php
<?php

use App\Actions\Retros\GuestCookie;
use App\Enums\RetroPhase;
use App\Models\GameRoom;
use App\Models\Retro;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('shows the join form of a link room with a suggested name', function () {
    $room = GameRoom::factory()->linkAccess()->create(['name' => 'Coffee games']);

    $this->get(route('games.join.show', $room->guest_token))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('isInvalid', false)
            ->where('guestToken', $room->guest_token)
            ->where('roomName', 'Coffee games')
            ->where('gameLabel', __('Hangman'))
            ->where('suggestedName', fn (string $name) => $name !== ''));
});

it('joins as a guest and resumes with the cookie', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    $cookieName = GuestCookie::name(GuestCookie::GameScope, $room->id);

    $response = $this->post(route('games.join.store', $room->guest_token), ['name' => 'Happy Otter'])
        ->assertRedirect(route('games.show', $room))
        ->assertCookie($cookieName);

    $guest = $room->players()->where('guest_name', 'Happy Otter')->sole();
    $cookieValue = $response->getCookie($cookieName, decrypt: true)->getValue();

    expect($guest->user_id)->toBeNull()
        ->and(str_starts_with($cookieValue, $guest->id.'|'))->toBeTrue();

    $this->withCookies([$cookieName => $cookieValue])
        ->get(route('games.join.show', $room->guest_token))
        ->assertRedirect(route('games.show', $room));
});

it('sends team members straight to the room', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    $user = teamMember($room->team);

    $this->actingAs($user)->get(route('games.join.show', $room->guest_token))->assertRedirect(route('games.show', $room));
});

it('lets a signed-in outsider join as a guest without team access', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    $outsider = User::factory()->create();

    $this->actingAs($outsider)
        ->post(route('games.join.store', $room->guest_token), ['name' => 'Visitor'])
        ->assertRedirect(route('games.show', $room));

    expect($room->players()->where('guest_name', 'Visitor')->sole()->user_id)->toBeNull();
});

it('requires a display name of at most 50 characters', function (string $name) {
    $room = GameRoom::factory()->linkAccess()->create();

    $this->post(route('games.join.store', $room->guest_token), ['name' => $name])->assertSessionHasErrors('name');

    expect($room->players()->count())->toBe(0);
})->with(['', '   ', str_repeat('a', 51)]);

it('refuses team rooms, icebreaker rooms and unknown links without revealing the room', function (string $kind) {
    $token = match ($kind) {
        'team' => GameRoom::factory()->create(['name' => 'Private'])->guest_token,
        'icebreaker' => GameRoom::factory()->icebreaker(Retro::factory()->inPhase(RetroPhase::Icebreaker)->create())->create()->guest_token,
        'unknown' => 'unknown-token',
    };

    $this->get(route('games.join.show', $token))
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page->where('isInvalid', true)->missing('roomName'));

    $this->post(route('games.join.store', $token), ['name' => 'Visitor'])->assertNotFound();
})->with(['team', 'icebreaker', 'unknown']);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/GameAccessTest.php tests/Feature/Games/GameJoinTest.php`
Expected: FAIL — `Route [games.snapshot.show] not defined.`

- [ ] **Step 3: Write `FindGamePlayer`**

Create `app/Actions/Games/FindGamePlayer.php`:

```php
<?php

namespace App\Actions\Games;

use App\Actions\Retros\GuestCookie;
use App\Actions\Retros\ResolveParticipant;
use App\Enums\GameRoomAccess;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Http\Request;

class FindGamePlayer
{
    public function __construct(private ResolveParticipant $resolveParticipant) {}

    public function handle(Request $request, GameRoom $room): ?GamePlayer
    {
        if ($room->isIcebreaker()) {
            return $this->participantPlayer($request, $room);
        }

        $user = $request->user();

        if ($user !== null && $user->can('view', $room->team)) {
            return GamePlayer::query()->firstOrCreate([
                'game_room_id' => $room->id,
                'user_id' => $user->id,
            ]);
        }

        return $this->guest($request, $room);
    }

    /**
     * Icebreaker access follows the retro: whoever is a participant plays.
     */
    private function participantPlayer(Request $request, GameRoom $room): ?GamePlayer
    {
        $retro = $room->retro;

        if ($retro === null) {
            return null;
        }

        $participant = $this->resolveParticipant->handle($request, $retro);

        if ($participant === null) {
            return null;
        }

        return GamePlayer::query()->firstOrCreate([
            'game_room_id' => $room->id,
            'participant_id' => $participant->id,
        ]);
    }

    private function guest(Request $request, GameRoom $room): ?GamePlayer
    {
        if ($room->access !== GameRoomAccess::Link) {
            return null;
        }

        $credentials = GuestCookie::parse($request->cookie(GuestCookie::name(GuestCookie::GameScope, $room->id)));

        if ($credentials === null) {
            return null;
        }

        [$playerId, $secret] = $credentials;

        $player = $room->players()
            ->whereKey($playerId)
            ->whereNull('user_id')
            ->whereNull('participant_id')
            ->whereNotNull('guest_secret_hash')
            ->first();

        if ($player === null) {
            return null;
        }

        if (! hash_equals((string) $player->guest_secret_hash, hash('sha256', $secret))) {
            return null;
        }

        return $player;
    }
}
```

- [ ] **Step 4: Write `GameGuard`**

Create `app/Actions/Games/GameGuard.php`:

```php
<?php

namespace App\Actions\Games;

use App\Actions\Retros\RetroGuard;
use App\Enums\GameKind;
use App\Enums\RetroPhase;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class GameGuard
{
    /**
     * Standalone rooms are always playable; an icebreaker only during its
     * retro's Icebreaker phase and while the board is not locked.
     */
    public static function mutable(GameRoom $room): void
    {
        if (! $room->isIcebreaker()) {
            return;
        }

        $retro = $room->retro;

        if ($retro === null || $retro->phase !== RetroPhase::Icebreaker) {
            throw new AuthorizationException(__('The game can only be played during the icebreaker.'));
        }

        RetroGuard::unlocked($retro);
    }

    public static function host(GameRoom $room, GamePlayer $player): void
    {
        if ($room->isHost($player)) {
            return;
        }

        throw new AuthorizationException(__('Only the host can do this.'));
    }

    public static function manager(GameRoom $room, GamePlayer $player): void
    {
        if ($room->isManager($player)) {
            return;
        }

        throw new AuthorizationException(__('Only the host, the room creator or a workspace admin can do this.'));
    }

    public static function canDelete(GameRoom $room, GamePlayer $player): void
    {
        if ($room->isCreator($player)) {
            return;
        }

        if ($player->account()?->canManage($room->team->workspace)) {
            return;
        }

        throw new AuthorizationException(__('Only the room creator or a workspace admin can delete this room.'));
    }

    public static function standalone(GameRoom $room): void
    {
        if (! $room->isIcebreaker()) {
            return;
        }

        throw new NotFoundHttpException;
    }

    public static function member(GamePlayer $player): void
    {
        if (! $player->isGuest()) {
            return;
        }

        throw new AuthorizationException(__('Guests cannot do this.'));
    }

    public static function activeRound(GameRoom $room, GameRound $round): void
    {
        if ($room->current_round_id === $round->id && $round->isActive()) {
            return;
        }

        throw new ConflictHttpException(__('This round is over.'));
    }

    public static function roundGame(GameRound $round, GameKind ...$games): void
    {
        if (in_array($round->game, $games, true)) {
            return;
        }

        throw ValidationException::withMessages(['round' => __('This action does not apply to this game.')]);
    }

    public static function leaderOrHost(GameRoom $room, GameRound $round, GamePlayer $player): void
    {
        if ($round->leader_player_id === $player->id || $room->isHost($player)) {
            return;
        }

        throw new AuthorizationException(__('Only the leader or the host can do this.'));
    }
}
```

- [ ] **Step 5: Write the middleware and controllers**

Create `app/Http/Middleware/ResolveGamePlayer.php`:

```php
<?php

namespace App\Http\Middleware;

use App\Actions\Games\FindGamePlayer;
use App\Actions\Retros\GuestCookie;
use App\Enums\GameRoomAccess;
use App\Models\GameRoom;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class ResolveGamePlayer
{
    public function __construct(private FindGamePlayer $findGamePlayer) {}

    public function handle(Request $request, Closure $next): Response
    {
        $room = $request->route('room');

        abort_unless($room instanceof GameRoom, 404);

        $player = $this->findGamePlayer->handle($request, $room);

        if ($player === null && $request->user() === null && ! $request->expectsJson()) {
            return $this->sendToLogin($request, $room);
        }

        if ($player === null) {
            abort_if($request->user() === null && ! $request->cookies->has($this->guestCookieName($room)), 401, __('Your session has expired.'));

            abort(403, __('You no longer have access to this room.'));
        }

        $request->attributes->set('gamePlayer', $player);

        return $next($request);
    }

    private function guestCookieName(GameRoom $room): string
    {
        if ($room->retro_id !== null) {
            return GuestCookie::name(GuestCookie::RetroScope, $room->retro_id);
        }

        return GuestCookie::name(GuestCookie::GameScope, $room->id);
    }

    /**
     * Once the guest cookie is gone, an expired guest cannot be told apart
     * from a logged-out member, so link rooms explain both ways back.
     */
    private function sendToLogin(Request $request, GameRoom $room): Response
    {
        if ($room->isIcebreaker() || $room->access !== GameRoomAccess::Link) {
            return redirect()->guest(route('login'));
        }

        redirect()->setIntendedUrl($request->fullUrl());

        return Inertia::render('retros/session-ended')->toResponse($request);
    }
}
```

Create `app/Http/Controllers/Games/GameRoomsController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\BuildGameSnapshot;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class GameRoomsController extends Controller
{
    public function show(Request $request, GameRoom $room, BuildGameSnapshot $buildGameSnapshot): Response
    {
        if ($room->retro_id !== null) {
            return to_route('retros.show', $room->retro_id);
        }

        return Inertia::render('games/show', [
            'snapshot' => $buildGameSnapshot->handle($room, GamePlayer::current($request)),
        ])->toResponse($request);
    }
}
```

Create `app/Http/Controllers/Games/GameSnapshotsController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\BuildGameSnapshot;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameSnapshotsController extends Controller
{
    public function show(Request $request, GameRoom $room, BuildGameSnapshot $buildGameSnapshot): JsonResponse
    {
        return response()->json($buildGameSnapshot->handle($room, GamePlayer::current($request)));
    }
}
```

Create `app/Http/Controllers/GameJoinsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Games\FindGamePlayer;
use App\Actions\Retros\GuestCookie;
use App\Enums\GameRoomAccess;
use App\Models\GameRoom;
use App\Support\Games\GuestNames;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class GameJoinsController extends Controller
{
    public function show(Request $request, string $guestToken, FindGamePlayer $findGamePlayer): Response
    {
        $room = $this->findRoom($guestToken);

        if ($room === null) {
            return $this->invalidLink($request);
        }

        if ($findGamePlayer->handle($request, $room) !== null) {
            return to_route('games.show', $room);
        }

        return Inertia::render('games/join', [
            'isInvalid' => false,
            'guestToken' => $guestToken,
            'roomName' => $room->name,
            'gameLabel' => $room->game->label(),
            'suggestedName' => GuestNames::random(app()->getLocale()),
        ])->toResponse($request);
    }

    public function store(Request $request, string $guestToken, FindGamePlayer $findGamePlayer): Response
    {
        $room = $this->findRoom($guestToken);

        if ($room === null) {
            return $this->invalidLink($request);
        }

        if ($findGamePlayer->handle($request, $room) !== null) {
            return to_route('games.show', $room);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50'],
        ]);

        $secret = Str::random(40);

        $player = $room->players()->create([
            'guest_name' => $validated['name'],
            'guest_secret_hash' => hash('sha256', $secret),
        ]);

        return to_route('games.show', $room)
            ->withCookie(GuestCookie::make(GuestCookie::GameScope, $room->id, $player->id, $secret));
    }

    private function findRoom(string $guestToken): ?GameRoom
    {
        return GameRoom::query()
            ->whereNull('retro_id')
            ->where('guest_token', $guestToken)
            ->where('access', GameRoomAccess::Link)
            ->first();
    }

    private function invalidLink(Request $request): Response
    {
        return Inertia::render('games/join', ['isInvalid' => true])
            ->toResponse($request)
            ->setStatusCode(404);
    }
}
```

- [ ] **Step 6: Register the routes**

In `routes/web.php` add the imports:

```php
use App\Http\Controllers\GameJoinsController;
use App\Http\Controllers\Games\GameRoomsController;
use App\Http\Controllers\Games\GameSnapshotsController;
use App\Http\Middleware\ResolveGamePlayer;
```

and insert after the `poker/{game}` group, before `Route::post('broadcasting/auth', …)`:

```php
Route::get('play/{guestToken}', [GameJoinsController::class, 'show'])->name('games.join.show');
Route::post('play/{guestToken}', [GameJoinsController::class, 'store'])->name('games.join.store')->middleware('throttle:10,1');

Route::prefix('games/{room}')
    ->whereUuid('room')
    ->middleware(ResolveGamePlayer::class)
    ->scopeBindings()
    ->group(function () {
        Route::get('/', [GameRoomsController::class, 'show'])->name('games.show');
        Route::get('snapshot', [GameSnapshotsController::class, 'show'])->name('games.snapshot.show');
    });
```

- [ ] **Step 7: Unskip the earlier tests**

In `tests/Feature/Games/GameSnapshotTest.php` delete the line `})->skip(fn () => ! Route::has('games.join.show'), 'Unskipped by Task 5, which registers the join route.');` and replace it with `});`.

In `tests/Feature/Games/GameModelTest.php`, in "creates a standalone room with casts and defaults", replace `->and($room->toArray())->not->toHaveKey('guest_token');` with:

```php
        ->and($room->toArray())->not->toHaveKey('guest_token')
        ->and($room->guestUrl())->toBe(route('games.join.show', $room->guest_token));
```

- [ ] **Step 8: Run the tests**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && vendor/bin/sail artisan test --compact tests/Feature/Games`
Expected: PASS.

- [ ] **Step 9: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| You no longer have access to this room. | Vous n'avez plus accès à ce salon. | Ya no tienes acceso a esta sala. | Du hast keinen Zugriff mehr auf diesen Raum. |
| The game can only be played during the icebreaker. | Le jeu n'est disponible que pendant l'icebreaker. | El juego solo está disponible durante el rompehielos. | Das Spiel ist nur während des Eisbrechers verfügbar. |
| Only the host can do this. | Seul l'hôte peut faire cela. | Solo el anfitrión puede hacer esto. | Nur der Host kann das tun. |
| Only the host, the room creator or a workspace admin can do this. | Seuls l'hôte, le créateur du salon ou un administrateur de l'espace de travail peuvent faire cela. | Solo el anfitrión, quien creó la sala o un administrador del espacio de trabajo pueden hacer esto. | Nur der Host, die Person, die den Raum erstellt hat, oder ein Workspace-Admin kann das tun. |
| Only the room creator or a workspace admin can delete this room. | Seuls le créateur du salon ou un administrateur de l'espace de travail peuvent supprimer ce salon. | Solo quien creó la sala o un administrador del espacio de trabajo pueden eliminarla. | Nur die Person, die den Raum erstellt hat, oder ein Workspace-Admin kann ihn löschen. |
| Guests cannot do this. | Les invités ne peuvent pas faire cela. | Los invitados no pueden hacer esto. | Gäste können das nicht tun. |
| This round is over. | Cette manche est terminée. | Esta ronda ha terminado. | Diese Runde ist vorbei. |
| This action does not apply to this game. | Cette action ne s'applique pas à ce jeu. | Esta acción no se aplica a este juego. | Diese Aktion gilt nicht für dieses Spiel. |
| Only the leader or the host can do this. | Seuls le meneur ou l'hôte peuvent faire cela. | Solo quien dirige la ronda o el anfitrión pueden hacer esto. | Nur die Rundenleitung oder der Host kann das tun. |

Check the icebreaker label already used by spec 2 (`Icebreaker` key) and reuse its translation word in fr/es/de if it differs from the table above (`grep '"Icebreaker"' lang/*.json`), so both strings name the phase the same way.

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php` — Expected: PASS.

- [ ] **Step 10: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Games/FindGamePlayer.php app/Actions/Games/GameGuard.php app/Http/Middleware/ResolveGamePlayer.php app/Http/Controllers/Games app/Http/Controllers/GameJoinsController.php routes/web.php tests/Feature/Games lang
git commit -m "feat(games): resolve room players, guard rooms and join by link

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 6: Presence channel `presence-game.{roomId}` with the 12-player cap

**Files:**
- Create: `app/Contracts/GamePresenceRoster.php`, `app/Support/Games/ReverbGamePresenceRoster.php`
- Modify: `app/Providers/AppServiceProvider.php` (bind the roster), `app/Http/Controllers/BroadcastAuthorizationsController.php` (new branch), `tests/Pest.php` (`fakeGameRoster`)
- Test: create `tests/Feature/Games/GameBroadcastAuthorizationTest.php`, `tests/Feature/Games/ReverbGamePresenceRosterTest.php`

**Interfaces:**
- Consumes: `FindGamePlayer` (Task 5), `GameRoom::MaxOnlinePlayers`.
- Produces: `App\Contracts\GamePresenceRoster::presenceIds(GameRoom $room): ?array` (unique presence ids on `presence-game.{roomId}`, `null` when Reverb cannot be read); `ReverbGamePresenceRoster` (dedicated Pusher client, 2 s timeout, logs "Game presence roster unavailable."); `fakeGameRoster(?array $presenceIds)`; channel auth branch refusing icebreaker rooms and a 13th distinct member with 403 "This room is full." (fail open when the roster is `null`).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Games/GameBroadcastAuthorizationTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\GameRoom;
use App\Models\Retro;
use App\Models\User;

beforeEach(function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);
    fakeGameRoster([]);
});

function gameChannelRequest(string $channelName): array
{
    return [
        'socket_id' => '1234.5678',
        'channel_name' => $channelName,
    ];
}

it('signs presence data for a team member', function () {
    $room = GameRoom::factory()->create();
    [$user, $player] = gameRoomMember($room);

    $response = $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), gameChannelRequest("presence-game.{$room->id}"))
        ->assertOk();

    $channelData = json_decode($response->json('channel_data'), true);

    expect($response->json('auth'))->toStartWith('test-key:')
        ->and($channelData['user_id'])->toBe($player->id)
        ->and($channelData['user_info'])->toBe([
            'id' => $player->id,
            'name' => $user->name,
            'avatarUrl' => $player->avatarUrl(),
            'isGuest' => false,
        ]);
});

it('signs presence data for a guest of a link room', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    $guest = gameRoomGuest($room);

    $response = $this->withCookies(gameGuestCookie($guest))
        ->withCredentials()
        ->postJson(route('broadcasting.auth'), gameChannelRequest("presence-game.{$room->id}"))
        ->assertOk();

    expect(json_decode($response->json('channel_data'), true)['user_info']['isGuest'])->toBeTrue();
});

it('refuses outsiders, unknown rooms and malformed ids', function (string $channel) {
    $room = GameRoom::factory()->create();
    $channel = str_replace('{room}', $room->id, $channel);

    $this->actingAs(User::factory()->create())
        ->postJson(route('broadcasting.auth'), gameChannelRequest($channel))
        ->assertForbidden();
})->with([
    'outsider' => ['presence-game.{room}'],
    'unknown room' => ['presence-game.'.'0199a0a0-0000-7000-8000-000000000000'],
    'malformed id' => ['presence-game.not-a-uuid'],
]);

it('refuses the game channel of an icebreaker room', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    [$user] = retroMember($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create();

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), gameChannelRequest("presence-game.{$room->id}"))
        ->assertForbidden();
});

it('refuses a thirteenth player while twelve are online', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomMember($room);
    fakeGameRoster(array_map(fn (int $index): string => "online-{$index}", range(1, 12)));

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), gameChannelRequest("presence-game.{$room->id}"))
        ->assertForbidden()
        ->assertJsonPath('message', __('This room is full.'));
});

it('lets an online player reconnect when the room is full', function () {
    $room = GameRoom::factory()->create();
    [$user, $player] = gameRoomMember($room);
    fakeGameRoster([$player->id, ...array_map(fn (int $index): string => "online-{$index}", range(1, 11))]);

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), gameChannelRequest("presence-game.{$room->id}"))
        ->assertOk();
});

it('admits eleven others plus the requester', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomMember($room);
    fakeGameRoster(array_map(fn (int $index): string => "online-{$index}", range(1, 11)));

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), gameChannelRequest("presence-game.{$room->id}"))
        ->assertOk();
});

it('fails open when Reverb cannot be reached', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomMember($room);
    fakeGameRoster(null);

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), gameChannelRequest("presence-game.{$room->id}"))
        ->assertOk();
});
```

Create `tests/Feature/Games/ReverbGamePresenceRosterTest.php`:

```php
<?php

use App\Models\GameRoom;
use App\Support\Games\ReverbGamePresenceRoster;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use Illuminate\Support\Facades\Log;

beforeEach(function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
        'broadcasting.connections.reverb.options' => ['host' => 'reverb.test', 'port' => 8080, 'scheme' => 'http', 'useTLS' => false],
    ]);
});

/**
 * @param  array<int, mixed>  $responses
 * @param  array<int, array<string, mixed>>  $history
 */
function gameRosterClient(array $responses, array &$history = []): Client
{
    $stack = HandlerStack::create(new MockHandler($responses));
    $stack->push(Middleware::history($history));

    return new Client(['handler' => $stack]);
}

it('returns the unique presence ids of the room channel', function () {
    $room = GameRoom::factory()->create();
    $history = [];
    $client = gameRosterClient([new Response(200, [], (string) json_encode([
        'users' => [['id' => 'a'], ['id' => 'a'], ['id' => 'b']],
    ]))], $history);

    expect((new ReverbGamePresenceRoster($client))->presenceIds($room))->toBe(['a', 'b']);

    $request = $history[0]['request'];

    expect($request->getUri()->getPath())->toBe("/apps/test-app/channels/presence-game.{$room->id}/users")
        ->and($history[0]['options']['timeout'])->toBe(2);
});

it('returns null and logs the room id when Reverb is unreachable', function () {
    $room = GameRoom::factory()->create();
    Log::shouldReceive('warning')->once()->with('Game presence roster unavailable.', ['room' => $room->id]);

    $client = gameRosterClient([new ConnectException('down', new Request('GET', 'x'))]);

    expect((new ReverbGamePresenceRoster($client))->presenceIds($room))->toBeNull();
});

it('returns null when the default broadcaster is not reverb', function () {
    config(['broadcasting.default' => 'null']);
    $room = GameRoom::factory()->create();
    Log::shouldReceive('warning')->once();

    $client = gameRosterClient([new Response(200, [], '{"users":[{"id":"a"}]}')]);

    expect((new ReverbGamePresenceRoster($client))->presenceIds($room))->toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/GameBroadcastAuthorizationTest.php tests/Feature/Games/ReverbGamePresenceRosterTest.php`
Expected: FAIL — `Call to undefined function fakeGameRoster()`.

- [ ] **Step 3: Write the roster**

Create `app/Contracts/GamePresenceRoster.php`:

```php
<?php

namespace App\Contracts;

use App\Models\GameRoom;

interface GamePresenceRoster
{
    /**
     * The presence ids on the room's channel, or null when they cannot be read.
     *
     * @return array<int, string>|null
     */
    public function presenceIds(GameRoom $room): ?array;
}
```

Create `app/Support/Games/ReverbGamePresenceRoster.php`:

```php
<?php

namespace App\Support\Games;

use App\Contracts\GamePresenceRoster;
use App\Models\GameRoom;
use GuzzleHttp\Client;
use GuzzleHttp\ClientInterface;
use Illuminate\Support\Facades\Log;
use Pusher\Pusher;
use RuntimeException;
use Throwable;

class ReverbGamePresenceRoster implements GamePresenceRoster
{
    private const TimeoutSeconds = 2;

    public function __construct(private ?ClientInterface $client = null) {}

    public function presenceIds(GameRoom $room): ?array
    {
        try {
            $response = $this->pusher()->get("/channels/presence-game.{$room->id}/users", [], true);
        } catch (Throwable) {
            Log::warning('Game presence roster unavailable.', ['room' => $room->id]);

            return null;
        }

        $users = is_array($response) && is_array($response['users'] ?? null) ? $response['users'] : [];
        $ids = [];

        foreach ($users as $user) {
            if (is_array($user) && is_scalar($user['id'] ?? null)) {
                $ids[] = (string) $user['id'];
            }
        }

        return array_values(array_unique($ids));
    }

    /**
     * A dedicated client: a slow Reverb must not hold the channel
     * authorization for the broadcaster's 30 s default.
     */
    private function pusher(): Pusher
    {
        if (config('broadcasting.default') !== 'reverb') {
            throw new RuntimeException('Reverb is not the broadcaster.');
        }

        /** @var array{key: string, secret: string, app_id: string, options?: array<string, mixed>} $config */
        $config = config('broadcasting.connections.reverb');

        return new Pusher(
            (string) $config['key'],
            (string) $config['secret'],
            (string) $config['app_id'],
            [...($config['options'] ?? []), 'timeout' => self::TimeoutSeconds],
            $this->client ?? new Client(['timeout' => self::TimeoutSeconds, 'connect_timeout' => self::TimeoutSeconds]),
        );
    }
}
```

In `app/Providers/AppServiceProvider.php` add `use App\Contracts\GamePresenceRoster;` and `use App\Support\Games\ReverbGamePresenceRoster;`, and in `register()`:

```php
        $this->app->bind(GamePresenceRoster::class, fn (): GamePresenceRoster => new ReverbGamePresenceRoster);
```

In `tests/Pest.php` add `use App\Contracts\GamePresenceRoster;` and append:

```php
/**
 * @param  array<int, string>|null  $presenceIds
 */
function fakeGameRoster(?array $presenceIds): void
{
    app()->instance(GamePresenceRoster::class, new class($presenceIds) implements GamePresenceRoster
    {
        /**
         * @param  array<int, string>|null  $presenceIds
         */
        public function __construct(private ?array $presenceIds) {}

        public function presenceIds(GameRoom $room): ?array
        {
            return $this->presenceIds;
        }
    });
}
```

- [ ] **Step 4: Authorize the channel**

In `app/Http/Controllers/BroadcastAuthorizationsController.php` add the imports `use App\Actions\Games\FindGamePlayer;`, `use App\Contracts\GamePresenceRoster;`, `use App\Models\GameRoom;`. Change the `store` signature and add the branch first in the method body (before the poker branch):

```php
    public function store(
        Request $request,
        ResolveParticipant $resolveParticipant,
        ResolvePlayer $resolvePlayer,
        FindGamePlayer $findGamePlayer,
        GamePresenceRoster $gamePresenceRoster,
    ): JsonResponse {
        /** @var array{socket_id: string, channel_name: string} $validated */
        $validated = $request->validate([
            'socket_id' => ['required', 'string', 'regex:/^\d+\.\d+$/'],
            'channel_name' => ['required', 'string'],
        ]);

        if (str_starts_with($validated['channel_name'], 'presence-game.')) {
            return $this->authorizeGameChannel($request, $validated, $findGamePlayer, $gamePresenceRoster);
        }
```

(keep the rest of the method unchanged) and add the method after `authorizePokerChannel`:

```php
    /**
     * Standalone rooms only (icebreakers play on the retro channel), capped
     * at twelve distinct online players; a player already online may always
     * reconnect, and an unreadable roster lets everyone in.
     *
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeGameChannel(Request $request, array $validated, FindGamePlayer $findGamePlayer, GamePresenceRoster $gamePresenceRoster): JsonResponse
    {
        $roomId = Str::after($validated['channel_name'], 'presence-game.');

        abort_unless(Str::isUuid($roomId), 403);

        $room = GameRoom::query()->find($roomId);

        abort_if($room === null, 403);
        abort_unless($room->id === $roomId, 403);
        abort_if($room->isIcebreaker(), 403);

        $player = $findGamePlayer->handle($request, $room);

        abort_if($player === null, 403);

        $online = $gamePresenceRoster->presenceIds($room);

        abort_if(
            $online !== null && ! in_array($player->id, $online, true) && count($online) >= GameRoom::MaxOnlinePlayers,
            403,
            __('This room is full.'),
        );

        $signature = $this->pusher()->authorizePresenceChannel(
            $validated['channel_name'],
            $validated['socket_id'],
            $player->id,
            [
                'id' => $player->id,
                'name' => $player->displayName(),
                'avatarUrl' => $player->avatarUrl(),
                'isGuest' => $player->isGuest(),
            ],
        );

        return response()->json(json_decode($signature, true));
    }
```

- [ ] **Step 5: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/GameBroadcastAuthorizationTest.php tests/Feature/Games/ReverbGamePresenceRosterTest.php tests/Feature/Poker/PokerBroadcastAuthorizationTest.php tests/Feature/Retros`
Expected: PASS.

- [ ] **Step 6: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| This room is full. | Ce salon est complet. | Esta sala está llena. | Dieser Raum ist voll. |

- [ ] **Step 7: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Contracts/GamePresenceRoster.php app/Support/Games/ReverbGamePresenceRoster.php app/Providers/AppServiceProvider.php app/Http/Controllers/BroadcastAuthorizationsController.php tests/Pest.php tests/Feature/Games/GameBroadcastAuthorizationTest.php tests/Feature/Games/ReverbGamePresenceRosterTest.php lang
git commit -m "feat(games): authorize room presence with a twelve-player cap

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 7: Standalone rooms — list, create, settings, delete, guest link and hosting

**Files:**
- Create: `app/Actions/Games/CreateGameRoom.php`, `app/Actions/Games/PresentGameRoomSummary.php`
- Create: `app/Http/Controllers/TeamGameRoomsController.php`, `app/Http/Controllers/Games/GameGuestTokensController.php`, `app/Http/Controllers/Games/GameHostsController.php`
- Modify: `app/Http/Controllers/Games/GameRoomsController.php` (`update`, `destroy`), `app/Policies/TeamPolicy.php` (`createGameRoom`), `routes/web.php`
- Test: create `tests/Feature/Games/GameRoomsTest.php`

**Interfaces:**
- Consumes: `GameRulesRegistry::isAvailable/options`, `GameGuard`, `GameRoomChanged`, `GameRoomDeleted`, `GamePlayer::current`.
- Produces: `CreateGameRoom::handle(Team $team, User $user, string $name, GameKind $game, GameRoomAccess $access): GameRoom` (team row locked, 10-room cap on standalone rooms, locale = request locale, creator player as host); `PresentGameRoomSummary::query(Team): HasMany` and `handle(GameRoom): array{id, name, game, gameLabel, access, playersCount, roundsCount, updatedAt}`; `TeamPolicy::createGameRoom(User, Team)`; Inertia page `games/index` with props `workspace {id, name, slug}`, `team {id, name}`, `rooms`, `gameOptions`, `canCreate`, `roomLimit` (13d adds `period` and the deferred `leaderboard`); routes `teams.games.index`, `teams.games.store`, `games.update` (204), `games.destroy` (204), `games.guest-token.store` (`{guestUrl}`), `games.host.update` (204, body `player_id`).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Games/GameRoomsTest.php`:

```php
<?php

use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Enums\RetroPhase;
use App\Events\Games\GameRoomChanged;
use App\Events\Games\GameRoomDeleted;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\FakeGameRules;

beforeEach(function () {
    Event::fake();
    bindGameRules(new FakeGameRules(kind: GameKind::Hangman));
});

/**
 * @return array<string, string>
 */
function teamGamesParams(Team $team): array
{
    return ['workspace' => $team->workspace->slug, 'team' => $team->id];
}

it('lists the standalone rooms of the team', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $room = GameRoom::factory()->create(['team_id' => $team->id, 'name' => 'Lunch']);
    GamePlayer::factory()->count(2)->create(['game_room_id' => $room->id]);
    GameRound::factory()->ended()->create(['game_room_id' => $room->id]);
    activeGameRound($room);
    GameRoom::factory()->icebreaker(Retro::factory()->inPhase(RetroPhase::Icebreaker)->create(['team_id' => $team->id]))->create();
    GameRoom::factory()->create();

    $this->actingAs($user)
        ->get(route('teams.games.index', teamGamesParams($team)))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('team.id', $team->id)
            ->has('rooms', 1)
            ->where('rooms.0', [
                'id' => $room->id,
                'name' => 'Lunch',
                'game' => 'hangman',
                'gameLabel' => __('Hangman'),
                'access' => 'team',
                'playersCount' => 2,
                'roundsCount' => 1,
                'updatedAt' => $room->fresh()->updated_at?->toIso8601String(),
            ])
            ->where('canCreate', true)
            ->where('roomLimit', 10)
            ->where('gameOptions.2', ['value' => 'hangman', 'label' => __('Hangman'), 'available' => true]));
});

it('keeps the games page to team viewers', function () {
    $team = Team::factory()->create();
    $outsider = User::factory()->create();
    $team->workspace->members()->attach($outsider, ['role' => 'member']);

    $this->actingAs($outsider)->get(route('teams.games.index', teamGamesParams($team)))->assertForbidden();
    $this->actingAs(workspaceManager($team->workspace))->get(route('teams.games.index', teamGamesParams($team)))->assertOk();
});

it('creates a room hosted by its creator in the creator locale', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $user->forceFill(['locale' => 'fr'])->save();

    $this->actingAs($user)
        ->post(route('teams.games.store', teamGamesParams($team)), ['name' => 'Coffee break', 'game' => 'hangman', 'access' => 'link'])
        ->assertRedirect();

    $room = GameRoom::query()->sole();
    $host = $room->players()->sole();

    expect($room->name)->toBe('Coffee break')
        ->and($room->game)->toBe(GameKind::Hangman)
        ->and($room->access)->toBe(GameRoomAccess::Link)
        ->and($room->locale)->toBe('fr')
        ->and($room->created_by_user_id)->toBe($user->id)
        ->and($room->host_player_id)->toBe($host->id)
        ->and($host->user_id)->toBe($user->id)
        ->and(strlen($room->guest_token))->toBe(40);
});

it('caps a team at ten standalone rooms', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    GameRoom::factory()->count(10)->create(['team_id' => $team->id]);
    GameRoom::factory()->icebreaker(Retro::factory()->create(['team_id' => $team->id]))->create();

    $this->actingAs($user)
        ->post(route('teams.games.store', teamGamesParams($team)), ['name' => 'Eleventh', 'game' => 'hangman', 'access' => 'team'])
        ->assertSessionHasErrors(['name' => __('This team already has 10 game rooms.')]);

    $this->actingAs($user)
        ->get(route('teams.games.index', teamGamesParams($team)))
        ->assertInertia(fn (Assert $page) => $page->where('canCreate', false));
});

it('does not count icebreaker rooms against the cap', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    GameRoom::factory()->count(9)->create(['team_id' => $team->id]);
    GameRoom::factory()->icebreaker(Retro::factory()->create(['team_id' => $team->id]))->create();

    $this->actingAs($user)
        ->post(route('teams.games.store', teamGamesParams($team)), ['name' => 'Tenth', 'game' => 'hangman', 'access' => 'team'])
        ->assertSessionHasNoErrors();
});

it('validates new rooms', function (array $input, string $field) {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $this->actingAs($user)
        ->post(route('teams.games.store', teamGamesParams($team)), [...['name' => 'Room', 'game' => 'hangman', 'access' => 'team'], ...$input])
        ->assertSessionHasErrors($field);

    expect(GameRoom::query()->count())->toBe(0);
})->with([
    'missing name' => [['name' => ''], 'name'],
    'long name' => [['name' => str_repeat('a', 61)], 'name'],
    'unknown game' => [['game' => 'chess'], 'game'],
    'unavailable game' => [['game' => 'draw'], 'game'],
    'unknown access' => [['access' => 'public'], 'access'],
]);

it('lets the host rename a room and change its access and locale', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);

    $this->actingAs($user)
        ->patchJson(route('games.update', $room), ['name' => 'Renamed', 'access' => 'link', 'locale' => 'de'])
        ->assertNoContent();

    expect($room->fresh())
        ->name->toBe('Renamed')
        ->access->toBe(GameRoomAccess::Link)
        ->locale->toBe('de');

    Event::assertDispatched(GameRoomChanged::class, fn (GameRoomChanged $event) => $event->roomId === $room->id);
});

it('keeps room settings to managers', function () {
    $room = GameRoom::factory()->create();
    gameRoomHost($room);
    [$member] = gameRoomMember($room);

    $this->actingAs($member)->patchJson(route('games.update', $room), ['name' => 'Mine'])->assertForbidden();
    $this->actingAs(workspaceManager($room->team->workspace))->patchJson(route('games.update', $room), ['name' => 'Admin'])->assertNoContent();
});

it('validates room settings', function (array $input) {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);

    $this->actingAs($user)->patchJson(route('games.update', $room), $input)->assertUnprocessable();
})->with([
    [['name' => '']],
    [['name' => str_repeat('a', 61)]],
    [['access' => 'public']],
    [['locale' => 'it']],
]);

it('only changes the locale of an icebreaker room', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    [$user, $facilitator] = retroFacilitator($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create();

    $this->actingAs($user)->patchJson(route('games.update', $room), ['name' => 'Nope'])->assertUnprocessable();
    $this->actingAs($user)->patchJson(route('games.update', $room), ['locale' => 'es'])->assertNoContent();

    expect($room->fresh()->locale)->toBe('es');
});

it('lets the creator or an admin delete a room', function (string $who) {
    $room = GameRoom::factory()->create();
    [$creator, $creatorPlayer] = gameRoomHost($room);
    $room->forceFill(['created_by_user_id' => $creator->id])->save();
    activeGameRound($room);
    $actor = $who === 'creator' ? $creator : workspaceManager($room->team->workspace);

    $this->actingAs($actor)->deleteJson(route('games.destroy', $room))->assertNoContent();

    expect(GameRoom::query()->count())->toBe(0)
        ->and(GamePlayer::query()->count())->toBe(0)
        ->and(GameRound::query()->count())->toBe(0);

    Event::assertDispatched(GameRoomDeleted::class, fn (GameRoomDeleted $event) => $event->roomId === $room->id);
})->with(['creator', 'admin']);

it('refuses deletion to hosts who did not create the room and to members', function () {
    $room = GameRoom::factory()->create(['created_by_user_id' => User::factory()]);
    [$host] = gameRoomHost($room);
    [$member] = gameRoomMember($room);

    $this->actingAs($host)->deleteJson(route('games.destroy', $room))->assertForbidden();
    $this->actingAs($member)->deleteJson(route('games.destroy', $room))->assertForbidden();
});

it('never deletes an icebreaker room on its own', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    $room = GameRoom::factory()->icebreaker($retro)->create();

    $this->actingAs(workspaceManager($retro->team->workspace))->deleteJson(route('games.destroy', $room))->assertNotFound();
});

it('regenerates the guest link and revokes existing guests', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    [$user] = gameRoomHost($room);
    $guest = gameRoomGuest($room);
    $oldToken = $room->guest_token;

    $response = $this->actingAs($user)->postJson(route('games.guest-token.store', $room))->assertOk();

    $room->refresh();

    expect($room->guest_token)->not->toBe($oldToken)
        ->and($response->json('guestUrl'))->toBe(route('games.join.show', $room->guest_token))
        ->and($guest->fresh()->guest_secret_hash)->toBeNull();

    app('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))->getJson(route('games.snapshot.show', $room))->assertForbidden();
});

it('keeps the guest link to managers', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    gameRoomHost($room);
    [$member] = gameRoomMember($room);

    $this->actingAs($member)->postJson(route('games.guest-token.store', $room))->assertForbidden();
});

it('hands hosting to another member', function () {
    $room = GameRoom::factory()->create();
    [$hostUser] = gameRoomHost($room);
    [, $member] = gameRoomMember($room);

    $this->actingAs($hostUser)->putJson(route('games.host.update', $room), ['player_id' => $member->id])->assertNoContent();

    expect($room->fresh()->host_player_id)->toBe($member->id);
    Event::assertDispatched(GameRoomChanged::class);
});

it('never hands hosting to a guest or a player of another room', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    [$hostUser] = gameRoomHost($room);
    $guest = gameRoomGuest($room);
    $stranger = GamePlayer::factory()->create();

    $this->actingAs($hostUser)->putJson(route('games.host.update', $room), ['player_id' => $guest->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['player_id' => __('Only a team member can host.')]);
    $this->actingAs($hostUser)->putJson(route('games.host.update', $room), ['player_id' => $stranger->id])->assertUnprocessable();
});

it('lets the creator and admins become host, but not other members', function () {
    $room = GameRoom::factory()->create();
    gameRoomHost($room);
    [$creator, $creatorPlayer] = gameRoomMember($room);
    $room->forceFill(['created_by_user_id' => $creator->id])->save();
    [$member, $memberPlayer] = gameRoomMember($room);
    $admin = workspaceManager($room->team->workspace);
    $adminPlayer = GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $admin->id]);

    $this->actingAs($member)->putJson(route('games.host.update', $room), ['player_id' => $memberPlayer->id])
        ->assertForbidden()
        ->assertJsonPath('message', __('Only the room creator or a workspace admin can take hosting.'));

    $this->actingAs($creator)->putJson(route('games.host.update', $room), ['player_id' => $creatorPlayer->id])->assertNoContent();
    expect($room->fresh()->host_player_id)->toBe($creatorPlayer->id);

    $this->actingAs($admin)->putJson(route('games.host.update', $room), ['player_id' => $adminPlayer->id])->assertNoContent();
    expect($room->fresh()->host_player_id)->toBe($adminPlayer->id);
});

it('refuses host changes to non-hosts and in icebreaker rooms', function () {
    $room = GameRoom::factory()->create();
    [, $host] = gameRoomHost($room);
    [$member] = gameRoomMember($room);
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    [$facilitator] = retroFacilitator($retro);
    $icebreaker = GameRoom::factory()->icebreaker($retro)->create();

    $this->actingAs($member)->putJson(route('games.host.update', $room), ['player_id' => $host->id])->assertForbidden();
    $this->actingAs($facilitator)->putJson(route('games.host.update', $icebreaker), ['player_id' => fake()->uuid()])->assertNotFound();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/GameRoomsTest.php`
Expected: FAIL — `Route [teams.games.index] not defined.`

- [ ] **Step 3: Write the policy method and the actions**

In `app/Policies/TeamPolicy.php` add after `createPokerGame`:

```php
    public function createGameRoom(User $user, Team $team): bool
    {
        return $this->view($user, $team);
    }
```

Create `app/Actions/Games/CreateGameRoom.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Models\GameRoom;
use App\Models\Team;
use App\Models\User;
use App\Support\Games\GameRulesRegistry;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CreateGameRoom
{
    public function __construct(private GameRulesRegistry $gameRulesRegistry) {}

    public function handle(Team $team, User $user, string $name, GameKind $game, GameRoomAccess $access): GameRoom
    {
        return DB::transaction(function () use ($team, $user, $name, $game, $access): GameRoom {
            Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

            $count = GameRoom::query()->where('team_id', $team->id)->whereNull('retro_id')->count();

            if ($count >= GameRoom::MaxRoomsPerTeam) {
                throw ValidationException::withMessages(['name' => __('This team already has 10 game rooms.')]);
            }

            $room = new GameRoom([
                'team_id' => $team->id,
                'name' => $name,
                'created_by_user_id' => $user->id,
                'game' => $game,
                'locale' => app()->getLocale(),
                'access' => $access,
                'guest_token' => Str::random(40),
            ]);

            if (! $this->gameRulesRegistry->isAvailable($game, $room)) {
                throw ValidationException::withMessages(['game' => __('This game is not available.')]);
            }

            $room->save();

            $host = $room->players()->create(['user_id' => $user->id]);

            $room->forceFill(['host_player_id' => $host->id])->save();

            return $room;
        });
    }
}
```

Create `app/Actions/Games/PresentGameRoomSummary.php`:

```php
<?php

namespace App\Actions\Games;

use App\Models\GameRoom;
use App\Models\Team;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PresentGameRoomSummary
{
    /**
     * @return HasMany<GameRoom, Team>
     */
    public static function query(Team $team): HasMany
    {
        return $team->gameRooms()
            ->whereNull('retro_id')
            ->withCount(['players', 'rounds as ended_rounds_count' => fn ($query) => $query->whereNotNull('ended_at')])
            ->latest('updated_at');
    }

    /**
     * @return array{
     *     id: string,
     *     name: ?string,
     *     game: string,
     *     gameLabel: string,
     *     access: string,
     *     playersCount: int,
     *     roundsCount: int,
     *     updatedAt: ?string
     * }
     */
    public function handle(GameRoom $room): array
    {
        return [
            'id' => $room->id,
            'name' => $room->name,
            'game' => $room->game->value,
            'gameLabel' => $room->game->label(),
            'access' => $room->access->value,
            'playersCount' => (int) $room->getAttribute('players_count'),
            'roundsCount' => (int) $room->getAttribute('ended_rounds_count'),
            'updatedAt' => $room->updated_at?->toIso8601String(),
        ];
    }
}
```

- [ ] **Step 4: Write the controllers**

Create `app/Http/Controllers/TeamGameRoomsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Games\CreateGameRoom;
use App\Actions\Games\PresentGameRoomSummary;
use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Models\GameRoom;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\Games\GameRulesRegistry;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TeamGameRoomsController extends Controller
{
    public function index(Request $request, Workspace $workspace, Team $team, PresentGameRoomSummary $presentGameRoomSummary, GameRulesRegistry $gameRulesRegistry): Response
    {
        Gate::authorize('view', $team);

        $rooms = PresentGameRoomSummary::query($team)->get();

        return Inertia::render('games/index', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name']),
            'rooms' => $rooms->map(fn (GameRoom $room): array => $presentGameRoomSummary->handle($room))->values(),
            'gameOptions' => $gameRulesRegistry->options(new GameRoom(['team_id' => $team->id])),
            'canCreate' => $request->user()->can('createGameRoom', $team) && $rooms->count() < GameRoom::MaxRoomsPerTeam,
            'roomLimit' => GameRoom::MaxRoomsPerTeam,
        ]);
    }

    public function store(Request $request, Workspace $workspace, Team $team, CreateGameRoom $createGameRoom): RedirectResponse
    {
        Gate::authorize('createGameRoom', $team);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'game' => ['required', Rule::enum(GameKind::class)],
            'access' => ['required', Rule::enum(GameRoomAccess::class)],
        ]);

        $room = $createGameRoom->handle(
            $team,
            $request->user(),
            $validated['name'],
            GameKind::from($validated['game']),
            GameRoomAccess::from($validated['access']),
        );

        return to_route('games.show', $room);
    }
}
```

Replace `app/Http/Controllers/Games/GameRoomsController.php` with:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\BuildGameSnapshot;
use App\Actions\Games\GameGuard;
use App\Enums\GameRoomAccess;
use App\Events\Games\GameRoomChanged;
use App\Events\Games\GameRoomDeleted;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class GameRoomsController extends Controller
{
    public function show(Request $request, GameRoom $room, BuildGameSnapshot $buildGameSnapshot): Response
    {
        if ($room->retro_id !== null) {
            return to_route('retros.show', $room->retro_id);
        }

        return Inertia::render('games/show', [
            'snapshot' => $buildGameSnapshot->handle($room, GamePlayer::current($request)),
        ])->toResponse($request);
    }

    public function update(Request $request, GameRoom $room): HttpResponse
    {
        $player = GamePlayer::current($request);

        GameGuard::manager($room, $player);

        $locales = Rule::in(config('skrum.locales'));

        $validated = $request->validate($room->isIcebreaker()
            ? [
                'locale' => ['required', 'string', $locales],
                'name' => ['prohibited'],
                'access' => ['prohibited'],
            ]
            : [
                'name' => ['sometimes', 'required', 'string', 'max:60'],
                'access' => ['sometimes', 'required', Rule::enum(GameRoomAccess::class)],
                'locale' => ['sometimes', 'required', 'string', $locales],
            ]);

        DB::transaction(function () use ($room, $player, $validated): void {
            $locked = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();

            GameGuard::manager($locked, $player);

            $locked->update($validated);

            (new GameRoomChanged($locked))->sendToOthers();
        });

        return response()->noContent();
    }

    public function destroy(Request $request, GameRoom $room): HttpResponse
    {
        $player = GamePlayer::current($request);

        GameGuard::standalone($room);
        GameGuard::canDelete($room, $player);

        DB::transaction(function () use ($room, $player): void {
            $locked = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();

            GameGuard::canDelete($locked, $player);

            $event = new GameRoomDeleted($locked);

            $locked->delete();

            $event->sendToOthers();
        });

        return response()->noContent();
    }
}
```

Create `app/Http/Controllers/Games/GameGuestTokensController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\GameGuard;
use App\Enums\GameRoomAccess;
use App\Events\Games\GameRoomChanged;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class GameGuestTokensController extends Controller
{
    /**
     * A new token revokes the posted link, and clearing the secrets signs
     * every current guest out: they must join again through the new link.
     */
    public function store(Request $request, GameRoom $room): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameGuard::standalone($room);
        GameGuard::manager($room, $player);

        $locked = DB::transaction(function () use ($room, $player): GameRoom {
            $locked = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();

            GameGuard::manager($locked, $player);

            $locked->update(['guest_token' => Str::random(40)]);
            $locked->players()->whereNotNull('guest_secret_hash')->update(['guest_secret_hash' => null]);

            (new GameRoomChanged($locked))->sendToOthers();

            return $locked;
        });

        return response()->json([
            'guestUrl' => $locked->access === GameRoomAccess::Link ? $locked->guestUrl() : null,
        ]);
    }
}
```

Create `app/Http/Controllers/Games/GameHostsController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\GameGuard;
use App\Events\Games\GameRoomChanged;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class GameHostsController extends Controller
{
    /**
     * The host hands hosting to a member player; the creator and workspace
     * Owners/Admins can take it at any time, so a room never stays stuck.
     */
    public function update(Request $request, GameRoom $room): Response
    {
        $player = GamePlayer::current($request);

        GameGuard::standalone($room);

        $validated = $request->validate([
            'player_id' => ['required', 'string', Rule::exists('game_players', 'id')->where('game_room_id', $room->id)],
        ]);

        DB::transaction(function () use ($room, $player, $validated): void {
            $locked = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();
            $target = GamePlayer::query()->with('user')->findOrFail($validated['player_id']);

            if ($target->id === $player->id) {
                $this->ensureCanTakeHosting($locked, $player);
            } else {
                GameGuard::host($locked, $player);
            }

            if ($target->isGuest() || ! ($target->user?->can('view', $locked->team) ?? false)) {
                throw ValidationException::withMessages(['player_id' => __('Only a team member can host.')]);
            }

            $locked->update(['host_player_id' => $target->id]);

            (new GameRoomChanged($locked))->sendToOthers();
        });

        return response()->noContent();
    }

    private function ensureCanTakeHosting(GameRoom $room, GamePlayer $player): void
    {
        if ($room->isHost($player) || $room->isCreator($player)) {
            return;
        }

        if ($player->account()?->canManage($room->team->workspace)) {
            return;
        }

        throw new AuthorizationException(__('Only the room creator or a workspace admin can take hosting.'));
    }
}
```

- [ ] **Step 5: Register the routes**

In `routes/web.php` add the imports `use App\Http\Controllers\Games\GameGuestTokensController;`, `use App\Http\Controllers\Games\GameHostsController;`, `use App\Http\Controllers\TeamGameRoomsController;`. Inside the `w/{workspace}` group, after the `teams/{team}/poker-decks/{pokerDeck}` delete route:

```php
            Route::get('teams/{team}/games', [TeamGameRoomsController::class, 'index'])->name('teams.games.index');
            Route::post('teams/{team}/games', [TeamGameRoomsController::class, 'store'])->name('teams.games.store');
```

Inside the `games/{room}` group, after the snapshot route:

```php
        Route::patch('/', [GameRoomsController::class, 'update'])->name('games.update');
        Route::delete('/', [GameRoomsController::class, 'destroy'])->name('games.destroy');
        Route::post('guest-token', [GameGuestTokensController::class, 'store'])->name('games.guest-token.store');
        Route::put('host', [GameHostsController::class, 'update'])->name('games.host.update');
```

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && vendor/bin/sail artisan test --compact tests/Feature/Games/GameRoomsTest.php`
Expected: PASS.

- [ ] **Step 7: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| This team already has 10 game rooms. | Cette équipe a déjà 10 salons de jeu. | Este equipo ya tiene 10 salas de juego. | Dieses Team hat bereits 10 Spielräume. |
| This game is not available. | Ce jeu n'est pas disponible. | Este juego no está disponible. | Dieses Spiel ist nicht verfügbar. |
| Only a team member can host. | Seul un membre de l'équipe peut être hôte. | Solo un miembro del equipo puede ser anfitrión. | Nur ein Teammitglied kann Host sein. |
| Only the room creator or a workspace admin can take hosting. | Seuls le créateur du salon ou un administrateur de l'espace de travail peuvent devenir hôte. | Solo quien creó la sala o un administrador del espacio de trabajo pueden ser anfitriones. | Nur die Person, die den Raum erstellt hat, oder ein Workspace-Admin kann Host werden. |

- [ ] **Step 8: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Games/CreateGameRoom.php app/Actions/Games/PresentGameRoomSummary.php app/Http/Controllers/TeamGameRoomsController.php app/Http/Controllers/Games app/Policies/TeamPolicy.php routes/web.php tests/Feature/Games/GameRoomsTest.php lang
git commit -m "feat(games): create, configure and delete standalone rooms

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 8: Round engine — start, end, points, pass, game switch, retention, history endpoints

**Files:**
- Create: `app/Actions/Games/{LockGameRound,StartGameRound,EndGameRound,AwardRoundPoints,PassGameRound,SwitchGame}.php`
- Create: `app/Http/Controllers/Games/{GameRoundsController,GameRoundPassesController,GameSwitchesController}.php`
- Modify: `routes/web.php`
- Test: create `tests/Feature/Games/GameRoundEngineTest.php`

**Interfaces:**
- Consumes: `GameRulesRegistry`, `GameGuard`, `PresentGameRound`, `PresentGameRoundHistory`, events of Task 4.
- Produces: `LockGameRound::handle(GameRoom $room, GameRound $round): array{0: GameRoom, 1: GameRound}` (locks the room, then the round; call inside a transaction — every round mutation of 13a–13c uses it); `StartGameRound`, `EndGameRound`, `AwardRoundPoints`, `PassGameRound`, `SwitchGame` with the signatures of the Contract section; routes `games.game.update` (PUT, body `game`, 204), `games.rounds.store` (POST, body `leader_player_id?`, 201 `{round, ended}` where `round` is presented for the host and `ended` is the `RoundEnded` payload of a round the start closed, else `null`), `games.rounds.index` (list of history rows), `games.rounds.show` (history row + `presentEnded`, 404 while active), `games.rounds.pass.store` (200 `{ended}`).

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Games/GameRoundEngineTest.php`:

```php
<?php

use App\Actions\Games\AwardRoundPoints;
use App\Actions\Games\EndGameRound;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Events\Games\GameRoomChanged;
use App\Events\Games\GameRoundEnded;
use App\Events\Games\GameRoundStarted;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Tests\Support\FakeGameRules;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
    $this->rules = new FakeGameRules;
    bindGameRules($this->rules);
});

it('starts a round for the host', function () {
    $room = GameRoom::factory()->create();
    [$user, $host] = gameRoomHost($room);

    $response = $this->actingAs($user)
        ->postJson(route('games.rounds.store', $room))
        ->assertCreated()
        ->assertJsonPath('round.game', 'hangman')
        ->assertJsonPath('round.viewerPlayerId', $host->id)
        ->assertJsonPath('ended', null);

    $round = GameRound::query()->sole();

    expect($response->json('round.id'))->toBe($round->id)
        ->and($round->word)->toBe('engine')
        ->and($round->started_at->toIso8601String())->toBe('2026-10-06T10:00:00+00:00')
        ->and($room->fresh()->current_round_id)->toBe($round->id)
        ->and(gamePayloadExposesWord($response->json(), 'engine'))->toBeFalse();

    Event::assertDispatched(GameRoundStarted::class, fn (GameRoundStarted $event) => $event->round['id'] === $round->id
        && $event->round['viewerPlayerId'] === null);
});

it('keeps starting rounds to the host', function () {
    $room = GameRoom::factory()->create();
    gameRoomHost($room);
    [$member] = gameRoomMember($room);

    $this->actingAs($member)->postJson(route('games.rounds.store', $room))->assertForbidden();

    expect(GameRound::query()->count())->toBe(0);
});

it('refuses a game without available rules', function () {
    $this->rules->available = false;
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['game' => __('This game is not available.')]);
});

it('refuses a second start while a round is active', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);
    activeGameRound($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))
        ->assertConflict()
        ->assertJsonPath('message', __('A round is already in progress.'));

    expect(GameRound::query()->count())->toBe(1);
});

it('closes the active round first when its rules allow it', function () {
    $this->rules->nextRoundOutcome = GameRoundOutcome::Revealed;
    $room = GameRoom::factory()->create();
    [$user, $host] = gameRoomHost($room);
    $previous = activeGameRound($room);
    $this->rules->points = [$host->id => ['points' => 4, 'isWin' => false]];

    $response = $this->actingAs($user)->postJson(route('games.rounds.store', $room))->assertCreated();

    expect($previous->fresh()->outcome)->toBe(GameRoundOutcome::Revealed)
        ->and($response->json('ended.roundId'))->toBe($previous->id)
        ->and($response->json('ended.points'))->toBe([['playerId' => $host->id, 'points' => 4, 'isWin' => false]])
        ->and($room->fresh()->current_round_id)->not->toBe($previous->id);
});

it('validates the leader of a new round', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);
    [, $member] = gameRoomMember($room);
    $stranger = GamePlayer::factory()->create();

    $this->actingAs($user)->postJson(route('games.rounds.store', $room), ['leader_player_id' => $stranger->id])->assertUnprocessable();
    $this->actingAs($user)->postJson(route('games.rounds.store', $room), ['leader_player_id' => $member->id])
        ->assertCreated()
        ->assertJsonPath('round.leaderPlayerId', $member->id);
});

it('keeps the newest twenty ended rounds and their points', function () {
    $room = GameRoom::factory()->create();
    [$user, $host] = gameRoomHost($room);
    $rounds = collect(range(1, 21))->map(fn (int $minutes) => GameRound::factory()->ended()->create([
        'game_room_id' => $room->id,
        'ended_at' => now()->subMinutes(30 - $minutes),
    ]));
    $oldest = $rounds->first();
    $point = GamePoint::factory()->create([
        'team_id' => $room->team_id,
        'game_room_id' => $room->id,
        'game_round_id' => $oldest->id,
        'player_id' => $host->id,
        'points' => 5,
    ]);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))->assertCreated();

    expect(GameRound::query()->whereNotNull('ended_at')->count())->toBe(20)
        ->and(GameRound::query()->find($oldest->id))->toBeNull()
        ->and($point->fresh()->game_round_id)->toBeNull()
        ->and($point->fresh()->points)->toBe(5);
});

it('ends a round once, awarding the points of its rules', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    [$user, $member] = gameRoomMember($room);
    $guest = gameRoomGuest($room);
    $round = activeGameRound($room);
    $this->rules->points = [
        $member->id => ['points' => 7, 'isWin' => true],
        $guest->id => ['points' => 0, 'isWin' => false],
    ];

    $payload = app(EndGameRound::class)->handle($room, $round, GameRoundOutcome::Solved, $member);

    expect($payload)->toBe([
        'roundId' => $round->id,
        'outcome' => 'solved',
        'word' => 'sprint',
        'winnerPlayerId' => $member->id,
        'leaderPlayerId' => null,
        'fakeExtra' => true,
        'points' => [
            ['playerId' => $member->id, 'points' => 7, 'isWin' => true],
            ['playerId' => $guest->id, 'points' => 0, 'isWin' => false],
        ],
    ]);

    $memberPoint = GamePoint::query()->where('player_id', $member->id)->sole();

    expect($memberPoint->user_id)->toBe($user->id)
        ->and($memberPoint->team_id)->toBe($room->team_id)
        ->and($memberPoint->game)->toBe(GameKind::Hangman)
        ->and($memberPoint->is_win)->toBeTrue()
        ->and(GamePoint::query()->where('player_id', $guest->id)->sole()->user_id)->toBeNull()
        ->and(app(EndGameRound::class)->handle($room, $round->fresh(), GameRoundOutcome::Passed))->toBeNull()
        ->and(GamePoint::query()->count())->toBe(2)
        ->and($round->fresh()->outcome)->toBe(GameRoundOutcome::Solved);

    Event::assertDispatchedTimes(GameRoundEnded::class, 1);
});

it('awards nothing for abandoned rounds', function () {
    $room = GameRoom::factory()->create();
    [, $member] = gameRoomMember($room);
    $round = activeGameRound($room);
    $this->rules->points = [$member->id => ['points' => 3, 'isWin' => false]];

    $payload = app(EndGameRound::class)->handle($room, $round, GameRoundOutcome::Abandoned);

    expect($payload['points'])->toBe([])
        ->and(GamePoint::query()->count())->toBe(0);
});

it('copies the participant user of icebreaker players and ignores players of other rooms', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    [$user, $participant] = retroMember($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create();
    $player = GamePlayer::factory()->forParticipant($participant)->create(['game_room_id' => $room->id]);
    $stranger = GamePlayer::factory()->create();
    $round = activeGameRound($room);
    $this->rules->points = [
        $player->id => ['points' => 2, 'isWin' => false],
        $stranger->id => ['points' => 9, 'isWin' => true],
    ];

    $awarded = app(AwardRoundPoints::class)->handle($room, $round);

    expect($awarded)->toBe([['playerId' => $player->id, 'points' => 2, 'isWin' => false]])
        ->and(GamePoint::query()->sole()->user_id)->toBe($user->id);
});

it('lets the host or the leader pass', function (string $who) {
    $room = GameRoom::factory()->create();
    [$hostUser] = gameRoomHost($room);
    [$leaderUser, $leader] = gameRoomMember($room);
    $round = activeGameRound($room, ['leader_player_id' => $leader->id]);
    $actor = $who === 'host' ? $hostUser : $leaderUser;

    $this->actingAs($actor)
        ->postJson(route('games.rounds.pass.store', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('ended.outcome', 'passed')
        ->assertJsonPath('ended.word', 'sprint');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Passed);
    Event::assertDispatched(GameRoundEnded::class);
})->with(['host', 'leader']);

it('refuses a pass from other players and on ended rounds', function () {
    $room = GameRoom::factory()->create();
    [$hostUser] = gameRoomHost($room);
    [$member] = gameRoomMember($room);
    $round = activeGameRound($room);

    $this->actingAs($member)->postJson(route('games.rounds.pass.store', [$room, $round]))->assertForbidden();

    $round->forceFill(['ended_at' => now(), 'outcome' => GameRoundOutcome::Solved])->save();

    $this->actingAs($hostUser)->postJson(route('games.rounds.pass.store', [$room, $round]))
        ->assertConflict()
        ->assertJsonPath('message', __('This round is over.'));
});

it('switches the game and abandons the active round without points', function () {
    bindGameRules($this->rules, new FakeGameRules(kind: GameKind::Decoded));
    $room = GameRoom::factory()->create();
    [$user, $host] = gameRoomHost($room);
    $round = activeGameRound($room);
    $this->rules->points = [$host->id => ['points' => 3, 'isWin' => false]];

    $this->actingAs($user)->putJson(route('games.game.update', $room), ['game' => 'decoded'])->assertNoContent();

    expect($room->fresh()->game)->toBe(GameKind::Decoded)
        ->and($round->fresh()->outcome)->toBe(GameRoundOutcome::Abandoned)
        ->and(GamePoint::query()->count())->toBe(0);

    Event::assertDispatched(GameRoundEnded::class, fn (GameRoundEnded $event) => $event->payload['word'] === 'sprint');
    Event::assertDispatched(GameRoomChanged::class);
});

it('refuses unavailable games and non-hosts when switching', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);
    [$member] = gameRoomMember($room);

    $this->actingAs($user)->putJson(route('games.game.update', $room), ['game' => 'gif'])->assertUnprocessable();
    $this->actingAs($user)->putJson(route('games.game.update', $room), ['game' => 'chess'])->assertUnprocessable();
    $this->actingAs($member)->putJson(route('games.game.update', $room), ['game' => 'hangman'])->assertForbidden();
});

it('lists ended rounds and shows one with its game details', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);
    $ended = GameRound::factory()->ended()->word('kite')->create(['game_room_id' => $room->id]);
    $active = activeGameRound($room, ['word' => 'hidden']);

    $index = $this->actingAs($user)->getJson(route('games.rounds.index', $room))->assertOk();

    expect(array_column($index->json(), 'id'))->toBe([$ended->id])
        ->and(gamePayloadExposesWord($index->json(), 'hidden'))->toBeFalse();

    $this->actingAs($user)->getJson(route('games.rounds.show', [$room, $ended]))
        ->assertOk()
        ->assertJsonPath('word', 'kite')
        ->assertJsonPath('fakeDetail', true);

    $this->actingAs($user)->getJson(route('games.rounds.show', [$room, $active]))->assertNotFound();
});

it('scopes rounds to their room', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);
    $foreign = GameRound::factory()->ended()->create();

    $this->actingAs($user)->getJson(route('games.rounds.show', [$room, $foreign]))->assertNotFound();
});

it('plays an icebreaker only during the icebreaker phase and while unlocked', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create();
    [$user] = retroFacilitator($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create();

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))
        ->assertForbidden()
        ->assertJsonPath('message', __('The game can only be played during the icebreaker.'));

    $retro->update(['phase' => RetroPhase::Icebreaker, 'is_locked' => true]);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))->assertStatus(423);

    $retro->update(['is_locked' => false]);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))->assertCreated();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/GameRoundEngineTest.php`
Expected: FAIL — `Route [games.rounds.store] not defined.`

- [ ] **Step 3: Write the engine actions**

Create `app/Actions/Games/LockGameRound.php`:

```php
<?php

namespace App\Actions\Games;

use App\Models\GameRoom;
use App\Models\GameRound;

class LockGameRound
{
    /**
     * Room first, then round: the order every round mutation uses, so two
     * requests never wait on each other's rows crosswise.
     *
     * @return array{0: GameRoom, 1: GameRound}
     */
    public static function handle(GameRoom $room, GameRound $round): array
    {
        $lockedRoom = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();
        $lockedRound = GameRound::query()->whereKey($round->id)->lockForUpdate()->firstOrFail();

        return [$lockedRoom, $lockedRound];
    }
}
```

Create `app/Actions/Games/AwardRoundPoints.php`:

```php
<?php

namespace App\Actions\Games;

use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRulesRegistry;

class AwardRoundPoints
{
    public function __construct(private GameRulesRegistry $gameRulesRegistry) {}

    /**
     * @return array<int, array{playerId: string, points: int, isWin: bool}>
     */
    public function handle(GameRoom $room, GameRound $round): array
    {
        $rows = $this->gameRulesRegistry->for($round->game)->points($round, $room);

        if ($rows === []) {
            return [];
        }

        $players = GamePlayer::query()
            ->with('participant')
            ->where('game_room_id', $room->id)
            ->whereIn('id', array_map('strval', array_keys($rows)))
            ->get()
            ->keyBy('id');

        $awarded = [];

        foreach ($rows as $playerId => $row) {
            $player = $players->get((string) $playerId);

            if ($player === null) {
                continue;
            }

            $points = max(0, $row['points']);

            GamePoint::query()->create([
                'team_id' => $room->team_id,
                'game_room_id' => $room->id,
                'game_round_id' => $round->id,
                'player_id' => $player->id,
                'user_id' => $player->accountUserId(),
                'game' => $round->game,
                'points' => $points,
                'is_win' => $row['isWin'],
            ]);

            $awarded[] = ['playerId' => $player->id, 'points' => $points, 'isWin' => $row['isWin']];
        }

        return $awarded;
    }
}
```

Create `app/Actions/Games/EndGameRound.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameRoundOutcome;
use App\Events\Games\GameRoundEnded;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRulesRegistry;

/**
 * The only way a round ends. Callers hold the room and round locks; a round
 * that already ended is left untouched, so a replayed end (a timer job
 * after a lazy expiry, two concurrent last guesses) scores nothing twice.
 */
class EndGameRound
{
    public function __construct(
        private AwardRoundPoints $awardRoundPoints,
        private GameRulesRegistry $gameRulesRegistry,
    ) {}

    /**
     * @return array<string, mixed>|null the game.round.ended payload, null when the round had already ended
     */
    public function handle(GameRoom $room, GameRound $round, GameRoundOutcome $outcome, ?GamePlayer $winner = null): ?array
    {
        if (! $round->isActive()) {
            return null;
        }

        $round->forceFill([
            'outcome' => $outcome,
            'ended_at' => now(),
            'winner_player_id' => $winner?->id ?? $round->winner_player_id,
        ])->save();

        $points = $outcome === GameRoundOutcome::Abandoned ? [] : $this->awardRoundPoints->handle($room, $round);

        $payload = [
            'roundId' => $round->id,
            'outcome' => $outcome->value,
            'word' => $round->word,
            'winnerPlayerId' => $round->winner_player_id,
            'leaderPlayerId' => $round->leader_player_id,
            ...($this->gameRulesRegistry->find($round->game)?->endedPayload($round, $room) ?? []),
            'points' => $points,
        ];

        (new GameRoundEnded($room, $payload))->sendToOthers();

        return $payload;
    }
}
```

Create `app/Actions/Games/StartGameRound.php`:

```php
<?php

namespace App\Actions\Games;

use App\Events\Games\GameRoundStarted;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRulesRegistry;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class StartGameRound
{
    public function __construct(
        private GameRulesRegistry $gameRulesRegistry,
        private EndGameRound $endGameRound,
        private PresentGameRound $presentGameRound,
    ) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array{round: GameRound, ended: ?array<string, mixed>}
     */
    public function handle(GameRoom $room, GamePlayer $host, array $input): array
    {
        return DB::transaction(function () use ($room, $host, $input): array {
            $locked = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();

            GameGuard::mutable($locked);
            GameGuard::host($locked, $host);

            $rules = $this->gameRulesRegistry->find($locked->game);

            if ($rules === null || ! $rules->isAvailable($locked)) {
                throw ValidationException::withMessages(['game' => __('This game is not available.')]);
            }

            $ended = $this->closeActiveRound($locked);

            $round = new GameRound([
                'game_room_id' => $locked->id,
                'game' => $locked->game,
                'started_at' => now()->startOfSecond(),
            ]);

            $rules->prepare($locked, $round, $input);
            $round->save();

            $locked->forceFill(['current_round_id' => $round->id])->save();

            $this->pruneEndedRounds($locked);

            (new GameRoundStarted($locked, $this->presentGameRound->handle($round, $locked, null)))->sendToOthers();

            return ['round' => $round, 'ended' => $ended];
        });
    }

    /**
     * @return array<string, mixed>|null
     */
    private function closeActiveRound(GameRoom $room): ?array
    {
        if ($room->current_round_id === null) {
            return null;
        }

        $round = GameRound::query()->whereKey($room->current_round_id)->lockForUpdate()->first();

        if ($round === null || ! $round->isActive()) {
            return null;
        }

        $outcome = $this->gameRulesRegistry->find($round->game)?->outcomeOnNextRound($round);

        if ($outcome === null) {
            throw new ConflictHttpException(__('A round is already in progress.'));
        }

        return $this->endGameRound->handle($room, $round, $outcome);
    }

    /**
     * Pruned rounds take their guesses, answers and votes with them; their
     * points stay, detached, for the leaderboards.
     */
    private function pruneEndedRounds(GameRoom $room): void
    {
        $kept = GameRound::query()
            ->where('game_room_id', $room->id)
            ->whereNotNull('ended_at')
            ->orderByDesc('ended_at')
            ->orderByDesc('id')
            ->limit(GameRoom::KeptRounds)
            ->pluck('id');

        GameRound::query()
            ->where('game_room_id', $room->id)
            ->whereNotNull('ended_at')
            ->whereNotIn('id', $kept)
            ->delete();
    }
}
```

Create `app/Actions/Games/PassGameRound.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameRoundOutcome;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class PassGameRound
{
    public function __construct(private EndGameRound $endGameRound) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player): array
    {
        return DB::transaction(function () use ($room, $round, $player): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::leaderOrHost($lockedRoom, $lockedRound, $player);
            GameGuard::activeRound($lockedRoom, $lockedRound);

            return $this->endGameRound->handle($lockedRoom, $lockedRound, GameRoundOutcome::Passed)
                ?? throw new ConflictHttpException(__('This round is over.'));
        });
    }
}
```

Create `app/Actions/Games/SwitchGame.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameRoomChanged;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRulesRegistry;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SwitchGame
{
    public function __construct(
        private GameRulesRegistry $gameRulesRegistry,
        private EndGameRound $endGameRound,
    ) {}

    public function handle(GameRoom $room, GamePlayer $host, GameKind $game): void
    {
        DB::transaction(function () use ($room, $host, $game): void {
            $locked = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();

            GameGuard::mutable($locked);
            GameGuard::host($locked, $host);

            if (! $this->gameRulesRegistry->isAvailable($game, $locked)) {
                throw ValidationException::withMessages(['game' => __('This game is not available.')]);
            }

            if ($locked->game === $game) {
                return;
            }

            $round = $locked->current_round_id === null
                ? null
                : GameRound::query()->whereKey($locked->current_round_id)->lockForUpdate()->first();

            if ($round !== null) {
                $this->endGameRound->handle($locked, $round, GameRoundOutcome::Abandoned);
            }

            $locked->update(['game' => $game]);

            (new GameRoomChanged($locked))->sendToOthers();
        });
    }
}
```

- [ ] **Step 4: Write the controllers**

Create `app/Http/Controllers/Games/GameRoundsController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\GameGuard;
use App\Actions\Games\PresentGameRound;
use App\Actions\Games\PresentGameRoundHistory;
use App\Actions\Games\StartGameRound;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRulesRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class GameRoundsController extends Controller
{
    public function index(GameRoom $room, PresentGameRoundHistory $presentGameRoundHistory): JsonResponse
    {
        return response()->json($presentGameRoundHistory->forRoom($room));
    }

    public function store(Request $request, GameRoom $room, StartGameRound $startGameRound, PresentGameRound $presentGameRound): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameGuard::mutable($room);
        GameGuard::host($room, $player);

        $validated = $request->validate([
            'leader_player_id' => ['nullable', 'string', Rule::exists('game_players', 'id')->where('game_room_id', $room->id)],
        ]);

        ['round' => $round, 'ended' => $ended] = $startGameRound->handle($room, $player, $validated);

        return response()->json([
            'round' => $presentGameRound->handle($round, $room->refresh(), $player),
            'ended' => $ended,
        ], 201);
    }

    public function show(GameRoom $room, GameRound $round, PresentGameRoundHistory $presentGameRoundHistory, GameRulesRegistry $gameRulesRegistry): JsonResponse
    {
        abort_if($round->isActive(), 404);

        $round->load(PresentGameRoundHistory::Relations);

        return response()->json([
            ...$presentGameRoundHistory->handle($round),
            ...($gameRulesRegistry->find($round->game)?->presentEnded($round) ?? []),
        ]);
    }
}
```

Create `app/Http/Controllers/Games/GameRoundPassesController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\PassGameRound;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameRoundPassesController extends Controller
{
    public function store(Request $request, GameRoom $room, GameRound $round, PassGameRound $passGameRound): JsonResponse
    {
        return response()->json(['ended' => $passGameRound->handle($room, $round, GamePlayer::current($request))]);
    }
}
```

Create `app/Http/Controllers/Games/GameSwitchesController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\GameGuard;
use App\Actions\Games\SwitchGame;
use App\Enums\GameKind;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class GameSwitchesController extends Controller
{
    public function update(Request $request, GameRoom $room, SwitchGame $switchGame): Response
    {
        $player = GamePlayer::current($request);

        GameGuard::mutable($room);
        GameGuard::host($room, $player);

        $validated = $request->validate([
            'game' => ['required', Rule::enum(GameKind::class)],
        ]);

        $switchGame->handle($room, $player, GameKind::from($validated['game']));

        return response()->noContent();
    }
}
```

- [ ] **Step 5: Register the routes**

In `routes/web.php` add the imports `use App\Http\Controllers\Games\GameRoundPassesController;`, `use App\Http\Controllers\Games\GameRoundsController;`, `use App\Http\Controllers\Games\GameSwitchesController;` and inside the `games/{room}` group, after the host route:

```php
        Route::put('game', [GameSwitchesController::class, 'update'])->name('games.game.update');
        Route::post('rounds', [GameRoundsController::class, 'store'])->name('games.rounds.store');
        Route::get('rounds', [GameRoundsController::class, 'index'])->name('games.rounds.index');
        Route::get('rounds/{round}', [GameRoundsController::class, 'show'])->name('games.rounds.show')->whereUuid('round');
        Route::post('rounds/{round}/pass', [GameRoundPassesController::class, 'store'])->name('games.rounds.pass.store')->whereUuid('round');
```

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && vendor/bin/sail artisan test --compact tests/Feature/Games`
Expected: PASS.

- [ ] **Step 7: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| A round is already in progress. | Une manche est déjà en cours. | Ya hay una ronda en curso. | Es läuft bereits eine Runde. |

- [ ] **Step 8: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Games app/Http/Controllers/Games routes/web.php tests/Feature/Games/GameRoundEngineTest.php lang
git commit -m "feat(games): start, end, score and prune rounds

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 9: Timers — host timer, delayed expiry job and lazy expiry

**Files:**
- Create: `app/Actions/Games/ExpireGameRound.php`, `app/Actions/Games/ScheduleRoundExpiry.php`, `app/Jobs/CloseExpiredGameRound.php`, `app/Http/Controllers/Games/GameTimersController.php`
- Modify: `app/Actions/Games/StartGameRound.php` (schedule expiry), `app/Http/Middleware/ResolveGamePlayer.php` (lazy expiry), `routes/web.php`
- Test: create `tests/Feature/Games/GameTimerTest.php`

**Interfaces:**
- Consumes: `GameRoom::effectiveTimerEndsAt()`, `GameRules::expiryAnchor/expire`, `EndGameRound`, `LockGameRound`.
- Produces: `ScheduleRoundExpiry::handle(GameRoom $room, GameRound $round): void` (dispatches `CloseExpiredGameRound` after commit, delayed to the effective timer, only for an active round and a timer in the future — 13d calls it when the retro board timer changes during an icebreaker round); `ExpireGameRound::handle(GameRoom $room): void` and `hasExpired(GameRoom $room, GameRound $round): bool` (expired = timer set, not in the future, and later than the rules' `expiryAnchor`); job `CloseExpiredGameRound(string $roundId, string $timerEndsAt)` (no-op when the round ended, the timer changed or was cleared); route `games.timer.update` (PUT, body `seconds` 10–7200 or `null`, standalone only, host only, `{timerEndsAt}`), broadcasting `game.timer.changed`. Every request through `ResolveGamePlayer` applies the lazy expiry before the controller runs.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Games/GameTimerTest.php`:

```php
<?php

use App\Actions\Games\ExpireGameRound;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Events\Games\GameRoundEnded;
use App\Events\Games\GameTimerChanged;
use App\Jobs\CloseExpiredGameRound;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Tests\Support\FakeGameRules;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
    $this->rules = new FakeGameRules;
    bindGameRules($this->rules);
});

function runGameExpiryJob(GameRound $round, string $timerEndsAt): void
{
    (new CloseExpiredGameRound($round->id, $timerEndsAt))->handle(app(ExpireGameRound::class));
}

it('sets and clears the room timer as host', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);

    $this->actingAs($user)
        ->putJson(route('games.timer.update', $room), ['seconds' => 90])
        ->assertOk()
        ->assertExactJson(['timerEndsAt' => '2026-10-06T10:01:30+00:00']);

    expect($room->fresh()->timer_ends_at?->toIso8601String())->toBe('2026-10-06T10:01:30+00:00');
    Event::assertDispatched(GameTimerChanged::class, fn (GameTimerChanged $event) => $event->timerEndsAt === '2026-10-06T10:01:30+00:00');

    $this->actingAs($user)
        ->putJson(route('games.timer.update', $room), ['seconds' => null])
        ->assertOk()
        ->assertExactJson(['timerEndsAt' => null]);

    expect($room->fresh()->timer_ends_at)->toBeNull();
});

it('validates the timer and keeps it to the host of standalone rooms', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);
    [$member] = gameRoomMember($room);
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    [$facilitator] = retroFacilitator($retro);
    $icebreaker = GameRoom::factory()->icebreaker($retro)->create();

    $this->actingAs($user)->putJson(route('games.timer.update', $room), ['seconds' => 5])->assertUnprocessable();
    $this->actingAs($user)->putJson(route('games.timer.update', $room), ['seconds' => 7201])->assertUnprocessable();
    $this->actingAs($user)->putJson(route('games.timer.update', $room), [])->assertUnprocessable();
    $this->actingAs($member)->putJson(route('games.timer.update', $room), ['seconds' => 60])->assertForbidden();
    $this->actingAs($facilitator)->putJson(route('games.timer.update', $icebreaker), ['seconds' => 60])->assertNotFound();
});

it('never sets a timer when a round starts', function () {
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))->assertCreated();

    expect($room->fresh()->timer_ends_at)->toBeNull();
});

it('schedules the expiry when a timer is set during a round', function () {
    Queue::fake();
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);
    $round = activeGameRound($room);

    $this->actingAs($user)->putJson(route('games.timer.update', $room), ['seconds' => 60])->assertOk();

    Queue::assertPushed(CloseExpiredGameRound::class, fn (CloseExpiredGameRound $job) => $job->roundId === $round->id
        && $job->timerEndsAt === '2026-10-06T10:01:00+00:00'
        && $job->delay instanceof DateTimeInterface
        && CarbonImmutable::instance($job->delay)->equalTo(CarbonImmutable::parse('2026-10-06 10:01:00')));
});

it('schedules nothing without an active round', function () {
    Queue::fake();
    $room = GameRoom::factory()->create();
    [$user] = gameRoomHost($room);

    $this->actingAs($user)->putJson(route('games.timer.update', $room), ['seconds' => 60])->assertOk();

    Queue::assertNotPushed(CloseExpiredGameRound::class);
});

it('schedules the expiry when a round starts under a running timer', function () {
    Queue::fake();
    $room = GameRoom::factory()->create(['timer_ends_at' => now()->addMinutes(2)]);
    [$user] = gameRoomHost($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))->assertCreated();

    Queue::assertPushed(CloseExpiredGameRound::class, fn (CloseExpiredGameRound $job) => $job->timerEndsAt === '2026-10-06T10:02:00+00:00');
});

it('ends the round as timed out when the job runs after the timer', function () {
    $room = GameRoom::factory()->create(['timer_ends_at' => now()->addMinute()]);
    [, $host] = gameRoomHost($room);
    $round = activeGameRound($room);
    $this->rules->points = [$host->id => ['points' => 0, 'isWin' => false]];

    $this->travel(61)->seconds();
    runGameExpiryJob($round, '2026-10-06T10:01:00+00:00');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::TimedOut);
    Event::assertDispatched(GameRoundEnded::class, fn (GameRoundEnded $event) => $event->payload['outcome'] === 'timed_out');
});

it('ignores stale, early and cleared timers', function (string $case) {
    $room = GameRoom::factory()->create(['timer_ends_at' => now()->addMinute()]);
    gameRoomHost($room);
    $round = activeGameRound($room);

    match ($case) {
        'changed' => $room->update(['timer_ends_at' => now()->addMinutes(5)]),
        'cleared' => $room->update(['timer_ends_at' => null]),
        'early' => null,
    };

    if ($case !== 'early') {
        $this->travel(61)->seconds();
    }

    runGameExpiryJob($round, '2026-10-06T10:01:00+00:00');

    expect($round->fresh()->isActive())->toBeTrue();
})->with(['changed', 'cleared', 'early']);

it('expires the round lazily on the next request', function () {
    $room = GameRoom::factory()->create(['timer_ends_at' => now()->addMinute()]);
    [$user] = gameRoomHost($room);
    $round = activeGameRound($room);

    $this->travel(2)->minutes();

    $this->actingAs($user)
        ->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('round', null)
        ->assertJsonPath('history.0.outcome', 'timed_out');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::TimedOut);
});

it('does not end a round started after the timer ran out', function () {
    $room = GameRoom::factory()->create(['timer_ends_at' => now()->subMinute()]);
    [$user] = gameRoomHost($room);

    $this->actingAs($user)->postJson(route('games.rounds.store', $room))->assertCreated();

    $this->travel(1)->minutes();

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))
        ->assertOk()
        ->assertJsonPath('round.game', 'hangman');
});

it('leaves the round active when the rules handle the expiry themselves', function () {
    $this->rules->expiryOutcome = null;
    $room = GameRoom::factory()->create(['timer_ends_at' => now()->addMinute()]);
    gameRoomHost($room);
    $round = activeGameRound($room);

    $this->travel(2)->minutes();
    app(ExpireGameRound::class)->handle($room->fresh());

    expect($round->fresh()->isActive())->toBeTrue();
});

it('uses the retro board timer in icebreaker rooms', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create(['timer_ends_at' => now()->addMinute()]);
    [$user, $participant] = retroMember($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create();
    GamePlayer::factory()->forParticipant($participant)->create(['game_room_id' => $room->id]);
    $round = activeGameRound($room);

    $this->travel(2)->minutes();

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))->assertOk()->assertJsonPath('round', null);

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::TimedOut);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/GameTimerTest.php`
Expected: FAIL — `Class "App\Actions\Games\ExpireGameRound" not found`.

- [ ] **Step 3: Write the expiry actions and the job**

Create `app/Actions/Games/ScheduleRoundExpiry.php`:

```php
<?php

namespace App\Actions\Games;

use App\Jobs\CloseExpiredGameRound;
use App\Models\GameRoom;
use App\Models\GameRound;

class ScheduleRoundExpiry
{
    public function handle(GameRoom $room, GameRound $round): void
    {
        $endsAt = $room->effectiveTimerEndsAt();

        if ($endsAt === null || ! $endsAt->isFuture() || ! $round->isActive()) {
            return;
        }

        CloseExpiredGameRound::dispatch($round->id, $endsAt->toIso8601String())
            ->delay($endsAt)
            ->afterCommit();
    }
}
```

Create `app/Actions/Games/ExpireGameRound.php`:

```php
<?php

namespace App\Actions\Games;

use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRulesRegistry;
use Illuminate\Support\Facades\DB;

/**
 * Ends (or moves on) the active round once the room's timer has run out,
 * both from the delayed job and lazily on every game request, so a late
 * queue never shows a stale round.
 */
class ExpireGameRound
{
    public function __construct(
        private GameRulesRegistry $gameRulesRegistry,
        private EndGameRound $endGameRound,
    ) {}

    public function handle(GameRoom $room): void
    {
        $round = $room->activeRound();

        if ($round === null || ! $this->hasExpired($room, $round)) {
            return;
        }

        DB::transaction(function () use ($room, $round): void {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            if ($lockedRoom->current_round_id !== $lockedRound->id || ! $lockedRound->isActive()) {
                return;
            }

            if (! $this->hasExpired($lockedRoom, $lockedRound)) {
                return;
            }

            $outcome = $this->gameRulesRegistry->for($lockedRound->game)->expire($lockedRoom, $lockedRound);

            if ($outcome !== null) {
                $this->endGameRound->handle($lockedRoom, $lockedRound, $outcome);
            }
        });

        $room->refresh();
    }

    /**
     * A timer that ran out before the round's anchor (its start, or a later
     * stage such as a reveal) belongs to an earlier turn.
     */
    public function hasExpired(GameRoom $room, GameRound $round): bool
    {
        $endsAt = $room->effectiveTimerEndsAt();

        if ($endsAt === null || $endsAt->isFuture()) {
            return false;
        }

        $rules = $this->gameRulesRegistry->find($round->game);

        return $rules !== null && $endsAt->greaterThan($rules->expiryAnchor($round));
    }
}
```

Create `app/Jobs/CloseExpiredGameRound.php`:

```php
<?php

namespace App\Jobs;

use App\Actions\Games\ExpireGameRound;
use App\Models\GameRound;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class CloseExpiredGameRound implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $roundId, public string $timerEndsAt) {}

    /**
     * The job belongs to one end time of one round: a changed, cleared or
     * superseded timer makes it a no-op, and the action re-checks the rest.
     */
    public function handle(ExpireGameRound $expireGameRound): void
    {
        $round = GameRound::query()->with('room.retro')->find($this->roundId);

        if ($round === null || ! $round->isActive()) {
            return;
        }

        $room = $round->room;
        $endsAt = $room->effectiveTimerEndsAt();

        if ($endsAt === null || ! $endsAt->equalTo(CarbonImmutable::parse($this->timerEndsAt))) {
            return;
        }

        $expireGameRound->handle($room);
    }
}
```

- [ ] **Step 4: Wire the timer endpoint, the start and the middleware**

Create `app/Http/Controllers/Games/GameTimersController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\GameGuard;
use App\Actions\Games\ScheduleRoundExpiry;
use App\Events\Games\GameTimerChanged;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GameTimersController extends Controller
{
    public function update(Request $request, GameRoom $room, ScheduleRoundExpiry $scheduleRoundExpiry): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameGuard::standalone($room);
        GameGuard::host($room, $player);

        $validated = $request->validate([
            'seconds' => ['present', 'nullable', 'integer', 'min:10', 'max:7200'],
        ]);

        // Whole seconds: the column keeps no fraction, and the job compares
        // its scheduled instant with the stored one.
        $endsAt = $validated['seconds'] === null
            ? null
            : now()->addSeconds((int) $validated['seconds'])->startOfSecond();

        DB::transaction(function () use ($room, $player, $endsAt, $scheduleRoundExpiry): void {
            $locked = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();

            GameGuard::host($locked, $player);

            $locked->update(['timer_ends_at' => $endsAt]);

            (new GameTimerChanged($locked, $endsAt?->toIso8601String()))->sendToOthers();

            $round = $locked->activeRound();

            if ($round !== null) {
                $scheduleRoundExpiry->handle($locked, $round);
            }
        });

        return response()->json(['timerEndsAt' => $endsAt?->toIso8601String()]);
    }
}
```

In `app/Actions/Games/StartGameRound.php` add `private ScheduleRoundExpiry $scheduleRoundExpiry,` as the last constructor parameter and, right after `$this->pruneEndedRounds($locked);`:

```php
            $this->scheduleRoundExpiry->handle($locked, $round);
```

In `app/Http/Middleware/ResolveGamePlayer.php` add `use App\Actions\Games\ExpireGameRound;`, change the constructor to:

```php
    public function __construct(
        private FindGamePlayer $findGamePlayer,
        private ExpireGameRound $expireGameRound,
    ) {}
```

and replace `$request->attributes->set('gamePlayer', $player);` with:

```php
        $request->attributes->set('gamePlayer', $player);

        $this->expireGameRound->handle($room);
```

In `routes/web.php` add `use App\Http\Controllers\Games\GameTimersController;` and inside the `games/{room}` group, after the `game` route:

```php
        Route::put('timer', [GameTimersController::class, 'update'])->name('games.timer.update');
```

- [ ] **Step 5: Run the tests**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && vendor/bin/sail artisan test --compact tests/Feature/Games`
Expected: PASS.

- [ ] **Step 6: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Games app/Jobs/CloseExpiredGameRound.php app/Http/Controllers/Games/GameTimersController.php app/Http/Middleware/ResolveGamePlayer.php routes/web.php tests/Feature/Games/GameTimerTest.php
git commit -m "feat(games): end rounds when the host timer runs out

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 10: Hangman — rules, letter picks, scoring and rate limit

**Files:**
- Create: `app/Support/Games/HangmanRules.php`, `app/Support/Games/GameRateLimit.php`, `app/Actions/Games/PickGameLetter.php`, `app/Http/Controllers/Games/GameLettersController.php`
- Modify: `app/Providers/AppServiceProvider.php` (register `HangmanRules`), `routes/web.php`
- Test: create `tests/Feature/Games/HangmanTest.php`

**Interfaces:**
- Consumes: `DrawGameWord`, `GameWord`, `EndGameRound`, `LockGameRound`, `GameGuard`, `GameLetterPicked`.
- Produces: `HangmanRules` (`MaxMisses = 6`; active payload `{mask, misses, maxMisses, pickedLetters}`, ended detail the same with the full mask; points = 1 per revealed position per picker, +5 and `isWin` for the solver); `GameRateLimit::hit(string $key, int $maxAttempts, int $decaySeconds): void`; `PickGameLetter::handle(GameRoom, GameRound, GamePlayer, string $letter): array{roundId, playerId, letter, hit, mask, misses, ended}`; route `games.rounds.letters.store` (POST, body `letter` a–z, case-insensitive, 200). The registry binding becomes `new GameRulesRegistry([$app->make(HangmanRules::class)])`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Games/HangmanTest.php`:

```php
<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameLetterPicked;
use App\Events\Games\GameRoundEnded;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameWordBook;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
});

/**
 * @return array{0: GameRoom, 1: \App\Models\User, 2: \App\Models\GamePlayer, 3: GameRound}
 */
function hangmanTable(string $word): array
{
    $room = GameRoom::factory()->game(GameKind::Hangman)->linkAccess()->create();
    [$user, $player] = gameRoomHost($room);

    return [$room, $user, $player, activeGameRound($room, ['word' => $word])];
}

function pickLetter(GameRoom $room, GameRound $round, string $letter): \Illuminate\Testing\TestResponse
{
    return test()->postJson(route('games.rounds.letters.store', [$room, $round]), ['letter' => $letter]);
}

it('starts with a word from the full pool and a blank mask', function () {
    app()->instance(GameWordBook::class, new GameWordBook(words: ['en' => [['word' => 'scope', 'drawable' => false]]]));
    $room = GameRoom::factory()->game(GameKind::Hangman)->create();
    [$user] = gameRoomHost($room);

    $this->actingAs($user)
        ->postJson(route('games.rounds.store', $room))
        ->assertCreated()
        ->assertJsonPath('round.mask', [null, null, null, null, null])
        ->assertJsonPath('round.misses', 0)
        ->assertJsonPath('round.maxMisses', 6)
        ->assertJsonPath('round.pickedLetters', []);

    expect(GameRound::query()->sole()->word)->toBe('scope');
});

it('reveals every position of a hit and broadcasts the pick', function () {
    [$room, $user, $player, $round] = hangmanTable('banana');

    $this->actingAs($user);

    pickLetter($room, $round, 'A')
        ->assertOk()
        ->assertJson([
            'roundId' => $round->id,
            'playerId' => $player->id,
            'letter' => 'a',
            'hit' => true,
            'mask' => [null, 'a', null, 'a', null, 'a'],
            'misses' => 0,
            'ended' => null,
        ]);

    expect($round->fresh())
        ->revealed_positions->toBe([1, 3, 5])
        ->picked_letters->toBe(['a'])
        ->picked_by->toBe([$player->id]);

    Event::assertDispatched(GameLetterPicked::class, fn (GameLetterPicked $event) => $event->payload['hit'] === true
        && ! gamePayloadExposesWord($event->payload, 'banana'));
});

it('reveals accented letters with their plain letter', function () {
    [$room, $user, , $round] = hangmanTable('Éléphant');

    $this->actingAs($user);

    pickLetter($room, $round, 'e')->assertOk()->assertJsonPath('mask', ['É', null, 'é', null, null, null, null, null]);
});

it('counts misses', function () {
    [$room, $user, , $round] = hangmanTable('kite');

    $this->actingAs($user);

    pickLetter($room, $round, 'z')->assertOk()->assertJsonPath('hit', false)->assertJsonPath('misses', 1);
});

it('refuses a letter picked twice and anything but one letter', function () {
    [$room, $user, , $round] = hangmanTable('kite');

    $this->actingAs($user);

    pickLetter($room, $round, 'k')->assertOk();
    $this->travel(2)->seconds();
    pickLetter($room, $round, 'K')->assertConflict()->assertJsonPath('message', __('This letter was already picked.'));

    foreach (['ab', '1', 'é', ''] as $letter) {
        $this->travel(2)->seconds();
        pickLetter($room, $round, $letter)->assertUnprocessable();
    }
});

it('solves the word and credits the last picker', function () {
    [$room, $user, $host, $round] = hangmanTable('kiki');
    $guest = gameRoomGuest($room);

    $this->actingAs($user);
    pickLetter($room, $round, 'k')->assertOk();

    app('auth')->forgetGuards();
    $response = $this->withCookies(gameGuestCookie($guest))
        ->postJson(route('games.rounds.letters.store', [$room, $round]), ['letter' => 'i'])
        ->assertOk()
        ->assertJsonPath('ended.outcome', 'solved')
        ->assertJsonPath('ended.word', 'kiki')
        ->assertJsonPath('ended.winnerPlayerId', $guest->id);

    expect($response->json('ended.points'))->toEqualCanonicalizing([
        ['playerId' => $host->id, 'points' => 2, 'isWin' => false],
        ['playerId' => $guest->id, 'points' => 7, 'isWin' => true],
    ])
        ->and($round->fresh()->outcome)->toBe(GameRoundOutcome::Solved);

    Event::assertDispatched(GameRoundEnded::class, fn (GameRoundEnded $event) => $event->payload['word'] === 'kiki');
});

it('loses after six misses and keeps the hit points', function () {
    [$room, $user, $host, $round] = hangmanTable('kite');
    [, $member] = gameRoomMember($room);
    $round->forceFill([
        'picked_letters' => ['k', 'a', 'b', 'c', 'd', 'f'],
        'picked_by' => [$member->id, $host->id, $host->id, $host->id, $host->id, $host->id],
        'revealed_positions' => [0],
        'misses' => 5,
    ])->save();

    $this->actingAs($user);

    pickLetter($room, $round, 'g')->assertOk()->assertJsonPath('ended.outcome', 'lost');

    expect(GamePoint::query()->where('player_id', $member->id)->sole()->points)->toBe(1)
        ->and(GamePoint::query()->where('player_id', $host->id)->sole()->points)->toBe(0)
        ->and(GamePoint::query()->where('is_win', true)->count())->toBe(0);
});

it('scores hit points when the host gives up and nothing for watchers', function () {
    [$room, $user, $host, $round] = hangmanTable('kite');
    gameRoomMember($room);
    $round->forceFill(['picked_letters' => ['t'], 'picked_by' => [$host->id], 'revealed_positions' => [2]])->save();

    $this->actingAs($user)->postJson(route('games.rounds.pass.store', [$room, $round]))->assertOk();

    expect(GamePoint::query()->count())->toBe(1)
        ->and(GamePoint::query()->sole()->points)->toBe(1);
});

it('refuses a pick after the round ended', function () {
    [$room, $user, , $round] = hangmanTable('kite');
    $round->forceFill(['ended_at' => now(), 'outcome' => GameRoundOutcome::Solved])->save();

    $this->actingAs($user);

    pickLetter($room, $round, 'k')->assertConflict()->assertJsonPath('message', __('This round is over.'));

    expect(GamePoint::query()->count())->toBe(0);
});

it('refuses letters in other games', function () {
    $room = GameRoom::factory()->game(GameKind::DrawAndGuess)->create();
    [$user] = gameRoomHost($room);
    $round = activeGameRound($room, ['game' => GameKind::DrawAndGuess]);

    $this->actingAs($user);

    pickLetter($room, $round, 'a')->assertUnprocessable();
});

it('slows down a player picking too fast', function () {
    [$room, $user, , $round] = hangmanTable('abcdefghij');

    $this->actingAs($user);

    pickLetter($room, $round, 'a')->assertOk();
    pickLetter($room, $round, 'b')->assertOk();
    pickLetter($room, $round, 'c')->assertOk();
    pickLetter($room, $round, 'd')->assertTooManyRequests()->assertJsonPath('message', __('Slow down a little.'));

    $this->travel(4)->seconds();

    pickLetter($room, $round, 'd')->assertOk();
});

it('shows the full word and picks once the round ended', function () {
    [$room, $user, $host, $round] = hangmanTable('kite');
    $round->forceFill(['picked_letters' => ['k', 'z'], 'picked_by' => [$host->id, $host->id], 'revealed_positions' => [0], 'misses' => 1])->save();

    $this->actingAs($user)->postJson(route('games.rounds.pass.store', [$room, $round]))->assertOk();

    $this->actingAs($user)
        ->getJson(route('games.rounds.show', [$room, $round]))
        ->assertOk()
        ->assertJsonPath('word', 'kite')
        ->assertJsonPath('mask', ['k', 'i', 't', 'e'])
        ->assertJsonPath('pickedLetters', ['k', 'z'])
        ->assertJsonPath('misses', 1)
        ->assertJsonMissingPath('pickedBy');
});

it('times out with the host timer', function () {
    [$room, $user, $host, $round] = hangmanTable('kite');
    $room->update(['timer_ends_at' => now()->addMinute()]);

    $this->travel(2)->minutes();

    $this->actingAs($user)->getJson(route('games.snapshot.show', $room))->assertOk()->assertJsonPath('history.0.outcome', 'timed_out');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/HangmanTest.php`
Expected: FAIL — `Route [games.rounds.letters.store] not defined.`

- [ ] **Step 3: Write the rules and the rate limit**

Create `app/Support/Games/GameRateLimit.php`:

```php
<?php

namespace App\Support\Games;

use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Support\Facades\RateLimiter;

class GameRateLimit
{
    /**
     * Keyed by player rather than by route middleware, which runs before the
     * player is resolved and would fall back to one limit per IP.
     */
    public static function hit(string $key, int $maxAttempts, int $decaySeconds): void
    {
        if (RateLimiter::tooManyAttempts($key, $maxAttempts)) {
            throw new ThrottleRequestsException(__('Slow down a little.'), null, ['Retry-After' => RateLimiter::availableIn($key)]);
        }

        RateLimiter::hit($key, $decaySeconds);
    }
}
```

Create `app/Support/Games/HangmanRules.php`:

```php
<?php

namespace App\Support\Games;

use App\Actions\Games\DrawGameWord;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Carbon\CarbonInterface;

class HangmanRules implements GameRules
{
    public const MaxMisses = 6;

    private const SolveBonus = 5;

    public function __construct(private DrawGameWord $drawGameWord) {}

    public function kind(): GameKind
    {
        return GameKind::Hangman;
    }

    public function isAvailable(GameRoom $room): bool
    {
        return true;
    }

    public function prepare(GameRoom $room, GameRound $round, array $input): void
    {
        $round->word = $this->drawGameWord->handle($room, drawableOnly: false);
    }

    public function presentActive(GameRound $round, GameRoom $room, ?GamePlayer $viewer): array
    {
        return $this->state($round, $round->revealed_positions);
    }

    public function presentEnded(GameRound $round): array
    {
        return $this->state($round, GameWord::letterPositions((string) $round->word));
    }

    public function endedPayload(GameRound $round, GameRoom $room): array
    {
        return [];
    }

    public function expiryAnchor(GameRound $round): CarbonInterface
    {
        return $round->started_at;
    }

    public function expire(GameRoom $room, GameRound $round): ?GameRoundOutcome
    {
        return GameRoundOutcome::TimedOut;
    }

    public function outcomeOnNextRound(GameRound $round): ?GameRoundOutcome
    {
        return null;
    }

    /**
     * Each picker earns one point per position their hits revealed; the
     * player whose letter completed the word earns the solve bonus.
     */
    public function points(GameRound $round, GameRoom $room): array
    {
        $word = (string) $round->word;
        $rows = [];

        foreach ($round->picked_letters as $index => $letter) {
            $playerId = $round->picked_by[$index] ?? null;

            if ($playerId === null) {
                continue;
            }

            $rows[$playerId] ??= ['points' => 0, 'isWin' => false];
            $rows[$playerId]['points'] += count(GameWord::positionsOf($word, $letter));
        }

        $winner = $round->winner_player_id;

        if ($round->outcome === GameRoundOutcome::Solved && $winner !== null && isset($rows[$winner])) {
            $rows[$winner] = ['points' => $rows[$winner]['points'] + self::SolveBonus, 'isWin' => true];
        }

        return $rows;
    }

    /**
     * @param  array<int, int>  $revealedPositions
     * @return array{mask: array<int, ?string>, misses: int, maxMisses: int, pickedLetters: array<int, string>}
     */
    private function state(GameRound $round, array $revealedPositions): array
    {
        return [
            'mask' => GameWord::mask((string) $round->word, $revealedPositions),
            'misses' => $round->misses,
            'maxMisses' => self::MaxMisses,
            'pickedLetters' => $round->picked_letters,
        ];
    }
}
```

In `app/Providers/AppServiceProvider.php` add `use App\Support\Games\HangmanRules;` and `use Illuminate\Contracts\Foundation\Application;`, and replace the registry binding with:

```php
        $this->app->bind(GameRulesRegistry::class, fn (Application $app): GameRulesRegistry => new GameRulesRegistry([
            $app->make(HangmanRules::class),
        ]));
```

- [ ] **Step 4: Write the pick action, the controller and the route**

Create `app/Actions/Games/PickGameLetter.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameLetterPicked;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameWord;
use App\Support\Games\HangmanRules;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class PickGameLetter
{
    public function __construct(private EndGameRound $endGameRound) {}

    /**
     * @return array{
     *     roundId: string,
     *     playerId: string,
     *     letter: string,
     *     hit: bool,
     *     mask: array<int, ?string>,
     *     misses: int,
     *     ended: ?array<string, mixed>
     * }
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player, string $letter): array
    {
        return DB::transaction(function () use ($room, $round, $player, $letter): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::Hangman);

            if (in_array($letter, $lockedRound->picked_letters, true)) {
                throw new ConflictHttpException(__('This letter was already picked.'));
            }

            $word = (string) $lockedRound->word;
            $positions = GameWord::positionsOf($word, $letter);
            $hit = $positions !== [];
            $revealed = array_values(array_unique([...$lockedRound->revealed_positions, ...$positions]));

            sort($revealed);

            $lockedRound->forceFill([
                'picked_letters' => [...$lockedRound->picked_letters, $letter],
                'picked_by' => [...$lockedRound->picked_by, $player->id],
                'revealed_positions' => $revealed,
                'misses' => $lockedRound->misses + ($hit ? 0 : 1),
            ])->save();

            $payload = [
                'roundId' => $lockedRound->id,
                'playerId' => $player->id,
                'letter' => $letter,
                'hit' => $hit,
                'mask' => GameWord::mask($word, $revealed),
                'misses' => $lockedRound->misses,
            ];

            (new GameLetterPicked($lockedRoom, $payload))->sendToOthers();

            $ended = match (true) {
                GameWord::isFullyRevealed($word, $revealed) => $this->endGameRound->handle($lockedRoom, $lockedRound, GameRoundOutcome::Solved, $player),
                $lockedRound->misses >= HangmanRules::MaxMisses => $this->endGameRound->handle($lockedRoom, $lockedRound, GameRoundOutcome::Lost),
                default => null,
            };

            return [...$payload, 'ended' => $ended];
        });
    }
}
```

Create `app/Http/Controllers/Games/GameLettersController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\PickGameLetter;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class GameLettersController extends Controller
{
    public function store(Request $request, GameRoom $room, GameRound $round, PickGameLetter $pickGameLetter): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameRateLimit::hit("game-play:{$player->id}", 3, 3);

        $validated = $request->validate([
            'letter' => ['required', 'string', 'regex:/^[A-Za-z]$/'],
        ]);

        return response()->json($pickGameLetter->handle($room, $round, $player, Str::lower($validated['letter'])));
    }
}
```

In `routes/web.php` add `use App\Http\Controllers\Games\GameLettersController;` and inside the `games/{room}` group, after the pass route:

```php
        Route::post('rounds/{round}/letters', [GameLettersController::class, 'store'])->name('games.rounds.letters.store')->whereUuid('round');
```

- [ ] **Step 5: Run the tests**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && vendor/bin/sail artisan test --compact tests/Feature/Games`
Expected: PASS. (Engine tests keep their `FakeGameRules` through `bindGameRules()`.)

- [ ] **Step 6: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| This letter was already picked. | Cette lettre a déjà été choisie. | Esta letra ya se eligió. | Dieser Buchstabe wurde schon gewählt. |
| Slow down a little. | Ralentissez un peu. | Ve un poco más despacio. | Mach mal etwas langsamer. |

- [ ] **Step 7: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Support/Games/HangmanRules.php app/Support/Games/GameRateLimit.php app/Actions/Games/PickGameLetter.php app/Http/Controllers/Games/GameLettersController.php app/Providers/AppServiceProvider.php routes/web.php tests/Feature/Games/HangmanTest.php lang
git commit -m "feat(games): play Hangman

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 11: Redaction suite — the secret word across every surface

**Files:**
- Test: create `tests/Feature/Games/GameRedactionTest.php`

**Interfaces:**
- Consumes: every endpoint, presenter and event of Tasks 4–10; `gamePayloadExposesWord()`.
- Produces: the invariant suite 13b and 13c extend with their own games (leader-only word, GIF answers before reveal, votes before close). No production code changes unless a test fails — then fix the presenter at fault, never the test.

- [ ] **Step 1: Write the suite**

Create `tests/Feature/Games/GameRedactionTest.php`:

```php
<?php

use App\Enums\GameKind;
use App\Events\Games\GameBroadcastEvent;
use App\Events\Games\GameLetterPicked;
use App\Events\Games\GameRoomChanged;
use App\Events\Games\GameRoundEnded;
use App\Events\Games\GameRoundStarted;
use App\Events\Games\GameTimerChanged;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameWordBook;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;

const RedactedWord = 'labyrinth';

beforeEach(function () {
    Event::fake();
    app()->instance(GameWordBook::class, new GameWordBook(words: ['en' => [['word' => RedactedWord, 'drawable' => false]]]));
});

/**
 * Every game event dispatched before the round ended (the fake keys events
 * by their concrete class, so each class is read on its own).
 *
 * @return Collection<int, GameBroadcastEvent>
 */
function activeRoundBroadcasts(): Collection
{
    return collect([GameRoundStarted::class, GameLetterPicked::class, GameRoomChanged::class, GameTimerChanged::class])
        ->flatMap(fn (string $class) => Event::dispatched($class))
        ->map(fn (array $arguments): GameBroadcastEvent => $arguments[0]);
}

/**
 * @return array{room: GameRoom, host: \App\Models\User, member: \App\Models\User, guestCookie: array<string, string>, round: GameRound, startResponse: array<string, mixed>}
 */
function redactedHangmanRound(): array
{
    $room = GameRoom::factory()->game(GameKind::Hangman)->linkAccess()->create();
    [$host] = gameRoomHost($room);
    [$member] = gameRoomMember($room);
    $guest = gameRoomGuest($room);

    $startResponse = test()->actingAs($host)->postJson(route('games.rounds.store', $room))->assertCreated()->json();

    return [
        'room' => $room,
        'host' => $host,
        'member' => $member,
        'guestCookie' => gameGuestCookie($guest),
        'round' => GameRound::query()->sole(),
        'startResponse' => $startResponse,
    ];
}

it('keeps the word out of every snapshot while the round is active', function () {
    $table = redactedHangmanRound();

    foreach ([$table['host'], $table['member']] as $user) {
        $snapshot = $this->actingAs($user)->getJson(route('games.snapshot.show', $table['room']))->assertOk()->json();

        expect(gamePayloadExposesWord($snapshot, RedactedWord))->toBeFalse()
            ->and(gamePayloadJson($snapshot))->not->toContain('pickedBy')
            ->and(gamePayloadJson($snapshot))->not->toContain('"points"');
    }

    app('auth')->forgetGuards();

    $guestSnapshot = $this->withCookies($table['guestCookie'])->getJson(route('games.snapshot.show', $table['room']))->assertOk()->json();

    expect(gamePayloadExposesWord($guestSnapshot, RedactedWord))->toBeFalse();
});

it('keeps the word out of the room page, the start response and the start broadcast', function () {
    $table = redactedHangmanRound();

    expect(gamePayloadExposesWord($table['startResponse'], RedactedWord))->toBeFalse();

    $this->actingAs($table['member'])
        ->get(route('games.show', $table['room']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('snapshot.round.id', $table['round']->id)
            ->where('snapshot', fn ($snapshot) => ! gamePayloadExposesWord($snapshot->toArray(), RedactedWord)));

    expect(activeRoundBroadcasts())->not->toBeEmpty()
        ->and(activeRoundBroadcasts()->contains(fn (GameBroadcastEvent $event) => gamePayloadExposesWord($event->broadcastWith(), RedactedWord)))->toBeFalse();
});

it('keeps active rounds out of history and round detail', function () {
    $table = redactedHangmanRound();

    $history = $this->actingAs($table['member'])->getJson(route('games.rounds.index', $table['room']))->assertOk()->json();

    expect($history)->toBe([]);

    $this->actingAs($table['member'])->getJson(route('games.rounds.show', [$table['room'], $table['round']]))->assertNotFound();
});

it('keeps the word out of letter broadcasts until the word is solved', function () {
    $table = redactedHangmanRound();

    $this->actingAs($table['member'])
        ->postJson(route('games.rounds.letters.store', [$table['room'], $table['round']]), ['letter' => 'a'])
        ->assertOk()
        ->assertJsonPath('ended', null);

    expect(Event::dispatched(GameLetterPicked::class))->toHaveCount(1)
        ->and(activeRoundBroadcasts()->contains(fn (GameBroadcastEvent $event) => gamePayloadExposesWord($event->broadcastWith(), RedactedWord)))->toBeFalse();
});

it('hides the word and pickers from model serialization', function () {
    $table = redactedHangmanRound();

    $json = $table['round']->fresh()->toJson();

    expect(gamePayloadExposesWord($json, RedactedWord))->toBeFalse()
        ->and($json)->not->toContain('picked_by');
});

it('reveals the word to everyone once the round ends', function () {
    $table = redactedHangmanRound();

    $this->actingAs($table['host'])->postJson(route('games.rounds.pass.store', [$table['room'], $table['round']]))->assertOk();

    Event::assertDispatched(GameRoundEnded::class, fn (GameRoundEnded $event) => $event->payload['word'] === RedactedWord);

    $this->actingAs($table['member'])
        ->getJson(route('games.snapshot.show', $table['room']))
        ->assertOk()
        ->assertJsonPath('round', null)
        ->assertJsonPath('history.0.word', RedactedWord);

    $this->actingAs($table['member'])
        ->getJson(route('games.rounds.show', [$table['room'], $table['round']]))
        ->assertOk()
        ->assertJsonPath('word', RedactedWord);
});
```

- [ ] **Step 2: Run the suite**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/GameRedactionTest.php`
Expected: PASS. A failure is a leak: fix the presenter or event that carries the word.

- [ ] **Step 3: Commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
git add tests/Feature/Games/GameRedactionTest.php
git commit -m "test(games): pin the secret word redaction

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 12: Frontend foundation — types, reducer, channel, room hook and context

**Files:**
- Create: `resources/js/lib/games/types.ts`, `resources/js/lib/games/room-reducer.ts`, `resources/js/lib/games/outcomes.ts`
- Create: `resources/js/hooks/use-game-channel.ts`, `resources/js/hooks/use-game-room.ts`
- Create: `resources/js/components/games/room-context.tsx`

**Interfaces:**
- Consumes: payload shapes of Tasks 4–10; `retroRequest`, `RetroRequestError` (`@/lib/retro/api`), `useSafeConnectionStatus` (`@/hooks/use-retro-channel`), `useServerOffset` (`@/hooks/use-countdown`), `PresenceMember` (`@/lib/retro/types`), `WhisperChannel` (`@/lib/realtime/whisper-transport`), Wayfinder `GameSnapshotsController`.
- Produces: the frontend Contract items (types, `RoomAction`, `roomReducer`, `initialRoomState`, `GameEvents`, `useGameChannel`, `useGameRoom`, `RoomProvider`, `useRoom`, `RoomContextValue`) and `outcomeLabel(outcome, t)`.

There is no frontend test runner (spec §1): this task is verified by the type check and lint, and exercised by Tasks 13–14 and the walkthrough.

- [ ] **Step 1: Write the types**

Create `resources/js/lib/games/types.ts`:

```ts
export type GameKind = 'draw' | 'gif' | 'hangman' | 'decoded';

export type GameRoundOutcome =
    | 'guessed'
    | 'solved'
    | 'lost'
    | 'timed_out'
    | 'passed'
    | 'revealed'
    | 'abandoned';

export type GameRoomAccess = 'team' | 'link';

export type GamePlayer = {
    id: string;
    presenceId: string;
    name: string;
    avatarUrl: string;
    isGuest: boolean;
};

export type GameOption = { value: GameKind; label: string; available: boolean };

export type GameRoomInfo = {
    id: string;
    name: string | null;
    game: GameKind;
    locale: string;
    access: GameRoomAccess;
    timerEndsAt: string | null;
    isHost: boolean;
    canManage: boolean;
    canDelete: boolean;
    canBecomeHost: boolean;
    hostPlayerId: string | null;
    guestUrl: string | null;
    isIcebreaker: boolean;
    currentRoundId: string | null;
};

/** One entry per character: separators and revealed letters, null for hidden letters. */
export type GameMask = (string | null)[];

export type GameLetterPick = { playerId: string; letter: string; hit: boolean };

export type GameRound = {
    id: string;
    game: GameKind;
    leaderPlayerId: string | null;
    startedAt: string;
    revealedAt: string | null;
    mask?: GameMask;
    misses?: number;
    maxMisses?: number;
    pickedLetters?: string[];
    /** Client only: the latest picks seen live, oldest first. */
    recentPicks?: GameLetterPick[];
};

export type GameHistoryRound = {
    id: string;
    game: GameKind;
    outcome: GameRoundOutcome;
    word: string | null;
    question: string | null;
    leaderPlayerId: string | null;
    leaderName: string | null;
    winnerPlayerId: string | null;
    winnerName: string | null;
    endedAt: string;
};

export type GameRoundDetail = GameHistoryRound & {
    mask?: GameMask;
    misses?: number;
    maxMisses?: number;
    pickedLetters?: string[];
};

export type GamePointsAward = {
    playerId: string;
    points: number;
    isWin: boolean;
};

export type GameRoundEnded = {
    roundId: string;
    outcome: GameRoundOutcome;
    word: string | null;
    winnerPlayerId: string | null;
    leaderPlayerId: string | null;
    points: GamePointsAward[];
};

export type GameLetterPicked = {
    roundId: string;
    playerId: string;
    letter: string;
    hit: boolean;
    mask: GameMask;
    misses: number;
};

export type GameStartResponse = {
    round: GameRound;
    ended: GameRoundEnded | null;
};

export type GameLetterResponse = GameLetterPicked & {
    ended: GameRoundEnded | null;
};

export type GameSnapshot = {
    room: GameRoomInfo;
    me: { playerId: string; userId: string | null; isGuest: boolean };
    players: GamePlayer[];
    games: GameOption[];
    round: GameRound | null;
    history: GameHistoryRound[];
    links: { team: string | null; retro: string | null };
    serverTime: string;
};

export type GameRoomState = {
    snapshot: GameSnapshot;
    /** The last round seen ending, kept for the end card until the next round starts. */
    lastEnded: GameRoundEnded | null;
};
```

- [ ] **Step 2: Write the reducer and outcome labels**

Create `resources/js/lib/games/room-reducer.ts`:

```ts
import type {
    GameLetterPicked,
    GameRound,
    GameRoomState,
    GameRoundEnded,
    GameSnapshot,
} from './types';

export type RoomAction =
    | { type: 'replace'; snapshot: GameSnapshot }
    | { type: 'round.started'; round: GameRound }
    | { type: 'round.ended'; ended: GameRoundEnded }
    | { type: 'round.patched'; roundId: string; patch: Partial<GameRound> }
    | { type: 'letter.picked'; picked: GameLetterPicked }
    | { type: 'timer.set'; timerEndsAt: string | null };

const RecentPicks = 5;

export function initialRoomState(snapshot: GameSnapshot): GameRoomState {
    return { snapshot, lastEnded: null };
}

function withRound(
    state: GameRoomState,
    roundId: string,
    update: (round: GameRound) => GameRound,
): GameRoomState {
    const round = state.snapshot.round;

    if (!round || round.id !== roundId) {
        return state;
    }

    return {
        ...state,
        snapshot: { ...state.snapshot, round: update(round) },
    };
}

export function roomReducer(
    state: GameRoomState,
    action: RoomAction,
): GameRoomState {
    switch (action.type) {
        case 'replace': {
            const keepsEndCard =
                action.snapshot.round === null &&
                state.lastEnded !== null &&
                state.lastEnded.roundId === action.snapshot.room.currentRoundId;

            return {
                snapshot: action.snapshot,
                lastEnded: keepsEndCard ? state.lastEnded : null,
            };
        }
        case 'round.started':
            return {
                snapshot: {
                    ...state.snapshot,
                    round: action.round,
                    room: {
                        ...state.snapshot.room,
                        currentRoundId: action.round.id,
                    },
                },
                lastEnded: null,
            };
        case 'round.ended': {
            if (state.lastEnded?.roundId === action.ended.roundId) {
                return state;
            }

            const isCurrent =
                state.snapshot.room.currentRoundId === action.ended.roundId;

            if (!isCurrent) {
                return state;
            }

            return {
                snapshot: { ...state.snapshot, round: null },
                lastEnded: action.ended,
            };
        }
        case 'round.patched':
            return withRound(state, action.roundId, (round) => ({
                ...round,
                ...action.patch,
            }));
        case 'letter.picked':
            return withRound(state, action.picked.roundId, (round) => ({
                ...round,
                mask: action.picked.mask,
                misses: action.picked.misses,
                pickedLetters: [
                    ...(round.pickedLetters ?? []).filter(
                        (letter) => letter !== action.picked.letter,
                    ),
                    action.picked.letter,
                ],
                recentPicks: [
                    ...(round.recentPicks ?? []),
                    {
                        playerId: action.picked.playerId,
                        letter: action.picked.letter,
                        hit: action.picked.hit,
                    },
                ].slice(-RecentPicks),
            }));
        case 'timer.set':
            return {
                ...state,
                snapshot: {
                    ...state.snapshot,
                    room: {
                        ...state.snapshot.room,
                        timerEndsAt: action.timerEndsAt,
                    },
                },
            };
    }
}
```

Create `resources/js/lib/games/outcomes.ts`:

```ts
import type { GameRoundOutcome } from './types';

type Translate = (key: string, replacements?: Record<string, string | number>) => string;

export function outcomeLabel(outcome: GameRoundOutcome, t: Translate): string {
    switch (outcome) {
        case 'guessed':
            return t('Guessed');
        case 'solved':
            return t('Solved');
        case 'lost':
            return t('Lost');
        case 'timed_out':
            return t("Time's up");
        case 'passed':
            return t('Passed');
        case 'revealed':
            return t('Revealed');
        case 'abandoned':
            return t('Abandoned');
    }
}
```

- [ ] **Step 3: Write the channel hook**

Create `resources/js/hooks/use-game-channel.ts`:

```ts
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useEffect, useRef, useState } from 'react';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import type { PresenceMember } from '@/lib/retro/types';
import { useSafeConnectionStatus } from './use-retro-channel';

/** Plans 13b and 13c append their event names here. */
export const GameEvents = [
    'game.room.changed',
    'game.room.deleted',
    'game.timer.changed',
    'game.round.started',
    'game.round.ended',
    'game.letter.picked',
] as const;

/**
 * The presence subscription completes moments after the socket (on load
 * and on every reconnect); waiting briefly lets one snapshot cover both.
 */
const ResyncCoalesceMs = 250;

export type GameEventName = (typeof GameEvents)[number];

export type GameEvent = {
    name: GameEventName;
    payload: Record<string, unknown>;
};

export type GameChannelHandlers = {
    onEvent: (event: GameEvent) => void;
    onResync: () => void;
    onJoining: (member: PresenceMember) => void;
};

function withMember(
    members: PresenceMember[],
    member: PresenceMember,
): PresenceMember[] {
    return [...members.filter((known) => known.id !== member.id), member];
}

/** The channel authorization answers 403 when twelve players are online. */
function isRoomFull(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        (error as { status: unknown }).status === 403
    );
}

export function useGameChannel(
    roomId: string,
    enabled: boolean,
    channelHandlers: GameChannelHandlers,
) {
    const [online, setOnline] = useState<PresenceMember[]>([]);
    const [presence, setPresence] = useState<WhisperChannel | null>(null);
    const [full, setFull] = useState(false);
    const status = useSafeConnectionStatus();
    const handlers = useRef(channelHandlers);
    const [wasConnected, setWasConnected] = useState(false);

    handlers.current = channelHandlers;

    if (status === 'connected' && !wasConnected) {
        setWasConnected(true);
    }

    useEffect(() => {
        if (!enabled || !echoIsConfigured()) {
            return;
        }

        let pendingResync: ReturnType<typeof setTimeout> | null = null;

        const scheduleResync = () => {
            if (pendingResync !== null) {
                return;
            }

            pendingResync = setTimeout(() => {
                pendingResync = null;
                handlers.current.onResync();
            }, ResyncCoalesceMs);
        };

        const name = `game.${roomId}`;
        const channel = echo<'reverb'>()
            .join(name)
            .here((members: PresenceMember[]) => {
                setOnline(members.reduce<PresenceMember[]>(withMember, []));
                scheduleResync();
            })
            .joining((member: PresenceMember) => {
                setOnline((current) => withMember(current, member));
                handlers.current.onJoining(member);
            })
            .leaving((member: PresenceMember) => {
                setOnline((current) =>
                    current.filter((known) => known.id !== member.id),
                );
            })
            .error((error: unknown) => {
                if (isRoomFull(error)) {
                    setFull(true);

                    return;
                }

                scheduleResync();
            });

        setPresence(channel as unknown as WhisperChannel);

        for (const event of GameEvents) {
            channel.listen(`.${event}`, (payload: Record<string, unknown>) =>
                handlers.current.onEvent({ name: event, payload }),
            );
        }

        return () => {
            if (pendingResync !== null) {
                clearTimeout(pendingResync);
            }

            echo().leave(name);
            setOnline([]);
            setPresence(null);
        };
    }, [roomId, enabled]);

    const connected = status === 'connected';
    const reconnecting = status === 'failed' || (wasConnected && !connected);

    return { online, connected, reconnecting, presence, full };
}
```

- [ ] **Step 4: Write the room hook**

Create `resources/js/hooks/use-game-room.ts`:

```ts
import { useCallback, useReducer, useRef, useState, type Dispatch } from 'react';
import { toast } from 'sonner';
import GameSnapshotsController from '@/actions/App/Http/Controllers/Games/GameSnapshotsController';
import { useServerOffset } from '@/hooks/use-countdown';
import { useTrans } from '@/hooks/use-trans';
import {
    initialRoomState,
    roomReducer,
    type RoomAction,
} from '@/lib/games/room-reducer';
import type {
    GameLetterPicked,
    GameRound,
    GameRoomState,
    GameRoundEnded,
    GameSnapshot,
} from '@/lib/games/types';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { PresenceMember } from '@/lib/retro/types';
import { useGameChannel, type GameEvent } from './use-game-channel';

const SessionExpiredStatuses = [401, 419];

export type RoomStatus = 'active' | 'ended' | 'deleted';

export type GameRoomHook = {
    state: GameRoomState;
    dispatch: Dispatch<RoomAction>;
    apply: (action: RoomAction) => void;
    refetch: () => Promise<void>;
    run: <T>(mutation: Promise<T>) => Promise<T | undefined>;
    handleError: (error: unknown) => string | null;
    /** Entry point for game events, including those relayed by the retro board (13d). */
    handleEvent: (event: GameEvent) => void;
    status: RoomStatus;
    online: PresenceMember[];
    connected: boolean;
    reconnecting: boolean;
    presence: WhisperChannel | null;
    full: boolean;
    sessionExpired: boolean;
    serverOffset: number;
};

type RoomOptions = {
    /** False when another channel (the retro board) delivers the events. */
    subscribe: boolean;
};

export function useGameRoom(
    initial: GameSnapshot,
    options: RoomOptions,
): GameRoomHook {
    const { t } = useTrans();
    const [state, dispatch] = useReducer(
        roomReducer,
        initial,
        initialRoomState,
    );
    const [status, setStatus] = useState<RoomStatus>('active');
    const [sessionExpired, setSessionExpired] = useState(false);
    const isActive = useRef(true);
    const latestRefetch = useRef(0);
    const bufferedActions = useRef<RoomAction[] | null>(null);
    const latestState = useRef(state);
    const roomId = initial.room.id;
    const serverOffset = useServerOffset(state.snapshot.serverTime);

    latestState.current = state;

    /**
     * While a refetch is in flight, broadcast actions are held back and
     * replayed after its snapshot so events committed after the snapshot
     * was built are not wiped by it.
     */
    const apply = useCallback((action: RoomAction) => {
        if (bufferedActions.current) {
            bufferedActions.current.push(action);

            return;
        }

        dispatch(action);
    }, []);

    const flushBufferedActions = useCallback(() => {
        const actions = bufferedActions.current ?? [];

        bufferedActions.current = null;

        for (const action of actions) {
            dispatch(action);
        }
    }, []);

    const end = useCallback((reason: Exclude<RoomStatus, 'active'>) => {
        if (!isActive.current) {
            return;
        }

        isActive.current = false;
        setStatus(reason);
    }, []);

    const refetch = useCallback(async () => {
        if (!isActive.current) {
            return;
        }

        const request = ++latestRefetch.current;

        bufferedActions.current ??= [];

        try {
            const fresh = await retroRequest<GameSnapshot>(
                GameSnapshotsController.show(roomId),
            );

            if (request !== latestRefetch.current || !isActive.current) {
                return;
            }

            dispatch({ type: 'replace', snapshot: fresh });
        } catch (error) {
            if (!(error instanceof RetroRequestError)) {
                return;
            }

            if (SessionExpiredStatuses.includes(error.status)) {
                setSessionExpired(true);
            }

            if (error.status === 404) {
                end('deleted');
            }

            if (error.status === 403) {
                end('ended');
            }
        } finally {
            if (request === latestRefetch.current) {
                flushBufferedActions();
            }
        }
    }, [roomId, end, flushBufferedActions]);

    const handleEvent = useCallback(
        ({ name, payload }: GameEvent) => {
            switch (name) {
                case 'game.room.changed':
                    void refetch();
                    break;
                case 'game.room.deleted':
                    end('deleted');
                    break;
                case 'game.timer.changed':
                    apply({
                        type: 'timer.set',
                        timerEndsAt: payload.timerEndsAt as string | null,
                    });
                    break;
                case 'game.round.started':
                    apply({
                        type: 'round.started',
                        round: payload.round as GameRound,
                    });
                    break;
                case 'game.round.ended':
                    apply({
                        type: 'round.ended',
                        ended: payload as unknown as GameRoundEnded,
                    });
                    void refetch();
                    break;
                case 'game.letter.picked':
                    apply({
                        type: 'letter.picked',
                        picked: payload as unknown as GameLetterPicked,
                    });
                    break;
            }
        },
        [apply, refetch, end],
    );

    const onJoining = useCallback(
        (member: PresenceMember) => {
            const isKnown = latestState.current.snapshot.players.some(
                (player) => player.presenceId === member.id,
            );

            if (!isKnown) {
                void refetch();
            }
        },
        [refetch],
    );

    const { online, connected, reconnecting, presence, full } =
        useGameChannel(roomId, options.subscribe && status === 'active', {
            onEvent: handleEvent,
            onResync: refetch,
            onJoining,
        });

    const handleError = useCallback(
        (error: unknown): string | null => {
            if (
                error instanceof RetroRequestError &&
                SessionExpiredStatuses.includes(error.status)
            ) {
                setSessionExpired(true);

                return null;
            }

            if (!(error instanceof RetroRequestError)) {
                return t('Something went wrong. Please try again.');
            }

            if (error.status === 0) {
                return t(
                    'The server did not respond in time. Please try again.',
                );
            }

            if (error.status === 429) {
                return t('Slow down a little.');
            }

            return (
                error.message || t('Something went wrong. Please try again.')
            );
        },
        [t],
    );

    /**
     * Every failed mutation (a round that ended meanwhile, a host change) is
     * followed by a fresh snapshot so the screen shows what the server kept.
     */
    const run = useCallback(
        async <T>(mutation: Promise<T>): Promise<T | undefined> => {
            try {
                return await mutation;
            } catch (error) {
                const message = handleError(error);

                if (message === null) {
                    return undefined;
                }

                toast.error(message);
                await refetch();

                return undefined;
            }
        },
        [refetch, handleError],
    );

    return {
        state,
        dispatch,
        apply,
        refetch,
        run,
        handleError,
        handleEvent,
        status,
        online,
        connected,
        reconnecting,
        presence,
        full,
        sessionExpired,
        serverOffset,
    };
}
```

- [ ] **Step 5: Write the context**

Create `resources/js/components/games/room-context.tsx`:

```tsx
import {
    createContext,
    useContext,
    type Dispatch,
    type ReactNode,
} from 'react';
import type { RoomAction } from '@/lib/games/room-reducer';
import type { GameRoundEnded, GameSnapshot } from '@/lib/games/types';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import type { PresenceMember } from '@/lib/retro/types';

export type RoomContextValue = {
    snapshot: GameSnapshot;
    lastEnded: GameRoundEnded | null;
    dispatch: Dispatch<RoomAction>;
    apply: (action: RoomAction) => void;
    run: <T>(mutation: Promise<T>) => Promise<T | undefined>;
    handleError: (error: unknown) => string | null;
    refetch: () => Promise<void>;
    /** Presence members: `id` is a player's presenceId. */
    online: PresenceMember[];
    presence: WhisperChannel | null;
    serverOffset: number;
    sessionExpired: boolean;
};

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({
    value,
    children,
}: {
    value: RoomContextValue;
    children: ReactNode;
}) {
    return <RoomContext value={value}>{children}</RoomContext>;
}

export function useRoom(): RoomContextValue {
    const value = useContext(RoomContext);

    if (!value) {
        throw new Error('useRoom() must be used inside <RoomProvider>.');
    }

    return value;
}
```

- [ ] **Step 6: Check types and lint**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npx vp check --fix resources/js/lib/games resources/js/hooks/use-game-channel.ts resources/js/hooks/use-game-room.ts resources/js/components/games/room-context.tsx && npm run check`
Expected: no new errors (known pre-existing failures only).

- [ ] **Step 7: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| Guessed | Deviné | Adivinado | Erraten |
| Solved | Résolu | Resuelto | Gelöst |
| Lost | Perdu | Perdido | Verloren |
| Time's up | Temps écoulé | Se acabó el tiempo | Die Zeit ist um |
| Passed | Passé | Pasado | Übersprungen |
| Revealed | Révélé | Revelado | Aufgedeckt |
| Abandoned | Abandonné | Abandonado | Abgebrochen |

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php` — Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add resources/js/lib/games resources/js/hooks/use-game-channel.ts resources/js/hooks/use-game-room.ts resources/js/components/games/room-context.tsx lang
git commit -m "feat(games): add the game room state, channel and context

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 13: Hangman UI — word mask, keyboard, figure and board

**Files:**
- Create: `resources/js/components/games/{word-mask,letter-keyboard,hangman-figure,hangman-board}.tsx`

**Interfaces:**
- Consumes: `useRoom()` (Task 12), `GameLettersController.store` (Wayfinder), types `GameRound`, `GameMask`, `GameLetterResponse`.
- Produces: `WordMask({mask, className?})` (reused by 13b for Draw & Guess and Decoded guessers), `LetterKeyboard({picked, disabled, onPick})`, `HangmanFigure({misses, maxMisses})`, `HangmanBoard({round})` (mounted by `GameBoard` in Task 14).

- [ ] **Step 1: Write the word mask and the keyboard**

Create `resources/js/components/games/word-mask.tsx`:

```tsx
import { useTrans } from '@/hooks/use-trans';
import type { GameMask } from '@/lib/games/types';
import { cn } from '@/lib/utils';

type Props = { mask: GameMask; className?: string };

export function WordMask({ mask, className }: Props) {
    const { t } = useTrans();
    const hidden = mask.filter((character) => character === null).length;

    return (
        <div
            role="img"
            aria-label={t(':count letters left to find', { count: hidden })}
            className={cn('flex flex-wrap justify-center gap-1.5', className)}
        >
            {mask.map((character, index) => {
                if (character === ' ') {
                    return <span key={index} className="w-4" />;
                }

                if (character === '-' || character === "'") {
                    return (
                        <span key={index} className="self-end text-2xl font-semibold">
                            {character}
                        </span>
                    );
                }

                return (
                    <span
                        key={index}
                        className="flex h-10 w-8 items-end justify-center border-b-2 border-foreground pb-0.5 text-2xl font-semibold uppercase"
                    >
                        {character ?? ''}
                    </span>
                );
            })}
        </div>
    );
}
```

Create `resources/js/components/games/letter-keyboard.tsx`:

```tsx
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

const Letters = 'abcdefghijklmnopqrstuvwxyz'.split('');

type Props = {
    picked: string[];
    disabled: boolean;
    onPick: (letter: string) => void;
};

export function LetterKeyboard({ picked, disabled, onPick }: Props) {
    const { t } = useTrans();

    return (
        <div
            role="group"
            aria-label={t('Letters')}
            className="grid grid-cols-7 gap-1.5 sm:grid-cols-9 md:grid-cols-13"
        >
            {Letters.map((letter) => {
                const isPicked = picked.includes(letter);

                return (
                    <Button
                        key={letter}
                        type="button"
                        variant={isPicked ? 'ghost' : 'outline'}
                        className="h-10 w-full px-0 text-base uppercase"
                        disabled={disabled || isPicked}
                        aria-pressed={isPicked}
                        onClick={() => onPick(letter)}
                    >
                        {letter}
                    </Button>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 2: Write the figure**

Create `resources/js/components/games/hangman-figure.tsx`:

```tsx
import { useTrans } from '@/hooks/use-trans';

const Parts = [
    <circle key="head" cx="140" cy="62" r="16" />,
    <line key="body" x1="140" y1="78" x2="140" y2="130" />,
    <line key="left-arm" x1="140" y1="92" x2="118" y2="112" />,
    <line key="right-arm" x1="140" y1="92" x2="162" y2="112" />,
    <line key="left-leg" x1="140" y1="130" x2="120" y2="160" />,
    <line key="right-leg" x1="140" y1="130" x2="160" y2="160" />,
];

type Props = { misses: number; maxMisses: number };

export function HangmanFigure({ misses, maxMisses }: Props) {
    const { t } = useTrans();
    const shown = Math.min(
        Parts.length,
        Math.round((misses * Parts.length) / Math.max(1, maxMisses)),
    );

    return (
        <svg
            viewBox="0 0 200 190"
            role="img"
            aria-label={t(':count of :max misses', {
                count: misses,
                max: maxMisses,
            })}
            className="h-40 w-auto text-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
        >
            <line x1="20" y1="180" x2="100" y2="180" />
            <line x1="60" y1="180" x2="60" y2="20" />
            <line x1="60" y1="20" x2="140" y2="20" />
            <line x1="140" y1="20" x2="140" y2="46" />
            {Parts.slice(0, shown)}
        </svg>
    );
}
```

- [ ] **Step 3: Write the board**

Create `resources/js/components/games/hangman-board.tsx`:

```tsx
import { useState } from 'react';
import GameLettersController from '@/actions/App/Http/Controllers/Games/GameLettersController';
import { useTrans } from '@/hooks/use-trans';
import type { GameLetterResponse, GameRound } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { HangmanFigure } from './hangman-figure';
import { LetterKeyboard } from './letter-keyboard';
import { useRoom } from './room-context';
import { WordMask } from './word-mask';

export function HangmanBoard({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [pending, setPending] = useState(false);
    const misses = round.misses ?? 0;
    const maxMisses = round.maxMisses ?? 6;
    const names = new Map(
        ctx.snapshot.players.map((player) => [player.id, player.name]),
    );

    const pick = async (letter: string) => {
        setPending(true);

        const response = await ctx.run(
            retroRequest<GameLetterResponse>(
                GameLettersController.store({
                    room: ctx.snapshot.room.id,
                    round: round.id,
                }),
                { letter },
            ),
        );

        setPending(false);

        if (!response) {
            return;
        }

        ctx.dispatch({ type: 'letter.picked', picked: response });

        if (response.ended) {
            ctx.dispatch({ type: 'round.ended', ended: response.ended });
            void ctx.refetch();
        }
    };

    return (
        <div className="flex w-full max-w-2xl flex-col items-center gap-6">
            <HangmanFigure misses={misses} maxMisses={maxMisses} />
            <p className="text-sm text-muted-foreground">
                {t(':count of :max misses', { count: misses, max: maxMisses })}
            </p>
            <WordMask mask={round.mask ?? []} />
            <LetterKeyboard
                picked={round.pickedLetters ?? []}
                disabled={pending}
                onPick={(letter) => void pick(letter)}
            />
            {(round.recentPicks ?? []).length > 0 && (
                <ul
                    aria-label={t('Last letters')}
                    className="flex flex-wrap justify-center gap-2 text-sm"
                >
                    {[...(round.recentPicks ?? [])].reverse().map((pick) => (
                        <li
                            key={`${pick.playerId}-${pick.letter}`}
                            className={cn(
                                'rounded-full border px-2 py-0.5',
                                pick.hit
                                    ? 'border-green-600 text-green-700 dark:text-green-400'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {t(':name picked :letter', {
                                name: names.get(pick.playerId) ?? t('Someone'),
                                letter: pick.letter.toUpperCase(),
                            })}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
```

- [ ] **Step 4: Check types and lint**

Run: `npm run types:check && npx vp check --fix resources/js/components/games && npm run check`
Expected: no new errors.

- [ ] **Step 5: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| :count letters left to find | :count lettres à trouver | Quedan :count letras por encontrar | Noch :count Buchstaben zu finden |
| Letters | Lettres | Letras | Buchstaben |
| :count of :max misses | :count erreurs sur :max | :count de :max fallos | :count von :max Fehlern |
| Last letters | Dernières lettres | Últimas letras | Letzte Buchstaben |
| :name picked :letter | :name a choisi :letter | :name eligió :letter | :name hat :letter gewählt |
| Someone | Quelqu'un | Alguien | Jemand |

- [ ] **Step 6: Commit**

```bash
git add resources/js/components/games lang
git commit -m "feat(games): add the Hangman board

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 14: Room page — shell, header, players, start and end card, history, menus

**Files:**
- Create: `resources/js/pages/games/show.tsx`
- Create: `resources/js/components/games/{game-room,game-panel,game-board,start-round-controls,round-end-card,players-list,room-header,game-switcher,room-timer,history-drawer,round-detail,room-menu,room-settings-dialog,delete-room-dialog,room-gone,room-full}.tsx`
- Modify: `resources/js/app.tsx` (layout of `games/show`)

**Interfaces:**
- Consumes: Task 12 (`useGameRoom`, `RoomProvider`, `useRoom`, reducer actions, `outcomeLabel`), Task 13 (`HangmanBoard`, `WordMask`), Wayfinder controllers `Games/{GameRoundsController,GameSwitchesController,GameTimersController,GameRoomsController,GameGuestTokensController,GameHostsController}`, `PresenceStrip`, `LanguageSwitcher`, `ConnectionBanner`, `SessionExpiredBanner`, `useCountdown`/`formatSeconds`.
- Produces: `GameRoom({snapshot})` (standalone page body), `GamePanel()` (stage + players; 13d mounts it in the retro's Icebreaker phase under its own `RoomProvider`), `GameBoard({round})` (switch on `round.game`; 13b/13c add `case` branches), `StartRoundControls({label})` (switch on `room.game`; 13b adds the leader picker for `draw`/`decoded`), `RoundEndCard()`, `PlayersList({highlightPlayerId?})`, `RoomHeader()`, `RoomTimer()`, `HistoryDrawer()`, `RoundDetail({roundId})` (switch on the detail's `game`; 13b adds the drawing replay), `RoomMenu()`, `RoomGone`, `RoomFull`; page `games/show` (no layout).

- [ ] **Step 1: Write the page, the shell and the stage**

Create `resources/js/pages/games/show.tsx`:

```tsx
import { Head } from '@inertiajs/react';
import { GameRoom } from '@/components/games/game-room';
import type { GameSnapshot } from '@/lib/games/types';

type Props = { snapshot: GameSnapshot };

export default function ShowGameRoom({ snapshot }: Props) {
    return (
        <>
            <Head title={snapshot.room.name ?? ''} />
            <GameRoom snapshot={snapshot} />
        </>
    );
}
```

In `resources/js/app.tsx`, add `case name === 'games/show':` next to `case name === 'poker/show':` (the branch returning `null`).

Create `resources/js/components/games/game-room.tsx`:

```tsx
import { ConnectionBanner } from '@/components/retro/connection-banner';
import { SessionExpiredBanner } from '@/components/retro/session-expired-banner';
import { useGameRoom } from '@/hooks/use-game-room';
import type { GameSnapshot } from '@/lib/games/types';
import { GamePanel } from './game-panel';
import { RoomProvider, type RoomContextValue } from './room-context';
import { RoomFull } from './room-full';
import { RoomGone } from './room-gone';
import { RoomHeader } from './room-header';

export function GameRoom({ snapshot: initial }: { snapshot: GameSnapshot }) {
    const room = useGameRoom(initial, { subscribe: true });

    if (room.full) {
        return <RoomFull />;
    }

    if (room.status !== 'active') {
        return (
            <RoomGone
                reason={room.status}
                teamUrl={room.state.snapshot.links.team}
            />
        );
    }

    const ctx: RoomContextValue = {
        snapshot: room.state.snapshot,
        lastEnded: room.state.lastEnded,
        dispatch: room.dispatch,
        apply: room.apply,
        run: room.run,
        handleError: room.handleError,
        refetch: room.refetch,
        online: room.online,
        presence: room.presence,
        serverOffset: room.serverOffset,
        sessionExpired: room.sessionExpired,
    };

    return (
        <RoomProvider value={ctx}>
            <div className="flex min-h-dvh flex-col">
                {room.sessionExpired && <SessionExpiredBanner />}
                <div
                    className="flex flex-1 flex-col"
                    inert={room.sessionExpired}
                >
                    <RoomHeader />
                    <ConnectionBanner reconnecting={room.reconnecting} />
                    <GamePanel />
                </div>
            </div>
        </RoomProvider>
    );
}
```

Create `resources/js/components/games/game-panel.tsx`:

```tsx
import { GameBoard } from './game-board';
import { PlayersList } from './players-list';
import { useRoom } from './room-context';
import { RoundEndCard } from './round-end-card';

export function GamePanel() {
    const { snapshot, lastEnded } = useRoom();
    const { round } = snapshot;

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 lg:flex-row">
            <main className="flex min-w-0 flex-1 flex-col items-center gap-4">
                {round ? <GameBoard round={round} /> : <RoundEndCard />}
            </main>
            <aside className="w-full shrink-0 lg:w-64">
                <PlayersList
                    highlightPlayerId={
                        round ? null : (lastEnded?.winnerPlayerId ?? null)
                    }
                />
            </aside>
        </div>
    );
}
```

Create `resources/js/components/games/game-board.tsx`:

```tsx
import { useTrans } from '@/hooks/use-trans';
import type { GameRound } from '@/lib/games/types';
import { HangmanBoard } from './hangman-board';

export function GameBoard({ round }: { round: GameRound }) {
    const { t } = useTrans();

    switch (round.game) {
        case 'hangman':
            return <HangmanBoard round={round} />;
        default:
            return (
                <p className="text-muted-foreground">
                    {t('This game is not available.')}
                </p>
            );
    }
}
```

Create `resources/js/components/games/start-round-controls.tsx`:

```tsx
import { Play } from 'lucide-react';
import { useState } from 'react';
import GameRoundsController from '@/actions/App/Http/Controllers/Games/GameRoundsController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { GameStartResponse } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

export function StartRoundControls({ label }: { label: string }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { room, games } = ctx.snapshot;
    const isAvailable = games.some(
        (option) => option.value === room.game && option.available,
    );

    if (!room.isHost) {
        return (
            <p className="text-muted-foreground">
                {t('Waiting for the host to start.')}
            </p>
        );
    }

    if (!isAvailable) {
        return (
            <p className="text-muted-foreground">
                {t('This game is not available.')}
            </p>
        );
    }

    const start = async () => {
        setBusy(true);

        const response = await ctx.run(
            retroRequest<GameStartResponse>(
                GameRoundsController.store(room.id),
                {},
            ),
        );

        setBusy(false);

        if (!response) {
            return;
        }

        if (response.ended) {
            ctx.dispatch({ type: 'round.ended', ended: response.ended });
        }

        ctx.dispatch({ type: 'round.started', round: response.round });
    };

    return (
        <Button disabled={busy} onClick={() => void start()}>
            <Play className="size-4" />
            {label}
        </Button>
    );
}
```

Create `resources/js/components/games/round-end-card.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { outcomeLabel } from '@/lib/games/outcomes';
import { useRoom } from './room-context';
import { StartRoundControls } from './start-round-controls';

export function RoundEndCard() {
    const { snapshot, lastEnded } = useRoom();
    const { t } = useTrans();
    const lastRound =
        snapshot.history.find(
            (round) => round.id === snapshot.room.currentRoundId,
        ) ?? null;
    const outcome = lastEnded?.outcome ?? lastRound?.outcome ?? null;
    const word = lastEnded?.word ?? lastRound?.word ?? null;
    const winnerId =
        lastEnded?.winnerPlayerId ?? lastRound?.winnerPlayerId ?? null;
    const winner =
        snapshot.players.find((player) => player.id === winnerId) ?? null;

    if (outcome === null) {
        return (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
                <h2 className="text-xl font-semibold">{t('Ready to play?')}</h2>
                <StartRoundControls label={t('Start')} />
            </div>
        );
    }

    return (
        <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-lg border p-6 text-center">
            <Badge variant="secondary">{outcomeLabel(outcome, t)}</Badge>
            {word && (
                <p className="text-2xl font-semibold tracking-wide">{word}</p>
            )}
            {winner && (
                <p className="text-muted-foreground">
                    {t(':name found it!', { name: winner.name })}
                </p>
            )}
            <StartRoundControls label={t('Next round')} />
        </div>
    );
}
```

Create `resources/js/components/games/players-list.tsx`:

```tsx
import { Check, Crown } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { useRoom } from './room-context';

type Props = { highlightPlayerId?: string | null };

export function PlayersList({ highlightPlayerId = null }: Props) {
    const { snapshot, online } = useRoom();
    const { t } = useTrans();
    const onlineIds = new Set(online.map((member) => member.id));
    const players = [...snapshot.players].sort(
        (first, second) =>
            Number(onlineIds.has(second.presenceId)) -
            Number(onlineIds.has(first.presenceId)),
    );

    return (
        <section aria-labelledby="game-players" className="space-y-2">
            <h2 id="game-players" className="text-sm font-semibold">
                {t('Players')}
            </h2>
            <ul className="space-y-1">
                {players.map((player) => (
                    <li
                        key={player.id}
                        className={cn(
                            'flex items-center gap-2 rounded-md px-2 py-1',
                            !onlineIds.has(player.presenceId) && 'opacity-50',
                        )}
                    >
                        <img
                            src={player.avatarUrl}
                            alt=""
                            className="size-6 rounded-full bg-muted"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">
                            {player.name}
                            {player.isGuest && (
                                <span className="text-muted-foreground">
                                    {' '}
                                    {t('(guest)')}
                                </span>
                            )}
                        </span>
                        {player.id === snapshot.room.hostPlayerId && (
                            <Crown
                                className="size-4 text-amber-500"
                                aria-label={t('Host')}
                            />
                        )}
                        {player.id === highlightPlayerId && (
                            <Check
                                className="size-4 text-green-600"
                                aria-label={t('Winner')}
                            />
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
}
```

- [ ] **Step 2: Write the header and its controls**

Create `resources/js/components/games/room-header.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import { ArrowLeft, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { LanguageSwitcher } from '@/components/language-switcher';
import { PresenceStrip } from '@/components/retro/presence-strip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { GameSwitcher } from './game-switcher';
import { HistoryDrawer } from './history-drawer';
import { useRoom } from './room-context';
import { RoomMenu } from './room-menu';
import { RoomTimer } from './room-timer';

export function RoomHeader() {
    const { snapshot, online } = useRoom();
    const { t } = useTrans();
    const { room, me, links } = snapshot;
    const gameLabel =
        snapshot.games.find((option) => option.value === room.game)?.label ??
        room.game;

    const copyGuestLink = async () => {
        if (room.guestUrl === null) {
            return;
        }

        try {
            await navigator.clipboard.writeText(room.guestUrl);
            toast(t('Link copied'));
        } catch {
            toast.error(t('Something went wrong. Please try again.'));
        }
    };

    return (
        <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
            {links.team && (
                <Link
                    href={links.team}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t('Back to the team')}
                >
                    <ArrowLeft className="size-5" />
                </Link>
            )}
            <h1 className="text-lg font-semibold">{room.name}</h1>
            {room.isHost ? (
                <GameSwitcher />
            ) : (
                <Badge variant="outline">{gameLabel}</Badge>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-3">
                <RoomTimer />
                <HistoryDrawer />
                {room.guestUrl !== null && (
                    <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t('Copy guest link')}
                        onClick={() => void copyGuestLink()}
                    >
                        <Link2 className="size-4" />
                    </Button>
                )}
                <RoomMenu />
                <PresenceStrip members={online} />
                {me.isGuest && <LanguageSwitcher />}
            </div>
        </header>
    );
}
```

Create `resources/js/components/games/game-switcher.tsx`:

```tsx
import { useState } from 'react';
import GameSwitchesController from '@/actions/App/Http/Controllers/Games/GameSwitchesController';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type { GameKind } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

/** Switching mid-round abandons the round for everyone (spec §4). */
export function GameSwitcher() {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { room, games } = ctx.snapshot;

    const change = async (game: GameKind) => {
        if (game === room.game) {
            return;
        }

        setBusy(true);

        const result = await ctx.run(
            retroRequest(GameSwitchesController.update(room.id), { game }),
        );

        setBusy(false);

        if (result !== undefined) {
            await ctx.refetch();
        }
    };

    return (
        <Select
            value={room.game}
            disabled={busy}
            onValueChange={(value) => void change(value as GameKind)}
        >
            <SelectTrigger className="w-48" aria-label={t('Game')}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {games
                    .filter(
                        (option) => option.available || option.value === room.game,
                    )
                    .map((option) => (
                        <SelectItem
                            key={option.value}
                            value={option.value}
                            disabled={!option.available}
                        >
                            {option.label}
                        </SelectItem>
                    ))}
            </SelectContent>
        </Select>
    );
}
```

Create `resources/js/components/games/room-timer.tsx`:

```tsx
import { AlarmClock } from 'lucide-react';
import { useState } from 'react';
import GameTimersController from '@/actions/App/Http/Controllers/Games/GameTimersController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatSeconds, useCountdown } from '@/hooks/use-countdown';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

const Minutes = [1, 2, 3, 5, 10];

export function RoomTimer() {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { room } = ctx.snapshot;
    const remaining = useCountdown(room.timerEndsAt, ctx.serverOffset);
    const canSet = room.isHost && !room.isIcebreaker;

    const set = async (seconds: number | null) => {
        setBusy(true);

        const response = await ctx.run(
            retroRequest<{ timerEndsAt: string | null }>(
                GameTimersController.update(room.id),
                { seconds },
            ),
        );

        setBusy(false);

        if (response) {
            ctx.apply({ type: 'timer.set', timerEndsAt: response.timerEndsAt });
        }
    };

    const display =
        remaining === null ? null : remaining === 0 ? (
            <Badge variant="destructive">{t("Time's up")}</Badge>
        ) : (
            <Badge variant="secondary" className="tabular-nums">
                {formatSeconds(remaining)}
            </Badge>
        );

    if (!canSet) {
        return display;
    }

    return (
        <div className="flex items-center gap-2">
            {display}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" aria-label={t('Timer')}>
                        <AlarmClock className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {Minutes.map((minutes) => (
                        <DropdownMenuItem
                            key={minutes}
                            disabled={busy}
                            onSelect={() => void set(minutes * 60)}
                        >
                            {t(':count min', { count: minutes })}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        disabled={busy || room.timerEndsAt === null}
                        onSelect={() => void set(null)}
                    >
                        {t('Stop timer')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
```

- [ ] **Step 3: Write the history drawer and round detail**

Create `resources/js/components/games/history-drawer.tsx`:

```tsx
import { History } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { useTrans } from '@/hooks/use-trans';
import { outcomeLabel } from '@/lib/games/outcomes';
import { useRoom } from './room-context';
import { RoundDetail } from './round-detail';

export function HistoryDrawer() {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const [roundId, setRoundId] = useState<string | null>(null);

    return (
        <Sheet
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                setRoundId(null);
            }}
        >
            <SheetTrigger asChild>
                <Button size="sm" variant="outline">
                    <History className="size-4" />
                    {t('History')}
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full gap-4 p-4 sm:max-w-md">
                <SheetTitle>{t('Last rounds')}</SheetTitle>
                {roundId !== null ? (
                    <div className="space-y-4">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setRoundId(null)}
                        >
                            {t('Back')}
                        </Button>
                        <RoundDetail roundId={roundId} />
                    </div>
                ) : snapshot.history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {t('No rounds played yet.')}
                    </p>
                ) : (
                    <ul className="space-y-2 overflow-y-auto">
                        {snapshot.history.map((round) => (
                            <li key={round.id}>
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-3 rounded-md border p-2 text-left hover:bg-muted"
                                    onClick={() => setRoundId(round.id)}
                                >
                                    <span className="min-w-0 flex-1 truncate font-medium">
                                        {round.word ?? round.question ?? '—'}
                                    </span>
                                    <Badge variant="secondary">
                                        {outcomeLabel(round.outcome, t)}
                                    </Badge>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </SheetContent>
        </Sheet>
    );
}
```

Create `resources/js/components/games/round-detail.tsx`:

```tsx
import { useEffect, useState } from 'react';
import GameRoundsController from '@/actions/App/Http/Controllers/Games/GameRoundsController';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { outcomeLabel } from '@/lib/games/outcomes';
import type { GameRoundDetail } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';
import { WordMask } from './word-mask';

export function RoundDetail({ roundId }: { roundId: string }) {
    const { snapshot, handleError } = useRoom();
    const { t } = useTrans();
    const [detail, setDetail] = useState<GameRoundDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const roomId = snapshot.room.id;

    useEffect(() => {
        let isCurrent = true;

        retroRequest<GameRoundDetail>(
            GameRoundsController.show({ room: roomId, round: roundId }),
        )
            .then((fresh) => {
                if (isCurrent) {
                    setDetail(fresh);
                }
            })
            .catch((failure: unknown) => {
                if (isCurrent) {
                    setError(handleError(failure));
                }
            });

        return () => {
            isCurrent = false;
        };
    }, [roomId, roundId, handleError]);

    if (error !== null) {
        return <p className="text-sm text-destructive">{error}</p>;
    }

    if (detail === null) {
        return <Spinner />;
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Badge variant="secondary">{outcomeLabel(detail.outcome, t)}</Badge>
                {detail.winnerName && (
                    <span className="text-sm text-muted-foreground">
                        {t(':name found it!', { name: detail.winnerName })}
                    </span>
                )}
            </div>
            {detail.leaderName && (
                <p className="text-sm text-muted-foreground">
                    {t('Led by :name', { name: detail.leaderName })}
                </p>
            )}
            <GameDetail detail={detail} />
        </div>
    );
}

function GameDetail({ detail }: { detail: GameRoundDetail }) {
    const { t } = useTrans();

    switch (detail.game) {
        case 'hangman':
            return (
                <div className="space-y-2">
                    <WordMask mask={detail.mask ?? []} />
                    <p className="text-center text-sm text-muted-foreground">
                        {t('Letters tried: :letters', {
                            letters: (detail.pickedLetters ?? [])
                                .join(' ')
                                .toUpperCase(),
                        })}
                    </p>
                </div>
            );
        default:
            return detail.word ? (
                <p className="text-xl font-semibold">{detail.word}</p>
            ) : null;
    }
}
```

- [ ] **Step 4: Write the menu, dialogs and gone/full states**

Create `resources/js/components/games/room-menu.tsx`:

```tsx
import { Settings2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import GameGuestTokensController from '@/actions/App/Http/Controllers/Games/GameGuestTokensController';
import GameHostsController from '@/actions/App/Http/Controllers/Games/GameHostsController';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { DeleteRoomDialog } from './delete-room-dialog';
import { useRoom } from './room-context';
import { RoomSettingsDialog } from './room-settings-dialog';

type OpenDialog = 'settings' | 'delete' | null;

export function RoomMenu() {
    const ctx = useRoom();
    const { t } = useTrans();
    const [chosen, setChosen] = useState<OpenDialog>(null);
    const { room, me, players } = ctx.snapshot;
    const open = ctx.sessionExpired ? null : chosen;
    const hostCandidates = players.filter(
        (player) => !player.isGuest && player.id !== me.playerId,
    );

    if (room.isIcebreaker || (!room.canManage && !room.canDelete && !room.canBecomeHost)) {
        return null;
    }

    const setHost = async (playerId: string) => {
        const result = await ctx.run(
            retroRequest(GameHostsController.update(room.id), {
                player_id: playerId,
            }),
        );

        if (result !== undefined) {
            await ctx.refetch();
        }
    };

    const regenerateLink = async () => {
        const result = await ctx.run(
            retroRequest<{ guestUrl: string | null }>(
                GameGuestTokensController.store(room.id),
            ),
        );

        if (result) {
            toast(t('A new guest link was created. The old one no longer works.'));
            await ctx.refetch();
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label={t('Room menu')}>
                        <Settings2 className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {room.canManage && (
                        <DropdownMenuItem onSelect={() => setChosen('settings')}>
                            {t('Room settings')}
                        </DropdownMenuItem>
                    )}
                    {room.canManage && room.access === 'link' && (
                        <DropdownMenuItem onSelect={() => void regenerateLink()}>
                            {t('Regenerate guest link')}
                        </DropdownMenuItem>
                    )}
                    {room.isHost && hostCandidates.length > 0 && (
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                {t('Hand over hosting')}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                {hostCandidates.map((player) => (
                                    <DropdownMenuItem
                                        key={player.id}
                                        onSelect={() => void setHost(player.id)}
                                    >
                                        {player.name}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    )}
                    {room.canBecomeHost && (
                        <DropdownMenuItem onSelect={() => void setHost(me.playerId)}>
                            {t('Become host')}
                        </DropdownMenuItem>
                    )}
                    {room.canDelete && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setChosen('delete')}
                            >
                                {t('Delete room')}
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
            <RoomSettingsDialog
                open={open === 'settings'}
                onOpenChange={(next) => setChosen(next ? 'settings' : null)}
            />
            <DeleteRoomDialog
                open={open === 'delete'}
                onOpenChange={(next) => setChosen(next ? 'delete' : null)}
            />
        </>
    );
}
```

Create `resources/js/components/games/room-settings-dialog.tsx`:

```tsx
import { usePage } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import GameRoomsController from '@/actions/App/Http/Controllers/Games/GameRoomsController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type { GameRoomAccess } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function RoomSettingsDialog({ open, onOpenChange }: Props) {
    const { t } = useTrans();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined}>
                <DialogTitle>{t('Room settings')}</DialogTitle>
                {open && <RoomSettingsForm onDone={() => onOpenChange(false)} />}
            </DialogContent>
        </Dialog>
    );
}

const LocaleNames: Record<string, string> = {
    en: 'English',
    fr: 'Français',
    es: 'Español',
    de: 'Deutsch',
};

function RoomSettingsForm({ onDone }: { onDone: () => void }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const { locales } = usePage().props;
    const { room } = ctx.snapshot;
    const [name, setName] = useState(room.name ?? '');
    const [access, setAccess] = useState<GameRoomAccess>(room.access);
    const [locale, setLocale] = useState(room.locale);
    const [busy, setBusy] = useState(false);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);

        const result = await ctx.run(
            retroRequest(GameRoomsController.update(room.id), {
                name: name.trim(),
                access,
                locale,
            }),
        );

        setBusy(false);

        if (result !== undefined) {
            await ctx.refetch();
            onDone();
        }
    };

    return (
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="room-name">{t('Name')}</Label>
                <Input
                    id="room-name"
                    value={name}
                    maxLength={60}
                    required
                    onChange={(event) => setName(event.target.value)}
                />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="room-access">{t('Who can join')}</Label>
                <Select
                    value={access}
                    onValueChange={(value) => setAccess(value as GameRoomAccess)}
                >
                    <SelectTrigger id="room-access">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="team">{t('Team members only')}</SelectItem>
                        <SelectItem value="link">{t('Anyone with the link')}</SelectItem>
                    </SelectContent>
                </Select>
                {room.access === 'link' && access === 'team' && (
                    <p className="text-sm text-muted-foreground">
                        {t('Guests in this room lose access.')}
                    </p>
                )}
            </div>
            <div className="grid gap-2">
                <Label htmlFor="room-locale">{t('Language of words and questions')}</Label>
                <Select value={locale} onValueChange={setLocale}>
                    <SelectTrigger id="room-locale">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {locales.map((code) => (
                            <SelectItem key={code} value={code}>
                                {LocaleNames[code] ?? code}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
                <Button disabled={busy || name.trim() === ''}>{t('Save')}</Button>
            </DialogFooter>
        </form>
    );
}
```

Create `resources/js/components/games/delete-room-dialog.tsx`:

```tsx
import { router } from '@inertiajs/react';
import { useState } from 'react';
import GameRoomsController from '@/actions/App/Http/Controllers/Games/GameRoomsController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { dashboard } from '@/routes';
import { useRoom } from './room-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function DeleteRoomDialog({ open, onOpenChange }: Props) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);

    const destroy = async () => {
        setBusy(true);

        const result = await ctx.run(
            retroRequest(GameRoomsController.destroy(ctx.snapshot.room.id)),
        );

        setBusy(false);

        if (result !== undefined) {
            router.visit(ctx.snapshot.links.team ?? dashboard().url);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogTitle>{t('Delete this room?')}</DialogTitle>
                <DialogDescription>
                    {t('Its rounds and scores are deleted for everyone.')}
                </DialogDescription>
                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('Cancel')}
                    </Button>
                    <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void destroy()}
                    >
                        {t('Delete')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
```

Create `resources/js/components/games/room-gone.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

type Props = {
    reason: 'ended' | 'deleted';
    teamUrl: string | null;
};

export function RoomGone({ reason, teamUrl }: Props) {
    const { t } = useTrans();

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-lg">
                {reason === 'deleted'
                    ? t('This room was deleted.')
                    : t('Your access to this room has ended.')}
            </p>
            {teamUrl && (
                <Button asChild variant="outline">
                    <Link href={teamUrl}>{t('Back to the team')}</Link>
                </Button>
            )}
        </div>
    );
}
```

Create `resources/js/components/games/room-full.tsx`:

```tsx
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export function RoomFull() {
    const { t } = useTrans();

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-lg">{t('This room is full.')}</p>
            <p className="text-muted-foreground">
                {t('Up to 12 players can be online at once.')}
            </p>
            <Button variant="outline" onClick={() => window.location.reload()}>
                {t('Try again')}
            </Button>
        </div>
    );
}
```

- [ ] **Step 5: Check types and lint**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npx vp check --fix resources/js/components/games resources/js/pages/games resources/js/app.tsx && npm run check`
Expected: no new errors.

- [ ] **Step 6: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| Waiting for the host to start. | En attente du lancement par l'hôte. | Esperando a que el anfitrión empiece. | Warte darauf, dass der Host startet. |
| Ready to play? | Prêts à jouer ? | ¿Listos para jugar? | Bereit zum Spielen? |
| Next round | Manche suivante | Siguiente ronda | Nächste Runde |
| :name found it! | :name a trouvé ! | ¡:name lo encontró! | :name hat es gefunden! |
| (guest) | (invité) | (invitado) | (Gast) |
| Host | Hôte | Anfitrión | Host |
| Winner | Gagnant | Ganador | Gewinner |
| Game | Jeu | Juego | Spiel |
| History | Historique | Historial | Verlauf |
| Last rounds | Dernières manches | Últimas rondas | Letzte Runden |
| No rounds played yet. | Aucune manche jouée pour l'instant. | Aún no se ha jugado ninguna ronda. | Noch keine Runde gespielt. |
| Back | Retour | Volver | Zurück |
| Led by :name | Menée par :name | Dirigida por :name | Geleitet von :name |
| Letters tried: :letters | Lettres essayées : :letters | Letras probadas: :letters | Versuchte Buchstaben: :letters |
| Room menu | Menu du salon | Menú de la sala | Raummenü |
| Room settings | Paramètres du salon | Ajustes de la sala | Raumeinstellungen |
| Regenerate guest link | Régénérer le lien invité | Regenerar el enlace de invitado | Gastlink neu erzeugen |
| A new guest link was created. The old one no longer works. | Un nouveau lien invité a été créé. L'ancien ne fonctionne plus. | Se creó un nuevo enlace de invitado. El anterior ya no funciona. | Ein neuer Gastlink wurde erstellt. Der alte funktioniert nicht mehr. |
| Hand over hosting | Transmettre le rôle d'hôte | Ceder el papel de anfitrión | Host-Rolle übergeben |
| Become host | Devenir hôte | Ser anfitrión | Host werden |
| Delete room | Supprimer le salon | Eliminar la sala | Raum löschen |
| Who can join | Qui peut rejoindre | Quién puede unirse | Wer beitreten kann |
| Team members only | Membres de l'équipe uniquement | Solo miembros del equipo | Nur Teammitglieder |
| Anyone with the link | Toute personne ayant le lien | Cualquiera con el enlace | Alle mit dem Link |
| Guests in this room lose access. | Les invités de ce salon perdent l'accès. | Los invitados de esta sala pierden el acceso. | Gäste in diesem Raum verlieren den Zugriff. |
| Language of words and questions | Langue des mots et des questions | Idioma de las palabras y preguntas | Sprache der Wörter und Fragen |
| Delete this room? | Supprimer ce salon ? | ¿Eliminar esta sala? | Diesen Raum löschen? |
| Its rounds and scores are deleted for everyone. | Ses manches et ses scores sont supprimés pour tout le monde. | Sus rondas y puntuaciones se eliminan para todos. | Seine Runden und Punkte werden für alle gelöscht. |
| This room was deleted. | Ce salon a été supprimé. | Esta sala se eliminó. | Dieser Raum wurde gelöscht. |
| Your access to this room has ended. | Votre accès à ce salon a pris fin. | Tu acceso a esta sala ha terminado. | Dein Zugriff auf diesen Raum ist beendet. |
| Up to 12 players can be online at once. | Jusqu'à 12 joueurs peuvent être en ligne en même temps. | Hasta 12 jugadores pueden estar conectados a la vez. | Bis zu 12 Spielende können gleichzeitig online sein. |
| Try again | Réessayer | Reintentar | Erneut versuchen |

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php` — Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add resources/js/components/games resources/js/pages/games/show.tsx resources/js/app.tsx lang
git commit -m "feat(games): add the game room page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 15: Team Games page, new room dialog, guest join page and team link

**Files:**
- Create: `resources/js/pages/games/index.tsx`, `resources/js/pages/games/join.tsx`, `resources/js/components/games/room-card.tsx`, `resources/js/components/games/new-room-dialog.tsx`, `resources/js/types/games.ts`
- Modify: `resources/js/types/index.ts`, `resources/js/app.tsx` (layout of `games/join`), `resources/js/pages/teams/show.tsx` ("Games" link)
- Test: create `tests/Feature/Games/GamePagesTest.php`

**Interfaces:**
- Consumes: props of `TeamGameRoomsController::index` and `GameJoinsController` (Tasks 5, 7); Wayfinder `TeamGameRoomsController`, `Games/GameRoomsController`, `GameJoinsController`.
- Produces: `GameRoomSummary` type (`@/types`), `RoomCard({room})`, `NewRoomDialog({workspaceSlug, teamId, gameOptions})`, page `games/index` (13d adds the leaderboard panel after the room list), page `games/join` (`AuthLayout`).

- [ ] **Step 1: Write the failing page test**

Create `tests/Feature/Games/GamePagesTest.php`:

```php
<?php

use App\Enums\GameKind;
use App\Models\GameRoom;
use App\Models\Team;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\FakeGameRules;

it('renders the games pages', function () {
    bindGameRules(new FakeGameRules(kind: GameKind::Hangman));
    $team = Team::factory()->create();
    $user = teamMember($team);
    $room = GameRoom::factory()->linkAccess()->create(['team_id' => $team->id]);

    $this->actingAs($user)
        ->get(route('teams.games.index', ['workspace' => $team->workspace->slug, 'team' => $team->id]))
        ->assertInertia(fn (Assert $page) => $page->component('games/index'));

    $this->actingAs($user)
        ->get(route('games.show', $room))
        ->assertInertia(fn (Assert $page) => $page->component('games/show'));

    app('auth')->forgetGuards();

    $this->get(route('games.join.show', $room->guest_token))
        ->assertInertia(fn (Assert $page) => $page->component('games/join'));
});

it('links the team page to its games', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $this->actingAs($user)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertOk();

    expect(file_get_contents(resource_path('js/pages/teams/show.tsx')))->toContain('TeamGameRoomsController.index');
});
```

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/GamePagesTest.php`
Expected: FAIL — `Inertia page component file [games/index] does not exist.`

- [ ] **Step 2: Write the types, the card and the dialog**

Create `resources/js/types/games.ts`:

```ts
import type { GameKind, GameOption, GameRoomAccess } from '@/lib/games/types';

export type GameRoomSummary = {
    id: string;
    name: string | null;
    game: GameKind;
    gameLabel: string;
    access: GameRoomAccess;
    playersCount: number;
    roundsCount: number;
    updatedAt: string | null;
};

export type { GameOption };
```

In `resources/js/types/index.ts` add `export type * from './games';`.

Create `resources/js/components/games/room-card.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import { Globe, Users } from 'lucide-react';
import GameRoomsController from '@/actions/App/Http/Controllers/Games/GameRoomsController';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import type { GameRoomSummary } from '@/types';

export function RoomCard({ room }: { room: GameRoomSummary }) {
    const { t } = useTrans();

    return (
        <Link
            href={GameRoomsController.show(room.id)}
            className="flex flex-col gap-2 rounded-lg border p-4 hover:bg-muted"
        >
            <span className="font-medium">{room.name}</span>
            <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{room.gameLabel}</Badge>
                {room.access === 'link' ? (
                    <span className="inline-flex items-center gap-1">
                        <Globe className="size-3.5" />
                        {t('Open by link')}
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5" />
                        {t('Team only')}
                    </span>
                )}
            </span>
            <span className="text-sm text-muted-foreground">
                {t(':players players · :rounds rounds', {
                    players: room.playersCount,
                    rounds: room.roundsCount,
                })}
            </span>
        </Link>
    );
}
```

Create `resources/js/components/games/new-room-dialog.tsx`:

```tsx
import { useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import TeamGameRoomsController from '@/actions/App/Http/Controllers/TeamGameRoomsController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type { GameKind, GameRoomAccess } from '@/lib/games/types';
import type { GameOption } from '@/types';

type Props = {
    workspaceSlug: string;
    teamId: string;
    gameOptions: GameOption[];
};

type RoomForm = {
    name: string;
    game: GameKind | '';
    access: GameRoomAccess;
};

export function NewRoomDialog(props: Props) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>{t('New room')}</Button>
            </DialogTrigger>
            <DialogContent aria-describedby={undefined}>
                {open && <NewRoomForm {...props} onDone={() => setOpen(false)} />}
            </DialogContent>
        </Dialog>
    );
}

function NewRoomForm({
    workspaceSlug,
    teamId,
    gameOptions,
    onDone,
}: Props & { onDone: () => void }) {
    const { t } = useTrans();
    const available = gameOptions.filter((option) => option.available);
    const form = useForm<RoomForm>({
        name: '',
        game: available[0]?.value ?? '',
        access: 'team',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        form.submit(
            TeamGameRoomsController.store({ workspace: workspaceSlug, team: teamId }),
            { onSuccess: onDone },
        );
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <DialogTitle>{t('New room')}</DialogTitle>

            <div className="grid gap-2">
                <Label htmlFor="new-room-name">{t('Name')}</Label>
                <Input
                    id="new-room-name"
                    value={form.data.name}
                    maxLength={60}
                    required
                    autoFocus
                    onChange={(event) => form.setData('name', event.target.value)}
                />
                <InputError message={form.errors.name} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="new-room-game">{t('First game')}</Label>
                <Select
                    value={form.data.game}
                    onValueChange={(value) => form.setData('game', value as GameKind)}
                >
                    <SelectTrigger id="new-room-game">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {available.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <InputError message={form.errors.game} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="new-room-access">{t('Who can join')}</Label>
                <Select
                    value={form.data.access}
                    onValueChange={(value) =>
                        form.setData('access', value as GameRoomAccess)
                    }
                >
                    <SelectTrigger id="new-room-access">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="team">{t('Team members only')}</SelectItem>
                        <SelectItem value="link">{t('Anyone with the link')}</SelectItem>
                    </SelectContent>
                </Select>
                <InputError message={form.errors.access} />
            </div>

            <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
                <Button disabled={form.processing || form.data.game === ''}>
                    {t('Create room')}
                </Button>
            </DialogFooter>
        </form>
    );
}
```

- [ ] **Step 3: Write the pages**

Create `resources/js/pages/games/index.tsx`:

```tsx
import { Head, Link } from '@inertiajs/react';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import { NewRoomDialog } from '@/components/games/new-room-dialog';
import { RoomCard } from '@/components/games/room-card';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type {
    GameOption,
    GameRoomSummary,
    TeamSummary,
    WorkspaceSummary,
} from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    rooms: GameRoomSummary[];
    gameOptions: GameOption[];
    canCreate: boolean;
    roomLimit: number;
};

export default function GamesIndex({
    workspace,
    team,
    rooms,
    gameOptions,
    canCreate,
    roomLimit,
}: Props) {
    const { t } = useTrans();

    return (
        <>
            <Head title={t('Games')} />
            <div className="max-w-4xl space-y-8 p-4">
                <Heading
                    title={t('Games')}
                    description={t('Short games to warm up :team.', {
                        team: team.name,
                    })}
                />

                <div className="flex flex-wrap items-center gap-2">
                    {canCreate && (
                        <NewRoomDialog
                            workspaceSlug={workspace.slug}
                            teamId={team.id}
                            gameOptions={gameOptions}
                        />
                    )}
                    <Button variant="outline" asChild>
                        <Link
                            href={TeamsController.show({
                                workspace: workspace.slug,
                                team: team.id,
                            })}
                        >
                            {t('Back to the team')}
                        </Link>
                    </Button>
                    {!canCreate && rooms.length >= roomLimit && (
                        <p className="text-sm text-muted-foreground">
                            {t('This team already has 10 game rooms.')}
                        </p>
                    )}
                </div>

                <section className="space-y-3">
                    <Heading variant="small" title={t('Rooms')} />
                    {rooms.length === 0 ? (
                        <p className="text-muted-foreground">
                            {t('No game rooms yet.')}
                        </p>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {rooms.map((room) => (
                                <RoomCard key={room.id} room={room} />
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </>
    );
}
```

Create `resources/js/pages/games/join.tsx`:

```tsx
import { Form, Head } from '@inertiajs/react';
import GameJoinsController from '@/actions/App/Http/Controllers/GameJoinsController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';

type Props =
    | { isInvalid: true }
    | {
          isInvalid: false;
          guestToken: string;
          roomName: string | null;
          gameLabel: string;
          suggestedName: string;
      };

export default function JoinGameRoom(props: Props) {
    const { t } = useTrans();

    if (props.isInvalid) {
        return (
            <>
                <Head title={t('Join a game')} />
                <Heading
                    title={t('Join a game')}
                    description={t('This guest link is no longer valid.')}
                />
            </>
        );
    }

    return (
        <>
            <Head title={props.roomName ?? t('Join a game')} />
            <div className="space-y-6">
                <Heading
                    title={props.roomName ?? t('Join a game')}
                    description={t('You are invited to play :game. Choose the name other players will see.', {
                        game: props.gameLabel,
                    })}
                />
                <Form
                    {...GameJoinsController.store.form(props.guestToken)}
                    className="space-y-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="name">{t('Display name')}</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    required
                                    maxLength={50}
                                    autoFocus
                                    defaultValue={props.suggestedName}
                                />
                                <InputError message={errors.name} />
                            </div>
                            <Button className="w-full" disabled={processing}>
                                {t('Join')}
                            </Button>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}
```

In `resources/js/app.tsx`, add `case name === 'games/join':` next to `case name === 'poker/join':` (the `AuthLayout` branch).

In `resources/js/pages/teams/show.tsx`, add `import TeamGameRoomsController from '@/actions/App/Http/Controllers/TeamGameRoomsController';` and, right after the "Open action items" `<Button …>` block, insert:

```tsx
                <Button variant="outline" size="sm" asChild>
                    <Link
                        href={TeamGameRoomsController.index({
                            workspace: workspace.slug,
                            team: team.id,
                        })}
                    >
                        {t('Games')}
                    </Link>
                </Button>
```

(wrap both buttons in `<div className="flex flex-wrap gap-2">…</div>` so they sit on one row).

- [ ] **Step 4: Run the tests and the frontend checks**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && vendor/bin/sail artisan test --compact tests/Feature/Games/GamePagesTest.php && npm run types:check && npx vp check --fix resources/js/pages/games resources/js/components/games resources/js/types resources/js/app.tsx resources/js/pages/teams/show.tsx && npm run check`
Expected: PASS and no new lint/type errors.

- [ ] **Step 5: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| Games | Jeux | Juegos | Spiele |
| Short games to warm up :team. | De petits jeux pour réveiller :team. | Juegos cortos para animar a :team. | Kurze Spiele zum Aufwärmen von :team. |
| Rooms | Salons | Salas | Räume |
| No game rooms yet. | Aucun salon de jeu pour l'instant. | Aún no hay salas de juego. | Noch keine Spielräume. |
| New room | Nouveau salon | Nueva sala | Neuer Raum |
| First game | Premier jeu | Primer juego | Erstes Spiel |
| Create room | Créer le salon | Crear sala | Raum erstellen |
| Open by link | Ouvert par lien | Abierta por enlace | Per Link offen |
| Team only | Équipe uniquement | Solo el equipo | Nur das Team |
| :players players · :rounds rounds | :players joueurs · :rounds manches | :players jugadores · :rounds rondas | :players Spielende · :rounds Runden |
| Join a game | Rejoindre un jeu | Unirse a un juego | Einem Spiel beitreten |
| You are invited to play :game. Choose the name other players will see. | Vous êtes invité à jouer à :game. Choisissez le nom que verront les autres joueurs. | Te invitan a jugar a :game. Elige el nombre que verán los demás. | Du bist zu :game eingeladen. Wähle den Namen, den die anderen sehen. |

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/games resources/js/components/games resources/js/types resources/js/app.tsx resources/js/pages/teams/show.tsx tests/Feature/Games/GamePagesTest.php lang
git commit -m "feat(games): add the team Games page and the guest join page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 16: Verification (controller-driven)

**Files:** none new — this task only runs checks and the walkthrough, fixing what they find (each fix in its own commit with a test).

- [ ] **Step 1: Full backend suite and static analysis**

Run:

```bash
vendor/bin/sail artisan test --compact
vendor/bin/sail bin phpstan analyse --no-progress
vendor/bin/sail bin pint --test --format agent
```

Expected: all green (the suite includes every earlier plan), phpstan 0 errors, pint clean.

- [ ] **Step 2: Frontend checks and build**

Run: `npm run types:check && npm run check && npm run build`
Expected: no new errors; the build succeeds.

- [ ] **Step 3: Spec coverage check**

For each item below, point at the passing test (file and name) and tick it:

- §2 schema and retention: `GameModelTest`, `GameRoundEngineTest` ("keeps the newest twenty ended rounds and their points").
- §2 dictionaries: `DictionaryTest` (sizes, characters, four locales).
- §3 rooms, cap of 10, settings, delete, host, guest link: `GameRoomsTest`; joining and access: `GameAccessTest`, `GameJoinTest`; 12-player cap: `GameBroadcastAuthorizationTest`.
- §4 common rules (409 on active start, switch abandons, rate limit): `GameRoundEngineTest`, `HangmanTest`.
- §4.3 Hangman: `HangmanTest`; §4.5 words: `DrawGameWordTest`; §4.6 Hangman scores: `HangmanTest`, `GameRoundEngineTest`.
- §5 timers: `GameTimerTest`.
- §8 secrecy for Hangman: `GameRedactionTest`.

- [ ] **Step 4: Two-browser walkthrough (desktop + phone, `composer run dev` with Reverb and the queue worker)**

1. As a team member, open the team page → "Games" → create a room "Lunch" (Hangman, open by link). The room opens with "Ready to play?" and a Start button.
2. Copy the guest link; in a private window open it: the join page proposes an "Adjective Animal" name in the browser's language; join.
3. Host presses Start: both browsers show the blank mask and the keyboard; the word is not visible in the page source or the network tab of either browser (search the snapshot JSON for it).
4. Pick letters in both browsers: hits and misses appear live on both, the figure grows, "X picked A" chips update; the same letter twice shows a toast.
5. Solve the word from the guest: the end card shows the word, "Solved" and the guest as winner in both browsers; the history drawer lists the round and its detail shows the full word and tried letters.
6. Host sets a 1-minute timer, starts a round, waits: the round ends as "Time's up" (with the queue worker stopped, it still ends on the next refresh).
7. Settings: rename, switch to team-only — the guest window shows "Your access to this room has ended." after the next action.
8. Open 13 browser sessions (12 team/guest sessions online, then one more): the 13th shows "This room is full." with "Try again".
9. Delete the room as its creator: the other window shows "This room was deleted."

- [ ] **Step 5: Record the outcome**

Write the results (passed steps, fixes made, anything deferred) in the ledger `.superpowers/sdd/2026-10-06-plan-13a-games-foundation/progress.md` and commit it with the fixes.
