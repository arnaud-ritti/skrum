# Plan 10b — Planning poker scope additions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poker games gain the scope additions of spec Decision 9: a spectator role, a per-round voting timer with facilitator-controlled auto-reveal (everyone online voted, or the timer ended), anonymous (unnamed) reveal with redaction on every surface, saved custom decks per team, and spec 1's live cursors and flying reactions over the poker presence channel — cursors hidden while a round is open.

**Architecture:** Backend additions reuse Plan 10a's guard/action/transaction pattern: `SetPokerSpectator` (withdraws open votes), `AutoRevealPokerRound` (reads the Reverb presence roster through a `PokerPresenceRoster` interface outside any lock, then re-checks everything inside the game/round lock and calls `RevealPokerRound`), a delayed `RevealPokerRoundOnTimer` job, anonymity as a round property enforced inside `PresentPokerRound` (still the only place that serializes values), and `SavedPokerDeck` records (table `poker_decks`) copied into games. The frontend extracts spec 1's whisper transport and layers into board-agnostic modules (`resources/js/lib/realtime/`, `resources/js/components/realtime/`) used by thin retro wrappers and new poker wrappers, and adds the spectator, timer, anonymous and saved-deck UI to the Plan 10a components.

**Tech Stack:** Laravel 13 (PHP 8.4), PostgreSQL, Pest, Reverb (Pusher HTTP API via `pusher/pusher-php-server`, already installed), database queue, React 19, Inertia v3, `@laravel/echo-react`, `live-cursors`, `live-reactions`, `frimousse`, Wayfinder, Tailwind 4 (all already installed).

**Spec:** `docs/superpowers/specs/2026-09-29-planning-poker-design.md` — §2 (scope-addition columns, `poker_decks`), §3 Settings switches, §3a–§3d, §4 (spectator, timer, auto-reveal, saved-deck endpoints; `timer.changed`; "Live cursors and flying reactions"), §5 (second invariant, roster, whispers, saved decks), §7 (scope-addition UI), §8, §9 (scope-addition tests and walkthrough) and §10 criteria 14–19; §11 "Spec 1" (the realtime extraction). Builds on Plan 10a (`docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md`, "Contract for Plan 10b").

## Global Constraints

- Continue on branch `feat/plan-10-planning-poker` after Plan 10a's last task. This plan consumes exactly the "Contract for Plan 10b" section of Plan 10a; nothing else of 10a may be renamed.
- Commands through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse --no-progress` (level 7, 0 errors). npm on the host.
- Tests run on PostgreSQL (the Sail `testing` database). The case-insensitive unique index on `poker_decks` is created only when `DB::getDriverName() === 'pgsql'`, like `create_team_health_statements_table`.
- Migration filenames use the prefix `2026_10_03_1001xx`; only `up()` methods.
- No new Composer or npm dependency.
- Request fields are snake_case (`spectator`, `seconds`, `auto_reveal`, `anonymous_votes`, `cursors_enabled`, `reactions_enabled`, `saved_deck_id`, `save_deck_as`, `name`, `cards`, `include_unknown`, `include_coffee`); response and broadcast payloads camelCase as spec §4/§6.
- Same mutation discipline as Plan 10a: player resolved by middleware → cheap guards → `DB::transaction` locking the game row first (then the round, then player rows) → guards again → persist → `->sendToOthers()`. Guard order: ended (403) → role (403) → state (422).
- **Values**: card values are serialized only by `PresentPokerRound`. In an anonymous round no payload anywhere links another player's value to that player — before or after reveal, for the facilitator too. The Reverb roster never leaves the server and is never logged beyond the game id.
- **Whispers**: `cursor` and `reaction` client events only, on `presence-poker.{gameId}`; the sender id is Reverb's stamped presence `user_id`, never the payload; nothing is persisted or processed server-side.
- The retro board's cursors and reactions keep their exact behaviour after the extraction (no rule change to spec 1).
- Every user-facing string via `t()` / `__()` with real translations in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"), appended at the end of each file; saved deck names and card labels are never translated. `tests/Feature/TranslationKeysTest.php` stays green.
- Wayfinder: `vendor/bin/sail artisan wayfinder:generate --with-form` after every route change; never stage `resources/js/actions` or `resources/js/routes`.
- Frontend checks: `npm run types:check && npm run check` (known pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`); format touched files with `npx vp check --fix <paths>`.
- PHP and React conventions as Plan 10a. Test helper names unique in `tests/`.
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`

## Naming note

The saved-deck model is `App\Models\SavedPokerDeck` (table `poker_decks`, as spec §2) because `App\Enums\PokerDeck` already names the built-in decks; the policy keeps the spec's name `App\Policies\PokerDeckPolicy`, the controller `App\Http\Controllers\PokerDecksController`, and the route parameter is `{pokerDeck}` (scoped through `Team::pokerDecks()`).

## Review Focus

1. **A timer job that outlives its round** — the facilitator changes or clears the timer, re-votes (new round), switches task or ends the game before the delayed job runs → the job no-ops (it is keyed to the round id and the exact `timer_ends_at` it was scheduled for) and never reveals the new round or another task's round. Pinned in Task 4 ("ignores a timer job made stale by a change, a clear, a re-vote or a task switch").
2. **Anonymity switched on after a named round was revealed** → that revealed round stays named (only unrevealed rounds become anonymous); switched off → every existing anonymous round, revealed or not, stays anonymous and only rounds created afterwards are named. Pinned in Task 2 ("marks only unrevealed rounds anonymous when switched on", "never de-anonymizes when switched off").
3. **A spectating facilitator** still reveals, re-votes, sets estimates and the timer, cannot vote (403), and is not in the "everyone voted" set; switching themself back to Play lets them vote on the open round. Pinned in Task 1 ("lets a spectating facilitator facilitate but not vote") and Task 3 ("leaves spectators out of everyone-voted").
4. **Stale or foreign roster ids** — the Reverb roster lists a player id of another game, a deleted player, or duplicates from two tabs; or the roster call fails/times out → foreign and deleted ids are ignored, duplicates count once, a failure disables only the everyone-voted condition for that check (the timer condition still reveals). Pinned in Task 3 ("ignores roster ids that are not players of the game", "falls back to the timer condition when the roster is unavailable").
5. **Saved-deck names that differ only by case or surrounding spaces** (`" Team Scale"` vs `"team scale"`) → 422 "A deck with this name already exists."; renaming a deck to its own name with a different case is allowed; a saved deck of another team, or `saved_deck_id` together with `custom_cards`, → 422. Pinned in Task 5 ("treats names case- and space-insensitively", "refuses foreign or mixed deck choices").

## File map

| Area | Files |
|---|---|
| Spectators | `app/Actions/Poker/SetPokerSpectator.php`; `app/Http/Controllers/Poker/PokerSpectatorsController.php`; `app/Http/Controllers/PokerJoinsController.php`; `routes/web.php` |
| Anonymous rounds & switches | `app/Actions/Poker/PresentPokerRound.php`; `app/Http/Controllers/Poker/PokerSettingsController.php` |
| Auto-reveal | `app/Contracts/PokerPresenceRoster.php`; `app/Support/Poker/ReverbPokerPresenceRoster.php`; `app/Providers/AppServiceProvider.php`; `app/Actions/Poker/AutoRevealPokerRound.php`; `app/Http/Controllers/Poker/{PokerAutoRevealsController,PokerVotesController}.php` |
| Timer | `app/Http/Controllers/Poker/PokerTimersController.php`; `app/Events/Poker/PokerTimerChanged.php`; `app/Jobs/RevealPokerRoundOnTimer.php` |
| Saved decks | `database/migrations/2026_10_03_100100_create_poker_decks_table.php`; `app/Models/{SavedPokerDeck,Team}.php`; `database/factories/SavedPokerDeckFactory.php`; `app/Policies/PokerDeckPolicy.php`; `app/Actions/Poker/{SavedPokerDeckRules,NewPokerGame,CreatePokerGame}.php`; `app/Http/Controllers/{PokerDecksController,TeamPokerGamesController,TeamsController}.php`; `app/Http/Controllers/Poker/PokerSavedDecksController.php` |
| Realtime extraction | `resources/js/lib/realtime/whisper-transport.ts` (moved from `resources/js/lib/retro/whisper-transport.ts`); `resources/js/components/realtime/{live-cursors,flying-reactions}.tsx`; `resources/js/components/retro/{live-cursor-layer,flying-reactions,board-context}.tsx`; `resources/js/hooks/{use-retro-channel,use-poker-channel}.ts`; `resources/js/components/poker/game-context.tsx` |
| Poker realtime UI | `resources/js/components/poker/{game-cursors,game-reactions,game,game-header}.tsx` |
| Poker scope UI | `resources/js/lib/poker/{types,game-reducer}.ts`; `resources/js/hooks/{use-poker-game,use-poker-channel}.ts`; `resources/js/components/poker/{spectator-toggle,watching-row,anonymous-values-row,round-timer-control,auto-reveal-triggers,players-grid,facilitator-toolbar,result-panel,game-settings-dialog,deck-fields,game-header}.tsx`; `resources/js/components/retro/presence-strip.tsx`; `resources/js/pages/poker/join.tsx` |
| Saved decks UI | `resources/js/components/teams/{saved-decks-dialog,new-poker-game-dialog,poker-games-section}.tsx`; `resources/js/components/poker/{deck-fields,game-settings-dialog}.tsx`; `resources/js/pages/teams/show.tsx`; `resources/js/types/poker.ts` |
| Tests | `tests/Pest.php`; `tests/Feature/Poker/{PokerSpectatorTest,PokerAnonymousTest,PokerAutoRevealTest,ReverbPokerPresenceRosterTest,PokerTimerTest,SavedPokerDecksTest,PokerSavedDeckGamesTest,PokerScopeSettingsTest}.php` |
| Translations | `lang/{en,fr,es,de}.json` (rows inside each task) |

---

### Task 1: Spectators (`SetPokerSpectator`, spectator endpoint, join as spectator)

**Files:**
- Create: `app/Actions/Poker/SetPokerSpectator.php`, `app/Http/Controllers/Poker/PokerSpectatorsController.php`
- Modify: `app/Http/Controllers/PokerJoinsController.php` (`spectator` sometimes boolean → `is_spectator` on the new guest row), `routes/web.php`
- Test: create `tests/Feature/Poker/PokerSpectatorTest.php`

**Interfaces:**
- Consumes (10a): `PokerGuard::{notEnded, facilitator, canVote}`, `PokerVoteChanged`, `PokerGameChanged`, `PlayPokerCard` (re-reads the player row under lock), `PokerPlayer::is_spectator`, `BuildPokerSnapshot`, Pest helpers `pokerMember`, `pokerFacilitator`, `pokerGuest`, `pokerGuestCookie`, `openPokerRound`, `pokerVote`.
- Produces:
  - `SetPokerSpectator::handle(PokerGame $locked, PokerPlayer $target, bool $spectator): void` — locks the target player row; no-op when unchanged; sets `is_spectator`; switching to spectator deletes the target's votes in every **unrevealed** round of the game (any task), incrementing each affected round's `version` and broadcasting one `PokerVoteChanged` (`hasVoted: false`) per affected round; revealed rounds keep their votes; broadcasts `PokerGameChanged`. (Task 3 adds the auto-reveal check after commit in the controller.)
  - `PokerSpectatorsController::update(Request, PokerGame $game, PokerPlayer $player, SetPokerSpectator)` — `spectator` required boolean; requester must be `$player` or the facilitator (else 403 "Only the facilitator can do this."); `notEnded`; 204.
  - `PokerJoinsController::store` accepts `spectator` (`sometimes`, `boolean`) and stores it on the new guest row; resumed guests keep their stored role.
  - Route `poker.players.spectator.update` (`PUT poker/{game}/players/{player}/spectator`).

No new user-facing strings in this task ("Spectators can't vote." and "Only the facilitator can do this." already exist).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Poker/PokerSpectatorTest.php`:

```php
<?php

use App\Actions\Poker\BuildPokerSnapshot;
use App\Actions\Poker\PlayPokerCard;
use App\Events\Poker\PokerGameChanged;
use App\Events\Poker\PokerVoteChanged;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{0: PokerGame, 1: array{0: \App\Models\User, 1: PokerPlayer}, 2: array{0: \App\Models\User, 1: PokerPlayer}, 3: PokerRound}
 */
function spectatorTable(): array
{
    $game = PokerGame::factory()->withGuestAccess()->create();
    $facilitator = pokerFacilitator($game);
    $member = pokerMember($game);
    $round = openPokerRound($game);

    return [$game, $facilitator, $member, $round];
}

it('switches oneself to spectator and back', function () {
    [$game, , [$user, $member]] = spectatorTable();

    $this->actingAs($user)
        ->putJson(route('poker.players.spectator.update', [$game, $member]), ['spectator' => true])
        ->assertNoContent();

    expect($member->fresh()->is_spectator)->toBeTrue();
    Event::assertDispatched(PokerGameChanged::class, fn (PokerGameChanged $event) => $event->gameId === $game->id);

    $this->actingAs($user)
        ->putJson(route('poker.players.spectator.update', [$game, $member]), ['spectator' => false])
        ->assertNoContent();

    expect($member->fresh()->is_spectator)->toBeFalse();
});

it('lets the facilitator switch any player, guests included', function () {
    [$game, [$facilitatorUser], [, $member]] = spectatorTable();
    $guest = pokerGuest($game);

    $this->actingAs($facilitatorUser)
        ->putJson(route('poker.players.spectator.update', [$game, $member]), ['spectator' => true])
        ->assertNoContent();

    $this->actingAs($facilitatorUser)
        ->putJson(route('poker.players.spectator.update', [$game, $guest]), ['spectator' => true])
        ->assertNoContent();

    expect($member->fresh()->is_spectator)->toBeTrue()
        ->and($guest->fresh()->is_spectator)->toBeTrue();
});

it('refuses other players switching someone else', function () {
    [$game, [, $facilitator], [$memberUser]] = spectatorTable();
    $guest = pokerGuest($game);

    $this->actingAs($memberUser)
        ->putJson(route('poker.players.spectator.update', [$game, $facilitator]), ['spectator' => true])
        ->assertForbidden();

    Auth::forgetGuards();

    $this->withCookies(pokerGuestCookie($guest))
        ->withCredentials()
        ->putJson(route('poker.players.spectator.update', [$game, $facilitator]), ['spectator' => true])
        ->assertForbidden();

    expect($facilitator->fresh()->is_spectator)->toBeFalse();
});

it('refuses switches on an ended game', function () {
    [$game, , [$user, $member]] = spectatorTable();
    $game->update(['ended_at' => now(), 'current_task_id' => null]);

    $this->actingAs($user)
        ->putJson(route('poker.players.spectator.update', [$game, $member]), ['spectator' => true])
        ->assertForbidden();

    expect($member->fresh()->is_spectator)->toBeFalse();
});

it('withdraws the spectator\'s votes from every unrevealed round', function () {
    [$game, [, $facilitator], [$user, $member], $openRound] = spectatorTable();
    $otherTask = PokerTask::factory()->create(['poker_game_id' => $game->id]);
    $leftOpen = PokerRound::factory()->create(['poker_task_id' => $otherTask->id]);
    $revealedTask = PokerTask::factory()->create(['poker_game_id' => $game->id]);
    $revealed = PokerRound::factory()->revealed()->create(['poker_task_id' => $revealedTask->id]);

    pokerVote($openRound, $member, '5');
    pokerVote($openRound, $facilitator, '8');
    pokerVote($leftOpen, $member, '3');
    pokerVote($revealed, $member, '13');
    $openRound->update(['version' => 4]);

    $this->actingAs($user)
        ->putJson(route('poker.players.spectator.update', [$game, $member]), ['spectator' => true])
        ->assertNoContent();

    expect($openRound->votes()->pluck('poker_player_id')->all())->toBe([$facilitator->id])
        ->and($openRound->fresh()->version)->toBe(5)
        ->and($leftOpen->votes()->count())->toBe(0)
        ->and($leftOpen->fresh()->version)->toBe(1)
        ->and($revealed->votes()->where('poker_player_id', $member->id)->value('value'))->toBe('13')
        ->and($revealed->fresh()->version)->toBe(0);

    Event::assertDispatchedTimes(PokerVoteChanged::class, 2);
    Event::assertDispatched(PokerVoteChanged::class, fn (PokerVoteChanged $event) => $event->broadcastWith() === [
        'roundId' => $openRound->id,
        'playerId' => $member->id,
        'hasVoted' => false,
        'votesCount' => 1,
        'version' => 5,
    ]);
    Event::assertDispatched(PokerVoteChanged::class, fn (PokerVoteChanged $event) => $event->roundId === $leftOpen->id
        && $event->votesCount === 0);
});

it('does nothing when the role does not change', function () {
    [$game, , [$user, $member], $round] = spectatorTable();
    pokerVote($round, $member, '5');

    $this->actingAs($user)
        ->putJson(route('poker.players.spectator.update', [$game, $member]), ['spectator' => false])
        ->assertNoContent();

    expect($round->votes()->count())->toBe(1);
    Event::assertNotDispatched(PokerGameChanged::class);
});

it('refuses a spectator\'s vote', function () {
    [$game, , [$user, $member], $round] = spectatorTable();
    $member->update(['is_spectator' => true]);

    $this->actingAs($user)
        ->putJson(route('poker.rounds.vote.update', [$game, $round]), ['value' => '5'])
        ->assertForbidden()
        ->assertJsonPath('message', "Spectators can't vote.");

    expect($round->votes()->count())->toBe(0);
});

it('never leaves a spectator vote when the switch races the vote', function () {
    [$game, , [, $member], $round] = spectatorTable();
    $staleMember = PokerPlayer::query()->findOrFail($member->id);

    PokerPlayer::query()->whereKey($member->id)->update(['is_spectator' => true]);

    expect(fn () => app(PlayPokerCard::class)->handle($game->fresh(), $round->fresh(), $staleMember, '5'))
        ->toThrow(AuthorizationException::class);

    expect($round->votes()->count())->toBe(0);
});

it('lets a spectating facilitator facilitate but not vote', function () {
    [$game, [$facilitatorUser, $facilitator], [$memberUser], $round] = spectatorTable();
    $task = $round->task;

    $this->actingAs($facilitatorUser)
        ->putJson(route('poker.players.spectator.update', [$game, $facilitator]), ['spectator' => true])
        ->assertNoContent();

    $this->actingAs($memberUser)
        ->putJson(route('poker.rounds.vote.update', [$game, $round]), ['value' => '5'])
        ->assertOk();

    $this->actingAs($facilitatorUser)
        ->putJson(route('poker.rounds.vote.update', [$game, $round]), ['value' => '8'])
        ->assertForbidden();

    $this->actingAs($facilitatorUser)
        ->postJson(route('poker.rounds.reveal.store', [$game, $round]))
        ->assertOk();

    $this->actingAs($facilitatorUser)
        ->putJson(route('poker.tasks.estimate.update', [$game, $task]), ['value' => '5'])
        ->assertOk();

    $this->actingAs($facilitatorUser)
        ->postJson(route('poker.tasks.rounds.store', [$game, $task]))
        ->assertCreated();

    $this->actingAs($facilitatorUser)
        ->putJson(route('poker.players.spectator.update', [$game, $facilitator]), ['spectator' => false])
        ->assertNoContent();

    $newRound = $task->rounds()->where('number', 2)->sole();

    $this->actingAs($facilitatorUser)
        ->putJson(route('poker.rounds.vote.update', [$game, $newRound]), ['value' => '8'])
        ->assertOk();

    expect($task->fresh()->estimate)->toBe('5')
        ->and($newRound->votes()->where('poker_player_id', $facilitator->id)->value('value'))->toBe('8');
});

it('lets non-guest spectators add tasks', function () {
    [$game, , [$user, $member]] = spectatorTable();
    $member->update(['is_spectator' => true]);

    $this->actingAs($user)
        ->postJson(route('poker.tasks.store', $game), ['title' => 'Login page'])
        ->assertCreated();
});

it('joins as a spectator from the guest link', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();

    $this->post(route('poker.join.store', $game->guest_token), ['name' => 'Watcher', 'spectator' => true])
        ->assertRedirect(route('poker.show', $game));

    $this->post(route('poker.join.store', $game->guest_token), ['name' => 'Player'])
        ->assertRedirect(route('poker.show', $game));

    expect($game->players()->where('guest_name', 'Watcher')->sole()->is_spectator)->toBeTrue()
        ->and($game->players()->where('guest_name', 'Player')->sole()->is_spectator)->toBeFalse();
});

it('keeps the stored role when a guest resumes', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    $guest = pokerGuest($game);
    $guest->update(['is_spectator' => true]);

    $this->withCookies(pokerGuestCookie($guest))
        ->withCredentials()
        ->getJson(route('poker.snapshot.show', $game))
        ->assertOk()
        ->assertJsonPath('me.isSpectator', true)
        ->assertJsonPath('me.canVote', false);
});

it('exposes isSpectator and canVote in the snapshot', function () {
    [$game, [, $facilitator], [, $member]] = spectatorTable();
    $member->update(['is_spectator' => true]);

    $asMember = app(BuildPokerSnapshot::class)->handle($game->fresh(), $member->fresh());
    $asFacilitator = app(BuildPokerSnapshot::class)->handle($game->fresh(), $facilitator->fresh());

    expect($asMember['me']['isSpectator'])->toBeTrue()
        ->and($asMember['me']['canVote'])->toBeFalse()
        ->and($asFacilitator['me']['canVote'])->toBeTrue()
        ->and(collect($asFacilitator['players'])->firstWhere('id', $member->id)['isSpectator'])->toBeTrue()
        ->and(collect($asFacilitator['players'])->firstWhere('id', $facilitator->id)['isSpectator'])->toBeFalse();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerSpectatorTest.php`
Expected: FAIL — `Route [poker.players.spectator.update] not defined.` on the switch tests; "joins as a spectator from the guest link" fails because `is_spectator` stays `false`. "refuses a spectator's vote", "never leaves a spectator vote when the switch races the vote", "lets non-guest spectators add tasks", "keeps the stored role when a guest resumes" and "exposes isSpectator and canVote in the snapshot" already pass (Plan 10a built them).

- [ ] **Step 3: Implement `SetPokerSpectator`**

Create `app/Actions/Poker/SetPokerSpectator.php`:

```php
<?php

namespace App\Actions\Poker;

use App\Events\Poker\PokerGameChanged;
use App\Events\Poker\PokerVoteChanged;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;

class SetPokerSpectator
{
    /**
     * Must run inside the transaction that locked the game row.
     */
    public function handle(PokerGame $locked, PokerPlayer $target, bool $spectator): void
    {
        $player = PokerPlayer::query()
            ->whereKey($target->id)
            ->where('poker_game_id', $locked->id)
            ->lockForUpdate()
            ->firstOrFail();

        if ($player->is_spectator === $spectator) {
            return;
        }

        $player->update(['is_spectator' => $spectator]);

        if ($spectator) {
            $this->withdrawOpenVotes($locked, $player);
        }

        (new PokerGameChanged($locked->id))->sendToOthers();
    }

    /**
     * A spectator never holds a vote: every unrevealed round loses theirs,
     * revealed rounds are history and keep it.
     */
    private function withdrawOpenVotes(PokerGame $locked, PokerPlayer $player): void
    {
        $rounds = PokerRound::query()
            ->whereIn('poker_task_id', PokerTask::query()->where('poker_game_id', $locked->id)->select('id'))
            ->whereNull('revealed_at')
            ->whereHas('votes', fn ($query) => $query->where('poker_player_id', $player->id))
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        foreach ($rounds as $round) {
            $round->votes()->where('poker_player_id', $player->id)->delete();
            $round->increment('version');

            (new PokerVoteChanged(
                $locked->id,
                $round->id,
                $player->id,
                false,
                $round->votes()->count(),
                $round->version,
            ))->sendToOthers();
        }
    }
}
```

- [ ] **Step 4: Implement the controller and route**

Create `app/Http/Controllers/Poker/PokerSpectatorsController.php`:

```php
<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\SetPokerSpectator;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class PokerSpectatorsController extends Controller
{
    public function update(Request $request, PokerGame $game, PokerPlayer $player, SetPokerSpectator $setPokerSpectator): Response
    {
        $requester = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        $this->authorizeSwitch($game, $requester, $player);

        $validated = $request->validate([
            'spectator' => ['required', 'boolean'],
        ]);

        DB::transaction(function () use ($game, $requester, $player, $validated, $setPokerSpectator): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            $this->authorizeSwitch($locked, $requester, $player);

            $setPokerSpectator->handle($locked, $player, (bool) $validated['spectator']);
        });

        return response()->noContent();
    }

    private function authorizeSwitch(PokerGame $game, PokerPlayer $requester, PokerPlayer $target): void
    {
        if ($requester->id === $target->id) {
            return;
        }

        PokerGuard::facilitator($game, $requester);
    }
}
```

In `routes/web.php`, add `use App\Http\Controllers\Poker\PokerSpectatorsController;` to the imports (alphabetical with the other `Poker\` imports) and, inside the `poker/{game}` group after the `facilitator` line:

```php
        Route::put('players/{player}/spectator', [PokerSpectatorsController::class, 'update'])->name('poker.players.spectator.update')->whereUuid('player');
```

The group's `scopeBindings()` resolves `{player}` through `PokerGame::players()`: a player of another game answers 404.

- [ ] **Step 5: Join as spectator**

In `app/Http/Controllers/PokerJoinsController.php` `store()`, extend the validation array (Plan 10a validates only `name`):

```php
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50'],
            'spectator' => ['sometimes', 'boolean'],
        ]);
```

and add `is_spectator` to the attributes of the new guest row created by `$game->players()->create([...])`:

```php
            'is_spectator' => (bool) ($validated['spectator'] ?? false),
```

Resumed guests are resolved by `ResolvePlayer` before validation and redirected, so their stored role is kept.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerSpectatorTest.php tests/Feature/Poker/PokerJoinTest.php tests/Feature/Poker/PokerVotingTest.php`
Expected: PASS.

- [ ] **Step 7: Format and analyse**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`
Expected: no changes left, 0 errors.

- [ ] **Step 8: Commit**

```bash
git add app/Actions/Poker/SetPokerSpectator.php app/Http/Controllers/Poker/PokerSpectatorsController.php app/Http/Controllers/PokerJoinsController.php routes/web.php tests/Feature/Poker/PokerSpectatorTest.php
git commit -m "feat: let poker players watch as spectators

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

### Task 2: Anonymous rounds, cursor and reaction switches

**Files:**
- Modify: `app/Actions/Poker/PresentPokerRound.php`, `app/Http/Controllers/Poker/PokerSettingsController.php` (validation + `attributes()` + anonymity side effect), `tests/Pest.php` (receives `pokerPayloadExposes()`), `tests/Feature/Poker/PokerRedactionTest.php` (loses `pokerPayloadExposes()`), `app/Http/Controllers/TeamEstimatesController.php` only if a test shows it needs a change (expected: none — it uses `PresentPokerRound`)
- Test: create `tests/Feature/Poker/PokerAnonymousTest.php`, `tests/Feature/Poker/PokerScopeSettingsTest.php`

**Interfaces:**
- Consumes (10a): `PresentPokerRound::handle(PokerRound, PokerGame, ?string $viewerPlayerId, bool $listUnrevealedVoters = true)`, `StartPokerRound` (copies `anonymous_votes` into `poker_rounds.anonymous`), `PokerSettingsController::attributes(array $validated, PokerGame $locked): array`, `BuildPokerSnapshot`, `PokerVoteChanged`, `PokerGameChanged`, `pokerPayloadExposes(array|string $payload, PokerPlayer $player, string $value): bool` (Plan 10a Task 12).
- Produces:
  - `PresentPokerRound`: for `$round->anonymous` every vote's `value` is `null` except the viewer's own — before and after reveal; `myVote` unchanged; `result` (with `distribution`) still present after reveal. Revealed anonymous rounds in history keep `votes` with `playerId` and `value: null`.
  - `PokerSettingsController` accepts `anonymous_votes`, `cursors_enabled`, `reactions_enabled` (`sometimes`, `boolean`); turning `anonymous_votes` on also sets `anonymous = true` on every **unrevealed** round of the game; turning it off changes no round. All broadcast `PokerGameChanged` (already done by 10a).
  - `pokerPayloadExposes()` lives in `tests/Pest.php` from now on.

No new user-facing strings in this task (the UI strings come with Task 8).

- [ ] **Step 1: Move the redaction helper**

Cut the helpers `pokerPayloadJson(array|string $payload): string` and `pokerPayloadExposes(array|string $payload, PokerPlayer $player, string $value): bool` (with their docblocks) from `tests/Feature/Poker/PokerRedactionTest.php` and paste them unchanged at the end of `tests/Pest.php`, adding `use App\Models\PokerPlayer;` to `tests/Pest.php` if it is not imported yet. The other helpers of that file (`pokerPayloadMentions`, `pokerViewerRequest`, …) stay where they are. Remove imports that become unused in `PokerRedactionTest.php`.

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerRedactionTest.php`
Expected: PASS (behaviour unchanged).

- [ ] **Step 2: Write the failing anonymity tests**

Create `tests/Feature/Poker/PokerAnonymousTest.php`:

```php
<?php

use App\Actions\Poker\BuildPokerSnapshot;
use App\Events\Poker\PokerVoteChanged;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{game: PokerGame, round: PokerRound, users: array<string, User|null>, players: array<string, PokerPlayer>, values: array<string, string>}
 */
function anonymousTable(): array
{
    $game = PokerGame::factory()->withGuestAccess()->create(['anonymous_votes' => true]);
    [$facilitatorUser, $facilitator] = pokerFacilitator($game);
    [$memberUser, $member] = pokerMember($game);
    $guest = pokerGuest($game);
    $round = openPokerRound($game);
    $round->update(['anonymous' => true]);

    return [
        'game' => $game,
        'round' => $round,
        'users' => ['F' => $facilitatorUser, 'M' => $memberUser, 'G' => null],
        'players' => ['F' => $facilitator, 'M' => $member, 'G' => $guest],
        'values' => ['F' => '8', 'M' => '13', 'G' => '3'],
    ];
}

/**
 * @param  array{users: array<string, User|null>, players: array<string, PokerPlayer>}  $table
 */
function asAnonymousViewer(TestCase $test, array $table, string $viewer): TestCase
{
    if ($viewer === 'G') {
        Auth::forgetGuards();

        return $test->withCookies(pokerGuestCookie($table['players']['G']))->withCredentials();
    }

    return $test->actingAs($table['users'][$viewer]);
}

/**
 * @param  array<string, mixed>  $round
 * @return array<string, string|null>
 */
function pokerRoundValuesByPlayer(array $round): array
{
    return collect($round['votes'])->pluck('value', 'playerId')->all();
}

/**
 * @param  array{players: array<string, PokerPlayer>, values: array<string, string>}  $table
 */
function expectNoOtherValueLinked(array $table, string $viewer, array|string $payload): void
{
    foreach ($table['players'] as $key => $player) {
        if ($key === $viewer) {
            continue;
        }

        expect(pokerPayloadExposes($payload, $player, $table['values'][$key]))
            ->toBeFalse("{$viewer} sees {$key}'s value linked to {$key}");
    }
}

/**
 * @param  array<string, mixed>  $round
 */
function expectFullDistribution(array $round): void
{
    expect(collect($round['result']['distribution'])->pluck('count', 'value')->all())
        ->toBe(['3' => 1, '8' => 1, '13' => 1]);
}

it('never links a value to another player in an anonymous round, for everyone', function () {
    $table = anonymousTable();
    ['game' => $game, 'round' => $round] = $table;

    foreach (['F', 'M', 'G'] as $viewer) {
        asAnonymousViewer($this, $table, $viewer)
            ->putJson(route('poker.rounds.vote.update', [$game, $round]), ['value' => $table['values'][$viewer]])
            ->assertOk();
    }

    $voteEvents = Event::dispatched(PokerVoteChanged::class);

    expect($voteEvents)->toHaveCount(3);

    foreach ($voteEvents as [$event]) {
        expect(array_keys($event->broadcastWith()))->toBe(['roundId', 'playerId', 'hasVoted', 'votesCount', 'version']);
    }

    $reveal = asAnonymousViewer($this, $table, 'F')
        ->postJson(route('poker.rounds.reveal.store', [$game, $round]))
        ->assertOk();

    expectNoOtherValueLinked($table, 'F', $reveal->json());
    expect(pokerRoundValuesByPlayer($reveal->json()))->toBe([
        $table['players']['F']->id => '8',
        $table['players']['M']->id => null,
        $table['players']['G']->id => null,
    ]);
    expectFullDistribution($reveal->json());

    asAnonymousViewer($this, $table, 'F')
        ->putJson(route('poker.tasks.estimate.update', [$game, $round->task]), ['value' => '8'])
        ->assertOk();

    foreach (['F', 'M', 'G'] as $viewer) {
        $snapshot = app(BuildPokerSnapshot::class)->handle($game->fresh(), $table['players'][$viewer]->fresh());
        $current = $snapshot['current']['round'];

        expectNoOtherValueLinked($table, $viewer, $snapshot);
        expect($current['myVote'])->toBe($table['values'][$viewer])
            ->and(pokerRoundValuesByPlayer($current)[$table['players'][$viewer]->id])->toBe($table['values'][$viewer]);
        expectFullDistribution($current);

        $snapshotResponse = asAnonymousViewer($this, $table, $viewer)
            ->getJson(route('poker.snapshot.show', $game))
            ->assertOk();
        expectNoOtherValueLinked($table, $viewer, $snapshotResponse->json());

        $history = asAnonymousViewer($this, $table, $viewer)
            ->getJson(route('poker.tasks.rounds.index', [$game, $round->task]))
            ->assertOk();
        expectNoOtherValueLinked($table, $viewer, $history->json());
        expectFullDistribution($history->json()[0]);
    }

    foreach (['F', 'M'] as $viewer) {
        $page = asAnonymousViewer($this, $table, $viewer)
            ->get(route('teams.estimates.index', [$game->team->workspace, $game->team]))
            ->assertOk();
        $props = $page->viewData('page')['props'];

        expectNoOtherValueLinked($table, $viewer, $props['tasks']);
        expectFullDistribution($props['tasks'][0]['rounds'][0]);
    }
});

it('hides even the voters\' values from the facilitator before reveal', function () {
    $table = anonymousTable();
    ['game' => $game, 'round' => $round, 'players' => $players] = $table;
    pokerVote($round, $players['M'], '13');

    $snapshot = app(BuildPokerSnapshot::class)->handle($game->fresh(), $players['F']->fresh());

    expect(pokerRoundValuesByPlayer($snapshot['current']['round']))->toBe([$players['M']->id => null])
        ->and($snapshot['current']['round']['result'])->toBeNull();
});

it('marks only unrevealed rounds anonymous when switched on', function () {
    $game = PokerGame::factory()->create();
    [$user, $facilitator] = pokerFacilitator($game);
    [, $member] = pokerMember($game);
    $revealed = openPokerRound($game);
    pokerVote($revealed, $member, '5');
    $revealed->update(['revealed_at' => now()]);
    $open = openPokerRound($game);

    $this->actingAs($user)
        ->patchJson(route('poker.settings.update', $game), ['anonymous_votes' => true])
        ->assertNoContent();

    expect($open->fresh()->anonymous)->toBeTrue()
        ->and($revealed->fresh()->anonymous)->toBeFalse()
        ->and($game->fresh()->anonymous_votes)->toBeTrue();

    $history = $this->actingAs($user)
        ->getJson(route('poker.tasks.rounds.index', [$game, $revealed->task]))
        ->assertOk();

    expect(pokerRoundValuesByPlayer($history->json()[0]))->toBe([$member->id => '5']);
});

it('never de-anonymizes when switched off', function () {
    $game = PokerGame::factory()->create(['anonymous_votes' => true]);
    [$user] = pokerFacilitator($game);
    [, $member] = pokerMember($game);
    $revealed = openPokerRound($game);
    $revealed->update(['anonymous' => true]);
    pokerVote($revealed, $member, '5');
    $revealed->update(['revealed_at' => now()]);
    $open = openPokerRound($game);
    $open->update(['anonymous' => true]);

    $this->actingAs($user)
        ->patchJson(route('poker.settings.update', $game), ['anonymous_votes' => false])
        ->assertNoContent();

    expect($revealed->fresh()->anonymous)->toBeTrue()
        ->and($open->fresh()->anonymous)->toBeTrue();

    $history = $this->actingAs($user)
        ->getJson(route('poker.tasks.rounds.index', [$game, $revealed->task]))
        ->assertOk();

    expect(pokerRoundValuesByPlayer($history->json()[0]))->toBe([$member->id => null]);
});

it('copies the setting into round 1 and re-vote rounds', function () {
    $game = PokerGame::factory()->create(['anonymous_votes' => true]);
    [$user, $facilitator] = pokerFacilitator($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $this->actingAs($user)
        ->putJson(route('poker.current-task.update', $game), ['task_id' => $task->id])
        ->assertNoContent();

    $first = $task->rounds()->sole();
    expect($first->anonymous)->toBeTrue();

    pokerVote($first, $facilitator, '5');
    $this->actingAs($user)->postJson(route('poker.rounds.reveal.store', [$game, $first]))->assertOk();
    $this->actingAs($user)->postJson(route('poker.tasks.rounds.store', [$game, $task]))->assertCreated();

    $second = $task->rounds()->where('number', 2)->sole();
    expect($second->anonymous)->toBeTrue();

    $this->actingAs($user)
        ->patchJson(route('poker.settings.update', $game), ['anonymous_votes' => false])
        ->assertNoContent();

    pokerVote($second, $facilitator, '5');
    $this->actingAs($user)->postJson(route('poker.rounds.reveal.store', [$game, $second]))->assertOk();
    $this->actingAs($user)->postJson(route('poker.tasks.rounds.store', [$game, $task]))->assertCreated();

    expect($task->rounds()->where('number', 3)->sole()->anonymous)->toBeFalse()
        ->and($second->fresh()->anonymous)->toBeTrue();
});
```

Create `tests/Feature/Poker/PokerScopeSettingsTest.php`:

```php
<?php

use App\Actions\Poker\BuildPokerSnapshot;
use App\Events\Poker\PokerGameChanged;
use App\Models\PokerGame;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

dataset('poker switches', [
    'anonymous votes' => ['anonymous_votes', 'anonymousVotes', false],
    'cursors' => ['cursors_enabled', 'cursorsEnabled', true],
    'reactions' => ['reactions_enabled', 'reactionsEnabled', true],
]);

it('lets the facilitator flip each switch', function (string $field, string $snapshotKey, bool $default) {
    $game = PokerGame::factory()->create();
    [$user, $facilitator] = pokerFacilitator($game);

    expect($game->fresh()->{$field})->toBe($default);

    $this->actingAs($user)
        ->patchJson(route('poker.settings.update', $game), [$field => ! $default])
        ->assertNoContent();

    expect($game->fresh()->{$field})->toBe(! $default)
        ->and(app(BuildPokerSnapshot::class)->handle($game->fresh(), $facilitator->fresh())['game'][$snapshotKey])->toBe(! $default);

    Event::assertDispatched(PokerGameChanged::class, fn (PokerGameChanged $event) => $event->gameId === $game->id);
})->with('poker switches');

it('refuses the switches to other players', function (string $field, string $snapshotKey, bool $default) {
    $game = PokerGame::factory()->withGuestAccess()->create();
    pokerFacilitator($game);
    [$memberUser] = pokerMember($game);
    $guest = pokerGuest($game);

    $this->actingAs($memberUser)
        ->patchJson(route('poker.settings.update', $game), [$field => ! $default])
        ->assertForbidden();

    $this->withCookies(pokerGuestCookie($guest))
        ->withCredentials()
        ->patchJson(route('poker.settings.update', $game), [$field => ! $default])
        ->assertForbidden();

    expect($game->fresh()->{$field})->toBe($default);
})->with('poker switches');

it('refuses the switches on an ended game', function (string $field, string $snapshotKey, bool $default) {
    $game = PokerGame::factory()->ended()->create();
    [$user] = pokerFacilitator($game);

    $this->actingAs($user)
        ->patchJson(route('poker.settings.update', $game), [$field => ! $default])
        ->assertForbidden();

    expect($game->fresh()->{$field})->toBe($default);
})->with('poker switches');

it('validates the switches as booleans', function () {
    $game = PokerGame::factory()->create();
    [$user] = pokerFacilitator($game);

    $this->actingAs($user)
        ->patchJson(route('poker.settings.update', $game), ['cursors_enabled' => 'sometimes'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('cursors_enabled');
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerAnonymousTest.php tests/Feature/Poker/PokerScopeSettingsTest.php`
Expected: FAIL — the revealed anonymous round still names every value ("F sees M's value linked to M"); `anonymous_votes`/`cursors_enabled`/`reactions_enabled` are silently dropped by the settings validation (the flip test sees the default); "marks only unrevealed rounds anonymous" sees `anonymous` still `false`. "hides even the voters' values from the facilitator before reveal" and "copies the setting into round 1 and re-vote rounds" up to round 2 already pass (Plan 10a).

- [ ] **Step 4: Redact anonymous rounds in `PresentPokerRound`**

In `app/Actions/Poker/PresentPokerRound.php`, the per-vote `value` is decided in one expression (Plan 10a: the vote's value only when the round is revealed or the vote is the viewer's). Replace that expression with a call to a new private method and add the method:

```php
    /**
     * Before reveal only the viewer's own value is shown; in an anonymous
     * round that stays true forever, so values reach others only through
     * the result's distribution.
     */
    private function visibleValue(PokerRound $round, PokerVote $vote, ?string $viewerPlayerId): ?string
    {
        if ($viewerPlayerId !== null && $vote->poker_player_id === $viewerPlayerId) {
            return $vote->value;
        }

        if ($round->anonymous) {
            return null;
        }

        return $round->isRevealed() ? $vote->value : null;
    }
```

so the vote mapping reads:

```php
            'value' => $this->visibleValue($round, $vote, $viewerPlayerId),
```

(import `App\Models\PokerVote` if the file does not yet). `myVote`, `votesCount`, `result` and the voter order are unchanged; `result` is still computed from every vote once revealed, and its `distribution` is in deck order, never in voter order.

- [ ] **Step 5: Accept the switches in `PokerSettingsController`**

In `app/Http/Controllers/Poker/PokerSettingsController.php`:

1. Add to the validation array (after `guest_access_enabled`):

```php
            'anonymous_votes' => ['sometimes', 'boolean'],
            'cursors_enabled' => ['sometimes', 'boolean'],
            'reactions_enabled' => ['sometimes', 'boolean'],
```

2. In the private `attributes(array $validated, PokerGame $locked): array` method, extend the `Arr::only()` list (the model casts the values to booleans):

```php
        $attributes = Arr::only($validated, ['title', 'guest_access_enabled', 'anonymous_votes', 'cursors_enabled', 'reactions_enabled']);
```

3. Right after the validation, compute:

```php
        $turnsAnonymityOn = array_key_exists('anonymous_votes', $validated) && (bool) $validated['anonymous_votes'];
```

pass `$turnsAnonymityOn` into the transaction closure's `use (...)` list, and inside the transaction, right after `$locked->update($this->attributes($validated, $locked));`, add:

```php
            if ($turnsAnonymityOn) {
                $this->anonymizeOpenRounds($locked);
            }
```

4. Add the private method (imports `App\Models\PokerRound`, `App\Models\PokerTask`):

```php
    /**
     * More privacy is always safe, so open rounds follow the switch at once;
     * turning it off only applies to rounds created afterwards.
     */
    private function anonymizeOpenRounds(PokerGame $locked): void
    {
        PokerRound::query()
            ->whereIn('poker_task_id', PokerTask::query()->where('poker_game_id', $locked->id)->select('id'))
            ->whereNull('revealed_at')
            ->update(['anonymous' => true]);
    }
```

The existing `(new PokerGameChanged($locked->id))->sendToOthers();` covers every switch. `StartPokerRound` already copies `anonymous_votes` into new rounds.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker`
Expected: PASS (including `PokerRedactionTest`, `PokerEstimatesPageTest` and `PokerRoundHistoryTest`, whose named rounds are unaffected).

- [ ] **Step 7: Format and analyse**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`
Expected: no changes left, 0 errors.

- [ ] **Step 8: Commit**

```bash
git add app/Actions/Poker/PresentPokerRound.php app/Http/Controllers/Poker/PokerSettingsController.php tests/Pest.php tests/Feature/Poker/PokerRedactionTest.php tests/Feature/Poker/PokerAnonymousTest.php tests/Feature/Poker/PokerScopeSettingsTest.php
git commit -m "feat: reveal poker votes anonymously and add cursor and reaction switches

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

### Task 3: Auto-reveal (`PokerPresenceRoster`, `AutoRevealPokerRound`, triggers)

**Files:**
- Create: `app/Contracts/PokerPresenceRoster.php`, `app/Support/Poker/ReverbPokerPresenceRoster.php`, `app/Actions/Poker/AutoRevealPokerRound.php`, `app/Http/Controllers/Poker/PokerAutoRevealsController.php`
- Modify: `app/Providers/AppServiceProvider.php` (bind the roster), `app/Http/Controllers/Poker/PokerVotesController.php` (auto-reveal after a cast vote; response `revealed`), `app/Http/Controllers/Poker/PokerSpectatorsController.php` (check after a switch to spectator), `app/Http/Controllers/Poker/PokerSettingsController.php` (`auto_reveal` sometimes boolean; check after it is turned on), `routes/web.php`, `tests/Pest.php` (`fakePokerRoster(?array $playerIds): void`)
- Test: create `tests/Feature/Poker/PokerAutoRevealTest.php`, `tests/Feature/Poker/ReverbPokerPresenceRosterTest.php`

**Interfaces:**
- Consumes (10a): `RevealPokerRound::handle(PokerGame $locked, PokerRound $lockedRound, PokerRevealReason $reason)`, `PokerGame::latestRoundOfCurrentTask()`, `PokerRevealReason::{EveryoneVoted, Timer}`, `PokerRoundChanged`, `PlayPokerCard`; Task 1's `PokerSpectatorsController`, Task 2's `PokerSettingsController::attributes()`.
- Produces:
  - `interface App\Contracts\PokerPresenceRoster { /** @return array<int, string>|null */ public function playerIds(PokerGame $game): ?array; }`.
  - `App\Support\Poker\ReverbPokerPresenceRoster implements PokerPresenceRoster` — `__construct(?ClientInterface $client = null)`; builds its own `Pusher\Pusher` from `config('broadcasting.connections.reverb')` with a 2 s timeout; `playerIds()` returns the unique presence ids of `presence-poker.{gameId}`, or `null` (with `Log::warning('Poker presence roster unavailable.', ['game' => $game->id])`) on any failure or when the default broadcaster is not reverb.
  - Binding in `AppServiceProvider::register()`.
  - `AutoRevealPokerRound::handle(PokerRound $round): bool` — as spec §3b; roster read outside the transaction; everything re-checked under the game and round locks; `EveryoneVoted` wins over `Timer` when both hold.
  - `PokerVotesController::update` answers `revealed` from the check; `destroy` never triggers.
  - `PokerAutoRevealsController::store` → `{revealed: bool}` 200 for any player. Route `poker.rounds.auto-reveal.store`.
  - `PokerSettingsController` accepts `auto_reveal`; turning it on runs the check on the open round after commit. `PokerSpectatorsController` runs the check after a switch to spectator.
  - Pest helper `fakePokerRoster(?array $playerIds): void`.

No new user-facing strings (the log line is not translated).

- [ ] **Step 1: Pest helper**

In `tests/Pest.php` add `use App\Contracts\PokerPresenceRoster;` and `use App\Models\PokerGame;` (if missing) and append:

```php
/**
 * @param  array<int, string>|null  $playerIds
 */
function fakePokerRoster(?array $playerIds): void
{
    app()->instance(PokerPresenceRoster::class, new class($playerIds) implements PokerPresenceRoster
    {
        /**
         * @param  array<int, string>|null  $playerIds
         */
        public function __construct(private ?array $playerIds) {}

        public function playerIds(PokerGame $game): ?array
        {
            return $this->playerIds;
        }
    });
}
```

(The interface does not exist yet; this compiles only after Step 4 — write it now, it is exercised by the failing tests.)

- [ ] **Step 2: Write the failing tests**

Create `tests/Feature/Poker/PokerAutoRevealTest.php`:

```php
<?php

use App\Actions\Poker\AutoRevealPokerRound;
use App\Enums\PokerRevealReason;
use App\Events\Poker\PokerRoundChanged;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{game: PokerGame, round: PokerRound, facilitatorUser: User, facilitator: PokerPlayer, memberUser: User, member: PokerPlayer, guest: PokerPlayer}
 */
function autoRevealTable(bool $autoReveal = true): array
{
    $game = PokerGame::factory()->withGuestAccess()->create(['auto_reveal' => $autoReveal]);
    [$facilitatorUser, $facilitator] = pokerFacilitator($game);
    [$memberUser, $member] = pokerMember($game);
    $guest = pokerGuest($game);

    return [
        'game' => $game,
        'round' => openPokerRound($game),
        'facilitatorUser' => $facilitatorUser,
        'facilitator' => $facilitator,
        'memberUser' => $memberUser,
        'member' => $member,
        'guest' => $guest,
    ];
}

function autoReveal(PokerRound $round): bool
{
    return app(AutoRevealPokerRound::class)->handle($round->fresh());
}

it('never reveals while auto-reveal is off', function () {
    $table = autoRevealTable(autoReveal: false);
    fakePokerRoster([$table['facilitator']->id, $table['member']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');
    pokerVote($table['round'], $table['member'], '8');
    $table['round']->update(['timer_ends_at' => now()->subMinute()]);

    expect(autoReveal($table['round']))->toBeFalse()
        ->and($table['round']->fresh()->revealed_at)->toBeNull();
});

it('reveals when every online non-spectator player voted', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id, $table['member']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');
    pokerVote($table['round'], $table['member'], '8');

    expect(autoReveal($table['round']))->toBeTrue();

    $round = $table['round']->fresh();

    expect($round->revealed_at)->not->toBeNull()
        ->and($round->reveal_reason)->toBe(PokerRevealReason::EveryoneVoted);
    Event::assertDispatched(PokerRoundChanged::class);
});

it('waits for an online player who has not voted', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id, $table['member']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');

    expect(autoReveal($table['round']))->toBeFalse()
        ->and($table['round']->fresh()->revealed_at)->toBeNull();
});

it('does not wait for offline players', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');

    expect(autoReveal($table['round']))->toBeTrue();
});

it('counts a vote of a player who went offline', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');
    pokerVote($table['round'], $table['member'], '8');

    expect(autoReveal($table['round']))->toBeTrue()
        ->and($table['round']->votes()->count())->toBe(2);
});

it('leaves spectators out of everyone-voted', function () {
    $table = autoRevealTable();
    $table['member']->update(['is_spectator' => true]);
    $table['facilitator']->update(['is_spectator' => true]);
    fakePokerRoster([$table['facilitator']->id, $table['member']->id, $table['guest']->id]);
    pokerVote($table['round'], $table['guest'], '3');

    expect(autoReveal($table['round']))->toBeTrue()
        ->and($table['round']->fresh()->reveal_reason)->toBe(PokerRevealReason::EveryoneVoted);
});

it('never reveals when only spectators are online', function () {
    $table = autoRevealTable();
    $table['member']->update(['is_spectator' => true]);
    fakePokerRoster([$table['member']->id]);
    pokerVote($table['round'], $table['facilitator'], '3');

    expect(autoReveal($table['round']))->toBeFalse();
});

it('counts a player online in two tabs once', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id, $table['facilitator']->id, $table['member']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');
    pokerVote($table['round'], $table['member'], '5');

    expect(autoReveal($table['round']))->toBeTrue();
});

it('never reveals a round without votes', function () {
    $table = autoRevealTable();
    fakePokerRoster([]);
    $table['round']->update(['timer_ends_at' => now()->subMinute()]);

    expect(autoReveal($table['round']))->toBeFalse();

    fakePokerRoster([$table['facilitator']->id]);

    expect(autoReveal($table['round']))->toBeFalse()
        ->and($table['round']->fresh()->revealed_at)->toBeNull();
});

it('reveals when the timer ended with at least one vote', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00:00'));
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id, $table['member']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');
    $table['round']->update(['timer_ends_at' => now()->addSeconds(30)]);

    expect(autoReveal($table['round']))->toBeFalse();

    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00:30'));

    expect(autoReveal($table['round']))->toBeTrue()
        ->and($table['round']->fresh()->reveal_reason)->toBe(PokerRevealReason::Timer);
});

it('falls back to the timer condition when the roster is unavailable', function () {
    $table = autoRevealTable();
    fakePokerRoster(null);
    pokerVote($table['round'], $table['facilitator'], '5');
    pokerVote($table['round'], $table['member'], '5');
    pokerVote($table['round'], $table['guest'], '5');

    expect(autoReveal($table['round']))->toBeFalse();

    $table['round']->update(['timer_ends_at' => now()->subSecond()]);

    expect(autoReveal($table['round']))->toBeTrue()
        ->and($table['round']->fresh()->reveal_reason)->toBe(PokerRevealReason::Timer);
});

it('ignores roster ids that are not players of the game', function () {
    $table = autoRevealTable();
    $otherGame = PokerGame::factory()->create();
    [, $stranger] = pokerMember($otherGame);
    $gone = PokerPlayer::factory()->create(['poker_game_id' => $table['game']->id]);
    $goneId = $gone->id;
    $gone->delete();

    fakePokerRoster(['not-a-uuid', $stranger->id, $goneId]);
    pokerVote($table['round'], $table['facilitator'], '5');

    expect(autoReveal($table['round']))->toBeFalse();

    fakePokerRoster(['not-a-uuid', $stranger->id, $goneId, $table['facilitator']->id]);

    expect(autoReveal($table['round']))->toBeTrue();
});

it('reveals when auto-reveal is turned on for a round that already qualifies', function () {
    $table = autoRevealTable(autoReveal: false);
    fakePokerRoster([$table['facilitator']->id, $table['member']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');
    pokerVote($table['round'], $table['member'], '8');

    $this->actingAs($table['facilitatorUser'])
        ->patchJson(route('poker.settings.update', $table['game']), ['auto_reveal' => true])
        ->assertNoContent();

    expect($table['game']->fresh()->auto_reveal)->toBeTrue()
        ->and($table['round']->fresh()->reveal_reason)->toBe(PokerRevealReason::EveryoneVoted);
});

it('reveals when the last non-voter switches to spectator', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id, $table['member']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');

    $this->actingAs($table['memberUser'])
        ->putJson(route('poker.players.spectator.update', [$table['game'], $table['member']]), ['spectator' => true])
        ->assertNoContent();

    expect($table['round']->fresh()->reveal_reason)->toBe(PokerRevealReason::EveryoneVoted);
});

it('never reveals on a withdrawn vote', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');
    pokerVote($table['round'], $table['member'], '8');

    $this->actingAs($table['memberUser'])
        ->deleteJson(route('poker.rounds.vote.destroy', [$table['game'], $table['round']]))
        ->assertOk()
        ->assertJsonPath('revealed', false);

    expect($table['round']->fresh()->revealed_at)->toBeNull();
});

it('answers revealed to the voter who completed the table', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id, $table['member']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');

    $this->actingAs($table['memberUser'])
        ->putJson(route('poker.rounds.vote.update', [$table['game'], $table['round']]), ['value' => '8'])
        ->assertOk()
        ->assertJsonPath('revealed', true)
        ->assertJsonPath('myVote', '8');

    expect($table['round']->fresh()->revealed_at)->not->toBeNull();
    Event::assertDispatched(PokerRoundChanged::class, fn (PokerRoundChanged $event) => $event->gameId === $table['game']->id);
});

it('re-checks on demand for any player', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id, $table['member']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');

    $this->withCookies(pokerGuestCookie($table['guest']))
        ->withCredentials()
        ->postJson(route('poker.rounds.auto-reveal.store', [$table['game'], $table['round']]))
        ->assertOk()
        ->assertExactJson(['revealed' => false]);

    fakePokerRoster([$table['facilitator']->id]);

    $this->withCookies(pokerGuestCookie($table['guest']))
        ->withCredentials()
        ->postJson(route('poker.rounds.auto-reveal.store', [$table['game'], $table['round']]))
        ->assertOk()
        ->assertExactJson(['revealed' => true]);
});

it('never reveals on an ended game or a round that is not current', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id]);
    $older = $table['round'];
    pokerVote($older, $table['facilitator'], '5');
    $table['game']->update(['current_task_id' => null]);

    expect(autoReveal($older))->toBeFalse();

    $table['game']->update(['current_task_id' => $older->poker_task_id, 'ended_at' => now()]);

    expect(autoReveal($older))->toBeFalse()
        ->and($older->fresh()->revealed_at)->toBeNull();
});

it('never reveals an older round of the current task', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id]);
    $older = $table['round'];
    pokerVote($older, $table['facilitator'], '5');
    PokerRound::factory()->create(['poker_task_id' => $older->poker_task_id, 'number' => 2]);

    expect(autoReveal($older))->toBeFalse();
});

it('never sets the estimate', function () {
    $table = autoRevealTable();
    fakePokerRoster([$table['facilitator']->id]);
    pokerVote($table['round'], $table['facilitator'], '5');

    autoReveal($table['round']);

    expect($table['round']->task->fresh()->estimate)->toBeNull();
});

it('refuses the auto-reveal switch to other players', function () {
    $table = autoRevealTable(autoReveal: false);

    $this->actingAs($table['memberUser'])
        ->patchJson(route('poker.settings.update', $table['game']), ['auto_reveal' => true])
        ->assertForbidden();

    expect($table['game']->fresh()->auto_reveal)->toBeFalse();
});
```

Create `tests/Feature/Poker/ReverbPokerPresenceRosterTest.php`:

```php
<?php

use App\Models\PokerGame;
use App\Support\Poker\ReverbPokerPresenceRoster;
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
function rosterClient(array $responses, array &$history = []): Client
{
    $stack = HandlerStack::create(new MockHandler($responses));
    $stack->push(Middleware::history($history));

    return new Client(['handler' => $stack]);
}

it('returns the unique presence ids of the game channel', function () {
    $game = PokerGame::factory()->create();
    $history = [];
    $client = rosterClient([new Response(200, [], (string) json_encode([
        'users' => [['id' => 'a'], ['id' => 'a'], ['id' => 'b']],
    ]))], $history);

    expect((new ReverbPokerPresenceRoster($client))->playerIds($game))->toBe(['a', 'b']);

    $request = $history[0]['request'];

    expect($request->getUri()->getHost())->toBe('reverb.test')
        ->and($request->getUri()->getPath())->toBe("/apps/test-app/channels/presence-poker.{$game->id}/users")
        ->and($history[0]['options']['timeout'])->toBe(2);
});

it('returns null and logs the game id when Reverb is unreachable', function () {
    $game = PokerGame::factory()->create();
    Log::shouldReceive('warning')->once()->with('Poker presence roster unavailable.', ['game' => $game->id]);

    $client = rosterClient([new ConnectException('down', new Request('GET', 'x'))]);

    expect((new ReverbPokerPresenceRoster($client))->playerIds($game))->toBeNull();
});

it('returns null on an API error', function () {
    $game = PokerGame::factory()->create();
    Log::shouldReceive('warning')->once();

    $client = rosterClient([new Response(500, [], 'boom')]);

    expect((new ReverbPokerPresenceRoster($client))->playerIds($game))->toBeNull();
});

it('returns null when the default broadcaster is not reverb', function () {
    config(['broadcasting.default' => 'null']);
    $game = PokerGame::factory()->create();
    Log::shouldReceive('warning')->once();

    $client = rosterClient([new Response(200, [], '{"users":[{"id":"a"}]}')]);

    expect((new ReverbPokerPresenceRoster($client))->playerIds($game))->toBeNull();
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerAutoRevealTest.php tests/Feature/Poker/ReverbPokerPresenceRosterTest.php`
Expected: FAIL — `Interface "App\Contracts\PokerPresenceRoster" not found` (from the Pest helper) / `Class "App\Actions\Poker\AutoRevealPokerRound" not found`.

- [ ] **Step 4: The roster contract and its Reverb implementation**

Create `app/Contracts/PokerPresenceRoster.php`:

```php
<?php

namespace App\Contracts;

use App\Models\PokerGame;

interface PokerPresenceRoster
{
    /**
     * The player ids present on the game's presence channel, or null when
     * they cannot be read.
     *
     * @return array<int, string>|null
     */
    public function playerIds(PokerGame $game): ?array;
}
```

Create `app/Support/Poker/ReverbPokerPresenceRoster.php`:

```php
<?php

namespace App\Support\Poker;

use App\Contracts\PokerPresenceRoster;
use App\Models\PokerGame;
use GuzzleHttp\Client;
use GuzzleHttp\ClientInterface;
use Illuminate\Support\Facades\Log;
use Pusher\Pusher;
use RuntimeException;
use Throwable;

class ReverbPokerPresenceRoster implements PokerPresenceRoster
{
    private const TimeoutSeconds = 2;

    public function __construct(private ?ClientInterface $client = null) {}

    public function playerIds(PokerGame $game): ?array
    {
        try {
            $response = $this->pusher()->get("/channels/presence-poker.{$game->id}/users", [], true);
        } catch (Throwable) {
            Log::warning('Poker presence roster unavailable.', ['game' => $game->id]);

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
     * A dedicated client: a slow Reverb must not hold a vote request for the
     * broadcaster's 30 s default.
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

`Pusher::get()` prefixes `/apps/{app_id}`, signs the query, passes `'timeout' => $settings['timeout']` per request and throws `ApiErrorException` on a non-200 status — all caught above.

In `app/Providers/AppServiceProvider.php` add `use App\Contracts\PokerPresenceRoster;` and `use App\Support\Poker\ReverbPokerPresenceRoster;` and replace the body of `register()`:

```php
    public function register(): void
    {
        $this->app->bind(PokerPresenceRoster::class, fn (): PokerPresenceRoster => new ReverbPokerPresenceRoster);
    }
```

- [ ] **Step 5: `AutoRevealPokerRound`**

Create `app/Actions/Poker/AutoRevealPokerRound.php`:

```php
<?php

namespace App\Actions\Poker;

use App\Contracts\PokerPresenceRoster;
use App\Enums\PokerRevealReason;
use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerTask;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AutoRevealPokerRound
{
    public function __construct(
        private PokerPresenceRoster $roster,
        private RevealPokerRound $revealPokerRound,
    ) {}

    public function handle(PokerRound $round): bool
    {
        $gameId = PokerTask::query()->whereKey($round->poker_task_id)->value('poker_game_id');
        $game = $gameId === null ? null : PokerGame::query()->find($gameId);

        if ($game === null || ! $game->auto_reveal || $game->isEnded()) {
            return false;
        }

        $onlinePlayerIds = $this->roster->playerIds($game);

        return DB::transaction(function () use ($game, $round, $onlinePlayerIds): bool {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();
            $lockedRound = PokerRound::query()->whereKey($round->id)->lockForUpdate()->first();

            if ($lockedRound === null || ! $this->isOpenForAutoReveal($locked, $lockedRound)) {
                return false;
            }

            /** @var array<int, string> $voterIds */
            $voterIds = $lockedRound->votes()->pluck('poker_player_id')->all();

            if ($voterIds === []) {
                return false;
            }

            $reason = $this->reason($locked, $lockedRound, $voterIds, $onlinePlayerIds);

            if ($reason === null) {
                return false;
            }

            $this->revealPokerRound->handle($locked, $lockedRound, $reason);

            return true;
        });
    }

    private function isOpenForAutoReveal(PokerGame $locked, PokerRound $lockedRound): bool
    {
        if ($locked->isEnded() || ! $locked->auto_reveal || $lockedRound->isRevealed()) {
            return false;
        }

        return $locked->latestRoundOfCurrentTask()?->id === $lockedRound->id;
    }

    /**
     * @param  array<int, string>  $voterIds
     * @param  array<int, string>|null  $onlinePlayerIds
     */
    private function reason(PokerGame $locked, PokerRound $lockedRound, array $voterIds, ?array $onlinePlayerIds): ?PokerRevealReason
    {
        if ($onlinePlayerIds !== null && $this->everyoneVoted($locked, $voterIds, $onlinePlayerIds)) {
            return PokerRevealReason::EveryoneVoted;
        }

        if ($lockedRound->timer_ends_at !== null && $lockedRound->timer_ends_at->lte(now())) {
            return PokerRevealReason::Timer;
        }

        return null;
    }

    /**
     * Roster ids are only trusted once matched against this game's playing
     * (non-spectator) players, so foreign or stale ids never count.
     *
     * @param  array<int, string>  $voterIds
     * @param  array<int, string>  $onlinePlayerIds
     */
    private function everyoneVoted(PokerGame $locked, array $voterIds, array $onlinePlayerIds): bool
    {
        $candidateIds = array_values(array_unique(array_filter($onlinePlayerIds, fn (string $id): bool => Str::isUuid($id))));

        if ($candidateIds === []) {
            return false;
        }

        $expected = $locked->players()
            ->where('is_spectator', false)
            ->whereIn('id', $candidateIds)
            ->pluck('id');

        if ($expected->isEmpty()) {
            return false;
        }

        return $expected->diff($voterIds)->isEmpty();
    }
}
```

`RevealPokerRound` re-applies `PokerGuard::openRound`, sets `revealed_at` and `reveal_reason` and broadcasts `PokerRoundChanged` with `toOthers()` — from the job and the auto-reveal endpoint there is no socket id, so every client refetches; the voter's own socket is excluded and gets `revealed: true` instead.

- [ ] **Step 6: Triggers and the on-demand endpoint**

Create `app/Http/Controllers/Poker/PokerAutoRevealsController.php`:

```php
<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\AutoRevealPokerRound;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PokerAutoRevealsController extends Controller
{
    /**
     * Any player may ask: every condition is re-checked on the server.
     */
    public function store(Request $request, PokerGame $game, PokerRound $round, AutoRevealPokerRound $autoRevealPokerRound): JsonResponse
    {
        PokerPlayer::current($request);

        return response()->json(['revealed' => $autoRevealPokerRound->handle($round)]);
    }
}
```

In `routes/web.php` import it and add inside the `poker/{game}` group after the `rounds/{round}/reveal` line:

```php
        Route::post('rounds/{round}/auto-reveal', [PokerAutoRevealsController::class, 'store'])->name('poker.rounds.auto-reveal.store')->whereUuid('round');
```

In `app/Http/Controllers/Poker/PokerVotesController.php` `update()`: add the parameter `AutoRevealPokerRound $autoRevealPokerRound` (import `App\Actions\Poker\AutoRevealPokerRound`) and replace the final `return response()->json($playPokerCard->handle($game, $round, $player, $validated['value']));` with:

```php
        $result = $playPokerCard->handle($game, $round, $player, $validated['value']);
        $result['revealed'] = $autoRevealPokerRound->handle($round);

        return response()->json($result);
```

`PlayPokerCard` has committed by then, so the check reads the new vote. `destroy()` stays unchanged (withdrawing never reveals).

In `app/Http/Controllers/Poker/PokerSpectatorsController.php`: add the parameter `AutoRevealPokerRound $autoRevealPokerRound` to `update()` and, after the `DB::transaction(...)` call, before `return response()->noContent();`:

```php
        if ((bool) $validated['spectator']) {
            $this->revealIfEveryoneVoted($game, $autoRevealPokerRound);
        }
```

with:

```php
    private function revealIfEveryoneVoted(PokerGame $game, AutoRevealPokerRound $autoRevealPokerRound): void
    {
        $openRound = $game->fresh()?->latestRoundOfCurrentTask();

        if ($openRound !== null) {
            $autoRevealPokerRound->handle($openRound);
        }
    }
```

In `app/Http/Controllers/Poker/PokerSettingsController.php`:

1. validation: `'auto_reveal' => ['sometimes', 'boolean'],`
2. `attributes()`: add `'auto_reveal'` to the `Arr::only()` list extended in Task 2 (`['title', 'guest_access_enabled', 'anonymous_votes', 'cursors_enabled', 'reactions_enabled', 'auto_reveal']`).
3. `update()`: add the parameter `AutoRevealPokerRound $autoRevealPokerRound`; next to `$turnsAnonymityOn` compute `$turnsAutoRevealOn = array_key_exists('auto_reveal', $validated) && (bool) $validated['auto_reveal'];`; after the transaction, before the 204:

```php
        if ($turnsAutoRevealOn) {
            $openRound = $game->fresh()?->latestRoundOfCurrentTask();

            if ($openRound !== null) {
                $autoRevealPokerRound->handle($openRound);
            }
        }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && vendor/bin/sail artisan test --compact tests/Feature/Poker`
Expected: PASS. (Tests that do not fake the roster and turn auto-reveal on get `null` from the real roster — the test broadcaster is `null` — which only disables the everyone-voted condition.)

- [ ] **Step 8: Format and analyse**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`
Expected: no changes left, 0 errors.

- [ ] **Step 9: Commit**

```bash
git add app/Contracts/PokerPresenceRoster.php app/Support/Poker/ReverbPokerPresenceRoster.php app/Providers/AppServiceProvider.php app/Actions/Poker/AutoRevealPokerRound.php app/Http/Controllers/Poker/PokerAutoRevealsController.php app/Http/Controllers/Poker/PokerVotesController.php app/Http/Controllers/Poker/PokerSpectatorsController.php app/Http/Controllers/Poker/PokerSettingsController.php routes/web.php tests/Pest.php tests/Feature/Poker/PokerAutoRevealTest.php tests/Feature/Poker/ReverbPokerPresenceRosterTest.php
git commit -m "feat: reveal poker rounds automatically when everyone online voted

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

### Task 4: Voting timer (`PokerTimersController`, `timer.changed`, `RevealPokerRoundOnTimer`)

**Files:**
- Create: `app/Http/Controllers/Poker/PokerTimersController.php`, `app/Events/Poker/PokerTimerChanged.php`, `app/Jobs/RevealPokerRoundOnTimer.php`
- Modify: `routes/web.php`
- Test: create `tests/Feature/Poker/PokerTimerTest.php`

**Interfaces:**
- Consumes: `PokerGuard::{facilitator, notEnded, openRound}`, `PokerBroadcastEvent` (10a), `AutoRevealPokerRound` (Task 3), `fakePokerRoster()` (Task 3).
- Produces:
  - `PokerTimerChanged(string $gameId, string $roundId, ?string $timerEndsAt)` → `timer.changed` `{roundId, timerEndsAt}`.
  - `PokerTimersController::update` — `seconds` present, nullable integer 10–3600; facilitator; notEnded; locks game and round; `openRound`; stores `timer_ends_at` (whole second) or null; broadcasts `PokerTimerChanged`; when set, dispatches `RevealPokerRoundOnTimer` delayed to the end, after commit; answers `{timerEndsAt}` (ISO 8601 or null). Route `poker.rounds.timer.update`.
  - `RevealPokerRoundOnTimer implements ShouldQueue` (`Queueable`; `__construct(public string $roundId, public string $timerEndsAt)`; `handle(AutoRevealPokerRound)` no-ops unless the round still has exactly that end time and it has passed).

No new user-facing strings ("Voting is closed for this round." comes from Plan 10a).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Poker/PokerTimerTest.php`:

```php
<?php

use App\Actions\Poker\AutoRevealPokerRound;
use App\Enums\PokerRevealReason;
use App\Events\Poker\PokerTimerChanged;
use App\Jobs\RevealPokerRoundOnTimer;
use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00:00'));
});

/**
 * @return array{0: PokerGame, 1: User, 2: PokerRound}
 */
function timedTable(bool $autoReveal = false): array
{
    $game = PokerGame::factory()->create(['auto_reveal' => $autoReveal]);
    [$user] = pokerFacilitator($game);

    return [$game, $user, openPokerRound($game)];
}

function runTimerJob(PokerRound $round, string $timerEndsAt): void
{
    (new RevealPokerRoundOnTimer($round->id, $timerEndsAt))->handle(app(AutoRevealPokerRound::class));
}

it('sets and clears the timer as facilitator', function () {
    [$game, $user, $round] = timedTable();

    $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => 90])
        ->assertOk()
        ->assertExactJson(['timerEndsAt' => '2026-10-05T10:01:30+00:00']);

    expect($round->fresh()->timer_ends_at->toIso8601String())->toBe('2026-10-05T10:01:30+00:00');

    $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => null])
        ->assertOk()
        ->assertExactJson(['timerEndsAt' => null]);

    expect($round->fresh()->timer_ends_at)->toBeNull();
});

it('lets only the facilitator set the timer', function () {
    [$game, , $round] = timedTable();
    [$memberUser] = pokerMember($game);

    $this->actingAs($memberUser)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => 60])
        ->assertForbidden();

    expect($round->fresh()->timer_ends_at)->toBeNull();
});

it('accepts 10 seconds to one hour', function (mixed $seconds, bool $valid) {
    [$game, $user, $round] = timedTable();

    $response = $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => $seconds]);

    $valid ? $response->assertOk() : $response->assertUnprocessable()->assertJsonValidationErrors('seconds');
})->with([
    'too short' => [9, false],
    'shortest' => [10, true],
    'longest' => [3600, true],
    'too long' => [3601, false],
    'not a number' => ['soon', false],
]);

it('requires the seconds field', function () {
    [$game, $user, $round] = timedTable();

    $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('seconds');
});

it('sets timers only on the open latest round of the current task', function (string $case) {
    [$game, $user, $round] = timedTable();

    $target = match ($case) {
        'revealed' => tap($round)->update(['revealed_at' => now()]),
        'older' => tap($round, fn () => PokerRound::factory()->create(['poker_task_id' => $round->poker_task_id, 'number' => 2])),
        'not current' => PokerRound::factory()->create([
            'poker_task_id' => PokerTask::factory()->create(['poker_game_id' => $game->id])->id,
        ]),
    };

    $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $target]), ['seconds' => 60])
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Voting is closed for this round.');

    expect($target->fresh()->timer_ends_at)->toBeNull();
})->with(['revealed', 'older', 'not current']);

it('refuses timers on an ended game', function () {
    [$game, $user, $round] = timedTable();
    $game->update(['ended_at' => now()]);

    $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => 60])
        ->assertForbidden();
});

it('broadcasts the new end time', function () {
    [$game, $user, $round] = timedTable();

    $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => 30])
        ->assertOk();

    Event::assertDispatched(PokerTimerChanged::class, fn (PokerTimerChanged $event) => $event->broadcastAs() === 'timer.changed'
        && $event->broadcastWith() === ['roundId' => $round->id, 'timerEndsAt' => '2026-10-05T10:00:30+00:00']);
});

it('starts a re-vote round without a timer', function () {
    [$game, $user, $round] = timedTable();
    [, $member] = pokerMember($game);
    pokerVote($round, $member, '5');

    $this->actingAs($user)->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => 60])->assertOk();
    $this->actingAs($user)->postJson(route('poker.rounds.reveal.store', [$game, $round]))->assertOk();
    $this->actingAs($user)->postJson(route('poker.tasks.rounds.store', [$game, $round->task]))->assertCreated();

    expect($round->task->rounds()->where('number', 2)->sole()->timer_ends_at)->toBeNull()
        ->and($round->fresh()->timer_ends_at)->not->toBeNull();
});

it('schedules the reveal job at the end of the timer', function () {
    Queue::fake();
    [$game, $user, $round] = timedTable();

    $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => 45])
        ->assertOk();

    Queue::assertPushed(RevealPokerRoundOnTimer::class, fn (RevealPokerRoundOnTimer $job) => $job->roundId === $round->id
        && $job->timerEndsAt === '2026-10-05T10:00:45+00:00'
        && $job->delay instanceof DateTimeInterface
        && CarbonImmutable::instance($job->delay)->equalTo(CarbonImmutable::parse('2026-10-05 10:00:45')));
});

it('schedules nothing when the timer is cleared', function () {
    Queue::fake();
    [$game, $user, $round] = timedTable();

    $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => null])
        ->assertOk();

    Queue::assertNothingPushed();
});

it('reveals at expiry when auto-reveal is on', function () {
    [$game, $user, $round] = timedTable(autoReveal: true);
    fakePokerRoster(null);
    [, $member] = pokerMember($game);
    pokerVote($round, $member, '5');

    $endsAt = $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => 30])
        ->json('timerEndsAt');

    runTimerJob($round, $endsAt);

    expect($round->fresh()->revealed_at)->toBeNull();

    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00:30'));
    runTimerJob($round, $endsAt);

    expect($round->fresh()->reveal_reason)->toBe(PokerRevealReason::Timer);
});

it('only lets the time run out when auto-reveal is off', function () {
    [$game, $user, $round] = timedTable(autoReveal: false);
    [, $member] = pokerMember($game);
    pokerVote($round, $member, '5');

    $endsAt = $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => 30])
        ->json('timerEndsAt');

    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:01:00'));
    runTimerJob($round, $endsAt);

    expect($round->fresh()->revealed_at)->toBeNull();
});

it('ignores a timer job made stale by a change, a clear, a re-vote or a task switch', function (string $change) {
    [$game, $user, $round] = timedTable(autoReveal: true);
    fakePokerRoster(null);
    [, $member] = pokerMember($game);
    pokerVote($round, $member, '5');
    $otherTask = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $endsAt = $this->actingAs($user)
        ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => 30])
        ->json('timerEndsAt');

    match ($change) {
        'change' => $this->actingAs($user)
            ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => 120])
            ->assertOk(),
        'clear' => $this->actingAs($user)
            ->putJson(route('poker.rounds.timer.update', [$game, $round]), ['seconds' => null])
            ->assertOk(),
        're-vote' => tap($this->actingAs($user), function ($test) use ($game, $round) {
            $test->postJson(route('poker.rounds.reveal.store', [$game, $round]))->assertOk();
            $test->postJson(route('poker.tasks.rounds.store', [$game, $round->task]))->assertCreated();
        }),
        'task switch' => $this->actingAs($user)
            ->putJson(route('poker.current-task.update', $game), ['task_id' => $otherTask->id])
            ->assertNoContent(),
    };

    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00:31'));
    runTimerJob($round, $endsAt);

    if ($change === 're-vote') {
        expect($round->fresh()->reveal_reason)->toBe(PokerRevealReason::Manual)
            ->and($round->task->rounds()->where('number', 2)->sole()->revealed_at)->toBeNull();

        return;
    }

    expect($round->fresh()->revealed_at)->toBeNull()
        ->and($otherTask->rounds()->whereNotNull('revealed_at')->exists())->toBeFalse();
})->with(['change', 'clear', 're-vote', 'task switch']);

it('ignores a job for a deleted round', function () {
    [$game, , $round] = timedTable(autoReveal: true);
    $roundId = $round->id;
    $round->task->delete();

    (new RevealPokerRoundOnTimer($roundId, '2026-10-05T10:00:30+00:00'))->handle(app(AutoRevealPokerRound::class));

    expect(PokerRound::query()->find($roundId))->toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerTimerTest.php`
Expected: FAIL — `Route [poker.rounds.timer.update] not defined.` / `Class "App\Jobs\RevealPokerRoundOnTimer" not found`.

- [ ] **Step 3: The event**

Create `app/Events/Poker/PokerTimerChanged.php`:

```php
<?php

namespace App\Events\Poker;

class PokerTimerChanged extends PokerBroadcastEvent
{
    public function __construct(string $gameId, public string $roundId, public ?string $timerEndsAt)
    {
        parent::__construct($gameId);
    }

    public function broadcastAs(): string
    {
        return 'timer.changed';
    }

    public function broadcastWith(): array
    {
        return ['roundId' => $this->roundId, 'timerEndsAt' => $this->timerEndsAt];
    }
}
```

- [ ] **Step 4: The job**

Create `app/Jobs/RevealPokerRoundOnTimer.php`:

```php
<?php

namespace App\Jobs;

use App\Actions\Poker\AutoRevealPokerRound;
use App\Models\PokerRound;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class RevealPokerRoundOnTimer implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $roundId, public string $timerEndsAt) {}

    /**
     * The job belongs to one end time of one round: a changed, cleared or
     * superseded timer makes it a no-op, and the action re-checks the rest.
     */
    public function handle(AutoRevealPokerRound $autoRevealPokerRound): void
    {
        $round = PokerRound::query()->find($this->roundId);

        if ($round === null || $round->timer_ends_at === null) {
            return;
        }

        if (! $round->timer_ends_at->equalTo(CarbonImmutable::parse($this->timerEndsAt))) {
            return;
        }

        if ($round->timer_ends_at->isFuture()) {
            return;
        }

        $autoRevealPokerRound->handle($round);
    }
}
```

- [ ] **Step 5: The controller and route**

Create `app/Http/Controllers/Poker/PokerTimersController.php`:

```php
<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Events\Poker\PokerTimerChanged;
use App\Http\Controllers\Controller;
use App\Jobs\RevealPokerRoundOnTimer;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PokerTimersController extends Controller
{
    public function update(Request $request, PokerGame $game, PokerRound $round): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::facilitator($game, $player);

        $validated = $request->validate([
            'seconds' => ['present', 'nullable', 'integer', 'min:10', 'max:3600'],
        ]);

        // Whole seconds: the column keeps no fraction, and the job compares
        // its scheduled instant with the stored one.
        $endsAt = $validated['seconds'] === null
            ? null
            : now()->addSeconds((int) $validated['seconds'])->startOfSecond();

        DB::transaction(function () use ($game, $round, $player, $endsAt): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();
            $lockedRound = PokerRound::query()->whereKey($round->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);
            PokerGuard::openRound($locked, $lockedRound);

            $lockedRound->update(['timer_ends_at' => $endsAt]);

            (new PokerTimerChanged($locked->id, $lockedRound->id, $endsAt?->toIso8601String()))->sendToOthers();

            if ($endsAt !== null) {
                RevealPokerRoundOnTimer::dispatch($lockedRound->id, $endsAt->toIso8601String())
                    ->delay($endsAt)
                    ->afterCommit();
            }
        });

        return response()->json(['timerEndsAt' => $endsAt?->toIso8601String()]);
    }
}
```

In `routes/web.php` import it and add inside the `poker/{game}` group after the `auto-reveal` line:

```php
        Route::put('rounds/{round}/timer', [PokerTimersController::class, 'update'])->name('poker.rounds.timer.update')->whereUuid('round');
```

Under `QUEUE_CONNECTION=sync` (tests) the delay is ignored and the job runs right after commit; its end time is still in the future then, so it returns without revealing. In production the database queue worker (`docker/s6-rc.d/queue`) runs it at the end time.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerTimerTest.php tests/Feature/Poker/PokerAutoRevealTest.php`
Expected: PASS.

- [ ] **Step 7: Format and analyse**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`
Expected: no changes left, 0 errors.

- [ ] **Step 8: Commit**

```bash
git add app/Http/Controllers/Poker/PokerTimersController.php app/Events/Poker/PokerTimerChanged.php app/Jobs/RevealPokerRoundOnTimer.php routes/web.php tests/Feature/Poker/PokerTimerTest.php
git commit -m "feat: add a voting timer to poker rounds

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

### Task 5: Saved decks (table, policy, endpoints, game creation and re-deck)

**Files:**
- Create: `database/migrations/2026_10_03_100100_create_poker_decks_table.php`, `app/Models/SavedPokerDeck.php`, `database/factories/SavedPokerDeckFactory.php`, `app/Policies/PokerDeckPolicy.php`, `app/Actions/Poker/SavedPokerDeckRules.php`, `app/Http/Controllers/PokerDecksController.php`, `app/Http/Controllers/Poker/PokerSavedDecksController.php`
- Modify: `app/Models/Team.php` (`pokerDecks(): HasMany<SavedPokerDeck>`), `app/Providers/AppServiceProvider.php` (`Gate::policy(SavedPokerDeck::class, PokerDeckPolicy::class)`), `app/Actions/Poker/NewPokerGame.php` (`public ?string $saveDeckAs = null` last), `app/Actions/Poker/CreatePokerGame.php` (creates the saved deck in the same transaction), `app/Http/Controllers/TeamPokerGamesController.php` (`saved_deck_id`, `save_deck_as`), `app/Http/Controllers/Poker/PokerSettingsController.php` (`saved_deck_id`), `app/Http/Controllers/TeamsController.php` (prop `pokerDecks`), `routes/web.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Poker/SavedPokerDecksTest.php`, `tests/Feature/Poker/PokerSavedDeckGamesTest.php`

**Interfaces:**
- Consumes (10a): `PokerDeckRules::{rules, cardListRules, cardRules, withSpecialCards, resolve}`, `NewPokerGame`, `CreatePokerGame::handle(Team, User, NewPokerGame)`, `PokerSettingsController::attributes()` and its "deck can't change once votes exist" check, `PokerDeck::Custom`, `PokerGuard::facilitator`, `TeamsController::show`.
- Produces:
  - Table `poker_decks` exactly as spec §2; pgsql expression index `poker_decks_team_name_unique ON poker_decks (team_id, lower(name))`.
  - `SavedPokerDeck` (table `poker_decks`; fillable `name, cards, created_by_user_id`; cast `cards` array): `team()`, `creator()`. Factory with `team`, `name`, `cards` `['1','2','3','?']`, `created_by_user_id`.
  - `PokerDeckPolicy`: `viewAny(User, Team)`, `create(User, Team)` = can view the team; `update`/`delete(User, SavedPokerDeck)` = creator who can still view the team, or a workspace Owner/Admin; denial "Only the deck's creator or a workspace admin can change it."
  - `SavedPokerDeckRules::MaxDecks = 30`; `nameRules(Team $team, ?SavedPokerDeck $ignore = null): array` (`string`, `max:40`, case-insensitive uniqueness closure — callers prepend `required`/`sometimes`/`nullable`); `ensureRoom(Team $lockedTeam): void`; `findForTeam(Team $team, string $id): SavedPokerDeck`.
  - `PokerDecksController::{store, update, destroy}` (routes `teams.pokerDecks.*`), `PokerSavedDecksController::index` (route `poker.saved-decks.index`).
  - `TeamsController::show` prop `pokerDecks: [{id, name, cards, canManage}]`.
  - `NewPokerGame::$saveDeckAs`; `CreatePokerGame` creates game + saved deck atomically (limit checked under the team lock).
  - `TeamPokerGamesController::store` and `PokerSettingsController::update` accept `saved_deck_id` (exclusive with `custom_cards`); `store` accepts `save_deck_as` (custom cards only).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Poker/SavedPokerDecksTest.php`:

```php
<?php

use App\Enums\WorkspaceRole;
use App\Models\PokerGame;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * @return array{0: Team, 1: User}
 */
function deckTeam(): array
{
    $team = Team::factory()->create();

    return [$team, teamMember($team)];
}

function saveDeck(Team $team, User $creator, array $attributes = []): SavedPokerDeck
{
    return SavedPokerDeck::factory()->create([
        'team_id' => $team->id,
        'created_by_user_id' => $creator->id,
        ...$attributes,
    ]);
}

it('lets a team member save a deck', function () {
    [$team, $user] = deckTeam();

    $this->actingAs($user)
        ->from(route('teams.show', [$team->workspace, $team]))
        ->post(route('teams.pokerDecks.store', [$team->workspace, $team]), [
            'name' => 'Team scale',
            'cards' => ['1', '2', '4', '8'],
            'include_unknown' => true,
            'include_coffee' => false,
        ])
        ->assertRedirect(route('teams.show', [$team->workspace, $team]))
        ->assertSessionHasNoErrors();

    $deck = $team->pokerDecks()->sole();

    expect($deck->name)->toBe('Team scale')
        ->and($deck->cards)->toBe(['1', '2', '4', '8', '?'])
        ->and($deck->created_by_user_id)->toBe($user->id);
});

it('appends the special cards the checkboxes ask for', function (bool $unknown, bool $coffee, array $expected) {
    [$team, $user] = deckTeam();

    $this->actingAs($user)
        ->post(route('teams.pokerDecks.store', [$team->workspace, $team]), [
            'name' => 'Scale',
            'cards' => ['S', 'M', 'L'],
            'include_unknown' => $unknown,
            'include_coffee' => $coffee,
        ])
        ->assertSessionHasNoErrors();

    expect($team->pokerDecks()->sole()->cards)->toBe($expected);
})->with([
    'both' => [true, true, ['S', 'M', 'L', '?', '☕']],
    'none' => [false, false, ['S', 'M', 'L']],
    'coffee only' => [false, true, ['S', 'M', 'L', '☕']],
]);

it('validates the deck cards', function (array $cards) {
    [$team, $user] = deckTeam();

    $this->actingAs($user)
        ->post(route('teams.pokerDecks.store', [$team->workspace, $team]), ['name' => 'Scale', 'cards' => $cards])
        ->assertSessionHasErrors();

    expect($team->pokerDecks()->count())->toBe(0);
})->with([
    'one card' => [['1']],
    'too long' => [['123456789', '2']],
    'duplicate after trim' => [[' 3', '3']],
    'only special cards' => [['?', '☕']],
    'twenty-one cards' => [array_map('strval', range(1, 21))],
]);

it('treats names case- and space-insensitively', function () {
    [$team, $user] = deckTeam();
    $deck = saveDeck($team, $user, ['name' => 'Team Scale']);

    $this->actingAs($user)
        ->post(route('teams.pokerDecks.store', [$team->workspace, $team]), ['name' => ' team scale ', 'cards' => ['1', '2']])
        ->assertSessionHasErrors(['name' => 'A deck with this name already exists.']);

    $other = saveDeck($team, $user, ['name' => 'Other']);

    $this->actingAs($user)
        ->patch(route('teams.pokerDecks.update', [$team->workspace, $team, $other]), ['name' => 'TEAM SCALE'])
        ->assertSessionHasErrors('name');

    $this->actingAs($user)
        ->patch(route('teams.pokerDecks.update', [$team->workspace, $team, $deck]), ['name' => 'TEAM SCALE'])
        ->assertSessionHasNoErrors();

    expect($deck->fresh()->name)->toBe('TEAM SCALE')
        ->and($team->pokerDecks()->count())->toBe(2);
});

it('allows the same name in another team', function () {
    [$team, $user] = deckTeam();
    [$otherTeam, $otherUser] = deckTeam();
    saveDeck($otherTeam, $otherUser, ['name' => 'Scale']);

    $this->actingAs($user)
        ->post(route('teams.pokerDecks.store', [$team->workspace, $team]), ['name' => 'Scale', 'cards' => ['1', '2']])
        ->assertSessionHasNoErrors();
});

it('limits a team to 30 saved decks', function () {
    [$team, $user] = deckTeam();
    SavedPokerDeck::factory()->count(30)->create(['team_id' => $team->id, 'created_by_user_id' => $user->id]);

    $this->actingAs($user)
        ->post(route('teams.pokerDecks.store', [$team->workspace, $team]), ['name' => 'One more', 'cards' => ['1', '2']])
        ->assertSessionHasErrors(['name' => 'This team already has 30 saved decks.']);

    expect($team->pokerDecks()->count())->toBe(30);
});

it('lets the creator edit and delete their deck', function () {
    [$team, $user] = deckTeam();
    $deck = saveDeck($team, $user);

    $this->actingAs($user)
        ->patch(route('teams.pokerDecks.update', [$team->workspace, $team, $deck]), [
            'cards' => ['XS', 'S', 'M'],
            'include_unknown' => false,
            'include_coffee' => false,
        ])
        ->assertSessionHasNoErrors();

    expect($deck->fresh()->cards)->toBe(['XS', 'S', 'M']);

    $this->actingAs($user)
        ->delete(route('teams.pokerDecks.destroy', [$team->workspace, $team, $deck]))
        ->assertRedirect();

    expect(SavedPokerDeck::query()->find($deck->id))->toBeNull();
});

it('lets workspace owners and admins manage any deck', function (WorkspaceRole $role) {
    [$team, $user] = deckTeam();
    $deck = saveDeck($team, $user);
    $manager = workspaceManager($team->workspace, $role);

    $this->actingAs($manager)
        ->patch(route('teams.pokerDecks.update', [$team->workspace, $team, $deck]), ['name' => 'Renamed'])
        ->assertSessionHasNoErrors();

    $this->actingAs($manager)
        ->delete(route('teams.pokerDecks.destroy', [$team->workspace, $team, $deck]))
        ->assertRedirect();

    expect(SavedPokerDeck::query()->find($deck->id))->toBeNull();
})->with([WorkspaceRole::Owner, WorkspaceRole::Admin]);

it('refuses other members editing or deleting a deck', function () {
    [$team, $user] = deckTeam();
    $deck = saveDeck($team, $user);
    $other = teamMember($team);

    $this->actingAs($other)
        ->patch(route('teams.pokerDecks.update', [$team->workspace, $team, $deck]), ['name' => 'Mine now'])
        ->assertForbidden();

    $this->actingAs($other)
        ->delete(route('teams.pokerDecks.destroy', [$team->workspace, $team, $deck]))
        ->assertForbidden();

    expect($deck->fresh()->name)->not->toBe('Mine now');
});

it('refuses people outside the team', function () {
    [$team] = deckTeam();
    $outsider = User::factory()->create();
    $team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)
        ->post(route('teams.pokerDecks.store', [$team->workspace, $team]), ['name' => 'Scale', 'cards' => ['1', '2']])
        ->assertForbidden();
});

it('never lets guests reach saved decks', function () {
    [$team, $user] = deckTeam();
    saveDeck($team, $user);
    $game = PokerGame::factory()->withGuestAccess()->create(['team_id' => $team->id]);
    $guest = pokerGuest($game);

    $this->post(route('teams.pokerDecks.store', [$team->workspace, $team]), ['name' => 'Scale', 'cards' => ['1', '2']])
        ->assertRedirect(route('login'));

    $this->withCookies(pokerGuestCookie($guest))
        ->withCredentials()
        ->getJson(route('poker.saved-decks.index', $game))
        ->assertForbidden();

    $snapshot = $this->withCookies(pokerGuestCookie($guest))
        ->withCredentials()
        ->getJson(route('poker.snapshot.show', $game))
        ->assertOk()
        ->json();

    expect(json_encode($snapshot))->not->toContain('savedDeck');
});

it('answers 404 for a deck deleted meanwhile', function () {
    [$team, $user] = deckTeam();
    $deck = saveDeck($team, $user);
    $deck->delete();

    $this->actingAs($user)
        ->delete(route('teams.pokerDecks.destroy', [$team->workspace, $team, $deck]))
        ->assertNotFound();
});

it('answers 404 for a deck of another team', function () {
    [$team, $user] = deckTeam();
    [$otherTeam, $otherUser] = deckTeam();
    $foreign = saveDeck($otherTeam, $otherUser);

    $this->actingAs($user)
        ->patch(route('teams.pokerDecks.update', [$team->workspace, $team, $foreign]), ['name' => 'X'])
        ->assertNotFound();
});

it('lists the team decks on the team page', function () {
    [$team, $user] = deckTeam();
    $own = saveDeck($team, $user, ['name' => 'B mine', 'cards' => ['1', '2']]);
    $others = saveDeck($team, teamMember($team), ['name' => 'A theirs']);

    $this->actingAs($user)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->has('pokerDecks', 2)
            ->where('pokerDecks.0', ['id' => $others->id, 'name' => 'A theirs', 'cards' => $others->cards, 'canManage' => false])
            ->where('pokerDecks.1', ['id' => $own->id, 'name' => 'B mine', 'cards' => ['1', '2'], 'canManage' => true]));

    $this->actingAs(workspaceManager($team->workspace))
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('pokerDecks.0.canManage', true)
            ->where('pokerDecks.1.canManage', true));
});
```

Create `tests/Feature/Poker/PokerSavedDeckGamesTest.php`:

```php
<?php

use App\Enums\PokerDeck;
use App\Models\PokerGame;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{0: Team, 1: User, 2: SavedPokerDeck}
 */
function savedDeckTeam(): array
{
    $team = Team::factory()->create();
    $user = teamMember($team);
    $deck = SavedPokerDeck::factory()->create([
        'team_id' => $team->id,
        'created_by_user_id' => $user->id,
        'name' => 'Team scale',
        'cards' => ['1', '2', '4', '8', '?'],
    ]);

    return [$team, $user, $deck];
}

it('creates a game from a saved deck by copying it', function () {
    [$team, $user, $deck] = savedDeckTeam();

    $this->actingAs($user)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 7',
            'deck' => 'custom',
            'saved_deck_id' => $deck->id,
        ])
        ->assertSessionHasNoErrors();

    $game = $team->pokerGames()->sole();

    expect($game->deck)->toBe(PokerDeck::Custom)
        ->and($game->cards)->toBe(['1', '2', '4', '8', '?'])
        ->and($game->deck_name)->toBe('Team scale')
        ->and($game->deckLabel())->toBe('Team scale');
});

it('keeps the game unchanged when the saved deck is edited or deleted', function () {
    [$team, $user, $deck] = savedDeckTeam();

    $this->actingAs($user)->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
        'title' => 'Sprint 7',
        'deck' => 'custom',
        'saved_deck_id' => $deck->id,
    ])->assertSessionHasNoErrors();

    $game = $team->pokerGames()->sole();

    $this->actingAs($user)
        ->patch(route('teams.pokerDecks.update', [$team->workspace, $team, $deck]), [
            'name' => 'Renamed',
            'cards' => ['XS', 'S'],
            'include_unknown' => false,
            'include_coffee' => false,
        ])
        ->assertSessionHasNoErrors();

    expect($game->fresh()->cards)->toBe(['1', '2', '4', '8', '?'])
        ->and($game->fresh()->deck_name)->toBe('Team scale');

    $this->actingAs($user)->delete(route('teams.pokerDecks.destroy', [$team->workspace, $team, $deck]))->assertRedirect();

    expect($game->fresh()->cards)->toBe(['1', '2', '4', '8', '?'])
        ->and($game->fresh()->deck_name)->toBe('Team scale');
});

it('refuses foreign or mixed deck choices', function () {
    [$team, $user, $deck] = savedDeckTeam();
    [$otherTeam, , $foreign] = savedDeckTeam();

    $this->actingAs($user)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 7',
            'deck' => 'custom',
            'saved_deck_id' => $foreign->id,
        ])
        ->assertSessionHasErrors(['saved_deck_id' => 'Choose a saved deck of this team.']);

    $this->actingAs($user)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 7',
            'deck' => 'custom',
            'saved_deck_id' => $deck->id,
            'custom_cards' => ['1', '2'],
        ])
        ->assertSessionHasErrors(['saved_deck_id' => 'Choose either a saved deck or custom cards.']);

    $this->actingAs($user)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 7',
            'deck' => 'custom',
            'saved_deck_id' => 'not-a-uuid',
        ])
        ->assertSessionHasErrors('saved_deck_id');

    expect($team->pokerGames()->count())->toBe(0)
        ->and($otherTeam->pokerGames()->count())->toBe(0);
});

it('saves the custom cards as a deck while creating the game', function () {
    [$team, $user] = savedDeckTeam();

    $this->actingAs($user)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 7',
            'deck' => 'custom',
            'custom_cards' => ['1', '3', '5'],
            'include_unknown' => true,
            'include_coffee' => false,
            'save_deck_as' => 'Odd scale',
        ])
        ->assertSessionHasNoErrors();

    $saved = $team->pokerDecks()->where('name', 'Odd scale')->sole();
    $game = $team->pokerGames()->sole();

    expect($saved->cards)->toBe(['1', '3', '5', '?'])
        ->and($saved->created_by_user_id)->toBe($user->id)
        ->and($game->cards)->toBe(['1', '3', '5', '?'])
        ->and($game->deck_name)->toBe('Odd scale');
});

it('creates nothing when the deck cannot be saved', function (string $case) {
    [$team, $user] = savedDeckTeam();

    if ($case === 'limit') {
        SavedPokerDeck::factory()->count(29)->create(['team_id' => $team->id]);
    }

    $name = $case === 'duplicate' ? 'TEAM SCALE' : 'Fresh name';

    $this->actingAs($user)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 7',
            'deck' => 'custom',
            'custom_cards' => ['1', '3', '5'],
            'save_deck_as' => $name,
        ])
        ->assertSessionHasErrors();

    expect($team->pokerGames()->count())->toBe(0)
        ->and($team->pokerDecks()->count())->toBe($case === 'limit' ? 30 : 1);
})->with(['duplicate', 'limit']);

it('saves only custom cards as a deck', function () {
    [$team, $user, $deck] = savedDeckTeam();

    $this->actingAs($user)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 7',
            'deck' => 'fibonacci',
            'save_deck_as' => 'Fibo copy',
        ])
        ->assertSessionHasErrors(['save_deck_as' => 'Save only custom cards as a deck.']);

    $this->actingAs($user)
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 7',
            'deck' => 'custom',
            'saved_deck_id' => $deck->id,
            'save_deck_as' => 'Copy',
        ])
        ->assertSessionHasErrors('save_deck_as');

    expect($team->pokerGames()->count())->toBe(0);
});

it('lists the team decks to the facilitator only', function () {
    [$team, $user, $deck] = savedDeckTeam();
    SavedPokerDeck::factory()->create(['name' => 'Elsewhere']);
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    [$facilitatorUser] = pokerFacilitator($game);
    [$memberUser] = pokerMember($game);

    $this->actingAs($facilitatorUser)
        ->getJson(route('poker.saved-decks.index', $game))
        ->assertOk()
        ->assertExactJson([['id' => $deck->id, 'name' => 'Team scale', 'cards' => ['1', '2', '4', '8', '?']]]);

    $this->actingAs($memberUser)
        ->getJson(route('poker.saved-decks.index', $game))
        ->assertForbidden();
});

it('re-decks a game from a saved deck until votes exist', function () {
    [$team, , $deck] = savedDeckTeam();
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    [$facilitatorUser, $facilitator] = pokerFacilitator($game);

    $this->actingAs($facilitatorUser)
        ->patchJson(route('poker.settings.update', $game), ['deck' => 'custom', 'saved_deck_id' => $deck->id])
        ->assertNoContent();

    expect($game->fresh()->cards)->toBe(['1', '2', '4', '8', '?'])
        ->and($game->fresh()->deck_name)->toBe('Team scale')
        ->and($game->fresh()->deck)->toBe(PokerDeck::Custom);

    $this->actingAs($facilitatorUser)
        ->patchJson(route('poker.settings.update', $game), ['deck' => 'tshirt'])
        ->assertNoContent();

    expect($game->fresh()->deck_name)->toBeNull();

    pokerVote(openPokerRound($game->fresh()), $facilitator, 'M');

    $this->actingAs($facilitatorUser)
        ->patchJson(route('poker.settings.update', $game), ['deck' => 'custom', 'saved_deck_id' => $deck->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['deck' => "The deck can't change once votes exist."]);

    expect($game->fresh()->deck)->toBe(PokerDeck::Tshirt);
});

it('refuses a foreign or mixed saved deck in the settings', function () {
    [$team] = savedDeckTeam();
    [, , $foreign] = savedDeckTeam();
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    [$facilitatorUser] = pokerFacilitator($game);

    $this->actingAs($facilitatorUser)
        ->patchJson(route('poker.settings.update', $game), ['deck' => 'custom', 'saved_deck_id' => $foreign->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['saved_deck_id' => 'Choose a saved deck of this team.']);

    $this->actingAs($facilitatorUser)
        ->patchJson(route('poker.settings.update', $game), ['deck' => 'custom', 'saved_deck_id' => $foreign->id, 'custom_cards' => ['1', '2']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['saved_deck_id' => 'Choose either a saved deck or custom cards.']);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/SavedPokerDecksTest.php tests/Feature/Poker/PokerSavedDeckGamesTest.php`
Expected: FAIL — `Class "App\Models\SavedPokerDeck" not found`.

- [ ] **Step 3: Migration, model, factory, relation**

Create `database/migrations/2026_10_03_100100_create_poker_decks_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('poker_decks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('name', 40);
            $table->json('cards');
            $table->foreignUuid('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('team_id');
        });

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('create unique index poker_decks_team_name_unique on poker_decks (team_id, lower(name))');
    }
};
```

Create `app/Models/SavedPokerDeck.php`:

```php
<?php

namespace App\Models;

use Database\Factories\SavedPokerDeckFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A team's saved custom deck. Games copy its cards and name, so editing or
 * deleting it never changes a game.
 *
 * @property string $id
 * @property string $team_id
 * @property string $name
 * @property array<int, string> $cards
 * @property string|null $created_by_user_id
 * @property-read Team $team
 * @property-read User|null $creator
 */
#[Fillable(['name', 'cards', 'created_by_user_id'])]
class SavedPokerDeck extends Model
{
    /** @use HasFactory<SavedPokerDeckFactory> */
    use HasFactory;

    use HasUuids;

    protected $table = 'poker_decks';

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    protected function casts(): array
    {
        return [
            'cards' => 'array',
        ];
    }
}
```

Create `database/factories/SavedPokerDeckFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SavedPokerDeck>
 */
class SavedPokerDeckFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'name' => fake()->unique()->words(2, true),
            'cards' => ['1', '2', '3', '?'],
            'created_by_user_id' => User::factory(),
        ];
    }
}
```

In `app/Models/Team.php` add (import `App\Models\SavedPokerDeck` is same namespace — none needed):

```php
    /** @return HasMany<SavedPokerDeck, $this> */
    public function pokerDecks(): HasMany
    {
        return $this->hasMany(SavedPokerDeck::class);
    }
```

`team_id` is set through the relation (`$team->pokerDecks()->create(...)`), so it is not fillable.

- [ ] **Step 4: Policy and rules**

Create `app/Policies/PokerDeckPolicy.php`:

```php
<?php

namespace App\Policies;

use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class PokerDeckPolicy
{
    public function viewAny(User $user, Team $team): bool
    {
        return $user->can('view', $team);
    }

    public function create(User $user, Team $team): bool
    {
        return $user->can('view', $team);
    }

    public function update(User $user, SavedPokerDeck $deck): Response
    {
        return $this->manage($user, $deck);
    }

    public function delete(User $user, SavedPokerDeck $deck): Response
    {
        return $this->manage($user, $deck);
    }

    private function manage(User $user, SavedPokerDeck $deck): Response
    {
        if ($user->canManage($deck->team->workspace)) {
            return Response::allow();
        }

        if ($deck->created_by_user_id === $user->id && $user->can('view', $deck->team)) {
            return Response::allow();
        }

        return Response::deny(__("Only the deck's creator or a workspace admin can change it."));
    }
}
```

In `app/Providers/AppServiceProvider.php` add `use App\Models\SavedPokerDeck;`, `use App\Policies\PokerDeckPolicy;`, `use Illuminate\Support\Facades\Gate;` and in `boot()` after `Passkeys::usePasskeyModel(...)`:

```php
        Gate::policy(SavedPokerDeck::class, PokerDeckPolicy::class);
```

(auto-discovery would look for `SavedPokerDeckPolicy`).

Create `app/Actions/Poker/SavedPokerDeckRules.php`:

```php
<?php

namespace App\Actions\Poker;

use App\Models\SavedPokerDeck;
use App\Models\Team;
use Closure;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SavedPokerDeckRules
{
    public const MaxDecks = 30;

    /**
     * Callers prepend `required`, `sometimes` or `nullable`.
     *
     * @return array<int, mixed>
     */
    public static function nameRules(Team $team, ?SavedPokerDeck $ignore = null): array
    {
        return [
            'string',
            'max:40',
            function (string $attribute, mixed $value, Closure $fail) use ($team, $ignore): void {
                if (! is_string($value)) {
                    return;
                }

                $isTaken = $team->pokerDecks()
                    ->whereRaw('lower(name) = ?', [mb_strtolower(trim($value))])
                    ->when($ignore !== null, fn ($query) => $query->whereKeyNot($ignore?->id))
                    ->exists();

                if ($isTaken) {
                    $fail(__('A deck with this name already exists.'));
                }
            },
        ];
    }

    /**
     * Call with the team row locked, inside the transaction that creates the deck.
     */
    public static function ensureRoom(Team $lockedTeam): void
    {
        if ($lockedTeam->pokerDecks()->count() < self::MaxDecks) {
            return;
        }

        throw ValidationException::withMessages(['name' => __('This team already has 30 saved decks.')]);
    }

    public static function findForTeam(Team $team, string $id, string $attribute = 'saved_deck_id'): SavedPokerDeck
    {
        $deck = Str::isUuid($id) ? $team->pokerDecks()->whereKey($id)->first() : null;

        if ($deck === null) {
            throw ValidationException::withMessages([$attribute => __('Choose a saved deck of this team.')]);
        }

        return $deck;
    }

    /**
     * A saved deck replaces custom cards, it never combines with them.
     *
     * @param  array<string, mixed>  $input
     */
    public static function ensureExclusive(array $input): void
    {
        if (! filled($input['saved_deck_id'] ?? null) || ! array_key_exists('custom_cards', $input)) {
            return;
        }

        throw ValidationException::withMessages(['saved_deck_id' => __('Choose either a saved deck or custom cards.')]);
    }
}
```

`TrimStrings` already trims request strings, so names are stored trimmed; the closure also trims for callers that bypass HTTP.

- [ ] **Step 5: Saved-deck endpoints and the team page prop**

Create `app/Http/Controllers/PokerDecksController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Poker\PokerDeckRules;
use App\Actions\Poker\SavedPokerDeckRules;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class PokerDecksController extends Controller
{
    public function store(Request $request, Workspace $workspace, Team $team): RedirectResponse
    {
        Gate::authorize('create', [SavedPokerDeck::class, $team]);

        $validated = $request->validate([
            'name' => ['required', ...SavedPokerDeckRules::nameRules($team)],
            'cards' => PokerDeckRules::cardListRules(),
            'cards.*' => PokerDeckRules::cardRules(),
            'include_unknown' => ['sometimes', 'boolean'],
            'include_coffee' => ['sometimes', 'boolean'],
        ]);

        DB::transaction(function () use ($request, $team, $validated): void {
            $lockedTeam = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

            SavedPokerDeckRules::ensureRoom($lockedTeam);

            $lockedTeam->pokerDecks()->create([
                'name' => $validated['name'],
                'cards' => $this->cards($validated),
                'created_by_user_id' => $request->user()->id,
            ]);
        });

        return back();
    }

    public function update(Request $request, Workspace $workspace, Team $team, SavedPokerDeck $pokerDeck): RedirectResponse
    {
        Gate::authorize('update', $pokerDeck);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', ...SavedPokerDeckRules::nameRules($team, $pokerDeck)],
            'cards' => ['sometimes', ...PokerDeckRules::cardListRules()],
            'cards.*' => PokerDeckRules::cardRules(),
            'include_unknown' => ['sometimes', 'boolean'],
            'include_coffee' => ['sometimes', 'boolean'],
        ]);

        $attributes = [];

        if (array_key_exists('name', $validated)) {
            $attributes['name'] = $validated['name'];
        }

        if (array_key_exists('cards', $validated)) {
            $attributes['cards'] = $this->cards($validated);
        }

        $pokerDeck->update($attributes);

        return back();
    }

    public function destroy(Workspace $workspace, Team $team, SavedPokerDeck $pokerDeck): RedirectResponse
    {
        Gate::authorize('delete', $pokerDeck);

        $pokerDeck->delete();

        return back();
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<int, string>
     */
    private function cards(array $validated): array
    {
        /** @var array<int, string> $cards */
        $cards = $validated['cards'];

        return PokerDeckRules::withSpecialCards(
            $cards,
            (bool) ($validated['include_unknown'] ?? true),
            (bool) ($validated['include_coffee'] ?? true),
        );
    }
}
```

Note `cardListRules()` starts with `required`; prefixing `sometimes` keeps it optional on update.

Create `app/Http/Controllers/Poker/PokerSavedDecksController.php`:

```php
<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\SavedPokerDeck;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PokerSavedDecksController extends Controller
{
    /**
     * Facilitator only: guests never facilitate, so they never see saved decks.
     */
    public function index(Request $request, PokerGame $game): JsonResponse
    {
        PokerGuard::facilitator($game, PokerPlayer::current($request));

        return response()->json($game->team->pokerDecks()->orderBy('name')->get()
            ->map(fn (SavedPokerDeck $deck): array => [
                'id' => $deck->id,
                'name' => $deck->name,
                'cards' => $deck->cards,
            ])
            ->values());
    }
}
```

In `routes/web.php` import both controllers and add, inside the `w/{workspace}` group after the `teams/{team}/estimates` line:

```php
            Route::post('teams/{team}/poker-decks', [PokerDecksController::class, 'store'])->name('teams.pokerDecks.store');
            Route::patch('teams/{team}/poker-decks/{pokerDeck}', [PokerDecksController::class, 'update'])->name('teams.pokerDecks.update')->whereUuid('pokerDeck');
            Route::delete('teams/{team}/poker-decks/{pokerDeck}', [PokerDecksController::class, 'destroy'])->name('teams.pokerDecks.destroy')->whereUuid('pokerDeck');
```

and inside the `poker/{game}` group after the `settings` line:

```php
        Route::get('saved-decks', [PokerSavedDecksController::class, 'index'])->name('poker.saved-decks.index');
```

The group's `scopeBindings()` resolves `{pokerDeck}` through `Team::pokerDecks()`: a deck of another team answers 404.

In `app/Http/Controllers/TeamsController.php` `show()` (import `App\Models\SavedPokerDeck`), add to the props:

```php
            'pokerDecks' => $this->pokerDecks($request->user(), $workspace, $team),
```

and the private method (one query; the manager check is computed once):

```php
    /**
     * @return array<int, array{id: string, name: string, cards: array<int, string>, canManage: bool}>
     */
    private function pokerDecks(User $user, Workspace $workspace, Team $team): array
    {
        $isManager = $user->canManage($workspace);

        return $team->pokerDecks()->orderBy('name')->get()
            ->map(fn (SavedPokerDeck $deck): array => [
                'id' => $deck->id,
                'name' => $deck->name,
                'cards' => $deck->cards,
                'canManage' => $isManager || $deck->created_by_user_id === $user->id,
            ])
            ->values()
            ->all();
    }
```

- [ ] **Step 6: Creating games from saved decks**

In `app/Actions/Poker/NewPokerGame.php` add a last constructor property:

```php
        public ?string $saveDeckAs = null,
```

In `app/Actions/Poker/CreatePokerGame.php`, at the very start of the `DB::transaction` closure (before the game is created; import `App\Actions\Poker\SavedPokerDeckRules` is same namespace — none needed):

```php
            if ($new->saveDeckAs !== null) {
                $lockedTeam = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

                SavedPokerDeckRules::ensureRoom($lockedTeam);

                $lockedTeam->pokerDecks()->create([
                    'name' => $new->saveDeckAs,
                    'cards' => $new->cards,
                    'created_by_user_id' => $creator->id,
                ]);
            }
```

(`$team` and `$creator` are `handle()`'s parameters; add them to the closure's `use` list if Plan 10a's closure does not capture them yet.) A 422 from `ensureRoom` rolls the whole transaction back, so neither the game nor the deck exists.

Replace `TeamPokerGamesController::store()` with (imports: `App\Actions\Poker\SavedPokerDeckRules`, `App\Enums\PokerDeck`, `Illuminate\Validation\Rule`, `Illuminate\Validation\ValidationException`):

```php
    public function store(Request $request, Workspace $workspace, Team $team, CreatePokerGame $createPokerGame): RedirectResponse
    {
        Gate::authorize('createPokerGame', $team);

        SavedPokerDeckRules::ensureExclusive($request->all());
        $this->ensureSavableDeck($request);

        $usesSavedDeck = $request->filled('saved_deck_id');

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            ...($usesSavedDeck
                ? ['deck' => ['required', Rule::in([PokerDeck::Custom->value])], 'saved_deck_id' => ['required', 'string']]
                : PokerDeckRules::rules()),
            'save_deck_as' => ['nullable', ...SavedPokerDeckRules::nameRules($team)],
            'anonymous_votes' => ['sometimes', 'boolean'],
            'auto_reveal' => ['sometimes', 'boolean'],
        ]);

        if ($usesSavedDeck) {
            $savedDeck = SavedPokerDeckRules::findForTeam($team, (string) $validated['saved_deck_id']);
            [$deck, $cards, $deckName] = [PokerDeck::Custom, $savedDeck->cards, $savedDeck->name];
        } else {
            [$deck, $cards] = PokerDeckRules::resolve($validated);
            $deckName = $validated['save_deck_as'] ?? null;
        }

        $game = $createPokerGame->handle($team, $request->user(), new NewPokerGame(
            title: $validated['title'],
            deck: $deck,
            cards: $cards,
            deckName: $deckName,
            anonymousVotes: (bool) ($validated['anonymous_votes'] ?? false),
            autoReveal: (bool) ($validated['auto_reveal'] ?? false),
            saveDeckAs: $validated['save_deck_as'] ?? null,
        ));

        return to_route('poker.show', $game);
    }

    /**
     * Only cards typed for this game can become a new saved deck.
     */
    private function ensureSavableDeck(Request $request): void
    {
        if (! $request->filled('save_deck_as')) {
            return;
        }

        if ($request->input('deck') === PokerDeck::Custom->value && ! $request->filled('saved_deck_id')) {
            return;
        }

        throw ValidationException::withMessages(['save_deck_as' => __('Save only custom cards as a deck.')]);
    }
```

(Keep whatever else Plan 10a's `store` did — e.g. `(bool)` casting — identical; only the deck resolution and the two new fields change.)

- [ ] **Step 7: Re-decking a game from a saved deck**

In `app/Http/Controllers/Poker/PokerSettingsController.php`:

1. Before `$request->validate(...)` call `SavedPokerDeckRules::ensureExclusive($request->all());` and replace the spread of `PokerDeckRules::rules(deckRequired: false)` in the validation array with:

```php
            ...($request->filled('saved_deck_id')
                ? ['deck' => ['sometimes', Rule::in([PokerDeck::Custom->value])], 'saved_deck_id' => ['required', 'string']]
                : PokerDeckRules::rules(deckRequired: false)),
```

2. Extend the "deck can't change once votes exist" check so it also fires for a saved deck — replace `if (array_key_exists('deck', $validated) && $locked->hasVotes()) {` with:

```php
            $changesDeck = array_key_exists('deck', $validated) || array_key_exists('saved_deck_id', $validated);

            if ($changesDeck && $locked->hasVotes()) {
```

3. In `attributes(array $validated, PokerGame $locked): array`, put the saved-deck branch before Plan 10a's deck branch:

```php
        if (array_key_exists('saved_deck_id', $validated)) {
            $savedDeck = SavedPokerDeckRules::findForTeam($locked->team, (string) $validated['saved_deck_id']);

            $attributes['deck'] = PokerDeck::Custom;
            $attributes['cards'] = $savedDeck->cards;
            $attributes['deck_name'] = $savedDeck->name;
        } elseif (array_key_exists('deck', $validated)) {
            [$deck, $cards] = PokerDeckRules::resolve($validated);

            $attributes = [...$attributes, 'deck' => $deck, 'cards' => $cards, 'deck_name' => null];
        }
```

(this replaces Plan 10a's `if (array_key_exists('deck', $validated)) { … }` block, which becomes the `elseif`; the `Arr::only()` line above it and the `return $attributes;` stay.) Imports: `App\Actions\Poker\SavedPokerDeckRules`, `App\Enums\PokerDeck`, `Illuminate\Validation\Rule`.

- [ ] **Step 8: Translations**

Append to `lang/en.json`:

```json
    "Only the deck's creator or a workspace admin can change it.": "Only the deck's creator or a workspace admin can change it.",
    "This team already has 30 saved decks.": "This team already has 30 saved decks.",
    "A deck with this name already exists.": "A deck with this name already exists.",
    "Choose a saved deck of this team.": "Choose a saved deck of this team.",
    "Choose either a saved deck or custom cards.": "Choose either a saved deck or custom cards.",
    "Save only custom cards as a deck.": "Save only custom cards as a deck."
```

`lang/fr.json`:

```json
    "Only the deck's creator or a workspace admin can change it.": "Seuls la personne qui a créé ce jeu de cartes ou un administrateur de l'espace de travail peuvent le modifier.",
    "This team already has 30 saved decks.": "Cette équipe a déjà 30 jeux de cartes enregistrés.",
    "A deck with this name already exists.": "Un jeu de cartes porte déjà ce nom.",
    "Choose a saved deck of this team.": "Choisissez un jeu de cartes enregistré de cette équipe.",
    "Choose either a saved deck or custom cards.": "Choisissez soit un jeu de cartes enregistré, soit des cartes personnalisées.",
    "Save only custom cards as a deck.": "Seules des cartes personnalisées peuvent être enregistrées comme jeu de cartes."
```

`lang/es.json`:

```json
    "Only the deck's creator or a workspace admin can change it.": "Solo quien creó la baraja o un administrador del espacio de trabajo puede cambiarla.",
    "This team already has 30 saved decks.": "Este equipo ya tiene 30 barajas guardadas.",
    "A deck with this name already exists.": "Ya existe una baraja con este nombre.",
    "Choose a saved deck of this team.": "Elige una baraja guardada de este equipo.",
    "Choose either a saved deck or custom cards.": "Elige una baraja guardada o cartas personalizadas, no ambas.",
    "Save only custom cards as a deck.": "Solo puedes guardar cartas personalizadas como baraja."
```

`lang/de.json`:

```json
    "Only the deck's creator or a workspace admin can change it.": "Nur die Person, die das Deck erstellt hat, oder ein Admin des Arbeitsbereichs kann es ändern.",
    "This team already has 30 saved decks.": "Dieses Team hat bereits 30 gespeicherte Decks.",
    "A deck with this name already exists.": "Es gibt bereits ein Deck mit diesem Namen.",
    "Choose a saved deck of this team.": "Wähle ein gespeichertes Deck dieses Teams.",
    "Choose either a saved deck or custom cards.": "Wähle entweder ein gespeichertes Deck oder eigene Karten.",
    "Save only custom cards as a deck.": "Nur eigene Karten können als Deck gespeichert werden."
```

(Add a comma after the previous last entry of each file.)

- [ ] **Step 9: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && vendor/bin/sail artisan test --compact tests/Feature/Poker tests/Feature/TranslationKeysTest.php tests/Feature/UuidPrimaryKeysTest.php`
Expected: PASS (`CreatePokerGameTest` and `PokerSettingsTest` of Plan 10a stay green: without `saved_deck_id` the rules are unchanged).

- [ ] **Step 10: Format and analyse**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`
Expected: no changes left, 0 errors.

- [ ] **Step 11: Commit**

```bash
git add database/migrations/2026_10_03_100100_create_poker_decks_table.php app/Models/SavedPokerDeck.php database/factories/SavedPokerDeckFactory.php app/Models/Team.php app/Policies/PokerDeckPolicy.php app/Providers/AppServiceProvider.php app/Actions/Poker/SavedPokerDeckRules.php app/Actions/Poker/NewPokerGame.php app/Actions/Poker/CreatePokerGame.php app/Http/Controllers/PokerDecksController.php app/Http/Controllers/Poker/PokerSavedDecksController.php app/Http/Controllers/TeamPokerGamesController.php app/Http/Controllers/Poker/PokerSettingsController.php app/Http/Controllers/TeamsController.php routes/web.php lang/en.json lang/fr.json lang/es.json lang/de.json tests/Feature/Poker/SavedPokerDecksTest.php tests/Feature/Poker/PokerSavedDeckGamesTest.php
git commit -m "feat: save custom poker decks per team

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes

- `SavedPokerDeckRules::nameRules()` returns `['string', 'max:40', closure]` **without** `required`, so callers can prepend `required` (deck endpoints), `sometimes`+`required` (update) or `nullable` (`save_deck_as`); the outline said it includes `required`. `findForTeam()` gained an optional `$attribute` argument and a fourth helper `ensureExclusive(array $input)` implements "Choose either a saved deck or custom cards." (Laravel's `prohibits` interacts badly with 10a's `exclude_unless:deck,custom` on `custom_cards`, so exclusivity is checked on the raw input before validation, and a saved-deck request swaps 10a's deck rules for `deck in:custom` + `saved_deck_id`).
- A game created with `save_deck_as` also gets `deck_name` = that name (the outline was silent; spec §3d says a saved deck's name is copied into games that use it).
- Tasks 1–5 assume Plan 10a's `PokerVoteChanged` constructor promotes public properties (`$roundId`, `$votesCount`, …) and `PokerGameChanged`/`PokerRoundChanged` expose a public `$gameId` (inherited from `PokerBroadcastEvent`); the tests read them.

### Task 6: Board-agnostic realtime layers (extraction from spec 1)

**Files:**
- Create: `resources/js/lib/realtime/whisper-transport.ts` (moved verbatim from `resources/js/lib/retro/whisper-transport.ts`, which is deleted), `resources/js/components/realtime/live-cursors.tsx`, `resources/js/components/realtime/flying-reactions.tsx`
- Modify: `resources/js/components/retro/live-cursor-layer.tsx`, `resources/js/components/retro/flying-reactions.tsx` (thin wrappers), every importer of the old whisper path (`resources/js/components/retro/board-context.tsx`, `resources/js/hooks/use-retro-channel.ts`, `resources/js/hooks/use-poker-channel.ts`, `resources/js/components/poker/game-context.tsx`, and any other hit of `grep -rn "lib/retro/whisper-transport" resources/js`)

**Interfaces:**
- Consumes: `live-cursors`, `live-cursors/react`, `live-reactions`, `live-reactions/react`, `EmojiPicker` (`@/components/retro/emoji-picker`), `isSingleEmoji`, `QuickEmoji` (`@/lib/retro/emoji`), `PresenceMember` (`@/lib/retro/types`).
- Produces:
  - `resources/js/lib/realtime/whisper-transport.ts`: `WhisperChannel`, `whisperTransport`, `channelKey` (unchanged).
  - `LiveCursors({ presence, container, hidden, selfId, online, labelFor }: { presence: WhisperChannel; container: HTMLElement | null; hidden: boolean; selfId: string; online: PresenceMember[]; labelFor: (senderId: string) => string })` — everything the retro `Cursors` + `useTouchSender` did (roster check from `online`, 40 ms throttle, touch/pen sender, removal of cursors that left). Callers decide whether to mount it (the spec's `enabled` is the caller not rendering it) and key it by `channelKey(presence)`.
  - `FlyingReactions({ presence, selfId, online, labelFor, originFor, toolbarProps }: { presence: WhisperChannel; selfId: string; online: PresenceMember[]; labelFor: (senderId: string) => string | null; originFor: (senderId: string) => number; toolbarProps?: HTMLAttributes<HTMLDivElement> })` — roster + single-emoji + token-bucket (burst 5, 2/s) receive checks, quick emoji bar + picker; also exports `avatarOrigin(senderId: string): number` (avatar-based origin, random centre fallback) and `centreOrigin(): number`.
  - Retro wrappers keep their exports and behaviour: `LiveCursorLayer`, `HideMyCursorKey`, `showsCursors` (`resources/js/components/retro/live-cursor-layer.tsx`) and `FlyingReactions` (`resources/js/components/retro/flying-reactions.tsx`) — anonymous retros still label cursors "Participant", reactions carry no name and rise from near the centre; `CursorlessPhases` stays `['voting', 'completed']`; the retro reactions bar keeps `dragIsolation`.

- [ ] **Step 1: Move the whisper transport**

```bash
mkdir -p resources/js/lib/realtime resources/js/components/realtime
git mv resources/js/lib/retro/whisper-transport.ts resources/js/lib/realtime/whisper-transport.ts
grep -rln "lib/retro/whisper-transport" resources/js
```

The file content does not change. In every file the grep lists (expected: `resources/js/components/retro/board-context.tsx`, `resources/js/hooks/use-retro-channel.ts`, `resources/js/components/retro/live-cursor-layer.tsx`, `resources/js/components/retro/flying-reactions.tsx`, `resources/js/hooks/use-poker-channel.ts`, `resources/js/components/poker/game-context.tsx`) replace the import path:

```bash
grep -rln "lib/retro/whisper-transport" resources/js | xargs sed -i '' "s#@/lib/retro/whisper-transport#@/lib/realtime/whisper-transport#g"
grep -rn "lib/retro/whisper-transport" resources/js docs/superpowers/specs || echo "no old path left"
```

Expected: `no old path left` (the retro layer files are rewritten in Steps 4 and 5 anyway; spec 7 already names the new path).

- [ ] **Step 2: Shared live cursors**

Create `resources/js/components/realtime/live-cursors.tsx`:

```tsx
import {
    elementSpace,
    leaveMessage,
    moveMessage,
    type RemoteCursor,
} from 'live-cursors';
import { LiveCursors as CursorLayer, useCursors } from 'live-cursors/react';
import { MousePointer2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    whisperTransport,
    type WhisperChannel,
} from '@/lib/realtime/whisper-transport';
import type { PresenceMember } from '@/lib/retro/types';

const ThrottleMs = 40;

type Props = {
    presence: WhisperChannel;
    container: HTMLElement | null;
    hidden: boolean;
    selfId: string;
    online: PresenceMember[];
    labelFor: (senderId: string) => string;
};

type CursorSender = { send(message: unknown): void };

/**
 * Board-agnostic cursor layer over a presence channel. Callers mount it only
 * when cursors are allowed and key it by the channel, so a new channel
 * object rebuilds the transport.
 */
export function LiveCursors({
    presence,
    container,
    hidden,
    selfId,
    online,
    labelFor,
}: Props) {
    const rosterKey = online.map((member) => member.id).join(',');
    const roster = useRef(new Set<string>());

    useEffect(() => {
        roster.current = new Set(rosterKey === '' ? [] : rosterKey.split(','));
    }, [rosterKey]);

    const [transport] = useState(() =>
        whisperTransport(presence, 'cursor', (senderId) =>
            roster.current.has(senderId),
        ),
    );

    const { cursors } = useCursors({
        transport: () => transport,
        selfId,
        container,
        enabled: !hidden,
    });

    useEffect(() => {
        cursors?.setEnabled(!hidden);
    }, [cursors, hidden]);

    useEffect(() => {
        if (!cursors) {
            return;
        }

        const members = new Set(rosterKey === '' ? [] : rosterKey.split(','));

        for (const cursor of cursors.getSnapshot()) {
            if (!members.has(cursor.id)) {
                cursors.remove(cursor.id);
            }
        }
    }, [cursors, rosterKey]);

    useTouchSender(container, selfId, hidden, transport);

    const label = (cursor: RemoteCursor) => labelFor(cursor.id);

    return (
        <CursorLayer cursors={cursors}>
            {(cursor, color) =>
                cursor.meta?.p === 'touch' || cursor.meta?.p === 'pen' ? (
                    <span className="flex items-center gap-1">
                        <span
                            className="block size-4 rounded-full border-2 border-white shadow"
                            style={{ backgroundColor: color }}
                        />
                        <span className="lc-label" style={{ marginTop: 0 }}>
                            {label(cursor)}
                        </span>
                    </span>
                ) : (
                    <span className="flex items-start gap-0.5">
                        <MousePointer2
                            className="size-4 drop-shadow"
                            style={{ color, fill: color }}
                            aria-hidden="true"
                        />
                        <span className="lc-label">{label(cursor)}</span>
                    </span>
                )
            }
        </CursorLayer>
    );
}

/**
 * The library tracks the mouse only; touch and pen have no hover, so their
 * position is shared while the finger or pen is down.
 */
function useTouchSender(
    container: HTMLElement | null,
    selfId: string,
    hidden: boolean,
    transport: CursorSender,
) {
    useEffect(() => {
        if (!container || hidden) {
            return;
        }

        const space = elementSpace(container);
        let last = 0;
        let pending: ReturnType<typeof setTimeout> | null = null;
        let active = false;

        const cancelPending = () => {
            if (pending) {
                clearTimeout(pending);
                pending = null;
            }
        };

        const send = (event: PointerEvent) => {
            pending = null;
            last = Date.now();

            const point = space.toNormalized(event);

            if (point) {
                transport.send(
                    moveMessage(selfId, point.x, point.y, {
                        p: event.pointerType,
                    }),
                );
            }
        };

        const onMove = (event: PointerEvent) => {
            if (event.pointerType === 'mouse' || !active) {
                return;
            }

            cancelPending();

            const wait = ThrottleMs - (Date.now() - last);

            if (wait <= 0) {
                send(event);

                return;
            }

            pending = setTimeout(() => send(event), wait);
        };

        const onDown = (event: PointerEvent) => {
            if (event.pointerType === 'mouse') {
                return;
            }

            active = true;
            send(event);
        };

        const onUp = (event: PointerEvent) => {
            if (event.pointerType === 'mouse' || !active) {
                return;
            }

            active = false;
            cancelPending();
            transport.send(leaveMessage(selfId));
        };

        container.addEventListener('pointerdown', onDown);
        container.addEventListener('pointermove', onMove);
        container.addEventListener('pointerup', onUp);
        container.addEventListener('pointercancel', onUp);

        return () => {
            cancelPending();
            container.removeEventListener('pointerdown', onDown);
            container.removeEventListener('pointermove', onMove);
            container.removeEventListener('pointerup', onUp);
            container.removeEventListener('pointercancel', onUp);
        };
    }, [container, selfId, hidden, transport]);
}
```

- [ ] **Step 3: Shared flying reactions**

Create `resources/js/components/realtime/flying-reactions.tsx`:

```tsx
import { tokenBucket, type TokenBucket } from 'live-reactions';
import { LiveReactions, useReactions } from 'live-reactions/react';
import { SmilePlus } from 'lucide-react';
import { useEffect, useRef, useState, type HTMLAttributes } from 'react';
import { EmojiPicker } from '@/components/retro/emoji-picker';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import {
    whisperTransport,
    type WhisperChannel,
} from '@/lib/realtime/whisper-transport';
import { isSingleEmoji, QuickEmoji } from '@/lib/retro/emoji';
import type { PresenceMember } from '@/lib/retro/types';
import { cn } from '@/lib/utils';

const ReceiveLimit = { burst: 5, perSecond: 2 };

type Props = {
    presence: WhisperChannel;
    selfId: string;
    online: PresenceMember[];
    labelFor: (senderId: string) => string | null;
    originFor: (senderId: string) => number;
    toolbarProps?: HTMLAttributes<HTMLDivElement>;
};

export function centreOrigin(): number {
    return 0.4 + Math.random() * 0.2;
}

/** Rises from above the sender's avatar in the presence strip, else near the centre. */
export function avatarOrigin(senderId: string): number {
    const avatar = document.querySelector(
        `[data-presence-id="${CSS.escape(senderId)}"]`,
    );

    if (!avatar) {
        return centreOrigin();
    }

    const rect = avatar.getBoundingClientRect();
    const origin = (rect.left + rect.width / 2) / window.innerWidth;

    return Math.min(1, Math.max(0, origin));
}

/**
 * Board-agnostic reactions bar and flying layer. Callers mount it only when
 * reactions are allowed and key it by the channel.
 */
export function FlyingReactions({
    presence,
    selfId,
    online,
    labelFor,
    originFor,
    toolbarProps,
}: Props) {
    const { t } = useTrans();
    const rosterKey = online.map((member) => member.id).join(',');
    const roster = useRef(new Set<string>());
    const buckets = useRef(new Map<string, TokenBucket>());
    const origin = useRef(originFor);

    origin.current = originFor;

    useEffect(() => {
        roster.current = new Set(rosterKey === '' ? [] : rosterKey.split(','));
    }, [rosterKey]);

    const [transport] = useState(() =>
        whisperTransport(presence, 'reaction', (senderId, raw) => {
            if (!roster.current.has(senderId)) {
                return false;
            }

            if (!isSingleEmoji((raw as { e?: unknown } | null)?.e)) {
                return false;
            }

            let bucket = buckets.current.get(senderId);

            if (!bucket) {
                bucket = tokenBucket(ReceiveLimit);
                buckets.current.set(senderId, bucket);
            }

            return bucket.take();
        }),
    );

    const { reactions, send } = useReactions({
        transport: () => transport,
        selfId,
        origin: (senderId) => origin.current(senderId),
    });

    const { className, ...restToolbarProps } = toolbarProps ?? {};

    return (
        <>
            <LiveReactions
                reactions={reactions}
                label={(reaction) => labelFor(reaction.senderId)}
            />
            <div
                {...restToolbarProps}
                role="toolbar"
                aria-label={t('Reactions')}
                className={cn(
                    'fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/95 px-2 py-1 shadow-lg',
                    className,
                )}
            >
                {QuickEmoji.map((emoji) => (
                    <Button
                        key={emoji}
                        size="icon"
                        variant="ghost"
                        className="size-9 text-lg"
                        aria-label={`${t('Send a reaction')} ${emoji}`}
                        onClick={() => send(emoji)}
                    >
                        {emoji}
                    </Button>
                ))}
                <EmojiPicker
                    label={t('Send a reaction')}
                    onPick={(emoji) => send(emoji)}
                >
                    <Button size="icon" variant="ghost" className="size-9">
                        <SmilePlus className="size-4" />
                    </Button>
                </EmojiPicker>
            </div>
        </>
    );
}
```

- [ ] **Step 4: Retro cursor wrapper**

Replace `resources/js/components/retro/live-cursor-layer.tsx` with:

```tsx
import { LiveCursors } from '@/components/realtime/live-cursors';
import { useTrans } from '@/hooks/use-trans';
import { channelKey } from '@/lib/realtime/whisper-transport';
import { useBoard } from './board-context';

export const HideMyCursorKey = 'skrum.hideMyCursor';

/**
 * During Voting a named pointer on a vote button would reveal who votes
 * where, so no cursor is sent or shown.
 */
const CursorlessPhases = ['voting', 'completed'];

export function showsCursors(retro: {
    cursorsEnabled: boolean;
    phase: string;
}): boolean {
    return retro.cursorsEnabled && !CursorlessPhases.includes(retro.phase);
}

type Props = {
    container: HTMLElement | null;
    hidden: boolean;
};

export function LiveCursorLayer({ container, hidden }: Props) {
    const { board, presence, online } = useBoard();
    const { t } = useTrans();

    if (!presence || !showsCursors(board.retro)) {
        return null;
    }

    const labelFor = (senderId: string) =>
        board.retro.isAnonymous
            ? t('Participant')
            : (online.find((member) => member.id === senderId)?.name ??
              t('Participant'));

    return (
        <LiveCursors
            key={`${board.retro.id}:${channelKey(presence)}`}
            presence={presence}
            container={container}
            hidden={hidden}
            selfId={board.viewer.participantId}
            online={online}
            labelFor={labelFor}
        />
    );
}
```

- [ ] **Step 5: Retro reactions wrapper**

Replace `resources/js/components/retro/flying-reactions.tsx` with:

```tsx
import {
    avatarOrigin,
    centreOrigin,
    FlyingReactions as SharedFlyingReactions,
} from '@/components/realtime/flying-reactions';
import { channelKey } from '@/lib/realtime/whisper-transport';
import { useBoard } from './board-context';
import { dragIsolation } from './dnd';

export function FlyingReactions() {
    const { board, presence, online } = useBoard();

    if (
        !presence ||
        !board.retro.reactionsEnabled ||
        board.retro.phase === 'completed'
    ) {
        return null;
    }

    const isAnonymous = board.retro.isAnonymous;

    return (
        <SharedFlyingReactions
            key={`${board.retro.id}:${channelKey(presence)}`}
            presence={presence}
            selfId={board.viewer.participantId}
            online={online}
            labelFor={(senderId) =>
                isAnonymous
                    ? null
                    : (online.find((member) => member.id === senderId)
                          ?.name ?? null)
            }
            originFor={(senderId) =>
                isAnonymous ? centreOrigin() : avatarOrigin(senderId)
            }
            toolbarProps={dragIsolation}
        />
    );
}
```

(On anonymous retros an avatar origin or a name would reveal who reacted, so both stay off — same rule as before the extraction. The `originFor` closure is read through a ref inside the shared component, so switching anonymity mid-session takes effect on the next reaction, as the old `isAnonymous` ref did.)

- [ ] **Step 6: Checks**

Run: `npm run types:check && npm run check`
Expected: green except the known pre-existing failures (`.devcontainer/devcontainer.json`, `docs/superpowers/*.md`).

Run: `npx vp check --fix resources/js/lib/realtime/whisper-transport.ts resources/js/components/realtime/live-cursors.tsx resources/js/components/realtime/flying-reactions.tsx resources/js/components/retro/live-cursor-layer.tsx resources/js/components/retro/flying-reactions.tsx resources/js/components/retro/board-context.tsx resources/js/hooks/use-retro-channel.ts resources/js/hooks/use-poker-channel.ts resources/js/components/poker/game-context.tsx`

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: PASS (no new key; `Participant`, `Reactions`, `Send a reaction` exist).

- [ ] **Step 7: Retro smoke check (manual, recorded in the ledger)**

`npm run dev`, open one retro in two browsers (member + guest): in `Writing` both see each other's named cursor and flying reactions rising from the sender's avatar; move to `Voting` — cursors disappear, reactions still fly; on an anonymous retro cursors read "Participant" and reactions carry no name and rise near the centre; dragging a card still works while the reactions bar is focused (drag isolation). Task 11 repeats this in the full walkthrough.

- [ ] **Step 8: Commit**

```bash
git add resources/js/lib/realtime/whisper-transport.ts resources/js/lib/retro/whisper-transport.ts resources/js/components/realtime/live-cursors.tsx resources/js/components/realtime/flying-reactions.tsx resources/js/components/retro/live-cursor-layer.tsx resources/js/components/retro/flying-reactions.tsx resources/js/components/retro/board-context.tsx resources/js/hooks/use-retro-channel.ts resources/js/hooks/use-poker-channel.ts resources/js/components/poker/game-context.tsx
git commit -m "refactor: extract board-agnostic cursor and reaction layers

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

### Task 7: Poker cursors, flying reactions and "Hide my cursor"

**Files:**
- Create: `resources/js/components/poker/game-cursors.tsx`, `resources/js/components/poker/game-reactions.tsx`
- Modify: `resources/js/components/poker/game.tsx` (mount both), `resources/js/components/poker/game-header.tsx` ("Hide my cursor" button), `lang/{en,fr,es,de}.json` (only new keys)

**Interfaces:**
- Consumes: Task 6 (`LiveCursors`, `FlyingReactions`, `avatarOrigin`, `channelKey`); Plan 10a `useGame()` (`snapshot`, `online`, `presence`), `PokerSnapshot`; `useLocalPreference`; `HideMyCursorKey` (`@/components/retro/live-cursor-layer`).
- Produces:
  - `export function showsPokerCursors(snapshot: PokerSnapshot): boolean` — `game.cursorsEnabled && game.endedAt === null && (snapshot.current === null || snapshot.current.round.revealedAt !== null)`.
  - `GameCursors({ container, hidden }: { container: HTMLElement | null; hidden: boolean })` — nothing unless `presence` and `showsPokerCursors(snapshot)`; otherwise the shared `LiveCursors` keyed by `${game.id}:${channelKey(presence)}`, label = the player's name, else the presence name, else `t('Player')`.
  - `GameReactions()` — nothing unless `presence`, `game.reactionsEnabled` and the game is not ended; otherwise the shared `FlyingReactions` with `labelFor` = player name, `originFor` = `avatarOrigin`, bar lifted above the hand (`toolbarProps={{ className: 'bottom-28' }}`).
  - `GameHeader` gains optional props `hideMyCursor?: boolean` and `onHideMyCursorChange?: (hidden: boolean) => void` and shows the toggle when both are given and `showsPokerCursors(snapshot)`; `Game` owns the preference (`useLocalPreference(HideMyCursorKey, false)`, the same `skrum.hideMyCursor` key as the retro board), mounts `<GameCursors container={mainPane} hidden={hideMyCursor} />` inside `<main>` and `<GameReactions />` after the layout.

- [ ] **Step 1: Cursor layer**

Create `resources/js/components/poker/game-cursors.tsx`:

```tsx
import { LiveCursors } from '@/components/realtime/live-cursors';
import { useTrans } from '@/hooks/use-trans';
import type { PokerSnapshot } from '@/lib/poker/types';
import { channelKey } from '@/lib/realtime/whisper-transport';
import { useGame } from './game-context';

/**
 * The hand sits at a fixed place, so a named pointer over a card would give
 * away a hidden vote: no cursor is sent or shown while a round is open, nor
 * on an ended (read-only) game.
 */
export function showsPokerCursors(snapshot: PokerSnapshot): boolean {
    return (
        snapshot.game.cursorsEnabled &&
        snapshot.game.endedAt === null &&
        (snapshot.current === null ||
            snapshot.current.round.revealedAt !== null)
    );
}

type Props = {
    container: HTMLElement | null;
    hidden: boolean;
};

export function GameCursors({ container, hidden }: Props) {
    const { snapshot, presence, online } = useGame();
    const { t } = useTrans();

    if (!presence || !showsPokerCursors(snapshot)) {
        return null;
    }

    const labelFor = (senderId: string) =>
        snapshot.players.find((player) => player.id === senderId)?.name ??
        online.find((member) => member.id === senderId)?.name ??
        t('Player');

    return (
        <LiveCursors
            key={`${snapshot.game.id}:${channelKey(presence)}`}
            presence={presence}
            container={container}
            hidden={hidden}
            selfId={snapshot.me.playerId}
            online={online}
            labelFor={labelFor}
        />
    );
}
```

Unmounting the layer when a round opens (after the `round.changed` refetch) makes the library send its leave message, so every other browser drops this cursor.

- [ ] **Step 2: Reactions**

Create `resources/js/components/poker/game-reactions.tsx`:

```tsx
import {
    avatarOrigin,
    FlyingReactions,
} from '@/components/realtime/flying-reactions';
import { channelKey } from '@/lib/realtime/whisper-transport';
import { useGame } from './game-context';

/** Allowed in every round state: an emoji carries no card value. */
export function GameReactions() {
    const { snapshot, presence, online } = useGame();

    if (
        !presence ||
        !snapshot.game.reactionsEnabled ||
        snapshot.game.endedAt !== null
    ) {
        return null;
    }

    return (
        <FlyingReactions
            key={`${snapshot.game.id}:${channelKey(presence)}`}
            presence={presence}
            selfId={snapshot.me.playerId}
            online={online}
            labelFor={(senderId) =>
                snapshot.players.find((player) => player.id === senderId)
                    ?.name ?? null
            }
            originFor={avatarOrigin}
            toolbarProps={{ className: 'bottom-28' }}
        />
    );
}
```

- [ ] **Step 3: "Hide my cursor" in the header**

In `resources/js/components/poker/game-header.tsx` (Plan 10a Task 14):

1. Change the `lucide-react` import to `import { ArrowLeft, MousePointer2, MousePointerBan } from 'lucide-react';` and add `import { Button } from '@/components/ui/button';` and `import { showsPokerCursors } from './game-cursors';`.

2. Replace the props type and signature:

```tsx
type Props = {
    actions?: ReactNode;
    hideMyCursor?: boolean;
    onHideMyCursorChange?: (hidden: boolean) => void;
};

export function GameHeader({
    actions,
    hideMyCursor,
    onHideMyCursorChange,
}: Props) {
```

3. Right after `<PresenceStrip members={online} />` add:

```tsx
                {hideMyCursor !== undefined &&
                    onHideMyCursorChange &&
                    showsPokerCursors(snapshot) && (
                        <Button
                            size="icon"
                            variant="ghost"
                            aria-pressed={hideMyCursor}
                            aria-label={
                                hideMyCursor
                                    ? t('Show my cursor')
                                    : t('Hide my cursor')
                            }
                            onClick={() => onHideMyCursorChange(!hideMyCursor)}
                        >
                            {hideMyCursor ? (
                                <MousePointerBan className="size-4" />
                            ) : (
                                <MousePointer2 className="size-4" />
                            )}
                        </Button>
                    )}
```

- [ ] **Step 4: Mount both in the game**

In `resources/js/components/poker/game.tsx` (Plan 10a Task 14):

1. Imports:

```tsx
import { HideMyCursorKey } from '@/components/retro/live-cursor-layer';
import { useLocalPreference } from '@/hooks/use-local-preference';
import { GameCursors } from './game-cursors';
import { GameReactions } from './game-reactions';
```

2. Replace `const [, setMainPane] = useState<HTMLElement | null>(null);` with:

```tsx
    const [mainPane, setMainPane] = useState<HTMLElement | null>(null);
    const [hideMyCursor, setHideMyCursor] = useLocalPreference(
        HideMyCursorKey,
        false,
    );
```

(both before the `game.status !== 'active'` early return, so the hook order never changes).

3. Pass the preference to the header: add `hideMyCursor={hideMyCursor}` and `onHideMyCursorChange={setHideMyCursor}` to `<GameHeader actions={…} />`.

4. Inside `<main ref={setMainPane} …>`, after `<Table />`, add `<GameCursors container={mainPane} hidden={hideMyCursor} />`; after the closing `</div>` of `<div className="flex min-h-dvh flex-col">` (still inside `GameProvider`) add `<GameReactions />`.

- [ ] **Step 5: Translation**

Append to each file (keep every existing value):

`lang/en.json`: `"Player": "Player"`
`lang/fr.json`: `"Player": "Joueur"`
`lang/es.json`: `"Player": "Jugador"`
`lang/de.json`: `"Player": "Spieler"`

- [ ] **Step 6: Checks**

Run: `npm run types:check && npm run check` — green except the known pre-existing failures.
Run: `npx vp check --fix resources/js/components/poker/game-cursors.tsx resources/js/components/poker/game-reactions.tsx resources/js/components/poker/game-header.tsx resources/js/components/poker/game.tsx`
Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php` — PASS.

- [ ] **Step 7: Commit**

```bash
git add resources/js/components/poker/game-cursors.tsx resources/js/components/poker/game-reactions.tsx resources/js/components/poker/game-header.tsx resources/js/components/poker/game.tsx lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat: show live cursors and flying reactions in poker games

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

### Task 8: Spectator, anonymous, timer and auto-reveal UI

**Files:**
- Create: `resources/js/components/poker/{spectator-toggle,watching-row,anonymous-values-row,round-timer-control,auto-reveal-triggers}.tsx`
- Modify: `resources/js/lib/poker/game-reducer.ts` (`timer.set`), `resources/js/hooks/use-poker-channel.ts` (`timer.changed`, optional `onLeaving`), `resources/js/hooks/use-poker-game.ts` (map `timer.changed`, `onLeaving` option), `resources/js/components/poker/{players-grid,facilitator-toolbar,result-panel,game-header,game-settings-dialog,game}.tsx`, `resources/js/components/retro/presence-strip.tsx` (optional `badgeFor`), `resources/js/pages/poker/join.tsx` ("Join as spectator"), `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: Tasks 1–4 endpoints (Wayfinder `@/actions/App/Http/Controllers/Poker/PokerSpectatorsController`, `PokerTimersController`, `PokerAutoRevealsController`, `PokerSettingsController`); `TimerDisplay` (`@/components/retro/timer-display`, props `endsAt`, `offset`); `useCountdown` (`@/hooks/use-countdown`); Plan 10a `useGame()`, `PokerCard`, `PokerRound`, `PokerRoundVote`, `PokerPlayer`.
- Produces:
  - Reducer action `{ type: 'timer.set'; roundId: string; timerEndsAt: string | null }` (applies only to `current.round` with that id). `PokerEvents` gains `'timer.changed'` (mapped to `timer.set`). `PokerChannelHandlers` gains `onLeaving?: (member: PresenceMember) => void`; `usePokerGame(initial, options?: { onLeaving?: (member: PresenceMember) => void })`.
  - `SpectatorToggle()` — header button "Watch only" / "Play" (`aria-pressed`) → PUT own flag, then `refetch()`; hidden on ended games. `PlayerRoleMenu({ player }: { player: PokerPlayer })` — facilitator-only per-player menu "Make spectator" / "Make player" (never for the facilitator's own row; they use the toggle).
  - `WatchingRow()` — online spectators (avatar + name, no card slot) with `PlayerRoleMenu`; `PlayersGrid` (which already excludes spectators) gives the facilitator `PlayerRoleMenu` on each seat; `export function cardFace(round: PokerRound | null, vote: PokerRoundVote | undefined): 'empty' | 'down' | 'up'` keeps cards face-down after reveal on anonymous rounds.
  - `AnonymousValuesRow({ round }: { round: PokerRound })` — values face-up in deck order from `result.distribution`, titled "Anonymous votes".
  - `RoundTimerControl()` (in `FacilitatorToolbar` while the round is open: presets 30 s, 1, 2, 3 min, "Custom minutes…" dialog 1–60, "Stop timer") and `RoundCountdown()` (everyone, while the round is open and a timer is set) in `round-timer-control.tsx`.
  - `AutoRevealTriggers({ departures }: { departures: number })` — mounted by `Game` for everyone but active only for the facilitator while auto-reveal is on and the round is open: POST auto-reveal (debounced 2 s) when a presence member leaves and when the countdown reaches zero; `{revealed: true}` → `refetch()`.
  - `ResultPanel` automatic-reveal note; header badges "Anonymous votes" / "Auto-reveal" and the `SpectatorToggle`; eye badge for spectators in the presence strip; settings switches; join checkbox.

- [ ] **Step 1: Reducer**

In `resources/js/lib/poker/game-reducer.ts` add the member to the `GameAction` union:

```ts
    | { type: 'timer.set'; roundId: string; timerEndsAt: string | null }
```

and the case to `gameReducer`'s `switch`:

```ts
        case 'timer.set': {
            if (
                state.current === null ||
                state.current.round.id !== action.roundId
            ) {
                return state;
            }

            return {
                ...state,
                current: {
                    ...state.current,
                    round: {
                        ...state.current.round,
                        timerEndsAt: action.timerEndsAt,
                    },
                },
            };
        }
```

- [ ] **Step 2: Channel and game hook**

In `resources/js/hooks/use-poker-channel.ts`:

1. Append `'timer.changed'` as the last entry of `PokerEvents`.
2. Extend the handlers type:

```ts
export type PokerChannelHandlers = {
    onEvent: (event: PokerEvent) => void;
    onResync: () => void;
    onJoining: (member: PresenceMember) => void;
    onLeaving?: (member: PresenceMember) => void;
};
```

3. Replace the `.leaving(...)` callback with:

```ts
            .leaving((member: PresenceMember) => {
                setOnline((current) =>
                    current.filter((m) => m.id !== member.id),
                );
                handlers.current.onLeaving?.(member);
            })
```

In `resources/js/hooks/use-poker-game.ts`:

1. Signature and a ref for the option (next to the other refs):

```ts
type GameOptions = { onLeaving?: (member: PresenceMember) => void };

export function usePokerGame(
    initial: PokerSnapshot,
    options: GameOptions = {},
) {
    // …existing state and refs…
    const onLeaving = useRef(options.onLeaving);

    onLeaving.current = options.onLeaving;
```

2. In the `onEvent` switch add:

```ts
                case 'timer.changed':
                    apply({
                        type: 'timer.set',
                        roundId: payload.roundId as string,
                        timerEndsAt: payload.timerEndsAt as string | null,
                    });
                    break;
```

3. In the handlers passed to `usePokerChannel` add:

```ts
            onLeaving: (member) => onLeaving.current?.(member),
```

- [ ] **Step 3: Spectator toggle and role menu**

Create `resources/js/components/poker/spectator-toggle.tsx`:

```tsx
import { Eye, Hand, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import PokerSpectatorsController from '@/actions/App/Http/Controllers/Poker/PokerSpectatorsController';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import type { PokerPlayer } from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

function useSetSpectator() {
    const { snapshot, run, refetch } = useGame();
    const [busy, setBusy] = useState(false);

    const setSpectator = async (playerId: string, spectator: boolean) => {
        setBusy(true);

        const result = await run(
            retroRequest(
                PokerSpectatorsController.update({
                    game: snapshot.game.id,
                    player: playerId,
                }),
                { spectator },
            ),
        );

        setBusy(false);

        if (result !== undefined) {
            await refetch();
        }
    };

    return { busy, setSpectator };
}

export function SpectatorToggle() {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const { busy, setSpectator } = useSetSpectator();

    if (snapshot.game.endedAt !== null) {
        return null;
    }

    const watching = snapshot.me.isSpectator;

    return (
        <Button
            size="sm"
            variant="outline"
            aria-pressed={watching}
            disabled={busy}
            onClick={() => void setSpectator(snapshot.me.playerId, !watching)}
        >
            {watching ? (
                <Hand className="size-4" aria-hidden="true" />
            ) : (
                <Eye className="size-4" aria-hidden="true" />
            )}
            {watching ? t('Play') : t('Watch only')}
        </Button>
    );
}

export function PlayerRoleMenu({ player }: { player: PokerPlayer }) {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const { busy, setSpectator } = useSetSpectator();

    if (
        !snapshot.me.isFacilitator ||
        snapshot.game.endedAt !== null ||
        player.id === snapshot.me.playerId
    ) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    aria-label={t('Player options')}
                >
                    <MoreHorizontal className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    disabled={busy}
                    onSelect={() =>
                        void setSpectator(player.id, !player.isSpectator)
                    }
                >
                    {player.isSpectator ? t('Make player') : t('Make spectator')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
```

- [ ] **Step 4: Watching row, anonymous values, grid**

Create `resources/js/components/poker/watching-row.tsx`:

```tsx
import { useTrans } from '@/hooks/use-trans';
import { useGame } from './game-context';
import { PlayerRoleMenu } from './spectator-toggle';

export function WatchingRow() {
    const { snapshot, online } = useGame();
    const { t } = useTrans();
    const onlineIds = new Set(online.map((member) => member.id));
    const watchers = snapshot.players.filter(
        (player) => player.isSpectator && onlineIds.has(player.id),
    );

    if (watchers.length === 0) {
        return null;
    }

    return (
        <section aria-label={t('Watching')} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
                {t('Watching')}
            </h3>
            <ul className="flex flex-wrap gap-3">
                {watchers.map((player) => (
                    <li key={player.id} className="flex items-center gap-2">
                        <img
                            src={player.avatarUrl}
                            alt=""
                            className="size-6 rounded-full bg-muted"
                        />
                        <span className="text-sm">{player.name}</span>
                        <PlayerRoleMenu player={player} />
                    </li>
                ))}
            </ul>
        </section>
    );
}
```

Create `resources/js/components/poker/anonymous-values-row.tsx`:

```tsx
import { useTrans } from '@/hooks/use-trans';
import type { PokerRound } from '@/lib/poker/types';
import { PokerCard } from './poker-card';

/**
 * Values of an anonymous round, in deck order and without names, so no
 * position links a value to a player.
 */
export function AnonymousValuesRow({ round }: { round: PokerRound }) {
    const { t } = useTrans();
    const values = (round.result?.distribution ?? []).flatMap(
        ({ value, count }) => Array.from({ length: count }, () => value),
    );

    return (
        <section aria-label={t('Anonymous votes')} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
                {t('Anonymous votes')}
            </h3>
            <div className="flex flex-wrap gap-2">
                {values.map((value, index) => (
                    <PokerCard
                        key={`${value}-${index}`}
                        value={value}
                        face="up"
                    />
                ))}
            </div>
        </section>
    );
}
```

In `resources/js/components/poker/players-grid.tsx` (Plan 10a Task 15; it already seats only non-spectators):

1. Imports: add `import type { PokerRound, PokerRoundVote } from '@/lib/poker/types';`, `import { AnonymousValuesRow } from './anonymous-values-row';`, `import { PlayerRoleMenu } from './spectator-toggle';`, `import { WatchingRow } from './watching-row';`.

2. Add the exported helper at module level:

```tsx
/**
 * On an anonymous round the seats stay face-down after reveal (the viewer's
 * own seat too), so no seat links a value to a player.
 */
export function cardFace(
    round: PokerRound | null,
    vote: PokerRoundVote | undefined,
): 'empty' | 'down' | 'up' {
    if (round === null || vote === undefined) {
        return 'empty';
    }

    if (round.revealedAt === null || round.anonymous || vote.value === null) {
        return 'down';
    }

    return 'up';
}
```

3. Replace the `const face = !vote ? 'empty' : isRevealed && vote.value !== null ? 'up' : 'down';` expression with `const face = cardFace(round, vote);` and delete the now unused `const isRevealed = …` line.

4. After the facilitator crown (`{game.facilitatorPlayerId === player.id && (…)}`), inside the same name row, add `<PlayerRoleMenu player={player} />`.

5. After the closing `</ul>`, still inside `<section>`, add:

```tsx
            {round.anonymous && round.revealedAt !== null && (
                <AnonymousValuesRow round={round} />
            )}
            <WatchingRow />
```

- [ ] **Step 5: Timer control and countdown**

Create `resources/js/components/poker/round-timer-control.tsx`:

```tsx
import { AlarmClock } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import PokerTimersController from '@/actions/App/Http/Controllers/Poker/PokerTimersController';
import { TimerDisplay } from '@/components/retro/timer-display';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

const PresetSeconds = [30, 60, 120, 180];

export function RoundTimerControl() {
    const { snapshot, run, apply } = useGame();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const [customOpen, setCustomOpen] = useState(false);
    const [minutes, setMinutes] = useState('5');
    const round = snapshot.current?.round ?? null;

    if (
        !snapshot.me.isFacilitator ||
        snapshot.game.endedAt !== null ||
        round === null ||
        round.revealedAt !== null
    ) {
        return null;
    }

    const set = async (seconds: number | null) => {
        setBusy(true);

        const response = await run(
            retroRequest<{ timerEndsAt: string | null }>(
                PokerTimersController.update({
                    game: snapshot.game.id,
                    round: round.id,
                }),
                { seconds },
            ),
        );

        setBusy(false);

        if (response) {
            apply({
                type: 'timer.set',
                roundId: round.id,
                timerEndsAt: response.timerEndsAt,
            });
        }
    };

    const startCustom = (event: FormEvent) => {
        event.preventDefault();

        const value = Number(minutes);

        if (!Number.isInteger(value) || value < 1 || value > 60) {
            return;
        }

        setCustomOpen(false);
        void set(value * 60);
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" aria-label={t('Timer')}>
                        <AlarmClock className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    {PresetSeconds.map((seconds) => (
                        <DropdownMenuItem
                            key={seconds}
                            disabled={busy}
                            onSelect={() => void set(seconds)}
                        >
                            {seconds < 60
                                ? t(':count s', { count: seconds })
                                : t(':count min', { count: seconds / 60 })}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem
                        disabled={busy}
                        onSelect={() => setCustomOpen(true)}
                    >
                        {t('Custom minutes…')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        disabled={busy || round.timerEndsAt === null}
                        onSelect={() => void set(null)}
                    >
                        {t('Stop timer')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={customOpen} onOpenChange={setCustomOpen}>
                <DialogContent aria-describedby={undefined}>
                    <DialogTitle>{t('Custom minutes')}</DialogTitle>
                    <form onSubmit={startCustom} className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="poker-timer-minutes">
                                {t('Minutes')}
                            </Label>
                            <Input
                                id="poker-timer-minutes"
                                type="number"
                                min={1}
                                max={60}
                                step={1}
                                required
                                value={minutes}
                                onChange={(event) =>
                                    setMinutes(event.target.value)
                                }
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={busy}>
                                {t('Start timer')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

export function RoundCountdown() {
    const { snapshot, serverOffset } = useGame();
    const round = snapshot.current?.round ?? null;

    if (
        round === null ||
        round.revealedAt !== null ||
        round.timerEndsAt === null ||
        snapshot.game.endedAt !== null
    ) {
        return null;
    }

    return (
        <TimerDisplay
            key={round.timerEndsAt}
            endsAt={round.timerEndsAt}
            offset={serverOffset}
        />
    );
}
```

`TimerDisplay` already plays the soft sound and toasts "Time's up!" at zero.

In `resources/js/components/poker/facilitator-toolbar.tsx`, inside the open-round branch, right after the "Show votes" button, add `<RoundTimerControl />` (import `{ RoundTimerControl } from './round-timer-control'`).

- [ ] **Step 6: Auto-reveal triggers**

Create `resources/js/components/poker/auto-reveal-triggers.tsx`:

```tsx
import { useCallback, useEffect, useRef } from 'react';
import PokerAutoRevealsController from '@/actions/App/Http/Controllers/Poker/PokerAutoRevealsController';
import { useCountdown } from '@/hooks/use-countdown';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

const DebounceMs = 2_000;

/**
 * The server decides; the facilitator's client only nudges it when someone
 * leaves (the everyone-voted set may now be complete) and when the countdown
 * ends (fallback for a delayed queue).
 */
export function AutoRevealTriggers({ departures }: { departures: number }) {
    const { snapshot, serverOffset, refetch } = useGame();
    const round = snapshot.current?.round ?? null;
    const isActive =
        snapshot.me.isFacilitator &&
        snapshot.game.autoReveal &&
        snapshot.game.endedAt === null &&
        round !== null &&
        round.revealedAt === null;
    const roundId = isActive && round !== null ? round.id : null;
    const remaining = useCountdown(
        isActive && round !== null ? round.timerEndsAt : null,
        serverOffset,
    );
    const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handledDepartures = useRef(departures);
    const gameId = snapshot.game.id;

    const request = useCallback(
        (targetRoundId: string) => {
            if (pending.current !== null) {
                clearTimeout(pending.current);
            }

            pending.current = setTimeout(() => {
                pending.current = null;

                retroRequest<{ revealed: boolean }>(
                    PokerAutoRevealsController.store({
                        game: gameId,
                        round: targetRoundId,
                    }),
                )
                    .then((response) => {
                        if (response?.revealed) {
                            void refetch();
                        }
                    })
                    .catch(() => {
                        // The next vote, departure or the timer job checks again.
                    });
            }, DebounceMs);
        },
        [gameId, refetch],
    );

    useEffect(() => {
        if (departures === handledDepartures.current) {
            return;
        }

        handledDepartures.current = departures;

        if (roundId !== null) {
            request(roundId);
        }
    }, [departures, roundId, request]);

    useEffect(() => {
        if (roundId !== null && remaining === 0) {
            request(roundId);
        }
    }, [remaining, roundId, request]);

    useEffect(
        () => () => {
            if (pending.current !== null) {
                clearTimeout(pending.current);
            }
        },
        [],
    );

    return null;
}
```

- [ ] **Step 7: Wire the game**

In `resources/js/components/poker/game.tsx`:

1. Imports: `import { AutoRevealTriggers } from './auto-reveal-triggers';` and `import { RoundCountdown } from './round-timer-control';`.
2. Replace `const game = usePokerGame(initial);` with:

```tsx
    const [departures, setDepartures] = useState(0);
    const game = usePokerGame(initial, {
        onLeaving: () => setDepartures((count) => count + 1),
    });
```

3. Inside `<GameProvider value={ctx}>`, right before `<div className="flex min-h-dvh flex-col">`, add `<AutoRevealTriggers departures={departures} />` (it renders nothing).
4. In `Table()`, in the current-task branch, render `<RoundCountdown />` directly above `<PlayersGrid />`.

- [ ] **Step 8: Result note, header, presence badge**

In `resources/js/components/poker/result-panel.tsx`, right after the heading row (`<div className="flex flex-wrap items-center gap-3">…</div>`):

```tsx
            {round.revealReason === 'everyone_voted' && (
                <p className="text-sm text-muted-foreground">
                    {t('Revealed automatically — everyone voted')}
                </p>
            )}
            {round.revealReason === 'timer' && (
                <p className="text-sm text-muted-foreground">
                    {t("Revealed automatically — time's up")}
                </p>
            )}
```

Replace `resources/js/components/retro/presence-strip.tsx` with (retro callers pass no `badgeFor` and render as before; `data-presence-id` stays on the image for reaction origins):

```tsx
import type { ReactNode } from 'react';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import type { PresenceMember } from '@/lib/retro/types';

const Visible = 8;

type Props = {
    members: PresenceMember[];
    badgeFor?: (member: PresenceMember) => ReactNode;
};

export function PresenceStrip({ members, badgeFor }: Props) {
    const { t } = useTrans();
    const hidden = members.length - Visible;

    return (
        <div
            role="group"
            className="flex items-center -space-x-2"
            aria-label={t(':count online', { count: members.length })}
        >
            {members.slice(0, Visible).map((member) => {
                const badge = badgeFor?.(member);

                return (
                    <Tooltip key={member.id}>
                        <TooltipTrigger asChild>
                            <span className="relative inline-flex">
                                <img
                                    src={member.avatarUrl}
                                    alt={member.name}
                                    data-presence-id={member.id}
                                    className="size-8 rounded-full border-2 border-background bg-muted"
                                />
                                {badge && (
                                    <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border border-background bg-muted">
                                        {badge}
                                    </span>
                                )}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            {member.name}
                            {member.isGuest && ` · ${t('Guest')}`}
                        </TooltipContent>
                    </Tooltip>
                );
            })}
            {hidden > 0 && (
                <span
                    aria-label={t(':count more', { count: hidden })}
                    className="flex size-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs"
                >
                    +{hidden}
                </span>
            )}
        </div>
    );
}
```

In `resources/js/components/poker/game-header.tsx`:

1. Imports: add `Eye` to the `lucide-react` import and `import { SpectatorToggle } from './spectator-toggle';` (`Badge` is already imported).
2. Replace `<PresenceStrip members={online} />` with:

```tsx
<PresenceStrip
    members={online}
    badgeFor={(member) =>
        snapshot.players.find((player) => player.id === member.id)
            ?.isSpectator ? (
            <Eye className="size-3" aria-label={t('Watching')} />
        ) : null
    }
/>
```

3. Right after the `{isEnded && <Badge …>}` line add:

```tsx
{game.anonymousVotes && (
    <Badge variant="secondary">{t('Anonymous votes')}</Badge>
)}
{game.autoReveal && (
    <Badge variant="secondary">{t('Auto-reveal')}</Badge>
)}
```

4. Before `{actions}` render `<SpectatorToggle />`.

- [ ] **Step 9: Settings switches**

In `resources/js/components/poker/game-settings-dialog.tsx`:

1. Add the local helper at module level:

```tsx
function SettingSwitch({
    id,
    label,
    checked,
    onChange,
    children,
}: {
    id: string;
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    children?: ReactNode;
}) {
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2">
                <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(value) => onChange(value === true)}
                />
                <Label htmlFor={id}>{label}</Label>
            </div>
            {children}
        </div>
    );
}
```

2. Next to the dialog's other form state (initialised from `snapshot.game` like the 10a fields, the form mounting only while open):

```tsx
const [autoReveal, setAutoReveal] = useState(game.autoReveal);
const [anonymousVotes, setAnonymousVotes] = useState(game.anonymousVotes);
const [cursorsEnabled, setCursorsEnabled] = useState(game.cursorsEnabled);
const [reactionsEnabled, setReactionsEnabled] = useState(
    game.reactionsEnabled,
);
```

3. In the changed-keys builder, before the PATCH:

```tsx
if (autoReveal !== game.autoReveal) {
    changes.auto_reveal = autoReveal;
}

if (anonymousVotes !== game.anonymousVotes) {
    changes.anonymous_votes = anonymousVotes;
}

if (cursorsEnabled !== game.cursorsEnabled) {
    changes.cursors_enabled = cursorsEnabled;
}

if (reactionsEnabled !== game.reactionsEnabled) {
    changes.reactions_enabled = reactionsEnabled;
}
```

4. Below the "Allow guests" checkbox:

```tsx
<SettingSwitch
    id="poker-auto-reveal"
    label={t('Reveal automatically when everyone has voted or the timer ends')}
    checked={autoReveal}
    onChange={setAutoReveal}
/>
<SettingSwitch
    id="poker-anonymous-votes"
    label={t('Anonymous votes')}
    checked={anonymousVotes}
    onChange={setAnonymousVotes}
>
    {game.anonymousVotes && !anonymousVotes && (
        <p className="text-xs text-muted-foreground">
            {t('Applies from the next round.')}
        </p>
    )}
    <p className="text-xs text-muted-foreground">
        {t("With two voters, each can work out the other's vote from their own.")}
    </p>
</SettingSwitch>
<SettingSwitch
    id="poker-cursors"
    label={t('Show live cursors')}
    checked={cursorsEnabled}
    onChange={setCursorsEnabled}
/>
<SettingSwitch
    id="poker-reactions"
    label={t('Show flying reactions')}
    checked={reactionsEnabled}
    onChange={setReactionsEnabled}
/>
```

(Imports: `Checkbox`, `Label`, `type ReactNode` if not already present.)

- [ ] **Step 10: Join as spectator**

In `resources/js/pages/poker/join.tsx`, inside the `<Form>` render function, between the name field and the submit button:

```tsx
<div className="flex items-center gap-2">
    <Checkbox id="spectator" name="spectator" value="1" />
    <Label htmlFor="spectator">{t('Join as spectator')}</Label>
</div>
```

(`import { Checkbox } from '@/components/ui/checkbox';` — Radix submits `value="1"` only when checked, which Laravel's `boolean` rule accepts; unchecked sends nothing and the guest joins as a player.)

- [ ] **Step 11: Translations**

Append to each file (only these keys are new; `Anonymous votes`, `Voted`, `Timer`, `Stop timer`, `:count min`, `Show live cursors`, `Guest` already exist).

`lang/en.json`:

```json
    "Watch only": "Watch only",
    "Play": "Play",
    "Watching": "Watching",
    "Make spectator": "Make spectator",
    "Make player": "Make player",
    "Player options": "Player options",
    "Auto-reveal": "Auto-reveal",
    "Reveal automatically when everyone has voted or the timer ends": "Reveal automatically when everyone has voted or the timer ends",
    "Applies from the next round.": "Applies from the next round.",
    "With two voters, each can work out the other's vote from their own.": "With two voters, each can work out the other's vote from their own.",
    "Show flying reactions": "Show flying reactions",
    "Revealed automatically — everyone voted": "Revealed automatically — everyone voted",
    "Revealed automatically — time's up": "Revealed automatically — time's up",
    ":count s": ":count s",
    "Custom minutes": "Custom minutes",
    "Custom minutes…": "Custom minutes…",
    "Minutes": "Minutes",
    "Start timer": "Start timer",
    "Join as spectator": "Join as spectator"
```

`lang/fr.json`:

```json
    "Watch only": "Regarder seulement",
    "Play": "Jouer",
    "Watching": "Observateurs",
    "Make spectator": "Passer en observateur",
    "Make player": "Passer en joueur",
    "Player options": "Options du joueur",
    "Auto-reveal": "Révélation automatique",
    "Reveal automatically when everyone has voted or the timer ends": "Révéler automatiquement quand tout le monde a voté ou à la fin du minuteur",
    "Applies from the next round.": "S'applique à partir du prochain tour.",
    "With two voters, each can work out the other's vote from their own.": "Avec deux votants, chacun peut déduire le vote de l'autre à partir du sien.",
    "Show flying reactions": "Afficher les réactions animées",
    "Revealed automatically — everyone voted": "Révélé automatiquement — tout le monde a voté",
    "Revealed automatically — time's up": "Révélé automatiquement — temps écoulé",
    ":count s": ":count s",
    "Custom minutes": "Minutes personnalisées",
    "Custom minutes…": "Minutes personnalisées…",
    "Minutes": "Minutes",
    "Start timer": "Lancer le minuteur",
    "Join as spectator": "Rejoindre en observateur"
```

`lang/es.json`:

```json
    "Watch only": "Solo mirar",
    "Play": "Jugar",
    "Watching": "Observando",
    "Make spectator": "Pasar a espectador",
    "Make player": "Pasar a jugador",
    "Player options": "Opciones del jugador",
    "Auto-reveal": "Revelado automático",
    "Reveal automatically when everyone has voted or the timer ends": "Revelar automáticamente cuando todos hayan votado o termine el temporizador",
    "Applies from the next round.": "Se aplica a partir de la siguiente ronda.",
    "With two voters, each can work out the other's vote from their own.": "Con dos votantes, cada uno puede deducir el voto del otro a partir del suyo.",
    "Show flying reactions": "Mostrar reacciones animadas",
    "Revealed automatically — everyone voted": "Revelado automáticamente — todos votaron",
    "Revealed automatically — time's up": "Revelado automáticamente — se acabó el tiempo",
    ":count s": ":count s",
    "Custom minutes": "Minutos personalizados",
    "Custom minutes…": "Minutos personalizados…",
    "Minutes": "Minutos",
    "Start timer": "Iniciar temporizador",
    "Join as spectator": "Unirse como espectador"
```

`lang/de.json`:

```json
    "Watch only": "Nur zuschauen",
    "Play": "Mitspielen",
    "Watching": "Zuschauer",
    "Make spectator": "Zum Zuschauer machen",
    "Make player": "Zum Mitspieler machen",
    "Player options": "Spieleroptionen",
    "Auto-reveal": "Automatisch aufdecken",
    "Reveal automatically when everyone has voted or the timer ends": "Automatisch aufdecken, wenn alle abgestimmt haben oder der Timer abläuft",
    "Applies from the next round.": "Gilt ab der nächsten Runde.",
    "With two voters, each can work out the other's vote from their own.": "Bei zwei Abstimmenden kann jeder aus der eigenen Stimme die des anderen ableiten.",
    "Show flying reactions": "Fliegende Reaktionen anzeigen",
    "Revealed automatically — everyone voted": "Automatisch aufgedeckt — alle haben abgestimmt",
    "Revealed automatically — time's up": "Automatisch aufgedeckt — Zeit abgelaufen",
    ":count s": ":count s",
    "Custom minutes": "Eigene Minutenzahl",
    "Custom minutes…": "Eigene Minutenzahl…",
    "Minutes": "Minuten",
    "Start timer": "Timer starten",
    "Join as spectator": "Als Zuschauer beitreten"
```

(Add a comma after the previous last entry of each file.)

- [ ] **Step 12: Checks**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form` (the controllers of Tasks 1–4 must be generated).
Run: `npm run types:check && npm run check` — green except the known pre-existing failures.
Run: `npx vp check --fix resources/js/lib/poker/game-reducer.ts resources/js/hooks/use-poker-channel.ts resources/js/hooks/use-poker-game.ts resources/js/components/poker/spectator-toggle.tsx resources/js/components/poker/watching-row.tsx resources/js/components/poker/anonymous-values-row.tsx resources/js/components/poker/round-timer-control.tsx resources/js/components/poker/auto-reveal-triggers.tsx resources/js/components/poker/players-grid.tsx resources/js/components/poker/facilitator-toolbar.tsx resources/js/components/poker/result-panel.tsx resources/js/components/poker/game-header.tsx resources/js/components/poker/game-settings-dialog.tsx resources/js/components/poker/game.tsx resources/js/components/retro/presence-strip.tsx resources/js/pages/poker/join.tsx`
Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php tests/Feature/Poker/PokerJoinTest.php tests/Feature/Poker/PokerSpectatorTest.php` — PASS.

- [ ] **Step 13: Commit**

```bash
git add resources/js/lib/poker/game-reducer.ts resources/js/hooks/use-poker-channel.ts resources/js/hooks/use-poker-game.ts resources/js/components/poker/spectator-toggle.tsx resources/js/components/poker/watching-row.tsx resources/js/components/poker/anonymous-values-row.tsx resources/js/components/poker/round-timer-control.tsx resources/js/components/poker/auto-reveal-triggers.tsx resources/js/components/poker/players-grid.tsx resources/js/components/poker/facilitator-toolbar.tsx resources/js/components/poker/result-panel.tsx resources/js/components/poker/game-header.tsx resources/js/components/poker/game-settings-dialog.tsx resources/js/components/poker/game.tsx resources/js/components/retro/presence-strip.tsx resources/js/pages/poker/join.tsx lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat: add spectators, timer, auto-reveal and anonymous votes to the poker table

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

### Task 9: Saved decks UI

**Files:**
- Create: `resources/js/components/teams/saved-decks-dialog.tsx`
- Modify: `resources/js/types/poker.ts` (`SavedPokerDeck`), `resources/js/components/poker/deck-fields.tsx` (saved decks group, `DeckChoice.savedDeckId` / `saveDeckAs`, `deckPayload`), `resources/js/components/teams/new-poker-game-dialog.tsx` (saved decks + "Save this deck for the team as…"), `resources/js/components/teams/poker-games-section.tsx` ("Saved decks" button), `resources/js/pages/teams/show.tsx` (prop `pokerDecks`), `resources/js/components/poker/game-settings-dialog.tsx` (loads `GET saved-decks` when opened), `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: Task 5 endpoints (Wayfinder `@/actions/App/Http/Controllers/PokerDecksController` `store`/`update`/`destroy` with params `{ workspace, team, pokerDeck }`, `@/actions/App/Http/Controllers/Poker/PokerSavedDecksController` `index(gameId)`), team page prop `pokerDecks: [{id, name, cards, canManage}]`; Plan 10a `DeckFields`, `deckChoiceFromGame`, `splitCustomCards`, `SpecialCards`, `isSpecialCard`.
- Produces:
  - `resources/js/types/poker.ts`: `export type SavedPokerDeck = { id: string; name: string; cards: string[]; canManage?: boolean };`
  - `DeckChoice` gains `savedDeckId: string | null; saveDeckAs: string`; `deckPayload` emits `{ deck: 'custom', saved_deck_id }` for a saved deck, and `save_deck_as` (trimmed, when non-empty) for custom cards; `DeckFields` gains props `savedDecks?: SavedPokerDeck[]` (listed after the built-in decks, before "Custom", with their cards) and `allowSaveAs?: boolean` (shows the "Save this deck for the team as…" field under custom cards).
  - `SavedDecksDialog({ workspaceSlug, teamId, decks }: { workspaceSlug: string; teamId: string; decks: SavedPokerDeck[] })` — list (name, card chips), "New deck" form (name, comma-separated cards, `?`/`☕` checkboxes), edit/delete where `canManage`; a 404 (deck deleted concurrently) reloads `pokerDecks`.
  - `PokerGamesSection` gains prop `savedDecks: SavedPokerDeck[]`; `NewPokerGameDialog` gains prop `savedDecks: SavedPokerDeck[]`.

- [ ] **Step 1: Type**

Append to `resources/js/types/poker.ts`:

```ts
export type SavedPokerDeck = {
    id: string;
    name: string;
    cards: string[];
    canManage?: boolean;
};
```

(`resources/js/types/index.ts` already re-exports `./poker`.)

- [ ] **Step 2: Deck choice and fields**

In `resources/js/components/poker/deck-fields.tsx` (Plan 10a Task 16):

1. Imports: change the types import to `import type { PokerDeckOption, SavedPokerDeck } from '@/types';`.

2. Replace `DeckChoice`, `emptyDeckChoice`, `deckChoiceFromGame` and `deckPayload` with:

```tsx
export type DeckChoice = {
    deck: string;
    customCards: string;
    includeUnknown: boolean;
    includeCoffee: boolean;
    savedDeckId: string | null;
    saveDeckAs: string;
};

const [UnknownCard, CoffeeCard] = SpecialCards;

export function emptyDeckChoice(): DeckChoice {
    return {
        deck: 'fibonacci',
        customCards: '',
        includeUnknown: true,
        includeCoffee: true,
        savedDeckId: null,
        saveDeckAs: '',
    };
}

export function deckChoiceFromGame(game: {
    deck: string;
    cards: string[];
}): DeckChoice {
    if (game.deck !== 'custom') {
        return { ...emptyDeckChoice(), deck: game.deck };
    }

    return {
        ...emptyDeckChoice(),
        deck: 'custom',
        customCards: game.cards
            .filter((card) => !isSpecialCard(card))
            .join(', '),
        includeUnknown: game.cards.includes(UnknownCard),
        includeCoffee: game.cards.includes(CoffeeCard),
    };
}

export function deckPayload(choice: DeckChoice): Record<string, unknown> {
    if (choice.savedDeckId !== null) {
        return { deck: 'custom', saved_deck_id: choice.savedDeckId };
    }

    if (choice.deck !== 'custom') {
        return { deck: choice.deck };
    }

    const payload: Record<string, unknown> = {
        deck: 'custom',
        custom_cards: splitCustomCards(choice.customCards),
        include_unknown: choice.includeUnknown,
        include_coffee: choice.includeCoffee,
    };
    const saveDeckAs = choice.saveDeckAs.trim();

    if (saveDeckAs !== '') {
        payload.save_deck_as = saveDeckAs;
    }

    return payload;
}
```

3. Extend `Props` with:

```tsx
    savedDecks?: SavedPokerDeck[];
    allowSaveAs?: boolean;
```

and the destructuring of `DeckFields` with `savedDecks = [], allowSaveAs = false,`.

4. Add a small chip component at module level (the built-in options can use it too; keep their existing markup if you prefer, the look must match):

```tsx
function CardChips({ cards }: { cards: string[] }) {
    return (
        <span className="mt-1 flex flex-wrap gap-1">
            {cards.map((card) => (
                <span
                    key={card}
                    className="min-w-6 rounded border bg-background px-1 text-center font-mono text-xs"
                >
                    {card}
                </span>
            ))}
        </span>
    );
}
```

5. Replace the body of the `role="radiogroup"` element (the single `deckOptions.map(…)`) with built-in decks, then saved decks, then "Custom":

```tsx
                {deckOptions
                    .filter((option) => option.value !== 'custom')
                    .map((option) => (
                        <DeckRadio
                            key={option.value}
                            label={option.label}
                            cards={option.cards}
                            checked={
                                value.savedDeckId === null &&
                                value.deck === option.value
                            }
                            disabled={disabled}
                            onSelect={() =>
                                update({ deck: option.value, savedDeckId: null })
                            }
                        />
                    ))}
                {savedDecks.length > 0 && (
                    <p className="pt-2 text-xs font-semibold text-muted-foreground uppercase">
                        {t("Your team's decks")}
                    </p>
                )}
                {savedDecks.map((saved) => (
                    <DeckRadio
                        key={saved.id}
                        label={saved.name}
                        cards={saved.cards}
                        checked={value.savedDeckId === saved.id}
                        disabled={disabled}
                        onSelect={() =>
                            update({ deck: 'custom', savedDeckId: saved.id })
                        }
                    />
                ))}
                {deckOptions
                    .filter((option) => option.value === 'custom')
                    .map((option) => (
                        <DeckRadio
                            key={option.value}
                            label={option.label}
                            cards={option.cards}
                            checked={
                                value.savedDeckId === null &&
                                value.deck === 'custom'
                            }
                            disabled={disabled}
                            onSelect={() =>
                                update({ deck: 'custom', savedDeckId: null })
                            }
                        />
                    ))}
```

with, at module level:

```tsx
function DeckRadio({
    label,
    cards,
    checked,
    disabled,
    onSelect,
}: {
    label: string;
    cards: string[];
    checked: boolean;
    disabled: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={disabled}
            className={cn(
                'rounded-md border p-2 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60',
                checked && 'border-primary bg-muted',
            )}
            onClick={onSelect}
        >
            <span className="block text-sm font-medium">{label}</span>
            {cards.length > 0 && <CardChips cards={cards} />}
        </button>
    );
}
```

6. After `<InputError message={errors.deck} />` add `<InputError message={errors.saved_deck_id} />`, and change the custom block's condition from `value.deck === 'custom'` to `value.deck === 'custom' && value.savedDeckId === null`.

7. Inside the custom block, after the two checkboxes, add:

```tsx
                    {allowSaveAs && (
                        <div className="grid gap-2">
                            <Label htmlFor="deck-save-as">
                                {t('Save this deck for the team as…')}
                            </Label>
                            <Input
                                id="deck-save-as"
                                value={value.saveDeckAs}
                                maxLength={40}
                                placeholder={t('Deck name')}
                                onChange={(event) =>
                                    update({ saveDeckAs: event.target.value })
                                }
                            />
                            <InputError message={errors.save_deck_as} />
                        </div>
                    )}
```

- [ ] **Step 3: Saved decks dialog**

Create `resources/js/components/teams/saved-decks-dialog.tsx`:

```tsx
import { router } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import PokerDecksController from '@/actions/App/Http/Controllers/PokerDecksController';
import InputError from '@/components/input-error';
import { splitCustomCards } from '@/components/poker/deck-fields';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { isSpecialCard, SpecialCards } from '@/lib/poker/types';
import type { SavedPokerDeck } from '@/types';

const [UnknownCard, CoffeeCard] = SpecialCards;

type Props = {
    workspaceSlug: string;
    teamId: string;
    decks: SavedPokerDeck[];
};

type Draft = {
    name: string;
    cards: string;
    includeUnknown: boolean;
    includeCoffee: boolean;
};

const EmptyDraft: Draft = {
    name: '',
    cards: '',
    includeUnknown: true,
    includeCoffee: true,
};

function draftFrom(deck: SavedPokerDeck): Draft {
    return {
        name: deck.name,
        cards: deck.cards.filter((card) => !isSpecialCard(card)).join(', '),
        includeUnknown: deck.cards.includes(UnknownCard),
        includeCoffee: deck.cards.includes(CoffeeCard),
    };
}

function reloadDecks() {
    router.reload({ only: ['pokerDecks'] });
}

export function SavedDecksDialog(props: Props) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">{t('Saved decks')}</Button>
            </DialogTrigger>
            <DialogContent
                aria-describedby={undefined}
                className="max-h-[90dvh] overflow-y-auto"
            >
                <DialogTitle>{t('Saved decks')}</DialogTitle>
                {open && <SavedDecksManager {...props} />}
            </DialogContent>
        </Dialog>
    );
}

function SavedDecksManager({ workspaceSlug, teamId, decks }: Props) {
    const { t } = useTrans();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const params = { workspace: workspaceSlug, team: teamId };

    const remove = (deck: SavedPokerDeck) => {
        router.delete(
            PokerDecksController.destroy({ ...params, pokerDeck: deck.id })
                .url,
            {
                preserveScroll: true,
                onSuccess: () => setConfirmingId(null),
                onHttpException: () => {
                    setConfirmingId(null);
                    reloadDecks();

                    return false;
                },
            },
        );
    };

    return (
        <div className="space-y-4">
            {decks.length === 0 && !creating && (
                <p className="text-sm text-muted-foreground">
                    {t('No saved decks yet.')}
                </p>
            )}

            <ul className="divide-y rounded-md border">
                {decks.map((deck) => (
                    <li key={deck.id} className="space-y-2 p-3">
                        {editingId === deck.id ? (
                            <DeckDraftForm
                                params={params}
                                deck={deck}
                                onDone={() => setEditingId(null)}
                            />
                        ) : (
                            <>
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="font-medium">
                                            {deck.name}
                                        </p>
                                        <p className="mt-1 flex flex-wrap gap-1">
                                            {deck.cards.map((card) => (
                                                <span
                                                    key={card}
                                                    className="min-w-6 rounded border px-1 text-center font-mono text-xs"
                                                >
                                                    {card}
                                                </span>
                                            ))}
                                        </p>
                                    </div>
                                    {deck.canManage && (
                                        <div className="flex shrink-0 gap-1">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    setEditingId(deck.id)
                                                }
                                            >
                                                {t('Edit deck')}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    setConfirmingId(deck.id)
                                                }
                                            >
                                                {t('Delete deck')}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                {confirmingId === deck.id && (
                                    <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted p-2 text-sm">
                                        <span>
                                            {t('Delete this deck?')}{' '}
                                            {t(
                                                'Games that use it keep their cards.',
                                            )}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => remove(deck)}
                                        >
                                            {t('Delete deck')}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() =>
                                                setConfirmingId(null)
                                            }
                                        >
                                            {t('Cancel')}
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </li>
                ))}
            </ul>

            {creating ? (
                <DeckDraftForm
                    params={params}
                    deck={null}
                    onDone={() => setCreating(false)}
                />
            ) : (
                <Button onClick={() => setCreating(true)}>
                    {t('New deck')}
                </Button>
            )}
        </div>
    );
}

function DeckDraftForm({
    params,
    deck,
    onDone,
}: {
    params: { workspace: string; team: string };
    deck: SavedPokerDeck | null;
    onDone: () => void;
}) {
    const { t } = useTrans();
    const [draft, setDraft] = useState<Draft>(() =>
        deck ? draftFrom(deck) : EmptyDraft,
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const idPrefix = deck ? `deck-${deck.id}` : 'deck-new';
    const cardsError =
        errors.cards ??
        Object.entries(errors).find(([key]) => key.startsWith('cards.'))?.[1];

    const update = (changes: Partial<Draft>) =>
        setDraft((current) => ({ ...current, ...changes }));

    const submit = (event: FormEvent) => {
        event.preventDefault();

        const payload = {
            name: draft.name,
            cards: splitCustomCards(draft.cards),
            include_unknown: draft.includeUnknown,
            include_coffee: draft.includeCoffee,
        };
        const options = {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onSuccess: onDone,
            onError: (formErrors: Record<string, string>) =>
                setErrors(formErrors),
            onHttpException: () => {
                reloadDecks();
                onDone();

                return false;
            },
        };

        if (deck) {
            router.patch(
                PokerDecksController.update({ ...params, pokerDeck: deck.id })
                    .url,
                payload,
                options,
            );

            return;
        }

        router.post(PokerDecksController.store(params).url, payload, options);
    };

    return (
        <form onSubmit={submit} className="space-y-3 rounded-md border p-3">
            <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-name`}>{t('Deck name')}</Label>
                <Input
                    id={`${idPrefix}-name`}
                    value={draft.name}
                    maxLength={40}
                    required
                    onChange={(event) => update({ name: event.target.value })}
                />
                <InputError message={errors.name} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-cards`}>{t('Custom cards')}</Label>
                <Input
                    id={`${idPrefix}-cards`}
                    value={draft.cards}
                    placeholder="1, 2, 3, 5, 8"
                    required
                    onChange={(event) => update({ cards: event.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                    {t('Separate cards with commas.')}
                </p>
                <InputError message={cardsError} />
            </div>
            <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id={`${idPrefix}-unknown`}
                        checked={draft.includeUnknown}
                        onCheckedChange={(checked) =>
                            update({ includeUnknown: checked === true })
                        }
                    />
                    <Label htmlFor={`${idPrefix}-unknown`}>
                        {t('Add :card', { card: UnknownCard })}
                    </Label>
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox
                        id={`${idPrefix}-coffee`}
                        checked={draft.includeCoffee}
                        onCheckedChange={(checked) =>
                            update({ includeCoffee: checked === true })
                        }
                    />
                    <Label htmlFor={`${idPrefix}-coffee`}>
                        {t('Add :card', { card: CoffeeCard })}
                    </Label>
                </div>
            </div>
            <div className="flex gap-2">
                <Button disabled={processing}>{t('Save')}</Button>
                <Button type="button" variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
            </div>
        </form>
    );
}
```

The saved list is the exact deck: when editing, the stored `?`/`☕` become the checkbox states and the server's `withSpecialCards` appends them again (never twice).

- [ ] **Step 4: New game dialog**

In `resources/js/components/teams/new-poker-game-dialog.tsx` (Plan 10a Task 17):

1. Imports: `import type { PokerDeckOption, SavedPokerDeck } from '@/types';`.
2. `Props` gains `savedDecks: SavedPokerDeck[];` and `NewPokerGameForm` destructures `savedDecks`.
3. The `DeckFields` element becomes:

```tsx
            <DeckFields
                deckOptions={deckOptions}
                savedDecks={savedDecks}
                allowSaveAs
                value={deck}
                onChange={setDeck}
                errors={errors}
            />
```

`deckPayload(deck)` already carries `saved_deck_id` or `save_deck_as`; on a 422 nothing is created (server rule) and the errors show under the field.

- [ ] **Step 5: Team section and page**

In `resources/js/components/teams/poker-games-section.tsx`:

1. Imports: `import type { PokerDeckOption, PokerGameSummary, SavedPokerDeck } from '@/types';` and `import { SavedDecksDialog } from './saved-decks-dialog';`.
2. `Props` gains `savedDecks: SavedPokerDeck[];`, destructured as `savedDecks`.
3. Pass `savedDecks={savedDecks}` to `<NewPokerGameDialog … />`.
4. After the "Estimation history" button (inside the same flex row) add:

```tsx
                <SavedDecksDialog
                    workspaceSlug={workspaceSlug}
                    teamId={teamId}
                    decks={savedDecks}
                />
```

In `resources/js/pages/teams/show.tsx`: add `SavedPokerDeck` to the `@/types` import, `pokerDecks: SavedPokerDeck[];` to `Props` (after `canCreatePokerGame`), `pokerDecks,` to the destructuring, and `savedDecks={pokerDecks}` to `<PokerGamesSection … />`.

- [ ] **Step 6: Settings dialog loads the team's decks**

In `resources/js/components/poker/game-settings-dialog.tsx` (`SettingsForm`):

1. Imports: `useEffect` from `react`, `import PokerSavedDecksController from '@/actions/App/Http/Controllers/Poker/PokerSavedDecksController';`, `import type { SavedPokerDeck } from '@/types';`.
2. After the existing state:

```tsx
    const [savedDecks, setSavedDecks] = useState<SavedPokerDeck[]>([]);
    const canLoadSavedDecks = ctx.snapshot.me.isFacilitator && !deckLocked;

    useEffect(() => {
        if (!canLoadSavedDecks) {
            return;
        }

        let cancelled = false;

        retroRequest<SavedPokerDeck[]>(PokerSavedDecksController.index(game.id))
            .then((decks) => {
                if (!cancelled) {
                    setSavedDecks(decks ?? []);
                }
            })
            .catch(() => {
                // Built-in and custom decks still work without the list.
            });

        return () => {
            cancelled = true;
        };
    }, [canLoadSavedDecks, game.id]);
```

3. Pass `savedDecks={savedDecks}` to `<DeckFields … />` (no `allowSaveAs` here: saving decks happens on the team page).

The dialog's existing "deck changed" check compares `deckPayload(deck)` with `deckPayload(initialDeck)`, so choosing a saved deck sends `{deck: 'custom', saved_deck_id}` and the server copies its cards and name.

- [ ] **Step 7: Translations**

Append (only these keys are new; `Custom cards`, `Separate cards with commas.`, `Add :card`, `Save`, `Cancel` exist).

`lang/en.json`:

```json
    "Saved decks": "Saved decks",
    "New deck": "New deck",
    "Deck name": "Deck name",
    "Save this deck for the team as…": "Save this deck for the team as…",
    "Edit deck": "Edit deck",
    "Delete deck": "Delete deck",
    "Delete this deck?": "Delete this deck?",
    "Games that use it keep their cards.": "Games that use it keep their cards.",
    "No saved decks yet.": "No saved decks yet.",
    "Your team's decks": "Your team's decks"
```

`lang/fr.json`:

```json
    "Saved decks": "Jeux de cartes enregistrés",
    "New deck": "Nouveau jeu de cartes",
    "Deck name": "Nom du jeu de cartes",
    "Save this deck for the team as…": "Enregistrer ce jeu de cartes pour l'équipe sous…",
    "Edit deck": "Modifier le jeu de cartes",
    "Delete deck": "Supprimer le jeu de cartes",
    "Delete this deck?": "Supprimer ce jeu de cartes ?",
    "Games that use it keep their cards.": "Les parties qui l'utilisent gardent leurs cartes.",
    "No saved decks yet.": "Aucun jeu de cartes enregistré pour l'instant.",
    "Your team's decks": "Les jeux de cartes de votre équipe"
```

`lang/es.json`:

```json
    "Saved decks": "Barajas guardadas",
    "New deck": "Nueva baraja",
    "Deck name": "Nombre de la baraja",
    "Save this deck for the team as…": "Guardar esta baraja para el equipo como…",
    "Edit deck": "Editar baraja",
    "Delete deck": "Eliminar baraja",
    "Delete this deck?": "¿Eliminar esta baraja?",
    "Games that use it keep their cards.": "Las partidas que la usan conservan sus cartas.",
    "No saved decks yet.": "Todavía no hay barajas guardadas.",
    "Your team's decks": "Las barajas de tu equipo"
```

`lang/de.json`:

```json
    "Saved decks": "Gespeicherte Kartensätze",
    "New deck": "Neuer Kartensatz",
    "Deck name": "Name des Kartensatzes",
    "Save this deck for the team as…": "Diesen Kartensatz fürs Team speichern als…",
    "Edit deck": "Kartensatz bearbeiten",
    "Delete deck": "Kartensatz löschen",
    "Delete this deck?": "Diesen Kartensatz löschen?",
    "Games that use it keep their cards.": "Spiele, die ihn nutzen, behalten ihre Karten.",
    "No saved decks yet.": "Noch keine gespeicherten Kartensätze.",
    "Your team's decks": "Kartensätze deines Teams"
```

- [ ] **Step 8: Checks**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form`
Run: `npm run types:check && npm run check` — green except the known pre-existing failures.
Run: `npx vp check --fix resources/js/types/poker.ts resources/js/components/poker/deck-fields.tsx resources/js/components/teams/saved-decks-dialog.tsx resources/js/components/teams/new-poker-game-dialog.tsx resources/js/components/teams/poker-games-section.tsx resources/js/pages/teams/show.tsx resources/js/components/poker/game-settings-dialog.tsx`
Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php tests/Feature/Poker/SavedPokerDecksTest.php tests/Feature/Poker/PokerSavedDeckGamesTest.php` — PASS.

- [ ] **Step 9: Commit**

```bash
git add resources/js/types/poker.ts resources/js/components/poker/deck-fields.tsx resources/js/components/teams/saved-decks-dialog.tsx resources/js/components/teams/new-poker-game-dialog.tsx resources/js/components/teams/poker-games-section.tsx resources/js/pages/teams/show.tsx resources/js/components/poker/game-settings-dialog.tsx lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat: manage saved poker decks and start games from them

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

### Task 10: Spec 5 alignment check and docs touch-ups

**Files:**
- Modify: none in code. Only `docs/superpowers/specs/2026-09-29-mcp-server-design.md` when a name differs from what Plans 10a/10b emit.

**Interfaces:** none. Spec 5 (MCP) reads `BuildPokerSnapshot` / `PresentPokerRound`; this task only checks that its text names the fields exactly as the code now produces them, so the MCP plan starts from correct names (spec rule: specs are updated before code).

- [ ] **Step 1: Grep the MCP spec for every name the poker code emits**

```bash
for name in autoReveal anonymousVotes deckLabel isSpectator anonymous timerEndsAt revealReason voters saved_deck_id everyone_voted "These cards are already revealed."; do
  printf '%s: ' "$name"; grep -c -- "$name" docs/superpowers/specs/2026-09-29-mcp-server-design.md
done
```

Expected: every count ≥ 1 (at plan-writing time: `autoReveal` 2, `anonymousVotes` 2, `deckLabel` 2, `isSpectator` 2, `timerEndsAt` 2, `revealReason` 3, `voters` 3, `saved_deck_id` 4).

- [ ] **Step 2: Compare shapes, not only names**

Open §5, §6.2, §6.3, §9 and §13 of the MCP spec and check against the code:
- `poker.game.get` → `game.autoReveal`, `game.anonymousVotes`, `game.deckLabel` (saved deck name when set), `players[].isSpectator`, `currentTask.round.{anonymous, timerEndsAt, revealReason}` with `revealReason` values `manual` / `everyone_voted` / `timer` (`App\Enums\PokerRevealReason`), `me.isSpectator`, `voters` = non-spectator players only.
- `poker.game.tasks.list` → `latestRound.{anonymous, revealReason}`; anonymous rounds: `votes[].value` null except the caller's.
- `poker.games.create` → optional `saved_deck_id` exclusive with `custom_cards`, same 422 messages as the web form ("Choose a saved deck of this team.", "Choose either a saved deck or custom cards.").

If a name or value differs, edit the MCP spec text to the code's name (never the other way round) and add a one-line "Aligned with Plan 10 (2026-10-02)" note under the edited section.

- [ ] **Step 3: Commit (only when Step 2 changed the spec)**

```bash
git add docs/superpowers/specs/2026-09-29-mcp-server-design.md
git commit -m "docs: align the MCP spec with the poker payloads

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

Otherwise record "MCP spec already aligned" in the ledger and move on.

### Task 11: Verification (controller-driven)

**Files:** none new (fixes only, each in its own commit with a `fix:` message and a regression test when the fix is backend).

**Interfaces:**
- Consumes: everything of Plans 10a and 10b.
- Produces: green test/lint/type runs, a passed walkthrough recorded in the ledger, and the user's full-suite run.

- [ ] **Step 1:** `vendor/bin/sail artisan test --compact tests/Feature/Poker tests/Unit/Poker tests/Feature/Retros tests/Feature/TranslationKeysTest.php tests/Feature/UuidPrimaryKeysTest.php` — all green.
- [ ] **Step 2:** `vendor/bin/sail bin phpstan analyse --no-progress` — 0 errors; `vendor/bin/sail bin pint --dirty --format agent` — clean.
- [ ] **Step 3:** `npm run types:check && npm run check` — only the known pre-existing failures; `npm run build` — succeeds.
- [ ] **Step 4:** `grep -rn "lib/retro/whisper-transport" resources/js docs/superpowers/specs` — no hit (Task 6 moved it).
- [ ] **Step 5:** Ask the user to run the full suite: `vendor/bin/sail artisan test --compact`.
- [ ] **Step 6: Walkthrough** (driven step by step with the user; three browsers: A = team member who creates the game, B = a second team member, C = a guest in a private window; `npm run dev` or `npm run build`; a queue worker running: `vendor/bin/sail artisan queue:work`):
  1. **Saved deck.** On the team page A opens "Saved decks", creates "Team scale" with cards `1, 2, 3, 5, 8` and both `?`/`☕` checked: the list shows `1 2 3 5 8 ? ☕`. Try "team scale " as a second name → "A deck with this name already exists.". B (not the creator) sees the deck without Edit/Delete.
  2. **Game from the saved deck.** A clicks "New game", picks "Team scale" under "Your team's decks", checks "Anonymous votes" off and "Reveal automatically" off, creates: the header shows "Team scale". A edits the saved deck (adds `13`): the game's hand is unchanged after a reload.
  3. **Spectator.** A enables guest access and copies the link; C joins with "Join as spectator" checked: C's avatar has an eye badge, C sees "You're watching — switch to Play to vote" instead of the hand and appears under "Watching". B joins as themself.
  4. **Cursors between rounds.** With no current task, A and B see each other's named cursor over the main pane (mouse; on a touch device the dot appears while the finger is down). A clicks "Hide my cursor": B no longer sees A's cursor; A clicks again.
  5. **Cursors hidden while voting.** A adds a task and selects it: every cursor disappears for everyone while the round is open. Flying reactions from A, B and C still rise (from each sender's avatar) while the round is open.
  6. **Auto-reveal by everyone voting.** A opens Settings, turns on "Reveal automatically when everyone has voted or the timer ends": the "Auto-reveal" badge shows. A votes `5`, B votes `8`: the round reveals by itself in all three browsers with "Revealed automatically — everyone voted" (C, a spectator, was not waited for). Cursors come back after the reveal.
  7. **Auto-reveal on leave.** A clicks "Re-vote". A votes, then B closes their tab without voting: within about 2 s the round reveals ("everyone voted") in A and C. B reopens the game.
  8. **Timer.** A re-votes and starts a 30 s timer: the countdown shows in all browsers; B votes; at zero everyone hears the soft sound, sees "Time's up!" and the round reveals with "Revealed automatically — time's up". Repeat with auto-reveal turned off: at zero only "Time's up!" shows and the round stays open until "Show votes".
  9. **Stale timer.** With auto-reveal on, A starts a 30 s timer and within it clicks "Stop timer": at the original zero nothing reveals (the queued job no-ops).
  10. **Anonymous round.** A turns on "Anonymous votes" (the dialog shows the two-voter help), re-votes; A votes `3`, B votes `5`, reveal: the players' cards stay face-down with a check, an "Anonymous votes" row shows `3` and `5` in deck order, the result panel shows the average; each of A and B sees only their own value highlighted in the hand. Open the round history: the anonymous round lists who voted without values. A turns anonymity off ("Applies from the next round."): the revealed anonymous round stays anonymous in the history.
  11. **Facilitator switches roles.** A uses the player menu on B → "Make spectator": B's open vote disappears (face-down card gone) and B sees the watching text; A switches B back with "Make player". A clicks "Watch only" themself: A can still reveal, re-vote and set the estimate but has no hand.
  12. **Toggles.** A turns off "Show live cursors" and "Show flying reactions": the cursor layer and the reactions bar disappear in every browser; turning them back on restores both.
  13. **Ended game.** A ends the game: no cursors, no reactions bar, no hand, no "Watch only" toggle; reopening restores them.
  14. **Forged whisper sender.** With a WebSocket debugging extension that can send frames on C's existing Reverb socket (Chrome devtools can only inspect frames), send `{"event":"client-reaction","channel":"presence-poker.<gameId>","data":{"e":"🎉","id":"<A's player id>"}}`: A and B see the reaction labelled with C's name and rising from C's avatar (the sender is Reverb's stamped `user_id`, never the payload); a frame with `"e":"hello"` shows nothing.
  15. **Retro regression.** Open a retro board in two browsers: cursors show in Writing and disappear in Voting, reactions fly, an anonymous retro labels cursors "Participant" and reactions rise from the centre with no name; card dragging still works.
  16. **Translations.** Switch the language to French, Spanish and German on the game page: every new string (spectator, timer, auto-reveal notes, anonymous row, saved decks) is translated.
- [ ] **Step 7:** Record each walkthrough item's outcome in the ledger; for every failure, fix it in its own commit (with a test for backend fixes), rerun the affected tests and the item.
