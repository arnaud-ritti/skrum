# Plan 13d — Icebreaker, leaderboards, "Games we played" and room invites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Games leave their standalone rooms and join the rest of skrum. A retro's Icebreaker phase runs a real game hosted by the facilitator, on the board timer and the retro channel. Every room shows a scoreboard, and each team gets a members-only leaderboard with weekly streaks. A completed retro lists the "Games we played". A room manager can invite the team's Slack channel or Telegram chat to a standalone room.

**Architecture:** Plan 13a already resolves icebreaker players from retro participants (`FindGamePlayer`), names the facilitator host (`GameRoom::isHost`), guards mutations to the phase and the board lock (`GameGuard::mutable`), broadcasts on `presence-retro.{retroId}` (`GameRoom::broadcastChannel`) and reads the board timer (`GameRoom::effectiveTimerEndsAt`). This plan adds what is still missing:
- **Icebreaker room lifecycle:** `EnsureIcebreakerRoom` (on entering the phase and lazily from the board snapshot), `AbandonIcebreakerRound` (inside `ChangeRetroPhase`'s transaction), `ScheduleIcebreakerExpiry` (board timer) and the board snapshot's `icebreaker` key.
- **Game choice:** `IcebreakerGameOptions` backs `retros.icebreaker_game` in the create and settings dialogs.
- **Scores:** `RoomLeaderboard` feeds the room snapshot and the Scores tab. `DELETE /games/{room}/scores` resets a standalone room's board. `TeamGameLeaderboard` and `GameStreaks` feed the deferred `leaderboard` prop of the team Games page.
- **Results:** `BuildGamesPlayed` fills `results.games` through `PresentGameRoundHistory` and 13c's `PresentGifAnswers`.
- **Room invites:** a room is a Plan 12b `DeliverySubject`, so `POST /games/{room}/shares` reuses `QueueShare` and the delivery jobs unchanged.
- **Frontend:** the retro board relays game events from its own channel to an embedded `useGameRoom` (13a's `handleEvent` entry point) and passes the retro presence channel to the game components, so Plan 13b's stroke whispers work on the board unchanged.

**Tech Stack:** Laravel 13 (PHP 8.4), PostgreSQL, Pest, Reverb, Inertia v3 deferred props (`Inertia::defer(…, rescue: true)` with `<Deferred rescue>`), React 19, `@laravel/echo-react`, Wayfinder, Tailwind 4, lucide, Radix dialog/select (all already installed).

**Spec:** `docs/superpowers/specs/2026-09-29-games-design.md`, covering:
- §3 "Icebreaker room" and §3.1 (invites to Slack and Telegram only; spec 8's channels are not built);
- §4.7 (leaderboards, reset, team leaderboard, streaks);
- §5 icebreaker bullet (board timer);
- §6 and §6.1;
- §7 routes `DELETE scores` and `POST shares`, snapshot `leaderboard`, `scoresResetAt`, `share`, `deliveries`, and the team page `?period=`;
- §9 (team leaderboard panel, Scores tab, invite picker, "Games we played", icebreaker panel, retro game selector);
- §10 (leaderboard, invite and reset errors);
- §11 rows "Retro flow extras", "Board engagement" (whispers on the retro channel) and "Integrations (spec 6)";
- §12 groups Icebreaker, Scores (reset part), Leaderboards, Streaks, Games we played, Invites, and the manual walkthrough;
- §13 criteria 8, 12 (leaderboard part), 13, 14, 15 and 11.

It follows Plans 13a (`docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md`, "Contract for Plans 13b–13d"), 13b (`…/2026-10-06-plan-13b-games-draw-and-decoded.md`, "Contract for Plans 13c and 13d") and 13c (`…/2026-10-06-plan-13c-games-sprint-gif.md`, "Contract for Plan 13d"). Invites build on Plan 12b (`docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md`, "Contract for Plan 13d"). Parent: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md`.

## Global Constraints

- Work on branch `feat/plan-13-games`, continuing after Plans 13a, 13b and 13c (all implemented and committed on it; the branch was created from the tip of `feat/plan-12-integrations`, so Plans 12a–12d are there too). This is the last plan of spec 7.
- Shells: prefix commands with `export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH";`. Commands through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse --no-progress` (level 7, 0 errors). npm on the host.
- Tests run on PostgreSQL (the Sail `testing` database). **This plan adds no migration**: every column it uses exists since Plan 13a Task 1 (`game_rooms.scores_reset_at`, `game_points.*`, `retros.icebreaker_game`) and Plan 12a Task 3 (`integration_deliveries.*`). If one turns out to be needed, its filename uses the prefix `2026_10_06_1003xx`, with an `up()` method only.
- No new Composer or npm dependency.
- **Request fields are snake_case** (`icebreaker_game`, `channel`, `include_guest_link`, `period` query string); response, snapshot and broadcast payloads are camelCase exactly as below. JSON responses are bare payloads, as in Plan 13a.
- Every mutation: resolve the player/participant (middleware) → cheap guards → `DB::transaction` with the rows locked (retro → game room → round, never the other way round) → the same guards again on the locked rows → persist → broadcast with `->sendToOthers()` (after commit, `toOthers()`, report-don't-throw).
- **Secrecy (spec §8) is unchanged:** `results.games` reads ended rounds only, through `PresentGameRoundHistory` and `PresentGifAnswers`; it never carries a guess text; GIF answers have `playerId: null` on anonymous retros. Leaderboards and invites never contain a word, question, drawing, GIF or guess. The team leaderboard is built only for authenticated team viewers.
- **Invites send nothing but** the room name, the game label, the team name, the sharer's name and a URL (`/games/{room}`, or `/play/{guestToken}` only when the sharer ticked the option on a `link` room).
- Guests never receive team or workspace data: `room.teamName` is `null` for guests; `share` is all-false and `deliveries` is `[]` for them.
- Every user-facing string via `t()` / `__()` (single-quoted PHP keys) with real translations in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"), appended at the end of each file, keeping every existing value. Each task lists its rows; add only keys that are missing at execution time. Provider names are never translated. `tests/Feature/TranslationKeysTest.php` stays green.
- Wayfinder: run `vendor/bin/sail artisan wayfinder:generate --with-form` after every route change. `resources/js/actions` and `resources/js/routes` are gitignored — never stage them. Frontend imports use the generated controllers, never hard-coded URLs.
- Frontend checks: `npm run types:check && npm run check` (known pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`). Format only touched files with `npx vp check --fix <paths>`.
- React: function components, `type Props`, no default exports except pages, Tailwind, lucide icons, `useRoom()` for game state, `useBoard()` for retro state, `retroRequest()` from `@/lib/retro/api` for JSON calls, `ctx.run()` around mutations (toast + refetch on failure), `usePage().props.locale` for `Intl` formatting.
- PHP: constructor promotion, typed everything, array-shape docblocks on presenter return values, early returns, curly braces, no comments restating code, class constants in PascalCase. Pest helpers are global: every new helper name below is unique in `tests/`.
- Never run two implementer subagents concurrently (shared git index).
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`

## Spec amendments made with this plan

Writing this plan found these gaps in spec 7. They are decisions of this plan, to be copied into the spec (§3.1, §6, §6.1, §7, §10) before execution:

1. **"Not connected" answers 409, not 422.** A room invite to a team without an `Active` integration of that provider gets 409 "Connect :provider in the team settings.". A connection that needs reconnecting gets 409 "Reconnect :provider in the team settings.". This is exactly what Plan 12b's `QueueShare` throws for retro and poker shares (spec 6 §13), so the three share endpoints answer alike. Spec 7 §3.1 and §10 said 422 "This team is not connected to :provider.".
2. **`results.games.roomId`.** The "Replay" link of a Draw & Guess round calls `GET /games/{room}/rounds/{round}`, so the client needs the icebreaker room id: `results.games` is `{roomId, rounds, leaderboard, roundsPlayed}`.
3. **`room.teamName`** (`null` for guests) in the game snapshot. The invite dialog shows "Only members of :team can join." for `team` rooms.
4. **Board snapshot keys:** `retro.icebreakerGame` (the game the icebreaker room starts with), `icebreakerGames: [{value, label, available}]` (the create/settings selector; `gif` is available only with a GIF provider) and `icebreaker: GameSnapshot | null`.
5. **Changing `icebreaker_game` after the room exists does not switch the room's game.** The setting is "the game the icebreaker room starts with" (§2). Once the room exists, the facilitator switches the game from the panel's game switcher.
6. **The icebreaker room is created with a player for the facilitator**, so every viewer's snapshot names the host (`room.hostPlayerId`) from the first load.
7. **The board timer is stored in whole seconds** (`RetroTimersController` now uses `->startOfSecond()`, as Plan 13a's room timer does). `CloseExpiredGameRound` compares the stored end time with the one it was scheduled for; a PostgreSQL `timestamp(0)` column would otherwise round the fraction and make the job a no-op.
8. **Room leaderboard after a reset** counts points awarded strictly after `scores_reset_at` (`created_at > scores_reset_at`).
9. **Team leaderboard period "Last 30 days"** = points with `created_at >= now() − 30 days`. Streaks use ISO weeks (Monday start) of `created_at` read in UTC (`APP_TIMEZONE` defaults to `UTC`; spec §4.7).

## Review Focus

1. **The retro leaves the Icebreaker phase in the middle of a round**, e.g. a Hangman word half guessed or a GIF round in its voting window. Expected: the round ends as `Abandoned` inside the phase change, writes no `game_points` row and discards the GIF votes; `game.round.ended` goes out on the retro channel. Coming back to the phase shows the same room with no active round and the abandoned round in the history, but not in "Games we played". Pinned in Task 1 ("abandons the active round when the retro leaves the icebreaker", "resumes the same room without a round when the retro comes back").
2. **The board timer changes while an icebreaker round runs.** It is set, changed, cleared, or had run out before the round started. Expected: a newly set timer schedules `CloseExpiredGameRound` for the active round. A job for an older end time is a no-op. A timer that ran out before the round started never ends it (13a's expiry anchor). Pinned in Task 1 ("schedules the round expiry when the facilitator sets the board timer", "ends the icebreaker round lazily when the board timer runs out", "ignores a board timer that ran out before the round started").
3. **Two browsers load the board at the moment the retro enters the Icebreaker phase.** Expected: exactly one icebreaker room exists (unique `retro_id` + `createOrFirst`), and both snapshots show the same room id. Pinned in Task 1 ("creates the room lazily from the board snapshot, once").
4. **Team leaderboard membership edges:** a member removed from the team, a deleted user, a workspace Admin who is not a team member, a guest, and a point 31 days old vs 29 days old. Expected: only current members appear, guests never do, and the 30-day period drops the old point while "All time" keeps it. Pinned in Task 4 ("lists current members only", "honours the period").
5. **An invite with the guest link on a `team` room, or a link room invite by a player who is not a manager.** The host could also have switched the room to team-only after opening the dialog. Expected: 422 "Guest access is off for this room." / 403, and nothing is queued; a `team` room invite always carries `/games/{room}`. Pinned in Task 6 ("refuses the guest link on a team room", "refuses players who do not manage the room and guests").

## File map

Files shared with earlier plans are marked ⚑. Each instruction below says where to insert so their additions are kept.

| Area | Files |
|---|---|
| Icebreaker lifecycle | `app/Actions/Games/{EnsureIcebreakerRoom,AbandonIcebreakerRound,ScheduleIcebreakerExpiry,IcebreakerGameOptions}.php`; `app/Actions/Retros/ChangeRetroPhase.php`; ⚑ `app/Actions/Retros/BuildBoardSnapshot.php` (12b added `integrations`, `linkDeliveries`); `app/Http/Controllers/Retros/RetroTimersController.php` |
| Retro game setting | `app/Actions/Retros/{NewRetro,CreateRetro}.php`; `app/Http/Controllers/TeamRetrosController.php`; `app/Http/Controllers/Retros/RetroSettingsController.php`; ⚑ `app/Http/Controllers/TeamsController.php` |
| Room leaderboard | `app/Actions/Games/RoomLeaderboard.php`; `app/Http/Controllers/Games/GameScoresController.php`; ⚑ `app/Actions/Games/BuildGameSnapshot.php` (13b added `emojiData`); ⚑ `routes/web.php` |
| Team leaderboard | `app/Actions/Games/{TeamGameLeaderboard,GameStreaks}.php`; `app/Http/Controllers/TeamGameRoomsController.php` |
| Games we played | `app/Actions/Games/BuildGamesPlayed.php`; ⚑ `app/Actions/Retros/BuildResults.php` (12b added `deliveries`, `emailRecipients`) |
| Invites | ⚑ `app/Models/GameRoom.php`; ⚑ `app/Actions/Integrations/BuildLinkShare.php`; `app/Actions/Games/GameRoomShares.php`; `app/Http/Controllers/Games/GameSharesController.php` |
| Frontend state | ⚑ `resources/js/lib/games/{types,room-reducer}.ts`; `resources/js/lib/games/leaderboard.ts`; ⚑ `resources/js/types/games.ts`; ⚑ `resources/js/lib/retro/types.ts`; ⚑ `resources/js/hooks/{use-retro-channel,use-retro-board}.ts`; ⚑ `resources/js/components/retro/board-context.tsx` (13b added `useOptionalBoard`) |
| Frontend icebreaker | `resources/js/components/retro/{icebreaker-stage,icebreaker-game,icebreaker-game-select}.tsx`; ⚑ `resources/js/components/retro/{board,phase-panel,settings-dialog}.tsx`; delete `resources/js/components/retro/icebreaker-panel.tsx`; ⚑ `resources/js/components/teams/new-retro-dialog.tsx`; ⚑ `resources/js/pages/teams/show.tsx` |
| Frontend scores | `resources/js/components/games/{room-sidebar,room-scores,reset-scores-dialog,round-points,team-leaderboard}.tsx`; ⚑ `resources/js/components/games/{game-panel,round-end-card}.tsx`; ⚑ `resources/js/pages/games/index.tsx` |
| Frontend results | `resources/js/components/retro/results/{games-played-section,games-played-round,games-played-podium,round-replay-dialog}.tsx`; `resources/js/components/retro/results/results-view.tsx` |
| Frontend invites | `resources/js/components/games/{room-invite-button,room-invite-dialog}.tsx`; ⚑ `resources/js/components/games/room-header.tsx` |
| Tests | `tests/Feature/Games/{IcebreakerRoomTest,IcebreakerGameSettingTest,RoomLeaderboardTest,TeamGameLeaderboardTest,GamesPlayedTest,GameRoomSharesTest}.php` |
| Translations | ⚑ `lang/{en,fr,es,de}.json` (rows inside each task) |

---

### Task 1: Icebreaker room lifecycle (`EnsureIcebreakerRoom`, abandon on leave, board timer, board snapshot)

**Files:**
- Create: `app/Actions/Games/EnsureIcebreakerRoom.php`, `app/Actions/Games/AbandonIcebreakerRound.php`, `app/Actions/Games/ScheduleIcebreakerExpiry.php`, `app/Actions/Games/IcebreakerGameOptions.php`
- Modify: `app/Actions/Retros/ChangeRetroPhase.php`, ⚑ `app/Actions/Retros/BuildBoardSnapshot.php`, `app/Http/Controllers/Retros/RetroTimersController.php`
- Test: create `tests/Feature/Games/IcebreakerRoomTest.php`

**Interfaces:**
- Consumes (13a): `GameRoom` (`isIcebreaker`, `activeRound`, `isHost`, `effectiveTimerEndsAt`, `KeptRounds`), `GamePlayer`, `EndGameRound::handle(GameRoom $room, GameRound $round, GameRoundOutcome $outcome, ?GamePlayer $winner = null): ?array`, `ExpireGameRound::handle(GameRoom $room): void`, `ScheduleRoundExpiry::handle(GameRoom $room, GameRound $round): void`, `BuildGameSnapshot::handle(GameRoom $room, GamePlayer $viewer): array`, `GameRulesRegistry::find(GameKind): ?GameRules`, factory states `GameRoom::factory()->icebreaker(Retro)`, `GamePlayer::factory()->forParticipant(Participant)`, helper `activeGameRound(GameRoom, array)`; `GifCatalog::isAvailable()`; existing helpers `retroFacilitator`, `retroMember`, `retroGuestCookie`.
- Produces:
  - `App\Actions\Games\EnsureIcebreakerRoom::handle(Retro $retro): GameRoom`. It returns the retro's room, creating it once with `game = retros.icebreaker_game`, `locale` = the facilitator's locale (else the app locale), `access = team` and a player for the facilitator participant. The returned room has its `retro` relation set to `$retro`.
  - `App\Actions\Games\AbandonIcebreakerRound::handle(Retro $lockedRetro): void` locks the room, then its current round, and ends an active round as `Abandoned`. The caller holds the retro lock.
  - `App\Actions\Games\ScheduleIcebreakerExpiry::handle(Retro $lockedRetro): void` schedules `CloseExpiredGameRound` for the active icebreaker round, only while the retro is in `Icebreaker`.
  - `App\Actions\Games\IcebreakerGameOptions` provides:
    - `allows(GameKind $game): bool` (rules registered, and `gif` only with a GIF provider);
    - `options(): array<int, array{value: string, label: string, available: bool}>`;
    - `rule(): Closure` (validation closure failing with "This game is not available.").
  - The board snapshot gains `retro.icebreakerGame: string`, `icebreakerGames: array<int, array{value, label, available}>` and `icebreaker: ?array` (the viewer's `GameSnapshot` while the retro is in `Icebreaker`, else `null`).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Games/IcebreakerRoomTest.php`:

```php
<?php

use App\Actions\Games\EnsureIcebreakerRoom;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Events\Games\GameRoundEnded;
use App\Events\Games\GameRoundStarted;
use App\Jobs\CloseExpiredGameRound;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Participant;
use App\Models\Retro;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;

/**
 * @return array{0: Retro, 1: \App\Models\User, 2: GameRoom}
 */
function hangmanIcebreaker(array $attributes = []): array
{
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->create([
        'icebreaker_game' => GameKind::Hangman,
        ...$attributes,
    ]);
    [$facilitator] = retroFacilitator($retro);

    return [$retro, $facilitator, app(EnsureIcebreakerRoom::class)->handle($retro->fresh())];
}

it('creates the icebreaker room when the retro enters the phase', function () {
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Writing)->create(['icebreaker_game' => GameKind::Hangman]);
    [$facilitator, $participant] = retroFacilitator($retro);
    $facilitator->forceFill(['locale' => 'fr'])->save();

    $this->actingAs($facilitator)
        ->putJson(route('retros.phase.update', $retro), ['phase' => 'icebreaker'])
        ->assertOk();

    $room = GameRoom::query()->where('retro_id', $retro->id)->sole();

    expect($room->game)->toBe(GameKind::Hangman)
        ->and($room->locale)->toBe('fr')
        ->and($room->team_id)->toBe($retro->team_id)
        ->and($room->name)->toBeNull()
        ->and($room->players()->where('participant_id', $participant->id)->exists())->toBeTrue();
});

it('creates the room lazily from the board snapshot, once', function () {
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->create();
    [$facilitator] = retroFacilitator($retro);
    [$member] = retroMember($retro);

    $memberSnapshot = $this->actingAs($member)->getJson(route('retros.snapshot.show', $retro))->assertOk()->json();
    $facilitatorSnapshot = $this->actingAs($facilitator)->getJson(route('retros.snapshot.show', $retro))->assertOk()->json();

    expect(GameRoom::query()->where('retro_id', $retro->id)->count())->toBe(1)
        ->and($memberSnapshot['icebreaker']['room']['id'])->toBe($facilitatorSnapshot['icebreaker']['room']['id'])
        ->and($memberSnapshot['icebreaker']['room']['isIcebreaker'])->toBeTrue()
        ->and($memberSnapshot['icebreaker']['room']['isHost'])->toBeFalse()
        ->and($memberSnapshot['icebreaker']['room']['hostPlayerId'])->not->toBeNull()
        ->and($facilitatorSnapshot['icebreaker']['room']['isHost'])->toBeTrue()
        ->and($memberSnapshot['retro']['icebreakerGame'])->toBe('draw')
        ->and(collect($memberSnapshot['icebreakerGames'])->pluck('value')->all())->toBe(['draw', 'gif', 'hangman', 'decoded']);
});

it('sends no icebreaker outside the phase and never deletes the room', function () {
    [$retro, $facilitator, $room] = hangmanIcebreaker();
    $retro->update(['phase' => RetroPhase::Writing]);

    $this->actingAs($facilitator)
        ->patchJson(route('retros.settings.update', $retro), ['icebreaker_enabled' => false])
        ->assertNoContent();

    $this->actingAs($facilitator)
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertJsonPath('icebreaker', null);

    expect($room->fresh())->not->toBeNull();
});

it('lets guests of the retro play the icebreaker', function () {
    [$retro, , $room] = hangmanIcebreaker(['guest_access_enabled' => true]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertOk()
        ->assertJsonPath('icebreaker.room.id', $room->id)
        ->assertJsonPath('icebreaker.me.isGuest', true);

    expect(GamePlayer::query()->where('game_room_id', $room->id)->where('participant_id', $guest->id)->exists())->toBeTrue();
});

it('makes the current facilitator the host', function () {
    [$retro, $facilitator, $room] = hangmanIcebreaker();
    [$member, $memberParticipant] = retroMember($retro);

    $retro->forceFill(['facilitator_participant_id' => $memberParticipant->id])->save();

    $this->actingAs($member)
        ->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('room.isHost', true);
    $this->actingAs($facilitator)
        ->postJson(route('games.rounds.store', $room))
        ->assertForbidden();
    $this->actingAs($member)
        ->postJson(route('games.rounds.store', $room))
        ->assertCreated();
});

it('broadcasts icebreaker rounds on the retro channel', function () {
    Event::fake([GameRoundStarted::class]);
    [$retro, $facilitator, $room] = hangmanIcebreaker();

    $this->actingAs($facilitator)->postJson(route('games.rounds.store', $room))->assertCreated();

    Event::assertDispatched(GameRoundStarted::class, fn (GameRoundStarted $event) => $event->broadcastOn()->name === "presence-retro.{$retro->id}");
});

it('refuses game mutations on a completed retro and keeps the history readable', function () {
    [$retro, $facilitator, $room] = hangmanIcebreaker();
    GameRound::factory()->ended(GameRoundOutcome::Solved)->create(['game_room_id' => $room->id]);
    $retro->update(['phase' => RetroPhase::Completed]);

    $this->actingAs($facilitator)
        ->postJson(route('games.rounds.store', $room))
        ->assertForbidden()
        ->assertJsonPath('message', 'The game can only be played during the icebreaker.');
    $this->actingAs($facilitator)
        ->getJson(route('games.rounds.index', $room))
        ->assertOk()
        ->assertJsonCount(1);
});

it('abandons the active round when the retro leaves the icebreaker', function () {
    Event::fake([GameRoundEnded::class]);
    [$retro, $facilitator, $room] = hangmanIcebreaker();
    $player = $room->players()->sole();
    $round = activeGameRound($room, [
        'picked_letters' => ['s'],
        'picked_by' => [$player->id],
        'revealed_positions' => [0],
    ]);

    $this->actingAs($facilitator)
        ->putJson(route('retros.phase.update', $retro), ['phase' => 'writing'])
        ->assertOk();

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Abandoned)
        ->and($round->fresh()->ended_at)->not->toBeNull()
        ->and(GamePoint::query()->count())->toBe(0);

    Event::assertDispatched(GameRoundEnded::class, fn (GameRoundEnded $event) => $event->payload['outcome'] === 'abandoned'
        && $event->broadcastOn()->name === "presence-retro.{$retro->id}");
});

it('resumes the same room without a round when the retro comes back', function () {
    [$retro, $facilitator, $room] = hangmanIcebreaker();
    activeGameRound($room);

    $this->actingAs($facilitator)->putJson(route('retros.phase.update', $retro), ['phase' => 'writing'])->assertOk();
    $this->actingAs($facilitator)->putJson(route('retros.phase.update', $retro), ['phase' => 'icebreaker'])->assertOk();

    $this->actingAs($facilitator)
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertJsonPath('icebreaker.room.id', $room->id)
        ->assertJsonPath('icebreaker.round', null)
        ->assertJsonPath('icebreaker.history.0.outcome', 'abandoned');
});

it('schedules the round expiry when the facilitator sets the board timer', function () {
    Queue::fake();
    [$retro, $facilitator, $room] = hangmanIcebreaker();
    $round = activeGameRound($room);

    $this->actingAs($facilitator)
        ->putJson(route('retros.timer.update', $retro), ['seconds' => 60])
        ->assertOk();

    $endsAt = $retro->fresh()->timer_ends_at;

    expect($endsAt->micro)->toBe(0);
    Queue::assertPushed(CloseExpiredGameRound::class, fn (CloseExpiredGameRound $job) => $job->roundId === $round->id
        && CarbonImmutable::parse($job->timerEndsAt)->equalTo($endsAt));
});

it('schedules nothing outside the icebreaker', function () {
    Queue::fake();
    [$retro, $facilitator, $room] = hangmanIcebreaker();
    activeGameRound($room);
    $retro->update(['phase' => RetroPhase::Writing]);

    $this->actingAs($facilitator)->putJson(route('retros.timer.update', $retro), ['seconds' => 60])->assertOk();

    Queue::assertNotPushed(CloseExpiredGameRound::class);
});

it('ends the icebreaker round lazily when the board timer runs out', function () {
    [$retro, $facilitator, $room] = hangmanIcebreaker();
    $round = activeGameRound($room, ['started_at' => now()->startOfSecond()]);
    $retro->update(['timer_ends_at' => now()->addMinute()->startOfSecond()]);

    $this->travel(2)->minutes();

    $this->actingAs($facilitator)
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertJsonPath('icebreaker.round', null);

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::TimedOut);
});

it('ignores a board timer that ran out before the round started', function () {
    [$retro, $facilitator, $room] = hangmanIcebreaker(['timer_ends_at' => now()->subMinute()->startOfSecond()]);
    $round = activeGameRound($room, ['started_at' => now()->startOfSecond()]);

    $this->actingAs($facilitator)
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertJsonPath('icebreaker.round.id', $round->id);

    expect($round->fresh()->isActive())->toBeTrue();
});

it('deletes the icebreaker room and its points with the retro', function () {
    [$retro, , $room] = hangmanIcebreaker();
    $player = $room->players()->sole();
    GamePoint::factory()->create(['team_id' => $room->team_id, 'game_room_id' => $room->id, 'player_id' => $player->id, 'points' => 4]);

    $retro->delete();

    expect(GameRoom::query()->whereKey($room->id)->exists())->toBeFalse()
        ->and(GamePoint::query()->count())->toBe(0);
});

it('offers the GIF game only with a GIF provider', function () {
    config(['services.gifs.key' => null]);
    [$retro, $facilitator] = hangmanIcebreaker();

    $this->actingAs($facilitator)
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertJsonPath('icebreakerGames.1', ['value' => 'gif', 'label' => 'Sprint in one GIF', 'available' => false])
        ->assertJsonPath('icebreakerGames.2.available', true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/IcebreakerRoomTest.php`
Expected: FAIL — `Class "App\Actions\Games\EnsureIcebreakerRoom" not found`.

- [ ] **Step 3: Write the actions**

Create `app/Actions/Games/EnsureIcebreakerRoom.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameRoomAccess;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Retro;
use Illuminate\Support\Str;

/**
 * One room per retro, created the first time the retro enters its
 * Icebreaker phase (or the first time a board snapshot needs it). The
 * unique retro_id and createOrFirst make concurrent first loads agree.
 */
class EnsureIcebreakerRoom
{
    public function handle(Retro $retro): GameRoom
    {
        $room = GameRoom::query()->where('retro_id', $retro->id)->first()
            ?? GameRoom::query()->createOrFirst(['retro_id' => $retro->id], [
                'team_id' => $retro->team_id,
                'game' => $retro->icebreaker_game,
                'locale' => $this->facilitatorLocale($retro),
                'access' => GameRoomAccess::Team,
                'guest_token' => Str::random(40),
            ]);

        $room->setRelation('retro', $retro);

        $this->ensureFacilitatorPlayer($room, $retro);

        return $room;
    }

    private function facilitatorLocale(Retro $retro): string
    {
        $locale = $retro->facilitator?->user?->preferredLocale();

        if (is_string($locale) && in_array($locale, (array) config('skrum.locales'), true)) {
            return $locale;
        }

        return app()->getLocale();
    }

    /**
     * Every viewer's snapshot names the host from the first load.
     */
    private function ensureFacilitatorPlayer(GameRoom $room, Retro $retro): void
    {
        if ($retro->facilitator_participant_id === null) {
            return;
        }

        GamePlayer::query()->firstOrCreate([
            'game_room_id' => $room->id,
            'participant_id' => $retro->facilitator_participant_id,
        ]);
    }
}
```

Create `app/Actions/Games/AbandonIcebreakerRound.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameRoundOutcome;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;

/**
 * Leaving the Icebreaker phase ends the active round without points
 * (spec §6). Runs inside the phase change transaction, retro locked; the
 * room and round are locked after it, never before.
 */
class AbandonIcebreakerRound
{
    public function __construct(private EndGameRound $endGameRound) {}

    public function handle(Retro $lockedRetro): void
    {
        $room = GameRoom::query()->where('retro_id', $lockedRetro->id)->lockForUpdate()->first();

        if ($room === null || $room->current_round_id === null) {
            return;
        }

        $round = GameRound::query()->whereKey($room->current_round_id)->lockForUpdate()->first();

        if ($round === null || ! $round->isActive()) {
            return;
        }

        $room->setRelation('retro', $lockedRetro);

        $this->endGameRound->handle($room, $round, GameRoundOutcome::Abandoned);
    }
}
```

Create `app/Actions/Games/ScheduleIcebreakerExpiry.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\RetroPhase;
use App\Models\GameRoom;
use App\Models\Retro;

/**
 * The board timer is the icebreaker's game timer (spec §5): a new end time
 * schedules the expiry job of the active round, as the room timer does.
 */
class ScheduleIcebreakerExpiry
{
    public function __construct(private ScheduleRoundExpiry $scheduleRoundExpiry) {}

    public function handle(Retro $lockedRetro): void
    {
        if ($lockedRetro->phase !== RetroPhase::Icebreaker) {
            return;
        }

        $room = GameRoom::query()->where('retro_id', $lockedRetro->id)->first();

        if ($room === null) {
            return;
        }

        $room->setRelation('retro', $lockedRetro);

        $round = $room->activeRound();

        if ($round === null) {
            return;
        }

        $this->scheduleRoundExpiry->handle($room, $round);
    }
}
```

Create `app/Actions/Games/IcebreakerGameOptions.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Support\Games\GameRulesRegistry;
use App\Support\Gifs\GifCatalog;
use Closure;

/**
 * The games a retro may start its icebreaker with (spec §2): every game
 * with rules, "Sprint in one GIF" only when a GIF provider is configured.
 * Whether the retro allows GIFs is checked when a round starts.
 */
class IcebreakerGameOptions
{
    public function __construct(
        private GameRulesRegistry $gameRulesRegistry,
        private GifCatalog $gifCatalog,
    ) {}

    public function allows(GameKind $game): bool
    {
        if ($this->gameRulesRegistry->find($game) === null) {
            return false;
        }

        return $game !== GameKind::SprintGif || $this->gifCatalog->isAvailable();
    }

    /**
     * @return array<int, array{value: string, label: string, available: bool}>
     */
    public function options(): array
    {
        return array_map(fn (GameKind $game): array => [
            'value' => $game->value,
            'label' => $game->label(),
            'available' => $this->allows($game),
        ], GameKind::cases());
    }

    public function rule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            $game = is_string($value) ? GameKind::tryFrom($value) : null;

            if ($game === null || $this->allows($game)) {
                return;
            }

            $fail(__('This game is not available.'));
        };
    }
}
```

- [ ] **Step 4: Wire the phase change**

In `app/Actions/Retros/ChangeRetroPhase.php`:

1. Add the imports `use App\Actions\Games\AbandonIcebreakerRound;` and `use App\Actions\Games\EnsureIcebreakerRoom;`.
2. Add two constructor parameters after `private ClearRetroInsights $clearRetroInsights,`:

```php
        private AbandonIcebreakerRound $abandonIcebreakerRound,
        private EnsureIcebreakerRoom $ensureIcebreakerRoom,
```

3. Replace the body of `handle()` with:

```php
        $this->ensureReachable($locked, $phase);
        $this->abandonSummary($locked, $phase);
        $this->leaveIcebreaker($locked, $phase);
        $this->move($locked, $phase);
        $this->enterIcebreaker($locked, $phase);
        $this->closeSurveys($locked, $phase);
        $this->broadcast($locked, $phase);
        $this->announceCompletion($locked, $phase);
        $this->queueSummary($locked, $phase);
```

4. Add after `abandonSummary()`:

```php
    /**
     * Read before the move: the phase being left is still on the row.
     */
    private function leaveIcebreaker(Retro $locked, RetroPhase $phase): void
    {
        if ($locked->phase !== RetroPhase::Icebreaker) {
            return;
        }

        if ($phase === RetroPhase::Icebreaker) {
            return;
        }

        $this->abandonIcebreakerRound->handle($locked);
    }

    private function enterIcebreaker(Retro $locked, RetroPhase $phase): void
    {
        if ($phase !== RetroPhase::Icebreaker) {
            return;
        }

        $this->ensureIcebreakerRoom->handle($locked);
    }
```

- [ ] **Step 5: Wire the board timer**

In `app/Http/Controllers/Retros/RetroTimersController.php`:

1. Add `use App\Actions\Games\ScheduleIcebreakerExpiry;`.
2. Change the signature to `public function update(Request $request, Retro $retro, ScheduleIcebreakerExpiry $scheduleIcebreakerExpiry): JsonResponse`.
3. Replace the `$endsAt` line with:

```php
        // Whole seconds: a game expiry job compares its end time with the stored one.
        $endsAt = $validated['seconds'] === null
            ? null
            : now()->addSeconds((int) $validated['seconds'])->startOfSecond();
```

4. Change the closure to `function () use ($retro, $participant, $endsAt, $scheduleIcebreakerExpiry): void` and add as its last statement, after the `TimerChanged` broadcast:

```php
            $scheduleIcebreakerExpiry->handle($locked);
```

- [ ] **Step 6: Add the board snapshot keys**

In ⚑ `app/Actions/Retros/BuildBoardSnapshot.php`:

1. Add the imports `use App\Actions\Games\BuildGameSnapshot;`, `use App\Actions\Games\EnsureIcebreakerRoom;`, `use App\Actions\Games\ExpireGameRound;`, `use App\Actions\Games\IcebreakerGameOptions;`, `use App\Models\GamePlayer;`.
2. Add these constructor parameters after the last existing one (Plan 12b's additions stay where they are):

```php
        private EnsureIcebreakerRoom $ensureIcebreakerRoom,
        private ExpireGameRound $expireGameRound,
        private BuildGameSnapshot $buildGameSnapshot,
        private IcebreakerGameOptions $icebreakerGameOptions,
```

3. In the `'retro' => [...]` array, after `'icebreakerEnabled' => $retro->icebreaker_enabled,`, add:

```php
                'icebreakerGame' => $retro->icebreaker_game->value,
```

4. After the `'healthCheck' => …,` entry (and after any key Plan 12b added next to it), add:

```php
            'icebreaker' => $this->icebreaker($retro, $viewer),
            'icebreakerGames' => $this->icebreakerGameOptions->options(),
```

5. Add the private method after `roti()`:

```php
    /**
     * The game panel of the Icebreaker phase, as this participant sees it.
     * The room is created on first need and its expired round closed first,
     * so a late queue never shows a stale round (spec §5).
     *
     * @return array<string, mixed>|null
     */
    private function icebreaker(Retro $retro, Participant $viewer): ?array
    {
        if ($retro->phase !== RetroPhase::Icebreaker) {
            return null;
        }

        $room = $this->ensureIcebreakerRoom->handle($retro);

        $this->expireGameRound->handle($room);

        $player = GamePlayer::query()->firstOrCreate([
            'game_room_id' => $room->id,
            'participant_id' => $viewer->id,
        ]);

        return $this->buildGameSnapshot->handle($room, $player);
    }
```

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/IcebreakerRoomTest.php tests/Feature/Retros/BoardSnapshotTest.php tests/Feature/Retros/FacilitationTest.php tests/Feature/Games/GameTimerTest.php`
Expected: PASS.

If "offers the GIF game only with a GIF provider" fails because the testing environment configures a GIF key, keep the `config(['services.gifs.key' => null])` line first in the test (it already is) and check `config/services.php` reads `services.gifs.key` (it does, `SKRUM_GIF_API_KEY`).

- [ ] **Step 8: Translations**

No new key: "This game is not available." and "The game can only be played during the icebreaker." exist since Plan 13a.

- [ ] **Step 9: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Games/EnsureIcebreakerRoom.php app/Actions/Games/AbandonIcebreakerRound.php app/Actions/Games/ScheduleIcebreakerExpiry.php app/Actions/Games/IcebreakerGameOptions.php app/Actions/Retros/ChangeRetroPhase.php app/Actions/Retros/BuildBoardSnapshot.php app/Http/Controllers/Retros/RetroTimersController.php tests/Feature/Games/IcebreakerRoomTest.php
git commit -m "feat(games): run the icebreaker game inside the retro

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 2: The retro's icebreaker game (create dialog, settings, team page options)

**Files:**
- Modify: `app/Actions/Retros/NewRetro.php`, `app/Actions/Retros/CreateRetro.php`, `app/Http/Controllers/TeamRetrosController.php`, `app/Http/Controllers/Retros/RetroSettingsController.php`, ⚑ `app/Http/Controllers/TeamsController.php`
- Test: create `tests/Feature/Games/IcebreakerGameSettingTest.php`

**Interfaces:**
- Consumes: Task 1 `IcebreakerGameOptions::{rule(), options()}`; `RetroSettingsChanged`; `teamMember`, `retroFacilitator`, `retroMember`.
- Produces:
  - `NewRetro` gains a last parameter `public ?GameKind $icebreakerGame = null`.
  - `POST /w/{workspace}/teams/{team}/retros` accepts `icebreaker_game` (optional, `GameKind`, available per `IcebreakerGameOptions`; default `draw`).
  - `PATCH /retros/{retro}/settings` accepts `icebreaker_game`. It is facilitator only, refused on `Completed` (403, the existing `RetroGuard::open` of open-phase settings) and broadcasts `settings.changed`.
  - `teams/show` gains the prop `icebreakerGames` (`IcebreakerGameOptions::options()`).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Games/IcebreakerGameSettingTest.php`:

```php
<?php

use App\Enums\GameKind;
use App\Enums\RetroPhase;
use App\Events\Retros\RetroSettingsChanged;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;

function createRetroWithIcebreakerGame(Team $team, array $fields): Illuminate\Testing\TestResponse
{
    return test()->actingAs(teamMember($team))->post(route('teams.retros.store', ['workspace' => $team->workspace->slug, 'team' => $team->id]), [
        'title' => 'Sprint 42',
        'template' => 'start_stop_continue',
        'icebreaker_enabled' => true,
        ...$fields,
    ]);
}

it('stores the icebreaker game chosen at creation', function () {
    $team = Team::factory()->create();

    createRetroWithIcebreakerGame($team, ['icebreaker_game' => 'hangman'])->assertRedirect();

    expect(Retro::query()->sole()->icebreaker_game)->toBe(GameKind::Hangman);
});

it('starts with Draw & Guess by default', function () {
    $team = Team::factory()->create();

    createRetroWithIcebreakerGame($team, [])->assertRedirect();

    expect(Retro::query()->sole()->icebreaker_game)->toBe(GameKind::DrawAndGuess);
});

it('refuses the GIF game at creation without a GIF provider', function () {
    config(['services.gifs.key' => null]);
    $team = Team::factory()->create();

    createRetroWithIcebreakerGame($team, ['icebreaker_game' => 'gif'])
        ->assertSessionHasErrors(['icebreaker_game' => 'This game is not available.']);

    expect(Retro::query()->count())->toBe(0);
});

it('accepts the GIF game with a GIF provider', function () {
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'gif-key', 'rating' => 'pg']]);
    $team = Team::factory()->create();

    createRetroWithIcebreakerGame($team, ['icebreaker_game' => 'gif'])->assertRedirect();

    expect(Retro::query()->sole()->icebreaker_game)->toBe(GameKind::SprintGif);
});

it('lets the facilitator change the icebreaker game', function () {
    Event::fake([RetroSettingsChanged::class]);
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Writing)->create();
    [$facilitator] = retroFacilitator($retro);

    $this->actingAs($facilitator)
        ->patchJson(route('retros.settings.update', $retro), ['icebreaker_game' => 'decoded'])
        ->assertNoContent();

    expect($retro->fresh()->icebreaker_game)->toBe(GameKind::Decoded);
    Event::assertDispatched(RetroSettingsChanged::class);
});

it('refuses the icebreaker game setting to others, on completed retros and without a GIF provider', function () {
    config(['services.gifs.key' => null]);
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Writing)->create();
    [$facilitator] = retroFacilitator($retro);
    [$member] = retroMember($retro);

    $this->actingAs($member)
        ->patchJson(route('retros.settings.update', $retro), ['icebreaker_game' => 'hangman'])
        ->assertForbidden();
    $this->actingAs($facilitator)
        ->patchJson(route('retros.settings.update', $retro), ['icebreaker_game' => 'gif'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['icebreaker_game' => 'This game is not available.']);
    $this->actingAs($facilitator)
        ->patchJson(route('retros.settings.update', $retro), ['icebreaker_game' => 'chess'])
        ->assertUnprocessable();

    $retro->update(['phase' => RetroPhase::Completed]);

    $this->actingAs($facilitator)
        ->patchJson(route('retros.settings.update', $retro), ['icebreaker_game' => 'hangman'])
        ->assertForbidden();

    expect($retro->fresh()->icebreaker_game)->toBe(GameKind::DrawAndGuess);
});

it('lists the icebreaker games on the team page', function () {
    config(['services.gifs.key' => null]);
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('icebreakerGames.0', ['value' => 'draw', 'label' => 'Draw & Guess', 'available' => true])
            ->where('icebreakerGames.1.available', false));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/IcebreakerGameSettingTest.php`
Expected: FAIL. The first test finds `draw` instead of `hangman`, because the field is ignored.

- [ ] **Step 3: Accept the game at creation**

Replace `app/Actions/Retros/NewRetro.php` with:

```php
<?php

namespace App\Actions\Retros;

use App\Enums\GameKind;

class NewRetro
{
    public function __construct(
        public string $title,
        public string $template,
        public bool $isAnonymous = false,
        public bool $healthCheckEnabled = false,
        public bool $icebreakerEnabled = false,
        public ?int $votesPerParticipant = null,
        public bool $aiSummaryEnabled = false,
        public ?GameKind $icebreakerGame = null,
    ) {}
}
```

In `app/Actions/Retros/CreateRetro.php` add `use App\Enums\GameKind;` and, in the `$team->retros()->make([...])` array after `'icebreaker_enabled' => $data->icebreakerEnabled,`:

```php
                'icebreaker_game' => $data->icebreakerGame ?? GameKind::DrawAndGuess,
```

In `app/Http/Controllers/TeamRetrosController.php`:

1. Add `use App\Actions\Games\IcebreakerGameOptions;`, `use App\Enums\GameKind;` and `use Illuminate\Validation\Rule;`.
2. Change the signature to `public function store(Request $request, Workspace $workspace, Team $team, CreateRetro $createRetro, IcebreakerGameOptions $icebreakerGameOptions): RedirectResponse`.
3. Add to the validation array after `'icebreaker_enabled' => ['sometimes', 'boolean'],`:

```php
            'icebreaker_game' => ['sometimes', Rule::enum(GameKind::class), $icebreakerGameOptions->rule()],
```

4. Add the named argument after `aiSummaryEnabled: …,`:

```php
            icebreakerGame: isset($validated['icebreaker_game']) ? GameKind::from($validated['icebreaker_game']) : null,
```

- [ ] **Step 4: Accept the game in the settings**

In `app/Http/Controllers/Retros/RetroSettingsController.php`:

1. Add `use App\Actions\Games\IcebreakerGameOptions;`, `use App\Enums\GameKind;` and `use Illuminate\Validation\Rule;`.
2. Append `'icebreaker_game'` to the `OpenPhaseSettings` list (after `'ai_summary_enabled'`).
3. Add `private IcebreakerGameOptions $icebreakerGameOptions,` to the constructor after `private Llm $llm,`.
4. Add to the validation array after `'icebreaker_enabled' => ['sometimes', 'boolean'],`:

```php
            'icebreaker_game' => ['sometimes', Rule::enum(GameKind::class), $this->icebreakerGameOptions->rule()],
```

`$locked->update($validated)` stores it through the `GameKind` cast; the existing `RetroSettingsChanged` broadcast tells the board to refetch.

- [ ] **Step 5: Send the options to the team page**

In ⚑ `app/Http/Controllers/TeamsController.php`:

1. Add `use App\Actions\Games\IcebreakerGameOptions;`.
2. Add `IcebreakerGameOptions $icebreakerGameOptions` as the last parameter of `show()`.
3. Add after `'canCreateRetro' => …,`:

```php
            'icebreakerGames' => $icebreakerGameOptions->options(),
```

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/IcebreakerGameSettingTest.php tests/Feature/Retros/CreateRetroTest.php tests/Feature/Retros/AiSummarySettingTest.php`
Expected: PASS.

- [ ] **Step 7: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Retros/NewRetro.php app/Actions/Retros/CreateRetro.php app/Http/Controllers/TeamRetrosController.php app/Http/Controllers/Retros/RetroSettingsController.php app/Http/Controllers/TeamsController.php tests/Feature/Games/IcebreakerGameSettingTest.php
git commit -m "feat(games): choose the icebreaker game of a retro

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---
### Task 3: Room leaderboard and reset (`RoomLeaderboard`, `DELETE /games/{room}/scores`)

**Files:**
- Create: `app/Actions/Games/RoomLeaderboard.php`, `app/Http/Controllers/Games/GameScoresController.php`
- Modify: ⚑ `app/Actions/Games/BuildGameSnapshot.php`, ⚑ `routes/web.php`, ⚑ `tests/Pest.php`
- Test: create `tests/Feature/Games/RoomLeaderboardTest.php`

**Interfaces:**
- Consumes (13a): `GameRoom::{isIcebreaker(), isManager(), players, scores_reset_at}`, `GamePoint`, `GameGuard::{standalone, manager}`, `GameRoomChanged`, helpers `gameRoomMember`, `gameRoomHost`, `gameRoomGuest`, `gameGuestCookie`.
- Produces:
  - `App\Actions\Games\RoomLeaderboard::handle(GameRoom $room): array<int, array{playerId: string, points: int, wins: int, roundsPlayed: int}>`. It covers every player with `game_points` rows in the room: after `scores_reset_at` for standalone rooms, all of them for icebreaker rooms. Rows are ranked by points desc, then wins desc, then display name. It makes one grouped query, plus loading the room's players when they are not loaded yet.
  - Snapshot keys `leaderboard` (that list) and `scoresResetAt: ?string` (ISO 8601, `null` for icebreaker rooms), added after `emojiData`.
  - Route `games.scores.destroy` (`DELETE /games/{room}/scores`) → 204. It is for standalone rooms only (404 for icebreaker rooms) and room managers only (403). It sets `scores_reset_at = now()` and broadcasts `game.room.changed`.
  - Pest helper `awardGamePoints(GameRoom $room, GamePlayer $player, int $points, bool $isWin = false, array $attributes = []): GamePoint` (Tasks 4 and 5 use it).

- [ ] **Step 1: Add the test helper**

In ⚑ `tests/Pest.php`, add `use App\Models\GamePoint;` if it is missing and append:

```php
/**
 * @param  array<string, mixed>  $attributes
 */
function awardGamePoints(GameRoom $room, GamePlayer $player, int $points, bool $isWin = false, array $attributes = []): GamePoint
{
    return GamePoint::factory()->create([
        'team_id' => $room->team_id,
        'game_room_id' => $room->id,
        'player_id' => $player->id,
        'user_id' => $player->accountUserId(),
        'game' => $room->game,
        'points' => $points,
        'is_win' => $isWin,
        ...$attributes,
    ]);
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/Feature/Games/RoomLeaderboardTest.php`:

```php
<?php

use App\Actions\Games\EnsureIcebreakerRoom;
use App\Actions\Games\RoomLeaderboard;
use App\Enums\GameKind;
use App\Enums\RetroPhase;
use App\Events\Games\GameRoomChanged;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

/**
 * @return array{0: \App\Models\User, 1: GamePlayer}
 */
function namedGameRoomMember(GameRoom $room, string $name): array
{
    [$user, $player] = gameRoomMember($room);
    $user->forceFill(['name' => $name])->save();

    return [$user, $player];
}

it('ranks a room by points, wins and name, guests included', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    [, $alice] = namedGameRoomMember($room, 'Alice');
    [, $bob] = namedGameRoomMember($room, 'Bob');
    $guest = gameRoomGuest($room);
    $guest->forceFill(['guest_name' => 'Zed Zebra'])->save();
    awardGamePoints($room, $bob, 10, true);
    awardGamePoints($room, $alice, 10, true);
    awardGamePoints($room, $alice, 0);
    awardGamePoints($room, $guest, 12);
    awardGamePoints(GameRoom::factory()->create(['team_id' => $room->team_id]), $bob, 50);

    expect(app(RoomLeaderboard::class)->handle($room->fresh()))->toBe([
        ['playerId' => $guest->id, 'points' => 12, 'wins' => 0, 'roundsPlayed' => 1],
        ['playerId' => $alice->id, 'points' => 10, 'wins' => 1, 'roundsPlayed' => 2],
        ['playerId' => $bob->id, 'points' => 10, 'wins' => 1, 'roundsPlayed' => 1],
    ]);
});

it('sends the room leaderboard to every player', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    [$user, $player] = gameRoomMember($room);
    $guest = gameRoomGuest($room);
    awardGamePoints($room, $player, 4, true);

    $this->actingAs($user)
        ->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('leaderboard', [['playerId' => $player->id, 'points' => 4, 'wins' => 1, 'roundsPlayed' => 1]])
        ->assertJsonPath('scoresResetAt', null);

    app('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))->withCredentials()
        ->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('leaderboard.0.playerId', $player->id);
});

it('resets the scores of a standalone room for its managers', function () {
    Event::fake([GameRoomChanged::class]);
    $room = GameRoom::factory()->create();
    [$hostUser, $host] = gameRoomHost($room);
    awardGamePoints($room, $host, 7, true);

    $this->actingAs($hostUser)
        ->deleteJson(route('games.scores.destroy', $room))
        ->assertNoContent();

    expect($room->fresh()->scores_reset_at)->not->toBeNull()
        ->and(app(RoomLeaderboard::class)->handle($room->fresh()))->toBe([])
        ->and((int) GamePoint::query()->sum('points'))->toBe(7);
    Event::assertDispatched(GameRoomChanged::class, fn (GameRoomChanged $event) => $event->roomId === $room->id);

    $this->travel(1)->seconds();
    awardGamePoints($room, $host, 3);

    $this->actingAs($hostUser)
        ->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('leaderboard.0.points', 3)
        ->assertJsonPath('scoresResetAt', $room->fresh()->scores_reset_at->toIso8601String());
});

it('lets the creator and workspace admins reset the scores', function () {
    $room = GameRoom::factory()->create();
    gameRoomHost($room);
    [$creator] = gameRoomMember($room);
    $room->forceFill(['created_by_user_id' => $creator->id])->save();
    $admin = workspaceManager($room->team->workspace);
    GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $admin->id]);

    $this->actingAs($creator)->deleteJson(route('games.scores.destroy', $room))->assertNoContent();
    $this->actingAs($admin)->deleteJson(route('games.scores.destroy', $room))->assertNoContent();
});

it('refuses resets to other players and guests', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    gameRoomHost($room);
    [$member] = gameRoomMember($room);
    $guest = gameRoomGuest($room);

    $this->actingAs($member)
        ->deleteJson(route('games.scores.destroy', $room))
        ->assertForbidden();

    app('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))->withCredentials()
        ->deleteJson(route('games.scores.destroy', $room))
        ->assertForbidden();

    expect($room->fresh()->scores_reset_at)->toBeNull();
});

it('keeps every point of an icebreaker room and cannot reset it', function () {
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->create(['icebreaker_game' => GameKind::Hangman]);
    [$facilitator] = retroFacilitator($retro);
    $room = app(EnsureIcebreakerRoom::class)->handle($retro->fresh());
    $room->forceFill(['scores_reset_at' => now()->addMinute()])->save();
    $host = $room->players()->sole();
    awardGamePoints($room, $host, 6, true);

    $this->actingAs($facilitator)
        ->deleteJson(route('games.scores.destroy', $room))
        ->assertNotFound();
    $this->actingAs($facilitator)
        ->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('leaderboard.0.points', 6)
        ->assertJsonPath('scoresResetAt', null);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/RoomLeaderboardTest.php`
Expected: FAIL — `Class "App\Actions\Games\RoomLeaderboard" not found`.

- [ ] **Step 4: Write the leaderboard**

Create `app/Actions/Games/RoomLeaderboard.php`:

```php
<?php

namespace App\Actions\Games;

use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;

/**
 * The room's scoreboard (spec §4.7): one grouped query over the points
 * rows, which outlive round retention. A standalone room counts points
 * awarded after its last reset; an icebreaker room counts all of them.
 */
class RoomLeaderboard
{
    /**
     * @return array<int, array{
     *     playerId: string,
     *     points: int,
     *     wins: int,
     *     roundsPlayed: int
     * }>
     */
    public function handle(GameRoom $room): array
    {
        $room->loadMissing(['players.user', 'players.participant.user']);

        $names = $room->players->mapWithKeys(fn (GamePlayer $player): array => [$player->id => $player->displayName()]);
        $resetAt = $room->isIcebreaker() ? null : $room->scores_reset_at;

        $rows = GamePoint::query()
            ->where('game_room_id', $room->id)
            ->when($resetAt !== null, fn ($query) => $query->where('created_at', '>', $resetAt))
            ->groupBy('player_id')
            ->selectRaw('player_id, sum(points) as total_points, sum(case when is_win then 1 else 0 end) as wins, count(*) as rounds_played')
            ->toBase()
            ->get();

        return $rows
            ->map(fn (object $row): array => [
                'playerId' => (string) $row->player_id,
                'points' => (int) $row->total_points,
                'wins' => (int) $row->wins,
                'roundsPlayed' => (int) $row->rounds_played,
            ])
            ->sort(fn (array $first, array $second): int => [$second['points'], $second['wins'], $names[$first['playerId']] ?? '']
                <=> [$first['points'], $first['wins'], $names[$second['playerId']] ?? ''])
            ->values()
            ->all();
    }
}
```

- [ ] **Step 5: Add the snapshot keys**

In ⚑ `app/Actions/Games/BuildGameSnapshot.php`:

1. Add `private RoomLeaderboard $roomLeaderboard,` as the last constructor parameter.
2. In the `@phpstan-type Snapshot`, after the `emojiData` line (Plan 13b), add:

```php
 *     leaderboard: array<int, array{playerId: string, points: int, wins: int, roundsPlayed: int}>,
 *     scoresResetAt: ?string,
```

3. In `handle()`'s returned array, after the `'emojiData' => [...]` entry, add:

```php
            'leaderboard' => $this->roomLeaderboard->handle($room),
            'scoresResetAt' => $isStandalone ? $room->scores_reset_at?->toIso8601String() : null,
```

- [ ] **Step 6: Write the reset endpoint**

Create `app/Http/Controllers/Games/GameScoresController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\GameGuard;
use App\Events\Games\GameRoomChanged;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class GameScoresController extends Controller
{
    /**
     * The room leaderboard starts again from zero; the points stay, so the
     * team leaderboard keeps them (spec §4.7).
     */
    public function destroy(Request $request, GameRoom $room): Response
    {
        $player = GamePlayer::current($request);

        GameGuard::standalone($room);
        GameGuard::manager($room, $player);

        DB::transaction(function () use ($room, $player): void {
            $locked = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();

            GameGuard::manager($locked, $player);

            $locked->forceFill(['scores_reset_at' => now()])->save();

            (new GameRoomChanged($locked))->sendToOthers();
        });

        return response()->noContent();
    }
}
```

In ⚑ `routes/web.php`, add `use App\Http\Controllers\Games\GameScoresController;` and, inside the `games/{room}` group, after the `timer` route:

```php
        Route::delete('scores', [GameScoresController::class, 'destroy'])->name('games.scores.destroy');
```

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && vendor/bin/sail artisan test --compact tests/Feature/Games/RoomLeaderboardTest.php tests/Feature/Games/GameSnapshotTest.php`
Expected: PASS (the snapshot's constant-query test still holds: the leaderboard adds one grouped query whatever the number of players).

- [ ] **Step 8: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Games/RoomLeaderboard.php app/Http/Controllers/Games/GameScoresController.php app/Actions/Games/BuildGameSnapshot.php routes/web.php tests/Pest.php tests/Feature/Games/RoomLeaderboardTest.php
git commit -m "feat(games): show and reset the room leaderboard

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 4: Team leaderboard and weekly streaks (`TeamGameLeaderboard`, `GameStreaks`)

**Files:**
- Create: `app/Actions/Games/TeamGameLeaderboard.php`, `app/Actions/Games/GameStreaks.php`
- Modify: `app/Http/Controllers/TeamGameRoomsController.php`
- Test: create `tests/Feature/Games/TeamGameLeaderboardTest.php`

**Interfaces:**
- Consumes: `GamePoint`, `Team::members()`, `User::avatarUrl()`, Task 3 `awardGamePoints`, Task 1 `EnsureIcebreakerRoom`.
- Produces:
  - `App\Actions\Games\TeamGameLeaderboard`: constants `Periods = ['30d', 'all']`, `DefaultPeriod = '30d'`, `Size = 20`. It exposes `static period(mixed $value): string` (anything else → `'30d'`) and `handle(Team $team, string $period): array<int, array{userId: string, name: string, avatarUrl: string, points: int, wins: int, roundsPlayed: int, streak: int}>`, covering the team's current members with points in the team's rooms (standalone and icebreaker), ranked by points desc, then wins desc, then name, top 20.
  - `App\Actions\Games\GameStreaks` exposes `forUsers(Team $team, array<int, string> $userIds): array<string, int>` (one grouped query) and `streak(array<int, string> $weekStarts, CarbonImmutable $currentWeek): int`.
  - `teams.games.index` gains the props `period` (`'30d' | 'all'`) and `leaderboard`. `leaderboard` is an Inertia deferred prop in group `leaderboard`, rescued on failure; `?period=` selects it.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Games/TeamGameLeaderboardTest.php`:

```php
<?php

use App\Actions\Games\EnsureIcebreakerRoom;
use App\Actions\Games\GameStreaks;
use App\Actions\Games\TeamGameLeaderboard;
use App\Enums\GameKind;
use App\Enums\RetroPhase;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-07 12:00:00'));
});

/**
 * @return array{0: User, 1: GamePlayer}
 */
function leaderboardPlayer(GameRoom $room, string $name): array
{
    [$user, $player] = gameRoomMember($room);
    $user->forceFill(['name' => $name])->save();

    return [$user, $player];
}

function teamLeaderboardOf(Team $team, string $period = 'all'): array
{
    return app(TeamGameLeaderboard::class)->handle($team->fresh(), $period);
}

it('ranks current members by points, wins and name across standalone and icebreaker rooms', function () {
    $team = Team::factory()->create();
    $room = GameRoom::factory()->create(['team_id' => $team->id]);
    [$ada, $adaPlayer] = leaderboardPlayer($room, 'Ada');
    [$bea, $beaPlayer] = leaderboardPlayer($room, 'Bea');
    [, $cydPlayer] = leaderboardPlayer($room, 'Cyd');
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->create(['team_id' => $team->id, 'icebreaker_game' => GameKind::Hangman]);
    $icebreaker = app(EnsureIcebreakerRoom::class)->handle($retro);
    $adaParticipant = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $ada->id]);
    $adaIcebreakerPlayer = GamePlayer::factory()->forParticipant($adaParticipant)->create(['game_room_id' => $icebreaker->id]);

    awardGamePoints($room, $adaPlayer, 5, true);
    awardGamePoints($icebreaker, $adaIcebreakerPlayer, 5);
    awardGamePoints($room, $beaPlayer, 10, true);
    awardGamePoints($room, $cydPlayer, 3);

    expect(teamLeaderboardOf($team))->toBe([
        ['userId' => $ada->id, 'name' => 'Ada', 'avatarUrl' => $ada->avatarUrl(), 'points' => 10, 'wins' => 1, 'roundsPlayed' => 2, 'streak' => 1],
        ['userId' => $bea->id, 'name' => 'Bea', 'avatarUrl' => $bea->avatarUrl(), 'points' => 10, 'wins' => 1, 'roundsPlayed' => 1, 'streak' => 1],
        ['userId' => $cydPlayer->user_id, 'name' => 'Cyd', 'avatarUrl' => User::query()->find($cydPlayer->user_id)->avatarUrl(), 'points' => 3, 'wins' => 0, 'roundsPlayed' => 1, 'streak' => 1],
    ]);
});

it('lists current members only', function () {
    $team = Team::factory()->create();
    $room = GameRoom::factory()->linkAccess()->create(['team_id' => $team->id]);
    [$ada, $adaPlayer] = leaderboardPlayer($room, 'Ada');
    [$removed, $removedPlayer] = leaderboardPlayer($room, 'Removed');
    [$deleted, $deletedPlayer] = leaderboardPlayer($room, 'Deleted');
    $admin = workspaceManager($team->workspace);
    $adminPlayer = GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $admin->id]);
    $guest = gameRoomGuest($room);

    foreach ([$adaPlayer, $removedPlayer, $deletedPlayer, $adminPlayer, $guest] as $player) {
        awardGamePoints($room, $player, 4);
    }

    $team->members()->detach($removed);
    $deleted->delete();

    expect(collect(teamLeaderboardOf($team))->pluck('name')->all())->toBe(['Ada']);
});

it('honours the period', function () {
    $team = Team::factory()->create();
    $room = GameRoom::factory()->create(['team_id' => $team->id]);
    [, $adaPlayer] = leaderboardPlayer($room, 'Ada');
    [, $beaPlayer] = leaderboardPlayer($room, 'Bea');
    awardGamePoints($room, $adaPlayer, 8, false, ['created_at' => now()->subDays(31)]);
    awardGamePoints($room, $beaPlayer, 2, false, ['created_at' => now()->subDays(29)]);

    expect(collect(teamLeaderboardOf($team, '30d'))->pluck('name')->all())->toBe(['Bea'])
        ->and(collect(teamLeaderboardOf($team, 'all'))->pluck('name')->all())->toBe(['Ada', 'Bea'])
        ->and(TeamGameLeaderboard::period('all'))->toBe('all')
        ->and(TeamGameLeaderboard::period('7d'))->toBe('30d')
        ->and(TeamGameLeaderboard::period(null))->toBe('30d');
});

it('keeps the top twenty', function () {
    $team = Team::factory()->create();
    $room = GameRoom::factory()->create(['team_id' => $team->id]);

    foreach (range(1, 21) as $points) {
        [, $player] = leaderboardPlayer($room, "Player {$points}");
        awardGamePoints($room, $player, $points);
    }

    $leaderboard = teamLeaderboardOf($team);

    expect($leaderboard)->toHaveCount(20)
        ->and($leaderboard[0]['points'])->toBe(21)
        ->and($leaderboard[19]['points'])->toBe(2);
});

it('counts weekly streaks back from this week or the last one', function () {
    $team = Team::factory()->create();
    $room = GameRoom::factory()->create(['team_id' => $team->id]);
    [$ada, $adaPlayer] = leaderboardPlayer($room, 'Ada');
    [$bea, $beaPlayer] = leaderboardPlayer($room, 'Bea');
    [$cyd, $cydPlayer] = leaderboardPlayer($room, 'Cyd');
    [$dan, $danPlayer] = leaderboardPlayer($room, 'Dan');
    $thisWeek = now();
    $lastWeek = now()->subWeek();
    $twoWeeksAgo = now()->subWeeks(2);

    foreach ([$thisWeek, $lastWeek, $twoWeeksAgo] as $at) {
        awardGamePoints($room, $adaPlayer, 1, false, ['created_at' => $at]);
    }

    foreach ([$lastWeek, $twoWeeksAgo] as $at) {
        awardGamePoints($room, $beaPlayer, 1, false, ['created_at' => $at]);
    }

    foreach ([$thisWeek, $twoWeeksAgo] as $at) {
        awardGamePoints($room, $cydPlayer, 1, false, ['created_at' => $at]);
    }

    awardGamePoints($room, $danPlayer, 1, false, ['created_at' => $twoWeeksAgo]);

    expect(app(GameStreaks::class)->forUsers($team, [$ada->id, $bea->id, $cyd->id, $dan->id]))->toBe([
        $ada->id => 3,
        $bea->id => 2,
        $cyd->id => 1,
        $dan->id => 0,
    ]);
});

it('starts ISO weeks on Monday in UTC', function () {
    $monday = CarbonImmutable::parse('2026-10-05', 'UTC');

    expect(app(GameStreaks::class)->streak(['2026-10-05', '2026-09-28'], $monday))->toBe(2)
        ->and(app(GameStreaks::class)->streak(['2026-09-28', '2026-09-14'], $monday))->toBe(1)
        ->and(app(GameStreaks::class)->streak([], $monday))->toBe(0);
});

it('drops the points of a deleted room', function () {
    $team = Team::factory()->create();
    $room = GameRoom::factory()->create(['team_id' => $team->id]);
    [, $player] = leaderboardPlayer($room, 'Ada');
    awardGamePoints($room, $player, 5);

    $room->delete();

    expect(teamLeaderboardOf($team))->toBe([]);
});

it('defers the leaderboard on the team games page', function () {
    $team = Team::factory()->create();
    $room = GameRoom::factory()->create(['team_id' => $team->id]);
    [$ada, $player] = leaderboardPlayer($room, 'Ada');
    awardGamePoints($room, $player, 5, true, ['created_at' => now()->subDays(40)]);
    $url = fn (array $query = []) => route('teams.games.index', ['workspace' => $team->workspace->slug, 'team' => $team->id, ...$query]);

    $this->actingAs($ada)
        ->get($url())
        ->assertInertia(fn (Assert $page) => $page
            ->component('games/index')
            ->where('period', '30d')
            ->missing('leaderboard')
            ->loadDeferredProps('leaderboard', fn (Assert $reload) => $reload->where('leaderboard', [])));

    $this->actingAs($ada)
        ->get($url(['period' => 'all']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('period', 'all')
            ->loadDeferredProps('leaderboard', fn (Assert $reload) => $reload
                ->where('leaderboard.0.name', 'Ada')
                ->where('leaderboard.0.points', 5)));

    $this->actingAs($ada)
        ->get($url(['period' => 'forever']))
        ->assertInertia(fn (Assert $page) => $page->where('period', '30d'));
});

it('refuses the team games page to people outside the team', function () {
    $team = Team::factory()->create();
    $outsider = teamMember(Team::factory()->create(['workspace_id' => $team->workspace_id]));

    $this->actingAs($outsider)
        ->get(route('teams.games.index', ['workspace' => $team->workspace->slug, 'team' => $team->id]))
        ->assertForbidden();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/TeamGameLeaderboardTest.php`
Expected: FAIL — `Class "App\Actions\Games\TeamGameLeaderboard" not found`.

- [ ] **Step 3: Write the streaks**

Create `app/Actions/Games/GameStreaks.php`:

```php
<?php

namespace App\Actions\Games;

use App\Models\GamePoint;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Consecutive ISO weeks (UTC, Monday start) with at least one points row
 * in the team, counted back from this week, or from last week while this
 * week has none yet (spec §4.7). Read with one grouped query, never stored.
 */
class GameStreaks
{
    /**
     * @param  array<int, string>  $userIds
     * @return array<string, int>
     */
    public function forUsers(Team $team, array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        $weeks = GamePoint::query()
            ->where('team_id', $team->id)
            ->whereIn('user_id', $userIds)
            ->selectRaw("user_id, date_trunc('week', created_at) as week_start")
            ->groupByRaw("user_id, date_trunc('week', created_at)")
            ->toBase()
            ->get()
            ->groupBy('user_id')
            ->map(fn ($rows): array => $rows
                ->map(fn (object $row): string => CarbonImmutable::parse((string) $row->week_start, 'UTC')->toDateString())
                ->all());

        $currentWeek = CarbonImmutable::now('UTC')->startOfWeek(CarbonInterface::MONDAY);
        $streaks = [];

        foreach ($userIds as $userId) {
            $streaks[$userId] = $this->streak($weeks->get($userId, []), $currentWeek);
        }

        return $streaks;
    }

    /**
     * @param  array<int, string>  $weekStarts  Monday dates (Y-m-d) with points
     */
    public function streak(array $weekStarts, CarbonImmutable $currentWeek): int
    {
        $played = array_flip($weekStarts);
        $week = isset($played[$currentWeek->toDateString()]) ? $currentWeek : $currentWeek->subWeek();
        $streak = 0;

        while (isset($played[$week->toDateString()])) {
            $streak++;
            $week = $week->subWeek();
        }

        return $streak;
    }
}
```

- [ ] **Step 4: Write the team leaderboard**

Create `app/Actions/Games/TeamGameLeaderboard.php`:

```php
<?php

namespace App\Actions\Games;

use App\Models\GamePoint;
use App\Models\Team;
use App\Models\User;

/**
 * Members only (spec §4.7): guests have no identity across rooms, removed
 * members and workspace admins outside the team are not part of it, and a
 * deleted user's rows lost their user id.
 */
class TeamGameLeaderboard
{
    public const Periods = ['30d', 'all'];

    public const DefaultPeriod = '30d';

    public const Size = 20;

    public function __construct(private GameStreaks $gameStreaks) {}

    public static function period(mixed $value): string
    {
        return in_array($value, self::Periods, true) ? $value : self::DefaultPeriod;
    }

    /**
     * @return array<int, array{
     *     userId: string,
     *     name: string,
     *     avatarUrl: string,
     *     points: int,
     *     wins: int,
     *     roundsPlayed: int,
     *     streak: int
     * }>
     */
    public function handle(Team $team, string $period): array
    {
        $rows = GamePoint::query()
            ->join('users', 'users.id', '=', 'game_points.user_id')
            ->where('game_points.team_id', $team->id)
            ->whereIn('game_points.user_id', $team->members()->select('users.id'))
            ->when($period === '30d', fn ($query) => $query->where('game_points.created_at', '>=', now()->subDays(30)))
            ->groupBy('game_points.user_id', 'users.name')
            ->selectRaw('game_points.user_id, users.name, sum(game_points.points) as total_points, sum(case when game_points.is_win then 1 else 0 end) as wins, count(*) as rounds_played')
            ->orderByDesc('total_points')
            ->orderByDesc('wins')
            ->orderBy('users.name')
            ->limit(self::Size)
            ->toBase()
            ->get();

        $userIds = $rows->map(fn (object $row): string => (string) $row->user_id)->all();
        $users = User::query()->whereKey($userIds)->get()->keyBy('id');
        $streaks = $this->gameStreaks->forUsers($team, $userIds);

        return $rows
            ->map(fn (object $row): array => [
                'userId' => (string) $row->user_id,
                'name' => (string) $row->name,
                'avatarUrl' => $users->get((string) $row->user_id)?->avatarUrl() ?? '',
                'points' => (int) $row->total_points,
                'wins' => (int) $row->wins,
                'roundsPlayed' => (int) $row->rounds_played,
                'streak' => $streaks[(string) $row->user_id] ?? 0,
            ])
            ->values()
            ->all();
    }
}
```

- [ ] **Step 5: Defer it on the Games page**

In `app/Http/Controllers/TeamGameRoomsController.php`:

1. Add `use App\Actions\Games\TeamGameLeaderboard;`.
2. Add `TeamGameLeaderboard $teamGameLeaderboard` as the last parameter of `index()`.
3. After `Gate::authorize('view', $team);` add:

```php
        $period = TeamGameLeaderboard::period($request->query('period'));
```

4. Add to the `Inertia::render('games/index', [...])` props, after `'roomLimit' => …,`:

```php
            'period' => $period,
            'leaderboard' => Inertia::defer(fn (): array => $teamGameLeaderboard->handle($team, $period), 'leaderboard', true),
```

The third argument (`rescue`) turns a failure into the `<Deferred rescue>` state of the page (Task 9) instead of an error page (spec §10).

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/TeamGameLeaderboardTest.php tests/Feature/Games/GamePagesTest.php tests/Feature/Games/GameRoomsTest.php`
Expected: PASS.

- [ ] **Step 7: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Games/TeamGameLeaderboard.php app/Actions/Games/GameStreaks.php app/Http/Controllers/TeamGameRoomsController.php tests/Feature/Games/TeamGameLeaderboardTest.php
git commit -m "feat(games): add the team leaderboard with weekly streaks

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 5: "Games we played" (`BuildGamesPlayed` into `results.games`)

**Files:**
- Create: `app/Actions/Games/BuildGamesPlayed.php`
- Modify: ⚑ `app/Actions/Retros/BuildResults.php`
- Test: create `tests/Feature/Games/GamesPlayedTest.php`

**Interfaces:**
- Consumes:
  - 13a: `PresentGameRoundHistory::handle(GameRound): array` and its `Relations`.
  - 13c: `PresentGifAnswers::revealed(Collection $answers, GameRoom $room): array` (it drops authors on anonymous retros).
  - Task 3 `RoomLeaderboard`, Task 1 `EnsureIcebreakerRoom`.
  - Factories `GameRound::factory()->ended()`, `GameGuess::factory()`, `GameGifAnswer::factory()`, `GameGifVote::factory()`.
- Produces: `App\Actions\Games\BuildGamesPlayed::handle(Retro $retro): ?array`. The shape is `{roomId, rounds: [{id, game, outcome, word, question, clue, leader, winner, answers, endedAt}], leaderboard: [{playerId, name, avatarUrl, isGuest, points, wins, roundsPlayed}], roundsPlayed}`, or `null` without an icebreaker room or without an ended, non-abandoned round.
  - `leader` and `winner` are `{playerId, name, avatarUrl, isGuest} | null`.
  - `clue` is the emoji list for Decoded rounds, else `null`.
  - `answers` (Sprint in one GIF only, else `null`) is `[{gif: {id, previewUrl, url}, playerId | null, votes | null}]`, with `votes` the final count for `Revealed` rounds, else `null`.
  - The query count is constant. `BuildResults` returns it as `games`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Games/GamesPlayedTest.php`:

```php
<?php

use App\Actions\Games\BuildGamesPlayed;
use App\Actions\Games\EnsureIcebreakerRoom;
use App\Actions\Games\PresentGameRoundHistory;
use App\Actions\Games\RoomLeaderboard;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GameGuess;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
});

/**
 * @return array{0: Retro, 1: User, 2: GameRoom, 3: GamePlayer, 4: User, 5: GamePlayer}
 */
function playedIcebreaker(bool $anonymous = false): array
{
    $retro = Retro::factory()->withIcebreaker()->withGuestAccess()->inPhase(RetroPhase::Icebreaker)->create([
        'is_anonymous' => $anonymous,
        'icebreaker_game' => GameKind::DrawAndGuess,
    ]);
    [$facilitator] = retroFacilitator($retro);
    $facilitator->forceFill(['name' => 'Fran'])->save();
    [$member, $memberParticipant] = retroMember($retro);
    $member->forceFill(['name' => 'Mo'])->save();
    $room = app(EnsureIcebreakerRoom::class)->handle($retro->fresh());
    $host = $room->players()->sole();
    $memberPlayer = GamePlayer::factory()->forParticipant($memberParticipant)->create(['game_room_id' => $room->id]);

    return [$retro, $facilitator, $room, $host, $member, $memberPlayer];
}

function endedIcebreakerRound(GameRoom $room, GameKind $game, GameRoundOutcome $outcome, int $minute, array $attributes = []): GameRound
{
    return GameRound::factory()->game($game)->create([
        'game_room_id' => $room->id,
        'outcome' => $outcome,
        'started_at' => now()->addMinutes($minute - 1),
        'ended_at' => now()->addMinutes($minute),
        ...$attributes,
    ]);
}

function completeIcebreakerRetro(Retro $retro): void
{
    $retro->update(['phase' => RetroPhase::Completed, 'completed_at' => now()]);
}

it('is null without an icebreaker room or with abandoned rounds only', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();

    expect(app(BuildGamesPlayed::class)->handle($retro))->toBeNull();

    [$retro, , $room] = playedIcebreaker();
    endedIcebreakerRound($room, GameKind::Hangman, GameRoundOutcome::Abandoned, 1);
    activeGameRound($room);

    expect(app(BuildGamesPlayed::class)->handle($retro->fresh()))->toBeNull();
});

it('lists the ended rounds oldest first with leader, winner and word, never a guess', function () {
    [$retro, $facilitator, $room, $host, $member, $memberPlayer] = playedIcebreaker();
    $hangman = endedIcebreakerRound($room, GameKind::Hangman, GameRoundOutcome::Solved, 5, ['word' => 'sprint', 'winner_player_id' => $memberPlayer->id]);
    $drawing = endedIcebreakerRound($room, GameKind::DrawAndGuess, GameRoundOutcome::Guessed, 2, [
        'word' => 'rocket',
        'leader_player_id' => $host->id,
        'winner_player_id' => $memberPlayer->id,
    ]);
    endedIcebreakerRound($room, GameKind::Hangman, GameRoundOutcome::Abandoned, 3, ['word' => 'teapot']);
    GameGuess::factory()->create(['game_round_id' => $drawing->id, 'player_id' => $memberPlayer->id, 'text' => 'banana']);
    completeIcebreakerRetro($retro);

    $games = $this->actingAs($facilitator)
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertOk()
        ->json('results.games');

    expect($games['roomId'])->toBe($room->id)
        ->and($games['roundsPlayed'])->toBe(2)
        ->and($games['rounds'][0])->toBe([
            'id' => $drawing->id,
            'game' => 'draw',
            'outcome' => 'guessed',
            'word' => 'rocket',
            'question' => null,
            'clue' => null,
            'leader' => ['playerId' => $host->id, 'name' => 'Fran', 'avatarUrl' => $host->avatarUrl(), 'isGuest' => false],
            'winner' => ['playerId' => $memberPlayer->id, 'name' => 'Mo', 'avatarUrl' => $memberPlayer->avatarUrl(), 'isGuest' => false],
            'answers' => null,
            'endedAt' => $drawing->fresh()->ended_at->toIso8601String(),
        ])
        ->and($games['rounds'][1]['id'])->toBe($hangman->id)
        ->and($games['rounds'][1]['leader'])->toBeNull()
        ->and(json_encode($games))->not->toContain('banana')
        ->and(json_encode($games))->not->toContain('teapot');
});

it('presents the shared fields exactly as the room history does', function () {
    [$retro, , $room, $host, , $memberPlayer] = playedIcebreaker();
    $round = endedIcebreakerRound($room, GameKind::DrawAndGuess, GameRoundOutcome::Guessed, 2, [
        'word' => 'rocket',
        'leader_player_id' => $host->id,
        'winner_player_id' => $memberPlayer->id,
    ]);

    $history = app(PresentGameRoundHistory::class)->handle($round->fresh()->load(PresentGameRoundHistory::Relations));
    $played = app(BuildGamesPlayed::class)->handle($retro->fresh())['rounds'][0];

    foreach (['id', 'game', 'outcome', 'word', 'question', 'endedAt'] as $key) {
        expect($played[$key])->toBe($history[$key]);
    }

    expect($played['leader']['playerId'])->toBe($history['leaderPlayerId'])
        ->and($played['winner']['name'])->toBe($history['winnerName']);
});

it('keeps the clue of Decoded rounds', function () {
    [$retro, , $room, $host] = playedIcebreaker();
    endedIcebreakerRound($room, GameKind::Decoded, GameRoundOutcome::TimedOut, 1, ['word' => 'coffee', 'leader_player_id' => $host->id, 'clue' => ['☕', '🔥']]);

    expect(app(BuildGamesPlayed::class)->handle($retro->fresh())['rounds'][0]['clue'])->toBe(['☕', '🔥']);
});

it('lists GIF answers with their authors and final votes', function () {
    [$retro, , $room, $host, , $memberPlayer] = playedIcebreaker();
    $round = endedIcebreakerRound($room, GameKind::SprintGif, GameRoundOutcome::Revealed, 1, ['word' => null, 'question' => 'How did the sprint feel?']);
    $memberAnswer = GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $memberPlayer->id, 'gif_id' => 'memberGif']);
    GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $host->id, 'gif_id' => 'hostGif']);
    GameGifVote::factory()->create(['game_round_id' => $round->id, 'voter_player_id' => $host->id, 'answer_id' => $memberAnswer->id]);

    $answers = collect(app(BuildGamesPlayed::class)->handle($retro->fresh())['rounds'][0]['answers'])->keyBy('gif.id');

    expect($answers['memberGif'])->toBe([
        'gif' => gameGifPayload('memberGif'),
        'playerId' => $memberPlayer->id,
        'votes' => 1,
    ])
        ->and($answers['hostGif']['playerId'])->toBe($host->id)
        ->and($answers['hostGif']['votes'])->toBe(0);
});

it('hides GIF authors on anonymous retros', function () {
    [$retro, , $room, $host, , $memberPlayer] = playedIcebreaker(anonymous: true);
    $round = endedIcebreakerRound($room, GameKind::SprintGif, GameRoundOutcome::Revealed, 1, ['word' => null, 'question' => 'How did the sprint feel?']);
    GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $memberPlayer->id]);
    GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $host->id]);

    $answers = app(BuildGamesPlayed::class)->handle($retro->fresh())['rounds'][0]['answers'];

    expect(collect($answers)->pluck('playerId')->unique()->all())->toBe([null]);
});

it('ranks the icebreaker players as the room leaderboard does', function () {
    [$retro, , $room, $host, , $memberPlayer] = playedIcebreaker();
    endedIcebreakerRound($room, GameKind::Hangman, GameRoundOutcome::Solved, 1, ['winner_player_id' => $memberPlayer->id]);
    awardGamePoints($room, $memberPlayer, 9, true);
    awardGamePoints($room, $host, 2);

    $leaderboard = app(BuildGamesPlayed::class)->handle($retro->fresh())['leaderboard'];

    expect($leaderboard)->toBe([
        ['playerId' => $memberPlayer->id, 'name' => 'Mo', 'avatarUrl' => $memberPlayer->avatarUrl(), 'isGuest' => false, 'points' => 9, 'wins' => 1, 'roundsPlayed' => 1],
        ['playerId' => $host->id, 'name' => 'Fran', 'avatarUrl' => $host->avatarUrl(), 'isGuest' => false, 'points' => 2, 'wins' => 0, 'roundsPlayed' => 1],
    ])
        ->and(collect($leaderboard)->pluck('playerId')->all())->toBe(collect(app(RoomLeaderboard::class)->handle($room->fresh()))->pluck('playerId')->all());
});

it('shows the games to guests and after the icebreaker was turned off', function () {
    [$retro, , $room] = playedIcebreaker();
    endedIcebreakerRound($room, GameKind::Hangman, GameRoundOutcome::Lost, 1);
    completeIcebreakerRetro($retro);
    $retro->update(['icebreaker_enabled' => false]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertOk()
        ->assertJsonPath('results.games.roundsPlayed', 1)
        ->assertJsonPath('results.games.rounds.0.word', 'sprint');
});

it('builds the games with a constant number of queries', function () {
    $count = function (int $rounds, int $extraPlayers): int {
        [$retro, , $room, $host, , $memberPlayer] = playedIcebreaker();

        foreach (range(1, $extraPlayers) as $index) {
            $participant = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => User::factory()->create()->id]);
            GamePlayer::factory()->forParticipant($participant)->create(['game_room_id' => $room->id]);
        }

        foreach (range(1, $rounds) as $minute) {
            $gif = endedIcebreakerRound($room, GameKind::SprintGif, GameRoundOutcome::Revealed, $minute * 2, ['word' => null, 'question' => 'Q', 'winner_player_id' => null]);
            $answer = GameGifAnswer::factory()->create(['game_round_id' => $gif->id, 'player_id' => $memberPlayer->id]);
            GameGifVote::factory()->create(['game_round_id' => $gif->id, 'voter_player_id' => $host->id, 'answer_id' => $answer->id]);
            endedIcebreakerRound($room, GameKind::DrawAndGuess, GameRoundOutcome::Guessed, $minute * 2 + 1, ['leader_player_id' => $host->id, 'winner_player_id' => $memberPlayer->id]);
            awardGamePoints($room, $memberPlayer, 2);
        }

        $retro = $retro->fresh();

        DB::flushQueryLog();
        DB::enableQueryLog();
        app(BuildGamesPlayed::class)->handle($retro);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    expect($count(1, 1))->toBe($count(6, 4));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/GamesPlayedTest.php`
Expected: FAIL — `Class "App\Actions\Games\BuildGamesPlayed" not found`.

- [ ] **Step 3: Write the presenter**

Create `app/Actions/Games/BuildGamesPlayed.php`:

```php
<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GameGifAnswer;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;
use Illuminate\Support\Collection;

/**
 * The "Games we played" section of a completed retro (spec §6.1). Only
 * ended rounds are read, through the same presenters as the room history
 * and the GIF round results, so no secrecy rule lives here; guesses are
 * never loaded.
 */
class BuildGamesPlayed
{
    public function __construct(
        private PresentGameRoundHistory $presentGameRoundHistory,
        private PresentGifAnswers $presentGifAnswers,
        private RoomLeaderboard $roomLeaderboard,
    ) {}

    /**
     * @return array{
     *     roomId: string,
     *     rounds: array<int, array<string, mixed>>,
     *     leaderboard: array<int, array{playerId: string, name: string, avatarUrl: string, isGuest: bool, points: int, wins: int, roundsPlayed: int}>,
     *     roundsPlayed: int
     * }|null
     */
    public function handle(Retro $retro): ?array
    {
        $room = GameRoom::query()
            ->where('retro_id', $retro->id)
            ->with(['players.user', 'players.participant.user'])
            ->first();

        if ($room === null) {
            return null;
        }

        $room->setRelation('retro', $retro);

        $rounds = $room->rounds()
            ->whereNotNull('ended_at')
            ->where('outcome', '!=', GameRoundOutcome::Abandoned->value)
            ->with([...PresentGameRoundHistory::Relations, 'gifAnswers' => fn ($query) => $query->withCount('votes')])
            ->orderBy('ended_at')
            ->orderBy('id')
            ->get();

        if ($rounds->isEmpty()) {
            return null;
        }

        $players = $room->players->keyBy('id');

        return [
            'roomId' => $room->id,
            'rounds' => $rounds->map(fn (GameRound $round): array => $this->round($round, $room))->values()->all(),
            'leaderboard' => $this->leaderboard($room, $players),
            'roundsPlayed' => $rounds->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function round(GameRound $round, GameRoom $room): array
    {
        $history = $this->presentGameRoundHistory->handle($round);

        return [
            'id' => $history['id'],
            'game' => $history['game'],
            'outcome' => $history['outcome'],
            'word' => $history['word'],
            'question' => $history['question'],
            'clue' => $round->game === GameKind::Decoded ? array_values($round->clue) : null,
            'leader' => $this->person($round->leader),
            'winner' => $this->person($round->winner),
            'answers' => $round->game === GameKind::SprintGif ? $this->answers($round, $room) : null,
            'endedAt' => $history['endedAt'],
        ];
    }

    /**
     * Votes of a round that did not close normally were discarded (13c).
     *
     * @return array<int, array{gif: array{id: string, previewUrl: string, url: string}, playerId: ?string, votes: ?int}>
     */
    private function answers(GameRound $round, GameRoom $room): array
    {
        $countsVotes = $round->outcome === GameRoundOutcome::Revealed;
        $votes = $round->gifAnswers->mapWithKeys(fn (GameGifAnswer $answer): array => [
            $answer->id => $countsVotes ? (int) $answer->getAttribute('votes_count') : null,
        ]);

        return array_map(fn (array $answer): array => [
            'gif' => $answer['gif'],
            'playerId' => $answer['playerId'],
            'votes' => $votes[$answer['id']],
        ], $this->presentGifAnswers->revealed($round->gifAnswers, $room));
    }

    /**
     * @param  Collection<string, GamePlayer>  $players
     * @return array<int, array{playerId: string, name: string, avatarUrl: string, isGuest: bool, points: int, wins: int, roundsPlayed: int}>
     */
    private function leaderboard(GameRoom $room, Collection $players): array
    {
        $rows = [];

        foreach ($this->roomLeaderboard->handle($room) as $row) {
            $person = $this->person($players->get($row['playerId']));

            if ($person === null) {
                continue;
            }

            $rows[] = [
                ...$person,
                'points' => $row['points'],
                'wins' => $row['wins'],
                'roundsPlayed' => $row['roundsPlayed'],
            ];
        }

        return $rows;
    }

    /**
     * @return array{playerId: string, name: string, avatarUrl: string, isGuest: bool}|null
     */
    private function person(?GamePlayer $player): ?array
    {
        if ($player === null) {
            return null;
        }

        return [
            'playerId' => $player->id,
            'name' => $player->displayName(),
            'avatarUrl' => $player->avatarUrl(),
            'isGuest' => $player->isGuest(),
        ];
    }
}
```

- [ ] **Step 4: Plug it into the results**

In ⚑ `app/Actions/Retros/BuildResults.php`:

1. Add `use App\Actions\Games\BuildGamesPlayed;` and `private BuildGamesPlayed $buildGamesPlayed,` as the last constructor parameter.
2. In the return docblock, replace ` *     games: null,` with:

```php
 *     games: ?array{roomId: string, rounds: array<int, array<string, mixed>>, leaderboard: array<int, array<string, mixed>>, roundsPlayed: int},
```

3. Replace `'games' => null,` with:

```php
            'games' => $this->buildGamesPlayed->handle($retro),
```

- [ ] **Step 5: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/GamesPlayedTest.php tests/Feature/Retros/ResultsTest.php tests/Feature/Retros/BoardSnapshotTest.php`
Expected: PASS (`ResultsTest` "leaves games and summary empty" still sees `null`: its retro has no icebreaker room).

- [ ] **Step 6: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Games/BuildGamesPlayed.php app/Actions/Retros/BuildResults.php tests/Feature/Games/GamesPlayedTest.php
git commit -m "feat(games): list the games played in the retro results

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 6: Room invites to Slack and Telegram (`GameRoom` as delivery subject, `POST /games/{room}/shares`)

**Files:**
- Create: `app/Actions/Games/GameRoomShares.php`, `app/Http/Controllers/Games/GameSharesController.php`
- Modify: ⚑ `app/Models/GameRoom.php`, ⚑ `app/Actions/Integrations/BuildLinkShare.php`, ⚑ `app/Actions/Games/BuildGameSnapshot.php`, ⚑ `routes/web.php`, ⚑ `tests/Feature/Games/GameSnapshotTest.php`
- Test: create `tests/Feature/Games/GameRoomSharesTest.php`

**Interfaces:**
- Consumes:
  - Plan 12b: `App\Contracts\DeliverySubject`; `QueueShare::handle(Model&DeliverySubject $subject, IntegrationDeliveryChannel $channel, IntegrationDeliveryKind $kind, User $requester, ShareContent $content): IntegrationDelivery` (throws `NotConnected` / `ReconnectRequired`, 409); `LinkShareContent(string $text, string $buttonLabel, string $url)`; `IntegrationDeliveryChannel::{shareChannels(), provider()}`; `IntegrationDeliveryKind::GameRoomLink`; `ShareOptions::channels(Team): array{slack: bool, telegram: bool}`; `LatestDeliveries::handle(Model $subject, array $kinds): array`; `PresentIntegrationDelivery::handle(IntegrationDelivery): array`; jobs `DeliverToSlack` (`$message`) and `DeliverToTelegram` (`$html`).
  - Plan 12a: factories `TeamIntegration::factory()->{slack(), telegram(), reconnectRequired()}`, `IntegrationDelivery::factory()->forSubject(Model)`; helpers `enableIntegrations()`.
  - 13a: `GameRoom::{isIcebreaker(), isHost(), isCreator(), access, guest_token}`, `GameGuard::standalone`, `GameRoomChanged`, helpers `gameRoomHost`, `gameRoomMember`, `gameRoomGuest`, `gameGuestCookie`.
- Produces:
  - `GameRoom implements DeliverySubject`: `deliveryTeam(): Team`; `announceDeliveryChange(): void` broadcasts `game.room.changed`; a `deleting` hook removes the room's deliveries.
  - `BuildLinkShare::gameRoom(GameRoom $room, User $sharer, bool $includeGuestLink): LinkShareContent`.
  - `App\Actions\Games\GameRoomShares` with:
    - `canShare(GameRoom, GamePlayer): bool` — a member player who is a workspace Owner/Admin, or the host or creator while a team member; never for icebreaker rooms;
    - `ensure(GameRoom, GamePlayer): User` (403 otherwise);
    - `availability(GameRoom, GamePlayer): array{slack: bool, telegram: bool}`;
    - `deliveries(GameRoom, GamePlayer): array`.
  - Snapshot keys `share` and `deliveries` (after `scoresResetAt`) and `room.teamName` (`null` for guests).
  - Route `games.shares.store` (`POST /games/{room}/shares`, `throttle:5,1`), body `{channel: slack|telegram, include_guest_link?}` → 202 with the presented delivery.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Games/GameRoomSharesTest.php`:

```php
<?php

use App\Actions\Games\EnsureIcebreakerRoom;
use App\Enums\GameKind;
use App\Enums\IntegrationProvider;
use App\Enums\RetroPhase;
use App\Events\Games\GameRoomChanged;
use App\Jobs\Integrations\DeliverToSlack;
use App\Jobs\Integrations\DeliverToTelegram;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\IntegrationDelivery;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
});

/**
 * @return array{0: GameRoom, 1: User, 2: GamePlayer}
 */
function invitableGameRoom(array $attributes = []): array
{
    $room = GameRoom::factory()->create([
        'name' => 'Friday fun',
        'game' => GameKind::Hangman,
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
        ...$attributes,
    ]);
    TeamIntegration::factory()->slack()->create(['team_id' => $room->team_id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $room->team_id]);
    [$host, $hostPlayer] = gameRoomHost($room);
    $host->forceFill(['name' => 'Hana Host'])->save();

    return [$room, $host, $hostPlayer];
}

it('queues an invite for the host without any game content', function () {
    [$room, $host] = invitableGameRoom();
    [$player] = gameRoomMember($room);
    $player->forceFill(['name' => 'Pat Player'])->save();
    activeGameRound($room, ['word' => 'sprint']);

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'slack'])
        ->assertAccepted()
        ->assertJson(['channel' => 'slack', 'kind' => 'game_room_link', 'status' => 'queued']);
    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'telegram'])
        ->assertAccepted();

    Queue::assertPushed(DeliverToSlack::class, function (DeliverToSlack $job) use ($room) {
        $json = json_encode($job->message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        return str_contains($json, 'Hana Host invites you to play Hangman in \"Friday fun\" (Platform)')
            && str_contains($json, 'Join the game')
            && $job->message['blocks'][1]['elements'][0]['url'] === route('games.show', $room)
            && ! str_contains($json, 'Pat Player')
            && ! str_contains($json, 'sprint');
    });
    Queue::assertPushed(DeliverToTelegram::class, fn (DeliverToTelegram $job) => str_contains($job->html, 'Join the game')
        && str_contains($job->html, route('games.show', $room))
        && ! str_contains($job->html, 'Pat Player'));

    expect(IntegrationDelivery::query()->whereMorphedTo('subject', $room)->count())->toBe(2);
});

it('posts the guest link of a link room only on request', function () {
    [$room, $host] = invitableGameRoom(['access' => 'link']);

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'slack', 'include_guest_link' => true])
        ->assertAccepted();
    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'telegram'])
        ->assertAccepted();

    Queue::assertPushed(DeliverToSlack::class, fn (DeliverToSlack $job) => $job->message['blocks'][1]['elements'][0]['url'] === route('games.join.show', $room->guest_token));
    Queue::assertPushed(DeliverToTelegram::class, fn (DeliverToTelegram $job) => ! str_contains($job->html, $room->guest_token));
});

it('refuses the guest link on a team room', function () {
    [$room, $host] = invitableGameRoom();

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'slack', 'include_guest_link' => true])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['include_guest_link' => 'Guest access is off for this room.']);

    Queue::assertNothingPushed();
});

it('escapes the room name for both chats', function () {
    [$room, $host] = invitableGameRoom(['name' => '<!channel> & <b>fun</b>']);

    $this->actingAs($host)->postJson(route('games.shares.store', $room), ['channel' => 'slack'])->assertAccepted();
    $this->actingAs($host)->postJson(route('games.shares.store', $room), ['channel' => 'telegram'])->assertAccepted();

    Queue::assertPushed(DeliverToSlack::class, fn (DeliverToSlack $job) => str_contains($job->message['text'], '&lt;!channel&gt; &amp; &lt;b&gt;fun&lt;/b&gt;')
        && ! str_contains($job->message['text'], '<!channel>'));
    Queue::assertPushed(DeliverToTelegram::class, fn (DeliverToTelegram $job) => str_contains($job->html, '&lt;!channel&gt; &amp; &lt;b&gt;fun&lt;/b&gt;'));
});

it('lets the creator and workspace admins invite', function () {
    [$room] = invitableGameRoom();
    [$creator] = gameRoomMember($room);
    $room->forceFill(['created_by_user_id' => $creator->id])->save();
    $admin = workspaceManager($room->team->workspace);
    GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $admin->id]);

    $this->actingAs($creator)->postJson(route('games.shares.store', $room), ['channel' => 'slack'])->assertAccepted();
    $this->actingAs($admin)->postJson(route('games.shares.store', $room), ['channel' => 'slack'])->assertAccepted();
});

it('refuses players who do not manage the room and guests', function () {
    [$room] = invitableGameRoom(['access' => 'link']);
    [$member] = gameRoomMember($room);
    $guest = gameRoomGuest($room);

    $this->actingAs($member)
        ->postJson(route('games.shares.store', $room), ['channel' => 'slack'])
        ->assertForbidden();

    app('auth')->forgetGuards();

    $this->withCookies(gameGuestCookie($guest))->withCredentials()
        ->postJson(route('games.shares.store', $room), ['channel' => 'slack'])
        ->assertForbidden();

    Queue::assertNothingPushed();
});

it('has no invite for icebreaker rooms', function () {
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->create();
    [$facilitator] = retroFacilitator($retro);
    $room = app(EnsureIcebreakerRoom::class)->handle($retro->fresh());
    TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);

    $this->actingAs($facilitator)
        ->postJson(route('games.shares.store', $room), ['channel' => 'slack'])
        ->assertNotFound();
    $this->actingAs($facilitator)
        ->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('share', ['slack' => false, 'telegram' => false])
        ->assertJsonPath('deliveries', []);
});

it('answers 404 for a disabled provider and 409 without an active connection', function () {
    [$room, $host] = invitableGameRoom();
    TeamIntegration::query()->where('provider', 'telegram')->delete();
    TeamIntegration::query()->where('provider', 'slack')->update(['status' => 'reconnect_required']);

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'telegram'])
        ->assertConflict()
        ->assertJson(['message' => 'Connect Telegram in the team settings.']);
    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'slack'])
        ->assertConflict()
        ->assertJson(['message' => 'Reconnect Slack in the team settings.']);

    config(['services.slack.client_id' => null]);

    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'slack'])
        ->assertNotFound();
    $this->actingAs($host)
        ->postJson(route('games.shares.store', $room), ['channel' => 'email'])
        ->assertUnprocessable();

    Queue::assertNothingPushed();
});

it('limits invites to five a minute', function () {
    [$room, $host] = invitableGameRoom();

    foreach (range(1, 5) as $attempt) {
        $this->actingAs($host)->postJson(route('games.shares.store', $room), ['channel' => 'slack'])->assertAccepted();
    }

    $this->actingAs($host)->postJson(route('games.shares.store', $room), ['channel' => 'slack'])->assertTooManyRequests();
});

it('tells the room when a delivery finished', function () {
    Event::fake([GameRoomChanged::class]);
    Http::fake(['hooks.slack.com/*' => Http::response('ok')]);
    [$room] = invitableGameRoom();
    $delivery = IntegrationDelivery::factory()->forSubject($room)->create([
        'team_id' => $room->team_id,
        'channel' => 'slack',
        'kind' => 'game_room_link',
        'status' => 'queued',
    ]);

    $job = new DeliverToSlack($delivery->id, ['text' => 'hello'], 'en');
    $job->withFakeQueueInteractions();
    $job->handle();

    expect($delivery->fresh()->status->value)->toBe('sent');
    Event::assertDispatched(GameRoomChanged::class, fn (GameRoomChanged $event) => $event->roomId === $room->id
        && $event->broadcastOn()->name === "presence-game.{$room->id}");
});

it('shows the invite state to managers only', function () {
    [$room, $host, $hostPlayer] = invitableGameRoom();
    [$member] = gameRoomMember($room);
    IntegrationDelivery::factory()->forSubject($room)->failed('Reconnect Slack in the team settings.')->create([
        'team_id' => $room->team_id,
        'channel' => 'slack',
        'kind' => 'game_room_link',
    ]);

    $this->actingAs($host)
        ->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('share', ['slack' => true, 'telegram' => true])
        ->assertJsonPath('deliveries.0.status', 'failed')
        ->assertJsonPath('room.teamName', 'Platform');
    $this->actingAs($member)
        ->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('share', ['slack' => false, 'telegram' => false])
        ->assertJsonPath('deliveries', []);
});

it('deletes the room deliveries with the room', function () {
    [$room, $host] = invitableGameRoom();
    $room->forceFill(['created_by_user_id' => $host->id])->save();
    IntegrationDelivery::factory()->forSubject($room)->create(['team_id' => $room->team_id, 'channel' => 'slack', 'kind' => 'game_room_link']);

    $this->actingAs($host)->deleteJson(route('games.destroy', $room))->assertNoContent();

    expect(IntegrationDelivery::query()->count())->toBe(0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games/GameRoomSharesTest.php`
Expected: FAIL — `Route [games.shares.store] not defined.`

- [ ] **Step 3: Make the room a delivery subject**

In ⚑ `app/Models/GameRoom.php`:

1. Add the imports `use App\Contracts\DeliverySubject;` and `use App\Events\Games\GameRoomChanged;` (`IntegrationDelivery` is in the same namespace).
2. Declare `class GameRoom extends Model implements DeliverySubject`.
3. Add after `guestUrl()`:

```php
    public function deliveryTeam(): Team
    {
        return $this->team;
    }

    /**
     * A job has no socket id, so the sharer's own view refreshes too.
     */
    public function announceDeliveryChange(): void
    {
        (new GameRoomChanged($this))->sendToOthers();
    }

    protected static function booted(): void
    {
        static::deleting(function (GameRoom $room): void {
            IntegrationDelivery::query()->whereMorphedTo('subject', $room)->delete();
        });
    }
```

- [ ] **Step 4: Build the invitation text**

In ⚑ `app/Actions/Integrations/BuildLinkShare.php`, add `use App\Models\GameRoom;` and the method after `pokerGame()`:

```php
    /**
     * A room invite names the room, its game and team, never the players or
     * the game state (spec 7 §3.1).
     */
    public function gameRoom(GameRoom $room, User $sharer, bool $includeGuestLink): LinkShareContent
    {
        return new LinkShareContent(
            __(':sharer invites you to play :game in ":room" (:team)', [
                'sharer' => $sharer->name,
                'game' => $room->game->label(),
                'room' => (string) $room->name,
                'team' => $room->team->name,
            ]),
            __('Join the game'),
            $includeGuestLink ? route('games.join.show', $room->guest_token) : route('games.show', $room),
        );
    }
```

- [ ] **Step 5: Write the permissions and the endpoint**

Create `app/Actions/Games/GameRoomShares.php`:

```php
<?php

namespace App\Actions\Games;

use App\Actions\Integrations\LatestDeliveries;
use App\Actions\Integrations\ShareOptions;
use App\Enums\IntegrationDeliveryKind;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

/**
 * Room managers who are team members invite (spec 7 §3.1, scope decision
 * 5): workspace Owners/Admins, and the host or creator while they belong
 * to the team. Guests and icebreaker rooms never invite.
 */
class GameRoomShares
{
    private const NoChannels = ['slack' => false, 'telegram' => false];

    public function __construct(
        private ShareOptions $shareOptions,
        private LatestDeliveries $latestDeliveries,
    ) {}

    public function canShare(GameRoom $room, GamePlayer $player): bool
    {
        if ($room->isIcebreaker() || $player->isGuest()) {
            return false;
        }

        $user = $player->account();

        if ($user === null) {
            return false;
        }

        if ($user->canManage($room->team->workspace)) {
            return true;
        }

        if (! $room->isHost($player) && ! $room->isCreator($player)) {
            return false;
        }

        return $room->team->hasMember($user);
    }

    public function ensure(GameRoom $room, GamePlayer $player): User
    {
        $user = $player->account();

        if ($user === null || ! $this->canShare($room, $player)) {
            throw new AuthorizationException(__('Only the host, the room creator or a workspace admin can invite people to this room.'));
        }

        return $user;
    }

    /**
     * @return array{slack: bool, telegram: bool}
     */
    public function availability(GameRoom $room, GamePlayer $player): array
    {
        if (! $this->canShare($room, $player)) {
            return self::NoChannels;
        }

        return $this->shareOptions->channels($room->team);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function deliveries(GameRoom $room, GamePlayer $player): array
    {
        if (! $this->canShare($room, $player)) {
            return [];
        }

        return $this->latestDeliveries->handle($room, [IntegrationDeliveryKind::GameRoomLink]);
    }
}
```

Create `app/Http/Controllers/Games/GameSharesController.php`:

```php
<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\GameGuard;
use App\Actions\Games\GameRoomShares;
use App\Actions\Integrations\BuildLinkShare;
use App\Actions\Integrations\PresentIntegrationDelivery;
use App\Actions\Integrations\QueueShare;
use App\Enums\GameRoomAccess;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class GameSharesController extends Controller
{
    public function __construct(
        private GameRoomShares $gameRoomShares,
        private QueueShare $queueShare,
        private BuildLinkShare $buildLinkShare,
        private PresentIntegrationDelivery $presentIntegrationDelivery,
    ) {}

    /**
     * A missing or lost connection answers 409 from QueueShare, as the
     * retro and poker shares do (spec 6 §13).
     */
    public function store(Request $request, GameRoom $room): JsonResponse
    {
        $player = GamePlayer::current($request);

        $validated = $request->validate([
            'channel' => ['required', Rule::enum(IntegrationDeliveryChannel::class)->only(IntegrationDeliveryChannel::shareChannels())],
            'include_guest_link' => ['sometimes', 'boolean'],
        ]);

        $channel = IntegrationDeliveryChannel::from($validated['channel']);

        abort_unless($channel->provider()?->isEnabled() ?? false, 404);

        GameGuard::standalone($room);

        $sharer = $this->gameRoomShares->ensure($room, $player);
        $includeGuestLink = $request->boolean('include_guest_link');

        if ($includeGuestLink && $room->access !== GameRoomAccess::Link) {
            throw ValidationException::withMessages(['include_guest_link' => __('Guest access is off for this room.')]);
        }

        $delivery = $this->queueShare->handle(
            $room,
            $channel,
            IntegrationDeliveryKind::GameRoomLink,
            $sharer,
            $this->buildLinkShare->gameRoom($room, $sharer, $includeGuestLink),
        );

        return response()->json($this->presentIntegrationDelivery->handle($delivery->load('requestedBy')), 202);
    }
}
```

In ⚑ `routes/web.php`, add `use App\Http\Controllers\Games\GameSharesController;` and, inside the `games/{room}` group, after the `scores` route (Task 3):

```php
        Route::post('shares', [GameSharesController::class, 'store'])->middleware('throttle:5,1')->name('games.shares.store');
```

- [ ] **Step 6: Add the snapshot keys**

In ⚑ `app/Actions/Games/BuildGameSnapshot.php`:

1. Add `private GameRoomShares $gameRoomShares,` as the last constructor parameter.
2. In the `@phpstan-type Snapshot`:
   - add ` *         teamName: ?string,` after ` *         currentRoundId: ?string` in the `room` shape (add a comma after `?string`);
   - after the `scoresResetAt` line (Task 3), add:

```php
 *     share: array{slack: bool, telegram: bool},
 *     deliveries: array<int, array<string, mixed>>,
```

3. In `handle()`, add to the `'room' => [...]` array after `'currentRoundId' => $room->current_round_id,`:

```php
                'teamName' => $isGuest ? null : $room->team->name,
```

4. After the `'scoresResetAt' => …,` entry, add:

```php
            'share' => $this->gameRoomShares->availability($room, $viewer),
            'deliveries' => $this->gameRoomShares->deliveries($room, $viewer),
```

In ⚑ `tests/Feature/Games/GameSnapshotTest.php`, test "builds the room for its host", add `'teamName' => $room->team->name,` after `'currentRoundId' => null,` in the expected `room` array.

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && vendor/bin/sail artisan test --compact tests/Feature/Games/GameRoomSharesTest.php tests/Feature/Games/GameSnapshotTest.php tests/Feature/Games/GameRoomsTest.php tests/Feature/Integrations`
Expected: PASS.

- [ ] **Step 8: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `:sharer invites you to play :game in ":room" (:team)` | `:sharer vous invite à jouer à :game dans « :room » (:team)` | `:sharer te invita a jugar a :game en «:room» (:team)` | `:sharer lädt dich ein, :game in „:room“ (:team) zu spielen` |
| `Join the game` | `Rejoindre la partie` | `Unirse a la partida` | `Am Spiel teilnehmen` |
| `Guest access is off for this room.` | `L'accès invité est désactivé pour ce salon.` | `El acceso de invitados está desactivado en esta sala.` | `Der Gastzugang ist für diesen Raum ausgeschaltet.` |
| `Only the host, the room creator or a workspace admin can invite people to this room.` | `Seuls l'hôte, la personne qui a créé le salon ou un administrateur de l'espace de travail peuvent inviter dans ce salon.` | `Solo el anfitrión, quien creó la sala o un administrador del espacio de trabajo pueden invitar a esta sala.` | `Nur der Host, die Person, die den Raum erstellt hat, oder ein Workspace-Admin kann in diesen Raum einladen.` |

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php` — Expected: PASS.

- [ ] **Step 9: Format, analyse, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Models/GameRoom.php app/Actions/Integrations/BuildLinkShare.php app/Actions/Games/GameRoomShares.php app/Http/Controllers/Games/GameSharesController.php app/Actions/Games/BuildGameSnapshot.php routes/web.php tests/Feature/Games/GameRoomSharesTest.php tests/Feature/Games/GameSnapshotTest.php lang
git commit -m "feat(games): invite Slack and Telegram to a game room

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 7: Frontend state — snapshot types, leaderboard updates and game events on the retro channel

**Files:**
- Create: `resources/js/lib/games/leaderboard.ts`
- Modify: ⚑ `resources/js/lib/games/types.ts`, ⚑ `resources/js/lib/games/room-reducer.ts`, ⚑ `resources/js/types/games.ts`, ⚑ `resources/js/lib/retro/types.ts`, ⚑ `resources/js/hooks/use-retro-channel.ts`, ⚑ `resources/js/hooks/use-retro-board.ts`, ⚑ `resources/js/components/retro/board-context.tsx`, `resources/js/components/retro/board.tsx`

**Interfaces:**
- Consumes: the payloads of Tasks 1–6; 13a/13b/13c `GameEvents`, `GameEvent`, `GameEventName` (exported by `@/hooks/use-game-channel`); 12b types `ShareAvailability`, `IntegrationDelivery` (`@/types`); 13c `GameGif`.
- Produces:
  - Types in `@/lib/games/types`:
    - `GameLeaderboardRow` (`{playerId, points, wins, roundsPlayed}`);
    - `GameSnapshot` gains `leaderboard`, `scoresResetAt`, `share`, `deliveries`;
    - `GameRoomInfo` gains `teamName: string | null`.
  - Types in `@/types`:
    - `GameLeaderboardPeriod` (`'30d' | 'all'`);
    - `TeamGameLeaderboardRow` (`{userId, name, avatarUrl, points, wins, roundsPlayed, streak}`).
  - Types in `@/lib/retro/types`:
    - `GamesPlayedPerson`, `GamesPlayedRound`, `GamesPlayedLeaderRow`, `GamesPlayed`;
    - `Results.games: GamesPlayed | null`;
    - `Snapshot.retro.icebreakerGame: GameKind`, `Snapshot.icebreaker: GameSnapshot | null`, `Snapshot.icebreakerGames: GameOption[]`.
  - `@/lib/games/leaderboard`: `rankLeaderboard(rows, players)` and `withAwardedPoints(rows, awards, players)`. The reducer's `round.ended` adds the awarded points to `snapshot.leaderboard`.
  - `useRetroChannel` listens to every `GameEvents` name on `presence-retro.{retroId}` and calls `handlers.onGameEvent`.
  - `useRetroBoard` returns `subscribeGameEvents(listener: (event: GameEvent) => void): () => void`, and `BoardContextValue` gains the same member.

There is no frontend test runner (spec §1). This task is verified by the type check and lint, and exercised by Task 8 and the walkthrough.

- [ ] **Step 1: Extend the game types**

In ⚑ `resources/js/lib/games/types.ts`:

1. Add at the top: `import type { IntegrationDelivery, ShareAvailability } from '@/types';`
2. In `GameRoomInfo`, after `currentRoundId: string | null;`, add `teamName: string | null;`.
3. Before `export type GameSnapshot`, add:

```ts
export type GameLeaderboardRow = {
    playerId: string;
    points: number;
    wins: number;
    roundsPlayed: number;
};
```

4. In `GameSnapshot`, after the last field (`serverTime`, or `emojiData` added by 13b), add:

```ts
    leaderboard: GameLeaderboardRow[];
    scoresResetAt: string | null;
    share: ShareAvailability;
    deliveries: IntegrationDelivery[];
```

In ⚑ `resources/js/types/games.ts`, append:

```ts
export type GameLeaderboardPeriod = '30d' | 'all';

export type TeamGameLeaderboardRow = {
    userId: string;
    name: string;
    avatarUrl: string;
    points: number;
    wins: number;
    roundsPlayed: number;
    streak: number;
};
```

- [ ] **Step 2: Rank the room leaderboard on the client**

Create `resources/js/lib/games/leaderboard.ts`:

```ts
import type {
    GameLeaderboardRow,
    GamePlayer,
    GamePointsAward,
} from './types';

/** Same order as the server: points, then wins, then name (spec §4.7). */
export function rankLeaderboard(
    rows: GameLeaderboardRow[],
    players: GamePlayer[],
): GameLeaderboardRow[] {
    const names = new Map(players.map((player) => [player.id, player.name]));

    return [...rows].sort(
        (first, second) =>
            second.points - first.points ||
            second.wins - first.wins ||
            (names.get(first.playerId) ?? '').localeCompare(
                names.get(second.playerId) ?? '',
            ),
    );
}

/** A round end adds one row per player who acted, 0 points included. */
export function withAwardedPoints(
    rows: GameLeaderboardRow[],
    awards: GamePointsAward[],
    players: GamePlayer[],
): GameLeaderboardRow[] {
    const byPlayer = new Map(rows.map((row) => [row.playerId, row]));

    for (const award of awards) {
        const row = byPlayer.get(award.playerId) ?? {
            playerId: award.playerId,
            points: 0,
            wins: 0,
            roundsPlayed: 0,
        };

        byPlayer.set(award.playerId, {
            ...row,
            points: row.points + award.points,
            wins: row.wins + (award.isWin ? 1 : 0),
            roundsPlayed: row.roundsPlayed + 1,
        });
    }

    return rankLeaderboard([...byPlayer.values()], players);
}
```

In ⚑ `resources/js/lib/games/room-reducer.ts`, add `import { withAwardedPoints } from './leaderboard';` and, in `case 'round.ended'`, replace the returned object:

```ts
            return {
                snapshot: { ...state.snapshot, round: null },
                lastEnded: action.ended,
            };
```

with:

```ts
            return {
                snapshot: {
                    ...state.snapshot,
                    round: null,
                    leaderboard: withAwardedPoints(
                        state.snapshot.leaderboard,
                        action.ended.points,
                        state.snapshot.players,
                    ),
                },
                lastEnded: action.ended,
            };
```

The existing guard (`lastEnded?.roundId === action.ended.roundId` → unchanged state) keeps a round's points from being added twice. The refetch that follows a broadcast `game.round.ended` replaces the leaderboard with the server's.

- [ ] **Step 3: Extend the retro types**

In ⚑ `resources/js/lib/retro/types.ts`:

1. Add at the top:

```ts
import type {
    GameGif,
    GameKind,
    GameOption,
    GameRoundOutcome,
    GameSnapshot,
} from '@/lib/games/types';
```

2. Before `export type Results`, add:

```ts
export type GamesPlayedPerson = {
    playerId: string;
    name: string;
    avatarUrl: string;
    isGuest: boolean;
};

export type GamesPlayedRound = {
    id: string;
    game: GameKind;
    outcome: GameRoundOutcome;
    word: string | null;
    question: string | null;
    clue: string[] | null;
    leader: GamesPlayedPerson | null;
    winner: GamesPlayedPerson | null;
    answers:
        | { gif: GameGif; playerId: string | null; votes: number | null }[]
        | null;
    endedAt: string;
};

export type GamesPlayedLeaderRow = GamesPlayedPerson & {
    points: number;
    wins: number;
    roundsPlayed: number;
};

export type GamesPlayed = {
    roomId: string;
    rounds: GamesPlayedRound[];
    leaderboard: GamesPlayedLeaderRow[];
    roundsPlayed: number;
};
```

3. In `Results`, replace `games: null;` with `games: GamesPlayed | null;`.
4. In the `Snapshot` type's `retro` object, after `icebreakerEnabled: boolean;`, add `icebreakerGame: GameKind;`.
5. In `Snapshot`, after `healthCheck: HealthCheckState | null;` (and after the fields Plan 12b added there), add:

```ts
    icebreaker: GameSnapshot | null;
    icebreakerGames: GameOption[];
```

- [ ] **Step 4: Listen to game events on the retro channel**

In ⚑ `resources/js/hooks/use-retro-channel.ts`:

1. Add `import type { GameEvent, GameEventName } from './use-game-channel';` (type-only: no runtime import cycle with `use-game-channel`, which imports `useSafeConnectionStatus` from this file).
2. In `RetroChannelHandlers`, add:

```ts
    /** The icebreaker's game events travel on the retro channel (spec §6). */
    gameEvents: readonly GameEventName[];
    onGameEvent: (event: GameEvent) => void;
```

3. In the effect, right after the `for (const event of RetroEvents) { … }` loop, add:

```ts
        for (const event of handlers.current.gameEvents) {
            channel.listen(`.${event}`, (payload: Record<string, unknown>) =>
                handlers.current.onGameEvent({ name: event, payload }),
            );
        }
```

In ⚑ `resources/js/hooks/use-retro-board.ts`:

1. Add `import { GameEvents, type GameEvent } from './use-game-channel';`.
2. After `const surveyRefetcher = useRef<SurveyRefetcher | null>(null);`, add:

```ts
    const gameListeners = useRef(new Set<(event: GameEvent) => void>());
```

3. Before the `useRetroChannel(` call, add:

```ts
    /** The icebreaker panel subscribes while it is mounted. */
    const subscribeGameEvents = useCallback(
        (listener: (event: GameEvent) => void) => {
            gameListeners.current.add(listener);

            return () => {
                gameListeners.current.delete(listener);
            };
        },
        [],
    );

    const onGameEvent = useCallback((event: GameEvent) => {
        for (const listener of gameListeners.current) {
            listener(event);
        }
    }, []);
```

4. In the handlers object passed to `useRetroChannel`, after `onCommentNotification,`, add:

```ts
            gameEvents: GameEvents,
            onGameEvent,
```

5. In the returned object, after `sessionExpired,`, add `subscribeGameEvents,`.

In ⚑ `resources/js/components/retro/board-context.tsx`, add `import type { GameEvent } from '@/hooks/use-game-channel';` and, in `BoardContextValue` after `markCommentsRead: (cardId: string) => void;`:

```ts
    subscribeGameEvents: (
        listener: (event: GameEvent) => void,
    ) => () => void;
```

In `resources/js/components/retro/board.tsx`, add `subscribeGameEvents,` to the destructured `useRetroBoard(snapshot)` result (after `sessionExpired,`) and to the `ctx` object (after `markCommentsRead,`).

- [ ] **Step 5: Check types and lint**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npx vp check --fix resources/js/lib/games resources/js/types/games.ts resources/js/lib/retro/types.ts resources/js/hooks/use-retro-channel.ts resources/js/hooks/use-retro-board.ts resources/js/components/retro/board-context.tsx resources/js/components/retro/board.tsx && npm run check`
Expected: no new errors. The type checker now sees `board.icebreaker` and `room.teamName` sent by Tasks 1 and 6.

- [ ] **Step 6: Commit**

```bash
git add resources/js/lib/games resources/js/types/games.ts resources/js/lib/retro/types.ts resources/js/hooks/use-retro-channel.ts resources/js/hooks/use-retro-board.ts resources/js/components/retro/board-context.tsx resources/js/components/retro/board.tsx
git commit -m "feat(games): relay icebreaker events from the retro channel

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 8: Icebreaker panel on the board and the retro's game selector

**Files:**
- Create: `resources/js/components/retro/icebreaker-game.tsx`, `resources/js/components/retro/icebreaker-stage.tsx`, `resources/js/components/retro/icebreaker-game-select.tsx`
- Modify: `resources/js/components/retro/board.tsx`, `resources/js/components/retro/phase-panel.tsx`, `resources/js/components/retro/settings-dialog.tsx`, ⚑ `resources/js/components/teams/new-retro-dialog.tsx`, ⚑ `resources/js/pages/teams/show.tsx`
- Delete: `resources/js/components/retro/icebreaker-panel.tsx`

**Interfaces:**
- Consumes:
  - Task 7: `useBoard().{board, online, presence, sessionExpired, subscribeGameEvents}`.
  - 13a: `useGameRoom(initial, {subscribe: false})`, `RoomProvider`, `RoomContextValue`, `GamePanel`, `GameSwitcher`, `HistoryDrawer`.
  - 13b: `DrawBoard` whispers through `useRoom().presence`, which is here the retro presence channel. Reverb stamps whispers with the participant id, which is the icebreaker player's `presenceId`.
  - `LiveCursorLayer({container, hidden})`; Task 2 props `icebreakerGames`.
- Produces:
  - `IcebreakerStage({hideMyCursor})`: the board area of the Icebreaker phase, with cursors on top.
  - `IcebreakerGame({snapshot})`: a `RoomProvider` fed by the board. It replaces its snapshot when the board refetches, follows `retro.timerEndsAt` and receives game events relayed by Task 7.
  - `IcebreakerGameSelect({id, value, options, disabled?, onChange})`.
  - The new-retro form field `icebreaker_game`; the settings dialog change `icebreaker_game`.

- [ ] **Step 1: Write the embedded game**

Create `resources/js/components/retro/icebreaker-game.tsx`:

```tsx
import { useEffect } from 'react';
import { GamePanel } from '@/components/games/game-panel';
import { GameSwitcher } from '@/components/games/game-switcher';
import { HistoryDrawer } from '@/components/games/history-drawer';
import {
    RoomProvider,
    type RoomContextValue,
} from '@/components/games/room-context';
import { Badge } from '@/components/ui/badge';
import { useGameRoom } from '@/hooks/use-game-room';
import { useTrans } from '@/hooks/use-trans';
import type { GameSnapshot } from '@/lib/games/types';
import { useBoard } from './board-context';

/**
 * The retro's presence channel carries the game: its members are
 * participants, which are the icebreaker players' presence ids, so live
 * strokes and cursors share one channel (spec §6).
 */
export function IcebreakerGame({ snapshot }: { snapshot: GameSnapshot }) {
    const board = useBoard();
    const { t } = useTrans();
    const room = useGameRoom(snapshot, { subscribe: false });
    const { subscribeGameEvents } = board;
    const { handleEvent, apply } = room;
    const timerEndsAt = board.board.retro.timerEndsAt;

    useEffect(
        () => subscribeGameEvents(handleEvent),
        [subscribeGameEvents, handleEvent],
    );

    useEffect(() => {
        apply({ type: 'replace', snapshot });
    }, [snapshot, apply]);

    useEffect(() => {
        apply({ type: 'timer.set', timerEndsAt });
    }, [timerEndsAt, apply]);

    const ctx: RoomContextValue = {
        snapshot: room.state.snapshot,
        lastEnded: room.state.lastEnded,
        dispatch: room.dispatch,
        apply: room.apply,
        run: room.run,
        handleError: room.handleError,
        refetch: room.refetch,
        online: board.online,
        presence: board.presence,
        serverOffset: room.serverOffset,
        sessionExpired: board.sessionExpired || room.sessionExpired,
    };
    const { room: info, games } = room.state.snapshot;
    const gameLabel =
        games.find((option) => option.value === info.game)?.label ??
        info.game;

    return (
        <RoomProvider value={ctx}>
            <section
                aria-label={t('Icebreaker game')}
                className="flex flex-1 flex-col"
            >
                <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
                    <h2 className="text-sm font-semibold">{t('Icebreaker')}</h2>
                    {info.isHost ? (
                        <GameSwitcher />
                    ) : (
                        <Badge variant="outline">{gameLabel}</Badge>
                    )}
                    <div className="ml-auto">
                        <HistoryDrawer />
                    </div>
                </div>
                <GamePanel />
            </section>
        </RoomProvider>
    );
}
```

Create `resources/js/components/retro/icebreaker-stage.tsx`:

```tsx
import { useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { useBoard } from './board-context';
import { IcebreakerGame } from './icebreaker-game';
import { LiveCursorLayer } from './live-cursor-layer';

/** The board area during the Icebreaker phase: the game instead of columns. */
export function IcebreakerStage({ hideMyCursor }: { hideMyCursor: boolean }) {
    const { board } = useBoard();
    const [element, setElement] = useState<HTMLElement | null>(null);

    if (board.icebreaker === null) {
        return (
            <div className="flex flex-1 items-center justify-center p-8">
                <Spinner />
            </div>
        );
    }

    return (
        <main ref={setElement} className="relative flex flex-1 flex-col">
            <IcebreakerGame
                key={board.icebreaker.room.id}
                snapshot={board.icebreaker}
            />
            <LiveCursorLayer container={element} hidden={hideMyCursor} />
        </main>
    );
}
```

- [ ] **Step 2: Show it on the board**

In `resources/js/components/retro/board.tsx`, add `import { IcebreakerStage } from './icebreaker-stage';` and replace:

```tsx
                                    <ResultsView />
                                </div>
                            ) : (
```

with:

```tsx
                                    <ResultsView />
                                </div>
                            ) : board.retro.phase === 'icebreaker' ? (
                                <IcebreakerStage hideMyCursor={hideMyCursor} />
                            ) : (
```

Replace `resources/js/components/retro/phase-panel.tsx` with:

```tsx
import { useBoard } from './board-context';
import { HealthCheckPanel } from './health-check-panel';

export function PhasePanel() {
    const { board } = useBoard();

    switch (board.retro.phase) {
        case 'health_check':
            return <HealthCheckPanel />;
        default:
            return null;
    }
}
```

Delete `resources/js/components/retro/icebreaker-panel.tsx` (spec 2's "Warm-up" placeholder, replaced by the game panel):

```bash
git rm resources/js/components/retro/icebreaker-panel.tsx
```

- [ ] **Step 3: Write the game selector**

Create `resources/js/components/retro/icebreaker-game-select.tsx`:

```tsx
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type { GameKind, GameOption } from '@/lib/games/types';

type Props = {
    id: string;
    value: GameKind;
    options: GameOption[];
    disabled?: boolean;
    onChange: (game: GameKind) => void;
};

export function IcebreakerGameSelect({
    id,
    value,
    options,
    disabled = false,
    onChange,
}: Props) {
    const { t } = useTrans();
    const shown = options.filter(
        (option) => option.available || option.value === value,
    );

    return (
        <div className="grid gap-1 pl-6">
            <Label htmlFor={id}>{t('Icebreaker game')}</Label>
            <Select
                value={value}
                disabled={disabled}
                onValueChange={(next) => onChange(next as GameKind)}
            >
                <SelectTrigger id={id} className="w-56">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {shown.map((option) => (
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
        </div>
    );
}
```

- [ ] **Step 4: Offer it in the settings dialog**

In `resources/js/components/retro/settings-dialog.tsx`:

1. Add `import { IcebreakerGameSelect } from './icebreaker-game-select';`.
2. After the `icebreakerEnabled` state, add:

```tsx
    const [icebreakerGame, setIcebreakerGame] = useState(retro.icebreakerGame);
```

3. In `save`, after the `icebreaker_enabled` block, add:

```tsx
        if (icebreakerGame !== retro.icebreakerGame) {
            changes.icebreaker_game = icebreakerGame;
        }
```

4. Right after the `retro-icebreaker` `SettingCheckbox`, add:

```tsx
                {icebreakerEnabled && (
                    <IcebreakerGameSelect
                        id="retro-icebreaker-game"
                        value={icebreakerGame}
                        options={ctx.board.icebreakerGames}
                        disabled={engagementLocked}
                        onChange={setIcebreakerGame}
                    />
                )}
```

- [ ] **Step 5: Offer it when creating a retro**

In ⚑ `resources/js/components/teams/new-retro-dialog.tsx`:

1. Add `import { IcebreakerGameSelect } from '@/components/retro/icebreaker-game-select';` and `import type { GameKind, GameOption } from '@/lib/games/types';`.
2. Add `icebreakerGames: GameOption[];` to `Props`, and `icebreaker_game: GameKind;` to `RetroForm` after `icebreaker_enabled: boolean;`.
3. Add `icebreakerGames,` to the `NewRetroForm` destructuring (after `llm,`) and, in the `useForm` initial data after `icebreaker_enabled: false,`:

```tsx
        icebreaker_game: 'draw',
```

4. After the `new-retro-icebreaker` checkbox `<div>`, add:

```tsx
                    {form.data.icebreaker_enabled && (
                        <IcebreakerGameSelect
                            id="new-retro-icebreaker-game"
                            value={form.data.icebreaker_game}
                            options={icebreakerGames}
                            onChange={(game) =>
                                form.setData('icebreaker_game', game)
                            }
                        />
                    )}
                    <InputError message={form.errors.icebreaker_game} />
```

In ⚑ `resources/js/pages/teams/show.tsx`:
- add `icebreakerGames: GameOption[];` to the page `Props` (import `GameOption` from `@/types`) and to the destructured props;
- pass `icebreakerGames={icebreakerGames}` to `<NewRetroDialog …/>`.

- [ ] **Step 6: Check types, lint and build**

Run: `npm run types:check && npx vp check --fix resources/js/components/retro resources/js/components/teams/new-retro-dialog.tsx resources/js/pages/teams/show.tsx && npm run check && npm run build`
Expected: no new errors; the build succeeds.

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php` — Expected: PASS after Step 7.

- [ ] **Step 7: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `Icebreaker game` | `Jeu de l'icebreaker` | `Juego del rompehielos` | `Eisbrecher-Spiel` |

Check the `Icebreaker` key already used by spec 2 (`grep '"Icebreaker"' lang/*.json`) and reuse its word in fr/es/de if it differs from the table above, so both strings name the phase the same way.

- [ ] **Step 8: Commit**

```bash
git add resources/js/components/retro resources/js/components/teams/new-retro-dialog.tsx resources/js/pages/teams/show.tsx lang
git commit -m "feat(games): play the icebreaker game on the retro board

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 9: Scores UI — Scores tab, reset, "+n" on the round end card, team leaderboard panel

**Files:**
- Create: `resources/js/components/games/room-sidebar.tsx`, `resources/js/components/games/room-scores.tsx`, `resources/js/components/games/reset-scores-dialog.tsx`, `resources/js/components/games/round-points.tsx`, `resources/js/components/games/team-leaderboard.tsx`
- Modify: ⚑ `resources/js/components/games/game-panel.tsx`, ⚑ `resources/js/components/games/round-end-card.tsx`, ⚑ `resources/js/pages/games/index.tsx`

**Interfaces:**
- Consumes: Task 7 types; `useRoom()`; Wayfinder `@/actions/App/Http/Controllers/Games/GameScoresController` (`destroy`); Inertia `Deferred`, `router`; UI `ToggleGroup`, `ToggleGroupItem`, `Skeleton`, `Badge`, `Dialog`; props `period` and `leaderboard` of `games/index` (Task 4).
- Produces:
  - `RoomSidebar({highlightPlayerId})` with two tabs, "Players" (13a's `PlayersList`) and "Scores" (`RoomScores`). It is used by `GamePanel` in rooms and in the icebreaker.
  - `ResetScoresDialog`.
  - `RoundPoints({points})`, which shows "+n name" per player who scored, on the round end card for every game except Sprint in one GIF (13c's `GifRoundResults` already shows "+n" per author).
  - `TeamLeaderboard({leaderboard, period})`: a period toggle, a deferred list with skeleton, an empty state, a rescue with retry, and the streak badge.

- [ ] **Step 1: Write the Scores tab and the reset**

Create `resources/js/components/games/reset-scores-dialog.tsx`:

```tsx
import { useState } from 'react';
import GameScoresController from '@/actions/App/Http/Controllers/Games/GameScoresController';
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
import { useRoom } from './room-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function ResetScoresDialog({ open, onOpenChange }: Props) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);

    const reset = async () => {
        setBusy(true);

        const result = await ctx.run(
            retroRequest(GameScoresController.destroy(ctx.snapshot.room.id)),
        );

        setBusy(false);

        if (result === undefined) {
            return;
        }

        await ctx.refetch();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogTitle>{t('Reset scores')}</DialogTitle>
                <DialogDescription>
                    {t(
                        'Scores in this room start again from zero. The team leaderboard keeps them.',
                    )}
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
                        type="button"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void reset()}
                    >
                        {t('Reset scores')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
```

Create `resources/js/components/games/room-scores.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { ResetScoresDialog } from './reset-scores-dialog';
import { useRoom } from './room-context';

export function RoomScores() {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const [confirming, setConfirming] = useState(false);
    const players = new Map(
        snapshot.players.map((player) => [player.id, player]),
    );
    const canReset = snapshot.room.canManage && !snapshot.room.isIcebreaker;

    return (
        <div className="space-y-3">
            {snapshot.leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {t('No points yet.')}
                </p>
            ) : (
                <ol className="space-y-1">
                    {snapshot.leaderboard.map((row, index) => {
                        const player = players.get(row.playerId);

                        return (
                            <li
                                key={row.playerId}
                                className="flex items-center gap-2 rounded-md px-2 py-1 text-sm"
                            >
                                <span className="w-5 text-right text-muted-foreground tabular-nums">
                                    {index + 1}
                                </span>
                                {player && (
                                    <img
                                        src={player.avatarUrl}
                                        alt=""
                                        className="size-6 rounded-full bg-muted"
                                    />
                                )}
                                <span className="min-w-0 flex-1 truncate">
                                    {player?.name ?? t('Former member')}
                                    {player?.isGuest && (
                                        <span className="text-muted-foreground">
                                            {' '}
                                            {t('(guest)')}
                                        </span>
                                    )}
                                </span>
                                <span
                                    className="font-semibold tabular-nums"
                                    aria-label={t(':count points', {
                                        count: row.points,
                                    })}
                                >
                                    {row.points}
                                </span>
                            </li>
                        );
                    })}
                </ol>
            )}
            {canReset && (
                <>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirming(true)}
                    >
                        {t('Reset scores')}
                    </Button>
                    <ResetScoresDialog
                        open={confirming}
                        onOpenChange={setConfirming}
                    />
                </>
            )}
        </div>
    );
}
```

Create `resources/js/components/games/room-sidebar.tsx`:

```tsx
import { useId, useState } from 'react';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { PlayersList } from './players-list';
import { RoomScores } from './room-scores';

type Tab = 'players' | 'scores';

export function RoomSidebar({
    highlightPlayerId,
}: {
    highlightPlayerId: string | null;
}) {
    const { t } = useTrans();
    const id = useId();
    const [tab, setTab] = useState<Tab>('players');
    const tabs: { value: Tab; label: string }[] = [
        { value: 'players', label: t('Players') },
        { value: 'scores', label: t('Scores') },
    ];

    return (
        <div className="space-y-3">
            <div role="tablist" className="flex gap-1 rounded-md bg-muted p-1">
                {tabs.map((item) => (
                    <button
                        key={item.value}
                        type="button"
                        role="tab"
                        id={`${id}-${item.value}`}
                        aria-selected={tab === item.value}
                        aria-controls={`${id}-panel`}
                        className={cn(
                            'flex-1 rounded px-2 py-1 text-sm',
                            tab === item.value && 'bg-background shadow-sm',
                        )}
                        onClick={() => setTab(item.value)}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
            <div
                role="tabpanel"
                id={`${id}-panel`}
                aria-labelledby={`${id}-${tab}`}
            >
                {tab === 'players' ? (
                    <PlayersList highlightPlayerId={highlightPlayerId} />
                ) : (
                    <RoomScores />
                )}
            </div>
        </div>
    );
}
```

In ⚑ `resources/js/components/games/game-panel.tsx`, replace `import { PlayersList } from './players-list';` with `import { RoomSidebar } from './room-sidebar';` and the `<PlayersList … />` element inside `<aside>` with:

```tsx
                <RoomSidebar
                    highlightPlayerId={
                        round ? null : (lastEnded?.winnerPlayerId ?? null)
                    }
                />
```

- [ ] **Step 2: Show the points on the round end card**

Create `resources/js/components/games/round-points.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import type { GamePointsAward } from '@/lib/games/types';
import { useRoom } from './room-context';

export function RoundPoints({ points }: { points: GamePointsAward[] }) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const names = new Map(
        snapshot.players.map((player) => [player.id, player.name]),
    );
    const scored = points.filter((award) => award.points > 0);

    if (scored.length === 0) {
        return null;
    }

    return (
        <ul
            className="flex flex-wrap justify-center gap-2"
            aria-label={t('Points of this round')}
        >
            {scored.map((award) => (
                <li key={award.playerId}>
                    <Badge variant="secondary">
                        {t('+:points :name', {
                            points: award.points,
                            name: names.get(award.playerId) ?? t('Someone'),
                        })}
                    </Badge>
                </li>
            ))}
        </ul>
    );
}
```

In ⚑ `resources/js/components/games/round-end-card.tsx`, add `import { RoundPoints } from './round-points';` and insert right before `<StartRoundControls label={t('Next round')} />`:

```tsx
            {lastEnded && !lastEnded.answers && (
                <RoundPoints points={lastEnded.points} />
            )}
```

- [ ] **Step 3: Write the team leaderboard panel**

Create `resources/js/components/games/team-leaderboard.tsx`:

```tsx
import { Deferred, router } from '@inertiajs/react';
import { Flame } from 'lucide-react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTrans } from '@/hooks/use-trans';
import type { GameLeaderboardPeriod, TeamGameLeaderboardRow } from '@/types';

type Props = {
    leaderboard?: TeamGameLeaderboardRow[];
    period: GameLeaderboardPeriod;
};

const StreakBadgeFrom = 2;

export function TeamLeaderboard({ leaderboard, period }: Props) {
    const { t } = useTrans();

    const choose = (next: string) => {
        if (next !== '30d' && next !== 'all') {
            return;
        }

        router.reload({
            data: { period: next },
            only: ['period', 'leaderboard'],
        });
    };

    return (
        <section className="space-y-3" aria-labelledby="team-leaderboard">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div id="team-leaderboard">
                    <Heading variant="small" title={t('Leaderboard')} />
                </div>
                <ToggleGroup
                    type="single"
                    size="sm"
                    variant="outline"
                    value={period}
                    onValueChange={choose}
                    aria-label={t('Period')}
                >
                    <ToggleGroupItem value="30d">
                        {t('Last 30 days')}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="all">{t('All time')}</ToggleGroupItem>
                </ToggleGroup>
            </div>
            <Deferred
                data="leaderboard"
                fallback={<LeaderboardSkeleton />}
                rescue={
                    <p className="text-sm text-muted-foreground">
                        {t('Could not load the leaderboard.')}{' '}
                        <Button
                            variant="link"
                            className="h-auto p-0"
                            onClick={() =>
                                router.reload({ only: ['leaderboard'] })
                            }
                        >
                            {t('Try again')}
                        </Button>
                    </p>
                }
            >
                <LeaderboardRows rows={leaderboard ?? []} />
            </Deferred>
        </section>
    );
}

function LeaderboardSkeleton() {
    return (
        <div className="space-y-2" aria-hidden>
            {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-9 w-full animate-pulse" />
            ))}
        </div>
    );
}

function LeaderboardRows({ rows }: { rows: TeamGameLeaderboardRow[] }) {
    const { t } = useTrans();

    if (rows.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                {t('No games played yet.')}
            </p>
        );
    }

    return (
        <ol className="divide-y rounded-md border">
            {rows.map((row, index) => (
                <li
                    key={row.userId}
                    className="flex items-center gap-3 p-2 text-sm"
                >
                    <span className="w-6 text-right text-muted-foreground tabular-nums">
                        {index + 1}
                    </span>
                    <img
                        src={row.avatarUrl}
                        alt=""
                        className="size-7 rounded-full bg-muted"
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                        {row.name}
                    </span>
                    {row.streak >= StreakBadgeFrom && (
                        <Badge variant="outline" className="gap-1">
                            <Flame className="size-3.5 text-orange-500" />
                            {t(':count-week streak', { count: row.streak })}
                        </Badge>
                    )}
                    <span className="hidden text-muted-foreground sm:inline">
                        {t(':wins wins · :rounds rounds', {
                            wins: row.wins,
                            rounds: row.roundsPlayed,
                        })}
                    </span>
                    <span className="w-12 text-right font-semibold tabular-nums">
                        {row.points}
                    </span>
                </li>
            ))}
        </ol>
    );
}
```

In ⚑ `resources/js/pages/games/index.tsx`:

1. Add `import { TeamLeaderboard } from '@/components/games/team-leaderboard';` and extend the `@/types` import with `GameLeaderboardPeriod` and `TeamGameLeaderboardRow`.
2. Add to `Props`:

```tsx
    period: GameLeaderboardPeriod;
    leaderboard?: TeamGameLeaderboardRow[];
```

3. Add `period` and `leaderboard` to the destructured props.
4. Insert after the rooms `<section>`:

```tsx
                <TeamLeaderboard leaderboard={leaderboard} period={period} />
```

- [ ] **Step 4: Check types, lint and build**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npx vp check --fix resources/js/components/games resources/js/pages/games/index.tsx && npm run check && npm run build`
Expected: no new errors; the build succeeds.

- [ ] **Step 5: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `Scores` | `Scores` | `Puntuaciones` | `Punkte` |
| `No points yet.` | `Pas encore de points.` | `Todavía no hay puntos.` | `Noch keine Punkte.` |
| `Reset scores` | `Remettre les scores à zéro` | `Reiniciar las puntuaciones` | `Punkte zurücksetzen` |
| `Scores in this room start again from zero. The team leaderboard keeps them.` | `Les scores de ce salon repartent de zéro. Le classement de l'équipe les conserve.` | `Las puntuaciones de esta sala vuelven a cero. La clasificación del equipo las conserva.` | `Die Punkte in diesem Raum beginnen wieder bei null. Die Rangliste des Teams behält sie.` |
| `:count points` | `:count points` | `:count puntos` | `:count Punkte` |
| `Points of this round` | `Points de cette manche` | `Puntos de esta ronda` | `Punkte dieser Runde` |
| `+:points :name` | `+:points :name` | `+:points :name` | `+:points :name` |
| `Leaderboard` | `Classement` | `Clasificación` | `Rangliste` |
| `Period` | `Période` | `Periodo` | `Zeitraum` |
| `Last 30 days` | `30 derniers jours` | `Últimos 30 días` | `Letzte 30 Tage` |
| `All time` | `Depuis le début` | `Desde siempre` | `Gesamte Zeit` |
| `Could not load the leaderboard.` | `Impossible de charger le classement.` | `No se pudo cargar la clasificación.` | `Die Rangliste konnte nicht geladen werden.` |
| `Try again` | `Réessayer` | `Reintentar` | `Erneut versuchen` |
| `No games played yet.` | `Aucune partie jouée pour l'instant.` | `Todavía no se ha jugado ninguna partida.` | `Noch keine Spiele gespielt.` |
| `:count-week streak` | `:count semaines d'affilée` | `:count semanas seguidas` | `:count Wochen in Folge` |
| `:wins wins · :rounds rounds` | `:wins victoires · :rounds manches` | `:wins victorias · :rounds rondas` | `:wins Siege · :rounds Runden` |

(`Players`, `(guest)`, `Someone`, `Former member` and `Cancel` already exist; add them only if missing.)

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php tests/Feature/Games/GamePagesTest.php` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add resources/js/components/games resources/js/pages/games/index.tsx lang
git commit -m "feat(games): show room scores and the team leaderboard

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 10: "Games we played" in the Results view

**Files:**
- Create: `resources/js/components/retro/results/games-played-section.tsx`, `resources/js/components/retro/results/games-played-round.tsx`, `resources/js/components/retro/results/games-played-podium.tsx`, `resources/js/components/retro/results/round-replay-dialog.tsx`
- Modify: `resources/js/components/retro/results/results-view.tsx`

**Interfaces:**
- Consumes:
  - Task 7 types `GamesPlayed`, `GamesPlayedRound`, `GamesPlayedLeaderRow`.
  - 13a `outcomeLabel`, Wayfinder `Games/GameRoundsController.show`, type `GameRoundDetail`.
  - 13b `DrawingCanvas({ops, label})` and `ClueRow({clue})`, both usable outside a `RoomProvider`.
  - 13c `GifTile({gif, caption})`.
  - `useBoard()`, `ResultsSection`.
- Produces: `GamesPlayedSection({games})`, shown after Action items and before ROTI when `results.games` is not null, for every viewer, guests included.

- [ ] **Step 1: Write the round replay**

Create `resources/js/components/retro/results/round-replay-dialog.tsx`:

```tsx
import { useEffect, useState } from 'react';
import GameRoundsController from '@/actions/App/Http/Controllers/Games/GameRoundsController';
import { DrawingCanvas } from '@/components/games/drawing-canvas';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import type { GameRoundDetail } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useBoard } from '../board-context';

type Props = {
    roomId: string;
    roundId: string | null;
    onClose: () => void;
};

/**
 * Drawings are not part of the results payload: the round detail endpoint
 * resolves the viewer as a player of the icebreaker room (spec §6.1).
 */
export function RoundReplayDialog({ roomId, roundId, onClose }: Props) {
    const { handleError } = useBoard();
    const { t } = useTrans();
    const [detail, setDetail] = useState<GameRoundDetail | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (roundId === null) {
            return;
        }

        let isCurrent = true;

        setDetail(null);
        setError(null);

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

    return (
        <Dialog
            open={roundId !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent aria-describedby={undefined} className="sm:max-w-2xl">
                <DialogTitle>{t('Replay')}</DialogTitle>
                {error !== null ? (
                    <p className="text-sm text-destructive">{error}</p>
                ) : detail === null ? (
                    <Spinner />
                ) : (
                    <div className="space-y-2">
                        <DrawingCanvas
                            ops={detail.drawing ?? []}
                            label={t('Drawing of :word', {
                                word: detail.word ?? '',
                            })}
                        />
                        {detail.word && (
                            <p className="text-center text-xl font-semibold">
                                {detail.word}
                            </p>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: Write the round row and the podium**

Create `resources/js/components/retro/results/games-played-round.tsx`:

```tsx
import { Brush, Image, Smile, SpellCheck, type LucideIcon } from 'lucide-react';
import { ClueRow } from '@/components/games/clue-row';
import { GifTile } from '@/components/games/gif-tile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { outcomeLabel } from '@/lib/games/outcomes';
import type { GameKind } from '@/lib/games/types';
import type { GamesPlayedPerson, GamesPlayedRound } from '@/lib/retro/types';

const GameIcons: Record<GameKind, LucideIcon> = {
    draw: Brush,
    gif: Image,
    hangman: SpellCheck,
    decoded: Smile,
};

type Props = {
    round: GamesPlayedRound;
    names: Map<string, string>;
    onReplay: (roundId: string) => void;
};

function Person({ person, label }: { person: GamesPlayedPerson; label: string }) {
    return (
        <span className="inline-flex items-center gap-1" title={label}>
            <img
                src={person.avatarUrl}
                alt=""
                className="size-5 rounded-full bg-muted"
            />
            <span className="sr-only">{label}</span>
            <span aria-hidden>{person.name}</span>
        </span>
    );
}

export function GamesPlayedRound({ round, names, onReplay }: Props) {
    const { t } = useTrans();
    const Icon = GameIcons[round.game];

    return (
        <li className="space-y-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
                <Icon className="size-4 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium">
                    {round.word ?? round.question ?? '—'}
                </span>
                <Badge variant="secondary">
                    {outcomeLabel(round.outcome, t)}
                </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {round.leader && (
                    <Person
                        person={round.leader}
                        label={t('Led by :name', { name: round.leader.name })}
                    />
                )}
                {round.winner && (
                    <Person
                        person={round.winner}
                        label={t(':name found it!', { name: round.winner.name })}
                    />
                )}
                {round.game === 'draw' && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReplay(round.id)}
                    >
                        {t('Replay')}
                    </Button>
                )}
            </div>
            {round.clue && round.clue.length > 0 && <ClueRow clue={round.clue} />}
            {round.answers && round.answers.length > 0 && (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {round.answers.map((answer) => (
                        <li key={answer.gif.id}>
                            <GifTile
                                gif={answer.gif}
                                caption={
                                    answer.playerId === null
                                        ? t('Anonymous GIF')
                                        : t('by :name', {
                                              name:
                                                  names.get(answer.playerId) ??
                                                  t('Someone'),
                                          })
                                }
                            >
                                {typeof answer.votes === 'number' && (
                                    <p className="text-center text-xs text-muted-foreground">
                                        {t('Votes: :count', {
                                            count: answer.votes,
                                        })}
                                    </p>
                                )}
                            </GifTile>
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
}
```

Create `resources/js/components/retro/results/games-played-podium.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { GamesPlayedLeaderRow } from '@/lib/retro/types';

const PodiumSize = 3;

export function GamesPlayedPodium({
    leaderboard,
}: {
    leaderboard: GamesPlayedLeaderRow[];
}) {
    const { t } = useTrans();
    const [showAll, setShowAll] = useState(false);
    const shown = showAll ? leaderboard : leaderboard.slice(0, PodiumSize);

    if (leaderboard.length === 0) {
        return null;
    }

    return (
        <div className="space-y-2">
            <ol className="grid gap-2 sm:grid-cols-3">
                {shown.map((row, index) => (
                    <li
                        key={row.playerId}
                        className="flex items-center gap-2 rounded-lg border p-2 text-sm"
                    >
                        <span className="w-5 text-right font-semibold text-muted-foreground tabular-nums">
                            {index + 1}
                        </span>
                        <img
                            src={row.avatarUrl}
                            alt=""
                            className="size-7 rounded-full bg-muted"
                        />
                        <span className="min-w-0 flex-1 truncate">
                            {row.name}
                            {row.isGuest && (
                                <span className="text-muted-foreground">
                                    {' '}
                                    {t('(guest)')}
                                </span>
                            )}
                        </span>
                        <span className="font-semibold tabular-nums">
                            {t(':count points', { count: row.points })}
                        </span>
                    </li>
                ))}
            </ol>
            {leaderboard.length > PodiumSize && (
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAll((current) => !current)}
                >
                    {showAll ? t('Show less') : t('Show all')}
                </Button>
            )}
        </div>
    );
}
```

- [ ] **Step 3: Write the section and mount it**

Create `resources/js/components/retro/results/games-played-section.tsx`:

```tsx
import { useState } from 'react';
import { useTrans } from '@/hooks/use-trans';
import type { GamesPlayed } from '@/lib/retro/types';
import { GamesPlayedPodium } from './games-played-podium';
import { GamesPlayedRound } from './games-played-round';
import { ResultsSection } from './results-section';
import { RoundReplayDialog } from './round-replay-dialog';

export function GamesPlayedSection({ games }: { games: GamesPlayed }) {
    const { t } = useTrans();
    const [replayed, setReplayed] = useState<string | null>(null);
    const names = new Map(
        games.leaderboard.map((row) => [row.playerId, row.name]),
    );

    for (const round of games.rounds) {
        for (const person of [round.leader, round.winner]) {
            if (person) {
                names.set(person.playerId, person.name);
            }
        }
    }

    return (
        <ResultsSection title={t('Games we played')}>
            <p className="text-sm text-muted-foreground">
                {t(':count rounds played', { count: games.roundsPlayed })}
            </p>
            <GamesPlayedPodium leaderboard={games.leaderboard} />
            <ol className="space-y-2">
                {games.rounds.map((round) => (
                    <GamesPlayedRound
                        key={round.id}
                        round={round}
                        names={names}
                        onReplay={setReplayed}
                    />
                ))}
            </ol>
            <RoundReplayDialog
                roomId={games.roomId}
                roundId={replayed}
                onClose={() => setReplayed(null)}
            />
        </ResultsSection>
    );
}
```

In `resources/js/components/retro/results/results-view.tsx`, add `import { GamesPlayedSection } from './games-played-section';` and insert between `<ActionItemsResults />` and `<RotiSection roti={results.roti} />`:

```tsx
            {results.games && <GamesPlayedSection games={results.games} />}
```

- [ ] **Step 4: Check types, lint and build**

Run: `npm run types:check && npx vp check --fix resources/js/components/retro/results && npm run check && npm run build`
Expected: no new errors; the build succeeds.

If `ClueRow` or `DrawingCanvas` read `useRoom()` (they should not: Plan 13b's contract says the replay reuses `DrawingCanvas` read-only and `ClueRow` takes its clue as a prop), wrap nothing. Instead, fix the component in the task that owns it so it takes what it needs as props.

- [ ] **Step 5: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `Games we played` | `Nos jeux` | `Los juegos que jugamos` | `Unsere Spiele` |
| `:count rounds played` | `:count manches jouées` | `:count rondas jugadas` | `:count gespielte Runden` |
| `Replay` | `Revoir` | `Volver a ver` | `Wiederholung` |
| `Show all` | `Tout afficher` | `Mostrar todo` | `Alle anzeigen` |
| `Show less` | `Afficher moins` | `Mostrar menos` | `Weniger anzeigen` |

(`Led by :name`, `:name found it!`, `Anonymous GIF`, `by :name`, `Votes: :count`, `Drawing of :word`, `Someone`, `(guest)` and `:count points` come from Plans 13a–13c and Task 9; add them only if missing.)

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add resources/js/components/retro/results lang
git commit -m "feat(games): show the games played in the retro results

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 11: Room invite picker in the room header

**Files:**
- Create: `resources/js/components/games/room-invite-button.tsx`, `resources/js/components/games/room-invite-dialog.tsx`
- Modify: ⚑ `resources/js/components/games/room-header.tsx`

**Interfaces:**
- Consumes: Plan 12b `<PostLinkSection availability guestLinkAvailable guestLinkLabel deliveries onPost hint? />`, types `IntegrationDelivery`, `ShareChannel`; Wayfinder `@/actions/App/Http/Controllers/Games/GameSharesController` (`store`); `useRoom()` (`snapshot.{room, share, deliveries}`, `run`, `refetch`).
- Produces: `RoomInviteButton()`, rendered in the header only when the viewer may invite on at least one channel. It opens `RoomInviteDialog({open, onOpenChange})`.

- [ ] **Step 1: Write the dialog and the button**

Create `resources/js/components/games/room-invite-dialog.tsx`:

```tsx
import GameSharesController from '@/actions/App/Http/Controllers/Games/GameSharesController';
import { PostLinkSection } from '@/components/integrations/share/post-link-section';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { IntegrationDelivery, ShareChannel } from '@/types';
import { useRoom } from './room-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function RoomInviteDialog({ open, onOpenChange }: Props) {
    const ctx = useRoom();
    const { t } = useTrans();
    const { room, share, deliveries } = ctx.snapshot;
    const isLinkRoom = room.access === 'link';

    const post = async (
        channel: ShareChannel,
        includeGuestLink: boolean,
    ): Promise<boolean> => {
        const delivery = await ctx.run(
            retroRequest<IntegrationDelivery>(
                GameSharesController.store(room.id),
                { channel, include_guest_link: includeGuestLink },
            ),
        );

        if (delivery === undefined) {
            return false;
        }

        await ctx.refetch();

        return true;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined}>
                <DialogTitle>{t('Invite to the room')}</DialogTitle>
                <PostLinkSection
                    availability={share}
                    guestLinkAvailable={isLinkRoom}
                    guestLinkLabel={t(
                        'Include the guest link (anyone who can see the message can join)',
                    )}
                    deliveries={deliveries}
                    onPost={post}
                    hint={
                        isLinkRoom
                            ? t(
                                  'Posted guest links stop working if you regenerate the link.',
                              )
                            : t('Only members of :team can join.', {
                                  team: room.teamName ?? '',
                              })
                    }
                />
            </DialogContent>
        </Dialog>
    );
}
```

Create `resources/js/components/games/room-invite-button.tsx`:

```tsx
import { Send } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { useRoom } from './room-context';
import { RoomInviteDialog } from './room-invite-dialog';

export function RoomInviteButton() {
    const { snapshot, sessionExpired } = useRoom();
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const canInvite = snapshot.share.slack || snapshot.share.telegram;

    if (!canInvite) {
        return null;
    }

    return (
        <>
            <Button
                size="sm"
                variant="outline"
                disabled={sessionExpired}
                onClick={() => setOpen(true)}
            >
                <Send className="size-4" />
                {t('Invite')}
            </Button>
            <RoomInviteDialog open={open} onOpenChange={setOpen} />
        </>
    );
}
```

In ⚑ `resources/js/components/games/room-header.tsx`, add `import { RoomInviteButton } from './room-invite-button';` and insert `<RoomInviteButton />` right before `<RoomMenu />`.

- [ ] **Step 2: Check types, lint and build**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npx vp check --fix resources/js/components/games && npm run check && npm run build`
Expected: no new errors; the build succeeds.

- [ ] **Step 3: Translations**

| Key (en) | fr | es | de |
|---|---|---|---|
| `Invite` | `Inviter` | `Invitar` | `Einladen` |
| `Invite to the room` | `Inviter dans le salon` | `Invitar a la sala` | `In den Raum einladen` |
| `Include the guest link (anyone who can see the message can join)` | `Inclure le lien invité (toute personne qui voit le message peut rejoindre)` | `Incluir el enlace de invitado (cualquiera que vea el mensaje puede unirse)` | `Gastlink einfügen (alle, die die Nachricht sehen, können beitreten)` |
| `Posted guest links stop working if you regenerate the link.` | `Les liens invités publiés ne fonctionnent plus si vous régénérez le lien.` | `Los enlaces de invitado publicados dejan de funcionar si regeneras el enlace.` | `Gepostete Gastlinks funktionieren nicht mehr, wenn du den Link neu erzeugst.` |
| `Only members of :team can join.` | `Seuls les membres de :team peuvent rejoindre.` | `Solo los miembros de :team pueden unirse.` | `Nur Mitglieder von :team können beitreten.` |

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add resources/js/components/games lang
git commit -m "feat(games): invite the team's chat from the room header

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 12: Verification (controller-driven) and the spec 7 walkthrough

**Files:** none (fix only what the checks reveal, in the task that owns the code).

- [ ] **Step 1: Run the plan's suites**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Games tests/Feature/Retros tests/Feature/Integrations tests/Feature/TranslationKeysTest.php tests/Feature/UuidPrimaryKeysTest.php`
Expected: PASS.

- [ ] **Step 2: Static checks**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
vendor/bin/sail artisan wayfinder:generate --with-form
npm run types:check && npm run check && npm run build
```

Expected: pint clean, phpstan 0 errors, no new type or lint error, build succeeds.

- [ ] **Step 3: Secrecy spot check**

Run: `vendor/bin/sail artisan test --compact --filter="Redaction|never|hides|without any game content"`
Expected: PASS. Confirms that 13a–13c's secrecy suites still pass with the icebreaker, leaderboard and invite keys added to the snapshots.

- [ ] **Step 4: Ask for the full suite**

Ask the user to run `vendor/bin/sail artisan test --compact` (the full suite) and report the result.

- [ ] **Step 5: Manual two-browser walkthrough** (spec §12; desktop + phone, a queue worker running: `vendor/bin/sail artisan queue:work`; a GIF provider key; Slack and Telegram connected through Plan 12a)

1. **Draw & Guess in a room:** live strokes appear on the other screen while drawing and match after pointer-up; a fill looks identical on both; a browser opened mid-round sees the drawing.
2. **Guesses:** a near miss is shown to everyone but flagged "Very close!" only for its author; a correct guess ends the turn without showing its text.
3. **Sprint in one GIF:** GIF answers stay hidden until the timer reveals them; both browsers vote (no self-vote); counts and "+2" appear only at close.
4. **Hangman with an accented word:** `é` is revealed by `e`.
5. **Decoded:** the clue refuses `1️⃣` with "Use emoji only, without letters or digits."
6. **Icebreaker:** create a retro with the Icebreaker phase and "Hangman" as its game, and move to Icebreaker.
   - The board shows the game panel instead of columns; cursors and flying reactions still work.
   - Switch the game mid-round: the round ends as abandoned.
   - Set the board timer during a round: the round ends when it hits zero.
   - Move to Writing mid-round: the round is abandoned and the columns come back.
7. **Guest join:** open a `link` room's guest link in a private window, type a name and play.
8. **Player cap:** open a 13th browser session on the same room: "This room is full."
9. **Scores:**
   - The round end card shows "+n" per scorer.
   - The Scores tab updates in both browsers.
   - "Reset scores" empties the room leaderboard while the team page's leaderboard keeps the points.
10. **Team leaderboard:** after games on two consecutive weeks (change the clock or seed `game_points.created_at`), the team Games page shows a "2-week streak" badge; "All time" and "Last 30 days" switch the list, with a skeleton while loading.
11. **Games we played:** complete the retro of step 6. The Results view shows "Games we played" after the action items and before ROTI, with the podium, "Show all", and "Replay" for a drawing. A guest of the retro sees the same section. On an anonymous retro, GIF tiles say "Anonymous GIF".
12. **Invites:**
    - With Slack and Telegram connected, a room host's "Invite" posts to both; the message opens `/games/{room}`.
    - With "Include the guest link" on a `link` room, the message opens the guest join page.
    - A `team` room has no guest-link option and says "Only members of :team can join."
    - Archive the Slack channel and invite again: the delivery line turns to "Slack: failed — Reconnect Slack in the team settings.".
    - Spec 8's channels (Teams, Mattermost, webhook) are not built yet and do not appear.

- [ ] **Step 6: Report**

Summarize the results (tests, static checks, walkthrough) to the user; do not claim a step passed without its output.

---

## Self-review

- **Spec coverage:**
  - §3 icebreaker room → Task 1 (creation, players, host, access, no cap).
  - §3.1 → Tasks 6 and 11 (Slack and Telegram; spec 8 channels absent by design).
  - §4.7:
    - room leaderboard → Tasks 3 and 9;
    - reset → Tasks 3 and 9;
    - team leaderboard → Tasks 4 and 9;
    - streaks → Task 4;
    - anonymous GIF points → already zero in 13c, surfaced unchanged.
  - §5 icebreaker timer → Task 1.
  - §6 → Tasks 1, 7 and 8 (panel, switcher, events on the retro channel, lock and phase refusals, abandon on leave, phase off keeps the room, cascade).
  - §6.1 → Tasks 5 and 10.
  - §7:
    - routes `DELETE scores` → Task 3;
    - `POST shares` → Task 6;
    - snapshot `leaderboard`, `scoresResetAt`, `share`, `deliveries` → Tasks 3 and 6;
    - `?period=` → Task 4.
  - §9 → Tasks 8–11.
  - §10:
    - reset 404 and 403 → Task 3;
    - leaderboard rescue → Tasks 4 and 9;
    - invite errors → Task 6 (409 amendment).
  - §11 → Tasks 1, 2, 5, 6 and 7.
  - §12 groups → Tasks 1–6 and 12.
  - §13 criteria 8, 12, 13, 14, 15 and 11 → Tasks 1–12.
- **Placeholder scan:** every code step carries its code; no "TBD" or "similar to".
- **Type consistency:**
  - `EnsureIcebreakerRoom::handle(Retro): GameRoom` is used in Tasks 1, 3, 4, 5 and 6.
  - `RoomLeaderboard::handle(GameRoom): array` is used in Tasks 3 and 5.
  - `TeamGameLeaderboard::period()` and `handle()` are used in Task 4.
  - `GameRoomShares` is used in Task 6.
  - The frontend types of Task 7 are used in Tasks 8–11.
  - Route names `games.scores.destroy` and `games.shares.store` match the Wayfinder controllers `GameScoresController.destroy` and `GameSharesController.store`.
- **Review Focus:** each of the five lines has its pinned test in Tasks 1, 4 and 6.
